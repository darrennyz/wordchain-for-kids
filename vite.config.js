import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  base: '/wordchain-for-kids/',
  build: {
    outDir: 'dist',
  },
});
