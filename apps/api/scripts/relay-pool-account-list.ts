// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * relay-pool-account-list —— 号池名单只读出口(2026-11-05 立)。
 *
 * 补的是统一入口自己承认的那格缺口:`switch-client-account.mjs --list --provider <非 Trae>`
 * 此前只会拒绝并说"relay-login-local-verified.ts 只做写回,不支持 --list"。写回腿一直是通的
 * (现读:doubao 12 / qoder 11 / trae 5 / workbuddy 2 枚在池),缺的只是"有哪些号可切"的名单面,
 * 于是桌面双击入口造不出来 —— 机主 2026-11-05 的诉求正是"号池里的号要能一键切"。
 *
 * 纪律:
 *  - 只读。不写库、不写盘。密文列(token_enc/refresh_token_enc/cookies_enc/secrets_enc)
 *    一概不入选投影(SAFE_COLUMN_KEYS 形状锁钉住),输出只有 uid/名称/健康态/到期。
 *  - 不发明可用性判据(§0.6):"启用/摘除/健康/到期"是库内现值的如实投影;能不能真切由写回腿
 *    自己裁决。本文件只按 token 到期排序,排序≠裁决,且排序不隐藏任何一行。
 *  - 归属两桶都列(运营池 owner=NULL 与个人池同屏)并如实显示归属 —— 可见性射程由转发选号侧判,
 *    这里不二次裁剪(裁了反而看不出号挂在哪格)。
 *  - 库连接依赖全部延迟到 listPoolAccounts 内:测试 import 本文件不建连(测试隔离铁律)。
 *  - 库不可达 ⇒ exit 2 未判定,不冒绿(§0.3);枚举到 0 枚如实说"没号",不冒充门坏了。
 *
 * 用法: node apps/api/scripts/relay-pool-account-list.ts --provider <code> [--json]
 *       (日常入口走 scripts/switch-client-account.mjs --list --provider <code>)
 */
import { existsSync } from 'node:fs'
import { dirname, join, resolve as resolvePath } from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'
// 掩码判据走现成单源(与号池快照同步同一个出口),本文件不写第二份手机号掩码式
import { maskPhone } from './relay-account-switch.js'
// 余额查询类型(只读视图,适配器层已实装各平台 getQuota;本文件只是把它接回切号列表)
import type { AiRelayAccountPool } from '@ihui/database'

const SCRIPT_DIR = dirname(fileURLToPath(import.meta.url))
const API_DIR = resolvePath(SCRIPT_DIR, '..')
const ROOT = resolvePath(API_DIR, '..', '..')

/**
 * 安全投影列名(纯数据,顶层可 import)。字段集与 relay-trae-client-switch.ts 的
 * SAFE_COLUMNS 同形,漂移由 tests/relay-pool-account-list.test.ts 的形状锁判红 ——
 * 两处必须一张脸,否则同一张池子按平台出两种名单。
 */
export const SAFE_COLUMN_KEYS: readonly string[] = Object.freeze([
  'uid',
  'name',
  'healthStatus',
  'isEnabled',
  'tempUnschedulable',
  'tokenExpiresAt',
  'refreshExpiresAt',
  'credVersion',
  'ownerUserId',
  'deviceId',
  'lastRefreshAt',
  'updatedAt',
])

export interface PoolRow {
  uid: string
  name: string
  healthStatus: string
  isEnabled: boolean
  tempUnschedulable: boolean
  tokenExpiresAt: Date | null
  refreshExpiresAt: Date | null
  credVersion: number
  ownerUserId: string | null
  deviceId: string | null
  lastRefreshAt: Date | null
  updatedAt: Date | null
}

export interface ListOutcome {
  providerCode: string
  total: number
  accounts: PoolRow[]
  /** 取数时刻(ISO):两屏之间池可能被别的会话改动,展示侧必须能点出"这数是几点量的" */
  asOf: string
  /**
   * uid→余额视图;仅带 --with-quota 时存在。纯展示、零凭据、零假数:
   * 上游无实证端点的平台键值为 {ok:false, unsupported:true},绝不拿 0 冒充耗尽。
   */
  quota?: Record<string, QuotaView>
}

