// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * OpenCode 适配器 + 提取器行为单测(2026-10-27 立)。
 *
 * 覆盖点:
 * - 提取器形状(有/无会话两态):OPENCODE_AUTH_CONTENT 优先、多 provider 数组形态、
 *   auth 对象 raw 直通、指纹、零回显
 * - isAuthFailure:401/403 + 凭证失效文案 / HTML 登录墙
 * - buildChatRequest:OpenAI 兼容透传 + Bearer
 * - translateStreamChunk / translateNonStream:透传 + error 帧识别
 * - checkHealth / getQuota:无已实证端点 ⇒ 如实未判定
 *
 * 提取器走注入(env/dataDir),不碰本机真实 auth.json。
 */
import { describe, it, expect } from 'vitest'
import crypto from 'node:crypto'
import type { AdapterAccountContext, StreamState } from '../src/services/relay-upstream-adapters.js'
import { opencodeAdapter } from '../src/services/upstream-adapters/opencode-adapter.js'
import {
  extractOpencodeAccounts,
  summarizeProvider,
} from '../../../scripts/lib/opencode-auth-extract.mjs'

function makeCtx(): AdapterAccountContext {
  return {
    row: { id: 'row-2', providerCode: 'opencode', uid: 'u1', name: 'n' },
    credentials: {
      token: 'oc-key-test-1',
      refreshToken: null,
      cookies: [],
      secrets: { providerID: 'opencode', authType: 'api' },
    },
  } as unknown as AdapterAccountContext
}

const AUTH_FIXTURE = JSON.stringify({
  opencode: { type: 'api', key: 'oc-key-test-1' },
  anthropic: {
    type: 'oauth',
    access: 'anthropic-access-token-test',
    refresh: 'anthropic-refresh-token-test',
    expires: 1795356026000,
    accountId: 'acc-ant-1',
  },
})

// =============================================================================
// 提取器:有/无会话两态
// =============================================================================

describe('opencode 提取器 extractOpencodeAccounts', () => {
  it('有会话:每 provider 一账号,auth raw 直通 + 来源标记 + 指纹', async () => {
    const out = await extractOpencodeAccounts({ authContent: AUTH_FIXTURE })
    expect(out.providerCode).toBe('opencode')
    expect(out.accounts).toHaveLength(2)
    const first = out.accounts.find((a) => a.providerID === 'opencode')
    const second = out.accounts.find((a) => a.providerID === 'anthropic')
    expect(first?.source).toBe('opencode')
    // raw 直通(§0.6):auth 对象键名零改动
    expect(first?.auth).toEqual({ type: 'api', key: 'oc-key-test-1' })
    expect(second?.auth).toMatchObject({ type: 'oauth', access: 'anthropic-access-token-test' })
    expect(first?.fingerprint).toBe(
      crypto.createHash('sha256').update('oc-key-test-1', 'utf8').digest('hex').slice(0, 12),
    )
    expect(second?.fingerprint).toBe(
      crypto
        .createHash('sha256')
        .update('anthropic-access-token-test', 'utf8')
        .digest('hex')
        .slice(0, 12),
    )
  })

  it('meta 摘要零回显:不含任何 token 明文', async () => {
    const out = await extractOpencodeAccounts({ authContent: AUTH_FIXTURE })
    const metaText = JSON.stringify(out.meta)
    expect(metaText).not.toContain('oc-key-test-1')
    expect(metaText).not.toContain('anthropic-access-token-test')
    expect(metaText).not.toContain('anthropic-refresh-token-test')
    const s = summarizeProvider('opencode', { type: 'api', key: 'oc-key-test-1' })
    expect(s.hasKey).toBe(true)
    expect(s.tokenFingerprint).toHaveLength(12)
  })

  it('无会话:无注入无文件 → OPENCODE_NO_SESSION(点名出路)', async () => {
    const err = await extractOpencodeAccounts({ env: {} }).catch((e) => e)
    expect(err.code).toBe('OPENCODE_NO_SESSION')
    expect(err.message).toContain('auth.json')
  })

  it('注入内容解析失败 → OPENCODE_BAD_AUTH_JSON(未判定,不猜字段)', async () => {
    await expect(extractOpencodeAccounts({ authContent: '{bad' })).rejects.toMatchObject({
      code: 'OPENCODE_BAD_AUTH_JSON',
    })
  })

  it('注入空对象 / 全键形状不符 → OPENCODE_NO_SESSION / OPENCODE_BAD_AUTH_JSON', async () => {
    await expect(extractOpencodeAccounts({ authContent: '{}' })).rejects.toMatchObject({
      code: 'OPENCODE_NO_SESSION',
    })
    await expect(extractOpencodeAccounts({ authContent: '{"a":1,"b":[2]}' })).rejects.toMatchObject(
      {
        code: 'OPENCODE_BAD_AUTH_JSON',
      },
    )
  })

  it('dataDir 显式注入时读该目录 auth.json(文件路径优先级在注入之后)', async () => {
    const out = await extractOpencodeAccounts({
      authContent: '',
      env: {},
      dataDir: undefined,
    }).catch((e) => e)
    // 空注入回落文件查找;无文件 ⇒ NO_SESSION(不为编造路径冒绿)
    expect(out.code).toBe('OPENCODE_NO_SESSION')
  })
})

