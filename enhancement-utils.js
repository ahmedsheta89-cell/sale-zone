// enhancement-utils.js - Enhanced Utilities for Sale Zone Store
// =======================================================
// 🚀 أدوات محسّنة لتطوير المتجر دون هدم الوظائف الحالية

// ==========================================
// 🎨 Enhanced UI Components
// ==========================================

class EnhancedUI {
    // Animated notifications with better UX
    static showNotification(type, title, message, duration = 4000) {
        // Remove existing notifications
        const existing = document.querySelector('.enhanced-notification');
        if (existing) existing.remove();
        
        const notification = document.createElement('div');
        notification.className = `enhanced-notification notification-${type}`;
        notification.innerHTML = `
            <div class="notification-icon">
                ${this.getNotificationIcon(type)}
            </div>
            <div class="notification-content">
                <div class="notification-title">${title}</div>
                <div class="notification-message">${message}</div>
            </div>
            <button class="notification-close" onclick="this.parentElement.remove()">×</button>
        `;
        
        // Add styles if not exists
        if (!document.querySelector('#enhanced-notification-styles')) {
            const styles = document.createElement('style');
            styles.id = 'enhanced-notification-styles';
            styles.textContent = `
                .enhanced-notification {
                    position: fixed;
                    top: 20px;
                    left: 50%;
                    transform: translateX(-50%) translateY(-100px);
                    background: white;
                    border-radius: 12px;
                    padding: 16px 20px;
                    box-shadow: 0 10px 40px rgba(0,0,0,0.2);
                    z-index: 10000;
                    display: flex;
                    align-items: center;
                    gap: 12px;
                    min-width: 300px;
                    max-width: 500px;
                    opacity: 0;
                    transition: all 0.4s cubic-bezier(0.68, -0.55, 0.265, 1.55);
                }
                .enhanced-notification.show {
                    transform: translateX(-50%) translateY(0);
                    opacity: 1;
                }
                .notification-icon {
                    font-size: 24px;
                    flex-shrink: 0;
                }
                .notification-content {
                    flex: 1;
                }
                .notification-title {
                    font-weight: 600;
                    color: #0A1128;
                    margin-bottom: 4px;
                }
                .notification-message {
                    font-size: 14px;
                    color: #666;
                }
                .notification-close {
                    background: none;
                    border: none;
                    font-size: 20px;
                    cursor: pointer;
                    color: #999;
                    padding: 0;
                    width: 24px;
                    height: 24px;
                    display: flex;
                    align-items: center;
                    justify-content: center;
                    border-radius: 50%;
                    transition: all 0.2s;
                }
                .notification-close:hover {
                    background: #f0f0f0;
                    color: #333;
                }
                .notification-success { border-left: 4px solid #50C878; }
                .notification-success .notification-icon { color: #50C878; }
                .notification-error { border-left: 4px solid #DC3545; }
                .notification-error .notification-icon { color: #DC3545; }
                .notification-warning { border-left: 4px solid #FFC107; }
                .notification-warning .notification-icon { color: #FFC107; }
                .notification-info { border-left: 4px solid #17A2B8; }
                .notification-info .notification-icon { color: #17A2B8; }
            `;
            document.head.appendChild(styles);
        }
        
        document.body.appendChild(notification);
        
        // Animate in
        setTimeout(() => notification.classList.add('show'), 100);
        
        // Auto remove
        setTimeout(() => {
            notification.classList.remove('show');
            setTimeout(() => notification.remove(), 400);
        }, duration);
    }
    
    static getNotificationIcon(type) {
        const icons = {
            success: '✅',
            error: '❌',
            warning: '⚠️',
            info: 'ℹ️'
        };
        return icons[type] || icons.info;
    }
    
    // Enhanced loading states
    static setLoading(element, loading = true) {
        if (loading) {
            element.disabled = true;
            element.dataset.originalText = element.textContent;
            element.innerHTML = `
                <span class="loading-spinner"></span>
                <span class="loading-text">${element.dataset.originalText}</span>
            `;
            
            if (!document.querySelector('#enhanced-loading-styles')) {
                const styles = document.createElement('style');
                styles.id = 'enhanced-loading-styles';
                styles.textContent = `
                    .loading-spinner {
                        display: inline-block;
                        width: 16px;
                        height: 16px;
                        border: 2px solid rgba(255,255,255,0.3);
                        border-top-color: white;
                        border-radius: 50%;
                        animation: spin 1s linear infinite;
                        margin-left: 8px;
                    }
                    @keyframes spin {
                        to { transform: rotate(360deg); }
                    }
                `;
                document.head.appendChild(styles);
            }
        } else {
            element.disabled = false;
            element.textContent = element.dataset.originalText || element.textContent;
            delete element.dataset.originalText;
        }
    }
}

