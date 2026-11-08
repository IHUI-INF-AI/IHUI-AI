#!/usr/bin/env node
// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * check-hand-migration-snapshot.mjs — 手写迁移必须同枚回写 drizzle snapshot(350,默认只读)。
 *
 * ## 立因(2026-11-07 实测,不是预防)
 * `packages/database/drizzle` 的 idx 367 / 369 是手写迁移:
 *   · 367(`20261106120000_tool_ledger_execution_facts`)建了 `tool_invocation_ledger` 四列
 *     (cwd / exit_code / output_complete / terminal_reason)与 CHECK;
 *   · 369(`20261106150000_fix_missing_indexes_fks`)建了 `withdrawal_flows_partner_trade_no_uq`
 *     等一批索引;
 * 但当时都没有回写同号 snapshot。后果:drizzle-kit generate 只拿 TS schema 对**快照**做差,
 * 这些已经建过的对象会被当成新变更反复吐出来;367 里没有 `IF NOT EXISTS`,从零库重放必撞
 * `42701 duplicate column`。0370 只能靠人工把多余语句剔掉才安全,不可持续。
 *
 * ## 判据(静态、只读、不解析完整 SQL 语义)
 * 对 journal 里每一条迁移,先算「快照号」:tag 以四位数字开头(`0038_x` → 38;时间戳 tag 如
 * `20261106120000_x` 无前缀 ⇒ 退回 journal idx)。历史 journal 的 idx 从 1 起算、tag 从 0000
 * 起算,直接用 idx 会错位一格,所以必须以 tag 前缀为准。
 * 再按快照号定位「对应 snapshot」:
 *   ① `meta/NNNN_snapshot.json` 存在 ⇒ 用它(迁移 N 执行后的权威状态);
 *   ② 不存在 ⇒ 退到 `meta/` 下**序号小于 N 的最近 snapshot**(迁移执行前的状态)。
 *      这时该迁移新增的列/索引/约束必然不在里面 ⇒ 判红 —— 这正是「手写迁移没回写 snapshot」
 *      的机读形态。缺号 snapshot 不允许靠后来的快照"追认"成绿,否则未来仍可能被 generate 重吐。
 * 迁移 SQL 里抽取四类新增对象(必需覆盖,注释/单引号字符串内的字样不算):
 *   · `ALTER TABLE … ADD COLUMN [IF NOT EXISTS] …`
 *   · `CREATE [UNIQUE] INDEX [IF NOT EXISTS] …`
 *   · `ALTER TABLE … ADD CONSTRAINT <name> …`
 * 对象在 snapshot 的判定:
 *   · 列 → 必须先定位到表(`[schema.]table`,按 `public` 优先),再查该表 `columns` 的键;
 *   · 索引/约束 → 查全表 `indexes` / `uniqueConstraints` / `foreignKeys` /
 *     `compositePrimaryKeys` / `checkConstraints` 的键;取不到再以 snapshot 原文里
 *     `"<name>":`(JSON 键形态)做兜底。
 *
 * ## 取材面(守门 118:统一走 scripts/lib/face-reader.mjs)
 *   · 默认(全量)判 **HEAD blob**;`--staged` 判**索引 blob**(pre-commit 面);
 *   · `--worktree` 是人工排查逃生舱(盘上可能带并行会话半编辑态,不得当提交门禁);
 *   · 任一被审面清单/正文取不到 ⇒ **未判定(exit 2)**,不回落另一个面冒充判过;
 *   · `--root <dir>` 只给临时夹具用:夹具没有 git,按 worktree 面读盘(单测专用)。
 *
 * ## 差值档与三态(§0.3:没判不许写成判过)
 *   · ok(exit 0):无「新增违规」(存量都已在基线里);
 *   · red(exit 1):存在基线之外的新增违规(逐条点名 文件:行 + 表/对象 + 所用 snapshot);
 *   · unjudged(exit 2):journal 读不到/解不开、被审面枚举到 0、snapshot 为空或解析失败、
 *     基线缺失/形状坏、journal 指向的 .sql 文件缺失 —— 一律点名原因,**不折成红也不折成绿**。
 * 基线只由人看读数后 `--write-baseline` 显式认账;`--check` 是零写盘路径。
 * §12e:存量未归零前本尺不挂提交链,建议以 warn-only 接入守护;`--check` 的退出码供人工/CI 定点使用。
 *
 * ## 用法
 *   node scripts/check-hand-migration-snapshot.mjs                  # 默认 --check(HEAD 面,只读)
 *   node scripts/check-hand-migration-snapshot.mjs --check --staged   # pre-commit / 索引面
 *   node scripts/check-hand-migration-snapshot.mjs --check --strict   # 全量:缺同号快照即 exit 1
 *   node scripts/check-hand-migration-snapshot.mjs --check --strict-changed --base <ref>  # 仅新增/改动
 *   node scripts/check-hand-migration-snapshot.mjs --write-baseline   # 人核后认账存量(写基线)
 *   node scripts/check-hand-migration-snapshot.mjs --list-stock       # 连存量逐条列出
 *   node scripts/check-hand-migration-snapshot.mjs --json             # 末行追加机读结论
 *   --root <dir>      被测仓库根(默认脚本上两级;测试夹具用)
 *   --baseline <path> 基线路径(默认 <repo>/scripts/data/hand-migration-snapshot-baseline.json)
 * 退出码:0=ok;1=有新增违规;2=未判定。
 */
