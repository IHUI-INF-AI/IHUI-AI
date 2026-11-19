// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠


/**
 * Y-71(P2)临时派生检出寿命闸 —— 量「静默」+「账龄」双轴,超阈点名,**不自动回收**(warn 档)。
 *
 * 根因(2026-11-14 实测归档):merge-wt / d1b-wt / ihui-wt-replay 等临时派生检出长期躺
 * scratch / DevEnv\Temp,§12d 的例外「派生检出到 scratch 用完即 prune」被曲解成「建了不 prune」。
 * 已有的两道护栏都治不了存量:
 *   · 门 316(check-disk-root-hygiene 的 H2)只防**新建**(登记面落点对账,豁免 +worktrees 前缀);
 *   · 清扫腿(heal-worktree-tracked / git-sync-converge)只遍历 `git worktree list`,
 *     孤儿壳(目录已删但 admin dir 残留 / gitdir 指针指到不存在的 gitdir)不进 git 的回收面。
 *
 * 本尺子补的就是那道存量寿命闸:对每个**派生** linked worktree(主工作树豁免)量两条寿命轴:
 *   · 静默 = 当前时刻 − 最近一次活动时刻(`HEAD` 提交时间 ∨ admin dir mtime 取**晚**者);
 *   · 账龄 = 当前时刻 − 创建时刻(admin dir birthtime;取不到回退 mtime)。
 * 任一超阈(静默 ≥ SILENCE_MAX_HOURS ∨ 账龄 ≥ AGE_MAX_HOURS)就点名,出口只写「归属席自决 ∨
 * `git worktree remove --force <path>` + `git worktree prune`」—— 本尺子**绝不代删**:在飞席
 * 的检出不能被旁路自动回收(§12e warn 档铁律),所以最高档是 stale 而**不是** red,也从不阻塞提交。
 *
 * 孤儿壳单列成一条腿(kind `orphan-shell`),分两个方向:
 *   · `registered-missing-dir`:git 登记面有条目但盘上目录已消失 —— git 自带的 `prunable` 标记
 *     就是这一型,`git worktree prune` 可清;
 *   · `dir-missing-registration`:盘上有 `.git` **文件**指到不存在的 gitdir(或反之 admin dir 在、
 *     git 登记面已无)—— 两道旧护栏都看不见,只能靠本尺子的对账面点名。
 * 后者复用 hygiene H2 的孤儿扫描判据(`check-disk-root-hygiene.mjs` 的 scanOrphanWorktreeShells
 * 同族,§0.6 单一真相源:判据同源、采样面不同 —— H2 看的是盘根孤儿,本尺子看的是寿命账)。
 *
 * 取材面全部走 `scripts/lib/face-reader.mjs` 的 `gitRaw`(绝对 git 路径 + safe.directory +
 * quotepath + windowsHide + 有界 timeout + 显式 stdio + 只读动词串行退避,§5b)与
 * `scripts/lib/gitdir.mjs` 的 `resolveGitdir` / `resolveWorktree`;**不另写一份 git 路径推导**
 * (§0.6:抄一份必漂移)。porcelain 解析与 `scripts/agent-worktree.mjs` 的 `parseWorktreeList`
 * 同形(那条不导出、且形状钉在本仓的 branch/detached/locked 三态上,故在此按 porcelain 契约
 * 自带一份最小解析器,字段名与它对齐)。
 *
 * 三态出口(verdict):
 *   · `green` —— 没有超阈项、没有孤儿壳;
 *   · `warn`  —— 有超阈寿命项或孤儿壳(都是**待人工**、绝不自动回收、不阻塞提交);
 *   · `red`   —— 取不到 porcelain(git 派生失败)那一型:按 §0.3 未判定不得记绿也不冒红,
 *                故折成 undetermined 由调用方显式呈现 —— 本尺子**不产 red**(warn 档设计)。
 * `--json` 模式给 guardian 巡检吃;默认人读模式给归属席看,含每条的静默/账龄读数与出路一句。
 */

