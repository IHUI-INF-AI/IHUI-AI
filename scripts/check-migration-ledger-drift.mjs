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
 * ⚠️ 判据边界(G-789 收口:此处原措辞把"迁移记账的任何判定"一律禁于文件 hash,
 * 与同族守门 49 里已有的可核验 hash 判据互相矛盾 —— 后人会据那句把守门 49 的内容对账当误设拆掉。
 * 现改为**分维表述**,两种判据都不删):
 *
 * 【本门只判一个维度 = 应用状态】即"journal 里的每条迁移,账本里有没有对应那一行"。
 * 这个维度按**记录集**判定 —— journal 条目全集 vs 账本行全集的**行数与水位序**。
 * 该维度**不得**按迁移文件内容的 sha256 判定,理由不是"hash 不可用",而是**两个量各自漂移**:
 * 文件字节会因重放、零宽溯源水印注入、格式化而改变(守门 49 头注记过的实测形态 —— 水印注入
 * 后旧 hash 全失效,库内一度出现 153 个重复 hash 与 `NOFILE:`/`manual_` 伪值),而记账的
 * **行集与水位序一个都没变**。拿文件 hash 判"这条迁移应用过没有",会把"已应用但字节变了"
 * 读成"未应用",误报方向恰好相反(漏判带外对象,还反过来把正常记账判成缺失)。
 *
 * 【hash 判的另外两个维度,主都不在本门】
 *   ① 账本行 hash 的**合法性与唯一性** = 守门 49 `scripts/check-migration-bookkeeping.mjs`
 *      的 **B9**(按判据名找,不写行号 —— 行号随任何一次 append 挪位);
 *   ② **已应用迁移的内容是否漂移**(当前 .sql 的 hash ↔ 当初记账的 hash 逐条对账)= 该门的
 *      **B11** 维度(2026-09-27 现读:HEAD 面尚无 B11,它在他人工作树的在飞改动里;
 *      落地之前这一格无人看守)。
 * 所以"改历史迁移文件会让按 hash 判定误报"这句话的准确含义是:**它不是应用状态的判据,
 * 而正是内容漂移对账(B11)要抓的那件事** —— 不得据此把 B11 当误设拆掉,也不得据此声称
 * "本项目没有任何 hash 判据"。
 *
 * drizzle migrator 按序号顺序执行、每执行一条写一行账本,故本门可靠可比的维度是
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
import { requireFlagValue } from './lib/flag-value.mjs'

const ROOT = resolve(fileURLToPath(import.meta.url), '..', '..')
const JOURNAL_REL = 'packages/database/drizzle/meta/_journal.json'
const DEFAULT_LEDGER_TABLE = 'drizzle.__drizzle_migrations'
const DEFAULT_BASELINE_REL = 'scripts/migration-ledger-baseline.json'

// ══════════════ 纯函数层(零副作用,经 __test__ 供 §22c 镜像测试直接 import) ══════════════

/**
 * 解析 drizzle journal(_journal.json)。
 * 返回 { version, entries: [{ idx, tag, when }] };结构非法抛 Error(调用方 exit 2)。
 * 只读 idx/tag/when —— **应用状态**这一维不由 hash 判,故本门不消费 journal 的 hash 字段
 * (hash 的合法性/唯一性 与 内容漂移 两维归守门 49 的 B9/B11,见头注释判据边界)。
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

/**
 * T8 账本自证不变式(只读,不判应用状态 —— 那一维仍归 compareLedger):
 *   ① id 唯一且严格递增(账本主键必须单调,回退/重复说明写入路径被并发或人工插队污染);
 *   ② id 无空洞 —— **基线豁免段之外**的任何缺号都算新增偏差(棘轮:存量不判红,新增必红);
 *   ③ created_at 非递减(同一批迁移的记账时间不得倒流;基线豁免 4 个历史倒挂);
 *   ④ 与 journal 一一对应 = 行数相等(由 compareLedger 判,本函数不重复判)。
 * hash 匹配(第 4 条判据的另一读法)归 check-db-migration-gaps 的 hashDrift 维(T9),本门不抢。
 *
 * @param {{id:number|string,created_at:string|number|null}[]} rows 按 id 升序读出的账本行
 * @param {{missingIdRanges?:number[][],nonMonotonicIds?:number[]}} baseline 存量偏差基线(可缺省)
 * @returns {{
 *   ids: {duplicate:number[], outOfOrder:{id:number,prev:number}[], newHoles:{from:number,to:number,count:number}[],
 *         baselineHoleCount:number, count:number, minId:number|null, maxId:number|null},
 *   createdAt: {newReversals:{id:number,at:number,prev:number}[], baselineReversals:number, missing:number}
 * }}
 */
