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
  getApiConfiguration(): Promise<ApiConfiguration | undefined>;
  saveApiConfiguration(config: InsertApiConfiguration): Promise<ApiConfiguration>;
}

export class MemStorage implements IStorage {
  private users: Map<number, User>;
  private systemPrompts: Map<number, SystemPrompt>;
  private chatMessages: Map<number, ChatMessage>;
  private apiConfiguration: ApiConfiguration | undefined;
  private currentUserId: number;
  private currentPromptId: number;
  private currentMessageId: number;
  private currentConfigId: number;
  private loadConfigFromFile(): void {
    try {
      if (fs.existsSync(CONFIG_FILE)) {
        const raw = fs.readFileSync(CONFIG_FILE, "utf8");
        const data = JSON.parse(raw) as Omit<ApiConfiguration, "id"> & { id?: number };
        const id = data.id ?? this.currentConfigId++;
        this.apiConfiguration = { ...data, id };
        this.currentConfigId = id + 1;
      }
    } catch (err) {
      console.error("Failed to load API configuration", err);
    }
  }

  constructor() {
    this.users = new Map();
    this.systemPrompts = new Map();
    this.chatMessages = new Map();
    this.apiConfiguration = undefined;
    this.currentUserId = 1;
    this.currentPromptId = 1;
    this.currentMessageId = 1;
    this.currentConfigId = 1;

    // Initialize with default prompts
    this.initializeDefaultPrompts();

    // Load persisted API configuration if available
    this.loadConfigFromFile();
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

  async getApiConfiguration(): Promise<ApiConfiguration | undefined> {
    return this.apiConfiguration;
  }

  async saveApiConfiguration(insertConfig: InsertApiConfiguration): Promise<ApiConfiguration> {
    const id = this.apiConfiguration?.id ?? this.currentConfigId++;
    const config: ApiConfiguration = {
      ...insertConfig,
      id,
    };
    this.apiConfiguration = config;

    try {
      fs.writeFileSync(CONFIG_FILE, JSON.stringify(config, null, 2), "utf8");
    } catch (err) {
      console.error("Failed to save API configuration", err);
    }

    return config;
  }
}

export const storage = new MemStorage();
