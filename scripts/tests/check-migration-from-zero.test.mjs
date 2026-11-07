// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * O18 空库重放守门的镜像测试(§22c / §22d)。
 * 跑法:node --test scripts/tests/check-migration-from-zero.test.mjs
 *
 * 只断言 __test__ 导出的纯函数 —— 不碰 DB、不起子进程、不 import 生产副作用路径。
 */
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

// §22d:源脚本 main() 受 isDirectRun 守护,被 import 时不得有任何副作用(不建库、不 spawn psql)。
import { __test__ as src } from '../check-migration-from-zero.mjs'

const DRIZZLE_DIR = join(
  dirname(fileURLToPath(import.meta.url)),
  '..',
  '..',
  'packages/database/drizzle',
)

/**
 * 2026-11-06:8 个「21:05 批改写件」。0212 的简单 CASE 混进搜索型 WHEN 曾在空库重放时
 * 42883 中断整链;这里把每件的改写意图钉成静态断言,防止"为跑通而删守卫/退默认值"式回退。
 */
const REWRITE_TAGS = [
  '0085_exam_wrong_unique',
  '0108_r83_supplement_27_tables',
  '0115_r82_seed_unique_indexes',
  '0125_knowledge_graph',
  '0126_ai-world-sync',
  '0212_phase2_refund_invoice_fk',
  '20261018160000_agent_state_tables_runtime_reality',
  '20261104120000_agent_team_collab',
]

function readMigration(tag) {
  return readFileSync(join(DRIZZLE_DIR, `${tag}.sql`), 'utf8')
}

test('8 个改写件在 journal 中各出现一次,且门的 DB 回归断言只覆盖这 8 个 tag', () => {
  const journal = JSON.parse(readFileSync(join(DRIZZLE_DIR, 'meta/_journal.json'), 'utf8'))
  const tags = journal.entries.map((entry) => entry.tag)
  for (const tag of REWRITE_TAGS) {
    assert.equal(tags.filter((t) => t === tag).length, 1, `${tag} 必须且只能在 journal 出现一次`)
    assert.ok(readMigration(tag).length > 0, `${tag}.sql 必须存在且非空`)
  }
  const covered = [...new Set(src.REWRITE_REGRESSIONS.map((item) => item.tag))].sort()
  assert.deepEqual(covered, [...REWRITE_TAGS].sort(), '门的回归断言覆盖面必须与夹具清单一致')
})

