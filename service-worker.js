/*
 * NSDS Service Worker
 * Neurocontextual Systems Design Suite
 * © 2026 Elizabeth Morrison, MS, LPC — Creative Solutions Coaching, PLLC
 *
 * VERSION: bump this number by 1 whenever you upload an updated game file.
 * The browser will detect the change, clear the old cache, and fetch fresh files.
 */
const CACHE_VERSION = 2;
const CACHE_NAME = 'nsds-cache-v' + CACHE_VERSION;

/*
 * CORE FILES TO CACHE
 * Add new game filenames here as you add them to the repository.
 * The service worker will pre-cache all of these on first install.
 */
const CORE_FILES = [
  '/',
  '/manifest.json',
  '/central-station.html',
  '/inner-airways-desktop-game.html',
  '/inner-airspace-mobile-game.html',
  '/load-conditions-desktop.html',
  '/icons/icon-192.png',
  '/icons/icon-512.png',
  /* Google Fonts are cached on first load via the network-first strategy below */
];

/* ── INSTALL: pre-cache core files ── */
self.addEventListener('install', function(event) {
  event.waitUntil(
    caches.open(CACHE_NAME).then(function(cache) {
      /*
       * We use individual adds rather than addAll so that one missing file
       * (e.g. a game not yet uploaded) does not block the whole install.
       */
      return Promise.allSettled(
        CORE_FILES.map(function(url) {
          return cache.add(url).catch(function(err) {
            console.warn('[NSDS SW] Could not pre-cache:', url, err);
          });
        })
      );
    }).then(function() {
      /* Activate immediately — don't wait for old tabs to close */
      return self.skipWaiting();
    })
  );
});

/* ── ACTIVATE: delete old cache versions ── */
self.addEventListener('activate', function(event) {
  event.waitUntil(
    caches.keys().then(function(keys) {
      return Promise.all(
        keys.filter(function(key) {
          return key.startsWith('nsds-cache-') && key !== CACHE_NAME;
        }).map(function(key) {
          console.log('[NSDS SW] Deleting old cache:', key);
          return caches.delete(key);
        })
      );
    }).then(function() {
      /* Take control of all open clients immediately */
      return self.clients.claim();
    })
  );
});

/* ── FETCH: cache-first for game files, network-first for fonts ── */
self.addEventListener('fetch', function(event) {
  var url = new URL(event.request.url);

  /* Only handle GET requests */
  if (event.request.method !== 'GET') return;

  /* Network-first for Google Fonts (they update and have their own caching) */
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

  /* Cache-first for everything else (game HTML files, icons, manifest) */
  event.respondWith(
    caches.match(event.request).then(function(cached) {
      if (cached) {
        /* Return cached version and update cache in background */
        fetch(event.request).then(function(fresh) {
          if (fresh && fresh.status === 200) {
            caches.open(CACHE_NAME).then(function(cache) {
              cache.put(event.request, fresh);
            });
          }
        }).catch(function() { /* offline — that's fine, cached version served */ });
        return cached;
      }
      /* Not in cache — fetch from network and cache it */
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
