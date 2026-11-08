#!/usr/bin/env node
// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * check-hand-migration-snapshot.test.mjs — TBD-xxx 单测。
 *
 * 覆盖:
 *   1. 纯抽取:ADD COLUMN / CREATE [UNIQUE] INDEX / ADD CONSTRAINT / DO $$ 体内 DDL / 注释不误吞;
 *   2. 快照号解析:tag 四位前缀优先(修 journal idx 错位一格)、缺号回落最近前序;
 *   3. 阴性对照(核心):
 *        · 夹具「手写迁移 ADD COLUMN, snapshot 没有」⇒ --check 必红(exit 1);
 *        · 把该列补进夹具 snapshot ⇒ 必须转绿(exit 0);
 *        · 索引同款:snapshot 没有 ⇒ 红;补进 indexes ⇒ 绿;
 *   4. 基线:--write-baseline 后 --check 归零;再加一列只报「新增」,不把存量当新增;
 *   5. 三态:journal 缺失 / 基线缺失 ⇒ exit 2(未判定),不折成红也不折成绿;
 *   6. 确定性:--check 两次,stdout/stderr 逐字一致、exit code 相同;--check 零写盘。
 *
 * 夹具建在 scratch 根(仓内 .DevEnv,git 面不可见),不碰真仓 drizzle 文件。
 */
