// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * 小程序端 AI 控制桥接层单测(2026-09-21 立)。
 *
 * 覆盖:能力上报与 60s 保活、切后台停 timer + 断连、WS 消息过滤与去重、
 * 结果回传结构(executedBy/instanceId),以及"不依赖 WHATWG URL"的 ws url 拼接。
 *
 * 每个用例前 `vi.resetModules()` 重新 import 桥模块 —— 桥的生命周期状态
 * (foreground / wsClient)是模块级的,必须逐例复位。
 */
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import type { WSNotification } from '@ihui/types'

interface FakeWsClient {
  connect: ReturnType<typeof vi.fn>
  disconnect: ReturnType<typeof vi.fn>
}

const mocks = vi.hoisted(() => ({
  token: 'test-token',
  onAppShowCb: null as ((res?: unknown) => void) | null,
  onAppHideCb: null as ((res?: unknown) => void) | null,
  showRegistered: 0,
  hideRegistered: 0,
  fetchCalls: [] as { url: string; body: Record<string, unknown> }[],
  clients: [] as { client: FakeWsClient; overrides: Record<string, unknown> }[],
  trigger: vi.fn(),
  connectSocketCalls: [] as string[],
  stack: [] as unknown[],
  navigateTo: vi.fn(() => Promise.resolve({})),
  switchTab: vi.fn(() => Promise.resolve({})),
  reLaunch: vi.fn(() => Promise.resolve({})),
}))

vi.mock('@tarojs/taro', () => {
  const Taro = {
    onAppShow: (cb: (res?: unknown) => void) => {
      mocks.onAppShowCb = cb
      mocks.showRegistered += 1
    },
    onAppHide: (cb: (res?: unknown) => void) => {
      mocks.onAppHideCb = cb
      mocks.hideRegistered += 1
    },
    eventCenter: { trigger: mocks.trigger },
    navigateTo: mocks.navigateTo,
    switchTab: mocks.switchTab,
    reLaunch: mocks.reLaunch,
    getCurrentPages: () => mocks.stack,
    getCurrentInstance: () => ({ router: undefined }),
  }
  return { default: Taro, ...Taro }
})

vi.mock('@/lib/theme', () => ({
  setThemePreference: vi.fn(() => 'dark'),
}))

vi.mock('@/utils/auth', () => ({
  getToken: () => mocks.token,
}))

// 本端 Taro WebSocket 适配器:记录被请求的 url,不真的连
vi.mock('@/utils/taro-websocket-adapter', () => ({
  taroWebSocketFactory: (url: string) => {
    mocks.connectSocketCalls.push(url)
    return {
      readyState: 0,
      onopen: null,
      onmessage: null,
      onclose: null,
      onerror: null,
      send: vi.fn(),
      close: vi.fn(),
    }
  },
}))

// 只替换 createNotificationClient / fetchApi 两个出口,保留真实的 buildNotificationWsUrl
// (用于对照证明"微信无 URL 构造器"这个坑被绕开)
vi.mock('@ihui/api-client', async (importOriginal) => {
  const actual = (await importOriginal()) as Record<string, unknown>
  return {
    ...actual,
    fetchApi: (url: string, options?: { body?: string }) => {
      const body = options?.body ? (JSON.parse(options.body) as Record<string, unknown>) : {}
      mocks.fetchCalls.push({ url, body })
      return Promise.resolve({ success: true, data: { registered: true, accepted: true } })
    },
    createNotificationClient: (
      _config: unknown,
      handlers?: { onMessage?: (msg: WSNotification) => void },
      overrides: Record<string, unknown> = {},
    ): FakeWsClient => {
      const client: FakeWsClient = { connect: vi.fn(), disconnect: vi.fn() }
      mocks.clients.push({
        client,
        overrides: { ...overrides, __onMessage: handlers?.onMessage },
      })
      return client
    },
  }
})

/**
 * 被测模块的公开面。显式声明而非 `typeof import(...)`,因为 eslint
 * (consistent-type-imports)禁内联 import 类型注解;下方赋值仍做可指派性检查,
 * 真实签名漂移会在此报 typecheck 错。
 */
