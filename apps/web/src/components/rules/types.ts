// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

// ── 冲突检测 + 模板库本地类型(与 api rules-service.ts DTO 对齐)──────────

import type { Rule } from '@ihui/types'

interface RuleConflict {
  type: 'name_conflict' | 'semantic_duplicate' | 'priority_collision'
  ruleIds: string[]
  detail: string
}

interface RuleConflictsResponse {
  conflicts: RuleConflict[]
}

interface RuleTemplate {
  name: string
  description: string
  matchType: 'always' | 'keyword' | 'regex' | 'semantic'
  pattern: string
  priority: number
  scope: 'global' | 'workspace' | 'agent'
  content: string
}

interface RuleTemplatesResponse {
  templates: RuleTemplate[]
}

// ── 深化功能本地类型(与 api rules-service.ts DTO 对齐)──────────

interface RuleHistoryEntry {
  timestamp: string
  action: string
  content: string
}

interface RuleHistoryResponse {
  history: RuleHistoryEntry[]
}

interface RuleDiffResponse {
  diff: string
}

interface RuleStats {
  ruleId: string
  hits7d: number
  hits30d: number
  avgTokenDelta: number
  totalFeedback: number
  positiveFeedback: number
  satisfactionRate: number
  matchCount: number
}

interface RuleAbTestResult {
  ruleA: { id: string; name: string; matched: boolean; output: string }
  ruleB: { id: string; name: string; matched: boolean; output: string }
  message: string
  error?: string
}

interface RuleGlobalStats {
  totalRules: number
  activeRules7d: number
  topRules: Array<{ id: string; name: string; matchCount: number }>
}

// ── 超越创新本地类型(与 api rules-service.ts DTO 对齐)──────────

interface RuleCandidate {
  name: string
  description: string
  content: string
  matchType: 'always' | 'keyword' | 'regex' | 'semantic'
  scope: 'global' | 'workspace' | 'agent'
  confidence: number
}

interface RuleAutoGenerateResult {
  candidates: RuleCandidate[]
  /**
   * 参与统计的行为条数。ai-service 的 auto-generate 只回候选列表、不回这个数,
   * 所以本端**不得**造一个 0 冒充"分析过 0 条" —— 缺失即整句不显示(见 Dialog)。
   */
  behaviorCount?: number
  degraded: boolean
  message?: string
}

interface RuleResolveConflictsResult {
  winningRule: Rule | null
  reason: string
  alternative: string | null
  degraded: boolean
  message?: string
}

// 效果预测建议:ai-service 下发的**协议字面值**(非界面文案,不得翻译),
// 以 \u 转义书写避免界面硬编码中文进入语言包之外的通道;展示处按 key 映射走 t()。
const RECOMMENDATION_ENABLE = '\u542f\u7528'
const RECOMMENDATION_DISABLE = '\u4e0d\u542f\u7528'
const RECOMMENDATION_NEUTRAL = '\u4e2d\u6027'

type RulePredictRecommendation =
  typeof RECOMMENDATION_ENABLE | typeof RECOMMENDATION_DISABLE | typeof RECOMMENDATION_NEUTRAL

interface RulePredictEffectResult {
  withRule: string
  withoutRule: string
  tokenDelta: number
  similarityDelta: number
  qualityScore: number
  recommendation: RulePredictRecommendation
  degraded: boolean
  message?: string
}

interface RuleKnowledgeGraph {
  nodes: Array<{
    ruleId: string
    name: string
    scope: 'global' | 'workspace' | 'agent'
    matchCount: number
  }>
  edges: Array<{
    source: string
    target: string
    type: 'duplicate' | 'complementary' | 'conflict'
    similarity: number
  }>
}

export { RECOMMENDATION_ENABLE, RECOMMENDATION_DISABLE, RECOMMENDATION_NEUTRAL }
export type {
  RuleConflict,
  RuleConflictsResponse,
  RuleTemplate,
  RuleTemplatesResponse,
  RuleHistoryEntry,
  RuleHistoryResponse,
  RuleDiffResponse,
  RuleStats,
  RuleAbTestResult,
  RuleGlobalStats,
  RuleCandidate,
  RuleAutoGenerateResult,
  RuleResolveConflictsResult,
  RulePredictEffectResult,
  RuleKnowledgeGraph,
}
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
