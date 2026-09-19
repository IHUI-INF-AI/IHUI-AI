#!/usr/bin/env node
// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠


/* eslint-disable no-console -- CLI 工具,需 console 输出诊断信息 */
/**
 * git-lock.mjs — git 写操作全局串行化锁(2026-08-06 立,根治多 agent 并发写损坏)。
 *
 * 事故背景(8-06 实锤 / 8-05 仓库重建 / 7-26 gc 清 tag):多 agent 并行 commit 时,
 * git 写操作(index/refs/pack)并发竞争 + autoGc 并发 repack → .git 元数据损坏。
 * 本项目 git 写操作必须串行化:同一时刻只允许一个「写操作单元」执行。
 *
 * 用法(CLI):
 *   node scripts/git-lock.mjs acquire [--unit <id>] [--timeout <ms>] [--stale <ms>]
 *   node scripts/git-lock.mjs release [--unit <id>]
 *   node scripts/git-lock.mjs check              # 只读:是否有锁,exit 0=无锁 1=有锁
 *   node scripts/git-lock.mjs heartbeat --unit <id> [--interval <ms>] [--parent-pid <pid>]
 *
 * 锁语义:
 *   - 锁 = .git/ihui-git-write.lock 目录(mkdir 原子性)
 *   - 锁内 meta 文件记录 { unitId, pid, ts }
 *   - 可重入:同 unitId(同一写操作单元,如 safe-commit 及其 post-commit 子进程)
 *     再次 acquire 直接通过,避免嵌套死锁
 *   - 心跳续期(2026-09-18 根治):持锁方 spawn heartbeat 子进程(随父进程死亡自动退出),
 *     每 intervalMs 重写 meta.ts。根治事故:长流程(pre-commit 多分钟)期间 meta.ts 停留在
 *     acquire 时刻,被并发方按"悬挂锁"误判强制抢占 → 两个进程同时写 .git(锁反而制造损坏)。
 *   - stale 清理(2026-09-18 加固):锁年龄超过 staleMs(默认 300s)**且持有者 pid 已死**
 *     才强制抢占;活进程的锁绝不被抢。另设 hardStale(默认 1800s)兜底 pid 复用假阳性。
 *   - 超时:acquire 等待 timeoutMs(默认 120s)后抛错
 *
 * 集成点(见 AGENTS.md 事故复盘):
 *   - scripts/safe-commit.mjs:整个 commit 流程包锁
 *   - .husky/post-commit:IHUI_GIT_LOCK_UNIT 未设置时(直接 git commit 场景)acquire
 *   - scripts/safe-gc.mjs:手动 gc 前必须 acquire(杜绝 gc 与写操作并发)
 */
import { execSync } from 'node:child_process'
import { mkdirSync, readFileSync, rmSync, writeFileSync, existsSync, readdirSync, statSync, unlinkSync } from 'node:fs'
import { join } from 'node:path'

function run(cmd, allowFail = false) {
  try {
    return execSync(cmd, { encoding: 'utf8', stdio: ['pipe', 'pipe', 'pipe'] }).trim()
  } catch (e) {
    if (allowFail) return null
    throw e
  }
}

/** 仓库 .git 目录(绝对路径) */
function gitDir() {
  const d = run('git rev-parse --absolute-git-dir', true)
  if (!d) throw new Error('不在 git 仓库中')
  return d
}

/** 锁目录路径 */
function lockDir() {
  return join(gitDir(), 'ihui-git-write.lock')
}

function metaFile(dir) {
  return join(dir, 'meta.json')
}

function readMeta(dir) {
  try {
    return JSON.parse(readFileSync(metaFile(dir), 'utf8'))
  } catch {
    return null
  }
}

function writeMeta(dir, unitId) {
  writeFileSync(
    metaFile(dir),
    JSON.stringify({ unitId: unitId ?? '', pid: process.pid, ts: Date.now() }),
    'utf8',
  )
}

/** 删除锁目录(先删 meta,再 rmdir;rmdir 失败(残留)时递归删除) */
function removeLock(dir) {
  try {
    rmSync(dir, { recursive: true, force: true })
  } catch {
    /* 忽略 */
  }
}

/** 检测进程是否存活(signal 0 探测,跨平台;EPERM 视为存在) */
function isPidAlive(pid) {
  if (!pid || Number(pid) === process.pid) return true
  try {
    process.kill(Number(pid), 0)
    return true
  } catch (e) {
    return e.code === 'EPERM'
  }
}

