#!/usr/bin/env node
// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * 旧底稿整份回退哨兵（2026-11-11 立，事故编号见 PROJECT_PLAN 与提交 52991b5365 的复盘）。
 *
 * 立因（实测，不是推演）：worktree-preserving 收敛只推进 ref、不 checkout 工作树，各席工作树
 * 与共享索引常年落后 HEAD。某席用共享索引快照提交时，**整份文件**会退回它自己更早的版本，
 * 而 git 视角只是"少了几行"，行数门与 diff 门都不响。2026-11-11 16:03 的 52991b5365 就是这样
 * 把 173 个文件整份退回旧版：PROJECT_PLAN 丢 97 条未办票 + RP-51 租约行、biz-day.ts 丢 RP-23
 * 的 at 基准重载、两份跨端台账退回上一代（门 301 因此把五屏判成"映射缺失"）。
 *
 * 判据（精确指纹，零误报方向）：
 *   对一枚提交 C 的每个改动路径（排除新增 A 与删除 D），取 C 在该路径上的 blob，
 *   回查该路径自身在 C 的祖先里的历史版本；**命中任一祖先版本 ⇒ 整份就是旧版、零新内容**。
 *   正常编辑产出的新内容结构上不可能等于任何祖先版本，所以这条不会误伤正常提交。
 *   命中件数 ≥ 阈值即判红，逐条点名命中的祖先提交。
 *
 * 为什么单独成门而不复用门 84 反回退守门：门 84 的 R1 判**索引面**，只在 pre-commit 跑，
 * 而 `git commit --no-verify` 与共享索引直提都会绕过它 —— 本次事故正是绕过形态。本器判
 * **提交面 / 推送区间面**，挂两处：
 *   ① post-commit（`--no-verify` 跳不过 post-commit）—— 每次落提交即报警；
 *   ② 守门批量检查的 push-range blocking 门（--range origin/main..HEAD）—— 真正拦下带
 *      旧底稿回退的推送，让同类事故不能再次静默发生。
 *   两者面不同、不互为备份：post-commit 只判刚落的那一枚，批量门扫整个待推送区间。
 *
 * 用法：
 *   node scripts/check-stale-baseline-sentinel.mjs                       # 判 HEAD
 *   node scripts/check-stale-baseline-sentinel.mjs --commit <sha>        # 判指定提交
 *   node scripts/check-stale-baseline-sentinel.mjs --range A..B          # 判区间每枚并聚合
 *   node scripts/check-stale-baseline-sentinel.mjs --json                # 机器可读
 *   node scripts/check-stale-baseline-sentinel.mjs --self-test           # 临时仓端到端演练
 * 退出码：0 通过 / 1 检出整份回退 / 2 用法错或取材失败（未判定，不折绿）
 *
 * 豁免：提交信息含 `intentional-revert:` 或本次提交是 revert/cherry-pick 上下文（.git/REVERT_HEAD
 * 存在）时整轮放行 —— 那两种语义本来就是"取历史内容"。区间模式下逐提交独立判豁免。
 */
import { existsSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { pathToFileURL } from 'node:url'

import { gitRaw } from './lib/face-reader.mjs'

const THRESHOLD = 3
const HISTORY_DEPTH = 200
// 推送门硬拦阈值(2026-11-11 立):本器与门 84(R1)同判据——内容≠HEAD 且逐字节等于某祖先版本,
// 结构上无法区分"善意还原"与"事故性旧底稿回退"(两者都是 blob 等于祖先),故合法还原须走
// `intentional-revert:` 声明(门 84 同款契约)。为防止推送门因少量合法还原(1–9 个文件)误伤、
// 把整条推送链炸红,推送门只在命中数达到本阈值(典型整批旧底稿事故签名,如 52991b5365 的 173 件)
// 才硬拦;少量命中只报警不拦。post-commit 报警器与手动检视仍用 THRESHOLD=3 的灵敏档。
const PUSH_BLOCK_THRESHOLD = 10

/**
 * git 派生统一走共享层 face-reader 的 `gitRaw`(绝对路径 git + safe.directory + quotepath +
 * windowsHide + 有界 timeout + 显式 stdio 接管),不再自拼裸 `execFileSync('git', …)`:
 * 裸派生缺 windowsHide/超时护栏,且每处各写一份 stdio/maxBuffer 必然漂移(单一真相源)。
 * `maxBuffer: 1 << 28` 原样传入,与旧裸派生逐字同量级 —— 本器整份读 ls-tree 与 log --raw,
 * 缓冲不许缩水;失败语义不变:gitRaw 仍抛错(内含 git 原话与退出码),各调用点 try/catch
 * 与「取材失败 ⇒ 未判定不折绿」的出口码照旧。
 */
function git(repo, args, opts = {}) {
  return gitRaw(args, repo, { maxBuffer: 1 << 28, ...opts })
}

// ─── 2026-11-20 提速:两处 O(全树 × 每文件) 的派生收成 O(1 次 git) ────────────
// 原实现:① `ls-tree -r` 取「本提交树 + 父提交树」两张 2.3 万条目的全表,只为算出"哪些路径变了";
// ② 对**每一个**变动路径再派生一次 `git log --raw -n 200 -- <path>`(几百个文件 = 几百次进程,
// 且每次都要读 200 枚提交的 raw 输出)。实测 3 枚提交的推送区间 25.5s,墙钟上盖过了 T1 与 302p。
// 改法:①`diff-tree --raw` 只回"变了的路径 + 新 blob"(本来就知道要什么,不用建两张全表);
// ②把 200 枚提交的 raw 历史**一次读完**,在 JS 里按 path 建索引。
// 判据语义逐字不变:`changed` 仍是"父提交里也有、且 blob 不同"的路径(⇒ 只收 M/T,
// 新增 A 与删除 D 两侧照旧不计);命中仍是"本提交该路径的 blob 出现在该路径最近 200 枚提交的
// raw 里";举证仍取该路径最近一枚提交。差别只有一处:原实现按**整篇** log 文本做子串匹配,
// 会把"别的文件在同一批提交里出现过相同 blob"也算命中(同一内容跨文件的偶合),现在按 path 索引
// 收窄回本意 —— 这只会让偶合不再误报,不会漏掉任何真命中(真命中必然在同 path 的 raw 里)。
/** 变更面(path → 本提交新 blob):只取 M/T,与"父提交里也有且 blob 不同"同义。 */
function changedBlobs(repo, commit) {
  const raw = git(repo, ['diff-tree', '-r', '--no-renames', '--no-commit-id', '--raw', '--no-abbrev', commit])
  const map = new Map()
  for (const line of raw.split('\n')) {
    const m = line.match(/^:\d{6}\s\d{6}\s([0-9a-f]+)\s([0-9a-f]+)\s([A-Z])\t(.+)$/)
    if (!m) continue
    const [, , next, status, path] = m
    if (status !== 'M' && status !== 'T') continue
    map.set(path, next)
  }
  return map
}

/** 一次读完最近 HISTORY_DEPTH 枚提交里**本次变动路径**的 raw:path → 该路径历史 blobs,以及最近触达该路径的提交。
 *  pathspec 限定到本次变动面:原实现是"每个路径各派生一次 log",这里换成"一次 log + 全量 pathspec",
 *  派生次数与文件数无关(O(1) 进程),且只读本次真正关心的路径,不陪着全树扫 200 枚提交。 */
function historyIndex(repo, base, paths) {
  const raw = git(repo, [
    'log',
    '--format=@%H',
    '--raw',
    '--no-abbrev',
    '-n',
    // 原实现是"每个路径各取自己最近 200 枚提交";这里是"所有变动路径合取一窗"。
    // 合窗后某条路径实际能覆盖到的提交数会少于它自己的 200 枚(它被别的路径挤掉),
    // 取 10 倍窗口把这条差异补成"只多不少":命中只会更多(更深的祖先也看),不会更少。
    String(HISTORY_DEPTH * 10),
    ...(base ? [base] : []),
    '--',
    ...paths,
  ])
  const byPath = new Map()
  const firstTouch = new Map()
  let cur = ''
  for (const line of raw.split('\n')) {
    if (line.startsWith('@')) {
      cur = line.slice(1, 41)
      continue
    }
    const m = line.match(/^:\d{6}\s\d{6}\s([0-9a-f]+)\s([0-9a-f]+)\s([A-Z])\t(.+)$/)
    if (!m) continue
    const [, oldOid, newOid, , path] = m
    if (!byPath.has(path)) byPath.set(path, new Set())
    const set = byPath.get(path)
    if (!/^0{40}$/.test(oldOid)) set.add(oldOid)
    if (!/^0{40}$/.test(newOid)) set.add(newOid)
    if (!firstTouch.has(path)) firstTouch.set(path, cur)
  }
  return { byPath, firstTouch }
}

/** 判定一枚提交：返回 { commit, subject, suspects:[{path, blob, ancestor}], checked, root } */
export function inspect(repo, commit) {
  const parents = git(repo, ['rev-list', '--parents', '-n', '1', commit]).trim().split(/\s+/).slice(1)
  if (!parents.length) return { commit, subject: '', suspects: [], checked: 0, root: true }

  const changed = changedBlobs(repo, commit)
  const hist = historyIndex(repo, parents[0], [...changed.keys()])

  const suspects = []
  for (const [p, blob] of changed) {
    const set = hist.byPath.get(p)
    if (!set || !set.has(blob)) continue
    // 命中的祖先：该路径最近一枚触达提交（与原实现取"逐 path log 的第一行"同义）
    const ancestor = hist.firstTouch.get(p) || '(祖先)'
    suspects.push({ path: p, blob: blob.slice(0, 8), ancestor: ancestor.slice(0, 10) })
  }

  const subject = git(repo, ['log', '-1', '--format=%s', commit]).trim()
  return { commit, subject, suspects, checked: changed.size, root: false }
}

/** 逐提交判一个区间（A..B，B 独占 A 一侧），聚合所有嫌疑。返回 { range, commits:[...], suspects:[...] } */
export function inspectRange(repo, rangeStr) {
  const m = String(rangeStr).match(/^(.+)\.\.(.+)$/)
  if (!m) throw new Error(`区间形制须为 A..B，收到: ${rangeStr}`)
  const [, a, b] = m
  const shas = git(repo, ['rev-list', `${a}..${b}`]).trim().split(/\n+/).filter(Boolean)
  const commits = []
  const suspects = []
  for (const sha of shas) {
    const body = git(repo, ['log', '-1', '--format=%B', sha])
    if (/intentional-revert:/.test(body)) {
      commits.push({ commit: sha, skipped: 'intentional-revert' })
      continue
    }
    const r = inspect(repo, sha)
    commits.push(r)
    for (const s of r.suspects) suspects.push({ ...s, commit: sha.slice(0, 10) })
  }
  return { range: rangeStr, commits, suspects }
}

function selfTest() {
  const dir = mkdtempSync(join(tmpdir(), 'stale-sentinel-'))
  const run = (args) => git(dir, args)
  try {
    run(['init', '-q'])
    run(['config', 'user.email', 't@t.t'])
    run(['config', 'user.name', 't'])
    // 正例：三件文件被整份退回旧版
    for (const n of ['a.txt', 'b.txt', 'c.txt']) writeFileSync(join(dir, n), 'v1\n')
    run(['add', '-A'])
    run(['commit', '-qm', 'base'])
    for (const n of ['a.txt', 'b.txt', 'c.txt']) writeFileSync(join(dir, n), 'v2\n')
    run(['add', '-A'])
    run(['commit', '-qm', 'improve'])
    for (const n of ['a.txt', 'b.txt', 'c.txt']) writeFileSync(join(dir, n), 'v1\n')
    run(['add', '-A'])
    run(['commit', '-qm', 'stale revert'])

    const bad = inspect(dir, 'HEAD')
    const okPositive = bad.suspects.length === 3

    // 反例：正常编辑不得命中
    writeFileSync(join(dir, 'a.txt'), 'v3-brand-new\n')
    writeFileSync(join(dir, 'b.txt'), 'v3-brand-new\n')
    writeFileSync(join(dir, 'c.txt'), 'v3-brand-new\n')
    run(['add', '-A'])
    run(['commit', '-qm', 'normal edit'])
    const good = inspect(dir, 'HEAD')
    const okNegative = good.suspects.length === 0

    console.log(`正例（三件整份退回旧版）检出 ${bad.suspects.length} 件 ⇒ ${okPositive ? '通过' : '失败'}`)
    console.log(`反例（三件全新内容）检出 ${good.suspects.length} 件 ⇒ ${okNegative ? '通过' : '失败'}`)

    // 区间正例：再退回一次，区间扫描须把两枚回退提交都抓到
    for (const n of ['a.txt', 'b.txt', 'c.txt']) writeFileSync(join(dir, n), 'v1\n')
    run(['add', '-A'])
    run(['commit', '-qm', 'second stale revert'])
    const rng = inspectRange(dir, 'HEAD~2..HEAD')
    const okRange = rng.suspects.length >= 3
    console.log(`区间（连续两枚回退，扫 HEAD~2..HEAD）检出 ${rng.suspects.length} 件 ⇒ ${okRange ? '通过' : '失败'}`)

    return okPositive && okNegative && okRange ? 0 : 1
  } finally {
    rmSync(dir, { recursive: true, force: true })
  }
}

function main() {
  const argv = process.argv.slice(2)
  const repo = process.cwd()
  if (argv.includes('--self-test')) return selfTest()

  const asJson = argv.includes('--json')
  const at = argv.indexOf('--commit')
  const rt = argv.indexOf('--range')
  const isPushGate = argv.includes('--push-gate')
  const isAlarm = argv.includes('--alarm')

  // —— 区间模式（守门批量检查 push-range 门用）——
  if (rt >= 0 && argv[rt + 1]) {
    const rangeStr = argv[rt + 1]
    let r
    try {
      r = inspectRange(repo, rangeStr)
    } catch (e) {
      console.error(`❌ [stale-sentinel] 区间取值失败：${String(e.message).split('\n')[0]} ⇒ 未判定`)
      return 2
    }
    const blockThreshold = isPushGate ? PUSH_BLOCK_THRESHOLD : THRESHOLD
    if (asJson) {
      console.log(JSON.stringify({ ...r, threshold: blockThreshold, pushGate: isPushGate }, null, 2))
      return r.suspects.length >= blockThreshold ? 1 : 0
    }
    if (r.suspects.length === 0) {
      console.log(`✅ [stale-sentinel] 区间 ${rangeStr} 扫 ${r.commits.length} 枚提交，无整份回退`)
      return 0
    }
    const block = r.suspects.length >= blockThreshold
    const head = block ? '❌' : '⚠️ '
    const scope = isPushGate ? `硬拦阈值 ${blockThreshold}（push-gate 档；少量命中只报警不拦，防误伤合法还原）` : `阈值 ${blockThreshold}`
    console.log(
      `${head} [stale-sentinel] 区间 ${rangeStr} 检出 ${r.suspects.length} 个路径整份退回旧版` +
        `（${scope}，扫 ${r.commits.length} 枚提交）`,
    )
    for (const s of r.suspects.slice(0, 25)) console.log(`     ${s.path}  ← 提交 ${s.commit} 的祖先 ${s.ancestor}`)
    if (r.suspects.length > 25) console.log(`     … 其余 ${r.suspects.length - 25} 个`)
    if (block) {
      console.log('  出路：① 若属旧底稿覆盖 ⇒ 按 HEAD 面回植后重建提交；② 确属有意回退 ⇒ 走 git revert，')
      console.log('        或在提交信息写 intentional-revert: <理由>。本门在推送前拦截，无需 --no-verify。')
    } else {
      console.log('  ⚠️ 命中数未达硬拦阈值,本次放行;但若属意外旧底稿回退请尽快按 HEAD 面回植(门 84 同判据)。')
    }
    return block ? 1 : 0
  }

  // —— 单提交模式（post-commit 用，默认 HEAD）——
  const commit = at >= 0 && argv[at + 1] ? argv[at + 1] : 'HEAD'

  let rev
  try {
    rev = git(repo, ['rev-parse', '--verify', `${commit}^{commit}`]).trim()
  } catch {
    console.error(`❌ [stale-sentinel] 取不到提交 ${commit} ⇒ 未判定，不折绿`)
    return 2
  }

  // 豁免：revert 上下文或显式声明
  if (existsSync(join(repo, '.git', 'REVERT_HEAD'))) {
    console.log('✅ [stale-sentinel] revert 上下文，整轮放行')
    return 0
  }
  const body = git(repo, ['log', '-1', '--format=%B', rev])
  if (/intentional-revert:/.test(body)) {
    console.log('✅ [stale-sentinel] 提交信息含 intentional-revert 声明，整轮放行')
    return 0
  }

  let r
  try {
    r = inspect(repo, rev)
  } catch (e) {
    console.error(`❌ [stale-sentinel] 取材失败：${String(e.message).split('\n')[0]} ⇒ 未判定`)
    return 2
  }

  if (asJson) {
    console.log(JSON.stringify({ ...r, threshold: THRESHOLD }, null, 2))
    return r.suspects.length >= THRESHOLD ? 1 : 0
  }

  if (r.root) {
    console.log('✅ [stale-sentinel] 根提交，无事可判')
    return 0
  }
  if (r.suspects.length === 0) {
    console.log(`✅ [stale-sentinel] ${rev.slice(0, 10)} 判定 ${r.checked} 个改动路径，无整份回退`)
    return 0
  }
  const verdict = r.suspects.length >= THRESHOLD
  const head = verdict ? '❌' : '⚠️ '
  console.log(
    `${head} [stale-sentinel] ${rev.slice(0, 10)} 有 ${r.suspects.length} 个路径整份退回旧版` +
      `（阈值 ${THRESHOLD}，判定 ${r.checked} 个改动路径）`,
  )
  for (const s of r.suspects.slice(0, 20)) console.log(`     ${s.path}  ← 祖先 ${s.ancestor}`)
  if (r.suspects.length > 20) console.log(`     … 其余 ${r.suspects.length - 20} 个`)
  console.log('  出路：① 若属旧底稿覆盖 ⇒ 按 HEAD 面回植后重建提交；② 确属有意回退 ⇒ 走 git revert，')
  console.log('        或在提交信息写 intentional-revert: <理由>。本报警器只报不拦(post-commit 不失败);推送前会硬拦。')
  // --alarm:只报警不失败,避免 git 报"post-commit hook failed"噪音;推送前的 pre-push 哨兵才硬拦。
  return isAlarm ? 0 : verdict ? 1 : 0
}

// 入口判等必须走 pathToFileURL：Windows 下 process.argv[1] 是 `D:\IHUI-AI\scripts\x.mjs`，
// 手拼 `file://` 得到 `file://D:/...`（缺第三个斜杠）或与盘符大小写不一致，import.meta.url 永远不相等
// ⇒ 整个脚本静默不执行且退出码 0（"没跑"被读成"通过"）。仓内 check-stale-revert.mjs 同型写法。
const entry = process.argv[1]
if (entry && import.meta.url === pathToFileURL(entry).href) process.exit(main())
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