// ==========================================
// 📊 Enhanced Data Management
// ==========================================

class EnhancedData {
    // Smart caching with expiration
    static cache = new Map();
    
    static setCache(key, data, ttl = 300000) { // 5 minutes default
        this.cache.set(key, {
            data,
            timestamp: Date.now(),
            ttl
        });
    }
    
    static getCache(key) {
        const cached = this.cache.get(key);
        if (!cached) return null;
        
        if (Date.now() - cached.timestamp > cached.ttl) {
            this.cache.delete(key);
            return null;
        }
        
        return cached.data;
    }
    
    // Enhanced localStorage with compression
    static setItem(key, value) {
        try {
            const compressed = JSON.stringify(value);
            localStorage.setItem(key, compressed);
            return true;
        } catch (e) {
            console.warn('Storage quota exceeded:', e);
            this.cleanupStorage();
            return false;
        }
    }
    
    static getItem(key, defaultValue = null) {
        try {
            const item = localStorage.getItem(key);
            return item ? JSON.parse(item) : defaultValue;
        } catch (e) {
            console.warn('Failed to parse storage item:', e);
            return defaultValue;
        }
    }
    
    static cleanupStorage() {
        // Remove old or large items
        const keys = Object.keys(localStorage);
        keys.forEach(key => {
            try {
                const item = localStorage.getItem(key);
                if (item && item.length > 100000) { // > 100KB
                    localStorage.removeItem(key);
                }
            } catch (e) {
                localStorage.removeItem(key);
            }
        });
    }
}

// ==========================================
// 🔍 Enhanced Search and Filter
// ==========================================

class EnhancedSearch {
    static fuzzySearch(query, items, searchFields = ['name', 'desc']) {
        if (!query) return items;
        
        const normalizedQuery = query.toLowerCase().trim();
        
        return items.filter(item => {
            return searchFields.some(field => {
                const fieldValue = item[field] ? item[field].toLowerCase() : '';
                return fieldValue.includes(normalizedQuery) || 
                       this.fuzzyMatch(normalizedQuery, fieldValue);
            });
        }).sort((a, b) => {
            // Sort by relevance
            const aScore = this.calculateRelevance(normalizedQuery, a, searchFields);
            const bScore = this.calculateRelevance(normalizedQuery, b, searchFields);
            return bScore - aScore;
        });
    }
    
    static fuzzyMatch(query, text) {
        // Simple fuzzy matching
        let queryIndex = 0;
        let textIndex = 0;
        
        while (queryIndex < query.length && textIndex < text.length) {
            if (query[queryIndex] === text[textIndex]) {
                queryIndex++;
            }
            textIndex++;
        }
        
        return queryIndex === query.length;
    }
    
    static calculateRelevance(query, item, searchFields) {
        let score = 0;
        searchFields.forEach(field => {
            const fieldValue = item[field] ? item[field].toLowerCase() : '';
            
            // Exact match gets highest score
            if (fieldValue === query) score += 100;
            // Starts with query gets high score
            else if (fieldValue.startsWith(query)) score += 50;
            // Contains query gets medium score
            else if (fieldValue.includes(query)) score += 25;
            // Fuzzy match gets low score
            else if (this.fuzzyMatch(query, fieldValue)) score += 10;
        });
        
        return score;
    }
    
    static advancedFilter(items, filters) {
        return items.filter(item => {
            return Object.entries(filters).every(([key, value]) => {
                if (value === '' || value === null || value === undefined) return true;
                
                if (key === 'priceRange') {
                    return item.price >= value.min && item.price <= value.max;
                }
                
                if (key === 'category') {
                    return item.category === value;
                }
                
                if (key === 'rating') {
                    return item.rating >= value;
                }
                
                return item[key] === value;
            });
        });
    }
}

// ==========================================
// 📱 Enhanced Mobile Experience
// ==========================================

