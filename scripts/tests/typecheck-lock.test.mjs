// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

// 机器级 typecheck 串行锁夹具(2026-11-07)
//
// 覆盖五格基础判据 + 本轮三处补口:
//   1. 默认无锁 ⇒ 行为与改造前一致(直接拿到锁,waitedMs=0,meta 四要素齐全);
//   2. 持锁 ⇒ 串行等待,并打出持锁者(pid/启动时刻/仓库/已持有时长);
//   3. 等待超限 ⇒ busy-timeout(调用方据此 exit 75「临时失败,可重试」);
//   4. 陈旧锁能被清理(pid 已死 / pid 复用 / meta 缺失超宽限);
//   5. 活锁不被清理(不删、不抢、meta 字节不变)。
// 补口 AC:
//   · 等不到就具名失败(用户点名):持锁者一直不放(模拟 10 分钟),等待方到 deadline 退出 75、
//     点名持锁者、**只等一轮**(不是第二轮无限等待);
//   · FIFO 公平性:票据按 createdAt 排序,死票/过期票被清,后来者不得插队;
//   · 心跳:新鲜 ⇒ held,断供 >3×interval 且持锁 >2min ⇒ stalled,缺失/不支持 ⇒ 保守 held。
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
  HEARTBEAT_STALE_MS,
  judgeLock,
  plantQueueTicket,
  purgeStaleTickets,
  readLockMeta,
  readQueueTickets,
  STALLED_MIN_HELD_MS,
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

test('L9 CLI:锁被活进程持有且 waitMs=0 ⇒ typecheck-full exit 75(临时失败,可重试)并点名持锁者', (t) => {
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
  assert.equal(r.status, 75, `被占用必须 exit 75(临时失败),实得 ${r.status}\nstdout:\n${r.stdout}\nstderr:\n${r.stderr}`)
  assert.match(r.stderr, /\[IHUI-TYPE-LOCK-BUSY\]/, 'stderr 必须带固定标记(check-typecheck 据此与"被信号杀"分开)')
  assert.match(r.stderr, /锁被占用\(可重试\)/, '必须明确写"可重试"')
  assert.match(r.stderr, new RegExp(`pid=${process.pid}`), '必须点名持锁者')
  assert.match(r.stderr, /这不是类型检查结论/, '必须明确写"不是通过也不是失败"')
  assert.match(r.stderr, /已持有时长=/, '必须打出持锁者已持有时长')
  // 被占用不再是"未判定":它可重试,与 exit 2 的 io-error 分档
  assert.equal(/未判定\(并发占用\)/.test(r.stderr), false, '被占用不得再交付"未判定"')
  // 锁分支在清 .tsbuildinfo 之前 ⇒ 本次必须零破坏
  assert.equal(r.stdout.includes('清除 .tsbuildinfo'), false, '拿不到锁时不得先清缓存(顺序必须在锁之后)')
})

// ★ 用户点名的 AC:等不到就具名失败。
// 持锁方一直不释放(模拟已持锁 10 分钟),等待方 deadline 到达 ⇒ exit 75、stderr 点名持锁者、
// 且**只等一轮** —— 这条是这次全机卡死的直接复现;只测"拿到锁"覆盖不到它。
test('L10 AC 等不到就具名失败:持锁 10min 不放,等待方 deadline 到达即 exit 75,不进第二轮', (t) => {
  const { dir } = fixture(t)
  plantLiveLock(dir, {
    role: 'typecheck-full',
    repo: ROOT,
    startedAt: new Date(Date.now() - 10 * 60 * 1000).toISOString(),
  })
  const startedAt = Date.now()
  const r = spawnSync(process.execPath, [CLI], {
    cwd: ROOT,
    encoding: 'utf8',
    timeout: 60_000,
    windowsHide: true,
    stdio: ['ignore', 'pipe', 'pipe'],
    env: {
      ...process.env,
      IHUI_TYPECHECK_FULL_CHILD: '',
      IHUI_TYPECHECK_LOCK_PATH: dir,
      IHUI_TYPECHECK_LOCK_WAIT_MS: '800',
      IHUI_TYPECHECK_LOCK_POLL_MS: '100',
    },
  })
  const elapsedMs = Date.now() - startedAt
  assert.equal(r.status, 75, `必须 exit 75,实得 ${r.status}\nstdout:\n${r.stdout}\nstderr:\n${r.stderr}`)
  assert.ok(elapsedMs < 15_000, `deadline 0.8s 必须真的收口(探针耗时可观,但远小于 15s),实得 ${elapsedMs}ms`)
  assert.match(r.stderr, /\[IHUI-TYPE-LOCK-BUSY\]/)
  assert.match(r.stderr, new RegExp(`pid=${process.pid}`), 'stderr 必须点名持锁者 pid')
  assert.match(r.stderr, /已持有时长=/, 'stderr 必须打出持锁者已持有时长')
  const heldDesc = /已持有时长=(\d+\.\d+)s/.exec(r.stderr)
  assert.ok(heldDesc, `未解析到已持有时长:\n${r.stderr}`)
  assert.ok(Number(heldDesc[1]) >= 590, `模拟 10 分钟的持锁者应显示 ≥590s,实得 ${heldDesc[1]}s`)
  assert.match(r.stderr, /不会原地再等第二轮/, '必须明说不会进第二轮')
  // 只等一轮:等待日志里的"串行等待"只出现一次(多轮/无限等待会重复刷)
  const waitRounds = (r.stdout.match(/串行等待/g) || []).length
  assert.equal(waitRounds, 1, `只能等一轮,实得 ${waitRounds} 轮:\n${r.stdout}`)
  assert.equal(r.stdout.includes('清除 .tsbuildinfo'), false)
})

