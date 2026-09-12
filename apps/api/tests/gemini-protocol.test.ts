// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top

/**
 * Gemini 协议转换纯函数单测(2026-09-13 立)。
 * 被测模块 gemini-protocol.ts 零外部依赖(db/fastify 均不 import),无需 mock。
 */
import { describe, it, expect } from 'vitest'
import {
  geminiToChatBody,
  chatToGeminiResponse,
  geminiStreamChunk,
  geminiStreamFinalChunk,
  openAiErrorToGemini,
  mapFinishReason,
  mapGeminiErrorStatus,
  toGeminiModelEntry,
  geminiRequestSchema,
  type GeminiRequest,
} from '../src/services/gemini-protocol.js'
import type { V1ChatCompletionResponse } from '@ihui/types'

function parse(raw: unknown): GeminiRequest {
  return geminiRequestSchema.parse(raw) as GeminiRequest
}

describe('gemini-protocol — 入站转换 geminiToChatBody', () => {
  it('标准 contents(user/model)+ systemInstruction + generationConfig → chat body', () => {
    const req = parse({
      systemInstruction: { parts: [{ text: '你是助手' }] },
      contents: [
        { role: 'user', parts: [{ text: '你好' }] },
        { role: 'model', parts: [{ text: '你好!' }] },
        { role: 'user', parts: [{ text: '继续' }] },
      ],
      generationConfig: { temperature: 0.7, maxOutputTokens: 512 },
    })

    const result = geminiToChatBody('gemini-2.5-flash', req)
    expect(result.ok).toBe(true)
    if (!result.ok) return
    expect(result.body.messages).toEqual([
      { role: 'system', content: '你是助手' },
      { role: 'user', content: '你好' },
      { role: 'assistant', content: '你好!' },
      { role: 'user', content: '继续' },
    ])
    expect(result.body.model).toBe('gemini-2.5-flash')
    expect(result.body.temperature).toBe(0.7)
    expect(result.body.maxTokens).toBe(512)
    expect(result.body.stream).toBe(false)
  })

  it('parts 字符串简写与多 part 拼接', () => {
    const req = parse({
      contents: [{ parts: ['第一段'] }, { role: 'user', parts: [{ text: 'a' }, { text: 'b' }] }],
    })
    const result = geminiToChatBody('m', req)
    expect(result.ok).toBe(true)
    if (!result.ok) return
    expect(result.body.messages[0]).toEqual({ role: 'user', content: '第一段' })
    expect(result.body.messages[1]?.content).toBe('a\nb')
  })

  it('inlineData 多模态 part 被跳过(只取 text)', () => {
    const req = parse({
      contents: [
        { role: 'user', parts: [{ inlineData: { mimeType: 'image/png' } }, { text: '描述图' }] },
      ],
    })
    const result = geminiToChatBody('m', req)
    expect(result.ok).toBe(true)
    if (!result.ok) return
    expect(result.body.messages).toEqual([{ role: 'user', content: '描述图' }])
  })

  it('空 contents → ok:false(400 语义)', () => {
    const result = geminiToChatBody('m', parse({ contents: [] }))
    expect(result.ok).toBe(false)
    if (result.ok) return
    expect(result.message).toContain('empty')
  })

  it('全 inlineData 无 text → ok:false', () => {
    const result = geminiToChatBody(
      'm',
      parse({
        contents: [{ role: 'user', parts: [{ inlineData: { mimeType: 'image/png' } }] }],
      }),
    )
    expect(result.ok).toBe(false)
  })
})

