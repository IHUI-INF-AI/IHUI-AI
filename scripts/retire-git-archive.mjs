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
 *     ② 守护档一律 `apply:false` —— 先观察一轮真实判定量,再谈自动删;
 *     ③ 镜像测试必须在"摘掉挂点"时翻红(scripts/tests/retire-git-archive.test.mjs 的 R5 反证臂)。
 *
 * 用法:
 *   node scripts/retire-git-archive.mjs                     # 默认 dry-run,零删除
 *   node scripts/retire-git-archive.mjs --json               # 机器可读
 *   node scripts/retire-git-archive.mjs --keep 10 --max-bytes 2147483648
 *   node scripts/retire-git-archive.mjs --apply              # 真删(§5b 三判据在删除那一刻复验)
 *   node scripts/retire-git-archive.mjs --apply --root <dir> --allow-custom-root  # 人工换根
 *   node scripts/retire-git-archive.mjs --self-test          # 6 组取证,夹具走 mkScratch,零真实影响
 * 退出码:0 = 正常(dry-run / 删除全成功);1 = 有删除失败;2 = **无法判定**(归档根取不到、
 * 换根未声明、枚举失败、存在判不出项)。判定拿不到不记绿。
 *
 * 本工具不派生子进程(所有 git 查询经 lib/gitdir.mjs 的既有出口,那里已带绝对路径 +
 * `-c safe.directory=*` + timeout + windowsHide),不做任何 git 写操作。
 */

import {
  appendFileSync,
  existsSync,
  lstatSync,
  mkdirSync,
  readdirSync,
  readlinkSync,
  realpathSync,
  rmSync,
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
    `§5b 挡掉 = ${plan.protected.length} 项 | 不在射程 = ${plan.outOfScope.length} 项 | 判不出 = ${plan.undetermined.length} 项 | 候选合计 ${fmtMB(plan.inScopeBytes)} | 判定后保留 ${fmtMB(plan.retainedBytes)}`,
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
  L.push('\n—— §5b 挡掉(永不进候选)——')
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

function parseFlag(argv, name, dflt) {
  const i = argv.indexOf(`--${name}`)
  return i >= 0 && argv[i + 1] && !argv[i + 1].startsWith('--') ? argv[i + 1] : dflt
}

/** CLI 主体(导出给镜像测试直接调,零真实删除路径)。 */
export async function runMain({ argv, stdout = console.info, stderr = console.error }) {
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
  MIN_AGE_MS,
  MAX_WALK_FILES,
  REPO_ROOT,
  LOG_REL,
  norm,
  isInsideRoot,
  stemOf,
  protectedBaseNames,
  protectedReason,
  hasAccidentSignature,
  measureBytes,
  classifyEntry,
  listEntries,
  planRetirement,
  removeEntry,
  applyPlan,
  makeLogger,
  renderReport,
  runMain,
}
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
