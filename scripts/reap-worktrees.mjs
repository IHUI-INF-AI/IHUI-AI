#!/usr/bin/env node
// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * worktree 生命周期自动回收器(2026-10-21 立,机主令「彻底根治 worktree 完毕不清理/不合并/不提交」)。
 *
 * 立因(现读):登记面里同时挂着 7 个已完成检出 —— 6 个 detached、1 个已并入 main 的分支,
 * 最早的悬了数天;其中 2 个还带未提交改动。全部 HEAD 都是 main 祖先,即「活早就干完了,
 * 只是没人收」。同类残留此前已进过 `.ihui-agent/archive` 两次,说明靠人记得关永远兜不住。
 *
 * 判据(结构边界写死在这里,改判据前先想清楚):
 *   ① 主工作树(porcelain 第一条)永不回收 —— 这是 git 契约,与盘符/是否 detached 无关;
 *   ② **已并入 main** 是自动回收的唯一前提(`git merge-base --is-ancestor <HEAD> main`);
 *   ③ 已并入 + 工作区干净 + 空闲 ≥ TTL(默认 6h)⇒ 直接 remove + prune;
 *   ④ 已并入 + 有未提交改动 + 空闲 ≥ dirtyTTL(默认 24h)⇒ **先备份**(`git diff --binary HEAD`
 *      + 未跟踪文件原样拷贝 + 状态清单)到 `.ihui-agent/tmp/worktree-reap-backup/<时间戳>/<名>/`,
 *      备份成功才 remove;备份超上限/失败 ⇒ 本轮不删,点名待人工;
 *   ⑤ **有独有提交(未并入 main)绝不静默删**:先打带注释标签 `lost-commit/worktree-<名>-<sha7>`
 *      保活并点名;空闲 ≥ unmergedTTL(默认 72h)时,干净的直接回收检出(分支与标签都留着,
 *      随时可合),有改动的先按 ④ 备份再回收。**自动 merge 永远不做** —— 会绕过提交链守门,
 *      而且"合不合、怎么合"是人的裁决;本档的职责是让残留既不会静默消失,也不会无限占着登记面。
 *
 * 空闲判据取 max(admin 目录 birthtime / index mtime / HEAD reflog mtime / 最后一条 reflog 时间戳 /
 * 检出根目录 mtime):它们覆盖 checkout、commit、reset、add 这些"有人在动"的动作;
 * 有文件在写(未 add)时会先落进 ④ 的 dirty 档,不会被 ③ 误删。
 *
 * 调度:不进提交链(判机器状态,§12e),由计划任务 **IHUI-Worktree-Reap**
 * (`scripts/install-worktree-reap-task.ps1` 注册,每 10 分钟,S4U + wscript 包装零弹窗)
 * 无人值守执行;也可人工 `node scripts/reap-worktrees.mjs` 预览。运行台账落在
 * `.workbuddy/worktree-reap.log`(JSONL,>2MB 轮转一次),因为计划任务没有控制台。
 *
 * 用法:
 *   node scripts/reap-worktrees.mjs                  # 只读预览(默认不删任何东西)
 *   node scripts/reap-worktrees.mjs --auto           # 按上面 ③④⑤ 执行
 *   node scripts/reap-worktrees.mjs --auto --json    # 机器消费面(守护用)
 *   node scripts/reap-worktrees.mjs --ttl-hours 0 --dirty-ttl-hours 0 --backup-dir <dir>  # 测试/立即收
 *   node scripts/reap-worktrees.mjs --strict         # 有未合并/失败项时 exit 1
 */
/* CLI 工具,诊断输出就是它的产品(与其余 scripts/* CLI 一致)。 */
import { execFileSync } from 'node:child_process'
import { appendFileSync, copyFileSync, existsSync, mkdirSync, renameSync, rmSync, statSync, writeFileSync } from 'node:fs'
import { basename, dirname, join, resolve, sep } from 'node:path'
import { fileURLToPath } from 'node:url'

const HERE = dirname(fileURLToPath(import.meta.url))
const DEFAULT_REPO = resolve(HERE, '..')
const GIT_TIMEOUT_MS = Number(process.env.IHUI_WORKTREE_REAP_GIT_TIMEOUT_MS || 120_000)
const BACKUP_CAP_BYTES = Number(
  process.env.IHUI_WORKTREE_REAP_BACKUP_CAP_BYTES || 200 * 1024 * 1024,
)

