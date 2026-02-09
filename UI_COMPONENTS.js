// UI_COMPONENTS.js - Advanced UI Components for Sale Zone Store
// ==========================================================
// 🎨 مكونات واجهة متقدمة مع الحفاظ على الوظائف الحالية

// ==========================================
// 🎮 Gamification UI Components
// ==========================================

class GamificationUI {
    static showProfileStats() {
        if (!window.gamificationSystem) return;
        
        const stats = window.gamificationSystem.getProfileStats();
        
        const modal = document.createElement('div');
        modal.className = 'gamification-modal';
        modal.innerHTML = `
            <div class="modal-overlay" onclick="this.parentElement.remove()"></div>
            <div class="modal-content">
                <div class="modal-header">
                    <h3>🎮 ملفي الشخصي</h3>
                    <button class="close-btn" onclick="this.closest('.gamification-modal').remove()">×</button>
                </div>
                <div class="modal-body">
                    <div class="profile-stats">
                        <div class="stat-item">
                            <div class="stat-label">المستوى</div>
                            <div class="stat-value">${stats.level}</div>
                            <div class="progress-bar">
                                <div class="progress-fill" style="width: ${(stats.experience / stats.nextLevelExp) * 100}%"></div>
                            </div>
                        </div>
                        <div class="stat-item">
                            <div class="stat-label">النقاط</div>
                            <div class="stat-value">${stats.points}</div>
                        </div>
                        <div class="stat-item">
                            <div class="stat-label">الإنجازات</div>
                            <div class="stat-value">${stats.badges}</div>
                        </div>
                        <div class="stat-item">
                            <div class="stat-label">سلسلة الأيام</div>
                            <div class="stat-value">${stats.streak} 🔥</div>
                        </div>
                    </div>
                </div>
            </div>
        `;
        
        this.addModalStyles();
        document.body.appendChild(modal);
    }
    
    static showAchievements() {
        if (!window.gamificationSystem) return;
        
        const achievements = window.gamificationSystem.achievements;
        const userProfile = window.gamificationSystem.userProfile;
        
        const modal = document.createElement('div');
        modal.className = 'achievements-modal';
        modal.innerHTML = `
            <div class="modal-overlay" onclick="this.parentElement.remove()"></div>
            <div class="modal-content">
                <div class="modal-header">
                    <h3>🏆 الإنجازات</h3>
                    <button class="close-btn" onclick="this.closest('.achievements-modal').remove()">×</button>
                </div>
                <div class="modal-body">
                    <div class="achievements-grid">
                        ${Object.entries(achievements).map(([id, achievement]) => `
                            <div class="achievement-card ${userProfile.badges.includes(id) ? 'unlocked' : 'locked'}">
                                <div class="achievement-icon">${achievement.icon}</div>
                                <div class="achievement-info">
                                    <div class="achievement-name">${achievement.name}</div>
                                    <div class="achievement-desc">${achievement.description}</div>
                                    <div class="achievement-points">+${achievement.points} نقطة</div>
                                </div>
                                ${userProfile.badges.includes(id) ? '<div class="achievement-status">✅</div>' : '<div class="achievement-status">🔒</div>'}
                            </div>
                        `).join('')}
                    </div>
                </div>
            </div>
        `;
        
        this.addModalStyles();
        document.body.appendChild(modal);
    }
    
