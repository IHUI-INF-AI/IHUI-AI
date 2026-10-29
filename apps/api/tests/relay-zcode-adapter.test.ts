// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * ZCode(智谱 GLM Coding Plan)提取器 + 适配器行为单测(2026-10-27 立)。
 *
 * 覆盖点:
 * - 提取器两态:tmp 夹具(credentials.json 扁平图)直通提取成功 / 目录缺失与零可用 ⇒ throw 带码
 * - project-key-location 键名解析:bigmodel.cn→cn、z.ai→global、解不动→未判定
 * - translateStreamChunk:OpenAI 帧透传 / {"error":{"code"}} 业务错误帧识别为终止失败
 * - isAuthFailure:401/403 + error.code 1000/1001(公开文档口径);普通 4xx/5xx 不误判
 * - buildChatRequest:双域名按 region 落点(coding plan 专属面)、Bearer 头、body 透传
 * - getQuota:401 ⇒ ok:false + authFailed;200 ⇒ 未判定带键名清单(不猜字段)
 * - checkHealth:200 ok / 5xx 未判定 / 401 authFailed
 * - classifyUpstreamFailure:1000→auth、402/余额文案→credit、429→rate
 *
 * fetch 全部打桩,不发真实网络请求;提取器夹具用 os.tmpdir,凭证全是合成假值。
 */
