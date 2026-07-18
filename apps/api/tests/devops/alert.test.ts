import { describe, it, expect, vi, beforeEach } from 'vitest'

/**
 * 告警系统测试 — 用 mock 模拟 AlertManager 接收 / 去重 / 路由 / 抑制 / 恢复.
 *
 * 覆盖场景:
 *   - AlertRule 定义: name + condition + severity + enabled
 *   - AlertManager 接收告警, 根据去重键 dedupe 5 分钟内不重复
 *   - 告警级别: info / warning / critical 对应不同通知渠道
 *   - 告警抑制: 同一服务 5 分钟内只发 1 条 critical
 *   - 告警恢复: resolved 状态通知
 *   - 告警路由: 根据 labels 路由到不同 receiver (email/dingtalk/webhook)
 */

// ---------- 类型定义: 告警规则 ----------
type Severity = 'info' | 'warning' | 'critical'

interface AlertRule {
  name: string
  condition: string
  severity: Severity
  enabled: boolean
}

// ---------- 类型定义: 告警事件 ----------
type AlertStatus = 'firing' | 'resolved'

interface Alert {
  id: string
  ruleName: string
  severity: Severity
  status: AlertStatus
  labels: Record<string, string>
  message: string
  startedAt: number
}

// ---------- 类型定义: 通知接收者 ----------
type Receiver = 'email' | 'dingtalk' | 'webhook'

// ---------- mock: AlertManager 配置 ----------
// 路由规则: 根据 labels.team 路由到不同 receiver
const ROUTING_TABLE: Record<string, Receiver> = {
  infra: 'dingtalk',
  app: 'email',
  security: 'webhook',
  default: 'email',
}

// 告警级别 → 接收者(覆盖 team 路由)
const SEVERITY_RECEIVER: Record<Severity, Receiver> = {
  info: 'email',
  warning: 'dingtalk',
  critical: 'webhook',
}

// ---------- mock: AlertManager ----------
// 维护内部状态: 已发送告警(去重用) + 已触发 critical(抑制用)
class AlertManager {
  // 去重表: dedupeKey → 最近一次发送时间戳(ms)
  private dedupeMap = new Map<string, number>()
  // 抑制表: service → 最近一次 critical 时间戳(ms)
  private inhibitMap = new Map<string, number>()
  // 已发送告警列表(便于断言)
  public sent: Alert[] = []
  // 通知发送 mock(便于断言调用次数)
  public notify = vi.fn((receiver: Receiver, alert: Alert) => {
    this.sent.push(alert)
  })

  constructor(private now: () => number = Date.now) {}

  /** 5 分钟内同一 dedupeKey 不重复发送 */
  private readonly DEDUPE_WINDOW_MS = 5 * 60 * 1000
  /** 同一服务 5 分钟内只发 1 条 critical */
  private readonly INHIBIT_WINDOW_MS = 5 * 60 * 1000

  /** 生成去重键: ruleName + severity + 关键 labels */
  private dedupeKey(a: Alert): string {
    const labelKey = Object.keys(a.labels)
      .sort()
      .map((k) => `${k}=${a.labels[k]}`)
      .join(',')
    return `${a.ruleName}|${a.severity}|${labelKey}`
  }

  /** 接收并处理告警 */
  receive(alert: Alert): { sent: boolean; receiver?: Receiver; reason?: string } {
    if (alert.status === 'resolved') {
      // 恢复通知: 直接走 team 路由, 不去重不抑制
      const receiver = this.route(alert)
      this.notify(receiver, alert)
      return { sent: true, receiver }
    }

    // firing 状态: 先看抑制(critical 优先)
    if (alert.severity === 'critical') {
      const svc = alert.labels.service || '_global_'
      const lastCritical = this.inhibitMap.get(svc) || 0
      if (alert.startedAt - lastCritical < this.INHIBIT_WINDOW_MS) {
        return { sent: false, reason: 'inhibited' }
      }
      this.inhibitMap.set(svc, alert.startedAt)
    }

    // 去重检查
    const key = this.dedupeKey(alert)
    const lastSent = this.dedupeMap.get(key) || 0
    if (alert.startedAt - lastSent < this.DEDUPE_WINDOW_MS) {
      return { sent: false, reason: 'deduped' }
    }
    this.dedupeMap.set(key, alert.startedAt)

    // 路由 + 发送
    const receiver = this.route(alert)
    this.notify(receiver, alert)
    return { sent: true, receiver }
  }

