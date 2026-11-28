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
 *
 * ⚠️ push 订阅腿的现状(2026-11-26 实测,别读错):本文件里的 `push` 监听**目前没有触发源** ——
 * 前端全仓 0 处 `pushManager.subscribe`、服务端 0 处 web-push/VAPID 发送,所以"关闭标签页
 * 还能响"在浏览器里并不成立(桌面 App 只要进程在、网页只要标签页在,都由页面内铃声负责)。
 * 监听本体保留并已把"有可见窗口 ⇒ silent"的防双响逻辑做对:将来接入 VAPID 订阅时直接生效,
 * 不需要再改这里。谁要宣称"关页也响",先补齐 subscribe + 服务端 web-push 两条腿再改这句话。
 */
/*
 * SW_BUILD_ID 由构建期注入(见 scripts/stamp-sw-version.mjs)。
 * 未被替换时(本地直开 / 未走构建脚本)会退化为带时间戳的兜底值,而不是固定串 ——
 * 这里比较的是哨兵串 SW_BUILD_ID_PLACEHOLDER,
 * 它与构建脚本替换的目标字面量**不是同一个字符串**,所以替换不会破坏本判断。
 */
const SW_BUILD_ID = 'bmx0bcy21pz11tx'
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
 *
 * 双响治理(2026-11-26 立):页面在前台时,页面内 playRingtone 已响铃,SW 通知再带系统声
 * 就会"铃声 + 系统推送声"双响;故前台可见窗口 ⇒ 通知 silent: true,声音交给页面内。
 * 反之(无窗口 / 仅隐藏窗口,即 App 全关或后台)不带 silent 键,保留系统声,绝不能无声。
 * matchAll 抛错 / 返回非数组等任何异常一律回落"不静默"——宁可系统响一声。
 */

/**
 * client 列表里是否存在任一可见窗口。
 * 对 null/undefined/非数组安全返回 false(防御 matchAll 返回脏值)。
 * @param {Array<{ visibilityState?: string }> | null | undefined} clientList
 * @returns {boolean}
 */
function hasVisibleClient(clientList) {
  if (!Array.isArray(clientList)) return false
  return clientList.some((client) => client && client.visibilityState === 'visible')
}

/**
 * 组装 push 通知展示选项。
 * silent === true ⇒ 带 silent: true;否则整个 silent 键都不出现(保留系统默认声)。
 * @param {{ title?: string, body?: string, url?: string, silent?: boolean }} args
 */
function buildPushNotificationOptions({ title, body, url, silent }) {
  const options = { body, data: { url }, tag: 'ihui-push' }
  if (silent === true) options.silent = true
  return options
}

/**
 * 解析本次 push 是否应静默:任一可见窗口 ⇒ true;
 * 无窗口 / 仅隐藏窗口 / matchAll 抛错 / 返回非数组 ⇒ false。
 * @param {{ matchAll: (opts: object) => Promise<unknown[]> }} clientsApi
 * @returns {Promise<boolean>}
 */
async function resolvePushSilent(clientsApi) {
  try {
    const list = await clientsApi.matchAll({ type: 'window', includeUncontrolled: true })
    return hasVisibleClient(list)
  } catch {
    return false
  }
}

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
    (async () => {
      const silent = await resolvePushSilent(self.clients)
      await self.registration.showNotification(
        title,
        buildPushNotificationOptions({ title, body, url, silent }),
      )
    })(),
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
