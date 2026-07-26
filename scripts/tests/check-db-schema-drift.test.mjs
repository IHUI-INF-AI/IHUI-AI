import { test } from 'node:test'
import assert from 'node:assert/strict'
import { spawnSync } from 'node:child_process'
import { mkdtempSync, writeFileSync, mkdirSync, rmSync } from 'node:fs'
import { join } from 'node:path'
import { tmpdir } from 'node:os'
import { fileURLToPath } from 'node:url'

// ─── 路径推导(AGENTS.md §15:用 import.meta.url,不硬编码) ───
const __dirname = fileURLToPath(new URL('.', import.meta.url))
const SCRIPT_PATH = join(__dirname, '..', 'check-db-schema-drift.mjs')

// ─── 辅助:在临时目录搭建 packages/database 结构 ──────────
function createTempProject() {
  const root = mkdtempSync(join(tmpdir(), 'ihui-drift-'))
  mkdirSync(join(root, 'packages', 'database', 'src', 'schema'), { recursive: true })
  mkdirSync(join(root, 'packages', 'database', 'drizzle'), { recursive: true })
  return root
}

// 辅助:写一个 TS schema 文件
function writeSchema(root, fileName, tableNames) {
  const lines = ["import { pgTable, text, timestamp } from 'drizzle-orm/pg-core'\n\n"]
  for (const [varName, tableName] of tableNames) {
    lines.push(
      `export const ${varName} = pgTable('${tableName}', {\n` +
        `  id: text('id').primaryKey(),\n` +
        `  createdAt: timestamp('created_at').defaultNow(),\n` +
        `})\n\n`,
    )
  }
  writeFileSync(join(root, 'packages', 'database', 'src', 'schema', fileName), lines.join(''))
}

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
    stdio: ['pipe', 'pipe', 'pipe'],
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

// 辅助:断言 stdout 报告 schema drift check 失败
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

// ─── 1. CLI --help 不崩溃(脚本未实现 --help,按默认模式运行) ───
test('CLI: --help 不崩溃(脚本未实现 --help,直接走默认全量扫描)', () => {
  const root = createTempProject()
  try {
    const r = runScript(root, ['--help'])
    assert.ok(
      r.status === 0 || r.status === 1,
      `--help 不应 crash,实际 exit ${r.status}\nstderr: ${r.stderr}`,
    )
    assert.ok(!r.stderr.includes('Error:'), `--help 不应产生未捕获 Error`)
  } finally {
    rmSync(root, { recursive: true, force: true })
  }
})

// ─── 2. 无参数运行(默认全量扫描) ────────────────────────
test('CLI: 无参数运行(默认行为,空 schema + 空 migrations → exit 0)', () => {
  const root = createTempProject()
  try {
    const r = runScript(root)
    assertPass(r)
    // stdout 应显示扫描到 0 个 TS 表 / 0 个 migration 表
    assert.match(r.stdout, /TS schema tables:\s+0/)
    assert.match(r.stdout, /migration tables:\s+0/)
  } finally {
    rmSync(root, { recursive: true, force: true })
  }
})

// ─── 3. schema 与 migration 一致 → exit 0 ────────────────
test('一致: TS schema 有 users / migration 有 users → exit 0', () => {
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
  } finally {
    rmSync(root, { recursive: true, force: true })
  }
})

// ─── 4. TS schema 有表但 migration 缺失 → exit 1(missing migrations) ──
test('drift: TS schema 有 users 但 migration 缺失 → exit 1', () => {
  const root = createTempProject()
  try {
    writeSchema(root, 'users.ts', [['users', 'users']])
    // migration 目录存在但为空
    const r = runScript(root)
    assertFail(r, /migration 缺失/)
    assert.match(r.stdout, /users/, 'stdout 应列出缺失的表名 users')
  } finally {
    rmSync(root, { recursive: true, force: true })
  }
})

// ─── 5. migration 有表但 TS schema 没有 → dead migration(warn,exit 0) ──
test('drift: migration 有 orders 但 TS schema 无 → dead migration warn(exit 0)', () => {
  const root = createTempProject()
  try {
    // TS schema 空白,只写一个不相关文件占位
    writeFileSync(
      join(root, 'packages', 'database', 'src', 'schema', 'index.ts'),
      'export {}\n',
    )
    writeMigration(
      root,
      '0000_init.sql',
      `CREATE TABLE "orders" (\n  "id" text PRIMARY KEY\n);\n`,
    )
    const r = runScript(root)
    // dead migration 是 warn 级,不阻塞 → exit 0
    assertPass(r)
    assert.match(r.stdout, /dead migrations:\s+1/, '应报告 1 个 dead migration')
    assert.match(r.stdout, /orders/, '应列出 dead migration 表名 orders')
  } finally {
    rmSync(root, { recursive: true, force: true })
  }
})