export function checkLedgerInvariants(rows, baseline = {}) {
  const list = (rows ?? []).map((r) => ({ id: Number(r?.id), at: Number(r?.created_at ?? r?.createdAt) }))
  const ids = list.map((r) => r.id)
  const count = ids.length
  const minId = count ? ids[0] : null
  const maxId = count ? ids[count - 1] : null

  // ① 唯一 + 严格递增(输入已 ORDER BY id,回退只可能来自重复主键或读库排序异常)
  const seen = new Set()
  const duplicate = []
  const outOfOrder = []
  for (let i = 0; i < count; i++) {
    if (seen.has(ids[i])) duplicate.push(ids[i])
    seen.add(ids[i])
    if (i > 0 && ids[i] < ids[i - 1]) outOfOrder.push({ id: ids[i], prev: ids[i - 1] })
  }

  // ② 空洞:把基线允许的闭区间展开成集合,其余缺号按连续区间合并输出(避免 826 行刷屏)
  const allowed = new Set()
  let baselineHoleCount = 0
  for (const r of baseline.missingIdRanges ?? []) {
    const [from, to] = r.map(Number)
    if (!Number.isFinite(from) || !Number.isFinite(to) || to < from) continue
    for (let id = from; id <= to; id++) allowed.add(id)
    baselineHoleCount += to - from + 1
  }
  const newHoles = []
  if (count) {
    let open = null
    for (let id = minId; id <= maxId; id++) {
      if (seen.has(id) || allowed.has(id)) {
        if (open) {
          newHoles.push({ from: open.from, to: open.to, count: open.to - open.from + 1 })
          open = null
        }
      } else {
        if (!open) open = { from: id, to: id }
        else open.to = id
      }
    }
    if (open) newHoles.push({ from: open.from, to: open.to, count: open.to - open.from + 1 })
  }

  // ③ created_at 非递减;基线按"倒挂发生的行 id"豁免(行 id 稳定,时间戳本身会随库状态变)
  const exempt = new Set((baseline.nonMonotonicIds ?? []).map(Number))
  const newReversals = []
  let missing = 0
  let baselineReversals = 0
  for (let i = 0; i < count; i++) {
    if (!Number.isFinite(list[i].at)) missing++
    if (i > 0 && Number.isFinite(list[i].at) && Number.isFinite(list[i - 1].at) && list[i].at < list[i - 1].at) {
      if (exempt.has(ids[i])) baselineReversals++
      else newReversals.push({ id: ids[i], at: list[i].at, prev: list[i - 1].at })
    }
  }

  return {
    ids: { duplicate, outOfOrder, newHoles, baselineHoleCount, count, minId, maxId },
    createdAt: { newReversals, baselineReversals, missing },
  }
}

