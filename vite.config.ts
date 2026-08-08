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
      // `import.meta.dirname`, not `__dirname`: Vite 8 warns that the CJS
      // global is unsupported by `configLoader: 'native'`, which is planned to
      // become the default in a later major.
      '@': path.resolve(import.meta.dirname, './src'),
    },
  },
  build: {
    rolldownOptions: {
      output: {
        // Vite 8 bundles with Rolldown, which removed Rollup's object form of
        // `manualChunks` outright — it now type-errors as "not a function".
        // `codeSplitting.groups` is the replacement: each group claims the
        // modules whose resolved path matches `test`.
        //
        // Two differences from the old object form matter here. Paths are
        // matched with a regular expression rather than named as bare package
        // specifiers, so the `node_modules/` prefix and the trailing separator
        // are load-bearing — without the separator, `zod` would also claim a
        // hypothetical `zod-formik-adapter`. And groups are evaluated in order,
        // first match winning, so `react` sits last: it is the one every other
        // group's package also depends on, and putting it first would let it
        // claim shared React modules out from under them.
        codeSplitting: {
          groups: [
            // Charting library — only Financial page uses it
            { test: /node_modules[\\/]recharts[\\/]/, name: 'recharts' },
            // Supabase client
            { test: /node_modules[\\/]@supabase[\\/]/, name: 'supabase' },
            // Validation. Rollup used to keep zod out of the entry chunk on its
            // own, because only lazily-routed pages imported `lib/schemas`. The
            // dashboard now validates its RPC payloads and is eagerly imported
            // by App.tsx, which was enough to hoist all of zod into the entry —
            // ~59 kB raw / ~13 kB gzip of parser that the first paint does not
            // need. Naming it keeps it a separate, cacheable chunk shared by
            // every page that validates, fetched in parallel rather than ahead
            // of render.
            //
            // There is a regression test for exactly this: `npm run build` must
            // leave zod out of the entry chunk. See `e2e/bundle.spec.ts`.
            { test: /node_modules[\\/]zod[\\/]/, name: 'zod' },
            // React core + router
            {
              test: /node_modules[\\/](react|react-dom|react-router|react-router-dom|scheduler)[\\/]/,
              name: 'react',
            },
          ],
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
