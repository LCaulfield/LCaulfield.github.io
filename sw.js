// Simple cache-first service worker
const CACHE_NAME = 'studyquiz-cache-v1';
const ASSETS = [
'./',
'./index.html',
'./styles.css',
'./app.js',
'./leitner.js',
'./rewards.js',
'./bank.json',
'./manifest.webmanifest',
'./icons/icon-192.png',
'./icons/icon-512.png'
];
self.addEventListener('install', (e) => {
e.waitUntil(
caches.open(CACHE_NAME).then(cache => cache.addAll(ASSETS))
);
});
self.addEventListener('activate', (e) => {
e.waitUntil(
caches.keys().then(keys => Promise.all(keys.map(k => k!==CACHE_NAME && caches.delete(k))))
);
});
self.addEventListener('fetch', (e) => {
const url = new URL(e.request.url);
if (e.request.method !== 'GET' || url.origin !== location.origin) return;
e.respondWith(
caches.match(e.request).then(cached => cached || fetch(e.request).then(res => {
// Optionally update runtime cache
return res;
}).catch(() => cached))
);
});