test('L11 FIFO 票据:按 createdAt 排序,死票/过期票被清(后来者不得插队)', (t) => {
  const { base } = fixture(t)
  const queueDir = join(base, 'typecheck.lock.queue')
  mkdirSync(queueDir, { recursive: true })
  const now = Date.now()
  const plant = (token, createdAt, over = {}) =>
    plantQueueTicket(queueDir, {
      token,
      pid: process.pid,
      createdAt,
      expiresAt: now + 60_000,
      ...over,
    })
  plant('c', now)
  plant('a', now - 2_000)
  plant('b', now - 1_000)
  assert.deepEqual(
    readQueueTickets(queueDir).map((x) => x.meta.token),
    ['a', 'b', 'c'],
    '票据必须按 createdAt 稳定排序(同毫秒按 token)',
  )
  plant('dead', now - 15_000, { pid: 999_999 })
  plant('expired', now - 14_000, { expiresAt: now - 1 })
  const alive = purgeStaleTickets(queueDir, { pidAlive: (pid) => pid === process.pid, now: () => now })
  assert.deepEqual(alive.map((x) => x.meta.token), ['a', 'b', 'c'], '死票/过期票必须被清,活票顺序不变')
})

test('L12 FIFO 公平性:后到者不得插队,释放后按 createdAt 依次取得', async (t) => {
  const { dir } = fixture(t)
  plantLiveLock(dir)
  identityFields() // 预热身份探针:否则 A 的探针耗时会让 B 的票据反而更早
  const timer = setTimeout(() => rmSync(dir, { recursive: true, force: true }), 700)
  t.after(() => clearTimeout(timer))
  const startedAt = Date.now()
  const deps = { pidAlive: ALIVE, verify: MATCH }
  const pA = acquireTypecheckLock({
    ...deps,
    path: dir,
    waitMs: 5_000,
    pollMs: 100,
    log: () => {},
  }).then(async (lock) => {
    const aAt = Date.now() - startedAt
    await new Promise((r) => setTimeout(r, 150))
    lock.release()
    return aAt
  })
  await new Promise((r) => setTimeout(r, 250))
  const logsB = []
  const pB = acquireTypecheckLock({
    ...deps,
    path: dir,
    waitMs: 5_000,
    pollMs: 100,
    log: (line) => logsB.push(line),
  }).then((lock) => {
    const bAt = Date.now() - startedAt
    lock.release()
    return bAt
  })
  const [aAt, bAt] = await Promise.all([pA, pB])
  assert.ok(aAt >= 650, `A(队首)必须等到持锁者释放,实得 ${aAt}ms`)
  assert.ok(bAt > aAt, `B(后来者)不得插队:应晚于 A 取得,实得 A=${aAt}ms B=${bAt}ms`)
  assert.match(logsB.join('\n'), /FIFO 队列第 2\/2 位/, 'B 的等待日志必须写出自己在队列里的位置')
})

test('L13 心跳:新鲜⇒held;断供>3×interval 且持锁>2min⇒stalled;缺失/不支持⇒保守 held', (t) => {
  const { dir } = fixture(t)
  plantLiveLock(dir, { startedAt: new Date(Date.now() - 10 * 60 * 1000).toISOString() })
  const deps = { pidAlive: ALIVE, verify: MATCH }
  const writeBeat = (at) =>
    writeFileSync(join(dir, 'heartbeat.json'), JSON.stringify({ token: 'live-token', at }))
  writeBeat(Date.now())
  assert.equal(judgeLock(dir, deps).state, 'held', '心跳新鲜 ⇒ 活锁,不得判死')
  writeBeat(Date.now() - HEARTBEAT_STALE_MS - 5_000)
  const stalled = judgeLock(dir, deps)
  assert.equal(stalled.state, 'stalled', '心跳断供且持锁超 2min ⇒ 可认领')
  assert.ok(stalled.holder.heldMs > STALLED_MIN_HELD_MS, 'stalled 必须带已持有时长')
  rmSync(join(dir, 'heartbeat.json'), { force: true })
  assert.equal(judgeLock(dir, deps).state, 'held', '心跳文件缺失(旧锁)⇒ 保守 held,绝不判死')
  writeBeat(Date.now() - HEARTBEAT_STALE_MS - 5_000)
  writeFileSync(join(dir, 'heartbeat-unsupported.json'), JSON.stringify({ token: 'live-token', at: Date.now() }))
  assert.equal(judgeLock(dir, deps).state, 'held', '心跳机制不可用 ⇒ 该档永不因缺心跳判死')
})

test('L14 心跳由外置子进程续:取锁后 heartbeat.token 与持有者一致;release 收锁', async (t) => {
  const { dir } = fixture(t)
  const lock = await acquireTypecheckLock({ path: dir, repo: 'D:/fixture/repo', role: 'fixture' })
  assert.equal(lock.ok, true)
  const meta = readLockMeta(dir)
  let beat = null
  for (let i = 0; i < 20 && beat === null; i++) {
    await new Promise((r) => setTimeout(r, 50))
    try {
      beat = JSON.parse(readFileSync(join(dir, 'heartbeat.json'), 'utf8'))
    } catch {
      /* 还没写 */
    }
  }
  assert.ok(beat !== null, '心跳文件必须被写出')
  assert.equal(beat.token, meta.token, '心跳 token 必须与持锁凭据一致(否则陈旧认领会认错人)')
  lock.release()
  assert.equal(readLockMeta(dir), null)
})
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
