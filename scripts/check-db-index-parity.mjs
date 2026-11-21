#!/usr/bin/env node
// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
/**
 * BUG-29 schema/迁移集合对账。
 *
 * 票面:同一张表两份 DDL 列类型不同 / schema 声明索引无对应 DDL。
 * 本脚本只读对账:解析 packages/database/src/schema/*.ts 声明的表名 + 列类型，
 * 与 packages/database/drizzle/*.sql 迁移 DDL 里同名表的列类型对照，差异即报。
 *
 * 仅对账、不判红（BUG-29 列类型不一致那一格由持有者定档后随补齐迁移一并收口）。
 * 用法: node scripts/check-db-index-parity.mjs [--json]
 */
import { readFileSync, readdirSync, existsSync } from 'node:fs'
import { join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

const ROOT = resolve(fileURLToPath(import.meta.url), '..', '..')
const SCHEMA_DIR = join(ROOT, 'packages', 'database', 'src', 'schema')
const DRIZZLE_DIR = join(ROOT, 'packages', 'database', 'drizzle')

/** 从 schema/*.ts 抽表名 → 列名 → 列类型（pgTable 第二参对象的 key → .type()）。 */
function parseSchemaTables() {
  const tables = new Map() // tableName -> Map(colName -> colType)
  if (!existsSync(SCHEMA_DIR)) return tables
  for (const f of readdirSync(SCHEMA_DIR).filter((x) => x.endsWith('.ts'))) {
    const src = readFileSync(join(SCHEMA_DIR, f), 'utf8')
    // 匹配 pgTable('table_name', { ... }) 或 pgTable("table_name", { ... })
    const re = /pgTable\(\s*['"]([^'"]+)['"]\s*,\s*\{([^}]*(?:\{[^}]*\}[^}]*)*)\}/g
    let m
    while ((m = re.exec(src)) !== null) {
      const tableName = m[1]
      const body = m[2]
      if (!tables.has(tableName)) tables.set(tableName, new Map())
      const cols = tables.get(tableName)
      // 列形如: colName: someType('...') 或 colName: someType(...)
      const colRe = /(\w+)\s*:\s*(\w+)\s*\(/g
      let c
      while ((c = colRe.exec(body)) !== null) {
        cols.set(c[1], c[2])
      }
    }
  }
  return tables
}

/** 从 drizzle/*.sql 抽 CREATE TABLE 表名 → 列名 → 列类型（SQL 类型原文）。 */
function parseMigrationDdl() {
  const tables = new Map()
  if (!existsSync(DRIZZLE_DIR)) return tables
  const files = readdirSync(DRIZZLE_DIR).filter((x) => x.endsWith('.sql')).sort()
  for (const f of files) {
    const src = readFileSync(join(DRIZZLE_DIR, f), 'utf8')
    // CREATE TABLE "table" ( ... );  或 CREATE TABLE IF NOT EXISTS ...
    const re = /CREATE\s+TABLE\s+(?:IF\s+NOT\s+EXISTS\s+)?["`]?(\w+)["`]?\s*\(([\s\S]*?)\)\s*;/gi
    let m
    while ((m = re.exec(src)) !== null) {
      const tableName = m[1]
      const body = m[2]
      if (!tables.has(tableName)) tables.set(tableName, new Map())
      const cols = tables.get(tableName)
      // 逐行解析列定义，跳过表级约束（PRIMARY KEY / FOREIGN KEY / UNIQUE / CONSTRAINT / INDEX / CHECK）
      for (const rawLine of body.split('\n')) {
        const line = rawLine.trim().replace(/,$/, '')
        if (!line) continue
        if (/^(PRIMARY\s+KEY|FOREIGN\s+KEY|UNIQUE|CONSTRAINT|INDEX|CHECK)\b/i.test(line)) continue
        const cm = /^["`]?(\w+)["`]?\s+([A-Za-z][\w]*(?:\s*\([^)]*\))?(?:\s+[A-Za-z]+)*)/.exec(line)
        if (!cm) continue
        const colName = cm[1]
        const colType = cm[2].trim().toUpperCase()
        if (!cols.has(colName)) cols.set(colName, { type: colType, source: f })
      }
    }
  }
  return tables
}

