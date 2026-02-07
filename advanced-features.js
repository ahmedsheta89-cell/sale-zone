// advanced-features.js - Advanced Features for Sale Zone Store
// =====================================================
// 🚀 ميزات متقدمة إضافية مع الحفاظ على الوظائف الحالية

// ==========================================
// 🎯 Advanced Analytics & Insights
// ==========================================

class AdvancedAnalytics {
    constructor() {
        this.userJourney = this.loadUserJourney();
        this.productAnalytics = this.loadProductAnalytics();
        this.conversionData = this.loadConversionData();
    }
    
    loadUserJourney() {
        return EnhancedData.getItem('userJourney', {
            sessions: [],
            pageViews: [],
            interactions: [],
            conversions: []
        });
    }
    
    loadProductAnalytics() {
        return EnhancedData.getItem('productAnalytics', {});
    }
    
    loadConversionData() {
        return EnhancedData.getItem('conversionData', {
            cartAbandonment: [],
            checkoutSteps: [],
            completedOrders: []
        });
    }
    
    trackUserAction(action, data = {}) {
        const timestamp = Date.now();
        const sessionId = this.getCurrentSessionId();
        
        this.userJourney.interactions.push({
            action,
            data,
            timestamp,
            sessionId
        });
        
        this.saveUserJourney();
    }
    
    trackPageView(page) {
        const timestamp = Date.now();
        const sessionId = this.getCurrentSessionId();
        
        this.userJourney.pageViews.push({
            page,
            timestamp,
            sessionId
        });
        
        this.saveUserJourney();
    }
    
    trackProductInteraction(productId, interaction) {
        if (!this.productAnalytics[productId]) {
            this.productAnalytics[productId] = {
                views: 0,
                clicks: 0,
                addToCart: 0,
                favorites: 0,
                timeSpent: 0
            };
        }
        
        this.productAnalytics[productId][interaction]++;
        this.saveProductAnalytics();
    }
    
    getCurrentSessionId() {
        let sessionId = sessionStorage.getItem('analyticsSessionId');
        if (!sessionId) {
            sessionId = 'session_' + Date.now() + '_' + Math.random().toString(36).substr(2, 9);
            sessionStorage.setItem('analyticsSessionId', sessionId);
            
            this.userJourney.sessions.push({
                id: sessionId,
                startTime: Date.now(),
                userAgent: navigator.userAgent,
                referrer: document.referrer
            });
        }
        
        return sessionId;
    }
    
    saveUserJourney() {
        EnhancedData.setItem('userJourney', this.userJourney);
    }
    
    saveProductAnalytics() {
        EnhancedData.setItem('productAnalytics', this.productAnalytics);
    }
    
    getInsights() {
        return {
            totalSessions: this.userJourney.sessions.length,
            totalPageViews: this.userJourney.pageViews.length,
            topProducts: this.getTopProducts(),
            userEngagement: this.calculateEngagement(),
            conversionRate: this.calculateConversionRate()
        };
    }
    
    getTopProducts(limit = 5) {
        return Object.entries(this.productAnalytics)
            .sort(([,a], [,b]) => {
                const scoreA = a.views + a.clicks * 2 + a.addToCart * 5 + a.favorites * 3;
                const scoreB = b.views + b.clicks * 2 + b.addToCart * 5 + b.favorites * 3;
                return scoreB - scoreB;
            })
            .slice(0, limit)
            .map(([productId, analytics]) => ({
                productId,
                ...analytics,
                score: analytics.views + analytics.clicks * 2 + analytics.addToCart * 5 + analytics.favorites * 3
            }));
    }
    
    calculateEngagement() {
        if (this.userJourney.pageViews.length === 0) return 0;
        
        const interactions = this.userJourney.interactions.length;
        const pageViews = this.userJourney.pageViews.length;
        
        return Math.round((interactions / pageViews) * 100);
    }
    
    calculateConversionRate() {
        const sessions = this.userJourney.sessions.length;
        const conversions = this.userJourney.conversions.length;
        
        return sessions > 0 ? Math.round((conversions / sessions) * 100) : 0;
    }
}

// ==========================================
// 🤖 AI-Powered Customer Support
// ==========================================

class AICustomerSupport {
    constructor() {
        this.knowledgeBase = this.initializeKnowledgeBase();
        this.conversationHistory = [];
        this.isAvailable = true;
    }
    
