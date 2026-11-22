// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * Y-71 临时派生检出寿命闸 —— 只读扫描 `.worktrees/`，按账龄+静默时长点名，绝不自动删除任何东西。
 *
 * 三态含义（每条 worktree）:
 *   fresh  —— 账龄 < STALE_AGE_H(48h) 且 静默 < STALE_SILENT_H(24h)
 *   stale  —— 账龄 ≥ STALE_AGE_H 或 静默 ≥ STALE_SILENT_H（任一命中即 stale）
 *   orphan —— 目录存在，但 `git worktree list --porcelain` 里找不到对应登记（孤儿壳）
 *
 * 阈值常量:
 *   STALE_AGE_H    = 48  账龄上限（从目录创建时刻算起）
 *   STALE_SILENT_H = 24  静默上限（最后写入时刻算起）
 *
 * 档位: warn（§12e）。本尺子**只读**——不自动 `git worktree remove`，不删任何目录。
 * 出路只写建议: 归属席自决，或人工 `git worktree remove --force <path>` + `git worktree prune`。
 *
 * 时间戳口径（每条子目录量三个）:
 *   dirMtimeMs   —— 目录 mtime = 最后写入
 *   gitFileMtimeMs —— 子目录里 `.git` 文件（worktree gitdir 指针）的 mtime
 *   birthMs      —— 目录 birthtime（Windows 上可靠；取不到回退 dirMtime）
 *   账龄   = now - (birthMs ?? dirMtime)
 *   静默   = now - max(dirMtime, gitFileMtime ?? dirMtime)
 *
 * 用法: node scripts/check-stale-derived-worktrees.mjs [--json]
 *   exit 0 = 全部 fresh / exit 1 = 有 stale / exit 2 = 有 orphan / exit 3 = 未判定（.worktrees 不存在或空）
 *   退出码优先级: 3 (未判定) > 2 (orphan) > 1 (stale) > 0 (全部 fresh)。
 *   orphan 优先于 stale：结构性对账问题比寿命账更早暴露。
 */
import { execFileSync } from 'node:child_process'
import { existsSync, readdirSync, readFileSync, statSync } from 'node:fs'
import { join, dirname, resolve } from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'

const HERE = dirname(fileURLToPath(import.meta.url))
const REPO_ROOT = resolve(HERE, '..')
const WORKTREES_DIR = join(REPO_ROOT, '.worktrees')

/** 账龄上限（小时）。 */
export const STALE_AGE_H = 48
/** 静默上限（小时）。 */
export const STALE_SILENT_H = 24

const HOUR_MS = 3_600_000
const GIT_TIMEOUT_MS = 30_000

/** 路径归一：反斜杠→斜杠 + 去尾分隔符；Windows 上比较统一小写。 */
function normPath(p) {
  return String(p).replace(/\\/g, '/').replace(/\/+$/, '')
}
function samePath(a, b) {
  return normPath(a).toLowerCase() === normPath(b).toLowerCase()
}

/**
 * 纯函数：`git worktree list --porcelain` 最小解析器。
 * 返回 [{path, sha, branch, detached, locked}]。容错空行与 `worktree ` 前缀。
 * porcelain 契约：第一条 = 主工作树（调用方据此豁免）。
 */
