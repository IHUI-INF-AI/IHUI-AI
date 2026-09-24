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
import { basename, dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { judgeTaskForm, taskFormAcceptable } from './lib/schtasks-form.mjs'
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
        windowsHide: true,        }).trim()
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

/** 直写松散 ref:`git update-ref` 对嵌套命名空间静默不落盘,故用 node fs */
function writeLooseRef(ref, sha) {
  const p = join(GITDIR, ref)
  mkdirSync(dirname(p), { recursive: true })
  writeFileSync(p, sha + '\n', 'utf8')
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

  log(`修复: 重建 ${broken.length} 个缺失的嵌套 ref(宿主清理 depth>=2 目录所致)`)
  for (const [ref, sha] of broken) {
    writeLooseRef(ref, sha)
    log(`  - ${ref} = ${sha.slice(0, 12)}`)
  }
  packRefs()
  const still = Object.entries(map)
    .filter(([ref]) => !git(['rev-parse', '--verify', '--quiet', ref], true))
    .map(([ref]) => ref)
  if (still.length) {
    log(`refs 修复未完全达标: ${still.join(', ')}`)
    return false
  }
  log(`✅ refs 自愈成功(${broken.length} 个已重建并固化进 packed-refs)`)
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
  else if (r.restored) log(`✅ 工作区存续自愈:恢复 ${r.restored} 个被外部删除的跟踪文件(${brief(r)})`)
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
  if (after.code !== 0) log(`⚠️ 盘根封口重封后体检仍非 0(exit ${after.code})⇒ 需人工看 seal-c-root-stray 输出`)
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
    if (/switched to S4U/.test(out)) log('✅ 计划任务已升级为 S4U(无人登录时也照常巡检;已验证弹窗结构上不可能)')
    else if (/register failed|VERIFY FAILED|refusing/i.test(out)) log('S4U 升级未完成(不阻断守护): ' + out.replace(/\r?\n/g, ' | ').slice(0, 160))
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
    list = flat(execFileSync('schtasks.exe', ['/Query', '/FO', 'CSV', '/NH'], { windowsHide: true, timeout: 30_000, maxBuffer: 1 << 24 }))
  } catch {
    return 'unknown' // schtasks 本身不可用 ⇒ 不下判断
  }
  if (!list.includes(TASK_NAME)) return 'missing'
  let xml = ''
  try {
    xml = flat(execFileSync('schtasks.exe', ['/Query', '/TN', TASK_NAME, '/XML'], { windowsHide: true, timeout: 30_000, encoding: 'buffer' }))
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
      log(`注册失败:git-guardian-hidden.vbs 预检未通过,勿注册坏包装器\n${e.stdout || ''}${e.stderr || e.message}`)
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
    log(`⚠️ 计划任务形态漂移(实测形态=${taskForm()}:InteractiveToken 直跑 node.exe 会闪黑窗),自动重注册`)
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
