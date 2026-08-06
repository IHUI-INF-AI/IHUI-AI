#!/usr/bin/env node
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
 *
 * 锁语义:
 *   - 锁 = .git/ihui-git-write.lock 目录(mkdir 原子性)
 *   - 锁内 meta 文件记录 { unitId, pid, ts }
 *   - 可重入:同 unitId(同一写操作单元,如 safe-commit 及其 post-commit 子进程)
 *     再次 acquire 直接通过,避免嵌套死锁
 *   - stale 清理:锁年龄超过 staleMs(默认 300s)视为悬挂锁,强制抢占
 *   - 超时:acquire 等待 timeoutMs(默认 120s)后抛错
 *
 * 集成点(见 AGENTS.md 事故复盘):
 *   - scripts/safe-commit.mjs:整个 commit 流程包锁
 *   - .husky/post-commit:IHUI_GIT_LOCK_UNIT 未设置时(直接 git commit 场景)acquire
 *   - scripts/safe-gc.mjs:手动 gc 前必须 acquire(杜绝 gc 与写操作并发)
 */
import { execSync } from 'node:child_process'
import { mkdirSync, readFileSync, rmSync, writeFileSync, existsSync } from 'node:fs'
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

/**
 * 获取锁。返回 true 表示获取成功;同 unitId 可重入直接成功。
 * 锁为悬挂(stale)时强制抢占。等待用异步 setTimeout(不依赖外部 sleep 命令)。
 */
async function acquire({ unitId, timeoutMs = 120_000, staleMs = 300_000 }) {
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
      if (meta && Date.now() - (meta.ts ?? 0) > staleMs) {
        // 悬挂锁(进程崩溃未释放):强制抢占
        removeLock(dir)
        continue
      }
      if (Date.now() > deadline) {
        throw new Error(
          `git 写锁等待超时(${timeoutMs}ms)。当前持锁: ${meta ? `unit=${meta.unitId} pid=${meta.pid} 于 ${new Date(meta.ts).toLocaleTimeString()}` : '未知'}。` +
            '若为残留锁(进程已退出),超过 stale 时间会自动抢占;紧急可删 .git/ihui-git-write.lock',
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
    } else if (cmd === 'git-dir') {
      console.log(gitDir())
    } else {
      console.error('用法: git-lock.mjs acquire|release|check [--unit <id>] [--timeout <ms>] [--stale <ms>]')
      process.exit(1)
    }
  } catch (e) {
    console.error(`❌ ${e.message}`)
    process.exit(1)
  }
}

void main()
