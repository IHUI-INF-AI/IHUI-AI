// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。

/**
 * 商汤小浣熊(Raccoon Work)提取器 + 适配器行为单测(2026-11-11 立)。
 *
 * 覆盖点:
 * - 提取器:auth.json 缺失 ⇒ exitCode 1 点名;形状合法 ⇒ 载荷三键齐 + `hasRefreshToken:false`;
 *   `parseAuthJson` / `decodeJwtPayload` 两态;多 profile 默认拒绝、`--pick newest` 取最新;
 *   IAM 返回**掩码手机号**时不得当全号用(退化到昵称),全号正则通过才作统一名
 * - buildChatRequest:xhx 主站 + Bearer + OpenAI body 透传;缺 token 抛错
 * - checkHealth:401/403 ⇒ authFailed;5xx/非 JSON ⇒ indeterminate;code≠0 ⇒ 业务错;
 *   200+code:0 ⇒ ok
 * - getQuota:available_points→remaining、daily/reward→packs;字段缺失 ⇒ 未判定不冒绿
 * - listModels:三种容器形状都认;认不出 ⇒ 抛错点名键
 * - isAuthFailure / isAuthError / classifyUpstreamFailure 分级
 * - 能力位:quotaSupported=true(余额端点实证)、refreshTokenSupported=false(无 refresh_token)
 *
 * fetch 全部打桩,**不发真实网络请求**;令牌值全用占位串。
 */
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { mkdtempSync, mkdirSync, writeFileSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { dirname, resolve, join } from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'
import type { AdapterAccountContext, StreamState } from '../src/services/relay-upstream-adapters.js'
import { raccoonAdapter } from '../src/services/upstream-adapters/raccoon-adapter.js'

const HERE = dirname(fileURLToPath(import.meta.url))

const extractMod = (await import(
  pathToFileURL(resolve(HERE, '../../../scripts/lib/raccoon-auth-extract.mjs')).href
)) as {
  extractRaccoonAccounts: (opts?: Record<string, unknown>) => Promise<Record<string, unknown>>
  parseAuthJson: (raw: string) => {
    ok: boolean
    token?: string
    identity?: string
    reason?: string
  }
  decodeJwtPayload: (token: unknown) => Record<string, unknown> | null
  __test__: { AUTH_REL: string }
}
const { extractRaccoonAccounts, parseAuthJson, decodeJwtPayload } = extractMod
/** AUTH_REL 走 __test__ 出口(模块顶层不导出路径常量,§0.6 单一出口) */
const AUTH_REL = extractMod.__test__.AUTH_REL

const mockFetch = vi.fn()
global.fetch = mockFetch as unknown as typeof fetch

/** 造 JWT(三段,payload 可控);签名段不参与解析 */
function makeJwt(claims: Record<string, unknown>): string {
  const b64 = (o: unknown) => Buffer.from(JSON.stringify(o)).toString('base64url')
  return `${b64({ alg: 'HS256', typ: 'JWT' })}.${b64(claims)}.c2ln`
}

const TOKEN = makeJwt({
  sub: 'pu-01a1c8f5-37ee',
  iss: 'xiaohuanxiong.com/iam',
  aud: 'xiaohuanxiong.com',
  exp: 1796000000,
})

function makeTmpHome(): string {
  return mkdtempSync(join(tmpdir(), 'raccoon-test-'))
}

/** 在临时 home 下铺一份 auth.json */
function seedAuth(home: string, content: Record<string, unknown>): void {
  const file = join(home, AUTH_REL)
  mkdirSync(dirname(file), { recursive: true })
  writeFileSync(file, JSON.stringify(content, null, 2))
}

function makeCtx(token = TOKEN): AdapterAccountContext {
  return {
    row: { id: 'row-1', providerCode: 'raccoon', uid: 'pu-01a1c8f5-37ee', name: '小浣熊' },
    credentials: { token, refreshToken: null, cookies: [], secrets: {} },
  } as unknown as AdapterAccountContext
}

function res(status: number, body: unknown): Response {
  return {
    ok: status >= 200 && status < 300,
    status,
    text: async () => (typeof body === 'string' ? body : JSON.stringify(body)),
    json: async () => (typeof body === 'string' ? JSON.parse(body) : body),
  } as unknown as Response
}

beforeEach(() => {
  mockFetch.mockReset()
})

// =============================================================================
// 提取器
// =============================================================================

describe('raccoon 提取器', () => {
  it('auth.json 缺失 ⇒ exitCode 1 且点名落点(不冒绿)', async () => {
    const home = makeTmpHome()
    try {
      const r = await extractRaccoonAccounts({ home, verify: false })
      expect(r['ok']).toBe(false)
      expect(r['exitCode']).toBe(1)
      expect(String(r['reason'])).toMatch(/没有|未找到/)
    } finally {
      rmSync(home, { recursive: true, force: true })
    }
  })

  it('形状合法 ⇒ providerCode/accounts/meta 齐备,且明确无 refresh_token', async () => {
    const home = makeTmpHome()
    try {
      seedAuth(home, { access_token: TOKEN, office_identity: 'personal' })
      const r = await extractRaccoonAccounts({ home, verify: false })
      expect(r['ok']).toBe(true)
      expect(r['providerCode']).toBe('raccoon')
      const accounts = r['accounts'] as Array<Record<string, unknown>>
      expect(accounts).toHaveLength(1)
      expect(accounts[0]!['token']).toBe(TOKEN)
      expect(accounts[0]!['uid']).toBe('pu-01a1c8f5-37ee')
      expect(accounts[0]!['expiresAt']).toBe(new Date(1796000000 * 1000).toISOString())
      // 无用户名取到 ⇒ 退化到 raccoon-<uid 前 14>,不把 office_identity 当名字
      expect(accounts[0]!['name']).toBe('raccoon-pu-01a1c8f5-37')
      expect((r['meta'] as Record<string, unknown>)['hasRefreshToken']).toBe(false)
      // 令牌内容绝不进 meta
      expect(JSON.stringify(r['meta'])).not.toContain(TOKEN)
    } finally {
      rmSync(home, { recursive: true, force: true })
    }
  })

  it('IAM 只给掩码手机号 ⇒ 不用掩码冒充全号,退化到昵称', async () => {
    const home = makeTmpHome()
    try {
      seedAuth(home, { access_token: TOKEN, office_identity: 'personal' })
      mockFetch.mockResolvedValueOnce(
        res(200, { data: { user: { name: '1994489', phone: '199****5160' } } }),
      )
      const r = await extractRaccoonAccounts({ home, verify: true, fetchImpl: mockFetch })
      const accounts = r['accounts'] as Array<Record<string, unknown>>
      expect(accounts[0]!['name']).toBe('1994489')
      expect(accounts[0]!['phone']).toBeUndefined()
      expect((r['meta'] as Record<string, unknown>)['iamVerified']).toBe(true)
    } finally {
      rmSync(home, { recursive: true, force: true })
    }
  })

  it('IAM 给 11 位全号 ⇒ 统一名取全号(与 workbuddy 同一条纪律)', async () => {
    const home = makeTmpHome()
    try {
      seedAuth(home, { access_token: TOKEN, office_identity: 'personal' })
      mockFetch.mockResolvedValueOnce(
        res(200, { data: { user: { name: '昵称', phone: '13800001111' } } }),
      )
      const r = await extractRaccoonAccounts({ home, verify: true, fetchImpl: mockFetch })
      const accounts = r['accounts'] as Array<Record<string, unknown>>
      expect(accounts[0]!['name']).toBe('13800001111')
      expect(accounts[0]!['phone']).toBe('13800001111')
    } finally {
      rmSync(home, { recursive: true, force: true })
    }
  })

  it('parseAuthJson:三态(合法 / 缺 token / 非 JSON)', () => {
    expect(parseAuthJson('{"access_token":"t","office_identity":"personal"}')).toMatchObject({
      ok: true,
      token: 't',
      identity: 'personal',
    })
    expect(parseAuthJson('{"office_identity":"personal"}')).toMatchObject({ ok: false })
    expect(String(parseAuthJson('{"office_identity":"personal"}').reason)).toMatch(/access_token/)
    expect(parseAuthJson('not-json')).toMatchObject({ ok: false })
  })

  it('decodeJwtPayload:三段才解;非法返回 null', () => {
    expect(decodeJwtPayload(TOKEN)).toMatchObject({ sub: 'pu-01a1c8f5-37ee' })
    expect(decodeJwtPayload('a.b')).toBeNull()
    expect(decodeJwtPayload('')).toBeNull()
    expect(decodeJwtPayload(null)).toBeNull()
  })
})

// =============================================================================
// buildChatRequest
// =============================================================================

describe('raccoon buildChatRequest', () => {
  it('Bearer + OpenAI body 透传(可选参数按存在性带上)', () => {
    const ctx = makeCtx()
    const req = raccoonAdapter.buildChatRequest(ctx, {
      model: 'raccoon-doc',
      messages: [{ role: 'user', content: 'hi' }],
      stream: true,
      temperature: 0.3,
      maxTokens: 512,
      topP: 0.9,
      stop: ['END'],
    })
    expect(req.url).toBe('https://xiaohuanxiong.com/api/web/llm/v2/chat/completions')
    expect(req.method).toBe('POST')
    expect(req.headers['authorization']).toBe(`Bearer ${TOKEN}`)
    expect(req.headers['accept']).toBe('text/event-stream')
    const body = JSON.parse(String(req.rawBody))
    expect(body).toMatchObject({
      model: 'raccoon-doc',
      stream: true,
      temperature: 0.3,
      max_tokens: 512,
      top_p: 0.9,
      stop: ['END'],
    })
    expect(body.messages).toHaveLength(1)
    // 未给的可选键不得凭空出现
    expect(body).not.toHaveProperty('seed')
    expect(body).not.toHaveProperty('tools')
  })

  it('缺 token ⇒ 抛错(该账号不可转发)', () => {
    const ctx = makeCtx('')
    expect(() =>
      raccoonAdapter.buildChatRequest(ctx, { model: 'm', messages: [], stream: false }),
    ).toThrow(/缺少 token/)
  })
})

// =============================================================================
// translate
// =============================================================================

describe('raccoon translateStreamChunk', () => {
  const ctx = makeCtx()
  const state: StreamState = {}

  it('data: 前缀帧原样透传;[DONE]/空帧/非 JSON → null', () => {
    const chunk = { id: 'c1', choices: [{ index: 0, delta: { content: 'hi' } }] }
    const out = raccoonAdapter.translateStreamChunk(ctx, `data: ${JSON.stringify(chunk)}`, state)
    expect(out?.openaiChunk).toEqual(chunk)
    expect(raccoonAdapter.translateStreamChunk(ctx, 'data: [DONE]', state)).toBeNull()
    expect(raccoonAdapter.translateStreamChunk(ctx, '   ', state)).toBeNull()
    expect(raccoonAdapter.translateStreamChunk(ctx, 'data: {broken', state)).toBeNull()
  })

  it('业务码错误帧 / error 帧 ⇒ done + upstream_error', () => {
    const biz = raccoonAdapter.translateStreamChunk(
      ctx,
      JSON.stringify({ code: 40101, message: '额度不足' }),
      state,
    )
    expect(biz?.done).toBe(true)
    expect((biz?.openaiChunk as { error: { type: string; code: string } }).error).toMatchObject({
      type: 'upstream_error',
      code: '40101',
    })

    const errFrame = raccoonAdapter.translateStreamChunk(
      ctx,
      JSON.stringify({ error: { code: 'AUTH_ACCESS_TOKEN_MISSING', message: 'no token' } }),
      state,
    )
    expect(errFrame?.done).toBe(true)
    expect((errFrame?.openaiChunk as { error: { code: string } }).error.code).toBe(
      'AUTH_ACCESS_TOKEN_MISSING',
    )
  })

  it('code:0 的正常帧不算错误', () => {
    const out = raccoonAdapter.translateStreamChunk(
      ctx,
      JSON.stringify({ code: 0, choices: [{ index: 0, delta: { content: 'x' } }] }),
      state,
    )
    expect(out?.done).toBeUndefined()
  })
})

describe('raccoon translateNonStream', () => {
  const ctx = makeCtx()

  it('正常对象透传;非对象 ⇒ 未判定错误', () => {
    const ok = { id: 'x', choices: [{ message: { content: 'hi' } }] }
    expect(raccoonAdapter.translateNonStream(ctx, ok)).toEqual(ok)
    const bad = raccoonAdapter.translateNonStream(ctx, 'oops' as unknown)
    expect((bad as { error: { code: string } }).error.code).toBe('bad_response_shape')
  })

  it('业务错误 ⇒ error 对象', () => {
    const out = raccoonAdapter.translateNonStream(ctx, { code: 50000, message: 'boom' })
    expect((out as { error: { code: string } }).error.code).toBe('50000')
  })
})

// =============================================================================
// checkHealth / getQuota / listModels
// =============================================================================

describe('raccoon checkHealth', () => {
  const ctx = makeCtx()

  it('200 + code:0 ⇒ ok', async () => {
    mockFetch.mockResolvedValueOnce(res(200, { code: 0, data: { available_points: 6300 } }))
    await expect(raccoonAdapter.checkHealth?.(ctx)).resolves.toMatchObject({ ok: true })
  })

  it('401 ⇒ authFailed', async () => {
    mockFetch.mockResolvedValueOnce(res(401, { code: 'AUTH_ACCESS_TOKEN_MISSING' }))
    await expect(raccoonAdapter.checkHealth?.(ctx)).resolves.toMatchObject({
      ok: false,
      authFailed: true,
    })
  })

  it('5xx / 形状不符 ⇒ indeterminate(未判定不冒绿)', async () => {
    mockFetch.mockResolvedValueOnce(res(503, 'busy'))
    await expect(raccoonAdapter.checkHealth?.(ctx)).resolves.toMatchObject({
      ok: false,
      indeterminate: true,
    })
    mockFetch.mockResolvedValueOnce(res(200, { data: {} }))
    await expect(raccoonAdapter.checkHealth?.(ctx)).resolves.toMatchObject({
      ok: false,
      indeterminate: true,
    })
  })

  it('业务码非 0 ⇒ 明确失败(不判 indeterminate)', async () => {
    mockFetch.mockResolvedValueOnce(res(200, { code: 40301, message: 'forbidden' }))
    const r = await raccoonAdapter.checkHealth?.(ctx)
    expect(r).toMatchObject({ ok: false })
    expect(r?.indeterminate).toBeUndefined()
    expect(String(r?.error)).toMatch(/40301/)
  })
})

describe('raccoon getQuota', () => {
  const ctx = makeCtx()

  it('available_points → remaining,daily/reward → packs', async () => {
    mockFetch.mockResolvedValueOnce(
      res(200, {
        code: 0,
        data: { available_points: 6300, daily_points: 300, reward_points: 6000 },
      }),
    )
    const q = await raccoonAdapter.getQuota?.(ctx)
    expect(q?.ok).toBe(true)
    expect(q?.quota?.remaining).toBe(6300)
    expect(q?.quota?.packs).toEqual([
      { name: 'daily(每日登录发放)', remaining: 300 },
      { name: 'reward(任务奖励)', remaining: 6000 },
    ])
  })

  it('data 非对象 / available_points 非数字 ⇒ 未判定不猜字段', async () => {
    mockFetch.mockResolvedValueOnce(res(200, { code: 0, data: [] }))
    const a = await raccoonAdapter.getQuota?.(ctx)
    expect(a?.ok).toBe(false)
    expect(String(a?.error)).toMatch(/未判定|非对象/)

    mockFetch.mockResolvedValueOnce(res(200, { code: 0, data: { available_points: '6300' } }))
    const b = await raccoonAdapter.getQuota?.(ctx)
    expect(b?.ok).toBe(false)
    expect(String(b?.error)).toMatch(/available_points/)
  })

  it('401 ⇒ authFailed', async () => {
    mockFetch.mockResolvedValueOnce(res(403, 'denied'))
    await expect(raccoonAdapter.getQuota?.(ctx)).resolves.toMatchObject({
      ok: false,
      authFailed: true,
    })
  })
})

describe('raccoon listModels', () => {
  const ctx = makeCtx()

  it('认 data.data / data.models / 顶层数组三种容器', async () => {
    mockFetch.mockResolvedValueOnce(
      res(200, { data: { data: [{ id: 'm1' }, { model_id: 'm2' }] } }),
    )
    await expect(raccoonAdapter.listModels?.(ctx)).resolves.toEqual(['m1', 'm2'])

    mockFetch.mockResolvedValueOnce(res(200, { data: { models: [{ id: 'm3' }] } }))
    await expect(raccoonAdapter.listModels?.(ctx)).resolves.toEqual(['m3'])
  })

  it('形状认不出 ⇒ 抛错并点名键(不编造清单)', async () => {
    mockFetch.mockResolvedValueOnce(res(200, { data: { unknown: 1 } }))
    await expect(raccoonAdapter.listModels?.(ctx)).rejects.toThrow(/未判定|形状/)
  })
})

// =============================================================================
// 分级与能力位
// =============================================================================

describe('raccoon 认证判定与错误分级', () => {
  it('isAuthFailure 认状态码与正文标记', () => {
    expect(raccoonAdapter.isAuthFailure?.(401, '')).toBe(true)
    expect(raccoonAdapter.isAuthFailure?.(403, '')).toBe(true)
    expect(raccoonAdapter.isAuthFailure?.(200, '{"code":"AUTH_ACCESS_TOKEN_MISSING"}')).toBe(true)
    expect(raccoonAdapter.isAuthFailure?.(200, 'all good')).toBe(false)
  })

  it('classifyUpstreamFailure:额度/限流/404/5xx/鉴权', () => {
    expect(raccoonAdapter.classifyUpstreamFailure?.(402, '')).toMatchObject({ kind: 'credit' })
    expect(raccoonAdapter.classifyUpstreamFailure?.(429, '')).toMatchObject({ kind: 'rate' })
    expect(raccoonAdapter.classifyUpstreamFailure?.(404, '')).toMatchObject({ kind: 'not_found' })
    expect(raccoonAdapter.classifyUpstreamFailure?.(502, '')).toMatchObject({ kind: 'server' })
    expect(raccoonAdapter.classifyUpstreamFailure?.(401, '')).toMatchObject({ kind: 'auth' })
    // 中文额度不足出现在 200 正文里也要归 credit(与 forwarder 的失败分类同一条)
    expect(raccoonAdapter.classifyUpstreamFailure?.(200, '积分不足,请充值')).toMatchObject({
      kind: 'credit',
    })
  })

  it('能力位:余额实证为真、续期明确不可用(无 refresh_token)', () => {
    expect(raccoonAdapter.providerCode).toBe('raccoon')
    expect(raccoonAdapter.quotaSupported).toBe(true)
    expect(raccoonAdapter.refreshTokenSupported).toBe(false)
  })
})
