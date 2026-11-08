// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * 连接池护栏（DB-29 / DB-31）。
 *
 * 全仓四条池（主池 createDb、读写分离 writer/replica、受控出口 scoped 池、
 * 租户池）统一从这一个纯函数取选项，避免"某条池忘了带超时"再次漂移。
 *
 * postgres-js 的单位口径（勿改）：
 * - `connect_timeout` / `idle_timeout` / `max_lifetime` 单位是**秒**；
 * - `statement_timeout` 单位是**毫秒**。
 * 历史代码把 `idle_timeout` 写成 30_000（按秒解释≈8.3 小时，等于没开），本函数统一为 30 秒。
 */
const DEFAULT_POOL_MAX = 40
const DEFAULT_IDLE_TIMEOUT_SEC = 30
const DEFAULT_CONNECT_TIMEOUT_SEC = 5
const DEFAULT_MAX_LIFETIME_SEC = 30 * 60
const DEFAULT_STATEMENT_TIMEOUT_MS = 30_000

/** 建池选项的可覆盖项；未给则取默认值（max 可由 DB_POOL_MAX 覆盖）。 */
export interface PoolLimitConfig {
  max?: number
  /** 空闲回收（毫秒，兼容既有 DatabaseConfig 字段名，内部换算成秒）。 */
  idleTimeoutMillis?: number
  /** 连接排队等待上限（秒）。 */
  connectTimeoutSec?: number
  /** 连接最大存活时长（秒）。 */
  maxLifetimeSec?: number
  /** 单条语句超时（毫秒）。 */
  statementTimeoutMs?: number
}

/** 交给 postgres() 的池选项。 */
export interface PoolOptions {
  max: number
  idle_timeout: number
  connect_timeout: number
  max_lifetime: number
  statement_timeout: number
  prepare: false
}

function pickPositiveInt(value: number | undefined, fallback: number): number {
  return typeof value === 'number' && Number.isFinite(value) && value > 0
    ? Math.floor(value)
    : fallback
}

function resolveEnvInt(name: string, fallback: number): number {
  const raw = process.env[name]
  if (raw === undefined || raw === '') return fallback
  const parsed = Number(raw)
  return Number.isFinite(parsed) && parsed > 0 ? Math.floor(parsed) : fallback
}

/**
 * 单池连接上限：显式参数 > DB_POOL_MAX > 默认 40。
 * 多实例部署时 `max × 实例数` 必须 ≤ DB max_connections 的可用额度（见 docs/PERFORMANCE.md §4.3）。
 */
export function resolvePoolMax(override?: number): number {
  return pickPositiveInt(override, resolveEnvInt('DB_POOL_MAX', DEFAULT_POOL_MAX))
}

/** 构造统一的池选项（含四道超时护栏）。 */
export function buildPoolOptions(config: PoolLimitConfig = {}): PoolOptions {
  const idleTimeoutSec =
    config.idleTimeoutMillis !== undefined && config.idleTimeoutMillis > 0
      ? Math.max(1, Math.round(config.idleTimeoutMillis / 1000))
      : DEFAULT_IDLE_TIMEOUT_SEC
  return {
    max: resolvePoolMax(config.max),
    idle_timeout: idleTimeoutSec,
    connect_timeout: pickPositiveInt(config.connectTimeoutSec, DEFAULT_CONNECT_TIMEOUT_SEC),
    max_lifetime: pickPositiveInt(config.maxLifetimeSec, DEFAULT_MAX_LIFETIME_SEC),
    statement_timeout: pickPositiveInt(
      config.statementTimeoutMs,
      resolveEnvInt('DB_STATEMENT_TIMEOUT_MS', DEFAULT_STATEMENT_TIMEOUT_MS),
    ),
    prepare: false,
  }
}
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
