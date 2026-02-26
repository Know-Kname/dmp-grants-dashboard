import { test, expect, mockApiRoutes, setupDemoMode } from './fixtures';

/**
 * IPAD & MOBILE RESPONSIVE TESTS
 * 
 * Run with iPad project: npx playwright test --project=iPad
 * Note: tap() tests are only run in iPad/Mobile projects (hasTouch: true).
 *       On chromium (no touch), use .click() instead.
 * Apple HIG requires minimum 44px touch targets.
 */

test.describe('iPad & Mobile Responsive', () => {

    // ─────────────────────────────────────────────────────
    // TOUCH TARGET SIZES (Apple HIG: 44px minimum)
    // ─────────────────────────────────────────────────────

    test('login "Sign In" button meets 44px touch target', async ({ page }) => {
        await page.goto('/login');
        const button = page.getByRole('button', { name: /sign in/i });
        const box = await button.boundingBox();
        expect(box).not.toBeNull();
        expect(box!.height).toBeGreaterThanOrEqual(44);
    });

    test('"Preview Demo" button meets 44px touch target', async ({ page }) => {
        await page.goto('/login');
        const button = page.getByRole('button', { name: /preview demo/i });
        const box = await button.boundingBox();
        expect(box).not.toBeNull();
        expect(box!.height).toBeGreaterThanOrEqual(44);
    });

    // ─────────────────────────────────────────────────────
    // NO HORIZONTAL SCROLLBAR (full viewport fit)
    // ─────────────────────────────────────────────────────

    test('login page fits within viewport (no horizontal scroll)', async ({ page }) => {
        await page.goto('/login');
        await page.waitForLoadState('networkidle');

        const overflow = await page.evaluate(() => ({
            bodyWidth: document.body.scrollWidth,
            viewportWidth: window.innerWidth,
        }));

        // Body should not be wider than viewport
        expect(overflow.bodyWidth).toBeLessThanOrEqual(overflow.viewportWidth + 1);
    });

    test('dashboard fits within viewport on iPad', async ({ page }) => {
        await mockApiRoutes(page);
        await setupDemoMode(page);
        await page.goto('/');
        await page.waitForLoadState('networkidle');

        const overflow = await page.evaluate(() => ({
            bodyWidth: document.body.scrollWidth,
            viewportWidth: window.innerWidth,
        }));

        expect(overflow.bodyWidth).toBeLessThanOrEqual(overflow.viewportWidth + 1);
    });

    // ─────────────────────────────────────────────────────
    // CLICK INTERACTIONS (works on all browsers)
    // Use click() for cross-browser tests; tap() only in iPad/Mobile project
    // ─────────────────────────────────────────────────────

    test('theme toggle responds to click', async ({ page }) => {
        await page.goto('/login');
        const toggle = page.getByRole('button', { name: /toggle theme/i });
        await expect(toggle).toBeVisible();
        await toggle.click();
        // Should still be on login (no crash/nav)
        await expect(page).toHaveURL(/\/login/);
    });

    test('theme toggle button is visible and interactive', async ({ page }) => {
        await page.goto('/login');
        const toggle = page.getByRole('button', { name: /toggle theme/i });
        await expect(toggle).toBeVisible();

        // Verify it's a real button with accessible role
        await expect(toggle).toBeEnabled();
    });

    // ─────────────────────────────────────────────────────
    // LAYOUT VERIFICATION
    // ─────────────────────────────────────────────────────

    test('login form elements are properly visible and accessible', async ({ page }) => {
        await page.goto('/login');
        await page.waitForLoadState('networkidle');

        // All key elements should be visible
        // Note: Login page h1 shows company name (e.g. "Detroit Memorial Park"), not "Sign In"
        await expect(page.getByLabel(/email address/i)).toBeVisible();
        await expect(page.getByLabel(/password/i)).toBeVisible();
        await expect(page.getByRole('button', { name: /sign in/i })).toBeVisible();
        await expect(page.getByRole('button', { name: /preview demo/i })).toBeVisible();
    });

    test('navigation sidebar is accessible on larger viewports', async ({ page }) => {
        await mockApiRoutes(page);
        await setupDemoMode(page);
        await page.goto('/');
        await page.waitForLoadState('networkidle');

        // On iPad (768px+), sidebar navigation links should be visible
        const workOrdersLink = page.getByRole('link', { name: /work orders/i }).first();
        await expect(workOrdersLink).toBeVisible();
    });
});
