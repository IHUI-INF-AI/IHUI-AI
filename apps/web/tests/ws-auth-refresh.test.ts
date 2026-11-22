// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * 三条 ?token= 裸 WebSocket 的"过期后换新"装车证明:
 *  - demand-audit /ws/chat:凭据现取 + 到期即发起续期(判不出不得猜);
 *  - 终端 /ws/terminal:握手被拒(4001)⇒ 续期一次 + 用新凭据重连一次,失败才报永久错误;
 *  - AI 业务流:改用 POST /ws/ticket 短期票(access 不再进 URL),换不到才降级直连,
 *    从未开成的握手 ⇒ 续期一次并重连一次。
 *
 * 摘掉新判据即翻红:
 *  - 删 buildChatWsUrl 里的 `shouldRefreshNow` 那两行 ⇒ 「过期⇒发起续期」红;
 *  - 删 use-terminal-session 的 `if (e.code === 4001 && !authRetried)` 块 ⇒ 终端两臂红;
 *  - 删 use-ai-ws-business 的 fetchWsTicket/握手重试块 ⇒ 换票臂与握手重试臂红。
 */
import { act, renderHook } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
// 只取类型(编译期擦除,不影响下面"先 mock 再动态 import"的时序)
import type { useAiWebSocket } from '@/hooks/use-ai-ws-business'

const api = vi.hoisted(() => ({
  refreshAccessTokenOnce: vi.fn<() => Promise<string | null>>(),
  fetchWsTicket: vi.fn<(base: string, token: string) => Promise<string | null>>(),
}))

vi.mock('@ihui/api-client', () => ({
  refreshAccessTokenOnce: () => api.refreshAccessTokenOnce(),
  fetchWsTicket: (base: string, token: string) => api.fetchWsTicket(base, token),
}))

const auth = vi.hoisted(() => ({ token: null as string | null }))
vi.mock('@/stores/auth', () => ({
  useAuthStore: Object.assign(
    (sel: (s: { token: string | null }) => unknown) => sel({ token: auth.token }),
    { getState: () => ({ token: auth.token }) },
  ),
}))

vi.mock('@/lib/api', () => ({
  fetchApi: vi.fn(async () => ({ success: true, data: {} })),
  getStreamBaseUrl: () => 'http://127.0.0.1:0',
}))

vi.mock('@/components/common', () => ({
  toast: { error: vi.fn(), info: vi.fn(), success: vi.fn(), warning: vi.fn() },
}))

vi.mock('next-intl', () => ({
  useTranslations: () => (key: string): string => key,
}))

vi.mock('@/hooks/use-ai-websocket', () => ({
  PROVIDER_PATHS: {
    qwen: '/qwen/ws',
    zhipu: '/zhipu/ws',
    deepseek: '/deepseek/ws',
    doubao: '/doubao/ws',
    generic: '/generic/ws',
  },
}))

// 终端 store:connectWS 这条腿只用到 token + WS,其余字段一律给可调用桩
vi.mock('@/stores/terminal', () => {
  const fn = vi.fn()
  const state: Record<string, unknown> = {
    sessions: [],
    activeSessionId: null,
    loading: false,
    error: null,
    panes: {},
    activePaneId: null,
    splitDirections: {},
    recordingBySession: {},
    recordings: [],
    activePlaybackId: null,
    commandHistory: [],
    aiSuggestOpen: false,
    aiSuggestLoading: false,
    aiSuggestions: [],
    aiDiagnoseOpen: false,
    aiDiagnoseLoading: false,
    aiDiagnoseResult: null,
    aiError: null,
    getPanes: () => [],
    getSplitDirection: () => undefined,
    isRecording: () => false,
  }
  const proxy = new Proxy(state, {
    get: (t, k: string) => (k in t ? t[k] : fn),
    set: (t, k: string, v) => {
      t[k] = v
      return true
    },
  })
  return { useTerminalStore: Object.assign(() => proxy, { getState: () => proxy }) }
})

/** 造一枚只带 exp 的 JWT(readExp 只解 payload,不验签) */
function jwt(expSeconds: number): string {
  const b64 = (o: unknown): string => btoa(JSON.stringify(o))
  return `${b64({ alg: 'none' })}.${b64({ exp: expSeconds })}.sig`
}