    initializeKnowledgeBase() {
        return {
            'الشحن': {
                keywords: ['شحن', 'توصيل', 'وصول', 'وقت'],
                response: 'الشحن خلال 2-3 أيام عمل داخل القاهرة، 3-5 أيام للمحافظات. التوصيل مجاني للطلبات فوق 300 ج.م'
            },
            'الإرجاع': {
                keywords: ['إرجاع', 'استبدال', 'استرداد', 'استرجاع'],
                response: 'يمكن إرجاع المنتجات خلال 14 يوم من الاستلام. يجب أن تكون المنتجات في حالتها الأصلية.'
            },
            'الدفع': {
                keywords: ['دفع', 'سداد', 'بطاقة', 'كاش'],
                response: 'نقبل الدفع عند الاستلام، البطاقات البنكية، والمحافظ الإلكترونية'
            },
            'الخصومات': {
                keywords: ['خصم', 'كوبون', 'تخفيض', 'عرض'],
                response: 'تابعنا على وسائل التواصل الاجتماعي للحصول على أحدث الخصومات والعروض'
            },
            'الجودة': {
                keywords: ['جودة', 'أصلي', 'ضمان', 'معتمد'],
                response: 'جميع منتجاتنا أصلية ومعتمدة من وزارة الصحة. نضمن الجودة 100%'
            }
        };
    }
    
    processMessage(userMessage) {
        const message = userMessage.toLowerCase();
        let bestMatch = null;
        let highestScore = 0;
        
        Object.entries(this.knowledgeBase).forEach(([topic, data]) => {
            const score = this.calculateMatchScore(message, data.keywords);
            if (score > highestScore) {
                highestScore = score;
                bestMatch = topic;
            }
        });
        
        const response = bestMatch && highestScore > 0.3 
            ? this.knowledgeBase[bestMatch].response 
            : this.generateDefaultResponse(message);
        
        this.conversationHistory.push({
            user: userMessage,
            bot: response,
            timestamp: Date.now()
        });
        
        return response;
    }
    
    calculateMatchScore(message, keywords) {
        let matches = 0;
        keywords.forEach(keyword => {
            if (message.includes(keyword.toLowerCase())) {
                matches++;
            }
        });
        
        return matches / keywords.length;
    }
    
    generateDefaultResponse(message) {
        const responses = [
            'شكراً لسؤالك. يمكنني مساعدتك في معلومات الشحن، الإرجاع، الدفع، والخصومات.',
            'أنا هنا للمساعدة! ما هي معلوماتك التي تحتاجها؟',
            'يمكنك التواصل معنا على 01018108979 لمساعدة فورية.',
            'تفضل بزيارة صفحة الأسئلة الشائعة في قسم المساعدة.'
        ];
        
        return responses[Math.floor(Math.random() * responses.length)];
    }
    
    startChat() {
        if (!this.isAvailable) return 'عذراً، الدعم الفني غير متاح حالياً.';
        
        return 'مرحباً! كيف يمكنني مساعدتك اليوم؟ 🤖';
    }
    
    getQuickActions() {
        return [
            { text: 'معلومات الشحن', action: 'الشحن' },
            { text: 'سياسة الإرجاع', action: 'الإرجاع' },
            { text: 'طرق الدفع', action: 'الدفع' },
            { text: 'العروض الحالية', action: 'الخصومات' }
        ];
    }
}

// ==========================================
// 🎮 Gamification System
// ==========================================

class GamificationSystem {
    constructor() {
        this.userProfile = this.loadUserProfile();
        this.achievements = this.initializeAchievements();
        this.challenges = this.initializeChallenges();
    }
    
    loadUserProfile() {
        return EnhancedData.getItem('gamificationProfile', {
            level: 1,
            experience: 0,
            points: 0,
            badges: [],
            streak: 0,
            lastActive: null
        });
    }
    
    initializeAchievements() {
        return {
            firstPurchase: {
                name: 'أول عملية شراء',
                description: 'قم بأول عملية شراء',
                points: 50,
                icon: '🛒'
            },
            loyalCustomer: {
                name: 'عميل مخلص',
                description: 'أكمل 5 عمليات شراء',
                points: 100,
                icon: '💎'
            },
            bargainHunter: {
                name: 'صياد الخصومات',
                description: 'استخدم 5 كوبونات مختلفة',
                points: 75,
                icon: '🎯'
            },
            socialSharer: {
                name: 'ناشط اجتماعياً',
                description: 'شارك 3 منتجات',
                points: 60,
                icon: '📱'
            },
            reviewer: {
                name: 'ناقد',
                description: 'قيم 5 منتجات',
                points: 80,
                icon: '⭐'
            }
        };
    }
    
    initializeChallenges() {
        return {
            weeklyShopper: {
                name: 'متسوق أسبوعي',
                description: 'تسوق 3 مرات هذا الأسبوع',
                reward: 25,
                progress: 0,
                target: 3,
                period: 'weekly'
            },
            categoryExplorer: {
                name: 'مستكشف الفئات',
                description: 'جرب منتجات من 3 فئات مختلفة',
                reward: 30,
                progress: 0,
                target: 3,
                period: 'monthly'
            },
            bigSpender: {
                name: 'المبذر الكبير',
                description: 'أنفق 1000 ج.م هذا الشهر',
                reward: 100,
                progress: 0,
                target: 1000,
                period: 'monthly'
            }
        };
    }
    
