import { test, expect } from './fixtures';

/**
 * LOGIN PAGE TESTS
 * 
 * Tests for the login page. Uses `mockedPage` fixture where API mocking is needed.
 * Uses plain `page` for tests that don't need any backend.
 * 
 * Run: npx playwright test login
 */

test.describe('Login Page', () => {

    // ─────────────────────────────────────────────────────
    // BASIC UI CHECKS (no fixture needed - no API calls)
    // ─────────────────────────────────────────────────────

    test('shows login form with email and password fields', async ({ page }) => {
        await page.goto('/login');
        await expect(page.getByLabel(/email address/i)).toBeVisible();
        await expect(page.getByLabel(/password/i)).toBeVisible();
        await expect(page.getByRole('button', { name: /sign in/i })).toBeVisible();
    });

    test('shows "Preview Demo" button', async ({ page }) => {
        await page.goto('/login');
        await expect(page.getByRole('button', { name: /preview demo/i })).toBeVisible();
    });

    test('shows demo credentials hint', async ({ page }) => {
        await page.goto('/login');
        await expect(page.getByText('admin@dmp.com')).toBeVisible();
        await expect(page.getByText('admin123')).toBeVisible();
    });

    test('shows empty field validation on empty form submit', async ({ page }) => {
        await page.goto('/login');
        // Click submit with empty fields → HTML5 required validation
        await page.getByRole('button', { name: /sign in/i }).click();
        // Email field should be focused (HTML5 forms focus first invalid field)
        const emailInput = page.getByLabel(/email address/i);
        await expect(emailInput).toBeFocused();
    });

    // ─────────────────────────────────────────────────────
    // DEMO MODE - Preview Demo button
    // ─────────────────────────────────────────────────────

    test('demo button sets localStorage and navigates to dashboard', async ({ mockedPage: page }) => {
        await page.goto('/login');

        // Click "Preview Demo" — now calls loginAsDemo() which updates React state
        // AND sets localStorage, so ProtectedRoute immediately allows navigation to /
        await page.getByRole('button', { name: /preview demo/i }).click();

        // Should navigate to dashboard
        await page.waitForURL('/', { timeout: 10000 });

        // Verify localStorage was set
        const demoMode = await page.evaluate(() => localStorage.getItem('dmp-demo-mode'));
        expect(demoMode).toBe('true');

        // Verify we're on the dashboard
        await expect(page.getByRole('heading', { name: /dashboard/i })).toBeVisible();
    });

    // ─────────────────────────────────────────────────────
    // LOGIN WITH MOCKED API
    // ─────────────────────────────────────────────────────

    test('successful login with mocked API redirects to dashboard', async ({ mockedPage: page }) => {
        await page.goto('/login');
        await page.getByLabel(/email address/i).fill('admin@dmp.com');
        await page.getByLabel(/password/i).fill('admin123');
        await page.getByRole('button', { name: /sign in/i }).click();

        // With mocked API returning valid token, should redirect to /
        await page.waitForURL('/', { timeout: 10000 });
        await expect(page.getByRole('heading', { name: /dashboard/i })).toBeVisible();
    });

    test('failed login shows "Unable to sign in" error', async ({ page }) => {
        // Route login to return 401 unauthorized
        await page.route('**/api/auth/login', (route) =>
            route.fulfill({
                status: 401,
                contentType: 'application/json',
                body: JSON.stringify({
                    success: false,
                    error: { message: 'Invalid email or password', code: 'UNAUTHORIZED' },
                    statusCode: 401,
                }),
            })
        );

        await page.goto('/login');
        await page.getByLabel(/email address/i).fill('bad@example.com');
        await page.getByLabel(/password/i).fill('wrongpassword');
        await page.getByRole('button', { name: /sign in/i }).click();

        // Login.tsx renders Alert with title "Unable to sign in" on error
        await expect(page.getByText(/unable to sign in/i)).toBeVisible({ timeout: 8000 });
    });

    // ─────────────────────────────────────────────────────
    // THEME TOGGLE
    // ─────────────────────────────────────────────────────

    test('theme toggle button is present and clickable', async ({ page }) => {
        await page.goto('/login');
        const toggle = page.getByRole('button', { name: /toggle theme/i });
        await expect(toggle).toBeVisible();
        await toggle.click();
        // Should stay on login after click
        await expect(page).toHaveURL(/\/login/);
    });

    // ─────────────────────────────────────────────────────
    // VISUAL SNAPSHOT
    // ─────────────────────────────────────────────────────

    test('login page visual snapshot', async ({ page }) => {
        await page.goto('/login');
        await page.waitForLoadState('networkidle');
        await expect(page).toHaveScreenshot('login-page.png', {
            fullPage: true, threshold: 0.2,
        });
    });
});
