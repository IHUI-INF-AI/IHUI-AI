// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * 指标方向登记表 —— 基线比较的唯一口径来源。
 *
 * 规则：新增指标必须先在这里登记方向。未登记即抛错（比较时无法判断"变好"还是"变坏"，
 * 放任默认值等于给了一个可以随手改口径的后门）。
 *
 * 方向语义：
 *  - `higher-better`：数值越大能力越强（如事实保留数、正确工具调用数）
 *  - `lower-better`：数值越小越好（如修复轮次、重复副作用次数）
 *  - `exact`：只允许完全相等（如 stopReason、布尔结论），任何变化都算"变了"（需人工复核并刷新基线）
 */
export type MetricDirection = 'higher-better' | 'lower-better' | 'exact'

export const METRIC_DIRECTIONS: Record<string, MetricDirection> = {
  // ── 工具调用正确性 ────────────────────────────────────────────────
  'tool-call.correct_selections': 'higher-better',
  'tool-call.invalid_argument_calls': 'lower-better',
  'tool-call.repair_rounds': 'lower-better',
  'tool-call.executed_calls': 'exact',
  'tool-call.workspace_state_correct': 'exact',
  'tool-call.stop_reason': 'exact',

  // ── 上下文压缩保真 ────────────────────────────────────────────────
  'compaction.retained_facts': 'higher-better',
  'compaction.retention_ratio': 'higher-better',
  'compaction.compressed': 'exact',
  'compaction.degenerate_summary': 'exact',
  'compaction.tool_pair_integrity': 'exact',
  'compaction.token_reduction': 'higher-better',

  // ── 多轮续跑一致性 ────────────────────────────────────────────────
  'resume.consistent_turns': 'higher-better',
  'resume.restored_messages': 'exact',
  'resume.resumed_tool_calls': 'exact',
  'resume.duplicate_side_effects': 'lower-better',
  'resume.transcript_hash_match': 'exact',

  // ── 错误恢复 ────────────────────────────────────────────────────────
  'recovery.recovered': 'exact',
  'recovery.attempts': 'exact',
  'recovery.wasted_side_effects': 'lower-better',
  'recovery.final_state_correct': 'exact',
  'recovery.stop_reason': 'exact',
}

export function metricDirection(name: string): MetricDirection {
  const direction = METRIC_DIRECTIONS[name]
  if (!direction) {
    throw new Error(`指标 "${name}" 未在 src/metrics.ts 登记方向；禁止隐式默认，先登记再使用`)
  }
  return direction
}
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
