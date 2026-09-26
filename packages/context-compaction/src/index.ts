// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * 上下文压缩共享包 — 跨端统一 88% 阈值自动压缩。
 *
 * 跨端共享:CLI(agent runtime)+ API(/chat/stream 入口)+ ai-service(TS 边界)共用同一套规则。
 * ai-service Python 侧有等价实现(app/core/context_compaction.py),保持语义一致。
 *
 * 阈值:
 *   - DEFAULT_TRIGGER_RATIO = 0.88(88% 触发压缩,用户需求)
 *   - DEFAULT_TARGET_RATIO = 0.6(压缩到 60% 留出空间继续对话)
 *   - CONTEXT_BUDGET_THRESHOLD = 0.7(70% 提醒阈值,与压缩互补)
 *
 * 分层金字塔摘要:摘要按时间距离分层 —— 最后 ceil(N * 0.3) 条(至少 1 条)为近层
 * (保留原文前 200 chars),其余为远层(浓缩:tool result 前 120 chars / 规则摘要),
 * 同样 token 预算下信息保留度显著更高(SUMMARY_TIER_RECENT_RATIO 等常量)。
 *
 * 灵感来源:参考行业 Agent 框架的上下文管理机制,统一所有端的行为。
 */

// 类型与 token 估算内核已抽为叶子模块(见 src/types.ts、src/token-estimate.ts),
// 让回收/有效性守卫子模块单向依赖内核而不是反向 import 本文件(避免运行期循环)。
// 本文件按原导出面 re-export,消费方(apps/api、apps/cli、packages/shared)零改动。
export type { ChatMessage, ChatMessageToolCall } from './types.js'
export {
  MESSAGE_OVERHEAD_TOKENS,
  TOOL_CALL_OVERHEAD_TOKENS,
  IMAGE_TOKEN_PLACEHOLDER,
  estimateTokens,
  estimateMessagesTokens,
} from './token-estimate.js'

import { estimateMessagesTokens, estimateTokens } from './token-estimate.js'
import { SUMMARY_MARKER } from './markers.js'
import type { ChatMessage } from './types.js'

export { SUMMARY_MARKER, isSummaryMessage } from './markers.js'
export {
  ENVELOPE_OPEN_MARKER,
  ENVELOPE_CLOSE_MARKER,
  ENVELOPE_PREVIEW_FOOTER,
  isEnvelopeContent,
} from './markers.js'

// ==================== 跨端统一常量 ====================

/** 触发压缩的占用率(88%,用户需求) */
export const DEFAULT_TRIGGER_RATIO = 0.88
/** 压缩后的目标占用率(60%,留出空间继续对话) */
export const DEFAULT_TARGET_RATIO = 0.6
/** 保留最近 N 条消息 */
export const DEFAULT_KEEP_RECENT = 6
/** 绝对值模式阈值(固定 token 数) */
export const DEFAULT_MAX_TOKENS = 24_000
/** 70% 阈值提醒(与 88% 强制压缩互补) */
export const CONTEXT_BUDGET_THRESHOLD = 0.7

// ==================== 压缩分母:共享窗口必须扣掉输出预留(P1)====================

/**
 * 输出预留的**封顶值**(tokens)。
 *
 * 为什么要扣:provider 的 context window 是 **input 与 output 共享的同一个窗口**。
 * 若分母取窗口原值,阈值算的是"占满整个共享窗口的 88%",而同一窗口里模型**还要生成回复**
 * ⇒ 故障形态:"压缩判过了还是 400 / context overflow",且越接近上限越容易炸,
 * 现象极难归因到分母。
 *
 * 为什么必须封顶(而不是照抄模型的 maxOutputTokens):共享窗口只能让出**输入侧**,
 * 各家 maxOutput 从 4K 到 64K 不等 —— 不封顶的话小窗口模型(8K / 32K)的分母会被吃到地板,
 * 表现为每轮必压缩。8192 覆盖"一轮长回复 + 工具调用参数"的实际用量。
 */
export const MAX_OUTPUT_RESERVE_TOKENS = 8_192

/** 调用方没提供 maxOutputTokens 时的保守预留(一轮典型 assistant 回复 + 工具参数) */
export const DEFAULT_OUTPUT_RESERVE_TOKENS = 2_048

export interface EffectiveContextWindowOptions {
  /** provider 声明的共享上下文窗口(tokens) */
  contextWindow: number
  /** 本轮模型可用输出上限;缺省用 DEFAULT_OUTPUT_RESERVE_TOKENS */
  maxOutputTokens?: number
  /** 额外安全余量(估算误差等),默认 0 */
  buffer?: number
  /** 显式关闭预留 ⇒ 分母逐字等于 contextWindow(旧行为)。默认开 */
  enabled?: boolean
}

/**
 * 压缩分母的唯一出口:把共享窗口里"模型这一轮要用的输出预留"扣掉,返回可安全
 * 当作 100% 的那个分母。
 *
 * 三条不变式(由 apps/cli 的 compaction 用例与守门共同看守):
 *   1. **只会 ≤ contextWindow** —— 因此压缩只会**更早**触发,绝不会更晚(fail 向安全侧);
 *   2. contextWindow <= 0 时原样返回该值(调用方的 `contextLimit > 0` 早退语义不变);
 *   3. 分母为正时**至少返回 1** —— 预留把窗口吃满是"配置矛盾",不是"不用压缩"的理由;
 *      返回地板值让判据走向"压",而不是静默变成永不触发。
 */
