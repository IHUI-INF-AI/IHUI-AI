// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * 永久保活档的登记面与执行面(2026-10-31 立)。
 *
 * 背景:机主的本机 Trae 号已不能靠验证码重登,号池 + 一键切号是唯一出路。调度判据住在
 * `src/services/relay-account-pool-scheduler.ts`(keepAliveForever 一组),本脚本只做两件事:
 *
 *   --status [--json]                     列出登记了永久保活的号(健康/到期/心跳/摘除态,零凭据)
 *   --mark <uid> [--provider trae] [--off] 登记/取消登记(运营池那行)
 *   --once   [--json]                     跑一轮巡检(复用 sweepAccountPool,不写第二份判据)
 *   --client-probe <provider>=<running|stopped|unknown>(C 档 2026-11-10)调用方当场探测的
 *              客户端三态,--once 的接管闸与 --explain 的"为什么没刷"都以它为第一道判据;
 *              缺省 = 未判定 = 永久保活号让位(绝不因为量不到就接管)。
 *
 * 为什么 `--once` 直接调 sweepAccountPool:四档候选/刷新/解摘/退避的口径全在调度层,
 * 这里另写一遍就是 §0.6 禁止的第二份真相源;而这条腿的**存在理由**恰恰是「巡检不能只活在
 * api 常驻进程里」—— api 是本机 tsx dev 进程,重启/崩溃即停摆,由 scripts/relay-account-keepalive.mjs
 * 经 git-guardian 每日派发,拿同一把 sweep 出口把保活推过去。
 *
 * 退出码:0 成功(含无事发生)/ 1 业务失败(标记落空、行不存在)/ 2 未判定(参数·环境·库不可用)。
 * 任何输出面不得含凭据明文(连密文列名都不回显)。
 */
import { dirname, resolve as resolvePath } from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'

const SCRIPT_DIR = dirname(fileURLToPath(import.meta.url))
const API_DIR = resolvePath(SCRIPT_DIR, '..')

// .env 必须早于服务模块导入(它们在建连/加密时读环境)
import { config } from 'dotenv'
config({ path: resolvePath(API_DIR, '.env') })

const { and, eq, sql } = await import('drizzle-orm')
const { aiRelayAccountPool } = await import('@ihui/database')
const { db, dbRead } = await import('../src/db/index.js')
const scheduler = await import('../src/services/relay-account-pool-scheduler.js')
const { KEEPALIVE_FOREVER_KEY, CLIENT_ACTIVE_AT_KEY } = scheduler
// 与调度层同一把适配器出口(§0.6):诊断判「能不能刷」不许另立一份平台清单
const { getRelayAdapter } = await import('../src/services/relay-upstream-adapters.js')
// 注册表住在 upstream-adapters/index(api 常驻时 worker 首行调它);独立进程必须自己注册,
// 否则 getRelayAdapter 恒 undefined ⇒ --once 报 refreshed=0 什么都不刷、--explain 报「未注册」
// 也是假象 —— 诊断出口得先具备被诊断的能力。
const { registerAllRelayAdapters } = await import('../src/services/upstream-adapters/index.js')
const { ACCOUNT_SCHEDULABLE_HEALTH_STATES } =
  await import('../src/services/relay-pool-stats-service.js')
// 心跳落库出口与回灌腿同一把(§0.6):这里只补「独立进程也能刷心跳」这一路,不另写 jsonb 合并
const { touchClientHeartbeat } = await import('./relay-trae-session-sync.js')
// 目标行池序判据单源(§0.6):与三条回灌腿共用同一条「运营池优先 / 个人池唯一行」规则
const { chooseSyncTargetRow } = await import('../src/services/relay-session-sync-target.js')

/** 一枚「某平台客户端此刻在跑」的心跳(薄壳按平台各探各的,2026-11-05) */
export interface ClientActiveEntry {
  provider: string
  at: string
}

/**
 * `--client-active` 取值解析(纯函数,可测):`provider=ISO` ⇒ 条目;
 * 缺等号/缺任一侧 ⇒ null,交调用方报「未判定」—— 绝不默认成某个平台。
 */
export function parseClientActive(raw: string): ClientActiveEntry | null {
  const idx = raw.indexOf('=')
  if (idx <= 0) return null
  const provider = raw.slice(0, idx).trim()
  const at = raw.slice(idx + 1).trim()
  if (!provider || !at) return null
  return { provider, at }
}

