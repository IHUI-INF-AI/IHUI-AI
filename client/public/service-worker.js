/**
 * Service Worker
 * 提供离线支持和资源缓存
 *
 * 注意：Service Worker 必须注册为 .js 文件（浏览器要求）
 * 此文件使用 JSDoc 类型注释提供类型支持
 * @typedef {Object} Cache
 * @typedef {Object} Request
 * @typedef {Object} Response
 * @typedef {Object} ExtendableEvent
 * @typedef {Object} FetchEvent
 * @typedef {Object} ExtendableMessageEvent
 * @typedef {ServiceWorkerGlobalScope} ServiceWorkerGlobalScope
 */

const CACHE_VERSION = 'v1.0.1'
const CACHE_NAME = `ihui-ai-web-${CACHE_VERSION}`

// 需要缓存的资源列表
/** @type {string[]} */
const CACHE_URLS = ['/', '/index.html', '/images/APP.jpg', '/fonts/font-styles.css']

// 安装事件
self.addEventListener('install', (/** @type {ExtendableEvent} */ event) => {
  console.log('[Service Worker] 安装中...')

  event.waitUntil(
    caches
      .open(CACHE_NAME)
      .then((/** @type {Cache} */ cache) => {
        console.log('[Service Worker] 缓存资源:', CACHE_URLS)
        return cache.addAll(CACHE_URLS.map(url => new Request(url, { cache: 'reload' })))
      })
      .then(() => {
        // 立即激活新的Service Worker
        return self.skipWaiting()
      })
      .catch((/** @type {Error} */ error) => {
        console.error('[Service Worker] 安装失败:', error)
      })
  )
})

// 激活事件
self.addEventListener('activate', (/** @type {ExtendableEvent} */ event) => {
  console.log('[Service Worker] 激活中...')

  event.waitUntil(
    caches
      .keys()
      .then((/** @type {string[]} */ cacheNames) => {
        return Promise.all(
          cacheNames
            .filter(name => name !== CACHE_NAME)
            .map(name => {
              console.log('[Service Worker] 删除旧缓存:', name)
              return caches.delete(name)
            })
        )
      })
      .then(() => {
        // 立即控制所有客户端
        return self.clients.claim()
      })
  )
})

// 拦截请求
self.addEventListener('fetch', (/** @type {FetchEvent} */ event) => {
  const { request } = event
  const url = new URL(request.url)

  // 只处理同源请求
  if (url.origin !== location.origin) {
    return
  }

  // 只处理 GET：Cache API 仅支持 GET，对 POST 等调用 cache.put 会报错
  if (request.method !== 'GET') {
    return
  }

  // API 请求不缓存
  if (url.pathname.startsWith('/api/')) {
    return
  }

  event.respondWith(
    caches.match(request).then((/** @type {Response | undefined} */ cachedResponse) => {
      // 如果缓存中有响应，返回缓存
      if (cachedResponse) {
        return cachedResponse
      }

      // 否则发起网络请求
      return fetch(request)
        .then((/** @type {Response} */ response) => {
          // 只缓存成功的 GET 响应（再次确认，避免异常）
          if (!response || response.status !== 200 || response.type !== 'basic' || request.method !== 'GET') {
            return response
          }

          const responseToCache = response.clone()

          caches.open(CACHE_NAME).then((/** @type {Cache} */ cache) => {
            cache.put(request, responseToCache)
          }).catch((err) => {
            console.warn('[Service Worker] 缓存写入失败:', err)
          })

          return response
        })
        .catch(() => {
          // 网络请求失败，仅对导航请求返回离线页，其余继续失败
          if (request.mode === 'navigate') {
            return caches.match('/index.html')
          }
          throw new Error('Network request failed')
        })
    })
  )
})

// 消息处理
self.addEventListener('message', (/** @type {ExtendableMessageEvent} */ event) => {
  if (event.data && event.data.type === 'SKIP_WAITING') {
    self.skipWaiting()
  }

  if (event.data && event.data.type === 'CLEAR_CACHE') {
    caches.delete(CACHE_NAME).then(() => {
      if (event.ports && event.ports[0]) {
        event.ports[0].postMessage({ success: true })
      }
    })
  }
})