import { mkdtempSync, mkdirSync, writeFileSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { resolve } from 'node:path'
import { pathToFileURL, fileURLToPath } from 'node:url'
import { afterAll, describe, it, expect, vi, beforeEach } from 'vitest'
import type { AdapterAccountContext, StreamState } from '../src/services/relay-upstream-adapters.js'
import { zcodeAdapter } from '../src/services/upstream-adapters/zcode-adapter.js'

const HERE = fileURLToPath(new URL('.', import.meta.url))
// 提取器在 scripts/lib(跨包复用单一真相源),经 fileURL 动态 import(同 binding-soft-delete 先例)
const zcodeExtract = (await import(
  pathToFileURL(resolve(HERE, '../../../scripts/lib/zcode-auth-extract.mjs')).href
)) as {
  extractZcodeAccounts: (opts?: { roots?: string[] }) => Promise<{
    providerCode: string
    accounts: Array<Record<string, unknown>>
    meta: { count: number; sessions: Array<Record<string, unknown>> }
  }>
  parseProjectKeyStorageKey: (key: string) => { host: string; region: string | null } | null
  collectRegions: (map: Record<string, unknown>) => string[]
  summarizeCredentials: (map: Record<string, unknown>, regions: string[]) => Record<string, unknown>
}

const mockFetch = vi.fn()
global.fetch = mockFetch as unknown as typeof fetch

// =============================================================================
// 夹具(合成假值,无真实凭据;project-key 键名用本机实证的 URI 编码形)
// =============================================================================

const tmpRoots: string[][] = []

afterAll(() => {
  for (const root of tmpRoots) {
    try {
      rmSync(root, { recursive: true, force: true })
    } catch {
      /* tmp 清理失败不影响判定 */
    }
  }
})

function makeZcodeRoot(credMap: Record<string, string>): string {
  const root = mkdtempSync(resolve(tmpdir(), 'ihui-zcode-test-'))
  tmpRoots.push(root)
  const v2Dir = resolve(root, 'v2')
  mkdirSync(v2Dir, { recursive: true })
  writeFileSync(resolve(v2Dir, 'credentials.json'), JSON.stringify(credMap))
  return root
}

// 本机实证的存储键形(URI 编码数组;值/项目 id 均为合成假值)
const CN_PROJECT_KEY_NAME =
  'project-key-location:v1:%5B%22https%3A%2F%2Fbigmodel.cn%22%2C%22bigmodel%22%2C%2212345%22%2Cnull%2C1%2C%22non-team%22%5D'
const GLOBAL_PROJECT_KEY_NAME =
  'project-key-location:v1:%5B%22https%3A%2F%2Fz.ai%22%2C%22zai%22%2C%2267890%22%2Cnull%2C1%2C%22non-team%22%5D'

function makeCredMap(overrides: Record<string, string> = {}): Record<string, string> {
  return {
    'oauth:bigmodel:access_token': 'zc-oauth-token-fixture',
    zcodejwttoken: 'zc-jwt-fixture',
    'oauth:bigmodel:user_info': 'zc-userinfo-fixture',
    'oauth:login_attribution': 'attr-fixture',
    'oauth:active_provider': 'bigmodel-fixture',
    [CN_PROJECT_KEY_NAME]: 'zc-project-key-fixture',
    ...overrides,
  }
}

// =============================================================================
// 提取器(两态)
// =============================================================================

describe('zcode extractZcodeAccounts(两态)', () => {
  it('成功态:整图直通提取,region=cn 作为账号字段带上', async () => {
    const root = makeZcodeRoot(makeCredMap())
    const result = await zcodeExtract.extractZcodeAccounts({ roots: [root] })
    expect(result.providerCode).toBe('zcode')
    expect(result.accounts).toHaveLength(1)
    const acc = result.accounts[0]
    // region 来自 project-key-location 键名里的 host(bigmodel.cn → cn)
    expect(acc['region']).toBe('cn')
    expect(acc['regions']).toEqual(['cn'])
    // §0.6 raw 直通:credentials.json 整图逐字保留
    expect(acc['oauth:bigmodel:access_token']).toBe('zc-oauth-token-fixture')
    expect(acc['zcodejwttoken']).toBe('zc-jwt-fixture')
    expect(acc[CN_PROJECT_KEY_NAME]).toBe('zc-project-key-fixture')
    // meta 摘要零回显:只有指纹/长度/布尔
    expect(result.meta.sessions[0]).toMatchObject({
      region: 'cn',
      hasOauthAccessToken: true,
      hasZcodeJwtToken: true,
      projectKeyCount: 1,
      oauthFingerprint: expect.stringMatching(/^[0-9a-f]{12}$/),
      oauthLength: expect.any(Number),
    })
  })

  it('z.ai 项目键 ⇒ region=global(双站键名判定)', async () => {
    const root = makeZcodeRoot(
      makeCredMap({ [GLOBAL_PROJECT_KEY_NAME]: 'zc-global-key', [CN_PROJECT_KEY_NAME]: '' }),
    )
    const result = await zcodeExtract.extractZcodeAccounts({ roots: [root] })
    expect(result.accounts[0]['region']).toBe('global')
  })

  it('目录缺失 ⇒ throw ZCODE_DIR_MISSING(点名原因)', async () => {
    await expect(
      zcodeExtract.extractZcodeAccounts({ roots: [resolve(tmpdir(), 'ihui-zcode-nope')] }),
    ).rejects.toMatchObject({ code: 'ZCODE_DIR_MISSING' })
  })

  it('凭据图全空 ⇒ throw ZCODE_NO_SESSION(未判定,不静默空返回)', async () => {
    const root = makeZcodeRoot({})
    await expect(zcodeExtract.extractZcodeAccounts({ roots: [root] })).rejects.toMatchObject({
      code: 'ZCODE_NO_SESSION',
    })
  })
})

describe('zcode parseProjectKeyStorageKey(键名级取证)', () => {
  it('bigmodel.cn → cn;z.ai → global;解不动 → null(不猜)', () => {
    expect(zcodeExtract.parseProjectKeyStorageKey(CN_PROJECT_KEY_NAME)).toEqual({
      host: 'bigmodel.cn',
      region: 'cn',
    })
    expect(zcodeExtract.parseProjectKeyStorageKey(GLOBAL_PROJECT_KEY_NAME)).toEqual({
      host: 'z.ai',
      region: 'global',
    })
    expect(zcodeExtract.parseProjectKeyStorageKey('project-key-location:v1:%5Bbroken')).toBeNull()
    expect(zcodeExtract.parseProjectKeyStorageKey('oauth:bigmodel:access_token')).toBeNull()
  })
})

// =============================================================================
// 适配器
// =============================================================================

function makeCtx(region?: 'cn' | 'global'): AdapterAccountContext {
  return {
    row: { id: 'row-1', providerCode: 'zcode', uid: 'u1', name: 'n', extraMetadata: null },
    credentials: {
      token: 'zc-token',
      refreshToken: null,
      cookies: [],
      secrets: {
        ...(region ? { region } : {}),
        credentialMap: {
          'oauth:bigmodel:access_token': 'zc-token',
          zcodejwttoken: 'zc-jwt-fixture',
        },
      },
    },
  } as unknown as AdapterAccountContext
}

function chunkOf(obj: unknown): string {
  return JSON.stringify(obj)
}

describe('zcode translateStreamChunk', () => {
  const ctx = makeCtx()
  const state: StreamState = {}

  it('普通 chunk 原样透传', () => {
    const frame = {
      id: 'chatcmpl-1',
      object: 'chat.completion.chunk',
      choices: [{ index: 0, delta: { content: '你好' }, finish_reason: null }],
    }
    const out = zcodeAdapter.translateStreamChunk(ctx, chunkOf(frame), state)
    expect(out?.openaiChunk).toEqual(frame)
    expect(out?.done).toBeUndefined()
  })

  it('{"error":{"code":"1000"}} 业务错误帧 → done + error 信息', () => {
    const out = zcodeAdapter.translateStreamChunk(
      ctx,
      chunkOf({ error: { code: '1000', message: '身份验证失败' } }),
      state,
    )
    expect(out?.done).toBe(true)
    const err = out?.openaiChunk['error'] as { code: string; message: string }
    expect(err.code).toBe('1000')
    expect(err.message).toBe('身份验证失败')
  })

  it('data: [DONE] / 空帧 / 非 JSON 心跳 → null(转发层统一补发 DONE)', () => {
    expect(zcodeAdapter.translateStreamChunk(ctx, 'data: [DONE]', state)).toBeNull()
    expect(zcodeAdapter.translateStreamChunk(ctx, '', state)).toBeNull()
    expect(zcodeAdapter.translateStreamChunk(ctx, ': keep-alive', state)).toBeNull()
  })
})

describe('zcode translateNonStream', () => {
  it('正常响应透传', () => {
    const body = { id: 'x', choices: [{ message: { content: 'hi' } }] }
    expect(zcodeAdapter.translateNonStream(makeCtx(), body)).toEqual(body)
  })

  it('HTTP 200 业务错误体 → 抛错(不得当成功)', () => {
    expect(() =>
      zcodeAdapter.translateNonStream(makeCtx(), {
        error: { code: '1000', message: '身份验证失败' },
      }),
    ).toThrow(/1000/)
  })
})

describe('zcode isAuthFailure', () => {
  it('401/403 → true', () => {
    expect(zcodeAdapter.isAuthFailure(401, '')).toBe(true)
    expect(zcodeAdapter.isAuthFailure(403, '')).toBe(true)
  })

  it('HTTP 200 但 error.code 1000/1001 → true(公开文档口径)', () => {
    expect(
      zcodeAdapter.isAuthFailure(200, '{"error":{"code":"1000","message":"身份验证失败"}}'),
    ).toBe(true)
    expect(zcodeAdapter.isAuthFailure(200, '{"error":{"code":"1001","message":"缺授权头"}}')).toBe(
      true,
    )
  })

  it('普通 4xx/5xx / 其他错误码 → false(不误触 401 自愈)', () => {
    expect(zcodeAdapter.isAuthFailure(400, 'bad request')).toBe(false)
    expect(zcodeAdapter.isAuthFailure(500, 'gateway error')).toBe(false)
    // 10029 之类非鉴权码不得被子串误吞
    expect(zcodeAdapter.isAuthFailure(200, '{"error":{"code":"10029","message":"x"}}')).toBe(false)
  })
})

describe('zcode buildChatRequest', () => {
  it('region 缺省落国内域 open.bigmodel.cn(GLM Coding Plan 专属面),body 透传', () => {
    const http = zcodeAdapter.buildChatRequest(makeCtx(), {
      model: 'glm-5.3',
      messages: [{ role: 'user', content: 'hi' }],
      temperature: 0.7,
      maxTokens: 100,
      stream: true,
    })
    expect(http.url).toBe('https://open.bigmodel.cn/api/coding/paas/v4/chat/completions')
    expect(http.method).toBe('POST')
    const body = JSON.parse(http.rawBody ?? '') as Record<string, unknown>
    expect(body).toMatchObject({
      model: 'glm-5.3',
      stream: true,
      temperature: 0.7,
      max_tokens: 100,
    })
    expect(http.headers['authorization']).toBe('Bearer zc-token')
    expect(http.headers['accept']).toBe('text/event-stream')
  })

  it('secrets.region=global 落国际域 api.z.ai(双域名常量都在)', () => {
    const http = zcodeAdapter.buildChatRequest(makeCtx('global'), {
      model: 'glm-5.3',
      messages: [],
      stream: false,
    })
    expect(http.url).toBe('https://api.z.ai/api/coding/paas/v4/chat/completions')
    expect(http.headers['accept']).toBe('application/json')
  })

  it('extraMetadata.region=global 同样落国际域(secrets 缺失时的第二来源)', () => {
    const ctx = {
      row: { extraMetadata: { region: 'global' } },
      credentials: { token: 'zc-token', secrets: {} },
    } as unknown as AdapterAccountContext
    expect(zcodeAdapter.buildChatRequest(ctx, { model: 'm', messages: [], stream: true }).url).toBe(
      'https://api.z.ai/api/coding/paas/v4/chat/completions',
    )
  })

  it('缺 token ⇒ 抛错(该账号不可转发)', () => {
    const ctx = {
      row: { extraMetadata: null },
      credentials: { token: '', secrets: {} },
    } as unknown as AdapterAccountContext
    expect(() =>
      zcodeAdapter.buildChatRequest(ctx, { model: 'm', messages: [], stream: true }),
    ).toThrow(/缺少 token/)
  })
})

describe('zcode getQuota(zcode-plan 通道,2026-10-27 实弹闭环)', () => {
  beforeEach(() => {
    mockFetch.mockReset()
  })

  it('401 → ok:false + authFailed(承载层据此触发自愈)', async () => {
    mockFetch.mockResolvedValue({
      status: 401,
      ok: false,
      text: async () => JSON.stringify({ error: { code: '1000', message: '身份验证失败' } }),
    })
    const q = await zcodeAdapter.getQuota!(makeCtx())
    expect(q.ok).toBe(false)
    expect(q.authFailed).toBe(true)
    expect(q.error).toMatch(/HTTP 401/)
  })

  it('200/code=0 + active plans → ok:true,quota 报档名与权益包(不编剩余数字)', async () => {
    mockFetch.mockResolvedValue({
      status: 200,
      ok: true,
      text: async () =>
        JSON.stringify({
          code: 0,
          msg: '',
          data: {
            server_time: 1793095210,
            plans: [
              {
                plan_id: 'zcode-v3-start-plan-0817',
                name: 'ZCode Start Plan',
                status: 'active',
                ends_at: 1793289599,
                entitlements: [
                  { show_name: 'GLM-5.3', unit_type: 'token', grant_units: 1000 },
                  { show_name: 'GLM-5.3-Flash', unit_type: 'token', grant_units: 2000 },
                ],
              },
            ],
          },
        }),
    })
    const q = await zcodeAdapter.getQuota!(makeCtx())
    expect(q.ok).toBe(true)
    expect(q.quota?.subscriptionName).toBe('ZCode Start Plan')
    expect(q.quota?.packs).toHaveLength(2)
    expect(q.quota?.packs?.[0]).toMatchObject({ name: 'GLM-5.3', limit: 1000 })
    expect(q.quota?.resetsAt).toBe(new Date(1793289599 * 1000).toISOString())
    expect(q.quota?.used).toBeUndefined()
    expect(q.quota?.remaining).toBeUndefined()
  })

  it('200/code=0 但 plans 空 → ok:false「无生效套餐」(不编数字)', async () => {
    mockFetch.mockResolvedValue({
      status: 200,
      ok: true,
      text: async () => JSON.stringify({ code: 0, msg: '', data: { plans: [] } }),
    })
    const q = await zcodeAdapter.getQuota!(makeCtx())
    expect(q.ok).toBe(false)
    expect(q.quota).toBeUndefined()
    expect(q.error).toContain('无生效套餐')
  })

  it('200 但业务 code!=0 → ok:false 业务拒绝带码;非 JSON → 未判定', async () => {
    mockFetch.mockResolvedValue({
      status: 200,
      ok: true,
      text: async () => JSON.stringify({ code: 3001, msg: 'parameter error' }),
    })
    const q = await zcodeAdapter.getQuota!(makeCtx())
    expect(q.ok).toBe(false)
    expect(q.error).toContain('code=3001')

    mockFetch.mockResolvedValue({ status: 200, ok: true, text: async () => 'not-json' })
    const q2 = await zcodeAdapter.getQuota!(makeCtx())
    expect(q2.ok).toBe(false)
    expect(q2.error).toMatch(/非 JSON/)
  })

  it('请求面:GET zcode.z.ai billing/balance + zcodejwttoken 票 + X- 头全套', async () => {
    mockFetch.mockResolvedValue({
      status: 200,
      ok: true,
      text: async () =>
        JSON.stringify({ code: 0, data: { plans: [{ status: 'active', entitlements: [] }] } }),
    })
    await zcodeAdapter.getQuota!(makeCtx())
    const [url, init] = mockFetch.mock.calls[0] as [string, RequestInit]
    expect(url).toBe('https://zcode.z.ai/api/v1/zcode-plan/billing/balance?app_version=3.16.3')
    expect(init.method).toBe('GET')
    const headers = init.headers as Record<string, string>
    expect(headers['authorization']).toBe('Bearer zc-jwt-fixture')
    expect(headers['X-Device-Mid']).toMatch(/^[0-9a-f-]{36}$/)
    expect(headers['X-ZCode-App-Version']).toBe('3.16.3')
    expect(headers['X-Os-Category']).toBe('windows')
  })

  it('网络异常 → ok:false,error 带原因', async () => {
    mockFetch.mockRejectedValue(new Error('socket hang up'))
    const q = await zcodeAdapter.getQuota!(makeCtx())
    expect(q.ok).toBe(false)
    expect(q.error).toMatch(/socket hang up/)
  })
})

describe('zcode checkHealth(三态)', () => {
  beforeEach(() => {
    mockFetch.mockReset()
  })

  it('200/code=0 → ok:true(zcode-plan 通道实弹语义)', async () => {
    mockFetch.mockResolvedValue({
      status: 200,
      ok: true,
      text: async () =>
        JSON.stringify({ code: 0, msg: '', data: { plans: [{ status: 'active' }] } }),
    })
    const h = await zcodeAdapter.checkHealth(makeCtx())
    expect(h.ok).toBe(true)
  })

  it('200 但业务 code!=0 → indeterminate 未判定(不冒绿不误杀)', async () => {
    mockFetch.mockResolvedValue({
      status: 200,
      ok: true,
      text: async () => JSON.stringify({ code: 3001, msg: 'parameter error' }),
    })
    const h = await zcodeAdapter.checkHealth(makeCtx())
    expect(h.ok).toBe(false)
    expect(h.indeterminate).toBe(true)
    expect(h.authFailed).toBeUndefined()
  })

  it('401 → ok:false + authFailed(明确拒收)', async () => {
    mockFetch.mockResolvedValue({ status: 401, ok: false, text: async () => 'unauthorized' })
    const h = await zcodeAdapter.checkHealth(makeCtx())
    expect(h.ok).toBe(false)
    expect(h.authFailed).toBe(true)
    expect(h.indeterminate).toBe(false)
  })

  it('5xx → ok:false + indeterminate(未判定,不得写 down)', async () => {
    mockFetch.mockResolvedValue({ status: 502, ok: false, text: async () => 'bad gateway' })
    const h = await zcodeAdapter.checkHealth(makeCtx())
    expect(h.ok).toBe(false)
    expect(h.indeterminate).toBe(true)
    expect(h.authFailed).toBe(false)
  })

  it('网络异常 → indeterminate', async () => {
    mockFetch.mockRejectedValue(new Error('ECONNRESET'))
    const h = await zcodeAdapter.checkHealth(makeCtx())
    expect(h.ok).toBe(false)
    expect(h.indeterminate).toBe(true)
  })
})

describe('zcode classifyUpstreamFailure', () => {
  const classify = zcodeAdapter.classifyUpstreamFailure!

  it('1000 身份验证失败 → auth(401 自愈)', () => {
    expect(classify(200, '{"error":{"code":"1000","message":"身份验证失败"}}').kind).toBe('auth')
  })

  it('402 / 余额不足文案 → credit', () => {
    expect(classify(402, 'api error: 402 insufficient balance').kind).toBe('credit')
    expect(classify(400, '{"message":"余额不足"}').kind).toBe('credit')
  })

  it('401/403 → auth;1001 缺授权头 → auth', () => {
    expect(classify(401, 'x').kind).toBe('auth')
    expect(classify(403, 'x').kind).toBe('auth')
    expect(classify(400, '{"error":{"code":"1001","message":"missing authorization"}}').kind).toBe(
      'auth',
    )
  })

  it('HTTP 状态兜底:404→not_found、429→rate、5xx→server、其他→client', () => {
    expect(classify(404, 'no such thing').kind).toBe('not_found')
    expect(classify(429, 'too many').kind).toBe('rate')
    expect(classify(502, 'bad gateway').kind).toBe('server')
    expect(classify(400, 'bad request').kind).toBe('client')
  })
})

describe('zcode summarizeCredentials(零回显)', () => {
  it('摘要只有指纹/长度/布尔,不带凭据明文', () => {
    const s = zcodeExtract.summarizeCredentials(makeCredMap(), ['cn'])
    const json = JSON.stringify(s)
    expect(json).not.toContain('zc-oauth-token-fixture')
    expect(json).not.toContain('zc-jwt-fixture')
    expect(json).not.toContain('zc-project-key-fixture')
    expect(s).toMatchObject({ region: 'cn', hasOauthAccessToken: true, projectKeyCount: 1 })
  })
})
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
