// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠


/**
 * O20e 守门:迁移账本带外对象防回潮(check-migration-ledger-drift.mjs)
 *
 * 背景(2026-09-23 立,PROJECT_PLAN O20e):生产迁移账本曾有 **7 个迁移的数据库
 * 对象带外存在** —— 对象已在库里,但 `drizzle.__drizzle_migrations` 无对应行。
 * 当日按 journal 序号人工补齐水位到 285/285,但"带外建对象"这个动作本身没有
 * 防回潮机制。本脚本把它变成机械可证:**部署后比对 journal 序号全集与账本行
 * 全集,缺行即告警**。
 *
 * ⚠️ 判据边界(计划原文明确记过的坑):必须按 **journal 序号(idx)** 界定,
 * **不得按迁移文件 sha256 hash 界定** —— 改历史迁移文件会让按 hash 判定误报。
 * drizzle migrator 按序号顺序执行、每执行一条写一行账本,故可靠可比维度是
 * **行数与水位序**:账本行数 < journal 条目数 = 有迁移从未记账(其对象带外);
 * 账本行数 > journal 条目数 = journal 被裁剪或账本被污染。两者都告警。
 *
 * 降级语义(不假装通过):DSN 未提供 / 驱动不可用 / 连不上库 → 打印 SKIP 与
 * 真实原因后 exit 0(默认,适配本地/CI 无库环境);`--strict` 时上述情况 exit 1
 * (部署后调用建议带 --strict,库连不上本身就是部署异常)。
 *
 * 连库形态(全部参数化,禁止硬编码,§5d 密钥不落仓不回显):
 *   node scripts/check-migration-ledger-drift.mjs \
 *     --dsn "$DATABASE_URL" \
 *     [--journal packages/database/drizzle/meta/_journal.json] \
 *     [--ledger-table "drizzle.__drizzle_migrations"] \
 *     [--strict]
 * DSN 来源优先级:--dsn 参数 > 环境变量 IHUI_LEDGER_DSN > DATABASE_URL。
 * 输出一律脱敏(密码位打 ***),任何情况下不回显完整 DSN。
 *
 * 主用途是**部署后独立调用**(连库门进 pre-commit 会拖慢/断网误红);同时注册
 * guardian-runner id '76' 为 warn 级 + stagedTriggers(packages/database/drizzle/
 * 进暂存区才尝试),本机库可达时顺带对账,不可达时静默 SKIP。
 *
 * 退出码:0 对齐或(默认模式下)降级跳过 / 1 发现缺行/多余行(strict 模式下含
 * 降级情况) / 2 脚本自身异常。
 */

import { existsSync, readFileSync } from 'node:fs'
import { createRequire } from 'node:module'
import { join, resolve } from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'

const ROOT = resolve(fileURLToPath(import.meta.url), '..', '..')
const JOURNAL_REL = 'packages/database/drizzle/meta/_journal.json'
const DEFAULT_LEDGER_TABLE = 'drizzle.__drizzle_migrations'

// ══════════════ 纯函数层(零副作用,经 __test__ 供 §22c 镜像测试直接 import) ══════════════

/**
 * 解析 drizzle journal(_journal.json)。
 * 返回 { version, entries: [{ idx, tag, when }] };结构非法抛 Error(调用方 exit 2)。
 * 只读 idx/tag/when —— 刻意不读任何 hash 字段(见头注释判据边界)。
 */
export function parseJournal(jsonText) {
  const doc = JSON.parse(jsonText)
  if (!doc || !Array.isArray(doc.entries)) {
    throw new Error('journal 结构非法:缺少 entries 数组')
  }
  const entries = doc.entries.map((e) => ({
    idx: Number(e.idx),
    tag: String(e.tag ?? ''),
    when: Number(e.when ?? 0),
  }))
  for (const e of entries) {
    if (!Number.isFinite(e.idx) || !e.tag) {
      throw new Error(`journal 条目非法:idx=${e.idx} tag=${e.tag}`)
    }
  }
  return { version: doc.version ?? null, entries }
}