/** 单次 git 派生。只读/写动作都要封顶(守门 80 同口径),且不吃 stdin(本机 EBUSY 实测)。 */
function git(repo, args, { allowFail = false } = {}) {
  try {
    const out = execFileSync('git', ['-C', repo, ...args], {
      encoding: 'utf8',
      windowsHide: true,
      stdio: ['ignore', 'pipe', 'pipe'],
      timeout: GIT_TIMEOUT_MS,
      maxBuffer: 64 * 1024 * 1024,
    })
    return { ok: true, out: String(out).replace(/\s+$/, '') }
  } catch (e) {
    if (!allowFail) throw e
    return {
      ok: false,
      out: String(e.stdout || ''),
      err: String(e.stderr || e.message || e),
    }
  }
}

/**
 * 解析 `git worktree list --porcelain`。第一条 = 主工作树(git 契约,调用方必须豁免)。
 * 返回 [{ path, head, branch, detached, prunable, isMain }]。
 */
export function parseWorktreePorcelain(text) {
  const blocks = String(text || '')
    .split(/\n\s*\n/)
    .map((b) => b.trim())
    .filter((b) => b.length > 0)
  const out = []
  for (const block of blocks) {
    const path = block.match(/^worktree\s+(.+)$/m)?.[1]?.trim()
    if (!path) continue
    const head = block.match(/^HEAD\s+(.+)$/m)?.[1]?.trim() || ''
    const branchRef = block.match(/^branch\s+(.+)$/m)?.[1]?.trim() || ''
    out.push({
      path,
      head,
      branch: branchRef,
      detached: !branchRef,
      prunable: /prunable/i.test(block),
      isMain: out.length === 0,
    })
  }
  return out
}

function statMtime(p) {
  try {
    const s = statSync(p)
    return Math.max(s.mtimeMs || 0, s.birthtimeMs || 0)
  } catch {
    return 0
  }
}

/** 空闲时长:见文件头判据说明;取不到任何读数 ⇒ 0(当作在用,不删)。 */
function idleMsOf(wtPath, adminDir, now) {
  const marks = [statMtime(wtPath), statMtime(adminDir)]
  if (adminDir) {
    marks.push(statMtime(join(adminDir, 'index')))
    marks.push(statMtime(join(adminDir, 'logs', 'HEAD')))
  }
  const reflog = git(wtPath, ['reflog', '-1', '--format=%ct'], { allowFail: true })
  if (reflog.ok && reflog.out) {
    const sec = Number(reflog.out)
    if (Number.isFinite(sec) && sec > 0) marks.push(sec * 1000)
  }
  const newest = Math.max(...marks)
  return newest > 0 ? Math.max(0, now - newest) : 0
}

function adminDirOf(wtPath) {
  const r = git(wtPath, ['rev-parse', '--git-dir'], { allowFail: true })
  if (!r.ok || !r.out) return null
  return resolve(wtPath, r.out)
}

/** 工作区是否干净(含未跟踪;--porcelain 天然排除 ignored 的 node_modules 等)。 */
function statusOf(wtPath) {
  const r = git(wtPath, ['status', '--porcelain'], { allowFail: true })
  return r.ok ? r.out : null
}

/**
 * 备份未提交现场:tracked.patch(diff --binary HEAD,含已暂存)+ untracked/ 原样文件 + status.txt
 * + manifest.json。超过上限 ⇒ 返回 ok:false,调用方必须放弃回收(宁留残骸不丢数据)。
 */
