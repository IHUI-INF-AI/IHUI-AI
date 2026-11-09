// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * 排队 / 执行分段计时(2026-11-07 立;2026-11-09 自归档线 1d885516e9 的用例文件
 * gate-timeout-budget.test.mjs 中抽出 —— 其余用例锁的是弃用的双键取表 lib,不落)。
 *
 * 病灶原文:真实推送日志里 T1 `300021ms` 被 300s 掐掉,而那 300s 里有一部分是在等
 * 「另一全量 typecheck 进行中(pid 39560)」。排队时间被算成执行时间 ⇒ 别人忙被读成"代码红"。
 * 下面几条直接跑真实子进程验真实现(gate-phase-watchdog),不复刻一份逻辑。
 */

import { spawn } from 'node:child_process'
import assert from 'node:assert/strict'
import { test } from 'node:test'

import {
  createGatePhaseWatchdog,
  RUN_START_MARKER,
  WAIT_LOCK_MARKER,
} from '../lib/gate-phase-watchdog.mjs'
import {
  crashNextStep,
  decideGateOutcome,
  fallbackCodeOfReason,
} from '../lib/gate-failure-kind.mjs'
import { shouldPropagateAsInterrupt } from '../lib/signal-exit.mjs'

/** 起子进程:markerAtMs<=0 表示开跑即打 run-start,否则延时打;exitAtMs 退出。 */
function runPhaseChild({ markerAtMs = null, exitAtMs, phase, runLimitMs, waitLimitMs }) {
  return new Promise((resolve) => {
    const parts = []
    if (markerAtMs !== null) {
      parts.push(
        markerAtMs <= 0
          ? `console.log('${RUN_START_MARKER}')`
          : `setTimeout(() => console.log('${RUN_START_MARKER}'), ${markerAtMs})`,
      )
    }
    parts.push(`setTimeout(() => process.exit(0), ${exitAtMs})`)
    const child = spawn(process.execPath, ['-e', parts.join(';')], {
      stdio: ['ignore', 'pipe', 'pipe'],
      windowsHide: true,
    })
    const spawnedAt = Date.now()
    let finished = false
    const finish = (code) => {
      if (finished) return
      finished = true
      watchdog.finish()
      const t = watchdog.timing(Date.now())
      resolve({ code, waitMs: t.waitMs, runMs: t.runMs, runStarted: watchdog.runStarted() })
      try {
        child.kill('SIGKILL')
      } catch {
        /* 已退出 */
      }
    }
    const watchdog = createGatePhaseWatchdog({
      phase,
      runLimitMs,
      waitLimitMs,
      spawnedAt,
      onExpire: (t) => {
        try {
          child.kill('SIGKILL')
        } catch {
          /* 已退出 */
        }
        finish(t.code)
      },
    })
    child.stdout.on('data', (d) => watchdog.observe(d.toString('utf8')))
    child.on('close', () => finish(null))
    child.on('error', () => finish('spawn-error'))
    watchdog.start()
  })
}

/** 只驱动看门狗(不起子进程):喂若干输出行,等排队上限到点后回传结局。 */
function runWatchdogOnly({ observeLines = [], waitLimitMs, isPidAlive = undefined }) {
  return new Promise((resolve) => {
    const watchdog = createGatePhaseWatchdog({
      phase: true,
      runLimitMs: 1000000,
      waitLimitMs,
      ...(isPidAlive ? { isPidAlive } : {}),
      onExpire: (t) => resolve({ code: t.code, message: t.message }),
    })
    for (const line of observeLines) watchdog.observe(line)
    watchdog.start()
  })
}

test('夹具①:runMs 超限 ⇒ ETIMEDOUT(执行真超时,不是绿、不是排队)', async () => {
  // run-start 开跑即打(同步),执行段 1500ms > 300ms 上限 ⇒ 只能被执行超时掐。
  const r = await runPhaseChild({
    markerAtMs: 0,
    exitAtMs: 1500,
    phase: true,
    runLimitMs: 300,
    waitLimitMs: 5000,
  })
  assert.equal(r.code, 'ETIMEDOUT')
  assert.equal(r.runStarted, true)
  assert.ok(r.runMs >= 300, `runMs 应 ≥ 300,实得 ${r.runMs}`)
  // 同一结局的文案必须点名"超时看门狗",不能落成排队。
  const kind = decideGateOutcome({ code: r.code })
  assert.equal(kind.kind, 'crash')
  assert.match(kind.reason, /超时看门狗/)
})

