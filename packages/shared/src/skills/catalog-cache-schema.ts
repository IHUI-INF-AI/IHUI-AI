// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * 技能/市场列表缓存的**信封契约**(纯判据,零 IO)。
 *
 * 对照取证(2026-11-05,goal-b49/W2):外部程序本机实读 `~/.workbuddy/.skill-list-cache.json`
 * 顶层键 = `version, results, watch, signature, scopeKey, savedAt`,其中 `scopeKey` 是**字符串里
 * 再套一层 JSON 数组的定长位置编码**(11 槽:4 个技能根 + **4 个空串占位** + 1 个布尔 + 2 段内嵌
 * JSON 串)。位置编码的失效方向是"换机静默错位":槽位数一变、或某占位在本机是空串而那机不是,
 * 读出来的 scope 就把 A 的值当 B 用,且不报任何错。
 *
 * 复现(信封五件套 + 四整数廉价签名 + 显式 watch 清单)与本票的超越:
 *   ① scope 改自描述具名字段 ⇒ 比较结论能点名"哪几个字段对不上";
 *   ② 新鲜度只由 `savedAt` 与窗口算,内容是否变只由签名比 ⇒ 判脏不猜 mtime;
 *   ③ **空与未判定分档**(AGENTS §0.3):`results` 为空必须同时带具名件 `catalog-empty-stable`
 *      才算稳定态;取不到 / 对不上 / 缺字段一律 `unjudged` 并点名,不得用空数组冒充"没有技能"。
 *
 * 纯度:不 import `node:` 内建、不读盘、不碰 `process`(shared 非 Node 宿主纯度门);IO 留端内。
 */

export const CATALOG_CACHE_SCHEMA_VERSION = 1

/** 具名件:空清单是**稳定态**而不是错误态。缺了它,"空"就与"没判出来"同形。 */
export const CATALOG_EMPTY_STABLE = 'catalog-empty-stable'

/** `savedAt` 允许超前当前时刻的容忍量(Windows 上刚写完的文件时间戳可比 `Date.now()` 超前若干 ms)。 */
export const FUTURE_SAVED_AT_TOLERANCE_MS = 5_000

/**
 * 自描述 scope:具名字段、零占位,换机时任何一个值变都能被点名。
 * `projectDir` = cwd 解析后的绝对路径;`repoRoot` = 找不到 .git 时同 projectDir(与扫盘侧同一口径);
 * `userHomeDir` **恒有值**(即便 includeUserHome=false —— 空串占位就是本票要治的那一型);
 * `includeUserHome` 决定是否把用户全局目录计入清单。
 */
export interface CatalogCacheScope {
  readonly projectDir: string
  readonly repoRoot: string
  readonly userHomeDir: string
  readonly includeUserHome: boolean
}

/**
 * 廉价签名:四个整数,判脏不猜 mtime、也不做全量 hash。
 * `ok` = 成功探测到的条数;`missing` = 取不到的条数(>0 一律判脏:量不到不是"没变");
 * `sum`/`xor` = 逐条哈希的无进位累加与异或。
 */
export interface CatalogCacheSignature {
  readonly ok: number
  readonly missing: number
  readonly sum: number
  readonly xor: number
}

/** 显式监听清单(与外部程序 `watch{dirs,files}` 同族,但具名且可自证)。 */
export interface CatalogCacheWatchPlan {
  readonly dirs: readonly string[]
  readonly files: readonly string[]
}

/**
 * 信封五件套 + results。`savedAt` = 落盘时刻(epoch ms,新鲜度只由它算);
 * `emptyMarker` 仅当 results 为空时才有意义:带具名件 ⇒ "确实没有"是**稳定态**。
 */
export interface CatalogCacheEnvelope<T> {
  readonly schemaVersion: number
  readonly scope: CatalogCacheScope
  readonly savedAt: number
  readonly signature: CatalogCacheSignature
  readonly watch: CatalogCacheWatchPlan
  readonly results: readonly T[]
  readonly emptyMarker?: typeof CATALOG_EMPTY_STABLE
}

/** 签名的输入(端内由扫盘结果喂;本文件不读盘)。`updatedAt` 取不到 ⇒ 留 undefined,由 missing 计一票。 */
export interface CatalogEntrySeed {
  readonly name: string
  readonly version?: string | undefined
  readonly updatedAt?: string | number | undefined
}

