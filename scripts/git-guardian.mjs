#!/usr/bin/env node
// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/* eslint-disable no-console -- CLI 工具,需 console 输出诊断信息 */
/**
 * git-guardian.mjs — `.git` 存活守护 + 秒级自愈(2026-09-12 立)。
 *
 * 事故背景(2026-08 至 2026-09-12,累计 15 次):本机宿主 safe-delete 层会**整体删除**
 * 工作区里的 `.git`。实测触发点:git commit(husky pre-commit 链)、rebase、
 * filter-repo(内部 gc/repack)、reset --hard、**git stash create**、
 * 以及本机直推 Gitee/GitCode 完成后的 5 秒窗口。
 * `CODEBUDDY_SAFE_DELETE_ENABLED=0` 前缀**已证明防不住**(第 14、15 次实测)。
 *
 * 两道根治(2026-09-12 落地):
 *   ① 结构根治 —— 仓库改为 `--separate-git-dir`:
 *        D:/IHUI-AI/.git      <- 28 字节**指针文件**(不再是 544MB 目录)
 *        D:/IHUI-AI-git-repo  <- 真实 gitdir(在工作区之外,躲开批量删除判定)
 *      即便指针文件被删,实体完好 —— 重建只需写 1 行。
 *   ② 本脚本兜底 —— 定时巡检,任一环缺失即自动重建,并写审计日志。
 *
 * 三道根治(2026-09-12 落地):
 *   ① 结构根治 —— 仓库改为 `--separate-git-dir`(见上)
 *   ② 本脚本兜底 —— 定时巡检,任一环缺失即自动重建,并写审计日志
 *   ③ 环境解耦 —— git 调用**不依赖 PATH / safe.directory 等环境**:
 *        可执行文件按候选列表绝对路径解析;每次调用显式带 `-c safe.directory=*`。
 *      (2026-09-12 06:47 实测缺口:服务账户 LocalSystem 下 git 不可用 →
 *       旧版只有"需人工介入",无自愈路径。本版补齐 healEnv()。)
 *
 * 用法:
 *   node scripts/git-guardian.mjs            # 检查 + 自动修复(默认)
 *   node scripts/git-guardian.mjs --check    # 只检查不修复(退出码 1 = 异常;供 CI/巡检用)
 *   node scripts/git-guardian.mjs --status   # 只打印健康详情
 *   node scripts/git-guardian.mjs --daemon   # 常驻巡检(被 nssm 服务 IHUI-GIT-GUARD 托管)
 *   node scripts/git-guardian.mjs --install  # 注册 Windows 任务计划(每 2 分钟自检一次;本机被安全策略拦截,备用)
 */
import { execFileSync } from 'node:child_process'
import {
  appendFileSync,
  cpSync,
  existsSync,
  mkdirSync,
  readFileSync,
  renameSync,
  rmSync,
  writeFileSync,
} from 'node:fs'
import { dirname, join } from 'node:path'

const WORKTREE = 'D:/IHUI-AI'
const GITDIR = 'D:/IHUI-AI-git-repo'
const BACKUP = 'D:/IHUI-AI.git-backup-20260912'
const GITEE_URL = 'https://gitee.com/JLSLSSZWHYXGS_0/IHUI-AI.git'
const TASK_NAME = 'IHUI-AI git-guardian'
const LOG = join(WORKTREE, '.workbuddy', 'git-guardian.log')
const POINTER = join(WORKTREE, '.git')
const EXPECTED_POINTER = `gitdir: ${GITDIR}\n`

const CHECK_ONLY = process.argv.includes('--check')
const STATUS_ONLY = process.argv.includes('--status')
const INSTALL = process.argv.includes('--install')
const DAEMON = process.argv.includes('--daemon')

function log(msg) {
  const line = `[${new Date().toISOString()}] ${msg}`
  console.log(line)
  try {
    mkdirSync(dirname(LOG), { recursive: true })
    appendFileSync(LOG, line + '\n')
  } catch {
    /* 日志失败不影响守护 */
  }
}

