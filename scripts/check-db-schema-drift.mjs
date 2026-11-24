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
 * 4. migration 缺失列(字段级尺子,2026-09-30 增补):TS schema 的表 X 定义了列 c,
 *    但整条 migration 链(CREATE body / ALTER ADD COLUMN / RENAME 终名)都没有 c 的出处。
 *    这是"代码引用新列而迁移未应用 ⇒ 引用它的查询在他人机上先 500,而 typecheck/纯函数
 *    测试全绿"最高发面的静态对偶(动态面由 apps/ai-service 的 schema_check.py 管)。
 *    反向(migration 有列/TS 无)与"多余字段"同口径:信息级,非阻塞。
 *    枚举到 0 张可对照表 ⇒ 判"无法判定"而非记绿(与守门 117/157 的"枚举到 0 判死"同形)。
 * 5. 外键名称级维度(2026-11-07 增补,warn-only 起步):迁移链终态声明过 FK、而 journal 末条
 *    对应 snapshot 的 foreignKeys 已不再声明 ⇒ "迁移有/声明无",这正是会掉约束的单向面。
 *    迁移侧复用门 350 的 extractAddedObjects / maskSql(不复制第二份 SQL 解析),按
 *    meta/_journal.json 顺序扫 ALTER ADD CONSTRAINT 与 CREATE TABLE CONSTRAINT,并按序应用
 *    DROP/RENAME CONSTRAINT;声明侧只读 journal 末条对应的 snapshot。身份键 =
 *    name + columnsFrom 列序 + tableTo + columnsTo 列序。未加引号标识符折小写,public. 归一。
 *    动态 SQL(EXECUTE format / 分区自动建表)解析不到的记"未判定",不折红。
 *    snapshot 缺 foreignKeys / 末条 snapshot 及其前序都取不到 ⇒ exit 2,不记绿。
 *    本轮不新建基线、不冻结数字;默认只打印不阻断(`--strict` 才把"迁移有/声明无"升为 exit 1)。
 *
 * 用法: node scripts/check-db-schema-drift.mjs
 *   无参数: 全量扫描,发现 migration 缺失 exit 1,无问题 exit 0
 *   --staged: pre-commit 模式(同上,因为 schema drift 是全局问题)
 *   --self-test: 内存断言(不落盘不连网),校验列解析函数本身
 */
import { readFileSync, readdirSync, existsSync, statSync } from 'node:fs'
import { join } from 'node:path'
import { pathToFileURL } from 'node:url'
// 门 350(check-hand-migration-snapshot.mjs)的迁移侧抽取器是唯一真源:
// maskSql / parseTableRef / extractAddedObjects 均从其导出,本门不复制第二份 SQL 解析。
import {
  extractAddedObjects,
  maskSql,
  migrationNumberOf,
} from './check-hand-migration-snapshot.mjs'

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

