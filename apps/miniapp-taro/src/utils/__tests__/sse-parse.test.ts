import { describe, it, expect } from 'vitest'
import { parseSSEChunk, type SSEEvent } from '../sse-parse'

describe('parseSSEChunk miniapp-taro SSE 错误码透传', () => {
  it('new format: type=error 携带 code 字段透传', () => {
    const { events } = parseSSEChunk(
      'data: {"type":"error","message":"token expired","code":401}\n',
    )
    expect(events).toHaveLength(1)
    const e = events[0] as SSEEvent
    expect(e.type).toBe('error')
    expect(e.content).toBe('token expired')
    expect(e.code).toBe(401)
  })

  it('new format: statusCode 字段名同样能透传', () => {
    const { events } = parseSSEChunk(
      'data: {"type":"error","message":"degraded","statusCode":503}\n',
    )
    expect(events[0]?.code).toBe(503)
  })

  it('new format: errorCode + retryAfter 业务错误码', () => {
    const { events } = parseSSEChunk(
      'data: {"type":"error","message":"too many","code":429,"errorCode":"RATE_LIMITED","retryAfter":60}\n',
    )
    const e = events[0] as SSEEvent
    expect(e.code).toBe(429)
    expect(e.errorCode).toBe('RATE_LIMITED')
    expect(e.retryAfter).toBe(60)
  })

  it('legacy format: error=true 同样支持 code 透传', () => {
    const { events } = parseSSEChunk(
      'data: {"error":true,"error_message":"server key 未配置","code":500}\n',
    )
    expect(events[0]?.code).toBe(500)
  })

  it('OpenAI choices error 格式 code 透传', () => {
    const { events } = parseSSEChunk('data: {"error":"rate limit","code":429,"retryAfter":30}\n')
    expect(events[0]?.code).toBe(429)
    expect(events[0]?.retryAfter).toBe(30)
  })

  it('无 code 字段时不挂 code(向后兼容)', () => {
    const { events } = parseSSEChunk('data: {"type":"error","message":"未知错误"}\n')
    expect(events[0]?.code).toBeUndefined()
  })

  it('正常 chunk 事件不受影响', () => {
    const { events } = parseSSEChunk('data: {"type":"chunk","content":"hello"}\n')
    expect(events[0]?.type).toBe('chunk')
    expect(events[0]?.content).toBe('hello')
  })
})
