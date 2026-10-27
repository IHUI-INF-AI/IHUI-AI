// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * CodeArts 适配器行为单测(2026-10-22 立)。
 *
 * 覆盖点:
 * - translateStreamChunk:OpenAI 帧透传 / usage 终帧透传 / {"error_code"} 业务错误帧识别为终止失败
 * - translateNonStream:HTTP 200 业务错误必须抛错(不得当成功)
 * - isAuthFailure:401/403 + APIG.0301/0303/STS5.1804/STS5.1806;TM.00001041 是临时故障不算
 * - buildChatRequest:body 透传、model-id/model-name 与 body.model 逐字一致、签名头齐备、
 *   x-ot-session-id 按凭据稳定推导(非每请求随机)
 * - refreshToken:form + DPoP 头,响应整套 STS 凭据映射进 {token,refreshToken,expiresAt,secrets}
 *
 * fetch 全部打桩,不发真实网络请求。
 */
import { describe, it, expect, vi, beforeEach } from 'vitest'
import type { AdapterAccountContext, StreamState } from '../src/services/relay-upstream-adapters.js'
import {
  codeartsAdapter,
  CodeArtsRefreshError,
} from '../src/services/upstream-adapters/codearts-adapter.js'
import { generateDpopKeyJwk } from '../src/services/upstream-adapters/codearts-signer.js'

const mockFetch = vi.fn()
global.fetch = mockFetch as unknown as typeof fetch

function makeCtx(): AdapterAccountContext {
  return {
    row: { id: 'row-1', providerCode: 'codearts', uid: 'u1', name: 'n' },
    credentials: {
      token: 'sts-security-token',
      refreshToken: 'rt-old',
      cookies: [],
      secrets: {
        accessKeyId: 'HSTAKtest',
        secretAccessKey: 'sktestsecret',
        dpopPrivateKeyJwk: generateDpopKeyJwk(),
        codeVerifier: 'cv-test',
        clientId: 'codearts-agent',
        domainId: 'dom-test',
        userName: 'tester',
      },
    },
  } as unknown as AdapterAccountContext
}

function chunkOf(obj: unknown): string {
  return JSON.stringify(obj)
}

describe('codearts translateStreamChunk', () => {
  const ctx = makeCtx()
  const state: StreamState = {}

  it('普通 chunk 原样透传', () => {
    const frame = {
      id: 'chatcmpl-1',
      object: 'chat.completion.chunk',
      choices: [{ index: 0, delta: { content: '你好' }, finish_reason: null }],
    }
    const out = codeartsAdapter.translateStreamChunk(ctx, chunkOf(frame), state)
    expect(out).not.toBeNull()
    expect(out?.openaiChunk).toEqual(frame)
    expect(out?.done).toBeUndefined()
  })

  it('usage 终帧(choices 空)原样透传', () => {
    const frame = {
      id: 'chatcmpl-1',
      object: 'chat.completion.chunk',
      choices: [],
      usage: { prompt_tokens: 10, completion_tokens: 20, total_tokens: 30 },
    }
    const out = codeartsAdapter.translateStreamChunk(ctx, chunkOf(frame), state)
    expect(out?.openaiChunk).toEqual(frame)
  })

  it('{"error_code"} 业务错误帧 → done + error 信息', () => {
    const out = codeartsAdapter.translateStreamChunk(
      ctx,
      chunkOf({ error_code: '4005', error_msg: 'unsupported model' }),
      state,
    )
    expect(out?.done).toBe(true)
    const err = out?.openaiChunk['error'] as { code: string; message: string }
    expect(err.code).toBe('4005')
    expect(err.message).toBe('unsupported model')
  })

  it('TM.00001041 并发超限帧同样识别为错误帧', () => {
    const out = codeartsAdapter.translateStreamChunk(
      ctx,
      'data: ' + chunkOf({ error_code: 'TM.00001041', error_msg: 'session limit' }),
      state,
    )
    expect(out?.done).toBe(true)
    expect((out?.openaiChunk['error'] as { code: string }).code).toBe('TM.00001041')
  })

  it('data: [DONE] / 空帧 / 非 JSON 心跳 → null(转发层统一补发 DONE)', () => {
    expect(codeartsAdapter.translateStreamChunk(ctx, 'data: [DONE]', state)).toBeNull()
    expect(codeartsAdapter.translateStreamChunk(ctx, '', state)).toBeNull()
    expect(codeartsAdapter.translateStreamChunk(ctx, ': keep-alive', state)).toBeNull()
  })
})

