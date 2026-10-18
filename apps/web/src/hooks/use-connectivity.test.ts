// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

// 票85④ —— useConnectivity 的**判定级**用例。
//
// 本 hook 是 adapter(怎么探),判据在 packages/shared/utils/connectivity.ts(怎么判)。
// 所以这里的每一条断言都是在验证"共享层的语义有没有被端上改写/折叠",而不是重造一份判据:
//   - 拿到任何 HTTP 响应(含 5xx)= 路径通 ⇒ 不是离线;
//   - 探测失败 + 设备在线 ⇒ unknown,横幅档 unconfirmed(**绝不落 offline**);
//   - 设备信号报无网 ⇒ 才落 offline;
//   - 一次没探过 ⇒ unknown / no-sample,**不等于在线**;
//   - 连续 3 轮全目标未答(设备信号也判不出来)才升级 offline。

import { renderHook, waitFor } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import { useConnectivity } from '@/hooks/use-connectivity'

/** hook 读的是 navigator.onLine(jsdom 真身在 navigator 实例,不在 window);传 null = 拿不到信号 */
function setNavigatorOnline(value: boolean | null) {
  Object.defineProperty(window.navigator, 'onLine', {
    configurable: true,
    writable: true,
    value: value === null ? undefined : value,
  })
}

function stubFetchOk(status = 200) {
  vi.stubGlobal('fetch', vi.fn(async () => new Response('{}', { status })))
}

function stubFetchThrows() {
  vi.stubGlobal(
    'fetch',
    vi.fn(async () => {
      throw new TypeError('Failed to fetch')
    }),
  )
}

beforeEach(() => {
  setNavigatorOnline(true)
  vi.useFakeTimers({ shouldAdvanceTime: true })
})

afterEach(() => {
  vi.useRealTimers()
  vi.unstubAllGlobals()
  vi.restoreAllMocks()
  setNavigatorOnline(true)
})

describe('票85④ / useConnectivity 判据不得被端上改写', () => {
  it('没探过 ⇒ unknown / no-sample,不是 online(未判定 ≠ 在线)', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(() => new Promise(() => {})), // 永不 settle
    )
    const { result } = renderHook(() => useConnectivity())
    expect(result.current.status).toBe('unknown')
    expect(result.current.reason).toBe('no-sample')
    expect(result.current.banner).toBe('none')
  })

  it('拿到 2xx 且快 ⇒ online,不打扰', async () => {
    stubFetchOk(200)
    const { result } = renderHook(() => useConnectivity())
    await waitFor(() => expect(result.current.status).toBe('online'))
    expect(result.current.reason).toBe('server-answered')
    expect(result.current.banner).toBe('none')
  })

  it('5xx 也算"答了" ⇒ 仍是 online(服务健康度不是连通性事实)', async () => {
    stubFetchOk(503)
    const { result } = renderHook(() => useConnectivity())
    await waitFor(() => expect(result.current.status).toBe('online'))
    expect(result.current.banner).toBe('none')
  })

  it('慢响应 ⇒ slow 一档,不是断网', async () => {
    stubFetchOk(200)
    // 直接给耗时,不靠真实时钟:首末两次读数差 3000ms ≥ slowLatencyMs(2500)
    vi.spyOn(performance, 'now').mockReturnValueOnce(1_000).mockReturnValueOnce(4_000)
    const { result } = renderHook(() => useConnectivity())
    await waitFor(() => expect(result.current.status).toBe('slow'))
    expect(result.current.reason).toBe('slow-response')
    expect(result.current.banner).toBe('slow')
  })

  it('fetch 抛错 + 设备在线 ⇒ unknown / probe-target-unreachable,横幅 unconfirmed(不落离线)', async () => {
    stubFetchThrows()
    setNavigatorOnline(true)
    const { result } = renderHook(() => useConnectivity())
    await waitFor(() => expect(result.current.status).toBe('unknown'))
    expect(result.current.reason).toBe('probe-target-unreachable')
    expect(result.current.banner).toBe('unconfirmed')
  })

  it('设备信号报无网 + 探测也没答 ⇒ offline / device-offline-signal', async () => {
    stubFetchThrows()
    setNavigatorOnline(false)
    const { result } = renderHook(() => useConnectivity())
    await waitFor(() => expect(result.current.status).toBe('offline'))
    expect(result.current.reason).toBe('device-offline-signal')
    expect(result.current.banner).toBe('offline')
  })

  it('设备信号报无网但目标答了 ⇒ 按应答为准,不判离线(交叉反证优先于单一信号)', async () => {
    // 这条正是共享层要根治的并档:旧实现把"信号说没网"直接读成断网,
    // 真机 G-1113920 上两条 NetworkAgentInfo 都 VALIDATED 却一路亮红,根因就在这。
    stubFetchOk(200)
    setNavigatorOnline(false)
    const { result } = renderHook(() => useConnectivity())
    await waitFor(() => expect(result.current.status).toBe('online'))
    expect(result.current.banner).toBe('none')
    expect(result.current.detail.join(' ')).toContain('按应答为准')
  })

  it('设备信号也判不出来 ⇒ 连续 3 轮全未答才升级 offline(单轮抖动不冒红)', async () => {
    stubFetchThrows()
    setNavigatorOnline(null) // navigator.onLine 不是 boolean ⇒ deviceSignal=unknown
    const { result } = renderHook(() => useConnectivity())
    await waitFor(() => expect(result.current.consecutiveFailedRounds).toBe(1))
    // 第 1 轮只到 pending-confirmation:不打扰
    expect(result.current.status).toBe('unknown')
    expect(result.current.banner).toBe('none')
    // 再推两轮 ⇒ 达到阈值。**每段推进只够触发一轮**:定时器是在上一轮结论落定后才续排的,
    // 排期点落在当前假时点之后,故一次 advanceTimersByTimeAsync 只兑现一次复探 ——
    // 这恰好也是"续排"存在的证据(若排期停摆,第二段推进后轮数不会增加)。
    await vi.advanceTimersByTimeAsync(15_000)
    await waitFor(() => expect(result.current.consecutiveFailedRounds).toBe(2))
    expect(result.current.status, '第 2 轮仍不得升级').toBe('unknown')
    await vi.advanceTimersByTimeAsync(15_000)
    await waitFor(() => expect(result.current.status).toBe('offline'))
    expect(result.current.reason).toBe('all-targets-unreachable')
    expect(result.current.banner).toBe('offline')
  })
})
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
