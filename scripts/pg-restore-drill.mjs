#!/usr/bin/env node
// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * PostgreSQL 还原演练器(备份体系的"能不能恢复"空白补票,2026-09-27 立项)。
 *
 * 立项因由:全仓 `pg_restore` 只出现在注释里,没有任何一处真执行 —— 备份文件在、大小对,
 * 但"这份 dump 能恢复出来"这件事从未被证明过。本工具把这个问题拆成两层:
 *   文件层(零风险,任何机器可跑):头部 magic + `pg_restore -l` 全量 TOC 解析 +
 *     `pg_restore --single-transaction -f -`(不连库,把整份归档解压成 SQL 流丢弃)——
 *     能证明"每个压缩块都读得动、TOC 自洽、归档尾完整";
 *   在线层(需要建库权限):建 `ihui_restore_drill_<YYYYMMDD>` 演练库 → 真还原 → 只核对
 *     元数据(表数/逐表行数/库大小)→ DROP 那一个且仅那一个演练库。
 *
 * 三档(互斥;默认 --check):
 *   --check   只回答四个问题(dump 新鲜度与完整性 / 表与行数 / 可连性 / 还缺什么),零写
 *   --dry-run 把 --apply 会执行的每条命令、目标库名、用完删什么逐条打印,零执行
 *   --apply   真做在线演练;**当前凭据(beifen)无 CREATEDB 时明确拒绝并回落到文件层全量证明**
 *   --offline-verify 只做文件层全量证明(供 --apply 阻塞时与人工复查用)
 *   --json    机读输出(单行 JSON)
 *
 * 硬约束(写进判据,不是口号):
 *  - 目标库名形状 = /^ihui_restore_drill_\d{8}$/ ,逐字符校验;不接受任何外部传入的库名
 *    (未知开关一律 exit 2,不给"--target"留口子);已存在同名库则中止而不是复用/删除。
 *  - 绝不对生产库写:所有读查询为 SELECT;写命令只落在演练库(CREATE/DROP/restore into)。
 *  - 演练前后对生产库取同一份只读统计指纹,逐字必须一致,不一致即大声停(保留演练库待查)。
 *  - beifen 无建库权限时**不提权、不改用管理员口令**(那是绕过最小权限),如实报"不足以在线演练"。
 *  - 口令只进子进程 env,永不打印;取径与 deploy/win/ihui-pg-backup.ps1 一致:
 *    env IHUI_DB_BACKUP_USER/PASSWORD → scripts/lib/key-dir.mjs 的 db-backup/ihui-backup.txt。
 *  - 不删除、不移动备份目录任何东西;派生一律绝对路径 + timeout + windowsHide(§5b/§26)。
 *  - 盘符不硬编码:DevEnv 根按脚本自身位置同盘推导(与 scripts/lib/gitdir.mjs gitArchiveDir 同式)。
 *
 * 退出码:0=判定完整;1=判据失败/中止(含统计不一致、restore 失败);
 *        2=无法判定(缺 dump/缺二进制/缺凭据/开关错);3=凭据不足以在线演练(文件层证据已给)。
 */
import { existsSync, readFileSync, readdirSync, openSync, readSync, closeSync, statSync } from 'node:fs'
import { spawnSync } from 'node:child_process'
import { dirname, join, resolve } from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'
import { keyFile } from './lib/key-dir.mjs'

const repoRoot = resolve(dirname(fileURLToPath(import.meta.url)), '..')

// ────────────────────────────── 纯函数层(自检/镜像测试打这里) ──────────────────────────────

export const DRILL_PREFIX = 'ihui_restore_drill_'
export const DRILL_NAME_RE = /^ihui_restore_drill_\d{8}$/
export const DUMP_NAME_RE = /^ihui_dev_(\d{8})_(\d{6})\.dump$/

/** Date → YYYYMMDD(本地时区,与备份文件名同源) */
export function todayYmd(d = new Date()) {
  const p = (n) => String(n).padStart(2, '0')
  return `${d.getFullYear()}${p(d.getMonth() + 1)}${p(d.getDate())}`
}

/** 由日期生成演练库名;日期形状不符即抛(禁止拼接出别的形状) */
export function drillDbName(ymd) {
  if (!/^\d{8}$/.test(String(ymd))) throw new Error(`拒生成:日期须为 8 位数字,实得 ${JSON.stringify(ymd)}`)
  return `${DRILL_PREFIX}${ymd}`
}

export function isDrillDbName(name) {
  return typeof name === 'string' && DRILL_NAME_RE.test(name)
}

/** 一切写命令执行前的最后闸门:名字不符 ⇒ 抛错(调用方立即退出) */
export function assertDrillTarget(name, op) {
  if (!isDrillDbName(name)) {
    throw new Error(`拒执行 [${op}]:目标库名必须逐字符等于 ${DRILL_PREFIX}+8位日期,实得 ${JSON.stringify(name)}`)
  }
  return name
}

/**
 * dump 完整性三态判定。绝不允许"没量到"伪装成"通过"(本仓最高频失效型)。
 * @param {{exists:boolean,size?:number,magicOk?:boolean,toc?:{rc:number,format?:string,tocEntries?:number,tableDataCount?:number}|null}} i
 */
