// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

import { test } from 'node:test'
import assert from 'node:assert/strict'
import { spawnSync } from 'node:child_process'
import { writeFileSync, mkdirSync } from 'node:fs'
import { join } from 'node:path'
import { mkScratch, rmScratch } from '../lib/scratch-dir.mjs'
import { fileURLToPath } from 'node:url'

// ─── 路径推导(AGENTS.md §15:用 import.meta.url,不硬编码) ───
const __dirname = fileURLToPath(new URL('.', import.meta.url))
const SCRIPT_PATH = join(__dirname, '..', 'check-db-schema-drift.mjs')

// ─── 契约对齐(工单 G-1059137,守门契约 2026-09-30 版) ──────
// 守门主判据(scripts/check-db-schema-drift.mjs):
//   1. 表级:missing migration → exit 1;dead migration → warn(不阻塞)
//   2. 字段级尺子:TS 列在 migration 链(CREATE body / ADD COLUMN / RENAME 终名)
//      无出处 → exit 1;反向(migration 有列 / TS 无)→ 信息级 extra columns,不阻塞
//   3. joinedTables === 0(枚举到 0 张可做列级对照的表)→ exit 2"无法判定",
//      且该检查先于 exit-1 的 hasError 汇总(空对照面即使有 missing 也判 2)
// writeSchema 恒定输出 id + created_at ⇒ 期望 exit 0 的 migration fixture 须用 STD_COLS 齐平两列。

// ─── 辅助:在临时目录搭建 packages/database 结构 ──────────
function createTempProject() {
  const root = mkScratch('ihui-drift-')
  mkdirSync(join(root, 'packages', 'database', 'src', 'schema'), { recursive: true })
  mkdirSync(join(root, 'packages', 'database', 'drizzle'), { recursive: true })
  return root
}

// 辅助:写一个 TS schema 文件。
// 契约对齐(2026-09-30 字段级尺子):writeSchema 恒定输出 id + created_at 两列,
// 因此期望 exit 0 的 fixture,migration CREATE body 必须同列齐平(用 STD_COLS),
// 否则触发 missing columns → exit 1。
// extraColumns:可选追加列([{ tsName, dbName, type }]),供 ADD/RENAME COLUMN 出处场景用。
function writeSchema(root, fileName, tableNames, extraColumns = []) {
  const lines = ["import { pgTable, text, timestamp } from 'drizzle-orm/pg-core'\n\n"]
  for (const [varName, tableName] of tableNames) {
    lines.push(
      `export const ${varName} = pgTable('${tableName}', {\n` +
        `  id: text('id').primaryKey(),\n` +
        `  createdAt: timestamp('created_at').defaultNow(),\n` +
        extraColumns.map((c) => `  ${c.tsName}: ${c.type}('${c.dbName}'),\n`).join('') +
        `})\n\n`,
    )
  }
  writeFileSync(join(root, 'packages', 'database', 'src', 'schema', fileName), lines.join(''))
}

// 标准 migration 列体(id + created_at),与 writeSchema 恒定输出的两列对齐
const STD_COLS = `"id" text PRIMARY KEY,\n  "created_at" timestamp`

// 辅助:写一个 migration SQL 文件
function writeMigration(root, fileName, sql) {
  writeFileSync(join(root, 'packages', 'database', 'drizzle', fileName), sql)
}

