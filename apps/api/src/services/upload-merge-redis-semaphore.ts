// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * 分片上传「合并阶段」跨进程计数信号量(2026-09-26,收口 `upload-merge-gate.ts`
 * 文件头登记的那条边界:"闸是进程内的,多实例部署各限 N,跨进程协调另票")。
 *
 * 在修什么:`upload-merge-gate.ts` 的 FIFO 闸只在单进程内成立;多实例(N 个 API 进程)
 * 部署时每进程各限 N,真正的合并并发是 N×上限 —— 磁盘争抢与哈希 CPU 被线性放大,
 * 而"合并打满磁盘队列拖慢整站"这一故障形态恰恰在跨进程那一层复发。本模块把上限收回到
 * **跨进程真值**:一个 Redis 支撑的计数信号量。
 *
 * 三条设计决定(对应任务书,不是口味):
 *  ① **带 owner token 的 TTL 租约,不用永久占位**。占用以「一个带过期时间的 sorted-set
 *     成员」表示(score = 到期时间戳),acquire 的 Lua 脚本**先按当前时钟 ZREMRANGEBYSCORE
 *     清掉已到期成员**再判名额 —— 所以某个持有者进程崩了 / 网络分区 / 忘了 release,它的槽
 *     最多存活一个租约周期就自动回收,绝不会把上传永久打死。持有期间靠 `renew()` 续租
 *     (调用方 `upload-merge-gate.ts` 的闸按 leaseMs/RENEW_DIVISOR 心跳续,续租是 best-effort:
 *     续租失败不打断正在跑的合并,只是让该槽在租约到期后可被复用 —— 宁可提前让位也绝不双占)。
 *  ② **键名含环境前缀,禁止裸名**。`resolveUploadMergeSemaphoreKey()` 拼
 *     `ihui:upload-merge:<env>:slots`(可用 `UPLOAD_MERGE_REDIS_KEY_PREFIX` 覆盖命名空间)。
 *     共享 Redis 上多个部署/环境各用各的键,互不串槽。
 *  ③ **原子性只在 Lua 里做,判额与占用一步到位**。`ACQUIRE` 把「purge → ZCARD → 判上限 →
 *     ZADD」编成一次 `EVAL` —— Redis 单线程执行脚本,天然排除两进程同瞬各看到 size<limit 而
 *     双占。JS 侧不做二次判断,也就没有「测试假 Redis 镜像业务逻辑」的第二份真相。
 *
 * 消费点唯一:`upload-merge-gate.ts` 的层叠闸(redis 健康时经本模块取槽,不可用/未配置时回落到
 * 既有进程内闸并在首次 warn)。测试一律注入内存实现(`scripts/tests` 与本目录测试的假 Redis),
 * **默认不连库**(§5 测试隔离铁律:生产 Redis 端口 8811 空,本机 5432 另有实例)。
 */

/** 租约默认时长(ms)。取值依据:合并段 = 读全部 .part + 顺序写 + 流式实算 md5/sha256,
 *  单个上限 10 MB 的片(见 `PROTOCOL_UPLOAD_LIMITS.maxChunkBytes`)拼装 + 双哈希在
 *  正常磁盘下远低于此;120s 是「远大于 p99 合并耗时」的保守量级 —— 太长会让崩溃进程的
 *  僵尸槽白白占位太久,太短会让一次慢合并被自己的租约踢出、导致越限双占。 */
export const UPLOAD_MERGE_LEASE_DEFAULT_MS = 120_000
/** 续租把租约切成几段:`renewInterval = leaseMs / RENEW_DIVISOR`,保证一次续租抖动不会
 *  正好卡在到期边界(默认 40s 一续,离 120s 到期有三个身位)。 */
export const UPLOAD_MERGE_RENEW_DIVISOR = 3
/** 租约下限:低于此值视为误配(慢合并跑不完一次哈希就会被踢),回落默认档。 */
export const UPLOAD_MERGE_LEASE_MIN_MS = 5_000

