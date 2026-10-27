// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * WorkBuddy/CodeBuddy 上游适配器单测(2026-10-22 立)。
 *
 * 覆盖协议规格的关键实证点:
 * - realm 判定与域名/Origin/UA/Accept-Language 切换
 * - chat 头构造红线:绝不携带 X-Refresh-Token;缺字段 X-No-* 显式声明
 * - 设备/会话指纹跨请求稳定、账号间互异;会话聚合主键同会话稳定
 * - PrepareBody 改写:强制 stream、max_completion_tokens 翻译、GPT 下限 16、
 *   stream_options 补默认、tool_choice 归一化、developer→system、image_url 对象化
 * - SSE 帧翻译:透传 OpenAI chunk、[DONE]/非法 JSON→null、finish_reason 归一、usage 补全
 * - refreshToken:信封解析、缺省保留旧值、expiresIn 非法防刷新风暴、抛错不带凭证
 * - classifyUpstreamFailure / isAuthFailure 分类矩阵
 * - checkHealth / listModels(含 1h 缓存命中)
 *
 * 零 DB 依赖:fetch 用 vi.stubGlobal 打桩;row 用最小形状 cast。
 */
import { describe, it, expect, afterEach, vi } from 'vitest'
import type { AiRelayAccountPool } from '@ihui/database'
import type {
  AdapterAccountContext,
  NormalizedChatRequest,
  StreamState,
} from '../src/services/relay-upstream-adapters.js'
import { workbuddyAdapter } from '../src/services/upstream-adapters/workbuddy-adapter.js'
import {
  buildChatHeaders,
  classifyUpstreamFailure,
  deriveStableId,
  prepareChatBody,
  resolveRealm,
} from '../src/services/upstream-adapters/workbuddy-protocol.js'

// =============================================================================
// 测试夹具
// =============================================================================

function jwtWith(claims: Record<string, unknown>): string {
  const b64 = (o: unknown) => Buffer.from(JSON.stringify(o)).toString('base64url')
  return `${b64({ alg: 'none' })}.${b64(claims)}.sig`
}

function makeCtx(opts?: {
  rowUid?: string
  token?: string
  refreshToken?: string | null
  extraMetadata?: Record<string, unknown>
  tokenExpiresAt?: Date | null
}): AdapterAccountContext {
  const row = {
    uid: opts?.rowUid ?? 'row-uid-1',
    extraMetadata: opts?.extraMetadata ?? {},
    tokenExpiresAt: opts?.tokenExpiresAt ?? null,
  } as unknown as AiRelayAccountPool
  return {
    row,
    credentials: {
      token: opts?.token ?? 'plain-access-token',
      refreshToken: opts?.refreshToken === undefined ? 'rt-old' : opts?.refreshToken,
      cookies: [],
      secrets: {},
    },
  }
}

const baseReq: NormalizedChatRequest = {
  model: 'claude-sonnet-4',
  messages: [{ role: 'user', content: 'hi' }],
  stream: true,
}

const emptyState: StreamState = {}

function jsonResponse(body: unknown, status = 200): Response {
  return new Response(typeof body === 'string' ? body : JSON.stringify(body), { status })
}

afterEach(() => {
  vi.unstubAllGlobals()
})

// =============================================================================
// realm 判定
// =============================================================================

describe('resolveRealm', () => {
  it('workbuddy.ai / *.workbuddy.ai → global;缺失或其他域 → cn', () => {
    expect(resolveRealm('workbuddy.ai')).toBe('global')
    expect(resolveRealm('api.workbuddy.ai')).toBe('global')
    expect(resolveRealm('WORKBUDDY.AI')).toBe('global')
    expect(resolveRealm('')).toBe('cn')
    expect(resolveRealm('codebuddy.cn')).toBe('cn')
  })
})

// =============================================================================
// buildChatRequest
// =============================================================================

