import { test, expect } from '@playwright/test';

// Intercept every response and collect 5xx status codes
function trackServerErrors(page) {
  const errors = [];
  page.on('response', (res) => {
    if (res.status() >= 500) {
      errors.push({ url: res.url(), status: res.status() });
    }
  });
  return errors;
}

// ════════════════════════════════════════════════════════════
// HOMEPAGE
// ════════════════════════════════════════════════════════════

test.describe('Homepage', () => {
  test('renders without 500 errors and shows key UI elements', async ({ page }) => {
    const serverErrors = trackServerErrors(page);

    await page.goto('/');

    // ── Navbar ──
    const nav = page.locator('nav');
    await expect(nav).toBeVisible();
    await expect(nav.getByText('MeritX', { exact: false })).toBeVisible();

    // Navbar links present (text is "Agent Directory" and "Agent Tokenization")
    await expect(nav.getByRole('link', { name: /agent directory/i })).toBeVisible();
    await expect(nav.getByRole('link', { name: /agent tokenization/i })).toBeVisible();

    // ── Hero section ──
    await expect(page.getByText('Settlement Protocol', { exact: false })).toBeVisible();
    await expect(page.getByText('Autonomous AI Economies', { exact: false })).toBeVisible();

    // ── Agent Directory section exists ──
    await expect(page.locator('#directory')).toBeAttached();

    // ── Footer ──
    await expect(page.getByText('MeritX Protocol', { exact: false })).toBeVisible();

    // ── No 500 errors ──
    expect(serverErrors).toEqual([]);
  });

  test('page title contains MeritX', async ({ page }) => {
    await page.goto('/');
    await expect(page).toHaveTitle(/MeritX/i);
  });

  test('directory section shows agent cards or skeleton loaders', async ({ page }) => {
    await page.goto('/');

    const directory = page.locator('#directory');
    await expect(directory).toBeAttached();

    // Real project cards or skeleton shimmer placeholders
    const cards = directory.locator('[class*="rounded-2xl"]');
    const count = await cards.count();
    expect(count).toBeGreaterThan(0);
  });

  test('navbar tokenization link navigates to /launch', async ({ page }) => {
    await page.goto('/');
    const link = page.locator('nav').getByRole('link', { name: /agent tokenization/i });
    await link.click();
    await expect(page).toHaveURL(/\/launch/);
  });
});

// ════════════════════════════════════════════════════════════
// LAUNCH PAGE
// ════════════════════════════════════════════════════════════

test.describe('Launch Page', () => {
  test('renders without 500 errors and shows the IAO form', async ({ page }) => {
    const serverErrors = trackServerErrors(page);

    await page.goto('/launch');

    // ── Page heading ──
    await expect(page.getByText('Initialize Agent Offering', { exact: false })).toBeVisible();

    // ── Form fields ──
    await expect(page.getByText('Agent Name', { exact: false })).toBeVisible();
    await expect(page.getByText('Ticker', { exact: false }).first()).toBeVisible();

    // ── Name input is interactive ──
    const nameInput = page.locator('input[placeholder*="e.g."]').first();
    await expect(nameInput).toBeVisible();
    await nameInput.fill('TestAgent');
    await expect(nameInput).toHaveValue('TestAgent');

    // ── No 500s ──
    expect(serverErrors).toEqual([]);
  });

  test('shows protocol rules sidebar', async ({ page }) => {
    await page.goto('/launch');

    await expect(page.getByText('Instantiation Fee', { exact: false })).toBeVisible();
    // Use .first() to avoid strict mode violation (multiple matches)
    await expect(page.getByText('Soft Cap', { exact: false }).first()).toBeVisible();
  });

  test('launch button is present', async ({ page }) => {
    await page.goto('/launch');

    const btn = page.getByRole('button', { name: /launch|deploy|initialize/i });
    await expect(btn).toBeVisible();
  });
});

// ════════════════════════════════════════════════════════════
// API ROUTES (smoke)
// ════════════════════════════════════════════════════════════

test.describe('API health checks', () => {
  test('GET /api/ipfs returns 400 without cid (not 500)', async ({ request }) => {
    const res = await request.get('/api/ipfs');
    expect(res.status()).toBe(400);
    const body = await res.json();
    expect(body.error).toBeTruthy();
  });

  test('POST /api/pog/claim returns structured error for missing body', async ({ request }) => {
    const res = await request.post('/api/pog/claim', {
      headers: { 'Content-Type': 'application/json' },
      data: {},
    });
    // 400 (bad input) or 503/500 (missing config) — never an unhandled crash
    expect(res.status()).toBeLessThan(500);
  });
});