/** 第一屏计数行 */
export interface PoolCountRow {
  providerCode: string
  total: number
  enabled: number
}

export interface ListDeps {
  /** 注入取行(测试);缺省连库 */
  fetch?: (provider: string) => Promise<ListOutcome>
  /** 注入逐平台计数(测试);缺省连库 */
  counts?: () => Promise<PoolCountRow[]>
  /** 注入平台名校验(测试);缺省用 relay-account-format 的现成判据 */
  isProviderCode?: (raw: string) => boolean
  /** 注入 --with-quota 的全列取行(测试);缺省连库取含凭据全行,仅供本地解密 */
  quotaRows?: (provider: string) => Promise<AiRelayAccountPool[]>
  /** 注入 --with-quota 的逐号余额查询(测试);缺省走适配器 getQuota */
  quotaOf?: (row: AiRelayAccountPool) => Promise<QuotaView>
  /** 注入写出出口(测试) */
  write?: (chunk: string) => void
  writeErr?: (chunk: string) => void
}

function fmt(d: Date | null | undefined): string {
  return d ? new Date(d).toISOString() : '-'
}

/**
 * 行格式与 relay-trae-client-switch.ts 的 --list 同形(同一张脸,不按平台各写一套展示)。
 * 差异一格并如实留着:Trae 那条专属档还没有"已过期"标注 —— 机主双击走的统一名单是本函数,
 * 不在本枚去改那条(它有既有用例与调用方,动它属另一票)。
 */
export function rowLine(r: PoolRow, now: Date = new Date()): string {
  // 只比现值:token_expires_at 早于当下就在人读行标出来。这是如实投影,不是可用性裁决 ——
  // 能不能真切仍由写回腿判(它不校验票效,故名单必须自己把"这票已过期"说到人眼前)。
  const stale = r.tokenExpiresAt ? new Date(r.tokenExpiresAt).getTime() < now.getTime() : false
  return (
    `  uid=${r.uid} 名称=${r.name} 健康=${r.healthStatus} 启用=${r.isEnabled ? '是' : '否'}` +
    ` 摘除=${r.tempUnschedulable ? '是' : '否'} token到期=${fmt(r.tokenExpiresAt)}` +
    // 只陈述"这张票的到期时刻已过"这一现值事实。不写"切过去登不进"那种后果断言 ——
    // 能不能被保活救回取决于刷新材料在不在册(单源 recredentialableCondition),本投影不含那列,
    // 在此推断后果就是超出证据下结论(§0.3)。
    (stale ? '(已过)' : '') +
    ` rt到期=${fmt(r.refreshExpiresAt)} cred=v${r.credVersion}` +
    ` 设备=${r.deviceId ? '有' : '无'} 归属=${r.ownerUserId ?? '运营池'}`
  )
}

/** token 到期最晚的排前面;无到期(恒 '-' )沉底;同值按 uid 稳定。排序不裁行 */
export function sortByExpiry(rows: PoolRow[]): PoolRow[] {
  return [...rows].sort((a, b) => {
    const ta = a.tokenExpiresAt ? new Date(a.tokenExpiresAt).getTime() : -1
    const tb = b.tokenExpiresAt ? new Date(b.tokenExpiresAt).getTime() : -1
    if (ta !== tb) return tb - ta
    return a.uid.localeCompare(b.uid)
  })
}

// =============================================================================
// 余额/配额按需查询(2026-11-10 接回切号列表;复用适配器 getQuota,零新建判据)。
//
// 背景:适配器层(relay-upstream-adapters)早就实装了各平台 getQuota —— workbuddy 走用户中心
// 权益接口、trae 走积分余额、qoder 走 add-on credits、另 minimax/codearts/zcode/grokbot
// 也有真端点;doubao/lingma/loomy/codex/opencode 无公开端点 ⇒ 适配器如实返回未判定。
// admin 路由 POST /admin/relay/accounts/:id/quota 已经在调它,但切号列表(本文件)只读登录态、
// 从没接这一能力,所以一键切号窗口里看不到额度。本段把它接回来:只在对单平台列号时
// 按需实时拉(不做假数;无实证端点的平台如实标"未支持")。
// =============================================================================