export function effectiveContextWindow(opts: EffectiveContextWindowOptions): number {
  const contextWindow = opts.contextWindow
  if (!Number.isFinite(contextWindow) || contextWindow <= 0) return contextWindow
  if (opts.enabled === false) return contextWindow
  const requested =
    typeof opts.maxOutputTokens === 'number' &&
    Number.isFinite(opts.maxOutputTokens) &&
    opts.maxOutputTokens > 0
      ? opts.maxOutputTokens
      : DEFAULT_OUTPUT_RESERVE_TOKENS
  const reserve = Math.min(requested, MAX_OUTPUT_RESERVE_TOKENS)
  const buffer =
    typeof opts.buffer === 'number' && Number.isFinite(opts.buffer) && opts.buffer > 0
      ? opts.buffer
      : 0
  return Math.max(1, Math.min(contextWindow, Math.floor(contextWindow - reserve - buffer)))
}

// ==================== 压缩决策的闭集原因(P2)====================

/**
 * "为什么压 / 为什么没压"的机器可读答案 —— **声明式闭集**,消费方不得自由发挥字符串。
 *
 * 为什么立成闭集而不是一道门:判"有没有回答原因"结构上判不准(任何字符串都能占位),
 * 为它立门只会逼人写一次空调用。所以这里用 TS union 钉死值域,由 `--self-test` /
 * 单测断言"每条返回路径都落在这个集合里"。
 *
 * 语义(每条对应 compressContextV2 / ContextGuards 的一条真实返回路径):
 *   - `disabled`          压缩链路被显式关闭(V2 feature flag 关 / 调用方 opts 关)
 *   - `below-threshold`   占用率未达触发线,本轮无需压缩
 *   - `above-threshold`   占用率已过触发线,本轮**确实**完成了压缩(含零模型请求的回收)
 *   - `not-enough`        消息条数 / 可压部分体积不足,压不动也没意义
 *   - `guard-rejected`    reductionGuard 判定摘要收益不达标而拒绝采用
 *   - `circuit-breaker`   连续快速回填达上限,已熔断 ⇒ **不再发起压缩请求**
 *   - `sampler-failed`    摘要请求本身失败(瞬态耗尽 / 4xx),含退化摘要
 *   - `incompressible`    压到地板仍超触发线(system 本身巨大),返回原消息防循环
 *   - `truncated`         常规摘要压不动,已改走内容截断降级
 */
export const COMPACTION_DECISION_REASONS = [
  'disabled',
  'below-threshold',
  'above-threshold',
  'not-enough',
  'guard-rejected',
  'circuit-breaker',
  'sampler-failed',
  'incompressible',
  'truncated',
] as const

export type CompactionDecisionReason = (typeof COMPACTION_DECISION_REASONS)[number]

/** 值域判定(消费方校验 / 单测用);非闭集取值一律 false */
export function isCompactionDecisionReason(value: unknown): value is CompactionDecisionReason {
  return (
    typeof value === 'string' && (COMPACTION_DECISION_REASONS as readonly string[]).includes(value)
  )
}

// 截断降级(truncate-fallback)常量:常规压缩无效时对最后一条消息做内容截断
/** 截断保留的最小字符数(下限) */
export const MIN_TRUNCATE_CHARS = 100
/** 截断标记(追加在被截断内容末尾) */
export const TRUNCATION_MARKER = '…[已截断]'
/** 截断迭代最大次数 */
export const MAX_TRUNCATE_ATTEMPTS = 8
// SUMMARY_MARKER 已收口到 src/markers.ts 单源(见本文件顶部 re-export),此处不再定义

// 分层金字塔摘要常量:按时间距离分层 —— 越近的保留越多细节,越远的越浓缩,
// 同样 token 预算下信息保留度显著更高(与 ai-service Python 端逐语义一致)
/** 近层占比:toCompress 非历史摘要消息中最后 ceil(N * ratio) 条(至少 1 条)为近层 */
export const SUMMARY_TIER_RECENT_RATIO = 0.3
/** 近层消息保留的字符数(user/assistant 直截 + tool result) */
export const SUMMARY_RECENT_CHARS = 200
/** 远层消息保留的字符数(tool result 截断 + user/assistant 规则摘要行总长上限) */
export const SUMMARY_REMOTE_CHARS = 120

// ==================== Token 估算常量(同上,保留以便 README/外部文档参考) ====================

// ==================== 压缩结果类型 ====================