import { spawnSync } from 'node:child_process'
import { readdirSync, writeFileSync } from 'node:fs'
import { basename, dirname, join, resolve } from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'

import {
  Undetermined,
  catBatch,
  listFaceFiles,
  readWorktreeFile,
  selectFace,
} from './lib/face-reader.mjs'

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..')
export const GATE = 'check-hand-migration-snapshot.mjs'
export const GATE_ID = '350'
export const MIGRATIONS_DIR_REL = 'packages/database/drizzle'
export const JOURNAL_REL = 'meta/_journal.json'
export const SNAPSHOT_SUBDIR = 'meta'
export const DEFAULT_BASELINE_REL = 'scripts/data/hand-migration-snapshot-baseline.json'
const SCHEMA_VERSION = 1
const CAT_OPTS = { timeout: 120000, maxBuffer: 1 << 29 }

/** 未判定专用异常:调用方折成 exit 2,不记绿也不冒红(与取材层同义)。 */
export const Unjudged = Undetermined

const IDENT = `("(?:[^"]|"")+"|[A-Za-z_][A-Za-z0-9_$]*)`
const TABLE_REF_RE = `(${IDENT}(?:\\s*\\.\\s*${IDENT})?)`

function unquote(s) {
  const t = String(s).trim()
  if (t.startsWith('"') && t.endsWith('"')) return t.slice(1, -1).replace(/""/g, '"')
  return t
}

/** 表引用 → { schema:string|null, table:string }。`public.t` / `"public"."t"` / `t` 都吃。 */
export function parseTableRef(ref) {
  const parts = String(ref)
    .split('.')
    .map((p) => unquote(p.trim()))
    .filter(Boolean)
  if (parts.length === 0) return { schema: null, table: '' }
  return {
    schema: parts.length > 1 ? parts[parts.length - 2] : null,
    table: parts[parts.length - 1],
  }
}

/**
 * 把 SQL 里的注释与单引号字符串替换为等长空白(换行保留),使匹配下标仍可映射回原始行号。
 * 双引号是标识符,必须保留;`DO $$ … $$` 里的 DDL 在 dollar-quoted 体内,也不许抹掉。
 * @returns {string} 与入参等长的掩码文本
 */
export function maskSql(text) {
  const src = String(text ?? '')
  let out = ''
  let i = 0
  const n = src.length
  while (i < n) {
    const ch = src[i]
    const nx = src[i + 1]
    if (ch === '-' && nx === '-') {
      while (i < n && src[i] !== '\n') {
        out += ' '
        i++
      }
    } else if (ch === '/' && nx === '*') {
      out += '  '
      i += 2
      while (i < n && !(src[i] === '*' && src[i + 1] === '/')) {
        out += src[i] === '\n' ? '\n' : ' '
        i++
      }
      if (i < n) {
        out += '  '
        i += 2
      }
    } else if (ch === "'") {
      out += ' '
      i++
      while (i < n) {
        if (src[i] === "'") {
          if (src[i + 1] === "'") {
            out += '  '
            i += 2
            continue
          }
          out += ' '
          i++
          break
        }
        out += src[i] === '\n' ? '\n' : ' '
        i++
      }
    } else {
      out += ch
      i++
    }
  }
  return out
}

function lineStartsOf(text) {
  const starts = [0]
  for (let i = 0; i < text.length; i++) if (text[i] === '\n') starts.push(i + 1)
  return starts
}

function lineAt(starts, index) {
  let lo = 0
  let hi = starts.length - 1
  while (lo <= hi) {
    const mid = (lo + hi) >> 1
    if (starts[mid] <= index) lo = mid + 1
    else hi = mid - 1
  }
  return lo // 1-based
}

/**
 * 纯函数:从一份迁移 SQL 抽新增对象。
 * @returns {Array<{kind:'column'|'index'|'constraint',table:string,schema?:string,object:string,line:number}>}
 */
