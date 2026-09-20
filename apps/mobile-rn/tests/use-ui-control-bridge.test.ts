// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * RN 端 agent-control 桥接单测(2026-09-21 立)。
 *
 * 只测桥层职责:信封字段(endpoint/instanceId/executedBy)、category 与 action 双重过滤、
 * requestId 去重、targetInstanceId 让位、连接生命周期、失败面(只 warn 不打扰用户)。
 * 注册表被替身顶掉(它的行为在 ui-action-registry.test.ts 里覆盖),这样任何断言失败
 * 都能一眼归因到"信封/生命周期"而不是"动作执行"。
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { renderHook } from '@testing-library/react'
import type { AgentActionRequest } from '@ihui/types'

type Post = { url: string; body: Record<string, unknown> }

const h = vi.hoisted(() => ({
  posts: [] as Array<{ url: string; body: Record<string, unknown> }>,
  configs: [] as Array<{ baseUrl: string; tokenProvider: () => string | null }>,
  clients: [] as Array<{ connect: unknown; disconnect: unknown }>,
  handlers: null as { onMessage?: (msg: unknown) => void } | null,
  fetchImpl: null as ((url: string, opts: unknown) => Promise<unknown>) | null,
}))

vi.mock('@ihui/api-client', () => ({
  fetchApi: (url: string, opts: { body?: string }) => {
    h.posts.push({
      url,
      body: typeof opts.body === 'string' ? JSON.parse(opts.body) : {},
    })
    return h.fetchImpl ? h.fetchImpl(url, opts) : Promise.resolve({ success: true })
  },
  createNotificationClient: (
    config: { baseUrl: string; tokenProvider: () => string | null },
    handlers: { onMessage?: (msg: unknown) => void },
  ) => {
    h.configs.push(config)
    h.handlers = handlers
    const client = { connect: vi.fn(), disconnect: vi.fn() }
    h.clients.push(client)
    return client
  },
}))

const registry = vi.hoisted(() => ({
  configure: vi.fn(),
  reset: vi.fn(),
  execute: vi.fn(),
}))

vi.mock('../src/lib/ui-action-registry', () => ({
  configureRnUiBridge: registry.configure,
  resetRnUiBridge: registry.reset,
  executeRnUiAction: registry.execute,
}))

vi.mock('../src/lib/config', () => ({
  API_BASE_URL: 'http://localhost:8802',
}))

import {
  buildCapability,
  getRnInstanceId,
  handleWsNotification,
  startUiControlBridge,
  stopUiControlBridge,
  toResponse,
  useUiControlBridge,
} from '../src/hooks/use-ui-control-bridge'

type WsInput = Parameters<typeof handleWsNotification>[0]
type Client = { connect: ReturnType<typeof vi.fn>; disconnect: ReturnType<typeof vi.fn> }

function notificationFor(request: unknown): WsInput {
  return { type: 'notification', data: { type: 'agent.action', request } } as unknown as WsInput
}

/** 等 executeRnUiAction → toResponse → reportResult 的 promise 链跑完 */
async function flush(times = 8): Promise<void> {
  for (let i = 0; i < times; i += 1) await Promise.resolve()
}

function postedResults(): Post[] {
  return h.posts.filter((p) => p.url === '/api/agent-control/result')
}

/**
 * 桥层的去重集合是模块级常驻的(跨渲染、跨用例存活),所以每条指令都要用新 requestId,
 * 否则后跑的用例会撞上前面已记的 id 而被静默丢弃 —— 那正是本端要的行为,不是 bug。
 * 需要"同一条指令重推"的场景请复用同一个对象。
 */
let seq = 0
function agentRequest(overrides: Partial<AgentActionRequest> = {}): AgentActionRequest {
  seq += 1
  return {
    requestId: `req-${seq}`,
    category: 'app_ui',
    action: 'describe',
    params: {},
    ...overrides,
  }
}

function lastClient(): Client {
  return h.clients[h.clients.length - 1] as unknown as Client
}

beforeEach(() => {
  h.posts = []
  h.configs = []
  h.clients = []
  h.handlers = null
  h.fetchImpl = null
  registry.configure.mockClear()
  registry.reset.mockClear()
  registry.execute.mockReset().mockResolvedValue({ ok: true, data: { title: 'Wallet' } })
})

