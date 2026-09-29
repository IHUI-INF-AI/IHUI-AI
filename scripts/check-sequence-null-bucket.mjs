#!/usr/bin/env node
// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

// scripts/check-sequence-null-bucket.mjs
/**
 * 守门:可空排序列的"新 NULL 产不出来"兜底(G-817,2026-09-29 立)。
 *
 * 票面判据(逐字):「有回填型迁移给某可空列补号,则该列必须有'新 NULL 不可能产生'
 *   的兜底(触发器/NOT NULL+默认/等价机制)」。
 *
 * 为什么要有这道门:回填型迁移只管**存量**(只写 IS NULL 行),增量(新 NULL 不再
 *   产生)必须靠存储层兜底 —— 两者缺一即半件(上游 0015 的三件一体:回填只写 IS NULL、
 *   scope 内 coalesce(max,-1)+1 起、AFTER INSERT 触发器 when new.sequence is null)。
 *   我方已在这格吃过一次亏:apps/api/src/services/turn-ordinal.ts:10-13 原文承认
 *   直插路径写出的行 turn_ordinal 为 NULL —— "靠出口函数"这条路被自己的注释证伪过。
 *
 * 判据实现(纯文本、离线、不连库):
 *   · 回填型迁移  = 同一 .sql 内出现 UPDATE <表> SET <列> = … 且该列带 IS NULL 谓词
 *     (即"只写 IS NULL 行"的形态;这是回填的成立条件,不是任意 UPDATE);
 *   · 兜底清单    = ① 触发器:CREATE TRIGGER … INSERT ON <表> … WHEN (NEW.<列> IS NULL)
 *     且其 EXECUTE FUNCTION 指向的函数体内对该列取号(NEW."<列>" := 或 SET "<列>" =);
 *     ② NOT NULL+默认/等价机制:ALTER TABLE <表> ALTER COLUMN <列> SET NOT NULL。
 *   · 定级:正式档对"有回填无兜底"判红(RC=1);--report-only 只报数不拦(RC=0),
 *     供现读存量先定级 —— 与任何提交无关的恒红门唯一结局是逼人跳门(§12e)。
 *
 * 跑法:node scripts/check-sequence-null-bucket.mjs [--report-only] [--root <目录>]
 *   --root 供 §22c 镜像测试指向合成夹具仓(默认本仓库根)。
 */

import { readdirSync, readFileSync } from 'node:fs'
import { dirname, join, resolve } from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'

const HERE = dirname(fileURLToPath(import.meta.url))
const REPO_ROOT = resolve(HERE, '..')
const MIG_DIR_REL = 'packages/database/drizzle'

/** 枚举 <root>/<MIG_DIR_REL> 恰好一层的 .sql(B1 同款口径:只认一层)。 */
export function listMigrationSqlFiles(root = REPO_ROOT) {
  const dir = join(root, MIG_DIR_REL)
  return readdirSync(dir, { withFileTypes: true })
    .filter((d) => d.isFile() && d.name.endsWith('.sql'))
    .map((d) => join(dir, d.name))
}

/** 纯函数:剥掉 `--` 行注释(判据只看语句形态,注释里的例子词不得参与判定)。 */
export function stripSqlComments(sql) {
  return sql
    .split('\n')
    .map((l) => l.replace(/--.*$/, ''))
    .join('\n')
}

/** 纯函数:把 dollar-quoted 函数体(DO $$…$$ / CREATE FUNCTION … $$…$$)替换成占位,
 *  防 `;` 切分把函数体内的语句错当顶层语句(归属回填/取号误判)。 */
export function blankDollarQuotedBodies(sql) {
  return sql.replace(/\$[\w]*\$[\s\S]*?\$\$[\w]*/g, ' /* dollar-quoted body */ ')
}

/** SQL 关键词,UPDATE/SET 捕获到它说明匹配的是子句边界而非标识符(如 "DO UPDATE SET")。 */
const SQL_KEYWORDS = new Set([
  'set', 'from', 'where', 'returning', 'into', 'as', 'select', 'only', 'no', 'action', 'or', 'all',
])

/** 纯函数:语句是否是"取号"形态 —— 窗口函数(ROW_NUMBER/COUNT … OVER)或 COALESCE(MAX(col)…)。
 *  判据语义:补号 = 给序号列算号,不是任意"回填 NULL 列"(归属/默认值回填不算,G-817 只管序号)。 */
