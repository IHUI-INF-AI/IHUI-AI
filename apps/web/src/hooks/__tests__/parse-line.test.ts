import { describe, it, expect } from 'vitest'
import {
  parseStreamLine,
  parseStreamLineReasoning,
  formatSSEError,
  getSSEErrorInfo,
} from '@ihui/api-client'

describe('parseStreamLine SSE 解析器(@ihui/api-client 共享版)', () => {
  it('空行返回 null', () => {
    expect(parseStreamLine('')).toBeNull()
  })

  it('SSE 注释行(冒号开头)返回 null', () => {
    expect(parseStreamLine(': heartbeat')).toBeNull()
    expect(parseStreamLine(':keep-alive')).toBeNull()
  })

  it('event/id/retry 元信息行返回 null', () => {
    expect(parseStreamLine('event: chunk')).toBeNull()
    expect(parseStreamLine('id: 12345')).toBeNull()
    expect(parseStreamLine('retry: 5000')).toBeNull()
  })

  it('data: [DONE] 返回 null', () => {
    expect(parseStreamLine('data: [DONE]')).toBeNull()
  })

  it('OpenAI 风格 SSE delta content 解析成功', () => {
    const line = 'data: {"choices":[{"delta":{"content":"hello"}}]}'
    expect(parseStreamLine(line)).toBe('hello')
  })

  it('OpenAI 风格 SSE message content 解析成功', () => {
    const line = 'data: {"choices":[{"message":{"content":"world"}}]}'
    expect(parseStreamLine(line)).toBe('world')
  })

  it('ai-service 风格 {"content":"..."} 解析成功', () => {
    const line = 'data: {"type":"chunk","content":"你好"}'
    expect(parseStreamLine(line)).toBe('你好')
  })

  it('Vercel AI SDK 0:"text" 协议解析成功', () => {
    const line = '0:"Vercel token"'
    expect(parseStreamLine(line)).toBe('Vercel token')
  })

  it('Vercel AI SDK 非 0 类型返回 null', () => {
    expect(parseStreamLine('1:{"tool":"search"}')).toBeNull()
    expect(parseStreamLine('2:{"finish":true}')).toBeNull()
  })

  it('非 JSON 裸文本返回内容', () => {
    expect(parseStreamLine('data: 纯文本内容')).toBe('纯文本内容')
    expect(parseStreamLine('裸文本无前缀')).toBe('裸文本无前缀')
  })

  it('SSE error 事件抛出 Error(name=SSEError,含 message)', () => {
    const line = 'data: {"type":"error","message":"LLM 调用超时"}'
    let caught: unknown = null
    try {
      parseStreamLine(line)
    } catch (e) {
      caught = e
    }
    expect(caught).toBeInstanceOf(Error)
    expect((caught as Error).name).toBe('SSEError')
    expect((caught as Error).message).toBe('LLM 调用超时')
  })

  it('LLM gateway error 响应抛出 Error(name=SSEError,含 error_message)', () => {
    const line = 'data: {"error":true,"error_message":"provider key 未配置"}'
    let caught: unknown = null
    try {
      parseStreamLine(line)
    } catch (e) {
      caught = e
    }
    expect(caught).toBeInstanceOf(Error)
    expect((caught as Error).name).toBe('SSEError')
    expect((caught as Error).message).toBe('provider key 未配置')
  })

  it('JSON 含 choices 但无 delta/message 内容返回 null', () => {
    const line = 'data: {"choices":[{"delta":{}}]}'
    expect(parseStreamLine(line)).toBeNull()
  })

  it('JSON 含 delta 字符串字段解析成功', () => {
    const line = 'data: {"delta":"streaming text"}'
    expect(parseStreamLine(line)).toBe('streaming text')
  })

  it('JSON 含 text 字符串字段解析成功', () => {
    const line = 'data: {"text":"plain text"}'
    expect(parseStreamLine(line)).toBe('plain text')
  })

  it('data: 前缀后无空格也能解析', () => {
    const line = 'data:{"content":"no space"}'
    expect(parseStreamLine(line)).toBe('no space')
  })

  it('done 事件(无 content 字符串)返回 null', () => {
    const line = 'data: {"type":"done","model":"step-3.7-flash","usage":{"total_tokens":100}}'
    expect(parseStreamLine(line)).toBeNull()
  })

  it('reasoning 事件 parseStreamLine 返回 null(避免混入 content)', () => {
    const line = 'data: {"type":"reasoning","content":"思考中..."}'
    expect(parseStreamLine(line)).toBeNull()
  })

  it('OpenAI delta reasoning_content parseStreamLine 返回 null', () => {
    const line = 'data: {"choices":[{"delta":{"reasoning_content":"why"}}]}'
    expect(parseStreamLine(line)).toBeNull()
  })
})

