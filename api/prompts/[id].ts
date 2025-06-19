import { VercelRequest, VercelResponse } from '@vercel/node';
import { storage } from '../../server/storage';

export default async function handler(req: VercelRequest, res: VercelResponse) {
  const { method, query } = req;
  const id = parseInt(query.id as string);

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

  if (!id || isNaN(id)) {
    return res.status(400).json({ message: 'Invalid prompt ID' });
  }

  try {
    switch (method) {
      case 'DELETE':
        const deleted = await storage.deleteSystemPrompt(id);
        if (deleted) {
          return res.status(204).end();
        } else {
          return res.status(404).json({ message: 'Prompt not found' });
        }

      default:
        res.setHeader('Allow', ['DELETE']);
        return res.status(405).end(`Method ${method} Not Allowed`);
    }
  } catch (error) {
    console.error('Prompt ID API error:', error);
    return res.status(500).json({ message: 'Internal server error' });
  }
}