// 辅助:运行脚本(stdout/stderr 去除 ANSI 颜色码,便于正则断言)
const ANSI_RE = /\x1B\[[0-9;]*m/g
function runScript(cwd, args = [], env = {}) {
  const r = spawnSync('node', [SCRIPT_PATH, ...args], {
    cwd: cwd || process.cwd(),
    encoding: 'utf8',
    // 2026-10-04:不吃的子进程必须给 stdio,否则本机报 spawnSync EBUSY
    // 返回值被消费(读 r.stdout 去 ANSI)⇒ stdout 仍须 pipe,只把 stdin 切掉
    stdio: ['ignore', 'pipe', 'pipe'],
    env: { ...process.env, ...env },
  })
  if (r.stdout) r.stdout = r.stdout.replace(ANSI_RE, '')
  if (r.stderr) r.stderr = r.stderr.replace(ANSI_RE, '')
  return r
}

// 辅助:断言 stdout 报告 schema drift check 通过
function assertPass(r) {
  assert.equal(
    r.status,
    0,
    `应 exit 0,实际 ${r.status}\nstdout: ${r.stdout}\nstderr: ${r.stderr}`,
  )
  assert.match(r.stdout, /schema drift check 通过/, 'stdout 应含"通过"标记')
}

// 辅助:断言 stdout 报告 schema drift check 失败(命中,期望 exit code 1)
function assertFail(r, pattern) {
  assert.equal(
    r.status,
    1,
    `应 exit 1,实际 ${r.status}\nstdout: ${r.stdout}\nstderr: ${r.stderr}`,
  )
  assert.match(r.stdout, /schema drift check 失败/, 'stdout 应含"失败"标记')
  if (pattern) {
    assert.match(r.stdout, pattern, `stdout 应含 ${pattern}`)
  }
}

// 辅助:断言"无法判定"(枚举到 0 张可做列级对照的表 → exit 2,不记绿不记红)
function assertUndetermined(r) {
  assert.equal(
    r.status,
    2,
    `应 exit 2(无法判定),实际 ${r.status}\nstdout: ${r.stdout}\nstderr: ${r.stderr}`,
  )
  assert.match(r.stdout, /无法判定/, 'stdout 应含"无法判定"标记')
}

// ─── 1. CLI --help 不崩溃(脚本未实现 --help,按默认模式运行) ───
test('CLI: --help 不崩溃(脚本未实现 --help,直接走默认全量扫描)', () => {
  const root = createTempProject()
  try {
    // 对齐 fixture(表+列齐平):默认扫描 exit 0 ⇒ --help 未产生未捕获异常
    writeSchema(root, 'users.ts', [['users', 'users']])
    writeMigration(root, '0000_init.sql', `CREATE TABLE "users" (\n  ${STD_COLS}\n);\n`)
    const r = runScript(root, ['--help'])
    assertPass(r)
    assert.ok(!r.stderr.includes('Error:'), `--help 不应产生未捕获 Error`)
  } finally {
    rmScratch(root)
  }
})

// ─── 2. 未判定:空 schema + 空 migrations → 列级对照面为 0 → exit 2 ──
test('CLI: 无参数运行(空 schema + 空 migrations → 无法判定 exit 2,不记绿)', () => {
  const root = createTempProject()
  try {
    const r = runScript(root)
    assertUndetermined(r)
    // stdout 应显示扫描到 0 个 TS 表 / 0 个 migration 表
    assert.match(r.stdout, /TS schema tables:\s+0/)
    assert.match(r.stdout, /migration tables:\s+0/)
  } finally {
    rmScratch(root)
  }
})

// ─── 3. 放过:schema 与 migration 表+列完全对齐 → exit 0 ──
test('一致: TS schema 有 users / migration 有 users(表+列齐平)→ exit 0', () => {
  const root = createTempProject()
  try {
    writeSchema(root, 'users.ts', [['users', 'users']])
    writeMigration(
      root,
      '0000_init.sql',
      `CREATE TABLE IF NOT EXISTS "users" (\n  "id" text PRIMARY KEY,\n  "created_at" timestamp\n);\n`,
    )
    const r = runScript(root)
    assertPass(r)
    assert.match(r.stdout, /missing migrations:\s+0/)
    assert.match(r.stdout, /field-level joined:\s+1/, 'users 应进入列级对照')
  } finally {
    rmScratch(root)
  }
})

// ─── 4. 命中:TS schema 有表但 migration 缺失 → exit 1(missing migrations) ──
// joinedTables 必须 > 0 才能走到 exit 1(exit-2 检查先于 hasError 汇总),
// 故 fixture 放一张完全对齐的伴生表 aligned 撑起列级对照面。
test('drift: TS schema 有 users 但 migration 缺失 → exit 1', () => {
  const root = createTempProject()
  try {
    writeSchema(root, 'users.ts', [['users', 'users']])
    writeSchema(root, 'aligned.ts', [['aligned', 'aligned']])
    writeMigration(root, '0000_aligned.sql', `CREATE TABLE "aligned" (\n  ${STD_COLS}\n);\n`)
    const r = runScript(root)
    assertFail(r, /migration 缺失/)
    assert.match(r.stdout, /users/, 'stdout 应列出缺失的表名 users')
    assert.match(r.stdout, /missing migrations:\s+1/)
  } finally {
    rmScratch(root)
  }
})

// ─── 5. 命中:字段级尺子 — migration body 缺 created_at → exit 1 ──
// TS 侧恒定有 created_at,migration 链只有 CREATE body 的 id ⇒ users.created_at 无出处
test('drift: migration 缺失列 users.created_at → exit 1(missing columns)', () => {
  const root = createTempProject()
  try {
    writeSchema(root, 'users.ts', [['users', 'users']])
    // CREATE body 只写 id,漏掉 created_at
    writeMigration(root, '0000_init.sql', `CREATE TABLE "users" (\n  "id" text PRIMARY KEY\n);\n`)
    const r = runScript(root)
    assertFail(r, /missing columns:\s+1/)
    assert.match(r.stdout, /migration 缺失列/, '应命中字段级尺子')
    assert.match(r.stdout, /users\.created_at/, '应点名 users.created_at')
  } finally {
    rmScratch(root)
  }
})

// ─── 6. 放过:dead migration(migration 有表 / TS 无)→ warn,exit 0 ──
// 须 joinedTables > 0:TS schema 保留一张与 migration 对齐的表,列级对照面非空
test('drift: migration 有 orders 但 TS schema 无 → dead migration warn(exit 0)', () => {
  const root = createTempProject()
  try {
    writeSchema(root, 'users.ts', [['users', 'users']])
    writeMigration(
      root,
      '0000_init.sql',
      `CREATE TABLE "users" (\n  ${STD_COLS}\n);\nCREATE TABLE "orders" (\n  "id" text PRIMARY KEY\n);\n`,
    )
    const r = runScript(root)
    // dead migration 是 warn 级,不阻塞 → exit 0
    assertPass(r)
    assert.match(r.stdout, /dead migrations:\s+1/, '应报告 1 个 dead migration')
    assert.match(r.stdout, /orders/, '应列出 dead migration 表名 orders')
  } finally {
    rmScratch(root)
  }
})

// ─── 6b. 放过:DROP TABLE 后未重建 → 表从 finalTables 移除(非 missing 非 dead) ──
test('migration: DROP TABLE orders 后未 CREATE → 表从最终集合移除(若 TS 有则 missing)', () => {
  const root = createTempProject()
  try {
    // TS schema 含对齐伴生表 users(orders 已被 DROP,不在 TS 中)
    writeSchema(root, 'users.ts', [['users', 'users']])
    writeMigration(
      root,
      '0000_init.sql',
      `CREATE TABLE "users" (\n  ${STD_COLS}\n);\nCREATE TABLE "orders" (\n  "id" text PRIMARY KEY\n);\nDROP TABLE "orders";\n`,
    )
    const r = runScript(root)
    // DROP 后 finalTables 不含 orders → 既不是 missing 也不是 dead
    assertPass(r)
    assert.match(r.stdout, /dead migrations:\s+0/, 'DROP 后不应算 dead migration')
    assert.match(r.stdout, /missing migrations:\s+0/)
  } finally {
    rmScratch(root)
  }
})

// ─── 7. 跨文件 CREATE + DROP + CREATE → 表存在(按文件顺序应用) ──
test('migration: 跨文件 0000 CREATE + 0001 DROP + 0002 CREATE → 表存在', () => {
  const root = createTempProject()
  try {
    writeSchema(root, 'users.ts', [['users', 'users']])
    writeMigration(root, '0000_init.sql', `CREATE TABLE "users" (\n  ${STD_COLS}\n);\n`)
    writeMigration(root, '0001_drop.sql', `DROP TABLE "users";\n`)
    writeMigration(root, '0002_recreate.sql', `CREATE TABLE "users" (\n  ${STD_COLS}\n);\n`)
    const r = runScript(root)
    assertPass(r)
    assert.match(r.stdout, /missing migrations:\s+0/)
    assert.match(r.stdout, /missing columns:\s+0/, '重建体列应与 TS 齐平')
  } finally {
    rmScratch(root)
  }
})

// ─── 7b. 同文件 CREATE users + CREATE orders + DROP users → users 缺失(命中 exit 1) ──
test('migration: 同文件 CREATE + DROP → 表不存在(按 SQL 出现顺序应用:CREATE users → CREATE orders → DROP users)', () => {
  const root = createTempProject()
  try {
    writeSchema(root, 'users.ts', [['users', 'users']])
    // 同文件 CREATE "users" + CREATE "orders" + DROP "users"
    // 按 SQL 顺序应用:ADD users → ADD orders → DELETE users → finalTables={orders}
    // users 被 DROP ⇒ missing migration(命中 exit 1);orders 留在 finalTables ⇒ dead(warn)
    writeMigration(
      root,
      '0000_init.sql',
      `CREATE TABLE "users" (\n  ${STD_COLS}\n);\nCREATE TABLE "orders" (\n  "id" text PRIMARY KEY\n);\nDROP TABLE "users";\n`,
    )
    const r = runScript(root)
    assertFail(r, /migration 缺失/)
    assert.match(r.stdout, /users/)
    assert.match(r.stdout, /dead migrations:\s+1/, 'orders 应计为 dead migration(warn 级)')
  } finally {
    rmScratch(root)
  }
})

// ─── 7c. 同文件 DROP + CREATE(drop-and-recreate)→ 表存在(按 SQL 顺序应用,不误报 dead migration) ──
test('migration: 同文件 DROP TABLE X + CREATE TABLE X(drop-and-recreate)→ finalTables 含 X,不误报 dead migration', () => {
  const root = createTempProject()
  try {
    writeSchema(root, 'users.ts', [['users', 'users']])
    // 同文件先 DROP "users" 再 CREATE "users"(drop-and-recreate 模式)
    // 按 SQL 顺序应用:DELETE users(no-op,集合本无 users)→ ADD users → finalTables 含 users
    // 修复前 bug:先扫 CREATE(add users)再扫 DROP(delete users)→ 误报 dead migration
    writeMigration(
      root,
      '0005_drop_and_recreate.sql',
      `DROP TABLE IF EXISTS "users";\nCREATE TABLE "users" (\n  ${STD_COLS}\n);\n`,
    )
    const r = runScript(root)
    assertPass(r)
    assert.match(r.stdout, /missing migrations:\s+0/)
    assert.match(r.stdout, /dead migrations:\s+0/, '不应误报 dead migration')
    assert.match(r.stdout, /missing columns:\s+0/, '重建体列应与 TS 齐平')
  } finally {
    rmScratch(root)
  }
})

// ─── 7d. 同文件 CREATE + DROP → 表不存在(按 SQL 顺序应用,与 7b 单表场景一致) ──
test('migration: 同文件 CREATE TABLE X + DROP TABLE X → finalTables 不含 X', () => {
  const root = createTempProject()
  try {
    writeSchema(root, 'users.ts', [['users', 'users']])
    // 同文件先 CREATE "users" 再 DROP "users"
    // 按 SQL 顺序应用:ADD users → DELETE users → finalTables 不含 users
    writeMigration(
      root,
      '0005_create_then_drop.sql',
      `CREATE TABLE "users" (\n  ${STD_COLS}\n);\nDROP TABLE "users";\n`,
    )
    const r = runScript(root)
    // users 被 DROP → finalTables 不含 users → TS schema 有 users → missing → exit 1
    assertFail(r, /migration 缺失/)
    assert.match(r.stdout, /users/)
  } finally {
    rmScratch(root)
  }
})

// ─── 7e. 同文件 DROP X + CREATE Y → finalTables 含 Y(无 X,顺序正确) ──
test('migration: 同文件 DROP TABLE X + CREATE TABLE Y → finalTables 含 Y(无 X,顺序正确)', () => {
  const root = createTempProject()
  try {
    // TS schema 只有 orders(Y),无 users(X)
    writeSchema(root, 'orders.ts', [['orders', 'orders']])
    // 同文件先 DROP "users"(X)再 CREATE "orders"(Y)
    // 按 SQL 顺序应用:DELETE users(no-op)→ ADD orders → finalTables={orders}
    writeMigration(
      root,
      '0005_drop_x_create_y.sql',
      `DROP TABLE IF EXISTS "users";\nCREATE TABLE "orders" (\n  ${STD_COLS}\n);\n`,
    )
    const r = runScript(root)
    assertPass(r)
    assert.match(r.stdout, /missing migrations:\s+0/)
    assert.match(r.stdout, /dead migrations:\s+0/, '不应误报 dead migration(orders 在 TS schema 中存在)')
  } finally {
    rmScratch(root)
  }
})

// ─── 8. 放过:ALTER TABLE RENAME TO → 旧名移除 / 新名添加 ──
// 注:RENAME TO 只动表级集合,旧表的列出处不迁移(migColumns 无 users_new 条目),
//     users_new 不进入列级对照;伴生 aligned 表撑起 joinedTables>0 使 exit 0 可达。
test('migration: RENAME TO → 旧名移除,新名添加到 finalTables', () => {
  const root = createTempProject()
  try {
    // TS schema 用新名 users_new + 一张对齐伴生表
    writeSchema(root, 'users.ts', [['usersNew', 'users_new']])
    writeSchema(root, 'aligned.ts', [['aligned', 'aligned']])
    writeMigration(
      root,
      '0000_init.sql',
      `CREATE TABLE "aligned" (\n  ${STD_COLS}\n);\n` +
        `CREATE TABLE "users_old" (\n  ${STD_COLS}\n);\n` +
        `ALTER TABLE "users_old" RENAME TO "users_new";\n`,
    )
    const r = runScript(root)
    assertPass(r)
    assert.match(r.stdout, /missing migrations:\s+0/)
    assert.match(r.stdout, /dead migrations:\s+0/, '改名后旧名不应计 dead migration')
  } finally {
    rmScratch(root)
  }
})

// ─── 9. CREATE TABLE IF NOT EXISTS 修饰 → 正则匹配 ───────
test('migration: CREATE TABLE IF NOT EXISTS 修饰 → 正常匹配表名', () => {
  const root = createTempProject()
  try {
    writeSchema(root, 'users.ts', [['users', 'users']])
    writeMigration(
      root,
      '0000_init.sql',
      `CREATE TABLE IF NOT EXISTS "users" (\n  ${STD_COLS}\n);\n`,
    )
    const r = runScript(root)
    assertPass(r)
  } finally {
    rmScratch(root)
  }
})

// ─── 10. 多个 schema 文件 → 合并表名集合 ──────────────────
test('扫描: 多个 schema 文件 → 合并表名(全部检测)', () => {
  const root = createTempProject()
  try {
    writeSchema(root, 'users.ts', [['users', 'users']])
    writeSchema(root, 'orders.ts', [['orders', 'orders']])
    writeMigration(
      root,
      '0000_init.sql',
      `CREATE TABLE "users" (\n  ${STD_COLS}\n);\nCREATE TABLE "orders" (\n  ${STD_COLS}\n);\n`,
    )
    const r = runScript(root)
    assertPass(r)
    assert.match(r.stdout, /TS schema tables:\s+2/)
    assert.match(r.stdout, /field-level joined:\s+2/, '两张表都应进入列级对照')
  } finally {
    rmScratch(root)
  }
})

// ─── 11. 表名大小写不敏感(脚本统一转小写) ────────────────
// pgTable('Users') 的表名小写化后与 CREATE TABLE "users" 表级对齐 → 无 missing;
// 但列提取对表名大小写敏感(找不到 pgTable('users') 的表体),users 不进列级对照,
// 故用一张对齐伴生表 aligned 撑起 joinedTables>0,使 exit 0 可达。
test('扫描: pgTable("Users") + CREATE TABLE "users" → 一致(大小写不敏感)', () => {
  const root = createTempProject()
  try {
    writeSchema(root, 'users.ts', [['Users', 'Users']])
    writeSchema(root, 'aligned.ts', [['aligned', 'aligned']])
    writeMigration(
      root,
      '0000_init.sql',
      `CREATE TABLE "users" (\n  ${STD_COLS}\n);\nCREATE TABLE "aligned" (\n  ${STD_COLS}\n);\n`,
    )
    const r = runScript(root)
    assertPass(r)
    assert.match(r.stdout, /missing migrations:\s+0/)
  } finally {
    rmScratch(root)
  }
})

// ─── 12. SKIP_SCHEMA_DRIFT=1 环境变量(脚本不支持,验证默认行为) ──
test('环境变量: SKIP_SCHEMA_DRIFT=1 → 脚本不支持,仍正常扫描(missing → exit 1)', () => {
  const root = createTempProject()
  try {
    writeSchema(root, 'users.ts', [['users', 'users']])
    writeSchema(root, 'aligned.ts', [['aligned', 'aligned']])
    writeMigration(root, '0000_aligned.sql', `CREATE TABLE "aligned" (\n  ${STD_COLS}\n);\n`)
    // migration 缺失,即使设了 SKIP_SCHEMA_DRIFT 仍应 exit 1(脚本不识别该 env);
    // 伴生 aligned 表保证 joinedTables>0(exit 2 判定先行),missing 才能落到 exit 1
    const r = runScript(root, [], { SKIP_SCHEMA_DRIFT: '1' })
    assertFail(r, /migration 缺失/)
  } finally {
    rmScratch(root)
  }
})

// ─── 13. 未判定:schema 目录不存在 → 列级对照面为 0 → exit 2 ──
test('鲁棒性: schema 目录不存在 → 0 表,无法判定 exit 2(不记绿)', () => {
  const root = mkScratch('ihui-drift-nodir-')
  try {
    // 不创建 packages/database/src/schema 目录
    mkdirSync(join(root, 'packages', 'database', 'drizzle'), { recursive: true })
    const r = runScript(root)
    assertUndetermined(r)
    assert.match(r.stdout, /TS schema tables:\s+0/)
  } finally {
    rmScratch(root)
  }
})

// ─── 14. 未判定:migrations 目录不存在 → 列级对照面为 0 → exit 2 ──
// 契约要点:exit-2 检查先于 hasError 的 exit-1 汇总。TS 有表而 migration 目录缺失时,
// missing migrations 已非空,但 joinedTables===0 ⇒ 先判"无法判定"exit 2,
// 不会走到 missing migration 的 exit 1(实际行为,已运行守门验证)。
test('鲁棒性: migrations 目录不存在 → 无法判定 exit 2(压过 missing 的 exit 1)', () => {
  const root = mkScratch('ihui-drift-nomig-')
  try {
    mkdirSync(join(root, 'packages', 'database', 'src', 'schema'), { recursive: true })
    writeSchema(root, 'users.ts', [['users', 'users']])
    // migrations 目录不存在 → migTables/migColumns 为空 → joinedTables=0 → exit 2
    const r = runScript(root)
    assertUndetermined(r)
    assert.match(r.stdout, /migration tables:\s+0/)
    assert.match(r.stdout, /missing migrations:\s+1/, 'missing 被统计,但被 exit 2 压制')
  } finally {
    rmScratch(root)
  }
})

// ─── 15. pgTable 双引号 / 反引号 → 正则匹配 ──────────────
test('扫描: pgTable("users") 双引号 / pgTable(`users`) 反引号 → 正则匹配', () => {
  const root = createTempProject()
  try {
    // 用双引号
    writeFileSync(
      join(root, 'packages', 'database', 'src', 'schema', 'a.ts'),
      `export const a = pgTable("users", { id: text('id') })\n`,
    )
    // 用反引号
    writeFileSync(
      join(root, 'packages', 'database', 'src', 'schema', 'b.ts'),
      `export const b = pgTable(\`orders\`, { id: text('id') })\n`,
    )
    writeMigration(
      root,
      '0000_init.sql',
      `CREATE TABLE "users" (id text);\nCREATE TABLE "orders" (id text);\n`,
    )
    const r = runScript(root)
    assertPass(r)
    assert.match(r.stdout, /TS schema tables:\s+2/)
  } finally {
    rmScratch(root)
  }
})

// ─── 16. --staged flag(脚本未区分,按全量扫描) ───────────
test('CLI: --staged flag 被脚本忽略(脚本注释明确"schema drift 是全局问题")', () => {
  const root = createTempProject()
  try {
    writeSchema(root, 'users.ts', [['users', 'users']])
    writeMigration(root, '0000_init.sql', `CREATE TABLE "users" (\n  ${STD_COLS}\n);\n`)
    const withFlag = runScript(root, ['--staged'])
    const withoutFlag = runScript(root)
    // --staged 应与无参数行为一致
    assertPass(withFlag)
    assertPass(withoutFlag)
    assert.equal(withFlag.status, withoutFlag.status, '--staged 与无参数 exit code 应一致')
  } finally {
    rmScratch(root)
  }
})

// ─── 17. 放过:ALTER TABLE ADD COLUMN 为后补 TS 列提供出处 ──
test('字段级尺子: ALTER TABLE ADD COLUMN 为后补 TS 列提供出处 → exit 0', () => {
  const root = createTempProject()
  try {
    // TS 侧比 CREATE body 多一列 bio,由 ALTER ADD COLUMN 提供出处
    writeSchema(root, 'users.ts', [['users', 'users']], [
      { tsName: 'bio', dbName: 'bio', type: 'text' },
    ])
    writeMigration(
      root,
      '0000_init.sql',
      `CREATE TABLE "users" (\n  ${STD_COLS}\n);\nALTER TABLE "users" ADD COLUMN "bio" text;\n`,
    )
    const r = runScript(root)
    assertPass(r)
    // 若 ADD COLUMN 未被记出处,bio 会成为 missing column → exit 1
    assert.match(r.stdout, /missing columns:\s+0/)
  } finally {
    rmScratch(root)
  }
})

// ─── 18. 放过:RENAME COLUMN 后以终名对齐 TS 列(旧名不再计出处) ──
test('字段级尺子: RENAME COLUMN 后以终名对齐 TS 列 → exit 0', () => {
  const root = createTempProject()
  try {
    // TS 侧用改名后的终名 nickname;migration 链 CREATE 的是旧名 nick,RENAME 到 nickname
    writeSchema(root, 'users.ts', [['users', 'users']], [
      { tsName: 'nickname', dbName: 'nickname', type: 'text' },
    ])
    writeMigration(
      root,
      '0000_init.sql',
      `CREATE TABLE "users" (\n  ${STD_COLS},\n  "nick" varchar(50)\n);\n` +
        `ALTER TABLE "users" RENAME COLUMN "nick" TO "nickname";\n`,
    )
    const r = runScript(root)
    assertPass(r)
    // 若 RENAME COLUMN 未被处理,出处里只有旧名 nick → missing nickname → exit 1
    assert.match(r.stdout, /missing columns:\s+0/)
  } finally {
    rmScratch(root)
  }
})

// ─── 19. 放过:DROP COLUMN 移除出处(migration 多出的列被正当删掉) ──
test('字段级尺子: DROP COLUMN 移除出处 → 不产生 extra columns(exit 0)', () => {
  const root = createTempProject()
  try {
    writeSchema(root, 'users.ts', [['users', 'users']])
    writeMigration(
      root,
      '0000_init.sql',
      `CREATE TABLE "users" (\n  ${STD_COLS},\n  "legacy" varchar(50)\n);\n` +
        `ALTER TABLE "users" DROP COLUMN "legacy";\n`,
    )
    const r = runScript(root)
    assertPass(r)
    // 若 DROP COLUMN 未被处理,出处里残留 legacy → extra columns: 1;为 0 才证明出处被移除
    assert.match(r.stdout, /extra columns:\s+0/)
  } finally {
    rmScratch(root)
  }
})

// ─── 20. 放过:extra column(migration 有列 / TS 无)→ 信息级,不阻塞 ──
test('字段级尺子: migration 多出列(TS 无)→ extra columns 信息级,不阻塞(exit 0)', () => {
  const root = createTempProject()
  try {
    writeSchema(root, 'users.ts', [['users', 'users']])
    writeMigration(
      root,
      '0000_init.sql',
      `CREATE TABLE "users" (\n  ${STD_COLS},\n  "legacy_extra" varchar(50)\n);\n`,
    )
    const r = runScript(root)
    assertPass(r)
    assert.match(r.stdout, /extra columns:\s+1/, '多出的列应计为信息级 extra column')
    assert.match(r.stdout, /missing columns:\s+0/)
  } finally {
    rmScratch(root)
  }
})
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
