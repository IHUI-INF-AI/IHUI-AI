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
 *   node scripts/git-guardian.mjs --daemon   # 常驻巡检(需自备托管;本机未装 nssm,实际未用)
 *   node scripts/git-guardian.mjs --install  # 注册 Windows 任务计划(每 2 分钟自检;2026-09-12 实测可用并已启用,任务名 IHUI-AI git-guardian)
 *   node scripts/git-guardian.mjs --notify-test [名字]  # 真发一封"通知链路自测"邮件(绕过当轮去重,须节制)
 *   node scripts/git-guardian.mjs --notify-dry-run      # 只问品牌邮件派发器「通道是否齐备」(零网络请求)
 */
import { execFileSync, spawnSync } from 'node:child_process'
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
import { basename, dirname, join } from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'
import { createHash } from 'node:crypto'
import { hostname } from 'node:os'
import { judgeTaskForm, taskFormAcceptable } from './lib/schtasks-form.mjs'
// 死值分流必须与 `git-refs-heal.mjs` **共用同一份实现**。本文件原先有一份同名同实现的私有
// `writeLooseRef`,而 `healRefs()` 直接遍历 broken 无校验地写 —— 于是"修好的那一份"只在人工
// 按文档敲 `node scripts/git-refs-heal.mjs` 时生效,**每 2 分钟真跑的这一个恰恰是无校验的那份**。
// 写出指向不存在对象的 ref 会让每一次 `git fetch` 直接 fatal(§5b:当日 fsck 坏链 83,108 条
// 即这一型),等于把一次 ref 抖动升级成整条推送链死亡。
import { splitDeadRefs, objectExists } from './git-refs-heal.mjs'
import {
  HOME_HEAL_FIXER_TIMEOUT_MS,
  HOME_HEAL_TTL_MS,
  healLockDecision,
  healLockText,
} from './lib/home-heal-lock.mjs'
import {
  resolveGitBin,
  gitVersion,
  resolveWorktree,
  resolveGitdir,
  needsGitdirPointer,
  resolveBackupDir,
  gitdirArchivePath,
  refExpectationSatisfied,
} from './lib/gitdir.mjs'

// 工作树 / 真实 gitdir / 备份目录动态解析(不再硬编码 D: 盘;见 scripts/lib/gitdir.mjs 2026-09-15)
const WORKTREE = resolveWorktree()
const GITDIR = resolveGitdir(WORKTREE)
const BACKUP = resolveBackupDir(WORKTREE)
const GITEE_URL = 'https://gitee.com/JLSLSSZWHYXGS_0/IHUI-AI.git'
/** origin = GitHub SSH(仓库唯一权威源;严禁改回 https,见 AGENTS.md §5b 铁律) */
const GITHUB_SSH_URL = 'ssh://git@ssh.github.com:443/IHUI-INF-AI/IHUI-AI.git'
/** 国内镜像仓(由 mirror-to-cn.yml 覆盖,本机不直推) */
const GITCODE_URL = 'https://gitcode.com/IHUI-AI/IHUI-AI.git'
/** GitHub 部署私钥;服务账户/交互账户都要用它,故写入仓库级 core.sshCommand */
const SSH_COMMAND =
  'ssh -i C:/Users/Administrator/.ssh/id_ed25519_deploy -o IdentitiesOnly=yes -o StrictHostKeyChecking=accept-new -o ConnectTimeout=20'
const TASK_NAME = 'IHUI-AI git-guardian'
const LOG = join(WORKTREE, '.workbuddy', 'git-guardian.log')
const POINTER = join(WORKTREE, '.git')
const EXPECTED_POINTER = `gitdir: ${GITDIR}\n`
// 嵌套 ref( depth>=2 )的期望值清单 —— gitdir 顶层文件,宿主清理不到(2026-09-12 立)
const REFS_MANIFEST = join(GITDIR, 'refs-manifest.json')

// —— 判红 → 邮件到人层(2026-09-24 立,§5e 唯一通道)——
// 此前守护判红只写 .workbuddy/git-guardian.log:实测"合并吞并对账"抓到 38 个路径被合并抹掉
// 那类事,只有去翻日志的人才知道,而它的后果是**已入库功能被静默回滚**。到人一律经品牌派发器
// (apps/api/scripts/notify-deploy-failure.ts),不在本文件自拼 SMTP/Resend(守门 81 硬拦);
// 形态照抄 scripts/check-credential-health.mjs(同为 scripts/ 下 .mjs 的现役生产者)。
const NOTIFY_STATE = join(WORKTREE, '.workbuddy', 'git-guardian-notify-state.json')
/** 投递失败标记:邮件寄不出去必须留可诊断痕迹(§5e),下一次成功投递自动清除 */
const NOTIFY_UNDEL = join(WORKTREE, '.workbuddy', 'git-guardian-notify-UNDELIVERED.json')
/** 去重窗:同 (alert 名 + 内容指纹) 在窗口内只寄一封。**没有**任何"每日 N 封"总量闸 —— 那是把"告警静默"再复制一遍 */
const NOTIFY_DEFAULT_WINDOW_MS = 4 * 60 * 60 * 1000
/** 投递失败后的重试间隔(反 spam 用的退避,不是配额:窗口照常重发,与"封顶 N 封"不同) */
const NOTIFY_DEFAULT_FAIL_COOLDOWN_MS = 30 * 60 * 1000
const TSX_ENTRY = join(WORKTREE, 'apps', 'api', 'node_modules', 'tsx', 'dist', 'cli.mjs')
const BRAND_MAIL_SCRIPT = join(WORKTREE, 'apps', 'api', 'scripts', 'notify-deploy-failure.ts')
/** 正文临时文件目录(§15 临时物项目内;§26 服务身份 TEMP 指向不定,不得信任 os.tmpdir) */
const NOTIFY_MSG_DIR = join(WORKTREE, '.ihui-agent', 'tmp', 'git-guardian-notify')
/** 派发器单次调用墙上时钟上限:tsx 冷启 + SMTP 握手最坏叠加(同 check-credential-health 实测值) */
const NOTIFY_DISPATCH_TIMEOUT_MS = 90_000

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

// —— git 可执行文件解析:复用共享库(不依赖 PATH,服务账户如 LocalSystem 仍可定位 PortableGit) ——
// 解析结果缓存于共享库;本处仅镜像 GIT_BIN / GIT_VERSION 供日志与 status() 展示。
let GIT_BIN = null
let GIT_VERSION = null
function syncGitMeta() {
  GIT_BIN = resolveGitBin()
  GIT_VERSION = gitVersion()
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
      windowsHide: true,
    }).trim()
  } catch (e) {
    if (allowFail) return null
    throw e
  }
}

/**
 * `.git` 指针文件是否与期望一致。
 * 关键(2026-09-15):常规仓库的 `.git` 是**真实目录**(非指针文件),此时绝不可按
 * separate-git-dir 逻辑去校验/重建指针,否则 healPointer 会 rm -rf 整个 `.git` 目录 → 删库。
 * 判定:needsGitdirPointer()=true(`.git` 本应是指针)才校验指针内容;
 *       否则只要 `.git` 目录存在即视为 OK。
 */