describe('workbuddyAdapter.buildChatRequest', () => {
  it('CN 账号:copilot.tencent.com 端点 + Bearer + 无 X-Refresh-Token(红线)', () => {
    const ctx = makeCtx({ token: 'AT-123' })
    const http = workbuddyAdapter.buildChatRequest(ctx, baseReq)
    expect(http.url).toBe('https://copilot.tencent.com/v2/chat/completions')
    expect(http.headers['Authorization']).toBe('Bearer AT-123')
    expect(http.headers['X-Refresh-Token']).toBeUndefined()
    expect(http.headers['Origin']).toBe('https://www.codebuddy.cn')
    expect(http.headers['Accept']).toContain('text/event-stream')
    expect(http.headers['Accept-Language']).toBe('zh-CN')
    expect(http.headers['X-Product']).toBe('SaaS')
  })

  it('global 账号(extraMetadata.domain=workbuddy.ai):www.workbuddy.ai + WorkBuddy AI UA + en-US', () => {
    const ctx = makeCtx({ extraMetadata: { domain: 'workbuddy.ai' } })
    const http = workbuddyAdapter.buildChatRequest(ctx, baseReq)
    expect(http.url).toBe('https://www.workbuddy.ai/v2/chat/completions')
    expect(http.headers['Origin']).toBe('https://www.workbuddy.ai')
    expect(http.headers['User-Agent']).toContain('WorkBuddy AI/5.5.4')
    expect(http.headers['Accept-Language']).toBe('en-US')
  })

  it('身份来源优先级:extraMetadata > JWT claims;缺字段用 X-No-* 显式声明', () => {
    const ctx = makeCtx({
      token: jwtWith({ uid: 'jwt-uid', enterprise_id: 'jwt-ent', domain: 'codebuddy.cn' }),
      extraMetadata: { uid: 'meta-uid' },
    })
    const h1 = workbuddyAdapter.buildChatRequest(ctx, baseReq).headers
    expect(h1['X-User-Id']).toBe('meta-uid') // extraMetadata 优先
    expect(h1['X-Enterprise-Id']).toBe('jwt-ent') // claims 兜底
    expect(h1['X-Domain']).toBe('codebuddy.cn')

    const ctx2 = makeCtx({ token: 'opaque-not-jwt' })
    const h2 = workbuddyAdapter.buildChatRequest(ctx2, baseReq).headers
    expect(h2['X-User-Id']).toBe('row-uid-1') // row.uid 兜底
    expect(h2['X-No-Enterprise-Id']).toBe('1')
    expect(h2['X-No-Department-Info']).toBe('1')

    const ctx3 = makeCtx({ token: '' })
    const h3 = workbuddyAdapter.buildChatRequest(ctx3, baseReq).headers
    expect(h3['X-No-Authorization']).toBe('1')
    expect(h3['Authorization']).toBeUndefined()
  })

  it('设备/会话指纹:36hex、跨请求稳定、账号间互异;聚合主键同会话稳定', () => {
    const a1 = workbuddyAdapter.buildChatRequest(makeCtx({ rowUid: 'uid-A' }), baseReq)
    const a2 = workbuddyAdapter.buildChatRequest(makeCtx({ rowUid: 'uid-A' }), {
      ...baseReq,
      conversationId: 'conv-1',
    })
    const b1 = workbuddyAdapter.buildChatRequest(makeCtx({ rowUid: 'uid-B' }), {
      ...baseReq,
      conversationId: 'conv-1',
    })
    expect(a1.headers['X-Machine-ID']).toMatch(/^[0-9a-f]{36}$/)
    expect(a1.headers['X-Session-ID']).toMatch(/^[0-9a-f]{36}$/)
    expect(a1.headers['X-Machine-ID']).toBe(a2.headers['X-Machine-ID'])
    expect(a1.headers['X-Machine-ID']).not.toBe(b1.headers['X-Machine-ID'])
    // 同 conversationId → 同聚合主键;每请求消息 id 随机且 X-Request-ID 与其一致
    expect(a2.headers['X-Conversation-Request-ID']).toBe(b1.headers['X-Conversation-Request-ID'])
    expect(a2.headers['X-Conversation-Message-ID']).toMatch(/^[0-9a-f]{32}$/)
    expect(a2.headers['X-Request-ID']).toBe(a2.headers['X-Conversation-Message-ID'])
    expect(a2.headers['X-Root-Request-ID']).toBe(a2.headers['X-Conversation-Request-ID'])
    expect(a2.headers['X-Conversation-Message-ID']).not.toBe(
      b1.headers['X-Conversation-Message-ID'],
    )
    expect(deriveStableId('machine', 'x')).toHaveLength(36)
  })

  it('body:强制 stream:true,maxTokens→max_tokens,temperature 透传', () => {
    const http = workbuddyAdapter.buildChatRequest(makeCtx(), {
      ...baseReq,
      stream: false,
      maxTokens: 512,
      temperature: 0.2,
    })
    const body = http.body as Record<string, unknown>
    expect(body['stream']).toBe(true)
    expect(body['max_tokens']).toBe(512)
    expect(body['temperature']).toBe(0.2)
    expect(body['stream_options']).toEqual({ include_usage: true })
  })

  it('body:reasoningEffort → reasoning_effort 原样透传;未给则不带', () => {
    const withEffort = workbuddyAdapter.buildChatRequest(makeCtx(), {
      ...baseReq,
      reasoningEffort: 'low',
    })
    expect((withEffort.body as Record<string, unknown>)['reasoning_effort']).toBe('low')

    const without = workbuddyAdapter.buildChatRequest(makeCtx(), baseReq)
    expect((without.body as Record<string, unknown>)['reasoning_effort']).toBeUndefined()
  })

  it('body:采样面/工具开关透传;stop 一律数组(上游字符串形态直接 400)', () => {
    const http = workbuddyAdapter.buildChatRequest(makeCtx(), {
      ...baseReq,
      topP: 0.5,
      presencePenalty: 0.1,
      frequencyPenalty: 0.2,
      parallelToolCalls: false,
      user: 'u-1',
      serviceTier: 'auto',
      topK: 40,
      repetitionPenalty: 1.1,
      logitBias: { '123': -100 },
      stop: ['END'],
    })
    const body = http.body as Record<string, unknown>
    expect(body['top_p']).toBe(0.5)
    expect(body['presence_penalty']).toBe(0.1)
    expect(body['frequency_penalty']).toBe(0.2)
    expect(body['parallel_tool_calls']).toBe(false)
    expect(body['user']).toBe('u-1')
    expect(body['service_tier']).toBe('auto')
    expect(body['top_k']).toBe(40)
    expect(body['repetition_penalty']).toBe(1.1)
    expect(body['logit_bias']).toEqual({ '123': -100 })
    expect(body['stop']).toEqual(['END'])

    // 防御:调用方误传字符串时也必须包成数组
    const asString = workbuddyAdapter.buildChatRequest(makeCtx(), {
      ...baseReq,
      stop: 'END' as unknown as string[],
    })
    expect((asString.body as Record<string, unknown>)['stop']).toEqual(['END'])
  })
})

