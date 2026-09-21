#!/usr/bin/env node
// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠


/* eslint-disable no-console -- 守门脚本为 CLI 工具,需 console 输出诊断信息 */
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
import { readFileSync, readdirSync, existsSync, statSync } from 'node:fs'
import { join } from 'node:path'

const ROOT = process.cwd()
const SCHEMA_DIR = join(ROOT, 'packages/database/src/schema')
const MIGRATIONS_DIR = join(ROOT, 'packages/database/drizzle')

/**
 * 死 migration 白名单(表名小写)。
 *
 * 这些表出现在 migration SQL 中、但 TS schema(packages/database/src/schema)无定义,
 * 属于"合法不应出现在 Drizzle TS schema 中"的情形,从 dead migration 告警中排除:
 * - 第三方 / 外部系统表(项目不拥有)
 * - PostgreSQL 原生管理的对象(如分区表的 DEFAULT 子分区,由父表 PARTITION BY 自动维护,
 *   Drizzle 只定义父表,不应为子分区单独定义 pgTable)
 *
 * 新增白名单项必须附注释说明原因(参照下方条目)。
 */
const DEAD_MIGRATION_WHITELIST = new Set([
  // 0060_r70_audit_logs_partition.sql:`audit_logs` 声明式分区表的 DEFAULT 兜底子分区,
  // 由 PostgreSQL 按 PARTITION BY RANGE(created_at) 自动创建/维护,Drizzle 只定义父表
  // `audit_logs`(见 src/schema/audit.ts),故不在此处单独定义。
  'audit_logs_default',
  // 0060 内 DO 块 EXECUTE format('CREATE TABLE IF NOT EXISTS %I PARTITION OF ...') 的
  // 动态月分区:无引号分支将 format 占位符前的 "IF" 抓成表名,属文本解析固有噪声
  'if',
])

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
 * 运行时权威表名解析(2026-09-06 增强,根治文本解析盲区):
 * 文本级 grep 无法区分 schema 文件中的"幽灵引用"(注释/残留文本)与真实 pgTable 定义,
 * 曾导致死表名单虚高误判(如 payment_callbacks 定义文件只剩注释)。
 * 权威源 = packages/database/dist/schema 的运行时 pgTable 符号(Symbol drizzle:Name)。
 * 陈旧防护:dist 产物 mtime 早于 schema 源码最新 mtime 时视为陈旧,回退文本解析并告警
 * (陈旧 dist 会漏掉当天新增表,曾致 device_tokens 被误判死表)。
 */
function loadRuntimeSchemaTables() {
  const distEntry = join(ROOT, 'packages/database/dist/schema/index.js')
  if (!existsSync(distEntry)) return { tables: null, mode: 'no-dist' }

  // 陈旧检测: dist 必须不旧于 schema 目录最新源码
  let newestSchemaMtime = 0
  for (const entry of readdirSync(SCHEMA_DIR)) {
    if (!entry.endsWith('.ts')) continue
    const m = statSync(join(SCHEMA_DIR, entry)).mtimeMs
    if (m > newestSchemaMtime) newestSchemaMtime = m
  }
  if (statSync(distEntry).mtimeMs < newestSchemaMtime) {
    return { tables: null, mode: 'stale-dist' }
  }

  const tables = new Set()
  try {
    const schema = require(distEntry)
    for (const v of Object.values(schema)) {
      if (!v || typeof v !== 'object') continue
      const syms = Object.getOwnPropertySymbols(v)
      const nameSym = syms.find((s) => String(s).includes('drizzle:Name'))
      if (nameSym !== undefined && typeof v[nameSym] === 'string') {
        tables.add(v[nameSym].toLowerCase())
      }
    }
  } catch {
    return { tables: null, mode: 'import-failed' }
  }
  if (tables.size === 0) return { tables: null, mode: 'empty' }
  return { tables, mode: 'runtime' }
}

