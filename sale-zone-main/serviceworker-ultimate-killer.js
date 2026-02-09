// 🚫 ServiceWorker Ultimate Killer - Final Solution
// ============================================
// Forcefully remove ALL ServiceWorkers and prevent ANY future registration

(function killServiceWorkerUltimate() {
    console.log('🚫 Starting ServiceWorker Ultimate Killer...');
    
    // Step 1: Unregister ALL ServiceWorkers
    if ('serviceWorker' in navigator) {
        navigator.serviceWorker.getRegistrations().then(function(registrations) {
            console.log(`🗑️ Found ${registrations.length} ServiceWorkers to unregister`);
            
            registrations.forEach(function(registration) {
                console.log('🗑️ Unregistering:', registration.scope);
                registration.unregister().then(function(success) {
                    if (success) {
                        console.log('✅ Successfully unregistered:', registration.scope);
                    } else {
                        console.log('❌ Failed to unregister:', registration.scope);
                    }
                });
            });
        }).catch(function(error) {
            console.error('❌ Error getting registrations:', error);
        });
    }
    
    // Step 2: Clear ALL caches
    if ('caches' in window) {
        caches.keys().then(function(cacheNames) {
            console.log(`🗑️ Found ${cacheNames.length} caches to clear`);
            
            Promise.all(
                cacheNames.map(function(cacheName) {
                    console.log('🗑️ Clearing cache:', cacheName);
                    return caches.delete(cacheName);
                })
            ).then(function() {
                console.log('✅ All caches cleared');
            }).catch(function(error) {
                console.error('❌ Error clearing caches:', error);
            });
        });
    }
    
    // Step 3: Override ServiceWorker API to prevent ANY future registration
    if (navigator.serviceWorker) {
        // Block register method
        Object.defineProperty(navigator.serviceWorker, 'register', {
            value: function() {
                console.log('🚫 ServiceWorker registration BLOCKED!');
                return Promise.reject(new Error('ServiceWorker is disabled in this application'));
            },
            writable: false,
            configurable: false
        });
        
        // Block getRegistration method
        Object.defineProperty(navigator.serviceWorker, 'getRegistration', {
            value: function() {
                console.log('🚫 ServiceWorker getRegistration BLOCKED!');
                return Promise.resolve(undefined);
            },
            writable: false,
            configurable: false
        });
        
        // Block getRegistrations method
        Object.defineProperty(navigator.serviceWorker, 'getRegistrations', {
            value: function() {
                console.log('🚫 ServiceWorker getRegistrations BLOCKED!');
                return Promise.resolve([]);
            },
            writable: false,
            configurable: false
        });
    }
    
    // Step 4: Remove any existing sw.js references
    const scripts = document.querySelectorAll('script[src*="sw.js"]');
    scripts.forEach(function(script) {
        console.log('🗑️ Removing sw.js script:', script.src);
        script.remove();
    });
    
    // Step 5: Prevent any future sw.js loading
    document.addEventListener('beforescriptexecute', function(e) {
        if (e.target.src && e.target.src.includes('sw.js')) {
            console.log('🚫 Blocking sw.js script execution:', e.target.src);
            e.preventDefault();
            e.stopPropagation();
        }
    });
    
    // Step 6: Override fetch to prevent ServiceWorker interception
    if (window.fetch) {
        const originalFetch = window.fetch;
        window.fetch = function(input, init) {
            // If this looks like a ServiceWorker fetch request, block it
            if (typeof input === 'string' && input.includes('sw.js')) {
                console.log('🚫 Blocking sw.js fetch request:', input);
                return Promise.reject(new Error('ServiceWorker requests are blocked'));
            }
            
            // Allow all other requests
            return originalFetch.apply(this, arguments);
        };
    }
    
    // Step 7: Clear any pending ServiceWorker messages
    if (navigator.serviceWorker && navigator.serviceWorker.controller) {
        navigator.serviceWorker.controller.postMessage({
            type: 'KILL_SERVICE_WORKER'
        });
    }
    
    // Step 8: Force reload to clear any remaining ServiceWorker state
    setTimeout(function() {
        console.log('🔄 Forcing page reload to clear ServiceWorker state...');
        window.location.reload(true);
    }, 1000);
    
    console.log('✅ ServiceWorker Ultimate Killer activated!');
})();
