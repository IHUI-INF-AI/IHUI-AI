// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。

/**
 * F-109 / F-110 / F-111 回归锁(2026-11-08,apps/api 越权 + 资源泄漏组)。
 *
 *  - F-109:客户接入必须比对会话属主(HEAD 已修,本文件锁定「非属主一律拒绝」)。
 *  - F-110:坐席广播前必须校验 session.agentId === agent.id 且 status === 'active'。
 *  - F-111:acquire 后所有早退分支都要 release;异步 IIFE 必须有兜底 catch。
 *
 * 不连真实 DB/Redis:DB 查询面与 ws-helpers 全部桩掉,判定直接打在生产导出的纯函数上,
 * 路由行为用假 socket 驱动,槽位泄漏用计数型 limiter 观测。
 */
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { readFileSync } from 'node:fs'

const h = vi.hoisted(() => ({
  userId: '00000000-0000-4000-8000-0000000000aa',
  agent: null as null | { id: string; nickname: string },
  session: null as null | {
    sessionId: string
    userId: string
    status: string
    agentId: string | null
    queuePosition: number
  },
  throwOnFindSession: false,
  limiter: { acquires: 0, releases: 0, counts: new Map<string, number>() },
}))

vi.mock('../src/plugins/ws-helpers.js', () => ({
  wsAuth: vi.fn(async () => h.userId),
  WS_CLOSE: { TOO_MANY_CONNECTIONS: 4005, RATE_LIMITED: 4002 },
  WsUserConnectionLimiter: class {
    acquire(userId: string): boolean {
      const cur = h.limiter.counts.get(userId) ?? 0
      if (cur >= 8) return false
      h.limiter.counts.set(userId, cur + 1)
      h.limiter.acquires++
      return true
    }
    release(userId: string): void {
      const cur = h.limiter.counts.get(userId)
      if (cur === undefined) return
      h.limiter.releases++
      if (cur <= 1) h.limiter.counts.delete(userId)
      else h.limiter.counts.set(userId, cur - 1)
    }
    reset(): void {}
  },
  WsRateLimiter: class {
    allow(): boolean {
      return true
    }
    reset(): void {}
  },
}))

vi.mock('../src/db/customer-service-queries.js', () => ({
  createSession: vi.fn(async () => h.session),
  findSessionBySessionId: vi.fn(async () => {
    if (h.throwOnFindSession) throw new Error('db down')
    return h.session
  }),
  assignSession: vi.fn(async () => ({ session: null })),
  closeSession: vi.fn(),
  pickAvailableAgent: vi.fn(async () => null),
  findWaitingSessions: vi.fn(async () => []),
  findAgentByUserId: vi.fn(async () => h.agent),
  updateAgentStatus: vi.fn(),
}))

vi.mock('../src/plugins/ws-auto-recovery.js', () => ({
  getWsAutoRecoveryManager: vi.fn(() => ({
    setFastify: vi.fn(),
    registerPlugin: vi.fn(),
  })),
}))

import {
  judgeSessionJoin,
  judgeAgentBroadcast,
  wsCustomerService,
} from '../src/plugins/ws-customer-service.js'

type SocketHandler = (...args: unknown[]) => unknown

function makeFakeServer() {
  const routes = new Map<string, (socket: unknown, request: unknown) => void>()
  const server = {
    decorate: vi.fn(),
    get: vi.fn((path: string, _opts: unknown, handler: (socket: unknown, request: unknown) => void) => {
      routes.set(path, handler)
    }),
    log: { warn: vi.fn(), error: vi.fn(), info: vi.fn() },
  }
  return { server, routes }
}

function makeSocket() {
  const listeners = new Map<string, SocketHandler[]>()
  const socket = {
    send: vi.fn(),
    close: vi.fn(),
    readyState: 1,
    on: vi.fn((event: string, cb: SocketHandler) => {
      const list = listeners.get(event) ?? []
      list.push(cb)
      listeners.set(event, list)
    }),
  }
  async function emit(event: string, ...args: unknown[]): Promise<void> {
    for (const cb of listeners.get(event) ?? []) await cb(...args)
  }
  return { socket, emit }
}

function makeRequest(query: Record<string, string>) {
  return { query, headers: {}, log: { warn: vi.fn(), error: vi.fn(), info: vi.fn() } }
}

