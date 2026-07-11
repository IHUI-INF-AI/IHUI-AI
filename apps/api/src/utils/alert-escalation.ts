/**
 * Bug-163: 阶梯式告警升级.
 *
 * 接收方未 ack, 时间窗口内自动升级到更高级别渠道:
 *   LOG -> EMAIL -> SMS -> PHONE -> ONCALL.
 *
 * 参考: git show 3ee96cf0:server/app/utils/bug163_alert_escalation.py
 */

/** 告警通知渠道. */
export enum Channel {
  LOG = 'LOG',
  EMAIL = 'EMAIL',
  SMS = 'SMS',
  PHONE = 'PHONE',
  ONCALL = 'ONCALL',
}

/** 升级步骤. */
export interface EscalationStep {
  /** 触发渠道 */
  channel: Channel
  /** 触发前等待秒数 */
  afterSec: number
  /** 模板/消息体, 空则使用 severity */
  template: string
}

/** 升级策略. */
export interface EscalationPolicy {
  name: string
  steps: EscalationStep[]
}

/** 活跃告警. */
export interface ActiveAlert {
  id: string
  severity: string
  labels: Record<string, string>
  firstTs: number
  /** 已升级到的步骤索引, -1 表示未升级 */
  lastEscalatedStep: number
  acked: boolean
}

/** 默认升级策略: EMAIL(0s) -> SMS(300s) -> PHONE(900s). */
export const DEFAULT_POLICY: EscalationPolicy = {
  name: 'default',
  steps: [
    { channel: Channel.LOG, afterSec: 0, template: '' },
    { channel: Channel.EMAIL, afterSec: 60, template: '' },
    { channel: Channel.SMS, afterSec: 300, template: '' },
    { channel: Channel.PHONE, afterSec: 900, template: '' },
    { channel: Channel.ONCALL, afterSec: 1800, template: '' },
  ],
}

type SendFn = (channel: Channel, alertId: string, message: string) => void

/** tick 触发结果. */
export interface EscalationTrigger {
  channel: Channel
  alertId: string
  message: string
}

/**
 * 告警升级引擎: 按时间窗内逐步升级, ack 后停止.
 */
export class EscalationEngine {
  private readonly policy: EscalationPolicy
  private readonly send?: SendFn
  private readonly alerts = new Map<string, ActiveAlert>()

  constructor(policy?: EscalationPolicy, send?: SendFn) {
    this.policy = policy ?? DEFAULT_POLICY
    this.send = send
  }

  /** 触发告警, 返回活跃告警对象. */
  fire(alertId: string, severity: string, labels: Record<string, string>): ActiveAlert {
    let a = this.alerts.get(alertId)
    if (!a) {
      a = {
        id: alertId,
        severity,
        labels,
        firstTs: Date.now() / 1000,
        lastEscalatedStep: -1,
        acked: false,
      }
      this.alerts.set(alertId, a)
    }
    return a
  }

  /** ack 告警, 停止升级. */
  ack(alertId: string): boolean {
    const a = this.alerts.get(alertId)
    if (!a) return false
    a.acked = true
    return true
  }

  /** 扫描应升级的告警, 返回触发的 (channel, alertId, message) 列表. */
  tick(): EscalationTrigger[] {
    const out: EscalationTrigger[] = []
    const now = Date.now() / 1000
    for (const a of this.alerts.values()) {
      if (a.acked) continue
      const elapsed = now - a.firstTs
      for (let i = 0; i < this.policy.steps.length; i++) {
        if (i <= a.lastEscalatedStep) continue
        const step = this.policy.steps[i]!
        if (elapsed >= step.afterSec) {
          a.lastEscalatedStep = i
          const message = step.template || a.severity
          out.push({ channel: step.channel, alertId: a.id, message })
          const cb = this.send
          if (cb) {
            try {
              cb(step.channel, a.id, message)
            } catch {
              /* send 失败忽略 */
            }
          }
        }
      }
    }
    return out
  }

  /** 获取所有活跃告警. */
  active(): ActiveAlert[] {
    return Array.from(this.alerts.values())
  }

  /** 统计信息. */
  stats(): { active: number; acked: number } {
    let acked = 0
    for (const a of this.alerts.values()) {
      if (a.acked) acked += 1
    }
    return { active: this.alerts.size, acked }
  }
}

/** 全局单例. */
export const escalationEngine = new EscalationEngine()