// ─── 6. DROP TABLE 后未重建 → 表从 finalTables 移除 ──────
test('migration: DROP TABLE orders 后未 CREATE → 表从最终集合移除(若 TS 有则 missing)', () => {
  const root = createTempProject()
  try {
    // TS schema 不含 orders
    writeFileSync(
      join(root, 'packages', 'database', 'src', 'schema', 'index.ts'),
      'export {}\n',
    )
    writeMigration(
      root,
      '0000_init.sql',
      `CREATE TABLE "orders" (id text);\nDROP TABLE "orders";\n`,
    )
    const r = runScript(root)
    // DROP 后 finalTables 不含 orders → 既不是 missing 也不是 dead
    assertPass(r)
    assert.match(r.stdout, /dead migrations:\s+0/, 'DROP 后不应算 dead migration')
  } finally {
    rmSync(root, { recursive: true, force: true })
  }
})

// ─── 7. 跨文件 CREATE + DROP + CREATE → 表存在(按文件顺序应用) ──
test('migration: 跨文件 0000 CREATE + 0001 DROP + 0002 CREATE → 表存在', () => {
  const root = createTempProject()
  try {
    writeSchema(root, 'users.ts', [['users', 'users']])
    writeMigration(root, '0000_init.sql', `CREATE TABLE "users" (id text);\n`)
    writeMigration(root, '0001_drop.sql', `DROP TABLE "users";\n`)
    writeMigration(root, '0002_recreate.sql', `CREATE TABLE "users" (id text);\n`)
    const r = runScript(root)
    assertPass(r)
    assert.match(r.stdout, /missing migrations:\s+0/)
  } finally {
    rmSync(root, { recursive: true, force: true })
  }
})

// ─── 7b. 同文件 CREATE + DROP → 表被 DROP(按 SQL 顺序应用) ──
test('migration: 同文件 CREATE + DROP → 表不存在(按 SQL 出现顺序应用:CREATE users → CREATE orders → DROP users)', () => {
  const root = createTempProject()
  try {
    writeSchema(root, 'users.ts', [['users', 'users']])
    // 同文件 CREATE "users" + CREATE "orders" + DROP "users"
    // 按 SQL 顺序应用:ADD users → ADD orders → DELETE users → finalTables={orders}
    // 再加一个 orders 表验证 partial 行为:CREATE orders 不被 DROP → finalTables 含 orders
    writeMigration(
      root,
      '0000_init.sql',
      `CREATE TABLE "users" (id text);\nCREATE TABLE "orders" (id text);\nDROP TABLE "users";\n`,
    )
    const r = runScript(root)
    // users 被 DROP,orders 仍在 → users 缺失(missing) → exit 1
    assertFail(r, /migration 缺失/)
    assert.match(r.stdout, /users/)
  } finally {
    rmSync(root, { recursive: true, force: true })
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
      `DROP TABLE IF EXISTS "users";\nCREATE TABLE "users" (\n  "id" text PRIMARY KEY\n);\n`,
    )
    const r = runScript(root)
    assertPass(r)
    assert.match(r.stdout, /missing migrations:\s+0/)
    assert.match(r.stdout, /dead migrations:\s+0/, '不应误报 dead migration')
  } finally {
    rmSync(root, { recursive: true, force: true })
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
      `CREATE TABLE "users" (\n  "id" text PRIMARY KEY\n);\nDROP TABLE "users";\n`,
    )
    const r = runScript(root)
    // users 被 DROP → finalTables 不含 users → TS schema 有 users → missing → exit 1
    assertFail(r, /migration 缺失/)
    assert.match(r.stdout, /users/)
  } finally {
    rmSync(root, { recursive: true, force: true })
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
      `DROP TABLE IF EXISTS "users";\nCREATE TABLE "orders" (\n  "id" text PRIMARY KEY\n);\n`,
    )
    const r = runScript(root)
    assertPass(r)
    assert.match(r.stdout, /missing migrations:\s+0/)
    assert.match(r.stdout, /dead migrations:\s+0/, '不应误报 dead migration(orders 在 TS schema 中存在)')
  } finally {
    rmSync(root, { recursive: true, force: true })
  }
})

