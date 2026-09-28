// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

// G-611 镜像测试 —— scripts/lib/signal-exit.mjs(信号退出码 128+N 的产出/消费同一把尺子)。
//
// 为什么不复制判据(§22c):所有断言直接 import 源函数;测试里抄一份实现 = 源改了测试仍绿
// = 测试从防线变成缺陷的掩体(本仓记过多次)。
//
// 本票的验收原文是"父侧读到 143 判'临时失败'的闭环用例":
//   T6 用真子进程走完整条链 —— 子进程装产出侧、触发**已注册的监听器**(与内核投递同一条
//   EventEmitter 路径)、进程以 143 退出;父侧 spawnSync 读到 r.status===143 且 r.signal
//   为 null(码是"产出的",不是"死于信号"),再喂回共享分类器得 interrupt ⇒ 75。
//   T7 补真内核投递臂(仅 POSIX)。Windows 上 process.kill(SIGTERM) = TerminateProcess,
//   监听器机制性不跑 —— T7 按实测边界跳过并写明理由,T6 覆盖的正是同一监听器与同一个闩。
import assert from 'node:assert/strict'
import { spawnSync } from 'node:child_process'
import { readFileSync, writeFileSync, readdirSync, statSync } from 'node:fs'
import { dirname, join, resolve } from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'
import test from 'node:test'

import { mkScratch, rmScratch } from '../lib/scratch-dir.mjs'
import {
  DEFAULT_PRODUCED_SIGNALS,
  INTERRUPT_EXIT_CODES,
  SIGNAL_EXIT_NUMBERS,
  SIGNAL_EXIT_OFFSET,
  TEMPFAIL_EXIT_CODE,
  WINDOWS_CTRL_C_EXIT_CODE,
  classifySpawnOutcome,
  exitCodeForSignal,
  installSignalExit,
  interruptReason,
  isInterruptExitCode,
  shouldPropagateAsInterrupt,
} from '../lib/signal-exit.mjs'

const HERE = dirname(fileURLToPath(import.meta.url))
const ROOT = resolve(HERE, '..', '..')
const LIB = join(ROOT, 'scripts', 'lib', 'signal-exit.mjs')
const CHECK_TYPECHECK = join(ROOT, 'scripts', 'check-typecheck.mjs')
const TYPECHECK_FULL = join(ROOT, 'scripts', 'typecheck-full.mjs')
const GUARDIAN_RUNNER = join(ROOT, 'scripts', 'guardian-runner.mjs')
const API_TS_MODULE = join(ROOT, 'apps', 'api', 'src', 'lib', 'shutdown-signals.ts')
const API_INDEX_TS = join(ROOT, 'apps', 'api', 'src', 'index.ts')

// ─── 表与集合 ────────────────────────────────────────────────────────

test('T1 信号名 → 128+N 的映射;表外信号返回 null,绝不猜一个数冒充', () => {
  assert.equal(SIGNAL_EXIT_OFFSET, 128)
  assert.equal(exitCodeForSignal('SIGINT'), 130)
  assert.equal(exitCodeForSignal('SIGTERM'), 143)
  assert.equal(exitCodeForSignal('SIGHUP'), 129)
  assert.equal(exitCodeForSignal('SIGKILL'), 137) // 不可捕获,映射值供中转码对账
  assert.equal(exitCodeForSignal('SIGPIPE'), 141)
  // Windows 的 SIGBREAK(Ctrl+Break)没有 POSIX 编号,原生就是那条 NTSTATUS
  assert.equal(exitCodeForSignal('SIGBREAK'), WINDOWS_CTRL_C_EXIT_CODE)
  assert.equal(exitCodeForSignal('NOT_A_SIGNAL'), null)
  assert.equal(exitCodeForSignal(undefined), null)
})