export function classifyDump(i) {
  if (!i || i.exists !== true) return { verdict: 'undetermined', reasons: ['没拿到 dump 文件(备份目录不可读或无匹配文件)'] }
  if (typeof i.size !== 'number') return { verdict: 'undetermined', reasons: ['量不到 dump 大小'] }
  if (i.size === 0) return { verdict: 'truncated', reasons: ['dump 为 0 字节'] }
  if (i.magicOk !== true) return { verdict: 'truncated', reasons: ['头部 magic 不是 PGDMP(非 custom 格式或首部已损坏)'] }
  if (!i.toc) return { verdict: 'undetermined', reasons: ['TOC 解析没跑(缺 pg_restore 或未执行)'] }
  if (i.toc.rc !== 0)
    return { verdict: 'truncated', reasons: [`pg_restore -l 退出码 ${i.toc.rc} —— TOC(在文件尾部)读不到,判定被截断`] }
  return { verdict: 'complete', reasons: [`头部 magic 完好;全量 TOC 解析通过(${i.toc.tocEntries ?? '?'} 条,TABLE DATA ${i.toc.tableDataCount ?? '?'} 条)`] }
}

/** 从目录列表选最新 dump(按名字里的日期+时间,不依赖 mtime —— 复制/同步会翻新 mtime) */
export function resolveLatestDump(names) {
  let best = null
  for (const n of names || []) {
    const m = DUMP_NAME_RE.exec(n)
    if (!m) continue
    const stamp = m[1] + m[2]
    if (!best || stamp > best.stamp) best = { name: n, stampYmd: m[1], stampHms: m[2], stamp }
  }
  return best
}

/** 凭据能力判定:null=没量到(未判定) */
export function decideOnline(role) {
  if (!role) return { state: 'undetermined', text: '未判定:连不上库或取不到角色属性,无从断言能否在线演练' }
  if (role.rolsuper === true || role.rolcreatedb === true)
    return { state: 'possible', text: `角色可建库(rolcreatedb=${role.rolcreatedb}, rolsuper=${role.rolsuper})` }
  return {
    state: 'insufficient',
    text: `当前凭据不足以做在线演练:角色 ${role.rolname} 的 rolcreatedb=${role.rolcreatedb}、rolsuper=${role.rolsuper}`,
  }
}

/** CLI 开关白名单解析:未知开关/多档同给/任何位置参数 = 立即判死,不静默掉进默认分支。
 *  位置参数特别禁止 —— 外部传入的库名(哪怕是"看起来无害的第一个参数")不能进本工具的射程。 */
export function parseCliArgs(argv) {
  const modes = ['--check', '--dry-run', '--apply', '--offline-verify']
  const flags = new Set([...modes, '--json'])
  const positional = (argv || []).filter((a) => !String(a).startsWith('-'))
  if (positional.length > 0) return { error: `不接受位置参数(实得 ${positional.join(' ')});本工具刻意不接受任何外部库名` }
  const seen = (argv || []).filter((a) => String(a).startsWith('-'))
  for (const f of seen) {
    if (!flags.has(f)) return { error: `未知开关:${f}(仅 ${[...flags].join(' / ')};本工具刻意不接受任何外部库名)` }
  }
  const picked = seen.filter((a) => modes.includes(a))
  if (picked.length > 1) return { error: `模式开关互斥,实得 ${picked.join(' ')}` }
  return { mode: picked[0] || '--check', json: seen.includes('--json') }
}

const STATS_SQL =
  "SELECT 'db_size='||pg_database_size(current_database()) UNION ALL " +
  "SELECT 'tables='||count(*) FROM pg_class c JOIN pg_namespace n ON n.oid=c.relnamespace WHERE n.nspname='public' AND c.relkind='r' UNION ALL " +
  "SELECT 'reltuples='||coalesce(sum(greatest(c.reltuples,0))::bigint,0) FROM pg_class c JOIN pg_namespace n ON n.oid=c.relnamespace WHERE n.nspname='public' AND c.relkind='r' ORDER BY 1"

/** 逐表精确行数(单条静态 SQL,服务端 query_to_xml 内联执行各表 count(*)):
 *  刻意不把"生成 SQL 再执行"做成两步 —— 两步会让计划步骤与实际执行内容脱节,判据不可审。 */
export const COUNTS_SQL =
  "SELECT x.tbl, (xpath('/row/n/text()', x.q))[1]::text::bigint FROM (" +
  "SELECT c.relname AS tbl, query_to_xml(format('SELECT count(*) AS n FROM %I.%I', n.nspname, c.relname), true, false, '') AS q " +
  "FROM pg_class c JOIN pg_namespace n ON n.oid=c.relnamespace WHERE n.nspname='public' AND c.relkind='r') x ORDER BY 1"

/** 只读统计指纹:trim + 换行原样;两侧同查询同法 ⇒ 逐字相等才有意义 */
export function fingerprint(rawStdout) {
  if (typeof rawStdout !== 'string') return null
  return rawStdout.replace(/\r/g, '').split('\n').map((l) => l.trim()).filter((l) => l !== '').join('\n')
}
export function fingerprintsEqual(a, b) {
  return a === b
}

