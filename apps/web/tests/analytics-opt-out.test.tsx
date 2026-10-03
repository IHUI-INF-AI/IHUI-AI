// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * 埋点 opt-out 测试(2026-10-03 数据出域合规整改)
 *
 * 覆盖判定链(优先级从高到低):
 *   1. DNT=1(navigator.doNotTrack / window.doNotTrack)→ 不发网络请求
 *   2. /settings/privacy 的 analyticsEnabled='false' → 不发
 *   3. 缺省 / 拉取失败 → 发(保持整改前的现状口径)
 *
 * 关键断言口径是「**没有发出上报请求**」,而不是「服务端丢弃了」——
 * opt-out 的语义是客户端根本不上报,不是发了再被后端丢。
 *
 * 断言对象是 fetchApiMock(而非全局 fetch):useAnalytics 走 @/lib/api 的 fetchApi,
 * 它才是这条线上报的唯一出口(已整体 mock)。同时对全局 fetch 也断言,
 * 双通道都收口,防后续有人绕过包装层直连。
 */
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import { renderHook, act } from '@testing-library/react'

const { fetchMock, fetchApiMock } = vi.hoisted(() => ({
  fetchMock: vi.fn(),
  fetchApiMock: vi.fn(),
}))

// 全局 fetch(useAnalytics 走 fetchApi;flushBeacon 走 navigator.sendBeacon)
vi.stubGlobal('fetch', fetchMock)
// fetchApi 是 web 端包装层(内含 401 处理),这里只关心它有没有被调用
vi.mock('@/lib/api', () => ({ fetchApi: fetchApiMock }))

const {
  useAnalytics,
  isAnalyticsEnabled,
  isDoNotTrackEnabled,
  refreshAnalyticsConsent,
  __resetAnalyticsConsentForTests,
} = await import('@/hooks/use-analytics')

/** 造一个 /settings/privacy 的成功响应 */
function privacyOk(settings: Record<string, string>) {
  fetchApiMock.mockResolvedValue({ success: true, data: { settings } })
}

/**
 * 取上报请求的调用记录(排除 refreshAnalyticsConsent 对 /settings/privacy 的那次读取)。
 * fetchApiMock 同时服务「读偏好」与「发埋点」两个用途,不能直接看总调用数。
 */
function reportCalls() {
  return fetchApiMock.mock.calls.filter((c) => String(c[0]).includes('/analytics/track'))
}

/** 断言两条上报通道都没有发出上报请求(opt-out 的真实口径) */
function expectNoReportSent() {
  expect(reportCalls()).toHaveLength(0)
  expect(fetchMock).not.toHaveBeenCalled()
}

/** DNT 置位(默认放 navigator.doNotTrack) */
function setDnt(value: string | undefined, target: 'navigator' | 'window' = 'navigator') {
  if (target === 'navigator') {
    Object.defineProperty(globalThis.navigator, 'doNotTrack', {
      value,
      configurable: true,
    })
  } else {
    ;(globalThis as unknown as { doNotTrack?: string }).doNotTrack = value
  }
}

beforeEach(() => {
  __resetAnalyticsConsentForTests()
  fetchMock.mockReset()
  fetchApiMock.mockReset()
  fetchMock.mockResolvedValue({ success: true })
  setDnt(undefined)
  delete (globalThis as unknown as { doNotTrack?: string }).doNotTrack
})

afterEach(() => {
  __resetAnalyticsConsentForTests()
})

describe('isDoNotTrackEnabled', () => {
  it('navigator.doNotTrack === "1" → 开启', () => {
    setDnt('1')
    expect(isDoNotTrackEnabled()).toBe(true)
  })

  it('window.doNotTrack === "1" → 开启(旧版位置也读)', () => {
    setDnt(undefined)
    ;(globalThis as unknown as { doNotTrack?: string }).doNotTrack = '1'
    expect(isDoNotTrackEnabled()).toBe(true)
  })

  it('DNT 为 "0" / undefined / 其它值 → 不开启(只认明确的拒绝)', () => {
    setDnt('0')
    expect(isDoNotTrackEnabled()).toBe(false)
    setDnt(undefined)
    expect(isDoNotTrackEnabled()).toBe(false)
    setDnt('unspecified')
    expect(isDoNotTrackEnabled()).toBe(false)
  })
})

