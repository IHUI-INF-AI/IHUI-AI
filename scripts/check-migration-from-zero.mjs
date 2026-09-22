// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/* eslint-disable no-console -- 守门脚本为 CLI 工具,需 console 输出诊断信息 */
/**
 * O18(2026-09-21):「空库重放整条 drizzle 迁移链」机械化防线。
 *
 * 触发背景:0110_skills_tombstone.sql 用裸 `ADD COLUMN`,而该列早被前面的建表迁移带出,
 * 从空库重放在 110/285 处抛 42701 后 `drizzle-kit migrate` 只 exit 1、**不打原因**。
 * dev 库靠历史增量长出来,这类洞在本地永远不暴露,而任何全新部署(含 deploy/saas 客户
 * 模板)拿到的是残缺 schema。本脚本把该失败模式做成"再犯必红"。
 *
 * 与 check-db-schema-drift.mjs 的分工:那个门做**文本级** CREATE TABLE 比对(快、无需 DB,
 * 但看不见列级洞、也看不见运行期报错);本门做**真实执行** —— 逐迁移重放 + 迁移后库与
 * drizzle 元数据的表/列双向 diff。两者互补,不互替。
 *
 * 流程:
 *   ① 在一次性空库(ihui_fz_<8hex>)上按 _journal.json 顺序**逐个** psql 重放每个迁移,
 *      失败不中断后续,记录 {序号, tag, 错误首行} —— 这正是本轮教训:必须自己按 journal
 *      顺序跑,才能报出"哪一个、为什么"(drizzle-kit 会把原因吞掉)。
 *   ② (默认)另起一个一次性空库跑权威 `drizzle-kit migrate`,确认 drizzle 自己的 runner
 *      也能全链通过;`--skip-full` 跳过(更快)。
 *   ③ 把迁移后的库(pg_catalog,排除分区子表与 __migrations 簿记表)与
 *      packages/database 的 drizzle 元数据(getTableName/getTableColumns)做表集合 +
 *      列名集合双向 diff。
 *   ④ 无论成败**必定** DROP 临时库(除非 --keep)。
 *
 * 判据:迁移链 100% 应用成功 **且** diff 为空 ⇒ exit 0;否则 exit 1 并打印可定位差集。
 *
 * 用法:
 *   node scripts/check-migration-from-zero.mjs              # 全量(②+①+③)
 *   node scripts/check-migration-from-zero.mjs --skip-full   # 只做逐迁移重放 + diff
 *   node scripts/check-migration-from-zero.mjs --keep        # 保留临时库排障
 *
 * 连接串:优先 process.env.DATABASE_URL(CI 注入),否则读 apps/api/.env。
 * 密码只经 PGPASSWORD 环境变量传给 psql 子进程,绝不进 argv、绝不打印、绝不落盘。
 *
 * 退出码:0 全绿 / 1 检出回归或环境不满足 / 2 脚本自身异常(§22d 约定)
 */
import { spawnSync } from 'node:child_process'
import { randomBytes } from 'node:crypto'
import { existsSync, readFileSync, readdirSync, statSync } from 'node:fs'
import { createRequire } from 'node:module'
import { dirname, join, resolve } from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..')
const DRIZZLE_DIR = join(ROOT, 'packages/database/drizzle')
const JOURNAL_PATH = join(DRIZZLE_DIR, 'meta/_journal.json')
const SCHEMA_SRC_DIR = join(ROOT, 'packages/database/src/schema')
const API_ENV_PATH = join(ROOT, 'apps/api/.env')
const DB_PKG_JSON = join(ROOT, 'packages/database/package.json')
/** psql 客户端目录(Windows 本机 PG18);非 win32 走 PATH(CI service container)。 */
const DEFAULT_PG_CLIENT_DIR = 'C:/Program Files/PostgreSQL/18/bin'
/** 迁移链之外合法存在于库中、但 drizzle schema 不定义的对象(簿记/扩展自管)。 */
const IGNORED_MIGRATED_TABLES = new Set(['__migrations'])
/**
 * 运行期自管表(2026-09-21 owner 定夺,表级豁免仅此清单,新增必须同行注明原因):
 * rag_chunks 由迁移 20260919090000 的条件 DO 块(仅当库内已有 pgvector 扩展才执行)与
 * ai-service pgvector_store.py 的运行期 CREATE TABLE IF NOT EXISTS 共同管理,列型为
 * **无界 vector**(≠ knowledge-rag.ts 的 vector1536),刻意不进 drizzle schema——
 * 若声明进 schema,下一次 drizzle-kit generate 会产出无守卫的 CREATE TABLE rag_chunks,
 * 在无 pgvector 的部署环境从"静默跳过"变成硬失败。与 KNOWN_SCHEMA_HOLES 的
 * "多表一律不豁免"不变式不冲突:那条不变式保护的是 **drizzle 托管表**不被 schema 遗忘,
 * 本表从未被 drizzle 托管;若未来该表收回 drizzle 管理,必须先从此清单删除。
 */