/**
 * 清理 git 原生 index.lock(2026-09-19 立,根治 index.lock 卡死多 agent)。
 *
 * 根因:git 写操作(index/refs)被中断(kill/崩溃/宿主清树)时,index.lock 残留,
 * 后续所有 git add/commit 都报 "Unable to create '.git/index.lock': File exists"。
 * 多 agent 并行时,一个 agent 的 git 崩溃会卡死所有人。
 *
 * 安全策略:
 *   - 扫描 .git/index.lock + .git/worktrees/ 下各 worktree 的 index.lock
 *   - 锁龄 > INDEX_LOCK_STALE_MS(默认 60s)即删除——git 单次 index 写入正常 < 5s,
 *     超过 60s 必定是崩溃残留(活进程持锁时文件会被持续刷新/占用,但 Windows 下
 *     文件时间戳不会更新,故用"年龄 + 无对应 git 进程"双判据)。
 *   - 双判据:优先检测是否有 git 进程在运行;无 git 进程时直接删;有 git 进程时
 *     年龄 > 60s 才删(兜底,因无法精确匹配哪个 git 持有哪个 index.lock)。
 */
const INDEX_LOCK_STALE_MS = 60_000

function cleanStaleIndexLocks() {
  const cleaned = []
  const base = gitDir()
  const candidates = [join(base, 'index.lock')]
  // worktrees 的 index.lock
  try {
    const wtDir = join(base, 'worktrees')
    if (existsSync(wtDir)) {
      for (const wt of readdirSync(wtDir)) {
        const wtIndexLock = join(wtDir, wt, 'index.lock')
        if (existsSync(wtIndexLock)) candidates.push(wtIndexLock)
      }
    }
  } catch {
    /* worktrees 目录不存在或不可读,跳过 */
  }
  // maintenance.lock(git gc/repack 崩溃残留,会阻塞后续 gc)
  const maintenanceLock = join(base, 'objects', 'maintenance.lock')
  if (existsSync(maintenanceLock)) candidates.push(maintenanceLock)
  // 是否有 git 进程在运行(粗略判据:tasklist 有 git.exe)
  let hasGitProcess = false
  try {
    const out = execSync('tasklist /FI "IMAGENAME eq git.exe" /NH', {
      encoding: 'utf8',
      stdio: ['pipe', 'pipe', 'pipe'],
    })
    hasGitProcess = /git\.exe/i.test(out)
  } catch {
    /* tasklist 失败,保守假设无 git 进程(允许清理) */
  }
  for (const lockPath of candidates) {
    try {
      const st = statSync(lockPath)
      const age = Date.now() - st.mtimeMs
      // 无 git 进程 → 必是残留;有 git 进程 → 年龄超阈值才删
      if (!hasGitProcess || age > INDEX_LOCK_STALE_MS) {
        unlinkSync(lockPath)
        cleaned.push(lockPath)
      }
    } catch {
      /* 文件正在被占用(活 git 持有)或已消失,跳过 */
    }
  }
  return cleaned
}

/**
 * 获取锁。返回 true 表示获取成功;同 unitId 可重入直接成功。
 * stale 判定(2026-09-18 加固):年龄超 staleMs **且持有者 pid 已死** 才抢占——
 * 活进程的锁(哪怕流程很长)绝不被抢,根治"长 commit 被误判悬挂 → 并发写损坏"。
 * hardStale(默认 1800s)兜底:pid 复用等极端假阳性时最终能逃生。
 *
 * 2026-09-19 修复(根治 index.lock 卡死):
 *   - 死 PID 立即抢占:持有者进程已退出时,不再等 staleMs(300s),直接抢占。
 *     此前死锁场景:agent 崩溃后锁残留,其他 agent 等 5 分钟才能继续,期间若绕过
 *     锁直接 git 操作 → index.lock 冲突 → 全员卡死。
 *   - acquire 前自动清理 stale index.lock:杜绝 git 原生锁残留阻塞。
 */
async function acquire({ unitId, timeoutMs = 120_000, staleMs = 300_000, hardStaleMs = 1_800_000 }) {
  // 先清理可能存在的 stale index.lock(死 git 进程残留),否则后续 git 操作全卡死
  cleanStaleIndexLocks()

  const dir = lockDir()
  const deadline = Date.now() + timeoutMs
  for (;;) {
    try {
      mkdirSync(dir, { recursive: false })
      writeMeta(dir, unitId)
      return true
    } catch {
      // 锁已存在:检查可重入 / stale
      const meta = readMeta(dir)
      if (meta && unitId && meta.unitId === unitId) {
        // 同一写操作单元(如 safe-commit → post-commit 链路)可重入
        return true
      }
      if (meta) {
        const age = Date.now() - (meta.ts ?? 0)
        const holderAlive = isPidAlive(meta.pid)
        // 2026-09-19:死 PID 立即抢占(不等 staleMs);活进程才走 staleMs/hardStaleMs
        if (!holderAlive || age > hardStaleMs || age > staleMs) {
          // 悬挂锁(持有者已崩溃退出,或超 hardStale 兜底):强制抢占
          removeLock(dir)
          continue
        }
      }
      if (Date.now() > deadline) {
        const alive = meta ? isPidAlive(meta.pid) : false
        throw new Error(
          `git 写锁等待超时(${timeoutMs}ms)。当前持锁: ${meta ? `unit=${meta.unitId} pid=${meta.pid} 于 ${new Date(meta.ts).toLocaleTimeString()}(${alive ? '持有者仍在运行,请耐心等待或稍后重试' : '持有者已退出,等待 stale 抢占'})` : '未知'}。` +
            '若确认为残留锁,超过 stale 时间会自动抢占;紧急可删 .git/ihui-git-write.lock',
        )
      }
      // 轮询等待(异步 setTimeout)
      await new Promise((resolve) => setTimeout(resolve, 300))
    }
  }
}

