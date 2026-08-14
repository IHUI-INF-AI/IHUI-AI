#!/usr/bin/env node
/* eslint-disable no-console -- CLI 工具,需 console 输出诊断信息 */
/**
 * deploy-lock.mjs — 部署/构建流程全局串行化锁(2026-08-09 立,根治多 agent 并发部署)。
 *
 * 事故背景(8-09 实锤):09:48 另一自动化 Agent 与手动部署并行触发 build-next-prod.ps1,
 * 两个构建同时备份/清理/写入 apps/web/.next → 8801 短暂 502 + 监控报警,且产物存在损坏风险。
 * 根因:原 apps/web/scripts/check-lock.js 只有 dev-vs-build 互斥,没有 build-vs-build;
 * 且 build-next-prod.ps1 引用了不存在的 scripts/check-lock.js,锁从未真正生效。
 *
 * 本锁设计:
 *   - 锁 = 项目根 .deploy.lock 目录(mkdir 原子性,不依赖 cwd/平台)
 *   - 覆盖整个「构建+部署」单元:acquire 成功后持有,直到 release
 *   - build 模式:与其他 build、dev、deploy 全部互斥
 *   - dev 模式:与 build/deploy 互斥(dev+dev 放宽,与旧 check-lock 一致)
 *   - stale 清理:锁年龄超过 staleMs(默认 600s = 10min)视为悬挂锁,强制抢占
 *   - 超时:acquire 等待 timeoutMs(默认 600s)后抛错退出(不覆盖不打断进行中的部署)
 *
 * 用法(CLI):
 *   node scripts/deploy-lock.mjs acquire [--mode <build|dev>] [--timeout <ms>] [--stale <ms>]
 *   node scripts/deploy-lock.mjs release [--mode <build|dev>]
 *   node scripts/deploy-lock.mjs check            # 只读:exit 0=无锁 1=有锁(打印持锁信息)
 *
 * 集成点:
 *   - scripts/build-next-prod.ps1:构建开始 acquire(build),结束 release
 *   - apps/web 的 dev 启动脚本:启动前 acquire(dev),退出 release
 */
