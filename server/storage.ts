import {
  users, systemPrompts, chatMessages, apiConfigurations,
  type User, type InsertUser,
  type SystemPrompt, type InsertSystemPrompt,
  type ChatMessage, type InsertChatMessage,
  type ApiConfiguration, type InsertApiConfiguration
} from "@shared/schema";
import fs from "node:fs";
import path from "node:path";

const CONFIG_FILE = path.join(process.cwd(), "api-config.json");
const GOOGLE_CONFIG_FILE = path.join(process.cwd(), "google-api-config.json");

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
  getApiConfiguration(id?: number, provider?: 'google'): Promise<ApiConfiguration | undefined>;
  getAllApiConfigurations(provider?: 'google'): Promise<ApiConfiguration[]>;
  saveApiConfiguration(config: InsertApiConfiguration & { id?: number }, provider?: 'google'): Promise<ApiConfiguration>;
  deleteApiConfiguration(id: number, provider?: 'google'): Promise<boolean>;
  setActiveApiConfiguration(id: number, provider?: 'google'): Promise<ApiConfiguration | undefined>;
}

export class MemStorage implements IStorage {
  private users: Map<number, User>;
  private systemPrompts: Map<number, SystemPrompt>;
  private chatMessages: Map<number, ChatMessage>;
  private apiConfigurations: Map<number, ApiConfiguration>;
  private activeConfigId: number | undefined;
  private googleApiConfigurations: Map<number, ApiConfiguration>;
  private googleActiveConfigId: number | undefined;
  private currentUserId: number;
  private currentPromptId: number;
  private currentMessageId: number;
  private currentConfigId: number;
  private googleCurrentConfigId: number;
  private loadConfigs(file: string) {
    try {
      if (fs.existsSync(file)) {
        const raw = fs.readFileSync(file, "utf8");
        return JSON.parse(raw) as { activeId?: number; configs?: ApiConfiguration[] };
      }
    } catch (err) {
      console.error("Failed to load API configurations", err);
    }
    return { configs: [], activeId: undefined };
  }

  private persistConfigs(file: string, activeId: number | undefined, configs: Map<number, ApiConfiguration>): void {
    try {
      const payload = { activeId, configs: Array.from(configs.values()) };
      fs.writeFileSync(file, JSON.stringify(payload, null, 2), "utf8");
    } catch (err) {
      console.error("Failed to save API configurations", err);
    }
  }

  constructor() {
    this.users = new Map();
    this.systemPrompts = new Map();
    this.chatMessages = new Map();
    this.apiConfigurations = new Map();
    this.googleApiConfigurations = new Map();
    this.activeConfigId = undefined;
    this.googleActiveConfigId = undefined;
    this.currentUserId = 1;
    this.currentPromptId = 1;
    this.currentMessageId = 1;
    this.currentConfigId = 1;
    this.googleCurrentConfigId = 1;

    // Initialize with default prompts
    this.initializeDefaultPrompts();

    // Load persisted API configurations if available
    const def = this.loadConfigs(CONFIG_FILE);
    this.apiConfigurations = new Map((def.configs ?? []).map(c => [c.id!, c]));
    this.currentConfigId = (def.configs ?? []).reduce((m, c) => Math.max(m, c.id ?? 0), 0) + 1;
    this.activeConfigId = def.activeId;

    const google = this.loadConfigs(GOOGLE_CONFIG_FILE);
    this.googleApiConfigurations = new Map((google.configs ?? []).map(c => [c.id!, c]));
    this.googleCurrentConfigId = (google.configs ?? []).reduce((m, c) => Math.max(m, c.id ?? 0), 0) + 1;
    this.googleActiveConfigId = google.activeId;
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
    return prompt;
  }

  async deleteSystemPrompt(id: number): Promise<boolean> {
    return this.systemPrompts.delete(id);
  }

  async updateSystemPrompt(id: number, data: InsertSystemPrompt): Promise<SystemPrompt | undefined> {
    const existing = this.systemPrompts.get(id);
    if (!existing) return undefined;
    const updated: SystemPrompt = { ...existing, ...data };
    this.systemPrompts.set(id, updated);
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

  async getApiConfiguration(id?: number, provider?: 'google'): Promise<ApiConfiguration | undefined> {
    const isGoogle = provider === 'google';
    const map = isGoogle ? this.googleApiConfigurations : this.apiConfigurations;
    const activeId = isGoogle ? this.googleActiveConfigId : this.activeConfigId;

    if (typeof id === "number") {
      return map.get(id);
    }
    if (activeId !== undefined) {
      return map.get(activeId);
    }
    return undefined;
  }

  async getAllApiConfigurations(provider?: 'google'): Promise<ApiConfiguration[]> {
    const map = provider === 'google' ? this.googleApiConfigurations : this.apiConfigurations;
    return Array.from(map.values());
  }

  async saveApiConfiguration(
    insertConfig: InsertApiConfiguration & { id?: number },
    provider?: 'google'
  ): Promise<ApiConfiguration> {
    const isGoogle = provider === 'google';
    const map = isGoogle ? this.googleApiConfigurations : this.apiConfigurations;
    const idCounter = isGoogle ? 'googleCurrentConfigId' : 'currentConfigId';
    const id = insertConfig.id ?? (this[idCounter] as number)++;
    const config: ApiConfiguration = { ...insertConfig, id };
    map.set(id, config);
    if (isGoogle) {
      this.googleActiveConfigId = id;
      this.persistConfigs(GOOGLE_CONFIG_FILE, this.googleActiveConfigId, this.googleApiConfigurations);
    } else {
      this.activeConfigId = id;
      this.persistConfigs(CONFIG_FILE, this.activeConfigId, this.apiConfigurations);
    }
    return config;
  }

  async deleteApiConfiguration(id: number, provider?: 'google'): Promise<boolean> {
    const isGoogle = provider === 'google';
    const map = isGoogle ? this.googleApiConfigurations : this.apiConfigurations;
    const activeIdProp = isGoogle ? 'googleActiveConfigId' : 'activeConfigId';
    const deleted = map.delete(id);
    if (deleted) {
      if (this[activeIdProp] === id) {
        const first = map.keys().next().value;
        this[activeIdProp] = first !== undefined ? first : undefined;
      }
      if (isGoogle) {
        this.persistConfigs(GOOGLE_CONFIG_FILE, this.googleActiveConfigId, this.googleApiConfigurations);
      } else {
        this.persistConfigs(CONFIG_FILE, this.activeConfigId, this.apiConfigurations);
      }
    }
    return deleted;
  }

  async setActiveApiConfiguration(
    id: number,
    provider?: 'google'
  ): Promise<ApiConfiguration | undefined> {
    const isGoogle = provider === 'google';
    const map = isGoogle ? this.googleApiConfigurations : this.apiConfigurations;
    const cfg = map.get(id);
    if (cfg) {
      if (isGoogle) {
        this.googleActiveConfigId = id;
        this.persistConfigs(GOOGLE_CONFIG_FILE, this.googleActiveConfigId, this.googleApiConfigurations);
      } else {
        this.activeConfigId = id;
        this.persistConfigs(CONFIG_FILE, this.activeConfigId, this.apiConfigurations);
      }
    }
    return cfg;
  }
}

export const storage = new MemStorage();
