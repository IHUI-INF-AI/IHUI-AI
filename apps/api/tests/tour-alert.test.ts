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
  monitorAlerts: { id: 'id', status: 'status', resolvedAt: 'resolved_at' },
  tourContent: { id: 'id', releaseStage: 'release_stage', viewCount: 'view_count' },
  tourRecommendations: { contentId: 'content_id', clicked: 'clicked' },
}))

vi.mock('../src/utils/logger.js', () => ({
  logger: { info: vi.fn(), warn: vi.fn(), error: vi.fn(), debug: vi.fn() },
}))

import {
  registerRules,
  fireAlert,
  runAlertChecks,
  resolveAlert,
  createFailureRateRule,
  createLowCtrRule,
} from '../src/services/tour/tour-alert.js'

describe('tour-alert — 告警服务', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    registerRules([])
  })

  describe('fireAlert 触发告警', () => {
    it('调用 db.insert 写入告警', async () => {
      mockDbInsert.mockReturnValue({
        values: vi.fn().mockResolvedValue(undefined),
      })
      await fireAlert({
        name: 'test.alert',
        source: 'test',
        severity: 'warning',
        message: 'test message',
      })
      expect(mockDbInsert).toHaveBeenCalledTimes(1)
    })

    it('带 labels 时传递到 db.insert', async () => {
      const valuesMock = vi.fn().mockResolvedValue(undefined)
      mockDbInsert.mockReturnValue({ values: valuesMock })
      await fireAlert({
        name: 'test.alert',
        source: 'test',
        severity: 'critical',
        message: 'msg',
        labels: { contentId: 'c1' },
      })
      const args = valuesMock.mock.calls[0]![0]
      expect(args.labels).toEqual({ contentId: 'c1' })
      expect(args.annotations).toEqual({})
    })
  })

  describe('runAlertChecks 执行规则检查', () => {
    it('无规则时返回 0', async () => {
      const n = await runAlertChecks()
      expect(n).toBe(0)
    })

    it('规则未命中不写告警', async () => {
      registerRules([
        {
          name: 'rule1',
          severity: 'warning',
          check: async () => ({ fired: false }),
        },
      ])
      mockDbInsert.mockReturnValue({
        values: vi.fn().mockResolvedValue(undefined),
      })
      const n = await runAlertChecks()
      expect(n).toBe(0)
      expect(mockDbInsert).not.toHaveBeenCalled()
    })

    it('规则命中时写告警并返回 1', async () => {
      registerRules([
        {
          name: 'rule1',
          severity: 'critical',
          check: async () => ({ fired: true, message: 'triggered', labels: { k: 'v' } }),
        },
      ])
      mockDbInsert.mockReturnValue({
        values: vi.fn().mockResolvedValue(undefined),
      })
      const n = await runAlertChecks()
      expect(n).toBe(1)
      expect(mockDbInsert).toHaveBeenCalledTimes(1)
    })

    it('规则抛错时不计入 fired', async () => {
      registerRules([
        {
          name: 'rule1',
          severity: 'critical',
          check: async () => {
            throw new Error('check failed')
          },
        },
      ])
      const n = await runAlertChecks()
      expect(n).toBe(0)
    })

    it('规则未提供 message 时使用默认', async () => {
      registerRules([
        {
          name: 'rule1',
          severity: 'info',
          check: async () => ({ fired: true }),
        },
      ])
      const valuesMock = vi.fn().mockResolvedValue(undefined)
      mockDbInsert.mockReturnValue({ values: valuesMock })
      await runAlertChecks()
      const args = valuesMock.mock.calls[0]![0]
      expect(args.message).toBe('rule1 triggered')
    })

    it('多规则中部分命中只计 fired 数', async () => {
      registerRules([
        { name: 'r1', severity: 'info', check: async () => ({ fired: true }) },
        { name: 'r2', severity: 'info', check: async () => ({ fired: false }) },
        { name: 'r3', severity: 'info', check: async () => ({ fired: true }) },
      ])
      mockDbInsert.mockReturnValue({
        values: vi.fn().mockResolvedValue(undefined),
      })
      const n = await runAlertChecks()
      expect(n).toBe(2)
    })
  })

  describe('resolveAlert 标记告警恢复', () => {
    it('调用 db.update 设置 resolved', async () => {
      mockDbUpdate.mockReturnValue({
        set: vi.fn().mockReturnValue({
          where: vi.fn().mockResolvedValue(undefined),
        }),
      })
      await resolveAlert('alert-1')
      expect(mockDbUpdate).toHaveBeenCalledTimes(1)
    })
  })

  describe('createFailureRateRule 灰度失败率规则', () => {
    it('内容不存在时 fired=false', async () => {
      mockDbSelect.mockReturnValue({
        from: vi.fn().mockReturnValue({
          where: vi.fn().mockResolvedValue([]),
        }),
      })
      const rule = createFailureRateRule('c1')
      const r = await rule.check()
      expect(r.fired).toBe(false)
    })

    it('stage=off 时 fired=false', async () => {
      mockDbSelect.mockReturnValue({
        from: vi.fn().mockReturnValue({
          where: vi.fn().mockResolvedValue([{ stage: 'off', views: 0 }]),
        }),
      })
      const rule = createFailureRateRule('c1')
      const r = await rule.check()
      expect(r.fired).toBe(false)
    })

    it('非 full 阶段 viewCount=0 触发告警', async () => {
      mockDbSelect.mockReturnValue({
        from: vi.fn().mockReturnValue({
          where: vi.fn().mockResolvedValue([{ stage: 'canary_5pct', views: 0 }]),
        }),
      })
      const rule = createFailureRateRule('c1')
      const r = await rule.check()
      expect(r.fired).toBe(true)
      expect(r.labels?.stage).toBe('canary_5pct')
    })

    it('full 阶段 viewCount=0 不触发（除 full 之外）', async () => {
      mockDbSelect.mockReturnValue({
        from: vi.fn().mockReturnValue({
          where: vi.fn().mockResolvedValue([{ stage: 'full', views: 0 }]),
        }),
      })
      const rule = createFailureRateRule('c1')
      const r = await rule.check()
      expect(r.fired).toBe(false)
    })

    it('规则名包含 contentId', () => {
      const rule = createFailureRateRule('c1')
      expect(rule.name).toContain('c1')
    })

    it('severity=critical', () => {
      const rule = createFailureRateRule('c1')
      expect(rule.severity).toBe('critical')
    })
  })

  describe('createLowCtrRule 低 CTR 规则', () => {
    it('总样本 < 100 时 fired=false', async () => {
      mockDbSelect.mockReturnValue({
        from: vi.fn().mockReturnValue({
          where: vi.fn().mockResolvedValue([{ clicked: 0, total: 50 }]),
        }),
      })
      const rule = createLowCtrRule('c1')
      const r = await rule.check()
      expect(r.fired).toBe(false)
    })

    it('CTR 低于阈值时 fired=true', async () => {
      mockDbSelect.mockReturnValue({
        from: vi.fn().mockReturnValue({
          where: vi.fn().mockResolvedValue([{ clicked: 0, total: 200 }]),
        }),
      })
      const rule = createLowCtrRule('c1', 0.01)
      const r = await rule.check()
      expect(r.fired).toBe(true)
      expect(r.message).toContain('点击率')
    })

    it('CTR 等于阈值时 fired=false', async () => {
      // ctr = 1/100 = 0.01 = 阈值 0.01，不小于，fired=false
      mockDbSelect.mockReturnValue({
        from: vi.fn().mockReturnValue({
          where: vi.fn().mockResolvedValue([{ clicked: 1, total: 100 }]),
        }),
      })
      const rule = createLowCtrRule('c1', 0.01)
      const r = await rule.check()
      expect(r.fired).toBe(false)
    })

    it('CTR 高于阈值时 fired=false', async () => {
      mockDbSelect.mockReturnValue({
        from: vi.fn().mockReturnValue({
          where: vi.fn().mockResolvedValue([{ clicked: 10, total: 100 }]),
        }),
      })
      const rule = createLowCtrRule('c1', 0.01)
      const r = await rule.check()
      expect(r.fired).toBe(false)
    })

    it('severity=info', () => {
      const rule = createLowCtrRule('c1')
      expect(rule.severity).toBe('info')
    })
  })
})