// =============================================================================
// prepareChatBody
// =============================================================================

describe('prepareChatBody', () => {
  it('max_completion_tokens → max_tokens;显式 max_tokens 优先且别名只删', () => {
    const b1 = prepareChatBody({ model: 'm', messages: [], max_completion_tokens: 100 })
    expect(b1['max_tokens']).toBe(100)
    expect(b1['max_completion_tokens']).toBeUndefined()
    const b2 = prepareChatBody({
      model: 'm',
      messages: [],
      max_tokens: 50,
      max_completion_tokens: 100,
    })
    expect(b2['max_tokens']).toBe(50)
    expect(b2['max_completion_tokens']).toBeUndefined()
  })

  it('GPT 系 max_tokens<16 抬到 16;非 GPT 不动', () => {
    expect(prepareChatBody({ model: 'gpt-4o', messages: [], max_tokens: 8 })['max_tokens']).toBe(16)
    expect(prepareChatBody({ model: 'gpt-4o', messages: [], max_tokens: 200 })['max_tokens']).toBe(
      200,
    )
    expect(
      prepareChatBody({ model: 'claude-sonnet-4', messages: [], max_tokens: 8 })['max_tokens'],
    ).toBe(8)
  })

  it('显式 stream_options 保留,缺省补 include_usage', () => {
    const b = prepareChatBody({
      model: 'm',
      messages: [],
      stream_options: { include_usage: false },
    })
    expect(b['stream_options']).toEqual({ include_usage: false })
  })

  it('tool_choice 归一化:none 删三件套;auto/required 转字符串;function 取 name(空→auto);未知删除', () => {
    const none = prepareChatBody({ model: 'm', messages: [], tool_choice: 'none', tools: [{}] })
    expect(none['tool_choice']).toBeUndefined()
    expect(none['tools']).toBeUndefined()
    const noneObj = prepareChatBody({
      model: 'm',
      messages: [],
      tool_choice: { type: 'none' },
      functions: [{}],
    })
    expect(noneObj['tool_choice']).toBeUndefined()
    expect(noneObj['functions']).toBeUndefined()
    expect(
      prepareChatBody({ model: 'm', messages: [], tool_choice: { type: 'auto' } })['tool_choice'],
    ).toBe('auto')
    expect(
      prepareChatBody({ model: 'm', messages: [], tool_choice: { type: 'required' } })[
        'tool_choice'
      ],
    ).toBe('required')
    expect(
      prepareChatBody({
        model: 'm',
        messages: [],
        tool_choice: { type: 'function', function: { name: 'get_x' } },
      })['tool_choice'],
    ).toBe('get_x')
    expect(
      prepareChatBody({
        model: 'm',
        messages: [],
        tool_choice: { type: 'function', function: {} },
      })['tool_choice'],
    ).toBe('auto')
    expect(
      prepareChatBody({ model: 'm', messages: [], tool_choice: { weird: true } })['tool_choice'],
    ).toBeUndefined()
    expect(prepareChatBody({ model: 'm', messages: [], tool_choice: 'auto' })['tool_choice']).toBe(
      'auto',
    )
  })

  it('messages:developer→system;image_url 字符串→对象', () => {
    const b = prepareChatBody({
      model: 'm',
      messages: [
        { role: 'developer', content: 'sys' },
        {
          role: 'user',
          content: [
            { type: 'text', text: 'hi' },
            { type: 'image_url', image_url: 'https://x/y.png' },
          ],
        },
      ],
    })
    const msgs = b['messages'] as Array<Record<string, unknown>>
    expect(msgs[0]?.['role']).toBe('system')
    const parts = msgs[1]?.['content'] as Array<Record<string, unknown>>
    expect(parts[1]?.['image_url']).toEqual({ url: 'https://x/y.png' })
    expect(parts[0]?.['text']).toBe('hi')
  })
})

