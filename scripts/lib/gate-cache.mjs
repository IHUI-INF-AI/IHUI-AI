// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * gate-cache.mjs — 门结果缓存(2026-11-07 立,feat/gate-cache-1107)。
 *
 * 要解决的真问题:一次推送 13 门串行约 129 秒;被拒一次就全额重跑;同一个树算过一次还要再算。
 * 本模块把"重复计算"从"尽量少"改成"结构上不可能":同一 (tree sha, gate id, 工具版本, 声明输入配置哈希)
 * 只允许存在一份结果,命中即复用。
 *
 * 缓存键(完整构成,任一变化 ⇒ 视为未命中):
 *   key = sha256( canonicalJson({
 *     schemaVersion,   // 记录格式版本,升格即全量失效
 *     treeSha,         // 被测树的 git tree sha(不是 commit、不是工作区)
 *     gateId,          // 注册表里的门 id
 *     toolVersion,     // 门的工具版本(默认 = node 主版本 + 门脚本 blob sha 前 16 位)
 *     configHash,      // 该门声明输入的配置哈希(输入清单 + 各输入的 blob sha + 额外配置)
 *   }) )
 *   configHash = sha256( canonicalJson({ inputs: [...排序后的声明输入], blobShas: {path: sha|null}, extra }) )
 *
 * 存储:`.git/ihui-gate-cache/v1/<key>.json`(不进仓库、不进提交;worktree 归一为主 gitdir)。
 * 每条记录字段:rc / durationMs / startedAt / finishedAt / treeSha / gateId / key / toolVersion /
 * stdoutSha / schemaVersion。
 *
 * fail-closed 七条(每条都有夹具):
 *   ① 未命中 ⇒ 返回 `{status:'miss'}`,**不携带任何绿字段**;调用方必须自己跑。
 *   ② 记录损坏 / 字段缺失 / schemaVersion 不符 ⇒ 当未命中。
 *   ③ treeSha 与本次实际不符 ⇒ 当未命中。
 *   ④ key / gateId / toolVersion 与本次不符 ⇒ 当未命中。
 *   ⑤ 并发同键 ⇒ 文件锁(O_CREAT|O_EXCL);等锁的一方**读结果**而不是自己重跑。
 *   ⑥ 死锁可自愈(判 pid 活否),**绝不删活锁**;活锁只返回 held,交调用方等或判未判定。
 *   ⑦ rc !== 0 的记录可以命中,但 `green` 恒为 false —— rc=2(未判定)绝不被当成绿。
 */

import { createHash, randomBytes } from 'node:crypto'
import {
  closeSync,
  existsSync,
  mkdirSync,
  openSync,
  readFileSync,
  renameSync,
  statSync,
  unlinkSync,
  writeFileSync,
} from 'node:fs'
import { hostname } from 'node:os'
import { dirname, join } from 'node:path'

export const SCHEMA_VERSION = 1
export const CACHE_ROOT_REL = join('ihui-gate-cache', 'v1')
export const LOCK_SUFFIX = '.lock'
export const DEFAULT_WAIT_MS = 30_000
export const DEFAULT_POLL_MS = 50
/** 记录字段的**唯一**清单:缺一即「损坏」,不做"旧记录兼容"。 */
export const RECORD_FIELDS = Object.freeze([
  'rc',
  'durationMs',
  'startedAt',
  'finishedAt',
  'treeSha',
  'gateId',
  'key',
  'toolVersion',
  'stdoutSha',
  'schemaVersion',
])

const SLEEP_CELL = new Int32Array(new SharedArrayBuffer(4))

/** 同步短等待:锁的重试/回收路径是同步的,不能靠定时器把窗口让出去。 */
export function sleepSync(ms) {
  if (!(ms > 0)) return
  Atomics.wait(SLEEP_CELL, 0, 0, ms)
}

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms))
}

// ── 哈希与规范化 ────────────────────────────────────────────────────────────

export function sha256Hex(data) {
  return createHash('sha256').update(data).digest('hex')
}

