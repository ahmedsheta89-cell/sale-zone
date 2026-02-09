// =====================================================
// DEBUGGING ENHANCEMENTS - تحسينات متقدمة للتصحيح
// =====================================================

/**
 * نظام تصحيح متقدم مع:
 * - Performance monitoring
 * - Error tracking
 * - Memory usage monitoring
 * - Function execution tracing
 * - Real-time debugging
 */

class DebuggingEnhancements {
    constructor() {
        this.debugMode = true; // يمكن تعطيله في الإنتاج
        this.performanceMetrics = {
            functionCalls: {},
            renderTimes: {},
            memoryUsage: [],
            errorCounts: {},
            networkRequests: []
        };
        
        this.initialize();
    }

    // 🚀 تهيئة نظام التصحيح
    initialize() {
        if (!this.debugMode) return;
        
        console.log('🔍 Initializing debugging enhancements...');
        
        // إعداد performance monitoring
        this.setupPerformanceMonitoring();
        
        // إعداد function tracing
        this.setupFunctionTracing();
        
        // إعداد error tracking
        this.setupErrorTracking();
        
        // إعداد memory monitoring
        this.setupMemoryMonitoring();
        
        // إعداد network monitoring
        this.setupNetworkMonitoring();
        
        console.log('✅ Debugging enhancements initialized');
    }

    // 📊 Performance Monitoring
    setupPerformanceMonitoring() {
        // مراقبة سرعة الدوال
        const originalFetch = window.fetch;
        window.fetch = async (...args) => {
            const start = performance.now();
            const url = args[0];
            
            try {
                const response = await originalFetch(...args);
                const end = performance.now();
                
                this.recordPerformance('fetch', url, end - start);
                return response;
            } catch (error) {
                const end = performance.now();
                this.recordPerformance('fetch-error', url, end - start);
                throw error;
            }
        };
        
        // مراقبة render times
        this.monitorRenderPerformance();
    }

    // 🔍 Function Tracing
    setupFunctionTracing() {
        // تتبع استدعاء الدوال المهمة
        const criticalFunctions = [
            'loadData', 'renderProducts', 'addToCart', 'removeFromCart',
            'toggleFav', 'searchProducts', 'filterByCategory',
            'saveCart', 'saveFavorites', 'applyStoreSettings'
        ];
        
        criticalFunctions.forEach(funcName => {
            const original = window[funcName];
            if (original) {
                window[funcName] = function(...args) {
                    const start = performance.now();
                    console.log(`🔍 Calling: ${funcName}`, args);
                    
                    try {
                        const result = original.apply(this, args);
                        const end = performance.now();
                        
                        this.recordFunctionCall(funcName, end - start, true);
                        return result;
                    } catch (error) {
                        const end = performance.now();
                        this.recordFunctionCall(funcName, end - start, false, error);
                        throw error;
                    }
                };
                
                // نسخ الخصائص الأصلية
                Object.getOwnPropertyNames(original).forEach(prop => {
                    if (prop !== 'prototype' && prop !== 'name' && prop !== 'length') {
                        window[funcName][prop] = original[prop];
                    }
                });
            }
        });
    }

    // 🚨 Error Tracking
    setupErrorTracking() {
        // تتبع الأخطاء بشكل مفصل
        const originalConsoleError = console.error;
        const originalConsoleWarn = console.warn;
        
        console.error = function(...args) {
            const error = {
                message: args[0],
                stack: new Error().stack,
                timestamp: new Date().toISOString(),
                url: window.location.href,
                userAgent: navigator.userAgent,
                functionCall: this.getLastFunctionCall()
            };
            
            this.recordError('console-error', error);
            originalConsoleError.apply(console, args);
        };
        
        console.warn = function(...args) {
            const warning = {
                message: args[0],
                timestamp: new Date().toISOString(),
                functionCall: this.getLastFunctionCall()
            };
            
            this.recordError('console-warning', warning);
            originalConsoleWarn.apply(console, args);
        };
        
        // تتبع أخطاء JavaScript غير الملتقطة
        window.addEventListener('error', (event) => {
            const error = {
                message: event.message,
                filename: event.filename,
                lineno: event.lineno,
                colno: event.colno,
                stack: event.error?.stack,
                timestamp: new Date().toISOString(),
                userAgent: navigator.userAgent,
                functionCall: this.getLastFunctionCall()
            };
            
            this.recordError('javascript-error', error);
        });
    }

    // 🧠 Memory Monitoring
    setupMemoryMonitoring() {
        // مراقبة استخدام الذاكرة
        if ('memory' in performance) {
            setInterval(() => {
                const memory = performance.memory;
                if (memory) {
                    this.recordMemoryUsage(memory);
                }
            }, 5000); // كل 5 ثواني
        }
    }

    // 🌐 Network Monitoring
    setupNetworkMonitoring() {
        // مراقبة الطلبات الشبكية
        const originalXHROpen = XMLHttpRequest.prototype.open;
        
        XMLHttpRequest.prototype.open = function(method, url, ...args) {
            const request = {
                method,
                url,
                timestamp: new Date().toISOString(),
                userAgent: navigator.userAgent
            };
            
            this.recordNetworkRequest(request);
            return originalXHROpen.apply(this, [method, url, ...args]);
        };
    }

