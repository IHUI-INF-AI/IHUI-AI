// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

import { describe, it, expect } from 'vitest'
import {
  DEFAULT_CONTEXT_CAPACITY,
  getModelContextCapacity,
  formatTokenCount,
} from '../src/model-context-capacity.js'

describe('getModelContextCapacity 精确命中', () => {
  it('OpenAI: gpt-4o → 128000', () => {
    expect(getModelContextCapacity('gpt-4o')).toBe(128_000)
  })

  it('Google: gemini-2.5-pro → 2097152', () => {
    expect(getModelContextCapacity('gemini-2.5-pro')).toBe(2_097_152)
  })

  it('DeepSeek: deepseek-chat → 64000', () => {
    expect(getModelContextCapacity('deepseek-chat')).toBe(64_000)
  })

  it('Moonshot: moonshot-v1-8k → 8000', () => {
    expect(getModelContextCapacity('moonshot-v1-8k')).toBe(8_000)
  })

  it('百度: ernie-speed-128k → 128000', () => {
    expect(getModelContextCapacity('ernie-speed-128k')).toBe(128_000)
  })

  it('StepFun: stepfun/step-3.7-flash → 8000', () => {
    expect(getModelContextCapacity('stepfun/step-3.7-flash')).toBe(8_000)
  })
})

describe('getModelContextCapacity 厂商模糊匹配(未命中精确表)', () => {
  it('含 claude → 200000', () => {
    expect(getModelContextCapacity('claude-sonnet-4-5-20250929')).toBe(200_000)
  })

  it('含 gemini → 1048576', () => {
    expect(getModelContextCapacity('gemini-2.5-flash-preview')).toBe(1_048_576)
  })

  it('含 deepseek → 64000', () => {
    expect(getModelContextCapacity('deepseek-r1-distill')).toBe(64_000)
  })
})

describe('getModelContextCapacity 显式 8k 词边界仍生效', () => {
  it('faketest-model-8k → 8000', () => {
    expect(getModelContextCapacity('faketest-model-8k')).toBe(8_000)
  })

  it('faketest-model-8000 → 8000', () => {
    expect(getModelContextCapacity('faketest-model-8000')).toBe(8_000)
  })
})

describe('getModelContextCapacity 版本号误匹配已修复', () => {
  it('faketest-model-v3-0802 → 128000(不再命中 8K)', () => {
    expect(getModelContextCapacity('faketest-model-v3-0802')).toBe(128_000)
    expect(getModelContextCapacity('faketest-model-v3-0802')).not.toBe(8_000)
  })

  it('faketest-model-1.5-preview-0718 → 128000', () => {
    expect(getModelContextCapacity('faketest-model-1.5-preview-0718')).toBe(128_000)
    expect(getModelContextCapacity('faketest-model-1.5-preview-0718')).not.toBe(8_000)
  })
})

describe('getModelContextCapacity 厂商默认值优先于 8k 规则', () => {
  it('faketest-glm-4-air-8k → 128000(glm 规则在末尾 8k 规则之前)', () => {
    expect(getModelContextCapacity('faketest-glm-4-air-8k')).toBe(128_000)
    expect(getModelContextCapacity('faketest-glm-4-air-8k')).not.toBe(8_000)
  })
})

describe('getModelContextCapacity 未知模型兜底', () => {
  it('totally-unknown-model → DEFAULT_CONTEXT_CAPACITY(128000)', () => {
    expect(DEFAULT_CONTEXT_CAPACITY).toBe(128_000)
    expect(getModelContextCapacity('totally-unknown-model')).toBe(DEFAULT_CONTEXT_CAPACITY)
    expect(getModelContextCapacity('totally-unknown-model')).toBe(128_000)
  })

  it('空字符串 → DEFAULT_CONTEXT_CAPACITY(128000)', () => {
    expect(getModelContextCapacity('')).toBe(DEFAULT_CONTEXT_CAPACITY)
    expect(getModelContextCapacity('')).toBe(128_000)
  })
})

describe('formatTokenCount', () => {
  it('128000 → "128K"', () => {
    expect(formatTokenCount(128_000)).toBe('128K')
  })

  it('百万级非整数按 toFixed(1): 1048576 → "1.0M"、2097152 → "2.1M"', () => {
    expect(formatTokenCount(1_048_576)).toBe('1.0M')
    expect(formatTokenCount(2_097_152)).toBe('2.1M')
  })

  it('整数百万: 1000000 → "1M"、2000000 → "2M"', () => {
    expect(formatTokenCount(1_000_000)).toBe('1M')
    expect(formatTokenCount(2_000_000)).toBe('2M')
  })

  it('千以下走 String(tokens): 500 → "500"、950 → "950"', () => {
    expect(formatTokenCount(500)).toBe('500')
    expect(formatTokenCount(950)).toBe('950')
  })
})