export interface CompressionResult {
  messages: ChatMessage[]
  compressed: boolean
  originalTokens: number
  compressedTokens: number
  removedCount: number
  /**
   * 本轮被**内容级截断**的消息条数(与 `removedCount` 不同维,不可互相代替):
   *   - `removedCount` = 被折进摘要而移出上下文的**整条**消息数;
   *   - `truncatedCount` = 原地把内容切短、**仍然存在**的消息数。
   * 立因(A10B-8,2026-09-26):截断兜底路径在"只剩一个配对组"时 `removedCount` 恒为 0,
   * 而内容确实被切过 —— 只靠 `trigger === 'truncated'` 判披露会把"已省略 0 条"这种
   * 自相矛盾的话念出来,把它当唯一判据改成"整句不显示"又是从说谎退成沉默。
   * 这个字段就是"这一轮到底截断了多少"的独立事实,消费侧据此决定报量还是只报"已截断"。
   * 可选 ⇒ 旧调用方与旧帧零改动(缺席读作"未知",不读作 0)。
   */
  truncatedCount?: number
  /**
   * 压缩触发方式:
   *   - 'ratio':百分比阈值触发并压缩成功
   *   - 'absolute':绝对值阈值触发并压缩成功
   *   - 'none':未达阈值,不压缩
   *   - 'truncated':常规摘要压缩压不动,已对最后一条消息做内容级截断降级(截断成功,保证对话可用)
   *   - 'incompressible':截断到最小长度仍 >= 触发阈值(典型:system 本身巨大),返回原消息防循环
   *   - 'reclaim':仅靠**零模型请求**的旧工具结果回收就把体量降到触发线以下
   *     (没花一次摘要调用,见 src/reclaim.ts)
   */
  trigger?: 'ratio' | 'absolute' | 'none' | 'truncated' | 'incompressible' | 'reclaim'
  /**
   * 本次决策的闭集原因("为什么压 / 为什么没压")。与 `trigger` 不重叠:
   * `trigger` 只说触发方式,`reason` 说**决策依据**,未压时也必须能回答。
   * 值域见 `COMPACTION_DECISION_REASONS`。可选 ⇒ 既有调用方零改动。
   */
  reason?: CompactionDecisionReason
  usageRatio?: number
}

export interface CompressionOptions {
  maxTokens?: number
  keepRecent?: number
}

export interface RatioCompressionOptions {
  /** 模型上下文窗口大小(tokens,如 8000 / 32000 / 128000) */
  contextLimit: number
  /** 触发压缩的占用率(0-1,默认 0.88 = 88%) */
  triggerRatio?: number
  /** 压缩后的目标占用率(0-1,默认 0.6 = 60%) */
  targetRatio?: number
  /** 保留最近 N 条消息(默认 6) */
  keepRecent?: number
  /** 最少消息数(消息数不足时不压缩,默认 keepRecent + 1) */
  minMessages?: number
  /**
   * 外部预生成的语义摘要(可选,如 API 端用 LLM 对被压缩消息生成的摘要)。
   * 提供时:kr 方案的摘要消息用该文本替代规则摘要(仅首次压缩生效,防嵌套逻辑不受影响);
   * 未提供或为空:使用内置规则摘要。
   */
  customSummary?: string
}

/** 可选的钩子回调(CLI agent runtime 注入,API/Web 端不传) */
export interface CompactionHooks {
  preCompact?: (ctx: { compactedTokensBefore: number }) => void
  postCompact?: (ctx: { compactedTokensBefore: number; compactedTokensAfter: number }) => void
}

// ==================== tool_calls 配对组切分 ====================

/**
 * 把 non-system 消息切成"配对组":assistant(tool_calls) 与其后续匹配的 tool 结果消息
 * 属于同一组,压缩切分只允许落在组边界上(防止压缩后出现孤 tool 消息 —— 前面没有
 * 对应 tool_calls 的 tool 消息发给 OpenAI 兼容端点会直接 400)。
 *
 * 规则:
 *   - 遇到 assistant 且 tool_calls 非空 → 开新组,收集后续 role='tool' 且
 *     tool_call_id ∈ 该 assistant tool_calls[].id 的消息入组(pendingIds 清空或
 *     遇到其他消息即结束组);
 *   - 其他消息各自成组;
 *   - 异常序列防御:tool 消息找不到所属 assistant(无 pending 匹配)时自成组。
 *
 * @returns 组列表(按原顺序拼接后与 nonSystem 完全一致)
 */
function splitPairGroups(nonSystem: ChatMessage[]): ChatMessage[][] {
  const groups: ChatMessage[][] = []
  let currentGroup: ChatMessage[] = []
  let pendingIds: Set<string> = new Set()
  let collecting = false

  const closeGroup = (): void => {
    if (collecting && currentGroup.length > 0) groups.push(currentGroup)
    currentGroup = []
    pendingIds = new Set()
    collecting = false
  }

  for (const msg of nonSystem) {
    if (
      collecting &&
      msg.role === 'tool' &&
      typeof msg.tool_call_id === 'string' &&
      pendingIds.has(msg.tool_call_id)
    ) {
      // 匹配中的 tool 结果消息入组;全部 id 到齐即结束组
      currentGroup.push(msg)
      pendingIds.delete(msg.tool_call_id)
      if (pendingIds.size === 0) closeGroup()
      continue
    }
    closeGroup() // 遇到其他消息(或不匹配的 tool)即结束当前组
    if (msg.role === 'assistant' && Array.isArray(msg.tool_calls) && msg.tool_calls.length > 0) {
      const ids = new Set<string>()
      for (const tc of msg.tool_calls) {
        if (tc && typeof tc.id === 'string') ids.add(tc.id)
      }
      if (ids.size > 0) {
        currentGroup = [msg]
        pendingIds = ids
        collecting = true
      } else {
        groups.push([msg]) // tool_calls 无有效 id,退化为普通单条
      }
      continue
    }
    groups.push([msg])
  }
  closeGroup()
  return groups
}

