// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

// F-86 回归:/v1/realtime WS 端点必须复用共享鉴权粒度(expiresAt/IP/allowedModels/限流)
// + 余额配额预检 + 按上游 response.done usage 记量;api_key 以 header 为主、query 仅兼容告警。
//
// 不连 DB/Redis:db 链式调用与 checkQuota/recordCall 均 mock;
// 判定函数(evaluateRealtimeKey / extractApiKey)是纯函数,直接喂快照/伪 request。
//
// 反向牙口:旧实现 "return row?.status === 'active'" 已被删除 —— 若把 expiresAt/IP/model
// 判据摘掉,describe('evaluateRealtimeKey') 的相应用例必红。
import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import type { FastifyReply, FastifyRequest } from 'fastify'
import { beforeEach, describe, expect, it, vi } from 'vitest'

const { mockJoinedRows, mockCheckQuota, mockRecordCall } = vi.hoisted(() => ({
  mockJoinedRows: vi.fn((): unknown[] => []),
  mockCheckQuota: vi.fn(),
  mockRecordCall: vi.fn(async () => ({
    logId: 'log-1',
    costCents: 0,
    newTokenBalance: 100,
    newCostBalanceCents: 100,
  })),
}))

vi.mock('../src/db/index.js', () => {
  // 只覆盖本文件用到的链:select().from().innerJoin().where().limit()
  const makeChain = () => {
    const step: Record<string, unknown> = {}
    for (const m of ['from', 'innerJoin', 'where']) step[m] = vi.fn(() => step)
    step.limit = vi.fn(() => Promise.resolve(mockJoinedRows()))
    return step
  }
  return {
    db: { select: vi.fn(() => makeChain()) },
    dbRead: { select: vi.fn(() => makeChain()) },
  }
})

vi.mock('../src/services/relay-billing-service.js', () => ({
  checkQuota: mockCheckQuota,
  recordCall: mockRecordCall,
}))

import {
  authenticateRealtimeApiKey,
  evaluateRealtimeKey,
  extractApiKey,
  meterRealtimeResponseUsage,
  realtimeUpgradeRequiresCredential,
  type RealtimeKeySnapshot,
} from '../src/routes/v1-realtime.js'

const SRC = readFileSync(fileURLToPath(new URL('../src/routes/v1-realtime.ts', import.meta.url)), 'utf8')

/** 伪 FastifyRequest:只带鉴权/配额链路用到的字段。 */
function makeRequest(opts: { authorization?: string; apiKeyQuery?: string; ip?: string } = {}) {
  const warn = vi.fn()
  const error = vi.fn()
  const request = {
    headers: opts.authorization ? { authorization: opts.authorization } : {},
    query: opts.apiKeyQuery === undefined ? {} : { api_key: opts.apiKeyQuery },
    ip: opts.ip ?? '203.0.113.10',
    url: '/v1/realtime?model=gpt-4o-realtime',
    log: { warn, error },
  }
  return { request: request as unknown as FastifyRequest, warn, error }
}

function snapshot(overrides: Partial<RealtimeKeySnapshot> = {}): RealtimeKeySnapshot {
  return {
    id: 'key-1',
    userId: 'user-1',
    status: 'active',
    userStatus: 1,
    expiresAt: null,
    allowedIps: null,
    blockedIps: null,
    allowedModels: null,
    ...overrides,
  }
}

/** db 返回的 developer_api_keys 行(只含本文件读取的字段)。 */
function keyRow(overrides: Record<string, unknown> = {}) {
  return {
    id: 'key-1',
    userId: 'user-1',
    status: 'active',
    expiresAt: null,
    allowedIps: null,
    blockedIps: null,
    allowedModels: null,
    perModelRpmLimit: null,
    perModelTpmLimit: null,
    ...overrides,
  }
}

