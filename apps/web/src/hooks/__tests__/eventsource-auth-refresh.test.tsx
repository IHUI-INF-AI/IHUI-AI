// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * EventSource 三条腿(admin insights / agent runtime / kanban useAgentSSE)的
 * "cookie 里那枚 15 分钟 JWT 过期后"分档装车证明。
 *
 * 旧实现把 onerror 一律当"网络抖动,交给内置重连",而 EventSource 在**致命**失败
 * (HTTP 401/403/410)时是 `readyState === CLOSED` 且**不再**自动重连 ⇒ 功能哑掉零报错。
 * 四条臂(每条都是一个独立失效面):
 *  ① 致命 ⇒ 续期一次,并**重建**一条新流;
 *  ② 续期失败 ⇒ 不重建、大声报错(不静默);
 *  ③ 重建后仍致命 ⇒ 续期总数仍为 1(绝不无限重建刷同一枚死凭据);
 *  ④ 对照臂:瞬态(readyState=CONNECTING)⇒ 一次续期都不发、不报错(网络抖动 ≠ 会话失效,
 *     把它当失效就违反了"判不出不得登出"红线)。
 *
 * 摘掉新判据即翻红:把任一文件里的 `if (es.readyState !== EventSource.CLOSED) return`
 * 整块删掉 ⇒ ①②③ 全红(不会重建,也不会报错);把 `if (authRetried)` 那一格删掉 ⇒ ③ 红。
 */
import { act, renderHook } from '@testing-library/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import type { ReactNode } from 'react'

import { useAdminInsightsStream } from '@/hooks/use-admin-insights-stream'
import { useAgentRuntime } from '@/hooks/use-agent-runtime'
import { useAgentSSE } from '@/hooks/useAgentSSE'

const api = vi.hoisted(() => ({ refreshAccessTokenOnce: vi.fn<() => Promise<string | null>>() }))

vi.mock('@ihui/api-client', () => ({
  refreshAccessTokenOnce: () => api.refreshAccessTokenOnce(),
}))

vi.mock('@/lib/api', () => ({
  fetchApi: vi.fn(async () => ({ success: true, data: { list: [] } })),
  getStreamBaseUrl: () => '',
  getToken: () => 'token',
}))

class FakeEventSource {
  static readonly CONNECTING = 0
  static readonly OPEN = 1
  static readonly CLOSED = 2
  static instances: FakeEventSource[] = []

  readyState = FakeEventSource.CONNECTING
  closedByCode = false
  readonly url: string
  onopen: (() => void) | null = null
  onerror: ((e: unknown) => void) | null = null
  onmessage: ((e: { data: string }) => void) | null = null
  private readonly named = new Map<string, Array<(e: { data: string }) => void>>()

  constructor(url: string) {
    this.url = url
    FakeEventSource.instances.push(this)
  }
  addEventListener(type: string, cb: (e: { data: string }) => void): void {
    this.named.set(type, [...(this.named.get(type) ?? []), cb])
  }
  close(): void {
    this.closedByCode = true
  }
  /** 测试驱动:瞬态抖动(浏览器还会自己重连 ⇒ readyState 停在 CONNECTING) */
  fireTransient(): void {
    this.readyState = FakeEventSource.CONNECTING
    this.onerror?.({})
  }
  /** 测试驱动:致命失败(HTTP 401 ⇒ 浏览器不再重连) */
  fireFatal(): void {
    this.readyState = FakeEventSource.CLOSED
    this.onerror?.({})
  }
  open(): void {
    this.readyState = FakeEventSource.OPEN
    this.onopen?.()
  }
}

const esOf = (i: number): FakeEventSource => FakeEventSource.instances[i] as FakeEventSource
const settle = async (ms = 0): Promise<void> => {
  await act(async () => {
    await new Promise((r) => setTimeout(r, ms))
  })
}

function wrapper({ children }: { children: ReactNode }) {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  return <QueryClientProvider client={qc}>{children}</QueryClientProvider>
}

beforeEach(() => {
  FakeEventSource.instances = []
  api.refreshAccessTokenOnce.mockReset()
  vi.stubGlobal('EventSource', FakeEventSource)
})

afterEach(() => {
  vi.unstubAllGlobals()
  // vi.spyOn 复用同一个 console.error spy 且不清 calls ⇒ 不还原就会读到上一条的日志
  vi.restoreAllMocks()
})