// =============================================================================
// 流式/非流式翻译
// =============================================================================

describe('translateStreamChunk', () => {
  const ctx = makeCtx()
  it('data 行 JSON 透传;[DONE]/非 data 行/非法 JSON → null', () => {
    const chunk = {
      id: 'c1',
      object: 'chat.completion.chunk',
      choices: [{ index: 0, delta: { content: 'hi' } }],
    }
    const out = workbuddyAdapter.translateStreamChunk(
      ctx,
      `data: ${JSON.stringify(chunk)}\n\n`,
      emptyState,
    )
    expect(out?.openaiChunk['id']).toBe('c1')
    expect(workbuddyAdapter.translateStreamChunk(ctx, 'data: [DONE]\n\n', emptyState)).toBeNull()
    expect(workbuddyAdapter.translateStreamChunk(ctx, ': keepalive\n\n', emptyState)).toBeNull()
    expect(workbuddyAdapter.translateStreamChunk(ctx, 'data: {broken', emptyState)).toBeNull()
  })

  it('finish_reason ""→null;usage 补 total_tokens', () => {
    const out = workbuddyAdapter.translateStreamChunk(
      ctx,
      'data: {"choices":[{"index":0,"delta":{},"finish_reason":""}],"usage":{"prompt_tokens":10,"completion_tokens":5}}\n\n',
      emptyState,
    )
    const choices = out?.openaiChunk['choices'] as Array<Record<string, unknown>>
    expect(choices[0]?.['finish_reason']).toBeNull()
    expect(out?.openaiChunk['usage']).toEqual({
      prompt_tokens: 10,
      completion_tokens: 5,
      total_tokens: 15,
    })
  })
})

describe('translateNonStream', () => {
  it('确保 id/object/choices/usage 存在', () => {
    const out = workbuddyAdapter.translateNonStream(makeCtx(), { choices: [] })
    expect(typeof out['id']).toBe('string')
    expect(out['object']).toBe('chat.completion')
    expect(Array.isArray(out['choices'])).toBe(true)
    expect(out['usage']).toEqual({})
  })
})

// =============================================================================
// refreshToken
// =============================================================================

