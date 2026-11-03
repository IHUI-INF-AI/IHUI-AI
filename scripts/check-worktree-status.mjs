// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * check-worktree-status.mjs —— 全工作树未提交状态唯一口径(2026-11-02 立)。
 *
 * 立因:多会话共享同一 gitdir 时,`git worktree add` 产生的附加工作树(如
 * `.ihui-agent/tmp/wip-*`)不会出现在主树的 `git status` 里;本会话曾多次把
 * 「未提交=0」建在主树单树上,漏掉附加树里的 6 个待提交文件。此后任何
 * 「是否还有未提交改动」的结论必须覆盖 `git worktree list` 的全部工作树。
 *
 * 输出:每树一行(路径 | 分支 | HEAD 短 hash | staged/unstaged/untracked/conflict/stash 计数),
 *       末行总计;`--json` 供程序消费。
 * 退出:0 全部干净(或 --gate 模式下仅非主树脏);1 有待提交内容;2 环境异常(不是 git 仓库等)。
 * `--gate`:提交钩子口径 —— 主树(主工作树)**残量**(未暂存/未跟踪/冲突/stash)⇒ 阻断(exit 1);
 *           仅其他工作树脏 ⇒ 只告警不阻断(exit 0),避免并行会话 WIP 恒红。
 *           主树的 `staged` 不计入阻断:pre-commit 时本次提交的暂存内容天然在主树,
 *           把它算脏会让每一次提交都永远过不去。收尾判定(含暂存)请用默认严格模式。
 */
/* eslint-disable no-console -- 守门脚本为 CLI 工具,需 console 输出诊断信息 */
import { spawnSync } from 'node:child_process'

const UNMERGED = new Set(['DD', 'AU', 'UD', 'UA', 'DU', 'AA', 'UU'])

function gitEnv() {
  const env = { ...process.env }
  // IDE(Trae)会向会话注入 GIT_DIR/GIT_WORK_TREE;逐树 -C 时必须清掉,
  // 否则所有命令都会打到注入的那个 gitdir(见 .husky/pre-commit 同款注释)。
  for (const key of [
    'GIT_DIR',
    'GIT_WORK_TREE',
    'GIT_INDEX_FILE',
    'GIT_OBJECT_DIRECTORY',
    'GIT_ALTERNATE_OBJECT_DIRECTORIES',
    'GIT_QUARANTINE_PATH',
  ]) {
    delete env[key]
  }
  return env
}

function git(args, cwd) {
  const r = spawnSync('git', args, {
    cwd,
    encoding: 'utf8',
    windowsHide: true,
    env: gitEnv(),
    stdio: ['ignore', 'pipe', 'pipe'],
  })
  if (r.error) throw r.error
  // 注意:不能对 stdout 用 trim —— porcelain 首行形如 " M a.txt" 与 "M  a.txt" 的
  // X/Y 两列靠**前导空格**区分"未暂存"与"已暂存",trim 会把 " M" 削成 "M" 从而把
  // 未暂存误报成已暂存。这里只去掉 BOM 与尾随换行。
  const raw = (r.stdout ?? '').replace(/^\uFEFF/, '')
  return { ok: r.status === 0, out: raw.replace(/\r?\n+$/, ''), err: (r.stderr ?? '').trim(), status: r.status }
}