// 退出码一律走 main() 返回值,由文件末尾的 §22d 入口守卫统一 process.exit。
async function main() {
  if (process.argv.includes('--self-test')) {
    return selfTest()
  }

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

  // ── 字段级尺子:TS schema 列 vs migration 链列出处 ──
  // TS 侧列集合(rt 模式下仍从文本解析列——运行时符号不含列名级别信息,文本解析与
  // schema_check.py 同构,解析盲区由 --self-test 的样例锁定)
  const tsColumns = new Map() // table -> Set<col>
  if (existsSync(SCHEMA_DIR)) {
    for (const entry of readdirSync(SCHEMA_DIR)) {
      if (!entry.endsWith('.ts')) continue
      let src
      try {
        src = readFileSync(join(SCHEMA_DIR, entry), 'utf8')
      } catch {
        continue
      }
      for (const t of tsTables) {
        const cols = extractTsColumnsFromSource(src, t)
        if (cols === null) continue
        const merged = tsColumns.get(t) ?? new Set()
        for (const c of cols) merged.add(c)
        tsColumns.set(t, merged)
      }
    }
  }
  // migration 侧列出处(逐文件提取后合并;同表跨文件按文件名序叠加 ADD/DROP/RENAME)
  const migColumns = new Map()
  for (const file of migFiles) {
    let src
    try {
      src = readFileSync(join(MIGRATIONS_DIR, file), 'utf8')
    } catch {
      continue
    }
    const prov = extractColumnProvenanceFromSql(src)
    for (const [t, cols] of prov) {
      const merged = migColumns.get(t) ?? new Set()
      for (const c of cols) merged.add(c)
      migColumns.set(t, merged)
    }
  }
  // 对照:仅对"两表都已知"的表做列级对照(表级 drift 已由上面两条既有判据负责)
  const missingColumns = [] // TS 有列 / migration 无出处 ⇒ 阻塞(引用新列而迁移未应用的静态对偶)
  const extraColumns = [] // migration 有列 / TS 无 ⇒ 信息级(与"多余字段非阻塞"同口径)
  let joinedTables = 0
  for (const t of [...tsTables].sort()) {
    const tCols = tsColumns.get(t)
    const mCols = migColumns.get(t)
    if (!tCols || tCols.size === 0 || !mCols) continue
    joinedTables += 1
    for (const c of tCols) {
      if (!mCols.has(c)) missingColumns.push(`${t}.${c}`)
    }
    for (const c of mCols) {
      if (!tCols.has(c)) extraColumns.push(`${t}.${c}`)
    }
  }
  missingColumns.sort()
  extraColumns.sort()

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

  // ── 外键名称级维度(2026-11-07,warn-only 起步;不新建基线、不冻结数字) ──
  const fkStrict = process.argv.includes('--strict')
  const fkMig = collectMigrationForeignKeys()
  const fkDecl = fkMig.skipped || fkMig.unjudged ? null : loadDeclarationForeignKeys(fkMig.journal)
  const fkUnjudged = fkMig.unjudged ?? fkDecl?.unjudged ?? null
  const fkDiff =
    fkMig.skipped || fkUnjudged ? null : diffForeignKeys(fkMig.fks, fkDecl.fks)

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
  console.log(
    `  field-level joined:  ${C.cyan}${joinedTables}${C.reset} 张表做列级对照` +
      `,missing columns: ${
        missingColumns.length === 0 ? C.green + '0' : C.red + missingColumns.length
      }${C.reset},extra columns: ${C.yellow}${extraColumns.length}${C.reset} (信息级)`,
  )
  if (fkMig.skipped) {
    console.log(
      `  FK name-level:       ${C.dim}未纳入(${fkMig.skipped};夹具/无 journal 仓不判绿也不判红)${C.reset}`,
    )
  } else if (fkUnjudged) {
    console.log(`  FK name-level:       ${C.yellow}未判定${C.reset} ${C.dim}(${fkUnjudged})${C.reset}`)
  } else {
    const snapName = fkDecl.snapshotPath.split(/[\\/]/).pop()
    console.log(
      `  FK name-level:       ${C.cyan}${fkMig.fks.length}${C.reset} 条迁移终态 / ` +
        `${C.cyan}${fkDecl.fks.length}${C.reset} 条声明末态` +
        `,迁移有·声明无: ${
          fkDiff.missing.length === 0 ? C.green + '0' : C.yellow + fkDiff.missing.length
        }${C.reset} ${C.dim}(warn-only,${fkStrict ? '--strict 本次升为阻塞' : '默认不阻断'})${C.reset}` +
        `,声明有·迁移无: ${C.yellow}${fkDiff.extra.length}${C.reset} ${C.dim}(信息级)${C.reset}` +
        ` ${C.dim}(snapshot ${snapName}${
          fkDecl.degraded ? ',journal 末条缺同号,按 journal 前序回退' : ''
        })${C.reset}`,
    )
  }
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

  if (missingColumns.length > 0) {
    console.log(
      `${C.red}${C.bold}❌ migration 缺失列(TS schema 引用了列,但整条 migration 链无出处):${C.reset}`,
    )
    console.log(
      `${C.dim}  引用该列的查询在未应用迁移的机器上会先 500。需补迁移件 + 应用步骤;` +
        `若列经运行时自愈 DDL 通道添加,应在迁移链中留同等 DDL 或登记白名单${C.reset}`,
    )
    for (const c of missingColumns.slice(0, 50)) {
      console.log(`  ${C.red}${c}${C.reset}`)
    }
    if (missingColumns.length > 50) {
      console.log(`  ${C.dim}... 还有 ${missingColumns.length - 50} 个未显示${C.reset}`)
    }
    console.log()
    hasError = true
  }

  if (fkDiff && fkDiff.missing.length > 0) {
    console.log(
      `${fkStrict ? C.red : C.yellow}${C.bold}${fkStrict ? '❌' : '⚠'} 外键:迁移终态有、snapshot 末态无` +
        `(${fkStrict ? '--strict 阻塞' : 'warn-only 不阻断'}):${C.reset}`,
    )
    console.log(
      `${C.dim}  该面抓到「迁移链声明过 FK、TS/snapshot 侧已不再声明」的掉约束;` +
        `本轮不新建基线、不冻结数字${C.reset}`,
    )
    const shown = fkDiff.missing.slice(0, 50)
    for (const fk of shown) {
      console.log(
        `  ${fkStrict ? C.red : C.yellow}${fk.name}${C.reset} ` +
          `${C.dim}${fk.tableFrom}(${fk.columnsFrom.join(',')}) → ` +
          `${fk.tableTo}(${fk.columnsTo.join(',')}) ← ${fk.file}:${fk.line}${C.reset}`,
      )
    }
    if (fkDiff.missing.length > 50) {
      console.log(`  ${C.dim}... 还有 ${fkDiff.missing.length - 50} 个未显示${C.reset}`)
    }
    console.log()
    if (fkStrict) hasError = true
  }

  if (fkDiff && fkDiff.extra.length > 0) {
    console.log(
      `${C.cyan}ℹ 外键:snapshot 末态有、迁移终态无(${fkDiff.extra.length} 条,信息级,不阻塞):${C.reset}`,
    )
    for (const fk of fkDiff.extra.slice(0, 20)) {
      console.log(
        `  ${C.dim}${fk.name} ${fk.tableFrom}(${fk.columnsFrom.join(',')}) → ` +
          `${fk.tableTo}(${fk.columnsTo.join(',')})${C.reset}`,
      )
    }
    if (fkDiff.extra.length > 20) {
      console.log(`  ${C.dim}... 还有 ${fkDiff.extra.length - 20} 个未显示${C.reset}`)
    }
    console.log()
  }

  if (fkMig.dynamic?.length > 0) {
    console.log(
      `${C.dim}ℹ 动态 DDL(EXECUTE format)未纳入 FK 判定,记未判定不折红: ` +
        `${fkMig.dynamic.map((d) => `${d.file}×${d.count}`).join(', ')}${C.reset}`,
    )
    console.log()
  }

  if (joinedTables === 0) {
    // 枚举到 0 张可对照表 ⇒ 无法判定,不记绿(与守门 117/157 的"枚举到 0 判死"口径同形)
    console.log(
      `${C.red}${C.bold}❌ 无法判定:可做列级对照的表为 0(schema 目录或 migration 目录缺失/为空?)${C.reset}`,
    )
    return 2
  }

  if (fkUnjudged) {
    console.log(`${C.yellow}${C.bold}⚠ 外键名称级维度未判定:${fkUnjudged}${C.reset}`)
    console.log()
    return 2
  }

  if (hasError) {
    console.log(`${C.red}${C.bold}❌ schema drift check 失败${C.reset}`)
    return 1
  }
  console.log(`${C.green}${C.bold}✅ schema drift check 通过${C.reset}`)
  return 0
}

