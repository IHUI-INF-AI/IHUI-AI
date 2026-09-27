#!/usr/bin/env node
// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * retire-git-archive.mjs — gitdir 事故归档的回收器(G-245,2026-09-27 立)
 *
 * 病灶(票面实测;现值一律跑本工具读末行,不得照抄文档数字):`gitArchiveDir()`(本机实测
 * `G:/DevEnv/backups/git`)只被两处写入 —— `scripts/git-lock.mjs` 抢占悬挂锁改名的
 * `<锁名>.stale-<pid>-<ts>-<rand>`、以及 `scripts/git-guardian.mjs` / `git-rebuild-local.mjs`
 * 落盘的 `<gitdir>.broken-<ts>` 现场 —— **全链没有任何一处在回收它**。于是每判一次"锁悬挂"
 * 就在归档目录里长出一个永久目录:实测一日内 `ihui-git-write.lock.stale-*` 已累计 56 个,
 * 归档根合计 59 项 / 1.09GB,增速与并发会话数成正比。§5b 的分层自愈依赖归档现场,
 * 但"保留多少现场"这件事此前的默认值是"永远保留"。
 *
 * 用户拍板(2026-09-27):**双上限 + 保留最近 10 代**
 *   上限一 keepGenerations = 10  ← 用户给的值
 *   上限二 maxTotalBytes  = 2 GiB ← **这个默认值是我(实现票)替用户定的**,依据是当前实测体积
 *         1.09GB:约留一倍余量给守护突发归档,又足够让人在"归档目录膨胀"吃穿磁盘前看见它。
 *         两个上限都可配:`--keep <n>` / `--max-bytes <n>`,或 env `IHUI_GIT_ARCHIVE_KEEP` /
 *         `IHUI_GIT_ARCHIVE_MAX_BYTES`。换档位不需要改代码。
 *
 * 不可越界的一条(AGENTS §5b,比功能本身重要)
 * ────────────────────────────────────────────
 * §5b 明文禁止删除:活 gitdir(`<工作树>-git-repo` 形态)、本地恢复源(`*.git-backup-*`)、
 * 以及这两者的 `*.broken-*` 现场归档。所以本工具:
 *   1) **候选集只允许是 `gitArchiveDir()` 之内的顶层条目**。落点取自 `lib/gitdir.mjs` 的出口,
 *      绝不自己拼盘符 —— §15b/§5b 各记过一次:硬编码盘符 ⇒ 备份路径解析到不存在处,表现是
 *      `git-guardian --status` 的 `backupOk:false` 这类**静默失效**。
 *   2) 三条互相独立的拒收判据(每一条都有阳性对照,见 `--self-test` S3/S6):
 *      **P-a 重解析点** 是 junction/符号链接就一律不删 —— §26 实测"递归删除顺着链接把 D 盘
 *         真实目标清空",而链接本体在目录列表里完全像垃圾。既不跟随也不代断链,只点名交人工。
 *      **P-b 越界** 规范路径不在归档根之内 ⇒ 拒收并点名(拦"名字像归档、路径指向别处")。
 *      **P-c §5b 名单** 基名等于活 gitdir / 本地恢复源(由 siblingGitdir() / resolveBackupDir()
 *         推得),或命中 `-git-repo` / `.git-backup-` 形态(含其 `.broken-*` 现场)⇒ 永久不删。
 *   3) **"不在射程"不等于被过滤掉**:未纳管项(如实测存在的 `bundles/`,里面是 §22 的
 *      lost-commit/stash 抢救 bundle,删它违反 §7)一律**按名打印 + 写明理由**。本仓最高频失效型
 *      就是"把没判写成判过了",所以 protected / in-scope / out-of-scope / 判不出 四桶都要报名。
 *
 * 删除出口唯一:`removeEntry()` 是全文件**唯一**一处 `rmSync(`(镜像测试 R2 钉死不得长第二份)。
 * 默认档 = 纯 dry-run,一次 unlink 都不发生(S5 用计数断言钉);只有 `--apply` 才真删,且 apply 前
 * 必然先打印同一份判定。
 *
 * 挂点这一格**刻意未做**(不是遗漏):`scripts/git-guardian.mjs` 此刻在他人手里
 * (`git status --short scripts/git-guardian.mjs` 报 ` M`),按 §12/§16 改它等于抹别人在飞的工作。
 * ▶ **可判的解阻条件(原话)**:当 `git diff --quiet HEAD -- scripts/git-guardian.mjs` 退出码为 0
 *   (即该文件的工作树副本重新等于 HEAD)时,补 `retireGitArchive()` 挂点 —— **必须挂在 `main()` 的
 *   `!CHECK_ONLY` 分支**(与 `healWorktreeTracked()` / `healRootSeal()` 同位;2026-09-24 实测:
 *   挂点写成 CHECK_ONLY 路径等于永不执行,而每日 03:00 体检兜不住 23 小时空窗,见 §26 `healRootSeal`
 *   那一格),并同时补三条装车锁:
 *     ① 注册点在位 —— `grep -c retire-git-archive scripts/git-guardian.mjs` ≥ 1 且命中行落在
 *        `!CHECK_ONLY` 分支之内("门在、判据对、无人调度"是本仓最多次的失效形态);
 *     ② 守护档一律 `apply:false` —— 先观察一轮真实判定量,再谈自动删;**删除档与冷层各自都要
 *        `apply:false` / `cold-apply:false`** —— 移动归档现场比删除更难逆(删除还有台账指回冷侧副本,
 *        移动则把恢复路径整体挪走),所以自动档只能把判定量摆出来,不许动手;
 *     ③ 镜像测试必须在"摘掉挂点"时翻红(scripts/tests/retire-git-archive.test.mjs 的 R5 反证臂)。
 *
 * 用法:
 *   node scripts/retire-git-archive.mjs                     # 默认 dry-run,零删除
 *   node scripts/retire-git-archive.mjs --json               # 机器可读
 *   node scripts/retire-git-archive.mjs --keep 10 --max-bytes 2147483648
 *   node scripts/retire-git-archive.mjs --apply              # 真删(§5b 三判据在删除那一刻复验)
 *   node scripts/retire-git-archive.mjs --apply --root <dir> --allow-custom-root  # 人工换根
 *   node scripts/retire-git-archive.mjs --self-test          # 12 组取证,夹具走 mkScratch,零真实影响
 * 退出码:0 = 正常(dry-run / 删除全成功);1 = 有删除失败;2 = **无法判定**(归档根取不到、
 * 换根未声明、枚举失败、存在判不出项)。判定拿不到不记绿。
 *
 * ────────────────── 冷存储层(G-264,2026-09-27 用户拍板"超 30 天的现场转冷存储")──────────────────
 * 批准的是**移动**,不是删除 —— 这条区别是全部风险所在:移动 = 现有恢复路径**找不到它**,
 * 所以可逆性与留痕必须先做到位,再谈动手。
 *
 * 目录形状:`<gitArchiveDir()>/cold/<原顶层条目名>`。落点仍在 §15b"项目外唯一备份目录"体系内,
 * 盘符一律经 `lib/gitdir.mjs` 的 `gitArchiveDir()` 推导 —— 本层不拼第二个盘符。
 * 台账:`<gitArchiveDir()>/cold/cold-move-ledger.jsonl`,每条记
 * `{ts, op, name, from, to, files, srcBytes, dstBytes, verifiedAt, ok, why}`;写不进必须喊(§5e)。
 *
 * 与删除档**共享**的三条拒收判据(冷层同样成立,一条都不放宽):
 *   **P-a** 顶层条目是重解析点 ⇒ 不转(§26:顺链接递归会把真实目标搬空/清空);**源树内部**出现
 *           重解析点也整项拒收并点名 —— 静默跳过会让"副本 vs 源"的逐字节校验照样通过,而那份副本
 *           已经少了一格,这是"把没判写成判过了"同型。
 *   **P-b** 规范路径越出归档根 ⇒ 不转。
 *   **P-c** §5b 名单(活 gitdir / 本地恢复源**及其 `.broken-*` 现场**)⇒ 不转。本层**不替用户裁决
 *           §5b**:§5b 写的是"禁止删除"、G-264 写的是"转冷",两条都是明文,而"把活 gitdir 的现场快照
 *           搬走"落在两者交集之外 ⇒ 只报名、只报数。**现读**(落地当轮跑本工具末行):1.1GB 大头正是
 *           这一档与 `bundles/`,本层**都不转** ⇒ 不得把"冷层落地"读成"1.1GB 已腾走"。
 *   **C-u** 归档根内**当前仍被写方引用**的子目录(`broken-refs` = `git-backup-refresh.mjs` 的现场归档
 *           落点)与冷层自身落点(`cold`)⇒ 永不进任何一档。这两个名字必须显式在册而不是靠"恰好没有
 *           事故签名":没有它们,一次改名/形态变化就会让"正在被引用的目录"变成"看起来像垃圾的顶层条目"。
 *
 * 另三条只在冷层生效:
 *   1) **绝不删除任何东西**:全程 `copy → 逐文件(相对路径 + 字节数)校验 → 才动源`,照 §26 /
 *      `re-home-junctions.mjs` 的改道流程。**动源那一步复用 `removeEntry()`** —— 它是全文件唯一一处
 *      `rmSync`,于是"三条现场复验"与"删除出口唯一"两条既有锁同时覆盖新路径,不必也不许长第二个出口。
 *      校验不等 ⇒ 保留副本、源原样不动、喊出来(副本留着给人查,不是留着给人忽略)。
 *   2) **最近 10 代不动** ∧ **mtime < 30 天不动**:与删除档**同一把尺子** —— 直接复用 `planRetirement`
 *      的 keepSet / inFlight,不在别处再排一遍序(两处排序必漂移是本仓记过最多次的失效型)。
 *   3) **磁盘余量不足 ⇒ 整轮拒跑并打印实数**:复制期内同卷短时翻倍占用,所以先量后动;
 *      `fs.statfsSync` 量不到 ⇒ 判"无法判定"并拒 apply,绝不把"量不到"当成"够"。
 *
 * `bundles/`(G-264 判据五):里面是 §22 的 `lost-commit/*` 与 stash 抢救 bundle。本层对它
 * **只报名、只报数、一律不转** —— 按名字命中 `lost-commit`/`stash` 的按"未验明唯一副本身份"留着。
 * 要转的前提是**证明它在远端另有副本**(`git ls-remote` 前缀 glob + `git cat-file` 实测),而本层没有
 * 网络派生通道、也没有会去消费它的调用方 ⇒ **判不出就留着**,不按名字猜,也不造一条没人调的"证明开关"
 * ("造好没装车"是本仓最多次的红点)。
 *
 * 反向命令:`--restore <名字>` 把一项从 `cold/` 放回原位(同样 copy → 逐文件字节校验 → 才动冷侧;
 * 原位已有同名 ⇒ 直接拒绝,**绝不覆盖**)。
 *
 * 冷层用法:
 *   node scripts/retire-git-archive.mjs --cold                # 冷层 dry-run:零移动,只报判定
 *   node scripts/retire-git-archive.mjs --cold-apply          # 真转冷(前置:磁盘余量实测够)
 *   node scripts/retire-git-archive.mjs --cold-days 45        # 换阈值(默认 30;env IHUI_GIT_ARCHIVE_COLD_DAYS)
 *   node scripts/retire-git-archive.mjs --min-free-mb 1024    # 换余量下限(默认 512)
 *   node scripts/retire-git-archive.mjs --restore <名字>      # 从 cold/ 放回原位
 * 冷层退出码:0 = dry-run 或全部搬成功;1 = 有项未搬成 / 余量不足整轮拒跑;
 * 2 = 无法判定(根取不到、statfs 量不到、`<名字>` 在 cold/ 里找不到)。
 *
 * 本工具不派生子进程(所有 git 查询经 lib/gitdir.mjs 的既有出口,那里已带绝对路径 +
 * `-c safe.directory=*` + timeout + windowsHide),不做任何 git 写操作。
 */

import {
  appendFileSync,
  copyFileSync,
  existsSync,
  lstatSync,
  mkdirSync,
  readdirSync,
  readFileSync,
  readlinkSync,
  realpathSync,
  rmSync,
  statfsSync,
  symlinkSync,
  utimesSync,
  writeFileSync,
} from 'node:fs'
import { basename, dirname, join, resolve, sep } from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'

import { mkScratch, rmScratch } from './lib/scratch-dir.mjs'
import { gitArchiveDir, resolveBackupDir, siblingGitdir } from './lib/gitdir.mjs'

// ── 档位(keepGenerations 是用户拍板值;maxTotalBytes 是本文顶部声明的替定默认值)──
export const DEFAULT_KEEP_GENERATIONS = Number(process.env.IHUI_GIT_ARCHIVE_KEEP || 10)
export const DEFAULT_MAX_TOTAL_BYTES = Number(
  process.env.IHUI_GIT_ARCHIVE_MAX_BYTES || 2 * 1024 * 1024 * 1024,
)
/** mtime 稳定窗:距今不足 1 秒的条目按"正在写"处理,永不回收。 */
export const MIN_AGE_MS = 1000
/** 单次体积遍历的文件数上限:超了把该项标"未量到",不得让一次 dry-run 无界跑下去。 */
const MAX_WALK_FILES = 400000

