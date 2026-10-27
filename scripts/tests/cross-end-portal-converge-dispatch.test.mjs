// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

// 跨端台账「门户维收敛」调度器(convergeCrossEndPortalVerdicts)的镜像测试。
//
// 立因:web-rn-screen-map.jsonl 的跳过集(registeredGap / registeredExcluded)是自动登记链的闸门 ——
// 台账里一句过期的「RN 零承载/不承载」会把那条路由永久锁在重判之外。门户表(web-portal.ts)说承载,
// 就得有人把互斥行改掉;此前这一步只能靠人逐条翻代码,正是机主要消灭的重复开发。
// 本文件只钉派发腿的形状(结论行三态 + 装车),判据本身在对账尺那一份实现里,零复算。
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { join, resolve } from 'node:path'
import test from 'node:test'

import { convergeCrossEndPortalVerdicts } from '../git-guardian.mjs'
import { mkScratch } from '../lib/scratch-dir.mjs'

const GUARDIAN = resolve(import.meta.dirname, '..', 'git-guardian.mjs')
const SRC = readFileSync(GUARDIAN, 'utf8')

const fixture = () => ({ tickFile: join(mkScratch('cross-end-portal-'), 'tick.json') })
const runnerOf = (stdout, status = 0) => () => ({ status, stdout, stderr: '' })
const lineOf = (state, candidates, applied) =>
  `AUTO-REGISTER-PORTAL face=head state=${state} candidates=${candidates} applied=${applied}`

test('P1 无需收敛 ⇒ clean 且零日志(常态轮不该刷屏)', () => {
  const logs = []
  const r = convergeCrossEndPortalVerdicts({
    ...fixture(),
    logger: (l) => logs.push(String(l)),
    runner: runnerOf(`${lineOf('clean', 0, 0)}\n`),
  })
  assert.equal(r.state, 'clean')
  assert.equal(r.candidates, 0)
  assert.equal(logs.filter((l) => l.includes('门户维收敛')).length, 0)
})

test('P2 本轮真改了台账 ⇒ 留一行读数(收编器据此落库)', () => {
  const logs = []
  const r = convergeCrossEndPortalVerdicts({
    ...fixture(),
    logger: (l) => logs.push(String(l)),
    runner: runnerOf(`${lineOf('converged', 28, 28)}\n`),
  })
  assert.equal(r.state, 'converged')
  assert.equal(r.applied, 28)
  assert.ok(logs.some((l) => l.includes('AUTO-REGISTER-PORTAL')), '动了台账却不留读数 = 失效方向变安静')
})

test('P3 未判定(门户表取不到)⇒ 点名且不读成已收敛', () => {
  const logs = []
  const r = convergeCrossEndPortalVerdicts({
    ...fixture(),
    logger: (l) => logs.push(String(l)),
    runner: runnerOf(`${lineOf('undetermined', 0, 0)}\n`),
  })
  assert.equal(r.state, 'undetermined')
  assert.ok(logs.some((l) => /未判定/.test(l)))
})

test('P4 结论行取不到 ⇒ unparsed,绝不记 clean(§0.3 没判 ≠ 判过)', () => {
  const logs = []
  const r = convergeCrossEndPortalVerdicts({
    ...fixture(),
    logger: (l) => logs.push(String(l)),
    runner: runnerOf('', 2),
  })
  assert.equal(r.state, 'unparsed')
  assert.ok(logs.some((l) => /本轮没判/.test(l)))
})

test('P5 节流:窗口内不派生第二次', () => {
  let calls = 0
  const fx = fixture()
  const runner = () => {
    calls += 1
    return { status: 0, stdout: `${lineOf('clean', 0, 0)}\n`, stderr: '' }
  }
  const a = convergeCrossEndPortalVerdicts({ ...fx, logger: () => {}, runner, intervalMs: 60_000, now: 1_000 })
  const b = convergeCrossEndPortalVerdicts({ ...fx, logger: () => {}, runner, intervalMs: 60_000, now: 10_000 })
  assert.equal(a.ran, true)
  assert.equal(b.ran, false, '未到节流窗口仍派生 = 每 tick 写一次台账')
  assert.equal(calls, 1)
})

test('P6 装车锁:本腿挂在守护轮 !CHECK_ONLY 分支,且只以 --only=portal 派生', () => {
  const call = /if \(!CHECK_ONLY\) convergeCrossEndPortalVerdicts\(\)/.exec(SRC)
  assert.ok(call, '已接线而守护轮不调用 = 造好没装车(守门 89 R4 同型)')
  const body = SRC.slice(SRC.indexOf('export function convergeCrossEndPortalVerdicts'), SRC.indexOf('export function healCrossEndMirror'))
  assert.match(body, /'--converge-portal'/)
  assert.match(body, /'--only=portal'/, '不带 --only=portal 会顺手替别人登记 aligned 行、改页面标记')
  assert.match(body, /stdio: \['ignore', 'pipe', 'pipe'\]/, '派生 git/node 必须显式接管 stdio(§12g)')
  assert.doesNotMatch(body, /notifyGuardRed/, '收敛属机器常态,不到人(§5e-1)')
})
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