test('T2 消费侧集合逐字保持原位(check-typecheck.mjs:454 的五个码,一位不加减)', () => {
  assert.deepEqual(
    [...INTERRUPT_EXIT_CODES].sort((a, b) => a - b),
    [130, 137, 141, 143, 3221225786],
  )
  // 阳性对照:事故当轮那枚被误判成"结论失败"的码必须被认作中断
  assert.equal(isInterruptExitCode(3221225786), true)
  assert.equal(isInterruptExitCode(143), true)
  // 反向对照:有结论的失败与 pass 不得被集合吞掉
  assert.equal(isInterruptExitCode(0), false)
  assert.equal(isInterruptExitCode(1), false)
  assert.equal(isInterruptExitCode(2), false)
  assert.equal(isInterruptExitCode(null), false, 'null 不是整数,不得靠 truthy 混进集合判据')
  assert.equal(isInterruptExitCode('143'), false, '字符串码不得被松判吞掉')
})

test('T3 规矩 2(机判,非散文):产出侧默认清单产出的每个码,消费侧必须认得', () => {
  for (const sig of DEFAULT_PRODUCED_SIGNALS) {
    const code = exitCodeForSignal(sig)
    assert.notEqual(code, null, `${sig} 在默认清单里却没有映射 —— 产出的会是兜底 1`)
    assert.ok(
      INTERRUPT_EXIT_CODES.has(code),
      `${sig} 产出 ${code} 却不在消费侧集合里 —— 装了产出侧也没人认,正是本票的分叉`,
    )
  }
})

// ─── 分类与传播 ──────────────────────────────────────────────────────

test('T4 classifySpawnOutcome 四态 + 优先级:timeout > pass > interrupt > verdict', () => {
  const cls = (over) => classifySpawnOutcome({ status: null, signal: null, ...over })
  assert.equal(cls({ status: 0 }).kind, 'pass')
  assert.equal(cls({ status: 0, timedOut: true }).kind, 'timeout', '超时优先(2026-09-20 语义逐字保留)')
  assert.equal(cls({ status: 143, timedOut: true }).kind, 'timeout', '族码也不许盖过超时判定')
  assert.equal(cls({ status: 143 }).kind, 'interrupt')
  assert.equal(cls({ status: 3221225786 }).kind, 'interrupt')
  assert.equal(cls({ status: null, signal: 'SIGTERM' }).kind, 'interrupt', '无码只有 signal ⇒ 被杀 ≠ 结论(规矩 3)')
  assert.equal(cls({ status: 2 }).kind, 'verdict', '有结论的失败不得被洗成中断')
  assert.equal(cls({ status: 2 }).exitCode, 2, 'verdict 原码照传')
  assert.equal(cls({ status: 143 }).exitCode, TEMPFAIL_EXIT_CODE)
  assert.equal(cls({ timedOut: true }).exitCode, 1, '超时按普通失败(1),刻意不占 75 重试位')
})

test('T5 shouldPropagateAsInterrupt 三格归中断、其余不动;interruptReason 只当话不参与判定', () => {
  assert.equal(shouldPropagateAsInterrupt({ status: 75, signal: null }), true, '原有 75 语义逐字保留')
  assert.equal(shouldPropagateAsInterrupt({ status: 143, signal: null }), true)
  assert.equal(shouldPropagateAsInterrupt({ status: null, signal: 'SIGTERM' }), true)
  assert.equal(shouldPropagateAsInterrupt({ status: 1, signal: null }), false)
  assert.equal(shouldPropagateAsInterrupt({ status: 1, signal: 'SIGTERM' }), false, '有码即有码说话,只有无码才退到 signal')
  assert.equal(shouldPropagateAsInterrupt(null), false)
  assert.equal(shouldPropagateAsInterrupt(undefined), false)
  assert.equal(shouldPropagateAsInterrupt('boom'), false)
  assert.match(interruptReason({ status: 75 }), /75/)
  assert.match(interruptReason({ status: 143 }), /143/)
  assert.match(interruptReason({ status: null, signal: 'SIGKILL' }), /SIGKILL/)
})

