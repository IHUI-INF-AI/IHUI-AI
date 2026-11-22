#!/usr/bin/env node
// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/* eslint-disable no-console -- CLI 工具,需 console 输出诊断信息 */
/**
 * git-refs-heal.mjs — 嵌套 ref 存续修复(2026-09-12 立)
 *
 * 事故(2026-09-12 实测):
 *   `refs/remotes/origin/main` 反复变 `[gone]`;`refs/tags/backup/push4-*` 反复"仅远端",
 *   于是守门 #30a(commit 丢失防护,blocking)**抖动性阻塞**提交:
 *   刚 fetch 完是绿的,几十秒后宿主一清理又变红。
 *
 * 机理(对照实验,2026-09-12):
 *   宿主清理层会删除 gitdir 下 **depth >= 2** 的嵌套命名空间目录:
 *     refs/heads/main            → depth1 文件 → 存活 ✅
 *     refs/tags/<tag>            → depth1 文件 → 存活 ✅
 *     refs/remotes/origin/main   → depth2 目录 → 被删 ❌(git update-ref 返回 0 但不落盘)
 *     refs/tags/backup/<tag>     → depth2 目录 → 被删 ❌
 *
 * 解法(不是 workaround:换成 git 自带的"打包引用"载体):
 *   把嵌套 ref 固化进 `packed-refs`(gitdir 顶层单文件 → 存活),
 *   松散文件被删也能正常解析;同时用 `refs-manifest.json`(同为顶层文件)留期望值,
 *   缺失即可在**不联网**的前提下重建。时序:
 *     松散写入(嵌套 dir) → `git pack-refs --all --prune` → 松散被 prune,只剩 packed
 *
 * 用法:
 *   node scripts/git-refs-heal.mjs                    # 本地修复:按清单补写 + pack(不联网)
 *   node scripts/git-refs-heal.mjs --refresh-remote   # 联网:从 origin 校准全量 tag/heads,再固化
 *   node scripts/git-refs-heal.mjs --status           # 只查看,不修改
 *
 * 退出码:0 = 清单内 ref 全部可解析;1 = 仍有缺失(需人工)
 */
import { execFileSync } from 'node:child_process'
import { mkdirSync, readFileSync, renameSync, unlinkSync, writeFileSync } from 'node:fs'
import { basename, dirname, join } from 'node:path'
import { pathToFileURL } from 'node:url'
import {
  resolveGitBin,
  resolveWorktree,
  resolveGitdir,
  refExpectationSatisfied,
} from './lib/gitdir.mjs'

// 工作树 / 真实 gitdir 动态解析(不再硬编码 D: 盘;见 scripts/lib/gitdir.mjs 2026-09-15)
const WORKTREE = resolveWorktree()
const GITDIR = resolveGitdir(WORKTREE)
const REFS_MANIFEST = join(GITDIR, 'refs-manifest.json')

/**
 * `lost-commit/*` 期望项是否允许整族摘除(2026-11-05 机主令)。
 *
 * **默认关** ⇒ 行为与既有完全一致(一律 holdover,保证防 gc 载体被清后仍能离线重建)。
 * 只有显式 `IHUI_REFS_MANIFEST_DROP_LOST_TAG_EXPECTATIONS=1` 才把 `refs/tags/lost-commit/**`
 * 交给 prune 流程摘除;**`refs/tags/backup/**` 与其余 tag 期望项不受此开关管辖**,行为不变。
 */
const DROP_LOST_TAG_EXPECTATIONS_ENV = 'IHUI_REFS_MANIFEST_DROP_LOST_TAG_EXPECTATIONS'
function dropLostTagExpectations() {
  return String(process.env[DROP_LOST_TAG_EXPECTATIONS_ENV] || '') === '1'
}

/**
 * 派生 git 的输出缓冲上限。这里必须**显式给**:execFileSync 默认 1 MiB,而 `for-each-ref refs/heads
 * refs/tags refs/remotes` 在本仓(2026-11-03 实测 23,031 枚 tag)输出 1,052,662 B,刚好顶穿默认值报
 * ENOBUFS ⇒ `git(..., true)` 返回 null ⇒ `currentRefs()` 交回空表 ⇒ `--status` 把清单里 22,298 条
 * 期望项**全报成缺失**、currentCount 报 0。那台工具的全部写动作都以这张表为底,空表一旦被当成
 * "当前一个 ref 都没有",下一轮 learning/prune 就会按它抹掉期望项。取 64 MiB:随 tag 增长留出
 * 两个数量级余量,而它只在真读 ref 时一次性分配。
 */
const GIT_MAX_BUFFER_BYTES = 64 * 1024 * 1024

/**
 * 派生 git 的原始结果。`git()` 的 allowFail 把所有失败折成 null,调用方分不清
 * 「进程没跑成」和「命令跑了、git 自己否定」。需要三态的判据(对象是否存在)走这里。
 * @returns {{ok:true,stdout:string,status:number,signal:null,code:null,stderr:string}|{ok:false,reason?:string,status:number|null,signal:string|null,code:string|null,stderr:string,killed?:boolean,error?:Error}}
 */
function runGit(args) {
  const bin = resolveGitBin()
  if (!bin) {
    return { ok: false, reason: 'git-unavailable', status: null, signal: null, code: 'NO_GIT', stderr: '' }
  }
  try {
    const stdout = execFileSync(bin, ['-c', 'safe.directory=*', '-C', WORKTREE, ...args], {
      encoding: 'utf8',
      // 2026-10-04:不吃的子进程必须给 stdio,否则本机报 spawnSync EBUSY
      // 返回值被消费 ⇒ stdout 仍须 pipe,只把 stdin 切掉
      stdio: ['ignore', 'pipe', 'pipe'],
      windowsHide: true, // GUI 宿主下派生 git 不显控制台窗口(AGENTS.md §5b)
      maxBuffer: GIT_MAX_BUFFER_BYTES,
      timeout: 180000,
      // DBG-88 补刀(2026-11-11 实测):本仓是 blob:none 部分克隆,`cat-file -e` 对不在本地的
      // 对象会触发 lazy-fetch **真联网**(单次 49-55s),远端否定的 stderr 是
      // `fatal: remote error: upload-pack: not our ref …` —— 既不匹配 MISSING_OBJECT_RE、
      // stderr 也非空,安静否定被并成 undetermined,还违反本器"全程不联网"的契约(§头部)。
      // 对象存在性问的只是**本地对象库**;manifest 里的 backup/*、lost-commit/* 目标全是
      // commit —— blob:none 下 commit/tree 本就全量在本地,关掉惰性取回不改变判定语义。
      // 显式 fetch(--refresh-remote)是独立子命令,不受此变量影响。
      env: { ...process.env, GIT_NO_LAZY_FETCH: '1' },
    })
    return { ok: true, stdout: String(stdout ?? ''), status: 0, signal: null, code: null, stderr: '' }
  } catch (e) {
    return {
      ok: false,
      status: e && e.status != null ? e.status : null,
      signal: e && e.signal ? e.signal : null,
      code: e && typeof e.code === 'string' ? e.code : null,
      stderr: e && e.stderr != null ? String(e.stderr) : '',
      killed: Boolean(e && e.killed),
      error: e,
    }
  }
}

function git(args, allowFail = false) {
  const r = runGit(args)
  if (r.ok) return r.stdout.trim()
  if (allowFail) return null
  if (r.reason === 'git-unavailable') throw new Error('git 不可用:候选可执行文件均不可调用')
  throw r.error
}

