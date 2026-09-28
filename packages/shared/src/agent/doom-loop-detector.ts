// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 本仓库以 Apache-2.0 授权分发，须保留本声明与 LICENSE / NOTICE。

/**
 * Doom-loop / stuck detection — 共享层唯一算法源(V3 #54,2026-09-28 立)。
 *
 * 三侧关系(parity 由 scripts/check-doom-loop-parity.mjs 钉死):
 *   - 本文件:与平台无关的算法与策略常量(**唯一一份数字**)。
 *   - apps/cli/src/doom-loop-detector.ts:CLI 平台适配器 —— 注入 node:crypto 的
 *     SHA-256 摘要与用户文案;阈值/窗口/触发条件一律 import 本文件,不得再抄数字。
 *   - apps/ai-service/app/core/doom_loop.py:Python 等价实现(ai-service 主聊天
 *     执行链路 agent_loop_v2.py 消费);常量、状态数、换策略动作集合必须与本文件
 *     逐项等值。**改任何一侧的数字/清单,必须同一枚提交改另一侧。**
 *
 * 判据语义(与 CLI 既有行为逐条对齐):
 *   1. 滑动窗口:统计**窗口尾部连续**相同(工具名 + 入参摘要)的调用数,达到
 *      DOOM_LOOP_REPEAT_THRESHOLD 报警;中间夹任何不同调用即打断计数。
 *   2. stuck 签名:连续 STUCK_CONSECUTIVE_THRESHOLD 次相同错误签名,或连续相同
 *      tool_call 轮次模式 ⇒ 判定卡死。错误签名归一 = 首行 + 数字→N + 截断。
 *   3. failure-streak:同一工具连续失败达 FAILURE_STREAK_STRATEGY_THRESHOLD 次
 *      ⇒ 换策略(注入反思提示并清零本工具计数)。
 *   4. planDoomAlertResponse:滑动窗口报警轮次的升级决策 —— 首轮报警
 *      inject_reflection + skip_tool_execution;连续第 DOOM_ALERT_ROUNDS_TO_TERMINATE
 *      轮报警 ⇒ terminate_loop。
 *
 * 平台无关铁律:本文件禁止 import node/dom 内建、禁止用户可见文案(文案属各端)、
 * 禁止自行算摘要(摘要由 CLI 侧以真 SHA-256 注入 / Python 侧用 hashlib)。
 */

/** 滑动窗口容量(条数,非时间)。 */
export const DOOM_LOOP_WINDOW_SIZE = 10
/** 窗口尾部连续相同调用达到该数即报警(滑动窗口判据)。 */
export const DOOM_LOOP_REPEAT_THRESHOLD = 3
/** 窗口时间冷却(ms);0 = 不按时间淘汰,只按容量淘汰。 */
export const DOOM_LOOP_COOLDOWN_MS = 0
/** 连续第 N 轮触发窗口报警 ⇒ 终止(首轮只反思)。 */
export const DOOM_ALERT_ROUNDS_TO_TERMINATE = 2
/** 连续 N 次相同错误签名 / 相同 tool_call 轮次模式 ⇒ 判定卡死。 */
export const STUCK_CONSECUTIVE_THRESHOLD = 3
/** 同一工具连续失败达该数 ⇒ 换策略(注入反思并清零该工具计数)。 */
export const FAILURE_STREAK_STRATEGY_THRESHOLD = 3
/** 错误签名归一后的最大长度(字符)。 */
export const ERROR_SIGNATURE_MAX_LEN = 120
/** 入参摘要算法名 —— 两侧适配器都必须用这个算法(CLI: createHash;Py: hashlib)。 */
export const DOOM_LOOP_HASH_ALGORITHM = 'sha256'

/** 哨兵状态机的全部状态(计数与顺序 = parity 判据)。 */
export const DOOM_LOOP_STATES = ['observing', 'reflecting', 'terminating'] as const
export type DoomLoopState = (typeof DOOM_LOOP_STATES)[number]

/** 换策略动作集合(parity 判据;各端主链路必须真的处理其中每一个动作)。 */
export const DOOM_LOOP_STRATEGY_ACTIONS = [
  'inject_reflection',
  'skip_tool_execution',
  'terminate_loop',
] as const
export type DoomLoopStrategyAction = (typeof DOOM_LOOP_STRATEGY_ACTIONS)[number]

/** 一次窗口报警的纯事实(不带文案;文案由各端组合)。 */
export interface DoomLoopCallFact {
  toolName: string
  inputHash: string
  repeatCount: number
}

export interface DoomLoopWindowOptions {
  windowSize?: number
  repeatThreshold?: number
  cooldownMs?: number
}

export interface DoomLoopWindowStats {
  totalCalls: number
  uniqueCalls: number
  repeatRate: number
}

