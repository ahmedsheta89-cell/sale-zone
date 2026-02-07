// Firebase Data Initializer
// ==========================

// Initialize Firebase with sample data if empty
async function initializeFirebaseData() {
    try {
        // Check if products collection exists
        const productsSnapshot = await db.collection('products').get();
        
        if (productsSnapshot.empty) {
            console.log('🔥 Initializing Firebase with sample data...');
            
            // Sample Products
            const sampleProducts = [
                {
                    name: 'شامبو كيراتين فاخر',
                    desc: 'شامبو احترافي بالكيراتين لتنعيم الشعر',
                    category: 'عناية بالشعر',
                    price: 189,
                    oldPrice: 249,
                    image: 'https://images.unsplash.com/photo-1522337360788-8b13dee73837?w=400',
                    rating: 4.8,
                    ratingCount: 124,
                    stock: 50,
                    featured: true,
                    createdAt: new Date()
                },
                {
                    name: 'سيروم فيتامين C',
                    desc: 'سيروم مضاد للأكسدة للبشرة المشرقة',
                    category: 'عناية بالبشرة',
                    price: 299,
                    oldPrice: 399,
                    image: 'https://images.unsplash.com/photo-1620916566398-39f5a2b4c5d3?w=400',
                    rating: 4.9,
                    ratingCount: 89,
                    stock: 30,
                    featured: true,
                    createdAt: new Date()
                },
                {
                    name: 'حليب الأطفال المخصص',
                    desc: 'حليب طبيعي للأطفال من 0-6 أشهر',
                    category: 'العناية بالطفل',
                    price: 159,
                    oldPrice: 199,
                    image: 'https://images.unsplash.com/photo-1571019613454-1cb2f99b2d8b?w=400',
                    rating: 4.7,
                    ratingCount: 67,
                    stock: 40,
                    featured: false,
                    createdAt: new Date()
                },
                {
                    name: 'فيتامينات متعددة',
                    desc: 'مجموعة فيتامينات شاملة للصحة',
                    category: 'مكملات غذائية',
                    price: 129,
                    oldPrice: 169,
                    image: 'https://images.unsplash.com/photo-1571019613454-1cb2f99b2d8b?w=400',
                    rating: 4.6,
                    ratingCount: 203,
                    stock: 100,
                    featured: false,
                    createdAt: new Date()
                },
                {
                    name: 'كريم مرطب للوجه',
                    desc: 'كريم مرطب عميق للبشرة الجافة',
                    category: 'عناية بالبشرة',
                    price: 219,
                    oldPrice: 279,
                    image: 'https://images.unsplash.com/photo-1556228720-195a0242c97e?w=400',
                    rating: 4.8,
                    ratingCount: 156,
                    stock: 25,
                    featured: true,
                    createdAt: new Date()
                },
                {
                    name: 'بلسم الشعر المعالج',
                    desc: 'بلسم للشعر التالف والمجهد',
                    category: 'عناية بالشعر',
                    price: 139,
                    oldPrice: 179,
                    image: 'https://images.unsplash.com/photo-1522337360788-8b13dee73837?w=400',
                    rating: 4.5,
                    ratingCount: 98,
                    stock: 60,
                    featured: false,
                    createdAt: new Date()
                },
                {
                    name: 'زيت الأطفال اللطيف',
                    desc: 'زيت طبيعي لتدليك الأطفال',
                    category: 'العناية بالطفل',
                    price: 89,
                    oldPrice: 119,
                    image: 'https://images.unsplash.com/photo-1571019613454-1cb2f99b2d8b?w=400',
                    rating: 4.9,
                    ratingCount: 45,
                    stock: 80,
                    featured: false,
                    createdAt: new Date()
                }
            ];
            
            // Add products to Firestore
            for (const product of sampleProducts) {
                await db.collection('products').add(product);
            }
            
            console.log('✅ Sample products added to Firebase');
        }
        
        // Check if banners collection exists
        const bannersSnapshot = await db.collection('banners').get();
        
        if (bannersSnapshot.empty) {
            const sampleBanners = [
                {
                    title: 'خصم 30%',
                    subtitle: 'على جميع منتجات العناية بالشعر',
                    image: 'https://images.unsplash.com/photo-1522337360788-8b13dee73837?w=800',
                    link: '#hair-care',
                    active: true,
                    order: 1,
                    createdAt: new Date()
                },
                {
                    title: 'جديدنا',
                    subtitle: 'سيروم فيتامين C',
                    image: 'https://images.unsplash.com/photo-1620916566398-39f5a2b4c5d3?w=800',
                    link: '#skin-care',
                    active: true,
                    order: 2,
                    createdAt: new Date()
                }
            ];
            
            for (const banner of sampleBanners) {
                await db.collection('banners').add(banner);
            }
            
            console.log('✅ Sample banners added to Firebase');
        }
        
        // Check if coupons collection exists
        const couponsSnapshot = await db.collection('coupons').get();
        
        if (couponsSnapshot.empty) {
            const sampleCoupons = [
                {
                    code: 'WELCOME20',
                    discount: 20,
                    type: 'percentage',
                    minAmount: 100,
                    maxDiscount: 50,
                    usageLimit: 100,
                    usedCount: 0,
                    active: true,
                    expiresAt: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000), // 30 days
                    createdAt: new Date()
                },
                {
                    code: 'SALE50',
                    discount: 50,
                    type: 'fixed',
                    minAmount: 200,
                    usageLimit: 50,
                    usedCount: 0,
                    active: true,
                    expiresAt: new Date(Date.now() + 15 * 24 * 60 * 60 * 1000), // 15 days
                    createdAt: new Date()
                }
            ];
            
            for (const coupon of sampleCoupons) {
                await db.collection('coupons').add(coupon);
            }
            
            console.log('✅ Sample coupons added to Firebase');
        }
        
        console.log('🎉 Firebase initialization completed!');
        
    } catch (error) {
        console.error('❌ Firebase initialization error:', error);
    }
}

// Auto-initialize when Firebase is ready
if (typeof db !== 'undefined') {
    initializeFirebaseData();
} else {
    // Wait for Firebase to load
    setTimeout(initializeFirebaseData, 2000);
}
