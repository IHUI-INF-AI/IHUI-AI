// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍‌​‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * D125 另批收口(2026-10-23)写锁/接管发言路由契约 —— 零真实 DB。
 * 设计稿 docs/d125-session-collab-design.md §6;harness 照 chat-collab-routes.test.ts
 * 同型桩(写面查询整模块 mock,真实模块会拉起 db 连接)。
 *
 * 钉死的格子:
 *  1. 抢麦资格 = 属主,或 accepted 且非 plan 档(写档);plan 档/pending/外人 ⇒ 403;
 *  2. 他人持麦且未 takeover ⇒ 409 且**不发帧**(锁没动,房间不该看到假象);
 *  3. takeover 夺麦 ⇒ 帧 state='taken';普通抢麦 ⇒ 'acquired';交麦 ⇒ 'released';
 *  4. 锁帧 fan-out = 属主 + accepted 协作者,排除行为主体(回声免推,与评论同规则);
 *  5. 撤销恰夺到麦 ⇒ revoked 帧之后追加 released 帧(幽灵锁收口);
 *  6. 载荷不承载收信人身份(AGENTS §5 认证≠授权);发帧失败不改响应。
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

function lockState(holder: string) {
  return { holderUserId: holder, acquiredAt: NOW.toISOString() }
}

let app: FastifyInstance

beforeEach(async () => {
  vi.clearAllMocks()
  authUserId.value = 'owner-1'
  findConversationById.mockResolvedValue({
    id: 'conv-1',
    userId: 'owner-1',
    metadata: {},
  })
  findUserById.mockResolvedValue({ id: 'user-2' })
  getCollaborator.mockResolvedValue(null)
  listAcceptedCollaboratorUserIds.mockResolvedValue(['user-2', 'user-3'])
  revokeCollaborator.mockResolvedValue([collaboratorRow({ status: 'revoked' })])
  readCollabLock.mockReturnValue(null)
  acquireCollabLock.mockResolvedValue({
    acquired: true,
    lock: lockState('owner-1'),
    takenFrom: null,
  })
  releaseCollabLock.mockResolvedValue({ released: true, previousHolder: 'owner-1' })
  clearCollabLockIfHeldBy.mockResolvedValue(null)

  app = Fastify()
  app.decorate('broadcastToUser', broadcastToUser)
  await app.register(chatCollabRoutes, { prefix: '/api/chat' })
  await app.ready()
})

describe('① GET collab-lock:读面门槛同评论(属主或 accepted)', () => {
  it('属主读锁 ⇒ 200,lock 取 readCollabLock(metadata)', async () => {
    readCollabLock.mockReturnValue(lockState('user-2'))
    const res = await app.inject({
      method: 'GET',
      url: '/api/chat/conversations/conv-1/collab-lock',
    })
    expect(res.statusCode).toBe(200)
    expect(res.json().data.lock).toEqual(lockState('user-2'))
    expect(readCollabLock).toHaveBeenCalled()
  })

  it('pending 协作者 ⇒ 403;accepted 协作者 ⇒ 200', async () => {
    authUserId.value = 'user-2'
    getCollaborator.mockResolvedValue(collaboratorRow({ status: 'pending' }))
    const pending = await app.inject({
      method: 'GET',
      url: '/api/chat/conversations/conv-1/collab-lock',
    })
    expect(pending.statusCode).toBe(403)

    getCollaborator.mockResolvedValue(collaboratorRow({ status: 'accepted', tier: 'accept-edits' }))
    const accepted = await app.inject({
      method: 'GET',
      url: '/api/chat/conversations/conv-1/collab-lock',
    })
    expect(accepted.statusCode).toBe(200)
  })
})

