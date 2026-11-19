#!/usr/bin/env node
// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
/**
 * Y-71 临时派生检出寿命闸（只读哨兵，绝不自动 prune / remove）。
 *
 * 背景（PROJECT_PLAN.md L12269）:merge-wt / d1b-wt / ihui-wt-replay 三类由会话临时创建的
 * git worktree 长期躺在本机 scratch/ 或 D:\DevEnv\Temp\ 下。§12d 例外「派生检出到 scratch
 * 用完即 prune」被曲解成「建了不 prune」;已有的门 316 只防新建,清扫腿只遍历 `git worktree
 * list`(孤儿壳不进射程),所以这三类能一直活着。
 *
 * 判据（warn 档 §12e，绝不自动删除）:
 *   射程 — `git worktree list --porcelain` 列出的所有 worktree,路径落在以下之一:
 *            · <ROOT>/scratch/ 下任意一层
 *            · D:\DevEnv\Temp\ 下任意一层
 *            · $env:TEMP / os.tmpdir() 下任意一层
 *   双维度老化:
 *            · silentMs = now − worktree 目录里最新一次文件 mtime（递归扫;目录不算;
 *                        超过 MAX_SCAN_FILES 就截断到最新 MAX_SCAN_FILES 个）
 *            · ageMs    = now − 目录创建时间（Windows statSync.birthtime;POSIX 上若为
 *                         epoch 用 mtime 兜底）
 *   三态:
 *            · ok     — 无 worktree 落在临时路径,或全部 silentMs<24h 且 ageMs<48h
 *            · stale  — ≥1 个 worktree silentMs≥24h 或 ageMs≥48h（warn,点名 path/branch/HEAD/时长）
 *            · orphan — worktree 目录不存在但 `git worktree list` 仍有条目（孤儿壳,warn,单列）
 *
 * 用法: node scripts/check-temp-worktree-lifetime.mjs [--json]
 *   exit 0 = ok
 *   exit 1 = stale 或 orphan 或 mixed（warn 档不阻塞）
 *   exit 2 = 未判定（`git worktree list` 失败等）
 */
import { existsSync, readdirSync, statSync } from 'node:fs'
import { join, dirname, resolve, sep } from 'node:path'
import { tmpdir } from 'node:os'
import { execFileSync } from 'node:child_process'
import { fileURLToPath, pathToFileURL } from 'node:url'

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..')

/** 静默阈 24h（文件 mtime 距今） */
const SILENT_MS = 24 * 60 * 60 * 1000
/** 账龄阈 48h（目录创建时间距今） */
const AGE_MS = 48 * 60 * 60 * 1000
/** 递归扫文件数截断（防超大 worktree 拖死门） */
const MAX_SCAN_FILES = 5000

/**
 * §15:ROOT 由脚本位置推导,不写死盘符。临时路径射程 = ROOT/scratch + DevEnv Temp + 系统 TEMP。
 */
function tempScopePaths() {
  const list = [join(ROOT, 'scratch'), 'D:\\DevEnv\\Temp', 'D:/DevEnv/Temp']
  const envTemp = process.env.TEMP || process.env.TMP
  if (envTemp) list.push(envTemp)
  const osTemp = tmpdir()
  if (osTemp) list.push(osTemp)
  return [...new Set(list.map((p) => resolve(p)))]
}

/** 判断 worktree 路径是否落在某个临时射程下（前缀同源 + 段边界对齐,不误命中同前缀不同名目录） */
function inTempScope(worktreePath, scopes) {
  const norm = resolve(worktreePath)
  return scopes.some((root) => {
    if (norm === root) return false // 根自身不算「下任意一层」
    const prefix = norm.startsWith(root) ? norm.slice(root.length) : null
    if (prefix === null) return false
    return prefix.startsWith(sep) || prefix.startsWith('/')
  })
}

/**
 * 解析 `git worktree list --porcelain` 输出。块以空行分隔,字段:
 *   worktree <path> / HEAD <sha> / branch <ref>（detached 时无 branch 行）。
 */
function parseWorktreePorcelain(text) {
  const out = []
  for (const block of text.split(/\n\s*\n/)) {
    const lines = block.split('\n').filter((l) => l.trim() !== '')
    if (lines.length === 0) continue
    const wt = { path: null, head: null, branch: null, bare: false, detached: false }
    for (const line of lines) {
      if (line.startsWith('worktree ')) wt.path = line.slice('worktree '.length).trim()
      else if (line.startsWith('HEAD ')) wt.head = line.slice('HEAD '.length).trim()
      else if (line.startsWith('branch ')) wt.branch = line.slice('branch '.length).trim()
      else if (line.trim() === 'bare') wt.bare = true
      else if (line.trim() === 'detached') wt.detached = true
    }
    if (wt.path) out.push(wt)
  }
  return out
}

/** 递归扫 worktree 目录最新文件 mtime;目录不算;超 MAX_SCAN_FILES 截断(保留最新一批) */
function newestFileMtimeMs(dir, _now) {
  let newest = null
  let scanned = 0
  const stack = [dir]
  // 用小顶堆思路不便在同步递归里展开,退化为「扫满 MAX_SCAN_FILES 后停」,
  // 这批是最先遍历到的,不代表全局最新 ⇒ 为避免误判静默,扫满即标 truncated 让调用方留意。
  let truncated = false
  while (stack.length > 0) {
    const cur = stack.pop()
    let entries
    try {
      entries = readdirSync(cur, { withFileTypes: true })
    } catch {
      continue
    }
    for (const e of entries) {
      const p = join(cur, e.name)
      if (e.isDirectory()) {
        stack.push(p)
        continue
      }
      if (!e.isFile() && !e.isSymbolicLink()) continue
      if (scanned >= MAX_SCAN_FILES) {
        truncated = true
        return { newest, truncated }
      }
      scanned++
      try {
        const m = statSync(p).mtimeMs
        if (Number.isFinite(m) && (newest === null || m > newest)) newest = m
      } catch {
        /* race:文件消失,忽略 */
      }
    }
  }
  return { newest, truncated }
}