    // 📈 Performance Recording
    recordPerformance(operation, target, duration, success = true, error = null) {
        const key = `${operation}-${target}`;
        
        if (!this.performanceMetrics.functionCalls[key]) {
            this.performanceMetrics.functionCalls[key] = [];
        }
        
        this.performanceMetrics.functionCalls[key].push({
            duration,
            success,
            error,
            timestamp: new Date().toISOString()
        });
        
        // تحذير إذا كان الأداء سيئاً
        if (duration > 1000) {
            console.warn(`⚠️ Slow operation detected: ${operation} on ${target} took ${duration}ms`);
        }
    }

    // 🔍 Function Call Recording
    recordFunctionCall(functionName, duration, success = true, error = null) {
        const key = `function-${functionName}`;
        
        if (!this.performanceMetrics.functionCalls[key]) {
            this.performanceMetrics.functionCalls[key] = [];
        }
        
        this.performanceMetrics.functionCalls[key].push({
            duration,
            success,
            error,
            timestamp: new Date().toISOString()
        });
    }

    // 🚨 Error Recording
    recordError(type, error) {
        if (!this.performanceMetrics.errorCounts[type]) {
            this.performanceMetrics.errorCounts[type] = 0;
        }
        
        this.performanceMetrics.errorCounts[type]++;
        
        console.error(`🔍 ${type}:`, error);
    }

    // 🧠 Memory Recording
    recordMemoryUsage(memory) {
        this.performanceMetrics.memoryUsage.push({
            used: memory.usedJSHeapSize,
            total: memory.totalJSHeapSize,
            limit: memory.jsHeapSizeLimit,
            timestamp: new Date().toISOString()
        });
        
        // تحذير إذا كانت الذاكرة قريبة من الحد
        if (memory.usedJSHeapSize > memory.jsHeapSizeLimit * 0.9) {
            console.warn(`⚠️ High memory usage: ${(memory.usedJSHeapSize / 1024 / 1024).toFixed(2)}MB`);
        }
    }

    // 🌐 Network Request Recording
    recordNetworkRequest(request) {
        this.performanceMetrics.networkRequests.push({
            ...request,
            timestamp: new Date().toISOString()
        });
    }

    // 📊 Render Performance Monitoring
    monitorRenderPerformance() {
        // مراقبة أداء rendering
        const originalRender = window.requestAnimationFrame;
        
        window.requestAnimationFrame = function(callback) {
            const start = performance.now();
            
            return originalRender((timestamp) => {
                const end = performance.now();
                const duration = end - start;
                
                // تسجيل أداء rendering
                if (duration > 16.67) { // أكثر من 60fps
                    console.warn(`⚠️ Slow render detected: ${duration.toFixed(2)}ms`);
                }
                
                callback(timestamp);
            });
        };
    }

    // 🔍 Get Last Function Call
    getLastFunctionCall() {
        const calls = Object.keys(this.performanceMetrics.functionCalls);
        if (calls.length === 0) return null;
        
        const lastCall = calls[calls.length - 1];
        const lastCalls = this.performanceMetrics.functionCalls[lastCall];
        
        if (!lastCalls || lastCalls.length === 0) return null;
        
        return lastCalls[lastCalls.length - 1];
    }

    // 📊 Get Performance Report
    getPerformanceReport() {
        const report = {
            summary: {
                totalFunctionCalls: Object.keys(this.performanceMetrics.functionCalls).length,
                totalErrors: Object.values(this.performanceMetrics.errorCounts).reduce((a, b) => a + b, 0),
                totalNetworkRequests: this.performanceMetrics.networkRequests.length,
                memorySnapshots: this.performanceMetrics.memoryUsage.length
            },
            functionCalls: this.performanceMetrics.functionCalls,
            errors: this.performanceMetrics.errorCounts,
            networkRequests: this.performanceMetrics.networkRequests,
            memoryUsage: this.performanceMetrics.memoryUsage
        };
        
        console.log('📊 Performance Report:', report);
        return report;
    }

    // 🔍 Get Slow Functions
    getSlowFunctions(threshold = 100) { // 100ms threshold
        const slowFunctions = [];
        
        Object.entries(this.performanceMetrics.functionCalls).forEach(([funcName, calls]) => {
            const slowCalls = calls.filter(call => call.duration > threshold);
            
            if (slowCalls.length > 0) {
                slowFunctions.push({
                    functionName: funcName,
                    slowCalls: slowCalls.length,
                    averageDuration: slowCalls.reduce((sum, call) => sum + call.duration, 0) / slowCalls.length,
                    maxDuration: Math.max(...slowCalls.map(call => call.duration))
                });
            }
        });
        
        return slowFunctions;
    }

