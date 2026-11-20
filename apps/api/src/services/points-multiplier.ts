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

/** 根据 model_id 推断积分消耗倍数(5 档梯度:0x 免费 / 1x 经济 / 3x 标准 / 10x 高级 / 30x 旗舰) */
export function inferPointsMultiplier(modelId: string): number {
  const mid = (modelId || '').toLowerCase()
  // 智汇AI 官方中转模型(ihui/ 前缀):付费模型,按档位映射积分倍数
  if (IHUI_POINTS_MAP[mid] !== undefined) return IHUI_POINTS_MAP[mid]
  // 优先 mini/nano/haiku(避免 gpt-4o-mini 被标准层 gpt-4o 遮蔽,o1-mini 被 o1 遮蔽)
  if (['mini', 'nano', 'haiku'].some((k) => mid.includes(k))) return 1
  // 旗舰(30x)
  if (['opus', 'thinking', 'o1-preview', 'o1', 'o3', 'gpt-5'].some((k) => mid.includes(k)))
    return 30
  // 高级(10x)
  if (
    [
      'gpt-4-turbo',
      'gpt-4.5',
      'claude-3-opus',
      'gemini-pro',
      'o1-mini',
      'o3-mini',
      'qwen-max-longcontext',
    ].some((k) => mid.includes(k))
  )
    return 10
  // 标准(3x)
  if (['sonnet', 'gpt-4o', 'gpt-4.1', 'deepseek', 'glm-4', 'qwen-max'].some((k) => mid.includes(k)))
    return 3
  // 经济(1x)
  if (['mini', 'flash', 'lite', 'nano', 'haiku'].some((k) => mid.includes(k))) return 1
  // 免费(0x)
  if (
    ['ollama', 'llama', 'llm7', 'pollinations', 'aihorde', 'opencode_zen'].some((k) =>
      mid.includes(k),
    )
  )
    return 0
  // 默认经济(1x)
  return 1
}
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