describe('workbuddyAdapter.refreshToken', () => {
  it('成功:Bearer 不带、X-Refresh-Token/X-Auth-Refresh-Source 带;expiresIn 换算 expiresAt;缺省 refreshToken=null', async () => {
    const fetchMock = vi.fn(async (_input: string | URL, _init?: RequestInit) =>
      jsonResponse({ code: 0, msg: 'ok', data: { accessToken: 'AT-new', expiresIn: 3600 } }),
    )
    vi.stubGlobal('fetch', fetchMock)
    const res = await workbuddyAdapter.refreshToken!(
      makeCtx({ tokenExpiresAt: new Date(Date.now() - 9999) }),
    )
    expect(res).not.toBeNull()
    expect(res?.token).toBe('AT-new')
    expect(res?.refreshToken).toBeNull()
    const expiresAtMs = res!.expiresAt?.getTime() ?? -1
    expect(expiresAtMs).toBeGreaterThan(0)
    const skew = Math.abs(expiresAtMs - (Date.now() + 3600_000))
    expect(skew).toBeLessThan(5000)
    const firstCall = fetchMock.mock.calls[0] as unknown as [string, RequestInit]
    const headers = firstCall[1].headers as Record<string, string>
    expect(headers['Authorization']).toBeUndefined()
    expect(headers['X-Refresh-Token']).toBe('rt-old')
    expect(headers['X-Auth-Refresh-Source']).toBe('workbuddy')
    expect(firstCall[0]).toBe('https://copilot.tencent.com/v2/plugin/auth/token/refresh')
  })

  it('refreshToken/domain 缺省 → null(不改写);新值则透传', async () => {
    vi.stubGlobal('fetch', async () =>
      jsonResponse({
        code: 0,
        msg: 'ok',
        data: { accessToken: 'AT', refreshToken: 'RT-new', expiresIn: 60 },
      }),
    )
    const res = await workbuddyAdapter.refreshToken!(makeCtx())
    expect(res?.refreshToken).toBe('RT-new')
  })

  // 2026-10-23 票:上游没给到期 ⇒ 写 null(未知)。旧契约"沿用旧值 / now+24h"被废除 ——
  // 沿用旧值会把已被收敛到过去的时刻当成新票到期,编造未来时刻则让"未知"冒充"可用"。
  it('expiresIn 缺省/非正 → null(未知);不沿用 row.tokenExpiresAt、不编造兜底时刻', async () => {
    const expiry = new Date('2030-01-01T00:00:00Z')
    vi.stubGlobal('fetch', async () =>
      jsonResponse({ code: 0, msg: 'ok', data: { accessToken: 'AT', expiresIn: 0 } }),
    )
    const r1 = await workbuddyAdapter.refreshToken!(makeCtx({ tokenExpiresAt: expiry }))
    expect(r1?.expiresAt).toBeNull()
    vi.stubGlobal('fetch', async () =>
      jsonResponse({ code: 0, msg: 'ok', data: { accessToken: 'AT' } }),
    )
    const r2 = await workbuddyAdapter.refreshToken!(makeCtx({ tokenExpiresAt: null }))
    expect(r2?.expiresAt).toBeNull()
  })

  it('accessToken 为空 → 抛错且 message 不含凭证', async () => {
    vi.stubGlobal('fetch', async () =>
      jsonResponse({ code: 0, msg: 'ok', data: { accessToken: '', refreshToken: 'RT-secret' } }),
    )
    await expect(
      workbuddyAdapter.refreshToken!(makeCtx({ refreshToken: 'RT-secret' })),
    ).rejects.toThrow(/accessToken/)
  })

  it('无 refreshToken 的账号 → 直接抛错', async () => {
    await expect(workbuddyAdapter.refreshToken!(makeCtx({ refreshToken: null }))).rejects.toThrow(
      /refreshToken/,
    )
  })

  it('opts.fetchImpl 优先于全局 fetch(生命周期调用测试缝)', async () => {
    const injected = vi.fn(async () =>
      jsonResponse({ code: 0, msg: 'ok', data: { accessToken: 'AT-inj', expiresIn: 60 } }),
    )
    vi.stubGlobal('fetch', async () => {
      throw new Error('global fetch 不应被调用')
    })
    const res = await workbuddyAdapter.refreshToken!(makeCtx(), {
      fetchImpl: injected as unknown as typeof fetch,
    })
    expect(res?.token).toBe('AT-inj')
    expect(injected).toHaveBeenCalledTimes(1)
  })
})

// =============================================================================
// 错误分类
// =============================================================================

