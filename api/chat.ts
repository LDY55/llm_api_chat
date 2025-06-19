import { VercelRequest, VercelResponse } from '@vercel/node';
import { storage } from '../server/storage';

export default async function handler(req: VercelRequest, res: VercelResponse) {
  const { method } = req;

  // Enable CORS
  res.setHeader('Access-Control-Allow-Credentials', 'true');
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET,OPTIONS,PATCH,DELETE,POST,PUT');
  res.setHeader(
    'Access-Control-Allow-Headers',
    'X-CSRF-Token, X-Requested-With, Accept, Accept-Version, Content-Length, Content-MD5, Content-Type, Date, X-Api-Version'
  );

  if (method === 'OPTIONS') {
    res.status(200).end();
    return;
  }

  if (method !== 'POST') {
    res.setHeader('Allow', ['POST']);
    return res.status(405).end(`Method ${method} Not Allowed`);
  }

  try {
    const { messages, systemPrompt } = req.body;
    const config = await storage.getApiConfiguration();
    
    if (!config) {
      return res.status(400).json({ message: "API configuration not found" });
    }

    const apiMessages: Array<{ role: string; content: string }> = [];
    
    if (systemPrompt) {
      apiMessages.push({
        role: 'system',
        content: systemPrompt
      });
    }

    apiMessages.push(...messages);

    const requestPayload = {
      model: config.model,
      messages: apiMessages,
      temperature: 0.7,
      max_tokens: 2000,
      stream: false
    };

    const response = await fetch(config.endpoint, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${config.token}`
      },
      body: JSON.stringify(requestPayload)
    });

    if (!response.ok) {
      const errorText = await response.text();
      
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
    res.json(data);
  } catch (error) {
    console.error('Chat API error:', error);
    res.status(500).json({ 
      message: "Failed to process chat request",
      error: error instanceof Error ? error.message : String(error)
    });
  }
}