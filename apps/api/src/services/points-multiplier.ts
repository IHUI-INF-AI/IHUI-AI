// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * 积分消耗倍数(单一真相源,2026-11-21 从 routes/ai-vendors/proxy-llm.ts 抽出)。
 *
 * 为什么要抽:LLM 计费(按 token)与媒体计费(按张/次)必须用**同一张倍数表**,
 * 否则同一个模型在两条链路上被算出两个档次。抽成零 IO 的纯模块后:
 *   ① 两个消费方 import 同一份,不再有第二份实现;
 *   ② 单测可以只 import 它,不牵动 db/points 这些带 IO 的模块(测试隔离铁律)。
 * 倍率语义与原来完全一致(5 档梯度:0x 免费 / 1x 经济 / 3x 标准 / 10x 高级 / 30x 旗舰)。
 */
export const IHUI_POINTS_MAP: Readonly<Record<string, number>> = {
  // 倍率 = 上游扣费比例 × 3(统一利润系数),2026-08-31 按官方套餐扣费比例重配
  'ihui/auto-model': 3, // 上游扣费 1:1
  'ihui/minimax-m2.7': 6, // 上游扣费 1:2
  'ihui/minimax-m2.7-highspeed': 15, // 上游扣费 1:5
  'ihui/minimax-m3': 15, // 上游扣费 1:5
  'ihui/deepseek-v4-flash-0731': 15, // 上游扣费 1:5
  'ihui/glm-5.1': 18, // 上游扣费 1:6
  'ihui/glm-5.2': 18, // 上游扣费 1:6
  'ihui/glm-5.3-flash': 18, // 上游扣费 1:6
  'ihui/kimi-k2.6': 18, // 上游扣费 1:6
  'ihui/deepseek-v4-pro': 18, // 上游扣费 1:6
  'ihui/deepseek-v4-pro-0813': 18, // 上游扣费 1:6
  'ihui/grok-4.5': 18, // 上游扣费 1:6(未列套餐,按次旗舰估)
  'ihui/glm-5.3': 30, // 上游扣费 1:10
  'ihui/gpt-5.6': 30, // 上游扣费 1:10
  'ihui/grok-4.6': 30, // 上游扣费 1:10
  'ihui/qwen3.7-max': 30, // 上游扣费 1:10
  'ihui/kimi-k2.7-code': 30, // 上游扣费 1:10
}

/**
 * 把 DB 的 numeric(5,2) 覆盖值解析成有限非负数;空值/坏值返回 null。
 * 单独抽出来是为了让"后台配置值"与"关键词推断"有明确边界:
 * null = 没配,继续走 inferPointsMultiplier;0 = 显式免费,不要被当成没配。
 */
export function parsePointsMultiplierOverride(value: unknown): number | null {
  if (value === null || value === undefined || value === '') return null
  const n = typeof value === 'number' ? value : Number(value)
  return Number.isFinite(n) && n >= 0 ? n : null
}

/** 覆盖值优先;未配置/坏值回落到关键词推断。纯函数,零 IO。 */
export function resolvePointsMultiplierWithOverride(
  modelId: string,
  override?: number | null,
): number {
  const parsed = parsePointsMultiplierOverride(override)
  return parsed === null ? inferPointsMultiplier(modelId) : parsed
}

/** 模型名归一:小写、去首尾空白、去号池后缀 ` [provider]`。 */
export function normalizePointsModelId(modelId: string): string {
  return (modelId || '')
    .trim()
    .toLowerCase()
    .replace(/\s*\[[^\]]*\]\s*$/, '')
}

export interface PointsMultiplierOverrideRow {
  modelId: string
  providerCode?: string | null
  pointsMultiplier: string | number | null
}

/**
 * 由 DB 行构造覆盖表。同一模型多条行时先到先得(调用方按公开优先/更新时间倒序传入),
 * 同时登记裸 model_id 与 `provider/model_id`,兼容公共目录与号池两种命名。
 */
export function buildPointsMultiplierOverrideMap(
  rows: readonly PointsMultiplierOverrideRow[],
): Map<string, number> {
  const map = new Map<string, number>()
  for (const row of rows) {
    const raw = normalizePointsModelId(row.modelId)
    if (!raw) continue
    const value = parsePointsMultiplierOverride(row.pointsMultiplier)
    if (value === null) continue
    const keys = [raw]
    const provider = (row.providerCode || '').trim().toLowerCase()
    if (provider) keys.push(`${provider}/${raw}`)
    const lastSegment = raw.split('/').pop()
    if (lastSegment && lastSegment !== raw) keys.push(lastSegment)
    for (const key of keys) {
      if (!map.has(key)) map.set(key, value)
    }
  }
  return map
}

