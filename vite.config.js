import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  root: './frontend',
  build: {
    outDir: '../dist',
  },
  server: {
    port: 5173,
    proxy: {
      '/api': 'http://localhost:5173',
    },
  },
  plugins: [react()],
});
