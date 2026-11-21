#!/usr/bin/env node
// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
/**
 * BUG-29 补丁草案生成器（只读 audit.json → 输出草案 SQL/文本）。
 *
 * 用途(2026-11-18 机主定档「暂不授权生产只读查询,仅凭仓库面先开专票」):
 *   把 scripts/data/bug29-index-audit.json 里已量化的两格程序化导出成草案,
 *   供后续专票落地时审用。**草案只落 scripts/data/bug29-patch-draft/,绝不写
 *   packages/database/drizzle/(真实迁移目录)——不碰 journal,不触 prod 对账。**
 *
 * 两格:
 *   格1 FK 无索引(131) → 草案 CREATE INDEX IF NOT EXISTS(列名/表名可从 audit 推,行数待现场)
 *   格4 列类型冲突(15,含 8 破坏性) → 草案 ALTER TABLE ... ALTER COLUMN ... TYPE 模板,
 *       **ALTER 方向(以 schema 为准 vs 以现网为准)未定 ⇒ 生成两分支候选,标 TODO 待现场查**
 *
 * 现场核到实际类型/行数后,把结果填进 audit.json 的 `prodFacts` 字段再重跑本器,
 * 草案即自动带上真实 CONCURRENTLY 判定与最终 ALTER 方向——不让数字靠手抄。
 *
 * 用法: node scripts/data/bug29-patch-draft/generate-drafts.mjs [--check]
 *   --check  仅校验 audit.json 可解析 + 草案可生成,不落盘(给门禁用)
 * 退出码:0 成功 / 1 audit.json 缺失或不可解析 / 2 生成失败
 */
import { readFileSync, writeFileSync, existsSync, mkdirSync, readdirSync } from 'node:fs'
import { join, dirname, resolve } from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'

const HERE = dirname(fileURLToPath(import.meta.url))
const ROOT = resolve(HERE, '..', '..', '..') // scripts/data/bug29-patch-draft → 仓根
const AUDIT = join(HERE, '..', 'bug29-index-audit.json')
const OUT_DIR = HERE

function loadAudit() {
  if (!existsSync(AUDIT)) {
    console.error(`未判定:audit.json 缺失 ⇒ ${AUDIT}`)
    process.exit(1)
  }
  try {
    return JSON.parse(readFileSync(AUDIT, 'utf8'))
  } catch (e) {
    console.error(`未判定:audit.json 不可解析 ⇒ ${e.message}`)
    process.exit(1)
  }
}

/** 格1 FK 对直接取自 audit.json 的 grid1_fk_no_index.pairs(单一真相源,由扫描器写入)。
 *  生成器只消费不重算——避免第二份 FK 判据与 audit 漂移(§0.6)。 */
function fkPairsOf(audit) {
  return (audit.grid1_fk_no_index && audit.grid1_fk_no_index.pairs) || []
}

function snake(name) {
  return name.replace(/([a-z0-9])([A-Z])/g, '$1_$2').toLowerCase()
}

function buildGrid1(audit, fkPairs) {
  const lines = []
  lines.push(`-- BUG-29 格1 补齐草案:外键列无索引(${audit.grid1_fk_no_index.count} 处 / FK 声明总数 ${audit.grid1_fk_no_index.fk_total})`)
  lines.push(`-- 生成:${new Date().toISOString().slice(0, 10)} · 由 generate-drafts.mjs 程序化导出,非手抄`)
  lines.push(`-- 状态:草案,未落 packages/database/drizzle/。专票落地时:① 现场查各表行数定 CONCURRENTLY;`)
  lines.push(`--        ② 复制进真实迁移文件(命名 <ts>_bug29_fk_indexes.sql)并跑生产 db:migrate 验证。`)
  lines.push(`-- 注:建索引持 ShareLock;表超千万行改 CREATE INDEX CONCURRENTLY(不能在事务块内跑)。`)
  lines.push(``)
  let n = 0
  for (const p of fkPairs) {
    const idxName = `${p.table}_${snake(p.column)}_idx`
    lines.push(`CREATE INDEX IF NOT EXISTS "${idxName}" ON "${p.table}" ("${snake(p.column)}"); -- TODO: 行数>1e7 改 CONCURRENTLY`)
    n++
  }
  lines.push(``)
  lines.push(`-- 共 ${n} 条(= audit.grid1_fk_no_index.count=${audit.grid1_fk_no_index.count})`)
  return { name: 'grid1-fk-indexes.draft.sql', body: lines.join('\n'), count: n }
}

