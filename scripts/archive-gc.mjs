#!/usr/bin/env node
// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * archive-gc.mjs — G-24 事故归档回收器(「双上限 + 保留最近 10 代」)
 *
 * 票面原文(HEAD `PROJECT_PLAN.md`,逐字抄,不改写):
 *   “- **G-24 事故归档按"双上限 + 最近 10 代"回收。** 边界写死:回收对象**只有**
 *    `gitArchiveDir()` 下的事故现场归档;活 gitdir、本地恢复源、两目录的 `*.broken-*`
 *    **一律不碰**(§5b 明文禁删,与本案不冲突 —— 冲突的只是"要不要回收现场归档"这一层)。
 *    每次删除必须留 deleted/failed 双日志;量不确认(未先跑 dry-run)即拒绝执行。”
 *   “- **G-24 事故归档无"双上限"回收 —— 与 §5b 的禁删条款正面冲突,必须先由人定代数**
 *    （归属:`.git` 存续线） 〔2026-09-27 用户拍板:**双上限 + 保留最近 10 代**,每次删除写日志、
 *    量不确认即拒跑;§5b 禁删名单(活 gitdir / 恢复源 / `*.broken-*`)**一律不回收**,只回收
 *    事故现场归档〕”
 *   票面唯一给出的具体量值(同一节的 ZCode 参照行):
 *   “ZCode 的归档回收是 `maxFiles=5 + maxTotalBytes=100MB` 双上限 + deleted/failed 留痕
 *    + mtime≥1s 稳定窗。”
 *
 * 射程(票面只点名 `gitArchiveDir()`;本器不自带默认根)
 * ────────────────────────────────────────────────────
 * G-24 原文的回收对象**只有** `gitArchiveDir()` 下的事故现场归档(本机现指
 * `G:/IHUI-AI/.DevEnv/backups/git`),那一棵已由 `scripts/retire-git-archive.mjs`
 * (`package.json` 的 `archive:retire`)按同一句拍板实装。本器**不预置任何默认目录**:
 * 本次射程一律由调用方 `--root <dir>` 指定,并在人读面打印“本次射程 × 该目录已有器物”。
 *   · `retire-git-archive.mjs` 只认 `.broken-<ts>` / `.stale-*` 事故签名,gc 对象是 gitdir 现场;
 *   · 本器只认指定目录顶层**普通文件**,不递归、不碰目录。
 *   任务里用过的 `.ihui-agent/archive` 是**调用方显式指定的另一棵树**,不是票面射程;
 *   二者互不替代,也不得把本器读数读成 gitArchiveDir 已收口。
 *
 * 双上限口径(票面 + 本票取法,差异照实报)
 * ─────────────────────────────────────────
 *   上限一 `maxFiles`      = 5     ← 票面 ZCode 参照行 `maxFiles=5`(总数上限)
 *   上限二 `maxItemBytes`  = 100MB ← 票面 `maxTotalBytes=100MB` 的**量值**;票面原词是
 *          “总量”,本票的三条判据要求的是“**单件**体积上限”,故口径落在单件。要换口径/档位
 *          不必改代码:`--max-files <n>` / `--max-item-bytes <bytes>`。
 *   地板   `keepGenerations` = 10  ← 票面拍板值“保留最近 10 代”,不是上限而是**地板**:
 *          落在最新 10 代内的件,体积上限与总数上限都不得把它删掉(保护优先)。
 *   两轴独立:地板与双上限是两条独立判据,任一超限即判;当地板高于上限(如 32 世代仓上
 *   `maxFiles=5` 撞上“保留 10 代”),**地板胜出**,上限差额如实报 `capUnmet`,绝不越地板硬删。
 *   这不是“5 与 10 矛盾”,而是“保留最近 10 代”优先于“最多 5 件”;按 ZCode 参照值把仓砍到
 *   只剩 5 件会直接违反票面拍板的后半句。
 *
 * 三条判据与三条独立出口(哪条触发、为哪件,逐条写在行首的标签里)
 * ──────────────────────────────────────────────────────────────
 *   ① `count>max`    总数超 `maxFiles` ⇒ 从**最老**的非保护件起删,直到回落到上限或可删集用尽;
 *                    可删集用尽仍超 ⇒ 打印"上限未达"的原因(受近 10 代/未判定保护),不硬删。
 *   ② `itemBytes>max` 单件超 `maxItemBytes` ⇒ 该件判删(不受总数档影响,独立出口)。
 *   ③ `gen<=keep`    最新 10 代 ⇒ 显式**保留出口**,并注明是第几新代;它优先于 ①②。
 *
 * fail-closed(本仓最高频失效型是"把没判写成判过了")
 * ──────────────────────────────────────────────────
 * 「文件名里没有 YYYY-MM-DD ⇒ 判不出世代」「lstat/realpath/体量量不到」「非普通文件」
 * 一律**保留 + 逐条报名**,计入末行 `未判定 Z`;未判定非空时退出码为 2(判定拿不到不记绿)。
 * 目录、重解析点、正在被写方引用的件(见 `IN_USE_NAMES`)、**活文档正文点名的件**
 * (见 `LIVE_DOC_NAMES`/`liveDocArchiveRefs`)同样保留并写明理由。
 * 票面对 `.lintstagedrc.json` 这类无日期件**没有给判法**;本器不自造分类:一律保留 + 点名,
 * 计入 `未判定 Z` 并 RC=2,不得当“保留”悄悄过关。
 *
 * 活文档引用保护(2026-10-28 立,原判据在 `ddbc19f469`;本文件重写时被漏掉,2026-10-28 复验补回)
 * ──────────────────────────────────────────────────────────────────────────
 * 射程常常正是这些活文档自己指定的档案目录,而 AGENTS.md/README/PLAN 正文逐条写着
 * "…逐字归档于 `.ihui-agent/archive/<名>`" —— 只按世代/上限回收会把被正文点名的件判成
 * "待删"(现读实测 `AGENTS_full-pre-compact-2026-10-14.md` 1.20MB 与
 * `AGENTS-pre-compress-2026-10-21.md` 118.8KB 都在待删集里),删完文档就指向不存在的出路
 * (§0.8),而 §0 又写明历史案例以该归档为准。判据因此**从活文档现读**,不再抄一份名单
 * (§0.6);一份活文档都读不到 ⇒ 判"未判定"、RC=2、零删除(判不出谁被引用就不冒删)。
 *
 * §5b 禁删名单的结构性排除(2026-10-28 复验补)
 * ──────────────────────────────────────────────
 * 票面边界"活 gitdir、本地恢复源、两目录的 `*.broken-*` 一律不碰"不能只写在头注里:
 *   · **根形态**:根下有 `HEAD` 文件 ∧ `objects/` 目录 ⇒ 判为 gitdir/恢复源形态,直接拒跑
 *     (活 gitdir 与非裸仓/裸仓恢复源都是这一形态);
 *   · **名字形态**:`*.broken-*` / `*.stale-*` 事故签名件一律 `protected`,与射程无关,
 *     任何 `--root` 下都不进候选。
 * 两条都在**分类阶段**生效,不依赖"这批文件恰好没被上限挑中"这种碰巧。
 *
 * 「入库文件」硬门(2026-10-27 增补;本器唯一一次放松"零子进程"红线,理由在下面)
 * ──────────────────────────────────────────────────────────────────────
 * 现读事实(本机 HEAD):`.ihui-agent/archive`(任务里被数次当射程的那棵树)在 git 面
 * **有 84 个文件被跟踪**,而它 dry-run 的待删集 63 件**全部**落在其中。用 `rmSync` 删入库
 * 文件只会在工作树留下 63 条 `D` —— 门 71(`heal-worktree-tracked`)与 `checkout` 会按 HEAD
 * 把它们还原,而台账已经记了 `deleted` ⇒ 本仓最贵的失效型"把没成写成成了",且顺带把 63 条
 * 删除挂到共享工作树上,可能被他人的提交带走。
 * 所以 `--apply` 前加一道**硬门**(无绕过开关):
 *   · 待删集里只要有一件被 git 跟踪 ⇒ **整轮拒跑、零删除、RC=2**,逐条点名;
 *   · 探针取不到真值(git 不可达 / 退出码不认得)⇒ 同样拒跑(取不到不记绿);
 *   · 探针只读一次 `git ls-files -z -- <root>`:零写、零历史、零对象访问,且**只在 apply
 *     路径**上派生 —— dry-run 仍然零子进程。
 * 入库归档的正确回收方式是 `git rm` + 一笔入库提交(机主),不是本器。
 *
 * 留痕(每次删除可审计)
 * ────────────────────
 * deleted/failed 每条都写 `path` + `bytes` + `sha256`(+ `criterion`/`why`)。sha 取不到
 * (超 `SHA_MAX_BYTES` 或读失败)记 `sha256:null` + `shaWhy`,不得用空串冒充"已取证"。
 *
 * 红线(代码层面钉死)
 * ──────────────────
 *   · 默认 **dry-run**,一次删除都不发生;`--apply` 才真删,且删除前逐件**现场复验**
 *     (路径仍在归档根内 / 不是重解析点 / 仍是普通文件 / 已过 mtime 稳定窗)。
 *   · 唯一删除出口 `rmSync(path, { force: true })` —— **不带 recursive**,因此结构上删不掉目录树。
 *   · 归档根不得是 `.ihui-agent/state` 或其子目录、也不得是仓根/仓的祖先 ⇒ 直接拒跑。
 *   · dry-run 路径零子进程、零 git 操作;唯一的 git 查询是 apply 前那次只读
 *     `git ls-files`(见上节硬门),它只判"该件是否入库",不碰历史/对象/索引写面。
 *
 * 用法:
 *   node scripts/archive-gc.mjs --root <dir>                       # 必填射程;默认 dry-run(零删除)
 *   node scripts/archive-gc.mjs --root <dir> --dry-run             # 同上,显式档
 *   node scripts/archive-gc.mjs --root <dir> --apply               # 真删(deleted/failed 双日志落 state/)
 *   node scripts/archive-gc.mjs --root <dir> --keep 10 --max-files 5 --max-item-bytes 104857600
 *   node scripts/archive-gc.mjs --root <dir> --ledger-dir <dir>     # 夹具/取证用换台账
 * 退出码:0 = 正常且无未判定;1 = apply 有删除失败或日志写不进;
 *         2 = 未判定 / 拒跑(未给射程、参数非法、根不合格、枚举失败、判不出的件,
 *             或 apply 被「入库文件硬门」拦下 —— 一律零删除且不记绿)。
 */