const RUNTIME_MANAGED_TABLES = new Set(['rag_chunks'])
/**
 * 已定性并挂起的既有漂移(2026-09-21 首跑实测):这些列由手写迁移创建、drizzle schema 未声明。
 * 与 0110 洞同族("迁移链 ≠ schema"),但补 schema 声明 / 补迁移属业务侧决策,不属本门职责,
 * 故先建基线让门**可采纳**(今日绿),本门只挡**新增**漂移。
 * 规则:① 只豁免下方逐条 (表, 列);② 漂移被修好后本脚本会打印"基线条目已失效,请移除"
 * 提醒(stale),不许留僵尸豁免;③ 新增条目必须在行尾注明原因,不得静默加。
 */
const KNOWN_SCHEMA_HOLES = {
  // O19(2026-09-21):ai_relay_key_pool 4 个配额列 / developer_api_keys 4 列 /
  // resource_github_projects.updated_at 已声明进 drizzle schema,基线对应条目已删除。
  // 下面 ai_model_config_models.metadata 与 extra_metadata(jsonb)语义重叠,属 owner 级
  // 设计决策(两个 jsonb 元数据袋谁为准),未定夺前保留豁免。
  ai_model_config_models: ['metadata'],
  // 0010_fulltext_search_indexes.sql 的 tsvector 列由 PG 触发器维护,刻意不进 ORM 建模
  // (drizzle 0.38 无 tsvector 类型;声明会让 ORM 写触发器托管列 + 丢 3 个 GIN 索引/触发器)
  files: ['search_vector'],
  projects: ['search_vector'],
  users: ['search_vector'],
}
const MAX_REPORTED_FAILURES = 25
const PSQL_TIMEOUT_MS = 180_000
const DRIZZLE_MIGRATE_TIMEOUT_MS = 1_800_000

const C = {
  red: '\x1b[31m',
  green: '\x1b[32m',
  yellow: '\x1b[33m',
  cyan: '\x1b[36m',
  dim: '\x1b[2m',
  bold: '\x1b[1m',
  reset: '\x1b[0m',
}

/* ------------------------------------------------------------------ *
 * 纯函数区(§22c:被 scripts/tests/check-migration-from-zero.test.mjs *
 * 通过 __test__ 直接断言,不得触碰 DB / 子进程 / 文件系统)           *
 * ------------------------------------------------------------------ */

/** 解析 _journal.json 文本 → 按 idx 升序的 { idx, tag, file }(迁移重放顺序的唯一真相)。 */
function parseJournalEntries(jsonText) {
  const parsed = JSON.parse(jsonText)
  const raw = Array.isArray(parsed?.entries) ? parsed.entries : []
  return raw
    .filter(
      (entry) =>
        Number.isFinite(entry?.idx) && typeof entry?.tag === 'string' && entry.tag.length > 0,
    )
    .map((entry) => ({ idx: Number(entry.idx), tag: entry.tag, file: `${entry.tag}.sql` }))
    .sort((a, b) => a.idx - b.idx)
}

/**
 * PG 标识符归一:剥掉外层双引号并还原 `""` 转义。
 * 引号只是**语法**载体(drizzle 生成 DDL 时一律加引号),不属于名字本身,
 * 故 `"users"` 与 `users`、`"OrderItems"` 与 `OrderItems` 必须判为同一个对象。
 * 大小写差异则**保留**给 diffSchemaMaps 单列为 caseDrift(既不当缺失表误报,也不放过真漂移)。
 */
function unquoteIdentifier(raw) {
  const text = String(raw ?? '').trim()
  if (text.length >= 2 && text.startsWith('"') && text.endsWith('"')) {
    return text.slice(1, -1).replace(/""/g, '"')
  }
  return text
}

