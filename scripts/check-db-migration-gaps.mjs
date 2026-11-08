#!/usr/bin/env node
// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * check-db-migration-gaps.mjs —— DB 迁移账本的「中间缺口」审计(只读默认;修复需 --repair --apply --yes)
 *
 * 立因(2026-10-25 生产实测):
 *   `drizzle-kit migrate` 只应用 `when > max(账本.created_at)` 的迁移。一个**带旧 when 的迁移晚到**
 *   (并发分支合并 / 编号重排 / 手工补文件)就会被**永久跳过**,而 migrate 仍 exit 0。
 *   部署侧旧判据只看「journal 条数 − 账本条数」,既分不清「中间缺口(永不补)」与「待应用(下轮会补)」,
 *   又把 1 条真实缺口报成档位噪音。实测后果:D125 协作表 `chat_conversation_collaborators` /
 *   `chat_message_comments` 在生产**根本没有建表**,而部署日志只说“迁移未落地 1-3 档”。
 *
 * 判据(纯函数 classifyMigrationGaps,构造面可证):
 *   · applied   账本已有该文件的 sha256(账本带 tag 时要求 tag+hash 同时命中);
 *   · hashDrift 账本无该 hash 但 created_at == 该文件的 when ⇒ 账本身份被复用/文件后改
 *               (DB-14 起 **判红**,不再只报数);
 *   · pending   hash 缺 ∧ when > maxApplied ⇒ drizzle 下一轮会应用;
 *   · lateGap   hash 缺 ∧ when 不在账本里 ∧ when <= maxApplied ⇒ **drizzle 永不应用** ⇒ 判红。
 *   · rows/dupHashes/dupWhens 账本行数与重复行可见(DB-15;重复行说明没有业务唯一键保护)。
 *
 * 用法:
 *   node scripts/check-db-migration-gaps.mjs                    # 只读审计
 *   node scripts/check-db-migration-gaps.mjs --json             # 机器可读
 *   node scripts/check-db-migration-gaps.mjs --repair           # DRY-RUN:只打印将执行的 SQL/账本行
 *   node scripts/check-db-migration-gaps.mjs --repair --apply --yes  # 同一 psql -1 事务内应用+补账本
 *   node scripts/check-db-migration-gaps.mjs --self-test
 *   --journal <path>    必须 realpath 且在 packages/database/drizzle/meta/ 内(修复档强制)
 *   --env-file <path>   DSN 来源(默认 apps/api/.env;也可直接用 env DATABASE_URL)
 *   --backup-dir <path> 修复前账本快照目录(默认 D:/DevEnv/backups,§5b 批准落点;env IHUI_BACKUP_DIR 可覆盖)
 *
 * 退出码:0 = 无缺口;1 = 有 lateGap/hashDrift(或修复中某条失败);2 = 未判定
 *   (psql/DSN/库/journal 取不到、账本 0 行、journal 空或形状坏)。
 * 密码纪律:DSN 只经 PGPASSWORD 传给子进程,绝不进 argv/日志;任何输出都不打印 DSN。
 */
import { createHash } from 'node:crypto'
import {
  existsSync,
  mkdirSync,
  readFileSync,
  realpathSync,
  writeFileSync,
} from 'node:fs'
import { dirname, isAbsolute, join, relative, resolve } from 'node:path'
import { spawnSync } from 'node:child_process'
import { fileURLToPath, pathToFileURL } from 'node:url'

import { requireFlagValue } from './lib/flag-value.mjs'
import { locatePsqlClient } from './lib/psql-client-locate.mjs'

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..')
const DEFAULT_JOURNAL = join(ROOT, 'packages/database/drizzle/meta/_journal.json')
const DEFAULT_META_DIR = join(ROOT, 'packages/database/drizzle/meta')
const DEFAULT_ENV_FILE = join(ROOT, 'apps/api/.env')
const DEFAULT_BACKUP_DIR = 'D:/DevEnv/backups'

/** journal 形状校验(DB-13):空/journal 结构坏一律「未判定」,不得读成 ok 也不得读成红。 */
export function validateJournal(journal) {
  const entries = journal?.entries
  if (!Array.isArray(entries) || entries.length === 0)
    return { ok: false, why: 'journal entries 缺失/不是数组/为空' }
  for (const e of entries) {
    if (typeof e?.tag !== 'string' || e.tag.trim() === '')
      return { ok: false, why: 'journal 条目缺 tag' }
    if (e?.when === null || e?.when === undefined || e?.when === '' || !Number.isFinite(Number(e.when)))
      return { ok: false, why: `journal 条目 ${e.tag} 的 when 不是数字` }
  }
  return { ok: true, entries }
}