describe('② POST acquire:资格、409、takenover 与帧形', () => {
  it('属主抢麦 ⇒ 200,acquired 帧 fan-out 到 accepted 协作者、排除属主本人、不带身份键', async () => {
    const res = await app.inject({
      method: 'POST',
      url: '/api/chat/conversations/conv-1/collab-lock/acquire',
      payload: {},
    })
    expect(res.statusCode).toBe(200)
    expect(acquireCollabLock).toHaveBeenCalledWith({
      conversationId: 'conv-1',
      holderUserId: 'owner-1',
      takeover: false,
    })
    const recipients = broadcastToUser.mock.calls.map((c) => c[0])
    expect(recipients).toEqual(['user-2', 'user-3'])
    const [, event, data] = broadcastToUser.mock.calls[0] as [
      string,
      string,
      Record<string, unknown>,
    ]
    expect(event).toBe('collab:lock')
    expect(data.state).toBe('acquired')
    expect(data.holderUserId).toBe('owner-1')
    expect(data.conversationId).toBe('conv-1')
    expect(data).not.toHaveProperty('userId')
  })

  it('accepted 写档协作者抢麦 ⇒ 200(资格=属主或写档)', async () => {
    authUserId.value = 'user-2'
    getCollaborator.mockResolvedValue(collaboratorRow({ status: 'accepted', tier: 'accept-edits' }))
    acquireCollabLock.mockResolvedValue({
      acquired: true,
      lock: lockState('user-2'),
      takenFrom: null,
    })
    const res = await app.inject({
      method: 'POST',
      url: '/api/chat/conversations/conv-1/collab-lock/acquire',
      payload: {},
    })
    expect(res.statusCode).toBe(200)
    const recipients = broadcastToUser.mock.calls.map((c) => c[0])
    expect(recipients).toContain('owner-1')
    expect(recipients).not.toContain('user-2')
  })

  it('accepted plan 档 ⇒ 403(只读+评论,无麦可抢);pending ⇒ 403(读面都不开)', async () => {
    authUserId.value = 'user-2'
    getCollaborator.mockResolvedValue(collaboratorRow({ status: 'accepted', tier: 'plan' }))
    const plan = await app.inject({
      method: 'POST',
      url: '/api/chat/conversations/conv-1/collab-lock/acquire',
      payload: {},
    })
    expect(plan.statusCode).toBe(403)
    expect(acquireCollabLock).not.toHaveBeenCalled()

    getCollaborator.mockResolvedValue(collaboratorRow({ status: 'pending', tier: 'accept-edits' }))
    const pending = await app.inject({
      method: 'POST',
      url: '/api/chat/conversations/conv-1/collab-lock/acquire',
      payload: {},
    })
    expect(pending.statusCode).toBe(403)
  })

  it('他人持麦且未 takeover ⇒ 409 且不写帧(锁没动,房间不见假象)', async () => {
    acquireCollabLock.mockResolvedValue({
      acquired: false,
      lock: lockState('user-2'),
      takenFrom: null,
    })
    const res = await app.inject({
      method: 'POST',
      url: '/api/chat/conversations/conv-1/collab-lock/acquire',
      payload: {},
    })
    expect(res.statusCode).toBe(409)
    expect(broadcastToUser).not.toHaveBeenCalled()
  })

  it('takeover 夺麦 ⇒ 200,帧 state=taken 点名被夺者', async () => {
    acquireCollabLock.mockResolvedValue({
      acquired: true,
      lock: lockState('owner-1'),
      takenFrom: 'user-2',
    })
    const res = await app.inject({
      method: 'POST',
      url: '/api/chat/conversations/conv-1/collab-lock/acquire',
      payload: { takeover: true },
    })
    expect(res.statusCode).toBe(200)
    expect(acquireCollabLock).toHaveBeenCalledWith(expect.objectContaining({ takeover: true }))
    expect(res.json().data.takenFrom).toBe('user-2')
    const [, , data] = broadcastToUser.mock.calls[0] as [string, string, Record<string, unknown>]
    expect(data.state).toBe('taken')
  })

  it('载荷带脏键 ⇒ 400(strict);发帧抛错不改 200', async () => {
    const bad = await app.inject({
      method: 'POST',
      url: '/api/chat/conversations/conv-1/collab-lock/acquire',
      payload: { takeover: true, userId: 'someone' },
    })
    expect(bad.statusCode).toBe(400)

    broadcastToUser.mockImplementation(() => {
      throw new Error('socket gone')
    })
    const res = await app.inject({
      method: 'POST',
      url: '/api/chat/conversations/conv-1/collab-lock/acquire',
      payload: {},
    })
    expect(res.statusCode).toBe(200)
  })
})