/** env 出口键:租约时长与键命名空间。只调数值/前缀,不碰上限(上限单一真相源仍是
 *  `PROTOCOL_UPLOAD_LIMITS.maxConcurrentUploads` + `UPLOAD_MERGE_MAX_CONCURRENCY`)。 */
export const UPLOAD_MERGE_LEASE_ENV_KEY = 'UPLOAD_MERGE_REDIS_LEASE_MS'
export const UPLOAD_MERGE_KEY_PREFIX_ENV_KEY = 'UPLOAD_MERGE_REDIS_KEY_PREFIX'

/** EVAL 用到的最小 Redis 面。ioredis 的 `.eval(script, numKeys, ...args)` 即符合;
 *  测试内存实现只需实现这一条方法(见各测试文件的假 Redis)。刻意收窄到 `eval` 一个动词:
 *  占用/判额的原子性只可能来自脚本,拆成 zadd/zcard 多命令就会在跨进程下双占。 */
export interface MergeSemaphoreRedis {
  eval(script: string, numKeys: number, ...args: Array<string | number>): Promise<unknown>
}

/**
 * 键名解析:环境前缀 + 命名空间段。`env` 缺省取 `process.env.NODE_ENV ?? 'development'`,
 * `prefix` 缺省 `ihui:upload-merge`(可被 `UPLOAD_MERGE_REDIS_KEY_PREFIX` 覆盖)。
 * 结果恒形如 `ihui:upload-merge:production:slots` —— 环境段保证不同部署互不串槽。
 */
export function resolveUploadMergeSemaphoreKey(
  env: Record<string, string | undefined> = process.env,
): string {
  const base = (env[UPLOAD_MERGE_KEY_PREFIX_ENV_KEY] || '').trim() || 'ihui:upload-merge'
  const envSeg = (env.NODE_ENV || 'development').trim() || 'development'
  return `${base}:${envSeg}:slots`
}

/** 租约时长解析:非法/低于下限回落默认档并留源标记(读事实的人要能区分"没配"与"配坏了")。 */
export interface ResolvedUploadMergeLease {
  readonly leaseMs: number
  readonly renewIntervalMs: number
  readonly source: 'default' | 'env' | 'env-invalid-fallback'
  readonly raw: string | undefined
}
export function resolveUploadMergeLease(
  env: Record<string, string | undefined> = process.env,
): ResolvedUploadMergeLease {
  const raw = env[UPLOAD_MERGE_LEASE_ENV_KEY]
  const invalidFallback = (): ResolvedUploadMergeLease => ({
    leaseMs: UPLOAD_MERGE_LEASE_DEFAULT_MS,
    renewIntervalMs: Math.floor(UPLOAD_MERGE_LEASE_DEFAULT_MS / UPLOAD_MERGE_RENEW_DIVISOR),
    source: 'env-invalid-fallback',
    raw,
  })
  if (raw === undefined || raw.trim() === '') {
    return {
      leaseMs: UPLOAD_MERGE_LEASE_DEFAULT_MS,
      renewIntervalMs: Math.floor(UPLOAD_MERGE_LEASE_DEFAULT_MS / UPLOAD_MERGE_RENEW_DIVISOR),
      source: 'default',
      raw: undefined,
    }
  }
  const n = Number(raw)
  if (Number.isInteger(n) && n >= UPLOAD_MERGE_LEASE_MIN_MS) {
    return { leaseMs: n, renewIntervalMs: Math.floor(n / UPLOAD_MERGE_RENEW_DIVISOR), source: 'env', raw }
  }
  return invalidFallback()
}

/**
 * ACQUIRE:先清已到期(score <= now)的僵尸租约,再判名额,够则 ZADD 自己(now+ttl)。
 * 返回 { granted(0|1), active(当前占用数) }。numKeys=1,KEYS[1]=slots 键。
 * ARGV: now, ttl, limit, token。
 */
