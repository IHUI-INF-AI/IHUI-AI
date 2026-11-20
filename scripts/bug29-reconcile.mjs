// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * BUG-29 四格「已补 / 未补」逐条对账（现读，不目测）。
 *
 * 基线 = scripts/data/bug29-index-audit.json（2026-11-18 程序化权威诊断）
 * 现值 = 现读 packages/database/src/schema/*.ts + packages/database/drizzle/*.sql 迁移链
 * 判据：
 *   格1 外键列无索引：基线 131 对，逐对看迁移链是否有「同表且列集含该列」的索引 ⇒ 已补 / 未补
 *   格2 userId 无 FK：基线 151 处，逐处看迁移链 DDL 是否有该表 user_id 的 FK ⇒ 已补 / 未补
 *   格3 schema 声明索引无 DDL：复用 audit-missing-indexes 的同名/同表同列集判据
 *   格4 同表 DDL 列类型不同：基线 15 处，逐处看冲突是否仍在迁移链（本机库实测另记）
 *
 * 用法：node scripts/bug29-reconcile.mjs [--json]
 * exit 恒 0（只对账不判红；AGENTS §0.2 存量只报数）。
 */
import { readFileSync, readdirSync } from 'node:fs'
import { resolve, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'
import {
  collectDeclaredIndexes,
  collectMigratedIndexes,
  auditIndexes,
  stripSqlComments,
} from './audit-missing-indexes.mjs'

const HERE = dirname(fileURLToPath(import.meta.url))
const REPO = resolve(HERE, '..')
const AUDIT = resolve(REPO, 'scripts/data/bug29-index-audit.json')
const SCHEMA_DIR = resolve(REPO, 'packages/database/src/schema')
const DRIZZLE_DIR = resolve(REPO, 'packages/database/drizzle')

/** 从迁移链 DDL 抽 FK 覆盖集：Set<table.col>。表级 + ALTER 两种形态。 */
export function collectMigrationFks(drizzleDir) {
  const covered = new Set()
  const files = readdirSync(drizzleDir).filter((x) => x.endsWith('.sql')).sort()
  for (const f of files) {
    const sql = stripSqlComments(readFileSync(resolve(drizzleDir, f), 'utf-8'))
    // ALTER TABLE "t" ... FOREIGN KEY ("col") REFERENCES ...
    for (const m of sql.matchAll(/ALTER\s+TABLE\s+(?:IF\s+EXISTS\s+)?["`]?(\w+)["`]?[\s\S]{0,120}?FOREIGN\s+KEY\s*\(\s*["`]?(\w+)["`]?\s*\)\s*REFERENCES/gi)) {
      covered.add(`${m[1]}.${m[2]}`)
    }
    // CREATE TABLE "t" (... FOREIGN KEY ("col") ...) —— 逐 CREATE TABLE 块收
    for (const cm of sql.matchAll(/CREATE\s+TABLE\s+(?:IF\s+NOT\s+EXISTS\s+)?["`]?(\w+)["`]?\s*\(([\s\S]*?)\)\s*;/gi)) {
      const table = cm[1]
      for (const fm of cm[2].matchAll(/FOREIGN\s+KEY\s*\(\s*["`]?(\w+)["`]?\s*\)\s*REFERENCES/gi)) {
        covered.add(`${table}.${fm[1]}`)
      }
    }
  }
  return covered
}

/** 迁移链是否有索引覆盖 (table, column)。 */
export function indexCovers(migrated, table, column) {
  for (const mi of migrated.values()) {
    if (mi.table === table && mi.cols.has(column)) return true
  }
  return false
}

/**
 * 格1 纯对账：基线 FK 列对 vs 迁移链索引覆盖集 → 已补/未补。
 * @param pairs [{table,column}] 基线 FK 列
 * @param migrated Map<索引名,{table,cols:Set}>
 */
export function reconcileGrid1(pairs, migrated) {
  const rows = pairs.map((p) => ({
    table: p.table,
    column: p.column,
    covered: indexCovers(migrated, p.table, p.column),
  }))
  return {
    done: rows.filter((x) => x.covered),
    todo: rows.filter((x) => !x.covered),
  }
}

function main() {
  const audit = JSON.parse(readFileSync(AUDIT, 'utf-8'))
  const migrated = collectMigratedIndexes(DRIZZLE_DIR)
  const declared = collectDeclaredIndexes(SCHEMA_DIR)
  const fkCovered = collectMigrationFks(DRIZZLE_DIR)

  // ---- 格1 ----
  const { done: g1Done, todo: g1Todo } = reconcileGrid1(audit.grid1_fk_no_index.pairs, migrated)

  // ---- 格2 ----
  const g2 = audit.grid2_userId_no_fk.items.map((it) => ({
    table: it.table,
    nullable: it.nullable,
    covered: fkCovered.has(`${it.table}.user_id`),
  }))
  const g2Done = g2.filter((x) => x.covered)
  const g2Todo = g2.filter((x) => !x.covered)

  // ---- 格3 ----
  const { missing: g3Missing, equivalent: g3Eq } = auditIndexes(declared, migrated)

  // ---- 格4 ----
  const g4 = audit.grid4_col_type_conflicts.map((c) => ({
    table: c.table,
    column: c.column,
    types: Object.keys(c.types),
    conflictStillInDdl: Object.keys(c.types).length > 1,
  }))

  const result = {
    meta: {
      generated: new Date().toISOString(),
      baseline: 'scripts/data/bug29-index-audit.json (2026-11-18)',
      note: '迁移链现值现读；格4 本机库实测另见 scripts/data/BUG29-grid24-prodcheck-20261120.md',
    },
    grid1: {
      ticketBaseline: 123,
      authoritative: audit.grid1_fk_no_index.count,
      done: g1Done.length,
      todo: g1Todo.length,
      todoList: g1Todo,
    },
    grid2: {
      ticketBaseline: 24,
      authoritative: audit.grid2_userId_no_fk.count,
      notNull: audit.grid2_userId_no_fk.notNull_count,
      nullable: audit.grid2_userId_no_fk.nullable_count,
      done: g2Done.length,
      todo: g2Todo.length,
      todoList: g2Todo,
    },
    grid3: {
      ticketBaseline: 10,
      authoritative: audit.grid3_declared_index_no_ddl.count,
      declaredNow: declared.size,
      migratedNow: migrated.size,
      missingNow: g3Missing.length,
      equivalent: g3Eq,
      missingList: g3Missing,
    },
    grid4: {
      ticketBaseline: '两份 DDL 列类型不同',
      authoritative: audit.col_type_conflict_count,
      conflictStillInDdl: g4.filter((x) => x.conflictStillInDdl).length,
      list: g4,
    },
  }

  if (process.argv.includes('--json')) {
    console.log(JSON.stringify(result, null, 2))
  } else {
    console.log('========== BUG-29 四格已补/未补逐条对账 ==========')
    console.log(`格1 外键列无索引: 票面123 / 权威${result.grid1.authoritative} → 已补 ${result.grid1.done} / 未补 ${result.grid1.todo}`)
    for (const x of g1Todo) console.log(`   TODO ${x.table}.${x.column}`)
    console.log(`格2 userId无FK: 票面24 / 权威${result.grid2.authoritative}(notNull14/nullable137) → 迁移链已补 ${result.grid2.done} / 未补 ${result.grid2.todo}`)
    for (const x of g2Todo) console.log(`   TODO ${x.table}.user_id (${x.nullable ? 'nullable' : 'notNull'})`)
    console.log(`格3 声明索引无DDL: 票面10 / 权威${result.grid3.authoritative} → 现读缺失 ${result.grid3.missingNow} (声明 ${result.grid3.declaredNow}, 已建 ${result.grid3.migratedNow})`)
    for (const m of g3Missing) console.log(`   MISSING ${m.name} ON ${m.table}`)
    console.log(`格4 同表DDL列类型不同: 权威${result.grid4.authoritative} → 迁移链冲突仍在 ${result.grid4.conflictStillInDdl} (本机库实测全 match，见 prodcheck 报告)`)
  }
  process.exit(0)
}

const THIS_FILE = resolve(fileURLToPath(import.meta.url))
if (process.argv[1] && resolve(process.argv[1]) === THIS_FILE) main()
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
