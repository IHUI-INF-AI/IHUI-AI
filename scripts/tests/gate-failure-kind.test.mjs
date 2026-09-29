// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * `scripts/lib/gate-failure-kind.mjs` 的镜像测试(§22c:测试直接 import 源函数,不复制判据)。
 *
 * 为什么值得单独一票:2026-09-29 我在干净检出里跑整批守门,读到"17 道 blocking 门失败",
 * 逐道在有依赖的主仓复跑却全部 rc=0 —— 单跑一道看到的是一行
 * `Error [ERR_MODULE_NOT_FOUND]: Cannot find package 'opencc-js' …`。
 * runner 把"跑不起来"和"判红"记成同一件事,我就差点把一次 import 失败登记成"10 道语言包缺陷"。
 *
 * 三条硬约束各有正反例(缺一即判据无牙):
 *  - 崩溃 ⇒ crash,**但仍算失败**(不得把没跑成的门洗成通过);
 *  - 门自己打印的 `❌ 发现 N 处违规` ⇒ 必须还是 red(不得借"分流"给判据开后门);
 *  - 中断族(75 / 128+N / 只有 signal)⇒ interrupt,与 G-611 的传播语义同形。
 */
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync, writeFileSync } from 'node:fs'
import { spawnSync } from 'node:child_process'
import { fileURLToPath } from 'node:url'
import { resolve } from 'node:path'

// 夹具唯一落点(AGENTS §26):不写 os.tmpdir()。
import { mkScratch, rmScratch } from '../lib/scratch-dir.mjs'

import { __test__ as gateFail } from '../lib/gate-failure-kind.mjs'

const REAL_CRASH_STDERR =
  "Error [ERR_MODULE_NOT_FOUND]: Cannot find package 'opencc-js' imported from G:\\IHUI-AI-wt-crash\\scripts\\scan-i18n-zh-residue.mjs\n" +
  '    at Object.getPackageJSONURL (node:internal/modules/package_json_reader:301:9)\n' +
  '    at moduleResolve (node:internal/modules/esm/resolve:768:8)\n' +
  '\n' +
  'Node.js v24.19.0\n'

const GATE_VERDICT_STDERR =
  '❌ 发现 3 处 ko.json 中文残留:\n  - aiChat.toast.orgSaved: "已保存"\n用法: node scripts/scan-i18n-zh-residue.mjs <locale>\n'

test('C1 真仓崩溃文本 ⇒ crash,且 reason 点名指纹(不是"通过")', () => {
  const d = gateFail.decideGateOutcome({ status: 1, signal: null, stderr: REAL_CRASH_STDERR })
  assert.equal(d.kind, 'crash')
  assert.match(d.reason, /ERR_MODULE_NOT_FOUND/)
})

test('C2 门自己打印的判红 ⇒ 必须仍是 red(借分流开后门就是关掉一把尺子)', () => {
  const d = gateFail.decideGateOutcome({ status: 1, signal: null, stderr: GATE_VERDICT_STDERR })
  assert.equal(d.kind, 'red')
  assert.doesNotMatch(GATE_VERDICT_STDERR, gateFail.CRASH_MARKERS[0])
})

test('C3 中断三形态归 interrupt,与退出码语义一致(G-611)', () => {
  assert.equal(gateFail.decideGateOutcome({ status: 75, stderr: '' }).kind, 'interrupt')
  assert.equal(gateFail.decideGateOutcome({ status: 143, stderr: '' }).kind, 'interrupt')
  assert.equal(gateFail.decideGateOutcome({ status: null, signal: 'SIGTERM', stderr: '' }).kind, 'interrupt')
  // 反例:信号死时即使 stderr 里有崩溃指纹也仍归 interrupt(不得让崩溃抢走中断的传播语义)
  assert.equal(
    gateFail.decideGateOutcome({ status: null, signal: 'SIGKILL', stderr: REAL_CRASH_STDERR }).kind,
    'interrupt',
  )
})

test('C4 通过态与"红但无 stderr"两种边界都不误判成崩溃', () => {
  assert.equal(gateFail.decideGateOutcome({ status: 0, stderr: REAL_CRASH_STDERR }).kind, 'pass')
  assert.equal(gateFail.decideGateOutcome({ status: 1, stderr: '' }).kind, 'red')
  assert.equal(gateFail.decideGateOutcome({ status: 1 }).kind, 'red')
  assert.equal(gateFail.decideGateOutcome(undefined).kind, 'red')
})

