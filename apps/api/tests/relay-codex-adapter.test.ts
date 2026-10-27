// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * Codex 适配器 + 提取器行为单测(2026-10-27 立)。
 *
 * 覆盖点:
 * - 提取器形状(有/无会话两态):auth.json raw 直通、指纹、keyring 模式真实出路文案、零回显
 * - isAuthFailure:401/403 + 凭证失效文案 / HTML 登录墙
 * - buildChatRequest:Responses API 形状、Bearer、store:false
 * - translateStreamChunk:output_text.delta / completed / error 帧;认不出的帧忽略
 * - checkHealth / getQuota:200 也未判定(形状未实证/无公开额度端点),401 → authFailed
 *
 * fetch 全部打桩,不发真实网络请求;提取器走临时目录,不碰本机真实 .codex。
 */
import { describe, it, expect, vi, beforeEach } from 'vitest'
import crypto from 'node:crypto'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import type { AdapterAccountContext, StreamState } from '../src/services/relay-upstream-adapters.js'
import { codexAdapter } from '../src/services/upstream-adapters/codex-adapter.js'
import { extractCodexAccounts, summarizeSession } from '../../../scripts/lib/codex-auth-extract.mjs'

const mockFetch = vi.fn()

function makeCtx(): AdapterAccountContext {
  return {
    row: { id: 'row-1', providerCode: 'codex', uid: 'u1', name: 'n' },
    credentials: {
      token: 'codex-access-token-test',
      refreshToken: 'codex-refresh-token-test',
      cookies: [],
      secrets: { accountId: 'acc-test-1' },
    },
  } as unknown as AdapterAccountContext
}

function makeTempCodexHome(files: Record<string, string>): string {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'ihui-codex-test-'))
  for (const [name, content] of Object.entries(files)) {
    fs.writeFileSync(path.join(dir, name), content, 'utf8')
  }
  return dir
}

const AUTH_JSON_FIXTURE = JSON.stringify({
  auth_mode: 'chatgpt',
  tokens: {
    id_token: 'id-token-test',
    access_token: 'codex-access-token-test',
    refresh_token: 'codex-refresh-token-test',
    account_id: 'acc-test-1',
  },
  last_refresh: '2026-10-27T00:00:00.000Z',
})

// =============================================================================
// 提取器:有/无会话两态
// =============================================================================

describe('codex 提取器 extractCodexAccounts', () => {
  it('有会话:tokens raw 直通 + 来源标记 + 指纹(sha256 前 12 位)', async () => {
    const home = makeTempCodexHome({ 'auth.json': AUTH_JSON_FIXTURE })
    const out = await extractCodexAccounts({ codexHome: home })
    expect(out.providerCode).toBe('codex')
    expect(out.accounts).toHaveLength(1)
    const acc = out.accounts[0]
    expect(acc.source).toBe('codex')
    expect(acc.authMode).toBe('chatgpt')
    // raw 直通(§0.6):tokens 对象键名零改动
    expect(acc.tokens).toEqual({
      id_token: 'id-token-test',
      access_token: 'codex-access-token-test',
      refresh_token: 'codex-refresh-token-test',
      account_id: 'acc-test-1',
    })
    expect(acc.lastRefresh).toBe('2026-10-27T00:00:00.000Z')
    expect(acc.fingerprint).toBe(
      crypto
        .createHash('sha256')
        .update('codex-access-token-test', 'utf8')
        .digest('hex')
        .slice(0, 12),
    )
  })

  it('meta 摘要零回显:不含任何 token 明文,只有布尔/长度/指纹', async () => {
    const home = makeTempCodexHome({ 'auth.json': AUTH_JSON_FIXTURE })
    const out = await extractCodexAccounts({ codexHome: home })
    const metaText = JSON.stringify(out.meta)
    expect(metaText).not.toContain('codex-access-token-test')
    expect(metaText).not.toContain('codex-refresh-token-test')
    expect(metaText).not.toContain('id-token-test')
    const s = summarizeSession(JSON.parse(AUTH_JSON_FIXTURE))
    expect(s.hasAccessToken).toBe(true)
    expect(s.hasRefreshToken).toBe(true)
    expect(s.tokenFingerprint).toHaveLength(12)
    expect(s.tokenLength).toBe('codex-access-token-test'.length)
  })

  it('无会话:目录缺 auth.json → CODEX_NO_SESSION(点名真实出路)', async () => {
    const home = makeTempCodexHome({})
    await expect(extractCodexAccounts({ codexHome: home })).rejects.toMatchObject({
      code: 'CODEX_NO_SESSION',
    })
  })

  it('无会话:keyring 模式 → CODEX_NO_SESSION + 凭据管理器真实出路文案', async () => {
    const home = makeTempCodexHome({
      'config.toml': 'cli_auth_credentials_store = "keyring"\nmodel = "gpt-5.1"\n',
    })
    const err = await extractCodexAccounts({ codexHome: home }).catch((e) => e)
    expect(err.code).toBe('CODEX_NO_SESSION')
    expect(err.message).toContain('keyring')
    expect(err.message).toContain('凭据管理器')
  })

  it('auth.json 解析失败 → CODEX_BAD_AUTH_JSON(未判定,不猜字段)', async () => {
    const home = makeTempCodexHome({ 'auth.json': '{not-json' })
    await expect(extractCodexAccounts({ codexHome: home })).rejects.toMatchObject({
      code: 'CODEX_BAD_AUTH_JSON',
    })
  })

  it('auth_mode 非 chatgpt(API key 登录)→ CODEX_NO_SESSION 点名原因', async () => {
    const home = makeTempCodexHome({
      'auth.json': JSON.stringify({ auth_mode: 'apikey', OPENAI_API_KEY: null }),
    })
    const err = await extractCodexAccounts({ codexHome: home }).catch((e) => e)
    expect(err.code).toBe('CODEX_NO_SESSION')
    expect(err.message).toContain('apikey')
  })

  it('缺 tokens.access_token → CODEX_BAD_AUTH_JSON(形状不符 ⇒ 未判定)', async () => {
    const home = makeTempCodexHome({
      'auth.json': JSON.stringify({ auth_mode: 'chatgpt', tokens: { account_id: 'x' } }),
    })
    await expect(extractCodexAccounts({ codexHome: home })).rejects.toMatchObject({
      code: 'CODEX_BAD_AUTH_JSON',
    })
  })
})

