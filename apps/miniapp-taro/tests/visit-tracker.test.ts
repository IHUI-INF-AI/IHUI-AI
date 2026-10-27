// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * 小程序页面埋点取证(2026-10-26 立)。
 *
 * 钉四件:路径前缀 `/mp/`、3 秒去抖、栈顶取法(空栈不报)、轮询启停幂等,
 * 以及「上报必须走共享 api-client 的 recordVisitLog」——端内手拼 baseUrl 直连后端
 * 会被守门 184 拦,这里也从调用面钉住。
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'

const h = vi.hoisted(() => {
  const state = { stack: [] as Array<{ route: string }> }
  const taro = { getCurrentPages: () => state.stack }
  const api = {
    recordVisitLog: vi.fn((_payload: { url: string; sessionId: string }) =>
      Promise.resolve({ success: true, data: {} }),
    ),
    recordAnalyticsEvents: vi.fn((_events: unknown[]) =>
      Promise.resolve({ success: true, data: {} }),
    ),
  }
  return { state, taro, api }
})

vi.mock('@tarojs/taro', () => ({ default: h.taro }))
vi.mock('@ihui/api-client', () => ({
  recordVisitLog: h.api.recordVisitLog,
  recordAnalyticsEvents: h.api.recordAnalyticsEvents,
}))

import {
  __resetPageViewTrackingForTest,
  currentPageRoute,
  pageViewPath,
  reportPageView,
  settlePageTime,
  startPageViewTracking,
  stopPageViewTracking,
  MP_VISIT_DEBOUNCE_MS,
} from '../src/utils/visit-tracker'

const callCount = () => h.api.recordVisitLog.mock.calls.length
const lastPayload = () => h.api.recordVisitLog.mock.calls.at(-1)![0]

beforeEach(() => {
  h.state.stack = []
  h.api.recordVisitLog.mockClear()
  h.api.recordAnalyticsEvents.mockClear()
  __resetPageViewTrackingForTest()
})

afterEach(() => {
  __resetPageViewTrackingForTest()
  vi.useRealTimers()
})

describe('pageViewPath', () => {
  it('统一加 /mp/ 前缀并去掉前导斜杠', () => {
    expect(pageViewPath('pages/index/index')).toBe('/mp/pages/index/index')
    expect(pageViewPath('/pages/chat/index')).toBe('/mp/pages/chat/index')
  })

  it('空 route ⇒ null', () => {
    expect(pageViewPath(null)).toBeNull()
    expect(pageViewPath(undefined)).toBeNull()
    expect(pageViewPath('  ')).toBeNull()
  })

  it('超长截断到 500', () => {
    expect(pageViewPath('x'.repeat(800))?.length).toBe(500)
  })
})

describe('currentPageRoute', () => {
  it('取栈顶 route', () => {
    h.state.stack = [{ route: 'pages/index/index' }, { route: 'pages/chat/index' }]
    expect(currentPageRoute()).toBe('pages/chat/index')
  })

  it('空栈 ⇒ null', () => {
    expect(currentPageRoute()).toBeNull()
  })
})

describe('reportPageView', () => {
  it('首次上报走共享 api-client,带页面路径与会话 id', () => {
    expect(reportPageView('pages/index/index', 1_000)).toBe(true)
    expect(callCount()).toBe(1)
    const payload = lastPayload()
    expect(payload.url).toBe('/mp/pages/index/index')
    expect(typeof payload.sessionId).toBe('string')
  })

  it('同页 3 秒内去抖,换页立即放行', () => {
    expect(reportPageView('pages/index/index', 10_000)).toBe(true)
    expect(reportPageView('pages/index/index', 10_000 + MP_VISIT_DEBOUNCE_MS - 1)).toBe(false)
    expect(reportPageView('pages/chat/index', 10_000 + 1)).toBe(true)
    expect(callCount()).toBe(2)
  })

  it('换页即结算上一页停留:page_time 带上一页路径与整秒数', () => {
    reportPageView('pages/index/index', 0)
    reportPageView('pages/chat/index', 9_000)
    expect(h.api.recordAnalyticsEvents).toHaveBeenCalledTimes(1)
    const events = h.api.recordAnalyticsEvents.mock.calls[0]![0] as Array<{
      name: string
      label?: string
      value?: number
    }>
    expect(events[0]!.name).toBe('page_time')
    expect(events[0]!.label).toBe('/mp/pages/index/index')
    expect(events[0]!.value).toBe(9)
  })

  it('不足一秒的换页不报停留(轮询抖动不得进停留均值)', () => {
    reportPageView('pages/index/index', 0)
    reportPageView('pages/chat/index', 300)
    expect(h.api.recordAnalyticsEvents).not.toHaveBeenCalled()
  })

  it('空 route 不上报', () => {
    expect(reportPageView(null, 20_000)).toBe(false)
    expect(callCount()).toBe(0)
  })
})

