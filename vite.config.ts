// Pin the timezone for test runs before anything else loads.
//
// This has to happen at config-module load: Vitest spawns worker processes that
// inherit this env, and each worker initialises its date subsystem at startup.
// Setting TZ any later (via `test.env`, or inside the setup file) updates
// process.env but leaves the already-initialised zone as UTC.
//
// America/Detroit is where DMP operates and, being a negative UTC offset, is the
// case where naive UTC date handling silently shifts the calendar day.
process.env.TZ = process.env.TZ ?? 'America/Detroit'

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
          // Validation. Rollup used to keep zod out of the entry chunk on its
          // own, because only lazily-routed pages imported `lib/schemas`. The
          // dashboard now validates its RPC payloads and is eagerly imported by
          // App.tsx, which was enough to hoist all of zod into the entry — ~59
          // kB raw / ~13 kB gzip of parser that the first paint does not need.
          // Naming it keeps it a separate, cacheable chunk shared by every page
          // that validates, fetched in parallel rather than ahead of render.
          zod: ['zod'],
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
