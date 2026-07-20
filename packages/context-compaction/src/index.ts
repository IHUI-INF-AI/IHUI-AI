/**
 * 上下文压缩共享包 — 跨端统一 88% 阈值自动压缩。
 *
 * 跨端共享:CLI(agent runtime)+ API(/chat/stream 入口)+ ai-service(TS 边界)共用同一套规则。
 * ai-service Python 侧有等价实现(app/core/compaction.py),保持语义一致。
 *
 * 阈值:
 *   - DEFAULT_TRIGGER_RATIO = 0.88(88% 触发压缩,用户需求)
 *   - DEFAULT_TARGET_RATIO = 0.6(压缩到 60% 留出空间继续对话)
 *   - CONTEXT_BUDGET_THRESHOLD = 0.7(70% 提醒阈值,与压缩互补)
 *
 * 灵感来源:参考行业 Agent 框架的上下文管理机制,统一所有端的行为。
 */

import { encode } from 'gpt-tokenizer'

/** 跨端共享的聊天消息结构(与 @ihui/types/message-repair 的 RepairableMessage 兼容) */
export interface ChatMessage {
  role: 'system' | 'user' | 'assistant'
  content: string
}

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

// ==================== Token 估算 ====================

export function estimateTokens(text: string): number {
  if (!text) return 0
  return encode(text).length
}

export function estimateMessagesTokens(messages: ChatMessage[]): number {
  return messages.reduce((sum, m) => sum + estimateTokens(m.content) + 4, 0)
}

// ==================== 压缩结果类型 ====================

export interface CompressionResult {
  messages: ChatMessage[]
  compressed: boolean
  originalTokens: number
  compressedTokens: number
  removedCount: number
  trigger?: 'ratio' | 'absolute' | 'none'
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
}

/** 可选的钩子回调(CLI agent runtime 注入,API/Web 端不传) */
export interface CompactionHooks {
  preCompact?: (ctx: { compactedTokensBefore: number }) => void
  postCompact?: (ctx: { compactedTokensBefore: number; compactedTokensAfter: number }) => void
}

// ==================== 结构化摘要 ====================

const TOOL_CALL_REGEX = /```tool_call\s*\n([\s\S]*?)```/g
const TOOL_RESULT_REGEX = /\[工具结果\s*[✓✗]\]\s*(\S+)/g
const CODE_BLOCK_REGEX = /```(\w+)?/g
const MAX_SUMMARY_LEN = 160

/**
 * 从单条消息内容提取结构化关键信息(智能摘要)。
 *
 * 替代 `msg.content.slice(0, 200)` 的粗暴截断,提取:
 *   - assistant:tool_call 名称列表 + 首句决策 + 代码块语言标识
 *   - user:tool_result 状态(✓/✗)+ 工具名 + 首句
 *   - 其他:首句
 */
export function summarizeMessage(msg: ChatMessage): string {
  const role = msg.role
  const content = msg.content
  if (!content) return `[${role}] (空)`

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
  if (summary.length > MAX_SUMMARY_LEN) {
    summary = summary.slice(0, MAX_SUMMARY_LEN - 3) + '...'
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
  const toCompress = nonSystem.slice(0, nonSystem.length - keepCount)
  const toKeep = nonSystem.slice(nonSystem.length - keepCount)

  const summaryParts: string[] = []
  for (const msg of toCompress) {
    summaryParts.push(summarizeMessage(msg))
  }

  const summaryMsg: ChatMessage = {
    role: 'user',
    content: `[上下文摘要 — 之前 ${toCompress.length} 条消息已压缩]\n${summaryParts.join('\n')}`,
  }

  const result = [...systemMsgs, summaryMsg, ...toKeep]
  const compressedTokens = estimateMessagesTokens(result)

  return {
    messages: result,
    compressed: true,
    originalTokens,
    compressedTokens,
    removedCount: toCompress.length,
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
  const minMessages = opts.minMessages ?? keepRecent + 1
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

  // 逐步减少 keepRecent,直到 compressedTokens < targetThreshold 或 keepRecent=1
  let bestResult: CompressionResult | null = null
  for (let kr = Math.min(keepRecent, nonSystem.length - 1); kr >= 1; kr--) {
    if (nonSystem.length <= kr) continue
    const toCompress = nonSystem.slice(0, nonSystem.length - kr)
    const toKeep = nonSystem.slice(nonSystem.length - kr)

    const summaryParts: string[] = []
    for (const msg of toCompress) {
      summaryParts.push(summarizeMessage(msg))
    }
    const summaryMsg: ChatMessage = {
      role: 'user',
      content: `[上下文摘要 — 之前 ${toCompress.length} 条消息已压缩]\n${summaryParts.join('\n')}`,
    }
    const candidate = [...systemMsgs, summaryMsg, ...toKeep]
    const candidateTokens = estimateMessagesTokens(candidate)

    if (candidateTokens <= targetThreshold) {
      bestResult = {
        messages: candidate,
        compressed: true,
        originalTokens,
        compressedTokens: candidateTokens,
        removedCount: toCompress.length,
        trigger: 'ratio',
        usageRatio,
      }
      break
    }
    // 记录最后一个候选(即使超过 target,也比不压缩好)
    if (!bestResult) {
      bestResult = {
        messages: candidate,
        compressed: true,
        originalTokens,
        compressedTokens: candidateTokens,
        removedCount: toCompress.length,
        trigger: 'ratio',
        usageRatio,
      }
    }
  }

  const result: CompressionResult = bestResult ?? {
    messages,
    compressed: false,
    originalTokens,
    compressedTokens: originalTokens,
    removedCount: 0,
    trigger: 'none',
    usageRatio,
  }
  hooks?.postCompact?.({
    compactedTokensBefore: originalTokens,
    compactedTokensAfter: result.compressedTokens,
  })
  return result
}
