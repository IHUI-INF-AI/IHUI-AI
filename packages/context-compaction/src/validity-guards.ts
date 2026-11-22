// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * 上下文回收/压缩的三道有效性守卫 —— "压没压下去"的闭环,而不是"压了就当成功"。
 *
 *   守卫一 reverifyContextAfterCompaction:压缩完成后用 provider 返回的真实 usage
 *          复测上下文规模(拿不到才退回估算),并预测下一轮是否又会触发压缩。
 *          存在理由:摘要生成成功 ≠ 压缩成功。只报"摘要已生成"的通道会在
 *          窗口实际没降下来的情况下继续往上报,下一轮才炸。
 *
 *   守卫二 RefillBreaker:压缩后极少数轮内上下文又满 → 连续计数,达上限即
 *          **终止自动压缩**并给出面向用户的诊断(大概率是单个超大文件/超长输出,
 *          继续压只是烧钱且会把有用的历史压光)。
 *          计数与 tripped  latch 是**仅 CLI 侧运行时状态**;两侧同值的只有阈值
 *          (REFILL_QUICK_WINDOW_ROUNDS / REFILL_BREAKER_MAX_CONSECUTIVE)。
 *
 *   守卫三 retryAfterOverflowDrop:连"摘要请求本身"都因超长被 provider 拒(prompt
 *          too long)时,按**完整轮次**从最老一侧整组丢弃后重试,设上限。
 *          每组都落在轮次边界上,绝不出现"tool_result 前面没有对应 tool_calls"
 *          的孤儿消息(OpenAI 兼容端点对这类序列直接 400)。
 */

import { estimateMessagesTokens } from './token-estimate.js'
import { isSummaryMessage } from './markers.js'
import { splitAssistantRounds } from './reclaim.js'
import type { ChatMessage } from './types.js'

// ==================== 跨端同值阈值(真源 tunables.py) ====================

/** 压缩后 ≤ 此轮数内又触发压缩,记一次"快速回填" */
export const REFILL_QUICK_WINDOW_ROUNDS = 2
/** 连续快速回填达到此上限即终止自动压缩(熔断) */
export const REFILL_BREAKER_MAX_CONSECUTIVE = 3
/** 溢出丢弃的最大轮数上限(超上限仍不解决就停止重试,不得无限丢) */
export const OVERFLOW_DROP_MAX_ROUNDS = 6
/** 真值复测时预测"下一轮增量"的保守估计(tokens):给一轮工具结果留的余量 */
export const NEXT_TURN_GROWTH_TOKENS = 1200

// ==================== 守卫一:压缩后真值复测 ====================

/** provider 回来的 usage(字段命名兼容 OpenAI/Anthropic 两式;全缺则视为不可得) */
export interface ProviderUsage {
  promptTokens?: number
  inputTokens?: number
  totalTokens?: number
}

export interface ReverifyOptions {
  /** 压缩后的消息列表(未传 tokensAfterCompaction 时用它估算) */
  messages?: ChatMessage[]
  /** 压缩后 token 数(调用方已算好可直接传) */
  tokensAfterCompaction?: number
  /** provider 返回的真实 usage —— 可得时优先级最高,直接覆盖估算值 */
  usage?: ProviderUsage | null
  /** 模型上下文窗口(tokens) */
  contextLimit: number
  /** 压缩目标占用率(默认与跨端统一 0.6 一致) */
  targetRatio?: number
  /** 触发压缩的占用率(默认 0.88) */
  triggerRatio?: number
  /** 下一轮增量估计(默认 NEXT_TURN_GROWTH_TOKENS) */
  nextTurnGrowthTokens?: number
}

export interface ReverifiedContext {
  /** BPE 估算值 */
  estimatedTokens: number
  /** provider 真值(不可得为 null) */
  authoritativeTokens: number | null
  /** 判定用值:真值优先,否则估算 */
  effectiveTokens: number
  source: 'provider-usage' | 'estimate'
  /** 真值 - 估算(不可得为 null):持续大幅为负说明估算偏保守,为正说明低估 */
  estimateDriftTokens: number | null
  usageRatio: number
  /** 压缩是否**真的**把体量降到了目标以下 */
  meetsTarget: boolean
  targetTokens: number
  triggerTokens: number
  /** 预测下一轮 token(effectiveTokens + 下一轮增量估计) */
  nextTurnPredictedTokens: number
  /** 预测下一轮是否又达触发阈值 —— 调用方据此决定是否登记一次"快速回填" */
  nextTurnWouldTrigger: boolean
}

