import { defineConfig, devices } from '@playwright/test';

/**
 * Playwright E2E Test Configuration for Detroit Memorial Park
 * 
 * Uses the app's built-in Demo Mode so no backend/database is needed.
 * Run: npx playwright test
 * UI Mode: npx playwright test --ui
 * Debug: npx playwright test --debug
 */
export default defineConfig({
    testDir: './e2e',

    /* Run tests in parallel */
    fullyParallel: true,

    /* Fail the build on CI */
    forbidOnly: !!process.env.CI,

    /* Retry on CI */
    retries: process.env.CI ? 2 : 0,

    /* Limit workers on CI */
    workers: process.env.CI ? 1 : undefined,

    /* HTML reporter */
    reporter: [
        ['html', { outputFolder: 'playwright-report', open: 'never' }],
        ['list'],
    ],

    use: {
        /* Base URL for local dev server */
        baseURL: 'http://localhost:5173',

        /* Capture screenshot on failure */
        screenshot: 'only-on-failure',

        /* Record video on failure */
        video: 'on-first-retry',

        /* Collect trace on failure */
        trace: 'on-first-retry',
    },

    /* Test against Chromium and Firefox */
    projects: [
        {
            name: 'chromium',
            use: { ...devices['Desktop Chrome'] },
        },
        {
            name: 'firefox',
            use: { ...devices['Desktop Firefox'] },
        },
        /* Test responsive / iPad views */
        {
            name: 'iPad',
            use: { ...devices['iPad Pro 11'] },
        },
        {
            name: 'Mobile Chrome',
            use: { ...devices['Pixel 5'] },
        },
    ],

    /* Start the Vite dev server automatically */
    webServer: {
        command: 'npm run dev',
        url: 'http://localhost:5173',
        reuseExistingServer: !process.env.CI,
        timeout: 30000,
    },
});