afterEach(() => {
  stopUiControlBridge()
  vi.useRealTimers()
  vi.restoreAllMocks()
})

describe('能力上报信封', () => {
  it('endpoint=rn + appUiActions 四项 + reportedAt 为 ISO', () => {
    const cap = buildCapability()
    expect(cap.endpoint).toBe('rn')
    expect(cap.appUiActions).toEqual(['describe', 'navigate', 'read', 'invoke'])
    expect(cap.uiActions).toBeUndefined()
    expect(cap.instanceId).toBe(getRnInstanceId())
    expect(new Date(cap.reportedAt).toISOString()).toBe(cap.reportedAt)
  })

  it('instanceId 每次冷启生成、前缀 rn-,本端不碰 storage(刻意不持久化)', () => {
    expect(getRnInstanceId()).toMatch(/^rn-[0-9a-z]+-[0-9a-z]+$/)
  })
})

describe('startUiControlBridge 连接生命周期', () => {
  it('无 token:不建连、不上报、不注入登录态', () => {
    startUiControlBridge(null)
    expect(h.posts).toHaveLength(0)
    expect(h.clients).toHaveLength(0)
    expect(registry.configure).not.toHaveBeenCalled()
  })

  it('有 token:立即上报能力 + 建连 + 把登录态注入注册表', () => {
    startUiControlBridge('tok-1')
    expect(h.posts[0]?.url).toBe('/api/agent-control/capability')
    expect(h.posts[0]?.body.endpoint).toBe('rn')
    expect(h.configs[0]?.baseUrl).toBe('http://localhost:8802')
    expect(h.configs[0]?.tokenProvider()).toBe('tok-1')
    expect(lastClient().connect).toHaveBeenCalledTimes(1)
    const injected = registry.configure.mock.calls[0]?.[0] as { isAuthed: () => boolean }
    expect(injected.isAuthed()).toBe(true)
  })

  it('重复 start 不并存两条连接:旧的先断掉', () => {
    startUiControlBridge('tok-1')
    startUiControlBridge('tok-2')
    expect(h.clients).toHaveLength(2)
    expect((h.clients[0] as unknown as Client).disconnect).toHaveBeenCalledTimes(1)
  })

  it('stop 断连 + 清注册表注入', () => {
    startUiControlBridge('tok-1')
    stopUiControlBridge()
    expect(lastClient().disconnect).toHaveBeenCalledTimes(1)
    expect(registry.reset).toHaveBeenCalled()
  })

  it('60s 保活一次(必须显著短于 api 侧 ENDPOINT_TTL_MS=5min),停止后不再上报', () => {
    vi.useFakeTimers()
    startUiControlBridge('tok-1')
    expect(h.posts).toHaveLength(1)
    vi.advanceTimersByTime(60_000)
    expect(h.posts).toHaveLength(2)
    stopUiControlBridge()
    vi.advanceTimersByTime(600_000)
    expect(h.posts).toHaveLength(2)
  })

  it('hook 挂载即启动、卸载即停止', () => {
    const { unmount } = renderHook(() => useUiControlBridge({ token: 'tok-1' }))
    expect(h.clients).toHaveLength(1)
    expect(lastClient().connect).toHaveBeenCalledTimes(1)
    unmount()
    expect(lastClient().disconnect).toHaveBeenCalledTimes(1)
  })
})

