// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:

/**
 * 压缩归档服务(2026-09-01 立,"归档记忆"能力)。
 *
 * 背景:自动上下文压缩(compressContextIfNeeded)是"黑箱有损"——压缩后 ai-chat-stream
 * 调 replaceMessages 删除旧消息,被压掉的原始消息彻底消失。本服务把被压缩的原始消息
 * 数组整体落库到 conversation_message_archives,压缩变成"透明可逆":用户可回看。
 *
 * 可靠性边界:归档是旁路能力,任何失败只 console.warn + 返回 null,
 * 绝不影响压缩主流程(persistMessageArchive 由调用方 `void persistMessageArchive(...)` 触发)。
 */

import type { ChatMessage } from '@ihui/context-compaction'
import { and, desc, eq } from 'drizzle-orm'
import { db } from '../db/index.js'
import { conversationMessageArchives } from '@ihui/database'

/** 归档列表项(列表接口不返回 messages 大字段) */
export interface MessageArchiveListItem {
  id: string
  conversationId: string
  messageCount: number
  coveredChars: number | null
  createdAt: Date
}

/**
 * 把被压缩掉的原始消息数组落库归档,返回归档 id。
 *
 * @param conversationId 会话 id
 * @param messages 被压缩的原始消息数组(compressContextIfNeeded 压缩前的消息)
 * @returns 归档行 id;失败返回 null(归档失败绝不影响压缩主流程)
 */
export async function persistMessageArchive(
  conversationId: string,
  messages: ChatMessage[],
): Promise<string | null> {
  try {
    const coveredChars = messages.reduce((sum, m) => sum + (m.content?.length ?? 0), 0)
    const rows = await db
      .insert(conversationMessageArchives)
      .values({
        conversationId,
        messages,
        messageCount: messages.length,
        coveredChars,
      })
      .returning({ id: conversationMessageArchives.id })
    return rows[0]?.id ?? null
  } catch (e) {
    console.warn('[ConversationArchive] 归档持久化失败(不影响压缩主流程):', (e as Error).message)
    return null
  }
}

/**
 * 列出会话的压缩归档(按时间倒序)。不含 messages 大字段,列表展示用。
 */
export async function listMessageArchives(
  conversationId: string,
): Promise<MessageArchiveListItem[]> {
  return db
    .select({
      id: conversationMessageArchives.id,
      conversationId: conversationMessageArchives.conversationId,
      messageCount: conversationMessageArchives.messageCount,
      coveredChars: conversationMessageArchives.coveredChars,
      createdAt: conversationMessageArchives.createdAt,
    })
    .from(conversationMessageArchives)
    .where(eq(conversationMessageArchives.conversationId, conversationId))
    .orderBy(desc(conversationMessageArchives.createdAt))
}

/**
 * 取单条归档完整内容(含 messages)。限定 conversationId 防跨会话越权读取。
 */
export async function findMessageArchive(conversationId: string, archiveId: string) {
  const rows = await db
    .select()
    .from(conversationMessageArchives)
    .where(
      and(
        eq(conversationMessageArchives.id, archiveId),
        eq(conversationMessageArchives.conversationId, conversationId),
      ),
    )
    .limit(1)
  return rows[0] ?? null
}