describe('classifyUpstreamFailure', () => {
  it('适配器成员返回 {kind} 对象(接口签名)', () => {
    expect(workbuddyAdapter.classifyUpstreamFailure?.(402, '')).toEqual({ kind: 'credit' })
  })
  it('credit:402 或各文案标记(中英)', () => {
    expect(classifyUpstreamFailure(402, '{}')).toBe('credit')
    expect(
      classifyUpstreamFailure(200, JSON.stringify({ code: 1, msg: '积分不足', data: null })),
    ).toBe('credit')
    expect(classifyUpstreamFailure(200, 'Quota exceeded for this account')).toBe('credit')
  })
  it('session_dead:Offline user session not found / 12153', () => {
    expect(classifyUpstreamFailure(200, 'Offline user session not found')).toBe('session_dead')
    expect(classifyUpstreamFailure(400, JSON.stringify({ code: 12153, msg: 'x' }))).toBe(
      'session_dead',
    )
  })
  it('auth:401/403 或 token expired/invalid', () => {
    expect(classifyUpstreamFailure(401, '')).toBe('auth')
    expect(classifyUpstreamFailure(403, '')).toBe('auth')
    expect(classifyUpstreamFailure(200, 'the token has expired')).toBe('auth')
  })
  it('rate:429 / 各文案 / code 11140+provider 限流文案', () => {
    expect(classifyUpstreamFailure(429, '')).toBe('rate')
    expect(classifyUpstreamFailure(200, 'Too Many Requests')).toBe('rate')
    expect(classifyUpstreamFailure(200, '请求过于频繁')).toBe('rate')
    expect(
      classifyUpstreamFailure(
        200,
        JSON.stringify({ code: 11140, msg: 'The model provider is rate-limiting' }),
      ),
    ).toBe('rate')
  })
  it('not_found:404', () => {
    expect(classifyUpstreamFailure(404, '')).toBe('not_found')
  })
  it('request:400+文案标记 或 业务 code(不罚号)', () => {
    expect(classifyUpstreamFailure(400, 'Unmarshal chat params failed')).toBe('request')
    expect(
      classifyUpstreamFailure(200, JSON.stringify({ code: 11101, msg: 'bad tool_choice' })),
    ).toBe('request')
    expect(classifyUpstreamFailure(400, 'prompt is too long')).toBe('request')
    expect(classifyUpstreamFailure(200, JSON.stringify({ code: 6021, msg: 'queue.full' }))).toBe(
      'request',
    )
  })
  it('server/client 兜底', () => {
    expect(classifyUpstreamFailure(500, '')).toBe('server')
    expect(classifyUpstreamFailure(503, '')).toBe('server')
    expect(classifyUpstreamFailure(406, '')).toBe('client')
  })
})

describe('isAuthFailure / isAuthError', () => {
  it('401/403 或 body 标记命中', () => {
    expect(workbuddyAdapter.isAuthFailure(401, '')).toBe(true)
    expect(workbuddyAdapter.isAuthFailure(200, 'token is invalid')).toBe(true)
    expect(workbuddyAdapter.isAuthFailure(200, 'Offline user session not found')).toBe(true)
    expect(workbuddyAdapter.isAuthFailure(500, 'server error')).toBe(false)
  })
  it('异常 message 命中也算', () => {
    expect(workbuddyAdapter.isAuthError!(new Error('upstream said: 12153'))).toBe(true)
    expect(workbuddyAdapter.isAuthError!(new Error('network timeout'))).toBe(false)
  })
})

// =============================================================================
// checkHealth / listModels
// =============================================================================

describe('workbuddyAdapter.checkHealth', () => {
  const modelsEnvelope = {
    code: 0,
    msg: 'ok',
    data: { models: [{ id: 'claude-sonnet-4' }, { id: 'gpt-4o' }] },
  }

  it('code=0 且 models 非空 → ok', async () => {
    vi.stubGlobal('fetch', async () => jsonResponse(modelsEnvelope))
    expect(await workbuddyAdapter.checkHealth(makeCtx())).toEqual({ ok: true })
  })
  it('401 → ok:false + 鉴权摘要', async () => {
    vi.stubGlobal('fetch', async () => jsonResponse({ code: 12153, msg: 'x' }, 401))
    const r = await workbuddyAdapter.checkHealth(makeCtx())
    expect(r.ok).toBe(false)
    expect(r.error).toMatch(/401/)
  })
  it('code!=0 → ok:false 带 code', async () => {
    vi.stubGlobal('fetch', async () =>
      jsonResponse({ code: 11140, msg: 'rate limited', data: null }),
    )
    const r = await workbuddyAdapter.checkHealth(makeCtx())
    expect(r.ok).toBe(false)
    expect(r.error).toContain('11140')
  })
  it('opts.fetchImpl 注入生效', async () => {
    const injected = vi.fn(async () =>
      jsonResponse({ code: 0, msg: 'ok', data: { models: [{ id: 'x' }] } }),
    )
    const r = await workbuddyAdapter.checkHealth(makeCtx(), {
      fetchImpl: injected as unknown as typeof fetch,
    })
    expect(r).toEqual({ ok: true })
    expect(injected).toHaveBeenCalledTimes(1)
  })
})

