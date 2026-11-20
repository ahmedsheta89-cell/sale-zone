/**
 * tests/phase2-commerce-integrity.test.js
 * 
 * Comprehensive Test Suite for Phase 2:
 * - Deep Root-Cause Remediation, Commerce Integrity & System Integration
 * - Commercial Discrimination Union (found, not_found, read_failed, invalid_data)
 * - Strict Cost Price Isolation (never defaulting to retail price)
 * - Stale Stock Overwrite Prevention in updateProduct
 * - Strict Order-to-Inventory Line Identification (normalizeOrderLineItems)
 * - Return Receipt Workflow (createReturnReceipt, processReturnReceipt, quarantine ledger)
 * - Dual-Line Idempotent Inventory Deductions & Restocks
 * - Security Rules for Returns and Order Lifecycle Flags
 */

const assert = require('assert');
const fs = require('fs');
const path = require('path');

console.log('====================================================');
console.log('🧪 RUNNING PHASE 2: COMMERCE INTEGRITY & RETURNS TEST SUITE');
console.log('====================================================\n');

let passedTests = 0;
let totalTests = 0;

function runTest(name, fn) {
    totalTests++;
    try {
        fn();
        console.log(`✅ [PASS] ${name}`);
        passedTests++;
    } catch (err) {
        console.error(`❌ [FAIL] ${name}`);
        console.error(err);
        process.exitCode = 1;
    }
}

