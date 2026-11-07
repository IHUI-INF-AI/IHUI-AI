#!/usr/bin/env node
// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * pnpm-install-lock.mjs — 跨进程 pnpm 安装锁（方案③，2026-11-07 立）
 *
 * 在修什么（并发事故，不是假想）：
 *   多个 worktree 共用同一份 node_modules（本机是 D:\IHUI-AI\node_modules 的 junction）。
 *   A 席跑 `pnpm install` 时 pnpm 会先拆再建顶层链接，B 席同一时刻跑 typecheck，
 *   解析 `node_modules/typescript/bin/tsc` 会落在"已拆未建"的窗口里 ⇒ ENOENT /
 *   MODULE_NOT_FOUND。门（typecheck 必须读真实 tsc）是对的，错的是两个写读方并发。
 *
 * 本文件只做两件事：
 *   1) `run -- <cmd>`：把一条安装命令包在跨进程锁里（拿不到锁 ⇒ 明确失败，不静默等死）；
 *   2) `check`：给 pre-commit / push 门调用的一句判据：安装期间禁止 typecheck。
 *
 * 默认**启用**（2026-11-07 二次事故后改）：`IHUI_PNPM_INSTALL_LOCK=0` 为应急关闭（仅排障，
 * 非常规）；不设或设 1 都按启用。pre-commit / pre-push 的调用位默认也开，同一键族
 * `IHUI_GATE_INSTALL_LOCK=0` 应急关闭。磁盘/迁移另见 docs/engineering/pnpm-install-lock.md。
 *
 * 锁形态：机器级目录锁（原子 mkdir），默认落在 os.tmpdir()/ihui-pnpm-install.lock。
 *   不用 `Global\ihui-pnpm-install` 具名互斥体，是因为它要求原生模块；mkdir 在任何
 *   Node 上都是原子的，且 owner.json 能留下可审计的现场。
 *   跨 worktree 共享：tmpdir 是机器级，不随 worktree 变；需要换位置用
 *   IHUI_PNPM_INSTALL_LOCK_DIR。
 *
 * 判活（四条，任一"正向"不成立 ⇒ 陈旧）：
 *   L1 同机          —— 不同 host 一律不抢（跨机共享目录无法验活，宁可超时报错）
 *   L2 同一次启动    —— bootEpochSec 差 > 5s ⇒ 机器重启过，锁必然无主
 *   L3 进程还在      —— pid 不存在 ⇒ 陈旧；pid 在但启动时刻 ≠ owner 记录 ⇒ pid 被复用，仍判陈旧
 *   L4 心跳还在续    —— heartbeatAt 超过 15 分钟未更新 ⇒ 持有者不再活动
 *   另有绝对上限 6h（只用于"读不出 owner"这一支；正常持有不受它约束）。
 *   pid 复用的处置与 deploy-lock-common.ps1 同源：L3 用启动时刻 + L2/L4 兜底，不拿裸 pid 当永生锁。
 *
 * 退出码（供门判断，别只看 stdout）：
 *   0  成功 / check 放行（含未启用）
 *   2  用法错误
 *   3  拿锁超时（明确失败；默认 30s，可用 IHUI_PNPM_INSTALL_LOCK_TIMEOUT_MS 调整）
 *   4  check 判定：安装进行中，禁止并发 typecheck
 *   其他  透传被 `run` 包裹的命令退出码
 *
 * 手动：
 *   node scripts/lib/pnpm-install-lock.mjs status
 *   node scripts/lib/pnpm-install-lock.mjs check
 *   node scripts/lib/pnpm-install-lock.mjs run -- pnpm install
 */

import { execFileSync, spawn } from 'node:child_process'
import { randomBytes } from 'node:crypto'
import {
  appendFileSync,
  existsSync,
  lstatSync,
  mkdirSync,
  readFileSync,
  readdirSync,
  readlinkSync,
  renameSync,
  rmSync,
  statSync,
  writeFileSync,
} from 'node:fs'
import { hostname, tmpdir, uptime } from 'node:os'
import { join, resolve } from 'node:path'
import { pathToFileURL } from 'node:url'

import { createLockDirectoryAtomically } from './lock-atomic-init.mjs'
import { identityFields, verifyHolder } from './proc-identity.mjs'

