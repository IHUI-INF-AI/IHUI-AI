#!/usr/bin/env node
// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * decide-style-tier-forks.mjs 的判据镜像测试(P0-3)。
 * 2026-11-05 起同批覆盖缺位桶(missingTier)准入裁决,现读 10 例(4 条 fork + 6 条缺位)。
 * §22c:直接 import 源 `__test__`;不重算「额度核销 / 到期」口径。
 */
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { join, dirname } from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'

import { mkScratch, rmScratch } from '../lib/scratch-dir.mjs'

const here = dirname(fileURLToPath(import.meta.url))
const ROOT = join(here, '..', '..')
const SCRIPT = join(ROOT, 'scripts', 'decide-style-tier-forks.mjs')
const { __test__ } = await import(pathToFileURL(SCRIPT).href)
const { judgeForkDecisions, mergeDecisions, serializeDecisions, writeDecisions, decisionKey } =
  __test__

const tier = { spacing: [4, 8, 12], type: [12, 14, 16, 22, 24], radius: [4, 8, 12] }

test('全部在额度内:每一行 fork 都被允许差异额度按处数核销 ⇒ 无判红', () => {
  const rows = [
    { kind: 'spacing', prop: 'gap', val: 10, n: 2, status: 'allowed', allowed: 2 },
    { kind: 'fontSize', prop: 'fontSize', val: 22, n: 1, status: 'allowed', allowed: 1 },
  ]
  const v = judgeForkDecisions({ rows, decisions: [], tier, today: '2026-11-03' })
  assert.equal(v.ok, true)
  assert.equal(v.pending, 0)
  assert.equal(v.allowed, 3)
  assert.deepEqual(v.failures, [])
})

test('一条无 decision 判红:额度不足的差额没有 decision ⇒ pending 与 failure 同时点名', () => {
  const rows = [{ kind: 'spacing', prop: 'padding', val: 13, n: 3, status: 'pending', allowed: 0 }]
  const v = judgeForkDecisions({ rows, decisions: [], tier, today: '2026-11-03' })
  assert.equal(v.ok, false)
  assert.equal(v.pending, 3)
  const hit = v.failures.find((f) => !f.rule)
  assert.ok(hit)
  assert.equal(hit.prop, 'padding')
  assert.equal(hit.value, 13)
  assert.equal(hit.reason, 'no-decision')
})

test('一条到期判红:decision 的 expires 早于今天 ⇒ 该行回 pending,整本账也判红', () => {
  const rows = [
    { kind: 'fontSize', prop: 'fontSize', val: 22, n: 2, status: 'pending', allowed: 0 },
  ]
  const decisions = [
    {
      side: 'rn',
      kind: 'fontSize',
      prop: 'fontSize',
      value: 22,
      targetTier: 24,
      owner: 'alice',
      expires: '2026-10-01',
      evidence: '等字号档表扩容后落回,复核人 alice',
    },
  ]
  const v = judgeForkDecisions({ rows, decisions, tier, today: '2026-11-03' })
  assert.equal(v.ok, false)
  assert.equal(v.pending, 2)
  assert.equal(v.decisionsExpired, 1)
  assert.ok(v.failures.some((f) => !f.rule && f.reason === 'expired'))
  assert.ok(v.failures.some((f) => f.rule === 'decision-expired-ledger'))
  // 到期日当天仍算在期
  const onDeadline = judgeForkDecisions({ rows, decisions, tier, today: '2026-10-01' })
  assert.equal(onDeadline.pending, 0)
  assert.equal(onDeadline.ok, true)
})

test('--apply 幂等:同一批 decision 合并/写盘两次,字节一致且不重复', () => {
  const existing = [
    {
      side: 'rn',
      kind: 'spacing',
      prop: 'gap',
      value: 10,
      targetTier: 8,
      owner: 'bob',
      expires: '2026-12-01',
      evidence: '首次登记',
    },
  ]
  const incoming = [
    {
      side: 'rn',
      kind: 'spacing',
      prop: 'gap',
      value: 10,
      targetTier: 12,
      owner: 'alice',
      expires: '2027-01-01',
      evidence: '复核后更新目标档',
    },
  ]
  const once = mergeDecisions(existing, incoming)
  const twice = mergeDecisions(once, incoming)
  assert.equal(once.length, 1, '同 key 只更新不重复')
  assert.equal(once[0].owner, 'alice')
  assert.equal(once[0].targetTier, 12)
  assert.equal(serializeDecisions(once), serializeDecisions(twice), '二次合并字节一致')

  const dir = mkScratch('p0-3-decisions-')
  try {
    const path = join(dir, 'style-tier-fork-decisions.jsonl')
    writeDecisions(path, once)
    const first = readFileSync(path, 'utf8')
    writeDecisions(path, twice)
    const second = readFileSync(path, 'utf8')
    assert.equal(first, second, '两次落盘字节一致(幂等)')
    assert.equal(first, serializeDecisions(once))
    assert.equal(decisionKey(once[0]), 'rn:spacing:gap:10')
  } finally {
    rmScratch(dir)
  }
})

