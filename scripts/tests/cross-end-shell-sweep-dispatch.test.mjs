// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * 跨端造页闭环调度器(`sweepCrossEndShellPages`)的镜像测试。
 *
 * 立因:`scripts/land-cross-end-shell-pages.mjs` 把「RN 有这屏、小程序没有承载页」变成
 * 机器可产的壳承载页,但**它没有调度器** —— 与同族的 `repair-cross-end-mirror`(门 128 R1
 * 红了没人接回)同一型「造好没装车」(§0.9),失效形态是安静:缺口永远等人工敲。
 *
 * 测试钉死六件事:
 *   T1 clean ⇒ 绿行点名读数,且 ok=true(无缺口即零写零推,不能报成"跑了什么都没发生");
 *   T2 landed ⇒ 绿行点名 blob 数;
 *   T3 blocked ⇒ ⚠️ 点名附原因,**不到人**(他席在飞属常态);
 *   T4 结论不可用 ⇒ 未判定,绝不记绿(否则"器物坏了"与"缺口清零"长得一样);
 *   T5 节流窗口内不派生第二次;
 *   T6 装车锁:定义在、调用挂在巡检轮体内(与同族腿同函数,邻接判据 —— 两端各被提及不算接线)、
 *       在 __test__ 出口里、节流可由 env 覆盖。
 *   C1 契约锁:调度器读的 summary 键,必须真存在于造页器 `--json` 现读出口(不手抄形状)。
 */
import assert from 'node:assert/strict'
import { execFileSync } from 'node:child_process'
import { existsSync } from 'node:fs'
import { join, resolve } from 'node:path'
import test from 'node:test'

import { sweepCrossEndShellPages, noteCrossEndUndetermined, settleCrossEndLeg } from '../git-guardian.mjs'
import { mkScratch } from '../lib/scratch-dir.mjs'

const LANDER = resolve(import.meta.dirname, '..', 'land-cross-end-shell-pages.mjs')
/** T6 判的是"这一腿到底装车没有"⇒ 必须读 HEAD 面(盘上副本可能滞后,§0.4 同面同轮)。 */
const HEAD_SRC = execFileSync('git', ['show', 'HEAD:scripts/git-guardian.mjs'], {
  encoding: 'utf8',
  maxBuffer: 1 << 26,
  stdio: ['ignore', 'pipe', 'pipe'],
  cwd: resolve(import.meta.dirname, '..', '..'),
})

const fixture = () => {
  const dir = mkScratch('cross-end-shell-')
  // undetFile 必须注入临时目录:否则测试会往真 .ihui-agent/state 写起点件(污染存续性判定)
  return { tickFile: join(dir, 'tick.json'), undetFile: join(dir, 'undet-first.json') }
}
const runnerOf = (obj, status = 0) => () => ({ ok: status === 0, out: JSON.stringify(obj), status })
const logsOf = () => {
  const logs = []
  return { logs, logger: (m) => logs.push(m) }
}

test('T1 clean ⇒ 绿行并报读数', () => {
  const { logs, logger } = logsOf()
  const r = sweepCrossEndShellPages({
    ...fixture(),
    logger,
    runner: runnerOf({ summary: { state: 'clean', planned: 0, batch: 0, blobs: 0, refused: 8, cap: 2 } }),
  })
  assert.equal(r.ran, true)
  assert.equal(r.ok, true)
  assert.equal(r.state, 'clean')
  const line = logs.find((l) => /跨端造页闭环/.test(l))
  assert.ok(line, 'clean 也要留一行读数(否则"没跑"和"跑了且无缺口"长得一样)')
  assert.match(line, /拒 8/, '要点名造页器拒掉的枚数 —— 缺口清零与全被拒是两件事')
  assert.doesNotMatch(line, /⚠️/, '无缺口不该报警')
})

