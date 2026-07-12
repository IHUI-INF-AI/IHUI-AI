/**
 * 对话上下文管理服务。
 *
 * 迁移自旧架构 app/utils/context_manager.py。
 * 统一管理对话上下文：保存、查询、token 估算、上下文截断。
 *
 * 核心能力：
 * - 保存对话记录到 zhs_user_agent_context 表
 * - 查询用户历史对话并格式化为模型可接受的 messages 数组
 * - token 估算（基于字符数的启发式估算，近似 1 token ≈ 2 chars 中文 / 4 chars 英文）
 * - 上下文截断：超限时保留最近 N 条消息
 */

import { and, desc, eq, gte, sql } from 'drizzle-orm'
import { db, dbRead } from '../db/index.js'
import { zhsUserAgentContext } from '@ihui/database'
import { logger } from '../utils/logger.js'

// =============================================================================
// 类型定义
// =============================================================================

/** 对话角色。 */
export type ChatRole = 'user' | 'assistant' | 'system' | 'tool'

/** 对话消息（模型可接受格式）。 */
export interface ChatMessage {
  role: ChatRole
  content: string
  /** 关联的会话 ID（可选） */
  chatId?: string | null
  /** 关联的 agent 资源 URL（可选） */
  agentUrl?: string | null
  /** 该消息的 token 数（可选，由估算填充） */
  totalTokens?: string | null
  /** 视频比例（可选） */
  videoRatio?: string | null
}

/** 保存对话入参。 */
export interface SaveConversationInput {
  userUuid: string
  /** 模型名称（如 gpt-4o / qwen-plus） */
  modelName: string
  /** 用户问题 */
  problem: string
  /** 模型回答 */
  answer: string
  /** 会话 ID */
  chatId?: string | null
  /** 智能体 ID */
  agentId?: string | null
  /** agent 资源 URL */
  agentUrl?: string | null
  /** 用户资源 URL */
  userUrl?: string | null
  /** 扩展字段（存储 token 数等） */
  field1?: string | null
  /** 视频比例 */
  videoRatio?: string | null
  /** 发送时间（Unix 秒），默认当前时间 */
  sendTime?: number | null
  /** 计费信息（仅用于日志，不持久化） */
  costInfo?: {
    inputLength?: number
    outputLength?: number
    price?: number
  } | null
  /** 摘要 */
  summary?: string | null
}

/** 查询历史对话入参。 */
export interface GetHistoryInput {
  userUuid: string
  modelName?: string | null
  chatId?: string | null
  /** 返回的最大消息条数，默认 5 */
  limit?: number
}

/** 上下文格式化选项。 */
export interface FormatContextOptions {
  /** 最大 token 数，超限时截断保留最近 N 条 */
  maxTokens?: number
  /** 模型名称（用于选择格式化策略） */
  modelName?: string
}

// =============================================================================
// Token 估算
// =============================================================================

/**
 * 估算文本的 token 数。
 *
 * 启发式规则（近似）：
 * - 中文字符：约 1 token / 字
 * - 英文：约 1 token / 4 字符
 * - 混合文本：按字符类型加权平均
 *
 * 此估算用于上下文截断的粗略判断，不替代精确的 tokenizer。
 *
 * @param text 待估算的文本
 * @returns 估算的 token 数
 */
export function estimateTokens(text: string): number {
  if (!text) return 0

  let cjkCount = 0
  let asciiCount = 0
  let otherCount = 0

  for (const ch of text) {
    const code = ch.codePointAt(0)
    if (code === undefined) continue
    // CJK 统一表意文字 + 常见中文标点范围
    if (
      (code >= 0x4e00 && code <= 0x9fff) || // CJK 统一表意文字
      (code >= 0x3400 && code <= 0x4dbf) || // CJK 扩展 A
      (code >= 0x3000 && code <= 0x303f) || // CJK 标点
      (code >= 0xff00 && code <= 0xffef) // 全角字符
    ) {
      cjkCount++
    } else if (code < 0x80) {
      asciiCount++
    } else {
      otherCount++
    }
  }

  // 中文约 1 token/字，英文约 1 token/4 字符，其他约 1 token/2 字符
  return Math.ceil(cjkCount + asciiCount / 4 + otherCount / 2)
}

/**
 * 估算单条消息的 token 数。
 */
export function estimateMessageTokens(message: ChatMessage): number {
  const contentTokens = estimateTokens(message.content)
  // role 标签的开销（约 4 token）
  return contentTokens + 4
}

/**
 * 估算消息列表的总 token 数。
 */