// =============================================================================
// 适配器
// =============================================================================

describe('opencode isAuthFailure', () => {
  it('401/403 → true', () => {
    expect(opencodeAdapter.isAuthFailure(401, '')).toBe(true)
    expect(opencodeAdapter.isAuthFailure(403, '')).toBe(true)
  })

  it('HTTP 200 但体带凭证失效文案 / HTML 登录墙 → true', () => {
    expect(opencodeAdapter.isAuthFailure(200, '{"error":"invalid_api_key"}')).toBe(true)
    expect(opencodeAdapter.isAuthFailure(200, 'session expired')).toBe(true)
    expect(opencodeAdapter.isAuthFailure(200, '<html><body>Sign in</body></html>')).toBe(true)
  })

  it('429 / 5xx / 普通参数错误 → false(走退避,不误触 401 自愈)', () => {
    expect(opencodeAdapter.isAuthFailure(429, 'rate limited')).toBe(false)
    expect(opencodeAdapter.isAuthFailure(500, 'internal error')).toBe(false)
    expect(opencodeAdapter.isAuthFailure(400, 'model not found')).toBe(false)
  })
})

describe('opencode buildChatRequest(OpenAI 兼容透传)', () => {
  it('url/bearer/body 透传,stop 归一', () => {
    const http = opencodeAdapter.buildChatRequest(makeCtx(), {
      model: 'claude-sonnet-4',
      messages: [{ role: 'user', content: '你好' }],
      temperature: 0.7,
      maxTokens: 100,
      stream: true,
      stop: ['', 'END'],
    })
    expect(http.url).toBe('https://opencode.ai/zen/v1/chat/completions')
    expect(http.method).toBe('POST')
    expect(http.headers['authorization']).toBe('Bearer oc-key-test-1')
    const body = http.body as Record<string, unknown>
    expect(body['model']).toBe('claude-sonnet-4')
    expect(body['stream']).toBe(true)
    expect(body['temperature']).toBe(0.7)
    expect(body['max_tokens']).toBe(100)
    expect(body['stop']).toEqual(['END']) // 空串剔除
  })
})

describe('opencode translateStreamChunk / translateNonStream', () => {
  const ctx = makeCtx()
  const state: StreamState = {}

  it('OpenAI chunk 原样透传', () => {
    const frame = {
      id: 'chatcmpl-1',
      object: 'chat.completion.chunk',
      choices: [{ index: 0, delta: { content: 'hi' }, finish_reason: null }],
    }
    const out = opencodeAdapter.translateStreamChunk(ctx, JSON.stringify(frame), state)
    expect(out?.openaiChunk).toEqual(frame)
  })

  it('{"error"} 帧 → done + error;[DONE]/非 JSON → null', () => {
    const out = opencodeAdapter.translateStreamChunk(
      ctx,
      'data: ' + JSON.stringify({ error: { message: 'quota exhausted' } }),
      state,
    )
    expect(out?.done).toBe(true)
    expect((out?.openaiChunk['error'] as { message: string }).message).toBe('quota exhausted')
    expect(opencodeAdapter.translateStreamChunk(ctx, 'data: [DONE]', state)).toBeNull()
    expect(opencodeAdapter.translateStreamChunk(ctx, ': keep-alive', state)).toBeNull()
  })

  it('translateNonStream:正常透传;error 体抛错', () => {
    const body = { id: 'x', choices: [{ message: { content: 'hi' } }] }
    expect(opencodeAdapter.translateNonStream(makeCtx(), body)).toEqual(body)
    expect(() =>
      opencodeAdapter.translateNonStream(makeCtx(), { error: { message: 'bad key' } }),
    ).toThrow(/bad key/)
  })
})

describe('opencode checkHealth / getQuota(无已实证端点 ⇒ 如实未判定)', () => {
  it('checkHealth → indeterminate 未判定,不发请求', async () => {
    const health = await opencodeAdapter.checkHealth(makeCtx())
    expect(health.ok).toBe(false)
    expect(health.indeterminate).toBe(true)
    expect(health.error).toContain('未判定')
    expect(health.authFailed).toBeUndefined()
  })

  it('getQuota → ok:false 未判定(无公开额度端点),不发请求', async () => {
    const q = await opencodeAdapter.getQuota!(makeCtx())
    expect(q.ok).toBe(false)
    expect(q.quota).toBeUndefined()
    expect(q.authFailed).toBeUndefined()
    expect(q.error).toContain('无公开额度端点')
    expect(q.error).toContain('未判定')
  })
})
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