describe('parseStreamLineReasoning SSE reasoning 解析器', () => {
  it('空行返回 null', () => {
    expect(parseStreamLineReasoning('')).toBeNull()
  })

  it('event/id/retry 元信息行返回 null', () => {
    expect(parseStreamLineReasoning('event: reasoning')).toBeNull()
    expect(parseStreamLineReasoning('id: 12345')).toBeNull()
  })

  it('ai-service 风格 reasoning 事件解析成功', () => {
    const line = 'data: {"type":"reasoning","content":"思考中..."}'
    expect(parseStreamLineReasoning(line)).toBe('思考中...')
  })

  it('OpenAI delta reasoning_content 解析成功', () => {
    const line = 'data: {"choices":[{"delta":{"reasoning_content":"why"}}]}'
    expect(parseStreamLineReasoning(line)).toBe('why')
  })

  it('OpenAI message reasoning_content 解析成功', () => {
    const line = 'data: {"choices":[{"message":{"reasoning_content":"full reasoning"}}]}'
    expect(parseStreamLineReasoning(line)).toBe('full reasoning')
  })

  it('普通 content 事件返回 null(不误捕获)', () => {
    const line = 'data: {"type":"chunk","content":"hello"}'
    expect(parseStreamLineReasoning(line)).toBeNull()
  })

  it('done 事件返回 null', () => {
    const line = 'data: {"type":"done","model":"step-3.7-flash","usage":{"total_tokens":100}}'
    expect(parseStreamLineReasoning(line)).toBeNull()
  })

  it('非 JSON 裸文本返回 null', () => {
    expect(parseStreamLineReasoning('data: 纯文本内容')).toBeNull()
  })

  it('SSE error 事件抛出 SSEError', () => {
    const line = 'data: {"type":"error","message":"LLM 调用超时"}'
    expect(() => parseStreamLineReasoning(line)).toThrow('LLM 调用超时')
  })
})

/** 捕获 parseStreamLine 抛出的 SSEError,返回 Error 实例便于断言 */
function catchSSEError(line: string): Error {
  try {
    parseStreamLine(line)
  } catch (e) {
    return e as Error
  }
  return new Error('no error thrown')
}

describe('getSSEErrorInfo 从错误中提取元信息', () => {
  it('401 错误:从 message 文本括号内提取 code', () => {
    const e = catchSSEError('data: {"type":"error","message":"登录已过期（401）"}')
    const info = getSSEErrorInfo(e)
    expect(info?.code).toBe(401)
  })

  it('Error 对象挂载的 code 字段透传', () => {
    const e = new Error('rate limit') as Error & { code: number; retryAfter: number }
    e.name = 'SSEError'
    e.code = 429
    e.retryAfter = 30
    const info = getSSEErrorInfo(e)
    expect(info?.code).toBe(429)
    expect(info?.retryAfter).toBe(30)
  })

  it('plain object { code, errorCode, retryAfter }', () => {
    const info = getSSEErrorInfo({ code: 503, errorCode: 'UPSTREAM_DOWN', retryAfter: 60 })
    expect(info).toEqual({ code: 503, errorCode: 'UPSTREAM_DOWN', retryAfter: 60 })
  })

  it('字符串 "请求失败(500)" 中文括号也能解析', () => {
    const info = getSSEErrorInfo('请求失败(500)')
    expect(info?.code).toBe(500)
  })

  it('无 code/errorCode/retryAfter 时返回 undefined', () => {
    expect(getSSEErrorInfo('hello')).toBeUndefined()
    expect(getSSEErrorInfo(new Error('hi'))).toBeUndefined()
    expect(getSSEErrorInfo(null)).toBeUndefined()
    expect(getSSEErrorInfo(undefined)).toBeUndefined()
  })

  it('parseStreamLine 抛出的 SSEError 自动附带 code', () => {
    const e = catchSSEError(
      'data: {"type":"error","message":"too many","code":429,"errorCode":"RATE_LIMITED","retryAfter":60}',
    )
    expect(e.name).toBe('SSEError')
    const info = getSSEErrorInfo(e)
    expect(info?.code).toBe(429)
    expect(info?.errorCode).toBe('RATE_LIMITED')
    expect(info?.retryAfter).toBe(60)
  })

  it('OpenAI 错误格式 { "error": "rate limit", "code": 429 }', () => {
    const e = catchSSEError('data: {"error":"rate limit","code":429}')
    expect(e.name).toBe('SSEError')
    const info = getSSEErrorInfo(e)
    expect(info?.code).toBe(429)
  })
})

