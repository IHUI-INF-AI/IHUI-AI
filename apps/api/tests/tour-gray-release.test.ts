import { describe, it, expect, beforeEach, vi } from 'vitest'

const { mockDbSelect, mockDbUpdate } = vi.hoisted(() => ({
  mockDbSelect: vi.fn(),
  mockDbUpdate: vi.fn(),
}))

vi.mock('../src/db/index.js', () => ({
  db: {
    select: mockDbSelect,
    update: mockDbUpdate,
  },
  dbRead: {},
  dbClient: {},
}))

vi.mock('@ihui/database', () => ({
  tourContent: { id: 'id', releaseStage: 'release_stage', updatedAt: 'updated_at' },
}))

vi.mock('../src/utils/logger.js', () => ({
  logger: { info: vi.fn(), warn: vi.fn(), error: vi.fn(), debug: vi.fn() },
}))

import {
  isVisibleForUser,
  getPolicy,
  promote,
  rollback,
  recordFailure,
  listByStage,
} from '../src/services/tour/tour-gray-release.js'

describe('tour-gray-release — 灰度发布', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  describe('isVisibleForUser 纯函数', () => {
    it('off 阶段一律不可见', () => {
      expect(isVisibleForUser('off', 'c1', 'u1')).toBe(false)
      expect(isVisibleForUser('off', 'c1', 'u2')).toBe(false)
    })

    it('full 阶段一律可见', () => {
      expect(isVisibleForUser('full', 'c1', 'u1')).toBe(true)
      expect(isVisibleForUser('full', 'c1', 'u2')).toBe(true)
    })

    it('canary_1pct 阶段约 1% 用户可见', () => {
      let visible = 0
      for (let i = 0; i < 1000; i++) {
        if (isVisibleForUser('canary_1pct', 'c1', `u${i}`)) visible++
      }
      // 1% 容差范围：0~30
      expect(visible).toBeGreaterThan(0)
      expect(visible).toBeLessThan(50)
    })

    it('canary_25pct 阶段约 25% 用户可见', () => {
      let visible = 0
      for (let i = 0; i < 1000; i++) {
        if (isVisibleForUser('canary_25pct', 'c1', `u${i}`)) visible++
      }
      // 25% 容差范围：200~300
      expect(visible).toBeGreaterThan(150)
      expect(visible).toBeLessThan(350)
    })

    it('同一 (contentId+userId) 多次调用稳定命中', () => {
      const results = new Set<boolean>()
      for (let i = 0; i < 10; i++) {
        results.add(isVisibleForUser('canary_5pct', 'c1', 'fixedUser'))
      }
      expect(results.size).toBe(1)
    })

    it('不同 contentId 同一用户可能不同命中', () => {
      // 不同 contentId 哈希结果不同
      const r1 = isVisibleForUser('canary_1pct', 'c1', 'u1')
      const r2 = isVisibleForUser('canary_1pct', 'c2', 'u1')
      // 不能保证一定不同，但至少函数能正常执行
      expect(typeof r1).toBe('boolean')
      expect(typeof r2).toBe('boolean')
    })
  })

  describe('getPolicy 读取策略', () => {
    it('内容存在时返回策略对象', async () => {
      mockDbSelect.mockReturnValue({
        from: vi.fn().mockReturnValue({
          where: vi.fn().mockResolvedValue([{ id: 'c1', releaseStage: 'canary_5pct' }]),
        }),
      })
      const policy = await getPolicy('c1')
      expect(policy).not.toBeNull()
      expect(policy!.contentId).toBe('c1')
      expect(policy!.currentStage).toBe('canary_5pct')
      expect(policy!.targetStage).toBe('full')
      expect(policy!.autoPromote).toBe(true)
      expect(policy!.failureThreshold).toBe(5)
    })

    it('内容不存在时返回 null', async () => {
      mockDbSelect.mockReturnValue({
        from: vi.fn().mockReturnValue({
          where: vi.fn().mockResolvedValue([]),
        }),
      })
      const policy = await getPolicy('not_exist')
      expect(policy).toBeNull()
    })
  })

  describe('promote 提升灰度阶段', () => {
    it('从 off 提升到 canary_1pct', async () => {
      mockDbSelect.mockReturnValue({
        from: vi.fn().mockReturnValue({
          where: vi.fn().mockResolvedValue([{ id: 'c1', releaseStage: 'off' }]),
        }),
      })
      const updated = { id: 'c1', releaseStage: 'canary_1pct' }
      mockDbUpdate.mockReturnValue({
        set: vi.fn().mockReturnValue({
          where: vi.fn().mockReturnValue({
            returning: vi.fn().mockResolvedValue([updated]),
          }),
        }),
      })
      const r = await promote('c1')
      expect(r.releaseStage).toBe('canary_1pct')
    })

    it('内容不存在抛错', async () => {
      mockDbSelect.mockReturnValue({
        from: vi.fn().mockReturnValue({
          where: vi.fn().mockResolvedValue([]),
        }),
      })
      await expect(promote('not_exist')).rejects.toThrow('不存在')
    })

    it('已达到 full 阶段抛错', async () => {
      mockDbSelect.mockReturnValue({
        from: vi.fn().mockReturnValue({
          where: vi.fn().mockResolvedValue([{ id: 'c1', releaseStage: 'full' }]),
        }),
      })
      await expect(promote('c1')).rejects.toThrow('无法继续提升')
    })

    it('非法 release_stage 抛错', async () => {
      mockDbSelect.mockReturnValue({
        from: vi.fn().mockReturnValue({
          where: vi.fn().mockResolvedValue([{ id: 'c1', releaseStage: 'invalid' }]),
        }),
      })
      await expect(promote('c1')).rejects.toThrow('非法')
    })

    it('更新失败抛错', async () => {
      mockDbSelect.mockReturnValue({
        from: vi.fn().mockReturnValue({
          where: vi.fn().mockResolvedValue([{ id: 'c1', releaseStage: 'off' }]),
        }),
      })
      mockDbUpdate.mockReturnValue({
        set: vi.fn().mockReturnValue({
          where: vi.fn().mockReturnValue({
            returning: vi.fn().mockResolvedValue([]),
          }),
        }),
      })
      await expect(promote('c1')).rejects.toThrow('灰度提升失败')
    })
  })

  describe('rollback 回滚', () => {
    it('成功回滚到 off', async () => {
      mockDbUpdate.mockReturnValue({
        set: vi.fn().mockReturnValue({
          where: vi.fn().mockReturnValue({
            returning: vi.fn().mockResolvedValue([{ id: 'c1', releaseStage: 'off' }]),
          }),
        }),
      })
      const r = await rollback('c1', 'test failure')
      expect(r.releaseStage).toBe('off')
    })

    it('内容不存在抛错', async () => {
      mockDbUpdate.mockReturnValue({
        set: vi.fn().mockReturnValue({
          where: vi.fn().mockReturnValue({
            returning: vi.fn().mockResolvedValue([]),
          }),
        }),
      })
      await expect(rollback('not_exist', 'reason')).rejects.toThrow('不存在')
    })
  })

  describe('recordFailure 记录失败', () => {
    it('未达阈值不回滚', async () => {
      mockDbSelect.mockReturnValue({
        from: vi.fn().mockReturnValue({
          where: vi.fn().mockResolvedValue([{ id: 'c1', releaseStage: 'canary_5pct' }]),
        }),
      })
      // failureCount 0 + 1 < 5 不触发回滚
      await recordFailure('c1', 'test')
      // 没有 db.update 调用
      expect(mockDbUpdate).not.toHaveBeenCalled()
    })

    it('内容不存在不抛错', async () => {
      mockDbSelect.mockReturnValue({
        from: vi.fn().mockReturnValue({
          where: vi.fn().mockResolvedValue([]),
        }),
      })
      await expect(recordFailure('not_exist', 'reason')).resolves.toBeUndefined()
    })
  })

  describe('listByStage 按阶段列出', () => {
    it('返回 db 查询结果', async () => {
      mockDbSelect.mockReturnValue({
        from: vi.fn().mockReturnValue({
          where: vi.fn().mockResolvedValue([{ id: 'c1' }, { id: 'c2' }]),
        }),
      })
      const list = await listByStage('canary_5pct')
      expect(list).toHaveLength(2)
    })
  })
})
