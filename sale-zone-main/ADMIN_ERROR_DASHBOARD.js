// ============================================
// 📊 Admin Error Dashboard
// ============================================
// لوحة تحكم احترافية لمراقبة الأخطاء
// ============================================

class AdminErrorDashboard {
    constructor() {
        this.isVisible = false;
        this.refreshInterval = null;
        this.initialize();
    }

    // 🚀 تهيئة لوحة التحكم
    initialize() {
        this.createDashboard();
        this.setupKeyboardShortcuts();
        this.setupRealTimeUpdates();
        
        console.log('📊 Admin Error Dashboard initialized');
        console.log('💡 Press Ctrl+Shift+E to toggle dashboard');
    }

    // 🎨 إنشاء لوحة التحكم
    createDashboard() {
        const dashboard = document.createElement('div');
        dashboard.id = 'adminErrorDashboard';
        dashboard.innerHTML = `
            <div class="dashboard-header">
                <h3>🔍 نظام مراقبة الأخطاء</h3>
                <div class="dashboard-controls">
                    <button onclick="errorDashboard.refresh()" class="dashboard-btn">🔄 تحديث</button>
                    <button onclick="errorDashboard.clearErrors()" class="dashboard-btn">🧹 مسح</button>
                    <button onclick="errorDashboard.exportReport()" class="dashboard-btn">📤 تصدير</button>
                    <button onclick="errorDashboard.toggle()" class="dashboard-btn close">✕</button>
                </div>
            </div>
            
            <div class="dashboard-content">
                <div class="dashboard-section">
                    <h4>🏥 صحة النظام</h4>
                    <div class="health-indicators">
                        <div class="health-item">
                            <span class="health-label">Firebase:</span>
                            <span id="health-firebase" class="health-status">🟢</span>
                        </div>
                        <div class="health-item">
                            <span class="health-label">LocalStorage:</span>
                            <span id="health-localstorage" class="health-status">🟢</span>
                        </div>
                        <div class="health-item">
                            <span class="health-label">DOM:</span>
                            <span id="health-dom" class="health-status">🟢</span>
                        </div>
                        <div class="health-item">
                            <span class="health-label">Network:</span>
                            <span id="health-network" class="health-status">🟢</span>
                        </div>
                    </div>
                </div>
                
                <div class="dashboard-section">
                    <h4>🔴 الأخطاء الأخيرة</h4>
                    <div id="recent-errors" class="error-list"></div>
                </div>
                
                <div class="dashboard-section">
                    <h4>🟡 التحذيرات الأخيرة</h4>
                    <div id="recent-warnings" class="warning-list"></div>
                </div>
                
                <div class="dashboard-section">
                    <h4>📊 الأداء</h4>
                    <div class="performance-metrics">
                        <div class="metric-item">
                            <span class="metric-label">وقت تحميل الصفحة:</span>
                            <span id="metric-load-time" class="metric-value">-</span>
                        </div>
                        <div class="metric-item">
                            <span class="metric-label">استدعاءات Firebase:</span>
                            <span id="metric-firebase-calls" class="metric-value">0</span>
                        </div>
                        <div class="metric-item">
                            <span class="metric-label">عمليات التخزين:</span>
                            <span id="metric-storage-ops" class="metric-value">0</span>
                        </div>
                    </div>
                </div>
                
                <div class="dashboard-section">
                    <h4>👤 إجراءات المستخدم</h4>
                    <div id="recent-actions" class="action-list"></div>
                </div>
            </div>
        `;

        // إضافة الستايل
        dashboard.innerHTML += `
            <style>
                #adminErrorDashboard {
                    position: fixed;
                    top: 50%;
                    left: 50%;
                    transform: translate(-50%, -50%);
                    width: 90%;
                    max-width: 1200px;
                    height: 80%;
                    max-height: 800px;
                    background: var(--white);
                    border-radius: 20px;
                    box-shadow: 0 20px 60px rgba(0,0,0,0.3);
                    z-index: 10000;
                    display: none;
                    flex-direction: column;
                    overflow: hidden;
                }
                
                #adminErrorDashboard.active {
                    display: flex;
                }
                
                .dashboard-header {
                    background: linear-gradient(135deg, var(--navy), var(--navy-light));
                    color: var(--gold);
                    padding: 20px;
                    display: flex;
                    justify-content: space-between;
                    align-items: center;
                }
                
                .dashboard-header h3 {
                    margin: 0;
                    font-size: 20px;
                }
                
                .dashboard-controls {
                    display: flex;
                    gap: 10px;
                }
                
                .dashboard-btn {
                    background: var(--gold);
                    color: var(--navy);
                    border: none;
                    padding: 8px 16px;
                    border-radius: 8px;
                    cursor: pointer;
                    font-weight: 600;
                    transition: var(--transition);
                }
                
                .dashboard-btn:hover {
                    background: var(--gold-dark);
                    transform: translateY(-2px);
                }
                
                .dashboard-btn.close {
                    background: var(--error);
                    color: var(--white);
                }
                
                .dashboard-content {
                    flex: 1;
                    padding: 20px;
                    overflow-y: auto;
                    display: grid;
                    grid-template-columns: repeat(auto-fit, minmax(300px, 1fr));
                    gap: 20px;
                }
                
                .dashboard-section {
                    background: var(--cream);
                    border-radius: 12px;
                    padding: 15px;
                }
                
                .dashboard-section h4 {
                    margin: 0 0 15px 0;
                    color: var(--navy);
                    font-size: 16px;
                }
                
                .health-indicators {
                    display: grid;
                    gap: 10px;
                }
                
                .health-item {
                    display: flex;
                    justify-content: space-between;
                    align-items: center;
                    padding: 8px;
                    background: var(--white);
                    border-radius: 8px;
                }
                
                .health-label {
                    font-weight: 600;
                    color: var(--navy);
                }
                
                .health-status {
                    font-size: 18px;
                }
                
                .error-list, .warning-list, .action-list {
                    max-height: 200px;
                    overflow-y: auto;
                }
                
                .error-item, .warning-item, .action-item {
                    padding: 8px;
                    margin-bottom: 5px;
                    border-radius: 6px;
                    font-size: 12px;
                }
                
                .error-item {
                    background: rgba(220, 53, 69, 0.1);
                    border-left: 3px solid var(--error);
                }
                
                .warning-item {
                    background: rgba(255, 193, 7, 0.1);
                    border-left: 3px solid var(--warning);
                }
                
                .action-item {
                    background: rgba(23, 162, 184, 0.1);
                    border-left: 3px solid var(--info);
                }
                
                .performance-metrics {
                    display: grid;
                    gap: 10px;
                }
                
                .metric-item {
                    display: flex;
                    justify-content: space-between;
                    align-items: center;
                    padding: 8px;
                    background: var(--white);
                    border-radius: 8px;
                }
                
                .metric-label {
                    font-weight: 600;
                    color: var(--navy);
                    font-size: 13px;
                }
                
                .metric-value {
                    font-weight: 700;
                    color: var(--gold);
                    font-size: 14px;
                }
                
                .timestamp {
                    font-size: 10px;
                    color: #888;
                    margin-top: 4px;
                }
            </style>
        `;

        document.body.appendChild(dashboard);
    }

