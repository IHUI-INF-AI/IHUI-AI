// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * 上下文占用归因分解(跨端共享,纯函数)。
 *
 * 解决的问题:此前界面只有一个"用了多少"的环,回答不了**是谁占满的**。
 * 一个会话逼近窗口上限时,可能是系统提示、工具 schema、技能正文,也可能是某条
 * 巨大的工具结果 —— 这四类的处置手段完全不同(前三者要么砍工具要么换模型,
 * 最后一种该压缩历史),所以必须按**构成来源**分解,而不是只报总量。
 *
 * 三条设计约束:
 * 1. **自己算,不信 provider 估算**:每个 segment 的 token 由本模块按文本长度折算
 *    (复用 estimateTokens)。provider 回传的 usage 只用作**校准**(给出真值与差额),
 *    绝不当作分解依据 —— 它只有一个总数,给不出构成。
 * 2. **不可观测要如实说**:浏览器端拿不到工具 schema 和技能正文(它们在服务端),
 *    这类 segment 标 `observed:false` + `unobservedCode`,不得静默记 0 ——
 *    记 0 会让占比看起来正常,而真实的那一块被藏起来了。
 * 3. **缓存命中不改占用、只改重算量**:cache_read 的 token 仍在窗口内占位,
 *    但不需要重新 prefill。所以这里把"占用"与"重算"分成两个数,不混为一谈。
 *
 * 词表纪律:本模块是跨端共享层,产出的字符串只有**数据本身**(截断后的正文、
 * 工具名)与**ASCII 哨兵键**(以 `@` 开头,由各界面经 i18n 翻译)。
 * 不得在此内联任何面向用户的自然语言 —— 那等于绕过五语言 parity。
 */

import { estimateTokens } from './token-estimate'

/** 归因段固定枚举:新增一档必须同时补 UI 词表与占比色,不得在端内自立 */
export type AttributionKey =
  | 'system'
  | 'toolSchema'
  | 'skill'
  | 'roleUser'
  | 'roleAssistant'
  | 'roleToolCall'
  | 'roleToolResult'

export const ATTRIBUTION_KEYS = [
  'system',
  'toolSchema',
  'skill',
  'roleUser',
  'roleAssistant',
  'roleToolCall',
  'roleToolResult',
] as const satisfies readonly AttributionKey[]

/** 不可观测原因码(UI 侧按码查 i18n,不在此写文案) */
export type UnobservedCode = 'server-only' | 'not-supplied'

/** 明细条目里由引擎合成的哨兵标签(以 @ 开头),UI 侧映射到词表 */
export const LABEL_SENTINELS = {
  /** 整段系统提示(未逐条下发时的兜底聚合项) */
  systemPrompt: '@system-prompt',
  /** 工具调用的结果体 */
  toolResultSuffix: '@result',
  /** 缺名字的条目(理论不该出现,给个可翻译哨兵而不是内联文案) */
  unnamed: '@unnamed',
} as const

/** 明细条目(可展开):label 是数据本身或 @哨兵键,tokens 是这一条自己的占用 */
export interface AttributionDetail {
  label: string
  tokens: number
  /** 明细子类型(工具调用 vs 其结果),UI 据此决定标签排版与 i18n 词 */
  kind?: 'item' | 'call' | 'result'
  /**
   * 尾部摘录,**只**给"正文类"明细(用户/助手消息正文、工具调用参数、工具结果体)。
   *
   * 为什么界面需要它:label 按 clipLabel 保留的是**头部**,而真实会话里一条超长
   * 条目的信息量恰恰在结尾 —— 粘贴的正文在前、提问在后,日志刷了几百行、失败原因
   * 在最后一行。只给头部时,两条 900 字的用户消息在前 48 字里长得一模一样,
   * 明细"展开了等于没展开"。名字类明细(工具名 / 技能名 / 注入段标签)没有尾部
   * 可言 ⇒ 该字段省略,界面回退到 label。短条目(不超头部上限)同样省略。
   */
  tailPreview?: string
}