/** 键序无关的确定性 JSON:同一逻辑对象永远得到同一字节串。 */
export function canonicalJson(value) {
  const walk = (v) => {
    if (v === null || typeof v !== 'object') return v
    if (Array.isArray(v)) return v.map(walk)
    const out = {}
    for (const k of Object.keys(v).sort()) out[k] = walk(v[k])
    return out
  }
  return JSON.stringify(walk(value))
}

function requireNonEmpty(value, name) {
  if (typeof value !== 'string' || value.trim() === '') {
    throw new TypeError(`gate-cache: ${name} 必须是非空字符串`)
  }
  return value
}

/**
 * 声明输入的配置哈希。`blobShas` 由调用方按**被测树**取 blob sha(不是读工作区);
 * 取不到时用 null —— null 也是键的一部分,"输入缺了"与"输入变成另一个"不会互相冒充。
 */
export function computeConfigHash({ inputs = [], blobShas = {}, extra = null } = {}) {
  const normalizedInputs = [...new Set(inputs.map((p) => String(p).replace(/\\/g, '/')))].sort()
  const normalizedBlobs = {}
  for (const p of normalizedInputs) {
    const v = blobShas[p]
    normalizedBlobs[p] = typeof v === 'string' && v !== '' ? v : null
  }
  return sha256Hex(canonicalJson({ inputs: normalizedInputs, blobShas: normalizedBlobs, extra }))
}

/** 缓存键的唯一算法。任一构成项为空/非字符串 ⇒ 抛错(宁可跑不起来,也不生成可碰撞的键)。 */
export function computeCacheKey({
  treeSha,
  gateId,
  toolVersion,
  configHash,
  schemaVersion = SCHEMA_VERSION,
}) {
  const payload = {
    schemaVersion,
    treeSha: requireNonEmpty(treeSha, 'treeSha'),
    gateId: requireNonEmpty(gateId, 'gateId'),
    toolVersion: requireNonEmpty(toolVersion, 'toolVersion'),
    configHash: requireNonEmpty(configHash, 'configHash'),
  }
  return sha256Hex(canonicalJson(payload))
}

// ── 落点 ──────────────────────────────────────────────────────────────────

/** 缓存目录:显式 cacheDir 优先(夹具用),否则 `<真实 gitdir>/ihui-gate-cache/v1`。 */
export function cacheDirFor({ gitDir, cacheDir } = {}) {
  if (typeof cacheDir === 'string' && cacheDir.trim() !== '') return cacheDir
  requireNonEmpty(gitDir, 'gitDir')
  return join(gitDir, CACHE_ROOT_REL)
}

export function recordPathFor({ key, ...rest }) {
  return join(cacheDirFor(rest), `${requireNonEmpty(key, 'key')}.json`)
}

export function lockPathFor({ key, ...rest }) {
  return join(cacheDirFor(rest), `${requireNonEmpty(key, 'key')}${LOCK_SUFFIX}`)
}

// ── 记录校验 ──────────────────────────────────────────────────────────────

/**
 * 记录 → 判定。任何"读不懂 / 少字段 / 版本不符 / 与本次身份不符"都折成 `{ok:false, reason}`,
 * 由 `lookup` 统一折成 miss。这里**不**判断 rc 是不是绿:rc 的语义只归 `isGreen` 一处。
 */
export function verifyRecord(record, expect = {}) {
  if (!record || typeof record !== 'object' || Array.isArray(record)) {
    return { ok: false, reason: 'corrupt:not-object' }
  }
  for (const field of RECORD_FIELDS) {
    if (!Object.prototype.hasOwnProperty.call(record, field)) {
      return { ok: false, reason: `missing-field:${field}` }
    }
  }
  if (record.schemaVersion !== SCHEMA_VERSION) {
    return { ok: false, reason: `schema-version:${String(record.schemaVersion)}` }
  }
  if (!Number.isInteger(record.rc) || record.rc < 0 || record.rc > 255) {
    return { ok: false, reason: 'corrupt:rc' }
  }
  if (!Number.isFinite(record.durationMs) || record.durationMs < 0) {
    return { ok: false, reason: 'corrupt:durationMs' }
  }
  for (const field of ['startedAt', 'finishedAt', 'stdoutSha']) {
    if (typeof record[field] !== 'string') return { ok: false, reason: `corrupt:${field}` }
  }
  for (const field of ['treeSha', 'gateId', 'key', 'toolVersion']) {
    if (typeof record[field] !== 'string' || record[field] === '') {
      return { ok: false, reason: `corrupt:${field}` }
    }
  }
  if (expect.treeSha !== undefined && record.treeSha !== expect.treeSha) {
    return { ok: false, reason: 'tree-mismatch' }
  }
  if (expect.gateId !== undefined && record.gateId !== expect.gateId) {
    return { ok: false, reason: 'gate-mismatch' }
  }
  if (expect.key !== undefined && record.key !== expect.key) {
    return { ok: false, reason: 'key-mismatch' }
  }
  if (expect.toolVersion !== undefined && record.toolVersion !== expect.toolVersion) {
    return { ok: false, reason: 'tool-version-mismatch' }
  }
  return { ok: true }
}