/** 余额查询的展示视图(纯数据,不含任何凭据) */
export interface QuotaView {
  /** 是否查到可用余额 */
  ok: boolean
  /**
   * 平台压根无已实证余额端点(如 doubao/lingma)—— 如实标"未支持",绝不用 0 冒充耗尽
   * (0 在面板会被读成积分耗尽,比"看不到"更误导)。
   */
  unsupported?: boolean
  /** 上游当场明确拒收凭据(401/403 等) */
  authFailed?: boolean
  /**
   * 本机量到的 token 到期时刻已早于当下(仅当确凿过期才置位;号池 token_expires_at
   * 可能失准,故只据此说"已过期",绝不据此反向排除过期)。用于把"令牌过期"与
   * "凭据被上游拒收(可能账号已作废)"两态在展示层分开,不对已确认废的号说"需重登"。
   */
  tokenExpired?: boolean
  /** 失败/未判定的人话原因(不回显凭据) */
  error?: string | null
  used?: number
  total?: number
  /** 剩余量(平台直接给剩余时的首选字段) */
  remaining?: number
  /** consumed/total,0..1 */
  ratio?: number
  /** 单位说明(如 trae 积分) */
  unit?: string | null
  resetsAt?: string | null
  /** 订阅档名(workbuddy 实证:SubscriptionPackageName,如"体验版") */
  subscriptionName?: string | null
}

/**
 * 对单枚账号查余额(纯只读:解密本机库内凭据 → 调适配器 getQuota → 归一展示视图)。
 * 失败/未支持/未判定一律归 ok:false,不抛、不冒充(§0.3)。适配器按它自己当场量到的
 * HTTP 状态码判 authFailed,不信库里的 tokenExpiresAt(现读:上游 401 而该列仍记着未来到期时刻)。
 *
 * 依赖全部动态 import:测试 import 本文件、且调用方不带 --with-quota 时本函数根本不会被加载,
 * 与 listPoolAccounts 的"建连延迟"纪律同形。
 */
export async function fetchAccountQuota(row: AiRelayAccountPool): Promise<QuotaView> {
  const { getRelayAdapter, hasVerifiedQuotaEndpoint } = await import(
    pathToFileURL(join(API_DIR, 'src', 'services', 'relay-upstream-adapters.js')).href
  )
  const { registerAllRelayAdapters } = await import(
    pathToFileURL(join(API_DIR, 'src', 'services', 'upstream-adapters', 'index.js')).href
  )
  const { decryptAccountCredentials } = await import(
    pathToFileURL(join(API_DIR, 'src', 'services', 'relay-account-pool-service.js')).href
  )
  const { resolveAccountProxyUrl } = await import(
    pathToFileURL(join(API_DIR, 'src', 'services', 'relay-proxy-pool.js')).href
  )
  // 独立进程必须自己注册适配器(与 keepalive 腿同款口径):不注册 ⇒ getRelayAdapter 恒 undefined
  registerAllRelayAdapters()
  const adapter = getRelayAdapter(row.providerCode)
  // 唯一判据(§0.6):方法存在 且 未声明 quotaSupported:false。五个无公开端点的平台虽实装了
  // getQuota,但那只是探测空壳;走集中判据才能直接标"未支持",零探测、零误触发 refresh 重试。
  if (!hasVerifiedQuotaEndpoint(adapter)) {
    return { ok: false, unsupported: true }
  }
  let credentials: ReturnType<typeof decryptAccountCredentials>
  try {
    credentials = decryptAccountCredentials(row)
  } catch (e) {
    // 解密炸 ⇒ 未判定,不冒充、不静默
    return { ok: false, error: `凭据解密失败(未判定): ${e instanceof Error ? e.message : String(e)}` }
  }
  const proxyUrl = resolveAccountProxyUrl(row.proxyUrl)
  let outcome
  try {
    outcome = await adapter.getQuota({ row, credentials }, { proxyUrl })
  } catch (e) {
    // 查询过程炸(网络/解密/形状)⇒ 未判定,不冒充、不静默
    return { ok: false, error: `查询异常(未判定): ${e instanceof Error ? e.message : String(e)}` }
  }
  // 上游拒收凭据(典型:access token 过期而 keepalive 尚未续命)⇒ 当场尝试一次 refresh 续命
  // (内存,不写库;持久化续命归 keepalive 调度),拿到新 JWT 后立刻用新凭据重试 getQuota。
  // 这样切号窗口遇到"刚过期、但 refresh token 仍有效"的号也能直接显示额度,不必等下一次巡检。
  if (!outcome.ok && outcome.authFailed && typeof adapter.refreshToken === 'function') {
    try {
      const refreshed = await adapter.refreshToken({ row, credentials }, { proxyUrl })
      if (refreshed?.token) {
        const retried = await adapter.getQuota(
          { row, credentials: { ...credentials, token: refreshed.token } as typeof credentials },
          { proxyUrl },
        )
        if (retried.ok) outcome = retried
      }
    } catch {
      // refresh 或重试失败 ⇒ 回退到原始 authFailed 视图,不冒充
    }
  }
  if (!outcome.ok) {
    // token_expires_at 可能失准(上游 401 而该列仍记未来时刻的情况已被 admin 路由点名),
    // 故只在该列确凿早于当下时才置 tokenExpired,绝不据此反向判定"未过期可救"。
    const expired =
      row.tokenExpiresAt != null && new Date(row.tokenExpiresAt).getTime() < Date.now()
    return {
      ok: false,
      authFailed: outcome.authFailed ?? false,
      tokenExpired: expired,
      error: outcome.error ?? null,
    }
  }
  const q = outcome.quota ?? {}
  return {
    ok: true,
    used: q.used,
    total: q.total,
    remaining: q.remaining,
    ratio: q.ratio,
    unit: q.unit ?? null,
    resetsAt: q.resetsAt ?? null,
    subscriptionName: q.subscriptionName ?? null,
  }
}

