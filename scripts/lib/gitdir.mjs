#!/usr/bin/env node
// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
 

/**
 * gitdir.mjs — 真实 gitdir / 工作树动态解析共享库(2026-09-15 立)。
 *
 * 根因(2026-09-12 → 2026-09-15):git-refs-heal / git-guardian 两个守护脚本曾把
 *   separate-git-dir 时期的旧路径 `D:/IHUI-AI`、`D:/IHUI-AI-git-repo` 硬编码进源码。
 *   仓库迁回 `G:/IHUI-AI` 且 `.git` 已变回真实目录后,这些硬编码导致
 *   `ENOENT: D:\IHUI-AI\.git\refs-manifest.json` 静默失败 —— refs 清单写不进真实 gitdir,
 *   refs 抖动只能靠 fetch 复验。
 *
 * 解法:所有 gitdir / 工作树路径一律**动态解析**,不再依赖任何盘符硬编码:
 *   工作树    → `git rev-parse --show-toplevel`(次选:脚本位置向上两级;再次:旧 D: 路径兜底)
 *   真实 gitdir → `git rev-parse --git-dir`
 *        · linked worktree 返回 `<主gitdir>/worktrees/<名>`,需归一为**主 gitdir**
 *          (packed-refs / refs-manifest / FETCH_HEAD 都在主 gitdir;归一法:读该目录
 *          `commondir` 文件,其为相对主 gitdir 的路径,如 `../..`)
 *        · separate-git-dir 指针形态:读 `.git` 指针文件 `gitdir:` 行,绝对/相对归一
 *        · 常规仓库:`.git` 即 gitdir(目录),回退即它自身
 *   向后兼容:`IHUI_WORKTREE` / `GIT_WORKTREE` 环境变量优先;旧 D: 路径仅当仍存在时兜底。
 */

