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
 *   node scripts/git-guardian.mjs --bare-audit-report [--json]
 *      # 只读:列出守护每次检出 core.bare=true 时留下的现场审计(进程清单 + 嫌疑人),
 *      #   件在 .workbuddy/git-bare-flip-audit/flip-*.json,保留最新 20 份。零副作用。
 */
import { execFileSync, spawnSync } from 'node:child_process'
import {
  appendFileSync,
  cpSync,
  existsSync,
  lstatSync,
  mkdirSync,
  readFileSync,
  readdirSync,
  renameSync,
  rmSync,
  statSync,
  writeFileSync,
} from 'node:fs'
import { basename, dirname, join } from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'

import { rotateAppendLog } from './lib/log-rotation.mjs'
import { createHash } from 'node:crypto'
import { homedir, hostname } from 'node:os'
import { isInteractiveUserHome } from './check-home-junctions.mjs'
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

// —— 收敛器收尾对齐停摆 → 到人(2026-09-25 票 O74)——
// git-sync-converge 的 alignWorktreeAfterHeadMove 失败原先"只记日志":锁被长期占用时,
// 工作区会无声地一直落后 HEAD(§12d 的静默回滚温床)。收敛器本体是一次性进程不适合发信,
// 而本守护每 2 分钟一轮、已是全部自愈告警的派发点 ⇒ 状态由收敛器写
// (.workbuddy/converge-align-state.json),这里读它并按阈值喊人。
// 阈值两个数都可被 env 覆盖(IHUI_ALIGN_STALL_FAILS / IHUI_ALIGN_STALL_AGE_MS),默认 3 / 600000。
const CONVERGE_ALIGN_STATE = join(WORKTREE, '.workbuddy', 'converge-align-state.json')
const ALIGN_STALL_DEFAULT_FAILS = 3
const ALIGN_STALL_DEFAULT_AGE_MS = 10 * 60 * 1000

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
 * 工作树视角是否可用 —— 与 gitUsable() **不是同一件事**,这一格此前无人看守。
 *
 * 实测事故(2026-09-28 18:29):`D:/IHUI-AI-git-repo/config` 的 `core.bare` 被翻成 `true`,
 * 于是守护自评 `pointerOk:true / gitdirOk:true / gitUsable:true / dirty:0`,而工作树里
 * **每一条** git 命令都报 `fatal: this operation must be run in a work tree` ——
 * 提交、钩子、落地器、推送门全部不可用,而账面全绿。`rev-parse HEAD` 在裸仓库下照样成功,
 * 所以"git 可用"从来推不出"这个仓库还能被工作树使用"。
 *
 * 为什么会带上裸档:§5b 的恢复是 `cpSync(BACKUP → GITDIR)`,而备份是整份 gitdir 副本 ——
 * 它自己的 `core.bare=true` 会随任何一次恢复**注回**活仓库。故本自愈同时归一两侧,
 * 只修活仓库等于留一颗定时炸弹。
 */
function worktreeUsable() {
  return git(['rev-parse', '--is-inside-work-tree'], true) === 'true'
}

/**
 * 核心健康判据 —— main 与 daemon **共用这一份实现**(两处各写必然漂移)。
 *
 * 漂移的实证:`core.bare=true` 时 `pointerOk / gitdirOk / gitUsable` **三条全绿**
 * (`rev-parse` 在裸档下照样成功),所以旧表达式把这一型判成"健康"、直接进健康分支早退,
 * `remediate()` 结构上到不了 —— 我先前落进 `remediate()` 的自愈**在提交链上生效次数为 0**,
 * 实测活仓库带裸档跑了数小时而守护每 2 分钟一趟、每趟都把其余 heal* 跑完再 return 0。
 * "函数在、判据对、调度路径不经过它"与本仓反复登记的「造好没装车」是同一型(守门 70/76/81)。
 */
function coreHealthy(s) {
  return Boolean(s.pointerOk && s.gitdirOk && s.gitUsable && s.worktreeUsable)
}

/** 用显式 `--git-dir` 读写某个 gitdir 的 core.bare(裸档下 `-C 工作树` 这条路是走不通的) */
function readBareFlag(gitdir = GITDIR) {
  const bin = resolveGitBin()
  if (!bin) return null
  try {
    return execFileSync(bin, [...GIT_SAFE_ARGS, '--git-dir', gitdir, 'config', '--get', 'core.bare'], {
      encoding: 'utf8',
      stdio: ['ignore', 'pipe', 'pipe'],
      timeout: 60000,
      windowsHide: true,
    }).trim()
  } catch {
    return null
  }
}

function writeBareFalse(gitdir = GITDIR) {
  const bin = resolveGitBin()
  if (!bin) return false
  try {
    execFileSync(bin, [...GIT_SAFE_ARGS, '--git-dir', gitdir, 'config', 'core.bare', 'false'], {
      encoding: 'utf8',
      stdio: ['ignore', 'pipe', 'pipe'],
      timeout: 60000,
      windowsHide: true,
    })
    return readBareFlag(gitdir) === 'false'
  } catch {
    return false
  }
}

/**
 * 把"活仓库 + 本地恢复源"两侧的 `core.bare` 一起归一为 false。
 * 恢复源不修:下一次 cpSync 恢复就把裸档注回来,同一故障必然复发。
 * `gitdir` / `backup` / `probeUsable` 仅供镜像测试在临时仓库上取证 —— 生产调用一律走默认值。
 * `captureAudit` 同为测试通道:传 null 档可避免在临时仓库取证时真去派生 PowerShell /
 * 往运行态目录写件;生产调用不传即走默认的 `captureBareFlipAudit`。
 */
function healWorktreeBare({
  gitdir = GITDIR,
  backup = BACKUP,
  probeUsable = worktreeUsable,
  captureAudit = captureBareFlipAudit,
} = {}) {
  const liveWas = readBareFlag(gitdir)
  const backupWas = existsSync(join(backup, 'config')) ? readBareFlag(backup) : null
  if (liveWas !== 'true' && backupWas !== 'true') return probeUsable()
  // —— 取证必须在修复**之前**(2026-09-29 立)——
  // 写回 false 之后,config 的 mtime 就是"我修的那一刻"而非"别人翻车的那一刻",而当时开着的
  // 进程也大概率已经退了;先落一份现场审计,规则②(进程生日 ≈ config mtime)才有锚点。
  // 它不参与任何判定、不改退出码、不改下面的修复与日志(失败也不得拦住修复)。
  try {
    captureAudit({ gitdir, backup, liveWas, backupWas })
  } catch (e) {
    log('现场取证未落盘(不影响修复): ' + String((e && e.message) || e))
  }
  const liveOk = writeBareFalse(gitdir)
  const backupOk = backupWas === 'true' ? writeBareFalse(backup) : true
  const usable = probeUsable()
  log(
    `${usable && liveOk && backupOk ? '修复' : '修复失败'}: core.bare 归一为 false ` +
      `(活仓库 ${liveWas}→${readBareFlag(gitdir)},恢复源 ${backupWas}→${existsSync(join(backup, 'config')) ? readBareFlag(backup) : '无 config'})` +
      ` | 工作树可用=${usable}`,
  )
  return usable && liveOk && backupOk
}

// ————————————————————————————————————————————————————————————————
// core.bare 翻车的现场取证件(2026-09-29 立)
//
// 为什么必须有:gitdir 的 `core.bare` 会被某个**不明写入者**翻成 true,而 `pointerOk /
// gitdirOk / gitUsable` 三条判据**全绿**(裸档下 `rev-parse` 照样成功),只有工作树类命令
// 全失败 —— 账面一片绿而全队提交链不可用。守护每 2 分钟纠一次(`.workbuddy/git-guardian.log`
// 2026-09-29 一晚 5 回:03:09 / 03:15 / 05:19 / 06:05 / 06:28),但**至今没人知道是谁写的**。
// 上一轮提的"开 Windows 机器级审计策略(SACL)"会动全机审计面、需用户点头,不是本票;
// 而翻车频率约 1 小时一次,所以只要守护在检出那一刻抓一份**进程清单**落盘,嫌疑人基本就在
// 里面(若是 `git.exe --git-dir <repo> config core.bare true` 或某个 IDE/守护进程干的,
// 命令行会直接写在清单里)。纯读、零判定改动。
//
// 三条不可漂的写法(都对应本仓记过的失效型):
//  ① 空清单不得记 `ok` —— "扫到 0"要先怀疑尺子(§22c / 守门 118 那一型);
//  ② 规则①的模式串只许一份常量 —— 命中判定与"被哪条规则命中"的文案两处各写必然漂开;
//  ③ 保留期清理只认 `flip-*.json` 形状、且不跟随重解析点 —— §26 记过"递归删穿过 junction
//     把 D 盘真实目标清空"的同型事故。
// ————————————————————————————————————————————————————————————————

/** 现场审计落点(在 `.workbuddy/` 下,已被 .gitignore 整目录覆盖 —— 实测 `git check-ignore` 命中,故不需要也不应改 .gitignore) */
const BARE_AUDIT_DIR = join(WORKTREE, '.workbuddy', 'git-bare-flip-audit')
/** 只留最新 20 份(每小时一次翻车也够看近两天,而运行态目录不得无限长) */
const BARE_AUDIT_KEEP = 20
/**
 * 人读报告里"只被时间窗命中"的条目上限。真机实测一次快照 351 进程 / 83 条时间窗命中,
 * 全打印会把**规则①那一条精确嫌疑**淹掉;件内 candidates 始终是完整清单。
 * 截断必须报名(见 formatBareFlipAuditReport 的"另有 N 条未打印"),静默截断与"没有嫌疑人"同形。
 */
const BARE_AUDIT_REPORT_TIME_ONLY_CAP = 15
/** 规则②时间窗:进程生日落在 config mtime ±10 分钟内即算嫌疑人 */
const BARE_AUDIT_WINDOW_MS = 10 * 60 * 1000
/** 本维在位的日期 —— 报告里"尚无记录"必须带上它,否则读的人会把"零记录"当成"零事故" */
const BARE_AUDIT_SINCE = '2026-09-29'
/** 审计件名形状(唯一的保留判据) */
const BARE_AUDIT_FILE_RE = /^flip-[0-9A-Za-z._-]+\.json$/
/**
 * 规则①(命令行内容)的模式串 **唯一一份**。candidates 的命中判定与写进 JSON 的规则名
 * 都从这个数组推导;在任何一端再抄一份正则就是第二个真相。
 */
const BARE_AUDIT_CMD_RULES = [
  { id: 'cmdline:live-gitdir-name', re: /IHUI-AI-git-repo/i },
  { id: 'cmdline:git-repo-token', re: /git-repo/i },
  { id: 'cmdline:core-bare-arg', re: /core\.bare/i },
  { id: 'cmdline:workbuddy-portable-git', re: /\.workbuddy[\\/]+binaries/i },
]
/** 派生 PowerShell 的绝对路径候选:裸名在本机不在 PATH(计划任务/服务身份下必然落空) */
function resolvePowerShellBin() {
  const roots = []
  if (process.env.SystemRoot) roots.push(join(process.env.SystemRoot, 'System32'))
  roots.push('C:/Windows/System32')
  for (const r of roots) {
    const p = join(r, 'WindowsPowerShell', 'v1.0', 'powershell.exe')
    if (existsSync(p)) return p
  }
  return null
}

/**
 * 取进程清单的 PowerShell 脚本。**必须纯 ASCII**(§26:控制台代码页会把非 ASCII 命令串吃掉),
 * 且刻意**不带**任何中文。输出每行 `Name|ProcessId|ParentProcessId|CreationDate|CommandLine`。
 *
 * 两处由真机探测(`.ihui-agent/tmp/bare-sentinel/probe.mjs`)逼出来的写法,都不是审美:
 *  ① CreationDate **原样吐 CIM 字符串**(`yyyyMMddHHmmss.ffffff±zzz`),不在 PS 侧转换 ——
 *     第一版用 `[System.Management.ManagementDateTimeConverter]`,在本机实测 336 个进程里
 *     **只有 1 个**转成功(该类型在 PowerShell 7 下没被加载),规则②因此整维空转;
 *  ② 命令行内的换行折成空格 —— 否则一条多行命令行会把后面几行变成"没有四个分隔符"的碎片,
 *     实测一次快照 51 行被判 malformed(记录本身还在,但白丢一半可读性)。
 */
const PS_PROCESS_SNAPSHOT = [
  'try { [Console]::OutputEncoding = [System.Text.Encoding]::UTF8 } catch { }',
  'Get-CimInstance Win32_Process | ForEach-Object {',
  '  $cd = ""',
  '  if ($_.CreationDate) { $cd = [string]$_.CreationDate }',
  '  $cl = ""',
  '  if ($_.CommandLine) { $cl = ("" + $_.CommandLine) -replace "[\\r\\n\\t]+", " " }',
  '  $pp = ""',
  '  if ($_.ParentProcessId) { $pp = [string]$_.ParentProcessId }',
  '  Write-Output ("" + $_.Name + "|" + $_.ProcessId + "|" + $pp + "|" + $cd + "|" + $cl)',
  '}',
].join('\n')

/**
 * 跑一次进程快照。返回值刻意是**三态**(不是"要么数组要么空数组"):
 * `spawn.state = ok | failed | timeout | enoent | not-win32 | no-powershell`,
 * 三种失败各有各的文案 —— 实现收尾时把"超时"标成"派生失败"就是把没量到写成量到了(§22c)。
 */
function snapshotProcesses() {
  if (process.platform !== 'win32') {
    return { state: 'not-win32', reason: `非 win32 平台(${process.platform}),Windows 进程清单无从取`, stdout: '' }
  }
  const bin = resolvePowerShellBin()
  if (!bin) {
    return { state: 'no-powershell', reason: 'Windows PowerShell 绝对路径候选均不存在', stdout: '' }
  }
  try {
    const stdout = execFileSync(
      bin,
      ['-NoProfile', '-NonInteractive', '-ExecutionPolicy', 'Bypass', '-Command', PS_PROCESS_SNAPSHOT],
      {
        encoding: 'utf8',
        stdio: ['ignore', 'pipe', 'pipe'],
        timeout: 20000,
        maxBuffer: 16 * 1024 * 1024,
        windowsHide: true,
      },
    )
    return { state: 'ok', reason: null, stdout: String(stdout || '') }
  } catch (e) {
    const code = e && (e.code === 'ENOENT' ? 'ENOENT' : '')
    const killed = Boolean(e && (e.signal === 'SIGTERM' || code === 'ETIMEDOUT' || /timed out|ETIMEDOUT/i.test(String((e && e.message) || ''))))
    if (code === 'ENOENT') {
      return { state: 'enoent', reason: `派生 ${bin} 失败(ENOENT:文件在而不可执行)`, stdout: '' }
    }
    if (killed) {
      return { state: 'timeout', reason: 'PowerShell 被本件自己的 timeout(20s)终止', stdout: '' }
    }
    return {
      state: 'failed',
      reason: `PowerShell 非零退出:${String((e && e.message) || e).split('\n')[0]}`,
      stdout: String((e && e.stdout) || ''),
    }
  }
}

