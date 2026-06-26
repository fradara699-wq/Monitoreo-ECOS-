import express from 'express';
import path from 'path';
import { createServer as createViteServer } from 'vite';

async function startServer() {
  const app = express();
  const PORT = 3000;

  // Body parsing middleware
  app.use(express.json());

  // Proxy /.netlify/functions/airtable directly to our Netlify Function handler
  app.all('/.netlify/functions/airtable', async (req, res) => {
    try {
      // Dynamically import the Netlify function handler
      const { handler } = await import('./netlify/functions/airtable');
      
      // Construct the mock Netlify event object
      const event: any = {
        httpMethod: req.method,
        queryStringParameters: req.query as Record<string, string>,
        body: req.method !== 'GET' && req.method !== 'OPTIONS' ? JSON.stringify(req.body) : null,
        headers: req.headers as Record<string, string>,
      };

      // Execute Netlify function handler
      const result: any = await handler(event, {} as any);
      
      // Set response headers returned from Netlify function
      if (result?.headers) {
        Object.entries(result.headers).forEach(([key, value]) => {
          res.setHeader(key, value as string);
        });
      }
      
      res.status(result?.statusCode || 200).send(result?.body);
    } catch (err: any) {
      console.error("Express Netlify Proxy Error:", err);
      res.status(500).json({ error: err.message || 'Internal Server Error' });
    }
  });

  // Vite middleware for development
  if (process.env.NODE_ENV !== "production") {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), 'dist');
    app.use(express.static(distPath));
    // Support Express v4 / v5 routing fallback
    app.get('*', (req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`Server running on http://localhost:${PORT}`);
  });
}

startServer();