// ==================== 结构化摘要 ====================

/** 历史摘要标记行中"已压缩条数"的解析(解析失败按 1 计) */
const SUMMARY_COVERED_REGEX = /之前 (\d+) 条消息已压缩/

/**
 * 构建摘要消息(role='user',content 以 SUMMARY_MARKER 标记行开头)。
 *
 * 分层金字塔摘要:对 toCompress 中的"非历史摘要"消息按位置分层 ——
 * 最后 ceil(N * SUMMARY_TIER_RECENT_RATIO) 条(至少 1 条)为近层,其余为远层
 * (N 为非历史摘要消息条数)。近层保留原文细节(前 SUMMARY_RECENT_CHARS chars 直截),
 * 远层浓缩(tool result 前 SUMMARY_REMOTE_CHARS chars / user+assistant 规则摘要),
 * 同样 token 预算下信息保留度更高。层级只影响保留量,摘要行输出格式无层级标记。
 *
 * 防嵌套:toCompress 中的历史摘要消息(SUMMARY_MARKER 开头)不套摘要逻辑,
 * 而是解析其覆盖条数并把标记行之后的正文原样并入新摘要 —— 多轮压缩后摘要始终保持
 * "一层扁平结构",信息不逐轮衰减。
 * 标记行条数 = toCompress 中非摘要消息条数 + 所有旧摘要覆盖条数之和。
 *
 * @param customSummary 外部预生成的摘要正文(可选):非空时优先级最高,整段替代规则摘要
 * 正文(LLM 已做语义浓缩,不再分层),标记行仍自动生成
 */
function buildSummaryMessage(toCompress: ChatMessage[], customSummary?: string): ChatMessage {
  // 预统计非历史摘要消息条数,确定近层边界(最后 ceil(N * ratio) 条,至少 1 条)
  let nonSummaryTotal = 0
  for (const msg of toCompress) {
    if (msg.role === 'user' && msg.content.startsWith(SUMMARY_MARKER)) continue
    nonSummaryTotal++
  }
  const recentCount = Math.max(1, Math.ceil(nonSummaryTotal * SUMMARY_TIER_RECENT_RATIO))
  const recentFrom = nonSummaryTotal - recentCount

  let coveredFromOld = 0
  let nonSummaryCount = 0
  const bodyParts: string[] = []
  for (const msg of toCompress) {
    if (msg.role === 'user' && msg.content.startsWith(SUMMARY_MARKER)) {
      // 历史摘要:覆盖条数累计 + 正文原样并入(防嵌套,不再摘要)
      const m = SUMMARY_COVERED_REGEX.exec(msg.content)
      const parsed = m ? Number.parseInt(m[1]!, 10) : Number.NaN
      coveredFromOld += Number.isFinite(parsed) && parsed > 0 ? parsed : 1
      const newlineIdx = msg.content.indexOf('\n')
      if (newlineIdx >= 0 && newlineIdx + 1 < msg.content.length) {
        bodyParts.push(msg.content.slice(newlineIdx + 1))
      }
      continue
    }
    // 分层金字塔:按非摘要消息序号判层(近层保留原文细节,远层规则摘要浓缩)
    bodyParts.push(summarizeAtTier(msg, nonSummaryCount >= recentFrom))
    nonSummaryCount++
  }
  const body =
    customSummary !== undefined && customSummary.length > 0 ? customSummary : bodyParts.join('\n')
  return {
    role: 'user',
    content: `[上下文摘要 — 之前 ${nonSummaryCount + coveredFromOld} 条消息已压缩]\n${body}`,
  }
}

/**
 * 按层级生成单条消息的摘要行(分层金字塔,与 Python 端 _build_structured_summary 逐语义一致)。
 *
 * - 近层 tool result / user / assistant:role 标签 + content 前 SUMMARY_RECENT_CHARS chars
 *   直截(超长加 '…',不足则全保留,无信息丢弃)
 * - 远层 tool result:前 SUMMARY_REMOTE_CHARS chars(原 '[tool] content…' 格式)
 * - 远层 user / assistant:summarizeMessage 规则摘要(工具调用名/代码块语言/首句,~27 tokens)
 */
function summarizeAtTier(msg: ChatMessage, isRecent: boolean): string {
  const content = msg.content
  if (!content) return `[${msg.role}] (空)`
  if (msg.role === 'tool') {
    const keep = isRecent ? SUMMARY_RECENT_CHARS : SUMMARY_REMOTE_CHARS
    return content.length > keep ? `[tool] ${content.slice(0, keep)}…` : `[tool] ${content}`
  }
  if (!isRecent) return summarizeMessage(msg)
  return content.length > SUMMARY_RECENT_CHARS
    ? `[${msg.role}] ${content.slice(0, SUMMARY_RECENT_CHARS)}…`
    : `[${msg.role}] ${content}`
}