/**
 * 构造 --apply 的完整命令计划(也用于 --dry-run 打印)。
 * 每条:{id, kind:'read'|'write'|'local', label, argv(绝对路径), input?}。
 * 写步骤在这里就把目标名焊死并 assert —— 计划若含不符形状的库名,构造即抛。
 * 注:drop 步骤刻意排在最后且由调用方在"全部核对通过"之后单独派发 ——
 * 行数不一致/统计被扰动时必须**保留演练库**给人取证,所以绝不能混在同一趟盲跑里。
 */
export function buildPlan(ctx) {
  const { bins, conn, dumpPath, targetDb } = ctx
  assertDrillTarget(targetDb, 'buildPlan')
  const psqlBase = [bins.psql, '-w', '-h', conn.host, '-p', String(conn.port), '-U', conn.user]
  const countsStep = (id, db, label) => ({ id, kind: 'read', label, argv: [...psqlBase, '-d', db, '-t', '-A', '-v', 'ON_ERROR_STOP=1', '-c', COUNTS_SQL] })
  return [
    { id: 'pre-stats', kind: 'read', label: `生产库只读统计指纹(演练前)`, argv: [...psqlBase, '-d', conn.prodDb, '-t', '-A', '-c', STATS_SQL] },
    { id: 'exists', kind: 'read', label: `确认演练库不存在(存在即中止,绝不复用/删除)`, argv: [...psqlBase, '-d', 'postgres', '-t', '-A', '-c', `SELECT 1 FROM pg_database WHERE datname = '${targetDb}'`] },
    { id: 'create', kind: 'write', label: `CREATE DATABASE(仅演练库)`, argv: [...psqlBase, '-d', 'postgres', '-v', 'ON_ERROR_STOP=1', '-c', `CREATE DATABASE ${quoteIdent(targetDb)}`] },
    { id: 'restore', kind: 'write', label: `pg_restore 到演练库(单事务,原子性=全有或全无)`, argv: [bins.pgRestore, '-w', '-h', conn.host, '-p', String(conn.port), '-U', conn.user, '-d', targetDb, '--no-owner', '--no-privileges', '--single-transaction', dumpPath] },
    countsStep('counts-prod', conn.prodDb, '生产库逐表行数(基准,只 SELECT)'),
    countsStep('counts-drill', targetDb, '演练库逐表行数(还原后)'),
    { id: 'drill-size', kind: 'read', label: '演练库库大小', argv: [...psqlBase, '-d', targetDb, '-t', '-A', '-c', 'SELECT pg_database_size(current_database())'] },
    { id: 'post-stats', kind: 'read', label: `生产库只读统计指纹(演练后,须与演练前逐字一致)`, argv: [...psqlBase, '-d', conn.prodDb, '-t', '-A', '-c', STATS_SQL] },
    { id: 'drop', kind: 'write', label: `DROP DATABASE(仅且只有演练库;只在全部核对通过后单独派发)`, argv: [...psqlBase, '-d', 'postgres', '-v', 'ON_ERROR_STOP=1', '-c', `DROP DATABASE ${quoteIdent(targetDb)}`] },
  ]
}

/** 标识符加引号:演练库名已过 ^[a-z0-9_]+$ 形状校验,加引号只为形态严谨 */
export function quoteIdent(name) {
  return `"${String(name).replace(/"/g, '""')}"`
}

/**
 * 执行计划。**allowWrites=false 时任何写步骤到达执行器前即抛** ——
 * 镜像测试用注入假执行器的方式证明 check/dry-run/offline 一档都没派生写命令。
 * check(step,out) 返回原因字符串 ⇒ 当步之后立即中止(抛带 aborted/results 的错误),
 * 这是"存在性预检通过才允许 CREATE"这类前置条件的落地形态 —— 没有它,计划会盲跑。
 */
export function runPlan(plan, { allowWrites, exec, check }) {
  const results = []
  for (const step of plan) {
    if (step.kind === 'write' && !allowWrites) {
      throw new Error(`runPlan 拒绝执行写步骤(${step.label}):本档 allowWrites=false`)
    }
    const out = exec(step)
    results.push({ step, out })
    const why = check ? check(step, out) : null
    if (why) {
      const e = new Error(why)
      e.aborted = true
      e.results = results
      throw e
    }
  }
  return results
}

// ────────────────────────────── IO 层(默认实现;main 使用) ──────────────────────────────

/** DevEnv 根:按仓库所在盘推导(D:/IHUI-AI ⇒ D:/DevEnv),与 gitdir.mjs gitArchiveDir 同式,不写死盘符 */
function devEnvRoot() {
  return join(resolve(repoRoot, '..', '..'), 'DevEnv')
}
function pgBinDir() {
  return process.env.IHUI_PG_BIN_DIR || join(devEnvRoot(), 'runtimes', 'pgsql', 'bin')
}
function backupPgDir() {
  return process.env.IHUI_BACKUP_PG_DIR || join(devEnvRoot(), 'backups', 'pg')
}

