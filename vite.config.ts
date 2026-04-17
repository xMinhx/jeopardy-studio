/// <reference types="vitest" />
import react from '@vitejs/plugin-react';
import { defineConfig } from 'vite';
import { fileURLToPath, URL } from 'node:url';

export default defineConfig(({ command }) => {
  const isDev = command === 'serve';
  return {
    base: isDev ? '/' : './',
    plugins: [react()],
    server: { port: 5173, strictPort: true },
    resolve: {
      alias: {
        '@': fileURLToPath(new URL('./src', import.meta.url)),
      },
    },
    build: { outDir: 'dist/renderer', sourcemap: true },
    test: {
      globals: true,
      environment: 'jsdom',
      setupFiles: './tests/setup.ts',
      include: ['tests/**/*.test.{ts,tsx}'],
    },
  };
});