// ── 冷存储层档位(G-264)──────────────────────────────────────────────────────────────
/** 用户拍板的"超 30 天转冷";可配 `--cold-days` / env `IHUI_GIT_ARCHIVE_COLD_DAYS`。 */
export const DEFAULT_COLD_AGE_DAYS = Number(process.env.IHUI_GIT_ARCHIVE_COLD_DAYS || 30)
/** 冷存储落点(在归档根之内 ⇒ 同卷、且天然被 `isInsideRoot` 的越界判据罩住)。 */
export const COLD_DIR_NAME = 'cold'
export const COLD_LEDGER_FILE = 'cold-move-ledger.jsonl'
/**
 * 归档根内**当前仍被别处写着引用**的子目录:它们的身份是活的,永不进任何一档。
 * `broken-refs` 的出处 = `scripts/git-backup-refresh.mjs` 的 `join(archiveDir, 'broken-refs')`。
 * 这一档不靠"恰好没有事故签名"兜底 —— 改名或形态一变,被引用的目录就会掉进"看起来像垃圾"那一格。
 */
export const IN_USE_SUBPATHS = Object.freeze(['broken-refs'])
/** 复制期内同卷短时翻倍占用 ⇒ 除所需字节外还要留的余量下限(MB)。 */
export const DEFAULT_MIN_FREE_MB = Number(process.env.IHUI_GIT_ARCHIVE_MIN_FREE_MB || 512)

const HERE = dirname(fileURLToPath(import.meta.url))
const REPO_ROOT = resolve(HERE, '..')
const LOG_REL = '.workbuddy/git-archive-retire.log'
const MB = 1048576

const norm = (p) => String(p).split(sep).join('/')
const fmtMB = (b) => (typeof b === 'number' ? `${(b / MB).toFixed(b >= MB ? 2 : 4)}MB` : '未量到')
const fmtAge = (ms) =>
  typeof ms !== 'number'
    ? '?'
    : ms < 60000
      ? `${Math.max(0, Math.round(ms / 1000))}s`
      : ms < 3600000
        ? `${(ms / 60000).toFixed(0)}m`
        : `${(ms / 3600000).toFixed(1)}h`

/** 严格"在归档根之内"(Windows 路径大小写不敏感 ⇒ 两侧同转小写)。 */
export function isInsideRoot(root, p) {
  const r = norm(resolve(root)).toLowerCase().replace(/\/+$/, '')
  const q = norm(resolve(p)).toLowerCase().replace(/\/+$/, '')
  return q.length > r.length && q.startsWith(`${r}/`)
}

/** 剥掉 `.broken-<...>` / `.stale-<...>` 现场后缀 ⇒ "这个归档是谁的现场"。 */
export function stemOf(name) {
  return String(name).replace(/\.(broken|stale)-[^/]*$/, '')
}

/**
 * §5b 名单里"条目本身"的名字:活 gitdir 与本地恢复源都按 gitdir.mjs 的出口推得
 * (不写死盘符也不写死项目名)。恢复源按 `resolveBackupDir()` 的口径**第一候选就在归档根里**,
 * 所以这条派生名单不是保险,是主判据。
 */
export function protectedBaseNames() {
  const out = []
  for (const fn of [siblingGitdir, resolveBackupDir]) {
    try {
      const p = fn()
      if (p) out.push(basename(norm(p)))
    } catch {
      /* 推不出 ⇒ 少一条派生名单;通用形态判据(下面两条正则)仍在,不静默当成"无名单" */
    }
  }
  return out
}

/** 命中 §5b 禁删名单 ⇒ 返回理由;否则 null。 */
export function protectedReason(name, baseNames = protectedBaseNames()) {
  const stem = stemOf(name)
  if (baseNames.includes(name)) return `§5b 名单:条目本身即活 gitdir / 本地恢复源(${name})`
  if (baseNames.includes(stem)) return `§5b 名单:${stem} 的现场归档`
  if (stem.endsWith('-git-repo')) return '§5b 名单:<工作树>-git-repo 形态(活 gitdir 或其现场归档)'
  if (/\.git-backup-/.test(String(name))) return '§5b 名单:*.git-backup-*(本地恢复源或其现场归档)'
  return null
}

/**
 * C-u:**当前仍被引用**的名字 ⇒ 永不进删除档也不进冷档(与 §5b 同一条"活体不搬"取向)。
 * 冷层落点自身与 `broken-refs` 都在此列 —— 前者搬自己会把台账一起搬走(审计面消失),
 * 后者是 `git-backup-refresh.mjs` 正在写的现场归档目录。
 */
export function inUseReason(name) {
  const n = String(name)
  if (n === COLD_DIR_NAME)
    return 'C-u 冷存储层自身落点(cold/):搬它等于把恢复路径与台账一起搬走 ⇒ 永不进任何一档'
  if (IN_USE_SUBPATHS.includes(n))
    return `C-u 归档根内当前被引用的子目录(${n}):搬它 = 让写方就地找不到落点`
  return null
}

/** 事故归档签名:`.broken-<ts>`(git-guardian / git-rebuild-local)与 `.stale-*`(git-lock 抢占)。 */
export function hasAccidentSignature(name) {
  return /\.(broken|stale)-[^/]*$/.test(String(name))
}

/** 不跟随重解析点的体积计量(与 c-disk-breakdown 同一条 §26 规矩)。 */
export function measureBytes(path) {
  let st
  try {
    st = lstatSync(path)
  } catch (e) {
    return { bytes: null, reason: `lstat 失败:${e.code}` }
  }
  if (st.isSymbolicLink()) return { bytes: null, reason: '重解析点,刻意不跟随' }
  if (st.isFile()) return { bytes: st.size, reason: null }
  let bytes = 0
  let files = 0
  const stack = [path]
  while (stack.length) {
    const cur = stack.pop()
    let entries
    try {
      entries = readdirSync(cur, { withFileTypes: true })
    } catch {
      continue
    }
    for (const ent of entries) {
      const p = join(cur, ent.name)
      let s
      try {
        s = lstatSync(p)
      } catch {
        continue
      }
      if (s.isSymbolicLink()) continue
      if (s.isDirectory()) stack.push(p)
      else if (s.isFile()) {
        bytes += s.size
        files += 1
        if (files >= MAX_WALK_FILES)
          return { bytes: null, reason: `遍历超 ${MAX_WALK_FILES} 文件上限 ⇒ 未量到` }
      }
    }
  }
  return { bytes, reason: null }
}

/**
 * 单个顶层条目的分类。**判序是安全属性,不得重排**:
 * lstat(拿链接本体属性,不跟随)→ P-a 重解析点拒收 → P-c §5b 名单拒收 → P-b 越界拒收
 * → 事故签名 ⇒ in-scope → 其余 ⇒ out-of-scope(报名,不定性也不删)。
 */
export function classifyEntry({
  root,
  name,
  now = Date.now(),
  measure = true,
  baseNames = protectedBaseNames(),
}) {
  const p = join(root, name)
  const row = {
    name,
    path: p,
    kind: 'undetermined',
    reason: '',
    isLink: false,
    target: null,
    bytes: null,
    mtimeMs: null,
    ageMs: null,
  }
  let st
  try {
    st = lstatSync(p)
  } catch (e) {
    row.reason = `lstat 失败:${e.code}(不算通过,也不删)`
    return row
  }
  row.mtimeMs = st.mtimeMs
  row.ageMs = now - st.mtimeMs
  if (st.isSymbolicLink()) {
    let link = null
    try {
      link = norm(readlinkSync(p))
    } catch {
      /* 读不到链尾就只报"重解析点" */
    }
    let real = null
    try {
      real = norm(realpathSync(p))
    } catch {
      /* 悬空链接:realpathSync 抛错,拒收理由不变 */
    }
    row.isLink = true
    row.target = link || real || '(无法解析)'
    row.kind = 'protected'
    row.reason =
      `P-a 重解析点(junction/符号链接),目标 ${row.target}` +
      (real && !isInsideRoot(root, real) ? ' ⇒ 指向归档根之外' : '') +
      ';§26 实测递归删除会顺链接清空真实目标 ⇒ 一律不删、也不代断链'
    return row
  }
  const pr = protectedReason(name, baseNames)
  if (pr) {
    row.kind = 'protected'
    row.reason = `P-c ${pr}`
    return row
  }
  const iu = inUseReason(name)
  if (iu) {
    row.kind = 'protected'
    row.reason = iu
    return row
  }
  if (!isInsideRoot(root, p)) {
    row.kind = 'protected'
    row.reason = 'P-b 规范路径不在归档根之内 ⇒ 越界拒收'
    return row
  }
  if (!hasAccidentSignature(name)) {
    row.kind = 'out-of-scope'
    row.reason =
      '非事故归档形态(无 .broken-<ts> / .stale-* 签名)⇒ §7 删除安全:未验明身份不删,也不计入候选'
    return row
  }
  row.kind = 'in-scope'
  row.reason = st.isDirectory() ? '事故归档目录' : '事故归档文件'
  if (measure) {
    const m = measureBytes(p)
    row.bytes = m.bytes
    if (m.reason) row.reason += `(${m.reason})`
  }
  return row
}

/** 枚举归档根顶层条目。根不可读 ⇒ 抛错,由调用方判"无法判定",不得当成"空目录 = 无可删"。 */
export function listEntries(root) {
  if (!existsSync(root)) throw new Error(`归档根不存在:${root}`)
  return readdirSync(root).sort((a, b) => a.localeCompare(b))
}

/**
 * 纯函数:双上限判定。
 *  - **世代档** 按 mtime 降序保留最近 keep 个,其余判删(理由 `gen>keep`);
 *  - **字节档** 保留集(含稳定窗内被扣留的项)总量超 maxTotalBytes 时从最旧起继续判删
 *    (理由 `bytes>cap`)。
 * 两条各自独立生效 ⇒ "只超体积不超世代"的形态拦得住(S2 有正反对照)。
 * 同 mtime 并列按名字升序定序:不确定序会让"到底删了哪个"不可复现。
 */
export function planRetirement({
  entries,
  keep = DEFAULT_KEEP_GENERATIONS,
  maxTotalBytes = DEFAULT_MAX_TOTAL_BYTES,
  now = Date.now(),
}) {
  const inScope = entries.filter((e) => e.kind === 'in-scope')
  const inFlight = inScope.filter((e) => typeof e.ageMs === 'number' && e.ageMs < MIN_AGE_MS)
  const flightSet = new Set(inFlight)
  const eligible = inScope
    .filter((e) => !flightSet.has(e))
    .sort((a, b) => b.mtimeMs - a.mtimeMs || a.name.localeCompare(b.name))
  const retire = []
  const keepSet = eligible.slice(0, Math.max(0, keep))
  for (const e of eligible.slice(Math.max(0, keep)))
    retire.push({ ...e, retireReason: `gen>keep(保留最近 ${keep} 代之外)` })
  const sum = (list) => list.reduce((s, e) => s + (typeof e.bytes === 'number' ? e.bytes : 0), 0)
  let retained = sum(keepSet) + sum(inFlight)
  const unmeasured = [...keepSet, ...inFlight].filter((e) => typeof e.bytes !== 'number').length
  while (retained > maxTotalBytes && keepSet.length > 0) {
    // keepSet 是 **mtime 降序**(新→旧),所以要 `pop()` 从**最旧**一头退场。
    // 写成 shift() 会反过来:先扔最新那件现场、把最旧的留在盘上 —— 字节档一生效就毁掉最有用的归档,
    // 而账面只表现为"删了几项",看不出来删错了谁。此形由 --self-test S2 抓到(第一版就是 shift())。
    const oldest = keepSet.pop()
    retained -= typeof oldest.bytes === 'number' ? oldest.bytes : 0
    retire.push({
      ...oldest,
      retireReason: `bytes>cap(保留集超 ${Math.round(maxTotalBytes / MB)}MB)`,
    })
  }
  retire.sort((a, b) => a.mtimeMs - b.mtimeMs || a.name.localeCompare(b.name))
  return {
    keep,
    maxTotalBytes,
    now,
    inScope,
    keepSet,
    inFlight,
    retire,
    retainedBytes: retained,
    inScopeBytes: sum(inScope),
    unmeasured,
    protected: entries.filter((e) => e.kind === 'protected'),
    outOfScope: entries.filter((e) => e.kind === 'out-of-scope'),
    undetermined: entries.filter((e) => e.kind === 'undetermined'),
  }
}

/**
 * 唯一删除出口。三条**现场复验**(删除那一刻重新量,不信任早先那份计划):
 * ① 不是重解析点 ② 规范路径仍在归档根内 ③ mtime 已过稳定窗;外加 §5b 名单再判一次。
 * 返回 {ok, why};失败绝不静默(§5e 同一条禁令)。
 */