    static addModalStyles() {
        if (!document.querySelector('#gamification-styles')) {
            const styles = document.createElement('style');
            styles.id = 'gamification-styles';
            styles.textContent = `
                .gamification-modal, .achievements-modal {
                    position: fixed;
                    top: 0;
                    left: 0;
                    width: 100%;
                    height: 100%;
                    z-index: 10000;
                    display: flex;
                    align-items: center;
                    justify-content: center;
                }
                
                .modal-overlay {
                    position: absolute;
                    top: 0;
                    left: 0;
                    width: 100%;
                    height: 100%;
                    background: rgba(0, 0, 0, 0.5);
                    backdrop-filter: blur(5px);
                }
                
                .modal-content {
                    background: white;
                    border-radius: 20px;
                    padding: 0;
                    max-width: 500px;
                    width: 90%;
                    max-height: 80vh;
                    overflow: hidden;
                    box-shadow: 0 20px 60px rgba(0, 0, 0, 0.3);
                    position: relative;
                    animation: modalSlideIn 0.3s ease-out;
                }
                
                @keyframes modalSlideIn {
                    from {
                        opacity: 0;
                        transform: translateY(-50px) scale(0.9);
                    }
                    to {
                        opacity: 1;
                        transform: translateY(0) scale(1);
                    }
                }
                
                .modal-header {
                    background: linear-gradient(135deg, #0A1128, #1A2744);
                    color: #D4AF37;
                    padding: 20px;
                    display: flex;
                    justify-content: space-between;
                    align-items: center;
                }
                
                .modal-header h3 {
                    margin: 0;
                    font-family: 'Playfair Display', serif;
                    font-size: 24px;
                }
                
                .close-btn {
                    background: none;
                    border: none;
                    color: #D4AF37;
                    font-size: 24px;
                    cursor: pointer;
                    width: 30px;
                    height: 30px;
                    display: flex;
                    align-items: center;
                    justify-content: center;
                    border-radius: 50%;
                    transition: all 0.2s;
                }
                
                .close-btn:hover {
                    background: rgba(212, 175, 55, 0.2);
                }
                
                .modal-body {
                    padding: 30px;
                    max-height: 60vh;
                    overflow-y: auto;
                }
                
                .profile-stats {
                    display: grid;
                    gap: 20px;
                }
                
                .stat-item {
                    text-align: center;
                }
                
                .stat-label {
                    font-size: 14px;
                    color: #666;
                    margin-bottom: 8px;
                }
                
                .stat-value {
                    font-size: 32px;
                    font-weight: bold;
                    color: #0A1128;
                    margin-bottom: 10px;
                }
                
                .progress-bar {
                    width: 100%;
                    height: 8px;
                    background: #e0e0e0;
                    border-radius: 4px;
                    overflow: hidden;
                }
                
                .progress-fill {
                    height: 100%;
                    background: linear-gradient(90deg, #D4AF37, #B8960C);
                    border-radius: 4px;
                    transition: width 0.3s ease;
                }
                
                .achievements-grid {
                    display: grid;
                    gap: 15px;
                }
                
                .achievement-card {
                    display: flex;
                    align-items: center;
                    gap: 15px;
                    padding: 15px;
                    border-radius: 12px;
                    border: 2px solid #e0e0e0;
                    transition: all 0.3s ease;
                }
                
                .achievement-card.unlocked {
                    border-color: #D4AF37;
                    background: linear-gradient(135deg, rgba(212, 175, 55, 0.1), rgba(212, 175, 55, 0.05));
                }
                
                .achievement-card.locked {
                    opacity: 0.6;
                }
                
                .achievement-icon {
                    font-size: 32px;
                    width: 50px;
                    text-align: center;
                }
                
                .achievement-info {
                    flex: 1;
                }
                
                .achievement-name {
                    font-weight: bold;
                    color: #0A1128;
                    margin-bottom: 4px;
                }
                
                .achievement-desc {
                    font-size: 12px;
                    color: #666;
                    margin-bottom: 4px;
                }
                
                .achievement-points {
                    font-size: 11px;
                    color: #D4AF37;
                    font-weight: bold;
                }
                
                .achievement-status {
                    font-size: 20px;
                }
            `;
            document.head.appendChild(styles);
        }
    }
}

// ==========================================
// 🤖 AI Support UI Components
// ==========================================