async function connect(query: Record<string, string>) {
  const { server, routes } = makeFakeServer()
  await wsCustomerService(server as never, {})
  const handler = routes.get('/ws/customer-service')
  if (!handler) throw new Error('ws 路由未注册')
  const { socket, emit } = makeSocket()
  handler(socket, makeRequest(query))
  return { server, socket, emit }
}

function session(overrides: Partial<NonNullable<typeof h.session>> = {}) {
  return {
    sessionId: 'sess-1',
    userId: '00000000-0000-4000-8000-0000000000bb',
    status: 'waiting',
    agentId: null,
    queuePosition: 1,
    ...overrides,
  }
}

describe('F-109 judgeSessionJoin:客户必须与会话属主一致', () => {
  const me = '00000000-0000-4000-8000-0000000000aa'
  const other = '00000000-0000-4000-8000-0000000000bb'

  it('会话不存在 → 拒绝', () => {
    expect(judgeSessionJoin(undefined, me, false)).toEqual({ ok: false, reason: 'session_missing' })
    expect(judgeSessionJoin(null, me, false)).toEqual({ ok: false, reason: 'session_missing' })
  })

  it('他人会话 → session_not_owner', () => {
    expect(judgeSessionJoin(session({ userId: other }), me, false)).toEqual({
      ok: false,
      reason: 'session_not_owner',
    })
  })

  it('属主本人且非终态 → 允许(waiting/active/open/pending 都不误伤)', () => {
    for (const status of ['waiting', 'active', 'open', 'pending']) {
      expect(judgeSessionJoin(session({ userId: me, status }), me, false)).toEqual({ ok: true })
    }
  })

  it('属主本人但会话已终结(closed/resolved/rejected)→ session_closed', () => {
    for (const status of ['closed', 'resolved', 'rejected']) {
      expect(judgeSessionJoin(session({ userId: me, status }), me, false)).toEqual({
        ok: false,
        reason: 'session_closed',
      })
    }
  })

  it('坐席接入按 agentId 判据:非本人坐席/非 active 均拒绝', () => {
    expect(
      judgeSessionJoin(session({ agentId: 'agent-2', status: 'active' }), me, true, 'agent-1'),
    ).toEqual({ ok: false, reason: 'agent_not_assigned' })
    expect(
      judgeSessionJoin(session({ agentId: 'agent-1', status: 'waiting' }), me, true, 'agent-1'),
    ).toEqual({ ok: false, reason: 'session_not_active' })
    expect(
      judgeSessionJoin(session({ agentId: 'agent-1', status: 'active' }), me, true, 'agent-1'),
    ).toEqual({ ok: true })
  })
})

describe('F-110 judgeAgentBroadcast:坐席只能向本人名下 active 会话广播', () => {
  const agentId = 'agent-1'

  it('会话不存在 → session_missing', () => {
    expect(judgeAgentBroadcast(undefined, agentId)).toEqual({
      ok: false,
      reason: 'session_missing',
    })
  })

  it('非本人名下会话 → agent_not_assigned', () => {
    expect(judgeAgentBroadcast(session({ agentId: 'agent-2', status: 'active' }), agentId)).toEqual({
      ok: false,
      reason: 'agent_not_assigned',
    })
  })

  it('本人名下但会话非 active → session_not_active', () => {
    for (const status of ['waiting', 'closed', 'resolved', 'rejected']) {
      expect(judgeAgentBroadcast(session({ agentId, status }), agentId)).toEqual({
        ok: false,
        reason: 'session_not_active',
      })
    }
  })

  it('本人名下且 active → 允许', () => {
    expect(judgeAgentBroadcast(session({ agentId, status: 'active' }), agentId)).toEqual({
      ok: true,
    })
  })
})

