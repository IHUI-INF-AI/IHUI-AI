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
 *
 * G-734(跨会话幂等事实的窄增量)在本层落的三格 —— 上游同一张 `v4_command_fact` 表把这三条
 * 写成硬规矩,我方此前一条都没有:
 *
 * - **① 父作用域必须编进全局主键**。`IdempotencySlotRef.parentKey`(`slotKeyOf`)把父段做成
 *   一个**不可伪造**的段:带父段的键里父段恒以 `%p` 起头,而段转义只会产出 `%25`/`%3A` 两种
 *   `%` 序列,所以"带父段"与"不带父段"、以及"(owner='b',parent='c')"与"(owner='b:c')"这类
 *   元组**永远折不到同一个键上**。光加一个维度而段界仍可折叠 = 没加 —— 那正是"两个会话复用同一
 *   commandId 互相覆盖事实"的机械形态。服务端段(namespace / ownerKey)越界即抛 `SlotScopeError`,
 *   在拼键那一刻炸,而不是留下一个会折叠的键让别人去踩。
 * - **② 事实损坏即硬错,绝不重建**:`completed` 槽认出自己是"一张已完成的事实"却读不出载荷
 *   (缺 `value` 键)⇒ `parseSlot` 判 `corrupt` ⇒ 内核**抛 `IdempotencyFactCorruptError`**。
 *   它既不是"原样把 undefined 回给客户端"(那是把损坏洗成看起来正常),也不是 409-in-progress
 *   (那把损坏读成"别人还在跑"),更不是重跑 `create()`(重建)。写侧同样对称:载荷序列化成
 *   `undefined` 一律**不落**这种事实,只如实报 `slotProtected:false`。
 * - **③ 提交前引用局部性全量断言**:`SlotLocalitySpec`(`locality`)在**提交那一刻**与**重放那一刻**
 *   各跑一遍(重放尤其必须跑 —— 槽里的值是读回来的,不是本次 `create` 的产物),事实里每一条交叉
 *   引用都得落在 child 集合内,越界即抛 `IdempotencyLocalityError`。**违规既不提交也不释放**:
 *   业务已经成功时释放等于邀请同 key 再建一份(判据 5),而那正是 ② 禁止的"重建"。
 *
 * 未落的一格(不是本层的活):票面"落地"要的**那张 ack-fact 表 + 客户端可持 commandId 的创建端点**
 * —— 新表需要已应用的迁移,本票明令不得碰 `packages/database/drizzle/**` 与 journal,故只把三条
 * 语义收进这张可复用的槽位内核,表与其端点另计一票(判据写在该行台账)。
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

/**
 * G-734① 段转义。只动两个字符:`%`→`%25`、`:`→`%3A`。
 *
 * 为什么必须转义而不是"约定大家别用冒号":这张键的全部段落里,`clientKey` 是**客户端可整写**的
 * (HTTP 头),`parentKey` 在 ack-fact 那一型里同样是客户端持有的会话句柄。只要有一个段能自由
 * 携带分隔符,"元组 → 键"就不是单射,而单射失效的表现不是报错,是**两个作用域写到同一条事实头上**
 * —— 票面 ① 要防的正是这一条。
 *
 * 代价如实登记:含 `:` 或 `%` 的既有 Idempotency-Key 在升级后会落到另一个槽位上,最坏后果是
 * 那一个 key 白丢一次幂等保护(重跑一次创建),而**不会**读到别人的结果 —— 比"折槽"轻得多。
 * 不含这两个字符的 key(uuid 形态)输出**逐字节不变**,所以上线不产生任何伪重放。
 */
function escapeSlotSegment(raw: string): string {
  let out = ''
  for (const ch of raw) {
    if (ch === '%') out += '%25'
    else if (ch === ':') out += '%3A'
    else out += ch
  }
  return out
}

/**
 * 父段的标记前缀。转义表只会产出 `%25` / `%3A` 两种以 `%` 开头的序列,因此**没有任何转义结果
 * 会以 `%p` 起头**;而服务端段(见 `assertServerSegment`)整族禁止出现 `%`。两条合起来给出:
 * 一个以 `%p` 起头的段只可能是父段 —— 带父段与不带父段的键永远折不到一起。
 * 加了新维度却不能靠它区分,等于没加。
 */
const PARENT_SEGMENT_MARK = '%p'

