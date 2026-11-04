// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

// §22c 镜像测试 —— 直接 import 生产判据 `sweepRnStyleTiers`,不复制。
// 钉的是"自愈腿的失效方向":没跑到 / 没判出结论 / 孩子被杀,**一律不得记绿**。
// (本仓最高频失效型 = 巡检安静地什么都不做,而日志里看起来像"已探测、无异常"。)
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
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

test('⑦ argv 形状锁:RN 落档腿必须恒带字号旗(器物有三条子腿,只传 --apply 就永远只跑间距)', () => {
  // 立因(2026-11-05 现读):器物 `land-rn-style-tiers.mjs` 的 --include-font-size 预演实测
  // 263 处可改 / 96 文件 / verifyFailed=0(写成 token 后取值逐枚相等 ⇒ 零视觉变化),而守护与本仓
  // 一键级联此前都只传 `--apply` ⇒ 字号轴结构上永不跟随 web(§0.9「造好没装车」)。
  // 注入假 runner 的自测走不到真 spawn,故按"同一函数体内 argv 字面量"结构核对,并带反向对照。
  const src = readFileSync(resolve(ROOT, 'scripts/git-guardian.mjs'), 'utf8')
  const body = src.slice(src.indexOf('function sweepRnStyleTiers'))
  const argv = body.match(/\[\s*script,\s*'--apply'[^\]]*\]/)?.[0] ?? ''
  assert.ok(argv.includes("'--apply'"), `取不到 RN 腿的 spawn argv(函数体形状变了要同步改这把锁)`)
  assert.ok(
    argv.includes("'--include-font-size'"),
    `RN 落档腿的 argv 缺字号旗 ⇒ 会退回"只跑间距"的老口径:${argv}`,
  )
  // 反向对照:把该旗摘掉再核一次,锁必须翻红(有牙,不是恒真断言)
  const stripped = body.replace("'--include-font-size'", "'--no-such-flag'")
  const argv2 = stripped.match(/\[\s*script,\s*'--apply'[^\]]*\]/)?.[0] ?? ''
  assert.ok(!argv2.includes("'--include-font-size'"), '反向对照失效:摘掉旗后仍能匹配到它')
})

test('⑧ argv 形状锁:一键级联的 land-rn 段与守护逐字同口径(两处不同口径 = 互相打架)', () => {
  const src = readFileSync(resolve(ROOT, 'scripts/sync-cross-end-cascade.mjs'), 'utf8')
  const stage = src.slice(src.indexOf("script: 'land-rn-style-tiers.mjs'"))
  const applyLine = stage.split('\n').find((l) => l.trim().startsWith('apply:')) ?? ''
  assert.ok(
    applyLine.includes("'--apply'") && applyLine.includes("'--include-font-size'"),
    `级联 land-rn 段的 apply 与守护不同口径:${applyLine.trim()}`,
  )
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