function backupDirty(wtPath, destDir, meta) {
  const statusText = statusOf(wtPath) || ''
  mkdirSync(destDir, { recursive: true })
  const diff = git(wtPath, ['diff', '--binary', 'HEAD', '--'], { allowFail: true })
  if (!diff.ok) return { ok: false, reason: 'git diff 取不到,放弃回收(宁留检出不丢改动)' }
  writeFileSync(join(destDir, 'tracked.patch'), diff.out, 'utf8')
  writeFileSync(join(destDir, 'status.txt'), statusText, 'utf8')

  const ls = git(wtPath, ['ls-files', '--others', '--exclude-standard', '-z'], { allowFail: true })
  if (!ls.ok) return { ok: false, reason: '未跟踪清单取不到,放弃回收(宁留检出不丢改动)' }
  const untracked = ls.out.split('\0').filter((rel) => rel.length > 0)
  let bytes = 0
  const copied = []
  for (const rel of untracked) {
    const src = join(wtPath, rel)
    let st
    try {
      st = statSync(src)
    } catch {
      continue
    }
    if (!st.isFile()) continue
    bytes += st.size
    if (bytes > BACKUP_CAP_BYTES) {
      return { ok: false, reason: `未跟踪文件备份超过上限 ${BACKUP_CAP_BYTES} 字节,放弃回收` }
    }
    const dst = join(destDir, 'untracked', rel)
    mkdirSync(dirname(dst), { recursive: true })
    copyFileSync(src, dst)
    copied.push(rel)
  }
  writeFileSync(
    join(destDir, 'manifest.json'),
    JSON.stringify(
      { ...meta, backedUpAt: new Date().toISOString(), untracked, bytes, statusText },
      null,
      2,
    ),
    'utf8',
  )
  return { ok: true, dir: destDir, bytes, untrackedCount: copied.length }
}

/** 回收单个检出:git worktree remove --force,失败 fallback 删目录 + prune。 */
function removeWorktree(repo, wtPath) {
  const r = git(repo, ['worktree', 'remove', '--force', wtPath], { allowFail: true })
  if (r.ok || !existsSync(wtPath)) return { ok: true, how: 'git worktree remove' }
  try {
    rmSync(wtPath, { recursive: true, force: true })
  } catch (e) {
    return { ok: false, err: String((e && e.message) || e).slice(0, 200) }
  }
  git(repo, ['worktree', 'prune'], { allowFail: true })
  return existsSync(wtPath)
    ? { ok: false, err: '目录仍被占用(worktree remove 与 rm -rf 均失败)' }
    : { ok: true, how: 'rm -rf + prune' }
}

/** 未合并保活:带注释标签,删检出后提交仍可达(§22 lost-commit 同族)。 */
function tagUnmerged(repo, name, head, wtPath, ahead) {
  if (!head) return null
  const safe = String(name || basename(wtPath))
    .replace(/[^A-Za-z0-9._-]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 40)
  const tag = `lost-commit/worktree-${safe || 'wt'}-${head.slice(0, 7)}`
  const exists = git(repo, ['rev-parse', '--verify', '--quiet', `refs/tags/${tag}`], {
    allowFail: true,
  })
  if (exists.ok) return tag
  const msg = `worktree 未合并保活:${wtPath}\nHEAD=${head}\nahead=${ahead}\n由 scripts/reap-worktrees.mjs 自动打标;合并或裁决前不得删除。`
  const r = git(repo, ['tag', '-a', tag, head, '-m', msg], { allowFail: true })
  return r.ok ? tag : null
}

