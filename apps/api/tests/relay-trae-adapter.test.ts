// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * Trae 上游适配器单测(2026-10-22 立)—— 禁止真实网络,fetch 一律打桩。
 *
 * 覆盖点:
 * 1. FlattenQuery 多轮扁平化(段序与标签)
 * 2. biz_session_id 稳定性(同账号+模型恒定、异模型不同、UUIDv4 形态)
 * 3. SSE 解析:增量帧/归一化事件名/error 帧/终止帧/心跳行/无 done 兜底
 * 4. refreshToken 响应宽松解析(Result 包裹/顶层、秒/毫秒/ISO)
 * 5. ExchangeToken 请求体形状(ClientID 常量等)
 * 另:创建请求体形状、401 自愈错误、非流式本地聚合。
 */
import { describe, it, expect, vi, afterEach } from 'vitest'
import {
  classifyUpstreamFailure,
  traeAdapter,
  isTraeAuthFailure,
  TraeUpstreamError,
} from '../src/services/upstream-adapters/trae-adapter.js'
import {
  buildExchangeTokenBody,
  deriveBizSessionId,
  extractTokenPayload,
  flattenQuery,
  normalizeEventName,
  parseExpiresAt,
  splitSseBlocks,
} from '../src/services/upstream-adapters/trae-protocol.js'
import type {
  AdapterAccountContext,
  NormalizedChatRequest,
} from '../src/services/relay-upstream-adapters.js'

// ---------------------------------------------------------------------------
// 测试夹具
// ---------------------------------------------------------------------------

function makeCtx(uid = 'acc-1'): AdapterAccountContext {
  return {
    row: { uid } as unknown as AdapterAccountContext['row'],
    credentials: { token: 'jwt-1', refreshToken: 'rt-1', cookies: [] },
  }
}

function makeReq(overrides: Partial<NormalizedChatRequest> = {}): NormalizedChatRequest {
  return {
    model: 'glm-5.3',
    messages: [{ role: 'user', content: '你好' }],
    stream: true,
    ...overrides,
  }
}

function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'content-type': 'application/json' },
  })
}

function sseResponse(text: string): Response {
  return new Response(text, { status: 200, headers: { 'content-type': 'text/event-stream' } })
}

/** 打桩 fetch:chat_sessions 创建 → 固定 ids;events → 给定 SSE 文本;stop → 200 */
function makeRelayFetchStub(
  sseText: string,
  createBody: unknown = { data: { chat_session_id: 'cs-1', message_id: 'ms-1' } },
) {
  return vi.fn(async (input: string | URL) => {
    const url = String(input)
    if (url.endsWith('/stop')) return jsonResponse({ ok: true })
    if (url.includes('/events')) return sseResponse(sseText)
    return jsonResponse(createBody)
  })
}

/** 从打桩 fetch 的调用记录里取创建会话的 POST 请求体(已 JSON.parse) */
function getCreatePayload(
  fetchMock: ReturnType<typeof makeRelayFetchStub>,
): Record<string, unknown> {
  const call = fetchMock.mock.calls.find(
    ([u, init]) => String(u).endsWith('/chat_sessions') && (init as RequestInit)?.method === 'POST',
  )
  if (!call) throw new Error('未捕获到 chat_sessions 创建请求')
  return JSON.parse(String((call[1] as { body: string }).body)) as Record<string, unknown>
}

async function collectChunks(
  stream: AsyncIterable<Record<string, unknown>>,
): Promise<Record<string, unknown>[]> {
  const out: Record<string, unknown>[] = []
  for await (const chunk of stream) out.push(chunk)
  return out
}

function deltaContents(chunks: Record<string, unknown>[]): string[] {
  return chunks
    .map((c) => {
      const choices = c.choices
      if (!Array.isArray(choices) || choices.length === 0) return null
      const delta = (choices[0] as { delta?: { content?: unknown } }).delta
      return typeof delta?.content === 'string' ? delta.content : null
    })
    .filter((s): s is string => s !== null)
}

afterEach(() => {
  vi.unstubAllGlobals()
})

// ---------------------------------------------------------------------------
// 1. FlattenQuery 多轮扁平化
// ---------------------------------------------------------------------------