    // 🧹 Memory Cleanup
    cleanup() {
        console.log('🧹 Cleaning up debugging data...');
        
        // حذف البيانات القديمة
        const maxAge = 10 * 60 * 1000; // 10 دقائق
        const now = Date.now();
        
        // تنظيف function calls
        Object.keys(this.performanceMetrics.functionCalls).forEach(key => {
            this.performanceMetrics.functionCalls[key] = this.performanceMetrics.functionCalls[key].filter(
                call => now - new Date(call.timestamp).getTime() < maxAge
            );
        });
        
        // تنظيف memory usage
        this.performanceMetrics.memoryUsage = this.performanceMetrics.memoryUsage.filter(
            snapshot => now - new Date(snapshot.timestamp).getTime() < maxAge
        );
        
        // تنظيف network requests
        this.performanceMetrics.networkRequests = this.performanceMetrics.networkRequests.filter(
            request => now - new Date(request.timestamp).getTime() < maxAge
        );
        
        console.log('✅ Debugging data cleaned up');
    }

    // 🔍 Debug Panel
    showDebugPanel() {
        if (!this.debugMode) return;
        
        const panel = document.createElement('div');
        panel.id = 'debug-panel';
        panel.style.cssText = `
            position: fixed;
            top: 10px;
            right: 10px;
            width: 300px;
            max-height: 400px;
            background: rgba(0, 0, 0, 0.9);
            border: 1px solid #ff0000;
            border-radius: 8px;
            padding: 15px;
            font-family: monospace;
            font-size: 12px;
            color: #00ff00;
            z-index: 10000;
            overflow-y: auto;
            box-shadow: 0 4px 20px rgba(0, 0, 0, 0.3);
        `;
        
        const report = this.getPerformanceReport();
        const slowFunctions = this.getSlowFunctions();
        
        panel.innerHTML = `
            <div style="font-weight: bold; margin-bottom: 10px;">🔍 DEBUG PANEL</div>
            <div style="margin-bottom: 10px;">
                <strong>Summary:</strong><br>
                Function Calls: ${report.summary.totalFunctionCalls}<br>
                Errors: ${report.summary.totalErrors}<br>
                Network Requests: ${report.summary.totalNetworkRequests}<br>
                Memory Snapshots: ${report.summary.memorySnapshots}
            </div>
            <div style="margin-bottom: 10px;">
                <strong>Slow Functions (>100ms):</strong><br>
                ${slowFunctions.map(func => `
                    ${func.functionName}: ${func.slowCalls} calls, 
                    avg: ${func.averageDuration.toFixed(2)}ms, 
                    max: ${func.maxDuration.toFixed(2)}ms
                `).join('<br>')}
            </div>
            <div style="margin-bottom: 10px;">
                <button onclick="window.debugEnhancements.cleanup()" style="background: #ff0000; color: white; border: none; padding: 5px 10px; border-radius: 4px; cursor: pointer;">
                    🧹 Cleanup
                </button>
                <button onclick="window.debugEnhancements.getPerformanceReport()" style="background: #0000ff; color: white; border: none; padding: 5px 10px; border-radius: 4px; cursor: pointer; margin-left: 5px;">
                    📊 Report
                </button>
                <button onclick="this.parentElement.remove()" style="background: #666; color: white; border: none; padding: 5px 10px; border-radius: 4px; cursor: pointer; margin-left: 5px;">
                    ✕ Close
                </button>
            </div>
        `;
        
        document.body.appendChild(panel);
    }

    // 🎯 Toggle Debug Mode
    toggleDebugMode() {
        this.debugMode = !this.debugMode;
        console.log(`🔍 Debug mode ${this.debugMode ? 'ENABLED' : 'DISABLED'}`);
        
        if (this.debugMode) {
            this.showDebugPanel();
        } else {
            const panel = document.getElementById('debug-panel');
            if (panel) panel.remove();
        }
    }
}

// 🚀 التهيئة
if (typeof window !== 'undefined') {
    window.debugEnhancements = new DebuggingEnhancements();
    
    // إضافة اختصارات سريعة للتصحيح
    document.addEventListener('keydown', (e) => {
        // Ctrl+Shift+D لفتح لوحة التصحيح
        if (e.ctrlKey && e.shiftKey && e.key === 'D') {
            e.preventDefault();
            window.debugEnhancements.toggleDebugMode();
        }
        
        // Ctrl+Shift+R للحصول على تقرير الأداء
        if (e.ctrlKey && e.shiftKey && e.key === 'R') {
            e.preventDefault();
            console.log('📊 Performance Report:', window.debugEnhancements.getPerformanceReport());
        }
        
        // Ctrl+Shift+C للتنظيف البيانات
        if (e.ctrlKey && e.shiftKey && e.key === 'C') {
            e.preventDefault();
            window.debugEnhancements.cleanup();
        }
    });
    
    console.log('✅ Debugging enhancements loaded');
    console.log('🔧 Shortcuts: Ctrl+Shift+D (Debug Panel), Ctrl+Shift+R (Performance Report), Ctrl+Shift+C (Cleanup)');
}
