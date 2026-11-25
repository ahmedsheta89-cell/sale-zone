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

      // Unauthenticated create & > 5 distinct items owner create
      await assertFails(anonDb.collection('orders').doc('ord_atk_unauth').set(directOrder('ord_atk_unauth')));
      await assertFails(custDb.collection('orders').doc('ord_atk_6items').set(directOrder('ord_atk_6items', {
        items: [
          { lineId: 'l1', productId: 'prod_pub_1', price: 250, quantity: 1 },
          { lineId: 'l2', productId: 'prod_pub_2', price: 100, quantity: 1 },
          { lineId: 'l3', productId: 'prod_pub_1', price: 250, quantity: 1 },
          { lineId: 'l4', productId: 'prod_pub_2', price: 100, quantity: 1 },
          { lineId: 'l5', productId: 'prod_pub_1', price: 250, quantity: 1 },
          { lineId: 'l6', productId: 'prod_pub_2', price: 100, quantity: 1 }
        ],
        subtotal: 1050,
        total: 1050
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

    console.log('\n====================================================');
    console.log(`🎉 ${passedTests}/${totalTests} FIRESTORE RULES EMULATOR TESTS PASSED!`);
    console.log('====================================================\n');
  } finally {
    await testEnv.cleanup();
  }
})();