// =============================================================================
// 适配器
// =============================================================================

describe('codex isAuthFailure', () => {
  it('401/403 → true', () => {
    expect(codexAdapter.isAuthFailure(401, '')).toBe(true)
    expect(codexAdapter.isAuthFailure(403, '')).toBe(true)
  })

  it('HTTP 200 但体带凭证失效文案 / HTML 登录墙 → true', () => {
    expect(codexAdapter.isAuthFailure(200, '{"error":"invalid_token"}')).toBe(true)
    expect(codexAdapter.isAuthFailure(200, 'token has expired, please sign in')).toBe(true)
    expect(codexAdapter.isAuthFailure(200, '<html><body>Please login</body></html>')).toBe(true)
  })

  it('429 / 5xx / 普通参数错误 → false(走退避,不误触 401 自愈)', () => {
    expect(codexAdapter.isAuthFailure(429, 'rate limited')).toBe(false)
    expect(codexAdapter.isAuthFailure(500, 'internal error')).toBe(false)
    expect(codexAdapter.isAuthFailure(400, 'model not found')).toBe(false)
  })
})

describe('codex buildChatRequest(Responses API 形状)', () => {
  it('url/bearer/store:false/input 转写实,account-id 头齐备', () => {
    const http = codexAdapter.buildChatRequest(makeCtx(), {
      model: 'gpt-5.1',
      messages: [{ role: 'user', content: '你好' }],
      temperature: 0.5,
      maxTokens: 200,
      stream: true,
    })
    expect(http.url).toBe('https://chatgpt.com/backend-api/codex/responses')
    expect(http.method).toBe('POST')
    expect(http.headers['authorization']).toBe('Bearer codex-access-token-test')
    expect(http.headers['chatgpt-account-id']).toBe('acc-test-1')
    expect(http.headers['originator']).toBe('codex_cli_rs')
    const body = http.body as Record<string, unknown>
    expect(body['model']).toBe('gpt-5.1')
    expect(body['stream']).toBe(true)
    expect(body['store']).toBe(false)
    expect(body['temperature']).toBe(0.5)
    expect(body['max_output_tokens']).toBe(200)
    const input = body['input'] as Array<Record<string, unknown>>
    expect(input).toHaveLength(1)
    expect(input[0]['type']).toBe('message')
    expect(input[0]['role']).toBe('user')
    expect(input[0]['content']).toEqual([{ type: 'input_text', text: '你好' }])
  })
})