describe('admin 运营洞察流:致命档续期一次并重建一次', () => {
  it('① 致命 ⇒ 续期一次 + 重建第二条流', async () => {
    api.refreshAccessTokenOnce.mockResolvedValue('fresh')
    const { result } = renderHook(() => useAdminInsightsStream(), { wrapper })
    expect(FakeEventSource.instances).toHaveLength(1)

    act(() => esOf(0)!.fireFatal())
    await settle()

    expect(api.refreshAccessTokenOnce).toHaveBeenCalledTimes(1)
    expect(FakeEventSource.instances).toHaveLength(2)
    expect(result.current.error).toBeNull()
  })

  it('② 续期失败 ⇒ 不重建,并给出可见错误(live=false + error + 日志)', async () => {
    api.refreshAccessTokenOnce.mockResolvedValue(null)
    const err = vi.spyOn(console, 'error').mockImplementation(() => {})
    const { result } = renderHook(() => useAdminInsightsStream(), { wrapper })

    act(() => esOf(0)!.fireFatal())
    await settle()

    expect(FakeEventSource.instances).toHaveLength(1)
    expect(result.current.live).toBe(false)
    expect(result.current.error).toBe('refresh-failed')
    expect(err).toHaveBeenCalled()
  })

  it('③ 重建后仍致命 ⇒ 续期总数仍为 1(绝不无限重建)', async () => {
    api.refreshAccessTokenOnce.mockResolvedValue('fresh')
    const err = vi.spyOn(console, 'error').mockImplementation(() => {})
    const { result } = renderHook(() => useAdminInsightsStream(), { wrapper })

    act(() => esOf(0)!.fireFatal())
    await settle()
    act(() => esOf(1)!.fireFatal())
    await settle()

    expect(api.refreshAccessTokenOnce).toHaveBeenCalledTimes(1)
    expect(FakeEventSource.instances).toHaveLength(2)
    expect(result.current.error).toBe('unauthorized-after-refresh')
    expect(err).toHaveBeenCalled()
  })

  it('④ 对照臂:瞬态抖动 ⇒ 一次续期都不发、不报错(交给内置重连)', async () => {
    const { result } = renderHook(() => useAdminInsightsStream(), { wrapper })
    act(() => esOf(0)!.fireTransient())
    await settle()
    expect(api.refreshAccessTokenOnce).not.toHaveBeenCalled()
    expect(FakeEventSource.instances).toHaveLength(1)
    expect(result.current.error).toBeNull()
  })

  it('正常开流 ⇒ error 归零(反向锁:别把成功读成失败)', async () => {
    const { result } = renderHook(() => useAdminInsightsStream(), { wrapper })
    act(() => esOf(0)!.open())
    await settle()
    expect(result.current.live).toBe(true)
    expect(result.current.error).toBeNull()
  })
})

describe('agent 运行时事件流:致命档续期一次并重建一次', () => {
  it('① 致命 ⇒ 续期一次,并经由 effect 重跑重建新流', async () => {
    api.refreshAccessTokenOnce.mockResolvedValue('fresh')
    const { result } = renderHook(() => useAgentRuntime('agent-1'), { wrapper })
    expect(FakeEventSource.instances).toHaveLength(1)

    act(() => esOf(0)!.fireFatal())
    await settle()

    expect(api.refreshAccessTokenOnce).toHaveBeenCalledTimes(1)
    expect(FakeEventSource.instances).toHaveLength(2)
    expect(result.current.streamError).toBeNull()
  })

  it('② 续期失败 ⇒ 不重建、置 streamError 并大声记日志', async () => {
    api.refreshAccessTokenOnce.mockResolvedValue(null)
    const err = vi.spyOn(console, 'error').mockImplementation(() => {})
    const { result } = renderHook(() => useAgentRuntime('agent-2'), { wrapper })

    act(() => esOf(0)!.fireFatal())
    await settle()

    expect(FakeEventSource.instances).toHaveLength(1)
    expect(result.current.connected).toBe(false)
    expect(result.current.streamError).toBe('refresh-failed')
    expect(err).toHaveBeenCalled()
  })

  it('③ 重建后仍致命 ⇒ 续期总数仍为 1', async () => {
    api.refreshAccessTokenOnce.mockResolvedValue('fresh')
    const err = vi.spyOn(console, 'error').mockImplementation(() => {})
    const { result } = renderHook(() => useAgentRuntime('agent-3'), { wrapper })

    act(() => esOf(0)!.fireFatal())
    await settle()
    act(() => esOf(1)!.fireFatal())
    await settle()

    expect(api.refreshAccessTokenOnce).toHaveBeenCalledTimes(1)
    expect(FakeEventSource.instances).toHaveLength(2)
    expect(result.current.streamError).toBe('unauthorized-after-refresh')
    expect(err).toHaveBeenCalled()
  })

  it('④ 对照臂:瞬态抖动 ⇒ 不续期、不报错、不重建', async () => {
    const { result } = renderHook(() => useAgentRuntime('agent-4'), { wrapper })
    act(() => esOf(0)!.fireTransient())
    await settle()
    expect(api.refreshAccessTokenOnce).not.toHaveBeenCalled()
    expect(FakeEventSource.instances).toHaveLength(1)
    expect(result.current.streamError).toBeNull()
  })

  it('换 agent ⇒ 续期账本重新起算(不得把上一位的那一次用在新一位上)', async () => {
    api.refreshAccessTokenOnce.mockResolvedValue('fresh')
    const { rerender } = renderHook(({ id }) => useAgentRuntime(id), {
      wrapper,
      initialProps: { id: 'agent-a' },
    })
    act(() => esOf(0)!.fireFatal())
    await settle()
    expect(FakeEventSource.instances).toHaveLength(2)

    rerender({ id: 'agent-b' })
    await settle()
    act(() => esOf(2)!.fireFatal())
    await settle()

    expect(api.refreshAccessTokenOnce).toHaveBeenCalledTimes(2)
  })
})