beforeEach(() => {
  mockJoinedRows.mockReturnValue([])
  mockCheckQuota.mockReset()
  mockCheckQuota.mockResolvedValue({
    allowed: true,
    apiKeyId: 'key-1',
    userId: 'user-1',
    tokenBalance: 100,
    costBalanceCents: 100,
  })
  mockRecordCall.mockClear()
})

describe('extractApiKey:header 为主,query 仅兼容', () => {
  it('同时存在时取 Authorization: Bearer,且不告警', () => {
    const { request, warn } = makeRequest({
      authorization: 'Bearer ihui_from_header',
      apiKeyQuery: 'ihui_from_query',
    })
    expect(extractApiKey(request)).toEqual({ key: 'ihui_from_header', source: 'header' })
    expect(warn).not.toHaveBeenCalled()
  })

  it('只有 query api_key 时仍可用(兼容),但必须记 warn', () => {
    const { request, warn } = makeRequest({ apiKeyQuery: 'ihui_legacy' })
    expect(extractApiKey(request)).toEqual({ key: 'ihui_legacy', source: 'query' })
    expect(warn).toHaveBeenCalledTimes(1)
    expect(String(warn.mock.calls[0]?.[1])).toContain('api_key 放在 query 已废弃')
  })

  it('两者都没有 → null', () => {
    expect(extractApiKey(makeRequest().request)).toBeNull()
  })
})

describe('realtimeUpgradeRequiresCredential:升级前只拦完全无凭据的握手', () => {
  function makeReply() {
    const reply = {
      statusCode: 0,
      status: vi.fn((code: number) => {
        reply.statusCode = code
        return reply
      }),
      send: vi.fn(async () => reply),
    }
    return reply
  }

  it('Authorization: Bearer 放行(不再被 query token 门槛误拦)', async () => {
    const reply = makeReply()
    await realtimeUpgradeRequiresCredential()(
      makeRequest({ authorization: 'Bearer ihui_x' }).request,
      reply as unknown as FastifyReply,
    )
    expect(reply.send).not.toHaveBeenCalled()
  })

  it('query api_key 兼容放行', async () => {
    const reply = makeReply()
    await realtimeUpgradeRequiresCredential()(
      makeRequest({ apiKeyQuery: 'ihui_x' }).request,
      reply as unknown as FastifyReply,
    )
    expect(reply.send).not.toHaveBeenCalled()
  })

  it('无凭据 → 401', async () => {
    const reply = makeReply()
    await realtimeUpgradeRequiresCredential()(
      makeRequest().request,
      reply as unknown as FastifyReply,
    )
    expect(reply.status).toHaveBeenCalledWith(401)
    expect(reply.send).toHaveBeenCalled()
  })
})