export function removeEntry({ root, path, name, now = Date.now(), baseNames }) {
  const fail = (why) => ({ ok: false, why })
  if (!isInsideRoot(root, path)) return fail('P-b 越界:目标规范路径不在归档根之内,拒绝删除')
  let st
  try {
    st = lstatSync(path)
  } catch (e) {
    if (e.code === 'ENOENT') return fail('条目已不存在(未删任何东西)')
    return fail(`lstat 失败:${e.code}`)
  }
  if (st.isSymbolicLink()) return fail('P-a 重解析点:§26 禁止跟随/穿透,本工具也不代断链')
  const pr = protectedReason(name, baseNames || protectedBaseNames())
  if (pr) return fail(`P-c ${pr}`)
  const age = now - st.mtimeMs
  if (age < MIN_AGE_MS)
    return fail(`正在写:mtime 距今 ${Math.max(0, Math.round(age))}ms < ${MIN_AGE_MS}ms`)
  try {
    rmSync(path, { recursive: true, force: true, maxRetries: 5, retryDelay: 200 })
  } catch (e) {
    return fail(`rmSync 失败:${e.code} ${e.message}`)
  }
  if (existsSync(path)) return fail('删除后回读仍在 ⇒ 未生效')
  return { ok: true }
}

/** 执行计划。`remove` 可注入 —— 镜像测试用它证明"§5b 名单永不出现在删除路径参数里"。 */
export function applyPlan({
  root,
  plan,
  apply,
  log,
  remove = removeEntry,
  now = Date.now(),
  baseNames,
}) {
  const deleted = []
  const failed = []
  const refused = []
  let attempted = 0
  for (const e of plan.retire) {
    // dry-run 分支:下面整段不执行 ⇒ 结构上不可能发起删除(S5 计数断言钉这一条)。
    if (!apply) continue
    attempted += 1
    const r = remove({ root, path: e.path, name: e.name, now, baseNames })
    const detail = `${e.name} bytes=${typeof e.bytes === 'number' ? e.bytes : '?'} mtime=${new Date(e.mtimeMs).toISOString()} why=${e.retireReason}`
    if (r.ok) {
      deleted.push(e.name)
      log?.({ kind: 'deleted', detail })
    } else if (/正在写/.test(r.why)) {
      refused.push({ name: e.name, why: r.why })
      log?.({ kind: 'skipped-in-flight', detail })
    } else {
      failed.push({ name: e.name, why: r.why })
      log?.({ kind: 'failed', detail: `${detail} reason=${r.why}` })
    }
  }
  return { deleted, failed, refused, attempted }
}

/** 留痕(deleted / failed / skipped-in-flight 三类分开)。写不进去必须喊,不得静默。 */
export function makeLogger(baseDir) {
  const file = join(baseDir, LOG_REL)
  const log = (rec) => {
    const line = `${new Date().toISOString()}\t${rec.kind}\t${rec.detail}\n`
    try {
      mkdirSync(dirname(file), { recursive: true })
      appendFileSync(file, line, 'utf8')
    } catch (e) {
      console.error(`⚠️ 留痕失败(${e.code})⇒ 本次动作只在此处可见:${line.trim()}`)
    }
    return log
  }
  log.file = file
  return log
}

export function renderReport(plan, root) {
  const L = []
  L.push(`归档根: ${root}`)
  L.push(
    `档位: 保留最近 ${plan.keep} 代 ∧ 保留集 ≤ ${Math.round(plan.maxTotalBytes / MB)}MB(mtime 稳定窗 ${MIN_AGE_MS}ms)`,
  )
  L.push(
    `候选(in-scope)= ${plan.inScope.length} | 将删 = ${plan.retire.length} | 保留 = ${plan.keepSet.length} | 稳定窗内 = ${plan.inFlight.length}`,
  )
  L.push(
    `挡掉(§5b 名单 / C-u 在用路径 / 重解析点)= ${plan.protected.length} 项 | 不在射程 = ${plan.outOfScope.length} 项 | 判不出 = ${plan.undetermined.length} 项 | 候选合计 ${fmtMB(plan.inScopeBytes)} | 判定后保留 ${fmtMB(plan.retainedBytes)}`,
  )
  if (plan.unmeasured)
    L.push(`  ⚠️ ${plan.unmeasured} 项体积未量到 ⇒ 字节上限按已知量偏小判定,不得据此说"没超"`)
  const byReason = (why) => plan.retire.filter((e) => e.retireReason.includes(why))
  const g = byReason('gen>keep')
  const b = byReason('bytes>cap')
  L.push(`按档分解: gen>keep = ${g.length} 项,bytes>cap = ${b.length} 项(两条独立生效)`)
  L.push('\n—— 将删清单(mtime 升序,每条带 mtime 与体积)——')
  if (!plan.retire.length) L.push('  (空)')
  for (const e of plan.retire)
    L.push(
      `  ${e.name}  mtime=${new Date(e.mtimeMs).toISOString()}  age=${fmtAge(e.ageMs)}  ${fmtMB(e.bytes)}  ⇒ ${e.retireReason}`,
    )
  L.push('\n—— 挡掉(§5b 名单 / C-u 在用路径 / 重解析点;永不进候选)——')
  if (!plan.protected.length) L.push('  (无)')
  for (const e of plan.protected) L.push(`  ${e.name}  ⇒ ${e.reason}`)
  L.push('\n—— 不在射程(未验明身份:不删、不定性、但必须报名)——')
  if (!plan.outOfScope.length) L.push('  (无)')
  for (const e of plan.outOfScope) L.push(`  ${e.name}  ⇒ ${e.reason}`)
  if (plan.undetermined.length) {
    L.push('\n—— 判不出(不算通过)——')
    for (const e of plan.undetermined) L.push(`  ${e.name}  ⇒ ${e.reason}`)
  }
  return L
}

// ─────────────────────────── 冷存储层(G-264)───────────────────────────
const DAY_MS = 86400000
export const DEFAULT_COLD_AGE_MS = DEFAULT_COLD_AGE_DAYS * DAY_MS

/** 冷层落点路径。**不建目录** —— dry-run 必须零副作用。 */
export function coldDirOf(root) {
  return join(root, COLD_DIR_NAME)
}

/**
 * 源树清单:`相对路径 → 字节数`(+ 目录集合)。**不跟随重解析点**;树内出现链接或特殊节点
 * 一律把整项判成"不可搬"并点名 —— 静默跳过会让"副本 vs 源逐字节相等"照样通过,而副本已少一格。
 * 复制与校验**共用这一份枚举**(§26 的 `re-home-junctions` 教训:复制语义与校验语义不一致就永不收敛)。
 */
export function treeManifest(path) {
  const empty = () => ({
    ok: false,
    why: '',
    files: new Map(),
    dirs: [],
    bytes: 0,
    links: [],
    special: [],
    isFile: false,
  })
  const fail = (why) => ({ ...empty(), why })
  let st
  try {
    st = lstatSync(path)
  } catch (e) {
    return fail(`lstat 失败:${e.code}`)
  }
  if (st.isSymbolicLink()) return fail('P-a 重解析点(§26 禁止跟随/穿透)')
  if (st.isFile()) {
    return {
      ok: true,
      why: null,
      files: new Map([['.', st.size]]),
      dirs: [],
      bytes: st.size,
      links: [],
      special: [],
      isFile: true,
      topMtimeMs: st.mtimeMs,
      topAtimeMs: st.atimeMs,
    }
  }
  if (!st.isDirectory()) return fail('既非文件也非目录也非链接的节点 ⇒ 整项不搬')
  const files = new Map()
  const dirs = []
  const links = []
  const special = []
  let bytes = 0
  const stack = [[path, '']]
  while (stack.length) {
    const [cur, base] = stack.pop()
    let ents
    try {
      ents = readdirSync(cur, { withFileTypes: true })
    } catch (e) {
      return fail(`枚举失败:${base || '.'}(${e.code})`)
    }
    for (const ent of ents) {
      const p = join(cur, ent.name)
      const rel = base ? `${base}/${ent.name}` : ent.name
      let s
      try {
        s = lstatSync(p)
      } catch (e) {
        return fail(`lstat 失败:${rel}(${e.code})`)
      }
      if (s.isSymbolicLink()) {
        links.push(rel)
        continue
      }
      if (s.isDirectory()) {
        dirs.push(rel)
        stack.push([p, rel])
        continue
      }
      if (s.isFile()) {
        files.set(rel, s.size)
        bytes += s.size
        if (files.size >= MAX_WALK_FILES) return fail(`遍历超 ${MAX_WALK_FILES} 文件上限 ⇒ 未量全`)
        continue
      }
      special.push(rel)
    }
  }
  if (links.length || special.length)
    return {
      ...fail(
        `树内含重解析点/特殊节点 ${[...links, ...special]
          .slice(0, 8)
          .join(
            ', ',
          )}${links.length + special.length > 8 ? ' …' : ''}(共 ${links.length + special.length} 处)⇒ 整项不搬`,
      ),
      links,
      special,
    }
  return {
    ok: true,
    why: null,
    files,
    dirs,
    bytes,
    links,
    special,
    isFile: false,
    topMtimeMs: st.mtimeMs,
    topAtimeMs: st.atimeMs,
  }
}

/** 按清单复制(不重新扫源 ⇒ 与校验同一份枚举)。返回 {ok, why};失败绝不回头动源。 */
export function copyTree(src, dst, man) {
  if (!man || man.ok !== true) return { ok: false, why: `源清单不完整:${man?.why ?? '未给'}` }
  try {
    if (man.isFile) {
      mkdirSync(dirname(dst), { recursive: true })
      copyFileSync(src, dst)
      return { ok: true }
    }
    mkdirSync(dst, { recursive: true })
    for (const d of man.dirs) mkdirSync(join(dst, d), { recursive: true })
    for (const [rel, size] of man.files) {
      const from = join(src, rel)
      const to = join(dst, rel)
      let b
      try {
        b = lstatSync(from)
      } catch (e) {
        return { ok: false, why: `复制期读不到源文件:${rel}(${e.code})` }
      }
      if (!b.isFile() || b.size !== size)
        return {
          ok: false,
          why: `复制期源在变:${rel}(现量 ${b.size} ≠ 清单 ${size})⇒ 停手,不动源`,
        }
      mkdirSync(dirname(to), { recursive: true })
      copyFileSync(from, to)
      try {
        utimesSync(to, new Date(b.atimeMs), new Date(b.mtimeMs))
      } catch {
        /* 时间戳只影响可读性,不进判据 */
      }
    }
    // 顶层时间戳**必须**跟着搬:冷层的 30 天线与"稳定窗"都按 mtime 判,而 `--restore` 动冷侧
    // 时走的正是 removeEntry 的稳定窗复验 —— 不搬 mtime 会让"刚被复制过"的冷项被判"正在写",
    // 于是反向命令在自己造出来的目录上永远不生效(失效方向是"修不回来",不是"多删一次")。
    if (typeof man.topMtimeMs === 'number') {
      try {
        utimesSync(
          dst,
          new Date(typeof man.topAtimeMs === 'number' ? man.topAtimeMs : man.topMtimeMs),
          new Date(man.topMtimeMs),
        )
      } catch {
        /* 同上:时间戳不进字节校验判据 */
      }
    }
    return { ok: true }
  } catch (e) {
    return { ok: false, why: `copy 失败:${e.code} ${e.message}` }
  }
}

/** 逐文件(相对路径 + 字节数)+ 文件数 + 总字节 + 目录集合四方相等才算"副本完整"。 */
export function verifyCopy(srcMan, dstMan) {
  if (!dstMan || dstMan.ok !== true)
    return { ok: false, why: `目标清单取不到:${dstMan?.why ?? '未给'}` }
  if (srcMan.isFile !== dstMan.isFile) return { ok: false, why: '类型不等(文件 vs 目录)' }
  if (srcMan.files.size !== dstMan.files.size)
    return { ok: false, why: `文件数不等:源 ${srcMan.files.size} vs 目标 ${dstMan.files.size}` }
  if (srcMan.bytes !== dstMan.bytes)
    return { ok: false, why: `总字节不等:源 ${srcMan.bytes} vs 目标 ${dstMan.bytes}` }
  for (const [rel, size] of srcMan.files) {
    const d = dstMan.files.get(rel)
    if (d === undefined) return { ok: false, why: `目标缺文件:${rel}` }
    if (d !== size) return { ok: false, why: `逐文件字节不等:${rel} 源 ${size} vs 目标 ${d}` }
  }
  const ds = (m) => m.dirs.slice().sort().join('|')
  if (ds(srcMan) !== ds(dstMan)) return { ok: false, why: '目录集合不等' }
  return { ok: true, files: srcMan.files.size, bytes: srcMan.bytes }
}

/** 卷剩余空间。**量不到 ⇒ 未判定**,绝不当成"够"。 */
export function diskFreeBytes(path) {
  if (typeof statfsSync !== 'function')
    return { bytes: null, why: '本机 node 无 fs.statfsSync(需 ≥19.7)⇒ 余量未判定' }
  try {
    const s = statfsSync(path)
    const free = s.bavail * s.bsize
    if (!Number.isFinite(free)) return { bytes: null, why: 'statfs 读数非数 ⇒ 未判定' }
    return { bytes: free, why: null }
  } catch (e) {
    return { bytes: null, why: `statfs 失败:${e.code}` }
  }
}