interface UiControlBridgeModule {
  startUiControlBridge: () => void
  stopUiControlBridge: () => void
  getTaroInstanceId: () => string
  buildTaroNotificationWsUrl: (baseUrl: string, token: string) => string
}

let bridge: UiControlBridgeModule

/** 让 await 链跑完(fake timers 下 setTimeout 不会自己触发,故用 advance 而非 sleep) */
async function flush(): Promise<void> {
  await vi.advanceTimersByTimeAsync(1)
  await vi.advanceTimersByTimeAsync(1)
}

function capabilityCalls(): Record<string, unknown>[] {
  return mocks.fetchCalls
    .filter((c) => c.url.endsWith('/api/agent-control/capability'))
    .map((c) => c.body)
}

function resultCalls(): Record<string, unknown>[] {
  return mocks.fetchCalls
    .filter((c) => c.url.endsWith('/api/agent-control/result'))
    .map((c) => c.body)
}

function lastClient(): { client: FakeWsClient; overrides: Record<string, unknown> } {
  const client = mocks.clients[mocks.clients.length - 1]
  if (!client) throw new Error('桥层未创建通知 WS 客户端')
  return client
}

/** 模拟服务端推下来的 agent.action 通知(api 侧按 userId 广播,结构见 routes/agent-control.ts) */
function pushAction(request: Record<string, unknown>): void {
  const onMessage = lastClient().overrides.__onMessage as
    ((msg: WSNotification) => void) | undefined
  onMessage?.({ type: 'notification', data: { type: 'agent.action', request } } as WSNotification)
}

beforeEach(async () => {
  vi.useFakeTimers()
  vi.clearAllMocks()
  vi.resetModules()
  mocks.token = 'test-token'
  mocks.onAppShowCb = null
  mocks.onAppHideCb = null
  mocks.showRegistered = 0
  mocks.hideRegistered = 0
  mocks.fetchCalls.length = 0
  mocks.clients.length = 0
  mocks.connectSocketCalls.length = 0
  mocks.stack.length = 0
  mocks.stack.push({ route: 'pages/login/login', options: {} })
  bridge = await import('../../hooks/use-ui-control-bridge')
})

afterEach(() => {
  vi.useRealTimers()
  vi.unstubAllGlobals()
})

describe('能力上报与保活', () => {
  it('start 立即上报一次 miniapp 能力(四项动作 + endpoint/instanceId/reportedAt)', async () => {
    bridge.startUiControlBridge()
    await flush()
    const calls = capabilityCalls()
    expect(calls).toHaveLength(1)
    expect(calls[0]).toMatchObject({
      endpoint: 'miniapp',
      taroUiActions: ['describe', 'navigate', 'read', 'invoke'],
      version: '1.0.0',
    })
    expect(typeof calls[0]?.instanceId).toBe('string')
    expect(String(calls[0]?.instanceId)).toMatch(/^taro-/)
    expect(new Date(String(calls[0]?.reportedAt)).toISOString()).toBe(String(calls[0]?.reportedAt))
  })

  it('60s 保活:初始 1 次 + 5s/20s 冷启补报 + 60s 定时 = 4 次', async () => {
    bridge.startUiControlBridge()
    await flush()
    expect(capabilityCalls()).toHaveLength(1)
    await vi.advanceTimersByTimeAsync(60_000)
    expect(capabilityCalls()).toHaveLength(4)
    expect(String(capabilityCalls()[3]?.instanceId)).toBe(String(capabilityCalls()[0]?.instanceId))
  })

  it('未登录时既不上报也不建连(避免匿名端点污染 api 注册表)', async () => {
    mocks.token = ''
    bridge.startUiControlBridge()
    await flush()
    expect(capabilityCalls()).toHaveLength(0)
    expect(mocks.clients).toHaveLength(0)
  })

  it('createNotificationClient 收到 urlBuilder 与 taroWebSocketFactory 覆写', async () => {
    bridge.startUiControlBridge()
    await flush()
    const overrides = lastClient().overrides
    expect(typeof overrides.urlBuilder).toBe('function')
    expect(typeof overrides.webSocketFactory).toBe('function')
    expect(mocks.clients).toHaveLength(1)
    expect(lastClient().client.connect).toHaveBeenCalledTimes(1)
    // 两个覆写串起来:工厂拿到的 url 必须已是本端拼好的 ws 地址(默认实现会走 new URL)
    const urlBuilder = overrides.urlBuilder as (token: string) => string
    const webSocketFactory = overrides.webSocketFactory as (url: string) => unknown
    webSocketFactory(urlBuilder('tkn'))
    expect(mocks.connectSocketCalls).toEqual(['ws://localhost:8802/ws/notifications?token=tkn'])
  })
})

