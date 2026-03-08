function silentProductionLog() {}
function silentProductionInfo() {}

// smart-features.js - Smart Features for Sale Zone Store
// ===================================================
// 🧠 ميزات ذكية لإضافة وظائف جديدة دون هدم الموجود

// ==========================================
// 🤖 AI-Powered Product Recommendations
// ==========================================

class SmartRecommendations {
    constructor() {
        this.userBehavior = this.loadUserBehavior();
        this.productCategories = this.loadProductCategories();
    }
    
    loadUserBehavior() {
        return EnhancedData.getItem('userBehavior', {
            viewedProducts: [],
            searchHistory: [],
            cartHistory: [],
            favorites: [],
            clicks: []
        });
    }
    
    loadProductCategories() {
        // Load product categories for recommendations
        return {
            'hair-care': ['شامبو', 'بلسم', 'زيوت', 'صبغات'],
            'skin-care': ['كريمات', 'غسول', 'مقشرات', 'أقنعة'],
            'baby-care': ['شامبو أطفال', 'كريمات أطفال', 'زيوت أطفال'],
            'supplements': ['فيتامينات', 'معادن', 'بروتينات'],
            'medical': ['أدوية', 'مستلزمات طبية', 'عناية صحية']
        };
    }
    
    trackUserAction(action, productId, data = {}) {
        const timestamp = Date.now();
        this.userBehavior[`${action}History`].push({
            productId,
            timestamp,
            ...data
        });
        
        // Keep only last 100 actions per type
        if (this.userBehavior[`${action}History`].length > 100) {
            this.userBehavior[`${action}History`] = this.userBehavior[`${action}History`].slice(-100);
        }
        
        EnhancedData.setItem('userBehavior', this.userBehavior);
    }
    
    getRecommendations(currentProduct = null, limit = 6) {
        const recommendations = [];
        
        // 1. Based on viewing history
        const viewedCategories = this.getMostViewedCategories();
        recommendations.push(...this.getProductsByCategories(viewedCategories, limit / 2));
        
        // 2. Based on search history
        const searchTerms = this.getRecentSearchTerms();
        recommendations.push(...this.getProductsBySearchTerms(searchTerms, limit / 4));
        
        // 3. Based on current product (similar products)
        if (currentProduct) {
            recommendations.push(...this.getSimilarProducts(currentProduct, limit / 4));
        }
        
        // Remove duplicates and limit
        const uniqueRecommendations = [...new Set(recommendations)];
        return uniqueRecommendations.slice(0, limit);
    }
    
    getMostViewedCategories() {
        const categoryCount = {};
        
        this.userBehavior.viewedProducts.forEach(view => {
            const product = products.find(p => p.id === view.productId);
            if (product && product.category) {
                categoryCount[product.category] = (categoryCount[product.category] || 0) + 1;
            }
        });
        
        return Object.entries(categoryCount)
            .sort(([,a], [,b]) => b - a)
            .slice(0, 3)
            .map(([category]) => category);
    }
    
    getRecentSearchTerms() {
        return this.userBehavior.searchHistory
            .slice(-10)
            .map(search => search.term)
            .filter(term => term && term.length > 2);
    }
    
    getProductsByCategories(categories, limit) {
        return products
            .filter(p => categories.includes(p.category))
            .sort(() => Math.random() - 0.5)
            .slice(0, limit)
            .map(p => p.id);
    }
    
    getProductsBySearchTerms(terms, limit) {
        return products
            .filter(p => terms.some(term => 
                p.name.toLowerCase().includes(term.toLowerCase()) ||
                p.desc.toLowerCase().includes(term.toLowerCase())
            ))
            .sort(() => Math.random() - 0.5)
            .slice(0, limit)
            .map(p => p.id);
    }
    
    getSimilarProducts(product, limit) {
        return products
            .filter(p => 
                p.id !== product.id && 
                (p.category === product.category || 
                 this.hasSimilarTags(p, product))
            )
            .sort(() => Math.random() - 0.5)
            .slice(0, limit)
            .map(p => p.id);
    }
    
    hasSimilarTags(product1, product2) {
        // Simple similarity based on product names and descriptions
        const words1 = (product1.name + ' ' + product1.desc).toLowerCase().split(' ');
        const words2 = (product2.name + ' ' + product2.desc).toLowerCase().split(' ');
        
        const commonWords = words1.filter(word => words2.includes(word));
        return commonWords.length > 2;
    }
}

// ==========================================
// 🛒 Smart Cart Management
// ==========================================

class SmartCart {
    constructor() {
        this.cart = EnhancedData.getItem('cart', []);
        this.abandonedCartTimer = null;
    }
    