const ENABLE_ENV = 'IHUI_PNPM_INSTALL_LOCK'
const DIR_ENV = 'IHUI_PNPM_INSTALL_LOCK_DIR'
const TIMEOUT_ENV = 'IHUI_PNPM_INSTALL_LOCK_TIMEOUT_MS'
const TOKEN_ENV = 'IHUI_PNPM_INSTALL_TOKEN'

const DEFAULT_TIMEOUT_MS = 30_000
const POLL_MS = 250
const HEARTBEAT_MS = 15_000
const HEARTBEAT_MAX_MS = 15 * 60_000
const HARD_CAP_MS = 6 * 60 * 60_000
const INIT_GRACE_MS = 60_000
const BOOT_TOLERANCE_SEC = 5

const EXIT_OK = 0
const EXIT_USAGE = 2
const EXIT_TIMEOUT = 3
const EXIT_INSTALL_RUNNING = 4

/**
 * 机器锚点 = git common dir（所有 worktree 都指向同一份，天然跨目录恒定）。
 * 不能用"哪个 worktree 有 node_modules"作判据：本机已有多个自包含 worktree，
 * 谁先出现谁就变成锁位置，锁会漂移。
 */
function machineAnchor() {
  const custom = process.env.IHUI_SHARED_ROOT
  if (custom && custom.trim()) return custom.trim()
  try {
    const rel = execFileSync('git', ['rev-parse', '--git-common-dir'], {
      encoding: 'utf8',
      timeout: 3000,
      windowsHide: true,
      stdio: ['ignore', 'pipe', 'ignore'],
    }).trim()
    if (rel) return resolve(process.cwd(), rel)
  } catch {
    /* 非 git 环境 */
  }
  return tmpdir()
}

/** 全部 worktree 路径（git worktree list）。非 git 环境返回空数组。 */
function worktreePaths() {
  try {
    const out = execFileSync('git', ['worktree', 'list', '--porcelain'], {
      encoding: 'utf8',
      timeout: 3000,
      windowsHide: true,
      stdio: ['ignore', 'pipe', 'ignore'],
    })
    return out
      .split(/\r?\n/)
      .filter((l) => l.startsWith('worktree '))
      .map((l) => l.slice('worktree '.length).trim())
      .filter(Boolean)
  } catch {
    return []
  }
}

function lockDir() {
  const custom = process.env[DIR_ENV]
  if (custom && custom.trim()) return custom.trim()
  // 机器锚点上的目录锁：mkdir 成功即持锁，跨 worktree 可见。
  return join(machineAnchor(), '.ihui-install.lock')
}

/** 默认启用；只有显式 `IHUI_PNPM_INSTALL_LOCK=0` 才关闭（应急口，非常规）。 */
function enabled() {
  return process.env[ENABLE_ENV] !== '0'
}

function timeoutMs() {
  const raw = process.env[TIMEOUT_ENV]
  if (!raw) return DEFAULT_TIMEOUT_MS
  const n = Number(raw)
  if (!Number.isFinite(n) || n < 0) {
    fail(EXIT_USAGE, `[install-lock] ${TIMEOUT_ENV} 不是合法毫秒数：${raw}`)
  }
  return Math.floor(n)
}

function fail(code, message) {
  console.error(message)
  process.exit(code)
}

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms))
}

/** 本次启动的标识（秒级 epoch）。两次读取只差 uptime 的秒级抖动，故比较时给 5s 容差。 */
function bootEpochSec() {
  return Math.floor((Date.now() - uptime() * 1000) / 1000)
}

function atomicWriteJson(path, obj) {
  const tmp = `${path}.${process.pid}.${Date.now()}.tmp`
  writeFileSync(tmp, JSON.stringify(obj), 'utf8')
  renameSync(tmp, path)
}

function makeOwner(cmd) {
  const now = new Date().toISOString()
  // 身份三元组（pid+host+pidStart）来自 proc-identity：陈旧判定的唯一出处。
  const id = identityFields()
  return {
    v: 2,
    pid: process.pid,
    ...id,
    pidStartAt: Number.isFinite(id.pidStart) ? new Date(id.pidStart * 1000).toISOString() : null,
    bootEpochSec: bootEpochSec(),
    startedAt: now,
    heartbeatAt: now,
    token: randomBytes(12).toString('hex'),
    cmd: cmd.join(' '),
    cwd: process.cwd(),
  }
}

