import path from 'path';
import { defineConfig, loadEnv } from 'vite';
import react from '@vitejs/plugin-react';
import { handler } from './netlify/functions/gym-api';

const netlifyFunctionsPlugin = () => ({
  name: 'netlify-functions',
  configureServer(server: any) {
    server.middlewares.use('/.netlify/functions/gym-api', async (req: any, res: any, next: any) => {
      if (!req.url || req.url === '/' || req.url === '') {
        let body = '';
        req.on('data', (chunk: any) => { body += chunk.toString() });
        req.on('end', async () => {
          const event = {
            httpMethod: req.method,
            headers: req.headers,
            body: body,
          };
          try {
            const response = await handler(event);
            res.statusCode = response.statusCode;
            for (const [key, value] of Object.entries(response.headers || {})) {
              res.setHeader(key, value as string);
            }
            res.end(response.body);
          } catch (e) {
            res.statusCode = 500;
            res.end(JSON.stringify({ error: String(e) }));
          }
        });
        return;
      }
      next();
    });
  }
});

export default defineConfig(({ mode }) => {
    const env = loadEnv(mode, '.', '');
    // In local development we want to use the dev database
    // unless one is already provided in the environment.
    process.env.NETLIFY_DATABASE_URL = process.env.NETLIFY_DATABASE_URL || 'postgres://dummy:dummy@dummy/dummy';

    return {
      server: {
        port: 3000,
        host: '0.0.0.0',
      },
      plugins: [react(), netlifyFunctionsPlugin()],
      resolve: {
        alias: {
          '@': path.resolve(__dirname, '.'),
        }
      }
    };
});
