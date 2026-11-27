import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig(() => {
    return {
      server: {
        port: 3000,
        host: '0.0.0.0',
        proxy: {
          '/gym-api': {
            target: 'http://127.0.0.1:8787',
            // The Worker checks browser writes against their original Host.
            changeOrigin: false,
          },
        },
      },
      plugins: [react()],
      test: {
        environment: 'jsdom',
        setupFiles: ['./vitest.setup.ts'],
      }
    };
});