/** 账本行桶(DB-15):重复 hash / 重复 when 必须看得见,而不是被 Map 去重抹平。 */
export function ledgerBuckets(applied) {
  const rows = Array.isArray(applied) ? applied.length : 0
  const hashCounts = new Map()
  const whenCounts = new Map()
  for (const a of applied ?? []) {
    const h = a?.hash ? String(a.hash) : ''
    if (h) hashCounts.set(h, (hashCounts.get(h) ?? 0) + 1)
    const raw = a?.createdAt
    if (raw !== null && raw !== undefined && raw !== '') {
      const n = Number(raw)
      if (Number.isFinite(n)) whenCounts.set(String(n), (whenCounts.get(String(n)) ?? 0) + 1)
    }
  }
  const dupHashes = [...hashCounts.values()].filter((c) => c > 1).length
  const dupWhens = [...whenCounts.values()].filter((c) => c > 1).length
  return { rows, dupHashes, dupWhens, emptyLedger: rows === 0 }
}

/** journal 在 `<drizzle>/meta/` 下,而 SQL 文件在 `<drizzle>/` —— 两者差一层,取错会把每条都读成“文件缺失”。 */
export function migrationsDirOf(journalPath) {
  return resolve(dirname(journalPath), '..')
}

/**
 * 纯判据:journal + 账本 + 文件 hash ⇒ 四桶。
 * `applied` 形如 `[{ hash, createdAt, tag? }]`(createdAt 可为 null/数字/数字字符串)。
 *
 * DB-14 归属:账本若带 tag 列,adopted 必须 tag+hash 同时命中;只有 hash 命中而 tag 不同
 * ⇒ 不得算 applied。账本未带 tag(当前 schema)时退回「when 对应文件的 sha256 与账本 hash」
 * 这一路:when 命中而 hash 不符 ⇒ hashDrift。
 */
export function classifyMigrationGaps({ journal, applied, fileHashOf }) {
  const entries = Array.isArray(journal?.entries) ? journal.entries : []
  const hashes = new Set()
  const whens = new Set()
  const tagHashes = new Map()
  let maxApplied = -Infinity
  const hasTagColumn = (applied ?? []).some((a) => typeof a?.tag === 'string' && a.tag !== '')
  for (const a of applied ?? []) {
    if (a?.hash) {
      hashes.add(String(a.hash))
      if (typeof a?.tag === 'string' && a.tag !== '') {
        if (!tagHashes.has(a.tag)) tagHashes.set(a.tag, new Set())
        tagHashes.get(a.tag).add(String(a.hash))
      }
    }
    if (a?.createdAt !== null && a?.createdAt !== undefined && a?.createdAt !== '') {
      const n = Number(a.createdAt)
      if (Number.isFinite(n)) {
        whens.add(String(n))
        if (n > maxApplied) maxApplied = n
      }
    }
  }
  if (!Number.isFinite(maxApplied)) maxApplied = 0
  const buckets = ledgerBuckets(applied)
  const out = {
    applied: [],
    hashDrift: [],
    pending: [],
    lateGap: [],
    maxApplied,
    rows: buckets.rows,
    dupHashes: buckets.dupHashes,
    dupWhens: buckets.dupWhens,
    emptyLedger: buckets.emptyLedger,
  }
  for (const e of entries) {
    const when = Number(e.when)
    const hash = fileHashOf(e)
    if (hash && hasTagColumn) {
      const owned = tagHashes.get(e.tag)
      if (owned && owned.has(hash)) out.applied.push(e)
      else if (whens.has(String(when))) out.hashDrift.push(e)
      else if (when > maxApplied) out.pending.push(e)
      else out.lateGap.push(e)
      continue
    }
    if (hash && hashes.has(hash)) out.applied.push(e)
    else if (whens.has(String(when))) out.hashDrift.push(e)
    else if (when > maxApplied) out.pending.push(e)
    else out.lateGap.push(e)
  }
  return out
}

/**
 * DB-13/DB-14 的出口判据(纯函数,便于不连库单测):
 *   · journal 形状坏 ⇒ undetermined / exit 2;
 *   · 账本 0 行 ⇒ undetermined / exit 2(「表可能建过」不能读成 ok);
 *   · lateGap 或 hashDrift > 0 ⇒ red / exit 1;
 *   · 其余 ⇒ ok / exit 0。
 */
