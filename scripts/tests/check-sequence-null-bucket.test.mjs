// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

// scripts/tests/check-sequence-null-bucket.test.mjs
/**
 * 守门"可空排序列的新 NULL 兜底"的 §22c 镜像测试(G-817)。
 *
 * 跑法:node --test scripts/tests/check-sequence-null-bucket.test.mjs
 *
 * 纪律(AGENTS.md §22c/§22d):本文件不复制判据实现,只 import 源脚本导出的
 * `__test__`;源脚本 main() 受 isDirectRun 守护,import 时零副作用(第 0 例钉这一点)。
 * 端到端三例用合成夹具(mkScratch 临时目录 + 假迁移目录,§26 禁 os.tmpdir):
 *   ① 有回填 + 有触发器 ⇒ 绿;
 *   ② 有回填 + 无触发器 ⇒ 红;
 *   ③ --report-only     ⇒ 报数不红(RC=0)。
 */
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { mkdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import { execFileSync } from 'node:child_process'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
// §26:临时夹具唯一落点(不落 os.tmpdir、不落仓库树内)
import { mkScratch } from '../lib/scratch-dir.mjs'

// §22c:直接 import 源模块导出的 __test__,杜绝"源/测两份真相"漂移。
import { __test__ as src } from '../check-sequence-null-bucket.mjs'

const HERE = dirname(fileURLToPath(import.meta.url))
const SCRIPT = join(HERE, '..', 'check-sequence-null-bucket.mjs')

/** 合成夹具仓:<scratch>/wt/packages/database/drizzle/*.sql(其余路径本门不看)。 */
function makeFixtureRepo(entries) {
  const wt = join(mkScratch('seq-bucket-'), 'wt')
  mkdirSync(join(wt, 'packages', 'database', 'drizzle'), { recursive: true })
  for (const [name, text] of entries) {
    writeFileSync(join(wt, 'packages', 'database', 'drizzle', name), text)
  }
  return wt
}

function runGate(root, args = []) {
  return execFileSync(process.execPath, [SCRIPT, '--root', root, ...args], {
    encoding: 'utf8',
    windowsHide: true,
  })
}

function runGateExpectFailure(root, args = []) {
  try {
    execFileSync(process.execPath, [SCRIPT, '--root', root, ...args], {
      encoding: 'utf8',
      windowsHide: true,
      stdio: ['ignore', 'pipe', 'pipe'],
    })
    return null
  } catch (e) {
    return `${e.stdout ?? ''}\n${e.stderr ?? ''}`
  }
}

const BACKFILL_SQL = `-- 假回填:只写 IS NULL 行,且带取号形态(窗口函数)
UPDATE "chat_messages" AS "cm"
SET "turn_ordinal" = "tc"."seq"
FROM (
  SELECT "id", ROW_NUMBER() OVER (PARTITION BY "conversation_id" ORDER BY "created_at", "id") AS "seq"
  FROM "chat_messages"
) AS "tc"
WHERE "tc"."id" = "cm"."id"
  AND "cm"."turn_ordinal" IS NULL;
`

const TRIGGER_SQL = `-- 假触发器:新 NULL 兜底
CREATE OR REPLACE FUNCTION "fn_message_turn_ordinal_autofill"()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  UPDATE "chat_messages"
     SET "turn_ordinal" = (
       SELECT COALESCE(MAX("turn_ordinal"), -1) + 1
       FROM "chat_messages" WHERE "conversation_id" = NEW."conversation_id"
     )
   WHERE "id" = NEW."id";
  RETURN NULL;
END;
$$;
CREATE TRIGGER "message_turn_ordinal_autofill"
  AFTER INSERT ON "chat_messages"
  FOR EACH ROW
  WHEN (NEW."turn_ordinal" IS NULL)
  EXECUTE FUNCTION "fn_message_turn_ordinal_autofill"();
`

test('0 __test__ 导出锚点齐全且 import 零副作用(§22c/§22d)', () => {
  for (const key of [
    'listMigrationSqlFiles',
    'findBackfilledColumns',
    'findTriggerBuckets',
    'functionAssignsColumn',
    'audit',
    'main',
  ]) {
    assert.ok(key in src, `__test__ 缺少导出键 ${key}`)
  }
  assert.equal(typeof src.main, 'function')
})

test('1 纯函数:回填识别 = UPDATE SET 列 + 该列 IS NULL 谓词', () => {
  assert.deepEqual(src.findBackfilledColumns(BACKFILL_SQL), [
    { table: 'chat_messages', col: 'turn_ordinal' },
  ])
  // 无 IS NULL 谓词的普通 UPDATE 不是回填型(判据空真的边界)。
  assert.deepEqual(src.findBackfilledColumns('UPDATE "chat_messages" SET "tokens" = 1;'), [])
})

test('2 纯函数:触发器识别(WHEN NEW.col IS NULL + EXECUTE FUNCTION 配对)', () => {
  const buckets = src.findTriggerBuckets(TRIGGER_SQL)
  assert.equal(buckets.length, 1)
  assert.equal(buckets[0].table, 'chat_messages')
  assert.equal(buckets[0].col, 'turn_ordinal')
  assert.equal(buckets[0].fnName, 'fn_message_turn_ordinal_autofill')
  assert.equal(src.functionAssignsColumn('UPDATE "t" SET "turn_ordinal" = 1', 'turn_ordinal'), true)
  assert.equal(src.functionAssignsColumn('NEW."turn_ordinal" := 1', 'turn_ordinal'), true)
  assert.equal(src.functionAssignsColumn('SET "role" = 1', 'turn_ordinal'), false)
})

test('3 端到端①:有回填 + 有触发器 ⇒ 绿(RC=0)', () => {
  const wt = makeFixtureRepo([
    ['20260101000000_backfill.sql', BACKFILL_SQL],
    ['20260102000000_triggers.sql', TRIGGER_SQL],
  ])
  try {
    const out = runGate(wt)
    assert.match(out, /全部回填型补号列都有"新 NULL 产不出来"的兜底/)
  } finally {
    rmSync(wt, { recursive: true, force: true })
  }
})

test('4 端到端②:有回填 + 无触发器 ⇒ 红(RC=1,点名列)', () => {
  const wt = makeFixtureRepo([['20260101000000_backfill.sql', BACKFILL_SQL]])
  try {
    const out = runGateExpectFailure(wt)
    assert.ok(out, '正式档必须判红(RC=1)')
    assert.match(out, /有回填无兜底 1 枚/)
    assert.match(out, /chat_messages\.turn_ordinal 无"新 NULL 不可能产生"的兜底/)
    assert.match(out, /两者缺一即半件/)
  } finally {
    rmSync(wt, { recursive: true, force: true })
  }
})

test('5 端到端③:--report-only 对存量缺兜底只报数不拦(RC=0)', () => {
  const wt = makeFixtureRepo([['20260101000000_backfill.sql', BACKFILL_SQL]])
  try {
    const out = runGate(wt, ['--report-only'])
    assert.match(out, /回填型补号列 1 枚:有兜底 0 \/ 无兜底 1/)
    assert.match(out, /--report-only:存量缺兜底 1 枚,只报数不拦/)
  } finally {
    rmSync(wt, { recursive: true, force: true })
  }
})

test('6 边界:盘面无回填型迁移 ⇒ 判据空真(绿,RC=0)', () => {
  const wt = makeFixtureRepo([['20260103000000_plain.sql', 'CREATE TABLE "t" ("id" int);']])
  try {
    const out = runGate(wt)
    assert.match(out, /盘面上没有回填型补号列/)
  } finally {
    rmSync(wt, { recursive: true, force: true })
  }
})

test('7 自证:真实仓盘面(只读 audit)—— 回填列有触发器兜底,无缺兜底', () => {
  const files = src.listMigrationSqlFiles().map((p) => ({
    name: p.replace(/\\/g, '/').split('/').pop(),
    text: readFileSync(p, 'utf8'),
  }))
  const { backfills, uncovered } = src.audit(files)
  assert.ok(
    backfills.some((b) => b.table === 'chat_messages' && b.col === 'turn_ordinal'),
    '盘面应识别出 turn_ordinal 回填',
  )
  assert.equal(uncovered.length, 0, `不应有无兜底的回填列:${JSON.stringify(uncovered)}`)
})