test('T2 landed ⇒ 绿行点名 blob 数', () => {
  const { logs, logger } = logsOf()
  const r = sweepCrossEndShellPages({
    ...fixture(),
    logger,
    runner: runnerOf({ summary: { state: 'landed', planned: 6, batch: 2, blobs: 5, refused: 0, cap: 2 } }),
  })
  assert.equal(r.ok, true)
  assert.equal(r.state, 'landed')
  assert.equal(r.planned, 6)
  assert.match(logs.find((l) => /跨端造页闭环/.test(l)), /blob 5/)
})

test('T3 blocked ⇒ ⚠️ 点名带原因,不到人', () => {
  const { logs, logger } = logsOf()
  const r = sweepCrossEndShellPages({
    ...fixture(),
    logger,
    runner: runnerOf(
      { summary: { state: 'blocked', planned: 3, batch: 0, blobs: 0, refused: 0, cap: 2, why: '接缝被他席占用' } },
      1,
    ),
  })
  assert.equal(r.ok, false)
  assert.equal(r.state, 'blocked')
  const line = logs.find((l) => /跨端造页闭环/.test(l))
  assert.match(line, /⚠️/)
  assert.match(line, /接缝被他席占用/, '拒落原因必须进日志(§5e-1:能自己修的自己修,修不掉的留痕)')
})

test('T4 结论不可用 ⇒ 未判定,不记绿', () => {
  const { logs, logger } = logsOf()
  const r = sweepCrossEndShellPages({ ...fixture(), logger, runner: () => ({ ok: false, out: '', err: 'boom', status: 2 }) })
  assert.equal(r.ran, true)
  assert.equal(r.ok, false)
  assert.equal(r.state, 'unparsed')
  assert.match(logs.find((l) => /跨端造页闭环/.test(l)), /未判定/)
})

test('T5 节流窗口内不派生第二次', () => {
  const f = fixture()
  let calls = 0
  const counting = () => {
    calls += 1
    return { ok: true, out: JSON.stringify({ summary: { state: 'clean', planned: 0 } }), status: 0 }
  }
  const first = sweepCrossEndShellPages({ ...f, logger: () => {}, runner: counting, now: 1_700_000_000_000 })
  assert.equal(first.ran, true)
  const second = sweepCrossEndShellPages({ ...f, logger: () => {}, runner: counting, now: 1_700_000_000_000 + 1000 })
  assert.equal(second.ran, false)
  assert.equal(calls, 1, '窗口内必须一次都不派生(造页器每轮会写 HEAD,重复派生即重复提交)')
})

test('T6 装车锁:定义 + 巡检轮内调用 + __test__ 出口 + env 节流', () => {
  assert.match(HEAD_SRC, /export function sweepCrossEndShellPages\b/)
  const call = HEAD_SRC.match(/^\s*if \(!CHECK_ONLY\) sweepCrossEndShellPages\(\)$/m)
  assert.ok(call, '派发必须挂在 !CHECK_ONLY 分支(--check 档不写盘)')
  const sibling = HEAD_SRC.match(/^\s*if \(!CHECK_ONLY\) healCrossEndMirror\(\)$/m)
  assert.ok(sibling, '同族腿的调用锚点必须还在(它没了本锁就该重写,而不是静默失配)')
  // 邻接判据:两条调用必须落在同一个函数体内 —— "文件里两处都出现过"不等于接上了
  const fnStarts = [...HEAD_SRC.matchAll(/^(?:export )?(?:async )?function\s+(\w+)/gm)].map((m) => m.index)
  const enclosing = (idx) => {
    let name = null
    for (const s of fnStarts) if (s <= idx) name = HEAD_SRC.slice(s, HEAD_SRC.indexOf('(', s)).replace(/^(?:export\s+)?(?:async\s+)?function\s+/, '')
    else break
    return name
  }
  assert.equal(
    enclosing(call.index),
    enclosing(sibling.index),
    '两条派发必须同函数(巡检轮);分开即"抽出去了但没接回轮上"',
  )
  assert.match(HEAD_SRC, /sweepCrossEndShellPages,/, '必须进 __test__ 出口,否则镜像测试取不到本体')
  assert.match(HEAD_SRC, /IHUI_CROSS_END_SHELL_INTERVAL_MS/, '节流必须可由 env 覆盖(值守场景要能压节拍)')
  assert.match(HEAD_SRC, /'--cap=2'/, '每轮上限必须钉在 2 枚(造页增大主包,一次灌满顶穿微信 2MB 硬上限)')
})

