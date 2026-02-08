// auth-utils.js - Authentication Security Utilities
// =================================================
// 🔒 أدوات أمان المصادقة المتقدمة

// Simple hash function for client-side (for demo only)
// In production, use server-side hashing with bcrypt/scrypt/argon2
function simpleHash(str, salt = 'salezone2024') {
    let hash = 0;
    const combined = str + salt;
    for (let i = 0; i < combined.length; i++) {
        const char = combined.charCodeAt(i);
        hash = ((hash << 5) - hash) + char;
        hash = hash & hash; // Convert to 32-bit integer
    }
    return btoa(hash.toString()).replace(/[^a-zA-Z0-9]/g, '').substring(0, 32);
}

// Password strength validator
function validatePasswordStrength(password) {
    const checks = {
        length: password.length >= 8,
        uppercase: /[A-Z]/.test(password),
        lowercase: /[a-z]/.test(password),
        numbers: /\d/.test(password),
        special: /[!@#$%^&*(),.?":{}|<>]/.test(password),
        noCommonWords: !/(password|admin|123|salezone)/i.test(password.toLowerCase())
    };
    
    const score = Object.values(checks).filter(Boolean).length;
    
    return {
        score,
        maxScore: 6,
        isValid: score >= 4,
        checks,
        feedback: getPasswordFeedback(checks)
    };
}

function getPasswordFeedback(checks) {
    const feedback = [];
    if (!checks.length) feedback.push('يجب أن تكون 8 أحرف على الأقل');
    if (!checks.uppercase) feedback.push('مطلوب حرف كبير واحد');
    if (!checks.lowercase) feedback.push('مطلوب حرف صغير واحد');
    if (!checks.numbers) feedback.push('مطلوب رقم واحد');
    if (!checks.special) feedback.push('مطلوب رمز خاص (!@#$%^&*)');
    if (!checks.noCommonWords) feedback.push('تجنب كلمات شائعة');
    return feedback;
}

// Session management
class SessionManager {
    constructor() {
        this.sessions = new Map();
        this.cleanupInterval = setInterval(() => this.cleanup(), 60000); // Clean every minute
    }
    
    createSession(userId, userData) {
        const sessionId = this.generateSessionId();
        const session = {
            id: sessionId,
            userId,
            userData,
            createdAt: Date.now(),
            lastActivity: Date.now(),
            expiresAt: Date.now() + (30 * 60 * 1000) // 30 minutes
        };
        
        this.sessions.set(sessionId, session);
        this.storeSession(sessionId, session);
        
        return sessionId;
    }
    
    validateSession(sessionId) {
        const session = this.sessions.get(sessionId);
        if (!session) return this.validateStoredSession(sessionId);
        
        if (Date.now() > session.expiresAt) {
            this.destroySession(sessionId);
            return false;
        }
        
        session.lastActivity = Date.now();
        this.updateSessionActivity(sessionId);
        return true;
    }
    
    destroySession(sessionId) {
        this.sessions.delete(sessionId);
        sessionStorage.removeItem('adminSession');
        sessionStorage.removeItem('adminLoggedIn');
    }
    
    generateSessionId() {
        return 'session_' + Math.random().toString(36).substr(2, 16) + Date.now();
    }
    
    storeSession(sessionId, session) {
        try {
            sessionStorage.setItem('adminSession', JSON.stringify(session));
        } catch (e) {
            console.warn('Could not store session:', e);
        }
    }
    
    validateStoredSession(sessionId) {
        try {
            const stored = sessionStorage.getItem('adminSession');
            if (!stored) return false;
            
            const session = JSON.parse(stored);
            if (Date.now() > session.expiresAt) {
                sessionStorage.removeItem('adminSession');
                return false;
            }
            
            this.sessions.set(sessionId, session);
            return true;
        } catch (e) {
            return false;
        }
    }
    
    updateSessionActivity(sessionId) {
        const session = this.sessions.get(sessionId);
        if (session) {
            session.lastActivity = Date.now();
            this.storeSession(sessionId, session);
        }
    }
    
    cleanup() {
        const now = Date.now();
        for (const [sessionId, session] of this.sessions) {
            if (now > session.expiresAt) {
                this.destroySession(sessionId);
            }
        }
    }
}

// Rate limiting
class RateLimiter {
    constructor(maxAttempts = 5, windowMs = 15 * 60 * 1000) {
        this.maxAttempts = maxAttempts;
        this.windowMs = windowMs;
        this.attempts = new Map();
    }
    
    isBlocked(identifier) {
        const attempts = this.attempts.get(identifier) || [];
        const now = Date.now();
        const recentAttempts = attempts.filter(time => now - time < this.windowMs);
        
        this.attempts.set(identifier, recentAttempts);
        
        return recentAttempts.length >= this.maxAttempts;
    }
    
    recordAttempt(identifier) {
        const attempts = this.attempts.get(identifier) || [];
        attempts.push(Date.now());
        this.attempts.set(identifier, attempts);
    }
    
    getRemainingAttempts(identifier) {
        const attempts = this.attempts.get(identifier) || [];
        const now = Date.now();
        const recentAttempts = attempts.filter(time => now - time < this.windowMs);
        
        return Math.max(0, this.maxAttempts - recentAttempts.length);
    }
    
    getBlockTimeRemaining(identifier) {
        const attempts = this.attempts.get(identifier) || [];
        if (attempts.length < this.maxAttempts) return 0;
        
        const oldestAttempt = Math.min(...attempts);
        const blockEnd = oldestAttempt + this.windowMs;
        const now = Date.now();
        
        return Math.max(0, blockEnd - now);
    }
}

// Global instances
const sessionManager = new SessionManager();
const rateLimiter = new RateLimiter();

// Make utilities available globally
window.simpleHash = simpleHash;
window.validatePasswordStrength = validatePasswordStrength;
window.SessionManager = SessionManager;
window.RateLimiter = RateLimiter;
window.sessionManager = sessionManager;
window.rateLimiter = rateLimiter;
