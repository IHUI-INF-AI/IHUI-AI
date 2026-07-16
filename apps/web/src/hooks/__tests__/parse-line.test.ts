import { describe, it, expect } from 'vitest'
import { parseStreamLine } from '@ihui/api-client'

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
})
