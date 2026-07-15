import { describe, it, expect, beforeEach } from 'vitest'
import { sql } from 'drizzle-orm'
import { randomUUID } from 'node:crypto'
import { db } from '../src/db/index.js'
import { users } from '@ihui/database'
import {
  findCategories,
  findCategoryBySlug,
  createCategory,
  createTicket,
  findTicketById,
  findTickets,
  transitionTicket,
  assignTicket,
  updateTicket,
  deleteTicket,
  createComment,
  findCommentsByTicket,
  findAgents,
  findAgentById,
  findAgentByUserId,
  createAgent,
  updateAgentStatus,
  pickAvailableAgent,
  adjustAgentLoad,
  findSessionBySessionId,
  findWaitingSessions,
  findActiveSessionsByAgent,
  createSession,
  assignSession,
  closeSession,
  createRating,
  findRatingByTicket,
  genTicketNo,
  genSessionId,
} from '../src/db/customer-service-queries.js'

async function seedUser() {
  const [u] = await db
    .insert(users)
    .values({ email: `cs-${randomUUID().slice(0, 8)}@test.com`, nickname: 'CS-Tester' })
    .returning()
  return u
}

describe('customer-service-queries — 真实 DB 集成测试', () => {
  beforeEach(async () => {
    await db.execute(sql`DELETE FROM customer_service_ratings`)
    await db.execute(sql`DELETE FROM customer_service_comments`)
    await db.execute(sql`DELETE FROM customer_service_sessions`)
    await db.execute(sql`DELETE FROM customer_service_tickets`)
    await db.execute(sql`DELETE FROM customer_service_agents`)
    await db.execute(sql`DELETE FROM customer_service_categories`)
    await db.execute(sql`DELETE FROM users`)
  })

  describe('Helpers', () => {
    it('genTicketNo 格式 CS + 时间戳 + uuid', () => {
      const no = genTicketNo()
      expect(no).toMatch(/^CS\d{14}[A-F0-9]{6}$/)
    })

    it('genSessionId 格式 SESS + uuid 前 16 位', () => {
      const id = genSessionId()
      expect(id).toMatch(/^SESS[A-F0-9]{16}$/)
    })
  })

  describe('Categories', () => {
    it('createCategory + findCategories + findCategoryBySlug', async () => {
      await createCategory({ name: 'B', slug: 'cat-b', sortOrder: 2 })
      await createCategory({ name: 'A', slug: 'cat-a', sortOrder: 1 })

      const list = await findCategories()
      expect(list).toHaveLength(2)
      expect(list[0].name).toBe('A') // sortOrder 升序

      const found = await findCategoryBySlug('cat-a')
      expect(found?.name).toBe('A')
      expect(await findCategoryBySlug('not-exist')).toBeUndefined()
    })
  })

  describe('Tickets', () => {
    it('createTicket + findTicketById + findTickets + updateTicket + deleteTicket', async () => {
      const userId = (await seedUser()).id
      const t = await createTicket({
        userId,
        title: 'Ticket1',
        description: 'desc',
        priority: 'high',
      })
      expect(t.ticketNo).toMatch(/^CS/)
      expect(t.status).toBe('pending')
      expect(t.priority).toBe('high')
      expect(t.source).toBe('web')

      const found = await findTicketById(t.id)
      expect(found?.title).toBe('Ticket1')

      const list = await findTickets({ page: 1, pageSize: 10 })
      expect(list.total).toBe(1)

      const byUser = await findTickets({ page: 1, pageSize: 10, userId })
      expect(byUser.total).toBe(1)

      const byStatus = await findTickets({ page: 1, pageSize: 10, status: 'open' })
      expect(byStatus.total).toBe(0)

      const updated = await updateTicket(t.id, { title: 'Updated', priority: 'low' })
      expect(updated?.title).toBe('Updated')
      expect(updated?.priority).toBe('low')

      await deleteTicket(t.id)
      expect(await findTicketById(t.id)).toBeUndefined()
    })

    it('transitionTicket 状态流转合法/非法', async () => {
      const userId = (await seedUser()).id
      const t = await createTicket({ userId, title: 'T', description: 'd' })

      // pending → open (合法)
      const r1 = await transitionTicket(t.id, 'open')
      expect(r1.ticket?.status).toBe('open')

      // open → resolved (合法)
      const r2 = await transitionTicket(t.id, 'resolved')
      expect(r2.ticket?.status).toBe('resolved')
      expect(r2.ticket?.resolvedAt).toBeTruthy()

      // resolved → closed (合法)
      const r3 = await transitionTicket(t.id, 'closed')
      expect(r3.ticket?.status).toBe('closed')
      expect(r3.ticket?.closedAt).toBeTruthy()

      // closed → pending (非法)
      const r4 = await transitionTicket(t.id, 'pending')
      expect(r4.reason).toBe('invalid_transition')
    })

    it('transitionTicket 不存在的工单', async () => {
      const r = await transitionTicket(randomUUID(), 'open')
      expect(r.reason).toBe('not_found')
    })

    it('assignTicket 分配并自动推进状态', async () => {
      const userId = (await seedUser()).id
      const agent1 = await createAgent({ userId: (await seedUser()).id, nickname: 'A1' })
      const t = await createTicket({ userId, title: 'T', description: 'd' })
      expect(t.status).toBe('pending')

      const r = await assignTicket(t.id, agent1.id)
      expect(r.ticket?.assigneeId).toBe(agent1.id)
      expect(r.ticket?.status).toBe('open') // pending → open

      // 已分配的工单再分配,状态不变
      const agent2 = await createAgent({ userId: (await seedUser()).id, nickname: 'A2' })
      const r2 = await assignTicket(t.id, agent2.id)
      expect(r2.ticket?.status).toBe('open')
    })
  })

  describe('Comments', () => {
    it('createComment + findCommentsByTicket + 更新工单 updatedAt', async () => {
      const userId = (await seedUser()).id
      const t = await createTicket({ userId, title: 'T', description: 'd' })
      const originalUpdatedAt = t.updatedAt

      await new Promise((r) => setTimeout(r, 10))
      const c = await createComment({ ticketId: t.id, userId, content: 'comment1' })
      expect(c.content).toBe('comment1')
      expect(c.isAdmin).toBe(false)

      await createComment({ ticketId: t.id, userId, content: 'comment2', isAdmin: true })

      const list = await findCommentsByTicket(t.id)
      expect(list).toHaveLength(2)
      expect(list[0].content).toBe('comment1') // createdAt 升序

      // 工单 updatedAt 被更新
      const ticket = await findTicketById(t.id)
      expect(ticket!.updatedAt.getTime()).toBeGreaterThan(originalUpdatedAt.getTime())
    })
  })

  describe('Agents', () => {
    it('createAgent + findAgents + findAgentById + findAgentByUserId + updateAgentStatus', async () => {
      const userId = (await seedUser()).id
      const a = await createAgent({ userId, nickname: 'Agent1', maxConcurrent: 3 })
      expect(a.status).toBe('offline')
      expect(a.maxConcurrent).toBe(3)

      const list = await findAgents()
      expect(list).toHaveLength(1)

      const byId = await findAgentById(a.id)
      expect(byId?.nickname).toBe('Agent1')

      const byUser = await findAgentByUserId(userId)
      expect(byUser?.id).toBe(a.id)

      const updated = await updateAgentStatus(a.id, 'online')
      expect(updated?.status).toBe('online')

      const onlineList = await findAgents('online')
      expect(onlineList).toHaveLength(1)
    })

    it('pickAvailableAgent + adjustAgentLoad', async () => {
      // 无在线坐席
      expect(await pickAvailableAgent()).toBeUndefined()

      const a1 = await createAgent({
        userId: (await seedUser()).id,
        nickname: 'A1',
        maxConcurrent: 2,
      })
      await updateAgentStatus(a1.id, 'online')
      // currentLoad=0 < maxConcurrent=2,可被选中
      const picked = await pickAvailableAgent()
      expect(picked?.id).toBe(a1.id)

      // 增加负载到 maxConcurrent
      await adjustAgentLoad(a1.id, 2)
      const a1Refresh = await findAgentById(a1.id)
      expect(a1Refresh?.currentLoad).toBe(2)
      // 现在 currentLoad=2 = maxConcurrent=2,不再可用
      expect(await pickAvailableAgent()).toBeUndefined()

      // 减少负载
      await adjustAgentLoad(a1.id, -1)
      const picked2 = await pickAvailableAgent()
      expect(picked2?.id).toBe(a1.id)

      // 负载不会为负
      await adjustAgentLoad(a1.id, -100)
      const a1Final = await findAgentById(a1.id)
      expect(a1Final?.currentLoad).toBe(0)
    })
  })

  describe('Sessions', () => {
    it('createSession + findSessionBySessionId + findWaitingSessions + assignSession + closeSession', async () => {
      const userId = (await seedUser()).id
      const s = await createSession({ userId })
      expect(s.status).toBe('waiting')
      expect(s.queuePosition).toBe(1)

      // 第二个会话排队位置 = 2
      const s2 = await createSession({ userId })
      expect(s2.queuePosition).toBe(2)

      const found = await findSessionBySessionId(s.sessionId)
      expect(found?.id).toBe(s.id)

      const waiting = await findWaitingSessions()
      expect(waiting).toHaveLength(2)
      expect(waiting[0].id).toBe(s.id) // queuePosition 升序

      // 分配坐席
      const agent = await createAgent({ userId: (await seedUser()).id, nickname: 'Agent' })
      await updateAgentStatus(agent.id, 'online')
      const assignResult = await assignSession(s.sessionId, agent.id)
      expect(assignResult.session?.status).toBe('active')
      expect(assignResult.session?.agentId).toBe(agent.id)
      expect(assignResult.session?.startedAt).toBeTruthy()

      // 坐席负载增加
      const agentRefresh = await findAgentById(agent.id)
      expect(agentRefresh?.currentLoad).toBe(1)

      // 活跃会话
      const active = await findActiveSessionsByAgent(agent.id)
      expect(active).toHaveLength(1)

      // 已分配的会话不能再分配
      const r2 = await assignSession(s.sessionId, agent.id)
      expect(r2.reason).toBe('not_waiting')

      // 关闭会话
      const closed = await closeSession(s.sessionId)
      expect(closed?.status).toBe('closed')
      expect(closed?.endedAt).toBeTruthy()

      // 坐席负载减少
      const agentFinal = await findAgentById(agent.id)
      expect(agentFinal?.currentLoad).toBe(0)
    })

    it('assignSession 不存在的会话', async () => {
      const r = await assignSession('SESS_NOT_EXIST', randomUUID())
      expect(r.reason).toBe('not_found')
    })
  })

  describe('Ratings', () => {
    it('createRating + findRatingByTicket', async () => {
      const userId = (await seedUser()).id
      const t = await createTicket({ userId, title: 'T', description: 'd' })
      const agent = await createAgent({ userId: (await seedUser()).id, nickname: 'A' })

      const r = await createRating({
        ticketId: t.id,
        userId,
        agentId: agent.id,
        rating: 5,
        comment: 'great',
      })
      expect(r.rating).toBe(5)

      const found = await findRatingByTicket(t.id)
      expect(found?.id).toBe(r.id)
      expect(found?.comment).toBe('great')

      expect(await findRatingByTicket(randomUUID())).toBeUndefined()
    })
  })
})
