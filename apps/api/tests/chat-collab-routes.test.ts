// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * D125 协作会话路由 · 最小纵向切片契约 —— 零真实 DB。
 * 设计稿 docs/d125-session-collab-design.md §5;发射口纪律照 D153(workspace-permissions
 * 测试同型桩)。
 *
 * 钉住的五格:
 *  1. 邀请档位:缺省落 plan(只读+评论);另批收口(2026-10-23)后四档全授,
 *     显式写档(accept-edits 等)直接落库,不再 400 推给"另批";
 *  2. 认证≠授权:非属主邀请 403;pending 协作者读面 403;载荷不承载身份;
 *  3. 广播只在写库成功后发,收信人由 userId 钉死(pending→被邀请人、accepted→属主、
 *     revoked→被撤销人;评论 fan-out 排除作者回声);
 *  4. 发帧失败不改响应(log.warn 出声路径由 try/catch 保证,这里断言 201 仍在);
 *  5. 删除类取库确认集:空确认集 ⇒ 404,不把"没删到"读成成功。
 */
import { describe, it, expect, beforeEach, vi } from 'vitest'
import Fastify, { type FastifyInstance, type FastifyRequest } from 'fastify'

const {
  authUserId,
  findConversationById,
  findUserById,
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
  readCollabLock,
  acquireCollabLock,
  releaseCollabLock,
  clearCollabLockIfHeldBy,
  updateCollaboratorTier,
  broadcastToUser,
} = vi.hoisted(() => ({
  authUserId: { value: 'owner-1' },
  findConversationById: vi.fn(),
  findUserById: vi.fn(),
  upsertCollaboratorInvitation: vi.fn(),
  listCollaborators: vi.fn(),
  listPendingInvitationsForUser: vi.fn(),
  getCollaborator: vi.fn(),
  acceptCollaboratorInvitation: vi.fn(),
  revokeCollaborator: vi.fn(),
  listAcceptedCollaboratorUserIds: vi.fn(),
  listMessageComments: vi.fn(),
  createMessageComment: vi.fn(),
  deleteMessageComment: vi.fn(),
  messageInConversation: vi.fn(),
  readCollabLock: vi.fn(),
  acquireCollabLock: vi.fn(),
  releaseCollabLock: vi.fn(),
  clearCollabLockIfHeldBy: vi.fn(),
  updateCollaboratorTier: vi.fn(),
  broadcastToUser: vi.fn(),
}))

vi.mock('../src/plugins/auth.js', () => ({
  authenticate: async (request: FastifyRequest) => {
    request.userId = authUserId.value
  },
}))

vi.mock('../src/db/chat-queries.js', () => ({ findConversationById }))
vi.mock('../src/db/queries.js', () => ({ findUserById }))

vi.mock('../src/db/chat-collab-queries.js', () => ({
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
}))

// 另批收口新增的写面(chat-collab.ts 现 import 这份):零真库 harness 必须一并桩掉,
// 否则真实模块会拉起 ./index.js 的 db 连接。
vi.mock('../src/db/chat-collab-write-queries.js', () => ({
  readCollabLock,
  acquireCollabLock,
  releaseCollabLock,
  clearCollabLockIfHeldBy,
  updateCollaboratorTier,
}))

import { chatCollabRoutes } from '../src/routes/chat-collab.js'

const NOW = new Date('2026-10-23T12:00:00.000Z')

function collaboratorRow(over: Partial<Record<string, unknown>> = {}) {
  return {
    id: 'collab-1',
    conversationId: 'conv-1',
    userId: 'user-2',
    invitedBy: 'owner-1',
    tier: 'plan',
    status: 'pending',
    createdAt: NOW,
    updatedAt: NOW,
    ...over,
  }
}

let app: FastifyInstance

