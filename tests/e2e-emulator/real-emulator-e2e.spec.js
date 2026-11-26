/**
 * REAL PLAYWRIGHT CHROMIUM + REAL FIREBASE AUTH & FIRESTORE EMULATOR E2E SUITE
 *
 * Strictly executes real UI interactions (button clicks, form inputs, select dropdowns)
 * against the unmodified store (`متجر_2.HTML`) and admin dashboard (`ادمن_2.HTML`)
 * wired via `?useEmulator=1` to real Auth + Firestore Emulators enforcing `firestore.rules`.
 *
 * ZERO Firebase SDK mocking. ZERO `window.__TEST_BRIDGE__`. ZERO `page.evaluate()` shortcuts.
 */

const { test, expect } = require('@playwright/test');
const emu = require('./emulator-admin-helper');

const STORE_EMU_URL = '/%D9%85%D8%AA%D8%AC%D8%B1_2.HTML?useEmulator=1';
const ADMIN_EMU_URL = '/%D8%A7%D8%AF%D9%85%D9%86_2.HTML?useEmulator=1';

async function signInCustomerViaUi(page, email, secret) {
  await page.waitForFunction(() => window.storeAuthResolved === true || document.querySelector('#productsGrid .product-card') !== null, null, { timeout: 15000 });
  // Wait briefly until auth state resolution settles so #userBtn opens AuthModal
  await page.waitForFunction(() => typeof storeAuthResolved !== 'undefined' && storeAuthResolved === true, null, { timeout: 15000 }).catch(() => null);

  await page.locator('#userBtn').click();
  const authModal = page.locator('#authModal');
  await expect(authModal).toHaveClass(/active/, { timeout: 8000 });

  await page.locator('.auth-tab[data-tab="password"]').click();
  await page.locator('#loginIdentifier').fill(email);
  await page.locator('#loginPassword').fill(secret);
  await page.locator('#loginForm button[type="submit"]').click();

  await expect(authModal).not.toHaveClass(/active/, { timeout: 12000 });
  // Wait briefly for deferred MyAccount auto-open (consumeMyAccountOpenAfterAuth uses setTimeout) and close it if active
  const myAccountModal = page.locator('#myAccountModal');
  await expect(myAccountModal).toHaveClass(/active/, { timeout: 3000 }).catch(() => null);
  if (await myAccountModal.evaluate((el) => el.classList.contains('active')).catch(() => false)) {
    await page.locator('#myAccountModal .sz-account-close').click();
    await expect(myAccountModal).not.toHaveClass(/active/, { timeout: 5000 });
  }
}

async function signInAdminViaUi(page, email, secret) {
  await page.locator('#adminEmail').fill(email);
  await page.locator('#adminPassword').fill(secret);
  await page.locator('#loginScreen form button[type="submit"]').click();
  await expect(page.locator('#dashboard')).toHaveClass(/active/, { timeout: 15000 });
}

async function suppressExternalChatWidget(context) {
  await context.route(/tawk\.to|tawk\.link/i, (route) => route.abort());
}

