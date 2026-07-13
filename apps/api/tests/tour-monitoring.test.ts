import { describe, it, expect, beforeEach, vi } from 'vitest'

const { mockDbSelect } = vi.hoisted(() => ({
  mockDbSelect: vi.fn(),
}))

vi.mock('../src/db/index.js', () => ({
  db: {
    select: mockDbSelect,
  },
  dbRead: {},
  dbClient: {},
}))

vi.mock('@ihui/database', () => ({
  tourContent: {
    id: 'id',
    releaseStage: 'release_stage',
    viewCount: 'view_count',
    likeCount: 'like_count',
    status: 'status',
  },
  tourRecommendations: { contentId: 'content_id', clicked: 'clicked' },
}))

import {
  noopMetricsSink,
  setMetricsSink,
  trackImpression,
  trackClick,
  trackError,
  computeAndReportCtr,
  reportGrayStageDistribution,
  getContentHealth,
} from '../src/services/tour/tour-monitoring.js'

describe('tour-monitoring — 监控服务', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    setMetricsSink(noopMetricsSink)
  })

  function makeSink() {
    return {
      recordContentImpression: vi.fn(),
      recordContentClick: vi.fn(),
      recordRecommendationCtr: vi.fn(),
      recordGrayStage: vi.fn(),
      recordError: vi.fn(),
    }
  }

  describe('noopMetricsSink', () => {
    it('所有方法为 no-op 不抛错', () => {
      expect(() => noopMetricsSink.recordContentImpression('c1')).not.toThrow()
      expect(() => noopMetricsSink.recordContentClick('c1')).not.toThrow()
      expect(() => noopMetricsSink.recordRecommendationCtr('c1', 0.5)).not.toThrow()
      expect(() => noopMetricsSink.recordGrayStage('canary_5pct', 10)).not.toThrow()
      expect(() => noopMetricsSink.recordError('/api/x', 'timeout')).not.toThrow()
    })
  })

  describe('setMetricsSink 注入 sink', () => {
    it('注入后 track 调用对应方法', () => {
      const sink = makeSink()
      setMetricsSink(sink)
      trackImpression('c1')
      trackClick('c2')
      trackError('/api/x', 'timeout')
      expect(sink.recordContentImpression).toHaveBeenCalledWith('c1')
      expect(sink.recordContentClick).toHaveBeenCalledWith('c2')
      expect(sink.recordError).toHaveBeenCalledWith('/api/x', 'timeout')
    })
  })

  describe('computeAndReportCtr 计算 CTR', () => {
    it('total=0 时返回 0', async () => {
      // 源码：Promise.all([db.select({...}).from(...).where(...), db.select({...}).from(...).where(...)])
      // 两次 db.select 各返回 { from: { where: Promise<[{count:0}]> } }
      mockDbSelect.mockReturnValue({
        from: vi.fn().mockReturnValue({
          where: vi.fn().mockResolvedValue([{ count: 0 }]),
        }),
      })
      const ctr = await computeAndReportCtr('c1')
      expect(ctr).toBe(0)
    })

    it('正常计算 ctr = hits/total', async () => {
      let callCount = 0
      mockDbSelect.mockImplementation(() => {
        callCount++
        // served=100, clicked=30
        return {
          from: vi.fn().mockReturnValue({
            where: vi.fn().mockResolvedValue([{ count: callCount === 1 ? 100 : 30 }]),
          }),
        }
      })
      const ctr = await computeAndReportCtr('c1')
      expect(ctr).toBe(0.3)
    })

    it('调用 sink.recordRecommendationCtr', async () => {
      const sink = makeSink()
      setMetricsSink(sink)
      // served=100, clicked=100 → ctr=1
      mockDbSelect.mockReturnValue({
        from: vi.fn().mockReturnValue({
          where: vi.fn().mockResolvedValue([{ count: 100 }]),
        }),
      })
      await computeAndReportCtr('c1')
      expect(sink.recordRecommendationCtr).toHaveBeenCalledWith('c1', 1)
    })
  })

  describe('reportGrayStageDistribution 灰度分布', () => {
    it('遍历所有 stage 调用 sink', async () => {
      const sink = makeSink()
      setMetricsSink(sink)
      mockDbSelect.mockReturnValue({
        from: vi.fn().mockReturnValue({
          groupBy: vi.fn().mockResolvedValue([
            { stage: 'off', count: 10 },
            { stage: 'full', count: 5 },
          ]),
        }),
      })
      await reportGrayStageDistribution()
      expect(sink.recordGrayStage).toHaveBeenCalledTimes(2)
      expect(sink.recordGrayStage).toHaveBeenCalledWith('off', 10)
      expect(sink.recordGrayStage).toHaveBeenCalledWith('full', 5)
    })

    it('空结果不调用 sink', async () => {
      const sink = makeSink()
      setMetricsSink(sink)
      mockDbSelect.mockReturnValue({
        from: vi.fn().mockReturnValue({
          groupBy: vi.fn().mockResolvedValue([]),
        }),
      })
      await reportGrayStageDistribution()
      expect(sink.recordGrayStage).not.toHaveBeenCalled()
    })
  })

  describe('getContentHealth 内容健康摘要', () => {
    it('内容不存在返回 null', async () => {
      mockDbSelect.mockReturnValue({
        from: vi.fn().mockReturnValue({
          where: vi.fn().mockResolvedValue([]),
        }),
      })
      const r = await getContentHealth('not_exist')
      expect(r).toBeNull()
    })

    it('返回完整健康摘要', async () => {
      let callCount = 0
      mockDbSelect.mockImplementation(() => {
        callCount++
        if (callCount === 1) {
          // getContentHealth 的 db.select().from(tourContent).where(...)
          return {
            from: vi.fn().mockReturnValue({
              where: vi.fn().mockResolvedValue([
                {
                  id: 'c1',
                  viewCount: 100,
                  likeCount: 20,
                  status: 'published',
                  releaseStage: 'full',
                },
              ]),
            }),
          }
        }
        // computeAndReportCtr 的两次 db.select (Promise.all)
        return {
          from: vi.fn().mockReturnValue({
            where: vi.fn().mockResolvedValue([{ count: 100 }]),
          }),
        }
      })
      const r = await getContentHealth('c1')
      expect(r).not.toBeNull()
      expect(r!.contentId).toBe('c1')
      expect(r!.viewCount).toBe(100)
      expect(r!.likeCount).toBe(20)
      expect(r!.status).toBe('published')
      expect(r!.releaseStage).toBe('full')
    })
  })
})