/* ── 缺位桶(missingTier)镜像用例(2026-11-05 加腿同批) ───────────────────── */

const {
  aggregateMissingByValue,
  judgeMissingTier,
  missingDecisionKey,
  MISSING_TIER_ADMISSION_LINE,
  validDecision,
} = __test__

const L = MISSING_TIER_ADMISSION_LINE
const mkRow = (kind, prop, val, n, state) => ({
  kind,
  prop,
  val,
  n,
  inTier: state === 'inTier',
  onOther: state !== 'fork',
  state,
})
const missDecision = (kind, value, over = {}) => ({
  bucket: 'missingTier',
  side: 'both',
  kind,
  prop: '*',
  value,
  targetTier: 8,
  owner: 'cross-end',
  expires: '2027-03-31',
  evidence: '现读两端处数未过线,定档后逐处目检,不借本条绕过准入线',
  ...over,
})

test('缺位聚合按全量计数,不按 state 过滤:一侧已 inTier 也要计入该侧处数', () => {
  // 反证设计:若取数写成了 `rows.filter(r => r.state === 'missingTier')` 再求和,
  // web 侧那 200 处会读成 0 ⇒ 达线值被误判成未达线 ⇒ 整条准入线永远量不到东西。
  const rnRows = [mkRow('spacing', 'gap', 13, L, 'missingTier')]
  const webRows = [mkRow('spacing', 'py', 13, 200, 'inTier')]
  const missing = aggregateMissingByValue(rnRows, webRows)
  assert.equal(missing.length, 1, '只有 RN 侧报了缺位,值仍应聚合出来')
  assert.equal(missing[0].value, 13)
  assert.equal(missing[0].rnN, L, 'RN 侧处数取全量')
  assert.equal(missing[0].webN, 200, '对端已 inTier 的行同样计入其处数(否则达线判定系统性读小)')
  const v = judgeMissingTier({ missing, decisions: [], tier, today: '2026-11-05' })
  assert.equal(v.extendable.length, 1, '两端各自 ≥ 线 ⇒ 出路是补表')
  assert.equal(v.pending, 0)
  assert.equal(v.ok, true, '达线值不得因为没有 decision 而判红 —— 它的出路是补表,不是登记')
})

test('缺位未达线且无 decision ⇒ 判红并点名;一侧为零也算未达线', () => {
  const missing = aggregateMissingByValue(
    [mkRow('spacing', 'paddingVertical', 5, 42, 'missingTier')],
    [mkRow('spacing', 'py', 5, 1, 'missingTier'), mkRow('spacing', 'gap', 99, 7, 'missingTier')],
  )
  assert.equal(missing.length, 2)
  const five = missing.find((m) => m.value === 5)
  assert.equal(five.rnN, 42)
  assert.equal(five.webN, 1)
  const v = judgeMissingTier({ missing, decisions: [], tier, today: '2026-11-05' })
  assert.equal(v.ok, false)
  assert.equal(v.pending, 42 + 1 + 7)
  const reasons = v.failures.filter((f) => !f.rule)
  assert.equal(reasons.length, 2)
  assert.ok(reasons.every((f) => f.reason === 'no-decision'))
  assert.deepEqual(reasons.find((f) => f.value === 5).props, ['paddingVertical', 'py'])
  assert.equal(
    reasons.find((f) => f.value === 99).rnN,
    0,
    'web 侧独有的缺位行:RN 侧 0 处 ⇒ 同样不过线,不得当成"达线"',
  )
})

test('缺位在期 decision ⇒ 结清;到期与未指派都回红', () => {
  const missing = aggregateMissingByValue(
    [mkRow('spacing', 'gap', 5, 42, 'missingTier')],
    [mkRow('spacing', 'py', 5, 1, 'missingTier')],
  )
  const ok = judgeMissingTier({
    missing,
    decisions: [missDecision('spacing', 5)],
    tier,
    today: '2026-11-05',
  })
  assert.equal(ok.ok, true)
  assert.equal(ok.pending, 0)
  assert.equal(ok.settled.length, 1)
  assert.equal(ok.ledgerValid, 1)

  const expired = judgeMissingTier({
    missing,
    decisions: [missDecision('spacing', 5, { expires: '2026-10-01' })],
    tier,
    today: '2026-11-05',
  })
  assert.equal(expired.ok, false)
  assert.equal(expired.pending, 43)
  assert.ok(expired.failures.some((f) => f.rule === 'missing-decision-expired-ledger'))

  const draft = judgeMissingTier({
    missing,
    decisions: [missDecision('spacing', 5, { owner: 'unassigned', expires: '' })],
    tier,
    today: '2026-11-05',
  })
  assert.equal(draft.ok, false, '草稿(owner=unassigned)不算有效决策 ⇒ 不得以草稿消红')
  assert.equal(draft.ledgerUnassigned, 1)

  // 到期日当天仍算在期(与 fork 桶同一条口径)
  const onDeadline = judgeMissingTier({
    missing,
    decisions: [missDecision('spacing', 5, { expires: '2026-11-05' })],
    tier,
    today: '2026-11-05',
  })
  assert.equal(onDeadline.ok, true)
})

