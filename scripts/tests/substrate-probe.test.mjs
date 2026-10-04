// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * §22c 镜像测试:守门批「地基探针」(scripts/lib/substrate-probe.mjs)。
 *
 * 钉四件事,每条都有反向对照 —— 这条判据的全部价值就在"把没判写成判过了"不许发生:
 *  S1 健康面放过('true')
 *  S2 工作树不可用判不可用,且理由点名得出现(git 答 false 那一型)
 *  S3 **问不到 / 空输出 / 非布尔形态一律判不可用**(不得因为"大概是探针坏了"就当仓库健康)
 *  S4 装车:runner 必须真 import 并在跑批**之前**调用它,且结论走 75(临时失败)而不是 1
 *     —— 否则这条判据只是"函数在、自检过、提交链上从未执行"(守门 70/76/81 同型)。
 */
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { execFileSync } from 'node:child_process'
import { mkScratch, rmScratch } from '../lib/scratch-dir.mjs'
import { resolveGitBin } from '../lib/gitdir.mjs'
import { substrateVerdict, probeSubstrate } from '../lib/substrate-probe.mjs'

const GIT = resolveGitBin()
const git = (args, cwd) =>
  execFileSync(GIT, args, {
    encoding: 'utf8',
    cwd,
    windowsHide: true,
    timeout: 60000,
    // 2026-10-04:不吃的子进程必须给 stdio,否则本机报 spawnSync EBUSY
    stdio: ['ignore', 'pipe', 'pipe'],
  })

const RUNNER = readFileSync(new URL('../guardian-runner.mjs', import.meta.url), 'utf8')

test('S1 健康面:git 答 true ⇒ 可用,且不编理由', () => {
  const v = substrateVerdict(() => 'true\n')
  assert.equal(v.usable, true)
  assert.equal(v.reason, '')
})

test('S2 工作树不可用:答 false ⇒ 不可用并点名得出现的成因', () => {
  const v = substrateVerdict(() => 'false')
  assert.equal(v.usable, false)
  assert.match(v.reason, /core\.bare|工作树不可用/)
})

test('S3 三型"没量到"都不得被读成健康', () => {
  // ① 抛错(git 不可达 / 超时 / .git 正被重建)
  const threw = substrateVerdict(() => {
    throw new Error('fatal: this operation must be run in a work tree')
  })
  assert.equal(threw.usable, false)
  assert.match(threw.reason, /git 问不到/)
  assert.match(threw.reason, /must be run in a work tree/)
  // ② 空输出
  const empty = substrateVerdict(() => '')
  assert.equal(empty.usable, false)
  assert.match(empty.reason, /空输出/)
  // ③ 非布尔形态(指针文件坏了、输出被污染)
  const junk = substrateVerdict(() => 'true-ish')
  assert.equal(junk.usable, false)
  assert.match(junk.reason, /不是布尔形态/)
})

test('S3b ask 缺失也不冒可用(探针自己坏掉 ⇒ 也是"没量到")', () => {
  const v = substrateVerdict(undefined)
  assert.equal(v.usable, false)
})

test('S5 probeSubstrate 只问一次(不在热路径上重复派生 git)', () => {
  let calls = 0
  const v = probeSubstrate({
    run: () => {
      calls += 1
      return 'true'
    },
  })
  assert.equal(v.usable, true)
  assert.equal(calls, 1)
})

test('S4a 装车:runner 必须 import 本层并在跑批之前调用', () => {
  assert.match(RUNNER, /from '\.\/lib\/substrate-probe\.mjs'/)
  /**
   * 调用点必须按**独立一行**认,不能 `indexOf('assertSubstrateUsable()')` ——
   * 那样函数定义行 `function assertSubstrateUsable() {` 里就含这个子串,
   * 把调用整行注释掉测试照样绿(本票实测:突变后 8/8 仍绿,牙齿是假的)。
   */
  const called = /^\s*assertSubstrateUsable\(\)\s*$/m.test(RUNNER)
  assert.ok(called, 'assertSubstrateUsable 定义了却无人调用 = 没有(守门 70/76/81 同型)')
  const loopAt = RUNNER.indexOf('for (const check of effectiveChecks)')
  const callAt = RUNNER.search(/^\s*assertSubstrateUsable\(\)\s*$/m)
  assert.ok(loopAt > 0)
  assert.ok(callAt > 0 && callAt < loopAt, '探针必须在跑批**之前**,排在循环之后就等于让五道门各自去红')
})

test('S4b 结论走 75(临时失败),不得记成"结论失败"逼全队跳门', () => {  const start = RUNNER.indexOf('function assertSubstrateUsable()')
  assert.ok(start > 0)
  const body = RUNNER.slice(start, RUNNER.indexOf('\n}\n', start) + 2)
  assert.match(body, /process\.exit\(TEMPFAIL_EXIT_CODE\)/)
  assert.ok(
    !/process\.exit\(1\)/.test(body),
    '把"仓库答不上话"退出成 1 = 与任何提交都无关的 blocking 红,唯一结局是各会话 --no-verify(§12e/§12f)',
  )
  assert.match(body, /windowsHide:\s*true/, '派生 git 必须带 windowsHide(§5b 弹窗事故)')
  assert.match(body, /timeout:\s*15000/, '只读 git 调用必须封顶(守门 80 口径)')
})

/**
 * S6 真派生对照(不是喂假返回值):在临时**裸仓**里跑一次真实的
 * `git rev-parse --is-inside-work-tree`,必须被判"不可用";回到正常仓必须被判"可用"。
 * 这条是整把尺子的阳性对照 —— 前面几条判的是函数逻辑,而逻辑与 git 的真实回答
 * 之间的接缝(抛错文本、退出码、空输出)只有真派生才量得到。
 * 临时裸仓刻意不是 `core.bare=true` 那场故障的复现,而是它的**同答形态**(git 直接拒答),
 * 判的是"探针在真 git 面前会不会瞎"。
 */
test('S6 真派生:裸仓里必须判不可用,正常仓必须判可用', () => {
  const dir = mkScratch('substrate-probe-')
  try {
    git(['init', '--bare', '-q', dir])
    const bare = probeSubstrate({
      run: () =>
        execFileSync(GIT, ['rev-parse', '--is-inside-work-tree'], {
          cwd: dir,
          encoding: 'utf8',
          timeout: 15000,
          windowsHide: true,
          stdio: ['ignore', 'pipe', 'pipe'],
        }),
    })
    assert.equal(bare.usable, false, '裸仓里 git 不承认工作树 ⇒ 探针必须喊不可用,不得冒可用')
    // 实测 git 在裸仓里答的是 `false`(不是拒答),所以两型都可能:`false` 走"工作树不可用",
    // 抛错走"git 问不到"。断言只要求**给出具体成因**,不接受空 reason —— 报告里说不清原因
    // 的判据,下一个人无从判断是仓库坏了还是探针坏了。
    assert.match(bare.reason, /git 问不到|工作树不可用/)

    const wt = mkScratch('substrate-wt-')
    try {
      git(['init', '-q', '--initial-branch=main', wt])
      const ok = probeSubstrate({
        run: () =>
          execFileSync(GIT, ['rev-parse', '--is-inside-work-tree'], {
            cwd: wt,
            encoding: 'utf8',
            timeout: 15000,
            windowsHide: true,
            stdio: ['ignore', 'pipe', 'pipe'],
          }),
      })
      assert.equal(ok.usable, true, '正常工作树必须判可用(否则本票就是一台恒红门)')
    } finally {
      rmScratch(wt)
    }
  } finally {
    rmScratch(dir)
  }
})
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