    addExperience(amount) {
        this.userProfile.experience += amount;
        this.checkLevelUp();
        this.saveUserProfile();
    }
    
    addPoints(amount) {
        this.userProfile.points += amount;
        this.saveUserProfile();
    }
    
    checkLevelUp() {
        const requiredExp = this.getRequiredExperience(this.userProfile.level);
        if (this.userProfile.experience >= requiredExp) {
            this.userProfile.level++;
            this.userProfile.experience -= requiredExp;
            
            EnhancedUI.showNotification(
                'success',
                '🎉 مستوى جديد!',
                `تهانينا! وصلت للمستوى ${this.userProfile.level}`
            );
            
            this.checkLevelUp(); // Check for multiple level ups
        }
    }
    
    getRequiredExperience(level) {
        return level * 100;
    }
    
    unlockAchievement(achievementId) {
        if (this.userProfile.badges.includes(achievementId)) return;
        
        const achievement = this.achievements[achievementId];
        if (achievement) {
            this.userProfile.badges.push(achievementId);
            this.addPoints(achievement.points);
            
            EnhancedUI.showNotification(
                'success',
                '🏆 إنجاز جديد!',
                `${achievement.name}: ${achievement.description}`
            );
            
            this.saveUserProfile();
        }
    }
    
    updateChallenge(challengeId, increment = 1) {
        const challenge = this.challenges[challengeId];
        if (challenge) {
            challenge.progress = Math.min(challenge.progress + increment, challenge.target);
            
            if (challenge.progress >= challenge.target) {
                this.addPoints(challenge.reward);
                EnhancedUI.showNotification(
                    'success',
                    '🎯 تحدي مكتمل!',
                    `${challenge.name}: +${challenge.reward} نقطة`
                );
            }
            
            this.saveUserProfile();
        }
    }
    
    updateStreak() {
        const today = new Date().toDateString();
        const lastActive = this.userProfile.lastActive;
        
        if (lastActive !== today) {
            const yesterday = new Date(Date.now() - 24 * 60 * 60 * 1000).toDateString();
            
            if (lastActive === yesterday) {
                this.userProfile.streak++;
            } else {
                this.userProfile.streak = 1;
            }
            
            this.userProfile.lastActive = today;
            this.saveUserProfile();
        }
    }
    
    saveUserProfile() {
        EnhancedData.setItem('gamificationProfile', this.userProfile);
    }
    
    getProfileStats() {
        return {
            level: this.userProfile.level,
            experience: this.userProfile.experience,
            points: this.userProfile.points,
            badges: this.userProfile.badges.length,
            streak: this.userProfile.streak,
            nextLevelExp: this.getRequiredExperience(this.userProfile.level + 1)
        };
    }
}

// ==========================================
// 🌐 Social Sharing & Community
// ==========================================

class SocialCommunity {
    constructor() {
        this.sharedProducts = this.loadSharedProducts();
        this.userReviews = this.loadUserReviews();
        this.communityPosts = this.loadCommunityPosts();
    }
    
    loadSharedProducts() {
        return EnhancedData.getItem('sharedProducts', []);
    }
    
    loadUserReviews() {
        return EnhancedData.getItem('userReviews', []);
    }
    
    loadCommunityPosts() {
        return EnhancedData.getItem('communityPosts', []);
    }
    
    shareProduct(productId, platform = 'general') {
        const product = products.find(p => p.id === productId);
        if (!product) return;
        
        const shareData = {
            productId,
            productName: product.name,
            platform,
            timestamp: Date.now(),
            userId: currentUser?.id || 'anonymous'
        };
        
        this.sharedProducts.push(shareData);
        this.saveSharedProducts();
        
        // Update gamification
        if (window.gamificationSystem) {
            window.gamificationSystem.updateChallenge('socialSharer');
            window.gamificationSystem.addExperience(10);
        }
        
        const shareText = `أوصيكم بمنتج ${product.name} من متجر Sale Zone! 🛍️✨`;
        
        if (navigator.share) {
            navigator.share({
                title: product.name,
                text: shareText,
                url: window.location.href
            });
        } else {
            // Fallback for browsers without Web Share API
            this.copyToClipboard(shareText + ' ' + window.location.href);
            EnhancedUI.showNotification('success', 'تم النسخ', 'تم نسخ الرابط للحصة');
        }
    }
    
