// ============================================
// 🛡️ XSS Protection Implementation
// ============================================
// حماية شاملة من هجمات XSS
// ============================================

class XSSProtection {
    constructor() {
        this.sanitizer = null;
        this.allowedTags = [
            'p', 'br', 'strong', 'em', 'u', 'i', 'b', 'span',
            'h1', 'h2', 'h3', 'h4', 'h5', 'h6',
            'ul', 'ol', 'li', 'div', 'section', 'article'
        ];
        this.allowedAttributes = {
            'class': true,
            'id': true,
            'style': true,
            'data-*': true
        };
        this.initialize();
    }

    // 🚀 تهيئة نظام الحماية
    initialize() {
        // تحميل DOMPurify إذا كان متاحاً
        this.loadDOMPurify();
        
        // إعداد مراقبة XSS
        this.setupXSSMonitoring();
        
        // حماية innerHTML الحالي
        this.protectCurrentHTML();
        
        console.log('🛡️ XSS Protection initialized');
    }

    // 📦 تحميل DOMPurify
    async loadDOMPurify() {
        try {
            // محاولة تحميل DOMPurify من CDN
            const script = document.createElement('script');
            script.src = 'https://cdn.jsdelivr.net/npm/dompurify@3.0.5/dist/purify.min.js';
            script.onload = () => {
                this.sanitizer = window.DOMPurify;
                console.log('✅ DOMPurify loaded successfully');
            };
            script.onerror = () => {
                console.warn('⚠️ DOMPurify failed to load, using custom sanitizer');
                this.setupCustomSanitizer();
            };
            document.head.appendChild(script);
        } catch (error) {
            console.warn('⚠️ Could not load DOMPurify, using custom sanitizer');
            this.setupCustomSanitizer();
        }
    }

    // 🛡️ إعداد معقم مخصص
    setupCustomSanitizer() {
        this.sanitizer = {
            sanitize: (dirty) => {
                return this.customSanitize(dirty);
            }
        };
    }

    // 🧹 تعقيم مخصص
    customSanitize(dirty) {
        if (typeof dirty !== 'string') {
            return '';
        }

        // إزالة السكربتات الخطرة
        let clean = dirty
            .replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, '')
            .replace(/<iframe\b[^<]*(?:(?!<\/iframe>)<[^<]*)*<\/iframe>/gi, '')
            .replace(/<object\b[^<]*(?:(?!<\/object>)<[^<]*)*<\/object>/gi, '')
            .replace(/<embed\b[^<]*(?:(?!<\/embed>)<[^<]*)*<\/embed>/gi, '')
            .replace(/<link\b[^<]*(?:(?!<\/link>)<[^<]*)*<\/link>/gi, '')
            .replace(/<meta\b[^<]*(?:(?!<\/meta>)<[^<]*)*<\/meta>/gi, '')
            .replace(/javascript:/gi, '')
            .replace(/on\w+\s*=/gi, '')
            .replace(/<img[^>]*src[^>]*javascript:/gi, '')
            .replace(/<img[^>]*on\w+\s*=[^>]*>/gi, '');

        // السماح بالوسوم الآمنة فقط
        const tempDiv = document.createElement('div');
        tempDiv.innerHTML = clean;
        
        this.sanitizeNode(tempDiv);
        
