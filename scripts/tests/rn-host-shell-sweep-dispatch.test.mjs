// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * RN 薄壳补壳腿(`sweepRnHostShells`)的镜像测试。
 *
 * 立因:`gen-rn-host-shell.mjs`(2026-10-28 立)把「接一枚新共享屏要手抄百行样板」变成一条命令,
 * 但接线当刻全仓检索只命中它自己 —— 零派发点(§0.9「造好没装车 = 没有」)。链条三段里只有
 * 第一格无人调度,而下游 `gen-miniapp-mirror` 的三腿判据要问的正是「RN 腿在不在」⇒ 上游不动,
 * 下游每轮拒产,整条链的失效形态是安静。
 *
 * 钉死六件事:
 *   T1 有产出 ⇒ 绿行点名「写出/待补/需人工」读数;
 *   T2 无待补壳 ⇒ ok=true 且读数仍要打(不打就分不清"跑了且没活"与"没跑");
 *   T3 结论行取不到 ⇒ 记未判定、ok=false,绝不折成"无需补壳"(§0.3);
 *   T4 节流窗口内不派生第二次;
 *   T5 装车锁 ⇒ 定义在、调用挂在巡检轮体内(邻接判据,两端各被提及不算接线)、节流可 env 覆盖;
 *   C1 契约锁 ⇒ 调度器解析的结论行格式,必须真能在造页器现读输出里匹配到(不手抄形状)。
 */
import { strict as assert } from 'node:assert'
import { execFileSync } from 'node:child_process'
import { readFileSync } from 'node:fs'
import { join, resolve } from 'node:path'
import test from 'node:test'

import { sweepRnHostShells } from '../git-guardian.mjs'
import { mkScratch } from '../lib/scratch-dir.mjs'

const REPO = resolve(import.meta.dirname, '..', '..')
const GENERATOR = resolve(import.meta.dirname, '..', 'gen-rn-host-shell.mjs')
const STDIO = ['ignore', 'pipe', 'pipe']

/** T5 判的是"这一腿到底装车没有"⇒ 必须读 HEAD 面(盘上副本可能滞后,§0.4 同面同轮)。 */
const headSrc = (rel) =>
  execFileSync('git', ['show', `HEAD:${rel}`], {
    cwd: REPO,
    encoding: 'utf8',
    maxBuffer: 1 << 26,
    windowsHide: true,
    stdio: STDIO,
  })

const fixture = () => ({ tickFile: join(mkScratch('rn-host-shell-'), 'tick.json') })
const logsOf = () => {
  const logs = []
  return { logs, logger: (m) => logs.push(m) }
}
const runnerOf = (stdout, extra = {}) => () => ({ status: 0, stdout, stderr: '', ...extra })

test('T1 有产出 ⇒ 绿行点名写出/待补/需人工', () => {
  const { logs, logger } = logsOf()
  const r = sweepRnHostShells({
    ...fixture(),
    logger,
    runner: runnerOf(
      '  written apps/mobile-rn/src/screens/DemoScreen.tsx\nGEN-RN-HOST-SHELL state=applied 目标=2 写出=1 跳过=0 需人工=1\n',
    ),
  })
  assert.equal(r.ran, true)
  assert.equal(r.ok, true)
  assert.equal(r.state, 'applied')
  assert.equal(r.wrote, 1)
  assert.equal(r.manual, 1)
  const line = logs.find((l) => /RN 薄壳补壳/.test(l))
  assert.ok(line, '必须留一行读数')
  assert.match(line, /写出 1/)
  assert.match(line, /需人工 1/, 'needs-manual 枚数要进读数 —— 否则"链子中台的屏"被读成"全部自动补齐"')
  assert.doesNotMatch(line, /⚠️/)
})

test('T2 无待补壳 ⇒ ok 且仍打读数(区分"没活"与"没跑")', () => {
  const { logs, logger } = logsOf()
  const r = sweepRnHostShells({
    ...fixture(),
    logger,
    runner: runnerOf('GEN-RN-HOST-SHELL state=applied 目标=0 写出=0 跳过=0 需人工=0\n'),
  })
  assert.equal(r.ok, true)
  assert.equal(r.targets, 0)
  assert.match(logs.find((l) => /RN 薄壳补壳/.test(l)), /待补 0/)
})

