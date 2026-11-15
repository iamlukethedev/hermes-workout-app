import react from '@vitejs/plugin-react';
import { defineConfig } from 'vitest/config';

export default defineConfig({
  // Relative asset paths let the build be served from any sub-path (e.g. GitHub Pages).
  base: './',
  build: { chunkSizeWarningLimit: 700 },
  plugins: [react()],
  test: {
    environment: 'node',
    include: ['tests/**/*.test.ts'],
  },
});
