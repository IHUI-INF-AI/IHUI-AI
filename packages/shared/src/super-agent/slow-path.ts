// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * 慢路径判定环（recorded 积压 → 模型批量判定 → 三值注记）。
 * 行为对照 DeepSeek dsh-superagent「两级过滤的第二级：模型判断」设计；
 * 本文件为自写实现。超越点：判定不越权开工——record 档只注记；auto 档 act 也只走
 * 与人工 acceptRecorded 同一条语义通道（inferred∧auto∧规则名），机器人条目永不被自动开工。
 *
 * 零 IO：适配器由宿主注入；本层只定义契约与批装配/拆解的纯判据。
 */

/**
 * 判定结论：accept=建议开工；ignore=无需动手；unavailable=判不了（上下文不足/被暂停）。
 * 只有 accept ∧ 三条硬条件同时成立才允许 auto 档开工；未达标只落 wouldAccept 提案。
 */
export type SlowDecisionKind = 'accept' | 'ignore' | 'unavailable'

/** 目标依据：specified=请求里写明了；existing-standard=沿用既有规范；undetermined=没定。 */
export type TargetBasis = 'specified' | 'existing-standard' | 'undetermined'

export interface RuleAssessment {
  ruleId: string
  matched: boolean
  reason: string
}

export interface SlowDirection {
  implementationRequested: boolean
  targetBasis: TargetBasis
  /** true=需要人先做设计决策，方向未定，不能自动开工。 */
  requiresDesignDecision: boolean
  evidence: string
}

/**
 * act 门槛的落账口径：
 * - pass：形状合法 ∧ 置信度达标 ∧ direction 已定 ∧ 至少一条规则命中 ∧ intentEvidence 非空
 * - low_confidence / direction_undetermined / rule_unmatched / no_intent_evidence：
 *   模型给了判定但未达 auto 开工线 ⇒ 只注记 wouldAccept 提案，不开工
 * - unavailable：模型明确判不了（上下文不足/被判员暂停）⇒ 未判定
 */
export type SlowGate =
  | 'pass'
  | 'low_confidence'
  | 'direction_undetermined'
  | 'rule_unmatched'
  | 'no_intent_evidence'
  | 'unavailable'

/** 未判定原因（fail-closed 分档；"读不到 ≠ 不存在"必须点名到具体一档）。 */
export type SlowUnjudgedReason =
  | 'channel_error'
  | 'not_returned'
  | 'invalid_shape'
  | 'low_confidence'
  | 'direction_undetermined'
  | 'rule_unmatched'
  | 'no_intent_evidence'
  | 'unavailable'

/** 判员的结构化输出（对照 dsh-superagent Assessment，去掉其异步队列专属字段）。 */
export interface SlowDecision {
  decision: SlowDecisionKind
  /** 每个启用规则恰一条；缺条/多条/越界一律按形状非法丢弃。 */
  ruleAssessments: RuleAssessment[]
  direction: SlowDirection
  /** 模型自评置信度 0..1；缺省/越界一律按形状非法丢弃（绝不默认 1）。 */
  confidence: number
  /** 提案标题/范围：只用于面板展示，不改变授权范围（授权仍以触发原文为准）。 */
  title: string
  scope: string
  worktreeName?: string
  intentEvidence: string
  reason: string
  /** 谁判的：通道 + 模型名（可观测，不允许空串冒充）。 */
  judge: string
  at: number
  /** 落账门槛结论；由 classifyDecisions 回填，判定通道不填。 */
  gate?: SlowGate
  /** true=模型建议开工但未达 auto 线；只作提案展示，绝不自动开工。 */
  wouldAccept?: boolean
}

export interface SlowThreadMessage {
  actorId: string
  fromBot: boolean
  addressed: boolean
  text: string
}

export interface SlowRelatedTicket {
  id: string
  title: string
  scope: string
  strength: string
  stage: string
}

export interface SlowJudgeInput {
  id: string
  text: string
  observedAt: number
  requesters: string[]
  /** 启用中的规则清单；模型必须逐条给出 matched 判定。 */
  enabledRules: string[]
  /** 批内同伴（有界）：给模型跨条对比用。 */
  companions: { id: string; text: string }[]
  /** 该主体相关工单（有界）：避免重复开单/覆盖既有工作。 */
  relatedTickets: SlowRelatedTicket[]
  /** 有界线程窗口：同 source/thread 的最近消息，补足上下文。 */
  threadWindow: SlowThreadMessage[]
}