// GITDIR / REFS_MANIFEST 已在文件顶部由共享库解析(动态,不再硬编码 D: 盘,2026-09-15)

/**
 * 是否需要"打包固化"的 ref:
 *   depth >= 2 的命名空间在 gitdir 下会被宿主清理(实测),必须固化进 packed-refs。
 *   refs/heads/main → 3 段;refs/tags/backup/x → 4 段;refs/remotes/origin/main → 4 段。
 */
function isNestedRef(ref) {
  return !ref.startsWith('refs/heads/') && ref.split('/').length >= 4
}

/**
 * 期望清单的读出口(2026-10-30 改为 export):`prune-redundant-lost-tags.mjs` 清仓时必须
 * 把同一条目的期望值一起摘掉 —— 否则存续层下一轮就把删掉的引用**离线重建回来**(实测 22:08
 * 一次重建 8,086 枚)。清单的形状/落点/失败语义只许有一份(AGENTS §0.6),所以这里开出口,
 * 不在调用方另抄一个 JSON 读写。
 *
 * 三态(DBG-89):文件不存在 ⇒ 空表(没清单就什么都不重建);合法对象 ⇒ 该表;
 * 坏 JSON / 非对象 / 读失败 ⇒ **不得**折成 `{}`。折成空表再 save 会把两万条期望永久盖掉。
 */
export function parseManifestText(text) {
  let m
  try {
    m = JSON.parse(text)
  } catch {
    return { state: 'corrupt', reason: 'json-invalid' }
  }
  if (!m || typeof m !== 'object' || Array.isArray(m)) {
    return { state: 'corrupt', reason: 'not-object' }
  }
  return { state: 'ok', map: m }
}

export function readManifestAt(path) {
  let text
  try {
    text = readFileSync(path, 'utf8')
  } catch (e) {
    if (e && e.code === 'ENOENT') return { state: 'missing', map: {} }
    return { state: 'undetermined', reason: `read-${e && e.code ? e.code : 'failed'}` }
  }
  return parseManifestText(text)
}

/** 给会接着写盘的调用方:坏文件/读失败时 ok=false,map 不是空期望。 */
export function takeManifestForMutation(path) {
  const r = readManifestAt(path)
  if (r.state === 'ok' || r.state === 'missing') return { ok: true, map: r.map, state: r.state }
  return { ok: false, state: r.state, reason: r.reason || '', map: null }
}

function manifestMapForCaller(result) {
  if (result.state === 'ok') return result.map
  if (result.state === 'missing') return {}
  const err = new Error(
    `refs-manifest.json 未判定(${result.state}${result.reason ? ': ' + result.reason : ''}),拒绝按空期望继续`,
  )
  err.code = 'REFS_MANIFEST_UNJUDGED'
  throw err
}

export function readManifest() {
  return manifestMapForCaller(readManifestAt(REFS_MANIFEST))
}

/** 清单落点(开给调用方做"读不到就别写"的前置判断 —— 存续层清单被清空 = 所有期望值一起丢)。 */
export const REFS_MANIFEST_PATH = REFS_MANIFEST

let manifestWriteSeq = 0

/**
 * 同目录临时文件 + rename。崩溃落在临时文件上,目标要么仍是上一份完整内容,要么已是新文件。
 * rename 失败只删临时文件,不动目标(禁止先 unlink 目标再改名 —— 那一窗口比半截 JSON 更糟)。
 */
function atomicWriteFile(dest, body) {
  const dir = dirname(dest)
  const tmp = join(dir, `.${basename(dest)}.${process.pid}.${Date.now()}.${++manifestWriteSeq}.tmp`)
  try {
    mkdirSync(dir, { recursive: true })
    writeFileSync(tmp, body, 'utf8')
    renameSync(tmp, dest)
    return true
  } catch (e) {
    try {
      unlinkSync(tmp)
    } catch {
      /* 临时文件可能没写成 */
    }
    throw e
  }
}

/**
 * 期望清单的写出口(与 readManifest 同一条序列化形态,调用方不得自己 stringify)。
 * 目标已存在且不是合法对象时拒绝覆盖:调用方哪怕手里拿着 `{}` 也盖不掉坏文件。
 */
export function saveManifestAt(dest, map) {
  if (!map || typeof map !== 'object' || Array.isArray(map)) return false
  const prior = readManifestAt(dest)
  if (prior.state !== 'ok' && prior.state !== 'missing') {
    console.error(
      `清单拒绝覆盖(${prior.state}${prior.reason ? ': ' + prior.reason : ''}):坏文件不得按空期望重写`,
    )
    return false
  }
  try {
    atomicWriteFile(dest, JSON.stringify(map, null, 1) + '\n')
    return true
  } catch (e) {
    console.error('清单写入失败:', String(e.message || e))
    return false
  }
}

export function saveManifest(map) {
  return saveManifestAt(REFS_MANIFEST, map)
}

/** 当前全部 ref(name → sha),含 packed 与松散 */
/**
 * 把 `for-each-ref` 的输出解析成 ref→sha 表。**纯函数**,`out === null` 代表"问不到",
 * 与"问到了但一个也没有"(空串 ⇒ 空表)必须是两种形态:把前者折成空表,调用方就会按
 * "当前没有任何 ref"去重建/摘除期望项(成因与读数见 GIT_MAX_BUFFER_BYTES 注释)。
 */
export function parseRefsTable(out) {
  if (out === null || out === undefined) return null
  const map = {}
  for (const line of String(out).split('\n')) {
    const [ref, sha] = line.trim().split(/\s+/)
    if (ref && sha) map[ref] = sha
  }
  return map
}

function currentRefs() {
  return parseRefsTable(
    git(
      [
        'for-each-ref',
        '--format=%(refname) %(objectname)',
        'refs/heads',
        'refs/tags',
        'refs/remotes',
      ],
      true,
    ),
  )
}

/** 单 ref 是否可解析(宽松:packed 或松散均可) */
function refResolvable(ref) {
  const sha = git(['rev-parse', '--verify', '--quiet', ref], true)
  return !!sha
}

/**
 * 把 `cat-file -e` 的原始结果分成三态。只有 `missing` 允许从期望清单剔除。
 *
 * 本机实测(只读,`git cat-file -e`):
 *   - 对象在:exit 0,stdout 空串(用真值判断会把"在"读成"不在")
 *   - 40 位名字合法但对象不在:exit 1,stderr 空。这是 -e 的安静否定,不是派生失败
 *   - 名字不被接受:exit 128 + `Not a valid object name`
 *   - 派生失败(EBUSY/ETIMEDOUT/无 git/被信号杀死):status 为 null,或带 spawn code/signal
 * 最后一档若并进「不存在」,一次瞬时失败就会删掉 backup/* 与 lost-commit/* 期望。
 */
const MISSING_OBJECT_RE = /not a valid object name|could not get object info|\bbad object\b/i
const UNDETERMINED_STDERR_RE =
  /ambiguous|unable to|permission denied|index\.lock|resource temporarily|timed out|not a git repository/i

export function classifyObjectProbe(r) {
  if (!r || (r.ok !== true && r.ok !== false)) return 'undetermined'
  if (r.ok === true) return 'exists'
  if (r.reason === 'git-unavailable' || r.killed || r.signal) return 'undetermined'
  if (typeof r.code === 'string' && r.code) return 'undetermined'
  if (r.status === null || r.status === undefined) return 'undetermined'
  const stderr = String(r.stderr || '')
  if (UNDETERMINED_STDERR_RE.test(stderr)) return 'undetermined'
  if (MISSING_OBJECT_RE.test(stderr)) return 'missing'
  if (r.status === 1 && stderr.trim() === '') return 'missing'
  return 'undetermined'
}