class AISupportUI {
    static createChatWidget() {
        if (!window.aiSupport) return;
        
        const widget = document.createElement('div');
        widget.className = 'ai-support-widget';
        widget.innerHTML = `
            <div class="chat-header" onclick="this.parentElement.classList.toggle('expanded')">
                <div class="header-content">
                    <div class="bot-avatar">🤖</div>
                    <div class="bot-info">
                        <div class="bot-name">مساعد ذكي</div>
                        <div class="bot-status">متصل الآن</div>
                    </div>
                </div>
                <button class="toggle-btn">💬</button>
            </div>
            <div class="chat-body">
                <div class="chat-messages" id="aiChatMessages">
                    <div class="bot-message">
                        <div class="message-content">${window.aiSupport.startChat()}</div>
                        <div class="message-time">${new Date().toLocaleTimeString('ar-EG')}</div>
                    </div>
                </div>
                <div class="quick-actions">
                    ${window.aiSupport.getQuickActions().map(action => `
                        <button class="quick-action-btn" onclick="window.aiSupportUI.sendQuickAction('${action.action}')">
                            ${action.text}
                        </button>
                    `).join('')}
                </div>
                <div class="chat-input">
                    <input type="text" id="aiChatInput" placeholder="اكتب سؤالك..." onkeypress="if(event.key==='Enter') window.aiSupportUI.sendMessage()">
                    <button onclick="window.aiSupportUI.sendMessage()">➤</button>
                </div>
            </div>
        `;
        
        this.addChatStyles();
        document.body.appendChild(widget);
        
        // Store reference
        window.aiSupportUI = this;
    }
    
    static sendMessage() {
        const input = document.getElementById('aiChatInput');
        const messagesContainer = document.getElementById('aiChatMessages');
        
        if (!input.value.trim()) return;
        
        const userMessage = input.value.trim();
        input.value = '';
        
        // Add user message
        this.addMessage('user', userMessage);
        
        // Simulate typing
        this.addMessage('bot', '...');
        
        // Get AI response
        setTimeout(() => {
            const lastMessage = messagesContainer.lastElementChild;
            const botResponse = window.aiSupport.processMessage(userMessage);
            lastMessage.querySelector('.message-content').textContent = botResponse;
            lastMessage.querySelector('.message-time').textContent = new Date().toLocaleTimeString('ar-EG');
        }, 1000);
    }
    
    static sendQuickAction(action) {
        const messagesContainer = document.getElementById('aiChatMessages');
        this.addMessage('user', action);
        
        setTimeout(() => {
            const response = window.aiSupport.processMessage(action);
            this.addMessage('bot', response);
        }, 500);
    }
    
    static addMessage(sender, content) {
        const messagesContainer = document.getElementById('aiChatMessages');
        const messageDiv = document.createElement('div');
        messageDiv.className = `${sender}-message`;
        messageDiv.innerHTML = `
            <div class="message-content">${content}</div>
            <div class="message-time">${new Date().toLocaleTimeString('ar-EG')}</div>
        `;
        messagesContainer.appendChild(messageDiv);
        messagesContainer.scrollTop = messagesContainer.scrollHeight;
    }
    