/** 槽位坐标本身不合法 —— 这是**编程错误**,必须在拼键那一刻炸,而不是留下一个会折叠的键。 */
export class SlotScopeError extends Error {
  readonly code = 'IDEMPOTENCY_SLOT_SCOPE_INVALID'
  constructor(message: string) {
    super(message)
    this.name = 'SlotScopeError'
  }
}

/**
 * 服务端段的字符纪律:`%` 会破坏"转义结果唯一"这一前提,冒号的用法则由段位决定。
 * - `namespace`:不得含 `:`(它恒占第一段)也不得含 `%`;
 * - `ownerKey`:不得含 `%`,允许冒号作内部分隔(`user:42`),但不得有空段
 *   (空段会让 `a::b` 与 `a:` + 另一段读成同一个串)。
 */
function assertServerSegment(value: string, label: string, allowColon: boolean): void {
  if (value.length === 0) {
    throw new SlotScopeError(`槽位段 ${label} 不得为空 —— 空段会让两个作用域折成同一个键`)
  }
  if (value.includes('%')) {
    throw new SlotScopeError(`槽位段 ${label} 不得含 '%':转义符必须只属于转义段`)
  }
  if (!allowColon && value.includes(':')) {
    throw new SlotScopeError(`槽位段 ${label} 不得含冒号(段位分隔符)`)
  }
  if (allowColon && (value.startsWith(':') || value.endsWith(':') || value.includes('::'))) {
    throw new SlotScopeError(`槽位段 ${label} 的冒号两侧都必须有内容(空段会让段界失去意义)`)
  }
}

/**
 * 唯一的拼键实现。**段序固定**为 `namespace / ownerKey / [父段] / clientKey`,且
 * `元组 → 键字符串` 是单射(论证见 `escapeSlotSegment` 与 `PARENT_SEGMENT_MARK`:每个段都
 * 不含裸冒号,段界因此可以从左到右唯一还原)。
 *
 * 不带 `parentKey` 时输出与既有形态逐字同形(`idem:res:<ns>:<owner>:<client>`),既有槽位与既有
 * 测试的字节形态都不受影响。
 */
export function slotKeyOf(ref: IdempotencySlotRef): string {
  assertServerSegment(ref.namespace, 'namespace', false)
  assertServerSegment(ref.ownerKey, 'ownerKey', true)
  const parentPart =
    ref.parentKey === undefined
      ? ''
      : `:${PARENT_SEGMENT_MARK}${escapeSlotSegment(assertNonEmptySegment(ref.parentKey, 'parentKey'))}`
  return `${SLOT_KEY_PREFIX}:${ref.namespace}:${ref.ownerKey}${parentPart}:${escapeSlotSegment(
    assertNonEmptySegment(ref.clientKey, 'clientKey'),
  )}`
}

function assertNonEmptySegment(value: string, label: string): string {
  if (value.length === 0) {
    throw new SlotScopeError(`槽位段 ${label} 不得为空`)
  }
  return value
}

/**
 * `idem:res:<namespace>:<owner>:<clientKey>` —— 归属维度必须在键里,否则跨租户串槽。
 *
 * 保留这个三参形态是为了不撬既有调用点与既有钉死其字节形态的测试;它只是 `slotKeyOf` 的投影,
 * **不是第二份拼键逻辑**。要带父作用域(G-734①)请传完整的 ref。
 */
