import {
  users, systemPrompts, chatMessages, apiConfigurations,
  type User, type InsertUser,
  type SystemPrompt, type InsertSystemPrompt,
  type ChatMessage, type InsertChatMessage,
  type ApiConfiguration, type InsertApiConfiguration
} from "@shared/schema";
import fs from "node:fs";
import path from "node:path";

const DEFAULT_CONFIG_FILE = path.join(process.cwd(), "api-config.json");
const GOOGLE_CONFIG_FILE = path.join(process.cwd(), "google-api-config.json");
const PROMPTS_FILE = path.join(process.cwd(), "system-prompts.json");

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
}

export class MemStorage implements IStorage {
  private users: Map<number, User>;
  private systemPrompts: Map<number, SystemPrompt>;
  private chatMessages: Map<number, ChatMessage>;
  private configStores: Record<"default" | "google", {
    configs: Map<number, ApiConfiguration>;
    activeId: number | undefined;
    nextId: number;
  }>;
  private currentUserId: number;
  private currentPromptId: number;
  private currentMessageId: number;

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
    this.configStores = {
      default: { configs: new Map(), activeId: undefined, nextId: 1 },
      google: { configs: new Map(), activeId: undefined, nextId: 1 },
    };
    this.currentUserId = 1;
    this.currentPromptId = 1;
    this.currentMessageId = 1;

    // Load persisted system prompts if available
    this.loadPrompts();
    if (this.systemPrompts.size === 0) {
      this.initializeDefaultPrompts();
      this.persistPrompts();
    }

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
}

export const storage = new MemStorage();