describe('codearts translateNonStream', () => {
  it('正常响应透传', () => {
    const body = { id: 'x', choices: [{ message: { content: 'hi' } }] }
    expect(codeartsAdapter.translateNonStream(makeCtx(), body)).toEqual(body)
  })

  it('HTTP 200 业务错误体 → 抛错(不得当成功)', () => {
    expect(() =>
      codeartsAdapter.translateNonStream(makeCtx(), {
        error_code: '4005',
        error_msg: 'unsupported model',
      }),
    ).toThrow(/4005/)
  })
})

describe('codearts isAuthFailure', () => {
  it('401/403 → true', () => {
    expect(codeartsAdapter.isAuthFailure(401, '')).toBe(true)
    expect(codeartsAdapter.isAuthFailure(403, '')).toBe(true)
  })

  it('HTTP 200 但体带凭证失效码 → true', () => {
    for (const code of ['APIG.0301', 'APIG.0303', 'STS5.1804', 'STS5.1806']) {
      expect(codeartsAdapter.isAuthFailure(200, `{"error_code":"${code}"}`)).toBe(true)
    }
  })

  it('TM.00001041(并发超限)= 临时故障 → false 走退避', () => {
    expect(codeartsAdapter.isAuthFailure(400, '{"error_code":"TM.00001041"}')).toBe(false)
  })

  it('普通 5xx / 400 → false', () => {
    expect(codeartsAdapter.isAuthFailure(500, 'gateway error')).toBe(false)
    expect(codeartsAdapter.isAuthFailure(400, 'bad request')).toBe(false)
  })
})

describe('codearts buildChatRequest', () => {
  it('body 透传 OpenAI 形状,model-id/model-name 与 body.model 逐字一致', () => {
    const req = {
      model: 'GLM-5.2',
      messages: [{ role: 'user', content: 'hi' }],
      temperature: 0.7,
      maxTokens: 100,
      stream: true,
    }
    const http = codeartsAdapter.buildChatRequest(makeCtx(), req)
    expect(http.url).toBe(
      'https://snap-access.cn-north-4.myhuaweicloud.com/api/v2/chat/completions',
    )
    expect(http.method).toBe('POST')
    const body = JSON.parse(http.rawBody ?? '') as Record<string, unknown>
    expect(body).toMatchObject({
      model: 'GLM-5.2',
      stream: true,
      temperature: 0.7,
      max_tokens: 100,
    })
    expect(http.headers['model-id']).toBe('GLM-5.2')
    expect(http.headers['model-name']).toBe('GLM-5.2')
  })

  it('签名头齐备且 Authorization 形状正确', () => {
    const http = codeartsAdapter.buildChatRequest(makeCtx(), {
      model: 'glm-5.3',
      messages: [{ role: 'user', content: 'hi' }],
      stream: true,
    })
    expect(http.headers['Authorization']).toMatch(
      /^SDK-HMAC-SHA256 Access=HSTAKtest, SignedHeaders=.+, Signature=[0-9a-f]{64}$/,
    )
    expect(http.headers['x-security-token']).toBe('sts-security-token')
    expect(http.headers['x-sdk-date']).toMatch(/^\d{8}T\d{6}Z$/)
    expect(http.headers['host']).toBe('snap-access.cn-north-4.myhuaweicloud.com')
    // X-Sdk-Content-Sha256 = sha256(rawBody)(签名 map 键统一小写)
    expect(http.headers['x-sdk-content-sha256']).toBeTruthy()
    expect(http.headers['plugin-name']).toBe('codemate_vscode')
    expect(http.headers['app-id']).toBe('CodeAgent3.0')
  })

  it('x-ot-session-id 按凭据稳定推导(勿每请求随机,上游按它限并发)', () => {
    const h1 = codeartsAdapter.buildChatRequest(makeCtx(), {
      model: 'glm-5.3',
      messages: [],
      stream: true,
    }).headers
    const h2 = codeartsAdapter.buildChatRequest(makeCtx(), {
      model: 'glm-5.3',
      messages: [],
      stream: true,
    }).headers
    expect(h1['x-ot-session-id']).toMatch(/^ses_[0-9a-f]{32}$/)
    expect(h2['x-ot-session-id']).toBe(h1['x-ot-session-id'])
    // trace/span/msg 每请求随机是允许的
    expect(h1['x-ot-trace-id']).not.toBe(h2['x-ot-trace-id'])
  })
})