/** 不变式是否成立:只有**基线之外**的新偏差才判红(棘轮语义)。 */
export function ledgerInvariantsOk(inv) {
  const i = inv?.ids ?? {}
  const c = inv?.createdAt ?? {}
  return (
    (i.duplicate?.length ?? 0) === 0 &&
    (i.outOfOrder?.length ?? 0) === 0 &&
    (i.newHoles?.length ?? 0) === 0 &&
    (c.newReversals?.length ?? 0) === 0 &&
    (c.missing ?? 0) === 0
  )
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
  --no-baseline        关闭 T8 存量偏差基线豁免(对全部缺号/倒挂判红)
  --self-test          内置断言(不连库)
  --help               本帮助

判据:journal 序号全集 vs 账本行全集(行数与水位序),缺行/多余行即红。
另含 T8 只读不变式(id 唯一且严格递增、基线外无新增缺号、created_at 非递减),新增偏差即红;
存量偏差(826 个缺号/4 处倒挂)按 scripts/migration-ledger-baseline.json 豁免,只许收紧不许放宽。
本门只判**应用状态**这一个维度,该维度按记录集判定、不按迁移文件内容 hash 判定(文件字节会因重放/水印注入而变,而记账行集与水位序不变)。hash 判的另外两维另有主:账本行 hash 合法性与唯一性 = 守门 49 的 B9;已应用迁移内容是否漂移 = 守门 49 的 B11(源码头注写明了分维边界与在飞状态)。`)
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

  // G-322(本站):`--ledger-table` 的域名校验由 parseLedgerTable 做(非法返回 null),旧写法写成
  // `parseLedgerTable(args[indexOf+1]) ?? parseLedgerTable(DEFAULT)` ⇒ **给了一个不认识的表名时静默换成默认表**
  // 去比漂移:调用方以为审的是自己点的那张表,实际审的是另一张(两表的 hash 序本就不同);
  // `--ledger-table --dsn …` 这一支连"给了值"都判不出来。
  // 位置必须在锚点 2 之前:skip() 会直接 process.exit(0/1),放在它后面时用法错**永远跑不到**(实测 RC=0),
  // 少打/打错表名的人拿不到任何指向。
  const tableFlag = requireFlagValue(args, '--ledger-table', { noun: 'schema.table' })
  if (tableFlag.error) {
    console.error(`[ledger-drift] ❌ ${tableFlag.error}`)
    process.exit(2)
  }
  const ledger = tableFlag.value ? parseLedgerTable(tableFlag.value) : parseLedgerTable(DEFAULT_LEDGER_TABLE)
  if (tableFlag.value && !ledger) {
    console.error(
      `[ledger-drift] ❌ --ledger-table 实得:${JSON.stringify(tableFlag.value)} 不是合法 "schema.table" —— 不得静默换成默认表 ${DEFAULT_LEDGER_TABLE}`,
    )
    process.exit(2)
  }

  // 锚点 1b:T8 存量偏差基线(棘轮)。基线缺省/损坏时**不豁免任何偏差**(宁可红,不静默放水)。
  let baseline = {}
  let baselineNote = ''
  if (args.includes('--no-baseline')) {
    baselineNote = '基线被 --no-baseline 关闭(本次对全部偏差判红)'
  } else {
    const bp = join(ROOT, DEFAULT_BASELINE_REL)
    if (!existsSync(bp)) {
      baselineNote = `基线文件 ${DEFAULT_BASELINE_REL} 不在位 ⇒ 本次不豁免存量偏差`
    } else {
      try {
        baseline = JSON.parse(readFileSync(bp, 'utf8'))
        baselineNote =
          `基线 ${DEFAULT_BASELINE_REL}(rows=${baseline.rows ?? '?'}, ` +
          `豁免缺号 ${baseline.missingIdRanges?.length ?? 0} 段/${baseline.missingIdCount ?? '?'} 个, ` +
          `豁免倒挂 ${baseline.nonMonotonicIds?.length ?? 0} 个)`
      } catch (e) {
        baselineNote = `基线文件解析失败(${e?.message ?? e}) ⇒ 本次不豁免存量偏差`
      }
    }
  }

  // 锚点 2:DSN
  const dsn = resolveDsn(args, process.env)
  if (!dsn) skip('未提供 DSN(--dsn / IHUI_LEDGER_DSN / DATABASE_URL 均为空)')

  // 驱动:postgres-js(与 apps/api 同款),两级回退
  const pg = await loadPostgresDriver()
  if (!pg) skip('postgres 驱动不可用(monorepo 内未找到 postgres-js)')

  const sql = pg.default(dsn, { max: 1, connect_timeout: 10, idle_timeout: 5 })
  let ledgerRows
  try {
    ledgerRows = await sql.unsafe(
      `SELECT id, hash, created_at FROM "${ledger.schema}"."${ledger.table}" ORDER BY id`,
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
  console.log(`  ${baselineNote}`)

  // ── T8 账本自证不变式(id 单调不空洞 / created_at 单调;行集对齐与 hash 匹配另两维) ──
  const inv = checkLedgerInvariants(ledgerRows, baseline)
  const invOk = ledgerInvariantsOk(inv)
  const holeTxt = inv.ids.newHoles.length
    ? `新增缺号 ${inv.ids.newHoles.reduce((n, h) => n + h.count, 0)} 个(${inv.ids.newHoles
        .slice(0, 5)
        .map((h) => (h.from === h.to ? `${h.from}` : `${h.from}-${h.to}`))
        .join(', ')}${inv.ids.newHoles.length > 5 ? ', …' : ''})`
    : '无新增缺号'
  const revTxt = inv.createdAt.newReversals.length
    ? `新增倒挂 ${inv.createdAt.newReversals.length} 处(首个 id=${inv.createdAt.newReversals[0].id})`
    : '无新增倒挂'
  if (invOk) {
    console.log(
      `[ledger-drift] ✅ 不变式:id 严格递增且${holeTxt} · created_at 非递减且${revTxt} · ` +
        `基线豁免缺号 ${inv.ids.baselineHoleCount} 个/倒挂 ${inv.createdAt.baselineReversals} 个 · id 区间 ${inv.ids.minId}..${inv.ids.maxId}`,
    )
  } else {
    if (inv.ids.duplicate.length)
      console.error(`  ✗ id 重复:${inv.ids.duplicate.slice(0, 5).join(', ')}`)
    if (inv.ids.outOfOrder.length)
      console.error(
        `  ✗ id 回退:${inv.ids.outOfOrder.slice(0, 5).map((o) => `${o.prev}→${o.id}`).join(', ')}`,
      )
    for (const h of inv.ids.newHoles)
      console.error(
        `  ✗ id 空洞(基线外新增):${h.from === h.to ? h.from : `${h.from}-${h.to}`}(${h.count} 个)`,
      )
    for (const r of inv.createdAt.newReversals.slice(0, 10))
      console.error(`  ✗ created_at 倒挂:id=${r.id} ${r.prev} → ${r.at}(基线外新增)`)
    if (inv.createdAt.missing)
      console.error(`  ✗ created_at 为空/非数字:${inv.createdAt.missing} 行`)
    console.error(
      '[ledger-drift] ❌ 账本不变式被破坏(基线外新增偏差)—— 先查写入路径(并发 migrate / 手工补账本 / 时钟跳变),' +
        '再更新 scripts/migration-ledger-baseline.json 前必须逐条给出归因',
    )
    process.exit(1)
  }

  if (cmp.missing.length > 0) {
    for (const m of cmp.missing) {
      console.error(
        `  ✗ 缺行:idx=${m.idx} tag=${m.tag} —— 对象可能带外存在而账本无记账(应用状态这一维按序号判定;内容是否漂移归守门 49 的 B11)`,
      )
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
  assert(!('hash' in (parsed.entries[0] ?? {})), 'parseJournal: 应用状态这一维不消费 hash 字段(hash 的合法性/内容漂移两维归守门 49 的 B9/B11)')
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

  // T8 不变式:构造面正反例(基线内缺号/倒挂不判红,基线外新增必红)
  const invRows = [
    { id: 1, created_at: 100 },
    { id: 2, created_at: 110 },
    { id: 4, created_at: 120 },
    { id: 5, created_at: 130 },
  ]
  const invBase = { missingIdRanges: [[3, 3]], nonMonotonicIds: [] }
  const inv1 = checkLedgerInvariants(invRows, invBase)
  assert(ledgerInvariantsOk(inv1), 'T8-a 基线内缺号3 ⇒ 不变式成立(棘轮不判存量)')
  const inv2 = checkLedgerInvariants(
    [
      { id: 1, created_at: 100 },
      { id: 2, created_at: 110 },
      { id: 5, created_at: 120 },
    ],
    {},
  )
  assert(!ledgerInvariantsOk(inv2) && inv2.ids.newHoles[0]?.from === 3, 'T8-b 基线外缺号3-4 ⇒ 判红')
  const inv3 = checkLedgerInvariants(
    [
      { id: 1, created_at: 100 },
      { id: 2, created_at: 90 },
    ],
    {},
  )
  assert(
    !ledgerInvariantsOk(inv3) && inv3.createdAt.newReversals[0]?.id === 2,
    'T8-c created_at 倒挂 ⇒ 判红',
  )
  const inv4 = checkLedgerInvariants(
    [
      { id: 1, created_at: 100 },
      { id: 2, created_at: 90 },
    ],
    { nonMonotonicIds: [2] },
  )
  assert(ledgerInvariantsOk(inv4), 'T8-d 基线内倒挂 ⇒ 豁免')
  const inv5 = checkLedgerInvariants(
    [
      { id: 1, created_at: 100 },
      { id: 1, created_at: 100 },
    ],
    {},
  )
  assert(!ledgerInvariantsOk(inv5) && inv5.ids.duplicate.length === 1, 'T8-e id 重复 ⇒ 判红')

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
  checkLedgerInvariants,
  ledgerInvariantsOk,
  maskDsn,
  resolveDsn,
  parseLedgerTable,
  loadPostgresDriver,
}
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