describe('gemini-protocol — 出站转换 chatToGeminiResponse', () => {
  const chatResponse: V1ChatCompletionResponse = {
    id: 'chatcmpl-1',
    object: 'chat.completion',
    created: 1700000000,
    model: 'deepseek-chat',
    choices: [
      {
        index: 0,
        message: { role: 'assistant', content: '回答内容' },
        finish_reason: 'stop',
      },
    ],
    usage: { prompt_tokens: 10, completion_tokens: 20, total_tokens: 30 },
  }

  it('标准转换:candidates/finishReason/usageMetadata/modelVersion', () => {
    const out = chatToGeminiResponse(chatResponse)
    expect(out.candidates[0]).toEqual({
      content: { parts: [{ text: '回答内容' }], role: 'model' },
      finishReason: 'STOP',
      index: 0,
    })
    expect(out.usageMetadata).toEqual({
      promptTokenCount: 10,
      candidatesTokenCount: 20,
      totalTokenCount: 30,
    })
    expect(out.modelVersion).toBe('deepseek-chat')
  })

  it('finish_reason=length → MAX_TOKENS', () => {
    expect(mapFinishReason('length')).toBe('MAX_TOKENS')
    expect(mapFinishReason('content_filter')).toBe('SAFETY')
    expect(mapFinishReason('stop')).toBe('STOP')
    expect(mapFinishReason(null)).toBe('STOP')
  })

  it('usage 缺失 → token 按 0 计,total 为求和', () => {
    const noUsage = { ...chatResponse, usage: undefined } as unknown as V1ChatCompletionResponse
    const out = chatToGeminiResponse(noUsage)
    expect(out.usageMetadata).toEqual({
      promptTokenCount: 0,
      candidatesTokenCount: 0,
      totalTokenCount: 0,
    })
  })
})

describe('gemini-protocol — 流式 chunk', () => {
  it('文本 chunk 形状', () => {
    const chunk = geminiStreamChunk('hi', 'gemini-2.5-flash')
    expect(chunk.candidates[0]?.content.parts[0]?.text).toBe('hi')
    expect(chunk.candidates[0]?.content.role).toBe('model')
    expect(chunk.modelVersion).toBe('gemini-2.5-flash')
  })

  it('收尾 chunk 带 finishReason=STOP 与 usageMetadata', () => {
    const fin = geminiStreamFinalChunk('m', {
      promptTokenCount: 5,
      candidatesTokenCount: 7,
      totalTokenCount: 12,
    })
    expect(fin.candidates[0]?.finishReason).toBe('STOP')
    expect(fin.usageMetadata.totalTokenCount).toBe(12)
  })
})

describe('gemini-protocol — 错误映射', () => {
  it('HTTP 状态 → Gemini status 字符串', () => {
    expect(mapGeminiErrorStatus(400)).toBe('INVALID_ARGUMENT')
    expect(mapGeminiErrorStatus(401)).toBe('PERMISSION_DENIED')
    expect(mapGeminiErrorStatus(403)).toBe('PERMISSION_DENIED')
    expect(mapGeminiErrorStatus(402)).toBe('RESOURCE_EXHAUSTED')
    expect(mapGeminiErrorStatus(429)).toBe('RESOURCE_EXHAUSTED')
    expect(mapGeminiErrorStatus(404)).toBe('NOT_FOUND')
    expect(mapGeminiErrorStatus(503)).toBe('UNAVAILABLE')
    expect(mapGeminiErrorStatus(500)).toBe('INTERNAL')
  })

  it('OpenAI 错误体 {message} → Gemini error 结构', () => {
    const out = openAiErrorToGemini(429, { message: '余额不足' })
    expect(out.error).toEqual({ code: 429, message: '余额不足', status: 'RESOURCE_EXHAUSTED' })
  })

  it('嵌套 {error:{message}} 与未知形状容错', () => {
    expect(openAiErrorToGemini(400, { error: { message: 'bad' } }).error.message).toBe('bad')
    expect(openAiErrorToGemini(500, 'oops' as unknown).error.message).toBe('upstream error')
  })
})

describe('gemini-protocol — ListModels 条目', () => {
  it('name 前缀 models/ + 支持方法集', () => {
    const entry = toGeminiModelEntry('deepseek-chat', 'DeepSeek Chat')
    expect(entry).toEqual({
      name: 'models/deepseek-chat',
      displayName: 'DeepSeek Chat',
      supportedGenerationMethods: ['generateContent', 'streamGenerateContent', 'countTokens'],
    })
  })
})
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