export interface DoomLoopWindow {
  /** 记一次工具调用(入参摘要由各端以真 SHA-256 预先算好);命中阈值返回事实。 */
  record: (toolName: string, inputHash: string) => DoomLoopCallFact | null
  reset: () => void
  getStats: () => DoomLoopWindowStats
}

interface WindowEntry {
  toolName: string
  inputHash: string
  timestampMs: number
}

/**
 * 确定性、永不抛错的规范化序列化(与 Python 侧 canonical_serialize 同语义):
 * 对象键逐层排序 ⇒ 同一逻辑入参(键序不同)得到同一字符串;循环引用只对
 * "当前祖先链"判 "[Circular]";NaN/Infinity → null;undefined/function/symbol
 * 按 JSON 语义丢弃;意外抛错(抛错 getter 等)退化为固定占位串(不含原文)。
 */
export function stableSerialize(value: unknown): string {
  const ancestors = new Set<object>()
  const walk = (v: unknown): string | undefined => {
    if (v === null) return 'null'
    switch (typeof v) {
      case 'undefined':
      case 'function':
      case 'symbol':
        return undefined
      case 'number':
        return Number.isFinite(v) ? JSON.stringify(v) : 'null'
      case 'bigint':
        return `"${(v as bigint).toString(10)}"`
      case 'string':
      case 'boolean':
        return JSON.stringify(v)
      default:
        break
    }
    const obj = v as object
    if (ancestors.has(obj)) return '"[Circular]"'
    ancestors.add(obj)
    let out: string
    if (Array.isArray(obj)) {
      out = `[${obj.map((item) => walk(item) ?? 'null').join(',')}]`
    } else {
      const record = obj as Record<string, unknown>
      const parts: string[] = []
      for (const key of Object.keys(record).sort()) {
        const serialized = walk(record[key])
        if (serialized !== undefined) parts.push(`${JSON.stringify(key)}:${serialized}`)
      }
      out = `{${parts.join(',')}}`
    }
    ancestors.delete(obj)
    return out
  }
  return walk(value) ?? '{}'
}

/** 序列化整体意外抛错时的兜底占位串:不含任何入参原文。 */
const SERIALIZE_FALLBACK = '{"__doom_loop_unserializable__":true}'

/** 永不抛错版规范化序列化(共享层对入参形状零信任,兜底在此完成)。 */
export function stableSerializeSafe(value: unknown): string {
  try {
    return stableSerialize(value ?? {})
  } catch {
    return SERIALIZE_FALLBACK
  }
}

/**
 * 滑动窗口检测器 —— 只统计窗口尾部**连续**相同(工具名+入参摘要)的调用
 * (2026-09-03 语义修正:跨轮合法重读 a,b,a,b 不打断即不算重复)。
 */
export function createDoomLoopWindow(options: DoomLoopWindowOptions = {}): DoomLoopWindow {
  const windowSize = options.windowSize ?? DOOM_LOOP_WINDOW_SIZE
  const repeatThreshold = options.repeatThreshold ?? DOOM_LOOP_REPEAT_THRESHOLD
  const cooldownMs = options.cooldownMs ?? DOOM_LOOP_COOLDOWN_MS
  const window: WindowEntry[] = []
  const uniqueSet = new Set<string>()
  let totalCalls = 0

  const prune = (now: number): void => {
    while (window.length >= windowSize) {
      window.shift()
    }
    if (cooldownMs > 0) {
      while (window.length > 0 && now - Number(window[0]?.timestampMs) > cooldownMs) {
        window.shift()
      }
    }
  }

  return {
    record(toolName, inputHash) {
      const now = Date.now()
      prune(now)
      window.push({ toolName, inputHash, timestampMs: now })
      totalCalls += 1
      const uniqueKey = `${toolName}::${inputHash}`
      if (!uniqueSet.has(uniqueKey)) uniqueSet.add(uniqueKey)
      let repeatCount = 0
      for (let i = window.length - 1; i >= 0; i--) {
        const e = window[i]
        if (e && e.toolName === toolName && e.inputHash === inputHash) {
          repeatCount += 1
        } else {
          break
        }
      }
      if (repeatCount >= repeatThreshold) {
        return { toolName, inputHash, repeatCount }
      }
      return null
    },
    reset() {
      window.length = 0
      uniqueSet.clear()
      totalCalls = 0
    },
    getStats() {
      if (totalCalls === 0) {
        return { totalCalls: 0, uniqueCalls: 0, repeatRate: 0 }
      }
      return {
        totalCalls,
        uniqueCalls: uniqueSet.size,
        repeatRate: 1 - uniqueSet.size / totalCalls,
      }
    },
  }
}

