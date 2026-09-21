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
  behaviorCount: number
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

interface RulePredictEffectResult {
  withRule: string
  withoutRule: string
  tokenDelta: number
  similarityDelta: number
  qualityScore: number
  recommendation: '启用' | '不启用' | '中性'
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
