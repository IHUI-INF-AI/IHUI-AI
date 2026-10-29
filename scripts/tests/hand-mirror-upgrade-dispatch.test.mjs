// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

// 镜像测试:守护轮「手写镜像页自动升级」腿(scripts/git-guardian.mjs 的 sweepHandMirrorUpgrades)。
//
// 取证方向(成对):
//   · 未到节流窗口 ⇒ 一次都不派发(否则每轮 tick 都跑一遍全量规划,白烧 10 分钟);
//   · 到点 ⇒ 派发一次,且把器物的结论行(logged)原样报出;
//   · 结论取不到 ⇒ 必须记"未判定"而不是静默成功(§0.3:没判不许写成判过);
//   · 落地枚数/声明件标记必须进日志(否则"自动落了几个"只能靠翻 git)。
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { join } from 'node:path'

import { sweepHandMirrorUpgrades } from '../git-guardian.mjs'
import { mkScratch } from '../lib/scratch-dir.mjs'

const tickIn = (dir) => join(dir, 'hand-upgrade.json')

test('D1 未到节流窗口 ⇒ 不派发(第一轮建台账,第二轮窗口内不跑)', () => {
  const dir = mkScratch('hand-upgrade-')
  let calls = 0
  const runner = () => {
    calls++
    return JSON.stringify({ ok: true, upgradable: 0, batch: [], landed: null })
  }
  const opts = { intervalMs: 60_000, tickFile: tickIn(dir), logger: () => {}, runner }
  const first = sweepHandMirrorUpgrades({ ...opts, now: 1_000_000 })
  assert.equal(first.ran, true, '首轮应派发并建台账')
  const second = sweepHandMirrorUpgrades({ ...opts, now: 1_000_000 + 30_000 })
  assert.equal(second.ran, false, '窗口内不得再派发')
  assert.equal(calls, 1)
})

test('D2 到点 ⇒ 派发一次并报出可落地/落地枚数', () => {
  const dir = mkScratch('hand-upgrade-')
  const logs = []
  const payload = {
    ok: true,
    upgradable: 1,
    batch: [{ route: 'pkg-a/index', shell: 'AScreen', saved: 96 }],
    landed: { ok: true, pages: 1, declLanded: true },
  }
  const r = sweepHandMirrorUpgrades({
    now: 2_000_000,
    intervalMs: 60_000,
    tickFile: tickIn(dir),
    logger: (m) => logs.push(String(m)),
    runner: () => JSON.stringify(payload),
  })
  assert.equal(r.ran, true)
  assert.equal(r.ok, true)
  const line = logs.join('\n')
  assert.match(line, /可落地=1/)
  assert.match(line, /落地=1/)
  assert.match(line, /声明件/)
})

test('D3 结论行解析不出 ⇒ 记未判定(不静默成功)', () => {
  const dir = mkScratch('hand-upgrade-')
  const logs = []
  const r = sweepHandMirrorUpgrades({
    now: 3_000_000,
    intervalMs: 60_000,
    tickFile: tickIn(dir),
    logger: (m) => logs.push(String(m)),
    runner: () => 'not-json-at-all',
  })
  assert.equal(r.ran, true)
  assert.equal(r.ok, false)
  assert.match(logs.join('\n'), /未判定/)
})

test('D4 落地失败(err)⇒ 日志点名,不冒充成功', () => {
  const dir = mkScratch('hand-upgrade-')
  const logs = []
  const r = sweepHandMirrorUpgrades({
    now: 4_000_000,
    intervalMs: 60_000,
    tickFile: tickIn(dir),
    logger: (m) => logs.push(String(m)),
    runner: () =>
      JSON.stringify({ ok: true, upgradable: 1, batch: [{}], landed: { ok: false, pages: 1, err: 'CAS 冲突' } }),
  })
  assert.equal(r.ok, true)
  assert.match(logs.join('\n'), /CAS 冲突/)
  assert.match(logs.join('\n'), /落地=0/)
})
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
