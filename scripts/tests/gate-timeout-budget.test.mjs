// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * 夹具:守门按「门号 + script」取在册超时(2026-11-07)。
 *
 * 背景:land-gate-budgets.json 早登记了门 30a=900s,而 guardian 只读全局 300s
 * ⇒ 台账形同虚设。本夹具锁四件事:
 *   ① 在册门按表值(边界:恰好够 ⇒ 绿,超一格 ⇒ 被掐);
 *   ② 未在册门仍是缺省 300s(fail-closed,不因"能调大"变成无上限);
 *   ③ 表损坏 / 字段残缺 ⇒ 回落缺省并告警,不抛异常(不把一格坏表升级成整批挂);
 *   ④ 双键(gateId + script)错配不串号。
 * 边界用例把 900000ms 等比缩到 900ms 只为把夹具压进 2 秒,语义(够 / 不够)一字不改。
 */

import { mkdtempSync, rmSync, writeFileSync } from 'node:fs'
import { spawn, spawnSync } from 'node:child_process'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import assert from 'node:assert/strict'
import { test } from 'node:test'

import { fileURLToPath } from 'node:url'

import { checkMarginRatchetHistory, DEFAULT_GATE_TIMEOUT_MS, resolveGateTimeout } from '../lib/gate-timeout-budget.mjs'
import { createGatePhaseWatchdog, RUN_START_MARKER, WAIT_LOCK_MARKER } from '../lib/gate-phase-watchdog.mjs'
import { crashNextStep, decideGateOutcome, fallbackCodeOfReason } from '../lib/gate-failure-kind.mjs'
import { shouldPropagateAsInterrupt } from '../lib/signal-exit.mjs'

const REAL_TABLE = fileURLToPath(new URL('../data/land-gate-budgets.json', import.meta.url))

function withTable(content) {
  const dir = mkdtempSync(join(tmpdir(), 'gate-budget-'))
  const path = join(dir, 'budget.json')
  writeFileSync(path, typeof content === 'string' ? content : JSON.stringify(content), 'utf8')
  return { path, cleanup: () => rmSync(dir, { recursive: true, force: true }) }
}

test('真表:门 30a 与 T1 按在册值取,来源行写清表/条目/值', () => {
  const a = resolveGateTimeout({ gateId: '30a', script: 'check-commit-loss-guard.mjs', tablePath: REAL_TABLE })
  assert.equal(a.ms, 900000)
  assert.equal(a.warning, null)
  assert.match(a.source, /land-gate-budgets\.json/)
  assert.match(a.source, /30a\+check-commit-loss-guard\.mjs/)
  assert.match(a.source, /900000ms/)

  const t1 = resolveGateTimeout({ gateId: 'T1', script: 'check-typecheck.mjs', tablePath: REAL_TABLE })
  // 547650ms = push 形态 365.1s × 1.5(不拿全量 565.6s 那档去凑)。
  assert.equal(t1.ms, 547650)
  assert.equal(t1.waitMs, 600000)
  assert.equal(t1.entry?.phaseProtocol, true)
  assert.match(t1.source, /T1\+check-typecheck\.mjs/)
  assert.match(t1.source, /547650ms/)
})

test('棘轮:margin 与 evidence 自洽;首次登记放行,余量变了证据不增长 ⇒ 拒收', () => {
  const t1 = resolveGateTimeout({ gateId: 'T1', script: 'check-typecheck.mjs', tablePath: REAL_TABLE }).entry
  // derived = base + margin = timeoutMs,且末条 evidence 的 marginMs 覆盖当前 margin。
  assert.equal(t1.baseMs + t1.marginMs, t1.derivedMs)
  assert.equal(t1.derivedMs, t1.timeoutMs)
  assert.ok(Array.isArray(t1.evidence) && t1.evidence.length >= 2)
  assert.equal(t1.evidence[t1.evidence.length - 1].marginMs, t1.marginMs)
  // 首次登记(本表 HEAD 尚无 T1 条目):没有可比基线 ⇒ 放行。
  assert.deepEqual(checkMarginRatchetHistory('T1', t1, []), [])
  // 上一版同 margin、证据 2 条 → 当前 4 条:放行。
  assert.deepEqual(checkMarginRatchetHistory('T1', t1, [{ marginMs: 182550, evidence: [{}, {}], __sha: 'x' }]), [])
  // 上一版 margin 120000、证据也是 4 条 → 改成 182550 而证据没长:拒收。
  const errs = checkMarginRatchetHistory('T1', t1, [
    { marginMs: 120000, evidence: [{}, {}, {}, {}], __sha: 'x' },
  ])
  assert.equal(errs.length, 1)
  assert.match(errs[0], /证据未增长/)
})

test('在册门:低于表值绿、高于表值红(900/901 边界语义,等比缩放档)', () => {
  // Windows 的计时粒度分不出差 1ms 的边界,故取表值 10000ms、下界 9500ms、上界 10500ms:
  // 语义仍是「够 ⇒ 绿、超 ⇒ 被掐」,只是不拿 ±1ms 去赌操作系统。
  const t = withTable({ defaultTimeoutMs: 300000, gates: [{ gateId: 'X', script: 'stub.mjs', timeoutMs: 10000 }] })
  try {
    const under = resolveGateTimeout({ gateId: 'X', script: 'stub.mjs', tablePath: t.path })
    const over = resolveGateTimeout({ gateId: 'X', script: 'stub.mjs', tablePath: t.path })
    assert.equal(under.ms, 10000)
    assert.equal(over.ms, 10000)

    const ok = spawnSync(process.execPath, ['-e', 'setTimeout(() => process.exit(0), 9500)'], { timeout: under.ms })
    assert.equal(ok.status, 0)
    assert.equal(ok.error, undefined)

    const killed = spawnSync(process.execPath, ['-e', 'setTimeout(() => process.exit(0), 10500)'], { timeout: over.ms })
    assert.notEqual(killed.status, 0)
    assert.equal(killed.error?.code, 'ETIMEDOUT')
  } finally {
    t.cleanup()
  }
})

