// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * T1 超时预算(实测基线 + 固定余量)的镜像测试。
 *
 * 锁的是什么(2026-11-07 机主令,二次收紧):
 *  - 阈值必须来自机器可读文件,不许散落魔法数;
 *  - `validateGateTimeoutBudget` 对三种畸形(**硬失败**,不再「不采信 ⇒ 回落 300s」):
 *    ① evidence[] 为空;② 末条 marginMs ≠ 当前 marginMs;③ derivedMs ≠ base + marginMs。
 *    外加坏 JSON / gates 缺失也判红,且 errors 必须点名缺什么。
 *  - `checkMarginRatchetHistory` 在文件提交史里找「最近一个 marginMs 不同的旧版本」作基线
 *    (不是固定 HEAD^),并校验 evidence 条数单调不减 —— 删证据再加回同样判红。
 *    已知边界:调用方只取最近 HISTORY_LIMIT 个提交,由 check-typecheck 侧限制。
 *  - `loadGateTimeoutBudget` 只服务外层看门狗取阈值,不作为门的判定依据。
 *  - 显式环境旋钮(含 0 = 关闭)优先于预算表。
 */
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { mkdtempSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import {
  BUDGET_FILE,
  checkMarginRatchetHistory,
  loadGateTimeoutBudget,
  pickGateTimeout,
  readBudgetRaw,
  validateGateTimeoutBudget,
} from '../lib/gate-timeout-budget.mjs'

function writeTemp(json) {
  const dir = mkdtempSync(join(tmpdir(), 'ihui-gate-budget-'))
  const file = join(dir, 'budget.json')
  writeFileSync(file, typeof json === 'string' ? json : JSON.stringify(json), 'utf8')
  return file
}

const TEMP_BUDGET = (entry) => writeTemp({ gates: { T1: entry } })

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

test('真实预算文件必须通过严格校验(门据此 exit 0 才继续跑数)', () => {
  assert.deepEqual(validateGateTimeoutBudget(BUDGET_FILE), { ok: true, errors: [] })
})

test('畸形①:evidence[] 为空 ⇒ 硬失败并点名', () => {
  const file = TEMP_BUDGET({ baseMs: 150000, marginMs: 150000, derivedMs: 300000, evidence: [] })
  const r = validateGateTimeoutBudget(file)
  assert.equal(r.ok, false)
  assert.equal(r.errors.length, 1)
  assert.match(r.errors[0], /evidence\[\] 为空/)
})

test('畸形②:末条 evidence 的 marginMs 不覆盖当前值 ⇒ 硬失败并点名', () => {
  const file = TEMP_BUDGET({
    baseMs: 150000,
    marginMs: 300000,
    derivedMs: 450000,
    evidence: [{ marginMs: 150000, date: '2026-11-07' }],
  })
  const r = validateGateTimeoutBudget(file)
  assert.equal(r.ok, false)
  assert.equal(r.errors.length, 1)
  assert.match(r.errors[0], /末条 marginMs\(150000\) ≠ 当前 marginMs\(300000\)/)
})

test('畸形③:derivedMs ≠ baseMs + marginMs ⇒ 硬失败并点名', () => {
  const file = TEMP_BUDGET({
    baseMs: 150000,
    marginMs: 150000,
    derivedMs: 600000,
    evidence: [{ marginMs: 150000 }],
  })
  const r = validateGateTimeoutBudget(file)
  assert.equal(r.ok, false)
  assert.equal(r.errors.length, 1)
  assert.match(r.errors[0], /derivedMs\(600000\) ≠ baseMs\(150000\) \+ marginMs\(150000\)/)
})

test('坏 JSON ⇒ 硬失败(不回落默认值)', () => {
  const r = validateGateTimeoutBudget(writeTemp('{oops'))
  assert.equal(r.ok, false)
  assert.match(r.errors[0], /坏 JSON/)
})

test('gates 缺失或为空 ⇒ 硬失败(没有任何门在册)', () => {
  const r = validateGateTimeoutBudget(writeTemp({ version: 1 }))
  assert.equal(r.ok, false)
  assert.match(r.errors[0], /gates 缺失或为空/)
})

test('棘轮A:margin 变了但 evidence 没增 ⇒ 拒收(算术自洽也照拒)', () => {
  const cur = { marginMs: 300000, evidence: [{ marginMs: 150000 }, { marginMs: 300000 }] }
  const history = [{ marginMs: 150000, evidence: [{ marginMs: 150000 }], __sha: 'aaaaaaa' }]
  const errs = checkMarginRatchetHistory('T1', { ...cur, evidence: cur.evidence.slice(0, 1) }, history)
  assert.equal(errs.length, 1)
  assert.match(errs[0], /marginMs 150000 → 300000/)
  assert.match(errs[0], /证据未增长\(1 → 1\)/)
  assert.match(errs[0], /aaaaaaa/)
})

test('棘轮A:margin 变了且 evidence 追加 ⇒ 通过', () => {
  const cur = {
    marginMs: 300000,
    evidence: [{ marginMs: 150000 }, { marginMs: 300000, reason: '新增移动端全量 tsc' }],
  }
  const history = [{ marginMs: 150000, evidence: [{ marginMs: 150000 }] }]
  assert.deepEqual(checkMarginRatchetHistory('T1', cur, history), [])
})

test('棘轮A:基线取「最近一个 margin 不同的旧版」而非固定 HEAD^', () => {
  // 新→旧:300000/3 条(上一版) → 300000/2 条 → 150000/1 条
  const history = [
    { marginMs: 300000, evidence: [{}, {}, {}], __sha: 'ccccccc' },
    { marginMs: 300000, evidence: [{}, {}], __sha: 'bbbbbbb' },
    { marginMs: 150000, evidence: [{}], __sha: 'aaaaaaa' },
  ]
  const cur = { marginMs: 300000, evidence: [{}, {}, {}] }
  assert.deepEqual(checkMarginRatchetHistory('T1', cur, history), [])
  // 当前证据回到 1 条 ⇒ 与最近的不同 margin 旧版(1 条)比不增长 ⇒ 红
  const errs = checkMarginRatchetHistory('T1', { marginMs: 300000, evidence: [{}] }, history)
  assert.equal(errs.length, 1)
  assert.match(errs[0], /证据未增长\(1 → 1\)/)
})

test('棘轮A:margin 未变 ⇒ 不要求 evidence 增长', () => {
  const prev = { marginMs: 150000, evidence: [{ marginMs: 150000 }] }
  assert.deepEqual(checkMarginRatchetHistory('T1', { ...prev }, [prev]), [])
  assert.deepEqual(checkMarginRatchetHistory('T1', prev, []), [])
})

test('棘轮B:中间删 evidence 再加回 ⇒ 判红(一步比对看不见的形态)', () => {
  // 新→旧:现在 1 条 → 曾被删到 0 条 → 更早 1 条
  const history = [
    { marginMs: 150000, evidence: [{}], __sha: 'ccccccc' },
    { marginMs: 150000, evidence: [], __sha: 'bbbbbbb' },
    { marginMs: 150000, evidence: [{}], __sha: 'aaaaaaa' },
  ]
  const errs = checkMarginRatchetHistory('T1', { marginMs: 150000, evidence: [{}] }, history)
  assert.equal(errs.length, 1)
  assert.match(errs[0], /evidence 被删除过/)
  assert.match(errs[0], /bbbbbbb/)
})

test('棘轮B:evidence 条数单调不减 ⇒ 通过', () => {
  const history = [
    { marginMs: 150000, evidence: [{}, {}], __sha: 'bbbbbbb' },
    { marginMs: 150000, evidence: [{}], __sha: 'aaaaaaa' },
  ]
  assert.deepEqual(checkMarginRatchetHistory('T1', { marginMs: 150000, evidence: [{}, {}] }, history), [])
})

test('棘轮:历史里 marginMs 非有限的版本被跳过(不误报)', () => {
  const history = [{ marginMs: undefined, evidence: [] }, { marginMs: 150000, evidence: [{}] }]
  assert.deepEqual(checkMarginRatchetHistory('T1', { marginMs: 150000, evidence: [{}] }, history), [])
})

test('loader 只做看门狗取阈值:畸形条目仍不采信(判定权在 validate)', () => {
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
  // 同一份文件在门内必须被判红,而不是静默回落
  assert.equal(validateGateTimeoutBudget(staleLast).ok, false)
})

test('真实预算文件里 marginMs 的 provenance 链可读', () => {
  const raw = readBudgetRaw(BUDGET_FILE)
  assert.ok(raw?.gates?.T1?.evidence?.length > 0)
})

test('derivedMs 非正/非有限的条目被 loader 忽略', () => {
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