import { execFileSync } from 'node:child_process'
import { createHash } from 'node:crypto'
import {
  appendFileSync,
  existsSync,
  lstatSync,
  mkdirSync,
  readdirSync,
  readFileSync,
  realpathSync,
  rmSync,
} from 'node:fs'
import { dirname, isAbsolute, join, relative, resolve, sep } from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'

import { gitArchiveRootFor } from './lib/gitdir.mjs'

const HERE = dirname(fileURLToPath(import.meta.url))
export const REPO_ROOT = resolve(HERE, '..')
/**
 * 票面点名的 `gitArchiveDir()`(纯推导,显式传 REPO_ROOT 以零子进程)。
 * 只用于人读面的“该目录已有器物”提示,绝不作默认射程。
 */
export const STD_GIT_ARCHIVE = (() => {
  try {
    return gitArchiveRootFor(REPO_ROOT)
  } catch {
    return null
  }
})()
export const STATE_DIR = resolve(REPO_ROOT, '.ihui-agent', 'state')

export const DEFAULT_KEEP_GENERATIONS = Number(process.env.IHUI_ARCHIVE_GC_KEEP || 10)
export const DEFAULT_MAX_FILES = Number(process.env.IHUI_ARCHIVE_GC_MAX_FILES || 5)
export const MB = 1048576
export const DEFAULT_MAX_ITEM_BYTES = Number(process.env.IHUI_ARCHIVE_GC_MAX_ITEM_BYTES || 100 * MB)
/** mtime 稳定窗:距今不足 1 秒的件按"正在写"处理,本轮不删。 */
export const MIN_AGE_MS = 1000
/** 取 sha256 的体积上限:超过则不读全文(记 null + 具名原因),不把 GB 级现场读进内存。 */
export const SHA_MAX_BYTES = 256 * MB
/**
 * 正在被写方引用的归档件:`archive-completed-tasks.mjs` 直接把已完成条目搬进
 * `PROJECT_PLAN_ARCHIVE.md` ⇒ 它不是历史快照,是活的落点。
 */