/** 取某平台全列(含加密凭据列),仅供余额查询解密用;列号池名单仍走 SAFE_COLUMN_KEYS 投影 */
async function listPoolFullRows(providerCode: string): Promise<AiRelayAccountPool[]> {
  const { db } = await import(pathToFileURL(join(API_DIR, 'src', 'db', 'index.js')).href)
  const { aiRelayAccountPool } = await import('@ihui/database')
  const { eq } = await import('drizzle-orm')
  return (await db
    .select()
    .from(aiRelayAccountPool)
    .where(eq(aiRelayAccountPool.providerCode, providerCode))) as AiRelayAccountPool[]
}

/**
 * 余额视图 → 单行人话(零凭据)。未拉取/未支持/未判定/已查到 四态各一句,不给假数。
 */
export function formatQuotaLine(q?: QuotaView): string {
  if (!q) return '  额度=未拉取(未带 --with-quota)'
  if (!q.ok) {
    if (q.unsupported) return '  额度=未支持(该平台无已实证余额端点)'
    if (q.authFailed) {
      // 确凿过期 ⇒ 说清"令牌过期,需重登";否则只说"被上游拒收,可能已作废"——
      // 不对已确认废(如李总明示没法重登)的号暗示"重登就能救"。
      if (q.tokenExpired) return '  额度=未判定(令牌已过期,需重登/刷新)'
      return '  额度=未判定(凭据被上游拒收,可能已失效)'
    }
    return `  额度=未判定(${(q.error ?? '上游未给判定依据').slice(0, 60)})`
  }
  const parts: string[] = []
  if (q.remaining !== undefined) parts.push(`剩余=${q.remaining}`)
  if (q.used !== undefined) parts.push(`已用=${q.used}`)
  if (q.total !== undefined) parts.push(`总量=${q.total}`)
  if (q.ratio !== undefined) parts.push(`比例=${(q.ratio * 100).toFixed(1)}%`)
  if (q.subscriptionName) parts.push(`档=${q.subscriptionName}`)
  if (q.unit) parts.push(`单位=${q.unit}`)
  if (q.resetsAt) parts.push(`重置=${String(q.resetsAt).slice(0, 10)}`)
  return `  额度✓ ${parts.join(' ')}`
}