beforeEach(async () => {
  vi.clearAllMocks()
  authUserId.value = 'owner-1'
  findConversationById.mockResolvedValue({ id: 'conv-1', userId: 'owner-1' })
  findUserById.mockImplementation(async (id: string) => (id === 'user-2' ? { id } : null))
  upsertCollaboratorInvitation.mockImplementation(async (input: Record<string, string>) =>
    collaboratorRow({ userId: input.userId, tier: input.tier }),
  )
  listCollaborators.mockResolvedValue([])
  listPendingInvitationsForUser.mockResolvedValue([])
  getCollaborator.mockResolvedValue(null)
  acceptCollaboratorInvitation.mockResolvedValue([collaboratorRow({ status: 'accepted' })])
  revokeCollaborator.mockResolvedValue([collaboratorRow({ status: 'revoked' })])
  listAcceptedCollaboratorUserIds.mockResolvedValue(['user-2'])
  listMessageComments.mockResolvedValue([])
  createMessageComment.mockResolvedValue({
    id: 'cmt-1',
    conversationId: 'conv-1',
    messageId: 'msg-1',
    userId: authUserId.value,
    body: 'ok',
    createdAt: NOW,
    authorName: 'Owner',
  })
  deleteMessageComment.mockResolvedValue(['cmt-1'])
  messageInConversation.mockResolvedValue({ id: 'msg-1' })
  // 写锁面缺省桩:本文件只测邀请/评论契约,锁行为在 chat-collab-lock-routes.test.ts。
  // 撤销路径会调 clearCollabLockIfHeldBy ⇒ 缺省"没占到锁"不追加 released 帧。
  readCollabLock.mockReturnValue(null)
  acquireCollabLock.mockResolvedValue({ acquired: true, lock: null, takenFrom: null })
  releaseCollabLock.mockResolvedValue({ released: true, previousHolder: null })
  clearCollabLockIfHeldBy.mockResolvedValue(null)
  updateCollaboratorTier.mockResolvedValue(null)

  app = Fastify()
  app.decorate('broadcastToUser', broadcastToUser)
  await app.register(chatCollabRoutes, { prefix: '/api/chat' })
  await app.ready()
})

describe('① 邀请:缺省 plan,四档全授(另批收口)', () => {
  it('属主邀请 user-2 ⇒ 201,tier 落库 plan,向被邀请人发 pending 帧', async () => {
    const res = await app.inject({
      method: 'POST',
      url: '/api/chat/conversations/conv-1/collaborators',
      payload: { userId: 'user-2' },
    })
    expect(res.statusCode).toBe(201)
    expect(res.json().data.invitation.tier).toBe('plan')
    expect(upsertCollaboratorInvitation).toHaveBeenCalledWith(
      expect.objectContaining({ conversationId: 'conv-1', userId: 'user-2', tier: 'plan' }),
    )
    expect(broadcastToUser).toHaveBeenCalledTimes(1)
    const [uid, event, data] = broadcastToUser.mock.calls[0] as [
      string,
      string,
      Record<string, unknown>,
    ]
    expect(uid).toBe('user-2')
    expect(event).toBe('collab:invitation')
    expect(data.state).toBe('pending')
    expect(data).not.toHaveProperty('userId')
  })

  it('显式请求 accept-edits ⇒ 201 直落写档(不再 400 推"另批")', async () => {
    const res = await app.inject({
      method: 'POST',
      url: '/api/chat/conversations/conv-1/collaborators',
      payload: { userId: 'user-2', tier: 'accept-edits' },
    })
    expect(res.statusCode).toBe(201)
    expect(res.json().data.invitation.tier).toBe('accept-edits')
    expect(upsertCollaboratorInvitation).toHaveBeenCalledWith(
      expect.objectContaining({ conversationId: 'conv-1', userId: 'user-2', tier: 'accept-edits' }),
    )
    expect(broadcastToUser).toHaveBeenCalledTimes(1)
  })

  it('档位词表外的值 ⇒ 400(zod enum 收口,不落脏档)', async () => {
    const res = await app.inject({
      method: 'POST',
      url: '/api/chat/conversations/conv-1/collaborators',
      payload: { userId: 'user-2', tier: 'superuser' },
    })
    expect(res.statusCode).toBe(400)
    expect(upsertCollaboratorInvitation).not.toHaveBeenCalled()
    expect(broadcastToUser).not.toHaveBeenCalled()
  })

  it('自邀 400 / 被邀请人不存在 404 / 非属主 403', async () => {
    const self = await app.inject({
      method: 'POST',
      url: '/api/chat/conversations/conv-1/collaborators',
      payload: { userId: 'owner-1' },
    })
    expect(self.statusCode).toBe(400)
    const ghost = await app.inject({
      method: 'POST',
      url: '/api/chat/conversations/conv-1/collaborators',
      payload: { userId: 'nope' },
    })
    expect(ghost.statusCode).toBe(404)
    authUserId.value = 'user-9'
    findConversationById.mockResolvedValue({ id: 'conv-1', userId: 'owner-1' })
    const notOwner = await app.inject({
      method: 'POST',
      url: '/api/chat/conversations/conv-1/collaborators',
      payload: { userId: 'user-2' },
    })
    expect(notOwner.statusCode).toBe(403)
  })
})

