/**
 * O10③ 通用**资源级**幂等层(与 run 解耦,可被任意路由复用)。
 *
 * 与 `plugins/open-idempotency.ts` 的关系 —— 两层互补,不是两套真相,谁都不覆盖谁:
 *
 * | 层                         | 缓存什么              | 生效前提                                 | 挂了怎么办 |
 * | -------------------------- | --------------------- | ---------------------------------------- | ---------- |
 * | open-idempotency(已有)   | **HTTP 响应体**       | `request.capability.idempotencyRequired` | fail-open  |
 * | 本层(新)                   | **被创建出来的资源**  | 调用方在自己的路由里显式声明             | 调用方选   |
 *
 * 为什么不能只靠上面那层:它是响应缓存,记录过期后同一个 key 会**重新创建一个资源**;
 * 而 O10① 的口径是"同一 `Idempotency-Key` 重放必须返回同一个 run"。资源级槽位记录的是
 * 创建结果本身,并且它服务的是**不走 capability 闸**的自有对外面(那层在这类路由上
 * `isEligible` 恒 false,压根不介入)。两层的键前缀也分开命名空间,永不互撞。
 *
 * 三条硬语义(都有用例钉死,见 apps/api/tests/run-idempotency.test.ts):
 * 1. 已完成重放 → 返回**同一个**资源,不是 409、也不是新建;
 * 2. 同 key 不同请求体 → `key-reused`(**绝不**把第一次的结果回给一个不同的请求 ——
 *    那是幂等层最阴的错:客户端以为成功了,实际拿到别人的资源);
 * 3. 创建抛错 → 释放槽位,同 key 可以立刻重试;不留孤儿锁。
 *
 * 零 I/O:传输靠注入 `IdempotencyKv`(Redis 形状端口),测试注入假实现即可零网络。
 */
import { createHash } from 'node:crypto'
import { normalizeHeader } from '../utils/http-normalize.js'

/** 本层槽位键前缀。与开放面响应缓存的 `idem:` 分开,运维可按前缀各自清理/统计。 */
export const SLOT_KEY_PREFIX = 'idem:res'
/** 请求头名(Fastify 会把 header key 小写化)。 */
export const IDEMPOTENCY_HEADER = 'idempotency-key'
/** 客户端 key 长度上限,与 `plugins/open-idempotency.ts` 的 200 同值,不引入第二个数。 */
export const MAX_CLIENT_KEY_LEN = 200
/**
 * 下限 8:幂等键的价值在于"撞不上别人"。允许 1~3 字符的 key 会让同命名空间下不同
 * 客户端大面积串槽,那比没有幂等更坏。太短的 key 一律当作"没带"处理(策略在路由侧显式生效)。
 */
export const MIN_CLIENT_KEY_LEN = 8
/** 抢槽后一次往返都不该拖过这个点:槽位保护失败可以降级,不能挂住请求。 */
export const KV_DEADLINE_MS = 1000

/** 本层用到的最小 KV 能力,形状与 ioredis 对齐(SET NX PX / GET / SET PX / DEL)。 */
export interface IdempotencyKv {
  /** 键不存在 → `null`(与真 Redis 一致;"读不动"是端口抛错,不是 null)。 */
  get(key: string): Promise<string | null>
  /** `SET key value PX ttl NX`:抢到返回 'OK',已被占返回 null。 */
  setIfAbsent(key: string, value: string, ttlMs: number): Promise<'OK' | null>
  setWithTtl(key: string, value: string, ttlMs: number): Promise<void>
  delete(key: string): Promise<void>
}

/**
 * 端口适配器。只声明用到的三条命令的形状,返回值一律 `Promise<unknown>` 再归一化 ——
 * 这样 ioredis 的重载签名(不同版本返回 `string | number | null` 不等)都能塞进来,
 * 而**不需要在本文件 import ioredis**(端口层不该绑死某个客户端库)。
 */
export interface RedisLike {
  get(key: string): Promise<unknown>
  set(key: string, value: string, px: string, ttlMs: number, nx: string): Promise<unknown>
  set(key: string, value: string, px: string, ttlMs: number): Promise<unknown>
  del(key: string): Promise<unknown>
}

export function createKvFromRedis(redis: RedisLike): IdempotencyKv {
  return {
    async get(key) {
      const raw = await redis.get(key)
      return typeof raw === 'string' ? raw : null
    },
    async setIfAbsent(key, value, ttlMs) {
      const raw = await redis.set(key, value, 'PX', ttlMs, 'NX')
      return typeof raw === 'string' && raw.toUpperCase() === 'OK' ? 'OK' : null
    },
    async setWithTtl(key, value, ttlMs) {
      await redis.set(key, value, 'PX', ttlMs)
    },
    async delete(key) {
      await redis.del(key)
    },
  }
}