export const MERGE_SEMAPHORE_ACQUIRE_LUA = `
local now = tonumber(ARGV[1])
local ttl = tonumber(ARGV[2])
local limit = tonumber(ARGV[3])
redis.call('ZREMRANGEBYSCORE', KEYS[1], '-inf', now)
local n = redis.call('ZCARD', KEYS[1])
if n < limit then
  redis.call('ZADD', KEYS[1], now + ttl, ARGV[4])
  return { 1, redis.call('ZCARD', KEYS[1]) }
end
return { 0, n }
`.trim()

/** RENEW:仅当自己仍是成员时把 score 推到 now+ttl(不复活已被 purge 的槽 —— 已被踢出的
 *  持有者续租返回 0,由调用方决定不再依赖该槽;这正是"绝不双占"的边界)。 */
export const MERGE_SEMAPHORE_RENEW_LUA = `
if redis.call('ZSCORE', KEYS[1], ARGV[3]) then
  redis.call('ZADD', KEYS[1], tonumber(ARGV[1]) + tonumber(ARGV[2]), ARGV[3])
  return 1
end
return 0
`.trim()

/** RELEASE:摘掉自己的成员(owner token 保证只能解自己的锁,不会误删别人的槽)。 */
export const MERGE_SEMAPHORE_RELEASE_LUA = `
return redis.call('ZREM', KEYS[1], ARGV[1])
`.trim()

/** COUNT:清到期后回当前占用数(观测用,不参与判额)。 */
export const MERGE_SEMAPHORE_COUNT_LUA = `
redis.call('ZREMRANGEBYSCORE', KEYS[1], '-inf', tonumber(ARGV[1]))
return redis.call('ZCARD', KEYS[1])
`.trim()

export interface AcquireResult {
  /** 是否占到槽(1=granted)。 */
  readonly granted: boolean
  /** 本次操作后的占用数(Redis 侧读数,跨进程真值)。 */
  readonly active: number
}

export interface RedisMergeSemaphore {
  readonly key: string
  readonly limit: number
  readonly leaseMs: number
  acquire(owner: string): Promise<AcquireResult>
  renew(owner: string): Promise<boolean>
  release(owner: string): Promise<void>
  count(): Promise<number>
}

function toNumber(v: unknown): number {
  return typeof v === 'number' ? v : Number(v)
}

/**
 * 计数信号量。`redis` 由调用方(层叠闸)提供并保证可达;本层不吞错 ——
 * 任何 EVAL 失败都原样抛出,交由上层决定"回落进程内闸 + 首次 warn"。
 */
export function createRedisMergeSemaphore(opts: {
  redis: MergeSemaphoreRedis
  key: string
  limit: number
  leaseMs: number
  now?: () => number
}): RedisMergeSemaphore {
  const { redis, key, limit, leaseMs } = opts
  const now = opts.now ?? Date.now

  return {
    key,
    limit,
    leaseMs,
    async acquire(owner: string): Promise<AcquireResult> {
      const res = (await redis.eval(
        MERGE_SEMAPHORE_ACQUIRE_LUA,
        1,
        key,
        String(now()),
        String(leaseMs),
        String(limit),
        owner,
      )) as unknown[]
      // Lua 返回表 → Redis 数组回复 [granted, active];ioredis 给 [number, number]。
      const granted = Array.isArray(res) ? toNumber(res[0]) === 1 : toNumber(res) === 1
      const active = Array.isArray(res) ? toNumber(res[1]) : 0
      return { granted, active }
    },
    async renew(owner: string): Promise<boolean> {
      const res = await redis.eval(MERGE_SEMAPHORE_RENEW_LUA, 1, key, String(now()), String(leaseMs), owner)
      return toNumber(res) === 1
    },
    async release(owner: string): Promise<void> {
      await redis.eval(MERGE_SEMAPHORE_RELEASE_LUA, 1, key, owner)
    },
    async count(): Promise<number> {
      const res = await redis.eval(MERGE_SEMAPHORE_COUNT_LUA, 1, key, String(now()))
      return toNumber(res)
    },
  }
}
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