/**
 * 一枚「调用方当场探测到的客户端三态」(2026-11-10 C 档):
 * `--client-probe <provider>=<running|stopped|unknown>`。
 * 语义与工具层探测器逐字同型(true=在跑 / false=明确没在跑 / null=未判定)。
 */
export interface ClientProbeEntry {
  provider: string
  running: boolean | null
}

const CLIENT_PROBE_WORDS: Record<string, boolean | null> = {
  running: true,
  stopped: false,
  unknown: null,
}

/**
 * `--client-probe` 取值解析(纯函数,可测):`provider=word` ⇒ 条目;
 * 缺等号/缺任一侧/词不在三态表内 ⇒ null,交调用方报「未判定」。
 * 只认这三个词:把 ISO/布尔杂形态收进来 = 同一含义第二套书写(§0.6)。
 */
export function parseClientProbe(raw: string): ClientProbeEntry | null {
  const idx = raw.indexOf('=')
  if (idx <= 0) return null
  const provider = raw.slice(0, idx).trim()
  const word = raw
    .slice(idx + 1)
    .trim()
    .toLowerCase()
  if (!provider || !(word in CLIENT_PROBE_WORDS)) return null
  return { provider, running: CLIENT_PROBE_WORDS[word] ?? null }
}

/**
 * 这一轮心跳该写在哪几行(纯函数,可测)。
 *
 * **必须取主键 id**:touchClientHeartbeat 按 `eq(aiRelayAccountPool.id, …)` 收窄,它自己的
 * 头注写明「只接受主键 id,按 uid 通配会写穿同 uid 的他人副本」。2026-11-05 实测这一格曾经
 * 传的是 uid ⇒ uuid 列拿数字串比对报类型错,再被函数体内的 `.catch(() => [])` 吞成「0 命中」
 * —— 症状是安静的心跳恒 0。
 *
 * **B 档(2026-11-10):摘掉「已有心跳且距今 ≤ foreverHours」前置**。原前置把补心跳的腿
 * 自己堵死了:断供超过 24h 后行上的心跳既陈旧又不达标 ⇒ --once 永远拨不回去 ⇒ 死锁。
 * 它当年的立因(整族拨心跳 ⇒ 不在本机的号被「客户端在替我续期」饿死)在 C 档改造后不再
 * 成立:接管判据的第一道闸已换成调用方当场探测的三态(keepAliveForeverVerdictOf),心跳只是
 * 第二道缓冲,且探测明确「没在跑」后陈旧心跳不再授权接管 —— 拨错一枚心跳的最坏代价被压到
 * 一个 TTL 的让位延迟,而「补不回心跳」是永久死锁。两害相权取前者。
 * 保留的闸:provider 匹配 ∧ nowIso 解得开(解不开 ⇒ touchClientHeartbeat 那头也不写,
 * 与其「时刻解不开不写」边界同口径)∧ foreverHours>0(强保档整体关掉时无人读心跳,不拨假证据)。
 */
export function heartbeatRowIdsOf(
  rows: KeepAliveRow[],
  provider: string,
  nowIso: string,
  foreverHours: number,
): string[] {
  const nowMs = new Date(nowIso).getTime()
  if (!Number.isFinite(nowMs) || !(foreverHours > 0)) return []
  return rows.filter((r) => r.providerCode === provider).map((r) => r.id)
}

export interface MarkArgs {
  mark?: string
  explain?: string
  /**
   * 调用方探测到的客户端活跃心跳,按平台各一枚(`--client-active <provider>=<ISO>`,可重复)。
   * 缺省 = 本轮不写心跳(探测明确「没在跑」)。
   */
  clientActive?: ClientActiveEntry[]
  /**
   * 调用方探测到的客户端三态(可重复,每平台一枚)。缺省 = scheduler 侧按「未判定=让位」处理。
   */
  clientProbe?: ClientProbeEntry[]
  provider: string
  off: boolean
  status: boolean
  once: boolean
  json: boolean
  help: boolean
  error: null | string
}

