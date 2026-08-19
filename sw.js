// Service Worker for ECampus Offline-First App
const CACHE_NAME = 'ecampus-v1';
const RUNTIME_CACHE = 'ecampus-runtime-v1';
const OFFLINE_PAGE = '/offline.html';

// Assets to cache on install
const STATIC_ASSETS = [
  '/',
  '/index.html',
  '/offline.html'
];

// Install event - cache static assets
self.addEventListener('install', (event) => {
  console.log('[ServiceWorker] Installing...');
  
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then((cache) => {
        console.log('[ServiceWorker] Caching static assets');
        return cache.addAll(STATIC_ASSETS);
      })
      .then(() => {
        console.log('[ServiceWorker] Install complete');
        return self.skipWaiting(); // Activate immediately
      })
      .catch((error) => {
        console.error('[ServiceWorker] Install failed:', error);
      })
  );
});

// Activate event - cleanup old caches
self.addEventListener('activate', (event) => {
  console.log('[ServiceWorker] Activating...');
  
  event.waitUntil(
    caches.keys()
      .then((cacheNames) => {
        return Promise.all(
          cacheNames.map((cacheName) => {
            if (cacheName !== CACHE_NAME && cacheName !== RUNTIME_CACHE) {
              console.log('[ServiceWorker] Deleting old cache:', cacheName);
              return caches.delete(cacheName);
            }
          })
        );
      })
      .then(() => {
        console.log('[ServiceWorker] Activation complete');
        return self.clients.claim(); // Take control immediately
      })
  );
});

// Fetch event - implement offline-first strategy
self.addEventListener('fetch', (event) => {
  const { request } = event;
  const url = new URL(request.url);

  // Skip cross-origin requests
  if (url.origin !== location.origin) {
    return;
  }

  // Skip non-GET requests
  if (request.method !== 'GET') {
    return;
  }

  // Handle HTML pages - Network first, fallback to cache, then offline page
  if (request.mode === 'navigate' || request.headers.get('accept')?.includes('text/html')) {
    event.respondWith(
      fetch(request)
        .then((response) => {
          // Only cache successful responses
          if (response.ok) {
            const cache_clone = response.clone();
            caches.open(RUNTIME_CACHE).then((cache) => {
              cache.put(request, cache_clone);
            });
          }
          return response;
        })
        .catch(() => {
          // Network failed, try cache
          return caches.match(request)
            .then((response) => {
              if (response) {
                console.log('[ServiceWorker] Serving from cache:', request.url);
                return response;
              }
              // Return offline page
              return caches.match(OFFLINE_PAGE);
            });
        })
    );
    return;
  }

  // Handle API requests - Network first with timeout
  if (url.pathname.includes('/api/') || url.pathname.includes('/data/')) {
    event.respondWith(
      Promise.race([
        fetch(request),
        new Promise((resolve) => {
          setTimeout(() => resolve(null), 5000); // 5 second timeout
        })
      ])
        .then((response) => {
          if (response && response.ok) {
            const cache_clone = response.clone();
            caches.open(RUNTIME_CACHE).then((cache) => {
              cache.put(request, cache_clone);
            });
            return response;
          }
          // Try cache if network failed or timed out
          return caches.match(request);
        })
        .catch(() => {
          return caches.match(request);
        })
    );
    return;
  }

  // Handle other assets (JS, CSS, images) - Cache first, fallback to network
  event.respondWith(
    caches.match(request)
      .then((response) => {
        if (response) {
          console.log('[ServiceWorker] Serving from cache:', request.url);
          return response;
        }

        return fetch(request)
          .then((response) => {
            // Only cache successful responses
            if (response.ok) {
              const cache_clone = response.clone();
              caches.open(RUNTIME_CACHE).then((cache) => {
                cache.put(request, cache_clone);
              });
            }
            return response;
          })
          .catch(() => {
            // Fallback for assets
            console.warn('[ServiceWorker] Failed to fetch:', request.url);
            // Could return a placeholder image or empty response
            return new Response('', { status: 404 });
          });
      })
  );
});

// Background sync for queuing actions while offline
self.addEventListener('sync', (event) => {
  if (event.tag === 'sync-data') {
    event.waitUntil(syncData());
  }
});

async function syncData() {
  try {
    // Sync any pending actions/data when connection is restored
    const db = await openDB();
    const pendingActions = await db.getAllFromIndex('pendingActions', 'synced', false);
    
    for (const action of pendingActions) {
      try {
        // Attempt to sync the action
        const response = await fetch(action.endpoint, {
          method: action.method,
          body: JSON.stringify(action.data),
          headers: { 'Content-Type': 'application/json' }
        });

        if (response.ok) {
          // Mark as synced
          action.synced = true;
          await db.put('pendingActions', action);
        }
      } catch (error) {
        console.error('[ServiceWorker] Sync failed for action:', action, error);
      }
    }
  } catch (error) {
    console.error('[ServiceWorker] Background sync error:', error);
  }
}

// Message handling
self.addEventListener('message', (event) => {
  if (event.data && event.data.type === 'SKIP_WAITING') {
    self.skipWaiting();
  }
});

// Helper function to open IndexedDB for storing pending actions
function openDB() {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open('ECampusDB', 1);
    
    request.onerror = () => reject(request.error);
    request.onsuccess = () => resolve(request.result);
    
    request.onupgradeneeded = (event) => {
      const db = event.target.result;
      if (!db.objectStoreNames.contains('pendingActions')) {
        const store = db.createObjectStore('pendingActions', { keyPath: 'id' });
        store.createIndex('synced', 'synced', { unique: false });
      }
    };
  });
}