function pidAlive(pid) {
  if (!Number.isInteger(pid) || pid <= 0) return false
  try {
    process.kill(pid, 0)
    return true
  } catch (e) {
    // EPERM = 进程在，只是没权限发信号；ESRCH 才是"不存在"
    return e && e.code === 'EPERM'
  }
}

// pid 复用/身份判据统一由 proc-identity.mjs 提供，本文件不再自带探针。

/**
 * 读锁现场。三态必须分开：
 *   absent    锁目录不存在
 *   no-owner  目录在、owner.json 还没写出来（持有者正在初始化）
 *   unusable  owner.json 读不出/解析不出（不猜、不静默删）
 *   ok        可判活
 */
function readState(dir) {
  if (!existsSync(dir)) return { kind: 'absent', reason: '锁目录不存在', dirAgeMs: 0 }
  let dirAgeMs = 0
  try {
    dirAgeMs = Date.now() - statSync(dir).mtimeMs
  } catch (e) {
    return { kind: 'unusable', reason: `量不到锁目录 mtime：${e.message}`, dirAgeMs: 0 }
  }
  const ownerPath = join(dir, 'owner.json')
  if (!existsSync(ownerPath)) return { kind: 'no-owner', reason: 'owner.json 尚未写出', dirAgeMs }
  try {
    const owner = JSON.parse(readFileSync(ownerPath, 'utf8'))
    if (!owner || typeof owner !== 'object' || !Number.isInteger(owner.pid)) {
      return { kind: 'unusable', reason: 'owner.json 顶层不是对象或缺 pid', dirAgeMs }
    }
    return { kind: 'ok', owner, dirAgeMs, reason: '' }
  } catch (e) {
    return { kind: 'unusable', reason: `owner.json 解析失败：${e.message}`, dirAgeMs }
  }
}

function heartbeatAgeMs(owner) {
  const t = Date.parse(owner && owner.heartbeatAt)
  if (!Number.isFinite(t)) return Infinity
  return Date.now() - t
}

/**
 * 陈旧判定。返回 { stale, reason }；stale=false 时 reason 说明"为什么不抢"。
 * 方向纪律：判不出 ⇒ 不抢（超时明确报错），只有"正向证据"才判陈旧。
 */
function classify(state) {
  if (state.kind === 'absent') return { stale: true, reason: '锁不存在' }
  if (state.kind === 'no-owner') {
    if (state.dirAgeMs > INIT_GRACE_MS) {
      return {
        stale: true,
        reason: `锁目录存在 ${Math.round(state.dirAgeMs / 1000)}s 但 owner.json 始终未写出`,
      }
    }
    return { stale: false, reason: '持有者正在初始化（owner.json 未写出）' }
  }
  if (state.kind === 'unusable') {
    if (state.dirAgeMs > HARD_CAP_MS) {
      return { stale: true, reason: `锁内容不可用且锁龄已超绝对上限 ${HARD_CAP_MS / 3600000}h` }
    }
    return { stale: false, reason: `锁内容不可用（${state.reason}），不猜、不删` }
  }
  const owner = state.owner
  if (owner.host !== hostname()) {
    return { stale: false, reason: `持有者在另一台主机 ${owner.host}，跨机无法验活` }
  }
  if (
    Number.isInteger(owner.bootEpochSec) &&
    Math.abs(owner.bootEpochSec - bootEpochSec()) > BOOT_TOLERANCE_SEC
  ) {
    return { stale: true, reason: '机器重启过（bootEpochSec 不符），锁必然无主' }
  }
  if (!pidAlive(owner.pid)) {
    return { stale: true, reason: `持有进程 pid=${owner.pid} 已不存在` }
  }
  // pid 会被复用：活着不等于还是原主。身份判定只认 proc-identity（陈旧判定的唯一出处）。
  const idv = verifyHolder(owner)
  if (idv.kind === 'mismatch') {
    return { stale: true, reason: `pid=${owner.pid} 已被复用：${idv.why}` }
  }
  const beatAge = heartbeatAgeMs(owner)
  if (beatAge > HEARTBEAT_MAX_MS) {
    return {
      stale: true,
      reason: `心跳已 ${Math.round(beatAge / 60000)} 分钟未续（上限 ${HEARTBEAT_MAX_MS / 60000} 分钟）`,
    }
  }
  if (state.dirAgeMs > HARD_CAP_MS) {
    return { stale: true, reason: `锁龄已超绝对上限 ${HARD_CAP_MS / 3600000}h` }
  }
  const startNote =
    idv.kind === 'match'
      ? 'pidStart 相符'
      : `身份未判定（${idv.why || '未知'}），仅按 pid+心跳判活`
  return {
    stale: false,
    reason: `pid=${owner.pid} 仍存活且心跳在 ${Math.max(0, Math.round(beatAge / 1000))}s 内（${startNote}）`,
  }
}

