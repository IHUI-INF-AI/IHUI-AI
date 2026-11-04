#!/usr/bin/env node
// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * worktree-isolate.mjs —— 一条命令开 / 收 / 列隔离工作树(2026-11-04 立)。
 *
 * ## 治什么
 *
 * 本仓长期多会话同树并发改。B 组三道门(`281 全工作树未提交状态`、`44 根目录整洁`、
 * `30c 陈旧副本`)里有两道其实在量「有多少人同时在改同一棵树」——不是修某道门能消的红,
 * 根因是缺 worktree 隔离。已有 `D:\IHUI-AI-mergefix-wt`、`D:\IHUI-AI-homefont-wt`
 * 两处手工检出证明这条路能跑通,但没有工具化;本脚本把它落成一条命令。
 *
 * ## 与 `agent-worktree.mjs` 的分工(不是第二套规范)
 *
 * `agent-worktree.mjs` 管**仓内** `.worktrees/`(AGENTS §12h 生命周期、默认 dry-run、
 * 带 reap 回收)。本脚本管**仓外**独立目录(`<盘根>/<仓名>-wt-<slug>`),面向
 * 「一条命令开一个、干完就收」,并把「脏就拒删 + 列现场」做进 drop。
 * 仓内落点不必走本脚本 —— 本脚本拒绝把检出开进仓库树内(那会把嵌套 .git 带进守门 208 的射程)。
 *
 * ## 纪律(全部是硬约束)
 *
 * - **绝不 force**:`git worktree remove` 不加 `--force`,`git branch -d` 不用 `-D`;
 *   全程没有 `reset --hard`、没有 `clean -f`、没有 stash。
 * - **脏就拒删**:drop 先读 `status --porcelain`,staged/unstaged/untracked/conflict 任一非零
 *   即 exit 1 并逐条列出前 50 条现场;量不到 status 也按拒删(fail-closed)。
 * - **不删未登记目录**:目标必须是 `git worktree list` 里已注册的检出;同名普通目录只报不删。
 * - **detached 拒删**:删除会丢掉 HEAD 的唯一引用,先转分支或打 `lost-commit/*` 保活。
 * - git 一律走 `scripts/lib/face-reader.mjs` 的 `gitRaw`(绝对路径 git + 显式 stdio + 超时,
 *   AGENTS §5b/§12g);仓根由脚本自身位置推导,不读 `process.cwd()`(§15)。
 *
 * ## 用法
 *
 *   node scripts/worktree-isolate.mjs new <slug> [--dest <目录>] [--branch <名>] [--base <ref>]
 *   node scripts/worktree-isolate.mjs drop <slug|绝对路径>
 *   node scripts/worktree-isolate.mjs list [--json]
 *   node scripts/worktree-isolate.mjs --self-test
 *
 * 退出码: 0 成功 / 1 拒绝或业务失败 / 2 用法错或无法判定。
 */
import { randomBytes } from 'node:crypto'
import { existsSync, mkdirSync, readFileSync, unlinkSync, writeFileSync } from 'node:fs'
import { basename, dirname, isAbsolute, join, parse, relative, resolve } from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'

import { gitRaw } from './lib/face-reader.mjs'
import { requireFlagValue } from './lib/flag-value.mjs'
import { mkScratch, rmScratch } from './lib/scratch-dir.mjs'
import { parseStatusPorcelain, parseWorktreePorcelain } from './check-worktree-status.mjs'

/** 仓根由脚本自身位置推导(§15:共享工作区 cwd 不可靠)。 */
export const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..')
export const EXIT_OK = 0
export const EXIT_REFUSED = 1
export const EXIT_UNKNOWN = 2

/** git 派生统一走取材层;非零折成 {ok,status} 三态,由调用方决定是拒还是判。 */
function git(args, { root = ROOT, allowFail = false, timeout = null } = {}) {
  try {
    // gitRaw 回吐原始 stdout;末尾换行必须剥掉 —— 否则 `rev-parse --show-toplevel` 的返回值
    // 拿去当下一个调用的 cwd 会变成非法路径(实测 ENOENT,而 Node 只点名 git.exe 误导排查)。
    // 只剥尾部换行,不动行首(porcelain 的 " M"/"MM" 首列是语义,不能用 trim)。
    const out = gitRaw(args, root, timeout ? { timeout } : {}).replace(/^\uFEFF/, '').replace(/[\r\n]+$/, '')
    return { ok: true, status: 0, out, err: '' }
  } catch (e) {
    const res = {
      ok: false,
      status: typeof e?.status === 'number' ? e.status : 1,
      out: '',
      err: String(e?.message ?? e),
    }
    if (allowFail) return res
    throw new Error(`git ${args.join(' ')} 失败:${res.err}`)
  }
}