// ─── 8. ALTER TABLE RENAME TO → 旧名移除 / 新名添加 ──────
test('migration: RENAME TO → 旧名移除,新名添加到 finalTables', () => {
  const root = createTempProject()
  try {
    // TS schema 用新名 users_new
    writeSchema(root, 'users.ts', [['usersNew', 'users_new']])
    writeMigration(
      root,
      '0000_init.sql',
      `CREATE TABLE "users_old" (id text);\nALTER TABLE "users_old" RENAME TO "users_new";\n`,
    )
    const r = runScript(root)
    assertPass(r)
    assert.match(r.stdout, /missing migrations:\s+0/)
  } finally {
    rmSync(root, { recursive: true, force: true })
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
      `CREATE TABLE IF NOT EXISTS "users" (\n  "id" text PRIMARY KEY\n);\n`,
    )
    const r = runScript(root)
    assertPass(r)
  } finally {
    rmSync(root, { recursive: true, force: true })
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
      `CREATE TABLE "users" (id text);\nCREATE TABLE "orders" (id text);\n`,
    )
    const r = runScript(root)
    assertPass(r)
    assert.match(r.stdout, /TS schema tables:\s+2/)
  } finally {
    rmSync(root, { recursive: true, force: true })
  }
})

// ─── 11. 表名大小写不敏感(脚本统一转小写) ────────────────
test('扫描: pgTable("Users") + CREATE TABLE "users" → 一致(大小写不敏感)', () => {
  const root = createTempProject()
  try {
    writeSchema(root, 'users.ts', [['Users', 'Users']])
    writeMigration(root, '0000_init.sql', `CREATE TABLE "users" (id text);\n`)
    const r = runScript(root)
    assertPass(r)
  } finally {
    rmSync(root, { recursive: true, force: true })
  }
})

// ─── 12. SKIP_SCHEMA_DRIFT=1 环境变量(脚本不支持,验证默认行为) ──
test('环境变量: SKIP_SCHEMA_DRIFT=1 → 脚本不支持,仍正常扫描(missing → exit 1)', () => {
  const root = createTempProject()
  try {
    writeSchema(root, 'users.ts', [['users', 'users']])
    // migration 缺失,即使设了 SKIP_SCHEMA_DRIFT 仍应 exit 1(脚本不识别该 env)
    const r = runScript(root, [], { SKIP_SCHEMA_DRIFT: '1' })
    assertFail(r, /migration 缺失/)
  } finally {
    rmSync(root, { recursive: true, force: true })
  }
})

// ─── 13. schema 目录不存在 → 0 表,不 crash ──────────────
test('鲁棒性: schema 目录不存在 → 0 表,不 crash', () => {
  const root = mkdtempSync(join(tmpdir(), 'ihui-drift-nodir-'))
  try {
    // 不创建 packages/database/src/schema 目录
    mkdirSync(join(root, 'packages', 'database', 'drizzle'), { recursive: true })
    const r = runScript(root)
    assertPass(r)
    assert.match(r.stdout, /TS schema tables:\s+0/)
  } finally {
    rmSync(root, { recursive: true, force: true })
  }
})

// ─── 14. migrations 目录不存在 → 0 migration 表,不 crash ──
test('鲁棒性: migrations 目录不存在 → 0 migration 表,TS 有表 → exit 1', () => {
  const root = mkdtempSync(join(tmpdir(), 'ihui-drift-nomig-'))
  try {
    mkdirSync(join(root, 'packages', 'database', 'src', 'schema'), { recursive: true })
    writeSchema(root, 'users.ts', [['users', 'users']])
    // migrations 目录不存在 → scanMigrations 返回空集合 → users 缺失 → exit 1
    const r = runScript(root)
    assertFail(r, /migration 缺失/)
  } finally {
    rmSync(root, { recursive: true, force: true })
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
    rmSync(root, { recursive: true, force: true })
  }
})

// ─── 16. --staged flag(脚本未区分,按全量扫描) ───────────
test('CLI: --staged flag 被脚本忽略(脚本注释明确"schema drift 是全局问题")', () => {
  const root = createTempProject()
  try {
    writeSchema(root, 'users.ts', [['users', 'users']])
    writeMigration(
      root,
      '0000_init.sql',
      `CREATE TABLE "users" (id text);\n`,
    )
    const r = runScript(root, ['--staged'])
    // --staged 应与无参数行为一致
    assertPass(r)
  } finally {
    rmSync(root, { recursive: true, force: true })
  }
})
