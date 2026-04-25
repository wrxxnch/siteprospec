import express from 'express';
import { createServer as createViteServer } from 'vite';
import axios from 'axios';
import cors from 'cors';
import path from 'path';
import { fileURLToPath } from 'url';
import { GoogleGenAI } from '@google/genai';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

async function startServer() {
  const app = express();
  const PORT = 3000;

  app.use(cors());
  app.use(express.json());

  // API Route for Google Maps Search via SerpApi
  app.get('/api/search-maps', async (req, res) => {
    const { query, apiKey } = req.query;
    
    if (!query) return res.status(400).json({ error: 'Query is required' });
    
    const key = apiKey || process.env.SERPAPI_KEY;
    if (!key) return res.status(400).json({ error: 'SerpApi Key is required' });

    try {
      const response = await axios.get('https://serpapi.com/search', {
        params: {
          engine: 'google_maps',
          q: query,
          api_key: key,
          type: 'search'
        }
      });
      res.json(response.data);
    } catch (error: any) {
      console.error('SerpApi Error:', error.response?.data || error.message);
      res.status(500).json({ error: 'Failed to fetch from SerpApi' });
    }
  });

  // API Route for Google Maps Place Details via SerpApi (if needed for deeper data)
  app.get('/api/place-details', async (req, res) => {
    const { data_id, apiKey } = req.query;
    const key = apiKey || process.env.SERPAPI_KEY;

    try {
      const response = await axios.get('https://serpapi.com/search', {
        params: {
          engine: 'google_maps',
          data_id: data_id,
          api_key: key
        }
      });
      res.json(response.data);
    } catch (error: any) {
      res.status(500).json({ error: 'Failed to fetch place details' });
    }
  });

  // Vite middleware for development
  if (process.env.NODE_ENV !== 'production') {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), 'dist');
    app.use(express.static(distPath));
    app.get('*', (req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`Server running on http://localhost:${PORT}`);
  });
}

startServer();
