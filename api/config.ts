import { VercelRequest, VercelResponse } from '@vercel/node';
import { storage } from '../server/storage';
import { insertApiConfigurationSchema } from '../shared/schema';

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
        const config = await storage.getApiConfiguration();
        return res.status(200).json(config || null);

      case 'POST':
        const validatedData = insertApiConfigurationSchema.parse(req.body);
        const savedConfig = await storage.saveApiConfiguration(validatedData);
        return res.status(200).json(savedConfig);

      default:
        res.setHeader('Allow', ['GET', 'POST']);
        return res.status(405).end(`Method ${method} Not Allowed`);
    }
  } catch (error) {
    console.error('Config API error:', error);
    return res.status(500).json({ message: 'Internal server error' });
  }
}