import { existsSync, readFileSync, readdirSync, statSync } from 'node:fs'
import { dirname, join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

import { gitRaw, Undetermined } from './lib/face-reader.mjs'
import { resolveGitdir, resolveWorktree } from './lib/gitdir.mjs'
import { scratchRoot } from './lib/scratch-dir.mjs'

const HERE = dirname(fileURLToPath(import.meta.url))
const REPO_ROOT = resolve(HERE, '..')

/** 静默阈(小时):连续无 commit / 无 checkout 触碰的时长上限。 */
export const SILENCE_MAX_HOURS = 24
/** 账龄阈(小时):从创建算起的总寿命上限。 */
export const AGE_MAX_HOURS = 48
/** 孤儿壳单列腿的宽限(小时),与 H2 的 ORPHAN_LEASE_MAX_AGE_HOURS 同值。 */
export const ORPHAN_SHELL_MAX_AGE_HOURS = 48
/** porcelain 取材 timeout,与 check-disk-root-hygiene 的 WORKTREE_GIT_TIMEOUT_MS 同口径。 */
const WORKTREE_GIT_TIMEOUT_MS = 60_000
/** 超预算护栏:一次巡检最多枚举的孤儿壳条目(超了置 truncated,不当成"没发现")。 */
const ORPHAN_SCAN_BUDGET = 400
const ORPHAN_SCAN_ROOTS = ['.box-agent-scratch', '.DevEnv/Temp', '.worktrees']
const ORPHAN_SCAN_MAX_DEPTH = 4

const HOUR_MS = 3_600_000

/** 路径归一(与 scratch-dir / check-disk-root-hygiene 的 normPath 同形:反斜杠→斜杠 + 去尾分隔符)。 */
function normPath(p) {
  return String(p).replace(/\\/g, '/').replace(/\/+$/, '')
}

function samePath(a, b) {
  return normPath(a).toLowerCase() === normPath(b).toLowerCase()
}

/** p 是否严格落在 dir 之下(路径分段判定,防 `G:\IHUI-AI-wt-sibling` 这类前缀误判)。 */
function isUnderDir(p, dir) {
  const np = normPath(p)
  const nd = normPath(dir)
  // 必须以 dir 整段为前缀(含尾部分隔符),否则 `G:/IHUI-AI-wt-sibling` 会被误判落在 `G:/IHUI-AI` 下。
  if (!nd) return false
  if (!np.toLowerCase().startsWith(nd.toLowerCase())) return false
  const rel = np.slice(nd.length)
  return rel.startsWith('/') && rel.length > 1
}

/**
 * 纯函数:`git worktree list --porcelain` 的最小解析器(与 agent-worktree.parseWorktreeList 同形)。
 * 返回 [{path, sha, branch, detached, locked, prunable}]。porcelain 契约:**第一条 = 主工作树**,
 * 调用方据此豁免(与盘符/gitdir 形态无关的 git 契约事实)。
 */
export function parseWorktreePorcelain(text) {
  const rows = []
  let cur = null
  for (const raw of String(text ?? '').split('\n')) {
    const line = raw.replace(/\r$/, '')
    if (line.startsWith('worktree ')) {
      if (cur) rows.push(cur)
      cur = { path: line.slice('worktree '.length).trim(), sha: '', branch: '', detached: false, locked: false, prunable: false }
    } else if (cur && line.startsWith('HEAD ')) cur.sha = line.slice(5).trim()
    else if (cur && line.startsWith('branch ')) cur.branch = line.slice(7).trim().replace(/^refs\/heads\//, '')
    else if (cur && line === 'detached') cur.detached = true
    else if (cur && line.startsWith('locked')) cur.locked = line.slice('locked'.length).trim() || true
    else if (cur && line.startsWith('prunable')) cur.prunable = true
  }
  if (cur) rows.push(cur)
  return rows
}

/**
 * 纯函数:一条 linked worktree 是不是**派生检出**(§12d 例外射程)。
 * 派生 = 落在 scratch 根、仓内 `.DevEnv/Temp`、或仓内 `.worktrees/` 之下;其余(主工作树、
 * `D:/IHUI-AI-wt-*` 这类仓外兄弟席)不在本尺子寿命闸的射程里 —— 后者由 heal-worktree-tracked
 * 的「批准落点」那一族治,不在 Y-71 票面内。
 */
export function isDerivedCheckout(path, { repoRoot = REPO_ROOT, scratch = scratchRoot() } = {}) {
  const p = normPath(path)
  if (!p) return { derived: false, why: '空路径' }
  const under = (dir) => dir && isUnderDir(p, normPath(dir))
  if (under(scratch)) return { derived: true, why: `落在 scratch 根 ${normPath(scratch)} 下` }
  if (under(join(repoRoot, '.DevEnv', 'Temp'))) return { derived: true, why: '落在仓内 .DevEnv/Temp 下' }
  if (under(join(repoRoot, '.worktrees'))) return { derived: true, why: '落在仓内 .worktrees/ 下' }
  return { derived: false, why: '不在派生检出射程内(scratch / .DevEnv\\Temp / .worktrees 之外)' }
}

/**
 * 纯函数:一条派生检出的**三态**判据。输入全部是已观测事实(§22c 构造面可证),便于镜像测试逐格钉。
 * @returns {{verdict:'ok'|'warn'|'stale', silenceHours:number, ageHours:number, reasons:string[]}}
 */
export function classifyDerivedAge({ silenceHours, ageHours, silenceMax = SILENCE_MAX_HOURS, ageMax = AGE_MAX_HOURS }) {
  const reasons = []
  if (Number.isFinite(silenceHours) && silenceHours >= silenceMax) {
    reasons.push(`静默 ${silenceHours.toFixed(1)}h ≥ ${silenceMax}h`)
  }
  if (Number.isFinite(ageHours) && ageHours >= ageMax) {
    reasons.push(`账龄 ${ageHours.toFixed(1)}h ≥ ${ageMax}h`)
  }
  if (reasons.length >= 2) return { verdict: 'stale', silenceHours, ageHours, reasons }
  if (reasons.length === 1) return { verdict: 'warn', silenceHours, ageHours, reasons }
  return { verdict: 'ok', silenceHours, ageHours, reasons }
}

/**
 * 取 admin dir(`.git/worktrees/<name>/`)的时间戳。linked worktree 的真身在主仓 `.git/worktrees/`
 * 下,创建时刻 = birthtime,最近触碰 = mtime(`HEAD` / `logs` 的更新会碰它)。
 * birthtime 在 Windows 上可靠;Linux 上 ext4 通常有、其它 fs 可能退化为 mtime —— 两态都处理,
 * 取不到 birthtime 就回退 mtime 并在输出里标 `ageSource:'mtime'`,不静默折进 birthtime。
 */
function adminDirStats(worktreePath) {
  const gitdir = resolveGitdir(worktreePath)
  if (!gitdir || !existsSync(gitdir)) return { present: false, gitdir: gitdir || null }
  let st
  try {
    st = statSync(gitdir)
  } catch {
    return { present: true, gitdir, readable: false }
  }
  const birthMs = st.birthtimeMs
  const mtimeMs = st.mtimeMs
  return {
    present: true,
    gitdir,
    readable: true,
    mtimeMs,
    birthMs: Number.isFinite(birthMs) && birthMs > 0 ? birthMs : null,
    ageSource: Number.isFinite(birthMs) && birthMs > 0 ? 'birthtime' : 'mtime',
  }
}

/**
 * 取该 worktree HEAD 的**提交时刻**(ISO ms)。取不到(detached 指向未 fetch 的远端 sha、浅克隆、
 * 对象缺失)就回退 null —— 调用方把静默折到 admin-dir mtime 单轴,不冒充"刚活动过"。
 */
function headCommitTimeMs(root, sha) {
  if (!/^[0-9a-f]{7,40}$/i.test(String(sha ?? ''))) return null
  try {
    const out = gitRaw(['log', '-1', '--no-walk', '--format=%ct', sha], root, { timeout: WORKTREE_GIT_TIMEOUT_MS })
    const sec = Number(String(out ?? '').trim())
    return Number.isFinite(sec) && sec > 0 ? sec * 1000 : null
  } catch {
    return null
  }
}

/**
 * 孤儿壳对账腿 —— 两个方向(与 H2 同族,采样面不同):
 *   · `registered-missing-dir`:git 登记面有、盘上目录已消失(git 自带 `prunable` 就是这一型);
 *   · `dir-missing-registration`:盘上 `.git` 文件指到不存在的 gitdir,或 admin dir 在但
 *     git 登记面已无 —— 两道旧护栏(gate 316 / 清扫腿)都看不见。
 * 后者做**有界 + 不穿重解析点**的子树枚举(§26 junction 穿透清空事故同型),只读、绝不代删。
 */
function scanOrphanShells({ root, registeredPaths, repoRoot, nowMs }) {
  const orphans = []
  // 方向 ①:登记面有、目录没了 —— git 自己也标了 prunable。
  for (const row of registeredPaths) {
    if (!row.prunable && existsSync(row.path)) continue
    orphans.push({
      kind: 'registered-missing-dir',
      path: row.path,
      why: row.prunable ? 'git 已标 prunable(目录已消失)' : '登记面有条目但盘上目录不存在',
      remedy: `git worktree prune`,
    })
  }
  // 方向 ②:盘上有孤儿壳(指针文件指到不存在的 gitdir)。有界枚举,超预算置 truncated。
  let scanned = 0
  let truncated = false
  const stack = [[resolve(repoRoot), 0]]
  const seen = new Set(registeredPaths.map((r) => normPath(r.path).toLowerCase()))
  while (stack.length && !truncated) {
    const [dir, depth] = stack.pop()
    if (depth > ORPHAN_SCAN_MAX_DEPTH) continue
    let entries
    try {
      entries = readdirSync(dir, { withFileTypes: true })
    } catch {
      continue
    }
    for (const e of entries) {
      if (++scanned > ORPHAN_SCAN_BUDGET) {
        truncated = true
        break
      }
      if (e.isSymbolicLink()) continue
      const full = join(dir, e.name)
      if (!e.isDirectory()) continue
      if (e.name === '.git') continue // 目录形态 .git = 独立仓或主工作树,不是孤儿壳
      // 看这一目录里**直接**有没有 `.git` 文件指向不存在的 gitdir。
      const gitFile = join(full, '.git')
      try {
        const st = statSync(gitFile)
        if (st.isFile()) {
          let content = ''
          try {
            content = readFileSync(gitFile, 'utf8')
          } catch {
            /* 读不到不猜 */
          }
          const m = /^\s*gitdir\s*:\s*(.+?)\s*$/im.exec(content)
          if (m && !existsSync(m[1].replace(/\\/g, '/'))) {
            const ageMs = nowMs - (Number.isFinite(st.birthtimeMs) && st.birthtimeMs > 0 ? st.birthtimeMs : st.mtimeMs)
            orphans.push({
              kind: 'dir-missing-registration',
              path: full,
              brokenGitdir: m[1].replace(/\\/g, '/'),
              ageHours: Math.round((ageMs / HOUR_MS) * 10) / 10,
              ageSource: Number.isFinite(st.birthtimeMs) && st.birthtimeMs > 0 ? 'birthtime' : 'mtime',
              remedy: `确认归属席已结束 ⇒ 删目录 ${full} + git worktree prune`,
            })
          }
        }
      } catch {
        /* 没 .git,继续往下走 */
      }
      if (depth < ORPHAN_SCAN_MAX_DEPTH) stack.push([full, depth + 1])
    }
  }
  // 方向 ②补:admin dir 在(`.git/worktrees/<name>/`)但 git 登记面已无 —— 也算孤儿壳。
  const wtAdminRoot = join(root, 'worktrees')
  if (existsSync(wtAdminRoot)) {
    let names = []
    try {
      names = readdirSync(wtAdminRoot, { withFileTypes: true }).filter((d) => d.isDirectory()).map((d) => d.name)
    } catch {
      /* 取不到不猜 */
    }
    for (const name of names) {
      const adminDir = join(wtAdminRoot, name)
      const reg = registeredPaths.find((r) => samePath(r.path, readAdminGitdirPath(adminDir) || ''))
      if (reg) continue // 登记面对得上,不是孤儿
      // admin dir 在、但没有任何已登记 worktree 指回它 ⇒ 孤儿壳。
      let ageMs = 0
      try {
        const st = statSync(adminDir)
        ageMs = nowMs - (Number.isFinite(st.birthtimeMs) && st.birthtimeMs > 0 ? st.birthtimeMs : st.mtimeMs)
      } catch {
        continue
      }
      orphans.push({
        kind: 'admin-dir-orphan',
        path: adminDir,
        ageHours: Math.round((ageMs / HOUR_MS) * 10) / 10,
        remedy: `确认无关联检出版本 ⇒ 删 ${adminDir}(或由 git worktree prune 清)`,
      })
    }
  }
  return { orphans, scanned, truncated }
}

/** 读 admin dir 里的 `gitdir` 文件(指回检出版本的 `.git` 文件),取到检出版本的路径。 */
function readAdminGitdirPath(adminDir) {
  const gitdirFile = join(adminDir, 'gitdir')
  if (!existsSync(gitdirFile)) return null
  try {
    // content 形如 `D:/DevEnv/Temp/xxx/.git` —— 去掉末尾 `/.git` 即检出版本的根。
    const content = readFileSync(gitdirFile, 'utf8').trim().replace(/\\/g, '/')
    return content.replace(/\/\.git\/?$/i, '')
  } catch {
    return null
  }
}

/** 取当前仓的 porcelain 面;取不到 ⇒ null(判"未判定",不冒红也不记绿)。 */
function currentWorktreePorcelain(root) {
  try {
    return gitRaw(['worktree', 'list', '--porcelain'], root, { timeout: WORKTREE_GIT_TIMEOUT_MS })
  } catch {
    return null
  }
}

/**
 * 主审计:量每条派生检出的静默 + 账龄,做孤儿壳对账,返回 verdict + 逐条读数。
 * @param {{root?:string, repoRoot?:string, scratch?:string, nowMs?:number, porcelainText?:string}} [opts]
 */
export function auditDerivedWorktreeAge(opts = {}) {
  const root = opts.root || resolveWorktree() || REPO_ROOT
  const repoRoot = opts.repoRoot || REPO_ROOT
  const scratch = opts.scratch || scratchRoot()
  const nowMs = opts.nowMs ?? Date.now()
  const porcelainText = opts.porcelainText !== undefined ? opts.porcelainText : currentWorktreePorcelain(repoRoot)

  if (porcelainText === null || porcelainText === undefined) {
    return {
      verdict: 'undetermined',
      why: 'git worktree list 取不到 ⇒ 未判定(§0.3 不记绿也不冒红)',
      counts: { derivedTotal: 0, warn: 0, stale: 0, orphans: 0 },
      derived: [],
      orphans: [],
      thresholds: { silenceMaxHours: SILENCE_MAX_HOURS, ageMaxHours: AGE_MAX_HOURS, orphanMaxHours: ORPHAN_SHELL_MAX_AGE_HOURS },
    }
  }

  const rows = parseWorktreePorcelain(porcelainText)
  const mainPath = rows[0]?.path ?? '' // porcelain 契约:第一条 = 主工作树
  const linked = rows.filter((r) => !samePath(r.path, mainPath))

  // ① 派生检出寿命腿:只对 §12d 例外射程内的 linked worktree 量寿命。
  const derived = []
  for (const row of linked) {
    const gate = isDerivedCheckout(row.path, { repoRoot, scratch })
    if (!gate.derived) continue
    const admin = adminDirStats(row.path)
    const headMs = headCommitTimeMs(repoRoot, row.sha)
    const lastActivityMs = Math.max(...[headMs, admin.mtimeMs].filter((v) => Number.isFinite(v)))
    const silenceHours = Number.isFinite(lastActivityMs)
      ? Math.round(((nowMs - lastActivityMs) / HOUR_MS) * 10) / 10
      : null
    const ageBaseMs = admin.birthMs ?? admin.mtimeMs
    const ageHours = Number.isFinite(ageBaseMs) ? Math.round(((nowMs - ageBaseMs) / HOUR_MS) * 10) / 10 : null
    const cls = classifyDerivedAge({ silenceHours, ageHours })
    derived.push({
      path: row.path,
      sha: row.sha,
      branch: row.branch || null,
      detached: row.detached,
      locked: row.locked || false,
      prunable: row.prunable,
      adminDir: admin.gitdir,
      adminDirReadable: admin.readable !== false,
      ageSource: admin.ageSource ?? null,
      headCommitMs: headMs,
      lastActivityMs: Number.isFinite(lastActivityMs) ? lastActivityMs : null,
      silenceHours,
      ageHours,
      verdict: cls.verdict,
      reasons: cls.reasons,
      inScopeWhy: gate.why,
      remedy:
        cls.verdict === 'ok'
          ? null
          : `归属席自决;或确认已结束 ⇒ git worktree remove --force ${row.path} && git worktree prune`,
    })
  }

  // ② 孤儿壳对账腿(单列,与寿命腿分开)。
  const orphanScan = scanOrphanShells({
    root: resolveGitdir(repoRoot) || join(repoRoot, '.git'),
    registeredPaths: linked,
    repoRoot,
    nowMs,
  })
  const orphans = orphanScan.orphans

  const warnCount = derived.filter((d) => d.verdict === 'warn').length
  const staleCount = derived.filter((d) => d.verdict === 'stale').length
  const verdict = warnCount + staleCount + orphans.length > 0 ? 'warn' : 'green'

  return {
    verdict,
    why:
      verdict === 'green'
        ? '所有派生检出均在寿命阈内,无孤儿壳'
        : `派生寿命超阈 ${warnCount + staleCount} 条(其中 stale ${staleCount} 条)+ 孤儿壳 ${orphans.length} 处`,
    counts: {
      derivedTotal: derived.length,
      warn: warnCount,
      stale: staleCount,
      orphans: orphans.length,
      orphanTruncated: orphanScan.truncated,
      orphanScannedEntries: orphanScan.scanned,
    },
    derived,
    orphans,
    thresholds: { silenceMaxHours: SILENCE_MAX_HOURS, ageMaxHours: AGE_MAX_HOURS, orphanMaxHours: ORPHAN_SHELL_MAX_AGE_HOURS },
    mainWorktree: mainPath,
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// CLI 入口
// ─────────────────────────────────────────────────────────────────────────────
function humanReport(res) {
  const lines = []
  lines.push(`# Y-71 派生检出寿命闸 —— ${res.verdict.toUpperCase()}`)
  lines.push(`主工作树:${res.mainWorktree || '(取不到)'}`)
  lines.push(
    `阈值:静默 ≥ ${res.thresholds.silenceMaxHours}h ∨ 账龄 ≥ ${res.thresholds.ageMaxHours}h ⇒ 点名;` +
      `孤儿壳单列(warn 档,不阻塞提交、不自动回收)。`,
  )
  lines.push(
    `计数:派生 ${res.counts.derivedTotal} 条(warn ${res.counts.warn} / stale ${res.counts.stale});孤儿壳 ${res.counts.orphans} 处` +
      `${res.counts.orphanTruncated ? '(⚠ 孤儿扫描超预算被截断,按未判完处理)' : ''}`,
  )
  if (res.verdict === 'undetermined') {
    lines.push(`未判定:${res.why}`)
    return lines.join('\n')
  }
  if (res.derived.length === 0) {
    lines.push('派生检出:无(登记面上的 linked worktree 均不在 §12d 例外射程内)')
  } else {
    lines.push('派生检出逐条:')
    for (const d of res.derived) {
      const silence = d.silenceHours === null ? '取不到' : `${d.silenceHours.toFixed(1)}h`
      const age = d.ageHours === null ? '取不到' : `${d.ageHours.toFixed(1)}h(${d.ageSource})`
      lines.push(
        `  [${d.verdict.toUpperCase().padEnd(5)}] ${d.path}` +
          `\n         sha=${d.sha.slice(0, 12)}${d.branch ? ` branch=${d.branch}` : ' (detached)'}${d.locked ? ` locked=${d.locked}` : ''}` +
          `\n         静默=${silence}  账龄=${age}` +
          `\n         射程依据:${d.inScopeWhy}` +
          (d.reasons.length ? `\n         超阈:${d.reasons.join(' ; ')}` : '') +
          (d.remedy ? `\n         出路:${d.remedy}` : ''),
      )
    }
  }
  if (res.orphans.length === 0) {
    lines.push('孤儿壳:无')
  } else {
    lines.push('孤儿壳(单列,两道旧护栏都看不见的那一类):')
    for (const o of res.orphans) {
      lines.push(`  [${o.kind}] ${o.path}`)
      if (o.why) lines.push(`         为什么:${o.why}`)
      if (o.brokenGitdir) lines.push(`         断指针:${o.brokenGitdir}`)
      if (o.ageHours !== undefined) lines.push(`         账龄:${o.ageHours}h(${o.ageSource ?? 'n/a'})`)
      lines.push(`         出路:${o.remedy}`)
    }
  }
  return lines.join('\n')
}

function main() {
  const argv = process.argv.slice(2)
  const jsonMode = argv.includes('--json')
  let res
  try {
    res = auditDerivedWorktreeAge({})
  } catch (e) {
    if (e instanceof Undetermined || /取不到|未判定/.test(String(e?.message))) {
      res = {
        verdict: 'undetermined',
        why: `取材失败:${e?.message ?? String(e)}`,
        counts: { derivedTotal: 0, warn: 0, stale: 0, orphans: 0 },
        derived: [],
        orphans: [],
        thresholds: { silenceMaxHours: SILENCE_MAX_HOURS, ageMaxHours: AGE_MAX_HOURS, orphanMaxHours: ORPHAN_SHELL_MAX_AGE_HOURS },
      }
    } else {
      process.stderr.write(`check-derived-worktree-age: 未预期失败:${e?.stack ?? String(e)}\n`)
      process.exit(2)
    }
  }
  if (jsonMode) {
    process.stdout.write(`${JSON.stringify(res, null, 2)}\n`)
  } else {
    process.stdout.write(`${humanReport(res)}\n`)
  }
  // warn 档不阻塞提交;undetermined 也以 exit 0 交 guardian 呈现(它自己按 verdict 分档)。
  process.exit(0)
}

const isCli = process.argv[1] && resolve(process.argv[1]) === resolve(fileURLToPath(import.meta.url))
if (isCli) main()
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
