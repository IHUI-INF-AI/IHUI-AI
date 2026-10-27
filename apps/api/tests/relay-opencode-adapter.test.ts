// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * OpenCode 适配器行为单测(2026-10-27 立;提取器部分同日迁 scripts/tests/opencode-auth-extract.test.mjs)。
 *
 * 迁移立因:架构契约门(门 103)判 D1/D2 —— apps/api(端应用)不得依赖
 * repo-tooling(scripts/),提取器测试的真家在 scripts/tests/(与 codearts/qoder/trae
 * 三个兄弟提取器同一布局)。本文件只留适配器行为。
 *
 * 覆盖点:
 * - isAuthFailure:401/403 + 凭证失效文案 / HTML 登录墙
 * - buildChatRequest:OpenAI 兼容透传 + Bearer
 * - translateStreamChunk / translateNonStream:透传 + error 帧识别
 * - checkHealth:2026-10-27 实弹实证 zen/v1/models 轻量端点(200 ok / 401 authFailed /
 *   其余未判定);getQuota:zen/v1/usage 实弹 404 不存在 ⇒ 如实未判定
 *
 * fetch 全打桩。
 */
import { describe, it, expect, vi, beforeEach } from 'vitest'
import type { AdapterAccountContext, StreamState } from '../src/services/relay-upstream-adapters.js'
import { opencodeAdapter } from '../src/services/upstream-adapters/opencode-adapter.js'

const mockFetch = vi.fn()
global.fetch = mockFetch as unknown as typeof fetch

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

describe('opencode checkHealth(2026-10-27 实弹:zen/v1/models 轻量端点)', () => {
  beforeEach(() => {
    mockFetch.mockReset()
  })

  it('请求面:GET zen/v1/models + Bearer', async () => {
    mockFetch.mockResolvedValue({ status: 200, ok: true, text: async () => '{"data":[]}' })
    const health = await opencodeAdapter.checkHealth(makeCtx())
    expect(health.ok).toBe(true)
    const [url, init] = mockFetch.mock.calls[0] as [string, RequestInit]
    expect(String(url)).toBe('https://opencode.ai/zen/v1/models')
    expect(init.method).toBe('GET')
    expect((init.headers as Record<string, string>)['authorization']).toBe('Bearer oc-key-test-1')
  })

  it('401 api_key_expired → authFailed(实弹结论:重登不续期,须 Console 新建 key)', async () => {
    mockFetch.mockResolvedValue({
      status: 401,
      ok: false,
      text: async () =>
        JSON.stringify({
          error: {
            type: 'authentication_error',
            code: 'api_key_expired',
            message: 'This API key has expired. Create a new API key in OpenCode Console.',
          },
        }),
    })
    const health = await opencodeAdapter.checkHealth(makeCtx())
    expect(health.ok).toBe(false)
    expect(health.authFailed).toBe(true)
    expect(health.indeterminate).toBeFalsy()
  })

  it('503 → indeterminate 未判定(临时故障不误杀好号)', async () => {
    mockFetch.mockResolvedValue({ status: 503, ok: false, text: async () => 'unavailable' })
    const health = await opencodeAdapter.checkHealth(makeCtx())
    expect(health.ok).toBe(false)
    expect(health.indeterminate).toBe(true)
    expect(health.authFailed).toBeFalsy()
  })

  it('网络异常 → indeterminate 未判定带原因', async () => {
    mockFetch.mockRejectedValue(new Error('socket hang up'))
    const health = await opencodeAdapter.checkHealth(makeCtx())
    expect(health.ok).toBe(false)
    expect(health.indeterminate).toBe(true)
    expect(health.error).toMatch(/socket hang up/)
  })
})

describe('opencode getQuota(实弹复核:zen/v1/usage 404 不存在 ⇒ 如实未判定)', () => {
  it('getQuota → ok:false 未判定,不发请求', async () => {
    const q = await opencodeAdapter.getQuota!(makeCtx())
    expect(q.ok).toBe(false)
    expect(q.quota).toBeUndefined()
    expect(q.authFailed).toBeUndefined()
    expect(q.error).toContain('无公开额度端点')
    expect(q.error).toContain('未判定')
  })
})
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