describe('② 接受/撤销:库确认集 + 帧的收信人钉死', () => {
  it('被邀请人接受 ⇒ 200,向属主发 accepted 帧;确认集空 ⇒ 404 不发帧', async () => {
    authUserId.value = 'user-2'
    const res = await app.inject({
      method: 'POST',
      url: '/api/chat/conversations/conv-1/collaborator-invitations/accept',
    })
    expect(res.statusCode).toBe(200)
    expect(broadcastToUser).toHaveBeenCalledTimes(1)
    const [uid, event, data] = broadcastToUser.mock.calls[0] as [
      string,
      string,
      Record<string, unknown>,
    ]
    expect(uid).toBe('owner-1')
    expect(event).toBe('collab:invitation')
    expect(data.state).toBe('accepted')

    acceptCollaboratorInvitation.mockResolvedValue([])
    broadcastToUser.mockClear()
    const again = await app.inject({
      method: 'POST',
      url: '/api/chat/conversations/conv-1/collaborator-invitations/accept',
    })
    expect(again.statusCode).toBe(404)
    expect(broadcastToUser).not.toHaveBeenCalled()
  })

  it('属主撤销 ⇒ 200 向被撤销人发 revoked 帧;非属主 403', async () => {
    const res = await app.inject({
      method: 'DELETE',
      url: '/api/chat/conversations/conv-1/collaborators/user-2',
    })
    expect(res.statusCode).toBe(200)
    const [uid, , data] = broadcastToUser.mock.calls[0] as [string, string, Record<string, unknown>]
    expect(uid).toBe('user-2')
    expect(data.state).toBe('revoked')

    authUserId.value = 'user-2'
    const notOwner = await app.inject({
      method: 'DELETE',
      url: '/api/chat/conversations/conv-1/collaborators/user-2',
    })
    expect(notOwner.statusCode).toBe(403)
  })
})