class EnhancedMobile {
    static isMobile() {
        return window.innerWidth <= 768;
    }
    
    static initTouchGestures() {
        if (!this.isMobile()) return;
        
        let touchStartX = 0;
        let touchEndX = 0;
        
        document.addEventListener('touchstart', e => {
            touchStartX = e.changedTouches[0].screenX;
        });
        
        document.addEventListener('touchend', e => {
            touchEndX = e.changedTouches[0].screenX;
            this.handleSwipe(touchStartX, touchEndX);
        });
    }
    
    static handleSwipe(startX, endX) {
        const swipeThreshold = 50;
        const diff = startX - endX;
        
        if (Math.abs(diff) < swipeThreshold) return;
        
        // Handle swipe gestures for navigation
        if (diff > 0) {
            // Swipe left - could open cart or next product
            console.log('Swipe left detected');
        } else {
            // Swipe right - could go back or previous product
            console.log('Swipe right detected');
        }
    }
    
    static enhanceMobileUI() {
        if (!this.isMobile()) return;
        
        // Add mobile-specific enhancements
        document.body.classList.add('mobile-enhanced');
        
        // Improve touch targets
        const touchTargets = document.querySelectorAll('button, .nav-btn, .product-card');
        touchTargets.forEach(target => {
            if (target.offsetHeight < 44) {
                target.style.minHeight = '44px';
                target.style.display = 'flex';
                target.style.alignItems = 'center';
                target.style.justifyContent = 'center';
            }
        });
    }
}

// ==========================================
// 🚀 Performance Optimizations
// ==========================================

class EnhancedPerformance {
    static debounce(func, wait) {
        let timeout;
        return function executedFunction(...args) {
            const later = () => {
                clearTimeout(timeout);
                func(...args);
            };
            clearTimeout(timeout);
            timeout = setTimeout(later, wait);
        };
    }
    
    static throttle(func, limit) {
        let inThrottle;
        return function(...args) {
            if (!inThrottle) {
                func.apply(this, args);
                inThrottle = true;
                setTimeout(() => inThrottle = false, limit);
            }
        };
    }
    
    static lazyLoadImages() {
        const images = document.querySelectorAll('img[data-src]');
        
        const imageObserver = new IntersectionObserver((entries, observer) => {
            entries.forEach(entry => {
                if (entry.isIntersecting) {
                    const img = entry.target;
                    img.src = img.dataset.src;
                    img.classList.remove('lazy');
                    observer.unobserve(img);
                }
            });
        });
        
        images.forEach(img => imageObserver.observe(img));
    }
    
    static optimizeScroll() {
        let ticking = false;
        
        function updateScroll() {
            // Handle scroll-based animations
            const scrolled = window.pageYOffset;
            const parallax = document.querySelector('.header');
            if (parallax) {
                parallax.style.transform = `translateY(${scrolled * 0.5}px)`;
            }
            
            ticking = false;
        }
        
        function requestTick() {
            if (!ticking) {
                requestAnimationFrame(updateScroll);
                ticking = true;
            }
        }
        
        window.addEventListener('scroll', this.throttle(requestTick, 16));
    }
}

// ==========================================
// 🎯 Initialize Enhancements
// ==========================================

// Initialize all enhancements when DOM is ready
document.addEventListener('DOMContentLoaded', () => {
    // Initialize mobile enhancements
    EnhancedMobile.initTouchGestures();
    EnhancedMobile.enhanceMobileUI();
    
    // Initialize performance optimizations
    EnhancedPerformance.lazyLoadImages();
    EnhancedPerformance.optimizeScroll();
    
    // Override existing notification function if exists
    if (typeof showNotification === 'function') {
        const originalShowNotification = showNotification;
        window.showNotification = (type, title, message) => {
            EnhancedUI.showNotification(type, title, message);
            originalShowNotification(type, title, message);
        };
    } else {
        window.showNotification = EnhancedUI.showNotification;
    }
    
    console.log('✅ Enhanced utilities loaded successfully');
});

// Make utilities available globally
window.EnhancedUI = EnhancedUI;
window.EnhancedData = EnhancedData;
window.EnhancedSearch = EnhancedSearch;
window.EnhancedMobile = EnhancedMobile;
window.EnhancedPerformance = EnhancedPerformance;

console.log('✅ Enhanced utilities loaded successfully');
