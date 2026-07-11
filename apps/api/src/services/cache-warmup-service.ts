/**
 * 缓存预热服务。
 *
 * 在应用启动或定时任务触发时，预先将"热数据"加载到 Redis 缓存，
 * 避免冷启动时大量请求穿透到 DB。
 *
 * 设计：
 * - 通过 CacheBackend 接口解耦 Redis 客户端（便于测试）
 * - 支持"预热任务"注册：各业务模块注册自己的预热逻辑
 * - 支持优先级：critical(启动必须) / normal(启动后异步) / lazy(空闲时)
 *
 * 典型用法：
 *   registerWarmer('hot-articles', { priority: 'critical', load: async () => {...} })
 *   await runWarmup()  // 启动时调用
 */

export type WarmerPriority = 'critical' | 'normal' | 'lazy'

/** 缓存后端接口（与 ioredis 兼容）。 */
export interface CacheBackend {
  get(key: string): Promise<string | null>
  set(key: string, value: string, ttlSec?: number): Promise<void>
  del(key: string): Promise<void>
}

export interface WarmerTask {
  name: string
  priority: WarmerPriority
  /** 加载并写入缓存的函数。返回写入的键数。 */
  load: (cache: CacheBackend) => Promise<number>
  /** 预热间隔（毫秒），undefined 表示仅启动时执行一次。 */
  intervalMs?: number
}

interface ScheduledTask extends WarmerTask {
  timer: NodeJS.Timeout | null
  lastRunAt: Date | null
  lastKeysWritten: number
  lastError: string | null
}

const PRIORITY_ORDER: Record<WarmerPriority, number> = {
  critical: 0,
  normal: 1,
  lazy: 2,
}

const tasks = new Map<string, ScheduledTask>()
let backend: CacheBackend | null = null

/** 注入缓存后端（在 server 启动时调用，传入 server.redis 包装）。 */
export function setCacheBackend(b: CacheBackend): void {
  backend = b
}

/** 包装 ioredis 实例为 CacheBackend。 */
export function wrapRedis(redis: {
  get(key: string): Promise<string | null>
  set(key: string, value: string, mode?: string, ttl?: number): Promise<unknown>
  del(...keys: string[]): Promise<number>
}): CacheBackend {
  return {
    async get(key) {
      return redis.get(key)
    },
    async set(key, value, ttlSec) {
      if (ttlSec) await redis.set(key, value, 'EX', ttlSec)
      else await redis.set(key, value)
    },
    async del(key) {
      await redis.del(key)
    },
  }
}

/** 注册一个预热任务。 */
export function registerWarmer(task: WarmerTask): void {
  if (tasks.has(task.name)) {
    throw new Error(`预热任务 "${task.name}" 已存在`)
  }
  tasks.set(task.name, {
    ...task,
    timer: null,
    lastRunAt: null,
    lastKeysWritten: 0,
    lastError: null,
  })
}

/** 执行单个预热任务。 */
async function runTask(task: ScheduledTask): Promise<void> {
  if (!backend) {
    task.lastError = '缓存后端未初始化'
    return
  }
  try {
    const count = await task.load(backend)
    task.lastKeysWritten = count
    task.lastRunAt = new Date()
    task.lastError = null
  } catch (err) {
    task.lastError = err instanceof Error ? err.message : String(err)
  }
}

/** 执行所有预热任务（按优先级排序）。 */
export async function runWarmup(priority?: WarmerPriority): Promise<{
  executed: number
  failed: number
  totalKeys: number
}> {
  const sorted = Array.from(tasks.values()).sort(
    (a, b) => PRIORITY_ORDER[a.priority] - PRIORITY_ORDER[b.priority],
  )
  const filtered = priority ? sorted.filter((t) => t.priority === priority) : sorted

  let executed = 0
  let failed = 0
  let totalKeys = 0
  for (const task of filtered) {
    await runTask(task)
    executed++
    if (task.lastError) failed++
    totalKeys += task.lastKeysWritten
  }
  return { executed, failed, totalKeys }
}

/** 启动定时预热任务（为所有配置了 intervalMs 的任务启动定时器）。 */
export function startScheduledWarmup(): void {
  for (const task of tasks.values()) {
    if (task.intervalMs && !task.timer) {
      task.timer = setInterval(() => void runTask(task), task.intervalMs)
    }
  }
}

/** 停止所有定时预热任务。 */
export function stopScheduledWarmup(): void {
  for (const task of tasks.values()) {
    if (task.timer) {
      clearInterval(task.timer)
      task.timer = null
    }
  }
}

/** 获取所有预热任务的运行状态。 */
export function getWarmerStatus(): Array<{
  name: string
  priority: WarmerPriority
  lastRunAt: Date | null
  lastKeysWritten: number
  lastError: string | null
  scheduled: boolean
}> {
  return Array.from(tasks.values()).map((t) => ({
    name: t.name,
    priority: t.priority,
    lastRunAt: t.lastRunAt,
    lastKeysWritten: t.lastKeysWritten,
    lastError: t.lastError,
    scheduled: t.timer !== null,
  }))
}

/** 移除一个预热任务。 */
export function unregisterWarmer(name: string): boolean {
  const task = tasks.get(name)
  if (!task) return false
  if (task.timer) clearInterval(task.timer)
  return tasks.delete(name)
}