export function isNumberingStatement(stmt, col) {
  if (/\bOVER\s*\(/i.test(stmt) || /\bROW_NUMBER\s*\(/i.test(stmt) || /\bCOALESCE\s*\(\s*MAX\s*\(/i.test(stmt)) {
    return true
  }
  const esc = col.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
  return new RegExp(`\\bMAX\\s*\\(\\s*"?${esc}"?\\s*\\)`, 'i').test(stmt)
}

/**
 * 纯函数:从一份迁移 SQL 里识别"回填型**补号**"目标(表,列)。
 * 判据(四条同语句内齐备才算):UPDATE <表> + SET "<列>" = … + "<列>" IS NULL 谓词
 * ("只写 IS NULL 行"的成立条件)+ 取号形态(见 isNumberingStatement)。
 * 语句 = 剥注释、屏蔽 dollar-quoted 体后按 `;` 切分。
 */
export function findBackfilledColumns(sql) {
  const text = blankDollarQuotedBodies(stripSqlComments(sql))
  const hits = new Map()
  for (const stmt of text.split(';')) {
    const tables = new Set()
    for (const m of stmt.matchAll(/\bUPDATE\s+(?:ONLY\s+)?"?(\w+)"?/gi)) {
      if (!SQL_KEYWORDS.has(m[1].toLowerCase())) tables.add(m[1])
    }
    if (tables.size === 0) continue
    for (const m of stmt.matchAll(/\bSET\s+"?(\w+)"?\s*=/gi)) {
      const col = m[1]
      if (SQL_KEYWORDS.has(col.toLowerCase())) continue
      if (!new RegExp(`(?:[\\w"]+\\.)?"?${col}"?\\s+IS\\s+NULL`, 'i').test(stmt)) continue
      if (!isNumberingStatement(stmt, col)) continue
      for (const table of tables) hits.set(`${table}.${col}`, { table, col })
    }
  }
  return [...hits.values()]
}

/**
 * 纯函数:从一份迁移 SQL 里识别"新 NULL 兜底"的触发器。
 * 形态:CREATE [OR REPLACE] TRIGGER <名> [BEFORE|AFTER] INSERT ON <表>
 *       … WHEN (NEW."<列>" IS NULL) … EXECUTE FUNCTION <函数名>()
 * 返回 [{ trigger, table, col, fnName }]。
 */
export function findTriggerBuckets(sql) {
  const out = []
  for (const m of sql.matchAll(
    /CREATE\s+(?:OR\s+REPLACE\s+)?TRIGGER\s+"?(\w+)"?\s+(?:BEFORE|AFTER)\s+INSERT\s+ON\s+(?:ONLY\s+)?"?(\w+)"?([\s\S]*?);/gi,
  )) {
    const [, trigger, table, body] = m
    const when = body.match(/WHEN\s*\(([^)]*)\)/i)
    const col = when ? (when[1].match(/NEW\s*\.\s*"?(\w+)"?\s+IS\s+NULL/i) || [])[1] : undefined
    const fn = (body.match(/EXECUTE\s+(?:FUNCTION|PROCEDURE)\s+"?(\w+)"?/i) || [])[1]
    if (col && fn) out.push({ trigger, table, col, fnName: fn })
  }
  return out
}

/**
 * 纯函数:函数体内是否对某列取号(两种方言形态都认):
 *   BEFORE 型赋值  NEW."<列>" := …
 *   AFTER 型回写   … SET "<列>" = (SELECT … COALESCE(MAX("<列>"), -1) + 1 …)
 */
export function functionAssignsColumn(fnBody, col) {
  const esc = col.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
  const assign = new RegExp(`NEW\\s*\\.\\s*"?${esc}"?\\s*:=`, 'i')
  const setWrite = new RegExp(`SET\\s+"?${esc}"?\\s*=`, 'i')
  return assign.test(fnBody) || setWrite.test(fnBody)
}

/**
 * 纯函数:对一份盘点面 {files:[{name, text}]} 产出判定结果。
 * @returns {{backfills:[{table,col,file}], covered:Array, uncovered:Array}}
 */
export function audit(files) {
  const backfills = []
  const triggerBuckets = []
  const notNullBuckets = []
  const fnBodies = new Map() // fnName -> body
  for (const f of files) {
    for (const b of findBackfilledColumns(f.text)) backfills.push({ ...b, file: f.name })
    for (const t of findTriggerBuckets(f.text)) triggerBuckets.push({ ...t, file: f.name })
    for (const n of f.text.matchAll(
      /ALTER\s+TABLE\s+(?:ONLY\s+)?"?(\w+)"?\s+ALTER\s+COLUMN\s+"?(\w+)"?\s+SET\s+NOT\s+NULL/gi,
    )) {
      notNullBuckets.push({ table: n[1], col: n[2], file: f.name })
    }
    for (const fn of f.text.matchAll(
      /CREATE\s+(?:OR\s+REPLACE\s+)?FUNCTION\s+"?(\w+)"?[\s\S]*?AS\s*\$[\w]*\$([\s\S]*?)\$\$/gi,
    )) {
      fnBodies.set(fn[1].toLowerCase(), fn[2])
    }
  }
  const covered = []
  const uncovered = []
  for (const b of backfills) {
    const byTrigger = triggerBuckets.find(
      (t) => t.table === b.table && t.col === b.col && functionAssignsColumn(fnBodies.get(t.fnName.toLowerCase()) ?? '', b.col),
    )
    const byNotNull = notNullBuckets.some((n) => n.table === b.table && n.col === b.col)
    if (byTrigger) covered.push({ ...b, via: `触发器 ${byTrigger.trigger}(${byTrigger.file})` })
    else if (byNotNull) covered.push({ ...b, via: `NOT NULL(${notNullBuckets.find((n) => n.table === b.table && n.col === b.col).file})` })
    else uncovered.push(b)
  }
  return { backfills, covered, uncovered }
}

const C = {
  red: '\x1b[31m',
  green: '\x1b[32m',
  yellow: '\x1b[33m',
  dim: '\x1b[2m',
  bold: '\x1b[1m',
  reset: '\x1b[0m',
}

/** 主入口:返回退出码(0 绿 / 1 红);--report-only 恒 0。 */
export function main(argv = process.argv.slice(2)) {
  const reportOnly = argv.includes('--report-only')
  const rootIdx = argv.indexOf('--root')
  const root = rootIdx >= 0 ? resolve(argv[rootIdx + 1]) : REPO_ROOT
  const face = reportOnly ? '--report-only(只报数,不判红)' : '正式档(有回填无兜底判红)'
  console.log(`${C.bold}[序号兜底] 可空排序列"新 NULL 产不出来"盘点${C.reset} ${C.dim}root=${root} ${face}${C.reset}`)

  let files
  try {
    files = listMigrationSqlFiles(root).map((p) => ({ name: p.slice(root.length + 1), text: readFileSync(p, 'utf8') }))
  } catch (e) {
    console.error(`${C.red}❌ 迁移目录取不到(${join(root, MIG_DIR_REL)}):${e?.message ?? e}${C.reset}`)
    return 1
  }

  const { backfills, covered, uncovered } = audit(files)
  if (backfills.length === 0) {
    console.log(`${C.green}✓ 盘面上没有回填型补号列(${files.length} 枚 .sql),判据空真${C.reset}`)
    return 0
  }
  for (const c of covered) {
    console.log(`  ${C.green}✓${C.reset} ${c.table}.${c.col} ← ${c.via} ${C.dim}(回填:${c.file})${C.reset}`)
  }
  for (const u of uncovered) {
    console.log(`  ${C.red}✗${C.reset} ${u.table}.${u.col} 无"新 NULL 不可能产生"的兜底 ${C.dim}(回填:${u.file})${C.reset}`)
  }
  console.log(
    `  回填型补号列 ${backfills.length} 枚:有兜底 ${covered.length} / 无兜底 ${uncovered.length}`,
  )
  if (uncovered.length > 0) {
    if (reportOnly) {
      console.log(
        `${C.yellow}! --report-only:存量缺兜底 ${uncovered.length} 枚,只报数不拦 —— 先定级再决定正式化(§12e)${C.reset}`,
      )
      return 0
    }
    console.error(
      `${C.red}❌ 有回填无兜底 ${uncovered.length} 枚:回填只管存量,增量(新 NULL)必须由触发器/NOT NULL+默认兜底 —— 两者缺一即半件(G-817)${C.reset}`,
    )
    return 1
  }
  console.log(`${C.green}✓ 全部回填型补号列都有"新 NULL 产不出来"的兜底(${covered.length} 枚)${C.reset}`)
  return 0
}

/** §22c:镜像测试只 import 这一份真相,不复制判据实现。 */
export const __test__ = {
  listMigrationSqlFiles,
  stripSqlComments,
  blankDollarQuotedBodies,
  isNumberingStatement,
  findBackfilledColumns,
  findTriggerBuckets,
  functionAssignsColumn,
  audit,
  main,
}

/** §22d 双形态入口守护:测试 import 时不得触发 CLI 副作用。 */
const isDirectRun = process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href

if (isDirectRun) {
  const code = main()
  if (code) process.exit(code)
}
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
