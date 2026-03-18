/*
 * NSDS Workforce Suite — Service Worker
 * Neurocontextual Systems Design Suite · Enterprise
 * © 2026 Elizabeth Morrison, MS, LPC — Creative Solutions Coaching, PLLC
 *
 * SCOPED TO: /enterprise/
 * This service worker is completely separate from the consumer NSDS PWA.
 * It only caches files within /enterprise/ and has no visibility into
 * the rest of the site.
 *
 * VERSION: bump CACHE_VERSION by 1 every time you upload a new version
 * of the enterprise HTML file. The browser will detect the change,
 * clear the old cache, and fetch the fresh file automatically.
 */
const CACHE_VERSION = 1;
const CACHE_NAME = 'nsds-enterprise-v' + CACHE_VERSION;

/*
 * FILES TO CACHE
 * The enterprise tool is a single self-contained HTML file.
 * Add the icon paths once you have enterprise-specific icons.
 * Google Fonts are handled separately via network-first below.
 */
const CORE_FILES = [
  '/neurocontextual-systems-design-suite/index-enterprise.html',
  '/neurocontextual-systems-design-suite/manifest-enterprise.json',
  '/neurocontextual-systems-design-suite/icons/icon-192.png',
  '/neurocontextual-systems-design-suite/icons/icon-512.png',
];

/* ── INSTALL: pre-cache core files ── */
self.addEventListener('install', function(event) {
  event.waitUntil(
    caches.open(CACHE_NAME).then(function(cache) {
      /*
       * Individual adds rather than addAll — one missing file
       * (e.g. icons not yet uploaded) won't block the whole install.
       */
      return Promise.allSettled(
        CORE_FILES.map(function(url) {
          return cache.add(url).catch(function(err) {
            console.warn('[Enterprise SW] Could not pre-cache:', url, err);
          });
        })
      );
    }).then(function() {
      /* Activate immediately — don't wait for old tabs to close */
      return self.skipWaiting();
    })
  );
});

/* ── ACTIVATE: delete old enterprise cache versions only ── */
self.addEventListener('activate', function(event) {
  event.waitUntil(
    caches.keys().then(function(keys) {
      return Promise.all(
        keys.filter(function(key) {
          /* Only touch enterprise caches — never touch the consumer NSDS cache */
          return key.startsWith('nsds-enterprise-') && key !== CACHE_NAME;
        }).map(function(key) {
          console.log('[Enterprise SW] Deleting old cache:', key);
          return caches.delete(key);
        })
      );
    }).then(function() {
      return self.clients.claim();
    })
  );
});

/* ── FETCH ── */
self.addEventListener('fetch', function(event) {
  var url = new URL(event.request.url);

  /* Only handle GET requests */
  if (event.request.method !== 'GET') return;

  /* Only handle requests within /enterprise/ scope */
  if (!url.pathname.startsWith('/neurocontextual-systems-design-suite/')) return;

  /* Network-first for Google Fonts */
  if (url.hostname === 'fonts.googleapis.com' || url.hostname === 'fonts.gstatic.com') {
    event.respondWith(
      fetch(event.request).then(function(response) {
        var clone = response.clone();
        caches.open(CACHE_NAME).then(function(cache) {
          cache.put(event.request, clone);
        });
        return response;
      }).catch(function() {
        return caches.match(event.request);
      })
    );
    return;
  }

  /* Cache-first with background update for everything else */
  event.respondWith(
    caches.match(event.request).then(function(cached) {
      if (cached) {
        /* Serve cached, update in background */
        fetch(event.request).then(function(fresh) {
          if (fresh && fresh.status === 200) {
            caches.open(CACHE_NAME).then(function(cache) {
              cache.put(event.request, fresh);
            });
          }
        }).catch(function() { /* offline — cached version served */ });
        return cached;
      }
      /* Not cached — fetch and cache */
      return fetch(event.request).then(function(response) {
        if (!response || response.status !== 200 || response.type === 'opaque') {
          return response;
        }
        var clone = response.clone();
        caches.open(CACHE_NAME).then(function(cache) {
          cache.put(event.request, clone);
        });
        return response;
      });
    })
  );
});
