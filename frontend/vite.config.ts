import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  server: {
    proxy: {
      // '/api': 'http://127.0.0.1:8000' // For local use 
      '/api': 'https://walkthrough-backend-936505832896.us-east1.run.app/' // to build for production
    },
  },
});
