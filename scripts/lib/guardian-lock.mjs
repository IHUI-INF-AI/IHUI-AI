// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * guardian-lock.mjs —— git-guardian「一轮只许一个执行体」的进程级互斥(2026-11-02 立)。
 *
 * 病灶(只读审计实证):NSSM 服务跑 `git-guardian.mjs --daemon`,同时计划任务每 2 分钟拉
 * `git-guardian.mjs`(无 --daemon);VBS 启动器 `shell.Run(cmd, 0, False)` 让任务本体秒退,
 * 计划任务的 `MultipleInstancesPolicy=IgnoreNew` 对真正的 node 轮次无效。两个进程都在跑,
 * 而既有 `acquireSingleInstance` 只住在 `main()`,`startDaemon()` 从不经过它。
 *
 * 本模块只做一件事:用**文件系统原子创建**当轮级闸。不猜、不抢活锁。
 *
 * 六条不许漂的写法:
 *   1. 取得锁只走 `openSync(path, 'wx')`(O_CREAT|O_EXCL)。**禁止 read→write** ——
 *      先读后写就是 TOCTOU,两个进程都能读到"没锁",然后各自写进去,账面两个持有者。
 *   2. 死 pid 的回收必须 **先 rename 成唯一墓碑、身份回读确认、再 unlink**。两个回收者
 *      共用一条墓碑名就会互踩;墓碑名带 pid+时刻+随机,且回收全程由 `.reclaim` 门串行化。
 *   3. `alive && !fresh`(持有者 pid 仍活着但 heartbeat 已陈旧)**不偷锁**,只返回
 *      `stale-alive` 交调用方喊人。活着的进程可能只是卡住,偷锁 = 亲手制造双跑。
 *   4. `EPERM` / `EBUSY` / `EACCES` 是**锁面故障**,不是"锁被占"。短退避重试后如实返回
 *      `io-error`,绝不伪造成 held。
 *   5. 释放只删**自己 token 那一份**;锁已易主就放手,绝不删别人的锁。`finally` 与
 *      `exit` / `SIGINT` / `SIGTERM` / `SIGHUP` 都会释放本进程持有的全部锁。
 *   6. 显式回滚开关 `IHUI_GUARDIAN_LOCK_MODE=off`:取得/心跳/释放全部变成零副作用,
 *      不建目录、不写文件、不装信号处理器。
 *
 * heartbeat 的载体是**锁文件的 mtime**(`utimesSync`),不是重写文件内容:
 * 重写内容要么截断(reader 读到半份),要么 tmp→rename 把锁路径换成新 inode ——
 * 后者在"回收者刚把锁挪走"的窗口里会凭空重建路径,直接造出第二个持有者。
 * mtime 在文件被挪走时会 `ENOENT`,恰好是"我已失去锁"的最硬证据。
 */

