import type { Express } from "express";
import { createServer, type Server } from "http";
import { storage } from "./storage";
import { insertSystemPromptSchema, insertChatMessageSchema, insertApiConfigurationSchema } from "@shared/schema";

export async function registerRoutes(app: Express): Promise<Server> {
  // System Prompts routes
  app.get("/api/prompts", async (req, res) => {
    try {
      const prompts = await storage.getAllSystemPrompts();
      res.json(prompts);
    } catch (error) {
      res.status(500).json({ message: "Failed to fetch prompts" });
    }
  });

  app.post("/api/prompts", async (req, res) => {
    try {
      const validatedData = insertSystemPromptSchema.parse(req.body);
      const prompt = await storage.createSystemPrompt(validatedData);
      res.status(201).json(prompt);
    } catch (error) {
      res.status(400).json({ message: "Invalid prompt data" });
    }
  });

  app.put("/api/prompts/:id", async (req, res) => {
    try {
      const id = parseInt(req.params.id);
      const validatedData = insertSystemPromptSchema.parse(req.body);
      const updated = await storage.updateSystemPrompt(id, validatedData);
      if (!updated) {
        return res.status(404).json({ message: "Prompt not found" });
      }
      res.json(updated);
    } catch (error) {
      res.status(400).json({ message: "Invalid prompt data" });
    }
  });

  app.delete("/api/prompts/:id", async (req, res) => {
    try {
      const id = parseInt(req.params.id);
      const deleted = await storage.deleteSystemPrompt(id);
      if (deleted) {
        res.status(204).send();
      } else {
        res.status(404).json({ message: "Prompt not found" });
      }
    } catch (error) {
      res.status(500).json({ message: "Failed to delete prompt" });
    }
  });

  // Chat Messages routes
  app.get("/api/messages", async (req, res) => {
    try {
      const messages = await storage.getAllChatMessages();
      res.json(messages);
    } catch (error) {
      res.status(500).json({ message: "Failed to fetch messages" });
    }
  });

  app.post("/api/messages", async (req, res) => {
    try {
      const validatedData = insertChatMessageSchema.parse(req.body);
      const message = await storage.createChatMessage(validatedData);
      res.status(201).json(message);
    } catch (error) {
      res.status(400).json({ message: "Invalid message data" });
    }
  });

  app.delete("/api/messages", async (req, res) => {
    try {
      await storage.clearChatMessages();
      res.status(204).send();
    } catch (error) {
      res.status(500).json({ message: "Failed to clear messages" });
    }
  });

  // API Configuration routes
  app.get("/api/config", async (req, res) => {
    try {
      const useGoogle = req.query.google === 'true';
      const config = await storage.getApiConfiguration(undefined, useGoogle);
      res.json(config || null);
    } catch (error) {
      res.status(500).json({ message: "Failed to fetch configuration" });
    }
  });

  app.get("/api/configs", async (req, res) => {
    try {
      const useGoogle = req.query.google === 'true';
      const configs = await storage.getAllApiConfigurations(useGoogle);
      const active = await storage.getApiConfiguration(undefined, useGoogle);
      res.json({ configs, activeId: active?.id ?? null });
    } catch (error) {
      res.status(500).json({ message: "Failed to fetch configurations" });
    }
  });

  app.post("/api/config", async (req, res) => {
    try {
      const useGoogle = req.query.google === 'true';
      const body = { ...req.body, useGoogle };
      const validatedData = insertApiConfigurationSchema.parse(body);
      const id = req.body.id ? Number(req.body.id) : undefined;
      const config = await storage.saveApiConfiguration({ ...validatedData, id }, useGoogle);
      res.json(config);
    } catch (error) {
      res.status(400).json({ message: "Invalid configuration data" });
    }
  });

  app.post("/api/configs/:id/activate", async (req, res) => {
    try {
      const useGoogle = req.query.google === 'true';
      const id = Number(req.params.id);
      const cfg = await storage.setActiveApiConfiguration(id, useGoogle);
      if (!cfg) {
        return res.status(404).json({ message: "Configuration not found" });
      }
      res.json(cfg);
    } catch (error) {
      res.status(500).json({ message: "Failed to activate configuration" });
    }
  });

  app.delete("/api/configs/:id", async (req, res) => {
    try {
      const useGoogle = req.query.google === 'true';
      const id = Number(req.params.id);
      const deleted = await storage.deleteApiConfiguration(id, useGoogle);
      if (!deleted) {
        return res.status(404).json({ message: "Configuration not found" });
      }
      res.status(204).send();
    } catch (error) {
      res.status(500).json({ message: "Failed to delete configuration" });
    }
  });

  // Test API connection
  app.post("/api/config/test", async (req, res) => {
    try {
      const useGoogle = req.query.google === 'true';
      const config = await storage.getApiConfiguration(undefined, useGoogle);
      
      if (!config) {
        return res.status(400).json({ message: "API configuration not found" });
      }

      if (useGoogle) {
        let GoogleGenAI: any;
        try {
          ({ GoogleGenAI } = await import("@google/genai"));
        } catch (err) {
          return res.status(500).json({
            message: "Failed to load Google SDK. Ensure '@google/genai' is installed",
            error: err instanceof Error ? err.message : String(err),
          });
        }
        const ai = new GoogleGenAI({ apiKey: config.token });
        const response = await ai.models.generateContent({
          model: config.model,
          contents: [{ role: "user", parts: [{ text: "Hello" }] }],
        });
        return res.json({
          success: true,
          message: "API connection successful",
          response: { text: response.text },
        });
      }

      const testMessage = {
        model: config.model,
        messages: [{ role: "user", content: "Hello" }],
        max_tokens: 10,
      };

      const response = await fetch(config.endpoint, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${config.token}`,
        },
        body: JSON.stringify(testMessage),
      });

      if (!response.ok) {
        const errorText = await response.text();
        return res.status(400).json({
          success: false,
          message: `API Test Failed: ${response.status} ${response.statusText}`,
          details: errorText,
        });
      }

      const data = await response.json();
      res.json({
        success: true,
        message: "API connection successful",
        response: data,
      });
    } catch (error) {
      res.status(500).json({ 
        success: false,
        message: "Test failed",
        error: error instanceof Error ? error.message : String(error)
      });
    }
  });

  // LLM API proxy route
  app.post("/api/chat", async (req, res) => {
    try {
      const { messages, systemPrompt } = req.body;
      const useGoogle = req.query.google === 'true';
      const config = await storage.getApiConfiguration(undefined, useGoogle);
      
      if (!config) {
        return res.status(400).json({ message: "API configuration not found" });
      }

      // Prepare messages for LLM API
      const apiMessages = [] as any[];

      if (systemPrompt) {
        apiMessages.push({
          role: 'system',
          content: systemPrompt
        });
      }

      apiMessages.push(...messages);

      // If using Google API, call via SDK
      if (useGoogle) {
        let GoogleGenAI: any;
        try {
          ({ GoogleGenAI } = await import("@google/genai"));
        } catch (err) {
          return res.status(500).json({
            message: "Failed to load Google SDK. Ensure '@google/genai' is installed",
            error: err instanceof Error ? err.message : String(err),
          });
        }
        const ai = new GoogleGenAI({ apiKey: config.token });
        const googleMessages = messages.map((m: any) => ({
          role: m.role === "assistant" ? "model" : "user",
          parts: [{ text: m.content }],
        }));
        if (systemPrompt) {
          if (googleMessages.length > 0 && googleMessages[0].role === "user") {
            googleMessages[0] = {
              role: "user",
              parts: [{ text: `${systemPrompt}\n\n${googleMessages[0].parts[0].text}` }],
            };
          } else {
            googleMessages.unshift({ role: "user", parts: [{ text: systemPrompt }] });
          }
        }
        const payload: any = {
          model: config.model,
          contents: googleMessages,
        };
        const response = await ai.models.generateContent(payload);
        return res.json({
          choices: [
            {
              message: { role: "assistant", content: response.text ?? "" },
            },
          ],
        });
      }

      // Prepare the request payload for generic API
      const requestPayload = {
        model: config.model,
        messages: apiMessages,
        temperature: 0.7,
        max_tokens: 2000,
        stream: false,
      };

      console.log('Sending request to LLM API:', {
        endpoint: config.endpoint,
        model: config.model,
        messagesCount: apiMessages.length
      });

      // Make request to LLM API
      const response = await fetch(config.endpoint, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${config.token}`
        },
        body: JSON.stringify(requestPayload)
      });

      console.log('LLM API response status:', response.status);

      if (!response.ok) {
        const errorText = await response.text();
        console.error('LLM API error response:', errorText);
        
        // Try to parse error as JSON for better error messages
        let errorDetails = errorText;
        try {
          const errorJson = JSON.parse(errorText);
          errorDetails = errorJson.error?.message || errorJson.message || errorText;
        } catch (e) {
          // Keep original error text if not JSON
        }
        
        return res.status(response.status).json({ 
          message: `LLM API Error: ${response.status} ${response.statusText}`,
          details: errorDetails,
          endpoint: config.endpoint
        });
      }

      const data = await response.json();
      console.log('LLM API success, response keys:', Object.keys(data));
      res.json(data);
    } catch (error) {
      console.error('Chat API error:', error);
      res.status(500).json({ 
        message: "Failed to process chat request",
        error: error instanceof Error ? error.message : String(error)
      });
    }
  });

  const httpServer = createServer(app);
  return httpServer;
}
