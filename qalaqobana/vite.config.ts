import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import tailwindcss from 'tailwindcss';
import autoprefixer from 'autoprefixer';

export default defineConfig({
  root: 'client',
  plugins: [react()],
  css: {
    postcss: {
      plugins: [tailwindcss({ config: './tailwind.config.js' }), autoprefixer()],
    },
  },
  build: {
    outDir: '../dist/client',
    emptyOutDir: true,
  },
  server: {
    port: 5173,
    proxy: {
      '/socket.io': { target: 'http://localhost:3000', ws: true },
    },
  },
  test: {
    root: '.',
    include: ['tests/**/*.test.ts'],
  },
} as never);
