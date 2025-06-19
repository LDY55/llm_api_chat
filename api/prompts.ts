import { VercelRequest, VercelResponse } from '@vercel/node';
import { storage } from '../server/storage';
import { insertSystemPromptSchema } from '../shared/schema';

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

  try {
    switch (method) {
      case 'GET':
        const prompts = await storage.getAllSystemPrompts();
        return res.status(200).json(prompts);

      case 'POST':
        const validatedData = insertSystemPromptSchema.parse(req.body);
        const prompt = await storage.createSystemPrompt(validatedData);
        return res.status(201).json(prompt);

      default:
        res.setHeader('Allow', ['GET', 'POST']);
        return res.status(405).end(`Method ${method} Not Allowed`);
    }
  } catch (error) {
    console.error('Prompts API error:', error);
    return res.status(500).json({ message: 'Internal server error' });
  }
}