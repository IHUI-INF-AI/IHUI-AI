// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * 团队邀请 email 分支的接受者比对(2026-11-01 安全强化)。
 *
 * 修前 accept / reject 里写的是
 *   `const isEmailMatch = invitation.email !== null && invitation.email !== undefined`
 * —— 只判"邀请上带邮箱",从不与当前用户比对 ⇒ 邀请链接被转发/泄露后,
 * 任何登录用户都能以被邀请人身份入队,或替他人拒掉邀请。
 *
 * 现行口径(accept / reject 共用同一份 `isInvitationAddressee`):
 *  - invitee_id 精确命中 ⇒ 通过
 *  - 邀请 email 与当前用户 email 忽略大小写相等 ⇒ 通过
 *  - 当前用户无邮箱 / 邮箱不一致 ⇒ 403
 */

import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest'
import Fastify, { type FastifyInstance } from 'fastify'

vi.hoisted(() => {
  process.env.DATABASE_URL ??= 'postgresql://test:test@localhost:5432/test'
  process.env.JWT_SECRET ??= 'test-jwt-secret-for-vitest-at-least-32-chars'
})

const { authState } = vi.hoisted(() => ({ authState: { userId: '' } }))

vi.mock('../src/config/index.js', () => ({
  config: {
    NODE_ENV: 'test',
    DATABASE_URL: 'postgresql://test:test@localhost:5432/test',
    JWT_SECRET: 'test-jwt-secret-for-vitest-at-least-32-chars',
    AI_SERVICE_URL: 'http://127.0.0.1:1',
  },
}))

// 钩子直接注入主体(等价 authenticate 成功后的形态)
vi.mock('../src/plugins/auth.js', () => ({
  authenticate: async (request: { userId?: string }) => {
    request.userId = authState.userId
  },
}))

const { teamQueries, userQueries } = vi.hoisted(() => ({
  teamQueries: {
    createTeam: vi.fn(),
    findTeamsByUser: vi.fn(),
    findTeamById: vi.fn(),
    findTeamDetailById: vi.fn(),
    findTeamBySlug: vi.fn(),
    updateTeam: vi.fn(),
    deleteTeam: vi.fn(),
    findTeamMembers: vi.fn(),
    findTeamMember: vi.fn(),
    removeTeamMember: vi.fn(),
    updateTeamMemberRole: vi.fn(),
    createInvitation: vi.fn(),
    findInvitationsByTeam: vi.fn(),
    findInvitationByToken: vi.fn(),
    findUserInvitations: vi.fn(),
    acceptInvitation: vi.fn(),
    rejectInvitation: vi.fn(),
  },
  userQueries: { findUserById: vi.fn() },
}))

vi.mock('../src/db/team-queries.js', () => teamQueries)
vi.mock('../src/db/queries.js', () => userQueries)

import { teamRoutes } from '../src/routes/teams.js'

const USER_ID = '11111111-1111-4111-8111-111111111111'
const INVITER_ID = '22222222-2222-4222-8222-222222222222'
const INVITEE_ID = '33333333-3333-4333-8333-333333333333'

function invitation(overrides: Record<string, unknown> = {}) {
  return {
    id: '44444444-4444-4444-8444-444444444444',
    teamId: '55555555-5555-4555-8555-555555555555',
    inviterId: INVITER_ID,
    inviteeId: null,
    email: 'Invitee@Example.COM',
    token: 'tok-1',
    status: 'pending',
    expiresAt: new Date(Date.now() + 86_400_000),
    createdAt: new Date(),
    ...overrides,
  }
}