export function estimateMessagesTokens(messages: ChatMessage[]): number {
  return messages.reduce((sum, m) => sum + estimateMessageTokens(m), 0)
}

// =============================================================================
// 上下文截断
// =============================================================================

/**
 * 按 token 上限截断消息列表，保留最近 N 条。
 *
 * 迁移自 Python _truncate_by_tokens。
 * 从最新消息开始向前累加，直到累计 token 超过 maxTokens 为止，
 * 保留未超限的所有消息（保持原始顺序）。
 *
 * @param messages 原始消息列表（按时间升序）
 * @param maxTokens 最大 token 数
 * @returns 截断后的消息列表（保持时间升序）
 */
export function truncateByTokens(messages: ChatMessage[], maxTokens: number): ChatMessage[] {
  if (messages.length === 0) return []

  const result: ChatMessage[] = []
  let totalTokens = 0

  // 从最新消息开始向前遍历
  for (let i = messages.length - 1; i >= 0; i--) {
    const msg = messages[i]
    if (!msg) continue
    const msgTokens = estimateMessageTokens(msg)
    // 累加后超限则停止（至少保留 1 条最新消息）
    if (totalTokens + msgTokens > maxTokens && result.length > 0) {
      break
    }
    totalTokens += msgTokens
    result.unshift(msg)
  }

  return result
}

/**
 * 按消息条数截断，保留最近 N 条。
 *
 * @param messages 原始消息列表
 * @param keepLast 保留的最近消息条数
 */
export function truncateByCount(messages: ChatMessage[], keepLast: number): ChatMessage[] {
  if (messages.length <= keepLast) return [...messages]
  return messages.slice(-keepLast)
}

// =============================================================================
// 上下文格式化
// =============================================================================

/**
 * 将历史对话格式化为模型可接受的消息数组。
 *
 * 迁移自 Python ContextFormatter.format_context_for_model。
 * 根据模型名称选择格式化策略，并在 maxTokens 限制内截断。
 *
 * @param messages 原始消息列表
 * @param options 格式化选项
 * @returns 格式化后的消息列表
 */
export function formatContextForModel(
  messages: ChatMessage[],
  options?: FormatContextOptions,
): ChatMessage[] {
  const maxTokens = options?.maxTokens

  // 过滤空内容
  let formatted = messages.filter((m) => m.content && m.content.length > 0)

  // 按模型选择截断策略（所有模型统一使用 _default_format 逻辑）
  if (maxTokens && maxTokens > 0) {
    formatted = truncateByTokens(formatted, maxTokens)
  }

  return formatted
}

// =============================================================================
// 对话持久化
// =============================================================================

/**
 * 保存一条对话记录到 zhs_user_agent_context 表。
 *
 * 迁移自 Python ConversationContextManager.save_conversation。
 *
 * @param input 对话入参
 * @returns 是否保存成功
 */
export async function saveConversation(input: SaveConversationInput): Promise<boolean> {
  try {
    await db.insert(zhsUserAgentContext).values({
      userUuid: input.userUuid,
      agentId: input.agentId ?? '',
      role: 'user',
      content: input.problem,
      contextKey: input.modelName,
      contextValue: input.answer,
      fieldName: input.field1 ?? null,
      sessionId: input.chatId ?? null,
      tokens: input.costInfo?.outputLength ?? 0,
    })

    // costInfo 仅用于日志（迁移自 Python 的 logger.info）
    if (input.costInfo) {
      const ci = input.costInfo
      logger.info(
        `[context-manager] billing: input=${ci.inputLength} output=${ci.outputLength} cost=${ci.price}`,
      )
    }

    return true
  } catch (err) {
    logger.error('[context-manager] saveConversation failed', { error: err })
    return false
  }
}

/**
 * 获取用户历史对话并格式化为模型可接受的消息数组。
 *
 * 迁移自 Python ConversationContextManager.get_conversation_history。
 * 查询 zhs_user_agent_context 表，按时间倒序取最近 limit 条，
 * 然后反转为时间升序，构建 user/assistant 交替的消息列表。
 *
 * @param input 查询入参
 * @returns 格式化后的消息列表（按时间升序）
 */
