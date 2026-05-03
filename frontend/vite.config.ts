import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  server: {
    proxy: {
      '/api': 'https://walkthrough-backend-936505832896.us-east1.run.app/',  // For local use http://127.0.0.1:8000
    },
  },
});