/** 参数面(纯函数,可测):未知旗标 ⇒ error(未判定),不静默忽略 */
export function parseArgs(argv: string[]): MarkArgs {
  const out: MarkArgs = {
    provider: 'trae',
    off: false,
    status: false,
    once: false,
    json: false,
    help: false,
    error: null,
  }
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i]
    if (a === '--status') out.status = true
    else if (a === '--once') out.once = true
    else if (a === '--json') out.json = true
    else if (a === '--off') out.off = true
    else if (a === '--help' || a === '-h') out.help = true
    else if (a === '--') continue
    else if (
      a === '--mark' ||
      a === '--provider' ||
      a === '--explain' ||
      a === '--client-active' ||
      a === '--client-probe'
    ) {
      const v = argv[i + 1]
      if (typeof v !== 'string' || v === '' || v.startsWith('--')) {
        out.error = `${a} 需要一个值`
        break
      }
      if (a === '--mark') out.mark = v
      else if (a === '--client-active') {
        const entry = parseClientActive(v)
        if (!entry) {
          out.error = `--client-active 需形如 <provider>=<ISO>,收到「${v}」(未判定)`
          break
        }
        out.clientActive = [...(out.clientActive ?? []), entry]
      } else if (a === '--client-probe') {
        const entry = parseClientProbe(v)
        if (!entry) {
          out.error = `--client-probe 需形如 <provider>=<running|stopped|unknown>,收到「${v}」(未判定)`
          break
        }
        out.clientProbe = [...(out.clientProbe ?? []), entry]
      } else if (a === '--explain') out.explain = v
      else out.provider = v
      i++
    } else {
      out.error = `未知参数: ${a}`
      break
    }
  }
  return out
}

/**
 * 登记/取消永久保活(目标行由池序判据选一枚,按主键写)。
 *
 * 只 merge 这一枚键,绝不整包覆盖 extraMetadata —— 那枚 jsonb 里还住着 checkinSync 同步态、
 * cosy 设备指纹、profile 快照,写回整包会把它们抹掉(与回灌腿的合并语义同口径)。
 *
 * 池序判据 2026-11-05 接上 `chooseSyncTargetRow`(回灌腿 2026-11-01 立的那一条,本层零复算):
 * 原先这里硬写 `isNull(ownerUserId)`,于是**个人池的号结构上开不了永久保活** —— 实测
 * `--mark` 对 admin 个人池的 5 枚 qoder 号逐条落空「运营池无此 uid」,而那 5 枚恰恰是
 * 机主自己账号名下的资产。同一条「运营池优先;运营池无行而个人池唯一 ⇒ 认那行」的规则
 * 在两处各写一份必然漂移,所以复用唯一出口,并按返回的主键写(不按 uid 通配)。
 *
 * 三桶分开返回(§0.3/§0.10):取行失败 ≠ 池里没这行 ≠ 写失败。原形态把 select 的异常
 * 一并 `.catch(() => [])` 吞掉,于是 SQL 报错会被读成「运营池没有这行」—— 2026-10-31
 * 实测就是这么把一次 jsonb 写失败伪装成"号不在池里"的,排查方向整个被带偏。
 */
export async function setKeepAliveForever(
  providerCode: string,
  uid: string,
  forever: boolean,
): Promise<{ hit: boolean; id: string | null; reason: string | null }> {
  let candidates: { id: string; ownerUserId: string | null }[]
  try {
    candidates = await dbRead
      .select({ id: aiRelayAccountPool.id, ownerUserId: aiRelayAccountPool.ownerUserId })
      .from(aiRelayAccountPool)
      .where(
        and(eq(aiRelayAccountPool.providerCode, providerCode), eq(aiRelayAccountPool.uid, uid)),
      )
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e)
    return { hit: false, id: null, reason: `取候选行失败(未判定): ${msg.slice(0, 900)}` }
  }
  const target = chooseSyncTargetRow(candidates)
  if (target.kind === 'none') {
    return { hit: false, id: null, reason: `池内无此 uid(运营池与个人池都无,${providerCode})` }
  }
  if (target.kind === 'ambiguous') {
    return {
      hit: false,
      id: null,
      reason: `同 uid ${target.count} 行且无运营池行 —— 归属未判定,拒写(挑一行写就是写穿他人副本)`,
    }
  }
  const rowId = target.row.id
  try {
    await db
      .update(aiRelayAccountPool)
      .set({
        // 增量整枚以 jsonb 参数传入,而不是 jsonb_build_object($1,$2):
        // 后者会让 PG 在 variadic "any" 位置上报 could not determine data type of parameter
        // (2026-10-31 实测:登记一次即撞,报错文本还被参数尾巴淹掉)。
        // 键名仍取自调度层常量 ⇒ 判据单源没破,值走参数 ⇒ 无拼接注入面。
        extraMetadata: sql`coalesce(${aiRelayAccountPool.extraMetadata}, '{}'::jsonb) || ${JSON.stringify(
          { [KEEPALIVE_FOREVER_KEY]: forever },
        )}::jsonb`,
        updatedAt: new Date(),
      })
      .where(eq(aiRelayAccountPool.id, rowId))
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e)
    // 现场教训:postgres.js 把「原因」行写在 query+params 之后,slice 太短就只剩参数尾巴,
    // 读的人看不到真正错因(900 够把最后一行原因带出来)。
    return { hit: false, id: rowId, reason: `写入失败: ${msg.slice(0, 900)}` }
  }
  return { hit: true, id: rowId, reason: null }
}