import { mkdirSync, readFileSync, rmSync, writeFileSync, existsSync, readdirSync } from 'node:fs'
import { join, resolve, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'

const __dirname = dirname(fileURLToPath(import.meta.url))
const repoRoot = resolve(__dirname, '..')

/** 锁目录(固定路径:项目根 .deploy.lock,不随 cwd 变化) */
function lockDir() {
  return join(repoRoot, '.deploy.lock')
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

function writeMeta(dir, mode) {
  writeFileSync(
    metaFile(dir),
    JSON.stringify({ mode: mode ?? '', pid: process.pid, ts: Date.now() }),
    'utf8',
  )
}

/** 删除锁目录 */
function removeLock(dir) {
  try {
    rmSync(dir, { recursive: true, force: true })
  } catch {
    /* 忽略 */
  }
}

/** 进程是否存活(跨平台) */
function isProcessAlive(pid) {
  if (!pid) return false
  try {
    process.kill(pid, 0)
    return true
  } catch {
    return false
  }
}

/**
 * 获取锁。返回 true 表示获取成功。
 * 规则:
 *   - dev+dev:放宽(多个 dev 可共存,与旧 check-lock 一致)
 *   - build 与其他任何模式:严格互斥
 *   - 悬挂锁(进程已死且超 stale):自动抢占
 *   - 超时未获锁:抛错(不打断进行中的部署)
 */
async function acquire({ mode = 'build', timeoutMs = 600_000, staleMs = 600_000 } = {}) {
  const dir = lockDir()
  const deadline = Date.now() + timeoutMs
  for (;;) {
    try {
      mkdirSync(dir, { recursive: false })
      writeMeta(dir, mode)
      console.log(`[deploy-lock] ${mode} 锁已获取 (pid=${process.pid})`)
      return true
    } catch {
      // 锁已存在:判断是否可共存 / 是否 stale
      const meta = readMeta(dir)
      const holderPid = meta?.pid
      const holderAlive = isProcessAlive(holderPid)

      if (mode === 'dev' && meta?.mode === 'dev' && holderAlive) {
        // dev+dev 共存(旧 check-lock 语义)
        console.log(`[deploy-lock] dev+dev 共存,继续 (持有者 pid=${holderPid})`)
        return true
      }

      if (meta && !holderAlive && Date.now() - (meta.ts ?? 0) > staleMs) {
        console.warn(
          `[deploy-lock] 检测到悬挂锁(pid=${holderPid} 已退出,${Math.round((Date.now() - (meta.ts ?? 0)) / 1000)}s 前),强制抢占`,
        )
        removeLock(dir)
        // 2026-08-14 修复:removeLock 内部 rmSync 失败会被静默吞掉,
        // 若目录仍在则继续 for(;;) 会无限死循环(build/dev 永远卡住)。
        // 加一道校验:删除后若锁目录仍存在,直接抛错退出(提示用户手动删除),
        // 不再 continue 进入下一轮轮询。
        if (existsSync(dir)) {
          throw new Error(
            `[deploy-lock] 无法删除悬挂锁 ${dir}(可能被其他进程占用/权限不足)。` +
              '请手动删除该项目根 .deploy.lock 目录后重试。',
          )
        }
        continue
      }

      if (Date.now() > deadline) {
        const holderInfo = meta
          ? `mode=${meta.mode} pid=${meta.pid} 于 ${new Date(meta.ts).toLocaleTimeString()}${holderAlive ? '(运行中)' : '(已退出)'}`
          : '未知'
        throw new Error(
          `[deploy-lock] 等待部署锁超时(${timeoutMs}ms)。当前持锁: ${holderInfo}。` +
            '若为残留锁(进程已退出),超 stale 时间会自动抢占;紧急可删项目根 .deploy.lock',
        )
      }
      // 轮询等待
      await new Promise((r) => setTimeout(r, 500))
    }
  }
}

/** 释放锁(CLI 场景 acquire/release 是不同进程,按 mode 匹配释放;持有者同 mode 时即视为可释放) */
function release({ mode } = {}) {
  const dir = lockDir()
  if (!existsSync(dir)) return
  const meta = readMeta(dir)
  // 若调用方指定 mode,要求锁的 mode 一致才释放(避免误删他人不同类型的锁)
  if (mode && meta && meta.mode !== mode) return
  if (meta && meta.pid !== process.pid && meta.pid && isProcessAlive(meta.pid)) {
    // 锁持有进程还活着且不是自己 → 不释放(尊重持有者)
    console.warn(`[deploy-lock] 锁由 pid=${meta.pid} 持有且仍在运行,拒绝释放`)
    return
  }
  removeLock(dir)
  console.log(`[deploy-lock] 锁已释放 (pid=${process.pid})`)
}

/** 只读检查:exit 0=无锁,1=有锁 */
function check() {
  const dir = lockDir()
  if (!existsSync(dir)) return 0
  const meta = readMeta(dir)
  const alive = meta?.pid ? isProcessAlive(meta.pid) : false
  console.log(
    `locked: mode=${meta?.mode ?? ''} pid=${meta?.pid ?? ''} alive=${alive} ts=${meta ? new Date(meta.ts).toISOString() : ''}`,
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
        mode: getOpt('--mode') ?? 'build',
        timeoutMs: Number(getOpt('--timeout') ?? 600_000),
        staleMs: Number(getOpt('--stale') ?? 600_000),
      })
    } else if (cmd === 'release') {
      release({ mode: getOpt('--mode') ?? 'build' })
    } else if (cmd === 'check') {
      process.exit(check())
    } else {
      console.error('用法: deploy-lock.mjs acquire|release|check [--mode <build|dev>] [--timeout <ms>] [--stale <ms>]')
      process.exit(1)
    }
  } catch (e) {
    console.error(`❌ ${e.message}`)
    process.exit(1)
  }
}

void main()