/** slug 规范化:只留 [a-z0-9-];空/非法 ⇒ 抛(落点与分支名共用这一份规则)。 */
export function normalizeSlug(raw) {
  const n = String(raw ?? '')
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9-]+/g, '-')
    .replace(/^-+|-+$/g, '')
  if (!n) throw new Error('slug 不能为空(规范化后为空)')
  if (n.length > 30) throw new Error(`slug 过长(${n.length} > 30)`)
  return n
}

/** 默认落点 = 与仓根同盘根的 `<仓目录名>-wt-<slug>`(不写死盘符)。 */
export function defaultDest(repoRoot, slug) {
  const root = resolve(repoRoot)
  return join(parse(root).root, `${basename(root)}-wt-${normalizeSlug(slug)}`)
}

/** 分支名唯一后缀:`wt/<slug>-<YYYYMMDDHHmm>-<6hex>`。 */
export function makeBranch(slug, { now = Date.now(), suffix = null } = {}) {
  const d = new Date(now)
  const p = (n) => String(n).padStart(2, '0')
  const stamp = `${d.getFullYear()}${p(d.getMonth() + 1)}${p(d.getDate())}-${p(d.getHours())}${p(d.getMinutes())}`
  const hex = suffix ?? randomBytes(3).toString('hex')
  return `wt/${normalizeSlug(slug)}-${stamp}-${hex}`
}

/** 路径比较:Windows 大小写不敏感,按 resolve 后小写比。 */
export function samePath(a, b) {
  return resolve(String(a)).toLowerCase() === resolve(String(b)).toLowerCase()
}

/** child 是否严格落在 parent 目录之内(按路径分段,避免 `D:\x-y` 前缀误判)。 */
export function isInsidePath(child, parent) {
  const rel = relative(resolve(parent), resolve(child))
  return rel !== '' && !rel.startsWith('..') && !isAbsolute(rel)
}

/** `git worktree list` 的主树行印的是 gitdir(`D:/IHUI-AI-git-repo`),要穿回真实 toplevel。 */
function treePathOf(row, repoRoot) {
  const r = git(['rev-parse', '--show-toplevel'], { root: row.path, allowFail: true })
  if (r.ok && r.out) return r.out
  const fallback = git(['rev-parse', '--show-toplevel'], { root: repoRoot, allowFail: true })
  return fallback.ok && fallback.out ? fallback.out : row.path
}

function branchExists(repoRoot, branch) {
  return git(['show-ref', '--verify', '--quiet', `refs/heads/${branch}`], {
    root: repoRoot,
    allowFail: true,
  }).status === 0
}

/** 大仓检出/回收的派生超时:默认 60s 只够读,不够 1.8 万文件的 checkout(实测 60s 会在
 *  "Preparing worktree (new branch …)" 处被打断并留下 locked=initializing 的半成品)。
 * 15 分钟是上下界里的保守值;要更久可用 IHUI_GIT_TIMEOUT_MS 环境变量让 gitRaw 走调用方档。 */
const WORKTREE_HEAVY_TIMEOUT_MS = 900000

function registeredRows(repoRoot) {
  const r = git(['worktree', 'list', '--porcelain'], { root: repoRoot })
  return parseWorktreePorcelain(r.out)
}

/**
 * 开一棵隔离工作树。返回 `{exit, out[], path?, branch?}`;调用方只负责打印。
 * 所有拒绝分支都在**写入前**判定:目标已存在 / 已注册 / 在仓内 / 分支已占用 / 基线取不到。
 */