test('T3 结论行取不到 ⇒ 未判定,不折成"无需补壳"(§0.3)', () => {
  const { logs, logger } = logsOf()
  const r = sweepRnHostShells({ ...fixture(), logger, runner: runnerOf('') })
  assert.equal(r.ran, true)
  assert.equal(r.ok, false)
  assert.equal(r.state, 'undetermined')
  assert.match(logs.find((l) => /RN 薄壳补壳/.test(l)), /未判定/)
})

test('T3b 子进程被超时掐死 ⇒ 点名 signal 而不是"结论解析不出"', () => {
  const { logs, logger } = logsOf()
  const r = sweepRnHostShells({
    ...fixture(),
    logger,
    runner: () => ({ status: null, signal: 'SIGTERM', stdout: '', stderr: '' }),
  })
  assert.equal(r.ok, false)
  const line = logs.find((l) => /RN 薄壳补壳/.test(l))
  assert.match(line, /SIGTERM/, '超时与"跑完但没打结论"必须分得开(同族腿踩过两次)')
})

test('T4 节流窗口内不派生第二次', () => {
  const f = fixture()
  let calls = 0
  const counting = () => {
    calls += 1
    return { status: 0, stdout: 'GEN-RN-HOST-SHELL state=preview 目标=0 写出=0 跳过=0 需人工=0\n', stderr: '' }
  }
  sweepRnHostShells({ ...f, logger: () => {}, runner: counting, now: 1_000_000 })
  sweepRnHostShells({ ...f, logger: () => {}, runner: counting, now: 1_000_000 + 60_000 })
  assert.equal(calls, 1, '30 分钟节流:一小时内第二次调用不得真派生')
  sweepRnHostShells({ ...f, logger: () => {}, runner: counting, now: 1_000_000 + 31 * 60_000 })
  assert.equal(calls, 2, '过窗必须放行 —— 节流写死不动就等于这条腿停摆')
})

test('T5 装车锁:定义在 HEAD 面、调用挂在巡检轮体内、节流可 env 覆盖', () => {
  const src = headSrc('scripts/git-guardian.mjs')
  assert.match(src, /export function sweepRnHostShells\(/, '函数必须已定义')
  const callRe = /if \(!CHECK_ONLY\) sweepRnHostShells\(\)/
  assert.match(src, callRe, '必须有巡检轮体内的调用')
  // 邻接判据:调用点必须与同族腿(造页闭环 / 手写页升级)写在同一区,不是"文件里另一处提及"
  const callIdx = src.search(callRe)
  const familyIdx = src.search(/if \(!CHECK_ONLY\) sweepCrossEndShellPages\(\)/)
  assert.ok(callIdx >= 0 && familyIdx >= 0)
  assert.ok(
    Math.abs(src.slice(0, callIdx).length - src.slice(0, familyIdx).length) < 400,
    '新腿必须挨着同族腿派 —— 两端各被提及不算接线',
  )
  assert.match(src, /IHUI_RN_HOST_SHELL_INTERVAL_MS/, '值守压节拍要能不改码做到')
})

test('C1 契约锁:调度器解析的结论行,必须真能在造页器现读输出里匹配到', () => {
  const out = execFileSync(process.execPath, [GENERATOR, '--all'], {
    cwd: REPO,
    encoding: 'utf8',
    maxBuffer: 1 << 26,
    windowsHide: true,
    timeout: 5 * 60 * 1000,
    stdio: STDIO,
  })
  // 与调度器体内那把正则逐字同形(改一边必须改另一边,否则本例红)
  const m = /GEN-RN-HOST-SHELL state=(\w+) 目标=(\d+) 写出=(\d+) 跳过=(\d+) 需人工=(\d+)/.exec(out)
  assert.ok(m, `造页器现读输出里取不到结论行形态,尾部=${out.slice(-200)}`)
  assert.ok(['preview', 'applied'].includes(m[1]), `state 档位超出调度器认知:${m[1]}`)
  const genSrc = readFileSync(GENERATOR, 'utf8')
  assert.match(genSrc, /GEN-RN-HOST-SHELL state=/, '结论行必须由生成器自己打,不是测试编的')
})
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