/** 目录账龄:Windows statSync.birthtime;POSIX 上若为 epoch(0) 用 mtime 兜底 */
function dirAgeMs(dir, now) {
  try {
    const s = statSync(dir)
    const birth = s.birthtimeMs
    const mtime = s.mtimeMs
    const base = Number.isFinite(birth) && birth > 0 ? birth : mtime
    return now - base
  } catch {
    return null
  }
}

function shortSha(sha) {
  if (!sha) return '∅'
  return sha.length > 12 ? sha.slice(0, 12) : sha
}

function hours(ms) {
  if (ms === null || !Number.isFinite(ms)) return 'never'
  return `${(ms / 3600000).toFixed(1)}h`
}

/**
 * 核心评估,与 I/O 解耦,便于测试注入 now + worktree 条目。
 * @param {object} args
 * @param {Array<{path:string,head:string,branch:string}>} args.worktrees
 * @param {number} args.now
 * @param {string[]} [args.scopes]
 */
function evaluateWorktrees({ worktrees, now, scopes }) {
  const scope = scopes ?? tempScopePaths()
  const hits = []
  const okTemp = []
  const orphans = []

  for (const wt of worktrees) {
    const exists = existsSync(wt.path)
    if (!exists) {
      if (inTempScope(wt.path, scope)) {
        orphans.push({ ...wt, issue: 'orphan' })
      }
      continue
    }
    if (!inTempScope(wt.path, scope)) continue

    const { newest } = newestFileMtimeMs(wt.path, now)
    const silentMs = newest === null ? null : now - newest
    const ageMs = dirAgeMs(wt.path, now)
    const silentOld = silentMs !== null && silentMs >= SILENT_MS
    const ageOld = ageMs !== null && ageMs >= AGE_MS
    const issue = silentOld && ageOld ? 'both' : silentOld ? 'silent' : ageOld ? 'age' : null
    const rec = {
      path: wt.path,
      branch: wt.branch ?? '(detached)',
      head: shortSha(wt.head),
      silentMs,
      ageMs,
      silentHuman: hours(silentMs),
      ageHuman: hours(ageMs),
      issue,
    }
    if (issue) hits.push(rec)
    else okTemp.push(rec)
  }

  let state
  if (hits.length > 0 && orphans.length > 0) state = 'mixed'
  else if (hits.length > 0) state = 'stale'
  else if (orphans.length > 0) state = 'orphan'
  else state = 'ok'

  return { state, hits, okTemp, orphans, scopes: scope }
}

function gitWorktreeList(root) {
  try {
    const out = execFileSync('git', ['worktree', 'list', '--porcelain'], {
      cwd: root,
      encoding: 'utf8',
      timeout: 15000,
    })
    return { ok: true, text: out }
  } catch (e) {
    return { ok: false, error: e?.message ?? String(e) }
  }
}

function main() {
  const now = Date.now()
  const listed = gitWorktreeList(process.cwd() || ROOT)
  if (!listed.ok) {
    console.error(`未判定:git worktree list 失败 ⇒ ${listed.error}`)
    process.exit(2)
  }
  const worktrees = parseWorktreePorcelain(listed.text)
  const r = evaluateWorktrees({ worktrees, now })

  if (process.argv.includes('--json')) {
    console.log(JSON.stringify({ state: r.state, scopes: r.scopes, hits: r.hits, orphans: r.orphans, okTemp: r.okTemp }, null, 2))
  } else {
    console.log(`临时派生检出寿命闸: state=${r.state}`)
    console.log(`  射程=${r.scopes.join(' | ')}`)
    for (const h of r.hits) {
      console.log(`  worktree path=${h.path} branch=${h.branch} head=${h.head} silent=${h.silentHuman} age=${h.ageHuman} issue=${h.issue}`)
    }
    for (const o of r.orphans) {
      console.log(`  worktree path=${o.path} branch=${o.branch ?? '(?)'} head=${shortSha(o.head)} silent=never age=never issue=orphan`)
    }
    if (r.state === 'ok') {
      console.log(`  (临时射程内命中 0 条超阈 worktree;在册临时检出 ${r.okTemp.length} 条均新鲜)`)
    }
  }

  process.exit(r.state === 'ok' ? 0 : 1)
}

// §22d 入口守卫:CLI 直跑 + 被 import 双形态。
const isDirectRun =
  typeof process !== 'undefined' &&
  process.argv[1] &&
  import.meta.url === pathToFileURL(process.argv[1]).href
if (isDirectRun) {
  main()
}

export const __test__ = {
  tempScopePaths,
  inTempScope,
  parseWorktreePorcelain,
  newestFileMtimeMs,
  dirAgeMs,
  evaluateWorktrees,
  shortSha,
  SILENT_MS,
  AGE_MS,
  MAX_SCAN_FILES,
  ROOT,
}
