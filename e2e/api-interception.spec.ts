import { test, expect, MOCK_STATS } from './fixtures';

/**
 * API INTERCEPTION TESTS
 * 
 * Demonstrates Playwright's most powerful debugging feature:
 * intercepting and controlling network requests.
 * 
 * Key pattern: page.route() MUST be called BEFORE page.goto()
 * We use `demoPage` fixture which handles this correctly.
 * 
 * Run: npx playwright test api-interception
 */

// Helper to set up demo localStorage via addInitScript (before page load)
const DEMO_INIT_SCRIPT = () => {
    localStorage.setItem('dmp-demo-mode', 'true');
    localStorage.setItem('dmp-token', 'demo-token');
    localStorage.setItem('token', 'demo-token');
    localStorage.setItem('dmp-user', JSON.stringify({
        id: 'demo-user-001', email: 'demo@example.com', name: 'Demo User', role: 'admin',
    }));
};

test.describe('API Interception & Network Debugging', () => {

    // ─────────────────────────────────────────────────────
    // 1. USE demoPage fixture with additional route override
    // ─────────────────────────────────────────────────────

    test('dashboard shows specific numbers from mocked /api/stats', async ({ demoPage: page }) => {
        // demoPage fixture mocks /api/stats with MOCK_STATS (42 work orders, 99 burials, 150 inventory)
        // The stat cards are Links e.g. <Link to="/work-orders"> containing label + number
        // Wait up to 15s to allow React Query fetch + render cycle
        await expect(page.getByRole('link', { name: /Work Orders.*42/i }).first())
            .toBeVisible({ timeout: 15000 });
        await expect(page.getByRole('link', { name: /Inventory Items.*150/i }))
            .toBeVisible({ timeout: 15000 });
        await expect(page.getByRole('link', { name: /Burials.*99/i }))
            .toBeVisible({ timeout: 15000 });
    });

    test('dashboard shows 3 low stock subtitle from mocked data', async ({ demoPage: page }) => {
        // MOCK_STATS has inventory.lowStock = 3
        // Dashboard.tsx line 81: subtitle = `${n} low stock`
        await expect(page.getByText('3 low stock')).toBeVisible();
    });

    // ─────────────────────────────────────────────────────
    // 2. CUSTOM MOCK - Override a specific route
    // Uses addInitScript to inject localStorage before React loads
    // ─────────────────────────────────────────────────────

    test('critical alert shown when all inventory is low stock', async ({ page }) => {
        // 1. Register all routes BEFORE navigation
        await page.route('**/api/stats', (route) =>
            route.fulfill({
                json: {
                    ...MOCK_STATS,
                    inventory: { total: 10, lowStock: 10 }, // All items low!
                    receivables: { total: 50, overdue: 50, outstandingAmount: 999999 },
                },
            })
        );
        await page.route('**/api/work-orders', (route) => route.fulfill({ json: [] }));
        await page.route('**/api/grants**', (route) => route.fulfill({ json: [] }));

        // 2. Inject localStorage before page scripts run
        await page.addInitScript(DEMO_INIT_SCRIPT);

        // 3. Navigate once
        await page.goto('/');
        await page.waitForLoadState('networkidle');

        // "10 inventory items are low on stock" shows in Attention Required card
        await expect(page.getByText(/10 inventory items are low on stock/i)).toBeVisible({ timeout: 10000 });
    });

    // ─────────────────────────────────────────────────────
    // 3. SIMULATE SERVER ERROR
    // ─────────────────────────────────────────────────────

    test('work orders page shows error UI when API returns 500', async ({ demoPage: page }) => {
        // Override the work-orders route to return 500 AFTER fixture setup
        // Playwright routes are evaluated LIFO, so this override takes precedence
        await page.unroute('**/api/work-orders');
        await page.route('**/api/work-orders', (route) =>
            route.fulfill({
                status: 500,
                contentType: 'application/json',
                body: JSON.stringify({
                    success: false,
                    error: { message: 'Database error', code: 'DB_ERROR' },
                    statusCode: 500,
                }),
            })
        );

        await page.goto('/work-orders');
        await page.waitForLoadState('networkidle');

        // App should show an error message (React Query error state)
        const hasError =
            await page.getByRole('alert').isVisible().catch(() => false) ||
            await page.getByText(/failed to load work orders/i).isVisible().catch(() => false) ||
            await page.getByText(/something went wrong/i).isVisible().catch(() => false) ||
            await page.getByText(/error/i).first().isVisible().catch(() => false);

        expect(hasError).toBe(true);
    });

    // ─────────────────────────────────────────────────────
    // 4. SPY ON OUTGOING REQUESTS
    // ─────────────────────────────────────────────────────

    test('work order creation sends POST to /api/work-orders', async ({ demoPage: page }) => {
        const capturedRequests: { method: string; url: string }[] = [];

        // Spy using page.on('request') — runs alongside existing routes
        page.on('request', (req) => {
            if (req.url().includes('/api/work-orders') && req.method() === 'POST') {
                capturedRequests.push({ method: req.method(), url: req.url() });
            }
        });

        await page.goto('/work-orders');
        await page.waitForLoadState('networkidle');

        // Open modal and submit a new work order
        await page.getByRole('button', { name: /new work order/i }).click();
        await page.getByLabel(/title/i).fill('Playwright Spy Test');
        await page.getByRole('button', { name: /^create$/i }).click();

        // Wait for request to fly
        await page.waitForTimeout(1000);

        // Verify POST was made
        expect(capturedRequests.length).toBeGreaterThan(0);
        expect(capturedRequests[0].method).toBe('POST');
        expect(capturedRequests[0].url).toContain('/api/work-orders');
    });

    // ─────────────────────────────────────────────────────
    // 5. LOG ALL API CALLS (debugging tool)
    // ─────────────────────────────────────────────────────

    test('log all API calls during dashboard load', async ({ demoPage: page }) => {
        const apiLog: string[] = [];

        page.on('request', (req) => {
            if (req.url().includes('/api/')) {
                apiLog.push(`→ ${req.method()} ${new URL(req.url()).pathname}`);
            }
        });

        page.on('response', (res) => {
            if (res.url().includes('/api/')) {
                apiLog.push(`← ${res.status()} ${new URL(res.url()).pathname}`);
            }
        });

        // demoPage already navigated to /, but navigate to work-orders to trigger more calls
        await page.goto('/work-orders');
        await page.waitForLoadState('networkidle');

        console.log('\n📊 All API activity on work orders page load:');
        apiLog.forEach(entry => console.log(' ', entry));

        // Should have made at least one API call
        expect(apiLog.length).toBeGreaterThan(0);
    });
});
