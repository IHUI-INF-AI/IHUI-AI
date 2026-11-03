#!/usr/bin/env node
// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

// 权限档存值 kebab → camel 回填器(第②步:**默认只生成、不执行**)。
//
// 立因:顺序不可颠倒 —— ① 写侧改存 camel → ② 观察窗口量到"kebab 新增写入 = 0"
// 后才对**遗留行**做幂等回填 → ③ 最后才收紧读侧对 kebab 的容忍。本工具服务于 ②,
// 并且默认形态必须能证明"现在还不该执行"(离线 --verify 不连库、估算一律标注需连库)。
//
// 三道硬闸(缺一不执行):
//   闸1 精确 confirm 串 --confirm=PERM-WIRE-BACKFILL-STEP2
//   闸2 生产目标默认拒绝(主机/端口命中 aizhs 或 8810 即拒,除非 --target=prod --window=...)
//   闸3 **本次进程内**实际先跑过 --verify 且未报错(只看参数不算)
//
// 架构性约束:**不生成 drizzle 迁移文件、不写 __drizzle_migrations / journal**。
// 未发布的迁移会被部署循环自动打上,那正是本仓出过的事故;回填是运维动作,不是 schema 变更。
//
// 映射**派生**自 packages/types/src/permission-mode.ts(禁止抄字面量):注册表漂移即抛错,
// 未知落库值一律报错退出 —— 绝不猜映射、绝不静默跳过。
//
// 用法:node scripts/perm-wire-backfill.mjs [--verify] [--dsn=...] [--apply ...] [--rollback=<csv>] [--help]

import { readFileSync, writeFileSync, mkdirSync } from 'node:fs'
import { dirname, isAbsolute, join, relative, resolve, sep } from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'

import { parseTsRegistry, parseTsWireValues } from './check-permission-mode-vocabulary.mjs'

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..')
const REGISTRY_REL = 'packages/types/src/permission-mode.ts'

/** 闸1:必须精确等于此串(不含空格、不改大小写)。 */
export const CONFIRM_STRING = 'PERM-WIRE-BACKFILL-STEP2'
/** 闸2:命中任一特征即按生产处理,默认拒绝。 */
export const PROD_MARKERS = ['aizhs', '8810']
const IDENT_RE = /^[a-z_][a-z0-9_]*$/
const DEFAULT_TARGET = Object.freeze({
  table: 'workspace_permissions',
  column: 'mode',
  idColumn: 'id',
  updatedAtColumn: 'updated_at',
})

// ---------------------------------------------------------------------------
// 注册表解析 → 回填映射(唯一真相源)
// ---------------------------------------------------------------------------