/**
 * 永久保活号的健康读数(零凭据:连密文列都不 select)。
 * 具名返回类型而非 Record<string,unknown> —— 消费面要按字段比较,unknown 只能靠 cast,
 * 而 cast 掉的字段一旦在生产端改名,编译器就再也拦不住(mjs 侧读到 undefined 只会静默少报警)。
 */
export interface KeepAliveRow {
  id: string
  providerCode: string
  uid: string
  name: string
  isEnabled: boolean
  tempUnschedulable: boolean
  healthStatus: string
  lastErrorMessage: string | null
  tokenExpiresAt: Date | null
  refreshExpiresAt: Date | null
  lastRefreshAt: Date | null
  refreshFailureCount: number
  credVersion: number
  clientActiveAt: string | null
}

export async function listKeepAliveForever(): Promise<KeepAliveRow[]> {
  const rows = await dbRead
    .select({
      id: aiRelayAccountPool.id,
      providerCode: aiRelayAccountPool.providerCode,
      uid: aiRelayAccountPool.uid,
      name: aiRelayAccountPool.name,
      isEnabled: aiRelayAccountPool.isEnabled,
      tempUnschedulable: aiRelayAccountPool.tempUnschedulable,
      healthStatus: aiRelayAccountPool.healthStatus,
      lastErrorMessage: aiRelayAccountPool.lastErrorMessage,
      tokenExpiresAt: aiRelayAccountPool.tokenExpiresAt,
      refreshExpiresAt: aiRelayAccountPool.refreshExpiresAt,
      lastRefreshAt: aiRelayAccountPool.lastRefreshAt,
      refreshFailureCount: aiRelayAccountPool.refreshFailureCount,
      credVersion: aiRelayAccountPool.credVersion,
      extraMetadata: aiRelayAccountPool.extraMetadata,
    })
    .from(aiRelayAccountPool)
    .where(scheduler.keepAliveForeverCondition())
  return rows.map((r) => {
    const meta = (r.extraMetadata ?? {}) as Record<string, unknown>
    return {
      id: r.id,
      providerCode: r.providerCode,
      uid: r.uid,
      name: r.name,
      isEnabled: r.isEnabled,
      tempUnschedulable: r.tempUnschedulable,
      healthStatus: r.healthStatus,
      lastErrorMessage: r.lastErrorMessage,
      tokenExpiresAt: r.tokenExpiresAt,
      refreshExpiresAt: r.refreshExpiresAt,
      lastRefreshAt: r.lastRefreshAt,
      refreshFailureCount: r.refreshFailureCount,
      credVersion: r.credVersion,
      clientActiveAt:
        typeof meta[CLIENT_ACTIVE_AT_KEY] === 'string' ? meta[CLIENT_ACTIVE_AT_KEY] : null,
    }
  })
}

/**
 * 单号诊断(2026-10-31 立):把这枚号在保活档的每一道闸逐一摊开。
 *
 * 立因:`--once` 的汇总只给 `keepalive=2 refreshSkipped=3` 这种计数,答不出「我登记的那枚
 * 到底卡在哪一闸」——而 skip 有三条不同出口(defer / 无刷新能力 / 档位没命中),各自主体不同、
 * 修法不同。没有这一格,现场只能靠猜(实测就是先猜了一轮 extraMetadata 没读到)。
 * 纯读数,不写库、不打上游。
 */
