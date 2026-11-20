const { test, expect } = require('./fixtures/test-base');

test.describe('Security & Negative Abuse Scenarios (Track A & Track B & Track C)', () => {
  test('SEC-1: Malicious cart price tampering is overwritten by authoritative catalog price', async ({ page }) => {
    await page.goto('/%D9%85%D8%AA%D8%AC%D8%B1_2.HTML', { waitUntil: 'domcontentloaded' });
    await page.waitForSelector('#productsGrid', { timeout: 10000 });

    // Simulate attacker tampering cart price in client memory/storage to 1 EGP
    await page.evaluate(async () => {
      const tamperedOrderPayload = {
        idempotencyKey: 'idem_tamper_attack_' + Date.now(),
        customer: {
          name: 'مهاجم أسعار',
          phone: '01000000000',
          address: 'موقع غير معروف'
        },
        items: [
          {
            lineId: 'line_tampered_01',
            productId: 'prod_shampoo_argan',
            name: 'شامبو الأرجان المغربي الأصلي',
            price: 1, // TAMPERED: Catalog price is 250
            quantity: 1
          }
        ],
        subtotal: 1,
        total: 1
      };

      if (typeof window.persistOrderOnline === 'function') {
        return await window.persistOrderOnline(tamperedOrderPayload);
      }
      return null;
    });

    // ── TRACK C: Verify authoritative catalog pricing was enforced in Firestore ──
    const orders = await page.evaluate(() => {
      return window.__TEST_BRIDGE__.getCollection('orders');
    });

    expect(orders.length).toBeGreaterThanOrEqual(1);
    const persistedOrder = orders[orders.length - 1];

    // The recorded item price MUST be 250 EGP, NOT 1 EGP!
    expect(persistedOrder.items[0].price).toBe(250);
    expect(persistedOrder.subtotal).toBe(250);
  });

  test('SEC-2: Purchasing unpublished product (isPublished: false) is strictly rejected', async ({ page }) => {
    await page.goto('/%D9%85%D8%AA%D8%AC%D8%B1_2.HTML', { waitUntil: 'domcontentloaded' });
    await page.waitForSelector('#productsGrid', { timeout: 10000 });

    // Attempt to persist an order for unpublished product
    const result = await page.evaluate(async () => {
      const orderWithUnpublished = {
        idempotencyKey: 'idem_unpub_' + Date.now(),
        customer: { name: 'فحص النشر', phone: '01000000001', address: 'القاهرة' },
        items: [
          {
            lineId: 'line_draft_01',
            productId: 'prod_draft_unreleased',
            name: 'سيروم غير معتمد',
            price: 300,
            quantity: 1
          }
        ],
        subtotal: 300,
        total: 300
      };

      try {
        if (typeof window.persistOrderOnline === 'function') {
          const res = await window.persistOrderOnline(orderWithUnpublished);
          return { ok: true, res };
        }
        return { ok: false, error: 'no-function' };
      } catch (err) {
        return { ok: false, error: err.message || String(err) };
      }
    });

    // Must be rejected
    expect(result.ok).toBe(false);
    expect(result.error).toMatch(/unavailable_for_purchase|not available for purchase|not published/i);

    // TRACK C: Verify no order was written to database
    const orders = await page.evaluate(() => {
      return window.__TEST_BRIDGE__.getCollection('orders').filter(o => 
        o.items && o.items.some(i => i.productId === 'prod_draft_unreleased')
      );
    });
    expect(orders.length).toBe(0);
  });

  test('SEC-3: Adding out-of-stock product to cart is prevented', async ({ page }) => {
    await page.goto('/%D9%85%D8%AA%D8%AC%D8%B1_2.HTML', { waitUntil: 'domcontentloaded' });
    await page.waitForSelector('#productsGrid', { timeout: 10000 });

    // Attempt to add out-of-stock product
    await page.evaluate(() => {
      window.addToCart('prod_unavailable_lotion', 1);
    });

    // Verify cart count remains 0 or hidden
    const isCartCountHidden = await page.evaluate(() => {
      const badge = document.getElementById('cartCount');
      return !badge || badge.style.display === 'none' || badge.textContent === '0';
    });
    expect(isCartCountHidden).toBe(true);

    const cartLength = await page.evaluate(() => window.cart ? window.cart.length : 0);
    expect(cartLength).toBe(0);
  });

  test('SEC-4: Unauthenticated visitor navigating to admin is locked at login screen', async ({ page }) => {
    // Set unauthenticated role
    await page.addInitScript(() => {
      if (window.__TEST_BRIDGE__) {
        window.__TEST_BRIDGE__.setRole('anonymous');
      }
    });

    await page.goto('/%D8%A7%D8%AF%D9%85%D9%86_2.HTML', { waitUntil: 'domcontentloaded' });
    await page.waitForTimeout(500);

    // Verify loginScreen is visible
    const loginScreen = page.locator('#loginScreen');
    await expect(loginScreen).toBeVisible();

    // Verify dashboard does not have active class
    const isDashboardActive = await page.evaluate(() => {
      const dash = document.getElementById('dashboard');
      return dash ? dash.classList.contains('active') : false;
    });
    expect(isDashboardActive).toBe(false);
  });
});
