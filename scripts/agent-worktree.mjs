// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * agent-worktree — 影响面隔离(O65 P0 · O6503 的隔离半边,2026-10-25 立)。
 *
 * 把"一个 agent 的改动限定在独立检出里"落成一把尺子,但**不自造第二套规范**:
 * 落点 = 根直属 `.worktrees/wt-<名>`、分支 `wt/<名>`,与 AGENTS §12h 五步生命周期同源。
 *
 * 纪律:
 *  - 默认 dry-run:不带 --apply 只打印将执行的 git 命令,零写入。
 *  - 回收不得静默删未合并检出:分支未并入 main ⇒ 必须 --tag-lost(先打 lost-commit 标签保活,
 *    再移除),否则拒绝(§12h:未合并检出不得静默删;合并与否由 agent 自主裁决,见 §12h-补)。
 *  - git 一律显式 stdio(守门 193):不裸 execSync、不共用继承管道。
 *
 * 用法:
 *   node scripts/agent-worktree.mjs --create <名> [--base origin/main] [--apply]
 *   node scripts/agent-worktree.mjs --list [--json]
 *   node scripts/agent-worktree.mjs --remove <名> [--tag-lost] [--apply]
 *   node scripts/agent-worktree.mjs --reap [--older-than 7] [--apply]
 *   node scripts/agent-worktree.mjs --self-test
 */
import { statSync } from 'node:fs'
import { join, dirname, resolve, basename, relative, isAbsolute } from 'node:path'
import { fileURLToPath } from 'node:url'
import { gitRaw } from './lib/face-reader.mjs'

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..')
export const EXIT_OK = 0
export const EXIT_REFUSED = 1
export const EXIT_UNKNOWN = 2
const WT_DIR = join(ROOT, '.worktrees')

/** 名字规范化:只留 [a-z0-9-],空/非法 ⇒ 抛。复用同一规则判落点与分支名。 */
export function normalizeName(raw) {
  const n = String(raw ?? '')
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9-]+/g, '-')
    .replace(/^-+|-+$/g, '')
  if (!n) throw new Error('worktree 名不能为空(规范化后为空)')
  if (n.length > 40) throw new Error(`worktree 名过长(${n.length} > 40)`)
  return n
}

export function worktreePathOf(name, root = ROOT) {
  return join(root, '.worktrees', `wt-${normalizeName(name)}`)
}

export function branchOf(name) {
  return `wt/${normalizeName(name)}`
}

export function lostTagOf(name, sha) {
  return `lost-commit/worktree-${normalizeName(name)}-${String(sha).slice(0, 7)}`
}