function heldMsOf(owner) {
  const t = Date.parse(owner && owner.startedAt)
  if (!Number.isFinite(t)) return null
  return Math.max(0, Date.now() - t)
}

function describe(state) {
  if (state.kind !== 'ok') return state.reason
  const o = state.owner
  const held = heldMsOf(o)
  return (
    `pid=${o.pid} host=${o.host} pidStart=${o.pidStartAt || '未知'} ` +
    `开始=${o.startedAt} 已持有=${held === null ? '未知' : Math.round(held / 1000) + 's'} ` +
    `心跳=${o.heartbeatAt} cmd=${o.cmd || '-'}`
  )
}

/** 判陈旧后删锁：删前复核同一性，避免删掉并发者刚写下的新锁。 */
function clearIfSame(dir, state) {
  const again = readState(dir)
  if (again.kind !== state.kind) return false
  if (state.kind === 'ok') {
    const a = again.owner
    const b = state.owner
    if (a.token !== b.token && a.pid !== b.pid) return false
  }
  try {
    rmSync(dir, { recursive: true, force: true })
    return true
  } catch {
    return false
  }
}

async function acquire(dir, cmd) {
  const budget = timeoutMs()
  const deadline = Date.now() + budget
  const owner = makeOwner(cmd)

  while (true) {
    // 原子初始化：先在同级 pending 目录写全内容，再 rename 到正式路径。
    // 直接 mkdir 正式路径会留下"目录在、owner.json 还没写出"的窗口。
    const init = createLockDirectoryAtomically({
      dir,
      writePayload: (staged) => {
        writeFileSync(join(staged, 'owner.json'), JSON.stringify(owner), 'utf8')
      },
    })
    if (init.ok) return owner
    if (init.kind === 'error') {
      fail(EXIT_USAGE, `[install-lock] 建锁失败：${init.message || init.code}`)
    }

    const state = readState(dir)
    const verdict = classify(state)
    if (verdict.stale) {
      clearIfSame(dir, state)
      continue // 立刻重试 mkdir，不额外睡觉
    }
    if (Date.now() >= deadline) {
      fail(
        EXIT_TIMEOUT,
        `[install-lock] 获取安装锁超时（${budget}ms）：${describe(state)}；` +
          `判定=${verdict.reason}。没有拿到锁，拒绝执行安装命令。`,
      )
    }
    await sleep(POLL_MS)
  }
}

function release(dir, owner) {
  try {
    const state = readState(dir)
    if (state.kind !== 'ok') return false
    if (state.owner.token !== owner.token) return false // 只删自己那把
    rmSync(dir, { recursive: true, force: true })
    return true
  } catch {
    return false
  }
}

function spawnCommand(args) {
  if (process.platform === 'win32') {
    // pnpm 在 Windows 是 .cmd；CreateProcess 不认扩展名，必须经 ComSpec。
    // 一律加引号：cmd 只解释引号外的 & | < > ^；曾经 `-e setTimeout(()=>{},1)` 这类
    // 参数里的 `>` 被当成重定向，命令被截断成半句（实测 2026-11-07）。
    const quote = (s) => `"${String(s).replace(/"/g, '\\"')}"`
    return spawn(args.map(quote).join(' '), {
      shell: true,
      stdio: 'inherit',
      cwd: process.cwd(),
      env: process.env,
    })
  }
  return spawn(args[0], args.slice(1), {
    stdio: 'inherit',
    cwd: process.cwd(),
    env: process.env,
  })
}