export function parseWorktreePorcelain(out) {
  const rows = []
  let cur = null
  for (const line of out.split(/\r?\n/)) {
    if (!line.trim()) continue
    if (line.startsWith('worktree ')) {
      if (cur) rows.push(cur)
      cur = { path: line.slice('worktree '.length).trim(), head: '', branch: '', detached: false, locked: false }
    } else if (cur && line.startsWith('HEAD ')) {
      cur.head = line.slice(5).trim()
    } else if (cur && line.startsWith('branch ')) {
      const ref = line.slice('branch '.length).trim()
      cur.branch = ref.replace(/^refs\/heads\//, '')
    } else if (cur && line.trim() === 'detached') {
      cur.detached = true
    } else if (cur && line.startsWith('locked')) {
      cur.locked = true
    }
  }
  if (cur) rows.push(cur)
  return rows
}

export function parseStatusPorcelain(out) {
  const counts = { staged: 0, unstaged: 0, untracked: 0, conflicts: 0 }
  for (const line of out.split(/\r?\n/)) {
    if (!line) continue
    const xy = line.slice(0, 2)
    if (xy === '??') {
      counts.untracked += 1
      continue
    }
    if (xy === '!!') continue
    if (UNMERGED.has(xy)) {
      counts.conflicts += 1
      continue
    }
    if (xy[0] !== ' ') counts.staged += 1
    if (xy[1] !== ' ') counts.unstaged += 1
  }
  return counts
}

/**
 * 本仓库的 `.git` 是指针文件,主工作树在 `git worktree list` 里会印成 gitdir
 * (D:/IHUI-AI-git-repo)而不是工作区(D:/IHUI-AI);对 gitdir 跑工作树型命令会报
 * "this operation must be run in a work tree"。逐树先解析真实 toplevel,主树解析
 * 失败时回落到当前调用目录的 toplevel。
 */
function resolveTreePath(row, cwd, isMain) {
  const r = git(['-C', row.path, 'rev-parse', '--show-toplevel'], cwd)
  if (r.ok && r.out) return r.out
  if (isMain) {
    const t = git(['rev-parse', '--show-toplevel'], cwd)
    if (t.ok && t.out) return t.out
  }
  return row.path
}

function inspectTree(row, cwd, isMain) {
  const path = resolveTreePath(row, cwd, isMain)
  const st = git(['-C', path, 'status', '--porcelain'], cwd)
  if (!st.ok) throw new Error(`git status 失败(${path}): ${st.err || st.out}`)
  const stash = git(['-C', path, 'stash', 'list'], cwd)
  if (!stash.ok) throw new Error(`git stash list 失败(${path}): ${stash.err || stash.out}`)
  return {
    path,
    branch: row.detached ? '(detached)' : row.branch || '(unknown)',
    head: row.head ? row.head.slice(0, 8) : '',
    locked: row.locked,
    ...parseStatusPorcelain(st.out),
    stashes: stash.out ? stash.out.split(/\r?\n/).filter(Boolean).length : 0,
  }
}

export function summarize(trees) {
  return trees.reduce(
    (acc, t) => ({
      staged: acc.staged + t.staged,
      unstaged: acc.unstaged + t.unstaged,
      untracked: acc.untracked + t.untracked,
      conflicts: acc.conflicts + t.conflicts,
      stashes: acc.stashes + t.stashes,
    }),
    { staged: 0, unstaged: 0, untracked: 0, conflicts: 0, stashes: 0 },
  )
}

function isEmpty(t) {
  return t.staged + t.unstaged + t.untracked + t.conflicts + t.stashes === 0
}

function main(argv) {
  const json = argv.includes('--json')
  const gate = argv.includes('--gate')
  const cwd = process.cwd()
  const list = git(['worktree', 'list', '--porcelain'], cwd)
  if (!list.ok) {
    console.error(`❌ 不是 git 仓库或 git worktree 不可用: ${list.err || list.out}`)
    return 2
  }
  const rows = parseWorktreePorcelain(list.out)
  if (rows.length === 0) {
    console.error('❌ git worktree list 返回空')
    return 2
  }
  const trees = rows.map((row, i) => inspectTree(row, cwd, i === 0))
  const totals = summarize(trees)
  const mainTree = trees[0]
  const mainDirty = !isEmpty(mainTree)
  // pre-commit 语境下暂存内容 = 本次正在提交的内容,不算"主树残量"(见头注)。
  const mainResidualDirty =
    mainTree.unstaged + mainTree.untracked + mainTree.conflicts + mainTree.stashes > 0
  const othersDirty = trees.slice(1).some((t) => !isEmpty(t))
  const clean = isEmpty(totals)

  if (json) {
    console.log(
      JSON.stringify(
        {
          ok: gate ? !mainResidualDirty : clean,
          gateMode: gate,
          clean,
          mainDirty,
          mainResidualDirty,
          othersDirty,
          trees,
          totals,
        },
        null,
        2,
      ),
    )
  } else {
    for (const t of trees) {
      console.log(
        `[worktree] ${t.path} | ${t.branch} | ${t.head} | staged=${t.staged} unstaged=${t.unstaged} untracked=${t.untracked} conflict=${t.conflicts} stash=${t.stashes}${t.locked ? ' | LOCKED' : ''}`,
      )
    }
    console.log(
      `总计: ${trees.length} 棵工作树 | staged=${totals.staged} unstaged=${totals.unstaged} untracked=${totals.untracked} conflict=${totals.conflicts} stash=${totals.stashes} | ${clean ? '全部干净' : '存在未提交内容'}`,
    )
  }

  if (gate) {
    if (mainResidualDirty) {
      if (!json) {
        console.error(
          `❌ 主工作树存在本次提交之外的未提交内容(unstaged=${mainTree.unstaged} untracked=${mainTree.untracked} conflict=${mainTree.conflicts} stash=${mainTree.stashes}),提交阻断`,
        )
      }
      return 1
    }
    if (othersDirty) {
      if (!json) console.warn('⚠️ 其他工作树存在未提交内容(仅告警,不阻断本次提交)')
    }
    return 0
  }
  return clean ? 0 : 1
}

const isDirectRun = process.argv[1] && /check-worktree-status\.mjs$/.test(process.argv[1])
if (isDirectRun) {
  try {
    process.exitCode = main(process.argv.slice(2))
  } catch (e) {
    console.error(`❌ check-worktree-status 异常: ${e?.message || e}`)
    process.exitCode = 2
  }
}

export const __test__ = { parseWorktreePorcelain, parseStatusPorcelain, summarize }
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
