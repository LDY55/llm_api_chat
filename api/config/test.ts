import { VercelRequest, VercelResponse } from '@vercel/node';
import { storage } from '../../server/storage';

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
    const config = await storage.getApiConfiguration();
    
    if (!config) {
      return res.status(400).json({ message: "API configuration not found" });
    }

    const testMessage = {
      model: config.model,
      messages: [{ role: "user", content: "Hello" }],
      max_tokens: 10
    };

    const response = await fetch(config.endpoint, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${config.token}`
      },
      body: JSON.stringify(testMessage)
    });

    if (!response.ok) {
      const errorText = await response.text();
      return res.status(400).json({ 
        success: false,
        message: `API Test Failed: ${response.status} ${response.statusText}`,
        details: errorText
      });
    }

    const data = await response.json();
    res.json({ 
      success: true, 
      message: "API connection successful",
      response: data
    });
  } catch (error) {
    res.status(500).json({ 
      success: false,
      message: "Test failed",
      error: error instanceof Error ? error.message : String(error)
    });
  }
}