// ============================================
// 🔄 Force ServiceWorker Update Script
// ============================================
// إضافة هذا السكربت للصفحات لإجبار تحديث ServiceWorker
// ============================================

// Force unregister and reregister ServiceWorker
async function forceServiceWorkerUpdate() {
    try {
        console.log('🔄 Forcing ServiceWorker update...');
        
        // unregister all ServiceWorkers
        const registrations = await navigator.serviceWorker.getRegistrations();
        for (let registration of registrations) {
            await registration.unregister();
            console.log('🗑️ Unregistered ServiceWorker:', registration.scope);
        }
        
        // clear all caches
        const cacheNames = await caches.keys();
        await Promise.all(
            cacheNames.map(cacheName => caches.delete(cacheName))
        );
        console.log('🗑️ Cleared all caches');
        
        // register new ServiceWorker
        const newRegistration = await navigator.serviceWorker.register('./sw.js', {
            scope: './'
        });
        
        console.log('✅ New ServiceWorker registered:', newRegistration.scope);
        
        // force refresh
        setTimeout(() => {
            window.location.reload();
        }, 1000);
        
    } catch (error) {
        console.error('❌ Error updating ServiceWorker:', error);
    }
}

// Auto-execute if needed
if (navigator.serviceWorker) {
    // Check if we need to force update (based on URL parameter)
    const urlParams = new URLSearchParams(window.location.search);
    if (urlParams.get('force-sw-update') === 'true') {
        forceServiceWorkerUpdate();
    }
}

// Make function global
window.forceServiceWorkerUpdate = forceServiceWorkerUpdate;