    addReview(productId, rating, comment) {
        if (!currentUser) {
            EnhancedUI.showNotification('error', 'خطأ', 'سجل دخول أولاً');
            return;
        }
        
        const review = {
            id: Date.now(),
            productId,
            userId: currentUser.id,
            userName: currentUser.name,
            rating,
            comment,
            timestamp: Date.now(),
            helpful: 0
        };
        
        this.userReviews.push(review);
        this.saveUserReviews();
        
        // Update product rating
        this.updateProductRating(productId);
        
        // Update gamification
        if (window.gamificationSystem) {
            window.gamificationSystem.updateChallenge('reviewer');
            window.gamificationSystem.addExperience(15);
        }
        
        EnhancedUI.showNotification('success', 'شكراً!', 'تم إضافة تقييمك بنجاح');
    }
    
    createPost(content, type = 'general') {
        if (!currentUser) {
            EnhancedUI.showNotification('error', 'خطأ', 'سجل دخول أولاً');
            return;
        }
        
        const post = {
            id: Date.now(),
            userId: currentUser.id,
            userName: currentUser.name,
            content,
            type,
            timestamp: Date.now(),
            likes: 0,
            comments: []
        };
        
        this.communityPosts.unshift(post);
        this.saveCommunityPosts();
        
        EnhancedUI.showNotification('success', 'تم النشر', 'تم نشر منشورك بنجاح');
    }
    
    likePost(postId) {
        const post = this.communityPosts.find(p => p.id === postId);
        if (post) {
            post.likes++;
            this.saveCommunityPosts();
        }
    }
    
    addComment(postId, comment) {
        if (!currentUser) return;
        
        const post = this.communityPosts.find(p => p.id === postId);
        if (post) {
            post.comments.push({
                userId: currentUser.id,
                userName: currentUser.name,
                comment,
                timestamp: Date.now()
            });
            this.saveCommunityPosts();
        }
    }
    
    updateProductRating(productId) {
        const productReviews = this.userReviews.filter(r => r.productId === productId);
        const product = products.find(p => p.id === productId);
        
        if (product && productReviews.length > 0) {
            const avgRating = productReviews.reduce((sum, r) => sum + r.rating, 0) / productReviews.length;
            product.rating = Math.round(avgRating * 10) / 10;
            product.ratingCount = productReviews.length;
            
            // Save to Firebase if available
            if (typeof updateProduct === 'function') {
                updateProduct(productId, {
                    rating: product.rating,
                    ratingCount: product.ratingCount
                });
            }
        }
    }
    
    copyToClipboard(text) {
        const textarea = document.createElement('textarea');
        textarea.value = text;
        document.body.appendChild(textarea);
        textarea.select();
        document.execCommand('copy');
        document.body.removeChild(textarea);
    }
    
    saveSharedProducts() {
        EnhancedData.setItem('sharedProducts', this.sharedProducts);
    }
    
    saveUserReviews() {
        EnhancedData.setItem('userReviews', this.userReviews);
    }
    
    saveCommunityPosts() {
        EnhancedData.setItem('communityPosts', this.communityPosts);
    }
    
    getTrendingProducts(limit = 5) {
        const productShares = {};
        
        this.sharedProducts.forEach(share => {
            if (!productShares[share.productId]) {
                productShares[share.productId] = 0;
            }
            productShares[share.productId]++;
        });
        
        return Object.entries(productShares)
            .sort(([,a], [,b]) => b - a)
            .slice(0, limit)
            .map(([productId, shares]) => ({
                productId,
                shares,
                product: products.find(p => p.id === productId)
            }));
    }
}

// ==========================================
// 🎯 Initialize Advanced Features
// ==========================================

// Global instances
let advancedAnalytics, aiSupport, gamificationSystem, socialCommunity;

// Initialize when DOM is ready
document.addEventListener('DOMContentLoaded', () => {
    // Initialize advanced features
    advancedAnalytics = new AdvancedAnalytics();
    aiSupport = new AICustomerSupport();
    gamificationSystem = new GamificationSystem();
    socialCommunity = new SocialCommunity();
    
    // Track page view
    advancedAnalytics.trackPageView('home');
    
    // Update daily streak
    gamificationSystem.updateStreak();
    
    // Make available globally
    window.advancedFeatures = {
        AdvancedAnalytics,
        AICustomerSupport,
        GamificationSystem,
        SocialCommunity,
        advancedAnalytics,
        aiSupport,
        gamificationSystem,
        socialCommunity
    };
    
    console.log('✅ Advanced features initialized successfully');
});

// Export for use in other modules
window.advancedFeatures = {
    AdvancedAnalytics,
    AICustomerSupport,
    GamificationSystem,
    SocialCommunity,
    advancedAnalytics,
    aiSupport,
    gamificationSystem,
    socialCommunity
};