/**
 * 压缩后真值复测。
 *
 * 关键语义:**不得**把"摘要生成成功"当"压缩成功" —— 本函数只回答体量问题,
 * 且当 provider usage 可得时以 usage 为准(估算与实际发送量可能差数千 token)。
 */
export function reverifyContextAfterCompaction(opts: ReverifyOptions): ReverifiedContext {
  const contextLimit = opts.contextLimit
  const targetRatio = opts.targetRatio ?? 0.6
  const triggerRatio = opts.triggerRatio ?? 0.88
  const growth = opts.nextTurnGrowthTokens ?? NEXT_TURN_GROWTH_TOKENS

  const estimatedTokens =
    opts.tokensAfterCompaction ??
    (Array.isArray(opts.messages) ? estimateMessagesTokens(opts.messages) : 0)

  const authoritativeTokens = pickAuthoritativeTokens(opts.usage)
  const effectiveTokens = authoritativeTokens ?? estimatedTokens

  const targetTokens = Math.floor(contextLimit * targetRatio)
  const triggerTokens = Math.floor(contextLimit * triggerRatio)
  const nextTurnPredictedTokens = effectiveTokens + growth

  return {
    estimatedTokens,
    authoritativeTokens,
    effectiveTokens,
    source: authoritativeTokens === null ? 'estimate' : 'provider-usage',
    estimateDriftTokens:
      authoritativeTokens === null ? null : authoritativeTokens - estimatedTokens,
    usageRatio: contextLimit > 0 ? effectiveTokens / contextLimit : 0,
    meetsTarget: effectiveTokens <= targetTokens,
    targetTokens,
    triggerTokens,
    nextTurnPredictedTokens,
    nextTurnWouldTrigger: contextLimit > 0 && nextTurnPredictedTokens >= triggerTokens,
  }
}

/** usage → 真值 token(prompt/input 优先,只有 total 时用 total);全缺返回 null */
export function pickAuthoritativeTokens(usage?: ProviderUsage | null): number | null {
  if (!usage || typeof usage !== 'object') return null
  const prompt = readPositive(usage.promptTokens) ?? readPositive(usage.inputTokens)
  if (prompt !== null) return prompt
  return readPositive(usage.totalTokens)
}

function readPositive(value: unknown): number | null {
  return typeof value === 'number' && Number.isFinite(value) && value > 0 ? value : null
}

// ==================== 守卫二:快速回填熔断 ====================

export interface RefillBreakerOptions {
  /** 压缩后 ≤ 此轮数内又触发即算一次快速回填 */
  windowRounds?: number
  /** 连续几次即熔断 */
  maxConsecutive?: number
}

export interface RefillObservation {
  /** 本次观察是否构成"快速回填"(与上一次压缩事件的轮距 ≤ windowRounds) */
  quickRefill: boolean
  /** 本次观察后的连续计数(非快速回填会归零) */
  consecutive: number
  /** 是否已熔断(熔断后必须停止自动压缩) */
  tripped: boolean
  /** 首次熔断那一刻给出面向用户的诊断文案;未熔断为 null(不重复刷屏) */
  diagnostic: string | null
  /** 本次与上一次压缩事件的轮距(首次为 null) */
  roundsSinceLastCompaction: number | null
}

/**
 * 快速回填熔断器。
 *
 * 用法:每次**实际发生**压缩(或回收)后调用 `observeCompaction(turnIndex)`;
 * 返回 tripped=true 后调用方必须停止自动压缩并把 diagnostic 交给用户。
 *
 * 仅 CLI 侧:`consecutive` / `lastTurnIndex` / `tripped` 是本对象内的运行期状态,
 * Python 端没有对应实例(跨端只对齐 windowRounds / maxConsecutive 两个阈值)。
 */
export class RefillBreaker {
  private readonly windowRounds: number
  private readonly maxConsecutive: number
  private lastTurnIndex: number | null = null
  private consecutive = 0
  private _tripped = false

