// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * 小程序端页面访问埋点(2026-10-26 立)。
 *
 * 立因:web 与 RN 都已把页面访问写进 `visit_logs`,小程序端一条都没有 —— 管理端看
 * 「多少人用了哪些页面」时,微信端是结构性盲区。Taro 4.2.1 **没有** `onAppRoute`
 * 这类全局路由钩子,逐页加 `useDidShow` 要改几十个页面且必然会漏,因此这里用
 * **页面栈轮询**:每 2 秒读一次 `Taro.getCurrentPages()` 的栈顶 route,变了就上报。
 *
 * 取舍(写在这里,免得后手以为是遗漏):
 * - 停留 < 2 秒的页面可能漏记:轮询的代价,换来的是"零页面壳改动";
 * - 只报页面计数,不报身份(sessionId 已足够算 UV);
 * - 3 秒去抖与 web/RN 同档;失败静默,绝不阻塞页面;
 * - 路径统一加 `/mp/` 前缀,后台按前缀区分端。
 */

import Taro from '@tarojs/taro'
import { recordVisitLog } from '@ihui/api-client'

/** 同屏 3 秒内只报一次(与 web / RN 同档)。 */
export const MP_VISIT_DEBOUNCE_MS = 3000
/** 页面栈轮询间隔。 */
export const MP_VISIT_POLL_MS = 2000

/** 进程内会话 id(冷启动一个值,与 web 的 sessionStorage 语义对齐)。 */
const SESSION_ID = `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`

let lastPath = ''
let lastAt = 0
let pollTimer: ReturnType<typeof setInterval> | null = null

/** route → 上报路径。空 route 不报(不造 `/mp/undefined`)。 */
export function pageViewPath(route: string | null | undefined): string | null {
  const r = (route ?? '').trim().replace(/^\//, '')
  if (!r) return null
  return `/mp/${r}`.slice(0, 500)
}

/** 栈顶页面 route(微信小程序形态,不带前导斜杠);取不到 ⇒ null。 */
export function currentPageRoute(): string | null {
  try {
    const pages = Taro.getCurrentPages()
    const top = pages[pages.length - 1] as { route?: string } | undefined
    return top?.route ?? null
  } catch {
    return null
  }
}

/** 上报一次;返回是否真的发出(供测试断言去抖)。网络请求不等待。 */
export function reportPageView(route: string | null | undefined, now = Date.now()): boolean {
  const path = pageViewPath(route)
  if (!path) return false
  if (path === lastPath && now - lastAt < MP_VISIT_DEBOUNCE_MS) return false
  lastPath = path
  lastAt = now
  try {
    // 走共享 api-client(守门 184:端内不得手拼 baseUrl 直连后端);失败静默
    void recordVisitLog({ url: path, sessionId: SESSION_ID }).catch(() => {
      /* 埋点失败静默 */
    })
  } catch {
    /* 埋点失败静默 */
  }
  return true
}

/** 停止轮询(幂等)。 */
export function stopPageViewTracking(): void {
  if (pollTimer) {
    clearInterval(pollTimer)
    pollTimer = null
  }
}

/**
 * 启动页面栈轮询。首次立即上报当前页,之后每 pollMs 检查一次。
 * 重复调用不会叠加定时器。返回停止函数。
 */
export function startPageViewTracking(pollMs: number = MP_VISIT_POLL_MS): () => void {
  if (pollTimer) return stopPageViewTracking
  reportPageView(currentPageRoute())
  pollTimer = setInterval(() => reportPageView(currentPageRoute()), pollMs)
  return stopPageViewTracking
}

/** 仅测试用:清去抖与定时器。 */
export function __resetPageViewTrackingForTest(): void {
  lastPath = ''
  lastAt = 0
  stopPageViewTracking()
}
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