describe('flattenQuery 多轮扁平化', () => {
  it('system/assistant/tool/user 段序与标签,段间空行', () => {
    const q = flattenQuery([
      { role: 'system', content: '你是助手' },
      { role: 'user', content: '你好' },
      { role: 'assistant', content: '你好呀' },
      { role: 'tool', content: { text: '工具结果' } },
      { role: 'user', content: '继续' },
    ])
    expect(q).toBe(
      [
        '[System Instructions]\n你是助手',
        '[User]\n你好',
        '[Previous Assistant Response]\n你好呀',
        '[Tool Result]\n工具结果',
        '[User]\n继续',
      ].join('\n\n'),
    )
  })

  it('数组 content 取 parts 文本;空正文消息跳过', () => {
    const q = flattenQuery([
      {
        role: 'user',
        content: [
          { type: 'text', text: 'A' },
          { type: 'text', text: 'B' },
        ],
      },
      { role: 'assistant', content: '' },
      { role: 'user', content: 'C' },
    ])
    expect(q).toBe('[User]\nAB\n\n[User]\nC')
  })
})

// ---------------------------------------------------------------------------
// 2. biz_session_id 稳定性
// ---------------------------------------------------------------------------

describe('deriveBizSessionId 稳定会话 id', () => {
  it('同账号+模型恒定,异模型/异账号不同,UUIDv4 形态', () => {
    const a = deriveBizSessionId('acc-1', 'glm-5.3')
    expect(a).toBe(deriveBizSessionId('acc-1', 'glm-5.3'))
    expect(deriveBizSessionId('acc-1', 'deepseek-v3')).not.toBe(a)
    expect(deriveBizSessionId('acc-2', 'glm-5.3')).not.toBe(a)
    expect(a).toMatch(/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/)
  })
})

// ---------------------------------------------------------------------------
// 3. SSE 解析与 chunk 翻译
// ---------------------------------------------------------------------------