class FakeWebSocket {
  static readonly CONNECTING = 0
  static readonly OPEN = 1
  static readonly CLOSING = 2
  static readonly CLOSED = 3
  static instances: FakeWebSocket[] = []
  readyState = 0
  onopen: (() => void) | null = null
  onmessage: ((e: { data: string }) => void) | null = null
  onclose: ((e: { code: number }) => void) | null = null
  onerror: (() => void) | null = null
  sent: string[] = []
  constructor(public readonly url: string) {
    FakeWebSocket.instances.push(this)
  }
  send(data: string): void {
    this.sent.push(data)
  }
  close(): void {
    this.readyState = FakeWebSocket.CLOSED
  }
  addEventListener(): void {}
  openSelf(): void {
    this.readyState = FakeWebSocket.OPEN
    this.onopen?.()
  }
  /** 后端 wsAuth 直接以业务码关闭(握手被拒时浏览器给出的就是这个) */
  closeWith(code: number): void {
    this.readyState = FakeWebSocket.CLOSED
    this.onclose?.({ code })
  }
}

const wsOf = (i: number): FakeWebSocket => FakeWebSocket.instances[i] as FakeWebSocket
const settle = async (ms = 0): Promise<void> => {
  await act(async () => {
    await new Promise((r) => setTimeout(r, ms))
  })
}

beforeEach(() => {
  FakeWebSocket.instances = []
  api.refreshAccessTokenOnce.mockReset()
  api.fetchWsTicket.mockReset()
  auth.token = jwt(Math.floor(Date.now() / 1000) + 900)
  vi.stubGlobal('WebSocket', FakeWebSocket)
  FakeWebSocket.instances = []
})

afterEach(() => {
  vi.unstubAllGlobals()
  vi.restoreAllMocks()
})

describe('demand-audit /ws/chat:建连时现取凭据 + 到期即续期', () => {
  // helpers.ts 的 useChatWs 会拉起 createWebSocketHook,这里只要 buildChatWsUrl 这一个出口
  async function loadHelpers() {
    return import('../app/(main)/admin/demand-audit/helpers')
  }

  it('凭据已过期 ⇒ 发起一次续期(单飞),URL 用 store 当前那枚', async () => {
    auth.token = jwt(Math.floor(Date.now() / 1000) - 60)
    api.refreshAccessTokenOnce.mockResolvedValue('fresh')
    const { buildChatWsUrl } = await loadHelpers()
    const url = buildChatWsUrl('stale-from-closure')
    await settle()

    expect(api.refreshAccessTokenOnce).toHaveBeenCalledTimes(1)
    expect(decodeURIComponent(url)).toContain(`token=${auth.token}`)
    expect(url).not.toContain('stale-from-closure')
  })

  it('对照臂:凭据还有一刻钟寿命 ⇒ 一个续期请求都不发', async () => {
    const { buildChatWsUrl } = await loadHelpers()
    const url = buildChatWsUrl(auth.token)
    await settle()
    expect(api.refreshAccessTokenOnce).not.toHaveBeenCalled()
    expect(url).toContain('token=')
  })

  it('判不出(不是 JWT / 没有 exp)⇒ 不猜"该刷了",也不登出', async () => {
    auth.token = 'opaque-token-without-dots'
    const { buildChatWsUrl } = await loadHelpers()
    const url = buildChatWsUrl(auth.token)
    await settle()
    expect(api.refreshAccessTokenOnce).not.toHaveBeenCalled()
    expect(url).toContain('token=opaque-token-without-dots')
  })

  it('无凭据 ⇒ 返回空串(不得构造一条注定失败握手)', async () => {
    auth.token = null
    const { buildChatWsUrl } = await loadHelpers()
    expect(buildChatWsUrl(null)).toBe('')
  })
})