    // ⌨️ إعداد اختصارات لوحة المفاتيح
    setupKeyboardShortcuts() {
        document.addEventListener('keydown', (event) => {
            // Ctrl+Shift+E لفتح/إغلاق لوحة التحكم
            if (event.ctrlKey && event.shiftKey && event.key === 'E') {
                event.preventDefault();
                this.toggle();
            }
        });
    }

    // 🔄 إعداد التحديثات الفورية
    setupRealTimeUpdates() {
        this.refreshInterval = setInterval(() => {
            if (this.isVisible) {
                this.refresh();
            }
        }, 5000); // تحديث كل 5 ثواني
    }

    // 🔄 تحديث لوحة التحكم
    refresh() {
        if (!window.errorDetectionSystem) {
            console.warn('⚠️ Error detection system not available');
            return;
        }

        const report = window.errorDetectionSystem.getSystemReport();
        
        // تحديث مؤشرات الصحة
        this.updateHealthIndicators(report.systemHealth);
        
        // تحديث الأخطاء
        this.updateErrors(report.errors);
        
        // تحديث التحذيرات
        this.updateWarnings(report.warnings);
        
        // تحديث الأداء
        this.updatePerformance(report.performance);
        
        // تحديث إجراءات المستخدم
        this.updateActions(report.recentActions);
        
        console.log('🔄 Dashboard refreshed');
    }

    // 🏥 تحديث مؤشرات الصحة
    updateHealthIndicators(health) {
        const indicators = {
            'health-firebase': health.firebase,
            'health-localstorage': health.localStorage,
            'health-dom': health.dom,
            'health-network': health.network
        };
        
        Object.entries(indicators).forEach(([id, status]) => {
            const element = document.getElementById(id);
            if (element) {
                element.textContent = status ? '🟢' : '🔴';
                element.style.color = status ? 'var(--success)' : 'var(--error)';
            }
        });
    }

