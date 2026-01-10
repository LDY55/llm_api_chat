import {
  users, systemPrompts, chatMessages, apiConfigurations,
  type User, type InsertUser,
  type SystemPrompt, type InsertSystemPrompt,
  type ChatMessage, type InsertChatMessage,
  type ApiConfiguration, type InsertApiConfiguration,
  type Note, type InsertNote,
  type ApiUsageEntry
} from "@shared/schema";
import fs from "node:fs";
import path from "node:path";
import crypto from "node:crypto";

const DEFAULT_CONFIG_FILE = path.join(process.cwd(), "api-config.json");
const GOOGLE_CONFIG_FILE = path.join(process.cwd(), "google-api-config.json");
const PROMPTS_FILE = path.join(process.cwd(), "system-prompts.json");
const NOTES_FILE = path.join(process.cwd(), "notes.json");
const USAGE_FILE = path.join(process.cwd(), "data", "api-usage.json");

export interface IStorage {
  // Users
  getUser(id: number): Promise<User | undefined>;
  getUserByUsername(username: string): Promise<User | undefined>;
  createUser(user: InsertUser): Promise<User>;

  // System Prompts
  getAllSystemPrompts(): Promise<SystemPrompt[]>;
  getSystemPrompt(id: number): Promise<SystemPrompt | undefined>;
  createSystemPrompt(prompt: InsertSystemPrompt): Promise<SystemPrompt>;
  deleteSystemPrompt(id: number): Promise<boolean>;

  // Chat Messages
  getAllChatMessages(): Promise<ChatMessage[]>;
  createChatMessage(message: InsertChatMessage): Promise<ChatMessage>;
  clearChatMessages(): Promise<void>;

  // API Configuration
  getApiConfiguration(id?: number, useGoogle?: boolean): Promise<ApiConfiguration | undefined>;
  getAllApiConfigurations(useGoogle?: boolean): Promise<ApiConfiguration[]>;
  saveApiConfiguration(config: InsertApiConfiguration & { id?: number }, useGoogle?: boolean): Promise<ApiConfiguration>;
  deleteApiConfiguration(id: number, useGoogle?: boolean): Promise<boolean>;
  setActiveApiConfiguration(id: number, useGoogle?: boolean): Promise<ApiConfiguration | undefined>;

  // Notes
  getAllNotes(): Promise<Note[]>;
  createNote(note: InsertNote): Promise<Note>;
  updateNote(id: number, note: InsertNote): Promise<Note | undefined>;
  setNoteSummary(id: number, summary: string): Promise<Note | undefined>;
  deleteNote(id: number): Promise<boolean>;
  clearNotes(): Promise<void>;

  // API Usage
  getApiUsage(): Promise<ApiUsageEntry[]>;
  recordApiUsage(params: {
    token: string;
    name?: string;
    model?: string;
    useGoogle?: boolean;
    configId?: number;
    totalTokens: number;
    recordedAt?: Date;
  }): Promise<void>;
}

type UsageRecord = {
  tokenMask: string;
  name?: string;
  model?: string;
  useGoogle?: boolean;
  configId?: number;
  requests: number;
  totalTokens: number;
};

export class MemStorage implements IStorage {
  private users: Map<number, User>;
  private systemPrompts: Map<number, SystemPrompt>;
  private chatMessages: Map<number, ChatMessage>;
  private notes: Map<number, Note>;
  private usageByDate: Map<string, Map<string, UsageRecord>>;
  private configStores: Record<"default" | "google", {
    configs: Map<number, ApiConfiguration>;
    activeId: number | undefined;
    nextId: number;
  }>;
  private currentUserId: number;
  private currentPromptId: number;
  private currentMessageId: number;
  private currentNoteId: number;

  private getStore(useGoogle: boolean) {
    return this.configStores[useGoogle ? "google" : "default"];
  }