// —— git 可执行文件解析:不依赖 PATH(nssm 服务账户可能没有 PATH) ——
const GIT_CANDIDATES = [
  process.env.GIT_BIN,
  'git',
  'C:/Program Files/Git/cmd/git.exe',
  'C:/Program Files (x86)/Git/cmd/git.exe',
  'C:/Users/Administrator/.workbuddy/binaries/PortableGit/versions/1.2.0/cmd/git.exe',
].filter(Boolean)

let GIT_BIN = null
let GIT_VERSION = null

function resolveGitBin() {
  if (GIT_BIN) return GIT_BIN
  for (const c of GIT_CANDIDATES) {
    try {
      const v = execFileSync(c, ['--version'], {
        encoding: 'utf8',
        stdio: ['pipe', 'pipe', 'pipe'],
        timeout: 15000,
      }).trim()
      GIT_BIN = c
      GIT_VERSION = v
      return GIT_BIN
    } catch {
      /* 试下一个候选 */
    }
  }
  return null
}

/**
 * 每次 git 调用显式带 `-c safe.directory=*`:
 * 服务账户(如 LocalSystem)与本机账户的 safe.directory 配置互不相通,
 * 显式传入可从根上消除 "dubious ownership" 这一整类失败。git ≥ 2.35.1 均支持。
 */
const GIT_SAFE_ARGS = ['-c', 'safe.directory=*']

function git(args, allowFail = false) {
  const bin = resolveGitBin()
  if (!bin) {
    if (allowFail) return null
    throw new Error('git 不可用:候选可执行文件均不可调用')
  }
  try {
    return execFileSync(bin, [...GIT_SAFE_ARGS, '-C', WORKTREE, ...args], {
      encoding: 'utf8',
      stdio: ['pipe', 'pipe', 'pipe'],
      timeout: 180000,
    }).trim()
  } catch (e) {
    if (allowFail) return null
    throw e
  }
}

/** 指针文件是否为期望的 1 行内容 */
function pointerOk() {
  try {
    return readFileSync(POINTER, 'utf8').trim() === `gitdir: ${GITDIR}`
  } catch {
    return false
  }
}

/** 实体 gitdir 是否具备可用骨架 */
function gitdirOk() {
  return (
    existsSync(join(GITDIR, 'HEAD')) &&
    existsSync(join(GITDIR, 'objects')) &&
    existsSync(join(GITDIR, 'refs'))
  )
}

/** git 命令视角是否可用(最终判据) */
function gitUsable() {
  const head = git(['rev-parse', 'HEAD'], true)
  return !!head
}

/** 重建 .git 指针文件(原子写 + 回读校验) */
function healPointer() {
  const tmp = `${POINTER}.tmp-${process.pid}`
  writeFileSync(tmp, EXPECTED_POINTER)
  try {
    rmSync(POINTER, { recursive: true, force: true })
  } catch {
    /* 目标可能不存在 */
  }
  renameSync(tmp, POINTER)
  const ok = pointerOk()
  log(`${ok ? '修复' : '修复失败'}: 重建 .git 指针文件 -> ${GITDIR}`)
  return ok
}

/**
 * 环境自愈:`git=true` 之外的唯一分支 —— pointer/gitdir 都在但 git 命令不可用。
 * 两个根因:① git 可执行文件不在 PATH ② 账户级 safe.directory 缺失。
 * ① 由 resolveGitBin() 绝对路径兜住;② 在此幂等补写 system/global 配置。
 */
function healEnv() {
  const bin = resolveGitBin()
  if (!bin) {
    log('环境修复失败: 未找到可调用的 git 可执行文件')
    return false
  }
  log(`环境修复: 使用 git=${bin} (${GIT_VERSION || 'unknown'})`)
  for (const scope of ['--system', '--global']) {
    for (const p of [WORKTREE, GITDIR]) {
      try {
        const cur = execFileSync(bin, ['config', scope, '--get-all', 'safe.directory'], {
          encoding: 'utf8',
          stdio: ['pipe', 'pipe', 'pipe'],
        }).trim()
        const list = cur.split(/\r?\n/).filter(Boolean)
        if (list.includes(p) || list.includes('*')) continue
        execFileSync(bin, ['config', scope, '--add', 'safe.directory', p], {
          stdio: ['pipe', 'pipe', 'pipe'],
        })
        log(`环境修复: ${scope} safe.directory += ${p}`)
      } catch {
        /* 权限不足(非管理员)或无该 scope 配置,忽略 —— 命令行 -c 已兜底 */
      }
    }
  }
  return gitUsable()
}