/** 从 drizzle/*.sql 抽 CREATE INDEX / UNIQUE INDEX 索引清单。 */
function parseMigrationIndexes() {
  const indexes = new Map() // table -> Set(indexName)
  if (!existsSync(DRIZZLE_DIR)) return indexes
  for (const f of readdirSync(DRIZZLE_DIR).filter((x) => x.endsWith('.sql')).sort()) {
    const src = readFileSync(join(DRIZZLE_DIR, f), 'utf8')
    // CREATE INDEX [IF NOT EXISTS] [name] ON "table" (col,...) / CREATE UNIQUE INDEX ...
    const re = /CREATE\s+(?:UNIQUE\s+)?INDEX\s+(?:IF\s+NOT\s+EXISTS\s+)?["`]?(\w+)["`]?\s+ON\s+["`]?(\w+)["`]?/gi
    let m
    while ((m = re.exec(src)) !== null) {
      const idxName = m[1]
      const table = m[2]
      if (!indexes.has(table)) indexes.set(table, new Set())
      indexes.get(table).add(idxName)
    }
  }
  return indexes
}

/** 从 drizzle/*.sql 抽 FOREIGN KEY 约束清单: { table, column, refTable, refColumn }。 */
function parseMigrationForeignKeys() {
  const fks = [] // { table, column, refTable, refColumn, source }
  if (!existsSync(DRIZZLE_DIR)) return fks
  for (const f of readdirSync(DRIZZLE_DIR).filter((x) => x.endsWith('.sql')).sort()) {
    const src = readFileSync(join(DRIZZLE_DIR, f), 'utf8')
    // ① 表级: 在 CREATE TABLE "t" (...) 内的 FOREIGN KEY ("col") REFERENCES ...
    const createRe = /CREATE\s+TABLE\s+(?:IF\s+NOT\s+EXISTS\s+)?["`]?(\w+)["`]?\s*\(([\s\S]*?)\)\s*;/gi
    let cm
    while ((cm = createRe.exec(src)) !== null) {
      const table = cm[1]
      const body = cm[2]
      const fkRe = /FOREIGN\s+KEY\s*\(\s*["`]?(\w+)["`]?\s*\)\s*REFERENCES\s+["`]?(\w+)["`]?\s*\(\s*["`]?(\w+)["`]?\s*\)/gi
      let fm
      while ((fm = fkRe.exec(body)) !== null) {
        fks.push({ table, column: fm[1], refTable: fm[2], refColumn: fm[3], source: f })
      }
    }
    // ② ALTER TABLE "t" ADD CONSTRAINT ... FOREIGN KEY ("col") REFERENCES ...
    const alterRe = /ALTER\s+TABLE\s+(?:IF\s+EXISTS\s+)?["`]?(\w+)["`]?\s+ADD\s+(?:CONSTRAINT\s+["`]?(\w+)["`]?\s+)?FOREIGN\s+KEY\s*\(\s*["`]?(\w+)["`]?\s*\)\s*REFERENCES\s+["`]?(\w+)["`]?\s*\(\s*["`]?(\w+)["`]?\s*\)/gi
    let am
    while ((am = alterRe.exec(src)) !== null) {
      fks.push({ table: am[1], column: am[3], refTable: am[4], refColumn: am[5], source: f })
    }
  }
  return fks
}

function main() {
  const schemaTables = parseSchemaTables()
  const ddlTables = parseMigrationDdl()
  const findings = []

  // ① schema 声明了但 DDL 里整表缺失
  for (const [t] of schemaTables) {
    if (!ddlTables.has(t)) findings.push({ kind: 'schema-table-not-in-ddl', table: t })
  }
  // ② schema 列类型 vs DDL 列类型（按宽松映射对照；不一致即报）
  const TYPE_MAP = {
    serial: ['SERIAL', 'INTEGER'],
    integer: ['INTEGER'],
    bigint: ['BIGINT'],
    text: ['TEXT'],
    varchar: ['VARCHAR', 'CHARACTER VARYING'],
    boolean: ['BOOLEAN'],
    timestamp: ['TIMESTAMP'],
    jsonb: ['JSONB'],
    uuid: ['UUID'],
    numeric: ['NUMERIC', 'DECIMAL'],
    real: ['REAL'],
    doubleprecision: ['DOUBLE PRECISION'],
  }
  for (const [t, cols] of schemaTables) {
    const ddlCols = ddlTables.get(t)
    if (!ddlCols) continue
    for (const [c, tsType] of cols) {
      const ddl = ddlCols.get(c)
      if (!ddl) {
        findings.push({ kind: 'schema-col-not-in-ddl', table: t, column: c, schemaType: tsType })
        continue
      }
      const allowed = TYPE_MAP[tsType] ?? [tsType.toUpperCase()]
      if (!allowed.some((x) => ddl.type.startsWith(x))) {
        findings.push({
          kind: 'type-mismatch',
          table: t,
          column: c,
          schemaType: tsType,
          ddlType: ddl.type,
          ddlSource: ddl.source,
        })
      }
    }
  }

  // ③ BUG-29 四格:D1 FK 列无索引 / D2 userId 无 FK / D3 声明索引无 DDL / D4 列类型不一致
  const ddlIndexes = parseMigrationIndexes()
  const ddlFks = parseMigrationForeignKeys()
  // FK 覆盖集: "table.col" -> true
  const fkCovered = new Set(ddlFks.map((f) => `${f.table}.${f.column}`))
  // 表内列是否有对应索引(索引名通常含列名;宽松匹配)
  const tableIndexes = (t) => ddlIndexes.get(t) ?? new Set()

  for (const [t, cols] of schemaTables) {
    const idxNames = tableIndexes(t)
    for (const [c] of cols) {
      // D2: 列名以 Id/ID 结尾(疑似外键引用)但无 FK 约束
      if (/(Id|ID)$/.test(c) && c !== 'id' && !fkCovered.has(`${t}.${c}`)) {
        findings.push({ kind: 'fk-missing', table: t, column: c })
      }
    }
    // D1: FK 覆盖的列是否有同名索引(索引名通常 idx_<table>_<col>)
    for (const f of ddlFks.filter((x) => x.table === t)) {
      const hasIdx = [...idxNames].some((n) => n.toLowerCase().includes(f.column.toLowerCase()))
      if (!hasIdx) {
        findings.push({ kind: 'fk-col-no-index', table: t, column: f.column, refTable: f.refTable })
      }
    }
  }

  const summary = {
    schemaTables: schemaTables.size,
    ddlTables: ddlTables.size,
    findings: findings.length,
    byKind: findings.reduce((acc, f) => ((acc[f.kind] = (acc[f.kind] ?? 0) + 1), acc), {}),
  }

  if (process.argv.includes('--json')) {
    console.log(JSON.stringify({ summary, findings }, null, 2))
  } else {
    console.log(`BUG-29 schema/迁移对账`)
    console.log(`  schema 表数: ${summary.schemaTables}`)
    console.log(`  DDL 表数:   ${summary.ddlTables}`)
    console.log(`  差异条数:   ${summary.findings}`)
    for (const [k, v] of Object.entries(summary.byKind)) {
      console.log(`    - ${k}: ${v}`)
    }
    if (findings.length > 0) {
      console.log(`\n样例（前 10 条）:`)
      for (const f of findings.slice(0, 10)) {
        console.log(`  ${f.kind}: ${f.table}${f.column ? '.' + f.column : ''}${f.schemaType ? ` schema=${f.schemaType}` : ''}${f.ddlType ? ` ddl=${f.ddlType} (${f.ddlSource})` : ''}`)
      }
    }
  }
  // 只对账不判红：恒 exit 0，BUG-29 列类型不一致由持有者随补齐迁移一并收口。
  process.exit(0)
}

main()