    static addChatStyles() {
        if (!document.querySelector('#ai-support-styles')) {
            const styles = document.createElement('style');
            styles.id = 'ai-support-styles';
            styles.textContent = `
                .ai-support-widget {
                    position: fixed;
                    bottom: 20px;
                    left: 20px;
                    width: 350px;
                    height: 60px;
                    background: white;
                    border-radius: 20px;
                    box-shadow: 0 10px 40px rgba(0, 0, 0, 0.2);
                    z-index: 9999;
                    transition: all 0.3s ease;
                    overflow: hidden;
                }
                
                .ai-support-widget.expanded {
                    height: 500px;
                }
                
                .chat-header {
                    padding: 15px 20px;
                    background: linear-gradient(135deg, #0A1128, #1A2744);
                    color: white;
                    cursor: pointer;
                    display: flex;
                    justify-content: space-between;
                    align-items: center;
                }
                
                .header-content {
                    display: flex;
                    align-items: center;
                    gap: 12px;
                }
                
                .bot-avatar {
                    font-size: 24px;
                    width: 40px;
                    height: 40px;
                    background: rgba(212, 175, 55, 0.2);
                    border-radius: 50%;
                    display: flex;
                    align-items: center;
                    justify-content: center;
                }
                
                .bot-name {
                    font-weight: bold;
                    font-size: 14px;
                }
                
                .bot-status {
                    font-size: 11px;
                    opacity: 0.8;
                }
                
                .toggle-btn {
                    background: none;
                    border: none;
                    color: white;
                    font-size: 20px;
                    cursor: pointer;
                    transition: transform 0.3s ease;
                }
                
                .ai-support-widget.expanded .toggle-btn {
                    transform: rotate(180deg);
                }
                
                .chat-body {
                    height: calc(100% - 60px);
                    display: flex;
                    flex-direction: column;
                    opacity: 0;
                    visibility: hidden;
                    transition: all 0.3s ease;
                }
                
                .ai-support-widget.expanded .chat-body {
                    opacity: 1;
                    visibility: visible;
                }
                
                .chat-messages {
                    flex: 1;
                    padding: 20px;
                    overflow-y: auto;
                    display: flex;
                    flex-direction: column;
                    gap: 10px;
                }
                
                .bot-message, .user-message {
                    max-width: 80%;
                    animation: messageSlideIn 0.3s ease;
                }
                
                @keyframes messageSlideIn {
                    from {
                        opacity: 0;
                        transform: translateY(10px);
                    }
                    to {
                        opacity: 1;
                        transform: translateY(0);
                    }
                }
                
                .bot-message {
                    align-self: flex-start;
                }
                
                .user-message {
                    align-self: flex-end;
                }
                
                .message-content {
                    padding: 10px 15px;
                    border-radius: 15px;
                    margin-bottom: 4px;
                    font-size: 14px;
                    line-height: 1.4;
                }
                
                .bot-message .message-content {
                    background: #f0f0f0;
                    color: #333;
                    border-bottom-left-radius: 4px;
                }
                
                .user-message .message-content {
                    background: linear-gradient(135deg, #D4AF37, #B8960C);
                    color: white;
                    border-bottom-right-radius: 4px;
                }
                
                .message-time {
                    font-size: 10px;
                    color: #999;
                    text-align: right;
                }
                
                .user-message .message-time {
                    text-align: left;
                }
                
                .quick-actions {
                    padding: 0 20px;
                    display: flex;
                    gap: 8px;
                    flex-wrap: wrap;
                }
                
                .quick-action-btn {
                    padding: 8px 12px;
                    border: 1px solid #D4AF37;
                    background: white;
                    color: #D4AF37;
                    border-radius: 20px;
                    font-size: 12px;
                    cursor: pointer;
                    transition: all 0.2s ease;
                }
                
                .quick-action-btn:hover {
                    background: #D4AF37;
                    color: white;
                }
                
                .chat-input {
                    padding: 15px 20px;
                    border-top: 1px solid #e0e0e0;
                    display: flex;
                    gap: 10px;
                }
                
                .chat-input input {
                    flex: 1;
                    padding: 10px 15px;
                    border: 1px solid #e0e0e0;
                    border-radius: 25px;
                    font-size: 14px;
                    outline: none;
                }
                
                .chat-input input:focus {
                    border-color: #D4AF37;
                }
                
                .chat-input button {
                    width: 40px;
                    height: 40px;
                    border-radius: 50%;
                    background: #D4AF37;
                    color: white;
                    border: none;
                    cursor: pointer;
                    font-size: 16px;
                    transition: all 0.2s ease;
                }
                
                .chat-input button:hover {
                    background: #B8960C;
                    transform: scale(1.05);
                }
            `;
            document.head.appendChild(styles);
        }
    }
}

// ==========================================
// 📊 Analytics Dashboard UI
// ==========================================

