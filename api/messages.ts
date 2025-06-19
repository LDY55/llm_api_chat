import { VercelRequest, VercelResponse } from '@vercel/node';
import { storage } from '../server/storage';
import { insertChatMessageSchema } from '../shared/schema';

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
        const messages = await storage.getAllChatMessages();
        return res.status(200).json(messages);

      case 'POST':
        const validatedData = insertChatMessageSchema.parse(req.body);
        const message = await storage.createChatMessage(validatedData);
        return res.status(201).json(message);

      case 'DELETE':
        await storage.clearChatMessages();
        return res.status(204).end();

      default:
        res.setHeader('Allow', ['GET', 'POST', 'DELETE']);
        return res.status(405).end(`Method ${method} Not Allowed`);
    }
  } catch (error) {
    console.error('Messages API error:', error);
    return res.status(500).json({ message: 'Internal server error' });
  }
}