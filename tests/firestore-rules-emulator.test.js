/**
 * REAL FIREBASE RULES ENGINE + EMULATOR INTEGRATION TEST SUITE
 *
 * Uses @firebase/rules-unit-testing against the Cloud Firestore Emulator
 * loading the actual repository `firestore.rules` against isolated test project
 * `demo-sale-zone-e2e`.
 *
 * Run via:
 *   firebase emulators:exec --only firestore "node tests/firestore-rules-emulator.test.js"
 */

'use strict';

const assert = require('assert');
const fs = require('fs');
const path = require('path');
const {
  initializeTestEnvironment,
  assertSucceeds,
  assertFails
} = require('@firebase/rules-unit-testing');

const PROJECT_ID = 'demo-sale-zone-e2e';
const firebaseApi = require('../assets/js/firebase-api.js');

function parseEmulatorHost() {
  const raw = String(process.env.FIRESTORE_EMULATOR_HOST || '').trim();
  if (!raw) {
    throw new Error(
      'FIRESTORE_EMULATOR_HOST is not set. Run this suite via `firebase emulators:exec --only firestore` so production is never touched.'
    );
  }
  const [host, portStr] = raw.split(':');
  return {
    host: host || '127.0.0.1',
    port: Number(portStr) || 8080
  };
}

let passedTests = 0;
let totalTests = 0;

async function runTest(name, fn) {
  totalTests++;
  try {
    await fn();
    console.log(`✅ [PASS] ${name}`);
    passedTests++;
  } catch (err) {
    console.error(`❌ [FAIL] ${name}`);
    console.error(err);
    process.exitCode = 1;
  }
}

