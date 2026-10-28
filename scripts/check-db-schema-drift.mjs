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
 *
 * 用法: node scripts/check-db-schema-drift.mjs
 *   无参数: 全量扫描,发现 migration 缺失 exit 1,无问题 exit 0
 *   --staged: pre-commit 模式(同上,因为 schema drift 是全局问题)
 *   --self-test: 内存断言(不落盘不连网),校验列解析函数本身
 */
import { readFileSync, readdirSync, existsSync, statSync } from 'node:fs'
import { join } from 'node:path'
import { pathToFileURL } from 'node:url'

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

  if (joinedTables === 0) {
    // 枚举到 0 张可对照表 ⇒ 无法判定,不记绿(与守门 117/157 的"枚举到 0 判死"口径同形)
    console.log(
      `${C.red}${C.bold}❌ 无法判定:可做列级对照的表为 0(schema 目录或 migration 目录缺失/为空?)${C.reset}`,
    )
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
}
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