/** 余量闸门:待转字节 + 人工下限 必须都放得下(复制期同卷短时翻倍)。 */
export function coldDiskGate({ neededBytes, minFreeBytes, probePath, probe = diskFreeBytes }) {
  const d = probe(probePath)
  if (typeof d.bytes !== 'number')
    return {
      ok: false,
      undetermined: true,
      free: null,
      neededBytes,
      minFreeBytes,
      why: `磁盘余量无法判定:${d.why} ⇒ 整轮拒跑(不得把"量不到"当"够")`,
    }
  const required = neededBytes + minFreeBytes
  const ok = d.bytes >= required
  return {
    ok,
    undetermined: false,
    free: d.bytes,
    neededBytes,
    minFreeBytes,
    requiredBytes: required,
    why: ok
      ? null
      : `余量不足:可用 ${(d.bytes / MB).toFixed(0)}MB < 需 ${(required / MB).toFixed(0)}MB(待转 ${(neededBytes / MB).toFixed(0)}MB + 下限 ${(minFreeBytes / MB).toFixed(0)}MB)⇒ 整轮拒跑`,
  }
}

/**
 * **执行那一刻**的复验(不信任早先那份计划),与 removeEntry 同一条设计。
 * 返回拒转理由;null = 可转。判序与 classifyEntry 一致:P-a/P-c/C-u/P-b → 稳定窗 → 30 天线。
 */
export function coldMoveGuard({
  root,
  name,
  path,
  now = Date.now(),
  coldAgeMs = DEFAULT_COLD_AGE_MS,
  baseNames,
}) {
  const iu = inUseReason(name)
  if (iu) return iu
  const pr = protectedReason(name, baseNames ?? protectedBaseNames())
  if (pr) return `P-c ${pr}`
  if (!isInsideRoot(root, path)) return 'P-b 越界:目标规范路径不在归档根之内'
  let st
  try {
    st = lstatSync(path)
  } catch (e) {
    return `lstat 失败:${e.code}`
  }
  if (st.isSymbolicLink()) return 'P-a 重解析点:§26 禁止跟随/穿透,本工具也不代断链'
  const age = now - st.mtimeMs
  if (age < MIN_AGE_MS)
    return `正在写:mtime 距今 ${Math.max(0, Math.round(age))}ms < ${MIN_AGE_MS}ms`
  if (age < coldAgeMs)
    return `未满 ${Math.round(coldAgeMs / DAY_MS)} 天线:age=${fmtAge(age)}(mtime=${new Date(st.mtimeMs).toISOString()})`
  return null
}

/** 计划期判定:三条与冷层专属的门槛(最近 10 代 / 30 天线 / 名单)各返回一条理由,不得并桶。 */
export function coldBlockReason({
  entry,
  root,
  keepNames,
  now = Date.now(),
  coldAgeMs = DEFAULT_COLD_AGE_MS,
  baseNames,
}) {
  const nm = entry.name
  if (entry.kind !== 'in-scope')
    return `非顶层现场快照形态(kind=${entry.kind})⇒ 本层不转:${entry.reason || ''}`
  const g = coldMoveGuard({ root, name: nm, path: entry.path, now, coldAgeMs, baseNames })
  if (g) return g
  if (keepNames.has(nm)) return '在最近 10 代之内(与删除档同一把尺子 ⇒ 连转冷都不动它)'
  const age = now - entry.mtimeMs
  if (age < coldAgeMs)
    return `未满 ${Math.round(coldAgeMs / DAY_MS)} 天:age=${fmtAge(age)} mtime=${new Date(entry.mtimeMs).toISOString()}`
  return null
}

/** 冷层计划:与删除档同源于 `planRetirement` 的 inScope / keepSet / inFlight,只多一道 30 天线。 */
export function planColdStorage({
  plan,
  root,
  now = Date.now(),
  coldAgeMs = DEFAULT_COLD_AGE_MS,
  baseNames,
}) {
  const keepNames = new Set(plan.keepSet.map((e) => e.name))
  const move = []
  const blocked = []
  for (const e of plan.inScope) {
    const why = coldBlockReason({ entry: e, root, keepNames, now, coldAgeMs, baseNames })
    if (why) blocked.push({ ...e, coldReason: why })
    else
      move.push({
        ...e,
        coldReason: `超 ${Math.round(coldAgeMs / DAY_MS)} 天:age=${fmtAge(now - e.mtimeMs)} mtime=${new Date(e.mtimeMs).toISOString()}`,
      })
  }
  move.sort((a, b) => a.mtimeMs - b.mtimeMs || a.name.localeCompare(b.name))
  const sum = (list) => list.reduce((s, e) => s + (typeof e.bytes === 'number' ? e.bytes : 0), 0)
  return {
    coldAgeMs,
    move,
    blocked,
    neededBytes: sum(move),
    unmeasured: move.filter((e) => typeof e.bytes !== 'number').length,
  }
}

/** 冷层台账(JSONL)。写不进必须喊 —— 移动的可追溯性全靠它。 */
export function makeColdLedger(coldDir) {
  const file = join(coldDir, COLD_LEDGER_FILE)
  const st = { writes: 0, failures: 0 }
  const ledger = (rec) => {
    st.writes += 1
    try {
      mkdirSync(dirname(file), { recursive: true })
      appendFileSync(file, `${JSON.stringify({ ts: new Date().toISOString(), ...rec })}\n`, 'utf8')
    } catch (e) {
      st.failures += 1
      console.error(`⚠️ 冷层台账写入失败(${e.code})⇒ 本次动作只在此处可见:${JSON.stringify(rec)}`)
    }
    return ledger
  }
  ledger.file = file
  ledger.stats = st
  return ledger
}

/**
 * 转冷一件事的完整流程:**copy → 逐文件字节校验 → 才动源**;动源走 `removeEntry()`
 * (全文件唯一 `rmSync` 出口,自带 §5b/越界/重解析点/稳定窗四条现场复验)。
 * 校验不等 ⇒ 源不动、副本留着、喊出来。`apply:false` 时整段不执行(零移动由 S7 计数断言钉)。
 */
export function moveEntryToCold({
  root,
  coldDir,
  entry,
  now = Date.now(),
  apply = false,
  ledger = () => {},
  baseNames,
  coldAgeMs = DEFAULT_COLD_AGE_MS,
  guard = coldMoveGuard,
  manifest = treeManifest,
  copy = copyTree,
  verify = verifyCopy,
  remove = removeEntry,
}) {
  const name = entry.name
  const src = entry.path
  const dst = join(coldDir, name)
  if (!apply) return { name, moved: false, dryRun: true, from: src, to: dst }
  const g = guard({ root, name, path: src, now, coldAgeMs, baseNames })
  if (g) {
    ledger({ op: 'refuse-move', name, from: src, to: dst, ok: false, why: g })
    return { name, moved: false, why: g }
  }
  if (existsSync(dst)) {
    const why = `目标已存在:${dst} ⇒ 拒绝覆盖(上次移动留下的副本要人工定性)`
    ledger({ op: 'refuse-move', name, from: src, to: dst, ok: false, why })
    return { name, moved: false, why }
  }
  const srcMan = manifest(src)
  if (!srcMan.ok) {
    ledger({ op: 'refuse-move', name, from: src, to: dst, ok: false, why: srcMan.why })
    return { name, moved: false, why: `源清单不完整:${srcMan.why}` }
  }
  try {
    mkdirSync(coldDir, { recursive: true })
  } catch (e) {
    return { name, moved: false, why: `cold/ 建不出来:${e.code}` }
  }
  const c = copy(src, dst, srcMan)
  if (!c.ok) {
    const why = `复制失败:${c.why}`
    ledger({ op: 'copy-failed', name, from: src, to: dst, ok: false, why })
    return {
      name,
      moved: false,
      why: `${why}(源未动;cold/ 里可能留下部分副本,须人工处置,本工具不自动删)`,
    }
  }
  const v = verify(srcMan, manifest(dst))
  if (!v.ok) {
    const why = `逐字节校验不等:${v.why} ⇒ 源原样保留、副本也留着给人查`
    ledger({
      op: 'verify-failed',
      name,
      from: src,
      to: dst,
      srcBytes: srcMan.bytes,
      files: srcMan.files.size,
      ok: false,
      why,
    })
    return { name, moved: false, verifyFailed: true, why }
  }
  const rm = remove({ root, path: src, name, now, baseNames })
  if (!rm.ok) {
    const why = `校验通过但动源失败:${rm.why}(cold/ 里已有一份完整副本 ⇒ 两份并存,须人工裁决,本工具不清 cold 侧)`
    ledger({ op: 'source-still-there', name, from: src, to: dst, ok: false, why })
    return { name, moved: false, why }
  }
  const verifiedAt = new Date().toISOString()
  ledger({
    op: 'cold-move',
    name,
    from: norm(src),
    to: norm(dst),
    files: v.files,
    bytes: v.bytes,
    verifiedAt,
    ok: true,
  })
  return { name, moved: true, files: v.files, bytes: v.bytes, from: src, to: dst, verifiedAt }
}

/** 反向命令:把 cold/ 里的一项放回原位。同样 copy → 校验 → 才动冷侧;原位有同名 ⇒ 拒绝覆盖。 */
export function restoreFromCold({
  root,
  coldDir,
  name,
  now = Date.now(),
  apply = false,
  ledger = () => {},
  baseNames,
  manifest = treeManifest,
  copy = copyTree,
  verify = verifyCopy,
  remove = removeEntry,
}) {
  if (typeof name !== 'string' || !/^[^/\\]+$/.test(name) || name === '.' || name === '..')
    return { name, restored: false, why: `名字不是单个路径段:${String(name)} ⇒ 拒绝(防越界)` }
  const src = join(coldDir, name)
  const dst = join(root, name)
  if (!existsSync(src))
    return { name, restored: false, missing: true, why: `cold/ 里没有这一项:${src}` }
  if (!apply) return { name, restored: false, dryRun: true, from: src, to: dst }
  if (existsSync(dst)) {
    const why = `原位已存在同名:${dst} ⇒ 拒绝覆盖(两份并存要人工归并,本工具不替你选)`
    ledger({ op: 'refuse-restore', name, from: src, to: dst, ok: false, why })
    return { name, restored: false, why }
  }
  const srcMan = manifest(src)
  if (!srcMan.ok) return { name, restored: false, why: `冷侧清单不完整:${srcMan.why}` }
  const c = copy(src, dst, srcMan)
  if (!c.ok) return { name, restored: false, why: `复制失败:${c.why}(冷侧原样留着)` }
  const v = verify(srcMan, manifest(dst))
  if (!v.ok) {
    const why = `回读校验不等:${v.why} ⇒ 冷侧不动,原位那份副本留着给人查`
    ledger({ op: 'restore-verify-failed', name, from: src, to: dst, ok: false, why })
    return { name, restored: false, verifyFailed: true, why }
  }
  const rm = remove({ root, path: src, name, now, baseNames })
  if (!rm.ok)
    return {
      name,
      restored: false,
      why: `回位成功但冷侧未清:${rm.why}(两份并存,须人工裁决;不得为此另开删除出口)`,
    }
  const verifiedAt = new Date().toISOString()
  ledger({
    op: 'cold-restore',
    name,
    from: norm(src),
    to: norm(dst),
    files: v.files,
    bytes: v.bytes,
    verifiedAt,
    ok: true,
  })
  return { name, restored: true, files: v.files, bytes: v.bytes, from: src, to: dst, verifiedAt }
}

/** `bundles/` 只报名、只报数(G-264 判据五):按名字命中丢失提交/stash 语义的一律"未验明唯一副本身份"。 */
export function surveyBundles(root) {
  const dir = join(root, 'bundles')
  const out = {
    present: false,
    items: [],
    onlyCopySuspect: 0,
    unknownName: 0,
    undetermined: null,
    note: 'bundles/ 不在本层射程:① 它不是顶层现场快照形态(无 .broken-/.stale- 签名),② 远端副本未证明 ⇒ 一律留着',
  }
  if (!existsSync(dir)) return out
  out.present = true
  let names
  try {
    names = readdirSync(dir)
  } catch (e) {
    out.undetermined = `枚举 bundles/ 失败:${e.code}`
    return out
  }
  for (const n of names.sort((a, b) => a.localeCompare(b))) {
    let s
    try {
      s = lstatSync(join(dir, n))
    } catch (e) {
      out.undetermined = `lstat bundles/${n} 失败:${e.code}`
      continue
    }
    const suspect = /lost-commit|stash/i.test(n)
    if (suspect) out.onlyCopySuspect += 1
    else out.unknownName += 1
    out.items.push({
      name: n,
      bytes: s.isFile() ? s.size : null,
      isLink: s.isSymbolicLink(),
      verdict: suspect ? '未验明唯一副本身份 ⇒ 只报数,不转' : '名字未点明归属 ⇒ 同样只报数,不转',
    })
  }
  return out
}

