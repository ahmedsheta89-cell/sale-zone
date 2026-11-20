const { test: base, expect } = require('@playwright/test');

// Export an extended test fixture
const test = base.extend({
  // Override page with pre-configured mock Firebase harness
  page: async ({ page }, use) => {
    // Intercept Google Firebase CDN scripts to prevent network calls and enforce our deterministic mock
    await page.route('**/firebasejs/**', (route) => {
      route.fulfill({
        status: 200,
        contentType: 'application/javascript',
        body: '/* mocked firebase cdn */'
      });
    });

    // Also block external images/analytics/fonts to keep tests blazing fast and 100% offline
    await page.route('**/{google-analytics,analytics,gtag,clarity}**', (route) => route.abort());

    // Inject Firebase mock into page context before ANY script runs
    await page.addInitScript(() => {
      const memoryStore = {
        products: {
          prod_shampoo_argan: {
            id: 'prod_shampoo_argan',
            name: 'شامبو الأرجان المغربي الأصلي',
            price: 250,
            retailPrice: 250,
            stock: 15,
            trackInventory: true,
            isPublished: true,
            category: 'شامبو',
            brand: 'Sale Zone Nature',
            image: 'icon-192.png',
            images: ['icon-192.png'],
            createdAt: '2026-01-01T00:00:00.000Z'
          },
          prod_collagen_cream: {
            id: 'prod_collagen_cream',
            name: 'كريم الكولاجين للوجه',
            price: 180,
            retailPrice: 180,
            stock: 8,
            trackInventory: true,
            isPublished: true,
            category: 'عناية بالبشرة',
            brand: 'Sale Zone Skin',
            image: 'icon-192.png',
            images: ['icon-192.png'],
            createdAt: '2026-01-02T00:00:00.000Z'
          },
          prod_unavailable_lotion: {
            id: 'prod_unavailable_lotion',
            name: 'لوشن ترطيب عميق',
            price: 90,
            retailPrice: 90,
            stock: 0,
            trackInventory: true,
            isPublished: true,
            category: 'عناية بالجسم',
            brand: 'Sale Zone Body',
            image: 'icon-192.png',
            images: ['icon-192.png'],
            createdAt: '2026-01-03T00:00:00.000Z'
          },
          prod_draft_unreleased: {
            id: 'prod_draft_unreleased',
            name: 'سيروم غير معتمد',
            price: 300,
            retailPrice: 300,
            stock: 10,
            trackInventory: true,
            isPublished: false,
            category: 'سيروم',
            image: 'icon-192.png',
            images: ['icon-192.png'],
            createdAt: '2026-01-04T00:00:00.000Z'
          }
        },
        product_commercial: {
          prod_shampoo_argan: { costPrice: 150 },
          prod_collagen_cream: { costPrice: 110 }
        },
        coupons: {
          coupon_sale10: {
            id: 'coupon_sale10',
            code: 'SALE10',
            type: 'percentage',
            discount: 10,
            minOrderAmount: 100,
            active: true,
            usageLimit: 50,
            usedCount: 2
          },
          coupon_expired: {
            id: 'coupon_expired',
            code: 'EXPIRED20',
            type: 'percentage',
            discount: 20,
            minOrderAmount: 50,
            active: true,
            expiresAt: '2020-01-01T00:00:00.000Z'
          }
        },
        orders: {},
        returns: {},
        inventory_ledger: {},
        users: {
          admin_test_1: {
            uid: 'admin_test_1',
            email: 'admin@salezone.com',
            emailVerified: true,
            role: 'admin',
            name: 'مدير النظام'
          },
          cust_test_1: {
            uid: 'cust_test_1',
            email: 'customer@salezone.com',
            emailVerified: true,
            role: 'customer',
            name: 'أحمد علي',
            phone: '01012345678',
            address: '12 شارع النصر، القاهرة'
          }
        },
        site_content: {
          banners: {
            items: [
              {
                id: 'b1',
                title: 'عروض الخريف',
                text: 'خصومات تصل إلى 40%',
                buttonText: 'تسوق الآن',
                category: 'all',
                active: true
              }
            ]
          }
        }
      };

      const usersMap = {
        'admin@salezone.com': {
          uid: 'admin_test_1',
          email: 'admin@salezone.com',
          emailVerified: true,
          role: 'admin',
          reload: async () => {},
          getIdTokenResult: async () => ({ claims: { admin: true, role: 'admin' } }),
          getIdToken: async () => 'mock-admin-token'
        },
        'customer@salezone.com': {
          uid: 'cust_test_1',
          email: 'customer@salezone.com',
          emailVerified: true,
          role: 'customer',
          reload: async () => {},
          getIdTokenResult: async () => ({ claims: { role: 'customer' } }),
          getIdToken: async () => 'mock-customer-token'
        }
      };

      // Check if page URL indicates admin
      const isAdminPage = decodeURIComponent(window.location.pathname || '').includes('ادمن_2');
      let currentUser = isAdminPage ? usersMap['admin@salezone.com'] : usersMap['customer@salezone.com'];

      if (isAdminPage) {
        try {
          sessionStorage.setItem('adminLoggedIn', 'true');
          sessionStorage.setItem('adminSessionId', 'sess_test_123');
          sessionStorage.setItem('adminSession', JSON.stringify({ email: 'admin@salezone.com', role: 'admin' }));
        } catch (_) {}
      } else {
        window.currentUser = {
          uid: 'cust_test_1',
          id: 'cust_test_1',
          email: 'customer@salezone.com',
          emailVerified: true,
          name: 'أحمد علي',
          phone: '01012345678',
          address: '12 شارع النصر، القاهرة'
        };
      }

      const authListeners = [];

      const mockAuth = {
        get currentUser() {
          return currentUser;
        },
        signInWithEmailAndPassword: async (email, pass) => {
          const user = usersMap[String(email).trim().toLowerCase()];
          if (!user || pass !== 'correct-password-123') {
            const err = new Error('auth/invalid-credential');
            err.code = 'auth/invalid-credential';
            throw err;
          }
          currentUser = user;
          authListeners.forEach(fn => fn(currentUser));
          return { user };
        },
        signOut: async () => {
          currentUser = null;
          authListeners.forEach(fn => fn(null));
        },
        onAuthStateChanged: (cb) => {
          authListeners.push(cb);
          setTimeout(() => cb(currentUser), 0);
          return () => {
            const idx = authListeners.indexOf(cb);
            if (idx !== -1) authListeners.splice(idx, 1);
          };
        },
        setPersistence: async () => {},
        Auth: {
          Persistence: {
            LOCAL: 'LOCAL',
            SESSION: 'SESSION',
            NONE: 'NONE'
          }
        }
      };

      function createDocRef(collName, docId) {
        return {
          id: docId,
          path: `${collName}/${docId}`,
          get: async () => {
            const coll = memoryStore[collName] || {};
            const data = coll[docId];
            return {
              id: docId,
              exists: data !== undefined && data !== null,
              data: () => (data ? JSON.parse(JSON.stringify(data)) : undefined)
            };
          },
          set: async (val, setOptions = {}) => {
            if (!memoryStore[collName]) memoryStore[collName] = {};
            if (setOptions && setOptions.merge && memoryStore[collName][docId]) {
              memoryStore[collName][docId] = {
                ...memoryStore[collName][docId],
                ...JSON.parse(JSON.stringify(val))
              };
            } else {
              memoryStore[collName][docId] = JSON.parse(JSON.stringify(val));
            }
            if (collName === 'orders' && Array.isArray(window.orders)) {
              const existingIdx = window.orders.findIndex(x => String(x.id) === String(docId));
              if (existingIdx !== -1) window.orders[existingIdx] = memoryStore[collName][docId];
              else window.orders.push(memoryStore[collName][docId]);
            }
          },
          update: async (patch) => {
            if (!memoryStore[collName] || !memoryStore[collName][docId]) {
              const err = new Error(`Document ${collName}/${docId} not found`);
              err.code = 'not-found';
              throw err;
            }
            memoryStore[collName][docId] = {
              ...memoryStore[collName][docId],
              ...JSON.parse(JSON.stringify(patch))
            };
            if (collName === 'orders' && Array.isArray(window.orders)) {
              const existingIdx = window.orders.findIndex(x => String(x.id) === String(docId));
              if (existingIdx !== -1) window.orders[existingIdx] = memoryStore[collName][docId];
            }
          },
          delete: async () => {
            if (memoryStore[collName]) {
              delete memoryStore[collName][docId];
            }
          }
        };
      }

      function createQuery(collName, filters = [], limitCount = null) {
        return {
          where: (field, op, val) => {
            return createQuery(collName, [...filters, { field, op, val }], limitCount);
          },
          limit: (n) => {
            return createQuery(collName, filters, n);
          },
          orderBy: () => {
            return createQuery(collName, filters, limitCount);
          },
          get: async () => {
            const coll = memoryStore[collName] || {};
            let docs = Object.entries(coll).map(([id, data]) => ({
              id,
              exists: true,
              data: () => JSON.parse(JSON.stringify(data))
            }));

            for (const f of filters) {
              docs = docs.filter(doc => {
                const d = doc.data();
                const actual = d[f.field];
                if (f.op === '==') return actual === f.val;
                if (f.op === '!=') return actual !== f.val;
                if (f.op === 'in') return Array.isArray(f.val) && f.val.includes(actual);
                return true;
              });
            }

            if (limitCount !== null) {
              docs = docs.slice(0, limitCount);
            }

            return {
              docs,
              empty: docs.length === 0,
              size: docs.length,
              forEach: (fn) => docs.forEach(fn)
            };
          },
          onSnapshot: (cb) => {
            setTimeout(async () => {
              const res = await createQuery(collName, filters, limitCount).get();
              cb(res);
            }, 10);
            return () => {};
          }
        };
      }

      function createCollectionRef(collName) {
        const baseQuery = createQuery(collName);
        return {
          ...baseQuery,
          doc: (docId) => {
            const id = docId || `auto_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
            return createDocRef(collName, id);
          },
          add: async (data) => {
            const id = `auto_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
            const ref = createDocRef(collName, id);
            await ref.set(data);
            return ref;
          }
        };
      }

      const mockFirestore = {
        collection: (name) => createCollectionRef(name),
        doc: (pathStr) => {
          const parts = pathStr.split('/');
          return createDocRef(parts[0], parts[1]);
        },
        runTransaction: async (updateFunction) => {
          const transaction = {
            get: async (docRef) => docRef.get(),
            set: (docRef, data, opts) => docRef.set(data, opts),
            update: (docRef, patch) => docRef.update(patch),
            delete: (docRef) => docRef.delete()
          };
          return updateFunction(transaction);
        },
        batch: () => {
          const ops = [];
          return {
            set: (docRef, data, opts) => ops.push(() => docRef.set(data, opts)),
            update: (docRef, patch) => ops.push(() => docRef.update(patch)),
            delete: (docRef) => ops.push(() => docRef.delete()),
            commit: async () => {
              for (const op of ops) await op();
            }
          };
        },
        settings: () => {},
        setLogLevel: () => {},
        enableNetwork: async () => {},
        disableNetwork: async () => {}
      };

      const firebaseApp = {
        apps: [{ name: '[DEFAULT]' }],
        initializeApp: () => firebaseApp,
        auth: () => mockAuth,
        firestore: () => mockFirestore
      };
      mockAuth.Auth = { Persistence: { LOCAL: 'LOCAL', SESSION: 'SESSION', NONE: 'NONE' } };
      firebaseApp.auth.Auth = mockAuth.Auth;
      firebaseApp.firestore.FieldValue = {
        serverTimestamp: () => new Date().toISOString(),
        increment: (n) => n,
        arrayUnion: (x) => [x]
      };

      window.firebase = firebaseApp;
      window.db = mockFirestore;

      // Seed global store coupons array so store UI can find them
      window.coupons = Object.values(memoryStore.coupons);

      // Expose Bridge for Track C Verification & Control
      window.__TEST_BRIDGE__ = {
        memoryStore,
        setRole: (role) => {
          if (role === 'admin') {
            currentUser = usersMap['admin@salezone.com'];
            try {
              sessionStorage.setItem('adminLoggedIn', 'true');
              sessionStorage.setItem('adminSessionId', 'sess_test_123');
              sessionStorage.setItem('adminSession', JSON.stringify({ email: 'admin@salezone.com', role: 'admin' }));
            } catch (_) {}
          } else if (role === 'customer') {
            currentUser = usersMap['customer@salezone.com'];
            try {
              sessionStorage.removeItem('adminLoggedIn');
              sessionStorage.removeItem('adminSessionId');
              sessionStorage.removeItem('adminSession');
            } catch (_) {}
          } else {
            currentUser = null;
            try {
              sessionStorage.removeItem('adminLoggedIn');
              sessionStorage.removeItem('adminSessionId');
              sessionStorage.removeItem('adminSession');
            } catch (_) {}
          }
          authListeners.forEach(fn => fn(currentUser));
        },
        getCollection: (collName) => {
          const coll = memoryStore[collName] || {};
          return Object.entries(coll).map(([id, data]) => ({ id, ...data }));
        },
        getDocument: (collName, id) => {
          const coll = memoryStore[collName] || {};
          return coll[id] ? JSON.parse(JSON.stringify(coll[id])) : null;
        },
        setDocument: (collName, id, data) => {
          if (!memoryStore[collName]) memoryStore[collName] = {};
          memoryStore[collName][id] = JSON.parse(JSON.stringify(data));
          if (collName === 'orders' && Array.isArray(window.orders)) {
            const existingIdx = window.orders.findIndex(x => String(x.id) === String(id));
            if (existingIdx !== -1) window.orders[existingIdx] = memoryStore[collName][id];
            else window.orders.push(memoryStore[collName][id]);
          }
        }
      };
    });

    await use(page);
  }
});

module.exports = { test, expect };
