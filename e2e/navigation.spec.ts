import { test, expect } from './fixtures';

/**
 * NAVIGATION & DASHBOARD TESTS
 * 
 * Uses `demoPage` fixture which:
 * 1. Mocks all API routes (returning MOCK_STATS: 42 work orders, 99 burials, 150 inventory, 3 lowStock)
 * 2. Sets localStorage for demo mode auth (dmp-demo-mode, dmp-token, dmp-user, token)
 * 3. Navigates to / and waits for networkidle
 * 
 * Run: npx playwright test navigation
 */

test.describe('Navigation & Dashboard', () => {

    // ─────────────────────────────────────────────────────
    // HEADER & BASIC LAYOUT
    // ─────────────────────────────────────────────────────

    test('dashboard shows "Dashboard" heading', async ({ demoPage: page }) => {
        await expect(page.getByRole('heading', { name: 'Dashboard' })).toBeVisible();
    });

    test('dashboard shows current year in the date display', async ({ demoPage: page }) => {
        // The dashboard renders today's date using date-fns format: "Wednesday, February 25, 2026"
        // Use the specific date div (text-sm class) to avoid strict mode issue
        const year = new Date().getFullYear().toString();
        const dateDiv = page.locator('div.text-sm.text-foreground-muted', { hasText: year });
        await expect(dateDiv).toBeVisible();
    });

    // ─────────────────────────────────────────────────────
    // STAT CARDS - Verify mocked data displays correctly
    // Use the stat card link which contains both label and number
    // Dashboard.tsx renders: <Link to="/work-orders"><Card>...<p>Work Orders</p><p>42</p>...</Card></Link>
    // ─────────────────────────────────────────────────────

    test('dashboard shows Work Orders stat card with count 42', async ({ demoPage: page }) => {
        // MOCK_STATS has workOrders.total: 42
        // The stat card is a <Link> to /work-orders containing "Work Orders" and "42"
        const statCard = page.getByRole('link', { name: /Work Orders 42/i }).first();
        await expect(statCard).toBeVisible();
    });

    test('dashboard shows Burials stat card with count 99', async ({ demoPage: page }) => {
        // MOCK_STATS has burials.total: 99
        await expect(page.getByText('99')).toBeVisible();
    });

    test('dashboard shows Inventory Items stat card with count 150', async ({ demoPage: page }) => {
        // MOCK_STATS has inventory.total: 150
        // Use the stat card link locator which is unique
        const statCard = page.getByRole('link', { name: /Inventory Items 150/i });
        await expect(statCard).toBeVisible();
    });

    // ─────────────────────────────────────────────────────
    // ATTENTION REQUIRED ALERT  
    // Dashboard shows this card when lowStock > 0 or overdue > 0
    // ─────────────────────────────────────────────────────

    test('dashboard shows "Attention Required" alert for low stock', async ({ demoPage: page }) => {
        // MOCK_STATS has inventory.lowStock: 3 — triggers the alert card
        await expect(page.getByText('Attention Required')).toBeVisible();
        // Exact text from Dashboard.tsx line 171: "{n} inventory items are low on stock"
        await expect(page.getByText(/3 inventory items are low on stock/i)).toBeVisible();
    });

    // ─────────────────────────────────────────────────────
    // COMPANY INFORMATION CARD
    // ─────────────────────────────────────────────────────

    test('dashboard shows company name heading', async ({ demoPage: page }) => {
        // Dashboard has h2 with the full company name inside the Company Overview Card
        await expect(page.getByRole('heading', { name: /Detroit Memorial Park Association/i })).toBeVisible();
    });

    test('dashboard shows company phone number link', async ({ demoPage: page }) => {
        // Company Overview card has a phone link button
        // Use .first() to pick one of the multiple phone links (there are 3 locations)
        await expect(page.getByRole('link', { name: /\(586\)/ }).first()).toBeVisible();
    });

    test('dashboard shows website link', async ({ demoPage: page }) => {
        await expect(page.getByRole('link', { name: /website/i }).first()).toBeVisible();
    });

    // ─────────────────────────────────────────────────────
    // NAVIGATION
    // ─────────────────────────────────────────────────────

    test('"Coming Soon" inventory page renders placeholder', async ({ demoPage: page }) => {
        await page.goto('/inventory');
        // Inventory page renders: 'Inventory (Coming Soon)' in a div
        await expect(page.getByText('Inventory (Coming Soon)')).toBeVisible();
    });
});
