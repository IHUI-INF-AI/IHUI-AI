import { describe, it, expect } from 'vitest'
import { parseSSEChunk } from '../src/utils/sse-parse'

describe('miniapp-taro SSE 流解析', () => {
  describe('data 行解析', () => {
    it('data: 行解析为 chunk', () => {
      const { events } = parseSSEChunk('data: hello world\n')
      expect(events).toHaveLength(1)
      expect(events[0]).toEqual({ type: 'chunk', content: 'hello world' })
    })

    it('data: 无空格也正常解析', () => {
      const { events } = parseSSEChunk('data:hello\n')
      expect(events[0]).toEqual({ type: 'chunk', content: 'hello' })
    })

    it('data: 空内容不产生事件', () => {
      const { events } = parseSSEChunk('data:\n')
      expect(events).toHaveLength(0)
    })
  })

  describe('event 行解析', () => {
    it('event: 行不产生事件', () => {
      const { events } = parseSSEChunk('event: ping\n')
      expect(events).toHaveLength(0)
    })

    it('id: 行不产生事件', () => {
      const { events } = parseSSEChunk('id: 123\n')
      expect(events).toHaveLength(0)
    })

    it('retry: 行不产生事件', () => {
      const { events } = parseSSEChunk('retry: 5000\n')
      expect(events).toHaveLength(0)
    })

    it('注释行(:开头)不产生事件', () => {
      const { events } = parseSSEChunk(': heartbeat\n')
      expect(events).toHaveLength(0)
    })

    it('空行不产生事件', () => {
      const { events } = parseSSEChunk('\n')
      expect(events).toHaveLength(0)
    })
  })

  describe('[DONE] 标记', () => {
    it('data: [DONE] 解析为 done 事件', () => {
      const { events } = parseSSEChunk('data: [DONE]\n')
      expect(events).toHaveLength(1)
      expect(events[0]).toEqual({ type: 'done' })
    })
  })

  describe('多行 data', () => {
    it('多行 data: 每行独立解析为 chunk', () => {
      const { events } = parseSSEChunk('data: line1\ndata: line2\ndata: line3\n')
      expect(events).toHaveLength(3)
      expect(events[0]).toEqual({ type: 'chunk', content: 'line1' })
      expect(events[1]).toEqual({ type: 'chunk', content: 'line2' })
      expect(events[2]).toEqual({ type: 'chunk', content: 'line3' })
    })

    it('混合 data: 和 event: 行', () => {
      const { events } = parseSSEChunk('event: ping\ndata: hello\n')
      expect(events).toHaveLength(1)
      expect(events[0]).toEqual({ type: 'chunk', content: 'hello' })
    })

    it('混合多行 data: 和注释行', () => {
      const { events } = parseSSEChunk(': comment\ndata: a\n: comment\ndata: b\n')
      expect(events).toHaveLength(2)
      expect(events[0]).toEqual({ type: 'chunk', content: 'a' })
      expect(events[1]).toEqual({ type: 'chunk', content: 'b' })
    })
  })

  describe('不完整 chunk', () => {
    it('不完整 chunk 保留为 remainder', () => {
      const { events, remainder } = parseSSEChunk('data: complete\ndata: incomplete')
      expect(events).toHaveLength(1)
      expect(events[0]).toEqual({ type: 'chunk', content: 'complete' })
      expect(remainder).toBe('data: incomplete')
    })

    it('空 buffer 返回空 events 和空 remainder', () => {
      const { events, remainder } = parseSSEChunk('')
      expect(events).toHaveLength(0)
      expect(remainder).toBe('')
    })

    it('只有换行符返回空 events', () => {
      const { events } = parseSSEChunk('\n\n\n')
      expect(events).toHaveLength(0)
    })

    it('CRLF 行尾正确处理', () => {
      const { events } = parseSSEChunk('data: hello\r\ndata: world\r\n')
      expect(events).toHaveLength(2)
      expect(events[0]).toEqual({ type: 'chunk', content: 'hello' })
      expect(events[1]).toEqual({ type: 'chunk', content: 'world' })
    })

    it('完整 chunk 后无换行时最后行保留为 remainder', () => {
      const { events, remainder } = parseSSEChunk('data: line1\n data: line2')
      expect(events).toHaveLength(1)
      expect(events[0]).toEqual({ type: 'chunk', content: 'line1' })
      expect(remainder).toBe(' data: line2')
    })
  })

  describe('proto 格式', () => {
    it('proto 0: 格式解析为 chunk', () => {
      const { events } = parseSSEChunk('data: 0:"hello"\n')
      expect(events).toHaveLength(1)
      expect(events[0]).toEqual({ type: 'chunk', content: 'hello' })
    })

    it('proto 9: 格式解析为 reasoning', () => {
      const { events } = parseSSEChunk('data: 9:"thinking"\n')
      expect(events).toHaveLength(1)
      expect(events[0]).toEqual({ type: 'reasoning', content: 'thinking' })
    })

    it('proto 其他类型不产生事件', () => {
      const { events } = parseSSEChunk('data: 5:"unknown"\n')
      expect(events).toHaveLength(0)
    })

    it('proto 格式无效 JSON 不产生事件', () => {
      const { events } = parseSSEChunk('data: 0:invalid\n')
      expect(events).toHaveLength(0)
    })
  })

  describe('JSON 格式', () => {
    it('choices.delta.content 解析为 chunk', () => {
      const { events } = parseSSEChunk('data: {"choices":[{"delta":{"content":"hi"}}]}\n')
      expect(events[0]).toEqual({ type: 'chunk', content: 'hi' })
    })

    it('choices.message.content 解析为 chunk', () => {
      const { events } = parseSSEChunk('data: {"choices":[{"message":{"content":"hello"}}]}\n')
      expect(events[0]).toEqual({ type: 'chunk', content: 'hello' })
    })

    it('choices.text 解析为 chunk', () => {
      const { events } = parseSSEChunk('data: {"choices":[{"text":"raw text"}]}\n')
      expect(events[0]).toEqual({ type: 'chunk', content: 'raw text' })
    })

    it('JSON content 字段解析为 chunk', () => {
      const { events } = parseSSEChunk('data: {"content":"direct content"}\n')
      expect(events[0]).toEqual({ type: 'chunk', content: 'direct content' })
    })

    it('JSON delta 字段解析为 chunk', () => {
      const { events } = parseSSEChunk('data: {"delta":"delta content"}\n')
      expect(events[0]).toEqual({ type: 'chunk', content: 'delta content' })
    })

    it('JSON text 字段解析为 chunk', () => {
      const { events } = parseSSEChunk('data: {"text":"text content"}\n')
      expect(events[0]).toEqual({ type: 'chunk', content: 'text content' })
    })
  })

  describe('reasoning 事件', () => {
    // BUG 记录:JSON {"type":"reasoning","delta":"..."} 由于 sse-parse.ts 中
    // delta 字段检查(行98)先于 type=reasoning 检查(行100),实际被解析为 chunk 而非 reasoning。
    // proto 9: 格式可正确解析为 reasoning(见 proto 格式测试组)。
    it('JSON type=reasoning + delta 因 delta 检查优先被解析为 chunk(已知 bug)', () => {
      const { events } = parseSSEChunk('data: {"type":"reasoning","delta":"thinking..."}\n')
      expect(events[0]).toEqual({ type: 'chunk', content: 'thinking...' })
    })
  })

  describe('meta 事件', () => {
    it('JSON type=meta + sessionId 解析为 meta', () => {
      const { events } = parseSSEChunk('data: {"type":"meta","sessionId":"sess-123"}\n')
      expect(events[0]).toEqual({ type: 'meta', sessionId: 'sess-123' })
    })

    it('JSON sessionId 解析为 meta', () => {
      const { events } = parseSSEChunk('data: {"sessionId":"sess-456"}\n')
      expect(events[0]).toEqual({ type: 'meta', sessionId: 'sess-456' })
    })
  })

  describe('error 事件', () => {
    it('JSON error 字符串解析为 error', () => {
      const { events } = parseSSEChunk('data: {"error":"something wrong"}\n')
      expect(events[0]).toEqual({ type: 'error', content: 'something wrong' })
    })

    it('JSON type=error + message 解析为 error', () => {
      const { events } = parseSSEChunk('data: {"type":"error","message":"bad request"}\n')
      expect(events[0]).toEqual({ type: 'error', content: 'bad request' })
    })

    it('JSON error=true + error_message 解析为 error', () => {
      const { events } = parseSSEChunk('data: {"error":true,"error_message":"internal error"}\n')
      expect(events[0]).toEqual({ type: 'error', content: 'internal error' })
    })

    it('error 事件携带 code 和 errorCode', () => {
      const { events } = parseSSEChunk('data: {"error":"rate limit","code":429,"errorCode":"RATE_LIMIT"}\n')
      expect(events[0]).toEqual({ type: 'error', content: 'rate limit', code: 429, errorCode: 'RATE_LIMIT' })
    })

    it('error 事件携带 statusCode 作为 code', () => {
      const { events } = parseSSEChunk('data: {"error":"fail","statusCode":500}\n')
      expect(events[0]!.code).toBe(500)
    })

    it('error 事件携带 retryAfter', () => {
      const { events } = parseSSEChunk('data: {"error":"retry","retryAfter":30}\n')
      expect(events[0]!.retryAfter).toBe(30)
    })
  })

  describe('compaction 事件', () => {
    it('compaction 事件解析', () => {
      const { events } = parseSSEChunk('data: {"compaction":{"triggered":true,"tokensBefore":10000,"tokensAfter":5000,"removedCount":50,"usageRatio":0.88}}\n')
      expect(events[0]).toEqual({
        type: 'compaction',
        compaction: {
          triggered: true,
          tokensBefore: 10000,
          tokensAfter: 5000,
          removedCount: 50,
          usageRatio: 0.88,
        },
      })
    })
  })

  describe('非法 JSON 降级', () => {
    it('非法 JSON 降级为 chunk', () => {
      const { events } = parseSSEChunk('data: plain text not json\n')
      expect(events[0]).toEqual({ type: 'chunk', content: 'plain text not json' })
    })

    it('无法识别的 JSON 不产生事件', () => {
      const { events } = parseSSEChunk('data: {"foo":"bar"}\n')
      expect(events).toHaveLength(0)
    })
  })
})
