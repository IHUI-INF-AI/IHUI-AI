// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * RN 端页面埋点取证(2026-10-26 立)。
 *
 * 钉三件:路径前缀统一 `/rn/`(后台只靠它区分端)、同屏 3 秒去抖、空名不造
 * `/rn/undefined`;并钉上报走共享 api-client(端内手拼 baseUrl 会被守门 184 拦)。
 */
import { describe, it, expect, vi, beforeEach } from 'vitest'

const h = vi.hoisted(() => ({
  recordVisitLog: vi.fn((_payload: { url: string; sessionId: string }) =>
    Promise.resolve({ success: true, data: {} }),
  ),
  recordAnalyticsEvents: vi.fn((_events: unknown[]) =>
    Promise.resolve({ success: true, data: {} }),
  ),
}))

vi.mock('@ihui/api-client', () => ({
  recordVisitLog: h.recordVisitLog,
  recordAnalyticsEvents: h.recordAnalyticsEvents,
}))

import {
  __resetScreenViewThrottleForTest,
  reportScreenView,
  screenViewPath,
  SCREEN_VIEW_DEBOUNCE_MS,
} from '../visit-tracker'

const callCount = () => h.recordVisitLog.mock.calls.length
const lastPayload = () => h.recordVisitLog.mock.calls.at(-1)![0]

beforeEach(() => {
  h.recordVisitLog.mockClear()
  h.recordVisitLog.mockImplementation(() => Promise.resolve({ success: true, data: {} }))
  h.recordAnalyticsEvents.mockClear()
  h.recordAnalyticsEvents.mockImplementation(() => Promise.resolve({ success: true, data: {} }))
  __resetScreenViewThrottleForTest()
})

describe('screenViewPath', () => {
  it('统一加 /rn/ 前缀', () => {
    expect(screenViewPath('Home')).toBe('/rn/Home')
    expect(screenViewPath('Chat')).toBe('/rn/Chat')
  })

  it('空名 / null ⇒ null(不得造 /rn/undefined)', () => {
    expect(screenViewPath(null)).toBeNull()
    expect(screenViewPath(undefined)).toBeNull()
    expect(screenViewPath('   ')).toBeNull()
  })

  it('超长名截断到 500(与服务端列长一致)', () => {
    const path = screenViewPath('x'.repeat(800))
    expect(path?.length).toBe(500)
  })
})

describe('reportScreenView', () => {
  it('首次进入即上报:走共享 api-client,带会话 id 且不带身份字段', () => {
    const sent = reportScreenView('Home', 1_000)
    expect(sent).toBe(true)
    expect(callCount()).toBe(1)
    const payload = lastPayload() as Record<string, unknown>
    expect(payload.url).toBe('/rn/Home')
    expect(typeof payload.sessionId).toBe('string')
    expect('userId' in payload).toBe(false)
  })

  it('同屏 3 秒内去抖,换屏立即放行', () => {
    expect(reportScreenView('Home', 10_000)).toBe(true)
    expect(reportScreenView('Home', 10_000 + SCREEN_VIEW_DEBOUNCE_MS - 1)).toBe(false)
    expect(reportScreenView('Chat', 10_000 + 1)).toBe(true)
    expect(callCount()).toBe(2)
  })

  it('超过去抖窗口后同屏再次进入照报', () => {
    expect(reportScreenView('Home', 20_000)).toBe(true)
    expect(reportScreenView('Home', 20_000 + SCREEN_VIEW_DEBOUNCE_MS)).toBe(true)
    expect(callCount()).toBe(2)
  })

  it('换屏即结算上一屏停留:page_time 带上一屏路径与整秒数', () => {
    reportScreenView('Home', 0)
    reportScreenView('Chat', 12_000)
    expect(h.recordAnalyticsEvents).toHaveBeenCalledTimes(1)
    const events = h.recordAnalyticsEvents.mock.calls[0]![0] as Array<{
      name: string
      label?: string
      value?: number
    }>
    expect(events[0]!.name).toBe('page_time')
    expect(events[0]!.label).toBe('/rn/Home')
    expect(events[0]!.value).toBe(12)
  })

  it('亚秒级换屏不报停留(导航抖动不得进停留均值),同屏反复进入也不重复报', () => {
    reportScreenView('Home', 0)
    reportScreenView('Chat', 400)
    reportScreenView('Chat', 40_000)
    reportScreenView('Chat', 60_000)
    expect(h.recordAnalyticsEvents).not.toHaveBeenCalled()
  })

  it('空名不上报', () => {
    expect(reportScreenView(null, 30_000)).toBe(false)
    expect(callCount()).toBe(0)
  })

  it('上报失败静默(不抛、不影响导航)', async () => {
    h.recordVisitLog.mockImplementationOnce(() => Promise.reject(new Error('offline')))
    expect(() => reportScreenView('Home', 40_000)).not.toThrow()
    await Promise.resolve()
  })
})
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
