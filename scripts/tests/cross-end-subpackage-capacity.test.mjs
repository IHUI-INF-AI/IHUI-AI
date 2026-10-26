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

test('K4 过闸+改道:语义包装不下 ⇒ 改道到 overflow 链,并把 4 个路由字段同步改写', () => {
  const m = model()
  // pkg-user 只剩 1 页额度(1,963,534 + 1×28,760 ≈ 1,992,294)
  m.roots['pkg-user'] = { bytes: 1_963_534, mirrorEntriesAtMeasure: 0, chunkReserveBytes: 0 }
  m.roots['pkg-mirror'] = { bytes: 0, mirrorEntriesAtMeasure: 0, chunkReserveBytes: 707_000 }
  m.overflowRoots = ['pkg-mirror']
  const reg = JSON.stringify({ entries: [] })
  const plans = [
    { spec: 'a/A1Screen.tsx', subRoot: 'pkg-user', page: 'a/index', route: 'pkg-user/a/index', pageRel: 'apps/miniapp-taro/src/pkg-user/a/index.tsx', registryEntry: { miniapp: 'pkg-user/a/index' } },
    { spec: 'b/B1Screen.tsx', subRoot: 'pkg-user', page: 'b/index', route: 'pkg-user/b/index', pageRel: 'apps/miniapp-taro/src/pkg-user/b/index.tsx', registryEntry: { miniapp: 'pkg-user/b/index' } },
  ]
  const r = cap.routePlanned(plans, { model: m, registryText: reg, cap: 5 })
  assert.equal(r.ok, true)
  assert.deepEqual(r.admitted.map((p) => p.route), ['pkg-user/a/index', 'pkg-mirror/b/index'])
  assert.equal(r.moves.length, 1)
  assert.equal(r.moves[0].from, 'pkg-user')
  assert.equal(r.moves[0].to, 'pkg-mirror')
  assert.equal(r.admitted[1].pageRel, 'apps/miniapp-taro/src/pkg-mirror/b/index.tsx')
  assert.equal(r.admitted[1].registryEntry.miniapp, 'pkg-mirror/b/index')
})

test('K5 过闸:模型/台账取不到 ⇒ 整轮不放行(失效方向是多要一次说明,不是多放一次跳门)', () => {
  const plans = [{ spec: 'x/XScreen.tsx', subRoot: 'pkg-user', page: 'x/index', route: 'pkg-user/x/index' }]
  assert.equal(cap.routePlanned(plans, { model: null, registryText: '{}', cap: 5 }).ok, false)
  assert.equal(cap.routePlanned(plans, { model: model(), registryText: 'not json', cap: 5 }).ok, false)
})

test('K6 过闸:cap 只截断放行数,不改变"按计划顺序"语义', () => {
  const m = model()
  const reg = JSON.stringify({ entries: [] })
  const plans = Array.from({ length: 5 }, (_, i) => ({ spec: `s${i}/S${i}Screen.tsx`, subRoot: 'pkg-new', page: `${i}/index`, route: `pkg-new/${i}/index` }))
  const r = cap.routePlanned(plans, { model: m, registryText: reg, cap: 2 })
  assert.deepEqual(r.admitted.map((p) => p.route), ['pkg-new/0/index', 'pkg-new/1/index'])
})

test('K9 溢出链与每屏估算:overflowRoots 只认表内有测量的 root;pageEstimates 原样带出', () => {
  const m = model()
  m.overflowRoots = ['pkg-new', 'pkg-not-measured']
  m.pageEstimates = { 'a/A.tsx': 123456 }
  const parsed = cap.parseCapacity(JSON.stringify(m))
  assert.equal(parsed.ok, true)
  assert.deepEqual(parsed.model.overflowRoots, ['pkg-new'], '没测量的 root 不许进溢出链(否则会被改道到未知容量的包)')
  assert.equal(parsed.model.pageEstimates['a/A.tsx'], 123456)
})

test('K10 容量表缺 overflowRoots/pageEstimates ⇒ 空数组/空对象(不炸,也不编)', () => {
  const parsed = cap.parseCapacity(JSON.stringify(model()))
  assert.equal(parsed.ok, true)
  assert.deepEqual(parsed.model.overflowRoots, [])
  assert.deepEqual(parsed.model.pageEstimates, {})
})

test('K7 过闸:未知 root 且不在 overflow 链 ⇒ held(不当"容量很足")', () => {
  const m = model()
  const reg = JSON.stringify({ entries: [] })
  const plans = [{ spec: 'z/ZScreen.tsx', subRoot: 'pkg-unknown', page: 'z/index', route: 'pkg-unknown/z/index' }]
  const r = cap.routePlanned(plans, { model: m, registryText: reg, cap: 5 })
  assert.equal(r.admitted.length, 0)
  assert.equal(r.held.length, 1)
  assert.match(r.held[0].why, /无容量测量/)
})

test('K8 每屏估算表:大屏按表里的字节计,不让它把整包额度吃穿再报绿', () => {
  const m = model()
  m.roots['pkg-mirror'] = { bytes: 0, mirrorEntriesAtMeasure: 0, chunkReserveBytes: 0 }
  m.overflowRoots = ['pkg-mirror']
  m.roots['pkg-user'] = { bytes: 1_900_000, mirrorEntriesAtMeasure: 0, chunkReserveBytes: 0 }
  const reg = JSON.stringify({ entries: [] })
  const plans = [
    { spec: 'home/HomeScreen.tsx', subRoot: 'pkg-user', page: 'home/index', route: 'pkg-user/home/index' },
    { spec: 'x/XScreen.tsx', subRoot: 'pkg-user', page: 'x/index', route: 'pkg-user/x/index' },
  ]
  // 大屏估算 1.36 MB ⇒ pkg-user 余量 ~92 KB 装不下它,改道 pkg-mirror
  const r = cap.routePlanned(plans, {
    model: m,
    registryText: reg,
    cap: 5,
    estimates: { 'home/HomeScreen.tsx': 1_360_000 },
  })
  assert.deepEqual(r.admitted.map((p) => p.route), ['pkg-mirror/home/index', 'pkg-user/x/index'])
})
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
