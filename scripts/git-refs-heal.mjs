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
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
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

function git(args, allowFail = false) {
  const bin = resolveGitBin()
  if (!bin) {
    if (allowFail) return null
    throw new Error('git 不可用:候选可执行文件均不可调用')
  }
  try {
    return execFileSync(bin, ['-c', 'safe.directory=*', '-C', WORKTREE, ...args], {
      encoding: 'utf8',
      // 2026-10-04:不吃的子进程必须给 stdio,否则本机报 spawnSync EBUSY
      // 返回值被消费(.trim() 后 return)⇒ stdout 仍须 pipe,只把 stdin 切掉
      stdio: ['ignore', 'pipe', 'pipe'],
      windowsHide: true, // GUI 宿主下派生 git 不显控制台窗口(AGENTS.md §5b)
      timeout: 180000,
    }).trim()
  } catch (e) {
    if (allowFail) return null
    throw e
  }
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

function readManifest() {
  try {
    const m = JSON.parse(readFileSync(REFS_MANIFEST, 'utf8'))
    return m && typeof m === 'object' ? m : {}
  } catch {
    return {}
  }
}

function saveManifest(map) {
  try {
    writeFileSync(REFS_MANIFEST, JSON.stringify(map, null, 1) + '\n', 'utf8')
    return true
  } catch (e) {
    console.error('清单写入失败:', String(e.message || e))
    return false
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

/** 单 ref 是否可解析(宽松:packed 或松散均可) */
function refResolvable(ref) {
  const sha = git(['rev-parse', '--verify', '--quiet', ref], true)
  return !!sha
}

/**
 * sha 指向的对象是否真的还读得出来。
 * ⚠️ 谓词写法:`cat-file -e` 成功时**输出是空串**,而 git(..., allowFail=true) 只在失败时返回 null。
 *    用 `!!git(...)` 判断会把"对象存在"读成"不存在"⇒ 每条好 ref 都被当成死的删掉。
 */
/**
 * 对象是否可解析。`export` 是给 `git-guardian.mjs` 复用的 —— 守护每 2 分钟跑的 `healRefs()`
 * 与本文件的离线重建必须共用同一份判定(此前它只挂在 `__test__` 上,守护 import 直接
 * `SyntaxError: does not provide an export named`,是运行时抓到而不是靠人眼)。
 */
export function objectExists(sha) {
  return /^[0-9a-f]{7,40}$/.test(String(sha || '')) && git(['cat-file', '-e', sha], true) !== null
}

/**
 * 按"对象是否可读"把待重建项分流。纯函数,exists 由调用方注入(自检用假谓词)。
 * 为什么必须有这一步(2026-09-24 实测):清单 `refs-manifest.json` 里记的 sha 会随宿主清理层抹掉
 * `objects/xx/` 而变成**死引用**(本机当日 fsck 报坏链 83,108 条 / 缺失目标 35,319 个)。
 * 按死值重建 = 亲手写出一枚指向不存在对象的 ref,而**坏指针会让每一次 `git fetch` 直接 fatal**
 * (⇒ 推送链全死;git-push-guard 2.9b 已在推送侧拦这个)。死的只能剔除 + 如实计数,等联网校准。
 */
export function splitDeadRefs(broken, exists) {
  const dead = []
  const rebuildable = []
  for (const [ref, sha] of broken) (exists(sha) ? rebuildable : dead).push([ref, sha])
  return { dead, rebuildable }
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
    // 镜像远端(gitee/gitcode)的 tracking ref 也长这样,故两种形态都算命中
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
 * @returns {{removed:string[], kept:number, skippedNonOrigin:number, declined:boolean}}
 */
function pruneAbsentExpectations(map, remoteRefNames) {
  const all = Object.keys(map)
  if (!remoteFaceIsComplete(remoteRefNames)) {
    return {
      removed: [],
      kept: all.length,
      skippedNonOrigin: 0,
      tagHoldovers: 0,
      declined: true,
    }
  }
  const removed = []
  let skippedNonOrigin = 0
  let tagHoldovers = 0
  for (const ref of all) {
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
  for (const ref of removed) delete map[ref]
  return {
    removed,
    kept: Object.keys(map).length,
    skippedNonOrigin,
    tagHoldovers,
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
  const map = readManifest()
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
  const pruned = pruneAbsentExpectations(map, remoteRefNames)
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
  const map = readManifest()
  const entries = Object.entries(map)
  const missing = entries
    .filter(([ref, sha]) => !refExpectationSatisfied(ref, sha, cur[ref]))
    .map(([ref]) => ref)
  return {
    gitdir: GITDIR,
    manifestCount: entries.length,
    currentCount: Object.keys(cur).length,
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
    if (!objectExists(head))
      throw new Error(`活对象 ${head.slice(0, 8)} 被判成不存在 ⇒ 每轮都会删清单`)
    if (objectExists('deadbeefdeadbeefdeadbeefdeadbeefdeadbeef'))
      throw new Error('不存在的 sha 被判成存在')
    if (objectExists('') || objectExists(null) || objectExists('not-a-sha'))
      throw new Error('空值/非法值应判不存在,不得去问 git')
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
    process.exit(s.missing.length === 0 ? 0 : 1)
  }

  if (args.includes('--refresh-remote') && !refreshFromRemote()) process.exit(1)

  // 1) 以"当前可见 ref"为准更新清单(自维护:新出现的嵌套 ref 自动纳入)
  const cur = currentRefs()
  const map = readManifest()
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
    const pruned = pruneAbsentExpectations(map, lastRemoteRefs)
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
  const { dead, rebuildable } = splitDeadRefs(broken, objectExists)
  if (dead.length) {
    for (const [ref] of dead) delete map[ref]
    saveManifest(map)
    console.log(
      `  ⛔ 跳过 ${dead.length} 个"清单值指向已不存在对象"的 ref(已从清单剔除,留着每轮都会白重建):`,
    )
    for (const [ref, sha] of dead.slice(0, 5)) console.log(`    - ${ref} = ${sha.slice(0, 12)}`)
    if (dead.length > 5) console.log(`    …另有 ${dead.length - 5} 个`)
    console.log('    恢复途径:联网跑一次 --refresh-remote 从 origin 重新校准这些 ref 的值。')
  }
  if (rebuildable.length === 0) {
    console.log('[refs-heal] ✅ 清单内可重建的 ref 全部一致(死引用已剔除,不再反复重建)')
    process.exit(0)
  }
  for (const [ref, sha] of rebuildable) {
    writeLooseRef(ref, sha)
    console.log(`  - ${ref} = ${sha.slice(0, 12)}`)
  }
  packRefs()

  // 3) 回读校验(不信任写入动作): 既要可解析,也要与清单值一致
  const still = Object.entries(map)
    .filter(([ref, sha]) => {
      const resolved = git(['rev-parse', ref], true)
      return !refExpectationSatisfied(ref, sha, resolved)
    })
    .map(([ref]) => ref)
  if (still.length) {
    console.error(`❌ 重建后仍有 ${still.length} 个 ref 不可解析或值不符: ${still.join(', ')}`)
    process.exit(1)
  }
  console.log(
    `[refs-heal] ✅ 已重建 ${rebuildable.length} 个 ref 并固化进 packed-refs(无需联网;死引用 ${dead.length} 个已剔除并计数)`,
  )
  process.exit(0)
}

// §22d:CLI 直跑才执行修复;被 import(测试/其他脚本)时绝不触发任何写动作
const isDirectRun = process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href
if (isDirectRun) main()

export const __test__ = { splitDeadRefs, isNestedRef, objectExists }
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
