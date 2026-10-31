// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * 号池队列名 × 数据库身份(2026-10-31 立)。
 *
 * 不变量:**队列属于数据库,队列名必须能表达库身份;换库不换队列 = 跨库抢作业。**
 *
 * 立因(2026-10-24 ~ 10-31,实测确认):`.ihui-agent/tmp/perf5` 一次性 e2e 隔离栈把
 * `DATABASE_URL` 换成隔离库 `ihui_e2e`、却继承了同一个 `REDIS_URL`;它起的 API 里带着
 * BullMQ worker,于是从**主库的** `relay-account-pool-queue` 抢走定时作业,并在缺列的
 * 隔离库上执行 —— 每轮 `sweep` 都 `Failed query`,失败队列 500 条打满。主库侧当时没有
 * 任何常驻 worker,故障被完全掩盖:号池保活(临期刷新 / 空闲保活 / 健康定级 / 签到对账)
 * 连续 7 天完全没执行,日志上却"看起来安静"。
 *
 * 判据:队列名 = 基础名 + 库身份后缀。只有「一次性/隔离库」才加后缀,主库保持既有队列名
 * 零扰动(否则滚动发布期新旧实例会互相看不见对方的作业)。三条规则按顺序短路:
 *   1. 显式 `RELAY_QUEUE_SUFFIX`(人工强隔离)> 2. 隔离库名特征 > 3. 原名。
 *
 * 纯函数 + 常量,不 import 任何重型依赖(零副作用、零 IO,测试可直接 import 生产判据)。
 */

/** 主库名(生产/主库同名时不加后缀,保持既有队列名零扰动) */
export const PRIMARY_DB_NAME = (process.env.RELAY_PRIMARY_DB_NAME ?? '').trim() || 'ihui'

/** 一次性/隔离库的命名特征:e2e / test / ci / tmp / perf5 / sandbox 等 */
const ISOLATED_DB_PATTERN =
  /(^|[_-])(e2e|e2e2e|test|testing|ci|tmp|temp|perf\d*|sandbox|scratch)([_-]|$)/i

/** 号池队列的基础名(与 relay-account-pool-worker 的导出常量同值,那边是基础名,这里只做解析) */
const RELAY_ACCOUNT_POOL_QUEUE_BASE = 'relay-account-pool-queue'

/**
 * 后缀分隔符。不用冒号是因为 **BullMQ 结构性不接受**:`QueueBase` 构造时对名字里出现 `:`
 * 直接 `throw new Error('Queue name cannot contain :')`。用冒号会让隔离栈的 API
 * 在 worker 启动那一步整进程崩掉(2026-10-31 实测于 `--stack` 档)。
 */
const QUEUE_SUFFIX_SEPARATOR = '-'

/**
 * 拼接并守住不变量:**队列名里永远不许出现冒号**。
 *
 * 显式后缀是人工输入,`RELAY_QUEUE_SUFFIX=a:b` 这种写法必须能在运行时活下来,不能让一条
 * 手写的后缀把整个服务打死 ⇒ 一律换成连字符(不抛、不猜、不让启动崩在 BullMQ 构造器里)。
 */
function joinQueueName(base: string, suffix: string): string {
  return `${base}${QUEUE_SUFFIX_SEPARATOR}${suffix}`.replace(/:/g, QUEUE_SUFFIX_SEPARATOR)
}

/** 为什么落到这个队列名的三个真实分支(启动日志一眼看清,不猜) */
export type QueueIsolationReason = 'explicit-suffix' | 'isolated-db' | 'primary'

export interface QueueIsolation {
  /** 实际消费的队列名 */
  queue: string
  /** 从 DATABASE_URL 解析出的库名(解析不出 = null,如实不猜) */
  dbName: string | null
  /** 是否已被隔离(≠ 主库队列名) */
  isolated: boolean
  /** 命中的是哪条规则 */
  reason: QueueIsolationReason
}

interface ResolveOpts {
  dbName?: string | null
  explicitSuffix?: string | null
  primaryDbName?: string
}

/**
 * 从 postgres DSN 解析库名。
 *
 * 取 `URL.pathname` 去掉前导 `/`,再按第一段切(库名之后的路径段不属于库名),
 * 最后 `decodeURIComponent`。空值 / 非法 URL / 无库名 ⇒ null(不抛)。
 */
export function dbNameFromUrl(url: string | undefined | null): string | null {
  if (!url) return null
  let pathname: string
  try {
    pathname = new URL(url).pathname
  } catch {
    // 非 URL 形态(手写串/占位符)= 解析不出,不让调用方为此崩启动
    return null
  }
  const raw = pathname.replace(/^\/+/, '')
  if (!raw) return null
  const firstSegment = raw.split('/')[0] ?? ''
  if (!firstSegment) return null
  try {
    return decodeURIComponent(firstSegment)
  } catch {
    // 残缺的 percent-encoding:解不出就不猜
    return null
  }
}

/** 三条规则的单点实现(relayQueueName 与 describeQueueIsolation 都从这里出,不写第二份) */
function resolve(base: string, opts: ResolveOpts = {}): QueueIsolation {
  // 规则 1:显式后缀优先(空串/空白 = 未设置,不产出 `base:` 这种半截名)
  const explicitSuffix = (opts.explicitSuffix ?? process.env.RELAY_QUEUE_SUFFIX ?? '').trim()
  const dbName = opts.dbName === undefined ? dbNameFromUrl(process.env.DATABASE_URL) : opts.dbName
  const primaryDbName = (opts.primaryDbName ?? PRIMARY_DB_NAME).trim() || PRIMARY_DB_NAME

  if (explicitSuffix) {
    return {
      queue: joinQueueName(base, explicitSuffix),
      dbName,
      isolated: true,
      reason: 'explicit-suffix',
    }
  }
  // 规则 2:隔离库名特征 × 非主库名(主库自己就叫 ihui_e2e 时不加后缀)
  if (dbName && dbName !== primaryDbName && ISOLATED_DB_PATTERN.test(dbName)) {
    return { queue: joinQueueName(base, dbName), dbName, isolated: true, reason: 'isolated-db' }
  }
  // 规则 3:主库/远端生产库(如 production、railway)一律原名,零扰动
  return { queue: base, dbName, isolated: false, reason: 'primary' }
}

/**
 * 解析某个队列基础名在**当前进程环境**下应该用的真实队列名。
 *
 * `relayQueueName('relay-account-pool-queue')` 在主库 ⇒ 原名;
 * 在 `ihui_e2e` 隔离库 ⇒ `relay-account-pool-queue-ihui_e2e`。
 */
export function relayQueueName(base: string, opts: ResolveOpts = {}): string {
  return resolve(base, opts).queue
}

/** 号池队列名(worker / 任务中心 / 启动日志三处共用同一判据) */
export function relayAccountPoolQueueName(): string {
  return relayQueueName(RELAY_ACCOUNT_POOL_QUEUE_BASE)
}

/**
 * 启动日志用:这个实例消费的是哪个队列、为什么(三种 reason 之一)。
 * reason 只陈述事实,不评价好坏 —— isolated 也可以是完全正确的隔离栈。
 */
export function describeQueueIsolation(opts: ResolveOpts = {}): QueueIsolation {
  const { queue, dbName, isolated, reason } = resolve(RELAY_ACCOUNT_POOL_QUEUE_BASE, opts)
  return { queue, dbName, isolated, reason }
}
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