import { closeSync, mkdirSync, openSync, readFileSync, renameSync, statSync, unlinkSync, utimesSync, writeFileSync } from 'node:fs'
import { randomBytes } from 'node:crypto'
import { hostname } from 'node:os'
import { dirname, join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

const HERE = dirname(fileURLToPath(import.meta.url))
const REPO_ROOT = resolve(HERE, '..', '..')

/** 默认锁落点:与 `git-guardian.log` / `git-guardian.pid` 同目录,便于验证脚本一把量完。 */
export const DEFAULT_LOCK_PATH = join(REPO_ROOT, '.ihui-agent', 'state', 'git-guardian.lock')
export const DEFAULT_STALE_MS = 5 * 60 * 1000
export const DEFAULT_IO_RETRIES = 3
export const DEFAULT_IO_RETRY_DELAY_MS = 25
/** 回收门自己的陈旧判定:持有回收门的 pid 已死即可清;pid 读不出时按锁龄兜底。 */
const RECLAIM_GUARD_UNKNOWN_STALE_MS = 10_000
const IO_RETRY_CODES = new Set(['EPERM', 'EBUSY', 'EACCES'])
const MODE_ENV = 'IHUI_GUARDIAN_LOCK_MODE'
export const LOCK_PATH_ENV = 'IHUI_GUARDIAN_LOCK_PATH'

const nodeFs = {
  closeSync,
  mkdirSync,
  openSync,
  readFileSync,
  renameSync,
  statSync,
  unlinkSync,
  utimesSync,
  writeFileSync,
}

let nonceSeq = 0
function nonce() {
  nonceSeq += 1
  return `${process.pid}-${Date.now().toString(36)}-${nonceSeq}-${randomBytes(4).toString('hex')}`
}

const SLEEP_CELL = new Int32Array(new SharedArrayBuffer(4))
/** 同步短退避:守护轮内不能起定时器等异步窗口(等下去别的轮次就挤进来了)。 */
function sleepSync(ms) {
  if (!(ms > 0)) return
  Atomics.wait(SLEEP_CELL, 0, 0, ms)
}

export function lockMode(env = process.env) {
  const v = String(env?.[MODE_ENV] ?? '').trim().toLowerCase()
  return v === 'off' || v === '0' || v === 'false' || v === 'disabled' || v === 'none' ? 'off' : 'on'
}

/** 显式 path 优先于 env;env 优先于默认落点。相对路径按当前工作目录解析。 */
export function resolveLockPath({ path = null, env = process.env } = {}) {
  if (typeof path === 'string' && path.trim() !== '') return resolve(path)
  const fromEnv = String(env?.[LOCK_PATH_ENV] ?? '').trim()
  if (fromEnv !== '') return resolve(fromEnv)
  return DEFAULT_LOCK_PATH
}

/** EPERM 在 Windows 上也可能是"进程存在但拿不到句柄",按**活着**处理;ESRCH 才是死。 */
export function isPidAlive(pid) {
  const n = Number(pid)
  if (!Number.isInteger(n) || n <= 0) return false
  try {
    process.kill(n, 0)
    return true
  } catch (e) {
    return e?.code === 'EPERM'
  }
}

/**
 * 读锁快照。三态:ok(读到并解析) / missing(文件不在) / error(读不出)。
 * `mtimeMs` 读不到时给 null —— 调用方不得把它当成"新鲜"。
 */
export function readLockSnapshot(path, { fs = nodeFs } = {}) {
  let text
  try {
    text = fs.readFileSync(path, 'utf8')
  } catch (e) {
    return { ok: false, missing: e?.code === 'ENOENT', code: e?.code ?? 'unknown', error: e }
  }
  const field = (k) => {
    const m = String(text).match(new RegExp(`^${k}=(.+)$`, 'm'))
    return m ? m[1].trim() : ''
  }
  let mtimeMs = null
  try {
    mtimeMs = fs.statSync(path).mtimeMs
  } catch {
    /* 读到了内容却 stat 不到:按"心跳未知"处理,不判死 */
  }
  return {
    ok: true,
    text,
    pid: Number(field('pid')) || 0,
    token: field('token'),
    createdAt: field('at'),
    host: field('host'),
    role: field('role'),
    staleMs: Number(field('staleMs')) || null,
    mtimeMs,
  }
}

function ageOf(snapshot, nowMs) {
  if (!Number.isFinite(snapshot?.mtimeMs)) return null
  return nowMs - snapshot.mtimeMs
}

function writeAll(fd, text, fs) {
  fs.writeFileSync(fd, text, 'utf8')
}

function tryCreate(path, { now, role, fs, staleMs = null }) {
  let fd
  try {
    fd = fs.openSync(path, 'wx')
  } catch (e) {
    if (e?.code === 'EEXIST') return { ok: false, kind: 'exists' }
    return { ok: false, kind: 'io', code: e?.code ?? 'unknown', error: e }
  }
  const token = nonce()
  const createdAt = new Date(now()).toISOString()
  const content =
    `pid=${process.pid}\ntoken=${token}\nat=${createdAt}\nhost=${hostname()}\nrole=${role}\n` +
    (Number(staleMs) > 0 ? `staleMs=${Number(staleMs)}\n` : '')
  try {
    writeAll(fd, content, fs)
    fs.closeSync(fd)
    fd = null
    return { ok: true, handle: { ok: true, path, token, pid: process.pid, createdAt, role, heartbeatSource: 'mtime' } }
  } catch (e) {
    try {
      if (fd !== null) fs.closeSync(fd)
    } catch {
      /* 关不掉也要把半成品删掉,否则下一轮会把它当成活锁 */
    }
    try {
      fs.unlinkSync(path)
    } catch {
      /* 删不掉就留给 stale 回收,不在错误路径上再抛一次 */
    }
    return { ok: false, kind: 'io', code: e?.code ?? 'unknown', error: e }
  }
}

/**
 * 清掉**别人的**陈旧回收门。只在"pid 已死"或"pid 读不出且龄超兜底"时动;
 * 同样走墓碑+身份回读,不允许两个清门者互删。
 */
function clearStaleReclaimGuard(guardPath, { now, fs }) {
  const snap = readLockSnapshot(guardPath, { fs })
  if (!snap.ok) return snap.missing === true
  if (snap.pid > 0) {
    if (isPidAlive(snap.pid)) return false
  } else {
    const age = ageOf(snap, now())
    if (age === null || age <= RECLAIM_GUARD_UNKNOWN_STALE_MS) return false
  }
  const tomb = `${guardPath}.dead.${nonce()}`
  try {
    fs.renameSync(guardPath, tomb)
  } catch {
    return false
  }
  const moved = readLockSnapshot(tomb, { fs })
  if (!moved.ok || moved.token !== snap.token || moved.pid !== snap.pid) {
    try {
      fs.renameSync(tomb, guardPath)
    } catch {
      /* 还原失败时保留墓碑:下一轮按"回收门仍被占"处理,不冒险 */
    }
    return false
  }
  try {
    fs.unlinkSync(tomb)
  } catch {
    /* 墓碑删不掉不影响结论:它已不在正式路径上 */
  }
  return true
}

/**
 * 死锁回收:`.reclaim` 门串行化 → 门内重读确认仍是那一份死锁 → rename 墓碑 →
 * 墓碑身份回读 → unlink。返回 kind:
 *   reclaimed / vanished / changed / alive-now / guard-busy / io-error
 */
export function reclaimDeadLock(
  path,
  expected,
  { staleMs = DEFAULT_STALE_MS, ioRetryDelayMs = DEFAULT_IO_RETRY_DELAY_MS, now = Date.now, fs = nodeFs, onAlert = null } = {},
) {
  const guardPath = `${path}.reclaim`
  const guardToken = nonce()
  let owned = false
  for (let attempt = 0; attempt < 4 && !owned; attempt += 1) {
    try {
      const fd = fs.openSync(guardPath, 'wx')
      try {
        writeAll(fd, `pid=${process.pid}\ntoken=${guardToken}\nat=${new Date(now()).toISOString()}\n`, fs)
      } finally {
        fs.closeSync(fd)
      }
      owned = true
    } catch (e) {
      if (e?.code === 'EEXIST') {
        if (clearStaleReclaimGuard(guardPath, { now, fs })) continue
        sleepSync(ioRetryDelayMs)
        continue
      }
      if (IO_RETRY_CODES.has(e?.code)) {
        sleepSync(ioRetryDelayMs)
        continue
      }
      return { kind: 'io-error', code: e?.code ?? 'unknown', why: `建回收门失败:${e?.message ?? e}` }
    }
  }
  if (!owned) return { kind: 'guard-busy' }

  try {
    // 门内重读:门外的判死可能是上一次快照,持有者可能刚好换成了别人。
    const fresh = readLockSnapshot(path, { fs })
    if (!fresh.ok) return { kind: fresh.missing ? 'vanished' : 'io-error', why: fresh.code }
    if (fresh.pid !== expected.pid || fresh.token !== expected.token) return { kind: 'changed' }
    if (isPidAlive(fresh.pid)) return { kind: 'alive-now' }
    const age = ageOf(fresh, now())
    // pid 读不出(半成品锁)时不能凭"没 pid"就秒回收:必须龄超 staleMs。
    if (!(fresh.pid > 0) && !(age !== null && age > staleMs)) return { kind: 'changed' }

    const tomb = `${path}.dead.${process.pid}.${Date.now().toString(36)}.${randomBytes(4).toString('hex')}`
    try {
      fs.renameSync(path, tomb)
    } catch (e) {
      if (e?.code === 'ENOENT') return { kind: 'vanished' }
      return { kind: 'io-error', code: e?.code ?? 'unknown', why: `rename 墓碑失败:${e?.message ?? e}` }
    }
    // 墓碑身份回读:确认挪走的确实是刚判死的那一份,而不是别人刚建的新锁。
    const moved = readLockSnapshot(tomb, { fs })
    if (!moved.ok || moved.token !== fresh.token || moved.pid !== fresh.pid) {
      try {
        if (!existsQuiet(path, fs)) fs.renameSync(tomb, path)
      } catch {
        /* 还原不了时保留墓碑,喊人比再造一个双持有者安全 */
      }
      onAlert?.('回收墓碑时发现锁已易主 ⇒ 本轮不接管(已尽力还原)')
      return { kind: 'changed' }
    }
    try {
      fs.unlinkSync(tomb)
    } catch {
      /* 墓碑残留不影响正式路径;下次按 .dead 前缀由巡检清理 */
    }
    return { kind: 'reclaimed' }
  } finally {
    try {
      fs.unlinkSync(guardPath)
    } catch {
      /* 门删不掉时它自己的 pid 已死,下一轮会被 clearStaleReclaimGuard 收掉 */
    }
  }
}

function existsQuiet(path, fs) {
  try {
    fs.statSync(path)
    return true
  } catch {
    return false
  }
}

const held = new Map()
/** path → { timer, token }:轮级心跳定时器。必须在释放/退出时清空,否则进程被拖住。 */
const heartbeats = new Map()
let handlersInstalled = false

function installProcessHandlers() {
  if (handlersInstalled) return
  handlersInstalled = true
  process.on('exit', () => releaseAllQuietly())
  const signals = [
    ['SIGINT', 130],
    ['SIGTERM', 143],
    ['SIGHUP', 129],
  ]
  for (const [sig, code] of signals) {
    process.once(sig, () => {
      releaseAllQuietly()
      process.exit(code)
    })
  }
}

function releaseAllQuietly() {
  for (const rec of heartbeats.values()) {
    clearInterval(rec.timer)
  }
  heartbeats.clear()
  for (const handle of [...held.values()]) {
    try {
      releaseGuardianLock(handle)
    } catch {
      /* 退出路径不得因释放失败改写退出码 */
    }
  }
}

/**
 * 取得轮级锁。
 *
 * 返回(ok=true):`{ok:true, path, token, pid, createdAt, role, heartbeatSource}`
 *   - `disabled:true` = `IHUI_GUARDIAN_LOCK_MODE=off`,零副作用;
 *   - `reentrant:true` = 本进程已持有同一路径(不再写第二份)。
 * 返回(ok=false):kind ∈ held / stale-alive / held-unknown / io-error / race / guard-busy
 *   - `stale-alive` 必须由调用方喊人;**本模块绝不偷活进程的锁**。
 */
export function acquireGuardianLock({
  path = null,
  role = 'git-guardian',
  staleMs = DEFAULT_STALE_MS,
  env = process.env,
  now = Date.now,
  maxIoRetries = DEFAULT_IO_RETRIES,
  ioRetryDelayMs = DEFAULT_IO_RETRY_DELAY_MS,
  failOpenOnIoError = false,
  onAlert = null,
  fs = nodeFs,
} = {}) {
  if (lockMode(env) === 'off') {
    return { ok: true, disabled: true, path: null, token: null, pid: process.pid, role }
  }
  const lockPath = resolveLockPath({ path, env })
  const existing = held.get(lockPath)
  if (existing) return { ...existing, ok: true, reentrant: true }

  try {
    fs.mkdirSync(dirname(lockPath), { recursive: true })
  } catch (e) {
    return ioFailure({ path: lockPath, code: e?.code, error: e, failOpenOnIoError })
  }

  let ioFailures = 0
  for (let attempt = 0; attempt < 6; attempt += 1) {
    const made = tryCreate(lockPath, { now, role, fs, staleMs })
    if (made.ok) {
      held.set(lockPath, made.handle)
      installProcessHandlers()
      return made.handle
    }
    if (made.kind === 'io') {
      if (IO_RETRY_CODES.has(made.code) && ioFailures < maxIoRetries) {
        ioFailures += 1
        sleepSync(ioRetryDelayMs)
        continue
      }
      return ioFailure({ path: lockPath, code: made.code, error: made.error, failOpenOnIoError })
    }

    const snap = readLockSnapshot(lockPath, { fs })
    if (!snap.ok) {
      if (snap.missing) continue // 回收者刚把锁挪走 ⇒ 立刻重试 wx
      return ioFailure({ path: lockPath, code: snap.code, error: snap.error, failOpenOnIoError })
    }
    const age = ageOf(snap, now())
    const alive = isPidAlive(snap.pid)
    if (alive) {
      if (age !== null && age > staleMs) {
        const r = {
          ok: false,
          kind: 'stale-alive',
          path: lockPath,
          pid: snap.pid,
          ageMs: age,
          why: `持有者 pid=${snap.pid} 仍存活但 heartbeat 已 ${Math.round(age / 1000)}s 未续(阈值 ${Math.round(staleMs / 1000)}s)⇒ 不偷锁,只喊人`,
        }
        onAlert?.(r.why)
        return r
      }
      return {
        ok: false,
        kind: 'held',
        path: lockPath,
        pid: snap.pid,
        ageMs: age,
        why: `另一轮持有锁(pid=${snap.pid},heartbeat ${age === null ? '未知' : `${Math.round(age / 1000)}s`})`,
      }
    }
    if (!(snap.pid > 0) && !(age !== null && age > staleMs)) {
      return {
        ok: false,
        kind: 'held-unknown',
        path: lockPath,
        pid: 0,
        ageMs: age,
        why: '锁文件内容不完整(无 pid)且未超 stale ⇒ 按持有中处理,不回收',
      }
    }

    const rec = reclaimDeadLock(lockPath, snap, { staleMs, ioRetryDelayMs, now, fs, onAlert })
    if (rec.kind === 'reclaimed' || rec.kind === 'vanished' || rec.kind === 'changed') continue
    if (rec.kind === 'alive-now') {
      return { ok: false, kind: 'held', path: lockPath, pid: snap.pid, ageMs: age, why: '回收门内复核发现持有者仍存活 ⇒ 放弃接管' }
    }
    if (rec.kind === 'guard-busy') {
      sleepSync(ioRetryDelayMs)
      continue
    }
    return ioFailure({ path: lockPath, code: rec.code, error: new Error(rec.why ?? '回收失败'), failOpenOnIoError })
  }
  return { ok: false, kind: 'race', path: lockPath, pid: 0, ageMs: null, why: '连续竞态未取得锁 ⇒ 本轮静默' }
}

function ioFailure({ path, code, error, failOpenOnIoError }) {
  const why = `锁面故障(不是"锁被占"):${code ?? 'unknown'} ${error?.message ?? ''}`.trim()
  if (failOpenOnIoError) return { ok: true, degraded: why, path, token: null, pid: process.pid, role: 'degraded' }
  return { ok: false, kind: 'io-error', path, code: code ?? 'unknown', pid: 0, ageMs: null, why }
}

/**
 * 续 heartbeat(mtime)。返回 `{ok:true, at}`;锁被挪走/易主 ⇒ `{ok:false, lost:true}`。
 * **不重写内容**:见头注第 6 条下面那段。
 */
export function heartbeatGuardianLock(handle, { env = process.env, now = Date.now, fs = nodeFs } = {}) {
  if (!handle || handle.disabled) return { ok: true, disabled: true, at: null }
  if (lockMode(env) === 'off') return { ok: true, disabled: true, at: null }
  const lockPath = typeof handle === 'string' ? resolve(handle) : handle.path
  const token = typeof handle === 'string' ? '' : handle.token
  if (!lockPath) return { ok: false, lost: true, why: '没有可续的锁路径' }
  const snap = readLockSnapshot(lockPath, { fs })
  if (!snap.ok) return { ok: false, lost: true, why: `锁文件已不在(${snap.code})` }
  if (token && (snap.token !== token || snap.pid !== process.pid)) {
    return { ok: false, lost: true, why: `锁已易主(token=${snap.token || '(空)'})⇒ 不续别人的锁` }
  }
  const at = new Date(now())
  try {
    fs.utimesSync(lockPath, at, at)
    return { ok: true, at: at.toISOString(), heartbeatSource: 'mtime' }
  } catch (e) {
    return { ok: false, lost: e?.code === 'ENOENT', why: `续 heartbeat 失败:${e?.code ?? ''} ${e?.message ?? e}`.trim() }
  }
}

/**
 * 轮级锁心跳定时器(2026-11-03):长轮次期间每 `intervalMs` 续一次 mtime。
 *
 * 为什么需要:计划任务/守护的轮次是同步 `execFileSync` 串起来的,事件循环在单步里被阻塞,
 * 只在轮首续一次 ⇒ 任何超过 staleMs 的步骤都会把锁变成 `stale-alive`。
 *
 * 约束:
 *   - 定时器 `unref()`,不拖住进程退出;`releaseGuardianLock` / `process.on('exit')` 都会 clearInterval;
 *   - 续不上(锁被挪走/易主)⇒ 立刻停表并只回调一次 `onLost`,绝不偷别人的锁。
 */
export function startHeartbeatGuardianLock(
  handle,
  { intervalMs = 30_000, env = process.env, now = Date.now, fs = nodeFs, onLost = null } = {},
) {
  const period = Math.max(1_000, Number(intervalMs) || 30_000)
  if (!handle || handle.disabled || !handle.path || !handle.token) {
    return { started: false, stop: () => {}, intervalMs: period }
  }
  const stop = () => {
    const rec = heartbeats.get(handle.path)
    if (rec && rec.token === handle.token) {
      clearInterval(rec.timer)
      heartbeats.delete(handle.path)
    }
  }
  const fire = () => {
    const r = heartbeatGuardianLock(handle, { env, now, fs })
    if (!r.ok) {
      stop()
      if (typeof onLost === 'function') onLost(r)
    }
    return r
  }
  stop() // 同路径换持者时绝不留旧表
  const timer = setInterval(fire, period)
  if (typeof timer.unref === 'function') timer.unref()
  heartbeats.set(handle.path, { timer, token: handle.token })
  const first = fire()
  return { started: true, intervalMs: period, firstOk: first.ok, firstAt: first.at ?? null, stop }
}

/**
 * 释放。只删 token 与 pid 都对得上的那一份。
 * `releaseGuardianLock()` 不带参数 = 释放本进程持有的全部(给 exit/信号路径用)。
 */
export function releaseGuardianLock(handle = null, { env = process.env, fs = nodeFs } = {}) {
  if (lockMode(env) === 'off') return { released: false, disabled: true, why: '锁未启用' }
  if (handle === null || handle === undefined) {
    const results = [...held.values()].map((h) => releaseGuardianLock(h, { env, fs }))
    return { released: results.some((r) => r.released), results }
  }
  const lockPath = typeof handle === 'string' ? resolve(handle) : handle.path
  const token = typeof handle === 'string' ? '' : handle.token
  if (!lockPath) return { released: false, why: '没有可释放的锁路径' }
  const hb = heartbeats.get(lockPath)
  if (hb && (!token || hb.token === token)) {
    clearInterval(hb.timer)
    heartbeats.delete(lockPath)
  }
  const snap = readLockSnapshot(lockPath, { fs })
  if (!snap.ok) {
    held.delete(lockPath)
    return { released: false, why: `锁文件已不在(${snap.code})` }
  }
  if (snap.pid !== process.pid || (token && snap.token !== token)) {
    held.delete(lockPath)
    return { released: false, why: '锁已易主 ⇒ 不删别人的锁' }
  }
  try {
    fs.unlinkSync(lockPath)
    held.delete(lockPath)
    return { released: true }
  } catch (e) {
    return { released: false, why: `删锁失败:${e?.code ?? ''} ${e?.message ?? e}`.trim() }
  }
}

/** 只读体检(验收脚本用):不建文件、不续心跳、不删锁。 */
export function inspectGuardianLock({ path = null, env = process.env, staleMs = DEFAULT_STALE_MS, now = Date.now } = {}) {
  const mode = lockMode(env)
  const lockPath = resolveLockPath({ path, env })
  if (mode === 'off') return { mode, path: lockPath, exists: false, state: 'disabled' }
  const snap = readLockSnapshot(lockPath)
  if (!snap.ok) {
    return { mode, path: lockPath, exists: false, state: snap.missing ? 'absent' : 'unreadable', code: snap.code }
  }
  const ageMs = ageOf(snap, now())
  const alive = isPidAlive(snap.pid)
  // 锁面自带声明阈值(长步骤轮次会写 21min):体检按持有者声明判,旧锁无此字段才回落调用方阈值。
  const effectiveStaleMs = Number(snap.staleMs) > 0 ? Number(snap.staleMs) : staleMs
  const stale = ageMs !== null && ageMs > effectiveStaleMs
  const state = alive ? (stale ? 'stale-alive' : 'held') : snap.pid > 0 ? 'dead' : 'held-unknown'
  return {
    mode,
    path: lockPath,
    exists: true,
    state,
    pid: snap.pid,
    token: snap.token,
    createdAt: snap.createdAt,
    host: snap.host,
    role: snap.role,
    heartbeatAgeMs: ageMs,
    stale,
    staleMs: effectiveStaleMs,
    alive,
  }
}

export const __test__ = {
  nonce,
  sleepSync,
  readLockSnapshot,
  isPidAlive,
  tryCreate,
  reclaimDeadLock,
  clearStaleReclaimGuard,
  heldCount: () => held.size,
  LOCK_PATH_ENV,
  MODE_ENV,
}
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
