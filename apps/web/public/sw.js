/**
 * IHUI AI Service Worker
 * - 页面请求(html/navigate):network-first,失败回退缓存 / offline.html
 * - 静态资源(/_next/static/*):cache-first
 * - 不缓存 /api/* 与认证相关请求(避免数据不一致与 token 泄露)
 * - 不处理 SSE / 流式响应
 */
const CACHE_VERSION = 'v2'
const CORE_CACHE = `ihui-core-${CACHE_VERSION}`
const STATIC_CACHE = `ihui-static-${CACHE_VERSION}`
const CORE_ASSETS = ['/', '/offline.html', '/manifest.json']

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches
      .open(CORE_CACHE)
      .then((cache) => cache.addAll(CORE_ASSETS))
      .then(() => self.skipWaiting()),
  )
})

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) =>
        Promise.all(
          keys
            .filter((k) => k !== CORE_CACHE && k !== STATIC_CACHE)
            .map((k) => caches.delete(k)),
        ),
      )
      .then(() => self.clients.claim()),
  )
})

self.addEventListener('fetch', (event) => {
  const { request } = event
  if (request.method !== 'GET') return

  const url = new URL(request.url)
  if (url.origin !== self.location.origin) return

  // 不缓存 API 路径(避免数据不一致)
  if (url.pathname.startsWith('/api/')) return

  // 不缓存认证相关请求(避免 token 泄露)
  if (request.headers.has('authorization')) return

  // 不缓存 SSE / 流式响应
  const accept = request.headers.get('accept') ?? ''
  if (accept.includes('text/event-stream')) return

  // 静态资源:cache-first
  if (url.pathname.startsWith('/_next/static/')) {
    event.respondWith(
      caches.match(request).then(
        (cached) =>
          cached ||
          fetch(request).then((response) => {
            if (response && response.status === 200 && response.type === 'basic') {
              const clone = response.clone()
              caches.open(STATIC_CACHE).then((cache) => cache.put(request, clone))
            }
            return response
          }),
      ),
    )
    return
  }

  // 页面请求:network-first,失败回退缓存 / offline.html
  const isPageRequest = request.mode === 'navigate' || accept.includes('text/html')
  if (!isPageRequest) return

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
        caches.match(request).then((cached) => cached || caches.match('/offline.html')),
      ),
  )
})
