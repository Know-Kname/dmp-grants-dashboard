import { test as base, Page, expect } from '@playwright/test';

/**
 * PLAYWRIGHT FIXTURES FOR dmpgrants
 * 
 * Fixtures are a core Playwright feature: reusable setup/teardown that's
 * injected into tests. Instead of copy/pasting `beforeEach` blocks,
 * declare the fixture once and use it in any test.
 * 
 * Usage:
 *   import { test, expect } from './fixtures';
 *   test('my test', async ({ demoPage }) => { ... });
 */

// ─────────────────────────────────────────────────────
// MOCK DATA for API interception
// Matches the structure that api.ts + dashboard expects
// Note: api.ts transforms snake_case→camelCase on responses.
// MOCK_STATS uses camelCase keys directly to avoid double-transform.
// ─────────────────────────────────────────────────────
export const MOCK_STATS = {
    workOrders: { total: 42, pending: 10, inProgress: 7, completed: 25 },
    inventory: { total: 150, lowStock: 3 },
    receivables: { total: 18, overdue: 2, outstandingAmount: 75000 },
    burials: { total: 99, thisMonth: 5 },
    recentWorkOrders: [
        {
            id: 'wo-001',
            title: 'Lawn maintenance - Section A',
            status: 'in_progress',
            createdAt: new Date(Date.now() - 3 * 24 * 60 * 60 * 1000).toISOString(),
        },
    ],
    recentBurials: [
        {
            id: 'burial-001',
            deceasedFirstName: 'Robert',
            deceasedLastName: 'Johnson',
            burialDate: new Date(Date.now() - 5 * 24 * 60 * 60 * 1000).toISOString(),
        },
    ],
};

export const MOCK_WORK_ORDERS = [
    {
        id: 'wo-001',
        title: 'Lawn maintenance - Section A',
        description: 'Regular mowing and trimming',
        type: 'grounds',
        priority: 'medium',
        status: 'in_progress',
        assigned_to: null,
        assigned_to_name: 'John Smith',
        due_date: new Date(Date.now() + 2 * 24 * 60 * 60 * 1000).toISOString(),
        created_at: new Date().toISOString(),
    },
    {
        id: 'wo-002',
        title: 'Headstone repair - Plot 142',
        description: 'Minor crack repair on granite headstone',
        type: 'repair',
        priority: 'high',
        status: 'pending',
        assigned_to: null,
        assigned_to_name: null,
        due_date: new Date(Date.now() + 1 * 24 * 60 * 60 * 1000).toISOString(),
        created_at: new Date().toISOString(),
    },
];

// ─────────────────────────────────────────────────────
// DEMO USER (matches DEMO_USER in demo-data.ts)
// ─────────────────────────────────────────────────────
const DEMO_USER = {
    id: 'demo-user-001',
    email: 'demo@detroitmemorialpark.org',
    name: 'Demo User',
    role: 'admin',
};

// ─────────────────────────────────────────────────────
// MOCK ALL API ROUTES
// Intercepts backend calls and returns fixture data.
// MUST be called BEFORE page.goto() for routes to work.
// ─────────────────────────────────────────────────────
export async function mockApiRoutes(page: Page) {
    // Stats endpoint (Dashboard)
    await page.route('**/api/stats', (route) =>
        route.fulfill({ json: MOCK_STATS })
    );

    // Work orders endpoint
    await page.route('**/api/work-orders', (route) => {
        if (route.request().method() === 'GET') {
            return route.fulfill({ json: MOCK_WORK_ORDERS });
        }
        // POST - return a new work order  
        return route.fulfill({
            json: {
                ...MOCK_WORK_ORDERS[0],
                id: 'wo-new',
                title: 'New Work Order',
            },
        });
    });

    await page.route('**/api/work-orders/**', (route) => {
        if (route.request().method() === 'PUT') {
            return route.fulfill({ json: MOCK_WORK_ORDERS[0] });
        }
        if (route.request().method() === 'DELETE') {
            return route.fulfill({ status: 204, body: '' });
        }
        return route.continue();
    });

    // Auth endpoint - return mock login response
    await page.route('**/api/auth/login', (route) =>
        route.fulfill({
            json: {
                token: 'mock-jwt-token',
                user: {
                    id: 'user-001',
                    email: 'admin@dmp.com',
                    name: 'Admin User',
                    role: 'admin',
                },
            },
        })
    );

    // Grants endpoint
    await page.route('**/api/grants**', (route) =>
        route.fulfill({ json: [] })
    );
}

// ─────────────────────────────────────────────────────
// DEMO MODE SETUP
// Sets localStorage to enable demo mode.
// 
// IMPORTANT: Must navigate to the page BEFORE calling page.evaluate()
// to set localStorage (Playwright can't set localStorage for a page 
// that hasn't loaded yet). We navigate to /login (no redirect) first.
//
// Notes:
// - Sets 'token' for api.ts's getAuthHeaders() (reads 'token', not 'dmp-token')
// - Sets 'dmp-demo-mode', 'dmp-token', 'dmp-user' for auth.tsx isDemoMode()
// ─────────────────────────────────────────────────────
export async function setupDemoMode(page: Page) {
    // Navigate to /login first — no redirect needed from an unauthenticated page
    await page.goto('/login');

    // Set all localStorage items needed by the app
    await page.evaluate((user) => {
        // For auth.tsx isDemoMode() check
        localStorage.setItem('dmp-demo-mode', 'true');
        localStorage.setItem('dmp-token', 'demo-token');
        localStorage.setItem('dmp-user', JSON.stringify(user));
        // For api.ts getAuthHeaders() — reads 'token'
        localStorage.setItem('token', 'demo-token');
    }, DEMO_USER);
}

// ─────────────────────────────────────────────────────
// FIXTURES - Inject into tests via extend
// ─────────────────────────────────────────────────────

type DmpFixtures = {
    /** A page with demo mode + full API mocking set up */
    demoPage: Page;
    /** A page with only API mocking (no demo auth) */
    mockedPage: Page;
};

export const test = base.extend<DmpFixtures>({
    /**
     * demoPage: Page with demo mode active + all APIs mocked
     * Perfect for testing any authenticated page without a backend
     */
    demoPage: async ({ page }, use) => {
        // 1. Mock APIs FIRST (before any navigation)
        await mockApiRoutes(page);

        // 2. Set up demo localStorage (navigates to /login to set localStorage)
        await setupDemoMode(page);

        // 3. Now navigate to the dashboard — auth is set, routes are mocked
        await page.goto('/');
        await page.waitForLoadState('networkidle');

        await use(page);
    },

    /**
     * mockedPage: Just API mocking, no auth
     * For testing the login page with controlled API responses
     */
    mockedPage: async ({ page }, use) => {
        await mockApiRoutes(page);
        await use(page);
    },
});

export { expect };
