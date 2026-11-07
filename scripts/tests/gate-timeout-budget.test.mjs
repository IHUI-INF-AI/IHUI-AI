// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * T1 超时预算(实测基线 + 固定余量)的镜像测试。
 *
 * 锁的是什么(2026-11-07 机主令):
 *  - 阈值必须来自机器可读文件,不许散落魔法数;
 *  - derivedMs 必须严格等于 baseMs + marginMs —— 只涨数字(不改基线/余量)的条目必须被拒;
 *  - 只有 T1 在册(不许顺手调宽别人的门);
 *  - 文件缺失 / 坏 JSON 时回落全局默认(不判红、也不静默放开);
 *  - 显式环境旋钮(含 0 = 关闭)优先于预算表。
 */
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { mkdtempSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import {
  BUDGET_FILE,
  checkMarginRatchet,
  loadGateTimeoutBudget,
  pickGateTimeout,
  readBudgetRaw,
} from '../lib/gate-timeout-budget.mjs'

function writeTemp(json) {
  const dir = mkdtempSync(join(tmpdir(), 'ihui-gate-budget-'))
  const file = join(dir, 'budget.json')
  writeFileSync(file, typeof json === 'string' ? json : JSON.stringify(json), 'utf8')
  return file
}

test('真实预算文件:只有 T1 在册,且 derived = base + margin', () => {
  const budget = loadGateTimeoutBudget(BUDGET_FILE)
  const ids = Object.keys(budget)
  assert.deepEqual(ids, ['T1'], `在册门应只有 T1,实得 ${ids.join(',')}`)
  for (const [id, e] of Object.entries(budget)) {
    assert.equal(e.derivedMs, e.baseMs + e.marginMs, `${id} 的 derivedMs 不等于 base+margin`)
    assert.ok(e.baseMs > 0 && e.marginMs > 0, `${id} 的基线/余量必须为正`)
    const last = e.evidence[e.evidence.length - 1]
    assert.equal(last.marginMs, e.marginMs, `${id} 最后一条 evidence 未覆盖当前 marginMs`)
  }
})

test('margin 变了但 evidence 没增 ⇒ 拒收(算术自洽也照拒)', () => {
  const prev = { marginMs: 150000, evidence: [{ marginMs: 150000 }] }
  const cur = { marginMs: 300000, evidence: [{ marginMs: 150000 }] }
  const errs = checkMarginRatchet('T1', prev, cur)
  assert.equal(errs.length, 2)
  assert.match(errs[0], /150000 → 300000/)
  assert.match(errs[0], /evidence 未新增/)
})

test('margin 变了且 evidence 追加 ⇒ 通过', () => {
  const prev = { marginMs: 150000, evidence: [{ marginMs: 150000 }] }
  const cur = {
    marginMs: 300000,
    evidence: [{ marginMs: 150000 }, { marginMs: 300000, reason: '新增移动端全量 tsc' }],
  }
  assert.deepEqual(checkMarginRatchet('T1', prev, cur), [])
})

test('margin 未变 ⇒ 不要求 evidence 增长', () => {
  const prev = { marginMs: 150000, evidence: [{ marginMs: 150000 }] }
  assert.deepEqual(checkMarginRatchet('T1', prev, { ...prev }), [])
  assert.deepEqual(checkMarginRatchet('T1', null, prev), [])
})

test('evidence 缺失 / 末条与 marginMs 不符 ⇒ loader 不收', () => {
  const noEvidence = writeTemp({ gates: { T1: { baseMs: 150000, marginMs: 150000, derivedMs: 300000 } } })
  assert.deepEqual(loadGateTimeoutBudget(noEvidence), {})
  const staleLast = writeTemp({
    gates: {
      T1: {
        baseMs: 150000,
        marginMs: 300000,
        derivedMs: 450000,
        evidence: [{ marginMs: 150000, date: '2026-11-07' }],
      },
    },
  })
  assert.deepEqual(loadGateTimeoutBudget(staleLast), {})
})

test('真实预算文件里 marginMs 的 provenance 链可读', () => {
  const raw = readBudgetRaw(BUDGET_FILE)
  assert.ok(raw?.gates?.T1?.evidence?.length > 0)
})

test('棘轮:只涨 derived 而基线/余量不匹配的条目被拒', () => {
  const file = writeTemp({
    gates: {
      T1: { baseMs: 150000, marginMs: 150000, derivedMs: 600000 },
    },
  })
  assert.deepEqual(loadGateTimeoutBudget(file), {})
})

test('坏 JSON / 缺文件 ⇒ 空表(回落全局默认)', () => {
  assert.deepEqual(loadGateTimeoutBudget(writeTemp('{oops')), {})
  assert.deepEqual(loadGateTimeoutBudget(join(tmpdir(), 'definitely-not-here.json')), {})
})

test('derivedMs 非正/非有限的条目被忽略', () => {
  const file = writeTemp({
    gates: {
      T1: { baseMs: 1000, marginMs: 0, derivedMs: 1000, evidence: [{ marginMs: 0 }] },
      X: { baseMs: 0, marginMs: 0, derivedMs: 0, evidence: [{ marginMs: 0 }] },
    },
  })
  assert.deepEqual(Object.keys(loadGateTimeoutBudget(file)), ['T1'])
})

test('pickGateTimeout:显式旋钮 > 在册预算 > 全局默认', () => {
  const budget = loadGateTimeoutBudget(BUDGET_FILE)
  const ctx = { defaultMs: 300000, explicit: false, budget }
  assert.equal(pickGateTimeout({ id: 'T1' }, ctx), 300000)
  assert.equal(pickGateTimeout({ id: '298' }, ctx), 300000)
  assert.equal(pickGateTimeout({ id: 'T1' }, { ...ctx, explicit: true, defaultMs: 0 }), 0)
})
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