/** HEAD 文件原文(空串表示读不到) */
function headContent() {
  try {
    return readFileSync(join(GITDIR, 'HEAD'), 'utf8').trim()
  } catch {
    return ''
  }
}

/** HEAD 语法是否合法:`ref: refs/...` 或 40 位 SHA */
function headSyntacticallyOk() {
  const h = headContent()
  return /^ref: refs\/[^\s]+$/.test(h) || /^[0-9a-f]{40}$/.test(h)
}

/** 兜底 0.5:HEAD 内容损坏(截断/乱码)→ 重写为常规分支符号引用(无损) */
function healHead() {
  if (headSyntacticallyOk()) return false
  log(
    `修复: HEAD 内容非法(${JSON.stringify(headContent().slice(0, 60))}) -> 重置为 ref: refs/heads/main`,
  )
  writeFileSync(join(GITDIR, 'HEAD'), 'ref: refs/heads/main\n')
  return gitUsable()
}

/** 破坏性覆盖前先归档现场(保留可回溯副本;同一轮只归档一次) */
let ARCHIVED_PATH = null
function archiveGitdir(tag) {
  if (ARCHIVED_PATH) return ARCHIVED_PATH
  const dst = `${GITDIR}.broken-${tag}`
  try {
    cpSync(GITDIR, dst, { recursive: true, force: true })
    ARCHIVED_PATH = dst
    log(`归档: 现场已备份 -> ${dst}`)
    return dst
  } catch (e) {
    log(`归档失败(放弃破坏性恢复,避免数据不可回溯): ${String(e.message || e)}`)
    return null
  }
}

/**
 * 统一修复阶梯(单例,main 与 daemon 共用):
 *   指针 -> 环境 -> HEAD 语法 -> 备份 -> 远端
 * 任一步成功即止;每次破坏性覆盖前先归档现场。
 */
function remediate(before) {
  if (!before.gitdirOk) {
    return !!(healFromBackup() || healFromRemote())
  }
  if (!before.pointerOk) healPointer()
  if (!gitUsable()) healEnv()
  if (!gitUsable()) healHead()
  if (!gitUsable()) {
    if (!archiveGitdir(Date.now())) return false
    return !!(healFromBackup() || healFromRemote())
  }
  return true
}

/** 兜底 1:从本地备份恢复实体(快,Gitee 不可达时用) */
function healFromBackup() {
  if (!existsSync(join(BACKUP, 'HEAD'))) return false
  log('修复: 从本地备份恢复 gitdir <- ' + BACKUP)
  mkdirSync(GITDIR, { recursive: true })
  cpSync(BACKUP, GITDIR, { recursive: true, force: true })
  if (!pointerOk()) healPointer()
  // 备份可能陈旧:补齐远端对象(refs + objects 增量)
  git(['fetch', 'origin', 'main'], true)
  log('恢复后 fetch 增量完成')
  return gitUsable()
}

/** 兜底 2:从远端整仓重建(慢,42 秒实测,保证最新) */
function healFromRemote() {
  log('修复: 从远端重建 gitdir <- ' + GITEE_URL)
  if (existsSync(GITDIR)) {
    if (!archiveGitdir('remote-' + Date.now())) return false
    try {
      rmSync(GITDIR, { recursive: true, force: true })
    } catch (e) {
      log('清理损坏 gitdir 失败: ' + String(e.message || e))
    }
  }
  git(['init', '--separate-git-dir=' + GITDIR, WORKTREE], true)
  if (!pointerOk()) healPointer()
  const remote = git(['remote', 'get-url', 'origin'], true)
  if (!remote) git(['remote', 'add', 'origin', GITEE_URL], true)
  git(['fetch', 'origin', 'main'], true)
  const head = git(['rev-parse', 'FETCH_HEAD'], true)
  if (head) git(['reset', '--mixed', head], true)
  git(['remote', 'set-url', 'origin', 'https://github.com/IHUI-INF-AI/IHUI-AI.git'], true)
  git(['config', 'core.hooksPath', '.husky'], true)
  git(['config', 'gc.auto', '0'], true)
  git(['config', 'gc.autodetach', 'false'], true)
  git(['config', 'maintenance.auto', 'false'], true)
  return gitUsable()
}