async function runAsyncTest(name, fn) {
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

function createMockFirestore() {
    const storage = new Map();

    function getCollectionMap(colName) {
        if (!storage.has(colName)) storage.set(colName, new Map());
        return storage.get(colName);
    }

    let transactionQueue = Promise.resolve();

    const db = {
        _storage: storage,
        collection(colName) {
            const col = getCollectionMap(colName);
            return {
                doc(docId) {
                    const subcollections = new Map();
                    return {
                        id: docId,
                        collection(subColName) {
                            if (!subcollections.has(subColName)) subcollections.set(subColName, new Map());
                            const subCol = subcollections.get(subColName);
                            return {
                                doc(subDocId) {
                                    return {
                                        id: subDocId,
                                        async get() {
                                            const item = subCol.get(subDocId);
                                            return {
                                                exists: item !== undefined,
                                                id: subDocId,
                                                data: () => (item ? JSON.parse(JSON.stringify(item)) : undefined)
                                            };
                                        },
                                        async set(data, opts) {
                                            const cur = subCol.get(subDocId) || {};
                                            subCol.set(subDocId, opts && opts.merge ? { ...cur, ...data } : { ...data });
                                        },
                                        async update(data) {
                                            const cur = subCol.get(subDocId) || {};
                                            subCol.set(subDocId, { ...cur, ...data });
                                        }
                                    };
                                }
                            };
                        },
                        async get() {
                            const item = col.get(docId);
                            return {
                                exists: item !== undefined,
                                id: docId,
                                data: () => (item ? JSON.parse(JSON.stringify(item)) : undefined)
                            };
                        },
                        async set(data, opts) {
                            const cur = col.get(docId) || {};
                            col.set(docId, opts && opts.merge ? { ...cur, ...data } : { ...data });
                        },
                        async update(data) {
                            const cur = col.get(docId) || {};
                            col.set(docId, { ...cur, ...data });
                        },
                        async delete() {
                            col.delete(docId);
                        }
                    };
                },
                async add(data) {
                    const autoId = 'auto_' + Math.random().toString(36).slice(2, 10);
                    col.set(autoId, JSON.parse(JSON.stringify(data)));
                    return { id: autoId };
                },
                where(field, op, value) {
                    let limitCount = null;
                    const makeQuery = () => ({
                        limit(n) { limitCount = n; return makeQuery(); },
                        async get() {
                            const matches = [];
                            col.forEach((val, id) => {
                                if (limitCount !== null && matches.length >= limitCount) return;
                                if (op === '==' && val[field] === value) {
                                    matches.push({
                                        id,
                                        data: () => JSON.parse(JSON.stringify(val)),
                                        ref: {
                                            id,
                                            async set(data, opts) {
                                                const current = col.get(id) || {};
                                                col.set(id, opts && opts.merge ? { ...current, ...data } : { ...data });
                                            },
                                            async update(data) {
                                                const current = col.get(id) || {};
                                                col.set(id, { ...current, ...data });
                                            },
                                            async get() {
                                                const cur = col.get(id);
                                                return {
                                                    exists: cur !== undefined,
                                                    id,
                                                    data: () => (cur ? JSON.parse(JSON.stringify(cur)) : undefined)
                                                };
                                            }
                                        }
                                    });
                                }
                            });
                            return {
                                size: matches.length,
                                empty: matches.length === 0,
                                docs: matches
                            };
                        }
                    });
                    return makeQuery();
                }
            };
        },
        async runTransaction(updateFn) {
            let release;
            const nextLock = new Promise(resolve => { release = resolve; });
            const currentLock = transactionQueue;
            transactionQueue = nextLock;
            await currentLock;
            try {
                const transaction = {
                    async get(docRef) { return await docRef.get(); },
                    async set(docRef, data, options) { await docRef.set(data, options); },
                    async update(docRef, data) { await docRef.update(data); }
                };
                return await updateFn(transaction);
            } finally {
                release();
            }
        }
    };
    return db;
}

(async () => {
    const firebaseApi = require('../assets/js/firebase-api.js');

    // =========================================================================
    // SECTION 1: COMMERCIAL DISCRIMINATED STATUS UNION
    // =========================================================================
    await runAsyncTest('Test P2-1.1: getProductCommercial returns "found" when document exists', async () => {
        const mockDb = createMockFirestore();
        await mockDb.collection('product_commercial').doc('prod_c1').set({
            costPrice: 45,
            supplierName: 'مورد معتمد'
        });

        const res = await firebaseApi.getProductCommercial('prod_c1', { db: mockDb });
        assert.strictEqual(res.status, 'found');
        assert.strictEqual(res.costPrice, 45);
        assert.strictEqual(res.supplierName, 'مورد معتمد');
    });

    await runAsyncTest('Test P2-1.2: getProductCommercial returns "not_found" when document does not exist', async () => {
        const mockDb = createMockFirestore();
        const res = await firebaseApi.getProductCommercial('prod_nonexistent', { db: mockDb });
        assert.strictEqual(res.status, 'not_found');
        assert.strictEqual(res.data, null);
    });

    await runAsyncTest('Test P2-1.3: getProductCommercial returns "invalid_data" for missing or empty productId', async () => {
        const res1 = await firebaseApi.getProductCommercial('');
        assert.strictEqual(res1.status, 'invalid_data');

        const res2 = await firebaseApi.getProductCommercial(null);
        assert.strictEqual(res2.status, 'invalid_data');
    });

    await runAsyncTest('Test P2-1.4: getProductCommercial returns "read_failed" when firestore throws', async () => {
        const faultyDb = {
            collection() {
                return {
                    doc() {
                        return {
                            async get() {
                                const err = new Error('Simulated network timeout');
                                err.code = 'unavailable';
                                throw err;
                            }
                        };
                    }
                };
            }
        };

        const res = await firebaseApi.getProductCommercial('prod_fail', { db: faultyDb });
        assert.strictEqual(res.status, 'read_failed');
        assert.strictEqual(res.code, 'unavailable');
        assert.ok(res.error.includes('Simulated network timeout'));
    });

    // =========================================================================
    // SECTION 2: SAFE COST PRICE ISOLATION IN mapProductFromSnapshot
    // =========================================================================
    runTest('Test P2-2.1: mapProductFromSnapshot preserves explicit costPrice and sets _commercialLoaded: true', () => {
        const fakeDoc = {
            id: 'p_cost_1',
            data: () => ({
                name: 'منتج بتكلفة حقيقية',
                price: 150,
                costPrice: 90,
                supplierId: 'sup_10'
            })
        };

        const mapped = firebaseApi.mapProductFromSnapshot(fakeDoc);
        assert.strictEqual(mapped.costPrice, 90);
        assert.strictEqual(mapped.price, 150);
        assert.strictEqual(mapped._commercialLoaded, true);
        assert.strictEqual(mapped.profitValue, 60); // 150 - 90 = 60
    });

    runTest('Test P2-2.2: mapProductFromSnapshot does NOT default costPrice to retail price', () => {
        const fakeDoc = {
            id: 'p_no_cost',
            data: () => ({
                name: 'منتج عام بدون بيانات تجارية',
                price: 200
            })
        };

        const mapped = firebaseApi.mapProductFromSnapshot(fakeDoc);
        assert.strictEqual(mapped.costPrice, undefined, 'costPrice must remain undefined, never defaulted to retail price');
        assert.strictEqual(mapped.price, 200);
        assert.strictEqual(mapped._commercialLoaded, false);
    });

    // =========================================================================
    // SECTION 3: STALE STOCK OVERWRITE PREVENTION IN updateProduct
    // =========================================================================
    await runAsyncTest('Test P2-3.1: updateProduct records inventory movement and deletes stock from public doc payload', async () => {
        const mockDb = createMockFirestore();
        await mockDb.collection('products').doc('p_stock_protect').set({
            name: 'سيروم حماية المخزون',
            price: 120,
            stock: 20,
            trackInventory: true
        });

        // Update product with stock change from 20 to 25
        await firebaseApi.updateProduct('p_stock_protect', {
            name: 'سيروم حماية المخزون المطور',
            stock: 25,
            trackInventory: true
        }, { db: mockDb, operatorUid: 'admin_audit' });

        const productNow = (await mockDb.collection('products').doc('p_stock_protect').get()).data();
        assert.strictEqual(productNow.stock, 25, 'Stock updated via ledger transaction');
        assert.strictEqual(productNow.name, 'سيروم حماية المخزون المطور');

        // Check ledger entry
        const ledgerSnap = (await mockDb.collection('inventory_ledger').where('productId', '==', 'p_stock_protect').get());
        assert.strictEqual(ledgerSnap.size, 1);
        const entry = ledgerSnap.docs[0].data();
        assert.strictEqual(entry.delta, 5);
        assert.strictEqual(entry.movementType, 'ADJUST_MANUAL_AUDIT');
    });

    // =========================================================================
    // SECTION 4: STRICT LINE ITEM VALIDATION IN normalizeOrderLineItems
    // =========================================================================
    runTest('Test P2-4.1: normalizeOrderLineItems validates non-empty productId', () => {
        assert.throws(() => {
            firebaseApi.normalizeOrderLineItems([{ id: '', quantity: 2, price: 50 }]);
        }, /missing productId/);

        assert.throws(() => {
            firebaseApi.normalizeOrderLineItems([{ quantity: 1, price: 10 }]);
        }, /missing productId/);
    });

    runTest('Test P2-4.2: normalizeOrderLineItems validates strictly positive integer quantity', () => {
        assert.throws(() => {
            firebaseApi.normalizeOrderLineItems([{ id: 'p1', quantity: 0, price: 50 }]);
        }, /positive integer/);

        assert.throws(() => {
            firebaseApi.normalizeOrderLineItems([{ id: 'p1', quantity: -3, price: 50 }]);
        }, /positive integer/);

        assert.throws(() => {
            firebaseApi.normalizeOrderLineItems([{ id: 'p1', quantity: 2.5, price: 50 }]);
        }, /positive integer/);
    });

    runTest('Test P2-4.3: normalizeOrderLineItems assigns unique lineIds to multiple lines with same productId', () => {
        const rawItems = [
            { productId: 'p_tshirt', name: 'تيشيرت أحمر M', quantity: 1, price: 100 },
            { productId: 'p_tshirt', name: 'تيشيرت أحمر L', quantity: 2, price: 100 }
        ];

        const normalized = firebaseApi.normalizeOrderLineItems(rawItems);
        assert.strictEqual(normalized.length, 2);
        assert.notStrictEqual(normalized[0].lineId, normalized[1].lineId, 'Line IDs must be unique');
        assert.strictEqual(normalized[0].lineTotal, 100);
        assert.strictEqual(normalized[1].lineTotal, 200);
    });

    // =========================================================================
    // SECTION 5: RETURN RECEIPT LIFECYCLE & QUARANTINE LEDGER
    // =========================================================================
    await runAsyncTest('Test P2-5.1: createReturnReceipt creates receipt document in /returns collection', async () => {
        const mockDb = createMockFirestore();
        await mockDb.collection('orders').doc('ord_ret_001').set({
            id: 'ord_ret_001',
            status: 'delivered',
            items: [{ productId: 'p_cream', quantity: 2, price: 50 }]
        });

        const receipt = await firebaseApi.createReturnReceipt({
            orderId: 'ord_ret_001',
            items: [
                { productId: 'p_cream', requestedQty: 2, receivedQty: 2, sellableQty: 1, damagedQty: 1 }
            ],
            returnReason: 'منتج تالف جزئياً',
            receivedBy: 'warehouse_clerk_1'
        }, { db: mockDb });

        assert.ok(receipt.returnId.startsWith('ret_'));
        assert.strictEqual(receipt.orderId, 'ord_ret_001');
        assert.strictEqual(receipt.status, 'pending_processing');

        const savedDoc = (await mockDb.collection('returns').doc(receipt.returnId).get()).data();
        assert.strictEqual(savedDoc.status, 'pending_processing');
        assert.strictEqual(savedDoc.items[0].damagedQty, 1);
        assert.strictEqual(savedDoc.items[0].sellableQty, 1);
    });

    await runAsyncTest('Test P2-5.2: processReturnReceipt restocks sellable items and logs damaged items to quarantine ledger', async () => {
        const mockDb = createMockFirestore();
        await mockDb.collection('products').doc('p_perfume').set({
            name: 'عطر فرنسي فاخر',
            stock: 5,
            trackInventory: true
        });
        await mockDb.collection('orders').doc('ord_ret_002').set({
            id: 'ord_ret_002',
            status: 'delivered',
            items: [{ productId: 'p_perfume', lineId: 'line_perfume_1', quantity: 3, price: 200 }]
        });

        const receipt = await firebaseApi.createReturnReceipt({
            orderId: 'ord_ret_002',
            items: [
                {
                    productId: 'p_perfume',
                    lineId: 'line_perfume_1',
                    requestedQty: 3,
                    receivedQty: 3,
                    sellableQty: 2, // 2 intact -> back to stock
                    damagedQty: 1   // 1 broken during transit -> quarantine
                }
            ],
            returnReason: 'كسر زجاجة أثناء الشحن',
            receivedBy: 'inspector_7'
        }, { db: mockDb });

        const processResult = await firebaseApi.processReturnReceipt(receipt.returnId, { db: mockDb });
        assert.strictEqual(processResult.success, true);

        // Available warehouse stock: only sellableQty (2) added: 5 + 2 = 7
        const productAfter = (await mockDb.collection('products').doc('p_perfume').get()).data();
        assert.strictEqual(productAfter.stock, 7, 'Warehouse stock must increase by exactly sellableQty (2)');

        // Check movements: 1 IN_ORDER_RETURNED and 1 OUT_DAMAGED_EXPIRED
        const sellableLedger = (await mockDb.collection('inventory_ledger').doc(`inv_p_perfume_return_${receipt.returnId}_line_line_perfume_1_sellable`).get()).data();
        assert.strictEqual(sellableLedger.movementType, 'IN_ORDER_RETURNED');
        assert.strictEqual(sellableLedger.delta, 2);

        const damagedLedger = (await mockDb.collection('inventory_ledger').doc(`inv_p_perfume_return_${receipt.returnId}_line_line_perfume_1_damaged`).get()).data();
        assert.strictEqual(damagedLedger.movementType, 'OUT_DAMAGED_EXPIRED');
        assert.strictEqual(damagedLedger.delta, 0, 'Quarantine movement must have delta 0 so stock is not altered');

        // Check receipt status
        const receiptAfter = (await mockDb.collection('returns').doc(receipt.returnId).get()).data();
        assert.strictEqual(receiptAfter.status, 'completed');
    });

    await runAsyncTest('Test P2-5.3: processReturnReceipt is strictly idempotent', async () => {
        const mockDb = createMockFirestore();
        await mockDb.collection('products').doc('p_idem_item').set({ name: 'كريم مرطب', stock: 10, trackInventory: true });
        await mockDb.collection('orders').doc('ord_idem_test').set({
            id: 'ord_idem_test',
            status: 'delivered',
            items: [{ productId: 'p_idem_item', lineId: 'l1', quantity: 1, price: 30 }]
        });

        const receipt = await firebaseApi.createReturnReceipt({
            orderId: 'ord_idem_test',
            items: [{ productId: 'p_idem_item', lineId: 'l1', requestedQty: 1, receivedQty: 1, sellableQty: 1, damagedQty: 0 }]
        }, { db: mockDb });

        await firebaseApi.processReturnReceipt(receipt.returnId, { db: mockDb });
        let stock1 = (await mockDb.collection('products').doc('p_idem_item').get()).data().stock;
        assert.strictEqual(stock1, 11);

        // Second call on already completed receipt
        const secondResult = await firebaseApi.processReturnReceipt(receipt.returnId, { db: mockDb });
        assert.strictEqual(secondResult.duplicate, true);
        let stock2 = (await mockDb.collection('products').doc('p_idem_item').get()).data().stock;
        assert.strictEqual(stock2, 11, 'Stock must not increase on duplicate call');
    });

    // =========================================================================
    // SECTION 6: MULTI-LINE ORDER INVENTORY DEDUCTION WITHOUT COLLISION
    // =========================================================================
    await runAsyncTest('Test P2-6.1: Deduct inventory for multi-line order with same productId without collision', async () => {
        const mockDb = createMockFirestore();
        await mockDb.collection('products').doc('p_shirt_multiline').set({
            name: 'قميص صيفي',
            stock: 20,
            trackInventory: true
        });

        const orderId = 'ord_multiline_deduct_1';
        await mockDb.collection('orders').doc(orderId).set({
            orderNumber: 'SZ-MULTI-01',
            status: 'pending',
            items: [
                { lineId: 'line_size_s', productId: 'p_shirt_multiline', quantity: 2, price: 150 },
                { lineId: 'line_size_xl', productId: 'p_shirt_multiline', quantity: 3, price: 150 }
            ],
            inventoryDeducted: false
        });

        await firebaseApi.updateOrderStatus(orderId, 'confirmed', { db: mockDb, skipAdminAuthCheck: true });

        const product = (await mockDb.collection('products').doc('p_shirt_multiline').get()).data();
        assert.strictEqual(product.stock, 15, 'Total 5 items deducted (20 - 2 - 3 = 15)');

        const order = (await mockDb.collection('orders').doc(orderId).get()).data();
        assert.strictEqual(order.inventoryDeducted, true);
        assert.ok(order.deductedLineIds.includes('line_size_s'));
        assert.ok(order.deductedLineIds.includes('line_size_xl'));

        // Check both ledgers exist independently
        const l1 = (await mockDb.collection('inventory_ledger').doc(`inv_p_shirt_multiline_order_${orderId}_item_line_size_s_deduct`).get());
        const l2 = (await mockDb.collection('inventory_ledger').doc(`inv_p_shirt_multiline_order_${orderId}_item_line_size_xl_deduct`).get());
        assert.ok(l1.exists, 'Ledger for line_size_s must exist');
        assert.ok(l2.exists, 'Ledger for line_size_xl must exist');
    });

    // =========================================================================
    // SECTION 7: FIRESTORE SECURITY RULES CONTRACT FOR PHASE 2
    // =========================================================================
    runTest('Test P2-7.1: firestore.rules declares /returns collection with admin and owner read access', () => {
        const rulesPath = path.join(__dirname, '../firestore.rules');
        const content = fs.readFileSync(rulesPath, 'utf8');

        assert.ok(content.includes('match /returns/{returnId}'), 'Must have match block for /returns/{returnId}');
        assert.ok(content.includes('allow delete: if false;'), 'Returns must be immutable/non-deletable');
        assert.ok(content.includes('allow create, update: if isAdmin()'), 'Only admin can create or update returns');
    });

    runTest('Test P2-7.2: firestore.rules forbids client creation of Phase 2 lifecycle flags on orders', () => {
        const rulesPath = path.join(__dirname, '../firestore.rules');
        const content = fs.readFileSync(rulesPath, 'utf8');

        assert.ok(content.includes('inventoryStatus'), 'Rules must forbid client setting inventoryStatus');
        assert.ok(content.includes('returnReceiptId'), 'Rules must forbid client setting returnReceiptId');
        assert.ok(content.includes('returnVerified'), 'Rules must forbid client setting returnVerified');
        assert.ok(content.includes('deductedLineIds'), 'Rules must forbid client setting deductedLineIds');
        assert.ok(content.includes('restockedLineIds'), 'Rules must forbid client setting restockedLineIds');
    });

    console.log('\n====================================================');
    console.log(`🎉 ALL ${passedTests}/${totalTests} PHASE 2 COMMERCE INTEGRITY TESTS PASSED!`);
    console.log('====================================================\n');
})();
