/**
 * Bug-167: 异常注入器 (混沌测试).
 *
 * 在调用前后注入: 延迟 / 异常 / 中断, 验证系统韧性.
 * 支持: 规则 (target + 概率 + 行为) + 启用/禁用开关 + 注入统计.
 *
 * 参考: git show 3ee96cf0:server/app/utils/bug167_chaos.py
 */

/** 故障类型. */
export enum FaultType {
  /** 注入延迟 */
  LATENCY = 'LATENCY',
  /** 注入异常 */
  EXCEPTION = 'EXCEPTION',
  /** 注入中断 */
  ABORT = 'ABORT',
}

/** 故障规则. */
export interface FaultRule {
  /** 目标名 (e.g. "user.get") */
  target: string
  /** 故障类型 */
  fault: FaultType
  /** 触发概率 0~1, 默认 1 */
  probability: number
  /** LATENCY 延迟毫秒数, 默认 100 */
  latencyMs: number
  /** EXCEPTION 异常构造器, 默认 Error */
  exceptionCtor: new (msg: string) => Error
  /** EXCEPTION/ABORT 异常消息 */
  exceptionMsg: string
  /** 是否启用 */
  enabled: boolean
}

/** 注入统计. */
export interface FaultStats {
  hit: number
  skip: number
}

/** 创建规则的便捷工厂. */
export function createFaultRule(
  target: string,
  fault: FaultType,
  opts: Partial<Omit<FaultRule, 'target' | 'fault'>> = {},
): FaultRule {
  return {
    target,
    fault,
    probability: opts.probability ?? 1,
    latencyMs: opts.latencyMs ?? 100,
    exceptionCtor: opts.exceptionCtor ?? Error,
    exceptionMsg: opts.exceptionMsg ?? 'injected',
    enabled: opts.enabled ?? true,
  }
}

const sleep = (ms: number): Promise<void> => new Promise((r) => setTimeout(r, ms))

/**
 * 混沌注入器: target + 概率 + 行为.
 *
 * 同步规则(LATENCY 用 setTimeout 模拟 / EXCEPTION / ABORT)与异步包装.
 */
export class ChaosInjector {
  private readonly rules = new Map<string, FaultRule>()
  private enabled = true
  private readonly stats = new Map<string, FaultStats>()
  private readonly rand: () => number

  constructor(seed?: number) {
    // 简单线性同余生成器, 可复现
    let s = seed ?? Math.floor(Math.random() * 0xffffffff)
    this.rand = () => {
      s = (s * 1664525 + 1013904223) >>> 0
      return s / 0xffffffff
    }
  }

  /** 添加规则. */
  add(rule: FaultRule): void {
    this.rules.set(rule.target, rule)
    if (!this.stats.has(rule.target)) this.stats.set(rule.target, { hit: 0, skip: 0 })
  }

  /** 移除规则. */
  remove(target: string): boolean {
    return this.rules.delete(target)
  }

  /** 启用 (全局或单个 target). */
  enable(target?: string): void {
    if (target) {
      const r = this.rules.get(target)
      if (r) r.enabled = true
    } else {
      this.enabled = true
    }
  }

  /** 禁用 (全局或单个 target). */
  disable(target?: string): void {
    if (target) {
      const r = this.rules.get(target)
      if (r) r.enabled = false
    } else {
      this.enabled = false
    }
  }

  /** 尝试注入故障, 返回是否命中. */
  async hit(target: string): Promise<boolean> {
    const r = this.rules.get(target)
    const st = this.stats.get(target) ?? { hit: 0, skip: 0 }
    if (!r || !this.enabled || !r.enabled) {
      st.skip += 1
      this.stats.set(target, st)
      return false
    }
    if (this.rand() > r.probability) {
      st.skip += 1
      this.stats.set(target, st)
      return false
    }
    st.hit += 1
    this.stats.set(target, st)
    switch (r.fault) {
      case FaultType.LATENCY:
        await sleep(r.latencyMs)
        break
      case FaultType.EXCEPTION:
        throw new r.exceptionCtor(r.exceptionMsg)
      case FaultType.ABORT:
        throw new Error(`AbortError: ${r.exceptionMsg}`)
    }
    return true
  }

  /** 调用前注入故障, 实际执行 fn. */
  async wrap<T>(target: string, fn: () => T | Promise<T>): Promise<T> {
    await this.hit(target)
    return fn()
  }

  /** 装饰器: 给异步函数套上注入. */
  guard(target: string): <T extends (...args: never[]) => Promise<unknown>>(fn: T) => T {
    return <T2 extends (...args: never[]) => Promise<unknown>>(fn: T2): T2 => {
      const wrapper = (async (...args: never[]) => {
        await this.hit(target)
        return fn(...args)
      }) as T2
      return wrapper
    }
  }

  /** 统计. */
  getStats(): Record<string, FaultStats> {
    const out: Record<string, FaultStats> = {}
    for (const [k, v] of this.stats) out[k] = { ...v }
    return out
  }
}

/** 全局单例. */
export const chaosInjector = new ChaosInjector()
