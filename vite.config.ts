import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import path from 'path'

export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
    },
  },
  build: {
    rollupOptions: {
      output: {
        manualChunks: {
          // Charting library — only Financial page uses it
          recharts: ['recharts'],
          // Supabase client
          supabase: ['@supabase/supabase-js'],
          // React core + router
          react: ['react', 'react-dom', 'react-router-dom'],
        },
      },
    },
  },
  server: {
    port: 5173,
  },
  test: {
    globals: true,
    environment: 'jsdom',
    setupFiles: './src/tests/setup.ts',
    include: ['src/**/*.test.{ts,tsx}'],
    css: true,
    coverage: {
      reporter: ['text', 'html', 'json'],
    },
  },
})