export function extractAddedObjects(sqlText) {
  const masked = maskSql(sqlText)
  const starts = lineStartsOf(masked)
  const out = []

  // ALTER TABLE 位置(供 ADD COLUMN / ADD CONSTRAINT 归属)
  const alters = []
  const alterRe = new RegExp(`\\bALTER\\s+TABLE\\s+(?:IF\\s+EXISTS\\s+)?${TABLE_REF_RE}`, 'gi')
  for (const m of masked.matchAll(alterRe)) {
    alters.push({ index: m.index, end: m.index + m[0].length, ref: parseTableRef(m[1]) })
  }

  const ownerOf = (idx) => {
    let owner = null
    for (const a of alters) {
      if (a.end > idx) break
      // 两条 ALTER TABLE 之间有分号 ⇒ 当前动作不属于任何一条
      owner = masked.slice(a.end, idx).includes(';') ? null : a
    }
    return owner
  }

  const addColRe = new RegExp(`\\bADD\\s+COLUMN\\s+(?:IF\\s+NOT\\s+EXISTS\\s+)?${IDENT}`, 'gi')
  for (const m of masked.matchAll(addColRe)) {
    const owner = ownerOf(m.index)
    if (!owner) continue
    out.push({
      kind: 'column',
      table: owner.ref.table,
      schema: owner.ref.schema,
      object: unquote(m[1]),
      line: lineAt(starts, m.index),
    })
  }

  const addConRe = new RegExp(`\\bADD\\s+CONSTRAINT\\s+${IDENT}`, 'gi')
  for (const m of masked.matchAll(addConRe)) {
    const owner = ownerOf(m.index)
    if (!owner) continue
    out.push({
      kind: 'constraint',
      table: owner.ref.table,
      schema: owner.ref.schema,
      object: unquote(m[1]),
      line: lineAt(starts, m.index),
    })
  }

  const createIdxRe = new RegExp(
    `\\bCREATE\\s+(UNIQUE\\s+)?INDEX\\s+(?:IF\\s+NOT\\s+EXISTS\\s+)?(${IDENT}(?:\\s*\\.\\s*${IDENT})?)`,
    'gi',
  )
  for (const m of masked.matchAll(createIdxRe)) {
    const ref = parseTableRef(m[2])
    out.push({
      kind: 'index',
      table: '',
      schema: ref.schema,
      object: ref.table,
      line: lineAt(starts, m.index),
    })
  }

  // 去重(同名同表同 kind 只留最早一行);保证确定性
  const seen = new Set()
  const deduped = []
  for (const o of out) {
    const key = `${o.kind}|${o.schema ?? ''}|${o.table}|${o.object}`
    if (seen.has(key)) continue
    seen.add(key)
    deduped.push(o)
  }
  return deduped.sort(
    (a, b) => a.line - b.line || a.kind.localeCompare(b.kind) || a.object.localeCompare(b.object),
  )
}

/**
 * 纯函数:快照号取迁移 tag 的四位前缀(`0038_missing_tables` → 38),没有前缀(时间戳 tag)
 * 才退回 journal idx。历史 journal 的 idx 从 1 起算而 tag 从 0000 起算,直接用 idx 会错位一格。
 */
export function migrationNumberOf(tag, idx) {
  const m = /^(\d{4})_/.exec(String(tag ?? ''))
  return m ? Number(m[1]) : Number(idx)
}

/** `meta/NNNN_snapshot.json` → NNNN;不是快照名返回 null。 */
export function snapshotIdxOf(filename) {
  const m = /^(\d{4})_snapshot\.json$/i.exec(String(filename ?? ''))
  return m ? Number(m[1]) : null
}

/**
 * 纯函数:迁移快照号 N 的「对应 snapshot」= 同号快照;缺失则取小于 N 的最近一枚。
 * 无对应快照(null)由调用方记未判定。
 */
export function resolveSnapshotIdx(snapshotIdxs, migrationIdx) {
  const sorted = [...new Set(snapshotIdxs)].filter((x) => Number.isInteger(x)).sort((a, b) => a - b)
  if (sorted.length === 0) return null
  if (sorted.includes(migrationIdx)) return migrationIdx
  let best = null
  for (const idx of sorted) if (idx < migrationIdx) best = idx
  return best
}

