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

import { recordAnalyticsEvents, recordVisitLog } from '@ihui/api-client'

/** 进程内会话 id:一次冷启动一个值(与 web 的 sessionStorage 语义对齐,不落盘)。 */
const SESSION_ID = `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`

/** 同屏 3 秒内只报一次(与 web VisitTracker 同档)。 */
export const SCREEN_VIEW_DEBOUNCE_MS = 3000

/**
 * 停留上报的最小秒数(按整秒四舍五入后):低于 1 秒的"停留"基本都是导航动画/重渲染抖动,
 * 报上去会把均值拉向 0(数据大屏「页面停留时长 TOP」取的是平均值)。
 */
const MIN_SCREEN_TIME_SEC = 1

let lastPath = ''
let lastAt = 0
/** 当前所在屏与进入时刻;换屏时才结算上一屏的停留(与去抖状态分开,互不影响)。 */
let enterScreen = ''
let enterAt = 0

/** 供测试重置模块级去抖与停留状态。 */
export function __resetScreenViewThrottleForTest(): void {
  lastPath = ''
  lastAt = 0
  enterScreen = ''
  enterAt = 0
}

/** React Navigation 的 route 名 → 上报路径。空名不报(不造 `/rn/undefined`)。 */
export function screenViewPath(screenName: string | null | undefined): string | null {
  const name = (screenName ?? '').trim()
  if (!name) return null
  return `/rn/${name}`.slice(0, 500)
}

/**
 * 结算当前屏停留并清空在屏状态(退后台/杀进程前的收口,AppState 变 background 时调)。
 *
 * 立因(2026-10-27):此前停留只在**换屏**时结算 —— 用户直接退到后台或杀掉 app 时,
 * 最后一屏的停留永远丢(每个会话的末页在 page_time 里结构性缺席,数据大屏
 * 「页面停留」对末页恒盲)。判据与换屏结算同一条(≥1 秒才报),没有在屏记录时是 no-op。
 * 返回是否真的发出了上报(供测试断言);回前台后下一次 reportScreenView 会重新进屏。
 */
export function settleScreenTime(now: number = Date.now()): boolean {
  if (!enterScreen) return false
  const screen = enterScreen
  const seconds = Math.round((now - enterAt) / 1000)
  enterScreen = ''
  enterAt = 0
  if (seconds < MIN_SCREEN_TIME_SEC) return false
  void recordAnalyticsEvents([
    {
      name: 'page_time',
      category: 'user_engagement',
      label: screen,
      value: seconds,
    },
  ]).catch(() => {
    /* 埋点失败静默 */
  })
  return true
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
  // 换屏 ⇒ 先结算上一屏停留(与 3 秒去抖无关:抖掉的是重复 PV,不是真实离开)
  if (path !== enterScreen) {
    if (enterScreen) {
      const seconds = Math.round((now - enterAt) / 1000)
      if (seconds >= MIN_SCREEN_TIME_SEC) {
        void recordAnalyticsEvents([
          {
            name: 'page_time',
            category: 'user_engagement',
            label: enterScreen,
            value: seconds,
          },
        ]).catch(() => {
          /* 埋点失败静默 */
        })
      }
    }
    enterScreen = path
    enterAt = now
  }
  if (path === lastPath && now - lastAt < SCREEN_VIEW_DEBOUNCE_MS) return false
  lastPath = path
  lastAt = now
  void recordVisitLog({ url: path, sessionId: SESSION_ID }).catch(() => {
    /* 埋点失败静默 */
  })
  return true
}
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