const DESTROY_KEYS = new Set(['serial', 'bigserial', 'integer', 'bigint', 'uuid'])

function buildGrid4(audit) {
  const conflicts = (audit.grid4_col_type_conflicts || audit.col_type_conflicts || [])
  const lines = []
  lines.push(`# BUG-29 格4 补齐草案:同表两份 DDL 列类型不同(${conflicts.length} 处,其中破坏性 ${conflicts.filter((c) => Object.keys(c.types).some((k) => DESTROY_KEYS.has(k))).length})`)
  lines.push(`# 生成:${new Date().toISOString().slice(0, 10)} · 程序化导出`)
  lines.push(`#`)
  lines.push(`# ⚠️ ALTER 方向未定(以 schema 为准 vs 以现网实际结构为准)⇒ 每项列两分支候选,现场查`)
  lines.push(`# information_schema.columns 后择一落地。破坏性冲突(主键类型不兼容)改错会丢数据,须先备份。`)
  lines.push(``)
  for (const c of conflicts) {
    const types = Object.entries(c.types) // [[type, [files]]]
    const destructive = types.some(([t]) => DESTROY_KEYS.has(t))
    lines.push(`## ${c.table}.${c.column}${destructive ? ' ⚠️ 破坏性(主键/类型不兼容)' : ''}`)
    for (const [t, files] of types) {
      lines.push(`- 现读 \`${t}\` ← ${files.join(', ')}`)
    }
    lines.push(`- **TODO 现场查** \`SELECT data_type, udt_name, character_maximum_length, numeric_precision, numeric_scale FROM information_schema.columns WHERE table_name='${c.table}' AND column_name='${c.column}';\``)
    lines.push(`- **TODO 现场查行数** \`SELECT count(*) FROM "${c.table}";\`(定是否需 CONCURRENTLY/建新列回填)`)
    lines.push(`- 分支 A(以 schema 为准):\`ALTER TABLE "${c.table}" ALTER COLUMN "${c.column}" TYPE <schema_type>;\``)
    lines.push(`- 分支 B(以现网为准):修 schema packages/database/src/schema/*.ts 对齐现网,再 generate 迁移`)
    lines.push(``)
  }
  return { name: 'grid4-col-type-alters.draft.md', body: lines.join('\n'), count: conflicts.length }
}

function main() {
  const check = process.argv.includes('--check')
  const audit = loadAudit()

  const fkPairs = fkPairsOf(audit)
  if (!Array.isArray(fkPairs) || fkPairs.length !== audit.grid1_fk_no_index.count) {
    console.error(`未判定:audit.pairs(${Array.isArray(fkPairs) ? fkPairs.length : '缺失'})≠ audit.count(${audit.grid1_fk_no_index.count}) ⇒ audit 缺精确 FK 对,须重跑扫描器补 pairs`)
    process.exit(2)
  }

  const grid1 = buildGrid1(audit, fkPairs)
  const grid4 = buildGrid4(audit)

  if (check) {
    console.log(`--check 通过:audit 可解析,草案可生成(格1 ${grid1.count} / 格4 ${grid4.count}),未落盘`)
    process.exit(0)
  }

  mkdirSync(OUT_DIR, { recursive: true })
  writeFileSync(join(OUT_DIR, grid1.name), grid1.body, 'utf8')
  writeFileSync(join(OUT_DIR, grid4.name), grid4.body, 'utf8')
  console.log(`已生成草案(仅在 ${OUT_DIR},未触 drizzle/):`)
  console.log(`  ${grid1.name}  (${grid1.count} 条 CREATE INDEX 草案)`)
  console.log(`  ${grid4.name}  (${grid4.count} 项 ALTER 模板,ALTER 方向待现场定)`)
  console.log(`现场核到实际类型/行数后填进 audit.json 的 prodFacts 再重跑本器,草案自动带真实判定。`)
  process.exit(0)
}

const isDirectRun =
  typeof process !== 'undefined' && process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href
if (isDirectRun) {
  main()
}
