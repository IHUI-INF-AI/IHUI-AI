import { describe, it, expect, beforeEach } from 'vitest'
import { randomUUID } from 'node:crypto'
import { sql } from 'drizzle-orm'
import { db } from '../src/db/index.js'
import {
  findAgentsList,
  findAgentById,
  createAgent,
  updateAgent,
  deleteAgent,
  findCategoryList,
  findCategoryById,
  findCategoriesByIds,
  findCategoryByAgentId,
  createCategory,
  updateCategory,
  deleteCategory,
  findSettlementList,
  findSettlementSummary,
  findSettlementByOrder,
  createSettlement,
  settleSettlement,
  deleteSettlements,
  findExamineList,
  findExamineStats,
  findExamineById,
  createExamine,
  updateExamine,
  deleteExamine,
  approveExamine,
  rejectExamine,
} from '../src/db/agents-queries.js'

describe('agents-queries — 真实 DB 集成测试', () => {
  beforeEach(async () => {
    await db.execute(sql`DELETE FROM agent_examines`)
    await db.execute(sql`DELETE FROM agent_settlements`)
    await db.execute(sql`DELETE FROM agent_category_links`)
    await db.execute(sql`DELETE FROM agents`)
    await db.execute(sql`DELETE FROM agent_categories`)
  })

  describe('Agents 智能体 CRUD', () => {
    it('createAgent — 默认值(status=pending/isFree=true/price=0/sort=0)', async () => {
      const a = await createAgent({ name: 'A1' })
      expect(a?.name).toBe('A1')
      expect(a?.status).toBe('pending')
      expect(a?.isFree).toBe(true)
      expect(a?.price).toBe(0)
      expect(a?.sort).toBe(0)
    })

    it('findAgentById + findAgentsList(status/categoryId/userId/keyword 过滤 + 分页)', async () => {
      const c = await createCategory({ name: 'Cat1' })
      const a1 = await createAgent({
        name: 'SearchMe',
        status: 'published',
        categoryId: c?.categoryId,
      })
      const _a2 = await createAgent({ name: 'Other', status: 'pending' })
      expect((await findAgentById(a1!.agentId))?.name).toBe('SearchMe')
      // status 过滤
      const r1 = await findAgentsList({ status: 'published' })
      expect(r1.total).toBe(1)
      expect(r1.list[0].name).toBe('SearchMe')
      // keyword 模糊搜索
      const r2 = await findAgentsList({ keyword: 'Search' })
      expect(r2.total).toBe(1)
      // categoryId 过滤
      const r3 = await findAgentsList({ categoryId: c!.categoryId })
      expect(r3.total).toBe(1)
      // 分页
      const r4 = await findAgentsList({ page: 1, pageSize: 1 })
      expect(r4.list).toHaveLength(1)
      expect(r4.total).toBe(2)
    })

    it('updateAgent — published 时自动填充 publishedAt', async () => {
      const a = await createAgent({ name: 'Pub' })
      expect(a?.publishedAt).toBeNull()
      const updated = await updateAgent(a!.agentId, { status: 'published' })
      expect(updated?.status).toBe('published')
      expect(updated?.publishedAt).toBeInstanceOf(Date)
    })

    it('updateAgent — 显式 publishedAt 不会被覆盖', async () => {
      const a = await createAgent({ name: 'Pub' })
      const custom = new Date('2025-01-01')
      const updated = await updateAgent(a!.agentId, { status: 'published', publishedAt: custom })
      expect(updated?.publishedAt).toEqual(custom)
    })

    it('deleteAgent — 返回被删记录 + 再查不到', async () => {
      const a = await createAgent({ name: 'Del' })
      const deleted = await deleteAgent(a!.agentId)
      expect(deleted?.agentId).toBe(a!.agentId)
      expect(await findAgentById(a!.agentId)).toBeUndefined()
    })
  })

  describe('Categories 分类 CRUD', () => {
    it('createCategory — 默认值(status=1/isPaid=false/sort=0)', async () => {
      const c = await createCategory({ name: 'Cat' })
      expect(c?.name).toBe('Cat')
      expect(c?.status).toBe('1') // varchar(1)
      expect(c?.isPaid).toBe(false)
      expect(c?.sort).toBe(0)
    })

    it('findCategoryById + findCategoryList(status/isPaid/keyword 过滤)', async () => {
      await createCategory({ name: 'Free1', isPaid: false, status: '1' })
      await createCategory({ name: 'Paid1', isPaid: true, status: '1' })
      await createCategory({ name: 'Disabled', status: '0' })
      const r1 = await findCategoryList({})
      expect(r1.total).toBe(3)
      const r2 = await findCategoryList({ status: '1' })
      expect(r2.total).toBe(2)
      const r3 = await findCategoryList({ isPaid: true })
      expect(r3.total).toBe(1)
      expect(r3.list[0].name).toBe('Paid1')
      const r4 = await findCategoryList({ keyword: 'Free' })
      expect(r4.total).toBe(1)
      expect((await findCategoryById(r1.list[0].categoryId))?.name).toBeTruthy()
    })

    it('findCategoriesByIds — 空数组返回空', async () => {
      expect(await findCategoriesByIds([])).toEqual([])
      const c = await createCategory({ name: 'C' })
      const list = await findCategoriesByIds([c!.categoryId])
      expect(list).toHaveLength(1)
    })

    it('findCategoryByAgentId — innerJoin 查智能体所属分类', async () => {
      const c = await createCategory({ name: 'AgentCat' })
      const a = await createAgent({ name: 'A', categoryId: c?.categoryId })
      const found = await findCategoryByAgentId(a!.agentId)
      expect(found?.name).toBe('AgentCat')
      // 无分类的智能体返回 undefined
      const a2 = await createAgent({ name: 'NoCat' })
      expect(await findCategoryByAgentId(a2!.agentId)).toBeUndefined()
    })

    it('updateCategory + deleteCategory', async () => {
      const c = await createCategory({ name: 'Old' })
      const updated = await updateCategory(c!.categoryId, { name: 'New', isPaid: true })
      expect(updated?.name).toBe('New')
      expect(updated?.isPaid).toBe(true)
      await deleteCategory(c!.categoryId)
      expect(await findCategoryById(c!.categoryId)).toBeUndefined()
    })
  })

  describe('Settlements 结算', () => {
    it('createSettlement — 默认 status=unsettled', async () => {
      const s = await createSettlement({ amount: 1000, commissionRate: 10, commissionAmount: 100 })
      expect(s?.status).toBe('unsettled')
      expect(s?.amount).toBe(1000)
      expect(s?.commissionAmount).toBe(100)
    })

    it('findSettlementList(agentId/status/orderNo 过滤)', async () => {
      const agent1 = randomUUID()
      const agent2 = randomUUID()
      await createSettlement({
        agentId: agent1,
        orderNo: 'ORD001',
        amount: 100,
        status: 'unsettled',
      })
      await createSettlement({ agentId: agent2, orderNo: 'ORD002', amount: 200, status: 'settled' })
      const r1 = await findSettlementList({})
      expect(r1.total).toBe(2)
      const r2 = await findSettlementList({ status: 'settled' })
      expect(r2.total).toBe(1)
      expect(r2.list[0].orderNo).toBe('ORD002')
      const r3 = await findSettlementList({ agentId: agent1 })
      expect(r3.total).toBe(1)
      const r4 = await findSettlementList({ orderNo: 'ORD001' })
      expect(r4.total).toBe(1)
    })

    it('findSettlementSummary — 汇总 totalAmount/settledAmount/unsettledAmount', async () => {
      await createSettlement({ amount: 100, status: 'settled' })
      await createSettlement({ amount: 200, status: 'unsettled' })
      await createSettlement({ amount: 300, status: 'unsettled' })
      const s = await findSettlementSummary()
      expect(s.totalAmount).toBe(600)
      expect(s.settledAmount).toBe(100)
      expect(s.unsettledAmount).toBe(500)
      expect(s.totalCount).toBe(3)
      expect(s.settledCount).toBe(1)
      expect(s.unsettledCount).toBe(2)
    })

    it('findSettlementByOrder — 按订单号汇总', async () => {
      await createSettlement({ orderNo: 'ORD-A', amount: 100, commissionAmount: 10 })
      await createSettlement({ orderNo: 'ORD-A', amount: 200, commissionAmount: 20 })
      await createSettlement({ orderNo: 'ORD-B', amount: 500, commissionAmount: 50 })
      const r1 = await findSettlementByOrder('ORD-A')
      expect(r1.totalAmount).toBe(300)
      expect(r1.commissionAmount).toBe(30)
      expect(r1.count).toBe(2)
      const r2 = await findSettlementByOrder('NOT-EXIST')
      expect(r2.totalAmount).toBe(0)
      expect(r2.count).toBe(0)
    })

    it('settleSettlement — 置为 settled + 写入 settledAt', async () => {
      const s = await createSettlement({ amount: 100, status: 'unsettled' })
      const settled = await settleSettlement(s!.id)
      expect(settled?.status).toBe('settled')
      expect(settled?.settledAt).toBeInstanceOf(Date)
    })

    it('deleteSettlements — 批量删除返回数量 + 空数组返回 0', async () => {
      const s1 = await createSettlement({ amount: 100 })
      const s2 = await createSettlement({ amount: 200 })
      expect(await deleteSettlements([])).toBe(0)
      expect(await deleteSettlements([s1!.id, s2!.id])).toBe(2)
      expect((await findSettlementList({})).total).toBe(0)
    })
  })

  describe('Examines 审核', () => {
    it('createExamine — 默认 status=pending', async () => {
      const agentId = randomUUID()
      const userId = randomUUID()
      const e = await createExamine({ agentId, userId })
      expect(e?.status).toBe('pending')
      expect(e?.agentId).toBe(agentId)
    })

    it('findExamineList(agentId/userId/status 过滤)', async () => {
      const a1 = randomUUID()
      const a2 = randomUUID()
      const u1 = randomUUID()
      const u2 = randomUUID()
      await createExamine({ agentId: a1, userId: u1, status: 'pending' })
      await createExamine({ agentId: a2, userId: u2, status: 'approved' })
      const r1 = await findExamineList({})
      expect(r1.total).toBe(2)
      const r2 = await findExamineList({ status: 'approved' })
      expect(r2.total).toBe(1)
      const r3 = await findExamineList({ agentId: a1 })
      expect(r3.total).toBe(1)
      const r4 = await findExamineList({ userId: u2 })
      expect(r4.total).toBe(1)
    })

    it('findExamineStats — 各状态计数', async () => {
      await createExamine({ status: 'pending' })
      await createExamine({ status: 'pending' })
      await createExamine({ status: 'approved' })
      await createExamine({ status: 'rejected' })
      const s = await findExamineStats()
      expect(s.totalCount).toBe(4)
      expect(s.pendingCount).toBe(2)
      expect(s.approvedCount).toBe(1)
      expect(s.rejectedCount).toBe(1)
    })

    it('findExamineById + updateExamine + deleteExamine', async () => {
      const e = await createExamine({ agentId: randomUUID(), userId: randomUUID() })
      expect((await findExamineById(e!.id))?.id).toBe(e!.id)
      const updated = await updateExamine(e!.id, { status: 'approved', reason: 'ok' })
      expect(updated?.status).toBe('approved')
      expect(updated?.reason).toBe('ok')
      await deleteExamine(e!.id)
      expect(await findExamineById(e!.id)).toBeUndefined()
    })

    it('approveExamine — 置为 approved + 记录 reviewerId + reviewedAt', async () => {
      const e = await createExamine({ agentId: randomUUID(), userId: randomUUID() })
      const reviewerId = randomUUID()
      const approved = await approveExamine(e!.id, reviewerId)
      expect(approved?.status).toBe('approved')
      expect(approved?.reviewerId).toBe(reviewerId)
      expect(approved?.reviewedAt).toBeInstanceOf(Date)
    })

    it('rejectExamine — 置为 rejected + 记录 reason', async () => {
      const e = await createExamine({ agentId: randomUUID(), userId: randomUUID() })
      const reviewerId = randomUUID()
      const rejected = await rejectExamine(e!.id, reviewerId, '内容不合规')
      expect(rejected?.status).toBe('rejected')
      expect(rejected?.reason).toBe('内容不合规')
      expect(rejected?.reviewerId).toBe(reviewerId)
    })
  })
})
