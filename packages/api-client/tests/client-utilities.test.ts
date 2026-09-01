// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

import { describe, it, expect, vi, afterEach } from 'vitest'
import {
  parseStreamLine,
  extractAgentId,
  parseFallbackEvent,
  parseStreamLineReasoning,
  getSSEErrorInfo,
  formatSSEError,
  isAbortError,
  mergeAbortSignals,
} from '../src/client.js'
import { setTransport, type Transport } from '../src/transport.js'
import { compactConversation } from '../src/endpoints/chat.js'

describe('parseStreamLine', () => {
  it('返回 null for 空行', () => {
    expect(parseStreamLine('')).toBeNull()
  })

  it('返回 null for 注释行', () => {
    expect(parseStreamLine(': ping')).toBeNull()
  })

  it('返回 null for event:/id:/retry: 行', () => {
    expect(parseStreamLine('event: message')).toBeNull()
    expect(parseStreamLine('id: 123')).toBeNull()
    expect(parseStreamLine('retry: 3000')).toBeNull()
  })

  it('返回 null for [DONE]', () => {
    expect(parseStreamLine('data: [DONE]')).toBeNull()
  })

  it('解析 data: 前缀的文本 token', () => {
    expect(parseStreamLine('data: hello world')).toBe('hello world')
  })

  it('解析 JSON delta.content', () => {
    const line = 'data: {"choices":[{"delta":{"content":"hello"}}]}'
    expect(parseStreamLine(line)).toBe('hello')
  })

  it('解析 JSON text 字段', () => {
    const line = 'data: {"text":"direct text"}'
    expect(parseStreamLine(line)).toBe('direct text')
  })

  it('解析 Vercel AI SDK 0: 协议文本 token', () => {
    const line = 'data: 0:"vercel token"'
    expect(parseStreamLine(line)).toBe('vercel token')
  })

  it('对 type=reasoning 返回 null', () => {
    const line = 'data: {"type":"reasoning","content":"thinking..."}'
    expect(parseStreamLine(line)).toBeNull()
  })

  it('对 type=error 抛 SSEError', () => {
    const line = 'data: {"type":"error","message":"rate limited"}'
    expect(() => parseStreamLine(line)).toThrow('rate limited')
  })

  it('对 error=true 格式抛 SSEError', () => {
    const line = 'data: {"error":true,"error_message":"something failed"}'
    expect(() => parseStreamLine(line)).toThrow('something failed')
  })

  it('对 OpenAI error 对象格式(嵌套对象)不抛错,返回 null(delta 解析)', () => {
    // json.error 是对象而非字符串,parseStreamLine 的 typeof 检查不匹配,
    // 会回退到 delta/choice 解析路径,返回 null 而非抛错
    const line = 'data: {"error":{"message":"rate limit exceeded","code":"429"}}'
    expect(parseStreamLine(line)).toBeNull()
  })

  it('对 error 字符串格式(含 message)抛错', () => {
    const line = 'data: {"error":"rate limit exceeded","code":"429"}'
    expect(() => parseStreamLine(line)).toThrow('rate limit exceeded')
  })

  it('非 JSON 数据原样返回', () => {
    expect(parseStreamLine('data: plain text no json')).toBe('plain text no json')
  })

  it('对 code+message 格式抛错', () => {
    const line = 'data: {"code":"RATE_LIMIT","retryAfter":60,"message":"too many requests"}'
    expect(() => parseStreamLine(line)).toThrow('too many requests')
  })
})

describe('compactConversation(POST /api/chat/compact 手动压缩)', () => {
  afterEach(() => {
    // 恢复默认 transport,避免污染其他用例
    setTransport(undefined as unknown as Transport)
  })

  it('发送 POST /api/chat/compact + body {conversationId},2xx 且 code=0 时解包 data', async () => {
    const payload = {
      compressed: true,
      originalTokens: 1000,
      compressedTokens: 690,
      removedCount: 2,
      trigger: 'ratio',
    }
    const transport = vi.fn(async () => ({
      ok: true,
      status: 200,
      headers: { get: () => null },
      text: async () => '',
      json: async () => ({ code: 0, message: 'success', data: payload }),
    }))
    setTransport(transport as unknown as Transport)

    const result = await compactConversation('conv-1')
    expect(transport).toHaveBeenCalledTimes(1)
    const [url, init] = transport.mock.calls[0] as [string, RequestInit]
    expect(url).toContain('/api/chat/compact')
    expect(init.method).toBe('POST')
    expect(JSON.parse(init.body as string)).toEqual({ conversationId: 'conv-1' })
    expect(result).toEqual({ success: true, data: payload })
  })

  it('404(会话不存在/无权限)→ 返回 success:false + status,不抛错', async () => {
    const transport = vi.fn(async () => ({
      ok: false,
      status: 404,
      headers: { get: () => null },
      text: async () => JSON.stringify({ code: 404, message: '对话不存在或无权限' }),
      json: async () => ({ code: 404, message: '对话不存在或无权限' }),
    }))
    setTransport(transport as unknown as Transport)

    const result = await compactConversation('conv-404')
    expect(transport).toHaveBeenCalledTimes(1)
    expect(result).toMatchObject({
      success: false,
      error: '对话不存在或无权限',
      status: 404,
    })
  })
})