describe('isAnalyticsEnabled 判定链', () => {
  it('默认(未拉取偏好)= 开启,保持整改前行为', () => {
    expect(isAnalyticsEnabled()).toBe(true)
  })

  it('DNT=1 时即使偏好为开启也判为关闭(DNT 优先级更高)', async () => {
    privacyOk({ analyticsEnabled: 'true' })
    await refreshAnalyticsConsent()
    expect(isAnalyticsEnabled()).toBe(true)

    setDnt('1')
    expect(isAnalyticsEnabled()).toBe(false)
  })

  it('偏好为 "false" → 关闭', async () => {
    privacyOk({ analyticsEnabled: 'false' })
    await refreshAnalyticsConsent()
    expect(isAnalyticsEnabled()).toBe(false)
  })

  it('偏好缺省(无该键)→ 开启', async () => {
    privacyOk({ someOtherKey: 'x' })
    await refreshAnalyticsConsent()
    expect(isAnalyticsEnabled()).toBe(true)
  })

  it('偏好为 "true" → 开启', async () => {
    privacyOk({ analyticsEnabled: 'true' })
    await refreshAnalyticsConsent()
    expect(isAnalyticsEnabled()).toBe(true)
  })

  it('拉取失败(抛错)→ 按默认开启,不静默改变行为', async () => {
    fetchApiMock.mockRejectedValue(new Error('network down'))
    await expect(refreshAnalyticsConsent()).resolves.toBe(true)
    expect(isAnalyticsEnabled()).toBe(true)
  })

  it('拉取失败(success:false)→ 按默认开启', async () => {
    fetchApiMock.mockResolvedValue({ success: false, status: 401 })
    await expect(refreshAnalyticsConsent()).resolves.toBe(true)
    expect(isAnalyticsEnabled()).toBe(true)
  })

  it('并发调用共享同一次网络请求(in-flight 去重)', async () => {
    privacyOk({ analyticsEnabled: 'false' })
    await Promise.all([refreshAnalyticsConsent(), refreshAnalyticsConsent(), refreshAnalyticsConsent()])
    expect(fetchApiMock).toHaveBeenCalledTimes(1)
  })
})

describe('useAnalytics.track 的 opt-out 行为', () => {
  it('DNT=1 时 track 不产生任何上报请求', async () => {
    setDnt('1')
    const { result } = renderHook(() => useAnalytics())
    await act(async () => {
      result.current.track({ name: 'click', category: 'ui', label: 'btn' })
      await result.current.flush()
    })
    expectNoReportSent()
  })

  it('偏好关闭时 track 不产生任何上报请求', async () => {
    privacyOk({ analyticsEnabled: 'false' })
    await refreshAnalyticsConsent()

    const { result } = renderHook(() => useAnalytics())
    await act(async () => {
      result.current.track({ name: 'click', category: 'ui', label: 'btn' })
      await result.current.flush()
    })
    expectNoReportSent()
  })

  it('偏好缺省时 track 正常上报(保持现状)', async () => {
    privacyOk({})
    await refreshAnalyticsConsent()

    const { result } = renderHook(() => useAnalytics())
    await act(async () => {
      result.current.track({ name: 'page_view', category: 'navigation', label: '/chat' })
      await result.current.flush()
    })
    expect(reportCalls()).toHaveLength(1)
    const [url, init] = reportCalls()[0]
    expect(url).toBe('/api/analytics/track')
    const body = JSON.parse((init as RequestInit).body as string)
    expect(body.events).toHaveLength(1)
    expect(body.events[0].name).toBe('page_view')
  })

  it('偏好关闭时,已缓冲的事件在 flush 阶段被丢弃而非补发', async () => {
    // 先在开启状态下入队,随后用户关闭埋点
    privacyOk({ analyticsEnabled: 'true' })
    await refreshAnalyticsConsent()

    const { result } = renderHook(() => useAnalytics())
    await act(async () => {
      result.current.track({ name: 'a' })
      privacyOk({ analyticsEnabled: 'false' })
      await refreshAnalyticsConsent()
      await result.current.flush()
    })
    // 缓冲区里的那条不能被补发出去
    expectNoReportSent()
  })

  it('偏好关闭时 flushBeacon 也不发 sendBeacon', async () => {
    const sendBeacon = vi.fn(() => true)
    Object.defineProperty(globalThis.navigator, 'sendBeacon', {
      value: sendBeacon,
      configurable: true,
    })
    privacyOk({ analyticsEnabled: 'false' })
    await refreshAnalyticsConsent()

    const { result } = renderHook(() => useAnalytics())
    await act(async () => {
      result.current.track({ name: 'a' })
      result.current.flushBeacon()
    })
    expect(sendBeacon).not.toHaveBeenCalled()
    expectNoReportSent()
  })
})
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