export async function getConversationHistory(input: GetHistoryInput): Promise<ChatMessage[]> {
  try {
    const limit = input.limit ?? 5

    const conds = [eq(zhsUserAgentContext.userUuid, input.userUuid)]
    if (input.modelName) {
      conds.push(eq(zhsUserAgentContext.contextKey, input.modelName))
    }
    if (input.chatId) {
      conds.push(eq(zhsUserAgentContext.sessionId, input.chatId))
    }

    const rows = await dbRead
      .select({
        content: zhsUserAgentContext.content,
        answer: zhsUserAgentContext.contextValue,
        chatId: zhsUserAgentContext.sessionId,
        tokens: zhsUserAgentContext.tokens,
      })
      .from(zhsUserAgentContext)
      .where(and(...conds))
      .orderBy(desc(zhsUserAgentContext.createTime))
      .limit(limit)

    const messages: ChatMessage[] = []
    for (const row of rows) {
      if (row.content) {
        messages.push({
          role: 'user',
          content: row.content,
          chatId: row.chatId,
        })
      }
      if (row.answer) {
        messages.push({
          role: 'assistant',
          content: row.answer,
          chatId: row.chatId,
          totalTokens: row.tokens ? String(row.tokens) : null,
        })
      }
    }

    // 反转为时间升序（数据库按倒序取，需反转）
    return messages.reverse()
  } catch (err) {
    logger.error('[context-manager] getConversationHistory failed', { error: err })
    return []
  }
}

/**
 * 获取用户使用历史记录（分页）。
 *
 * 迁移自 Python ConversationContextManager.get_user_history。
 *
 * @param userUuid 用户 UUID
 * @param timeType 时间范围：w=近7天 / m=近30天 / y=近365天 / a=全部
 * @param page 页码
 * @param pageSize 每页条数
 */
export async function getUserHistory(
  userUuid: string,
  timeType: 'w' | 'm' | 'y' | 'a' = 'w',
  page = 1,
  pageSize = 10,
): Promise<{
  data: Array<Record<string, unknown>>
  total: number
  page: number
  pageSize: number
}> {
  try {
    const now = new Date()
    let startTime: Date | null = null

    if (timeType === 'w') {
      startTime = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000)
    } else if (timeType === 'm') {
      startTime = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000)
    } else if (timeType === 'y') {
      startTime = new Date(now.getTime() - 365 * 24 * 60 * 60 * 1000)
    }

    const conds = [eq(zhsUserAgentContext.userUuid, userUuid)]
    if (startTime) {
      conds.push(gte(zhsUserAgentContext.createTime, startTime))
    }

    const where = and(...conds)

    const [rows, totalRows] = await Promise.all([
      dbRead
        .select({
          id: zhsUserAgentContext.id,
          agentId: zhsUserAgentContext.agentId,
          problem: zhsUserAgentContext.content,
          answer: zhsUserAgentContext.contextValue,
          createTime: zhsUserAgentContext.createTime,
          modelName: zhsUserAgentContext.contextKey,
          chatId: zhsUserAgentContext.sessionId,
          tokens: zhsUserAgentContext.tokens,
        })
        .from(zhsUserAgentContext)
        .where(where)
        .orderBy(desc(zhsUserAgentContext.createTime))
        .limit(pageSize)
        .offset((page - 1) * pageSize),
      dbRead
        .select({ count: sql<number>`count(*)::int` })
        .from(zhsUserAgentContext)
        .where(where),
    ])

    const data = rows.map((r) => ({
      id: r.id,
      agent_id: r.agentId,
      problem: r.problem,
      answer: r.answer,
      create_at: r.createTime?.toISOString() ?? null,
      model_name: r.modelName,
      chat_id: r.chatId,
      token: r.tokens,
    }))

    return {
      data,
      total: totalRows[0]?.count ?? 0,
      page,
      pageSize,
    }
  } catch (err) {
    logger.error('[context-manager] getUserHistory failed', { error: err })
    return { data: [], total: 0, page, pageSize }
  }
}

/**
 * 构建完整的对话上下文（历史 + 当前问题）。
 *
 * 便捷方法：查询历史对话 → 格式化 → 追加当前问题。
 *
 * @param userUuid 用户 UUID
 * @param modelName 模型名称
 * @param currentProblem 当前问题
 * @param options 选项（chatId / maxTokens / historyLimit）
 */
export async function buildContext(
  userUuid: string,
  modelName: string,
  currentProblem: string,
  options?: {
    chatId?: string | null
    maxTokens?: number
    historyLimit?: number
  },
): Promise<{
  messages: ChatMessage[]
  estimatedTokens: number
}> {
  const history = await getConversationHistory({
    userUuid,
    modelName,
    chatId: options?.chatId ?? null,
    limit: options?.historyLimit ?? 5,
  })

  const formatted = formatContextForModel(history, {
    maxTokens: options?.maxTokens,
    modelName,
  })

  // 追加当前问题
  const messages: ChatMessage[] = [...formatted, { role: 'user', content: currentProblem }]

  return {
    messages,
    estimatedTokens: estimateMessagesTokens(messages),
  }
}