describe('WS URL 拼接(绕开 new URL 坑)', () => {
  it('https 基址 → wss,并剥离 /api 路径前缀', () => {
    expect(bridge.buildTaroNotificationWsUrl('https://api.x.top/api', 'tkn')).toBe(
      'wss://api.x.top/ws/notifications?token=tkn',
    )
  })

  it('http 本地基址 → ws 且保留端口', () => {
    expect(bridge.buildTaroNotificationWsUrl('http://localhost:8802/api', 'tkn')).toBe(
      'ws://localhost:8802/ws/notifications?token=tkn',
    )
  })

  it('带端口 / 多级路径 / 尾斜杠都能推导出同一 host(与 new URL().host 等价)', () => {
    const expected = 'wss://api.x.top:8443/ws/notifications?token=t%2F1'
    expect(bridge.buildTaroNotificationWsUrl('https://api.x.top:8443/api', 't/1')).toBe(expected)
    expect(bridge.buildTaroNotificationWsUrl('https://api.x.top:8443/api/v2/', 't/1')).toBe(
      expected,
    )
    expect(bridge.buildTaroNotificationWsUrl('https://api.x.top:8443', 't/1')).toBe(expected)
  })

  it('运行时没有 URL 构造器时本函数照常工作,而 api-client 默认实现抛错(坑已绕开)', async () => {
    const apiClient = await import('@ihui/api-client')
    vi.stubGlobal('URL', undefined)
    expect(bridge.buildTaroNotificationWsUrl('https://api.x.top/api', 'tkn')).toBe(
      'wss://api.x.top/ws/notifications?token=tkn',
    )
    expect(() => apiClient.buildNotificationWsUrl('https://api.x.top/api', 'tkn')).toThrow()
  })

  it('相对基址(H5 dev 的 /api)推导不出 host → 返回空串,桥层跳过建连', () => {
    expect(bridge.buildTaroNotificationWsUrl('/api', 'tkn')).toBe('')
  })

  it('token 经 URL 编码,不破坏 query', () => {
    const url = bridge.buildTaroNotificationWsUrl('https://api.x.top/api', 'a&b=c')
    expect(url.endsWith('?token=a%26b%3Dc')).toBe(true)
  })
})

