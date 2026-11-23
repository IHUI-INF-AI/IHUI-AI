// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * 积分消耗倍数关键词推断:数据 + 解释器(单一真相源,2026-11-23 立)。
 *
 * 为什么立这一份:
 *   - `apps/api/src/services/points-multiplier.ts`(TS,计费侧)
 *   - `apps/ai-service/app/services/free_provider_registry.py`(Python,`/llm/models` 初值)
 *   - `apps/web/src/components/chat/model-selector.tsx`(前端兜底展示)
 * 曾各存一份关键词表,2026-11-23 实测已漂开:web 兜底把 `gpt-5` / `thinking` 判成 30x、
 * 把免费判定排到最后、Python 缺 `ihui/*` 显式映射 ⇒ 同一个模型在三处算出三个档次。
 * 现在规则只写 `points-multiplier-rules.json` 一处:
 *   - TS 侧(api/web)按本文件的解释器执行;
 *   - Python 侧由 `scripts/gen-points-multiplier-rules.mjs` 从同一 JSON 生成数据模块后按同一顺序执行;
 *   - 跨语言一致性由 `scripts/tests/points-multiplier-parity.test.mjs` 与 ai-service pytest 双重钉住。
 *
 * 语义边界(读之前必看):
 *   DB `ai_model_config_models.points_multiplier` 是**线上唯一生效源**(后台可编辑、公开目录/号池/扣分同读)。
 *   本函数只回答"DB 没配时给新行什么初值",以及前端在 API 未下发字段时的兜底展示。
 *   因此这里的档位只允许是 5+1 档(0/1/3/10/30 + 默认 1),不得引入 0.05x 之类展示刻度。
 */

import { POINTS_MULTIPLIER_RULES_DATA } from './points-multiplier-rules-data'

/** 规则层:命中即返回该档,顺序敏感(数组顺序即判定优先级)。 */
export interface PointsMultiplierRuleLayer {
  tier: 'free' | 'economy' | 'standard' | 'premium' | 'flagship'
  /** 模型 id 含其中任一子串即命中。 */
  containsAny?: readonly string[]
  /** 模型 id 需同时含全部子串才命中。 */
  containsAll?: readonly string[]
  /** 单个关键词的例外:命中该关键词且模型 id 含排除词时,该关键词不作数。 */
  keywordExclusions?: readonly { keyword: string; unlessContainsAnyOf: readonly string[] }[]
  /** 给读代码的人的解释,不参与计算。 */
  why?: string
}

export interface PointsMultiplierRuleSet {
  version: number
  tiers: {
    free: number
    economy: number
    standard: number
    premium: number
    flagship: number
    fallback: number
  }
  ihuiModelMap: Readonly<Record<string, number>>
  orderedRules: readonly PointsMultiplierRuleLayer[]
}

/** 规则数据(只读;需要改变档位请改 JSON 源再跑 `scripts/gen-points-multiplier-rules.mjs`)。 */
export const POINTS_MULTIPLIER_RULES: PointsMultiplierRuleSet =
  POINTS_MULTIPLIER_RULES_DATA as PointsMultiplierRuleSet

/** 智汇AI 官方中转模型(ihui/ 前缀)倍率 = 上游扣费比例 × 3(统一利润系数)。 */
export const IHUI_POINTS_MAP: Readonly<Record<string, number>> =
  POINTS_MULTIPLIER_RULES.ihuiModelMap

/** 依据规则 JSON 推断积分消耗倍数。纯函数、零 IO、大小写不敏感、允许空串。 */
export function inferPointsMultiplierFromRules(modelId: string): number {
  const mid = (modelId || '').toLowerCase()
  const explicit = POINTS_MULTIPLIER_RULES.ihuiModelMap[mid]
  if (explicit !== undefined) return explicit

  for (const layer of POINTS_MULTIPLIER_RULES.orderedRules) {
    if (matchesLayer(layer, mid)) return POINTS_MULTIPLIER_RULES.tiers[layer.tier]
  }
  return POINTS_MULTIPLIER_RULES.tiers.fallback
}

function matchesLayer(layer: PointsMultiplierRuleLayer, mid: string): boolean {
  if (layer.containsAll && layer.containsAll.length > 0) {
    return layer.containsAll.every((keyword) => mid.includes(keyword))
  }
  if (!layer.containsAny || layer.containsAny.length === 0) return false
  return layer.containsAny.some((keyword) => keywordHits(layer, keyword, mid))
}

function keywordHits(layer: PointsMultiplierRuleLayer, keyword: string, mid: string): boolean {
  if (!mid.includes(keyword)) return false
  const exclusions = layer.keywordExclusions?.find((item) => item.keyword === keyword)
  if (!exclusions) return true
  return !exclusions.unlessContainsAnyOf.some((blocked) => mid.includes(blocked))
}
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