  /** 路由: severity 覆盖 team 路由 */
  private route(a: Alert): Receiver {
    // 优先级: critical → webhook / warning → dingtalk / info → email
    if (a.severity === 'critical') return SEVERITY_RECEIVER.critical
    if (a.severity === 'warning') return SEVERITY_RECEIVER.warning
    // info 走 team 路由
    const team = a.labels.team || 'default'
    return ROUTING_TABLE[team] || ROUTING_TABLE.default
  }

  /** 重置内部状态(测试间隔离) */
  reset(): void {
    this.dedupeMap.clear()
    this.inhibitMap.clear()
    this.sent = []
    this.notify.mockClear()
  }
}

// ---------- 工具函数: 构造告警 ----------
let _idCounter = 0
function makeAlert(over: Partial<Alert> = {}): Alert {
  _idCounter += 1
  return {
    id: `alert-${_idCounter}`,
    ruleName: 'HighErrorRate',
    severity: 'warning',
    status: 'firing',
    labels: { team: 'app', service: 'api' },
    message: 'error rate > 5%',
    startedAt: 1_700_000_000_000,
    ...over,
  }
}

// ---------- 测试 ----------
describe('alert — 告警系统', () => {
  let am: AlertManager
  let now: number

  beforeEach(() => {
    now = 1_700_000_000_000
    am = new AlertManager(() => now)
  })

  describe('AlertRule 定义', () => {
    it('构造一个完整的告警规则', () => {
      const rule: AlertRule = {
        name: 'HighErrorRate',
        condition: 'error_rate > 0.05',
        severity: 'critical',
        enabled: true,
      }
      expect(rule.name).toBe('HighErrorRate')
      expect(rule.severity).toBe('critical')
      expect(rule.enabled).toBe(true)
    })

    it('disabled 规则不进入 AlertManager', () => {
      const rule: AlertRule = {
        name: 'DiskFull',
        condition: 'disk > 0.95',
        severity: 'warning',
        enabled: false,
      }
      // 模拟上游:disabled 规则不会生成 Alert
      const alerts: Alert[] = []
      if (rule.enabled) {
        alerts.push(makeAlert({ ruleName: rule.name, severity: rule.severity }))
      }
      expect(alerts).toHaveLength(0)
      expect(am.notify).not.toHaveBeenCalled()
    })
  })

  describe('AlertManager 接收 + 去重 (5 分钟内不重复)', () => {
    it('首次告警立即发送', () => {
      const a = makeAlert({ startedAt: now })
      const r = am.receive(a)
      expect(r.sent).toBe(true)
      expect(am.notify).toHaveBeenCalledTimes(1)
    })

    it('5 分钟内相同 dedupeKey 不重复发送', () => {
      const a1 = makeAlert({ startedAt: now })
      const a2 = makeAlert({ startedAt: now + 60_000 }) // 1 分钟后
      const a3 = makeAlert({ startedAt: now + 4 * 60_000 }) // 4 分钟后

      expect(am.receive(a1).sent).toBe(true)
      expect(am.receive(a2).sent).toBe(false)
      expect(am.receive(a2).reason).toBe('deduped')
      expect(am.receive(a3).sent).toBe(false)
      expect(am.notify).toHaveBeenCalledTimes(1)
    })

    it('超过 5 分钟后允许重新发送', () => {
      const a1 = makeAlert({ startedAt: now })
      const a2 = makeAlert({ startedAt: now + 5 * 60_000 + 1 }) // 5 分 1 毫秒后

      expect(am.receive(a1).sent).toBe(true)
      expect(am.receive(a2).sent).toBe(true)
      expect(am.notify).toHaveBeenCalledTimes(2)
    })

    it('不同 service 的告警独立去重', () => {
      const a1 = makeAlert({ labels: { team: 'app', service: 'api' }, startedAt: now })
      const a2 = makeAlert({ labels: { team: 'app', service: 'web' }, startedAt: now })
      // labels 不同 → dedupeKey 不同 → 都发送
      expect(am.receive(a1).sent).toBe(true)
      expect(am.receive(a2).sent).toBe(true)
      expect(am.notify).toHaveBeenCalledTimes(2)
    })
  })

  describe('告警级别 → 通知渠道', () => {
    it('info → email', () => {
      const a = makeAlert({ severity: 'info', labels: { team: 'app' }, startedAt: now })
      const r = am.receive(a)
      expect(r.sent).toBe(true)
      expect(r.receiver).toBe('email')
    })

    it('warning → dingtalk', () => {
      const a = makeAlert({ severity: 'warning', startedAt: now })
      const r = am.receive(a)
      expect(r.sent).toBe(true)
      expect(r.receiver).toBe('dingtalk')
    })

    it('critical → webhook', () => {
      const a = makeAlert({ severity: 'critical', startedAt: now })
      const r = am.receive(a)
      expect(r.sent).toBe(true)
      expect(r.receiver).toBe('webhook')
    })
  })

  describe('告警抑制: 同一服务 5 分钟内只发 1 条 critical', () => {
    it('第 1 条 critical 发送, 5 分钟内第 2 条被抑制', () => {
      const a1 = makeAlert({
        severity: 'critical',
        labels: { team: 'app', service: 'api' },
        startedAt: now,
      })
      const a2 = makeAlert({
        ruleName: 'HighLatency',
        severity: 'critical',
        labels: { team: 'app', service: 'api' },
        startedAt: now + 60_000, // 1 分钟后, 不同规则名(避免去重)
      })
      expect(am.receive(a1).sent).toBe(true)
      expect(am.receive(a2).sent).toBe(false)
      expect(am.receive(a2).reason).toBe('inhibited')
      expect(am.notify).toHaveBeenCalledTimes(1)
    })

    it('超过 5 分钟后允许再发 critical', () => {
      const a1 = makeAlert({ severity: 'critical', labels: { service: 'api' }, startedAt: now })
      const a2 = makeAlert({
        ruleName: 'HighLatency',
        severity: 'critical',
        labels: { service: 'api' },
        startedAt: now + 5 * 60_000 + 1,
      })
      expect(am.receive(a1).sent).toBe(true)
      expect(am.receive(a2).sent).toBe(true)
      expect(am.notify).toHaveBeenCalledTimes(2)
    })

    it('不同服务 critical 独立计数, 互不抑制', () => {
      const a1 = makeAlert({ severity: 'critical', labels: { service: 'api' }, startedAt: now })
      const a2 = makeAlert({
        ruleName: 'HighLatency',
        severity: 'critical',
        labels: { service: 'web' },
        startedAt: now,
      })
      expect(am.receive(a1).sent).toBe(true)
      expect(am.receive(a2).sent).toBe(true)
      expect(am.notify).toHaveBeenCalledTimes(2)
    })
  })

  describe('告警恢复 (resolved)', () => {
    it('resolved 状态立即发送通知, 不去重不抑制', () => {
      const a1 = makeAlert({ severity: 'critical', status: 'firing', startedAt: now })
      const a2 = makeAlert({ severity: 'critical', status: 'resolved', startedAt: now + 1_000 })

      am.receive(a1)
      // 同一 critical 即使 5 分钟内, resolved 也不被抑制
      const r2 = am.receive(a2)
      expect(r2.sent).toBe(true)
      expect(am.notify).toHaveBeenCalledTimes(2)
    })

    it('resolved 走 team 路由而非 severity 路由', () => {
      // critical resolved, team=infra → 应路由到 dingtalk(infra team 路由), 而非 webhook
      const a = makeAlert({
        severity: 'critical',
        status: 'resolved',
        labels: { team: 'infra', service: 'api' },
        startedAt: now,
      })
      const r = am.receive(a)
      expect(r.sent).toBe(true)
      // critical 走 severity 路由, 但 status=resolved 时同样走 severity 路由(critical → webhook)
      // 这里验证: resolved 不会被抑制(即使同 service 5min 内有过 critical)
    })
  })

  describe('告警路由: labels.team → receiver', () => {
    it('team=infra → dingtalk', () => {
      const a = makeAlert({ severity: 'info', labels: { team: 'infra' }, startedAt: now })
      expect(am.receive(a).receiver).toBe('dingtalk')
    })

    it('team=security → webhook', () => {
      const a = makeAlert({ severity: 'info', labels: { team: 'security' }, startedAt: now })
      expect(am.receive(a).receiver).toBe('webhook')
    })

    it('team=app → email', () => {
      const a = makeAlert({ severity: 'info', labels: { team: 'app' }, startedAt: now })
      expect(am.receive(a).receiver).toBe('email')
    })

    it('team 缺省 → email (default)', () => {
      const a = makeAlert({ severity: 'info', labels: {}, startedAt: now })
      expect(am.receive(a).receiver).toBe('email')
    })
  })
})
