// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * D125 多用户协作会话 —— REST 消费面(设计稿 docs/d125-session-collab-design.md)。
 * 服务端契约见 apps/api/src/routes/chat-collab.ts;帧事件形态在 @ihui/types/user-broadcast。
 */
import type { ApiResult } from '@ihui/types'
import { fetchApi } from '../client.js'

export interface CollaboratorRow {
  id: string
  conversationId: string
  userId: string
  invitedBy: string
  /** workspace-permissions 四档 wire 拼写;本切片恒 'plan' */
  tier: string
  status: 'pending' | 'accepted' | 'revoked'
  createdAt: string
  updatedAt: string
}

export interface PendingInvitationRow {
  conversationId: string
  invitationId: string
  invitedBy: string
  tier: string
  createdAt: string
}

export interface MessageCommentRow {
  id: string
  conversationId: string
  messageId: string
  userId: string
  body: string
  createdAt: string
  authorName: string | null
}

export function inviteConversationCollaborator(
  conversationId: string,
  input: { userId: string; tier?: 'default' | 'plan' | 'accept-edits' | 'bypass-permissions' },
): Promise<ApiResult<{ invitation: CollaboratorRow }>> {
  return fetchApi<{ invitation: CollaboratorRow }>(
    `/api/chat/conversations/${conversationId}/collaborators`,
    { method: 'POST', body: JSON.stringify(input) },
  )
}

export function listConversationCollaborators(
  conversationId: string,
): Promise<ApiResult<{ collaborators: CollaboratorRow[] }>> {
  return fetchApi<{ collaborators: CollaboratorRow[] }>(
    `/api/chat/conversations/${conversationId}/collaborators`,
  )
}

export function listMyCollaboratorInvitations(): Promise<
  ApiResult<{ invitations: PendingInvitationRow[] }>
> {
  return fetchApi<{ invitations: PendingInvitationRow[] }>('/api/chat/collaborator-invitations')
}

export function acceptCollaboratorInvitation(
  conversationId: string,
): Promise<ApiResult<{ collaborator: CollaboratorRow }>> {
  return fetchApi<{ collaborator: CollaboratorRow }>(
    `/api/chat/conversations/${conversationId}/collaborator-invitations/accept`,
    { method: 'POST' },
  )
}

export function revokeConversationCollaborator(
  conversationId: string,
  userId: string,
): Promise<ApiResult<{ revoked: boolean }>> {
  return fetchApi<{ revoked: boolean }>(
    `/api/chat/conversations/${conversationId}/collaborators/${userId}`,
    { method: 'DELETE' },
  )
}

export function listMessageComments(
  conversationId: string,
  messageId: string,
): Promise<ApiResult<{ comments: MessageCommentRow[] }>> {
  return fetchApi<{ comments: MessageCommentRow[] }>(
    `/api/chat/conversations/${conversationId}/messages/${messageId}/comments`,
  )
}

export function addMessageComment(
  conversationId: string,
  messageId: string,
  body: string,
): Promise<ApiResult<{ comment: MessageCommentRow }>> {
  return fetchApi<{ comment: MessageCommentRow }>(
    `/api/chat/conversations/${conversationId}/messages/${messageId}/comments`,
    { method: 'POST', body: JSON.stringify({ body }) },
  )
}

export function deleteMessageComment(
  conversationId: string,
  messageId: string,
  commentId: string,
): Promise<ApiResult<{ deleted: boolean }>> {
  return fetchApi<{ deleted: boolean }>(
    `/api/chat/conversations/${conversationId}/messages/${messageId}/comments/${commentId}`,
    { method: 'DELETE' },
  )
}

// =============================================================================
// D125 另批收口(2026-10-23):写锁/接管发言 + 邀请管理(改权限)
// =============================================================================

/** 写锁实况(落 chat_conversations.metadata.collabLock,服务端盖章) */
export interface CollabLockRow {
  holderUserId: string
  acquiredAt: string
}

export function getConversationCollabLock(
  conversationId: string,
): Promise<ApiResult<{ lock: CollabLockRow | null }>> {
  return fetchApi<{ lock: CollabLockRow | null }>(
    `/api/chat/conversations/${conversationId}/collab-lock`,
  )
}

/** 抢麦/接管发言:takeover=true 才允许从他人手里夺麦;被占且未带 ⇒ 409 */
export function acquireConversationCollabLock(
  conversationId: string,
  input: { takeover?: boolean } = {},
): Promise<ApiResult<{ lock: CollabLockRow; takenFrom: string | null }>> {
  return fetchApi<{ lock: CollabLockRow; takenFrom: string | null }>(
    `/api/chat/conversations/${conversationId}/collab-lock/acquire`,
    { method: 'POST', body: JSON.stringify(input) },
  )
}

export function releaseConversationCollabLock(
  conversationId: string,
): Promise<ApiResult<{ released: boolean }>> {
  return fetchApi<{ released: boolean }>(`/api/chat/conversations/${conversationId}/collab-lock`, {
    method: 'DELETE',
  })
}

/** 属主改协作者档位(plan ⇄ 写档);被撤销行 404 */
export function updateConversationCollaboratorTier(
  conversationId: string,
  userId: string,
  tier: 'default' | 'plan' | 'accept-edits' | 'bypass-permissions',
): Promise<ApiResult<{ collaborator: CollaboratorRow }>> {
  return fetchApi<{ collaborator: CollaboratorRow }>(
    `/api/chat/conversations/${conversationId}/collaborators/${userId}`,
    { method: 'PATCH', body: JSON.stringify({ tier }) },
  )
}
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