export function evaluateGapReport({ journal, applied, fileHashOf }) {
  const jv = validateJournal(journal)
  if (!jv.ok) {
    return {
      state: 'undetermined',
      exitCode: 2,
      rows: Array.isArray(applied) ? applied.length : 0,
      reason: `journal 形状坏:${jv.why}`,
      gaps: null,
    }
  }
  const buckets = ledgerBuckets(applied)
  if (buckets.emptyLedger) {
    return {
      state: 'undetermined',
      exitCode: 2,
      rows: 0,
      reason: '账本 0 行(空账本):无法判定已应用集合,不是 ok',
      gaps: null,
    }
  }
  const gaps = classifyMigrationGaps({ journal: { entries: jv.entries }, applied, fileHashOf })
  const red = gaps.lateGap.length > 0 || gaps.hashDrift.length > 0
  return { state: red ? 'red' : 'ok', exitCode: red ? 1 : 0, rows: buckets.rows, gaps }
}

// ─── DB-12 reproduce 通道的默认安全 ────────────────────────────────────────────

/** `--repair` 默认 dry-run;只有同时给 `--apply` 才进入写路径(还需 `--yes`)。 */
export function resolveRepairMode(argv) {
  return { repair: argv.includes('--repair'), apply: argv.includes('--apply'), yes: argv.includes('--yes') }
}

/** `--journal` 必须 realpath 后落在 drizzle/meta 内,防指向任意 JSON 执行 DDL。 */
export function validateRepairJournalPath({ journalPath, metaDir = DEFAULT_META_DIR }) {
  try {
    const real = realpathSync(journalPath)
    const realMeta = realpathSync(metaDir)
    const rel = relative(realMeta, real)
    if (rel === '' || isAbsolute(rel) || rel.startsWith('..'))
      return { ok: false, why: `--journal 必须位于 ${metaDir} 内(realpath=${real})` }
    return { ok: true, realPath: real }
  } catch (e) {
    return { ok: false, why: `--journal realpath 失败:${String(e?.code ?? e)}` }
  }
}

/** DB-12:tag 必须是 14 位时间戳前缀且对应 .sql 在位;4 位历史 tag 不再允许走 repair。 */
export function validateRepairTag(tag, { fileExists } = {}) {
  if (!/^\d{14}_[A-Za-z0-9_-]+$/.test(String(tag ?? '')))
    return { ok: false, why: `tag 必须是 14 位时间戳前缀 /^\\d{14}_[A-Za-z0-9_-]+$/(实际 ${tag})` }
  if (!fileExists) return { ok: false, why: `${tag}.sql 不存在` }
  return { ok: true }
}

