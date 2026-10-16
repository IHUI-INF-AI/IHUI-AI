// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * IHUI AI Service Worker
 * - 页面请求(html/navigate):network-first,失败回退缓存 / offline.html
 * - 静态资源(/_next/static/*):cache-first
 * - 不缓存 /api/* 与认证相关请求(避免数据不一致与 token 泄露)
 * - 不处理 SSE / 流式响应
 *
 * ⚠️ 部署铁律(2026-10-16 根因修复):**每次部署必须让 sw.js 的字节内容发生变化**。
 *
 * 病因(实测复现):`CACHE_VERSION` 原为写死的常量 'v2'。部署构建后 sw.js 字节与上一版
 * 完全一致 ⇒ 浏览器比对脚本内容发现"无变化"⇒ **不触发 install/activate** ⇒ 新 SW 的
 * 任何逻辑(包括下面的缓存清理)**一次都不会跑** ⇒ 用户端长期停留在旧缓存上。
 * 表现:新功能已上线、HTML 也是最新的,但页面行为仍是旧的,刷新/清缓存都不一定好。
 * 修复:SW_BUILD_ID 由构建期注入(见 scripts/stamp-sw-version.mjs),每次部署唯一,
 * 保证 sw.js 字节必变 ⇒ 必然触发更新 ⇒ activate 里清掉旧 cache。
 * 若该占位符未被替换(本地直开 / 未走构建脚本),退化为带时间戳的兜底值而不是固定串。
 */
/*
 * SW_BUILD_ID 由构建期注入(见 scripts/stamp-sw-version.mjs)。
 * 未被替换时(本地直开 / 未走构建脚本)会退化为带时间戳的兜底值,而不是固定串 ——
 * 这里比较的是哨兵串 SW_BUILD_ID_PLACEHOLDER,
 * 它与构建脚本替换的目标字面量**不是同一个字符串**,所以替换不会破坏本判断。
 */
const SW_BUILD_ID = 'SW_BUILD_ID_PLACEHOLDER'
const CACHE_VERSION =
  SW_BUILD_ID === 'SW_BUILD_ID_PLACEHOLDER' ? 'dev-' + Date.now() : SW_BUILD_ID
const CORE_CACHE = `ihui-core-${CACHE_VERSION}`
const STATIC_CACHE = `ihui-static-${CACHE_VERSION}`
// 注意:这里**不放 '/'**。首页 HTML 若进 precache,install 那一刻的快照会被永久留在
// CORE_CACHE 里,而页面请求虽走 network-first,离线兜底却会翻出这份陈旧 HTML,
// 其内引用的 chunk hash 可能已被新构建取代 ⇒ 白屏。只预缓存与业务内容无关的静态壳。
const CORE_ASSETS = ['/offline.html', '/manifest.json']

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches
      .open(CORE_CACHE)
      .then((cache) => cache.addAll(CORE_ASSETS))
      .then(() => self.skipWaiting()),
  )
})

self.addEventListener('activate', (event) => {
  // 版本变了 ⇒ 新旧 cache 名不同 ⇒ 这里把非当前的整批删掉。
  // SW_BUILD_ID 每次部署唯一,所以这段代码现在**每次部署都会真的执行**(修复前从不执行)。
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

/**
 * W30 多入口集成(2026-09-14 立):Web Push 接收端(架构就绪收口)。
 * - push:展示服务端下发的推送通知(payload 支持 {title, body, url})
 * - notificationclick:点击通知聚焦已开窗口或打开 payload.url
 */
self.addEventListener('push', (event) => {
  let payload = {}
  try {
    payload = event.data ? event.data.json() : {}
  } catch {
    payload = { body: event.data ? event.data.text() : '' }
  }
  const title = payload.title || 'IHUI AI'
  const body = payload.body || ''
  const url = payload.url || '/'
  event.waitUntil(
    self.registration.showNotification(title, { body, data: { url }, tag: 'ihui-push' }),
  )
})

self.addEventListener('notificationclick', (event) => {
  event.notification.close()
  const target = (event.notification.data && event.notification.data.url) || '/'
  event.waitUntil(
    self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then((clientList) => {
      for (const client of clientList) {
        if ('focus' in client) return client.focus()
      }
      return self.clients.openWindow(target)
    }),
  )
})
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