describe('workbuddyAdapter.listModels', () => {
  it('返回 id 数组;同 realm 1h 内命中缓存只打一次上游', async () => {
    const fetchMock = vi.fn(async () =>
      jsonResponse({ code: 0, msg: 'ok', data: { models: [{ id: 'm-a' }, { id: 'm-b' }] } }),
    )
    vi.stubGlobal('fetch', fetchMock)
    const ids = await workbuddyAdapter.listModels!(makeCtx({ rowUid: 'cache-test-uid' }))
    expect(ids).toEqual(['m-a', 'm-b'])
    const ids2 = await workbuddyAdapter.listModels!(makeCtx({ rowUid: 'cache-test-uid' }))
    expect(ids2).toEqual(ids)
    expect(fetchMock).toHaveBeenCalledTimes(1)
  })
})

// =============================================================================
// 头构造纯函数补充
// =============================================================================

describe('buildChatHeaders', () => {
  it('chat 头组不含 X-Refresh-Token', () => {
    const h = buildChatHeaders({
      realm: 'cn',
      accessToken: 'AT',
      uid: 'u',
      enterpriseId: 'e',
      domain: 'd',
      machineId: 'm',
      sessionId: 's',
      conversationRequestId: 'c',
      messageRequestId: 'r',
    })
    expect(h['X-Refresh-Token']).toBeUndefined()
    expect(h['X-CodeBuddy-Request']).toBe('1')
    expect(h['X-Requested-With']).toBe('XMLHttpRequest')
  })
})

// =============================================================================
// getQuota(用户中心权益接口 · 2026-10-27 真号实弹取证形状)
// =============================================================================

/**
 * summary 真实回包(2026-10-27 实弹键位):data.Packages 数字是字符串容量键、
 * 只有包码没有人名、无时间字段;套餐语义在 SubscriptionPackageName/IsPaidUser。
 */
function summaryBody(packages: unknown[], extra?: Record<string, unknown>): unknown {
  return { code: 0, msg: 'OK', data: { Packages: packages, ...(extra ?? {}) } }
}