describe('codex translateStreamChunk / translateNonStream', () => {
  const ctx = makeCtx()
  const state: StreamState = {}

  it('response.output_text.delta → OpenAI delta 帧', () => {
    const out = codexAdapter.translateStreamChunk(
      ctx,
      JSON.stringify({ type: 'response.output_text.delta', delta: 'hi' }),
      state,
    )
    expect(out).not.toBeNull()
    const chunk = out?.openaiChunk as { choices: Array<{ delta: { content: string } }> }
    expect(chunk.choices[0].delta.content).toBe('hi')
  })

  it('response.completed → usage 终帧 done', () => {
    const out = codexAdapter.translateStreamChunk(
      ctx,
      JSON.stringify({
        type: 'response.completed',
        response: { usage: { input_tokens: 3, output_tokens: 5, total_tokens: 8 } },
      }),
      state,
    )
    expect(out?.done).toBe(true)
    expect((out?.openaiChunk as { usage?: unknown }).usage).toEqual({
      input_tokens: 3,
      output_tokens: 5,
      total_tokens: 8,
    })
  })

  it('error 帧 → done + error;[DONE]/非 JSON/认不出的帧 → null', () => {
    const err = codexAdapter.translateStreamChunk(
      ctx,
      JSON.stringify({ type: 'response.failed', error: { message: 'quota' } }),
      state,
    )
    expect(err?.done).toBe(true)
    expect(codexAdapter.translateStreamChunk(ctx, 'data: [DONE]', state)).toBeNull()
    expect(codexAdapter.translateStreamChunk(ctx, ': keep-alive', state)).toBeNull()
    expect(
      codexAdapter.translateStreamChunk(ctx, JSON.stringify({ type: 'ping' }), state),
    ).toBeNull()
  })

  it('translateNonStream:output[].content[].output_text 拼接;error 体抛错', () => {
    const body = {
      id: 'resp-1',
      model: 'gpt-5.1',
      output: [{ type: 'message', content: [{ type: 'output_text', text: '答案' }] }],
    }
    const out = codexAdapter.translateNonStream(ctx, body)
    const choices = out['choices'] as Array<{ message: { content: string } }>
    expect(choices[0].message.content).toBe('答案')
    expect(() => codexAdapter.translateNonStream(ctx, { error: { message: 'boom' } })).toThrow(
      /boom/,
    )
    expect(() => codexAdapter.translateNonStream(ctx, { nope: 1 })).toThrow(/未判定/)
  })
})

describe('codex checkHealth / getQuota(打桩 fetch;形状未实证 ⇒ 200 也未判定)', () => {
  beforeEach(() => {
    mockFetch.mockReset()
  })

  it('探测 401 → ok:false + authFailed', async () => {
    mockFetch.mockResolvedValue({
      status: 401,
      ok: false,
      text: async () => '{"error":"unauthorized"}',
    })
    const health = await codexAdapter.checkHealth(makeCtx(), {
      fetchImpl: mockFetch as unknown as typeof fetch,
    })
    expect(health.ok).toBe(false)
    expect(health.authFailed).toBe(true)
    const q = await codexAdapter.getQuota!(makeCtx(), {
      fetchImpl: mockFetch as unknown as typeof fetch,
    })
    expect(q.ok).toBe(false)
    expect(q.authFailed).toBe(true)
  })

  it('探测 200 → 未判定(身份/额度形状未实证,不冒绿)', async () => {
    mockFetch.mockResolvedValue({ status: 200, ok: true, text: async () => '{"id":"me-1"}' })
    const health = await codexAdapter.checkHealth(makeCtx(), {
      fetchImpl: mockFetch as unknown as typeof fetch,
    })
    expect(health.ok).toBe(false)
    expect(health.indeterminate).toBe(true)
    expect(health.error).toContain('未判定')
    const q = await codexAdapter.getQuota!(makeCtx(), {
      fetchImpl: mockFetch as unknown as typeof fetch,
    })
    expect(q.ok).toBe(false)
    expect(q.quota).toBeUndefined()
    expect(q.error).toContain('无公开额度端点')
    expect(q.error).toContain('未判定')
  })

  it('探测 5xx / 网络异常 → indeterminate(不写 down)', async () => {
    mockFetch.mockResolvedValue({ status: 503, ok: false, text: async () => 'boom' })
    const health = await codexAdapter.checkHealth(makeCtx(), {
      fetchImpl: mockFetch as unknown as typeof fetch,
    })
    expect(health.indeterminate).toBe(true)
    mockFetch.mockRejectedValue(new Error('socket hang up'))
    const q = await codexAdapter.getQuota!(makeCtx(), {
      fetchImpl: mockFetch as unknown as typeof fetch,
    })
    expect(q.ok).toBe(false)
    expect(q.authFailed).toBeUndefined()
  })

  it('请求面:GET 身份端点 + Bearer 头', async () => {
    mockFetch.mockResolvedValue({ status: 200, ok: true, text: async () => '{}' })
    await codexAdapter.checkHealth(makeCtx(), { fetchImpl: mockFetch as unknown as typeof fetch })
    const [url, init] = mockFetch.mock.calls[0] as [string, RequestInit]
    expect(url).toBe('https://chatgpt.com/backend-api/me')
    expect(init.method).toBe('GET')
    expect((init.headers as Record<string, string>)['authorization']).toBe(
      'Bearer codex-access-token-test',
    )
  })
})
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