describe('startPageViewTracking', () => {
  it('启动即报当前页,轮询只在新页出现时才再报,stop 后停止', () => {
    vi.useFakeTimers()
    h.state.stack = [{ route: 'pages/index/index' }]
    const stop = startPageViewTracking(2000)
    expect(callCount()).toBe(1)

    vi.advanceTimersByTime(2000)
    expect(callCount()).toBe(1)

    h.state.stack.push({ route: 'pages/chat/index' })
    vi.advanceTimersByTime(2000)
    expect(callCount()).toBe(2)
    expect(lastPayload().url).toBe('/mp/pages/chat/index')

    stop()
    h.state.stack.push({ route: 'pages/me/index' })
    vi.advanceTimersByTime(10_000)
    expect(callCount()).toBe(2)
  })

  it('重复调用不叠加定时器', () => {
    vi.useFakeTimers()
    h.state.stack = [{ route: 'pages/index/index' }]
    startPageViewTracking(2000)
    startPageViewTracking(2000)
    h.state.stack.push({ route: 'pages/chat/index' })
    vi.advanceTimersByTime(2000)
    expect(callCount()).toBe(2)
    stopPageViewTracking()
  })
})

describe('settlePageTime(退后台收口)', () => {
  it('退后台结算当前页停留:page_time 带当前页路径与整秒数,并清空在页状态', () => {
    reportPageView('pages/index/index', 0)
    expect(settlePageTime(30_000)).toBe(true)
    expect(h.api.recordAnalyticsEvents).toHaveBeenCalledTimes(1)
    const events = h.api.recordAnalyticsEvents.mock.calls[0]![0] as Array<{
      name: string
      label?: string
      value?: number
    }>
    expect(events[0]!.name).toBe('page_time')
    expect(events[0]!.label).toBe('/mp/pages/index/index')
    expect(events[0]!.value).toBe(30)

    // 清空后再次结算是 no-op(不重复报)
    expect(settlePageTime(31_000)).toBe(false)
    expect(h.api.recordAnalyticsEvents).toHaveBeenCalledTimes(1)
  })

  it('没有在页记录时是 no-op(启动即退后台不造空 label 事件)', () => {
    expect(settlePageTime(1_000)).toBe(false)
    expect(h.api.recordAnalyticsEvents).not.toHaveBeenCalled()
  })

  it('亚秒级停留不报(与换页结算同一判据),但状态仍被清掉', () => {
    reportPageView('pages/index/index', 0)
    expect(settlePageTime(300)).toBe(false)
    expect(h.api.recordAnalyticsEvents).not.toHaveBeenCalled()
    expect(settlePageTime(60_000)).toBe(false)
  })

  it('收口后回前台,轮询照常重新进页并结算', () => {
    reportPageView('pages/index/index', 0)
    settlePageTime(10_000)
    expect(reportPageView('pages/chat/index', 20_000)).toBe(true)
    // 首页已在收口里结算过;这次换页时在页为空 ⇒ 不新增 page_time
    expect(h.api.recordAnalyticsEvents).toHaveBeenCalledTimes(1)
    // 再换页 ⇒ 正常结算 chat 段
    reportPageView('pages/me/index', 50_000)
    const events2 = h.api.recordAnalyticsEvents.mock.calls[1]![0] as Array<{ label?: string }>
    expect(events2[0]!.label).toBe('/mp/pages/chat/index')
  })
})
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
