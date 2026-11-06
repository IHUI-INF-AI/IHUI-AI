/**
 * `check-e2e-skip-wait-policy.mjs` 的镜像测试(§22c:判据一律 import 源脚本/纯判据,本文件零复制)。
 * 覆盖 skip 的 10 类判据 + 固定等待的 4 类判据 + 孤儿/未判定 + 形状锁。
 */
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import path from 'node:path'
import { __test__ as p } from '../lib/e2e-skip-wait-policy.mjs'

const HERE = path.dirname(fileURLToPath(import.meta.url))
const ROOT = path.resolve(HERE, '..', '..')
const TODAY = '2026-11-06'
const META = { owner: 'S-E2E', reviewBy: '2027-05-31' }

const reg = (over = {}) => ({ schemaVersion: 1, envRefs: {}, defects: [], skips: [], timings: [], ...over })
const envReg = () =>
  reg({
    envRefs: { SEED_DATA: { reason: '测试数据未 seed 时合法跳过', ...META } },
    skips: [{ id: 'SKIP-0001', category: 'ENV', ref: 'ENV:SEED_DATA', reason: '测试数据未 seed 时合法跳过', ...META }],
  })
const bugReg = (status = 'open') =>
  reg({
    defects: [{ id: 'E2E-SKIP-0001', title: '某能力未实现时允许挂账跳过', status, ...META }],
    skips: [{ id: 'SKIP-0002', category: 'BUG', ref: 'BUG:E2E-SKIP-0001', reason: '该能力尚未实现,允许挂账', ...META }],
  })
const timingReg = (reviewBy = META.reviewBy) =>
  reg({ timings: [{ id: 'TIMING-0001', reason: '点击后 UI 过渡落定窗口', owner: META.owner, reviewBy }] })

const judge = (text, register = reg(), today = TODAY) =>
  p.evaluatePolicy({ files: [{ path: 'apps/web/e2e/demo.spec.ts', text }], register, today })
const hasRule = (r, rule) => r.exitCode === 1 && r.violations.some((v) => v.rule === rule)

test('① 裸 skip(无参数)= 红;仅条件无理由 = 红;有理由无编号 = 红', () => {
  assert.ok(hasRule(judge('test.skip()\n'), 'skip-bare'))
  assert.ok(hasRule(judge('test.skip(true)\n'), 'skip-no-reason'))
  assert.ok(hasRule(judge("setupTest.skip(true, '因为当前环境缺少测试数据')\n"), 'skip-no-ref'))
})

test('② fixme 同受 skip 判据约束;authTest.skip 也覆盖', () => {
  assert.ok(hasRule(judge('test.fixme(true)\n'), 'skip-no-reason'))
  assert.ok(hasRule(judge("authTest.skip(true, '理由足够长但没有编号')\n"), 'skip-no-ref'))
})

test('③ 已登记 ENV skip 绿;编号未知红;多编号红', () => {
  assert.equal(judge("test.skip(true, '测试数据未 seed 时合法跳过 [SKIP:SKIP-0001]')\n", envReg()).exitCode, 0)
  assert.ok(hasRule(judge("test.skip(true, '理由足够长 [SKIP:SKIP-9999]')\n"), 'skip-unknown-ref'))
  assert.ok(hasRule(judge("test.skip(true, '两个编号同时出现 [SKIP:SKIP-0001] [SKIP:SKIP-0002]')\n", envReg()), 'skip-multi-ref'))
})

test('④ category 只认 ENV/BUG:ref 前缀不一致 / category=TIMING 都红', () => {
  const badRef = reg({
    skips: [{ id: 'SKIP-0001', category: 'ENV', ref: 'BUG:E2E-SKIP-0001', reason: '前缀与类别不一致', ...META }],
    defects: [{ id: 'E2E-SKIP-0001', title: '前缀与类别不一致', status: 'open', ...META }],
  })
  assert.ok(hasRule(judge("test.skip(true, '理由足够长 [SKIP:SKIP-0001]')\n", badRef), 'skip-category'))
  const timingCat = reg({
    skips: [{ id: 'SKIP-0001', category: 'TIMING', ref: 'TIMING:TIMING-0001', reason: 'TIMING 不能用于 skip', ...META }],
    timings: [{ id: 'TIMING-0001', reason: 'TIMING 不能用于 skip', ...META }],
  })
  assert.ok(hasRule(judge("test.skip(true, '理由足够长 [SKIP:SKIP-0001]')\n", timingCat), 'skip-category'))
})

