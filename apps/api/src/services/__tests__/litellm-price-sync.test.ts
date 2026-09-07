// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。

import { afterEach, describe, expect, it } from 'vitest'
import { getUsdToCnyRate, mapLiteLLMEntry } from '../litellm-price-sync.js'

/**
 * mapLiteLLMEntry 纯函数单元测试(零外部依赖,不连 DB)。
 *
 * 覆盖:正常映射换算(USD/token → 分/千 token,6 位小数)、缺价格跳过、汇率换算。
 * 换算公式: 分/千token = round6(usd_per_token × rate × 100_000)
 *   (1000 token/千token × 100 分/元;numeric(18,6) 精度,廉价模型不再归 0)
 */

const RATE_ENV = 'AI_PRICE_USD_TO_CNY'
const savedRate = process.env[RATE_ENV]

afterEach(() => {
  if (savedRate === undefined) delete process.env[RATE_ENV]
  else process.env[RATE_ENV] = savedRate
})

describe('litellm-price-sync — mapLiteLLMEntry', () => {
  describe('正常映射换算(默认汇率 7.2)', () => {
    it('gpt-4o 型价目($2.5e-6/$1e-5)→ 1.8/7.2 分每千 token', () => {
      const m = mapLiteLLMEntry('gpt-4o', {
        input_cost_per_token: 0.0000025,
        output_cost_per_token: 0.00001,
        max_tokens: 16384,
        litellm_provider: 'openai',
      })
      // input: 2.5e-6 × 7.2 × 1e5 = 1.8;output: 1e-5 × 7.2 × 1e5 = 7.2
      expect(m).toEqual({ modelId: 'gpt-4o', inputTokenPrice: 1.8, outputTokenPrice: 7.2 })
    })

    it('极廉价模型 gpt-4o-mini($1.5e-7/$6e-7)→ 0.108/0.432,不再归 0', () => {
      const m = mapLiteLLMEntry('gpt-4o-mini', {
        input_cost_per_token: 0.00000015,
        output_cost_per_token: 0.0000006,
      })
      // input: 1.5e-7 × 7.2 × 1e5 = 0.108;output: 6e-7 × 7.2 × 1e5 = 0.432
      expect(m).toEqual({ modelId: 'gpt-4o-mini', inputTokenPrice: 0.108, outputTokenPrice: 0.432 })
    })

    it('结果不超过 6 位小数(numeric(18,6) 精度)', () => {
      const m = mapLiteLLMEntry('test-model', {
        input_cost_per_token: 0.0000123456789,
        output_cost_per_token: 0.0000456789012,
      })
      expect(m).not.toBeNull()
      // input: 1.23456789e-5 × 7.2 × 1e5 = 8.888888808 → round6 = 8.888889
      expect(m!.inputTokenPrice).toBeCloseTo(8.888889, 6)
      // output: 4.56789012e-5 × 7.2 × 1e5 = 32.888808864 → round6 = 32.888809
      expect(m!.outputTokenPrice).toBeCloseTo(32.888809, 6)
    })

    it('modelId 首尾空白被 trim', () => {
      const m = mapLiteLLMEntry('  gpt-4o  ', {
        input_cost_per_token: 0.0000025,
        output_cost_per_token: 0.00001,
      })
      expect(m?.modelId).toBe('gpt-4o')
    })
  })

  describe('缺价格 / 非法条目跳过(返回 null)', () => {
    it('缺 input_cost_per_token → null', () => {
      expect(mapLiteLLMEntry('x', { output_cost_per_token: 0.00001 })).toBeNull()
    })

    it('缺 output_cost_per_token → null', () => {
      expect(mapLiteLLMEntry('x', { input_cost_per_token: 0.00001 })).toBeNull()
    })

    it('价格为字符串/负数 → null', () => {
      expect(mapLiteLLMEntry('x', { input_cost_per_token: '0.1', output_cost_per_token: 1 })).toBeNull()
      expect(mapLiteLLMEntry('x', { input_cost_per_token: -1, output_cost_per_token: 1 })).toBeNull()
    })

    it('非对象条目(null/数组/字符串)→ null', () => {
      expect(mapLiteLLMEntry('x', null)).toBeNull()
      expect(mapLiteLLMEntry('x', [1, 2])).toBeNull()
      expect(mapLiteLLMEntry('x', 'text')).toBeNull()
    })

    it('sample_spec 样例条目 → null', () => {
      expect(mapLiteLLMEntry('sample_spec', { input_cost_per_token: 1, output_cost_per_token: 1 })).toBeNull()
    })

    it('modelId 为空或超 128 字符 → null', () => {
      expect(mapLiteLLMEntry('   ', { input_cost_per_token: 1, output_cost_per_token: 1 })).toBeNull()
      const long = 'a'.repeat(129)
      expect(mapLiteLLMEntry(long, { input_cost_per_token: 1, output_cost_per_token: 1 })).toBeNull()
    })
  })

  describe('汇率换算(AI_PRICE_USD_TO_CNY)', () => {
    it('自定义汇率 8.0 生效', () => {
      process.env[RATE_ENV] = '8.0'
      const m = mapLiteLLMEntry('m', { input_cost_per_token: 0.000001, output_cost_per_token: 0.000002 })
      // input: 1e-6 × 8 × 1e5 = 0.8;output: 2e-6 × 8 × 1e5 = 1.6
      expect(m).toEqual({ modelId: 'm', inputTokenPrice: 0.8, outputTokenPrice: 1.6 })
    })

    it('非法汇率回退默认 7.2', () => {
      process.env[RATE_ENV] = 'not-a-number'
      expect(getUsdToCnyRate()).toBe(7.2)
      process.env[RATE_ENV] = '-1'
      expect(getUsdToCnyRate()).toBe(7.2)
      delete process.env[RATE_ENV]
      expect(getUsdToCnyRate()).toBe(7.2)
    })
  })
})
