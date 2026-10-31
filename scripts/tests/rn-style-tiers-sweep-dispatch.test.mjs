// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

// §22c 镜像测试 —— 直接 import 生产判据 `sweepRnStyleTiers`,不复制。
// 钉的是"自愈腿的失效方向":没跑到 / 没判出结论 / 孩子被杀,**一律不得记绿**。
// (本仓最高频失效型 = 巡检安静地什么都不做,而日志里看起来像"已探测、无异常"。)
import assert from 'node:assert/strict'
import { dirname, resolve } from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'
import test from 'node:test'

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..', '..')
const { sweepRnStyleTiers } = await import(pathToFileURL(resolve(ROOT, 'scripts/git-guardian.mjs')).href)

let seq = 0
const tick = () => resolve(ROOT, '.ihui-agent/tmp/goal-cross-end-auto', `t-${process.pid}-${seq++}.json`)

function run(out, opts = {}) {
  const logs = []
  const res = sweepRnStyleTiers({
    intervalMs: 0,
    now: Date.now() + seq * 1000,
    tickFile: tick(),
    logger: (s) => logs.push(String(s)),
    runner: () => ({ status: opts.status ?? 0, out, signal: opts.signal }),
  })
  return { res, logs }
}

test('① 有改动 ⇒ ok,并把 files/changes/held 解析出来', () => {
  const { res } = run('结论:LAND-TIERS state=applied files=3 changes=9 held=2\n')
  assert.equal(res.ok, true)
  assert.equal(res.state, 'applied')
  assert.deepEqual([res.files, res.changes, res.held], [3, 9, 2])
})

test('② 零改动也是 ok(held 是"归属未知不猜",不是失败)', () => {
  const { res } = run('结论:LAND-TIERS state=preview files=0 changes=0 held=214\n')
  assert.equal(res.ok, true)
  assert.equal(res.held, 214)
})

test('③ 回滚态必须 ok:false,并点名"可能停在无水印态"', () => {
  const { res, logs } = run('结论:LAND-TIERS state=rolled-back files=0 changes=0 held=0\n', { status: 2 })
  assert.equal(res.ok, false)
  assert.equal(res.state, 'rolled-back')
  assert.match(logs.join('\n'), /无水印态/)
})

test('④ 没有结论行 ⇒ 未判定,不得记绿(rc=0 也不算成功)', () => {
  const { res } = run('随便什么输出\n', { status: 0 })
  assert.equal(res.ok, false)
  assert.equal(res.state, 'undetermined')
})

test('⑤ 孩子被信号掐死 ⇒ 未判定并点名信号(超时与"缺口清零"不能同形)', () => {
  const { res, logs } = run('', { status: null, signal: 'SIGTERM' })
  assert.equal(res.ok, false)
  assert.equal(res.state, 'undetermined')
  assert.match(logs.join('\n'), /SIGTERM/)
})

test('⑥ 节流窗口内不重复派发(第二条同 tickFile 必须 ran:false)', () => {
  const tickFile = tick()
  const base = { tickFile, logger: () => {}, runner: () => ({ status: 0, out: '结论:LAND-TIERS state=preview files=0 changes=0 held=0\n' }) }
  const a = sweepRnStyleTiers({ ...base, now: Date.now(), intervalMs: 60_000 })
  const b = sweepRnStyleTiers({ ...base, now: Date.now() + 1000, intervalMs: 60_000 })
  assert.equal(a.ran, true)
  assert.equal(b.ran, false)
  assert.equal(b.why, '未到节流窗口')
})
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