  constructor(opts: RefillBreakerOptions = {}) {
    this.windowRounds = opts.windowRounds ?? REFILL_QUICK_WINDOW_ROUNDS
    this.maxConsecutive = opts.maxConsecutive ?? REFILL_BREAKER_MAX_CONSECUTIVE
  }

  get tripped(): boolean {
    return this._tripped
  }

  get consecutiveQuickRefills(): number {
    return this.consecutive
  }

  /** 登记一次压缩事件(按轮次序号)。轮次序号必须单调不减。 */
  observeCompaction(turnIndex: number): RefillObservation {
    const roundsSince = this.lastTurnIndex === null ? null : turnIndex - this.lastTurnIndex
    this.lastTurnIndex = turnIndex
    const quickRefill = roundsSince !== null && roundsSince <= this.windowRounds

    if (!quickRefill) {
      // 间隔够长 = 压缩有效维持住了,连续计数归零(只罚"压完立刻又满")
      this.consecutive = 0
    } else {
      this.consecutive += 1
    }

    let diagnostic: string | null = null
    if (!this._tripped && this.consecutive >= this.maxConsecutive) {
      this._tripped = true
      diagnostic = buildRefillDiagnostic(this.consecutive, this.windowRounds)
    }

    return {
      quickRefill,
      consecutive: this.consecutive,
      tripped: this._tripped,
      diagnostic,
      roundsSinceLastCompaction: roundsSince,
    }
  }

  /** 手动解除熔断(用户显式新开会话/换模型后由调用方重置) */
  reset(): void {
    this.lastTurnIndex = null
    this.consecutive = 0
    this._tripped = false
  }

  /** 当前诊断文案(熔断后可反复取用) */
  diagnosticMessage(): string | null {
    return this._tripped ? buildRefillDiagnostic(this.consecutive, this.windowRounds) : null
  }
}

/** 面向用户的诊断文案:说清现象、最可能的原因、可执行的两条出路 */
export function buildRefillDiagnostic(consecutive: number, windowRounds: number): string {
  return (
    `上下文自动压缩已暂停:连续 ${consecutive} 次压缩后 ${windowRounds} 轮内窗口又被占满。` +
    '这通常说明占用来自单个超大文件或一次超长命令输出,继续压缩只会把有用的历史一起丢掉,' +
    '不会真正腾出空间。建议二选一:' +
    '① 改用分块读取(带 offset/limit)或先 grep 定位再读局部,不要整文件读入;' +
    '② 开一个新会话,把任务拆成更小的步骤,并只把必要结论带过去。'
  )
}

// ==================== 守卫三:极端溢出的整轮丢弃重试 ====================

export interface OverflowDropOptions {
  /** 模型上下文窗口(tokens) */
  contextLimit: number
  /** 需要降到的安全线以下才算解决(默认用触发阈值 triggerRatio) */
  triggerRatio?: number
  /** 目标占用率(可选:传了则尽量降到该线以下,但仍受最大丢弃轮数约束) */
  targetRatio?: number
  /** 最多丢弃多少轮(默认 OVERFLOW_DROP_MAX_ROUNDS) */
  maxDropRounds?: number
}

export interface OverflowDropResult {
  messages: ChatMessage[]
  /** 是否已降到阈值以下(仍超则为 false,调用方应停止重试并报错给用户) */
  resolved: boolean
  reason: 'not-overflow' | 'resolved' | 'cap-exceeded' | 'nothing-to-drop'
  /** 实际丢弃的轮数(0 表示未改写) */
  droppedRounds: number
  attempts: number
  beforeTokens: number
  afterTokens: number
}

/**
 * 摘要请求本身也被拒(prompt too long)时的兜底重试:
 * 从**最老一侧按完整轮次整组丢弃**,直到降到阈值下或达到丢弃上限。
 *
 * 两条硬约束:
 *   1. 丢弃边界只落在轮次边界(splitAssistantRounds 保证一组 = assistant 及其
 *      全部 tool 结果 / 内嵌结果段),因此绝不截断 tool_calls ↔ tool 配对;
 *   2. system 段与历史摘要消息不丢(丢了等于把整段任务上下文扔掉),
 *      最近一轮永不丢(丢了当前提问就没了)。
 */
