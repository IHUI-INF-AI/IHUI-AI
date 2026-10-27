// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

// RN 色档同源入表调度腿(autoRegisterRnTokenPairs)的镜像测试(2026-10-27 立)。
//
// 立因:plan-rn-token-pairing.mjs 把「哪一档其实在源里有等值真源」量准了,但"发现之后入表"仍要有人
// 敲一次 --apply —— 与它自己头注批过的那一型同病:造好没装车 = 没有。本腿把它变成守护轮自跑的格子。
// 这一格敢自动动手的依据只有一条:判据是**等值**,登记后派生写回的值与现值逐位同色
// (2026-10-27 实测:8 档入表后 rn-tokens.ts 零 diff)。它不改颜色,只把手抄档变派生态。
//
// 本文件钉四件事:三态读数(nochange 静默 / applied 留痕 / refused 点名不到人 / unparsed 未判定)、
// 节流只派一次、装车锁(在 !CHECK_ONLY 分支里、显式 stdio、不经 notifyGuardRed)、
// 以及**一条诚实的局限**:refused 分支本轮未按真执行验证(见 R6 注记),只钉它在器物里存在。
import assert from 'node:assert/strict'
import { existsSync, readFileSync } from 'node:fs'
import { join, resolve } from 'node:path'
import test from 'node:test'

import { autoRegisterRnTokenPairs } from '../git-guardian.mjs'
import { mkScratch } from '../lib/scratch-dir.mjs'

const GUARDIAN = resolve(import.meta.dirname, '..', 'git-guardian.mjs')
const PLANNER = resolve(import.meta.dirname, '..', 'plan-rn-token-pairing.mjs')
const SRC = readFileSync(GUARDIAN, 'utf8')
const PSRC = readFileSync(PLANNER, 'utf8')

// undetFile 必须注入临时目录:否则用例会清掉/写脏真 .ihui-agent/state 的在册起点件
const fixture = () => {
  const dir = mkScratch('rn-token-pair-')
  return { tickFile: join(dir, 'tick.json'), undetFile: join(dir, 'undet-first.json') }
}
const runnerOf =
  (stdout, status = 0) =>
  () => ({ status, stdout, stderr: '' })
const lineOf = (state, inserted, extra = '已在册=0') =>
  `PLAN-RN-PAIRING-APPLY face=head state=${state} inserted=${inserted} ${extra}`

test('R1 无档可配 ⇒ 静默(常态轮不该刷日志)', () => {
  const logs = []
  const r = autoRegisterRnTokenPairs({
    ...fixture(),
    logger: (l) => logs.push(String(l)),
    runner: runnerOf(`${lineOf('nochange', 0)}\n`),
  })
  assert.equal(r.state, 'nochange')
  assert.equal(r.inserted, 0)
  assert.equal(logs.filter((l) => l.includes('同源入表')).length, 0)
})

test('R2 本轮真入表 ⇒ 必留读数(收编器据此落库)', () => {
  const logs = []
  const r = autoRegisterRnTokenPairs({
    ...fixture(),
    logger: (l) => logs.push(String(l)),
    runner: runnerOf(`${lineOf('applied', 8)}\n`),
  })
  assert.equal(r.state, 'applied')
  assert.equal(r.inserted, 8)
  assert.ok(
    logs.some((l) => l.includes('inserted=8')),
    '改了守门件却不留痕 = 事后无人知道谁动的',
  )
})

test('R3 拒落(守门件挂他席在飞行)⇒ 点名但不到人(§5e-1)', () => {
  const logs = []
  const r = autoRegisterRnTokenPairs({
    ...fixture(),
    logger: (l) => logs.push(String(l)),
    runner: runnerOf(`${lineOf('refused', 0, 'why=工作树有 3 行不在 HEAD')}\n`, 1),
  })
  assert.equal(r.state, 'refused')
  assert.ok(logs.some((l) => l.includes('refused')))
})

test('R4 结论行取不到 ⇒ 未判定,既不读成"已同源"也不读成"无档可配"', () => {
  const logs = []
  const r = autoRegisterRnTokenPairs({
    ...fixture(),
    logger: (l) => logs.push(String(l)),
    runner: runnerOf('', 2),
  })
  assert.equal(r.state, 'unparsed')
  assert.ok(logs.some((l) => /本轮没判/.test(l)))
})

test('R5 节流:窗口内不派生第二次', () => {
  let calls = 0
  const fx = fixture()
  const runner = () => {
    calls += 1
    return { status: 0, stdout: `${lineOf('nochange', 0)}\n`, stderr: '' }
  }
  const a = autoRegisterRnTokenPairs({
    ...fx,
    logger: () => {},
    runner,
    intervalMs: 60_000,
    now: 1_000,
  })
  const b = autoRegisterRnTokenPairs({
    ...fx,
    logger: () => {},
    runner,
    intervalMs: 60_000,
    now: 30_000,
  })
  assert.equal(a.ran, true)
  assert.equal(b.ran, false)
  assert.equal(calls, 1)
})