test('夹具②:waitMs 超限 + 持锁者可验证存活 ⇒ blocked-by-concurrency(可重试未判定)', async () => {
  // 直接驱动真看门狗:先喂 wait-lock(持锁 pid = 本进程,存活;心跳未过期),再等排队上限到点。
  // 不用子进程:排队判定与子进程启动快慢无关,这样夹具不会因 Node 冷启动而抖。
  const r = await runWatchdogOnly({
    observeLines: [`${WAIT_LOCK_MARKER} pid=${process.pid} ts=${Date.now()} staleMs=5000`],
    waitLimitMs: 300,
  })
  assert.equal(r.code, 'BLOCKED_BY_CONCURRENCY')
  assert.match(r.message, /blocked-by-concurrency/)
  assert.match(r.message, /存活且心跳未过期/)
  const kind = decideGateOutcome({ code: r.code })
  assert.equal(kind.kind, 'crash')
  assert.match(kind.reason, /blocked-by-concurrency/)
  assert.equal(fallbackCodeOfReason(kind.reason), 'BLOCKED_BY_CONCURRENCY')
  assert.match(crashNextStep(kind.reason), /可重试/)
  // 后果不变量:排队超限不得被传播成 exit 75(那会变成"自动重试放行"),
  // 与 ETIMEDOUT / ENOBUFS 同档 —— 仍计失败、仍非零退出,只是文案说清"可重试"。
  const be = Object.assign(new Error('x'), { code: 'BLOCKED_BY_CONCURRENCY' })
  assert.equal(shouldPropagateAsInterrupt(be), false)
  // 独立判据:两个码的措辞不许互相覆盖。
  assert.notEqual(kind.reason, decideGateOutcome({ code: 'ETIMEDOUT' }).reason)
})

test('夹具②b:排队超限但拿不出持锁证据 ⇒ fail-closed 判 ETIMEDOUT,不是免责牌', async () => {
  // 没有 wait-lock ⇒ 无法证明"在等" ⇒ 只能按卡死/跑不起来。
  const r = await runWatchdogOnly({ observeLines: [], waitLimitMs: 300 })
  assert.equal(r.code, 'ETIMEDOUT')
  assert.match(r.message, /无可验证的持锁证据/)
  const kind = decideGateOutcome({ code: r.code })
  assert.match(kind.reason, /超时看门狗/)
  assert.equal(fallbackCodeOfReason(kind.reason), 'ETIMEDOUT')
})

test('夹具②c:持锁心跳已过期 ⇒ 同样不许判 blocked', async () => {
  const r = await runWatchdogOnly({
    observeLines: [`${WAIT_LOCK_MARKER} pid=${process.pid} ts=${Date.now() - 60000} staleMs=1000`],
    waitLimitMs: 300,
  })
  assert.equal(r.code, 'ETIMEDOUT')
  assert.match(r.message, /心跳已过期/)
})

test('夹具②d:持锁进程已死 ⇒ 同样不许判 blocked', async () => {
  const r = await runWatchdogOnly({
    observeLines: [`${WAIT_LOCK_MARKER} pid=424242 ts=${Date.now()} staleMs=5000`],
    waitLimitMs: 300,
    isPidAlive: () => false,
  })
  assert.equal(r.code, 'ETIMEDOUT')
  assert.match(r.message, /已不存活/)
})

test('夹具③:waitMs 与 runMs 都正常 ⇒ 绿(两段分别计时)', async () => {
  const r = await runPhaseChild({
    markerAtMs: 0,
    exitAtMs: 400,
    phase: true,
    runLimitMs: 5000,
    waitLimitMs: 5000,
  })
  assert.equal(r.code, null)
  assert.equal(r.runStarted, true)
  assert.ok(r.waitMs >= 0 && r.waitMs < 5000, `waitMs 应在 [0,5000),实得 ${r.waitMs}`)
  assert.ok(r.runMs >= 100, `runMs 应 ≥ 100,实得 ${r.runMs}`)
  const kind = decideGateOutcome({ status: 0, signal: null })
  assert.equal(kind.kind, 'pass')
})
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