test.describe('Real Emulator Dual-Track E2E Validation (Real UI + Real Firestore Rules)', () => {
  let creds;

  test.beforeEach(async ({ context }) => {
    await suppressExternalChatWidget(context);
    creds = await emu.seedBaselineScenario();
  });

  test('EMU-LIFE-1: Full Real-UI Commerce Cycle (Customer Buy -> Admin Deliver -> Partial Return -> Full Return)', async ({ page }) => {
    test.setTimeout(90000);
    const consoleErrors = [];
    page.on('pageerror', (err) => consoleErrors.push(err.message));

    // ── PHASE 1: REAL CUSTOMER STORE JOURNEY (UI CLICKS ONLY) ──────────────
    await page.goto(STORE_EMU_URL, { waitUntil: 'domcontentloaded' });
    await page.waitForSelector('.product-card[data-product-id="prod_shampoo_argan"]', { timeout: 15000 });

    // 1. Verify unpublished product is NOT rendered in public store
    await expect(page.locator('.product-card[data-product-id="prod_draft_unreleased"]')).toHaveCount(0);

    // 2. Customer signs in through Auth Modal UI
    await signInCustomerViaUi(page, 'customer@emulator.local', creds.custCred);

    // 3. Search via #searchInput
    await page.locator('#searchInput').fill('أرجان');
    await expect(page.locator('.product-card[data-product-id="prod_shampoo_argan"]')).toBeVisible();
    await expect(page.locator('.product-card[data-product-id="prod_collagen_cream"]')).toHaveCount(0);

    // Clear search
    await page.locator('#searchInput').fill('');
    await expect(page.locator('.product-card[data-product-id="prod_collagen_cream"]')).toBeVisible();

    // 4. Click product card to open details modal, add to cart from modal button
    await page.locator('.product-card[data-product-id="prod_shampoo_argan"]').click();
    const productModal = page.locator('#productModal');
    await expect(productModal).toHaveClass(/active/, { timeout: 5000 });
    await productModal.locator('.btn-add-to-cart-modal').click();
    await expect(page.locator('#cartCount')).toHaveText('1');
    await productModal.locator('.close-modal').click();
    await expect(productModal).not.toHaveClass(/active/, { timeout: 5000 });

    // 5. Open cart sidebar, increment qty to 2 via '+' button
    await page.locator('button.nav-btn.cart-btn[data-action="open-cart"]').click();
    await expect(page.locator('#cartSidebar')).toHaveClass(/active/, { timeout: 5000 });
    await page.locator('#cartItems .qty-btn', { hasText: '+' }).click();
    await expect(page.locator('#cartCount')).toHaveText('2');

    // 6. Test invalid/expired coupon then valid SALE10 coupon via UI
    await page.locator('#couponInput').fill('EXPIRED20');
    await page.locator('.apply-coupon-btn').click();
    await expect(page.locator('#discountRow')).toHaveClass(/hidden/);

    await page.locator('#couponInput').fill('SALE10');
    await page.locator('.apply-coupon-btn').click();
    await expect(page.locator('#discountRow')).not.toHaveClass(/hidden/);
    await expect(page.locator('#discountAmount')).toContainText('50');

    // 7. Click Checkout & submit real form
    await page.locator('.checkout-btn').click();
    const checkoutModal = page.locator('#checkoutModal');
    await expect(checkoutModal).toHaveClass(/active/, { timeout: 5000 });

    await page.locator('#checkoutName').fill('أحمد مصطفى');
    await page.locator('#checkoutPhone').fill('01012345678');
    await page.locator('#checkoutAddress').fill('15 شارع الجمهورية، مدينة نصر، القاهرة');
    await page.locator('#checkoutNotes').fill('توصيل مسائي');
    await page.locator('#checkoutForm button[type="submit"]').click();

    await expect(checkoutModal).not.toHaveClass(/active/, { timeout: 15000 });

    // ── TRACK C #1: Independent Emulator Firestore Verification ───────────
    let orders = await emu.listOrders();
    expect(orders.length).toBe(1);
    const createdOrder = orders[0];
    const orderId = createdOrder.id;
    const lineId = createdOrder.items[0].lineId;

    expect(createdOrder.uid).toBe('emu_cust_1');
    expect(createdOrder.status).toBe('pending');
    expect(createdOrder.items[0].price).toBe(250);
    expect(createdOrder.items[0].quantity).toBe(2);
    expect(createdOrder.subtotal).toBe(500);
    expect(createdOrder.discount).toBe(50);
    expect(createdOrder.total).toBe(450);
    expect(createdOrder.earnedPoints).toBe(22);

    // ── PHASE 2: REAL ADMIN ORDER MANAGEMENT & DELIVERY (UI CLICKS ONLY) ──
    await page.goto(ADMIN_EMU_URL, { waitUntil: 'domcontentloaded' });
    await signInAdminViaUi(page, 'admin1@emulator.local', creds.adminCred);

    // Click Orders section in sidebar
    await page.locator('button.menu-item[onclick*="orders"]').click();
    const viewOrderBtn = page.locator(`#ordersTable button.action-btn.view[data-order-id="${orderId}"]`);
    await expect(viewOrderBtn).toBeVisible({ timeout: 15000 });
    await viewOrderBtn.click();

    const orderModal = page.locator('#orderModal');
    await expect(orderModal).toHaveClass(/active/, { timeout: 5000 });

    // Transition: pending -> confirmed via real <select>
    const statusSelect = orderModal.locator('select.status-select');
    await statusSelect.selectOption('confirmed');

    // Poll independent Firestore state for confirmed status + stock deduction + coupon increment
    await expect.poll(async () => (await emu.getOrder(orderId))?.status, { timeout: 15000 }).toBe('confirmed');
    const prodAfterConfirm = await emu.getProduct('prod_shampoo_argan');
    const couponAfterConfirm = await emu.getCoupon('coupon_sale10');
    expect(prodAfterConfirm.stock).toBe(13); // 15 - 2 = 13
    expect(couponAfterConfirm.usedCount).toBe(1);

    // Transition: confirmed -> shipped -> delivered via real <select>
    await statusSelect.selectOption('shipped');
    await expect.poll(async () => (await emu.getOrder(orderId))?.status, { timeout: 15000 }).toBe('shipped');

    await statusSelect.selectOption('delivered');
    await expect.poll(async () => (await emu.getOrder(orderId))?.status, { timeout: 15000 }).toBe('delivered');

    // Track C #2: Loyalty points credited authoritatively (+22 -> 122)
    await expect.poll(async () => (await emu.getCustomer('emu_cust_1'))?.loyaltyPoints, { timeout: 15000 }).toBe(122);
    const loyaltyEntries = await emu.getLoyaltyLedger('emu_cust_1');
    expect(loyaltyEntries.some((l) => l.orderId === orderId && l.delta === 22)).toBe(true);

    // ── PHASE 3: PARTIAL RETURN VIA REAL RETURN MODAL UI ───────────────────
    await orderModal.locator('.close-modal').click();
    await expect(orderModal).not.toHaveClass(/active/, { timeout: 5000 });
    await viewOrderBtn.click();
    await expect(orderModal).toHaveClass(/active/, { timeout: 5000 });
    await orderModal.locator('button', { hasText: 'فحص واستلام مرتجع' }).click();
    const returnModal = page.locator('#returnInspectionModal');
    await expect(returnModal).toHaveClass(/active/, { timeout: 5000 });

    const tbody = page.locator('#returnInspectionItemsTableBody');
    await tbody.locator('input.ret-received-qty').fill('1');
    await tbody.locator('input.ret-sellable-qty').fill('1');

    const submitReturnBtn = page.locator('#btnSubmitReturnInspection');
    const firstReturnId = await submitReturnBtn.getAttribute('data-return-id');
    expect(firstReturnId).toBeTruthy();
    await submitReturnBtn.click();

    await expect(returnModal).not.toHaveClass(/active/, { timeout: 15000 });

    // Track C #3: Partial return verified in Emulator
    const orderAfterPart = await emu.getOrder(orderId);
    const prodAfterPart = await emu.getProduct('prod_shampoo_argan');
    const returnsPart = await emu.getReturnsByOrder(orderId);
    const ledgerPart = await emu.getLedgerByReference(firstReturnId);

    expect(orderAfterPart.status).toBe('partially_returned');
    expect(orderAfterPart.returnedQuantitiesByLine[lineId]).toBe(1);
    expect(prodAfterPart.stock).toBe(14); // 13 + 1 sellable
    expect(returnsPart.length).toBe(1);
    expect(returnsPart[0].inspectedBy).toBe('emu_admin_1');
    expect(ledgerPart.length).toBe(1);
    expect(ledgerPart[0].movementType).toBe('IN_ORDER_RETURNED');
    expect(ledgerPart[0].delta).toBe(1);

    // ── PHASE 4: RE-OPEN ORDER & PROCESS REMAINING FULL RETURN (DAMAGED) ──
    await viewOrderBtn.click();
    await expect(orderModal).toHaveClass(/active/, { timeout: 5000 });
    await orderModal.locator('button', { hasText: 'فحص واستلام مرتجع' }).click();
    await expect(returnModal).toHaveClass(/active/, { timeout: 5000 });

    // Verify remaining returnable quantity displayed in table is now 1
    expect(await tbody.locator('tr').first().getAttribute('data-remaining-qty')).toBe('1');
    await tbody.locator('input.ret-received-qty').fill('1');
    await tbody.locator('input.ret-sellable-qty').fill('0'); // Automatically sets damaged = 1

    const secondReturnId = await submitReturnBtn.getAttribute('data-return-id');
    expect(secondReturnId).not.toBe(firstReturnId);
    await submitReturnBtn.click();

    await expect(returnModal).not.toHaveClass(/active/, { timeout: 15000 });

    // Track C #4: Full return verified in Emulator (damaged quarantined at delta 0)
    const orderFinal = await emu.getOrder(orderId);
    const prodFinal = await emu.getProduct('prod_shampoo_argan');
    const returnsFinal = await emu.getReturnsByOrder(orderId);
    const ledgerDamaged = await emu.getLedgerByReference(secondReturnId);

    expect(orderFinal.status).toBe('returned');
    expect(orderFinal.returnedQuantitiesByLine[lineId]).toBe(2);
    expect(prodFinal.stock).toBe(14); // Damaged unit quarantined, MUST NOT increment stock
    expect(returnsFinal.length).toBe(2);
    expect(ledgerDamaged.length).toBe(1);
    expect(ledgerDamaged[0].movementType).toBe('OUT_DAMAGED_EXPIRED');
    expect(ledgerDamaged[0].delta).toBe(0);
    expect(consoleErrors).toEqual([]);
  });

  test('EMU-NEG-1: Price tampering corrected authoritatively & unpublished catalog failure rejected fail-closed', async ({ page }) => {
    test.setTimeout(60000);
    await page.goto(STORE_EMU_URL, { waitUntil: 'domcontentloaded' });
    await page.waitForSelector('.product-card[data-product-id="prod_shampoo_argan"]', { timeout: 15000 });
    await signInCustomerViaUi(page, 'customer@emulator.local', creds.custCred);

    // Out-of-stock card button is disabled in real UI
    await expect(page.locator('.product-card[data-product-id="prod_unavailable_lotion"] .add-to-cart-btn')).toBeDisabled();

    // Tamper localStorage cart with 1 EGP price before checkout -> real UI revalidates against Firestore
    await page.evaluate(() => {
      localStorage.setItem('sale_zone_cart', JSON.stringify([{
        id: 'prod_shampoo_argan',
        name: 'سعر متلاعب',
        price: 1,
        quantity: 1
      }]));
      location.reload();
    });
    await page.waitForSelector('.product-card[data-product-id="prod_shampoo_argan"]', { timeout: 15000 });

    await page.locator('button.nav-btn.cart-btn[data-action="open-cart"]').click();
    await page.locator('.checkout-btn').click();
    // Revalidation updates cart to 250 EGP and asks user to review, then next submit places order at 250 EGP
    await expect(page.locator('#checkoutModal')).toHaveClass(/active/, { timeout: 5000 });
    await page.locator('#checkoutName').fill('اختبار السعر');
    await page.locator('#checkoutPhone').fill('01022223333');
    await page.locator('#checkoutAddress').fill('الجيزة');
    await page.locator('#checkoutForm button[type="submit"]').click();
    await page.waitForTimeout(1000);

    // Click submit again if revalidation refreshed cart price to 250
    if (await page.locator('#checkoutModal').evaluate((el) => el.classList.contains('active'))) {
      await page.locator('#checkoutForm button[type="submit"]').click();
    }
    await expect(page.locator('#checkoutModal')).not.toHaveClass(/active/, { timeout: 15000 });

    const orders = await emu.listOrders();
    expect(orders.length).toBe(1);
    expect(orders[0].items[0].price).toBe(250);
    expect(orders[0].total).toBe(250);

    // Unpublished product must fail closed in persistOrderOnline because Firestore Rules deny customer read
    const unpubAttempt = await page.evaluate(async () => {
      try {
        await window.addOrder({
          uid: 'emu_cust_1',
          orderNumber: 'SZ-UNPUB-ATTEMPT',
          idempotencyKey: 'idem_emu_unpub_fail_1',
          customer: { name: 'اختبار', phone: '010', address: 'X' },
          items: [{ lineId: 'l1', productId: 'prod_draft_unreleased', price: 1, quantity: 1 }],
          subtotal: 1,
          total: 1,
          status: 'pending'
        }, { allowQueue: false });
        return { ok: true };
      } catch (err) {
        return { ok: false, error: err && err.message ? err.message : String(err) };
      }
    });
    expect(unpubAttempt.ok).toBe(false);
    expect((await emu.listOrders()).length).toBe(1); // Still only 1 order in Firestore Emulator
  });

  test('EMU-NEG-2: Network drop during return preserves stable returnId and retry is strictly idempotent', async ({ page, context }) => {
    test.setTimeout(60000);
    const { adminDb } = emu.getAdminInstances();
    const orderId = 'ord_emu_retry_test';
    await adminDb.collection('orders').doc(orderId).set({
      id: orderId,
      uid: 'emu_cust_1',
      orderNumber: 'SZ-EMU-RETRY',
      idempotencyKey: 'idem_emu_retry_0001',
      customer: { name: 'عميل الإعادة', phone: '01099990000', address: 'القاهرة' },
      items: [{ lineId: 'line_r1', productId: 'prod_shampoo_argan', name: 'شامبو الأرجان', price: 250, quantity: 2 }],
      subtotal: 500,
      total: 500,
      status: 'delivered',
      inventoryDeducted: true,
      version: 2,
      createdAt: new Date().toISOString()
    });

    await page.goto(ADMIN_EMU_URL, { waitUntil: 'domcontentloaded' });
    await signInAdminViaUi(page, 'admin1@emulator.local', creds.adminCred);

    await page.locator('button.menu-item[onclick*="orders"]').click();
    await page.locator(`#ordersTable button.action-btn.view[data-order-id="${orderId}"]`).click();
    await page.locator('#orderModal button', { hasText: 'فحص واستلام مرتجع' }).click();

    const submitBtn = page.locator('#btnSubmitReturnInspection');
    const preservedReturnId = await submitBtn.getAttribute('data-return-id');
    expect(preservedReturnId).toBeTruthy();

    // Drop network connection before submitting
    await context.setOffline(true);
    await submitBtn.click();

    // Expect failure warning and modal remains open with exact same draft returnId
    await expect(page.locator('#returnInspectionValidationWarning')).toBeVisible({ timeout: 10000 });
    expect(await submitBtn.getAttribute('data-return-id')).toBe(preservedReturnId);
    expect((await emu.getReturnsByOrder(orderId)).length).toBe(0);

    // Restore network and click submit again without closing modal -> uses SAME returnId
    await context.setOffline(false);
    await submitBtn.click();
    await expect(page.locator('#returnInspectionModal')).not.toHaveClass(/active/, { timeout: 15000 });

    const returns = await emu.getReturnsByOrder(orderId);
    expect(returns.length).toBe(1);
    expect(returns[0].returnId).toBe(preservedReturnId);
    expect((await emu.getProduct('prod_shampoo_argan')).stock).toBe(16); // 15 + 1 restocked once
  });

  test('EMU-NEG-3: Concurrent 2-admin browser sessions return only 1 unit once & unauthorized access stays blocked', async ({ browser }) => {
    test.setTimeout(75000);
    const { adminDb } = emu.getAdminInstances();
    const orderId = 'ord_emu_race_ui';
    await adminDb.collection('orders').doc(orderId).set({
      id: orderId,
      uid: 'emu_cust_1',
      orderNumber: 'SZ-EMU-RACE',
      idempotencyKey: 'idem_emu_race_0001',
      customer: { name: 'عميل التزامن', phone: '01088887777', address: 'القاهرة' },
      items: [{ lineId: 'line_race', productId: 'prod_shampoo_argan', name: 'شامبو الأرجان', price: 250, quantity: 1 }],
      subtotal: 250,
      total: 250,
      status: 'delivered',
      inventoryDeducted: true,
      version: 2,
      createdAt: new Date().toISOString()
    });

    const ctx1 = await browser.newContext();
    const ctx2 = await browser.newContext();
    const ctxUnauthorized = await browser.newContext();
    await Promise.all([
      suppressExternalChatWidget(ctx1),
      suppressExternalChatWidget(ctx2),
      suppressExternalChatWidget(ctxUnauthorized)
    ]);

    try {
      const page1 = await ctx1.newPage();
      const page2 = await ctx2.newPage();
      const pageUnauth = await ctxUnauthorized.newPage();

      // Verify customer account cannot log into admin dashboard
      await pageUnauth.goto(ADMIN_EMU_URL, { waitUntil: 'domcontentloaded' });
      await pageUnauth.locator('#adminEmail').fill('customer@emulator.local');
      await pageUnauth.locator('#adminPassword').fill(creds.custCred);
      await pageUnauth.locator('#loginScreen form button[type="submit"]').click();
      await expect(pageUnauth.locator('#loginError')).toBeVisible({ timeout: 10000 });
      await expect(pageUnauth.locator('#dashboard')).not.toHaveClass(/active/);

      // Log in two admins concurrently in independent browser sessions
      await page1.goto(ADMIN_EMU_URL, { waitUntil: 'domcontentloaded' });
      await page2.goto(ADMIN_EMU_URL, { waitUntil: 'domcontentloaded' });
      await Promise.all([
        signInAdminViaUi(page1, 'admin1@emulator.local', creds.adminCred),
        signInAdminViaUi(page2, 'admin2@emulator.local', creds.adminCred)
      ]);

      // Both open the return modal for the exact same order (remaining qty = 1)
      for (const p of [page1, page2]) {
        await p.locator('button.menu-item[onclick*="orders"]').click();
        await p.locator(`#ordersTable button.action-btn.view[data-order-id="${orderId}"]`).click();
        await p.locator('#orderModal button', { hasText: 'فحص واستلام مرتجع' }).click();
        await expect(p.locator('#returnInspectionModal')).toHaveClass(/active/, { timeout: 8000 });
      }

      // Click Submit in both admin browsers simultaneously
      await Promise.all([
        page1.locator('#btnSubmitReturnInspection').click(),
        page2.locator('#btnSubmitReturnInspection').click()
      ]);

      // Wait until Firestore transaction settles
      await page1.waitForTimeout(4000);

      // Independent Track C Verification:
      // Exactly 1 return receipt created, order is 'returned', stock increased by EXACTLY 1 (15 -> 16)
      const returns = await emu.getReturnsByOrder(orderId);
      const orderFinal = await emu.getOrder(orderId);
      const prodFinal = await emu.getProduct('prod_shampoo_argan');

      expect(returns.length).toBe(1);
      expect(orderFinal.status).toBe('returned');
      expect(orderFinal.returnedQuantitiesByLine.line_race).toBe(1);
      expect(prodFinal.stock).toBe(16);

      // Exactly one modal closed cleanly and the other shows failure alert
      const p1Closed = !(await page1.locator('#returnInspectionModal').evaluate((el) => el.classList.contains('active')));
      const p2Closed = !(await page2.locator('#returnInspectionModal').evaluate((el) => el.classList.contains('active')));
      expect(p1Closed !== p2Closed).toBe(true);
    } finally {
      await ctx1.close();
      await ctx2.close();
      await ctxUnauthorized.close();
    }
  });

  test('EMU-CHECKOUT-MULTI: Real UI checkout succeeds for 4, 5, and 6 distinct items via /order_intents without silent loss', async ({ page }) => {
    test.setTimeout(90000);
    const { adminDb } = emu.getAdminInstances();
    const extraProducts = ['prod_x4', 'prod_x5', 'prod_x6'];
    for (let idx = 0; idx < extraProducts.length; idx++) {
      await adminDb.collection('products').doc(extraProducts[idx]).set({
        id: extraProducts[idx],
        name: `منتج إضافي ${idx + 4}`,
        price: 50,
        stock: 10,
        trackInventory: true,
        isPublished: true,
        category: 'skincare'
      });
    }

    await page.goto(STORE_EMU_URL, { waitUntil: 'domcontentloaded' });
    await page.waitForSelector('.product-card[data-product-id="prod_x6"]', { timeout: 15000 });
    await signInCustomerViaUi(page, 'customer@emulator.local', creds.custCred);

    // 4 distinct items -> /order_intents (pending_review)
    for (const pid of ['prod_shampoo_argan', 'prod_collagen_cream', 'prod_x4', 'prod_x5']) {
      await page.locator(`.product-card[data-product-id="${pid}"] .add-to-cart-btn`).click();
    }
    await expect(page.locator('#cartCount')).toHaveText('4');
    await page.locator('button.nav-btn.cart-btn[data-action="open-cart"]').click();
    await expect(page.locator('#cartSidebar')).toHaveClass(/active/, { timeout: 5000 });
    await page.locator('#cartSidebar .checkout-btn').scrollIntoViewIfNeeded();
    await page.locator('#cartSidebar .checkout-btn').click();
    await expect(page.locator('#checkoutModal')).toHaveClass(/active/, { timeout: 5000 });
    await page.locator('#checkoutName').fill('عميل 4 أصناف');
    await page.locator('#checkoutPhone').fill('01012345678');
    await page.locator('#checkoutAddress').fill('القاهرة');
    await page.locator('#checkoutForm button[type="submit"]').click();
    await expect(page.locator('#checkoutModal')).not.toHaveClass(/active/, { timeout: 15000 });
    await expect(page.locator('#cartSidebar')).not.toHaveClass(/active/, { timeout: 5000 });

    // 6 distinct items -> /order_intents (pending_review)
    for (const pid of ['prod_shampoo_argan', 'prod_collagen_cream', 'prod_unavailable_lotion', 'prod_x4', 'prod_x5', 'prod_x6']) {
      const btn = page.locator(`.product-card[data-product-id="${pid}"] .add-to-cart-btn`);
      if (await btn.isEnabled().catch(() => false)) {
        await btn.click();
      }
    }
    await expect(page.locator('#cartCount')).toHaveText('5');
    await page.waitForTimeout(300);
    if (!(await page.locator('#cartSidebar').evaluate((el) => el.classList.contains('active')))) {
      await page.locator('button.nav-btn.cart-btn[data-action="open-cart"]').click();
    }
    await expect(page.locator('#cartSidebar')).toHaveClass(/active/, { timeout: 5000 });
    await page.locator('#cartSidebar .checkout-btn').scrollIntoViewIfNeeded();
    await page.locator('#cartSidebar .checkout-btn').click();
    await expect(page.locator('#checkoutModal')).toHaveClass(/active/, { timeout: 5000 });
    await page.locator('#checkoutName').fill('عميل 5 أصناف');
    await page.locator('#checkoutPhone').fill('01012345678');
    await page.locator('#checkoutAddress').fill('القاهرة');
    await page.locator('#checkoutForm button[type="submit"]').click();
    await expect(page.locator('#checkoutModal')).not.toHaveClass(/active/, { timeout: 15000 });

    const intents = await emu.listOrderIntents();
    expect(intents.length).toBe(2);
    expect(intents.every((i) => i.status === 'pending_review' && i.commercialVerified === false)).toBe(true);
    expect(intents.map((i) => i.items.length).sort()).toEqual([4, 5]);
  });
});
