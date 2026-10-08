// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

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
 * 五条硬语义(都有用例钉死,见 apps/api/tests/run-idempotency.test.ts):
 * 1. 已完成重放 → 返回**同一个**资源,不是 409、也不是新建;
 * 2. 同 key 不同请求体 → `key-reused`(**绝不**把第一次的结果回给一个不同的请求 ——
 *    那是幂等层最阴的错:客户端以为成功了,实际拿到别人的资源);
 * 3. 创建抛错 → 释放槽位,同 key 可以立刻重试;不留孤儿锁。释放走**唯一出口**
 *    `releaseIdempotencySlot`,不在别处再写第二次 `kv.delete(key)`。
 * 4. **终态必达且互斥**(G-814421):从 `claim()` 返回 `'claimed'` 那一刻起本路径就**持有**
 *    槽位,它的出路只能是「提交 completed」或「释放」二者之一,恰好一个,异常/取消也不例外。
 *    这条不靠"记得调用"来保证:`createCommitOrRelease` 的返回类型是 `IdempotencySuccess<T>`
 *    (刻意不是 `IdempotencyResult<T>`),于是"持了槽却回一个失败"在类型层就不成立,而写
 *    终态的位置结构上只有一处。
 * 5. **业务成功之后绝不释放**(G-814421,与第 3 条**方向相反**,所以必须单列):`create()`
 *    已经返回 ⇒ 资源此刻真实存在。这时若因为收尾环节的异常(端口**同步**抛错、结果无法
 *    序列化、注入的时钟抛错)去 DEL,等于重新打开「同 key 再建一份资源」—— 那比回 500 严重
 *    得多。这些形态一律落到「如实报告 `slotProtected:false`」,由调用方打点,不静默。
 *
 * 第 4/5 条的判据形状来自上游 ZCode 的三处**同一**纪律(逐字读到体,不是转述):
 * - `bots/telegramChannelRuntime.ts:220-229` —— `assertBotCallbackSucceeded` 排在
 *   `writeTelegramOffset` **之前**;offset 是外部队列的消费确认点,业务失败前推进 = 永久丢消息。
 * - `bots/channelRuntime.ts:27-37` —— callback 用**返回值**表达可恢复的业务失败(不一定
 *   reject),所以"没抛错"不等于"成功了",外部游标只能在 `ok=true` 之后提交。
 * - `bots/botsService.ts:2650 / 2682 / 2704-2714` —— `markInboundDelivery` 与
 *   `releaseInboundDelivery` 成对出现,且**"错误提示发送成功"不算 ACK**:业务失败时必须
 *   `continue` 并且不提交游标。它的反向同型就是我方第 5 条 —— 业务已经成功时,收尾异常不得
 *   被读成业务失败。
 *
 * 本仓早有同纪律的先例:`plugins/open-idempotency.ts` 用 `hold.recorded` 这张门票做同一个
 * 二选一(onSend 刻上结果就不删,没刻票 onResponse 一律释放,见该文件 :77-81、:293-296、
 * :421-426)。那一层缓存的是**HTTP 响应**,本层锁的是**被创建出来的资源**,键空间与判据
 * 都不同,刻意不合并成一层。
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
export function idempotencySlotKey(namespace: string, ownerKey: string, clientKey: string): string {
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
export type IdempotencyResult<T> = IdempotencySuccess<T> | { ok: false; reason: IdempotencyFailure }

/**
 * 定位一张槽位所需的三要素 —— 与 `idempotencySlotKey` 的入参一一对应。
 *
 * 抽成独立导出的理由:释放出口必须能被**内核之外**的调用方按同一套坐标调用。若让它自己
 * 拼键字符串,就出现第二份拼键实现,漂了就把"释放了一张根本不存在的槽"读成"已释放"。
 */
export interface IdempotencySlotRef {
  /** 命名空间(如 `agent-run.create`),与 owner 一起构成隔离域。 */
  namespace: string
  /** 归属维度(如 `user:42`)。必须来自已鉴权身份,不得取客户端可控值。 */
  ownerKey: string
  /** 已归一化的客户端键。 */
  clientKey: string
}

export interface IdempotencyRequest<T> extends IdempotencySlotRef {
  kv: IdempotencyKv
  /** 请求指纹,见 `requestFingerprint`。 */
  fingerprint: string
  ttlMs: number
  /**
   * 真正的创建动作,只在抢到槽位后执行一次。
   * 它抛错或被取消(reject)⇒ 本层**释放**槽位后把原错误向上抛;它正常返回 ⇒ 本层**提交**
   * 结果,此后任何收尾异常都不得再释放(判据 5)。终态由 `createCommitOrRelease` 单点落。
   */
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
 * `withinDeadline` 的持槽专用变体:区别只在**同步**抛错。
 *
 * `withinDeadline(task, ms)` 拿到的是已经求值完的 Promise,所以端口方法如果在被调用的
 * 那一刻就同步抛错(坏适配器、被 mock 成非 async 的实现),异常会从**参数求值位置**冒出来,
 * 根本不进它的 try。持槽之后这两种端口调用(提交、释放)一旦被这种冒出来的异常影响,
 * 后果不是"少一次记录"而是**终态丢失**:槽位永久停在 `processing`,同 key 的重试被锁死,
 * 而请求方拿到一个 500。所以持槽之后一律走本版 —— 同步抛错与异步失败同判为"传输不可用"。
 *
 * 刻意**只**用在持槽之后的两处:`claim()` 与探针 `get()` 仍走 `withinDeadline`,因为那两条
 * 路径尚未拿到槽位,同步抛错冒到路由层是既有对外行为(本票不改它)。
 */
async function callKvWithinDeadline<T>(
  task: () => Promise<T>,
  deadlineMs: number,
): Promise<KvOutcome<T>> {
  try {
    return await withinDeadline(task(), deadlineMs)
  } catch {
    return { ok: false }
  }
}

/** 释放出口的结果三态(处置动作各不相同,所以不能并成一态)。 */
export type SlotReleaseOutcome =
  /** DEL 落成:同 key 的下一次请求会从头真跑。 */
  | 'released'
  /**
   * 这张槽已经不属于本次请求了(本次 `create` 跑过了 `ttlMs`,槽位过期后被另一路请求抢走
   * 并**成功建出资源**),所以刻意不删 —— 删掉就是把别人的完成记录抹了,同 key 会再建一份。
   */
  | 'not-ours'
  /** 传输不可用:槽位留到 TTL 自然回收,期间同 key 重试会得 409(既有语义,本票未改)。 */
  | 'store-unavailable'

export interface ReleaseSlotOptions {
  /**
   * 只在"这张槽仍属于本次请求"时释放:传本次的指纹。判据刻意只跳 **他人的 `completed`**
   * (那是唯一"删了会造成双跑"的形态);自己的 `processing`、脏数据、他人的 processing
   * 一律照删 —— 业务已经失败,锁留着只会把重试堵死。
   *
   * 如实登记能力边界:端口只有 GET/DEL,读与删之间**不原子**(真 CAS 要 Lua/WATCH,那是
   * 端口的第 5 条命令,本票不开)。这一层只把竞态窗口从"整个 create 时长"收窄到"一次 GET
   * 到一次 DEL 之间",不消除它。不带这个选项时行为与改动前逐字相同(无条件 DEL)。
   */
  onlyIfOwnedByFingerprint?: string
}

/**
 * **业务失败 ⇒ 释放槽位**的唯一出口(G-814421)。
 *
 * 为什么要有名字、而不是在 catch 里就地写一行 `kv.delete(key)`:
 * 1. 一行就地删是"某处恰好记得删",下一个失败路径(收尾异常、取消、路由层决定放弃本次
 *    创建)不会有第二个人记得 —— 本仓把这一型叫"造好没装车",而"没有强制出口"是它的
 *    前置形态:全仓当时 `git grep releaseIdempotency|markFailed|slotRelease` = 0。
 * 2. 释放是有判据的动作,不是 DEL:`not-ours` 那一格(见 `ReleaseSlotOptions`)只能由出口
 *    统一判,散在各处就会各写各的严格度。
 * 3. 它**永不抛错**。终态收尾动作把自己抛出去,就会顶掉原始业务错误(调用方随后按错的
 *    原因处置),那是本仓记过多次的"错误被清理代码吃掉"同型。传输不可用只以返回值表达。
 */
export async function releaseIdempotencySlot(
  kv: IdempotencyKv,
  slot: IdempotencySlotRef,
  options?: ReleaseSlotOptions,
): Promise<SlotReleaseOutcome> {
  const key = idempotencySlotKey(slot.namespace, slot.ownerKey, slot.clientKey)
  const guard = options?.onlyIfOwnedByFingerprint
  if (guard !== undefined) {
    const read = await callKvWithinDeadline(() => kv.get(key), KV_DEADLINE_MS)
    // 读不动 / 认不出的脏槽 ⇒ 不据此下"不是我的"结论,照旧往下删(宁可多解一次锁)。
    if (read.ok && typeof read.value === 'string') {
      const current = parseSlot(read.value)
      if (current !== null && current.status === 'completed' && current.fingerprint !== guard) {
        return 'not-ours'
      }
    }
  }
  const removed = await callKvWithinDeadline(() => kv.delete(key), KV_DEADLINE_MS)
  return removed.ok ? 'released' : 'store-unavailable'
}

/**
 * 提交载荷的构造。它**不得**让一次序列化/时钟异常冒充业务失败:那会把"资源已存在"错写成
 * "可以再来一次"。失败即回 null,由调用方按"没保护住"如实报告(判据 5)。
 */
function completedSlotPayload(
  fingerprint: string,
  value: unknown,
  now: () => number,
): string | null {
  try {
    const done: CompletedSlot = { status: 'completed', fingerprint, ts: now(), value }
    return JSON.stringify(done)
  } catch {
    return null
  }
}

/**
 * 幂等创建内核。`create` 抛错原样向上抛(路由决定怎么回 5xx),但一定先经
 * `releaseIdempotencySlot` 让出槽位;`create` 成功则只提交、绝不释放(判据 4/5)。
 * 未抢到槽位的路径**不持锁**,因此也绝不触发释放 —— 那会抹掉别人在途的锁或已成的记录。
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

  /**
   * 持槽之后的**唯一**收尾(判据 4:终态必达且互斥)。
   *
   * 返回类型刻意是 `IdempotencySuccess<T>` 而不是 `IdempotencyResult<T>`:"持着槽位回一个
   * `ok:false`"这个形态(既不提交也不释放,把同 key 的下一次请求永久堵成 409)在类型层就
   * 不成立,不需要靠人记得。失败一律以抛错出栈(由调用方决定怎么回 5xx),而出栈之前必已
   * 经走过释放出口。
   */
  const createCommitOrRelease = async (): Promise<IdempotencySuccess<T>> => {
    let value: T
    try {
      value = await input.create()
    } catch (error) {
      // 业务失败或被取消。`await` 把 create 的**同步**抛错也变成 rejection,所以这一 catch
      // 覆盖"抛错"与"取消"两型;槽位必须让出来,否则同 key 的合法重试会被锁死到 TTL 到期。
      // 出口自身永不抛错(结论由 `SlotReleaseOutcome` 的三态承载),所以它不可能顶掉这个原始错误。
      await releaseIdempotencySlot(input.kv, input, {
        onlyIfOwnedByFingerprint: input.fingerprint,
      })
      throw error
    }
    // ── 业务成功点。从这里往下**一律不得释放**(判据 5):资源已经真实存在,释放等于邀请
    //    同 key 再建一份。收尾环节的任何失败只有一种正确处置 —— 如实报告"这次没保护住"。
    const payload = completedSlotPayload(input.fingerprint, value, now)
    const wrote =
      payload === null
        ? ({ ok: false } as const)
        : await callKvWithinDeadline(
            () => input.kv.setWithTtl(key, payload, input.ttlMs),
            KV_DEADLINE_MS,
          )
    // 提交没落成(传输掉了 / 端口同步抛错 / 结果压根序列化不了):不能回 5xx,资源在;
    // 也不能释放,理由同上。槽位停在 processing ⇒ 同 key 重试期间得 409,由 TTL 自然回收。
    return { ok: true, value, replayed: false, slotProtected: wrote.ok }
  }

  const unprotectedCreate = async (): Promise<IdempotencyResult<T>> => {
    const created = await input.create()
    return { ok: true, value: created, replayed: false, slotProtected: false }
  }

  const first = await claim()
  if (first === 'claimed') return createCommitOrRelease()
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
    if (retry === 'claimed') return createCommitOrRelease()
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
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
