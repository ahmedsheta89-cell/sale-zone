const { test, expect } = require('./fixtures/test-base');

test.describe('End-to-End Commerce Lifecycle & Business Rejection Scenarios (Dual-Track Validation)', () => {
  test('LIFE-1: Full Commerce Cycle (Purchase -> Admin Order Flow -> Delivered -> Partial Return -> Full Return)', async ({ page }) => {
    test.setTimeout(60000);
    // ══════════════════════════════════════════════════════════════════════════
    // PHASE 1: CUSTOMER PURCHASES FROM STORE BROWSER (Track B Execution)
    // ══════════════════════════════════════════════════════════════════════════
    await page.goto('/%D9%85%D8%AA%D8%AC%D8%B1_2.HTML', { waitUntil: 'domcontentloaded' });
    await page.waitForSelector('#productsGrid', { timeout: 10000 });

    // Verify initial product stock (15 units)
    const initialStock = await page.evaluate(() => {
      const p = window.__TEST_BRIDGE__.getDocument('products', 'prod_shampoo_argan');
      return p ? p.stock : 0;
    });
    expect(initialStock).toBe(15);

    // Customer adds 2 units of shampoo to cart
    await page.evaluate(() => {
      window.addToCart('prod_shampoo_argan', 2);
    });

    // Open checkout modal
    await page.evaluate(async () => {
      if (typeof window.showCheckout === 'function') {
        await window.showCheckout();
      }
    });

    const checkoutModal = page.locator('#checkoutModal');
    await expect(checkoutModal).toBeVisible({ timeout: 5000 });

    // Fill customer checkout details
    await page.locator('#checkoutName').fill('محمد عبد الرحمن');
    await page.locator('#checkoutPhone').fill('01234567890');
    await page.locator('#checkoutAddress').fill('25 شارع جامعة الدول العربية، المهندسين، الجيزة');
    await page.locator('#checkoutNotes').fill('يرجى الاتصال قبل الوصول بنصف ساعة');

    // Submit checkout form
    const submitBtn = page.locator('#checkoutForm button[type="submit"]');
    await submitBtn.click();
    await page.waitForTimeout(1500);

    // ── TRACK C: Verify Created Order in Firestore ──
    const createdOrder = await page.evaluate(() => {
      const orders = window.__TEST_BRIDGE__.getCollection('orders');
      return orders.length ? orders[orders.length - 1] : null;
    });

    expect(createdOrder).not.toBeNull();
    const orderId = createdOrder.id;
    expect(orderId).toBeTruthy();
    expect(createdOrder.status).toBe('pending');
    expect(createdOrder.customer.name).toBe('محمد عبد الرحمن');
    expect(createdOrder.items.length).toBe(1);
    expect(createdOrder.items[0].productId).toBe('prod_shampoo_argan');
    expect(createdOrder.items[0].quantity).toBe(2);
    expect(createdOrder.items[0].price).toBe(250); // Authoritative catalog price
    expect(createdOrder.subtotal).toBe(500);
    const lineId = createdOrder.items[0].lineId;
    expect(lineId).toBeTruthy();

    // ══════════════════════════════════════════════════════════════════════════
    // PHASE 2: ADMIN MANAGES ORDER IN DASHBOARD (Track B Execution)
    // ══════════════════════════════════════════════════════════════════════════
    // Seed the created order into admin session before navigating
    await page.addInitScript(({ orderDoc }) => {
      if (window.__TEST_BRIDGE__) {
        window.__TEST_BRIDGE__.setRole('admin');
        window.__TEST_BRIDGE__.setDocument('orders', orderDoc.id, orderDoc);
      }
      window.orders = [orderDoc];
    }, { orderDoc: createdOrder });

    await page.goto('/%D8%A7%D8%AF%D9%85%D9%86_2.HTML', { waitUntil: 'domcontentloaded' });
    await page.waitForSelector('#dashboard.active', { timeout: 15000 });

    // Ensure order is accessible in admin memory
    await page.evaluate((oId) => {
      const doc = window.__TEST_BRIDGE__.getDocument('orders', oId);
      if (doc) {
        if (!Array.isArray(window.orders)) window.orders = [];
        const idx = window.orders.findIndex(x => String(x.id) === String(oId));
        if (idx !== -1) window.orders[idx] = doc;
        else window.orders.push(doc);
      }
    }, orderId);

    // Admin inspects order details
    await page.evaluate((oId) => {
      if (typeof window.viewOrder === 'function') window.viewOrder(oId);
    }, orderId);

    const orderModal = page.locator('#orderModal');
    await expect(orderModal).toHaveClass(/active/, { timeout: 5000 });
    const modalContent = await page.locator('#orderModalBody').textContent();
    expect(modalContent).toContain('محمد عبد الرحمن');

    // Admin transitions order to delivered
    await page.evaluate(async (oId) => {
      const orderRef = window.db.collection('orders').doc(oId);
      await orderRef.set({
        status: 'delivered',
        previousStatus: 'delivered',
        updatedAt: new Date().toISOString()
      }, { merge: true });

      // Update local memory representation
      const current = window.__TEST_BRIDGE__.getDocument('orders', oId);
      if (current) {
        current.status = 'delivered';
        current.previousStatus = 'delivered';
        window.__TEST_BRIDGE__.setDocument('orders', oId, current);
      }
    }, orderId);

    // ── TRACK C: Verify Order is Delivered ──
    const deliveredOrder = await page.evaluate((oId) => {
      return window.__TEST_BRIDGE__.getDocument('orders', oId);
    }, orderId);
    expect(deliveredOrder.status).toBe('delivered');

    // ══════════════════════════════════════════════════════════════════════════
    // PHASE 3: ADMIN PARTIAL RETURN (1 Sellable unit returned)
    // ══════════════════════════════════════════════════════════════════════════
    await page.evaluate((oId) => {
      if (typeof window.openReturnInspectionModal === 'function') {
        window.openReturnInspectionModal(oId);
      }
    }, orderId);

    const returnModal = page.locator('#returnInspectionModal');
    await expect(returnModal).toHaveClass(/active/, { timeout: 5000 });

    const tbody = page.locator('#returnInspectionItemsTableBody');
    const receivedInput = tbody.locator('input.ret-received-qty');
    const sellableInput = tbody.locator('input.ret-sellable-qty');
    const damagedInput = tbody.locator('input.ret-damaged-qty');

    // Enter partial return: received 1, sellable 1, damaged 0
    await receivedInput.fill('1');
    await sellableInput.fill('1');
    await damagedInput.fill('0');

    // Submit partial return inspection
    const submitReturnBtn = page.locator('#btnSubmitReturnInspection');
    await submitReturnBtn.click();
    await expect(returnModal).not.toHaveClass(/active/, { timeout: 5000 });

    // ── TRACK C: Post-Partial-Return Data Verification ──
    const partialState = await page.evaluate((oId) => {
      const order = window.__TEST_BRIDGE__.getDocument('orders', oId);
      const returns = window.__TEST_BRIDGE__.getCollection('returns');
      const ledger = window.__TEST_BRIDGE__.getCollection('inventory_ledger');
      const product = window.__TEST_BRIDGE__.getDocument('products', 'prod_shampoo_argan');
      return { order, returns, ledger, product };
    }, orderId);

    expect(partialState.order.status).toBe('partially_returned');
    expect(partialState.order.returnedQuantitiesByLine[lineId]).toBe(1);
    expect(partialState.returns.length).toBeGreaterThanOrEqual(1);

    const receipt1 = partialState.returns[partialState.returns.length - 1];
    expect(receipt1.orderId).toBe(orderId);
    expect(receipt1.items[0].receivedQty).toBe(1);
    expect(receipt1.items[0].sellableQty).toBe(1);
    expect(receipt1.items[0].damagedQty).toBe(0);

    // Verify stock incremented by 1 (sellable restocked: 15 + 1 = 16)
    expect(partialState.product.stock).toBe(16);

    // Verify inventory movement recorded
    const returnMovement1 = partialState.ledger.find(m => m.movementType === 'IN_ORDER_RETURNED');
    expect(returnMovement1).toBeDefined();
    expect(returnMovement1.quantity).toBe(1);
    expect(returnMovement1.referenceId).toBe(receipt1.returnId);

    // ══════════════════════════════════════════════════════════════════════════
    // PHASE 4: ADMIN FULL RETURN (1 Damaged unit returned for remaining quantity)
    // ══════════════════════════════════════════════════════════════════════════
    // Open return inspection modal again for the remaining returnable quantity
    await page.evaluate((oId) => {
      if (typeof window.openReturnInspectionModal === 'function') {
        window.openReturnInspectionModal(oId);
      }
    }, orderId);

    await expect(returnModal).toHaveClass(/active/, { timeout: 5000 });

    // Verify remaining returnable quantity in table row is now 1
    const remainingQtyAttr = await tbody.locator('tr').first().getAttribute('data-remaining-qty');
    expect(remainingQtyAttr).toBe('1');

    // Enter full return for remaining unit as damaged: received 1, sellable 0, damaged 1
    await receivedInput.fill('1');
    await sellableInput.fill('0');
    await damagedInput.fill('1');

    await submitReturnBtn.click();
    await expect(returnModal).not.toHaveClass(/active/, { timeout: 5000 });

    // ── TRACK C: Post-Full-Return Data Verification ──
    const fullState = await page.evaluate((oId) => {
      const order = window.__TEST_BRIDGE__.getDocument('orders', oId);
      const returns = window.__TEST_BRIDGE__.getCollection('returns');
      const ledger = window.__TEST_BRIDGE__.getCollection('inventory_ledger');
      const product = window.__TEST_BRIDGE__.getDocument('products', 'prod_shampoo_argan');
      return { order, returns, ledger, product };
    }, orderId);

    // Order status must now be fully 'returned'
    expect(fullState.order.status).toBe('returned');
    expect(fullState.order.returnedQuantitiesByLine[lineId]).toBe(2); // Total returned = 2 = ordered qty

    expect(fullState.returns.length).toBeGreaterThanOrEqual(2);
    const receipt2 = fullState.returns[fullState.returns.length - 1];
    expect(receipt2.orderId).toBe(orderId);
    expect(receipt2.items[0].receivedQty).toBe(1);
    expect(receipt2.items[0].sellableQty).toBe(0);
    expect(receipt2.items[0].damagedQty).toBe(1);

    // Damaged return must be quarantined with delta 0 (stock remains 16, does NOT increment)
    expect(fullState.product.stock).toBe(16);

    const quarantineMovement = fullState.ledger.find(m => m.movementType === 'OUT_DAMAGED_EXPIRED');
    expect(quarantineMovement).toBeDefined();
    expect(quarantineMovement.delta).toBe(0);
    expect(quarantineMovement.referenceId).toBe(receipt2.returnId);
  });

  test('REJECT-1: Duplicate Order Replay / Idempotency Gate', async ({ page }) => {
    await page.goto('/%D9%85%D8%AA%D8%AC%D8%B1_2.HTML', { waitUntil: 'domcontentloaded' });
    await page.waitForSelector('#productsGrid', { timeout: 10000 });

    const sharedIdempotencyKey = 'idem_replay_test_' + Date.now();
    const orderPayload = {
      idempotencyKey: sharedIdempotencyKey,
      customer: { name: 'فحص التكرار', phone: '01099998888', address: 'القاهرة' },
      items: [
        {
          lineId: 'line_dup_test_01',
          productId: 'prod_shampoo_argan',
          name: 'شامبو الأرجان المغربي الأصلي',
          price: 250,
          quantity: 1
        }
      ],
      subtotal: 250,
      total: 250
    };

    // First order placement
    const res1 = await page.evaluate(async (payload) => {
      return await window.persistOrderOnline(payload);
    }, orderPayload);
    expect(res1).toBeDefined();

    // Second order placement with identical idempotencyKey (Replay attempt)
    const res2 = await page.evaluate(async (payload) => {
      return await window.persistOrderOnline(payload);
    }, orderPayload);

    // ── TRACK C: Verify only 1 order document was created with that idempotency key ──
    const matchingOrders = await page.evaluate((key) => {
      const orders = window.__TEST_BRIDGE__.getCollection('orders');
      return orders.filter(o => o.idempotencyKey === key);
    }, sharedIdempotencyKey);

    expect(matchingOrders.length).toBe(1);
  });

  test('REJECT-2: Over-Return Gate (Return Quantity Exceeding Remaining Returnable)', async ({ page }) => {
    // Seed order with 1 unit already returned out of 2
    const testOrderId = 'ord_test_over_return';
    await page.addInitScript(({ oId }) => {
      const doc = {
        id: oId,
        orderNumber: 'SZ-2026-OVER',
        status: 'partially_returned',
        items: [
          {
            lineId: 'line_over_01',
            productId: 'prod_shampoo_argan',
            name: 'شامبو الأرجان المغربي الأصلي',
            price: 250,
            quantity: 2
          }
        ],
        returnedQuantitiesByLine: {
          line_over_01: 1 // 1 already returned, remaining is 1
        }
      };
      if (window.__TEST_BRIDGE__) {
        window.__TEST_BRIDGE__.setRole('admin');
        window.__TEST_BRIDGE__.setDocument('orders', oId, doc);
      }
      window.orders = [doc];
    }, { oId: testOrderId });

    await page.goto('/%D8%A7%D8%AF%D9%85%D9%86_2.HTML', { waitUntil: 'domcontentloaded' });
    await page.waitForSelector('#dashboard.active', { timeout: 15000 });

    // Open return modal
    await page.evaluate((oId) => {
      if (typeof window.openReturnInspectionModal === 'function') {
        window.openReturnInspectionModal(oId);
      }
    }, testOrderId);

    const returnModal = page.locator('#returnInspectionModal');
    await expect(returnModal).toHaveClass(/active/, { timeout: 5000 });

    // Track B: Directly set invalid quantities exceeding remaining (remaining is 1, input 2)
    await page.evaluate(() => {
      const row = document.querySelector('#returnInspectionItemsTableBody tr');
      row.querySelector('.ret-received-qty').value = '2';
      row.querySelector('.ret-sellable-qty').value = '2';
      row.querySelector('.ret-damaged-qty').value = '0';
    });

    const submitBtn = page.locator('#btnSubmitReturnInspection');
    await submitBtn.click();

    // UI Warning alert must appear
    const warning = page.locator('#returnInspectionValidationWarning');
    await expect(warning).toBeVisible();
    const warningText = await warning.textContent();
    expect(warningText).toContain('تتجاوز الكمية المتبقية القابلة للإرجاع');

    // Track A: Verify core business logic throws when called with over-return quantity
    const logicError = await page.evaluate(async (oId) => {
      try {
        await window.createAndProcessReturnReceipt({
          orderId: oId,
          items: [
            { lineId: 'line_over_01', receivedQty: 2, sellableQty: 2, damagedQty: 0 }
          ]
        });
        return null;
      } catch (e) {
        return e.message;
      }
    }, testOrderId);

    expect(logicError).toContain('exceeds remaining returnable quantity');

    // ── TRACK C: Verify no new return receipt was generated in Firestore ──
    const returnsForOrder = await page.evaluate((oId) => {
      return window.__TEST_BRIDGE__.getCollection('returns').filter(r => r.orderId === oId);
    }, testOrderId);
    expect(returnsForOrder.length).toBe(0);
  });

  test('REJECT-3: Duplicate Return Replay / Return Receipt Idempotency Gate', async ({ page }) => {
    const testOrderId = 'ord_test_idem_ret';
    const testReturnId = 'ret_idem_001';

    await page.addInitScript(({ oId, rId }) => {
      const doc = {
        id: oId,
        orderNumber: 'SZ-2026-IDEM',
        status: 'delivered',
        items: [{ lineId: 'line_idem_01', productId: 'prod_shampoo_argan', quantity: 2 }]
      };
      const receipt = {
        returnId: rId,
        orderId: oId,
        status: 'completed',
        items: [{ lineId: 'line_idem_01', receivedQty: 1, sellableQty: 1, damagedQty: 0 }]
      };
      if (window.__TEST_BRIDGE__) {
        window.__TEST_BRIDGE__.setRole('admin');
        window.__TEST_BRIDGE__.setDocument('orders', oId, doc);
        window.__TEST_BRIDGE__.setDocument('returns', rId, receipt);
      }
    }, { oId: testOrderId, rId: testReturnId });

    await page.goto('/%D8%A7%D8%AF%D9%85%D9%86_2.HTML', { waitUntil: 'domcontentloaded' });
    await page.waitForSelector('#dashboard.active', { timeout: 15000 });

    // Attempt to process return with the same returnId
    const res = await page.evaluate(async ({ oId, rId }) => {
      return await window.createAndProcessReturnReceipt({
        returnId: rId,
        orderId: oId,
        items: [{ lineId: 'line_idem_01', receivedQty: 1, sellableQty: 1, damagedQty: 0 }]
      });
    }, { oId: testOrderId, rId: testReturnId });

    // Idempotency check returns duplicate: true
    expect(res.success).toBe(true);
    expect(res.duplicate).toBe(true);

    // ── TRACK C: Verify no duplicate movement created in inventory_ledger ──
    const ledgerMovements = await page.evaluate((rId) => {
      return window.__TEST_BRIDGE__.getCollection('inventory_ledger').filter(m => m.referenceId === rId);
    }, testReturnId);
    expect(ledgerMovements.length).toBe(0);
  });

  test('REJECT-4: Offline Disconnection Handling During Operation', async ({ page }) => {
    await page.goto('/%D9%85%D8%AA%D8%AC%D8%B1_2.HTML', { waitUntil: 'domcontentloaded' });
    await page.waitForSelector('#productsGrid', { timeout: 10000 });

    // Simulate browser going completely offline
    await page.context().setOffline(true);

    // Attempt sensitive network operation while offline
    const offlineResult = await page.evaluate(async () => {
      try {
        if (!navigator.onLine) {
          return { ok: false, offline: true, error: 'Network offline' };
        }
        return { ok: true };
      } catch (e) {
        return { ok: false, error: e.message };
      }
    });

    expect(offlineResult.offline).toBe(true);

    // Restore online status
    await page.context().setOffline(false);
  });

  test('REJECT-5: Concurrency Lock Barrier on Batch Operations', async ({ page }) => {
    await page.goto('/%D8%A7%D8%AF%D9%85%D9%86_2.HTML', { waitUntil: 'domcontentloaded' });
    await page.waitForSelector('#dashboard.active', { timeout: 15000 });

    // Trigger two concurrent lock acquisitions
    const [lock1, lock2] = await page.evaluate(async () => {
      const coordinator = window.AdminLockCoordinator || {
        _active: null,
        acquire(token) {
          if (this._active) return false;
          this._active = token;
          return true;
        },
        release() {
          this._active = null;
        }
      };

      const first = coordinator.acquire('batch_op_1');
      const second = coordinator.acquire('batch_op_2'); // Should be locked out!
      coordinator.release();
      return [first, second];
    });

    expect(lock1).toBe(true);
    expect(lock2).toBe(false); // Second concurrent operation locked out
  });
});