/** 注入的模型判定通道（宿主接到 ai-service /api/super-agent/slow-path/judge）。 */
export type SlowJudgeCall = (
  inputs: SlowJudgeInput[],
) => Promise<Partial<Record<string, SlowDecision>>>

export const DECISION_VALUES: readonly SlowDecisionKind[] = ['accept', 'ignore', 'unavailable']
export const TARGET_BASIS_VALUES: readonly TargetBasis[] = [
  'specified',
  'existing-standard',
  'undetermined',
]

/** 置信度门槛：低于此值即 fail-closed，不开单（只落注记与原因）。 */
export const DEFAULT_MIN_CONFIDENCE = 0.7

/** 判定通道连续失败/漏回的最大重排次数：首次 + 2 次重排后记 unavailable。 */
export const MAX_SLOW_JUDGE_ATTEMPTS = 3

/** 内置启用规则：慢路径自身；域规则清单由宿主按领域下发。 */
export const SLOW_PATH_RULE_ID = 'model-slow-path'
export const DEFAULT_SLOW_PATH_RULES: readonly string[] = [SLOW_PATH_RULE_ID]

export function isSlowDecisionKind(v: unknown): v is SlowDecisionKind {
  return v === 'accept' || v === 'ignore' || v === 'unavailable'
}

export function isTargetBasis(v: unknown): v is TargetBasis {
  return v === 'specified' || v === 'existing-standard' || v === 'undetermined'
}

/** 结构化判定的形状判据：任一项不合法 ⇒ 整条作废（不做字段补全）。 */
export function isSlowDecision(v: unknown): v is SlowDecision {
  if (!v || typeof v !== 'object') return false
  const d = v as Partial<SlowDecision>
  if (
    !isSlowDecisionKind(d.decision) ||
    typeof d.confidence !== 'number' ||
    !Number.isFinite(d.confidence) ||
    d.confidence < 0 ||
    d.confidence > 1 ||
    typeof d.reason !== 'string' ||
    typeof d.title !== 'string' ||
    typeof d.scope !== 'string' ||
    typeof d.intentEvidence !== 'string' ||
    typeof d.at !== 'number' ||
    !Number.isFinite(d.at) ||
    typeof d.judge !== 'string' ||
    d.judge.trim().length === 0
  ) {
    return false
  }
  if (d.worktreeName !== undefined && typeof d.worktreeName !== 'string') return false
  const dir = d.direction
  if (
    !dir ||
    typeof dir !== 'object' ||
    typeof dir.implementationRequested !== 'boolean' ||
    !isTargetBasis(dir.targetBasis) ||
    typeof dir.requiresDesignDecision !== 'boolean' ||
    typeof dir.evidence !== 'string'
  ) {
    return false
  }
  const assessments = d.ruleAssessments
  if (!Array.isArray(assessments)) return false
  return assessments.every(
    (a) =>
      !!a &&
      typeof a === 'object' &&
      typeof a.ruleId === 'string' &&
      typeof a.matched === 'boolean' &&
      typeof a.reason === 'string',
  )
}

/** enabledRules 必须每条恰一个 assessment，且不得出现未知规则。 */
function rulesCovered(assessments: RuleAssessment[], enabledRules: readonly string[]): boolean {
  if (assessments.length !== enabledRules.length) return false
  const seen = new Set<string>()
  for (const a of assessments) {
    if (!enabledRules.includes(a.ruleId) || seen.has(a.ruleId)) return false
    seen.add(a.ruleId)
  }
  return seen.size === enabledRules.length
}

/**
 * direction 已定：明确要实现 ∧ 目标有依据 ∧ 不依赖未完成的设计决策。
 * 原型口径（direction 已定 ∧ 规则命中 ∧ intent_evidence 非空）的三条同时成立。
 */
function directionSettled(dir: SlowDirection): boolean {
  return (
    dir.implementationRequested && dir.targetBasis !== 'undetermined' && !dir.requiresDesignDecision
  )
}

