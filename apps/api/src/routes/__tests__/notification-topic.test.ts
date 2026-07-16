import { describe, it, expect, beforeAll, vi } from 'vitest'

vi.hoisted(() => {
  process.env.DATABASE_URL ??= 'postgresql://test:test@localhost:5432/test'
  process.env.JWT_SECRET ??= 'test-jwt-secret-for-vitest-at-least-32-chars'
})

vi.mock('../../db/index.js', () => {
  function createChain(result: unknown[] = [], reject?: Error) {
    const chain: Record<string, unknown> = {
      from: () => chain,
      where: () => chain,
      orderBy: () => chain,
      limit: () => chain,
      offset: () => chain,
      then: (resolve?: (v: unknown) => unknown, onReject?: (e: unknown) => unknown) =>
        reject
          ? Promise.reject(reject).then(undefined, onReject)
          : Promise.resolve(result).then(resolve, onReject),
    }
    return chain
  }
  return {
    db: {
      select: vi.fn(() => createChain([])),
    },
  }
})

import { db } from '../../db/index.js'
import { getTopicMap, attachTopicToList } from '../../db/notification-queries.js'
import type { Notification } from '@ihui/database'

function makeChain(result: unknown[] = [], reject?: Error): never {
  const chain: Record<string, unknown> = {
    from: () => chain,
    where: () => chain,
    orderBy: () => chain,
    limit: () => chain,
    offset: () => chain,
    then: (resolve?: (v: unknown) => unknown, onReject?: (e: unknown) => unknown) =>
      reject
        ? Promise.reject(reject).then(undefined, onReject)
        : Promise.resolve(result).then(resolve, onReject),
  }
  return chain as never
}

function makeNotification(
  overrides: Partial<Notification> & { id: string; type: string },
): Notification {
  return {
    userId: '00000000-0000-0000-0000-000000000000',
    title: 'mock-title',
    content: null,
    data: null,
    isRead: false,
    createdAt: new Date('2026-07-17T00:00:00Z'),
    ...overrides,
  } as Notification
}

