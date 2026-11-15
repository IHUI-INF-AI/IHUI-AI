// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * 思维链翻译服务:语言自检 + 哈希缓存 + 失败分级。
 *
 * 钉住三条判据:
 *  1) 目标语言与原文同语 → skipped,且**不调用上游**(不烧 token);
 *  2) 同一段文本第二次翻译 → cached=true,上游只被调一次;
 *  3) 上游 stub/空结果 → 抛结构化错误,调用方据此降级为"只有原文"。
 */

import { beforeEach, describe, expect, it, vi } from 'vitest'

const mocks = vi.hoisted(() => ({
  aiServiceFetch: vi.fn(),
  recordAiCost: vi.fn(),
}))

vi.mock('../src/utils/ai-service-fetch.js', () => ({
  aiServiceFetch: mocks.aiServiceFetch,
}))
vi.mock('../src/plugins/ai-cost.js', () => ({
  recordAiCost: mocks.recordAiCost,
}))
vi.mock('../src/utils/retired-providers.js', () => ({
  resolveDefaultChatModel: () => 'test-model',
}))

import {
  ReasoningTranslationError,
  clearReasoningTranslationCache,
  reasoningTranslationCacheKey,
  shouldSkipReasoningTranslation,
  translateReasoning,
} from '../src/services/reasoning-translation-service.js'

function okResponse(content: string) {
  return {
    ok: true,
    json: async () => ({ content, usage: { prompt_tokens: 10, completion_tokens: 12 } }),
  }
}

beforeEach(() => {
  vi.clearAllMocks()
  clearReasoningTranslationCache()
})

describe('shouldSkipReasoningTranslation', () => {
  it('中文原文译成中文 → 跳过', () => {
    expect(shouldSkipReasoningTranslation('我需要先检查配置,然后重试请求。', 'zh-CN')).toBe(true)
  })

  it('英文原文译成英文 → 跳过', () => {
    expect(
      shouldSkipReasoningTranslation('I should check the config and retry the request.', 'en'),
    ).toBe(true)
  })

  it('英文原文译成中文 → 需要翻译', () => {
    expect(
      shouldSkipReasoningTranslation('I should check the config and retry the request.', 'zh-CN'),
    ).toBe(false)
  })

  it('代码块与路径不参与语言判定(不稀释中文占比)', () => {
    const text =
      '我先检查配置,然后重试请求。\n\n```ts\nconst x = 1\n```\n\n见 /src/index.ts 与 https://example.com'
    expect(shouldSkipReasoningTranslation(text, 'zh-CN')).toBe(true)
  })

  it('空内容 → 跳过', () => {
    expect(shouldSkipReasoningTranslation('   ', 'en')).toBe(true)
  })
})

describe('translateReasoning', () => {
  it('同语跳过时不调用上游', async () => {
    const res = await translateReasoning(null, {
      text: '这是一段中文思考,内容足够长用于判定。',
      targetLang: 'zh-CN',
    })
    expect(res.skipped).toBe(true)
    expect(mocks.aiServiceFetch).not.toHaveBeenCalled()
  })

  it('首次翻译调上游,第二次命中哈希缓存', async () => {
    mocks.aiServiceFetch.mockResolvedValue(okResponse('First check the config, then retry.'))

    const first = await translateReasoning(null, {
      text: 'I should inspect the config file before retrying the failed request.',
      targetLang: 'zh-CN',
    })
    expect(first.cached).toBe(false)
    expect(first.translated).toBe('First check the config, then retry.')
    expect(mocks.aiServiceFetch).toHaveBeenCalledTimes(1)

    const second = await translateReasoning(null, {
      text: 'I should inspect the config file before retrying the failed request.',
      targetLang: 'zh-CN',
    })
    expect(second.cached).toBe(true)
    expect(mocks.aiServiceFetch).toHaveBeenCalledTimes(1)
  })

  it('不同目标语言使用不同缓存键', () => {
    const a = reasoningTranslationCacheKey('hello world', 'zh-CN')
    const b = reasoningTranslationCacheKey('hello world', 'ja')
    expect(a).not.toBe(b)
  })

  it('上游 stub → 抛 upstream 错误', async () => {
    mocks.aiServiceFetch.mockResolvedValue({
      ok: true,
      json: async () => ({ stub: true }),
    })
    await expect(
      translateReasoning(null, {
        text: 'I will read the file and then decide next steps.',
        targetLang: 'zh-CN',
      }),
    ).rejects.toBeInstanceOf(ReasoningTranslationError)
  })

  it('超长原文 → 抛 too_long 且不打上游', async () => {
    await expect(
      translateReasoning(null, { text: 'a'.repeat(9000), targetLang: 'zh-CN' }),
    ).rejects.toMatchObject({ code: 'too_long' })
    expect(mocks.aiServiceFetch).not.toHaveBeenCalled()
  })
})
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
