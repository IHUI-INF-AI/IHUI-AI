// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * 会话可达性判定(2026-11-01 立,单一真相源)。
 *
 * 存在理由:会话的"能不能碰"在本仓此前只有**两处**各自表述 —— `chat.ts` 的列表/详情按
 * `user_id` 直接过滤,协作面 `chat-collab-*` 按邀请表判。而 `/api/context/memory`
 * 这一族(会话摘要的读与清)既没有属主条件,也没有协作条件:任何登录用户带别人的
 * conversationId 就能读走他人会话摘要、或把他人 Redis summary 直接清掉。
 * 补判据不能又写第三份表述,所以收在这一处:归属 = 本人会话 ∪ 已接受的协作成员。
 *
 * 三条口径:
 *  - 会话不存在 ⇒ null(调用方一律 404,不回 403 —— 存在性本身是信息);
 *  - `status='accepted'` 才算协作可达(pending/revoked 都不算,与 chat-collab 的撤销语义同形);
 *  - 本人会话**优先**短路返回,不再多问一次协作表(省一次查询,也避免"自己被自己的会话判不可达")。
 *
 * 刻意不做的事:不缓存、不批量、不接 internal-service 通道。内网若要跨用户清记忆,
 * 应走带凭据的内网端点自己声明属主,而不是把这一格的身份判定放宽。
 */
import { and, eq } from 'drizzle-orm'
import { chatConversationCollaborators, chatConversations } from '@ihui/database'
import { dbRead } from './index.js'

export type ConversationAccessKind = 'owner' | 'collaborator'

export async function getConversationAccess(
  conversationId: string,
  userId: string,
): Promise<ConversationAccessKind | null> {
  if (!conversationId || !userId) return null

  const owned = await dbRead
    .select({ id: chatConversations.id })
    .from(chatConversations)
    .where(and(eq(chatConversations.id, conversationId), eq(chatConversations.userId, userId)))
    .limit(1)
  if (owned.length > 0) return 'owner'

  const collab = await dbRead
    .select({ id: chatConversationCollaborators.id })
    .from(chatConversationCollaborators)
    .where(
      and(
        eq(chatConversationCollaborators.conversationId, conversationId),
        eq(chatConversationCollaborators.userId, userId),
        eq(chatConversationCollaborators.status, 'accepted'),
      ),
    )
    .limit(1)
  if (collab.length > 0) return 'collaborator'

  return null
}
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
