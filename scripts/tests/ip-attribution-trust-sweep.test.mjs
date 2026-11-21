#!/usr/bin/env node
// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * 第 78 项接线锁:IP 归属可信度尺的巡检轮派发。
 *
 * 钉住三件事(缺一条就等于"登记了没人调度"):
 *   ① 守护器导出 `sweepIpAttributionTrust`,且 main() 与 daemon tick **两处**都直调;
 *   ② 三态不并桶:ok / breach / unjudged 各回各的;结论取不到(JSON 坏)算未判定,不记绿;
 *   ③ 节流:同 now 二次不放行、过 30 分钟放行;尺子缺席不写戳(不把"没跑"记成"跑过")。
 */
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync, existsSync, rmSync, mkdtempSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..', '..')
const GUARDIAN = join(ROOT, 'scripts', 'git-guardian.mjs')
const SRC = readFileSync(GUARDIAN, 'utf8')
const RUN = `${process.pid}-${Date.now()}`

async function load() {
  return import('file://' + GUARDIAN.replace(/\\/g, '/'))
}

function mkTick(name) {
  const dir = mkdtempSync(join(tmpdir(), `ipt-${RUN}-${name}-`))
  return { file: join(dir, 'last.json'), dir }
}

const fakeSweep = { ok: JSON.stringify({ state: 'ok', reason: '只回环' }), breach: JSON.stringify({ state: 'breach', reason: '含 8.8.8.8(public)', fix: '改 cf-connecting-ip 口径' }), unjudged: JSON.stringify({ state: 'unjudged', reason: '.env 取不到' }) }

test('① 导出 + main 与 tick 双挂点', () => {
  assert.match(SRC, /export async function sweepIpAttributionTrust\(/)
  const mounts = SRC.split(/\r?\n/).filter((l) => /sweepIpAttributionTrust\(\)\.catch/.test(l))
  assert.ok(mounts.length >= 2, `挂点只有 ${mounts.length} 处,需 main + daemon tick 两处`)
})

test('② ok/breach/unjudged 分档 + 坏 JSON 算未判定', async () => {
  const m = await load()
  const logs = []
  const logger = (s) => logs.push(String(s))
  for (const [name, expectState] of [['ok', 'ok'], ['breach', 'breach'], ['unjudged', 'unjudged']]) {
    const t = mkTick(name)
    const r = await m.sweepIpAttributionTrust({
      now: 1_800_000_000_000,
      tickFile: t.file,
      logger,
      runner: () => ({ status: 0, stdout: fakeSweep[name] }),
    })
    assert.equal(r.state, expectState, `${name} 应判 ${expectState}`)
    rmSync(t.dir, { recursive: true, force: true })
  }
  const t = mkTick('bad')
  const r = await m.sweepIpAttributionTrust({ now: 1, tickFile: t.file, logger, runner: () => ({ status: 0, stdout: 'not-json' }) })
  assert.equal(r.state, 'unjudged', '结论取不到必须落未判定,不得记绿')
  rmSync(t.dir, { recursive: true, force: true })
})

test('③ 节流 30 分钟 + 尺子缺席不写戳', async () => {
  const m = await load()
  const t = mkTick('thr')
  let calls = 0
  const runner = () => { calls += 1; return { status: 0, stdout: fakeSweep.ok } }
  const a = await m.sweepIpAttributionTrust({ now: 1_800_000_000_000, tickFile: t.file, logger: () => {}, runner })
  assert.equal(a.ran, true)
  const b = await m.sweepIpAttributionTrust({ now: 1_800_000_000_000 + 60_000, tickFile: t.file, logger: () => {}, runner })
  assert.equal(b.ran, false, '窗口内不得二次派发')
  const c = await m.sweepIpAttributionTrust({ now: 1_800_000_000_000 + 31 * 60_000, tickFile: t.file, logger: () => {}, runner })
  assert.equal(c.ran, true, '过窗必须放行')
  assert.equal(calls, 2)
  rmSync(t.dir, { recursive: true, force: true })

  const t2 = mkTick('absent')
  const d = await m.sweepIpAttributionTrust({ now: 5, tickFile: t2.file, scriptFile: join(t2.dir, 'nope.mjs'), logger: () => {} })
  assert.equal(d.ran, false)
  assert.match(String(d.why), /尺子不在位/)
  assert.equal(existsSync(t2.file), false, '没跑不得写戳')
  rmSync(t2.dir, { recursive: true, force: true })
})
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