test('⑤ BUG 引用缺陷不存在 / 缺陷已关闭 都红', () => {
  assert.ok(hasRule(judge("test.skip(true, '挂账理由足够长 [SKIP:SKIP-0002]')\n", reg({ skips: bugReg().skips })), 'skip-defect-missing'))
  assert.ok(hasRule(judge("test.skip(true, '挂账理由足够长 [SKIP:SKIP-0002]')\n", bugReg('fixed')), 'skip-defect-closed'))
})

test('⑥ reviewBy 过期 ⇒ skip-expired / wait-expired', () => {
  const expired = reg({
    envRefs: { SEED_DATA: { reason: '测试数据未 seed 时合法跳过', ...META } },
    skips: [{ id: 'SKIP-0001', category: 'ENV', ref: 'ENV:SEED_DATA', reason: '到期未复审的条目', owner: 'S-E2E', reviewBy: '2026-01-01' }],
  })
  assert.ok(hasRule(judge("test.skip(true, '到期未复审 [SKIP:SKIP-0001]')\n", expired), 'skip-expired'))
  assert.ok(hasRule(judge('// WAIT-POLICY:TIMING-0001 点击后 UI 过渡落定窗口\nawait page.waitForTimeout(200)\n', timingReg('2026-01-01')), 'wait-expired'))
})

test('⑦ 固定等待:无注解 / 理由不足 / 编号未知 红;合法注解绿', () => {
  assert.ok(hasRule(judge('await page.waitForTimeout(200)\n', timingReg()), 'wait-no-annotation'))
  assert.ok(hasRule(judge('// WAIT-POLICY:TIMING-0001 短\nawait page.waitForTimeout(200)\n', timingReg()), 'wait-no-reason'))
  assert.ok(hasRule(judge('// WAIT-POLICY:TIMING-9999 点击后过渡落定窗口\nawait page.waitForTimeout(200)\n', timingReg()), 'wait-unknown-ref'))
  assert.equal(judge('// WAIT-POLICY:TIMING-0001 点击后 UI 过渡落定窗口\nawait page.waitForTimeout(200)\n', timingReg()).exitCode, 0)
})

test('⑧ 同行前置注解也被接受(不强制单独一行)', () => {
  const oneLine = reg({ timings: [{ id: 'TIMING-0001', reason: '点击后 UI 过渡落定窗口', ...META }] })
  assert.equal(judge('/* WAIT-POLICY:TIMING-0001 点击后 UI 过渡落定窗口 */ await page.waitForTimeout(200)\n', oneLine).exitCode, 0)
})

test('⑨ 注释/字符串里的 skip 与 waitForTimeout 不算调用', () => {
  const text = "// test.skip()\n/* await page.waitForTimeout(200) */\nconst s = 'test.skip(true)'\n"
  const r = judge(text)
  assert.equal(r.counts.skipCalls, 0)
  assert.equal(r.counts.waitCalls, 0)
  assert.equal(r.exitCode, 0)
})

test('⑩ 台账有、代码没引用 ⇒ 孤儿(四类)红', () => {
  const orphan = reg({
    envRefs: { SEED_DATA: { reason: '测试数据未 seed 时合法跳过', ...META } },
    defects: [{ id: 'E2E-SKIP-0001', title: '无 skip 引用的缺陷', status: 'open', ...META }],
    skips: [{ id: 'SKIP-0001', category: 'ENV', ref: 'ENV:SEED_DATA', reason: '台账有但代码无引用', ...META }],
    timings: [{ id: 'TIMING-0001', reason: '台账有但等待无引用', ...META }],
  })
  const r = p.evaluatePolicy({ files: [], register: orphan, today: TODAY })
  assert.ok(hasRule(r, 'orphan-skip'))
  assert.ok(hasRule(r, 'orphan-timing'))
  assert.ok(hasRule(r, 'orphan-defect'))
  assert.ok(hasRule(r, 'orphan-env-ref'))
})

test('⑪ 台账结构坏 ⇒ exit 2(未判定,不记绿也不折红)', () => {
  assert.equal(p.evaluatePolicy({ files: [], register: { schemaVersion: 99 }, today: TODAY }).exitCode, 2)
  assert.equal(p.validateRegisterShape({ schemaVersion: 1, envRefs: [], defects: [], skips: [], timings: [] }).ok, false)
})

test('⑫ 形状锁:CLI 必须支持 --staged / --self-test;制度文件在;register 约定名一致', () => {
  const gate = readFileSync(path.join(ROOT, 'scripts/check-e2e-skip-wait-policy.mjs'), 'utf8')
  assert.match(gate, /--self-test/)
  assert.match(gate, /--staged/)
  assert.match(gate, /apps\/web\/e2e\/skip-register\.json/)
  assert.match(readFileSync(path.join(ROOT, 'apps/web/e2e/SKIP-WAIT-POLICY.md'), 'utf8'), /\[SKIP:/)
  assert.equal(p.MIN_REASON, 8)
})
