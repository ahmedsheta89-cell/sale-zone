const { test, expect } = require('./fixtures/test-base');

test.describe('Admin Journey E2E (Dual-Track Validation: Order Management & Itemized Returns)', () => {
  const testOrderId = 'ord_test_e2e_fulfilled';

  test.beforeEach(async ({ page }) => {
    // 1. Seed order in Firestore & window state before page load
    await page.addInitScript(({ orderId }) => {
      const orderDoc = {
        id: orderId,
        orderNumber: 'SZ-2026-9901',
        createdAt: new Date().toISOString(),
        status: 'delivered',
        previousStatus: 'delivered',
        subtotal: 500,
        total: 500,
        customer: {
          name: 'سارة خالد',
          phone: '01123456789',
          address: 'شارع الهرم، الجيزة'
        },
        items: [
          {
            lineId: 'line_0_shampoo',
            productId: 'prod_shampoo_argan',
            name: 'شامبو الأرجان المغربي الأصلي',
            price: 250,
            quantity: 2,
            lineTotal: 500
          }
        ],
        returnedQuantitiesByLine: {}
      };

      if (window.__TEST_BRIDGE__) {
        window.__TEST_BRIDGE__.setRole('admin');
        window.__TEST_BRIDGE__.setDocument('orders', orderId, orderDoc);
      }
      window.orders = [orderDoc];
    }, { orderId: testOrderId });

    // 2. Navigate to admin dashboard
    await page.goto('/%D8%A7%D8%AF%D9%85%D9%86_2.HTML', { waitUntil: 'domcontentloaded' });
    await page.waitForSelector('#dashboard.active', { timeout: 15000 });

    // Ensure window.orders has the order after admin scripts initialize
    await page.evaluate(({ orderId }) => {
      if (!Array.isArray(window.orders)) window.orders = [];
      if (!window.orders.some(o => String(o.id) === String(orderId))) {
        const doc = window.__TEST_BRIDGE__.getDocument('orders', orderId);
        if (doc) window.orders.push(doc);
      }
    }, { orderId: testOrderId });
  });

  test('AJ-1: Admin dashboard loads with authenticated session', async ({ page }) => {
    const isDashboardVisible = await page.evaluate(() => {
      const login = document.getElementById('loginScreen');
      const dash = document.getElementById('dashboard');
      return (!login || login.style.display === 'none') && (dash && dash.classList.contains('active'));
    });
    expect(isDashboardVisible).toBe(true);
  });

  test('AJ-2: Admin navigates to Orders and inspects order modal', async ({ page }) => {
    // Open order details modal
    await page.evaluate((orderId) => {
      if (typeof window.viewOrder === 'function') {
        window.viewOrder(orderId);
      }
    }, testOrderId);

    const orderModal = page.locator('#orderModal');
    await expect(orderModal).toHaveClass(/active/, { timeout: 5000 });

    const modalBody = await page.locator('#orderModalBody').textContent();
    expect(modalBody).toContain('SZ-2026-9901');
    expect(modalBody).toContain('سارة خالد');
    expect(modalBody).toContain('شامبو الأرجان');
  });

  test('AJ-3: Itemized Return Inspection modal opens and enforces mathematical validation', async ({ page }) => {
    // Open itemized return inspection modal for test order
    await page.evaluate((orderId) => {
      if (typeof window.openReturnInspectionModal === 'function') {
        window.openReturnInspectionModal(orderId);
      }
    }, testOrderId);

    const returnModal = page.locator('#returnInspectionModal');
    await expect(returnModal).toHaveClass(/active/, { timeout: 5000 });

    // Verify item row is rendered
    const tbody = page.locator('#returnInspectionItemsTableBody');
    const rows = tbody.locator('tr');
    await expect(rows).toHaveCount(1);

    // Guard A: Test submitting with 0 received quantity
    await page.evaluate(() => {
      const row = document.querySelector('#returnInspectionItemsTableBody tr');
      row.querySelector('.ret-received-qty').value = '0';
      row.querySelector('.ret-sellable-qty').value = '0';
      row.querySelector('.ret-damaged-qty').value = '0';
    });

    const submitBtn = page.locator('#btnSubmitReturnInspection');
    await submitBtn.click();

    const warning = page.locator('#returnInspectionValidationWarning');
    await expect(warning).toBeVisible();
    let warningText = await warning.textContent();
    expect(warningText).toContain('كمية مستلمة');

    // Guard B: Test submitting violating strict equation (received 2, but sellable 1 + damaged 0 = 1 !== 2)
    await page.evaluate(() => {
      const row = document.querySelector('#returnInspectionItemsTableBody tr');
      row.querySelector('.ret-received-qty').value = '2';
      row.querySelector('.ret-sellable-qty').value = '1';
      row.querySelector('.ret-damaged-qty').value = '0';
    });

    await submitBtn.click();
    await expect(warning).toBeVisible();
    warningText = await warning.textContent();
    expect(warningText).toContain('يجب أن يساوي');
  });

  test('AJ-4: Valid return inspection submission, status transition, and Track C Data Verification', async ({ page }) => {
    // Open return modal
    await page.evaluate((orderId) => {
      if (typeof window.openReturnInspectionModal === 'function') {
        window.openReturnInspectionModal(orderId);
      }
    }, testOrderId);

    const returnModal = page.locator('#returnInspectionModal');
    await expect(returnModal).toHaveClass(/active/, { timeout: 5000 });

    const tbody = page.locator('#returnInspectionItemsTableBody');
    const receivedInput = tbody.locator('input.ret-received-qty');
    const sellableInput = tbody.locator('input.ret-sellable-qty');
    const damagedInput = tbody.locator('input.ret-damaged-qty');

    // Enter valid partial return: received 1, sellable 1, damaged 0
    await receivedInput.fill('1');
    await sellableInput.fill('1');
    await damagedInput.fill('0');

    // Submit return inspection
    const submitBtn = page.locator('#btnSubmitReturnInspection');
    await submitBtn.click();

    // Wait for processing and modal to close
    await expect(returnModal).not.toHaveClass(/active/, { timeout: 5000 });

    // ── TRACK C: Post-Action Data Verification ──
    const { returns, order, movements } = await page.evaluate((orderId) => {
      const returnsList = window.__TEST_BRIDGE__.getCollection('returns');
      const orderDoc = window.__TEST_BRIDGE__.getDocument('orders', orderId);
      const ledger = window.__TEST_BRIDGE__.getCollection('inventory_ledger');
      return { returns: returnsList, order: orderDoc, movements: ledger };
    }, testOrderId);

    // 1. Verify return receipt in /returns
    expect(returns.length).toBeGreaterThanOrEqual(1);
    const receipt = returns[returns.length - 1];
    expect(receipt.orderId).toBe(testOrderId);
    expect(receipt.status).toBe('completed');
    expect(receipt.inspectedBy).toBe('admin_test_1');
    expect(receipt.items).toBeDefined();
    expect(receipt.items.length).toBe(1);
    expect(receipt.items[0].receivedQty).toBe(1);
    expect(receipt.items[0].sellableQty).toBe(1);
    expect(receipt.items[0].damagedQty).toBe(0);

    // 2. Verify order document updated
    expect(order).not.toBeNull();
    expect(order.status).toBe('partially_returned'); // Partial return since 1 of 2 was returned
    expect(order.returnedQuantitiesByLine).toBeDefined();
    expect(order.returnedQuantitiesByLine['line_0_shampoo']).toBe(1);

    // 3. Verify inventory movement recorded
    const restockMovement = movements.find(m => m.movementType === 'IN_ORDER_RETURNED');
    expect(restockMovement).toBeDefined();
    expect(restockMovement.quantity).toBe(1);
    expect(restockMovement.referenceId).toBe(receipt.id);
  });
});