describe('③ 评论:读面门槛 + fan-out 排除作者回声 + 发帧失败不改响应', () => {
  it('pending 协作者 GET 评论 ⇒ 403(accepted 才开读面)', async () => {
    authUserId.value = 'user-2'
    getCollaborator.mockResolvedValue(collaboratorRow({ status: 'pending' }))
    const res = await app.inject({
      method: 'GET',
      url: '/api/chat/conversations/conv-1/messages/msg-1/comments',
    })
    expect(res.statusCode).toBe(403)
  })

  it('accepted 协作者发评论 ⇒ 201,帧只发给属主+其余协作者,不含作者本人', async () => {
    authUserId.value = 'user-2'
    getCollaborator.mockResolvedValue(collaboratorRow({ status: 'accepted' }))
    listAcceptedCollaboratorUserIds.mockResolvedValue(['user-2', 'user-3'])
    const res = await app.inject({
      method: 'POST',
      url: '/api/chat/conversations/conv-1/messages/msg-1/comments',
      payload: { body: '第二段批注' },
    })
    expect(res.statusCode).toBe(201)
    const recipients = broadcastToUser.mock.calls.map((c) => c[0])
    expect(recipients).toContain('owner-1')
    expect(recipients).toContain('user-3')
    expect(recipients).not.toContain('user-2')
    const [, event, data] = broadcastToUser.mock.calls[0] as [
      string,
      string,
      Record<string, unknown>,
    ]
    expect(event).toBe('collab:comment')
    expect(data.messageId).toBe('msg-1')
    expect(data).not.toHaveProperty('body')
  })

  it('广播抛错 ⇒ 响应仍是 201(写库已成功,发帧失败只出声)', async () => {
    broadcastToUser.mockImplementation(() => {
      throw new Error('socket gone')
    })
    const res = await app.inject({
      method: 'POST',
      url: '/api/chat/conversations/conv-1/messages/msg-1/comments',
      payload: { body: '回声测试' },
    })
    expect(res.statusCode).toBe(201)
  })

  it('空正文 400;消息不属于该会话 404', async () => {
    const empty = await app.inject({
      method: 'POST',
      url: '/api/chat/conversations/conv-1/messages/msg-1/comments',
      payload: { body: '   ' },
    })
    expect(empty.statusCode).toBe(400)
    messageInConversation.mockResolvedValue(null)
    const wrong = await app.inject({
      method: 'POST',
      url: '/api/chat/conversations/conv-1/messages/msg-9/comments',
      payload: { body: 'x' },
    })
    expect(wrong.statusCode).toBe(404)
  })

  it('非属主删他人评论:确认集空 ⇒ 404;属主删任意 ⇒ 200 且不带作者集过滤', async () => {
    authUserId.value = 'user-2'
    getCollaborator.mockResolvedValue(collaboratorRow({ status: 'accepted' }))
    deleteMessageComment.mockResolvedValue([])
    const notMine = await app.inject({
      method: 'DELETE',
      url: '/api/chat/conversations/conv-1/messages/msg-1/comments/cmt-x',
    })
    expect(notMine.statusCode).toBe(404)
    expect(deleteMessageComment).toHaveBeenCalledWith(
      expect.objectContaining({ userIds: ['user-2'] }),
    )
    authUserId.value = 'owner-1'
    deleteMessageComment.mockResolvedValue(['cmt-1'])
    const ownerDel = await app.inject({
      method: 'DELETE',
      url: '/api/chat/conversations/conv-1/messages/msg-1/comments/cmt-1',
    })
    expect(ownerDel.statusCode).toBe(200)
    expect(deleteMessageComment).toHaveBeenLastCalledWith(
      expect.objectContaining({ userIds: undefined }),
    )
  })
})

describe('④ 改档位 PATCH collaborators/:userId(邀请管理 UI 写面,另批收口)', () => {
  it('属主改档 ⇒ 200,失效帧发受影响人 + 属主,state 取库确认行状态', async () => {
    updateCollaboratorTier.mockResolvedValue(
      collaboratorRow({ status: 'accepted', tier: 'accept-edits' }),
    )
    const res = await app.inject({
      method: 'PATCH',
      url: '/api/chat/conversations/conv-1/collaborators/user-2',
      payload: { tier: 'accept-edits' },
    })
    expect(res.statusCode).toBe(200)
    expect(updateCollaboratorTier).toHaveBeenCalledWith({
      conversationId: 'conv-1',
      userId: 'user-2',
      tier: 'accept-edits',
    })
    const recipients = broadcastToUser.mock.calls.map((c) => c[0])
    expect(recipients).toEqual(['user-2', 'owner-1'])
    const [, event, data] = broadcastToUser.mock.calls[0] as [
      string,
      string,
      Record<string, unknown>,
    ]
    expect(event).toBe('collab:invitation')
    expect(data.state).toBe('accepted')
    expect(data).not.toHaveProperty('userId')
  })

  it('库确认空(无行/已撤销)⇒ 404 不发帧;脏档位 400;非属主 403', async () => {
    updateCollaboratorTier.mockResolvedValue(null)
    const notFound = await app.inject({
      method: 'PATCH',
      url: '/api/chat/conversations/conv-1/collaborators/user-2',
      payload: { tier: 'accept-edits' },
    })
    expect(notFound.statusCode).toBe(404)
    expect(broadcastToUser).not.toHaveBeenCalled()

    const badTier = await app.inject({
      method: 'PATCH',
      url: '/api/chat/conversations/conv-1/collaborators/user-2',
      payload: { tier: 'superuser' },
    })
    expect(badTier.statusCode).toBe(400)

    authUserId.value = 'user-2'
    const notOwner = await app.inject({
      method: 'PATCH',
      url: '/api/chat/conversations/conv-1/collaborators/user-2',
      payload: { tier: 'plan' },
    })
    expect(notOwner.statusCode).toBe(403)
  })
})
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