/**
 * 截断降级(truncate-fallback) — kr=1 方案 + 最后一条消息内容截断(system 消息永不截断)。
 *
 * 常规摘要压缩无法达标时(典型:超长单条消息如粘贴大文件,摘要化收益不足),
 * 重建 kr=1 方案(system + 摘要 + 最后一条消息),对最后一条消息做内容截断,
 * 按 BPE 密度估算裁剪字符量,迭代收敛到目标阈值以下。
 * 组边界对齐:保留侧是最后一条非 system 消息所在的完整配对组,组内 tool result 不截断,
 * 只截断组内最后一条 user/assistant 的 str content(最后组只有一条消息时行为与旧版一致)。
 *
 * @returns 截断后 tokens < 触发阈值 → CompressionResult(trigger='truncated');
 *          截断到最小长度仍 >= 触发阈值(典型:system 本身巨大)→ null(走 incompressible)
 */
function tryTruncateFallback(
  systemMsgs: ChatMessage[],
  nonSystem: ChatMessage[],
  originalTokens: number,
  triggerThreshold: number,
  targetThreshold: number,
  usageRatio: number,
): CompressionResult | null {
  if (nonSystem.length === 0) return null

  const groups = splitPairGroups(nonSystem)
  const lastGroup = groups[groups.length - 1]!

  // 截断对象:最后组内最后一条 user/assistant 且 content 为非空 str 的消息(tool result 不截断)
  let truncateIdx = -1
  for (let i = lastGroup.length - 1; i >= 0; i--) {
    const m = lastGroup[i]!
    if (
      (m.role === 'user' || m.role === 'assistant') &&
      typeof m.content === 'string' &&
      m.content
    ) {
      truncateIdx = i
      break
    }
  }
  if (truncateIdx < 0) {
    // 组内无可安全截断的 user/assistant str content(如全为 tool result)→ 交给 incompressible
    return null
  }

  // kr=1 方案(组边界对齐):system + 摘要(除最后组外的全部 non-system) + 最后一组
  const toCompressAll = groups.slice(0, -1).flat()
  const summaryMsg = buildSummaryMessage(toCompressAll)
  const keptGroup = lastGroup.slice()
  const truncateTarget = keptGroup[truncateIdx]!
  // 拷贝截断目标消息,不改动原消息列表
  const truncatedCopy: ChatMessage = { ...truncateTarget }
  keptGroup[truncateIdx] = truncatedCopy
  const candidate: ChatMessage[] = [...systemMsgs, summaryMsg, ...keptGroup]

  let keepContent = truncateTarget.content
  let tokens = 0
  for (let attempt = 0; attempt < MAX_TRUNCATE_ATTEMPTS; attempt++) {
    truncatedCopy.content = keepContent
    tokens = estimateMessagesTokens(candidate)
    if (tokens <= targetThreshold) break // 截断成功
    if (keepContent.length <= MIN_TRUNCATE_CHARS) break // 截到下限仍不达标
    const excessTokens = tokens - targetThreshold
    // 每 char 的 token 数(BPE 密度),据此估算需裁剪的字符数,1.2 倍安全余量
    const density = estimateTokens(keepContent) / Math.max(1, keepContent.length)
    const cutChars = Math.ceil((excessTokens / Math.max(density, 0.01)) * 1.2)
    keepContent =
      keepContent.slice(0, Math.max(MIN_TRUNCATE_CHARS, keepContent.length - cutChars)) +
      TRUNCATION_MARKER
  }

  if (tokens >= triggerThreshold) {
    // 截断到最小长度仍超触发阈值 → 第二级 incompressible
    return null
  }

  console.warn(
    `[Compaction] truncate-fallback: ${originalTokens} → ${tokens} tokens (trigger_threshold=${triggerThreshold}), ` +
      `last message ${truncateTarget.content.length} → ${truncatedCopy.content.length} chars`,
  )
  return {
    messages: candidate,
    compressed: true,
    originalTokens,
    compressedTokens: tokens,
    removedCount: toCompressAll.length,
    // 本路径**必然**切了最后一条消息的内容(上面 truncatedCopy 就地改写了 keptGroup[truncateIdx]),
    // 而 removedCount 在"只剩一个配对组"时是 0 ⇒ 披露侧拿它当唯一判据就会整句沉默。
    // 这一格就是那一轮的真实截断量:1 条被截断(与 toCompressAll 是否为空无关)。
    truncatedCount: 1,
    trigger: 'truncated',
    usageRatio,
  }
}

