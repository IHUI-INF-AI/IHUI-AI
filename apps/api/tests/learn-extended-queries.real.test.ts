import { describe, it, expect, beforeEach } from 'vitest'
import { sql } from 'drizzle-orm'
import { randomUUID } from 'node:crypto'
import { db } from '../src/db/index.js'
import { users, lessons, learnInvoiceApplications } from '@ihui/database'
import {
  findHomeworkList,
  findHomeworkById,
  createHomework,
  updateHomework,
  deleteHomework,
  findMapList,
  findMapById,
  createMap,
  updateMap,
  deleteMap,
  publishMap,
  findInvoiceApplicationList,
  findInvoiceApplicationById,
  updateInvoiceApplicationStatus,
  findInvoiceTitleList,
  findInvoiceTitleById,
  createInvoiceTitle,
  updateInvoiceTitle,
  deleteInvoiceTitle,
  findAllTopics,
  findTopicRowById,
  createTopicRow,
  updateTopicRow,
  deleteTopicRow,
  findMapListPaged,
  findPublishedMaps,
  findMapTopics,
  setMapTopics,
  findTasksByLesson,
  createTask,
  updateTask,
  deleteTask,
  setTaskStatus,
  findRateList,
  createRate,
  findRateByUserLesson,
  deleteRate,
  findAccessByLesson,
  updateLessonAccess,
  createHomeworkRecord,
  findMyHomeworkRecords,
  auditHomeworkRecord,
  createCommunityPost,
  findAllCommunityPosts,
  findCommunityPostById,
  updateCommunityPost,
  deleteCommunityPost,
  setLessonExamPaperId,
  getLessonExamPaperId,
} from '../src/db/learn-extended-queries.js'

async function seedUser() {
  const [u] = await db
    .insert(users)
    .values({
      email: `t-${randomUUID().slice(0, 8)}@test.com`,
      nickname: 'Tester',
    })
    .returning()
  return u
}

async function seedLesson() {
  const [l] = await db
    .insert(lessons)
    .values({ title: 'Lesson-' + randomUUID().slice(0, 8) })
    .returning()
  return l
}