describe('看板 SSE(useAgentSSE):凭据每次建连现取 + 致命档只续期一次', () => {
  it('① 致命 ⇒ 续期一次并重建;重建那一跳带的是**现取**的新凭据', async () => {
    api.refreshAccessTokenOnce.mockResolvedValue('fresh')
    let seq = 0
    const supplier = vi.fn(() => `/api/agents/kanban/tasks/stream?token=t${++seq}`)
    renderHook(() => useAgentSSE(supplier), { wrapper })
    expect(supplier).toHaveBeenCalledTimes(1)
    expect(esOf(0)!.url).toContain('token=t1')

    act(() => esOf(0)!.fireFatal())
    await settle()

    expect(api.refreshAccessTokenOnce).toHaveBeenCalledTimes(1)
    expect(supplier).toHaveBeenCalledTimes(2)
    expect(esOf(1)!.url).toContain('token=t2')
  })

  it('② 续期失败 ⇒ 不重建、大声报错,并且不再排重连定时器', async () => {
    api.refreshAccessTokenOnce.mockResolvedValue(null)
    const err = vi.spyOn(console, 'error').mockImplementation(() => {})
    renderHook(() => useAgentSSE('/api/agents/kanban/tasks/stream?token=t1'), { wrapper })
    act(() => esOf(0)!.fireFatal())
    await settle()
    expect(FakeEventSource.instances).toHaveLength(1)
    expect(err).toHaveBeenCalled()
  })

  it('③ 重建后仍致命 ⇒ 续期总数仍为 1(绝不无限重建)', async () => {
    api.refreshAccessTokenOnce.mockResolvedValue('fresh')
    const err = vi.spyOn(console, 'error').mockImplementation(() => {})
    renderHook(() => useAgentSSE('/api/agents/kanban/tasks/stream'), { wrapper })
    act(() => esOf(0)!.fireFatal())
    await settle()
    act(() => esOf(1)!.fireFatal())
    await settle()
    expect(api.refreshAccessTokenOnce).toHaveBeenCalledTimes(1)
    expect(FakeEventSource.instances).toHaveLength(2)
    expect(err).toHaveBeenCalled()
  })

  it('④ 对照臂:瞬态抖动 ⇒ 走自己的退避重连,一次续期都不发', async () => {
    renderHook(() => useAgentSSE('/api/agents/kanban/tasks/stream'), { wrapper })
    act(() => esOf(0)!.fireTransient())
    await settle(1_200) // INITIAL_RETRY_DELAY = 1000ms
    expect(api.refreshAccessTokenOnce).not.toHaveBeenCalled()
    expect(FakeEventSource.instances).toHaveLength(2)
  })

  it('退避重连那一跳同样现取凭据(旧缺陷:URL 被 mount 时算死)', async () => {
    let seq = 0
    const supplier = vi.fn(() => `/api/agents/kanban/tasks/stream?token=t${++seq}`)
    renderHook(() => useAgentSSE(supplier), { wrapper })
    act(() => esOf(0)!.fireTransient())
    await settle(1_200)
    expect(esOf(1)!.url).toContain('token=t2')
  })
})
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
