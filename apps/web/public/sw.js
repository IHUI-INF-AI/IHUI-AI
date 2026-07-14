const CACHE_VERSION = 'v1'
const CORE_CACHE = `ihui-core-${CACHE_VERSION}`
const CORE_ASSETS = ['/', '/offline.html', '/manifest.json']

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CORE_CACHE).then((cache) => cache.addAll(CORE_ASSETS)).then(() => self.skipWaiting())
  )
})

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(keys.filter((k) => k !== CORE_CACHE).map((k) => caches.delete(k)))
    ).then(() => self.clients.claim())
  )
})

self.addEventListener('fetch', (event) => {
  const { request } = event
  if (request.method !== 'GET') return

  const url = new URL(request.url)
  if (url.origin !== self.location.origin) return

  event.respondWith(
    fetch(request)
      .then((response) => {
        if (response && response.status === 200 && response.type === 'basic') {
          const clone = response.clone()
          caches.open(CORE_CACHE).then((cache) => cache.put(request, clone))
        }
        return response
      })
      .catch(() =>
        caches.match(request).then((cached) => cached || caches.match('/offline.html'))
      )
  )
})
