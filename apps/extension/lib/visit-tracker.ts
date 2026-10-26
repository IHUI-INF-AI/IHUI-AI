// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * 浏览器插件端页面埋点(2026-10-26 立)。
 *
 * popup 与 sidepanel 是两套独立 UI,此前一次都不上报 —— 后台「各端使用量」里插件端
 * 永远读 0,而漏报在监控面上的表现是「这个端没人在用」(最难被发现的一型)。
 *
 * 路径前缀 `/ex/` 是服务端分桶的唯一判据(见 apps/api/src/db/visit-tracking-queries.ts
 * 的 `VISIT_PLATFORM_PATH_PREFIXES`),不得改成查询参数或换前缀。
 */
import { recordVisitLog, setBaseUrl } from '@ihui/api-client'
import { getApiBaseUrl, initApiBaseUrl } from './config'

export const EXT_VIEW_PREFIX = '/ex'
/** 同一视图 3 秒内只算一次:React StrictMode 双跑、路由抖动都会重复触发。 */
export const EXT_VIEW_DEBOUNCE_MS = 3_000
/** 与 visit_logs.url 列长一致,超长截断而不是丢掉整条。 */
const MAX_PATH_LEN = 500

function newSessionId(): string {
  const c = globalThis.crypto
  if (c && typeof c.randomUUID === 'function') return c.randomUUID()
  return `ex-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`
}

/** 一次安装(视图存活期)内稳定;后台按它算 UV,不含任何身份。 */
const SESSION_ID = newSessionId()

let apiBaseUrlReady: Promise<void> | null = null

/**
 * 上报前确保 api-client 的 baseUrl 已按 chrome.storage 的用户配置初始化。
 * 只可能真正跑一次(popup/sidepanel 各自的 initApi 与本函数共享同一份运行时配置,重复读 storage 没必要)。
 */
function ensureApiBaseUrl(): Promise<void> {
  if (!apiBaseUrlReady) {
    apiBaseUrlReady = (async () => {
      try {
        await initApiBaseUrl()
        setBaseUrl(getApiBaseUrl())
      } catch {
        // storage 不可用 ⇒ 留在运行时默认值,不能因为读不到配置就不上报
      }
    })()
  }
  return apiBaseUrlReady
}

/** `sidepanel/chat` / `/sidepanel/chat/` ⇒ `/ex/sidepanel/chat`;空名或只剩斜杠 ⇒ null。 */
export function extensionViewPath(view: string | null | undefined): string | null {
  const raw = (view ?? '').trim()
  if (!raw) return null
  const body = raw.replace(/^\/+/, '').replace(/\/+$/, '')
  if (!body) return null
  return `${EXT_VIEW_PREFIX}/${body}`.slice(0, MAX_PATH_LEN)
}

const lastReportAt = new Map<string, number>()

/** 上报一次视图访问;返回是否真的发出(被去抖或空名 ⇒ false)。失败静默,绝不影响 UI。 */
export function reportExtensionView(view: string | null | undefined, now = Date.now()): boolean {
  const path = extensionViewPath(view)
  if (!path) return false
  const last = lastReportAt.get(path)
  if (last !== undefined && now - last < EXT_VIEW_DEBOUNCE_MS) return false
  lastReportAt.set(path, now)
  void ensureApiBaseUrl()
    .then(() => recordVisitLog({ url: path, sessionId: SESSION_ID }))
    .catch(() => {
      // 埋点失败不重试也不抛:导航/渲染比一条访问记录重要
    })
  return true
}

export function __resetExtensionViewTrackingForTest(): void {
  lastReportAt.clear()
  apiBaseUrlReady = null
}
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