/**
 * 核心判据:journal 序号全集 vs 账本行全集(行数与水位序)。
 * @param {{idx:number,tag:string,when:number}[]} entries journal 条目(按 idx 升序)
 * @param {{hash:string,createdAt:string|number}[]} ledgerRows 账本行(按执行序)
 * @returns {{expected:number, actual:number, missing:{idx:number,tag:string}[], surplus:number}}
 *   missing = 若账本行为"已执行到第 actual 个序号",其后从未记账的条目(actual < expected 时非空);
 *   surplus = 账本多于 journal 的行数(journal 被裁剪/账本污染)。
 */
export function compareLedger(entries, ledgerRows) {
  const expected = entries.length
  const actual = ledgerRows.length
  const missing = actual < expected ? entries.slice(actual).map((e) => ({ idx: e.idx, tag: e.tag })) : []
  return { expected, actual, missing, surplus: Math.max(0, actual - expected) }
}

/** DSN 脱敏:密码位打 ***,供日志安全输出(任何情况下不回显完整凭据,§5d)。 */
export function maskDsn(dsn) {
  if (!dsn) return '(空)'
  return dsn.replace(/(\/\/[^:/@]+:)[^@]+(@)/, '$1***$2')
}

/** DSN 来源解析:--dsn > IHUI_LEDGER_DSN > DATABASE_URL。都没有返回 null。 */
export function resolveDsn(argv, env) {
  const flagAt = argv.indexOf('--dsn')
  if (flagAt !== -1 && argv[flagAt + 1]) return argv[flagAt + 1]
  return env.IHUI_LEDGER_DSN || env.DATABASE_URL || null
}

/** 解析 --ledger-table("schema.table" 两段,校验标识符防注入)。非法返回 null。 */
export function parseLedgerTable(raw) {
  const m = String(raw ?? '').match(/^([A-Za-z_][A-Za-z0-9_]*)\.([A-Za-z_][A-Za-z0-9_]*)$/)
  if (!m) return null
  return { schema: m[1], table: m[2] }
}

/**
 * 加载 postgres-js 驱动:先从本脚本位置正常 resolve(monorepo 根提升),失败则
 * 回退到 apps/api 的依赖(pnpm workspace 内 postgres 由 apps/api 直接依赖)。
 * 都失败返回 null(调用方按"驱动不可用"降级 SKIP,不假装通过)。
 */
export async function loadPostgresDriver() {
  try {
    return await import('postgres')
  } catch {
    try {
      const req = createRequire(join(ROOT, 'apps/api', 'package.json'))
      const mod = req('postgres')
      return { default: mod.default ?? mod }
    } catch {
      return null
    }
  }
}

// ══════════════ main ══════════════

function printHelp() {
  console.log(`check-migration-ledger-drift.mjs — O20e 迁移账本带外对象防回潮门

用法:
  node scripts/check-migration-ledger-drift.mjs --dsn "$DATABASE_URL" [选项]
  node scripts/check-migration-ledger-drift.mjs --self-test

选项:
  --dsn <url>          Postgres 连接串(优先级 --dsn > IHUI_LEDGER_DSN > DATABASE_URL;输出一律脱敏)
  --journal <path>     drizzle journal 路径(默认 ${JOURNAL_REL},相对仓库根)
  --ledger-table <t>   账本表(默认 ${DEFAULT_LEDGER_TABLE},格式 schema.table)
  --strict             部署后调用建议:DSN 缺失/驱动不可用/连不上库一律 exit 1(默认降级 SKIP exit 0)
  --self-test          内置断言(不连库)
  --help               本帮助

判据:journal 序号全集 vs 账本行全集(行数与水位序),缺行/多余行即红;
按序号界定,不按迁移文件 hash 界定(改历史文件会让按 hash 判定误报)。`)
}