export interface AttributionSegment {
  key: AttributionKey
  tokens: number
  /** 占**已归因总量**的比例 0..1(不是占窗口;窗口占比由 UI 另算) */
  share: number
  observed: boolean
  unobservedCode?: UnobservedCode
  /** 明细(按 tokens 降序,最多 MAX_DETAILS 条,其余折进 truncated) */
  details: AttributionDetail[]
  /** 参与该段的条目数(消息条数 / 工具数 / 技能数) */
  count: number
  /** 因超出明细上限被折叠的条数 */
  truncated: number
}

export interface CacheAttribution {
  observed: boolean
  /** 命中缓存读回的 token(仍占窗口) */
  cacheReadTokens: number
  /** 本轮新写入缓存的 token */
  cacheWriteTokens: number
  /** 窗口占用(= provider 报的 prompt token 总量,无真值时退到归因和) */
  occupiedTokens: number
  /** 需要重新 prefill 的量 = occupied − cacheRead */
  recomputeTokens: number
  /** 命中率 0..1;occupied=0 时给 0 */
  hitRatio: number
}

export interface ContextAttribution {
  /** 按 tokens 降序排列 */
  segments: AttributionSegment[]
  /** 各段之和(归因口径的总量,可能小于 provider 真值) */
  attributedTokens: number
  /** 校准后的总量:有 provider 真值用真值,否则等于 attributedTokens */
  totalTokens: number
  /** 真值与归因和的差额(未归类开销:角色标记、序列化、协议包装) */
  residualTokens: number
  cache: CacheAttribution
  /** 占比最高的段(无有效占用时为 null) */
  topKey: AttributionKey | null
}

/** 归因引擎的输入消息形状(刻意收窄,避免耦合各端 store 类型) */
export interface AttributionMessage {
  role: string
  content: string
  error?: boolean
  /** 助手消息发起的工具调用 */
  toolCalls?: Array<{
    toolName?: string
    name?: string
    args?: Record<string, unknown>
    result?: string
    output?: string
    error?: string
  }>
}

export interface AttributionInput {
  /** 系统段全文;undefined / null / 空串 = 本端不可观测 */
  systemText?: string | null
  /** 逐条注入段(自定义指令 / 工作区记忆 / Repo Wiki / 检索上下文) */
  injectionSegments?: Array<{ kind: string; label?: string; text?: string }>
  /** 工具 schema;undefined / null = 本端不可观测 */
  toolSchemas?: Array<{ name: string; description?: string; schemaText?: string }> | null
  /** 技能正文;undefined / null = 本端不可观测 */
  skills?: Array<{ name: string; text?: string }> | null
  messages: AttributionMessage[]
  /** provider 回传的 prompt token 真值(仅用于校准总量,不参与分解) */
  providerPromptTokens?: number | null
  /** provider 回传的缓存读数 */
  cacheReadTokens?: number | null
  cacheWriteTokens?: number | null
}

/** 明细上限:弹层宽度有限,超过即折叠并如实报 truncated */
const MAX_DETAILS = 6
/** 单条明细 label 的最大字符数(工具结果首行往往很长) */
const MAX_LABEL_CHARS = 48
/** 每条消息/工具/技能的固定协议包装开销(role 标记 + JSON 边界) */
const PER_ITEM_OVERHEAD = 4
/** 段标识:历史里以 system 落盘的那部分(压缩摘要等)与真正的系统提示同段 */
const SUMMARY_ROLE = 'system'

function clipLabel(raw: string): string {
  const oneLine = raw.replace(/\s+/g, ' ').trim()
  if (oneLine.length > MAX_LABEL_CHARS) return `${oneLine.slice(0, MAX_LABEL_CHARS)}…`
  return oneLine
}

/**
 * 尾部摘录(见 AttributionDetail.tailPreview)。与 clipLabel 共用同一个字符上限,
 * 只是保留的是结尾;未超上限时返回 undefined —— 短条目没有"另一种看法"可言。
 */
function clipTail(raw: string | undefined | null): string | undefined {
  if (!raw) return undefined
  const oneLine = raw.replace(/\s+/g, ' ').trim()
  if (oneLine.length <= MAX_LABEL_CHARS) return undefined
  return `…${oneLine.slice(-MAX_LABEL_CHARS)}`
}

