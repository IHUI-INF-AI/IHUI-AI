#!/usr/bin/env node
/* eslint-disable no-console */
/**
 * packages/database schema drift 检测脚本。
 *
 * 防止 TS schema 定义了表但 migration 未生成(运行时崩溃风险),
 * 同时检测 migration 中有表但 TS schema 已删除(死 migration 风险)。
 *
 * 检测维度:
 * 1. migration 缺失:TS schema 定义了表 X,但所有 migration SQL 中没有 CREATE TABLE X
 * 2. 死 migration:migration 中 CREATE 了表 X,但 TS schema 中已无定义
 * 3. DROP 后重建:migration 中 DROP 了表 X,但后续没有 CREATE(可能是误删)
 *
 * 用法: node scripts/check-db-schema-drift.mjs
 *   无参数: 全量扫描,发现 migration 缺失 exit 1,无问题 exit 0
 *   --staged: pre-commit 模式(同上,因为 schema drift 是全局问题)
 */
import { readFileSync, readdirSync, existsSync } from 'node:fs'
import { join } from 'node:path'

const ROOT = process.cwd()
const SCHEMA_DIR = join(ROOT, 'packages/database/src/schema')
const MIGRATIONS_DIR = join(ROOT, 'packages/database/drizzle')

const C = {
  red: '\x1b[31m',
  green: '\x1b[32m',
  yellow: '\x1b[33m',
  cyan: '\x1b[36m',
  magenta: '\x1b[35m',
  dim: '\x1b[2m',
  bold: '\x1b[1m',
  reset: '\x1b[0m',
}

/**
 * 解析 TS schema 中所有 pgTable 定义的表名。
 * 匹配 `pgTable('table_name',` 或 `pgTable("table_name",`
 * 返回 Set<table_name>(小写,因为 PG 表名大小写不敏感)
 */