/** 唯一一处"什么叫绿":rc === 0。rc=1(拒)与 rc=2(未判定)都不是绿。 */
export function isGreen(record) {
  return Boolean(record) && record.rc === 0
}

/**
 * 读缓存。命中返回 rc/green/record;未命中返回 `{status:'miss', reason}`。
 * 注意:miss 结果**没有** green 字段 —— 未命中在结构上不可能被当成绿。
 */
export function lookup({ key, treeSha, gateId, toolVersion, ...rest }) {
  const path = recordPathFor({ key, ...rest })
  if (!existsSync(path)) return { status: 'miss', reason: 'no-record' }
  let record
  try {
    record = JSON.parse(readFileSync(path, 'utf8'))
  } catch (error) {
    return { status: 'miss', reason: `unreadable-or-corrupt:${error?.code ?? error?.name ?? 'parse'}` }
  }
  const verdict = verifyRecord(record, { key, treeSha, gateId, toolVersion })
  if (!verdict.ok) return { status: 'miss', reason: verdict.reason }
  return { status: 'hit', rc: record.rc, green: isGreen(record), record }
}

/** 原子写记录:先落唯一临时名,再 rename 到键路径(内容寻址,重复覆盖幂等)。 */
export function writeRecord({ record, ...rest }) {
  const dir = cacheDirFor(rest)
  mkdirSync(dir, { recursive: true })
  const target = recordPathFor({ key: record?.key, ...rest })
  const tmp = join(dir, `.tmp-${process.pid}-${Date.now().toString(36)}-${randomBytes(6).toString('hex')}`)
  writeFileSync(tmp, `${canonicalJson(record)}\n`, { encoding: 'utf8', flag: 'wx' })
  try {
    renameSync(tmp, target)
  } catch (error) {
    // Windows 上 rename 覆盖已存在文件可能 EPERM/EEXIST:内容相同,删旧再换即可。
    if (!['EPERM', 'EEXIST', 'EACCES'].includes(error?.code)) {
      try {
        unlinkSync(tmp)
      } catch {
        /* 临时文件清不掉不改变主判定 */
      }
      throw error
    }
    try {
      unlinkSync(target)
    } catch {
      /* 目标已被别人删掉 = 我们直接 rename */
    }
    renameSync(tmp, target)
  }
  return target
}

// ── 进程活性与锁 ──────────────────────────────────────────────────────────

/** EPERM 在 Windows 上 = 进程存在但拿不到句柄,按**活着**处理;ESRCH 才是死。 */
export function pidAlive(pid, { kill = process.kill } = {}) {
  const n = Number(pid)
  if (!Number.isInteger(n) || n <= 0) return false
  try {
    kill(n, 0)
    return true
  } catch (error) {
    return error?.code === 'EPERM'
  }
}

/** 读锁快照。missing=锁不在;unreadable=读到了但不是合法锁(不猜、不删)。 */
export function readLock(lockPath) {
  let text
  try {
    text = readFileSync(lockPath, 'utf8')
  } catch (error) {
    return { ok: false, missing: error?.code === 'ENOENT', code: error?.code ?? 'unknown' }
  }
  let data
  try {
    data = JSON.parse(text)
  } catch {
    return { ok: false, missing: false, code: 'corrupt' }
  }
  let mtimeMs = null
  try {
    mtimeMs = statSync(lockPath).mtimeMs
  } catch {
    /* 刚被挪走:活着性判定不依赖 mtime */
  }
  return { ok: true, data, mtimeMs }
}

