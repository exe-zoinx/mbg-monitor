import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { copyFileSync } from 'fs';
import { resolve } from 'path';

function copyCloudflareFiles() {
  return {
    name: 'copy-cloudflare-files',
    closeBundle() {
      try {
        copyFileSync(resolve('frontend/_headers'), resolve('dist/_headers'));
        copyFileSync(resolve('frontend/_redirects'), resolve('dist/_redirects'));
      } catch (e) {
        console.warn('Could not copy Cloudflare files:', e.message);
      }
    },
  };
}

export default defineConfig({
  root: 'frontend',
  plugins: [react(), copyCloudflareFiles()],
  build: {
    outDir: '../dist',
    emptyOutDir: true,
  },
  server: {
    port: 5173,
    proxy: {
      '/api': 'http://localhost:8787',
    },
  },
});
