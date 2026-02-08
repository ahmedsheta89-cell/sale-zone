// ============================================
// 🚫 COMPLETE ServiceWorker Disable Script
// ============================================
// تعطيل ServiceWorker بالكامل وحل جميع المشاكل
// ============================================

// Force disable ALL ServiceWorkers
async function completelyDisableServiceWorker() {
    try {
        console.log('🚫 Completely disabling ServiceWorker...');
        
        // Step 1: Unregister all ServiceWorkers
        const registrations = await navigator.serviceWorker.getRegistrations();
        for (let registration of registrations) {
            await registration.unregister();
            console.log('🗑️ Unregistered:', registration.scope);
        }
        
        // Step 2: Clear all caches
        const cacheNames = await caches.keys();
        await Promise.all(
            cacheNames.map(cacheName => caches.delete(cacheName))
        );
        console.log('🗑️ Cleared all caches:', cacheNames.length);
        
        // Step 3: Prevent future registration
        if (navigator.serviceWorker) {
            // Override the register method to prevent future registration
            navigator.serviceWorker.register = () => {
                console.log('🚫 ServiceWorker registration blocked');
                return Promise.reject(new Error('ServiceWorker disabled'));
            };
        }
        
        console.log('✅ ServiceWorker completely disabled');
        
        // Step 4: Force refresh
        setTimeout(() => {
            console.log('🔄 Refreshing without ServiceWorker...');
            window.location.reload(true);
        }, 1000);
        
    } catch (error) {
        console.error('❌ Error disabling ServiceWorker:', error);
        window.location.reload(true);
    }
}

// Auto-execute immediately
if (navigator.serviceWorker) {
    completelyDisableServiceWorker();
}

// Make it global
window.completelyDisableServiceWorker = completelyDisableServiceWorker;