describe('extractAgentId', () => {
  it('从 JSON 中提取 agentId', () => {
    const line = 'data: {"choices":[{"delta":{"content":"hi"}}],"agentId":"agent-1"}'
    expect(extractAgentId(line)).toBe('agent-1')
  })

  it('无 agentId 返回 undefined', () => {
    const line = 'data: {"choices":[{"delta":{"content":"hi"}}]}'
    expect(extractAgentId(line)).toBeUndefined()
  })

  it('空行返回 undefined', () => {
    expect(extractAgentId('')).toBeUndefined()
  })

  it('注释行返回 undefined', () => {
    expect(extractAgentId(': ping')).toBeUndefined()
  })

  it('非 JSON 返回 undefined', () => {
    expect(extractAgentId('data: plain text')).toBeUndefined()
  })

  it('Vercel AI SDK 协议返回 undefined', () => {
    expect(extractAgentId('data: 0:"token"')).toBeUndefined()
  })
})

describe('parseFallbackEvent', () => {
  it('解析 fallback 事件', () => {
    const line =
      'data: {"type":"fallback","primary_model":"gpt-4","backup_model":"gpt-3.5","reason":"timeout"}'
    const result = parseFallbackEvent(line)
    expect(result).toEqual({
      primaryModel: 'gpt-4',
      backupModel: 'gpt-3.5',
      reason: 'timeout',
    })
  })

  it('非 fallback 事件返回 null', () => {
    const line = 'data: {"type":"message","content":"hello"}'
    expect(parseFallbackEvent(line)).toBeNull()
  })

  it('缺失 primary_model 返回 null', () => {
    const line = 'data: {"type":"fallback","backup_model":"gpt-3.5"}'
    expect(parseFallbackEvent(line)).toBeNull()
  })

  it('空行返回 null', () => {
    expect(parseFallbackEvent('')).toBeNull()
  })

  it('注释行返回 null', () => {
    expect(parseFallbackEvent(': ping')).toBeNull()
  })

  it('[DONE] 返回 null', () => {
    expect(parseFallbackEvent('data: [DONE]')).toBeNull()
  })
})

describe('parseStreamLineReasoning', () => {
  it('解析 reasoning content', () => {
    const line = 'data: {"type":"reasoning","content":"let me think"}'
    expect(parseStreamLineReasoning(line)).toBe('let me think')
  })

  it('解析 delta.reasoning_content', () => {
    const line = 'data: {"choices":[{"delta":{"reasoning_content":"thinking"}}]}'
    expect(parseStreamLineReasoning(line)).toBe('thinking')
  })

  it('type=error 抛错', () => {
    const line = 'data: {"type":"error","message":"bad request"}'
    expect(() => parseStreamLineReasoning(line)).toThrow('bad request')
  })

  it('非 reasoning 返回 null', () => {
    const line = 'data: {"type":"delta","content":"hello"}'
    expect(parseStreamLineReasoning(line)).toBeNull()
  })

  it('[DONE] 返回 null', () => {
    expect(parseStreamLineReasoning('data: [DONE]')).toBeNull()
  })
})

describe('getSSEErrorInfo', () => {
  it('从 Error 对象提取 code/errorCode/retryAfter', () => {
    const err = new Error('fail')
    ;(err as any).code = 429
    ;(err as any).errorCode = 'RATE_LIMIT'
    ;(err as any).retryAfter = 60
    const info = getSSEErrorInfo(err)
    expect(info?.code).toBe(429)
    expect(info?.errorCode).toBe('RATE_LIMIT')
    expect(info?.retryAfter).toBe(60)
  })

  it('从错误消息文本提取状态码', () => {
    const err = new Error('请求失败（403）')
    const info = getSSEErrorInfo(err)
    expect(info?.code).toBe(403)
  })

  it('从 statusCode 字段提取', () => {
    const err = new Error('fail')
    ;(err as any).statusCode = 502
    const info = getSSEErrorInfo(err)
    expect(info?.code).toBe(502)
  })

  it('无匹配信息返回 undefined', () => {
    expect(getSSEErrorInfo(new Error('network error'))).toBeUndefined()
    expect(getSSEErrorInfo('')).toBeUndefined()
    expect(getSSEErrorInfo(null)).toBeUndefined()
  })

  it('从字符串提取 code= 和 errorCode= 模式', () => {
    const info = getSSEErrorInfo('code=429 errorCode=RATE_LIMIT')
    expect(info?.code).toBe(429)
    expect(info?.errorCode).toBe('RATE_LIMIT')
  })
})