describe('终端 WebSocket:4001 续期一次并重连一次', () => {
  async function loadHook() {
    const m = await import('@/hooks/use-terminal-session')
    return m.useTerminalSession
  }

  it('4001 ⇒ 续期一次,重连那一跳带新凭据;旧实现是直接判死', async () => {
    auth.token = jwt(Math.floor(Date.now() / 1000) + 900)
    api.refreshAccessTokenOnce.mockResolvedValue('fresh-terminal-token')
    const useTerminalSession = await loadHook()
    const onError = vi.fn()
    const { result } = renderHook(() => useTerminalSession())

    act(() => {
      result.current.connectWS('sess-1', { onError })
    })
    expect(wsOf(0)!.url).toContain('token=')
    expect(FakeWebSocket.instances).toHaveLength(1)

    act(() => wsOf(0)!.closeWith(4001))
    await settle()

    expect(api.refreshAccessTokenOnce).toHaveBeenCalledTimes(1)
    expect(FakeWebSocket.instances).toHaveLength(2)
    expect(onError).not.toHaveBeenCalled()
  })

  it('续期失败 ⇒ 不再重连,并给出可见错误(沿用既有 4001 文案,不新造话术)', async () => {
    api.refreshAccessTokenOnce.mockResolvedValue(null)
    const useTerminalSession = await loadHook()
    const onError = vi.fn()
    const { result } = renderHook(() => useTerminalSession())

    act(() => {
      result.current.connectWS('sess-2', { onError })
    })
    act(() => wsOf(0)!.closeWith(4001))
    await settle()

    expect(FakeWebSocket.instances).toHaveLength(1)
    expect(String(onError.mock.calls[0]?.[0])).toContain('登录状态已失效')
  })

  it('重连后仍 4001 ⇒ 续期总数仍为 1(绝不无限重连刷同一枚死凭据)', async () => {
    api.refreshAccessTokenOnce.mockResolvedValue('fresh-terminal-token')
    const useTerminalSession = await loadHook()
    const onError = vi.fn()
    const { result } = renderHook(() => useTerminalSession())

    act(() => {
      result.current.connectWS('sess-3', { onError })
    })
    act(() => wsOf(0)!.closeWith(4001))
    await settle()
    act(() => wsOf(1)!.closeWith(4001))
    await settle()

    expect(api.refreshAccessTokenOnce).toHaveBeenCalledTimes(1)
    expect(FakeWebSocket.instances).toHaveLength(2)
    expect(onError).toHaveBeenCalledTimes(1)
  })

  it('对照臂:1006(网络抖动)⇒ 不续期,交给既有退避重连', async () => {
    api.refreshAccessTokenOnce.mockResolvedValue('x')
    const useTerminalSession = await loadHook()
    const { result } = renderHook(() => useTerminalSession())

    let handle!: ReturnType<typeof result.current.connectWS>
    act(() => {
      handle = result.current.connectWS('sess-4', {})
    })
    act(() => wsOf(0)!.closeWith(1006))
    await settle()

    expect(api.refreshAccessTokenOnce).not.toHaveBeenCalled()
    expect(FakeWebSocket.instances).toHaveLength(1)
    // 退避定时器归这条连接自己管:不收掉,它会在**下一条用例**里冒出来一条连接污染计数
    act(() => handle.close())
  })

  it('重连那一跳现取凭据(不是 connectWS 闭包里那一枚)', async () => {
    api.refreshAccessTokenOnce.mockResolvedValue(null)
    const useTerminalSession = await loadHook()
    const { result } = renderHook(() => useTerminalSession())

    let handle!: ReturnType<typeof result.current.connectWS>
    act(() => {
      handle = result.current.connectWS('sess-5', {})
    })
    const firstUrl = wsOf(0)!.url
    // 故意取一个**不同**的 exp:同秒生成的两枚 JWT 会逐字节相同,"变了"就量不出来了
    const rotated = jwt(Math.floor(Date.now() / 1000) + 1234)
    auth.token = rotated

    // 1001(服务重启)= 瞬态 ⇒ 走退避重连,重连时该拿到 store 里的新值
    act(() => wsOf(0)!.closeWith(1001))
    await settle(1_100)

    const second = wsOf(1)!
    expect(second.url).toContain(`token=${encodeURIComponent(rotated)}`)
    expect(second.url).not.toBe(firstUrl)
    act(() => handle.close())
  })
})

