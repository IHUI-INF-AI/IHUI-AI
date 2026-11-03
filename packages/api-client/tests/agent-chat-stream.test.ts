// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * B4 Agent 会话 SSE 消费端契约测试。
 *
 * 四格必须各有判据(对齐用户任务 5):
 *  1. 事件序列解析(meta/delta/done/[DONE] + `: ping` 心跳不占业务帧);
 *  2. 断线重连带 `Last-Event-ID`(且只重连一次);
 *  3. abort 后不再触发任何回调(宿主因此也不会再 setState);
 *  4. 重连仍失败 → 回落 version=2 分页读 + 一次性 POST。
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { setBaseUrl } from '../src/client.js'
import { streamAgentChat } from '../src/endpoints/agent-chat-stream.js'
import type { AgentChatMessage } from '@ihui/types'

function jsonPage(items: AgentChatMessage[]): Response {
  return {
    ok: true,
    status: 200,
    headers: new Headers({ 'content-type': 'application/json' }),
    json: async () => ({
      code: 0,
      message: 'ok',
      data: { items, total: items.length, hasMoreOlder: false, nextCursor: null },
    }),
    text: async () => '',
    body: null,
  } as unknown as Response
}

function jsonMessage(message: AgentChatMessage): Response {
  return {
    ok: true,
    status: 200,
    headers: new Headers({ 'content-type': 'application/json' }),
    json: async () => ({ code: 0, message: 'ok', data: message }),
    text: async () => '',
    body: null,
  } as unknown as Response
}

function errorResponse(status = 500): Response {
  return {
    ok: false,
    status,
    headers: new Headers({ 'content-type': 'application/json' }),
    json: async () => ({ code: status, message: 'upstream failed', data: null }),
    text: async () => JSON.stringify({ code: status, message: 'upstream failed', data: null }),
    body: null,
  } as unknown as Response
}

/** 把 SSE 行拼成一条响应;keepOpen=true 时流不关闭(用于制造读超时断线)。 */
function sseResponse(lines: string[], keepOpen = false): Response {
  const encoder = new TextEncoder()
  const stream = new ReadableStream<Uint8Array>({
    start(controller) {
      for (const line of lines) controller.enqueue(encoder.encode(`${line}\n`))
      if (!keepOpen) controller.close()
    },
  })
  return {
    ok: true,
    status: 200,
    headers: new Headers({ 'content-type': 'text/event-stream' }),
    body: stream,
    json: async () => {
      throw new Error('not json')
    },
    text: async () => '',
  } as unknown as Response
}

const META_FRAME = JSON.stringify({
  type: 'meta',
  agentId: 'agent_1',
  messageId: 'msg_a',
  userMessageId: 'msg_u',
  model: 'gpt-test',
  ts: 1700000000000,
})

const DONE_FRAME = JSON.stringify({
  type: 'done',
  messageId: 'msg_a',
  seq: 4,
  finishReason: 'stop',
})