// ───────────────── 字段级尺子(列出处对照) ─────────────────

// Drizzle 列类型表(与 apps/ai-service/app/core/schema_check.py 的 _DRIZZLE_COLUMN_TYPES 同构,
// 两端改一处必须同步改另一处——守门:任一侧新增类型跑 --self-test 与 pytest 各有一份样例表)
const DRIZZLE_COLUMN_TYPES = String.raw`(?:bigserial|serial|smallserial|varchar|char|integer|int|text|boolean|timestamp|bigint|smallint|jsonb|json|decimal|numeric|real|doublePrecision|uuid|bytea|date|time|interval|inet|cidr|macaddr|bit|bitVarying|point|line|lseg|box|path|polygon|circle|tsvector|tsquery|vector|geometry)`

// 列定义:tsName: type('db_field', { ... }) — 捕获 db 名(第 3 组),仅认已知列类型防误抓
const COLUMN_RE_SRC =
  String.raw`(\w+):\s*(` + DRIZZLE_COLUMN_TYPES +
  String.raw`)\(\s*['"\`]([^'"\`]+)['"\`]\s*(?:,[^)]*)?\)(\s*\.array\(\))?`

/** CREATE TABLE 体内不该当列名的引导词(约束/索引子句)。 */
const NON_COLUMN_LEADS = new Set([
  'constraint', 'primary', 'foreign', 'unique', 'check', 'exclude', 'like',
])

/**
 * 从 TS schema 源码解析一个 pgTable 调用体内的全部 db 列名。
 * 解析思路与 schema_check.py 的 parse_ts_table_fields 同构:先定位表体(括号深度
 * 扫描,跳过字符串/注释),再在表体内跑列定义正则。
 */
export function extractTsColumnsFromSource(src, table) {
  const pgRe = new RegExp(
    String.raw`pgTable\(\s*['"\`]` + table + String.raw`['"\`]\s*,\s*\{`,
  )
  const m = pgRe.exec(src)
  if (!m) return null
  const body = src.slice(m.index + m[0].length, findCallEnd(src, m.index + m[0].length))
  const cols = new Set()
  const re = new RegExp(COLUMN_RE_SRC, 'gi')
  let cm
  while ((cm = re.exec(body)) !== null) {
    cols.add(cm[3].toLowerCase())
  }
  return cols
}

/** 括号深度扫描找配对右括号(跳过字符串/行/块注释),与 schema_check.py 的 _find_table_end 同构。 */
export function findCallEnd(content, start) {
  let depth = 1
  let i = start
  const n = content.length
  let inStr = null
  let inBlock = false
  let inLine = false
  while (i < n) {
    const ch = content[i]
    const nx = i + 1 < n ? content[i + 1] : ''
    if (inLine) {
      if (ch === '\n') inLine = false
      i++
      continue
    }
    if (inBlock) {
      if (ch === '*' && nx === '/') { inBlock = false; i += 2; continue }
      i++
      continue
    }
    if (inStr) {
      if (ch === '\\' && nx) { i += 2; continue }
      if (ch === inStr) inStr = null
      i++
      continue
    }
    if (ch === '/' && nx === '/') { inLine = true; i += 2; continue }
    if (ch === '/' && nx === '*') { inBlock = true; i += 2; continue }
    if (ch === '"' || ch === "'" || ch === '`') { inStr = ch; i++; continue }
    if (ch === '(') depth++
    else if (ch === ')') {
      depth--
      if (depth === 0) return i + 1
    }
    i++
  }
  return start + 5000
}

/**
 * 从一段 migration SQL(单文件全文)提取列出处:
 * - CREATE TABLE body 的每个顶层逗号项的首个标识符(列定义)
 * - ALTER TABLE 语句体内的 ADD COLUMN(含多列 "ADD COLUMN a, ADD COLUMN b" 形式)、
 *   DROP COLUMN(移除)、RENAME COLUMN a TO b(移 a 记 b)
 * 返回 Map<table, Set<col>>(小写)。行尾注释(-- …)会跨逗号把下一个列项的词头吞进注释,
 * 因此逐项先剥注释再取词。
 */