test('在册门的超时取自表值,不是全局 300s', () => {
  // 表登记 900ms;子进程 1000ms。若仍按全局 300s/300ms,它会在 300ms 就被掐。
  const t = withTable({ defaultTimeoutMs: 300, gates: [{ gateId: 'SLOW', script: 'slow.mjs', timeoutMs: 900 }] })
  try {
    const budget = resolveGateTimeout({ gateId: 'SLOW', script: 'slow.mjs', tablePath: t.path })
    assert.equal(budget.ms, 900)
    const started = Date.now()
    const r = spawnSync(process.execPath, ['-e', 'setTimeout(() => process.exit(0), 1000)'], { timeout: budget.ms })
    const elapsed = Date.now() - started
    assert.equal(r.error?.code, 'ETIMEDOUT')
    assert.ok(elapsed >= 850, `按表值应等到 ~900ms,实际 ${elapsed}ms(疑似仍在用 300s 那枚全局旋钮)`)
  } finally {
    t.cleanup()
  }
})

test('未在册的门仍是缺省 300s(fail-closed)', () => {
  const t = withTable({ defaultTimeoutMs: 300000, gates: [{ gateId: 'X', script: 'stub.mjs', timeoutMs: 900 }] })
  try {
    const r = resolveGateTimeout({ gateId: 'NEW', script: 'new-gate.mjs', tablePath: t.path })
    assert.equal(r.ms, DEFAULT_GATE_TIMEOUT_MS)
    assert.equal(r.entry, null)
    assert.match(r.source, /未在册/)
  } finally {
    t.cleanup()
  }
})

test('表损坏 / 字段残缺 ⇒ 回落缺省 + 告警,绝不抛', () => {
  const broken = withTable('{not json')
  try {
    const r = resolveGateTimeout({ gateId: '30a', script: 'check-commit-loss-guard.mjs', tablePath: broken.path })
    assert.equal(r.ms, DEFAULT_GATE_TIMEOUT_MS)
    assert.match(r.warning, /不可读|不是合法 JSON/)
  } finally {
    broken.cleanup()
  }

  const missing = withTable({ defaultTimeoutMs: 300000, gates: [{ gateId: 'BAD', script: 'bad.mjs' }] })
  try {
    const r = resolveGateTimeout({ gateId: 'BAD', script: 'bad.mjs', tablePath: missing.path })
    assert.equal(r.ms, DEFAULT_GATE_TIMEOUT_MS)
    assert.match(r.warning, /timeoutMs 缺失或非正数/)
  } finally {
    missing.cleanup()
  }
})

test('双键错配不串号:门号对/脚本错、脚本对/门号错,都回落缺省', () => {
  const t = withTable({ defaultTimeoutMs: 300000, gates: [{ gateId: 'A', script: 'a.mjs', timeoutMs: 900000 }] })
  try {
    const wrongScript = resolveGateTimeout({ gateId: 'A', script: 'b.mjs', tablePath: t.path })
    assert.equal(wrongScript.ms, DEFAULT_GATE_TIMEOUT_MS)
    assert.match(wrongScript.warning, /双键错配/)

    const wrongId = resolveGateTimeout({ gateId: 'B', script: 'a.mjs', tablePath: t.path })
    assert.equal(wrongId.ms, DEFAULT_GATE_TIMEOUT_MS)
    assert.match(wrongId.warning, /双键错配/)
  } finally {
    t.cleanup()
  }
})

// ── 排队 / 执行分段计时(2026-11-07 立) ─────────────────────────────────────
// 病灶原文:真实推送日志里 T1 `300021ms` 被 300s 掐掉,而那 300s 里有一部分是在等
// 「另一全量 typecheck 进行中(pid 39560)」。排队时间被算成执行时间 ⇒ 别人忙被读成"代码红"。
// 下面四条直接跑真实子进程验真实现(gate-phase-watchdog),不复刻一份逻辑。

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
  const r = await runPhaseChild({ markerAtMs: 0, exitAtMs: 1500, phase: true, runLimitMs: 300, waitLimitMs: 5000 })
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
  const r = await runPhaseChild({ markerAtMs: 0, exitAtMs: 400, phase: true, runLimitMs: 5000, waitLimitMs: 5000 })
  assert.equal(r.code, null)
  assert.equal(r.runStarted, true)
  assert.ok(r.waitMs >= 0 && r.waitMs < 5000, `waitMs 应在 [0,5000),实得 ${r.waitMs}`)
  assert.ok(r.runMs >= 100, `runMs 应 ≥ 100,实得 ${r.runMs}`)
  const kind = decideGateOutcome({ status: 0, signal: null })
  assert.equal(kind.kind, 'pass')
})

test('夹具④:limitSource 打印表名与条目(缺一等于没生效)', () => {
  const budget = resolveGateTimeout({ gateId: 'T1', script: 'check-typecheck.mjs', tablePath: REAL_TABLE })
  const line = `waitMs=0 runMs=1 limitMs=${budget.ms} limitSource=${budget.source}`
  assert.match(budget.source, /scripts\/data\/land-gate-budgets\.json/)
  assert.match(budget.source, /T1\+check-typecheck\.mjs/)
  assert.match(budget.source, /547650ms/)
  assert.match(line, /limitSource=scripts\/data\/land-gate-budgets\.json \/ T1\+check-typecheck\.mjs \/ 547650ms/)
})
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