export function newWorktree({ repoRoot = ROOT, slug, dest = null, branch = null, base = 'HEAD' } = {}) {
  let name
  try {
    name = normalizeSlug(slug)
  } catch (e) {
    return { exit: EXIT_UNKNOWN, out: [`❌ ${e.message}`] }
  }
  const target = dest ? resolve(dest) : defaultDest(repoRoot, name)
  if (samePath(target, repoRoot) || isInsidePath(target, repoRoot)) {
    return {
      exit: EXIT_REFUSED,
      out: [
        `❌ 拒绝创建:目标在仓库树内(${target})。仓内检出请走 node scripts/agent-worktree.mjs --create <名> --apply;`,
        '   本工具只开仓外检出,避免把嵌套 .git 带进守门 208 的射程。',
      ],
    }
  }
  if (existsSync(target)) {
    return {
      exit: EXIT_REFUSED,
      out: [`❌ 拒绝创建:目标路径已存在 ${target}(换 --dest,或先确认它不是有用现场)`],
    }
  }
  const rows = registeredRows(repoRoot)
  if (rows.some((w) => samePath(w.path, target)) || rows.some((w) => samePath(treePathOf(w, repoRoot), target))) {
    return { exit: EXIT_REFUSED, out: [`❌ 拒绝创建:目标已是活动检出 ${target}`] }
  }
  const br = branch ? String(branch).trim() : makeBranch(name)
  if (branchExists(repoRoot, br)) {
    return {
      exit: EXIT_REFUSED,
      out: [`❌ 拒绝创建:分支已存在 ${br}(换 --branch,或先合并/删除该分支)`],
    }
  }
  if (rows.some((w) => w.branch === br)) {
    return { exit: EXIT_REFUSED, out: [`❌ 拒绝创建:分支已被其他检出占用 ${br}`] }
  }
  const baseRef = git(['rev-parse', '--verify', `${base}^{commit}`], { root: repoRoot, allowFail: true })
  if (!baseRef.ok || !baseRef.out) {
    return { exit: EXIT_REFUSED, out: [`❌ 拒绝创建:基线 ref 取不到(${base})`] }
  }
  const add = git(['worktree', 'add', '-b', br, target, base], {
    root: repoRoot,
    allowFail: true,
    timeout: WORKTREE_HEAVY_TIMEOUT_MS,
  })
  if (!add.ok) {
    const out = [`❌ 创建失败:${(add.err || 'git worktree add 非零退出').trim()}`]
    const after = registeredRows(repoRoot).find((w) => samePath(treePathOf(w, repoRoot), target))
    if (after && after.locked) {
      out.push(`⚠ ${target} 已被注册且仍是 locked(initializing):add 被中断后的半成品,不要当成品用。`)
      out.push(`   确认里面没有你的改动后按序收尾: git worktree unlock "${target}" → 删除该目录 → git worktree prune → git branch -d ${br}`)
      out.push('   本工具不自动删半成品(避免把"未完成"直接当"可丢")。')
    }
    return { exit: EXIT_REFUSED, out }
  }
  const real = git(['rev-parse', '--show-toplevel'], { root: target, allowFail: true })
  const realPath = real.ok && real.out ? real.out : target
  return {
    exit: EXIT_OK,
    path: realPath,
    branch: br,
    out: [
      '✅ 已创建隔离工作树',
      `   路径: ${realPath}`,
      `   分支: ${br}`,
      `   基线: ${base} (${baseRef.out.slice(0, 8)})`,
      `   进入: cd "${realPath}"`,
      `         PowerShell: Set-Location -LiteralPath "${realPath}"`,
      `   在树内提交: node scripts/isolated-git.mjs commit -m "<标题>" -- <相对路径...>`,
      `   收尾: node scripts/worktree-isolate.mjs drop "${realPath}"`,
      '   提示: 新树没有 node_modules / 构建产物;要跑全量门先在该树 pnpm install。',
    ],
  }
}

/**
 * 安全回收一棵隔离工作树。任何一项不干净就 exit 1 并列出清单;绝不 force。
 */