  private loadConfigs(useGoogle: boolean): void {
    const file = useGoogle ? GOOGLE_CONFIG_FILE : DEFAULT_CONFIG_FILE;
    const store = this.getStore(useGoogle);
    try {
      if (fs.existsSync(file)) {
        const raw = fs.readFileSync(file, "utf8");
        const data = JSON.parse(raw) as {
          activeId?: number;
          configs?: ApiConfiguration[];
        };
        const configs = (data.configs ?? []).map((c) => ({
          ...c,
          useGoogle,
        }));
        store.configs = new Map(configs.map((c) => [c.id!, c]));
        const maxId = configs.reduce((m, c) => Math.max(m, c.id ?? 0), 0);
        store.nextId = maxId + 1;
        store.activeId = data.activeId;
      }
    } catch (err) {
      console.error("Failed to load API configurations", err);
    }
  }

  private loadPrompts(): void {
    try {
      if (fs.existsSync(PROMPTS_FILE)) {
        const raw = fs.readFileSync(PROMPTS_FILE, "utf8");
        const data = JSON.parse(raw) as SystemPrompt[];
        this.systemPrompts = new Map(
          data.map((p) => [p.id, { ...p, createdAt: p.createdAt ? new Date(p.createdAt) : null }])
        );
        const maxId = data.reduce((m, p) => Math.max(m, p.id ?? 0), 0);
        this.currentPromptId = maxId + 1;
      }
    } catch (err) {
      console.error("Failed to load system prompts", err);
    }
  }

  private loadNotes(): void {
    try {
      if (fs.existsSync(NOTES_FILE)) {
        const raw = fs.readFileSync(NOTES_FILE, "utf8");
        const data = JSON.parse(raw) as Note[];
        const normalized = data.map((note) => ({
          ...note,
          createdAt: note.createdAt ?? note.updatedAt ?? new Date().toISOString(),
        }));
        this.notes = new Map(normalized.map((note) => [note.id, note]));
        const maxId = data.reduce((m, note) => Math.max(m, note.id ?? 0), 0);
        this.currentNoteId = maxId + 1;
      }
    } catch (err) {
      console.error("Failed to load notes", err);
    }
  }

  private loadUsage(): void {
    try {
      if (fs.existsSync(USAGE_FILE)) {
        const raw = fs.readFileSync(USAGE_FILE, "utf8");
        const data = JSON.parse(raw) as Array<{
          date: string;
          tokenHash: string;
          tokenMask: string;
          name?: string;
          model?: string;
          useGoogle?: boolean;
          configId?: number;
          requests: number;
          totalTokens: number;
        }>;
        this.usageByDate = new Map();
        for (const entry of data) {
          if (!entry?.date || !entry?.tokenHash) continue;
          const byToken = this.usageByDate.get(entry.date) ?? new Map();
          const key = this.getUsageKey(entry.tokenHash, entry.configId);
          byToken.set(key, {
            tokenMask: entry.tokenMask,
            name: entry.name,
            model: entry.model,
            useGoogle: entry.useGoogle,
            configId: entry.configId,
            requests: entry.requests ?? 0,
            totalTokens: entry.totalTokens ?? 0,
          });
          this.usageByDate.set(entry.date, byToken);
        }
      }
    } catch (err) {
      console.error("Failed to load API usage", err);
    }
  }

  private persistPrompts(): void {
    try {
      fs.writeFileSync(
        PROMPTS_FILE,
        JSON.stringify(Array.from(this.systemPrompts.values()), null, 2),
        "utf8"
      );
    } catch (err) {
      console.error("Failed to save system prompts", err);
    }
  }

  private persistNotes(): void {
    try {
      fs.writeFileSync(
        NOTES_FILE,
        JSON.stringify(Array.from(this.notes.values()), null, 2),
        "utf8"
      );
    } catch (err) {
      console.error("Failed to save notes", err);
    }
  }