export const IN_USE_NAMES = Object.freeze(['PROJECT_PLAN_ARCHIVE.md'])
/**
 * §5b 明令禁删的"事故签名"件名族(`*.broken-*`,并含同族的 `*.stale-*` 锁/现场残件)。
 * 只认名字、不认目录与射程:任何 `--root` 下这类条目都不进候选,失效方向恒为"多留"。
 */
export const BROKEN_NAME_RE = /\.(broken|stale)[-.]/i
/**
 * 活文档:它们的**正文**决定哪些归档件不能删。
 * 判据从文档现读,不另抄一份名单(§0.6);读不到就判未判定,绝不退化成"没有引用"。
 */
export const LIVE_DOC_NAMES = Object.freeze([
  'AGENTS.md',
  'README.md',
  'README.en.md',
  'README.ja.md',
  'README.ko.md',
  'PROJECT_PLAN.md',
])

/** 纯函数:抽正文里 `.ihui-agent/archive/<basename>` 形态的引用名(只取顶层名)。 */
export function archiveRefsFromText(text) {
  const out = new Set()
  const re = /\.ihui-agent[/\\]archive[/\\]([^\s`'"()（）[\]<>«»「」、，。；;：:]+)/g
  let m
  while ((m = re.exec(String(text)))) {
    const name = m[1].replace(/[.,;:]+$/, '')
    if (name && !name.includes('/') && !name.includes('\\')) out.add(name)
  }
  return out
}

/**
 * 从活文档现读引用集。`read`/`missing` 分开报:一份都读不到 ⇒ 调用方必须判"未判定"
 * (判不出哪些件被引用就不冒删),不得退化成"没有引用"。
 */
export function liveDocArchiveRefs({ repoRoot = REPO_ROOT, readFile = readFileSync } = {}) {
  const names = new Set()
  const read = []
  const missing = []
  for (const doc of LIVE_DOC_NAMES) {
    try {
      const text = readFile(join(repoRoot, doc), 'utf8')
      read.push(doc)
      for (const n of archiveRefsFromText(text)) names.add(n)
    } catch {
      missing.push(doc)
    }
  }
  return { names, read, missing }
}

/** 保护名单 = 静态在用件 ∪ 活文档引用件;后者单列理由,便于读数时分辨来源。 */
export function protectedNameMap(names = []) {
  const map = new Map()
  for (const n of IN_USE_NAMES) map.set(n, `C-u 正在被写方引用的归档件(${n}) ⇒ 保留`)
  for (const n of names || []) {
    if (!map.has(n)) {
      map.set(
        n,
        `C-ref 活文档引用的归档件(${n}):AGENTS/README/PLAN 正文指向它 ⇒ 删了就是"跑不通的出路"(§0.8)`,
      )
    }
  }
  return map
}
export const LEDGER_DELETED = 'archive-gc-deleted.jsonl'
export const LEDGER_FAILED = 'archive-gc-failed.jsonl'

const norm = (p) => String(p).split(sep).join('/')

export function fmtBytes(b) {
  if (typeof b !== 'number' || !Number.isFinite(b)) return '未量到'
  if (b >= MB) return `${(b / MB).toFixed(2)}MB`
  if (b >= 1024) return `${(b / 1024).toFixed(1)}KB`
  return `${b}B`
}

/** 严格"在归档根之内"(Windows 路径大小写不敏感 ⇒ 两侧同转小写)。 */
export function isInsideRoot(root, p) {
  const r = norm(resolve(root)).toLowerCase().replace(/\/+$/, '')
  const q = norm(resolve(p)).toLowerCase().replace(/\/+$/, '')
  return q.length > r.length && q.startsWith(`${r}/`)
}

/** 目标是否落在 `.ihui-agent/state`(含 state 本身)之内。 */
export function isInsideStateDir(p) {
  const s = norm(resolve(STATE_DIR)).toLowerCase().replace(/\/+$/, '')
  const q = norm(resolve(p)).toLowerCase().replace(/\/+$/, '')
  return q === s || q.startsWith(`${s}/`)
}

/**
 * 人读面的射程说明:本次射程是谁指定的、该目录已有器物是谁。
 * 纯函数(只做路径比较,零 I/O),测试可直接调。
 * @returns {string}
 */
export function scopeNote(root) {
  const r = norm(resolve(root)).toLowerCase().replace(/\/+$/, '')
  const std = STD_GIT_ARCHIVE
    ? norm(resolve(STD_GIT_ARCHIVE)).toLowerCase().replace(/\/+$/, '')
    : null
  if (std && r === std) {
    return (
      '该目录=票面点名的 gitArchiveDir() 事故现场归档;已有器物:' +
      'scripts/retire-git-archive.mjs(package.json archive:retire)已按同一句拍板覆盖 ⇒ 本器不替代它'
    )
  }
  return (
    '该目录不是票面点名的 gitArchiveDir();本次射程由调用方 --root 显式指定 ⇒ ' +
    '该目录已有器物(含 retire-git-archive 是否覆盖)由调用方自行确认'
  )
}

/**
 * 根是不是 gitdir / git 恢复源形态(§5b 禁删名单的结构判据)。
 * 判据只认两条**结构事实**:根下有 `HEAD` 文件 ∧ `objects/` 目录 —— 活 gitdir(非裸仓)
 * 与裸仓两种形态都命中;仓内归档根(`.DevEnv/backups/git` 里的 `head-<date>.tar`)
 * 因大小写/连字符不同不会误判。构造面取证见镜像 T17。
 */
export function looksLikeGitRepo(root) {
  try {
    if (!lstatSync(join(root, 'HEAD')).isFile()) return false
    return lstatSync(join(root, 'objects')).isDirectory()
  } catch {
    return false
  }
}

/**
 * 归档根的准入判据(纯函数,便于构造面取证):
 *  · 不得是 `.ihui-agent/state` 或其子目录(那里是正在用的状态文件);
 *  · 不得是仓根或仓的祖先(删那里等于删仓库);
 *  · 不得是 gitdir / 本地恢复源形态(§5b 明文禁删,零例外);
 *  · 必须是已存在的目录(根取不到 ⇒ 无法判定,不冒删)。
 * @returns {{ok:true}|{ok:false,why:string}}
 */
export function assertSafeRoot(root) {
  const r = resolve(root)
  if (isInsideStateDir(r)) return { ok: false, why: `根落在 .ihui-agent/state 之内:${r}` }
  const repo = resolve(REPO_ROOT).toLowerCase()
  const rr = r.toLowerCase()
  if (rr === repo || repo.startsWith(rr.endsWith(sep) ? rr : `${rr}${sep}`))
    return { ok: false, why: `根是仓根或其祖先:${r}` }
  let st
  try {
    st = lstatSync(r)
  } catch (e) {
    return { ok: false, why: `根不存在或不可读:${r}(${e.code})` }
  }
  if (st.isSymbolicLink()) return { ok: false, why: `根是重解析点,拒绝对它做任何删除判定:${r}` }
  if (!st.isDirectory()) return { ok: false, why: `根不是目录:${r}` }
  if (looksLikeGitRepo(r))
    return {
      ok: false,
      why: `根是 gitdir / 本地恢复源形态(有 HEAD ∧ objects/):§5b 禁删名单 ⇒ 零例外拒跑:${r}`,
    }
  return { ok: true }
}

/**
 * 世代 = 归档事件代,从**文件名**取,不取 mtime。
 * 立因(现读):`.ihui-agent/archive` 里大量文件的 mtime 被批量搬迁改成同一时刻
 * (`2026-10-21 15:56:39`),拿 mtime 排世代会把 70 件压成一代 ⇒ 判据失效。
 * 取名字里**最后一个** `YYYY-MM-DD` 为世代日;紧跟的 `a/b/c…` 是同日内的第 1/2/3… 代
 * (实测既有命名 `AGENTS_trim-2026-10-23.md` / `-2026-10-23b.md` / `-2026-10-23c.md`)。
 * 取不到日期 ⇒ 返回 null(调用方按"判不出世代"保留并报名,不得猜)。
 */
export function parseGeneration(name) {
  const re = /(\d{4})-(\d{2})-(\d{2})([a-z])?/g
  let last = null
  let m
  while ((m = re.exec(String(name)))) last = m
  if (!last) return null
  const day = `${last[1]}-${last[2]}-${last[3]}`
  const ordinal = last[4] ? last[4].charCodeAt(0) - 96 : 0
  return { day, ordinal, key: `${day}#${String(ordinal).padStart(2, '0')}` }
}

/** 归档根顶层条目名(不可读 ⇒ 抛错,由调用方判"无法判定",不得当成空目录)。 */
export function listEntries(root) {
  if (!existsSync(root)) throw new Error(`归档根不存在:${root}`)
  return readdirSync(root).sort((a, b) => a.localeCompare(b))
}

/**
 * 单件分类。**判序是安全属性,不得重排**:
 * lstat(拿链接本体,不跟随)→ 重解析点拒收 → 目录拒收 → 非普通文件拒收 → 越界拒收
 * → 正在被引用的件拒收 → 体量/世代可判 → 稳定窗 → in-scope。
 */
export function classifyEntry({ root, name, now = Date.now(), protectedNames = null }) {
  const protectedMap = protectedNames instanceof Map ? protectedNames : protectedNameMap()
  const p = join(root, name)
  const row = {
    name,
    path: p,
    kind: 'undetermined',
    reason: '',
    bytes: null,
    gen: null,
    rank: null,
    decision: null,
    criterion: null,
    mtimeMs: null,
  }
  let st
  try {
    st = lstatSync(p)
  } catch (e) {
    row.reason = `lstat 失败:${e.code} ⇒ 保留(未判定,不删)`
    return row
  }
  row.mtimeMs = st.mtimeMs
  if (st.isSymbolicLink()) {
    row.kind = 'protected'
    row.reason = 'P-a 重解析点(junction/符号链接):不跟随、不代断链 ⇒ 保留'
    return row
  }
  if (st.isDirectory()) {
    row.kind = 'protected'
    row.reason = '目录形态:本工具只回收顶层归档文件,目录整棵不碰 ⇒ 保留'
    return row
  }
  if (!st.isFile()) {
    row.reason = '非普通文件 ⇒ 体量/身份判不出,保留(未判定)'
    return row
  }
  let real
  try {
    real = realpathSync(p)
  } catch (e) {
    row.reason = `realpath 失败:${e.code} ⇒ 保留(未判定)`
    return row
  }
  if (!isInsideRoot(root, real)) {
    row.kind = 'protected'
    row.reason = 'P-b 规范路径越出归档根 ⇒ 保留'
    return row
  }
  if (BROKEN_NAME_RE.test(name)) {
    row.kind = 'protected'
    row.reason = `C-b §5b 禁删名单(事故签名 \`*.broken-*\`/\`*.stale-*\`)⇒ 结构上不进候选`
    return row
  }
  if (protectedMap.has(name)) {
    row.kind = 'protected'
    row.reason = protectedMap.get(name)
    return row
  }
  if (typeof st.size !== 'number' || !Number.isFinite(st.size)) {
    row.reason = '量不到体量 ⇒ 保留(未判定)'
    return row
  }
  const gen = parseGeneration(name)
  if (!gen) {
    row.reason = '文件名里没有 YYYY-MM-DD ⇒ 判不出世代 ⇒ 保留(未判定)'
    return row
  }
  row.bytes = st.size
  row.gen = gen
  if (now - st.mtimeMs < MIN_AGE_MS) {
    row.kind = 'protected'
    row.reason = `稳定窗内(mtime 距今 ${Math.max(0, Math.round(now - st.mtimeMs))}ms < ${MIN_AGE_MS}ms)⇒ 保留`
    return row
  }
  row.kind = 'in-scope'
  row.reason = '归档文件(世代可判、体量可量)'
  return row
}

const cmpGen = (a, b) => a.gen.day.localeCompare(b.gen.day) || a.gen.ordinal - b.gen.ordinal

/**
 * 纯函数:三条判据的判定。
 *  - 世代地板:最新 `keepGenerations` 个世代内的件 → 保留出口 `gen<=keep`;
 *  - 体积上限:超 `maxItemBytes` 的件 → 删,出口 `itemBytes>max`;
 *  - 总数上限:条目总数超 `maxFiles` ⇒ 从最老的可删件起删,出口 `count>max`;
 *    可删集用尽仍超 ⇒ `capUnmet:true`(只报不硬删)。
 * 同世代并列按名字升序定序:不确定序会让"到底删了哪个"不可复现。
 */
export function planGc({
  entries,
  keepGenerations = DEFAULT_KEEP_GENERATIONS,
  maxFiles = DEFAULT_MAX_FILES,
  maxItemBytes = DEFAULT_MAX_ITEM_BYTES,
}) {
  const inScope = entries.filter((e) => e.kind === 'in-scope').map((e) => ({ ...e }))
  const gens = [...new Map(inScope.map((e) => [e.gen.key, e.gen])).values()].sort(
    (a, b) => a.day.localeCompare(b.day) || a.ordinal - b.ordinal,
  )
  const rankByKey = new Map(
    gens
      .slice()
      .reverse()
      .map((g, i) => [g.key, i]),
  )

  const out = []
  const pool = []
  for (const e of inScope) {
    e.rank = rankByKey.get(e.gen.key)
    if (e.rank < keepGenerations) {
      e.decision = 'keep'
      e.reason = `gen<=keep(近 ${keepGenerations} 代保护,第 ${e.rank + 1} 新代)⇒ 保留`
      out.push(e)
      continue
    }
    if (e.bytes > maxItemBytes) {
      e.decision = 'retire'
      e.criterion = 'itemBytes'
      e.reason = `itemBytes>max(单件 ${fmtBytes(e.bytes)} > ${fmtBytes(maxItemBytes)})`
      out.push(e)
      continue
    }
    pool.push(e)
  }

  const total = entries.length
  // 两轴独立不是“各删各的”:已被 itemBytes 判删的件已经离场,不能再算进总数差额,
  // 否则总数轴会重复记它们、把保留数压到 maxFiles 以下(过删)。
  const itemBytesRetired = out.filter((e) => e.criterion === 'itemBytes').length
  const overflow = Math.max(0, total - itemBytesRetired - maxFiles)
  pool.sort(cmpGen)
  const take = Math.max(0, Math.min(overflow, pool.length))
  pool.forEach((e, i) => {
    if (i < take) {
      e.decision = 'retire'
      e.criterion = 'count'
      e.reason = `count>max(总件数 ${total} > ${maxFiles},从最老起删)`
    } else {
      e.decision = 'keep'
      e.reason = 'under-caps(未触任何上限)⇒ 保留'
    }
    out.push(e)
  })

  const retire = out.filter((e) => e.decision === 'retire')
  retire.sort(cmpGen)
  const keep = out.filter((e) => e.decision === 'keep')
  const protectedRows = entries.filter((e) => e.kind === 'protected')
  const undetermined = entries.filter((e) => e.kind === 'undetermined')
  return {
    keepGenerations,
    maxFiles,
    maxItemBytes,
    totalFiles: total,
    generations: gens,
    itemBytesRetired,
    retire,
    keep,
    protected: protectedRows,
    undetermined,
    capUnmet: overflow > take,
    overflow,
    retainedCount: keep.length + protectedRows.length,
  }
}

/**
 * 唯一删除出口。删除那一刻**逐件现场复验**(不信任早先那份计划):
 * ① 仍在归档根内且不在 state 内 ② 不是重解析点 ③ 仍是普通文件 ④ 已过稳定窗。
 * `rmSync` 不带 `recursive` ⇒ 结构上删不到目录。
 * @returns {{ok:boolean, why?:string}}
 */
export function removeEntry({ root, name, path, now = Date.now() }) {
  const fail = (why) => ({ ok: false, why })
  const p = path || join(root, name)
  if (isInsideStateDir(p)) return fail('C-s 目标落在 .ihui-agent/state 内,拒绝删除')
  if (!isInsideRoot(root, p)) return fail('P-b 越界:目标规范路径不在归档根之内,拒绝删除')
  let st
  try {
    st = lstatSync(p)
  } catch (e) {
    if (e.code === 'ENOENT') return fail('条目已不存在(未删任何东西)')
    return fail(`lstat 失败:${e.code}`)
  }
  if (st.isSymbolicLink()) return fail('P-a 重解析点:不跟随、不代断链')
  if (!st.isFile()) return fail('非普通文件:本工具只删顶层归档文件')
  const age = now - st.mtimeMs
  if (age < MIN_AGE_MS) return fail(`稳定窗内:mtime 距今 ${Math.round(age)}ms < ${MIN_AGE_MS}ms`)
  try {
    rmSync(p, { force: true })
  } catch (e) {
    return fail(`rmSync 失败:${e.code} ${e.message}`)
  }
  if (existsSync(p)) return fail('删除后回读仍在 ⇒ 未生效')
  return { ok: true }
}

/**
 * 单件内容 sha256(删除留痕用)。取不到 ⇒ `{ok:false, why}`,调用方记 null + 原因,
 * **不得用空串冒充"已取证"**。
 * @returns {{ok:true, sha:string}|{ok:false, why:string}}
 */
export function sha256OfFile(p, { maxBytes = SHA_MAX_BYTES } = {}) {
  let st
  try {
    st = lstatSync(p)
  } catch (e) {
    return { ok: false, why: `lstat 失败:${e.code}` }
  }
  if (!st.isFile()) return { ok: false, why: '非普通文件,不取 sha' }
  if (st.size > maxBytes) return { ok: false, why: `体积 ${fmtBytes(st.size)} 超上限,未读全文` }
  try {
    return { ok: true, sha: createHash('sha256').update(readFileSync(p)).digest('hex') }
  } catch (e) {
    return { ok: false, why: `读文件失败:${e.code || e.message}` }
  }
}

/**
 * 射程内**被 git 跟踪**的路径集合(apply 前那道硬门的数据源)。
 * 只读一次 `git ls-files -z -- <相对根>`:零写、零历史、零对象访问。
 * 根在仓外 ⇒ git 结构上不可能跟踪它,直接给空集(不派生、不猜)。
 * 取不到真值 ⇒ `{ok:false}`;调用方必须据此**拒跑**,不得当成"没有入库件"。
 * @returns {{ok:true, tracked:Set<string>, outsideRepo?:boolean}|{ok:false, why:string}}
 */
export function probeTrackedPaths({ root, run } = {}) {
  const r = resolve(root)
  const rel = relative(REPO_ROOT, r)
  if (!rel || rel.startsWith('..') || isAbsolute(rel)) {
    return { ok: true, tracked: new Set(), outsideRepo: true }
  }
  const invoke =
    run ||
    ((args) => {
      try {
        const stdout = execFileSync(process.env.IHUI_GIT_BIN || 'git', args, {
          cwd: REPO_ROOT,
          encoding: 'utf8',
          windowsHide: true, // §5b:漏此参数在计划任务/守护下必弹控制台窗
          timeout: 30_000,
          maxBuffer: 64 * 1024 * 1024,
          // §12g:派生 git 必须显式接管 stdio。
          stdio: ['ignore', 'pipe', 'pipe'],
        })
        return { status: 0, stdout: String(stdout || '') }
      } catch (e) {
        return {
          status: typeof e.status === 'number' ? e.status : null,
          stdout: String(e.stdout || ''),
          error: e.code || e.message,
        }
      }
    })
  const call = invoke(['ls-files', '-z', '--', rel.split(sep).join('/')])
  if (!call || call.status !== 0) {
    return {
      ok: false,
      why: `git ls-files 取不到(rc=${call ? call.status : 'null'} ${call?.error || ''})`.trim(),
    }
  }
  const tracked = new Set()
  for (const item of String(call.stdout || '').split('\0')) {
    if (!item) continue
    tracked.add(norm(resolve(REPO_ROOT, item)).toLowerCase())
  }
  return { ok: true, tracked }
}

/**
 * 硬门判定:待删集里有没有入库件。纯注入面(plan 与 probe 都由调用方给),便于构造取证。
 * 两侧都按 `norm(resolve()).toLowerCase()` 归一 —— 探针输出与计划路径的分隔符/大小写形态
 * 只要有一侧不归一会让这条门**静默放行**(2026-10-27 由 T11 的构造面当场抓到一次)。
 * @returns {{ok:true, hits:string[]}|{ok:false, why:string}}
 */
export function trackedRetirees({ root, plan, probe = probeTrackedPaths }) {
  if (!plan.retire.length) return { ok: true, hits: [] }
  const p = probe({ root })
  if (!p.ok) return { ok: false, why: p.why }
  const tracked = new Set([...p.tracked].map((x) => norm(resolve(x)).toLowerCase()))
  const hits = plan.retire
    .filter((e) => tracked.has(norm(resolve(e.path)).toLowerCase()))
    .map((e) => e.name)
  return { ok: true, hits }
}

/** deleted / failed **双日志**(G-24 原文要求)。写不进不得静默。 */
export function makeLedger(dir) {
  const files = {
    deleted: join(dir, LEDGER_DELETED),
    failed: join(dir, LEDGER_FAILED),
  }
  let writeFailures = 0
  const append = (file, row) => {
    try {
      mkdirSync(dir, { recursive: true })
      appendFileSync(file, `${JSON.stringify(row)}\n`)
    } catch (e) {
      writeFailures += 1
      console.error(`❌ 台账写入失败 ${file}:${e.code || e.message} ⇒ 这次删除的出处无据可查`)
    }
  }
  return {
    files,
    writeFailures: () => writeFailures,
    deleted: (row) => append(files.deleted, row),
    failed: (row) => append(files.failed, row),
  }
}

/** 执行计划。`remove` 可注入,镜像测试据此断言"保护件永不进入删除路径"。 */
export function applyPlan({ root, plan, ledger, remove = removeEntry, now = Date.now() }) {
  const deleted = []
  const failed = []
  for (const e of plan.retire) {
    const sha = sha256OfFile(e.path)
    const r = remove({ root, name: e.name, path: e.path, now })
    const row = {
      ts: new Date().toISOString(),
      op: r.ok ? 'deleted' : 'failed',
      name: e.name,
      path: e.path,
      criterion: e.criterion,
      bytes: e.bytes,
      sha256: sha.ok ? sha.sha : null,
      shaWhy: sha.ok ? null : sha.why,
      why: e.reason,
      error: r.why || null,
    }
    if (r.ok) {
      deleted.push(row)
      ledger.deleted(row)
    } else {
      failed.push(row)
      ledger.failed(row)
    }
  }
  return { deleted, failed }
}

const KNOWN = new Set([
  '--apply',
  '--dry-run',
  '--keep',
  '--max-files',
  '--max-item-bytes',
  '--root',
  '--ledger-dir',
])
const VALUE_FLAGS = new Set(['--keep', '--max-files', '--max-item-bytes', '--root', '--ledger-dir'])

function parseArgs(argv) {
  const out = {
    apply: false,
    dryRun: false,
    keep: null,
    maxFiles: null,
    maxItemBytes: null,
    root: null,
    ledgerDir: null,
  }
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i]
    if (!KNOWN.has(a))
      return {
        error: `未知参数:${a}(只认 --apply/--dry-run/--keep/--max-files/--max-item-bytes/--root/--ledger-dir)`,
      }
    if (VALUE_FLAGS.has(a)) {
      const v = argv[i + 1]
      if (!v || v.startsWith('--')) return { error: `${a} 缺值` }
      out[a.replace(/^--/, '').replace(/-([a-z])/g, (_, c) => c.toUpperCase())] = v
      i += 1
    } else if (a === '--apply') out.apply = true
    else out.dryRun = true
  }
  if (out.apply && out.dryRun) return { error: '--apply 与 --dry-run 互斥,不得同给' }
  return out
}