// ─── 产出侧安装器 ────────────────────────────────────────────────────

test('T6 安装器闩与 dispose(进程内):监听器只产一次码,dispose 后不再挂钩', () => {
  const before = process.listenerCount('SIGTERM')
  const calls = []
  // 控制台临时静音:被测行为是"退出码",不是那行日志(日志断链也绝不能挡住退出 —— 见实现)
  const origErr = console.error
  console.error = () => {}
  try {
    const inst = installSignalExit({
      label: 'unit',
      signals: ['SIGTERM'],
      exitFn: (c) => calls.push(c),
    })
    assert.deepEqual(inst.installed, ['SIGTERM'])
    assert.equal(process.listenerCount('SIGTERM'), before + 1)
    inst.handle('SIGTERM')
    inst.handle('SIGTERM')
    assert.deepEqual(calls, [143], '第二下不得重复产出(再入闩)')
    // EventEmitter 真路径:emit 的就是内核投递时走的那条事件
    process.emit('SIGTERM')
    assert.deepEqual(calls, [143], 'emit 触达同一监听器,仍被闩挡住')
    inst.dispose()
    assert.equal(process.listenerCount('SIGTERM'), before, 'dispose 必须把监听器摘干净')
    process.emit('SIGTERM')
    assert.deepEqual(calls, [143], 'dispose 后监听器不再挂钩')
  } finally {
    console.error = origErr
  }
})

test('T7 onSignal 抛错不得吃掉退出码(清场是尽力而为,码才是结论)', () => {
  const calls = []
  const origErr = console.error
  console.error = () => {}
  try {
    const inst = installSignalExit({
      label: 'unit',
      signals: ['SIGTERM'],
      onSignal: () => {
        throw new Error('清场炸了')
      },
      exitFn: (c) => calls.push(c),
    })
    inst.handle('SIGTERM')
    assert.deepEqual(calls, [143])
    inst.dispose()
  } finally {
    console.error = origErr
  }
})

// ─── 票面验收:进程级闭环 ────────────────────────────────────────────

function runLoopChild({ trigger }) {
  const dir = mkScratch('signal-exit-loop-')
  try {
    const child = join(dir, 'child.mjs')
    writeFileSync(
      child,
      [
        `import { installSignalExit } from ${JSON.stringify(pathToFileURL(LIB).href)}`,
        `installSignalExit({ label: 'loop-fixture' })`,
        `process.emit(${JSON.stringify(trigger)})`,
        // 触发没发生就永远到不了 99/挂死 —— 三种结局彼此可辨,闭环不接受"看不出跑没跑"
        `setTimeout(() => process.exit(99), 4000)`,
      ].join('\n'),
    )
    return spawnSync(process.execPath, [child], {
      encoding: 'utf8',
      timeout: 60_000,
      windowsHide: true,
    })
  } finally {
    rmScratch(dir)
  }
}

test('T8 闭环用例(票面验收原文"父侧读到 143 判临时失败"的进程臂):子进程产出 143,父侧读码分类归 75', () => {
  const r = runLoopChild({ trigger: 'SIGTERM' })
  assert.equal(r.status, 143, `子进程必须按产出码退出(实得 status=${r.status} signal=${r.signal}):\n${r.stderr}`)
  assert.equal(r.signal, null, '死于信号 ≠ 产出码 —— 本票的病根就是这两者不可分')
  const outcome = classifySpawnOutcome({ status: r.status, signal: r.signal })
  assert.equal(outcome.kind, 'interrupt')
  assert.equal(outcome.exitCode, TEMPFAIL_EXIT_CODE)
  assert.equal(shouldPropagateAsInterrupt({ status: r.status, signal: r.signal }), true)
})