export function idempotencySlotKey(namespace: string, ownerKey: string, clientKey: string): string {
  return slotKeyOf({ namespace, ownerKey, clientKey })
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

/**
 * G-734②:认得出"这是一张已完成的事实"、但它的载荷根本不在 —— 判 `corrupt`,不判"脏数据"。
 *
 * 两型必须分开,因为处置相反:认不出形状(`parseSlot` 回 `null`)有可能正是别人还在跑的那把锁,
 * 既有判据一律 409(宁可拦不可双跑,见 `runIdempotently` 尾部);而**已完成的**事实缺载荷,
 * 不存在"还在跑"的可能,把它回成 409 是把损坏读成"稍后重试",把它原样回放是洗成"看起来正常",
 * 重跑一次 `create()` 更是直接把损坏重建掉 —— 三条都不许,只有硬错这一条出路。
 *
 * 它仍然带着 `status`/`fingerprint`/`ts`:损坏的只是**载荷**,不是整条记录。留着这三个字段,
 * `key-reused`(越界复用同一个客户端 key 打不同请求体)才不会被损坏档替它洗责 —— 那既是既有
 * 语义的优先级,也是 TS 收窄上唯一不必特判的写法。
 */
interface CorruptCompletedSlot {
  status: 'corrupt'
  fingerprint: string
  ts: number
}

/** 认不出的槽位一律返回 null(脏数据),处置见 `runIdempotently` 尾部。 */
function parseSlot(raw: string): ProcessingSlot | CompletedSlot | CorruptCompletedSlot | null {
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
    // 判据是**键在不在**,不是值真不真:`JSON.stringify` 会把 `value: undefined` 整键抹掉,
    // 于是"创建动作压根没产出任何可回放的东西"这一型只能靠键缺席认出来。
    // 刻意不把 `null` 也算损坏 —— null 是调用方**选择记下**的一个值,而键缺席不是。
    if (!Object.prototype.hasOwnProperty.call(rec, 'value')) {
      return { status: 'corrupt', fingerprint, ts }
    }
    return { status: 'completed', fingerprint, ts, value: rec.value }
  }
  return null
}

export type IdempotencyFailure = 'in-progress' | 'key-reused' | 'store-unavailable'

/**
 * G-734② —— 事实损坏。刻意**不是** `IdempotencyFailure` 的一个新档:
 * 失败档的语义是"这次没成,可以按原因处置",而损坏事实的语义是"这张槽记着的东西不可信"——
 * 一旦把它塞进 `ok:false` 的联合类型,下一个调用方就会顺手 `if (!res.ok) → 重试一次`,
 * 那正是本条禁止的"重建"。抛错让它在类型层就没有第二条路。
 */
export class IdempotencyFactCorruptError extends Error {
  readonly code = 'IDEMPOTENCY_FACT_CORRUPT'
  readonly slotKey: string
  constructor(slotKey: string, reason: string) {
    super(`幂等事实已损坏(${reason}),槽位 ${slotKey} —— 绝不回放、绝不重建`)
    this.name = 'IdempotencyFactCorruptError'
    this.slotKey = slotKey
  }
}

/**
 * G-734③ —— 事实里的交叉引用落在 child 集合之外。
 *
 * 违规那一刻**既不提交也不释放**:业务已经成功(资源真实存在),释放等于把这张槽重新开放给
 * "同 key 再建一份"(判据 5),而重建正是 ②/③ 一起禁掉的动作。槽停在 processing,同 key 的
 * 后续请求要么撞上同一个硬错(载荷仍在),要么 409 到 TTL —— 两种都**响亮**,没有第三种"看起来正常"。
 */
export class IdempotencyLocalityViolationError extends Error {
  readonly code = 'IDEMPOTENCY_LOCALITY_VIOLATION'
  readonly slotKey: string
  readonly phase: SlotLocalityPhase
  readonly offenders: readonly string[]
  constructor(slotKey: string, phase: SlotLocalityPhase, offenders: readonly string[]) {
    super(
      `幂等事实的交叉引用越出 child 集合(${phase} 阶段):${offenders.join(', ')} —— 事实不予提交`,
    )
    this.name = 'IdempotencyLocalityViolationError'
    this.slotKey = slotKey
    this.phase = phase
    this.offenders = offenders
  }
}

/** 局部性断言的两个跑点,报告里必须分开 —— 它们查的是**两份不同的值**。 */
export type SlotLocalityPhase = 'commit' | 'replay'

/**
 * 断言时可见的槽位坐标(即 child 集合的坐标本身)。刻意与 `IdempotencySlotRef` **同一个类型**:
 * 两处各写一遍"这条槽由哪些段定位",将来加一段(比如租户)就会有一处忘,而漏掉的那处只会让
 * child 集合变小 —— 表现为"合规的事实被判越界",不是安静,是误伤。
 */
export type SlotLocalityScope = IdempotencySlotRef

export interface SlotLocalitySpec<T> {
  /**
   * 取出这份事实引用的**全部**外部实体(规范化作用域串,如 `user:42`)。
   * 回调抛错 = 这份事实连读都读不动 ⇒ 内核按 ② 判损坏(硬错),绝不因为"取不出引用"就当作通过。
   */
  refsOf(value: T): readonly string[]
  /** child 集合:允许被这份事实引用的归属范围。缺省 = `[scope.ownerKey]`(加父段时另给)。 */
  childSetOf?(scope: SlotLocalityScope): readonly string[]
}

