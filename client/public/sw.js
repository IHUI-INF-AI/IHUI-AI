// Service Worker - PWA 离线缓存 + Background Sync + Push + Share Target
// 2026-06-27: 升级版本号触发新 SW 安装, 修复开发环境白屏 (旧 SW 缓存旧 JS)
const CACHE_VERSION = 'v1.1.1'
const CACHE_NAME = `zhs-cache-${CACHE_VERSION}`
const OFFLINE_PAGE = '/offline.html'
const SYNC_QUEUE_STORE = 'sync-queue-db'
const SYNC_STORE = 'requests'

// 开发环境标志 (Vite dev server 端口 8888)
const IS_DEV = self.location.port === '8888'

// 预缓存关键资源
const PRECACHE_URLS = [
  '/',
  '/index.html',
  '/manifest.webmanifest',
  '/favicon.svg',
  '/offline.html',
]

// 安装: 预缓存
self.addEventListener('install', (event) => {
  console.log('[SW] install', CACHE_VERSION, 'dev=', IS_DEV)
  // 开发环境: 不预缓存, 直接 skipWaiting 让新 SW 尽快接管
  if (IS_DEV) {
    self.skipWaiting()
    return
  }
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => {
      return cache.addAll(PRECACHE_URLS).catch((err) => {
        console.warn('[SW] 预缓存部分失败 (非致命)', err)
      })
    })
  )
  self.skipWaiting()
})

// 激活: 清理旧缓存
self.addEventListener('activate', (event) => {
  console.log('[SW] activate', 'dev=', IS_DEV)
  event.waitUntil(
    caches.keys().then((keys) => {
      // 开发环境: 清理所有缓存 (包括当前版本); 生产环境: 仅清理旧版本
      const toDelete = IS_DEV ? keys : keys.filter((k) => k !== CACHE_NAME)
      return Promise.all(toDelete.map((k) => caches.delete(k)))
    })
  )
  self.clients.claim()
})

// fetch: 多策略缓存
self.addEventListener('fetch', (event) => {
  const { request } = event
  const url = new URL(request.url)

  // 跨域放行
  if (url.origin !== self.location.origin) return

  // 跳过非 HTTP(S) 协议
  if (!url.protocol.startsWith('http')) return

  // 2026-06-27: 开发环境不拦截任何请求, 让 Vite HMR 直接生效
  // 避免 SW 缓存旧 HTML/JS 导致白屏
  if (IS_DEV) return

  // Web Share Target 处理
  if (request.method === 'POST' && url.pathname === '/share-target') {
    event.respondWith(handleShareTarget(request))
    return
  }

  // 离线 POST 请求入队 (Background Sync)
  if (request.method === 'POST' && url.pathname.startsWith('/api/')) {
    event.respondWith(handleApiPost(request))
    return
  }

  // 仅缓存 GET
  if (request.method !== 'GET') return

  // API 请求: 网络优先 (networkFirst)
  if (isApiRequest(url)) {
    event.respondWith(networkFirst(request))
    return
  }

  // 静态资源: 缓存优先 (cacheFirst)
  if (isHashedAsset(url) || isStaticDir(url)) {
    event.respondWith(cacheFirst(request))
    return
  }

  // HTML 文档: SWR 策略
  if (request.mode === 'navigate') {
    event.respondWith(staleWhileRevalidate(request))
    return
  }

  // 默认: SWR
  event.respondWith(staleWhileRevalidate(request))
})

// ============ 缓存策略 ============

// 缓存优先策略
async function cacheFirst(request) {
  const cache = await caches.open(CACHE_NAME)
  const cached = await cache.match(request)
  if (cached) {
    fetch(request).then((response) => {
      if (response && response.status === 200) {
        cache.put(request, response.clone())
      }
    }).catch(() => {})
    return cached
  }
  try {
    const response = await fetch(request)
    if (response && response.status === 200) {
      cache.put(request, response.clone())
    }
    return response
  } catch (err) {
    return new Response('离线模式', { status: 503 })
  }
}

// 网络优先策略
async function networkFirst(request) {
  const cache = await caches.open(CACHE_NAME)
  try {
    const response = await fetch(request)
    if (response && response.status === 200) {
      cache.put(request, response.clone())
    }
    return response
  } catch (err) {
    const cached = await cache.match(request)
    if (cached) return cached
    return new Response('离线模式', { status: 503 })
  }
}

// stale-while-revalidate 策略
async function staleWhileRevalidate(request) {
  const cache = await caches.open(CACHE_NAME)
  const cached = await cache.match(request)
  const fetchPromise = fetch(request).then((response) => {
    if (response && response.status === 200) {
      cache.put(request, response.clone())
    }
    return response
  }).catch(() => {
    if (cached) return cached
    if (request.mode === 'navigate') return caches.match(OFFLINE_PAGE)
    return new Response('离线模式', { status: 503 })
  })
  return cached || fetchPromise
}