export type CatalogCacheMiss =
  | {
      readonly status: 'hit'
      readonly results: readonly unknown[]
      readonly emptyStable: boolean
      readonly ageMs: number
    }
  | { readonly status: 'stale'; readonly ageMs: number; readonly freshnessMs: number }
  | { readonly status: 'unjudged'; readonly reasons: readonly string[] }

function hash32(text: string): number {
  let h = 0x811c9dc5
  for (let i = 0; i < text.length; i += 1) {
    h ^= text.charCodeAt(i)
    h = Math.imul(h, 0x01000193) >>> 0
  }
  return h >>> 0
}

/** 时间戳取不到 ⇒ 返回 null(= 记进 missing),**不得**折算成 0 冒充"没更新过"。 */
function epochOf(value: string | number | undefined): number | null {
  if (typeof value === 'number') return Number.isFinite(value) ? Math.trunc(value) : null
  const parsed = typeof value === 'string' && value.length > 0 ? Date.parse(value) : Number.NaN
  return Number.isNaN(parsed) ? null : parsed
}

/**
 * 廉价判脏:纯函数。名字为空 ⇒ 进 missing;`updatedAt` 量不到 ⇒ 同样进 missing。
 * 与外部程序那一份四整数同形,但"取不到"单独计票(它那边 missing 只表示"文件不在")。
 */
export function fingerprintCatalogEntries(
  seeds: readonly CatalogEntrySeed[],
): CatalogCacheSignature {
  let ok = 0
  let missing = 0
  let sum = 0
  let xor = 0
  for (const seed of seeds) {
    const name = typeof seed?.name === 'string' ? seed.name.trim() : ''
    const at = epochOf(seed?.updatedAt)
    if (name === '' || at === null) {
      missing += 1
      continue
    }
    const version = typeof seed.version === 'string' ? seed.version : ''
    const token = `${name}\u0000${version}\u0000${at}`
    const h = hash32(token)
    ok += 1
    sum = (sum + h) >>> 0
    xor = (xor ^ h) >>> 0
  }
  return { ok, missing, sum, xor }
}

export function sameCatalogSignature(a: CatalogCacheSignature, b: CatalogCacheSignature): boolean {
  return a.ok === b.ok && a.missing === b.missing && a.sum === b.sum && a.xor === b.xor
}

/** scope 逐字段比较:返回对不上的**字段名**(位置编码给不出这个,具名字段才给得出)。 */
export function differingScopeKeys(a: CatalogCacheScope, b: CatalogCacheScope): string[] {
  const keys: (keyof CatalogCacheScope)[] = [
    'projectDir',
    'repoRoot',
    'userHomeDir',
    'includeUserHome',
  ]
  return keys.filter((key) => a[key] !== b[key])
}

/**
 * 判脏(与新鲜度分开的另一维)。方向恒为"多要一次刷新":
 * 任一侧 `missing>0`、签名不等、条数不符 ⇒ dirty,并给出可执行的原因。
 */
export function isCatalogDirty(
  cached: CatalogCacheSignature,
  live: CatalogCacheSignature,
): { readonly dirty: boolean; readonly reasons: readonly string[] } {
  const reasons: string[] = []
  if (cached.missing > 0) reasons.push(`cached signature has ${cached.missing} unread probe(s)`)
  if (live.missing > 0) reasons.push(`live signature has ${live.missing} unread probe(s)`)
  if (!sameCatalogSignature(cached, live)) {
    reasons.push(
      `signature differs: cached(ok=${cached.ok},missing=${cached.missing},sum=${cached.sum},xor=${cached.xor}) ` +
        `vs live(ok=${live.ok},missing=${live.missing},sum=${live.sum},xor=${live.xor})`,
    )
  }
  return { dirty: reasons.length > 0, reasons }
}