  private persistUsage(): void {
    try {
      const dir = path.dirname(USAGE_FILE);
      if (!fs.existsSync(dir)) {
        fs.mkdirSync(dir, { recursive: true });
      }
      const payload: Array<{
        date: string;
        tokenHash: string;
        tokenMask: string;
        name?: string;
        model?: string;
        useGoogle?: boolean;
        configId?: number;
        requests: number;
        totalTokens: number;
      }> = [];
      for (const [date, tokens] of this.usageByDate.entries()) {
        for (const [usageKey, record] of tokens.entries()) {
          const tokenHash = usageKey.split(":")[0];
          payload.push({
            date,
            tokenHash,
            tokenMask: record.tokenMask,
            name: record.name,
            model: record.model,
            useGoogle: record.useGoogle,
            configId: record.configId,
            requests: record.requests,
            totalTokens: record.totalTokens,
          });
        }
      }
      fs.writeFileSync(USAGE_FILE, JSON.stringify(payload, null, 2), "utf8");
    } catch (err) {
      console.error("Failed to save API usage", err);
    }
  }

  private persistConfigs(useGoogle: boolean): void {
    const file = useGoogle ? GOOGLE_CONFIG_FILE : DEFAULT_CONFIG_FILE;
    const store = this.getStore(useGoogle);
    try {
      const payload = {
        activeId: store.activeId,
        configs: Array.from(store.configs.values()),
      };
      fs.writeFileSync(file, JSON.stringify(payload, null, 2), "utf8");
    } catch (err) {
      console.error("Failed to save API configurations", err);
    }
  }

  constructor() {
    this.users = new Map();
    this.systemPrompts = new Map();
    this.chatMessages = new Map();
    this.notes = new Map();
    this.usageByDate = new Map();
    this.configStores = {
      default: { configs: new Map(), activeId: undefined, nextId: 1 },
      google: { configs: new Map(), activeId: undefined, nextId: 1 },
    };
    this.currentUserId = 1;
    this.currentPromptId = 1;
    this.currentMessageId = 1;
    this.currentNoteId = 1;

    // Load persisted system prompts if available
    this.loadPrompts();
    if (this.systemPrompts.size === 0) {
      this.initializeDefaultPrompts();
      this.persistPrompts();
    }

    // Load persisted notes if available
    this.loadNotes();

    // Load persisted API usage
    this.loadUsage();

    // Load persisted API configurations for both modes
    this.loadConfigs(false);
    this.loadConfigs(true);

    // Add default user
    this.createUser({ username: "ldy", password: "123d5812dd3DDD" });
  }

  private initializeDefaultPrompts() {
    const defaultPrompts = [
      {
        name: 'Помощник программиста',
        content: 'Ты опытный программист, который помогает решать задачи и объясняет код понятным языком.'
      },
      {
        name: 'Переводчик',
        content: 'Переводи тексты на любые языки, сохраняя смысл и стиль оригинала.'
      },
      {
        name: 'Аналитик данных',
        content: 'Анализируй данные, строй графики и делай выводы на основе статистики.'
      }
    ];

    defaultPrompts.forEach(prompt => {
      const id = this.currentPromptId++;
      this.systemPrompts.set(id, {
        id,
        ...prompt,
        createdAt: new Date()
      });
    });
  }

  async getUser(id: number): Promise<User | undefined> {
    return this.users.get(id);
  }

  async getUserByUsername(username: string): Promise<User | undefined> {
    return Array.from(this.users.values()).find(
      (user) => user.username === username,
    );
  }

  async createUser(insertUser: InsertUser): Promise<User> {
    const id = this.currentUserId++;
    const user: User = { ...insertUser, id };
    this.users.set(id, user);
    return user;
  }

  async getAllSystemPrompts(): Promise<SystemPrompt[]> {
    return Array.from(this.systemPrompts.values()).sort((a, b) => {
      const aTime = a.createdAt ? a.createdAt.getTime() : 0;
      const bTime = b.createdAt ? b.createdAt.getTime() : 0;
      return aTime - bTime;
    });
  }

  async getSystemPrompt(id: number): Promise<SystemPrompt | undefined> {
    return this.systemPrompts.get(id);
  }

  async createSystemPrompt(insertPrompt: InsertSystemPrompt): Promise<SystemPrompt> {
    const id = this.currentPromptId++;
    const prompt: SystemPrompt = {
      ...insertPrompt,
      id,
      createdAt: new Date()
    };
    this.systemPrompts.set(id, prompt);
    this.persistPrompts();
    return prompt;
  }