const TOOL_CALL_REGEX = /```tool_call\s*\n([\s\S]*?)```/g
const TOOL_RESULT_REGEX = /\[工具结果\s*[✓✗]\]\s*(\S+)/g
const CODE_BLOCK_REGEX = /```(\w+)?/g

/**
 * 从单条消息内容提取结构化关键信息(智能摘要)。
 *
 * 替代 `msg.content.slice(0, 200)` 的粗暴截断,提取:
 *   - assistant:tool_call 名称列表 + 首句决策 + 代码块语言标识
 *   - user:tool_result 状态(✓/✗)+ 工具名 + 首句
 *   - tool:content 折叠空白后取前 SUMMARY_REMOTE_CHARS chars 原样保留(超长截断加省略号)
 *   - 其他:首句
 *
 * 注:旧 MAX_SUMMARY_LEN(160)常量已统一收编到分层金字塔常量 SUMMARY_REMOTE_CHARS(120)。
 */
export function summarizeMessage(msg: ChatMessage): string {
  const role = msg.role
  const content = msg.content
  if (!content) return `[${role}] (空)`

  // tool 结果消息:保留 content 前 SUMMARY_REMOTE_CHARS chars(压缩后摘要仍含工具结果要点,
  // 信息保留度优先),超长截断加省略号,空内容才用纯占位。
  // 必须先把内部换行/连续空白折叠为单空格再截断 —— 结构化摘要的不变式是
  // 「一条消息 = 一行」(跨端 fixtures 全部按此断言);工具结果 content 常含多行输出,
  // 若原样拼接会让单条消息裂成多行,破坏 summaryLines() 的行数契约(2026-09-10 修复)。
  if (role === 'tool') {
    const flat = content.replace(/\s+/g, ' ').trim()
    return flat.length > SUMMARY_REMOTE_CHARS
      ? `[tool] ${flat.slice(0, SUMMARY_REMOTE_CHARS)}…`
      : `[tool] ${flat}`
  }

  const parts: string[] = [`[${role}]`]

  if (role === 'assistant') {
    const toolNames: string[] = []
    let m: RegExpExecArray | null
    TOOL_CALL_REGEX.lastIndex = 0
    while ((m = TOOL_CALL_REGEX.exec(content)) !== null) {
      try {
        const parsed = JSON.parse(m[1]!.trim())
        if (parsed && typeof parsed.name === 'string') toolNames.push(parsed.name)
      } catch {
        // 忽略解析失败
      }
    }
    if (toolNames.length > 0) {
      parts.push(`工具调用: ${toolNames.join(', ')}`)
    }
  }

  if (role === 'user') {
    const results: string[] = []
    let m: RegExpExecArray | null
    TOOL_RESULT_REGEX.lastIndex = 0
    while ((m = TOOL_RESULT_REGEX.exec(content)) !== null) {
      results.push(m[1]!)
    }
    if (results.length > 0) {
      parts.push(`工具结果: ${results.join(', ')}`)
    }
  }

  if (role === 'assistant') {
    const langs: string[] = []
    let m: RegExpExecArray | null
    CODE_BLOCK_REGEX.lastIndex = 0
    while ((m = CODE_BLOCK_REGEX.exec(content)) !== null) {
      const lang = m[1]
      if (lang && !langs.includes(lang)) langs.push(lang)
    }
    if (langs.length > 0) {
      parts.push(`代码块: ${langs.join(', ')}`)
    }
  }

  const firstSentence =
    content
      .replace(/```[\s\S]*?```/g, ' ')
      .replace(/[#*`>_~]/g, ' ')
      .replace(/\s+/g, ' ')
      .trim()
      .split(/[。.!!\n?]/)[0] ?? ''
  if (firstSentence) {
    parts.push(firstSentence.slice(0, 80))
  }

  let summary = parts.join(' ')
  if (summary.length > SUMMARY_REMOTE_CHARS) {
    summary = summary.slice(0, SUMMARY_REMOTE_CHARS - 3) + '...'
  }
  return summary
}

/** 批量生成结构化摘要 */
export function buildStructuredSummary(messages: ChatMessage[]): string {
  return messages.map(summarizeMessage).join('\n')
}

// ==================== 绝对值阈值压缩 ====================

export function compressContext(
  messages: ChatMessage[],
  opts: CompressionOptions = {},
): CompressionResult {
  const maxTokens = opts.maxTokens ?? DEFAULT_MAX_TOKENS
  const keepRecent = opts.keepRecent ?? DEFAULT_KEEP_RECENT
  const originalTokens = estimateMessagesTokens(messages)

  if (originalTokens <= maxTokens || messages.length <= keepRecent + 1) {
    return {
      messages,
      compressed: false,
      originalTokens,
      compressedTokens: originalTokens,
      removedCount: 0,
      trigger: 'none',
    }
  }

  const systemMsgs = messages.filter((m) => m.role === 'system')
  const nonSystem = messages.filter((m) => m.role !== 'system')
  const keepCount = Math.min(keepRecent, nonSystem.length)
  // tool_calls 配对组边界对齐:从组列表尾部往前累计消息条数 >= keepCount(防孤 tool 消息)
  const groups = splitPairGroups(nonSystem)
  let kept = 0
  let gi = groups.length
  while (gi > 0 && kept < keepCount) {
    gi--
    kept += groups[gi]!.length
  }
  if (gi <= 0) {
    // 全部 non-system 消息构成单一配对组,无法在不拆组的前提下切分 → 不压缩
    return {
      messages,
      compressed: false,
      originalTokens,
      compressedTokens: originalTokens,
      removedCount: 0,
      trigger: 'none',
    }
  }
  const toCompress = groups.slice(0, gi).flat()
  const toKeep = groups.slice(gi).flat()

  const summaryMsg = buildSummaryMessage(toCompress)

  const result = [...systemMsgs, summaryMsg, ...toKeep]
  const compressedTokens = estimateMessagesTokens(result)

  return {
    messages: result,
    compressed: true,
    originalTokens,
    compressedTokens,
    removedCount: toCompress.length,
    // 摘要压缩路径不切任何人的内容:显式填 0,消费侧因此能把"0"读成事实而非未知
    truncatedCount: 0,
    trigger: 'absolute',
  }
}