/** 表/列名集合双向差集:返回 missing(应有而库里没有)、extra(库里多出)、caseDrift(仅大小写不同)。 */
function diffIdentifierSets(expected, actual) {
  const normalize = (set) => {
    /** @type {Map<string, string>} */
    const byKey = new Map()
    for (const raw of set ?? [])
      byKey.set(unquoteIdentifier(raw).toLowerCase(), unquoteIdentifier(raw))
    return byKey
  }
  const exp = normalize(expected)
  const act = normalize(actual)
  const missing = []
  const caseDrift = []
  for (const [key, want] of exp) {
    if (!act.has(key)) missing.push(want)
    else if (act.get(key) !== want) caseDrift.push({ expected: want, actual: act.get(key) })
  }
  const extra = []
  for (const [key, have] of act) {
    if (
      !exp.has(key) &&
      !IGNORED_MIGRATED_TABLES.has(have.toLowerCase()) &&
      !RUNTIME_MANAGED_TABLES.has(have.toLowerCase())
    )
      extra.push(have)
  }
  return { missing: missing.sort(), extra: extra.sort(), caseDrift }
}

/**
 * 表集合 + 每表列名集合的双向 diff。
 * @param {Map<string, Set<string>>} expected drizzle 元数据(权威定义)
 * @param {Map<string, Set<string>>} actual   迁移后数据库实况
 */
function diffSchemaMaps(expected, actual) {
  const tableDiff = diffIdentifierSets(new Set(expected.keys()), new Set(actual.keys()))
  /** 按归一键配对表名,避免大小写/引号造成"两边都看不到对方" */
  const keyOf = (name) => unquoteIdentifier(name).toLowerCase()
  const expByKey = new Map()
  for (const [name, cols] of expected) expByKey.set(keyOf(name), { name, cols })
  const actByKey = new Map()
  for (const [name, cols] of actual) actByKey.set(keyOf(name), { name, cols })

  const columns = []
  for (const [key, want] of expByKey) {
    const have = actByKey.get(key)
    if (!have) continue // 整表缺失已在 tableDiff.missing 报出,不再刷列噪音
    const colDiff = diffIdentifierSets(want.cols, have.cols)
    if (colDiff.missing.length || colDiff.extra.length || colDiff.caseDrift.length) {
      columns.push({ table: want.name, ...colDiff })
    }
  }
  return {
    tables: tableDiff,
    columns: columns.sort((a, b) => a.table.localeCompare(b.table)),
    isEmpty() {
      return (
        tableDiff.missing.length === 0 &&
        tableDiff.extra.length === 0 &&
        tableDiff.caseDrift.length === 0 &&
        columns.length === 0
      )
    },
  }
}

/**
 * 从子进程 stderr/stdout 混合文本里提取**可读的错误首行**。
 * 本轮教训是 drizzle-kit/psql 会把原因埋在噪声里,所以提取规则要稳定:
 * 去掉 `Command failed:` / `psql:file:line: ` / `ERROR:` / `错误:` 前后缀噪声。
 */