/**
 * 停摆必喊人(2026-10-26 立):`gen-miniapp-mirror.mjs` 里一枚未定义标识符把这条腿打成
 * ReferenceError,守护每 30 分钟撞一次、连撞 8 小时,账面只有日志里同一行 ⚠️ —— **没有人被叫过**。
 * §5e-3 的原话:能看见的才谈得上修。所以"这一格瞎了"必须有存续性门槛 + 到人,而不是只写日志。
 */
test('S1 未判定未跨门槛 ⇒ 只报名,不寄信', () => {
  const f = fixture()
  const { logger } = logsOf()
  const mails = []
  const r = sweepCrossEndShellPages({
    ...f,
    logger,
    notify: (title, message, opts) => mails.push({ title, message, opts }),
    undetHorizonMs: 60 * 60 * 1000,
    runner: () => ({ ok: false, out: '', err: 'boom', status: 2 }),
  })
  assert.equal(r.state, 'unparsed')
  assert.equal(mails.length, 0, '单轮取不到多半是并发争用,不该把人叫来看一个已经好了的东西')
})

test('S2 连击跨门槛 ⇒ 到人,且同一场停摆的身份稳定(不放大成 N 个身份)', () => {
  const f = fixture()
  const { logger } = logsOf()
  const mails = []
  const notify = (title, message, opts) => mails.push({ title, message, opts })
  const boom = () => ({ ok: false, out: '', err: 'ReferenceError: X is not defined', status: 1 })
  // horizon=0 ⇒ 只要还在瞎就够格到人(测试不等真 3 小时);生产默认 3 小时见 IHUI_CROSS_END_UNDET_HORIZON_MS
  sweepCrossEndShellPages({ ...f, logger, notify, undetHorizonMs: 0, runner: boom, now: 1_700_000_000_000 })
  const second = sweepCrossEndShellPages({
    ...f,
    logger,
    notify,
    undetHorizonMs: 0,
    runner: boom,
    now: 1_700_000_000_000 + 31 * 60 * 1000,
  })
  assert.equal(second.state, 'unparsed')
  assert.ok(mails.length >= 1, `跨门槛应当到人,实得 ${mails.length} 封`)
  assert.match(mails[0].message, /自动造页这一格是瞎的/)
  assert.match(mails[0].message, /land-cross-end-shell-pages\.mjs/, '§5e-1:收信人必须拿到可执行下一步')
  const keys = [...new Set(mails.map((m) => String(m.opts?.dedupKey ?? '')))]
  assert.equal(keys.length, 1, `同一场停摆的多轮必须同一身份(§5e:按稳定身份去重,不按会抖的明细),实得 ${keys.join(' | ')}`)
  assert.match(keys[0], /shell-land/, '身份要认得出是哪条腿')
  assert.match(keys[0], /tier=/, '身份要带持续档(跨档才可重报,越拖越响是有意设计)')
})

test('S3 取到确定结论 ⇒ 撤掉在册起点(不背着旧账到人)', () => {
  const f = fixture()
  const { logger } = logsOf()
  const mails = []
  const notify = (title, message, opts) => mails.push({ title, message, opts })
  const boom = () => ({ ok: false, out: '', err: 'boom', status: 2 })
  // 门槛给 1 小时:单轮瞎 ⇒ 只报名;然后取到确定结论 ⇒ 起点必须被撤
  sweepCrossEndShellPages({
    ...f,
    logger,
    notify,
    undetHorizonMs: 60 * 60 * 1000,
    runner: boom,
    now: 1_700_000_000_000,
  })
  assert.ok(existsSync(f.undetFile), '瞎了一轮应当留下在册起点')
  sweepCrossEndShellPages({
    ...f,
    logger,
    notify,
    undetHorizonMs: 60 * 60 * 1000,
    runner: runnerOf({ summary: { state: 'clean', planned: 0, refused: 13, cap: 2 } }),
    now: 1_700_000_000_000 + 31 * 60 * 1000,
  })
  assert.equal(mails.length, 0, '只瞎了一轮、下轮取到确定结论 ⇒ 不该到人')
  assert.ok(!existsSync(f.undetFile), `在册起点应被撤掉(否则下一场停摆一开局就够格寄信):${f.undetFile}`)
})