function waitChild(child) {
  return new Promise((resolve) => {
    child.on('error', (e) => {
      console.error(`[install-lock] 子进程启动失败：${e.message}`)
      resolve(EXIT_USAGE)
    })
    child.on('close', (code, signal) => resolve(typeof code === 'number' ? code : signal ? 1 : 0))
  })
}

async function runCommand(args) {
  if (args[0] === '--') args = args.slice(1)
  if (args.length === 0) {
    usage('run 缺少命令，例如：run -- pnpm install')
  }
  if (!enabled()) {
    console.error(
      `[install-lock] 已显式关闭（${ENABLE_ENV}=0，应急口），直接执行原命令（行为回到未接线）`,
    )
    appendAudit('run-start', { cmd: args.join(' '), enabled: false })
    const bypassCode = await waitChild(spawnCommand(args))
    appendAudit('run-end', { cmd: args.join(' '), code: bypassCode, enabled: false })
    return bypassCode
  }

  const dir = lockDir()
  const owner = await acquire(dir, args)
  // 把解析结果显式传下去：pnpm 可能在 install 中途删掉 node_modules，
  // 子进程若重新解析会漂移到别的 worktree，token 校验就会误拒。
  process.env[DIR_ENV] = dir
  // 交给子进程（pnpm 会执行根 package.json 的 preinstall 守卫去校验它）
  process.env[TOKEN_ENV] = owner.token
  let released = false
  const releaseOnce = () => {
    if (released) return
    released = true
    release(dir, owner)
  }
  process.on('exit', releaseOnce)

  console.error(`[install-lock] 已拿锁 ${dir}（pid=${owner.pid}），执行：${args.join(' ')}`)
  appendAudit('run-start', { cmd: args.join(' '), lockPid: owner.pid })
  const beat = setInterval(() => {
    try {
      const state = readState(dir)
      if (state.kind === 'ok' && state.owner.token === owner.token) {
        const next = { ...state.owner, heartbeatAt: new Date().toISOString() }
        atomicWriteJson(join(dir, 'owner.json'), next)
        owner.heartbeatAt = next.heartbeatAt
      }
    } catch {
      /* 心跳写失败不吞成"成功"：锁仍按已有心跳判活，下一拍再试 */
    }
  }, HEARTBEAT_MS)
  beat.unref?.()

  const code = await waitChild(spawnCommand(args))
  clearInterval(beat)
  releaseOnce()
  appendAudit('run-end', { cmd: args.join(' '), code, lockPid: owner.pid })
  return code
}

function checkCommand() {
  if (!enabled()) {
    console.error(`[install-lock] 已显式关闭（${ENABLE_ENV}=0，应急口），check 恒通过`)
    return EXIT_OK
  }
  const dir = lockDir()
  const state = readState(dir)
  const verdict = classify(state)
  if (state.kind === 'absent') {
    console.error('[install-lock] 无安装锁 ⇒ typecheck 放行')
    return EXIT_OK
  }
  if (verdict.stale) {
    clearIfSame(dir, state)
    appendAudit('check-stale', { reason: verdict.reason })
    console.error(`[install-lock] 安装锁已陈旧（${verdict.reason}）⇒ 清理后放行`)
    return EXIT_OK
  }
  console.error(`[install-lock] pnpm 安装进行中：${describe(state)}`)
  console.error('[install-lock] 禁止并发 typecheck（会踩到 node_modules 重建窗口，出现 ENOENT）')
  appendAudit('check-block', {
    holderPid: state.kind === 'ok' ? state.owner.pid : null,
    heldMs: state.kind === 'ok' ? heldMsOf(state.owner) : null,
  })
  return EXIT_INSTALL_RUNNING
}

function statusCommand() {
  const dir = lockDir()
  const state = readState(dir)
  const verdict = classify(state)
  const heldMs = state.kind === 'ok' ? heldMsOf(state.owner) : null
  const out = {
    enabled: enabled(),
    lockDir: dir,
    state: state.kind,
    stale: verdict.stale,
    reason: verdict.reason,
    heldMs,
    owner: state.kind === 'ok' ? state.owner : null,
  }
  console.info(JSON.stringify(out, null, 2))
  return EXIT_OK
}