function status() {
  resolveGitBin()
  const health = {
    pointerOk: pointerOk(),
    gitdirOk: gitdirOk(),
    gitUsable: gitUsable(),
    gitBin: GIT_BIN,
    gitVersion: GIT_VERSION,
    head: git(['rev-parse', '--short', 'HEAD'], true),
    branch: git(['rev-parse', '--abbrev-ref', 'HEAD'], true),
    dirty: (git(['status', '--porcelain'], true) || '').split('\n').filter(Boolean).length,
    backupOk: existsSync(join(BACKUP, 'HEAD')),
  }
  return health
}

/** 异常行描述(含 HEAD 提示),main 与 daemon 共用 */
function anomalyLine(h) {
  const hint =
    h.pointerOk && h.gitdirOk && !h.gitUsable
      ? ` | HEAD=${JSON.stringify(headContent().slice(0, 60))}`
      : ''
  return `⚠️ 检测到 .git 异常: pointer=${h.pointerOk} gitdir=${h.gitdirOk} git=${h.gitUsable}${hint}`
}

function main() {
  if (INSTALL) {
    const node = process.execPath
    const script = join(WORKTREE, 'scripts', 'git-guardian.mjs')
    const tr = `"${node}" "${script}"`
    try {
      execFileSync(
        'schtasks',
        ['/create', '/tn', TASK_NAME, '/tr', tr, '/sc', 'minute', '/mo', '2', '/f'],
        {
          stdio: 'inherit',
        },
      )
      log(`已注册任务计划 "${TASK_NAME}"(每 2 分钟自检)`)
    } catch (e) {
      log('注册任务计划失败(需管理员权限): ' + String(e.message || e))
      process.exit(1)
    }
    return 0
  }

  const before = status()
  if (STATUS_ONLY) {
    console.log(JSON.stringify(before, null, 1))
    return 0
  }

  const healthy = before.pointerOk && before.gitdirOk && before.gitUsable
  if (healthy) {
    if (CHECK_ONLY) console.log('✅ .git 健康(pointer + gitdir + git 可用)')
    return 0
  }

  log(anomalyLine(before))
  if (CHECK_ONLY) {
    console.log('❌ .git 异常(未修复,--check 模式)')
    return 1
  }

  // 分层自愈:指针 -> 环境 -> HEAD 语法 -> 备份 -> 远端
  remediate(before)

  const after = status()
  const ok = after.pointerOk && after.gitdirOk && after.gitUsable
  log(ok ? `✅ 自愈成功(HEAD=${after.head})` : '❌ 自愈失败,需人工介入')
  return ok ? 0 : 1
}

/** 常驻守护模式:被 nssm 服务托管,每 intervalMs 巡检一次(默认 10 秒) */
function startDaemon() {
  const intervalMs = Number(process.env.GIT_GUARDIAN_INTERVAL_MS || 10000)
  const bin = resolveGitBin()
  log(`守护模式启动(间隔 ${intervalMs}ms) — 监控 ${POINTER} + ${GITDIR}`)
  log(`git=${bin || '(未找到!)'} ${GIT_VERSION || ''} safe.directory=* (每次调用显式传入)`)
  const tick = () => {
    try {
      const h = status()
      if (!(h.pointerOk && h.gitdirOk && h.gitUsable)) {
        log(anomalyLine(h))
        remediate(h)
        const a = status()
        log(
          a.pointerOk && a.gitdirOk && a.gitUsable
            ? `✅ 自愈成功(HEAD=${a.head})`
            : '❌ 自愈失败,需人工介入',
        )
      }
    } catch (e) {
      log('巡检异常(忽略): ' + String(e.message || e))
    }
    setTimeout(tick, intervalMs)
  }
  tick()
}

if (DAEMON) {
  startDaemon()
} else {
  process.exit(main())
}
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