function renderColdReport(cold, plan, root, { applied, disk, results, bundles }) {
  const L = []
  L.push(`冷存储落点: ${norm(coldDirOf(root))}`)
  L.push(
    `档位: 超 ${Math.round(cold.coldAgeMs / DAY_MS)} 天 ∧ 不在最近 ${plan.keep} 代之内 ∧ 三条拒收判据与删除档同形(P-a/P-b/P-c + C-u)`,
  )
  L.push(
    `候选(in-scope)= ${plan.inScope.length} | 超龄可转 = ${cold.move.length} | 被挡 = ${cold.blocked.length} | §5b/在用/C-u 挡掉 = ${plan.protected.length} | 不在射程 = ${plan.outOfScope.length} | 判不出 = ${plan.undetermined.length}`,
  )
  L.push(`待转合计 ${fmtMB(cold.neededBytes)}`)
  if (cold.unmeasured)
    L.push(`  ⚠️ ${cold.unmeasured} 项体积未量到 ⇒ 余量按已知量偏小判定,不得据此说"够"`)
  if (disk) {
    L.push(
      `磁盘余量:可用 ${typeof disk.free === 'number' ? fmtMB(disk.free) : '未判定'} | 需 ${fmtMB(disk.requiredBytes ?? disk.neededBytes)}(待转 ${fmtMB(disk.neededBytes)} + 下限 ${fmtMB(disk.minFreeBytes)})⇒ ${disk.ok ? '够' : disk.why}`,
    )
    if (disk.undetermined) L.push('  ⚠️ 余量未判定 ⇒ 整轮拒跑,不得当成通过')
  }
  L.push('\n—— 可转清单(mtime 升序,每条报名 + 带 mtime 与体积)——')
  if (!cold.move.length) L.push('  (空)')
  for (const e of cold.move)
    L.push(
      `  ${e.name}  mtime=${new Date(e.mtimeMs).toISOString()}  age=${fmtAge(e.ageMs)}  ${fmtMB(e.bytes)}  ⇒ ${e.coldReason}`,
    )
  L.push('\n—— 被挡(逐条报名 + 写明挡在哪一条)——')
  if (!cold.blocked.length) L.push('  (空)')
  for (const e of cold.blocked)
    L.push(
      `  ${e.name}  mtime=${new Date(e.mtimeMs).toISOString()}  age=${fmtAge(e.ageMs)}  ${fmtMB(e.bytes)}  ⇒ ${e.coldReason}`,
    )
  L.push('\n—— §5b / C-u 挡掉(活体与在用路径,永不进任何一档)——')
  if (!plan.protected.length) L.push('  (无)')
  for (const e of plan.protected) L.push(`  ${e.name}  ⇒ ${e.reason}`)
  if (bundles && bundles.present) {
    L.push(
      `\n—— bundles/ 只报数(未验明 ⇒ 不转;命中丢失提交/stash 语义 ${bundles.onlyCopySuspect} 项 / 名字未点明 ${bundles.unknownName} 项)——`,
    )
    for (const it of bundles.items)
      L.push(
        `  ${it.name}  ${typeof it.bytes === 'number' ? fmtMB(it.bytes) : '未量到'}  ⇒ ${it.verdict}`,
      )
    L.push(`  ${bundles.note}`)
    if (bundles.undetermined) L.push(`  ⚠️ 未判定:${bundles.undetermined}`)
  }
  if (results) {
    L.push(
      `\n${applied ? '[cold-apply]' : '[cold dry-run]'} moved=${results.moved.length} refused=${results.refused.length} failed=${results.failed.length}`,
    )
    for (const f of results.failed) L.push(`  ❌ ${f.name} ⇒ ${f.why}`)
    for (const r of results.refused) L.push(`  ⏸ ${r.name} ⇒ ${r.why}`)
  }
  return L
}

/** 执行冷层计划。`move` 可注入 —— 镜像测试用它做两件事:
 *  ① 计数断言"冷层 dry-run 一次移动都没发起";② 变异臂(摘掉校验/闸门)证明判据真有牙。 */
export function applyColdPlan({
  root,
  coldDir,
  cold,
  now = Date.now(),
  apply = false,
  ledger = () => {},
  baseNames,
  coldAgeMs = DEFAULT_COLD_AGE_MS,
  move = moveEntryToCold,
}) {
  const moved = []
  const refused = []
  const failed = []
  let attempted = 0
  for (const e of cold.move) {
    // dry-run 分支:下面整段不执行 ⇒ 结构上不可能发起移动(S7 用计数断言钉这一条)。
    if (!apply) continue
    attempted += 1
    const r = move({ root, coldDir, entry: e, now, apply: true, ledger, baseNames, coldAgeMs })
    if (r.moved) moved.push(r)
    else if (r.verifyFailed || /动源失败|部分副本|两份并存/.test(String(r.why))) failed.push(r)
    else refused.push(r)
  }
  return { moved, refused, failed, attempted }
}

/**
 * 冷层 CLI(与删除档**互斥**的三种模式之一:delete / cold / restore)。
 * 结构上的安全属性:本函数**永不**调用 `applyPlan`(删除档的执行器),所以
 * `--cold` / `--restore` 无论怎么组合都不会走进"按双上限删现场"那条路径;反向锁由镜像测试钉。
 */
export async function runColdMain({ argv, stdout = console.info, stderr = console.error }) {
  const asJson = argv.includes('--json')
  const apply = argv.includes('--apply')
  const restoreName = parseFlag(argv, 'restore', null)
  const customRoot = parseFlag(argv, 'root', null)
  const stdRoot = gitArchiveDir()
  if (!stdRoot) {
    stderr('❌ 无法判定:gitArchiveDir() 取不到落点 ⇒ 冷层既不冒搬也不记通过')
    return 2
  }
  const root = customRoot ? resolve(customRoot) : stdRoot
  if (customRoot && norm(root).toLowerCase() !== norm(stdRoot).toLowerCase()) {
    if (!argv.includes('--allow-custom-root')) {
      stderr(`❌ --root ${customRoot} 不等于 gitArchiveDir()=${stdRoot}`)
      stderr('   在非归档根上搬动现场属越界;确要换根请同时给 --allow-custom-root(仅人工/取证)')
      return 2
    }
    stderr(`⚠️ 自定义根生效:${root}(默认档是 ${stdRoot})`)
  }
  const daysRaw = parseFlag(argv, 'cold-days', String(DEFAULT_COLD_AGE_DAYS))
  const days = Number(daysRaw)
  if (!Number.isFinite(days) || days <= 0) {
    stderr(`❌ 冷层阈值非法:cold-days=${daysRaw}(必须 > 0)`)
    return 2
  }
  const freeRaw = parseFlag(argv, 'min-free-mb', String(DEFAULT_MIN_FREE_MB))
  const minFreeBytes = Number(freeRaw) * MB
  if (!Number.isFinite(minFreeBytes) || minFreeBytes < 0) {
    stderr(`❌ 余量下限非法:min-free-mb=${freeRaw}`)
    return 2
  }
  const now = Date.now()
  const coldDir = coldDirOf(root)
  const baseNames = protectedBaseNames()
  const ledger = makeColdLedger(coldDir)

  // ── 反向命令:把一项放回原位 ──
  if (restoreName !== null) {
    const r = restoreFromCold({
      root,
      coldDir,
      name: restoreName,
      now,
      apply,
      ledger,
      baseNames,
    })
    if (asJson) stdout(JSON.stringify({ mode: 'restore', apply, ...r, ledgerFile: ledger.file }))
    else {
      stdout(`[restore${apply ? '' : ' dry-run'}] ${r.name}: ${r.from ?? '-'} → ${r.to ?? '-'}`)
      if (r.restored)
        stdout(
          `  ✅ 已放回原位并逐文件校验一致(files=${r.files}, bytes=${r.bytes}, 校验时刻=${r.verifiedAt})`,
        )
      else if (!r.dryRun) stdout(`  ❌ 未放回:${r.why}`)
      else stdout(`  [dry-run] 未动任何东西;真放回再加 --apply`)
    }
    if (r.missing) {
      stderr(`❌ 无法判定:${r.why} ⇒ 不记通过`)
      return 2
    }
    if (!apply) return 0
    return r.restored ? 0 : 1
  }

  // ── 冷层计划 ──
  let names
  try {
    names = listEntries(root)
  } catch (e) {
    stderr(`❌ 无法判定:归档根枚举失败(${e.message})⇒ 记"未判定"而非"无可搬"`)
    return 2
  }
  const entries = names.map((name) => classifyEntry({ root, name, now, baseNames }))
  const plan = planRetirement({
    entries,
    keep: DEFAULT_KEEP_GENERATIONS,
    maxTotalBytes: DEFAULT_MAX_TOTAL_BYTES,
    now,
  })
  const cold = planColdStorage({ plan, root, now, coldAgeMs: days * DAY_MS, baseNames })
  const bundles = surveyBundles(root)
  // 余量闸门**只在真有事要做时**才问:待转集为空时去量卷余量,量不到会把"本轮无事"报成故障,
  // 而"与本次动作无关的红"正是本仓最高频的失效形态(§12e 同型)。
  const disk = cold.move.length
    ? coldDiskGate({
        neededBytes: cold.neededBytes,
        minFreeBytes,
        probePath: root,
      })
    : null
  let results = null
  if (apply) {
    if (disk && !disk.ok) {
      stderr(`❌ ${disk.why}`)
      if (asJson)
        stdout(
          JSON.stringify({
            mode: 'cold',
            apply: true,
            refusedByDisk: true,
            undetermined: !!disk.undetermined,
            disk,
            moved: [],
            refused: [],
            failed: [],
          }),
        )
      return disk.undetermined ? 2 : 1
    }
    results = applyColdPlan({
      root,
      coldDir,
      cold,
      now,
      apply: true,
      ledger,
      baseNames,
      coldAgeMs: days * DAY_MS,
    })
  }
  if (asJson) {
    stdout(
      JSON.stringify(
        {
          root,
          coldDir,
          mode: 'cold',
          apply,
          dryRun: !apply,
          coldAgeDays: days,
          counts: {
            inScope: plan.inScope.length,
            movable: cold.move.length,
            blocked: cold.blocked.length,
            protected: plan.protected.length,
            outOfScope: plan.outOfScope.length,
            undetermined: plan.undetermined.length,
            unmeasured: cold.unmeasured,
            moved: results ? results.moved.length : 0,
            refused: results ? results.refused.length : 0,
            failed: results ? results.failed.length : 0,
          },
          bytes: { needed: cold.neededBytes },
          disk,
          move: cold.move.map((e) => ({
            name: e.name,
            mtime: new Date(e.mtimeMs).toISOString(),
            bytes: e.bytes,
            why: e.coldReason,
          })),
          blocked: cold.blocked.map((e) => ({
            name: e.name,
            mtime: new Date(e.mtimeMs).toISOString(),
            bytes: e.bytes,
            why: e.coldReason,
          })),
          protected: plan.protected.map((e) => ({ name: e.name, reason: e.reason })),
          outOfScope: plan.outOfScope.map((e) => ({ name: e.name, reason: e.reason })),
          bundles,
          ledgerFile: ledger.file,
        },
        null,
        2,
      ),
    )
  } else {
    for (const l of renderColdReport(cold, plan, root, { applied: apply, disk, results, bundles }))
      stdout(l)
    if (!apply)
      stdout(
        '\n[cold dry-run] 未发起任何移动。真转冷再加 --apply(§5b/C-u/P-a/P-b 四条在动源那一刻仍逐条复验)。',
      )
  }
  if (results) {
    for (const f of results.failed) stderr(`  ❌ ${f.name} ⇒ ${f.why}`)
    if (ledger.stats.failures)
      stderr(`  ❌ 台账写入失败 ${ledger.stats.failures} 次 ⇒ 移动的出处无据可查,须人工补记`)
    return results.failed.length || ledger.stats.failures ? 1 : 0
  }
  return plan.undetermined.length ? 2 : 0
}

/** 取 `--<name> <值>` 形态的旗标值(值本身以 `--` 开头视为没给值)。 */
function parseFlag(argv, name, dflt) {
  const i = argv.indexOf(`--${name}`)
  return i >= 0 && argv[i + 1] && !argv[i + 1].startsWith('--') ? argv[i + 1] : dflt
}

