import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  server: {
    port: 5173,
    proxy: {
      '/api': {
        target: 'http://localhost:3000',
        changeOrigin: true,
        // Allow large payloads (e.g. workflows with base64 file attachments)
        proxyTimeout: 60_000,
        timeout: 60_000,
      },
    },
  },
});
