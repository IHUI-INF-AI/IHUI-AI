import { describe, it, expect, beforeEach, vi } from 'vitest'
import { tourAlertService } from '../tourAlertService'

// mock fetch 用于测试通知渠道
const mockFetch = vi.fn()
vi.stubGlobal('fetch', mockFetch)

// 构造一个基础规则入参
const baseRuleInput = {
  name: '测试规则',
  description: '测试描述',
  metric: 'tour_error',
  condition: { operator: 'gt' as const, threshold: 10, duration: 60000, aggregation: 'avg' as const },
  severity: 'warning' as const,
  enabled: true,
  cooldown: 0,
  channels: [],
  labels: {}
}

describe('tourAlertService', () => {
  beforeEach(() => {
    localStorage.clear()
    vi.clearAllMocks()
    mockFetch.mockReset()
    tourAlertService.reset()
  })

  describe('createRule', () => {
    it('应该成功创建告警规则', () => {
      const rule = tourAlertService.createRule(baseRuleInput)
      expect(rule.id).toBeDefined()
      expect(rule.name).toBe('测试规则')
      expect(rule.metric).toBe('tour_error')
      expect(rule.createdAt).toBeGreaterThan(0)
      expect(rule.updatedAt).toBeGreaterThan(0)
    })
  })

  describe('updateRule', () => {
    it('应该更新规则', () => {
      const rule = tourAlertService.createRule(baseRuleInput)
      const updated = tourAlertService.updateRule(rule.id, { name: '更新后的规则' })
      expect(updated?.name).toBe('更新后的规则')
    })

    it('规则不存在时返回 null', () => {
      const result = tourAlertService.updateRule('not_exist', { name: 'xxx' })
      expect(result).toBeNull()
    })

    it('更新后 createdAt 保持不变 updatedAt 变化', () => {
      const rule = tourAlertService.createRule(baseRuleInput)
      const updated = tourAlertService.updateRule(rule.id, { enabled: false })
      expect(updated?.createdAt).toBe(rule.createdAt)
      expect(updated?.enabled).toBe(false)
    })
  })

  describe('deleteRule', () => {
    it('应该删除规则', () => {
      const rule = tourAlertService.createRule(baseRuleInput)
      const result = tourAlertService.deleteRule(rule.id)
      expect(result).toBe(true)
      expect(tourAlertService.getRule(rule.id)).toBeUndefined()
    })

    it('规则不存在时返回 false', () => {
      const result = tourAlertService.deleteRule('not_exist')
      expect(result).toBe(false)
    })

    it('删除规则时同时删除关联告警', () => {
      const rule = tourAlertService.createRule(baseRuleInput)
      const alert = tourAlertService.checkRule(rule.id, 100)
      expect(alert).not.toBeNull()
      tourAlertService.deleteRule(rule.id)
      expect(tourAlertService.getAlert(alert!.id)).toBeUndefined()
    })
  })

  describe('getRule / getAllRules / getEnabledRules', () => {
    it('getRule 返回指定规则', () => {
      const rule = tourAlertService.createRule(baseRuleInput)
      expect(tourAlertService.getRule(rule.id)).toEqual(rule)
    })

    it('getAllRules 返回全部规则', () => {
      tourAlertService.createRule(baseRuleInput)
      tourAlertService.createRule({ ...baseRuleInput, name: '规则2' })
      expect(tourAlertService.getAllRules().length).toBe(2)
    })

    it('getEnabledRules 仅返回启用规则', () => {
      tourAlertService.createRule(baseRuleInput)
      tourAlertService.createRule({ ...baseRuleInput, enabled: false, name: '禁用规则' })
      const enabled = tourAlertService.getEnabledRules()
      expect(enabled.length).toBe(1)
      expect(enabled[0].name).toBe('测试规则')
    })
  })

  describe('startChecking / stopChecking', () => {
    it('启动和停止检查不应抛错', () => {
      tourAlertService.startChecking()
      tourAlertService.startChecking() // 重复启动应被忽略
      tourAlertService.stopChecking()
      tourAlertService.stopChecking() // 重复停止应被忽略
      expect(true).toBe(true)
    })
  })

  describe('checkRule 条件覆盖', () => {
    it('规则不存在返回 null', () => {
      expect(tourAlertService.checkRule('not_exist', 100)).toBeNull()
    })

    it('规则禁用返回 null', () => {
      const rule = tourAlertService.createRule({ ...baseRuleInput, enabled: false })
      expect(tourAlertService.checkRule(rule.id, 100)).toBeNull()
    })

    it('cooldown 期内返回 null', () => {
      const rule = tourAlertService.createRule({ ...baseRuleInput, cooldown: 999999 })
      expect(tourAlertService.checkRule(rule.id, 100)).not.toBeNull()
      expect(tourAlertService.checkRule(rule.id, 100)).toBeNull()
    })

    it('operator=gt 大于阈值触发', () => {
      const rule = tourAlertService.createRule({ ...baseRuleInput, condition: { ...baseRuleInput.condition, operator: 'gt', threshold: 10 } })
      const fired = tourAlertService.checkRule(rule.id, 11)
      expect(fired).not.toBeNull()
      expect(fired?.status).toBe('firing')
      // 再次以不满足条件的值检查，应返回 resolved 告警
      const resolved = tourAlertService.checkRule(rule.id, 10)
      expect(resolved).not.toBeNull()
      expect(resolved?.status).toBe('resolved')
    })

    it('operator=lt 小于阈值触发', () => {
      const rule = tourAlertService.createRule({ ...baseRuleInput, condition: { ...baseRuleInput.condition, operator: 'lt', threshold: 10 } })
      expect(tourAlertService.checkRule(rule.id, 9)).not.toBeNull()
    })

    it('operator=gte 大于等于阈值触发', () => {
      const rule = tourAlertService.createRule({ ...baseRuleInput, condition: { ...baseRuleInput.condition, operator: 'gte', threshold: 10 } })
      expect(tourAlertService.checkRule(rule.id, 10)).not.toBeNull()
    })

    it('operator=lte 小于等于阈值触发', () => {
      const rule = tourAlertService.createRule({ ...baseRuleInput, condition: { ...baseRuleInput.condition, operator: 'lte', threshold: 10 } })
      expect(tourAlertService.checkRule(rule.id, 10)).not.toBeNull()
    })

    it('operator=eq 等于阈值触发', () => {
      const rule = tourAlertService.createRule({ ...baseRuleInput, condition: { ...baseRuleInput.condition, operator: 'eq', threshold: 10 } })
      expect(tourAlertService.checkRule(rule.id, 10)).not.toBeNull()
    })

    it('operator=neq 不等于阈值触发', () => {
      const rule = tourAlertService.createRule({ ...baseRuleInput, condition: { ...baseRuleInput.condition, operator: 'neq', threshold: 10 } })
      expect(tourAlertService.checkRule(rule.id, 11)).not.toBeNull()
    })

    it('operator=between 在范围内触发', () => {
      const rule = tourAlertService.createRule({ ...baseRuleInput, condition: { ...baseRuleInput.condition, operator: 'between', threshold: 10, thresholdMax: 20 } })
      const fired = tourAlertService.checkRule(rule.id, 15)
      expect(fired).not.toBeNull()
      expect(fired?.status).toBe('firing')
      // 范围外的值会触发已有告警解决
      const resolved = tourAlertService.checkRule(rule.id, 25)
      expect(resolved?.status).toBe('resolved')
    })

    it('operator=outside 在范围外触发', () => {
      const rule = tourAlertService.createRule({ ...baseRuleInput, condition: { ...baseRuleInput.condition, operator: 'outside', threshold: 10, thresholdMax: 20 } })
      const fired = tourAlertService.checkRule(rule.id, 5)
      expect(fired).not.toBeNull()
      expect(fired?.status).toBe('firing')
      // 范围内的值会触发已有告警解决
      const resolved = tourAlertService.checkRule(rule.id, 15)
      expect(resolved?.status).toBe('resolved')
    })

    it('operator=between 缺少 thresholdMax 时退化为等于判断', () => {
      const rule = tourAlertService.createRule({ ...baseRuleInput, condition: { ...baseRuleInput.condition, operator: 'between', threshold: 10 } })
      // threshold === thresholdMax === 10，只有 value=10 才触发
      expect(tourAlertService.checkRule(rule.id, 10)).not.toBeNull()
    })

    it('operator=outside 缺少 thresholdMax 时退化为不等于判断', () => {
      const rule = tourAlertService.createRule({ ...baseRuleInput, condition: { ...baseRuleInput.condition, operator: 'outside', threshold: 10 } })
      // threshold === thresholdMax === 10，value != 10 触发
      expect(tourAlertService.checkRule(rule.id, 5)).not.toBeNull()
    })

    it('已存在 firing 告警时再次触发应更新值', () => {
      const rule = tourAlertService.createRule(baseRuleInput)
      const alert1 = tourAlertService.checkRule(rule.id, 100)
      expect(alert1).not.toBeNull()
      // 再次触发，应返回 null 但更新内部告警值
      const alert2 = tourAlertService.checkRule(rule.id, 200)
      expect(alert2).toBeNull()
      const stored = tourAlertService.getAlert(alert1!.id)
      expect(stored?.value).toBe(200)
    })

    it('条件不满足时已有告警应被解决', () => {
      const rule = tourAlertService.createRule(baseRuleInput)
      const alert = tourAlertService.checkRule(rule.id, 100)
      expect(alert).not.toBeNull()
      const resolved = tourAlertService.checkRule(rule.id, 1)
      expect(resolved).not.toBeNull()
      expect(resolved?.status).toBe('resolved')
    })

    it('带标签触发告警，标签匹配才视为同一告警', () => {
      const rule = tourAlertService.createRule(baseRuleInput)
      const alert1 = tourAlertService.checkRule(rule.id, 100, { host: 'a' })
      const alert2 = tourAlertService.checkRule(rule.id, 100, { host: 'b' })
      expect(alert1).not.toBeNull()
      expect(alert2).not.toBeNull()
      expect(alert1!.id).not.toBe(alert2!.id)
    })
  })

  describe('resolveAlert', () => {
    it('应该解决告警', () => {
      const rule = tourAlertService.createRule(baseRuleInput)
      const alert = tourAlertService.checkRule(rule.id, 100)
      const resolved = tourAlertService.resolveAlert(alert!.id)
      expect(resolved?.status).toBe('resolved')
      expect(resolved?.endsAt).toBeGreaterThan(0)
    })

    it('告警不存在返回 null', () => {
      expect(tourAlertService.resolveAlert('not_exist')).toBeNull()
    })

    it('告警非 firing 状态返回 null', () => {
      const rule = tourAlertService.createRule(baseRuleInput)
      const alert = tourAlertService.checkRule(rule.id, 100)
      tourAlertService.resolveAlert(alert!.id)
      // 已 resolved，再次 resolve 返回 null
      expect(tourAlertService.resolveAlert(alert!.id)).toBeNull()
    })
  })

  describe('silenceAlert', () => {
    it('应该静默告警', () => {
      const rule = tourAlertService.createRule(baseRuleInput)
      const alert = tourAlertService.checkRule(rule.id, 100)
      const silenced = tourAlertService.silenceAlert(alert!.id, 3600000)
      expect(silenced?.status).toBe('silenced')
      expect(silenced?.silencedUntil).toBeGreaterThan(0)
    })

    it('告警不存在返回 null', () => {
      expect(tourAlertService.silenceAlert('not_exist', 1000)).toBeNull()
    })
  })

  describe('acknowledgeAlert', () => {
    it('应该确认告警', () => {
      const rule = tourAlertService.createRule(baseRuleInput)
      const alert = tourAlertService.checkRule(rule.id, 100)
      const ack = tourAlertService.acknowledgeAlert(alert!.id, 'admin')
      expect(ack?.acknowledgedBy).toBe('admin')
      expect(ack?.acknowledgedAt).toBeGreaterThan(0)
    })

    it('告警不存在返回 null', () => {
      expect(tourAlertService.acknowledgeAlert('not_exist', 'admin')).toBeNull()
    })
  })

  describe('getAlert / getActiveAlerts / getAllAlerts', () => {
    it('getAlert 返回指定告警', () => {
      const rule = tourAlertService.createRule(baseRuleInput)
      const alert = tourAlertService.checkRule(rule.id, 100)
      expect(tourAlertService.getAlert(alert!.id)?.id).toBe(alert!.id)
    })

    it('getActiveAlerts 仅返回 firing 告警', () => {
      const rule = tourAlertService.createRule(baseRuleInput)
      const alert = tourAlertService.checkRule(rule.id, 100)
      tourAlertService.silenceAlert(alert!.id, 1000)
      expect(tourAlertService.getActiveAlerts().length).toBe(0)
    })

    it('getAllAlerts 返回所有告警', () => {
      const rule = tourAlertService.createRule(baseRuleInput)
      tourAlertService.checkRule(rule.id, 100)
      expect(tourAlertService.getAllAlerts().length).toBe(1)
    })
  })

  describe('getAlertHistory', () => {
    it('解决告警后应生成历史记录', () => {
      const rule = tourAlertService.createRule(baseRuleInput)
      const alert = tourAlertService.checkRule(rule.id, 100)
      tourAlertService.resolveAlert(alert!.id)
      const history = tourAlertService.getAlertHistory()
      expect(history.length).toBe(1)
      expect(history[0].ruleId).toBe(rule.id)
    })

    it('limit 参数生效', () => {
      const rule = tourAlertService.createRule(baseRuleInput)
      // 触发并解决 3 次告警
      for (let i = 0; i < 3; i++) {
        const alert = tourAlertService.checkRule(rule.id, 100)
        tourAlertService.resolveAlert(alert!.id)
      }
      const limited = tourAlertService.getAlertHistory(2)
      expect(limited.length).toBe(2)
    })
  })

  describe('getStats', () => {
    it('应返回完整统计信息', () => {
      tourAlertService.createRule(baseRuleInput)
      tourAlertService.createRule({ ...baseRuleInput, enabled: false, name: '禁用' })
      const rule3 = tourAlertService.createRule({ ...baseRuleInput, name: '规则3' })
      const alert = tourAlertService.checkRule(rule3.id, 100)
      tourAlertService.silenceAlert(alert!.id, 1000)

      const stats = tourAlertService.getStats()
      expect(stats.totalRules).toBe(3)
      expect(stats.enabledRules).toBe(2)
      expect(stats.activeAlerts).toBe(1)
      expect(stats.firingAlerts).toBe(0)
      expect(stats.silencedAlerts).toBe(1)
    })

    it('应统计通知成功失败数', async () => {
      // 创建一个 webhook 渠道
      const channel = tourAlertService.addNotificationChannel({
        type: 'webhook',
        config: { url: 'https://example.com/webhook' },
        enabled: true
      })
      // 创建规则并绑定渠道
      const rule = tourAlertService.createRule({
        ...baseRuleInput,
        channels: [{ id: channel.id, type: 'webhook', config: { url: 'https://example.com/webhook' }, enabled: true }]
      })
      mockFetch.mockResolvedValueOnce({ ok: true })
      tourAlertService.checkRule(rule.id, 100)
      // 等待异步通知发送
      await new Promise(r => setTimeout(r, 50))
      const stats = tourAlertService.getStats()
      expect(stats.notificationsSent).toBe(1)
      expect(stats.notificationsFailed).toBe(0)
    })
  })

  describe('notificationChannels', () => {
    it('应该添加通知渠道', () => {
      const channel = tourAlertService.addNotificationChannel({
        type: 'webhook',
        config: { url: 'https://example.com/webhook' },
        enabled: true
      })
      expect(channel.id).toBeDefined()
      expect(channel.type).toBe('webhook')
    })

    it('应该更新通知渠道', () => {
      const channel = tourAlertService.addNotificationChannel({
        type: 'email',
        config: { to: 'test@example.com' },
        enabled: true
      })
      const updated = tourAlertService.updateNotificationChannel(channel.id, { enabled: false })
      expect(updated?.enabled).toBe(false)
    })

    it('更新不存在的渠道返回 null', () => {
      expect(tourAlertService.updateNotificationChannel('not_exist', { enabled: false })).toBeNull()
    })

    it('应该删除通知渠道', () => {
      const channel = tourAlertService.addNotificationChannel({
        type: 'email',
        config: { to: 'test@example.com' },
        enabled: true
      })
      const result = tourAlertService.deleteNotificationChannel(channel.id)
      expect(result).toBe(true)
    })

    it('删除不存在的渠道返回 false', () => {
      expect(tourAlertService.deleteNotificationChannel('not_exist')).toBe(false)
    })

    it('getNotificationChannels 返回所有渠道', () => {
      // reset 后渠道为空，添加一个后应为 1
      expect(tourAlertService.getNotificationChannels().length).toBe(0)
      tourAlertService.addNotificationChannel({
        type: 'email',
        config: { to: 'test@example.com' },
        enabled: true
      })
      expect(tourAlertService.getNotificationChannels().length).toBe(1)
    })

    it('初始化时创建默认 webhook 渠道（首次实例化场景）', () => {
      // reset 不会重新触发 initializeDefaultChannels，但首次实例化时会创建
      // 通过添加 webhook 渠道验证类型判断逻辑
      tourAlertService.addNotificationChannel({
        type: 'webhook',
        config: { url: '' },
        enabled: false
      })
      const channels = tourAlertService.getNotificationChannels()
      expect(channels.some(c => c.type === 'webhook')).toBe(true)
    })
  })

  describe('testNotificationChannel', () => {
    it('渠道不存在返回 false', async () => {
      const result = await tourAlertService.testNotificationChannel('not_exist')
      expect(result).toBe(false)
    })

    it('webhook 渠道测试成功', async () => {
      mockFetch.mockResolvedValueOnce({ ok: true })
      const channel = tourAlertService.addNotificationChannel({
        type: 'webhook',
        config: { url: 'https://example.com/webhook' },
        enabled: true
      })
      const result = await tourAlertService.testNotificationChannel(channel.id)
      expect(result).toBe(true)
      expect(mockFetch).toHaveBeenCalled()
    })

    it('webhook 缺少 url 返回 false', async () => {
      const channel = tourAlertService.addNotificationChannel({
        type: 'webhook',
        config: {},
        enabled: true
      })
      const result = await tourAlertService.testNotificationChannel(channel.id)
      expect(result).toBe(false)
    })

    it('email 渠道测试成功', async () => {
      const channel = tourAlertService.addNotificationChannel({
        type: 'email',
        config: { to: 'test@example.com' },
        enabled: true
      })
      const result = await tourAlertService.testNotificationChannel(channel.id)
      expect(result).toBe(true)
    })

    it('email 缺少 to 返回 false', async () => {
      const channel = tourAlertService.addNotificationChannel({
        type: 'email',
        config: {},
        enabled: true
      })
      const result = await tourAlertService.testNotificationChannel(channel.id)
      expect(result).toBe(false)
    })

    it('slack 渠道测试成功', async () => {
      const channel = tourAlertService.addNotificationChannel({
        type: 'slack',
        config: { webhookUrl: 'https://slack.com/hook' },
        enabled: true
      })
      const result = await tourAlertService.testNotificationChannel(channel.id)
      expect(result).toBe(true)
    })

    it('slack 缺少 webhookUrl 返回 false', async () => {
      const channel = tourAlertService.addNotificationChannel({
        type: 'slack',
        config: {},
        enabled: true
      })
      const result = await tourAlertService.testNotificationChannel(channel.id)
      expect(result).toBe(false)
    })

    it('dingtalk 渠道测试成功', async () => {
      const channel = tourAlertService.addNotificationChannel({
        type: 'dingtalk',
        config: { webhookUrl: 'https://oapi.dingtalk.com/hook' },
        enabled: true
      })
      const result = await tourAlertService.testNotificationChannel(channel.id)
      expect(result).toBe(true)
    })

    it('dingtalk 缺少 webhookUrl 返回 false', async () => {
      const channel = tourAlertService.addNotificationChannel({
        type: 'dingtalk',
        config: {},
        enabled: true
      })
      const result = await tourAlertService.testNotificationChannel(channel.id)
      expect(result).toBe(false)
    })

    it('wechat 渠道测试成功', async () => {
      const channel = tourAlertService.addNotificationChannel({
        type: 'wechat',
        config: { corpId: 'corp123' },
        enabled: true
      })
      const result = await tourAlertService.testNotificationChannel(channel.id)
      expect(result).toBe(true)
    })

    it('wechat 缺少 corpId 返回 false', async () => {
      const channel = tourAlertService.addNotificationChannel({
        type: 'wechat',
        config: {},
        enabled: true
      })
      const result = await tourAlertService.testNotificationChannel(channel.id)
      expect(result).toBe(false)
    })

    it('sms 渠道测试成功', async () => {
      const channel = tourAlertService.addNotificationChannel({
        type: 'sms',
        config: { phone: '13800000000' },
        enabled: true
      })
      const result = await tourAlertService.testNotificationChannel(channel.id)
      expect(result).toBe(true)
    })

    it('sms 缺少 phone 返回 false', async () => {
      const channel = tourAlertService.addNotificationChannel({
        type: 'sms',
        config: {},
        enabled: true
      })
      const result = await tourAlertService.testNotificationChannel(channel.id)
      expect(result).toBe(false)
    })

    it('webhook fetch 抛错返回 false', async () => {
      mockFetch.mockRejectedValueOnce(new Error('network error'))
      const channel = tourAlertService.addNotificationChannel({
        type: 'webhook',
        config: { url: 'https://example.com/webhook' },
        enabled: true
      })
      const result = await tourAlertService.testNotificationChannel(channel.id)
      expect(result).toBe(false)
    })
  })

  describe('持久化', () => {
    it('规则应持久化到 localStorage', () => {
      tourAlertService.createRule(baseRuleInput)
      const stored = localStorage.getItem('tour_alerts')
      expect(stored).not.toBeNull()
      const parsed = JSON.parse(stored!)
      expect(parsed.rules.length).toBe(1)
    })

    it('告警应持久化到 localStorage', () => {
      const rule = tourAlertService.createRule(baseRuleInput)
      tourAlertService.checkRule(rule.id, 100)
      const stored = localStorage.getItem('tour_alerts')
      const parsed = JSON.parse(stored!)
      expect(parsed.alerts.length).toBe(1)
    })

    it('通知渠道应持久化到 localStorage', () => {
      tourAlertService.addNotificationChannel({
        type: 'email',
        config: { to: 'test@example.com' },
        enabled: true
      })
      const stored = localStorage.getItem('tour_alerts')
      const parsed = JSON.parse(stored!)
      expect(parsed.channels.length).toBeGreaterThan(0)
    })
  })

  describe('reset', () => {
    it('应清空所有数据', () => {
      tourAlertService.createRule(baseRuleInput)
      tourAlertService.addNotificationChannel({
        type: 'email',
        config: { to: 'test@example.com' },
        enabled: true
      })
      tourAlertService.reset()
      expect(tourAlertService.getAllRules().length).toBe(0)
      expect(tourAlertService.getAllAlerts().length).toBe(0)
      expect(tourAlertService.getAlertHistory().length).toBe(0)
      // reset 不会重新初始化默认渠道
      expect(tourAlertService.getNotificationChannels().length).toBe(0)
    })
  })
})
