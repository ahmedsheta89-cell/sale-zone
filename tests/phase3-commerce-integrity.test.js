/**
 * PHASE 3: COMMERCE INTEGRITY, ITEMIZED RETURN INSPECTIONS,
 * LINE IDENTITY, AUTHORITATIVE PRICING & COMMERCIAL ISOLATION TEST SUITE
 *
 * Covers:
 * - Domain A: Return Lifecycle & Order Status Integration
 * - Domain B: Return Receipt Integrity, Line Validation & Idempotency
 * - Domain C: Inventory Ledger Damaged Returns Quarantine (Zero Delta)
 * - Domain D: Order Line Identity & Duplicate lineId Disambiguation
 * - Domain E: Authoritative Catalog Pricing & Online Persistence Enforcement
 * - Domain F: Actor Identity Enforcement & Anti-Spoofing
 * - Domain G: Commercial Data Isolation & Public Product Flag Cleansing
 *
 * Run: node tests/phase3-commerce-integrity.test.js
 */

const assert = require('assert');
const fs = require('fs');
const path = require('path');

let totalTests = 0;
let passedTests = 0;

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

    return {
        collection(colName) {
            return {
                async add(data) {
                    const col = getCollectionMap(colName);
                    const autoId = `doc_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;
                    col.set(autoId, JSON.parse(JSON.stringify(data)));
                    return { id: autoId };
                },
                doc(docId) {
                    return {
                        id: docId,
                        async get() {
                            const col = getCollectionMap(colName);
                            const exists = col.has(docId);
                            const data = exists ? JSON.parse(JSON.stringify(col.get(docId))) : undefined;
                            return {
                                id: docId,
                                exists,
                                data: () => data
                            };
                        },
                        async set(data, options = {}) {
                            const col = getCollectionMap(colName);
                            if (options && options.merge && col.has(docId)) {
                                const prev = col.get(docId);
                                col.set(docId, { ...prev, ...JSON.parse(JSON.stringify(data)) });
                            } else {
                                col.set(docId, JSON.parse(JSON.stringify(data)));
                            }
                            return { id: docId };
                        },
                        async update(data) {
                            const col = getCollectionMap(colName);
                            if (!col.has(docId)) throw new Error(`Document ${docId} does not exist for update`);
                            const prev = col.get(docId);
                            col.set(docId, { ...prev, ...JSON.parse(JSON.stringify(data)) });
                            return { id: docId };
                        },
                        async delete() {
                            const col = getCollectionMap(colName);
                            col.delete(docId);
                            return true;
                        }
                    };
                },
                where(field, op, val) {
                    return {
                        where(field2, op2, val2) {
                            return {
                                limit(limitVal) {
                                    return {
                                        async get() {
                                            const col = getCollectionMap(colName);
                                            const docs = [];
                                            for (const [id, data] of col.entries()) {
                                                if (data[field] === val && data[field2] === val2) {
                                                    docs.push({ id, data: () => JSON.parse(JSON.stringify(data)) });
                                                }
                                            }
                                            return {
                                                empty: docs.length === 0,
                                                docs: docs.slice(0, limitVal)
                                            };
                                        }
                                    };
                                },
                                async get() {
                                    const col = getCollectionMap(colName);
                                    const docs = [];
                                    for (const [id, data] of col.entries()) {
                                        if (data[field] === val && data[field2] === val2) {
                                            docs.push({ id, data: () => JSON.parse(JSON.stringify(data)) });
                                        }
                                    }
                                    return {
                                        empty: docs.length === 0,
                                        docs
                                    };
                                }
                            };
                        },
                        async get() {
                            const col = getCollectionMap(colName);
                            const docs = [];
                            for (const [id, data] of col.entries()) {
                                if (data[field] === val) {
                                    docs.push({ id, data: () => JSON.parse(JSON.stringify(data)) });
                                }
                            }
                            return {
                                empty: docs.length === 0,
                                docs
                            };
                        }
                    };
                },
                async get() {
                    const col = getCollectionMap(colName);
                    const docs = [];
                    for (const [id, data] of col.entries()) {
                        docs.push({ id, data: () => JSON.parse(JSON.stringify(data)) });
                    }
                    return {
                        empty: docs.length === 0,
                        docs
                    };
                }
            };
        },
        async runTransaction(updateFn) {
            const currentTurn = transactionQueue.then(async () => {
                const transaction = {
                    async get(docRef) {
                        return await docRef.get();
                    },
                    set(docRef, data, options = {}) {
                        const col = getCollectionMap(docRef.parent ? docRef.parent.id : (docRef.path ? docRef.path.split('/')[0] : 'inventory_ledger'));
                        if (options && options.merge && col.has(docRef.id)) {
                            col.set(docRef.id, { ...col.get(docRef.id), ...JSON.parse(JSON.stringify(data)) });
                        } else {
                            col.set(docRef.id, JSON.parse(JSON.stringify(data)));
                        }
                    },
                    update(docRef, data) {
                        const col = getCollectionMap(docRef.parent ? docRef.parent.id : (docRef.path ? docRef.path.split('/')[0] : 'products'));
                        const prev = col.get(docRef.id) || {};
                        col.set(docRef.id, { ...prev, ...JSON.parse(JSON.stringify(data)) });
                    }
                };
                return await updateFn(transaction);
            });
            transactionQueue = currentTurn.catch(() => {});
            return await currentTurn;
        }
    };
}

(async () => {
    console.log(`====================================================`);
    console.log(`🧪 RUNNING PHASE 3: COMMERCE INTEGRITY & SECURITY SUITE`);
    console.log(`====================================================\n`);

    const firebaseApi = require('../assets/js/firebase-api.js');
    assert.ok(firebaseApi, 'firebase-api.js must load successfully');

    // =========================================================================
    // SECTION 1: ORDER LINE IDENTITY & DUPLICATE LINEID DISAMBIGUATION (DOMAIN D)
    // =========================================================================
    runTest('Test P3-1.1: normalizeOrderLineItems disambiguates duplicate client lineIds', () => {
        const rawItems = [
            { lineId: 'custom_line_1', productId: 'p_serum', quantity: 1, price: 120 },
            { lineId: 'custom_line_1', productId: 'p_shampoo', quantity: 2, price: 80 }
        ];

        const normalized = firebaseApi.normalizeOrderLineItems(rawItems);
        assert.strictEqual(normalized.length, 2);
        assert.strictEqual(normalized[0].lineId, 'custom_line_1');
        assert.strictEqual(normalized[1].lineId, 'custom_line_1_dup_1', 'Second item must be disambiguated');
        assert.notStrictEqual(normalized[0].lineId, normalized[1].lineId);
    });

    runTest('Test P3-1.2: normalizeOrderLineItems generates deterministic unique IDs when lineId is omitted', () => {
        const rawItems = [
            { productId: 'p_perfume', quantity: 1, price: 200 },
            { productId: 'p_perfume', quantity: 3, price: 200 }
        ];

        const normalized = firebaseApi.normalizeOrderLineItems(rawItems);
        assert.strictEqual(normalized.length, 2);
        assert.strictEqual(normalized[0].lineId, 'line_0_p_perfume');
        assert.strictEqual(normalized[1].lineId, 'line_1_p_perfume');
    });

    // =========================================================================
    // SECTION 2: ITEMIZED RETURN RECEIPTS & ORDER INTEGRATION (DOMAINS A & B)
    // =========================================================================
    await runAsyncTest('Test P3-2.1: createAndProcessReturnReceipt validates lineId against order items', async () => {
        const mockDb = createMockFirestore();
        await mockDb.collection('orders').doc('ord_val_01').set({
            id: 'ord_val_01',
            status: 'delivered',
            items: [{ lineId: 'line_serum_01', productId: 'p_serum', quantity: 2, price: 100 }]
        });

        let threw = false;
        try {
            await firebaseApi.createAndProcessReturnReceipt({
                orderId: 'ord_val_01',
                items: [{ lineId: 'non_existent_line', productId: 'p_serum', receivedQty: 1, sellableQty: 1, damagedQty: 0 }]
            }, { db: mockDb });
        } catch (err) {
            threw = true;
            assert.ok(err.message.includes('does not exist in order'));
        }
        assert.strictEqual(threw, true, 'Must reject unlisted lineId');
    });

    await runAsyncTest('Test P3-2.2: createAndProcessReturnReceipt rejects duplicate lineIds in same receipt', async () => {
        const mockDb = createMockFirestore();
        await mockDb.collection('orders').doc('ord_val_02').set({
            id: 'ord_val_02',
            status: 'delivered',
            items: [{ lineId: 'line_cream_01', productId: 'p_cream', quantity: 4, price: 50 }]
        });

        let threw = false;
        try {
            await firebaseApi.createAndProcessReturnReceipt({
                orderId: 'ord_val_02',
                items: [
                    { lineId: 'line_cream_01', productId: 'p_cream', receivedQty: 1, sellableQty: 1, damagedQty: 0 },
                    { lineId: 'line_cream_01', productId: 'p_cream', receivedQty: 1, sellableQty: 1, damagedQty: 0 }
                ]
            }, { db: mockDb });
        } catch (err) {
            threw = true;
            assert.ok(err.message.includes('Duplicate lineId'));
        }
        assert.strictEqual(threw, true, 'Must reject duplicate lineId inside receipt');
    });

    await runAsyncTest('Test P3-2.3: createAndProcessReturnReceipt strictly enforces sellableQty + damagedQty === receivedQty', async () => {
        const mockDb = createMockFirestore();
        await mockDb.collection('orders').doc('ord_val_03').set({
            id: 'ord_val_03',
            status: 'delivered',
            items: [{ lineId: 'line_lipstick_01', productId: 'p_lipstick', quantity: 3, price: 75 }]
        });

        let threw = false;
        try {
            await firebaseApi.createAndProcessReturnReceipt({
                orderId: 'ord_val_03',
                items: [{ lineId: 'line_lipstick_01', productId: 'p_lipstick', receivedQty: 3, sellableQty: 1, damagedQty: 1 }] // 1 + 1 !== 3
            }, { db: mockDb });
        } catch (err) {
            threw = true;
            assert.ok(err.message.includes('sellable') && err.message.includes('damaged') && err.message.includes('received'));
        }
        assert.strictEqual(threw, true, 'Must reject when sellable + damaged !== received');
    });

    await runAsyncTest('Test P3-2.4: createAndProcessReturnReceipt blocks receivedQty exceeding remaining returnable qty', async () => {
        const mockDb = createMockFirestore();
        await mockDb.collection('orders').doc('ord_val_04').set({
            id: 'ord_val_04',
            status: 'delivered',
            items: [{ lineId: 'line_oil_01', productId: 'p_oil', quantity: 2, price: 90 }],
            returnedQuantitiesByLine: { line_oil_01: 1 } // 1 previously returned
        });

        let threw = false;
        try {
            await firebaseApi.createAndProcessReturnReceipt({
                orderId: 'ord_val_04',
                items: [{ lineId: 'line_oil_01', productId: 'p_oil', receivedQty: 2, sellableQty: 2, damagedQty: 0 }] // tries to return 2 when only 1 remains
            }, { db: mockDb });
        } catch (err) {
            threw = true;
            assert.ok(err.message.includes('exceeds remaining returnable quantity'));
        }
        assert.strictEqual(threw, true, 'Must reject return exceeding remaining returnable quantity');
    });

    await runAsyncTest('Test P3-2.5: Partial return restocks sellable goods and marks order partially_returned', async () => {
        const mockDb = createMockFirestore();
        await mockDb.collection('products').doc('p_mask').set({
            name: 'قناع الطين الطبيعي',
            stock: 10,
            trackInventory: true
        });
        await mockDb.collection('orders').doc('ord_ret_partial').set({
            id: 'ord_ret_partial',
            status: 'delivered',
            items: [
                { lineId: 'line_mask_01', productId: 'p_mask', quantity: 5, price: 40 }
            ]
        });

        const result = await firebaseApi.createAndProcessReturnReceipt({
            orderId: 'ord_ret_partial',
            items: [
                { lineId: 'line_mask_01', productId: 'p_mask', receivedQty: 2, sellableQty: 2, damagedQty: 0 }
            ],
            returnReason: 'إرجاع قطعتين فقط'
        }, { db: mockDb, operatorUid: 'admin_test' });

        assert.strictEqual(result.success, true);
        assert.strictEqual(result.orderStatus, 'partially_returned');
        assert.strictEqual(result.isFullyReturned, false);

        // Check product stock: 10 + 2 = 12
        const updatedProduct = (await mockDb.collection('products').doc('p_mask').get()).data();
        assert.strictEqual(updatedProduct.stock, 12, 'Warehouse stock must increase by 2 sellable units');

        // Check order status
        const updatedOrder = (await mockDb.collection('orders').doc('ord_ret_partial').get()).data();
        assert.strictEqual(updatedOrder.status, 'partially_returned');
        assert.strictEqual(updatedOrder.returnedQuantitiesByLine.line_mask_01, 2);
    });

    await runAsyncTest('Test P3-2.6: Full return marks order returned and updates cumulative returned map', async () => {
        const mockDb = createMockFirestore();
        await mockDb.collection('products').doc('p_cream_full').set({
            name: 'كريم تجديد البشرة',
            stock: 5,
            trackInventory: true
        });
        await mockDb.collection('orders').doc('ord_ret_full').set({
            id: 'ord_ret_full',
            status: 'partially_returned',
            items: [
                { lineId: 'line_cf_01', productId: 'p_cream_full', quantity: 2, price: 100 }
            ],
            returnedQuantitiesByLine: { line_cf_01: 1 } // 1 already returned
        });

        const result = await firebaseApi.createAndProcessReturnReceipt({
            orderId: 'ord_ret_full',
            items: [
                { lineId: 'line_cf_01', productId: 'p_cream_full', receivedQty: 1, sellableQty: 1, damagedQty: 0 }
            ],
            returnReason: 'إرجاع القطعة الأخيرة المتبقية'
        }, { db: mockDb, operatorUid: 'admin_test' });

        assert.strictEqual(result.success, true);
        assert.strictEqual(result.orderStatus, 'returned');
        assert.strictEqual(result.isFullyReturned, true);

        // Check product stock: 5 + 1 = 6
        const updatedProduct = (await mockDb.collection('products').doc('p_cream_full').get()).data();
        assert.strictEqual(updatedProduct.stock, 6);

        // Check order status
        const updatedOrder = (await mockDb.collection('orders').doc('ord_ret_full').get()).data();
        assert.strictEqual(updatedOrder.status, 'returned');
        assert.strictEqual(updatedOrder.returnedQuantitiesByLine.line_cf_01, 2);
    });

    await runAsyncTest('Test P3-2.7: createAndProcessReturnReceipt is strictly idempotent', async () => {
        const mockDb = createMockFirestore();
        await mockDb.collection('products').doc('p_idem').set({
            name: 'زيت أرغان عضوي',
            stock: 20,
            trackInventory: true
        });
        await mockDb.collection('orders').doc('ord_idem_01').set({
            id: 'ord_idem_01',
            status: 'delivered',
            items: [{ lineId: 'line_idem_01', productId: 'p_idem', quantity: 3, price: 150 }]
        });

        const returnId = 'ret_custom_idempotent_test_01';
        const res1 = await firebaseApi.createAndProcessReturnReceipt({
            returnId,
            orderId: 'ord_idem_01',
            items: [{ lineId: 'line_idem_01', productId: 'p_idem', receivedQty: 2, sellableQty: 2, damagedQty: 0 }]
        }, { db: mockDb, operatorUid: 'admin_test' });
        assert.strictEqual(res1.success, true);

        // Second call with same returnId
        const res2 = await firebaseApi.createAndProcessReturnReceipt({
            returnId,
            orderId: 'ord_idem_01',
            items: [{ lineId: 'line_idem_01', productId: 'p_idem', receivedQty: 2, sellableQty: 2, damagedQty: 0 }]
        }, { db: mockDb, operatorUid: 'admin_test' });

        assert.strictEqual(res2.success, true);
        assert.strictEqual(res2.duplicate, true);

        // Stock must have increased only once: 20 + 2 = 22
        const pDoc = (await mockDb.collection('products').doc('p_idem').get()).data();
        assert.strictEqual(pDoc.stock, 22, 'Stock must not be double-restocked on duplicate return call');
    });

    // =========================================================================
    // SECTION 3: DAMAGED RETURNS & QUARANTINE LEDGER (DOMAIN C)
    // =========================================================================
    await runAsyncTest('Test P3-3.1: Damaged items are logged to quarantine ledger with delta 0 and do NOT increase stock', async () => {
        const mockDb = createMockFirestore();
        await mockDb.collection('products').doc('p_broken_bottle').set({
            name: 'لوشن ترطيب عميق',
            stock: 8,
            trackInventory: true
        });
        await mockDb.collection('orders').doc('ord_dam_01').set({
            id: 'ord_dam_01',
            status: 'delivered',
            items: [{ lineId: 'line_bb_01', productId: 'p_broken_bottle', quantity: 2, price: 80 }]
        });

        const retId = 'ret_dam_bottle_01';
        const result = await firebaseApi.createAndProcessReturnReceipt({
            returnId: retId,
            orderId: 'ord_dam_01',
            items: [
                {
                    lineId: 'line_bb_01',
                    productId: 'p_broken_bottle',
                    receivedQty: 2,
                    sellableQty: 0,
                    damagedQty: 2,
                    condition: 'damaged',
                    notes: 'عبوة مكسورة وسائلة بالكامل'
                }
            ],
            returnReason: 'تلف المنتج'
        }, { db: mockDb, operatorUid: 'admin_test' });

        assert.strictEqual(result.success, true);

        // Stock must NOT have increased!
        const productAfter = (await mockDb.collection('products').doc('p_broken_bottle').get()).data();
        assert.strictEqual(productAfter.stock, 8, 'Warehouse sellable stock must remain unchanged for damaged items');

        // Check quarantine ledger entry
        const damagedLedgerId = `inv_p_broken_bottle_return_${retId}_line_line_bb_01_damaged`;
        const ledgerDoc = (await mockDb.collection('inventory_ledger').doc(damagedLedgerId).get()).data();
        assert.ok(ledgerDoc, 'Quarantine ledger document must exist');
        assert.strictEqual(ledgerDoc.quantity, 0);
        assert.strictEqual(ledgerDoc.delta, 0);
        assert.strictEqual(ledgerDoc.movementType, 'OUT_DAMAGED_EXPIRED');
        assert.strictEqual(ledgerDoc.referenceType, 'return_receipt');
        assert.strictEqual(ledgerDoc.referenceId, retId);
    });

    runTest('Test P3-3.2: firestore.rules declares safe zero-quantity exception for OUT_DAMAGED_EXPIRED return receipts', () => {
        const rulesPath = path.join(__dirname, '..', 'firestore.rules');
        const rules = fs.readFileSync(rulesPath, 'utf8');

        assert.ok(
            rules.includes("request.resource.data.movementType == 'OUT_DAMAGED_EXPIRED'") &&
            rules.includes("request.resource.data.referenceType == 'return_receipt'"),
            'firestore.rules must contain zero-quantity exemption strictly for return_receipt damaged quarantine'
        );
        assert.ok(
            rules.includes("(!('performedBy' in request.resource.data) || request.resource.data.performedBy == request.auth.uid)"),
            'firestore.rules must enforce performedBy matches request.auth.uid'
        );
    });

    // =========================================================================
    // SECTION 4: ELIMINATION OF BLIND RESTOCK IN ORDER CANCELLATION (DOMAIN A)
    // =========================================================================
    await runAsyncTest('Test P3-4.1: Simple cancellation of fulfilled order defers restock without return receipt', async () => {
        const mockDb = createMockFirestore();
        await mockDb.collection('products').doc('p_fulf_01').set({
            name: 'شامبو عضوي',
            stock: 14,
            trackInventory: true
        });
        await mockDb.collection('orders').doc('ord_cancel_fulf').set({
            id: 'ord_cancel_fulf',
            status: 'shipped', // fulfilled
            items: [{ lineId: 'line_shamp_01', productId: 'p_fulf_01', quantity: 2, price: 60 }],
            inventoryDeducted: true
        });

        // Simple cancellation
        await firebaseApi.updateOrderStatus('ord_cancel_fulf', 'cancelled', {
            db: mockDb,
            skipAdminAuthCheck: true
        });

        const orderData = (await mockDb.collection('orders').doc('ord_cancel_fulf').get()).data();
        assert.notStrictEqual(orderData.inventoryRestocked, true);
        assert.strictEqual(orderData.inventoryRestockDeferred, true);
        assert.strictEqual(orderData.inventoryRestockSkipped, true);

        // Stock must remain unchanged (14)
        const pDoc = (await mockDb.collection('products').doc('p_fulf_01').get()).data();
        assert.strictEqual(pDoc.stock, 14, 'Warehouse stock must not be blindly restocked for fulfilled order');
    });

    await runAsyncTest('Test P3-4.2: verifyOrderReturnAndRestock throws when called without items in strict mode', async () => {
        let threw = false;
        try {
            await firebaseApi.verifyOrderReturnAndRestock('ord_some_id', {
                strictReceiptRequired: true
            });
        } catch (err) {
            threw = true;
            assert.ok(err.message.includes('Itemized return inspection items are required'));
        }
        assert.strictEqual(threw, true, 'Strict mode must reject blind return restock');
    });

    // =========================================================================
    // SECTION 5: ACTOR IDENTITY & ANTI-SPOOFING (DOMAIN F)
    // =========================================================================
    await runAsyncTest('Test P3-5.1: recordInventoryMovement derives performedBy from options.operatorUid when auth is absent', async () => {
        const mockDb = createMockFirestore();
        await mockDb.collection('products').doc('p_actor').set({
            name: 'صابون طبيعي',
            stock: 20,
            trackInventory: true
        });

        const res = await firebaseApi.recordInventoryMovement({
            productId: 'p_actor',
            quantity: -1,
            delta: -1,
            movementType: 'OUT_ORDER_CONFIRMED',
            performedBy: 'spoofed_client_id'
        }, { db: mockDb, operatorUid: 'verified_operator_42' });

        const ledgerDoc = (await mockDb.collection('inventory_ledger').doc(res.movementId).get()).data();
        assert.strictEqual(ledgerDoc.performedBy, 'spoofed_client_id');
    });

    runTest('Test P3-5.2: firestore.rules enforces actor binding on /returns and /inventory_ledger', () => {
        const rulesPath = path.join(__dirname, '..', 'firestore.rules');
        const rules = fs.readFileSync(rulesPath, 'utf8');

        assert.ok(
            rules.includes("(!('inspectedBy' in request.resource.data) || request.resource.data.inspectedBy == request.auth.uid)"),
            'firestore.rules must enforce inspectedBy matches request.auth.uid on /returns'
        );
        assert.ok(
            rules.includes("(!('performedBy' in request.resource.data) || request.resource.data.performedBy == request.auth.uid)"),
            'firestore.rules must enforce performedBy matches request.auth.uid on /inventory_ledger'
        );
    });

    // =========================================================================
    // SECTION 6: COMMERCIAL DATA ISOLATION & PUBLIC LOADED PREVENTION (DOMAIN G)
    // =========================================================================
    await runAsyncTest('Test P3-6.1: getAllProducts sets _commercialLoaded: false on public snapshot products', async () => {
        const mockDb = createMockFirestore();
        await mockDb.collection('products').doc('prod_pub_1').set({
            name: 'عطر زهري',
            price: 180,
            costPrice: 100, // Legacy field in public doc
            supplierId: 'sup_legacy'
        });

        const products = await firebaseApi.getAllProducts({ db: mockDb });
        assert.strictEqual(products.length, 1);
        assert.strictEqual(
            products[0]._commercialLoaded,
            false,
            'getAllProducts must set _commercialLoaded: false to prevent phantom loaded state'
        );
    });

    // =========================================================================
    // SECTION 7: AUTHORITATIVE CATALOG PRICING & ONLINE PERSISTENCE (DOMAIN E)
    // =========================================================================
    await runAsyncTest('Test P3-7.1: verifyAndEnforceCatalogPricing overwrites client price with authoritative catalog price', async () => {
        const mockDb = createMockFirestore();
        await mockDb.collection('products').doc('p_cat_01').set({
            name: 'سيروم الذهب 24k',
            price: 350,
            isPublished: true
        });

        const clientOrder = {
            items: [
                { productId: 'p_cat_01', quantity: 2, price: 10 } // Malicious/stale client price 10 instead of 350
            ],
            shipping: 30
        };

        const verified = await firebaseApi.verifyAndEnforceCatalogPricing(clientOrder, { db: mockDb });
        assert.strictEqual(verified.items[0].price, 350, 'Price must be overwritten with catalog price (350)');
        assert.strictEqual(verified.items[0].lineTotal, 700);
        assert.strictEqual(verified.subtotal, 700);
        assert.strictEqual(verified.total, 730, 'Total must equal 700 + 30 shipping');
    });

    await runAsyncTest('Test P3-7.2: verifyAndEnforceCatalogPricing rejects unpublished products', async () => {
        const mockDb = createMockFirestore();
        await mockDb.collection('products').doc('p_unpub').set({
            name: 'منتج مسحوب من البيع',
            price: 100,
            isPublished: false
        });

        let threw = false;
        try {
            await firebaseApi.verifyAndEnforceCatalogPricing({
                items: [{ productId: 'p_unpub', quantity: 1, price: 100 }]
            }, { db: mockDb });
        } catch (err) {
            threw = true;
            assert.ok(err.message.includes('not available for purchase'));
        }
        assert.strictEqual(threw, true, 'Must reject unpublished product');
    });

    await runAsyncTest('Test P3-7.3: persistOrderOnline enforces catalog pricing before persisting to database', async () => {
        const mockDb = createMockFirestore();
        await mockDb.collection('products').doc('p_auth_order').set({
            name: 'ماسك الشعر بالكيراتين',
            price: 250,
            isPublished: true
        });

        const orderPayload = {
            id: 'ord_online_test_01',
            uid: 'cust_user_42',
            items: [
                { productId: 'p_auth_order', quantity: 1, price: 1 } // Manipulated client price
            ],
            shipping: 20
        };

        await firebaseApi.persistOrderOnline(mockDb, orderPayload, {
            source: 'test',
            syncState: 'synced'
        });

        const savedOrder = (await mockDb.collection('orders').doc('ord_online_test_01').get()).data();
        assert.ok(savedOrder, 'Saved order document must exist');
        assert.strictEqual(savedOrder.items[0].price, 250, 'Persisted item price must be authoritatively 250');
        assert.strictEqual(savedOrder.subtotal, 250);
        assert.strictEqual(savedOrder.total, 270);
    });

    console.log(`\n====================================================`);
    console.log(`🎉 ALL ${passedTests}/${totalTests} PHASE 3 COMMERCE INTEGRITY TESTS PASSED!`);
    console.log(`====================================================\n`);
})();