describe('WS 消息消费与结果回传', () => {
  it('miniapp_ui describe → 回传 executedBy:miniapp 且 data 带 instanceId', async () => {
    bridge.startUiControlBridge()
    await flush()
    pushAction({ requestId: 'r1', category: 'miniapp_ui', action: 'describe', params: {} })
    await flush()
    const results = resultCalls()
    expect(results).toHaveLength(1)
    expect(results[0]).toMatchObject({
      requestId: 'r1',
      success: true,
      executedBy: 'miniapp',
      durationMs: expect.any(Number),
    })
    const data = results[0]?.data as Record<string, unknown>
    expect(data.instanceId).toBe(bridge.getTaroInstanceId())
    expect((data.registry as { version: number }).version).toBe(1)
  })

  it('miniapp_ui navigate 端到端:命中 tabBar 页 → switchTab 被调用', async () => {
    bridge.startUiControlBridge()
    await flush()
    pushAction({
      requestId: 'r2',
      category: 'miniapp_ui',
      action: 'navigate',
      params: { name: '/pages/user/index' },
    })
    await flush()
    expect(mocks.switchTab).toHaveBeenCalledWith({ url: '/pages/user/index' })
    expect(resultCalls()[0]?.success).toBe(true)
  })

  it('非 miniapp_ui(web 的 category:ui)一律忽略,只保留 eventCenter 广播', async () => {
    bridge.startUiControlBridge()
    await flush()
    pushAction({ requestId: 'r3', category: 'ui', action: 'describe', params: {} })
    pushAction({ requestId: 'r4', category: 'app_ui', action: 'navigate', params: {} })
    await flush()
    expect(resultCalls()).toHaveLength(0)
    expect(capabilityCalls()).toHaveLength(1)
    expect(mocks.trigger).toHaveBeenCalledWith(
      'wsNotification',
      expect.objectContaining({ type: 'notification' }),
    )
  })

  it('同一 requestId 重推只执行一次(WS 重连后服务端会重发)', async () => {
    bridge.startUiControlBridge()
    await flush()
    const request = { requestId: 'dup-1', category: 'miniapp_ui', action: 'read', params: {} }
    pushAction(request)
    pushAction(request)
    await flush()
    expect(resultCalls()).toHaveLength(1)
  })

  it('targetInstanceId 指向别的实例时静默让位(api 按 userId 广播,防双设备重复执行)', async () => {
    bridge.startUiControlBridge()
    await flush()
    pushAction({
      requestId: 'r5',
      category: 'miniapp_ui',
      action: 'read',
      params: {},
      targetInstanceId: 'taro-some-other-device',
    })
    await flush()
    expect(resultCalls()).toHaveLength(0)
  })

  it('协议外动作回 UNSUPPORTED_ACTION,不让调用方干等 30s 超时', async () => {
    bridge.startUiControlBridge()
    await flush()
    pushAction({ requestId: 'r6', category: 'miniapp_ui', action: 'click', params: {} })
    await flush()
    const results = resultCalls()
    expect(results).toHaveLength(1)
    expect(results[0]).toMatchObject({ success: false, errorCode: 'UNSUPPORTED_ACTION' })
    expect((results[0]?.data as Record<string, unknown>).instanceId).toBe(
      bridge.getTaroInstanceId(),
    )
  })

  it('非 agent.action 通知(普通消息通知)不触发执行', async () => {
    bridge.startUiControlBridge()
    await flush()
    const onMessage = lastClient().overrides.__onMessage as (msg: WSNotification) => void
    onMessage({ type: 'notification', data: { type: 'chat_message', id: 'x' } })
    await flush()
    expect(resultCalls()).toHaveLength(0)
  })
})

describe('前后台生命周期(小程序切后台 5s 挂起)', () => {
  it('onAppHide 停保活 timer 且主动断连(不在后台制造失败请求)', async () => {
    bridge.startUiControlBridge()
    await flush()
    expect(mocks.onAppHideCb).toBeTypeOf('function')
    const before = capabilityCalls().length
    mocks.onAppHideCb?.({})
    expect(lastClient().client.disconnect).toHaveBeenCalledTimes(1)
    await vi.advanceTimersByTimeAsync(180_000)
    expect(capabilityCalls()).toHaveLength(before)
  })

  it('onAppShow 重新起 timer 并重建连接(全端始终只有一条常驻连接)', async () => {
    bridge.startUiControlBridge()
    await flush()
    mocks.onAppHideCb?.({})
    expect(mocks.clients).toHaveLength(1)
    mocks.onAppShowCb?.({})
    await flush()
    expect(mocks.clients).toHaveLength(2)
    expect(mocks.clients[1]?.client.connect).toHaveBeenCalledTimes(1)
    const before = capabilityCalls().length
    await vi.advanceTimersByTimeAsync(60_000)
    expect(capabilityCalls().length).toBeGreaterThan(before)
  })

  it('stopUiControlBridge 幂等:重复调用不会重复断连', async () => {
    bridge.startUiControlBridge()
    await flush()
    bridge.stopUiControlBridge()
    bridge.stopUiControlBridge()
    expect(lastClient().client.disconnect).toHaveBeenCalledTimes(1)
  })

  it('生命周期监听只注册一次(onAppShow 不随 start 重复累积)', async () => {
    bridge.startUiControlBridge()
    bridge.startUiControlBridge()
    await flush()
    expect(mocks.showRegistered).toBe(1)
    expect(mocks.hideRegistered).toBe(1)
    // 两次 start 也只有一条连接(全端只此一条常驻 WS)
    expect(mocks.clients).toHaveLength(1)
  })
})
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