describe('团队邀请 accept / reject 的邮箱比对', () => {
  let app: FastifyInstance

  beforeAll(async () => {
    app = Fastify({ logger: false })
    await app.register(teamRoutes, { prefix: '/api/teams' })
    await app.ready()
  })

  beforeEach(() => {
    vi.clearAllMocks()
    authState.userId = USER_ID
    // 非团队成员(走邀请判据分支)
    teamQueries.findTeamMember.mockResolvedValue(undefined)
    teamQueries.acceptInvitation.mockResolvedValue({
      invitation: invitation({ status: 'accepted' }),
    })
    teamQueries.rejectInvitation.mockResolvedValue(invitation({ status: 'rejected' }))
  })

  afterAll(async () => {
    await app.close()
  })

  it('邮箱一致(忽略大小写)→ 可接受', async () => {
    teamQueries.findInvitationByToken.mockResolvedValue(invitation())
    userQueries.findUserById.mockResolvedValue({ id: USER_ID, email: 'invitee@example.com' })

    const res = await app.inject({ method: 'POST', url: '/api/teams/invitations/tok-1/accept' })

    expect(res.statusCode).toBe(200)
    expect(teamQueries.acceptInvitation).toHaveBeenCalledTimes(1)
  })

  it('邮箱不一致 → 403,且不产生入队副作用', async () => {
    teamQueries.findInvitationByToken.mockResolvedValue(invitation())
    userQueries.findUserById.mockResolvedValue({ id: USER_ID, email: 'someone-else@example.com' })

    const res = await app.inject({ method: 'POST', url: '/api/teams/invitations/tok-1/accept' })

    expect(res.statusCode).toBe(403)
    expect(res.json().message).toContain('无权接受该邀请')
    expect(teamQueries.acceptInvitation).not.toHaveBeenCalled()
  })

  it('当前用户无邮箱 → 403(不再"邀请上有邮箱即放行")', async () => {
    teamQueries.findInvitationByToken.mockResolvedValue(invitation())
    userQueries.findUserById.mockResolvedValue({ id: USER_ID, email: null })

    const res = await app.inject({ method: 'POST', url: '/api/teams/invitations/tok-1/accept' })

    expect(res.statusCode).toBe(403)
    expect(teamQueries.acceptInvitation).not.toHaveBeenCalled()
  })

  it('invitee_id 精确命中 → 通过(无需邮箱)', async () => {
    teamQueries.findInvitationByToken.mockResolvedValue(
      invitation({ inviteeId: USER_ID, email: null }),
    )

    const res = await app.inject({ method: 'POST', url: '/api/teams/invitations/tok-1/accept' })

    expect(res.statusCode).toBe(200)
    expect(teamQueries.acceptInvitation).toHaveBeenCalledTimes(1)
  })

  it('reject 同样比对邮箱:不一致 → 403,不替他人拒掉邀请', async () => {
    teamQueries.findInvitationByToken.mockResolvedValue(invitation())
    userQueries.findUserById.mockResolvedValue({ id: USER_ID, email: 'someone-else@example.com' })

    const res = await app.inject({ method: 'POST', url: '/api/teams/invitations/tok-1/reject' })

    expect(res.statusCode).toBe(403)
    expect(res.json().message).toContain('无权拒绝该邀请')
    expect(teamQueries.rejectInvitation).not.toHaveBeenCalled()
  })

  it('reject 邮箱一致 → 200', async () => {
    teamQueries.findInvitationByToken.mockResolvedValue(invitation())
    userQueries.findUserById.mockResolvedValue({ id: USER_ID, email: 'INVITEE@example.com' })

    const res = await app.inject({ method: 'POST', url: '/api/teams/invitations/tok-1/reject' })

    expect(res.statusCode).toBe(200)
    expect(teamQueries.rejectInvitation).toHaveBeenCalledTimes(1)
  })

  it('reject 当前用户无邮箱 → 403', async () => {
    teamQueries.findInvitationByToken.mockResolvedValue(invitation())
    userQueries.findUserById.mockResolvedValue({ id: USER_ID, email: null })

    const res = await app.inject({ method: 'POST', url: '/api/teams/invitations/tok-1/reject' })

    expect(res.statusCode).toBe(403)
    expect(teamQueries.rejectInvitation).not.toHaveBeenCalled()
  })

  it('邀请无邮箱且非 invitee_id → 403(不再只看"有没有邮箱字段")', async () => {
    teamQueries.findInvitationByToken.mockResolvedValue(invitation({ email: null }))
    userQueries.findUserById.mockResolvedValue({ id: USER_ID, email: 'invitee@example.com' })

    const res = await app.inject({ method: 'POST', url: '/api/teams/invitations/tok-1/accept' })

    expect(res.statusCode).toBe(403)
    expect(teamQueries.acceptInvitation).not.toHaveBeenCalled()
  })
})
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
