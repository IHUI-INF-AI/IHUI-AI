// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

// scripts/heal-worktree-tracked.mjs
/**
 * 工作区"已跟踪文件存续性"自愈(2026-09-23 立)。
 *
 * 成因:本机宿主清理层会**成批删除工作区里的目录**(实测同日三轮:137 个 → 27 个 → 1 个,
 * 命中 `tests/`、`__tests__/` 整目录、`installer-assets` 下 `assets-NNN` 的 bmp 资源、4 个在役守门脚本)。
 * `.git`/嵌套 ref 早有 `git-guardian` 分层自愈,但**工作区文件存续性无人管** ——
 * 缺失只体现为 `git status` 一片 ` D`,下一次提交就会把它们从版本树里删掉(等价静默回滚)。
 *
 * 判据(三条同时成立才恢复,任一不成立一律不碰):
 *   ① 工作区缺该文件(`git status` 的 ` D`);
 *   ② 索引里的 blob == HEAD 里的 blob —— 说明**没人对它做过任何暂存**(含 `git rm` 暂存删除),
 *      所以它是被外部清掉的,不是他人在制改动;
 *   ③ HEAD 中该路径确实存在。
 * 因此本脚本恢复的内容全部按定义零独有数据,不会覆盖任何人的未提交工作。
 *
 * 用法:
 *   node scripts/heal-worktree-tracked.mjs              # 检出即恢复
 *   node scripts/heal-worktree-tracked.mjs --dry-run    # 只报告不写盘
 *   node scripts/heal-worktree-tracked.mjs --self-test  # 独立临时仓端到端演练
 *   node scripts/heal-worktree-tracked.mjs --json       # 供 git-guardian 巡检读取
 *   node scripts/heal-worktree-tracked.mjs --check      # 只判不改 + 有可恢复项即 exit 1(CI/巡检口径)
 *   node scripts/heal-worktree-tracked.mjs --align-drift # 额外对齐"幻影漂移"(索引==HEAD 且内容==祖先版本)
 * 紧急跳过:IHUI_SKIP_WORKTREE_HEAL=1
 */