class AnalyticsDashboardUI {
    static showQuickInsights() {
        if (!window.advancedAnalytics) return;
        
        const insights = window.advancedAnalytics.getInsights();
        
        const dashboard = document.createElement('div');
        dashboard.className = 'analytics-dashboard';
        dashboard.innerHTML = `
            <div class="dashboard-overlay" onclick="this.parentElement.remove()"></div>
            <div class="dashboard-content">
                <div class="dashboard-header">
                    <h3>📊 تحليلات سريعة</h3>
                    <button class="close-btn" onclick="this.closest('.analytics-dashboard').remove()">×</button>
                </div>
                <div class="dashboard-body">
                    <div class="insights-grid">
                        <div class="insight-card">
                            <div class="insight-icon">👥</div>
                            <div class="insight-data">
                                <div class="insight-value">${insights.totalSessions}</div>
                                <div class="insight-label">جلسات نشطة</div>
                            </div>
                        </div>
                        <div class="insight-card">
                            <div class="insight-icon">👁️</div>
                            <div class="insight-data">
                                <div class="insight-value">${insights.totalPageViews}</div>
                                <div class="insight-label">مشاهدات الصفحة</div>
                            </div>
                        </div>
                        <div class="insight-card">
                            <div class="insight-icon">📈</div>
                            <div class="insight-data">
                                <div class="insight-value">${insights.userEngagement}%</div>
                                <div class="insight-label">معدل التفاعل</div>
                            </div>
                        </div>
                        <div class="insight-card">
                            <div class="insight-icon">🎯</div>
                            <div class="insight-data">
                                <div class="insight-value">${insights.conversionRate}%</div>
                                <div class="insight-label">معدل التحويل</div>
                            </div>
                        </div>
                    </div>
                    
                    <div class="top-products">
                        <h4>🔥 المنتجات الأكثر شعبية</h4>
                        <div class="products-list">
                            ${insights.topProducts.map((product, index) => `
                                <div class="product-item">
                                    <div class="product-rank">#${index + 1}</div>
                                    <div class="product-info">
                                        <div class="product-name">${product.product?.name || 'منتج غير معروف'}</div>
                                        <div class="product-score">نقاط: ${product.score}</div>
                                    </div>
                                </div>
                            `).join('')}
                        </div>
                    </div>
                </div>
            </div>
        `;
        
        this.addDashboardStyles();
        document.body.appendChild(dashboard);
    }
    