// ==================== 百分比阈值自动压缩(跨端统一 88%) ====================

/**
 * 百分比阈值自动压缩 — 当 token 占用率达到 triggerRatio(默认 0.88)时自动压缩到 targetRatio(默认 0.6)。
 *
 * 行为:
 *   - tokens / contextLimit < triggerRatio → 不压缩,返回原 messages
 *   - tokens / contextLimit >= triggerRatio → 压缩,目标压缩到 targetRatio * contextLimit 以下
 *   - 通过逐步减少 keepRecent,找到第一个使 compressedTokens < targetRatio * contextLimit 的方案
 *
 * 跨端共享:CLI / API / ai-service(TS 边界)共用同一套规则,确保所有端行为一致。
 *
 * @param hooks 可选的钩子回调(CLI agent runtime 注入,API/Web 端不传)
 */
export function compressContextIfNeeded(
  messages: ChatMessage[],
  opts: RatioCompressionOptions,
  hooks?: CompactionHooks,
): CompressionResult {
  const contextLimit = opts.contextLimit
  const triggerRatio = opts.triggerRatio ?? DEFAULT_TRIGGER_RATIO
  const targetRatio = opts.targetRatio ?? DEFAULT_TARGET_RATIO
  const keepRecent = opts.keepRecent ?? DEFAULT_KEEP_RECENT
  // 2026-08-16 立:仅保留首条 system 消息 + 1 条用户消息(刚发的那条)即可压缩。
  // 之前 keepRecent + 1 = 7 的默认值,在短对话或 history 被 repair 截断时会误判为"消息不足"。
  const minMessages = opts.minMessages ?? 2
  const triggerThreshold = Math.floor(contextLimit * triggerRatio)
  const targetThreshold = Math.floor(contextLimit * targetRatio)

  const originalTokens = estimateMessagesTokens(messages)
  const usageRatio = contextLimit > 0 ? originalTokens / contextLimit : 0

  // 未达触发阈值,不压缩
  if (originalTokens < triggerThreshold || messages.length <= minMessages) {
    return {
      messages,
      compressed: false,
      originalTokens,
      compressedTokens: originalTokens,
      removedCount: 0,
      trigger: 'none',
      usageRatio,
    }
  }

  hooks?.preCompact?.({ compactedTokensBefore: originalTokens })

  const systemMsgs = messages.filter((m) => m.role === 'system')
  const nonSystem = messages.filter((m) => m.role !== 'system')
  // tool_calls 配对组:切分只允许落在组边界,防止压缩后出现孤 tool 消息(OpenAI 兼容端点 400)
  const groups = splitPairGroups(nonSystem)
  const customSummary = opts.customSummary ?? ''
  const krStart = Math.min(keepRecent, nonSystem.length - 1)

  // 逐步减少 keepRecent,直到 compressedTokens < targetThreshold 或 keepRecent=1
  let bestResult: CompressionResult | null = null
  // 未达标候选中 tokens 最小的方案(循环结束后若全部未达标,用它做防循环判断与最终结果)
  let smallestCandidate: CompressionResult | null = null
  for (let kr = krStart; kr >= 1; kr--) {
    // 从组列表尾部往前累计消息条数,直到 >= kr,切分点对齐到组边界(toCompress/toKeep 都不拆散配对组)
    let kept = 0
    let gi = groups.length
    while (gi > 0 && kept < kr) {
      gi--
      kept += groups[gi]!.length
    }
    if (gi <= 0) continue // 单组覆盖全部消息,无法在组边界切分(toCompress 为空)
    const toCompress = groups.slice(0, gi).flat()
    const toKeep = groups.slice(gi).flat()

    // customSummary 仅用于首个(最大保留 kr)方案 —— 其压缩范围即"最大保留方案的压缩范围";
    // 更小 kr 的 fallback 方案仍用规则摘要(标记行两种方案都自动生成,格式一致)
    const summaryMsg = buildSummaryMessage(
      toCompress,
      customSummary.length > 0 && kr === krStart ? customSummary : undefined,
    )
    const candidate = [...systemMsgs, summaryMsg, ...toKeep]
    const candidateTokens = estimateMessagesTokens(candidate)

    if (candidateTokens <= targetThreshold) {
      bestResult = {
        messages: candidate,
        compressed: true,
        originalTokens,
        compressedTokens: candidateTokens,
        removedCount: toCompress.length,
        // 摘要压缩路径不切任何人的内容:显式填 0,消费侧因此能把"0"读成事实而非未知
        truncatedCount: 0,
        trigger: 'ratio',
        usageRatio,
      }
      break
    }
    // 记录 tokens 最小的未达标候选(即使超过 target,也比不压缩好;取最小者压缩收益最大)
    if (!smallestCandidate || candidateTokens < smallestCandidate.compressedTokens) {
      smallestCandidate = {
        messages: candidate,
        compressed: true,
        originalTokens,
        compressedTokens: candidateTokens,
        removedCount: toCompress.length,
        // 摘要压缩路径不切任何人的内容:显式填 0,消费侧因此能把"0"读成事实而非未知
        truncatedCount: 0,
        trigger: 'ratio',
        usageRatio,
      }
    }
  }

  // 2026-08-16 立:极端情况下(如 nonSystem.length < 2,或循环 0 次),
  // 强制把全部非系统消息压成单条 summary,确保即便消息极少也触发压缩。
  // 之前走兜底返回 compressed:false,导致 token 一直累积、永远不压缩。
  if (!bestResult && !smallestCandidate) {
    // 2026-08-29 立:极端兜底分支会把全部消息(含末尾当前输入)摘要化,降级但内容部分保留。
    // 打 warning 便于线上观测该路径的实际触发频率,再决定是否额外保留末尾原始消息。
    console.warn(
      '[Compaction] fallback: all non-system messages summarized (including trailing user input),',
      { messageCount: nonSystem.length, originalTokens },
    )
    // 条数统计与防嵌套逻辑和 kr 方案一致(历史摘要覆盖条数累计,正文原样并入)
    const summaryMsg = buildSummaryMessage(nonSystem)
    const candidate = [...systemMsgs, summaryMsg]
    const candidateTokens = estimateMessagesTokens(candidate)
    smallestCandidate = {
      messages: candidate,
      compressed: true,
      originalTokens,
      compressedTokens: candidateTokens,
      removedCount: nonSystem.length,
      // 极端兜底同样是"整条折进摘要",没有内容级截断 ⇒ 0
      truncatedCount: 0,
      trigger: 'ratio',
      usageRatio,
    }
  }

  // 2026-09-01 立:防循环压缩保护 — 无达标方案时,若最优候选(压缩后 token 最小)仍 >= 触发阈值,
  // 说明常规摘要压缩"压不动"(摘要化收益不足以降到 88% 以下)。此时若仍返回压缩结果,
  // 下一轮会再次触发压缩并对摘要再摘要,导致信息每轮退化 + 每轮必压缩的循环。
  // 两级降级:① 截断最后一条消息内容(trigger='truncated',超长单条消息如粘贴大文件的兜底);
  //          ② 截断到最小长度仍超阈值(典型:system 本身巨大)→ 返回原消息(trigger='incompressible')。
  // 与 ai-service Python 端(app/core/context_compaction.py 的 _truncate_fallback)语义对齐。
  if (!bestResult && smallestCandidate!.compressedTokens >= triggerThreshold) {
    const truncateResult = tryTruncateFallback(
      systemMsgs,
      nonSystem,
      originalTokens,
      triggerThreshold,
      targetThreshold,
      usageRatio,
    )
    if (truncateResult) {
      hooks?.postCompact?.({
        compactedTokensBefore: originalTokens,
        compactedTokensAfter: truncateResult.compressedTokens,
      })
      return truncateResult
    }

    console.warn(
      '[Compaction] incompressible: best candidate still exceeds trigger threshold, keep original messages,',
      {
        originalTokens,
        candidateTokens: smallestCandidate!.compressedTokens,
        triggerThreshold,
        messageCount: messages.length,
      },
    )
    // preCompact 已触发,补发 postCompact(after=before)保持钩子配对语义
    hooks?.postCompact?.({
      compactedTokensBefore: originalTokens,
      compactedTokensAfter: originalTokens,
    })
    return {
      messages,
      compressed: false,
      originalTokens,
      compressedTokens: originalTokens,
      removedCount: 0,
      trigger: 'incompressible',
      usageRatio,
    }
  }

  const finalResult = bestResult ?? smallestCandidate!
  hooks?.postCompact?.({
    compactedTokensBefore: originalTokens,
    compactedTokensAfter: finalResult.compressedTokens,
  })
  return finalResult
}

