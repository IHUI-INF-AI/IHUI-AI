// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠


/**
 * O20d 守门:配置表名存在性机械门(check-config-table-existence.mjs)
 *
 * 背景(2026-09-23 立,PROJECT_PLAN O20d):生产配置 COMPUTE_ALLOWED_TABLES 含一个
 * **不存在**的表名 `api_key_usage_windows`(真实表是 `key_rate_window_counts` 与
 * `api_key_minute_usage`)。该常量被 `apps/api/src/utils/scoped-guard.ts:39` 消费,
 * 是 compute 能力的 DB 白名单 —— 清单里指向不存在的表,意味着那次改名/建表决策
 * 悄悄把"本该放行的表"变成了 DATA_ACCESS_DENIED(或反之),而 typecheck/单测全绿。
 * 与 O19 抓到的"配置反向漂移"同族:允许清单随重命名悄悄失配。本门把这类失配
 * 变成机械可证:**清单里每个表名必须存在于 drizzle schema,不存在即红**。
 *
 * 判据(机械可证,宁漏不误报):
 *   R1 代码清单:packages/types/src/capability-catalog.ts 的 `COMPUTE_ALLOWED_TABLES`
 *      数组中每个字符串字面量,必须能在 packages/database/src/schema/*.ts 的
 *      pgTable/pgView 首参字面量里找到。
 *   R2 .env 覆盖清单:apps/api/.env 若定义了 `COMPUTE_ALLOWED_TABLES=...`(逗号
 *      分隔),同样逐个校验(.env 不入仓,本机可读;文件不存在或值为空 = 未覆盖,
 *      跳过并计数打印,不猜测)。
 *   R3 锚点完整性:提取不到 COMPUTE_ALLOWED_TABLES 数组 / schema 对象集合为空,
 *      视为结构被改坏,按失败处理(判据失效不得静默放行)。
 *
 * "宁漏不误报"边界:动态拼出的表名(模板串变量、re-export 转发)不在解析面内,
 * 漏抓只会"少红"不会"错红";真实表改名后旧名留在清单里,本门必然红 —— 这正是
 * 它要拦的失配。
 *
 * 存量白名单(ratchet,同 check-admin-gate-consistency.mjs 模式):首跑(2026-09-23)
 * 实抓 2 个真实幽灵表 —— `api_key_usage_windows`(计划已知)与 `agent_runs`(本轮
 * 机械门首跑的计划外新发现,packages/database 全域无此表定义)。packages 侧本轮
 * 只读不修,故按"存量显式豁免 + 条数只减不增"棘轮登记:白名单外的任何新幽灵表
 * 立即红;收敛(修 capability-catalog.ts 后)须同步删除对应白名单行。
 *
 * 模式:
 *   node scripts/check-config-table-existence.mjs            # 全量审计(毫秒级,可常驻)
 *   node scripts/check-config-table-existence.mjs --self-test
 * 退出码:0 通过 / 1 判据失败(缺口清单或锚点缺失) / 2 脚本自身异常。
 *
 * 当前接入:guardian-runner id '75',blocking + stagedTriggers(能力目录常量 /
 * schema 目录 / 本脚本进暂存区才跑)。
 */

import { existsSync, readdirSync, readFileSync } from 'node:fs'
import { join, resolve } from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'

const ROOT = resolve(fileURLToPath(import.meta.url), '..', '..')
const CATALOG_REL = 'packages/types/src/capability-catalog.ts'
const SCHEMA_DIR_REL = 'packages/database/src/schema'
const ENV_REL = 'apps/api/.env'

/**
 * 存量幽灵表白名单(2026-09-23 首跑登记,只减不增)。
 * reason 记录失配成因与收敛路径;修复 capability-catalog.ts 后必须删除对应行。
 */
export const KNOWN_GHOST_TABLES = {
  api_key_usage_windows: {
    reason: 'O20d 存量(计划已知):真实表为 key_rate_window_counts / api_key_minute_usage,改名后清单未跟上',
  },
  agent_runs: {
    reason: 'O20d 存量(2026-09-23 机械门首跑新发现):packages/database 全域无此表定义,清单指向空表',
  },
}

// ══════════════ 纯函数层(零副作用,经 __test__ 供 §22c 镜像测试直接 import) ══════════════


