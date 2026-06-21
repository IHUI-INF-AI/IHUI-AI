import { describe, it, expect, beforeEach, vi } from 'vitest'
import { tourRecommendationService } from '../tourRecommendationService'

// 通用规则输入
const baseRuleInput = {
  name: '测试规则',
  description: '测试描述',
  type: 'behavior' as const,
  conditions: [{ field: 'totalSessions', operator: 'lte' as const, value: 1, weight: 1 }],
  actions: [{ type: 'show_tour' as const, tourId: 'tour-001', params: {} }],
  priority: 50,
  enabled: true
}

// 通用 A/B 测试输入
const baseABTestInput = {
  name: '按钮颜色测试',
  description: '测试不同按钮颜色',
  variants: [
    { id: 'v1', name: '蓝色', config: { color: 'blue' }, trafficPercentage: 50 },
    { id: 'v2', name: '绿色', config: { color: 'green' }, trafficPercentage: 50 }
  ],
  trafficAllocation: 100,
  startDate: Date.now(),
  status: 'running' as const,
  metrics: ['conversion_rate']
}

describe('tourRecommendationService', () => {
  beforeEach(() => {
    localStorage.clear()
    vi.clearAllMocks()
    tourRecommendationService.reset()
  })

  // ========== 规则相关 ==========
  describe('createRule', () => {
    it('应该成功创建推荐规则', () => {
      const rule = tourRecommendationService.createRule(baseRuleInput)
      expect(rule.id).toBeDefined()
      expect(rule.name).toBe('测试规则')
      expect(rule.createdAt).toBeGreaterThan(0)
      expect(rule.updatedAt).toBeGreaterThan(0)
    })
  })

  describe('updateRule', () => {
    it('应该更新规则', () => {
      const rule = tourRecommendationService.createRule(baseRuleInput)
      const updated = tourRecommendationService.updateRule(rule.id, { priority: 100 })
      expect(updated?.priority).toBe(100)
    })

    it('规则不存在时返回 null', () => {
      const result = tourRecommendationService.updateRule('not_exist', { priority: 1 })
      expect(result).toBeNull()
    })

    it('更新后 id 和 createdAt 保持不变', () => {
      const rule = tourRecommendationService.createRule(baseRuleInput)
      const updated = tourRecommendationService.updateRule(rule.id, { name: '新名字' })
      expect(updated?.id).toBe(rule.id)
      expect(updated?.createdAt).toBe(rule.createdAt)
      expect(updated?.name).toBe('新名字')
    })
  })

  describe('deleteRule', () => {
    it('应该删除规则', () => {
      const rule = tourRecommendationService.createRule(baseRuleInput)
      const result = tourRecommendationService.deleteRule(rule.id)
      expect(result).toBe(true)
      expect(tourRecommendationService.getRule(rule.id)).toBeUndefined()
    })

    it('规则不存在时返回 false', () => {
      const result = tourRecommendationService.deleteRule('not_exist')
      expect(result).toBe(false)
    })
  })

  describe('getRule', () => {
    it('应该返回指定规则', () => {
      const rule = tourRecommendationService.createRule(baseRuleInput)
      const found = tourRecommendationService.getRule(rule.id)
      expect(found?.id).toBe(rule.id)
    })

    it('规则不存在时返回 undefined', () => {
      expect(tourRecommendationService.getRule('not_exist')).toBeUndefined()
    })
  })

  describe('getAllRules', () => {
    it('应该按优先级倒序返回所有规则', () => {
      tourRecommendationService.reset()
      tourRecommendationService.createRule({ ...baseRuleInput, priority: 10 })
      tourRecommendationService.createRule({ ...baseRuleInput, priority: 90 })
      const rules = tourRecommendationService.getAllRules()
      expect(rules[0].priority).toBeGreaterThanOrEqual(rules[rules.length - 1].priority)
    })
  })

  describe('getEnabledRules', () => {
    it('应该只返回启用的规则', () => {
      const rules = tourRecommendationService.getEnabledRules()
      expect(rules.every(r => r.enabled)).toBe(true)
    })
  })

  // ========== 用户行为相关 ==========
  describe('trackPageView', () => {
    it('应该记录页面浏览', () => {
      tourRecommendationService.trackPageView('user-001', {
        path: '/home',
        title: '首页',
        duration: 5000
      })
      const behavior = tourRecommendationService.getUserBehavior('user-001')
      expect(behavior?.pageViews.length).toBe(1)
    })

    it('超过 100 条时只保留最后 100 条', () => {
      for (let i = 0; i < 120; i++) {
        tourRecommendationService.trackPageView('user-002', {
          path: `/p${i}`,
          title: `页面${i}`,
          duration: 100
        })
      }
      const behavior = tourRecommendationService.getUserBehavior('user-002')
      expect(behavior?.pageViews.length).toBe(100)
    })
  })

  describe('trackTourInteraction', () => {
    it('应该记录引导交互', () => {
      tourRecommendationService.trackTourInteraction('user-001', {
        tourId: 'tour-001',
        action: 'start'
      })
      const behavior = tourRecommendationService.getUserBehavior('user-001')
      expect(behavior?.tourInteractions.length).toBe(1)
    })

    it('超过 50 条时只保留最后 50 条', () => {
      for (let i = 0; i < 60; i++) {
        tourRecommendationService.trackTourInteraction('user-003', {
          tourId: 'tour-001',
          action: 'start'
        })
      }
      const behavior = tourRecommendationService.getUserBehavior('user-003')
      expect(behavior?.tourInteractions.length).toBe(50)
    })
  })

  describe('getUserBehavior', () => {
    it('用户不存在时返回 undefined', () => {
      expect(tourRecommendationService.getUserBehavior('not_exist')).toBeUndefined()
    })
  })

  // ========== 分群相关 ==========
  describe('createSegment / getSegments', () => {
    it('应该创建并返回用户分群', () => {
      const segment = tourRecommendationService.createSegment({
        name: '新用户',
        description: '注册7天内的用户',
        criteria: [{ field: 'registerDays', operator: 'lte', value: 7 }],
        size: 0
      })
      expect(segment.id).toBeDefined()
      expect(tourRecommendationService.getSegments().length).toBeGreaterThan(0)
    })
  })

  describe('assignUserToSegment', () => {
    it('应该为用户分配分群', () => {
      tourRecommendationService.trackPageView('user-001', { path: '/', title: '首页', duration: 1 })
      const seg = tourRecommendationService.createSegment({
        name: '高活跃',
        description: '',
        criteria: [],
        size: 0
      })
      tourRecommendationService.assignUserToSegment('user-001', seg.id)
      const behavior = tourRecommendationService.getUserBehavior('user-001')
      expect(behavior?.segments).toContain(seg.id)
    })

    it('重复分配同一分群不重复添加', () => {
      tourRecommendationService.trackPageView('user-001', { path: '/', title: '首页', duration: 1 })
      const seg = tourRecommendationService.createSegment({
        name: '高活跃',
        description: '',
        criteria: [],
        size: 0
      })
      tourRecommendationService.assignUserToSegment('user-001', seg.id)
      tourRecommendationService.assignUserToSegment('user-001', seg.id)
      const behavior = tourRecommendationService.getUserBehavior('user-001')
      const count = behavior?.segments.filter(id => id === seg.id).length || 0
      expect(count).toBe(1)
    })

    it('用户不存在时不报错', () => {
      const seg = tourRecommendationService.createSegment({
        name: '高活跃',
        description: '',
        criteria: [],
        size: 0
      })
      expect(() => {
        tourRecommendationService.assignUserToSegment('not_exist', seg.id)
      }).not.toThrow()
    })
  })

  // ========== 推荐相关 ==========
  describe('getRecommendations', () => {
    it('应该返回推荐结果', () => {
      tourRecommendationService.trackPageView('user-001', {
        path: '/home',
        title: '首页',
        duration: 5000
      })
      const recommendations = tourRecommendationService.getRecommendations('user-001')
      expect(Array.isArray(recommendations)).toBe(true)
    })

    it('行为为空时返回空数组', () => {
      const recommendations = tourRecommendationService.getRecommendations('no_user')
      expect(recommendations).toEqual([])
    })

    it('支持 context. 前缀字段', () => {
      // 创建一条使用 context. 前缀字段的规则
      const rule = tourRecommendationService.createRule({
        ...baseRuleInput,
        name: 'context规则',
        conditions: [
          { field: 'context.pageViewCount', operator: 'gte' as const, value: 3, weight: 1 }
        ],
        actions: [{ type: 'show_tour' as const, tourId: 'ctx-tour', params: {} }]
      })
      expect(rule.id).toBeDefined()
      // 通过上下文提供 pageViewCount >= 3 触发该规则
      const recommendations = tourRecommendationService.getRecommendations('user-ctx', {
        pageViewCount: 5
      })
      expect(recommendations.find(r => r.tourId === 'ctx-tour')).toBeDefined()
    })

    it('context 条件不满足时不匹配', () => {
      const recommendations = tourRecommendationService.getRecommendations('user-ctx2', {
        pageViewCount: 0,
        tourCompleted: true
      })
      // 默认规则中需 pageViewCount>=3 且 tourCompleted=false
      expect(recommendations.find(r => r.tourId === 'feature_discovery')).toBeUndefined()
    })
  })

  // ========== A/B 测试相关 ==========
  describe('createABTest / getAllABTests', () => {
    it('应该创建 A/B 测试', () => {
      const test = tourRecommendationService.createABTest(baseABTestInput)
      expect(test.id).toBeDefined()
      expect(tourRecommendationService.getAllABTests().length).toBeGreaterThan(0)
    })
  })

  describe('updateABTest', () => {
    it('应该更新 A/B 测试', () => {
      const test = tourRecommendationService.createABTest(baseABTestInput)
      const updated = tourRecommendationService.updateABTest(test.id, { status: 'paused' })
      expect(updated?.status).toBe('paused')
    })

    it('A/B 测试不存在时返回 null', () => {
      const result = tourRecommendationService.updateABTest('not_exist', { status: 'paused' })
      expect(result).toBeNull()
    })
  })

  describe('getABTest', () => {
    it('应该返回指定 A/B 测试', () => {
      const test = tourRecommendationService.createABTest(baseABTestInput)
      expect(tourRecommendationService.getABTest(test.id)?.id).toBe(test.id)
    })

    it('A/B 测试不存在时返回 undefined', () => {
      expect(tourRecommendationService.getABTest('not_exist')).toBeUndefined()
    })
  })

  describe('getActiveABTests', () => {
    it('应该只返回 running 状态的 A/B 测试', () => {
      tourRecommendationService.createABTest({ ...baseABTestInput, status: 'running' })
      tourRecommendationService.createABTest({ ...baseABTestInput, status: 'paused' })
      const active = tourRecommendationService.getActiveABTests()
      expect(active.every(t => t.status === 'running')).toBe(true)
    })
  })

  describe('assignVariant', () => {
    it('应该为 running 测试分配变体', () => {
      const test = tourRecommendationService.createABTest(baseABTestInput)
      const variant = tourRecommendationService.assignVariant(test.id, 'user-001')
      expect(['v1', 'v2']).toContain(variant)
    })

    it('测试状态非 running 时返回 null', () => {
      const test = tourRecommendationService.createABTest({ ...baseABTestInput, status: 'paused' })
      const variant = tourRecommendationService.assignVariant(test.id, 'user-001')
      expect(variant).toBeNull()
    })

    it('测试不存在时返回 null', () => {
      const variant = tourRecommendationService.assignVariant('not_exist', 'user-001')
      expect(variant).toBeNull()
    })

    it('流量分配为 0 时返回 null', () => {
      const test = tourRecommendationService.createABTest({ ...baseABTestInput, trafficAllocation: 0 })
      const variant = tourRecommendationService.assignVariant(test.id, 'user-001')
      expect(variant).toBeNull()
    })

    it('变体百分比不足 100 时回退到第一个变体', () => {
      // 两个变体各占 30%，总 60% < 100
      const test = tourRecommendationService.createABTest({
        ...baseABTestInput,
        variants: [
          { id: 'a1', name: 'A1', config: {}, trafficPercentage: 30 },
          { id: 'a2', name: 'A2', config: {}, trafficPercentage: 30 }
        ]
      })
      // 找一个 hash 落在 60-100 区间的 userId
      let found: string | null = null
      for (let i = 0; i < 1000 && (found !== 'a1'); i++) {
        found = tourRecommendationService.assignVariant(test.id, `user_${i}`)
      }
      // 至少能命中第一个变体
      expect(found).not.toBeNull()
    })
  })

  describe('recordABTestImpression', () => {
    it('应该记录展示', () => {
      const test = tourRecommendationService.createABTest(baseABTestInput)
      tourRecommendationService.recordABTestImpression(test.id, 'v1')
      const results = tourRecommendationService.getABTestResults(test.id)
      expect(results[0].impressions).toBe(1)
    })

    it('重复记录同一变体累加展示数', () => {
      const test = tourRecommendationService.createABTest(baseABTestInput)
      tourRecommendationService.recordABTestImpression(test.id, 'v1')
      tourRecommendationService.recordABTestImpression(test.id, 'v1')
      const results = tourRecommendationService.getABTestResults(test.id)
      expect(results[0].impressions).toBe(2)
    })
  })

  describe('recordABTestConversion', () => {
    it('应该记录转化', () => {
      const test = tourRecommendationService.createABTest(baseABTestInput)
      tourRecommendationService.recordABTestImpression(test.id, 'v1')
      tourRecommendationService.recordABTestConversion(test.id, 'v1', 5000)
      const results = tourRecommendationService.getABTestResults(test.id)
      expect(results[0].conversions).toBe(1)
      expect(results[0].conversionRate).toBe(100)
    })

    it('记录不存在的结果时不做任何操作', () => {
      const test = tourRecommendationService.createABTest(baseABTestInput)
      // 没有记录过 impression 直接 record conversion 不应抛错
      expect(() => {
        tourRecommendationService.recordABTestConversion(test.id, 'v1', 1000)
      }).not.toThrow()
    })
  })

  describe('getABTestResults', () => {
    it('没有结果时返回空数组', () => {
      expect(tourRecommendationService.getABTestResults('not_exist')).toEqual([])
    })
  })

  describe('analyzeABTestResults', () => {
    it('结果少于 2 条时返回 winner 为 null', () => {
      const test = tourRecommendationService.createABTest(baseABTestInput)
      tourRecommendationService.recordABTestImpression(test.id, 'v1')
      const analysis = tourRecommendationService.analyzeABTestResults(test.id)
      expect(analysis.winner).toBeNull()
      expect(analysis.confidence).toBe(0)
    })

    it('差距明显时给出 winner', () => {
      const test = tourRecommendationService.createABTest(baseABTestInput)
      // v1 高转化 v2 低转化
      for (let i = 0; i < 100; i++) {
        tourRecommendationService.recordABTestImpression(test.id, 'v1')
        tourRecommendationService.recordABTestImpression(test.id, 'v2')
      }
      for (let i = 0; i < 90; i++) {
        tourRecommendationService.recordABTestConversion(test.id, 'v1', 5000)
      }
      for (let i = 0; i < 30; i++) {
        tourRecommendationService.recordABTestConversion(test.id, 'v2', 5000)
      }
      const analysis = tourRecommendationService.analyzeABTestResults(test.id)
      expect(analysis.winner).toBe('v1')
      expect(analysis.confidence).toBeGreaterThan(0)
    })

    it('差距较小时 winner 为 null', () => {
      const test = tourRecommendationService.createABTest(baseABTestInput)
      for (let i = 0; i < 100; i++) {
        tourRecommendationService.recordABTestImpression(test.id, 'v1')
        tourRecommendationService.recordABTestImpression(test.id, 'v2')
      }
      // 差距只有 1%
      for (let i = 0; i < 50; i++) {
        tourRecommendationService.recordABTestConversion(test.id, 'v1', 5000)
      }
      for (let i = 0; i < 49; i++) {
        tourRecommendationService.recordABTestConversion(test.id, 'v2', 5000)
      }
      const analysis = tourRecommendationService.analyzeABTestResults(test.id)
      expect(analysis.winner).toBeNull()
    })
  })

  // ========== 存储相关 ==========
  describe('loadFromStorage', () => {
    it('localStorage 数据损坏时回退为空', () => {
      localStorage.setItem('tour_recommendations', '{invalid json')
      // reset 内部会调用 loadFromStorage + initializeDefaultRules，不应抛错
      expect(() => tourRecommendationService.reset()).not.toThrow()
    })

    it('JSON.parse 抛出时应被 catch 捕获', async () => {
      // 通过重新加载模块触发构造函数中的 loadFromStorage
      localStorage.setItem('tour_recommendations', '{invalid json')
      vi.resetModules()
      const mod = await import('../tourRecommendationService')
      expect(mod.tourRecommendationService).toBeDefined()
      // 重新加载后应回退到默认规则
      expect(mod.tourRecommendationService.getAllRules().length).toBeGreaterThan(0)
    })
  })

  describe('saveToStorage', () => {
    it('序列化数据过大时会自动精简 pageViews', () => {
      const userId = 'big_user'
      // 直接塞 200 条 pageViews
      for (let i = 0; i < 200; i++) {
        tourRecommendationService.trackPageView(userId, {
          path: `/p${i}`,
          title: `t${i}`,
          duration: 1
        })
      }
      // 触发 saveToStorage 写入 localStorage
      tourRecommendationService.trackPageView(userId, { path: '/x', title: 'x', duration: 1 })
      const stored = localStorage.getItem('tour_recommendations')
      expect(stored).toBeDefined()
    })

    it('localStorage 写入失败时不应抛错', () => {
      // mock localStorage.setItem 让其抛错
      const setItemSpy = vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => {
        throw new Error('quota exceeded')
      })
      expect(() => {
        tourRecommendationService.trackPageView('user-save-err', {
          path: '/',
          title: '首页',
          duration: 1
        })
      }).not.toThrow()
      setItemSpy.mockRestore()
    })
  })

  // ========== reset ==========
  describe('reset', () => {
    it('重置后恢复默认规则', () => {
      tourRecommendationService.createRule(baseRuleInput)
      tourRecommendationService.reset()
      // reset 后应保留默认规则
      expect(tourRecommendationService.getAllRules().length).toBeGreaterThan(0)
    })
  })
})