export function dropWorktree({ repoRoot = ROOT, target } = {}) {
  if (!target) return { exit: EXIT_UNKNOWN, out: ['❌ drop 需要一个 slug 或绝对路径'] }
  const looksPath = isAbsolute(target) || String(target).includes('/') || String(target).includes('\\')
  let path
  try {
    path = looksPath ? resolve(target) : defaultDest(repoRoot, String(target))
  } catch (e) {
    return { exit: EXIT_UNKNOWN, out: [`❌ ${e.message}`] }
  }
  if (samePath(path, repoRoot) || isInsidePath(path, repoRoot)) {
    return {
      exit: EXIT_REFUSED,
      out: [`❌ 拒绝删除:目标在主树或仓库树内(${path})。仓内检出按 AGENTS §12h 走 agent-worktree 生命周期。`],
    }
  }
  const rows = registeredRows(repoRoot)
  const entry =
    rows.find((w) => samePath(w.path, path)) || rows.find((w) => samePath(treePathOf(w, repoRoot), path))
  if (!entry) {
    return {
      exit: EXIT_REFUSED,
      out: [
        existsSync(path)
          ? `❌ 拒绝删除:${path} 存在但不是已注册的 worktree(本工具不删未登记目录)`
          : `❌ 拒绝删除:${path} 不存在,也未注册为 worktree`,
        '   可先跑 node scripts/worktree-isolate.mjs list 看看当前占用情况。',
      ],
    }
  }
  const realPath = treePathOf(entry, repoRoot)
  if (entry.locked) {
    return { exit: EXIT_REFUSED, out: [`❌ 拒绝删除:${realPath} 被 lock(先确认锁定方是否还在用)`] }
  }
  if (entry.detached || !entry.branch) {
    return {
      exit: EXIT_REFUSED,
      out: [
        `❌ 拒绝删除:${realPath} 是 detached 检出,删除会丢失 HEAD 的唯一引用。`,
        `   先把提交收进分支,或打保活标签: git tag lost-commit/worktree-<名>-${entry.head.slice(0, 7)} ${entry.head}`,
      ],
    }
  }
  const st = git(['status', '--porcelain'], { root: realPath, allowFail: true })
  if (!st.ok) {
    return { exit: EXIT_REFUSED, out: [`❌ 拒绝删除:读不到 ${realPath} 的 status(${st.err.trim()})`] }
  }
  const c = parseStatusPorcelain(st.out)
  const dirty = c.staged + c.unstaged + c.untracked + c.conflicts
  if (dirty > 0) {
    const lines = st.out.split(/\r?\n/).filter(Boolean)
    const out = [
      `❌ 拒绝删除:工作区还有未提交内容(staged=${c.staged} unstaged=${c.unstaged} untracked=${c.untracked} conflict=${c.conflicts})`,
      `   现场清单(前 ${Math.min(50, lines.length)} 条,共 ${lines.length} 条):`,
    ]
    for (const line of lines.slice(0, 50)) out.push(`   ${line}`)
    if (lines.length > 50) out.push(`   … 其余 ${lines.length - 50} 条略`)
    out.push('   先提交/迁移或明确放弃这些改动再 drop(本工具绝不 force / clean -f)。')
    return { exit: EXIT_REFUSED, out }
  }
  const merged = git(['merge-base', '--is-ancestor', entry.branch, 'HEAD'], {
    root: repoRoot,
    allowFail: true,
  }).ok
  const rm = git(['worktree', 'remove', realPath], {
    root: repoRoot,
    allowFail: true,
    timeout: WORKTREE_HEAVY_TIMEOUT_MS,
  })
  if (!rm.ok) {
    return {
      exit: EXIT_REFUSED,
      out: [`❌ 移除失败:${(rm.err || 'git worktree remove 非零退出').trim()}`, '   未加 --force,失败即停手;现场原样保留。'],
    }
  }
  git(['worktree', 'prune'], { root: repoRoot, allowFail: true })
  const out = [`✅ 已移除 ${realPath}`]
  let branchDeleted = false
  if (merged) {
    const del = git(['branch', '-d', entry.branch], { root: repoRoot, allowFail: true })
    branchDeleted = del.ok
    out.push(
      del.ok
        ? `   分支 ${entry.branch} 已并入 HEAD,已用 git branch -d 删除`
        : `   分支 ${entry.branch} 未删(${(del.err || 'git branch -d 拒绝').trim().split('\n')[0]})`,
    )
  } else {
    out.push(`   分支 ${entry.branch} 未并入 HEAD,已保留(无 force、无 -D;合并后再删)`)
  }
  return { exit: EXIT_OK, path: realPath, branch: entry.branch, branchDeleted, out }
}

/**
 * 列全部工作树 + 脏度。计数口径与门 281 同一实现(`parseStatusPorcelain`),
 * 所以这里的读数与 `check-worktree-status.mjs` 逐字段可比。
 */