describe('WS 消息过滤', () => {
  it('非 notification 帧 / 非 agent.action / 其它 category / 缺 requestId 全部忽略', async () => {
    handleWsNotification({ type: 'other' } as unknown as WsInput)
    handleWsNotification({
      type: 'notification',
      data: { type: 'task.update' },
    } as unknown as WsInput)
    handleWsNotification(notificationFor(agentRequest({ category: 'ui' })))
    handleWsNotification(notificationFor(agentRequest({ requestId: '' })))
    await flush()
    expect(registry.execute).not.toHaveBeenCalled()
    expect(h.posts).toHaveLength(0)
  })

  it('app_ui 指令走注册表执行,并回传 executedBy=rn 的结果', async () => {
    registry.execute.mockResolvedValueOnce({ ok: true, data: { registry: { version: 1 } } })
    const request = agentRequest({ params: { foo: 'bar' } })
    handleWsNotification(notificationFor(request))
    await flush()
    expect(registry.execute).toHaveBeenCalledWith('describe', { foo: 'bar' })
    const result = postedResults()[0]?.body
    expect(result?.requestId).toBe(request.requestId)
    expect(result?.success).toBe(true)
    expect(result?.executedBy).toBe('rn')
    expect(Number(result?.durationMs)).toBeGreaterThanOrEqual(0)
    expect((result?.data as Record<string, unknown>).instanceId).toBe(getRnInstanceId())
  })

  it('requestId 去重:同一指令重推只执行一次(WS 重连后服务端会重推)', async () => {
    const request = agentRequest()
    handleWsNotification(notificationFor(request))
    await flush()
    handleWsNotification(notificationFor(request))
    await flush()
    expect(registry.execute).toHaveBeenCalledTimes(1)
    expect(postedResults()).toHaveLength(1)
  })

  it('被钉定给其它实例时静默让位,避免两台设备各执行一次', async () => {
    handleWsNotification(notificationFor(agentRequest({ targetInstanceId: 'web-abc12345' })))
    await flush()
    expect(registry.execute).not.toHaveBeenCalled()
    expect(h.posts).toHaveLength(0)
  })

  it('钉给自己的实例则照常执行', async () => {
    handleWsNotification(notificationFor(agentRequest({ targetInstanceId: getRnInstanceId() })))
    await flush()
    expect(registry.execute).toHaveBeenCalledTimes(1)
  })

  it('协议外的动作(click/fill/submit)回 UNSUPPORTED_ACTION 且不进注册表', async () => {
    handleWsNotification(
      notificationFor(agentRequest({ action: 'click' as AgentActionRequest['action'] })),
    )
    await flush()
    expect(registry.execute).not.toHaveBeenCalled()
    const result = postedResults()[0]?.body
    expect(result?.success).toBe(false)
    expect(result?.errorCode).toBe('UNSUPPORTED_ACTION')
  })

  it('建连时把 handleWsNotification 挂到 onMessage', () => {
    startUiControlBridge('tok-1')
    expect(typeof h.handlers?.onMessage).toBe('function')
  })
})

describe('toResponse 信封', () => {
  it('成功时不带 error/errorCode,并把 instanceId 并回 data', () => {
    const ok = toResponse(agentRequest(), { ok: true, data: { a: 1 } }, Date.now())
    expect(ok.error).toBeUndefined()
    expect(ok.errorCode).toBeUndefined()
    expect(ok.data).toEqual({ a: 1, instanceId: getRnInstanceId() })
    expect(ok.executedBy).toBe('rn')
  })

  it('失败时原样带上 error 与 errorCode', () => {
    const bad = toResponse(
      agentRequest(),
      { ok: false, error: '页面不在白名单内', errorCode: 'ROUTE_NOT_ALLOWED' },
      Date.now(),
    )
    expect(bad.success).toBe(false)
    expect(bad.errorCode).toBe('ROUTE_NOT_ALLOWED')
    expect(bad.error).toBe('页面不在白名单内')
  })
})

describe('失败面:连接类错误只 warn,绝不打扰用户', () => {
  it('能力上报网络异常只 console.warn,不抛错', async () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => undefined)
    h.fetchImpl = () => Promise.reject(new Error('offline'))
    startUiControlBridge('tok-1')
    await flush()
    expect(warn).toHaveBeenCalled()
    expect(warn.mock.calls.some((c) => String(c[0]).includes('[rn-ui]'))).toBe(true)
  })

  it('接口返回 success=false 也只 warn 一次', async () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => undefined)
    h.fetchImpl = () => Promise.resolve({ success: false, error: '401 未授权' })
    startUiControlBridge('tok-1')
    await flush()
    expect(warn).toHaveBeenCalledTimes(1)
  })

  it('注册表抛异常也一定回一条 EXECUTION_FAILED,不让 api 侧空等 30s 超时', async () => {
    registry.execute.mockRejectedValueOnce(new Error('boom'))
    handleWsNotification(notificationFor(agentRequest()))
    await flush()
    const result = postedResults()[0]?.body
    expect(result?.success).toBe(false)
    expect(result?.errorCode).toBe('EXECUTION_FAILED')
    expect(result?.error).toBe('boom')
  })
})
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