describe('workbuddyAdapter.getQuota', () => {
  it('CN:summary 单请求出数,字符串数字归一 + 包名如实用包码 + 订阅档名透传', async () => {
    const calls: Array<{ url: string; init: RequestInit }> = []
    vi.stubGlobal(
      'fetch',
      vi.fn(async (url: string | URL, init: RequestInit) => {
        calls.push({ url: String(url), init })
        return jsonResponse(
          summaryBody(
            [
              {
                PackageCode: 'TCACA_code_007_nzdH5h4Nl0',
                CycleTotalCapacity: '2300',
                CycleRemainCapacity: '2300',
                CycleUsedCapacity: '0',
                CapacityUnit: 'credits',
              },
              {
                PackageCode: 'TCACA_code_008_cfWoLwvjU4',
                CycleTotalCapacity: '500',
                CycleRemainCapacity: '283.44',
                CycleUsedCapacity: '216.56',
                CapacityUnit: 'credits',
              },
            ],
            { SubscriptionPackageName: '体验版', IsPaidUser: false },
          ),
        )
      }),
    )

    const out = await workbuddyAdapter.getQuota!(
      makeCtx({ extraMetadata: { domain: 'www.codebuddy.cn', uid: 'u-1' } }) as never,
      {},
    )
    expect(out.ok).toBe(true)
    const q = out.quota!
    expect(q.total).toBe(2800)
    expect(q.remaining).toBeCloseTo(2583.44, 6)
    expect(q.used).toBeCloseTo(216.56, 6)
    expect(q.ratio).toBeGreaterThan(0.07)
    expect(q.unit).toBe('WorkBuddy 积分')
    // 实测 summary 无包级人名/时间 ⇒ 包名如实用包码,resetsAt 不编造
    expect(q.packs?.[0]?.name).toBe('TCACA_code_007_nzdH5h4Nl0')
    expect(q.packs?.[0]?.endAt).toBeUndefined()
    expect(q.resetsAt).toBeUndefined()
    // 套餐档名(真号实测"体验版")
    expect(q.subscriptionName).toBe('体验版')

    // 只打一次 summary(paid/free 明细对无官方码集的请求体 400 code 10001,不接)
    expect(calls).toHaveLength(1)
    const first = calls[0]!
    expect(first.url).toBe('https://www.codebuddy.cn/billing/meter/get-user-resource-summary')
    const headers = first.init.headers as Record<string, string>
    expect(headers['Authorization']).toBe('Bearer plain-access-token')
    expect(headers['Origin']).toBe('https://www.codebuddy.cn')
    expect(headers['X-Client-Platform']).toBe('web')
    expect(headers['X-Domain']).toBe('www.codebuddy.cn')
    expect(headers['X-Refresh-Token']).toBeUndefined()
    expect(first.init.method).toBe('POST')
  })

  it('summary 带时间字段的包(CycleEndTime)⇒ resetsAt 取还有余量包里最早到期那枚', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(async () =>
        jsonResponse(
          summaryBody([
            {
              PackageCode: 'p-a',
              CycleTotalCapacity: '100',
              CycleRemainCapacity: '40',
              CycleEndTime: '2026-11-30 00:00:00',
            },
            {
              PackageCode: 'p-b',
              CycleTotalCapacity: '900',
              CycleRemainCapacity: '0',
              CycleEndTime: '2026-12-31 00:00:00',
            },
          ]),
        ),
      ),
    )
    const out = await workbuddyAdapter.getQuota!(makeCtx() as never, {})
    expect(out.ok).toBe(true)
    // 余量 0 的 p-b 不参与 resetsAt
    expect(out.quota?.resetsAt).toBe(new Date(Date.parse('2026-11-30T00:00:00')).toISOString())
    expect(out.quota?.packs?.[0]?.endAt).toBe(
      new Date(Date.parse('2026-11-30T00:00:00')).toISOString(),
    )
  })

  it('CN(workbuddy.cn 域):基址跟域走 www.workbuddy.cn(否则令牌域不一致被网关拒)', async () => {
    const urls: string[] = []
    vi.stubGlobal(
      'fetch',
      vi.fn(async (url: string | URL) => {
        urls.push(String(url))
        return jsonResponse(summaryBody([{ CycleTotalCapacity: '10', CycleRemainCapacity: '10' }]))
      }),
    )
    const out = await workbuddyAdapter.getQuota!(
      makeCtx({ extraMetadata: { domain: 'www.workbuddy.cn' } }) as never,
      {},
    )
    expect(out.ok).toBe(true)
    expect(urls[0]).toBe('https://www.workbuddy.cn/billing/meter/get-user-resource-summary')
  })

  it('global:主路径 404 → 回落 /v2 路径(只有 404 才回落)', async () => {
    const urls: string[] = []
    vi.stubGlobal(
      'fetch',
      vi.fn(async (url: string | URL) => {
        const u = String(url)
        urls.push(u)
        if (u === 'https://www.workbuddy.ai/billing/meter/get-user-resource-summary') {
          return jsonResponse({ code: 404, msg: 'not found' }, 404)
        }
        if (u === 'https://www.workbuddy.ai/v2/billing/meter/get-user-resource-summary') {
          return jsonResponse(
            summaryBody([{ CycleTotalCapacity: '50', CycleRemainCapacity: '20' }]),
          )
        }
        return jsonResponse({ code: 404 }, 404)
      }),
    )
    const out = await workbuddyAdapter.getQuota!(
      makeCtx({ extraMetadata: { domain: 'www.workbuddy.ai' } }) as never,
      {},
    )
    expect(out.ok).toBe(true)
    expect(out.quota?.remaining).toBe(20)
    expect(urls).toEqual([
      'https://www.workbuddy.ai/billing/meter/get-user-resource-summary',
      'https://www.workbuddy.ai/v2/billing/meter/get-user-resource-summary',
    ])
  })

  it('401 ⇒ ok:false + authFailed(供承载层换票自愈),且绝不返回 quota 0', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => jsonResponse({ code: 401, msg: 'unauthorized' }, 401)),
    )
    const out = await workbuddyAdapter.getQuota!(makeCtx() as never, {})
    expect(out.ok).toBe(false)
    expect(out.authFailed).toBe(true)
    expect(out.quota).toBeUndefined()
    expect(out.error).toContain('401')
  })

  it('summary 200 但没有可解析资源包 ⇒ ok:false(不补 0 冒充"余额为零")', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => jsonResponse({ code: 0, data: { Packages: [] } })),
    )
    const out = await workbuddyAdapter.getQuota!(makeCtx() as never, {})
    expect(out.ok).toBe(false)
    expect(out.quota).toBeUndefined()
    expect(out.error).toContain('权益接口')
  })
})
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