describe('learn-extended-queries — 真实 DB 集成测试', () => {
  beforeEach(async () => {
    await db.execute(sql`DELETE FROM learn_homework_record`)
    await db.execute(sql`DELETE FROM learn_homework`)
    await db.execute(sql`DELETE FROM learn_learn_map_topic`)
    await db.execute(sql`DELETE FROM learn_community_post`)
    await db.execute(sql`DELETE FROM lesson_access`)
    await db.execute(sql`DELETE FROM lesson_rate`)
    await db.execute(sql`DELETE FROM lesson_task`)
    await db.execute(sql`DELETE FROM learn_invoice_applications`)
    await db.execute(sql`DELETE FROM learn_invoice_titles`)
    await db.execute(sql`DELETE FROM learn_topic`)
    await db.execute(sql`DELETE FROM learn_maps`)
    await db.execute(sql`DELETE FROM lesson_sign_ups`)
    await db.execute(sql`DELETE FROM lessons`)
    await db.execute(sql`DELETE FROM users WHERE is_system_admin = false`)
  })

  describe('Homework', () => {
    it('createHomework + findHomeworkList + findHomeworkById + updateHomework + deleteHomework', async () => {
      const lessonId = randomUUID()
      const h = await createHomework({ lessonId, title: 'HW1', sort: 2 })
      await createHomework({ lessonId, title: 'HW2', sort: 1 })
      expect(h.title).toBe('HW1')

      const list = await findHomeworkList(lessonId)
      expect(list).toHaveLength(2)
      expect(list[0].title).toBe('HW2') // sort 升序

      const found = await findHomeworkById(h.id)
      expect(found?.title).toBe('HW1')

      const updated = await updateHomework(h.id, { title: 'HW-updated', status: 'published' })
      expect(updated?.title).toBe('HW-updated')
      expect(updated?.status).toBe('published')

      await deleteHomework(h.id)
      expect(await findHomeworkById(h.id)).toBeUndefined()
    })
  })

  describe('Maps', () => {
    it('createMap + findMapList + findMapById + updateMap + publishMap + deleteMap', async () => {
      const m1 = await createMap({ title: 'Map1', sort: 2, isPublished: true })
      const m2 = await createMap({ title: 'Map2', sort: 1, isPublished: false })
      const list = await findMapList()
      expect(list).toHaveLength(2)
      expect(list[0].title).toBe('Map2') // sort 升序

      const found = await findMapById(m1.id)
      expect(found?.title).toBe('Map1')

      const updated = await updateMap(m1.id, { title: 'Map-updated' })
      expect(updated?.title).toBe('Map-updated')

      const pub = await publishMap(m2.id, true)
      expect(pub?.isPublished).toBe(true)

      await deleteMap(m1.id)
      expect(await findMapById(m1.id)).toBeUndefined()
    })

    it('findMapListPaged + findPublishedMaps', async () => {
      await createMap({ title: 'A', sort: 1, isPublished: true })
      await createMap({ title: 'B', sort: 2, isPublished: false })
      await createMap({ title: 'C', sort: 3, isPublished: true })

      const pub = await findPublishedMaps()
      expect(pub).toHaveLength(2)

      const page = await findMapListPaged({ page: 1, pageSize: 2, isPublished: true })
      expect(page.list).toHaveLength(2)
      expect(page.total).toBe(2)

      const searchPage = await findMapListPaged({ page: 1, pageSize: 10, search: 'A' })
      expect(searchPage.list).toHaveLength(1)
      expect(searchPage.list[0].title).toBe('A')
    })

    it('setMapTopics + findMapTopics', async () => {
      const m = await createMap({ title: 'M' })
      const t1 = randomUUID()
      const t2 = randomUUID()
      await setMapTopics(m.id, [t1, t2])
      let topics = await findMapTopics(m.id)
      expect(topics).toHaveLength(2)

      // 覆盖更新
      await setMapTopics(m.id, [t1])
      topics = await findMapTopics(m.id)
      expect(topics).toHaveLength(1)
      expect(topics[0]).toBe(t1)

      // 清空
      await setMapTopics(m.id, [])
      topics = await findMapTopics(m.id)
      expect(topics).toHaveLength(0)
    })
  })

  describe('Invoice Applications', () => {
    it('findInvoiceApplicationList + findInvoiceApplicationById + updateInvoiceApplicationStatus', async () => {
      const u = await seedUser()
      const [app] = await db
        .insert(learnInvoiceApplications)
        .values({
          orderId: 'ORD001',
          userId: u.id,
          type: 'company',
          title: 'Title',
          taxNo: 'TAX123',
          amount: '100.50',
          status: 'pending',
        })
        .returning()

      const list = await findInvoiceApplicationList({ page: 1, pageSize: 10 })
      expect(list.total).toBe(1)
      expect(list.list[0].userNickname).toBe('Tester')

      const statusList = await findInvoiceApplicationList({
        page: 1,
        pageSize: 10,
        status: 'approved',
      })
      expect(statusList.total).toBe(0)

      const searchList = await findInvoiceApplicationList({ page: 1, pageSize: 10, search: 'ORD' })
      expect(searchList.total).toBe(1)

      const found = await findInvoiceApplicationById(app.id)
      expect(found?.status).toBe('pending')

      const updated = await updateInvoiceApplicationStatus(app.id, 'approved')
      expect(updated?.status).toBe('approved')
    })
  })

  describe('Invoice Titles', () => {
    it('createInvoiceTitle 默认抬头互斥 + findInvoiceTitleList + updateInvoiceTitle + deleteInvoiceTitle', async () => {
      const u = await seedUser()
      const t1 = await createInvoiceTitle({
        userId: u.id,
        title: 'Company A',
        type: 'company',
        taxNo: 'TAX1',
        isDefault: true,
      })
      const t2 = await createInvoiceTitle({
        userId: u.id,
        title: 'Company B',
        type: 'company',
        taxNo: 'TAX2',
        isDefault: true, // 设为默认,应清除 t1 的默认
      })
      const list = await findInvoiceTitleList(u.id)
      expect(list).toHaveLength(2)
      // t2 是默认(createdAt 倒序,t2 在前)
      expect(list[0].id).toBe(t2.id)
      expect(list[0].isDefault).toBe(true)
      // t1 默认被清除
      const t1Refresh = await findInvoiceTitleById(t1.id)
      expect(t1Refresh?.isDefault).toBe(false)

      // updateInvoiceTitle 设默认也会互斥
      const updated = await updateInvoiceTitle(t1.id, { isDefault: true })
      expect(updated?.isDefault).toBe(true)
      const t2Refresh = await findInvoiceTitleById(t2.id)
      expect(t2Refresh?.isDefault).toBe(false)

      await deleteInvoiceTitle(t1.id)
      expect(await findInvoiceTitleById(t1.id)).toBeUndefined()
    })
  })

  describe('Topics', () => {
    it('createTopicRow + findAllTopics + findTopicRowById + updateTopicRow + deleteTopicRow', async () => {
      const t1 = await createTopicRow({ title: 'T1', image: 'img1', status: 'published' })
      await createTopicRow({ title: 'T2', image: 'img2', status: 'draft' })

      const all = await findAllTopics({ page: 1, pageSize: 10 })
      expect(all.total).toBe(2)

      const pubOnly = await findAllTopics({ page: 1, pageSize: 10, status: 'published' })
      expect(pubOnly.total).toBe(1)
      expect(pubOnly.list[0].title).toBe('T1')

      const search = await findAllTopics({ page: 1, pageSize: 10, search: 'T2' })
      expect(search.total).toBe(1)

      const found = await findTopicRowById(t1.id)
      expect(found?.title).toBe('T1')

      const updated = await updateTopicRow(t1.id, { title: 'T1-updated' })
      expect(updated?.title).toBe('T1-updated')

      await deleteTopicRow(t1.id)
      expect(await findTopicRowById(t1.id)).toBeUndefined()
    })
  })

  describe('Community Posts', () => {
    it('createCommunityPost + findAllCommunityPosts + findCommunityPostById + updateCommunityPost + deleteCommunityPost', async () => {
      const u = await seedUser()
      const lesson = await seedLesson()
      const p1 = await createCommunityPost({
        userId: u.id,
        title: 'Post1',
        content: 'content1',
        lessonId: lesson.id,
        isPinned: true,
      })
      await createCommunityPost({
        userId: u.id,
        title: 'Post2',
        content: 'content2',
      })

      const all = await findAllCommunityPosts({ page: 1, pageSize: 10 })
      expect(all.total).toBe(2)
      // isPinned 优先
      expect(all.list[0].id).toBe(p1.id)
      expect(all.list[0].userName).toBe('Tester')
      expect(all.list[0].lessonTitle).toBe(lesson.title)

      const found = await findCommunityPostById(p1.id)
      expect(found?.title).toBe('Post1')

      const updated = await updateCommunityPost(p1.id, { title: 'Updated', isPinned: false })
      expect(updated?.title).toBe('Updated')
      expect(updated?.isPinned).toBe(false)

      await deleteCommunityPost(p1.id)
      expect(await findCommunityPostById(p1.id)).toBeUndefined()
    })
  })

  describe('Tasks', () => {
    it('createTask + findTasksByLesson + updateTask + setTaskStatus + deleteTask', async () => {
      const lessonId = randomUUID()
      const t = await createTask({ lessonId, title: 'Task1', status: 'enable' })
      const list = await findTasksByLesson(lessonId)
      expect(list).toHaveLength(1)
      expect(list[0].title).toBe('Task1')

      const updated = await updateTask(t.id, { title: 'Task-updated' })
      expect(updated?.title).toBe('Task-updated')

      const statusUpdated = await setTaskStatus(t.id, 'disabled')
      expect(statusUpdated?.status).toBe('disabled')

      await deleteTask(t.id)
      expect(await findTasksByLesson(lessonId)).toHaveLength(0)
    })
  })

  describe('Rates', () => {
    it('createRate + findRateList + findRateByUserLesson + deleteRate', async () => {
      const u = await seedUser()
      const lesson = await seedLesson()
      const r = await createRate({
        lessonId: lesson.id,
        userId: u.id,
        content: 'good',
        teacherScore: 5,
      })
      // createRate 默认 status='published',findRateList 只查 published
      const list = await findRateList({ lessonId: lesson.id, page: 1, pageSize: 10 })
      expect(list.total).toBe(1)
      expect(list.list[0].content).toBe('good')

      const byUser = await findRateByUserLesson(u.id, lesson.id)
      expect(byUser?.id).toBe(r.id)

      await deleteRate(r.id)
      const afterDelete = await findRateList({ lessonId: lesson.id, page: 1, pageSize: 10 })
      expect(afterDelete.total).toBe(0)
    })
  })

  describe('Access', () => {
    it('findAccessByLesson + updateLessonAccess', async () => {
      const lessonId = randomUUID()
      // 初次无记录
      expect(await findAccessByLesson(lessonId)).toHaveLength(0)

      // all 类型
      const count1 = await updateLessonAccess(lessonId, 'all', [])
      expect(count1).toBeGreaterThan(0)
      const access1 = await findAccessByLesson(lessonId)
      expect(access1[0].accessType).toBe('all')

      // 指定值
      const count2 = await updateLessonAccess(lessonId, 'members', ['u1', 'u2'])
      expect(count2).toBeGreaterThan(0)
      const access2 = await findAccessByLesson(lessonId)
      expect(access2[0].accessType).toBe('members')
      expect(access2).toHaveLength(1) // 先删后插
    })
  })

  describe('Homework Records', () => {
    it('createHomeworkRecord + findMyHomeworkRecords + auditHomeworkRecord', async () => {
      const memberId = randomUUID()
      const lessonId = randomUUID()
      const signUpId = randomUUID()
      const r = await createHomeworkRecord({
        memberId,
        lessonId,
        url: 'https://example.com/hw.pdf',
        signUpId,
      })
      expect(r.status).toBe('pending')

      const list = await findMyHomeworkRecords(memberId)
      expect(list).toHaveLength(1)

      const approved = await auditHomeworkRecord(r.id, 'approved')
      expect(approved?.status).toBe('approved')

      const statusList = await findMyHomeworkRecords(memberId, 'approved')
      expect(statusList).toHaveLength(1)
      const pendingList = await findMyHomeworkRecords(memberId, 'pending')
      expect(pendingList).toHaveLength(0)
    })
  })

  describe('Lesson Exam Paper Association (哨兵作业记录)', () => {
    it('setLessonExamPaperId + getLessonExamPaperId', async () => {
      const lessonId = randomUUID()
      expect(await getLessonExamPaperId(lessonId)).toBeNull()

      const paperId = randomUUID()
      await setLessonExamPaperId(lessonId, paperId)
      expect(await getLessonExamPaperId(lessonId)).toBe(paperId)

      // 覆盖更新
      const newPaperId = randomUUID()
      await setLessonExamPaperId(lessonId, newPaperId)
      expect(await getLessonExamPaperId(lessonId)).toBe(newPaperId)

      // 清空
      await setLessonExamPaperId(lessonId, null)
      expect(await getLessonExamPaperId(lessonId)).toBeNull()
    })
  })
})