/** 连库取某平台池行 —— 建连依赖全部延迟到这里,测试 import 本文件不触发 */
export async function listPoolAccounts(providerCode: string): Promise<ListOutcome> {
  const { config: dotenvConfig } = await import('dotenv')
  dotenvConfig({ path: join(API_DIR, '.env') })
  const { eq } = await import('drizzle-orm')
  const { aiRelayAccountPool } = await import('@ihui/database')
  const { db } = await import(pathToFileURL(join(API_DIR, 'src', 'db', 'index.js')).href)
  // 投影按 SAFE_COLUMN_KEYS 动态取列;列名漂了必须当场炸(fail loud,不静默交 undefined 列)
  const cols = aiRelayAccountPool as unknown as Record<string, { name?: string } | undefined>
  const projection: Record<string, unknown> = {}
  for (const k of SAFE_COLUMN_KEYS) {
    const c = cols[k]
    if (!c || typeof c.name !== 'string') {
      throw new Error(`投影列 ${k} 在 ai_relay_account_pool 上不存在(判据已漂移)`)
    }
    projection[k] = c
  }
  const rows = (await db
    .select(projection as never)
    .from(aiRelayAccountPool)
    .where(eq(aiRelayAccountPool.providerCode, providerCode))
    .orderBy(aiRelayAccountPool.uid)) as PoolRow[]
  return {
    providerCode,
    total: rows.length,
    accounts: sortByExpiry(rows),
    asOf: new Date().toISOString(),
  }
}

/**
 * 逐平台枚数(第一屏用):纯 count 投影,不含任何可用性裁决 ——
 * 哪个号"能切"由各平台写回腿自己判,这里只回答"池里每个平台挂了几行"。
 */
export async function listPoolCounts(): Promise<PoolCountRow[]> {
  const { config: dotenvConfig } = await import('dotenv')
  dotenvConfig({ path: join(API_DIR, '.env') })
  const { sql } = await import('drizzle-orm')
  const { aiRelayAccountPool } = await import('@ihui/database')
  const { db } = await import(pathToFileURL(join(API_DIR, 'src', 'db', 'index.js')).href)
  const rows = await db
    .select({
      providerCode: aiRelayAccountPool.providerCode,
      total: sql<number>`count(*)::int`,
      enabled: sql<number>`count(*) filter (where ${aiRelayAccountPool.isEnabled})::int`,
    })
    .from(aiRelayAccountPool)
    .groupBy(aiRelayAccountPool.providerCode)
    .orderBy(aiRelayAccountPool.providerCode)
  return rows as PoolCountRow[]
}

