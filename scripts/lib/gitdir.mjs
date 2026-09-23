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
import { basename, dirname, isAbsolute, join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

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
        stdio: ['pipe', 'pipe', 'pipe'],
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
        stdio: ['pipe', 'pipe', 'pipe'],
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
        stdio: ['pipe', 'pipe', 'pipe'],
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
 * gitdir 类归档在项目外的**唯一**落点(AGENTS.md §15b)。按工作树所在盘动态推导、不写死盘符:
 * 工作树 `X:/IHUI-AI` ⇒ 归档根 `X:/DevEnv/backups/git`。不可用时返回 null 由调用方兜底。
 */
export function gitArchiveDir() {
  const wt = resolveWorktree()
  const root = join(resolve(wt, '..', '..'), 'DevEnv', 'backups', 'git')
  try {
    mkdirSync(root, { recursive: true })
  } catch {
    /* 换机/只读环境下退回兄弟命名 */
  }
  return existsSync(root) ? root.replace(/\\/g, '/') : null
}

/**
 * gitdir 现场归档目标路径(git-guardian 与 git-rebuild-local 共用,单一真相源)。
 *
 * 根因:两处原来都写成 `${GITDIR}.broken-<ts>`,而 GITDIR = `D:/IHUI-AI-git-repo`
 * ⇒ 每次守护/重建归档**必然在盘根长出一个新兄弟目录**(实测累计 3 个 / 1.94GB),
 * 违反 §15b「项目外落点唯一制」。现统一落 `DevEnv/backups/git/`;拿不到该目录时才退回旧命名。
 * @param {string} baseName 形如 `IHUI-AI-git-repo.broken-2026-09-23T…`
 */
export function gitdirArchivePath(baseName) {
  const root = gitArchiveDir()
  return root ? `${root}/${baseName}` : null
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
  const root = gitArchiveDir()
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