/** 按模型名查覆盖值;依次试完整名、去号池后缀名、最后一段。 */
export function lookupPointsMultiplierOverride(
  map: ReadonlyMap<string, number>,
  modelId: string,
): number | undefined {
  const normalized = normalizePointsModelId(modelId)
  if (!normalized) return undefined
  const direct = map.get(normalized)
  if (direct !== undefined) return direct
  const lastSegment = normalized.split('/').pop()
  if (lastSegment) {
    const byLast = map.get(lastSegment)
    if (byLast !== undefined) return byLast
  }
  return undefined
}

/**
 * 关键词兜底推断(只在 DB 没有覆盖值时使用)。
 *
 * 2026-11-23 修正:旧规则把纯子串 `thinking` / `gpt-5` / `deepseek` 一律拉进 30x/3x,
 * 导致 `thinkingmachines/inkling`、`gpt-5.6-luna`、`deepseek-ocr`、`deepseek-v4.1-flash`
 * 这类低成本模型被高估(实测成本只有旗舰档的 1/10 ~ 1/100)。
 * 现在顺序固定为:免费 → 经济(轻量后缀优先) → 旗舰(仅真实旗舰家族) → 高级 → 标准 → 默认。
 * DB `points_multiplier` 仍是唯一生效源;本函数只给新入库行一个不荒谬的初值。
 */
const POINTS_MULTIPLIER_FREE_KEYWORDS = [
  'ollama',
  'llama',
  'llm7',
  'pollinations',
  'aihorde',
  'opencode_zen',
] as const
const POINTS_MULTIPLIER_ECONOMY_KEYWORDS = [
  'mini',
  'nano',
  'haiku',
  'flash',
  'lite',
  'ocr',
  'small',
  'luna',
  'sao10k',
  'smol',
] as const
const POINTS_MULTIPLIER_FLAGSHIP_KEYWORDS = [
  'opus',
  'o1-preview',
  'o1',
  'o3',
  'gpt-5.4-pro',
  'gpt-5.5',
  'gpt-5.5-pro',
  'gpt-5.6-sol',
  'gpt-5.6-terra',
] as const
const POINTS_MULTIPLIER_PREMIUM_KEYWORDS = [
  'gpt-5',
  'gpt-4-turbo',
  'gpt-4.5',
  'qwen-max-longcontext',
] as const
const POINTS_MULTIPLIER_STANDARD_KEYWORDS = [
  'sonnet',
  'gpt-4o',
  'gpt-4.1',
  'deepseek',
  'glm-4',
  'qwen-max',
  'thinking',
] as const

/** 根据 model_id 推断积分消耗倍数(5 档梯度:0x 免费 / 1x 经济 / 3x 标准 / 10x 高级 / 30x 旗舰) */
export function inferPointsMultiplier(modelId: string): number {
  const mid = (modelId || '').toLowerCase()
  // 智汇AI 官方中转模型(ihui/ 前缀):付费模型,按档位映射积分倍数
  if (IHUI_POINTS_MAP[mid] !== undefined) return IHUI_POINTS_MAP[mid]
  // 免费(0x):先判,避免免费模型被后面的旗舰/标准关键词抬高
  if (POINTS_MULTIPLIER_FREE_KEYWORDS.some((k) => mid.includes(k))) return 0
  // 经济(1x):mini/flash/ocr 等轻量后缀必须先于父型号(family)判定,
  // 否则 deepseek-v4.1-flash 会被 deepseek 拉到 3x、gpt-5-image-mini 被 gpt-5 拉到 30x。
  // 注意:gemini 本身含 "mini" 子串(ge-mini),不能把 Gemini 家族误判成经济档。
  if (
    POINTS_MULTIPLIER_ECONOMY_KEYWORDS.some((k) =>
      k === 'mini' ? mid.includes('mini') && !mid.includes('gemini') : mid.includes(k),
    )
  )
    return 1
  // 旗舰(30x):只认真实旗舰家族;`thinking` 不再代表旗舰——
  // 大量开源 reasoning 模型名字带 thinking 但成本只有 1x/3x。
  if (POINTS_MULTIPLIER_FLAGSHIP_KEYWORDS.some((k) => mid.includes(k))) return 30
  // 高级(10x)
  if (mid.includes('gemini') && mid.includes('pro')) return 10
  if (POINTS_MULTIPLIER_PREMIUM_KEYWORDS.some((k) => mid.includes(k))) return 10
  // 标准(3x)
  if (POINTS_MULTIPLIER_STANDARD_KEYWORDS.some((k) => mid.includes(k))) return 3
  // 默认经济(1x)
  return 1
}
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