export function listWorktrees({ repoRoot = ROOT } = {}) {
  const rows = registeredRows(repoRoot)
  const trees = rows.map((row, i) => {
    const path = treePathOf(row, repoRoot)
    const st = git(['status', '--porcelain'], { root: path, allowFail: true })
    return {
      path,
      branch: row.detached ? '(detached)' : row.branch || '(unknown)',
      head: row.head ? row.head.slice(0, 8) : '',
      locked: row.locked,
      isMain: i === 0,
      measured: st.ok,
      counts: st.ok ? parseStatusPorcelain(st.out) : { staged: 0, unstaged: 0, untracked: 0, conflicts: 0 },
    }
  })
  const out = []
  for (const t of trees) {
    const c = t.counts
    const dirty = t.measured && c.staged + c.unstaged + c.untracked + c.conflicts > 0
    out.push(
      `[wt] ${t.path} | ${t.branch} | ${t.head || '-'} | ` +
        (t.measured
          ? `staged=${c.staged} unstaged=${c.unstaged} untracked=${c.untracked}` +
            `${c.conflicts ? ` conflict=${c.conflicts}` : ''}`
          : '未判定(status 读不到)') +
        ` | ${t.isMain ? '主树 ' : ''}${t.locked ? 'LOCKED ' : ''}${dirty ? 'DIRTY' : t.measured ? 'clean' : 'UNDETERMINED'}`,
    )
  }
  const dirtyCount = trees.filter(
    (t) => t.measured && t.counts.staged + t.counts.unstaged + t.counts.untracked + t.counts.conflicts > 0,
  ).length
  out.push(`总计 ${trees.length} 棵工作树 | 脏 ${dirtyCount} 棵 | 干净 ${trees.length - dirtyCount} 棵`)
  // 列是"读现场"的动作,脏不脏不影响它成功与否;只有量不到 status 才是未判定(exit 2)。
  return { exit: trees.some((t) => !t.measured) ? EXIT_UNKNOWN : EXIT_OK, trees, out }
}

/** 自检:全部落在 mkScratch 夹具仓内,不碰真实仓的任何 worktree。 */
async function selfTest() {
  const checks = []
  const ok = (name, cond, reading) => {
    checks.push({ name, pass: Boolean(cond), reading })
    if (!cond) throw new Error(`self-test 失败:${name}(${reading})`)
  }
  const realRowsBefore = registeredRows(ROOT).length
  const dir = mkScratch('worktree-isolate-')
  try {
    const repo = join(dir, 'repo')
    mkdirSync(repo)
    git(['init', '-q', '-b', 'main'], { root: repo })
    git(['config', 'user.email', 'self-test@ihui.invalid'], { root: repo })
    git(['config', 'user.name', 'ihui worktree self-test'], { root: repo })
    writeFileSync(join(repo, 'a.txt'), 'init\n', 'utf8')
    git(['add', '--', 'a.txt'], { root: repo })
    git(['commit', '-q', '-m', 'init'], { root: repo })

    // A 开:干净目录 + 唯一分支,落点在夹具仓之外
    const cleanDest = join(dir, 'wt-clean')
    const a = newWorktree({ repoRoot: repo, slug: 'clean', dest: cleanDest })
    ok(
      'A 开(干净)',
      a.exit === EXIT_OK && existsSync(cleanDest),
      `exit=${a.exit} path=${a.path} branch=${a.branch}`,
    )

    // 列表:2 棵树(夹具主树 + 新检出),新树 clean
    const listA = listWorktrees({ repoRoot: repo })
    ok(
      'A 列(2 棵)',
      listA.trees.length === 2 && listA.out.some((l) => l.includes('wt-clean') && l.includes('clean')),
      `trees=${listA.trees.length} exit=${listA.exit}`,
    )

    // B 脏拒删:1 个 tracked 改动 + 1 个未跟踪文件
    const originalA = readFileSync(join(cleanDest, 'a.txt'))
    writeFileSync(join(cleanDest, 'a.txt'), 'dirty\n', 'utf8')
    writeFileSync(join(cleanDest, 'dirty.txt'), 'x\n', 'utf8')
    const b = dropWorktree({ repoRoot: repo, target: cleanDest })
    ok(
      'B 脏拒删',
      b.exit === EXIT_REFUSED && b.out.some((l) => l.includes('unstaged=1')) && b.out.some((l) => l.includes('untracked=1')),
      `exit=${b.exit} ${b.out[0]}`,
    )

    // B2 干净可删:按原字节复原 tracked 文件、删掉未跟踪文件后再收
    writeFileSync(join(cleanDest, 'a.txt'), originalA)
    unlinkSync(join(cleanDest, 'dirty.txt'))
    const b2 = dropWorktree({ repoRoot: repo, target: cleanDest })
    const branches = git(['branch', '--list', a.branch], { root: repo, allowFail: true }).out.trim()
    ok(
      'B2 干净可删',
      b2.exit === EXIT_OK && !existsSync(cleanDest) && branches === '' && b2.branchDeleted === true,
      `exit=${b2.exit} removed=${!existsSync(cleanDest)} branchGone=${branches === ''} out=${b2.out.join(' / ')}`,
    )

    // C 路径不存在
    const c = dropWorktree({ repoRoot: repo, target: join(dir, 'wt-ghost') })
    ok('C 路径不存在', c.exit === EXIT_REFUSED, `exit=${c.exit} ${c.out[0]}`)

    // D 同名冲突:同名目录已存在(非 worktree)
    const dupDest = join(dir, 'wt-dup')
    mkdirSync(dupDest)
    const d = newWorktree({ repoRoot: repo, slug: 'dup', dest: dupDest })
    ok('D 同名冲突', d.exit === EXIT_REFUSED && d.out.some((l) => l.includes('已存在')), `exit=${d.exit} ${d.out[0]}`)

    // E 已占用分支
    git(['branch', 'wt/taken'], { root: repo })
    const e = newWorktree({ repoRoot: repo, slug: 'taken-occ', dest: join(dir, 'wt-taken'), branch: 'wt/taken' })
    ok('E 已占用分支', e.exit === EXIT_REFUSED && e.out.some((l) => l.includes('分支已存在')), `exit=${e.exit} ${e.out[0]}`)

    const realRowsAfter = registeredRows(ROOT).length
    const leaked = registeredRows(ROOT).filter((r) => samePath(r.path, dir) || isInsidePath(r.path, dir))
    ok(
      'F 零真实仓足迹',
      leaked.length === 0,
      `真实仓 worktree 数 ${realRowsBefore}→${realRowsAfter}(本自检未新增真实检出)`,
    )

    console.log('[self-test] 逐项实测读数:')
    for (const c of checks) console.log(`  ✅ ${c.name} | ${c.reading}`)
    console.log(`self-test: 全绿(${checks.length} 组断言,全部落在 mkScratch 夹具内)`)
    return EXIT_OK
  } finally {
    rmScratch(dir, { bestEffort: true })
  }
}