/** 缺省 child 集合:这张槽的归属本身(带父段时把父段也算进 child 集合)。 */
function defaultChildSet(scope: SlotLocalityScope): readonly string[] {
  return scope.parentKey === undefined ? [scope.ownerKey] : [scope.ownerKey, scope.parentKey]
}

/**
 * 跑一次局部性断言(③)。`commit` 查本次 `create()` 的产物,`replay` 查**从 KV 读回来**的产物 ——
 * 后者才是这一族的真危险:回放路径上的值不是本次调用生成的,键一旦折槽或被人写过,
 * 越权事实就会被本层签成"你自己的资源"并回给请求方。
 */
function assertFactLocality<T>(
  value: T,
  spec: SlotLocalitySpec<T>,
  scope: SlotLocalityScope,
  slotKey: string,
  phase: SlotLocalityPhase,
): void {
  let refs: readonly string[]
  try {
    refs = spec.refsOf(value)
  } catch (error) {
    const reason = error instanceof Error ? error.message : String(error)
    throw new IdempotencyFactCorruptError(slotKey, `局部性回调读不出引用:${reason}`)
  }
  const child = new Set(spec.childSetOf?.(scope) ?? defaultChildSet(scope))
  const offenders = refs.filter((ref) => !child.has(ref))
  if (offenders.length > 0) throw new IdempotencyLocalityViolationError(slotKey, phase, offenders)
}

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
 * 定位一张槽位所需的要素 —— 与 `slotKeyOf` 读取的段落一一对应。
 *
 * 抽成独立导出的理由:释放出口必须能被**内核之外**的调用方按同一套坐标调用。若让它自己
 * 拼键字符串,就出现第二份拼键实现,漂了就把"释放了一张根本不存在的槽"读成"已释放"。
 */
