import { defineConfig } from 'vitest/config';
import react from '@vitejs/plugin-react';
import path from 'path';

export default defineConfig({
  plugins: [react()],
  test: {
    globals: true,
    environment: 'jsdom',
    setupFiles: './src/test/setup.ts',
    include: ['src/__tests__/**/*.{test,spec}.{ts,tsx}'],
    alias: {
      '@': path.resolve(__dirname, './src'),
    },
    testTimeout: 30000,
    env: {
      VITE_API_BASE_URL: 'http://localhost:3000',
    },
  },
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
    },
  },
});