import { execFileSync } from 'node:child_process'
import { existsSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import { dirname, join, resolve } from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'
// 判据复用守门 84(§22d 已把 CLI 入口与导出分离,import 不会触发副作用)
import { analyze } from './check-stale-revert.mjs'

const GIT = process.env.IHUI_GIT_BIN || 'git'
export const SKIP_ENV = 'IHUI_SKIP_WORKTREE_HEAL'

function makeGit(repoRoot) {
  return (args, opts = {}) =>
    execFileSync(GIT, ['-c', 'safe.directory=*', '-c', 'core.quotepath=false', ...args], {
      cwd: repoRoot,
      encoding: 'utf8',
      windowsHide: true,
      maxBuffer: 1 << 28,
      ...opts,
    })
}

/**
 * 分批把路径列表喂给 `git ls-files --stage --`。
 * 一次性传全部路径会撞 Windows 命令行长度上限(实测 5100 个滞后路径直接
 * `spawnSync git ENAMETOOLONG`,自愈层在"工作区滞后最严重"时恰好崩掉 —— 而它正是为这种场景写的)。
 * 150 个一批:按平均 60 字符/路径 ≈ 9KB,远低于 32767 上限。
 */
export function lsStageChunked(g, paths, chunkSize = 150) {
  const lines = []
  const seen = new Set()
  for (let i = 0; i < paths.length; i += chunkSize) {
    const batch = paths.slice(i, i + chunkSize)
    if (!batch.length) continue
    for (const l of g(['ls-files', '--stage', '--', ...batch]).split('\n').filter(Boolean)) {
      if (seen.has(l)) continue
      seen.add(l)
      lines.push(l)
    }
  }
  return lines
}

/** 工作区缺失但索引与 HEAD 完全一致的已跟踪文件 = 被外部删除 */
export function findOrphanedDeletions(repoRoot) {
  const g = makeGit(repoRoot)
  const st = execFileSync(GIT, ['-c', 'safe.directory=*', '-c', 'core.quotepath=false', '-C', repoRoot, 'status', '--porcelain', '-z'], {
    encoding: 'utf8',
    windowsHide: true,
    maxBuffer: 1 << 28,
  })
  const safe = []
  const held = []
  for (const rec of st.split('\0')) {
    if (!rec) continue
    const xy = rec.slice(0, 2)
    const path = rec.slice(3).trim()
    if (xy !== ' D' || !path) continue
    let indexBlob = ''
    try {
      indexBlob = (g(['ls-files', '-s', '--', path]).split('\t')[0] || '').split(' ')[1] || ''
    } catch {
      indexBlob = ''
    }
    let headBlob = ''
    try {
      // 路径可能不在 HEAD 里(新增文件);git 的 fatal 要静默 —— 本脚本每 2 分钟被守护跑一次,
      // stderr 噪音会淹掉真正的自愈审计行
      headBlob = g(['rev-parse', `HEAD:${path}`], { stdio: ['ignore', 'pipe', 'ignore'] }).trim()
    } catch {
      headBlob = ''
    }
    if (indexBlob && indexBlob === headBlob && !existsSync(resolve(repoRoot, path))) safe.push(path)
    else if (!indexBlob) held.push(path) // 索引里也没有:他人已暂存删除,不碰
  }
  return { safe, held }
}

/** 该 blob 是否出现在此路径的历史版本里(祖先判定) */
function isAncestorBlob(g, path, blob) {
  if (!blob) return false
  try {
    const anc = g(['log', '--max-count=30', '--format=%H', 'HEAD', '--', path]).split('\n').filter(Boolean)
    for (const c of anc) {
      let v = ''
      try {
        v = g(['rev-parse', `${c}:${path}`], { stdio: ['ignore', 'pipe', 'ignore'] }).trim()
      } catch {
        v = ''
      }
      if (v === blob) return true
    }
  } catch {
    return false
  }
  return false
}

/**
 * 刷新"落后索引"(CAS / converge 用 commit-tree+update-ref 推进 HEAD 却不动主索引的后遗症)。
 * 危险在于:此时 `git status` 首列为 `M `,任何人一次不带 pathspec 的普通 commit
 * 就会把这批文件整体写回旧版 ⇒ 一次性静默回滚(实测本仓同一天出现 14 个这样的路径)。
 *
 * 判据(三条同时成立才刷新,且**逐路径 update-index**,绝不做全局 `git reset` —— 那会
 * 连带 unstage 他人真正的暂存):
 *   ① 索引 blob != HEAD blob;
 *   ② 索引 blob 确为该路径的某个**历史版本**(⇒ 不是新做的暂存);
 *   ③ 该路径上没有"现场":工作区 == 索引(无未暂存改动),**或**工作区 == HEAD
 *      (旁路提交后工作区已跟上 HEAD,刷索引只是把 index 补齐 —— 不覆盖任何东西)。
 *   ③ 的后一形态是 CAS/`commit-tree` 提交后最常见的残留(本仓 2026-09-23 实测 4 个路径),
 *   只写"工作区==索引"会把它永久漏掉:那些陈旧 index blob 会一直躺在暂存区里,
 *   等任何人一次不带 pathspec 的普通 commit 把文件写回旧版。
 */
export function refreshStaleIndex(repoRoot, { dryRun = false } = {}) {
  const g = makeGit(repoRoot)
  const staged = g(['diff', '--name-only', 'HEAD', '--cached', '--no-renames']).split('\n').filter(Boolean)
  if (!staged.length) return { refreshed: 0, paths: [], held: 0 }
  const idxBlob = new Map()
  for (const l of lsStageChunked(g, staged)) {
    const meta = l.split('\t')[0].split(' ')
    if (meta.length >= 2) idxBlob.set(l.split('\t')[1], meta[1])
  }
  const headBlob = new Map(
    g(['ls-tree', '-r', 'HEAD', '--format=%(objectname) %(path)'])
      .split('\n')
      .filter(Boolean)
      .map((l) => {
        const i = l.indexOf(' ')
        return [l.slice(i + 1), l.slice(0, i)]
      }),
  )
  const wtBlob = new Map()
  // 暂存删除(diff-filter=D)的路径在工作区里根本不存在,把它们一起喂给
  // `hash-object --stdin-paths` 会让整条命令 fatal 退出 ⇒ 本自愈每轮都崩在同一处,
  // 工作区存续恢复通道等于停摆(2026-09-23 实测:scripts/tests/gitdir-archive-paths.test.mjs)。
  const present = staged.filter((p) => existsSync(resolve(repoRoot, p)))
  if (present.length) {
    try {
      const hashOut = g(['hash-object', '--stdin-paths'], {
        input: present.map((p) => resolve(repoRoot, p)).join('\n') + '\n',
      })
        .split('\n')
        .filter(Boolean)
      if (hashOut.length === present.length) present.forEach((p, i) => wtBlob.set(p, hashOut[i]))
    } catch {
      // 取不到工作区 blob ⇒ 宁可不刷新(held),也不要在看不到现场时动索引
    }
  }

  const refreshable = []
  let held = 0
  for (const p of staged) {
    const ib = idxBlob.get(p)
    const hb = headBlob.get(p)
    if (!ib || !hb || ib === hb) {
      held++
      continue
    }
    // ③ 无现场:工作区==索引(无未暂存改动)或 工作区==HEAD(旁路提交后工作区已跟上)
    const wt = wtBlob.get(p)
    const noLocalState = !wtBlob.size || wt === ib || wt === hb
    if (noLocalState && isAncestorBlob(g, p, ib)) refreshable.push([p, hb])
    else held++
  }
  if (!refreshable.length) return { refreshed: 0, paths: [], held }
  if (dryRun) return { refreshed: 0, paths: refreshable.map(([p]) => p), held, dryRun: true }
  for (const [p, hb] of refreshable) {
    g(['update-index', '--cacheinfo', `100644,${hb},${p}`])
  }
  return { refreshed: refreshable.length, paths: refreshable.map(([p]) => p), held }
}

/**
 * 幻影漂移对齐(比缺失恢复更严的判据,供 `--align-drift` 与 git-sync-converge 调用):
 * 只对齐**同时满足**三条的路径 —— ① 索引 blob == HEAD blob(该路径上无人暂存过任何东西);
 * ② 工作区内容 != HEAD;③ 守门 84 判定工作区内容**字节级等于该路径某祖先提交版本**
 * (⇒ 不含任何独有内容)。会话真实未提交编辑必然打破 ① 或 ③,故不会被覆盖。
 *
 * 为什么需要它:§12d 的 converge 用 merge-tree/commit-tree 只推进 HEAD 与 index、从不 checkout,
 * HEAD 每前进一次,工作区就多一批落后文件(实测 503 个文件落后 486 个提交)。这些文件被
 * `git add` 提交出去就是静默回滚 —— 守门 84 会拦,但拦住之后仍要有人手工对齐,故在此自动化。
 */
export function alignDrifts(repoRoot, { dryRun = false } = {}) {
  const g = makeGit(repoRoot)
  // 先刷新"落后索引"(CAS/converge 只推进 HEAD 的后遗症),否则下面判据①会把它们全部误挡掉
  const refreshed = refreshStaleIndex(repoRoot, { dryRun })
  const dirty = g(['diff', '--name-only', 'HEAD', '--no-renames']).split('\n').filter(Boolean)
  if (!dirty.length) return { aligned: 0, paths: [], refreshed: refreshed.refreshed }
  // ① 索引 == HEAD 的路径才可对齐
  const indexLines = lsStageChunked(g, dirty)
  const indexBlob = new Map()
  for (const l of indexLines) {
    const meta = l.split('\t')[0].split(' ')
    if (meta.length >= 2) indexBlob.set(l.split('\t')[1], meta[1])
  }
  const headBlob = new Map(
    g(['ls-tree', '-r', 'HEAD', '--format=%(objectname) %(path)'])
      .split('\n')
      .filter(Boolean)
      .map((l) => {
        const i = l.indexOf(' ')
        return [l.slice(i + 1), l.slice(0, i)]
      }),
  )
  const eligible = dirty.filter((p) => {
    const ib = indexBlob.get(p)
    return ib && ib === headBlob.get(p)
  })
  if (!eligible.length) return { aligned: 0, paths: [], skippedStaged: dirty.length }
  const hits = analyze(repoRoot, eligible, { source: 'worktree' })
  const paths = hits.map((h) => h.path)
  if (!paths.length || dryRun) {
    return { aligned: 0, paths, dryRun: true, skippedStaged: dirty.length - eligible.length }
  }
  for (let i = 0; i < paths.length; i += 40) {
    g(['restore', '--source=HEAD', '--worktree', '--', ...paths.slice(i, i + 40)])
  }
  return { aligned: paths.length, paths, skippedStaged: dirty.length - eligible.length }
}

export function heal(repoRoot, { dryRun = false } = {}) {
  const { safe, held } = findOrphanedDeletions(repoRoot)
  if (!safe.length) return { restored: 0, held: held.length, paths: [] }
  if (dryRun) return { restored: 0, held: held.length, paths: safe, dryRun: true }
  const g = makeGit(repoRoot)
  for (let i = 0; i < safe.length; i += 40) {
    g(['restore', '--source=HEAD', '--worktree', '--', ...safe.slice(i, i + 40)])
  }
  return { restored: safe.length, held: held.length, paths: safe }
}

/** 独立临时仓演练:①外部删除必被识别并恢复 ②他人 `git rm --cached` 的删除绝不碰 */
function selfTestRun() {
  const tmp = mkdtempSync(join(dirname(fileURLToPath(import.meta.url)), '..', '.ihui-agent', 'tmp', 'wt-heal-drill-'))
  const g = makeGit(tmp)
  const out = []
  const check = (n, ok) => out.push({ n, ok })
  try {
    g(['init', '-q', '--initial-branch=main'])
    g(['config', 'core.autocrlf', 'false'])
    g(['config', 'user.email', 't@t'])
    g(['config', 'user.name', 't'])
    writeFileSync(join(tmp, 'keep.ts'), 'v1\n')
    writeFileSync(join(tmp, 'sub-dir.ts'), 'v1\n')
    g(['add', '-A'])
    g(['commit', '-qm', 'A'])

    // ① 模拟宿主清理:只删工作区,索引不动
    rmSync(join(tmp, 'keep.ts'), { force: true })
    const f1 = findOrphanedDeletions(tmp)
    check('① 外部删除被识别为可恢复', f1.safe.includes('keep.ts') && !f1.held.includes('keep.ts'))
    const h1 = heal(tmp)
    check('② 恢复后文件回到工作区', h1.restored === 1 && existsSync(join(tmp, 'keep.ts')))

    // ③ 他人有意删除:同时暂存删除 ⇒ 不得恢复
    g(['rm', '-q', '--cached', 'sub-dir.ts'])
    rmSync(join(tmp, 'sub-dir.ts'), { force: true })
    const f2 = findOrphanedDeletions(tmp)
    check('③ 他人暂存的删除不被插手', !f2.safe.includes('sub-dir.ts'))
    heal(tmp)
    check('④ 恢复动作后该文件仍为删除态', !existsSync(join(tmp, 'sub-dir.ts')))

    // ⑤ 干净工作区 ⇒ 无事发生
    g(['commit', '-qm', 'B'])
    const h2 = heal(tmp)
    check('⑤ 无缺失时零动作', h2.restored === 0)

    // ⑥ 幻影漂移:工作区写回祖先版本(索引仍 == HEAD)⇒ 必须被对齐
    writeFileSync(join(tmp, 'keep.ts'), 'v2\n')
    g(['commit', '-qam', 'C: v2'])
    writeFileSync(join(tmp, 'keep.ts'), 'v1\n') // == 提交 A 的版本,!= HEAD
    const d1 = alignDrifts(tmp)
    check('⑥ 漂移被识别并对齐', d1.aligned === 1 && readFileSync(join(tmp, 'keep.ts'), 'utf8') === 'v2\n')

    // ⑦ 真实未提交编辑 ⇒ 绝不覆盖
    writeFileSync(join(tmp, 'keep.ts'), 'v3 未提交的新工作\n')
    const d2 = alignDrifts(tmp)
    check('⑦ 真编辑不被覆盖', d2.aligned === 0 && readFileSync(join(tmp, 'keep.ts'), 'utf8') === 'v3 未提交的新工作\n')

    // ⑧ 暂存后工作区又有新改动(判据③不成立)⇒ 绝不刷新、绝不对齐(protect 现场)
    writeFileSync(join(tmp, 'keep.ts'), 'v1\n')
    g(['add', 'keep.ts']) // index = v1(祖先版本)
    writeFileSync(join(tmp, 'keep.ts'), 'v4 暂存后又改了\n') // worktree != index ⇒ 有现场
    const r0 = refreshStaleIndex(tmp)
    check('⑧ 暂存后又有改动 ⇒ 不刷新', r0.refreshed === 0)
    alignDrifts(tmp)
    check('⑧b 该文件工作区改动未被覆盖', readFileSync(join(tmp, 'keep.ts'), 'utf8') === 'v4 暂存后又改了\n')
    g(['restore', '--staged', '--worktree', '--', 'keep.ts'])

    // ⑨ 落后索引(CAS/converge 只推进 HEAD 的后遗症)⇒ 逐路径刷新,并随之对齐工作区
    writeFileSync(join(tmp, 'keep.ts'), 'v9\n')
    g(['commit', '-qam', 'D: v9'])
    writeFileSync(join(tmp, 'keep.ts'), 'v2\n')
    g(['add', 'keep.ts']) // index==v2(祖先版本)、worktree==v2 ⇒ 典型"HEAD 前移而索引留在原地"
    const r1 = refreshStaleIndex(tmp)
    check('⑨ 落后索引被逐路径刷新', r1.refreshed === 1)
    alignDrifts(tmp)
    check('⑩ 刷新后工作区随之对齐到 HEAD', readFileSync(join(tmp, 'keep.ts'), 'utf8') === 'v9\n')

    // ⑫ 旁路提交(commit-tree + update-ref)后的真实残留形态:HEAD 与工作区都已前进,
    //    **只有索引停在祖先版本**(本仓 2026-09-23 实测 4 个路径即此态,原判据③漏掉它)。
    writeFileSync(join(tmp, 'keep.ts'), 'v11\n')
    g(['commit', '-qam', 'E: v11'])
    const ancestorBlob = g(['rev-parse', 'HEAD~1:keep.ts']).trim()
    g(['update-index', '--cacheinfo', `100644,${ancestorBlob},keep.ts`]) // 人为把 index 退回祖先版本
    const r1b = refreshStaleIndex(tmp)
    const indexAfter = g(['ls-files', '-s', '--', 'keep.ts']).split(/\s+/)[1]
    check(
      '⑫ 工作区==HEAD 而索引停在祖先版本 ⇒ 刷新 index 且不动工作区',
      r1b.refreshed === 1 &&
        indexAfter === g(['rev-parse', 'HEAD:keep.ts']).trim() &&
        readFileSync(join(tmp, 'keep.ts'), 'utf8') === 'v11\n',
    )

    // ⑬ 暂存删除(工作区根本没有该文件)不得把刷新整条打崩
    //     —— hash-object --stdin-paths 遇到缺失文件会 fatal 退出,曾使本自愈每轮必崩。
    writeFileSync(join(tmp, 'gone.ts'), 'to be deleted\n')
    g(['add', 'gone.ts'])
    g(['commit', '-qm', 'F: 新增 gone.ts'])
    g(['rm', '-q', 'gone.ts']) // 索引=删除态,工作区无文件
    let threw = false
    try {
      refreshStaleIndex(tmp)
    } catch {
      threw = true
    }
    check('⑬ 暂存删除不使刷新崩溃', !threw)

    // ⑪ 他人真暂存的新内容(blob 不是任何历史版本)⇒ 绝不刷新
    writeFileSync(join(tmp, 'keep.ts'), '他人暂存的新工作\n')
    g(['add', 'keep.ts'])
    const r2 = refreshStaleIndex(tmp)
    check(
      '⑪ 他人真暂存不被刷新',
      r2.refreshed === 0 && readFileSync(join(tmp, 'keep.ts'), 'utf8') === '他人暂存的新工作\n',
    )

    let fail = 0
    for (const r of out) {
      console.log(`${r.ok ? '✅' : '❌'} ${r.n}`)
      if (!r.ok) fail++
    }
    console.log(fail ? `self-test FAILED ${fail}/${out.length}` : `✅ check heal-worktree-tracked self-test 全部通过(${out.length} 例)`)
    return fail ? 1 : 0
  } finally {
    rmSync(tmp, { recursive: true, force: true })
  }
}

async function main() {
  const argv = process.argv.slice(2)
  if (argv.includes('--self-test')) return selfTestRun()
  const repoRoot = resolve(dirname(fileURLToPath(import.meta.url)), '..')
  if (process.env[SKIP_ENV]) return 0
  // `--check` 必须是**只判不改**的巡检口径(AGENTS.md §5b 承诺"零副作用"):
  // 旧实现只认 `--dry-run`,`--check` 会一路落到真恢复分支,把他人**有意**的未暂存删除
  // 直接 `git restore` 复活(2026-09-24 差点咬掉并发会话正在收口的 4 个分类栏文件)。
  const checkOnly = argv.includes('--check')
  const dryRun = argv.includes('--dry-run') || checkOnly
  // --align-drift:跳过缺失恢复,只做幻影漂移对齐(git-sync-converge 推进 HEAD 后调用)
  if (argv.includes('--align-drift')) {
    const d = alignDrifts(repoRoot, { dryRun })
    if (argv.includes('--json')) console.log(JSON.stringify(d))
    else if (d.aligned) console.log(`${dryRun ? '[check] 可对齐' : '✅ 幻影漂移对齐'} ${d.aligned} 个文件(索引==HEAD 且内容==祖先版本)`)
    else console.log(`✅ 无需对齐(可判定 ${d.paths ? d.paths.length : 0} 个,已跳过有暂存的 ${d.skippedStaged || 0} 个)`)
    return d.aligned && checkOnly ? 1 : 0
  }
  const res = heal(repoRoot, { dryRun })
  if (argv.includes('--json')) {
    console.log(JSON.stringify(res))
    return checkOnly && res.paths.length ? 1 : 0
  }
  if (!res.restored && !res.paths.length && !res.held) {
    console.log('✅ 工作区已跟踪文件存续正常')
    return 0
  }
  console.log(
    `${dryRun ? '[check] 可恢复' : '已恢复'} ${res.restored || res.paths.length} 个被外部删除的跟踪文件` +
      (res.held ? `;另有 ${res.held} 个他人已暂存的删除(不碰)` : ''),
  )
  for (const p of res.paths.slice(0, 20)) console.log('   - ' + p)
  return checkOnly && res.paths.length ? 1 : 0
}

export const healTrackedFiles = heal

const isDirectRun = process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href

if (isDirectRun) {
  main()
    .then((code) => {
      if (code) process.exit(code)
    })
    .catch((e) => {
      console.error(`❌ ${e?.message ?? e}\n${e?.stack ?? ''}`)
      process.exit(2)
    })
}

export const __test__ = { findOrphanedDeletions, heal, alignDrifts, refreshStaleIndex, SKIP_ENV }
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