/**
 * 解析进程 CreationDate。**必须同时认两种形态**:
 *  - Windows CIM 原样串 `yyyyMMddHHmmss.ffffff±zzz`(真机实际输出的就是这个,`+480` = 分钟偏移);
 *  - ISO-8601(测试夹具与跨平台取数用)。
 * 解析不出 ⇒ `ms:null` 且把**原文留着**,绝不把"量不到"写成"不在窗口内"(那是两件事)。
 */
function parseProcessCreationDate(raw) {
  const s = String(raw === null || raw === undefined ? '' : raw).trim()
  if (!s) return { iso: null, ms: null }
  const m = s.match(/^(\d{4})(\d{2})(\d{2})(\d{2})(\d{2})(\d{2})(?:\.(\d+))?\s*(?:([+-])(\d{1,4}))?$/)
  if (m) {
    if (m[8] === undefined || m[9] === undefined) return { iso: s, ms: null } // 没有偏移 ⇒ 无从定 UTC 时刻,不猜
    const frac = Number((m[7] || '0').slice(0, 3))
    let t = Date.UTC(+m[1], +m[2] - 1, +m[3], +m[4], +m[5], +m[6], Number.isFinite(frac) ? frac : 0)
    const off = Number(m[9])
    t -= (m[8] === '-' ? -off : off) * 60_000
    return { iso: new Date(t).toISOString(), ms: t }
  }
  const alt = Date.parse(s)
  if (Number.isFinite(alt)) return { iso: new Date(alt).toISOString(), ms: alt }
  return { iso: s, ms: null }
}

/**
 * 解析快照文本 —— **纯函数**,证明判据取材面的用例只喂构造面,不依赖此刻真仓的进程状态
 * (守门 103 T12 那一课:瞬时状态会让断言时对时错)。
 */
function parseProcessSnapshot(stdout) {
  const processes = []
  const malformed = []
  for (const raw of String(stdout || '').split(/\r?\n/)) {
    const line = raw.trim()
    if (!line) continue
    const parts = line.split('|')
    if (parts.length < 4) {
      malformed.push(line)
      continue
    }
    const name = parts[0].trim()
    const pid = parts[1].trim()
    const ppid = parts[2].trim()
    const created = parseProcessCreationDate(parts[3])
    // 第五段起整体是命令行:命令行自己含 `|` 时不得被切碎(切碎了就把一次 git 调用读成两条)
    const cmdline = parts.slice(4).join('|')
    processes.push({
      Name: name || null,
      ProcessId: pid !== '' && Number.isFinite(Number(pid)) ? Number(pid) : pid || null,
      ParentProcessId: ppid !== '' && Number.isFinite(Number(ppid)) ? Number(ppid) : ppid || null,
      CreationDate: created.iso,
      CommandLine: cmdline,
      // 内部字段:规则②用;不落 JSON 顶层(顶层按规格只留那五个字段名)
      __createdMs: Number.isFinite(created.ms) ? created.ms : null,
      // "命令行取不到(权限)"与"命令行确实为空"是两件事,分开报
      __cmdlineReadable: parts.length >= 5 && cmdline !== '',
    })
  }
  return { processes, malformed }
}

/** 规则①/②的嫌疑人挑选 —— 纯函数;命中任一规则即进名单,并写明是被**哪条**规则命中的 */
function selectBareFlipCandidates(processes, { anchorMs, windowMs = BARE_AUDIT_WINDOW_MS } = {}) {
  const out = []
  for (const p of processes || []) {
    const rules = []
    const cl = typeof p.CommandLine === 'string' ? p.CommandLine : ''
    for (const rule of BARE_AUDIT_CMD_RULES) {
      if (rule.re.test(cl)) rules.push(rule.id)
    }
    if (Number.isFinite(anchorMs) && Number.isFinite(p.__createdMs) && Math.abs(p.__createdMs - anchorMs) <= windowMs) {
      rules.push(`time-window:within-${windowMs}ms-of-config-mtime`)
    }
    if (rules.length > 0) {
      out.push({
        Name: p.Name,
        ProcessId: p.ProcessId,
        ParentProcessId: p.ParentProcessId,
        CreationDate: p.CreationDate,
        CommandLine: cl,
        matchedRules: rules,
      })
    }
  }
  return out
}

/**
 * 这份快照到底成不成立 —— 三种"没量到"各自点名,且**空清单不得记 ok**。
 * `candidates` 为空而清单本身量到了,结论是 `ok`(那说明写入者不在清单里,是**证据**不是故障)。
 */
function bareAuditSelfCheck({ spawn, processes, malformedCount, cmdlineMissing, timeMissing, anchorMs }) {
  const reasons = []
  if (!spawn || spawn.state !== 'ok') {
    reasons.push(`进程清单未取到:${spawn ? spawn.state + '(' + (spawn.reason || '未写原因') + ')' : '取数函数没有返回'}`)
  }
  const count = (processes || []).length
  if (spawn && spawn.state === 'ok' && count === 0) {
    reasons.push('进程清单为空(0 行可解析)—— 空扫不得读成"已确认没有嫌疑人"')
  }
  if (cmdlineMissing > 0) {
    reasons.push(`${cmdlineMissing} 个进程的命令行取不到(多为权限不足:跨会话/受保护进程)⇒ 规则①对这些进程未判定`)
  }
  if (timeMissing > 0) {
    reasons.push(`${timeMissing} 个进程的 CreationDate 量不到/解不出 ⇒ 规则②对这些进程未判定`)
  }
  if (malformedCount > 0) {
    reasons.push(`${malformedCount} 行形态不认(既不是有效记录也不是空行),未计入清单`)
  }
  if (!Number.isFinite(anchorMs)) {
    reasons.push('config mtime 量不到 ⇒ 规则②(进程生日落在 mtime 附近)整维未判定')
  }
  const undetermined = reasons.length > 0
  const partial = undetermined && count > 0 && spawn && spawn.state === 'ok'
  return {
    verdict: undetermined ? (partial ? 'partial' : 'undetermined') : 'ok',
    reasons,
    counts: {
      processes: count,
      malformed: malformedCount || 0,
      cmdlineMissing: cmdlineMissing || 0,
      timeMissing: timeMissing || 0,
      candidates: 0, // 由调用方补
    },
  }
}

/** 某一侧 gitdir 的现场读数(path + bare 现值 + config 的 mtime/ctime);取不到的字段一律点名原因 */
function bareAuditSide(gitdir, { readBare = readBareFlag } = {}) {
  const configFile = gitdir ? join(gitdir, 'config') : null
  const side = {
    path: gitdir || null,
    configFile,
    bare: null,
    configMtime: null,
    configCtime: null,
    configMtimeMs: null,
    undetermined: [],
  }
  if (!configFile || !existsSync(configFile)) {
    side.undetermined.push('config 文件不存在 ⇒ bare/mtime/ctime 全部未判定(不读成"没有裸档")')
    return side
  }
  try {
    const st = statSync(configFile)
    side.configMtime = new Date(st.mtimeMs).toISOString()
    side.configCtime = new Date(st.ctimeMs).toISOString()
    side.configMtimeMs = st.mtimeMs
  } catch (e) {
    side.undetermined.push('config stat 失败:' + String((e && e.message) || e))
  }
  let v = null
  try {
    v = readBare(gitdir)
  } catch (e) {
    side.undetermined.push('读 core.bare 抛错:' + String((e && e.message) || e))
    return side
  }
  if (v === null || v === undefined) side.undetermined.push('core.bare 取不到(git 不可调用或键不存在)')
  else side.bare = v
  return side
}

/**
 * 保留期决策 —— **纯函数**,输入是目录条目(名字 + 是否普通文件 + 是否重解析点)。
 * 只允许删 `flip-*.json` 且必须是普通文件、且 lstat 不是链接;其余一律进 `skipped` 并点名原因。
 * 名字按 UTC 时间戳字典序即时间序(`flip-YYYYMMDDTHHmmss...Z.json`)。
 */
function decideBareFlipRetention(entries, keep = BARE_AUDIT_KEEP) {
  const matched = []
  const skipped = []
  for (const e of entries || []) {
    const shapeOk = BARE_AUDIT_FILE_RE.test(String(e.name))
    if (!shapeOk) {
      skipped.push({ name: e.name, reason: '不是 flip-*.json 形状(保留期不得碰它)' })
      continue
    }
    if (e.isLink) {
      skipped.push({ name: e.name, reason: '是重解析点/符号链接 —— 删它等于删链接指向的真实文件(§26 同型事故)' })
      continue
    }
    if (!e.isFile) {
      skipped.push({ name: e.name, reason: '不是普通文件(目录/设备),不递归不删' })
      continue
    }
    matched.push(e.name)
  }
  const sorted = [...matched].sort()
  const overflow = Math.max(0, sorted.length - Math.max(0, keep))
  return {
    delete: sorted.slice(0, overflow),
    kept: sorted.slice(overflow),
    skipped,
    overflow,
  }
}

/** 目录条目的实地读取(把 lstat 的判定与"名字形状"分开,便于纯函数取证) */
function readBareFlipEntries(dir) {
  let names = []
  try {
    names = readdirSync(dir)
  } catch (e) {
    return { entries: null, error: String((e && e.message) || e) }
  }
  const entries = []
  for (const name of names) {
    let isFile = false
    let isLink = false
    try {
      const st = lstatSync(join(dir, name)) // lstat:绝不跟随重解析点
      isLink = st.isSymbolicLink() || st.isFIFO() || st.isSocket()
      isFile = st.isFile() && !st.isSymbolicLink()
    } catch {
      isFile = false
      isLink = false
    }
    entries.push({ name, isFile, isLink })
  }
  return { entries, error: null }
}

/** 审计件名(UTC 时间戳,字典序即时间序) */
function bareAuditFileName(now = Date.now()) {
  return 'flip-' + new Date(now).toISOString().replace(/[:]/g, '').replace(/\./g, '') + '.json'
}

/** 最近一份审计件(供 --status 的 bareAudit 字段与报告入口共用);取不到一律 null 并给原因 */
function latestBareFlipAuditFile(dir = BARE_AUDIT_DIR) {
  if (!existsSync(dir)) return { file: null, reason: '目录尚不存在(本维自 ' + BARE_AUDIT_SINCE + ' 起才在位)' }
  const { entries, error } = readBareFlipEntries(dir)
  if (error) return { file: null, reason: '读目录失败:' + error }
  const names = entries.filter((e) => BARE_AUDIT_FILE_RE.test(e.name) && e.isFile).map((e) => e.name)
  if (names.length === 0) return { file: null, reason: '目录里没有 flip-*.json(不等于没翻过 —— 见报告首行)' }
  names.sort()
  return { file: names[names.length - 1], reason: null }
}

/**
 * 检出裸档那一刻的现场取证落盘。**全程 best-effort**:任何一步失败都不抛、不改修复行为,
 * 但**必须留一行可见日志**(§5e 的"失败必须响"—— 静默失败的取证等于没取证)。
 */
function captureBareFlipAudit({
  gitdir = GITDIR,
  backup = BACKUP,
  liveWas = null,
  backupWas = null,
  dir = BARE_AUDIT_DIR,
  now = Date.now(),
  runSnapshot = snapshotProcesses,
  readBare = readBareFlag,
} = {}) {
  const spawn = (() => {
    try {
      return runSnapshot() || { state: 'failed', reason: '取数函数返回空', stdout: '' }
    } catch (e) {
      return { state: 'failed', reason: '取数抛错:' + String((e && e.message) || e), stdout: '' }
    }
  })()
  const live = bareAuditSide(gitdir, { readBare })
  const backupSide = existsSync(join(backup, 'config'))
    ? bareAuditSide(backup, { readBare })
    : { path: backup, configFile: join(backup, 'config'), bare: null, configMtime: null, configCtime: null, configMtimeMs: null, undetermined: ['恢复源没有 config 文件(不参与 mtime 锚点)'] }
  const { processes, malformed } = parseProcessSnapshot(spawn.stdout)
  // 锚点取**被翻坏那一侧**的 config mtime;取不到 ⇒ 规则②整维未判定(不猜、也不记成"没有")
  const anchorMs = Number.isFinite(live.configMtimeMs) ? live.configMtimeMs : null
  const candidates = selectBareFlipCandidates(processes, { anchorMs })
  const cmdlineMissing = processes.filter((p) => !p.__cmdlineReadable).length
  const timeMissing = processes.filter((p) => !Number.isFinite(p.__createdMs)).length
  const selfCheck = bareAuditSelfCheck({
    spawn,
    processes,
    malformedCount: malformed.length,
    cmdlineMissing,
    timeMissing,
    anchorMs,
  })
  selfCheck.counts.candidates = candidates.length
  const payload = {
    schema: 'git-bare-flip-audit/v1',
    detectedAt: new Date(now).toISOString(),
    detectedBy: 'scripts/git-guardian.mjs healWorktreeBare(修复前取证)',
    repairIntent: { liveWas, backupWas },
    sides: {
      liveGitdir: { ...live, undeterminedReasons: live.undetermined },
      backup: { ...backupSide, undeterminedReasons: backupSide.undetermined },
    },
    anchor: {
      configFile: live.configFile,
      configMtimeMs: anchorMs,
      windowMs: BARE_AUDIT_WINDOW_MS,
      rule: '规则①命令行模式命中(见 cmdRules)∨ 规则②进程 CreationDate 落在 config mtime ±windowMs',
    },
    cmdRules: BARE_AUDIT_CMD_RULES.map((r) => ({ id: r.id, pattern: r.re.source })),
    processSnapshot: {
      source: 'Get-CimInstance Win32_Process -> Name|ProcessId|ParentProcessId|CreationDate|CommandLine(CIM 原样串,由本件解析成 ISO-UTC)',
      powershellBin: resolvePowerShellBin(),
      spawnState: spawn.state,
      spawnReason: spawn.reason || null,
      count: processes.length,
      malformedLines: malformed.length,
      processes: processes.map((p) => ({
        Name: p.Name,
        ProcessId: p.ProcessId,
        ParentProcessId: p.ParentProcessId,
        CreationDate: p.CreationDate,
        CommandLine: p.CommandLine,
      })),
    },
    candidates,
    selfCheck,
  }
  try {
    mkdirSync(dir, { recursive: true })
    const file = join(dir, bareAuditFileName(now))
    writeFileSync(file, JSON.stringify(payload, null, 2), 'utf8')
    const decision = decideBareFlipRetention(readBareFlipEntries(dir).entries || [])
    for (const name of decision.delete) {
      try {
        rmSync(join(dir, name), { force: true })
      } catch (e) {
        log(`保留期清理失败(不递归、不重试别的): ${name} — ${String((e && e.message) || e)}`)
      }
    }
    log(
      `现场取证已落盘: ${basename(file)}(进程 ${processes.length} 条 / 嫌疑 ${candidates.length} 条 / 自证 ${selfCheck.verdict})` +
        (decision.delete.length ? ` | 按保留期删 ${decision.delete.length} 份旧件` : ''),
    )
    return basename(file)
  } catch (e) {
    log('现场取证未落盘(不影响修复): ' + String((e && e.message) || e))
    return null
  }
}

