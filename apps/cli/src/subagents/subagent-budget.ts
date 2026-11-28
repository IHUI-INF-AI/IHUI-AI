// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍‌‌​‌‌‌‌‍‌​‌‌‌‌​‍‌​​​​​‌‍‍‌​​‌​‌‌‌‍‍​​‌​​​‌‌‍‍​​‌‌​‌​‌‍‍​‌​‌​​​‌‍‍​​‌‌​​‌‌​‍‍​‌​​‌‌‌​‍‍​​‌‌​‌‌​‍‌​​​‌‌​‍‍‌​​‌​‌​‍‌​​‌‌​​​‍‌​‌‌‌​‌‍‌​‌​​‌‍‌‌​​⁠

/**
 * 子代理预算账本(回合 / 工具调用 / token 三维)。
 *
 * 立因(W4-09):对侧 spawn 子代理时显式携带 `subagentSpawnBudget` /
 * `subagentPermissionMode`,不是默认继承全部资源。IHUI 此前只有
 * `maxIterations` 与执行窗超时,没有"工具调用数"和"token 上限"这一维;
 * 子代理可以把父会话的工具额度吃光才回到 `maxIterations`。
 *
 * 本模块只做**记账与判据**,不做执行:谁在什么时候停下由调用方决定。
 * 三条硬口径:
 *   - 限额必须是正整数;0 / 负数 / 小数 / NaN / 未知键一律拒(不静默钳);
 *   - `recordToolCall` 超额时抛 `SubagentBudgetExceeded`(调用方必须把它落成结构化终态);
 *   - token 是**事后记账**(采样用量在回合末才知道),不能假装是事前硬闸。
 */

export interface SubagentBudgetLimits {
  readonly maxTurns?: number
  readonly maxTokens?: number
  readonly maxToolCalls?: number
}

export type SubagentBudgetKind = 'turns' | 'tokens' | 'tool-calls'

export interface SubagentBudgetUsage {
  readonly turns: number
  readonly tokens: number
  readonly toolCalls: number
}

export interface SubagentBudgetExhaustion {
  readonly kind: SubagentBudgetKind
  readonly limit: number
  readonly used: number
}

export class SubagentBudgetExceeded extends Error {
  readonly exhaustion: SubagentBudgetExhaustion

  constructor(exhaustion: SubagentBudgetExhaustion) {
    super(
      `子 agent 预算耗尽(${exhaustion.kind}: ${exhaustion.used}/${exhaustion.limit})`,
    )
    this.name = 'SubagentBudgetExceeded'
    this.exhaustion = exhaustion
  }
}

const BUDGET_KEYS = ['maxTurns', 'maxTokens', 'maxToolCalls'] as const

function assertPositiveInteger(value: unknown, key: string): asserts value is number {
  if (typeof value !== 'number' || !Number.isInteger(value) || value <= 0) {
    throw new Error(`budget.${key} 必须是正整数,收到 ${String(value)}`)
  }
}

/** 解析模型传入的 `budget` 对象;缺省/空对象 = 不设预算。未知键整份拒收。 */
export function parseSubagentBudget(raw: unknown): SubagentBudgetLimits {
  if (raw === undefined || raw === null) return {}
  if (typeof raw !== 'object' || Array.isArray(raw)) {
    throw new Error('budget 必须是对象')
  }
  const record = raw as Record<string, unknown>
  for (const key of Object.keys(record)) {
    if (!(BUDGET_KEYS as readonly string[]).includes(key)) {
      throw new Error(`budget 含未知键 ${key};只接受 ${BUDGET_KEYS.join(' / ')}`)
    }
  }
  for (const key of BUDGET_KEYS) {
    const value = record[key]
    if (value === undefined) continue
    assertPositiveInteger(value, key)
  }
  return {
    maxTurns: record.maxTurns as number | undefined,
    maxTokens: record.maxTokens as number | undefined,
    maxToolCalls: record.maxToolCalls as number | undefined,
  }
}

/** 预算账本。同一实例只属于一条子代理;不跨会话复用。 */
export class SubagentBudgetLedger {
  readonly limits: SubagentBudgetLimits
  private state: { turns: number; tokens: number; toolCalls: number }

  constructor(limits: SubagentBudgetLimits = {}) {
    const normalized = parseSubagentBudget(limits)
    this.limits = normalized
    this.state = { turns: 0, tokens: 0, toolCalls: 0 }
  }

  snapshot(): SubagentBudgetUsage {
    return { ...this.state }
  }

  /** 还剩几轮;未设 `maxTurns` 返回 undefined(不是 Infinity,避免被当成可序列化数值)。 */
  remainingTurns(): number | undefined {
    const limit = this.limits.maxTurns
    if (limit === undefined) return undefined
    return Math.max(0, limit - this.state.turns)
  }

  /** 记录已完成的回合数;超过上限返回耗尽原因(不抛,回合已经发生)。 */
  recordTurns(count: number): SubagentBudgetExhaustion | null {
    if (!Number.isInteger(count) || count < 0) {
      throw new Error(`turns 计数必须是非负整数,收到 ${String(count)}`)
    }
    this.state.turns += count
    return this.exhaustion()
  }

  /** 记录一次工具调用。超额即抛:调用方不得再执行本次工具。 */
  recordToolCall(): void {
    this.state.toolCalls += 1
    const exhausted = this.exhaustion()
    if (exhausted) throw new SubagentBudgetExceeded(exhausted)
  }

  /** 记录采样用量;超额返回原因(事后记账,不抛)。 */
  recordTokens(tokens: number): SubagentBudgetExhaustion | null {
    if (!Number.isFinite(tokens) || tokens < 0) {
      throw new Error(`tokens 必须是非负有限数,收到 ${String(tokens)}`)
    }
    this.state.tokens += Math.floor(tokens)
    return this.exhaustion()
  }

  /** 当前是否已越过任一维度的上限。先命中者优先(turns → tokens → tool-calls)。 */
  exhaustion(): SubagentBudgetExhaustion | null {
    const checks: Array<[SubagentBudgetKind, number | undefined, number]> = [
      ['turns', this.limits.maxTurns, this.state.turns],
      ['tokens', this.limits.maxTokens, this.state.tokens],
      ['tool-calls', this.limits.maxToolCalls, this.state.toolCalls],
    ]
    for (const [kind, limit, used] of checks) {
      if (limit !== undefined && used > limit) return { kind, limit, used }
    }
    return null
  }
}

/**
 * 轮次上限是否真的由 `budget.maxTurns` 触发。
 *
 * 只在“预算轮次就是实际生效的 maxIterations”时算命中;基础 maxIterations 更小
 * ⇒ 是调用方自己的轮次上限,不冒充预算结论。
 */
export function isTurnBudgetHit(params: {
  maxTurns?: number
  stopReason: string
  effectiveMaxIterations: number
  iterations: number
}): boolean {
  const { maxTurns, stopReason, effectiveMaxIterations, iterations } = params
  if (maxTurns === undefined) return false
  const stoppedByLimit = stopReason === 'budget_limited' || stopReason === 'max_iterations'
  return stoppedByLimit && effectiveMaxIterations === maxTurns && iterations >= maxTurns
}