test('T8b 闭环第二臂 SIGINT ⇒ 130:产出的码随信号而变,集合逐码认得', () => {
  const r = runLoopChild({ trigger: 'SIGINT' })
  assert.equal(r.status, 130, `实得 status=${r.status} signal=${r.signal}:\n${r.stderr}`)
  assert.equal(r.signal, null)
  assert.equal(classifySpawnOutcome({ status: r.status }).kind, 'interrupt')
})

test('T9 真内核投递臂(仅 POSIX):process.kill(self,SIGTERM) ⇒ 同一监听器 ⇒ 143', {
  // Windows 上这不是"跑不通的出路"而是实测边界:process.kill(SIGTERM)=TerminateProcess,
  // 监听器机制性不跑。T8/T8b 从 EventEmitter 入口覆盖了同一 handle,这一臂补
  // "libuv 真投递 → 同一条链" 那一格 —— 边界如实报出,不静默。
  skip: process.platform === 'win32' ? 'Windows 无 SIGTERM 投递(见测试体注释);emit 臂 T8/T8b 覆盖同一监听器' : false,
}, () => {
  const dir = mkScratch('signal-exit-real-')
  try {
    const child = join(dir, 'child.mjs')
    writeFileSync(
      child,
      [
        `import { installSignalExit } from ${JSON.stringify(pathToFileURL(LIB).href)}`,
        `installSignalExit({ label: 'real-fixture' })`,
        `process.kill(process.pid, 'SIGTERM')`,
        `setTimeout(() => process.exit(99), 4000)`,
      ].join('\n'),
    )
    const r = spawnSync(process.execPath, [child], { encoding: 'utf8', timeout: 60_000, windowsHide: true })
    assert.equal(r.status, 143, `实装投递必须产出 143(实得 status=${r.status} signal=${r.signal}):\n${r.stderr}`)
    assert.equal(r.signal, null)
  } finally {
    rmScratch(dir)
  }
})

// ─── 装车形状锁(§22c:判据在、没接线 = 没有)────────────────────────