function safeStringify(value: unknown): string {
  try {
    return JSON.stringify(value) ?? ''
  } catch {
    return ''
  }
}

/** 折叠明细:按 tokens 降序取前 MAX_DETAILS,同值按 label 字典序(稳定,防渲染层抖动) */
function foldDetails(details: AttributionDetail[]): {
  details: AttributionDetail[]
  truncated: number
} {
  const sorted = [...details].sort(
    (a, b) => b.tokens - a.tokens || a.label.localeCompare(b.label),
  )
  return {
    details: sorted.slice(0, MAX_DETAILS),
    truncated: Math.max(0, sorted.length - MAX_DETAILS),
  }
}

/** 把一段文本折算成 token(带条目开销);空文本记 0 而不是只算开销 */
function tokensOf(text: string | undefined | null, overhead = 0): number {
  if (!text) return 0
  return estimateTokens(text) + overhead
}

function callNameOf(tc: NonNullable<AttributionMessage['toolCalls']>[number]): string {
  return clipLabel(tc.toolName ?? tc.name ?? '') || LABEL_SENTINELS.unnamed
}

interface SegmentAccumulator {
  tokens: number
  details: AttributionDetail[]
  count: number
}

function emptyAccumulators(): Record<AttributionKey, SegmentAccumulator> {
  const out = {} as Record<AttributionKey, SegmentAccumulator>
  for (const key of ATTRIBUTION_KEYS) out[key] = { tokens: 0, details: [], count: 0 }
  return out
}

/**
 * 计算上下文占用归因。纯函数:不读 store、不发网络、同输入必同输出。
 */