/** 读客户端幂等键:非字符串 / 空白 / 过短 / 过长一律视为"没带"(过短等同无效)。 */
export function readIdempotencyKey(headers: Record<string, unknown>): string | null {
  // 收窄而非断言:非 string / string[] 的头值直接按"没带"处理,与函数名的语义一致
  const value = headers[IDEMPOTENCY_HEADER]
  const raw = normalizeHeader(typeof value === 'string' || Array.isArray(value) ? value : undefined)
  if (typeof raw !== 'string') return null
  const trimmed = raw.trim()
  if (trimmed.length < MIN_CLIENT_KEY_LEN) return null
  return trimmed.slice(0, MAX_CLIENT_KEY_LEN)
}

/** `idem:res:<namespace>:<owner>:<clientKey>` —— 归属维度必须在键里,否则跨租户串槽。 */
export function idempotencySlotKey(
  namespace: string,
  ownerKey: string,
  clientKey: string,
): string {
  return `${SLOT_KEY_PREFIX}:${namespace}:${ownerKey}:${clientKey}`
}

/** 递归排序键的 JSON,保证"语义相同的请求体"指纹相同(对象键序是客户端自由)。 */
export function canonicalJson(value: unknown): string {
  return JSON.stringify(sortDeep(value))
}

function sortDeep(value: unknown): unknown {
  if (Array.isArray(value)) return value.map((item) => sortDeep(item))
  if (value !== null && typeof value === 'object') {
    const source = value as Record<string, unknown>
    const out: Record<string, unknown> = {}
    for (const key of Object.keys(source).sort()) out[key] = sortDeep(source[key])
    return out
  }
  return value
}

/** 请求指纹:同 key 换了内容要能识别出来(判据 2)。 */
export function requestFingerprint(value: unknown): string {
  return createHash('sha256').update(canonicalJson(value)).digest('hex')
}

interface ProcessingSlot {
  status: 'processing'
  fingerprint: string
  ts: number
}
interface CompletedSlot {
  status: 'completed'
  fingerprint: string
  ts: number
  value: unknown
}

/** 认不出的槽位一律返回 null(脏数据),处置见 `runIdempotently` 尾部。 */
function parseSlot(raw: string): ProcessingSlot | CompletedSlot | null {
  let parsed: unknown
  try {
    parsed = JSON.parse(raw)
  } catch {
    return null
  }
  if (typeof parsed !== 'object' || parsed === null) return null
  const rec = parsed as Record<string, unknown>
  const ts = typeof rec.ts === 'number' ? rec.ts : 0
  const fingerprint = typeof rec.fingerprint === 'string' ? rec.fingerprint : ''
  if (rec.status === 'processing') return { status: 'processing', fingerprint, ts }
  if (rec.status === 'completed') {
    return { status: 'completed', fingerprint, ts, value: rec.value }
  }
  return null
}

export type IdempotencyFailure = 'in-progress' | 'key-reused' | 'store-unavailable'

export interface IdempotencySuccess<T> {
  ok: true
  value: T
  /** true = 命中已完成槽位,本次没有真的再创建一次。 */
  replayed: boolean
  /**
   * false = 槽位没被保护住(传输不可用且 `degrade:'open'`,或写结果时传输掉了)。
   * 调用方应据此打点:业务成功但幂等保护缺席,是必须看得见的事实,不得静默。
   */
  slotProtected: boolean
}
export type IdempotencyResult<T> =
  | IdempotencySuccess<T>
  | { ok: false; reason: IdempotencyFailure }

export interface IdempotencyRequest<T> {
  kv: IdempotencyKv
  /** 命名空间(如 `agent-run.create`),与 owner 一起构成隔离域。 */
  namespace: string
  /** 归属维度(如 `user:42`)。必须来自已鉴权身份,不得取客户端可控值。 */
  ownerKey: string
  /** 已归一化的客户端键。 */
  clientKey: string
  /** 请求指纹,见 `requestFingerprint`。 */
  fingerprint: string
  ttlMs: number
  /** 真正的创建动作。只在抢到槽位后执行一次;抛错会释放槽位。 */
  create: () => Promise<T>
  /**
   * 传输不可用时的策略。默认 `closed`:本层是这些面**唯一**的重复创建防线,
   * 放行的代价是真金白银的双跑。`open` 只给"另有响应缓存兜底、或宁可用不可停"的面用
   * —— 那种口径已在 `plugins/open-idempotency.ts` 头部论证过,两处判据不同,不要合并。
   */
  degrade?: 'closed' | 'open'
  /** 注入时钟,便于测试槽位时间语义。 */
  now?: () => number
}

