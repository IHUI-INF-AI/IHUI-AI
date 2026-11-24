// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * 统一会话 → 小程序历史表的反向回写(2026-11-24,真多端互通)
 *
 * 立因:小程序的历史会话镜像进 `chat_conversations`(source='miniapp', source_ref=历史行 uuid)
 * 之后,web / RN 侧对这行的**改名 / 置顶 / 归档 / 删除**只落在统一表 —— 小程序自己那张
 * `zhs_ai_user_model_chat_history` 看不见,于是"网页端改了名、小程序还是旧名""网页端归档了、
 * 小程序还在列表里"成了沉默分叉。本模块把这四个动作反向映射回小程序表,让状态真的双向一致。
 *
 * 口径:
 * - 只处理 `source='miniapp'` 且 `source_ref` 非空的会话;其它来源一律 no-op(它们本来就是
 *   统一表的原生行,没有第二份副本要同步)。
 * - 回写失败**不让 web 的写请求变 500**:小程序表是镜像副本,失败只回 -1 由调用方打 warn,
 *   下一次小程序自己读/写时会按统一表重新对齐(mirrorConversations 同向)。
 * - 删除是唯一不可撤销动作:只在统一表**真的删掉**之后执行(deleted 判定在调用方完成),
 *   镜像副本不在统一表里就绝不单独删 —— 否则删的是唯一一份。
 */

import { and, eq, inArray } from 'drizzle-orm'
import { chatConversations, zhsAiUserModelChatHistory } from '@ihui/database'
import { db } from '../db/index.js'

/** 统一表里一行会话的最小形状:回写只需要"它是不是小程序镜像"与"镜像指向哪个历史行" */
export type MiniappSourceConversation = {
  id: string
  source: string | null
  sourceRef: string | null
}

/** 可回写的字段:与小程序历史表列一一对应(改名 / 置顶 / 归档时间) */
export type MiniappBackflowPatch = {
  title?: string
  pinned?: boolean
  archivedAt?: Date | null
}

const MINIAPP_SOURCE = 'miniapp'

/** 单条:是不是小程序镜像(不是 → 无需回写) */
export function isMiniappMirror(row: { source: string | null; sourceRef: string | null }): boolean {
  return row.source === MINIAPP_SOURCE && typeof row.sourceRef === 'string' && row.sourceRef.length > 0
}

function patchValues(patch: MiniappBackflowPatch): MiniappBackflowPatch {
  return {
    ...(patch.title === undefined ? {} : { title: patch.title }),
    ...(patch.pinned === undefined ? {} : { pinned: patch.pinned }),
    ...(patch.archivedAt === undefined ? {} : { archivedAt: patch.archivedAt }),
  }
}

function hasAnyKey(patch: MiniappBackflowPatch): boolean {
  return patch.title !== undefined || patch.pinned !== undefined || patch.archivedAt !== undefined
}

/**
 * 单条回写(改名 / 置顶 / 归档)。
 * @returns 被更新的历史行数;失败回 **-1**(调用方据此 warn,但不得让请求失败)
 */
export async function backflowMiniappPatch(
  userId: string,
  conversation: MiniappSourceConversation,
  patch: MiniappBackflowPatch,
): Promise<number> {
  if (!isMiniappMirror(conversation) || !hasAnyKey(patch)) return 0
  try {
    const rows = await db
      .update(zhsAiUserModelChatHistory)
      .set(patchValues(patch))
      .where(
        and(
          eq(zhsAiUserModelChatHistory.userId, userId),
          eq(zhsAiUserModelChatHistory.id, conversation.sourceRef as string),
        ),
      )
      .returning({ id: zhsAiUserModelChatHistory.id })
    return rows.length
  } catch {
    return -1
  }
}

/**
 * 批量回写:按统一表 ids 取出所有小程序镜像行,**一次**写小程序表。
 * 归档/取消归档、批量改名这类"一次动多条"的入口走这里,避免 N 次往返。
 * @returns 被更新的历史行数;失败回 **-1**
 */
export async function backflowMiniappPatchMany(
  userId: string,
  conversationIds: string[],
  patch: MiniappBackflowPatch,
): Promise<number> {
  if (conversationIds.length === 0 || !hasAnyKey(patch)) return 0
  try {
    const mirrors = await db
      .select({ sourceRef: chatConversations.sourceRef })
      .from(chatConversations)
      .where(and(eq(chatConversations.userId, userId), inArray(chatConversations.id, conversationIds)))
    const refs = mirrors
      .map((row) => row.sourceRef)
      .filter((ref): ref is string => typeof ref === 'string' && ref.length > 0)
    if (refs.length === 0) return 0
    const rows = await db
      .update(zhsAiUserModelChatHistory)
      .set(patchValues(patch))
      .where(
        and(
          eq(zhsAiUserModelChatHistory.userId, userId),
          inArray(zhsAiUserModelChatHistory.id, refs),
        ),
      )
      .returning({ id: zhsAiUserModelChatHistory.id })
    return rows.length
  } catch {
    return -1
  }
}

/**
 * 单条删除联动(统一表那行**真的删掉之后**才调)。
 * @returns 被删掉的历史行数;失败回 **-1**
 */
export async function backflowMiniappRemove(
  userId: string,
  conversation: MiniappSourceConversation,
): Promise<number> {
  if (!isMiniappMirror(conversation)) return 0
  try {
    const rows = await db
      .delete(zhsAiUserModelChatHistory)
      .where(
        and(
          eq(zhsAiUserModelChatHistory.userId, userId),
          eq(zhsAiUserModelChatHistory.id, conversation.sourceRef as string),
        ),
      )
      .returning({ id: zhsAiUserModelChatHistory.id })
    return rows.length
  } catch {
    return -1
  }
}

/**
 * 批量**删前收集**:把统一表里这批会话的 source_ref 先捞出来。
 * 为什么必须删前:统一表那行删掉之后 `source_ref` 就查不到了,后置查询恒得空集。
 * 失败/查不到一律回空数组(调用方据此跳过,不让请求失败)。
 */
export async function collectMiniappRefs(
  userId: string,
  conversationIds: string[],
): Promise<string[]> {
  if (conversationIds.length === 0) return []
  try {
    const mirrors = await db
      .select({ sourceRef: chatConversations.sourceRef })
      .from(chatConversations)
      .where(and(eq(chatConversations.userId, userId), inArray(chatConversations.id, conversationIds)))
    return mirrors
      .map((row) => row.sourceRef)
      .filter((ref): ref is string => typeof ref === 'string' && ref.length > 0)
  } catch {
    return []
  }
}

/**
 * 批量**删后执行**:按删前收集的 refs 删小程序历史行。
 * @returns 被删掉的历史行数;失败回 **-1**
 */
export async function removeMiniappHistoryRows(userId: string, refs: string[]): Promise<number> {
  if (refs.length === 0) return 0
  try {
    const rows = await db
      .delete(zhsAiUserModelChatHistory)
      .where(
        and(
          eq(zhsAiUserModelChatHistory.userId, userId),
          inArray(zhsAiUserModelChatHistory.id, refs),
        ),
      )
      .returning({ id: zhsAiUserModelChatHistory.id })
    return rows.length
  } catch {
    return -1
  }
}
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
