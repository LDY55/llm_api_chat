import { GoogleGenerativeAI } from '@google/generative-ai';

export type ChatMessage = {
  role: string;
  content: string;
};

export async function runGoogleChat(apiKey: string, modelName: string, messages: ChatMessage[], systemPrompt?: string) {
  const genAI = new GoogleGenerativeAI(apiKey);
  const model = genAI.getGenerativeModel({ model: modelName });

  const fullMessages = [
    ...(systemPrompt ? [{
      role: 'user',
      content: `Инструкция: ${systemPrompt}`
    }] : []),
    ...messages
  ];

  const result = await model.generateContent({
    contents: fullMessages.map(m => ({
      role: m.role,
      parts: [{ text: m.content }]
    }))
  });

  const response = await result.response;
  return response.text();
}