describe('Notification Topic Aggregation — getTopicMap', () => {
  beforeAll(() => {
    vi.mocked(db.select).mockReset()
  })

  describe('10 种通知类型聚合映射正确', () => {
    it('每类型返回正确 topicTitle + topicIcon', async () => {
      vi.mocked(db.select).mockReset()
      vi.mocked(db.select)
        .mockReturnValueOnce(makeChain([{ id: 'order-1', title: 'ORD-20260717-001' }]))
        .mockReturnValueOnce(makeChain([{ id: 'follow-1', title: 'Alice' }]))
        .mockReturnValueOnce(makeChain([{ id: 'comment-1', title: '这是一条评论内容' }]))
        .mockReturnValueOnce(makeChain([{ id: 'like-1', title: '点赞的资源标题' }]))
        .mockReturnValueOnce(makeChain([{ id: 'point-1', title: '签到获得积分 +10' }]))
        .mockReturnValueOnce(makeChain([{ id: 'course-1', title: 'TypeScript 进阶课程' }]))
        .mockReturnValueOnce(makeChain([{ id: 'live-1', title: '前端架构直播' }]))
        .mockReturnValueOnce(makeChain([{ id: 'resource-1', title: 'React 19 升级指南' }]))
        .mockReturnValueOnce(makeChain([{ id: 'exam-1', title: 'JavaScript 基础测试卷' }]))

      const list: Notification[] = [
        makeNotification({ id: 'n1', type: 'order', data: { orderId: 'order-1' } }),
        makeNotification({ id: 'n2', type: 'follow', data: { userId: 'follow-1' } }),
        makeNotification({ id: 'n3', type: 'comment', data: { commentId: 'comment-1' } }),
        makeNotification({ id: 'n4', type: 'like', data: { resourceId: 'like-1' } }),
        makeNotification({ id: 'n5', type: 'system', data: null }),
        makeNotification({ id: 'n6', type: 'point', data: { pointId: 'point-1' } }),
        makeNotification({ id: 'n7', type: 'course', data: { courseId: 'course-1' } }),
        makeNotification({ id: 'n8', type: 'live', data: { liveId: 'live-1' } }),
        makeNotification({ id: 'n9', type: 'resource', data: { resourceId: 'resource-1' } }),
        makeNotification({ id: 'n10', type: 'exam', data: { examId: 'exam-1' } }),
      ]

      const topicMap = await getTopicMap(list)

      expect(topicMap.get('n1')).toEqual({ topicTitle: 'ORD-20260717-001', topicIcon: 'order' })
      expect(topicMap.get('n2')).toEqual({ topicTitle: 'Alice', topicIcon: 'user' })
      expect(topicMap.get('n3')).toEqual({ topicTitle: '这是一条评论内容', topicIcon: 'comment' })
      expect(topicMap.get('n4')).toEqual({ topicTitle: '点赞的资源标题', topicIcon: 'like' })
      expect(topicMap.get('n5')).toEqual({ topicTitle: null, topicIcon: 'system' })
      expect(topicMap.get('n6')).toEqual({ topicTitle: '签到获得积分 +10', topicIcon: 'point' })
      expect(topicMap.get('n7')).toEqual({ topicTitle: 'TypeScript 进阶课程', topicIcon: 'course' })
      expect(topicMap.get('n8')).toEqual({ topicTitle: '前端架构直播', topicIcon: 'live' })
      expect(topicMap.get('n9')).toEqual({ topicTitle: 'React 19 升级指南', topicIcon: 'resource' })
      expect(topicMap.get('n10')).toEqual({
        topicTitle: 'JavaScript 基础测试卷',
        topicIcon: 'exam',
      })
    })
  })

  describe('业务记录被删除时优雅降级(返回 null)', () => {
    it('查询返回空数组时 topicTitle 为 null,不抛错', async () => {
      vi.mocked(db.select).mockReset()
      vi.mocked(db.select).mockReturnValue(makeChain([]))

      const list: Notification[] = [
        makeNotification({ id: 'n1', type: 'order', data: { orderId: 'deleted-order-id' } }),
        makeNotification({ id: 'n2', type: 'follow', data: { userId: 'deleted-user-id' } }),
      ]

      const topicMap = await getTopicMap(list)

      expect(topicMap.get('n1')).toEqual({ topicTitle: null, topicIcon: 'order' })
      expect(topicMap.get('n2')).toEqual({ topicTitle: null, topicIcon: 'user' })
    })

    it('查询抛错时优雅降级,不抛错', async () => {
      vi.mocked(db.select).mockReset()
      vi.mocked(db.select).mockReturnValue(makeChain([], new Error('DB connection error')))

      const list: Notification[] = [
        makeNotification({ id: 'n1', type: 'course', data: { courseId: 'course-1' } }),
      ]

      const topicMap = await getTopicMap(list)

      expect(topicMap.get('n1')).toEqual({ topicTitle: null, topicIcon: 'course' })
    })

    it('通知 data 为 null 或缺 bizId 时 topicTitle 为 null', async () => {
      vi.mocked(db.select).mockReset()

      const list: Notification[] = [
        makeNotification({ id: 'n1', type: 'order', data: null }),
        makeNotification({ id: 'n2', type: 'order', data: { noRelevantKey: 'foo' } }),
      ]

      const topicMap = await getTopicMap(list)

      expect(topicMap.get('n1')).toEqual({ topicTitle: null, topicIcon: 'order' })
      expect(topicMap.get('n2')).toEqual({ topicTitle: null, topicIcon: 'order' })
      expect(db.select).not.toHaveBeenCalled()
    })
  })

  describe('批量查询不产生 N+1(验证查询次数)', () => {
    it('3 条 order + 2 条 follow = 2 次 select,而非 5 次', async () => {
      vi.mocked(db.select).mockReset()
      vi.mocked(db.select)
        .mockReturnValueOnce(
          makeChain([
            { id: 'o1', title: 'O1' },
            { id: 'o2', title: 'O2' },
            { id: 'o3', title: 'O3' },
          ]),
        )
        .mockReturnValueOnce(
          makeChain([
            { id: 'f1', title: 'F1' },
            { id: 'f2', title: 'F2' },
          ]),
        )

      const list: Notification[] = [
        makeNotification({ id: 'n1', type: 'order', data: { orderId: 'o1' } }),
        makeNotification({ id: 'n2', type: 'order', data: { orderId: 'o2' } }),
        makeNotification({ id: 'n3', type: 'order', data: { orderId: 'o3' } }),
        makeNotification({ id: 'n4', type: 'follow', data: { userId: 'f1' } }),
        makeNotification({ id: 'n5', type: 'follow', data: { userId: 'f2' } }),
      ]

      const topicMap = await getTopicMap(list)

      expect(db.select).toHaveBeenCalledTimes(2)
      expect(topicMap.get('n1')?.topicTitle).toBe('O1')
      expect(topicMap.get('n2')?.topicTitle).toBe('O2')
      expect(topicMap.get('n3')?.topicTitle).toBe('O3')
      expect(topicMap.get('n4')?.topicTitle).toBe('F1')
      expect(topicMap.get('n5')?.topicTitle).toBe('F2')
    })

    it('空列表不触发任何查询', async () => {
      vi.mocked(db.select).mockReset()

      const topicMap = await getTopicMap([])

      expect(topicMap.size).toBe(0)
      expect(db.select).not.toHaveBeenCalled()
    })

    it('仅 system 类型不触发查询', async () => {
      vi.mocked(db.select).mockReset()

      const list: Notification[] = [
        makeNotification({ id: 'n1', type: 'system', data: null }),
        makeNotification({ id: 'n2', type: 'system', data: null }),
        makeNotification({ id: 'n3', type: 'system', data: null }),
      ]

      const topicMap = await getTopicMap(list)

      expect(topicMap.size).toBe(3)
      expect(db.select).not.toHaveBeenCalled()
      expect(topicMap.get('n1')?.topicTitle).toBeNull()
      expect(topicMap.get('n1')?.topicIcon).toBe('system')
    })
  })

  describe('attachTopicToList 附加字段', () => {
    it('通知列表附加 topicTitle/topicIcon 字段,不修改入参', async () => {
      vi.mocked(db.select).mockReset()
      vi.mocked(db.select).mockReturnValueOnce(makeChain([{ id: 'order-1', title: 'ORD-001' }]))

      const original: Notification[] = [
        makeNotification({ id: 'n1', type: 'order', data: { orderId: 'order-1' } }),
      ]

      const result = await attachTopicToList(original)

      expect(result[0]).toMatchObject({
        id: 'n1',
        type: 'order',
        topicTitle: 'ORD-001',
        topicIcon: 'order',
      })
      // 入参未被修改（仍无 topicTitle/topicIcon 字段）
      expect(original[0]).not.toHaveProperty('topicTitle')
      expect(original[0]).not.toHaveProperty('topicIcon')
    })

    it('评论内容超过 50 字符时摘要截断', async () => {
      vi.mocked(db.select).mockReset()
      const longComment = 'A'.repeat(60)
      vi.mocked(db.select).mockReturnValueOnce(makeChain([{ id: 'comment-1', title: longComment }]))

      const list: Notification[] = [
        makeNotification({ id: 'n1', type: 'comment', data: { commentId: 'comment-1' } }),
      ]

      const topicMap = await getTopicMap(list)
      const title = topicMap.get('n1')?.topicTitle

      expect(title).not.toBeNull()
      expect(title!.length).toBe(53)
      expect(title!.endsWith('...')).toBe(true)
      expect(title!.slice(0, 50)).toBe(longComment.slice(0, 50))
    })
  })
})