    static addDashboardStyles() {
        if (!document.querySelector('#analytics-dashboard-styles')) {
            const styles = document.createElement('style');
            styles.id = 'analytics-dashboard-styles';
            styles.textContent = `
                .analytics-dashboard {
                    position: fixed;
                    top: 0;
                    left: 0;
                    width: 100%;
                    height: 100%;
                    z-index: 10000;
                    display: flex;
                    align-items: center;
                    justify-content: center;
                }
                
                .dashboard-overlay {
                    position: absolute;
                    top: 0;
                    left: 0;
                    width: 100%;
                    height: 100%;
                    background: rgba(0, 0, 0, 0.5);
                    backdrop-filter: blur(5px);
                }
                
                .dashboard-content {
                    background: white;
                    border-radius: 20px;
                    padding: 0;
                    max-width: 600px;
                    width: 90%;
                    max-height: 80vh;
                    overflow: hidden;
                    box-shadow: 0 20px 60px rgba(0, 0, 0, 0.3);
                    position: relative;
                }
                
                .dashboard-header {
                    background: linear-gradient(135deg, #0A1128, #1A2744);
                    color: #D4AF37;
                    padding: 20px;
                    display: flex;
                    justify-content: space-between;
                    align-items: center;
                }
                
                .dashboard-header h3 {
                    margin: 0;
                    font-family: 'Playfair Display', serif;
                    font-size: 24px;
                }
                
                .dashboard-body {
                    padding: 30px;
                    max-height: 60vh;
                    overflow-y: auto;
                }
                
                .insights-grid {
                    display: grid;
                    grid-template-columns: repeat(auto-fit, minmax(120px, 1fr));
                    gap: 20px;
                    margin-bottom: 30px;
                }
                
                .insight-card {
                    text-align: center;
                    padding: 20px;
                    border-radius: 12px;
                    background: linear-gradient(135deg, rgba(212, 175, 55, 0.1), rgba(212, 175, 55, 0.05));
                    border: 1px solid rgba(212, 175, 55, 0.2);
                    transition: transform 0.3s ease;
                }
                
                .insight-card:hover {
                    transform: translateY(-5px);
                }
                
                .insight-icon {
                    font-size: 32px;
                    margin-bottom: 10px;
                }
                
                .insight-value {
                    font-size: 24px;
                    font-weight: bold;
                    color: #0A1128;
                    margin-bottom: 5px;
                }
                
                .insight-label {
                    font-size: 12px;
                    color: #666;
                }
                
                .top-products h4 {
                    color: #0A1128;
                    margin-bottom: 15px;
                    font-family: 'Playfair Display', serif;
                }
                
                .products-list {
                    display: flex;
                    flex-direction: column;
                    gap: 10px;
                }
                
                .product-item {
                    display: flex;
                    align-items: center;
                    gap: 15px;
                    padding: 10px;
                    border-radius: 8px;
                    background: #f8f8f8;
                    transition: background 0.2s ease;
                }
                
                .product-item:hover {
                    background: #f0f0f0;
                }
                
                .product-rank {
                    font-size: 18px;
                    font-weight: bold;
                    color: #D4AF37;
                    width: 30px;
                    text-align: center;
                }
                
                .product-info {
                    flex: 1;
                }
                
                .product-name {
                    font-weight: 600;
                    color: #0A1128;
                    margin-bottom: 2px;
                }
                
                .product-score {
                    font-size: 12px;
                    color: #666;
                }
            `;
            document.head.appendChild(styles);
        }
    }
}

// ==========================================
// 🎯 Initialize UI Components
// ==========================================

// Initialize when DOM is ready
document.addEventListener('DOMContentLoaded', () => {
    // Initialize UI components
    setTimeout(() => {
        // Add gamification profile button to user menu
        const userDropdown = document.querySelector('.user-dropdown');
        if (userDropdown && window.gamificationSystem) {
            const profileBtn = document.createElement('button');
            profileBtn.innerHTML = '🎮 ملفي الشخصي';
            profileBtn.onclick = () => GamificationUI.showProfileStats();
            userDropdown.appendChild(profileBtn);
        }
        
        // Create AI support widget
        if (window.aiSupport) {
            AISupportUI.createChatWidget();
        }
        
        // Add analytics button for admin
        if (window.advancedAnalytics && currentUser) {
            const analyticsBtn = document.createElement('button');
            analyticsBtn.className = 'analytics-btn';
            analyticsBtn.innerHTML = '📊';
            analyticsBtn.style.cssText = `
                position: fixed;
                top: 20px;
                right: 20px;
                width: 50px;
                height: 50px;
                border-radius: 50%;
                background: linear-gradient(135deg, #D4AF37, #B8960C);
                color: white;
                border: none;
                font-size: 20px;
                cursor: pointer;
                box-shadow: 0 4px 20px rgba(212, 175, 55, 0.3);
                z-index: 9998;
                transition: all 0.3s ease;
            `;
            analyticsBtn.onclick = () => AnalyticsDashboardUI.showQuickInsights();
            analyticsBtn.onmouseover = () => analyticsBtn.style.transform = 'scale(1.1)';
            analyticsBtn.onmouseout = () => analyticsBtn.style.transform = 'scale(1)';
            document.body.appendChild(analyticsBtn);
        }
    }, 2000);
    
    console.log('✅ UI Components initialized successfully');
});

// Make available globally
window.UIComponents = {
    GamificationUI,
    AISupportUI,
    AnalyticsDashboardUI
};
