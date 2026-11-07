// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

// 机器级 typecheck 串行锁夹具(2026-11-07)
//
// 覆盖用户点名的五格:
//   1. 默认无锁 ⇒ 行为与改造前一致(直接拿到锁,waitedMs=0,meta 四要素齐全);
//   2. 持锁 ⇒ 串行等待,并打出持锁者(pid/启动时刻/仓库/已持有时长);
//   3. 等待超限 ⇒ busy-timeout(调用方据此 exit 2 + 「未判定(并发占用)」);
//   4. 陈旧锁能被清理(pid 已死 / pid 复用 / meta 缺失超宽限);
//   5. 活锁不被清理(不删、不抢、meta 字节不变)。
// 另加一格 CLI 级:typecheck-full 在锁被占且 waitMs=0 时,必须 exit 2 且 stderr 自称未判定。
//
// 判活/身份核对全部注入,夹具不真的去起 PowerShell;CLI 那条走真实判据(锁由本测试进程持有,
// 活锁一定成立,探针失败也只是落 unverifiable ⇒ 仍是活锁,结论稳定)。
import { mkdirSync, mkdtempSync, readFileSync, rmSync, utimesSync, writeFileSync } from 'node:fs'
import { hostname, tmpdir } from 'node:os'
import { dirname, join, resolve } from 'node:path'
import { spawnSync } from 'node:child_process'
import { fileURLToPath } from 'node:url'
import test from 'node:test'
import assert from 'node:assert/strict'
import {
  acquireTypecheckLock,
  describeLockHolder,
  judgeLock,
  readLockMeta,
  DEFAULT_WAIT_MS,
  GATE_QUEUE_WAIT_MS,
} from '../lib/typecheck-lock.mjs'
import { identityFields } from '../lib/proc-identity.mjs'

const HERE = dirname(fileURLToPath(import.meta.url))
const ROOT = resolve(HERE, '..', '..')
const CLI = join(ROOT, 'scripts', 'typecheck-full.mjs')

function fixture(t) {
  const base = mkdtempSync(join(tmpdir(), 'ihui-typecheck-lock-test-'))
  t.after(() => rmSync(base, { recursive: true, force: true }))
  return { base, dir: join(base, 'typecheck.lock') }
}

/** 造一把"本进程持有"的活锁(pid 真实存活,启动时刻用与生产同一探针)。 */
function plantLiveLock(dir, over = {}) {
  const meta = {
    pid: process.pid,
    // 生产记录侧同样走 identityFields(与 verifyHolder 同一把尺子)。
    // 不用 uptime 反推:本机实证两者差 28800s,会让任何锁都被判成 pid 复用。
    pidStart: identityFields().pidStart,
    repo: 'D:/fixture/repo',
    role: 'fixture',
    startedAt: new Date(Date.now() - 3_000).toISOString(),
    host: hostname(),
    token: 'live-token',
    ...over,
  }
  mkdirSync(dir, { recursive: true })
  writeFileSync(join(dir, 'meta.json'), JSON.stringify(meta), 'utf8')
  return meta
}

const ALIVE = () => true
const DEAD = () => false
const MATCH = () => ({ kind: 'match' })
const MISMATCH = () => ({ kind: 'mismatch', why: '夹具:启动时刻不符 = pid 复用' })

test('L1 默认无锁:直接取得锁,waitedMs=0,meta 记录 pid/启动时刻/仓库/开始时刻', (t) => {
  const { dir } = fixture(t)
  return (async () => {
    const lock = await acquireTypecheckLock({ path: dir, repo: 'D:/fixture/repo', role: 'fixture' })
    assert.equal(lock.ok, true)
    assert.ok(lock.waitedMs < 50, `无锁时不得有等待(行为与改造前一致),实得 ${lock.waitedMs}ms`)
    const meta = readLockMeta(dir)
    assert.equal(meta.pid, process.pid)
    assert.ok(Number.isFinite(meta.pidStart) && meta.pidStart > 0, '必须记录进程启动时刻')
    assert.equal(meta.repo, 'D:/fixture/repo')
    assert.equal(meta.role, 'fixture')
    assert.match(meta.startedAt, /^\d{4}-\d{2}-\d{2}T/)
    assert.equal(typeof meta.token, 'string')
    lock.release()
    assert.equal(readLockMeta(dir), null, 'release 必须只删自己那把锁')
  })()
})