        return tempDiv.innerHTML;
    }

    // 🧹 تعقيم العقد
    sanitizeNode(node) {
        const children = Array.from(node.childNodes);
        
        children.forEach(child => {
            if (child.nodeType === Node.ELEMENT_NODE) {
                // التحقق من الوسم المسموح
                if (!this.allowedTags.includes(child.tagName.toLowerCase())) {
                    node.removeChild(child);
                    return;
                }
                
                // تعقيم الخصائص
                this.sanitizeAttributes(child);
                
                // تعقيم الأبناء
                this.sanitizeNode(child);
            } else if (child.nodeType === Node.TEXT_NODE) {
                // النصوص آمنة
                return;
            } else {
                // إزالة أنواع العقد الأخرى
                node.removeChild(child);
            }
        });
    }

    // 🛡️ تعقيم الخصائص
    sanitizeAttributes(element) {
        const attributes = Array.from(element.attributes);
        
        attributes.forEach(attr => {
            const attrName = attr.name.toLowerCase();
            
            // التحقق من الخصائص المسموحة
            if (!this.isAllowedAttribute(attrName)) {
                element.removeAttribute(attrName);
                return;
            }
            
            // تعقيم قيمة الخصائص
            if (attrName === 'style') {
                element.setAttribute(attrName, this.sanitizeCSS(attr.value));
            } else if (attrName.startsWith('data-')) {
                element.setAttribute(attrName, this.sanitizeData(attr.value));
            } else {
                element.setAttribute(attrName, this.escapeHTML(attr.value));
            }
        });
    }

    // 🎨 تعقيم CSS
    sanitizeCSS(css) {
        return css
            .replace(/javascript:/gi, '')
            .replace(/expression\s*\(/gi, '')
            .replace(/@import/i, '')
            .replace(/binding\s*:/gi, '')
            .replace(/behavior\s*:/gi, '');
    }

    // 📊 تعقيم البيانات
    sanitizeData(data) {
        return this.escapeHTML(data);
    }

    // 🔍 التحقق من الخصائص المسموحة
    isAllowedAttribute(attrName) {
        for (const allowed in this.allowedAttributes) {
            if (allowed === attrName || allowed.endsWith('*') && attrName.startsWith(allowed.slice(0, -1))) {
                return true;
            }
        }
        return false;
    }

    // 🏃‍♂️ الهروب من HTML
    escapeHTML(str) {
        const div = document.createElement('div');
        div.textContent = str;
        return div.innerHTML;
    }

    // 🔍 إعداد مراقبة XSS
    setupXSSMonitoring() {
        // مراقبة innerHTML
        this.monitorInnerHTML();
        
        // مراقبة insertAdjacentHTML
        this.monitorInsertAdjacentHTML();
        
        // مراقبة document.write
        this.monitorDocumentWrite();
        
        // مراقبة eval
        this.monitorEval();
    }

    // 📊 مراقبة innerHTML
    monitorInnerHTML() {
        const originalSet = Object.getOwnPropertyDescriptor(HTMLElement.prototype, 'innerHTML').set;
        
        Object.defineProperty(HTMLElement.prototype, 'innerHTML', {
            set: function(value) {
                if (window.xssProtection && window.xssProtection.sanitizer) {
                    value = window.xssProtection.sanitizer.sanitize(value);
                }
                return originalSet.call(this, value);
            },
            get: function() {
                return this.innerHTML;
            }
        });
    }

    // 📊 مراقبة insertAdjacentHTML
    monitorInsertAdjacentHTML() {
        const originalInsertAdjacentHTML = HTMLElement.prototype.insertAdjacentHTML;
        
        HTMLElement.prototype.insertAdjacentHTML = function(position, text) {
            if (window.xssProtection && window.xssProtection.sanitizer) {
                text = window.xssProtection.sanitizer.sanitize(text);
            }
            return originalInsertAdjacentHTML.call(this, position, text);
        };
    }

    // 📊 مراقبة document.write
    monitorDocumentWrite() {
        const originalWrite = document.write;
        const originalWriteln = document.writeln;
        
        document.write = function(text) {
            if (window.xssProtection && window.xssProtection.sanitizer) {
                text = window.xssProtection.sanitizer.sanitize(text);
            }
            return originalWrite.call(this, text);
        };
        
        document.writeln = function(text) {
            if (window.xssProtection && window.xssProtection.sanitizer) {
                text = window.xssProtection.sanitizer.sanitize(text);
            }
            return originalWriteln.call(this, text);
        };
    }

    // 📊 مراقبة eval
    monitorEval() {
        const originalEval = window.eval;
        
        window.eval = function(text) {
            // تسجيل محاولة eval
            console.warn('🚨 eval() called with:', text.substring(0, 100));
            
            // التحقق من المحتوى الخطير
            if (this.containsXSSPatterns(text)) {
                console.error('❌ XSS attempt detected in eval()');
                return;
            }
            
            return originalEval.call(this, text);
        };
    }

    // 🔍 التحقق من أنماط XSS
    containsXSSPatterns(text) {
        const xssPatterns = [
            /<script/i,
            /javascript:/i,
            /on\w+\s*=/i,
            /<iframe/i,
            /<object/i,
            /<embed/i,
            /expression\s*\(/i,
            /@import/i,
            /binding\s*:/i,
            /behavior\s*:/i
        ];
        
        return xssPatterns.some(pattern => pattern.test(text));
    }

    // 🛡️ حماية HTML الحالي
    protectCurrentHTML() {
        // حماية العناصر الحالية
        const elements = document.querySelectorAll('*');
        elements.forEach(element => {
            this.sanitizeAttributes(element);
        });
    }

    // 🧹 دالة تعقيم عامة
    sanitize(dirty) {
        if (!this.sanitizer) {
            return this.escapeHTML(dirty);
        }
        return this.sanitizer.sanitize(dirty);
    }

    // 📝 تعقيم النصوص
    sanitizeText(text) {
        return this.escapeHTML(text);
    }

    // 🎨 تعقيم الألوان
    sanitizeColor(color) {
        // التحقق من لون CSS صالح
        const div = document.createElement('div');
        div.style.color = color;
        return div.style.color || '#000000';
    }

    // 🔢 تعقيم الأرقام
    sanitizeNumber(num) {
        return parseFloat(num) || 0;
    }

    // 📊 تعقيم عناوين URL
    sanitizeURL(url) {
        try {
            const parsed = new URL(url);
            // السماح بـ http و https فقط
            if (parsed.protocol === 'http:' || parsed.protocol === 'https:') {
                return parsed.toString();
            }
        } catch (e) {
            // URL غير صالح
        }
        return '#';
    }

    // 📧 تعقيم الإيميلات
    sanitizeEmail(email) {
        const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
        return emailRegex.test(email) ? email : '';
    }

    // 📱 تعقيب أرقام الهواتف
    sanitizePhone(phone) {
        return phone.replace(/[^\d+]/g, '');
    }
}

// 🚀 تهيئة نظام الحماية
document.addEventListener('DOMContentLoaded', () => {
    window.xssProtection = new XSSProtection();
    
    // إضافة دوال مساعدة عالمية
    window.sanitize = (dirty) => window.xssProtection.sanitize(dirty);
    window.sanitizeText = (text) => window.xssProtection.sanitizeText(text);
    window.sanitizeURL = (url) => window.xssProtection.sanitizeURL(url);
    window.sanitizeEmail = (email) => window.xssProtection.sanitizeEmail(email);
});
