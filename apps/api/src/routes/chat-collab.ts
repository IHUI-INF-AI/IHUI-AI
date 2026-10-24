// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * D125 多用户协作会话路由(2026-10-23 立,设计稿 docs/d125-session-collab-design.md)。
 *
 * 最小纵向切片(邀请 + 逐消息评论)+ 同日另批收口(§6 预留三处的落地):
 *  ① 写锁/接管发言 —— 四档全授(缺省仍 plan),抢麦/夺麦/交麦三个端点,
 *     锁落 `chat_conversations.metadata.collabLock`(查询与门控判据在
 *     `db/chat-collab-write-queries.ts`,发言强制点在 routes/chat.ts POST /messages);
 *  ② 邀请管理写面 —— PATCH 改档位(属主),撤销时顺带夺回被撤销人持有的麦;
 *  ③ `collab:lock` 帧按设计稿 §6 第 2 点的"同三步"追加(types 联合/判据/api-client 已同笔)。
 *
 * 三条纪律(照 D153 发射口与 workspace-permissions 同款形态):
 *  ① 鉴权 = `authenticate` + 归属过滤(认证不等于授权,AGENTS §5):属主判据取
 *     `conversation.userId`,协作者判据取 collaborators 表,请求体不承载身份;
 *  ② 广播只在写库成功后发,发帧失败**不改响应**、log.warn 出声(§5e 失败必须响);
 *  ③ 删除类结果取库确认集(RETURNING),不把请求长度当结果。
 *
 * 档位词表不抄第二份:四档清单与归一都走 `@ihui/types/permission-mode` 注册表。
 */
import type { FastifyPluginAsync, FastifyRequest, FastifyReply } from 'fastify'
import { z } from 'zod'
import {
  PERMISSION_MODE_WIRE_VALUES,
  collabInvitationEvent,
  collabCommentEvent,
  collabLockEvent,
  type UserBroadcastEvent,
} from '@ihui/types'
import { authenticate } from '../plugins/auth.js'
import { success, error } from '../utils/response.js'
import { findConversationById } from '../db/chat-queries.js'
import { findUserById } from '../db/queries.js'
import {
  upsertCollaboratorInvitation,
  listCollaborators,
  listPendingInvitationsForUser,
  getCollaborator,
  acceptCollaboratorInvitation,
  revokeCollaborator,
  listAcceptedCollaboratorUserIds,
  listMessageComments,
  createMessageComment,
  deleteMessageComment,
  messageInConversation,
} from '../db/chat-collab-queries.js'
import {
  readCollabLock,
  acquireCollabLock,
  releaseCollabLock,
  clearCollabLockIfHeldBy,
  updateCollaboratorTier,
} from '../db/chat-collab-write-queries.js'

/** 缺省档(邀请不带 tier 时落这一档:只读 + 评论);写档 = 可抢麦,见设计稿 §6 */
const DEFAULT_TIER = 'plan'