test('T10 产出侧必须真装在两个被派生方(门在判"被杀≠结论",被杀的一方必须把码产出来)', () => {
  const full = readFileSync(TYPECHECK_FULL, 'utf8')
  const ct = readFileSync(CHECK_TYPECHECK, 'utf8')
  assert.match(full, /from '\.\/lib\/signal-exit\.mjs'/, 'typecheck-full 没引共享尺子')
  assert.match(full, /installSignalExit\(\{[^)]*label: 'typecheck:full'/, "typecheck-full 没装产出侧(或换了 label 没同步本锁)")
  assert.match(ct, /installSignalExit\(\{[\s\S]{0,200}label: 'check-typecheck'/, 'check-typecheck 没装产出侧')
  // 全量分支的在飞子进程必须被接进清场(装了产出侧但 onSignal 不摘子进程 = 孤儿树回归)
  assert.match(ct, /streamChild = child/, '全量分支没把在飞 child 交给信号处理器')
  assert.match(ct, /onSignal: \(\) => killChildTree\(streamChild\)/)
})

test('T11 消费侧三处必须用同一把尺子,字面量集合全仓只许住在 lib 一处', () => {
  const ct = readFileSync(CHECK_TYPECHECK, 'utf8')
  const runner = readFileSync(GUARDIAN_RUNNER, 'utf8')
  assert.match(ct, /from '\.\/lib\/signal-exit\.mjs'/)
  assert.match(ct, /classifySpawnOutcome\(\{/, 'check-typecheck 的 close 分类没接共享尺子')
  assert.match(ct, /fastOutcome/, '定向快通道没做中断分类(全量臂与快通道臂不得只装一边)')
  assert.match(runner, /from '\.\/lib\/signal-exit\.mjs'/)
  assert.match(runner, /shouldPropagateAsInterrupt\(e\)/, 'guardian-runner 没把族码/无码信号死归中断')
  assert.ok(
    !/e && e\.status === 75/.test(runner),
    'runner 的回退形态(只认 75)不得回来 —— 那正是 runner 层的归因分叉',
  )
  // 全仓唯一一份 `new Set([130`:递归 scripts/*.mjs(排除 tests 自身与 node_modules)
  const hits = []
  const walk = (d) => {
    for (const name of readdirSync(d)) {
      if (name === 'node_modules') continue
      const p = join(d, name)
      const st = statSync(p)
      if (st.isDirectory()) walk(p)
      else if (name.endsWith('.mjs') && /new Set\(\[130/.test(readFileSync(p, 'utf8'))) hits.push(p)
    }
  }
  walk(join(ROOT, 'scripts'))
  assert.deepEqual(
    hits.map((p) => p.replace(/\\/g, '/')).filter((p) => !p.includes('/tests/')),
    [(LIB.replace(/\\/g, '/'))],
    '集合出现了第二份(或 lib 里那份被搬走)—— 两处实现必漂移',
  )
})

test('T12 apps/api 的 once 形态不得回来;index.ts 必须真用带闩的 process.on', () => {
  const idx = readFileSync(API_INDEX_TS, 'utf8')
  assert.ok(!/process\.once\(\s*['"]SIG/.test(idx), 'process.once 注册回来了:第二下信号又将落回无码默认死法')
  assert.match(idx, /createShutdownSignalHandler\(/)
  assert.match(idx, /process\.on\(\s*'SIGTERM'/)
  assert.match(idx, /process\.on\(\s*'SIGINT'/)
})

test('T13 跨语言同表对账:apps/api 的 SIGNAL_EXIT_NUMBERS 与 JS 侧逐键逐值等值(两处算同一件事)', () => {
  const ts = readFileSync(API_TS_MODULE, 'utf8')
  // 字符类必须含数字:SIGUSR1/SIGUSR2 的名字带数字,[A-Z]+ 会在数字处断掉
  // 并把整行静默漏过 —— "扫到 0/扫到 13"都长得像通过,这条由 T13b 反向对照钉住。
  const parsed = new Map(
    [...ts.matchAll(/^\s*(SIG[A-Z0-9]+):\s*(\d+),$/gm)].map((m) => [m[1], Number(m[2])]),
  )
  assert.ok(parsed.size >= 10, `TS 表解析到 ${parsed.size} 条 —— 形状漂了,本锁失明`)
  const js = new Map(Object.entries(SIGNAL_EXIT_NUMBERS))
  assert.deepEqual([...parsed.keys()].sort(), [...js.keys()].sort(), '两侧信号集不同名 —— 新增没同笔')
  for (const [k, v] of parsed) assert.equal(js.get(k), v, `${k} 两侧编号不同`)
  assert.match(ts, /SIGNAL_EXIT_OFFSET = 128/)
  assert.match(ts, /SIGNAL_EXIT_OFFSET \+ n/, 'TS 侧必须同样是 128+N,不是抄好的死码')
})

test('T13b 解析器的牙(反向对照):不含数字的窄字符类必漏 SIGUSR1/SIGUSR2 ⇒ T13 的字符类必须含 [0-9] 才可信', () => {
  const ts = readFileSync(API_TS_MODULE, 'utf8')
  const narrow = [...ts.matchAll(/^\s*(SIG[A-Z]+):\s*(\d+),$/gm)].map((m) => m[1])
  assert.ok(!narrow.includes('SIGUSR1') && !narrow.includes('SIGUSR2'), '窄正则竟吃到了 USR 档 ⇒ 本对照的前提漂了')
  const wide = [...ts.matchAll(/^\s*(SIG[A-Z0-9]+):\s*(\d+),$/gm)].map((m) => m[1])
  assert.ok(wide.includes('SIGUSR1') && wide.includes('SIGUSR2'), '宽字符类也没吃到 ⇒ T13 的两侧对账在这一格失明')
})
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
