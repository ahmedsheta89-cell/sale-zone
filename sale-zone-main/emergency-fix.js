// ============================================
// 🚨 EMERGENCY FIX - Force ServiceWorker Update
// ============================================

// Force unregister ALL ServiceWorkers
async function emergencyServiceWorkerFix() {
    try {
        console.log('🚨 EMERGENCY: Force fixing ServiceWorker...');
        
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
        
        // Step 3: Clear localStorage (optional)
        // localStorage.clear();
        
        // Step 4: Wait a bit
        await new Promise(resolve => setTimeout(resolve, 1000));
        
        // Step 5: Register new ServiceWorker
        const newRegistration = await navigator.serviceWorker.register('./sw.js', {
            scope: './'
        });
        
        console.log('✅ New ServiceWorker registered');
        
        // Step 6: Force refresh
        setTimeout(() => {
            console.log('🔄 Force refreshing page...');
            window.location.reload(true);
        }, 2000);
        
    } catch (error) {
        console.error('❌ Emergency fix failed:', error);
        // Try manual refresh
        window.location.reload(true);
    }
}

// Auto-execute immediately
if (navigator.serviceWorker) {
    emergencyServiceWorkerFix();
}

// Also make it global
window.emergencyServiceWorkerFix = emergencyServiceWorkerFix;