describe('evaluateRealtimeKey:与主鉴权链路同一套判据', () => {
  it('active + 正常账号 + 无限制 → 通过', () => {
    expect(evaluateRealtimeKey(snapshot(), 'gpt-4o-realtime', '203.0.113.10')).toEqual({
      ok: true,
      apiKeyId: 'key-1',
      userId: 'user-1',
    })
  })

  it('Key 非 active → invalid_key', () => {
    const r = evaluateRealtimeKey(snapshot({ status: 'revoked' }), 'gpt-4o-realtime', '1.1.1.1')
    expect(r.ok).toBe(false)
    if (!r.ok) expect(r.reason).toBe('invalid_key')
  })

  it('账号注销(userStatus=3)→ invalid_key', () => {
    const r = evaluateRealtimeKey(snapshot({ userStatus: 3 }), 'gpt-4o-realtime', '1.1.1.1')
    expect(r.ok).toBe(false)
    if (!r.ok) expect(r.reason).toBe('invalid_key')
  })

  it('Key 过期 → expired(旧实现只查 status 时会被放行)', () => {
    const r = evaluateRealtimeKey(
      snapshot({ expiresAt: new Date(Date.now() - 60_000) }),
      'gpt-4o-realtime',
      '1.1.1.1',
    )
    expect(r.ok).toBe(false)
    if (!r.ok) expect(r.reason).toBe('expired')
  })

  it('IP 不在白名单 → ip_denied', () => {
    const r = evaluateRealtimeKey(
      snapshot({ allowedIps: ['10.0.0.0/8'] }),
      'gpt-4o-realtime',
      '203.0.113.10',
    )
    expect(r.ok).toBe(false)
    if (!r.ok) expect(r.reason).toBe('ip_denied')
  })

  it('IP 命中黑名单优先拒绝', () => {
    const r = evaluateRealtimeKey(
      snapshot({ blockedIps: ['203.0.113.10'], allowedIps: ['203.0.113.0/24'] }),
      'gpt-4o-realtime',
      '203.0.113.10',
    )
    expect(r.ok).toBe(false)
    if (!r.ok) expect(r.reason).toBe('ip_denied')
  })

  it('allowedModels 不含请求模型 → model_denied', () => {
    const r = evaluateRealtimeKey(
      snapshot({ allowedModels: ['gpt-4o-mini-realtime'] }),
      'gpt-4o-realtime',
      '1.1.1.1',
    )
    expect(r.ok).toBe(false)
    if (!r.ok) expect(r.reason).toBe('model_denied')
  })

  it('allowedModels 支持通配(gpt-*)', () => {
    expect(
      evaluateRealtimeKey(snapshot({ allowedModels: ['gpt-*'] }), 'gpt-4o-realtime', '1.1.1.1').ok,
    ).toBe(true)
  })
})

describe('authenticateRealtimeApiKey:鉴权 + 配额预检', () => {
  it('通过时返回 key/user 标识,并按 IP 预检余额', async () => {
    mockJoinedRows.mockReturnValue([{ key: keyRow(), userStatus: 1 }])
    const { request } = makeRequest({ authorization: 'Bearer ihui_ok' })
    const r = await authenticateRealtimeApiKey(request, 'gpt-4o-realtime')
    expect(r).toEqual({ ok: true, apiKeyId: 'key-1', userId: 'user-1' })
    expect(mockCheckQuota).toHaveBeenCalledWith('key-1', 1000, { clientIp: '203.0.113.10' })
  })

  it('无凭据 → missing_key(不查库)', async () => {
    const r = await authenticateRealtimeApiKey(makeRequest().request, 'gpt-4o-realtime')
    expect(r.ok).toBe(false)
    if (!r.ok) expect(r.reason).toBe('missing_key')
    expect(mockCheckQuota).not.toHaveBeenCalled()
  })

  it('Key 不存在 → invalid_key', async () => {
    mockJoinedRows.mockReturnValue([])
    const r = await authenticateRealtimeApiKey(
      makeRequest({ authorization: 'Bearer ihui_missing' }).request,
      'gpt-4o-realtime',
    )
    expect(r.ok).toBe(false)
    if (!r.ok) expect(r.reason).toBe('invalid_key')
  })

  it('余额不足 → quota_exceeded(不建立上游连接)', async () => {
    mockJoinedRows.mockReturnValue([{ key: keyRow(), userStatus: 1 }])
    mockCheckQuota.mockResolvedValue({
      allowed: false,
      reason: 'no_balance_cost',
      apiKeyId: 'key-1',
      userId: 'user-1',
      tokenBalance: 0,
      costBalanceCents: 0,
    })
    const r = await authenticateRealtimeApiKey(
      makeRequest({ authorization: 'Bearer ihui_broke' }).request,
      'gpt-4o-realtime',
    )
    expect(r.ok).toBe(false)
    if (!r.ok) {
      expect(r.reason).toBe('quota_exceeded')
      expect(r.message).toContain('成本余额不足')
    }
  })

  it('配额服务异常 → backend_unavailable(fail-close)', async () => {
    mockJoinedRows.mockReturnValue([{ key: keyRow(), userStatus: 1 }])
    mockCheckQuota.mockRejectedValue(new Error('db down'))
    const r = await authenticateRealtimeApiKey(
      makeRequest({ authorization: 'Bearer ihui_x' }).request,
      'gpt-4o-realtime',
    )
    expect(r.ok).toBe(false)
    if (!r.ok) expect(r.reason).toBe('backend_unavailable')
  })

  it('鉴权查库异常 → backend_unavailable(fail-close)', async () => {
    mockJoinedRows.mockImplementation(() => {
      throw new Error('db down')
    })
    const r = await authenticateRealtimeApiKey(
      makeRequest({ authorization: 'Bearer ihui_x' }).request,
      'gpt-4o-realtime',
    )
    expect(r.ok).toBe(false)
    if (!r.ok) expect(r.reason).toBe('backend_unavailable')
  })
})