export function extractColumnProvenanceFromSql(sql) {
  const src = sql.replace(/^\s*--.*$/gm, '')
  const out = new Map()
  const tbl = (name) => {
    let t = out.get(name)
    if (!t) { t = new Set(); out.set(name, t) }
    return t
  }

  // CREATE TABLE body
  const createRe = /CREATE\s+TABLE\s+(?:IF\s+NOT\s+EXISTS\s+)?(?:["'`]([^"'`]+)["'`]|([a-zA-Z_][a-zA-Z_0-9]*))\s*\(/gi
  let m
  while ((m = createRe.exec(src)) !== null) {
    const table = (m[1] ?? m[2]).toLowerCase()
    const bodyStart = m.index + m[0].length
    let depth = 1
    let i = bodyStart
    while (i < src.length && depth > 0) {
      const ch = src[i]
      if (ch === "'") {
        i++
        while (i < src.length && src[i] !== "'") {
          if (src[i] === '\\') i++
          i++
        }
      } else if (ch === '(') depth++
      else if (ch === ')') depth--
      i++
    }
    const body = src.slice(bodyStart, i - 1)
    // 先剥行尾注释再按顶层逗号分割:注释内的逗号(如 "-- 主键,说明")会把列项切碎,
    // 且注释横跨逗号会把下一列项的词头吞进注释里
    const bodyClean = body.replace(/--[^\n]*/g, '')
    const items = []
    let d = 0
    let cur = ''
    let inS = false
    for (let j = 0; j < bodyClean.length; j++) {
      const ch = bodyClean[j]
      if (inS) { cur += ch; if (ch === "'") inS = false; continue }
      if (ch === "'") { inS = true; cur += ch; continue }
      if (ch === '(') d++
      if (ch === ')') d--
      if (ch === ',' && d === 0) { items.push(cur); cur = '' } else cur += ch
    }
    if (cur.trim()) items.push(cur)
    const tcols = tbl(table)
    for (const item of items) {
      const cm = item.trim().match(/^["'`]?([a-zA-Z_][a-zA-Z_0-9]*)["'`]?/i)
      if (!cm) continue
      const w = (cm[1] || '').toLowerCase()
      if (NON_COLUMN_LEADS.has(w)) continue
      tcols.add(w)
    }
  }

  // ALTER TABLE 语句体(到分号):ADD/DROP/RENAME COLUMN
  const stmtRe = /ALTER\s+TABLE[^;]*;/gi
  const alterHeadRe = /ALTER\s+TABLE\s+(?:IF\s+EXISTS\s+)?(?:ONLY\s+)?(?:["'`]?([a-zA-Z_][a-zA-Z_0-9]*)["'`]?)/i
  const addColRe = /ADD\s+COLUMN\s+(?:IF\s+NOT\s+EXISTS\s+)?(?:["'`]?([a-zA-Z_][a-zA-Z_0-9]*)["'`]?)/gi
  const dropColRe = /DROP\s+COLUMN\s+(?:IF\s+EXISTS\s+)?(?:["'`]?([a-zA-Z_][a-zA-Z_0-9]*)["'`]?)/gi
  const renColRe = /RENAME\s+COLUMN\s+(?:["'`]?([a-zA-Z_][a-zA-Z_0-9]*)["'`]?)\s+TO\s+(?:["'`]?([a-zA-Z_][a-zA-Z_0-9]*)["'`]?)/gi
  while ((m = stmtRe.exec(src)) !== null) {
    // 语句体内同样先剥行尾注释,防注释里的 ADD/DROP/RENAME 字样误触发
    const stmt = m[0].replace(/--[^\n]*/g, '')
    const tm = alterHeadRe.exec(stmt)
    if (!tm) continue
    const table = (tm[1] || '').toLowerCase()
    const tcols = tbl(table)
    let am
    const ar = new RegExp(addColRe.source, 'gi')
    while ((am = ar.exec(stmt)) !== null) tcols.add((am[1] || '').toLowerCase())
    const dr = new RegExp(dropColRe.source, 'gi')
    while ((am = dr.exec(stmt)) !== null) tcols.delete((am[1] || '').toLowerCase())
    const rr = new RegExp(renColRe.source, 'gi')
    while ((am = rr.exec(stmt)) !== null) {
      tcols.delete((am[1] || '').toLowerCase())
      tcols.add((am[2] || '').toLowerCase())
    }
  }
  return out
}

// ───────────────── 外键名称级尺子(2026-11-07 增补,warn-only) ─────────────────
// 迁移侧对象抽取复用门 350 的 extractAddedObjects / maskSql;这里只补「FK 明细(列序 +
// 引用表列)」与声明侧 snapshot.foreignKeys 的对照,不再造第二份 SQL 解析。

const JOURNAL_REL = 'meta/_journal.json'
const FK_IDENT_BASE = `"(?:[^"]|"")+"|[A-Za-z_][A-Za-z0-9_$]*`
const FK_IDENT = `(${FK_IDENT_BASE})`
const FK_IDENT_NC = `(?:${FK_IDENT_BASE})`
const FK_TABLE_REF_SRC = `(${FK_IDENT_NC}(?:\\s*\\.\\s*${FK_IDENT_NC})?)`
const FK_CLAUSE_SRC = `FOREIGN\\s+KEY\\s*\\(([^()]*)\\)\\s+REFERENCES\\s+${FK_TABLE_REF_SRC}\\s*\\(([^()]*)\\)`

/** 未加引号标识符按 PostgreSQL 折小写;双引号标识符保留原样。 */
function normIdent(raw) {
  const t = String(raw ?? '').trim()
  if (t.startsWith('"') && t.endsWith('"')) return t.slice(1, -1).replace(/""/g, '"')
  return t.toLowerCase()
}

/** `[schema.]table` → {schema, table};`public.` 前缀归一为无 schema。 */
function normRef(raw) {
  const parts = String(raw ?? '')
    .split('.')
    .map((p) => p.trim())
    .filter(Boolean)
    .map(normIdent)
    .filter(Boolean)
  const table = parts[parts.length - 1] ?? ''
  let schema = parts.length > 1 ? parts[parts.length - 2] : null
  if (schema === 'public') schema = null
  return { schema, table }
}

function normColumns(text) {
  return String(text ?? '')
    .split(',')
    .map((c) => normIdent(c))
    .filter(Boolean)
}

function escapeRe(text) {
  return String(text).replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
}

function lineOf(text, index) {
  let line = 1
  for (let i = 0; i < index && i < text.length; i++) if (text[i] === '\n') line++
  return line
}

/** 从 `FOREIGN KEY (...)` 子句起解析列序与引用表列(入参 start 指向子句前的空白)。 */
function parseFkClauseAt(masked, start) {
  const m = new RegExp(`^\\s+${FK_CLAUSE_SRC}`, 'i').exec(masked.slice(start))
  if (!m) return null
  const ref = normRef(m[2])
  return {
    tableTo: ref.table,
    schemaTo: ref.schema,
    columnsFrom: normColumns(m[1]),
    columnsTo: normColumns(m[3]),
  }
}

/** 掩码文本里的 CREATE TABLE 体(括号深度扫描;字符串/注释已在 maskSql 中抹平)。 */
function createTableBodies(masked) {
  const bodies = []
  const re = new RegExp(
    `\\bCREATE\\s+TABLE\\s+(?:IF\\s+NOT\\s+EXISTS\\s+)?${FK_TABLE_REF_SRC}\\s*\\(`,
    'gi',
  )
  let m
  while ((m = re.exec(masked)) !== null) {
    const bodyStart = m.index + m[0].length
    let depth = 1
    let i = bodyStart
    while (i < masked.length && depth > 0) {
      if (masked[i] === '(') depth++
      else if (masked[i] === ')') depth--
      i++
    }
    const ref = normRef(m[1])
    bodies.push({
      table: ref.table,
      schema: ref.schema,
      start: bodyStart,
      text: masked.slice(bodyStart, i - 1),
    })
    re.lastIndex = i
  }
  return bodies
}

/** 掩码文本里的 ALTER TABLE 动作段(到分号为止;DO $$ ... $$ 体内的动作同样在段内)。 */
function alterTableSegments(masked) {
  const segs = []
  const re = new RegExp(
    `\\bALTER\\s+TABLE\\s+(?:IF\\s+EXISTS\\s+)?(?:ONLY\\s+)?${FK_TABLE_REF_SRC}`,
    'gi',
  )
  let m
  while ((m = re.exec(masked)) !== null) {
    const start = m.index + m[0].length
    const semi = masked.indexOf(';', start)
    const end = semi === -1 ? masked.length : semi
    const ref = normRef(m[1])
    segs.push({
      table: ref.table,
      schema: ref.schema,
      start,
      text: masked.slice(start, end),
      index: m.index,
    })
  }
  return segs
}

/** 动态 DDL 计数(`EXECUTE format(...)` 里的 DDL 在单引号字符串内被抹平,只能记未判定)。 */
export function countDynamicDdl(sqlText) {
  const masked = maskSql(sqlText)
  return (masked.match(/\bEXECUTE\s+format\b/gi) ?? []).length
}

/**
 * 纯函数:从单份迁移 SQL 抽取 FK 事件(按源码位置排序,供跨文件按 journal 顺序应用)。
 * @returns {Array<{type:'add'|'drop'|'rename', ...}>}
 */
export function extractForeignKeyEventsFromSql(sqlText) {
  const src = String(sqlText ?? '')
  if (!src) return []
  const masked = maskSql(src)
  const events = []

  // ① ALTER TABLE ... ADD CONSTRAINT <name> FOREIGN KEY ...(归属/对象名来自门 350)
  for (const obj of extractAddedObjects(src)) {
    if (obj.kind !== 'constraint') continue
    const n = escapeRe(obj.object)
    const re = new RegExp(`ADD\\s+CONSTRAINT\\s+(?:"${n}"|${n})(?![A-Za-z0-9_$])`, 'gi')
    let m
    while ((m = re.exec(masked)) !== null) {
      const detail = parseFkClauseAt(masked, m.index + m[0].length)
      if (!detail) continue
      events.push({
        type: 'add',
        name: normIdent(obj.object),
        tableFrom: obj.table,
        schemaFrom: obj.schema ?? null,
        index: m.index,
        ...detail,
      })
      break
    }
  }

  // ② CREATE TABLE 体内的 CONSTRAINT <name> FOREIGN KEY ...
  for (const body of createTableBodies(masked)) {
    const re = new RegExp(`\\bCONSTRAINT\\s+${FK_IDENT}\\s+(?:${FK_CLAUSE_SRC})`, 'gi')
    let m
    while ((m = re.exec(body.text)) !== null) {
      const ref = normRef(m[3])
      events.push({
        type: 'add',
        name: normIdent(m[1]),
        tableFrom: body.table,
        schemaFrom: body.schema,
        index: body.start + m.index,
        tableTo: ref.table,
        schemaTo: ref.schema,
        columnsFrom: normColumns(m[2]),
        columnsTo: normColumns(m[4]),
      })
    }
  }

  // ③ DROP / RENAME CONSTRAINT(按出现顺序扣减或改名)
  for (const seg of alterTableSegments(masked)) {
    const dropRe = new RegExp(
      `\\bDROP\\s+CONSTRAINT\\s+(?:IF\\s+EXISTS\\s+)?${FK_IDENT}`,
      'gi',
    )
    let m
    while ((m = dropRe.exec(seg.text)) !== null) {
      events.push({
        type: 'drop',
        name: normIdent(m[1]),
        tableFrom: seg.table,
        schemaFrom: seg.schema,
        index: seg.start + m.index,
      })
    }
    const renRe = new RegExp(
      `\\bRENAME\\s+CONSTRAINT\\s+${FK_IDENT}\\s+TO\\s+${FK_IDENT}`,
      'gi',
    )
    while ((m = renRe.exec(seg.text)) !== null) {
      events.push({
        type: 'rename',
        oldName: normIdent(m[1]),
        newName: normIdent(m[2]),
        tableFrom: seg.table,
        schemaFrom: seg.schema,
        index: seg.start + m.index,
      })
    }
  }

  const order = { add: 0, drop: 1, rename: 2 }
  return events.sort((a, b) => a.index - b.index || order[a.type] - order[b.type])
}

/** 纯函数:把单文件事件按序应用到跨文件 FK 终态(state = Map<tableFrom|name, fk>)。 */
export function applyForeignKeyEvents(state, events) {
  const next = state instanceof Map ? new Map(state) : new Map()
  for (const e of events) {
    if (e.type === 'add') {
      next.set(`${e.tableFrom}|${e.name}`, e)
      continue
    }
    if (e.type === 'drop') {
      const key = `${e.tableFrom}|${e.name}`
      if (next.has(key)) {
        next.delete(key)
        continue
      }
      for (const [k, v] of next) {
        if (v.name === e.name) {
          next.delete(k)
          break
        }
      }
      continue
    }
    if (e.type === 'rename') {
      let from = `${e.tableFrom}|${e.oldName}`
      let v = next.get(from)
      if (!v) {
        for (const [k, x] of next) {
          if (x.name === e.oldName) {
            from = k
            v = x
            break
          }
        }
      }
      if (!v) continue
      next.delete(from)
      next.set(`${e.tableFrom}|${e.newName}`, { ...v, name: e.newName })
    }
  }
  return next
}

/**
 * 迁移侧终态:按 meta/_journal.json 顺序扫全部迁移,返回 FK 终态集合。
 * journal 不存在 ⇒ 维度不纳入(夹具/无 journal 仓);journal 存在但指向的 .sql 缺失 ⇒ 未判定。
 */
export function collectMigrationForeignKeys() {
  const journalPath = join(MIGRATIONS_DIR, JOURNAL_REL)
  if (!existsSync(journalPath)) return { skipped: `未发现 ${JOURNAL_REL}` }
  let journal
  try {
    journal = JSON.parse(readFileSync(journalPath, 'utf8'))
  } catch (e) {
    return { unjudged: `journal 解析失败: ${e?.message ?? e}` }
  }
  const entries = Array.isArray(journal?.entries) ? journal.entries : []
  if (entries.length === 0) return { unjudged: 'journal entries 为空' }
  let state = new Map()
  const dynamic = []
  for (const entry of entries) {
    const file = `${entry.tag}.sql`
    const filePath = join(MIGRATIONS_DIR, file)
    if (!existsSync(filePath)) {
      return { unjudged: `journal 指向的迁移文件缺失: ${file}`, journal }
    }
    const src = readFileSync(filePath, 'utf8')
    const masked = maskSql(src)
    const events = extractForeignKeyEventsFromSql(src).map((e) => ({
      ...e,
      file,
      line: lineOf(masked, e.index),
    }))
    state = applyForeignKeyEvents(state, events)
    const dyn = countDynamicDdl(src)
    if (dyn > 0) dynamic.push({ file, count: dyn })
  }
  const fks = [...state.values()].map((e) => ({
    name: e.name,
    tableFrom: e.tableFrom,
    columnsFrom: e.columnsFrom,
    tableTo: e.tableTo,
    columnsTo: e.columnsTo,
    file: e.file,
    line: e.line,
  }))
  return { fks, journal, dynamic }
}

/**
 * 声明侧:journal 末条对应的 snapshot(按 journal 取,不按文件名排序)。
 * 末条缺同号 snapshot → 按 journal 前序退到最近一枚可用快照(与门 350 同口径,报告明示);
 * 末条及其前序都取不到 / snapshot 缺 tables 或 foreignKeys 字段 ⇒ 未判定 exit 2。
 */
export function loadDeclarationForeignKeys(journal) {
  const entries = Array.isArray(journal?.entries) ? journal.entries : []
  if (entries.length === 0) return { unjudged: 'journal 为空,取不到声明面' }
  const snapshotPathOf = (n) =>
    join(MIGRATIONS_DIR, 'meta', `${String(n).padStart(4, '0')}_snapshot.json`)
  const last = entries[entries.length - 1]
  const lastSeq = migrationNumberOf(last.tag, last.idx)
  let path = snapshotPathOf(lastSeq)
  let degraded = false
  if (!existsSync(path)) {
    path = null
    for (let i = entries.length - 1; i >= 0; i--) {
      const p = snapshotPathOf(migrationNumberOf(entries[i].tag, entries[i].idx))
      if (existsSync(p)) {
        path = p
        degraded = true
        break
      }
    }
  }
  if (!path) {
    return { unjudged: `journal 末条(${last.tag})及其前序均取不到 snapshot` }
  }
  let snap
  try {
    snap = JSON.parse(readFileSync(path, 'utf8'))
  } catch (e) {
    return { unjudged: `snapshot 解析失败: ${path} (${e?.message ?? e})` }
  }
  const tables = snap?.tables
  if (!tables || typeof tables !== 'object') {
    return { unjudged: `snapshot 缺 tables 字段: ${path}` }
  }
  let sawForeignKeysField = false
  const fks = []
  for (const [tableKey, tableVal] of Object.entries(tables)) {
    if (!tableVal || typeof tableVal !== 'object') continue
    if (!Object.prototype.hasOwnProperty.call(tableVal, 'foreignKeys')) continue
    sawForeignKeysField = true
    const fkMap = tableVal.foreignKeys
    if (!fkMap || typeof fkMap !== 'object') continue
    for (const fk of Object.values(fkMap)) {
      if (!fk || typeof fk !== 'object') continue
      const ref = normRef(fk.tableTo)
      fks.push({
        name: String(fk.name ?? ''),
        tableFrom: normRef(fk.tableFrom).table,
        columnsFrom: Array.isArray(fk.columnsFrom) ? fk.columnsFrom.map(String) : [],
        tableTo: ref.table,
        columnsTo: Array.isArray(fk.columnsTo) ? fk.columnsTo.map(String) : [],
        snapshotTable: tableKey,
      })
    }
  }
  if (!sawForeignKeysField) {
    return { unjudged: `snapshot 缺 foreignKeys 字段: ${path}` }
  }
  return { fks, snapshotPath: path, lastSeq, degraded }
}

/** FK 身份键 = name + columnsFrom 列序 + 引用表 + columnsTo 列序(单向判据的唯一身份)。 */
export function foreignKeyKey(fk) {
  return [
    String(fk.name),
    (fk.columnsFrom ?? []).join(','),
    normRef(fk.tableTo).table,
    (fk.columnsTo ?? []).join(','),
  ].join('|')
}

/** 纯函数:迁移终态 vs 声明末态。missing = 迁移有/声明无(单向阻塞候选);extra = 反向(信息级)。 */
export function diffForeignKeys(migrationFks, declarationFks) {
  const declKeys = new Set((declarationFks ?? []).map((f) => foreignKeyKey(f)))
  const migKeys = new Set((migrationFks ?? []).map((f) => foreignKeyKey(f)))
  const byKey = (a, b) =>
    a.name.localeCompare(b.name) || foreignKeyKey(a).localeCompare(foreignKeyKey(b))
  const missing = (migrationFks ?? []).filter((f) => !declKeys.has(foreignKeyKey(f))).sort(byKey)
  const extra = (declarationFks ?? []).filter((f) => !migKeys.has(foreignKeyKey(f))).sort(byKey)
  return { missing, extra }
}

/** 内存断言(--self-test):解析函数对内嵌样例的行为。不落盘不连网。 */
function selfTest() {
  const cases = []
  const assertEq = (name, actual, expected) => {
    const a = JSON.stringify([...actual].sort())
    const e = JSON.stringify([...expected].sort())
    cases.push([name, a === e, `${name}: 期望 ${e},实际 ${a}`])
  }

  // TS 侧:多行 pgTable 写法 + 显式 db 名 + .array()
  const tsSample = `
    export const foo = pgTable(
      'foo_bar',
      {
        id: bigserial('id', { mode: 'number' }).primaryKey(),
        scheduledRunCount: integer('scheduled_run_count').notNull().default(0),
        tags: text('tags').array(),
      },
      (t) => ({ idx: index('ix_foo').on(t.id) }),
    )
  `
  assertEq('TS 列解析(多行写法/显式 db 名/array)',
    extractTsColumnsFromSource(tsSample, 'foo_bar') ?? new Set(),
    ['id', 'scheduled_run_count', 'tags'])
  if (extractTsColumnsFromSource(tsSample, 'no_such_table') !== null) {
    cases.push(['TS 侧不存在的表应返回 null', false, '期望 null'])
  }

  // SQL 侧:CREATE body + 多列 ALTER + 行尾注释跨逗号 + DROP + RENAME
  // (added_later 被 RENAME 正当改名 ⇒ 出处集合里是 renamed_col;legacy 被 DROP ⇒ 不在集合)
  const sqlSample = `
    CREATE TABLE IF NOT EXISTS "foo_bar" (
      "id" bigserial PRIMARY KEY, -- 主键,注释里的逗号, 不应切断
      "scheduled_run_count" integer NOT NULL DEFAULT 0,
      "legacy" varchar(50)
    );
    ALTER TABLE "foo_bar"
      ADD COLUMN IF NOT EXISTS "added_later" varchar(10),
      ADD COLUMN "second_add" integer;
    ALTER TABLE "foo_bar" DROP COLUMN "legacy";
    ALTER TABLE "foo_bar" RENAME COLUMN "added_later" TO "renamed_col";
  `
  const prov = extractColumnProvenanceFromSql(sqlSample)
  assertEq('SQL 列出处(CREATE+ADD+DROP+RENAME 终名)',
    prov.get('foo_bar') ?? new Set(),
    ['id', 'scheduled_run_count', 'renamed_col', 'second_add'])

  // ── 外键名称级维度纯函数自测(2026-11-07) ──
  // 夹具覆盖:ALTER ADD(含 DO $$ 体) / CREATE TABLE 体内 CONSTRAINT / DROP / RENAME /
  // 未加引号折小写 / public. 归一 / 复合 FK 列序。
  const fkSample = `
    CREATE TABLE "users" ("id" uuid PRIMARY KEY);
    CREATE TABLE "agent_examines" (
      "id" uuid PRIMARY KEY,
      "user_id" uuid,
      CONSTRAINT "fk_agent_examines_user_id_users" FOREIGN KEY ("user_id") REFERENCES "users"("id")
    );
    DO $$ BEGIN
      IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname='fk_webhook_subscriptions_user_id_users') THEN
        ALTER TABLE "webhook_subscriptions" ADD CONSTRAINT "fk_webhook_subscriptions_user_id_users" FOREIGN KEY ("user_id") REFERENCES "users"("id");
      END IF;
    END $$;
    ALTER TABLE "agent_examines" DROP CONSTRAINT "fk_agent_examines_user_id_users";
    ALTER TABLE "unquoted" ADD CONSTRAINT FK_Up FOREIGN KEY (User_ID) REFERENCES Public.Users(ID);
    ALTER TABLE "unquoted" RENAME CONSTRAINT FK_Up TO fk_up_renamed;
    CREATE TABLE "pair_owner" ("id" uuid, "a" uuid, "b" uuid,
      CONSTRAINT "fk_pair_owner_pair" FOREIGN KEY ("a", "b") REFERENCES "pair"("x", "y"));
  `
  const fkState = applyForeignKeyEvents(new Map(), extractForeignKeyEventsFromSql(fkSample))
  assertEq(
    'FK 迁移侧抽取(ALTER/CREATE/DROP/RENAME + 折小写)',
    new Set(fkState.keys()),
    [
      'webhook_subscriptions|fk_webhook_subscriptions_user_id_users',
      'unquoted|fk_up_renamed',
      'pair_owner|fk_pair_owner_pair',
    ],
  )
  cases.push([
    'FK DROP CONSTRAINT 按序扣减',
    ![...fkState.values()].some((f) => f.name === 'fk_agent_examines_user_id_users'),
    'agent_examines 的 FK 应被 DROP 扣减',
  ])

  const fkBase = { tableFrom: 't1', columnsFrom: ['x'], tableTo: 't2', columnsTo: ['id'] }
  const fkMig = [
    { ...fkBase, name: 'fk_a' },
    { ...fkBase, name: 'fk_b', columnsFrom: ['y', 'z'], tableTo: 't3', columnsTo: ['p', 'q'] },
  ]
  const fkSame = diffForeignKeys(fkMig, fkMig.map((f) => ({ ...f })))
  cases.push([
    'FK 合法情形不红(两侧同形)',
    fkSame.missing.length === 0 && fkSame.extra.length === 0,
    '两侧同形时 missing/extra 都应 0',
  ])
  const fkMissing = diffForeignKeys(fkMig, [{ ...fkBase, name: 'fk_a' }])
  cases.push([
    'FK 迁移有/声明无 只点名缺的那条',
    fkMissing.missing.length === 1 && fkMissing.missing[0].name === 'fk_b',
    '应只报 fk_b',
  ])
  const fkRenamed = diffForeignKeys(fkMig, [{ ...fkBase, name: 'fk_a_v2' }])
  cases.push([
    'FK 名字不一致 → 同列序也算掉约束',
    fkRenamed.missing.some((f) => f.name === 'fk_a'),
    '名字不一致时 fk_a 也必须出现在 missing',
  ])
  const fkReorder = diffForeignKeys(
    fkMig,
    [{ ...fkBase, name: 'fk_b', columnsFrom: ['z', 'y'], tableTo: 't3', columnsTo: ['p', 'q'] }],
  )
  cases.push([
    'FK 复合列序变化 → 身份键不一致',
    fkReorder.missing.some((f) => f.name === 'fk_b'),
    '列序变化必须判为不同身份',
  ])
  // 阴性对照:把声明侧(等价于 snapshot)里某条 FK 删掉,必须报出该条
  const fkNegative = diffForeignKeys(fkMig, fkMig.filter((f) => f.name !== 'fk_a'))
  cases.push([
    'FK 阴性对照:snapshot 删掉 fk_a 必须报出 fk_a',
    fkNegative.missing.some((f) => f.name === 'fk_a'),
    '删掉声明侧 fk_a 后仍应点名 fk_a',
  ])
  cases.push([
    'FK 动态 DDL(EXECUTE format)记未判定',
    countDynamicDdl(`DO $$ BEGIN EXECUTE format('CREATE TABLE %I (...)', 'x'); END $$;`) === 1,
    'EXECUTE format 应计 1 处未判定',
  ])

  const failed = cases.filter(([, ok]) => !ok)
  for (const [name, ok, msg] of cases) {
    console.log(`  ${ok ? '✅' : '❌'} ${ok ? name : msg}`)
  }
  if (failed.length > 0) {
    console.log(`${C.red}${C.bold}❌ self-test 失败 ${failed.length}/${cases.length}${C.reset}`)
    return 1
  }
  console.log(`${C.green}${C.bold}✅ self-test 通过 ${cases.length}/${cases.length}${C.reset}`)
  return 0
}

// ── §22d 入口守卫:被 import 时零副作用,CLI 直跑才执行 main() ───────────────
// 用 pathToFileURL 归一(本机 Windows argv[1] 是反斜杠盘符路径,手写 'file:///'+ 永不匹配)
const isDirectRun = process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href

if (isDirectRun) {
  main()
    .then((code) => {
      if (code !== 0) process.exit(code)
    })
    .catch((e) => {
      console.error(`❌ check-db-schema-drift 脚本执行异常:`, e?.message ?? e)
      console.error(e?.stack ?? '(no stack)')
      process.exit(2)
    })
}

// 判据单元出口(§22c 唯一真源):镜像测试 import 这份,不得再自抄解析器/白名单
export const __test__ = {
  SCHEMA_DIR,
  MIGRATIONS_DIR,
  DEAD_MIGRATION_WHITELIST,
  DRIZZLE_COLUMN_TYPES,
  COLUMN_RE_SRC,
  NON_COLUMN_LEADS,
  parseTsSchemaTables,
  scanMigrations,
  extractTsColumnsFromSource,
  findCallEnd,
  extractColumnProvenanceFromSql,
  extractForeignKeyEventsFromSql,
  applyForeignKeyEvents,
  countDynamicDdl,
  collectMigrationForeignKeys,
  loadDeclarationForeignKeys,
  foreignKeyKey,
  diffForeignKeys,
}
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