describe('streamAgentChat — Agent 会话 SSE 消费(B4)', () => {
  let fetchMock: ReturnType<typeof vi.fn>
  const originalFetch = globalThis.fetch

  beforeEach(() => {
    fetchMock = vi.fn()
    globalThis.fetch = fetchMock as unknown as typeof fetch
    setBaseUrl('http://test.local')
  })

  afterEach(() => {
    globalThis.fetch = originalFetch
    setBaseUrl('')
  })

  it('按 meta → delta* → done → [DONE] 解析事件序列,`: ping` 心跳不占业务帧', async () => {
    const fallbackMessages: AgentChatMessage[] = [
      { id: 'msg_u', role: 'user', content: '你好' },
      { id: 'msg_a', role: 'assistant', content: '你好呀' },
    ]
    fetchMock
      .mockResolvedValueOnce(
        sseResponse([
          'id: 1',
          `data: ${META_FRAME}`,
          '',
          ': ping',
          '',
          'id: 2',
          'data: {"type":"delta","content":"你好"}',
          '',
          'id: 3',
          'data: {"type":"delta","content":"呀"}',
          '',
          'id: 4',
          `data: ${DONE_FRAME}`,
          '',
          'data: [DONE]',
          '',
        ]),
      )
      .mockResolvedValueOnce(jsonPage(fallbackMessages))

    const metas: unknown[] = []
    const deltas: Array<[string, string]> = []
    const dones: unknown[] = []
    const handle = streamAgentChat(
      { agentId: 'agent_1', content: '你好' },
      {
        onMeta: (meta) => metas.push(meta),
        onDelta: (delta, accumulated) => deltas.push([delta, accumulated]),
        onDone: (done) => dones.push(done),
      },
    )
    const outcome = await handle.completion

    expect(metas).toHaveLength(1)
    expect(metas[0]).toMatchObject({ type: 'meta', messageId: 'msg_a', agentId: 'agent_1' })
    expect(deltas).toEqual([
      ['你好', '你好'],
      ['呀', '你好呀'],
    ])
    expect(dones).toHaveLength(1)
    expect(outcome.mode).toBe('stream')
    expect(outcome.content).toBe('你好呀')
    expect(outcome.messageId).toBe('msg_a')
    expect(outcome.finishReason).toBe('stop')
    expect(outcome.messages).toEqual(fallbackMessages)
    expect(fetchMock).toHaveBeenCalledTimes(2)
    expect(String(fetchMock.mock.calls[1]![0])).toContain('version=2')
  })

  it('断线后带 Last-Event-ID 重连一次,并从缺失段续上', async () => {
    const finalMessages: AgentChatMessage[] = [
      { id: 'msg_u', role: 'user', content: '写首诗' },
      { id: 'msg_a', role: 'assistant', content: 'AB' },
    ]
    fetchMock
      // 第一次:发出 meta + 一条 delta 后挂起(读超时 → 断线)
      .mockResolvedValueOnce(
        sseResponse(
          ['id: 1', `data: ${META_FRAME}`, '', 'id: 2', 'data: {"type":"delta","content":"A"}', ''],
          true,
        ),
      )
      // 第二次:续传(服务端只补 id > 2 的帧)
      .mockResolvedValueOnce(
        sseResponse([
          'id: 3',
          'data: {"type":"delta","content":"B"}',
          '',
          'id: 4',
          `data: ${DONE_FRAME}`,
          '',
          'data: [DONE]',
          '',
        ]),
      )
      .mockResolvedValueOnce(jsonPage(finalMessages))

    const reconnects: Array<{ attempt: number; delayMs: number }> = []
    const handle = streamAgentChat(
      { agentId: 'agent_1', content: '写首诗' },
      { onReconnect: (info) => reconnects.push(info) },
      { maxReconnects: 1, reconnectDelayMs: 0, readTimeoutMs: 60 },
    )
    const outcome = await handle.completion

    expect(reconnects).toEqual([{ attempt: 1, delayMs: 0 }])
    const secondInit = fetchMock.mock.calls[1]![1] as { headers: Record<string, string> }
    expect(secondInit.headers['Last-Event-ID']).toBe('2')
    expect(outcome.mode).toBe('stream')
    expect(outcome.content).toBe('AB')
    expect(outcome.messages).toEqual(finalMessages)
  })

  it('abort 后不再触发任何回调,completion 以 AbortError 收尾', async () => {
    fetchMock.mockResolvedValueOnce(
      sseResponse([
        'id: 1',
        `data: ${META_FRAME}`,
        '',
        'id: 2',
        'data: {"type":"delta","content":"A"}',
        '',
        'id: 3',
        'data: {"type":"delta","content":"B"}',
        '',
        'id: 4',
        `data: ${DONE_FRAME}`,
        '',
        'data: [DONE]',
        '',
      ]),
    )

    const deltas: string[] = []
    const dones: unknown[] = []
    const fallbacks: unknown[] = []
    const handle = streamAgentChat(
      { agentId: 'agent_1', content: '停' },
      {
        onDelta: (delta) => {
          deltas.push(delta)
          if (deltas.length === 1) handle.abort()
        },
        onDone: (done) => dones.push(done),
        onFallback: (info) => fallbacks.push(info),
      },
    )

    await expect(handle.completion).rejects.toMatchObject({ name: 'AbortError' })
    expect(deltas).toEqual(['A'])
    expect(dones).toHaveLength(0)
    expect(fallbacks).toHaveLength(0)
    // abort 后不得再发起终态读 / 回落请求
    expect(fetchMock).toHaveBeenCalledTimes(1)
  })

  it('重连仍失败 → 回落 version=2 分页读 + 一次性 POST,并显式标注 fallback', async () => {
    const history: AgentChatMessage[] = [{ id: 'msg_old', role: 'user', content: '旧消息' }]
    const finalPage: AgentChatMessage[] = [
      ...history,
      { id: 'msg_u2', role: 'user', content: '新问题' },
      { id: 'msg_a2', role: 'assistant', content: '一次性回复' },
    ]
    fetchMock
      .mockResolvedValueOnce(errorResponse(500))
      .mockResolvedValueOnce(jsonPage(history))
      .mockResolvedValueOnce(
        jsonMessage({ id: 'msg_a2', role: 'assistant', content: '一次性回复' }),
      )
      .mockResolvedValueOnce(jsonPage(finalPage))

    const fallbacks: Array<{ reason: string; message: string }> = []
    const handle = streamAgentChat(
      { agentId: 'agent_1', content: '新问题' },
      { onFallback: (info) => fallbacks.push(info) },
      { maxReconnects: 0 },
    )
    const outcome = await handle.completion

    expect(fallbacks).toHaveLength(1)
    expect(fallbacks[0]!.reason).toBe('transport')
    expect(outcome.mode).toBe('fallback')
    expect(outcome.content).toBe('一次性回复')
    expect(outcome.messageId).toBe('msg_a2')
    expect(outcome.messages).toEqual(finalPage)

    const urls = fetchMock.mock.calls.map((c) => String(c[0]))
    expect(urls[0]).toContain('/messages/stream')
    expect(urls[1]).toContain('version=2')
    expect(urls[2]).toContain('/messages')
    expect(urls[3]).toContain('version=2')
    const postInit = fetchMock.mock.calls[2]![1] as { method: string; body: string }
    expect(postInit.method).toBe('POST')
    expect(JSON.parse(postInit.body)).toEqual({ content: '新问题' })
  })
})