describe('③ DELETE collab-lock:交麦/强制收麦/幂等空放', () => {
  it('持麦人本人交麦 ⇒ 200,released 帧 holderUserId=null、fan-out 排除交麦人', async () => {
    authUserId.value = 'user-2'
    getCollaborator.mockResolvedValue(collaboratorRow({ status: 'accepted', tier: 'accept-edits' }))
    releaseCollabLock.mockResolvedValue({ released: true, previousHolder: 'user-2' })
    const res = await app.inject({
      method: 'DELETE',
      url: '/api/chat/conversations/conv-1/collab-lock',
    })
    expect(res.statusCode).toBe(200)
    expect(res.json().data).toEqual({ released: true, lock: null })
    expect(releaseCollabLock).toHaveBeenCalledWith({
      conversationId: 'conv-1',
      requesterUserId: 'user-2',
      force: false,
    })
    const recipients = broadcastToUser.mock.calls.map((c) => c[0])
    expect(recipients).toContain('owner-1')
    expect(recipients).toContain('user-3')
    expect(recipients).not.toContain('user-2')
    const [, event, data] = broadcastToUser.mock.calls[0] as [
      string,
      string,
      Record<string, unknown>,
    ]
    expect(event).toBe('collab:lock')
    expect(data.state).toBe('released')
    expect(data.holderUserId).toBeNull()
  })

  it('属主交麦走 force=true(强制收麦特权)', async () => {
    await app.inject({ method: 'DELETE', url: '/api/chat/conversations/conv-1/collab-lock' })
    expect(releaseCollabLock).toHaveBeenCalledWith(expect.objectContaining({ force: true }))
  })

  it('他人持麦且请求人非属主 ⇒ 409(不静默放掉别人的麦)', async () => {
    authUserId.value = 'user-2'
    getCollaborator.mockResolvedValue(collaboratorRow({ status: 'accepted', tier: 'accept-edits' }))
    releaseCollabLock.mockResolvedValue({ released: false, previousHolder: 'user-3' })
    const res = await app.inject({
      method: 'DELETE',
      url: '/api/chat/conversations/conv-1/collab-lock',
    })
    expect(res.statusCode).toBe(409)
    expect(broadcastToUser).not.toHaveBeenCalled()
  })

  it('本就无人持麦 ⇒ 200 {released:false} 幂等 no-op,不发帧', async () => {
    releaseCollabLock.mockResolvedValue({ released: false, previousHolder: null })
    const res = await app.inject({
      method: 'DELETE',
      url: '/api/chat/conversations/conv-1/collab-lock',
    })
    expect(res.statusCode).toBe(200)
    expect(res.json().data).toEqual({ released: false, lock: null })
    expect(broadcastToUser).not.toHaveBeenCalled()
  })
})

describe('④ 撤销夺锁:幽灵锁收口(被撤销人恰持麦 ⇒ 追加 released 帧)', () => {
  it('撤销恰清到锁 ⇒ revoked 帧后追加 released 帧;没占到 ⇒ 只发 revoked', async () => {
    clearCollabLockIfHeldBy.mockResolvedValue('user-2')
    const res = await app.inject({
      method: 'DELETE',
      url: '/api/chat/conversations/conv-1/collaborators/user-2',
    })
    expect(res.statusCode).toBe(200)
    expect(clearCollabLockIfHeldBy).toHaveBeenCalledWith('conv-1', 'user-2')
    const frames = broadcastToUser.mock.calls.map((c) => [
      c[1],
      (c[2] as Record<string, unknown>).state,
    ])
    expect(frames).toContainEqual(['collab:invitation', 'revoked'])
    expect(frames).toContainEqual(['collab:lock', 'released'])

    clearCollabLockIfHeldBy.mockResolvedValue(null)
    broadcastToUser.mockClear()
    const again = await app.inject({
      method: 'DELETE',
      url: '/api/chat/conversations/conv-1/collaborators/user-2',
    })
    expect(again.statusCode).toBe(200)
    expect(broadcastToUser).toHaveBeenCalledTimes(1)
    expect(broadcastToUser.mock.calls[0]![1]).toBe('collab:invitation')
  })
})
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍‌​‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