describe('SSE 事件流解析', () => {
  it('splitSseBlocks:心跳注释行忽略、缺省事件名 message、多行 data 合并', () => {
    const { events, rest } = splitSseBlocks(
      ': ping\n\nevent: message\ndata: {"a":1}\n\ndata: x\ndata: y\n\nincomplete',
    )
    expect(events).toEqual([
      { event: 'message', data: '{"a":1}' },
      { event: 'message', data: 'x\ny' },
    ])
    expect(rest).toBe('incomplete')
  })

  it('normalizeEventName:tokenusage/modelconfig/planitem 归一化', () => {
    expect(normalizeEventName('tokenusage')).toBe('token_usage')
    expect(normalizeEventName('modelconfig')).toBe('model_config')
    expect(normalizeEventName('planitem')).toBe('plan_item')
    expect(normalizeEventName('Message')).toBe('message')
  })

  it('增量帧 + tokenusage 终帧 + done 终止 + stop 收尾', async () => {
    const sse = [
      ': heartbeat\n\n',
      'event: message\ndata: {"delta":"你好"}\n\n',
      'event: message\ndata: {"delta":"，世界"}\n\n',
      'data: {"text":"!"}\n\n',
      'event: request_wait_in_queue\ndata: {"position":3}\n\n',
      'event: tokenusage\ndata: {"input_tokens":10,"output_tokens":5,"cached_tokens":2}\n\n',
      'event: done\ndata: {}\n\n',
    ].join('')
    const fetchImpl = makeRelayFetchStub(sse)
    const result = await traeAdapter.executeChat!(makeCtx(), makeReq(), { fetchImpl })
    const chunks = await collectChunks(result.stream!)

    expect(deltaContents(chunks)).toEqual(['你好', '，世界', '!'])
    const first = chunks[0] as Record<string, unknown>
    expect(first.id).toBe('cs-1')
    expect(first.object).toBe('chat.completion.chunk')
    expect(first.model).toBe('glm-5.3')
    expect(typeof first.created).toBe('number')

    const usageFrame = chunks.find((c) => c.usage !== undefined)
    expect(usageFrame).toBeDefined()
    expect((usageFrame as { choices: unknown[] }).choices).toEqual([])
    expect((usageFrame as { usage: Record<string, unknown> }).usage).toEqual({
      prompt_tokens: 10,
      completion_tokens: 5,
      total_tokens: 15,
      prompt_tokens_details: { cached_tokens: 2 },
    })

    const last = chunks[chunks.length - 1] as {
      choices: Array<{ finish_reason: string | null }>
    }
    expect(last.choices[0]?.finish_reason).toBe('stop')

    // 收尾 stop 尽力而为被调用
    const stopCall = fetchImpl.mock.calls.find(([u]) => String(u).endsWith('/stop'))
    expect(stopCall).toBeDefined()
  })

  it('error 帧 → 终止并抛错(错误信息带 code)', async () => {
    const sse =
      'event: message\ndata: {"delta":"部"}\n\n' +
      'event: error\ndata: {"code":40001,"message":"配额不足"}\n\n'
    const fetchImpl = makeRelayFetchStub(sse)
    const result = await traeAdapter.executeChat!(makeCtx(), makeReq(), { fetchImpl })
    await expect(collectChunks(result.stream!)).rejects.toThrow(/40001/)
  })

  it('流提前断开无 done → 兜底补 finish_reason stop', async () => {
    const sse = 'event: message\ndata: {"delta":"半截"}\n\n'
    const fetchImpl = makeRelayFetchStub(sse)
    const result = await traeAdapter.executeChat!(makeCtx(), makeReq(), { fetchImpl })
    const chunks = await collectChunks(result.stream!)
    const last = chunks[chunks.length - 1] as { choices: Array<{ finish_reason: string | null }> }
    expect(last.choices[0]?.finish_reason).toBe('stop')
  })

  it('创建请求体形状:扁平化 query、common_params 字符串化、稳定 biz_session_id、auto/work 分流', async () => {
    const fetchImpl = makeRelayFetchStub('event: done\ndata: {}\n\n')
    const req = makeReq({
      messages: [
        { role: 'system', content: 'S' },
        { role: 'user', content: 'U' },
      ],
    })
    const result = await traeAdapter.executeChat!(makeCtx('acc-9'), req, { fetchImpl })
    await collectChunks(result.stream!)

    const createCall = fetchImpl.mock.calls.find(
      ([u, init]) =>
        String(u).endsWith('/chat_sessions') && (init as RequestInit)?.method === 'POST',
    )
    expect(createCall).toBeDefined()
    const [, init] = createCall!
    const headers = (init as { headers: Record<string, string> }).headers
    expect(headers.Authorization).toBe('Cloud-IDE-JWT jwt-1')
    expect(headers['X-Trae-Client-Type']).toBe('web')
    expect(headers['x-user-region']).toBe('CN')
    expect(headers.Origin).toBe('https://solo.trae.cn')

    const payload = JSON.parse(String((init as { body: string }).body)) as Record<string, unknown>
    expect(payload.mode).toBe('code')
    expect(payload.env).toBe('remote')
    const im = payload.initial_message as Record<string, unknown>
    expect(im.query).toBe('[System Instructions]\nS\n\n[User]\nU')
    expect(im.model_name).toBe('glm-5.3')
    expect(im.agent_type).toBe('solo_agent_remote')
    expect(im.model_selection_strategy).toBe('manual')
    const cp = JSON.parse(String(im.common_params)) as Record<string, unknown>
    expect(cp.biz_session_id).toBe(deriveBizSessionId('acc-9', 'glm-5.3'))
    expect(cp.tenant).toBe('marscode')

    // model=auto → strategy auto + model_name 空
    const fetch2 = makeRelayFetchStub('event: done\ndata: {}\n\n')
    const r2 = await traeAdapter.executeChat!(makeCtx(), makeReq({ model: 'auto' }), {
      fetchImpl: fetch2,
    })
    await collectChunks(r2.stream!)
    const im2 = getCreatePayload(fetch2).initial_message as Record<string, unknown>
    expect(im2.model_selection_strategy).toBe('auto')
    expect(im2.model_name).toBe('')

    // -work 后缀 → solo_work_remote + mode work
    const fetch3 = makeRelayFetchStub('event: done\ndata: {}\n\n')
    const r3 = await traeAdapter.executeChat!(makeCtx(), makeReq({ model: 'kimi-k2-work' }), {
      fetchImpl: fetch3,
    })
    await collectChunks(r3.stream!)
    const p3 = getCreatePayload(fetch3)
    expect(p3.mode).toBe('work')
    const im3 = p3.initial_message as Record<string, unknown>
    expect(im3.agent_type).toBe('solo_work_remote')
    expect(im3.agent_id).toBe('solo_work_remote')
  })

  it('创建请求 401 → 抛 TraeAuthFailureError(isTraeAuthFailure 可判)', async () => {
    const fetchImpl = vi.fn(
      async () => new Response('{"error":"unauthorized"}', { status: 401 }),
    ) as unknown as typeof fetch
    const err = await traeAdapter.executeChat!(makeCtx(), makeReq(), { fetchImpl }).catch(
      (e: unknown) => e,
    )
    expect(isTraeAuthFailure(err)).toBe(true)
    expect(err).toBeInstanceOf(Error)
    expect(String((err as Error).message)).toMatch(/401/)
  })

  it('非流式(stream=false)→ 本地聚合完整 completion', async () => {
    const sse = [
      'event: message\ndata: {"delta":"你好"}\n\n',
      'event: message\ndata: {"delta":"世界"}\n\n',
      'event: tokenusage\ndata: {"input_tokens":7,"output_tokens":3}\n\n',
      'data: [DONE]\n\n',
    ].join('')
    const fetchImpl = makeRelayFetchStub(sse)
    const result = await traeAdapter.executeChat!(makeCtx(), makeReq({ stream: false }), {
      fetchImpl,
    })
    expect(result.stream).toBeUndefined()
    const completion = result.completion as Record<string, unknown>
    expect(completion.object).toBe('chat.completion')
    expect(completion.id).toBe('cs-1')
    expect(completion.model).toBe('glm-5.3')
    const choices = completion.choices as Array<{
      message: { content: string }
      finish_reason: string
    }>
    expect(choices[0]?.message.content).toBe('你好世界')
    expect(choices[0]?.finish_reason).toBe('stop')
    expect(completion.usage).toMatchObject({
      prompt_tokens: 7,
      completion_tokens: 3,
      total_tokens: 10,
    })
  })
})

