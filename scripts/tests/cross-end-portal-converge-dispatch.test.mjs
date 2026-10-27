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
import { existsSync, readFileSync } from 'node:fs'
import { join, resolve } from 'node:path'
import test from 'node:test'

import { convergeCrossEndPortalVerdicts } from '../git-guardian.mjs'
import { mkScratch } from '../lib/scratch-dir.mjs'

const GUARDIAN = resolve(import.meta.dirname, '..', 'git-guardian.mjs')
const SRC = readFileSync(GUARDIAN, 'utf8')

// undetFile 必须注入临时目录:否则用例会清掉/写脏真 .ihui-agent/state 的在册起点件
const fixture = () => {
  const dir = mkScratch('cross-end-portal-')
  return { tickFile: join(dir, 'tick.json'), undetFile: join(dir, 'undet-first.json') }
}
const runnerOf =
  (stdout, status = 0) =>
  () => ({ status, stdout, stderr: '' })
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
  assert.ok(
    logs.some((l) => l.includes('AUTO-REGISTER-PORTAL')),
    '动了台账却不留读数 = 失效方向变安静',
  )
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
  const a = convergeCrossEndPortalVerdicts({
    ...fx,
    logger: () => {},
    runner,
    intervalMs: 60_000,
    now: 1_000,
  })
  const b = convergeCrossEndPortalVerdicts({
    ...fx,
    logger: () => {},
    runner,
    intervalMs: 60_000,
    now: 10_000,
  })
  assert.equal(a.ran, true)
  assert.equal(b.ran, false, '未到节流窗口仍派生 = 每 tick 写一次台账')
  assert.equal(calls, 1)
})

test('P6 装车锁:本腿挂在守护轮 !CHECK_ONLY 分支,且只以 --only=portal 派生', () => {
  const call = /if \(!CHECK_ONLY\) convergeCrossEndPortalVerdicts\(\)/.exec(SRC)
  assert.ok(call, '已接线而守护轮不调用 = 造好没装车(守门 89 R4 同型)')
  const body = SRC.slice(
    SRC.indexOf('export function convergeCrossEndPortalVerdicts'),
    SRC.indexOf('export function healCrossEndMirror'),
  )
  assert.match(body, /'--converge-portal'/)
  assert.match(
    body,
    /'--only=portal'/,
    '不带 --only=portal 会顺手替别人登记 aligned 行、改页面标记',
  )
  assert.match(
    body,
    /stdio: \['ignore', 'pipe', 'pipe'\]/,
    '派生 git/node 必须显式接管 stdio(§12g)',
  )
  assert.doesNotMatch(
    body,
    /notifyGuardRed\(/,
    '收敛本身不到人(§5e-1);只有"这一格瞎了"才经 noteCrossEndUndetermined 转发到 notify',
  )
  assert.match(body, /noteCrossEndUndetermined\(\s*'portal-converge'/, '瞎必须进跨腿未判定连击台账')
  assert.match(body, /settleCrossEndLeg\('portal-converge'/, '取到确定结论必须撤掉在册起点')
})

test('P7 单轮取不到结论 ⇒ 只留在册起点,不到人(并发争用不该叫人)', () => {
  const f = fixture()
  const mails = []
  const r = convergeCrossEndPortalVerdicts({
    ...f,
    logger: () => {},
    notify: (title, message, opts) => mails.push({ title, message, opts }),
    undetHorizonMs: 60 * 60 * 1000,
    runner: () => ({ ok: false, out: '', err: 'boom', status: 2 }),
    now: 1_700_000_000_000,
  })
  assert.equal(r.state, 'unparsed')
  assert.equal(mails.length, 0)
  assert.ok(existsSync(f.undetFile), '瞎一轮必须留下在册起点,否则下一场停摆一开局就够格寄信')
})

test('P8 连击跨门槛 ⇒ 到人、身份稳定、给出可执行下一步(§5e-1)', () => {
  const f = fixture()
  const mails = []
  const notify = (title, message, opts) => mails.push({ title, message, opts })
  const boom = () => ({
    ok: false,
    out: '',
    err: 'ReferenceError: writeVerdictRows is not defined',
    status: 1,
  })
  convergeCrossEndPortalVerdicts({
    ...f,
    logger: () => {},
    notify,
    undetHorizonMs: 0,
    runner: boom,
    now: 1_700_000_000_000,
  })
  const second = convergeCrossEndPortalVerdicts({
    ...f,
    logger: () => {},
    notify,
    undetHorizonMs: 0,
    runner: boom,
    now: 1_700_000_000_000 + 31 * 60 * 1000,
  })
  assert.equal(second.state, 'unparsed')
  assert.ok(mails.length >= 1, `跨门槛应当到人,实得 ${mails.length} 封`)
  assert.match(mails[0].message, /门户维收敛这一格是瞎的/)
  assert.match(mails[0].message, /auto-register-cross-end\.mjs/, '收信人必须拿到可执行下一步')
  const keys = [...new Set(mails.map((m) => String(m.opts?.dedupKey ?? '')))]
  assert.equal(keys.length, 1, `同一场停摆的多轮必须同一身份,实得 ${keys.join(' | ')}`)
  assert.match(keys[0], /portal-converge/)
})

test('P9 瞎后恢复 ⇒ 起点被撤且不补发旧账', () => {
  const f = fixture()
  const mails = []
  const notify = (title, message, opts) => mails.push({ title, message, opts })
  const boom = () => ({ ok: false, out: '', err: 'boom', status: 2 })
  convergeCrossEndPortalVerdicts({
    ...f,
    logger: () => {},
    notify,
    undetHorizonMs: 60 * 60 * 1000,
    runner: boom,
    now: 1_700_000_000_000,
  })
  convergeCrossEndPortalVerdicts({
    ...f,
    logger: () => {},
    notify,
    undetHorizonMs: 60 * 60 * 1000,
    runner: runnerOf(`${lineOf('clean', 0, 0)}\n`),
    now: 1_700_000_000_000 + 31 * 60 * 1000,
  })
  assert.equal(mails.length, 0, '只瞎一轮又恢复 ⇒ 不该到人')
  assert.ok(!existsSync(f.undetFile), `在册起点应被撤掉:${f.undetFile}`)
})

test('P10 结论行自报未判定(门户表取不到)⇒ 同样进连击台账,不读成已收敛', () => {
  const f = fixture()
  const r = convergeCrossEndPortalVerdicts({
    ...f,
    logger: () => {},
    notify: () => {},
    undetHorizonMs: 60 * 60 * 1000,
    runner: runnerOf(`${lineOf('undetermined', 0, 0)}\n`),
    now: 1_700_000_000_000,
  })
  assert.equal(r.state, 'undetermined')
  assert.ok(existsSync(f.undetFile), '「表取不到」与「进程崩了」在“这一格没判”上同罪')
})
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
