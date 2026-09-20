// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * 外部会话导入端点测试(D28,2026-09-20)
 *
 * 用 setTransport mock(与 fetch-api-form-data.test.ts 同款):
 *   - parse:FormData 组装(source + file 字段)、multipart 不覆盖 Content-Type
 *   - parse 裸 JSON:ai-service 无 {code:0} 包装时整体作为 data
 *   - commit:payload JSON 序列化 + Content-Type: application/json
 *   - history:GET、无 body、无 Content-Type
 *   - 错误分支:4xx 返回 success=false 不抛错、5xx 抛错后归一化、code!==0 取 message
 */
import { describe, it, expect, vi, afterEach } from 'vitest'
import { setTransport, type Transport } from '../src/transport.js'
import {
  commitConversationImport,
  getConversationImportHistory,
  parseConversationImport,
  type ConversationImportCommitPayload,
} from '../src/endpoints/conversation-import.js'

/** 构造成功(2xx + {code:0,data})的 transport mock */
function okTransport(json: unknown): Transport {
  return vi.fn(async () => ({
    ok: true,
    status: 200,
    headers: { get: () => null },
    text: async () => '',
    json: async () => json,
  })) as unknown as Transport
}

/** 提取 transport 首次调用记录到的 (url, init) */
function firstCall(
  transport: Transport,
): [string, { method?: string; body?: unknown; headers?: Record<string, string> }] {
  const call = (transport as unknown as { mock: { calls: unknown[][] } }).mock.calls[0] ?? []
  return [
    call[0] as string,
    (call[1] ?? {}) as { method?: string; body?: unknown; headers?: Record<string, string> },
  ]
}

describe('conversation-import 端点', () => {
  afterEach(() => {
    setTransport(undefined as unknown as Transport)
  })

  it('parse:multipart 组装 source/file 字段且不覆盖 Content-Type', async () => {
    const transport = okTransport({
      code: 0,
      data: { conversations: [], truncated: false, warnings: [] },
    })
    setTransport(transport)

    const file = new File(['[]'], 'sessions.jsonl', { type: 'application/octet-stream' })
    const result = await parseConversationImport(file, 'claude_code')

    expect(result.success).toBe(true)
    if (result.success) expect(result.status).toBe(200)
    const [url, init] = firstCall(transport)
    expect(url).toBe('/api/user/conversation-import/parse')
    expect(init.method).toBe('POST')
    expect(init.body).toBeInstanceOf(FormData)
    const fd = init.body as FormData
    expect(fd.get('source')).toBe('claude_code')
    const uploaded = fd.get('file') as File | null
    expect(uploaded?.name).toBe('sessions.jsonl')
    expect(uploaded?.size).toBe(2)
    expect(init.headers?.['Content-Type']).toBeUndefined()
  })

  it('parse:ai-service 裸 JSON(无 code 包装)整体作为 data 透传', async () => {
    const transport = okTransport({
      conversations: [{ title: '会话一', messages: [{ role: 'user', content: 'hi' }] }],
      truncated: true,
      warnings: ['部分消息缺失时间戳'],
    })
    setTransport(transport)

    const result = await parseConversationImport(new File(['x'], 'state.json'), 'cursor')

    expect(result.success).toBe(true)
    expect(result.data?.truncated).toBe(true)
    expect(result.data?.warnings).toEqual(['部分消息缺失时间戳'])
    expect(result.data?.conversations).toHaveLength(1)
    expect(result.data?.conversations[0]?.messages[0]?.content).toBe('hi')
  })

  it('commit:payload JSON 序列化且 Content-Type 为 application/json', async () => {
    const payload: ConversationImportCommitPayload = {
      source: 'aider',
      fileName: 'chat.md',
      title: '重构登录模块',
      createdAt: '2026-09-01T00:00:00Z',
      messages: [{ role: 'user', content: 'hi', createdAt: '2026-09-01T00:00:01Z' }],
    }
    const transport = okTransport({
      code: 0,
      data: { importId: 'imp-1', conversationId: 'conv-1', importedMessages: 1 },
    })
    setTransport(transport)

    const result = await commitConversationImport(payload)

    expect(result.success).toBe(true)
    expect(result.data).toEqual({
      importId: 'imp-1',
      conversationId: 'conv-1',
      importedMessages: 1,
    })
    const [url, init] = firstCall(transport)
    expect(url).toBe('/api/user/conversation-import/commit')
    expect(init.method).toBe('POST')
    expect(typeof init.body).toBe('string')
    expect(JSON.parse(init.body as string)).toEqual(payload)
    expect(init.headers?.['Content-Type']).toBe('application/json')
  })

  it('history:GET 请求且无 body、无 Content-Type', async () => {
    const transport = okTransport({ code: 0, data: { list: [], total: 0 } })
    setTransport(transport)

    const result = await getConversationImportHistory()

    expect(result.success).toBe(true)
    expect(result.data).toEqual({ list: [], total: 0 })
    const [url, init] = firstCall(transport)
    expect(url).toBe('/api/user/conversation-import/history')
    expect(init.method).toBe('GET')
    expect(init.body).toBeUndefined()
    expect(init.headers?.['Content-Type']).toBeUndefined()
  })

  it('4xx 且响应体是 FastAPI {detail}(ai-service 透传形态):取 detail 而非裸 JSON', async () => {
    // /parse 的错误由 api 原样透传 ai-service,形态是 {"detail": "..."};
    // 只认 message 会让调用方把整段 JSON 甩进 toast。
    const transport = vi.fn(async () => ({
      ok: false,
      status: 400,
      headers: { get: () => null },
      text: async () => JSON.stringify({ detail: '不支持的文件类型: .txt' }),
      json: async () => ({}),
    })) as unknown as Transport
    setTransport(transport)

    const result = await getConversationImportHistory()

    expect(result.success).toBe(false)
    if (!result.success) expect(result.error).toBe('不支持的文件类型: .txt')
  })

  it('4xx 且 detail 是非字符串(FastAPI 校验数组):不误用,回退原始文本', async () => {
    const raw = JSON.stringify({ detail: [{ msg: 'required' }] })
    const transport = vi.fn(async () => ({
      ok: false,
      status: 422,
      headers: { get: () => null },
      text: async () => raw,
      json: async () => ({}),
    })) as unknown as Transport
    setTransport(transport)

    const result = await getConversationImportHistory()

    expect(result.success).toBe(false)
    if (!result.success) expect(result.error).toBe(raw)
  })

  it('5xx 服务不可用:抛错后被归一化为 success=false + status', async () => {
    const transport = vi.fn(async () => ({
      ok: false,
      status: 502,
      headers: { get: () => null },
      text: async () => '上游解析服务不可用',
      json: async () => ({}),
    })) as unknown as Transport
    setTransport(transport)

    const result = await getConversationImportHistory()

    expect(result.success).toBe(false)
    if (!result.success) {
      expect(result.error).toBe('上游解析服务不可用')
      expect(result.status).toBe(502)
    }
  })

  it('code!==0:返回 success=false 且 error 取 message', async () => {
    const transport = okTransport({ code: 1, message: '未授权' })
    setTransport(transport)

    const result = await getConversationImportHistory()

    expect(result.success).toBe(false)
    if (!result.success) expect(result.error).toBe('未授权')
  })
})
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