import assert from 'node:assert/strict'
import { spawnSync } from 'node:child_process'
import { mkdirSync, readFileSync, unlinkSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'
import { test } from 'node:test'
import { fileURLToPath } from 'node:url'

import { mkScratch, rmScratch } from '../lib/scratch-dir.mjs'
import {
  GATE,
  changedMigrationFiles,
  evaluateStrictChanged,
  extractAddedObjects,
  migrationNumberOf,
  resolveSnapshotIdx,
  snapshotHasObject,
  snapshotIdxOf,
  strictMissingSnapshotViolations,
} from '../check-hand-migration-snapshot.mjs'

const SCRIPT = fileURLToPath(new URL('../check-hand-migration-snapshot.mjs', import.meta.url))

function runGate(args) {
  const r = spawnSync(process.execPath, [SCRIPT, ...args], { encoding: 'utf8', timeout: 60_000 })
  return { code: r.status, out: `${r.stdout ?? ''}${r.stderr ?? ''}` }
}

function writeJson(path, doc) {
  mkdirSync(join(path, '..'), { recursive: true })
  writeFileSync(path, `${JSON.stringify(doc, null, 2)}\n`, 'utf8')
}

const EMPTY_BASELINE = { gate: GATE, gateId: 'TBD-xxx', schemaVersion: 1, entries: [] }

/**
 * 夹具:
 *   idx 1 / tag 0001_init  → 有 0001_snapshot.json
 *   idx 2 / tag 0002_hand_add → 无同号 snapshot ⇒ 对应快照回落 0001
 * 迁移 0002 是手写迁移:ADD COLUMN note(可选再建索引)。
 */
function makeFixture({
  columnInSnapshot = false,
  indexInSnapshot = false,
  includeIndex = false,
} = {}) {
  const root = mkScratch('migsnap-')
  const drizzle = join(root, 'packages', 'database', 'drizzle')
  const meta = join(drizzle, 'meta')
  mkdirSync(meta, { recursive: true })
  writeJson(join(drizzle, 'meta', '_journal.json'), {
    version: '7',
    dialect: 'postgresql',
    entries: [
      { idx: 1, version: '7', when: 1, tag: '0001_init', breakpoints: true },
      { idx: 2, version: '7', when: 2, tag: '0002_hand_add', breakpoints: true },
    ],
  })
  const columns = { id: { name: 'id', type: 'integer', primaryKey: true, notNull: true } }
  if (columnInSnapshot)
    columns.note = { name: 'note', type: 'text', primaryKey: false, notNull: false }
  const indexes = indexInSnapshot
    ? {
        widgets_note_uq: {
          name: 'widgets_note_uq',
          columns: ['note'],
          isUnique: true,
        },
      }
    : {}
  writeJson(join(meta, '0001_snapshot.json'), {
    version: '7',
    dialect: 'postgresql',
    id: 'fixture-0001',
    prevId: '00000000-0000-0000-0000-000000000000',
    tables: {
      widgets: {
        name: 'widgets',
        schema: '',
        columns,
        indexes,
        foreignKeys: {},
        compositePrimaryKeys: {},
        uniqueConstraints: {},
        checkConstraints: {},
      },
    },
    enums: {},
    _meta: { columns: {}, schemas: {}, tables: {} },
  })
  writeFileSync(
    join(drizzle, '0001_init.sql'),
    'CREATE TABLE "widgets" ("id" integer PRIMARY KEY);\n',
    'utf8',
  )
  const handSql =
    'ALTER TABLE "widgets" ADD COLUMN "note" text;\n' +
    (includeIndex ? 'CREATE UNIQUE INDEX "widgets_note_uq" ON "widgets" ("note");\n' : '')
  writeFileSync(join(drizzle, '0002_hand_add.sql'), handSql, 'utf8')
  writeJson(join(root, 'baseline.json'), EMPTY_BASELINE)
  return { root, drizzle, baseline: join(root, 'baseline.json') }
}

function gateCheck(fx) {
  return runGate(['--check', '--root', fx.root, '--baseline', fx.baseline])
}

function cleanup(t, root) {
  t.after(() => rmScratch(root, { bestEffort: true }))
}

// ---------------------------------------------------------------- 1. 纯抽取

test('extract: 四类 DDL 全抽取且行号正确', () => {
  const sql = [
    '-- CREATE INDEX "in_comment" ON t(x);',
    'ALTER TABLE "t"',
    '  ADD COLUMN "a" integer,',
    '  ADD COLUMN IF NOT EXISTS "b" text;',
    'CREATE INDEX IF NOT EXISTS "ix_t_a" ON "t" ("a");',
    'CREATE UNIQUE INDEX "uq_t_b" ON "t" ("b");',
    'ALTER TABLE "t" ADD CONSTRAINT "ck_t_a" CHECK ("a" > 0);',
    'INSERT INTO t VALUES (\'CREATE INDEX "in_string" ON t(x)\');',
    'DO $$ BEGIN CREATE UNIQUE INDEX "uq_do" ON "t" ("a"); END $$;',
  ].join('\n')
  const got = extractAddedObjects(sql)
  const flat = got.map((o) => `${o.kind}:${o.object}:${o.line}`)
  assert.deepEqual(flat, [
    'column:a:3',
    'column:b:4',
    'index:ix_t_a:5',
    'index:uq_t_b:6',
    'constraint:ck_t_a:7',
    'index:uq_do:9',
  ])
  assert.ok(!flat.some((x) => x.includes('in_comment')), '注释内的 CREATE INDEX 不许被抽')
  assert.ok(!flat.some((x) => x.includes('in_string')), '单引号字符串内的 DDL 不许被抽')
})

test('extract: 分号隔断归属,不把上一张表串到下一张表', () => {
  const sql = 'ALTER TABLE "a" ADD COLUMN "x" int; ALTER TABLE "b" ADD COLUMN "y" int;\n'
  const got = extractAddedObjects(sql)
  assert.deepEqual(
    got.map((o) => `${o.table}.${o.object}`),
    ['a.x', 'b.y'],
  )
})

// ---------------------------------------------------------------- 2. 快照号解析

test('snapshot number: tag 四位前缀优先,时间戳 tag 回落 journal idx', () => {
  assert.equal(migrationNumberOf('0038_missing_tables', 39), 38)
  assert.equal(migrationNumberOf('20261106120000_tool_ledger_execution_facts', 367), 367)
  assert.equal(snapshotIdxOf('0368_snapshot.json'), 368)
  assert.equal(snapshotIdxOf('README.md'), null)
})

test('resolveSnapshotIdx: 同号优先,缺号取最近前序,空前序返回 null', () => {
  assert.equal(resolveSnapshotIdx([1, 2, 38], 38), 38)
  assert.equal(resolveSnapshotIdx([1, 2, 38], 37), 2)
  assert.equal(resolveSnapshotIdx([], 5), null)
  assert.equal(resolveSnapshotIdx([40], 5), null)
})

test('snapshotHasObject: 列按表定位,索引/约束走全表键 + 原文键兜底', () => {
  const snap = {
    tables: {
      widgets: {
        columns: { id: {}, note: {} },
        indexes: { widgets_note_uq: {} },
        checkConstraints: { ck_note: {} },
      },
    },
  }
  assert.equal(
    snapshotHasObject(snap, { kind: 'column', table: 'widgets', object: 'note' }).present,
    true,
  )
  assert.equal(
    snapshotHasObject(snap, { kind: 'column', table: 'other', object: 'note' }).present,
    false,
  )
  assert.equal(snapshotHasObject(snap, { kind: 'index', object: 'widgets_note_uq' }).present, true)
  assert.equal(snapshotHasObject(snap, { kind: 'constraint', object: 'ck_note' }).present, true)
  assert.equal(
    snapshotHasObject(snap, { kind: 'index', object: 'missing' }, '{"widgets_note_uq":{}}').present,
    false,
  )
  assert.equal(
    snapshotHasObject(
      snap,
      { kind: 'index', object: 'fallback' },
      '{"fallback": {"name":"fallback"}}',
    ).present,
    true,
  )
})

// ---------------------------------------------------------------- 3. 阴性对照(核心)

test('阴性对照: 手写迁移 ADD COLUMN, snapshot 没有 ⇒ 红;补进 snapshot ⇒ 绿', (t) => {
  const fx = makeFixture({ columnInSnapshot: false })
  cleanup(t, fx.root)

  const red = gateCheck(fx)
  assert.equal(red.code, 1, `必须判红,实际 exit=${red.code}\n${red.out}`)
  assert.match(red.out, /0002_hand_add\.sql:1/)
  assert.match(red.out, /widgets\.note/)
  assert.match(red.out, /snapshot 1 前序/)

  // 把该列补进夹具 snapshot(只动夹具,不动真仓)
  const snapPath = join(fx.drizzle, 'meta', '0001_snapshot.json')
  const snap = JSON.parse(readFileSync(snapPath, 'utf8'))
  snap.tables.widgets.columns.note = {
    name: 'note',
    type: 'text',
    primaryKey: false,
    notNull: false,
  }
  writeJson(snapPath, snap)

  const green = gateCheck(fx)
  assert.equal(green.code, 0, `补进 snapshot 后必须转绿,实际 exit=${green.code}\n${green.out}`)
  assert.match(green.out, /state=ok/)
  assert.doesNotMatch(green.out, /新增违规/)
})

test('阴性对照(索引): snapshot 无该索引 ⇒ 红;补进 indexes ⇒ 绿', (t) => {
  // 列已在快照里,只剩索引这一枚待判
  const fx = makeFixture({ columnInSnapshot: true, indexInSnapshot: false, includeIndex: true })
  cleanup(t, fx.root)
  const red = gateCheck(fx)
  assert.equal(red.code, 1)
  assert.match(red.out, /widgets_note_uq/)
  assert.match(red.out, /\[index\]/)

  const snapPath = join(fx.drizzle, 'meta', '0001_snapshot.json')
  const snap = JSON.parse(readFileSync(snapPath, 'utf8'))
  snap.tables.widgets.indexes.widgets_note_uq = {
    name: 'widgets_note_uq',
    columns: ['note'],
    isUnique: true,
  }
  writeJson(snapPath, snap)

  const green = gateCheck(fx)
  assert.equal(green.code, 0, green.out)
})

// ---------------------------------------------------------------- 4. 基线

test('基线: 认账后归零;新增违规只报新增,不把存量当新增', (t) => {
  const fx = makeFixture({ columnInSnapshot: false, indexInSnapshot: false, includeIndex: true })
  cleanup(t, fx.root)

  const before = gateCheck(fx)
  assert.equal(before.code, 1)

  const wrote = runGate(['--write-baseline', '--root', fx.root, '--baseline', fx.baseline])
  assert.equal(wrote.code, 0, wrote.out)
  const baseline = JSON.parse(readFileSync(fx.baseline, 'utf8'))
  assert.ok(Array.isArray(baseline.entries) && baseline.entries.length > 0)
  assert.ok(baseline.entries.includes('0002_hand_add|column|widgets|note'))
  assert.ok(baseline.entries.includes('0002_hand_add|index|-|widgets_note_uq'))

  const after = gateCheck(fx)
  assert.equal(after.code, 0, after.out)
  assert.match(after.out, /stock=2/)
  assert.doesNotMatch(after.out, /新增违规/)

  // 再给手写迁移加一列(存量之外的新违规)
  const sqlPath = join(fx.drizzle, '0002_hand_add.sql')
  writeFileSync(
    sqlPath,
    readFileSync(sqlPath, 'utf8') + 'ALTER TABLE "widgets" ADD COLUMN "extra" integer;\n',
    'utf8',
  )
  const fresh = gateCheck(fx)
  assert.equal(fresh.code, 1, fresh.out)
  assert.match(fresh.out, /新增违规:.*widgets\.extra/)
  assert.doesNotMatch(fresh.out, /新增违规:.*widgets\.note/)
  assert.match(fresh.out, /stock=2/)
  assert.match(fresh.out, /new=1/)
})

test('--check 零写盘: 基线内容与字节不变', (t) => {
  const fx = makeFixture({ columnInSnapshot: false })
  cleanup(t, fx.root)
  const before = readFileSync(fx.baseline, 'utf8')
  const r = gateCheck(fx)
  assert.equal(r.code, 1)
  assert.equal(readFileSync(fx.baseline, 'utf8'), before)
})

// ---------------------------------------------------------------- 4b. DB-09 strict 门禁

test('DB-09 --strict: 任一迁移缺同号快照 ⇒ exit 1（不被基线吞掉）', (t) => {
  const fx = makeFixture({ columnInSnapshot: true })
  cleanup(t, fx.root)
  const r = runGate(['--check', '--strict', '--root', fx.root, '--baseline', fx.baseline])
  assert.equal(r.code, 1, r.out)
  assert.match(r.out, /strict/)
  assert.match(r.out, /0002_hand_add/)
})

test('DB-09 strictMissingSnapshotViolations: 只点名缺同号快照的迁移', () => {
  const entries = [
    { idx: 1, tag: '0001_init', when: 1 },
    { idx: 2, tag: '0002_hand_add', when: 2 },
    { idx: 3, tag: '20261107150000_new', when: 3 },
  ]
  const got = strictMissingSnapshotViolations({ journalEntries: entries, snapshotIdxs: [1, 2] })
  assert.deepEqual(got.map((v) => v.tag), ['20261107150000_new'])
  assert.equal(got[0].expectedSnapshot, 3)
})

test('DB-09 changedMigrationFiles: 只认 drizzle/ 下新增/改动的 .sql', () => {
  const diff = [
    'packages/database/drizzle/0002_hand_add.sql',
    'packages/database/drizzle/meta/0002_snapshot.json',
    'packages/database/src/schema/x.ts',
    'scripts/check-hand-migration-snapshot.mjs',
    '',
  ].join('\n')
  assert.deepEqual(changedMigrationFiles(diff), ['0002_hand_add.sql'])
})

test('DB-09 evaluateStrictChanged: 仅新增/改动的迁移强制同号快照', () => {
  const entries = [
    { idx: 1, tag: '0001_init', when: 1 },
    { idx: 2, tag: '0002_hand_add', when: 2 },
  ]
  const dirty = evaluateStrictChanged({
    journalEntries: entries,
    changedSqlNames: ['0002_hand_add.sql'],
    snapshotIdxs: [1],
  })
  assert.equal(dirty.ok, false)
  assert.deepEqual(dirty.violations.map((v) => v.tag), ['0002_hand_add'])
  assert.match(dirty.violations[0].reason, /同号快照/)

  const clean = evaluateStrictChanged({
    journalEntries: entries,
    changedSqlNames: ['0002_hand_add.sql'],
    snapshotIdxs: [1, 2],
  })
  assert.equal(clean.ok, true)
  // 未改动的 0001 缺快照不属于 changed 档射程
  const onlyUnchanged = evaluateStrictChanged({
    journalEntries: entries,
    changedSqlNames: [],
    snapshotIdxs: [1],
  })
  assert.equal(onlyUnchanged.ok, true)
})

// ---------------------------------------------------------------- 5. 三态

test('未判定: journal 缺失 ⇒ exit 2,不判红也不判绿', (t) => {
  const fx = makeFixture({ columnInSnapshot: false })
  cleanup(t, fx.root)
  writeFileSync(join(fx.drizzle, 'meta', '_journal.json'), '', 'utf8')
  const r = gateCheck(fx)
  assert.equal(r.code, 2, r.out)
  assert.match(r.out, /未判定/)
  assert.match(r.out, /state=unjudged/)
})

test('未判定: 基线缺失 ⇒ exit 2', (t) => {
  const fx = makeFixture({ columnInSnapshot: false })
  cleanup(t, fx.root)
  unlinkSync(fx.baseline)
  const r = gateCheck(fx)
  assert.equal(r.code, 2, r.out)
  assert.match(r.out, /基线缺失/)
})

// ---------------------------------------------------------------- 6. 确定性

test('确定性: --check 两次输出逐字一致、exit code 相同', (t) => {
  const fx = makeFixture({ columnInSnapshot: false, indexInSnapshot: false })
  cleanup(t, fx.root)
  const a = gateCheck(fx)
  const b = gateCheck(fx)
  assert.equal(a.code, b.code)
  assert.equal(a.out, b.out)
})

test('--write-baseline 输出确定性: 两次写盘内容逐字一致', (t) => {
  const fx = makeFixture({ columnInSnapshot: false, indexInSnapshot: false })
  cleanup(t, fx.root)
  runGate(['--write-baseline', '--root', fx.root, '--baseline', fx.baseline])
  const a = readFileSync(fx.baseline, 'utf8')
  runGate(['--write-baseline', '--root', fx.root, '--baseline', fx.baseline])
  const b = readFileSync(fx.baseline, 'utf8')
  assert.equal(a, b)
})
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
