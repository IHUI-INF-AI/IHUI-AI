// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * 已知模型徽章查表回归锁(2026-11-23 立)。
 *
 * 旧实现 `modelId.includes(k) || k.includes(modelId)` 是任意双向子串包含:
 * `openai/gpt-5.4` 会命中 `openai/gpt-5` 的 locked 标记,用户在列表里看到一把
 * 本该不存在的锁。本测钉住查表口径为「规范化后逐字精确匹配」:
 * 小写 + 去首尾空白 + 去号池后缀 ` [provider]`,只剥离明确列举的 `-YYYYMMDD` / `-latest`,
 * 不再回退到子串包含。
 */
import { describe, expect, it } from 'vitest'

import { lookupKnownMeta } from '../model-selector'

describe('lookupKnownMeta 规范化精确匹配', () => {
  it('openai/gpt-5.4 不误命中 openai/gpt-5 的 locked 标记', () => {
    expect(lookupKnownMeta('openai/gpt-5.4').locked).not.toBe(true)
  })

  it('openai/gpt-5 仍保持 locked', () => {
    expect(lookupKnownMeta('openai/gpt-5').locked).toBe(true)
  })

  it('anthropic/claude-3-opus 保持 locked', () => {
    expect(lookupKnownMeta('anthropic/claude-3-opus').locked).toBe(true)
  })

  it('claude-3-5-sonnet 裸名与带日期后缀的同一模型结果一致(带日期不丢标记)', () => {
    const bare = lookupKnownMeta('anthropic/claude-3-5-sonnet')
    const dated = lookupKnownMeta('anthropic/claude-3-5-sonnet-20250101')
    expect(dated).toEqual(bare)
  })

  it('claude-3-opus 带日期后缀后仍 locked', () => {
    expect(lookupKnownMeta('anthropic/claude-3-opus-20250101').locked).toBe(true)
  })

  it('大小写、首尾空白与号池后缀 [provider] 规范化后仍命中', () => {
    expect(lookupKnownMeta('  OpenAI/GPT-5  ').locked).toBe(true)
    expect(lookupKnownMeta('openai/gpt-5 [号池备注]').locked).toBe(true)
  })

  it('-latest 后缀剥离后仍命中已知标记', () => {
    expect(lookupKnownMeta('openai/gpt-5-latest').locked).toBe(true)
  })

  it('未知模型返回空元数据,不沾任何徽章/锁定', () => {
    expect(lookupKnownMeta('openai/gpt-5.4-pro-unknown')).toEqual({})
    expect(lookupKnownMeta('')).toEqual({})
  })
})
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