/** DB-09:从 `git diff --name-only` 输出里只取 drizzle 顶层的 .sql(meta/ 与子目录不算)。 */
export function changedMigrationFiles(diffText) {
  const out = []
  for (const raw of String(diffText ?? '').split(/\r?\n/)) {
    const line = raw.trim().replace(/^\.\//, '')
    const m = /^packages\/database\/drizzle\/([^/]+\.sql)$/.exec(line)
    if (m && !out.includes(m[1])) out.push(m[1])
  }
  return out
}

/** DB-09:全量 strict —— 任一 journal 迁移缺「同号」snapshot 即违规(不看基线认账)。 */
export function strictMissingSnapshotViolations({ journalEntries, snapshotIdxs }) {
  const have = new Set(snapshotIdxs ?? [])
  const out = []
  for (const e of journalEntries ?? []) {
    const n = migrationNumberOf(e?.tag, e?.idx)
    if (have.has(n)) continue
    out.push({
      tag: e.tag,
      expectedSnapshot: n,
      reason: `缺少同号快照 meta/${String(n).padStart(4, '0')}_snapshot.json`,
    })
  }
  return out
}

/** DB-09:changed 档 —— 只对新增/改动的迁移强制同号快照,存量缺号不在此档射程。 */
export function evaluateStrictChanged({ journalEntries, changedSqlNames, snapshotIdxs }) {
  const changed = new Set(changedSqlNames ?? [])
  const have = new Set(snapshotIdxs ?? [])
  const violations = []
  for (const e of journalEntries ?? []) {
    const sqlName = `${e.tag}.sql`
    if (!changed.has(sqlName)) continue
    const n = migrationNumberOf(e.tag, e.idx)
    if (have.has(n)) continue
    violations.push({
      tag: e.tag,
      expectedSnapshot: n,
      reason: `改动/新增的 ${sqlName} 缺少同号快照 meta/${String(n).padStart(4, '0')}_snapshot.json`,
    })
  }
  return { ok: violations.length === 0, violations }
}

function gitDiffNames(args) {
  const r = spawnSync('git', args, { cwd: ROOT, encoding: 'utf8', timeout: 60_000 })
  if (r.status !== 0) throw new Unjudged(`git diff 失败:${String(r.stderr ?? '').trim().slice(0, 160)}`)
  return r.stdout ?? ''
}

/**
 * DB-09:取「新增/改动」的迁移 .sql 列表。CI 用 `--base <ref>`(PR base / push before);
 * 本地不带 base 时合并 索引面 + 工作树面 + 未跟踪文件,避免新增迁移漏审。
 */
export function changedMigrationsFromGit({ base = '' } = {}) {
  if (base)
    return changedMigrationFiles(
      gitDiffNames(['diff', '--name-only', '--diff-filter=AM', '--no-renames', `${base}...HEAD`]),
    )
  const names = [
    gitDiffNames(['diff', '--name-only', '--diff-filter=AM', '--no-renames', '--cached']),
    gitDiffNames(['diff', '--name-only', '--diff-filter=AM', '--no-renames']),
    gitDiffNames(['ls-files', '--others', '--exclude-standard']),
  ].join('\n')
  return changedMigrationFiles(names)
}

function tableKeyOf(keys, table, schema) {
  if (schema) {
    const exact = keys.find((k) => k === `${schema}.${table}`)
    if (exact) return exact
  }
  const cands = keys.filter((k) => k === table || k.endsWith(`.${table}`))
  if (cands.length === 0) return null
  const pub = cands.find((k) => k.startsWith('public.'))
  return pub ?? [...cands].sort()[0]
}

const CONSTRAINT_MAPS = [
  'checkConstraints',
  'uniqueConstraints',
  'foreignKeys',
  'compositePrimaryKeys',
  'indexes',
]

/**
 * 纯函数:对象是否在给定 snapshot 里。
 * @param {object} snapshot 已解析的快照 JSON
 * @param {object} obj extractAddedObjects 的单条
 * @param {string} snapshotText 快照原文(约束/索引名的 JSON 键兜底)
 * @returns {{present:boolean, why:string}}
 */
export function snapshotHasObject(snapshot, obj, snapshotText) {
  const tables = snapshot?.tables && typeof snapshot.tables === 'object' ? snapshot.tables : null
  if (!tables) return { present: false, why: 'snapshot 缺 tables 字段' }
  const keys = Object.keys(tables)
  if (obj.kind === 'column') {
    const tk = tableKeyOf(keys, obj.table, obj.schema)
    if (!tk) return { present: false, why: `表 ${obj.table} 不在 snapshot` }
    const cols = tables[tk]?.columns
    if (!cols || typeof cols !== 'object')
      return { present: false, why: `表 ${obj.table} 无 columns` }
    return Object.prototype.hasOwnProperty.call(cols, obj.object)
      ? { present: true, why: '' }
      : { present: false, why: `表 ${tk} 缺列 ${obj.object}` }
  }
  // 索引/约束:名字在 snapshot 里是 JSON 键(全表范围)
  for (const tk of keys) {
    for (const mapName of CONSTRAINT_MAPS) {
      const map = tables[tk]?.[mapName]
      if (map && typeof map === 'object' && Object.prototype.hasOwnProperty.call(map, obj.object)) {
        return { present: true, why: '' }
      }
    }
  }
  if (typeof snapshotText === 'string') {
    const escaped = obj.object.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
    if (new RegExp(`"${escaped}"\\s*:`).test(snapshotText)) return { present: true, why: '' }
  }
  return { present: false, why: `${obj.kind} ${obj.object} 不在 snapshot` }
}

// ─── 取材:HEAD / 索引 / 工作树 三面 + 临时夹具盘面 ───────────────────────────────

function journalRelOf() {
  return `${MIGRATIONS_DIR_REL}/${JOURNAL_REL}`
}

function snapshotRelOf(idx) {
  return `${MIGRATIONS_DIR_REL}/${SNAPSHOT_SUBDIR}/${String(idx).padStart(4, '0')}_snapshot.json`
}

function normalizeRel(p) {
  return String(p).replaceAll('\\', '/')
}

/** 夹具盘面(无 git):目录按 fs 枚举,正文走 readWorktreeFile(取材层入口)。 */
function loadFixtureFace(root) {
  const dir = join(root, MIGRATIONS_DIR_REL)
  const metaDir = join(dir, SNAPSHOT_SUBDIR)
  let topEntries
  let metaEntries
  try {
    topEntries = readdirSync(dir, { withFileTypes: true })
    metaEntries = readdirSync(metaDir, { withFileTypes: true })
  } catch (e) {
    throw new Unjudged(
      `夹具迁移目录枚举失败:${dir} / ${metaDir}(${String(e?.message ?? e).slice(0, 120)})`,
    )
  }
  const read = (rel) => {
    const text = readWorktreeFile(root, rel)
    if (text === null) throw new Unjudged(`夹具文件读不到:${rel}`)
    return text
  }
  const sqlTexts = new Map()
  for (const d of topEntries)
    if (d.isFile() && d.name.endsWith('.sql'))
      sqlTexts.set(d.name, read(`${MIGRATIONS_DIR_REL}/${d.name}`))
  const snapshotTexts = new Map()
  for (const d of metaEntries) {
    const idx = d.isFile() ? snapshotIdxOf(d.name) : null
    if (idx !== null) snapshotTexts.set(idx, read(snapshotRelOf(idx)))
  }
  const journalPath = journalRelOf()
  let journalText
  try {
    journalText = read(journalPath)
  } catch (e) {
    throw new Unjudged(
      `夹具 journal 读不到:${journalPath}(${String(e?.message ?? e).slice(0, 120)})`,
    )
  }
  return { journalText, sqlTexts, snapshotTexts }
}

/** git 三面(HEAD / 索引 / 工作树):清单与正文同面同轮,取不到即未判定。 */
function loadGitFace(root, face) {
  let listed
  try {
    listed = listFaceFiles(root, face, { paths: [MIGRATIONS_DIR_REL] })
  } catch (e) {
    throw new Unjudged(`${face} 面清单取不到(${String(e?.message ?? e).slice(0, 160)})`)
  }
  const rels = [...new Set(listed.map(normalizeRel))].filter((p) => {
    if (!p.startsWith(`${MIGRATIONS_DIR_REL}/`)) return false
    const rel = p.slice(MIGRATIONS_DIR_REL.length + 1)
    if (rel === JOURNAL_REL) return true
    if (rel.startsWith(`${SNAPSHOT_SUBDIR}/`) && snapshotIdxOf(basename(rel)) !== null) return true
    return !rel.includes('/') && rel.endsWith('.sql')
  })
  if (rels.length === 0)
    throw new Unjudged(`${face} 面 ${MIGRATIONS_DIR_REL} 下一个迁移/snapshot 都没枚举到`)

  const texts = new Map()
  if (face === 'worktree') {
    for (const rel of rels) {
      const text = readWorktreeFile(root, rel)
      if (text !== null) texts.set(rel, text)
    }
  } else {
    const specs = rels.map((p) => (face === 'staged' ? `:${p}` : `HEAD:${p}`))
    let got
    try {
      got = catBatch(root, specs, CAT_OPTS)
    } catch (e) {
      throw new Unjudged(`${face} 面正文取不到(${String(e?.message ?? e).slice(0, 160)})`)
    }
    rels.forEach((rel, i) => {
      const text = got.get(specs[i])
      if (typeof text === 'string') texts.set(rel, text)
    })
  }
  const unreadable = rels.filter((rel) => !texts.has(rel))
  if (unreadable.length > 0) {
    throw new Unjudged(
      `${face} 面有 ${unreadable.length} 个文件取不到(首:${unreadable[0]});不回落另一个面冒充判过`,
    )
  }

  const journalPath = journalRelOf()
  const journalText = texts.get(journalPath)
  if (typeof journalText !== 'string') throw new Unjudged(`${face} 面缺 journal:${journalPath}`)
  const sqlTexts = new Map()
  for (const [rel, text] of texts) {
    if (rel.endsWith('.sql') && !rel.slice(MIGRATIONS_DIR_REL.length + 1).includes('/')) {
      sqlTexts.set(basename(rel), text)
    }
  }
  const snapshotTexts = new Map()
  for (const [rel, text] of texts) {
    const idx = rel.startsWith(`${MIGRATIONS_DIR_REL}/${SNAPSHOT_SUBDIR}/`)
      ? snapshotIdxOf(basename(rel))
      : null
    if (idx !== null) snapshotTexts.set(idx, text)
  }
  return { journalText, sqlTexts, snapshotTexts }
}

function loadFace({ root, face, fixture }) {
  return fixture ? loadFixtureFace(root) : loadGitFace(root, face)
}

/**
 * 纯函数:用已取到的三份正文跑判据。任何形状坏/空集 ⇒ 抛 Unjudged(不记绿也不冒红)。
 * @returns {{migrations:number, snapshots:number, handWritten:number, violations:Array}}
 */
export function judgeMigrations({ journalText, sqlTexts, snapshotTexts }) {
  let journal
  try {
    journal = JSON.parse(journalText)
  } catch (e) {
    throw new Unjudged(`journal 不是合法 JSON(${String(e?.message ?? e).slice(0, 120)})`)
  }
  const journalEntries = Array.isArray(journal?.entries) ? journal.entries : null
  if (!journalEntries || journalEntries.length === 0) {
    throw new Unjudged('journal entries 缺失或不可能是空数组')
  }
  if (!(sqlTexts instanceof Map) || sqlTexts.size === 0) throw new Unjudged('迁移 SQL 集为空')
  if (!(snapshotTexts instanceof Map) || snapshotTexts.size === 0) {
    throw new Unjudged(`meta 下枚举到 0 个 snapshot(${SNAPSHOT_SUBDIR})`)
  }

  const snapshotCache = new Map()
  const snapshotOf = (idx) => {
    if (!snapshotCache.has(idx)) {
      const text = snapshotTexts.get(idx)
      if (typeof text !== 'string')
        throw new Unjudged(`snapshot ${String(idx).padStart(4, '0')} 正文不在被审面`)
      let parsed
      try {
        parsed = JSON.parse(text)
      } catch (e) {
        throw new Unjudged(
          `snapshot ${String(idx).padStart(4, '0')} 不是合法 JSON(${String(e?.message ?? e).slice(0, 120)})`,
        )
      }
      snapshotCache.set(idx, { text, parsed })
    }
    return snapshotCache.get(idx)
  }

  const snapIdxs = [...snapshotTexts.keys()]
  const violations = []
  let handWritten = 0
  for (const e of journalEntries) {
    const tag = typeof e?.tag === 'string' ? e.tag : null
    const idx = Number.isInteger(e?.idx) ? e.idx : Number(e?.idx)
    if (!tag || !Number.isFinite(idx))
      throw new Unjudged(`journal 条目形状坏(缺 tag/idx):${JSON.stringify(e)}`)
    const sqlName = `${tag}.sql`
    const sql = sqlTexts.get(sqlName)
    if (typeof sql !== 'string') throw new Unjudged(`journal tag 指向的 .sql 不在被审面:${sqlName}`)

    const number = migrationNumberOf(tag, idx)
    const exact = snapIdxs.includes(number)
    if (!exact) handWritten += 1
    const snapIdx = resolveSnapshotIdx(snapIdxs, number)
    if (snapIdx === null)
      throw new Unjudged(`迁移 ${tag}(快照号 ${number}) 之前没有任何 snapshot,无法定位对应快照`)
    const snap = snapshotOf(snapIdx)
    for (const obj of extractAddedObjects(sql)) {
      const r = snapshotHasObject(snap.parsed, obj, snap.text)
      if (r.present) continue
      violations.push({
        tag,
        migrationIdx: idx,
        migrationNo: number,
        file: `${MIGRATIONS_DIR_REL}/${sqlName}`,
        line: obj.line,
        kind: obj.kind,
        table: obj.kind === 'index' ? '-' : obj.table,
        object: obj.object,
        snapshotIdx: snapIdx,
        snapshotExact: exact,
        reason: r.why,
      })
    }
  }
  violations.sort(
    (a, b) =>
      a.file.localeCompare(b.file) ||
      a.line - b.line ||
      a.kind.localeCompare(b.kind) ||
      a.object.localeCompare(b.object),
  )
  return {
    migrations: journalEntries.length,
    snapshots: snapIdxs.length,
    handWritten,
    violations,
    journalEntries,
    snapshotIdxs: snapIdxs,
    missingSnapshotTags: strictMissingSnapshotViolations({ journalEntries, snapshotIdxs: snapIdxs }),
  }
}

export const baselineKeyOf = (v) => `${v.tag}|${v.kind}|${v.table}|${v.object}`

/** 读取基线正文(已由取材层按面取到;null ⇒ 未判定)。 */
export function parseBaseline(text, label = 'baseline') {
  if (typeof text !== 'string') throw new Unjudged(`基线缺失(未判定):${label}`)
  let parsed
  try {
    parsed = JSON.parse(text)
  } catch (e) {
    throw new Unjudged(`基线不是合法 JSON:${label}(${String(e?.message ?? e).slice(0, 120)})`)
  }
  if (!Array.isArray(parsed?.entries)) throw new Unjudged(`基线 entries 不是数组:${label}`)
  if (parsed.entries.some((x) => typeof x !== 'string'))
    throw new Unjudged(`基线 entries 含非字符串项:${label}`)
  return new Set(parsed.entries)
}

/** 基线写入(确定性:排序 + 固定键序 + 末尾换行;无时间戳)。 */
export function serializeBaseline(violations) {
  const entries = [...new Set(violations.map(baselineKeyOf))].sort()
  const doc = {
    gate: GATE,
    gateId: GATE_ID,
    schemaVersion: SCHEMA_VERSION,
    rule:
      '迁移 N 的对应 snapshot = meta/NNNN_snapshot.json;缺失则取序号小于 N 的最近 snapshot。' +
      '该迁移新增的列/索引/约束必须存在于对应 snapshot。',
    entries,
  }
  return `${JSON.stringify(doc, null, 2)}\n`
}

export function formatStateLine(r) {
  return (
    `HAND-MIGRATION-SNAPSHOT state=${r.state} migrations=${r.migrations} snapshots=${r.snapshots} ` +
    `noExactSnapshot=${r.handWritten} violations=${r.violations} stock=${r.stock} new=${r.new} ` +
    `baseline=${r.baselineState}`
  )
}

function toRepoRel(root, abs) {
  const norm = (p) => resolve(p).replaceAll('\\', '/')
  const r = norm(root)
  const a = norm(abs)
  if (a === r) throw new Unjudged(`路径指向仓库根而不是文件:${abs}`)
  const prefix = `${r}/`
  if (!a.startsWith(prefix)) throw new Unjudged(`基线不在仓库内:${abs}`)
  return a.slice(prefix.length)
}

/** 基线也走同一个面(HEAD/索引/工作树);夹具走盘面。 */
function loadBaselineText({ root, face, fixture, baselineAbs }) {
  if (fixture) return readWorktreeFile(dirname(baselineAbs), basename(baselineAbs))
  const rel = toRepoRel(root, baselineAbs)
  if (face === 'worktree') return readWorktreeFile(root, rel)
  const spec = face === 'staged' ? `:${rel}` : `HEAD:${rel}`
  let got
  try {
    got = catBatch(root, [spec], CAT_OPTS)
  } catch (e) {
    throw new Unjudged(`基线取不到(${face} 面 ${rel}):${String(e?.message ?? e).slice(0, 160)}`)
  }
  return got.get(spec) ?? null
}

function parseArgs(argv) {
  const opts = {
    check: true,
    writeBaseline: false,
    listStock: false,
    json: false,
    staged: false,
    worktree: false,
    strict: false,
    strictChanged: false,
    base: '',
    root: ROOT,
    baseline: join(ROOT, DEFAULT_BASELINE_REL),
  }
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i]
    if (a === '--check') opts.check = true
    else if (a === '--strict') opts.strict = true
    else if (a === '--strict-changed') opts.strictChanged = true
    else if (a === '--base') {
      const v = argv[++i]
      if (!v) throw new Unjudged('--base 缺少 git ref 值')
      opts.base = v
    } else if (a === '--write-baseline') {
      opts.writeBaseline = true
      opts.check = false
    } else if (a === '--list-stock') opts.listStock = true
    else if (a === '--json') opts.json = true
    else if (a === '--staged') opts.staged = true
    else if (a === '--worktree') opts.worktree = true
    else if (a === '--root') {
      const v = argv[++i]
      if (!v) throw new Unjudged('--root 缺少路径值')
      opts.root = resolve(v)
    } else if (a === '--baseline') {
      const v = argv[++i]
      if (!v) throw new Unjudged('--baseline 缺少路径值')
      opts.baseline = resolve(v)
    } else {
      throw new Unjudged(`未知参数:${a}`)
    }
  }
  if ((opts.strict || opts.strictChanged) && opts.writeBaseline)
    throw new Unjudged('--strict/--strict-changed 是门禁档,不能与 --write-baseline 同用')
  return opts
}