describe('formatSSEError 跨端统一错误格式化', () => {
  it('401 → severity=auth + requireReauth=true', () => {
    const e = catchSSEError('data: {"type":"error","message":"登录已过期（401）"}')
    const f = formatSSEError(e)
    expect(f.severity).toBe('auth')
    expect(f.requireReauth).toBe(true)
    expect(f.title).toBe('登录已过期')
    expect(f.code).toBe(401)
  })

  it('403 → severity=forbidden', () => {
    const e = catchSSEError('data: {"type":"error","message":"无权限","code":403}')
    const f = formatSSEError(e)
    expect(f.severity).toBe('forbidden')
    expect(f.title).toBe('访问被拒绝')
  })

  it('429 with retryAfter → severity=ratelimit + 提示秒数', () => {
    const e = catchSSEError(
      'data: {"type":"error","message":"too many","code":429,"retryAfter":30}',
    )
    const f = formatSSEError(e)
    expect(f.severity).toBe('ratelimit')
    expect(f.retryAfter).toBe(30)
    expect(f.message).toContain('30 秒')
  })

  it('500 → severity=server', () => {
    const e = catchSSEError('data: {"type":"error","message":"upstream down","code":500}')
    const f = formatSSEError(e)
    expect(f.severity).toBe('server')
    expect(f.title).toBe('AI 服务异常')
  })

  it('400 业务错误 → severity=server + message 透传 rawMessage', () => {
    const e = new Error('参数错误') as Error & { code: number }
    e.name = 'SSEError'
    e.code = 400
    const f = formatSSEError(e)
    expect(f.severity).toBe('server')
    expect(f.message).toBe('参数错误')
    expect(f.title).toBe('请求失败')
  })

  it('DOMException AbortError → severity=network + title=请求已取消', () => {
    const e = new DOMException('aborted', 'AbortError')
    const f = formatSSEError(e)
    expect(f.severity).toBe('network')
    expect(f.title).toBe('请求已取消')
  })

  it('网络错误 (Failed to fetch) → severity=network', () => {
    const f = formatSSEError(new Error('Failed to fetch'))
    expect(f.severity).toBe('network')
    expect(f.title).toBe('网络异常')
  })

  it('纯字符串错误 → fallback message', () => {
    const f = formatSSEError('some string error', 'AI 服务异常')
    expect(f.rawMessage).toBe('some string error')
  })

  it('null / undefined → fallback', () => {
    const f = formatSSEError(null, 'fallback')
    expect(f.rawMessage).toBe('fallback')
    expect(f.severity).toBe('unknown')
  })

  it('非 Error 对象 (string) 也能正常格式化', () => {
    const f = formatSSEError('请求失败(503)')
    expect(f.code).toBe(503)
    expect(f.severity).toBe('server')
  })

  it('custom fallback message', () => {
    const f = formatSSEError(undefined, '服务暂不可用')
    expect(f.rawMessage).toBe('服务暂不可用')
  })

  it('errorCode 业务码透传', () => {
    const e = catchSSEError(
      'data: {"type":"error","message":"配额用完","code":429,"errorCode":"QUOTA_EXHAUSTED","retryAfter":120}',
    )
    const f = formatSSEError(e)
    expect(f.errorCode).toBe('QUOTA_EXHAUSTED')
    expect(f.retryAfter).toBe(120)
  })
})