export async function explainAccount(
  providerCode: string,
  uid: string,
  clientRunning?: boolean | null,
): Promise<Record<string, unknown>> {
  // 同一把池序判据(2026-11-05):诊断面原先也硬锁 isNull(ownerUserId) ⇒ 个人池的号连
  // 闸位读数都取不到,而登记面已放开 —— 两面对同一枚号一个能看一个不能看,正是「两处各写
  // 一份池序规则」必然漂移的现场形态。取全行只在内存里,返回面逐字段挑,脱敏投影不变。
  let candidates: { id: string; ownerUserId: string | null }[]
  try {
    candidates = await dbRead
      .select({ id: aiRelayAccountPool.id, ownerUserId: aiRelayAccountPool.ownerUserId })
      .from(aiRelayAccountPool)
      .where(
        and(eq(aiRelayAccountPool.providerCode, providerCode), eq(aiRelayAccountPool.uid, uid)),
      )
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e)
    return { ok: false, reason: `取候选行失败(未判定): ${msg.slice(0, 900)}`, providerCode, uid }
  }
  const target = chooseSyncTargetRow(candidates)
  if (target.kind === 'none') {
    return {
      ok: false,
      reason: `池内无此 uid(运营池与个人池都无,${providerCode})`,
      providerCode,
      uid,
    }
  }
  if (target.kind === 'ambiguous') {
    return {
      ok: false,
      reason: `同 uid ${target.count} 行且无运营池行 —— 归属未判定`,
      providerCode,
      uid,
    }
  }
  const row = await dbRead
    .select()
    .from(aiRelayAccountPool)
    .where(eq(aiRelayAccountPool.id, target.row.id))
    .limit(1)
    .then((r) => r[0])
  if (!row) {
    return {
      ok: false,
      reason: `主键行取不到(未判定):${target.row.id}`,
      providerCode,
      uid,
    }
  }
  const now = new Date()
  const adapter = getRelayAdapter(providerCode)
  const foreverHours = scheduler.keepaliveForeverIdleHours()
  const forever = scheduler.keepAliveForeverOf(row)
  // C 档(2026-11-10):让位结论必须点名「为什么」。永久保活号走 verdict 单源;
  // 普通号维持 client-first 票面语义。判据不在此复算(§0.6)。
  const verdict = forever
    ? scheduler.keepAliveForeverVerdictOf(row, now, clientRunning)
    : {
        defer: scheduler.shouldDeferRefresh(row, now, process.env),
        reason: 'client-first-token-not-expired',
      }
  return {
    ok: true,
    id: row.id,
    providerCode,
    uid,
    name: row.name,
    healthStatus: row.healthStatus,
    isEnabled: row.isEnabled,
    tempUnschedulable: row.tempUnschedulable,
    refreshFailureCount: row.refreshFailureCount,
    tokenExpiresAt: row.tokenExpiresAt,
    refreshExpiresAt: row.refreshExpiresAt,
    lastUsedAt: row.lastUsedAt,
    lastRefreshAt: row.lastRefreshAt,
    createdAt: row.createdAt,
    extraMetadataKeys: Object.keys((row.extraMetadata ?? {}) as Record<string, unknown>),
    keepAliveForever: forever,
    clientActiveAt: scheduler.clientActiveAtOf(row),
    clientRunning:
      clientRunning === undefined
        ? 'unjudged(absent)'
        : clientRunning === null
          ? 'unknown'
          : clientRunning
            ? 'running'
            : 'stopped',
    deferRefresh: verdict.defer,
    deferReason: verdict.reason,
    adapterRegistered: Boolean(adapter),
    adapterCanRefresh: typeof adapter?.refreshToken === 'function',
    keepaliveIdleDays: scheduler.keepaliveIdleDays(),
    keepaliveForeverHours: foreverHours,
    idleCutoffStd: new Date(now.getTime() - (scheduler.keepaliveIdleDays() ?? 0) * 86400_000),
    idleCutoffForever: new Date(now.getTime() - (foreverHours ?? 0) * 3600_000),
    recredentialable: Boolean(row.refreshTokenEnc) || Boolean(row.cookiesEnc),
    healthIsSchedulable: (ACCOUNT_SCHEDULABLE_HEALTH_STATES as readonly string[]).includes(
      row.healthStatus,
    ),
  }
}

