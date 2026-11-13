import tailwindcss from '@tailwindcss/vite';
import react from '@vitejs/plugin-react';
import { defineConfig } from 'vite';

export default defineConfig({
  plugins: [react(), tailwindcss()],
  server: {
    port: 5173,
    // the api listens on port 3000: the proxy keeps everything on one origin, so no cors in dev
    proxy: {
      '/api': 'http://localhost:3000',
    },
  },
});