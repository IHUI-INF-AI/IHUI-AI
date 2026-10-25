// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * RN 端页面埋点取证(2026-10-26 立)。
 *
 * 钉三件:路径前缀统一 `/rn/`(后台只靠它区分端)、同屏 3 秒去抖、空名不造
 * `/rn/undefined`。任一被改坏,监控面要么多算(导航抖动)要么静默漏端。
 */
import { describe, it, expect, vi, beforeEach } from 'vitest'

vi.mock('../config', () => ({ API_BASE_URL: 'http://api.test' }))

import {
  __resetScreenViewThrottleForTest,
  reportScreenView,
  screenViewPath,
  SCREEN_VIEW_DEBOUNCE_MS,
} from '../visit-tracker'

const fetchMock = vi.fn(async () => ({ ok: true }))

beforeEach(() => {
  fetchMock.mockClear()
  vi.stubGlobal('fetch', fetchMock)
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
  it('首次进入即上报:POST 到访问端点,带会话 id 且不带身份字段', () => {
    const sent = reportScreenView('Home', 1_000)
    expect(sent).toBe(true)
    expect(fetchMock).toHaveBeenCalledTimes(1)
    const [url, init] = fetchMock.mock.calls[0] as unknown as [string, RequestInit]
    expect(url).toBe('http://api.test/api/visit-tracking/visit-log')
    expect(init.method).toBe('POST')
    const body = JSON.parse(String(init.body)) as Record<string, unknown>
    expect(body.url).toBe('/rn/Home')
    expect(typeof body.sessionId).toBe('string')
    expect('userId' in body).toBe(false)
  })

  it('同屏 3 秒内去抖,换屏立即放行', () => {
    expect(reportScreenView('Home', 10_000)).toBe(true)
    expect(reportScreenView('Home', 10_000 + SCREEN_VIEW_DEBOUNCE_MS - 1)).toBe(false)
    expect(reportScreenView('Chat', 10_000 + 1)).toBe(true)
    expect(fetchMock).toHaveBeenCalledTimes(2)
  })

  it('超过去抖窗口后同屏再次进入照报', () => {
    expect(reportScreenView('Home', 20_000)).toBe(true)
    expect(reportScreenView('Home', 20_000 + SCREEN_VIEW_DEBOUNCE_MS)).toBe(true)
    expect(fetchMock).toHaveBeenCalledTimes(2)
  })

  it('空名不发请求', () => {
    expect(reportScreenView(null, 30_000)).toBe(false)
    expect(fetchMock).not.toHaveBeenCalled()
  })

  it('网络失败静默(不抛、不影响导航)', async () => {
    fetchMock.mockRejectedValueOnce(new Error('offline'))
    expect(() => reportScreenView('Home', 40_000)).not.toThrow()
    await Promise.resolve()
  })
})
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