export async function main(argv: string[]): Promise<number> {
  const a = parseArgs(argv)
  if (a.error) {
    process.stderr.write(`❌ ${a.error}(未判定)\n`)
    return 2
  }
  if (a.help || (!a.mark && !a.status && !a.once && !a.explain)) {
    process.stderr.write(
      '用法: npx tsx apps/api/scripts/relay-account-keepalive.ts ' +
        '--status|--mark <uid>|--explain <uid>|--once [--provider trae] [--off] [--json]\n' +
        '  --status   列出永久保活号(零凭据)\n' +
        '  --mark     登记/取消(--off)永久保活(运营池那行)\n' +
        '  --explain  单号诊断:逐闸摊开它为什么没被续期(纯读,不写库不打上游)\n' +
        '  --once     跑一轮号池巡检(复用 sweepAccountPool:临期/空闲保活/定级/恢复/解摘)\n',
    )
    return a.help ? 0 : 2
  }

  // 独立进程必须自己注册适配器(api 常驻时这步由 startRelayAccountPoolWorker 首行完成):
  // 不注册 ⇒ --once 四档全部走「无刷新能力」skip、看着像「号活着」,--explain 的「未注册」
  // 也是假象。2026-10-31 实测靠 --explain 才把这层哑状态量出来。
  registerAllRelayAdapters()

  // 探测三态表(薄壳 --once/--explain 都送):provider ⇒ true(在跑)/false(明确没在跑)/null(未判定)。
  // 表外平台 = 探测没过 = 按 null 处理 = 未判定 ⇒ 永久保活号让位(C 档第一道闸,方向=多让)。
  const probeMap = new Map((a.clientProbe ?? []).map((e) => [e.provider, e.running]))

  if (a.explain) {
    const info = await explainAccount(a.provider, a.explain, probeMap.get(a.provider) ?? null)
    process.stdout.write(`${JSON.stringify(info)}\n`)
    process.stderr.write(
      `诊断 ${a.provider}/${a.explain}: 登记=${info.ok ? (info.keepAliveForever ? '永久保活✓' : '未登记') : '池无此行'} ` +
        `本轮结论=${info.ok ? (info.deferRefresh ? `让位(${info.deferReason})` : `可接管(${info.deferReason})`) : 'n/a'} ` +
        `探测=${String(info.clientRunning ?? 'unjudged(absent)')} ` +
        `适配器可刷=${info.adapterCanRefresh} ` +
        `再凭证=${info.recredentialable} 健康可调度=${info.healthIsSchedulable} 摘除=${info.tempUnschedulable}\n`,
    )
    return info.ok ? 0 : 1
  }

  if (a.mark) {
    const r = await setKeepAliveForever(a.provider, a.mark, !a.off)
    if (!r.hit) {
      // 两桶分开点名:「池里没有这行」与「有行但写不进去」是两件事,
      // 混成一句会让排查从错误的方向开始(2026-10-31 实测踩过)。
      process.stderr.write(
        `❌ 标记落空(未写入):${a.provider}/${a.mark} —— ${r.reason ?? '未知原因'}\n`,
      )
      if (a.json) process.stdout.write(`${JSON.stringify({ ok: false, marked: !a.off, ...r })}\n`)
      return 1
    }
    process.stderr.write(
      `${a.off ? '取消' : '登记'}永久保活:${a.provider}/${a.mark} id=${r.id} ✓已落库\n`,
    )
    if (a.json) process.stdout.write(`${JSON.stringify({ ok: true, marked: !a.off, ...r })}\n`)
    return 0
  }

  if (a.once) {
    // 心跳由调用方探测后送进来(薄壳 scripts/relay-account-keepalive.mjs 的 probeClientActive)。
    // 为什么不复用池里那条旧心跳:这条腿的存在前提是「api 不在也能保活」,而池内心跳只有
    // api 的 worker 每 10 分钟刷一次 —— 只读旧值等于把「客户端在不在跑」绑死在 api 进程上:
    // api 一挂心跳必然陈旧 ⇒ 池判成静默 ⇒ 接管续期 ⇒ 把用户正在用的 Trae 顶下线(登不回来)。
    let heartbeated = 0
    if (a.clientActive && a.clientActive.length > 0) {
      // 按平台各写各的(2026-11-05 扩容:原先只认 trae,api 一挂 qoder 号的心跳必然陈旧
      // ⇒ 池判静默 ⇒ 接管续票 ⇒ 顶掉机主正在用的客户端)。取数键必须是主键 id,见上注。
      const foreverRows = await listKeepAliveForever()
      // 窗口为 null = 强保档被整体关掉(RELAY_ACCOUNT_KEEPALIVE_FOREVER_HOURS=0/off):
      // 传 0 进纯函数 ⇒ 零候选,本轮一条心跳都不拨 —— 没人读这条心跳时拨它 = 留假证据。
      const foreverHours = scheduler.keepaliveForeverIdleHours() ?? 0
      const nowIso = new Date().toISOString()
      for (const entry of a.clientActive) {
        heartbeated += await touchClientHeartbeat(
          heartbeatRowIdsOf(foreverRows, entry.provider, nowIso, foreverHours),
          entry.at,
          false,
        )
      }
    }
    // C 档(2026-11-10):接管前当场再探测一次 —— 三态由薄壳探测后经 --client-probe 传入,
    // 本层只把它转成 scheduler 的 probe 回调;表外平台 ⇒ null(未判定)⇒ 让位,方向恒为「多让」。
    const res = await scheduler.sweepAccountPool(
      (providerCode) => probeMap.get(providerCode) ?? null,
    )
    // 巡检产出面是「全标量 + 两分支同键集」的契约(relay-account-pool-sweep-result.test.ts),
    // 塞不进"哪枚号被解摘/摘除"这种明细。所以读数另取一次:永久保活号的当前状态由数据面
    // 现读(listKeepAliveForever),薄壳据此判是否发信 —— 判据不住第二份实现里。
    const keepAlive = await listKeepAliveForever()
    process.stdout.write(`${JSON.stringify({ ok: true, sweep: res, heartbeated, keepAlive })}\n`)
    process.stderr.write(
      `巡检完成: refreshed=${res.refreshed} failed=${res.refreshFailed} skipped=${res.refreshSkipped} ` +
        `keepalive=${res.keepalive} healthChecked=${res.healthChecked} recovered=${res.healthRecovered} ` +
        `永久保活让位=${res.foreverDeferred} ` +
        `心跳=${heartbeated} 永久保活号=${keepAlive.length}` +
        `${res.skipped ? '(分布式锁被他实例持有,本轮跳过)' : ''}\n`,
    )
    const verdictNow = new Date()
    for (const r of keepAlive) {
      // 让位要有声(§0.10):逐枚答出「这枚为什么这轮没刷」——结论走 verdict 单源,不在此复算
      const v = scheduler.keepAliveForeverVerdictOf(
        { extraMetadata: { [CLIENT_ACTIVE_AT_KEY]: r.clientActiveAt } },
        verdictNow,
        probeMap.get(r.providerCode) ?? null,
      )
      process.stderr.write(
        `  ${r.providerCode}/${r.uid} 健康=${r.healthStatus} 摘除=${r.tempUnschedulable ? '是' : '否'} ` +
          `失败=${r.refreshFailureCount} token到期=${r.tokenExpiresAt ?? '-'} ` +
          `本轮结论=${v.defer ? `让位(${v.reason})` : `可接管(${v.reason})`} ` +
          `探测=${String(probeMap.get(r.providerCode) ?? 'unknown')} 心跳=${r.clientActiveAt ?? '-'}\n`,
      )
    }
    return 0
  }

  const rows = await listKeepAliveForever()
  if (a.json) {
    process.stdout.write(`${JSON.stringify({ ok: true, total: rows.length, rows })}\n`)
  } else {
    process.stderr.write(`永久保活登记数 = ${rows.length}\n`)
    for (const r of rows) {
      process.stderr.write(
        `  ${r.providerCode}/${r.uid} ${r.name} 健康=${r.healthStatus} 启用=${r.isEnabled ? '是' : '否'} ` +
          `摘除=${r.tempUnschedulable ? '是' : '否'} token到期=${r.tokenExpiresAt ?? '-'} ` +
          `rt到期=${r.refreshExpiresAt ?? '-'} 客户端心跳=${r.clientActiveAt ?? '-'} ` +
          `失败=${r.refreshFailureCount}\n`,
      )
    }
  }
  return 0
}

const isDirectRun = process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href
if (isDirectRun) {
  main(process.argv.slice(2))
    .then((code) => process.exit(code))
    .catch((e) => {
      console.error(
        `❌ ${e instanceof Error ? e.message : String(e)}\n${e instanceof Error ? (e.stack ?? '') : ''}`,
      )
      process.exit(2)
    })
}

export const __test__ = {
  parseArgs,
  parseClientActive,
  parseClientProbe,
  heartbeatRowIdsOf,
  setKeepAliveForever,
  listKeepAliveForever,
}
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