describe('meterRealtimeResponseUsage:按上游 usage 记量', () => {
  function ctx() {
    return {
      apiKeyId: 'key-1',
      userId: 'user-1',
      model: 'gpt-4o-realtime',
      clientIp: '203.0.113.10',
      billedResponseIds: new Set<string>(),
    }
  }

  it('response.done 带 usage → recordCall 记真实用量', () => {
    const c = ctx()
    meterRealtimeResponseUsage(
      JSON.stringify({
        type: 'response.done',
        response: {
          id: 'resp_1',
          usage: { input_tokens: 120, output_tokens: 30, total_tokens: 150 },
        },
      }),
      c,
    )
    expect(mockRecordCall).toHaveBeenCalledTimes(1)
    expect(mockRecordCall.mock.calls[0]?.[0]).toMatchObject({
      apiKeyId: 'key-1',
      userId: 'user-1',
      model: 'gpt-4o-realtime',
      promptTokens: 120,
      completionTokens: 30,
      totalTokens: 150,
      status: 'success',
      clientIp: '203.0.113.10',
    })
  })

  it('同一 response 重复帧只记一次', () => {
    const c = ctx()
    const frame = JSON.stringify({
      type: 'response.done',
      response: { id: 'resp_1', usage: { input_tokens: 1, output_tokens: 1, total_tokens: 2 } },
    })
    meterRealtimeResponseUsage(frame, c)
    meterRealtimeResponseUsage(frame, c)
    expect(mockRecordCall).toHaveBeenCalledTimes(1)
  })

  it('无 usage / 非 response.done / 非 JSON → 不记', () => {
    const c = ctx()
    meterRealtimeResponseUsage(JSON.stringify({ type: 'response.done', response: { id: 'r' } }), c)
    meterRealtimeResponseUsage(JSON.stringify({ type: 'response.created' }), c)
    meterRealtimeResponseUsage('not-json', c)
    expect(mockRecordCall).not.toHaveBeenCalled()
  })
})

describe('源码形状:旧实现已移除、共享判据/计费已接线', () => {
  it('不再有"仅查 status"的自建校验', () => {
    expect(SRC).not.toContain("return row?.status === 'active'")
    expect(SRC).not.toContain('validateApiKey')
  })

  it('复用了 api-key-auth / key-rate-window-service / relay-billing-service 的判据', () => {
    expect(SRC).toContain('checkExpiresAt(')
    expect(SRC).toContain('checkKeyIpAcl(')
    expect(SRC).toContain('checkAllowedModels(')
    expect(SRC).toContain('checkPerModelRateLimit(')
    expect(SRC).toContain('checkQuota(')
    expect(SRC).toContain('recordCall(')
    expect(SRC).toMatch(/meterRealtimeResponseUsage\(raw/)
  })

  it('header 优先于 query(extractApiKey 内的判定顺序)', () => {
    const fnStart = SRC.indexOf('export function extractApiKey')
    const headerIdx = SRC.indexOf('request.headers.authorization', fnStart)
    const queryIdx = SRC.indexOf('query?.api_key', fnStart)
    expect(headerIdx).toBeGreaterThan(-1)
    expect(queryIdx).toBeGreaterThan(headerIdx)
  })
})
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