import { execFileSync } from 'node:child_process'
import { existsSync, mkdirSync, readFileSync, readdirSync } from 'node:fs'
import { basename, dirname, isAbsolute, join, parse, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
// 夹具判据只有一份实现(scratch-dir.mjs 是 §26 批准的临时物唯一落点,段名与计数都住在那儿)。
// 在别处再抄一遍 `ihui-scratch` 字面量 = 名字一改本闸整族失明,与 §3「两处实现必漂移」同一条禁令。
import { countScratchSegments } from './scratch-dir.mjs'
// G-814433(2026-09-30):DevEnv 实体已迁仓内 G:/IHUI-AI/.DevEnv,归档根推导跟随
// devEnvRoot() 双形态(仓内 .DevEnv 优先,回落 <盘>/DevEnv)。seal 不依赖本模块,无环。
import { devEnvRoot } from '../seal-c-root-stray.mjs'

// ── git 可执行文件解析:不依赖 PATH(服务账户如 LocalSystem 可能没有 PATH) ──
// D57 卫生项:旧硬编码 `.../PortableGit/versions/1.2.0/cmd/git.exe` 版本升级即失效,
// 改为三层候选:① IHUI_PORTABLE_GIT 环境变量;② versions/ 目录多版本扫描(current 文件优先,
// 语义版本倒序);③ 旧 1.2.0 路径仅作最后兜底。
const PORTABLE_VERSIONS_ROOT = 'C:/Users/Administrator/.workbuddy/binaries/PortableGit/versions'
const LEGACY_PORTABLE_GIT = 'C:/Users/Administrator/.workbuddy/binaries/PortableGit/versions/1.2.0/cmd/git.exe'
export const GIT_CANDIDATES = [
  process.env.GIT_BIN,
  'git',
  'C:/Program Files/Git/cmd/git.exe',
  'C:/Program Files (x86)/Git/cmd/git.exe',
].filter(Boolean)

/** 语义版本倒序比较(1.2.10 > 1.2.0),仅用于 versions/ 子目录排序 */
function compareVersionDesc(a, b) {
  const pa = a.split('.').map(Number)
  const pb = b.split('.').map(Number)
  const n = Math.max(pa.length, pb.length)
  for (let i = 0; i < n; i++) {
    const da = pa[i] ?? 0
    const db = pb[i] ?? 0
    if (da !== db) return db - da
  }
  return 0
}

/** 扫描单个 versions 根目录:current 文件优先,其次语义版本倒序,每版取 cmd/bin 各一 */
function scanVersionsRoot(root) {
  const found = []
  try {
    try {
      const cur = readFileSync(join(root, 'current'), 'utf8').trim().split(/\s+/)[0]
      if (cur && !cur.includes('/') && !cur.includes('\\')) {
        found.push(join(root, cur, 'cmd/git.exe'))
        found.push(join(root, cur, 'bin/git.exe'))
      }
    } catch {
      /* 无 current 文件则跳过 */
    }
    const entries = readdirSync(root, { withFileTypes: true })
      .filter((e) => e.isDirectory() && /^\d+\.\d+(\.\d+)?$/.test(e.name))
      .map((e) => e.name)
      .sort(compareVersionDesc)
    for (const v of entries) {
      found.push(join(root, v, 'cmd/git.exe'))
      found.push(join(root, v, 'bin/git.exe'))
    }
  } catch {
    /* 目录不存在则返回空 */
  }
  return found
}

/**
 * PortableGit 动态候选(有序,去重):环境变量 > 默认 versions 根扫描 > 旧 1.2.0 兜底。
 * IHUI_PORTABLE_GIT 可指向 git.exe 本体、某版本目录(含 cmd/git.exe)或 versions 根(含 current/版本子目录)。
 */
export function resolvePortableGitCandidates() {
  const out = []
  const push = (p) => {
    if (p && !out.includes(p)) out.push(p)
  }
  const envRoot = (process.env.IHUI_PORTABLE_GIT || '').trim()
  if (envRoot) {
    push(envRoot)
    push(join(envRoot, 'cmd/git.exe'))
    push(join(envRoot, 'bin/git.exe'))
    for (const p of scanVersionsRoot(envRoot)) push(p)
  }
  for (const p of scanVersionsRoot(PORTABLE_VERSIONS_ROOT)) push(p)
  push(LEGACY_PORTABLE_GIT)
  return out
}

let _GIT_BIN = null
let _GIT_VERSION = null

/** 解析可用的 git 可执行文件(带缓存;绝对路径优先,服务账户下仍可定位 PortableGit) */
export function resolveGitBin() {
  if (_GIT_BIN) return _GIT_BIN
  const all = []
  for (const c of [...resolvePortableGitCandidates(), ...GIT_CANDIDATES]) {
    if (c && !all.includes(c)) all.push(c)
  }
  for (const c of all) {
    try {
      const v = execFileSync(c, ['--version'], {
        encoding: 'utf8',
        // stdin 置 ignore:本环境下 pipe-stdin spawn git 确定性 EBUSY(2026-09-30 实测,
        // 同 git-push-guard / git-sync-converge aac3382bdb·058bcbff91 的根治;本层 spawn
        // 全部不经 stdin 传 input,ignore 无副作用。pipe+input 的调用点不受此影响者另议)。
        stdio: ['ignore', 'pipe', 'pipe'],
        timeout: 15000,
        windowsHide: true,
      }).trim()
      _GIT_BIN = c
      _GIT_VERSION = v
      return _GIT_BIN
    } catch {
      /* 试下一个候选 */
    }
  }
  return null
}

/** 已解析的 git 版本(未解析时为 null) */
export function gitVersion() {
  return _GIT_VERSION
}

/** 路径归一:解析相对段 + 反斜杠统一为正斜杠(Windows 友好,便于等值比较) */
function normalizePath(p) {
  return resolve(p).replace(/\\/g, '/')
}

// ── 工作树(仓库根)解析 ──
export function resolveWorktree() {
  // 1) 环境变量别名(向后兼容)
  for (const env of [process.env.IHUI_WORKTREE, process.env.GIT_WORKTREE]) {
    if (env && existsSync(join(env, '.git'))) return normalizePath(env)
  }
  // 2) git 视角:`--show-toplevel` 返回工作树根(无论 `.git` 是目录还是指针文件)
  const bin = resolveGitBin()
  if (bin) {
    try {
      const top = execFileSync(bin, ['-c', 'safe.directory=*', 'rev-parse', '--show-toplevel'], {
        encoding: 'utf8',
        stdio: ['ignore', 'pipe', 'pipe'], // stdin 置 ignore(同上,pipe-stdin spawn git 本环境 EBUSY;此处不经 stdin 传 input)
        timeout: 15000,
        windowsHide: true,
      }).trim()
      if (top && existsSync(join(top, '.git'))) return normalizePath(top)
    } catch {
      /* 落到回退 */
    }
  }
  // 3) 回退:本文件位于 scripts/lib,向上两级即仓根
  const fromScript = normalizePath(resolve(dirname(fileURLToPath(import.meta.url)), '..', '..'))
  if (existsSync(join(fromScript, '.git'))) return fromScript
  // 4) 旧硬编码兜底(2026-09-12 separate-git-dir 时期);仅当该路径仍有效时用于向后兼容
  const legacy = 'D:/IHUI-AI'
  if (existsSync(join(legacy, '.git'))) return legacy
  return fromScript
}

// ── 真实 gitdir 解析 ──

/**
 * 仓根同级的实体 gitdir(§5b 设计:gitdir 必须在工作区之外,躲开宿主批量删除层)。
 * 如 `G:/IHUI-AI` → `G:/IHUI-AI-git-repo`。
 */
export function siblingGitdir(worktree) {
  const wt = worktree || resolveWorktree()
  return normalizePath(join(dirname(wt), `${basename(wt)}-git-repo`))
}

export function resolveGitdir(worktree) {
  const wt = worktree || resolveWorktree()
  const bin = resolveGitBin()
  if (bin) {
    try {
      const gd = execFileSync(bin, ['-c', 'safe.directory=*', '-C', wt, 'rev-parse', '--git-dir'], {
        encoding: 'utf8',
        stdio: ['ignore', 'pipe', 'pipe'], // stdin 置 ignore(同上,pipe-stdin spawn git 本环境 EBUSY;此处不经 stdin 传 input)
        timeout: 15000,
        windowsHide: true,
      }).trim()
      if (gd) {
        const abs = isAbsolute(gd) ? gd : join(wt, gd)
        const real = normalizeToMainGitdir(abs)
        return real || normalizePath(abs)
      }
    } catch {
      /* 落到回退 */
    }
  }
  // 回退:读 `.git` 指针文件(separate-git-dir 形态)
  const pointer = join(wt, '.git')
  try {
    const raw = readFileSync(pointer, 'utf8').trim()
    const m = raw.match(/^gitdir:\s*(.+)$/i)
    if (m) {
      const p = m[1].trim().replace(/\\/g, '/')
      const abs = isAbsolute(p) ? p : join(wt, p)
      // 自指指针(`gitdir: <worktree>/.git`)是损坏态:照它解析会让 needsGitdirPointer() 返回
      // false,于是 pointerOk() 把"文件存在"当健康 → 僵尸化;且 GITDIR 落在工作树内,
      // 远端重建分支的 rm -rf 会打在真 `.git` 上(2026-09-23 实测删库路径)。
      if (normalizePath(abs) === normalizePath(join(wt, '.git'))) return siblingGitdir(wt)
      const real = normalizeToMainGitdir(abs)
      return real || normalizePath(abs)
    }
  } catch {
    /* .git 为目录或无指针文件 */
  }
  // 最终回退:常规仓库 `.git` 即 gitdir
  return normalizePath(pointer)
}

/**
 * 把 linked worktree 的「工作树级 gitdir」归一为「主 gitdir」。
 * 主 gitdir 才承载 packed-refs / refs-manifest.json / FETCH_HEAD。
 * 判定:路径含 `/worktrees/` 即为工作树级;读其 `commondir` 文件(相对主 gitdir 的路径,
 * 如 `../..`)归一。commondir 缺失时,主 gitdir 即 `/worktrees/` 段的上一级。
 * @returns {string|null} 主 gitdir;非工作树级时返回 null
 */
function normalizeToMainGitdir(gitdirPath) {
  if (!/[/\\]worktrees[/\\]/.test(gitdirPath)) return null
  try {
    const common = readFileSync(join(gitdirPath, 'commondir'), 'utf8').trim().replace(/\\/g, '/')
    if (common) {
      const main = normalizePath(resolve(gitdirPath, common))
      if (existsSync(join(main, 'packed-refs')) || existsSync(main)) return main
    }
  } catch {
    /* 落到下面 */
  }
  return normalizePath(gitdirPath.replace(/[/\\]worktrees[/\\][^/\\]+$/, ''))
}

/**
 * 当前仓是否处于 separate-git-dir 形态(`.git` 是指针文件而非真实目录)。
 * 用于守门脚本判断是否应「维护 `.git` 指针文件」——常规仓库的 `.git` 是目录,
 * 绝不可被覆盖为指针文件(否则会删库)。
 */
export function needsGitdirPointer(worktree, gitdir) {
  const wt = worktree || resolveWorktree()
  const gd = gitdir || resolveGitdir(wt)
  return normalizePath(join(wt, '.git')) !== normalizePath(gd)
}

/**
 * 归档根推导的**纯函数**(零副作用:不建目录、不写盘、不派生进程)。
 *
 * 锚定方式 = 盘根(与 `scripts/lib/scratch-dir.mjs` 在 G-286 之后的写法同形):
 *   工作树 `X:/…` ⇒ 归档根 `X:/DevEnv/backups/git`,**与工作树在目录树里的第几层无关**。
 *
 * 为什么不是「工作树向上两级」(旧写法,2026-09-28 前):
 *   `resolve(wt,'..','..')` 只对「仓库恰好躺在 `<盘>:/<仓名>`」这一种布局成立,
 *   而本模块会被 `lib/scratch-module-closure` 连闭包拷进演练仓,拷进去之后"向上两级"
 *   就跟着夹具走。实测深度矩阵(工作树在夹具里 0/1/2/3 层)四个答案各不相同:
 *     depth=0 → `G:/DevEnv/Temp/DevEnv/backups/git`(连 scratch 根都不是)
 *     depth=1 → `G:/DevEnv/Temp/ihui-scratch/DevEnv/backups/git`(= scratch 根,
 *               即盘上那 5 个 `ihui-git-write.lock.stale-*` 的来路:提交链上的 git-lock 抢占)
 *     depth=2 → `<夹具>/DevEnv/backups/git`        depth=3 → `<夹具>/L0/DevEnv/backups/git`
 *   而 §5b/§15b 说这是"现场归档唯一出口"(git-guardian / git-rebuild-local /
 *   git-backup-refresh / git-lock 都读它)—— 落点随深度漂,等于把恢复现场放进宿主清理层的射程。
 *   真仓一直解析正确,只是因为 `G:/IHUI-AI` 恰好在盘根下一级,不是推导本身对。
 *
 * 夹具闸(第二半,不可或缺):盘根锚定让**任何**同盘路径都解析到同一个生产归档根,
 * 所以单靠锚定反而比旧写法更糟 —— 测试会直接往生产归档里写东西。故工作树路径里出现
 * `ihui-scratch` 段(§26 唯一批准的临时物落点,判据只有 `countScratchSegments` 一份)
 * ⇒ 返回 null:那是一次演练/测试现场,本模块不替它交出生产落点。
 * 调用方对 null 的兜底早已存在且方向安全(git-guardian/git-rebuild-local 退到 gitdir 同级、
 * git-lock 退到锁目录同父改名、retire-git-archive 与 refreshBackup 明写"无法判定/不强行")。
 *
 * 能力边界(如实登记,别当已封闭):只认 scratch 段名。落在 scratch 之外的临时目录
 * (例如直接 `os.tmpdir()` 手搓的现场)本闸结构上看不见 —— 依据是 §26/§15b 那条
 * "夹具只用 scripts/lib/scratch-dir.mjs";要扩这一维得先有第二处实测站点,不是先加名字。
 *
 * @param {string} [worktree] 显式工作树(测试注入用);缺省取 resolveWorktree()
 * @returns {string|null} 归一化(正斜杠)归档根,或 null(夹具 / 无法交出落点)
 */
export function gitArchiveRootFor(worktree) {
  const wt = normalizePath(worktree || resolveWorktree())
  if (countScratchSegments(wt) > 0) return null
  // G-814433(2026-09-30):盘根 G:/DevEnv 已迁仓内 G:/IHUI-AI/.DevEnv,归档根改随
  // devEnvRoot() 双形态推导 —— 真仓解析到仓内 .DevEnv/backups/git;
  // 其他盘的 worktree 落 <盘>/DevEnv/backups/git(保持"每盘独立 DevEnv"原语义)。
  // scratch 闸已在上方返回 null,devEnvRoot 的同名守卫不会触发。
  return normalizePath(join(devEnvRoot(wt), 'backups', 'git'))
}

/**
 * 建目录的**唯一**落点:只由"马上要写归档"的出口 `gitdirArchivePath()` 调用。
 * 本模块的解析函数一律无副作用 —— 旧写法在 `gitArchiveDir()` 里 mkdir,
 * 于是每一次**只读**询问(守护 `--status` 的 resolveBackupDir、git-lock 的默认参数、
 * retire-git-archive 的体检)都会在被问到的位置长出一棵 `DevEnv/backups/git`。
 * 导出是为了能被真取证喂一个临时根去验"缺目录时确实建得出"(生产根恒在,拿它验不出这一格)。
 * @param {string} root 已归一化的归档根
 * @returns {boolean} 目录此刻是否可用
 */
export function ensureGitArchiveDir(root) {
  if (!root) return false
  try {
    mkdirSync(root, { recursive: true })
  } catch {
    /* 换机/只读环境:此处不喊,由调用方"归档失败即放弃破坏性覆盖"那一条大声失败 */
  }
  return existsSync(root)
}

/**
 * gitdir 类归档在项目外的**唯一**落点(AGENTS.md §15b)。按工作树所在**盘根**锚定、不写死盘符:
 * 工作树 `X:/IHUI-AI` ⇒ 归档根 `X:/DevEnv/backups/git`(与目录深度无关,推导见
 * `gitArchiveRootFor()` 头注)。夹具工作树与不可用环境返回 null,由调用方兜底。
 * **无 mkdir 副作用**(建目录在 `gitdirArchivePath()`,即真正写归档的那一刻)。
 * @param {string} [worktree] 显式工作树;此前签名不收参数,而 `git-backup-refresh.mjs:198`
 *   一直在按 `gitArchiveDir(worktree)` 传 —— 那个入参被静默丢弃,传进来的夹具工作树从不生效。
 */
export function gitArchiveDir(worktree) {
  return gitArchiveRootFor(worktree)
}

/**
 * gitdir 现场归档目标路径(git-guardian 与 git-rebuild-local 共用,单一真相源)。
 *
 * 根因:两处原来都写成 `${GITDIR}.broken-<ts>`,而 GITDIR = `D:/IHUI-AI-git-repo`
 * ⇒ 每次守护/重建归档**必然在盘根长出一个新兄弟目录**(实测累计 3 个 / 1.94GB),
 * 违反 §15b「项目外落点唯一制」。现统一落 `DevEnv/backups/git/`;拿不到该目录时才退回旧命名。
 *
 * 本出口是被审面里**唯一**建归档目录的地方:它的调用点只有两处真写现场
 * (`git-guardian.mjs` archiveGitdir 的 cpSync、`git-rebuild-local.mjs` 的 `cp -r`),
 * 后者走的是 shell `cp -r`,父目录不存在即失败,所以 ensure 必须在这里、不能下放到调用方
 * (那两个文件不在本票改区)。
 *
 * **建不出来时仍返回路径**(与改前不同,方向是刻意的):改前 mkdir 失败 ⇒ 返回 null ⇒
 * 两个调用点各自落到 `${GITDIR}.broken-<ts>` = gitdir 同级 = 盘根,而 §5b 明写"现场归档
 * mv 到一级目录等于把恢复现场送回宿主清理层的射程内"(实测留过 7 项 / 3.2MB)。
 * 现在落点始终是 §15b 那个根,盘不可写就让 cpSync/`cp -r` 大声失败,失败即放弃破坏性覆盖
 * (guardian 的"归档失败⇒放弃恢复"、rebuild 的"归档失败⇒放弃重建"两条兜底都已在位)。
 * @param {string} baseName 形如 `IHUI-AI-git-repo.broken-2026-09-23T…`
 * @param {string} [worktree] 显式工作树(缺省取当前仓)
 */
export function gitdirArchivePath(baseName, worktree) {
  const root = gitArchiveRootFor(worktree)
  if (!root) return null
  ensureGitArchiveDir(root)
  return `${root}/${baseName}`
}


/**
 * 本地 gitdir 备份目录(兜底恢复用)。优先级:§15b 唯一备份目录下的新位置 →
 * 仓根同级推导(迁移前的旧位置);任一处存在 `HEAD` 即采用。
 * 旧版只查写死的 `D:/IHUI-AI.git-backup-20260912`,而该目录 2026-09-23 已迁入 §15b 目录
 * ⇒ 旧代码会解析到一个不存在的路径,使 git-guardian 报 `backupOk:false`(本地恢复源形同失效)。
 */
export function resolveBackupDir(worktree) {
  const wt = worktree || resolveWorktree()
  const name = `${basename(wt)}.git-backup-20260912`
  const cands = []
  // 把 wt 传下去:本函数收 worktree 却不传,等于"注入的工作树只用来算名字、不用来算落点"
  // —— 与 `git-backup-refresh.mjs:198` 那处被静默丢弃的入参同一条缺陷的第二格。
  // 夹具工作树经此处一律解析不到生产归档根(夹具闸 ⇒ null),候选只剩仓根同级。
  const root = gitArchiveDir(wt)
  if (root) cands.push(`${root}/${name}`)
  cands.push(join(dirname(wt), name))
  for (const c of cands) {
    try {
      if (existsSync(join(c, 'HEAD'))) return c.replace(/\\/g, '/')
    } catch {
      /* 单个候选不可读不影响继续下探 */
    }
  }
  return cands[0].replace(/\\/g, '/')
}

/**
 * 清单里某 ref 的期望值是否算"已满足"(git-guardian 与 git-refs-heal 共用,单一真相源)。
 *
 * 关键区分:清单要防的是**宿主删掉 depth>=2 目录导致 ref 解析不到**,不是"远端有没有前进"。
 * 而 `refs/remotes/**`(远端分支镜像与其 HEAD)按定义就是**会动的** —— 每 push/fetch 一次就变,
 * 把它的 sha 钉成期望值会造成三类故障(2026-09-23 实测):
 *   ① `refsOk` 恒 false(清单 `origin/main = d9687fd73`,实际已推进到 `937cabef3`);
 *   ② 守护每轮徒劳"重建";
 *   ③ 重建是**按清单旧值写回松散 ref** —— 等于把远端镜像指回旧 commit,反而制造错误状态。
 * 因此:remote 类只要**能解析**即满足;tags 与本地 heads 是不可变的,仍严格比 sha。
 */
export function refExpectationSatisfied(ref, expectedSha, actualSha) {
  if (!actualSha) return false // 解析不到 = 真缺失(宿主清理 depth>=2 目录的典型征状)
  if (ref.startsWith('refs/remotes/')) return true // 移动型远端镜像:不比 sha
  return actualSha === expectedSha
}
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
