import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  server: { port: 5173 },
  build: {
    rollupOptions: {
      output: {
        manualChunks: {
          // Split out heavy, rarely-changing vendor code into its own
          // chunk so it's cached independently of app code, and so a
          // single page importing it (e.g. OrderTrackingPage importing
          // supabase-js for Realtime) doesn't balloon that one chunk.
          vendor: ['react', 'react-dom', 'react-router-dom'],
          supabase: ['@supabase/supabase-js'],
        },
      },
    },
  },
});