/** DB-15:账本插入写成 INSERT … SELECT … WHERE NOT EXISTS,不依赖表上并不存在的 UNIQUE。 */
export function buildIdempotentLedgerInsertSql(hash, when) {
  const h = String(hash ?? '').replace(/'/g, "''")
  return (
    `insert into drizzle.__drizzle_migrations(hash, created_at) ` +
    `select '${h}', ${Number(when)} ` +
    `where not exists (select 1 from drizzle.__drizzle_migrations where hash = '${h}');`
  )
}

/** DB-12:SQL 与账本写入必须同一次 `psql -1` 会话(同一事务),失败不重试。 */
export function buildRepairPsqlArgs({ file, hash, when }) {
  return [
    '-v',
    'ON_ERROR_STOP=1',
    '-1',
    '-f',
    file,
    '-c',
    buildIdempotentLedgerInsertSql(hash, when),
  ]
}

/** DSN 只许来自 env 或 env 文件的 DATABASE_URL;输出永不回显。 */
export function readDsn({ envFile = DEFAULT_ENV_FILE, env = process.env } = {}) {
  if (env.DATABASE_URL) return { ok: true, dsn: env.DATABASE_URL.trim(), from: 'env' }
  try {
    const m = readFileSync(envFile, 'utf8').match(/^DATABASE_URL=(.*)$/m)
    if (m && m[1].trim()) return { ok: true, dsn: m[1].trim(), from: envFile }
    return { ok: false, why: `${envFile} 里没有非空 DATABASE_URL` }
  } catch (e) {
    return { ok: false, why: `读不到 ${envFile}(${String(e?.code ?? e)})` }
  }
}

export function psqlArgsFromDsn(dsn) {
  let u
  try {
    u = new URL(dsn)
  } catch {
    return { ok: false, why: 'DSN 不是合法 URL' }
  }
  if (!/^postgres(ql)?:$/.test(u.protocol)) return { ok: false, why: `DSN 协议不是 postgres(${u.protocol})` }
  return {
    ok: true,
    args: ['-h', u.hostname, '-p', u.port || '5432', '-U', decodeURIComponent(u.username), '-d', u.pathname.slice(1)],
    env: { ...process.env, PGPASSWORD: decodeURIComponent(u.password) },
  }
}

function runPsql(psql, dsn, extra, { timeout = 60_000 } = {}) {
  const p = psqlArgsFromDsn(dsn)
  if (!p.ok) return { ok: false, why: p.why }
  const r = spawnSync(psql, [...p.args, ...extra], {
    encoding: 'utf8',
    timeout,
    windowsHide: true,
    stdio: ['ignore', 'pipe', 'pipe'],
    env: p.env,
    maxBuffer: 64 * 1024 * 1024,
  })
  if (r.error) return { ok: false, why: String(r.error.code ?? r.error.message) }
  if (r.status !== 0) return { ok: false, why: `psql exit=${r.status}: ${String(r.stderr ?? '').trim().slice(0, 200)}` }
  return { ok: true, stdout: String(r.stdout ?? '') }
}

function readApplied(psql, dsn) {
  const r = runPsql(psql, dsn, ['-At', '-F', '\t', '-c', 'select hash, coalesce(created_at::text, \'\') from drizzle.__drizzle_migrations;'])
  if (!r.ok) return r
  const rows = r.stdout
    .split('\n')
    .map((s) => s.trim())
    .filter(Boolean)
    .map((line) => {
      const [hash, createdAt] = line.split('\t')
      return { hash: (hash ?? '').trim(), createdAt: (createdAt ?? '').trim() }
    })
  return { ok: true, applied: rows }
}

export const __test__ = {
  classifyMigrationGaps,
  evaluateGapReport,
  validateJournal,
  ledgerBuckets,
  resolveRepairMode,
  validateRepairJournalPath,
  validateRepairTag,
  buildIdempotentLedgerInsertSql,
  buildRepairPsqlArgs,
  readDsn,
  migrationsDirOf,
}

function selfTest() {
  const checks = []
  const ok = (name, cond) => checks.push([name, !!cond])
  const journal = {
    entries: [
      { tag: 'a_applied', when: 100 },
      { tag: 'b_late', when: 200 },
      { tag: 'c_pending', when: 400 },
      { tag: 'd_drift', when: 300 },
    ],
  }
  const applied = [
    { hash: 'h-a', createdAt: 100 },
    { hash: 'h-d-old', createdAt: 300 },
    { hash: 'h-last', createdAt: 300 },
  ]
  const fileHashOf = (e) => ({ a_applied: 'h-a', b_late: 'h-b', c_pending: 'h-c', d_drift: 'h-d-new' })[e.tag]
  const r = classifyMigrationGaps({ journal, applied, fileHashOf })
  ok('S1 已应用按 hash 认', r.applied.length === 1 && r.applied[0].tag === 'a_applied')
  ok('S2 中间缺口:hash 缺 ∧ when 不在账本 ∧ ≤ maxApplied ⇒ lateGap', r.lateGap.length === 1 && r.lateGap[0].tag === 'b_late')
  ok('S3 when > maxApplied ⇒ pending(drizzle 下轮会补)', r.pending.length === 1 && r.pending[0].tag === 'c_pending')
  ok('S4 hash 漂移但 when 在账本 ⇒ hashDrift(DB-14 起算红)', r.hashDrift.length === 1 && r.hashDrift[0].tag === 'd_drift')
  ok('S5 maxApplied 取账本最大值', r.maxApplied === 300)
  const empty = classifyMigrationGaps({ journal: { entries: [] }, applied: [], fileHashOf: () => null })
  ok('S6 空 journal ⇒ 四桶全空(不静默造红)', empty.applied.length + empty.lateGap.length + empty.pending.length + empty.hashDrift.length === 0)
  let fails = 0
  for (const [name, pass] of checks) {
    if (!pass) fails++
    console.log(`${pass ? '✅' : '❌'} ${name}`)
  }
  console.log(`\n自检:${checks.length - fails} 通过 / ${fails} 失败`)
  return fails === 0 ? 0 : 1
}

function main() {
  const argv = process.argv.slice(2)
  const has = (f) => argv.includes(f)
  const opt = (f, d, noun = '路径') => {
    const r = requireFlagValue(argv, f, { noun, fallback: d })
    if (r.error) {
      console.error(`❌ 用法错:${r.error}`)
      process.exit(2)
    }
    return r.value
  }
  if (has('--self-test')) return selfTest()
  const journalPath = opt('--journal', DEFAULT_JOURNAL)
  const envFile = opt('--env-file', DEFAULT_ENV_FILE)
  const backupDir = opt('--backup-dir', process.env.IHUI_BACKUP_DIR || DEFAULT_BACKUP_DIR)
  const mode = resolveRepairMode(argv)
  const repair = mode.repair
  const json = has('--json')

  if (repair) {
    const jp = validateRepairJournalPath({ journalPath })
    if (!jp.ok) {
      console.log(`❌ 修复档拒绝启动:${jp.why}`)
      return 2
    }
  }
  let journal
  try {
    journal = JSON.parse(readFileSync(journalPath, 'utf8'))
  } catch (e) {
    console.log(`⚠️ 未判定 —— journal 读不到:${journalPath}(${String(e?.code ?? e)})`)
    console.log('GAPS-RESULT state=undetermined lateGap=0 pending=0 hashDrift=0 rows=0')
    return 2
  }
  const jv = validateJournal(journal)
  if (!jv.ok) {
    console.log(`⚠️ 未判定 —— ${jv.why}(DB-13:空/坏 journal 不能读成 ok)`)
    console.log('GAPS-RESULT state=undetermined lateGap=0 pending=0 hashDrift=0 rows=0')
    return 2
  }
  const loc = locatePsqlClient()
  if (!loc.psql) {
    console.log(`⚠️ 未判定 —— ${loc.tried.join(' | ')}`)
    console.log('GAPS-RESULT state=undetermined lateGap=0 pending=0 hashDrift=0 rows=0')
    return 2
  }
  const d = readDsn({ envFile })
  if (!d.ok) {
    console.log(`⚠️ 未判定 —— ${d.why}`)
    console.log('GAPS-RESULT state=undetermined lateGap=0 pending=0 hashDrift=0 rows=0')
    return 2
  }
  const ap = readApplied(loc.psql, d.dsn)
  if (!ap.ok) {
    console.log(`⚠️ 未判定 —— 账本读不到:${ap.why}`)
    console.log('GAPS-RESULT state=undetermined lateGap=0 pending=0 hashDrift=0 rows=0')
    return 2
  }
  const dir = migrationsDirOf(journalPath)
  const fileHashOf = (e) => {
    const f = join(dir, `${e.tag}.sql`)
    if (!existsSync(f)) return null
    return createHash('sha256').update(readFileSync(f)).digest('hex')
  }
  const verdict = evaluateGapReport({ journal, applied: ap.applied, fileHashOf })
  if (verdict.exitCode === 2) {
    console.log(`⚠️ 未判定 —— ${verdict.reason}`)
    console.log(
      `GAPS-RESULT state=undetermined lateGap=0 pending=0 hashDrift=0 rows=${verdict.rows}`,
    )
    return 2
  }
  const g = verdict.gaps

  const fmt = (list) => list.slice(0, 20).map((e) => `${e.tag}(${new Date(Number(e.when)).toISOString().slice(0, 10)})`)
  if (json) {
    console.log(
      JSON.stringify({
        state: verdict.state,
        rows: g.rows,
        applied: g.applied.length,
        pending: g.pending.map((e) => e.tag),
        lateGap: g.lateGap.map((e) => ({ tag: e.tag, when: e.when })),
        hashDrift: g.hashDrift.map((e) => e.tag),
        dupHashes: g.dupHashes,
        dupWhens: g.dupWhens,
        emptyLedger: g.emptyLedger,
        maxApplied: g.maxApplied,
      }),
    )
  } else {
    console.log(
      `应用账本: rows=${g.rows} / applied=${g.applied.length} / lateGap=${g.lateGap.length} / pending=${g.pending.length} / hashDrift=${g.hashDrift.length}${g.hashDrift.length ? '(DB-14 阻塞)' : ''}`,
    )
    if (g.lateGap.length) console.log(`  ❌ 中间缺口(drizzle 永不应用):${fmt(g.lateGap).join(', ')}`)
    if (g.pending.length) console.log(`  ⏳ 待应用(drizzle 下轮会补):${fmt(g.pending).join(', ')}`)
    if (g.hashDrift.length) console.log(`  ❌ 账本 hash 与现文件不符(DB-14 算红):${fmt(g.hashDrift).join(', ')}`)
    if (g.dupHashes || g.dupWhens) console.log(`  ⚠️ 账本重复行: dupHashes=${g.dupHashes} dupWhens=${g.dupWhens}`)
  }

  if (!repair) {
    // `--json` 契约:**只输出一行 JSON**,不再追加人读摘要 —— 调用方(守护/部署)按“最后一行”解析,
    // 多一行摘要就等于把可解析读数永远判成"未判定"(2026-10-25 实测踩中)。
    if (!json)
      console.log(
        `GAPS-RESULT state=${verdict.state} lateGap=${g.lateGap.length} pending=${g.pending.length} hashDrift=${g.hashDrift.length} rows=${g.rows}`,
      )
    return verdict.exitCode
  }

  // ── 修复档:默认 dry-run,不带 --apply 只打印计划,不碰库 ──
  if (!mode.apply) {
    console.log('🔎 DRY-RUN(未带 --apply):以下为将执行的动作,不会写库')
    for (const e of g.lateGap) {
      const file = join(dir, `${e.tag}.sql`)
      const tc = validateRepairTag(e.tag, { fileExists: existsSync(file) })
      if (!tc.ok) {
        console.log(`❌ 计划中 ${e.tag} 不合法:${tc.why} —— 修复档拒绝执行`)
        return 2
      }
      console.log(`  - 应用 ${file}`)
      console.log(`  - 账本: ${buildIdempotentLedgerInsertSql(fileHashOf(e), e.when)}`)
    }
    if (!g.lateGap.length) console.log('  (无中间缺口,无需修复)')
    else console.log('  确认执行请加: --repair --apply --yes')
    console.log(`GAPS-RESULT state=dry-run lateGap=${g.lateGap.length} rows=${g.rows}`)
    return g.lateGap.length ? 1 : 0
  }
  if (!mode.yes) {
    console.log('❌ 修复档必须显式 --yes(会在生产库执行 DDL 并写迁移账本)')
    return 2
  }
  if (!g.lateGap.length) {
    console.log('GAPS-RESULT state=ok lateGap=0(无需修复)')
    return 0
  }
  // 修复前先快照账本(小文本,回滚凭据)
  const ts = new Date().toISOString().replace(/[:.]/g, '-')
  const snap = join(backupDir, `pg-ledger-${ts}.tsv`)
  try {
    mkdirSync(backupDir, { recursive: true })
    const raw = runPsql(loc.psql, d.dsn, ['-At', '-F', '\t', '-c', 'select id, hash, coalesce(created_at::text, \'\') from drizzle.__drizzle_migrations order by id;'])
    if (!raw.ok) throw new Error(raw.why)
    writeFileSync(snap, raw.stdout)
    console.log(`账本快照:${snap}`)
  } catch (e) {
    console.log(`❌ 修复前快照失败,拒绝改写生产账本:${String(e?.message ?? e).slice(0, 160)}`)
    return 2
  }
  for (const e of g.lateGap) {
    const f = join(dir, `${e.tag}.sql`)
    const tc = validateRepairTag(e.tag, { fileExists: existsSync(f) })
    if (!tc.ok) {
      console.log(`❌ ${e.tag}:${tc.why} —— 停止(已应用的批次不回滚;快照见上)`)
      return 1
    }
    const hash = fileHashOf(e)
    if (!hash) {
      console.log(`❌ ${e.tag}:文件 hash 取不到,停止(不写空 hash 账本)`)
      return 1
    }
    // SQL 与账本写入同一次 `psql -1` 会话;失败即停,不自动重试
    const apply = runPsql(loc.psql, d.dsn, buildRepairPsqlArgs({ file: f, hash, when: e.when }))
    if (!apply.ok) {
      console.log(`❌ ${e.tag}:应用+记账事务失败,停止(${apply.why})—— 不重试,需人工排查`)
      return 1
    }
    console.log(`✅ ${e.tag}:已应用并在同一事务内补账本`)
  }
  console.log(`GAPS-RESULT state=repaired lateGap=${g.lateGap.length}`)
  return 0
}

const isDirectRun = process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href
if (isDirectRun) {
  try {
    process.exit(main())
  } catch (e) {
    console.error(`❌ ${e?.message ?? e}\n${e?.stack ?? ''}`)
    process.exit(2)
  }
}
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