/**
 * **打印面**的命令行脱敏。落盘的审计件留在 `.workbuddy/`(gitignored、不出机)保留原文 ——
 * 那是取证价值所在;而人读报告会被贴进日志/台账/聊天,§5d"凭据不入日志"这一条管的是这一面。
 * 只替值、不替键名,`core.bare true` 这类判据字样逐字保留。
 */
function redactCmdlineForPrint(cl) {
  return String(cl || '')
    .replace(/((?:token|secret|password|passwd|api[_-]?key|access[_-]?key|authorization|bearer)[\w-]*\s*[=:]\s*)\S+/gi, '$1***')
    .replace(/([?&](?:key|token|sig|access_token|password)=)[^&\s]+/gi, '$1***')
}

/**
 * `--bare-audit-report` 的组装 —— 纯格式化(输入是已读出的记录数组),便于零副作用取证。
 * 首行必须回答"零记录 ≠ 零事故",否则读的人会把"这里还没在位"当成"仓库从没翻过车"。
 */
function formatBareFlipAuditReport(records, { dir = BARE_AUDIT_DIR, unreadable = [], missingDir = null } = {}) {
  const lines = []
  lines.push(`core.bare 翻车现场审计(${dir})— 保留最近 ${BARE_AUDIT_KEEP} 份`)
  lines.push('提示:命令行在本报告里已对凭据值脱敏(`--password=xxx` → `--password=***`),审计件内保留原文;件在 .workbuddy 下,gitignored、不出机。')
  if (!records.length) {
    lines.push(
      `尚无记录(不等于没翻过 —— 守护这一维从 ${BARE_AUDIT_SINCE} 起才在位` +
        (missingDir ? ';目录本身还不存在:' + missingDir : '') +
        ')',
    )
  }
  for (const r of records) {
    const cands = Array.isArray(r.candidates) ? r.candidates : []
    let shownTimeOnly = 0
    let hiddenTimeOnly = 0
    lines.push(
      `· ${r.detectedAt || '(无 detectedAt)'} | 活仓库=${r.sides?.liveGitdir?.bare ?? '未判定'}` +
        ` 恢复源=${r.sides?.backup?.bare ?? '未判定'} | 自证=${r.selfCheck?.verdict ?? '未判定'}` +
        ` | 进程=${r.processSnapshot?.count ?? '?'} 嫌疑=${cands.length}`,
    )
    for (const c of cands) {
      // 只被规则②(时间窗)命中的条目可以很多(实测一次 351 进程里 83 条),打印面截断但
      // **必须报名**并指向件内原文 —— 静默截断与"这一族没有嫌疑人"在账面上长得一样。
      const onlyTimeWindow = (c.matchedRules || []).length > 0 && (c.matchedRules || []).every((r) => r.startsWith('time-window'))
      if (onlyTimeWindow && shownTimeOnly >= BARE_AUDIT_REPORT_TIME_ONLY_CAP) {
        hiddenTimeOnly += 1
        continue
      }
      if (onlyTimeWindow) shownTimeOnly += 1
      lines.push(
        `    ↳ ${c.Name || '?'} pid=${c.ProcessId ?? '?'} ppid=${c.ParentProcessId ?? '?'} ` +
          `born=${c.CreationDate || '未判定'} rules=[${(c.matchedRules || []).join(', ')}]`,
      )
      const cl = redactCmdlineForPrint(c.CommandLine)
      if (cl) lines.push(`        cmd: ${cl.length > 240 ? cl.slice(0, 240) + '…' : cl}`)
    }
    if (hiddenTimeOnly > 0) {
      lines.push(
        `    …另有 ${hiddenTimeOnly} 条只被时间窗(规则②)命中的条目未打印(打印上限 ${BARE_AUDIT_REPORT_TIME_ONLY_CAP}),` +
          '全量在件内 candidates 数组里 —— 规则①的命令行命中一律逐条打印',
      )
    }
    for (const why of r.selfCheck?.reasons || []) lines.push(`    ⚠️ ${why}`)
  }
  for (const u of unreadable) lines.push(`⚠️ 无法读取(不计入结论): ${u.name} — ${u.reason}`)
  return lines.join('\n')
}

/** 读那批 JSON(只读问责入口) */
function readBareFlipAuditRecords(dir = BARE_AUDIT_DIR) {
  if (!existsSync(dir)) {
    return { records: [], unreadable: [], missingDir: '目录不存在', dir }
  }
  const { entries, error } = readBareFlipEntries(dir)
  if (error) return { records: [], unreadable: [], missingDir: error, dir }
  const records = []
  const unreadable = []
  const names = entries.filter((e) => BARE_AUDIT_FILE_RE.test(e.name) && e.isFile).map((e) => e.name)
  names.sort()
  for (const name of names) {
    try {
      records.push({ file: name, ...JSON.parse(readFileSync(join(dir, name), 'utf8')) })
    } catch (e) {
      unreadable.push({ name, reason: String((e && e.message) || e) })
    }
  }
  return { records, unreadable, missingDir: null, dir }
}

