// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠


import { test } from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync, readdirSync } from 'node:fs'
import { join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

// §22c:直接 import 源脚本导出的 __test__,不维护任何"镜像常量",杜绝源/测两份真相漂移。
// §22d:源脚本的 main() 受 isDirectRun 守护,被 import 时不得有任何副作用。
import { __test__ as src } from '../check-config-table-existence.mjs'

const ROOT = resolve(fileURLToPath(import.meta.url), '..', '..', '..')
const CATALOG_REL = 'packages/types/src/capability-catalog.ts'
const SCHEMA_DIR_REL = 'packages/database/src/schema'

test('导入源模块不得触发 main() 副作用(§22d isDirectRun)', () => {
  for (const key of [
    'extractComputeAllowedTables',
    'extractSchemaObjectNames',
    'diffTablesAgainstSchema',
    'splitMissingByWhitelist',
    'parseEnvTableList',
    'KNOWN_GHOST_TABLES',
  ]) {
    assert.ok(key in src, `__test__ 缺少导出键 ${key}`)
  }
})

test('extractComputeAllowedTables: 数组字面量提取(忽略行/块注释)', () => {
  const sample = `/** 头注释 */
export const COMPUTE_ALLOWED_TABLES = [
  'llm_call_logs',
  // 行注释
  'agent_runs', /* 块注释 */
  'agent_checkpoints',
] as const
export type X = (typeof COMPUTE_ALLOWED_TABLES)[number]`
  assert.deepEqual(
    src.extractComputeAllowedTables(sample),
    ['llm_call_logs', 'agent_runs', 'agent_checkpoints'],
  )
})

test('extractComputeAllowedTables: 数组不存在返回 null(结构被改坏)', () => {
  assert.equal(src.extractComputeAllowedTables('export const OTHER = [1]'), null)
  assert.equal(src.extractComputeAllowedTables('export const COMPUTE_ALLOWED_TABLES = notArray'), null)
})

test('extractSchemaObjectNames: 跨行/单行 pgTable + pgView 全识别', () => {
  const sample = `export const t1 = pgTable(
  'alpha_logs',
  { id: integer().primaryKey() },
)
export const t2 = pgTable('beta_runs', {})
export const v1 = pgView('gamma_view', sql\`select 1\`)
export const mv = pgMaterializedView('delta_mv', sql\`select 1\`)`
  const names = src.extractSchemaObjectNames(sample)
  assert.ok(names.has('alpha_logs'))
  assert.ok(names.has('beta_runs'))
  assert.ok(names.has('gamma_view'))
  assert.ok(names.has('delta_mv'))
})

test('extractSchemaObjectNames: 变量名不进集合(宁漏不误报)', () => {
  assert.ok(!src.extractSchemaObjectNames("const dynamic = pgTable(nameVar, {})").has('nameVar'))
})

test('diffTablesAgainstSchema: 幽灵表被判缺,存在表进 ok', () => {
  const schema = new Set(['alpha_logs', 'beta_runs'])
  const r = src.diffTablesAgainstSchema(['alpha_logs', 'ghost_table'], schema)
  assert.deepEqual(r.missing, ['ghost_table'])
  assert.deepEqual(r.ok, ['alpha_logs'])
})

test('splitMissingByWhitelist: 存量豁免与新增分离', () => {
  const split = src.splitMissingByWhitelist(['ghost_table', 'agent_runs'])
  assert.equal(split.whitelisted.length, 1)
  assert.equal(split.fresh.length, 1)
  assert.equal(split.whitelisted[0], 'agent_runs')
  assert.equal(split.fresh[0], 'ghost_table')
})

test('splitMissingByWhitelist: 白名单外新增即 fresh', () => {
  const split = src.splitMissingByWhitelist(['brand_new_thing'])
  assert.equal(split.fresh.length, 1)
  assert.equal(split.whitelisted.length, 0)
})

test('parseEnvTableList: 引号包裹+逗号分隔', () => {
  assert.deepEqual(src.parseEnvTableList('COMPUTE_ALLOWED_TABLES="a_logs, b_logs"'), ['a_logs', 'b_logs'])
})

test('parseEnvTableList: 注释行跳过', () => {
  assert.deepEqual(
    src.parseEnvTableList('# 注释\nCOMPUTE_ALLOWED_TABLES=a_logs,b_logs'),
    ['a_logs', 'b_logs'],
  )
})

test('parseEnvTableList: 空值/无键 = 未覆盖(返回 null)', () => {
  assert.equal(src.parseEnvTableList('COMPUTE_ALLOWED_TABLES='), null)
  assert.equal(src.parseEnvTableList('OTHER=x'), null)
  assert.equal(src.parseEnvTableList(''), null)
})

test('真实文件冒烟: catalog 可解析 7 表 + schema 含 llm_call_logs + 白名单含 2 幽灵表', () => {
  const catalogPath = join(ROOT, CATALOG_REL)
  const allowed = src.extractComputeAllowedTables(readFileSync(catalogPath, 'utf8'))
  assert.ok(Array.isArray(allowed), '真实 catalog: COMPUTE_ALLOWED_TABLES 可解析')
  assert.equal(allowed.length, 7, '真实 catalog: 7 个表名')
  assert.ok(allowed.includes('api_key_usage_windows'), '真实 catalog: 含计划已知幽灵表 api_key_usage_windows')

  const schemaDir = join(ROOT, SCHEMA_DIR_REL)
  const schemaObjects = new Set()
  for (const name of readdirSync(schemaDir)) {
    if (!name.endsWith('.ts')) continue
    for (const n of src.extractSchemaObjectNames(readFileSync(join(schemaDir, name), 'utf8'))) {
      schemaObjects.add(n)
    }
  }
  assert.ok(schemaObjects.size > 100, `真实 schema: 对象集合非空(${schemaObjects.size} > 100)`)
  assert.ok(schemaObjects.has('llm_call_logs'), '真实 schema: llm_call_logs 在集合中')
  // 反向断言:两个白名单表确实不在 schema(白名单登记依据仍成立,防解析面漂移)
  assert.ok(!schemaObjects.has('api_key_usage_windows'), '真实 schema: api_key_usage_windows 不在(白名单依据成立)')
  assert.ok(!schemaObjects.has('agent_runs'), '真实 schema: agent_runs 不在(白名单依据成立)')

  assert.ok('api_key_usage_windows' in src.KNOWN_GHOST_TABLES, '白名单含 api_key_usage_windows')
  assert.ok('agent_runs' in src.KNOWN_GHOST_TABLES, '白名单含 agent_runs')
  assert.equal(Object.keys(src.KNOWN_GHOST_TABLES).length, 2, '白名单条数=2(只减不增基线)')
})
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