/**
 * preinstall 守卫（唯一能拦住"直连 pnpm install"的位置）。
 * 三条判据一起用：链接面（junction 指向共享层 ⇒ 拒）、token（wrapper 注入）、留痕。
 */
function isJunction(p) {
  try {
    return lstatSync(p).isSymbolicLink()
  } catch {
    return false
  }
}

function appendGuardLog(cwd, decision, reason) {
  try {
    const dir = join(machineAnchor(), '.ihui-agent', 'state')
    mkdirSync(dir, { recursive: true })
    appendFileSync(
      join(dir, 'install-guard.log'),
      `${new Date().toISOString()}\tdecision=${decision}\tcwd=${cwd}\tpid=${process.pid}\t${reason}\n`,
      'utf8',
    )
  } catch {
    /* 留痕失败不改判据 */
  }
}

/**
 * 机器可数的审计日志（2026-11-07 立）：
 * 观察期判据「≥3 次真实 install、误拦 ≤1」必须能从日志里数出来，不能靠回忆。
 * 事件: run-start / run-end / check-block / check-stale / guard-deny。
 * 误拦的定义可复核：check-block 发生时**没有任何活跃 run-start**（replay 得出）。
 */
function appendAudit(event, extra = {}) {
  try {
    const dir = join(machineAnchor(), '.ihui-agent', 'state')
    mkdirSync(dir, { recursive: true })
    appendFileSync(
      join(dir, 'install-lock.log'),
      `${JSON.stringify({ at: new Date().toISOString(), event, pid: process.pid, cwd: process.cwd(), ...extra })}\n`,
      'utf8',
    )
  } catch {
    /* 审计失败不改判定 */
  }
}

function guardCommand() {
  const cwd = process.cwd()
  const nm = join(cwd, 'node_modules')
  let deny = null
  if (!enabled()) {
    appendGuardLog(cwd, 'allow', `${ENABLE_ENV}=0 应急口`)
    console.error(`[install-guard] 锁已被应急关闭（${ENABLE_ENV}=0），放行`)
    return EXIT_OK
  }
  if (!existsSync(nm)) {
    // 全新安装（干净检出 / CI runner）：没有 node_modules 可被共享层污染，也没有并发写同一目录的
    // 前提。放行而不要求 token，否则所有托管 CI 的直接 `pnpm install` 都会被守卫打断。
    appendGuardLog(cwd, 'allow', 'node_modules 不存在（全新安装）')
    return EXIT_OK
  }
  if (isJunction(nm)) {
    deny = `node_modules 是链接/junction（→ ${readlinkSync(nm)}）：先摘掉链接，在自包含目录里安装`
  } else {
    const token = process.env[TOKEN_ENV]
    const dir = lockDir()
    const state = readState(dir)
    const verdict = classify(state)
    if (!token) {
      deny = '直连 install 未携带锁 token；请走 node scripts/lib/pnpm-install-lock.mjs run -- pnpm install'
    } else if (state.kind !== 'ok') {
      deny = `持有 token 但锁不存在（${state.reason}）`
    } else if (state.owner.token !== token) {
      deny = `token 与当前锁不匹配：${describe(state)}`
    } else if (verdict.stale) {
      deny = `当前锁已陈旧：${verdict.reason}`
    }
  }
  if (deny) {
    appendGuardLog(cwd, 'deny', deny)
    appendAudit('guard-deny', { reason: deny })
    console.error(`[install-guard] 拒绝安装：${deny}`)
    return EXIT_USAGE
  }
  appendGuardLog(cwd, 'allow', '持锁 token 匹配')
  return EXIT_OK
}

