import { describe, it, expect, beforeEach } from 'vitest'
import { sql } from 'drizzle-orm'
import { db } from '../src/db/index.js'
import {
  users,
  lessons,
  lessonSignUps,
  examPapers,
  examRecords,
  announcements,
  helpArticles,
  visitLogs,
} from '@ihui/database'
import {
  getLearnStatistics,
  getExamStatistics,
  getContentStatistics,
  getOverviewStatistics,
  findStatisticsSnapshots,
  findStatisticsSnapshotById,
  createStatisticsSnapshot,
  deleteStatisticsSnapshot,
  getMessageStatistics,
  getLiveStatistics,
  getPointStatistics,
  getResourceStatistics,
  getUserCenterStatistics,
  findVisitLogList,
} from '../src/db/statistics-queries.js'

describe('statistics-queries — 真实 DB 集成测试', () => {
  beforeEach(async () => {
    await db.execute(sql`DELETE FROM visit_logs`)
    await db.execute(sql`DELETE FROM statistics_snapshots`)
    await db.execute(sql`DELETE FROM exam_records`)
    await db.execute(sql`DELETE FROM exam_papers`)
    await db.execute(sql`DELETE FROM lesson_sign_ups`)
    await db.execute(sql`DELETE FROM lessons`)
    await db.execute(sql`DELETE FROM help_articles`)
    await db.execute(sql`DELETE FROM announcements`)
    await db.execute(sql`DELETE FROM users WHERE is_system_admin = false`)
  })

  describe('Learn Statistics', () => {
    it('空表返回全 0', async () => {
      const s = await getLearnStatistics()
      expect(s.lessonTotal).toBe(0)
      expect(s.lessonPublished).toBe(0)
      expect(s.signupTotal).toBe(0)
      expect(s.viewSum).toBe(0)
    })

    it('有数据时正确统计', async () => {
      const [l1] = await db
        .insert(lessons)
        .values({ title: 'L1', isPublished: true, status: 1, viewCount: 100 })
        .returning()
      await db.insert(lessons).values([
        { title: 'L2', isPublished: true, status: 1, viewCount: 50 },
        { title: 'L3', isPublished: false, status: 1, viewCount: 10 },
        { title: 'L4', isPublished: true, status: 0, viewCount: 5 },
      ])
      const [u1] = await db
        .insert(users)
        .values({ email: 'ls1@t.com', nickname: 'LS1' })
        .returning()
      const [u2] = await db
        .insert(users)
        .values({ email: 'ls2@t.com', nickname: 'LS2' })
        .returning()
      await db.insert(lessonSignUps).values([
        { lessonId: l1.id, userId: u1.id, status: 1 },
        { lessonId: l1.id, userId: u2.id, status: 2 },
      ])

      const s = await getLearnStatistics()
      expect(s.lessonTotal).toBe(4)
      expect(s.lessonPublished).toBe(2)
      expect(s.signupTotal).toBe(2)
      expect(s.viewSum).toBe(160)
    })
  })

  describe('Exam Statistics', () => {
    it('空表返回全 0,passRate=0', async () => {
      const s = await getExamStatistics()
      expect(s.examTotal).toBe(0)
      expect(s.examPublished).toBe(0)
      expect(s.recordTotal).toBe(0)
      expect(s.passTotal).toBe(0)
      expect(s.passRate).toBe(0)
    })

    it('有数据时正确统计通过率', async () => {
      const [p1] = await db
        .insert(examPapers)
        .values({ title: 'P1', isPublished: true, status: 1 })
        .returning()
      await db.insert(examPapers).values({ title: 'P2' }).returning()
      const [u1] = await db.insert(users).values({ email: 'e1@t.com', nickname: 'E1' }).returning()
      const [u2] = await db.insert(users).values({ email: 'e2@t.com', nickname: 'E2' }).returning()
      const [u3] = await db.insert(users).values({ email: 'e3@t.com', nickname: 'E3' }).returning()

      await db.insert(examRecords).values([
        { paperId: p1.id, userId: u1.id, status: 'graded', isPassed: true, score: '80.00' },
        { paperId: p1.id, userId: u2.id, status: 'graded', isPassed: true, score: '90.00' },
        { paperId: p1.id, userId: u3.id, status: 'graded', isPassed: false, score: '40.00' },
      ])

      const s = await getExamStatistics()
      expect(s.examTotal).toBe(2)
      expect(s.examPublished).toBe(1)
      expect(s.recordTotal).toBe(3)
      expect(s.passTotal).toBe(2)
      expect(s.passRate).toBeCloseTo(0.6667, 3)
    })
  })

  describe('Content Statistics', () => {
    it('空表返回全 0', async () => {
      const s = await getContentStatistics()
      // memberTotal 包含系统管理员用户(由 migration 0067 创建,不可删除)
      expect(s.memberTotal).toBeGreaterThanOrEqual(0)
      expect(s.postTotal).toBe(0)
      expect(s.announcementTotal).toBe(0)
      expect(s.articleTotal).toBe(0)
    })

    it('有数据时正确统计', async () => {
      await db.insert(users).values({ email: 's1@t.com', nickname: 'S1' })
      await db.insert(announcements).values({ title: 'A1', content: 'c' })
      await db.insert(helpArticles).values({ title: 'H1', slug: 'h1', content: 'c' })

      const s = await getContentStatistics()
      // memberTotal 包含系统管理员用户(由 migration 0067 创建,不可删除)
      expect(s.memberTotal).toBeGreaterThanOrEqual(1)
      expect(s.announcementTotal).toBe(1)
      expect(s.articleTotal).toBe(1)
    })
  })

  describe('Overview Statistics', () => {
    it('聚合各模块核心指标', async () => {
      await db.insert(users).values({ email: 'o1@t.com', nickname: 'O1' })
      await db.insert(lessons).values({ title: 'L1' })
      await db.insert(examPapers).values({ title: 'P1' })

      const s = await getOverviewStatistics()
      // memberTotal 包含系统管理员用户(由 migration 0067 创建,不可删除)
      expect(s.memberTotal).toBeGreaterThanOrEqual(1)
      expect(s.lessonTotal).toBe(1)
      expect(s.examTotal).toBe(1)
    })
  })

  describe('Statistics Snapshots', () => {
    it('createStatisticsSnapshot + findStatisticsSnapshots + findStatisticsSnapshotById + deleteStatisticsSnapshot', async () => {
      const s1 = await createStatisticsSnapshot({
        type: 'daily',
        data: { users: 100, lessons: 50 },
      })
      await createStatisticsSnapshot({
        type: 'weekly',
        data: { users: 500 },
      })

      const list = await findStatisticsSnapshots({ page: 1, pageSize: 10 })
      expect(list.total).toBe(2)

      const dailyOnly = await findStatisticsSnapshots({ page: 1, pageSize: 10, type: 'daily' })
      expect(dailyOnly.total).toBe(1)
      expect(dailyOnly.list[0].type).toBe('daily')

      const found = await findStatisticsSnapshotById(s1.id)
      expect(found?.data).toEqual({ users: 100, lessons: 50 })

      await deleteStatisticsSnapshot(s1.id)
      expect(await findStatisticsSnapshotById(s1.id)).toBeUndefined()
    })
  })

  describe('Message Statistics', () => {
    it('空表返回全 0', async () => {
      const s = await getMessageStatistics()
      expect(s.total).toBe(0)
      expect(s.unread).toBe(0)
    })
  })

  describe('Live Statistics', () => {
    it('空表返回全 0', async () => {
      const s = await getLiveStatistics()
      expect(s.total).toBe(0)
      expect(s.living).toBe(0)
      expect(s.published).toBe(0)
    })
  })

  describe('Point Statistics', () => {
    it('空表返回全 0', async () => {
      const s = await getPointStatistics()
      expect(s.userCount).toBe(0)
      expect(s.totalPoints).toBe(0)
      expect(s.totalEarned).toBe(0)
      expect(s.totalSpent).toBe(0)
    })
  })

  describe('Resource Statistics', () => {
    it('空表返回全 0', async () => {
      const s = await getResourceStatistics()
      expect(s.total).toBe(0)
      expect(s.published).toBe(0)
      expect(s.viewSum).toBe(0)
      expect(s.downloadSum).toBe(0)
    })
  })

  describe('UserCenter Statistics', () => {
    it('空表返回全 0', async () => {
      const s = await getUserCenterStatistics()
      expect(s.userTotal).toBe(0)
      expect(s.memberTotal).toBe(0)
      expect(s.vipTotal).toBe(0)
      expect(s.normalTotal).toBe(0)
      expect(s.disabledTotal).toBe(0)
    })

    it('有数据时正确统计', async () => {
      await db.insert(users).values([
        { email: 'v1@t.com', nickname: 'V1', isVip: 1 },
        { email: 'n1@t.com', nickname: 'N1', isVip: 0 },
        { email: 'd1@t.com', nickname: 'D1', status: 0 }, // isVip 默认 0,也计入 normalTotal
      ])

      const s = await getUserCenterStatistics()
      expect(s.userTotal).toBe(3)
      expect(s.vipTotal).toBe(1)
      expect(s.normalTotal).toBe(2) // N1 + D1(isVip 默认 0)
      expect(s.disabledTotal).toBe(1) // D1(status=0)
    })
  })

  describe('Visit Logs', () => {
    it('findVisitLogList 分页 + 时间筛选', async () => {
      const today = new Date().toISOString().slice(0, 10)
      const [u] = await db.insert(users).values({ email: 'v@t.com', nickname: 'V' }).returning()
      await db.insert(visitLogs).values([
        { visitDate: today, userId: u.id, path: '/' },
        { visitDate: today, userId: u.id, path: '/about' },
        { visitDate: '2020-01-01', userId: u.id, path: '/old' },
      ])

      const all = await findVisitLogList({ page: 1, pageSize: 10 })
      expect(all.total).toBe(3)

      const filtered = await findVisitLogList({
        page: 1,
        pageSize: 10,
        startTime: today,
        endTime: today,
      })
      expect(filtered.total).toBe(2)
    })
  })
})