/** CLI 主体(导出给镜像测试直接调,零真实删除路径)。 */
export async function runMain({ argv, stdout = console.info, stderr = console.error }) {
  // 三模式互斥:delete(缺省)/ cold(--cold)/ restore(--restore <名>)。
  // **先**分流并整段 return ⇒ 冷层路径结构上碰不到下面那段删除逻辑(镜像 T13 钉这条)。
  const coldMode = argv.includes('--cold') || argv.includes('--cold-apply')
  const restoreMode = argv.some((a) => a === '--restore' || a.startsWith('--restore='))
  if (coldMode && restoreMode) {
    stderr('❌ --cold 与 --restore 是两种模式,不得同给(想放回某项就给 --restore <名> --apply)')
    return 2
  }
  if (coldMode || restoreMode) {
    const a = argv.slice()
    if (argv.includes('--cold-apply')) {
      a.splice(a.indexOf('--cold-apply'), 1, '--apply')
    }
    if (restoreMode && a.some((x) => x.startsWith('--restore='))) {
      const i = a.findIndex((x) => x.startsWith('--restore='))
      a.splice(i, 1, '--restore', a[i].slice('--restore='.length))
    }
    return runColdMain({ argv: a, stdout, stderr })
  }
  const apply = argv.includes('--apply')
  const asJson = argv.includes('--json')
  const customRoot = parseFlag(argv, 'root', null)
  const stdRoot = gitArchiveDir()
  if (!stdRoot) {
    stderr('❌ 无法判定:gitArchiveDir() 取不到落点(换机/只读环境?)⇒ 不冒删也不记通过')
    return 2
  }
  const root = customRoot ? resolve(customRoot) : stdRoot
  if (customRoot && norm(root).toLowerCase() !== norm(stdRoot).toLowerCase()) {
    if (!argv.includes('--allow-custom-root')) {
      stderr(`❌ --root ${customRoot} 不等于 gitArchiveDir()=${stdRoot}`)
      stderr('   在非归档根上执行删除属越界;确要换根请同时给 --allow-custom-root(仅人工/取证)')
      return 2
    }
    // 警告走 stderr:`--json --root` 同时给时,stdout 必须是**纯** JSON(消费方要 parse)。
    stderr(`⚠️ 自定义根生效:${root}(默认档是 ${stdRoot})`)
  }
  const keepRaw = parseFlag(argv, 'keep', String(DEFAULT_KEEP_GENERATIONS))
  const bytesRaw = parseFlag(argv, 'max-bytes', String(DEFAULT_MAX_TOTAL_BYTES))
  const keep = Number(keepRaw)
  const maxTotalBytes = Number(bytesRaw)
  if (
    !Number.isInteger(keep) ||
    keep < 0 ||
    !Number.isFinite(maxTotalBytes) ||
    maxTotalBytes <= 0
  ) {
    stderr(`❌ 档位非法:keep=${keepRaw} max-bytes=${bytesRaw}`)
    return 2
  }
  const now = Date.now()
  let names
  try {
    names = listEntries(root)
  } catch (e) {
    stderr(`❌ 无法判定:归档根枚举失败(${e.message})⇒ 记"未判定"而非"无可删"`)
    return 2
  }
  const baseNames = protectedBaseNames()
  const entries = names.map((name) => classifyEntry({ root, name, now, baseNames }))
  const plan = planRetirement({ entries, keep, maxTotalBytes, now })
  if (asJson) {
    stdout(
      JSON.stringify(
        {
          root,
          apply,
          dryRun: !apply,
          keep: plan.keep,
          maxTotalBytes: plan.maxTotalBytes,
          counts: {
            total: entries.length,
            inScope: plan.inScope.length,
            retire: plan.retire.length,
            keep: plan.keepSet.length,
            inFlight: plan.inFlight.length,
            protected: plan.protected.length,
            outOfScope: plan.outOfScope.length,
            undetermined: plan.undetermined.length,
            unmeasured: plan.unmeasured,
          },
          bytes: { inScope: plan.inScopeBytes, retainedAfter: plan.retainedBytes },
          retire: plan.retire.map((e) => ({
            name: e.name,
            mtime: new Date(e.mtimeMs).toISOString(),
            bytes: e.bytes,
            why: e.retireReason,
          })),
          protected: plan.protected.map((e) => ({ name: e.name, reason: e.reason })),
          outOfScope: plan.outOfScope.map((e) => ({ name: e.name, reason: e.reason })),
        },
        null,
        2,
      ),
    )
  } else {
    for (const l of renderReport(plan, root)) stdout(l)
  }
  if (!apply) {
    // --json 档不得再印散文尾注:混排会让调用方 JSON.parse 直接失败(实测在第一个消费点上炸)。
    // dry-run 这个事实本身已作为 `dryRun:true` 字段进 JSON。
    if (!asJson)
      stdout('\n[dry-run] 未发起任何删除。真删再加 --apply(§5b 三判据在删除那一刻仍逐条复验)。')
    return plan.undetermined.length ? 2 : 0
  }
  const log = makeLogger(REPO_ROOT)
  const res = applyPlan({ root, plan, apply: true, log, now, baseNames })
  if (asJson) {
    stdout(
      JSON.stringify({
        deleted: res.deleted,
        failed: res.failed,
        refused: res.refused,
        logFile: log.file,
      }),
    )
  } else {
    stdout(
      `\n[apply] deleted=${res.deleted.length} failed=${res.failed.length} skipped-in-flight=${res.refused.length}(留痕:${log.file})`,
    )
  }
  for (const f of res.failed) stderr(`  ❌ ${f.name} ⇒ ${f.why}`)
  return res.failed.length ? 1 : 0
}