function bareAuditReportMain(json) {
  const { records, unreadable, missingDir, dir } = readBareFlipAuditRecords()
  if (json) {
    console.log(JSON.stringify({ dir, keep: BARE_AUDIT_KEEP, since: BARE_AUDIT_SINCE, records, unreadable, missingDir }, null, 1))
  } else {
    console.log(formatBareFlipAuditReport(records, { dir, unreadable, missingDir }))
  }
  // 目录本身读不到 ⇒ 这一维**未判定**,不得以 0 冒充"没有翻车"(exit 2 = 无法判定)
  if (missingDir && !String(missingDir).startsWith('目录不存在')) return 2
  return 0
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
  const briefList = (paths) =>
    `${(paths || []).slice(0, 3).join(', ')}${(paths || []).length > 3 ? ' …' : ''}`

  const { r, err } = run(['--json'])
  if (err) log('工作区存续自愈失败(不阻断其余守护): ' + err)
  else if (r.restored)
    log(`✅ 工作区存续自愈:恢复 ${r.restored} 个被外部删除的跟踪文件(${brief(r)})`)
  else if (r.held) log(`ℹ️ 工作区 ${r.held} 个跟踪文件缺失,但索引里已是删除(他人在制)⇒ 不代裁恢复`)
  // G-1018292:删除意图丢失这一档必须单独出声 —— 它与上面那档的差别是本质的:
  // `held` 的证据在索引面(标记还在,只是不碰),这一档的标记**已经被摘掉**
  // (某次 `git reset HEAD` 清空共享索引时没的)。折进 held 或只在 restored 时顺带提一句,
  // 读日志的人就会以为"标记还在、只是没碰",而真相是标记已经没了。
  if (r.intentLost)
    log(
      `⚠️ 工作区 ${r.intentLost} 个跟踪文件缺失且删除意图已丢失(暂存标记被共享索引清空摘掉)⇒ ` +
        `分不清是宿主误删还是有意删除,不代裁恢复(${briefList(r.intentLostPaths)})`,
    )

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
const HOME_HEAL_STAMP = join(WORKTREE, '.workbuddy', 'home-junctions.last-heal.txt')
/** 两轮自愈之间的最小墙钟间隔。
 *  为什么必须有:常驻模式(`--daemon`)的 tick 是 `GIT_GUARDIAN_INTERVAL_MS || 10000`,即**10 秒**
 *  (它兜的是 `.git` 被整体删除那一型,必须快,不该为此调慢)。但家目录自愈是按"每 2 分钟一趟"
 *  设计的(见上面三条改法的 ①②),挂在 10 秒 tick 上就等于把一轮几百 MB 的 robocopy 提频 12 倍。
 *  2026-09-27 实测到后果:同一失败项 12 秒刷一条告警、两小时 1.3 万行。
 *  冷却表(修复器自己写)已能拦住**已知失败项**,这一层拦的是"任何一轮的整体重抄",两者不互替:
 *  判红原因落在项之外时(例如登记表被过滤空)冷却表是空的,只有墙钟间隔兜得住。 */
const HOME_HEAL_MIN_INTERVAL_MS = 10 * 60 * 1000

/** 纯函数:本轮该不该叫自愈。时间戳读不到/为 0/为负 ⇒ 视为到期(宁跑一轮,不因为一个坏文件永久静默)。 */
export function homeHealDue(raw, now, minIntervalMs = HOME_HEAL_MIN_INTERVAL_MS) {
  const last = Number(String(raw ?? '').trim())
  if (!Number.isFinite(last) || last <= 0) return true
  return now - last >= minIntervalMs
}

function healHomeJunctions() {
  const dir = dirname(fileURLToPath(import.meta.url))
  const judge = join(dir, 'check-home-junctions.mjs')
  const fixer = join(dir, 're-home-junctions.mjs')
  if (!existsSync(judge) || !existsSync(fixer)) return
  // ── ⓪ 身份闸(2026-09-27,排在节流与锁之前)──
  // 常驻守护是 NSSM 服务,身份 LocalSystem,它的家目录是 `C:\Windows\System32\config\systemprofile`,
  // 于是 §26 那 16 项登记路径在**这一身份下解析成另一批路径** —— 而那批路径里实测真有一个
  // `AppData\Local\pnpm-cache` 实体目录,门因此恒判红,守护遂每 10 秒叫修复器去把**系统账户的目录**
  // robocopy 进**真人正在用的缓存树**。这不是噪音问题,是"搬运工具拿错了搬运对象"。
  // 判据住在 check-home-junctions.mjs 的 isInteractiveUserHome,此处只调用 —— 不得抄第二份。
  // 静默返回是刻意的:这里 skip 的是"一轮调度",不是一个判定;判定结论仍在修复流程的日志里。
  // 若为 skip 也打日志,就等于用另一种文案把同一条刷屏复制回来。
  if (!isInteractiveUserHome(homedir())) return
  // ── ⓪b 墙钟节流 ──
  let lastRaw = ''
  try {
    lastRaw = readFileSync(HOME_HEAL_STAMP, 'utf8')
  } catch {
    lastRaw = ''
  }
  if (!homeHealDue(lastRaw, Date.now())) return
  try {
    mkdirSync(dirname(HOME_HEAL_STAMP), { recursive: true })
    writeFileSync(HOME_HEAL_STAMP, String(Date.now()), 'utf8')
  } catch {
    /* 时间戳写不进去只失去节流这一层的保护,不得因此不跑本轮 */
  }
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
      // dedupKey(§5e-1 配套,102 封同因):detail 里 `冷却项 N 个` 与 `N×…` 都是**实时计数**,
      // 逐轮变动 ⇒ 指纹变 ⇒ shouldAlert 判"新故障"立即重发,4 小时窗口只剩名字
      // (实测 09-30/10-01 两天寄出 94 封,`冷却项 0/1/11 个`各被当成一种身份)。
      // 身份只取"失败原因类别",冷却项个数仍进正文(它是诊断信息,不是身份)。
      { dedupKey: `home-heal-exit=${after.code};why=${why || 'no-tag'}` },
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
/**
 * 主机时区漂移问责(2026-09-30 立,尺子本体 = `scripts/check-host-timezone.mjs`)。
 *
 * 为什么必须挂在这一格:2026-09-04 本机时区被一次未登记的改动从东八区改成 UTC,持续 25 天,
 * 期间支付宝网关签名早 8 小时、异常检测把北京高峰当"凌晨可疑"、全库导出落在上午 11:00,
 * 而**没有任何一个执行体问过这台机的时区是什么**。提交链上的门只在有人提交时跑;判的是机器状态,
 * 所以出口只能是这里(守护 tick,每 2 分钟一轮)。
 *
 * 三条不可漂的写法:
 *  ① 挂点带 `!CHECK_ONLY` —— 本文件已两次踩过"挂进 CHECK_ONLY 路径等于永不执行";
 *  ② 节流(默认 30 分钟)且**取不到读数就不发信**:主机时区判不出 ≠ 漂移,把"没判"寄成告警就是
 *     制造噪声(§5e 失败必须响,但响的是量到的红,不是尺子失效);
 *  ③ 发信只经 notify()(→ notify-deploy-failure.ts),不得在本文件自拼 SMTP(守门 81 硬拦)。
 */
const TZ_AUDIT_TICK = join(WORKTREE, '.workbuddy', 'host-timezone-audit-tick.ts')
const TZ_AUDIT_INTERVAL_MS = 30 * 60 * 1000

function auditHostTimezone() {
  try {
    let last = 0
    try {
      last = Number(readFileSync(TZ_AUDIT_TICK, 'utf8')) || 0
    } catch {
      /* 首次:没有 tick 就是该跑 */
    }
    if (Date.now() - last < TZ_AUDIT_INTERVAL_MS) return
    try {
      mkdirSync(dirname(TZ_AUDIT_TICK), { recursive: true })
      writeFileSync(TZ_AUDIT_TICK, String(Date.now()))
    } catch {
      /* tick 写不下去也要判一次:否则一次盘错就永久失明 */
    }
    const script = join(dirname(fileURLToPath(import.meta.url)), 'check-host-timezone.mjs')
    if (!existsSync(script)) {
      logger('ℹ️ 主机时区对账:尺子脚本不在位(scripts/check-host-timezone.mjs)⇒ 本轮跳过,不记为已判')
      return
    }
    let parsed = null
    try {
      const out = execFileSync(process.execPath, [script, '--quick', '--json'], {
        cwd: WORKTREE,
        windowsHide: true,
        timeout: 90_000,
        maxBuffer: 8 * 1024 * 1024,
        encoding: 'utf8',
      })
      parsed = JSON.parse(String(out).trim())
    } catch (e) {
      // 判红也是非零退出:必须先看有没有可解析的载荷,不能把"退出码非零"直接当尺子失效。
      const body = e && e.stdout ? String(e.stdout).trim() : ''
      try {
        parsed = JSON.parse(body)
      } catch {
        logger(`ℹ️ 主机时区对账:未判定(派生失败或载荷不可 parse:${String(e && e.message).slice(0, 120)})—— 不寄信,也别当已判过`)
        return
      }
    }
    if (!parsed || parsed.verdict === 'error') {
      logger(`ℹ️ 主机时区对账:未判定(${(parsed && parsed.reasons && parsed.reasons[0]) || '载荷是 error'})`)
      return
    }
    if (parsed.verdict === 'red') {
      const lines = (parsed.reasons || []).join('\n')
      const h2 = parsed.h2 || {}
      notifyGuardRed(
        '主机时区漂移:本机时钟与声明不符',
        `${lines}\n\n声明:config/host-timezone.json(changedAt ${parsed.changedAt})\n` +
          `实测:${parsed.measured && parsed.measured.registry} / node ${parsed.measured && parsed.measured.nodeIana}\n` +
          `最近一次时区变更归属:${(h2.events || []).slice(0, 2).map((x) => `${x.utc} ← ${x.proc || '?'}`).join(' / ') || '(未取到)'}\n` +
          `H3 落地维逐条:${(parsed.h3 && parsed.h3.rows ? parsed.h3.rows.map((r) => `${r.file}=${r.state}${r.gapHours !== undefined ? `(${r.gapHours}h)` : ''}`).join(', ') : '(无)')}\n` +
          `若是 stale-cache:改完时区必须重启对应常驻服务(进程在启动时就把区读进缓存)。取证:node scripts/check-host-timezone.mjs`,
        { severity: 'warning' },
      )
      logger(`⚠️ 主机时区对账判红:${lines}`)
      return
    }
    logger(`✅ 主机时区对账:无漂移(${parsed.measured && parsed.measured.registry};未判定 ${parsed.undeterminedCount} 维)`)
  } catch (e) {
    logger(`⚠️ 主机时区对账自身异常(不改自愈与退出码):${String(e && e.message).slice(0, 160)}`)
  }
}

/**
 * 盘根卫生巡检(2026-09-30 立,尺子本体 = `scripts/check-disk-root-hygiene.mjs`)。
 *
 * 为什么必须挂在这一格:用户拍板"项目产物不外流"(盘根除声明白名单外不允许有项目产物)。
 * 提交链上的门只判仓库根一级(check-root-dir-clean),盘根与 worktree 登记面无人看守
 * ⇒ 清完必回潮(2026-09-30 实测:刚删净的 .pytest_tmp_runs 数小时内被重建)。
 * 判的是磁盘/机器状态 ⇒ 出口只能是守护 tick(warn 尺子,绝不进提交链,§12e)。
 *
 * 三条不可漂的写法(与 auditHostTimezone 同源):
 *  ① 挂点带 `!CHECK_ONLY` —— 挂进 CHECK_ONLY 路径等于永不执行;
 *  ② 节流(默认 30 分钟)且**未判定不发信**:量不到 ≠ 外流,把"没判"寄成告警是制造噪声;
 *  ③ 发信只经 notifyGuardRed(),不得在本文件自拼 SMTP(守门 81 硬拦)。
 */
const DISK_ROOT_AUDIT_TICK = join(WORKTREE, '.workbuddy', 'disk-root-hygiene-audit-tick.ts')
const DISK_ROOT_AUDIT_INTERVAL_MS = 30 * 60 * 1000

function auditDiskRootHygiene() {
  try {
    let last = 0
    try {
      last = Number(readFileSync(DISK_ROOT_AUDIT_TICK, 'utf8')) || 0
    } catch {
      /* 首次:没有 tick 就是该跑 */
    }
    if (Date.now() - last < DISK_ROOT_AUDIT_INTERVAL_MS) return
    try {
      mkdirSync(dirname(DISK_ROOT_AUDIT_TICK), { recursive: true })
      writeFileSync(DISK_ROOT_AUDIT_TICK, String(Date.now()))
    } catch {
      /* tick 写不下去也要判一次:否则一次盘错就永久失明 */
    }
    const script = join(dirname(fileURLToPath(import.meta.url)), 'check-disk-root-hygiene.mjs')
    if (!existsSync(script)) {
      logger('ℹ️ 盘根卫生:尺子脚本不在位(scripts/check-disk-root-hygiene.mjs)⇒ 本轮跳过,不记为已判')
      return
    }
    let parsed = null
    try {
      const out = execFileSync(process.execPath, [script, '--json'], {
        cwd: WORKTREE,
        windowsHide: true,
        timeout: 90_000,
        maxBuffer: 8 * 1024 * 1024,
        encoding: 'utf8',
        stdio: ['ignore', 'pipe', 'pipe'],
      })
      parsed = JSON.parse(String(out).trim())
    } catch (e) {
      const body = e && e.stdout ? String(e.stdout).trim() : ''
      try {
        parsed = JSON.parse(body)
      } catch {
        logger(`ℹ️ 盘根卫生:未判定(派生失败或载荷不可 parse:${String(e && e.message).slice(0, 120)})—— 不寄信,也别当已判过`)
        return
      }
    }
    if (!parsed || parsed.verdict === 'undetermined') {
      logger(`ℹ️ 盘根卫生:未判定(${(parsed && parsed.counts && `worktree 维度未判定=${parsed.counts.worktreeUndetermined}`) || '载荷缺 verdict'})`)
      return
    }
    if (parsed.verdict === 'red') {
      const lines = (parsed.violations || [])
        .map((v) => (v.kind === 'stray-root-entry' ? `盘根外流: ${v.root}${v.entry}` : `worktree 落点外: ${v.path}${v.prunable ? '(prunable)' : ''}`))
        .join('\n')
      notifyGuardRed(
        '盘根外流:项目产物出现在声明白名单之外',
        `${lines}\n\n白名单:config/disk-root-allowlist.json(封闭集合,新增合法条目必须显式改配置并随 commit 提交)\n` +
          `worktree 合法落点:G:\\IHUI-AI\\.worktrees\\(AGENTS §12d);回收:git worktree remove + prune\n` +
          `手动问责:node scripts/check-disk-root-hygiene.mjs --strict`,
        {
          severity: 'warning',
          // 去重身份只取"违规类别 + 计数",明细行不进指纹(2026-10-03 立)。
          // 原先指纹吃 detail 全文,而 detail 是 worktree/盘根条目的**清单** ——
          // 多会话并行建删 worktree 是本仓常态(2026-10-03 实测 4 个落点外 worktree
          // 全是探针残留),清单一动指纹就变,shouldAlert 判"新故障"立即重报,
          // 4 小时窗口被绕成虚设:实测 09-30 至 10-03 同一原因寄出 27 封(约每轮巡检一封)。
          // 判据本身不动(§12e):违规照旧点名、照旧 exit 1,只把"什么算同一故障"钉成
          // 稳定语义 —— 违规类别变或计数变(真恶化/真缓解)仍立即重报。
          dedupKey: `stray=${parsed.counts.diskRootStray};wtOutside=${parsed.counts.worktreeOutside}`,
        },
      )
      logger(`⚠️ 盘根卫生判红:外流 ${parsed.counts.diskRootStray} / worktree 落点外 ${parsed.counts.worktreeOutside}`)
      return
    }
    logger(`✅ 盘根卫生:0 违规(白名单对账 + worktree 落点全在 .worktrees)`)
  } catch (e) {
    logger(`⚠️ 盘根卫生自身异常(不改自愈与退出码):${String(e && e.message).slice(0, 160)}`)
  }
}

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
    // 21 封全部落在 4h 窗口之外一点(实测间隔 4.00~4.62h,均值 4.05h)⇒ 指纹其实**稳定**
    // (exit 码已被数字归一),这一格是"稳定指纹 × 零有效出口":出口那条命令本身不含
    // 任何创建备份的代码,重跑 = 同一段代码重跑同一个失败(2026-10-03 审计)。
    // 身份带上出口形态,便于将来判据换出口时能分辨"还是那个故障"vs "换了个出口"。
    { severity: 'critical', dedupKey: `backup-refresh-fail;exit=${applied.code}` },
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
 * 稳定身份指纹(2026-10-03 立):调用方显式给定"什么算同一故障",**不做数字归一**。
 *
 * 为什么不能直接复用 alertFingerprint:那条路把 `\d+` 一律打成 `#`,本意是压掉
 * "38 个路径"↔"39 个路径"这类实时计数抖动;但盘根卫生的 dedupKey 恰恰**要靠计数
 * 区分故障演化**(外流 2 项 → 5 项是恶化,必须立即重报)。走归一后 `stray=2;wt=4` 与
 * `stray=5;wt=4` 撞同一指纹,恶化被静默 —— 那是把"压抖动"改成"压事实"。
 *
 * 因此这里刻意**不归一**:调用方给什么身份就是什么身份,身份怎么构造是调用方的义务
 * (盘根这一格给的是"违规类别 + 计数",明细清单不进身份)。
 */
export function stableAlertFingerprint(name, identity) {
  const id = String(identity ?? '').replace(/\s+/g, ' ').trim()
  return createHash('sha1').update(`${name}\u0000${id}`, 'utf8').digest('hex')
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
    dedupKey = '',
    force = false,
    logger = log,
  } = opts
  try {
    if (!force) {
      // --check 是 CI 口径(零副作用),通知归真巡检轮;显式开关只关"要不要发",不关"发几封"
      if (process.env.GIT_GUARDIAN_NOTIFY_DISABLED === '1') return { sent: false, why: 'GIT_GUARDIAN_NOTIFY_DISABLED=1,已关闭' }
      if (CHECK_ONLY) return { sent: false, why: '--check 模式零副作用,不发' }
    }
    const fp = dedupKey ? stableAlertFingerprint(name, dedupKey) : alertFingerprint(name, detail)
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
      (dedupKey
        ? `本告警按稳定身份去重(判据:违规类别与计数),明细行不进指纹 —— 清单里多一个条目/路径变化不算新故障,` +
          `否则多会话并发建删 worktree 会把窗口绕成虚设。真变化(违规类别或计数变了)仍立即重报。\n`
        : '') +
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
      if (r.ok) {
        // **自测成功也清 UNDELIVERED 标记**(2026-10-03 补)。原先只有真实告警那条路径清,
        // 于是「跑一次 --notify-test 证明通道是好的」之后,P8「投递失败标记」仍红 ——
        // 那格判的是"有故障从未被人看见",而人刚亲眼验过通道通,标记却留着,
        // 等于**唯一能自证清白的那条路被设计堵死**(实测:真投递成功后 P8 仍 findings=1)。
        // 清它不等于承认某条真欠账已还:欠账的真值在 notify-state 的 `delivered` 维,
        // 由 P10 读;这个文件只是"最近一次投递失败"的**瞬时标记**。
        try {
          rmSync(undelFile, { force: true })
        } catch {
          /* 标记清不掉不影响"通道已验通"这个事实,下一轮真实投递还会再清 */
        }
        logger(`✅ 通知自测已送达: ${name} → ${maskEmail(resolveAlertTo())}`)
      } else {
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

// ── 收敛器收尾对齐停摆的阈值判据与检查(2026-09-25 票 O74,纯函数化以便构造输入取证) ──

/** 阈值解析:cfg 显式值 > env(IHUI_ALIGN_STALL_FAILS / IHUI_ALIGN_STALL_AGE_MS)> 默认 3 / 600000 */
function alignStallThresholds(cfg = {}) {
  const envFails = parseInt(process.env.IHUI_ALIGN_STALL_FAILS ?? '', 10)
  const envAge = parseInt(process.env.IHUI_ALIGN_STALL_AGE_MS ?? '', 10)
  return {
    minFails: Number.isFinite(cfg.minFails)
      ? cfg.minFails
      : Number.isFinite(envFails)
        ? envFails
        : ALIGN_STALL_DEFAULT_FAILS,
    minAgeMs: Number.isFinite(cfg.minAgeMs)
      ? cfg.minAgeMs
      : Number.isFinite(envAge)
        ? envAge
        : ALIGN_STALL_DEFAULT_AGE_MS,
  }
}

/**
 * 该不该喊人:**连续失败 ≥ minFails 且 最后失败距今 ≥ minAgeMs** 才 alert。
 * 状态缺失 / 坏 JSON / consecutiveFailures 不是有限数 ⇒ "无法判定",一律不喊
 * (绝不因为"状态文件不存在"喊人;恢复成功后计数归零,同样不喊)。
 */
export function shouldAlertAlignStall(state, nowMs, cfg = {}) {
  const { minFails, minAgeMs } = alignStallThresholds(cfg)
  if (
    !state ||
    typeof state !== 'object' ||
    Array.isArray(state) ||
    !Number.isFinite(state.consecutiveFailures)
  ) {
    return { alert: false, reason: '状态缺失或不可读(无法判定 ⇒ 不喊)', fails: null, ageMs: null }
  }
  const fails = state.consecutiveFailures
  if (fails < minFails) {
    return { alert: false, reason: `连续失败 ${fails} 次 < 阈值 ${minFails}`, fails, ageMs: null }
  }
  if (!Number.isFinite(state.lastFailAt)) {
    return { alert: false, reason: 'lastFailAt 缺失(无法判定 ⇒ 不喊)', fails, ageMs: null }
  }
  const ageMs = nowMs - state.lastFailAt
  if (ageMs < minAgeMs) {
    return {
      alert: false,
      reason: `最后失败距今 ${Math.round(ageMs / 1000)}s < 阈值 ${minAgeMs}ms`,
      fails,
      ageMs,
    }
  }
  return {
    alert: true,
    reason: `连续失败 ${fails} 次且 ${Math.round(ageMs / 60000)} 分钟未恢复`,
    fails,
    ageMs,
  }
}

/**
 * 每轮 tick 的收尾对齐停摆检查。notify 出口可注入(镜像测试用假派发器断言参数,
 * 绝不在测试里真发邮件);检查层自身任何异常只降级为一行日志,不改守护自愈与退出码。
 * detail 里的数字(次数/分钟)会被 alertFingerprint 归一为 '#' ⇒ 停摆期间同指纹,
 * 由 notifyGuardRed 的 4h 窗口压住重复轰炸;恢复后计数归零,自然不再触发。
 */
export function checkConvergeAlignStall(opts = {}) {
  const {
    now = Date.now(),
    statePath = CONVERGE_ALIGN_STATE,
    notify = notifyGuardRed,
    cfg = {},
  } = opts
  try {
    let state = null
    try {
      state = JSON.parse(readFileSync(statePath, 'utf8'))
    } catch {
      return { alert: false, reason: '状态文件读不到/坏 JSON ⇒ 无法判定,不喊' }
    }
    const d = shouldAlertAlignStall(state, now, cfg)
    if (!d.alert) return d
    const detail =
      `收敛器收尾对齐(git-sync-converge → heal-worktree-tracked --align-drift)连续失败 ${d.fails} 次,` +
      `已 ${Math.round((d.ageMs ?? 0) / 60000)} 分钟未恢复。长期失败意味着工作区持续落后 HEAD(§12d 静默回滚温床)。\n` +
      `最后失败时间: ${new Date(state.lastFailAt).toISOString()}\n` +
      `rc/真因(收敛器 alignFailureNote 原文): ${String(state.lastNote ?? '(无)').slice(0, 200)}\n` +
      `状态文件: ${statePath}\n` +
      // 出口 1(§5e-1):此前这一格**连尺子命令都没给**,只给一个状态文件路径 ——
      // 比"手动:xxx"还退一档,收信人拿到信完全无从下手。补两条真能用的:
      // ① 只读复现对齐器这一格;② 真跑收敛(它自身幂等,失败会留 note)。
      `出路:node scripts/git-sync-converge.mjs --status(只读看对齐状态) / node scripts/git-sync-converge.mjs(跑一轮收敛,幂等)`
    notify('converge-align-stall', detail, {
      // dedupKey(§5e-1 配套,6 封):正文含 `已 N 分钟未恢复` 与失败时刻,逐轮变。
      // 身份取"失败次数分档 + 真因类别"—— 次数**分档**而非原值:1→9 是同一故障持续,
      // 归一后的稳定指纹把它压成同一身份(这是对的),但要保证"档位跃升"能重报。
      dedupKey: `align-stall;fails=${Math.min(Number(d.fails) || 0, 9)}`,
    })
    return d
  } catch (e) {
    log(
      `⚠️ 收敛对齐停摆检查自身异常(已忽略,不影响自愈): ${String((e && e.message) || e).slice(0, 160)}`,
    )
    return { alert: false, reason: '检查异常(已吞)' }
  }
}

/**
 * 受管 `.env` 的「键值被悄悄清空」巡检 + 到人(2026-09-26 立,PLAN G-223 第三格)。
 *
 * 为什么挂在这里(而不是提交链):这一格判的是**机器状态** —— 这台机上的 .env 此刻有没有被
 * 悄悄清空。挂进 pre-commit blocking 就是一台与任何提交都无关的恒红门,唯一结局是逼人
 * `--no-verify`、连带废掉全部守门(AGENTS §12e / §4 记过多次同型);挂 warn 又等于没人看。
 * 本守护每 2 分钟一趟、已是全部自愈告警的唯一派发点(§5e),所以判据住在
 * `check-env-drift.mjs`,**到人**住在这里。
 *
 * 立因不是假想:2026-09-26 03:08 `apps/api/.env` 被一次整体替换清空 55 个键值(根 `./.env`
 * 那份 09-19 的过期镜像被按时间戳复制过来)。应用没崩(DATABASE_URL/JWT_SECRET 恰好非空),
 * 而唯一到人通道静默寄不出去 —— 症状只有去翻 deploy-loop.log 的人才看得见。
 *
 * 三态分流(与那把尺子的退出码同形,不许互相顶掉):
 *   exit 1 键值漂移   ⇒ log ❌ + notifyGuardRed(严重:凭据面)
 *   exit 2 未判定     ⇒ log ❓ + notifyGuardRed(另立 alert 身份,窗口各自去重;
 *                       "现文件没了 / 从没落过备份"都是这一档 —— 绝不静默,也绝不冒充"漂移")
 *   exit 0 全部可判且零漂移 ⇒ 不写日志(健康轮次保持安静,与其余 heal* 层同一条约定)
 * 尺子本身坏了(输出不是 JSON / 派生失败)同样喊出来,并按 §12e 的方向给出手动出口。
 * run/notify/logger 全部可注入 —— 与 checkConvergeAlignStall 同一套取证形状(§22c:镜像测试
 * 直接 import 本函数,用假派发器断言"哪种结论发哪种 alert",绝不在测试里真发信)。
 */
export function auditEnvDrift(opts = {}) {
  const { notify = notifyGuardRed, run = runEnvDriftProbe, logger = log } = opts
  const probe = run()
  if (probe.missing) {
    // 判据被摘线的形态必须能被发现:尺子不在位 ≠ 一切正常(守门 70/76/81 同型)。
    // 两个文件都是被跟踪的,任何检出都该同时在场 ⇒ 这一档不是"机器态",不享受静默未判定。
    logger('⚠️ .env 漂移巡检没装车:scripts/check-env-drift.mjs 不在这台机上 ⇒ 这一格当前无人看守')
    notify(
      '.env 漂移巡检没装车(尺子文件不在这台机上)',
      'check-env-drift.mjs 不存在或被删 ⇒ 这一格当前无人看守,而账面看起来"什么都没发生"。',
    )
    return { state: 'not-installed' }
  }
  let parsed = null
  try {
    parsed = JSON.parse(probe.stdout)
  } catch {
    parsed = null
  }
  if (!parsed || !Array.isArray(parsed.verdicts)) {
    logger(
      `⚠️ .env 漂移巡检不可判定(exit ${probe.code},输出不是可解析 JSON)⇒ 手动:node scripts/check-env-drift.mjs`,
    )
    notify(
      '.env 漂移巡检不可判定(尺子输出不是 JSON)',
      `派生 exit ${probe.code} 而 stdout 不可解析 ⇒ 判据本身坏了,不得当作"已通过"。` +
        `\nstdout 前 400 字符:${String(probe.stdout || '').slice(0, 400)}\n手动:node scripts/check-env-drift.mjs`,
    )
    return { state: 'unreadable', code: probe.code }
  }
  const c = parsed.counts || {}
  if (Number(c.drift || 0) > 0) {
    logger(
      `❌ 受管 .env 检出键值漂移:${parsed.verdicts
        .filter((v) => v.state === 'drift')
        .map((v) => `${v.id}(${v.drift.length} 键)`)
        .join(', ')}`,
    )
    notify('.env 键值漂移(有键从非空变成空/整键缺失)', envDriftDetail(parsed, '漂移'), {
      severity: 'critical',
    })
    return { state: 'drift', counts: c }
  }
  if (Number(c.undetermined || 0) > 0) {
    logger(
      `❓ 受管 .env 巡检未判定:${parsed.verdicts
        .filter((v) => v.state === 'undetermined')
        .map((v) => v.id)
        .join(', ')}(不记为通过)`,
    )
    notify('.env 漂移巡检未判定(现文件缺失或无同目标备份可比)', envDriftDetail(parsed, '未判定'))
    return { state: 'undetermined', counts: c }
  }
  if (Number(probe.code) !== 0) {
    logger(
      `⚠️ .env 漂移巡检退出码与结论不符(exit ${probe.code} 却零漂移零未判定)⇒ 尺子坏了,手动:node scripts/check-env-drift.mjs`,
    )
    notify('.env 漂移巡检自身异常(退出码与结论不符)', envDriftDetail(parsed, '结论与退出码矛盾'))
    return { state: 'inconsistent', code: probe.code }
  }
  return { state: 'clean', counts: c }
}

/** 派生那把尺子的唯一出口(可被测试整层替换):只读、带超时、不带控制台窗(§5b / 守门 52·80)。 */
function runEnvDriftProbe() {
  const script = join(dirname(fileURLToPath(import.meta.url)), 'check-env-drift.mjs')
  if (!existsSync(script)) return { missing: true, code: 2, stdout: '' }
  try {
    const stdout = String(
      execFileSync(process.execPath, [script, '--check', '--json'], {
        cwd: WORKTREE,
        encoding: 'utf8',
        windowsHide: true, // §5b:漏此参数在计划任务/守护下必弹控制台窗
        timeout: 60000, // 守门 80:热路径派生一律带上限,挂死不拖垮整轮巡检
        maxBuffer: 1 << 22,
        stdio: ['ignore', 'pipe', 'ignore'],
      }) || '',
    )
    return { code: 0, stdout }
  } catch (e) {
    return { code: typeof e.status === 'number' ? e.status : 2, stdout: String(e.stdout || '') }
  }
}

/**
 * 告警正文的唯一拼装处。**只写键名与所用对照面的文件名/mtime**,一个值都不写(§5d)。
 * 数字会被 alertFingerprint 归一为 '#',所以同一次清空在多轮 tick 里同指纹(4h 窗口压住重复),
 * 而"又漂了一个新键"是指纹变化 ⇒ 立即重报,不会被上一条同因告警挡住。
 */
function envDriftDetail(parsed, kindLabel) {
  const lines = [
    `判定面:${parsed.face || '磁盘运行态'}`,
    `备份目录:${parsed.backupDir || '(未知)'}`,
  ]
  for (const v of parsed.verdicts || []) {
    if (v.state === 'drift') {
      const b = v.backup
        ? `对照=${v.backup.name}@${new Date(v.backup.mtimeMs).toISOString()}`
        : '对照=(无)'
      lines.push(
        `[漂移] ${v.id}(${b})\n  ${v.drift.map((d) => `${d.key}=${d.kind === 'missing' ? '整键缺失' : '值为空'}`).join('、')}`,
      )
    } else if (v.state === 'undetermined') {
      lines.push(`[未判定] ${v.id} —— ${v.reason};现文件:${v.currentPath}`)
    } else if (v.state === 'registered-only') {
      lines.push(`[登记不判] ${v.id} —— ${v.reason}`)
    }
  }
  const c = parsed.counts || {}
  return (
    `${kindLabel}:受管 .env 的目标 ${c.targets ?? 0} 个中,漂移 ${c.drift ?? 0} 个(键合计 ${c.driftKeys ?? 0})、` +
    `未判定 ${c.undetermined ?? 0} 个、登记不判 ${c.registeredOnly ?? 0} 个。\n` +
    `${lines.join('\n')}\n` +
    '这是"键从非空变成空/整键消失"的对账(判机器状态,不判提交内容);本信不含任何凭据值,只列键名。\n' +
    '手动复核:node scripts/check-env-drift.mjs(或 --verbose 追加每个键在备份里的值长度)。'
  )
}
/**
 * 追加型运行日志的保留期回收(机制对标 ZCode desktop 的 logRetention:双上限 + 稳定窗 + 留痕)。
 *
 * 实测动因:`.workbuddy/hook-logs/pre-commit.log` 现读 93,344,342 B、`.workbuddy/git-guardian.log`
 * 13,610,246 B,两处都只有追加没有死亡;全仓此前只有 `deploy/win/ihui-deploy-loop.ps1` 一处轮转
 * (53MB 事故后加的),即"同类日志各自腐烂"。
 *
 * 挂点必须在**健康轮次的早退之前、且带 !CHECK_ONLY** —— 与 healWorktreeTracked / healRootSeal
 * 同一格(本文件已两次踩过"挂进 CHECK_ONLY 路径等于永不执行")。
 * 为什么不在钩子内自己滚:钩子日志是 `hook-run-hidden.vbs` 用 `cmd … >> log` 打开句柄后才启动
 * node 的,node 改名自己正被追加的文件必撞 Windows 共享冲突;巡检撞上了也只是本轮跳过。
 */
function rotateRunLogs() {
  const targets = [LOG, join(WORKTREE, '.workbuddy', 'hook-logs', 'pre-commit.log')]
  const hookDir = join(WORKTREE, '.workbuddy', 'hook-logs')
  try {
    for (const n of readdirSync(hookDir)) {
      if (!n.endsWith('.log')) continue
      const p = join(hookDir, n)
      if (!targets.includes(p)) targets.push(p)
    }
  } catch {
    // 目录不存在 = 还没人写过,不是故障;如实喊一行,免得"没清"和"清完了"长得一样。
    log('ℹ️ 运行日志回收:未找到 hook-logs 目录,本轮跳过')
  }
  let touched = 0
  for (const p of targets) {
    const r = rotateAppendLog(p)
    if (r.rotated) {
      touched += 1
      log(`✅ 运行日志回收:已归档 ${basename(p)} → ${basename(String(r.movedTo))}${r.removed.length ? ` / 删最旧 ${r.removed.length} 份` : ''}`)
    }
    if (r.failed) {
      // 失败必须响:静默失败的表现永远是"看起来只是没到量"
      log(`⚠️ 运行日志回收失败:${r.path} —— ${r.failed}`)
    }
  }
  if (touched === 0) return
  log(`ℹ️ 运行日志回收本轮动了 ${touched} 个文件(其余按尺寸/稳定窗判定为无需动作)`)
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
 * 公网路径与换流窗口的**常驻**探测派发点(台账票 G-301;尺子本体 = `scripts/check-public-path-probe.mjs`)。
 *
 * 为什么挂在这里而不是新建计划任务:该机有明令"注册计划任务属影响全机的自动动作,须机主授权",
 * 而本守护已经是全部运维告警的派发点(每 2 分钟一趟、自身分层自愈、已升 S4U)。
 * 挂点语义与 healWorktreeTracked / watchWatchdog 同一条:**健康轮次的早退之前 + `!CHECK_ONLY`** ——
 * 挂进 CHECK_ONLY 分支等于永不执行(本文件已两次踩过,见上方注释)。
 *
 * 三条不可漂的写法:
 *  ① **节流而非封量**:两次真实探测之间隔 `PUBLIC_PROBE_INTERVAL_MS`(默认 30 分钟),
 *     这是"别每 2 分钟打一次公网"的**节奏**控制,**不是**每日封顶 —— §5e 写死了
 *     "第三方额度是别人的配额,自设上限等于把告警静默再复制一遍"。
 *  ② 告警一律经 `notifyGuardRed()`:按 alert 身份 + 内容指纹去重、失败写 UNDELIVERED 标记、
 *     **不在此文件自拼 SMTP/Resend**(守门 81 硬拦的就是这个)。
 *  ③ 判"未判定"与"没跑到"**不得静默**:尺子 exit 3 或 JSON 取不到时只写日志、不发信 ——
 *     发一封"我什么都没量到"的邮件是把噪音冒充成告警;但日志必须点名原因,不得沉默。
 */
const PUBLIC_PROBE_TICK = join(WORKTREE, '.workbuddy', 'public-path-probe-tick.ts')
const PUBLIC_PROBE_LAST = join(WORKTREE, '.workbuddy', 'public-path-probe-last.json')
const PUBLIC_PROBE_INTERVAL_MS = Number(process.env.IHUI_PUBLIC_PROBE_INTERVAL_MS || 30 * 60 * 1000)
/** 尺子最坏墙钟:90 次公网 × 上限 15s 的极端不可能全中,但一次守护不能被网络拖死 ⇒ 硬超时 */
const PUBLIC_PROBE_TIMEOUT_MS = Number(process.env.IHUI_PUBLIC_PROBE_TIMEOUT_MS || 240_000)
/**
 * 元运维巡检节流:尺子要开 PowerShell 问服务/任务/时钟,还要走一遍 Temp(4.8 万条目),
 * 2 分钟一轮太贵、每天一轮又兜不住"环停了 3 小时"这一型 ⇒ 15 分钟。
 * 两个执行体(2 分钟计划任务 + 常驻 daemon)**共用这一个戳**,谁先到谁干活。
 */
const OPS_PATROL_TICK = join(WORKTREE, '.workbuddy', 'ops-patrol-tick.ts')
const SERVICE_HEAL_INTERVAL_MS = Number(process.env.IHUI_SERVICE_HEAL_INTERVAL_MS || 30 * 60 * 1000)
const SERVICE_HEAL_TIMEOUT_MS = Number(process.env.IHUI_SERVICE_HEAL_TIMEOUT_MS || 420_000)

/**
 * 不响应服务的自愈派发点(动作器 = `scripts/heal-unresponsive-services.mjs`,白名单台账在
 * `scripts/data/service-auto-restart.json`)。三层重启方案的第三层,2026-10-01 机主拍板(台账 G-978121)。
 *
 * 为什么这一层只能挂在这里、且必须挂两次调用点之一都不行:本机 22 个服务里 21 个是 nssm 包装的,
 * SCM 的恢复动作对它们**结构上不会触发**(死的是子进程,nssm.exe 自己还活着 ⇒ 服务永远 Running);
 * nssm 的退出重启又只覆盖"子进程退出"那一型。真实发生过的两次事故 —— 路径烂掉导致子进程根本起不来
 * (RSSHub 静默停 3 天)、进程在而端口不应答 —— 两种都表现为"Running + 不通",没有任何日志行会红。
 * "判某件事没发生"的尺子按设计不能进提交链(判机器状态 ⇒ 每台每次被逼 --no-verify,连带全部守门作废),
 * 所以唯一调度器就是这个守护。
 *
 * 三条不可漂的执行细节(与 auditOpsPatrol 同规矩):
 *  - 节流戳与 `--apply` 一起交给动作器;它内部还另有每台冷却与全局窗口上限(防重启风暴);
 *  - **未判定只写日志不喊人**,但必须报名(取不到报告 ⇒ exit 2,不是"都没事");
 *  - 真重启过或重启失败才发信,沿用"身份 + 内容指纹 4h 去重、无总量封顶"。
 */
export function healUnresponsiveServices(opts = {}) {
  const {
    now = Date.now(),
    intervalMs = SERVICE_HEAL_INTERVAL_MS,
    tickFile = join(WORKTREE, '.workbuddy', 'service-heal-tick.iso'),
    logger = log,
    notify = notifyGuardRed,
    runner = null,
  } = opts
  const script = join(dirname(fileURLToPath(import.meta.url)), 'heal-unresponsive-services.mjs')
  if (!existsSync(script)) {
    logger('ℹ️ 服务自愈:动作器不在位(scripts/heal-unresponsive-services.mjs)⇒ 本轮跳过,不记为已巡检')
    return { ran: false, why: '动作器不在位' }
  }
  let lastTick = NaN
  try {
    lastTick = Date.parse(String(readFileSync(tickFile, 'utf8')).trim())
  } catch {
    /* 没跑过 */
  }
  if (!publicProbeDue(now, lastTick, intervalMs)) return { ran: false, why: '未到节流窗口' }
  try {
    mkdirSync(dirname(tickFile), { recursive: true })
    writeFileSync(tickFile, new Date(now).toISOString(), 'utf8')
    const call =
      runner ||
      (() => {
        try {
          const stdout = execFileSync(process.execPath, [script, '--json', '--apply'], {
            cwd: WORKTREE,
            windowsHide: true, // §5b:漏此参数在计划任务/守护下必弹控制台窗
            timeout: SERVICE_HEAL_TIMEOUT_MS, // 守门 80:热路径派生一律带上限
            maxBuffer: 1 << 22,
            stdio: ['ignore', 'pipe', 'pipe'],
            encoding: 'utf8',
          })
          return { status: 0, stdout: String(stdout || ''), stderr: '' }
        } catch (e) {
          return { status: typeof e.status === 'number' ? e.status : 2, stdout: String(e.stdout || ''), stderr: String(e.stderr || e.message || '') }
        }
      })
    const r = call()
    let parsed = null
    try {
      parsed = JSON.parse(String(r.stdout || ''))
    } catch {
      /* 落到下面的未判定分支 */
    }
    if (!parsed || !parsed.counts) {
      logger(`⚠️ 服务自愈未拿到可解析结论(rc=${r.status}):${([r.stderr, r.stdout].filter(Boolean).join(' ⊕ ') || '(无输出)').split(/\r?\n/).slice(0, 2).join(' | ')}`)
      return { ran: true, ok: false, why: '结论不可解析' }
    }
    const c = parsed.counts
    const acted = (parsed.results || []).filter((x) => String(x.kind).startsWith('restarted'))
    const failed = (parsed.results || []).filter((x) => x.kind === 'restart-failed')
    if (acted.length > 0 || failed.length > 0) {
      const body = [...acted, ...failed].map((x) => `· ${x.name} ${x.kind} — ${x.why}`).join('\n')
      notify(
        `服务自愈动作(${acted.length} 拉起 / ${failed.length} 失败)`,
        `${body}\n\n在册 ${c.checked ?? '?'} 台:应答 ${c.answering ?? '?'} / 未判定 ${c.undetermined ?? '?'} / 观察 ${c.watch ?? '?'} / 冷却 ${c.cooldown ?? '?'} / 窗口封顶 ${c.capped ?? '?'}\n手动复现:node scripts/heal-unresponsive-services.mjs(只读)`,
        { alertName: `service-heal-${acted.map((x) => x.name).join(',') || 'fail'}` },
      )
    }
    if (c.undetermined > 0 || c.planned > 0) {
      logger(`ℹ️ 服务自愈:未判定 ${c.undetermined ?? 0} 台 / 计划未执行 ${c.planned ?? 0} 台(只读档才会留在"计划";只写日志不喊人)`)
    }
    logger(`✅ 服务自愈:在册 ${c.checked ?? 0} 台,应答 ${c.answering ?? 0},拉起 ${acted.length},失败 ${failed.length}`)
    return { ran: true, ok: failed.length === 0, checked: c.checked, acted: acted.length, failed: failed.length, undetermined: c.undetermined ?? 0 }
  } catch (e) {
    logger(`⚠️ 服务自愈异常:${String(e?.message || e).slice(0, 200)}`)
    return { ran: true, ok: false, why: String(e?.message || e) }
  }
}

const OPS_PATROL_INTERVAL_MS = Number(process.env.IHUI_OPS_PATROL_INTERVAL_MS || 15 * 60 * 1000)
const OPS_PATROL_TIMEOUT_MS = Number(process.env.IHUI_OPS_PATROL_TIMEOUT_MS || 180_000)

/** 节流判定(纯函数):距上次派发是否已够一个间隔。取不到 tick 文件 ⇒ 视为**该跑了**。 */
export function publicProbeDue(nowMs, tickMs, intervalMs = PUBLIC_PROBE_INTERVAL_MS) {
  if (!Number.isFinite(tickMs)) return true
  return nowMs - tickMs >= intervalMs
}

/**
 * 元运维巡检的**常驻**派发点(尺子本体 = `scripts/check-ops-patrol.mjs`)。
 *
 * 为什么必须挂在这里:这把尺子判的是"某件事**没有发生**"(任务消失、规则没上岗、运行副本漂了、
 * 时钟 13 小时没同步、备份不产出、异地那条腿的同步客户端根本没开)。这类故障不产生任何一行错误日志,
 * 而它按设计**不能进提交链** —— 判据落在机器状态上,提交者结构上满足不了,挂 blocking 就是每台每次
 * 被逼 `--no-verify`、连带链上全部守门对该提交作废(§12e/§12f)。"留作手动问责"的实际含义是
 * **只有人在跑、没有班次在跑**,而本仓对这一型的名字就叫"造好没装车"。本守护是唯一的调度器。
 *
 * 2026-09-29 实录(本条目自身被这一型咬过,故把教训写在装它的函数头上):本派发点曾于
 * `2dfb456fce` 装好并实测发信成功,一小时内被并发提交 `a3ad07092f`(一枚"扫码死链修复")
 * **按旧基线整份写回** `git-guardian.mjs` 而抹掉(净删 1552 行)—— 尺子还在、判据还对、
 * 账面全绿,而它已经无人调度。镜像测试 T1/T2/T4 就是为抓住这一次而存在的。
 *
 * 三个执行体细节,漏一个都会变成"看起来在跑":
 * - 节流戳与 `--apply` **两个执行体共用**:谁先到谁干活,同窗口内另一个直接跳过;
 * - 红经 `notifyGuardRed` 走邮件,沿用"身份 + 内容指纹 4h 去重",无总量封顶;
 * - 未判定**只写日志不喊人**(与 auditPublicPathProbe 同规矩),但必须报名。
 */
export function auditOpsPatrol(opts = {}) {
  const {
    now = Date.now(),
    intervalMs = OPS_PATROL_INTERVAL_MS,
    tickFile = OPS_PATROL_TICK,
    logger = log,
    notify = notifyGuardRed,
    runner = null,
  } = opts
  const script = join(dirname(fileURLToPath(import.meta.url)), 'check-ops-patrol.mjs')
  if (!existsSync(script)) {
    logger('ℹ️ 元运维巡检:尺子脚本不在位(scripts/check-ops-patrol.mjs)⇒ 本轮跳过,不记为已巡检')
    return { ran: false, why: '尺子脚本不在位' }
  }
  let lastTick = NaN
  try {
    lastTick = Date.parse(String(readFileSync(tickFile, 'utf8')).trim())
  } catch {
    /* 没跑过 */
  }
  if (Number.isFinite(lastTick) && now - lastTick < intervalMs) return { ran: false, why: '未到节流窗口' }
  try {
    mkdirSync(dirname(tickFile), { recursive: true })
    writeFileSync(tickFile, new Date(now).toISOString(), 'utf8')
    const call =
      runner ||
      (() => {
        try {
          const stdout = execFileSync(process.execPath, [script, '--json', '--apply'], {
            cwd: WORKTREE,
            windowsHide: true, // §5b:漏此参数在计划任务/守护下必弹控制台窗
            timeout: OPS_PATROL_TIMEOUT_MS, // 守门 80:热路径派生一律带上限
            maxBuffer: 1 << 22,
            stdio: ['ignore', 'pipe', 'pipe'],
            encoding: 'utf8',
          })
          return { status: 0, stdout: String(stdout || ''), stderr: '' }
        } catch (e) {
          return { status: typeof e.status === 'number' ? e.status : 2, stdout: String(e.stdout || ''), stderr: String(e.stderr || e.message || '') }
        }
      })
    const r = call()
    let parsed = null
    try {
      parsed = JSON.parse(String(r.stdout || ''))
    } catch {
      /* 落到下面的未判定分支 */
    }
    if (!parsed || !parsed.counts) {
      logger(`⚠️ 元运维巡检未拿到可解析结论(rc=${r.status}):${([r.stderr, r.stdout].filter(Boolean).join(' ⊕ ') || '(无输出)').split(/\r?\n/).slice(0, 2).join(' | ')}`)
      return { ran: true, ok: false, why: '结论不可解析' }
    }
    const findings = parsed.findings || []
    const undet = parsed.undetermined || []
    if (undet.length) logger(`ℹ️ 元运维巡检:${undet.length} 格未判定(只登记不喊人)—— ${undet.map((x) => x.id).join(', ')}`)
    if (findings.length) {
      const body = findings.map((x) => `· ${x.id} ${x.detail}`).join('\n')
      logger(`❌ 元运维巡检判红 ${findings.length} 格:\n${body}`)
      notify(
        `元运维巡检红(${findings.length} 格)`,
        `${body}\n\n手动复现:node scripts/check-ops-patrol.mjs(只读) / --apply(顺手修可修的)`,
        {
          severity: 'warning',
          // dedupKey(§5e-1 配套,24 封):聚合告警的正文是**逐格 detail 清单**,而每格 detail
          // 都含实时读数(条目数 67595、时钟距今 N 小时)⇒ 指纹逐轮变 ⇒ 窗口失效。
          // 身份只取"哪几格红了"(集合,有序无关),实时读数仍进正文。
          dedupKey: `cells=${findings.map((x) => x.id).sort().join('+')}`,
        },
      )
    } else {
      logger(`✅ 元运维巡检:${parsed.counts.ok} 格绿,无红(${undet.length} 格未判定)`)
    }
    return { ran: true, ok: true, findings: findings.length, undetermined: undet.length }
  } catch (e) {
    // 派发点自身异常不得改守护退出码(与 auditPublicPathProbe 同一条禁令):巡检失败不等于 .git 失败。
    logger(`⚠️ 元运维巡检派发异常(忽略,不影响本轮自愈):${e?.message || e}`)
    return { ran: true, ok: false, why: String(e?.message || e) }
  }
}

export function auditPublicPathProbe(opts = {}) {
  const {
    now = Date.now(),
    intervalMs = PUBLIC_PROBE_INTERVAL_MS,
    tickFile = PUBLIC_PROBE_TICK,
    lastFile = PUBLIC_PROBE_LAST,
    logger = log,
    notify = notifyGuardRed,
    runner = null,
  } = opts
  const script = join(dirname(fileURLToPath(import.meta.url)), 'check-public-path-probe.mjs')
  if (!existsSync(script)) {
    logger('ℹ️ 公网路径探测:尺子脚本不在位(scripts/check-public-path-probe.mjs)⇒ 本轮跳过,不记为已探测')
    return { ran: false, why: '尺子脚本不在位' }
  }
  let lastTick = NaN
  try {
    lastTick = Date.parse(String(readFileSync(tickFile, 'utf8')).trim())
  } catch {
    /* 没跑过 */
  }
  if (!publicProbeDue(now, lastTick, intervalMs)) return { ran: false, why: '未到节流窗口' }
  try {
    mkdirSync(dirname(tickFile), { recursive: true })
    writeFileSync(tickFile, new Date(now).toISOString(), 'utf8')
    // 判序(2026-10-03 补修,此前是本仓**唯一没修**的一处同型):`runner || (iife())` 在
    // 传入函数时会让 `call` **等于那个函数本身**(短路掉调用),而不是它的返回值 ——
    // 于是 `readProbeVerdict(call)` 读到 `status=undefined`,恒报「探针未产出 stdout」。
    // 本函数 2751 行的注释早就写明了这个坑并点名「auditPublicPathProbe 此刻就是这一型」,
    // 但只修了同族的 checkBaselineFreshness,这一处漏了;它此前无镜像测试 ⇒ 一直没暴露。
    // 镜像测试补上后立刻撞红(2026-10-03),按同族正确写法改成"显式注入优先调用"。
    const call =
      typeof runner === 'function'
        ? runner()
        : (() => {
            try {
              const out = execFileSync(process.execPath, [script, '--burst', '--sequence', 'both', '--json'], {
                cwd: WORKTREE,
                encoding: 'utf8',
                windowsHide: true, // §5b:漏此参数在计划任务/守护下必弹控制台窗
                timeout: PUBLIC_PROBE_TIMEOUT_MS, // 守门 80:热路径派生一律带上限
                maxBuffer: 1 << 22,
                stdio: ['ignore', 'pipe', 'pipe'],
              })
              return { status: 0, stdout: String(out || ''), stderr: '' }
            } catch (e) {
              return {
                status: typeof e.status === 'number' ? e.status : 2,
                stdout: String(e.stdout || ''),
                stderr: String(e.stderr || e.message || ''),
              }
            }
          })()
    const v = readProbeVerdict(call)
    if (!v.parsed) {
      // 只写日志不发信:没量到 ≠ 出事了(§5e 的"失败必须响"针对的是**投递失败**,不是"没跑")
      logger(`⚠️ 公网路径探测未产出结论(未判定,不记为已探测):${v.why}`)
      return { ran: true, judged: false, why: v.why }
    }
    const results = v.parsed.results && typeof v.parsed.results === 'object' ? v.parsed.results : {}
    try {
      mkdirSync(dirname(lastFile), { recursive: true })
      writeFileSync(lastFile, JSON.stringify({ at: new Date(now).toISOString(), rc: v.parsed.rc, results }, null, 1), 'utf8')
    } catch {
      /* 状态件写不掉只影响 --status 的可见性,不影响告警本身 */
    }
    let breaches = 0
    let unjudged = 0
    for (const [key, r] of Object.entries(results)) {
      const verdict = String(r?.verdict || '')
      const reasons = Array.isArray(r?.reasons) ? r.reasons : []
      if (verdict === 'breach') {
        breaches += 1
        // alert 身份**按序列+目标分开**:A(换流窗口)与 B(常态公网)是两个不同的故障,
        // 合并成一个身份会让先响的那条把后响的那条压掉 —— 正是票面禁止的"互相掩盖"。
        //
        // **B/本地 这一格不得用「公网路径探测」的名义到人(2026-10-03 立,28 封审计)**。
        // 尺子头注(:769)自己写明「公网是被测对象,本地是对照组」;对照组失真 = 本机服务
        // 没起(实测那 16 封报的是 `127.0.0.1:8801` connRefused,而 8801 = Web/IHUI-WEB,
        // 由 `heal-unresponsive-services.mjs` 那层负责),**与公网可用性无关**。
        // 收信人读着"公网探测越阈值"去查公网永远查不到 ⇒ 这一格是"告的不是信里说的那件事",
        // 属 §5e-1 答不上来就不许挂。正解:本地组只进日志(它是对照组的自检面,不是故障面),
        // 真故障(本机服务没起)归服务自愈层 —— 那层若自己坏了(`check-service-binary-paths`
        // rc=2 派生失败)该修的是它,不是让公网判据替它喊人。
        if (key.includes('本地')) {
          logger(
            `⚠️ 公网探测对照组失真(${key}):${String(r?.numbers || '').slice(0, 160)} —— 本地服务未起,不按公网故障到人(§5e-1);真故障归服务自愈层`,
          )
          continue
        }
        notify(
          `公网路径探测越阈值:${key}`,
          `${String(r?.numbers || '(无读数控)')}\n${reasons.join('\n')}\n` +
            `尺子:scripts/check-public-path-probe.mjs 序列 ${key}。取证回读:node scripts/check-public-path-probe.mjs --report .ihui-agent/tmp/probers/public-path-burst.jsonl\n` +
            // 出口 1(§5e-1):必须给可执行下一步,只给"取证回读"是把同一条结论再念一遍。
            `出路:先用 --report 确认是**目标端**慢/失败(而非探针机抖动);目标真不可用时查该服务自身健康` +
            `(本机 web/api/ai-service 由 heal-unresponsive-services 自愈;外部目标查其服务端与链路)。`,
          {
            severity: 'warning',
            // dedupKey(§5e-1 配套):numbers 里 `最长连续不可用 13.5s` 这类**带小数点**的值,
            // 数字归一 `\d+ → #` 吃不掉小数点 ⇒ 13s 与 13.5s 撞成两个身份,4 小时窗口被绕成虚设
            // (实测 B/公网 12 封里 7 个间隔短于 4h,最短 0.53h = 两倍 30 分钟节流 = 刚跑完又寄)。
            // 身份只取"序列 + 结论",实时读数仍进正文。
            dedupKey: `seq=${key};verdict=${verdict}`,
          },
        )
      } else if (verdict === 'unjudged') {
        unjudged += 1
        logger(`ℹ️ 公网路径探测 ${key}:未判定 —— ${reasons.join(' | ') || '(无原因)'}`)
      }
    }
    if (breaches === 0 && unjudged === 0) logger('✅ 公网路径探测:已判定且未越阈值(A/B 两条序列各自的结论见 .workbuddy/public-path-probe-last.json)')
    return { ran: true, judged: true, breaches, unjudged }
  } catch (e) {
    logger('⚠️ 公网路径探测派发失败(不阻断其余守护): ' + String((e && e.message) || e).slice(0, 160))
    return { ran: false, why: '派发异常' }
  }
}

/**
 * 孤儿删除引用巡检的**常驻**派发点(尺子本体 = `scripts/check-orphan-deletion-refs.mjs`)。
 *
 * 为什么必须挂在这里而不是"留作手动问责":这把尺子判的是**此刻索引与 HEAD 的错位**
 * (HEAD 有该路径、索引与磁盘都没有、而树内仍有源码 import 它)—— 它按设计不能进提交链
 * (与某次提交内容无关的 blocking 红 = 每台每次被逼 --no-verify,§12e/§12f),而"手动问责入口"
 * 的实际含义是**只有人在跑、没有班次在跑**:2026-09-29 现读该尺子的五个权威接线点零命中,
 * 而同一型缺陷(HEAD 有 / 索引与磁盘都无 / 源码仍 import)当晚已两次炸构建。挂本守护是
 * 唯一不改提交链、又保证每 30 分钟必有一次现读的落点。
 * 挂点语义与 healWorktreeTracked / auditPublicPathProbe 同一条:**健康轮次的早退之前 + `!CHECK_ONLY`**。
 *
 * 三条不可漂的写法(照抄 auditPublicPathProbe):
 *  ① **节流而非封量**:两次真实巡检之间隔 `ORPHAN_AUDIT_INTERVAL_MS`(默认 30 分钟)是节奏控制,
 *     不是每日封顶 —— §5e 明令不得自设总量上限把"告警静默"再复制一遍。
 *  ② 告警一律经 `notifyGuardRed()`:按 alert 身份 + 内容指纹去重,不在本文件自拼 SMTP(守门 81)。
 *  ③ **判"未判定"不得静默也不得喊人**:尺子 rc=2 / JSON 取不到 ⇒ 只写日志并点名原因 ——
 *     发一封"我什么都没量到"的信是把噪音冒充成告警;但日志必须报名,不得沉默成"跑过了"。
 */
const ORPHAN_AUDIT_TICK = join(WORKTREE, '.workbuddy', 'orphan-audit-tick.ts')
const ORPHAN_AUDIT_INTERVAL_MS = Number(process.env.IHUI_ORPHAN_AUDIT_INTERVAL_MS || 30 * 60 * 1000)
/** 尺子是纯只读 git 问答,正常 <1s;给 2 分钟硬上限只为"一次守护绝不被它拖死"(守门 80 同取向) */
const ORPHAN_AUDIT_TIMEOUT_MS = Number(process.env.IHUI_ORPHAN_AUDIT_TIMEOUT_MS || 120_000)

/** 节流判定(纯函数):距上次巡检是否已够一个间隔。取不到 tick 文件 ⇒ 视为**该跑了**。 */
export function orphanAuditDue(nowMs, tickMs, intervalMs = ORPHAN_AUDIT_INTERVAL_MS) {
  if (!Number.isFinite(tickMs)) return true
  return nowMs - tickMs >= intervalMs
}

export function auditOrphanDeletionRefs(opts = {}) {
  const {
    now = Date.now(),
    intervalMs = ORPHAN_AUDIT_INTERVAL_MS,
    tickFile = ORPHAN_AUDIT_TICK,
    logger = log,
    notify = notifyGuardRed,
    runner = null,
  } = opts
  const script = join(dirname(fileURLToPath(import.meta.url)), 'check-orphan-deletion-refs.mjs')
  if (!existsSync(script)) {
    logger(
      'ℹ️ 孤儿删除引用巡检:尺子脚本不在位(scripts/check-orphan-deletion-refs.mjs)⇒ 本轮跳过,不记为已巡检',
    )
    return { ran: false, why: '尺子脚本不在位' }
  }
  let lastTick = NaN
  try {
    lastTick = Date.parse(String(readFileSync(tickFile, 'utf8')).trim())
  } catch {
    /* 没跑过 */
  }
  if (!orphanAuditDue(now, lastTick, intervalMs)) return { ran: false, why: '未到节流窗口' }
  try {
    mkdirSync(dirname(tickFile), { recursive: true })
    writeFileSync(tickFile, new Date(now).toISOString(), 'utf8')
    // 注意判序:`runner || (iife())` 那种写法在传入了假 runner 时会让 `call` **等于函数本身**
    // (短路掉调用),而不是它的返回值 —— 本仓 auditPublicPathProbe 此刻就是这一型(无调用方所以未爆),
    // 本函数按"显式注入优先调用"写,镜像测试才能在不派生真进程的前提下取到三态。
    const call =
      typeof runner === 'function'
        ? runner()
        : (() => {
            try {
              const out = execFileSync(process.execPath, [script, '--json'], {
                cwd: WORKTREE,
                encoding: 'utf8',
                windowsHide: true, // §5b:漏此参数在计划任务/守护下必弹控制台窗
                timeout: ORPHAN_AUDIT_TIMEOUT_MS, // 守门 80:热路径派生一律带上限
                maxBuffer: 1 << 22,
                stdio: ['ignore', 'pipe', 'pipe'],
              })
              return { status: 0, stdout: String(out || ''), stderr: '' }
            } catch (e) {
              return {
                status: typeof e.status === 'number' ? e.status : 2,
                stdout: String(e.stdout || ''),
                stderr: String(e.stderr || e.message || ''),
              }
            }
          })()
    if (call.status === 2) {
      logger(
        `ℹ️ 孤儿删除引用巡检:未判定(尺子 rc=2,用法/环境错 —— ${String(call.stderr || '').slice(0, 120)})`,
      )
      return { ran: true, judged: false, why: '尺子 rc=2' }
    }
    let parsed = null
    try {
      parsed = JSON.parse(String(call.stdout || '').trim())
    } catch {
      parsed = null
    }
    if (!parsed || !Array.isArray(parsed.hits)) {
      logger(
        '⚠️ 孤儿删除引用巡检:输出取不到 JSON ⇒ 未判定,不记为已巡检(不得把"没解析出"写成"没有命中")',
      )
      return { ran: true, judged: false, why: 'JSON 取不到' }
    }
    const undet = Array.isArray(parsed.undetermined) ? parsed.undetermined : []
    if (parsed.hits.length) {
      const list = parsed.hits
        .slice(0, 12)
        .map(
          (h) =>
            `  · ${h && h.path ? h.path : '(无名)'} ← 仍被引用于 ${h && h.via ? h.via : '(出处未判定)'}`,
        )
        .join('\n')
      const more =
        parsed.hits.length > 12 ? `\n  …另有 ${parsed.hits.length - 12} 条,回读命令见下行` : ''
      notify(
        '孤儿删除引用巡检命中',
        `HEAD 树里还有这些路径,而索引与磁盘都没有它们,且源码仍 import 它们 ⇒ 任何一次干净检出/CI 构建都会 Module not found。\n${list}${more}\n\n尺子:node scripts/check-orphan-deletion-refs.mjs(只读;修法是把该文件补回索引,或改掉那处引用 —— 二者由该路径的持有人定)`,
        { severity: 'warning' },
      )
      logger(`❌ 孤儿删除引用巡检:命中 ${parsed.hits.length} 条(已派发到邮件通道)`)
    } else if (undet.length) {
      logger(
        `ℹ️ 孤儿删除引用巡检:零命中,但有 ${undet.length} 条未判定 —— ${undet.slice(0, 3).join(' | ')}`,
      )
    } else {
      logger('✅ 孤儿删除引用巡检:已判定且零命中')
    }
    return { ran: true, judged: true, hits: parsed.hits.length, undetermined: undet.length }
  } catch (e) {
    logger(
      '⚠️ 孤儿删除引用巡检派发失败(不阻断其余守护): ' + String((e && e.message) || e).slice(0, 160),
    )
    return { ran: false, why: '派发异常' }
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
    const ok = !!(healFromBackup() || healFromRemote())
    // 恢复源是整份 gitdir 副本 ⇒ cpSync 会把它自己的 core.bare 一起带回来,恢复后必须再归一一次
    if (ok && !worktreeUsable()) return healWorktreeBare()
    return ok
  }
  if (!before.pointerOk) healPointer()
  if (!gitUsable()) healEnv()
  if (!gitUsable()) healHead()
  if (!gitUsable()) {
    if (!archiveGitdir(Date.now())) return false
    const ok = !!(healFromBackup() || healFromRemote())
    if (ok && !worktreeUsable()) return healWorktreeBare()
    return ok
  }
  // git 可用 ≠ 工作树可用:core.bare=true 时 rev-parse 成功而每条工作树命令都失败;
  // 放在恢复阶梯之后跑,任何一次 cpSync 恢复带回来的裸档都在这里被归一(活仓库 + 恢复源两侧)
  if (!worktreeUsable()) healWorktreeBare()
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
    // 与 gitUsable 分开的第二把尺子:裸档(config.core.bare=true)下 rev-parse 照样成功,
    // 而工作树里每条 git 命令都失败 —— 只看 gitUsable 会把"仓库不可用"报成"一切正常"。
    worktreeUsable: worktreeUsable(),
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
    // core.bare 翻车现场审计的最近一份件名(null = 还没有件;含义与"没翻过"不同 ——
    // 该维自 BARE_AUDIT_SINCE 起才在位,逐条原因跑 --bare-audit-report 看)
    bareAudit: latestBareFlipAuditFile().file,
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
  // 单独点名"裸档"这一型:它让其余四项全绿,却是唯一让全队 git 命令失效的那一格
  const bareHint = h.gitUsable && h.worktreeUsable === false ? ' | core.bare=true(工作树不可用)' : ''
  return `⚠️ 检测到 .git 异常: pointer=${h.pointerOk} gitdir=${h.gitdirOk} git=${h.gitUsable} worktree=${h.worktreeUsable}${hint}${refsHint}${bareHint}`
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

/**
 * 把"探针跑出了结论"与"探针没跑起来"分成三态,退出码**不参与**前者判定:
 *  ① stdout 是可解析对象 ⇒ 采用结论,哪怕 rc=1;
 *  ② stdout 为空 ⇒ 未判定,并点名 rc 与 stderr;
 *  ③ stdout 有内容但不是 JSON / 顶层不是对象 ⇒ 未判定,同样点名 rc。
 *
 * 为什么 rc=1 必须走①:探针轴①②判红时 `process.exit(1)`,而结论整份在 stdout 的 JSON 里。
 * 旧实现只有成功分支能拿到 stdout(execFileSync 在非零退出时抛异常),于是守护每每逢它说出
 * 最响的一条结论,就把整块扔掉、并往日志写"账不可用:未判定"。实测(2026-09-27 现读):
 * 便宜档 rc=1 + stdout 1530 B 合法 JSON,其中 `upstream.status='red'`/`behind=3` ——
 * "本地落后主线 3 个提交"这条信号被这台守护结构上看不见,而它正是值守最该先看的一维。
 * 失效方向照旧是"多写一行未判定",绝不是"顺手当它绿了"。
 */
export function readProbeVerdict({ status, stdout, stderr } = {}) {
  const text = String(stdout ?? '')
  const rc = status ?? '?'
  if (text.trim() === '') {
    const errText = String(stderr ?? '')
      .replace(/\s+/g, ' ')
      .slice(0, 240)
    return { parsed: null, why: `探针未产出 stdout(rc=${rc} stderr=${errText || '(空)'})` }
  }
  try {
    const raw = JSON.parse(text)
    if (raw && typeof raw === 'object' && !Array.isArray(raw)) return { parsed: raw, why: null }
    return { parsed: null, why: `stdout 顶层不是对象(rc=${rc})` }
  } catch (e) {
    return {
      parsed: null,
      why: `输出不是 JSON(rc=${rc}):${String(e?.message ?? e).replace(/\s+/g, ' ').slice(0, 120)}`,
    }
  }
}

/**
 * 开工前基线新鲜度的**只报数**账(机制规格 MECHANISM-SPEC-2 §2 的守护侧挂点)。
 *
 * 三条刻意:
 *  ① **只 log 数字,不 notifyGuardRed、不改任何退出码、不改自愈语义。** ③轴(共享工作树相对 HEAD
 *     的漂移)量的是并行会话的未提交状态,**提交者结构上无法满足**;把它接进任何判定面就等于
 *     让每一次提交恒红 ⇒ 逼人 --no-verify ⇒ 全部守门作废(§12e/§4 反复登记的那一型)。
 *  ② 祖先比对是**逐文件 `git log`**(实测 56 个漂移路径约 8s),而本守护每 2 分钟一趟 ⇒ 不节流
 *     就是一台自造 fork 风暴的机器(§5b 的 24.6 万 cmd/2min 同型)。故 30 分钟才跑一次全账,
 *     间隔内走 `--skip-drift-analysis` 的便宜账(漂移面计数照报,旧基线子集不比对)。
 *  ③ 挂点在**健康轮次的早退之前**、且带 `!CHECK_ONLY`(写节流戳是副作用)。本仓已两次踩过
 *     "挂错位置 = 永不执行"(工作区自愈层、盘根封口层各一次)。
 */
function reportBaselineFreshness() {
  const script = join(dirname(fileURLToPath(import.meta.url)), 'check-baseline-freshness.mjs')
  if (!existsSync(script)) return
  const stampFile = join(dirname(LOG), 'baseline-freshness-stamp')
  const THROTTLE_MS = 30 * 60 * 1000
  let lastRun = 0
  try {
    lastRun = Number(readFileSync(stampFile, 'utf8').trim()) || 0
  } catch {
    lastRun = 0
  }
  const full = Date.now() - lastRun > THROTTLE_MS
  const args = ['--json', '--no-fetch']
  if (!full) args.push('--skip-drift-analysis')
  let parsed = null
  let why = null
  {
    let status = null
    let stdout = ''
    let stderr = ''
    try {
      stdout = String(
        execFileSync(process.execPath, [script, ...args], {
          cwd: WORKTREE,
          encoding: 'utf8',
          windowsHide: true, // §5b:漏此参数在计划任务/守护下必弹控制台窗
          timeout: 240000, // 守门 80:热路径派生一律带上限
          stdio: ['ignore', 'pipe', 'pipe'],
        }) ?? '',
      )
      status = 0
    } catch (e) {
      // 非零退出**不是**"探针坏了":判红就 exit 1。把 stdout/stderr/status 全部取回来交给
      // readProbeVerdict 分三态,不得在此直接判定为未判定(成因见该函数头注与 §5e)。
      status = typeof e?.status === 'number' ? e.status : null
      stdout = String(e?.stdout ?? '')
      stderr = String(e?.stderr ?? '')
    }
    const v = readProbeVerdict({ status, stdout, stderr })
    parsed = v.parsed
    why = v.why
  }
  if (!parsed) {
    // 判据自己跑不动 ≠ 基线过期;也 ≠ 可以静默。留一行,免得"账没了"和"账绿了"长得一样。
    // 原因必须上账:stderr 曾被 stdio 第三项 'ignore' 整条丢掉,这条"未判定"连续两天无人能答为什么。
    log(`⚠️ 基线新鲜度账不可用:未判定 —— ${why ?? '原因未取到'},不影响自愈与退出码`)
    return
  }
  if (full) {
    try {
      mkdirSync(dirname(stampFile), { recursive: true })
      writeFileSync(stampFile, String(Date.now()))
    } catch {
      /* 节流戳写失败只意味着下次多跑一遍全账,不影响判定 */
    }
  }
  const a = parsed.axes || {}
  const d = a.drift || {}
  const up = a.upstream || {}
  const mn = a.main || {}
  // 只在"有东西可看"时写行:全绿且零漂移的日子保持安静(健康时不写行是本日志的既有约定)。
  const parts = [
    `①${up.status ?? '?'}${typeof up.behind === 'number' ? `(落后 ${up.behind})` : ''}`,
    `②${mn.status ?? '?'}${typeof mn.behind === 'number' ? `(落后 ${mn.behind}/独有 ${mn.own})` : ''}`,
    `③漂移面 ${d.total ?? '?'} 个路径(源码类 ${d.sourceClass ?? '?'})`,
  ]
  if (full)
    parts.push(
      `旧基线 ${d.stale ?? '?'} 个${
        d.oldest ? `(最旧 ${d.oldest.commit}${typeof d.oldest.span === 'number' ? ` 落后 ${d.oldest.span} 次` : ''})` : ''
      }`,
    )
  const noteworthy =
    (d.total ?? 0) > 0 ||
    up.status === 'red' ||
    mn.status === 'red' ||
    (d.stale ?? 0) > 0 ||
    up.status === 'undetermined' ||
    mn.status === 'undetermined'
  if (noteworthy) log(`ℹ️ 基线新鲜度(只报数,不进提交链)${full ? '全账' : '便宜账'}:${parts.join(';')}`)
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
  if (process.argv.includes('--bare-audit-report')) {
    // 只读问责入口:列"每次翻车 + 各自嫌疑人",不派生 PowerShell、不写任何件
    return bareAuditReportMain(process.argv.includes('--json'))
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

  const coreOk = coreHealthy(before)
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
    // 主机时区漂移问责:必须与上面同格(健康轮次早退之前 + !CHECK_ONLY)—— 挂进 CHECK_ONLY 路径
    // 等于永不执行,本文件已踩过两次(工作区自愈层、根封口层)。
    if (!CHECK_ONLY) auditHostTimezone()
    // 盘根卫生巡检(G 盘清理收口 2026-09-30):同一挂点语义 —— 健康轮次早退之前 + !CHECK_ONLY。
    if (!CHECK_ONLY) auditDiskRootHygiene()
    // 开工前基线新鲜度:只报数的一层(③轴绝不进提交链,故这里既不判红也不喊人)。
    if (!CHECK_ONLY) reportBaselineFreshness()
    // §5b 的"唯一空白层":恢复源刷新原本挂在计划任务上,而那个任务已实测消失 ⇒ 并入 tick。
    if (!CHECK_ONLY) refreshRecoverySource()
    // 运行日志保留期回收(对标 ZCode logRetention):同一挂点语义 —— 挂进 CHECK_ONLY 分支等于永不执行。
    if (!CHECK_ONLY) rotateRunLogs()
    // 受管 .env 的"键值被悄悄清空"巡检 + 到人(G-223 第三格):判机器状态,所以绝不进提交链;
    // 挂点与 heal*/refreshRecoverySource 同一分支 —— 挂进 CHECK_ONLY 早退路径等于永不执行。
    if (!CHECK_ONLY) auditEnvDrift()
    // 收敛器收尾对齐停摆喊人(票 O74):收敛器一次性进程只写状态,派发点在此(与
    // heal*/watchWatchdog 同一真正会执行的分支;挂进 CHECK_ONLY 早退分支等于永不执行)。
    if (!CHECK_ONLY) checkConvergeAlignStall()
    // 元运维巡检(尺子 = scripts/check-ops-patrol.mjs):判"没发生"的那一族。它按设计不能进提交链
    // (判机器状态 ⇒ 恒红 ⇒ 每台每次 --no-verify),而本行就是它唯一的调度器。
    if (!CHECK_ONLY) auditOpsPatrol()
    // 不响应服务的自愈(三层方案第三层,台账 G-978121):nssm 包装的服务 SCM 看不死,
    // 这一层是"进程在但端口不应答 / 子进程起不来"唯一的动作器。节流与发信见函数头注。
    if (!CHECK_ONLY) healUnresponsiveServices()
    // 公网路径与换流窗口的常驻探测(票 G-301):两条序列互不顶账,节流 30 分钟,
    // 判"未判定"只写日志不喊人;它不改本守护退出码 —— 探测失败不等于 .git 失败。
    if (!CHECK_ONLY) auditPublicPathProbe()
    // 不能进提交链,而"手动问责"等于只有人在跑 —— 本行是它唯一的调度器。挂进 CHECK_ONLY 分支等于永不执行。
    if (!CHECK_ONLY) auditOrphanDeletionRefs()
    // 看门人也要有人看:凭据/停摆巡检靠 schtasks 每 6 小时自跑,任务被删/被停/node 路径
    // 看门人也要有人看:凭据/停摆巡检靠 schtasks 每 6 小时自跑,任务被删/被停/node 路径
    // 失效时它**自己不会喊**(故障形态是"安静",正是今天两天冻结的同类)。本守护每 2 分钟
    // 一趟且自身分层自愈,由它盯心跳最省。--check 仍零副作用。
    if (!CHECK_ONLY) watchWatchdog()
    // 幂等确保自身是 S4U(已是则内部秒退,不重建任务、不产生抖动)
    if (!CHECK_ONLY) ensureS4u()
    if (CHECK_ONLY)
      console.log('✅ .git 健康(pointer + gitdir + git 可用 + 工作树可用 + 嵌套 ref 完整)')
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
  const ok =
    after.pointerOk && after.gitdirOk && after.gitUsable && after.refsOk && after.worktreeUsable
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
      const coreOk = coreHealthy(h)
      if (!coreOk) {
        log(anomalyLine(h))
        remediate(h)
        const a = status()
        log(
          coreHealthy(a) && a.refsOk ? `✅ 自愈成功(HEAD=${a.head})` : '❌ 自愈失败,需人工介入',
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
        // 以及受管 .env 的"键值被悄悄清空"巡检(G-223 第三格;与 main() 单轮路径同一挂点语义,
        // notifyGuardRed 内部还有一层 CHECK_ONLY/去重保护,双执行体并存不会翻倍发信)
        auditEnvDrift()
        // 收敛器收尾对齐停摆喊人(票 O74;与 main() 单轮路径同一挂点语义,notify 内部
        // 还有一层 CHECK_ONLY/去重保护,双执行体并存也不会翻倍发信)
        checkConvergeAlignStall()
        // 元运维巡检:与 main() 单轮路径同一挂点语义,共用 .workbuddy/ops-patrol-tick.ts 节流戳
        // ⇒ 双执行体并存时只有先到那一个真跑,不会翻倍发信。
        auditOpsPatrol()
        // 同一挂点语义:与 main() 单轮路径共用 .workbuddy/service-heal-tick.iso 节流戳
        // ⇒ 双执行体并存时只有先到那一个真跑,不会把同一台服务重启两遍。
        healUnresponsiveServices()
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
  stableAlertFingerprint,
  auditPublicPathProbe,
  parseNotifyState,
  shouldAlert,
  withAlertMark,
  maskEmail,
  resolveAlertTo,
  buildGuardMailArgv,
  redactChildOutput,
  judgeDryRunChannel,
  notifyGuardRed,
  shouldAlertAlignStall,
  checkConvergeAlignStall,
  alignStallThresholds,
  auditEnvDrift,
  envDriftDetail,
  homeHealDue,
  readProbeVerdict,
  orphanAuditDue,
  auditOrphanDeletionRefs,
  // 裸档自愈(2026-09-28 立):测试在临时仓库上取证,不碰活仓库
  readBareFlag,
  writeBareFalse,
  healWorktreeBare,
  coreHealthy,
  // core.bare 翻车现场取证(2026-09-29 立):判据一律以**纯函数 + 构造面**取证,
  // 不得依赖此刻真仓的进程状态/真仓的 gitdir(守门 103 T12 那一课)。
  parseProcessSnapshot,
  parseProcessCreationDate,
  selectBareFlipCandidates,
  bareAuditSelfCheck,
  bareAuditSide,
  decideBareFlipRetention,
  bareAuditFileName,
  redactCmdlineForPrint,
  formatBareFlipAuditReport,
  captureBareFlipAudit,
  BARE_AUDIT_CMD_RULES,
  BARE_AUDIT_FILE_RE,
  BARE_AUDIT_DIR,
  BARE_AUDIT_KEEP,
  BARE_AUDIT_REPORT_TIME_ONLY_CAP,
  BARE_AUDIT_WINDOW_MS,
  BARE_AUDIT_SINCE,
  NOTIFY_DEFAULT_WINDOW_MS,
  NOTIFY_DEFAULT_FAIL_COOLDOWN_MS,
}
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
