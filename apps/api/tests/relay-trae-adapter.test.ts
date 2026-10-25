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
import { generateKeyPairSync, verify } from 'node:crypto'
import { describe, it, expect, vi, afterEach } from 'vitest'
import {
  classifyUpstreamFailure,
  extractUpstreamCode,
  traeAdapter,
  isTraeAuthFailure,
  TraeUpstreamError,
} from '../src/services/upstream-adapters/trae-adapter.js'
import {
  buildExchangeTokenBody,
  buildExchangeTokenProofBody,
  buildTraeProofCanonical,
  buildQueryBlocks,
  buildTraeCustomModel,
  createStopSequenceFilter,
  deriveBizSessionId,
  deviceMaterialFromSecrets,
  extractTokenPayload,
  extractUsage,
  flattenQuery,
  normalizeEventName,
  p1363ToDerLowS,
  P256_ORDER,
  parseExpiresAt,
  resolveReasoningEffortLevel,
  responseFormatHint,
  signTraeDeviceProof,
  splitSseBlocks,
  TRAE_EXCHANGE_TOKEN_PROOF_PATH,
  TRAE_IDE_VERSION,
  TRAE_JSON_OBJECT_HINT,
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

/** 打桩 fetch:model_list → 给定模型元数据;其余同 makeRelayFetchStub */
function makeFetchStubWithModelList(
  modelConfigs: unknown[],
  sseText: string,
  createBody: unknown = { data: { chat_session_id: 'cs-1', message_id: 'ms-1' } },
) {
  return vi.fn(async (input: string | URL) => {
    const url = String(input)
    if (url.includes('model_list')) return jsonResponse({ model_configs: modelConfigs })
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

  it('extractUsage:线上真帧字段 reasoning_tokens/cache_creation_input_tokens 归一注入', () => {
    // 线上实证 token_usage 帧形状(2026-10-23):input/output/reasoning/cache_creation_input_tokens
    const u = extractUsage(
      {
        input_tokens: 19415,
        output_tokens: 33,
        reasoning_tokens: 12,
        cache_creation_input_tokens: 4096,
      },
      'token_usage',
    )
    expect(u).not.toBeNull()
    expect(u!.prompt_tokens).toBe(19415)
    expect(u!.completion_tokens).toBe(33)
    expect(u!.prompt_tokens_details.cached_tokens).toBe(4096)
    expect(u!.completion_tokens_details.reasoning_tokens).toBe(12)
  })

  it('extractUsage:无任何计数字段判死,兼容字段缺失补 0', () => {
    expect(extractUsage({ foo: 1 }, 'message')).toBeNull()
    const u = extractUsage({ input_tokens: 5 }, 'token_usage')
    expect(u).toEqual({
      prompt_tokens: 5,
      completion_tokens: 0,
      total_tokens: 5,
      prompt_tokens_details: { cached_tokens: 0 },
      completion_tokens_details: { reasoning_tokens: 0 },
    })
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
      completion_tokens_details: { reasoning_tokens: 0 },
    })

    const last = chunks[chunks.length - 1] as {
      choices: Array<{ finish_reason: string | null }>
    }
    expect(last.choices[0]?.finish_reason).toBe('stop')

    // 收尾 stop 尽力而为被调用;body 必带 user_message_id(线上 stopSession 形状)
    const stopCall = fetchImpl.mock.calls.find(([u]) => String(u).endsWith('/stop'))
    expect(stopCall).toBeDefined()
    const stopInit = stopCall![1] as { method: string; body: string }
    expect(stopInit.method).toBe('POST')
    expect(JSON.parse(stopInit.body)).toEqual({
      chat_session_id: 'cs-1',
      user_message_id: 'ms-1',
    })
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
    // CN 配置 includeUserRegionHeader:false —— 多发 x-user-region 反而是指纹偏差
    expect(headers['x-user-region']).toBeUndefined()
    expect(headers['X-Trae-User-Timezone']).toBeTruthy()
    expect(headers['X-Preferenced-Language']).toBe('zh-CN')
    expect(headers.Origin).toBe('https://solo.trae.cn')
    expect(headers.Referer).toBe('https://solo.trae.cn/')

    const payload = JSON.parse(String((init as { body: string }).body)) as Record<string, unknown>
    expect(payload.mode).toBe('code')
    expect(payload.env).toBe('remote')
    const im = payload.initial_message as Record<string, unknown>
    // 线上 web 客户端形状:query 是 JSON.stringify(块数组),不是裸文本
    expect(im.query).toBe(
      JSON.stringify([
        { type: 'text', data: { content: '[System Instructions]\nS\n\n[User]\nU' } },
      ]),
    )
    expect(im.model_name).toBe('glm-5.3')
    expect(im.agent_type).toBe('solo_agent_remote')
    expect(im.model_selection_strategy).toBe('manual')
    const cp = JSON.parse(String(im.common_params)) as Record<string, unknown>
    expect(cp.biz_session_id).toBe(deriveBizSessionId('acc-9', 'glm-5.3'))
    // 线上 CN 配置(bundle 8974:22591 + main:890993/896209)的 common_params 指纹
    expect(cp).toMatchObject({
      language: 'zh-cn',
      app_language: 'zh-cn',
      quality: 'stable',
      app_version: process.env.TRAE_WEB_APP_VERSION?.trim() || '1.0.0.315',
      scope: 'marscode',
      tenant: 'marscode',
      region: 'cn',
      aiRegion: 'CN',
      is_privacy_mode: 0,
      privacy_mode: 'off',
      solo_chat_mode: 'code',
      biz_user_id: 'acc-9',
      user_unique_id: 'acc-9',
    })

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
    const cp3 = JSON.parse(String(im3.common_params)) as Record<string, unknown>
    expect(cp3.solo_chat_mode).toBe('work')
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
    expect(res!.expiresAt?.getTime()).toBe(1800000000000)
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
    expect(res!.expiresAt?.getTime()).toBe(1800000000000)
  })

  it('顶层 + ISO 字符串', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => jsonResponse({ Token: 't3', ExpiredAt: '2027-01-01T00:00:00Z' })),
    )
    const res = await traeAdapter.refreshToken!(makeCtx())
    expect(res!.token).toBe('t3')
    expect(res!.expiresAt?.getTime()).toBe(Date.parse('2027-01-01T00:00:00Z'))
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
// 新版 ExchangeToken 设备证明(2026-10-25 立;桌面渠道签发的票只认这条路)
// ---------------------------------------------------------------------------
describe('Trae 设备证明(DeviceProof)', () => {
  const { privateKey, publicKey } = generateKeyPairSync('ec', { namedCurve: 'prime256v1' })
  const privateKeyPem = privateKey.export({ type: 'pkcs8', format: 'pem' }).toString()
  const publicKeyPem = publicKey.export({ type: 'spki', format: 'pem' }).toString()
  const material = { deviceId: '4355605738307003', machineId: 'mid', privateKeyPem, publicKeyPem }
  const fixed = {
    clientId: 'ono9krqynydwx5',
    refreshToken: 'rt-x',
    timestamp: 1700000000,
    nonce: 'a1b2',
  }

  it('canonical 逐字形状 = POST\\n<path>\\n<clientId>\\n<rt>\\n<ts>\\n<nonce>', () => {
    expect(buildTraeProofCanonical(fixed)).toBe(
      ['POST', TRAE_EXCHANGE_TOKEN_PROOF_PATH, 'ono9krqynydwx5', 'rt-x', '1700000000', 'a1b2'].join(
        '\n',
      ),
    )
    expect(TRAE_EXCHANGE_TOKEN_PROOF_PATH).toBe('/trae/api/v3/oauth/ExchangeToken')
  })

  it('签名可用公钥验签(ECDSA/SHA-256, base64 DER)', () => {
    const canonical = buildTraeProofCanonical(fixed)
    const sig = Buffer.from(signTraeDeviceProof(privateKeyPem, canonical), 'base64')
    expect(
      verify(
        'sha256',
        Buffer.from(canonical, 'utf8'),
        { key: publicKeyPem, dsaEncoding: 'der' },
        sig,
      ),
    ).toBe(true)
  })

  it('签名低 s 归一化(s <= n/2)', () => {
    for (let i = 0; i < 12; i++) {
      const canonical = buildTraeProofCanonical({ ...fixed, nonce: `n${i}` })
      const der = Buffer.from(signTraeDeviceProof(privateKeyPem, canonical), 'base64')
      const s = readDerInt(der, 1)
      expect(s <= P256_ORDER / 2n).toBe(true)
    }
  })

  it('p1363 输入长度非 64B 直接报错(不吞半成品)', () => {
    expect(() => p1363ToDerLowS(Buffer.alloc(63))).toThrow(/64B/)
  })

  it('报文形状:ClientID/RefreshToken/DeviceInfo/DeviceProof/IDEVersion', () => {
    const body = buildExchangeTokenProofBody({ ...material, ...fixed }) as Record<string, any>
    expect(body.ClientID).toBe('ono9krqynydwx5')
    expect(body.ClientSecret).toBe('')
    expect(body.RefreshToken).toBe('rt-x')
    expect(body.IDEVersion).toBe(TRAE_IDE_VERSION)
    expect(body.DeviceInfo).toMatchObject({
      DeviceID: '4355605738307003',
      MachineID: 'mid',
      PlatformCode: 'IDE_PC',
      DeviceType: 'PC',
      DevicePublicKey: publicKeyPem,
      ClientVersion: TRAE_IDE_VERSION,
    })
    expect(body.DeviceProof).toEqual({
      Timestamp: 1700000000,
      Nonce: 'a1b2',
      Signature: expect.any(String),
    })
  })

  it('deviceMaterialFromSecrets:齐三件才成立,缺一项 → null(适配器退回旧通道)', () => {
    expect(
      deviceMaterialFromSecrets(
        { deviceKeyPem: privateKeyPem, devicePubPem: publicKeyPem },
        '123',
        'm',
      ),
    ).toEqual({
      deviceId: '123',
      machineId: 'm',
      privateKeyPem: privateKeyPem.trim(),
      publicKeyPem: publicKeyPem.trim(),
    })
    expect(deviceMaterialFromSecrets({ deviceKeyPem: privateKeyPem }, '123', 'm')).toBeNull()
    expect(
      deviceMaterialFromSecrets(
        { deviceKeyPem: privateKeyPem, devicePubPem: publicKeyPem },
        '',
        null,
      ),
    ).toBeNull()
    expect(deviceMaterialFromSecrets(null, '123', null)).toBeNull()
  })
})

/** 从 DER SEQUENCE 里读第 idx 个 INTEGER(0=r, 1=s) */
function readDerInt(der: Buffer, idx: number): bigint {
  let i = 2 // 跳过 0x30 + 短长度
  for (let k = 0; k <= idx; k++) {
    if (der[i] !== 0x02) throw new Error(`DER 第 ${k} 项不是 INTEGER`)
    const len = der[i + 1]
    const v = der.subarray(i + 2, i + 2 + len)
    if (k === idx) return BigInt(`0x${v.toString('hex')}`)
    i += 2 + len
  }
  throw new Error('unreachable')
}

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

  it('风控业务码 4010/4013/4015/4019 → risk(不受 HTTP 状态影响)', () => {
    for (const code of [4010, 4013, 4015, 4019]) {
      expect(classifyUpstreamFailure(400, JSON.stringify({ code }))).toBe('risk')
      expect(classifyUpstreamFailure(200, `code:${code} upstream says no`)).toBe('risk')
    }
    expect(classifyUpstreamFailure(400, '{"error":{"code":4015,"message":"risk"}}')).toBe('risk')
  })

  it('限流码 3004/4007 → rate;额度码 4008/4011/4021 → credit', () => {
    expect(classifyUpstreamFailure(200, '{"code":3004}')).toBe('rate')
    expect(classifyUpstreamFailure(400, '{"error_code":4007}')).toBe('rate')
    expect(classifyUpstreamFailure(400, '{"code":4008}')).toBe('credit')
    expect(classifyUpstreamFailure(400, '{"status_code":4011}')).toBe('credit')
    expect(classifyUpstreamFailure(400, '{"data":{"code":4021}}')).toBe('credit')
  })

  it('风控文本兜底 → risk;extractUpstreamCode 兼容 JSON/文本/无码', () => {
    expect(classifyUpstreamFailure(400, 'account risk detected')).toBe('risk')
    expect(classifyUpstreamFailure(403, '设备异常,请稍后再试')).toBe('risk')
    expect(extractUpstreamCode('{"code":4015}')).toBe(4015)
    expect(extractUpstreamCode('upstream error code=4019')).toBe(4019)
    expect(extractUpstreamCode('no code here')).toBeNull()
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

// ---------------------------------------------------------------------------
// 10. 专有协议补全:query 块数组 / custom_model / reasoning_effort / json / stop
// ---------------------------------------------------------------------------

describe('Trae 专有协议字段', () => {
  const modelConfigs = [
    {
      name: 'glm-5.3',
      display_name: 'GLM-5.3',
      provider: 'zhipu',
      config_source: 1,
      multimodal: true,
      prompt_max_tokens: 200000,
      reasoning_effort_config: {
        support_thinking: true,
        options: ['low', 'medium', 'high'],
        default_level: 'medium',
      },
    },
  ]

  it('query 按线上块数组形状序列化(buildQueryBlocks 纯函数)', () => {
    expect(buildQueryBlocks('')).toEqual([])
    expect(buildQueryBlocks('hi')).toEqual([{ type: 'text', data: { content: 'hi' } }])
  })

  it('custom_model 来自 model_list:prompt_max_tokens/multimodal/provider/reasoning 等级', async () => {
    const fetchImpl = makeFetchStubWithModelList(modelConfigs, 'event: done\ndata: {}\n\n')
    const result = await traeAdapter.executeChat!(
      makeCtx('acc-cm'),
      makeReq({ reasoningEffort: 'high' }),
      { fetchImpl },
    )
    await collectChunks(result.stream!)

    const fetchUrls = fetchImpl.mock.calls.map(([u]) => String(u))
    expect(fetchUrls.some((u) => u.includes('model_list'))).toBe(true)

    const im = getCreatePayload(fetchImpl).initial_message as Record<string, unknown>
    const cm = im.custom_model as Record<string, unknown>
    expect(cm).toMatchObject({
      provider: 'zhipu',
      is_preset: true,
      config_name: 'glm-5.3',
      config_source: 1,
      model_name: 'glm-5.3',
      display_model_name: 'GLM-5.3',
      use_remote_service: true,
      multimodal: true,
      prompt_max_tokens: 200000,
      reasoning_effort_level: 'high',
    })
  })

  it('auto 不带 custom_model;reasoning 非法 → 回退 default_level', async () => {
    const fetchAuto = makeFetchStubWithModelList(modelConfigs, 'event: done\ndata: {}\n\n')
    const rAuto = await traeAdapter.executeChat!(
      makeCtx('acc-auto'),
      makeReq({ model: 'auto', reasoningEffort: 'high' }),
      { fetchImpl: fetchAuto },
    )
    await collectChunks(rAuto.stream!)
    const imAuto = getCreatePayload(fetchAuto).initial_message as Record<string, unknown>
    expect(imAuto.custom_model).toBeUndefined()
    expect(imAuto.query).toBe(JSON.stringify(buildQueryBlocks(flattenQuery(makeReq().messages))))

    const fetchBad = makeFetchStubWithModelList(modelConfigs, 'event: done\ndata: {}\n\n')
    const rBad = await traeAdapter.executeChat!(
      makeCtx('acc-bad'),
      makeReq({ reasoningEffort: 'ultra' }),
      { fetchImpl: fetchBad },
    )
    await collectChunks(rBad.stream!)
    const imBad = getCreatePayload(fetchBad).initial_message as Record<string, unknown>
    expect((imBad.custom_model as Record<string, unknown>).reasoning_effort_level).toBe('medium')
  })

  it('resolveReasoningEffortLevel:未请求不发、support_thinking=false 不发、无合法默认不发', () => {
    const cfg = modelConfigs[0]
    expect(resolveReasoningEffortLevel(cfg, undefined)).toBeUndefined()
    expect(resolveReasoningEffortLevel(cfg, 'low')).toBe('low')
    expect(resolveReasoningEffortLevel(cfg, 2)).toBe('medium') // 无匹配 options → default_level
    expect(
      resolveReasoningEffortLevel(
        { reasoning_effort_config: { support_thinking: false, options: ['low'] } },
        'low',
      ),
    ).toBeUndefined()
    expect(
      resolveReasoningEffortLevel(
        { reasoning_effort_config: { options: ['low'], default_level: 'bad' } },
        'ultra',
      ),
    ).toBeUndefined()
  })

  it('buildTraeCustomModel:无元数据时只发协议必需字段,不臆造 provider/ak/base_url', () => {
    const cm = buildTraeCustomModel('glm-5.3', null)
    expect(cm).toEqual({
      is_preset: true,
      config_name: 'glm-5.3',
      config_source: 1,
      model_name: 'glm-5.3',
      display_model_name: 'glm-5.3',
      use_remote_service: true,
    })
    expect(buildTraeCustomModel('auto', null)).toBeUndefined()
    expect(buildTraeCustomModel('kimi-k2-work', null)?.model_name).toBe('kimi-k2')
  })

  it('json_object 注入 JSON-only 提示;json_schema 同提示不重复注入', async () => {
    const fetchObj = makeRelayFetchStub('event: done\ndata: {}\n\n')
    const rObj = await traeAdapter.executeChat!(
      makeCtx('acc-json'),
      makeReq({ responseFormat: { type: 'json_object' } }),
      { fetchImpl: fetchObj },
    )
    await collectChunks(rObj.stream!)
    const imObj = getCreatePayload(fetchObj).initial_message as Record<string, unknown>
    const contentObj = (JSON.parse(String(imObj.query)) as Array<{ data: { content: string } }>)[0]!
      .data.content
    expect(contentObj).toBe(`[System Instructions]\n${TRAE_JSON_OBJECT_HINT}\n\n[User]\n你好`)

    const schema = { type: 'object', properties: { a: { type: 'string' } } }
    const schemaHint = responseFormatHint({
      type: 'json_schema',
      json_schema: { name: 'x', schema },
    })!
    const fetchSchema = makeRelayFetchStub('event: done\ndata: {}\n\n')
    const rSchema = await traeAdapter.executeChat!(
      makeCtx('acc-json2'),
      makeReq({
        messages: [
          { role: 'system', content: `Base\n\n${schemaHint}` },
          { role: 'user', content: 'u' },
        ],
        responseFormat: { type: 'json_schema', json_schema: { name: 'x', schema } },
      }),
      { fetchImpl: fetchSchema },
    )
    await collectChunks(rSchema.stream!)
    const imSchema = getCreatePayload(fetchSchema).initial_message as Record<string, unknown>
    const contentSchema = (
      JSON.parse(String(imSchema.query)) as Array<{ data: { content: string } }>
    )[0]!.data.content
    expect(contentSchema.split(schemaHint)).toHaveLength(2) // 只出现一次
  })

  it('stop 序列跨帧截断:前缀扣留、命中即停、finish_reason=stop', async () => {
    const sse = [
      'event: message\ndata: {"delta":"你好"}\n\n',
      'event: message\ndata: {"delta":"世"}\n\n',
      'event: message\ndata: {"delta":"界之后的正文"}\n\n',
      'data: [DONE]\n\n',
    ].join('')
    const fetchImpl = makeRelayFetchStub(sse)
    const result = await traeAdapter.executeChat!(
      makeCtx('acc-stop'),
      makeReq({ stop: ['世界'] }),
      { fetchImpl },
    )
    const chunks = await collectChunks(result.stream!)
    expect(deltaContents(chunks).join('')).toBe('你好')
    const last = chunks[chunks.length - 1] as { choices: Array<{ finish_reason: string | null }> }
    expect(last.choices[0]?.finish_reason).toBe('stop')
    // 命中后必须尽力收尾上游会话
    expect(fetchImpl.mock.calls.some(([u]) => String(u).endsWith('/stop'))).toBe(true)
  })

  it('createStopSequenceFilter 纯函数:前缀扣留、无命中 flush 余量、命中后 flush 为空', () => {
    const filter = createStopSequenceFilter(['世界'])!
    expect(filter.feed('你好')).toEqual({ emit: '你', hit: false })
    expect(filter.feed('世')).toEqual({ emit: '好', hit: false })
    expect(filter.feed('界X')).toEqual({ emit: '', hit: true })
    expect(filter.flush()).toBe('')

    const plain = createStopSequenceFilter(['zz'])!
    expect(plain.feed('abc')).toEqual({ emit: 'ab', hit: false })
    expect(plain.feed('d')).toEqual({ emit: 'c', hit: false })
    expect(plain.flush()).toBe('d')
    expect(createStopSequenceFilter([])).toBeNull()
  })
})
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
