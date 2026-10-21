const CACHE_PREFIX = `study-buddy:${self.registration.scope}:`;
const CACHE = `${CACHE_PREFIX}v57`;
const APP_SHELL = [
  './',
  './index.html',
  './styles.css',
  './styles.css?v=56',
  './settings.js?v=43',
  './ambience.js?v=41',
  './assets/audio/lofi-piano.mp3',
  './assets/audio/lofi-dream.mp3',
  './assets/audio/fireplace.mp3',
  './assets/audio/rain.mp3',
  './assets/audio/stream.mp3',
  './assets/audio/summer-night.mp3',
  './assets/audio/wind.mp3',
  './assets/audio/white-noise.mp3',
  './assets/audio/coffee-shop.mp3',
  './assets/audio/train.mp3',
  './assets/audio/city.mp3',
  './navigation.js?v=44',
  './app.js',
  './app.js?v=48',
  './welcome.js?v=55',
  './library.js?v=33',
  './assets/library-candles.webp',
  './assets/bears.webp',
  './assets/maya.webp',
  './questions.json',
  './manifest.webmanifest',
  './assets/icon.svg',
  './assets/icon-192.png',
  './assets/icon-512.png'
];

const APP_URLS = new Set(APP_SHELL.map(path => new URL(path,self.registration.scope).href));

self.addEventListener('install', event => {
  event.waitUntil(caches.open(CACHE).then(cache => cache.addAll(APP_SHELL)).then(() => self.skipWaiting()));
});

self.addEventListener('activate', event => {
  event.waitUntil((async () => {
    const keys = await caches.keys();
    await Promise.all(keys.filter(key => key.startsWith(CACHE_PREFIX) && key !== CACHE).map(key => caches.delete(key)));
    await self.clients.claim();
  })());
});

self.addEventListener('fetch', event => {
  if (event.request.method !== 'GET' || event.request.headers.has('range') || !APP_URLS.has(event.request.url)) return;
  event.respondWith((async () => {
    try {
      const response = await fetch(event.request);
      if (response.ok && response.status !== 206) {
        const copy = response.clone();
        event.waitUntil(caches.open(CACHE).then(cache => cache.put(event.request,copy)).catch(() => {}));
      }
      return response;
    } catch (error) {
      const cache = await caches.open(CACHE);
      const cached = await cache.match(event.request);
      if (cached) return cached;
      throw error;
    }
  })());
});