/** 释放锁(仅当锁属于当前 unitId;同 unitId 可重入多次 acquire 需配平 release) */
function release({ unitId }) {
  const dir = lockDir()
  if (!existsSync(dir)) return
  const meta = readMeta(dir)
  if (meta && unitId && meta.unitId !== unitId) return
  removeLock(dir)
}

/** 只读检查 */
function check() {
  const dir = lockDir()
  if (!existsSync(dir)) return 0
  const meta = readMeta(dir)
  console.log(
    `locked: unit=${meta?.unitId ?? ''} pid=${meta?.pid ?? ''} ts=${meta ? new Date(meta.ts).toISOString() : ''}`,
  )
  return 1
}

/**
 * 心跳续期(2026-09-18 根治):每 intervalMs 重写 meta.ts,使长流程持锁永不误判悬挂。
 * 退出条件(全部自动,无需清理动作):
 *   - 锁目录消失(已释放)或 unitId 易主
 *   - parentPid 指定的持锁父进程已退出(detached spawn 场景父死子亡)
 */
async function heartbeat({ unitId, intervalMs = 5_000, parentPid }) {
  const dir = lockDir()
  for (;;) {
    const meta = readMeta(dir)
    if (!meta || (unitId && meta.unitId !== unitId)) return
    if (parentPid && !isPidAlive(parentPid)) return
    try {
      writeFileSync(
        metaFile(dir),
        JSON.stringify({ unitId: meta.unitId, pid: meta.pid, ts: Date.now() }),
        'utf8',
      )
    } catch {
      return
    }
    await new Promise((resolve) => setTimeout(resolve, intervalMs))
  }
}

async function main() {
  const args = process.argv.slice(2)
  const cmd = args[0]
  const getOpt = (name) => {
    const i = args.indexOf(name)
    return i >= 0 ? args[i + 1] : undefined
  }

  try {
    if (cmd === 'acquire') {
      await acquire({
        unitId: getOpt('--unit') ?? '',
        timeoutMs: Number(getOpt('--timeout') ?? 120_000),
        staleMs: Number(getOpt('--stale') ?? 300_000),
      })
      console.log('locked')
    } else if (cmd === 'release') {
      release({ unitId: getOpt('--unit') ?? '' })
      console.log('released')
    } else if (cmd === 'check') {
      process.exit(check())
    } else if (cmd === 'heartbeat') {
      await heartbeat({
        unitId: getOpt('--unit') ?? '',
        intervalMs: Number(getOpt('--interval') ?? 5_000),
        parentPid: getOpt('--parent-pid') ? Number(getOpt('--parent-pid')) : undefined,
      })
    } else if (cmd === 'git-dir') {
      console.log(gitDir())
    } else if (cmd === 'clean') {
      // 2026-09-19:手动清理所有 stale 锁(ihui-git-write.lock 死 PID + index.lock 残留)
      // 用法: node scripts/git-lock.mjs clean
      const dir = lockDir()
      const removed = []
      // 1. 清理死 PID 的 ihui-git-write.lock
      if (existsSync(dir)) {
        const meta = readMeta(dir)
        if (meta) {
          const holderAlive = isPidAlive(meta.pid)
          const age = Date.now() - (meta.ts ?? 0)
          if (!holderAlive || age > 1_800_000) {
            removeLock(dir)
            removed.push(`ihui-git-write.lock(unit=${meta.unitId} pid=${meta.pid} ${holderAlive ? 'hardStale' : 'dead'})`)
          } else {
            console.log(`保留 ihui-git-write.lock(持有者 pid=${meta.pid} 仍存活,age=${Math.round(age / 1000)}s)`)
          }
        } else {
          // 无 meta.json 的残留锁目录,直接删
          removeLock(dir)
          removed.push('ihui-git-write.lock(无 meta.json)')
        }
      }
      // 2. 清理 stale index.lock
      const indexLocks = cleanStaleIndexLocks()
      removed.push(...indexLocks.map((p) => `index.lock:${p}`))
      if (removed.length === 0) {
        console.log('✅ 无 stale 锁需清理')
      } else {
        console.log(`🧹 已清理 ${removed.length} 个 stale 锁:`)
        for (const r of removed) console.log(`   - ${r}`)
      }
    } else {
      console.error('用法: git-lock.mjs acquire|release|check|heartbeat|clean [--unit <id>] [--timeout <ms>] [--stale <ms>] [--parent-pid <pid>]')
      process.exit(1)
    }
  } catch (e) {
    console.error(`❌ ${e.message}`)
    process.exit(1)
  }
}

void main()
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
