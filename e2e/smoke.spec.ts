import { test, expect, type Page } from '@playwright/test';

/**
 * Does the application work at all?
 *
 * Each test here corresponds to a defect that actually shipped while lint,
 * type-check and the whole unit suite stayed green. They are regression guards
 * for a *class* of failure — layout and runtime behaviour that jsdom cannot
 * model — not feature coverage.
 */

/**
 * Uncaught exceptions only.
 *
 * Deliberately not "no console errors": the smoke build points at an
 * unreachable Supabase host, so failed requests are expected and would make a
 * blanket assertion permanently red — the kind of noisy check people learn to
 * ignore. A thrown exception is unambiguous.
 */
function collectPageErrors(page: Page): string[] {
  const errors: string[] = [];
  page.on('pageerror', (e) => errors.push(e.message));
  return errors;
}

test('the app boots and renders the sign-in page', async ({ page }) => {
  const errors = collectPageErrors(page);

  await page.goto('/login');

  // The ConfigError screen renders instead of the app when env is missing, so
  // asserting real login copy proves the app itself mounted.
  await expect(page.getByRole('heading', { name: /welcome back/i })).toBeVisible();
  await expect(page.getByLabel(/email/i)).toBeVisible();

  expect(errors, `uncaught exceptions: ${errors.join(' | ')}`).toEqual([]);
});

test('one wheel gesture settles immediately and does not drift', async ({ page }) => {
  await page.goto('/login');
  await page.waitForTimeout(1500); // let entrance animations finish

  // Guarantee something to scroll regardless of viewport or content height.
  await page.evaluate(() => { document.body.style.minHeight = '4000px'; });

  await page.mouse.move(600, 350);
  await page.mouse.wheel(0, 600);
  await page.waitForTimeout(400);

  const settled = await page.evaluate(() => window.scrollY);
  await page.waitForTimeout(1200);
  const later = await page.evaluate(() => window.scrollY);

  // The regression this guards: a smooth-scroll library left scrollY at 0 for
  // over a second and then kept climbing past 1.6s, so the page appeared to
  // ignore the wheel and afterwards scroll by itself.
  expect(settled, 'wheel gesture should take effect promptly').toBeGreaterThan(0);
  expect(later, 'scroll position must not move after the wheel stops').toBe(settled);
});

test('font utilities emit valid CSS', async ({ page }) => {
  await page.goto('/login');

  const resolved = await page.evaluate(() => {
    const probe = document.createElement('div');
    probe.className = 'font-display';
    document.body.appendChild(probe);
    const family = getComputedStyle(probe).fontFamily;
    probe.remove();
    return family;
  });

  // The regression this guards: Tailwind emits the family list verbatim, and an
  // unquoted `Source Serif 4` is invalid CSS — a bare `4` is not a valid
  // identifier — so the browser discarded the whole declaration and the class
  // silently fell back to the body font while looking perfectly correct in the
  // markup and in the stylesheet text.
  expect(resolved, 'font-display must resolve, not fall back').toContain('Fraunces');
});
