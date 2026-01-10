export interface LLMResponse {
  choices: Array<{
    message: {
      content: string;
      role: string;
    };
  }>;
}

export interface ChatRequest {
  messages: Array<{
    role: string;
    content: string;
  }>;
  systemPrompt?: string;
  attachments?: Array<{
    name: string;
    kind: "text" | "image";
    mimeType: string;
    text?: string;
    data?: string;
  }>;
}
