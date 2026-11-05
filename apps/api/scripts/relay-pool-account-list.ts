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
  /** 注入写出出口(测试) */
  write?: (chunk: string) => void
  writeErr?: (chunk: string) => void
}

function fmt(d: Date | null | undefined): string {
  return d ? new Date(d).toISOString() : '-'
}

/** 行格式与 Trae 那条 --list 逐字同形(同一张脸,不按平台各写一套展示) */
export function rowLine(r: PoolRow): string {
  return (
    `  uid=${r.uid} 名称=${r.name} 健康=${r.healthStatus} 启用=${r.isEnabled ? '是' : '否'}` +
    ` 摘除=${r.tempUnschedulable ? '是' : '否'} token到期=${fmt(r.tokenExpiresAt)}` +
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
  return { providerCode, total: rows.length, accounts: sortByExpiry(rows) }
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
      '用法: relay-pool-account-list.ts --provider <平台> [--json] | --counts [--json]\n' +
        '  只读列号池名单/逐平台枚数(零凭据输出;密文列不入选投影)。日常入口 = switch-client-account.mjs --list\n',
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
    if (json) {
      out(`${JSON.stringify({ counts: counted })}\n`)
      return 0
    }
    if (counted.length === 0) {
      out('号池 0 行 —— 先用 relay-account-pool 导入\n')
      return 0
    }
    const sum = counted.reduce((s, r) => s + r.total, 0)
    out(`号池共 ${sum} 行,按平台:\n`)
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
  if (json) {
    out(`${JSON.stringify(res)}\n`)
    return 0
  }
  if (res.total === 0) {
    out(`号池 ${provider} 账号(共 0 枚):暂无 —— 先用 relay-account-pool 导入\n`)
    return 0
  }
  out(`号池 ${provider} 账号(共 ${res.total} 枚,按 token 到期新→旧):\n`)
  for (const r of res.accounts) out(`${rowLine(r)}\n`)
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
