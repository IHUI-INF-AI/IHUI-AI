import { describe, it, expect, beforeEach } from 'vitest'
import { sql, eq } from 'drizzle-orm'
import { randomUUID } from 'node:crypto'
import { db } from '../src/db/index.js'
import { users, examPapers, examRecords } from '@ihui/database'
import {
  findChapterList,
  findChapterById,
  createChapter,
  updateChapter,
  deleteChapter,
  findSectionList,
  findSectionById,
  createSection,
  updateSection,
  deleteSection,
  updateChapterSortOrder,
  updateSectionSortOrder,
  findSignupList,
  createSignup,
  deleteSignup,
  findMarkRecordList,
} from '../src/db/exam-extended-queries.js'

async function seedUser() {
  const [u] = await db
    .insert(users)
    .values({ email: `t-${randomUUID().slice(0, 8)}@test.com`, nickname: 'Tester' })
    .returning()
  return u
}

async function seedPaper(title = 'Paper') {
  const [p] = await db.insert(examPapers).values({ title }).returning()
  return p
}

describe('exam-extended-queries — 真实 DB 集成测试', () => {
  beforeEach(async () => {
    await db.execute(sql`DELETE FROM exam_chapter_sections`)
    await db.execute(sql`DELETE FROM exam_chapters`)
    await db.execute(sql`DELETE FROM exam_signups`)
    await db.execute(sql`DELETE FROM exam_records`)
    await db.execute(sql`DELETE FROM exam_papers`)
    await db.execute(sql`DELETE FROM users WHERE is_system_admin = false`)
  })

  describe('Chapters', () => {
    it('createChapter + findChapterList + findChapterById + updateChapter + deleteChapter', async () => {
      const paper = await seedPaper()
      const c1 = await createChapter({ paperId: paper.id, title: 'Ch2', sort: 2 })
      await createChapter({ paperId: paper.id, title: 'Ch1', sort: 1 })

      const list = await findChapterList(paper.id)
      expect(list).toHaveLength(2)
      expect(list[0].title).toBe('Ch1') // sort 升序

      const found = await findChapterById(c1.id)
      expect(found?.title).toBe('Ch2')

      const updated = await updateChapter(c1.id, { title: 'Ch-updated', sort: 5 })
      expect(updated?.title).toBe('Ch-updated')
      expect(updated?.sort).toBe(5)

      await deleteChapter(c1.id)
      expect(await findChapterById(c1.id)).toBeUndefined()
    })

    it('updateChapterSortOrder 批量排序', async () => {
      const paper = await seedPaper()
      const c1 = await createChapter({ paperId: paper.id, title: 'A', sort: 1 })
      const c2 = await createChapter({ paperId: paper.id, title: 'B', sort: 2 })
      const c3 = await createChapter({ paperId: paper.id, title: 'C', sort: 3 })

      await updateChapterSortOrder([
        { id: c1.id, sort: 3 },
        { id: c2.id, sort: 1 },
        { id: c3.id, sort: 2 },
      ])

      const list = await findChapterList(paper.id)
      expect(list[0].id).toBe(c2.id)
      expect(list[1].id).toBe(c3.id)
      expect(list[2].id).toBe(c1.id)
    })
  })

  describe('Sections', () => {
    it('createSection + findSectionList + findSectionById + updateSection + deleteSection', async () => {
      const paper = await seedPaper()
      const chapter = await createChapter({ paperId: paper.id, title: 'Ch1' })
      const s1 = await createSection({
        chapterId: chapter.id,
        title: 'Sec2',
        sort: 2,
        questionIds: ['q1', 'q2'],
      })
      await createSection({ chapterId: chapter.id, title: 'Sec1', sort: 1 })

      const list = await findSectionList(chapter.id)
      expect(list).toHaveLength(2)
      expect(list[0].title).toBe('Sec1')

      const found = await findSectionById(s1.id)
      expect(found?.title).toBe('Sec2')
      expect(found?.questionIds).toEqual(['q1', 'q2'])

      const updated = await updateSection(s1.id, { title: 'Sec-updated', questionIds: ['q3'] })
      expect(updated?.title).toBe('Sec-updated')
      expect(updated?.questionIds).toEqual(['q3'])

      await deleteSection(s1.id)
      expect(await findSectionById(s1.id)).toBeUndefined()
    })

    it('updateSectionSortOrder 批量排序', async () => {
      const paper = await seedPaper()
      const chapter = await createChapter({ paperId: paper.id, title: 'Ch' })
      const s1 = await createSection({ chapterId: chapter.id, title: 'A', sort: 1 })
      const s2 = await createSection({ chapterId: chapter.id, title: 'B', sort: 2 })

      await updateSectionSortOrder([
        { id: s1.id, sort: 2 },
        { id: s2.id, sort: 1 },
      ])

      const list = await findSectionList(chapter.id)
      expect(list[0].id).toBe(s2.id)
      expect(list[1].id).toBe(s1.id)
    })
  })

  describe('Signups', () => {
    it('createSignup + findSignupList + deleteSignup', async () => {
      const paper = await seedPaper()
      const u = await seedUser()
      const s = await createSignup({ paperId: paper.id, userId: u.id })
      expect(s.status).toBe('pending')

      const list = await findSignupList({ paperId: paper.id })
      expect(list).toHaveLength(1)

      const byUser = await findSignupList({ userId: u.id })
      expect(byUser).toHaveLength(1)

      await deleteSignup(s.id)
      expect(await findSignupList({ paperId: paper.id })).toHaveLength(0)
    })

    it('findSignupList 多条件筛选', async () => {
      const paper1 = await seedPaper('P1')
      const paper2 = await seedPaper('P2')
      const u1 = await seedUser()
      const u2 = await seedUser()

      await createSignup({ paperId: paper1.id, userId: u1.id })
      await createSignup({ paperId: paper1.id, userId: u2.id })
      await createSignup({ paperId: paper2.id, userId: u1.id })

      expect(await findSignupList({ paperId: paper1.id })).toHaveLength(2)
      expect(await findSignupList({ paperId: paper2.id })).toHaveLength(1)
      expect(await findSignupList({ userId: u1.id })).toHaveLength(2)
      expect(await findSignupList({ userId: u2.id })).toHaveLength(1)
      expect(await findSignupList({ paperId: paper1.id, userId: u1.id })).toHaveLength(1)
    })
  })

  describe('Mark Records', () => {
    it('findMarkRecordList — 仅返回 status=pending,含 paperTitle 和 nickname', async () => {
      const paper = await seedPaper('Math Exam')
      const u = await seedUser()
      const [r] = await db
        .insert(examRecords)
        .values({
          paperId: paper.id,
          userId: u.id,
          status: 'pending',
          score: '0.00',
        })
        .returning()

      const result = await findMarkRecordList({ page: 1, pageSize: 10 })
      expect(result.total).toBe(1)
      expect(result.list[0].paperTitle).toBe('Math Exam')
      expect(result.list[0].nickname).toBe('Tester')

      // 已评分的不返回
      await db.update(examRecords).set({ status: 'graded' }).where(eq(examRecords.id, r.id))

      const result2 = await findMarkRecordList({ page: 1, pageSize: 10 })
      expect(result2.total).toBe(0)
    })

    it('findMarkRecordList — paperId 筛选', async () => {
      const paper1 = await seedPaper('P1')
      const paper2 = await seedPaper('P2')
      const u = await seedUser()

      await db.insert(examRecords).values({
        paperId: paper1.id,
        userId: u.id,
        status: 'pending',
        score: '0.00',
      })
      await db.insert(examRecords).values({
        paperId: paper2.id,
        userId: u.id,
        status: 'pending',
        score: '0.00',
      })

      const result = await findMarkRecordList({ page: 1, pageSize: 10, paperId: paper1.id })
      expect(result.total).toBe(1)
    })
  })
})
