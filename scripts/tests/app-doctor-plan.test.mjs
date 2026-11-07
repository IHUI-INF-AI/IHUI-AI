// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * app-doctor-plan.test.mjs —— 装机问题分级与复扫合并
 *
 * 判据只从源模块 import，测试不另写一张出路表。
 */
import test from 'node:test'
import assert from 'node:assert/strict'
import { INSTALL_ISSUE_KINDS, planIssueAction, actionFor, mergeRescan } from '../lib/app-doctor-plan.mjs'

test('五种 kind 都恰好有一条出路', () => {
  assert.deepEqual([...INSTALL_ISSUE_KINDS], ['unknown', 'dir-inaccessible', 'package-unpacked', 'disk-space', 'network'])
  assert.deepEqual(planIssueAction('unknown'), {
    ok: true,
    kind: 'unknown',
    muteReason: '种类未识别，不自动改盘',
  })
  assert.deepEqual(planIssueAction('dir-inaccessible'), { ok: true, kind: 'dir-inaccessible', repair: 'restore-acl' })
  assert.deepEqual(planIssueAction('package-unpacked'), { ok: true, kind: 'package-unpacked', repair: 'repack' })
  assert.deepEqual(planIssueAction('disk-space'), { ok: true, kind: 'disk-space', repair: 'free-cache' })
  assert.deepEqual(planIssueAction('network'), { ok: true, kind: 'network', repair: 'recheck-route' })
  for (const kind of INSTALL_ISSUE_KINDS) {
    const decided = planIssueAction(kind)
    assert.equal(decided.ok, true)
    const fields = ['repair', 'muteReason'].filter((key) => Object.hasOwn(decided, key))
    assert.deepEqual(fields.length, 1)
  }
})

test('未知 kind 失败', () => {
  assert.deepEqual(planIssueAction('not-a-kind'), { ok: false, reason: 'kind-unknown' })
  assert.deepEqual(actionFor('network', { 'disk-space': { repair: 'free-cache' } }), {
    ok: false,
    reason: 'kind-unknown',
  })
})

test('previous 为 null 时不会产生空的已修复列表', () => {
  const held = [{ id: 'disk-1', kind: 'disk-space' }]
  const missed = mergeRescan(null, held)
  assert.deepEqual(missed, { ok: false, reason: 'scan-unmeasured', issues: null })
  assert.equal(Array.isArray(missed.issues), false)
  const missedNext = mergeRescan(held, null)
  assert.deepEqual(missedNext, { ok: false, reason: 'scan-unmeasured', issues: null })
  const measuredEmpty = mergeRescan(held, [])
  assert.equal(measuredEmpty.ok, true)
  assert.deepEqual(measuredEmpty.issues, [{ id: 'disk-1', kind: 'disk-space', status: 'closed' }])
})

test('旧问题消失标 closed、新问题标 opened、仍在的标 still-open，并按 id 排序', () => {
  const previous = [
    { id: 'net-9', kind: 'network' },
    { id: 'acl-2', kind: 'dir-inaccessible' },
    { id: 'disk-1', kind: 'disk-space' },
  ]
  const next = [
    { id: 'pkg-3', kind: 'package-unpacked' },
    { id: 'disk-1', kind: 'disk-space' },
  ]
  assert.deepEqual(mergeRescan(previous, next), {
    ok: true,
    issues: [
      { id: 'acl-2', kind: 'dir-inaccessible', status: 'closed' },
      { id: 'disk-1', kind: 'disk-space', status: 'still-open' },
      { id: 'net-9', kind: 'network', status: 'closed' },
      { id: 'pkg-3', kind: 'package-unpacked', status: 'opened' },
    ],
  })
})

test('同一张表里某种既无 repair 又无 mute 时 actionFor 返回 action-absent', () => {
  const broken = {
    unknown: { muteReason: '种类未识别，不自动改盘' },
    'dir-inaccessible': { repair: 'restore-acl' },
    'package-unpacked': {},
    'disk-space': { repair: 'free-cache' },
    network: { repair: 'recheck-route' },
  }
  assert.deepEqual(actionFor('package-unpacked', broken), { ok: false, reason: 'action-absent' })
  assert.deepEqual(planIssueAction('package-unpacked'), { ok: true, kind: 'package-unpacked', repair: 'repack' })
})

test('id 或 kind 不合法时整批 row-invalid', () => {
  assert.deepEqual(
    mergeRescan(
      [
        { id: 'disk-1', kind: 'disk-space' },
        { id: '', kind: 'network' },
      ],
      [{ id: 'disk-1', kind: 'disk-space' }],
    ),
    { ok: false, reason: 'row-invalid' },
  )
  assert.deepEqual(mergeRescan([{ id: 'x', kind: 'not-a-kind' }], []), { ok: false, reason: 'row-invalid' })
})

test('repair 与 muteReason 同时都有时 actionFor 不选边', () => {
  assert.deepEqual(actionFor('network', { network: { repair: 'recheck-route', muteReason: '先别动' } }), {
    ok: false,
    reason: 'action-both',
  })
})
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