// ---------------------------------------------------------------------------
// 4. refreshToken 响应宽松解析
// ---------------------------------------------------------------------------

describe('refreshToken 宽松解析', () => {
  it('Result 包裹 + unix 秒', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(async () =>
        jsonResponse({ Result: { Token: 't1', RefreshToken: 'r1', ExpiredAt: 1800000000 } }),
      ),
    )
    const res = await traeAdapter.refreshToken!(makeCtx())
    expect(res).not.toBeNull()
    expect(res!.token).toBe('t1')
    expect(res!.refreshToken).toBe('r1')
    expect(res!.expiresAt.getTime()).toBe(1800000000000)
  })

  it('result 包裹 + AccessToken + 毫秒', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(async () =>
        jsonResponse({ result: { AccessToken: 't2', TokenExpireAt: 1800000000000 } }),
      ),
    )
    const res = await traeAdapter.refreshToken!(makeCtx())
    expect(res!.token).toBe('t2')
    expect(res!.refreshToken).toBeNull()
    expect(res!.expiresAt.getTime()).toBe(1800000000000)
  })

  it('顶层 + ISO 字符串', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => jsonResponse({ Token: 't3', ExpiredAt: '2027-01-01T00:00:00Z' })),
    )
    const res = await traeAdapter.refreshToken!(makeCtx())
    expect(res!.token).toBe('t3')
    expect(res!.expiresAt.getTime()).toBe(Date.parse('2027-01-01T00:00:00Z'))
  })

  it('无 refreshToken → null 且不发请求', async () => {
    const spy = vi.fn()
    vi.stubGlobal('fetch', spy)
    const ctx = makeCtx()
    ctx.credentials.refreshToken = null
    await expect(traeAdapter.refreshToken!(ctx)).resolves.toBeNull()
    expect(spy).not.toHaveBeenCalled()
  })

  it('HTTP 非 2xx / 无 Token → 抛错', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => new Response('boom', { status: 500 })),
    )
    await expect(traeAdapter.refreshToken!(makeCtx())).rejects.toThrow(/500/)
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => jsonResponse({ Result: { Message: 'no token' } })),
    )
    await expect(traeAdapter.refreshToken!(makeCtx())).rejects.toThrow(/Token/)
  })

  it('parseExpiresAt 纯函数:秒/毫秒/ISO/非法值', () => {
    expect(parseExpiresAt(1800000000)?.getTime()).toBe(1800000000000)
    expect(parseExpiresAt(1800000000000)?.getTime()).toBe(1800000000000)
    expect(parseExpiresAt('1800000000')?.getTime()).toBe(1800000000000)
    expect(parseExpiresAt('2027-01-01T00:00:00Z')?.getTime()).toBe(
      Date.parse('2027-01-01T00:00:00Z'),
    )
    expect(parseExpiresAt('not-a-date')).toBeNull()
    expect(parseExpiresAt(0)).toBeNull()
    expect(parseExpiresAt(null)).toBeNull()
  })

  it('extractTokenPayload:包裹层与顶层皆可用', () => {
    expect(extractTokenPayload({ Result: { Token: 'a' } })?.token).toBe('a')
    expect(extractTokenPayload({ token: 'b' })?.token).toBe('b')
    expect(extractTokenPayload({ Result: { Message: 'x' } })).toBeNull()
  })
})

// ---------------------------------------------------------------------------
// 5. ExchangeToken 请求体形状
// ---------------------------------------------------------------------------