export function computeContextAttribution(input: AttributionInput): ContextAttribution {
  const acc = emptyAccumulators()
  const messages = input.messages ?? []
  const injections = input.injectionSegments ?? []
  const schemas = input.toolSchemas ?? null
  const skills = input.skills ?? null
  const systemText = input.systemText ?? ''

  // —— 系统段:整段系统提示 + 逐条注入明细 ——
  const systemPromptTokens = tokensOf(systemText, PER_ITEM_OVERHEAD)
  if (systemPromptTokens > 0) {
    acc.system.tokens += systemPromptTokens
    acc.system.details.push({ label: LABEL_SENTINELS.systemPrompt, tokens: systemPromptTokens })
    acc.system.count += 1
  }
  for (const seg of injections) {
    const t = tokensOf(seg.text, PER_ITEM_OVERHEAD)
    acc.system.tokens += t
    acc.system.details.push({ label: clipLabel(seg.label ?? seg.kind), tokens: t })
    acc.system.count += 1
  }

  // —— 工具 schema:name + description + 参数 JSON(随每轮携带的固定成本,与调用次数无关) ——
  if (schemas) {
    for (const tool of schemas) {
      const t = tokensOf(`${tool.name ?? ''} ${tool.description ?? ''} ${tool.schemaText ?? ''}`, PER_ITEM_OVERHEAD)
      acc.toolSchema.tokens += t
      acc.toolSchema.details.push({ label: clipLabel(tool.name), tokens: t })
      acc.toolSchema.count += 1
    }
  }

  // —— 技能正文 ——
  if (skills) {
    for (const skill of skills) {
      const t = tokensOf(`${skill.name ?? ''}\n${skill.text ?? ''}`, PER_ITEM_OVERHEAD)
      acc.skill.tokens += t
      acc.skill.details.push({ label: clipLabel(skill.name), tokens: t })
      acc.skill.count += 1
    }
  }

  // —— 按消息角色分解:正文 / 调用参数 / 工具结果分属不同段 ——
  for (const m of messages) {
    if (m.error) continue
    const role = (m.role ?? '').toLowerCase()
    if (role === 'user' || role === 'assistant' || role === SUMMARY_ROLE) {
      const bucket = role === 'user' ? acc.roleUser : role === 'assistant' ? acc.roleAssistant : acc.system
      const t = tokensOf(m.content, PER_ITEM_OVERHEAD)
      if (t > 0) {
        bucket.tokens += t
        bucket.details.push({
          label: clipLabel(m.content),
          tokens: t,
          tailPreview: clipTail(m.content),
        })
        bucket.count += 1
      }
    } else if (role === 'tool' || role === 'function') {
      const t = tokensOf(m.content, PER_ITEM_OVERHEAD)
      acc.roleToolResult.tokens += t
      acc.roleToolResult.details.push({
        label: clipLabel(m.content),
        tokens: t,
        kind: 'result',
        tailPreview: clipTail(m.content),
      })
      acc.roleToolResult.count += 1
    }
    for (const tc of m.toolCalls ?? []) {
      const name = callNameOf(tc)
      const argsText = safeStringify(tc.args)
      const callTokens = tokensOf(argsText, PER_ITEM_OVERHEAD)
      acc.roleToolCall.tokens += callTokens
      acc.roleToolCall.details.push({
        label: name,
        tokens: callTokens,
        kind: 'call',
        tailPreview: clipTail(argsText),
      })
      acc.roleToolCall.count += 1
      const resultText = tc.result ?? tc.output ?? tc.error ?? ''
      const rTokens = tokensOf(resultText, PER_ITEM_OVERHEAD)
      if (rTokens > 0) {
        acc.roleToolResult.tokens += rTokens
        acc.roleToolResult.details.push({
          label: name,
          tokens: rTokens,
          kind: 'result',
          tailPreview: clipTail(resultText),
        })
        acc.roleToolResult.count += 1
      }
    }
  }

  const attributedTokens = ATTRIBUTION_KEYS.reduce((sum, key) => sum + acc[key].tokens, 0)

  const provider =
    typeof input.providerPromptTokens === 'number' && input.providerPromptTokens > 0
      ? input.providerPromptTokens
      : null
  const occupied = provider ?? attributedTokens
  const cacheRead = Math.max(0, Math.min(input.cacheReadTokens ?? 0, occupied))
  const cacheWrite = Math.max(0, input.cacheWriteTokens ?? 0)
  const cacheObserved =
    typeof input.cacheReadTokens === 'number' || typeof input.cacheWriteTokens === 'number'

  const segments: AttributionSegment[] = ATTRIBUTION_KEYS.map((key) => {
    const bucket = acc[key]
    const folded = foldDetails(bucket.details)
    let observed = true
    let unobservedCode: UnobservedCode | undefined
    if (key === 'toolSchema' && schemas === null) {
      observed = false
      unobservedCode = 'server-only'
    } else if (key === 'skill' && skills === null) {
      observed = false
      unobservedCode = 'server-only'
    } else if (key === 'system' && systemPromptTokens === 0 && injections.length === 0) {
      observed = false
      unobservedCode = 'not-supplied'
    }
    return {
      key,
      tokens: bucket.tokens,
      share: attributedTokens > 0 ? bucket.tokens / attributedTokens : 0,
      observed,
      unobservedCode,
      details: folded.details,
      count: bucket.count,
      truncated: folded.truncated,
    }
  }).sort((a, b) => b.tokens - a.tokens || a.key.localeCompare(b.key))

  return {
    segments,
    attributedTokens,
    totalTokens: occupied,
    residualTokens: provider !== null ? Math.max(0, provider - attributedTokens) : 0,
    topKey: segments.length > 0 && segments[0]!.tokens > 0 ? segments[0]!.key : null,
    cache: {
      observed: cacheObserved,
      cacheReadTokens: cacheRead,
      cacheWriteTokens: cacheWrite,
      occupiedTokens: occupied,
      recomputeTokens: Math.max(0, occupied - cacheRead),
      hitRatio: occupied > 0 ? cacheRead / occupied : 0,
    },
  }
}

/** 按 key 取段(不存在时 undefined),供 UI 与测试复用 */
export function findSegment(
  attribution: ContextAttribution,
  key: AttributionKey,
): AttributionSegment | undefined {
  return attribution.segments.find((s) => s.key === key)
}

/** 百分比格式化(0.4123 → "41.2%"),各端共用避免同一数字两种小数位 */
export function formatShare(ratio: number): string {
  return `${(Math.max(0, Math.min(ratio, 1)) * 100).toFixed(1)}%`
}
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