/** 本前缀之外的 worktree node_modules 快照（顶层条目 + mtime + 链接目标）。 */
function collectWorktreeNodeModules() {
  const self = resolve(process.cwd())
  const items = []
  for (const wtPath of worktreePaths()) {
    if (resolve(wtPath) === self) continue
    const nm = join(wtPath, 'node_modules')
    let st = null
    try {
      st = lstatSync(nm)
    } catch {
      /* 不存在就是不存在 */
    }
    let entries = []
    if (st) {
      try {
        entries = readdirSync(nm).sort()
      } catch {
        /* 断链 */
      }
    }
    items.push({
      worktree: wtPath,
      exists: Boolean(st),
      link: st && st.isSymbolicLink() ? readlinkSync(nm) : null,
      mtimeMs: st ? st.mtimeMs : null,
      top: entries.length,
      entries,
    })
  }
  return { at: new Date().toISOString(), root: machineAnchor(), items }
}

function snapshotCommand(rest) {
  const out = rest.find((a) => !a.startsWith('-'))
  const payload = collectWorktreeNodeModules()
  if (out) {
    writeFileSync(out, JSON.stringify(payload, null, 2), 'utf8')
    console.error(`[install-lock] 快照已写 ${out}（worktree ${payload.items.length} 个）`)
  } else {
    console.log(JSON.stringify(payload, null, 2))
  }
  return EXIT_OK
}

function compareSnapshotCommand(rest) {
  const base = rest.find((a) => !a.startsWith('-'))
  if (!base) usage('compare 需要基线文件，例如：compare -- <baseline.json>')
  const before = JSON.parse(readFileSync(base, 'utf8'))
  const now = collectWorktreeNodeModules()
  const byWt = new Map(now.items.map((i) => [i.worktree, i]))
  const changes = []
  for (const old of before.items || []) {
    const cur = byWt.get(old.worktree)
    if (!cur) {
      changes.push(`${old.worktree}: 消失`)
      continue
    }
    if (old.exists !== cur.exists) changes.push(`${old.worktree}: exists ${old.exists} → ${cur.exists}`)
    if (old.link !== cur.link) changes.push(`${old.worktree}: link ${old.link} → ${cur.link}`)
    if (old.top !== cur.top) changes.push(`${old.worktree}: top ${old.top} → ${cur.top}`)
    if (old.mtimeMs !== cur.mtimeMs) changes.push(`${old.worktree}: mtime 变了`)
    const beforeSet = new Set(old.entries || [])
    const afterSet = new Set(cur.entries || [])
    const added = [...afterSet].filter((x) => !beforeSet.has(x))
    const removed = [...beforeSet].filter((x) => !afterSet.has(x))
    if (added.length) changes.push(`${old.worktree}: 新增 ${added.slice(0, 5).join(',')}`)
    if (removed.length) changes.push(`${old.worktree}: 移除 ${removed.slice(0, 5).join(',')}`)
  }
  if (changes.length === 0) {
    console.error('[install-lock] 本前缀之外零变化 ✅')
    return EXIT_OK
  }
  console.error('[install-lock] 本前缀之外发生变化 ❌')
  for (const c of changes) console.error(`  - ${c}`)
  return 1
}

/**
 * 观察期统计（2026-11-07 立）：把「≥3 次真实 install、误拦 ≤1」变成可数事实。
 * 误拦由 replay 判定：check-block 发生时没有任何活跃 run-start ⇒ 那次拦截没有对应的
 * 真实安装，算误拦；有活跃安装则是正确拦截。
 */