  async deleteSystemPrompt(id: number): Promise<boolean> {
    const deleted = this.systemPrompts.delete(id);
    if (deleted) {
      this.persistPrompts();
    }
    return deleted;
  }

  async updateSystemPrompt(id: number, data: InsertSystemPrompt): Promise<SystemPrompt | undefined> {
    const existing = this.systemPrompts.get(id);
    if (!existing) return undefined;
    const updated: SystemPrompt = { ...existing, ...data };
    this.systemPrompts.set(id, updated);
    this.persistPrompts();
    return updated;
  }

  async getAllChatMessages(): Promise<ChatMessage[]> {
    return Array.from(this.chatMessages.values()).sort((a, b) => 
      a.timestamp!.getTime() - b.timestamp!.getTime()
    );
  }

  async createChatMessage(insertMessage: InsertChatMessage): Promise<ChatMessage> {
    const id = this.currentMessageId++;
    const message: ChatMessage = {
      ...insertMessage,
      id,
      timestamp: new Date()
    };
    this.chatMessages.set(id, message);
    return message;
  }

  async clearChatMessages(): Promise<void> {
    this.chatMessages.clear();
  }

  async getApiConfiguration(id?: number, useGoogle: boolean = false): Promise<ApiConfiguration | undefined> {
    const store = this.getStore(useGoogle);
    if (typeof id === "number") {
      return store.configs.get(id);
    }
    if (store.activeId !== undefined) {
      return store.configs.get(store.activeId);
    }
    return undefined;
  }

  async getAllApiConfigurations(useGoogle: boolean = false): Promise<ApiConfiguration[]> {
    const store = this.getStore(useGoogle);
    return Array.from(store.configs.values());
  }

  async saveApiConfiguration(
    insertConfig: InsertApiConfiguration & { id?: number },
    useGoogle: boolean = false,
  ): Promise<ApiConfiguration> {
    const store = this.getStore(useGoogle);
    const id = insertConfig.id ?? store.nextId++;
    const config: ApiConfiguration = {
      ...insertConfig,
      id,
      useGoogle,
    };
    store.configs.set(id, config);
    store.activeId = id;
    this.persistConfigs(useGoogle);
    return config;
  }

  async deleteApiConfiguration(id: number, useGoogle: boolean = false): Promise<boolean> {
    const store = this.getStore(useGoogle);
    const deleted = store.configs.delete(id);
    if (deleted) {
      if (store.activeId === id) {
        const first = store.configs.keys().next().value;
        store.activeId = first !== undefined ? first : undefined;
      }
      this.persistConfigs(useGoogle);
    }
    return deleted;
  }

  async setActiveApiConfiguration(
    id: number,
    useGoogle: boolean = false,
  ): Promise<ApiConfiguration | undefined> {
    const store = this.getStore(useGoogle);
    const cfg = store.configs.get(id);
    if (cfg) {
      store.activeId = id;
      this.persistConfigs(useGoogle);
    }
    return cfg;
  }

  async getAllNotes(): Promise<Note[]> {
    return Array.from(this.notes.values()).sort((a, b) =>
      a.updatedAt.localeCompare(b.updatedAt)
    );
  }

  async createNote(insertNote: InsertNote): Promise<Note> {
    const id = this.currentNoteId++;
    const content = insertNote.content ?? "";
    const title = insertNote.title ?? this.deriveNoteTitle(content);
    const createdAt = new Date().toISOString();
    const note: Note = {
      id,
      title: title.length > 0 ? title : "Без названия",
      content,
      createdAt,
      updatedAt: createdAt,
    };
    this.notes.set(id, note);
    this.persistNotes();
    return note;
  }