    addItem(product, quantity = 1) {
        const existingItem = this.cart.find(item => item.id === product.id);
        
        if (existingItem) {
            existingItem.quantity += quantity;
            existingItem.addedAt = Date.now();
        } else {
            this.cart.push({
                ...product,
                quantity,
                addedAt: Date.now()
            });
        }
        
        this.saveCart();
        this.trackCartAction('add', product.id, quantity);
        this.startAbandonedCartTimer();
        
        EnhancedUI.showNotification('success', 'تمت الإضافة', `${product.name} أضيف للسلة`);
    }
    
    removeItem(productId) {
        const item = this.cart.find(item => item.id === productId);
        if (item) {
            this.cart = this.cart.filter(item => item.id !== productId);
            this.saveCart();
            this.trackCartAction('remove', productId);
            EnhancedUI.showNotification('info', 'تم الحذف', 'تم حذف المنتج من السلة');
        }
    }
    
    updateQuantity(productId, quantity) {
        const item = this.cart.find(item => item.id === productId);
        if (item) {
            item.quantity = Math.max(1, quantity);
            this.saveCart();
            this.trackCartAction('update', productId, quantity);
        }
    }
    
    getTotal() {
        return this.cart.reduce((total, item) => {
            return total + (item.price * item.quantity);
        }, 0);
    }
    
    getItemCount() {
        return this.cart.reduce((count, item) => count + item.quantity, 0);
    }
    
    saveCart() {
        EnhancedData.setItem('cart', this.cart);
        this.updateCartUI();
    }
    
    updateCartUI() {
        const cartCount = document.querySelector('.cart-count');
        if (cartCount) {
            cartCount.textContent = this.getItemCount();
        }
        
        const cartTotal = document.querySelector('.cart-total');
        if (cartTotal) {
            cartTotal.textContent = this.getTotal().toFixed(2) + ' ريال';
        }
    }
    
    trackCartAction(action, productId, quantity = 1) {
        const behavior = EnhancedData.getItem('userBehavior', {});
        if (!behavior.cartHistory) behavior.cartHistory = [];
        
        behavior.cartHistory.push({
            action,
            productId,
            quantity,
            timestamp: Date.now()
        });
        
        EnhancedData.setItem('userBehavior', behavior);
    }
    
    startAbandonedCartTimer() {
        if (this.abandonedCartTimer) {
            clearTimeout(this.abandonedCartTimer);
        }
        
        // Send reminder after 30 minutes of inactivity
        this.abandonedCartTimer = setTimeout(() => {
            if (this.cart.length > 0) {
                this.sendAbandonedCartReminder();
            }
        }, 30 * 60 * 1000);
    }
    
    sendAbandonedCartReminder() {
        EnhancedUI.showNotification(
            'info', 
            'هل نسيت شيئاً؟', 
            'لديك منتجات في السلة تنتظرك!'
        );
    }
    
    clear() {
        this.cart = [];
        this.saveCart();
        EnhancedUI.showNotification('info', 'تمت الإزالة', 'تم إفراغ السلة');
    }
}

// ==========================================
// 🔍 Smart Search with AutoComplete
// ==========================================

class SmartSearch {
    constructor() {
        this.searchHistory = EnhancedData.getItem('searchHistory', []);
        this.popularSearches = this.getPopularSearches();
    }
    
    getPopularSearches() {
        return [
            'شامبو', 'كريم', 'زيت', 'فيتامين', 
            'عناية بالبشرة', 'عناية بالشعر', 'أطفال'
        ];
    }
    
    performSearch(query) {
        if (!query || query.length < 2) return [];
        
        // Add to search history
        this.addToSearchHistory(query);
        
        // Use enhanced search
        const results = EnhancedSearch.fuzzySearch(query, products, ['name', 'desc', 'category']);
        
        // Track search
        this.trackSearch(query, results.length);
        
        return results;
    }
    
    getAutoCompleteSuggestions(query) {
        if (!query || query.length < 2) return this.popularSearches.slice(0, 5);
        
        const suggestions = [];
        
        // Product names
        products.forEach(product => {
            if (product.name.toLowerCase().includes(query.toLowerCase())) {
                suggestions.push(product.name);
            }
        });
        
        // Recent searches
        this.searchHistory
            .filter(search => search.term.toLowerCase().includes(query.toLowerCase()))
            .forEach(search => suggestions.push(search.term));
        
        // Remove duplicates and limit
        return [...new Set(suggestions)].slice(0, 8);
    }
    
    addToSearchHistory(query) {
        this.searchHistory.unshift({
            term: query,
            timestamp: Date.now()
        });
        
        // Keep only last 50 searches
        this.searchHistory = this.searchHistory.slice(0, 50);
        EnhancedData.setItem('searchHistory', this.searchHistory);
    }
    
    trackSearch(query, resultCount) {
        const behavior = EnhancedData.getItem('userBehavior', {});
        if (!behavior.searchHistory) behavior.searchHistory = [];
        
        behavior.searchHistory.push({
            term: query,
            resultCount,
            timestamp: Date.now()
        });
        
        EnhancedData.setItem('userBehavior', behavior);
    }
}

