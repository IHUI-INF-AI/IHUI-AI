// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * RN 端页面访问埋点(2026-10-26 立)。
 *
 * 立因:web 端 `VisitTracker` 自 2026-08 就在写 `visit_logs`,而 RN 端**一条都没有** ——
 * 管理端看「多少人用了哪些页面」时,移动端是结构性盲区。本模块把 React Navigation 的
 * 页面切换接到同一个上报端点(`POST /api/visit-tracking/visit-log`),后台无需改表:
 * 路径统一加 `/rn/` 前缀,`/admin`、`/login` 等前端分桶判据天然不误伤。
 *
 * 三条边界:
 * 1. **只报页面计数,不带身份**:`userId` 在 schema 里是 uuid,传错值会让 zod 400 掉整条,
 *    而端侧登录态形状随版本变化 —— 本期宁可不传,UV 由 sessionId 保证(与 web 同口径)。
 * 2. **去抖 3 秒**:与 web 同档,避免导航动画/重渲染把一次进入记成多次。
 * 3. **失败静默**:埋点永远不阻塞导航、不弹错误、不重试;连不上就是这条丢了。
 */

import { recordVisitLog } from '@ihui/api-client'

/** 进程内会话 id:一次冷启动一个值(与 web 的 sessionStorage 语义对齐,不落盘)。 */
const SESSION_ID = `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`

/** 同屏 3 秒内只报一次(与 web VisitTracker 同档)。 */
export const SCREEN_VIEW_DEBOUNCE_MS = 3000

let lastPath = ''
let lastAt = 0

/** 供测试重置模块级去抖状态。 */
export function __resetScreenViewThrottleForTest(): void {
  lastPath = ''
  lastAt = 0
}

/** React Navigation 的 route 名 → 上报路径。空名不报(不造 `/rn/undefined`)。 */
export function screenViewPath(screenName: string | null | undefined): string | null {
  const name = (screenName ?? '').trim()
  if (!name) return null
  return `/rn/${name}`.slice(0, 500)
}

/**
 * 上报一次页面访问。同步返回是否真的发出了请求(供测试断言去抖),网络请求本身不等待。
 */
export function reportScreenView(
  screenName: string | null | undefined,
  now: number = Date.now(),
): boolean {
  const path = screenViewPath(screenName)
  if (!path) return false
  if (path === lastPath && now - lastAt < SCREEN_VIEW_DEBOUNCE_MS) return false
  lastPath = path
  lastAt = now
  void recordVisitLog({ url: path, sessionId: SESSION_ID }).catch(() => {
    /* 埋点失败静默 */
  })
  return true
}
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
