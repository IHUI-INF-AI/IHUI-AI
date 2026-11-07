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
 *   2) `check`：给 pre-commit / push 门**可选**调用的一句判据：安装期间禁止 typecheck。
 *
 * 默认**不启用**：IHUI_PNPM_INSTALL_LOCK 不是 `1` 时，`run` 原样执行命令、`check` 恒通过。
 * 本文件不被任何现有门引用；接入与否由使用方显式 opt-in 决定（typecheck 侧见
 * scripts/check-staged-typecheck.mjs 的 IHUI_TYPECHECK_CHECK_INSTALL=1）。
 *
 * 与 typecheck 锁的关系（2026-11-07 核实，勿再写成"统一判定"）：
 *   **两把锁各自判定，理由不同。**
 *   - typecheck 锁（scripts/lib/typecheck-lock.mjs）按 pid + 进程启动时刻核对持有者
 *     身份，import 的是 scripts/lib/proc-identity.mjs 的 identityFields()/verifyHolder()；
 *   - 安装锁（本文件）只按 bootEpoch + 心跳 + 6h 判活，**不** import proc-identity ——
 *     它要判的是"机器是否重启过 / 持有者是否还在续心跳"，身份核对不是它的判据。
 *   方向**单向**：只允许 typecheck 查 install（IHUI_TYPECHECK_CHECK_INSTALL=1，opt-in）；
 *   绝不允许 install 等 typecheck。双向互等会在安装/检查交错时直接死锁。
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
 *   L3 进程还在      —— pid 不存在 ⇒ 陈旧
 *   L4 心跳还在续    —— heartbeatAt 超过 15 分钟未更新 ⇒ 持有者不再活动
 *   另有绝对上限 6h（只用于"读不出 owner"这一支；正常持有不受它约束）。
 *   pid 复用的处置与 deploy-lock-common.ps1 同源：L2 + L4 兜底，不拿裸 pid 当永生锁。
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

import { spawn } from 'node:child_process'
import { randomBytes } from 'node:crypto'
import {
  existsSync,
  mkdirSync,
  readFileSync,
  renameSync,
  rmSync,
  statSync,
  writeFileSync,
} from 'node:fs'
import { hostname, tmpdir, uptime } from 'node:os'
import { join } from 'node:path'
import { pathToFileURL } from 'node:url'

const ENABLE_ENV = 'IHUI_PNPM_INSTALL_LOCK'
const DIR_ENV = 'IHUI_PNPM_INSTALL_LOCK_DIR'
const TIMEOUT_ENV = 'IHUI_PNPM_INSTALL_LOCK_TIMEOUT_MS'

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

function lockDir() {
  const custom = process.env[DIR_ENV]
  if (custom && custom.trim()) return custom.trim()
  return join(tmpdir(), 'ihui-pnpm-install.lock')
}

function enabled() {
  return process.env[ENABLE_ENV] === '1'
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
  return {
    v: 1,
    pid: process.pid,
    host: hostname(),
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
  return {
    stale: false,
    reason: `pid=${owner.pid} 仍存活且心跳在 ${Math.max(0, Math.round(beatAge / 1000))}s 内`,
  }
}

function describe(state) {
  if (state.kind !== 'ok') return state.reason
  const o = state.owner
  return `pid=${o.pid} host=${o.host} startedAt=${o.startedAt} heartbeatAt=${o.heartbeatAt} cmd=${o.cmd || '-'}`
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
    try {
      mkdirSync(dir)
      try {
        atomicWriteJson(join(dir, 'owner.json'), owner)
      } catch (e) {
        rmSync(dir, { recursive: true, force: true })
        throw e
      }
      return owner
    } catch (e) {
      if (!e || e.code !== 'EEXIST') {
        fail(EXIT_USAGE, `[install-lock] 建锁失败：${e.message}`)
      }
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
    const quote = (s) => (/[\s"]/.test(s) ? `"${s.replace(/"/g, '\\"')}"` : s)
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
    console.error(`[install-lock] 未启用（${ENABLE_ENV}!=1），直接执行原命令（行为不变）`)
    return waitChild(spawnCommand(args))
  }

  const dir = lockDir()
  const owner = await acquire(dir, args)
  let released = false
  const releaseOnce = () => {
    if (released) return
    released = true
    release(dir, owner)
  }
  process.on('exit', releaseOnce)

  console.error(`[install-lock] 已拿锁 ${dir}（pid=${owner.pid}），执行：${args.join(' ')}`)
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
  return code
}

function checkCommand() {
  if (!enabled()) {
    console.error(`[install-lock] 未启用（${ENABLE_ENV}!=1），check 恒通过（默认行为不变）`)
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
    console.error(`[install-lock] 安装锁已陈旧（${verdict.reason}）⇒ 清理后放行`)
    return EXIT_OK
  }
  console.error(`[install-lock] pnpm 安装进行中：${describe(state)}`)
  console.error('[install-lock] 禁止并发 typecheck（会踩到 node_modules 重建窗口，出现 ENOENT）')
  return EXIT_INSTALL_RUNNING
}

function statusCommand() {
  const dir = lockDir()
  const state = readState(dir)
  const verdict = classify(state)
  const out = {
    enabled: enabled(),
    lockDir: dir,
    state: state.kind,
    stale: verdict.stale,
    reason: verdict.reason,
    owner: state.kind === 'ok' ? state.owner : null,
  }
  console.info(JSON.stringify(out, null, 2))
  return EXIT_OK
}

function usage(message) {
  if (message) console.error(message)
  console.error(
    [
      '用法：',
      '  node scripts/lib/pnpm-install-lock.mjs run -- <命令...>    # 在锁内执行安装',
      '  node scripts/lib/pnpm-install-lock.mjs check               # 安装期间禁止 typecheck（可选门）',
      '  node scripts/lib/pnpm-install-lock.mjs status              # 人读/机器读的锁现场',
      '',
      `默认不启用；显式 opt-in：${ENABLE_ENV}=1`,
      `超时：${TIMEOUT_ENV}（毫秒，默认 30000，超时 exit 3）`,
      `锁位置：${DIR_ENV}（默认 os.tmpdir()/ihui-pnpm-install.lock）`,
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