test('缺位 targetTier 必须在档表内;同值两条算账本腐烂', () => {
  const missing = aggregateMissingByValue(
    [mkRow('spacing', 'gap', 5, 3, 'missingTier')],
    [mkRow('spacing', 'py', 5, 2, 'missingTier')],
  )
  const badTier = judgeMissingTier({
    missing,
    decisions: [missDecision('spacing', 5, { targetTier: 5 })],
    tier,
    today: '2026-11-05',
  })
  assert.equal(badTier.ok, false, 'targetTier=5 不在 fixture 的 spacing 档表 [4,8,12] ⇒ 无效')
  assert.ok(badTier.failures.some((f) => !f.rule && /不在 .* 档表/.test(String(f.reason))))
  const dup = judgeMissingTier({
    missing,
    decisions: [missDecision('spacing', 5), missDecision('spacing', 5, { owner: 'other' })],
    tier,
    today: '2026-11-05',
  })
  assert.ok(dup.failures.some((f) => f.rule === 'missing-decision-duplicate'))
})

test('两桶分家:缺位条目不得核销 fork 行,fork 条目也不得被缺位桶认领', () => {
  // 键形状不同(缺位 = `缺位:kind:值`,无 prop/side),且缺位裁决只吃 bucket==='missingTier' 的条目。
  const forkRows = [{ kind: 'spacing', prop: 'gap', val: 13, n: 4, status: 'pending', allowed: 0 }]
  const vFork = judgeForkDecisions({
    rows: forkRows,
    decisions: [missDecision('spacing', 13)],
    tier,
    today: '2026-11-05',
  })
  assert.equal(vFork.ok, false, '拿缺位条目去核销 fork 行 ⇒ 必须仍判红')
  assert.equal(vFork.failures.find((f) => !f.rule)?.reason, 'no-decision')

  const missing = aggregateMissingByValue(
    [mkRow('spacing', 'gap', 13, 4, 'missingTier')],
    [mkRow('spacing', 'py', 13, 4, 'missingTier')],
  )
  const vMissing = judgeMissingTier({
    missing,
    decisions: [
      {
        side: 'rn',
        kind: 'spacing',
        prop: 'gap',
        value: 13,
        targetTier: 12,
        owner: 'alice',
        expires: '2027-03-31',
        evidence: '这是一条 fork 条目,不该被缺位桶认领',
      },
    ],
    tier,
    today: '2026-11-05',
  })
  assert.equal(vMissing.ok, false, 'fork 条目没有 bucket 标记 ⇒ 缺位桶不认')
  assert.equal(missingDecisionKey('spacing', 13), '缺位:spacing:13')
})

test('side 放宽只放行 web/both,坏 side 照旧拒;shape 四项检查未被削弱', () => {
  const base = missDecision('spacing', 5)
  assert.equal(validDecision(base, { today: '2026-11-05', tier }).ok, true)
  assert.equal(validDecision({ ...base, side: 'web' }, { today: '2026-11-05', tier }).ok, true)
  assert.equal(
    validDecision({ ...base, side: 'rn' }, { today: '2026-11-05', tier }).ok,
    true,
    'fork 桶的 side=rn 仍按原样有效(放宽是加法,不是替换)',
  )
  assert.equal(
    validDecision({ ...base, side: 'miniapp' }, { today: '2026-11-05', tier }).reason,
    'shape(side)',
  )
  assert.equal(
    validDecision({ ...base, owner: '' }, { today: '2026-11-05', tier }).reason,
    'owner-missing',
  )
  assert.equal(
    validDecision({ ...base, expires: '2027-3-1' }, { today: '2026-11-05', tier }).reason,
    'expires-missing',
  )
  assert.equal(
    validDecision({ ...base, evidence: '短' }, { today: '2026-11-05', tier }).reason,
    'evidence-missing',
    'evidence 少于 8 字符仍拒 —— 登记门槛不因新增桶而降低',
  )
})
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