function renderLine(e) {
  const tag = e.decision === 'retire' ? '待删  ' : e.kind === 'undetermined' ? '未判定' : '保留  '
  const size = fmtBytes(e.bytes)
  const gen = e.gen ? e.gen.key : '世代?'
  return `${tag}  ${e.name}  [${size} · ${gen}]  ${e.reason}`
}

/** CLI 主体(导出给镜像测试直接调,零真实删除路径)。 */
export function runMain({
  argv,
  stdout = console.info,
  stderr = console.error,
  probe,
  liveDocs: liveDocsOverride = null,
}) {
  const args = parseArgs(argv)
  if (args.error) {
    stderr(`❌ ${args.error}`)
    return 2
  }
  const keep = args.keep === null ? DEFAULT_KEEP_GENERATIONS : Number(args.keep)
  const maxFiles = args.maxFiles === null ? DEFAULT_MAX_FILES : Number(args.maxFiles)
  const maxItemBytes =
    args.maxItemBytes === null ? DEFAULT_MAX_ITEM_BYTES : Number(args.maxItemBytes)
  if (!Number.isInteger(keep) || keep < 0) {
    stderr(`❌ --keep 非法:${args.keep}(需 ≥0 的整数)`)
    return 2
  }
  if (!Number.isInteger(maxFiles) || maxFiles < 1) {
    stderr(`❌ --max-files 非法:${args.maxFiles}(需 ≥1 的整数)`)
    return 2
  }
  if (!Number.isFinite(maxItemBytes) || maxItemBytes <= 0) {
    stderr(`❌ --max-item-bytes 非法:${args.maxItemBytes}(需 >0 的数字)`)
    return 2
  }

  if (!args.root) {
    stderr(
      '❌ 未指定射程:票面只点名 gitArchiveDir(),本器不预置默认根;' +
        '请用 --root <dir> 显式指定(例如 --root .ihui-agent/archive)⇒ 不记通过',
    )
    return 2
  }
  const root = resolve(args.root)
  const safe = assertSafeRoot(root)
  if (!safe.ok) {
    stderr(`❌ 无法判定:${safe.why} ⇒ 不冒删,也不记通过`)
    return 2
  }

  const now = Date.now()
  // 活文档引用保护:判不出谁被正文点名就不冒删(失效方向恒为"多留")。
  const liveDocs = liveDocsOverride || liveDocArchiveRefs()
  if (!liveDocs.read.length) {
    stderr(
      `❌ 无法判定:活文档一份都读不到(${LIVE_DOC_NAMES.join('/')})⇒ 判不出哪些归档件被正文引用,` +
        '不冒删,也不记通过',
    )
    return 2
  }
  const protectedNames = protectedNameMap(liveDocs.names)
  let names
  try {
    names = listEntries(root)
  } catch (e) {
    stderr(`❌ 无法判定:归档根枚举失败(${e.message})⇒ 记"未判定"而非"无可删"`)
    return 2
  }
  const entries = names.map((name) => classifyEntry({ root, name, now, protectedNames }))
  const plan = planGc({ entries, keepGenerations: keep, maxFiles, maxItemBytes })

  stdout(`本次射程:${root}`)
  stdout(`射程说明:${scopeNote(root)}`)
  stdout(
    `档位:保留最近 ${plan.keepGenerations} 代 · 总数上限 ${plan.maxFiles} · 单件体积上限 ${fmtBytes(plan.maxItemBytes)}`,
  )
  stdout(`条目:${plan.totalFiles} 件(世代 ${plan.generations.length} 个)`)
  stdout(
    `活文档引用保护:${liveDocs.names.size} 个名字来自 ${liveDocs.read.join('/')}` +
      (liveDocs.missing.length ? `(读不到:${liveDocs.missing.join('/')})` : ''),
  )
  // 可判件数单列一行:调度臂据此判"这个射程对本器是不是结构性空转"(全是目录/保护件 ⇒ 0)。
  stdout(
    `可判(in-scope)${plan.retire.length + plan.keep.length} 件 · ` +
      `受保护 ${plan.protected.length} 件 · 未判定 ${plan.undetermined.length} 件`,
  )

  for (const e of plan.retire) stdout(renderLine(e))
  for (const e of plan.keep) stdout(renderLine(e))
  for (const e of plan.protected) stdout(renderLine(e))
  for (const e of plan.undetermined) stdout(renderLine(e))

  if (plan.capUnmet) {
    stdout(
      `⚠ 总数上限未达:仍 ${plan.totalFiles} 件 > ${plan.maxFiles};可删集已用尽` +
        `(差额 ${plan.overflow} 件落在近 ${plan.keepGenerations} 代保护 / 未判定 / 保护名单里,不硬删)`,
    )
  }

  const z = plan.undetermined.length
  if (z) {
    stdout(`未判定 ${z} 件(不删、不记绿,点名:${plan.undetermined.map((e) => e.name).join(', ')})`)
  }
  if (!args.apply) {
    stdout('[dry-run] 未发起任何删除。真删再加 --apply(三条判据在删除那一刻仍逐件复验)。')
    stdout(`保留 ${plan.retainedCount} / 待删 ${plan.retire.length} / 未判定 ${z}`)
    return z ? 2 : 0
  }

  // ── 硬门:入库文件不得用 rmSync 回收 ────────────────────────────────
  // 立因见头注「入库文件硬门」。方向刻意是"宁可不删":删了会被门 71/checkout 还原,
  // 台账却已记 deleted ⇒ 假绿,且把 63 条 D 挂到共享工作树上。
  const gate = trackedRetirees({ root, plan, probe: probe || probeTrackedPaths })
  if (!gate.ok) {
    stderr(`❌ 量不确认:判不出待删件是否入库(${gate.why})⇒ 拒跑,零删除,不记绿`)
    return 2
  }
  if (gate.hits.length) {
    stderr(
      `❌ T-g 拒跑:待删集里有 ${gate.hits.length} 件是 git 跟踪文件 —— ` +
        'rmSync 删它们只会留 D 条目,门 71/checkout 会按 HEAD 还原,台账却记了 deleted',
    )
    for (const n of gate.hits.slice(0, 10)) stderr(`   · ${n}`)
    if (gate.hits.length > 10) stderr(`   · …共 ${gate.hits.length} 件`)
    stderr('   ⇒ 零删除。入库归档的正确回收方式是 `git rm <path>` + 一笔入库提交(机主),不是本器。')
    return 2
  }

  const ledger = makeLedger(args.ledgerDir ? resolve(args.ledgerDir) : STATE_DIR)
  const res = applyPlan({ root, plan, ledger, now })
  for (const f of res.failed) stderr(`  ❌ ${f.name} ⇒ ${f.error}`)
  stdout(
    `[apply] deleted=${res.deleted.length} failed=${res.failed.length} ` +
      `(deleted/failed 双日志:${ledger.files.deleted} / ${ledger.files.failed})`,
  )
  stdout(`保留 ${plan.retainedCount} / 待删 ${plan.retire.length} / 未判定 ${z}`)
  if (res.failed.length || ledger.writeFailures()) return 1
  return z ? 2 : 0
}

const isDirectRun = process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href
if (isDirectRun) {
  try {
    process.exitCode = runMain({ argv: process.argv.slice(2) })
  } catch (e) {
    console.error(`❌ 脚本自身异常:${e?.message ?? e}\n${e?.stack ?? ''}`)
    process.exitCode = 2
  }
}

export const __test__ = {
  REPO_ROOT,
  STD_GIT_ARCHIVE,
  STATE_DIR,
  DEFAULT_KEEP_GENERATIONS,
  DEFAULT_MAX_FILES,
  DEFAULT_MAX_ITEM_BYTES,
  MIN_AGE_MS,
  IN_USE_NAMES,
  BROKEN_NAME_RE,
  LIVE_DOC_NAMES,
  archiveRefsFromText,
  liveDocArchiveRefs,
  protectedNameMap,
  norm,
  fmtBytes,
  isInsideRoot,
  isInsideStateDir,
  scopeNote,
  looksLikeGitRepo,
  assertSafeRoot,
  parseGeneration,
  listEntries,
  classifyEntry,
  planGc,
  removeEntry,
  sha256OfFile,
  probeTrackedPaths,
  trackedRetirees,
  makeLedger,
  applyPlan,
  parseArgs,
  runMain,
}
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