async function main() {
  const args = process.argv.slice(2)
  if (args.includes('--help') || args.includes('-h')) {
    printHelp()
    process.exit(0)
  }
  if (args.includes('--self-test')) {
    process.exit(runSelfTest() ? 0 : 1)
  }

  const strict = args.includes('--strict')
  /** 降级跳过:strict 时按失败,否则如实打印 SKIP 后放行(不假装通过)。 */
  const skip = (reason) => {
    console.warn(`[ledger-drift] ⏭ SKIP:${reason}${strict ? ' —— --strict 模式下按失败处理' : '(默认降级,本次未判定)'}`)
    process.exit(strict ? 1 : 0)
  }

  // 锚点 1:journal(仓库内,无需网络)
  const journalPath = join(ROOT, JOURNAL_REL)
  if (!existsSync(journalPath)) {
    console.error(`[ledger-drift] 找不到 journal ${JOURNAL_REL} —— 判据锚点缺失,按失败处理`)
    process.exit(1)
  }
  /** @type {{version:unknown, entries:{idx:number,tag:string,when:number}[]}} */
  let journal
  try {
    journal = parseJournal(readFileSync(journalPath, 'utf8'))
  } catch (e) {
    console.error(`[ledger-drift] journal 解析失败(${e?.message ?? e}) —— 结构被改坏,按失败处理`)
    process.exit(1)
  }
  journal.entries.sort((a, b) => a.idx - b.idx)

  // 锚点 2:DSN
  const dsn = resolveDsn(args, process.env)
  if (!dsn) skip('未提供 DSN(--dsn / IHUI_LEDGER_DSN / DATABASE_URL 均为空)')

  // 驱动:postgres-js(与 apps/api 同款),两级回退
  const pg = await loadPostgresDriver()
  if (!pg) skip('postgres 驱动不可用(monorepo 内未找到 postgres-js)')

  const ledger = parseLedgerTable(args[args.indexOf('--ledger-table') + 1]) ?? parseLedgerTable(DEFAULT_LEDGER_TABLE)

  const sql = pg.default(dsn, { max: 1, connect_timeout: 10, idle_timeout: 5 })
  let ledgerRows
  try {
    ledgerRows = await sql.unsafe(
      `SELECT hash, created_at FROM "${ledger.schema}"."${ledger.table}" ORDER BY id`,
    )
  } catch (e) {
    skip(`数据库不可达或账本表不存在:${e?.message ?? e} · DSN=${maskDsn(dsn)}`)
  } finally {
    await sql.end({ timeout: 5 }).catch(() => {})
  }

  const cmp = compareLedger(journal.entries, ledgerRows)
  console.log(
    `[ledger-drift] journal=${cmp.expected} 条 · 账本=${cmp.actual} 行 · 表=${ledger.schema}.${ledger.table} · DSN=${maskDsn(dsn)}`,
  )

  if (cmp.missing.length > 0) {
    for (const m of cmp.missing) {
      console.error(`  ✗ 缺行:idx=${m.idx} tag=${m.tag} —— 对象可能带外存在而账本无记账(按序号界定,非 hash)`)
    }
    console.error(
      `[ledger-drift] ❌ 账本 ${cmp.actual} 行 < journal ${cmp.expected} 条,缺 ${cmp.missing.length} 行 —— ` +
        `先核对缺失序号的对象是否带外建表,再按 PROJECT_PLAN O20e 口径补水位`,
    )
    process.exit(1)
  }
  if (cmp.surplus > 0) {
    console.error(
      `[ledger-drift] ❌ 账本 ${cmp.actual} 行 > journal ${cmp.expected} 条(多 ${cmp.surplus} 行)—— ` +
        `journal 被裁剪或账本被污染,须人工核对`,
    )
    process.exit(1)
  }
  console.log(`[ledger-drift] ✅ 账本行全集与 journal 序号全集对齐(${cmp.actual}/${cmp.expected})`)
}

/** §22d 双形态入口守护:测试 import 不触发 CLI 副作用。 */
const isDirectRun = process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href
if (isDirectRun) {
  main().catch((e) => {
    console.error(`❌ ${e?.message ?? e}\n${e?.stack ?? ''}`)
    process.exit(2)
  })
}

