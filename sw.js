const CACHE_NAME = 'rostmy-v5'
const ASSETS = [
    '/',
    '/index.html',
    '/login.html',
    '/css/main.css',
    '/css/base.css',
    '/css/card.css',
    '/css/components.css',
    '/css/utils.css',
    '/css/mobile.css',
    '/css/markdown.css',
    '/css/navbar.css',
    '/css/temaclaro.css',
    '/js/main.js',
    '/js/supabase.js',
    '/js/auth.js',
    '/js/db.js',
    '/manifest.json',
    '/icons/icon-192.png',
    '/icons/icon-512.png',
    '/favicon.ico',
]

self.addEventListener('install', (e) => {
    e.waitUntil(
        caches.open(CACHE_NAME).then(cache => cache.addAll(ASSETS))
    )
})

self.addEventListener('fetch', (e) => {
    if (!e.request.url.startsWith(self.location.origin)) return

    e.respondWith(
        caches.match(e.request).then(cached => {
            return cached || fetch(e.request)
        })
    )
})