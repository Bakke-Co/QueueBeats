// vite.config.js
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import path from 'path';

export default defineConfig({
  plugins: [react(), {
    name: 'reject-unresolved-local-imports',
    generateBundle(_options, bundle) {
      for (const output of Object.values(bundle)) {
        if (output.type !== 'chunk') continue;
        for (const specifier of [...output.imports, ...output.dynamicImports]) {
          if (specifier.startsWith('@/')) this.error(`Unresolved local import: ${specifier}`);
        }
      }
    },
  }],
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
    },
  },
  build: {
    outDir: 'dist',
    emptyOutDir: true,
    rollupOptions: {
      output: {
        manualChunks: {
          vendor: ['react', 'react-dom'],
          spotify: ['@supabase/supabase-js'],
        },
      }
    },
    typescript: {
      noEmit: true,
      skipLibCheck: true,
      skipCheck: true
    }
  },
  server: {
    proxy: {
      '/.netlify/functions': {
        target: 'http://localhost:8888',
        changeOrigin: true
      }
    }
  }
});