export interface SlowClassification {
  /** 形状合法、可落账的判定（含提案档，gate 已回填）。 */
  decided: { id: string; decision: SlowDecision }[]
  /** 未判定条目及点名原因。 */
  unjudged: { id: string; reason: SlowUnjudgedReason }[]
}

/**
 * 把判定响应拆成"可落账"与"点名原因"两摞。
 * 无该 id ⇒ not_returned；形状非法/规则条目不齐 ⇒ invalid_shape；
 * 置信度 < 阈值 / 方向未定 / 无规则命中 / 无意图证据 ⇒ 对应 gate（只提案）；
 * decision=unavailable ⇒ 该条未判定。只有 gate=pass ∧ accept 才允许 auto 档开工。
 */
export function classifyDecisions(
  response: Partial<Record<string, SlowDecision>>,
  ids: string[],
  options: { minConfidence?: number; enabledRules?: readonly string[] } = {},
): SlowClassification {
  const minConfidence = options.minConfidence ?? DEFAULT_MIN_CONFIDENCE
  const enabledRules = options.enabledRules ?? DEFAULT_SLOW_PATH_RULES
  const decided: SlowClassification['decided'] = []
  const unjudged: SlowClassification['unjudged'] = []
  for (const id of ids) {
    const d = response[id]
    if (!d) {
      unjudged.push({ id, reason: 'not_returned' })
      continue
    }
    if (!isSlowDecision(d) || !rulesCovered(d.ruleAssessments, enabledRules)) {
      unjudged.push({ id, reason: 'invalid_shape' })
      continue
    }
    // accept 的提案标题/范围必须可落地；空串算形状非法（不拿空标题开单）。
    if (d.decision === 'accept' && (d.title.trim().length === 0 || d.scope.trim().length === 0)) {
      unjudged.push({ id, reason: 'invalid_shape' })
      continue
    }
    const base = {
      decision: d.decision,
      ruleAssessments: d.ruleAssessments,
      direction: d.direction,
      confidence: d.confidence,
      title: d.title,
      scope: d.scope,
      ...(d.worktreeName === undefined ? {} : { worktreeName: d.worktreeName }),
      intentEvidence: d.intentEvidence,
      reason: d.reason,
      judge: d.judge,
      at: d.at,
    }
    if (d.decision === 'unavailable') {
      decided.push({ id, decision: { ...base, gate: 'unavailable' } })
      unjudged.push({ id, reason: 'unavailable' })
      continue
    }
    if (d.confidence < minConfidence) {
      decided.push({
        id,
        decision: {
          ...base,
          gate: 'low_confidence',
          ...(d.decision === 'accept' ? { wouldAccept: true } : {}),
        },
      })
      unjudged.push({ id, reason: 'low_confidence' })
      continue
    }
    if (d.decision === 'ignore') {
      decided.push({ id, decision: { ...base, gate: 'pass' } })
      continue
    }
    // accept：三条硬条件。
    if (!directionSettled(d.direction)) {
      decided.push({ id, decision: { ...base, gate: 'direction_undetermined', wouldAccept: true } })
      unjudged.push({ id, reason: 'direction_undetermined' })
      continue
    }
    if (!d.ruleAssessments.some((a) => a.matched)) {
      decided.push({ id, decision: { ...base, gate: 'rule_unmatched', wouldAccept: true } })
      unjudged.push({ id, reason: 'rule_unmatched' })
      continue
    }
    if (d.intentEvidence.trim().length === 0) {
      decided.push({ id, decision: { ...base, gate: 'no_intent_evidence', wouldAccept: true } })
      unjudged.push({ id, reason: 'no_intent_evidence' })
      continue
    }
    decided.push({ id, decision: { ...base, gate: 'pass' } })
  }
  return { decided, unjudged }
}

/** 把判定响应拆成逐条注记；形状非法的条目不下发。 */
export function pickDecisions(
  response: Partial<Record<string, SlowDecision>>,
  ids: string[],
  options: { minConfidence?: number; enabledRules?: readonly string[] } = {},
): { id: string; decision: SlowDecision }[] {
  return classifyDecisions(response, ids, options).decided
}
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