function deleteMergedBranch(repo, branchRef) {
  const name = String(branchRef || '').replace(/^refs\/heads\//, '')
  if (!name || name === 'main') return false
  // -d 自带"未合并即拒绝"闸,不用 -D:自动回收器没有裁决权
  return git(repo, ['branch', '-d', name], { allowFail: true }).ok
}

function parseArgs(argv) {
  const opts = {
    repo: DEFAULT_REPO,
    auto: false,
    json: false,
    strict: false,
    ttlHours: Number(process.env.IHUI_WORKTREE_TTL_H || 6),
    dirtyTtlHours: Number(process.env.IHUI_WORKTREE_DIRTY_TTL_H || 24),
    unmergedTtlHours: Number(process.env.IHUI_WORKTREE_UNMERGED_TTL_H || 72),
    backupDir: join(DEFAULT_REPO, '.ihui-agent', 'tmp', 'worktree-reap-backup'),
    logPath: '',
    help: false,
  }
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i]
    if (a === '--auto') opts.auto = true
    else if (a === '--json') opts.json = true
    else if (a === '--strict') opts.strict = true
    else if (a === '--help' || a === '-h') opts.help = true
    else if (a === '--repo') opts.repo = resolve(argv[++i] || '')
    else if (a === '--ttl-hours') opts.ttlHours = Number(argv[++i])
    else if (a === '--dirty-ttl-hours') opts.dirtyTtlHours = Number(argv[++i])
    else if (a === '--unmerged-ttl-hours') opts.unmergedTtlHours = Number(argv[++i])
    else if (a === '--backup-dir') opts.backupDir = resolve(argv[++i] || '')
    else if (a === '--log') opts.logPath = resolve(argv[++i] || '')
    else if (a.startsWith('--repo=')) opts.repo = resolve(a.slice(7))
    else if (a.startsWith('--ttl-hours=')) opts.ttlHours = Number(a.slice(12))
    else if (a.startsWith('--dirty-ttl-hours=')) opts.dirtyTtlHours = Number(a.slice(18))
    else if (a.startsWith('--unmerged-ttl-hours=')) opts.unmergedTtlHours = Number(a.slice(21))
    else if (a.startsWith('--backup-dir=')) opts.backupDir = resolve(a.slice(13))
    else if (a.startsWith('--log=')) opts.logPath = resolve(a.slice(6))
    else throw new Error(`未知参数: ${a}`)
  }
  if (!Number.isFinite(opts.ttlHours) || opts.ttlHours < 0) throw new Error('--ttl-hours 必须 ≥0')
  if (!Number.isFinite(opts.dirtyTtlHours) || opts.dirtyTtlHours < 0)
    throw new Error('--dirty-ttl-hours 必须 ≥0')
  if (!Number.isFinite(opts.unmergedTtlHours) || opts.unmergedTtlHours < 0)
    throw new Error('--unmerged-ttl-hours 必须 ≥0')
  return opts
}

const HELP = `用法: node scripts/reap-worktrees.mjs [--auto] [--json] [--strict]
       [--repo <path>] [--ttl-hours <n>] [--dirty-ttl-hours <n>] [--unmerged-ttl-hours <n>] [--backup-dir <path>] [--log <path>]

  --auto             执行回收(默认只读预览)
  --json             只输出 JSON(守护消费面)
  --strict           有未合并/失败项时 exit 1
  --ttl-hours        已并入 main 且干净的空闲阈值(默认 6,env IHUI_WORKTREE_TTL_H)
  --dirty-ttl-hours  已并入 main 但有未提交改动的空闲阈值(默认 24,先备份再回收)
  --unmerged-ttl-hours 未并入 main 的检出:先打 lost-commit 标签,空闲到阈值(默认 72)才回收
  --log              JSONL 运行台账(计划任务无控制台时靠它留痕;>2MB 自动轮转一次)
`

function fmtHours(ms) {
  return `${(ms / 3600000).toFixed(1)}h`
}

/** 计划任务没有控制台:把每轮结论追加成一行 JSONL,>2MB 轮转一次;日志失败不改变回收结论。 */
function appendRunLog(logPath, result) {
  if (!logPath) return
  try {
    mkdirSync(dirname(logPath), { recursive: true })
    try {
      if (statSync(logPath).size > 2 * 1024 * 1024) {
        rmSync(logPath + '.1', { force: true })
        renameSync(logPath, logPath + '.1')
      }
    } catch {
      /* 首次运行或轮转失败都继续追加 */
    }
    appendFileSync(logPath, JSON.stringify({ at: new Date().toISOString(), ...result }) + '\n', 'utf8')
  } catch {
    /* 台账写不下去只影响留痕,不影响已做的回收 */
  }
}

