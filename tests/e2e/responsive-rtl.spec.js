const { test, expect } = require('./fixtures/test-base');

test.describe('Responsive RTL & Layout Integrity', () => {
  test('RTL-1: Desktop viewport (1280x800) renders RTL correctly without horizontal overflow', async ({ page }) => {
    await page.setViewportSize({ width: 1280, height: 800 });
    await page.goto('/%D9%85%D8%AA%D8%AC%D8%B1_2.HTML', { waitUntil: 'domcontentloaded' });
    await page.waitForSelector('#productsGrid', { timeout: 10000 });

    const dir = await page.evaluate(() => document.documentElement.dir);
    expect(dir).toBe('rtl');

    // Horizontal overflow check
    const hasHorizontalOverflow = await page.evaluate(() => {
      return document.documentElement.scrollWidth > window.innerWidth + 5;
    });
    expect(hasHorizontalOverflow).toBe(false);

    // Header actions and search are visible
    await expect(page.locator('#searchInput')).toBeVisible();
    await expect(page.locator('.logo-text, .brand, h1').first()).toBeVisible();
  });

  test('RTL-2: Tablet viewport (768x1024) adapts cleanly without clipping', async ({ page }) => {
    await page.setViewportSize({ width: 768, height: 1024 });
    await page.goto('/%D9%85%D8%AA%D8%AC%D8%B1_2.HTML', { waitUntil: 'domcontentloaded' });
    await page.waitForSelector('#productsGrid', { timeout: 10000 });

    const hasHorizontalOverflow = await page.evaluate(() => {
      return document.documentElement.scrollWidth > window.innerWidth + 5;
    });
    expect(hasHorizontalOverflow).toBe(false);

    const cardsCount = await page.locator('.product-card:visible').count();
    expect(cardsCount).toBeGreaterThanOrEqual(1);
  });

  test('RTL-3: Mobile viewport (375x667) maintains touch-friendly layout and RTL navigation', async ({ page }) => {
    await page.setViewportSize({ width: 375, height: 667 });
    await page.goto('/%D9%85%D8%AA%D8%AC%D8%B1_2.HTML', { waitUntil: 'domcontentloaded' });
    await page.waitForSelector('#productsGrid', { timeout: 10000 });

    const hasHorizontalOverflow = await page.evaluate(() => {
      return document.documentElement.scrollWidth > window.innerWidth + 5;
    });
    expect(hasHorizontalOverflow).toBe(false);

    // Search input should be interactive
    const search = page.locator('#searchInput');
    await expect(search).toBeVisible();
  });
});