function statsCommand(rest) {
  const sinceArg = rest.find((a) => a.startsWith('--since='))
  const asJson = rest.includes('--json')
  const since = sinceArg ? Date.parse(sinceArg.slice('--since='.length)) : NaN
  const path = join(machineAnchor(), '.ihui-agent', 'state', 'install-lock.log')
  let lines = []
  if (existsSync(path)) {
    lines = readFileSync(path, 'utf8')
      .split(/\r?\n/)
      .filter(Boolean)
      .map((l) => {
        try {
          return JSON.parse(l)
        } catch {
          return null
        }
      })
      .filter(Boolean)
  }
  if (Number.isFinite(since)) lines = lines.filter((e) => Date.parse(e.at) >= since)
  const active = new Set()
  let installs = 0
  let installsFailed = 0
  let installsViaEmergency = 0
  let blocks = 0
  let falseBlocks = 0
  let staleRecoveries = 0
  let directDenied = 0
  for (const e of lines) {
    if (e.event === 'run-start') {
      active.add(e.pid)
      if (e.enabled === false) installsViaEmergency += 1
      continue
    }
    if (e.event === 'run-end') {
      active.delete(e.pid)
      if (e.enabled !== false && /install/.test(e.cmd || '')) {
        if (e.code === 0) installs += 1
        else installsFailed += 1
      }
      continue
    }
    if (e.event === 'check-block') {
      blocks += 1
      if (active.size === 0) falseBlocks += 1
      continue
    }
    if (e.event === 'check-stale') { staleRecoveries += 1; continue }
    if (e.event === 'guard-deny' && /未携带锁 token/.test(e.reason || '')) directDenied += 1
  }
  const pass = installs >= 3 && falseBlocks <= 1
  const out = {
    since: Number.isFinite(since) ? new Date(since).toISOString() : null,
    installs,
    installsFailed,
    installsViaEmergency,
    blocks,
    falseBlocks,
    staleRecoveries,
    directDenied,
    activeNow: active.size,
    criterion: 'installs>=3 且 falseBlocks<=1（观察期 2026-11-07 → 2026-11-21）',
    pass,
    log: path,
  }
  if (asJson) {
    console.log(JSON.stringify(out, null, 2))
  } else {
    console.log(`[install-lock] 统计窗口：${out.since || '全部'}`)
    console.log(`  真实 install 成功：${installs}（失败 ${installsFailed}；应急口直跑 ${installsViaEmergency}）`)
    console.log(`  门位拦截：${blocks}（其中无对应安装的误拦 ${falseBlocks}；陈旧清理放行 ${staleRecoveries}）`)
    console.log(`  直连 install 被守卫拒绝：${directDenied}`)
    console.log(`  观察期判据：${out.criterion} ⇒ ${pass ? '达标' : '未达标'}`)
    console.log(`  日志：${path}`)
  }
  return pass ? EXIT_OK : 1
}

function usage(message) {
  if (message) console.error(message)
  console.error(
    [
      '用法：',
      '  node scripts/lib/pnpm-install-lock.mjs run -- <命令...>    # 在锁内执行安装（注入 token）',
      '  node scripts/lib/pnpm-install-lock.mjs check               # 安装期间禁止 typecheck（门位 opt-in）',
      '  node scripts/lib/pnpm-install-lock.mjs status              # 锁现场（pid/pidStart/开始时刻/已持有时长）',
      '  node scripts/lib/pnpm-install-lock.mjs guard               # preinstall 守卫：链接面 + token + 留痕',
      '  node scripts/lib/pnpm-install-lock.mjs snapshot -- <文件>   # 本前缀之外 worktree node_modules 快照',
      '  node scripts/lib/pnpm-install-lock.mjs compare -- <基线>    # 快照比对，零变化才 exit 0',
      '  node scripts/lib/pnpm-install-lock.mjs stats [--since=<ISO>] [--json]  # 观察期可数统计（install/误拦）',
      '',
      `默认启用；应急关闭：${ENABLE_ENV}=0（仅排障，非常规）`,
      `超时：${TIMEOUT_ENV}（毫秒，默认 30000，超时 exit 3）`,
      `锁位置：${DIR_ENV}（默认 <共享根>/.ihui-install.lock）`,
    ].join('\n'),
  )
  process.exit(EXIT_USAGE)
}

async function main() {
  const [sub, ...rest] = process.argv.slice(2)
  if (!sub || sub === '-h' || sub === '--help') usage()
  if (sub === 'run') return runCommand(rest)
  if (sub === 'check') return checkCommand()
  if (sub === 'status') return statusCommand()
  if (sub === 'guard') return guardCommand()
  if (sub === 'snapshot') return snapshotCommand(rest)
  if (sub === 'compare') return compareSnapshotCommand(rest)
  if (sub === 'stats') return statsCommand(rest)
  usage(`未知子命令：${sub}`)
}

const isDirectRun = process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href
if (isDirectRun) {
  main()
    .then((code) => {
      process.exitCode = code
    })
    .catch((e) => {
      console.error(`[install-lock] 未预期错误：${e && e.stack ? e.stack : e}`)
      process.exitCode = EXIT_USAGE
    })
}
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
