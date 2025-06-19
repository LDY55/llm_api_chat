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
}