export async function listMain(argv: string[], deps: ListDeps = {}): Promise<number> {
  const out = deps.write ?? ((c: string) => process.stdout.write(c))
  const err = deps.writeErr ?? ((c: string) => process.stderr.write(c))
  const pIdx = argv.indexOf('--provider')
  const json = argv.includes('--json')
  if (argv.includes('--help') || argv.includes('-h')) {
    out(
      '用法: relay-pool-account-list.ts --provider <平台> [--json] [--mask] [--with-quota] | --counts [--json]\n' +
        '  只读列号池名单/逐平台枚数(零凭据输出;密文列不入选投影)。--mask 把名称按单源掩码,\n' +
        '  供会被截图的人读窗口用(uid 仍留全值作序号映射)。--with-quota 逐号实时查各平台余额\n' +
        '  (复用适配器 getQuota;无实证端点的平台如实标"未支持",不编 0 冒充耗尽)。日常入口 = switch-client-account.mjs --list\n',
    )
    return 0
  }
  if (argv.includes('--counts')) {
    if (pIdx !== -1) {
      err('❌ --counts 与 --provider 互斥(要全池计数还是要单平台名单,不猜)\n')
      return 2
    }
    let counted: PoolCountRow[]
    try {
      counted = await (deps.counts ?? listPoolCounts)()
    } catch (e) {
      err(`❌ 号池不可达/查询失败(未判定): ${e instanceof Error ? e.message : String(e)}\n`)
      return 2
    }
    const asOf = new Date().toISOString()
    if (json) {
      out(`${JSON.stringify({ counts: counted, asOf })}\n`)
      return 0
    }
    if (counted.length === 0) {
      out('号池 0 行 —— 先用 relay-account-pool 导入\n')
      return 0
    }
    const sum = counted.reduce((s, r) => s + r.total, 0)
    out(`号池共 ${sum} 行,按平台(取数时刻=${asOf}):\n`)
    for (const r of counted) out(`  ${r.providerCode} 总=${r.total} 启用=${r.enabled}\n`)
    return 0
  }
  if (pIdx === -1) {
    err('❌ --provider 或 --counts 必填(不猜要列哪个平台)\n')
    return 2
  }
  const provider = argv[pIdx + 1]
  if (!provider || provider.startsWith('--')) {
    err('❌ --provider 需要取值(不猜)\n')
    return 2
  }
  const isProviderCode =
    deps.isProviderCode ??
    (await import(pathToFileURL(join(API_DIR, 'src', 'services', 'relay-account-format.js')).href))
      .isRelayProviderCode
  if (!isProviderCode(provider)) {
    err(`❌ 未知平台: ${provider}(取值集合走 relay-account-format)\n`)
    return 2
  }
  let res: ListOutcome
  try {
    res = await (deps.fetch ?? listPoolAccounts)(provider)
  } catch (e) {
    err(`❌ 号池不可达/查询失败(未判定): ${e instanceof Error ? e.message : String(e)}\n`)
    return 2
  }
  // --mask:展示/机读面的名称一律走单源掩码(双击窗口会被截图,uid 仍留全值作序号映射)
  const mask = argv.includes('--mask')
  const withQuota = argv.includes('--with-quota')
  let shown: ListOutcome = mask
    ? {
        ...res,
        accounts: res.accounts.map((r) => ({ ...r, name: maskPhone(r.name) ?? r.name })),
      }
    : res

  // --with-quota:逐号实时查各平台余额(复用适配器 getQuota;零凭据、零假数)。
  // 任一账号查不动都不致命 —— 名单照常出,只把那枚的状态如实写在额度行。
  if (withQuota) {
    try {
      const fullRows = await (deps.quotaRows ?? listPoolFullRows)(provider)
      const byUid = new Map(fullRows.map((r) => [r.uid, r] as const))
      const qm: Record<string, QuotaView> = {}
      const quotaOf = deps.quotaOf ?? fetchAccountQuota
      await Promise.all(
        [...byUid.entries()].map(async ([uid, fr]) => {
          qm[uid] = await quotaOf(fr)
        }),
      )
      shown = { ...shown, quota: qm }
    } catch (e) {
      err(
        `⚠ --with-quota 拉余额失败(未判定;名单仍照常): ${e instanceof Error ? e.message : String(e)}\n`,
      )
    }
  }

  if (json) {
    out(`${JSON.stringify(shown)}\n`)
    return 0
  }
  if (shown.total === 0) {
    out(`号池 ${provider} 账号(共 0 枚):暂无 —— 先用 relay-account-pool 导入\n`)
    return 0
  }
  out(
    `号池 ${provider} 账号(共 ${shown.total} 枚,按 token 到期新→旧;取数时刻=${shown.asOf})` +
      // 2026-11-06 净检出复量抓的缺口:只有交互腿强制了 --mask,手敲这一条时名称栏是全号裸奔。
      (mask ? '' : ' ⚠ 未带 --mask,名称为号池原值(常被截图的场合请加 --mask)') +
      ':\n',
  )
  for (const r of shown.accounts) {
    out(`${rowLine(r)}\n`)
    if (shown.quota) out(`${formatQuotaLine(shown.quota[r.uid])}\n`)
  }
  return 0
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  if (!existsSync(join(API_DIR, '.env'))) {
    process.stderr.write('⚠ apps/api/.env 不在位,回落进程环境取库连接\n')
  }
  listMain(process.argv.slice(2)).then(
    (rc) => process.exit(rc),
    (e) => {
      process.stderr.write(`❌ ${e instanceof Error ? e.message : String(e)}\n`)
      process.exit(2)
    },
  )
}

export const __test__ = {
  SAFE_COLUMN_KEYS,
  rowLine,
  sortByExpiry,
  listMain,
  ROOT,
  API_DIR,
}
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