/**
 * 从能力目录源码提取 COMPUTE_ALLOWED_TABLES 数组的字符串字面量。
 * 解析:定位 `export const COMPUTE_ALLOWED_TABLES = [`,从 `[` 起括号配平到闭合 `]`,
 * 再抓其中的 'xxx' 字面量(数组元素间夹 JSDoc 注释不影响)。
 * 返回 null = 数组不存在(结构被改坏),调用方按失败处理。
 */
export function extractComputeAllowedTables(tsSource) {
  const anchor = 'export const COMPUTE_ALLOWED_TABLES'
  const declAt = tsSource.indexOf(anchor)
  if (declAt === -1) return null
  const openAt = tsSource.indexOf('[', declAt)
  if (openAt === -1) return null
  let depth = 0
  let end = -1
  for (let i = openAt; i < tsSource.length; i += 1) {
    const ch = tsSource[i]
    if (ch === '[') depth += 1
    else if (ch === ']') {
      depth -= 1
      if (depth === 0) {
        end = i
        break
      }
    }
  }
  if (end === -1) return null
  const body = tsSource.slice(openAt, end + 1)
  const out = []
  const RE = /(['"`])([a-z][a-z0-9_]*)\1/g
  let m
  while ((m = RE.exec(body)) !== null) out.push(m[2])
  return out
}

/**
 * 从 schema 源文本提取 drizzle 对象首参字面量表名。
 * pgTable('name', …) / pgView('name', …) 都算可查对象(compute 白名单语义是
 * "可被 SQL 触达的表",视图同面)。跨行写法(`pgTable(\n  'name',`)靠 \s* 兼容。
 * 动态名/变量名不在解析面内(宁漏不误报:漏抓少红,不产生假缺表)。
 */
export function extractSchemaObjectNames(tsSource) {
  const out = new Set()
  const RE = /\bpg(?:Table|View|MaterializedView)\s*\(\s*(['"`])([a-z][a-z0-9_]*)\1/g
  let m
  while ((m = RE.exec(tsSource)) !== null) out.add(m[2])
  return out
}

/** R1/R2 共用比对:清单中不存在于 schema 对象集合的表名。 */
export function diffTablesAgainstSchema(allowedTables, schemaObjectNames) {
  const missing = []
  for (const t of allowedTables) {
    if (!schemaObjectNames.has(t)) missing.push(t)
  }
  return { missing, ok: allowedTables.filter((t) => schemaObjectNames.has(t)) }
}

/** 拆分 missing:存量白名单豁免(不计失败) vs 白名单外新增(新失配,failure)。 */
export function splitMissingByWhitelist(missing) {
  const whitelisted = missing.filter((t) => Boolean(KNOWN_GHOST_TABLES[t]))
  const fresh = missing.filter((t) => !KNOWN_GHOST_TABLES[t])
  return { whitelisted, fresh }
}

/**
 * 解析 .env 文本中的 COMPUTE_ALLOWED_TABLES 行。
 * 返回 null = 未定义(或定义为空)→ 调用方按"未覆盖"跳过,不猜测语义。
 * 非空 = 逗号分隔清单(剥引号/空白)。
 */
export function parseEnvTableList(envText) {
  if (!envText) return null
  for (const rawLine of envText.split(/\r?\n/)) {
    const line = rawLine.trim()
    if (!line || line.startsWith('#')) continue
    const m = line.match(/^COMPUTE_ALLOWED_TABLES\s*=\s*(.*)$/)
    if (!m) continue
    const items = m[1]
      .trim()
      .replace(/^["']|["']$/g, '')
      .split(',')
      .map((s) => s.trim())
      .filter(Boolean)
    return items.length > 0 ? items : null
  }
  return null
}

// ══════════════ main ══════════════

function listSchemaFiles() {
  const dir = join(ROOT, SCHEMA_DIR_REL)
  if (!existsSync(dir)) return []
  return readdirSync(dir)
    .filter((n) => n.endsWith('.ts'))
    .map((n) => join(dir, n))
}

async function main() {
  const args = process.argv.slice(2)
  if (args.includes('--self-test')) {
    process.exit(runSelfTest() ? 0 : 1)
  }

  // 锚点 1:能力目录常量
  const catalogPath = join(ROOT, CATALOG_REL)
  if (!existsSync(catalogPath)) {
    console.error(`[config-table] 找不到能力目录 ${CATALOG_REL} —— 判据锚点缺失,按失败处理`)
    process.exit(1)
  }
  const allowed = extractComputeAllowedTables(readFileSync(catalogPath, 'utf8'))
  if (!allowed) {
    console.error(`[config-table] ${CATALOG_REL} 中提取不到 COMPUTE_ALLOWED_TABLES 数组 —— 结构被改坏,按失败处理`)
    process.exit(1)
  }

  // 锚点 2:schema 对象集合
  const schemaFiles = listSchemaFiles()
  if (schemaFiles.length === 0) {
    console.error(`[config-table] schema 目录 ${SCHEMA_DIR_REL} 不存在或无 .ts 文件 —— 判据锚点缺失,按失败处理`)
    process.exit(1)
  }
  const schemaObjects = new Set()
  for (const f of schemaFiles) {
    for (const name of extractSchemaObjectNames(readFileSync(f, 'utf8'))) schemaObjects.add(name)
  }
  if (schemaObjects.size === 0) {
    console.error('[config-table] schema 解析出 0 个对象 —— 结构被改坏,按失败处理')
    process.exit(1)
  }

  const failures = []
  const r1 = diffTablesAgainstSchema(allowed, schemaObjects)
  const r1Split = splitMissingByWhitelist(r1.missing)
  for (const t of r1Split.fresh) {
    failures.push(
      `R1 ${CATALOG_REL} 的 COMPUTE_ALLOWED_TABLES 含不存在的表名 '${t}' —— 运行时 compute 白名单指向空表(DATA_ACCESS_DENIED)。` +
        `修法:改为 schema 中的真实表名,或从清单删除`,
    )
  }

  // R2:.env 覆盖清单(.env 不入仓,本机可读;不存在 = 未覆盖)
  const envPath = join(ROOT, ENV_REL)
  /** @type {string[]} R2 的 missing(未覆盖时为空)。 */
  let r2Missing = []
  let envState = '文件不存在(未覆盖,跳过)'
  if (existsSync(envPath)) {
    const envList = parseEnvTableList(readFileSync(envPath, 'utf8'))
    if (envList === null) {
      envState = '未定义(未覆盖,跳过)'
    } else {
      const r2 = diffTablesAgainstSchema(envList, schemaObjects)
      r2Missing = r2.missing
      envState = `覆盖 ${envList.length} 表`
      for (const t of splitMissingByWhitelist(r2Missing).fresh) {
        failures.push(`R2 ${ENV_REL} 的 COMPUTE_ALLOWED_TABLES 覆盖含不存在的表名 '${t}' —— 运行时白名单指向空表`)
      }
    }
  }

  // 白名单收敛检测:存量表名已不再 missing(清单已修)→ 提示删行(不阻塞)。
  const collected = new Set([...r1.missing, ...r2Missing])
  const collectible = Object.keys(KNOWN_GHOST_TABLES).filter((t) => !collected.has(t))

  const whitelistedTotal = splitMissingByWhitelist([...r1.missing, ...r2Missing]).whitelisted
  console.log(
    `[config-table] 代码清单=${allowed.length} 表(来源 ${CATALOG_REL}) · ` +
      `schema 对象=${schemaObjects.size}(来源 ${SCHEMA_DIR_REL}/*.ts ${schemaFiles.length} 文件) · ` +
      `env ${envState} · 存量白名单命中=${whitelistedTotal.length}/${Object.keys(KNOWN_GHOST_TABLES).length}`,
  )
  if (collectible.length > 0) {
    console.warn(`[config-table] 白名单可收敛(表名已修复,请删对应登记行): ${collectible.join(', ')}`)
  }
  if (failures.length > 0) {
    for (const f of failures) console.error(`  ✗ ${f}`)
    console.error(`[config-table] ❌ ${failures.length} 项失配(允许清单必须与 drizzle schema 对齐)`)
    process.exit(1)
  }
  console.log(`[config-table] ✅ 无白名单外失配(新增幽灵表=0);存量 ${whitelistedTotal.length} 项待收敛,清单见 KNOWN_GHOST_TABLES`)
}

/** §22d 双形态入口守护:测试 import 不触发 CLI 副作用。 */
const isDirectRun = process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href
if (isDirectRun) {
  main().catch((e) => {
    console.error(`❌ ${e?.message ?? e}\n${e?.stack ?? ''}`)
    process.exit(2)
  })
}

// ─── self-test(逻辑自检 + 真实文件冒烟,与 scripts/tests 单测互补) ───
function runSelfTest() {
  let ok = true
  const assert = (cond, msg) => {
    if (!cond) {
      ok = false
      console.error(`[self-test] ✗ ${msg}`)
    }
  }

  const sampleCatalog = `/** 注释 */
export const COMPUTE_ALLOWED_TABLES = [
  'llm_call_logs',
  // 历史表
  'agent_runs', /* 块注释 */
  'agent_checkpoints',
] as const
export type X = (typeof COMPUTE_ALLOWED_TABLES)[number]`
  assert(
    JSON.stringify(extractComputeAllowedTables(sampleCatalog)) ===
      JSON.stringify(['llm_call_logs', 'agent_runs', 'agent_checkpoints']),
    'extractComputeAllowedTables: 提取三表(忽略行/块注释)',
  )
  assert(extractComputeAllowedTables('export const OTHER = [1]') === null, 'extractComputeAllowedTables: 数组不存在返回 null')

  const sampleSchema = `export const t1 = pgTable(
  'alpha_logs',
  { id: integer().primaryKey() },
)
export const t2 = pgTable('beta_runs', {})
export const v1 = pgView('gamma_view', sql\`select 1\`)`
  const names = extractSchemaObjectNames(sampleSchema)
  assert(
    names.has('alpha_logs') && names.has('beta_runs') && names.has('gamma_view'),
    'extractSchemaObjectNames: 跨行/单行 pgTable + pgView 全识别',
  )
  assert(!extractSchemaObjectNames("const dynamic = pgTable(nameVar, {})").has('nameVar'), 'extractSchemaObjectNames: 变量名不进集合')

  const diff = diffTablesAgainstSchema(['alpha_logs', 'ghost_table'], names)
  assert(JSON.stringify(diff.missing) === JSON.stringify(['ghost_table']), 'diffTablesAgainstSchema: 幽灵表被判缺')
  assert(diff.ok.length === 1, 'diffTablesAgainstSchema: 存在表进 ok')

  const split = splitMissingByWhitelist(['ghost_table', 'agent_runs'])
  assert(split.whitelisted.length === 1 && split.fresh.length === 1, 'splitMissingByWhitelist: 存量豁免与新增分离')
  assert(split.fresh[0] === 'ghost_table' && split.whitelisted[0] === 'agent_runs', 'splitMissingByWhitelist: 归类正确')
  assert(splitMissingByWhitelist(['brand_new_thing']).fresh.length === 1, 'splitMissingByWhitelist: 白名单外新增即 fresh')

  assert(parseEnvTableList('COMPUTE_ALLOWED_TABLES="a_logs, b_logs"') !== null, 'parseEnvTableList: 引号包裹+逗号分隔')
  assert(
    JSON.stringify(parseEnvTableList('# 注释\nCOMPUTE_ALLOWED_TABLES=a_logs,b_logs')) === JSON.stringify(['a_logs', 'b_logs']),
    'parseEnvTableList: 注释行跳过',
  )
  assert(parseEnvTableList('COMPUTE_ALLOWED_TABLES=') === null, 'parseEnvTableList: 空值 = 未覆盖')
  assert(parseEnvTableList('OTHER=x') === null, 'parseEnvTableList: 无该键 = 未覆盖')

  // 真实文件冒烟:真实目录应可解析且当前缺口必须暴露(api_key_usage_windows 不在 schema)
  try {
    const realAllowed = extractComputeAllowedTables(readFileSync(join(ROOT, CATALOG_REL), 'utf8'))
    assert(Array.isArray(realAllowed) && realAllowed.length >= 5, '真实目录: COMPUTE_ALLOWED_TABLES 可解析(≥5 表)')
    const realObjects = new Set()
    for (const f of listSchemaFiles()) {
      for (const n of extractSchemaObjectNames(readFileSync(f, 'utf8'))) realObjects.add(n)
    }
    assert(realObjects.size > 100, '真实目录: schema 对象集合非空(>100)')
    assert(realObjects.has('llm_call_logs'), '真实目录: llm_call_logs 在集合中')
    // agent_runs / api_key_usage_windows 已确认为真实幽灵表(O20d 白名单登记),反向断言防解析面漂移:
    assert(!realObjects.has('agent_runs'), '真实目录: agent_runs 不在 schema(白名单登记依据仍成立)')
  } catch (e) {
    assert(false, `真实文件冒烟异常: ${e?.message}`)
  }

  console.log(ok ? '[self-test] ✅ 全部断言通过' : '[self-test] ❌ 有断言失败')
  return ok
}

export const __test__ = {
  extractComputeAllowedTables,
  extractSchemaObjectNames,
  diffTablesAgainstSchema,
  splitMissingByWhitelist,
  parseEnvTableList,
  KNOWN_GHOST_TABLES,
}
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
