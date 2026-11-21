// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

// 监控三源入库派发器(第 58 项)的镜像测试 —— 判据 import 源脚本,不在测试里复算第二份。
//
// 立因:`monitor-signal-intake.mjs` 是契约 producers 段登记的三源唯一生产器,而全仓零调度点;
// 实测 `.ihui-agent/state/incident-signals.jsonl` 37 行全部 source=deploy_outcome ⇒ 感知腿
// 名义四源、实际一源(§0.9「造好没装车 = 没有」)。本测试钉死"这一跳到底装车没有"。

import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import path from 'node:path'
import test from 'node:test'
import { fileURLToPath } from 'node:url'

import { dispatchMonitorSignalIntake } from '../git-guardian.mjs'

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..')
const guardian = readFileSync(path.join(ROOT, 'scripts/git-guardian.mjs'), 'utf8')
const instrument = readFileSync(path.join(ROOT, 'scripts/monitor-signal-intake.mjs'), 'utf8')

const RUN = `${Date.now()}-${Math.random().toString(16).slice(2, 8)}`
const tmpTick = (name) => path.join(ROOT, '.ihui-agent', 'tmp', `msi-test-${RUN}-${name}.json`)

test('① 派发器必须在位、导出、并真用 --apply(否则"跑了没产出"会伪装成健康)', () => {
  assert.match(guardian, /export function dispatchMonitorSignalIntake/)
  // 器物默认 dry-run:调度面必须显式给 --apply,否则永远零信号
  assert.match(guardian, /\[script, '--apply', '--json'\]/)
})

test('② 双挂点:main 单轮与 daemon tick 都必须调(计划任务档禁用后 daemon 是唯一执行体)', () => {
  // 2026-11-21(第 93 项):两面现在都**显式传 tickFile**(结构锁 T8 要求戳名在 main 段也看得见),
  // 因此不再匹配零参形态 `()`,但仍必须匹配"这个派发器真被调到"这一件事(允许带参)。
  assert.match(guardian, /if \(!CHECK_ONLY\) dispatchMonitorSignalIntake\(/)
  const bare = guardian.match(/^\s*dispatchMonitorSignalIntake\(/gm) || []
  assert.ok(bare.length >= 1, 'daemon tick 必须直调一次')
})

test('③ 节流 + 关断开关都在(缺一就会每轮派生或无法止停)', () => {
  assert.match(guardian, /IHUI_MONITOR_INTAKE_INTERVAL_MS/)
  assert.match(guardian, /IHUI_GUARDIAN_DISABLE_MONITOR_INTAKE/)
  assert.match(guardian, /monitor-signal-intake-dispatch-last\.json/)
})

test('④ 真跑:runner 注入给出结论行 ⇒ ran=true 且 ok 透传', () => {
  const got = dispatchMonitorSignalIntake({
    tickFile: tmpTick('ok'),
    logger: () => {},
    runner: () => ({ ok: true, out: 'MONITOR-INTAKE signals=2 skipped=0 undetermined=1\n' }),
  })
  assert.deepEqual(got, { ran: true, ok: true })
  const bad = dispatchMonitorSignalIntake({
    tickFile: tmpTick('bad'),
    logger: () => {},
    runner: () => ({ ok: false, out: '未判定:三个监控源全部未判定(没有任何可判定面)\n', err: 'exit 2' }),
  })
  assert.deepEqual(bad, { ran: true, ok: false })
})

test('⑤ 节流窗口内不派生第二次,过窗必须放行', () => {
  const tick = tmpTick('throttle')
  const now = Date.now()
  const first = dispatchMonitorSignalIntake({ now, tickFile: tick, logger: () => {}, runner: () => ({ ok: true, out: '' }) })
  assert.equal(first.ran, true)
  const second = dispatchMonitorSignalIntake({ now: now + 60_000, tickFile: tick, logger: () => {}, runner: () => ({ ok: true, out: '' }) })
  assert.equal(second.ran, false)
  const third = dispatchMonitorSignalIntake({ now: now + 31 * 60_000, tickFile: tick, logger: () => {}, runner: () => ({ ok: true, out: '' }) })
  assert.equal(third.ran, true)
})

test('⑥ 器物不在位时不装成跑过(ran=false,不写戳)', () => {
  const got = dispatchMonitorSignalIntake({ tickFile: tmpTick('absent'), logger: () => {}, exists: () => false })
  assert.equal(got.ran, false)
  assert.equal(got.why, '器物缺席')
})

test('⑦ 器物头注必须点名真实调度器(防它变成下一枚"自称有人调度")', () => {
  assert.match(instrument, /dispatchMonitorSignalIntake/)
  assert.match(instrument, /IHUI_GUARDIAN_DISABLE_MONITOR_INTAKE/)
})
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
