// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

// 机器级 typecheck 串行锁(2026-11-07 立;替代 scripts/typecheck-full.mjs 里 2026-09-18 的内联锁)。
//
// 立因:300s 单门看门狗本身没问题,问题是同一台机器上多个会话同时跑全量 typecheck ——
// 一次测量里混进了别人的 CPU,读数不可解释。本锁不调阈值,只把"并发占用"显式化:
//   · 锁空闲 ⇒ 行为与改造前完全一致(直接跑);
//   · 锁被活进程持有 ⇒ 串行等待,日志点名持锁者(pid/启动时刻/仓库/已持有时长);
//   · 等到上限仍拿不到 ⇒ 调用方输出「未判定(并发占用)」,不是通过、不是失败、不静默跳过。
//
// 旧内联锁的三处病灶(本文件逐条修掉,不是"顺手优化"):
//   ① 只有 pid+时间戳,无进程启动时刻 ⇒ pid 被别的进程复用时判活恒真,锁永远不清理;
//   ② 等不到锁时无限等待 ⇒ 一次并发占用被拖成 20min 的"挂死"读数;
//   ③ 清理路径先"判死"再"删目录",两步之间没有身份复核 ⇒ 可能删掉刚建好的新锁。
//
// 形式:创建/陈旧认领/身份核对**各只一份实现**,全部复用仓内既有原语:
//   - 原子创建 = scripts/lib/lock-atomic-init.mjs(唯一 pending 目录写全 meta ⇒ rename 成正式锁):
//     正式路径在 rename 之前就已完整,竞争者不可能看到"目录在而 meta 还没有"的半成品窗口。
//     判据 2 那条"正式路径已存在才进冲突分支"也照旧,绝不把一次权限故障读成抢占授权。
//   - 陈旧认领 = scripts/lib/stale-lock-claim.mjs(rename 成墓碑 ⇒ 回读身份 ⇒ 不一致则还原):
//     判死与删除之间插进新持有者时,回读的 token 对不上 ⇒ 原样放回,**不删**。
//   - 身份三态 = scripts/lib/proc-identity.mjs(match / mismatch / unverifiable):
//     mismatch 才算"pid 被复用";unverifiable(探针不可用/跨机/没记启动时间)一律按活锁保守处理,
//     **绝不据此判死** —— 方向是"少抢一把",抢错的代价是两场全量 typecheck 同时跑。
//
// 锁落 os.tmpdir():进程锁不该进仓库目录,且 safe-delete shim 对 os.tmpdir() 放行。
//
// ─── 本文件在 api 席 2026-11-07 那把锁之上的三处补口(不另起第四把)──────────────
//   ① FIFO 排队公平性:锁旁边开 `<lock>.queue/`,每个等待者先落一张票据
//      (createdAt/token/pid/pidStart/expiresAt),**只有队首才允许尝试 create**。
//      没有它时,新来者可以反复插队,持锁者一释放就被最吵的那个抢走 ——「最坏等待有界」
//      只在单等待者时成立。票据的死亡判据复用同一套 pidAlive;过期票据按自己的
//      `expiresAt`(等待上限 + 宽限)清理,所以队首进程即使被硬杀也不会永久堵住队列。
//   ② 作用域裁定:**N=1 机器级**。全量档实测 c=4 时 node 工作集峰值 12.83GB,本机
//      31.8GB 总量 / 起跑空闲 11.8GB —— 两份全量 tsc 会互相换页,读数比"混入别人 CPU"
//      更不可解释。原始目的是防 `pnpm -r` 进程洪水,但「能不能容下两份」这一维没有证据,
//      所以不按 worktree 分槽、也不做 N=2 信号量;单槽 + deadline + FIFO 是当前唯一
//      能自证的档。若将来内存实测能容两份,再把这个常量提为可选 scope(同一套 FIFO 的
//      实例化,不是新锁)。
//   ③ 心跳:持有者主流程是 spawnSync(阻塞事件循环),同步打心跳必然停摆;因此心跳由
//      一个 detached `node -e` 子进程每 10s 原子写 `heartbeat.json`(token+at)。判据:
//      token 匹配且 age < 3×interval ⇒ 存活;age 超限 **且** 身份=match **且** 已持锁
//      > 2min ⇒ 判 `stalled` 可认领。心跳文件缺失且无 `heartbeat-unsupported` 标记 ⇒
//      仍按活锁保守处理(旧锁/探针不可用时绝不据此判死)。