function parseTsSchemaTables() {
  const tables = new Set()
  const files = []
  if (!existsSync(SCHEMA_DIR)) return { tables, files }
  for (const entry of readdirSync(SCHEMA_DIR)) {
    if (!entry.endsWith('.ts')) continue
    files.push(join(SCHEMA_DIR, entry))
  }
  // pgTable('name', { ... }) — 第一个参数是表名字符串
  const re = /pgTable\(\s*['"`]([^'"`]+)['"`]/g
  for (const file of files) {
    let src
    try {
      src = readFileSync(file, 'utf8')
    } catch {
      continue
    }
    let match
    while ((match = re.exec(src)) !== null) {
      tables.add(match[1].toLowerCase())
    }
  }
  return { tables, files }
}

/**
 * 扫描 migration SQL 文件,按文件名顺序应用 CREATE/DROP TABLE,
 * 得到最终 DB 中应有的表名集合。
 *
 * 返回 {
 *   finalTables: Set<表名>,
 *   createdTables: Map<表名, [文件名...]>,
 *   droppedTables: Map<表名, [文件名...]>,
 *   files: string[]
 * }
 */
function scanMigrations() {
  const finalTables = new Set()
  const createdTables = new Map()
  const droppedTables = new Map()
  const files = []

  if (!existsSync(MIGRATIONS_DIR)) {
    return { finalTables, createdTables, droppedTables, files }
  }

  // 收集所有 .sql 文件,按文件名排序(0000_xxx.sql 在 0001_xxx.sql 之前)
  for (const entry of readdirSync(MIGRATIONS_DIR)) {
    if (!entry.endsWith('.sql')) continue
    files.push(entry)
  }
  files.sort()

  // CREATE TABLE IF NOT EXISTS "table_name" / CREATE TABLE "table_name"
  const createRe = /CREATE\s+TABLE\s+(?:IF\s+NOT\s+EXISTS\s+)?["'`]([^"'`]+)["'`]/gi
  // DROP TABLE IF EXISTS "table_name" / DROP TABLE "table_name" (可能带 CASCADE)
  const dropRe = /DROP\s+TABLE\s+(?:IF\s+EXISTS\s+)?["'`]([^"'`]+)["'`]/gi
  // ALTER TABLE RENAME TO "new_name" — 重命名
  const renameToRe = /ALTER\s+TABLE\s+["'`]([^"'`]+)["'`]\s+RENAME\s+TO\s+["'`]([^"'`]+)["'`]/gi

  for (const file of files) {
    let src
    try {
      src = readFileSync(join(MIGRATIONS_DIR, file), 'utf8')
    } catch {
      continue
    }
    let match
    while ((match = createRe.exec(src)) !== null) {
      const t = match[1].toLowerCase()
      finalTables.add(t)
      if (!createdTables.has(t)) createdTables.set(t, [])
      createdTables.get(t).push(file)
    }
    while ((match = dropRe.exec(src)) !== null) {
      const t = match[1].toLowerCase()
      finalTables.delete(t)
      if (!droppedTables.has(t)) droppedTables.set(t, [])
      droppedTables.get(t).push(file)
    }
    while ((match = renameToRe.exec(src)) !== null) {
      const oldName = match[1].toLowerCase()
      const newName = match[2].toLowerCase()
      finalTables.delete(oldName)
      finalTables.add(newName)
    }
  }

  return { finalTables, createdTables, droppedTables, files }
}

function main() {
  const { tables: tsTables, files: schemaFiles } = parseTsSchemaTables()
  const { finalTables: migTables, createdTables, droppedTables, files: migFiles } =
    scanMigrations()

  // migration 缺失:TS schema 有但 migration 没有
  const missingMigrations = []
  for (const t of tsTables) {
    if (!migTables.has(t)) {
      missingMigrations.push(t)
    }
  }
  missingMigrations.sort()

  // 死 migration:migration 最终有但 TS schema 没有
  const deadMigrations = []
  for (const t of migTables) {
    if (!tsTables.has(t)) {
      // 找到最后的 CREATE 文件
      const createdIn = createdTables.get(t) || []
      const droppedIn = droppedTables.get(t) || []
      deadMigrations.push({
        table: t,
        lastCreatedIn: createdIn[createdIn.length - 1] || '(unknown)',
        droppedIn,
      })
    }
  }
  deadMigrations.sort((a, b) => a.table.localeCompare(b.table))

  // ============ 输出报告 ============
  console.log(`${C.bold}=== schema drift check report ===${C.reset}`)
  console.log(
    `  TS schema tables:    ${C.cyan}${tsTables.size}${C.reset} (${schemaFiles.length} 文件)`,
  )
  console.log(
    `  migration tables:    ${C.cyan}${migTables.size}${C.reset} (${migFiles.length} SQL 文件)`,
  )
  console.log(
    `  missing migrations:  ${
      missingMigrations.length === 0 ? C.green + '0' : C.red + missingMigrations.length
    }${C.reset}`,
  )
  console.log(
    `  dead migrations:     ${C.yellow}${deadMigrations.length}${C.reset} (migration 有表但 TS schema 无定义,信息级)`,
  )
  console.log()

  let hasError = false

  if (missingMigrations.length > 0) {
    console.log(
      `${C.red}${C.bold}❌ migration 缺失(TS schema 定义了表但 migration 未生成):${C.reset}`,
    )
    console.log(
      `${C.dim}  需运行 pnpm --filter @ihui/database db:generate 生成 migration${C.reset}`,
    )
    for (const t of missingMigrations) {
      console.log(`  ${C.red}${t}${C.reset}`)
    }
    console.log()
    hasError = true
  }

  if (deadMigrations.length > 0) {
    console.log(
      `${C.yellow}${C.bold}⚠ 死 migration(migration 中有表但 TS schema 无定义):${C.reset}`,
    )
    console.log(
      `${C.dim}  可能是 TS schema 已删除表但未生成 DROP migration,或为外部表(只读)${C.reset}`,
    )
    const shown = deadMigrations.slice(0, 30)
    for (const { table, lastCreatedIn, droppedIn } of shown) {
      const dropInfo = droppedIn.length > 0 ? ` (曾 DROP 于 ${droppedIn.join(', ')})` : ''
      console.log(
        `  ${C.yellow}${table}${C.reset} ${C.dim}← last CREATE: ${lastCreatedIn}${dropInfo}${C.reset}`,
      )
    }
    if (deadMigrations.length > 30) {
      console.log(`  ${C.dim}... 还有 ${deadMigrations.length - 30} 个未显示${C.reset}`)
    }
    console.log()
  }

  if (hasError) {
    console.log(`${C.red}${C.bold}❌ schema drift check 失败${C.reset}`)
    process.exit(1)
  }
  console.log(`${C.green}${C.bold}✅ schema drift check 通过${C.reset}`)
  process.exit(0)
}

main()