// ─── self-test(逻辑自检,不连库,与 scripts/tests 单测互补) ───
function runSelfTest() {
  let ok = true
  const assert = (cond, msg) => {
    if (!cond) {
      ok = false
      console.error(`[self-test] ✗ ${msg}`)
    }
  }

  const sample = JSON.stringify({
    version: '7',
    dialect: 'postgresql',
    entries: [
      { idx: 1, version: '7', when: 1700000000000, tag: '0000_naive_barracuda', breakpoints: true },
      { idx: 2, version: '7', when: 1700086400000, tag: '0001_mature_captain_america', breakpoints: true },
      { idx: 3, version: '7', when: 1700172800000, tag: '0002_lucky_hiroim', breakpoints: true },
    ],
  })
  const parsed = parseJournal(sample)
  assert(parsed.entries.length === 3 && parsed.entries[2].tag === '0002_lucky_hiroim', 'parseJournal: 三条目解析')
  assert(!('hash' in (parsed.entries[0] ?? {})), 'parseJournal: 刻意丢弃 hash 字段(判据边界)')
  let threw = false
  try {
    parseJournal('{"entries":"not-array"}')
  } catch {
    threw = true
  }
  assert(threw, 'parseJournal: entries 非数组抛错')

  // 缺行:账本 1 行 < journal 3 条 → 缺 idx 2/3
  const cmp = compareLedger(parsed.entries, [{ hash: 'x', createdAt: '2026-01-01' }])
  assert(cmp.expected === 3 && cmp.actual === 1, 'compareLedger: 行数对账')
  assert(cmp.missing.length === 2 && cmp.missing[0].idx === 2 && cmp.missing[1].idx === 3, 'compareLedger: 缺行定位到其后序号')
  assert(cmp.surplus === 0, 'compareLedger: 无多余行')

  // 对齐:3 行 = 3 条
  const cmp2 = compareLedger(parsed.entries, [
    { hash: 'a', createdAt: 1 },
    { hash: 'b', createdAt: 2 },
    { hash: 'c', createdAt: 3 },
  ])
  assert(cmp2.missing.length === 0 && cmp2.surplus === 0, 'compareLedger: 全对齐无告警')

  // 多余行:账本 5 行 > journal 3 条
  const cmp3 = compareLedger(parsed.entries, Array.from({ length: 5 }, (_, i) => ({ hash: `h${i}`, createdAt: i })))
  assert(cmp3.surplus === 2 && cmp3.missing.length === 0, 'compareLedger: 多余行计 surplus')

  // 脱敏:密码位打 ***,其他部分保留
  assert(maskDsn('postgres://user:secretpw@db.host:5432/ihui') === 'postgres://user:***@db.host:5432/ihui', 'maskDsn: 密码位脱敏')
  assert(maskDsn('postgres://db.host:5432/ihui') === 'postgres://db.host:5432/ihui', 'maskDsn: 无凭据原样')
  assert(maskDsn('') === '(空)', 'maskDsn: 空值安全输出')

  // DSN 解析优先级
  assert(resolveDsn([], {}) === null, 'resolveDsn: 全空返回 null')
  assert(resolveDsn(['--dsn', 'flag://a'], {}) === 'flag://a', 'resolveDsn: --dsn 优先')
  assert(resolveDsn([], { IHUI_LEDGER_DSN: 'env1://a', DATABASE_URL: 'env2://a' }) === 'env1://a', 'resolveDsn: IHUI_LEDGER_DSN 次之')
  assert(resolveDsn([], { DATABASE_URL: 'env2://a' }) === 'env2://a', 'resolveDsn: DATABASE_URL 兜底')

  // 账本表名解析(防注入)
  assert(parseLedgerTable('drizzle.__drizzle_migrations')?.table === '__drizzle_migrations', 'parseLedgerTable: 默认表名')
  assert(parseLedgerTable('evil; drop') === null, 'parseLedgerTable: 非标识符拒绝')
  assert(parseLedgerTable('nodot') === null, 'parseLedgerTable: 缺 schema 拒绝')

  // 真实 journal 冒烟:仓库内 journal 可解析且条目数与生产水位口径(285)同量级
  try {
    const real = parseJournal(readFileSync(join(ROOT, JOURNAL_REL), 'utf8'))
    assert(real.entries.length >= 200, `真实 journal 可解析(实测 ${real.entries.length} 条,≥200)`)
    assert(!('hash' in (real.entries[0] ?? {})), '真实 journal: 不消费 hash 字段')
  } catch (e) {
    assert(false, `真实 journal 冒烟异常: ${e?.message}`)
  }

  console.log(ok ? '[self-test] ✅ 全部断言通过' : '[self-test] ❌ 有断言失败')
  return ok
}

export const __test__ = {
  parseJournal,
  compareLedger,
  maskDsn,
  resolveDsn,
  parseLedgerTable,
  loadPostgresDriver,
}
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