/**
 * 回收死锁:rename 成**唯一**墓碑 → 回读身份 → 确认是同一把锁 → 才 unlink。
 * 身份不符(读与挪之间已易主)⇒ 尽力把墓碑放回去,绝不删别人的锁。
 */
export function reclaimDeadLock({ lockPath, token }) {
  const tomb = `${lockPath}.stale-${process.pid}-${Date.now().toString(36)}-${randomBytes(4).toString('hex')}`
  try {
    renameSync(lockPath, tomb)
  } catch (error) {
    if (error?.code === 'ENOENT') return { ok: true, note: 'already-gone' }
    return { ok: false, reason: `rename-failed:${error?.code ?? 'unknown'}` }
  }
  let moved = null
  try {
    moved = JSON.parse(readFileSync(tomb, 'utf8'))
  } catch {
    moved = null
  }
  if (!moved || moved.token !== token) {
    // 挪走的不是我们判死的那把锁:放回去(目标已存在则保留墓碑,交人工判断)。
    if (!existsSync(lockPath)) {
      try {
        renameSync(tomb, lockPath)
      } catch {
        /* 放不回去也不能删 */
      }
    }
    return { ok: false, reason: 'identity-changed' }
  }
  try {
    unlinkSync(tomb)
  } catch (error) {
    return { ok: false, reason: `unlink-failed:${error?.code ?? 'unknown'}` }
  }
  return { ok: true, note: 'reclaimed' }
}

/**
 * 取锁。成功返回 release();失败返回 reason:
 *   held          —— 持有者 pid 还活着(或异机无法判活),**锁原样保留**。
 *   lock-unreadable —— 锁文件存在但读不懂,不删。
 *   io-error      —— EPERM/EBUSY/EACCES 等锁面故障,不伪造 held。
 */
export function tryAcquireLock({
  lockPath,
  retries = 4,
  retryDelayMs = 25,
  host = hostname(),
  kill = process.kill,
  now = Date.now,
  body = null,
} = {}) {
  mkdirSync(dirname(lockPath), { recursive: true })
  for (let attempt = 0; attempt <= retries; attempt += 1) {
    const token = `${process.pid}-${now().toString(36)}-${randomBytes(6).toString('hex')}`
    let fd
    try {
      fd = openSync(lockPath, 'wx')
      writeFileSync(
        fd,
        `${JSON.stringify({
          pid: process.pid,
          host,
          startedAt: new Date(now()).toISOString(),
          token,
          ...(body && typeof body === 'object' ? { body } : {}),
        })}\n`,
        'utf8',
      )
      closeSync(fd)
      fd = undefined
      return {
        acquired: true,
        token,
        release() {
          const snap = readLock(lockPath)
          if (snap.ok && snap.data?.token === token) {
            try {
              unlinkSync(lockPath)
            } catch {
              /* 已被别人回收:放手,不删别人的锁 */
            }
          }
        },
      }
    } catch (error) {
      if (fd !== undefined) {
        try {
          closeSync(fd)
        } catch {
          /* ignore */
        }
      }
      if (error?.code === 'ENOENT') {
        sleepSync(retryDelayMs)
        continue
      }
      if (error?.code !== 'EEXIST') {
        return { acquired: false, reason: 'io-error', code: error?.code ?? 'unknown' }
      }
      const snap = readLock(lockPath)
      if (!snap.ok) {
        if (snap.missing) continue
        return { acquired: false, reason: 'lock-unreadable' }
      }
      const holder = snap.data ?? {}
      const sameHost = !holder.host || holder.host === host
      if (sameHost && !pidAlive(holder.pid, { kill })) {
        const reclaimed = reclaimDeadLock({ lockPath, token: holder.token })
        if (reclaimed.ok) continue
        return { acquired: false, reason: `reclaim-failed:${reclaimed.reason}` }
      }
      return {
        acquired: false,
        reason: 'held',
        holder: { pid: holder.pid, host: holder.host, startedAt: holder.startedAt },
      }
    }
  }
  return { acquired: false, reason: 'retry-exhausted' }
}

