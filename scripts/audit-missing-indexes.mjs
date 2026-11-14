// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。

// scripts/audit-missing-indexes.mjs
//
// BUG-29 schema ↔ 迁移链「索引 DDL」离线对账（不连数据库，纯静态解析）。
//
// 取材面（§0.4 同面纪律）：
//   · schema 侧 = packages/database/src/schema/*.ts 里 drizzle 声明的 index()/uniqueIndex()
//   · 迁移侧 = packages/database/drizzle/*.sql 整条链里的 CREATE INDEX / UNIQUE INDEX DDL
// 判据：schema 声明的每个索引，在迁移链里要么有**同名** DDL，要么有**同表同列集**的等价 DDL
//       （迁移重命名索引是合法演进，只按名字硬比会产生假红）。两样都无 ⇒ MISSING。
//
// exit code：
//   0 = 无缺失（对账通过）
//   1 = 有缺失（打印 MISSING 清单，报红）
//   2 = 取不到输入（schema 目录/迁移目录不存在 ⇒ 未判定，不冒绿）
//
// 用法：
//   node scripts/audit-missing-indexes.mjs                 # 对账并报红/放行
//   node scripts/audit-missing-indexes.mjs --json          # 机器可读输出
//   node scripts/audit-missing-indexes.mjs --verify-sql    # 附带校验 BUG-29 补齐迁移的括号/DO 块静态配平
import { readFileSync, readdirSync, existsSync } from 'node:fs'
import { resolve, basename, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'

// BUG-29 幂等补齐迁移（离线静态分析生成，格1/格2/格3 全带 IF NOT EXISTS / DO 守卫）
export const BUG29_MIGRATION = '20261106150000_fix_missing_indexes_fks.sql'

const HERE = dirname(fileURLToPath(import.meta.url))
const REPO = resolve(HERE, '..')
const SCHEMA_DIR = resolve(REPO, 'packages/database/src/schema')
const DRIZZLE_DIR = resolve(REPO, 'packages/database/drizzle')
// 本脚本真实绝对路径（import.meta.url → file:///D:/... → D:/...），用于跨平台 isMain 判定
const THIS_FILE = resolve(fileURLToPath(import.meta.url))

// ---- 括号配平提取：从 s[start] === '(' 起，返回到配平 ')' 的片段 ----
export function balancedFromParen(s, start) {
  let depth = 0
  for (let i = start; i < s.length; i++) {
    const c = s[i]
    if (c === '(') depth++
    else if (c === ')') {
      depth--
      if (depth === 0) return s.slice(start, i + 1)
    }
  }
  return s.slice(start)
}

// ---- 剥掉 SQL 行注释（-- ...）与块注释（/* ... */），避免注释里的 DDL 关键字被误判 ----
export function stripSqlComments(sql) {
  return sql
    .replace(/\/\*[\s\S]*?\*\//g, '')
    .split('\n')
    .map((l) => (l.trim().startsWith('--') ? '' : l))
    .join('\n')
}

// ---- 从 CREATE INDEX 的列清单原文提取规范化列名集合（去引号/空白/ASC|DESC/COLLATE/表达式外层括号） ----
export function parseIndexCols(raw) {
  return new Set(
    raw
      .split(',')
      .map((s) =>
        s
          .replace(/["`\[\]]/g, '')
          .replace(/\s+(ASC|DESC)\s*$/i, '')
          .replace(/COLLATE\s+"?[\w]+"?/gi, '')
          .replace(/\s+/g, '')
          .trim(),
      )
      .filter(Boolean),
  )
}

/** @returns {Map<string,{table:string,cols:Set<string>,file:string}>} 索引名 -> 定义 */
export function collectDeclaredIndexes(schemaDir) {
  const walk = (dir) =>
    readdirSync(dir, { withFileTypes: true }).flatMap((e) =>
      e.isDirectory() ? walk(resolve(dir, e.name)) : [resolve(dir, e.name)],
    )
  const out = new Map()
  if (!existsSync(schemaDir)) throw new Error(`schema 目录不存在: ${schemaDir}`)
  for (const f of walk(schemaDir).filter((p) => p.endsWith('.ts'))) {
    const txt = readFileSync(f, 'utf-8')
    const tblRe = /pgTable\s*\(\s*['"`]([\w]+)['"`]/g
    let tm
    while ((tm = tblRe.exec(txt))) {
      const table = tm[1]
      const parenAt = txt.indexOf('(', tm.index)
      const block = balancedFromParen(txt, parenAt)
      // 列块 = pgTable 第一个 { ... }，用于 var → db 列名 映射
      const colOpen = block.indexOf('{')
      const colBlock = colOpen >= 0 ? balancedFromParen(block, colOpen) : ''
      const varToCol = new Map()
      const colRe = /^\s{2,}(\w+)\s*:\s*/gm
      let cm
      while ((cm = colRe.exec(colBlock))) {
        const v = cm[1]
        const rest = colBlock.slice(cm.index + cm[0].length, colBlock.indexOf('\n', cm.index))
        const q = rest.match(/['"`]([\w]+)['"`]/)
        varToCol.set(v, q ? q[1] : v)
      }
      // 表级 index()/uniqueIndex() 声明
      const idxRe = /(?:uniqueIndex|index)\s*\(\s*['"`]([\w]+)['"`]\s*\)\s*\.on\s*\(/g
      let im
      while ((im = idxRe.exec(block))) {
        const name = im[1]
        const onParen = block.indexOf('(', im.index + im[0].length - 1)
        const onBody = balancedFromParen(block, onParen)
        const cols = new Set([...onBody.matchAll(/\bt\.(\w+)/g)].map((x) => varToCol.get(x[1]) || x[1]))
        if (!out.has(name)) out.set(name, { table, cols, file: basename(f) })
      }
    }
  }
  return out
}

/**
 * 从迁移链 .sql 集合抽取已建索引。
 * @returns {Map<string,{table:string,cols:Set<string>,file:string}>} 索引名 -> DDL 定义
 */
export function collectMigratedIndexes(drizzleDir) {
  const walk = (dir) =>
    readdirSync(dir, { withFileTypes: true }).flatMap((e) =>
      e.isDirectory() ? walk(resolve(dir, e.name)) : [resolve(dir, e.name)],
    )
  const out = new Map()
  if (!existsSync(drizzleDir)) throw new Error(`迁移目录不存在: ${drizzleDir}`)
  for (const f of walk(drizzleDir).filter((p) => p.endsWith('.sql'))) {
    const sql = stripSqlComments(readFileSync(f, 'utf-8'))
    const re =
      /CREATE\s+(?:UNIQUE\s+)?INDEX\s+(?:CONCURRENTLY\s+)?(?:IF\s+NOT\s+EXISTS\s+)?["`]?([\w]+)["`]?\s+ON\s+(?:ONLY\s+)?["`]?([\w]+)["`]?\s*(?:USING\s+\w+\s*)?\(([^()]*(?:\([^()]*\))?[^()]*)\)/gi
    let m
    while ((m = re.exec(sql))) {
      out.set(m[1], { table: m[2], cols: parseIndexCols(m[3]), file: basename(f) })
    }
  }
  return out
}

/**
 * 对账：schema 声明索引是否都能在迁移链里找到（同名 或 同表同列集等价）。
 * @returns {{missing:Array<{name:string,table:string,cols:string,file:string}>, equivalent:number}}
 */
export function auditIndexes(declared, migrated) {
  const migratedList = [...migrated.values()]
  const missing = []
  let equivalent = 0
  for (const [name, d] of declared) {
    if (migrated.has(name)) continue
    const eq = migratedList.some(
      (mi) =>
        mi.table === d.table &&
        mi.cols.size === d.cols.size &&
        [...d.cols].every((c) => mi.cols.has(c)),
    )
    if (eq) equivalent++
    else missing.push({ name, table: d.table, cols: [...d.cols].join(', '), file: d.file })
  }
  missing.sort((a, b) => a.name.localeCompare(b.name))
  return { missing, equivalent }
}

// ---- 迁移 SQL 静态自检：括号配平 + DO $$ 块配平 + BEGIN/END 配平（不连库） ----
export function verifyMigrationSql(sql) {
  const errors = []
  // 剥注释后再数，避免注释里的括号干扰
  const s = stripSqlComments(sql)
  // 1) 圆括号配平（粗粒度：忽略字符串字面量内的括号）
  let paren = 0, inStr = false, strCh = ''
  for (let i = 0; i < s.length; i++) {
    const c = s[i]
    if (inStr) {
      if (c === strCh) inStr = false
      continue
    }
    if (c === "'" || c === '"') { inStr = true; strCh = c; continue }
    if (c === '(') paren++
    else if (c === ')') paren--
    if (paren < 0) { errors.push(`第 ${i} 字符附近出现多余 ')'（圆括号提前闭合）`); break }
  }
  if (paren > 0) errors.push(`圆括号未闭合，缺口 ${paren} 个`)
  // 2) DO $$ ... END $$ 块配平
  const dollarCount = (s.match(/\$\$/g) || []).length
  if (dollarCount % 2 !== 0) errors.push(`$$ 美元引用不配平（出现 ${dollarCount} 个 $$，应为偶数）`)
  // 3) BEGIN ... END 配平（DO 块内的 plpgsql）
  //    注：`END IF;` 是 IF 语句的收尾，不算 BEGIN 的配对 END；先剔除 END IF 再比。
  const beginCount = (s.match(/\bBEGIN\b/g) || []).length
  const endIfCount = (s.match(/\bEND\s+IF\b/g) || []).length
  const allEndCount = (s.match(/\bEND\b/g) || []).length
  const bareEndCount = allEndCount - endIfCount
  if (beginCount !== bareEndCount)
    errors.push(`BEGIN(${beginCount}) 与 END(${bareEndCount}) 数量不等（已剔除 END IF ${endIfCount} 处）`)
  return { ok: errors.length === 0, errors }
}

// ===================== CLI =====================
// 跨平台 isMain：直接比 path.resolve 后的真实绝对路径，不走 import.meta.url === file://argv[1]（Windows 失效）
const isMain = process.argv[1] && resolve(process.argv[1]) === THIS_FILE
if (isMain) {
  const jsonOut = process.argv.includes('--json')
  const doVerify = process.argv.includes('--verify-sql')
  let declared, migrated
  try {
    declared = collectDeclaredIndexes(SCHEMA_DIR)
    migrated = collectMigratedIndexes(DRIZZLE_DIR)
  } catch (e) {
    console.error(`[BUG-29 对账] 未判定：取不到输入 —— ${e.message}`)
    process.exit(2)
  }
  const { missing, equivalent } = auditIndexes(declared, migrated)

  if (jsonOut) {
    console.log(JSON.stringify({ declaredTotal: declared.size, migratedTotal: migrated.size, missing, equivalent }, null, 2))
  } else {
    console.log('================ BUG-29 schema↔迁移 索引对账 ================')
    console.log(`schema 声明索引: ${declared.size}  |  迁移链已建: ${migrated.size}`)
    console.log(`同表同列集等价覆盖(合法重命名): ${equivalent}`)
    console.log(`缺失(既无名也无等价列集): ${missing.length}`)
    for (const m of missing) console.log(`   MISSING  ${m.name}  ON ${m.table} (${m.cols})  [${m.file}]`)
  }

  if (doVerify) {
    const p = resolve(DRIZZLE_DIR, BUG29_MIGRATION)
    if (!existsSync(p)) {
      console.error(`[verify] 未判定：迁移文件不存在 ${BUG29_MIGRATION}`)
      process.exit(2)
    }
    const v = verifyMigrationSql(readFileSync(p, 'utf-8'))
    console.log(v.ok ? `[verify] ${BUG29_MIGRATION} 静态配平通过（括号 / $$ / BEGIN-END）` : `[verify] ${BUG29_MIGRATION} 配平异常:`)
    for (const e of v.errors) console.error(`   - ${e}`)
    if (!v.ok) process.exit(1)
  }

  if (missing.length > 0) {
    console.error(`\n[BUG-29 对账] 报红：${missing.length} 个 schema 声明索引在迁移链里缺失。`)
    process.exit(1)
  }
  console.log('\n[BUG-29 对账] 通过：schema 声明的索引在迁移链里均有对应 DDL。')
  process.exit(0)
}
// ⁠
