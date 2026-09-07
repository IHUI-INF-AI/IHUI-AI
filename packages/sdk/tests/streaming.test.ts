// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
import { describe, expect, it } from 'vitest'
import { parseAgentStream, parseChatStream, type ChatStreamChunk } from '../src/streaming'

/** 从文本块序列构造 ReadableStream。 */
function streamFrom(chunks: string[]): ReadableStream<Uint8Array> {
  const encoder = new TextEncoder()
  return new ReadableStream<Uint8Array>({
    start(controller) {
      for (const c of chunks) controller.enqueue(encoder.encode(c))
      controller.close()
    },
  })
}

async function collect<T>(gen: AsyncGenerator<T>): Promise<T[]> {
  const out: T[] = []
  for await (const item of gen) out.push(item)
  return out
}

function chunk(id: string, content: string): string {
  return `data: ${JSON.stringify({
    id,
    object: 'chat.completion.chunk',
    created: 1700000000,
    model: 'gpt-4o',
    choices: [{ index: 0, delta: { content }, finishReason: null }],
  })}\n\n`
}

describe('parseChatStream — 帧解析', () => {
  it('解析单个完整帧', async () => {
    const out = await collect(parseChatStream(streamFrom([chunk('a', '你好')])))
    expect(out).toHaveLength(1)
    expect(out[0].id).toBe('a')
    expect(out[0].choices[0].delta.content).toBe('你好')
    expect(out[0].object).toBe('chat.completion.chunk')
  })

  it('同一 chunk 内多帧全部解析', async () => {
    const out = await collect(parseChatStream(streamFrom([chunk('a', 'x'), chunk('b', 'y'), chunk('c', 'z')])))
    expect(out.map((c: ChatStreamChunk) => c.id)).toEqual(['a', 'b', 'c'])
  })

  it('跨 chunk 断帧:一帧 JSON 被拆到两个 chunk 仍正确解析', async () => {
    const frame = chunk('split', '中文字符不切断')
    // 在 JSON 中间(避开转义歧义的多字节边界,按字符切)切开
    const cut = frame.indexOf('"created"') + 4
    const out = await collect(parseChatStream(streamFrom([frame.slice(0, cut), frame.slice(cut)])))
    expect(out).toHaveLength(1)
    expect(out[0].id).toBe('split')
    expect(out[0].choices[0].delta.content).toBe('中文字符不切断')
  })

  it('跨 chunk 断帧:按 UTF-8 多字节字符边界切开不乱码', async () => {
    const frame = chunk('mb', '深')
    const bytes = new TextEncoder().encode(frame)
    // 找到 '深'(3 字节 UTF-8)的中间切开
    const idx = bytes.findIndex((b, i) => i > 6 && b > 0x7f)
    const mid = idx + 1
    const decoder = new TextDecoder()
    const s = new ReadableStream<Uint8Array>({
      start(controller) {
        controller.enqueue(bytes.slice(0, mid))
        controller.enqueue(bytes.slice(mid))
        controller.close()
      },
    })
    const out = await collect(parseChatStream(s))
    expect(out).toHaveLength(1)
    expect(out[0].choices[0].delta.content).toBe('深')
    void decoder
  })

  it('遇到 data: [DONE] 立即结束,后续内容不再产出', async () => {
    const out = await collect(
      parseChatStream(streamFrom([chunk('a', 'x'), 'data: [DONE]\n\n', chunk('b', 'never')])),
    )
    expect(out).toHaveLength(1)
    expect(out[0].id).toBe('a')
  })

  it('畸形 JSON 行被跳过,不影响后续帧', async () => {
    const out = await collect(
      parseChatStream(streamFrom(['data: {not-json\n\n', chunk('a', 'ok')])),
    )
    expect(out).toHaveLength(1)
    expect(out[0].id).toBe('a')
  })

  it('SSE 注释/心跳行与 event:/id: 行被跳过', async () => {
    const out = await collect(
      parseChatStream(streamFrom([': keep-alive\n\n', 'event: ping\n\n', 'id: 1\n\n', chunk('a', 'ok')])),
    )
    expect(out).toHaveLength(1)
    expect(out[0].id).toBe('a')
  })

  it('CRLF(\r\n)行尾正确处理', async () => {
    const out = await collect(parseChatStream(streamFrom([chunk('a', 'x').replace(/\n/g, '\r\n')])))
    expect(out).toHaveLength(1)
    expect(out[0].id).toBe('a')
  })

  it('无 finishReason 帧与含 finishReason 帧都正确解析', async () => {
    const last = `data: ${JSON.stringify({
      id: 'end',
      object: 'chat.completion.chunk',
      created: 1,
      model: 'm',
      choices: [{ index: 0, delta: {}, finishReason: 'stop' }],
    })}\n\n`
    const out = await collect(parseChatStream(streamFrom([chunk('a', 'x'), last])))
    expect(out).toHaveLength(2)
    expect(out[1].choices[0].finishReason).toBe('stop')
  })
})

describe('parseAgentStream — 事件解析', () => {
  it('data 行(JSON)→ {type:data};event: 行 → {type:event};普通行 → {type:raw}', async () => {
    const s = 'data: {"step":1}\n\nevent: tool_call\n\nplain text line\n\ndata: [DONE]\n\n'
    const out = await collect(parseAgentStream(streamFrom([s])))
    expect(out).toEqual([
      { type: 'data', data: { step: 1 } },
      { type: 'event', data: { name: 'tool_call' } },
      { type: 'raw', data: { text: 'plain text line' } },
    ])
  })

  it('data 行非 JSON → 回退 {type:raw}', async () => {
    const out = await collect(parseAgentStream(streamFrom(['data: <<heartbeat>>\n\ndata: [DONE]\n\n'])))
    expect(out).toEqual([{ type: 'raw', data: { text: '<<heartbeat>>' } }])
  })

  it('跨 chunk 断帧正确拼接', async () => {
    const frame = 'data: {"key":"value"}\n\n'
    const out = await collect(parseAgentStream(streamFrom([frame.slice(0, 10), frame.slice(10)])))
    expect(out).toEqual([{ type: 'data', data: { key: 'value' } }])
  })
})
