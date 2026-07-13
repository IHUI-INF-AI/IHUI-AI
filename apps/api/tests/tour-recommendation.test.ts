import { describe, it, expect, beforeEach, vi } from 'vitest'

const { mockDbSelect, mockDbInsert, mockDbUpdate } = vi.hoisted(() => ({
  mockDbSelect: vi.fn(),
  mockDbInsert: vi.fn(),
  mockDbUpdate: vi.fn(),
}))

vi.mock('../src/db/index.js', () => ({
  db: {
    select: mockDbSelect,
    insert: mockDbInsert,
    update: mockDbUpdate,
  },
  dbRead: {},
  dbClient: {},
}))

vi.mock('@ihui/database', () => ({
  tourContent: {
    id: 'id',
    title: 'title',
    viewCount: 'view_count',
    likeCount: 'like_count',
    tags: 'tags',
    status: 'status',
    destination: 'destination',
  },
  tourRecommendations: {
    contentId: 'content_id',
    userId: 'user_id',
    clicked: 'clicked',
  },
}))

import {
  recommendHot,
  recommendNearby,
  recommendContentBased,
  recommendSimilarUser,
  recommend,
  markClicked,
  markDismissed,
} from '../src/services/tour/tour-recommendation.js'

describe('tour-recommendation — 推荐算法', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  function selectFromWhere(rows: unknown[], hasOrderBy = false, hasLimit = false) {
    const limitFn = vi.fn().mockResolvedValue(rows)
    let chain: Record<string, unknown>
    if (hasOrderBy) {
      chain = { orderBy: vi.fn().mockReturnValue({ limit: limitFn }) }
    } else if (hasLimit) {
      chain = { limit: limitFn }
    } else {
      return {
        from: vi.fn().mockReturnValue({ where: vi.fn().mockResolvedValue(rows) }),
      }
    }
    return {
      from: vi.fn().mockReturnValue({ where: vi.fn().mockReturnValue(chain) }),
    }
  }

  describe('recommendHot 热度推荐', () => {
    it('无数据时返回空数组', async () => {
      mockDbSelect.mockReturnValue(selectFromWhere([], true, true))
      const list = await recommendHot(10)
      expect(list).toEqual([])
    })

    it('按热度归一化 score', async () => {
      mockDbSelect.mockReturnValue(
        selectFromWhere(
          [
            { id: 'c1', title: 'T1', views: 100, likes: 10 },
            { id: 'c2', title: 'T2', views: 50, likes: 5 },
          ],
          true,
          true,
        ),
      )
      const list = await recommendHot(10)
      expect(list).toHaveLength(2)
      expect(list[0]!.score).toBe(1)
      expect(list[1]!.score).toBeLessThan(1)
      expect(list[0]!.strategy).toBe('hot')
      expect(list[0]!.reason).toEqual(['hot'])
    })
  })

  describe('recommendNearby 附近推荐', () => {
    it('按目的地匹配返回固定 score=0.7', async () => {
      mockDbSelect.mockReturnValue(
        selectFromWhere(
          [
            { id: 'c1', views: 10 },
            { id: 'c2', views: 5 },
          ],
          true,
          true,
        ),
      )
      const list = await recommendNearby('beijing', 10)
      expect(list).toHaveLength(2)
      expect(list[0]!.score).toBe(0.7)
      expect(list[0]!.strategy).toBe('nearby')
      expect(list[0]!.reason).toContain('nearby')
      expect(list[0]!.reason).toContain('destination:beijing')
    })

    it('无匹配返回空数组', async () => {
      mockDbSelect.mockReturnValue(selectFromWhere([], true, true))
      const list = await recommendNearby('unknown', 10)
      expect(list).toEqual([])
    })
  })

  describe('recommendContentBased 基于内容相似度', () => {
    it('seed 内容不存在返回空数组', async () => {
      mockDbSelect.mockReturnValue(selectFromWhere([]))
      const list = await recommendContentBased('not_exist', 10)
      expect(list).toEqual([])
    })

    it('seed 无标签返回空数组', async () => {
      mockDbSelect.mockReturnValue(selectFromWhere([{ id: 'c1', tags: [] }]))
      const list = await recommendContentBased('c1', 10)
      expect(list).toEqual([])
    })

    it('按 Jaccard 相似度排序', async () => {
      let callCount = 0
      mockDbSelect.mockImplementation(() => {
        callCount++
        if (callCount === 1) {
          // seed
          return selectFromWhere([{ id: 'c1', tags: ['a', 'b', 'c'] }])
        }
        // candidates
        return selectFromWhere(
          [
            { id: 'c2', tags: ['a', 'b', 'c'] },
            { id: 'c3', tags: ['a'] },
            { id: 'c4', tags: ['x'] },
          ],
          false,
          true,
        )
      })
      const list = await recommendContentBased('c1', 10)
      expect(list).toHaveLength(2)
      expect(list[0]!.contentId).toBe('c2')
      expect(list[0]!.score).toBe(1)
      expect(list[1]!.contentId).toBe('c3')
      expect(list[1]!.strategy).toBe('content_based')
    })

    it('limit 限制返回数量', async () => {
      let callCount = 0
      mockDbSelect.mockImplementation(() => {
        callCount++
        if (callCount === 1) {
          return selectFromWhere([{ id: 'c1', tags: ['a'] }])
        }
        return selectFromWhere(
          [
            { id: 'c2', tags: ['a'] },
            { id: 'c3', tags: ['a'] },
            { id: 'c4', tags: ['a'] },
          ],
          false,
          true,
        )
      })
      const list = await recommendContentBased('c1', 2)
      expect(list).toHaveLength(2)
    })
  })

  describe('recommendSimilarUser 相似用户推荐', () => {
    it('当前用户无历史返回空数组', async () => {
      mockDbSelect.mockReturnValue(selectFromWhere([]))
      const list = await recommendSimilarUser('u1', 10)
      expect(list).toEqual([])
    })
  })

  describe('recommend 主入口', () => {
    it('strategy=hot 调用 recommendHot', async () => {
      mockDbSelect.mockReturnValue(
        selectFromWhere([{ id: 'c1', title: 'T1', views: 100, likes: 10 }], true, true),
      )
      mockDbInsert.mockReturnValue({ values: vi.fn().mockResolvedValue(undefined) })
      const list = await recommend({ userId: 'u1', strategy: 'hot' })
      expect(list).toHaveLength(1)
      expect(list[0]!.strategy).toBe('hot')
    })

    it('excludeContentIds 过滤结果', async () => {
      mockDbSelect.mockReturnValue(
        selectFromWhere(
          [
            { id: 'c1', title: 'T1', views: 100, likes: 10 },
            { id: 'c2', title: 'T2', views: 80, likes: 8 },
          ],
          true,
          true,
        ),
      )
      mockDbInsert.mockReturnValue({ values: vi.fn().mockResolvedValue(undefined) })
      const list = await recommend({ userId: 'u1', strategy: 'hot', excludeContentIds: ['c1'] })
      expect(list).toHaveLength(1)
      expect(list[0]!.contentId).toBe('c2')
    })

    it('结果非空时写入 tour_recommendations', async () => {
      mockDbSelect.mockReturnValue(
        selectFromWhere([{ id: 'c1', title: 'T1', views: 100, likes: 10 }], true, true),
      )
      const valuesMock = vi.fn().mockResolvedValue(undefined)
      mockDbInsert.mockReturnValue({ values: valuesMock })
      await recommend({ userId: 'u1', strategy: 'hot' })
      expect(mockDbInsert).toHaveBeenCalledTimes(1)
      const args = valuesMock.mock.calls[0]![0]
      expect(args[0].userId).toBe('u1')
      expect(args[0].clicked).toBe(false)
      expect(args[0].dismissed).toBe(false)
    })

    it('结果为空时不写入 db', async () => {
      mockDbSelect.mockReturnValue(selectFromWhere([], true, true))
      await recommend({ userId: 'u1', strategy: 'hot' })
      expect(mockDbInsert).not.toHaveBeenCalled()
    })

    it('strategy=nearby 但无 destination 时返回空数组', async () => {
      const list = await recommend({ userId: 'u1', strategy: 'nearby' })
      expect(list).toEqual([])
    })

    it('默认 strategy=hot', async () => {
      mockDbSelect.mockReturnValue(
        selectFromWhere([{ id: 'c1', title: 'T1', views: 100, likes: 10 }], true, true),
      )
      mockDbInsert.mockReturnValue({ values: vi.fn().mockResolvedValue(undefined) })
      const list = await recommend({ userId: 'u1' })
      expect(list[0]!.strategy).toBe('hot')
    })
  })

  describe('markClicked / markDismissed', () => {
    it('markClicked 调用 db.update', async () => {
      mockDbUpdate.mockReturnValue({
        set: vi.fn().mockReturnValue({ where: vi.fn().mockResolvedValue(undefined) }),
      })
      await markClicked('u1', 'c1')
      expect(mockDbUpdate).toHaveBeenCalledTimes(1)
    })

    it('markDismissed 调用 db.update', async () => {
      mockDbUpdate.mockReturnValue({
        set: vi.fn().mockReturnValue({ where: vi.fn().mockResolvedValue(undefined) }),
      })
      await markDismissed('u1', 'c1')
      expect(mockDbUpdate).toHaveBeenCalledTimes(1)
    })
  })
})