// ==========================================
// 💡 Smart Notifications System
// ==========================================

class SmartNotifications {
    constructor() {
        this.notifications = [];
        this.preferences = this.loadNotificationPreferences();
    }
    
    loadNotificationPreferences() {
        return EnhancedData.getItem('notificationPreferences', {
            promotions: true,
            orderUpdates: true,
            recommendations: true,
            priceDrops: true,
            stockAlerts: true
        });
    }
    
    showSmartNotification(type, title, message, options = {}) {
        if (!this.shouldShowNotification(type, options)) return;
        
        EnhancedUI.showNotification(type, title, message, options.duration);
        
        // Track notification
        this.trackNotification(type, title, message);
    }
    
    shouldShowNotification(type, options) {
        // Check user preferences
        if (!this.preferences[type]) return false;
        
        // Check frequency limits
        const lastNotification = this.getLastNotificationTime(type);
        const cooldown = this.getNotificationCooldown(type);
        
        if (Date.now() - lastNotification < cooldown) return false;
        
        return true;
    }
    
    getLastNotificationTime(type) {
        const notifications = EnhancedData.getItem('notifications', []);
        const lastNotif = notifications
            .filter(n => n.type === type)
            .sort((a, b) => b.timestamp - a.timestamp)[0];
        
        return lastNotif ? lastNotif.timestamp : 0;
    }
    
    getNotificationCooldown(type) {
        const cooldowns = {
            promotions: 24 * 60 * 60 * 1000, // 24 hours
            orderUpdates: 5 * 60 * 1000, // 5 minutes
            recommendations: 2 * 60 * 60 * 1000, // 2 hours
            priceDrops: 12 * 60 * 60 * 1000, // 12 hours
            stockAlerts: 30 * 60 * 1000 // 30 minutes
        };
        
        return cooldowns[type] || 60 * 60 * 1000; // Default 1 hour
    }
    
    trackNotification(type, title, message) {
        const notifications = EnhancedData.getItem('notifications', []);
        notifications.push({
            type,
            title,
            message,
            timestamp: Date.now()
        });
        
        // Keep only last 100 notifications
        if (notifications.length > 100) {
            notifications.splice(0, notifications.length - 100);
        }
        
        EnhancedData.setItem('notifications', notifications);
    }
    
    // Smart notification triggers
    checkForPriceDrops() {
        products.forEach(product => {
            const oldPrice = EnhancedData.getCache(`price_${product.id}`);
            if (oldPrice && product.price < oldPrice) {
                this.showSmartNotification(
                    'priceDrops',
                    'انخفاض في السعر!',
                    `${product.name} الآن بسعر أقل`
                );
            }
            EnhancedData.setCache(`price_${product.id}`, product.price, 24 * 60 * 60 * 1000);
        });
    }
    
    checkForStockAlerts() {
        products.forEach(product => {
            if (product.stock <= 5 && product.stock > 0) {
                this.showSmartNotification(
                    'stockAlerts',
                    'الكمية محدودة',
                    `باقي ${product.stock} قطع من ${product.name}`
                );
            }
        });
    }
    
    showPersonalizedRecommendations() {
        const recommendations = smartRecommendations.getRecommendations(null, 3);
        if (recommendations.length > 0) {
            const productNames = recommendations
                .map(id => products.find(p => p.id === id)?.name)
                .filter(name => name)
                .slice(0, 2)
                .join(' و ');
            
            this.showSmartNotification(
                'recommendations',
                'قد يعجبك أيضاً',
                `منتجات مقترحة: ${productNames}`
            );
        }
    }
}

// ==========================================
// 🎯 Initialize Smart Features
// ==========================================

// Global instances
let smartRecommendations, smartCart, smartSearch, smartNotifications;

// Initialize when DOM is ready
document.addEventListener('DOMContentLoaded', () => {
    // Initialize smart features
    smartRecommendations = new SmartRecommendations();
    smartCart = new SmartCart();
    smartSearch = new SmartSearch();
    smartNotifications = new SmartNotifications();
    
    // Update cart UI on load
    smartCart.updateCartUI();
    
    // Start periodic checks
    setInterval(() => {
        smartNotifications.checkForPriceDrops();
        smartNotifications.checkForStockAlerts();
    }, 60000); // Check every minute
    
    // Show personalized recommendations periodically
    setInterval(() => {
        if (Math.random() < 0.3) { // 30% chance
            smartNotifications.showPersonalizedRecommendations();
        }
    }, 10 * 60 * 1000); // Every 10 minutes
    
    silentProductionLog('✅ Smart features initialized successfully');
});

// Make smart features available globally
window.smartFeatures = {
    SmartRecommendations,
    SmartCart,
    SmartSearch,
    SmartNotifications,
    smartRecommendations,
    smartCart,
    smartSearch,
    smartNotifications
};

silentProductionLog('✅ Smart features initialized successfully');