test('L2 持锁时串行等待,并打出持锁者(pid/启动时刻/仓库/已持有时长)', (t) => {
  const { dir } = fixture(t)
  plantLiveLock(dir)
  // 900ms 后持有者"退出",等待方应在这之后拿到锁
  const timer = setTimeout(() => rmSync(dir, { recursive: true, force: true }), 900)
  t.after(() => clearTimeout(timer))
  return (async () => {
    const logs = []
    const lock = await acquireTypecheckLock({
      path: dir,
      waitMs: 10_000,
      pollMs: 100,
      pidAlive: ALIVE,
      verify: MATCH,
      log: (line) => logs.push(line),
    })
    assert.equal(lock.ok, true, `等不到锁:${logs.join('\n')}`)
    assert.ok(lock.waitedMs >= 800, `必须真的等过,实得 ${lock.waitedMs}ms`)
    const joined = logs.join('\n')
    assert.match(joined, new RegExp(`pid=${process.pid}`), '等待日志必须点名持锁者 pid')
    assert.match(joined, /已持有时长=/, '等待日志必须打出已持有时长')
    assert.match(joined, /仓库=D:\/fixture\/repo/, '等待日志必须打出仓库路径')
    assert.match(joined, /上限 10s/, '等待日志必须打出上限(让读数可解释)')
    // 判据读数六件套:缺一个等于没做。
    assert.match(joined, /holderPid=\d+/, '判据必须打印 holderPid')
    assert.match(joined, /holderPidStart=(?:\d+|未知)/, '判据必须打印 holderPidStart')
    assert.match(joined, /holderAlive=(?:true|false|未知)/, '判据必须打印 holderAlive')
    assert.match(joined, /verdict=(?:stale|live|unverifiable|未知)/, '判据必须打印 verdict')
    assert.match(joined, /waitedMs=\d+/, '判据必须打印 waitedMs')
    assert.match(joined, /limitMs=\d+/, '判据必须打印 limitMs')
    lock.release()
  })()
})

test('L3 等待超限 ⇒ busy-timeout(不是通过、不是失败),持锁者信息随结果返回', (t) => {
  const { dir } = fixture(t)
  plantLiveLock(dir)
  return (async () => {
    const lock = await acquireTypecheckLock({
      path: dir,
      waitMs: 300,
      pollMs: 100,
      pidAlive: ALIVE,
      verify: MATCH,
      log: () => {},
    })
    assert.equal(lock.ok, false)
    assert.equal(lock.kind, 'busy-timeout')
    assert.equal(lock.state, 'held')
    assert.ok(lock.waitedMs >= 300)
    assert.equal(lock.holder.pid, process.pid)
    assert.ok(lock.holder.heldMs >= 3_000, '持锁者信息必须含已持有时长')
    const desc = describeLockHolder(lock.holder)
    assert.ok(desc.includes(`pid=${process.pid}`), desc)
    assert.ok(desc.includes('进程启动时刻(探针读数)='), desc)
    assert.ok(desc.includes('仓库=D:/fixture/repo'), desc)
    assert.ok(desc.includes('角色=fixture'), desc)
    assert.ok(desc.includes('已持有时长='), desc)
    assert.ok(readLockMeta(dir) !== null, '活锁不得被清理')
  })()
})

