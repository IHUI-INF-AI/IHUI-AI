// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

// `deferred@` 到期判据的镜像测试(§22c:import 源脚本 __test__,不在测试里复算判据)。
// 五格必钉:未到期 0 / 到期 1 并点名 / --grace 放行 / --as-of 翻结论 / 台账或侧车不可判 2。

import assert from 'node:assert/strict'
import { spawnSync } from 'node:child_process'
import { writeFileSync } from 'node:fs'
import { dirname, join, resolve } from 'node:path'
import test from 'node:test'
import { fileURLToPath } from 'node:url'

import { mkScratch, rmScratch } from '../lib/scratch-dir.mjs'

const HERE = dirname(fileURLToPath(import.meta.url))
const SCRIPT = resolve(HERE, '..', 'check-plan-deferred-expiry.mjs')

const PLAN_A = [
  '- [ ] **B72 学生本人看不到自己考勤且手机端只能看不能操作**（deferred@2027-03-31(到期复评)）',
  '- [ ] **D05 多用户协作会话**（deferred@2027-06-30(到期复评)）',
].join('\n') + '\n'

const FIELDS_A =
  [
    {
      key: 'B72#学生本人看不到自己考勤且手机端只能看不能操作',
      owner: 'ATT-WEB 席',
      waiting: 'none',
      updatedAt: '2026-11-03T00:00:00.000Z',
    },
    { key: 'D05#多用户协作会话', owner: '协作域 席', waiting: 'human', updatedAt: '2026-11-03T00:00:00.000Z' },
  ]
    .map((r) => JSON.stringify(r))
    .join('\n') + '\n'

function runCli(args) {
  return spawnSync(process.execPath, [SCRIPT, ...args], { encoding: 'utf8', windowsHide: true })
}

function writeFixture(t, { plan = PLAN_A, fields = FIELDS_A } = {}) {
  const dir = mkScratch('deferred-expiry-')
  t.after(() => rmScratch(dir, { skipNestedScan: true }))
  const planPath = join(dir, 'PROJECT_PLAN.md')
  const fieldsPath = join(dir, 'plan-fields.jsonl')
  if (plan !== null) writeFileSync(planPath, plan)
  if (fields !== null) writeFileSync(fieldsPath, fields)
  return { dir, planPath, fieldsPath, args: [`--file=${planPath}`, `--fields-file=${fieldsPath}`] }
}

test('T1 全部未到期 → exit 0,汇总 rows=2 expired=0', (t) => {
  const f = writeFixture(t)
  const r = runCli([...f.args, '--as-of', '2026-11-03'])
  assert.equal(r.status, 0, r.stdout + r.stderr)
  assert.match(r.stdout, /rows=2 expired=0/)
  assert.match(r.stdout, /最近一次到期 2027-03-31/)
})

test('T2 到期 → exit 1,逐条点名 行号|编号|日期|owner', (t) => {
  const f = writeFixture(t)
  const r = runCli([...f.args, '--as-of', '2027-04-01'])
  assert.equal(r.status, 1, r.stdout + r.stderr)
  assert.match(r.stdout, /rows=2 expired=1/)
  assert.match(r.stdout, /L1 \| B72 \| 2027-03-31 \| ATT-WEB 席 \| 超期 1 天/)
})

test('T3 --grace 内放行,超出宽限即红', (t) => {
  const f = writeFixture(t)
  // as-of 2027-04-02:B72 自然超期 2 天。
  const within = runCli([...f.args, '--as-of', '2027-04-02', '--grace', '2'])
  assert.equal(within.status, 0, within.stdout + within.stderr)
  assert.match(within.stdout, /rows=2 expired=0/)
  const beyond = runCli([...f.args, '--as-of', '2027-04-02', '--grace', '1'])
  assert.equal(beyond.status, 1, beyond.stdout + beyond.stderr)
  assert.match(beyond.stdout, /rows=2 expired=1/)
})

test('T4 --as-of 改变结论:到期日当天放行,次日红', (t) => {
  const f = writeFixture(t)
  const onDate = runCli([...f.args, '--as-of=2027-03-31'])
  assert.equal(onDate.status, 0, onDate.stdout + onDate.stderr)
  const nextDay = runCli([...f.args, '--as-of=2027-04-01'])
  assert.equal(nextDay.status, 1, nextDay.stdout + nextDay.stderr)
})

test('T5 台账缺失 / marker 日期非法 → exit 2', (t) => {
  const f = writeFixture(t)
  const missing = runCli([`--file=${join(f.dir, 'absent.md')}`, `--fields-file=${f.fieldsPath}`, '--as-of=2027-04-01'])
  assert.equal(missing.status, 2, missing.stdout + missing.stderr)
  assert.match(missing.stdout, /无法判定/)
  const badPlan = `- [ ] **B72 学生本人看不到自己考勤且手机端只能看不能操作**（deferred@2027-02-30(到期复评)）\n`
  const badPath = join(f.dir, 'bad-date.md')
  writeFileSync(badPath, badPlan)
  const bad = runCli([`--file=${badPath}`, `--fields-file=${f.fieldsPath}`, '--as-of=2027-04-01'])
  assert.equal(bad.status, 2, bad.stdout + bad.stderr)
  assert.match(bad.stdout, /L1 \| 2027-02-30/)
})

test('T6 侧车缺失 / 坏记录 → exit 2', (t) => {
  const f = writeFixture(t, { fields: null })
  const absent = runCli([...f.args, '--as-of=2027-04-01'])
  assert.equal(absent.status, 2, absent.stdout + absent.stderr)
  const badFieldsPath = join(f.dir, 'bad-fields.jsonl')
  writeFileSync(badFieldsPath, '{"key":"B72#学生本人看不到自己考勤且手机端只能看不能操作","owner":"ATT-WEB 席"}\n')
  const bad = runCli([`--file=${f.planPath}`, `--fields-file=${badFieldsPath}`, '--as-of=2027-04-01'])
  assert.equal(bad.status, 2, bad.stdout + bad.stderr)
  assert.match(bad.stdout, /侧车有 1 条坏记录/)
})

test('T7 --json 可被门链消费且含 summary', (t) => {
  const f = writeFixture(t)
  const r = runCli([...f.args, '--as-of=2027-04-01', '--json'])
  assert.equal(r.status, 1, r.stdout + r.stderr)
  const payload = JSON.parse(r.stdout)
  assert.equal(payload.summary, 'rows=2 expired=1')
  assert.equal(payload.exit, 1)
  assert.equal(payload.expiredRows[0].id, 'B72')
})
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