export interface IdempotencySlotRef {
  /** 命名空间(如 `agent-run.create`),与 owner 一起构成隔离域。 */
  namespace: string
  /** 归属维度(如 `user:42`)。必须来自已鉴权身份,不得取客户端可控值。 */
  ownerKey: string
  /**
   * G-734① **父作用域**(如 `session:<id>` / `conversation:<id>`),编进全局主键的独立一段。
   * 缺省 = 不写父段(与改动前逐字同形)。上游那张 `v4_command_fact` 的主键正是
   * `child:<parentSessionId>:<sourceCommandId>` —— 少了这一段,两个会话复用同一个客户端命令 id
   * 就会互相覆盖事实,而那在响应上完全同形(都"成功"了)。
   */
  parentKey?: string
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
   * G-734③ 引用局部性断言。缺省 = 不跑(与改动前逐字同形);要跑就在**提交前**与**重放前**各跑一次,
   * 越界即抛 `IdempotencyLocalityViolationError`,事实不予提交。
   */
  locality?: SlotLocalitySpec<T>
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
  /**
   * G-734②:那张槽里躺着一条**已完成却读不出载荷**的事实。刻意不与 `not-ours` 并桶 ——
   * 两者处置动作不同(`not-ours` 是"别人的成功记录",这一格是"谁也读不懂的记录"),
   * 而且它同样不许删:删掉等于把这张槽重新开放给同 key 再建一份,那正是 ② 禁止的重建。
   */
  | 'fact-corrupt'

export interface ReleaseSlotOptions {
  /**
   * 只在"这张槽仍属于本次请求"时释放:传本次的指纹。判据刻意只跳 **他人的 `completed`**
   * 与 **损坏的 `completed`**(前者删了会造成双跑,后者删了会造成重建);自己的 `processing`、
   * 认不出形状的脏数据、他人的 processing 一律照删 —— 业务已经失败,锁留着只会把重试堵死。
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
 * 3. 它**永不因传输或数据问题抛错**。终态收尾动作把自己抛出去,就会顶掉原始业务错误(调用方随后
 *    按错的原因处置),那是本仓记过多次的"错误被清理代码吃掉"同型。传输不可用只以返回值表达。
 *    唯一的例外是**坐标本身不合法**(`slotKeyOf` 的 `SlotScopeError`):那是编程错误,必须炸,
 *    不能以"永不抛错"为名把它咽成一个看起来可信的 `released`。
 */
export async function releaseIdempotencySlot(
  kv: IdempotencyKv,
  slot: IdempotencySlotRef,
  options?: ReleaseSlotOptions,
): Promise<SlotReleaseOutcome> {
  const key = slotKeyOf(slot)
  const guard = options?.onlyIfOwnedByFingerprint
  if (guard !== undefined) {
    const read = await callKvWithinDeadline(() => kv.get(key), KV_DEADLINE_MS)
    // 读不动 / 认不出的脏槽 ⇒ 不据此下"不是我的"结论,照旧往下删(宁可多解一次锁)。
    if (read.ok && typeof read.value === 'string') {
      const current = parseSlot(read.value)
      if (current !== null && current.status === 'corrupt') {
        // G-734② 的另一半:损坏的已完成事实**不是**"我的一次锁"可以打发的东西 —— 删它就是把
        // 这张槽交还给"同 key 再建一份",而重建正是本条禁止的动作。留着它喊人,不代裁。
        return 'fact-corrupt'
      }
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
 *
 * G-734② 的写侧对偶:`undefined` 一律**不落**。`JSON.stringify` 会把 `value: undefined` 整键抹掉,
 * 于是写下去的那条"已完成"事实将永远读不出载荷 —— 与其留一张以后要靠硬错拦下来的损坏事实,
 * 不如在这儿就不声称保护(同一个 `null` 出口,调用方已经按 `slotProtected:false` 打点)。
 * 读侧(`parseSlot`)据此可以把"键缺席"唯一地判成损坏:两侧各写一半才叫这条判据成立。
 */
function completedSlotPayload(
  fingerprint: string,
  value: unknown,
  now: () => number,
): string | null {
  if (value === undefined) return null
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
 *
 * G-734 在本函数加了两条**抛错**出路,它们都不落在 `IdempotencyResult` 的联合类型里:
 * `IdempotencyFactCorruptError`(②,已完成事实读不出载荷)与
 * `IdempotencyLocalityViolationError`(③,事实的交叉引用越出 child 集合)。
 * 之所以必须是异常而不是 `ok:false`:`ok:false` 在调用方那里等价"这次没成,可以重试",
 * 而重试就是重建 —— 把禁止重建的动作做成联合类型的一个合法档位,等于自己拆自己的判据。
 */
export async function runIdempotently<T>(
  input: IdempotencyRequest<T>,
): Promise<IdempotencyResult<T>> {
  const key = slotKeyOf(input)
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
    // G-734③:提交**之前**跑引用局部性断言。越界即抛,且不提交也不释放 ——
    // 不提交是因为这条事实本身不可信(把它写下去,下一个同 key 请求就会把一个越权资源当"你自己的"
    // 回放走);不释放是判据 5(资源已存在,DEL 就是把这张槽交还给再建一份)。
    if (input.locality !== undefined) {
      assertFactLocality(value, input.locality, input, key, 'commit')
    }
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
  if (slot.status === 'corrupt') {
    // G-734②:一张**已完成**的事实却没有可回放的载荷。三条出路里只有硬错是对的 ——
    //   原样回放 ⇒ 把损坏洗成"看起来正常"(客户端以为自己拿到了资源);
    //   回 409/可重试 ⇒ 下一次请求重跑 create(),那正是本条禁止的"重建";
    //   DEL ⇒ 同上,还把这张槽交还给再建一份。
    // 抛错不落 `ok:false` 联合档的理由见本函数头注;刻意排在指纹判据**之后**,这样越界复用
    // 同一个客户端 key 打不同请求体仍然先如实报 `key-reused`,不由损坏档替它洗责。
    throw new IdempotencyFactCorruptError(key, 'completed 事实没有可回放的载荷(value 键缺席)')
  }
  // G-734③:重放路径上的值是**从 KV 读回来的**,不是本次 create() 的产物 —— 局部性断言在
  // 这一侧比提交侧更有意义:键一旦折槽(或该键被人写过),越权事实就会被本层签成"你自己的资源"。
  const replayed = slot.value as T
  if (input.locality !== undefined) {
    assertFactLocality(replayed, input.locality, input, key, 'replay')
  }
  return { ok: true, value: replayed, replayed: true, slotProtected: true }
}
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
