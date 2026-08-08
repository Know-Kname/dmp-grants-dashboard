import { defineConfig, devices } from '@playwright/test';

/**
 * Browser smoke tests.
 *
 * These exist because the rest of the gate cannot see the class of bug that has
 * actually shipped here. Three separate defects — a smooth-scroll library that
 * made the page ignore the wheel for a second and then drift, a `sticky` table
 * header that never stuck, and a `font-display` utility that emitted invalid
 * CSS and silently fell back — all passed lint, type-check and the full unit
 * suite while doing nothing useful. jsdom has no layout engine, so no test
 * written against it could have caught any of them.
 *
 * The suite is deliberately tiny: it answers "does the application work at
 * all", not "is every feature correct". Unit tests remain the place for
 * behaviour.
 *
 * Runs against `vite preview` — the production build, not the dev server — so a
 * green run says something about what actually ships.
 */
export default defineConfig({
  testDir: './e2e',
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 1 : 0,
  workers: process.env.CI ? 1 : undefined,
  reporter: process.env.CI ? [['github'], ['list']] : 'list',

  use: {
    baseURL: 'http://localhost:4173',
    trace: 'on-first-retry',
  },

  projects: [
    {
      name: 'chromium',
      use: {
        ...devices['Desktop Chrome'],
        // Sandboxed CI images and this container both ship a browser at a fixed
        // path rather than Playwright's per-version cache. Honour it when set,
        // otherwise fall back to Playwright's own resolution.
        launchOptions: process.env.PLAYWRIGHT_CHROMIUM_PATH
          ? { executablePath: process.env.PLAYWRIGHT_CHROMIUM_PATH }
          : {},
      },
    },
  ],

  webServer: {
    command: 'npm run build && npm run preview -- --port 4173 --strictPort',
    url: 'http://localhost:4173',
    reuseExistingServer: !process.env.CI,
    timeout: 180_000,
    env: {
      // Obviously-fake values. The app renders a ConfigError screen instead of
      // mounting when `VITE_SUPABASE_*` are absent, so the smoke suite needs
      // *some* value to get past that gate. Nothing here authenticates against
      // anything; requests fail, which is expected and asserted around.
      VITE_SUPABASE_URL: 'https://smoke.invalid',
      VITE_SUPABASE_ANON_KEY: 'smoke-test-placeholder-not-a-credential',
    },
  },
});