function main() {
  let opts
  try {
    opts = parseArgs(process.argv.slice(2))
  } catch (e) {
    console.error(String((e && e.message) || e))
    console.error(HELP)
    process.exit(2)
  }
  if (opts.help) {
    console.log(HELP)
    return
  }

  const repo = opts.repo
  if (!existsSync(join(repo, '.git'))) {
    console.error(`[reap-worktrees] 不是 git 仓库: ${repo}`)
    process.exit(2)
  }

  const porcelain = git(repo, ['worktree', 'list', '--porcelain'])
  if (!porcelain.ok) {
    console.error('[reap-worktrees] git worktree list 取不到,本轮不判(不冒绿也不冒红)')
    process.exit(2)
  }
  const entries = parseWorktreePorcelain(porcelain.out)
  const mainPath = entries[0]?.path ? resolve(entries[0].path) : null
  const now = Date.now()
  const cwd = resolve(process.cwd())
  const stamp = new Date(now).toISOString().replace(/[:.]/g, '-')

  const result = {
    repo,
    scanned: Math.max(0, entries.length - 1),
    reaped: [],
    backedUp: [],
    preserved: [],
    unmerged: [],
    skipped: [],
    failed: [],
    pruned: 0,
    prunedBranches: [],
  }
  let needPrune = false

  for (const e of entries) {
    if (e.isMain) continue
    const wtPath = resolve(e.path)
    if (mainPath && wtPath === mainPath) continue
    if (e.prunable || !existsSync(wtPath)) {
      needPrune = true
      result.skipped.push({ path: wtPath, reason: 'prunable(目录已不在,交给 prune)' })
      continue
    }
    if (cwd === wtPath || cwd.startsWith(wtPath + sep)) {
      result.skipped.push({ path: wtPath, reason: '当前进程 cwd 在该检出内' })
      continue
    }

    const adminDir = adminDirOf(wtPath)
    const idleMs = idleMsOf(wtPath, adminDir, now)
    const statusText = statusOf(wtPath)
    if (statusText === null) {
      result.failed.push({ path: wtPath, reason: 'git status 取不到,未判定' })
      continue
    }
    const dirty = statusText.length > 0
    const merged = e.head
      ? git(repo, ['merge-base', '--is-ancestor', e.head, 'refs/heads/main'], { allowFail: true }).ok
      : false

    if (!merged) {
      const ahead = e.head
        ? Number(git(repo, ['rev-list', '--count', `refs/heads/main..${e.head}`], { allowFail: true }).out || 0)
        : 0
      const shortBranch = String(e.branch || '').replace(/^refs\/heads\//, '')
      const unmergedTtlMs = opts.unmergedTtlHours * 3600000
      const due = idleMs >= unmergedTtlMs
      let tag = null
      if (opts.auto) tag = tagUnmerged(repo, shortBranch || basename(wtPath), e.head, wtPath, ahead)
      if (!opts.auto || !due || !tag) {
        result.unmerged.push({
          path: wtPath,
          branch: e.branch || null,
          head: e.head,
          ahead,
          tag,
          due,
          note: !opts.auto
            ? `有独有提交,预览不删;空闲 ${fmtHours(idleMs)}${due ? ',已达回收阈值' : ''}`
            : !tag
              ? '未合并且打标失败,本轮不回收(宁留检出不丢提交)'
              : `有独有提交,已打 ${tag} 保活;空闲 ${fmtHours(idleMs)} < ${opts.unmergedTtlHours}h,保留待合并`,
        })
        continue
      }
      // 未合并但已打标 + 空闲到期:提交已由标签封缄,分支原样保留,检出可以撤了。
      let backupInfo = null
      if (dirty) {
        const name = basename(wtPath)
        const dest = join(opts.backupDir, stamp, name)
        const bk = backupDirty(wtPath, dest, { path: wtPath, branch: e.branch || null, head: e.head })
        if (!bk.ok) {
          result.failed.push({ path: wtPath, reason: bk.reason })
          continue
        }
        backupInfo = { backupDir: dest, untrackedCount: bk.untrackedCount, bytes: bk.bytes }
      }
      const rm = removeWorktree(repo, wtPath)
      if (!rm.ok) {
        result.failed.push({
          path: wtPath,
          reason: `${rm.err}${backupInfo ? `(备份已在 ${backupInfo.backupDir})` : ''}`,
        })
        continue
      }
      result.preserved.push({
        path: wtPath,
        branch: e.branch || null,
        head: e.head,
        ahead,
        tag,
        idleMs,
        backupDir: backupInfo?.backupDir || null,
        note: '有独有提交:已打 lost-commit 标签保活,检出已回收;分支与标签保留,可随时合并',
      })
      continue
    }

    const ttlMs = opts.ttlHours * 3600000
    if (!dirty) {
      if (idleMs < ttlMs) {
        result.skipped.push({ path: wtPath, reason: `已并入 main 且干净,空闲 ${fmtHours(idleMs)} < ${opts.ttlHours}h` })
        continue
      }
      if (!opts.auto) {
        result.reaped.push({ path: wtPath, branch: e.branch || null, idleMs, planned: true })
        continue
      }
      const rm = removeWorktree(repo, wtPath)
      if (!rm.ok) {
        result.failed.push({ path: wtPath, reason: rm.err })
        continue
      }
      result.reaped.push({ path: wtPath, branch: e.branch || null, idleMs, how: rm.how })
      if (e.branch && deleteMergedBranch(repo, e.branch)) {
        result.prunedBranches.push(e.branch)
      }
      continue
    }

    // dirty + merged
    if (idleMs < opts.dirtyTtlHours * 3600000) {
      result.skipped.push({
        path: wtPath,
        reason: `已并入 main 但有未提交改动,空闲 ${fmtHours(idleMs)} < ${opts.dirtyTtlHours}h`,
      })
      continue
    }
    if (!opts.auto) {
      result.backedUp.push({ path: wtPath, idleMs, planned: true })
      continue
    }
    const name = basename(wtPath)
    const dest = join(opts.backupDir, stamp, name)
    const bk = backupDirty(wtPath, dest, {
      path: wtPath,
      branch: e.branch || null,
      head: e.head,
    })
    if (!bk.ok) {
      result.failed.push({ path: wtPath, reason: bk.reason })
      continue
    }
    const rm = removeWorktree(repo, wtPath)
    if (!rm.ok) {
      result.failed.push({ path: wtPath, reason: `${rm.err}(备份已在 ${dest})` })
      continue
    }
    result.backedUp.push({
      path: wtPath,
      branch: e.branch || null,
      idleMs,
      backupDir: dest,
      untrackedCount: bk.untrackedCount,
      bytes: bk.bytes,
    })
    if (e.branch && deleteMergedBranch(repo, e.branch)) {
      result.prunedBranches.push(e.branch)
    }
  }

  if (needPrune) {
    const pr = git(repo, ['worktree', 'prune'], { allowFail: true })
    if (pr.ok) result.pruned = 1
  }

  appendRunLog(opts.logPath, result)

  if (opts.json) {
    console.log(JSON.stringify(result, null, 2))
  } else {
    console.log(`🧹 worktree 生命周期回收 @ ${repo}`)
    console.log(
      `读数:扫描 ${result.scanned} / 回收 ${result.reaped.length} / 备份后回收 ${result.backedUp.length} / 保活回收 ${result.preserved.length} / 未合并保留 ${result.unmerged.length} / 保留 ${result.skipped.length} / 失败 ${result.failed.length}` +
        (opts.auto ? '' : ' · 预览模式(未执行任何删除)'),
    )
    for (const r of result.reaped)
      console.log(`  ✅ 回收 ${r.path}${r.branch ? ` [${r.branch}]` : ''} — 空闲 ${fmtHours(r.idleMs)}${r.how ? `,${r.how}` : ''}`)
    for (const r of result.preserved)
      console.log(
        `  🛟 打标保活后回收 ${r.path}${r.branch ? ` [${r.branch}]` : ''} — ahead ${r.ahead},空闲 ${fmtHours(r.idleMs)},标签 ${r.tag}` +
          (r.backupDir ? `,改动备份 ${r.backupDir}` : '') +
          ';分支与标签保留,可随时合并',
      )
    for (const r of result.backedUp)
      console.log(
        `  🗄 备份后回收 ${r.path} — 空闲 ${fmtHours(r.idleMs)}` +
          (r.backupDir ? `,备份 ${r.backupDir}(未跟踪 ${r.untrackedCount} 个)` : ''),
      )
    for (const r of result.unmerged)
      console.log(
        `  ⚠️ 未合并保留 ${r.path}${r.branch ? ` [${r.branch}]` : ''} — ahead ${r.ahead}` +
          (r.tag ? `,已打标 ${r.tag}` : ',自动打标失败(须人工保活)'),
      )
    for (const r of result.skipped) console.log(`  ⏭ 保留 ${r.path} — ${r.reason}`)
    for (const r of result.failed) console.log(`  ❌ 失败 ${r.path} — ${r.reason}`)
    if (result.prunedBranches.length) console.log(`  🌿 删除已并入分支:${result.prunedBranches.join(', ')}`)
  }

  if (opts.strict && (result.unmerged.length > 0 || result.failed.length > 0)) process.exit(1)
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  try {
    main()
  } catch (e) {
    console.error('[reap-worktrees] ' + String((e && e.message) || e))
    process.exit(2)
  }
}
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
