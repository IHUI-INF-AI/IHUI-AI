import { describe, it, expect, beforeEach } from 'vitest'
import {
  DataQualityMonitor,
  DQDimension,
  AlertLevel,
  DEFAULT_DQ_CONFIG,
  createRule,
  type DQRule,
} from '../src/utils/data-quality-monitor.js'

describe('data-quality-monitor — 数据质量监控', () => {
  let m: DataQualityMonitor
  beforeEach(() => {
    m = new DataQualityMonitor()
  })

  describe('枚举与默认配置', () => {
    it('DQDimension 6 个维度', () => {
      expect(DQDimension.COMPLETENESS).toBe('COMPLETENESS')
      expect(DQDimension.ACCURACY).toBe('ACCURACY')
      expect(DQDimension.CONSISTENCY).toBe('CONSISTENCY')
      expect(DQDimension.TIMELINESS).toBe('TIMELINESS')
      expect(DQDimension.UNIQUENESS).toBe('UNIQUENESS')
      expect(DQDimension.VALIDITY).toBe('VALIDITY')
    })
    it('AlertLevel 5 个级别', () => {
      expect(AlertLevel.OK).toBe('OK')
      expect(AlertLevel.INFO).toBe('INFO')
      expect(AlertLevel.WARN).toBe('WARN')
      expect(AlertLevel.ERROR).toBe('ERROR')
      expect(AlertLevel.CRITICAL).toBe('CRITICAL')
    })
    it('DEFAULT_DQ_CONFIG 默认值', () => {
      expect(DEFAULT_DQ_CONFIG.windowSec).toBe(300)
      expect(DEFAULT_DQ_CONFIG.maxSamples).toBe(10_000)
      expect(DEFAULT_DQ_CONFIG.maxViolations).toBe(5000)
      expect(DEFAULT_DQ_CONFIG.maxAlertsPerRule).toBe(50)
    })
  })

  describe('createRule 工厂', () => {
    it('使用默认值填充', () => {
      const r = createRule({ ruleId: 'r1', dimension: DQDimension.COMPLETENESS, dataset: 'ds' })
      expect(r.name).toBe('r1')
      expect(r.targetField).toBe('')
      expect(r.threshold).toBe(0)
      expect(r.comparison).toBe('lt')
      expect(r.enabled).toBe(true)
      expect(r.params).toEqual({})
      expect(r.description).toBe('')
      expect(r.createdAt).toBeGreaterThan(0)
    })
    it('透传显式值', () => {
      const r = createRule({
        ruleId: 'r1',
        dimension: DQDimension.COMPLETENESS,
        dataset: 'ds',
        name: 'myRule',
        targetField: 'email',
        threshold: 0.95,
        comparison: 'ge',
      })
      expect(r.name).toBe('myRule')
      expect(r.targetField).toBe('email')
      expect(r.threshold).toBe(0.95)
      expect(r.comparison).toBe('ge')
    })
  })

  describe('规则管理', () => {
    it('addRule / getRule / removeRule', () => {
      const r = createRule({ ruleId: 'r1', dimension: DQDimension.COMPLETENESS, dataset: 'ds' })
      m.addRule(r)
      expect(m.getRule('r1')).toBe(r)
      expect(m.removeRule('r1')).toBe(true)
      expect(m.getRule('r1')).toBeUndefined()
      expect(m.removeRule('r1')).toBe(false)
    })
    it('enableRule 切换状态', () => {
      const r = createRule({ ruleId: 'r1', dimension: DQDimension.COMPLETENESS, dataset: 'ds' })
      m.addRule(r)
      expect(m.enableRule('r1', false)).toBe(true)
      expect(m.getRule('r1')!.enabled).toBe(false)
      expect(m.enableRule('r1')).toBe(true)
      expect(m.getRule('r1')!.enabled).toBe(true)
      expect(m.enableRule('nope')).toBe(false)
    })
    it('listRules 按 dataset 过滤', () => {
      m.addRule(createRule({ ruleId: 'r1', dimension: DQDimension.COMPLETENESS, dataset: 'a' }))
      m.addRule(createRule({ ruleId: 'r2', dimension: DQDimension.COMPLETENESS, dataset: 'b' }))
      expect(m.listRules()).toHaveLength(2)
      expect(m.listRules('a')).toHaveLength(1)
      expect(m.listRules('a')[0]!.ruleId).toBe('r1')
    })
  })

  describe('COMPLETENESS 完整性', () => {
    it('字段缺失判违规', () => {
      m.addRule(
        createRule({
          ruleId: 'c1',
          dimension: DQDimension.COMPLETENESS,
          dataset: 'ds',
          targetField: 'name',
        }),
      )
      m.feed('ds', { age: 18 })
      expect(m.getViolations()).toHaveLength(1)
      expect(m.getViolations()[0]!.ruleId).toBe('c1')
    })
    it('null / 空字符串 / 空数组 / 空对象判违规', () => {
      m.addRule(
        createRule({
          ruleId: 'c1',
          dimension: DQDimension.COMPLETENESS,
          dataset: 'ds',
          targetField: 'name',
        }),
      )
      m.feed('ds', { name: null })
      m.feed('ds', { name: '' })
      m.feed('ds', { name: '   ' })
      m.feed('ds', { name: [] })
      m.feed('ds', { name: {} })
      expect(m.getViolations()).toHaveLength(5)
    })
    it('非空字符串判通过', () => {
      m.addRule(
        createRule({
          ruleId: 'c1',
          dimension: DQDimension.COMPLETENESS,
          dataset: 'ds',
          targetField: 'name',
        }),
      )
      m.feed('ds', { name: 'alice' })
      expect(m.getViolations()).toHaveLength(0)
    })
  })

  describe('ACCURACY 准确性', () => {
    it('allowedValues 校验', () => {
      m.addRule(
        createRule({
          ruleId: 'a1',
          dimension: DQDimension.ACCURACY,
          dataset: 'ds',
          targetField: 'status',
          params: { allowedValues: ['active', 'inactive'] },
        }),
      )
      m.feed('ds', { status: 'active' })
      m.feed('ds', { status: 'unknown' })
      expect(m.getViolations()).toHaveLength(1)
    })
    it('pattern 正则校验', () => {
      m.addRule(
        createRule({
          ruleId: 'a1',
          dimension: DQDimension.ACCURACY,
          dataset: 'ds',
          targetField: 'code',
          params: { pattern: '^\\d{4}$' },
        }),
      )
      m.feed('ds', { code: '1234' })
      m.feed('ds', { code: 'abcd' })
      expect(m.getViolations()).toHaveLength(1)
    })
    it('minValue/maxValue 范围校验', () => {
      m.addRule(
        createRule({
          ruleId: 'a1',
          dimension: DQDimension.ACCURACY,
          dataset: 'ds',
          targetField: 'age',
          params: { minValue: 0, maxValue: 150 },
        }),
      )
      m.feed('ds', { age: 30 })
      m.feed('ds', { age: -1 })
      m.feed('ds', { age: 200 })
      expect(m.getViolations()).toHaveLength(2)
    })
  })

  describe('CONSISTENCY 一致性', () => {
    it('字段对相等校验', () => {
      m.addRule(
        createRule({
          ruleId: 'cs1',
          dimension: DQDimension.CONSISTENCY,
          dataset: 'ds',
          targetField: '',
          params: { fieldPairs: [{ a: 'email', b: 'confirmEmail' }] },
        }),
      )
      m.feed('ds', { email: 'a@b.c', confirmEmail: 'a@b.c' })
      m.feed('ds', { email: 'a@b.c', confirmEmail: 'x@y.z' })
      expect(m.getViolations()).toHaveLength(1)
    })
  })

  describe('TIMELINESS 及时性', () => {
    it('时间戳在允许延迟内通过', () => {
      m.addRule(
        createRule({
          ruleId: 't1',
          dimension: DQDimension.TIMELINESS,
          dataset: 'ds',
          targetField: 'eventTime',
          params: { maxDelaySec: 10 },
        }),
      )
      const now = Date.now() / 1000
      m.feed('ds', { eventTime: now - 5 })
      expect(m.getViolations()).toHaveLength(0)
    })
    it('超出延迟判违规（CRITICAL）', () => {
      m.addRule(
        createRule({
          ruleId: 't1',
          dimension: DQDimension.TIMELINESS,
          dataset: 'ds',
          targetField: 'eventTime',
          params: { maxDelaySec: 10 },
        }),
      )
      const now = Date.now() / 1000
      m.feed('ds', { eventTime: now - 100 })
      const v = m.getViolations()
      expect(v).toHaveLength(1)
      expect(v[0]!.level).toBe(AlertLevel.CRITICAL)
    })
    it('支持字符串时间戳', () => {
      m.addRule(
        createRule({
          ruleId: 't1',
          dimension: DQDimension.TIMELINESS,
          dataset: 'ds',
          targetField: 'eventTime',
          params: { maxDelaySec: 1000 },
        }),
      )
      m.feed('ds', { eventTime: new Date().toISOString() })
      expect(m.getViolations()).toHaveLength(0)
    })
  })

  describe('UNIQUENESS 唯一性', () => {
    it('重复值判违规', () => {
      m.addRule(
        createRule({
          ruleId: 'u1',
          dimension: DQDimension.UNIQUENESS,
          dataset: 'ds',
          targetField: 'id',
        }),
      )
      m.feed('ds', { id: 'a1' })
      m.feed('ds', { id: 'a2' })
      m.feed('ds', { id: 'a1' })
      expect(m.getViolations()).toHaveLength(1)
    })
  })

  describe('VALIDITY 有效性', () => {
    it('email 校验', () => {
      m.addRule(
        createRule({
          ruleId: 'v1',
          dimension: DQDimension.VALIDITY,
          dataset: 'ds',
          targetField: 'email',
          params: { validator: 'email' },
        }),
      )
      m.feed('ds', { email: 'a@b.c' })
      m.feed('ds', { email: 'invalid' })
      expect(m.getViolations()).toHaveLength(1)
    })
    it('phone 校验', () => {
      m.addRule(
        createRule({
          ruleId: 'v1',
          dimension: DQDimension.VALIDITY,
          dataset: 'ds',
          targetField: 'phone',
          params: { validator: 'phone' },
        }),
      )
      m.feed('ds', { phone: '13812345678' })
      m.feed('ds', { phone: '12345' })
      expect(m.getViolations()).toHaveLength(1)
    })
    it('uuid 校验', () => {
      m.addRule(
        createRule({
          ruleId: 'v1',
          dimension: DQDimension.VALIDITY,
          dataset: 'ds',
          targetField: 'uuid',
          params: { validator: 'uuid' },
        }),
      )
      m.feed('ds', { uuid: '12345678-1234-1234-1234-123456789012' })
      m.feed('ds', { uuid: 'not-a-uuid' })
      expect(m.getViolations()).toHaveLength(1)
    })
    it('non_negative 校验', () => {
      m.addRule(
        createRule({
          ruleId: 'v1',
          dimension: DQDimension.VALIDITY,
          dataset: 'ds',
          targetField: 'count',
          params: { validator: 'non_negative' },
        }),
      )
      m.feed('ds', { count: 0 })
      m.feed('ds', { count: -1 })
      expect(m.getViolations()).toHaveLength(1)
    })
    it('non_empty 校验', () => {
      m.addRule(
        createRule({
          ruleId: 'v1',
          dimension: DQDimension.VALIDITY,
          dataset: 'ds',
          targetField: 'tags',
          params: { validator: 'non_empty' },
        }),
      )
      m.feed('ds', { tags: ['a'] })
      m.feed('ds', { tags: [] })
      expect(m.getViolations()).toHaveLength(1)
    })
  })

  describe('规则过滤', () => {
    it('禁用规则不参与检查', () => {
      m.addRule(
        createRule({
          ruleId: 'c1',
          dimension: DQDimension.COMPLETENESS,
          dataset: 'ds',
          targetField: 'name',
          enabled: false,
        }),
      )
      m.feed('ds', {})
      expect(m.getViolations()).toHaveLength(0)
    })
    it('不同 dataset 的规则不触发', () => {
      m.addRule(
        createRule({
          ruleId: 'c1',
          dimension: DQDimension.COMPLETENESS,
          dataset: 'a',
          targetField: 'name',
        }),
      )
      m.feed('b', {})
      expect(m.getViolations()).toHaveLength(0)
    })
  })

  describe('getViolations', () => {
    beforeEach(() => {
      m.addRule(
        createRule({
          ruleId: 'c1',
          dimension: DQDimension.COMPLETENESS,
          dataset: 'ds',
          targetField: 'name',
        }),
      )
      m.feed('ds', { name: null })
      m.feed('ds', { name: 'ok' })
      m.feed('ds', { name: '' })
    })
    it('默认返回全部', () => {
      expect(m.getViolations()).toHaveLength(2)
    })
    it('按 dataset 过滤', () => {
      expect(m.getViolations({ dataset: 'ds' })).toHaveLength(2)
      expect(m.getViolations({ dataset: 'other' })).toHaveLength(0)
    })
    it('按 ruleId 过滤', () => {
      expect(m.getViolations({ ruleId: 'c1' })).toHaveLength(2)
      expect(m.getViolations({ ruleId: 'other' })).toHaveLength(0)
    })
    it('limit 生效', () => {
      expect(m.getViolations({ limit: 1 })).toHaveLength(1)
    })
  })

  describe('getMetrics + health', () => {
    it('返回规则维度的指标', () => {
      m.addRule(
        createRule({
          ruleId: 'c1',
          dimension: DQDimension.COMPLETENESS,
          dataset: 'ds',
          targetField: 'name',
          threshold: 0.95,
          comparison: 'lt',
        }),
      )
      m.feed('ds', { name: 'a' })
      m.feed('ds', { name: 'b' })
      m.feed('ds', {})
      const metrics = m.getMetrics()
      expect(metrics).toHaveLength(1)
      expect(metrics[0]!.total).toBe(3)
      expect(metrics[0]!.failed).toBe(1)
      expect(metrics[0]!.rate).toBeCloseTo(2 / 3, 3)
    })
    it('health ok=true 当所有规则 rate 未触发阈值', () => {
      m.addRule(
        createRule({
          ruleId: 'c1',
          dimension: DQDimension.COMPLETENESS,
          dataset: 'ds',
          targetField: 'name',
          threshold: 0.5,
          comparison: 'lt',
        }),
      )
      m.feed('ds', { name: 'a' })
      const h = m.health()
      expect(h.ok).toBe(true)
      expect(h.badMetrics).toHaveLength(0)
    })
    it('health ok=false 当 rate 触发阈值', () => {
      m.addRule(
        createRule({
          ruleId: 'c1',
          dimension: DQDimension.COMPLETENESS,
          dataset: 'ds',
          targetField: 'name',
          threshold: 0.9,
          comparison: 'lt',
        }),
      )
      m.feed('ds', {})
      m.feed('ds', {})
      const h = m.health()
      expect(h.ok).toBe(false)
      expect(h.badMetrics).toHaveLength(1)
    })
  })

  describe('stats', () => {
    it('反映规则与样本统计', () => {
      m.addRule(
        createRule({
          ruleId: 'c1',
          dimension: DQDimension.COMPLETENESS,
          dataset: 'ds',
          targetField: 'name',
        }),
      )
      m.addRule(
        createRule({
          ruleId: 'c2',
          dimension: DQDimension.COMPLETENESS,
          dataset: 'ds',
          targetField: 'age',
          enabled: false,
        }),
      )
      m.feed('ds', {})
      m.feed('ds', { name: 'a' })
      const s = m.stats()
      expect(s.rulesTotal).toBe(2)
      expect(s.rulesEnabled).toBe(1)
      expect(s.samplesTotal).toBe(2)
      expect(s.violationsTotal).toBe(1)
    })
  })

  describe('clear', () => {
    it('清空样本和违规', () => {
      m.addRule(
        createRule({
          ruleId: 'c1',
          dimension: DQDimension.COMPLETENESS,
          dataset: 'ds',
          targetField: 'name',
        }),
      )
      m.feed('ds', {})
      expect(m.stats().violationsTotal).toBe(1)
      m.clear()
      expect(m.stats().samplesTotal).toBe(0)
      expect(m.stats().violationsTotal).toBe(0)
    })
  })

  describe('maxViolations 限制', () => {
    it('达到上限后保留最新违规', () => {
      const m2 = new DataQualityMonitor({ maxViolations: 2 })
      m2.addRule(
        createRule({
          ruleId: 'c1',
          dimension: DQDimension.COMPLETENESS,
          dataset: 'ds',
          targetField: 'name',
        }),
      )
      m2.feed('ds', {})
      m2.feed('ds', {})
      m2.feed('ds', {})
      const v = m2.getViolations()
      expect(v).toHaveLength(2)
    })
  })

  describe('rule 类型显式传入', () => {
    it('完整 DQRule 透传', () => {
      const rule: DQRule = {
        ruleId: 'r1',
        name: '完整规则',
        dimension: DQDimension.COMPLETENESS,
        dataset: 'ds',
        targetField: 'name',
        threshold: 0.9,
        comparison: 'ge',
        params: {},
        enabled: true,
        description: '测试',
        createdAt: 1000,
      }
      m.addRule(rule)
      const got = m.getRule('r1')!
      expect(got.name).toBe('完整规则')
      expect(got.description).toBe('测试')
      expect(got.createdAt).toBe(1000)
    })
  })
})