// ─────────────────────────── self-test ───────────────────────────
function selfTest() {
  const results = []
  const t = (name, fn) => {
    try {
      results.push({ name, ok: true, detail: fn() || '' })
    } catch (e) {
      results.push({ name, ok: false, detail: String(e?.message ?? e) })
    }
  }
  const assert = (cond, msg) => {
    if (!cond) throw new Error(msg)
  }
  const mkArch = (box) => {
    const arch = join(box, 'git-archive')
    mkdirSync(arch, { recursive: true })
    return arch
  }
  const putDir = (parent, name, ageMs, bytes = 0) => {
    const p = join(parent, name)
    mkdirSync(p, { recursive: true })
    if (bytes > 0) {
      mkdirSync(join(p, 'sub'), { recursive: true })
      writeFileSync(join(p, 'sub', 'f.bin'), Buffer.alloc(bytes, 0x61))
    }
    const ts = new Date(Date.now() - ageMs)
    utimesSync(p, ts, ts)
    return p
  }
  const planOf = (arch, { keep, maxTotalBytes, baseNames } = {}) => {
    const now = Date.now()
    const entries = listEntries(arch).map((n) =>
      classifyEntry({ root: arch, name: n, now, baseNames: baseNames || protectedBaseNames() }),
    )
    return { plan: planRetirement({ entries, keep, maxTotalBytes, now }), now, entries }
  }

  t('S1 世代上限边界:11 项恰好删最旧 1 项', () => {
    const box = mkScratch('retire-s1-')
    try {
      const arch = mkArch(box)
      for (let i = 1; i <= 11; i++)
        putDir(arch, `ihui-git-write.lock.stale-1-${1000 + i}-x${i}`, i * 60000)
      const { plan } = planOf(arch)
      assert(plan.inScope.length === 11, `候选应 11,实为 ${plan.inScope.length}`)
      assert(plan.retire.length === 1, `将删应为 1,实为 ${plan.retire.length}`)
      const oldest = Math.min(...plan.inScope.map((e) => e.mtimeMs))
      assert(
        plan.retire[0].mtimeMs === oldest,
        `应删最旧那项(age 660s),实删 ${plan.retire[0].name}`,
      )
      assert(/x11$/.test(plan.retire[0].name), `最旧那项的名字就是 x11,实为 ${plan.retire[0].name}`)
      assert(/gen>keep/.test(plan.retire[0].retireReason), '理由应为 gen>keep')
      assert(plan.protected.length === 0, 'S1 不该有 §5b 挡掉项')
      return `11 项 → keep=${plan.keep} → 删 1(${plan.retire[0].name})`
    } finally {
      rmScratch(box)
    }
  })

  t('S2 字节上限独立生效:世代没超而体积超 ⇒ 仍判删最旧(放宽即归零)', () => {
    const box = mkScratch('retire-s2-')
    try {
      const arch = mkArch(box)
      putDir(arch, 'ihui-git-write.lock.stale-2-2001-a', 3 * 60000, 5 * MB)
      putDir(arch, 'ihui-git-write.lock.stale-2-2002-b', 2 * 60000, 5 * MB)
      putDir(arch, 'ihui-git-write.lock.stale-2-2003-c', 1 * 60000, 1 * MB)
      const { plan } = planOf(arch, { keep: 10, maxTotalBytes: 6 * MB })
      assert(plan.retire.length === 1, `cap=6MB 应判删最旧 1 项(5MB),实为 ${plan.retire.length}`)
      assert(/2001-a$/.test(plan.retire[0].name), `应删最旧那项,实删 ${plan.retire[0].name}`)
      assert(
        plan.retire.every((e) => /bytes>cap/.test(e.retireReason)),
        `理由应为 bytes>cap:${plan.retire.map((e) => e.retireReason).join('|')}`,
      )
      assert(plan.keepSet.length === 2, `保留集应为 2 项,实为 ${plan.keepSet.length}`)
      const tighter = planOf(arch, { keep: 10, maxTotalBytes: 1 * MB }).plan
      assert(
        tighter.retire.length === 2 && tighter.keepSet.length === 1,
        `cap=1MB 应删 2 留 1,实为 删 ${tighter.retire.length} 留 ${tighter.keepSet.length}`,
      )
      assert(
        tighter.retire.every((e) => /bytes>cap/.test(e.retireReason)),
        '第二臂的理由也必须来自字节档',
      )
      const loose = planOf(arch, { keep: 10, maxTotalBytes: Number.MAX_SAFE_INTEGER }).plan
      assert(loose.retire.length === 0, '放宽上限后仍判删 ⇒ 字节档与世代档分不开(判据无牙)')
      return `cap=6MB 删 1 / cap=1MB 删 2 / cap=∞ 删 0`
    } finally {
      rmScratch(box)
    }
  })

  t('S3 §5b 名单 / junction 绝不进候选(正反对照 + 阳性对照)', () => {
    const box = mkScratch('retire-s3-')
    try {
      const arch = mkArch(box)
      const outside = join(box, 'fake-live-gitdir')
      mkdirSync(join(outside, 'objects'), { recursive: true })
      putDir(arch, 'IHUI-AI-git-repo.broken-1790150361407', 40 * 60000)
      putDir(arch, 'IHUI-AI.git-backup-20260912.broken-1790150479288', 41 * 60000)
      putDir(arch, 'some.lock.stale-9-9-zz', 42 * 60000)
      putDir(arch, 'bundles', 43 * 60000)
      const baseNames = ['IHUI-AI-git-repo', 'IHUI-AI.git-backup-20260912']
      let linkNote = '本机建不了 junction ⇒ 未跑链接臂'
      try {
        symlinkSync(outside, join(arch, 'IHUI-AI-git-repo.lock.stale-7-7-jj'), 'junction')
        linkNote = 'junction(指向活 gitdir 形态)已注入'
      } catch (e) {
        linkNote = `建 junction 失败(${e.code})⇒ 链接臂未跑`
      }
      // 两条上限都拧到最严:如果判据是"一律不删",这里也会报 0 项可删 —— 所以配下面反面。
      const { plan } = planOf(arch, { keep: 0, maxTotalBytes: 1, baseNames })
      const inRetire = plan.retire.map((e) => e.name)
      assert(
        inRetire.length === 1 && inRetire[0] === 'some.lock.stale-9-9-zz',
        `候选必须只剩那项合法的,实为 ${inRetire.join(',')}`,
      )
      const prot = plan.protected.map((e) => e.name)
      assert(prot.includes('IHUI-AI-git-repo.broken-1790150361407'), '活 gitdir 现场未被挡')
      assert(
        prot.includes('IHUI-AI.git-backup-20260912.broken-1790150479288'),
        '本地恢复源现场未被挡',
      )
      const reasons = plan.protected.map((e) => `${e.name}::${e.reason}`).join('\n')
      assert(
        /重解析点/.test(reasons) && /fake-live-gitdir/.test(reasons),
        `阳性对照失败:指向活 gitdir 的 junction 没被点名\n${reasons}`,
      )
      assert(
        plan.outOfScope.some((e) => e.name === 'bundles'),
        `bundles 必须报名(不得静默过滤):${plan.outOfScope.map((e) => e.name).join(',')}`,
      )
      assert(plan.undetermined.length === 0, '不该有判不出项')
      return `挡 ${prot.length} 项 / 不在射程 ${plan.outOfScope.length} 项 / 删 ${inRetire.length} 项 / ${linkNote}`
    } finally {
      rmScratch(box)
    }
  })

  t('S4 mtime 稳定窗生效:上限拧到最严也不动 1 秒内的条目', () => {
    const box = mkScratch('retire-s4-')
    try {
      const arch = mkArch(box)
      putDir(arch, 'ihui-git-write.lock.stale-4-4-old', 5 * 60000)
      const fresh = putDir(arch, 'ihui-git-write.lock.stale-4-4-fresh', 0)
      const { plan } = planOf(arch, { keep: 0, maxTotalBytes: 1 })
      assert(
        plan.inFlight.length === 1 && plan.inFlight[0].path === fresh,
        `稳定窗没认出在写项:${plan.inFlight.map((e) => e.name).join(',')}`,
      )
      assert(!plan.retire.some((e) => e.path === fresh), '稳定窗内的项被判删')
      assert(plan.retire.length === 1, '过期那项应仍在候选里(窗口不是免死金牌)')
      return `inFlight=${plan.inFlight.length} retire=${plan.retire.length}`
    } finally {
      rmScratch(box)
    }
  })

  t('S5 dry-run 分支一次 unlink 都不发生(计数断言,不看"像没删")', () => {
    const box = mkScratch('retire-s5-')
    try {
      const arch = mkArch(box)
      putDir(arch, 'ihui-git-write.lock.stale-5-5-a', 5 * 60000)
      putDir(arch, 'ihui-git-write.lock.stale-5-5-b', 6 * 60000)
      putDir(arch, 'IHUI-AI-git-repo.broken-1', 7 * 60000)
      const baseNames = ['IHUI-AI-git-repo']
      const { plan, now } = planOf(arch, { keep: 0, maxTotalBytes: 1, baseNames })
      assert(plan.retire.length === 2, `计划里应有 2 项待删,实为 ${plan.retire.length}`)
      const seen = []
      const spyRemove = (arg) => {
        seen.push(arg.path)
        return { ok: false, why: 'spy 不删' }
      }
      const dry = applyPlan({ root: arch, plan, apply: false, remove: spyRemove, now, baseNames })
      assert(
        dry.attempted === 0 && seen.length === 0,
        `dry-run 竟发起了 ${seen.length} 次删除调用:${seen.join(',')}`,
      )
      assert(
        plan.retire.every((e) => existsSync(e.path)),
        'dry-run 后条目不见了 ⇒ 存在旁路删除',
      )
      const wet = applyPlan({ root: arch, plan, apply: true, remove: spyRemove, now, baseNames })
      assert(
        seen.length === 2 && wet.failed.length === 2,
        `--apply 应恰好发起 2 次,实为 ${seen.length}:${seen.join(',')}`,
      )
      assert(!seen.some((p) => /IHUI-AI-git-repo/.test(p)), '§5b 名单出现在删除路径参数里')
      return `dry 0 次 / apply 2 次(spy,未真删)`
    } finally {
      rmScratch(box)
    }
  })

  t('S6 删除出口的现场复验:越界与 junction 一律拒收且不伤真实目标', () => {
    const box = mkScratch('retire-s6-')
    try {
      const arch = mkArch(box)
      const escapee = putDir(box, 'IHUI-AI-git-repo', 5 * 60000)
      const r = removeEntry({
        root: arch,
        path: escapee,
        name: 'IHUI-AI-git-repo',
        now: Date.now(),
      })
      assert(!r.ok && /越界/.test(r.why), `越界目标必须拒收,实为 ${JSON.stringify(r)}`)
      assert(existsSync(escapee), '拒收却仍把东西删了')
      const link = join(arch, 'some.lock.stale-6-6-ll')
      try {
        symlinkSync(escapee, link, 'junction')
        const r2 = removeEntry({
          root: arch,
          path: link,
          name: 'some.lock.stale-6-6-ll',
          now: Date.now() - 10000,
        })
        assert(!r2.ok && /重解析点/.test(r2.why), `junction 必须拒收,实为 ${JSON.stringify(r2)}`)
        assert(existsSync(escapee), '删 junction 却清空了真实目标 ⇒ §26 事故重演')
        assert(existsSync(link), 'junction 本体应原样保留(本工具不代断链)')
        return '越界拒收 + junction 拒收且目标完好'
      } catch (e) {
        if (/越界/.test(String(e?.message))) throw e
        return `建 junction 失败(${e.code})⇒ 链接臂未跑,越界臂已过`
      }
    } finally {
      rmScratch(box)
    }
  })

  // ───────────────────────── 冷存储层取证(G-264)────────────────────────
  /** 冷层夹具用名单(与 S3 同一套假名,绝不指本机真身)。 */
  const COLD_BASE = ['IHUI-AI-git-repo', 'IHUI-AI.git-backup-20260912']
  /** 造一棵小树并按 ageMs 定 mtime(冷层的 30 天线只看 mtime)。 */
  const putTree = (parent, name, ageMs, spec) => {
    const p = join(parent, name)
    mkdirSync(p, { recursive: true })
    for (const [rel, bytes] of Object.entries(spec)) {
      const f = join(p, rel)
      mkdirSync(dirname(f), { recursive: true })
      writeFileSync(f, Buffer.alloc(bytes, 0x62))
    }
    const ts = new Date(Date.now() - ageMs)
    utimesSync(p, ts, ts)
    return p
  }
  const coldOf = (arch, { keep = 0, coldAgeMs = DEFAULT_COLD_AGE_MS } = {}) => {
    const now = Date.now()
    const entries = listEntries(arch).map((n) =>
      classifyEntry({ root: arch, name: n, now, baseNames: COLD_BASE }),
    )
    const plan = planRetirement({
      entries,
      keep,
      maxTotalBytes: Number.MAX_SAFE_INTEGER,
      now,
    })
    return {
      plan,
      cold: planColdStorage({ plan, root: arch, now, coldAgeMs, baseNames: COLD_BASE }),
      now,
    }
  }

  t('S7 冷层 dry-run 一次移动都不发起(计数断言 + 源全在 + 不建 cold/)', () => {
    const box = mkScratch('retire-s7-')
    try {
      const arch = mkArch(box)
      const aged = 40 * DAY_MS
      for (const n of ['a.lock.stale-7-1', 'b.lock.stale-7-2', 'c.lock.stale-7-3'])
        putTree(arch, n, aged, { 'x/y.bin': 2048 })
      const { cold, now } = coldOf(arch)
      assert(cold.move.length === 3, `夹具应有 3 项可转,实为 ${cold.move.length}`)
      const seen = []
      const spyMove = (arg) => {
        seen.push(arg.entry.name)
        return { name: arg.entry.name, moved: false, why: 'spy 不搬' }
      }
      const dry = applyColdPlan({
        root: arch,
        coldDir: coldDirOf(arch),
        cold,
        now,
        apply: false,
        move: spyMove,
        baseNames: COLD_BASE,
      })
      assert(
        dry.attempted === 0 && seen.length === 0,
        `冷层 dry-run 竟发起了 ${seen.length} 次移动:${seen.join(',')}`,
      )
      assert(
        cold.move.every((e) => existsSync(e.path)),
        'dry-run 后源不见了 ⇒ 存在旁路移动',
      )
      assert(!existsSync(coldDirOf(arch)), 'dry-run 建出了 cold/ ⇒ 只读档不该有副作用')
      return `候选 3 / 发起 0 次 / cold/ 未创建`
    } finally {
      rmScratch(box)
    }
  })

  t('S8 30 天线:29 天不动、31 天进候选,两条都报名且带 mtime', () => {
    const box = mkScratch('retire-s8-')
    try {
      const arch = mkArch(box)
      const young = putTree(arch, 'ihui-git-write.lock.stale-8-young', 29 * DAY_MS, {
        'a.bin': 1024,
      })
      const old = putTree(arch, 'ihui-git-write.lock.stale-8-old', 31 * DAY_MS, { 'b.bin': 1024 })
      const { cold } = coldOf(arch)
      assert(
        cold.move.length === 1 && cold.move[0].path === old,
        `31 天那项必须进候选,实为 ${cold.move.map((e) => e.name).join(',')}`,
      )
      assert(
        cold.blocked.length === 1 && cold.blocked[0].path === young,
        `29 天那项必须被挡,实为 ${cold.blocked.map((e) => e.name).join(',')}`,
      )
      assert(
        /未满 30 天/.test(cold.blocked[0].coldReason),
        `挡的理由不对:${cold.blocked[0].coldReason}`,
      )
      assert(
        /mtime=20\d\d-\d\d-\d\d/.test(cold.blocked[0].coldReason) &&
          /mtime=20\d\d-\d\d-\d\d/.test(cold.move[0].coldReason),
        '两侧都必须报名字之外还带 mtime(否则"没看见"与"看见了但不转"在账面上同形)',
      )
      // 阈值可配:把线拉到 45 天 ⇒ 31 天那项也必须被挡(判据不是"存在即转")
      const tighter = coldOf(arch, { coldAgeMs: 45 * DAY_MS })
      assert(
        tighter.cold.move.length === 0 && tighter.cold.blocked.length === 2,
        `阈值 45 天时应一项都不转,实为转 ${tighter.cold.move.length}`,
      )
      // 另一把尺子:超龄但**仍在最近 10 代之内** ⇒ 也不转,且理由必须是这一条(两条规则不得并桶,
      // 否则"没转"只有一种解释,下一个人无从知道是被年龄还是被世代档挡住的)。
      const arch2 = mkArch(join(box, 'b2'))
      const newest = putTree(arch2, 'ihui-git-write.lock.stale-8-newest', 90 * DAY_MS, {
        'a.bin': 10,
      })
      putTree(arch2, 'ihui-git-write.lock.stale-8-older', 100 * DAY_MS, { 'b.bin': 10 })
      const gen = coldOf(arch2, { keep: 1 })
      assert(
        gen.cold.move.length === 1 && gen.cold.move[0].path !== newest,
        `keep=1 时应只转较旧那项,实为 ${gen.cold.move.map((e) => e.name).join(',')}`,
      )
      assert(
        gen.cold.blocked.some((e) => e.path === newest && /最近 10 代之内/.test(e.coldReason)),
        `最新那项的挡由应是世代档,实为 ${gen.cold.blocked.map((e) => e.coldReason).join('|')}`,
      )
      assert(
        DEFAULT_KEEP_GENERATIONS === 10,
        `世代档默认值不再是用户拍板的 10:${DEFAULT_KEEP_GENERATIONS}`,
      )
      return `29d 挡("${cold.blocked[0].coldReason}")/ 31d 转 / 45d 线全挡 / 超龄但在最近 10 代内仍挡`
    } finally {
      rmScratch(box)
    }
  })

  t('S9 逐字节校验:副本不完整 ⇒ 拒绝动源、保留副本、喊出来;摘掉校验判据即翻红(变异)', () => {
    const box = mkScratch('retire-s9-')
    try {
      const arch = mkArch(box)
      const name = 'ihui-git-write.lock.stale-9-full'
      const src = putTree(arch, name, 40 * DAY_MS, { 'a.bin': 4096, 'sub/b.bin': 8192 })
      const coldDir = coldDirOf(arch)
      const ledger = makeColdLedger(coldDir)
      const now = Date.now()
      const entry = classifyEntry({ root: arch, name, now, baseNames: COLD_BASE })
      // 真臂:复制只搬走第一个文件(模拟任何一次"半复制"),真 verify 必须抓到并拒绝动源。
      const partialCopy = (s, d, man) => {
        const [rel] = [...man.files.keys()]
        mkdirSync(join(d, dirname(rel) === '.' ? '' : dirname(rel)), { recursive: true })
        copyFileSync(join(s, rel), join(d, rel))
        return { ok: true }
      }
      const real = moveEntryToCold({
        root: arch,
        coldDir,
        entry,
        now,
        apply: true,
        ledger,
        baseNames: COLD_BASE,
        copy: partialCopy,
      })
      assert(!real.moved, '半复制的副本被当成完整 ⇒ 校验判据无牙')
      assert(/校验不等/.test(String(real.why)), `理由未点名校验失败:${real.why}`)
      assert(real.verifyFailed === true, 'verifyFailed 必须单独成态(它与"闸门拒收"处置动作不同)')
      assert(existsSync(src), '校验不等却仍动了源')
      assert(existsSync(join(coldDir, name)), '副本被清掉了 ⇒ 留着给人查这条没做到')
      const lines = readFileSync(ledger.file, 'utf8')
        .split('\n')
        .filter(Boolean)
        .map((l) => JSON.parse(l))
      assert(
        lines.some((l) => l.op === 'verify-failed' && l.ok === false),
        '台账没有 verify-failed 记录 ⇒ 出过的事无据可查',
      )
      // 变异臂:摘掉校验(恒 ok)⇒ 同一份半复制会把源删掉。红在这里,不在文案里。
      const arch2 = mkArch(join(box, 'b2'))
      const src2 = putTree(arch2, name, 40 * DAY_MS, { 'a.bin': 4096, 'sub/b.bin': 8192 })
      const e2 = classifyEntry({ root: arch2, name, now, baseNames: COLD_BASE })
      const mutant = moveEntryToCold({
        root: arch2,
        coldDir: coldDirOf(arch2),
        entry: e2,
        now,
        apply: true,
        baseNames: COLD_BASE,
        copy: partialCopy,
        verify: () => ({ ok: true, files: 0, bytes: 0 }),
      })
      assert(mutant.moved === true, '摘掉校验后仍然不动源 ⇒ 上面那条证明的是"函数什么都拦"')
      assert(!existsSync(src2), '变异臂没真删掉源 ⇒ 变异没生效(证明无效)')
      return '真臂:源与副本都留着 + 台账 verify-failed;变异臂:摘掉校验即误删源'
    } finally {
      rmScratch(box)
    }
  })

  t('S10 --restore 往返逐字节一致;原位有同名 ⇒ 拒绝覆盖', () => {
    const box = mkScratch('retire-s10-')
    try {
      const arch = mkArch(box)
      const name = 'ihui-git-write.lock.stale-10-one'
      const src = putTree(arch, name, 40 * DAY_MS, { 'a.bin': 3000, 'sub/b.bin': 700 })
      const coldDir = coldDirOf(arch)
      const now = Date.now()
      const ledger = makeColdLedger(coldDir)
      const entry = classifyEntry({ root: arch, name, now, baseNames: COLD_BASE })
      const mv = applyColdPlan({
        root: arch,
        coldDir,
        cold: { move: [entry] },
        now,
        apply: true,
        ledger,
        baseNames: COLD_BASE,
      })
      assert(mv.moved.length === 1, `转冷未成功:${JSON.stringify(mv)}`)
      assert(!existsSync(src), '转冷后源还在 ⇒ 只复制没移动')
      // 基准在**移动之前**取:回位后要跟" originally 那一份"比,而不是跟它自己比(自比恒真)。
      const baseMan = treeManifest(join(coldDir, name))
      const restored = restoreFromCold({
        root: arch,
        coldDir,
        name,
        now,
        apply: true,
        ledger,
        baseNames: COLD_BASE,
      })
      assert(restored.restored === true, `放回失败:${JSON.stringify(restored)}`)
      assert(existsSync(src), '放回后原位没有这一项')
      assert(!existsSync(join(coldDir, name)), '冷侧没清 ⇒ 两份并存(该喊,不该静默)')
      const a = treeManifest(src)
      assert(
        verifyCopy(baseMan, a).ok === true,
        `回位后的字节与移动前那一份不等:${verifyCopy(baseMan, a).why}`,
      )
      assert(
        a.bytes === 3700 && a.files.size === 2,
        `清单量到的不是夹具那 2 文件 / 3700 字节:${a.bytes}/${a.files.size}`,
      )
      // 再转一次,然后伪造"原位又有同名" ⇒ 必须拒绝覆盖
      applyColdPlan({
        root: arch,
        coldDir,
        cold: {
          move: [classifyEntry({ root: arch, name, now: Date.now(), baseNames: COLD_BASE })],
        },
        now: Date.now(),
        apply: true,
        ledger,
        baseNames: COLD_BASE,
      })
      putTree(arch, name, 1000, { 'collision.bin': 5 })
      const clash = restoreFromCold({
        root: arch,
        coldDir,
        name,
        now: Date.now(),
        apply: true,
        ledger,
        baseNames: COLD_BASE,
      })
      assert(!clash.restored && /拒绝覆盖/.test(clash.why), `同名冲突未拒:${JSON.stringify(clash)}`)
      assert(existsSync(join(coldDir, name)), '被拒却把冷侧清了 ⇒ 覆盖式回退')
      assert(existsSync(join(arch, name, 'collision.bin')), '别人的在途同名件被冲掉了')
      const miss = restoreFromCold({ root: arch, coldDir, name: 'no-such-item' })
      assert(miss.missing === true, 'cold/ 里没有这一项必须判"找不到",不得记通过')
      const badName = restoreFromCold({ root: arch, coldDir, name: '../escape' })
      assert(!badName.restored && /单个路径段/.test(badName.why), '越界名字必须直接拒')
      const ops = readFileSync(ledger.file, 'utf8')
        .split('\n')
        .filter(Boolean)
        .map((l) => JSON.parse(l))
      for (const need of ['cold-move', 'cold-restore', 'refuse-restore'])
        assert(
          ops.some((o) => o.op === need),
          `台账缺 ${need} 记录`,
        )
      for (const o of ops.filter((x) => x.ok))
        assert(
          o.from &&
            o.to &&
            typeof o.bytes === 'number' &&
            typeof o.files === 'number' &&
            o.verifiedAt,
          `台账字段不齐:${JSON.stringify(o)}`,
        )
      return `往返一致(${a.bytes}B/${a.files.size}f)+ 拒绝覆盖 + 台账 ${ops.length} 条`
    } finally {
      rmScratch(box)
    }
  })

  t(
    'S11 不可碰清单:§5b 现场 / cold/ 内的 junction / lost-commit bundle 一律拒收点名;摘判据即翻红',
    () => {
      const box = mkScratch('retire-s11-')
      try {
        const arch = mkArch(box)
        const coldDir = coldDirOf(arch)
        mkdirSync(coldDir, { recursive: true })
        const live = join(box, 'IHUI-AI-git-repo')
        mkdirSync(join(live, 'objects'), { recursive: true })
        writeFileSync(join(live, 'HEAD'), 'ref: refs/heads/main\n')
        const aged = 40 * DAY_MS
        const scene = putTree(arch, 'IHUI-AI-git-repo.broken-1790150361407', aged, { 'x.bin': 512 })
        putTree(arch, 'broken-refs', aged, { 'bad-ref.txt': 64 })
        const legit = putTree(arch, 'ihui-git-write.lock.stale-11-ok', aged, { 'y.bin': 512 })
        putTree(arch, 'bundles', aged, { 'lost-commit-0908-stash.bundle': 1200 })
        const now = Date.now()
        let linkNote = '本机建不了 junction ⇒ 冷侧链接臂未跑'
        try {
          symlinkSync(live, join(coldDir, 'ihui-git-write.lock.stale-11-link'), 'junction')
          linkNote = 'cold/ 内注入指向活 gitdir 的 junction'
        } catch (e) {
          linkNote = `建 junction 失败(${e.code})⇒ 冷侧链接臂未跑`
        }
        const { plan, cold } = coldOf(arch)
        const names = cold.move.map((e) => e.name)
        assert(
          names.length === 1 && names[0] === 'ihui-git-write.lock.stale-11-ok',
          `只有那项合法的该进可转清单,实为 ${names.join(',')}`,
        )
        // §5b 现场与"在用子目录"在**分类阶段**就被挡(kind=protected),不落进 cold.blocked ——
        // 这条断言因此读 plan.protected;两条判据各管一格,不得并桶(并了就看不出谁挡的)。
        const prot = plan.protected.map((e) => `${e.name}::${e.reason}`).join('\n')
        assert(/IHUI-AI-git-repo\.broken-/.test(prot) && /P-c/.test(prot), `§5b 现场未被挡:${prot}`)
        assert(/broken-refs/.test(prot), `在用子目录未被挡:${prot}`)
        assert(
          plan.protected.some((e) => e.name === 'broken-refs' && /C-u/.test(e.reason)),
          'C-u 必须在分类阶段就点名(冷层不该是它唯一的看守)',
        )
        const bund = surveyBundles(arch)
        assert(
          bund.present && bund.onlyCopySuspect === 1,
          `bundles/ 必须报名并计"未验明":${JSON.stringify(bund)}`,
        )
        assert(
          cold.move.every((e) => e.name !== 'bundles'),
          'bundles/ 被当成可转项',
        )
        // 真臂:执行那一刻再拦一次(不信任计划)
        const sceneEntry = classifyEntry({
          root: arch,
          name: 'IHUI-AI-git-repo.broken-1790150361407',
          now,
          baseNames: COLD_BASE,
        })
        const refused = moveEntryToCold({
          root: arch,
          coldDir,
          entry: sceneEntry,
          now,
          apply: true,
          baseNames: COLD_BASE,
        })
        assert(
          !refused.moved && /P-c/.test(refused.why),
          `执行期未再拦 §5b:${JSON.stringify(refused)}`,
        )
        assert(existsSync(scene), '被拒却动了源')
        assert(!existsSync(join(coldDir, sceneEntry.name)), '闸门拒收后冷层里却长出了副本')
        // 变异臂:摘掉执行期闸门 ⇒ 冷层里会先长出 §5b 现场的副本,只留 `removeEntry` 的复验兜住源。
        // 这仍是"拒",但**副本已经落地** = 两份并存的脏现场 —— 那条差异就是本判据的价值所在。
        const mutant = moveEntryToCold({
          root: arch,
          coldDir,
          entry: sceneEntry,
          now,
          apply: true,
          baseNames: COLD_BASE,
          guard: () => null,
        })
        assert(mutant.moved === false, '摘掉闸门后连 removeEntry 的复验也没兜住 ⇒ §5b 只有一道闸')
        assert(existsSync(scene), '变异臂把 §5b 现场的源删了(纵深防御失效)')
        assert(
          existsSync(join(coldDir, sceneEntry.name)),
          '变异臂没在冷层留下副本 ⇒ 闸门不是唯一拦住这件事的那一道,上面的证明无效',
        )
        // 冷侧 junction:restore 必须拒绝跟随(否则把活 gitdir 当成"要放回的东西"处理)
        const linkName = 'ihui-git-write.lock.stale-11-link'
        const rs = restoreFromCold({
          root: arch,
          coldDir,
          name: linkName,
          now: Date.now(),
          apply: true,
          baseNames: COLD_BASE,
        })
        if (linkNote.startsWith('cold/')) {
          assert(
            !rs.restored && /重解析点/.test(rs.why),
            `冷侧 junction 未拒:${JSON.stringify(rs)}`,
          )
          assert(existsSync(join(live, 'HEAD')), '跟随 junction 后活 gitdir 伪装件被伤到')
          assert(existsSync(join(coldDir, linkName)), 'junction 本体应留着(本工具不代断链)')
        }
        // 合法项必须真能搬(否则上面三条只是"什么都不做")
        const okRow = classifyEntry({
          root: arch,
          name: 'ihui-git-write.lock.stale-11-ok',
          now,
          baseNames: COLD_BASE,
        })
        const okMove = moveEntryToCold({
          root: arch,
          coldDir,
          entry: okRow,
          now,
          apply: true,
          ledger: makeColdLedger(coldDir),
          baseNames: COLD_BASE,
        })
        assert(okMove.moved === true, `合法项搬不动:${JSON.stringify(okMove)}`)
        assert(!existsSync(legit) && existsSync(join(coldDir, okRow.name)))
        return `可转 1 / §5b+C-u 挡 ${plan.protected.length} / 未验明 bundle 1 / ${linkNote} / 变异臂:摘闸门即在冷层留下 §5b 副本(源仍由 removeEntry 复验兜住)`
      } finally {
        rmScratch(box)
      }
    },
  )

  t('S12 磁盘余量:不足 ⇒ 整轮拒跑并打印实数;量不到 ⇒ 未判定也不记通过', () => {
    const b1 = coldDiskGate({
      neededBytes: 50 * MB,
      minFreeBytes: 512 * MB,
      probePath: 'unused',
      probe: () => ({ bytes: 20 * MB, why: null }),
    })
    assert(b1.ok === false && /余量不足/.test(b1.why), `未拦小盘:${JSON.stringify(b1)}`)
    assert(/可用 20MB/.test(b1.why) && /需 562MB/.test(b1.why), `拒跑时必须打印实数,实为:${b1.why}`)
    const b2 = coldDiskGate({
      neededBytes: 50 * MB,
      minFreeBytes: 512 * MB,
      probePath: 'unused',
      probe: () => ({ bytes: null, why: 'statfs 失败:EPERM' }),
    })
    assert(b2.ok === false && b2.undetermined === true, '量不到当成够 ⇒ 把没判写成判过了')
    assert(b2.why.includes('statfs 失败:EPERM'), '未判定要带原因')
    const b3 = coldDiskGate({
      neededBytes: 50 * MB,
      minFreeBytes: 512 * MB,
      probePath: 'unused',
      probe: () => ({ bytes: 10 * 1024 * MB, why: null }),
    })
    assert(b3.ok === true, '盘够却拦住 ⇒ 判据不认成功')
    // 阳性对照:真跑一次本机 statfs,它必须量出一个数(否则上面三臂全在测空气)
    const real = diskFreeBytes(REPO_ROOT)
    assert(
      typeof real.bytes === 'number' && real.bytes > 0,
      `本机 statfs 量不到:${JSON.stringify(real)}`,
    )
    return `拒跑打印实数 + 未判定不记通过 + 本机现量 ${(real.bytes / MB).toFixed(0)}MB`
  })

  let pass = 0
  for (const r of results) {
    console.info(`${r.ok ? '✅' : '❌'} ${r.name}${r.detail ? ` — ${r.detail}` : ''}`)
    if (r.ok) pass += 1
  }
  console.info(`\nself-test: ${pass}/${results.length} 通过`)
  return pass === results.length ? 0 : 1
}

