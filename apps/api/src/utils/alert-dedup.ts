/**
 * Bug-161: 告警去重聚合.
 *
 * 对相同 fingerprint + 维度的告警在窗口内合并:
 *   发出 N 条原始告警, 接收方看到 1 条聚合告警 + 计数.
 *
 * 参考: git show 3ee96cf0:server/app/utils/bug161_alert_dedup.py
 */

import { createHash } from 'node:crypto'

/** 原始告警项. */
export interface AlertItem {
  fp: string
  severity: string
  labels: Record<string, string>
  msg: string
  ts: number
}

/** 聚合后的告警. */
export interface AggregatedAlert {
  fp: string
  severity: string
  count: number
  firstTs: number
  lastTs: number
  sampleMsg: string
  labels: Record<string, string>
}

/** 告警去重配置. */
export interface AlertConfig {
  /** 聚合窗口(秒), 默认 60 */
  windowSec: number
  /** 最多保留已发出聚合告警数, 默认 1000 */
  maxCount: number
  /** 同 fp 不同 severity 时是否覆盖 severity, 默认 true */
  sameSeverityOnly: boolean
}

export const DEFAULT_ALERT_CONFIG: AlertConfig = {
  windowSec: 60,
  maxCount: 1000,
  sameSeverityOnly: true,
}

type EmitCallback = (alert: AggregatedAlert) => void

/**
 * 告警去重聚合器: 相同 fp+labels 在窗口内合并.
 *
 * 线程安全说明: Node.js 单线程, 但异步回调可能交错, 使用锁字段串行化关键修改.
 * 这里采用同步代码块内完成修改 + 异步回调外触发的方式, 避免回调交错污染状态.
 */
export class AlertDeduplicator {
  private readonly config: AlertConfig
  private readonly buckets = new Map<string, AggregatedAlert>()
  private readonly emitted: AggregatedAlert[] = []
  private readonly onEmit?: EmitCallback

  constructor(config: Partial<AlertConfig> = {}, onEmit?: EmitCallback) {
    this.config = { ...DEFAULT_ALERT_CONFIG, ...config }
    this.onEmit = onEmit
  }

  /** 计算 fingerprint: severity + 排序后 labels + msg 前 64 字符. */
  static fingerprint(severity: string, labels: Record<string, string>, msg: string): string {
    const sorted = Object.entries(labels)
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([k, v]) => `${k}=${v}`)
      .join(',')
    const key = `${severity}|${sorted}|${msg.slice(0, 64)}`
    return createHash('md5').update(key, 'utf8').digest('hex').slice(0, 16)
  }

  /** 推入一条原始告警, 返回聚合后的告警. */
  push(severity: string, labels: Record<string, string>, msg: string): AggregatedAlert {
    const fp = AlertDeduplicator.fingerprint(severity, labels, msg)
    const now = Date.now() / 1000
    this.cleanupLocked(now)
    let a = this.buckets.get(fp)
    if (!a) {
      a = {
        fp,
        severity,
        count: 0,
        firstTs: now,
        lastTs: now,
        sampleMsg: msg,
        labels: { ...labels },
      }
      this.buckets.set(fp, a)
    } else {
      if (this.config.sameSeverityOnly && a.severity !== severity) {
        a.severity = severity
      }
      a.lastTs = now
    }
    a.count += 1
    this.emitted.push(a)
    if (this.emitted.length > this.config.maxCount) {
      this.emitted.splice(0, this.emitted.length - this.config.maxCount)
    }
    const cb = this.onEmit
    if (cb) {
      try {
        cb(a)
      } catch {
        /* 回调失败忽略, 不影响主流程 */
      }
    }
    return a
  }

  /** 清理窗口外的桶. */
  private cleanupLocked(now: number): void {
    const limit = now - this.config.windowSec
    for (const [k, v] of this.buckets) {
      if (v.lastTs < limit) this.buckets.delete(k)
    }
  }

  /** 强制 flush 所有桶, 返回当前聚合告警列表. */
  forceFlush(): AggregatedAlert[] {
    const out = Array.from(this.buckets.values())
    this.buckets.clear()
    return out
  }

  /** 统计信息. */
  stats(): { activeBuckets: number; totalEmitted: number } {
    return {
      activeBuckets: this.buckets.size,
      totalEmitted: this.emitted.length,
    }
  }
}

/** 全局单例. */
export const alertDedup = new AlertDeduplicator()
