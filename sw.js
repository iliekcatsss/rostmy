const CACHE_NAME = 'rostmy-v1'
const ASSETS = [
    '/',
    '/index.html',
    '/login.html',
    '/css/main.css',
    '/js/main.js',
    '/js/supabase.js',
    '/js/auth.js',
    '/manifest.json'
]

self.addEventListener('install', (e) => {
    e.waitUntil(
        caches.open(CACHE_NAME).then(cache => cache.addAll(ASSETS))
    )
})

self.addEventListener('fetch', (e) => {
    e.respondWith(
        caches.match(e.request).then(cached => {
            return cached || fetch(e.request)
        })
    )
})