// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * scripts/tests/guardian-lock.test.mjs —— 轮级互斥原语的取证(2026-11-02 立)。
 *
 * 本文件只测 `scripts/lib/guardian-lock.mjs`,**不 import git-guardian.mjs**:
 * 守护主文件此刻正被另一个会话改,测试不依赖它,也不触发任何真实巡检/发信/自愈。
 *
 * S5 活锁 + 新鲜 heartbeat ⇒ 拒绝(daemon 入口将来套用的就是这一条)
 * S6 死 pid ⇒ 墓碑回收后接管
 * S7 活 pid + 陈旧 heartbeat ⇒ 拒绝且报警,不偷锁
 * S8 两个**真子进程**并发 acquire ⇒ 恰好一个成功;释放后可接管
 * S9 `IHUI_GUARDIAN_LOCK_MODE=off` ⇒ 零副作用
 * S10 `IHUI_GUARDIAN_LOCK_PATH` 覆盖默认落点
 */

import assert from 'node:assert/strict'
import { spawn } from 'node:child_process'
import { existsSync, readFileSync, readdirSync, utimesSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'
import { test } from 'node:test'
import { fileURLToPath } from 'node:url'

import {
  LOCK_PATH_ENV,
  acquireGuardianLock,
  heartbeatGuardianLock,
  inspectGuardianLock,
  lockMode,
  releaseGuardianLock,
  startHeartbeatGuardianLock,
} from '../lib/guardian-lock.mjs'
import { mkScratch, rmScratch } from '../lib/scratch-dir.mjs'

const SELF = fileURLToPath(import.meta.url)

// ── 真并发子进程的「持锁臂」────────────────────────────────────────────────────
// 用同一个文件当普通脚本跑(不传 --test);父进程只读它的 RESULT 行,不解析人话。
if (process.argv.includes('--child-hold')) {
  const at = process.argv.indexOf('--child-hold')
  const lockPath = process.argv[at + 1]
  const holdMs = Number(process.argv[at + 2] || 2000)
  const startAt = Number(process.argv[at + 3] || 0)
  const wait = startAt - Date.now()
  if (wait > 0) Atomics.wait(new Int32Array(new SharedArrayBuffer(4)), 0, 0, wait)
  const h = acquireGuardianLock({ path: lockPath, env: {} })
  process.stdout.write(`RESULT ${JSON.stringify({ ok: h.ok, kind: h.ok ? 'acquired' : h.kind, pid: process.pid })}\n`)
  if (h.ok && !h.disabled) {
    const until = Date.now() + holdMs
    while (Date.now() < until) {
      heartbeatGuardianLock(h)
      Atomics.wait(new Int32Array(new SharedArrayBuffer(4)), 0, 0, 50)
    }
    releaseGuardianLock(h)
    process.stdout.write('RELEASED\n')
  }
  process.exit(h.ok ? 0 : 3)
}

// ── 「只试不持」臂:验证 stale-alive 是拒绝而不是接管 ───────────────────────────
if (process.argv.includes('--child-acquire')) {
  const at = process.argv.indexOf('--child-acquire')
  const lockPath = process.argv[at + 1]
  const h = acquireGuardianLock({ path: lockPath, env: {} })
  process.stdout.write(
    `RESULT ${JSON.stringify({ ok: h.ok, kind: h.ok ? 'acquired' : h.kind, pid: h.pid || 0 })}\n`,
  )
  process.exit(h.ok ? 0 : 3)
}

function writeLiveLock(file, pid, token = 'live-token') {
  writeFileSync(file, `pid=${pid}\ntoken=${token}\nat=${new Date().toISOString()}\nhost=test\nrole=test\n`, 'utf8')
}

function runChild(lockPath, holdMs, startAt) {
  return new Promise((resolve) => {
    const cp = spawn(process.execPath, [SELF, '--child-hold', lockPath, String(holdMs), String(startAt)], {
      stdio: ['ignore', 'pipe', 'pipe'],
      windowsHide: true,
    })
    let out = ''
    let err = ''
    cp.stdout.on('data', (d) => {
      out += String(d)
    })
    cp.stderr.on('data', (d) => {
      err += String(d)
    })
    cp.on('close', (code) => resolve({ code, out, err }))
  })
}

function parseChildResult(r) {
  const line = r.out.split(/\r?\n/).find((l) => l.startsWith('RESULT '))
  assert.ok(line, `子进程没有输出 RESULT 行;stdout=${JSON.stringify(r.out)} stderr=${JSON.stringify(r.err)}`)
  return JSON.parse(line.slice('RESULT '.length))
}

test('S5 活 pid + 新鲜 heartbeat ⇒ 拒绝(不覆盖持有者的锁)', () => {
  const dir = mkScratch('guardian-lock')
  try {
    const f = join(dir, 'g5.lock')
    writeLiveLock(f, process.ppid, 's5-holder')
    const before = readFileSync(f, 'utf8')
    const r = acquireGuardianLock({ path: f, env: {} })
    assert.equal(r.ok, false)
    assert.equal(r.kind, 'held')
    assert.equal(r.pid, process.ppid)
    assert.equal(readFileSync(f, 'utf8'), before, '拒闸时不得改写持有者的锁文件')
  } finally {
    rmScratch(dir)
  }
})

test('S6 死 pid ⇒ 墓碑回收后接管', () => {
  const dir = mkScratch('guardian-lock')
  try {
    const f = join(dir, 'g6.lock')
    writeLiveLock(f, 999999999, 'dead-holder')
    const r = acquireGuardianLock({ path: f, env: {}, staleMs: 60_000 })
    assert.equal(r.ok, true)
    assert.match(readFileSync(f, 'utf8'), new RegExp(`pid=${process.pid}`))
    assert.equal(
      readdirSync(dir).filter((n) => n.includes('.dead.') || n === 'g6.lock.reclaim').length,
      0,
      '回收完不得留下墓碑或回收门',
    )
    releaseGuardianLock(r)
    assert.equal(existsSync(f), false)
  } finally {
    rmScratch(dir)
  }
})

test('S7 活 pid + heartbeat 陈旧 ⇒ 拒绝且报警,不偷锁', () => {
  const dir = mkScratch('guardian-lock')
  try {
    const f = join(dir, 'g7.lock')
    writeLiveLock(f, process.ppid, 'stale-holder')
    const old = new Date(Date.now() - 10_000)
    utimesSync(f, old, old)
    const alerts = []
    const r = acquireGuardianLock({ path: f, env: {}, staleMs: 2_000, onAlert: (m) => alerts.push(m) })
    assert.equal(r.ok, false)
    assert.equal(r.kind, 'stale-alive')
    assert.equal(r.pid, process.ppid)
    assert.equal(alerts.length, 1, '必须喊人一次')
    assert.match(readFileSync(f, 'utf8'), /token=stale-holder/, '活进程的锁一个字节都不许动')
    assert.match(alerts[0], /不偷锁/)
  } finally {
    rmScratch(dir)
  }
})

test('S8 两个真子进程并发 acquire ⇒ 恰好一个成功;释放后可接管', async () => {
  const dir = mkScratch('guardian-lock')
  try {
    const f = join(dir, 'g8.lock')
    const startAt = Date.now() + 1500 // 两边都在同一时刻起跑,不靠"启动快慢"碰运气
    const [a, b] = await Promise.all([runChild(f, 2000, startAt), runChild(f, 2000, startAt)])
    const ra = parseChildResult(a)
    const rb = parseChildResult(b)
    const oks = [ra, rb].filter((r) => r.ok)
    const loses = [ra, rb].filter((r) => !r.ok)
    assert.equal(oks.length, 1, `必须恰好一个成功,实得:${JSON.stringify([ra, rb])}`)
    assert.equal(loses.length, 1)
    // 输家可能在赢家 `openSync('wx')` 与写内容之间的微秒窗口读到空锁 ⇒ held-unknown。
    // 两者都是"拒绝",绝不是接管:空锁 mtime 新鲜,回收分支不会碰它。
    assert.ok(['held', 'held-unknown'].includes(loses[0].kind), `输家必须被拒,实得:${loses[0].kind}`)
    assert.equal(existsSync(f), false, '赢家退出时必须已释放锁')

    const after = acquireGuardianLock({ path: f, env: {} })
    assert.equal(after.ok, true, '释放后必须可接管')
    releaseGuardianLock(after)
  } finally {
    rmScratch(dir)
  }
})

test('S9 IHUI_GUARDIAN_LOCK_MODE=off ⇒ 零副作用(不建文件)', () => {
  const dir = mkScratch('guardian-lock')
  try {
    const f = join(dir, 'g9.lock')
    assert.equal(lockMode({ IHUI_GUARDIAN_LOCK_MODE: 'off' }), 'off')
    const r = acquireGuardianLock({ path: f, env: { IHUI_GUARDIAN_LOCK_MODE: 'off' } })
    assert.equal(r.ok, true)
    assert.equal(r.disabled, true)
    assert.equal(existsSync(f), false)
    assert.equal(readdirSync(dir).length, 0, 'off 档不得留下目录或任何文件')
  } finally {
    rmScratch(dir)
  }
})

function runChildAcquire(lockPath) {
  return new Promise((resolve) => {
    const cp = spawn(process.execPath, [SELF, '--child-acquire', lockPath], {
      stdio: ['ignore', 'pipe', 'pipe'],
      windowsHide: true,
    })
    let out = ''
    let err = ''
    cp.stdout.on('data', (d) => {
      out += String(d)
    })
    cp.stderr.on('data', (d) => {
      err += String(d)
    })
    cp.on('close', (code) => resolve({ code, out, err }))
  })
}

test('S10 IHUI_GUARDIAN_LOCK_PATH 覆盖默认落点', () => {
  const dir = mkScratch('guardian-lock')
  try {
    const f = join(dir, 'g10.lock')
    const r = acquireGuardianLock({ env: { [LOCK_PATH_ENV]: f } })
    assert.equal(r.ok, true)
    assert.equal(r.path, f)
    assert.equal(existsSync(f), true)
    const seen = inspectGuardianLock({ env: { [LOCK_PATH_ENV]: f } })
    assert.equal(seen.exists, true)
    assert.equal(seen.pid, process.pid)
    releaseGuardianLock(r)
  } finally {
    rmScratch(dir)
  }
})

test('S11 10 分钟长轮次(压缩模拟)⇒ 锁全程 held,heartbeatAge 不超声明阈值', () => {
  const dir = mkScratch('guardian-lock')
  try {
    const f = join(dir, 'g11.lock')
    const staleMs = 15 * 60 * 1000
    const h = acquireGuardianLock({ path: f, env: {}, staleMs })
    assert.equal(h.ok, true)
    // 1s 真实续约 = 生产 30s 的加速形态;200 步 × 3s = 600s 轮次,靠注入 now 压缩到 20s。
    const hb = startHeartbeatGuardianLock(h, { intervalMs: 1_000, env: {} })
    assert.equal(hb.started, true)
    assert.equal(hb.firstOk, true)
    const startedAt = Date.now()
    const samples = []
    try {
      for (let step = 1; step <= 200; step += 1) {
        Atomics.wait(new Int32Array(new SharedArrayBuffer(4)), 0, 0, 100)
        const seen = inspectGuardianLock({
          path: f,
          env: {},
          staleMs: 5 * 60 * 1000,
          now: () => startedAt + step * 3_000,
        })
        assert.equal(seen.exists, true, `step=${step} 锁必须还在`)
        assert.equal(seen.state, 'held', `step=${step} 实得 state=${seen.state}`)
        assert.ok(
          seen.heartbeatAgeMs < staleMs,
          `step=${step} heartbeatAge=${seen.heartbeatAgeMs}ms ≥ 声明阈值 ${staleMs}ms`,
        )
        samples.push(seen.heartbeatAgeMs)
      }
    } finally {
      hb.stop()
      releaseGuardianLock(h)
    }
    assert.equal(samples.length, 200)
    assert.ok(Math.max(...samples) < staleMs, `最大心跳年龄 ${Math.max(...samples)}ms 必须小于 ${staleMs}ms`)
  } finally {
    rmScratch(dir)
  }
})

test('S12 心跳停 > 阈值且持有者活着 ⇒ stale-alive,不许静默接管', async () => {
  const dir = mkScratch('guardian-lock')
  try {
    const f = join(dir, 'g12.lock')
    const h = acquireGuardianLock({ path: f, env: {}, staleMs: 60_000 })
    assert.equal(h.ok, true)
    const before = readFileSync(f, 'utf8')
    const old = new Date(Date.now() - 6 * 60 * 1000)
    utimesSync(f, old, old)
    const seen = inspectGuardianLock({ path: f, env: {}, staleMs: 5 * 60 * 1000 })
    assert.equal(seen.exists, true)
    assert.equal(seen.state, 'stale-alive')
    assert.equal(seen.pid, process.pid)
    // 真子进程来抢:活进程 + 陈旧心跳 ⇒ 只许拒绝,不许回收/接管。
    const child = await runChildAcquire(f)
    const r = parseChildResult(child)
    assert.equal(r.ok, false)
    assert.equal(r.kind, 'stale-alive')
    assert.equal(readFileSync(f, 'utf8'), before, '活进程的锁文件不得被改写')
    assert.equal(existsSync(f), true, '锁必须还在,不许被静默回收')
    releaseGuardianLock(h)
    assert.equal(existsSync(f), false)
  } finally {
    rmScratch(dir)
  }
})
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