// ============ 辅助判断 ============

function isApiRequest(url) {
  return url.pathname.startsWith('/api/') || url.pathname.startsWith('/cozeZhsApi/')
}

function isHashedAsset(url) {
  return /\.[a-f0-9]{8,}\.(js|css|woff2?|png|jpg|jpeg|svg|ico)$/.test(url.pathname)
}

function isStaticDir(url) {
  return url.pathname.startsWith('/static/') || url.pathname.startsWith('/assets/')
}

// ============ Background Sync ============

async function openSyncDB() {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(SYNC_QUEUE_STORE, 1)
    req.onupgradeneeded = () => {
      req.result.createObjectStore('requests', { keyPath: 'id', autoIncrement: true })
    }
    req.onsuccess = () => resolve(req.result)
    req.onerror = () => reject(req.error)
  })
}

async function enqueueRequest(request) {
  const db = await openSyncDB()
  const body = await request.clone().text()
  return new Promise((resolve, reject) => {
    const tx = db.transaction(SYNC_STORE, 'readwrite')
    tx.objectStore(SYNC_STORE).add({
      url: request.url,
      method: request.method,
      headers: [...request.headers.entries()],
      body,
      timestamp: Date.now(),
    })
    tx.oncomplete = () => resolve()
    tx.onerror = () => reject(tx.error)
  })
}

async function replayQueue() {
  const db = await openSyncDB()
  return new Promise((resolve, reject) => {
    const tx = db.transaction(SYNC_STORE, 'readwrite')
    const store = tx.objectStore(SYNC_STORE)
    const req = store.getAll()
    req.onsuccess = async () => {
      const items = req.result || []
      for (const item of items) {
        try {
          await fetch(item.url, {
            method: item.method,
            headers: new Headers(item.headers),
            body: item.body,
          })
          store.delete(item.id)
        } catch (err) {
          console.warn('[SW] replay 失败, 留在队列', err)
        }
      }
      resolve()
    }
    req.onerror = () => reject(req.error)
  })
}

// 离线 POST 请求处理
async function handleApiPost(request) {
  try {
    const response = await fetch(request)
    return response
  } catch (err) {
    // 离线: 入队等待 sync
    await enqueueRequest(request)
    await self.registration.sync.register('retry-api-requests').catch(() => {})
    return new Response(JSON.stringify({ ok: false, message: 'queued-for-sync' }), {
      status: 202,
      headers: { 'Content-Type': 'application/json' },
    })
  }
}

// sync 事件: 重放队列
self.addEventListener('sync', (event) => {
  if (event.tag === 'retry-api-requests') {
    event.waitUntil(replayQueue())
  }
})

// ============ Push 通知 ============

self.addEventListener('push', (event) => {
  let data = { title: '通知', body: '您有新消息' }
  try {
    if (event.data) data = event.data.json()
  } catch (e) {
    if (event.data) data.body = event.data.text()
  }
  event.waitUntil(
    self.registration.showNotification(data.title || '通知', {
      body: data.body || '',
      icon: '/icon-192.svg',
      badge: '/icon-192.svg',
      data: data.url ? { url: data.url } : {},
    })
  )
})

// notificationclick: 打开窗口
self.addEventListener('notificationclick', (event) => {
  event.notification.close()
  const targetUrl = event.notification.data && event.notification.data.url ? event.notification.data.url : '/'
  event.waitUntil(
    self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then((clientList) => {
      for (const client of clientList) {
        if (client.url.includes(targetUrl) && 'focus' in client) return client.focus()
      }
      if (self.clients.openWindow) return self.clients.openWindow(targetUrl)
    })
  )
})

// ============ Web Share Target ============

async function handleShareTarget(request) {
  const formData = await request.formData()
  const title = formData.get('title') || ''
  const text = formData.get('text') || ''
  const url = formData.get('url') || ''
  // 存入 IndexedDB 待主页面读取
  const db = await openSyncDB()
  return new Promise((resolve, reject) => {
    const tx = db.transaction(SYNC_STORE, 'readwrite')
    tx.objectStore(SYNC_STORE).add({
      type: 'share-target',
      title,
      text,
      url,
      timestamp: Date.now(),
    })
    tx.oncomplete = () => resolve(Response.redirect('/?shared=1', 303))
    tx.onerror = () => reject(tx.error)
  })
}

// ============ 消息通信 ============

self.addEventListener('message', (event) => {
  if (event.data && event.data.type === 'SKIP_WAITING') {
    self.skipWaiting()
  }
})
