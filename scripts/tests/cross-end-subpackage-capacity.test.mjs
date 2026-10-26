#!/usr/bin/env node
// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * 镜像测试:小程序单分包容量判据(lib/cross-end-subpackage-capacity.mjs)
 *
 * 立因(2026-10-26 实测):跨端造页闭环每轮往 pkg-user 落 1-2 枚壳承载页,而产物预算门
 * 只判**主包** —— 78 页让主包涨 46 KB、pkg-user 从 1,525,850 涨到 3,769,041 B(超微信
 * 单个分包 2 MiB 硬上限 1.8 倍)。容量判据上线后,造页器到量即 blocked,不再静默超灌。
 *
 * 本文件不复制公式:全部断言都打源脚本 `__test__`(§0.6 单一真相源)。
 * 跑法:node --test scripts/tests/cross-end-subpackage-capacity.test.mjs
 */
import assert from 'node:assert/strict'
import test from 'node:test'

import { __test__ as cap } from '../lib/cross-end-subpackage-capacity.mjs'

const model = () => ({
  schema: 1,
  measuredAtSha: 'x',
  measuredAt: '2026-10-26',
  limitBytes: 2_097_152,
  safetyRatio: 0.95,
  bytesPerShellPage: 28_760,
  roots: {
    'pkg-user': { bytes: 1_525_850, mirrorEntriesAtMeasure: 26, chunkReserveBytes: 0 },
    'pkg-new': { bytes: 100_000, mirrorEntriesAtMeasure: 0, chunkReserveBytes: 707_000 },
  },
})

test('K1 容量表形态坏 ⇒ 整表判坏(不逐项回落默认值)', () => {
  assert.equal(cap.parseCapacity('not json').ok, false)
  assert.equal(cap.parseCapacity(JSON.stringify({})).ok, false)
  assert.equal(
    cap.parseCapacity(JSON.stringify({ schema: 2, limitBytes: 1, safetyRatio: 0.9, bytesPerShellPage: 1, roots: { a: {} } })).ok,
    false,
  )
  assert.equal(
    cap.parseCapacity(JSON.stringify({ schema: 1, limitBytes: 1, safetyRatio: 1.5, bytesPerShellPage: 1, roots: { a: {} } })).ok,
    false,
  )
  assert.equal(
    cap.parseCapacity(JSON.stringify({ schema: 1, limitBytes: 1, safetyRatio: 0.9, bytesPerShellPage: 0, roots: { a: {} } })).ok,
    false,
  )
  assert.equal(
    cap.parseCapacity(JSON.stringify({ schema: 1, limitBytes: 1, safetyRatio: 0.9, bytesPerShellPage: 1, roots: {} })).ok,
    false,
  )
  // 单个 root 字段缺 ⇒ 整表坏(否则那一格会被读成"容量很足")
  assert.equal(
    cap.parseCapacity(
      JSON.stringify({ schema: 1, limitBytes: 1, safetyRatio: 0.9, bytesPerShellPage: 1, roots: { a: { bytes: 1 } } }),
    ).ok,
    false,
  )
})

test('K2 容量公式:每包上限 = 测量在册数 + floor((limit×safety − 实测 − 共享闭包预留)/每页边际)', () => {
  const parsed = cap.parseCapacity(JSON.stringify(model()))
  assert.equal(parsed.ok, true)
  const u = cap.capacityOf(parsed.model, 'pkg-user')
  // (2,097,152×0.95 − 1,525,850 − 0) / 28,760 = 16.2 ⇒ 16
  assert.equal(u.extraPages, 16)
  assert.equal(u.maxMirrorEntries, 42)
  const n = cap.capacityOf(parsed.model, 'pkg-new')
  // (1,992,294.4 − 100,000 − 707,000) / 28,760 = 41.2 ⇒ 41
  assert.equal(n.extraPages, 41)
  assert.equal(cap.capacityOf(parsed.model, 'pkg-absent'), null)
})

test('K3 在册条数按最长前缀归类(嵌套 root 不许被上位 root 抢走)', () => {
  const reg = JSON.stringify({
    entries: [
      { miniapp: 'pages/setting/index' },
      { miniapp: 'pages/setting/notification' },
      { miniapp: 'pages/index/index' },
      { miniapp: 'pkg-user/a/index' },
      { miniapp: 'pkg-user-not/an/index' },
    ],
  })
  const r = cap.mirrorEntriesByRoot(reg, ['pages', 'pages/setting', 'pkg-user'])
  assert.equal(r.ok, true)
  assert.equal(r.counts['pages/setting'], 2)
  assert.equal(r.counts.pages, 1)
  assert.equal(r.counts['pkg-user'], 1, 'pkg-user-not 不是 pkg-user 的子路径,不许算进去')
})

test('K4 过闸:额度内放行、到量挡下并点名、未知 root 不放行', () => {
  const m = model()
  // 实测 1,963,534 ⇒ 余 (1,992,294.4−1,963,534)/28,760 = 1 页;在册 2 ⇒ 上限 3
  m.roots['pkg-user'] = { bytes: 1_963_534, mirrorEntriesAtMeasure: 2, chunkReserveBytes: 0 }
  const reg = JSON.stringify({ entries: [{ miniapp: 'pkg-user/a/index' }, { miniapp: 'pkg-user/b/index' }] })
  const plans = [
    { route: 'pkg-user/d/index', subRoot: 'pkg-user' },
    { route: 'pkg-user/e/index', subRoot: 'pkg-user' },
    { route: 'pkg-unknown/f/index', subRoot: 'pkg-unknown' },
  ]
  const r = cap.admitByCapacity(plans, { model: m, registryText: reg, cap: 5 })
  assert.equal(r.ok, true)
  assert.deepEqual(r.admitted.map((p) => p.route), ['pkg-user/d/index'], '余额只够 1 枚')
  assert.equal(r.held.length, 2, '到量 1 枚 + 未知 root 1 枚')
  assert.match(r.held[0].why, /容量上限 3/)
  assert.match(r.held[1].why, /无容量测量/)
})

test('K5 过闸:模型/台账取不到 ⇒ 整轮不放行(失效方向是多要一次说明,不是多放一次跳门)', () => {
  const plans = [{ route: 'pkg-user/x/index', subRoot: 'pkg-user' }]
  assert.equal(cap.admitByCapacity(plans, { model: null, registryText: '{}', cap: 5 }).ok, false)
  assert.equal(cap.admitByCapacity(plans, { model: model(), registryText: 'not json', cap: 5 }).ok, false)
})

test('K6 过闸:cap 只截断放行数,不改变"按计划顺序"语义', () => {
  const m = model()
  const reg = JSON.stringify({ entries: [] })
  const plans = Array.from({ length: 5 }, (_, i) => ({ route: `pkg-new/${i}/index`, subRoot: 'pkg-new' }))
  const r = cap.admitByCapacity(plans, { model: m, registryText: reg, cap: 2 })
  assert.deepEqual(r.admitted.map((p) => p.route), ['pkg-new/0/index', 'pkg-new/1/index'])
})
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