function main(argv) {
  let opts
  try {
    opts = parseArgs(argv)
  } catch (e) {
    console.error(`[${GATE}] ❌ ${e.message}`)
    console.error(
      '用法: node scripts/check-hand-migration-snapshot.mjs [--check|--write-baseline] [--staged|--worktree] [--list-stock] [--json] [--root <dir>] [--baseline <path>]',
    )
    return 2
  }

  const fixture = opts.root !== ROOT
  let face
  if (fixture) face = 'worktree'
  else {
    const picked = selectFace({ staged: opts.staged, worktree: opts.worktree, def: 'head' })
    if (picked.face === null) {
      console.error(`  未判定:${picked.error}`)
      console.info(
        formatStateLine({
          state: 'unjudged',
          migrations: 0,
          snapshots: 0,
          handWritten: 0,
          violations: 0,
          stock: 0,
          new: 0,
          baselineState: 'unread',
        }),
      )
      return 2
    }
    face = picked.face
  }
  const faceNote = fixture ? `夹具盘面(${opts.root})` : `${face} 面`

  let judged
  try {
    judged = judgeMigrations(loadFace({ root: opts.root, face, fixture }))
  } catch (e) {
    if (!(e instanceof Undetermined)) throw e
    const result = {
      state: 'unjudged',
      migrations: 0,
      snapshots: 0,
      handWritten: 0,
      violations: 0,
      stock: 0,
      new: 0,
      baselineState: 'unread',
    }
    console.error(`  未判定[${faceNote}]:${e.message}`)
    if (opts.json)
      console.info(
        JSON.stringify({ gate: GATE, gateId: GATE_ID, face, reason: e.message, ...result }),
      )
    console.info(formatStateLine(result))
    return 2
  }

  if (opts.strict || opts.strictChanged) {
    let violations
    try {
      if (opts.strict) {
        violations = strictMissingSnapshotViolations({
          journalEntries: judged.journalEntries,
          snapshotIdxs: judged.snapshotIdxs,
        })
      } else {
        if (fixture) throw new Unjudged('夹具无 git 面,不支持 --strict-changed(--root 仅单测)')
        const changedSqlNames = changedMigrationsFromGit({ base: opts.base })
        violations = evaluateStrictChanged({
          journalEntries: judged.journalEntries,
          changedSqlNames,
          snapshotIdxs: judged.snapshotIdxs,
        }).violations
      }
    } catch (e) {
      if (!(e instanceof Undetermined)) throw e
      console.error(`  未判定[${faceNote}]:${e.message}`)
      const result = {
        state: 'unjudged',
        migrations: judged.migrations,
        snapshots: judged.snapshots,
        handWritten: judged.handWritten,
        violations: judged.violations.length,
        stock: 0,
        new: 0,
        baselineState: 'unread',
      }
      if (opts.json)
        console.info(
          JSON.stringify({ gate: GATE, gateId: GATE_ID, face, reason: e.message, ...result }),
        )
      console.info(formatStateLine(result))
      return 2
    }
    for (const v of violations)
      console.warn(`  ❌ strict: ${v.tag} ${v.reason}(期望快照号 ${v.expectedSnapshot})`)
    const result = {
      state: violations.length > 0 ? 'red' : 'ok',
      migrations: judged.migrations,
      snapshots: judged.snapshots,
      handWritten: judged.handWritten,
      violations: judged.violations.length,
      stock: 0,
      new: violations.length,
      baselineState: opts.strict ? 'strict' : 'strict-changed',
    }
    if (opts.json)
      console.info(JSON.stringify({ gate: GATE, gateId: GATE_ID, face, ...result, strict: violations }))
    console.info(formatStateLine(result))
    return violations.length > 0 ? 1 : 0
  }

  if (opts.writeBaseline) {
    try {
      writeFileSync(opts.baseline, serializeBaseline(judged.violations), 'utf8')
    } catch (e) {
      console.error(`  未判定:基线写入失败:${opts.baseline}(${String(e?.code ?? e).slice(0, 80)})`)
      console.info(
        formatStateLine({
          ...judged,
          violations: judged.violations.length,
          stock: 0,
          new: 0,
          baselineState: 'write-failed',
        }),
      )
      return 2
    }
    const unique = new Set(judged.violations.map(baselineKeyOf)).size
    console.info(`ℹ 已写基线:${opts.baseline}(存量 ${unique} 条,取自 ${faceNote})`)
    for (const v of judged.violations) printViolation(v, 'stock')
    const result = {
      state: 'ok',
      migrations: judged.migrations,
      snapshots: judged.snapshots,
      handWritten: judged.handWritten,
      violations: judged.violations.length,
      stock: unique,
      new: 0,
      baselineState: 'written',
    }
    if (opts.json) console.info(JSON.stringify({ gate: GATE, gateId: GATE_ID, face, ...result }))
    console.info(formatStateLine(result))
    return 0
  }

  let baseline
  try {
    baseline = parseBaseline(
      loadBaselineText({ root: opts.root, face, fixture, baselineAbs: opts.baseline }),
      opts.baseline,
    )
  } catch (e) {
    if (!(e instanceof Undetermined)) throw e
    const result = {
      state: 'unjudged',
      migrations: judged.migrations,
      snapshots: judged.snapshots,
      handWritten: judged.handWritten,
      violations: judged.violations.length,
      stock: 0,
      new: 0,
      baselineState: 'unread',
    }
    console.error(`  未判定[${faceNote}]:${e.message}`)
    if (opts.json)
      console.info(
        JSON.stringify({ gate: GATE, gateId: GATE_ID, face, reason: e.message, ...result }),
      )
    console.info(formatStateLine(result))
    return 2
  }

  const fresh = []
  let stock = 0
  for (const v of judged.violations) {
    if (baseline.has(baselineKeyOf(v))) stock += 1
    else fresh.push(v)
  }
  for (const v of fresh) printViolation(v, 'new')
  if (opts.listStock) {
    for (const v of judged.violations)
      if (baseline.has(baselineKeyOf(v))) printViolation(v, 'stock')
  } else if (stock > 0) {
    console.info(`ℹ 存量违规 ${stock} 条(只报数;逐条出账加 --list-stock,认账加 --write-baseline)`)
  }

  const result = {
    state: fresh.length > 0 ? 'red' : 'ok',
    migrations: judged.migrations,
    snapshots: judged.snapshots,
    handWritten: judged.handWritten,
    violations: judged.violations.length,
    stock,
    new: fresh.length,
    baselineState: 'read',
  }
  if (opts.json)
    console.info(JSON.stringify({ gate: GATE, gateId: GATE_ID, face, ...result, fresh }))
  console.info(formatStateLine(result))
  return result.state === 'ok' ? 0 : 1
}

