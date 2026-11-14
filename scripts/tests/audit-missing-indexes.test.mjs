// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。

// scripts/tests/audit-missing-indexes.test.mjs
// BUG-29 对账脚本镜像测试（node:test，不连库，纯静态）。
// 钉两件事：① 正向——schema 声明的索引在迁移链里有同名/等价 DDL 时放行；② 负向——缺失时能被检出报红。
import { describe, it } from 'node:test'
import assert from 'node:assert/strict'
import { mkdtempSync, mkdirSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'

import {
  parseIndexCols,
  balancedFromParen,
  stripSqlComments,
  collectDeclaredIndexes,
  collectMigratedIndexes,
  auditIndexes,
  verifyMigrationSql,
  BUG29_MIGRATION,
} from '../audit-missing-indexes.mjs'

const tmp = () => mkdtempSync(join(tmpdir(), 'bug29-audit-'))

describe('parseIndexCols', () => {
  it('规范化列清单：去引号/空白/排序方向/COLLATE，输出 Set', () => {
    const got = parseIndexCols('"a" DESC, "b" COLLATE "zh_CN", "c"')
    assert.ok(got.has('a') && got.has('b') && got.has('c'))
    assert.equal(got.size, 3)
  })
})

describe('balancedFromParen', () => {
  it('提取到配平右括号的片段（含嵌套）', () => {
    const s = 'foo(a, bar(b), c) rest'
    assert.equal(balancedFromParen(s, 3), '(a, bar(b), c)')
  })
})

describe('stripSqlComments', () => {
  it('剥行注释与块注释，避免注释里的 DDL 关键字被误判', () => {
    const sql = '-- CREATE INDEX fake ON t (x)\nCREATE TABLE t (id int);\n/* CREATE INDEX ghost */'
    const got = stripSqlComments(sql)
    assert.ok(got.includes('CREATE TABLE'))
    assert.ok(!got.includes('fake'))
    assert.ok(!got.includes('ghost'))
  })
})

describe('auditIndexes', () => {
  it('正向：schema 声明索引在迁移里有同名 DDL ⇒ 不缺失', () => {
    const declared = new Map([['idx_ab_tests_status', { table: 'ab_tests', cols: new Set(['status']) }]])
    const migrated = new Map([['idx_ab_tests_status', { table: 'ab_tests', cols: new Set(['status']) }]])
    const { missing, equivalent } = auditIndexes(declared, migrated)
    assert.equal(missing.length, 0)
    assert.equal(equivalent, 0)
  })

  it('正向：迁移重命名索引但同表同列集 ⇒ 判为等价覆盖，不缺失（不假红）', () => {
    const declared = new Map([['idx_old_name', { table: 'users', cols: new Set(['email']) }]])
    const migrated = new Map([['ix_users_email', { table: 'users', cols: new Set(['email']) }]])
    const { missing, equivalent } = auditIndexes(declared, migrated)
    assert.equal(missing.length, 0)
    assert.equal(equivalent, 1)
  })

  it('负向：既无名也无同表同列集 ⇒ MISSING 被检出', () => {
    const declared = new Map([
      ['idx_users_email', { table: 'users', cols: new Set(['email']) }],
      ['idx_orders_status', { table: 'orders', cols: new Set(['status']) }],
    ])
    const migrated = new Map([['ix_users_email', { table: 'users', cols: new Set(['email']) }]])
    const { missing } = auditIndexes(declared, migrated)
    assert.equal(missing.length, 1)
    assert.equal(missing[0].name, 'idx_orders_status')
    assert.equal(missing[0].table, 'orders')
  })

  it('负向：同表但列集不同 ⇒ 仍判缺失（不算等价）', () => {
    const declared = new Map([['idx_t_ab', { table: 't', cols: new Set(['a', 'b']) }]])
    const migrated = new Map([['idx_t_a', { table: 't', cols: new Set(['a']) }]])
    const { missing, equivalent } = auditIndexes(declared, migrated)
    assert.equal(missing.length, 1)
    assert.equal(equivalent, 0)
  })
})

describe('collectDeclaredIndexes / collectMigratedIndexes', () => {
  it('端到端：真实目录形态下正/负向都可跑', () => {
    const d = tmp()
    const schemaDir = join(d, 'schema')
    const drizzleDir = join(d, 'drizzle')
    mkdirSync(schemaDir, { recursive: true })
    mkdirSync(drizzleDir, { recursive: true })

    writeFileSync(
      join(schemaDir, 'a.ts'),
      `import { pgTable, index, uniqueIndex, serial, text } from 'drizzle-orm/pg-core'
export const abTests = pgTable('ab_tests', {
  id: serial('id').primaryKey(),
  status: text('status'),
  hash: text('hash'),
}, (t) => ({
  statusIdx: index('idx_ab_tests_status').on(t.status),
  hashUniq: uniqueIndex('agent_multimodal_memory_hash_uniq').on(t.hash),
}))
export const orders = pgTable('orders', {
  id: serial('id').primaryKey(),
  status: text('status'),
}, (t) => ({
  ordersStatus: index('idx_orders_status').on(t.status),
}))`,
    )
    writeFileSync(
      join(drizzleDir, '0001_init.sql'),
      `-- 迁移链：已建 idx_ab_tests_status 与 agent_multimodal_memory_hash_uniq
CREATE TABLE "ab_tests" ("id" serial, "status" text, "hash" text);
CREATE INDEX IF NOT EXISTS "idx_ab_tests_status" ON "ab_tests" ("status");
CREATE UNIQUE INDEX IF NOT EXISTS "agent_multimodal_memory_hash_uniq" ON "ab_tests" ("hash");
CREATE TABLE "orders" ("id" serial, "status" text);
-- idx_orders_status 故意不建（负向缺口）`,
    )

    const declared = collectDeclaredIndexes(schemaDir)
    const migrated = collectMigratedIndexes(drizzleDir)
    assert.equal(declared.size, 3)
    assert.equal(migrated.size, 2)

    const { missing } = auditIndexes(declared, migrated)
    // 正向：ab_tests 两条（含一个 uniqueIndex）在迁移里有 DDL，且一个走同名、一个走唯一索引
    assert.ok([...migrated.keys()].includes('idx_ab_tests_status'))
    assert.ok([...migrated.keys()].includes('agent_multimodal_memory_hash_uniq'))
    // 负向：idx_orders_status 被检出缺失
    assert.equal(missing.length, 1)
    assert.equal(missing[0].name, 'idx_orders_status')
  })
})

describe('verifyMigrationSql', () => {
  it('正向：括号 / $$ / BEGIN-END 配平的 DO 块判 ok', () => {
    const sql = `
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'fk_x') THEN
    ALTER TABLE x ADD CONSTRAINT fk_x FOREIGN KEY (uid) REFERENCES users(id);
  END IF;
EXCEPTION WHEN unique_violation THEN NULL;
END $$;
`
    const v = verifyMigrationSql(sql)
    assert.equal(v.ok, true)
    assert.deepEqual(v.errors, [])
  })

  it('负向：圆括号未闭合 / $$ 不配平 / BEGIN-END 不等 各自报错', () => {
    const paren = verifyMigrationSql('CREATE INDEX i ON t ((a);')
    assert.equal(paren.ok, false)
    assert.ok(paren.errors.some((e) => e.includes('圆括号')))

    const dollar = verifyMigrationSql('DO $$ BEGIN END;')
    assert.equal(dollar.ok, false)
    assert.ok(dollar.errors.some((e) => e.includes('$$')))

    const beginEnd = verifyMigrationSql('DO $$ BEGIN\n  PERFORM 1;\n$$;')
    assert.equal(beginEnd.ok, false)
    assert.ok(beginEnd.errors.some((e) => e.includes('BEGIN')))
  })

  it('正向：END IF 不计入 BEGIN 的配对 END（plpgsql IF 收尾）', () => {
    const ok = verifyMigrationSql('DO $$ BEGIN\n  IF x THEN NULL; END IF;\nEND $$;')
    assert.equal(ok.ok, true)
    assert.deepEqual(ok.errors, [])
  })
})

describe('BUG29_MIGRATION', () => {
  it('迁移文件名常量指向 BUG-29 补齐迁移', () => {
    assert.equal(BUG29_MIGRATION, '20261106150000_fix_missing_indexes_fks.sql')
  })
})

// ⁠