type KvOutcome<T> = { ok: true; value: T } | { ok: false }

/**
 * `Promise.race` 包一层:把"可能永不 reject 的 KV 命令"(ioredis 在本项目
 * `maxRetriesPerRequest: null` 下断连即入队挂起)翻译成可判定的成/败。
 * 不加截止就等于把降级实现成挂死,比拦人更糟。
 */
async function withinDeadline<T>(task: Promise<T>, deadlineMs: number): Promise<KvOutcome<T>> {
  let timer: ReturnType<typeof setTimeout> | undefined
  try {
    const value = await Promise.race([
      task,
      new Promise<never>((_resolve, reject) => {
        timer = setTimeout(() => reject(new Error('idempotency kv deadline exceeded')), deadlineMs)
      }),
    ])
    return { ok: true, value }
  } catch {
    return { ok: false }
  } finally {
    if (timer !== undefined) clearTimeout(timer)
  }
}

/**
 * 幂等创建内核。`create` 抛错原样向上抛(路由决定怎么回 5xx),但一定先释放槽位。
 */
export async function runIdempotently<T>(
  input: IdempotencyRequest<T>,
): Promise<IdempotencyResult<T>> {
  const key = idempotencySlotKey(input.namespace, input.ownerKey, input.clientKey)
  const now = input.now ?? ((): number => Date.now())
  const degrade = input.degrade ?? 'closed'

  const claim = async (): Promise<'claimed' | 'taken' | 'down'> => {
    const slot: ProcessingSlot = {
      status: 'processing',
      fingerprint: input.fingerprint,
      ts: now(),
    }
    const res = await withinDeadline(
      input.kv.setIfAbsent(key, JSON.stringify(slot), input.ttlMs),
      KV_DEADLINE_MS,
    )
    if (!res.ok) return 'down'
    return res.value === 'OK' ? 'claimed' : 'taken'
  }

  const createAndCommit = async (): Promise<IdempotencySuccess<T>> => {
    let value: T
    try {
      value = await input.create()
    } catch (error) {
      // 创建失败:槽位必须让出来,否则同 key 的合法重试会被锁死到 TTL 到期。
      await withinDeadline(input.kv.delete(key), KV_DEADLINE_MS)
      throw error
    }
    const done: CompletedSlot = {
      status: 'completed',
      fingerprint: input.fingerprint,
      ts: now(),
      value,
    }
    const wrote = await withinDeadline(
      input.kv.setWithTtl(key, JSON.stringify(done), input.ttlMs),
      KV_DEADLINE_MS,
    )
    // 写结果时传输掉了:资源已经存在,不能回 5xx,只能如实报告"这次没保护住"。
    return { ok: true, value, replayed: false, slotProtected: wrote.ok }
  }

  const unprotectedCreate = async (): Promise<IdempotencyResult<T>> => {
    const created = await input.create()
    return { ok: true, value: created, replayed: false, slotProtected: false }
  }

  const first = await claim()
  if (first === 'claimed') return createAndCommit()
  if (first === 'down') {
    return degrade === 'open' ? unprotectedCreate() : { ok: false, reason: 'store-unavailable' }
  }

  const probed = await withinDeadline(input.kv.get(key), KV_DEADLINE_MS)
  if (!probed.ok) {
    // 读不动:它**有可能**正是别人还在跑的那一把。默认宁可 409 不可双跑;
    // 只有调用方显式选了 open(它另有兜底防线)才降级创建。
    return degrade === 'open' ? unprotectedCreate() : { ok: false, reason: 'in-progress' }
  }
  if (probed.value === null) {
    // 键在 claim 与 get 之间蒸发了:此刻真空,赌一次重抢(SET NX 原子,并发里最多一个赢家)。
    const retry = await claim()
    if (retry === 'claimed') return createAndCommit()
    if (retry === 'down') {
      return degrade === 'open' ? unprotectedCreate() : { ok: false, reason: 'store-unavailable' }
    }
    return { ok: false, reason: 'in-progress' }
  }

  const slot = parseSlot(probed.value)
  if (slot === null) return { ok: false, reason: 'in-progress' } // 脏槽:宁可 409,不可双跑
  if (slot.fingerprint !== input.fingerprint) return { ok: false, reason: 'key-reused' }
  if (slot.status === 'processing') return { ok: false, reason: 'in-progress' }
  return { ok: true, value: slot.value as T, replayed: true, slotProtected: true }
}
