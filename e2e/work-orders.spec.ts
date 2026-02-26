import { test, expect } from './fixtures';

/**
 * WORK ORDERS TESTS  
 * 
 * Uses `demoPage` fixture (full demo mode + mocked APIs).
 * Run: npx playwright test work-orders
 * 
 * Note: The api.ts client transforms snake_case → camelCase on responses.
 * So `assigned_to_name` in mock data becomes `assignedToName` in JS.
 * The WorkOrders.tsx component reads `wo.assigned_to_name` (original key),
 * which is undefined after transform → displays "Unassigned".
 */

test.describe('Work Orders Page', () => {

    test('work orders page loads with header and filter bar', async ({ demoPage: page }) => {
        await page.goto('/work-orders');
        await page.waitForLoadState('networkidle');

        await expect(page.getByRole('heading', { name: /work orders/i })).toBeVisible();
        await expect(page.getByRole('button', { name: /new work order/i })).toBeVisible();
        await expect(page.getByPlaceholder(/search work orders/i)).toBeVisible();
    });

    test('mocked work orders appear in the table', async ({ demoPage: page }) => {
        await page.goto('/work-orders');
        await page.waitForLoadState('networkidle');

        // Both mocked work order titles should appear
        await expect(page.getByText('Lawn maintenance - Section A')).toBeVisible();
        await expect(page.getByText('Headstone repair - Plot 142')).toBeVisible();

        // Verify row count = 2 from our mock (tbody tr)
        const rows = page.locator('tbody tr');
        await expect(rows).toHaveCount(2);
    });

    test('table shows correct column headers', async ({ demoPage: page }) => {
        await page.goto('/work-orders');
        await page.waitForLoadState('networkidle');

        await expect(page.getByRole('columnheader', { name: /work order/i })).toBeVisible();
        await expect(page.getByRole('columnheader', { name: /type/i })).toBeVisible();
        await expect(page.getByRole('columnheader', { name: /priority/i })).toBeVisible();
        await expect(page.getByRole('columnheader', { name: /status/i })).toBeVisible();
        await expect(page.getByRole('columnheader', { name: /assigned to/i })).toBeVisible();
    });

    test('count display shows "2 of 2 orders" with mock data', async ({ demoPage: page }) => {
        await page.goto('/work-orders');
        await page.waitForLoadState('networkidle');

        await expect(page.getByText(/2 of 2 orders/i)).toBeVisible();
    });

    test('search filter hides non-matching work orders', async ({ demoPage: page }) => {
        await page.goto('/work-orders');
        await page.waitForLoadState('networkidle');

        const search = page.getByPlaceholder(/search work orders/i);
        await search.fill('Headstone');

        // "Headstone repair" should still show
        await expect(page.getByText('Headstone repair - Plot 142')).toBeVisible();
        // "Lawn maintenance" should NOT show
        await expect(page.getByText('Lawn maintenance - Section A')).not.toBeVisible();
    });

    test('status filter shows only matching orders', async ({ demoPage: page }) => {
        await page.goto('/work-orders');
        await page.waitForLoadState('networkidle');

        const statusSelect = page.locator('select').first();
        await expect(statusSelect).toHaveValue('all');

        // Filter to only "pending"
        await statusSelect.selectOption('pending');

        // Should show 1 of 2 orders
        await expect(page.getByText(/1 of 2 orders/i)).toBeVisible();
        await expect(page.getByText('Headstone repair - Plot 142')).toBeVisible();
        await expect(page.getByText('Lawn maintenance - Section A')).not.toBeVisible();
    });

    // ─────────────────────────────────────────────────────
    // MODAL
    // ─────────────────────────────────────────────────────

    test('"New Work Order" button opens create modal', async ({ demoPage: page }) => {
        await page.goto('/work-orders');
        await page.waitForLoadState('networkidle');

        await page.getByRole('button', { name: /new work order/i }).click();
        await expect(page.getByText(/create new work order/i)).toBeVisible();
        await expect(page.getByLabel(/title/i)).toBeVisible();
        await expect(page.getByLabel(/description/i)).toBeVisible();
    });

    test('cancel button closes the modal', async ({ demoPage: page }) => {
        await page.goto('/work-orders');
        await page.waitForLoadState('networkidle');

        await page.getByRole('button', { name: /new work order/i }).click();
        await expect(page.getByText(/create new work order/i)).toBeVisible();

        await page.getByRole('button', { name: /cancel/i }).click();
        await expect(page.getByText(/create new work order/i)).not.toBeVisible();
    });

    test('can create a work order with mocked API', async ({ demoPage: page }) => {
        await page.goto('/work-orders');
        await page.waitForLoadState('networkidle');

        await page.getByRole('button', { name: /new work order/i }).click();
        await page.getByLabel(/title/i).fill('Test Work Order from Playwright');

        // Click Create button (text exactly "Create" not "Cancel")
        await page.getByRole('button', { name: /^create$/i }).click();

        // Modal should close after successful create
        await expect(page.getByText(/create new work order/i)).not.toBeVisible({ timeout: 5000 });
    });
});