function usage() {
  console.error(
    '用法: new <slug> [--dest <目录>] [--branch <名>] [--base <ref>] | drop <slug|绝对路径> | list [--json] | --self-test',
  )
  return EXIT_UNKNOWN
}

async function main(argv) {
  if (argv.includes('--self-test')) return selfTest()
  const cmd = argv[0]
  if (cmd === 'new') {
    const slug = argv[1] && !String(argv[1]).startsWith('-') ? argv[1] : null
    if (!slug) return usage()
    const dest = requireFlagValue(argv, '--dest', { noun: '目录' })
    const branch = requireFlagValue(argv, '--branch', { noun: '分支名' })
    const base = requireFlagValue(argv, '--base', { noun: 'git ref', fallback: 'HEAD' })
    for (const f of [dest, branch, base]) {
      if (f.error) {
        console.error(`❌ ${f.error}`)
        return EXIT_UNKNOWN
      }
    }
    const r = newWorktree({ slug, dest: dest.value, branch: branch.value, base: base.value })
    for (const l of r.out) console.log(l)
    return r.exit
  }
  if (cmd === 'drop') {
    const target = argv[1] && !String(argv[1]).startsWith('-') ? argv[1] : null
    if (!target) return usage()
    const r = dropWorktree({ target })
    for (const l of r.out) console.log(l)
    return r.exit
  }
  if (cmd === 'list') {
    const r = listWorktrees()
    if (argv.includes('--json')) console.log(JSON.stringify({ trees: r.trees, exit: r.exit }, null, 2))
    else for (const l of r.out) console.log(l)
    return r.exit
  }
  return usage()
}

export const __test__ = {
  normalizeSlug,
  defaultDest,
  makeBranch,
  samePath,
  isInsidePath,
  newWorktree,
  dropWorktree,
  listWorktrees,
}

const isDirectRun = process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href
if (isDirectRun) {
  main(process.argv.slice(2))
    .then((code) => {
      process.exitCode = code
    })
    .catch((e) => {
      console.error(`❌ ${e?.message ?? e}\n${e?.stack ?? ''}`)
      process.exitCode = EXIT_UNKNOWN
    })
}
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
