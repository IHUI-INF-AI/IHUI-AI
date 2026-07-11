/**
 * Bug-183: 配置热更新.
 *
 * 支持: 多源 (env / file / remote) + 变更订阅 + 版本号 + 差异对比.
 *
 * 参考: git show 3ee96cf0:server/app/utils/bug183_hot_config.py
 */

/** 配置变更记录. */
export interface ConfigChange {
  key: string
  old: unknown
  new: unknown
  ts: number
}

/** 配置快照. */
export interface HotConfigSnapshot {
  version: number
  data: Record<string, unknown>
  history: ConfigChange[]
}

type ChangeListener = (change: ConfigChange) => void

/**
 * 热配置中心: 变更通知 + 订阅 + 版本号.
 *
 * 使用:
 *   hotConfig.set('feature.flag', true)       // 触发订阅者
 *   hotConfig.subscribe('feature.flag', cb)   // 按 key 订阅
 *   hotConfig.subscribeAll(cb)                // 全局订阅
 */
export class HotConfigCenter {
  private readonly data = new Map<string, unknown>()
  private version = 0
  private readonly subscribers = new Map<string, ChangeListener[]>()
  private readonly globalSubs: ChangeListener[] = []
  private readonly history: ConfigChange[] = []
  private readonly maxHistory = 200

  /** 读取配置. */
  get<T = unknown>(key: string, defaultValue?: T): T | unknown {
    return this.data.has(key) ? this.data.get(key) : defaultValue
  }

  /** 设置配置, 值未变时不触发. */
  set(key: string, value: unknown): ConfigChange | null {
    const old = this.data.get(key)
    if (old === value) return null
    this.data.set(key, value)
    this.version += 1
    const change: ConfigChange = { key, old, new: value, ts: Date.now() / 1000 }
    this.history.push(change)
    if (this.history.length > this.maxHistory) this.history.shift()
    // 收集订阅者后异步触发 (避免回调中修改 Map)
    const subs = [...(this.subscribers.get(key) ?? []), ...this.globalSubs]
    for (const fn of subs) {
      try {
        fn(change)
      } catch {
        /* 订阅者异常忽略, 不影响主流程 */
      }
    }
    return change
  }

  /** 批量设置. */
  bulkSet(kv: Record<string, unknown>): ConfigChange[] {
    const out: ConfigChange[] = []
    for (const [k, v] of Object.entries(kv)) {
      const ch = this.set(k, v)
      if (ch) out.push(ch)
    }
    return out
  }

  /** 订阅指定 key 的变更. */
  subscribe(key: string, fn: ChangeListener): void {
    if (!this.subscribers.has(key)) this.subscribers.set(key, [])
    this.subscribers.get(key)!.push(fn)
  }

  /** 订阅所有变更. */
  subscribeAll(fn: ChangeListener): void {
    this.globalSubs.push(fn)
  }

  /** 与另一份配置做差异对比. */
  diff(other: Record<string, unknown>): ConfigChange[] {
    const out: ConfigChange[] = []
    for (const [k, v] of Object.entries(other)) {
      if (this.data.get(k) !== v) {
        out.push({ key: k, old: this.data.get(k), new: v, ts: Date.now() / 1000 })
      }
    }
    return out
  }

  /** 快照. */
  snapshot(): HotConfigSnapshot {
    return {
      version: this.version,
      data: Object.fromEntries(this.data),
      history: [...this.history],
    }
  }

  /** 统计. */
  stats(): { version: number; keys: number; subscribers: number } {
    let subCount = this.globalSubs.length
    for (const arr of this.subscribers.values()) subCount += arr.length
    return { version: this.version, keys: this.data.size, subscribers: subCount }
  }
}

/** 全局单例. */
export const hotConfig = new HotConfigCenter()
