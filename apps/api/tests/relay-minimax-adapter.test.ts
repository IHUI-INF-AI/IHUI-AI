// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * MiniMax(mcode)提取器 + 适配器行为单测(2026-10-27 立)。
 *
 * 覆盖点:
 * - 提取器两态:tmp 夹具双区域(cn/global)直通提取成功 / 目录缺失与零可导入 ⇒ throw 带码
 * - translateStreamChunk:OpenAI 帧透传 / base_resp 业务错误帧识别为终止失败
 * - translateNonStream:HTTP 200 业务错误体必须抛错(不得当成功)
 * - isAuthFailure:401/403 + base_resp 1004;普通 4xx/5xx 不误判
 * - buildChatRequest:双域名按 region 落点、Bearer 头、body 透传
 * - getQuota:401 ⇒ authFailed;200 信封三态——base_resp.status_code≠0 ⇒ 业务拒绝带码
 *   (2062=无活跃套餐)、model_remains 行字段形状未实证 ⇒ 未判定带样例键、数字行可读 ⇒ 聚合
 * - checkHealth:200 ok / 5xx 未判定 / 401 authFailed
 * - classifyUpstreamFailure:1004→auth、1008→credit、1039→rate(社区口径)
 *
 * fetch 全部打桩,不发真实网络请求;提取器夹具用 os.tmpdir,凭证全是合成假值。
 */