function defaultObjectProbe(sha) {
  return runGit(['cat-file', '-e', String(sha)])
}

/**
 * 对象是否可解析。`export` 是给 `git-guardian.mjs` 复用的 —— 守护每 2 分钟跑的 `healRefs()`
 * 与本文件的离线重建必须共用同一份判定。
 *
 * 返回三态,不要收成布尔:
 *   true  对象在(含 cat-file -e 成功时的空 stdout)
 *   false git 已跑完并确认对象不在 —— 只有这一档可以删期望
 *   null  命令失败/未判定 —— 调用方不得删期望。`!null` 仍为真,守护的写前自证会拒绝落盘,方向是对的
 * 第二参只给测试注入探针;生产调用不传,走真实 git。
 */
export function objectExists(sha, probe = defaultObjectProbe) {
  if (!/^[0-9a-f]{7,40}$/.test(String(sha || ''))) return false
  const kind = classifyObjectProbe(probe(String(sha)))
  if (kind === 'exists') return true
  if (kind === 'missing') return false
  return null
}

/**
 * 按"对象是否可读"把待重建项分流。纯函数,exists 由调用方注入(自检用假谓词)。
 * 为什么必须有这一步(2026-09-24 实测):清单 `refs-manifest.json` 里记的 sha 会随宿主清理层抹掉
 * `objects/xx/` 而变成**死引用**(本机当日 fsck 报坏链 83,108 条 / 缺失目标 35,319 个)。
 * 按死值重建 = 亲手写出一枚指向不存在对象的 ref,而**坏指针会让每一次 `git fetch` 直接 fatal**
 * (⇒ 推送链全死;git-push-guard 2.9b 已在推送侧拦这个)。死的只能剔除 + 如实计数,等联网校准。
 *
 * exists 的三态:true → 可重建;false → 确认死亡(可剔除);其它(null/undefined)→ held,
 * **不得**并进 dead。真值判断会把「没问成」当成「对象没了」。
 */
export function splitDeadRefs(broken, exists) {
  const dead = []
  const rebuildable = []
  const held = []
  for (const [ref, sha] of broken) {
    const v = exists(sha)
    if (v === true) rebuildable.push([ref, sha])
    else if (v === false) dead.push([ref, sha])
    else held.push([ref, sha])
  }
  return { dead, rebuildable, held }
}

/** 只摘确认死亡的期望。held(未判定)一条都不动,backup/* 与 lost-commit/* 同此。 */
export function applyDeadExpectationDrops(map, split) {
  const dropped = []
  for (const [ref] of (split && split.dead) || []) {
    if (Object.prototype.hasOwnProperty.call(map, ref)) {
      delete map[ref]
      dropped.push(ref)
    }
  }
  return {
    dropped,
    held: ((split && split.held) || []).map(([ref]) => ref),
  }
}