describe('F-111 acquire 后早退必须释放槽位', () => {
  beforeEach(() => {
    h.agent = null
    h.session = null
    h.throwOnFindSession = false
    h.limiter.acquires = 0
    h.limiter.releases = 0
    h.limiter.counts.clear()
  })

  it('非坐席账号连接 → close(4004) 且槽位归零', async () => {
    const { socket } = await connect({ token: 't', as: 'agent' })
    await vi.waitFor(() => expect(socket.close).toHaveBeenCalledWith(4004, '非坐席账号'))
    await vi.waitFor(() => expect(h.limiter.counts.has(h.userId)).toBe(false))
    expect(h.limiter.acquires).toBe(1)
    expect(h.limiter.releases).toBe(1)
  })

  it('sessionId 不存在 → close(4004) 且槽位归零', async () => {
    const { socket } = await connect({ token: 't', sessionId: 'gone' })
    await vi.waitFor(() => expect(socket.close).toHaveBeenCalledWith(4004, '会话不存在'))
    await vi.waitFor(() => expect(h.limiter.counts.has(h.userId)).toBe(false))
    expect(h.limiter.releases).toBe(1)
  })

  it('越权(他人会话)→ close(4004) 且槽位归零', async () => {
    h.session = session({ userId: '00000000-0000-4000-8000-0000000000bb' })
    const { server, socket } = await connect({ token: 't', sessionId: 'sess-1' })
    await vi.waitFor(() => expect(socket.close).toHaveBeenCalledWith(4004, '会话不存在'))
    await vi.waitFor(() => expect(h.limiter.counts.has(h.userId)).toBe(false))
    expect(server.log.warn).toHaveBeenCalledWith(
      expect.objectContaining({ userId: h.userId, sessionId: 'sess-1' }),
      'ws-customer-service 拒绝连接:会话不属于当前用户',
    )
  })

  it('DB 查询抛错 → 兜底 catch 关 socket(1011)并释放槽位', async () => {
    h.throwOnFindSession = true
    const { server, socket } = await connect({ token: 't', sessionId: 'sess-1' })
    await vi.waitFor(() => expect(socket.close).toHaveBeenCalledWith(1011, '内部错误'))
    await vi.waitFor(() => expect(h.limiter.counts.has(h.userId)).toBe(false))
    expect(server.log.error).toHaveBeenCalled()
  })
})

describe('F-110 路由侧:坐席广播前加载会话并校验归属', () => {
  beforeEach(() => {
    h.agent = { id: 'agent-1', nickname: '客服A' }
    h.session = session({ agentId: 'agent-2', status: 'active' })
    h.throwOnFindSession = false
    h.limiter.acquires = 0
    h.limiter.releases = 0
    h.limiter.counts.clear()
  })

  it('向他人会话发 cs_message → 丢弃并记 warn 审计', async () => {
    const { server, socket, emit } = await connect({ token: 't', as: 'agent' })
    await vi.waitFor(() => expect(socket.send).toHaveBeenCalled())
    await emit(
      'message',
      Buffer.from(
        JSON.stringify({ type: 'cs_message', data: { sessionId: 'sess-1', content: '钓鱼' } }),
      ),
    )
    expect(server.log.warn).toHaveBeenCalledWith(
      expect.objectContaining({ sessionId: 'sess-1', reason: 'agent_not_assigned' }),
      'ws-customer-service(坐席)拒绝向非本人/非活跃会话广播',
    )
  })
})

describe('F-109/F-110/F-111 源文件形状锁', () => {
  const src = readFileSync(new URL('../src/plugins/ws-customer-service.ts', import.meta.url), 'utf8')

  it('客户接入调用 judgeSessionJoin,坐席广播前调用 judgeAgentBroadcast', () => {
    expect(src).toContain('judgeSessionJoin(found, userId, false)')
    const guardAt = src.indexOf('judgeAgentBroadcast(target, agent.id)')
    const broadcastAt = src.indexOf('broadcast(targetSession')
    expect(guardAt).toBeGreaterThan(0)
    expect(broadcastAt).toBeGreaterThan(guardAt)
  })

  it('acquire 后的槽位只经 releaseSlot 释放,且有 finally 兜底', () => {
    // 直接调用 limiter.release 只允许出现在 releaseSlot 定义内(避免早退路径漏释放)
    expect(src.match(/userConnectionLimiter\.release\(/g)).toHaveLength(1)
    expect(src).toContain('finally {')
    expect(src).toContain('if (!handedOff) releaseSlot()')
  })

  it('异步 IIFE 带兜底 catch(关 socket 1011 + 释放槽位)', () => {
    expect(src).toContain('})().catch((err: unknown) => {')
    expect(src).toContain("socket.close(1011, '内部错误')")
  })
})
