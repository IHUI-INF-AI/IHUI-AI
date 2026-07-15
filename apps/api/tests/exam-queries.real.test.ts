import { describe, it, expect, beforeEach } from 'vitest'
import { sql } from 'drizzle-orm'
import { db } from '../src/db/index.js'
import { users } from '@ihui/database'
import {
  findPublishedExamCategories,
  findAllExamCategories,
  findExamCategoryById,
  createExamCategory,
  updateExamCategory,
  deleteExamCategory,
  findPublishedPapers,
  findAllPapers,
  findPaperById,
  createPaper,
  updatePaper,
  deletePaper,
  findQuestionsByPaperId,
  findQuestionById,
  createQuestion,
  updateQuestion,
  deleteQuestion,
  findMyExamRecords,
  findExamRecordById,
  createExamRecord,
  deleteExamRecord,
} from '../src/db/exam-queries.js'

async function createTestUser(phone: string) {
  const [row] = await db.insert(users).values({ phone }).returning()
  return row
}

describe('exam-queries — 真实 DB 集成测试', () => {
  beforeEach(async () => {
    await db.execute(sql`DELETE FROM exam_records`)
    await db.execute(sql`DELETE FROM exam_questions`)
    await db.execute(sql`DELETE FROM exam_papers`)
    await db.execute(sql`DELETE FROM exam_categories`)
    await db.execute(sql`DELETE FROM users`)
  })

  describe('分类 CRUD', () => {
    it('createExamCategory + findExamCategoryById + findAllExamCategories(按 sort 升序)', async () => {
      const c1 = await createExamCategory({ name: 'Cat1', sort: 2 })
      const _c2 = await createExamCategory({ name: 'Cat2', sort: 1 })
      expect(c1.name).toBe('Cat1')
      expect(c1.status).toBe(1) // 默认
      expect((await findExamCategoryById(c1.id))?.name).toBe('Cat1')
      const all = await findAllExamCategories()
      expect(all).toHaveLength(2)
      expect(all[0].name).toBe('Cat2') // sort=1 在前
    })

    it('findPublishedExamCategories — 仅 status=1', async () => {
      await createExamCategory({ name: 'Active', status: 1 })
      await createExamCategory({ name: 'Disabled', status: 0 })
      const list = await findPublishedExamCategories()
      expect(list).toHaveLength(1)
      expect(list[0].name).toBe('Active')
    })

    it('updateExamCategory + deleteExamCategory', async () => {
      const c = await createExamCategory({ name: 'Old', sort: 1 })
      const updated = await updateExamCategory(c.id, { name: 'New', status: 0 })
      expect(updated?.name).toBe('New')
      expect(updated?.status).toBe(0)
      await deleteExamCategory(c.id)
      expect(await findExamCategoryById(c.id)).toBeUndefined()
    })
  })

  describe('试卷 CRUD', () => {
    it('createPaper — 默认值(isPublished=false/paperType=normal/duration=60/totalScore=100)', async () => {
      const p = await createPaper({ title: 'P1' })
      expect(p.title).toBe('P1')
      expect(p.isPublished).toBe(false)
      expect(p.paperType).toBe('normal')
      expect(p.duration).toBe(60)
      expect(p.totalScore).toBe('100.00') // numeric(6,2) 保留 2 位小数
      expect(p.questionCount).toBe(0)
    })

    it('findPaperById + findAllPapers(含未发布)', async () => {
      const p1 = await createPaper({ title: 'Published', isPublished: true })
      const _p2 = await createPaper({ title: 'Draft', isPublished: false })
      expect((await findPaperById(p1.id))?.title).toBe('Published')
      const all = await findAllPapers({ page: 1, pageSize: 10 })
      expect(all.total).toBe(2)
    })

    it('findPublishedPapers — 仅 isPublished=true + search 模糊搜索 + categoryId 过滤', async () => {
      const c = await createExamCategory({ name: 'Cat' })
      await createPaper({ title: 'Java 基础', isPublished: true, categoryId: c.id })
      await createPaper({ title: 'Python 入门', isPublished: true })
      await createPaper({ title: 'Draft', isPublished: false })
      const r1 = await findPublishedPapers({ page: 1, pageSize: 10 })
      expect(r1.total).toBe(2)
      const r2 = await findPublishedPapers({ page: 1, pageSize: 10, search: 'Java' })
      expect(r2.total).toBe(1)
      expect(r2.list[0].title).toBe('Java 基础')
      const r3 = await findPublishedPapers({ page: 1, pageSize: 10, categoryId: c.id })
      expect(r3.total).toBe(1)
      // PaperWithCategory 附带 categoryName
      expect(r3.list[0].categoryName).toBe('Cat')
    })

    it('updatePaper + deletePaper(级联删除题目)', async () => {
      const p = await createPaper({ title: 'Old' })
      await createQuestion(p.id, { type: 'single_choice', title: 'Q1' })
      const updated = await updatePaper(p.id, { title: 'New', isPublished: true })
      expect(updated?.title).toBe('New')
      expect(updated?.isPublished).toBe(true)
      await deletePaper(p.id)
      expect(await findPaperById(p.id)).toBeUndefined()
      // 题目应级联删除
      expect(await findQuestionsByPaperId(p.id)).toHaveLength(0)
    })
  })

  describe('题目 CRUD', () => {
    it('createQuestion + findQuestionById + findQuestionsByPaperId(按 sortOrder 升序)', async () => {
      const p = await createPaper({ title: 'P' })
      const q1 = await createQuestion(p.id, {
        type: 'single_choice',
        title: 'Q1',
        sortOrder: 2,
        options: [{ key: 'A', text: 'optA' }],
      })
      const _q2 = await createQuestion(p.id, { type: 'multi_choice', title: 'Q2', sortOrder: 1 })
      expect(q1.type).toBe('single_choice')
      expect(q1.options).toEqual([{ key: 'A', text: 'optA' }])
      expect((await findQuestionById(q1.id))?.title).toBe('Q1')
      const list = await findQuestionsByPaperId(p.id)
      expect(list).toHaveLength(2)
      expect(list[0].title).toBe('Q2') // sortOrder=1 在前
    })

    it('createQuestion — 自动同步 questionCount 到试卷', async () => {
      const p = await createPaper({ title: 'P' })
      await createQuestion(p.id, { type: 'single_choice', title: 'Q1' })
      await createQuestion(p.id, { type: 'single_choice', title: 'Q2' })
      const refreshed = await findPaperById(p.id)
      expect(refreshed?.questionCount).toBe(2)
    })

    it('updateQuestion + deleteQuestion(删除后同步 questionCount)', async () => {
      const p = await createPaper({ title: 'P' })
      const q = await createQuestion(p.id, { type: 'single_choice', title: 'Old', score: '5' })
      const updated = await updateQuestion(q.id, { title: 'New', score: '10' })
      expect(updated?.title).toBe('New')
      expect(updated?.score).toBe('10.00') // numeric(6,2)
      await deleteQuestion(q.id)
      expect(await findQuestionById(q.id)).toBeUndefined()
      const refreshed = await findPaperById(p.id)
      expect(refreshed?.questionCount).toBe(0) // 同步更新
    })
  })

  describe('答题记录', () => {
    it('createExamRecord — 默认 status=pending + isPassed=false', async () => {
      const u = await createTestUser('13800000001')
      const p = await createPaper({ title: 'P' })
      const r = await createExamRecord(p.id, u.id)
      expect(r.status).toBe('pending')
      expect(r.isPassed).toBe(false)
      expect(r.score).toBe('0.00') // numeric(6,2)
      expect(r.userId).toBe(u.id)
      expect(r.paperId).toBe(p.id)
    })

    it('findExamRecordById + findMyExamRecords(分页)', async () => {
      const u = await createTestUser('13800000002')
      const p = await createPaper({ title: 'P' })
      const r1 = await createExamRecord(p.id, u.id)
      const _r2 = await createExamRecord(p.id, u.id)
      expect((await findExamRecordById(r1.id))?.id).toBe(r1.id)
      const result = await findMyExamRecords(u.id, { page: 1, pageSize: 10 })
      expect(result.total).toBe(2)
      const page1 = await findMyExamRecords(u.id, { page: 1, pageSize: 1 })
      expect(page1.list).toHaveLength(1)
      expect(page1.total).toBe(2)
    })

    it('deleteExamRecord + 隔离用户', async () => {
      const u1 = await createTestUser('13800000003')
      const u2 = await createTestUser('13800000004')
      const p = await createPaper({ title: 'P' })
      const r1 = await createExamRecord(p.id, u1.id)
      await createExamRecord(p.id, u2.id)
      const u1Records = await findMyExamRecords(u1.id, { page: 1, pageSize: 10 })
      expect(u1Records.total).toBe(1)
      await deleteExamRecord(r1.id)
      const u1After = await findMyExamRecords(u1.id, { page: 1, pageSize: 10 })
      expect(u1After.total).toBe(0)
    })
  })
})