function pointerOk() {
  if (!needsGitdirPointer()) {
    // 常规仓库:`.git` 即 gitdir 目录,存在即可
    return existsSync(POINTER)
  }
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

/**
 * 重建 `.git` 指针文件(原子写 + 回读校验)。
 * 安全护栏(2026-09-15):仅当 needsGitdirPointer()=true(separate-git-dir 形态)才执行。
 * 常规仓库的 `.git` 是真实目录,若误执行会删除整个 gitdir → 不可逆删库,故直接跳过。
 */
function healPointer() {
  if (!needsGitdirPointer()) {
    log('修复跳过: 当前为常规仓库(.git 即 gitdir 目录),无需也不应重建指针文件')
    return true
  }
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
  syncGitMeta()
  const bin = GIT_BIN
  if (!bin) {
    log('环境修复失败: 未找到可调用的 git 可执行文件')
    return false
  }
  log(`环境修复: 使用 git=${bin} (${gitVersion() || 'unknown'})`)
  for (const scope of ['--system', '--global']) {
    for (const p of [WORKTREE, GITDIR]) {
      try {
        const cur = execFileSync(bin, ['config', scope, '--get-all', 'safe.directory'], {
          encoding: 'utf8',
          stdio: ['pipe', 'pipe', 'pipe'],
          windowsHide: true,
        }).trim()
        const list = cur.split(/\r?\n/).filter(Boolean)
        if (list.includes(p) || list.includes('*')) continue
        execFileSync(bin, ['config', scope, '--add', 'safe.directory', p], {
          stdio: ['pipe', 'pipe', 'pipe'],
          windowsHide: true,
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

// ─────────── 嵌套 ref 存续(2026-09-12 立) ───────────
//
// 事故:`refs/remotes/origin/main` 反复变 `[gone]`、`refs/tags/backup/push4-*` 反复"仅远端",
// 使守门 #30a(commit 丢失防护,blocking)**抖动性阻塞** —— 刚 fetch 完是绿的,宿主一清理又红。
// 机理(对照实验):宿主清理层会删除 gitdir 下 **depth >= 2** 的嵌套命名空间目录
//   refs/heads/main / refs/tags/<tag>     → depth1 文件 → 存活
//   refs/remotes/origin/main / refs/tags/backup/<tag> → depth2 目录 → 被删
//   (且 `git update-ref` 对这类 ref 返回 0 却不落盘 —— 静默失败)
// 解法:把嵌套 ref 固化进 `packed-refs`(gitdir 顶层单文件 → 存活),期望值另存
// `refs-manifest.json`(同为顶层文件),任一时点缺失即可**离线**重建 + 重新 pack。
// 详见 scripts/git-refs-heal.mjs(支持 --refresh-remote 联网校准)。

/** depth>=2 的命名空间才需要固化(refs/heads/* 天然存活) */
function isNestedRef(ref) {
  return !ref.startsWith('refs/heads/') && ref.split('/').length >= 4
}

function readRefsManifest() {
  try {
    const m = JSON.parse(readFileSync(REFS_MANIFEST, 'utf8'))
    return m && typeof m === 'object' ? m : {}
  } catch {
    return {}
  }
}

/** 当前全部 ref(name → sha),含 packed 与松散 */
function currentRefs() {
  const out = git(
    [
      'for-each-ref',
      '--format=%(refname) %(objectname)',
      'refs/heads',
      'refs/tags',
      'refs/remotes',
    ],
    true,
  )
  const map = {}
  if (!out) return map
  for (const line of out.split('\n')) {
    const [ref, sha] = line.trim().split(/\s+/)
    if (ref && sha) map[ref] = sha
  }
  return map
}

/** 清单中解析不到(或值与清单不符)的 ref;移动型 remote HEAD 由 lib 统一放过(见 refExpectationSatisfied) */
function missingRefs() {
  const cur = currentRefs()
  return Object.entries(readRefsManifest())
    .filter(([ref, sha]) => !refExpectationSatisfied(ref, sha, cur[ref]))
    .map(([ref]) => ref)
}

/** 把松散 ref 固化进 packed-refs(顶层单文件, 宿主清理不到) */
function packRefs() {
  git(['pack-refs', '--all', '--prune'], true)
}

/**
 * 直写松散 ref:`git update-ref` 对嵌套命名空间静默不落盘,故用 node fs。
 * **写之前必须证明对象存在** —— 指向不存在对象的 ref 会让每一次 `git fetch` 直接 fatal,
 * 而清单值可能因宿主抹掉 `objects/xx/` 变成死值(§5b 当日实测坏链 83,108 条)。
 * 这道闸与 `healRefs()` 里的 `splitDeadRefs` 是双层防御:分流管"别反复重试",本闸管
 * "任何后来调用者都不能亲手造死指针"。
 */
function writeLooseRef(ref, sha) {
  if (!objectExists(sha)) {
    log(`  ⚠️ 拒绝写 ${ref} = ${String(sha).slice(0, 12)}:该对象不可解析(写下去就是一次 fetch 全死)`)
    return false
  }
  const p = join(GITDIR, ref)
  mkdirSync(dirname(p), { recursive: true })
  writeFileSync(p, sha + '\n', 'utf8')
  return true
}

/**
 * 从 FETCH_HEAD(gitdir 顶层文件 → 宿主清理不到)取 `origin/main` 的权威值。
 *
 * 为什么需要:git fetch 把新值写成**松散** refs/remotes/origin/main(嵌套目录),
 * 该文件实测在 1 秒内即被宿主清理;若 packed-refs 里还留着上一次的旧值,
 * git 就回落到旧值 → 明明同 sha 却显示 `## main...origin/main [ahead 1]`。
 */
function fetchHeadMain() {
  let text
  try {
    text = readFileSync(join(GITDIR, 'FETCH_HEAD'), 'utf8')
  } catch {
    return null
  }
  const lines = text.split('\n').filter((l) => /^[0-9a-f]{40}\b/.test(l.trim()))
  if (lines.length === 0) return null
  const mainLine =
    lines.find((l) => /branch\s+'?main'?\b/.test(l)) ?? (lines.length === 1 ? lines[0] : null)
  if (!mainLine) return null
  const m = mainLine.trim().match(/^([0-9a-f]{40})/)
  return m ? m[1] : null
}

/**
 * ref 自愈:①把当前可见的嵌套 ref 纳入清单(自维护,含 manifest 缺失时的 bootstrap)
 *          ②origin/main 以 FETCH_HEAD 为准(松散 ref 被 1s 内清理,packed 可能留旧值)
 *          ③清单里有、当前解析不到或值不符的 → 按清单重建并 pack
 * 返回:true = 清单内全部可解析且与清单一致
 */
function healRefs() {
  const cur = currentRefs()
  const map = readRefsManifest()
  let learned = 0
  for (const [ref, sha] of Object.entries(cur)) {
    if (!isNestedRef(ref)) continue
    if (map[ref] !== sha) {
      map[ref] = sha
      learned++
    }
  }
  // FETCH_HEAD 是 fetch 自己写的顶层文件,权威度高于残留的 packed 旧值
  const fh = fetchHeadMain()
  if (fh && map['refs/remotes/origin/main'] && map['refs/remotes/origin/main'] !== fh) {
    log(
      `修复: origin/main 以 FETCH_HEAD 为准 ${map['refs/remotes/origin/main'].slice(0, 12)} -> ${fh.slice(0, 12)}`,
    )
    map['refs/remotes/origin/main'] = fh
    learned++
  }
  if (learned) {
    try {
      writeFileSync(REFS_MANIFEST, JSON.stringify(map, null, 1) + '\n', 'utf8')
    } catch (e) {
      log(`refs 清单写入失败: ${String(e.message || e)}`)
    }
  }

  // 合并后清单里"当前不可见或值不符"的即为待修复项
  // (移动型 refs/remotes/<remote>/HEAD 不比 sha,见 lib/gitdir.mjs refExpectationSatisfied)
  const broken = Object.entries(map).filter(([ref, sha]) => {
    const resolved = git(['rev-parse', '--verify', '--quiet', ref], true)
    return !refExpectationSatisfied(ref, sha, resolved)
  })
  if (broken.length === 0) return true

  // 先分流:清单值本身可能是死值(宿主抹过 objects/),死值一律不写 ref,
  // 而是从清单剔除并指明恢复途径 —— 与 git-refs-heal.mjs 同口径、同一份纯函数。
  const { dead, rebuildable } = splitDeadRefs(broken, objectExists)
  log(
    `修复: 重建 ${rebuildable.length} 个缺失的嵌套 ref(宿主清理 depth>=2 目录所致)` +
      (dead.length ? `,另 ${dead.length} 个清单值为死值(不写 ref,已从清单剔除)` : ''),
  )
  for (const [ref, sha] of rebuildable) {
    if (writeLooseRef(ref, sha)) log(`  - ${ref} = ${sha.slice(0, 12)}`)
  }
  if (dead.length) {
    for (const [ref] of dead) delete map[ref]
    for (const [ref, sha] of dead) {
      log(
        `  ⚠️ 死值 ${ref} = ${String(sha).slice(0, 12)}:对象不可解析,需联网校准 ` +
          `(node scripts/git-refs-heal.mjs --refresh-remote)`,
      )
    }
    try {
      writeFileSync(REFS_MANIFEST, JSON.stringify(map, null, 1) + '\n', 'utf8')
    } catch (e) {
      log(`refs 清单剔除死值失败: ${String(e.message || e)}`)
    }
  }
  packRefs()
  const still = Object.entries(map)
    .filter(([ref]) => !git(['rev-parse', '--verify', '--quiet', ref], true))
    .map(([ref]) => ref)
  if (still.length) {
    log(`refs 修复未完全达标: ${still.join(', ')}`)
    return false
  }
  log(`✅ refs 自愈成功(${rebuildable.length} 个已重建并固化进 packed-refs)`)
  return true
}

function refsOk() {
  const m = readRefsManifest()
  if (Object.keys(m).length === 0) return true // 未 bootstrap 时不算异常(healRefs 会补)
  return missingRefs().length === 0
}

/**
 * 工作区已跟踪文件存续自愈(2026-09-23 立)。宿主清理层会成批删除工作区目录
 * (实测同日三轮:137 个 → 27 个 → 1 个,命中 tests/ 与 __tests__/ 整目录、
 * installer-assets 下 assets-NNN 的 bmp、4 个在役守门脚本)。`.git` 与嵌套 ref 早有分层自愈,
 * 工作区存续性此前无人管:缺失只体现为 `git status` 一片 ` D`,下一次提交就把它们从版本树删掉
 * (= 静默回滚)。判据与恢复动作在 scripts/heal-worktree-tracked.mjs:只恢复
 * "索引 blob == HEAD blob 且文件不在"的项,他人已暂存的删除一律不碰。
 * 不改 status()/退出码语义 —— 纯多一层自愈,失败也只记日志不阻断其余守护。
 * 第二层 `--align-drift`(幻影漂移对齐 + 落后索引刷新)在同一趟里跟着跑:只等
 * git-sync-converge 的成功出口才对齐,会让"无人收敛"期间索引一直停在祖先版本,
 * 下一次 `git add <file>` 就交旧基线(实测一次积到 503 文件落后 486 提交)。
 * 逃生舱 IHUI_SKIP_DRIFT_ALIGN=1 只关第二层,不影响恢复层。
 */
function healWorktreeTracked() {
  const script = join(dirname(fileURLToPath(import.meta.url)), 'heal-worktree-tracked.mjs')
  if (!existsSync(script)) return
  // 两层共用一个调用出口:恢复层 `--json`,对齐层 `--align-drift --json`。
  // 做成具名 helper 也是为了镜像测试能按**调用形态**钉装车证明(见
  // scripts/tests/git-guardian-drift-align.test.mjs)。
  const run = (args) => {
    try {
      const out = execFileSync(process.execPath, [script, ...args], {
        cwd: WORKTREE,
        encoding: 'utf8',
        windowsHide: true, // §5b:漏此参数在计划任务下必弹控制台窗
        maxBuffer: 1 << 24,
      })
        .trim()
        .split('\n')
        .pop()
      return { r: JSON.parse(out || '{}'), err: null }
    } catch (e) {
      return { r: null, err: String(e && e.message ? e.message : e).slice(0, 160) }
    }
  }
  const brief = (o) => {
    const paths = o.paths || o.touched || []
    return `${paths.slice(0, 3).join(', ')}${paths.length > 3 ? ' …' : ''}`
  }

  const { r, err } = run(['--json'])
  if (err) log('工作区存续自愈失败(不阻断其余守护): ' + err)
  else if (r.restored)
    log(`✅ 工作区存续自愈:恢复 ${r.restored} 个被外部删除的跟踪文件(${brief(r)})`)
  else if (r.held) log(`ℹ️ 工作区 ${r.held} 个跟踪文件缺失,但索引里已是删除(他人在制)⇒ 不代裁恢复`)

  // 第二层:幻影漂移对齐 + 落后索引刷新(2026-09-24 立,190730d3a67 交付,
  // 被同日 b805d31da44 整文件回写连带删掉 —— 现按原语义前向恢复)。
  // 只等 git-sync-converge 的成功出口才对齐,意味着"没人跑收敛"期间索引会一直停在
  // 祖先版本,下一次 `git add <file>` 就交旧基线(实测 503 文件落后 486 提交)。
  if (process.env.IHUI_SKIP_DRIFT_ALIGN === '1') return
  const { r: d, err: derr } = run(['--align-drift', '--json'])
  if (derr) log('幻影漂移对齐失败(不阻断其余守护): ' + derr)
  else {
    if (d.aligned)
      log(`✅ 幻影漂移对齐:${d.aligned} 个文件回到 HEAD(内容==祖先版本,零独有数据)(${brief(d)})`)
    if (d.refreshed) log(`✅ 落后索引刷新:${d.refreshed} 个路径的索引回到 HEAD(工作区未触碰)`)
  }
}

/**
 * 盘根封口自愈(2026-09-24 立)。`seal-c-root-stray.mjs` 把"第三方以 CWD=C:\ 写歪"的
 * 那几个名字换成指向外置根的 junction;但**重启会把它们清掉** —— 当天实测:开机后
 * `C:\common_attachment`、`C:\persistent_data`、`C:\tmp` 三个链接消失(只有 `tools` 活下来),
 * 而 D 侧目标内容完好。只靠每日 03:00 的 [4/4] 体检,意味着最长 23 小时空窗 ——
 * 这段时间够剪映/微信输入法自建真目录,回到"删了又长"的原点。本守护每 2 分钟一趟,
 * 挂在这里等于把空窗压到一个巡检周期。
 * 与其它自愈层同规矩:不改 status()/退出码语义,失败只记日志;--check 零副作用,
 * 仅真异常或真重封才写行(健康轮次不写日志是本守护的既有口径)。
 */
/** §26 家目录改道自愈:门 96 判红就调修复器。
 *  为什么挂在守护而不是等人跑:2026-09-24 实测 `D:\DevEnv\cache\userhome` 整棵消失,
 *  16 项登记里 9 项退回 C 盘实体目录,而门 96 是 blocking ⇒ **每一次提交都被逼成绕过钩子**,
 *  一次绕过等于约 110 道守门对该提交全部作废(§12e 同型)。每日 03:00 体检兜不住 23 小时空窗
 *  —— 与盘根封口同一个道理(见 healRootSeal 上方 §26 说明)。
 *  两条节流:① 判定用门 96(它把体积遍历封在 8000 条内,便宜),修复器只在判红时才跑;
 *  ② 被进程占用而失败的项目记 30 分钟冷却,避免每轮都重抄一遍 108MB 再去撞 EBUSY。 */
/**
 * 家目录改道自愈(§26)。**2026-09-24 重做节流**,起因是实测到的死循环:
 *   守护每 2 分钟一趟 ⇒ 每趟都调修复器 `--apply`;而修复器被给的超时是 **240 秒**,
 *   待搬的最大一项是 `.trae-cn`(实测 371MB / 13973 个文件),robocopy 在 240 秒内搬不完
 *   ⇒ 子进程被 SIGTERM 掐死。冷却文件 `.workbuddy/home-junctions-cooldown.json` 是修复器
 *   **正常结束时才写**的,被杀就等于"没失败也没成功",于是下一轮从头再搬 ——
 *   实测门 96 连续判红 11 分钟、日志里每 2 分钟一条"修复后仍判红",且当时**只有 1 项**
 *   没治好(其余 10 项 16:41 那轮已改道成功),冷却表还是空的 `{}` ⇒ 不是 EBUSY。
 *   而 C 盘上留下了一个半完成现场:`.trae-cn` 是实体目录、`.trae-cn.pre-junction-<08:41:30Z>`
 *   却是指向 `G:\DevEnv\cache\userhome\.trae-cn`(15871 文件)的 junction —— 数据没丢,
 *   但"源已改名 / 链接已建 / 结论没落"这种状态正是 §26 警告过的那一类。
 *
 * 三条改法:
 *  ① **单实例锁**:一轮没跑完前,后来的 tick 直接跳过(2 分钟节奏 × 25 分钟工作量必然重叠,
 *     而重叠就是上面那个半完成现场的制造者)。锁里带 pid + 起始时间,持锁进程已死或超 TTL 才抢。
 *  ② **超时给到能搬完**(240s → 25min),并区分"被掐死"与"修复器自己报错"。
 *  ③ **如实报因**:旧文案写"多为进程占用(EBUSY)",是猜的且方向不对(实测冷却表为空)。
 *     改为统计修复器自己打的 action 标签,并显式区分 timed-out / copy-failed / EBUSY 类。
 */
const HOME_HEAL_LOCK = join(WORKTREE, '.workbuddy', 'home-junctions.heal.lock')

function healHomeJunctions() {
  const dir = dirname(fileURLToPath(import.meta.url))
  const judge = join(dir, 'check-home-junctions.mjs')
  const fixer = join(dir, 're-home-junctions.mjs')
  if (!existsSync(judge) || !existsSync(fixer)) return
  const call = (script, args, timeout) => {
    try {
      const out = execFileSync(process.execPath, [script, ...args], {
        cwd: WORKTREE,
        encoding: 'utf8',
        windowsHide: true, // §5b:漏此参数在计划任务/守护下必弹控制台窗
        timeout,
        stdio: ['ignore', 'pipe', 'ignore'],
      })
      return { code: 0, out: String(out || ''), timedOut: false }
    } catch (e) {
      const killed = Boolean((e && e.killed) || (e && e.signal === 'SIGTERM'))
      return {
        code: typeof e.status === 'number' ? e.status : 2,
        out: String((e && e.stdout) || ''),
        timedOut: killed,
      }
    }
  }
  const first = call(judge, [], 120000)
  // 残留的 stash(改道中途被掐断留下的 `<原名>.pre-junction-<ts>`)不进门 96 的 blocking 退出码
  // —— 那是机器态,不是提交者能改的东西,拿它判红等于逼人跳门。但它必须有人收:所以守护
  // 单独问一次,体检绿而 stash 非空时照样叫修复器(修复器每轮无条件清,与"有没有项要搬"无关)。
  const stash = call(judge, ['--check-stash'], 60000)
  if (first.code === 0 && stash.code === 0) return
  if (first.code !== 0 && first.code !== 1) {
    log(`家目录改道体检异常(忽略,不阻断其余守护):exit ${first.code}`)
    return
  }
  if (first.code === 0 && stash.code === 1)
    log('ℹ️ 家目录改道体检已绿,但盘上还有改道中断留下的旧名 ⇒ 叫修复器收口')

  // ── ① 单实例锁 ──
  // 用 `wx`(排他创建)而不是"先 existsSync 再写":后者两步之间两个 tick 都能判到"无锁",
  // 于是同时开搬 —— 那正是本票要防的半完成现场。抢不到即读回判定。
  try {
    mkdirSync(dirname(HOME_HEAL_LOCK), { recursive: true })
    try {
      writeFileSync(HOME_HEAL_LOCK, healLockText(process.pid, Date.now()), {
        encoding: 'utf8',
        flag: 'wx',
      })
    } catch (e) {
      if (!e || e.code !== 'EEXIST') throw e
      const raw = readFileSync(HOME_HEAL_LOCK, 'utf8')
      const decision = healLockDecision(raw, Date.now(), HOME_HEAL_TTL_MS)
      if (decision === 'skip') {
        const [pidS, startS] = raw.split('\n')
        log(
          `ℹ️ 家目录改道已有另一轮在修(pid ${pidS},起于 ${Math.max(0, Math.round((Date.now() - Number(startS)) / 60000))} 分钟前)⇒ 本轮跳过,不并发搬同一批目录`,
        )
        return
      }
      log(
        `⚠️ 家目录改道锁判定为接管(持有者已死或超 ${Math.round(HOME_HEAL_TTL_MS / 60000)} 分钟)⇒ 本轮继续`,
      )
      writeFileSync(HOME_HEAL_LOCK, healLockText(process.pid, Date.now()), 'utf8')
    }
  } catch (e) {
    // 拿不到锁不阻断其余守护,但也不能因此并发搬 —— 直接跳过本轮
    log(`家目录改道锁不可用(跳过本轮,不阻断其余守护):${String(e && e.message).slice(0, 120)}`)
    return
  }

  try {
    const applied = call(fixer, ['--apply'], HOME_HEAL_FIXER_TIMEOUT_MS)
    if (applied.timedOut) {
      log(
        `⚠️ 家目录改道修复器跑满 ${Math.round(HOME_HEAL_FIXER_TIMEOUT_MS / 60000)} 分钟被掐断 ⇒ 现场可能停在"已复制未改名"的中间态;下一轮接管前请先看 re-home-junctions --check`,
      )
    } else if (applied.code === 2) {
      log(`⚠️ 家目录改道修复器自身异常(exit 2)⇒ 不重试,需人工看 re-home-junctions 输出`)
    }
    const count = (tag) => (applied.out.match(new RegExp('\\[' + tag + '\\]', 'g')) || []).length
    const moved = count('moved')
    if (moved) log(`✅ 家目录改道自愈:重新改道 ${moved} 项(§26)`)
    const after = call(judge, [], 120000)
    if (after.code === 0) return
    // ③ 报"实测到的原因",不再猜"多为进程占用"
    const why = [
      ['cooldown', '冷却中(上轮 EBUSY/校验失败)'],
      ['copy-failed', 'robocopy 失败(源未动)'],
      ['rename-failed', '源改名失败(通常是被占用)'],
      ['verify-failed', '逐文件校验不一致(仍在被写)'],
    ]
      .map(([tag, text]) => (count(tag) ? `${count(tag)}×${text}` : ''))
      .filter(Boolean)
      .join(' / ')
    const cool = (() => {
      try {
        return Object.keys(
          JSON.parse(
            readFileSync(join(WORKTREE, '.workbuddy', 'home-junctions-cooldown.json'), 'utf8'),
          ),
        ).length
      } catch {
        return -1
      }
    })()
    log(
      `⚠️ 家目录改道修复后仍判红(exit ${after.code})⇒ 实测原因:${why || '修复器未给出失败标签'};冷却项 ${cool < 0 ? '读不到' : cool} 个${applied.timedOut ? ';本轮被超时掐断' : ''}`,
    )
    // 门 96 是 blocking:这一红若不到人,每一次提交都在被逼成 --no-verify(§12e 同型事故)
    notifyGuardRed(
      '家目录改道修复后仍判红',
      `re-home-junctions --apply 之后 check-home-junctions 仍 exit ${after.code} ⇒ 实测原因:${why || '修复器未给出失败标签'};冷却项 ${cool < 0 ? '读不到' : cool} 个${applied.timedOut ? ';本轮被超时掐断' : ''}。手动:node scripts/re-home-junctions.mjs --check`,
    )
  } finally {
    try {
      rmSync(HOME_HEAL_LOCK, { force: true })
    } catch {}
  }
}

/** 守门 100 的"别人造好再推来"面(2026-09-24 立)。
 *  提交链上那道门按设计只判 `origin/main..HEAD`(把已入库历史纳入默认面 = 之后每次提交恒红
 *  = 逼人绕过钩子,见其头注"口径是生命线"),而 `git-sync-converge` / `plan-union-merge` /
 *  手工 commit-tree **都不跑钩子** ⇒ "判据存在但永不被调用"这一型必须由守护补一层。
 *  用增量台账(`--all-new`):每枚合并只判一次,老提交不会反复红。
 *  **只判不修**:自动重做合并的风险远大于收益;出口是 `scripts/union-converge.mjs --apply`(人来点)。 */
function auditMergeAdditionLoss() {
  const script = join(dirname(fileURLToPath(import.meta.url)), 'check-merge-addition-loss.mjs')
  if (!existsSync(script)) return
  let res
  try {
    const out = execFileSync(process.execPath, [script, '--all-new'], {
      cwd: WORKTREE,
      encoding: 'utf8',
      windowsHide: true, // §5b:漏此参数在计划任务/守护下必弹控制台窗
      timeout: 240000, // 守门 80:热路径派生一律带上限
      stdio: ['ignore', 'pipe', 'ignore'],
    })
    res = { code: 0, out: String(out || '') }
  } catch (e) {
    res = { code: typeof e.status === 'number' ? e.status : 2, out: String(e.stdout || '') }
  }
  if (res.code === 0) return
  if (res.code === 2) {
    log('⚠️ 合并吞并对账自身异常(exit 2)⇒ 不重试,需人工跑 node scripts/check-merge-addition-loss.mjs')
    notifyGuardRed(
      '合并吞并对账自身异常',
      'check-merge-addition-loss.mjs --all-new exit 2 ⇒ 对账层自己没在跑(与"判据存在但永不被调用"同型),需人工:node scripts/check-merge-addition-loss.mjs',
      { severity: 'critical' },
    )
    return
  }
  const n = (res.out.match(/丢失新增路径\s+(\d+)/) || [])[1] || '?'
  log(
    `⚠️ 合并吞并对账判红:发现合并抹掉对侧独有新增共 ${n} 个路径 —— 修法:node scripts/union-converge.mjs --apply(文件面零丢失 union,先不带 --apply 看报告)`,
  )
  notifyGuardRed(
    '合并吞并对账判红',
    `发现合并抹掉对侧独有新增共 ${n} 个路径 —— 后果是已入库功能被静默回滚,且这枚合并不产生冲突也不进 diff 报告。修法:node scripts/union-converge.mjs --apply(文件面零丢失 union,先不带 --apply 看报告)`,
    { severity: 'critical' },
  )
}

/** 本地恢复源的增量刷新层(§5b 里那条"唯一空白层")。
 *  原设计挂在计划任务 `IHUI Git Backup Refresh`(每 15 分钟),但 2026-09-24 实测
 *  `Get-ScheduledTask` 全量列表里**已经没有它**(与 §26 记的 `IHUI C-Drive AutoMaintain`
 *  凭空消失同型)—— 恢复源因此又落后了 100+ 枚提交,而这正是"宿主再删一次 .git 就等价
 *  回滚 100+ 枚"的那个风险本身。判据不能挂在一个会自己消失的东西上,故并入本守护的 tick:
 *  先 `--check`(零副作用、便宜)早退,只有判后落后才跑增量刷新。 */
function refreshRecoverySource() {
  const script = join(dirname(fileURLToPath(import.meta.url)), 'git-backup-refresh.mjs')
  if (!existsSync(script)) return
  const call = (args, timeout) => {
    try {
      const out = execFileSync(process.execPath, [script, ...args], {
        cwd: WORKTREE,
        encoding: 'utf8',
        windowsHide: true, // §5b:漏此参数在计划任务/守护下必弹控制台窗
        timeout,
        stdio: ['ignore', 'pipe', 'ignore'],
      })
      return { code: 0, out: String(out || '') }
    } catch (e) {
      return { code: typeof e.status === 'number' ? e.status : 2, out: String(e.stdout || '') }
    }
  }
  const judge = call(['--check'], 180000)
  if (judge.code === 0) return
  if (judge.code !== 1) {
    log(`恢复源体检异常(忽略,不阻断其余守护):exit ${judge.code}`)
    return
  }
  const applied = call([], 15 * 60 * 1000) // 增量 fetch 大 gitdir 可到分钟级
  if (applied.code === 0) {
    const to = (applied.out.match(/→\s*([0-9a-f]{7,})/) || [])[1]
    log(`✅ 本地恢复源已增量追平(§5b 空白层)${to ? ` → ${to}` : ''}`)
    return
  }
  log(`⚠️ 本地恢复源刷新失败(exit ${applied.code})⇒ 下次 tick 自动重试;手动:node scripts/git-backup-refresh.mjs`)
  // 恢复源不追平 = 宿主再删一次 .git 时只能恢复到旧提交(§5b 记的"回滚 97 个提交"同型),
  // 属"只有守护看得见"的红 —— 判红必须到人,邮件是旁路,失败不影响下轮重试本身。
  notifyGuardRed(
    '本地恢复源刷新失败',
    `git-backup-refresh.mjs 刷新 exit ${applied.code} ⇒ 本地恢复源正在落后于 main,宿主清除 .git 后从它恢复等价回滚。手动:node scripts/git-backup-refresh.mjs`,
    { severity: 'critical' },
  )
}

// ══ 判红 → 邮件到人层(2026-09-24 立,§5e 唯一通道)═══════════════════════════════
// 此前守护判红只写 .workbuddy/git-guardian.log:实测"合并吞并对账"抓到 38 个路径被合并抹掉
// 那类事,只有去翻日志的人才知道,而它的后果是**已入库功能被静默回滚**。发信不在此文件自拼
// SMTP/Resend(守门 81 硬拦),唯一出口 = 派生 apps/api/scripts/notify-deploy-failure.ts;
// 形态照抄 scripts/check-credential-health.mjs(同为 scripts/ 下 .mjs 的现役生产者)。
// 纯判据(指纹/去重/状态读写/argv)export 给镜像测试离线取证(§22c/§22d)。

/**
 * 内容指纹:数字与哈希归一后再散列。不归一的话"丢失 38 个路径"里一个计数浮动、
 * 或"→ 9f2ab1c"里 sha 换一个前缀,每 2 分钟都会产新指纹 ⇒ 每趟重发(轰炸)。
 * 归一后表达的是"同一故障仍在发生";实时数字保留在邮件正文里,不丢诊断价值。
 */
export function alertFingerprint(name, detail) {
  const norm = String(detail ?? '')
    .replace(/\b[0-9a-f]{7,40}\b/gi, '<sha>')
    .replace(/\d+/g, '#')
    .replace(/\s+/g, ' ')
    .trim()
  return createHash('sha1').update(`${name}\u0000${norm}`, 'utf8').digest('hex')
}

/**
 * 状态表解析:坏 JSON / 数组 / 缺字段条目一律归一为空表或剔除。
 * 取向:"多寄一封"的代价远小于"通知层自己抛异常把守护流程带崩"(守护崩了才是事故)。
 */
export function parseNotifyState(text) {
  if (!text) return {}
  try {
    const obj = JSON.parse(String(text))
    if (!obj || typeof obj !== 'object' || Array.isArray(obj)) return {}
    const out = {}
    for (const [k, v] of Object.entries(obj)) {
      if (v && typeof v === 'object' && typeof v.fp === 'string' && Number.isFinite(v.ts)) {
        out[k] = { fp: v.fp, ts: v.ts, delivered: Boolean(v.delivered) }
      }
    }
    return out
  } catch {
    return {}
  }
}

/**
 * 当轮是否应当发信(纯函数,去重的全部判据):
 *  · 无记录 / 指纹变了(新故障或旧故障演化)⇒ 立刻发,不等窗口;
 *  · 同指纹且上次**已送达** ⇒ 窗口(默认 4h)内压住,过期重发 —— 去重只能去"重复",
 *    不能去"还在发生",所以这里没有时间窗就永远沉默的路径;
 *  · 同指纹且上次**没送达**(含无收件人降级)⇒ 按失败退避(默认 30min)重试。
 *    这是反 spam 退避,不是"每日 N 封"配额闸:窗口与退避只推迟下一封,永不封死。
 */
export function shouldAlert(state, key, fp, now, { windowMs, failCooldownMs } = {}) {
  const e = state && state[key]
  if (!e) return true
  if (e.fp !== fp) return true
  const w = Number.isFinite(windowMs) ? windowMs : NOTIFY_DEFAULT_WINDOW_MS
  const fc = Number.isFinite(failCooldownMs) ? failCooldownMs : NOTIFY_DEFAULT_FAIL_COOLDOWN_MS
  return e.delivered ? now - e.ts > w : now - e.ts > fc
}

/** 写回一条发信标记(送达与否由调用方按派发结论给);返回新对象,不改入参 */
export function withAlertMark(state, key, fp, now, delivered) {
  return { ...state, [key]: { fp, ts: now, delivered: Boolean(delivered) } }
}

/** 收件人脱敏展示:日志/状态里只留 local-part 首字符 + 域名(地址不是密钥,但也不扩散) */
export function maskEmail(addr) {
  const [local = '', domain = ''] = String(addr ?? '').split('@')
  return domain ? `${local.slice(0, 1)}***@${domain}` : '***'
}

function notifyWindowMs() {
  const n = Number(process.env.GIT_GUARDIAN_NOTIFY_WINDOW_MS)
  return Number.isFinite(n) && n >= 0 ? n : NOTIFY_DEFAULT_WINDOW_MS
}

function notifyFailCooldownMs() {
  const n = Number(process.env.GIT_GUARDIAN_NOTIFY_FAIL_COOLDOWN_MS)
  return Number.isFinite(n) && n >= 0 ? n : NOTIFY_DEFAULT_FAIL_COOLDOWN_MS
}

/**
 * 收件人 = apps/api/.env 的 ALERT_EMAIL_TO(§5e:缺该键 ⇒ 告警链整条排除)。
 * process.env 优先,便于当场取证;本函数只读,绝不写回任何 env 域。
 */
function resolveAlertTo() {
  const fromEnv = String(process.env.ALERT_EMAIL_TO || '').trim()
  if (fromEnv) return fromEnv
  try {
    for (const line of readFileSync(join(WORKTREE, 'apps', 'api', '.env'), 'utf8').split(/\r?\n/)) {
      const m = /^\s*ALERT_EMAIL_TO\s*=\s*(.+?)\s*$/.exec(line)
      if (m) return m[1].replace(/^["']|["']$/g, '')
    }
  } catch {
    /* .env 读不到 = 无收件人,由调用方如实降级并写明原因 */
  }
  return ''
}

/**
 * 拼派发器 argv(纯函数,镜像测试钉契约)。
 * ⚠️ 绝不传 `--env-file`:tsx v4 会把它劫持转发给 node 自身,路径不存在时 node 直接 exit 9
 * (§5e 实测坑;check-credential-health 同款约束)。多行中文正文一律 --message-file。
 */
export function buildGuardMailArgv({ to, title, severity, messageFile, dryRun = false }) {
  return [
    TSX_ENTRY,
    BRAND_MAIL_SCRIPT,
    '--to',
    to,
    '--title',
    title,
    '--severity',
    severity,
    '--source',
    'git-guardian',
    '--message-file',
    messageFile,
    ...(dryRun ? ['--dry-run'] : []),
    '--strict', // 成功 exit 0 / 失败 exit 1,本层据此写/清 UNDELIVERED 标记
  ]
}

/** 子进程输出转诊断文本:逐行脱敏 + 截断(派发器崩溃可能把 .env 片段倒进 stderr,不落地) */
const SECRETISH_RE = /(api[_-]?key|token|secret|passw|authorization|bearer)/i
export function redactChildOutput(raw, limit = 300) {
  const kept = String(raw ?? '')
    .split(/\r?\n/)
    .map((l) => {
      const line = l.trimEnd()
      if (!SECRETISH_RE.test(line)) return line
      const sep = /[=:]/.exec(line)
      return sep && sep.index < 40 ? `${line.slice(0, sep.index + 1)}***` : '[已脱敏]'
    })
    .filter((l) => l !== '')
    .join(' / ')
  if (!kept) return '(无输出)'
  return kept.length > limit ? `${kept.slice(0, limit)}…(截断)` : kept
}

/** dry-run 通道判定:派发器自报"至少一条通道齐备"才算可用(与 check-credential-health 同判据) */
export function judgeDryRunChannel(stdout) {
  return /通道判定 (?:SMTP|Resend): 可用/.test(String(stdout ?? ''))
}

/** 品牌派发器的一次调用:异常/超时一律归为失败,绝不抛出(通知层不能把守护带崩) */
function dispatchGuardMail({ title, desp, severity, dryRun = false }) {
  if (!existsSync(TSX_ENTRY) || !existsSync(BRAND_MAIL_SCRIPT)) {
    return {
      ok: false,
      why: `品牌派发器缺失(tsx=${existsSync(TSX_ENTRY)} 脚本=${existsSync(BRAND_MAIL_SCRIPT)})`,
    }
  }
  const to = resolveAlertTo()
  if (!to) return { ok: false, why: '无收件人(apps/api/.env 缺 ALERT_EMAIL_TO)' }
  let msgFile = null
  try {
    mkdirSync(NOTIFY_MSG_DIR, { recursive: true })
    // 无 BOM UTF-8 文件:命令行参数要过一层控制台代码页(GBK),多行中文必被截坏(§5e)
    msgFile = join(NOTIFY_MSG_DIR, `${Date.now()}-${process.pid}.txt`)
    writeFileSync(msgFile, desp, 'utf8')
    const r = spawnSync(process.execPath, buildGuardMailArgv({ to, title, severity, messageFile: msgFile, dryRun }), {
      encoding: 'utf8',
      windowsHide: true, // §5b:漏此参数在计划任务/守护下必弹控制台窗
      timeout: NOTIFY_DISPATCH_TIMEOUT_MS,
    })
    if (r.error) return { ok: false, why: `派发器进程异常(${r.error.code || r.error.name}): ${redactChildOutput(r.error.message)}` }
    if (dryRun) return { ok: judgeDryRunChannel(r.stdout), why: `通道判定: ${redactChildOutput(r.stdout)}` }
    if (r.status === 0) return { ok: true, why: '已送达' }
    return { ok: false, why: `exit=${r.status} ${redactChildOutput(r.stderr || r.stdout)}` }
  } catch (e) {
    return { ok: false, why: `派发器调用异常: ${redactChildOutput((e && e.message) || e)}` }
  } finally {
    // §26:临时物用完必须删 —— 守护身份下落错的临时文件没人回收
    if (msgFile) rmSync(msgFile, { force: true })
  }
}

function readNotifyText(file) {
  try {
    return readFileSync(file, 'utf8')
  } catch {
    return ''
  }
}

function writeNotifyJson(file, obj) {
  mkdirSync(dirname(file), { recursive: true })
  writeFileSync(file, JSON.stringify(obj, null, 1), 'utf8')
}

/**
 * 守护判红时的唯一出口。**旁路通知,不改自愈行为本身**:整个函数体裹 try,
 * 落盘/派发/状态任一环节炸掉都只降级为日志一行,原调用方(三个自愈层)照常走完。
 * 所有依赖(时间/派发/路径/日志)可注入,离线取证见镜像测试。
 * @returns {{sent:boolean, suppressed?:boolean, why:string}}
 */
export function notifyGuardRed(name, detail, opts = {}) {
  const {
    severity = 'warning',
    now = Date.now(),
    dispatch = dispatchGuardMail,
    stateFile = NOTIFY_STATE,
    undelFile = NOTIFY_UNDEL,
    windowMs = notifyWindowMs(),
    failCooldownMs = notifyFailCooldownMs(),
    force = false,
    logger = log,
  } = opts
  try {
    if (!force) {
      // --check 是 CI 口径(零副作用),通知归真巡检轮;显式开关只关"要不要发",不关"发几封"
      if (process.env.GIT_GUARDIAN_NOTIFY_DISABLED === '1') return { sent: false, why: 'GIT_GUARDIAN_NOTIFY_DISABLED=1,已关闭' }
      if (CHECK_ONLY) return { sent: false, why: '--check 模式零副作用,不发' }
    }
    const fp = alertFingerprint(name, detail)
    const state = parseNotifyState(readNotifyText(stateFile))
    if (!force && !shouldAlert(state, name, fp, now, { windowMs, failCooldownMs })) {
      return { sent: false, suppressed: true, why: '同一原因窗口内已通报,本轮压住' }
    }
    const title = `【git-guardian】${name}`
    const desp =
      `${detail}\n\n` +
      `来源:git-guardian 周期守护(计划任务 "${TASK_NAME}",每 2 分钟一趟)@ ${hostname()}。\n` +
      `去重:同指纹 ${Math.round(windowMs / 60000)} 分钟窗口内只寄一封(按身份去重、无总量封顶);` +
      `内容变化视为新故障立即重报。投递失败按 ${Math.round(failCooldownMs / 60000)} 分钟退避重试并留 UNDELIVERED 标记。\n` +
      `本层只是旁路通知,不改变守护的自愈行为;紧急静音:GIT_GUARDIAN_NOTIFY_DISABLED=1。`
    const callDispatch = () => {
      // 派发器抛异常 = 投递失败(写 UNDELIVERED、按退避重试),不是"通知层炸了就走人" ——
      // 失败必须响(§5e);真正的兜底是外层 catch,它接的是落盘/状态这类结构性异常。
      try {
        return dispatch({ title, desp, severity, dryRun: false })
      } catch (e) {
        return {
          ok: false,
          why: `派发器调用异常(通知层接住): ${String((e && e.message) || e).slice(0, 160)}`,
        }
      }
    }
    if (force) {
      // 人工核验入口(--notify-test):不读写去重状态(一次手工测试不该污染或抢占窗口)
      const r = callDispatch()
      if (r.ok) logger(`✅ 通知自测已送达: ${name} → ${maskEmail(resolveAlertTo())}`)
      else {
        writeNotifyJson(undelFile, { ts: now, name, fp, why: r.why })
        logger(`⚠️ 通知自测失败: ${name} — ${r.why}`)
      }
      return { sent: Boolean(r.ok), why: r.why }
    }
    const r = callDispatch()
    if (r.ok) {
      writeNotifyJson(stateFile, withAlertMark(state, name, fp, now, true))
      rmSync(undelFile, { force: true }) // 下一次成功投递自动清除失败标记(§5e)
      logger(`✅ 判红通报已寄出: ${name} → ${maskEmail(resolveAlertTo())}`)
    } else {
      // 失败不记"已送达"⇒ 下轮(退避后)还会重试;标记落盘让人在 --status/日志里看得见
      writeNotifyJson(stateFile, withAlertMark(state, name, fp, now, false))
      writeNotifyJson(undelFile, { ts: now, name, fp, why: r.why })
      logger(`⚠️ 判红通报投递失败: ${name} — ${r.why}(已写 UNDELIVERED 标记,${Math.round(failCooldownMs / 60000)} 分钟后重试)`)
    }
    return { sent: Boolean(r.ok), why: r.why }
  } catch (e) {
    // 兜底:通知层自身任何异常都吞掉 —— 守护崩了比不发邮件严重得多(原自愈与退出码不受影响)
    try {
      logger(`⚠️ 通知层自身异常(已忽略,不影响自愈): ${String((e && e.message) || e).slice(0, 160)}`)
    } catch {}
    return { sent: false, why: '通知层自身异常(已忽略)' }
  }
}

/** 通知层健康摘要(供 --status 如实显示:已配置/无收件人/上次投递失败) */
function notifySummary() {
  try {
    const to = resolveAlertTo()
    const undel = readNotifyText(NOTIFY_UNDEL)
    let undelivered = null
    if (undel) {
      try {
        undelivered = JSON.parse(undel)
      } catch {
        undelivered = { raw: undel.slice(0, 200) }
      }
    }
    const state = parseNotifyState(readNotifyText(NOTIFY_STATE))
    return {
      configured: Boolean(to) && existsSync(TSX_ENTRY) && existsSync(BRAND_MAIL_SCRIPT),
      to: to ? maskEmail(to.split(',')[0].trim()) : '(无收件人:apps/api/.env 缺 ALERT_EMAIL_TO)',
      disabled: process.env.GIT_GUARDIAN_NOTIFY_DISABLED === '1',
      windowMs: notifyWindowMs(),
      alerts: Object.entries(state).map(([k, v]) => ({
        name: k,
        delivered: v.delivered,
        ts: new Date(v.ts).toISOString(),
      })),
      undelivered,
    }
  } catch (e) {
    return { configured: false, error: `通知层状态无法判定(${String((e && e.message) || e).slice(0, 120)})` }
  }
}

function healRootSeal() {
  const script = join(dirname(fileURLToPath(import.meta.url)), 'seal-c-root-stray.mjs')
  if (!existsSync(script)) return
  const call = (args) => {
    try {
      const out = execFileSync(process.execPath, [script, ...args], {
        cwd: WORKTREE,
        encoding: 'utf8',
        windowsHide: true, // §5b:漏此参数在计划任务/守护下必弹控制台窗
        timeout: 120000, // 守门 80:热路径派生一律带上限,挂死不拖垮整轮巡检
        stdio: ['ignore', 'pipe', 'ignore'],
      })
      return { code: 0, out: String(out || '') }
    } catch (e) {
      return { code: typeof e.status === 'number' ? e.status : 2, out: String(e.stdout || '') }
    }
  }
  const first = call(['--check'])
  if (first.code === 0) return
  if (first.code !== 1) {
    log(`盘根封口体检异常(忽略,不阻断其余守护):exit ${first.code}`)
    return
  }
  const applied = call(['--apply'])
  const resealed = (applied.out.match(/\[(?:MISSING|REAL-DIR)→sealed\]/g) || []).length
  if (resealed) log(`✅ 盘根封口自愈:重封 ${resealed} 个被外部删除/回退的改道点`)
  const after = call(['--check'])
  if (after.code !== 0)
    log(`⚠️ 盘根封口重封后体检仍非 0(exit ${after.code})⇒ 需人工看 seal-c-root-stray 输出`)
}

/**
 * 看门人的看守(2026-09-23 立)。凭据/部署停摆巡检靠 schtasks 每 6 小时自跑,而它的故障
 * 形态是**安静**:任务被删/被停、node 路径失效、计划任务账户看不到代理 —— 任何一种都会让
 * "本该报警的那条链"静默消失,与今天"生产冻结两天无人知"同构。本守护每 2 分钟一趟且自身
 * 分层自愈,由它盯心跳是成本最低的闭环。
 * 心跳 = 巡检 --json 模式写的 .workbuddy/credential-health-last.json(内含 ts)。
 * 超时(18h = 标称周期 3 倍,避开机器休眠/夜间空档误报)时:① 重跑 --install 找回任务
 * (脚本自带"注册前用 cscript 实跑一次 vbs 预检"的护栏),② 就地拉起一轮(它会自己走
 * 邮件单通道告警)。kick 标记落盘做 6h 冷却,避免每 2 分钟重复拉起。
 */
const WATCHDOG_HEARTBEAT = join(WORKTREE, '.workbuddy', 'credential-health-last.json')
const WATCHDOG_KICK = join(WORKTREE, '.workbuddy', 'credential-health-kick.ts')
const WATCHDOG_STALL_MS = 18 * 3600 * 1000
const WATCHDOG_KICK_COOLDOWN_MS = 6 * 3600 * 1000

function watchWatchdog() {
  const script = join(dirname(fileURLToPath(import.meta.url)), 'check-credential-health.mjs')
  if (!existsSync(script)) return
  try {
    let ageMs = Infinity
    if (existsSync(WATCHDOG_HEARTBEAT)) {
      try {
        const ts = JSON.parse(readFileSync(WATCHDOG_HEARTBEAT, 'utf8')).ts
        const t = Date.parse(ts)
        if (Number.isFinite(t)) ageMs = Date.now() - t
      } catch {
        /* 心跳内容不可解析 ⇒ 等同丢失,走自愈 */
      }
    }
    if (ageMs < WATCHDOG_STALL_MS) return
    if (existsSync(WATCHDOG_KICK)) {
      const k = Date.parse(String(readFileSync(WATCHDOG_KICK, 'utf8')).trim())
      if (Number.isFinite(k) && Date.now() - k < WATCHDOG_KICK_COOLDOWN_MS) return
    }
    mkdirSync(join(WORKTREE, '.workbuddy'), { recursive: true })
    writeFileSync(WATCHDOG_KICK, new Date().toISOString(), 'utf8')
    log(
      `⚠️ 凭据/停摆巡检心跳已 ${(ageMs / 3600000).toFixed(1)} 小时未更新(任务被删/停用或 node 路径失效都会是这个形态)⇒ 重注册任务 + 就地拉起一轮`,
    )
    execFileSync(process.execPath, [script, '--install'], {
      cwd: WORKTREE,
      encoding: 'utf8',
      windowsHide: true,
      timeout: 120000,
    })
    execFileSync(process.execPath, [script, '--json'], {
      cwd: WORKTREE,
      encoding: 'utf8',
      windowsHide: true,
      timeout: 300000,
      maxBuffer: 1 << 22,
    })
  } catch (e) {
    log('巡检自愈失败(不阻断其余守护): ' + String((e && e.message) || e).slice(0, 160))
  }
}

/**
 * 把本守护的计划任务确保为 S4U(幂等;已是 S4U 时脚本自己秒退)。
 * 为什么必须做:两个看门任务原先是 InteractiveToken ⇒ **无人登录时它们根本不跑**,
 * 于是 .git 存续守护与凭据告警会在"机器重启后没人登录"这段时间里同时静默 ——
 * 正是今天两天冻结的同族形态。切 S4U 的两条常规路在本机都走不通
 * (`schtasks /RU <u> /NP` 会交互索要密码;pwsh 无 ScheduledTasks cmdlet),
 * 唯一可行形态是 Schedule.Service COM + `NewTask(0)` 可写 XmlText + SID/Null/2,
 * 已由 `scripts/task-set-s4u.vbs` 封装并在真任务上验证(切后 Last Result=0、探针显示
 * HKCU 的用户级环境变量与同步盘凭据文件在 S4U 下依然可读)。
 */
function ensureS4u() {
  const vbs = join(dirname(fileURLToPath(import.meta.url)), 'task-set-s4u.vbs')
  if (!existsSync(vbs)) return
  try {
    const out = execFileSync('cscript.exe', ['//nologo', vbs, TASK_NAME], {
      encoding: 'utf8',
      windowsHide: true,
      timeout: 90000,
    })
    if (/switched to S4U/.test(out))
      log('✅ 计划任务已升级为 S4U(无人登录时也照常巡检;已验证弹窗结构上不可能)')
    else if (/register failed|VERIFY FAILED|refusing/i.test(out))
      log('S4U 升级未完成(不阻断守护): ' + out.replace(/\r?\n/g, ' | ').slice(0, 160))
  } catch (e) {
    log('S4U 升级调用失败(不阻断守护): ' + String((e && e.message) || e).slice(0, 160))
  }
}

/** 破坏性覆盖前先归档现场(保留可回溯副本;同一轮只归档一次) */
let ARCHIVED_PATH = null

function archiveGitdir(tag) {
  if (ARCHIVED_PATH) return ARCHIVED_PATH
  // 归档统一落 §15b 唯一备份目录(见 scripts/lib/gitdir.mjs);取不到才退回旧的兄弟命名
  const dst = gitdirArchivePath(`${basename(GITDIR)}.broken-${tag}`) || `${GITDIR}.broken-${tag}`
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
  // git 可用 ≠ 健康:宿主会单独清理 depth>=2 的嵌套 ref 目录(见上文事故注释)
  if (!refsOk()) healRefs()
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
  // —— 还原完整远端与仓库配置(2026-09-12 15:30 补齐)——
  // 旧版只设 origin=https,会丢掉 gitee/gitcode 镜像远端与部署私钥 sshCommand,
  // 导致「自愈成功后 origin 变成 https」违反 AGENTS.md §5b「严禁改回 https」。
  restoreRemoteConfig()
  git(['config', 'core.hooksPath', '.husky'], true)
  git(['config', 'gc.auto', '0'], true)
  git(['config', 'gc.autodetach', 'false'], true)
  git(['config', 'maintenance.auto', 'false'], true)
  return gitUsable()
}

/**
 * 把 origin(github SSH)/gitee/gitcode 三个远端 + 部署私钥 sshCommand 写回仓库配置。
 * 幂等:已存在则 set-url,不存在才 add。用于远端重建后的配置收口。
 */
function restoreRemoteConfig() {
  git(['remote', 'set-url', 'origin', GITHUB_SSH_URL], true)
  if (!git(['remote', 'get-url', 'origin'], true))
    git(['remote', 'add', 'origin', GITHUB_SSH_URL], true)
  for (const [name, url] of [
    ['gitee', GITEE_URL],
    ['gitcode', GITCODE_URL],
  ]) {
    if (git(['remote', 'get-url', name], true)) git(['remote', 'set-url', name, url], true)
    else git(['remote', 'add', name, url], true)
  }
  git(['config', 'core.sshCommand', SSH_COMMAND], true)
}

function status() {
  syncGitMeta()
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
    refsOk: refsOk(),
    refsMissing: missingRefs(),
    // 通知层状态如实进 --status:"已配置/无收件人/上次投递失败"必须能被人工核验,
    // 否则"接线了"只是纸面结论(只读三个小文件,零副作用,--check 口径不变)
    notify: notifySummary(),
  }
  return health
}

/** 异常行描述(含 HEAD / refs 提示),main 与 daemon 共用 */
function anomalyLine(h) {
  const hint =
    h.pointerOk && h.gitdirOk && !h.gitUsable
      ? ` | HEAD=${JSON.stringify(headContent().slice(0, 60))}`
      : ''
  const refsHint = h.refsOk === false ? ` | 缺失嵌套 ref ${(h.refsMissing || []).length} 个` : ''
  return `⚠️ 检测到 .git 异常: pointer=${h.pointerOk} gitdir=${h.gitdirOk} git=${h.gitUsable}${hint}${refsHint}`
}

// —— 计划任务必须跑在非交互会话(2026-09-22 立「任务漂移自检」,2026-09-23 换 S4U 根治) ——
// 本守护自己就是「弹窗」的高频嫌疑:它以独立进程跑,而计划任务若注册成 InteractiveToken +
// 直跑控制台程序(node.exe)时 Windows 会显示控制台 → 用户桌面每 2 分钟闪一扇黑窗
// (2026-09-20 实测踩坑;2026-09-22 复发:安装器早已修对,但活任务仍是直跑 node.exe 的旧版,
// 没人重注册)。因此除 --install 外,常规巡检也核对活任务的 LogonType,漂移即自动重注册,不靠人记。
// 2026-09-23 起形态改为 S4U(见 registerTask):任务跑在 session 0,没有桌面,弹窗这件事
// 从"每个派生点都要记得隐藏"变成"结构上不可能"。

function registerTask() {
  // 2026-09-23:改注 S4U 非交互任务(session 0,无桌面)取代 InteractiveToken + wscript/VBS。
  // 旧链路靠 SW_HIDE,一旦 Windows Terminal 委托回来(AGENTS.md §5b 记的 09-18 事故)或那个
  // ASCII-only 的 .vbs 被删/被写入非 ASCII 文本(会弹 WSH 错误框),这层保护就连同我们最关键的
  // .git 存续守护一起失效。S4U 是结构性的:无论任务里跑什么程序都开不出窗口。
  const ps = [
    `$action = New-ScheduledTaskAction -Execute '${process.execPath.replace(/'/g, "''")}' -Argument '"${join(WORKTREE, 'scripts', 'git-guardian.mjs').replace(/'/g, "''")}"'`,
    `$trigger = New-ScheduledTaskTrigger -Once -At (Get-Date).Date -RepetitionInterval (New-TimeSpan -Minutes 2) -RepetitionDuration (New-TimeSpan -Days 3650)`,
    `$settings = New-ScheduledTaskSettingsSet -AllowStartIfOnBatteries -DontStopIfGoingOnBatteries -StartWhenAvailable -MultipleInstances IgnoreNew -ExecutionTimeLimit (New-TimeSpan -Minutes 5)`,
    `$principal = New-ScheduledTaskPrincipal -UserId $env:USERNAME -LogonType S4U -RunLevel Limited`,
    `Register-ScheduledTask -TaskName '${TASK_NAME}' -Action $action -Trigger $trigger -Settings $settings -Principal $principal -Force | Out-Null`,
    `$p = (Get-ScheduledTask -TaskName '${TASK_NAME}').Principal`,
    `Write-Output ('LOGON=' + $p.LogonType)`,
  ].join('\n')
  let out = ''
  try {
    out = execFileSync('pwsh.exe', ['-NoProfile', '-NonInteractive', '-Command', ps], {
      encoding: 'utf8',
      windowsHide: true,
      timeout: 90_000,
    })
  } catch (e) {
    log(`注册任务计划失败(需管理员权限?): ${String(e.message || e).slice(0, 300)}`)
    return false
  }
  if (!/LOGON=S4U/.test(out)) {
    log(`注册后回读 LogonType 非 S4U,拒绝当成成功:${out.trim().split('\n').slice(-3).join(' | ')}`)
    return false
  }
  log(`已注册任务计划 "${TASK_NAME}"(每 2 分钟自检,LogonType=S4U → session 0,结构上无弹窗)`)
  return true
}

/**
 * 活任务形态判定 —— 2026-09-23 重写,因为旧实现在本机**每 2 分钟空转重注册一次**。
 *
 * 旧写法用 pwsh 的 Get-ScheduledTask 读 Principal.LogonType。本机 pwsh **没有 ScheduledTasks
 * cmdlet**(实测 `The term 'Get-ScheduledTask' is not recognized`),而那条命令的
 * CommandNotFoundException 并不会让进程非零退出 ⇒ execFileSync 不抛、stdout 只有 `MISSING`
 * ⇒ 判"漂移" → 重注册;而 registerTask() 的 S4U 路径同样依赖那批 cmdlet,**在这台机上永远
 * 不成功**(回读永远 `LOGON=` 空),只有 .vbs 回退真能注册成功 → 于是"注册成功"和"判它漂移"
 * 每 2 分钟互相打脸一次,并把最关键的那层 .git 存续守护反复删除重建。
 *
 * 新实现不碰 cmdlet:存在性用 `schtasks /Query /FO CSV`(任务名是 ASCII,不受 GBK 控制台影响),
 * 形态用 `/XML`(去 NUL 后按 ASCII 关键字判)。并明确承认**两种合法形态**:
 *   · S4U(session 0,结构上开不出窗口)—— 首选;
 *   · InteractiveToken + wscript + 我们的 ASCII .vbs —— 回退形态,同样无弹窗,不是漂移。
 * 只有"InteractiveToken 且直跑 node.exe"(必闪黑窗)或任务消失才叫漂移。拿不到数据一律 unknown,
 * 绝不在信息不足时改动任务(§5b 的"宁可不动也不误动")。
 * @returns {'ok'|'ok-vbs'|'missing'|'drift'|'unknown'}
 */
function taskForm() {
  const flat = (buf) => String(buf || '').replace(/\0/g, '')
  let list = ''
  try {
    list = flat(
      execFileSync('schtasks.exe', ['/Query', '/FO', 'CSV', '/NH'], {
        windowsHide: true,
        timeout: 30_000,
        maxBuffer: 1 << 24,
      }),
    )
  } catch {
    return 'unknown' // schtasks 本身不可用 ⇒ 不下判断
  }
  if (!list.includes(TASK_NAME)) return 'missing'
  let xml = ''
  try {
    xml = flat(
      execFileSync('schtasks.exe', ['/Query', '/TN', TASK_NAME, '/XML'], {
        windowsHide: true,
        timeout: 30_000,
        encoding: 'buffer',
      }),
    )
  } catch {
    return 'unknown'
  }
  if (!xml.includes('<Task')) return 'unknown'
  return judgeTaskForm(xml)
}

/** 活任务形态是否可接受(供巡检调用;unknown 一律视为可接受,不在信息不足时改动任务) */
function taskActionOk() {
  return taskFormAcceptable(taskForm())
}

function main() {
  // 通知层人工核验入口(先于 INSTALL):只"真发一次/只问通道齐备",不参与自愈。
  // --notify-test 绕过当轮去重(force),否则"想核验的人"会被上一条同因告警的窗口挡住,
  // 得到一次假阴性;--notify-dry-run 零网络请求、不占收件人。
  const notifyTestAt = process.argv.indexOf('--notify-test')
  if (notifyTestAt >= 0) {
    const label = String(process.argv[notifyTestAt + 1] || '').trim() || 'manual'
    const r = notifyGuardRed(`通知链路自测(${label})`, '这是一条通道自测消息(非故障)。用于验证 git-guardian 唯一到人通道(邮件)是否真能落地。', {
      severity: 'info',
      force: true,
    })
    console.log(`--notify-test: sent=${r.sent} ${r.why}`)
    return r.sent ? 0 : 1
  }
  if (process.argv.includes('--notify-dry-run')) {
    const r = dispatchGuardMail({
      title: '【git-guardian】邮件通道演练(dry-run)',
      desp: '这是一条 dry-run 演练正文,未实际发送。\n第二行用于验证多行中文经文件通道原样送达。',
      severity: 'warning',
      dryRun: true,
    })
    console.log(`邮件通道(dry-run): ok=${r.ok} ${r.why}`)
    return r.ok ? 0 : 1
  }
  if (INSTALL) {
    // 必须注册 wscript 包装而非 node.exe 本身:计划任务以 InteractiveToken 直接执行控制台程序
    // (node.exe)时 Windows 会显示控制台 → 用户桌面每 2 分钟闪一扇黑窗(2026-09-20 实测踩坑)。
    // 与本仓库既有任务(DevProcessCleanup / KillGitSelector)保持同一隐藏启动约定。
    const vbs = join(WORKTREE, 'scripts', 'git-guardian-hidden.vbs')
    if (!existsSync(vbs)) {
      log(`注册失败:找不到隐藏启动包装 ${vbs}(勿改成直接执行 node.exe)`)
      return 1
    }
    // 注册前预检:让包装器真跑一次并看退出码。cscript/wscript 按 ANSI 代码页解码 .vbs,
    // 中文注释会被错切成伪引号导致**编译期**语法错(2026-09-20 实测踩过),而 wscript 下
    // 该错误会弹 "Windows Script Host" 对话框且 schtasks 仍报成功 —— 只能靠这一步拦下。
    let pre
    try {
      pre = execFileSync('cscript.exe', ['//nologo', vbs], {
        stdio: 'pipe',
        encoding: 'utf8',
        windowsHide: true,
        timeout: 60_000,
      })
    } catch (e) {
      log(
        `注册失败:git-guardian-hidden.vbs 预检未通过,勿注册坏包装器\n${e.stdout || ''}${e.stderr || e.message}`,
      )
      return 1
    }
    if (pre && /error/i.test(pre)) {
      log(`注册失败:git-guardian-hidden.vbs 预检报错\n${pre}`)
      return 1
    }
    const tr = `wscript.exe "${vbs}"`
    try {
      execFileSync(
        'schtasks',
        ['/create', '/tn', TASK_NAME, '/tr', tr, '/sc', 'minute', '/mo', '2', '/f'],
        {
          stdio: 'inherit',
          windowsHide: true,
        },
      )
      log(`已注册任务计划 "${TASK_NAME}"(每 2 分钟自检,经 git-guardian-hidden.vbs 静默启动)`)
      // 注册器只能造出 InteractiveToken(schtasks 的 /NP 会索要密码),故紧接着升 S4U,
      // 否则"新机器/重装后"又回到无人登录即停跑的状态。
      ensureS4u()
    } catch (e) {
      log('注册任务计划失败(需管理员权限): ' + String(e.message || e))
      process.exit(1)
    }
    return 0
    return registerTask() ? 0 : 1
  }

  const before = status()
  if (STATUS_ONLY) {
    console.log(JSON.stringify(before, null, 1))
    return 0
  }

  // 任务漂移自检(2026-09-22 立):活任务曾被改回直跑 node.exe → Interactive 会话每 2 分钟
  // 闪一扇可见黑窗。安装器是对的,但任务层没人兜底;常规巡检顺手核对,漂移即静默重注册。
  // --check(CI 口径)不产生副作用;预检派生的子巡检跳过,防递归。
  if (!CHECK_ONLY && !taskActionOk()) {
    log(
      `⚠️ 计划任务形态漂移(实测形态=${taskForm()}:InteractiveToken 直跑 node.exe 会闪黑窗),自动重注册`,
    )
    registerTask()
  }

  const coreOk = before.pointerOk && before.gitdirOk && before.gitUsable
  if (coreOk && before.refsOk) {
    // `.git` 与嵌套 ref 都健康 ≠ 工作区健康:宿主会成批删除工作区里的已跟踪文件
    // (实测同日三轮 137→27→1)。计划任务跑的是本单轮路径(startDaemon 未启用),
    // 健康轮次的早退之前是唯一能挂工作区自愈的位置 —— 不在此处就永远不执行。
    // --check 保持零副作用(CI 口径);真巡检才动手,且只在真恢复/发现他人删除时写日志。
    if (!CHECK_ONLY) healWorktreeTracked()
    // 盘根封口同理:重启会清掉 junction,而第三方重建真目录只需要一次启动。
    if (!CHECK_ONLY) healRootSeal()
    // §26 家目录改道同理:改道树被清掉后工具会立刻在 C 盘重建实体目录,而门 96 是 blocking
    // ⇒ 不自动补回就等于逼每一次提交绕过全部守门。
    if (!CHECK_ONLY) healHomeJunctions()
    // 合并吞并对账:别人机器上造好推来的合并跑不到提交链那道门(commit-tree 旁路不跑钩子),
    // 由本层按增量台账判到一次(只判不修)。
    if (!CHECK_ONLY) auditMergeAdditionLoss()
    // §5b 的"唯一空白层":恢复源刷新原本挂在计划任务上,而那个任务已实测消失 ⇒ 并入 tick。
    if (!CHECK_ONLY) refreshRecoverySource()
    // 看门人也要有人看:凭据/停摆巡检靠 schtasks 每 6 小时自跑,任务被删/被停/node 路径
    // 失效时它**自己不会喊**(故障形态是"安静",正是今天两天冻结的同类)。本守护每 2 分钟
    // 一趟且自身分层自愈,由它盯心跳最省。--check 仍零副作用。
    if (!CHECK_ONLY) watchWatchdog()
    // 幂等确保自身是 S4U(已是则内部秒退,不重建任务、不产生抖动)
    if (!CHECK_ONLY) ensureS4u()
    if (CHECK_ONLY) console.log('✅ .git 健康(pointer + gitdir + git 可用 + 嵌套 ref 完整)')
    return 0
  }

  if (!coreOk) log(anomalyLine(before))
  if (CHECK_ONLY) {
    console.log(
      coreOk
        ? `❌ 嵌套 ref 异常(未修复,--check 模式):${(before.refsMissing || []).length} 个缺失`
        : '❌ .git 异常(未修复,--check 模式)',
    )
    return 1
  }

  // 分层自愈:指针 -> 环境 -> HEAD 语法 -> refs -> 备份 -> 远端
  remediate(before)

  const after = status()
  const ok = after.pointerOk && after.gitdirOk && after.gitUsable && after.refsOk
  log(ok ? `✅ 自愈成功(HEAD=${after.head})` : '❌ 自愈失败,需人工介入')
  return ok ? 0 : 1
}

/** 常驻守护模式:需自备托管(nssm/服务/计划任务);本机实际用的是 `--install` 注册的计划任务(每 2 分钟),此模式未启用 */
function startDaemon() {
  const intervalMs = Number(process.env.GIT_GUARDIAN_INTERVAL_MS || 10000)
  syncGitMeta()
  const bin = GIT_BIN
  log(`守护模式启动(间隔 ${intervalMs}ms) — 监控 ${POINTER} + ${GITDIR}`)
  log(`git=${bin || '(未找到!)'} ${GIT_VERSION || ''} safe.directory=* (每次调用显式传入)`)
  log(`嵌套 ref 存续守护: 清单 ${REFS_MANIFEST}(缺失即离线重建 + packed-refs 固化)`)
  const tick = () => {
    try {
      const h = status()
      const coreOk = h.pointerOk && h.gitdirOk && h.gitUsable
      if (!coreOk) {
        log(anomalyLine(h))
        remediate(h)
        const a = status()
        log(
          a.pointerOk && a.gitdirOk && a.gitUsable && a.refsOk
            ? `✅ 自愈成功(HEAD=${a.head})`
            : '❌ 自愈失败,需人工介入',
        )
      } else if (!h.refsOk) {
        // 核心健康但嵌套 ref 被宿主清理(实测高频) → 离线重建, 不打扰人
        log(
          `⚠️ 检测到嵌套 ref 缺失 ${(h.refsMissing || []).length} 个: ${(h.refsMissing || []).join(', ')}`,
        )
        healRefs()
      } else {
        // 核心与 ref 都健康时,才轮到工作区存续性(宿主成批删工作区文件,实测高频)
        healWorktreeTracked()
        // 以及盘根封口(重启清掉 junction 后的 2 分钟内自动补回)
        healRootSeal()
        // 以及 §26 家目录改道(改道树被清后 2 分钟内自动补回;占用项 30 分钟冷却)
        healHomeJunctions()
      }
    } catch (e) {
      log('巡检异常(忽略): ' + String(e.message || e))
    }
    setTimeout(tick, intervalMs)
  }
  tick()
}

// §22d isDirectRun:本模块需要"双形态"——CLI 直接跑守护 / 镜像测试 import 纯判据。
// 不守卫的话 `node --test` 一 import 就会把整轮巡检(含真发信)跑起来,这正是 §22d 立的禁忌。
const isDirectRun = Boolean(process.argv[1]) && import.meta.url === pathToFileURL(process.argv[1]).href

if (isDirectRun) {
  if (DAEMON) {
    startDaemon()
  } else {
    process.exit(main())
  }
}

// §22c 镜像测试出口:通知层"是否应当发信"的全部判据(指纹/去重窗口/退避/状态归一/argv 契约)
// 必须能在零副作用、零网络、零真收件人的前提下取证。
export const __test__ = {
  alertFingerprint,
  parseNotifyState,
  shouldAlert,
  withAlertMark,
  maskEmail,
  resolveAlertTo,
  buildGuardMailArgv,
  redactChildOutput,
  judgeDryRunChannel,
  notifyGuardRed,
  NOTIFY_DEFAULT_WINDOW_MS,
  NOTIFY_DEFAULT_FAIL_COOLDOWN_MS,
}
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