function firstErrorLine(text) {
  const lines = String(text ?? '')
    .replace(/\r\n?/g, '\n')
    .split('\n')
    .map((line) => line.trim())
    .filter((line) => line.length > 0)
    .filter((line) => !/^Command failed/i.test(line))
    .filter((line) => !/^node:internal\//.test(line))
    .filter((line) => !/^Stack:/.test(line))
    .filter((line) => !/^\s*at\s/.test(line))
  if (lines.length === 0) return '(无输出)'
  // psql 前缀两种形态都要覆盖:`psql:<file>: ERROR:` 与 `psql:<file>:<line>: ERROR:`;
  // 中文 locale 严重级别是 `错误:`;drizzle-kit 常直接给 `Error: ...`。
  const ERROR_HEAD = /^(?:psql:.*?:\s*)?(?:ERROR|错误|error|fatal|FATAL)\s*[::]\s*/
  const preferred = lines.find((line) => ERROR_HEAD.test(line))
  const withSqlstate = lines.find((line) => /SQLSTATE|state: [0-9A-Z]{5}/i.test(line))
  const picked = preferred ?? withSqlstate ?? lines[0]
  const stripped = picked
    .replace(ERROR_HEAD, '')
    .replace(/^psql:\s*/, '')
    .trim()
  return stripped.length > 0 ? stripped : picked
}

/** 子进程结果 → **脱敏后**的错误首行(所有对外文本统一走这一道)。 */
function errorFrom(result, password) {
  return redactSecrets(firstErrorLine(`${result.stderr ?? ''}\n${result.stdout ?? ''}`), password)
}

/**
 * 用既有漂移基线豁免 diff 的**多列(extra)**方向,其余(缺表/多表/缺列/大小写漂移)一律不豁免;
 * 表级唯一例外是 diffIdentifierSets 内置的 RUNTIME_MANAGED_TABLES(运行期自管,非 drizzle 托管)。
 * 返回 { diff, stale }:stale = 基线里已不再命中的条目(说明洞被补上了,必须删条目)。
 */
function pruneKnownHoles(diff, baseline = KNOWN_SCHEMA_HOLES) {
  const consumed = new Set()
  const columns = []
  for (const entry of diff.columns) {
    const allowed = baseline[entry.table] ?? []
    const extra = []
    for (const column of entry.extra) {
      if (allowed.includes(column)) {
        consumed.add(`${entry.table}.${column}`)
        continue
      }
      extra.push(column)
    }
    if (entry.missing.length || extra.length || entry.caseDrift.length)
      columns.push({ ...entry, extra })
  }
  const stale = Object.entries(baseline)
    .flatMap(([table, cols]) => cols.map((column) => `${table}.${column}`))
    .filter((key) => !consumed.has(key))
    .sort()
  const tables = diff.tables
  return {
    diff: {
      tables,
      columns,
      isEmpty() {
        return (
          tables.missing.length === 0 &&
          tables.extra.length === 0 &&
          tables.caseDrift.length === 0 &&
          columns.length === 0
        )
      },
    },
    stale,
  }
}

/** 逐迁移失败清单 → 可定位报告行(哪个 tag、为什么)。纯文本,着色由调用方负责。 */
function formatReplayFailures(failures, total) {
  const lines = []
  const shown = failures.slice(0, MAX_REPORTED_FAILURES)
  for (const failure of shown) {
    lines.push(`  ✗ #${failure.idx}/${total} ${failure.tag}`)
    lines.push(`      └─ ${failure.error}`)
  }
  if (failures.length > shown.length) {
    lines.push(`  … 另有 ${failures.length - shown.length} 个后续迁移失败(级联噪声,已省略)`)
  }
  return lines
}

/** 把 drizzle schema 导出值筛成 表名 → 列名集合(纯函数,orm 由参数注入,便于测试)。 */
function extractTableMap(values, orm) {
  /** @type {Map<string, Set<string>>} */
  const out = new Map()
  for (const value of values ?? []) {
    if (!value || typeof value !== 'object' || Array.isArray(value)) continue
    if (!isPgTable(value)) continue
    const name = String(orm.getTableName(value))
    const columns = orm.getTableColumns(value) ?? {}
    /** 必须取列对象的 DB 名(col.name):JS 字段名与 DDL 列名可以不同(createdAt vs created_at) */
    const names = Object.entries(columns).map(([key, col]) => String(col?.name ?? key))
    if (!out.has(name)) out.set(name, new Set())
    for (const column of names) out.get(name).add(column)
  }
  return out
}

/** drizzle PgTable 判定:优先 entityKind symbol,回退构造器名(压缩/原型链场景)。 */
function isPgTable(value) {
  for (const sym of Object.getOwnPropertySymbols(value)) {
    if (String(sym).includes('drizzle:EntityKind')) return value[sym] === 'PgTable'
  }
  return value?.constructor?.name === 'PgTable'
}

/** 密码脱敏:仅用于打印/日志,任何完整 URL 都不得输出。 */
function maskDatabaseUrl(raw) {
  const text = String(raw ?? '')
  return text.replace(/^(postgres(?:ql)?:\/\/[^:/@]+:)[^@]*(@)/, '$1***$2')
}

/**
 * 输出脱敏(总闸):drizzle-kit 在 verbose 下可能把连接串打进 stdout,
 * 所以所有取自子进程输出的文本都必须先过这一道 —— URL 形态 + 裸口令一律打码。
 */
function redactSecrets(text, password) {
  let out = maskDatabaseUrl(String(text ?? ''))
  const raw = String(password ?? '')
  if (raw.length > 0) {
    out = out.split(raw).join('***').split(encodeURIComponent(raw)).join('***')
  }
  return out
}

/** 从 .env 文本里取 DATABASE_URL(不打印值)。 */
function readEnvValue(envText, key) {
  for (const line of String(envText ?? '').split(/\r?\n/)) {
    const match = /^\s*(?:export\s+)?([A-Za-z_][A-Za-z0-9_]*)\s*=\s*(.*)$/.exec(line)
    if (!match || match[1] !== key) continue
    return match[2].trim().replace(/^(['"])(.*)\1$/, '$2')
  }
  return ''
}

/* ------------------------------------------------------------------ *
 * 执行区(只在 isDirectRun 下进入)                                    *
 * ------------------------------------------------------------------ */

function resolveBaseUrl() {
  const fromEnv = process.env.DATABASE_URL ?? ''
  const source = fromEnv ? 'process.env.DATABASE_URL' : 'apps/api/.env'
  let raw = fromEnv
  if (!raw && existsSync(API_ENV_PATH))
    raw = readEnvValue(readFileSync(API_ENV_PATH, 'utf8'), 'DATABASE_URL')
  if (!raw) fail(`未找到 DATABASE_URL(env 与 ${API_ENV_PATH} 均为空),无法派生临时库连接串`)
  let url
  try {
    url = new URL(raw.replace(/^postgres:\/\//, 'postgresql://'))
  } catch {
    return fail(`DATABASE_URL 无法解析(${source})`)
  }
  if (!url.hostname || !url.username) fail(`DATABASE_URL(${source}) 缺 host 或 user,无法建临时库`)
  return { url, source, password: decodeURIComponent(url.password) }
}

function fail(message) {
  console.error(`\n${C.red}✗ 无法执行:${C.reset} ${message}\n`)
  throw new MigrationCheckAborted(message)
}

class MigrationCheckAborted extends Error {}

function psqlBin() {
  if (process.platform === 'win32') {
    const candidate = join(process.env.PG_CLIENT_DIR ?? DEFAULT_PG_CLIENT_DIR, 'psql.exe')
    if (existsSync(candidate)) return candidate
    console.warn(`${C.yellow}!${C.reset} 未找到 ${candidate},回退 PATH 上的 psql`)
  }
  return 'psql'
}

/** 连接参数化(密码绝不进 argv),返回 spawnSync 可直接用的参数数组。 */
function connectionArgs(url, database) {
  return ['-h', url.hostname, '-p', url.port || '5432', '-U', url.username, '-d', database]
}

function runPsql(url, password, database, extraArgs, timeoutMs) {
  const bin = psqlBin()
  return spawnSync(
    bin,
    ['-v', 'ON_ERROR_STOP=1', '-q', '--no-psqlrc', ...connectionArgs(url, database), ...extraArgs],
    {
      encoding: 'utf8',
      windowsHide: true,
      timeout: timeoutMs ?? PSQL_TIMEOUT_MS,
      maxBuffer: 32 * 1024 * 1024,
      env: { ...process.env, PGPASSWORD: password, PGCONNECT_TIMEOUT: '15' },
    },
  )
}

/** 在维护库上执行单条语句(CREATE/DROP DATABASE 不能进事务块,故不带 ON_ERROR_STOP 事务包装)。 */
function runMaintenance(url, password, maintenanceDb, sqlText) {
  return runPsql(url, password, maintenanceDb, ['-c', sqlText], 60_000)
}

function createTempDatabase(url, password, maintenanceDb, dbName) {
  const res = runMaintenance(url, password, maintenanceDb, `CREATE DATABASE ${quoteIdent(dbName)}`)
  if (res.status !== 0) fail(`建临时库 ${dbName} 失败:${errorFrom(res, password)}`)
}

function dropTempDatabase(url, password, maintenanceDb, dbName) {
  const res = runMaintenance(
    url,
    password,
    maintenanceDb,
    `DROP DATABASE IF EXISTS ${quoteIdent(dbName)} WITH (FORCE)`,
  )
  if (res.status !== 0) {
    // FORCE 需 PG13+;老版本回退不带 FORCE
    const fallback = runMaintenance(
      url,
      password,
      maintenanceDb,
      `DROP DATABASE IF EXISTS ${quoteIdent(dbName)}`,
    )
    if (fallback.status !== 0) {
      console.error(
        `${C.red}✗ 临时库 ${dbName} 未能清理(需人工 DROP):${C.reset} ${errorFrom(fallback, password)}`,
      )
      return false
    }
  }
  return true
}

function quoteIdent(name) {
  return `"${String(name).replace(/"/g, '""')}"`
}

/** ① 逐迁移重放:失败不中断(便于一次抓全所有洞),记录 tag + 错误首行。 */
function replayMigrations(url, password, dbName, entries) {
  const failures = []
  let applied = 0
  for (const entry of entries) {
    const filePath = join(DRIZZLE_DIR, entry.file)
    if (!existsSync(filePath)) {
      failures.push({ idx: entry.idx, tag: entry.tag, error: `迁移文件缺失:drizzle/${entry.file}` })
      continue
    }
    const res = runPsql(url, password, dbName, ['-f', filePath])
    if (res.status !== 0) {
      failures.push({
        idx: entry.idx,
        tag: entry.tag,
        error:
          res.error?.code === 'ETIMEDOUT'
            ? `psql 超时(${PSQL_TIMEOUT_MS}ms)`
            : errorFrom(res, password),
      })
    } else {
      applied += 1
    }
  }
  return { failures, applied }
}

/** ② 权威路径:drizzle-kit migrate(空库全链)。 */
function runDrizzleKitMigrate(url, password, tempUrl) {
  const cli = resolveDrizzleKitCli()
  if (!cli) return { ok: false, detail: '解析不到 drizzle-kit CLI 入口(先 pnpm install)' }
  const res = spawnSync(process.execPath, [cli, 'migrate'], {
    cwd: join(ROOT, 'packages/database'),
    encoding: 'utf8',
    windowsHide: true,
    timeout: DRIZZLE_MIGRATE_TIMEOUT_MS,
    maxBuffer: 32 * 1024 * 1024,
    env: { ...process.env, DATABASE_URL: tempUrl, PGPASSWORD: password },
  })
  if (res.status !== 0) {
    return {
      ok: false,
      detail:
        res.error?.code === 'ETIMEDOUT' ? 'drizzle-kit migrate 超时' : errorFrom(res, password),
    }
  }
  return { ok: true, detail: '' }
}

function resolveDrizzleKitCli() {
  try {
    const requireFromDb = createRequire(DB_PKG_JSON)
    const main = requireFromDb.resolve('drizzle-kit')
    const candidate = join(dirname(main), 'bin.cjs')
    if (existsSync(candidate)) return candidate
    return main
  } catch {
    return null
  }
}

/** 读 schema 元数据:packages/database/dist/schema/index.js(tsc 产物,与 src 同步由 check:stale-dist 保证)。 */
function loadExpectedSchema() {
  const requireFromDb = createRequire(DB_PKG_JSON)
  let orm
  try {
    orm = requireFromDb('drizzle-orm')
  } catch (error) {
    fail(`无法加载 drizzle-orm 元数据 API:${error?.message ?? error}`)
  }
  const distEntry = join(ROOT, 'packages/database/dist/schema/index.js')
  if (!existsSync(distEntry)) {
    fail(`缺少 ${distEntry};先跑 pnpm --filter @ihui/database build(CI 已内置该步骤)`)
  }
  // 陈旧 dist 会把"src 已声明的列"看成"库里多出来的列"(2026-09-21 实测误报 2 例),
  // 所以 diff 之前必须先确认 dist 不早于 src/schema 最新源文件。
  let newestSource = 0
  let newestFile = ''
  for (const entry of readdirSync(SCHEMA_SRC_DIR)) {
    if (!entry.endsWith('.ts')) continue
    const mtime = statSync(join(SCHEMA_SRC_DIR, entry)).mtimeMs
    if (mtime > newestSource) {
      newestSource = mtime
      newestFile = entry
    }
  }
  if (statSync(distEntry).mtimeMs < newestSource) {
    fail(
      `dist/schema 落后于 src/schema(${newestFile} 更新);先跑 pnpm --filter @ihui/database build 再复跑`,
    )
  }
  let schemaModule
  try {
    schemaModule = requireFromDb(distEntry)
  } catch (error) {
    fail(`加载 dist/schema/index.js 失败:${error?.message ?? error}`)
  }
  const tables = extractTableMap(Object.values(schemaModule), orm)
  if (tables.size === 0) fail('drizzle 元数据里一个 pgTable 都没解析到(判定为脚本失效,不放行)')
  return tables
}

/** ③ 迁移后库实况:public 下基表/分区父表的非删除列。 */
function loadActualSchema(url, password, dbName) {
  const sql = `
SELECT c.relname AS table_name, a.attname AS column_name
FROM pg_class c
JOIN pg_namespace n ON n.oid = c.relnamespace
JOIN pg_attribute a ON a.attrelid = c.oid
WHERE n.nspname = 'public' AND c.relkind IN ('r','p') AND c.relispartition = false
  AND a.attnum > 0 AND NOT a.attisdropped
ORDER BY 1, 2;`
  const res = runPsql(url, password, dbName, ['-At', '-F', '\u0001', '-c', sql], 120_000)
  if (res.status !== 0) {
    fail(`读取迁移后库结构失败:${errorFrom(res, password)}`)
  }
  /** @type {Map<string, Set<string>>} */
  const out = new Map()
  for (const line of String(res.stdout ?? '').split(/\r?\n/)) {
    if (!line.includes('\u0001')) continue
    const [table, column] = line.split('\u0001')
    if (!out.has(table)) out.set(table, new Set())
    out.get(table).add(column)
  }
  if (out.size === 0) fail('迁移后库里 public 一张表都没有(重放实际未生效,不放行)')
  return out
}

function printDiff(diff, expectedSize, actualSize) {
  if (diff.tables.missing.length) {
    console.log(`${C.red}缺表(schema 有、库里没有)[${diff.tables.missing.length}]:${C.reset}`)
    for (const name of diff.tables.missing) console.log(`  - ${name}`)
  }
  if (diff.tables.extra.length) {
    console.log(`${C.red}多表(库里有、schema 没有)[${diff.tables.extra.length}]:${C.reset}`)
    for (const name of diff.tables.extra) console.log(`  + ${name}`)
  }
  if (diff.tables.caseDrift.length) {
    console.log(`${C.red}表名大小写漂移:${C.reset}`)
    for (const item of diff.tables.caseDrift)
      console.log(`  ~ schema "${item.expected}" vs DB "${item.actual}"`)
  }
  for (const entry of diff.columns) {
    const bits = []
    if (entry.missing.length) bits.push(`缺列 [${entry.missing.join(', ')}]`)
    if (entry.extra.length) bits.push(`多列 [${entry.extra.join(', ')}]`)
    if (entry.caseDrift.length)
      bits.push(
        `大小写漂移 [${entry.caseDrift.map((c) => `${c.expected}→${c.actual}`).join(', ')}]`,
      )
    console.log(`${C.red}表 ${entry.table}:${C.reset} ${bits.join(';')}`)
  }
  console.log(`  ${C.dim}(对照:schema ${expectedSize} 表 / 迁移后库 ${actualSize} 表)${C.reset}`)
}

async function main() {
  const argv = process.argv.slice(2)
  if (argv.includes('--help') || argv.includes('-h')) {
    console.log(
      [
        '用法: node scripts/check-migration-from-zero.mjs [--skip-full] [--keep]',
        '  --skip-full  跳过 drizzle-kit migrate(权威全链),只做逐迁移重放 + schema diff',
        '  --keep       保留一次性临时库以便 psql 进去排障',
      ].join('\n'),
    )
    return 0
  }
  const skipFull = argv.includes('--skip-full')
  const keep = argv.includes('--keep')

  const entries = parseJournalEntries(readFileSync(JOURNAL_PATH, 'utf8'))
  if (entries.length === 0) fail(`_journal.json 解析不到任何迁移(${JOURNAL_PATH})`)

  const { url, source, password } = resolveBaseUrl()
  const maintenanceDb = decodeURIComponent(url.pathname.replace(/^\//, '')) || 'postgres'
  const suffix = randomBytes(4).toString('hex')
  const replayDb = `ihui_fz_${suffix}`
  const migrateDb = `ihui_fz_${suffix}m`
  const expected = loadExpectedSchema()

  console.log(
    `${C.cyan}空库重放校验(O18)${C.reset} ${entries.length} 个迁移 · 基库 ${url.username}@${url.hostname}:${url.port || '5432'}/${maintenanceDb} (来源 ${source})`,
  )
  console.log(
    `  ${C.dim}临时库:${replayDb}${skipFull ? '' : ` + ${migrateDb}`}${keep ? '(--keep 保留)' : ',结束后自动 DROP'}${C.reset}`,
  )

  let exitCode = 0
  const created = []
  try {
    createTempDatabase(url, password, maintenanceDb, replayDb)
    created.push(replayDb)
    const { failures, applied } = replayMigrations(url, password, replayDb, entries)
    if (failures.length) {
      exitCode = 1
      console.log(
        `\n${C.red}① 逐迁移重放:停在第 ${failures[0].idx} 个,共 ${failures.length} 个失败(成功 ${applied}/${entries.length})${C.reset}`,
      )
      for (const line of formatReplayFailures(failures, entries.length)) console.log(line)
    } else {
      console.log(`  ${C.green}✓${C.reset} ① 逐迁移重放:${applied}/${entries.length} 全部应用成功`)
    }

    let migrateDbGood = false
    if (!skipFull) {
      createTempDatabase(url, password, maintenanceDb, migrateDb)
      created.push(migrateDb)
      const tempUrl = new URL(url.href)
      tempUrl.pathname = `/${migrateDb}`
      const migrate = runDrizzleKitMigrate(url, password, tempUrl.toString())
      if (!migrate.ok) {
        exitCode = 1
        console.log(`\n${C.red}② drizzle-kit migrate 失败:${C.reset} ${migrate.detail}`)
      } else {
        migrateDbGood = true
        console.log(`  ${C.green}✓${C.reset} ② drizzle-kit migrate 全链通过`)
      }
    } else {
      console.log(`  ${C.yellow}-${C.reset} ② 已按 --skip-full 跳过 drizzle-kit migrate`)
    }

    // diff 基准:权威 drizzle-kit 库跑通了就用它;否则退回逐迁移重放库(诊断信息更全)
    const diffDb = migrateDbGood ? migrateDb : replayDb
    const actual = loadActualSchema(url, password, diffDb)
    const rawDiff = diffSchemaMaps(expected, actual)
    const rawTablesExtra = rawDiff.tables.extra.length
    const { diff, stale } = pruneKnownHoles(rawDiff)
    if (diff.isEmpty()) {
      const exemptedCols = rawDiff.columns.length - diff.columns.length
      const exemptedTables = rawTablesExtra - diff.tables.extra.length
      const bits = []
      if (exemptedCols > 0) bits.push(`${exemptedCols} 处命中 KNOWN_SCHEMA_HOLES 既有基线`)
      if (exemptedTables > 0)
        bits.push(`${exemptedTables} 张命中 RUNTIME_MANAGED_TABLES 运行期自管豁免`)
      const note = bits.length > 0 ? `(${bits.join(';')})` : ''
      console.log(
        `  ${C.green}✓${C.reset} ③ schema diff(对照 ${diffDb}):表集合 + 列集合双向为空${note}`,
      )
    } else {
      exitCode = 1
      console.log(`\n${C.red}③ schema diff 非空(对照库 ${diffDb})${C.reset}`)
      printDiff(diff, expected.size, actual.size)
    }
    if (stale.length) {
      console.log(
        `${C.yellow}▲ 基线条目已失效(漂移被修好或被改名),请从 KNOWN_SCHEMA_HOLES 删除:${C.reset}\n  ${stale.join('\n  ')}`,
      )
    }
  } catch (error) {
    if (!(error instanceof MigrationCheckAborted)) {
      console.error(`${C.red}脚本异常:${C.reset} ${error?.stack ?? error}`)
      return 2
    }
    exitCode = 1
  } finally {
    if (keep) {
      console.log(
        `\n${C.yellow}--keep:保留临时库${C.reset} ${created.join(', ')}(排障完请手工 DROP)`,
      )
    } else {
      for (const dbName of created) dropTempDatabase(url, password, maintenanceDb, dbName)
    }
  }
  console.log(
    exitCode === 0
      ? `\n${C.green}结论:PASS${C.reset}\n`
      : `\n${C.red}结论:FAIL(exit 1)${C.reset}\n`,
  )
  return exitCode
}

const isDirectRun = process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href

if (isDirectRun) {
  main()
    .then((code) => process.exit(code))
    .catch((error) => {
      console.error(`❌ ${error?.message ?? error}\n${error?.stack ?? ''}`)
      process.exit(2)
    })
}

export const __test__ = {
  parseJournalEntries,
  unquoteIdentifier,
  diffIdentifierSets,
  diffSchemaMaps,
  pruneKnownHoles,
  KNOWN_SCHEMA_HOLES,
  RUNTIME_MANAGED_TABLES,
  firstErrorLine,
  errorFrom,
  formatReplayFailures,
  extractTableMap,
  isPgTable,
  maskDatabaseUrl,
  redactSecrets,
  readEnvValue,
  quoteIdent,
  MigrationCheckAborted,
}
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
