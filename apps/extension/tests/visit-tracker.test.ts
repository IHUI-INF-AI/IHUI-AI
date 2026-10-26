// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * 浏览器插件端埋点取证(2026-10-26 立)。
 *
 * 钉四件:`/ex/` 前缀(后台只靠它把插件端从 web 里分出来)、同视图 3 秒去抖、
 * 空名不造 `/ex/undefined`、上报前必须先把 storage 里的 API 地址应用一次。
 * 最后一条是本端特有的:popup/sidepanel 的 initApi 与本模块的 ensureApiBaseUrl
 * 有先后竞态,漏掉它会把访问记录寄到默认 localhost 而不是用户配置的站点。
 */
import { describe, it, expect, vi, beforeEach } from 'vitest'

const h = vi.hoisted(() => ({
  recordVisitLog: vi.fn(async (_payload: Record<string, unknown>) => ({
    success: true,
    data: {},
  })),
  setBaseUrl: vi.fn((_url: string) => {}),
  initApiBaseUrl: vi.fn(async () => {
    // 模拟真实 storage 读取是异步的:晚于 report 调用点
  }),
  recordAnalyticsEvents: vi.fn(async (_events: unknown[]) => ({ success: true, data: {} })),
}))

vi.mock('@ihui/api-client', () => ({
  recordVisitLog: (payload: Record<string, unknown>) => h.recordVisitLog(payload),
  setBaseUrl: (url: string) => h.setBaseUrl(url),
  recordAnalyticsEvents: (events: unknown[]) => h.recordAnalyticsEvents(events),
}))

vi.mock('../lib/config', () => ({
  initApiBaseUrl: () => h.initApiBaseUrl(),
  getApiBaseUrl: () => 'http://api.test',
}))

import {
  __resetExtensionViewTrackingForTest,
  EXT_VIEW_DEBOUNCE_MS,
  extensionViewPath,
  reportExtensionView,
} from '../lib/visit-tracker'

beforeEach(() => {
  h.recordVisitLog.mockClear()
  h.setBaseUrl.mockClear()
  h.initApiBaseUrl.mockClear()
  h.recordAnalyticsEvents.mockClear()
  __resetExtensionViewTrackingForTest()
})

describe('extensionViewPath', () => {
  it('统一加 /ex/ 前缀并剥掉首尾斜杠', () => {
    expect(extensionViewPath('popup')).toBe('/ex/popup')
    expect(extensionViewPath('/sidepanel/chat')).toBe('/ex/sidepanel/chat')
    expect(extensionViewPath('sidepanel/')).toBe('/ex/sidepanel')
  })

  it('空名 / 只剩斜杠 ⇒ null(不得造 /ex/undefined)', () => {
    expect(extensionViewPath(null)).toBeNull()
    expect(extensionViewPath(undefined)).toBeNull()
    expect(extensionViewPath('   ')).toBeNull()
    expect(extensionViewPath('/')).toBeNull()
  })

  it('超长截断到 500(与服务端列长一致)', () => {
    expect(extensionViewPath('x'.repeat(800))?.length).toBe(500)
  })
})

describe('reportExtensionView', () => {
  it('首报即发出:先应用 API 地址,再寄 /ex/ 路径与会话 id,不带身份字段', async () => {
    expect(reportExtensionView('popup', 1_000)).toBe(true)
    await vi.waitFor(() => expect(h.recordVisitLog).toHaveBeenCalledTimes(1))
    expect(h.initApiBaseUrl).toHaveBeenCalledTimes(1)
    expect(h.setBaseUrl).toHaveBeenCalledWith('http://api.test')
    const [payload] = h.recordVisitLog.mock.calls[0] ?? []
    expect(payload?.url).toBe('/ex/popup')
    expect(typeof payload?.sessionId).toBe('string')
    expect('userId' in (payload ?? {})).toBe(false)
  })

  it('同视图 3 秒内去抖,换视图立即放行', async () => {
    expect(reportExtensionView('sidepanel/chat', 10_000)).toBe(true)
    expect(reportExtensionView('sidepanel/chat', 10_000 + EXT_VIEW_DEBOUNCE_MS - 1)).toBe(false)
    expect(reportExtensionView('sidepanel/me', 10_000 + 1)).toBe(true)
    await vi.waitFor(() => expect(h.recordVisitLog).toHaveBeenCalledTimes(2))
  })

  it('超过去抖窗口后同视图再次进入照报', async () => {
    expect(reportExtensionView('popup', 20_000)).toBe(true)
    expect(reportExtensionView('popup', 20_000 + EXT_VIEW_DEBOUNCE_MS)).toBe(true)
    await vi.waitFor(() => expect(h.recordVisitLog).toHaveBeenCalledTimes(2))
  })

  it('空名不发请求', async () => {
    expect(reportExtensionView(null, 30_000)).toBe(false)
    expect(reportExtensionView('', 30_000)).toBe(false)
    await Promise.resolve()
    expect(h.recordVisitLog).not.toHaveBeenCalled()
  })

  it('换视图结算上一页停留:page_time 带上一页路径与整秒数', async () => {
    reportExtensionView('sidepanel/chat', 60_000)
    reportExtensionView('sidepanel/me', 85_000)
    await vi.waitFor(() => expect(h.recordAnalyticsEvents).toHaveBeenCalledTimes(1))
    const events = h.recordAnalyticsEvents.mock.calls[0]![0] as Array<{
      name: string
      label?: string
      value?: number
    }>
    expect(events[0]!.name).toBe('page_time')
    expect(events[0]!.label).toBe('/ex/sidepanel/chat')
    expect(events[0]!.value).toBe(25)
  })

  it('同视图重复进入不结算停留;距上次换视图仍按进入时刻算一次;不足一秒不报', async () => {
    reportExtensionView('sidepanel/chat', 100_000)
    reportExtensionView('sidepanel/chat', 120_000)
    expect(h.recordAnalyticsEvents).not.toHaveBeenCalled()
    // enterAt 记的是"进入 chat 的时刻"(100_000),换走时结算 20 秒,而不是 0.3 秒
    reportExtensionView('sidepanel/me', 120_300)
    await vi.waitFor(() => expect(h.recordAnalyticsEvents).toHaveBeenCalledTimes(1))
    const events = h.recordAnalyticsEvents.mock.calls[0]![0] as Array<{ value?: number }>
    expect(events[0]!.value).toBe(20)
    // 快速划过(四舍五入后不足 1 秒)不产第二条
    __resetExtensionViewTrackingForTest()
    reportExtensionView('sidepanel/me', 200_000)
    reportExtensionView('sidepanel/chat', 200_300)
    await Promise.resolve()
    expect(h.recordAnalyticsEvents).toHaveBeenCalledTimes(1)
  })

  it('storage 读失败仍然上报(用运行时默认地址),不静默丢整端', async () => {
    h.initApiBaseUrl.mockRejectedValueOnce(new Error('storage unavailable'))
    expect(reportExtensionView('popup', 40_000)).toBe(true)
    await vi.waitFor(() => expect(h.recordVisitLog).toHaveBeenCalledTimes(1))
  })

  it('上报失败不影响调用方(不抛)', async () => {
    h.recordVisitLog.mockRejectedValueOnce(new Error('offline'))
    expect(() => reportExtensionView('sidepanel/chat', 50_000)).not.toThrow()
    await vi.waitFor(() => expect(h.initApiBaseUrl).toHaveBeenCalledTimes(1))
  })
})
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