describe('formatSSEError', () => {
  it('401 错误识别为 auth 严重级', () => {
    const err = new Error('unauthorized')
    ;(err as any).code = 401
    const f = formatSSEError(err)
    expect(f.severity).toBe('auth')
    expect(f.requireReauth).toBe(true)
    expect(f.title).toBe('登录已过期')
  })

  it('403 错误识别为 forbidden 严重级', () => {
    const err = new Error('forbidden')
    ;(err as any).code = 403
    const f = formatSSEError(err)
    expect(f.severity).toBe('forbidden')
    expect(f.title).toBe('访问被拒绝')
  })

  it('429 错误识别为 ratelimit 严重级', () => {
    const err = new Error('too many')
    ;(err as any).code = 429
    ;(err as any).retryAfter = 30
    const f = formatSSEError(err)
    expect(f.severity).toBe('ratelimit')
    expect(f.message).toContain('30 秒后重试')
  })

  it('500+ 错误识别为 server 严重级', () => {
    const err = new Error('internal')
    ;(err as any).code = 500
    const f = formatSSEError(err)
    expect(f.severity).toBe('server')
    expect(f.title).toBe('AI 服务异常')
  })

  it('安全策略拦截识别为 safety 严重级', () => {
    const err = new Error(
      'Your request was rejected as a result of our safety system and has been blocked',
    )
    const f = formatSSEError(err)
    expect(f.severity).toBe('safety')
  })

  it('网络错误识别为 network 严重级', () => {
    const f = formatSSEError(new Error('Failed to fetch'))
    expect(f.severity).toBe('network')
    expect(f.title).toBe('网络异常')
  })

  it('未知错误识别为 unknown 严重级', () => {
    const f = formatSSEError('some random error')
    expect(f.severity).toBe('unknown')
    expect(f.title).toBe('AI 服务异常')
  })

  it('fallback message 在未知错误时显示', () => {
    const f = formatSSEError({}, 'custom fallback')
    expect(f.rawMessage).toBe('custom fallback')
  })
})

describe('isAbortError', () => {
  it('识别 DOMException AbortError', () => {
    if (typeof DOMException !== 'undefined') {
      const err = new DOMException('Aborted', 'AbortError')
      expect(isAbortError(err)).toBe(true)
    }
  })

  it('在 DOMException 不存在时通过 name 检查识别', () => {
    // Node.js 中 DOMException 存在,普通 Error 不会匹配;
    // 在 weapp 等无 DOMException 环境,Error name='AbortError' 会通过
    const originalDOM = (globalThis as any).DOMException
    ;(globalThis as any).DOMException = undefined
    try {
      const err = new Error('Aborted')
      err.name = 'AbortError'
      expect(isAbortError(err)).toBe(true)
    } finally {
      ;(globalThis as any).DOMException = originalDOM
    }
  })

  it('非 AbortError 返回 false', () => {
    expect(isAbortError(new Error('network'))).toBe(false)
    expect(isAbortError(null)).toBe(false)
  })
})

describe('mergeAbortSignals', () => {
  it('合并多个 signal，一个 abort 时合并 signal 也 abort', () => {
    const c1 = new AbortController()
    const c2 = new AbortController()
    const merged = mergeAbortSignals([c1.signal, c2.signal])
    expect(merged.aborted).toBe(false)

    c1.abort()
    expect(merged.aborted).toBe(true)
  })

  it('传入已 abort 的 signal 立即返回 abort 的合并 signal', () => {
    const aborted = new AbortController()
    aborted.abort()
    const c2 = new AbortController()
    const merged = mergeAbortSignals([aborted.signal, c2.signal])
    expect(merged.aborted).toBe(true)
  })

  it('过滤 null/undefined signal', () => {
    const c1 = new AbortController()
    const merged = mergeAbortSignals([c1.signal, null, undefined])
    expect(merged.aborted).toBe(false)
    c1.abort()
    expect(merged.aborted).toBe(true)
  })

  it('空数组返回未 abort 的 signal', () => {
    const merged = mergeAbortSignals([])
    expect(merged.aborted).toBe(false)
  })

  it('第二个 signal abort 也触发合并 abort', () => {
    const c1 = new AbortController()
    const c2 = new AbortController()
    const merged = mergeAbortSignals([c1.signal, c2.signal])
    c2.abort()
    expect(merged.aborted).toBe(true)
  })
})
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