describe('codearts refreshToken(打桩 fetch)', () => {
  // Vitest 4:hook 回调不得隐式返回 mock 函数(会被当作 cleanup 在测后调用,
  // 产生归属本用例的 unhandled rejection),必须块体无返回值。
  beforeEach(() => {
    mockFetch.mockReset()
  })

  it('成功:form + DPoP 头,整套 STS 凭据进返回值', async () => {
    mockFetch.mockResolvedValue({
      status: 200,
      ok: true,
      text: async () =>
        JSON.stringify({
          user_id: 'u1',
          user_name: 'tester',
          domain_id: 'dom-test',
          refresh_token: 'rt-rotated',
          credentials: {
            access_key_id: 'HSTAKnew',
            secret_access_key: 'sknew',
            security_token: 'sts-new',
            expiration: '2027-01-01T00:00:00Z',
          },
        }),
    })
    const result = await codeartsAdapter.refreshToken!(makeCtx())
    expect(result).not.toBeNull()
    expect(result?.token).toBe('sts-new')
    expect(result?.refreshToken).toBe('rt-rotated')
    expect(result?.expiresAt).toEqual(new Date('2027-01-01T00:00:00Z'))
    expect(result?.secrets).toMatchObject({
      accessKeyId: 'HSTAKnew',
      secretAccessKey: 'sknew',
      codeVerifier: 'cv-test', // PKCE/DPoP 不轮转,原样保留
      domainId: 'dom-test',
    })

    const [url, init] = mockFetch.mock.calls[0] as [string, RequestInit]
    expect(url).toBe('https://sts.cn-north-4.myhuaweicloud.com/v1/oauth2/tokens')
    expect(init.method).toBe('POST')
    const headers = init.headers as Record<string, string>
    expect(headers['content-type']).toBe('application/x-www-form-urlencoded')
    expect(headers['DPoP']).toMatch(/^[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+$/)
    const form = new URLSearchParams(String(init.body))
    expect(form.get('grant_type')).toBe('refresh_token')
    expect(form.get('refresh_token')).toBe('rt-old')
    expect(form.get('client_id')).toBe('codearts-agent')
    expect(form.get('code_verifier')).toBe('cv-test')
  })

  it('STS5.1806(refresh_token 已使用)→ 抛错(凭证报废,交调度器计数摘除)', async () => {
    mockFetch.mockResolvedValue({
      status: 400,
      ok: false,
      text: async () =>
        JSON.stringify({ error: 'STS5.1806', error_description: 'token already used' }),
    })
    await expect(codeartsAdapter.refreshToken!(makeCtx())).rejects.toThrow(/STS5.1806|already used/)
  })

  it('缺 DPoP 私钥/PKCE → 抛错无法续期', async () => {
    const ctx = makeCtx()
    ctx.credentials.secrets = {}
    await expect(codeartsAdapter.refreshToken!(ctx)).rejects.toThrow(/secretsEnc 未导入|无法续期/)
  })
})

describe('codearts checkHealth / listModels(打桩 fetch)', () => {
  // Vitest 4:hook 回调不得隐式返回 mock 函数(会被当作 cleanup 在测后调用,
  // 产生归属本用例的 unhandled rejection),必须块体无返回值。
  beforeEach(() => {
    mockFetch.mockReset()
  })

  it('builtinModels 正常 → ok 且模型 id 列表(剔除 enable:false)', async () => {
    mockFetch.mockResolvedValue({
      status: 200,
      ok: true,
      text: async () =>
        JSON.stringify({
          builtinModels: [
            { model_id: 'glm-5.3', model_name: 'GLM-5.3', enable: true },
            { model_id: 'GLM-5.2', model_name: 'GLM-5.2', enable: true },
            { model_id: 'dead-model', model_name: 'Dead', enable: false },
          ],
        }),
    })
    const health = await codeartsAdapter.checkHealth(makeCtx())
    expect(health.ok).toBe(true)

    mockFetch.mockResolvedValue({
      status: 200,
      ok: true,
      text: async () =>
        JSON.stringify({
          builtinModels: [
            { model_id: 'glm-5.3', enable: true },
            { model_id: 'GLM-5.2', enable: true },
            { model_id: 'dead-model', enable: false },
          ],
        }),
    })
    const models = await codeartsAdapter.listModels!(makeCtx())
    expect(models).toEqual(['glm-5.3', 'GLM-5.2'])

    const headers = (mockFetch.mock.calls[0] as [string, RequestInit])[1].headers as Record<
      string,
      string
    >
    expect(headers['agent-type']).toBe('PromptCenter')
    expect(headers['Authorization']).toMatch(/^SDK-HMAC-SHA256 /)
  })

  it('HTTP 200 业务错误体 → ok:false 带原因', async () => {
    mockFetch.mockResolvedValue({
      status: 200,
      ok: true,
      text: async () => JSON.stringify({ error_code: 'APIG.0303', error_msg: 'token expired' }),
    })
    const health = await codeartsAdapter.checkHealth(makeCtx())
    expect(health.ok).toBe(false)
    expect(health.error).toMatch(/APIG.0303/)
  })

  it('opts.fetchImpl 优先于全局 fetch(转发层/测试注入点)', async () => {
    const injected = vi.fn().mockResolvedValue({
      status: 200,
      ok: true,
      text: async () => JSON.stringify({ builtinModels: [{ model_id: 'glm-5.3', enable: true }] }),
    })
    mockFetch.mockResolvedValue({ status: 500, ok: false, text: async () => 'boom' })
    const models = await codeartsAdapter.listModels!(makeCtx(), {
      fetchImpl: injected as unknown as typeof fetch,
    })
    expect(models).toEqual(['glm-5.3'])
    expect(injected).toHaveBeenCalledTimes(1)
    expect(mockFetch).not.toHaveBeenCalled()
  })
})

describe('codearts getQuota(限时福利 balance;APIG 信封实证 2026-10-27)', () => {
  // 2026-10-27 收尾票:本 describe 自 4cdbb439de 恢复(他席 32db9220c5 重派误冲双源实证信封断言)
  beforeEach(() => {
    mockFetch.mockReset()
  })

  it('401 → ok:false + authFailed(承载层据此触发自愈刷新)', async () => {
    mockFetch.mockResolvedValue({
      status: 401,
      ok: false,
      text: async () => JSON.stringify({ error_code: 'APIG.0301', error_msg: 'Unauthorized' }),
    })
    const q = await codeartsAdapter.getQuota!(makeCtx())
    expect(q.ok).toBe(false)
    expect(q.authFailed).toBe(true)
    expect(q.error).toMatch(/HTTP 401/)
  })

  it('200 + 业务拒绝信封(4000 invalid channel,group not found)→ ok:false 带码与明细', async () => {
    mockFetch.mockResolvedValue({
      status: 200,
      ok: true,
      text: async () =>
        JSON.stringify({ error_code: '4000', error_msg: 'invalid channel, group not found', result: null }),
    })
    const q = await codeartsAdapter.getQuota!(makeCtx())
    expect(q.ok).toBe(false)
    expect(q.quota).toBeUndefined()
    expect(q.authFailed).toBeUndefined()
    expect(q.error).toContain('error_code=4000')
    expect(q.error).toContain('invalid channel, group not found')
  })

  it('200 + 0000 信封 → ok:false 载荷未判定(result 键如实带出,不猜字段读成数字)', async () => {
    mockFetch.mockResolvedValue({
      status: 200,
      ok: true,
      text: async () => JSON.stringify({ error_code: '0000', error_msg: 'success', result: { balance: 60 } }),
    })
    const q = await codeartsAdapter.getQuota!(makeCtx())
    expect(q.ok).toBe(false)
    expect(q.quota).toBeUndefined()
    expect(q.error).toContain('error_code=0000')
    expect(q.error).toContain('result 载荷形状未实证')
    expect(q.error).toContain('balance')
    expect(q.error).toMatch(/未判定/)
  })

  it('200 无 error_code 字段(信封外形状)→ ok:false 未判定,如实报缺失', async () => {
    mockFetch.mockResolvedValue({
      status: 200,
      ok: true,
      text: async () => JSON.stringify({ balance: 60, unit: 'tokens' }),
    })
    const q = await codeartsAdapter.getQuota!(makeCtx())
    expect(q.ok).toBe(false)
    expect(q.error).toContain('(缺失/非字符串)')
  })

  it('200 非 JSON → ok:false 未判定,报非 JSON 信封', async () => {
    mockFetch.mockResolvedValue({ status: 200, ok: true, text: async () => 'not-json' })
    const q = await codeartsAdapter.getQuota!(makeCtx())
    expect(q.ok).toBe(false)
    expect(q.error).toContain('非 JSON 信封')
  })

  it('请求面:GET balance 端点 + 签名头含 host/x-sdk-date/x-security-token(无 agent-type)', async () => {
    mockFetch.mockResolvedValue({ status: 200, ok: true, text: async () => '{}' })
    await codeartsAdapter.getQuota!(makeCtx())
    const [url, init] = mockFetch.mock.calls[0] as [string, { headers: Record<string, string> }]
    expect(url).toContain('opengw.developer.huaweicloud.com/api/v1/user/tokens/balance')
    expect(init.method).toBe('GET')
    const h = Object.fromEntries(
      Object.entries(init.headers).map(([k, v]) => [k.toLowerCase(), v]),
    )
    expect(h['host']).toContain('opengw.developer.huaweicloud.com')
    expect(h['x-sdk-date']).toBeTruthy()
    expect(h['x-security-token']).toBe('sts-security-token')
    expect(h['agent-type']).toBeUndefined()
  })
})

describe('codearts classifyUpstreamFailure', () => {
  const classify = codeartsAdapter.classifyUpstreamFailure!

  it('TM.00001041 并发超限 → rate(退避不罚号)', () => {
    expect(classify(400, '{"error_code":"TM.00001041","error_msg":"session limit"}').kind).toBe(
      'rate',
    )
  })

  it('STS5.1806 refresh_token 已使用 → session_dead(永久摘除)', () => {
    expect(classify(400, '{"error":"STS5.1806"}').kind).toBe('session_dead')
  })

  it('APIG.0301/0303、STS5.1804 → auth(401 自愈)', () => {
    expect(classify(200, '{"error_code":"APIG.0301"}').kind).toBe('auth')
    expect(classify(403, '{"error_code":"APIG.0303"}').kind).toBe('auth')
    expect(classify(400, '{"error_code":"STS5.1804"}').kind).toBe('auth')
  })

  it('InferHub…406 / 4005 / 资格类 → request(参数级不罚号)', () => {
    expect(classify(200, '{"error_code":"InferHub.001001011.406"}').kind).toBe('request')
    expect(classify(200, '{"error_code":"4005","error_msg":"unsupported model"}').kind).toBe(
      'request',
    )
    expect(classify(403, '{"error_code":"TM.00001027"}').kind).toBe('request')
  })

  it('额度/积分/欠费文案 → credit', () => {
    expect(classify(400, '{"error_msg":"insufficient credit balance"}').kind).toBe('credit')
    expect(classify(200, '{"error_msg":"积分已用尽"}').kind).toBe('credit')
  })

  it('HTTP 状态兜底:404→not_found、429→rate、5xx→server、其他 4xx→client', () => {
    expect(classify(404, 'no such thing').kind).toBe('not_found')
    expect(classify(429, 'too many').kind).toBe('rate')
    expect(classify(502, 'bad gateway').kind).toBe('server')
    expect(classify(400, 'bad request').kind).toBe('client')
  })

  it('扩展:402→credit;invalid_grant→session_dead;HTML 登录墙→auth;403+Insufficient privileges→auth(不误判 credit)', () => {
    expect(classify(402, 'payment required').kind).toBe('credit')
    expect(classify(400, '{"error":"invalid_grant"}').kind).toBe('session_dead')
    expect(classify(200, '<!DOCTYPE html><html><body>Please Login</body></html>').kind).toBe('auth')
    expect(classify(403, '{"error_msg":"Insufficient privileges"}').kind).toBe('auth')
  })
})

describe('codearts isAuthFailure 常见上游错误形态', () => {
  it('JSON error 体 / SSE 中途断流帧 / HTML 登录墙 / security token 文案 → true', () => {
    expect(codeartsAdapter.isAuthFailure(200, '{"error":{"code":"unauthorized"}}')).toBe(true)
    expect(
      codeartsAdapter.isAuthFailure(
        200,
        'data: {"error":{"message":"The security token has expired"}}',
      ),
    ).toBe(true)
    expect(codeartsAdapter.isAuthFailure(200, '<html><head>登录</head></html>')).toBe(true)
    expect(codeartsAdapter.isAuthFailure(200, 'security token is expired')).toBe(true)
  })
  it('普通 400 请求错误 / 并发超限 → false(不误触 401 自愈)', () => {
    expect(codeartsAdapter.isAuthFailure(400, '{"error_msg":"prompt is too long"}')).toBe(false)
    expect(codeartsAdapter.isAuthFailure(429, 'Too Many Requests')).toBe(false)
  })
})

describe('codearts isAuthError', () => {
  const isAuthError = codeartsAdapter.isAuthError!
  it('结构化刷新错误:auth→true,其余 kind→false', () => {
    expect(isAuthError(new CodeArtsRefreshError('auth', 401, 'x'))).toBe(true)
    expect(isAuthError(new CodeArtsRefreshError('rate', 429, 'x'))).toBe(false)
    expect(isAuthError(new CodeArtsRefreshError('session_dead', 400, 'x'))).toBe(false)
  })
  it('普通 Error:message 里的 HTTP 状态码还原判定', () => {
    expect(isAuthError(new Error('CodeArts 续期失败 HTTP 401: expired'))).toBe(true)
    expect(isAuthError(new Error('CodeArts 续期失败 HTTP 403: x'))).toBe(true)
    expect(isAuthError(new Error('CodeArts 续期失败 HTTP 429: x'))).toBe(false)
    expect(isAuthError(new Error('socket hang up'))).toBe(false)
  })
})

describe('codearts refreshToken 失败分类与回退重试(打桩 fetch)', () => {
  // Vitest 4:hook 回调不得隐式返回 mock 函数(会被当作 cleanup 在测后调用,
  // 产生归属本用例的 unhandled rejection),必须块体无返回值。
  beforeEach(() => {
    mockFetch.mockReset()
  })

  const refreshSuccessBody = {
    refresh_token: 'rt-rotated',
    credentials: {
      access_key_id: 'HSTAKnew',
      secret_access_key: 'sknew',
      security_token: 'sts-new',
      expiration: '2027-01-01T00:00:00Z',
    },
  }
  const resp = (status: number, body: unknown) => ({
    status,
    ok: status >= 200 && status < 300,
    text: async () => (typeof body === 'string' ? body : JSON.stringify(body)),
  })

  it('401 → auth,不重试(恰 1 次),message 不带凭证', async () => {
    mockFetch.mockResolvedValue(
      resp(401, { error: 'unauthorized', error_description: 'SecurityToken has expired' }),
    )
    const err = await codeartsAdapter.refreshToken!(makeCtx()).catch((e) => e)
    expect(err).toBeInstanceOf(CodeArtsRefreshError)
    expect(err).toMatchObject({
      name: 'CodeArtsRefreshError',
      failureKind: 'auth',
      statusCode: 401,
    })
    expect(err.message).not.toContain('rt-old')
    expect(err.message).not.toContain('sktestsecret')
    expect(mockFetch).toHaveBeenCalledTimes(1)
  })

  it('429 → rate,回退重试一次(恰 2 次,每次全新 DPoP)', async () => {
    mockFetch.mockResolvedValue(resp(429, { error: 'too many requests' }))
    const err = await codeartsAdapter.refreshToken!(makeCtx()).catch((e) => e)
    expect(err).toMatchObject({ failureKind: 'rate', statusCode: 429 })
    expect(mockFetch).toHaveBeenCalledTimes(2)
    const proof1 = (mockFetch.mock.calls[0] as [string, RequestInit])[1].headers as Record<
      string,
      string
    >
    const proof2 = (mockFetch.mock.calls[1] as [string, RequestInit])[1].headers as Record<
      string,
      string
    >
    expect(proof1['DPoP']).toMatch(/^[A-Za-z0-9_-]+\./)
    expect(proof2['DPoP']).toMatch(/^[A-Za-z0-9_-]+\./)
    expect(proof1['DPoP']).not.toBe(proof2['DPoP'])
  })

  it('429 后转 200 → 成功返回轮转凭据(2 次调用)', async () => {
    mockFetch
      .mockResolvedValueOnce(resp(429, { error: 'too many requests' }))
      .mockResolvedValueOnce(resp(200, refreshSuccessBody))
    const result = await codeartsAdapter.refreshToken!(makeCtx())
    expect(result?.token).toBe('sts-new')
    expect(mockFetch).toHaveBeenCalledTimes(2)
  })

  it('5xx → server,重试一次', async () => {
    mockFetch.mockResolvedValue(resp(503, 'Service Unavailable'))
    const err = await codeartsAdapter.refreshToken!(makeCtx()).catch((e) => e)
    expect(err).toMatchObject({ failureKind: 'server', statusCode: 503 })
    expect(mockFetch).toHaveBeenCalledTimes(2)
  })

  it('网络异常 → server(可重试),message 只带异常名', async () => {
    mockFetch.mockRejectedValue(new Error('socket hang up'))
    const err = await codeartsAdapter.refreshToken!(makeCtx()).catch((e) => e)
    expect(err).toMatchObject({ failureKind: 'server', statusCode: 0 })
    expect(err.message).toMatch(/网络异常/)
    expect(mockFetch).toHaveBeenCalledTimes(2)
  })

  it('invalid_grant → session_dead,不重试', async () => {
    mockFetch.mockResolvedValue(resp(400, { error: 'invalid_grant' }))
    const err = await codeartsAdapter.refreshToken!(makeCtx()).catch((e) => e)
    expect(err).toMatchObject({ failureKind: 'session_dead' })
    expect(mockFetch).toHaveBeenCalledTimes(1)
  })

  it('额度文案 → credit,不重试', async () => {
    mockFetch.mockResolvedValue(resp(400, { error_description: '积分已用尽' }))
    const err = await codeartsAdapter.refreshToken!(makeCtx()).catch((e) => e)
    expect(err).toMatchObject({ failureKind: 'credit' })
    expect(mockFetch).toHaveBeenCalledTimes(1)
  })

  it('HTML 登录墙(200 非 JSON)→ auth,解析失败不回落原文', async () => {
    mockFetch.mockResolvedValue(resp(200, '<!DOCTYPE html><html>Login</html>'))
    const err = await codeartsAdapter.refreshToken!(makeCtx()).catch((e) => e)
    expect(err).toMatchObject({ failureKind: 'auth', statusCode: 200 })
    expect(err.message).toMatch(/解析失败 HTTP 200/)
    expect(mockFetch).toHaveBeenCalledTimes(1)
  })
})
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