describe('ExchangeToken 请求形状', () => {
  it('URL/POST/无 Authorization/固定 ClientID 体', async () => {
    const spy = vi.fn(async () => jsonResponse({ Result: { Token: 't' } }))
    vi.stubGlobal('fetch', spy)
    await traeAdapter.refreshToken!(makeCtx())

    const [url, init] = spy.mock.calls[0] as [string, RequestInit]
    expect(String(url)).toBe('https://api.trae.cn/cloudide/api/v3/trae/oauth/ExchangeToken')
    expect(init.method).toBe('POST')
    const headers = init.headers as Record<string, string>
    expect(headers['Content-Type']).toBe('application/json')
    expect(headers.Authorization).toBeUndefined()
    expect(JSON.parse(String(init.body))).toEqual({
      ClientID: 'ono9krqynydwx5',
      RefreshToken: 'rt-1',
      ClientSecret: '-',
      UserID: '',
    })
  })

  it('buildExchangeTokenBody 纯函数形状', () => {
    expect(buildExchangeTokenBody('rt')).toEqual({
      ClientID: 'ono9krqynydwx5',
      RefreshToken: 'rt',
      ClientSecret: '-',
      UserID: '',
    })
  })
})

// ---------------------------------------------------------------------------
// 6. 单段式三件套与 isAuthFailure
// ---------------------------------------------------------------------------

describe('接口杂项', () => {
  it('buildChatRequest/translateStreamChunk/translateNonStream 抛多段式路径错', () => {
    const ctx = makeCtx()
    expect(() => traeAdapter.buildChatRequest(ctx, makeReq())).toThrow(
      'trae 走 executeChat 多段式路径',
    )
    expect(() => traeAdapter.translateStreamChunk(ctx, '', {})).toThrow(
      'trae 走 executeChat 多段式路径',
    )
    expect(() => traeAdapter.translateNonStream(ctx, {})).toThrow('trae 走 executeChat 多段式路径')
  })

  it('isAuthFailure:401/403 或 body 含 authentication_error/unauthorized', () => {
    expect(traeAdapter.isAuthFailure(401, '')).toBe(true)
    expect(traeAdapter.isAuthFailure(403, '')).toBe(true)
    expect(traeAdapter.isAuthFailure(200, '{"type":"authentication_error"}')).toBe(true)
    expect(traeAdapter.isAuthFailure(200, 'Unauthorized access')).toBe(true)
    expect(traeAdapter.isAuthFailure(429, 'rate limited')).toBe(false)
  })
})

// ---------------------------------------------------------------------------
// 7. 上游失败富分类与 TraeUpstreamError
// ---------------------------------------------------------------------------

describe('classifyUpstreamFailure 语义映射', () => {
  it('429 → rate', () => {
    expect(classifyUpstreamFailure(429, '')).toBe('rate')
  })

  it('额度/积分/quota 文本 → credit(即使状态是 400)', () => {
    expect(classifyUpstreamFailure(400, '账号额度不足')).toBe('credit')
    expect(classifyUpstreamFailure(400, 'insufficient quota')).toBe('credit')
  })

  it('登录失效文本 → session_dead(即使状态是 400)', () => {
    expect(classifyUpstreamFailure(400, '登录已失效,请重新登录')).toBe('session_dead')
    expect(classifyUpstreamFailure(400, 'session expired')).toBe('session_dead')
  })

  it('500 → server', () => {
    expect(classifyUpstreamFailure(500, 'internal error')).toBe('server')
  })

  it('400 参数错误 → request', () => {
    expect(classifyUpstreamFailure(400, 'invalid parameter: messages')).toBe('request')
    expect(classifyUpstreamFailure(422, '')).toBe('request')
  })

  it('未知状态且无文本命中 → client', () => {
    expect(classifyUpstreamFailure(418, 'teapot')).toBe('client')
  })

  it('executeChat 遇 HTTP 500 抛 TraeUpstreamError 且 statusCode=500', async () => {
    const fetchImpl = vi.fn(
      async () => new Response('upstream boom', { status: 500 }),
    ) as unknown as typeof fetch
    const err = await traeAdapter.executeChat!(makeCtx(), makeReq(), { fetchImpl }).catch(
      (e: unknown) => e,
    )
    expect(err).toBeInstanceOf(TraeUpstreamError)
    expect((err as TraeUpstreamError).statusCode).toBe(500)
    expect(
      classifyUpstreamFailure(
        (err as TraeUpstreamError).statusCode,
        String((err as Error).message),
      ),
    ).toBe('server')
  })
})
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
