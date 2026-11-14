// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。

/**
 * F-135 回归钉:未登记模型不得回退到 gpt-4o-mini 的付费单价。
 * 精确命中 > 同族前缀(日期后缀/别名)> 未知 ⇒ 零价。免费族(stepfun/*)不被记成付费。
 */
import { describe, expect, it } from 'vitest';

import { estimateIterationCost, resolveModelPricing } from '../src/commands/agent.js';

describe('F-135 未知模型定价', () => {
  it('已登记模型按原单价计价', () => {
    expect(resolveModelPricing('gpt-4o-mini')).not.toBeNull();
    expect(estimateIterationCost('gpt-4o-mini', 1_000_000, 0)).toBeCloseTo(0.15, 10);
    expect(estimateIterationCost('gpt-4o', 0, 1_000_000)).toBeCloseTo(10, 10);
  });

  it('免费族按前缀命中,仍为零价', () => {
    expect(resolveModelPricing('stepfun/step-3.7-flash')).toEqual({ input: 0, output: 0 });
    expect(estimateIterationCost('stepfun/step-3.7-flash-2026xxxx', 123, 456)).toBe(0);
  });

  it('带日期后缀的付费模型按同族前缀计价', () => {
    expect(estimateIterationCost('gpt-4o-mini-2024-07-18', 1_000_000, 0)).toBeCloseTo(0.15, 10);
  });

  it('完全未知的模型返回零价,null 而不是回退 gpt-4o-mini', () => {
    expect(resolveModelPricing('totally-unknown-model')).toBeNull();
    expect(estimateIterationCost('totally-unknown-model', 1_000_000, 1_000_000)).toBe(0);
  });
});