export function retryAfterOverflowDrop(
  messages: ChatMessage[],
  opts: OverflowDropOptions,
): OverflowDropResult {
  const contextLimit = opts.contextLimit
  const triggerRatio = opts.triggerRatio ?? 0.88
  const maxDropRounds = opts.maxDropRounds ?? OVERFLOW_DROP_MAX_ROUNDS
  const triggerTokens = Math.floor(contextLimit * triggerRatio)
  const targetTokens =
    typeof opts.targetRatio === 'number'
      ? Math.min(triggerTokens, Math.floor(contextLimit * opts.targetRatio))
      : triggerTokens

  const beforeTokens = estimateMessagesTokens(messages)
  if (beforeTokens < triggerTokens) {
    return {
      messages,
      resolved: true,
      reason: 'not-overflow',
      droppedRounds: 0,
      attempts: 0,
      beforeTokens,
      afterTokens: beforeTokens,
    }
  }

  const systemMsgs = messages.filter((m) => m.role === 'system')
  const nonSystem = messages.filter((m) => m.role !== 'system')
  const rounds = splitAssistantRounds(nonSystem)

  // 可丢集合:跳过 system(已单独收集)、历史摘要消息所在轮、最近一轮
  const droppable: number[] = []
  rounds.forEach((round, idx) => {
    if (idx >= rounds.length - 1) return // 最近一轮永不丢
    if (round.some(isSummaryMessage)) return
    droppable.push(idx)
  })
  if (droppable.length === 0) {
    return {
      messages,
      resolved: false,
      reason: 'nothing-to-drop',
      droppedRounds: 0,
      attempts: 0,
      beforeTokens,
      afterTokens: beforeTokens,
    }
  }

  let attempts = 0
  for (let dropCount = 1; dropCount <= Math.min(maxDropRounds, droppable.length); dropCount++) {
    attempts++
    const droppedSet = new Set(droppable.slice(0, dropCount))
    const kept = rounds.filter((_, idx) => !droppedSet.has(idx)).flat()
    const candidate = [...systemMsgs, ...kept]
    const tokens = estimateMessagesTokens(candidate)
    if (tokens <= targetTokens) {
      return {
        messages: candidate,
        resolved: true,
        reason: 'resolved',
        droppedRounds: dropCount,
        attempts,
        beforeTokens,
        afterTokens: tokens,
      }
    }
  }

  // 丢到上限仍不达标:返回最后一次(丢得最多)的结果让调用方继续走后续兜底,
  // 但如实标 cap-exceeded —— 不得把"丢了但没到位"记成 resolved。
  const lastDropSet = new Set(droppable.slice(0, Math.min(maxDropRounds, droppable.length)))
  const lastKept = rounds.filter((_, idx) => !lastDropSet.has(idx)).flat()
  const lastCandidate = [...systemMsgs, ...lastKept]
  return {
    messages: lastCandidate,
    resolved: false,
    reason: 'cap-exceeded',
    droppedRounds: lastDropSet.size,
    attempts,
    beforeTokens,
    afterTokens: estimateMessagesTokens(lastCandidate),
  }
}

/**
 * 配对完整性核验:找出"孤儿 tool 消息"(其 tool_call_id 在前面的 assistant
 * tool_calls 里找不到)。溢出丢弃后调用它自证没把配对切断。
 */
export function findOrphanToolMessages(messages: ChatMessage[]): ChatMessage[] {
  const index = new Map<string, number>()
  for (const m of messages) {
    if (!Array.isArray(m.tool_calls)) continue
    for (const tc of m.tool_calls) {
      if (tc && typeof tc.id === 'string') index.set(tc.id, (index.get(tc.id) ?? 0) + 1)
    }
  }
  const orphans: ChatMessage[] = []
  for (const m of messages) {
    if (m.role !== 'tool') continue
    const id = typeof m.tool_call_id === 'string' ? m.tool_call_id : ''
    const remaining = index.get(id) ?? 0
    if (remaining <= 0) orphans.push(m)
    else index.set(id, remaining - 1)
  }
  return orphans
}
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