  async updateNote(id: number, insertNote: InsertNote): Promise<Note | undefined> {
    const existing = this.notes.get(id);
    if (!existing) return undefined;
    const content = insertNote.content ?? existing.content;
    const title = insertNote.title ?? this.deriveNoteTitle(content);
    const updated: Note = {
      ...existing,
      title: title.length > 0 ? title : "Без названия",
      content,
      createdAt: existing.createdAt ?? existing.updatedAt ?? new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };
    this.notes.set(id, updated);
    this.persistNotes();
    return updated;
  }

  async setNoteSummary(id: number, summary: string): Promise<Note | undefined> {
    const existing = this.notes.get(id);
    if (!existing) return undefined;
    const updated: Note = {
      ...existing,
      summary,
    };
    this.notes.set(id, updated);
    this.persistNotes();
    return updated;
  }

  async deleteNote(id: number): Promise<boolean> {
    const deleted = this.notes.delete(id);
    if (deleted) {
      this.persistNotes();
    }
    return deleted;
  }

  async clearNotes(): Promise<void> {
    this.notes.clear();
    this.persistNotes();
  }

  async getApiUsage(): Promise<ApiUsageEntry[]> {
    const entries: ApiUsageEntry[] = [];
    const dates = Array.from(this.usageByDate.keys()).sort((a, b) => b.localeCompare(a));
    for (const date of dates) {
      const tokens = this.usageByDate.get(date);
      if (!tokens) continue;
      for (const record of tokens.values()) {
        const tokenLabel = record.name
          ? `${record.name} (${record.tokenMask})`
          : record.tokenMask;
        entries.push({
          date,
          tokenLabel,
          requests: record.requests,
          totalTokens: record.totalTokens,
          model: record.model,
          useGoogle: record.useGoogle,
          configId: record.configId,
        });
      }
    }
    return entries;
  }

  async recordApiUsage(params: {
    token: string;
    name?: string;
    model?: string;
    useGoogle?: boolean;
    configId?: number;
    totalTokens: number;
    recordedAt?: Date;
  }): Promise<void> {
    const token = params.token?.trim();
    if (!token) return;
    const dateKey = this.toDateKey(params.recordedAt ?? new Date());
    const tokenHash = this.hashToken(token);
    const tokenMask = this.maskToken(token);
    const byToken = this.usageByDate.get(dateKey) ?? new Map<string, UsageRecord>();
    const usageKey = this.getUsageKey(tokenHash, params.configId);
    const existing = byToken.get(usageKey) ?? {
      tokenMask,
      name: params.name,
      model: params.model,
      useGoogle: params.useGoogle,
      configId: params.configId,
      requests: 0,
      totalTokens: 0,
    };
    existing.tokenMask = tokenMask;
    if (params.name) existing.name = params.name;
    if (params.model) existing.model = params.model;
    if (typeof params.useGoogle === "boolean") existing.useGoogle = params.useGoogle;
    if (typeof params.configId === "number") existing.configId = params.configId;
    existing.requests += 1;
    existing.totalTokens += Number.isFinite(params.totalTokens) ? params.totalTokens : 0;
    byToken.set(usageKey, existing);
    this.usageByDate.set(dateKey, byToken);
    this.persistUsage();
  }

  private deriveNoteTitle(content: string): string {
    const firstLine = content
      .split("\n")
      .map((line) => line.trim())
      .find((line) => line.length > 0);
    return (firstLine ?? "").slice(0, 32);
  }

  private toDateKey(date: Date): string {
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, "0");
    const day = String(date.getDate()).padStart(2, "0");
    return `${year}-${month}-${day}`;
  }

  private maskToken(token: string): string {
    const trimmed = token.trim();
    if (trimmed.length <= 8) {
      return trimmed.length > 0 ? `${trimmed.slice(0, 2)}...` : "***";
    }
    return `${trimmed.slice(0, 4)}...${trimmed.slice(-4)}`;
  }

  private hashToken(token: string): string {
    return crypto.createHash("sha256").update(token).digest("hex").slice(0, 16);
  }

  private getUsageKey(tokenHash: string, configId?: number): string {
    if (typeof configId === "number") {
      return `${tokenHash}:${configId}`;
    }
    return tokenHash;
  }
}

export const storage = new MemStorage();