describe('AI 业务 WebSocket:改用短期票 + 握手被拒只重试一次', () => {
  async function loadHook(): Promise<typeof useAiWebSocket> {
    const m = await import('@/hooks/use-ai-ws-business')
    return m.useAiWebSocket
  }

  const PARAM = { type: 'chat', text: 'hi' } as never

  it('换到票 ⇒ URL 里是票而不是 access token(access 不再进访问日志)', async () => {
    api.fetchWsTicket.mockResolvedValue('WS-TICKET')
    const useAiWebSocket = await loadHook()
    const { result } = renderHook(() => useAiWebSocket())

    act(() => {
      result.current.connectWebSocket(PARAM, 0, 'generic')
    })
    await settle()

    expect(api.fetchWsTicket).toHaveBeenCalledTimes(1)
    expect(wsOf(0)!.url).toContain('token=WS-TICKET')
    expect(wsOf(0)!.url).not.toContain(auth.token as string)
  })

  it('换不到票 ⇒ 降级直连 access(降级不是错误,不得因此报错)', async () => {
    api.fetchWsTicket.mockResolvedValue(null)
    const useAiWebSocket = await loadHook()
    const { result } = renderHook(() => useAiWebSocket())

    act(() => {
      result.current.connectWebSocket(PARAM, 0, 'generic')
    })
    await settle()

    expect(wsOf(0)!.url).toContain(`token=${encodeURIComponent(auth.token as string)}`)
    expect(result.current.agentContentList).toHaveLength(0)
  })

  it('从未开成的握手 ⇒ 续期一次并重连一次,重连那一跳再换一张票', async () => {
    api.fetchWsTicket.mockResolvedValue('TICKET-2')
    api.refreshAccessTokenOnce.mockResolvedValue('fresh')
    const useAiWebSocket = await loadHook()
    const { result } = renderHook(() => useAiWebSocket())

    act(() => {
      result.current.connectWebSocket(PARAM, 0, 'generic')
    })
    await settle()
    act(() => {
      wsOf(0)!.readyState = FakeWebSocket.CLOSED
      wsOf(0)!.onclose?.({ code: 1006 })
    })
    await settle()

    expect(api.refreshAccessTokenOnce).toHaveBeenCalledTimes(1)
    expect(FakeWebSocket.instances).toHaveLength(2)
    expect(api.fetchWsTicket).toHaveBeenCalledTimes(2)
    expect(result.current.agentContentList).toHaveLength(0)
  })

  it('续期失败 ⇒ 不再重连,并写入可见错误行(不静默)', async () => {
    api.fetchWsTicket.mockResolvedValue('TICKET-1')
    api.refreshAccessTokenOnce.mockResolvedValue(null)
    const useAiWebSocket = await loadHook()
    const { result } = renderHook(() => useAiWebSocket())

    act(() => {
      result.current.connectWebSocket(PARAM, 0, 'generic')
    })
    await settle()
    act(() => {
      wsOf(0)!.readyState = FakeWebSocket.CLOSED
      wsOf(0)!.onclose?.({ code: 1006 })
    })
    await settle()

    expect(FakeWebSocket.instances).toHaveLength(1)
    expect(result.current.agentContentList.map((c) => c.content)).toContain('connectError')
    expect(result.current.loading).toBe(false)
  })

  it('对照臂:开成之后才断 ⇒ 不做续期(会话没事,不得把人读成"登录过期")', async () => {
    api.fetchWsTicket.mockResolvedValue('TICKET-1')
    const useAiWebSocket = await loadHook()
    const { result } = renderHook(() => useAiWebSocket())

    act(() => {
      result.current.connectWebSocket(PARAM, 0, 'generic')
    })
    await settle()
    act(() => wsOf(0)!.openSelf())
    act(() => {
      wsOf(0)!.readyState = FakeWebSocket.CLOSED
      wsOf(0)!.onclose?.({ code: 1006 })
    })
    await settle()

    expect(api.refreshAccessTokenOnce).not.toHaveBeenCalled()
    expect(FakeWebSocket.instances).toHaveLength(1)
  })
})
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