test('R6 装车锁:在 !CHECK_ONLY 分支被调、只以 --apply 派生、显式 stdio、不经邮件', () => {
  assert.match(
    SRC,
    /if \(!CHECK_ONLY\) autoRegisterRnTokenPairs\(\)/,
    '已接线而守护轮不调用 = 造好没装车',
  )
  const body = SRC.slice(
    SRC.indexOf('export function autoRegisterRnTokenPairs'),
    SRC.indexOf('export function healCrossEndMirror'),
  )
  assert.ok(body.length > 400, '两条 export 之间的切片异常,函数边界变了')
  assert.match(body, /\[script,\s*'--apply'\]/, '缺 --apply 就只是预演,账面会一直"无档可配"')
  assert.match(
    body,
    /stdio: \['ignore', 'pipe', 'pipe'\]/,
    '§12g:派生不显式接管 stdio 会 EBUSY 静默失败',
  )
  assert.doesNotMatch(
    body,
    /notifyGuardRed\(/,
    '等值入表本身不到人(§5e-1);只有"这一格瞎了"才经 noteCrossEndUndetermined 转发到 notify',
  )
  assert.match(body, /noteCrossEndUndetermined\(\s*'rn-token-pair'/, '瞎必须进跨腿未判定连击台账')
  assert.match(body, /settleCrossEndLeg\('rn-token-pair'/, '取到确定结论必须撤掉在册起点')
  // 判据住在计划器那一份实现里,本腿零复算(§0.6)—— 这条断言防的是"腿里再抄一套等值判断"。
  assert.doesNotMatch(body, /colorsAgree|deriveCssVarNames/)
  // 计划器侧的三条护栏必须在器物里真存在(本轮**未按真执行验证 refused 分支**:它需要守门件上
  // 挂一条他席改动,造假执行会动到并发会话正在提交的文件。这里只钉代码在位,不谎称跑过。)
  assert.match(PSRC, /state=refused/, '拒落分支不在器物里 = "不替人提交"只是口头承诺')
  assert.match(PSRC, /他席在飞/, '拒落理由必须点名')
})

test('R7 单轮取不到结论 ⇒ 只留在册起点,不到人(并发争用不该叫人)', () => {
  const f = fixture()
  const mails = []
  const r = autoRegisterRnTokenPairs({
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

test('R8 连击跨门槛 ⇒ 到人、身份稳定、给出可执行下一步(§5e-1)', () => {
  const f = fixture()
  const mails = []
  const notify = (title, message, opts) => mails.push({ title, message, opts })
  const boom = () => ({ ok: false, out: '', err: 'SyntaxError: bad import', status: 1 })
  autoRegisterRnTokenPairs({
    ...f,
    logger: () => {},
    notify,
    undetHorizonMs: 0,
    runner: boom,
    now: 1_700_000_000_000,
  })
  const second = autoRegisterRnTokenPairs({
    ...f,
    logger: () => {},
    notify,
    undetHorizonMs: 0,
    runner: boom,
    now: 1_700_000_000_000 + 61 * 60 * 1000,
  })
  assert.equal(second.state, 'unparsed')
  assert.ok(mails.length >= 1, `跨门槛应当到人,实得 ${mails.length} 封`)
  assert.match(mails[0].message, /RN 色档同源入表这一格是瞎的/)
  assert.match(mails[0].message, /plan-rn-token-pairing\.mjs/, '收信人必须拿到可执行下一步')
  const keys = [...new Set(mails.map((m) => String(m.opts?.dedupKey ?? '')))]
  assert.equal(keys.length, 1, `同一场停摆的多轮必须同一身份,实得 ${keys.join(' | ')}`)
  assert.match(keys[0], /rn-token-pair/)
})

test('R9 瞎后恢复 ⇒ 起点被撤且不补发旧账', () => {
  const f = fixture()
  const mails = []
  const notify = (title, message, opts) => mails.push({ title, message, opts })
  const boom = () => ({ ok: false, out: '', err: 'boom', status: 2 })
  autoRegisterRnTokenPairs({
    ...f,
    logger: () => {},
    notify,
    undetHorizonMs: 60 * 60 * 1000,
    runner: boom,
    now: 1_700_000_000_000,
  })
  autoRegisterRnTokenPairs({
    ...f,
    logger: () => {},
    notify,
    undetHorizonMs: 60 * 60 * 1000,
    runner: runnerOf(`${lineOf('nochange', 0)}\n`),
    now: 1_700_000_000_000 + 61 * 60 * 1000,
  })
  assert.equal(mails.length, 0, '只瞎一轮又恢复 ⇒ 不该到人')
  assert.ok(!existsSync(f.undetFile), `在册起点应被撤掉:${f.undetFile}`)
})
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