const isDirectRun = process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href

if (isDirectRun) {
  const argv = process.argv.slice(2)
  if (argv.includes('--self-test')) {
    process.exitCode = selfTest()
  } else {
    runMain({ argv }).catch((e) => {
      console.error(`❌ 脚本自身异常:${e?.message ?? e}\n${e?.stack ?? ''}`)
      process.exitCode = 2
    })
  }
}

export const __test__ = {
  DEFAULT_KEEP_GENERATIONS,
  DEFAULT_MAX_TOTAL_BYTES,
  DEFAULT_COLD_AGE_DAYS,
  DEFAULT_COLD_AGE_MS,
  DEFAULT_MIN_FREE_MB,
  MIN_AGE_MS,
  MAX_WALK_FILES,
  REPO_ROOT,
  LOG_REL,
  COLD_DIR_NAME,
  COLD_LEDGER_FILE,
  IN_USE_SUBPATHS,
  norm,
  isInsideRoot,
  stemOf,
  protectedBaseNames,
  protectedReason,
  inUseReason,
  hasAccidentSignature,
  measureBytes,
  classifyEntry,
  listEntries,
  planRetirement,
  removeEntry,
  applyPlan,
  coldDirOf,
  treeManifest,
  copyTree,
  verifyCopy,
  diskFreeBytes,
  coldDiskGate,
  coldMoveGuard,
  coldBlockReason,
  planColdStorage,
  makeColdLedger,
  moveEntryToCold,
  applyColdPlan,
  restoreFromCold,
  surveyBundles,
  renderColdReport,
  makeLogger,
  renderReport,
  runColdMain,
  runMain,
}
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