export function parseWorktreePorcelain(text) {
  const rows = []
  let cur = null
  for (const raw of String(text ?? '').split('\n')) {
    const line = raw.replace(/\r$/, '')
    if (line.startsWith('worktree ')) {
      if (cur) rows.push(cur)
      cur = { path: line.slice('worktree '.length).trim(), sha: '', branch: '', detached: false, locked: false }
    } else if (cur && line.startsWith('HEAD ')) cur.sha = line.slice(5).trim()
    else if (cur && line.startsWith('branch ')) cur.branch = line.slice(7).trim().replace(/^refs\/heads\//, '')
    else if (cur && line === 'detached') cur.detached = true
    else if (cur && line.startsWith('locked')) cur.locked = line.slice('locked'.length).trim() || true
  }
  if (cur) rows.push(cur)
  return rows
}

/** 取 `git worktree list --porcelain`；取不到 ⇒ null（判未判定，不冒红也不记绿）。 */
function readPorcelain() {
  try {
    const out = execFileSync('git', ['-c', 'core.quotePath=false', 'worktree', 'list', '--porcelain'], {
      cwd: REPO_ROOT,
      encoding: 'utf8',
      windowsHide: true,
      timeout: GIT_TIMEOUT_MS,
      stdio: ['ignore', 'pipe', 'pipe'],
    })
    return String(out ?? '')
  } catch {
    return null
  }
}

/** 量一条子目录的三个时间戳（毫秒）。 */
function measureTimestamps(subdirAbs) {
  const out = { dirMtimeMs: null, gitFileMtimeMs: null, birthMs: null, ageSource: null }
  try {
    const st = statSync(subdirAbs)
    out.dirMtimeMs = st.mtimeMs
    const b = st.birthtimeMs
    if (Number.isFinite(b) && b > 0) {
      out.birthMs = b
      out.ageSource = 'birthtime'
    } else {
      out.ageSource = 'mtime'
    }
  } catch {
    /* 取不到不猜 */
  }
  const gitFile = join(subdirAbs, '.git')
  if (existsSync(gitFile)) {
    try {
      out.gitFileMtimeMs = statSync(gitFile).mtimeMs
    } catch {
      /* 取不到不猜 */
    }
  }
  return out
}

/**
 * 纯函数：三态判定（便于镜像测试逐格钉）。
 * orphan 由调用方在登记面对账后单独标；这里只判 fresh/stale。
 */
export function classifyFreshness({ ageHours, silenceHours, ageMax = STALE_AGE_H, silentMax = STALE_SILENT_H }) {
  const reasons = []
  if (Number.isFinite(silenceHours) && silenceHours >= silentMax) {
    reasons.push(`静默 ${silenceHours.toFixed(1)}h ≥ ${silentMax}h`)
  }
  if (Number.isFinite(ageHours) && ageHours >= ageMax) {
    reasons.push(`账龄 ${ageHours.toFixed(1)}h ≥ ${ageMax}h`)
  }
  return reasons.length > 0
    ? { verdict: 'stale', reasons }
    : { verdict: 'fresh', reasons: [] }
}

/**
 * 主审计：扫 `.worktrees/` 每个子目录，对账登记面，量寿命，逐条判 fresh/stale/orphan。
 * @param {{worktreesDir?:string, repoRoot?:string, nowMs?:number, porcelainText?:string|null}} [opts]
 */
export function auditStaleDerivedWorktrees(opts = {}) {
  const worktreesDir = opts.worktreesDir || WORKTREES_DIR
  const repoRoot = opts.repoRoot || REPO_ROOT
  const nowMs = opts.nowMs ?? Date.now()
  const porcelainText =
    opts.porcelainText !== undefined ? opts.porcelainText : readPorcelain()

  const undetermined = (why) => ({
    verdict: 'undetermined',
    why,
    counts: { total: 0, fresh: 0, stale: 0, orphan: 0 },
    worktrees: [],
    thresholds: { staleAgeH: STALE_AGE_H, staleSilentH: STALE_SILENT_H },
    scannedDir: worktreesDir,
  })

  if (porcelainText === null || porcelainText === undefined) {
    return undetermined('git worktree list --porcelain 取不到 ⇒ 未判定')
  }
  if (!existsSync(worktreesDir)) {
    return undetermined(`.worktrees 目录不存在:${worktreesDir}`)
  }

  let entries
  try {
    entries = readdirSync(worktreesDir, { withFileTypes: true }).filter((e) => e.isDirectory())
  } catch (e) {
    return undetermined(`.worktrees 目录不可读:${e?.message ?? String(e)}`)
  }
  if (entries.length === 0) {
    return undetermined(`.worktrees 目录存在但为空:${worktreesDir}`)
  }

  const rows = parseWorktreePorcelain(porcelainText)
  const mainPath = rows[0]?.path ?? ''
  const registeredLinked = rows.filter((r) => r.path && !samePath(r.path, mainPath))
  const registeredNorm = new Set(registeredLinked.map((r) => normPath(r.path).toLowerCase()))

  const worktrees = []
  for (const e of entries) {
    const abs = join(worktreesDir, e.name)
    if (registeredNorm.has(normPath(abs).toLowerCase())) {
      const ts = measureTimestamps(abs)
      const ageBase = ts.birthMs ?? ts.dirMtimeMs
      const ageHours = Number.isFinite(ageBase)
        ? Math.round(((nowMs - ageBase) / HOUR_MS) * 10) / 10
        : null
      const lastWrite = Math.max(...[ts.dirMtimeMs, ts.gitFileMtimeMs ?? ts.dirMtimeMs].filter((v) => Number.isFinite(v)))
      const silenceHours = Number.isFinite(lastWrite)
        ? Math.round(((nowMs - lastWrite) / HOUR_MS) * 10) / 10
        : null
      const reg = registeredLinked.find((r) => samePath(r.path, abs))
      const cls = classifyFreshness({ ageHours, silenceHours })
      worktrees.push({
        name: e.name,
        path: abs,
        registered: true,
        sha: reg?.sha ?? '',
        branch: reg?.branch || null,
        detached: reg?.detached ?? false,
        locked: Boolean(reg?.locked),
        dirMtimeMs: ts.dirMtimeMs,
        gitFileMtimeMs: ts.gitFileMtimeMs,
        birthMs: ts.birthMs,
        ageSource: ts.ageSource,
        ageHours,
        silenceHours,
        verdict: cls.verdict,
        reasons: cls.reasons,
        remedy:
          cls.verdict === 'fresh'
            ? null
            : `归属席自决;或确认已结束 ⇒ git worktree remove --force ${abs} && git worktree prune`,
      })
    } else {
      // 孤儿壳：目录在，登记面没有。取 birthtime/mtime 当账龄，只点名不代删。
      const ts = measureTimestamps(abs)
      const ageBase = ts.birthMs ?? ts.dirMtimeMs
      const ageHours = Number.isFinite(ageBase)
        ? Math.round(((nowMs - ageBase) / HOUR_MS) * 10) / 10
        : null
      const gitFile = join(abs, '.git')
      const gitFilePresent = existsSync(gitFile)
      let brokenGitdir = null
      if (gitFilePresent) {
        try {
          const content = readFileSync(gitFile, 'utf8')
          const m = /^\s*gitdir\s*:\s*(.+?)\s*$/im.exec(content)
          if (m) brokenGitdir = m[1].replace(/\\/g, '/')
        } catch {
          /* 读不到不猜 */
        }
      }
      worktrees.push({
        name: e.name,
        path: abs,
        registered: false,
        sha: null,
        branch: null,
        detached: null,
        locked: false,
        dirMtimeMs: ts.dirMtimeMs,
        gitFileMtimeMs: ts.gitFileMtimeMs,
        birthMs: ts.birthMs,
        ageSource: ts.ageSource,
        ageHours,
        silenceHours: null,
        verdict: 'orphan',
        reasons: ['目录存在但 git worktree list 无对应登记'],
        brokenGitdir,
        gitFilePresent,
        remedy: `确认归属席已结束 ⇒ 删目录 ${abs} + git worktree prune`,
      })
    }
  }

  const freshCount = worktrees.filter((w) => w.verdict === 'fresh').length
  const staleCount = worktrees.filter((w) => w.verdict === 'stale').length
  const orphanCount = worktrees.filter((w) => w.verdict === 'orphan').length

  let verdict
  if (orphanCount > 0) verdict = 'orphan'
  else if (staleCount > 0) verdict = 'stale'
  else verdict = 'fresh'

  return {
    verdict,
    why:
      verdict === 'fresh'
        ? '所有 .worktrees 派生检出均在寿命阈内且登记齐全'
        : `stale ${staleCount} 条 + orphan ${orphanCount} 处`,
    counts: { total: worktrees.length, fresh: freshCount, stale: staleCount, orphan: orphanCount },
    worktrees,
    thresholds: { staleAgeH: STALE_AGE_H, staleSilentH: STALE_SILENT_H },
    scannedDir: worktreesDir,
    mainWorktree: mainPath,
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// CLI 入口
// ─────────────────────────────────────────────────────────────────────────────
function humanReport(res) {
  const lines = []
  lines.push(`# Y-71 临时派生检出寿命闸（.worktrees/）—— ${res.verdict.toUpperCase()}`)
  lines.push(
    `阈值:账龄 ≥ ${res.thresholds.staleAgeH}h ∨ 静默 ≥ ${res.thresholds.staleSilentH}h ⇒ stale;` +
      `目录在而登记面无 ⇒ orphan。warn 档:不自动回收、不阻塞提交。`,
  )
  lines.push(
    `扫描目录:${res.scannedDir}(主工作树:${res.mainWorktree || '(取不到)'})\n` +
      `计数:共 ${res.counts.total} 条 — fresh ${res.counts.fresh} / stale ${res.counts.stale} / orphan ${res.counts.orphan}`,
  )
  if (res.verdict === 'undetermined') {
    lines.push(`未判定:${res.why}`)
    return lines.join('\n')
  }
  for (const w of res.worktrees) {
    const age = w.ageHours === null ? '取不到' : `${w.ageHours.toFixed(1)}h(${w.ageSource ?? 'n/a'})`
    const silence = w.verdict === 'orphan' ? 'n/a(孤儿)' : w.silenceHours === null ? '取不到' : `${w.silenceHours.toFixed(1)}h`
    const id = w.registered
      ? `sha=${String(w.sha).slice(0, 12)}${w.branch ? ` branch=${w.branch}` : w.detached ? ' (detached)' : ''}${w.locked ? ` locked` : ''}`
      : `孤儿壳${w.gitFilePresent ? (w.brokenGitdir ? ` 断指针=${w.brokenGitdir}` : ' (.git 文件在)') : ' (无 .git 文件)'}`
    lines.push(
      `  [${w.verdict.toUpperCase().padEnd(6)}] ${w.path}\n` +
        `         ${id}\n` +
        `         账龄=${age}  静默=${silence}` +
        (w.reasons.length ? `\n         判据:${w.reasons.join(' ; ')}` : '') +
        (w.remedy ? `\n         出路:${w.remedy}` : '\n         出路:无需处理'),
    )
  }
  return lines.join('\n')
}

function main() {
  const jsonMode = process.argv.slice(2).includes('--json')
  const res = auditStaleDerivedWorktrees({})
  if (jsonMode) process.stdout.write(`${JSON.stringify(res, null, 2)}\n`)
  else process.stdout.write(`${humanReport(res)}\n`)

  if (res.verdict === 'undetermined') process.exit(3)
  if (res.verdict === 'orphan') process.exit(2)
  if (res.verdict === 'stale') process.exit(1)
  process.exit(0)
}

const isDirectRun =
  typeof process !== 'undefined' && process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href
if (isDirectRun) main()
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