/** `git worktree list --porcelain` 解析:返回 [{path, sha, branch, locked, prunable, detached}]。 */
export function parseWorktreeList(out) {
  const rows = []
  let cur = null
  for (const line of String(out ?? '').split('\n')) {
    if (line.startsWith('worktree ')) {
      if (cur) rows.push(cur)
      cur = {
        path: line.slice('worktree '.length).trim(),
        sha: '',
        branch: '',
        locked: false,
        prunable: false,
        detached: false,
      }
    } else if (cur && line.startsWith('HEAD ')) cur.sha = line.slice(5).trim()
    else if (cur && line.startsWith('branch '))
      cur.branch = line
        .slice(7)
        .trim()
        .replace(/^refs\/heads\//, '')
    else if (cur && line === 'detached') cur.detached = true
    else if (cur && line.startsWith('prunable')) cur.prunable = true
    else if (cur && line.startsWith('locked')) cur.locked = line.slice('locked'.length).trim() || true
  }
  if (cur) rows.push(cur)
  return rows
}

/** p 是否严格落在 dir 之下(按路径分段判定,避免 `G:\IHUI-AI\.worktrees-x` 这类前缀误判)。 */
export function isUnderDir(p, dir) {
  const rel = relative(resolve(dir), resolve(p))
  return rel !== '' && !rel.startsWith('..') && !isAbsolute(rel)
}

/** 批准落点判定:只有根直属 `.worktrees/` 下的检出才由本工具回收。 */
export function isUnderWorktreesRoot(p, root = ROOT) {
  return isUnderDir(p, join(root, '.worktrees'))
}

/**
 * 回收判定(纯函数,构造面可证)。返回 `{action:'remove'|'skip', reason}`。
 *
 * 方向一律"宁可少收一个,不可丢一份现场":不在批准落点、非 `wt/*` 分支、locked、脏、
 * HEAD 未并入 main、活跃未满阈值、量不到最后活动时间 —— 任一命中即保留。
 */
export function evaluateReapCandidate({
  path,
  branch = '',
  locked = false,
  dirty = false,
  merged = false,
  lastActivityMs = 0,
  now = Date.now(),
  minIdleDays = 7,
  worktreesRoot = join(ROOT, '.worktrees'),
} = {}) {
  if (!isUnderDir(path, worktreesRoot)) return { action: 'skip', reason: '不在批准落点 .worktrees/ 下' }
  if (!/^wt\//.test(branch)) return { action: 'skip', reason: '分支不属于 wt/*' }
  if (locked) return { action: 'skip', reason: 'worktree 被 lock' }
  if (dirty) return { action: 'skip', reason: '工作区有未提交/未跟踪改动(保留现场)' }
  if (!merged) return { action: 'skip', reason: 'HEAD 未并入 main(按 §12h 先裁决,不静默删)' }
  if (!Number.isFinite(lastActivityMs) || lastActivityMs <= 0)
    return { action: 'skip', reason: '量不到最后活动时间(保守保留)' }
  const idleDays = (now - lastActivityMs) / 86_400_000
  if (idleDays < minIdleDays)
    return { action: 'skip', reason: `最近活动 ${idleDays.toFixed(1)} 天 < 阈值 ${minIdleDays} 天` }
  return { action: 'remove', reason: `干净且已并入 main,空闲 ${idleDays.toFixed(1)} 天 ≥ ${minIdleDays} 天` }
}

function git(args, { root = ROOT, input = null } = {}) {
  // G-927 迁移批(2026-10-25):裸 spawnSync('git') 改走 face-reader 取材层 gitRaw
  // (绝对路径 git + quotepath=false + safe.directory + timeout + EBUSY 兜底)。
  // gitRaw 非零即抛 Undetermined(带 status),这里折回调用方的 {ok,status,out,err} 三态,
  // 行为面与旧实现逐字段等值(out 含 stdout,status 透传,err 取异常消息)。
  try {
    return { ok: true, status: 0, out: gitRaw(args, root, { input: input ?? undefined }), err: '' }
  } catch (e) {
    return { ok: false, status: typeof e?.status === 'number' ? e.status : 1, out: '', err: String(e?.message ?? e) }
  }
}

function mtimeMsOf(p) {
  try {
    return statSync(p).mtimeMs
  } catch {
    return 0
  }
}

/** 最后活动时间:取 worktree 根/`.git`/admin 目录(index、HEAD)与 HEAD 提交时间的最大值。 */
function lastActivityMsOf(path) {
  let ts = 0
  const push = (ms) => {
    if (Number.isFinite(ms) && ms > ts) ts = ms
  }
  push(mtimeMsOf(path))
  push(mtimeMsOf(join(path, '.git')))
  const gd = git(['rev-parse', '--git-dir'], { root: path })
  if (gd.ok) {
    const raw = gd.out.trim()
    const admin = isAbsolute(raw) ? raw : join(path, raw)
    push(mtimeMsOf(admin))
    push(mtimeMsOf(join(admin, 'index')))
    push(mtimeMsOf(join(admin, 'HEAD')))
  }
  const last = git(['log', '-1', '--format=%ct'], { root: path })
  if (last.ok) push(Number(last.out.trim()) * 1000)
  return ts
}

/** 工作区是否脏(含未跟踪);量不到按脏处理,保留现场。 */
function isDirty(path) {
  const r = git(['status', '--porcelain'], { root: path })
  return !r.ok || r.out.trim().length > 0
}

function selfTest() {
  const assert = (c, m) => {
    if (!c) throw new Error(`self-test 失败:${m}`)
  }
  assert(normalizeName('Land 20261025') === 'land-20261025', '名字规范化')
  assert(normalizeName('  Wt-01 ') === 'wt-01', '去空白与保留连字符')
  let threw = false
  try {
    normalizeName('!!!')
  } catch {
    threw = true
  }
  assert(threw, '全非法字符应抛')
  const p = worktreePathOf('abc', '/repo')
  assert(p.replace(/\\/g, '/') === '/repo/.worktrees/wt-abc', `落点应在根直属 .worktrees:${p}`)
  assert(branchOf('abc') === 'wt/abc', '分支名')
  assert(
    lostTagOf('abc', '0123456789abcdef') === 'lost-commit/worktree-abc-0123456',
    '保活标签截 7 位',
  )
  const rows = parseWorktreeList(
    [
      'worktree D:/IHUI-AI-git-repo',
      'HEAD c05ca0d5000e',
      'branch refs/heads/main',
      '',
      'worktree D:/IHUI-AI/.worktrees/wt-x',
      'HEAD abc123',
      'branch refs/heads/wt/x',
      '',
    ].join('\n'),
  )
  assert(
    rows.length === 2 && rows[0].branch === 'main' && rows[1].branch === 'wt/x',
    'porcelain 解析',
  )
  assert(basename(rows[1].path) === 'wt-x', '路径 basename')
  const marked = parseWorktreeList(
    [
      'worktree G:/IHUI-AI/.worktrees/wt-y',
      'HEAD def456',
      'branch refs/heads/wt/y',
      'locked needs review',
      '',
      'worktree G:/gone/wt-z',
      'HEAD 789abc',
      'detached',
      'prunable gitdir file points to non-existent location',
      '',
    ].join('\n'),
  )
  assert(marked[0].locked === 'needs review' && marked[0].prunable === false, 'locked 行解析')
  assert(marked[1].detached === true && marked[1].prunable === true, 'detached/prunable 行解析')

  const base = { path: '/repo/.worktrees/wt-a', branch: 'wt/a', merged: true, lastActivityMs: 1 }
  const now = 1 + 30 * 86_400_000
  assert(
    evaluateReapCandidate({ ...base, now, worktreesRoot: '/repo/.worktrees' }).action === 'remove',
    '干净+已并入+超龄 ⇒ 回收',
  )
  assert(
    evaluateReapCandidate({ ...base, branch: '', now, worktreesRoot: '/repo/.worktrees' }).action === 'skip',
    '非 wt/* 分支必须保留',
  )
  assert(
    evaluateReapCandidate({ ...base, locked: true, now, worktreesRoot: '/repo/.worktrees' }).action === 'skip',
    'locked 必须保留',
  )
  assert(
    evaluateReapCandidate({ ...base, dirty: true, now, worktreesRoot: '/repo/.worktrees' }).action === 'skip',
    '脏工作区必须保留',
  )
  assert(
    evaluateReapCandidate({ ...base, merged: false, now, worktreesRoot: '/repo/.worktrees' }).action === 'skip',
    '独有 HEAD 必须保留',
  )
  assert(
    evaluateReapCandidate({ ...base, path: '/elsewhere/wt-a', now, worktreesRoot: '/repo/.worktrees' }).action ===
      'skip',
    '批准落点之外必须保留',
  )
  assert(
    evaluateReapCandidate({ ...base, now, minIdleDays: 31, worktreesRoot: '/repo/.worktrees' }).action === 'skip',
    '活跃未满阈值必须保留',
  )
  console.log('self-test: 全绿(17 组断言)')
}

function main(argv) {
  const has = (f) => argv.includes(f)
  const val = (f, d = null) => {
    const i = argv.indexOf(f)
    return i >= 0 && i + 1 < argv.length ? argv[i + 1] : d
  }
  if (has('--self-test')) return selfTest()
  const apply = has('--apply')

  if (has('--list')) {
    const r = git(['worktree', 'list', '--porcelain'])
    if (!r.ok) {
      console.error(`❌ 未判定:git worktree list 失败(${r.err.trim()})`)
      process.exitCode = EXIT_UNKNOWN
      return
    }
    const rows = parseWorktreeList(r.out)
    if (has('--json')) console.log(JSON.stringify(rows, null, 2))
    else
      for (const w of rows)
        console.log(
          `${w.sha.slice(0, 10)}  ${w.branch || '(detached)'}  ${w.path}` +
            `${w.locked ? '  [locked]' : ''}${w.prunable ? '  [prunable]' : ''}`,
        )
    return
  }

  if (has('--reap')) {
    const minIdle = Number(val('--older-than', '7'))
    if (!Number.isFinite(minIdle) || minIdle < 0) {
      console.error(`❌ --older-than 需要非负天数,收到 ${val('--older-than', '')}`)
      process.exitCode = EXIT_UNKNOWN
      return
    }
    const list = git(['worktree', 'list', '--porcelain'])
    if (!list.ok) {
      console.error(`❌ 未判定:git worktree list 失败(${list.err.trim()})`)
      process.exitCode = EXIT_UNKNOWN
      return
    }
    const now = Date.now()
    const rows = []
    for (const w of parseWorktreeList(list.out)) {
      if (resolve(w.path) === resolve(ROOT)) continue
      const dirty = isDirty(w.path)
      const merged = git(['merge-base', '--is-ancestor', w.sha, 'main']).ok
      const verdict = evaluateReapCandidate({
        path: w.path,
        branch: w.branch,
        locked: !!w.locked,
        dirty,
        merged,
        lastActivityMs: lastActivityMsOf(w.path),
        now,
        minIdleDays: minIdle,
        worktreesRoot: WT_DIR,
      })
      rows.push({ ...w, ...verdict })
    }
    const doomed = rows.filter((r) => r.action === 'remove')
    for (const r of rows) {
      console.log(`${r.action === 'remove' ? '🗑' : '⏭'} ${r.path} [${r.branch || '(detached)'}] ${r.reason}`)
    }
    if (!doomed.length) {
      console.log(`ℹ 无回收候选(${rows.length} 个检出全数保留;阈值 ${minIdle} 天)`)
      return
    }
    if (!apply) {
      console.log(`ℹ dry-run:将回收 ${doomed.length} 个(加 --apply 执行)`)
      return
    }
    let removed = 0
    let failed = 0
    for (const r of doomed) {
      const rm = git(['worktree', 'remove', r.path])
      if (!rm.ok) {
        console.error(`❌ 回收失败 ${r.path}:${rm.err.trim()}(先按 §12h 裁决现场)`)
        failed += 1
        continue
      }
      const del = git(['branch', '-d', r.branch])
      removed += 1
      if (!del.ok) console.log(`⚠ 已回收 ${r.path};分支 ${r.branch} 未删(${del.err.trim().split('\n')[0]})`)
    }
    git(['worktree', 'prune'])
    console.log(`✅ 回收 ${removed} 个${failed ? `,失败 ${failed} 个` : ''}(已 prune)`)
    if (failed) process.exitCode = EXIT_REFUSED
    return
  }

  if (has('--create')) {
    let name
    try {
      name = normalizeName(val('--create', ''))
    } catch (e) {
      console.error(`❌ ${e.message}`)
      process.exitCode = EXIT_UNKNOWN
      return
    }
    const base = val('--base', 'HEAD')
    const path = worktreePathOf(name)
    const branch = branchOf(name)
    const list = git(['worktree', 'list', '--porcelain'])
    if (!list.ok) {
      console.error('❌ 未判定:读不到 worktree 清单')
      process.exitCode = EXIT_UNKNOWN
      return
    }
    if (parseWorktreeList(list.out).some((w) => resolve(w.path) === resolve(path))) {
      console.error(`❌ 名字被占用:${path} 已是活动检出(先 --remove 或换名)`)
      process.exitCode = EXIT_REFUSED
      return
    }
    console.log(`落点 ${path}\n分支 ${branch}(base=${base})`)
    if (!apply) {
      console.log('ℹ dry-run:未写入。加 --apply 执行。')
      return
    }
    const r = git(['worktree', 'add', '-b', branch, path, base])
    if (!r.ok) {
      console.error(`❌ 创建失败:${(r.err || r.out).trim()}`)
      process.exitCode = EXIT_REFUSED
      return
    }
    console.log(
      `✅ 已创建 ${path}(分支 ${branch});收尾按 AGENTS §12h 五步:合并 → 提交推送 → 回收 → 删分支 → prune`,
    )
    return
  }

  if (has('--remove')) {
    let name
    try {
      name = normalizeName(val('--remove', ''))
    } catch (e) {
      console.error(`❌ ${e.message}`)
      process.exitCode = EXIT_UNKNOWN
      return
    }
    const path = worktreePathOf(name)
    const branch = branchOf(name)
    const list = git(['worktree', 'list', '--porcelain'])
    const entry = list.ok
      ? parseWorktreeList(list.out).find((w) => resolve(w.path) === resolve(path))
      : null
    if (!entry) {
      console.error(`❌ 未找到该检出:${path}`)
      process.exitCode = EXIT_REFUSED
      return
    }
    const merged = git(['merge-base', '--is-ancestor', branch, 'main'])
    const isMerged = merged.ok
    console.log(
      `检出 ${path}(HEAD ${entry.sha.slice(0, 10)},分支 ${branch})已并入 main=${isMerged}`,
    )
    if (!isMerged && !has('--tag-lost')) {
      console.error(
        '❌ 拒绝回收:分支未并入 main。按 §12h 未合并检出不得静默删;确需回收先给 --tag-lost(打保活标签后再删)',
      )
      process.exitCode = EXIT_REFUSED
      return
    }
    if (!apply) {
      console.log(
        `ℹ dry-run:将${isMerged ? '' : `先打标签 ${lostTagOf(name, entry.sha)} 再`}执行 git worktree remove ${path} + git worktree prune`,
      )
      return
    }
    if (!isMerged) {
      const t = git(['tag', lostTagOf(name, entry.sha), entry.sha])
      if (!t.ok) {
        console.error(`❌ 打保活标签失败:${t.err.trim()} ⇒ 不继续删(保住工作)`)
        process.exitCode = EXIT_REFUSED
        return
      }
      console.log(`🏷 已打保活标签 ${lostTagOf(name, entry.sha)}`)
    }
    const rm = git(['worktree', 'remove', path])
    if (!rm.ok) {
      console.error(`❌ 回收失败:${rm.err.trim()}(有未提交改动时 git 会拒绝——按 §12h 先裁决再收回)`)
      process.exitCode = EXIT_REFUSED
      return
    }
    git(['worktree', 'prune'])
    const del = git(['branch', '-d', branch])
    console.log(
      del.ok
        ? `✅ 已回收 ${path} 并删除已并入分支 ${branch}`
        : `✅ 已回收 ${path};分支 ${branch} 未删(${del.err.trim().split('\n')[0]})`,
    )
    return
  }

  console.error(
    '用法:--create <名> [--base ref] [--apply] | --list [--json] | --remove <名> [--tag-lost] [--apply] | --reap [--older-than N] [--apply] | --self-test',
  )
  process.exitCode = EXIT_UNKNOWN
}

export const __test__ = {
  normalizeName,
  worktreePathOf,
  branchOf,
  lostTagOf,
  parseWorktreeList,
  isUnderDir,
  isUnderWorktreesRoot,
  evaluateReapCandidate,
}

if (process.argv[1] && resolve(process.argv[1]) === resolve(fileURLToPath(import.meta.url))) {
  main(process.argv.slice(2))
}
