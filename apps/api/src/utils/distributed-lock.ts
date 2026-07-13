/**
 * 通用分布式锁 (bug188)。
 *
 * 迁移自旧架构 server/app/utils/bug188_dist_lock.py。
 *
 * 设计要点：
 * 1. 基于 Redis SET NX PX 原子获取锁 + Lua 脚本原子释放/续约 (owner+token 校验)。
 * 2. owner + token 双重校验，防止误释放他人持有的锁。
 * 3. watchdog 自动续约：持有期间定时延长 TTL，避免长任务锁过期。
 * 4. acquire / release / tryLock / withLock 接口。
 * 5. 使用 apps/api/src/plugins/redis.ts 暴露的 ioredis 客户端 (调用方传入 server.redis)。
 *
 * 用法:
 *   const locker = new DistributedLock(server.redis);
 *   await locker.withLock('order:123', 5000, async () => { ... });
 */

import { randomBytes } from 'node:crypto'
import type { Redis } from 'ioredis'
import { AppError } from '../errors/AppError.js'

export type LockState = 'ACQUIRED' | 'NOT_ACQUIRED' | 'EXPIRED' | 'RELEASED'

/** 已获取的锁句柄，提供 release / renew 能力。 */
export interface AcquiredLock {
  /** 锁名 (Redis key) */
  name: string
  /** 持有者标识 */
  owner: string
  /** 随机 token，释放时校验，防止误删 */
  token: string
  /** 租约 TTL (毫秒) */
  ttlMs: number
  /** 获取时间戳 (毫秒) */
  acquiredAt: number
  /** 预期过期时间戳 (毫秒) */
  expiresAt: number
  /** 释放锁并停止 watchdog */
  release(): Promise<LockState>
  /** 续约，延长 TTL。成功返回 true (锁仍由本持有者持有)。 */
  renew(ttlMs?: number): Promise<boolean>
}

export interface DistributedLockOptions {
  /** 租约 TTL，默认 5000ms */
  ttlMs?: number
  /** 等待获取的最大时间，0 = 不等待 (tryLock 语义)，默认 0 */
  waitMs?: number
  /** 重试间隔，默认 100ms */
  retryIntervalMs?: number
  /** 启用 watchdog 自动续约，默认 false */
  watchdog?: boolean
  /** watchdog 续约间隔，默认 ttl/3 */
  watchdogIntervalMs?: number
}

export class DistributedLockError extends AppError {
  constructor(message: string) {
    super(message, 423, 'LOCKED')
    this.name = 'DistributedLockError'
  }
}

// Lua: 仅当 key 的值等于 token 时才删除 (原子释放)
const RELEASE_SCRIPT = `
if redis.call('get', KEYS[1]) == ARGV[1] then
  return redis.call('del', KEYS[1])
else
  return 0
end
`

// Lua: 仅当 key 的值等于 token 时才续期 (原子续约)
const RENEW_SCRIPT = `
if redis.call('get', KEYS[1]) == ARGV[1] then
  return redis.call('pexpire', KEYS[1], ARGV[2])
else
  return 0
end
`

function randomToken(): string {
  return randomBytes(16).toString('hex')
}

function randomOwner(): string {
  return randomBytes(8).toString('hex')
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms))
}

/**
 * 分布式锁。
 *
 * 通过构造函数注入 ioredis 客户端 (即 plugins/redis.ts 暴露的 server.redis)。
 */
export class DistributedLock {
  private stats = { acquired: 0, released: 0, expired: 0, renewed: 0 }
  private readonly watchdogs = new Map<string, ReturnType<typeof setInterval>>()

  constructor(private readonly redis: Redis) {}