test('L4 陈旧锁:pid 已死 ⇒ 清理后拿到锁', (t) => {
  const { dir } = fixture(t)
  plantLiveLock(dir, { pid: 999_999, token: 'dead-token' })
  return (async () => {
    const logs = []
    const lock = await acquireTypecheckLock({
      path: dir,
      waitMs: 2_000,
      pollMs: 100,
      pidAlive: DEAD,
      verify: MATCH,
      log: (line) => logs.push(line),
    })
    assert.equal(lock.ok, true)
    assert.match(logs.join('\n'), /清理陈旧锁\(dead:/)
    assert.equal(readLockMeta(dir).token !== 'dead-token', true, '旧持有者凭据必须已被换掉')
    lock.release()
  })()
})

test('L5 陈旧锁:pid 活着但启动时刻不符(pid 复用)⇒ 清理后拿到锁', (t) => {
  const { dir } = fixture(t)
  plantLiveLock(dir, { token: 'reused-token' })
  return (async () => {
    const logs = []
    const lock = await acquireTypecheckLock({
      path: dir,
      waitMs: 2_000,
      pollMs: 100,
      pidAlive: ALIVE,
      verify: MISMATCH,
      log: (line) => logs.push(line),
    })
    assert.equal(lock.ok, true)
    assert.match(logs.join('\n'), /清理陈旧锁\(reused:/)
    lock.release()
  })()
})

test('L6 陈旧锁:目录在但 meta 缺失且超过宽限 ⇒ 清理后拿到锁', (t) => {
  const { dir } = fixture(t)
  mkdirSync(dir, { recursive: true })
  utimesSync(dir, new Date(0), new Date(0))
  return (async () => {
    const lock = await acquireTypecheckLock({ path: dir, waitMs: 2_000, pollMs: 100 })
    assert.equal(lock.ok, true)
    lock.release()
  })()
})

test('L7 活锁不被清理:不删、不抢,meta 字节保持不变', (t) => {
  const { dir } = fixture(t)
  plantLiveLock(dir)
  const before = readFileSync(join(dir, 'meta.json'), 'utf8')
  return (async () => {
    const lock = await acquireTypecheckLock({
      path: dir,
      waitMs: 300,
      pollMs: 100,
      pidAlive: ALIVE,
      verify: MATCH,
      log: () => {},
    })
    assert.equal(lock.ok, false)
    assert.equal(lock.kind, 'busy-timeout')
    assert.equal(readFileSync(join(dir, 'meta.json'), 'utf8'), before, '活锁 meta 被改动 = 抢了别人的锁')
    assert.equal(judgeLock(dir, { pidAlive: ALIVE, verify: MATCH }).state, 'held')
  })()
})

test('L8 judgeLock:身份无法核实(unverifiable)必须按活锁保守处理,不得判死', (t) => {
  const { dir } = fixture(t)
  plantLiveLock(dir)
  const judged = judgeLock(dir, { pidAlive: ALIVE, verify: () => ({ kind: 'unverifiable', why: '探针不可用' }) })
  assert.equal(judged.state, 'held')
  assert.equal(judged.verified, false)
})

test('L9 CLI:锁被活进程持有且 waitMs=0 ⇒ typecheck-full exit 2 + stderr「未判定(并发占用)」', (t) => {
  const { dir } = fixture(t)
  plantLiveLock(dir, { role: 'typecheck-full', repo: ROOT })
  const r = spawnSync(process.execPath, [CLI], {
    cwd: ROOT,
    encoding: 'utf8',
    timeout: 60_000,
    windowsHide: true,
    stdio: ['ignore', 'pipe', 'pipe'],
    env: {
      ...process.env,
      IHUI_TYPECHECK_FULL_CHILD: '', // 不吃父进程的再入守卫,确保走锁分支
      IHUI_TYPECHECK_LOCK_PATH: dir,
      IHUI_TYPECHECK_LOCK_WAIT_MS: '0',
      IHUI_TYPECHECK_LOCK_POLL_MS: '50',
    },
  })
  assert.equal(r.status, 2, `必须 exit 2(未判定),实得 ${r.status}\nstdout:\n${r.stdout}\nstderr:\n${r.stderr}`)
  assert.match(r.stderr, /未判定\(并发占用\)/, 'stderr 必须自称未判定(消费侧 detectUndetermined 只认这个标记)')
  assert.match(r.stderr, new RegExp(`pid=${process.pid}`), '必须点名持锁者')
  assert.match(r.stderr, /这不是类型检查结论/, '必须明确写"不是通过也不是失败"')
  assert.match(r.stderr, /已持有时长=/, '必须打出持锁者已持有时长')
  // 锁分支在清 .tsbuildinfo 之前 ⇒ 本次必须零破坏
  assert.equal(r.stdout.includes('清除 .tsbuildinfo'), false, '拿不到锁时不得先清缓存(顺序必须在锁之后)')
})

test('L10 pid 不存在 ⇒ verdict=stale 且允许认领,不再问身份(不把两档合成一个保守分支)', (t) => {
  const { dir } = fixture(t)
  plantLiveLock(dir, { pid: 999_999, pidStart: null, token: 'dead-no-pidstart' })
  let verified = 0
  const judged = judgeLock(dir, {
    pidAlive: DEAD,
    verify: () => {
      verified++
      return { kind: 'unverifiable', why: '夹具:不该被调用' }
    },
  })
  assert.equal(judged.state, 'dead')
  assert.equal(judged.verdict, 'stale', '进程不在就是 stale —— 没有 pid 复用问题')
  assert.equal(judged.holderAlive, false)
  assert.equal(verified, 0, 'pid 已死就不该再问身份(问不到 pidStart 不能反推成"活锁")')
  return (async () => {
    const lock = await acquireTypecheckLock({
      path: dir,
      repo: 'D:/fixture/repo',
      role: 'fixture',
      waitMs: 2000,
      pollMs: 100,
      pidAlive: DEAD,
      verify: () => {
        verified++
        return { kind: 'unverifiable' }
      },
      log: () => {},
    })
    assert.equal(lock.ok, true, 'pid 已死必须允许偷,不能因缺 pidStart 保守等待')
    lock.release()
    assert.equal(verified, 0)
  })()
})

test('L11 门/锁同一份预算:默认等待上限覆盖他人全量实测(365–565s),不各自写死', () => {
  assert.equal(DEFAULT_WAIT_MS, GATE_QUEUE_WAIT_MS, '门侧 waitTimeoutMs 与锁侧默认值必须同源')
  assert.ok(
    GATE_QUEUE_WAIT_MS >= 565_000,
    `等锁上限 ${GATE_QUEUE_WAIT_MS}ms 比他人单次全量(365–565s)还短 ⇒ 必然未判定`,
  )
})

test('L12 verdict 分明:match ⇒ live,unverifiable ⇒ 保守档;holderAlive 随判据给出', (t) => {
  const { dir } = fixture(t)
  plantLiveLock(dir)
  const live = judgeLock(dir, { pidAlive: ALIVE, verify: MATCH })
  assert.equal(live.verdict, 'live')
  assert.equal(live.holderAlive, true)
  const unv = judgeLock(dir, { pidAlive: ALIVE, verify: () => ({ kind: 'unverifiable', why: '探针不可用' }) })
  assert.equal(unv.verdict, 'unverifiable')
  assert.equal(unv.verified, false)
  assert.equal(unv.holderAlive, true)
})
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