test('C5 处置动作必须真给出来(光说"未判定"不写怎么清偿 = 下一条又会误读)', () => {
  const line = gateFail.crashAdvisory(3)
  assert.match(line, /3 道/)
  assert.match(line, /pnpm install/)
  assert.match(line, /--filter/, '必须写明**不带 --filter**(§12e 的剪枝坑)')
})

test('C6 装车:runner 必须真调这把尺子,并把崩溃单独成档(判函数体,不判相邻文本窗口)', () => {
  const here = resolve(fileURLToPath(import.meta.url), '../../..')
  const src = readFileSync(resolve(here, 'scripts/guardian-runner.mjs'), 'utf-8')
  assert.match(src, /from '\.\/lib\/gate-failure-kind\.mjs'/, 'runner 没引这把尺子')
  assert.match(src, /decideGateOutcome\(\{/, '引了却没调用 = 提交链上一路绿灯')
  assert.match(src, /crashedGates\.push\(/, '崩溃没被单独成档')
  assert.match(src, /crashAdvisory\(/, '汇总里没给处置动作')
  // 方向锁:崩溃那一支不得把门塞进 failedGates(那才是"判红"名单)
  const from = src.indexOf("if (kind.kind === 'crash')")
  const to = src.indexOf('failedGates.push(', from)
  assert.ok(from > 0 && to > from, '取不到崩溃分支或它后面没有判红支(结构变了?)')
  assert.doesNotMatch(src.slice(from, to), /failedGates\.push\(/, '崩溃被塞进判红名单 = 分流白做')
  // 后果不变量:failed++ 必须在两个子支**之前**,不得演变成"未判定 ⇒ 放行"
  assert.match(
    src,
    /if \(check\.mode === 'blocking'\) \{\s*\n\s*failed\+\+/,
    '失败计数被挪进某一子支 ⇒ 未判定可能不被计失败',
  )
})

test('C7 stderr 必须仍被吐回上游(改 pipe 之后,"子门的话看得见"靠的是这段代码)', () => {
  const here = resolve(fileURLToPath(import.meta.url), '../../..')
  const src = readFileSync(resolve(here, 'scripts/guardian-runner.mjs'), 'utf-8')
  assert.match(
    src,
    /process\.stderr\.write\(gateStderr\)/,
    '没有把捕获到的 stderr 原样写回 ⇒ 判据输出被静默吞掉(比误报更难查)',
  )
  assert.match(src, /stdio: \['ignore', 'inherit', 'pipe'\]/, 'stdio 形态变了要同时回头看那句 write')
})

test('C8 端到端:真派生一个 import 失败的子进程,走与 runner 同一套捕获 ⇒ crash', () => {
  // 不是构造字符串:字符串可以是抄来的,真子进程不能骗人。
  // stdio 形态与 runner 逐字一致,否则这条证明不了 runner 的行为。
  const dir = mkScratch('gfk-e2e-')
  try {
    const crashy = resolve(dir, 'crashy.mjs')
    writeFileSync(crashy, "import 'no-such-package-xyz-8f2b1c'\n", 'utf-8')
    const r = spawnSync(process.execPath, [crashy], {
      windowsHide: true,
      stdio: ['ignore', 'inherit', 'pipe'],
      maxBuffer: 20 * 1024 * 1024,
      encoding: 'utf-8',
    })
    assert.notEqual(r.status, 0, '子进程应非零退出')
    const d = gateFail.decideGateOutcome({
      status: r.status ?? null,
      signal: r.signal ?? null,
      stderr: r.stderr ?? '',
    })
    assert.equal(d.kind, 'crash', `真崩溃被读成了 ${d.kind};stderr=${String(r.stderr).slice(0, 160)}`)
    assert.match(d.reason, /ERR_MODULE_NOT_FOUND/)

    // 同一套捕获下,exit 1 但**不崩溃**的子进程必须仍判 red(不得把判红也分流掉)
    const red = resolve(dir, 'red.mjs')
    writeFileSync(red, "console.error('❌ 发现 2 处违规'); process.exit(1)\n", 'utf-8')
    const r2 = spawnSync(process.execPath, [red], {
      windowsHide: true,
      stdio: ['ignore', 'inherit', 'pipe'],
      encoding: 'utf-8',
    })
    assert.equal(
      gateFail.decideGateOutcome({
        status: r2.status ?? null,
        signal: r2.signal ?? null,
        stderr: r2.stderr ?? '',
      }).kind,
      'red',
      '判据自己打印的红被分流成别的档 = 借修 bug 关掉一把尺子',
    )
  } finally {
    rmScratch(dir)
  }
})
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