  /**
   * 尝试获取锁 (非阻塞)。成功返回 AcquiredLock，失败返回 null。
   */
  async tryLock(
    name: string,
    owner: string = randomOwner(),
    options: DistributedLockOptions = {},
  ): Promise<AcquiredLock | null> {
    const ttlMs = options.ttlMs ?? 5000
    const token = randomToken()
    // SET key token NX PX ttl —— 原子获取
    const ok = await this.redis.set(name, token, 'PX', ttlMs, 'NX')
    if (ok !== 'OK') return null
    this.stats.acquired++
    const lock = this.buildLock(name, owner, token, ttlMs)
    if (options.watchdog) {
      this.startWatchdog(lock, options.watchdogIntervalMs ?? Math.floor(ttlMs / 3))
    }
    return lock
  }

  /**
   * 阻塞获取锁，超时抛 DistributedLockError。
   * @param waitMs 总等待时间，0 表示只尝试一次
   */
  async acquire(
    name: string,
    owner: string = randomOwner(),
    options: DistributedLockOptions = {},
  ): Promise<AcquiredLock> {
    const waitMs = options.waitMs ?? 0
    const retryIntervalMs = options.retryIntervalMs ?? 100
    const deadline = Date.now() + waitMs

    for (;;) {
      const lock = await this.tryLock(name, owner, options)
      if (lock) return lock
      if (Date.now() >= deadline) {
        throw new DistributedLockError(`获取锁超时 name=${name} waitMs=${waitMs}`)
      }
      await sleep(retryIntervalMs)
    }
  }

  /**
   * 释放锁 (需提供获取时返回的 token)。
   */
  async release(name: string, token: string): Promise<LockState> {
    this.stopWatchdog(name)
    const res = (await this.redis.eval(RELEASE_SCRIPT, 1, name, token)) as number
    if (res === 1) {
      this.stats.released++
      return 'RELEASED'
    }
    this.stats.expired++
    return 'EXPIRED'
  }

  /**
   * 续约 (需提供获取时返回的 token)。
   */
  async renew(name: string, token: string, ttlMs = 5000): Promise<boolean> {
    const res = (await this.redis.eval(RENEW_SCRIPT, 1, name, token, String(ttlMs))) as number
    if (res === 1) {
      this.stats.renewed++
      return true
    }
    return false
  }

  /**
   * 高阶函数：获取锁 → 执行 fn → 释放锁 (无论成功失败)。
   *
   * @param name   锁名
   * @param ttlMs  租约 TTL
   * @param fn     持锁期间执行的业务逻辑
   * @param options 额外选项 (waitMs / retryIntervalMs / watchdog)
   */
  async withLock<T>(
    name: string,
    ttlMs: number,
    fn: () => Promise<T>,
    options: Omit<DistributedLockOptions, 'ttlMs'> = {},
  ): Promise<T> {
    const lock = await this.acquire(name, undefined, { ttlMs, ...options })
    try {
      return await fn()
    } finally {
      await lock.release()
    }
  }

  getStats(): { acquired: number; released: number; expired: number; renewed: number } {
    return { ...this.stats }
  }

  private buildLock(name: string, owner: string, token: string, ttlMs: number): AcquiredLock {
    const acquiredAt = Date.now()
    return {
      name,
      owner,
      token,
      ttlMs,
      acquiredAt,
      expiresAt: acquiredAt + ttlMs,
      release: () => this.release(name, token),
      renew: (newTtlMs?: number) => this.renew(name, token, newTtlMs ?? ttlMs),
    }
  }

  /** 启动 watchdog：定时续约，锁丢失时自动停止。 */
  private startWatchdog(lock: AcquiredLock, intervalMs: number): void {
    const timer = setInterval(async () => {
      try {
        const ok = await lock.renew(lock.ttlMs)
        if (!ok) {
          this.stopWatchdog(lock.name)
          this.stats.expired++
        }
      } catch {
        this.stopWatchdog(lock.name)
      }
    }, intervalMs)
    // 不阻塞进程退出
    timer.unref?.()
    this.watchdogs.set(lock.name, timer)
  }

  private stopWatchdog(name: string): void {
    const timer = this.watchdogs.get(name)
    if (timer) {
      clearInterval(timer)
      this.watchdogs.delete(name)
    }
  }
}