function printViolation(v, bucket) {
  const marker = bucket === 'new' ? '❌ 新增违规' : 'ℹ 存量违规'
  const snap = v.snapshotExact ? `${v.snapshotIdx} 同号` : `${v.snapshotIdx} 前序`
  const target = v.kind === 'column' ? `${v.table}.${v.object}` : v.object
  console.warn(
    `  ${marker}:${v.file}:${v.line} [${v.kind}] ${target} — snapshot ${snap}:${v.reason}`,
  )
}

const isDirectRun = process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href
if (isDirectRun) {
  try {
    process.exitCode = main(process.argv.slice(2))
  } catch (e) {
    console.error(`[${GATE}] ❌ 尺子自身异常(未判定):${e?.stack ?? e}`)
    process.exitCode = 2
  }
}

export const __test__ = {
  GATE,
  GATE_ID,
  MIGRATIONS_DIR_REL,
  JOURNAL_REL,
  DEFAULT_BASELINE_REL,
  Unjudged,
  parseTableRef,
  maskSql,
  extractAddedObjects,
  migrationNumberOf,
  snapshotIdxOf,
  resolveSnapshotIdx,
  snapshotHasObject,
  judgeMigrations,
  changedMigrationFiles,
  strictMissingSnapshotViolations,
  evaluateStrictChanged,
  changedMigrationsFromGit,
  baselineKeyOf,
  parseBaseline,
  serializeBaseline,
  formatStateLine,
  main,
}
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
