// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * 积分倍数规则解释器回归(2026-11-23 立)。
 *
 * 语料里的期望值全部取自 2026-11-23 修正后的 api 侧口径
 * (`apps/api/src/services/points-multiplier.ts`,commit 24d0a268 / e2e0b3db),
 * 也就是"线上一直生效的那套判定顺序"。本测试的作用是把这套语义钉在规则数据上:
 * 以后无论谁改 JSON 或改解释器,这批样本必须仍然算出同一个数。
 *
 * 特别是这三类曾经漂开的模型:
 *   - `gpt-5.4`:曾被 web 兜底按 `gpt-5` 判成 30x,api 口径是 10x;
 *   - `thinkingmachines/inkling`:曾被当旗舰,修正后是标准 3x;
 *   - `opencode_zen/*`:上游 zero_cost ⇒ 0x,判定必须排在所有付费关键词之前。
 */
import { describe, expect, it } from 'vitest'

import corpusJson from '../points-multiplier-corpus.json'
import {
  IHUI_POINTS_MAP,
  POINTS_MULTIPLIER_RULES,
  inferPointsMultiplierFromRules,
} from '../points-multiplier-rules'

/** 共享语料(与 ai-service pytest 同读一份,跨语言漂移即红)。 */
const CORPUS: ReadonlyArray<readonly [string, number]> = corpusJson.cases as [string, number][]

describe('inferPointsMultiplierFromRules', () => {
  it.each(CORPUS)('%s → %i', (modelId, expected) => {
    expect(inferPointsMultiplierFromRules(modelId)).toBe(expected)
  })

  it('大小写与首尾空白不影响判定', () => {
    expect(inferPointsMultiplierFromRules('GPT-5.4')).toBe(10)
    expect(inferPointsMultiplierFromRules('  Claude-3-Opus  ')).toBe(30)
  })

  it('ihui 映射与规则数据同源', () => {
    expect(IHUI_POINTS_MAP).toBe(POINTS_MULTIPLIER_RULES.ihuiModelMap)
    expect(Object.keys(IHUI_POINTS_MAP).length).toBeGreaterThanOrEqual(17)
  })

  it('关键词档位只有 5+1 档,不存在展示刻度', () => {
    const tiers = new Set(Object.values(POINTS_MULTIPLIER_RULES.tiers))
    expect([...tiers].sort((a, b) => a - b)).toEqual([0, 1, 3, 10, 30])
    // ihui/* 走显式映射(上游扣费比例 × 3,允许 6/15/18 这类非阶梯值),语料期望必须来自两者之一
    const allowed = new Set([...tiers, ...Object.values(POINTS_MULTIPLIER_RULES.ihuiModelMap)])
    for (const [, expected] of CORPUS) expect(allowed.has(expected)).toBe(true)
  })
})
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