export const chatCollabRoutes: FastifyPluginAsync = async (server) => {
  const requireAuth = async (request: FastifyRequest, reply: FastifyReply) => {
    try {
      await authenticate(request)
    } catch (e) {
      const statusCode = (e as Error & { statusCode?: number }).statusCode ?? 401
      return reply.status(statusCode).send(error(statusCode, '操作失败,请稍后重试'))
    }
  }

  const idParam = z.object({ id: z.string().min(1) }).strict()

  /** 属主判定:存在 + 归属;失败时已写响应,返回 null */
  const ensureOwnedConversation = async (id: string, userId: string, reply: FastifyReply) => {
    const conversation = await findConversationById(id)
    if (!conversation) {
      reply.status(404).send(error(404, '对话不存在'))
      return null
    }
    if (conversation.userId !== userId) {
      reply.status(403).send(error(403, '无权访问该对话'))
      return null
    }
    return conversation
  }

  /** 读面判据:属主或 accepted 协作者(评论/协作列表的最低门槛) */
  const ensureReadAccess = async (conversationId: string, userId: string, reply: FastifyReply) => {
    const conversation = await findConversationById(conversationId)
    if (!conversation) {
      reply.status(404).send(error(404, '对话不存在'))
      return null
    }
    if (conversation.userId === userId) return conversation
    const collab = await getCollaborator(conversationId, userId)
    if (!collab || collab.status !== 'accepted') {
      reply.status(403).send(error(403, '无权访问该对话'))
      return null
    }
    return conversation
  }

  /**
   * 协作事件发射口(本文件唯一):写库成功后调用;发帧失败不改响应、出声。
   * 收信人由 broadcastToUser 的 userId 钉死,载荷不承载收信人身份。
   */
  const broadcastCollab = (
    request: FastifyRequest,
    userId: string,
    evt: UserBroadcastEvent,
    meta: Record<string, unknown>,
  ): void => {
    try {
      server.broadcastToUser(userId, evt.event, evt.data)
    } catch (err) {
      request.log.warn(
        { err, userId, ...meta },
        'D125 协作广播发射失败(写库已成功,另一端退回下次打开时同步)',
      )
    }
  }

  /**
   * 锁帧 fan-out:属主 + 全部 accepted 协作者,排除行为主体本人(回声免推,与评论同一条规则)。
   * 收信人集合在写库后重取(撤销路径调到这里时 revoked 行已不在 accepted 集里,天然排除被撤销人)。
   */
  const broadcastLockToRoom = async (
    request: FastifyRequest,
    conversation: { id: string; userId: string },
    actorUserId: string,
    evt: ReturnType<typeof collabLockEvent>,
  ): Promise<void> => {
    const collaboratorIds = await listAcceptedCollaboratorUserIds(conversation.id)
    const recipients = new Set([conversation.userId, ...collaboratorIds])
    recipients.delete(actorUserId)
    for (const uid of recipients) {
      broadcastCollab(request, uid, evt, {
        conversationId: conversation.id,
        state: evt.data.state,
      })
    }
  }

  // ===========================================================================
  // 邀请/协作
  // ===========================================================================

  // POST /conversations/:id/collaborators — 属主邀请(四档全授,缺省 plan;另批收口)
  const inviteSchema = z.object({
    userId: z.string().min(1),
    tier: z.enum(PERMISSION_MODE_WIRE_VALUES).optional(),
  })
  server.post('/conversations/:id/collaborators', async (request, reply) => {
    await requireAuth(request, reply)
    if (!request.userId) return
    const { id } = idParam.parse(request.params)
    const parsed = inviteSchema.safeParse(request.body)
    if (!parsed.success) {
      return reply.status(400).send(error(400, parsed.error.issues[0]?.message ?? '参数错误'))
    }
    const conversation = await ensureOwnedConversation(id, request.userId, reply)
    if (!conversation) return
    if (parsed.data.userId === request.userId) {
      return reply.status(400).send(error(400, '不能邀请自己为协作者'))
    }
    const invitee = await findUserById(parsed.data.userId)
    if (!invitee) return reply.status(404).send(error(404, '被邀请用户不存在'))
    // 四档清单 = workspace-permissions 注册表派生的 wire 值(zod enum 不收第二份字面量)。
    // 另批收口(2026-10-23):写档不再是 400 —— 缺省落 plan(只读+评论),
    // 显式写档(accept-edits/bypass-permissions/default)= 可抢麦发言(§6 第 1 点的授权面补票)。
    const requestedWire = parsed.data.tier ?? DEFAULT_TIER
    const invitation = await upsertCollaboratorInvitation({
      conversationId: id,
      userId: parsed.data.userId,
      invitedBy: request.userId,
      tier: requestedWire,
    })
    broadcastCollab(
      request,
      invitation.userId,
      collabInvitationEvent({
        conversationId: id,
        invitationId: invitation.id,
        invitedBy: request.userId,
        state: 'pending',
        at: invitation.updatedAt,
      }),
      { conversationId: id, invitationId: invitation.id },
    )
    return reply.status(201).send(success({ invitation }))
  })

  // GET /conversations/:id/collaborators — 属主或 accepted 协作者可列
  server.get('/conversations/:id/collaborators', async (request, reply) => {
    await requireAuth(request, reply)
    if (!request.userId) return
    const { id } = idParam.parse(request.params)
    if (!(await ensureReadAccess(id, request.userId, reply))) return
    const collaborators = await listCollaborators(id)
    return reply.send(success({ collaborators }))
  })

  // GET /collaborator-invitations — 我的待处理邀请
  server.get('/collaborator-invitations', async (request, reply) => {
    await requireAuth(request, reply)
    if (!request.userId) return
    const invitations = await listPendingInvitationsForUser(request.userId)
    return reply.send(success({ invitations }))
  })

  // POST /conversations/:id/collaborator-invitations/accept — 被邀请人本人接受
  server.post('/conversations/:id/collaborator-invitations/accept', async (request, reply) => {
    await requireAuth(request, reply)
    if (!request.userId) return
    const { id } = idParam.parse(request.params)
    const accepted = await acceptCollaboratorInvitation(id, request.userId)
    const invitation = accepted[0]
    if (!invitation) {
      return reply.status(404).send(error(404, '没有待接受的邀请'))
    }
    const conversation = await findConversationById(id)
    if (conversation) {
      broadcastCollab(
        request,
        conversation.userId,
        collabInvitationEvent({
          conversationId: id,
          invitationId: invitation.id,
          invitedBy: request.userId,
          state: 'accepted',
          at: invitation.updatedAt,
        }),
        { conversationId: id, invitationId: invitation.id },
      )
    }
    return reply.send(success({ collaborator: invitation }))
  })

  // DELETE /conversations/:id/collaborators/:userId — 属主撤销(软删 revoked)
  server.delete('/conversations/:id/collaborators/:userId', async (request, reply) => {
    await requireAuth(request, reply)
    if (!request.userId) return
    const { id, userId: targetUserId } = z
      .object({ id: z.string().min(1), userId: z.string().min(1) })
      .strict()
      .parse(request.params)
    const conversation = await ensureOwnedConversation(id, request.userId, reply)
    if (!conversation) return
    const removed = await revokeCollaborator(id, targetUserId)
    const row = removed[0]
    if (!row) {
      return reply.status(404).send(error(404, '该用户不在此会话的协作名单中'))
    }
    broadcastCollab(
      request,
      targetUserId,
      collabInvitationEvent({
        conversationId: id,
        invitationId: row.id,
        invitedBy: request.userId,
        state: 'revoked',
        at: row.updatedAt,
      }),
      { conversationId: id, invitationId: row.id },
    )
    // D125 另批收口:被撤销人恰持麦 ⇒ 夺回(否则麦被一个已无发言资格的人占着 = 幽灵锁)。
    // 清锁失败不改响应:撤销事实已落库,锁残留由下一次 acquire/release 的行锁路径收敛。
    const clearedHolder = await clearCollabLockIfHeldBy(id, targetUserId)
    if (clearedHolder) {
      await broadcastLockToRoom(
        request,
        conversation,
        request.userId,
        collabLockEvent({
          conversationId: id,
          holderUserId: null,
          state: 'released',
          at: new Date().toISOString(),
        }),
      )
    }
    return reply.send(success({ revoked: true }))
  })

  // PATCH /conversations/:id/collaborators/:userId — 属主改档位(邀请管理 UI 写面)
  const tierSchema = z.object({ tier: z.enum(PERMISSION_MODE_WIRE_VALUES) }).strict()
  server.patch('/conversations/:id/collaborators/:userId', async (request, reply) => {
    await requireAuth(request, reply)
    if (!request.userId) return
    const { id, userId: targetUserId } = z
      .object({ id: z.string().min(1), userId: z.string().min(1) })
      .strict()
      .parse(request.params)
    const conversation = await ensureOwnedConversation(id, request.userId, reply)
    if (!conversation) return
    const parsed = tierSchema.safeParse(request.body)
    if (!parsed.success) {
      return reply.status(400).send(error(400, parsed.error.issues[0]?.message ?? '参数错误'))
    }
    const updated = await updateCollaboratorTier({
      conversationId: id,
      userId: targetUserId,
      tier: parsed.data.tier,
    })
    if (!updated) {
      return reply.status(404).send(error(404, '该用户不在此会话的协作名单中(已撤销行不可改档)'))
    }
    // 失效帧:state 取当前 status(pending/accepted),收信人 = 受影响人 + 属主(其余设备)。
    // 档位变了而邀请状态没变 —— 端上按 invitationId 重取 collaborators 即拿到新档。
    // status 值域由库面 statusChk 约束钉死为三档,写面查询已排除 revoked ⇒ 只剩两档直映射。
    const evt = collabInvitationEvent({
      conversationId: id,
      invitationId: updated.id,
      invitedBy: request.userId,
      state: updated.status === 'pending' ? 'pending' : 'accepted',
      at: updated.updatedAt,
    })
    broadcastCollab(request, targetUserId, evt, { conversationId: id, via: 'tier-update' })
    if (targetUserId !== conversation.userId) {
      broadcastCollab(request, conversation.userId, evt, { conversationId: id, via: 'tier-update' })
    }
    return reply.send(success({ collaborator: updated }))
  })

  // ===========================================================================
  // 写锁 / 接管发言(D125 另批收口,设计稿 §6)
  // ===========================================================================

  // GET /conversations/:id/collab-lock — 读面门槛同评论(属主或 accepted 协作者)
  server.get('/conversations/:id/collab-lock', async (request, reply) => {
    await requireAuth(request, reply)
    if (!request.userId) return
    const { id } = idParam.parse(request.params)
    const conversation = await ensureReadAccess(id, request.userId, reply)
    if (!conversation) return
    return reply.send(success({ lock: readCollabLock(conversation.metadata) }))
  })

  // POST /conversations/:id/collab-lock/acquire — 抢麦/夺麦
  const acquireSchema = z.object({ takeover: z.boolean().optional() }).strict()
  server.post('/conversations/:id/collab-lock/acquire', async (request, reply) => {
    await requireAuth(request, reply)
    if (!request.userId) return
    const { id } = idParam.parse(request.params)
    const parsed = acquireSchema.safeParse(request.body ?? {})
    if (!parsed.success) {
      return reply.status(400).send(error(400, parsed.error.issues[0]?.message ?? '参数错误'))
    }
    const conversation = await ensureReadAccess(id, request.userId, reply)
    if (!conversation) return
    // 抢麦资格 = 属主,或 accepted 且非 plan 档(写档)。plan 档只读+评论,无麦可抢(§3)。
    const isOwner = conversation.userId === request.userId
    if (!isOwner) {
      const collab = await getCollaborator(id, request.userId)
      if (!collab || collab.status !== 'accepted' || collab.tier === DEFAULT_TIER) {
        return reply.status(403).send(error(403, '无抢麦资格:需为会话属主或已接受邀请的写档协作者'))
      }
    }
    const result = await acquireCollabLock({
      conversationId: id,
      holderUserId: request.userId,
      takeover: parsed.data.takeover === true,
    })
    if (!result.acquired) {
      return reply.status(409).send(error(409, '当前有其他协作者持麦,接管发言需显式 takeover'))
    }
    await broadcastLockToRoom(
      request,
      conversation,
      request.userId,
      collabLockEvent({
        conversationId: id,
        holderUserId: result.lock.holderUserId,
        state: result.takenFrom ? 'taken' : 'acquired',
        at: result.lock.acquiredAt,
      }),
    )
    return reply.send(success({ lock: result.lock, takenFrom: result.takenFrom }))
  })

  // DELETE /conversations/:id/collab-lock — 交麦(持麦人本人;属主可强制收麦)
  server.delete('/conversations/:id/collab-lock', async (request, reply) => {
    await requireAuth(request, reply)
    if (!request.userId) return
    const { id } = idParam.parse(request.params)
    const conversation = await ensureReadAccess(id, request.userId, reply)
    if (!conversation) return
    const isOwner = conversation.userId === request.userId
    const result = await releaseCollabLock({
      conversationId: id,
      requesterUserId: request.userId,
      force: isOwner,
    })
    if (!result.released) {
      if (result.previousHolder) {
        return reply.status(409).send(error(409, '麦由他人持有,无法交麦'))
      }
      // 本就无人持麦 ⇒ 幂等 no-op,不把"没锁可放"伪装成失败
      return reply.send(success({ released: false, lock: null }))
    }
    await broadcastLockToRoom(
      request,
      conversation,
      request.userId,
      collabLockEvent({
        conversationId: id,
        holderUserId: null,
        state: 'released',
        at: new Date().toISOString(),
      }),
    )
    return reply.send(success({ released: true, lock: null }))
  })

  // ===========================================================================
  // 逐消息评论
  // ===========================================================================

  const commentParams = z
    .object({
      id: z.string().min(1),
      messageId: z.string().min(1),
    })
    .strict()

  // GET /conversations/:id/messages/:messageId/comments
  server.get('/conversations/:id/messages/:messageId/comments', async (request, reply) => {
    await requireAuth(request, reply)
    if (!request.userId) return
    const { id, messageId } = commentParams.parse(request.params)
    if (!(await ensureReadAccess(id, request.userId, reply))) return
    if (!(await messageInConversation(messageId, id))) {
      return reply.status(404).send(error(404, '消息不存在'))
    }
    const comments = await listMessageComments(id, messageId)
    return reply.send(success({ comments }))
  })

  // POST /conversations/:id/messages/:messageId/comments — 属主或 accepted 协作者
  const addCommentSchema = z.object({ body: z.string().trim().min(1).max(2000) })
  server.post('/conversations/:id/messages/:messageId/comments', async (request, reply) => {
    await requireAuth(request, reply)
    if (!request.userId) return
    const { id, messageId } = commentParams.parse(request.params)
    const conversation = await ensureReadAccess(id, request.userId, reply)
    if (!conversation) return
    const parsed = addCommentSchema.safeParse(request.body)
    if (!parsed.success) {
      return reply.status(400).send(error(400, parsed.error.issues[0]?.message ?? '参数错误'))
    }
    if (!(await messageInConversation(messageId, id))) {
      return reply.status(404).send(error(404, '消息不存在'))
    }
    const comment = await createMessageComment({
      conversationId: id,
      messageId,
      userId: request.userId,
      body: parsed.data.body,
    })
    // fan-out:属主 + 全部 accepted 协作者,排除作者本人(自己的写自己知道,回声免推)
    const collaboratorIds = await listAcceptedCollaboratorUserIds(id)
    const recipients = new Set([conversation.userId, ...collaboratorIds])
    recipients.delete(request.userId)
    const evt = collabCommentEvent({
      conversationId: id,
      messageId,
      commentId: comment.id,
      authorId: request.userId,
      at: comment.createdAt,
    })
    for (const uid of recipients) {
      broadcastCollab(request, uid, evt, { conversationId: id, messageId, commentId: comment.id })
    }
    return reply.status(201).send(success({ comment }))
  })

  // DELETE /conversations/:id/messages/:messageId/comments/:commentId — 作者或属主
  server.delete(
    '/conversations/:id/messages/:messageId/comments/:commentId',
    async (request, reply) => {
      await requireAuth(request, reply)
      if (!request.userId) return
      const { id, messageId, commentId } = z
        .object({
          id: z.string().min(1),
          messageId: z.string().min(1),
          commentId: z.string().min(1),
        })
        .strict()
        .parse(request.params)
      const conversation = await ensureReadAccess(id, request.userId, reply)
      if (!conversation) return
      // 属主可删本会话任意评论(不给作者集过滤 ⇒ 三重 where 已锁死会话+消息);
      // 非属主只能删自己的(库确认集只带作者 id 那一格)。空确认集 ⇒ 404,不把"没删到"读成成功。
      const isOwner = conversation.userId === request.userId
      const removed = await deleteMessageComment({
        conversationId: id,
        messageId,
        commentId,
        userIds: isOwner ? undefined : [request.userId],
      })
      if (removed.length === 0) {
        return reply.status(404).send(error(404, '评论不存在或不属于当前用户'))
      }
      return reply.send(success({ deleted: true }))
    },
  )
}
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