// .mjs 中使用 createRequire 加载 CJS 编译产物
import { createRequire } from 'node:module'
const require = createRequire(import.meta.url)

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

  // 合并 CREATE/DROP/RENAME 为单一正则,按 SQL 文件中实际出现顺序应用
  // (避免同文件 drop-and-recreate 模式下 CREATE+DROP 顺序错乱导致误报 dead migration)
  // 2026-09-06 修复:支持无引号表名(如 20260801010050 的 CREATE TABLE ai_relay_channel_daily_usage,
  // 旧正则要求闭合引号导致整批无引号表被系统性遗漏)
  // 捕获组:1/2=CREATE 表名 / 3/4=DROP 表名 / 5,6=RENAME 旧名 / 7=RENAME 新名
  const combinedRe = /(?:CREATE\s+TABLE\s+(?:IF\s+NOT\s+EXISTS\s+)?(?:["'`]([^"'`]+)["'`]|([a-zA-Z_][a-zA-Z_0-9]*)))|(?:DROP\s+TABLE\s+(?:IF\s+EXISTS\s+)?(?:["'`]([^"'`]+)["'`]|([a-zA-Z_][a-zA-Z_0-9]*)))|(?:ALTER\s+TABLE\s+(?:["'`]([^"'`]+)["'`]|([a-zA-Z_][a-zA-Z_0-9]*))\s+RENAME\s+TO\s+(?:["'`]([^"'`]+)["'`]|([a-zA-Z_][a-zA-Z_0-9]*)))/gi

  for (const file of files) {
    let src
    try {
      src = readFileSync(join(MIGRATIONS_DIR, file), 'utf8')
    } catch {
      continue
    }
    // 剥离整行注释(2026-09-06):注释中的"CREATE TABLE migration"等描述词曾被
    // 无引号分支抓成假表名;行尾注释不受影响
    src = src.replace(/^\s*--.*$/gm, '')
    let match
    while ((match = combinedRe.exec(src)) !== null) {
      const createName = (match[1] ?? match[2])?.toLowerCase()
      const dropName = (match[3] ?? match[4])?.toLowerCase()
      const renameOld = (match[5] ?? match[6])?.toLowerCase()
      const renameNew = (match[7] ?? match[8])?.toLowerCase()
      if (createName !== undefined && createName !== '') {
        // CREATE TABLE
        finalTables.add(createName)
        if (!createdTables.has(createName)) createdTables.set(createName, [])
        createdTables.get(createName).push(file)
      } else if (dropName !== undefined && dropName !== '') {
        // DROP TABLE
        finalTables.delete(dropName)
        if (!droppedTables.has(dropName)) droppedTables.set(dropName, [])
        droppedTables.get(dropName).push(file)
      } else if (renameOld !== undefined && renameOld !== '' && renameNew !== undefined && renameNew !== '') {
        // ALTER TABLE RENAME TO
        finalTables.delete(renameOld)
        finalTables.add(renameNew)
      }
    }
  }

  return { finalTables, createdTables, droppedTables, files }
}

function main() {
  // 运行时权威优先: dist 存在且新鲜时用真实 pgTable 符号,否则回退文本解析
  const rt = loadRuntimeSchemaTables()
  let tsTables, schemaFiles
  if (rt.tables) {
    tsTables = rt.tables
    schemaFiles = readdirSync(SCHEMA_DIR).filter((f) => f.endsWith('.ts'))
  } else {
    const parsed = parseTsSchemaTables()
    tsTables = parsed.tables
    schemaFiles = parsed.files
  }
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
  const whitelistedDeadMigrations = []
  for (const t of migTables) {
    if (!tsTables.has(t)) {
      // 找到最后的 CREATE 文件
      const createdIn = createdTables.get(t) || []
      const droppedIn = droppedTables.get(t) || []
      const entry = {
        table: t,
        lastCreatedIn: createdIn[createdIn.length - 1] || '(unknown)',
        droppedIn,
      }
      if (DEAD_MIGRATION_WHITELIST.has(t)) {
        whitelistedDeadMigrations.push(entry)
      } else {
        deadMigrations.push(entry)
      }
    }
  }
  deadMigrations.sort((a, b) => a.table.localeCompare(b.table))
  whitelistedDeadMigrations.sort((a, b) => a.table.localeCompare(b.table))

  // ============ 输出报告 ============
  console.log(`${C.bold}=== schema drift check report ===${C.reset}`)
  const modeHint =
    rt.mode === 'runtime'
      ? `${C.dim}(运行时权威: dist schema pgTable 符号)${C.reset}`
      : `${C.yellow}(文本解析回退: dist ${rt.mode},建议 pnpm --filter @ihui/database build 后重跑)${C.reset}`
  console.log(
    `  TS schema tables:    ${C.cyan}${tsTables.size}${C.reset} (${schemaFiles.length} 文件) ${modeHint}`,
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
    `  dead migrations:     ${C.yellow}${deadMigrations.length}${C.reset} (migration 有表但 TS schema 无定义,信息级)` +
      (whitelistedDeadMigrations.length > 0
        ? ` ${C.dim}(另有 ${whitelistedDeadMigrations.length} 个已加白名单)${C.reset}`
        : ''),
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

  if (whitelistedDeadMigrations.length > 0) {
    console.log(
      `${C.cyan}${C.bold}ℹ 白名单死 migration(已排除,合法不应出现在 TS schema):${C.reset}`,
    )
    for (const { table, lastCreatedIn } of whitelistedDeadMigrations) {
      console.log(
        `  ${C.cyan}${table}${C.reset} ${C.dim}← last CREATE: ${lastCreatedIn} (白名单)${C.reset}`,
      )
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
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
