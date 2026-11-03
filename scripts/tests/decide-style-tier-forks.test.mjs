#!/usr/bin/env node
// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * decide-style-tier-forks.mjs 的判据镜像测试(P0-3,4 条)。
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
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