import { mkdirSync, readFileSync, readdirSync, renameSync, rmSync, statSync, unlinkSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'
import { hostname, tmpdir } from 'node:os'
import { randomBytes } from 'node:crypto'
import { spawn } from 'node:child_process'
import { setTimeout as sleep } from 'node:timers/promises'
import { createLockDirectoryAtomically } from './lock-atomic-init.mjs'
import { claimStaleLockCore } from './stale-lock-claim.mjs'
import { identityFields, verifyHolder } from './proc-identity.mjs'

export const DEFAULT_LOCK_PATH = join(tmpdir(), 'ihui-typecheck-full.lock')
/** 等待上限默认 120s:再长就会撞 300s 单门看门狗,把"显式未判定"变回"被超时杀掉"。 */
export const DEFAULT_WAIT_MS = 120_000
export const DEFAULT_POLL_MS = 2_000
/** 只有目录、meta 还没落盘(旧实现创建中途被打断)的宽限;超过才按陈旧处理。 */
const META_GRACE_MS = 30_000
/** 持锁者信息重打印间隔(等待期间每 15s 点名一次)。 */
const HOLDER_LOG_INTERVAL_MS = 15_000

/** FIFO 票据队列目录:正式锁的同级兄弟(与 lock-atomic-init 的 pending 同形)。 */
const QUEUE_DIR_SUFFIX = '.queue'
/** 票据过期宽限:超过"等待上限 + 本值"即清,保证队首被硬杀也不会永久堵队列。 */
export const TICKET_GRACE_MS = 30_000

/** 心跳子进程写盘间隔;判死门槛取 3×interval,避免一次 GC/调度抖动就被认领。 */
export const HEARTBEAT_INTERVAL_MS = 10_000
export const HEARTBEAT_STALE_MS = HEARTBEAT_INTERVAL_MS * 3
/** 心跳断供也要先排除"刚开始跑"的误伤:持锁超过 2min 才允许判 stalled。 */
export const STALLED_MIN_HELD_MS = 120_000
const HEARTBEAT_FILE = 'heartbeat.json'
const HEARTBEAT_OFF_FILE = 'heartbeat-unsupported.json'

function metaPath(dir) {
  return join(dir, 'meta.json')
}

/** 读 meta(容忍半写入/缺失)。 */
export function readLockMeta(dir) {
  try {
    const m = JSON.parse(readFileSync(metaPath(dir), 'utf8'))
    return typeof m === 'object' && m !== null ? m : null
  } catch {
    return null
  }
}

/** meta 的唯一身份凭据:陈旧认领回读时只比 token。 */
function tokenOf(meta) {
  return typeof meta?.token === 'string' && meta.token !== '' ? meta.token : null
}

/**
 * 记录侧与现测侧必须**同一把尺子**:启动时刻走 proc-identity 的探针值,不用 uptime 反推。
 * 本机实证:探针读数与 `Date.now()-uptime` 差 28800s(CIM 的 DateTime 按本地时区算),
 * 拿 uptime 记、拿探针比 ⇒ 任何锁都被判成"pid 复用"⇒ 抢活锁。
 * 探针不可用 ⇒ pidStart 不落键 ⇒ 后续一律 unverifiable(按活锁保守处理),不猜。
 */
function selfIdentity() {
  return identityFields()
}

function isPidAlive(pid) {
  const n = Number(pid)
  if (!Number.isFinite(n) || n <= 0) return false
  try {
    process.kill(n, 0)
    return true
  } catch (e) {
    return e.code === 'EPERM'
  }
}

function holderOf(meta, nowMs) {
  if (!meta) return null
  const startedMs = Date.parse(String(meta.startedAt ?? ''))
  return {
    pid: Number(meta.pid) || null,
    pidStart: Number(meta.pidStart) || null,
    repo: meta.repo ?? null,
    role: meta.role ?? null,
    startedAt: meta.startedAt ?? null,
    host: meta.host ?? null,
    token: meta.token ?? null,
    heldMs: Number.isFinite(startedMs) ? Math.max(0, nowMs - startedMs) : null,
  }
}

/** 人读的持锁者描述:pid/启动时刻/仓库/已持有时长。 */
export function describeLockHolder(holder) {
  if (!holder) return 'pid=未知(锁目录存在但 meta 缺失或不可读)'
  const held =
    holder.heldMs === null || holder.heldMs === undefined
      ? '未知'
      : `${(holder.heldMs / 1000).toFixed(1)}s`
  return `pid=${holder.pid ?? '未知'} 进程启动时刻(探针读数)=${holder.pidStart ?? '未知'} 仓库=${holder.repo ?? '未知'} 角色=${holder.role ?? '未知'} 开始于=${holder.startedAt ?? '未知'} 已持有时长=${held}`
}

// ─── 心跳(外置子进程)────────────────────────────────────────────────────
function heartbeatPath(dir) {
  return join(dir, HEARTBEAT_FILE)
}

export function readHeartbeat(dir) {
  try {
    const h = JSON.parse(readFileSync(heartbeatPath(dir), 'utf8'))
    return typeof h === 'object' && h !== null ? h : null
  } catch {
    return null
  }
}

/** 心跳起不来(无 node/子进程被禁)时留下的标记:该档**永不**因缺心跳被判死。 */
function heartbeatUnsupported(dir) {
  try {
    statSync(join(dir, HEARTBEAT_OFF_FILE))
    return true
  } catch {
    return false
  }
}

function markHeartbeatUnsupported(dir, token) {
  try {
    writeFileSync(join(dir, HEARTBEAT_OFF_FILE), JSON.stringify({ token, at: Date.now() }))
  } catch {
    /* 标记写不下 ⇒ 落回"无心跳 = 按活锁保守处理",不改变判定方向 */
  }
}

// detached `node -e`:持有者主线程被 spawnSync 阻塞时,只有另一个进程能续心跳。
// 子进程唯一职责:meta.token 未变、父 pid 仍活 ⇒ 原子写 heartbeat.json;任一不成立即退出。
const HEARTBEAT_CHILD_SCRIPT = `
const { readFileSync, writeFileSync, renameSync } = require('node:fs')
const { join } = require('node:path')
const [dir, token, intervalMs, parentPid] = process.argv.slice(1)
const hb = join(dir, 'heartbeat.json')
const alive = (pid) => { try { process.kill(pid, 0); return true } catch (e) { return e.code === 'EPERM' } }
const tick = () => {
  let meta = null
  try { meta = JSON.parse(readFileSync(join(dir, 'meta.json'), 'utf8')) } catch { process.exit(0) }
  if (!meta || meta.token !== token || !alive(Number(parentPid))) process.exit(0)
  const tmp = hb + '.tmp-' + process.pid
  try {
    writeFileSync(tmp, JSON.stringify({ token, at: Date.now(), pid: Number(parentPid) }))
    renameSync(tmp, hb)
  } catch { process.exit(0) }
}
tick()
setInterval(tick, Number(intervalMs))
`

/**
 * 起心跳子进程;先由父进程同步写第一拍,保证 judgeLock 立刻有可读凭据。
 * 返回 stop():幂等,摘子进程。子进程 detached + stdio ignore,不会把父进程钉在事件循环里。
 */
function startHeartbeat(dir, token) {
  try {
    writeFileSync(heartbeatPath(dir), JSON.stringify({ token, at: Date.now(), pid: process.pid }))
  } catch {
    /* 写不下就让后续按"缺心跳 = 保守 held"处理 */
  }
  let child = null
  try {
    child = spawn(
      process.execPath,
      ['-e', HEARTBEAT_CHILD_SCRIPT, dir, token, String(HEARTBEAT_INTERVAL_MS), String(process.pid)],
      { detached: true, stdio: 'ignore', windowsHide: true },
    )
    child.on('error', () => markHeartbeatUnsupported(dir, token))
    child.unref()
  } catch {
    markHeartbeatUnsupported(dir, token)
    return () => {}
  }
  let stopped = false
  return () => {
    if (stopped) return
    stopped = true
    try {
      child.kill()
    } catch {
      /* 已退出 */
    }
  }
}

// ─── FIFO 票据队列 ──────────────────────────────────────────────────────
function queueDirOf(dir) {
  return `${dir}${QUEUE_DIR_SUFFIX}`
}

function ensureQueueDir(queueDir) {
  try {
    mkdirSync(queueDir, { recursive: true })
    return true
  } catch {
    return false
  }
}

function ticketFileOf(queueDir, createdAt, token) {
  // 文件名只负责稳定排序;判序仍以 meta.createdAt 为准(token 做同毫秒 tie-break)。
  return join(queueDir, `${String(createdAt).padStart(16, '0')}-${token}.json`)
}

/** 读全部票据并稳定排序(FIFO:createdAt 升序,同毫秒按 token)。 */
export function readQueueTickets(queueDir) {
  let names
  try {
    names = readdirSync(queueDir)
  } catch {
    return []
  }
  const out = []
  for (const name of names) {
    if (!name.endsWith('.json') || name.startsWith('.')) continue
    try {
      const meta = JSON.parse(readFileSync(join(queueDir, name), 'utf8'))
      if (typeof meta?.token !== 'string' || !Number.isFinite(meta?.createdAt)) continue
      out.push({ file: join(queueDir, name), meta })
    } catch {
      /* 半写入/刚被删:跳过,下一轮再看 */
    }
  }
  out.sort(
    (a, b) => a.meta.createdAt - b.meta.createdAt || String(a.meta.token).localeCompare(String(b.meta.token)),
  )
  return out
}

/** 原子落票(tmp ⇒ rename):竞争者永远看不到半张票据。 */
export function plantQueueTicket(queueDir, ticket) {
  const file = ticketFileOf(queueDir, ticket.createdAt, ticket.token)
  const tmp = `${file}.tmp-${process.pid}-${randomBytes(4).toString('hex')}`
  try {
    writeFileSync(tmp, JSON.stringify(ticket))
    renameSync(tmp, file)
    return file
  } catch {
    try {
      unlinkSync(tmp)
    } catch {
      /* 已不存在 */
    }
    return null
  }
}

export function removeQueueTicket(file) {
  if (file === null) return
  try {
    unlinkSync(file)
  } catch {
    /* 已被清/本就未落盘 */
  }
}

/**
 * 清理死票/过期票(keepToken = 自己的票,永不清)。
 * 死亡判据复用 pidAlive(同一把尺子);过期判据是票据自己的 expiresAt —— 队首被硬杀时,
 * 它的票最多多留"等待上限 + 宽限",不会把队列永久堵死。
 */
export function purgeStaleTickets(queueDir, { pidAlive = isPidAlive, now = () => Date.now(), keepToken = null } = {}) {
  const alive = []
  for (const t of readQueueTickets(queueDir)) {
    if (keepToken !== null && t.meta.token === keepToken) {
      alive.push(t)
      continue
    }
    const expired = Number.isFinite(t.meta.expiresAt) && now() > t.meta.expiresAt
    if (expired || !pidAlive(t.meta.pid)) removeQueueTicket(t.file)
    else alive.push(t)
  }
  return alive
}

/**
 * 判锁状态:
 *  absent           锁不存在
 *  unreadable       目录在、meta 还没落盘(旧实现创建窗口内)⇒ 等,不抢
 *  incomplete-stale 目录在、meta 缺失且超过宽限 ⇒ 陈旧
 *  dead             持锁 pid 已死 ⇒ 陈旧
 *  reused           pid 活着但启动时刻与记录不符 ⇒ pid 复用,原持有者已死 ⇒ 陈旧
 *  held             活锁(含 identity=unverifiable 的保守档)⇒ 不删、不抢
 *  stalled          pid 活着、身份=match,但心跳断供 >3×interval 且已持锁 >2min
 *                   ⇒ 运行面停摆,可走同一套陈旧认领(原持有者 release 仍按 token 复核,
 *                   不会删掉新锁;两场并跑的最坏窗口 = 心跳子进程单独死亡到认领之间的 3.5min,
 *                   换来的是"不再永久挂死"。缺心跳/心跳起不来 ⇒ 仍保守 held)
 *
 * 依赖可注入,夹具据此证真/证伪各条分支,不必真的造一个同名进程。
 */
export function judgeLock(
  dir,
  {
    pidAlive = isPidAlive,
    verify = (meta) => verifyHolder(meta),
    now = () => Date.now(),
    readBeat = readHeartbeat,
    beatUnsupported = heartbeatUnsupported,
  } = {},
) {
  let st
  try {
    st = statSync(dir)
  } catch {
    return { state: 'absent', holder: null, meta: null, ageMs: null }
  }
  const meta = readLockMeta(dir)
  if (!meta) {
    const ageMs = now() - st.mtimeMs
    return ageMs > META_GRACE_MS
      ? { state: 'incomplete-stale', holder: null, meta: null, ageMs }
      : { state: 'unreadable', holder: null, meta: null, ageMs }
  }
  const holder = holderOf(meta, now())
  if (!pidAlive(meta.pid)) return { state: 'dead', holder, meta, ageMs: null }
  const identity = verify(meta)
  if (identity?.kind === 'mismatch') return { state: 'reused', holder, meta, identity, ageMs: null }
  // match ⇒ 同一进程;unverifiable ⇒ 无法核实身份 ⇒ 按活锁保守处理(永不据此判死)。
  const verified = identity?.kind === 'match'
  // 心跳只在"身份已核实"且"心跳机制可用"时才参与判死;两条缺一即落回 held。
  if (verified && !beatUnsupported(dir)) {
    const beat = readBeat(dir)
    const beatAgeMs =
      beat !== null && beat.token === meta.token && Number.isFinite(beat.at) ? now() - beat.at : null
    if (
      beatAgeMs !== null &&
      beatAgeMs > HEARTBEAT_STALE_MS &&
      holder.heldMs !== null &&
      holder.heldMs > STALLED_MIN_HELD_MS
    ) {
      return { state: 'stalled', holder, meta, identity, verified, beatAgeMs, ageMs: null }
    }
  }
  return { state: 'held', holder, meta, identity, verified, ageMs: null }
}

/**
 * 清理陈旧锁:走 stale-lock-claim 的 rename ⇒ 回读身份 ⇒ 处置(不一致则还原)。
 * 归档落点传 null ⇒ 落在同一父目录(tmpdir),复核通过后立刻删除;绝不复用"先判死再直接 rm 原路径"。
 */
function reclaimStale(dir, judged) {
  const r = claimStaleLockCore(dir, judged.meta, `typecheck 锁陈旧(${judged.state})`, {
    archiveRoot: null,
    suffix: `.dead-${process.pid}-${randomBytes(4).toString('hex')}`,
    readState: readLockMeta,
    same: (a, b) => tokenOf(a) === tokenOf(b),
    writeNote: () => null,
    placeScene: ({ stagedPath }) => {
      try {
        rmSync(stagedPath, { recursive: true, force: true })
      } catch {
        /* 删不掉就留在 tmpdir(不改变本轮判定,下一轮还会重判) */
      }
      return { archived: null }
    },
  })
  return r
}

/**
 * `process.on('exit')` 兜底释放:只删**自己持有的那把锁**(meta 的 token+pid 必须与创建时一致)。
 * 这里删的是正式锁路径 —— 持有者已到退出点,不存在"清理别人的锁"这一档。
 */
function installRelease(dir, ownMeta, onDone = () => {}) {
  let released = false
  const release = () => {
    if (released) return
    released = true
    process.removeListener('exit', release)
    // 无论锁是否仍归自己(可能已被 stalled 认领),心跳子进程与队列票据都要收掉。
    try {
      onDone()
    } catch {
      /* 退出路径,忽略 */
    }
    const cur = readLockMeta(dir)
    if (!cur || cur.token !== ownMeta.token || Number(cur.pid) !== process.pid) return
    try {
      rmSync(dir, { recursive: true, force: true })
    } catch {
      /* 退出路径,忽略 */
    }
  }
  process.on('exit', release)
  return release
}

/**
 * 取得机器级 typecheck 串行锁(N=1 单槽,机器级)。
 * @returns {Promise<{ok:true, holder, waitedMs, release}|{ok:false, kind:'busy-timeout'|'io-error', holder, state, waitedMs, error, queuePosition?, queueLength?}>}
 *   kind='busy-timeout' ⇒ 调用方以 **exit 75**(临时失败/可重试)收口并点名持锁者;
 *     本函数到 deadline **只返回一次**,绝不自己进第二轮 —— 重试是上层的有界决策。
 *   kind='io-error'    ⇒ 锁目录不可用 = 未判定(exit 2),不是"被占用",不可自动重试。
 */
export async function acquireTypecheckLock(options = {}) {
  const dir = options.path ?? DEFAULT_LOCK_PATH
  const waitMs = Number.isFinite(options.waitMs) ? Number(options.waitMs) : DEFAULT_WAIT_MS
  const pollMs = Number.isFinite(options.pollMs) ? Number(options.pollMs) : DEFAULT_POLL_MS
  const repo = options.repo ?? process.cwd()
  const role = options.role ?? 'typecheck-full'
  const log = options.log ?? ((line) => console.log(line))
  const deps = {
    pidAlive: options.pidAlive ?? isPidAlive,
    verify: options.verify ?? ((meta) => verifyHolder(meta)),
    now: options.now ?? (() => Date.now()),
  }
  // 身份探针只做一次,且不计入 waitedMs:waitedMs 的语义是"等别人的时间"(读数可解释性),
  // 不是本进程自己的 PowerShell 探针耗时。探针太慢会让"无锁直取"看起来像等了 0.9s。
  const identity = selfIdentity()
  // waitedMs 只累计**等待睡眠**,不把 PowerShell 身份探针算进去:
  // 否则一次冷探针(实测 3–5s)会独自吃掉 deadline,让 waitMs=800ms 的档连一行持锁者日志都打不出来。
  // 这与本文件既有注释的语义一致:waitedMs = "等别人的时间",不是本进程自己的取证耗时。
  let waitedMs = 0
  let lastHolderLogMs = -Infinity

  // FIFO 第一步:先落票,再尝试取锁。队列/票据不可用 ⇒ 退化为直取:
  // 公平性是增益,不能因为它拿不到票据就把整条 typecheck 打死。
  const queueDir = queueDirOf(dir)
  const queueReady = ensureQueueDir(queueDir)
  const ticketToken = randomBytes(8).toString('hex')
  const ticketCreatedAt = Date.now()
  let ticketFile = queueReady
    ? plantQueueTicket(queueDir, {
        token: ticketToken,
        pid: process.pid,
        pidStart: identity.pidStart ?? null,
        createdAt: ticketCreatedAt,
        expiresAt: ticketCreatedAt + waitMs + TICKET_GRACE_MS,
        repo,
        role,
        host: identity.host ?? hostname(),
      })
    : null
  const dropTicket = () => {
    removeQueueTicket(ticketFile)
    ticketFile = null
    process.removeListener('exit', dropTicket)
  }
  process.on('exit', dropTicket)

  const logWait = (judged, queuePos, queueLen, waitedMs) => {
    if (lastHolderLogMs !== -Infinity && waitedMs - lastHolderLogMs < HOLDER_LOG_INTERVAL_MS) return
    lastHolderLogMs = waitedMs
    const why =
      judged.state === 'held' && judged.verified === false
        ? ` (身份无法核实:${judged.identity?.why ?? '探针不可用'},按活锁保守处理)`
        : judged.state === 'unreadable'
          ? ' (meta 尚未落盘,等它写全)'
          : ''
    const lockPart =
      judged.state === 'absent'
        ? '锁当前空闲(队首尚未取走)'
        : `另一全量 typecheck 进行中(${describeLockHolder(judged.holder)})${why}`
    const q = queueReady ? `;FIFO 队列第 ${queuePos}/${queueLen} 位(只有队首可尝试取锁)` : ''
    log(
      `[typecheck:full] ${lockPart};本进程串行等待(已等 ${(waitedMs / 1000).toFixed(1)}s,上限 ${(waitMs / 1000).toFixed(0)}s)${q}...`,
    )
  }

  for (;;) {
    // 每轮都先清死票/过期票:队首被硬杀时,它的票最多留"等待上限 + 宽限"。
    const peers = queueReady
      ? purgeStaleTickets(queueDir, { pidAlive: deps.pidAlive, now: deps.now, keepToken: ticketToken })
      : []
    // 自己的票不在(写不下/被外删)⇒ 视作队首,退化为直取;否则严格按 createdAt 排。
    const isHead = ticketFile === null || peers.length === 0 || peers[0].meta.token === ticketToken

    if (!isHead) {
      const judged = judgeLock(dir, deps)
      const pos = peers.findIndex((t) => t.meta.token === ticketToken) + 1
      if (waitedMs >= waitMs) {
        dropTicket()
        return {
          ok: false,
          kind: 'busy-timeout',
          holder: judged.holder,
          state: judged.state,
          waitedMs,
          error: null,
          queuePosition: pos,
          queueLength: peers.length,
        }
      }
      logWait(judged, pos, peers.length, waitedMs)
      const sleptMs = Math.max(50, Math.min(pollMs, waitMs - waitedMs))
      await sleep(sleptMs)
      waitedMs += sleptMs
      continue
    }

    const meta = {
      pid: process.pid,
      pidStart: identity.pidStart ?? null,
      repo,
      role,
      startedAt: new Date().toISOString(),
      host: identity.host ?? hostname(),
      token: randomBytes(8).toString('hex'),
    }
    // 原子创建:唯一 pending 目录写全 meta ⇒ rename 成正式锁;正式路径已存在 ⇒ contended。
    const attempt = createLockDirectoryAtomically({
      dir,
      writePayload: (stagedDir) => {
        writeFileSync(metaPath(stagedDir), JSON.stringify(meta))
        return meta
      },
    })

    if (attempt.ok && attempt.kind === 'acquired') {
      // 心跳必须由外置进程写:主流程随后是 spawnSync,事件循环会整段阻塞。
      const stopHeartbeat = startHeartbeat(dir, meta.token)
      const release = installRelease(dir, meta, () => {
        stopHeartbeat()
        dropTicket()
      })
      dropTicket() // 票据使命已完成;锁本身就是后续排队者的凭据
      return {
        ok: true,
        holder: holderOf(meta, Date.now()),
        waitedMs,
        release,
      }
    }

    if (attempt.kind !== 'contended') {
      dropTicket()
      return {
        ok: false,
        kind: 'io-error',
        holder: null,
        state: 'create-error',
        waitedMs,
        error: new Error(attempt.message ?? `锁目录创建失败(${attempt.code ?? 'unknown'})`),
      }
    }

    const judged = judgeLock(dir, deps)
    if (
      judged.state === 'dead' ||
      judged.state === 'reused' ||
      judged.state === 'stalled' ||
      judged.state === 'incomplete-stale'
    ) {
      const claimed = reclaimStale(dir, judged)
      if (claimed.ok) {
        log(`[typecheck:full] 清理陈旧锁(${judged.state}: ${describeLockHolder(judged.holder)})`)
        continue
      }
      if (claimed.cause === 'dir-gone-early' || claimed.cause === 'archive-rename-enoent') {
        continue // 锁已不见 ⇒ 立刻重试创建,不必等
      }
      if (claimed.cause === 'identity-mismatch') {
        // 判死与改名之间插进了新持有者:已原样放回,按活锁重判(绝不删)
        log(`[typecheck:full] 陈旧锁复核不通过(身份已换,已放回),按活锁重判`)
      }
    }

    if (waitedMs >= waitMs) {
      dropTicket()
      return {
        ok: false,
        kind: 'busy-timeout',
        holder: judged.holder,
        state: judged.state,
        waitedMs,
        error: null,
        queuePosition: peers.length === 0 ? 1 : peers.findIndex((t) => t.meta.token === ticketToken) + 1,
        queueLength: peers.length,
      }
    }
    logWait(
      judged,
      peers.length === 0 ? 1 : peers.findIndex((t) => t.meta.token === ticketToken) + 1,
      peers.length,
      waitedMs,
    )
    const sleptMs = Math.max(50, Math.min(pollMs, waitMs - waitedMs))
    await sleep(sleptMs)
    waitedMs += sleptMs
  }
}
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