function readRootEnvKey(key) {
  try {
    const line = readFileSync(join(repoRoot, '.env'), 'utf8')
      .split(/\r?\n/)
      .find((l) => new RegExp(`^\\s*${key}\\s*=`).test(l))
    if (!line) return ''
    return line.replace(/^\s*[A-Z_]+\s*=\s*/, '').replace(/^["']|["']$/g, '').trim()
  } catch {
    return ''
  }
}

/** 凭据:① 服务环境块 ② §5d 权威目录口令文件(key-dir 唯一实现)。返回 {user,password,source}|{null,reason};口令永不打印 */
export function resolveCredential() {
  const envUser = (process.env.IHUI_DB_BACKUP_USER || '').trim()
  const envPw = process.env.IHUI_DB_BACKUP_PASSWORD || ''
  if (envPw.trim()) return { user: envUser || 'beifen', password: envPw, source: 'env IHUI_DB_BACKUP_*' }
  let file = ''
  try {
    file = keyFile('db-backup', 'ihui-backup.txt') || ''
  } catch {
    file = ''
  }
  if (file && existsSync(file)) {
    const pw = String(readFileSync(file, 'utf8').split(/\r?\n/)[0] || '').trim()
    if (pw) return { user: envUser || 'beifen', password: pw, source: `口令文件(${file} 的路径,不含内容)` }
    return { null: true, reason: `凭据文件为空: ${file}` }
  }
  return { null: true, reason: '专用角色凭据取不到(env 未设且口令文件不存在)—— 刻意不回落到 .env 应用账号:本工具的最小权限边界' }
}

export function defaultExec(step, { timeoutMs = 30_000, discardStdout = false } = {}) {
  const [exe, ...args] = step.argv
  const env = { ...process.env, PGCLIENTENCODING: 'UTF8' }
  if (step.password) env.PGPASSWORD = step.password
  const r = spawnSync(exe, args, {
    env,
    encoding: 'utf8',
    timeout: timeoutMs,
    windowsHide: true,
    input: step.input,
    stdio: discardStdout ? ['pipe', 'ignore', 'pipe'] : ['pipe', 'pipe', 'pipe'],
    maxBuffer: 64 * 1024 * 1024,
  })
  if (r.error) throw new Error(`派生失败 ${exe}: ${r.error.message}`)
  return { rc: r.status ?? -1, stdout: r.stdout ?? '', stderr: r.stderr ?? '' }
}

function readMagic(path) {
  try {
    const fd = openSync(path, 'r')
    try {
      const buf = Buffer.alloc(5)
      const n = readSync(fd, buf, 0, 5, 0)
      return n === 5 && buf.toString('latin1') === 'PGDMP'
    } finally {
      closeSync(fd)
    }
  } catch {
    return false
  }
}

function parseToc(stdout) {
  const head = (re) => {
    const m = re.exec(stdout)
    return m ? m[1] : undefined
  }
  let tableDataCount = 0
  let publicTableDataCount = 0
  const tables = []
  for (const line of stdout.split(/\r?\n/)) {
    const m = /^(\d+); (\d+) (\d+) TABLE DATA (\S+) (\S+) /.exec(line)
    if (m && m[4] !== '-') {
      tableDataCount++
      if (m[4] === 'public') {
        publicTableDataCount++
        tables.push(m[5])
      }
    }
  }
  return {
    format: head(/;\s+Format: (\S+)/),
    tocEntries: Number(head(/;\s+TOC Entries: (\d+)/) ?? NaN),
    dbVersion: head(/;\s+Dumped from database version: ([\d.]+)/),
    tableDataCount,
    // 生产侧统计只按 nspname='public' 取(STATS_SQL),所以能与之对账的是这一档而不是上面那个全模式数 ——
    // 两者曾被印在同一行且都写作 "public",凭空造出"备份比现库多两张"的假差异(实为 drizzle 模式的 2 张)。
    publicTableDataCount,
    tables,
  }
}

// ────────────────────────────── 各档实现 ──────────────────────────────

function probeFileLayer(ctx, out) {
  // ① dump 新鲜度/大小/完整性
  let files = []
  try {
    files = readdirSync(ctx.backupDir)
  } catch (e) {
    out.dump = { verdict: 'undetermined', reasons: [`备份目录不可读: ${ctx.backupDir} (${e.message})`] }
    return out
  }
  const latest = resolveLatestDump(files)
  if (!latest) {
    out.dump = { verdict: 'undetermined', reasons: [`目录里无 ihui_dev_YYYYMMDD_HHMMSS.dump 形态文件: ${ctx.backupDir}`] }
    return out
  }
  const path = join(ctx.backupDir, latest.name)
  const size = statSync(path).size
  const magicOk = readMagic(path)
  let toc = null
  let tocInfo = null
  if (ctx.binExists) {
    const r = ctx.run({ argv: [ctx.bins.pgRestore, '-l', path] }, { timeoutMs: 120_000 })
    toc = { rc: r.rc }
    if (r.rc === 0) {
      tocInfo = parseToc(r.stdout)
      toc.format = tocInfo.format
      toc.tocEntries = tocInfo.tocEntries
      toc.tableDataCount = tocInfo.tableDataCount
    } else {
      toc.stderr = r.stderr.slice(0, 200)
    }
  } else {
    out.dumpBinary = 'pg_restore 不在位,TOC 未判'
  }
  out.dump = {
    ...classifyDump({ exists: true, size, magicOk, toc }),
    path,
    name: latest.name,
    size,
    freshToday: latest.stampYmd === ctx.ymd,
    stampYmd: latest.stampYmd,
    toc: tocInfo,
  }
}

function probeConnLayer(ctx, out, cred) {
  // ③ 可连性 + 角色属性 + 生产库清单/统计
  if (cred.null) {
    out.conn = { verdict: 'undetermined', reasons: [cred.reason] }
    return
  }
  const run = (db, sql) => ctx.run({ argv: [ctx.bins.psql, '-w', '-h', ctx.conn.host, '-p', String(ctx.conn.port), '-U', ctx.conn.user, '-d', db, '-t', '-A', '-c', sql] }, { timeoutMs: 30_000 })
  const one = run(ctx.conn.prodDb, 'SELECT 1')
  if (one.rc !== 0) {
    out.conn = { verdict: 'undetermined', reasons: [`psql SELECT 1 失败(exit ${one.rc}): ${one.stderr.slice(0, 200) || '无 stderr(检查服务/端口)'}`], user: ctx.conn.user }
    return
  }
  const dbs = run(ctx.conn.prodDb, 'SELECT datname FROM pg_database ORDER BY 1')
  const role = run(ctx.conn.prodDb, 'SELECT current_user, rolcreatedb, rolsuper FROM pg_roles WHERE rolname = current_user')
  const stats = run(ctx.conn.prodDb, STATS_SQL)
  const roleRow = (role.stdout || '').trim().split('|')
  out.conn = {
    verdict: 'ok',
    user: ctx.conn.user,
    credentialSource: cred.source,
    databases: (dbs.stdout || '').trim().split(/\r?\n/).filter(Boolean),
    role: role.rc === 0 && roleRow.length >= 3
      ? { rolname: roleRow[0], rolcreatedb: roleRow[1] === 't', rolsuper: roleRow[2] === 't' }
      : null,
    prodStats: fingerprint(stats.stdout),
    prodStatsRc: stats.rc,
  }
  // ② 行数量级:dump 侧表数(TOC)× 生产侧 reltuples 估计 —— 都不精确,如实说明
  const rt = /reltuples=(\d+)/.exec(out.conn.prodStats || '')
  out.rowMagnitude = {
    dumpTableDataTables: out.dump?.toc?.tableDataCount ?? null,
    dumpPublicTableDataTables: out.dump?.toc?.publicTableDataCount ?? null,
    prodTablesFromStats: (/tables=(\d+)/.exec(out.conn.prodStats || '') || [])[1] || null,
    prodReltuplesEstimate: rt ? Number(rt[1]) : null,
    dumpBytes: out.dump?.size ?? null,
    note: '行数为 pg_class.reltuples 估计值(非 count(*));dump 不含精确行数,量级只能由 大小÷表数 粗推',
  }
}

function offlineFullVerify(ctx, out) {
  // --single-transaction -f - :不连库,把整份归档解压成 SQL 写到 stdout(丢弃)。
  // 证明"每个压缩块可读且 gunzip 干净、TOC→数据块全链一致";证明不了服务端能否接受(约束/类型/扩展)。
  if (!out.dump || out.dump.verdict === 'undetermined') {
    out.offlineFull = { verdict: 'undetermined', reasons: ['dump 未判,全量解压无从谈起'] }
    return
  }
  const started = Date.now()
  try {
    const r = ctx.run(
      { argv: [ctx.bins.pgRestore, '--single-transaction', '-f', '-', out.dump.path] },
      { timeoutMs: Number(process.env.IHUI_RESTORE_DRILL_OFFLINE_TIMEOUT_MS || 10 * 60_000), discardStdout: true },
    )
    out.offlineFull = {
      verdict: r.rc === 0 ? 'passed' : 'failed',
      seconds: Math.round((Date.now() - started) / 1000),
      stderr: (r.stderr || '').slice(0, 400),
      proves: '整份归档每个压缩块可解压可读、目录与数据块链条自洽(文件层最强证明)',
      notProves: '服务端是否接受(约束/触发器/类型/扩展存在性、collation、权限)、还原用时、还原后数据可查',
    }
  } catch (e) {
    out.offlineFull = { verdict: 'undetermined', reasons: [`派生失败: ${e.message}`] }
  }
}

/** ④ 要完成一次真恢复还缺什么(打印,不做) */
function missingForRealRestore(ctx, out) {
  const list = []
  if (!out.dump || out.dump.verdict !== 'complete') list.push(`dump 完整性未过判: ${out.dump?.verdict ?? 'undetermined'} — 先解决它`)
  if (!out.conn || out.conn.verdict !== 'ok') list.push('数据库可连性未判 — 先解决凭据/服务')
  const online = decideOnline(out.conn?.role ?? null)
  if (online.state === 'insufficient')
    list.push(`在线建库权限:角色 ${out.conn.role.rolname} rolcreatedb=f —— 需机主决定(给专用角色授 CREATEDB,或由持超管口令者本人执行一次);本工具绝不自行提权`, )
  if (online.state === 'undetermined') list.push('角色属性未判(没连上库)')
  list.push('执行窗口:restore 与逐表 count(*) 会对生产库产生读压,建议低峰;时长 = 还原(约库大小量级)+ 两侧各一轮全表计数')
  if (list.length === 0) list.push('(现读无缺项:凭据可建库、dump 完整、可连 —— 直接 --apply 即可)')
  return { online, list }
}

function modeCheck(ctx) {
  const out = { mode: '--check', ymd: ctx.ymd, targetDbShape: `${DRILL_PREFIX}<YYYYMMDD>(今天会是 ${drillDbName(ctx.ymd)})` }
  probeFileLayer(ctx, out)
  probeConnLayer(ctx, out, ctx.cred)
  const miss = missingForRealRestore(ctx, out)
  out.canOnlineDrill = miss.online
  out.missingForRealRestore = miss.list
  return { code: judgeCheckCode(out), out }
}

function judgeCheckCode(out) {
  if (!out.dump || out.dump.verdict === 'undetermined') return 2
  if (!out.conn || out.conn.verdict !== 'ok') return 2
  return out.dump.verdict === 'complete' ? 0 : 1
}

function modeDryRun(ctx) {
  const out = { mode: '--dry-run', ymd: ctx.ymd, executed: false, note: '以下命令若执行将逐条派发;本档零执行、零连库' }
  const target = drillDbName(ctx.ymd)
  try {
    const latest = resolveLatestDump(safeReaddir(ctx.backupDir))
    if (!latest) out.note += ' —— 注意:备份目录当前找不到符合命名形态的 dump,dry-run 里的路径是占位符'
    const plan = buildPlan({
      bins: ctx.bins,
      conn: ctx.conn,
      dumpPath: latest ? join(ctx.backupDir, latest.name) : join(ctx.backupDir, '<最新 ihui_dev_YYYYMMDD_HHMMSS.dump>'),
      targetDb: target,
    })
    out.targetDb = target
    out.plan = plan.map((s) => ({ kind: s.kind, label: s.label, argv: s.argv, stdinSql: s.input ? `${String(s.input).slice(0, 80)}…(SQL 走 stdin)` : undefined }))
    out.cleanup = plan.filter((s) => s.kind === 'write' && s.id === 'drop').map((s) => s.label)
    out.guards = [
      '口令绝不打印;上面的 -U 后即凭据来源而非凭据',
      'CREATE/DROP 前逐字符校验库名形状;同名库已存在即中止,绝不复用/删除',
      'restore 失败或生产统计前后不一致 ⇒ 保留演练库待人工取证,不静默 DROP',
      'drop 步骤只在逐表行数与统计指纹全部核对通过后单独派发',
    ]
    return { code: 0, out }
  } catch (e) {
    return { code: 1, out: { ...out, error: String(e.message ?? e) } }
  }
}

function safeReaddir(d) {
  try {
    return readdirSync(d)
  } catch {
    return []
  }
}

function modeOffline(ctx) {
  const out = { mode: '--offline-verify', ymd: ctx.ymd }
  probeFileLayer(ctx, out)
  offlineFullVerify(ctx, out)
  return { code: out.offlineFull?.verdict === 'passed' ? 0 : out.offlineFull?.verdict === 'failed' ? 1 : 2, out }
}

function modeApply(ctx) {
  const out = { mode: '--apply', ymd: ctx.ymd }
  probeFileLayer(ctx, out)
  probeConnLayer(ctx, out, ctx.cred)
  const online = decideOnline(out.conn?.role ?? null)
  out.canOnlineDrill = online
  if (online.state !== 'possible') {
    // 硬约束 3:不提权、不换管理员口令 —— 给离线替代方案并如实判"不足以在线演练"
    offlineFullVerify(ctx, out)
    out.missingForRealRestore = missingForRealRestore(ctx, out).list
    out.verdict = '当前凭据不足以做在线演练;已完成文件层全量证明(见 offlineFull)'
    return { code: online.state === 'insufficient' ? 3 : 2, out }
  }
  if (out.dump.verdict !== 'complete') {
    out.verdict = 'dump 未判/不完整,中止在线演练(不建任何库)'
    return { code: 1, out }
  }
  const target = drillDbName(ctx.ymd)
  out.targetDb = target
  const plan = buildPlan({ bins: ctx.bins, conn: ctx.conn, dumpPath: out.dump.path, targetDb: target })
  const byId = Object.fromEntries(plan.map((s) => [s.id, s]))
  const mainPlan = plan.filter((s) => s.id !== 'drop')
  const exec = (step) =>
    ctx.run(step, {
      timeoutMs: step.id === 'restore' ? Number(process.env.IHUI_RESTORE_DRILL_RESTORE_TIMEOUT_MS || 30 * 60_000) : 120_000,
    })
  // 中止条件:存在性预检非空(库已存在,绝不动它)/ 任何写步骤非零退出。
  const check = (step, o) => {
    if (step.id === 'exists' && String(o.stdout || '').trim() !== '')
      return `演练库 ${target} 已存在 —— 中止(不复用、不删除;这违反"只动今天新建的那一个"的前提)`
    if (step.kind === 'write' && o.rc !== 0)
      return `写步骤失败于「${step.label}」(exit ${o.rc}):${String(o.stderr || '').slice(0, 400) || '无 stderr'}`
    return null
  }
  let results
  try {
    results = runPlan(mainPlan, { allowWrites: true, exec, check })
  } catch (e) {
    const done = e.aborted ? e.results : null
    out.abortedAt = done ? done[done.length - 1]?.step?.id : 'unknown'
    out.verdict = `中止:${String(e.message ?? e)};${done && done.some((r) => r.step.id === 'create') ? `演练库可能残留待人工处置: ${target}` : '未产生任何残留(写步骤尚未成功执行)'}`
    return { code: 1, out }
  }
  const got = (id) => results.find((r) => r.step.id === id).out
  out.prodStatsBefore = fingerprint(got('pre-stats').stdout)
  out.prodStatsAfter = fingerprint(got('post-stats').stdout)
  const toMap = (o) => {
    const m = new Map()
    for (const line of String(o.stdout || '').split(/\r?\n/)) {
      const p = line.split('|')
      if (p.length === 2 && p[0]) m.set(p[0], p[1])
    }
    return m
  }
  const pm = toMap(got('counts-prod'))
  const dm = toMap(got('counts-drill'))
  const diffs = []
  for (const [t, n] of pm) if (dm.get(t) !== n) diffs.push(`${t}: prod=${n} drill=${dm.get(t) ?? 'MISSING'}`)
  for (const t of dm.keys()) if (!pm.has(t)) diffs.push(`${t}: 仅存在于 drill`)
  out.tableCount = { prod: pm.size, drill: dm.size }
  out.rowDiffs = diffs
  out.drillDbSize = String(got('drill-size').stdout || '').trim()
  if (!fingerprintsEqual(out.prodStatsBefore, out.prodStatsAfter)) {
    out.verdict = `生产库统计前后不一致 —— 立即停,不 DROP,保留演练库待人工取证: ${target}(before≠after 均已打印)`
    return { code: 1, out }
  }
  if (diffs.length > 0) {
    out.verdict = `行数不一致 ${diffs.length} 处 —— 不 DROP,保留演练库待查: ${target};生产统计已验证未被扰动`
    return { code: 1, out }
  }
  // 全部核对通过 ⇒ 此刻才允许唯一一次 DROP(再次过闸门)
  try {
    const dropResults = runPlan([byId.drop], { allowWrites: true, exec, check })
    const d = dropResults[0].out
    if (d.rc !== 0) {
      out.verdict = `核对全过,但 DROP 失败(exit ${d.rc}),演练库残留待人工处置: ${target}`
      return { code: 1, out }
    }
  } catch (e) {
    out.verdict = `核对全过,DROP 阶段中止: ${String(e.message ?? e)};演练库残留待人工处置: ${target}`
    return { code: 1, out }
  }
  out.verdict = `在线演练成功:${pm.size} 张表逐表行数全等;生产库前后统计指纹逐字一致;演练库已 DROP`
  return { code: 0, out }
}

// ────────────────────────────── 输出装配 ──────────────────────────────

function renderHuman(o) {
  const L = []
  const yn = (b) => (b === true ? '是' : b === false ? '否' : '未判定')
  L.push(`── pg-restore-drill  mode=${o.mode}  日期=${o.ymd} ──`)
  if (o.note) L.push(`   ${o.note}`)
  const d = o.dump || {}
  if (o.dump) {
    L.push(`① dump(${d.verdict === 'complete' ? '✅ 完整' : d.verdict === 'truncated' ? '❌ 截断/损坏' : '⚠ 未判定'})`)
    if (d.path) {
      L.push(`   最新: ${d.path}`)
      L.push(`   大小: ${d.size} B (${(d.size / 1048576).toFixed(1)} MB)  产出日: ${d.stampYmd}  今天有新备份: ${yn(d.freshToday)}`)
      L.push(`   完整性判法: 头部 magic=PGDMP + pg_restore -l 全量 TOC 解析(自定义格式把 TOC 与结束标记放在文件尾,尾部缺失必解析失败)`)
      if (d.toc) L.push(`   TOC: ${d.toc.tocEntries} 条 / 格式 ${d.toc.format} / 源库版本 ${d.toc.dbVersion} / TABLE DATA ${d.toc.tableDataCount} 张`)
    }
    for (const r of d.reasons || []) L.push(`   ${r}`)
  } else if (o.mode === '--dry-run') {
    L.push('①②③ 本档零执行不探测 —— 实况见 --check')
  }
  if (o.rowMagnitude) {
    const rm = o.rowMagnitude
    L.push(`② 表与行数(量级,dump 不存精确行数,如判据注释)`)
    L.push(
      `   dump 内 public 表 ${rm.dumpPublicTableDataTables} 张;生产库现有 public 表 ${rm.prodTablesFromStats} 张、reltuples 估计合计 ${rm.prodReltuplesEstimate} 行`,
    )
    L.push(
      `   (dump 全模式 TABLE DATA 共 ${rm.dumpTableDataTables} 张 —— 与生产侧同口径的只有上面那个 public 数;生产统计查询只取 nspname='public')`,
    )
    if (rm.dumpBytes && rm.prodReltuplesEstimate) L.push(`   粗推量级: ${Math.round(rm.dumpBytes / Math.max(rm.prodReltuplesEstimate, 1))} B/行(压缩后,dump大小÷reltuples 估计,仅供交叉核对,不是结论)`)
  }
  const c = o.conn || {}
  if (o.conn) {
    L.push(`③ 可连性(${c.verdict === 'ok' ? `✅ 以 ${c.user} 只读连接通过;凭据来源: ${c.credentialSource}` : `⚠ ${c.verdict}`})`)
    if (c.databases) L.push(`   pg_database: ${c.databases.join(', ')}  ⇒ 生产库(按 .env/兜底) = ${o.prodDb || ''}`)
    if (c.role) L.push(`   角色 ${c.role.rolname}: rolcreatedb=${yn(c.role.rolcreatedb)} rolsuper=${yn(c.role.rolsuper)}`)
    for (const r of c.reasons || []) L.push(`   ${r}`)
    if (c.prodStats) L.push(`   生产库统计指纹: ${c.prodStats.replace(/\n/g, ' | ')}`)
  }
  if (o.canOnlineDrill) L.push(`④ ${o.canOnlineDrill.text}`)
  if (o.missingForRealRestore) for (const m of o.missingForRealRestore) L.push(`   缺/注: ${m}`)
  if (o.offlineFull) {
    L.push(`◍ 离线全量解压验证(--single-transaction -f -,不连库): ${o.offlineFull.verdict}${o.offlineFull.seconds ? ` (${o.offlineFull.seconds}s)` : ''}`)
    if (o.offlineFull.proves) L.push(`   能证明: ${o.offlineFull.proves}`)
    if (o.offlineFull.notProves) L.push(`   证明不了: ${o.offlineFull.notProves}`)
    if (o.offlineFull.stderr) L.push(`   stderr: ${o.offlineFull.stderr}`)
  }
  if (o.plan) {
    L.push(`◍ 若执行 --apply,将按序派发以下 ${o.plan.length} 条(本档零执行):`)
    for (const s of o.plan) L.push(`   [${s.kind}] ${s.label}\n        ${s.argv.join(' ')}${s.stdinSql ? `\n        stdin: ${s.stdinSql}` : ''}`)
    L.push(`   用完删除: ${(o.cleanup || []).length} 条 DROP(仅 ${o.targetDb})`)
    for (const g of o.guards || []) L.push(`   护栏: ${g}`)
  }
  if (o.verdict) L.push(`▶ 结论: ${o.verdict}`)
  return L.join('\n')
}

/**
 * 主流程。deps 全可注入(镜像测试用假执行器证明只读档零写派发):
 *   deps.run(step,{timeoutMs,discardStdout}) → {rc,stdout,stderr}
 *   deps.bins / deps.backupDir / deps.cred / deps.ymd / deps.binExists
 * 返回 {code, out};**不打印** —— 打印在 isDirectRun 包装里,测试拿结构化对象。
 */
function main(argv = [], deps = {}) {
  const cli = parseCliArgs(argv)
  if (cli.error) return { code: 2, out: { error: cli.error } }
  const bins = deps.bins || { psql: join(pgBinDir(), 'psql.exe'), pgRestore: join(pgBinDir(), 'pg_restore.exe') }
  const binExists = deps.binExists ?? (existsSync(bins.psql) && existsSync(bins.pgRestore))
  if (!binExists)
    return { code: 2, out: { error: `无法判定:找不到 psql/pg_restore 二进制(${JSON.stringify(bins)};可用 IHUI_PG_BIN_DIR 覆盖)` } }
  const envDb = readRootEnvKey('DB_NAME')
  const envPort = readRootEnvKey('DB_PORT')
  const conn = {
    host: process.env.IHUI_DB_HOST || 'localhost',
    port: envPort || '8810',
    user: (process.env.IHUI_DB_BACKUP_USER || '').trim() || 'beifen',
    prodDb: envDb || 'ihui_dev',
  }
  const cred = deps.cred || resolveCredential()
  const ctx = {
    ymd: deps.ymd || todayYmd(),
    bins,
    binExists,
    conn,
    backupDir: deps.backupDir || backupPgDir(),
    cred,
    prodDb: conn.prodDb,
    // 统一执行入口:凭据只在这里并进子进程 env(永不进输出)
    run:
      deps.run ||
      ((step, opts) => defaultExec({ ...step, password: typeof cred.password === 'string' ? cred.password : '' }, opts)),
  }
  const { code, out } =
    cli.mode === '--dry-run' ? modeDryRun(ctx)
    : cli.mode === '--apply' ? modeApply(ctx)
    : cli.mode === '--offline-verify' ? modeOffline(ctx)
    : modeCheck(ctx)
  out.prodDb = out.prodDb || conn.prodDb
  out.exitCode = code
  return { code, out, json: cli.json }
}

// §22d 双形态入口守卫(必须经 pathToFileURL 归一 —— Windows 反斜杠路径手拼 file:/// 永不匹配)
const isDirectRun = process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href
if (isDirectRun) {
  Promise.resolve()
    .then(() => {
      const r = main(process.argv.slice(2))
      if (r.json) console.info(JSON.stringify(r.out))
      else if (r.out && r.out.error) {
        console.error(`❌ ${r.out.error}`)
        console.error('用法: node scripts/pg-restore-drill.mjs [--check|--dry-run|--apply|--offline-verify] [--json]')
      } else console.info(renderHuman(r.out))
      process.exit(r.code)
    })
    .catch((e) => {
      console.error(`❌ 脚本自身异常: ${e?.message ?? e}\n${e?.stack ?? ''}`)
      process.exit(2)
    })
}

export const __test__ = {
  main,
  renderHuman,
  todayYmd,
  drillDbName,
  isDrillDbName,
  assertDrillTarget,
  classifyDump,
  parseToc,
  resolveLatestDump,
  decideOnline,
  parseCliArgs,
  buildPlan,
  runPlan,
  fingerprint,
  fingerprintsEqual,
  quoteIdent,
  DRILL_NAME_RE,
  DRILL_PREFIX,
  DUMP_NAME_RE,
  COUNTS_SQL,
  STATS_SQL,
}
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