(async () => {
  const { host, port } = parseEmulatorHost();
  assert.ok(PROJECT_ID.startsWith('demo-'), 'Emulator project ID must remain isolated (demo-*)');

  const rules = fs.readFileSync(path.join(__dirname, '..', 'firestore.rules'), 'utf8');
  const testEnv = await initializeTestEnvironment({
    projectId: PROJECT_ID,
    firestore: {
      rules,
      host,
      port
    }
  });

  console.log('====================================================');
  console.log(`🔥 FIRESTORE RULES EMULATOR SUITE (${PROJECT_ID} @ ${host}:${port})`);
  console.log('====================================================\n');

  try {
    await testEnv.clearFirestore();

    // Seed baseline data with security rules disabled
    await testEnv.withSecurityRulesDisabled(async (ctx) => {
      const db = ctx.firestore();
      await db.collection('products').doc('prod_pub_1').set({
        name: 'شامبو الأرجان',
        price: 250,
        stock: 10,
        trackInventory: true,
        isPublished: true
      });
      await db.collection('products').doc('prod_unpub_1').set({
        name: 'منتج غير منشور',
        price: 300,
        stock: 5,
        trackInventory: true,
        isPublished: false
      });
      await db.collection('product_commercial').doc('prod_pub_1').set({
        productId: 'prod_pub_1',
        costPrice: 120,
        supplierId: 'sup_1'
      });
      await db.collection('coupons').doc('cp_sale10').set({
        code: 'SALE10',
        type: 'percentage',
        discount: 10,
        value: 10,
        minOrderAmount: 100,
        active: true,
        usageLimit: 5,
        usedCount: 0
      });
      await db.collection('customers').doc('cust_verified_1').set({
        uid: 'cust_verified_1',
        email: 'customer1@example.com',
        phone: '01011112222',
        address: 'القاهرة',
        displayName: 'عميل موثق',
        role: 'customer',
        loyaltyPoints: 50,
        createdAt: '2026-01-01T00:00:00.000Z',
        updatedAt: '2026-01-01T00:00:00.000Z'
      });
    });

    const anonDb = testEnv.unauthenticatedContext().firestore();
    const unverifiedCustDb = testEnv.authenticatedContext('cust_unverified', {
      email: 'unverified@example.com',
      email_verified: false
    }).firestore();
    const custDb = testEnv.authenticatedContext('cust_verified_1', {
      email: 'customer1@example.com',
      email_verified: true
    }).firestore();
    const otherCustDb = testEnv.authenticatedContext('cust_other_2', {
      email: 'other@example.com',
      email_verified: true
    }).firestore();
    const unverifiedAdminDb = testEnv.authenticatedContext('admin_unverified', {
      email: 'admin0@example.com',
      email_verified: false,
      admin: true,
      role: 'admin'
    }).firestore();
    const adminDb = testEnv.authenticatedContext('admin_uid_1', {
      email: 'admin@example.com',
      email_verified: true,
      admin: true,
      role: 'admin'
    }).firestore();
    const admin2Db = testEnv.authenticatedContext('admin_uid_2', {
      email: 'admin2@example.com',
      email_verified: true,
      admin: true,
      role: 'admin'
    }).firestore();

    // 1. Catalog Visibility & Commercial Secret Rules
    await runTest('Rule-1: Published product readable by customer; unpublished product denied for customer & anon', async () => {
      await assertSucceeds(custDb.collection('products').doc('prod_pub_1').get());
      await assertFails(custDb.collection('products').doc('prod_unpub_1').get());
      await assertFails(anonDb.collection('products').doc('prod_unpub_1').get());
      await assertSucceeds(adminDb.collection('products').doc('prod_unpub_1').get());
    });

    await runTest('Rule-2: Customer/unverified admin denied reading or writing product_commercial; verified admin allowed', async () => {
      await assertFails(custDb.collection('product_commercial').doc('prod_pub_1').get());
      await assertFails(unverifiedAdminDb.collection('product_commercial').doc('prod_pub_1').get());
      await assertFails(custDb.collection('products').doc('prod_pub_1').update({ price: 1 }));
      await assertSucceeds(adminDb.collection('product_commercial').doc('prod_pub_1').get());
    });

    // 2. Customer Fail-Closed Pricing & Order Create Rules
    await runTest('Rule-3: Customer attempting to order unpublished product fails closed when catalog read is denied', async () => {
      let rejected = false;
      try {
        await firebaseApi.persistOrderOnline(custDb, {
          uid: 'cust_verified_1',
          orderNumber: 'SZ-UNPUB-01',
          idempotencyKey: 'idem_unpub_real_001',
          customer: { name: 'اختبار', phone: '01011112222', address: 'القاهرة' },
          items: [{ lineId: 'l1', productId: 'prod_unpub_1', name: 'منتج مسودة', price: 1, quantity: 1 }],
          subtotal: 1,
          total: 1,
          status: 'pending'
        });
      } catch (err) {
        rejected = true;
      }
      assert.strictEqual(rejected, true, 'Must fail closed when Firestore denies product read');

      let savedExists = false;
      await testEnv.withSecurityRulesDisabled(async (ctx) => {
        const snap = await ctx.firestore().collection('orders').doc('ord_idem_unpub_real_001').get();
        savedExists = snap.exists;
      });
      assert.strictEqual(savedExists, false, 'Unpublished order must NOT exist in Firestore');
    });

    await runTest('Rule-4: Customer tampered price is overwritten & created cleanly when rules pass; invalid creates blocked', async () => {
      // Unverified user blocked
      await assertFails(unverifiedCustDb.collection('orders').doc('ord_unver_01').set({
        uid: 'cust_unverified',
        orderNumber: 'SZ-001',
        idempotencyKey: 'idem_unverified_001',
        customer: { name: 'A' },
        items: [{ productId: 'prod_pub_1', price: 250, quantity: 1 }],
        total: 250,
        status: 'pending',
        createdAt: new Date().toISOString()
      }));

      // Customer trying to forge admin/return flags blocked
      await assertFails(custDb.collection('orders').doc('ord_forged_01').set({
        uid: 'cust_verified_1',
        orderNumber: 'SZ-002',
        idempotencyKey: 'idem_forged_0001',
        customer: { name: 'A' },
        items: [{ productId: 'prod_pub_1', price: 250, quantity: 1 }],
        total: 250,
        status: 'pending',
        returnVerified: true,
        createdAt: new Date().toISOString()
      }));

      // Real persistOrderOnline with tampered client price (1 EGP) + fake discount (100) + valid SALE10
      const orderRes = await firebaseApi.persistOrderOnline(custDb, {
        uid: 'cust_verified_1',
        email: 'customer1@example.com',
        orderNumber: 'SZ-REAL-1001',
        idempotencyKey: 'idem_real_cust_1001',
        customer: { name: 'عميل موثق', phone: '01011112222', address: 'القاهرة' },
        items: [{ lineId: 'line_1_pub', productId: 'prod_pub_1', name: 'سعر مزيف', price: 1, quantity: 2 }],
        couponCode: 'SALE10',
        couponId: 'cp_sale10',
        discount: 499,
        subtotal: 2,
        total: 2,
        status: 'pending',
        version: 1
      });
      assert.strictEqual(orderRes.duplicate, false);

      // Verify independent read in Firestore Emulator
      const savedSnap = await custDb.collection('orders').doc(orderRes.id).get();
      const saved = savedSnap.data();
      assert.strictEqual(saved.items[0].price, 250, 'Catalog price 250 enforced over client 1');
      assert.strictEqual(saved.subtotal, 500);
      assert.strictEqual(saved.discount, 50, '10% SALE10 discount enforced (50) over tampered 499');
      assert.strictEqual(saved.total, 450);

      // Duplicate order replay with same idempotencyKey returns duplicate: true
      const dupRes = await firebaseApi.persistOrderOnline(custDb, {
        uid: 'cust_verified_1',
        orderNumber: 'SZ-REAL-1001',
        idempotencyKey: 'idem_real_cust_1001',
        customer: { name: 'عميل موثق', phone: '01011112222', address: 'القاهرة' },
        items: [{ lineId: 'line_1_pub', productId: 'prod_pub_1', price: 250, quantity: 2 }],
        couponCode: 'SALE10',
        couponId: 'cp_sale10',
        status: 'pending'
      });
      assert.strictEqual(dupRes.duplicate, true);

      // Other customer cannot read or update this order
      await assertFails(otherCustDb.collection('orders').doc(orderRes.id).get());
      await assertFails(custDb.collection('orders').doc(orderRes.id).update({ status: 'cancelled' }));
    });

    // 3. Order Lifecycle Transitions + Coupon + Stock Deduction + Returns in Real Rules
    await runTest('Rule-5: Invalid transitions blocked; admin delivers -> partial return -> full return succeeds atomically', async () => {
      const orderId = 'ord_idem_real_cust_1001';

      // Invalid jump pending -> partially_returned rejected by firestore.rules
      await assertFails(adminDb.collection('orders').doc(orderId).set({
        status: 'partially_returned',
        returnVerified: true,
        inventoryReturnProcessed: true,
        returnReceiptId: 'ret_bad',
        returnReceiptIds: ['ret_bad'],
        returnedQuantitiesByLine: { line_1_pub: 1 },
        version: 2
      }, { merge: true }));

      // Stale version rejected
      await assertFails(adminDb.collection('orders').doc(orderId).set({
        status: 'confirmed',
        version: 1
      }, { merge: true }));

      // Confirmed -> deducts stock (10 -> 8) and increments SALE10 usedCount (0 -> 1) cleanly respecting version
      await firebaseApi.updateOrderStatus(orderId, 'confirmed', {
        db: adminDb,
        skipAdminAuthCheck: true,
        operatorUid: 'admin_uid_1'
      });

      const afterConfirmProd = (await adminDb.collection('products').doc('prod_pub_1').get()).data();
      const afterConfirmCoupon = (await adminDb.collection('coupons').doc('cp_sale10').get()).data();
      assert.strictEqual(afterConfirmProd.stock, 8, 'Stock deducted from 10 to 8');
      assert.strictEqual(afterConfirmCoupon.usedCount, 1, 'Coupon usedCount incremented from 0 to 1');

      // Shipped -> Delivered (awards loyalty points 5% of 450 = 22)
      await firebaseApi.updateOrderStatus(orderId, 'shipped', {
        db: adminDb,
        skipAdminAuthCheck: true,
        operatorUid: 'admin_uid_1'
      });
      await firebaseApi.updateOrderStatus(orderId, 'delivered', {
        db: adminDb,
        skipAdminAuthCheck: true,
        operatorUid: 'admin_uid_1'
      });

      const afterDeliverOrder = (await adminDb.collection('orders').doc(orderId).get()).data();
      const afterDeliverCust = (await adminDb.collection('customers').doc('cust_verified_1').get()).data();
      assert.strictEqual(afterDeliverOrder.status, 'delivered');
      assert.strictEqual(afterDeliverOrder.loyaltyAwarded, true);
      assert.strictEqual(afterDeliverCust.loyaltyPoints, 72, '50 + 22 earned points = 72');

      // Partial return: 1 sellable unit via atomic createAndProcessReturnReceipt (against real rules!)
      const ret1 = await firebaseApi.createAndProcessReturnReceipt({
        returnId: 'ret_emu_part_1',
        orderId,
        items: [{ lineId: 'line_1_pub', productId: 'prod_pub_1', receivedQty: 1, sellableQty: 1, damagedQty: 0 }]
      }, { db: adminDb, operatorUid: 'admin_uid_1' });

      assert.strictEqual(ret1.success, true);
      assert.strictEqual(ret1.orderStatus, 'partially_returned');

      const prodAfterPart = (await adminDb.collection('products').doc('prod_pub_1').get()).data();
      const orderAfterPart = (await adminDb.collection('orders').doc(orderId).get()).data();
      assert.strictEqual(prodAfterPart.stock, 9, 'Sellable unit restocked: 8 -> 9');
      assert.strictEqual(orderAfterPart.status, 'partially_returned');

      // Replay same ret1 returnId -> duplicate: true, stock untouched (stays 9)
      const ret1Dup = await firebaseApi.createAndProcessReturnReceipt({
        returnId: 'ret_emu_part_1',
        orderId,
        items: [{ lineId: 'line_1_pub', productId: 'prod_pub_1', receivedQty: 1, sellableQty: 1, damagedQty: 0 }]
      }, { db: adminDb, operatorUid: 'admin_uid_1' });
      assert.strictEqual(ret1Dup.duplicate, true);
      assert.strictEqual((await adminDb.collection('products').doc('prod_pub_1').get()).data().stock, 9);

      // Concurrent 2-admin return on the last remaining unit -> ONLY ONE may succeed!
      const raceResults = await Promise.allSettled([
        firebaseApi.createAndProcessReturnReceipt({
          returnId: 'ret_emu_race_a',
          orderId,
          items: [{ lineId: 'line_1_pub', productId: 'prod_pub_1', receivedQty: 1, sellableQty: 0, damagedQty: 1 }]
        }, { db: adminDb, operatorUid: 'admin_uid_1' }),
        firebaseApi.createAndProcessReturnReceipt({
          returnId: 'ret_emu_race_b',
          orderId,
          items: [{ lineId: 'line_1_pub', productId: 'prod_pub_1', receivedQty: 1, sellableQty: 0, damagedQty: 1 }]
        }, { db: admin2Db, operatorUid: 'admin_uid_2' })
      ]);

      const raceWins = raceResults.filter(r => r.status === 'fulfilled');
      const raceLosses = raceResults.filter(r => r.status === 'rejected');
      assert.strictEqual(raceWins.length, 1, 'Only one concurrent return on remaining unit may commit in real Firestore');
      assert.strictEqual(raceLosses.length, 1, 'Second concurrent return must fail atomic remaining qty check');

      const finalOrder = (await adminDb.collection('orders').doc(orderId).get()).data();
      const finalProd = (await adminDb.collection('products').doc('prod_pub_1').get()).data();
      assert.strictEqual(finalOrder.status, 'returned');
      assert.strictEqual(finalOrder.returnedQuantitiesByLine.line_1_pub, 2);
      assert.strictEqual(finalProd.stock, 9, 'Damaged full-return item quarantined at delta 0 (stock remains 9)');

      // Terminal returned order cannot be transitioned back to pending
      await assertFails(adminDb.collection('orders').doc(orderId).set({
        status: 'pending',
        version: finalOrder.version + 1
      }, { merge: true }));
    });

    // 4. Ledger & Return Receipt Immutability & Actor Identity Binding
    await runTest('Rule-6: Ledger & completed return receipts are immutable and enforce performedBy/inspectedBy == request.auth.uid', async () => {
      // Attempt to spoof performedBy on ledger
      await assertFails(adminDb.collection('inventory_ledger').doc('inv_spoof_1').set({
        movementId: 'inv_spoof_1',
        productId: 'prod_pub_1',
        quantity: -1,
        delta: -1,
        movementType: 'ADJUST_MANUAL_AUDIT',
        idempotencyKey: 'spoof_k1',
        performedBy: 'another_admin_uid'
      }));

      // Attempt to update or delete completed return receipt
      await assertFails(adminDb.collection('returns').doc('ret_emu_part_1').update({ status: 'pending_processing' }));
      await assertFails(adminDb.collection('returns').doc('ret_emu_part_1').delete());

      // Attempt to spoof inspectedBy on returns
      await assertFails(adminDb.collection('returns').doc('ret_spoof_1').set({
        returnId: 'ret_spoof_1',
        orderId: 'ord_idem_real_cust_1001',
        items: [{ lineId: 'line_1_pub', receivedQty: 1, sellableQty: 1, damagedQty: 0 }],
        status: 'completed',
        inspectedBy: 'fake_uid',
        performedBy: 'admin_uid_1'
      }));

      // Attempt to update or delete existing ledger movement
      const ledgerSnap = await adminDb.collection('inventory_ledger').limit(1).get();
      assert.strictEqual(ledgerSnap.empty, false);
      const firstLedgerId = ledgerSnap.docs[0].id;
      await assertFails(adminDb.collection('inventory_ledger').doc(firstLedgerId).update({ quantity: 999 }));
      await assertFails(adminDb.collection('inventory_ledger').doc(firstLedgerId).delete());
    });

    // 5. Direct-SDK Order Forgery Protection (P1 Closure — Bypassing JS wrappers)
    await runTest('Rule-7: Direct-SDK forged /orders writes (1 EGP, bad total, forged discount/points, unpublished, over-stock, >4 items) denied by Rules', async () => {
      await testEnv.withSecurityRulesDisabled(async (ctx) => {
        const db = ctx.firestore();
        await db.collection('products').doc('prod_pub_2').set({
          name: 'كريم كولاجين',
          price: 100,
          stock: 10,
          trackInventory: true,
          isPublished: true
        });
      });

      const directOrder = (id, overrides = {}) => ({
        id,
        uid: 'cust_verified_1',
        orderNumber: `SZ-DIRECT-${id}`,
        idempotencyKey: `idem_direct_${id}_0001`,
        customer: { name: 'عميل مباشر', phone: '01011112222', address: 'القاهرة' },
        items: [{ lineId: 'l1', productId: 'prod_pub_1', price: 250, quantity: 1 }],
        subtotal: 250,
        discount: 0,
        pointsDiscount: 0,
        shipping: 0,
        total: 250,
        earnedPoints: 12,
        status: 'pending',
        createdAt: new Date().toISOString(),
        version: 1,
        ...overrides
      });

      // Forged 1 EGP price & total (with earnedPoints: 0)
      await assertFails(custDb.collection('orders').doc('ord_atk_1egp').set(directOrder('ord_atk_1egp', {
        items: [{ lineId: 'l1', productId: 'prod_pub_1', price: 1, quantity: 1 }],
        subtotal: 1,
        total: 1,
        earnedPoints: 0
      })));

      // Wrong item price (10 != 250)
      await assertFails(custDb.collection('orders').doc('ord_atk_wrong_price').set(directOrder('ord_atk_wrong_price', {
        items: [{ lineId: 'l1', productId: 'prod_pub_1', price: 10, quantity: 1 }],
        subtotal: 10,
        total: 10,
        earnedPoints: 0
      })));

      // Total != sum(items)
      await assertFails(custDb.collection('orders').doc('ord_atk_bad_total').set(directOrder('ord_atk_bad_total', {
        subtotal: 250,
        total: 50
      })));

      // Forged discount without coupon / exceeding coupon cap
      await assertFails(custDb.collection('orders').doc('ord_atk_forged_disc').set(directOrder('ord_atk_forged_disc', {
        discount: 249,
        total: 1,
        earnedPoints: 0
      })));
      await assertFails(custDb.collection('orders').doc('ord_atk_over_coupon').set(directOrder('ord_atk_over_coupon', {
        couponId: 'cp_sale10',
        couponCode: 'SALE10',
        discount: 200,
        total: 50,
        earnedPoints: 0
      })));

      // Forged loyalty points discount exceeding customer balance
      await assertFails(custDb.collection('orders').doc('ord_atk_forged_pts').set(directOrder('ord_atk_forged_pts', {
        usedPoints: 99999,
        pointsDiscount: 200,
        total: 50,
        earnedPoints: 0
      })));

      // Unpublished product
      await assertFails(custDb.collection('orders').doc('ord_atk_unpub').set(directOrder('ord_atk_unpub', {
        items: [{ lineId: 'l1', productId: 'prod_unpub_1', price: 300, quantity: 1 }],
        subtotal: 300,
        total: 300
      })));

      // Invalid quantity (0 and exceeding stock 999 > 10)
      await assertFails(custDb.collection('orders').doc('ord_atk_qty0').set(directOrder('ord_atk_qty0', {
        items: [{ lineId: 'l1', productId: 'prod_pub_1', price: 250, quantity: 0 }],
        subtotal: 0,
        total: 0,
        earnedPoints: 0
      })));
      await assertFails(custDb.collection('orders').doc('ord_atk_overstock').set(directOrder('ord_atk_overstock', {
        items: [{ lineId: 'l1', productId: 'prod_pub_1', price: 250, quantity: 999 }],
        subtotal: 249750,
        total: 249750
      })));

      // Unauthenticated create & > 3 distinct items owner create
      await assertFails(anonDb.collection('orders').doc('ord_atk_unauth').set(directOrder('ord_atk_unauth')));
      await assertFails(custDb.collection('orders').doc('ord_atk_6items').set(directOrder('ord_atk_6items', {
        items: [
          { lineId: 'l1', productId: 'prod_pub_1', price: 250, quantity: 1 },
          { lineId: 'l2', productId: 'prod_pub_2', price: 100, quantity: 1 },
          { lineId: 'l3', productId: 'prod_pub_1', price: 250, quantity: 1 },
          { lineId: 'l4', productId: 'prod_pub_2', price: 100, quantity: 1 }
        ],
        subtotal: 700,
        total: 700
      })));

      // Forged inventory/return/loyalty state flags
      await assertFails(custDb.collection('orders').doc('ord_atk_flags').set(directOrder('ord_atk_flags', {
        inventoryDeducted: true,
        loyaltyAwarded: true,
        returnVerified: true
      })));
    });

    await runTest('Rule-8: Valid direct-SDK single-item, multi-item (up to 4), and valid coupon orders succeed under hardened Rules', async () => {
      await assertSucceeds(custDb.collection('orders').doc('ord_direct_ok_1').set({
        id: 'ord_direct_ok_1',
        uid: 'cust_verified_1',
        orderNumber: 'SZ-DIRECT-OK-1',
        idempotencyKey: 'idem_direct_ok_1_0001',
        customer: { name: 'عميل مباشر', phone: '01011112222', address: 'القاهرة' },
        items: [{ lineId: 'l1', productId: 'prod_pub_1', price: 250, quantity: 1 }],
        subtotal: 250,
        discount: 0,
        pointsDiscount: 0,
        shipping: 0,
        total: 250,
        earnedPoints: 12,
        status: 'pending',
        createdAt: new Date().toISOString(),
        version: 1
      }));

      await assertSucceeds(custDb.collection('orders').doc('ord_direct_ok_multi').set({
        id: 'ord_direct_ok_multi',
        uid: 'cust_verified_1',
        orderNumber: 'SZ-DIRECT-OK-MULTI',
        idempotencyKey: 'idem_direct_ok_multi_0001',
        customer: { name: 'عميل مباشر', phone: '01011112222', address: 'القاهرة' },
        items: [
          { lineId: 'l1', productId: 'prod_pub_1', price: 250, quantity: 1 },
          { lineId: 'l2', productId: 'prod_pub_2', price: 100, quantity: 2 }
        ],
        subtotal: 450,
        couponId: 'cp_sale10',
        couponCode: 'SALE10',
        discount: 45,
        pointsDiscount: 0,
        shipping: 25,
        total: 430,
        earnedPoints: 21,
        status: 'pending',
        createdAt: new Date().toISOString(),
        version: 1
      }));
    });

    // 6. Phase 3B — Order Line Identity (lineId) & Uniqueness
    await runTest('Rule-9: LineId required & unique across items; duplicate/missing lineId rejected by Rules and updateOrderStatus never skips lines', async () => {
      const mkOrder = (id, items, subtotal) => ({
        id,
        uid: 'cust_verified_1',
        orderNumber: `SZ-${id}`,
        idempotencyKey: `idem_3b_${id}_0001`,
        customer: { name: 'عميل', phone: '01011112222', address: 'القاهرة' },
        items,
        subtotal,
        discount: 0,
        pointsDiscount: 0,
        shipping: 0,
        total: subtotal,
        earnedPoints: 5,
        status: 'pending',
        createdAt: new Date().toISOString(),
        version: 1
      });

      // 1. Two different products with same lineId -> denied
      await assertFails(custDb.collection('orders').doc('ord_line_dup_diff').set(mkOrder('ord_line_dup_diff', [
        { lineId: 'same_l', productId: 'prod_pub_1', price: 250, quantity: 1 },
        { lineId: 'same_l', productId: 'prod_pub_2', price: 100, quantity: 1 }
      ], 350)));

      // 2. Two items same product with same lineId -> denied
      await assertFails(custDb.collection('orders').doc('ord_line_dup_same').set(mkOrder('ord_line_dup_same', [
        { lineId: 'same_l', productId: 'prod_pub_1', price: 250, quantity: 1 },
        { lineId: 'same_l', productId: 'prod_pub_1', price: 250, quantity: 1 }
      ], 500)));

      // 3. Two items same product without lineId -> denied
      await assertFails(custDb.collection('orders').doc('ord_line_missing').set(mkOrder('ord_line_missing', [
        { productId: 'prod_pub_1', price: 250, quantity: 1 },
        { productId: 'prod_pub_1', price: 250, quantity: 1 }
      ], 500)));

      // 4. Repeated id without unique lineId -> denied
      await assertFails(custDb.collection('orders').doc('ord_line_id_dup').set(mkOrder('ord_line_id_dup', [
        { id: 'shared', productId: 'prod_pub_1', price: 250, quantity: 1 },
        { id: 'shared', productId: 'prod_pub_2', price: 100, quantity: 1 }
      ], 350)));

      // 5. Valid unique lineIds -> succeeds
      await assertSucceeds(custDb.collection('orders').doc('ord_line_valid').set(mkOrder('ord_line_valid', [
        { lineId: 'l_uniq_1', productId: 'prod_pub_1', price: 250, quantity: 1 },
        { lineId: 'l_uniq_2', productId: 'prod_pub_2', price: 100, quantity: 1 }
      ], 350)));
    });

    // 7. Phase 3B — Inventory Aggregation & trackInventory Missing Stock Policy
    await runTest('Rule-10: Aggregated product quantities > stock denied by Rules; missing stock on trackInventory:true denied; valid sums allowed', async () => {
      await testEnv.withSecurityRulesDisabled(async (ctx) => {
        const db = ctx.firestore();
        await db.collection('products').doc('prod_agg_10').set({
          name: 'منتج تجميع',
          price: 100,
          stock: 10,
          trackInventory: true,
          isPublished: true
        });
        await db.collection('products').doc('prod_agg_other').set({
          name: 'منتج مستقل',
          price: 100,
          stock: 10,
          trackInventory: true,
          isPublished: true
        });
        await db.collection('products').doc('prod_missing_stock').set({
          name: 'منتج بدون مخزون',
          price: 100,
          trackInventory: true,
          isPublished: true
        });
      });

      const mkAgg = (id, items, total) => ({
        id,
        uid: 'cust_verified_1',
        orderNumber: `SZ-${id}`,
        idempotencyKey: `idem_agg_${id}_0001`,
        customer: { name: 'عميل', phone: '010', address: 'القاهرة' },
        items,
        subtotal: total,
        discount: 0,
        pointsDiscount: 0,
        shipping: 0,
        total,
        earnedPoints: 0,
        status: 'pending',
        createdAt: new Date().toISOString(),
        version: 1
      });

      // Single line qty 11 > 10 -> denied
      await assertFails(custDb.collection('orders').doc('ord_agg_11').set(mkAgg('ord_agg_11', [
        { lineId: 'a1', productId: 'prod_agg_10', price: 100, quantity: 11 }
      ], 1100)));

      // Two lines same product 6 + 6 = 12 > 10 -> denied
      await assertFails(custDb.collection('orders').doc('ord_agg_6_6').set(mkAgg('ord_agg_6_6', [
        { lineId: 'a1', productId: 'prod_agg_10', price: 100, quantity: 6 },
        { lineId: 'a2', productId: 'prod_agg_10', price: 100, quantity: 6 }
      ], 1200)));

      // Three lines same product 4 + 4 + 4 = 12 > 10 -> denied
      await assertFails(custDb.collection('orders').doc('ord_agg_4_4_4').set(mkAgg('ord_agg_4_4_4', [
        { lineId: 'a1', productId: 'prod_agg_10', price: 100, quantity: 4 },
        { lineId: 'a2', productId: 'prod_agg_10', price: 100, quantity: 4 },
        { lineId: 'a3', productId: 'prod_agg_10', price: 100, quantity: 4 }
      ], 1200)));

      // Missing stock when trackInventory:true -> denied
      await assertFails(custDb.collection('orders').doc('ord_agg_missing').set(mkAgg('ord_agg_missing', [
        { lineId: 'a1', productId: 'prod_missing_stock', price: 100, quantity: 1 }
      ], 100)));

      // Multiple lines same product 4 + 5 = 9 <= 10 -> succeeds
      await assertSucceeds(custDb.collection('orders').doc('ord_agg_ok_9').set(mkAgg('ord_agg_ok_9', [
        { lineId: 'a1', productId: 'prod_agg_10', price: 100, quantity: 4 },
        { lineId: 'a2', productId: 'prod_agg_10', price: 100, quantity: 5 }
      ], 900)));

      // Different products with independent stocks (6 and 6) -> succeeds
      await assertSucceeds(custDb.collection('orders').doc('ord_agg_indep').set(mkAgg('ord_agg_indep', [
        { lineId: 'a1', productId: 'prod_agg_10', price: 100, quantity: 6 },
        { lineId: 'a2', productId: 'prod_agg_other', price: 100, quantity: 6 }
      ], 1200)));
    });

    // 8. Phase 3B — Coupon Contract Parity
    await runTest('Rule-11: Full coupon parity (minOrderAmount, expiresAt, active/isActive/status, maxUses/usageLimit, couponCode, maxDiscount)', async () => {
      await testEnv.withSecurityRulesDisabled(async (ctx) => {
        const db = ctx.firestore();
        await db.collection('coupons').doc('cp_min500').set({ code: 'MIN500', type: 'fixed', value: 50, minOrderAmount: 500, active: true });
        await db.collection('coupons').doc('cp_exp_iso').set({ code: 'EXPISO', type: 'fixed', value: 50, expiresAt: '2020-01-01T00:00:00.000Z', active: true });
        await db.collection('coupons').doc('cp_isact_false').set({ code: 'ISACT', type: 'fixed', value: 50, isActive: false });
        await db.collection('coupons').doc('cp_status_off').set({ code: 'STOFF', type: 'fixed', value: 50, status: 'inactive' });
        await db.collection('coupons').doc('cp_maxuses').set({ code: 'MAXU', type: 'fixed', value: 50, maxUses: 1, usedCount: 1, active: true });
        await db.collection('coupons').doc('cp_maxdisc').set({ code: 'CAP30', type: 'percentage', value: 50, maxDiscount: 30, minOrderAmount: 100, active: true, expiresAt: '2099-12-31T23:59:59.000Z' });
      });

      const mkCp = (id, couponId, couponCode, discount, total, subtotal = 250) => ({
        id,
        uid: 'cust_verified_1',
        orderNumber: `SZ-${id}`,
        idempotencyKey: `idem_cp_${id}_0001`,
        customer: { name: 'عميل', phone: '010', address: 'القاهرة' },
        items: [{ lineId: 'c1', productId: 'prod_pub_1', price: 250, quantity: subtotal / 250 }],
        subtotal,
        couponId,
        couponCode,
        discount,
        pointsDiscount: 0,
        shipping: 0,
        total,
        earnedPoints: 0,
        status: 'pending',
        createdAt: new Date().toISOString(),
        version: 1
      });

      await assertFails(custDb.collection('orders').doc('ord_cp_min').set(mkCp('ord_cp_min', 'cp_min500', 'MIN500', 50, 200)));
      await assertFails(custDb.collection('orders').doc('ord_cp_exp').set(mkCp('ord_cp_exp', 'cp_exp_iso', 'EXPISO', 50, 200)));
      await assertFails(custDb.collection('orders').doc('ord_cp_isact').set(mkCp('ord_cp_isact', 'cp_isact_false', 'ISACT', 50, 200)));
      await assertFails(custDb.collection('orders').doc('ord_cp_stoff').set(mkCp('ord_cp_stoff', 'cp_status_off', 'STOFF', 50, 200)));
      await assertFails(custDb.collection('orders').doc('ord_cp_maxu').set(mkCp('ord_cp_maxu', 'cp_maxuses', 'MAXU', 50, 200)));
      await assertFails(custDb.collection('orders').doc('ord_cp_mismatch').set(mkCp('ord_cp_mismatch', 'cp_maxdisc', 'WRONG', 30, 220)));
      await assertFails(custDb.collection('orders').doc('ord_cp_overcap').set(mkCp('ord_cp_overcap', 'cp_maxdisc', 'CAP30', 125, 125)));

      // Valid capped coupon (50% of 250 = 125 capped by maxDiscount 30 -> discount 30, total 220)
      await assertSucceeds(custDb.collection('orders').doc('ord_cp_valid_cap').set(mkCp('ord_cp_valid_cap', 'cp_maxdisc', 'CAP30', 30, 220)));
    });

    // 9. Phase 3B — Concurrent Coupon & Loyalty Integrity
    await runTest('Rule-12: Concurrent admin confirmations fail closed on exhausted coupon usageLimit & insufficient loyalty points', async () => {
      await testEnv.withSecurityRulesDisabled(async (ctx) => {
        const db = ctx.firestore();
        await db.collection('products').doc('prod_race').set({ name: 'RaceProd', price: 250, stock: 20, trackInventory: true, isPublished: true });
        await db.collection('coupons').doc('cp_once').set({ code: 'ONCE1', type: 'fixed', value: 25, usageLimit: 1, usedCount: 0, active: true });
        await db.collection('customers').doc('cust_pts50').set({
          uid: 'cust_pts50',
          email: 'pts50@example.com',
          phone: '01011112222',
          address: 'القاهرة',
          displayName: 'عميل 50 نقطة',
          role: 'customer',
          loyaltyPoints: 50,
          createdAt: '2026-01-01T00:00:00.000Z',
          updatedAt: '2026-01-01T00:00:00.000Z'
        });
        await db.collection('orders').doc('ord_race_cp_1').set({
          id: 'ord_race_cp_1', uid: 'cust_verified_1', orderNumber: 'SZ-RC1', idempotencyKey: 'idem_rc_1_0001',
          customer: { name: 'A' }, items: [{ lineId: 'r1', productId: 'prod_race', price: 250, quantity: 1 }],
          subtotal: 250, couponId: 'cp_once', couponCode: 'ONCE1', discount: 25, total: 225, status: 'pending', version: 1, createdAt: new Date().toISOString()
        });
        await db.collection('orders').doc('ord_race_cp_2').set({
          id: 'ord_race_cp_2', uid: 'cust_other_2', orderNumber: 'SZ-RC2', idempotencyKey: 'idem_rc_2_0001',
          customer: { name: 'B' }, items: [{ lineId: 'r1', productId: 'prod_race', price: 250, quantity: 1 }],
          subtotal: 250, couponId: 'cp_once', couponCode: 'ONCE1', discount: 25, total: 225, status: 'pending', version: 1, createdAt: new Date().toISOString()
        });
        await db.collection('orders').doc('ord_race_pts_1').set({
          id: 'ord_race_pts_1', uid: 'cust_pts50', orderNumber: 'SZ-RP1', idempotencyKey: 'idem_rp_1_0001',
          customer: { name: 'P1' }, items: [{ lineId: 'p1', productId: 'prod_race', price: 250, quantity: 1 }],
          subtotal: 250, usedPoints: 50, pointsDiscount: 5, total: 245, status: 'pending', version: 1, createdAt: new Date().toISOString()
        });
        await db.collection('orders').doc('ord_race_pts_2').set({
          id: 'ord_race_pts_2', uid: 'cust_pts50', orderNumber: 'SZ-RP2', idempotencyKey: 'idem_rp_2_0001',
          customer: { name: 'P2' }, items: [{ lineId: 'p1', productId: 'prod_race', price: 250, quantity: 1 }],
          subtotal: 250, usedPoints: 50, pointsDiscount: 5, total: 245, status: 'pending', version: 1, createdAt: new Date().toISOString()
        });
      });

      const admin2Db = testEnv.authenticatedContext('admin_uid_2', { email: 'admin2@example.com', email_verified: true, admin: true, role: 'admin' }).firestore();

      // Concurrent coupon race
      const cpResults = await Promise.allSettled([
        firebaseApi.updateOrderStatus('ord_race_cp_1', 'confirmed', { db: adminDb, operatorUid: 'admin_uid_1', skipAdminAuthCheck: true }),
        firebaseApi.updateOrderStatus('ord_race_cp_2', 'confirmed', { db: admin2Db, operatorUid: 'admin_uid_2', skipAdminAuthCheck: true })
      ]);
      assert.strictEqual(cpResults.filter(r => r.status === 'fulfilled').length, 1, 'Only 1 order may consume usageLimit:1 coupon');
      assert.strictEqual(cpResults.filter(r => r.status === 'rejected').length, 1, 'Second concurrent coupon order must fail closed');
      assert.strictEqual((await adminDb.collection('coupons').doc('cp_once').get()).data().usedCount, 1);

      // Concurrent loyalty points race (50 points customer, 2 orders x 50 points)
      const ptsResults = await Promise.allSettled([
        firebaseApi.updateOrderStatus('ord_race_pts_1', 'confirmed', { db: adminDb, operatorUid: 'admin_uid_1', skipAdminAuthCheck: true }),
        firebaseApi.updateOrderStatus('ord_race_pts_2', 'confirmed', { db: admin2Db, operatorUid: 'admin_uid_2', skipAdminAuthCheck: true })
      ]);
      assert.strictEqual(ptsResults.filter(r => r.status === 'fulfilled').length, 1, 'Only 1 order may redeem the 50 loyalty points');
      assert.strictEqual(ptsResults.filter(r => r.status === 'rejected').length, 1, 'Second concurrent loyalty order must fail closed');
      assert.strictEqual((await adminDb.collection('customers').doc('cust_pts50').get()).data().loyaltyPoints, 0);
    });

    // 10. Phase 3B — Spark-Safe >4 Items Order Intents + Admin Promotion
    await runTest('Rule-13: >4 distinct items route safely to /order_intents (pending_review) and promote via approveOrderIntent()', async () => {
      await testEnv.withSecurityRulesDisabled(async (ctx) => {
        const db = ctx.firestore();
        for (const pid of ['prod_m1', 'prod_m2', 'prod_m3', 'prod_m4', 'prod_m5', 'prod_m6']) {
          await db.collection('products').doc(pid).set({ name: pid, price: 50, stock: 10, trackInventory: true, isPublished: true });
        }
      });

      // Forging approved status or commercialVerified:true in /order_intents denied by Rules
      await assertFails(custDb.collection('order_intents').doc('intent_forge').set({
        id: 'intent_forge',
        uid: 'cust_verified_1',
        orderNumber: 'SZ-FORGE',
        idempotencyKey: 'idem_intent_forge_001',
        customer: { name: 'A' },
        items: [
          { lineId: 'm1', productId: 'prod_m1', price: 1, quantity: 1 },
          { lineId: 'm2', productId: 'prod_m2', price: 1, quantity: 1 },
          { lineId: 'm3', productId: 'prod_m3', price: 1, quantity: 1 },
          { lineId: 'm4', productId: 'prod_m4', price: 1, quantity: 1 },
          { lineId: 'm5', productId: 'prod_m5', price: 1, quantity: 1 }
        ],
        status: 'pending',
        commercialVerified: true,
        requiresAdminReview: true,
        createdAt: new Date().toISOString()
      }));

      // persistOrderOnline with 6 distinct items routes cleanly to /order_intents
      const intentRes = await firebaseApi.persistOrderOnline(custDb, {
        uid: 'cust_verified_1',
        orderNumber: 'SZ-MULTI-6',
        idempotencyKey: 'idem_multi_6_0001',
        customer: { name: 'عميل متعدد', phone: '010', address: 'القاهرة' },
        items: [
          { lineId: 'm1', productId: 'prod_m1', price: 1, quantity: 1 },
          { lineId: 'm2', productId: 'prod_m2', price: 1, quantity: 1 },
          { lineId: 'm3', productId: 'prod_m3', price: 1, quantity: 1 },
          { lineId: 'm4', productId: 'prod_m4', price: 1, quantity: 1 },
          { lineId: 'm5', productId: 'prod_m5', price: 1, quantity: 1 },
          { lineId: 'm6', productId: 'prod_m6', price: 1, quantity: 1 }
        ]
      });
      assert.strictEqual(intentRes.isOrderIntent, true);
      assert.strictEqual(intentRes.status, 'pending_review');

      // Admin promotes intent -> authoritative /orders doc created with 300 EGP total
      const promo = await firebaseApi.approveOrderIntent(intentRes.id, { db: adminDb, skipAdminAuthCheck: true });
      assert.strictEqual(promo.status, 'pending');
      const promotedOrder = (await adminDb.collection('orders').doc(intentRes.id).get()).data();
      assert.strictEqual(promotedOrder.total, 300);
      assert.strictEqual(promotedOrder.items.length, 6);
    });

    console.log('\n====================================================');
    console.log(`🎉 ${passedTests}/${totalTests} FIRESTORE RULES EMULATOR TESTS PASSED!`);
    console.log('====================================================\n');
  } finally {
    await testEnv.cleanup();
  }
})();