export function encodeCatalogCacheEnvelope<T>(env: CatalogCacheEnvelope<T>): string {
  return JSON.stringify(env)
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

/**
 * 解码 = **结构**判据(能不能认出这五件套),不做语义判定。
 * 认不出就 `ok:false` 并逐条点名缺哪一格;绝不返回一个"看起来能用"的半成品信封。
 */
export function decodeCatalogCacheEnvelope<T>(
  raw: string,
):
  | { readonly ok: true; readonly envelope: CatalogCacheEnvelope<T> }
  | { readonly ok: false; readonly reasons: readonly string[] } {
  const reasons: string[] = []
  let parsed: unknown
  try {
    parsed = JSON.parse(raw)
  } catch (e) {
    return {
      ok: false,
      reasons: [`json unreadable: ${e instanceof Error ? e.message : String(e)}`],
    }
  }
  if (!isRecord(parsed)) return { ok: false, reasons: ['envelope is not an object'] }
  const { schemaVersion, scope, savedAt, signature, watch, results, emptyMarker } = parsed
  if (typeof schemaVersion !== 'number' || !Number.isInteger(schemaVersion))
    reasons.push('schemaVersion missing/not integer')
  if (!isRecord(scope)) reasons.push('scope missing/not an object')
  if (typeof savedAt !== 'number' || !Number.isFinite(savedAt))
    reasons.push('savedAt missing/not a number')
  if (!isRecord(signature)) reasons.push('signature missing/not an object')
  if (!isRecord(watch)) reasons.push('watch missing/not an object')
  if (!Array.isArray(results)) reasons.push('results missing/not an array')
  if (emptyMarker !== undefined && emptyMarker !== CATALOG_EMPTY_STABLE)
    reasons.push('emptyMarker present but not the named artifact')
  if (reasons.length > 0) return { ok: false, reasons }
  return { ok: true, envelope: parsed as unknown as CatalogCacheEnvelope<T> }
}

function scopeOf(value: unknown): CatalogCacheScope | null {
  if (!isRecord(value)) return null
  const { projectDir, repoRoot, userHomeDir, includeUserHome } = value
  if (
    typeof projectDir !== 'string' ||
    typeof repoRoot !== 'string' ||
    typeof userHomeDir !== 'string'
  )
    return null
  if (typeof includeUserHome !== 'boolean') return null
  return { projectDir, repoRoot, userHomeDir, includeUserHome }
}

/**
 * 三态判定的唯一入口。失效方向恒为"多要一次刷新/多要一次说明",绝不冒 hit:
 * 信封缺字段、schema 版本不符、scope 对不上、results 取不到、空而无具名件 ⇒ `unjudged` 并点名。
 */
export function classifyCacheHit<T>(
  env: CatalogCacheEnvelope<T> | null | undefined,
  now: number,
  freshnessMs: number,
  expectedScope?: CatalogCacheScope,
): CatalogCacheMiss {
  if (!env)
    return {
      status: 'unjudged',
      reasons: ['envelope absent (no cache written yet, or the read failed)'],
    }
  const reasons: string[] = []
  if (env.schemaVersion !== CATALOG_CACHE_SCHEMA_VERSION) {
    reasons.push(`schemaVersion ${env.schemaVersion} != current ${CATALOG_CACHE_SCHEMA_VERSION}`)
  }
  const scope = scopeOf(env.scope as unknown)
  if (!scope) reasons.push('scope is not self-describing (missing a named field)')
  if (scope && expectedScope) {
    const diff = differingScopeKeys(scope, expectedScope)
    if (diff.length > 0) reasons.push(`scope mismatch on: ${diff.join(', ')}`)
  }
  if (!isRecord(env.signature as unknown)) reasons.push('signature unreadable')
  if (!isRecord(env.watch as unknown)) reasons.push('watch unreadable')
  if (!Number.isFinite(env.savedAt)) reasons.push('savedAt unreadable')
  if (!Array.isArray(env.results))
    reasons.push('results unreadable (empty array is not the same as "not probed")')
  if (reasons.length > 0) return { status: 'unjudged', reasons }

  const emptyStable = env.results.length === 0 && env.emptyMarker === CATALOG_EMPTY_STABLE
  if (env.results.length === 0 && env.emptyMarker !== CATALOG_EMPTY_STABLE) {
    // 空清单只有配上具名件才是稳定态;否则分不清"真的没有技能"与"扫盘失败被写成空"。
    return {
      status: 'unjudged',
      reasons: [`empty results without the "${CATALOG_EMPTY_STABLE}" named artifact`],
    }
  }

  const ageMs = now - (env.savedAt as number)
  if (ageMs < -FUTURE_SAVED_AT_TOLERANCE_MS) {
    return { status: 'stale', ageMs, freshnessMs }
  }
  if (ageMs > freshnessMs) return { status: 'stale', ageMs, freshnessMs }
  return { status: 'hit', results: env.results, emptyStable, ageMs }
}
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