/** 解析 `PERMISSION_MODE_WIRE`(规范 camel → 既有落库 kebab)。 */
export function parseWireMap(src) {
  const block = /export const PERMISSION_MODE_WIRE\b[^{]*\{([\s\S]*?)\n\s*\}/.exec(src)
  if (!block) throw new Error('未找到 PERMISSION_MODE_WIRE 对象声明,拒绝凭记忆构造映射')
  const out = {}
  for (const m of block[1].matchAll(/([A-Za-z_][\w]*)\s*:\s*'([^']+)'/g)) out[m[1]] = m[2]
  if (Object.keys(out).length === 0) throw new Error('PERMISSION_MODE_WIRE 解析结果为空')
  return out
}

/**
 * 派生回填对:`{ from: 既有 kebab 落库值, to: 规范 camel }`。
 *
 * 两侧成员必须与 PERMISSION_MODES / PERMISSION_MODE_WIRE_VALUES 闭合,否则视为注册表漂移直接抛错;
 * from === to 的档位(default / plan)天然无需回填,不进入 SQL。
 */
export function deriveMapping(src) {
  const { members } = parseTsRegistry(src)
  const wireValues = parseTsWireValues(src)
  const wire = parseWireMap(src)
  const memberSet = new Set(members)
  const pairs = []
  for (const [id, legacy] of Object.entries(wire)) {
    if (!memberSet.has(id)) {
      throw new Error(`注册表漂移:PERMISSION_MODE_WIRE 键 ${id} 不在 PERMISSION_MODES 内`)
    }
    if (!wireValues.includes(legacy)) {
      throw new Error(`注册表漂移:${id} 的落库拼写 ${legacy} 不在 PERMISSION_MODE_WIRE_VALUES 内`)
    }
    if (legacy === id) continue
    pairs.push({ from: legacy, to: id })
  }
  if (pairs.length === 0) {
    throw new Error('映射为空:注册表里不存在"落库拼写 ≠ 规范拼写"的档位,本工具无事可做')
  }
  return { pairs, members, wireValues }
}

/** 允许出现在 mode 列里的值(规范档 ∪ 既有 wire 档);其余一律抛错,不做兜底。 */
export function assertKnownValues(values, mapping) {
  const allowed = new Set([...mapping.members, ...mapping.wireValues])
  const unknown = [...new Set(values)].filter((v) => !allowed.has(v))
  if (unknown.length > 0) {
    throw new Error(
      `未知落库值:${unknown.join(', ')} —— 注册表认不出来,拒绝猜映射、拒绝静默跳过,已中止`,
    )
  }
  return true
}

// ---------------------------------------------------------------------------
// SQL 生成(纯字符串,离线可断言)
// ---------------------------------------------------------------------------

const q = (name) => `"${String(name).replace(/"/g, '""')}"`
const lit = (v) => `'${String(v).replace(/'/g, "''")}'`

export function normalizeTarget(raw) {
  const given = {}
  for (const [k, v] of Object.entries(raw ?? {})) if (v !== undefined && v !== null) given[k] = v
  const target = { ...DEFAULT_TARGET, ...given }
  for (const [k, v] of Object.entries(target)) {
    if (typeof v !== 'string' || !IDENT_RE.test(v)) {
      throw new Error(`非法 SQL 标识符 --${k.replace(/[A-Z]/g, (c) => `-${c.toLowerCase()}`)}=${v}`)
    }
  }
  return target
}

/** 逐值影响面估算(连库时取真实计数)。 */
export function buildCountSql(mapping, target) {
  return mapping.pairs
    .map(
      (p) =>
        `SELECT ${lit(p.from)} AS legacy_value, count(*) AS rows_to_update\n` +
        `  FROM ${q(target.table)} WHERE ${q(target.column)} = ${lit(p.from)}`,
    )
    .join('\nUNION ALL\n')
}

/** 回填 UPDATE:幂等 —— 命中 camel 的行不在 WHERE 内,再跑一次 0 影响。 */
export function buildUpdateSql(mapping, target) {
  return mapping.pairs.map(
    (p) =>
      `UPDATE ${q(target.table)} SET ${q(target.column)} = ${lit(p.to)} ` +
      `WHERE ${q(target.column)} = ${lit(p.from)}`,
  )
}

/** 快照 SELECT:UPDATE 之前导出 (id, 原值)。 */
export function buildSnapshotSql(target, mapping) {
  const froms = mapping.pairs.map((p) => lit(p.from))
  return (
    `SELECT ${q(target.idColumn)} AS id, ${q(target.column)} AS before_value ` +
    `FROM ${q(target.table)} WHERE ${q(target.column)} IN (${froms.join(', ')}) ORDER BY 1`
  )
}

/** 拼写分布(回填前后各跑一次,得到 kebab/camel 行数对照)。 */
export function buildDistributionSql(target, mapping) {
  const all = [...new Set([...mapping.wireValues, ...mapping.members])]
  return (
    `SELECT ${q(target.column)} AS value, count(*) AS rows FROM ${q(target.table)} ` +
    `WHERE ${q(target.column)} IN (${all.map(lit).join(', ')}) GROUP BY 1 ORDER BY 1`
  )
}

export function buildDistinctSql(target) {
  return `SELECT DISTINCT ${q(target.column)} AS value FROM ${q(target.table)} ORDER BY 1`
}

/** 观察窗口度量口径:窗口内**新写入/新改动**的仍是 kebab 的行数(应当为 0)。 */
export function buildNewKebabWritesSql(target, mapping, sinceIso) {
  const froms = mapping.pairs.map((p) => lit(p.from))
  return (
    `SELECT count(*) AS new_kebab_writes FROM ${q(target.table)} ` +
    `WHERE ${q(target.column)} IN (${froms.join(', ')}) ` +
    `AND ${q(target.updatedAtColumn)} >= ${lit(sinceIso)}::timestamptz`
  )
}

/** 回滚 UPDATE:按快照逐行还原,并用"当前值 = 回填后值"卡住二次覆盖。 */
export function buildRollbackSql(rows, target) {
  return rows.map(
    (r) =>
      `UPDATE ${q(target.table)} SET ${q(target.column)} = ${lit(r.before)} ` +
      `WHERE ${q(target.idColumn)} = ${lit(r.id)} AND ${q(target.column)} = ${lit(r.after)}`,
  )
}

// ---------------------------------------------------------------------------
// 快照 CSV
// ---------------------------------------------------------------------------

export function formatSnapshotCsv(target, rows, meta) {
  const lines = [
    '# perm-wire-backfill snapshot (step2, 第②步回填前导出)',
    `# created=${meta.created}`,
    `# table=${target.table} column=${target.column} id_column=${target.idColumn}`,
    '# dsn=<已脱敏,不落盘>',
    'id,before,after',
  ]
  for (const r of rows) {
    if (!r.id || !r.before || !r.after) {
      throw new Error(`快照行缺少 (id, before, after):${JSON.stringify(r)}`)
    }
    lines.push([r.id, r.before, r.after].join(','))
  }
  return `${lines.join('\n')}\n`
}

export function parseSnapshotCsv(text) {
  const lines = String(text)
    .split(/\r?\n/)
    .filter((l) => l.trim() !== '')
  const meta = {}
  const body = []
  for (const line of lines) {
    if (!line.startsWith('#')) {
      body.push(line)
      continue
    }
    const m = /^#\s*(table|column|id_column|created)=(\S+)/.exec(line)
    if (m) meta[m[1]] = m[2]
  }
  const header = body.shift()
  if (header !== 'id,before,after') {
    throw new Error(`快照表头应为 "id,before,after",实际 ${JSON.stringify(header)}`)
  }
  const rows = body.map((line, i) => {
    const cols = line.split(',')
    if (cols.length !== 3 || cols.some((c) => c.trim() === '')) {
      throw new Error(`快照第 ${i + 1} 行格式非法:${JSON.stringify(line)}`)
    }
    return { id: cols[0], before: cols[1], after: cols[2] }
  })
  if (rows.length === 0) throw new Error('快照为空:没有任何可回滚的行')
  const target = normalizeTarget({
    table: meta.table,
    column: meta.column,
    idColumn: meta.id_column,
  })
  return { target, rows, created: meta.created ?? '<未知>' }
}

/** 回滚前的一致性校验:每行 (before → after) 必须是注册表派生出来的那一族映射。 */
export function validateRollbackRows(rows, mapping) {
  const allowed = new Map(mapping.pairs.map((p) => [p.from, p.to]))
  for (const r of rows) {
    if (allowed.get(r.before) !== r.after) {
      throw new Error(
        `快照行不自洽:id=${r.id} 的 ${r.before} → ${r.after} 不在派生映射内,拒绝据此回滚`,
      )
    }
  }
  return true
}

/** 快照落点:必须在仓库内 logs/ 或 .ihui-agent/ 下(禁止项目外写文件)。 */
export function resolveSnapshotPath(repoRoot, snapshotDir, stamp) {
  const dir = resolve(repoRoot, snapshotDir ?? join('.ihui-agent', 'tmp', 'perm-wire-backfill'))
  const rel = relative(repoRoot, dir)
  if (rel === '' || rel.startsWith('..') || isAbsolute(rel)) {
    throw new Error(`快照目录越出仓库:${dir}`)
  }
  const top = rel.split(sep)[0]
  if (top !== 'logs' && top !== '.ihui-agent') {
    throw new Error(`快照必须落在仓库内 logs/ 或 .ihui-agent/ 下,当前 ${rel}`)
  }
  return { dir, file: join(dir, `perm-wire-snapshot-${stamp}.csv`) }
}

// ---------------------------------------------------------------------------
// 三道闸
// ---------------------------------------------------------------------------

export function isProdTarget(dsn) {
  const low = String(dsn ?? '').toLowerCase()
  return PROD_MARKERS.some((marker) => low.includes(marker))
}

/**
 * @param opts.verifyRanInProcess 本次进程内**确实跑过** --verify(不是只看参数)
 * @param opts.verifyErrors --verify 阶段收集到的错误;非空即闸3 不过
 */
export function planApplyGates(opts) {
  const reasons = []
  if (opts.confirm !== CONFIRM_STRING) {
    reasons.push(`闸1 未通过:--confirm 必须精确等于 ${CONFIRM_STRING}(当前值不参与回显)`)
  }
  if (!opts.dsn) {
    reasons.push('闸2 未通过:未提供 --dsn —— 缺省一律不连库,apply 无从谈起')
  } else if (
    isProdTarget(opts.dsn) &&
    !(opts.target === 'prod' && String(opts.window ?? '').trim())
  ) {
    reasons.push(
      `闸2 未通过:目标命中生产特征(${PROD_MARKERS.join('/')});确需执行须再加 --target=prod --window=<执行窗口>`,
    )
  }
  if (!opts.verifyRanInProcess) {
    reasons.push('闸3 未通过:本次进程内未先成功执行 --verify(仅传参数不能替代实际执行序)')
  } else if (Array.isArray(opts.verifyErrors) && opts.verifyErrors.length > 0) {
    reasons.push(`闸3 未通过:--verify 阶段报错(${opts.verifyErrors.length} 条),已中止`)
  } else if (opts.requireObserveWindow && !String(opts.since ?? '').trim()) {
    reasons.push(
      '闸3 未通过:--apply 必须给 --since=<第①步切流时刻>,否则"kebab 新增写入 = 0"无从量化',
    )
  }
  return { ok: reasons.length === 0, reasons }
}

/** 连接串脱敏:去掉 userinfo 后按"前6 + *** + 后2"输出,任何情况下不落完整串。 */
export function redactDsn(raw) {
  if (!raw) return '<未提供>'
  const stripped = String(raw).replace(/^([a-z][a-z0-9+.-]*:\/\/)([^@/]+@)/i, '$1')
  if (stripped.length <= 8) return '*'.repeat(stripped.length)
  return `${stripped.slice(0, 6)}***${stripped.slice(-2)}`
}

// ---------------------------------------------------------------------------
// DB 接入(仅 --dsn 时才发生;默认形态永不连库)
// ---------------------------------------------------------------------------

async function openDb(dsn) {
  let mod
  try {
    mod = await import('postgres')
  } catch {
    throw new Error(
      '无法解析 postgres 驱动:请在装有该依赖的 workspace 目录下运行(如 packages/database / apps/api),或去掉 --dsn 只跑离线 --verify',
    )
  }
  const factory = mod.default ?? mod
  return factory(dsn, { max: 1, idle_timeout: 10, connect_timeout: 10 })
}

const rowsOf = (result) => (Array.isArray(result) ? result : [])

// ---------------------------------------------------------------------------
// CLI
// ---------------------------------------------------------------------------

function parseArgs(argv) {
  const out = { mode: 'verify', dsn: process.env.IHUI_PERM_BACKFILL_DSN ?? '' }
  for (const raw of argv) {
    if (raw === '--help' || raw === '-h') out.help = true
    else if (raw === '--apply') out.mode = 'apply'
    else if (raw === '--verify') out.mode = 'verify'
    else if (raw === '--rollback') out.mode = 'rollback'
    else if (raw.startsWith('--rollback=')) {
      out.mode = 'rollback'
      out.rollbackFile = raw.slice('--rollback='.length)
    } else if (raw.startsWith('--dsn=')) out.dsn = raw.slice('--dsn='.length)
    else if (raw.startsWith('--confirm=')) out.confirm = raw.slice('--confirm='.length)
    else if (raw.startsWith('--target=')) out.target = raw.slice('--target='.length)
    else if (raw.startsWith('--window=')) out.window = raw.slice('--window='.length)
    else if (raw.startsWith('--table=')) out.table = raw.slice('--table='.length)
    else if (raw.startsWith('--column=')) out.column = raw.slice('--column='.length)
    else if (raw.startsWith('--id-column=')) out.idColumn = raw.slice('--id-column='.length)
    else if (raw.startsWith('--snapshot-dir='))
      out.snapshotDir = raw.slice('--snapshot-dir='.length)
    else if (raw.startsWith('--since=')) out.since = raw.slice('--since='.length)
    else throw new Error(`未知参数:${raw}(见 --help)`)
  }
  return out
}

/**
 * 离线 verify(永不连库):出 SQL 文本 + 派生映射 + "估算需连库"的诚实标注。
 * 这一步是闸3 的"实际执行序"载体 —— 它是本次进程内真实跑过的一次预检。
 */
export function runOfflineVerify({ mapping, target, log }) {
  const errors = []
  log('-- SQL 文本(将执行) --')
  log(buildCountSql(mapping, target))
  for (const s of buildUpdateSql(mapping, target)) log(s)
  log(buildSnapshotSql(target, mapping))
  log('')
  log('-- 影响面估算:**离线模式不连库,估算需连库**(下方刻意不给任何数字) --')
  for (const p of mapping.pairs) {
    log(`  ${p.from} → ${p.to}:行数 = 需连库(禁止估算)`)
  }
  log('  结论:未连接数据库 ⇒ 本次运行**不构成** go 判据,只证明"SQL 形态 + 映射来源"。')
  return { errors, connected: false }
}

/** 连库只读预检:真实逐值计数 + 值域校验 + 观察窗口度量。传入已打开的连接/事务句柄。 */
export async function inspectReadOnly(sql, { mapping, target, since, log }) {
  const errors = []
  log('-- 影响面实测(逐值) --')
  for (const row of rowsOf(await sql.unsafe(buildCountSql(mapping, target)))) {
    log(`  ${row.legacy_value}:待回填 ${row.rows_to_update} 行`)
  }
  const distinct = rowsOf(await sql.unsafe(buildDistinctSql(target))).map((r) => r.value)
  try {
    assertKnownValues(distinct, mapping)
    log(`  值域校验通过(distinct ${distinct.length} 个值全部落在注册表内)`)
  } catch (e) {
    errors.push(e.message)
    log(`  ✗ ${e.message}`)
  }
  if (since) {
    const cnt = rowsOf(await sql.unsafe(buildNewKebabWritesSql(target, mapping, since)))[0]
    log(`  观察窗口(${since}) 内 kebab 新增写入 = ${cnt?.new_kebab_writes ?? 0}(go 判据要求 0)`)
    if (String(cnt?.new_kebab_writes ?? '0') !== '0') {
      errors.push('观察窗口内仍有 kebab 新增写入,顺序未达成(第①步未收口),不得回填')
      log('  ✗ 顺序未达成:应停手回到第①步,禁止执行第②步')
    }
  } else {
    log('  ⚠ 未给 --since=<切流时刻>:无法给出"kebab 新增写入=0"的 go/no-go 判据')
  }
  return { errors }
}

/** 连库 verify(独立连接,只读)。 */
export async function runLiveVerify({ mapping, target, dsn, since, log }) {
  const sql = await openDb(dsn)
  try {
    const r = await inspectReadOnly(sql, { mapping, target, since, log })
    return { ...r, connected: true }
  } finally {
    await sql.end({ timeout: 5 })
  }
}

/** 兼容入口:按是否给 dsn 选择离线 / 连库两种形态。 */
export async function runVerify({ mapping, target, dsn, since, log }) {
  if (!dsn) return runOfflineVerify({ mapping, target, log })
  return runLiveVerify({ mapping, target, dsn, since, log })
}

function loadRegistry() {
  const src = readFileSync(join(ROOT, REGISTRY_REL), 'utf8')
  return deriveMapping(src)
}

function stampNow() {
  return new Date().toISOString().replace(/[-:]/g, '').replace(/\..+$/, '')
}

export async function main(argv = process.argv.slice(2)) {
  const args = parseArgs(argv)
  const log = (...lines) => {
    for (const l of lines) process.stdout.write(`${l}\n`)
  }
  if (args.help) {
    log(RUNBOOK)
    return 0
  }
  const mapping = loadRegistry()
  const target = normalizeTarget({
    table: args.table,
    column: args.column,
    idColumn: args.idColumn,
  })
  log(`[perm-wire-backfill] 模式=${args.mode} 表=${target.table} 列=${target.column}`)
  log(`[perm-wire-backfill] dsn=${redactDsn(args.dsn)}`)
  log('[perm-wire-backfill] 派生映射(源:' + REGISTRY_REL + ',未抄字面量):')
  for (const p of mapping.pairs) log(`  ${p.from} → ${p.to}`)
  log('')

  // 闸3 的实际执行序:先**真的**在本进程内跑一遍离线 verify(永不连库),再判闸门。
  const offline = runOfflineVerify({ mapping, target, log })
  let verifyErrors = offline.errors

  if (args.mode === 'verify') {
    if (args.dsn) {
      const live = await runLiveVerify({
        mapping,
        target,
        dsn: args.dsn,
        since: args.since,
        log,
      })
      verifyErrors = [...offline.errors, ...live.errors]
    }
    log('')
    log(
      verifyErrors.length === 0
        ? '[perm-wire-backfill] verify 通过(只读;未执行任何写语句)'
        : `[perm-wire-backfill] verify 报错 ${verifyErrors.length} 条`,
    )
    return verifyErrors.length === 0 ? 0 : 1
  }

  let rollbackSource = null
  if (args.mode === 'rollback') {
    if (!args.rollbackFile) throw new Error('--rollback 需要快照 CSV 路径:--rollback=<csv>')
    rollbackSource = parseSnapshotCsv(readFileSync(resolve(ROOT, args.rollbackFile), 'utf8'))
    validateRollbackRows(rollbackSource.rows, mapping)
    log(
      `[perm-wire-backfill] 快照可回滚 ${rollbackSource.rows.length} 行(创建于 ${rollbackSource.created})`,
    )
  }

  const gates = planApplyGates({
    confirm: args.confirm,
    dsn: args.dsn,
    target: args.target,
    window: args.window,
    since: args.since,
    requireObserveWindow: args.mode === 'apply',
    verifyRanInProcess: true,
    verifyErrors,
  })
  log('')
  log(`[perm-wire-backfill] 执行闸门:${gates.ok ? '全部通过' : '未通过'}`)
  for (const r of gates.reasons) log(`  ✗ ${r}`)
  if (!gates.ok) {
    log('[perm-wire-backfill] 拒绝执行:闸门未过 ⇒ 全程未向数据库发起任何连接或写语句。')
    return 1
  }

  // 只有三道闸全绿才允许连库;读侧预检与写侧 UPDATE 同处一个事务,任一失败整体回滚。
  const sql = await openDb(args.dsn)
  try {
    await sql.begin(async (tx) => {
      const live = await inspectReadOnly(tx, {
        mapping,
        target,
        since: args.mode === 'apply' ? args.since : '',
        log,
      })
      if (live.errors.length > 0) {
        throw new Error(`连库预检未通过(${live.errors.length} 条),事务回滚,零写入门`)
      }
      const before = rowsOf(await tx.unsafe(buildDistributionSql(target, mapping)))
      log(`  回填前行数对照:${before.map((r) => `${r.value}=${r.rows}`).join(' ') || '<空>'}`)

      if (args.mode === 'apply') {
        const snapRows = rowsOf(await tx.unsafe(buildSnapshotSql(target, mapping))).map((r) => {
          const pair = mapping.pairs.find((p) => p.from === r.before_value)
          return { id: r.id, before: r.before_value, after: pair ? pair.to : r.before_value }
        })
        const snap = resolveSnapshotPath(ROOT, args.snapshotDir, stampNow())
        mkdirSync(snap.dir, { recursive: true })
        writeFileSync(
          snap.file,
          formatSnapshotCsv(target, snapRows, { created: new Date().toISOString() }),
          'utf8',
        )
        log(`  快照已导出:${relative(ROOT, snap.file)}(${snapRows.length} 行)`)
        log(
          `  回滚命令:node scripts/perm-wire-backfill.mjs --rollback=${relative(ROOT, snap.file)} \\`,
        )
        log('      --dsn=<非生产库> --confirm=' + CONFIRM_STRING)
        let touched = 0
        for (const s of buildUpdateSql(mapping, target)) {
          const res = await tx.unsafe(s)
          const n = Number(res?.count ?? rowsOf(res).length ?? 0)
          touched += n
          log(`  ${s} → ${n} 行`)
        }
        log(`  合计影响 ${touched} 行(幂等:camel 行再跑一次必为 0)`)
      } else {
        let restored = 0
        for (const s of buildRollbackSql(rollbackSource.rows, rollbackSource.target)) {
          const res = await tx.unsafe(s)
          restored += Number(res?.count ?? rowsOf(res).length ?? 0)
        }
        log(`  按快照还原 ${restored}/${rollbackSource.rows.length} 行`)
      }

      const after = rowsOf(await tx.unsafe(buildDistributionSql(target, mapping)))
      log(`  执行后行数对照:${after.map((r) => `${r.value}=${r.rows}`).join(' ') || '<空>'}`)
    })
    log('[perm-wire-backfill] 事务已提交(单事务:任一步失败即整体回滚)')
  } catch (e) {
    log(`[perm-wire-backfill] ✗ 事务已回滚:${e?.message ?? e}`)
    return 1
  } finally {
    await sql.end({ timeout: 5 })
  }
  return 0
}

export const RUNBOOK = `权限档 kebab → camel 回填 · 执行窗口 runbook(第②步)

顺序(不可颠倒)
  ① 写侧改存 camel(路由/handler 出口全部走 camel) → 部署并确认已生效
  ② 观察窗口量到"kebab 新增写入 = 0" → 才对遗留行跑本工具 --apply(幂等回填)
  ③ 回填稳定后,才收紧读侧对 kebab 的容忍(permissionModeWire 不再接受旧拼写)
  本工具**不生成 drizzle 迁移文件、不写 __drizzle_migrations / journal**:
  未发布的迁移会被部署循环自动打上(本仓出过事故),回填属运维数据动作,与 schema 变更解耦。

命令
  只读预检(默认,不连库):node scripts/perm-wire-backfill.mjs --verify
  连库预检(仍不写):      node scripts/perm-wire-backfill.mjs --verify --dsn=<非生产> --since=<①切流时刻 ISO>
  执行回填:              node scripts/perm-wire-backfill.mjs --apply --dsn=<非生产> \\
                              --confirm=${CONFIRM_STRING} --since=<①切流时刻 ISO>
  回滚:                  node scripts/perm-wire-backfill.mjs --rollback=.ihui-agent/tmp/perm-wire-backfill/perm-wire-snapshot-<ts>.csv \\
                              --dsn=<同一库> --confirm=${CONFIRM_STRING}
  生产库:                默认拒绝;确需执行须显式 --target=prod --window=<如 2026-09-25 02:00-02:15 +08:00>

三道闸(缺一不执行)
  闸1 --confirm 精确等于 ${CONFIRM_STRING}
  闸2 目标主机/端口命中 ${PROD_MARKERS.join(' 或 ')} 即视为生产,默认拒绝(须 --target=prod + --window)
  闸3 本次进程内先跑 --verify 且 0 报错 —— 只传参数不算,执行序由实际调用判定;
      --apply 还须带 --since=<①切流时刻>,否则 "kebab 新增写入 = 0" 无从量化
  顺序保证:闸门在**任何连接建立之前**判定;未通过 ⇒ 进程从始至终不向数据库发起连接。

go / no-go 判据
  go    :--verify --since 报 "观察窗口内 kebab 新增写入 = 0" 且 值域校验通过 且 三道闸全绿
  no-go :窗口内新增写入 > 0(①未收口,回到写侧)/ distinct 值出现注册表外拼标(未知值一律抛错,不猜映射)/
          任一闸门未过 / 快照目录不可写 / 目标被识别为生产但未申报窗口
  no-go 时禁止 --apply,也禁止"先清一半"——遗留行少改一行都比顺序错改一遍安全

快照与回滚
  位置:仓库内 .ihui-agent/tmp/perm-wire-backfill/perm-wire-snapshot-<UTC 时间戳>.csv
       (--snapshot-dir 可改,但必须落在 logs/ 或 .ihui-agent/ 下,禁止项目外写文件)
  内容:id,before,after(UPDATE 之前导出;dsn 一律脱敏,不落盘)
  回滚:按 id + 当前值 = after 双重限定还原 before,单事务;行数不等于快照数即报错回滚整事务
  快照至少保留到第③步收紧完成并复跑一次 --verify 之后

观察窗口的度量口径("kebab 新增写入 = 0"怎么量)
  主口径(数据侧):自第①步切流时刻 T0 起
    SELECT count(*) FROM workspace_permissions
     WHERE mode IN (<派生的 kebab 集>) AND updated_at >= T0;
    → 必须为 0。updated_at 由写路径每次 UPSERT 刷新,因此"改过且仍是 kebab"必被计入。
  交叉口径(日志侧):同一窗口内 API 侧 PUT /permissions 的入参拼写分布(只看 camel 计数);
    两条口径同时为 0 才算窗口干净,任一非 0 → 窗口起点顺延并重取 T0。
  窗口长度:T0 后至少跨过一次完整业务高峰(建议 ≥72h),避免夜间低峰把"没人写"误读成"没人写错"。
  回填后复核:再跑一次 --apply(幂等应 0 影响)+ --verify 行数对照,kebab 侧应为 0。

验收
  node --test scripts/tests/perm-wire-backfill.test.mjs   # 含"去掉 confirm 校验"变异体必须红
`

export const __test__ = {
  main,
  deriveMapping,
  parseWireMap,
  assertKnownValues,
  buildCountSql,
  buildUpdateSql,
  buildSnapshotSql,
  buildRollbackSql,
  buildDistributionSql,
  buildDistinctSql,
  buildNewKebabWritesSql,
  formatSnapshotCsv,
  parseSnapshotCsv,
  validateRollbackRows,
  resolveSnapshotPath,
  normalizeTarget,
  planApplyGates,
  isProdTarget,
  redactDsn,
  runVerify,
  runOfflineVerify,
  runLiveVerify,
  inspectReadOnly,
  CONFIRM_STRING,
  PROD_MARKERS,
  REGISTRY_REL,
}

const isDirectRun = process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href
if (isDirectRun) {
  main()
    .then((code) => {
      if (code !== 0) process.exit(code)
    })
    .catch((e) => {
      process.stderr.write(`❌ ${e?.message ?? e}\n`)
      process.exit(2)
    })
}
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