test('0212 的 order_type 转换是自洽的搜索型 CASE(不再混简单 CASE,也不退回 COALESCE(CAST))', () => {
  const sql = readMigration('0212_phase2_refund_invoice_fk')
  assert.ok(
    !/CASE\s+"order_type"\s*\n\s*WHEN/.test(sql),
    '不得保留简单 CASE "order_type"(搜索型 WHEN 会让它编译成 varchar = boolean)',
  )
  assert.match(
    sql,
    /CASE\s*\n\s*WHEN "order_type" = 'course' THEN 7/,
    'course 分支必须自带完整比较',
  )
  assert.match(sql, /WHEN "order_type" = 'card' THEN 8/, 'card 分支必须自带完整比较')
  assert.ok(
    sql.includes(`WHEN "order_type" ~ '^[0-9]+$' THEN "order_type"::integer`),
    '数字串守卫必须在 CASE 内保留',
  )
  assert.match(sql, /ELSE 0\s*\n\s*END;/, '非数字/空值必须落到 0')
  assert.ok(
    !/COALESCE\s*\(\s*CAST\s*\(\s*"order_type"/.test(sql),
    '不得退回 COALESCE(CAST(...))(22P02 捕获不到)',
  )
  assert.match(
    sql,
    /IF EXISTS \(\s*SELECT 1 FROM information_schema\.columns/,
    '列类型守卫(幂等)必须保留',
  )
})

test('0085 / 0115 / 0125 / 20261104120000 的守卫与 IF NOT EXISTS 未被回退', () => {
  const sql0085 = readMigration('0085_exam_wrong_unique')
  assert.match(
    sql0085,
    /IF NOT EXISTS \(SELECT 1 FROM pg_constraint WHERE conname = 'exam_wrong_question_user_question_unique'\)/,
  )
  assert.match(sql0085, /EXCEPTION WHEN unique_violation THEN/, '重复数据必须降级为告警而非中断')

  const sql0115 = readMigration('0115_r82_seed_unique_indexes')
  assert.equal(
    (sql0115.match(/CREATE UNIQUE INDEX "/g) ?? []).length,
    4,
    '4 条唯一索引必须仍在 DO 守卫内(带名字的裸 CREATE)',
  )
  assert.equal((sql0115.match(/EXCEPTION WHEN unique_violation THEN/g) ?? []).length, 4)

  const sql0125 = readMigration('0125_knowledge_graph')
  assert.equal((sql0125.match(/CREATE UNIQUE INDEX IF NOT EXISTS/g) ?? []).length, 2)

  const sql20261104 = readMigration('20261104120000_agent_team_collab')
  assert.equal(
    (sql20261104.match(/CREATE UNIQUE INDEX IF NOT EXISTS/g) ?? []).length,
    3,
    '3 条团队唯一索引必须 IF NOT EXISTS',
  )
})

test('0108 / 0126 / 20261018160000 的重放放行 DEFAULT 已撤、空表重建分支不加默认', () => {
  const sql0108 = readMigration('0108_r83_supplement_27_tables')
  assert.match(sql0108, /ALTER COLUMN "client_id" DROP DEFAULT/)
  assert.match(sql0108, /ALTER COLUMN "private_key" DROP DEFAULT/)

  const sql0126 = readMigration('0126_ai-world-sync')
  for (const [table, column] of [
    ['ai_world_categories', 'slug'],
    ['ai_world_items', 'kind'],
    ['ai_world_items', 'source'],
  ]) {
    assert.match(
      sql0126,
      new RegExp(`ALTER TABLE "${table}" ALTER COLUMN "${column}" DROP DEFAULT`),
      `${table}.${column} 的临时默认值必须撤掉`,
    )
  }

  const sqlAgent = readMigration('20261018160000_agent_state_tables_runtime_reality')
  assert.match(
    sqlAgent,
    /SELECT count\(\*\) INTO row_count FROM "agent_working_memory_compression"/,
    '空表守卫必须保留',
  )
  assert.ok(
    !/ADD COLUMN "original_messages" integer NOT NULL DEFAULT/.test(sqlAgent),
    'row_count=0 分支不得留下默认值',
  )
  assert.ok(
    !/ADD COLUMN "compressed_to" integer NOT NULL DEFAULT/.test(sqlAgent),
    'row_count=0 分支不得留下默认值',
  )
})

test('__test__ 导出形状齐全(§22c 锚点)', () => {
  for (const key of [
    'parseJournalEntries',
    'unquoteIdentifier',
    'diffIdentifierSets',
    'diffSchemaMaps',
    'RUNTIME_MANAGED_TABLES',
    'MIGRATION_OWNED_UNMODELED_TABLES',
    'firstErrorLine',
    'errorFrom',
    'formatReplayFailures',
    'extractTableMap',
    'maskDatabaseUrl',
    'redactSecrets',
    'readEnvValue',
    'quoteIdent',
  ]) {
    assert.ok(key in src, `__test__ 缺少导出键 ${key}`)
  }
})

/* ---------------- ① 表集合差集:缺表 / 多表分别命中 ---------------- */

test('表集合差集:schema 有而库里没有 → missing;库里有而 schema 没有 → extra', () => {
  const expected = new Map([
    ['users', new Set(['id', 'name'])],
    ['agents', new Set(['id'])],
    ['webhook_subscriptions', new Set(['id'])],
  ])
  const actual = new Map([
    ['users', new Set(['id', 'name'])],
    ['agents', new Set(['id'])],
    ['legacy_orphan_table', new Set(['id'])],
  ])
  const diff = src.diffSchemaMaps(expected, actual)
  assert.deepEqual(
    diff.tables.missing,
    ['webhook_subscriptions'],
    '缺表必须命中 webhook_subscriptions',
  )
  assert.deepEqual(diff.tables.extra, ['legacy_orphan_table'], '多表必须命中 legacy_orphan_table')
  assert.equal(diff.isEmpty(), false)
  // 整表缺失的表不再刷列噪音(避免一次失败产出上百行假差集)
  assert.deepEqual(
    diff.columns.map((c) => c.table),
    [],
    '缺表不应连带报列差集',
  )
})

test('表集合差集:完全一致 → isEmpty 为真', () => {
  const map = () =>
    new Map([
      ['users', new Set(['id', 'email'])],
      ['agents', new Set(['id'])],
    ])
  const diff = src.diffSchemaMaps(map(), map())
  assert.equal(diff.isEmpty(), true, '相同 schema 必须判为空差集')
  assert.deepEqual(diff.columns, [])
})

test('__migrations 簿记表不算多表(drizzle-kit 自建,非业务 schema)', () => {
  const diff = src.diffSchemaMaps(
    new Map([['users', new Set(['id'])]]),
    new Map([
      ['users', new Set(['id'])],
      ['__migrations', new Set(['id', 'name', 'hash'])],
    ]),
  )
  assert.deepEqual(diff.tables.extra, [], '__migrations 必须被忽略')
  assert.equal(diff.isEmpty(), true)
})

test('RUNTIME_MANAGED_TABLES 运行期自管表豁免多表(rag_chunks),其余多表照红', () => {
  assert.ok(src.RUNTIME_MANAGED_TABLES.has('rag_chunks'), 'rag_chunks 必须在运行期自管清单内')
  assert.ok(
    !src.RUNTIME_MANAGED_TABLES.has('ownership_backfill_state'),
    'ownership_backfill_state 由迁移建,不得再挂在运行期自管清单',
  )
  assert.ok(
    src.MIGRATION_OWNED_UNMODELED_TABLES.has('ownership_backfill_state'),
    'ownership_backfill_state 必须在迁移建-不建模清单内',
  )
  const diff = src.diffSchemaMaps(
    new Map([['users', new Set(['id'])]]),
    new Map([
      ['users', new Set(['id'])],
      ['rag_chunks', new Set(['id', 'embedding'])],
      ['legacy_orphan_table', new Set(['id'])],
    ]),
  )
  assert.deepEqual(diff.tables.extra, ['legacy_orphan_table'], '清单外的多表必须照常报出')
  assert.equal(diff.isEmpty(), false, '清单外多表存在时不得判空')
  // 清单内表不得连带豁免清单外多表(豁免按表名逐个判定)
  const onlyRuntime = src.diffSchemaMaps(
    new Map([['users', new Set(['id'])]]),
    new Map([
      ['users', new Set(['id'])],
      ['rag_chunks', new Set(['id', 'embedding'])],
    ]),
  )
  assert.deepEqual(onlyRuntime.tables.extra, [], 'rag_chunks 必须被表级豁免')
  assert.equal(onlyRuntime.isEmpty(), true)
})

/* ---------------- ② 列名差集 ---------------- */

test('列名差集:同表缺列 / 多列分别命中(O18 主案:0110 洞的机器可检形态)', () => {
  const expected = new Map([['skills', new Set(['id', 'name', 'deleted_at', 'tombstoned_at'])]])
  // 库里 skills 少 tombstoned_at(重放中途失败 → 该列没建上)、多 retired_at
  const actual = new Map([['skills', new Set(['id', 'name', 'deleted_at', 'retired_at'])]])
  const diff = src.diffSchemaMaps(expected, actual)
  assert.deepEqual(diff.tables.missing, [], '表存在,不该报缺表')
  assert.equal(diff.columns.length, 1)
  assert.deepEqual(diff.columns[0], {
    table: 'skills',
    missing: ['tombstoned_at'],
    extra: ['retired_at'],
    caseDrift: [],
  })
})

test('extractTableMap:只收 pgTable,且 JS 字段名不等于 DDL 列名时取列对象的 name', () => {
  class PgTable {}
  const orm = {
    getTableName: () => 'chat_messages',
    getTableColumns: () => ({
      createdAt: { name: 'created_at' },
      roomId: { name: 'room_id' },
    }),
  }
  const tables = src.extractTableMap([new PgTable(), { notATable: true }, null, [1, 2]], orm)
  assert.equal(tables.size, 1, '非 PgTable 的导出(re-export 对象/数组)必须被过滤掉')
  assert.deepEqual([...tables.get('chat_messages')].sort(), ['created_at', 'room_id'])
})

/* ---------------- ③ 逐迁移失败报告:含 tag 与错误首行 ---------------- */

test('第 N 个迁移失败的输入 → 报告含 tag 与错误首行(不 import 生产副作用)', () => {
  const entries = src.parseJournalEntries(
    JSON.stringify({
      dialect: 'postgresql',
      entries: [
        { idx: 1, tag: '0000_naive_barracuda' },
        { idx: 2, tag: '0110_skills_tombstone' },
        { idx: 3, tag: '9999_after_the_hole' },
      ],
    }),
  )
  assert.deepEqual(
    entries.map((e) => e.tag),
    ['0000_naive_barracuda', '0110_skills_tombstone', '9999_after_the_hole'],
  )
  assert.deepEqual(
    entries.map((e) => e.file),
    ['0000_naive_barracuda.sql', '0110_skills_tombstone.sql', '9999_after_the_hole.sql'],
  )

  // 模拟:重放器把 psql 的噪声输出交给 firstErrorLine
  const noisy = [
    'Command failed: C:\\Program Files\\PostgreSQL\\17\\bin\\psql.exe -h 127.0.0.1 ...',
    'psql:drizzle/0110_skills_tombstone.sql: ERROR:  column "deleted_at" of relation "skills" already exists',
    'WHERE: while executing statement at line 12',
  ].join('\n')
  assert.equal(src.firstErrorLine(noisy), 'column "deleted_at" of relation "skills" already exists')

  const failures = [{ idx: 2, tag: '0110_skills_tombstone', error: src.firstErrorLine(noisy) }]
  const report = src.formatReplayFailures(failures, entries.length).join('\n')
  assert.match(report, /0110_skills_tombstone/, '报告必须点出失败迁移 tag')
  assert.match(report, /#2\/3/, '报告必须点出是第几个迁移')
  assert.match(
    report,
    /column "deleted_at" of relation "skills" already exists/,
    '报告必须带错误原因',
  )
  assert.ok(!/already exists/.test(src.firstErrorLine('')), '空输出不得伪造原因')
  assert.equal(src.firstErrorLine(''), '(无输出)')
})

test('journal 顺序按 idx 升序而非数组顺序(idx 乱序夹具)', () => {
  const entries = src.parseJournalEntries(
    JSON.stringify({
      entries: [
        { idx: 3, tag: 'c' },
        { idx: 1, tag: 'a' },
        { idx: 2, tag: 'b' },
        { idx: 9, tag: 42 },
      ],
    }),
  )
  assert.deepEqual(
    entries.map((e) => e.tag),
    ['a', 'b', 'c'],
    '无 tag/无 idx 的条目被丢弃,其余按 idx 升序',
  )
})

test('psql 中文 locale 与无 ERROR 前缀的输出也能取到原因行', () => {
  assert.equal(
    src.firstErrorLine(
      'node:internal/child_process:110\nStack:\n错误:  关系 "__migrations" 不存在\nLINE 1: select 1',
    ),
    '关系 "__migrations" 不存在',
  )
  assert.equal(
    src.firstErrorLine('some random failure without prefix'),
    'some random failure without prefix',
  )
  assert.match(src.firstErrorLine('Error: connect ETIMEDOUT 127.0.0.1:5432'), /ETIMEDOUT/)
})

/* ---------------- ④ 引号 / 大小写不得误判为差异 ---------------- */

test('带引号标识符剥引号后与裸名同义,不算差异', () => {
  assert.equal(src.unquoteIdentifier('"users"'), 'users')
  assert.equal(src.unquoteIdentifier('users'), 'users')
  assert.equal(src.unquoteIdentifier('"OrderItems"'), 'OrderItems')
  assert.equal(src.unquoteIdentifier('"weird""name"'), 'weird"name', '内部双写引号需还原')
  const diff = src.diffSchemaMaps(
    new Map([['"users"', new Set(['"id"', 'email'])]]),
    new Map([['users', new Set(['id', 'email'])]]),
  )
  assert.equal(diff.isEmpty(), true, 'schema 侧带引号 / DB 侧裸名必须判为同一对象')
})

test('纯大小写差异不判为缺失表,而是单列 caseDrift(既不误报也不放过)', () => {
  const diff = src.diffSchemaMaps(
    new Map([['OrderItems', new Set(['id'])]]),
    new Map([['orderitems', new Set(['id'])]]),
  )
  assert.deepEqual(diff.tables.missing, [], '不能因为大小写就报"缺表"')
  assert.deepEqual(diff.tables.extra, [], '同理不报"多表"')
  assert.deepEqual(diff.tables.caseDrift, [{ expected: 'OrderItems', actual: 'orderitems' }])
  assert.equal(diff.isEmpty(), false, '真漂移仍须 FAIL')
})

/* ---------------- ③b 既有漂移基线:只豁免登记过的多列,新增一律红 ---------------- */

test('pruneKnownHoles:基线内的多列被豁免,基线外新增的列/缺列/缺表照样红', () => {
  const baseline = { users: ['search_vector'] }
  const expected = new Map([
    ['users', new Set(['id'])],
    ['gone_away', new Set(['id'])],
  ])
  const actual = new Map([
    ['users', new Set(['id', 'search_vector', 'brand_new_drift'])],
    ['extra_table', new Set(['id'])],
  ])
  const { diff, stale } = src.pruneKnownHoles(src.diffSchemaMaps(expected, actual), baseline)
  assert.equal(diff.columns.length, 1)
  assert.deepEqual(diff.columns[0].extra, ['brand_new_drift'], '未登记的新漂移必须报出')
  assert.deepEqual(diff.tables.missing, ['gone_away'], '缺表不受基线保护')
  assert.deepEqual(diff.tables.extra, ['extra_table'], '多表不受基线保护')
  assert.equal(diff.isEmpty(), false)
  assert.deepEqual(stale, [], '基线命中则不算失效')
})

test('pruneKnownHoles:漂移被修好后基线条目转为 stale 提醒(不许留僵尸豁免)', () => {
  const baseline = { users: ['search_vector'] }
  const map = () => new Map([['users', new Set(['id'])]])
  const { diff, stale } = src.pruneKnownHoles(src.diffSchemaMaps(map(), map()), baseline)
  assert.equal(diff.isEmpty(), true)
  assert.deepEqual(stale, ['users.search_vector'])
})

test('KNOWN_SCHEMA_HOLES 基线条目必须全部带豁免价值(非空且去重)', () => {
  for (const [table, columns] of Object.entries(src.KNOWN_SCHEMA_HOLES)) {
    assert.ok(table.length > 0)
    assert.ok(columns.length > 0, `${table} 的豁免列不得为空(空条目应删除)`)
    assert.equal(new Set(columns).size, columns.length, `${table} 豁免列不得重复`)
  }
})

/* ---------------- 附带:凭据脱敏(O18 硬约束) ---------------- */

/**
 * 口令样本从环境变量读,缺失即 skip(2026-11-01)。
 * 原先这里直接写死开发库口令 —— 测试文件也是仓库的一部分,写死即随仓库分发。
 * 缺样本时**明说原因地跳过**,而不是用空串跑一遍换来一条"永远绿"的假绿用例。
 */
const SAMPLE_DB_PASSWORD = (process.env.IHUI_TEST_DB_PASSWORD ?? '').trim()

test(
  '任何输出文本都不得带出密码',
  {
    skip: SAMPLE_DB_PASSWORD
      ? false
      : '未设置 IHUI_TEST_DB_PASSWORD:该用例需要一份真实口令样本,缺失即跳过(不内置口令,避免假绿)',
  },
  () => {
    const pw = SAMPLE_DB_PASSWORD
    const raw = `failed to connect to postgresql://ihui:${pw}@127.0.0.1:5432/ihui_fz_abcd1234`
    assert.ok(!src.redactSecrets(raw, pw).includes(pw), '裸口令必须打码')
    assert.ok(!src.redactSecrets(raw, pw).includes(encodeURIComponent(pw)), 'URL 编码口令必须打码')
    assert.equal(src.maskDatabaseUrl(`postgresql://ihui:${pw}@h/db`), `postgresql://ihui:***@h/db`)
    assert.equal(
      src.readEnvValue(
        'A=1\nexport DATABASE_URL="postgresql://u:p@h:5432/db"\nB=2',
        'DATABASE_URL',
      ),
      'postgresql://u:p@h:5432/db',
      '.env 取值需支持 export 前缀与引号包裹',
    )
    assert.equal(src.readEnvValue('A=1\nOTHER=x', 'DATABASE_URL'), '', '缺失键返回空串')
    assert.equal(src.quoteIdent('ihui_fz"abc'), '"ihui_fz""abc"', '临时库名带引号需转义')
  },
)
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