// ── 组合入口 ──────────────────────────────────────────────────────────────

function normalizeRc(raw) {
  return Number.isInteger(raw) && raw >= 0 && raw <= 255 ? raw : 70
}

/**
 * 命中即返回;未命中则取锁执行 `run()`,写记录后释放。
 *
 * 并发同键:
 *   · 先到者持锁执行;
 *   · 后来者拿不到锁(持有者活着)⇒ **轮询缓存**,读到结果直接返回(source='waiter'),不重跑;
 *   · 持有者中途死掉 ⇒ 下一次轮询会自愈死锁并接手;
 *   · 等不到结果 ⇒ `{status:'undetermined', green:false}`,绝不冒充绿。
 *
 * 返回值:
 *   { status:'hit', rc, green, record, source:'direct'|'waiter'|'waiter-double-check' }
 *   { status:'run', rc, green, record, durationMs, stdout, stderr }
 *   { status:'undetermined', reason, green:false }
 */
export async function withGateCache({
  key,
  treeSha,
  gateId,
  toolVersion,
  run,
  waitMs = DEFAULT_WAIT_MS,
  pollMs = DEFAULT_POLL_MS,
  now = Date.now,
  sleepFn = sleep,
  ...rest
}) {
  if (typeof run !== 'function') throw new TypeError('gate-cache: run 必须是函数')
  const identity = { key, treeSha, gateId, toolVersion }

  const first = lookup({ ...identity, ...rest })
  if (first.status === 'hit') return { ...first, source: 'direct' }

  const lockPath = lockPathFor({ key, ...rest })
  let lock = tryAcquireLock({ lockPath, now })
  if (!lock.acquired && lock.reason === 'held') {
    const deadline = now() + waitMs
    while (now() < deadline) {
      await sleepFn(Math.max(1, pollMs))
      const again = lookup({ ...identity, ...rest })
      if (again.status === 'hit') return { ...again, source: 'waiter' }
      const snap = readLock(lockPath)
      const holder = snap.ok ? snap.data : null
      const holderDead = holder && (!holder.host || holder.host === hostname()) && !pidAlive(holder.pid)
      if (!snap.ok || holderDead) {
        lock = tryAcquireLock({ lockPath, now })
        if (lock.acquired) break
      }
    }
    if (!lock.acquired) return { status: 'undetermined', reason: 'lock-wait-timeout', green: false }
  }
  if (!lock.acquired) {
    return { status: 'undetermined', reason: lock.reason, green: false, detail: lock }
  }

  try {
    // 等锁期间别人可能已写完:持锁后必须复核,避免第二份结果覆盖第一份。
    const second = lookup({ ...identity, ...rest })
    if (second.status === 'hit') return { ...second, source: 'waiter-double-check' }

    const startedAt = new Date(now()).toISOString()
    const t0 = now()
    let result
    try {
      result = await run()
    } catch (error) {
      result = { rc: 70, stdout: '', stderr: String(error?.stack ?? error) }
    }
    const durationMs = Math.max(0, now() - t0)
    const stdout = typeof result?.stdout === 'string' ? result.stdout : ''
    const record = {
      schemaVersion: SCHEMA_VERSION,
      key,
      treeSha,
      gateId,
      toolVersion,
      rc: normalizeRc(result?.rc),
      durationMs,
      startedAt,
      finishedAt: new Date(now()).toISOString(),
      stdoutSha: sha256Hex(stdout),
    }
    try {
      writeRecord({ record, ...rest })
    } catch (error) {
      // 写缓存失败不改判门本身的结果,但必须让调用方看见"这次没被缓存"。
      return {
        status: 'run',
        rc: record.rc,
        green: record.rc === 0,
        record,
        durationMs,
        stdout,
        stderr: typeof result?.stderr === 'string' ? result.stderr : '',
        cacheWriteError: String(error?.message ?? error),
      }
    }
    return {
      status: 'run',
      rc: record.rc,
      green: record.rc === 0,
      record,
      durationMs,
      stdout,
      stderr: typeof result?.stderr === 'string' ? result.stderr : '',
    }
  } finally {
    lock.release()
  }
}
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