import { mkdtempSync, mkdirSync, writeFileSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { resolve } from 'node:path'
import { pathToFileURL, fileURLToPath } from 'node:url'
import { afterAll, describe, it, expect, vi, beforeEach } from 'vitest'
import type { AdapterAccountContext, StreamState } from '../src/services/relay-upstream-adapters.js'
import { minimaxAdapter } from '../src/services/upstream-adapters/minimax-adapter.js'

const HERE = fileURLToPath(new URL('.', import.meta.url))
// 提取器在 scripts/lib(跨包复用单一真相源),经 fileURL 动态 import(同 binding-soft-delete 先例)
const minimaxExtract = (await import(
  pathToFileURL(resolve(HERE, '../../../scripts/lib/minimax-auth-extract.mjs')).href
)) as {
  extractMinimaxAccounts: (opts?: { roots?: string[] }) => Promise<{
    providerCode: string
    accounts: Array<Record<string, unknown>>
    meta: { count: number; skipped: number; sessions: Array<Record<string, unknown>> }
  }>
  summarizeRecord: (
    rec: Record<string, unknown>,
    region: string,
    key: string,
  ) => Record<string, unknown>
}

const mockFetch = vi.fn()
global.fetch = mockFetch as unknown as typeof fetch

// =============================================================================
// 夹具(合成假值,无真实凭据)
// =============================================================================

const tmpRoots: string[] = []

function makeMinimaxRoot(regionRecords: Record<string, Record<string, unknown>>): string {
  const root = mkdtempSync(resolve(tmpdir(), 'ihui-minimax-test-'))
  tmpRoots.push(root)
  for (const [region, records] of Object.entries(regionRecords)) {
    const authDir = resolve(root, 'auth', 'prod', region, 'mcode-public')
    mkdirSync(authDir, { recursive: true })
    writeFileSync(resolve(authDir, 'auth.json'), JSON.stringify({ schemaVersion: 1, records }))
  }
  return root
}

const CN_RECORD_KEY = 'com.minimax.mcode.oauth.prod.cn testclient'
const GLOBAL_RECORD_KEY = 'com.minimax.mcode.oauth.prod.global cliGlobal'

function makeRecord(overrides: Record<string, unknown> = {}): Record<string, unknown> {
  return {
    schemaVersion: 1,
    accessToken: 'mm-access-token-fixture',
    refreshToken: 'mm-refresh-token-fixture',
    tokenType: 'Bearer',
    clientId: 'cli1234567890',
    scopes: ['mcode'],
    audience: 'mcode-public',
    expiresAtMs: Date.parse('2027-01-01T00:00:00Z'),
    generation: 1,
    loginEpoch: '00000000-0000-0000-0000-000000000000',
    ...overrides,
  }
}

afterAll(() => {
  for (const root of tmpRoots) {
    try {
      rmSync(root, { recursive: true, force: true })
    } catch {
      /* tmp 清理失败不影响判定 */
    }
  }
})

// =============================================================================
// 提取器(两态)
// =============================================================================

describe('minimax extractMinimaxAccounts(两态)', () => {
  it('成功态:cn+global 双区域记录直通提取,region 作为账号字段带上', async () => {
    const root = makeMinimaxRoot({
      cn: { [CN_RECORD_KEY]: makeRecord() },
      global: {
        [GLOBAL_RECORD_KEY]: makeRecord({ accessToken: 'mm-global-token', clientId: 'cli999' }),
      },
    })
    const result = await minimaxExtract.extractMinimaxAccounts({ roots: [root] })
    expect(result.providerCode).toBe('minimax')
    expect(result.accounts).toHaveLength(2)
    const cn = result.accounts.find((a) => a['recordKey'] === CN_RECORD_KEY)
    const global = result.accounts.find((a) => a['recordKey'] === GLOBAL_RECORD_KEY)
    expect(cn?.['region']).toBe('cn')
    expect(global?.['region']).toBe('global')
    // §0.6 raw 直通:记录字段逐字保留
    expect(cn?.['accessToken']).toBe('mm-access-token-fixture')
    expect(cn?.['refreshToken']).toBe('mm-refresh-token-fixture')
    expect(cn?.['expiresAtMs']).toBe(Date.parse('2027-01-01T00:00:00Z'))
    // meta 摘要零回显:只有指纹/长度/布尔
    expect(result.meta.count).toBe(2)
    expect(result.meta.sessions[0]).toMatchObject({
      region: expect.any(String),
      hasRefresh: true,
      tokenFingerprint: expect.stringMatching(/^[0-9a-f]{12}$/),
      tokenLength: expect.any(Number),
    })
  })

  it('目录缺失 ⇒ throw MINIMAX_DIR_MISSING(点名原因)', async () => {
    await expect(
      minimaxExtract.extractMinimaxAccounts({ roots: [resolve(tmpdir(), 'ihui-minimax-nope')] }),
    ).rejects.toMatchObject({ code: 'MINIMAX_DIR_MISSING' })
  })

  it('目录在但记录空 ⇒ throw MINIMAX_NO_SESSION(未判定,不静默空返回)', async () => {
    const root = makeMinimaxRoot({})
    await expect(minimaxExtract.extractMinimaxAccounts({ roots: [root] })).rejects.toMatchObject({
      code: 'MINIMAX_NO_SESSION',
    })
  })

  it('记录缺 refreshToken ⇒ 计入 skipped,0 条双全 ⇒ MINIMAX_NO_SESSION', async () => {
    const root = makeMinimaxRoot({
      [CN_RECORD_KEY]: makeRecord({ refreshToken: '' }),
    })
    await expect(minimaxExtract.extractMinimaxAccounts({ roots: [root] })).rejects.toMatchObject({
      code: 'MINIMAX_NO_SESSION',
    })
  })
})

// =============================================================================
// 适配器
// =============================================================================

function makeCtx(region?: 'cn' | 'global'): AdapterAccountContext {
  return {
    row: { id: 'row-1', providerCode: 'minimax', uid: 'u1', name: 'n', extraMetadata: null },
    credentials: {
      token: 'mm-token',
      refreshToken: null,
      cookies: [],
      secrets: region ? { region } : {},
    },
  } as unknown as AdapterAccountContext
}

function chunkOf(obj: unknown): string {
  return JSON.stringify(obj)
}

describe('minimax translateStreamChunk', () => {
  const ctx = makeCtx()
  const state: StreamState = {}

  it('普通 chunk 原样透传', () => {
    const frame = {
      id: 'chatcmpl-1',
      object: 'chat.completion.chunk',
      choices: [{ index: 0, delta: { content: '你好' }, finish_reason: null }],
    }
    const out = minimaxAdapter.translateStreamChunk(ctx, chunkOf(frame), state)
    expect(out?.openaiChunk).toEqual(frame)
    expect(out?.done).toBeUndefined()
  })

  it('base_resp 业务错误帧(status_code≠0)→ done + error 信息', () => {
    const out = minimaxAdapter.translateStreamChunk(
      ctx,
      chunkOf({ base_resp: { status_code: 1004, status_msg: 'invalid api key' } }),
      state,
    )
    expect(out?.done).toBe(true)
    const err = out?.openaiChunk['error'] as { code: string; message: string }
    expect(err.code).toBe('1004')
    expect(err.message).toBe('invalid api key')
  })

  it('base_resp.status_code=0 不算错误帧(原样透传)', () => {
    const frame = { base_resp: { status_code: 0, status_msg: 'success' }, choices: [] }
    expect(minimaxAdapter.translateStreamChunk(ctx, chunkOf(frame), state)?.openaiChunk).toEqual(
      frame,
    )
  })

  it('data: [DONE] / 空帧 / 非 JSON 心跳 → null(转发层统一补发 DONE)', () => {
    expect(minimaxAdapter.translateStreamChunk(ctx, 'data: [DONE]', state)).toBeNull()
    expect(minimaxAdapter.translateStreamChunk(ctx, '', state)).toBeNull()
    expect(minimaxAdapter.translateStreamChunk(ctx, ': keep-alive', state)).toBeNull()
  })
})

describe('minimax translateNonStream', () => {
  it('正常响应透传', () => {
    const body = { id: 'x', choices: [{ message: { content: 'hi' } }] }
    expect(minimaxAdapter.translateNonStream(makeCtx(), body)).toEqual(body)
  })

  it('HTTP 200 业务错误体 → 抛错(不得当成功)', () => {
    expect(() =>
      minimaxAdapter.translateNonStream(makeCtx(), {
        base_resp: { status_code: 1008, status_msg: 'insufficient balance' },
      }),
    ).toThrow(/1008/)
  })
})

describe('minimax isAuthFailure', () => {
  it('401/403 → true', () => {
    expect(minimaxAdapter.isAuthFailure(401, '')).toBe(true)
    expect(minimaxAdapter.isAuthFailure(403, '')).toBe(true)
  })

  it('HTTP 200 但 base_resp 1004(无效 key)→ true', () => {
    expect(minimaxAdapter.isAuthFailure(200, '{"base_resp":{"status_code":1004}}')).toBe(true)
  })

  it('认证失效文案 → true', () => {
    expect(minimaxAdapter.isAuthFailure(200, '{"error":"Invalid API key"}')).toBe(true)
  })

  it('普通 4xx/5xx / 1008 余额 / 1039 限流 → false(不误触 401 自愈)', () => {
    expect(minimaxAdapter.isAuthFailure(400, 'bad request')).toBe(false)
    expect(minimaxAdapter.isAuthFailure(500, 'gateway error')).toBe(false)
    expect(minimaxAdapter.isAuthFailure(200, '{"base_resp":{"status_code":1008}}')).toBe(false)
    expect(minimaxAdapter.isAuthFailure(200, '{"base_resp":{"status_code":1039}}')).toBe(false)
  })
})

describe('minimax buildChatRequest', () => {
  it('region 缺省落国内域名 api.minimaxi.com,body OpenAI 形状透传', () => {
    const http = minimaxAdapter.buildChatRequest(makeCtx(), {
      model: 'MiniMax-M2.7',
      messages: [{ role: 'user', content: 'hi' }],
      temperature: 0.7,
      maxTokens: 100,
      stream: true,
    })
    expect(http.url).toBe('https://api.minimaxi.com/v1/chat/completions')
    expect(http.method).toBe('POST')
    const body = JSON.parse(http.rawBody ?? '') as Record<string, unknown>
    expect(body).toMatchObject({
      model: 'MiniMax-M2.7',
      stream: true,
      temperature: 0.7,
      max_tokens: 100,
    })
    expect(http.headers['authorization']).toBe('Bearer mm-token')
    expect(http.headers['accept']).toBe('text/event-stream')
  })

  it('secrets.region=global 落国际域名 api.minimax.io(双域名常量都在)', () => {
    const http = minimaxAdapter.buildChatRequest(makeCtx('global'), {
      model: 'MiniMax-M3',
      messages: [],
      stream: false,
    })
    expect(http.url).toBe('https://api.minimax.io/v1/chat/completions')
    expect(http.headers['accept']).toBe('application/json')
  })

  it('extraMetadata.region=global 同样落国际域名(secrets 缺失时的第二来源)', () => {
    const ctx = {
      row: { extraMetadata: { region: 'global' } },
      credentials: { token: 'mm-token', secrets: {} },
    } as unknown as AdapterAccountContext
    expect(
      minimaxAdapter.buildChatRequest(ctx, { model: 'm', messages: [], stream: true }).url,
    ).toBe('https://api.minimax.io/v1/chat/completions')
  })

  it('缺 token ⇒ 抛错(该账号不可转发)', () => {
    const ctx = {
      row: { extraMetadata: null },
      credentials: { token: '', secrets: {} },
    } as unknown as AdapterAccountContext
    expect(() =>
      minimaxAdapter.buildChatRequest(ctx, { model: 'm', messages: [], stream: true }),
    ).toThrow(/缺少 accessToken/)
  })
})

describe('minimax getQuota(2026-10-27 实弹实证:coding_plan/remains 信封)', () => {
  beforeEach(() => {
    mockFetch.mockReset()
  })

  it('401 → ok:false + authFailed(承载层据此触发自愈)', async () => {
    mockFetch.mockResolvedValue({
      status: 401,
      ok: false,
      text: async () => JSON.stringify({ base_resp: { status_code: 1004, status_msg: 'invalid' } }),
    })
    const q = await minimaxAdapter.getQuota!(makeCtx())
    expect(q.ok).toBe(false)
    expect(q.authFailed).toBe(true)
    expect(q.error).toMatch(/HTTP 401/)
  })

  it('200 + base_resp.status_code=2062(无活跃套餐)→ ok:false 带业务码(免费号如实无余量)', async () => {
    mockFetch.mockResolvedValue({
      status: 200,
      ok: true,
      text: async () =>
        JSON.stringify({
          model_remains: null,
          base_resp: { status_code: 2062, status_msg: 'no active token plan subscription' },
        }),
    })
    const q = await minimaxAdapter.getQuota!(makeCtx())
    expect(q.ok).toBe(false)
    expect(q.quota).toBeUndefined()
    expect(q.error).toMatch(/status_code=2062/)
    expect(q.error).toMatch(/no active token plan subscription/)
  })

  it('200 + model_remains 数组但行字段形状未实证 → 未判定并带样例键清单', async () => {
    mockFetch.mockResolvedValue({
      status: 200,
      ok: true,
      text: async () => JSON.stringify({ model_remains: [{ model: 'M2.7', foo: 1 }], base_resp: { status_code: 0 } }),
    })
    const q = await minimaxAdapter.getQuota!(makeCtx())
    expect(q.ok).toBe(false)
    expect(q.error).toMatch(/行字段形状未实证/)
    expect(q.error).toMatch(/model\|foo/)
  })

  it('200 + model_remains 行含数字 remain/used → ok:true 聚合', async () => {
    mockFetch.mockResolvedValue({
      status: 200,
      ok: true,
      text: async () =>
        JSON.stringify({
          model_remains: [
            { model: 'M2.7', remain: 30, used: 70 },
            { model: 'M2.5', remain: 20, used: 10 },
          ],
          base_resp: { status_code: 0 },
        }),
    })
    const q = await minimaxAdapter.getQuota!(makeCtx())
    expect(q.ok).toBe(true)
    expect(q.quota?.remaining).toBe(50)
    expect(q.quota?.used).toBe(80)
  })

  it('200 非 JSON → ok:false 未判定带响应前缀', async () => {
    mockFetch.mockResolvedValue({ status: 200, ok: true, text: async () => 'not-json' })
    const q = await minimaxAdapter.getQuota!(makeCtx())
    expect(q.ok).toBe(false)
    expect(q.error).toMatch(/响应非 JSON/)
  })

  it('请求面:GET coding_plan/remains + Bearer;region 落对应域名', async () => {
    mockFetch.mockResolvedValue({ status: 200, ok: true, text: async () => '{}' })
    await minimaxAdapter.getQuota!(makeCtx())
    const [urlCn, initCn] = mockFetch.mock.calls[0] as [string, RequestInit]
    expect(urlCn).toBe('https://api.minimaxi.com/v1/api/openplatform/coding_plan/remains')
    expect(initCn.method).toBe('GET')
    expect((initCn.headers as Record<string, string>)['authorization']).toBe('Bearer mm-token')

    await minimaxAdapter.getQuota!(makeCtx('global'))
    const [urlGlobal] = mockFetch.mock.calls[1] as [string, RequestInit]
    expect(urlGlobal).toBe('https://api.minimax.io/v1/api/openplatform/coding_plan/remains')
  })

  it('网络异常 → ok:false(未判定),error 带原因', async () => {
    mockFetch.mockRejectedValue(new Error('socket hang up'))
    const q = await minimaxAdapter.getQuota!(makeCtx())
    expect(q.ok).toBe(false)
    expect(q.error).toMatch(/socket hang up/)
  })
})

describe('minimax checkHealth(三态)', () => {
  beforeEach(() => {
    mockFetch.mockReset()
  })

  it('200 → ok:true', async () => {
    mockFetch.mockResolvedValue({ status: 200, ok: true, text: async () => '{}' })
    const h = await minimaxAdapter.checkHealth(makeCtx())
    expect(h.ok).toBe(true)
  })

  it('401 → ok:false + authFailed(明确拒收)', async () => {
    mockFetch.mockResolvedValue({ status: 401, ok: false, text: async () => 'unauthorized' })
    const h = await minimaxAdapter.checkHealth(makeCtx())
    expect(h.ok).toBe(false)
    expect(h.authFailed).toBe(true)
    expect(h.indeterminate).toBe(false)
  })

  it('5xx → ok:false + indeterminate(未判定,不得写 down)', async () => {
    mockFetch.mockResolvedValue({ status: 502, ok: false, text: async () => 'bad gateway' })
    const h = await minimaxAdapter.checkHealth(makeCtx())
    expect(h.ok).toBe(false)
    expect(h.indeterminate).toBe(true)
    expect(h.authFailed).toBe(false)
  })

  it('网络异常 → indeterminate', async () => {
    mockFetch.mockRejectedValue(new Error('ECONNRESET'))
    const h = await minimaxAdapter.checkHealth(makeCtx())
    expect(h.ok).toBe(false)
    expect(h.indeterminate).toBe(true)
  })
})

describe('minimax classifyUpstreamFailure(社区口径码值)', () => {
  const classify = minimaxAdapter.classifyUpstreamFailure!

  it('1004 → auth(401 自愈)', () => {
    expect(classify(200, '{"base_resp":{"status_code":1004}}').kind).toBe('auth')
  })

  it('1008 余额不足 → credit', () => {
    expect(classify(200, '{"base_resp":{"status_code":1008}}').kind).toBe('credit')
  })

  it('1039 限流 → rate(退避不罚号)', () => {
    expect(classify(200, '{"base_resp":{"status_code":1039}}').kind).toBe('rate')
  })

  it('额度文案 / 402 → credit;401/403 → auth', () => {
    expect(classify(400, '{"status_msg":"余额不足"}').kind).toBe('credit')
    expect(classify(402, 'payment required').kind).toBe('credit')
    expect(classify(401, 'x').kind).toBe('auth')
    expect(classify(403, 'x').kind).toBe('auth')
  })

  it('HTTP 状态兜底:404→not_found、429→rate、5xx→server、其他→client', () => {
    expect(classify(404, 'no such thing').kind).toBe('not_found')
    expect(classify(429, 'too many').kind).toBe('rate')
    expect(classify(502, 'bad gateway').kind).toBe('server')
    expect(classify(400, 'bad request').kind).toBe('client')
  })
})

describe('minimax summarizeRecord(零回显)', () => {
  it('摘要只有指纹/长度/布尔,不带凭据明文', () => {
    const s = minimaxExtract.summarizeRecord(makeRecord(), 'cn', CN_RECORD_KEY)
    const json = JSON.stringify(s)
    expect(json).not.toContain('mm-access-token-fixture')
    expect(json).not.toContain('mm-refresh-token-fixture')
    expect(s).toMatchObject({ region: 'cn', hasRefresh: true })
  })
})
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