    // 🔴 تحديث الأخطاء
    updateErrors(errors) {
        const container = document.getElementById('recent-errors');
        if (!container) return;
        
        if (errors.length === 0) {
            container.innerHTML = '<div class="error-item">لا توجد أخطاء ✅</div>';
            return;
        }
        
        container.innerHTML = errors.map(error => `
            <div class="error-item">
                <div><strong>${error.type}</strong></div>
                <div>${error.message}</div>
                <div class="timestamp">${new Date(error.timestamp).toLocaleString('ar-EG')}</div>
            </div>
        `).join('');
    }

    // 🟡 تحديث التحذيرات
    updateWarnings(warnings) {
        const container = document.getElementById('recent-warnings');
        if (!container) return;
        
        if (warnings.length === 0) {
            container.innerHTML = '<div class="warning-item">لا توجد تحذيرات ✅</div>';
            return;
        }
        
        container.innerHTML = warnings.map(warning => `
            <div class="warning-item">
                <div><strong>${warning.type}</strong></div>
                <div>${warning.message}</div>
                <div class="timestamp">${new Date(warning.timestamp).toLocaleString('ar-EG')}</div>
            </div>
        `).join('');
    }

    // 📊 تحديث الأداء
    updatePerformance(performance) {
        const metrics = {
            'metric-load-time': performance.pageLoadTime ? `${performance.pageLoadTime.toFixed(0)}ms` : '-',
            'metric-firebase-calls': window.errorDetectionSystem.firebaseCalls?.length || 0,
            'metric-storage-ops': window.errorDetectionSystem.storageOperations?.length || 0
        };
        
        Object.entries(metrics).forEach(([id, value]) => {
            const element = document.getElementById(id);
            if (element) {
                element.textContent = value;
            }
        });
    }

    // 👤 تحديث إجراءات المستخدم
    updateActions(actions) {
        const container = document.getElementById('recent-actions');
        if (!container) return;
        
        if (actions.length === 0) {
            container.innerHTML = '<div class="action-item">لا توجد إجراءات</div>';
            return;
        }
        
        container.innerHTML = actions.slice(-10).map(action => `
            <div class="action-item">
                <div><strong>${action.type}</strong> - ${action.element}</div>
                <div class="timestamp">${new Date(action.timestamp).toLocaleString('ar-EG')}</div>
            </div>
        `).join('');
    }

    // 🔄 تبديل عرض لوحة التحكم
    toggle() {
        const dashboard = document.getElementById('adminErrorDashboard');
        if (!dashboard) return;
        
        this.isVisible = !this.isVisible;
        dashboard.classList.toggle('active', this.isVisible);
        
        if (this.isVisible) {
            this.refresh();
            console.log('📊 Admin Error Dashboard opened');
        } else {
            console.log('📊 Admin Error Dashboard closed');
        }
    }

    // 🧹 مسح الأخطاء
    clearErrors() {
        if (window.errorDetectionSystem) {
            window.errorDetectionSystem.cleanup();
            this.refresh();
            console.log('🧹 Errors cleared');
        }
    }

    // 📤 تصدير التقرير
    exportReport() {
        if (!window.errorDetectionSystem) {
            console.warn('⚠️ Error detection system not available');
            return;
        }

        const report = window.errorDetectionSystem.getSystemReport();
        const reportText = JSON.stringify(report, null, 2);
        
        // إنشاء ملف للتحميل
        const blob = new Blob([reportText], { type: 'application/json' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `error-report-${new Date().toISOString().split('T')[0]}.json`;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
        
        console.log('📤 Error report exported');
    }

    // 🗑️ إغلاق لوحة التحكم
    destroy() {
        if (this.refreshInterval) {
            clearInterval(this.refreshInterval);
        }
        
        const dashboard = document.getElementById('adminErrorDashboard');
        if (dashboard) {
            dashboard.remove();
        }
    }
}

// 🚀 تهيئة لوحة تحكم الأخطاء
let errorDashboard;

document.addEventListener('DOMContentLoaded', function() {
    // تهيئة لوحة التحكم فقط في بيئة التطوير
    if (window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1') {
        errorDashboard = new AdminErrorDashboard();
        console.log('📊 Admin Error Dashboard loaded (Development Mode)');
        console.log('💡 Press Ctrl+Shift+E to open dashboard');
    }
});
