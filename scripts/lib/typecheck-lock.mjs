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
// **两档必须分开**(2026-11-07 判据修正,不是调数字):
//   ① `pid` 不存在 ⇒ 一律 `verdict=stale`,直接认领。进程已经不在,就不存在 pid 复用问题;
//      `pidStart` 的意义只在于"进程还活着时"区分是不是同一个。把它和"身份无法核实"合成
//      一个保守分支,代价已经实测出现:三棵 worktree 互把对方锁死,每棵都报未判定。
//   ② `pid` 还在、但`pidStart` 量不到 ⇒ `verdict=unverifiable`,按活锁保守等待,**不偷**。
//   ③ 锁在写入那一刻就落 `pidStart`(探针读不到才写 null,并留下 unverifiable 的起因)。
//
// 锁落 os.tmpdir():进程锁不该进仓库目录,且 safe-delete shim 对 os.tmpdir() 放行。

import { readFileSync, rmSync, statSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'
import { hostname, tmpdir } from 'node:os'
import { randomBytes } from 'node:crypto'
import { setTimeout as sleep } from 'node:timers/promises'
import { createLockDirectoryAtomically } from './lock-atomic-init.mjs'
import { claimStaleLockCore } from './stale-lock-claim.mjs'
import { identityFields, verifyHolder } from './proc-identity.mjs'

export const DEFAULT_LOCK_PATH = join(tmpdir(), 'ihui-typecheck-full.lock')
/**
 * 门/锁**同一份预算**(单源,不许两边各自写死):
 *   他人一次全量实测 365–565s ⇒ 等锁上限必须 ≥ 565s,否则"对方正在跑"必然落未判定。
 *   门侧把它的 `waitTimeoutMs` 传进 `acquireTypecheckLock({ waitMs })` 时,用的就是这份预算。
 *   以前的 120s 比别人的单次执行还短 —— 那不是保守,是**必然**未判定。
 */
export const GATE_QUEUE_WAIT_MS = 600_000
export const DEFAULT_WAIT_MS = GATE_QUEUE_WAIT_MS
export const DEFAULT_POLL_MS = 2_000
/** 只有目录、meta 还没落盘(旧实现创建中途被打断)的宽限;超过才按陈旧处理。 */
const META_GRACE_MS = 30_000
/** 持锁者信息重打印间隔(等待期间每 15s 点名一次)。 */
const HOLDER_LOG_INTERVAL_MS = 15_000

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

/**
 * 判锁状态(附 `verdict` 与 `holderAlive`,两者是判据的对外读数,不是日志装饰):
 *  absent           锁不存在(verdict=null,无竞争方)
 *  unreadable       目录在、meta 还没落盘(旧实现创建窗口内)⇒ 等,不抢(verdict=unverifiable)
 *  incomplete-stale 目录在、meta 缺失且超过宽限 ⇒ 陈旧(verdict=stale)
 *  dead             持锁 pid 已死 ⇒ 陈旧(verdict=stale)—— **不调用 verify**,进程不在就没有复用问题
 *  reused           pid 活着但启动时刻与记录不符 ⇒ pid 复用,原持有者已死 ⇒ 陈旧(verdict=stale)
 *  held             活锁(含 identity=unverifiable 的保守档)⇒ 不删、不抢
 *
 * 依赖可注入,夹具据此证真/证伪各条分支,不必真的造一个同名进程。
 */
export function judgeLock(
  dir,
  { pidAlive = isPidAlive, verify = (meta) => verifyHolder(meta), now = () => Date.now() } = {},
) {
  let st
  try {
    st = statSync(dir)
  } catch {
    return { state: 'absent', holder: null, meta: null, holderAlive: null, verdict: null, ageMs: null }
  }
  const meta = readLockMeta(dir)
  if (!meta) {
    const ageMs = now() - st.mtimeMs
    return ageMs > META_GRACE_MS
      ? { state: 'incomplete-stale', holder: null, meta: null, holderAlive: null, verdict: 'stale', ageMs }
      : { state: 'unreadable', holder: null, meta: null, holderAlive: null, verdict: 'unverifiable', ageMs }
  }
  const holder = holderOf(meta, now())
  const holderAlive = pidAlive(meta.pid)
  // pid 不存在 ⇒ stale:没有 pid 复用问题,直接允许认领。缺 pidStart 不参与这一档。
  if (!holderAlive) return { state: 'dead', holder, meta, holderAlive, verdict: 'stale', ageMs: null }
  const identity = verify(meta)
  if (identity?.kind === 'mismatch') {
    return { state: 'reused', holder, meta, holderAlive, identity, verdict: 'stale', ageMs: null }
  }
  // match ⇒ 同一进程(live);unverifiable ⇒ 无法核实身份 ⇒ 按活锁保守处理(unverifiable),永不据此判死。
  return {
    state: 'held',
    holder,
    meta,
    holderAlive,
    identity,
    verified: identity?.kind === 'match',
    verdict: identity?.kind === 'match' ? 'live' : 'unverifiable',
    ageMs: null,
  }
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
function installRelease(dir, ownMeta) {
  let released = false
  const release = () => {
    if (released) return
    released = true
    process.removeListener('exit', release)
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
 * 取得机器级 typecheck 串行锁。
 * @returns {Promise<{ok:true, holder, waitedMs, release}|{ok:false, kind:'busy-timeout'|'io-error', holder, state, waitedMs, error}>}
 *   kind='busy-timeout' ⇒ 调用方必须输出「未判定(并发占用)」并以 exit 2 收口,不许折成通过/失败。
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
  const startedMs = Date.now()
  let lastHolderLogMs = -Infinity

  for (;;) {
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
      const release = installRelease(dir, meta)
      return {
        ok: true,
        holder: holderOf(meta, Date.now()),
        waitedMs: Date.now() - startedMs,
        release,
      }
    }

    if (attempt.kind !== 'contended') {
      return {
        ok: false,
        kind: 'io-error',
        holder: null,
        state: 'create-error',
        waitedMs: Date.now() - startedMs,
        error: new Error(attempt.message ?? `锁目录创建失败(${attempt.code ?? 'unknown'})`),
      }
    }

    const judged = judgeLock(dir, deps)
    if (judged.state === 'dead' || judged.state === 'reused' || judged.state === 'incomplete-stale') {
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

    const waitedMs = Date.now() - startedMs
    if (waitedMs >= waitMs) {
      return {
        ok: false,
        kind: 'busy-timeout',
        holder: judged.holder,
        holderAlive: judged.holderAlive,
        state: judged.state,
        verdict: judged.verdict,
        waitedMs,
        limitMs: waitMs,
        error: null,
      }
    }
    if (lastHolderLogMs === -Infinity || waitedMs - lastHolderLogMs >= HOLDER_LOG_INTERVAL_MS) {
      lastHolderLogMs = waitedMs
      const why =
        judged.state === 'held' && judged.verified === false
          ? ` (身份无法核实:${judged.identity?.why ?? '探针不可用'},按活锁保守处理)`
          : judged.state === 'unreadable'
            ? ' (meta 尚未落盘,等它写全)'
            : ''
      // 判据读数六件套:缺一个就等于没做(用户点名)。verdict ∈ stale|live|unverifiable。
      const fields =
        `holderPid=${judged.holder?.pid ?? '未知'} ` +
        `holderPidStart=${judged.holder?.pidStart ?? '未知'} ` +
        `holderAlive=${judged.holderAlive === null || judged.holderAlive === undefined ? '未知' : judged.holderAlive} ` +
        `verdict=${judged.verdict ?? '未知'} ` +
        `waitedMs=${waitedMs} ` +
        `limitMs=${waitMs}`
      log(`[typecheck:full] 锁判据: ${fields}${why}`)
      log(
        `[typecheck:full] 另一全量 typecheck 进行中(${describeLockHolder(judged.holder)})${why};本进程串行等待(已等 ${(waitedMs / 1000).toFixed(1)}s,上限 ${(waitMs / 1000).toFixed(0)}s)...`,
      )
    }
    await sleep(Math.max(50, Math.min(pollMs, waitMs - waitedMs)))
  }
}
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
