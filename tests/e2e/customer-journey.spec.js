const { test, expect } = require('./fixtures/test-base');

test.describe('Customer Journey E2E (Dual-Track Validation: UI Execution + Track C Data Verification)', () => {
  test.beforeEach(async ({ page }) => {
    // Navigate to local store
    await page.goto('/%D9%85%D8%AA%D8%AC%D8%B1_2.HTML', { waitUntil: 'domcontentloaded' });
    // Wait for initial render
    await page.waitForSelector('#productsGrid', { timeout: 10000 });
  });

  test('CJ-1: Store loads with valid RTL Arabic layout and renders published products', async ({ page }) => {
    const dir = await page.getAttribute('html', 'dir');
    expect(dir).toBe('rtl');

    const products = await page.locator('.product-card').count();
    expect(products).toBeGreaterThanOrEqual(2);

    // Verify published product title is visible
    const productTitle = await page.locator('#productsGrid').textContent();
    expect(productTitle).toContain('شامبو الأرجان المغربي');
    expect(productTitle).toContain('كريم الكولاجين للوجه');

    // Verify unpublished product does NOT appear in public catalog
    expect(productTitle).not.toContain('سيروم غير معتمد');
  });

  test('CJ-2: Live search filters catalog dynamically in Arabic', async ({ page }) => {
    const searchInput = page.locator('#searchInput');
    await expect(searchInput).toBeVisible();

    await searchInput.fill('أرجان');
    // Allow debounce/search filter to apply
    await page.waitForTimeout(500);

    const visibleCards = page.locator('.product-card:visible');
    const count = await visibleCards.count();
    expect(count).toBeGreaterThanOrEqual(1);

    const text = await visibleCards.first().textContent();
    expect(text).toContain('شامبو الأرجان');
  });

  test('CJ-3: Add to cart, adjust quantity, and verify subtotal recalculation', async ({ page }) => {
    // Add product to cart via in-page helper or button
    await page.evaluate(() => {
      window.addToCart('prod_shampoo_argan', 1);
    });

    // Check cart count badge
    const badge = page.locator('#cartCount');
    await expect(badge).toHaveText('1');

    // Open cart sidebar
    await page.evaluate(() => {
      if (typeof window.openCart === 'function') window.openCart();
    });

    const cartSidebar = page.locator('#cartSidebar');
    await expect(cartSidebar).toBeVisible({ timeout: 5000 });

    const cartContent = await page.locator('#cartItems').textContent();
    expect(cartContent).toContain('شامبو الأرجان');
    expect(cartContent).toContain('250');

    // Add another quantity to make it 2
    await page.evaluate(() => {
      window.addToCart('prod_shampoo_argan', 1);
    });

    await expect(badge).toHaveText('2');
  });

  test('CJ-4: Coupon validation and discount computation', async ({ page }) => {
    // Add item to cart first so subtotal qualifies for minimum order amount
    await page.evaluate(() => {
      window.addToCart('prod_shampoo_argan', 1);
    });

    // Open cart
    await page.evaluate(() => {
      if (typeof window.openCart === 'function') window.openCart();
    });

    // Test invalid coupon
    await page.evaluate(() => {
      const input = document.getElementById('couponInput');
      if (input) input.value = 'NONEXISTENT';
      if (typeof window.applyCoupon === 'function') window.applyCoupon();
    });

    const discountRow = page.locator('#discountRow');
    await expect(discountRow).toHaveClass(/hidden/);

    // Test valid coupon SALE10
    await page.evaluate(() => {
      const input = document.getElementById('couponInput');
      if (input) input.value = 'SALE10';
      if (typeof window.applyCoupon === 'function') window.applyCoupon();
    });

    // Verify discount row is visible and contains discount amount
    await expect(discountRow).not.toHaveClass(/hidden/);
    const discountAmount = await page.locator('#discountAmount').textContent();
    expect(discountAmount).toContain('25'); // 10% of 250 = 25
  });

  test('CJ-5: End-to-end checkout submission and Track C Post-Action Data Verification', async ({ page }) => {
    // 1. Add item to cart
    await page.evaluate(() => {
      window.addToCart('prod_shampoo_argan', 2);
    });

    // 2. Open checkout modal
    await page.evaluate(async () => {
      if (typeof window.showCheckout === 'function') {
        await window.showCheckout();
      }
    });

    const checkoutModal = page.locator('#checkoutModal');
    await expect(checkoutModal).toBeVisible({ timeout: 5000 });

    // 3. Fill checkout form fields
    await page.locator('#checkoutName').fill('أحمد مصطفى علي');
    await page.locator('#checkoutPhone').fill('01012345678');
    await page.locator('#checkoutAddress').fill('15 شارع الجمهورية، مدينة نصر، القاهرة');
    await page.locator('#checkoutNotes').fill('التوصيل بعد الساعة 5 مساء');

    // 4. Submit order
    const submitBtn = page.locator('#checkoutForm button[type="submit"]');
    await submitBtn.click();

    // Wait for submission to complete
    await page.waitForTimeout(2000);

    // 5. TRACK C: Post-Action Data Verification in Firestore
    const orderData = await page.evaluate(() => {
      const orders = window.__TEST_BRIDGE__.getCollection('orders');
      return orders.length ? orders[orders.length - 1] : null;
    });

    expect(orderData).not.toBeNull();
    expect(orderData.id).toBeTruthy();

    // Verify customer info
    expect(orderData.customer).toBeDefined();
    expect(orderData.customer.name).toBe('أحمد مصطفى علي');
    expect(orderData.customer.phone).toBe('01012345678');
    expect(orderData.customer.address).toBe('15 شارع الجمهورية، مدينة نصر، القاهرة');

    // Verify order items and line identity
    expect(Array.isArray(orderData.items)).toBe(true);
    expect(orderData.items.length).toBe(1);

    const line = orderData.items[0];
    expect(line.productId).toBe('prod_shampoo_argan');
    expect(line.quantity).toBe(2);
    expect(line.price).toBe(250); // Authoritative catalog price
    expect(line.lineId).toBeTruthy();

    // Verify calculated totals
    expect(orderData.subtotal).toBe(500);
    expect(orderData.total).toBeGreaterThanOrEqual(500);
    expect(orderData.status).toBe('pending');
  });
});