/** 错误签名归一:取首行、数字→N、trim、截断(与 Python normalize_error_signature 同语义)。 */
export function normalizeErrorSignature(message: string): string {
  const firstLine = (message.split('\n')[0] ?? '').replace(/\d+/g, 'N').trim()
  return firstLine.slice(0, ERROR_SIGNATURE_MAX_LEN)
}

export interface ToolCallSignatureInput {
  name: string
  /** 该次调用入参的摘要(同样由各端以真 SHA-256 预算;轮内按 name(sig) 排序拼接)。 */
  argsHash: string
}

/** 一轮 tool_call 的轮次签名(排序拼接,与调用顺序无关)。 */
export function toolCallRoundSignature(
  calls: readonly ToolCallSignatureInput[],
): string {
  return calls
    .map((c) => `${c.name}(${c.argsHash})`)
    .sort()
    .join('|')
}

export interface StuckSignatureDetector {
  recordError: (errorMessage: string) => void
  recordToolCallRound: (calls: readonly ToolCallSignatureInput[]) => void
  isStuck: () => boolean
  reset: () => void
}

/**
 * stuck 检测器:连续相同错误签名 或 连续相同 tool_call 轮次模式达到阈值 ⇒ 卡死。
 * 阈值默认取 STUCK_CONSECUTIVE_THRESHOLD,数字只有这一处来源。
 */
export function createStuckSignatureDetector(
  threshold: number = STUCK_CONSECUTIVE_THRESHOLD,
): StuckSignatureDetector {
  let lastErrorSignature = ''
  let consecutiveErrorCount = 0
  let lastToolCallSignature = ''
  let consecutiveToolCallCount = 0
  return {
    recordError(errorMessage) {
      const sig = normalizeErrorSignature(errorMessage)
      if (sig === lastErrorSignature) {
        consecutiveErrorCount += 1
      } else {
        lastErrorSignature = sig
        consecutiveErrorCount = 1
      }
    },
    recordToolCallRound(calls) {
      const sig = toolCallRoundSignature(calls)
      if (sig === lastToolCallSignature) {
        consecutiveToolCallCount += 1
      } else {
        lastToolCallSignature = sig
        consecutiveToolCallCount = 1
      }
    },
    isStuck() {
      return (
        consecutiveErrorCount >= threshold || consecutiveToolCallCount >= threshold
      )
    },
    reset() {
      lastErrorSignature = ''
      consecutiveErrorCount = 0
      lastToolCallSignature = ''
      consecutiveToolCallCount = 0
    },
  }
}

export interface FailureStreakOutcome {
  /** 本工具当前连续失败数(成功或触发换策略后为 0)。 */
  streak: number
  /** true = 达到换策略阈值,主链路应注入反思提示;返回本标志时计数已自动清零。 */
  changeStrategy: boolean
}

export interface FailureStreakTracker {
  record: (toolName: string, ok: boolean) => FailureStreakOutcome
  reset: () => void
}

/** 按工具名计的连续失败跟踪器(阈值唯一来源 = FAILURE_STREAK_STRATEGY_THRESHOLD)。 */
export function createFailureStreakTracker(
  threshold: number = FAILURE_STREAK_STRATEGY_THRESHOLD,
): FailureStreakTracker {
  const streaks = new Map<string, number>()
  return {
    record(toolName, ok) {
      if (ok) {
        streaks.set(toolName, 0)
        return { streak: 0, changeStrategy: false }
      }
      const next = (streaks.get(toolName) ?? 0) + 1
      if (next >= threshold) {
        streaks.set(toolName, 0)
        return { streak: next, changeStrategy: true }
      }
      streaks.set(toolName, next)
      return { streak: next, changeStrategy: false }
    },
    reset() {
      streaks.clear()
    },
  }
}

export interface DoomAlertPlan {
  actions: readonly DoomLoopStrategyAction[]
  state: DoomLoopState
}

/**
 * 滑动窗口报警轮次的升级决策(纯函数,两侧等价:plan_doom_alert_response):
 *   rounds >= DOOM_ALERT_ROUNDS_TO_TERMINATE ⇒ terminate_loop(终止)
 *   rounds >= 1                           ⇒ inject_reflection + skip_tool_execution(换策略)
 *   其余                                  ⇒ 无动作(observing)
 */
export function planDoomAlertResponse(consecutiveAlertRounds: number): DoomAlertPlan {
  if (consecutiveAlertRounds >= DOOM_ALERT_ROUNDS_TO_TERMINATE) {
    return { actions: ['terminate_loop'], state: 'terminating' }
  }
  if (consecutiveAlertRounds >= 1) {
    return {
      actions: ['inject_reflection', 'skip_tool_execution'],
      state: 'reflecting',
    }
  }
  return { actions: [], state: 'observing' }
}