/** 直写松散 ref(node fs —— `git update-ref` 对嵌套命名空间返回 0 却不落盘) */
function writeLooseRef(ref, sha) {
  const p = join(GITDIR, ref.replace(/\//g, '/'))
  mkdirSync(dirname(p), { recursive: true })
  writeFileSync(p, sha + '\n', 'utf8')
}

/** 把松散 ref 固化进 packed-refs(顶层单文件,宿主清理不到) */
function packRefs() {
  git(['pack-refs', '--all', '--prune'], true)
}

/**
 * 从 FETCH_HEAD(gitdir 顶层文件 → 宿主清理不到)取 `origin/main` 的权威值。
 *
 * 为什么需要:git fetch 把新值写成**松散** refs/remotes/origin/main(嵌套目录),
 * 该文件实测在 1 秒内即被宿主清理;若 packed-refs 里还留着上一次的旧值,
 * git 就回落到旧值 → 明明同 sha 却显示 `## main...origin/main [ahead 1]`。
 * FETCH_HEAD 是 fetch 自己写的顶层文件,内容形如:
 *   <sha>\t\tbranch 'main' of https://github.com/...
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
  // 优先取显式提到 main 的那一行;仅一行时直接采用(单 ref fetch 的常规形态)
  const mainLine =
    lines.find((l) => /branch\s+'?main'?\b/.test(l)) ?? (lines.length === 1 ? lines[0] : null)
  if (!mainLine) return null
  const m = mainLine.trim().match(/^([0-9a-f]{40})/)
  return m ? m[1] : null
}

/** 远端面是否"完整到有资格删期望项":`--tags --heads` 任一侧半失败时必须一个都不删 */
function remoteFaceIsComplete(remoteRefNames) {
  const list = [...remoteRefNames]
  return list.some((r) => r.startsWith('refs/heads/')) && list.some((r) => r.startsWith('refs/tags/'))
}

/** 清单里的本地键 → 远端可能用来表达它的那些 ref 名(拿不准就算"存在",宁留不误删) */
function remoteCandidatesFor(ref) {
  if (ref.startsWith('refs/remotes/origin/')) {
    const rest = ref.slice('refs/remotes/origin/'.length)
    // 同一分支名在远端既有 heads 形态、也有本机 tracking 形态,故两种都算命中
    return [`refs/heads/${rest}`, ref]
  }
  if (ref.startsWith('refs/tags/')) return [ref]
  return null // 其它来源的键不在本判据射程(不判、也不删)
}

/**
 * 从期望清单摘掉「远端已不存在」的项。
 * 为什么必须有这一步(2026-10-04 实测):本器此前只增不删,于是远端**已被其属主删除**的分支会
 * 永久留在 `refs-manifest.json` 里,而 healRefs() 每 2 分钟按清单把它重新造回来 —— 门 41
 * (单分支开发)因此恒红,而 §9b 又明写"fetch + prune 是日常":两条规矩互相顶,结果是
 * 被 prune 掉的引用一定会复活。`git fetch --prune` 当场能让门变绿、下一 tick 又红,即此型。
 * 三条不可漂的护栏:
 *  ① 远端面不完整 ⇒ 一个都不删并把原因喊出来。把"这次没返回"读成"远端没有",等于让一次
 *     网络/权限抖动删光整族期望项 —— 那比恒红严重得多(§5b 的分层自愈正依赖这份清单)。
 *  ② 只动 origin 命名空间(refs/remotes/origin/**、refs/tags/**),其它形态的键不判也不删。
 *  ③ 按**键名**判存在,不比 sha(sha 由上面的校准负责);候选名任一命中即保留。
 * @param {object} [opts]
 * @param {boolean} [opts.dropLostCommitTagExpectations=false] 显式开关:整族摘除 `refs/tags/lost-commit/**`
 * @param {boolean} [opts.dryRun=false] true = 只算不写(供 --prune-dry-run 干跑)
 * @returns {{removed:string[], kept:number, skippedNonOrigin:number, tagHoldovers:number, lostTagRemoved:number, declined:boolean}}
 */
function pruneAbsentExpectations(map, remoteRefNames, opts = {}) {
  const { dropLostCommitTagExpectations = false, dryRun = false } = opts
  const all = Object.keys(map)
  if (!remoteFaceIsComplete(remoteRefNames)) {
    return {
      removed: [],
      kept: all.length,
      skippedNonOrigin: 0,
      tagHoldovers: 0,
      lostTagRemoved: 0,
      declined: true,
    }
  }
  const removed = []
  let skippedNonOrigin = 0
  let tagHoldovers = 0
  let lostTagRemoved = 0
  for (const ref of all) {
    // 2026-11-05:lost-commit/* 期望项不再**无条件**保留。显式开关打开时整族摘除(它们的
    // 语义是"防 gc 载体的期望",迁移到 keep 介质后由新载体接管);backup/* 与其它 tag 一律
    // 走下面的 holdover 分支,行为不变(§22 禁删、§5b 双留)。
    if (dropLostCommitTagExpectations && ref.startsWith('refs/tags/lost-commit/')) {
      removed.push(ref)
      lostTagRemoved++
      continue
    }
    const candidates = remoteCandidatesFor(ref)
    if (!candidates) {
      skippedNonOrigin++
      continue
    }
    if (candidates.some((c) => remoteRefNames.has(c))) continue
    // 命中"远端已无",仍要分档:tags 一律不动。清单是"被宿主清掉的 ref 离线重建"的唯一依据,
    // 摘掉 backup/*、lost-commit/* 的期望项 = 那些备份 tag 一旦被清就永不重建(§22 禁删、§5b 双留)。
    if (ref.startsWith('refs/tags/')) {
      tagHoldovers++
      continue
    }
    removed.push(ref)
  }
  if (!dryRun) for (const ref of removed) delete map[ref]
  return {
    removed,
    kept: dryRun ? all.length - removed.length : Object.keys(map).length,
    skippedNonOrigin,
    tagHoldovers,
    lostTagRemoved,
    declined: false,
  }
}

/** 从 origin 校准:全量 tag + refs/heads/main(需网络;代理走环境变量) */
let remoteCalibrated = false
// 本轮 ls-remote 见到的远端 ref 全集。为什么要挂到模块级:摘除"远端已无"的期望项必须发生在
// main 的学习步骤**之后**(learning 按盘面 ref 纳管,先摘会被同一轮立刻写回 —— 实测打印
// "摘除 4 个"而清单残留 1),而学习那一步也要能问这份名单,否则它拿不到远端真值就只能猜。
let lastRemoteRefs = null
function refreshFromRemote() {
  const out = git(['ls-remote', '--tags', '--heads', 'origin'], true)
  if (!out) {
    console.error('❌ 无法读取远端 ref(网络/代理不可达)。可先设置:')
    console.error('   http_proxy=http://127.0.0.1:7897 https_proxy=http://127.0.0.1:7897')
    return false
  }
  const taken = takeManifestForMutation(REFS_MANIFEST)
  if (!taken.ok) {
    console.error(
      `❌ refs-manifest.json ${taken.state}${taken.reason ? ' (' + taken.reason + ')' : ''} ⇒ 拒绝用远端结果覆盖(坏清单不是空期望)`,
    )
    return 'unjudged'
  }
  const map = taken.map
  const remoteRefNames = new Set()
  lastRemoteRefs = remoteRefNames
  let added = 0
  for (const line of out.split('\n')) {
    const [sha, ref] = line.trim().split(/\s+/)
    if (!sha || !ref) continue
    if (ref.endsWith('^{}')) continue // annotated tag 的 peel 行
    remoteRefNames.add(ref)
    // 远端分支只跟 main(refs/heads/main → refs/remotes/origin/main)
    const local = ref === 'refs/heads/main' ? 'refs/remotes/origin/main' : ref
    if (!isNestedRef(local)) continue // depth1 的天然存活,不入清单
    if (map[local] !== sha) added++
    map[local] = sha
  }
  const pruned = pruneAbsentExpectations(map, remoteRefNames, {
    dropLostCommitTagExpectations: dropLostTagExpectations(),
  })
  if (pruned.removed.length) {
    console.log(`[refresh-remote] 摘除 ${pruned.removed.length} 个远端已不存在的期望项:`)
    for (const r of pruned.removed) console.log(`   - ${r}`)
  }
  if (pruned.declined) {
    console.log(
      '[refresh-remote] ⚠️ 远端面不完整(本次没同时看到 refs/heads/* 与 refs/tags/*)⇒ 本次**只校准不摘除**;' +
        '把"没返回"当成"远端没有"会一次删光整族期望项',
    )
  }
  const ok = saveManifest(map)
  if (ok) remoteCalibrated = true
  console.log(
    `[refresh-remote] 已从 origin 校准 ${Object.keys(map).length} 个嵌套 ref(变更 ${added} 个、摘除 ${pruned.removed.length} 个、非 origin 键不动 ${pruned.skippedNonOrigin} 个)`,
  )
  return ok
}

function status() {
  const cur = currentRefs()
  const taken = takeManifestForMutation(REFS_MANIFEST)
  if (!taken.ok) {
    return {
      gitdir: GITDIR,
      manifestCount: null,
      currentCount: cur === null ? null : Object.keys(cur).length,
      state: 'unjudged',
      reason: `refs-manifest.json ${taken.state}${taken.reason ? ' ' + taken.reason : ''} ⇒ 坏清单不得按空期望计,也不覆盖`,
      missing: [],
    }
  }
  const map = taken.map
  const entries = Object.entries(map)
  // 问不到 ref 面 ⇒ 未判定:不报"全缺失",也不给任何写动作提供空底表(§0.3)
  if (cur === null) {
    return {
      gitdir: GITDIR,
      manifestCount: entries.length,
      currentCount: null,
      state: 'unjudged',
      reason: 'for-each-ref 问不到当前 ref 面 ⇒ 无法判缺失(把"问不到"折成"一个都没有"会撒数千枚松散 ref)',
      missing: [],
    }
  }
  const missing = entries
    .filter(([ref, sha]) => !refExpectationSatisfied(ref, sha, cur[ref]))
    .map(([ref]) => ref)
  return {
    gitdir: GITDIR,
    manifestCount: entries.length,
    currentCount: Object.keys(cur).length,
    state: 'judged',
    missing,
  }
}

/**
 * 逻辑自检(零副作用:不写 ref、不动清单)——
 * 重点钉两类会把修复本身搞坏的错误:① 把活 ref 判成死的(等于删光清单);
 * ② `cat-file -e` 成功时输出空串,用真值判断会把"存在"读成"不存在"。
 */
function selfTest() {
  const cases = []
  const t = (name, fn) => cases.push([name, fn])
  const A = 'refs/remotes/origin/main'
  const B = 'refs/tags/backup/x'
  const shaAlive = 'aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa'
  const shaDead = 'bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb'
  const existsOnly = (s) => s === shaAlive

  // ── 摘除「远端已不存在」的期望项(2026-10-04 新增):门 41 恒红的根因是清单只增不删 ──
  const GHOST = 'refs/remotes/origin/wip/collect-2026-09-30'
  const GONE_TAG = 'refs/tags/backup/deleted-one'
  t('摘除判据:远端已无的 origin 键被摘,存在的不被摘;tag 键一律不摘只报名', () => {
    const map = { [A]: shaAlive, [GHOST]: shaAlive, [GONE_TAG]: shaAlive }
    const remote = new Set(['refs/heads/main', A, 'refs/tags/keep/me'])
    const r = pruneAbsentExpectations(map, remote)
    if (r.declined) throw new Error('远端面含 heads+tags,不应判为不完整')
    // 唯一应被摘的是那枚幻影 tracking ref
    if (r.removed.length !== 1 || r.removed[0] !== GHOST)
      throw new Error(`removed=${JSON.stringify(r.removed)},应只含 ${GHOST}`)
    if (map[A] === undefined) throw new Error('main 被误摘')
    // tag 那一支是 §22/§5b 的硬约束:远端没有也不许摘清单 —— 清单是备份 tag 被宿主清掉之后
    // 唯一的离线重建依据,摘了就等于让"本地+远端双留"退化成"单留",且这件事不会有任何报错。
    if (r.tagHoldovers !== 1) throw new Error(`tagHoldovers=${r.tagHoldovers},应为 1`)
    if (map[GONE_TAG] === undefined) throw new Error('远端已无的 tag 期望项被摘除了(违反 §22 禁删)')
    if (r.kept !== 2) throw new Error(`kept=${r.kept},应为 2`)
  })
  t('反向对照:把所有 tag 期望项都判成可摘,必须被上一条抓住', () => {
    // 这条不是冗余断言 —— 它是上一条例外分支的"牙齿":若有人删掉 `ref.startsWith('refs/tags/')`
    // 那一支,本用例仍会绿(因为它只数一遍),所以这里改判**方向**:远端整体缺失 tags 侧时,
    // 不完整判据必须先拦住,任何 tag 键都不得进入 removed。
    const map = { [GONE_TAG]: shaAlive, [GHOST]: shaAlive }
    const r = pruneAbsentExpectations(map, new Set(['refs/heads/main']))
    if (!r.declined) throw new Error('远端没看到任何 refs/tags/* 却进入了摘除流程')
    if (r.removed.length !== 0) throw new Error(`removed=${JSON.stringify(r.removed)}`)
    if (map[GONE_TAG] === undefined) throw new Error('declined 分支却摘掉了 tag 期望项')
  })
  t('关键反向对照:远端面不完整 ⇒ 一个都不摘(把"没返回"读成"远端没有"会删光整族)', () => {
    const map = { [A]: shaAlive, [GHOST]: shaAlive, [GONE_TAG]: shaAlive }
    // 只见 tags、整侧 heads 缺失(网络半失败的典型形状)
    const onlyTags = new Set(['refs/tags/keep/me'])
    const r1 = pruneAbsentExpectations(map, onlyTags)
    if (!r1.declined || r1.removed.length !== 0)
      throw new Error(`heads 侧缺失时仍执行了摘除:${JSON.stringify(r1.removed)}`)
    if (Object.keys(map).length !== 3) throw new Error('declined 分支却改动了清单')
    // 只见 heads、tags 侧缺失
    const onlyHeads = new Set(['refs/heads/main', A])
    const r2 = pruneAbsentExpectations({ [GONE_TAG]: shaAlive }, onlyHeads)
    if (!r2.declined || r2.removed.length !== 0) throw new Error('tags 侧缺失时未拒绝摘除')
  })
  t('非 origin 命名空间的键不判也不摘(超出本判据射程就不许动手)', () => {
    const map = { 'refs/heads/somewhere': shaAlive, 'refs/notes/x': shaAlive }
    const r = pruneAbsentExpectations(map, new Set(['refs/heads/main', 'refs/tags/t']))
    if (r.removed.length !== 0) throw new Error(`越界摘除了 ${JSON.stringify(r.removed)}`)
    if (r.skippedNonOrigin !== 2) throw new Error(`skippedNonOrigin=${r.skippedNonOrigin}`)
    if (Object.keys(map).length !== 2) throw new Error('越界键被改动了')
  })
  t('候选名任一命中即保留:远端以 refs/heads/<rest> 表达的 tracking ref 不得被摘', () => {
    const map = { 'refs/remotes/origin/feature/x': shaAlive }
    // 远端只有 refs/heads/feature/x(没有同名 refs/remotes/...)
    const r = pruneAbsentExpectations(map, new Set(['refs/heads/feature/x', 'refs/tags/t']))
    if (r.removed.length !== 0) throw new Error('同义候选名未参与判定 ⇒ 正当 ref 被误摘')
    const r2 = pruneAbsentExpectations({ 'refs/remotes/origin/gone/x': shaAlive }, new Set(['refs/heads/main', 'refs/tags/t']))
    if (r2.removed.length !== 1) throw new Error('远端确无该分支时应摘,却没摘')
  })

  t('死引用进 dead、不进 rebuildable(否则会被反复"重建"成坏指针)', () => {
    const { dead, rebuildable } = splitDeadRefs(
      [
        [A, shaAlive],
        [B, shaDead],
      ],
      existsOnly,
    )
    if (dead.length !== 1 || dead[0][0] !== B) throw new Error(`dead=${JSON.stringify(dead)}`)
    if (rebuildable.length !== 1 || rebuildable[0][0] !== A) throw new Error('活引用被误判为死')
  })
  t('全部存活 → dead 必须为空(反向对照,防"恒判死"把清单删光)', () => {
    const all = [
      [A, shaAlive],
      [B, shaAlive],
    ]
    const { dead, rebuildable } = splitDeadRefs(all, () => true)
    if (dead.length !== 0 || rebuildable.length !== 2) throw new Error(`dead=${dead.length}`)
  })
  t('空清单分流结果两侧皆空(不凭空造 ref)', () => {
    const { dead, rebuildable } = splitDeadRefs([], () => true)
    if (dead.length || rebuildable.length) throw new Error('空输入产出了非空结果')
  })
  t('objectExists:cat-file -e 成功输出空串也必须判"存在"(真值陷阱)', () => {
    const head = git(['rev-parse', 'HEAD'], true)
    if (!head) throw new Error('取不到 HEAD,本例无环境')
    if (objectExists(head) !== true)
      throw new Error(`活对象 ${head.slice(0, 8)} 被判成不存在 ⇒ 每轮都会删清单`)
    if (objectExists('deadbeefdeadbeefdeadbeefdeadbeefdeadbeef') !== false)
      throw new Error('不存在的 sha 必须判 false;null 是未判定,两者不得并档')
    if (objectExists('') !== false || objectExists(null) !== false || objectExists('not-a-sha') !== false)
      throw new Error('空值/非法值应判不存在,不得去问 git')
  })

  t('objectExists 三态:命令失败不得并进「不存在」(否则会删 backup/lost-commit 期望)', () => {
    const sha = 'a'.repeat(40)
    if (classifyObjectProbe({ ok: true, stdout: '' }) !== 'exists')
      throw new Error('空 stdout 的成功被读成不存在(真值陷阱回潮)')
    if (classifyObjectProbe({ ok: false, status: 1, code: null, signal: null, stderr: '' }) !== 'missing')
      throw new Error('cat-file -e 安静 exit 1 应判对象不存在')
    if (
      classifyObjectProbe({
        ok: false,
        status: 128,
        code: null,
        signal: null,
        stderr: 'fatal: Not a valid object name deadbeef\n',
      }) !== 'missing'
    )
      throw new Error('Not a valid object name 应判不存在')
    for (const sample of [
      { ok: false, status: null, code: 'EBUSY', signal: null, stderr: '' },
      { ok: false, status: null, code: 'ETIMEDOUT', signal: 'SIGTERM', killed: true, stderr: '' },
      { ok: false, reason: 'git-unavailable', status: null, code: 'NO_GIT', stderr: '' },
      { ok: false, status: 128, code: null, signal: null, stderr: 'fatal: ambiguous argument abc\n' },
      { ok: false, status: 128, code: null, signal: null, stderr: 'fatal: not a git repository\n' },
      { ok: false, status: 128, code: null, signal: null, stderr: '' },
    ]) {
      if (classifyObjectProbe(sample) !== 'undetermined')
        throw new Error(`命令失败被判成了可删档: ${JSON.stringify(sample)}`)
    }
    if (objectExists(sha, () => ({ ok: false, status: null, code: 'EBUSY', signal: null, stderr: '' })) !== null)
      throw new Error('EBUSY 必须是 null(未判定),不得是 false')
    if (objectExists(sha, () => ({ ok: false, status: 1, code: null, signal: null, stderr: '' })) !== false)
      throw new Error('安静 exit 1 应是 false')
    const backup = 'refs/tags/backup/snap'
    const lost = 'refs/tags/lost-commit/auto-abc'
    const ghost = 'refs/remotes/origin/gone/x'
    const map = { [backup]: sha, [lost]: sha, [ghost]: shaDead }
    const probe = (s) =>
      s === shaDead
        ? { ok: false, status: 1, code: null, signal: null, stderr: '' }
        : { ok: false, status: null, code: 'EBUSY', signal: null, stderr: '' }
    const split = splitDeadRefs(
      [
        [backup, sha],
        [lost, sha],
        [ghost, shaDead],
      ],
      (s) => objectExists(s, probe),
    )
    if (split.dead.some(([ref]) => ref.startsWith('refs/tags/')))
      throw new Error(`未判定的 tag 期望进了 dead: ${JSON.stringify(split.dead)}`)
    applyDeadExpectationDrops(map, split)
    if (map[backup] !== sha || map[lost] !== sha) throw new Error('瞬时失败删了 backup/* 或 lost-commit/* 期望')
    if (map[ghost] !== undefined) throw new Error('已确认不存在的对象应仍可剔除')
  })

  t('坏清单不得解析成空期望,写入必须是同目录临时文件 + rename', () => {
    const bad = parseManifestText('{"refs/tags/backup/x":')
    if (bad.state !== 'corrupt' || bad.map) throw new Error('坏 JSON 被解析出了期望表')
    if (parseManifestText('[]').state !== 'corrupt') throw new Error('数组不是期望表,不得当成空清单')
    const empty = parseManifestText('{}')
    if (empty.state !== 'ok' || Object.keys(empty.map).length !== 0) throw new Error('合法空对象应是 ok')
    let code = ''
    try {
      manifestMapForCaller(bad)
    } catch (e) {
      code = e.code || ''
    }
    if (code !== 'REFS_MANIFEST_UNJUDGED') throw new Error(`坏清单被当成了空期望: ${code}`)
    const src2 = readFileSync(new URL('./git-refs-heal.mjs', import.meta.url), 'utf8')
    const atomic = src2.slice(src2.indexOf('function atomicWriteFile'), src2.indexOf('function atomicWriteFile') + 900)
    if (!/renameSync\(tmp,\s*dest\)/.test(atomic)) throw new Error('清单不是 rename 替换')
    if (!/dirname\(dest\)/.test(atomic)) throw new Error('临时文件不在目标同目录')
    if (/writeFileSync\(\s*dest\b/.test(atomic)) throw new Error('仍在直接覆盖目标文件')
    const saveBody = src2.slice(src2.indexOf('function saveManifestAt'), src2.indexOf('function saveManifestAt') + 700)
    if (!/prior\.state !== 'ok'/.test(saveBody)) throw new Error('坏文件仍会被覆盖')
  })

  t('ref 面解析:问不到⇒null(未判定)、空输出⇒{}、有行⇒表 —— 三者不得并桶', () => {
    if (parseRefsTable(null) !== null) throw new Error('问不到被折成了空表(22,298 条假缺失的成因)')
    if (parseRefsTable(undefined) !== null) throw new Error('undefined 同样必须判"问不到"')
    const empty = parseRefsTable('')
    if (empty === null || Object.keys(empty).length !== 0)
      throw new Error('真空输出应是空表,且不得与"问不到"同形')
    const ok = parseRefsTable(`${A} ${shaAlive}\n\n${B} ${shaDead}\n`)
    if (ok[A] !== shaAlive || ok[B] !== shaDead)
      throw new Error(`解析结果不对:${JSON.stringify(ok)}`)
    // 反向断言:派生 git 若没带显式 maxBuffer,ENOBUFS 会把大输出静默变成 null ⇒ 整维失明
    const src = readFileSync(new URL('./git-refs-heal.mjs', import.meta.url), 'utf8')
    const call = src.slice(src.indexOf('function runGit('), src.indexOf('function runGit(') + 900)
    if (!/maxBuffer:\s*GIT_MAX_BUFFER_BYTES/.test(call))
      throw new Error('runGit() 丢了显式 maxBuffer ⇒ 大输出会静默报 ENOBUFS')
    const gitFn = src.slice(src.indexOf('function git('), src.indexOf('function git(') + 400)
    if (!/runGit\(args\)/.test(gitFn)) throw new Error('git() 不再走 runGit,maxBuffer 会从派生路径上脱落')
    if (!(GIT_MAX_BUFFER_BYTES >= 16 * 1024 * 1024))
      throw new Error(`maxBuffer 余量太小(${GIT_MAX_BUFFER_BYTES})`)
  })

  t('清单摘除开关:默认关 ⇒ lost-commit 期望项仍 holdover,一条不摘', () => {
    const map = {
      'refs/tags/lost-commit/auto-abc': shaAlive,
      'refs/tags/backup/snap': shaAlive,
      'refs/remotes/origin/gone/x': shaAlive,
    }
    const r = pruneAbsentExpectations(map, new Set(['refs/heads/main', 'refs/tags/unrelated']), {
      dropLostCommitTagExpectations: false,
      dryRun: true,
    })
    if (r.lostTagRemoved !== 0) throw new Error(`默认关仍摘了 lost-commit 期望项:${r.lostTagRemoved}`)
    if (r.removed.some((x) => x.startsWith('refs/tags/lost-commit/')))
      throw new Error('默认关把 lost-commit 期望项摘了(既有行为被破坏)')
    if (r.tagHoldovers !== 2) throw new Error(`tag holdover 数不对:${r.tagHoldovers}(应为 lost+backup=2)`)
    if (!r.removed.includes('refs/remotes/origin/gone/x')) throw new Error('远端已无的 tracking ref 应被摘')
  })

  t('清单摘除开关:开 + dry-run ⇒ 只算不写,backup/* 零摘除', () => {
    const map = {
      'refs/tags/lost-commit/auto-abc': shaAlive,
      'refs/tags/lost-commit/auto-def': shaAlive,
      'refs/tags/backup/snap': shaAlive,
    }
    const before = JSON.stringify(map)
    const r = pruneAbsentExpectations(map, new Set(['refs/heads/main', 'refs/tags/unrelated']), {
      dropLostCommitTagExpectations: true,
      dryRun: true,
    })
    if (r.declined) throw new Error('远端面完整时不应判 declined')
    if (r.lostTagRemoved !== 2) throw new Error(`应报 2 条 lost-commit,实际 ${r.lostTagRemoved}`)
    if (r.removed.some((x) => x.startsWith('refs/tags/backup/')))
      throw new Error('backup/* 被摘除(违反 §22/§5b)')
    if (r.tagHoldovers !== 1) throw new Error(`backup 应仍 holdover,实际 ${r.tagHoldovers}`)
    if (JSON.stringify(map) !== before) throw new Error('dry-run 改了清单')
  })

  t('清单摘除开关:开 + 真跑 ⇒ 删 lost-commit,backup/* 与其它 tag 保留', () => {
    const map = {
      'refs/tags/lost-commit/auto-abc': shaAlive,
      'refs/tags/backup/snap': shaAlive,
      'refs/tags/keep/release': shaAlive,
      'refs/remotes/origin/gone/x': shaAlive,
    }
    const r = pruneAbsentExpectations(map, new Set(['refs/heads/main', 'refs/tags/unrelated']), {
      dropLostCommitTagExpectations: true,
    })
    if (r.lostTagRemoved !== 1) throw new Error(`应摘 1 条,实际 ${r.lostTagRemoved}`)
    if (map['refs/tags/lost-commit/auto-abc']) throw new Error('lost-commit 期望项没删')
    if (!map['refs/tags/backup/snap']) throw new Error('backup/* 被误删')
    if (!map['refs/tags/keep/release']) throw new Error('其它 tag 期望项被误删')
    if (map['refs/remotes/origin/gone/x']) throw new Error('远端已无的 tracking ref 没摘')
  })

  let fail = 0
  for (const [name, fn] of cases) {
    try {
      fn()
      console.log(`✅ ${name}`)
    } catch (e) {
      fail++
      console.log(`❌ ${name} — ${String(e.message).slice(0, 120)}`)
    }
  }
  console.log(`\n[refs-heal] self-test: ${cases.length - fail}/${cases.length} 通过`)
  return fail === 0 ? 0 : 1
}

function main() {
  const args = process.argv.slice(2)
  if (args.includes('--self-test')) process.exit(selfTest())
  if (args.includes('--status')) {
    const s = status()
    console.log(JSON.stringify(s, null, 1))
    process.exit(s.state === 'unjudged' ? 2 : s.missing.length === 0 ? 0 : 1)
  }

  // 只读干跑:这次**不写** refs-manifest.json、不重建 ref,只报「若执行会摘掉多少」。
  // 远端面取不到 ⇒ exit 2(未判定),不许把"没返回"当"远端没有"。
  if (args.includes('--prune-dry-run')) {
    const out = git(['ls-remote', '--tags', '--heads', 'origin'], true)
    if (!out) {
      console.error('❌ 干跑:读不到远端 ref(网络/代理不可达)⇒ 未判定,不做任何推断')
      process.exit(2)
    }
    const names = new Set()
    for (const line of out.split('\n')) {
      const ref = (line.split('\t')[1] || '').trim()
      if (!ref || ref.endsWith('^{}')) continue
      names.add(ref)
    }
    const taken = takeManifestForMutation(REFS_MANIFEST)
    if (!taken.ok) {
      console.error(`❌ 干跑: refs-manifest.json ${taken.state} ⇒ 未判定,不把坏清单当成空期望`)
      process.exit(2)
    }
    const map = taken.map
    const drop = dropLostTagExpectations()
    const res = pruneAbsentExpectations(map, names, {
      dropLostCommitTagExpectations: drop,
      dryRun: true,
    })
    const keys = Object.keys(map)
    const lostTagExpectations = keys.filter((r) => r.startsWith('refs/tags/lost-commit/')).length
    const backupExpectations = keys.filter((r) => r.startsWith('refs/tags/backup/')).length
    const backupRemoved = res.removed.filter((r) => r.startsWith('refs/tags/backup/')).length
    console.log(
      JSON.stringify(
        {
          dropLostCommitTagExpectations: drop,
          declined: res.declined,
          lostTagExpectations,
          wouldRemoveLostTags: res.lostTagRemoved,
          backupExpectations,
          backupRemoved,
          otherRemoved: res.removed.length - res.lostTagRemoved,
          tagHoldovers: res.tagHoldovers,
          kept: res.kept,
        },
        null,
        1,
      ),
    )
    process.exit(res.declined ? 2 : 0)
  }

  if (args.includes('--refresh-remote')) {
    const refreshed = refreshFromRemote()
    if (refreshed === 'unjudged') process.exit(2)
    if (!refreshed) process.exit(1)
  }

  // 1) 以"当前可见 ref"为准更新清单(自维护:新出现的嵌套 ref 自动纳入)
  const cur = currentRefs()
  if (cur === null) {
    console.error(
      '❌ 当前 ref 面问不到(for-each-ref 未产出)⇒ 本轮既不纳管也不摘除:把"读不到"当"没有"会抹掉全部期望项(§0.3)',
    )
    process.exit(2)
  }
  const taken = takeManifestForMutation(REFS_MANIFEST)
  if (!taken.ok) {
    console.error(
      `❌ refs-manifest.json ${taken.state}${taken.reason ? ' (' + taken.reason + ')' : ''} ⇒ 拒绝按空期望覆盖(坏 JSON 不是「没有期望」)`,
    )
    process.exit(2)
  }
  const map = taken.map
  let learned = 0
  for (const [ref, sha] of Object.entries(cur)) {
    if (!isNestedRef(ref)) continue
    if (map[ref] !== sha) {
      map[ref] = sha
      learned++
    }
  }
  // 1b) FETCH_HEAD 只作**离线兜底**:git fetch 把新值写成松散 refs/remotes/origin/main(嵌套目录),
  // 该文件实测 1 秒内即被宿主清理,若 packed 留着上轮旧值,git 会回落到旧值 → 同 sha 却显示
  // `[ahead 1]`,此时 FETCH_HEAD(gitdir 顶层文件,清理不到)是唯一可用真值。
  // 但本轮已用 `ls-remote` 校准过时**不得**再覆盖:多会话共享 gitdir 时 FETCH_HEAD 会被任何
  // 一次别人的 fetch 重写,拿它压过 ls-remote 就等于用低权威源改掉高权威值(AGENTS.md §12d:
  // ls-remote 才是远端真值唯一来源)。2026-09-23 实测:校准出真值 5e5ac1a 后又被过期
  // FETCH_HEAD 改回 30556de,导致守护每 2 分钟喊「自愈失败,需人工介入」。
  const fh = remoteCalibrated ? null : fetchHeadMain()
  if (fh && map['refs/remotes/origin/main'] && map['refs/remotes/origin/main'] !== fh) {
    console.log(
      `[fetch-head] origin/main 以 FETCH_HEAD 为准: ${map['refs/remotes/origin/main'].slice(0, 12)} -> ${fh.slice(0, 12)}`,
    )
    map['refs/remotes/origin/main'] = fh
  }
  // 1c) origin/HEAD 永远是 origin/main 的镜像。上面那个"学习"循环会把某一瞬间的本地解析值
  // 钉进清单,而嵌套松散 ref 会被宿主秒清、packed 值又滞后,于是 origin/HEAD 常被钉成
  // 一个它永远解析不到的 sha(2026-09-23 实测:清单里是本地 commit sha,packed 里是另一个值)
  // → 每次巡检都判"1 个 ref 值不符",.git 守护恒报异常、--check 恒 exit 1。这里统一对齐到权威值。
  const authoritativeMain = fh || map['refs/remotes/origin/main']
  if (authoritativeMain && map['refs/remotes/origin/HEAD'] !== authoritativeMain) {
    console.log(
      `[mirror] origin/HEAD 对齐到 origin/main 权威值: ${String(map['refs/remotes/origin/HEAD']).slice(0, 12)} -> ${authoritativeMain.slice(0, 12)}`,
    )
    map['refs/remotes/origin/HEAD'] = authoritativeMain
  }
  if (learned) console.log(`[learning] 纳入 ${learned} 个新出现的嵌套 ref`)
  // 1d) 摘除「远端已不存在」的 origin 期望项 —— 顺序与"连 ref 一起删"都是本步的存在理由:
  //     · 放在 learning **之后**:learning 按盘面 ref 纳管,先摘会在同一轮被它写回(实测);
  //     · 清单与盘面 ref **必须同轮都动**:只摘清单则 packed-refs 里那枚还在 ⇒ `git branch -a`
  //       看得见 ⇒ 门 41 照红,且下一轮 learning 必然再纳入,形成"摘了又学、学了又造"的死循环;
  //       只删 ref 不清清单,则 healRefs() 会按清单把它造回来(2026-10-04 三轮 tick 全红的原状)。
  //     · 只在**本轮真拿到远端全集**时做;取不到就整步跳过(把"没返回"当"远端没有"会误删期望项)。
  if (remoteCalibrated && lastRemoteRefs) {
    const pruned = pruneAbsentExpectations(map, lastRemoteRefs, {
      dropLostCommitTagExpectations: dropLostTagExpectations(),
    })
    if (pruned.declined) {
      console.log(
        '[prune-gone] ⚠️ 远端面不完整(没同时看到 refs/heads/* 与 refs/tags/*)⇒ 本轮不摘任何期望项',
      )
    } else if (pruned.removed.length) {
      console.log(`[prune-gone] 摘除 ${pruned.removed.length} 个远端已不存在的 tracking ref 期望项:`)
      for (const r of pruned.removed) console.log(`   - ${r}`)
      // §9b:"fetch + prune 是日常"。prune 只删本地 remote-tracking ref,远端与任何 commit/tag 都不动。
      const pr = git(['remote', 'prune', 'origin'], true)
      if (pr === null) {
        console.log('[prune-gone] ⚠️ `git remote prune origin` 失败 ⇒ 期望项已摘但盘面 ref 仍在,下轮可能复红(如实报,不静默)')
      } else {
        for (const l of pr.split('\n')) if (l.trim().startsWith('* [pruned]')) console.log(`   ${l.trim()}`)
      }
    }
    if (pruned.lostTagRemoved) {
      console.log(
        `[prune-gone] 按 ${DROP_LOST_TAG_EXPECTATIONS_ENV}=1 整族摘除 ${pruned.lostTagRemoved} 个 lost-commit/* 期望项(backup/* 与其它 tag 不受影响)`,
      )
    }
    if (pruned.tagHoldovers) {
      console.log(
        `[prune-gone] 另有 ${pruned.tagHoldovers} 个 tag 期望项远端已无 —— **刻意不摘**(§22 备份 tag 禁删、§5b 要求双留;清单是它们被清后唯一的离线重建依据),只报名`,
      )
    }
  }
  saveManifest(map)
  // 清单一旦被学习/校准改写,必须**先**把松散 ref 固化进 packed-refs 再判定。
  // 否则时序是:manifest 更新到新 tip → fetch 写的松散 ref 在 1 秒内被宿主清理 →
  // for-each-ref / rev-parse 回落到 packed 的旧值 → status 永远判"缺失",守护每 2 分钟
  // 喊「自愈失败,需人工介入」(2026-09-23 实测,--refresh-remote 后立刻复现)。
  packRefs()

  // 2) 清单里与当前解析值不符的(缺失 or 旧值残留)→ 按清单重建
  //    移动型 refs/remotes/<remote>/HEAD 不比 sha(见 lib/gitdir.mjs refExpectationSatisfied),
  //    否则每轮都会拿旧值去"重建"它 —— 既恒红,又可能把默认分支指回旧 commit。
  const broken = Object.entries(map).filter(([ref, sha]) => {
    if (!refResolvable(ref)) return true
    const resolved = git(['rev-parse', ref], true)
    return !refExpectationSatisfied(ref, sha, resolved)
  })
  if (broken.length === 0) {
    console.log(`[refs-heal] ✅ 清单内 ${Object.keys(map).length} 个嵌套 ref 全部与清单一致`)
    process.exit(0)
  }

  console.log(`[refs-heal] 🔧 ${broken.length} 个嵌套 ref 缺失,按清单重建:`)
  // 2b) 写之前先验对象存在性:清单值可能已随 objects/ 被抹 ⇒ 重建出来就是坏指针(见 splitDeadRefs)
  //     null(命令失败/未判定)进 held,不进 dead:一次 EBUSY 不得删掉 backup/* 与 lost-commit/*。
  const { dead, rebuildable, held } = splitDeadRefs(broken, objectExists)
  const drop = applyDeadExpectationDrops(map, { dead, held })
  if (held.length) {
    console.log(
      `  ⚠️ ${held.length} 个 ref 的对象存在性未判定(命令失败,不是对象不存在),期望项保留、本轮不剔除`,
    )
    for (const [ref] of held.slice(0, 5)) console.log(`    - ${ref}`)
    if (held.length > 5) console.log(`    …另有 ${held.length - 5} 个`)
  }
  if (drop.dropped.length) {
    if (!saveManifest(map)) {
      console.error('❌ 确认不存在的期望项未能写回清单,本轮不把内存剔除当成已落盘')
      process.exit(2)
    }
    console.log(
      `  ⛔ 跳过 ${drop.dropped.length} 个"清单值指向已不存在对象"的 ref(已从清单剔除,留着每轮都会白重建):`,
    )
    for (const [ref, sha] of dead.slice(0, 5)) console.log(`    - ${ref} = ${sha.slice(0, 12)}`)
    if (dead.length > 5) console.log(`    …另有 ${dead.length - 5} 个`)
    console.log('    恢复途径:联网跑一次 --refresh-remote 从 origin 重新校准这些 ref 的值。')
  }
  if (rebuildable.length === 0) {
    if (held.length) {
      console.error('[refs-heal] ❌ 存在性未判定,未删期望项;不把命令失败当成对象不存在')
      process.exit(2)
    }
    console.log('[refs-heal] ✅ 清单内可重建的 ref 全部一致(死引用已剔除,不再反复重建)')
    process.exit(0)
  }
  for (const [ref, sha] of rebuildable) {
    writeLooseRef(ref, sha)
    console.log(`  - ${ref} = ${sha.slice(0, 12)}`)
  }
  packRefs()

  // 3) 回读校验(不信任写入动作): 既要可解析,也要与清单值一致。
  //    未判定项不在本轮重建范围内,不得把它算成重建失败,也不得因此删期望。
  const heldSet = new Set(held.map(([ref]) => ref))
  const still = Object.entries(map)
    .filter(([ref, sha]) => {
      if (heldSet.has(ref)) return false
      const resolved = git(['rev-parse', ref], true)
      return !refExpectationSatisfied(ref, sha, resolved)
    })
    .map(([ref]) => ref)
  if (still.length) {
    console.error(`❌ 重建后仍有 ${still.length} 个 ref 不可解析或值不符: ${still.join(', ')}`)
    process.exit(1)
  }
  if (held.length) {
    console.error(`[refs-heal] ❌ 另有 ${held.length} 个 ref 存在性未判定,其期望项已保留`)
    process.exit(2)
  }
  console.log(
    `[refs-heal] ✅ 已重建 ${rebuildable.length} 个 ref 并固化进 packed-refs(无需联网;死引用 ${dead.length} 个已剔除并计数)`,
  )
  process.exit(0)
}

// §22d:CLI 直跑才执行修复;被 import(测试/其他脚本)时绝不触发任何写动作
const isDirectRun = process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href
if (isDirectRun) main()

export const __test__ = {
  splitDeadRefs,
  isNestedRef,
  objectExists,
  classifyObjectProbe,
  applyDeadExpectationDrops,
  readManifest,
  saveManifest,
  parseManifestText,
  readManifestAt,
  saveManifestAt,
  takeManifestForMutation,
  manifestMapForCaller,
  parseRefsTable,
  GIT_MAX_BUFFER_BYTES,
}
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