// ==================== 回收(reclaim)与三道有效性守卫 ====================
// 实现分文件,re-export 保持"一个包一个入口"的公开面(apps/cli、apps/api 不深导入内部路径)
export {
  RECLAIMABLE_TOOL_NAMES,
  RECLAIM_KEEP_RECENT_ROUNDS,
  RECLAIM_MIN_RESULT_TOKENS,
  RECLAIM_MIN_SAVED_TOKENS,
  NON_RECLAIMABLE_EDIT_TOOLS,
  RECLAIM_PLACEHOLDER,
  RECLAIM_WINDOW_RATIO_TRIGGER,
  RECLAIM_IDLE_TRIGGER_MS,
  reclaimStaleToolResults,
  splitAssistantRounds,
  hasMultimodalBlock,
  isReclaimedPlaceholder,
  type ReclaimOptions,
  type ReclaimResult,
  type ReclaimSkipReason,
  type ReclaimTrigger,
} from './reclaim.js'
export {
  REFILL_QUICK_WINDOW_ROUNDS,
  REFILL_BREAKER_MAX_CONSECUTIVE,
  OVERFLOW_DROP_MAX_ROUNDS,
  NEXT_TURN_GROWTH_TOKENS,
  reverifyContextAfterCompaction,
  pickAuthoritativeTokens,
  RefillBreaker,
  buildRefillDiagnostic,
  retryAfterOverflowDrop,
  findOrphanToolMessages,
  type ProviderUsage,
  type ReverifyOptions,
  type ReverifiedContext,
  type RefillBreakerOptions,
  type RefillObservation,
  type OverflowDropOptions,
  type OverflowDropResult,
} from './validity-guards.js'
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