test('S3b 常态(无连击在册)取到结论 ⇒ 不写日志(三腿每轮都清一次会把日志淹成噪声)', () => {
  const f = fixture()
  const { logs, logger } = logsOf()
  sweepCrossEndShellPages({
    ...f,
    logger,
    notify: () => {},
    runner: runnerOf({ summary: { state: 'clean', planned: 0, refused: 13, cap: 2 } }),
  })
  assert.equal(
    logs.filter((l) => /撤掉在册的未判定连击|清零/.test(l)).length,
    0,
    '没有连击在册时不该报"已清零"',
  )
})

test('S4 未知腿 ⇒ 拒绝判定,既不寄信也不冒充已判', () => {
  const mails = []
  const r = noteCrossEndUndetermined('nonsense-leg', 'x', {
    logger: () => {},
    notify: (t, m, o) => mails.push({ t, m, o }),
    horizonMs: 0,
  })
  assert.equal(mails.length, 0)
  assert.equal(r.mailed, false)
  assert.match(String(r.why), /未知腿/)
  assert.equal(settleCrossEndLeg('nonsense-leg', { logger: () => {} }), false)
})

test('S5 装车锁:三条腿的"记连击"与"撤起点"必须在各自函数体内共位', () => {
  for (const fn of ['auditCrossEndParityDrift', 'healCrossEndMirror', 'sweepCrossEndShellPages']) {
    const start = HEAD_SRC.search(new RegExp(`^(?:export )?(?:async )?function ${fn}\\b`, 'm'))
    assert.ok(start >= 0, `${fn} 定义消失(S5 要重写,而不是静默失配)`)
    const next = HEAD_SRC.slice(start + 1).search(/^(?:export )?(?:async )?function /m)
    const body = next < 0 ? HEAD_SRC.slice(start) : HEAD_SRC.slice(start, start + 1 + next)
    assert.match(body, /noteCrossEndUndetermined\(/, `${fn}:瞎了没人知道 = 本票要治的那一型`)
    assert.match(body, /settleCrossEndLeg\(/, `${fn}:取到结论不清起点 = 下一轮必假报警`)
  }
  assert.match(HEAD_SRC, /IHUI_CROSS_END_UNDET_HORIZON_MS/, '门槛必须可由 env 覆盖(值守场景要能调)')
})

test('C1 契约锁:调度器读的 summary 键真存在于造页器 --json 现读出口', () => {
  const out = execFileSync(process.execPath, [LANDER, '--json', '--cap=1'], {
    encoding: 'utf8',
    maxBuffer: 1 << 26,
    timeout: 300000,
    stdio: ['ignore', 'pipe', 'pipe'],
    windowsHide: true,
  })
  const a = out.indexOf('{')
  const b = out.lastIndexOf('}')
  assert.ok(a >= 0 && b > a, `造页器 --json 没吐 JSON,末行:${out.split('\n').filter(Boolean).slice(-1)[0] ?? ''}`)
  const summary = JSON.parse(out.slice(a, b + 1)).summary
  for (const k of ['state', 'planned', 'batch', 'blobs', 'refused', 'cap']) {
    assert.ok(Object.hasOwn(summary, k), `造页器 --json 的 summary 缺键 ${k} ⇒ 调度器读的是手抄形状`)
  }
  assert.ok(
    ['clean', 'pending', 'landed', 'blocked', 'undetermined'].includes(summary.state),
    `造页器报了未知 state=${summary.state} ⇒ 调度器的分档会静默落进 else`,
  )
})
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
