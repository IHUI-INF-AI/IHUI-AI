/**
 * Bug-198: 悲观锁.
 *
 * 获取锁 -> 修改 -> 释放; 死锁检测 + 超时释放.
 * - owner + lease 机制
 * - 死锁时主动释放最旧锁
 * - acquire / release
 *
 * 参考: git show 3ee96cf0:server/app/utils/bug198_pessimistic.py
 */

import { randomUUID } from 'node:crypto'

/** 锁信息. */
export interface PessimisticLock {
  key: string
  owner: string
  acquiredAt: number
  expiresAt: number
}

/** 统计. */
export interface LockStats {
  acquired: number
  released: number
  deadlockResolved: number
  active: number
}

/**
 * 悲观锁: owner + lease, 死锁时主动释放最旧.
 *
 * 注意: 这是进程内锁, 不适用于多实例部署.
 * 多实例请使用 Redis 分布式锁 (Redlock).
 */
export class PessimisticLocker {
  private readonly leaseSec: number
  private readonly locks = new Map<string, PessimisticLock>()
  private acquired = 0
  private released = 0
  private deadlockResolved = 0

  constructor(leaseSec = 10) {
    this.leaseSec = leaseSec
  }

  /**
   * 获取锁.
   * @returns owner token(用于释放); 若已被持有则返回 null
   */
  acquire(key: string, owner?: string): string | null {
    const o = owner ?? randomUUID()
    const now = Date.now() / 1000
    this.evict(now)
    if (this.locks.has(key)) return null
    this.locks.set(key, {
      key,
      owner: o,
      acquiredAt: now,
      expiresAt: now + this.leaseSec,
    })
    this.acquired += 1
    return o
  }

  /**
   * 尝试获取锁, 失败时等待重试.
   * @param key 锁 key
   * @param timeoutMs 总超时毫秒
   * @param intervalMs 重试间隔毫秒
   * @param owner 持有者标识
   */
  async acquireWithRetry(
    key: string,
    timeoutMs = 5000,
    intervalMs = 100,
    owner?: string,
  ): Promise<string | null> {
    const o = owner ?? randomUUID()
    const deadline = Date.now() + timeoutMs
    while (Date.now() < deadline) {
      const token = this.acquire(key, o)
      if (token) return token
      await new Promise((r) => setTimeout(r, intervalMs))
    }
    return null
  }

  /** 释放锁 (owner 必须匹配). */
  release(key: string, owner: string): boolean {
    const lock = this.locks.get(key)
    if (lock && lock.owner === owner) {
      this.locks.delete(key)
      this.released += 1
      return true
    }
    return false
  }

  /**
   * 死锁检测: 若同一 owner 持有多把锁, 视为潜在死锁, 释放最旧一把.
   * @returns 被释放的 key 列表
   */
  detectDeadlock(): string[] {
    const byOwner = new Map<string, PessimisticLock[]>()
    for (const lock of this.locks.values()) {
      const arr = byOwner.get(lock.owner) ?? []
      arr.push(lock)
      byOwner.set(lock.owner, arr)
    }
    const deadKeys: string[] = []
    for (const locks of byOwner.values()) {
      if (locks.length > 1) {
        // 释放最旧
        let oldest = locks[0]!
        for (const l of locks) {
          if (l.acquiredAt < oldest.acquiredAt) oldest = l
        }
        deadKeys.push(oldest.key)
      }
    }
    for (const k of deadKeys) {
      this.locks.delete(k)
      this.deadlockResolved += 1
    }
    return deadKeys
  }

  /** 清理过期锁. */
  private evict(now: number): void {
    for (const [k, lock] of this.locks) {
      if (lock.expiresAt <= now) this.locks.delete(k)
    }
  }

  /** 统计. */
  stats(): LockStats {
    return {
      acquired: this.acquired,
      released: this.released,
      deadlockResolved: this.deadlockResolved,
      active: this.locks.size,
    }
  }
}

/** 全局单例. */
export const pessimisticLocker = new PessimisticLocker()
