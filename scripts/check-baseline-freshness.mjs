// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

// scripts/check-baseline-freshness.mjs
/**
 * 开工前基线新鲜度自检:三轴而不是两轴(机制规格 MECHANISM-SPEC-2 §2 / 候选点 A2)。
 *
 * 在**动手之前**量出"我这棵检出离权威基线多远",把"我已经过期了"从隐性状态变成一条前置退出码。
 *
 * 为什么不照抄上游的两轴:上游账只量 ① 本分支落后自己的远端跟踪分支 ② 落后主线超阈值。
 * 本仓最高频的自伤形态**不是** HEAD 落后远端,而是第三轴 **共享工作树滞后 HEAD**
 * (AGENTS §5b/§12d:converge 只推进 index 不 checkout;守门 84 立因处实测 503 文件落后 486 提交,
 * 一次索引层重建把 309 个路径整文件回写成旧基线)。只抄两轴会在"本侧其实早已过期"的日子里给出全绿。
 *
 * 三轴与结论:
 *  ① upstream — `HEAD..@{upstream}` > 0 ⇒ **红**。措辞只能是 `git fetch` + `git merge --ff-only FETCH_HEAD`
 *     (§5b 明令禁止 `git pull --rebase`:曾因此把真 gitdir 原生删除)。
 *  ② 主线 — `HEAD..origin/main` > `--max-behind` 时**分两种结论**:本地零独有提交 = 纯过期 ⇒ **红**;
 *     有独有提交 = 分叉正常 ⇒ 只把数字打出来让人决定(绝不替人判"该丢哪个")。
 *  ③ 工作树漂移面 — `git diff --name-only HEAD` 的**源码类**路径数,再用**守门 84 的祖先比对判据**
 *     (`analyze(root, paths, {source:'worktree'})`,单一真相源,本门不另抄一份)挑出其中"内容恰等于
 *     该路径某祖先版本"的路径 = 真正"在旧基线上开工"的那些,并点名最旧的那个 commit + 提交跨度。
 *
 * ── ③轴的边界(硬约束,不得改动) ─────────────────────────────────────────────
 * ③轴**绝不进提交链、绝不判 blocking**。本仓原话:"恒红门的唯一结局就是没人再守门"。
 * 具体形态:③轴的 raw 漂移数**永远只报数**(它判的是机器/并行会话状态,提交者结构上无法满足);
 * 而"等于祖先版本"那一子集的红,**只在显式传入 `--preflight`/`--strict-drift` 的开工自检档**才计进退出码。
 * 判定聚合见 `decide()` 的 drift 分支,`strictDrift` 默认 false ⇒ 提交链形态(不带该旗标)拿到 0。
 * 这条边界由 `scripts/tests/check-baseline-freshness.test.mjs` 用构造输入钉死(不靠本注释)。
 * ─────────────────────────────────────────────────────────────────────────────
 *
 * 不得把 ref 抖动当落后(§5b 实测):嵌套 `refs/remotes/origin/main` 会被宿主清理层**秒删**,
 * "看不到 origin/main" **不等于**"落后"。因此目标 ref 解析不到时先按既有口径
 * (`git-refs-heal.mjs --status` 的 missing 清单)排除 ref 抖动;排除不掉 ⇒ 报**无法判定**(exit 2),
 * **既不冒红也不记绿**(守门 30a 同型教训)。同理 fetch 失败也不得记绿。
 *
 * 全程只读:除 `git fetch`(只读远端 + 写本地 refs)外无任何写操作。`--check --no-fetch` 连 refs 都不写。
 *
 * 退出码(优先级:无法判定 > 判红 > 通过):
 *   0 三轴均已判定且无需动作
 *   1 至少一轴判红(③轴仅在 --preflight/--strict-drift 下可贡献这一位)
 *   2 命令行参数错误(未知开关 / 阈值非整数或负数),或某轴**无法判定**
 *
 * 用法:
 *   node scripts/check-baseline-freshness.mjs --check            # 零副作用(--no-fetch 时连本地 refs 都不写)
 *   node scripts/check-baseline-freshness.mjs --preflight        # 开工自检档:③轴旧基线子集超阈值也计红
 *   node scripts/check-baseline-freshness.mjs --json             # 机器可读(守护巡检账)
 *   node scripts/check-baseline-freshness.mjs --self-test        # 临时仓端到端 + decide() 构造面
 *   node scripts/check-baseline-freshness.mjs --max-behind 5 --max-stale 0 --no-fetch
 * 缺省阈值依据(2026-09-26 本机实测,门 103 的写法惯例:数字必须带出处):
 *   ①②0 —— "落后且不领先"就是纯过期,没有任何值得放过的中间带;
 *   ③  0 —— 零容忍能成立**不是因为旧基线常常为 0**(立项时读到 0,同日一次并发 union 合并后就
 *          变成 111;这类数字一律按当次实测取,不得当恒定前提),而是因为**③轴不进提交链**:
 *          红只在显式 --preflight 里出现,给的是"你正在 111 个路径的旧基线上开工"这条情报,
 *          而不是"谁都不许提交"。缺省档(--check / --staged)永远只报数 ⇒ 无人被恒红逼着绕钩子。
 */
import { spawnSync } from 'node:child_process'
import { existsSync, mkdirSync, writeFileSync } from 'node:fs'
import { dirname, join, resolve } from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'

import { analyze, ancestorCommits, worktreeDirtyPaths } from './check-stale-revert.mjs'
import { gitBinary, gitRaw, Undetermined } from './lib/face-reader.mjs'
import { mkScratch, rmScratch } from './lib/scratch-dir.mjs'

const HERE = dirname(fileURLToPath(import.meta.url))
const REPO = resolve(HERE, '..')

/** 源码类:与门 84 的"乘数级"面不重叠也不冲突,这里只按扩展名收窄(规格②:报的是源码类路径数) */
export const SOURCE_RE = /\.(?:ts|tsx|js|jsx|mjs|cjs|css|scss|sql|py)$/

/** ③轴旧基线比对的判定上限:门 84 逐文件跑 `git log`,漂移面极大时(整仓重排)必须封顶,
 *  否则这道"开工前 30 秒"的自检会自己变成分钟级挂起。未判定部分**如实报数**,不静默。 */
export const DRIFT_JUDGE_CAP = 300

export const DEFAULTS = Object.freeze({ maxBehind: 0, maxStale: 0 })

/** 白名单:未列出的开关一律 stderr 点名 + exit 2
 *  (本仓刚在 `sync-lost-commit-tags.mjs` 踩过:`--push` 拼错掉进 `--check` 分支还 exit 0) */
const BOOLEAN_FLAGS = new Set([
  '--check',
  '--preflight',
  '--strict-drift',
  '--staged',
  '--json',
  '--no-fetch',
  '--skip-drift-analysis',
  '--self-test',
  '--help',
])
const VALUE_FLAGS = new Set(['--max-behind', '--max-stale'])

/** 纯函数:参数解析。返回 {opts} 或 {error} —— 不 exit,便于测试直接断言分类。
 *
 * `--staged` 是**提交链档的显式名字**:`guardian-runner` 在 staged 模式下会给每道子门统一追加
 * 这个开关(它自己也是这么接的),所以本门必须认得它 —— 而且认出它之后做的事只有一件:
 * **强制 ③轴不判红**。这才是"③轴绝不进提交链"这条边界的可执行形态(而不是靠注释)。
 * 与 `--preflight`/`--strict-drift` 同时给出是语义冲突 ⇒ exit 2 拒绝,不猜哪一个优先。 */
export function parseArgs(argv) {
  const opts = {
    check: false,
    preflight: false,
    strictDrift: false,
    commitChain: false,
    json: false,
    noFetch: false,
    skipDriftAnalysis: false,
    selfTest: false,
    help: false,
    maxBehind: DEFAULTS.maxBehind,
    maxStale: DEFAULTS.maxStale,
  }
  const unknown = []
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i]
    if (VALUE_FLAGS.has(a)) {
      const raw = argv[++i]
      if (raw === undefined) return { error: `开关 ${a} 缺少数值(拿到的是行尾)` }
      if (!/^\d+$/.test(raw.trim())) return { error: `开关 ${a} 的值必须是非负整数,实到 "${raw}"` }
      const n = Number(raw)
      if (a === '--max-behind') opts.maxBehind = n
      else opts.maxStale = n
      continue
    }
    if (BOOLEAN_FLAGS.has(a)) {
      if (a === '--check') opts.check = true
      else if (a === '--preflight') opts.preflight = opts.strictDrift = true
      else if (a === '--strict-drift') opts.strictDrift = true
      else if (a === '--staged') opts.commitChain = true
      else if (a === '--json') opts.json = true
      else if (a === '--no-fetch') opts.noFetch = true
      else if (a === '--skip-drift-analysis') opts.skipDriftAnalysis = true
      else if (a === '--self-test') opts.selfTest = true
      else opts.help = true
      continue
    }
    unknown.push(a)
  }
  if (unknown.length)
    return {
      error: `未识别的开关:${unknown.join(' / ')}(可用:${[...BOOLEAN_FLAGS, ...VALUE_FLAGS].join(' ')})`,
    }
  if (opts.commitChain && opts.strictDrift)
    return {
      error:
        '--staged(提交链档,③轴按设计只报数)与 --preflight/--strict-drift(开工自检档)互斥;③轴的红不得走提交链',
    }
  if (opts.commitChain) opts.strictDrift = false
  return { opts }
}

function git(args, root, opts = {}) {
  // 每个派生都显式带 timeout(门 80 的立因就是热路径无界挂起 80 分钟)。
  return gitRaw(args, root, { timeout: 20000, ...opts })
}

/** 远端跟踪 ref 解析。返回 sha 或 null(解析不到 ≠ 落后,交给 ref 抖动排除器判)。 */
function resolveRef(root, ref) {
  try {
    return git(['rev-parse', '--verify', '--quiet', ref], root, { timeout: 10000 }).trim() || null
  } catch {
    return null
  }
}

/**
 * 按既有口径排除 ref 抖动:调 `git-refs-heal.mjs --status`(它的 missing 清单是 §5b 权威判据)。
 * 返回 {flapping:boolean, reason:string}。它自己跑不动时**不得猜**:reason 写清楚、按未判定处理。
 */
function checkRefFlapping(root) {
  const script = join(HERE, 'git-refs-heal.mjs')
  if (!existsSync(script))
    return { flapping: false, reason: 'git-refs-heal.mjs 不在位,无法排除 ref 抖动' }
  const r = spawnSync(process.execPath, [script, '--status'], {
    encoding: 'utf8',
    windowsHide: true,
    timeout: 60000,
    cwd: root,
  })
  let parsed = null
  try {
    parsed = JSON.parse(r.stdout || '')
  } catch {
    parsed = null
  }
  if (!parsed || !Array.isArray(parsed.missing))
    return {
      flapping: false,
      reason: `ref 抖动排查不可用(rc=${r.status}):${
        String(r.stderr || '')
          .trim()
          .slice(0, 120) || '无输出'
      }`,
    }
  return {
    flapping: parsed.missing.length > 0,
    reason: `refs-heal 报 ${parsed.missing.length} 个嵌套 ref 缺失`,
  }
}

function revListCount(root, range) {
  return Number(git(['rev-list', '--count', range], root, { timeout: 30000 }).trim())
}

/** 轴①②的取材:优先 FETCH_HEAD(fetch 刚成功时它是权威值 —— §5b:松散 remote-tracking ref 1 秒内即被清) */
function measureRemote(root, { noFetch }) {
  const out = { fetched: false, fetchError: null, upstreamName: null }
  if (!noFetch) {
    const r = spawnSync(
      gitBinary(),
      ['-c', 'safe.directory=*', 'fetch', '--no-tags', 'origin', 'main'],
      {
        encoding: 'utf8',
        windowsHide: true,
        timeout: 60000,
        cwd: root,
      },
    )
    if (r.status === 0) out.fetched = true
    else
      out.fetchError = String(r.stderr || r.stdout || `exit ${r.status}`)
        .trim()
        .split('\n')
        .slice(-1)[0]
  }
  try {
    out.upstreamName = git(
      ['rev-parse', '--abbrev-ref', '--symbolic-full-name', '@{upstream}'],
      root,
      {
        timeout: 10000,
      },
    ).trim()
  } catch {
    out.upstreamName = null
  }
  return out
}

/**
 * 三轴测量 → 纯数据。与判定分离,使镜像测试能用**构造输入**证明判据,
 * 而不必把仓库瞬时状态(今天恰好落后 0)当恒定前提。
 */
export function collect(
  root = REPO,
  { noFetch = false, skipDriftAnalysis = false, flapProbe = checkRefFlapping } = {},
) {
  const remote = measureRemote(root, { noFetch })
  const flap = () => flapProbe(root)

  // ── 轴① upstream ──
  const upstream = { ref: remote.upstreamName, state: 'skipped', behind: null }
  if (!remote.upstreamName || remote.upstreamName === '@{upstream}') {
    upstream.state = 'absent'
    upstream.reason = '本分支没有远端跟踪分支(worktree/游离 HEAD 属正常形态)'
  } else {
    const sha = resolveRef(root, remote.upstreamName)
    if (!sha) {
      const f = flap()
      upstream.state = 'undetermined'
      upstream.reason = `${remote.upstreamName} 解析不到 —— ${f.flapping ? `疑似 ref 抖动(${f.reason}),不判落后` : `未能排除 ref 抖动(${f.reason})`}。不冒红也不记绿`
    } else {
      upstream.behind = revListCount(root, `HEAD..${remote.upstreamName}`)
      upstream.state = 'ok'
    }
  }

  // ── 轴② 主线 ──
  const main = { state: 'ok', behind: 0, own: 0, source: null }
  if (!remote.fetched && !noFetch) {
    main.state = 'undetermined'
    main.reason = `fetch 未成功(远端态未知):${remote.fetchError || '未知原因'} ⇒ 不记绿`
  } else {
    const authoritative =
      (remote.fetched && resolveRef(root, 'FETCH_HEAD')) ||
      resolveRef(root, 'refs/remotes/origin/main')
    main.source = remote.fetched
      ? 'FETCH_HEAD(fetch 后权威值)'
      : 'refs/remotes/origin/main(本地 refs,未刷新)'
    if (!authoritative) {
      const f = flap()
      main.state = 'undetermined'
      main.reason = `origin/main 解析不到 —— ${f.flapping ? `疑似 ref 抖动(${f.reason})` : `未能排除 ref 抖动(${f.reason})`}`
    } else {
      main.behind = revListCount(root, `HEAD..${authoritative}`)
      main.own = revListCount(root, `${authoritative}..HEAD`)
    }
  }

  // ── 轴③ 工作树漂移面 ──
  const drift = { total: 0, source: 0, judged: 0, skippedJudge: 0, stale: [], analysis: 'on' }
  // 漂移路径清单同样复用门 84 的出口(单一形状,不另抄一份 `git diff --name-only HEAD`)
  const dirty = worktreeDirtyPaths(root)
  drift.total = dirty.length
  const srcPaths = dirty.filter((p) => SOURCE_RE.test(p))
  drift.source = srcPaths.length
  if (skipDriftAnalysis) drift.analysis = 'off'
  else {
    const judged = srcPaths.slice(0, DRIFT_JUDGE_CAP)
    drift.skippedJudge = srcPaths.length - judged.length
    drift.judged = judged.length
    // 复用门 84 的祖先比对判据(单一真相源);本门只再加一层"跨度"换算与点名排序。
    const hits = analyze(root, judged, { source: 'worktree' })
    drift.stale = hits.map((h) => {
      const list = ancestorCommits(root, h.path)
      const i = list.findIndex((c) => c.startsWith(h.commit))
      // span = 该路径上「匹配到的那个版本 → HEAD」之间的提交数(= 落后 HEAD 的提交跨度)。
      // i 恒 >= 1:等于 HEAD 那一版(i=0)的情况门 84 已自行跳过(cur === head 即不判),
      // 所以解析不到下标时如实给 null,不替数据编一个数。
      return { path: h.path, commit: h.commit, span: i >= 1 ? i : null }
    })
  }

  return { upstream, main, drift, fetched: remote.fetched, fetchError: remote.fetchError }
}

/**
 * 纯判定。输入是 `collect()` 的形状(测试可直接构造),输出 {code, lines, axes}。
 * 退出码优先级:undetermined(2) > red(1) > pass(0)。
 */
export function decide(m, lim = {}) {
  const { maxBehind = DEFAULTS.maxBehind, maxStale = DEFAULTS.maxStale, strictDrift = false } = lim
  const lines = []
  const axes = {}
  let anyUndetermined = false
  let anyRed = false

  // ①
  if (m.upstream.state === 'ok') {
    const red = m.upstream.behind > 0
    axes.upstream = { status: red ? 'red' : 'pass', behind: m.upstream.behind }
    if (red) {
      anyRed = true
      lines.push(
        `❌ 轴① 本分支落后 ${m.upstream.ref} **${m.upstream.behind} 个提交** —— 先对齐再动手:`,
      )
      lines.push('     git fetch origin main && git merge --ff-only FETCH_HEAD')
      lines.push('     (禁止 `git pull --rebase`:§5b 实测一次 rebase 崩溃把真 gitdir 原生删了)')
    } else lines.push(`✅ 轴① 不落后 ${m.upstream.ref}`)
  } else if (m.upstream.state === 'absent') {
    axes.upstream = { status: 'skipped', reason: m.upstream.reason }
    lines.push(`ℹ️  轴① ${m.upstream.reason} ⇒ 不计红也不计绿`)
  } else {
    axes.upstream = { status: 'undetermined', reason: m.upstream.reason }
    anyUndetermined = true
    lines.push(`⚠️  轴① **无法判定**:${m.upstream.reason}`)
  }

  // ②
  if (m.main.state === 'ok') {
    const over = m.main.behind > maxBehind
    const pureStale = over && m.main.own === 0
    axes.main = {
      status: pureStale ? 'red' : over ? 'report' : 'pass',
      behind: m.main.behind,
      own: m.main.own,
    }
    if (pureStale) {
      anyRed = true
      lines.push(
        `❌ 轴② 落后主线 **${m.main.behind} 个提交**(>阈值 ${maxBehind})且本地**零独有提交**`,
      )
      lines.push(
        '     ⇒ 这是纯过期,不是分叉。继续开工就是照旧实现写新东西(上游立因:落后 140 提交的窗口里',
      )
      lines.push('        有人重写了已消失的问题)。先 ff 对齐。')
    } else if (over) {
      lines.push(
        `ℹ️  轴② 落后主线 ${m.main.behind} 个提交(>阈值 ${maxBehind}),但本地有 ${m.main.own} 枚独有提交`,
      )
      lines.push('     ⇒ 分叉正常,只报数不判红(替人判"该丢哪边"才是事故)。要不要收敛由你定:')
      lines.push('        node scripts/git-sync-converge.mjs')
    } else
      lines.push(`✅ 轴② 落后主线 ${m.main.behind}(独有提交 ${m.main.own};取材=${m.main.source})`)
  } else {
    axes.main = { status: 'undetermined', reason: m.main.reason }
    anyUndetermined = true
    lines.push(`⚠️  轴② **无法判定**:${m.main.reason}`)
  }

  // ③ —— 见文件头「③轴的边界」:raw 漂移面永远只报数;旧基线子集仅在 strictDrift 下计红。
  const d = m.drift
  const staleN = d.stale.length
  const red = strictDrift && staleN > maxStale
  axes.drift = {
    status: red ? 'red' : 'report',
    strictDrift,
    total: d.total,
    sourceClass: d.source,
    judged: d.judged,
    skippedJudge: d.skippedJudge,
    stale: staleN,
    oldest: d.stale.reduce((a, b) => (a && a.span >= b.span ? a : b), null),
  }
  lines.push(
    `${red ? '❌' : 'ℹ️'}  轴③ 工作树 vs HEAD 漂移面 ${d.total} 个路径(源码类 ${d.source});其中**内容等于该路径某祖先版本**(= 在旧基线上开工)${staleN} 个` +
      `${d.analysis === 'off' ? '(本轮 --skip-drift-analysis:未做祖先比对)' : d.skippedJudge ? `;另有 ${d.skippedJudge} 个超出判定上限 ${DRIFT_JUDGE_CAP},未比对` : ''}`,
  )
  if (staleN) {
    const sorted = [...d.stale].sort((a, b) => (b.span ?? -1) - (a.span ?? -1))
    for (const s of sorted.slice(0, 10))
      lines.push(`     - ${s.path}  ==  ${s.commit}${s.span ? ` (落后 ${s.span} 次改动)` : ''}`)
    if (sorted.length > 10) lines.push(`     ... 另有 ${sorted.length - 10} 个`)
    lines.push('     对齐单个文件(确认其中没有你自己的未提交改动后):')
    lines.push('       git restore --source=HEAD --worktree -- <文件>')
  }
  if (red) anyRed = true
  else if (staleN)
    lines.push(
      `     ⚠️ ③轴**不进提交链**(恒红门只会逼人 --no-verify,连带废掉全部守门)⇒ 此处仅报数;` +
        `开工自检档请加 --preflight,或自行按上面的数字决定是否先对齐`,
    )

  lines.push('')
  lines.push(
    anyUndetermined
      ? `⚠️  基线新鲜度:**无法判定**(至少一轴取不到可信输入)—— 既不冒红也不记绿,exit 2`
      : anyRed
        ? '❌ 基线新鲜度不达标 —— 先对齐再开工'
        : '✅ 基线新鲜度自检通过(三轴均已判定)',
  )
  return { code: anyUndetermined ? 2 : anyRed ? 1 : 0, lines, axes }
}

function usage() {
  return [
    '用法: node scripts/check-baseline-freshness.mjs [--check|--preflight] [--json] [--no-fetch]',
    '      [--skip-drift-analysis] [--max-behind N] [--max-stale N] [--self-test] [--help]',
    '',
    '  --check               只判定(默认档:③轴只报数,绝不因它非零)',
    '  --preflight           开工自检档 = --check + ③轴旧基线子集超阈值计红',
    '  --strict-drift        同上(只改③轴这一维)',
    '  --staged              提交链档(guardian-runner 统一追加):③轴强制只报数,与上面两旗标互斥',
    '  --no-fetch            不联网:仅按本地 refs 判定(结论行会如实标注取材面)',
    '  --skip-drift-analysis ③轴不做祖先比对(守护巡检的便宜账)',
    `  --max-behind N        轴②阈值,缺省 ${DEFAULTS.maxBehind}`,
    `  --max-stale N         轴③旧基线路径数阈值,缺省 ${DEFAULTS.maxStale}`,
  ].join('\n')
}

async function run(argv) {
  const parsed = parseArgs(argv)
  if (parsed.error) {
    console.error(`❌ ${parsed.error}`)
    console.error(usage())
    return 2
  }
  const opts = parsed.opts
  if (opts.help) {
    console.log(usage())
    return 0
  }
  if (opts.selfTest) return selfTestRun()

  const m = collect(REPO, { noFetch: opts.noFetch, skipDriftAnalysis: opts.skipDriftAnalysis })
  const v = decide(m, {
    maxBehind: opts.maxBehind,
    maxStale: opts.maxStale,
    strictDrift: opts.strictDrift,
  })
  if (opts.json) console.log(JSON.stringify({ ...v, measured: m }, null, 1))
  else console.log(v.lines.join('\n'))
  return v.code
}

/** 临时仓 + 构造输入取证:每条判据都必须有正反对照(不拿真仓瞬时状态当尺子)。 */
function selfTestRun() {
  const results = []
  const check = (name, ok) => results.push({ name, ok })
  let fx = null
  try {
    // ── decide() 构造面:三轴各自的红 / 不红 ──
    const base = {
      upstream: { state: 'ok', ref: 'origin/main', behind: 0 },
      main: { state: 'ok', behind: 0, own: 0, source: 'test' },
      drift: { total: 0, source: 0, judged: 0, skippedJudge: 0, stale: [], analysis: 'on' },
    }
    const B = (behind) => decide({ ...base, upstream: { ...base.upstream, behind } })
    check('①落后 1 枚 ⇒ exit 1', B(1).code === 1)
    check('①不落后 ⇒ exit 0(同一条判据的反例)', B(0).code === 0)
    check(
      '① 无 upstream ⇒ skipped 且不贡献红',
      B(9).code === 1 &&
        decide({
          ...base,
          upstream: { state: 'absent', reason: 'x', behind: null },
          main: { ...base.main, behind: 9 },
        }).code === 1,
    )
    const M = (behind, own) => decide({ ...base, main: { ...base.main, behind, own } })
    check('②落后 5 且独有提交 0 ⇒ 纯过期判红', M(5, 0).code === 1)
    check('②落后 5 但独有提交 3 ⇒ 只报数不判红(分叉正常)', M(5, 3).code === 0)
    check('② 未超阈值不判红', M(0, 0).code === 0)
    check(
      '②fetch 失败 ⇒ undetermined,既不红也不绿',
      decide({ ...base, main: { state: 'undetermined', reason: 'fetch 未成功' } }).code === 2,
    )
    check(
      '①ref 解析不到 ⇒ undetermined',
      decide({ ...base, upstream: { state: 'undetermined', reason: 'ref 抖动未排除' } }).code === 2,
    )
    check(
      'red 与 undetermined 同时存在 ⇒ exit 2 优先',
      decide({
        ...base,
        upstream: { state: 'ok', ref: 'o/m', behind: 3 },
        main: { state: 'undetermined', reason: 'x' },
      }).code === 2,
    )

    // ── ③轴边界:同一份数据,strictDrift 两种取值 ⇒ 退出码必须不同 ──
    const drifted = {
      ...base,
      drift: {
        total: 400,
        source: 380,
        judged: 300,
        skippedJudge: 80,
        analysis: 'on',
        stale: [{ path: 'a.ts', commit: 'deadbeef0', span: 7 }],
      },
    }
    const notStrict = decide(drifted, { strictDrift: false })
    const strict = decide(drifted, { strictDrift: true, maxStale: 0 })
    check('③旧基线超阈值**未开 strict ⇒ exit 0**(提交链形态拿不到红)', notStrict.code === 0)
    check('③同一份数据开 strict ⇒ exit 1(判据有牙,只是不吃提交链)', strict.code === 1)
    check(
      '③报数不静默:两种档都如实印出漂移面与路径数',
      notStrict.lines.join('\n').includes('漂移面 400') &&
        strict.lines.join('\n').includes('漂移面 400'),
    )
    check(
      '③点名最旧 commit 与跨度',
      strict.lines.join('\n').includes('deadbeef0') &&
        strict.lines.join('\n').includes('落后 7 次改动'),
    )
    check(
      '③ axes.drift.status 在未开 strict 时必须是 report',
      notStrict.axes.drift.status === 'report' && strict.axes.drift.status === 'red',
    )
    check(
      '③ strict 档下 maxStale 抬高即免债(阈值真的在读)',
      decide(drifted, { strictDrift: true, maxStale: 5 }).code === 0,
    )

    // ── 命令行白名单与阈值校验 ──
    check('未知开关 ⇒ error(不得静默落进默认档)', !!parseArgs(['--push']).error)
    check('--max-behind 非整数 ⇒ error', !!parseArgs(['--max-behind', 'x']).error)
    check('--max-behind 负数 ⇒ error', !!parseArgs(['--max-behind', '-1']).error)
    check(
      '--max-behind 合法整数 ⇒ 解析成功',
      parseArgs(['--max-behind', '5']).opts?.maxBehind === 5,
    )
    check('--preflight 隐含 strict-drift', parseArgs(['--preflight']).opts?.strictDrift === true)
    check(
      '--check 不得带上 strictDrift(③轴边界的第一道锁)',
      parseArgs(['--check']).opts?.strictDrift === false,
    )
    check(
      '--staged(runner 统一追加的提交链档)必须被认得,不得判成未知开关',
      !parseArgs(['--staged']).error,
    )
    check(
      '--staged 强制 strictDrift=false(提交链档拿不到③轴的红)',
      parseArgs(['--staged']).opts?.strictDrift === false,
    )
    check(
      '--staged 与 --preflight 互斥 ⇒ 拒绝,不猜优先级',
      !!parseArgs(['--staged', '--preflight']).error,
    )
    check('--staged 与 --strict-drift 同样互斥', !!parseArgs(['--strict-drift', '--staged']).error)

    // ── 真仓夹具端到端:③轴点名最旧 commit 的正反例(不拿真仓瞬时状态当尺子) ──
    fx = makeGitRepo()
    fx.put('a.ts', 'v1\n')
    fx.put('b.ts', 'b1\n')
    fx.commit('A')
    fx.put('a.ts', 'v2\n')
    fx.commit('B')
    const off = { noFetch: true, flapProbe: () => ({ flapping: false, reason: 'stub' }) }
    check(
      '③反例:工作树等于 HEAD ⇒ 漂移面 0 / 旧基线 0',
      collect(fx.dir, off).drift.total === 0 && collect(fx.dir, off).drift.stale.length === 0,
    )
    fx.put('a.ts', 'v1\n')
    const d1 = collect(fx.dir, off)
    check(
      '③正例:写回祖先版本被挑出并给出跨度',
      d1.drift.stale.length === 1 &&
        d1.drift.stale[0].path === 'a.ts' &&
        d1.drift.stale[0].span === 1,
    )
    check(
      '③判定复用门 84 的 source=worktree 面(源码类计数与被判数一致)',
      d1.drift.source === 1 && d1.drift.judged === d1.drift.source,
    )
    fx.put('b.ts', 'b-brand-new-never-committed\n')
    const d2 = collect(fx.dir, off)
    check(
      '③反例:真新编辑不算旧基线(否则每次开工都红)',
      d2.drift.stale.length === 1 && d2.drift.total === 2 && d2.drift.source === 2,
    )
    check(
      '③ skipDriftAnalysis 档:只报漂移数、不做比对(守护便宜账)',
      collect(fx.dir, { ...off, skipDriftAnalysis: true }).drift.analysis === 'off',
    )
    check(
      '②ref 取不到且探针说无抖动 ⇒ undetermined(不冒红)',
      collect(fx.dir, off).main.state === 'undetermined',
    )
    check('①无 upstream ⇒ absent(skipped)', collect(fx.dir, off).upstream.state === 'absent')
  } catch (e) {
    check(`self-test 抛异常: ${e?.message ?? e}`, false)
  } finally {
    if (fx) fx.cleanup()
  }
  let fail = 0
  for (const r of results) {
    console.log(`${r.ok ? '✅' : '❌'} ${r.name}`)
    if (!r.ok) fail++
  }
  console.log(
    fail
      ? `self-test FAILED ${fail}/${results.length}`
      : `✅ check-baseline-freshness self-test 全部通过(${results.length} 例)`,
  )
  return fail ? 1 : 0
}

// ── 临时 git 仓夹具(落点走 scripts/lib/scratch-dir.mjs,不自己造第五个落点) ──
export function makeGitRepo() {
  const dir = mkScratch('baseline-freshness-')
  const run = (...a) => {
    const r = spawnSync(
      gitBinary(),
      ['-c', 'safe.directory=*', '-c', 'core.autocrlf=false', '-C', dir, ...a],
      {
        encoding: 'utf8',
        windowsHide: true,
        timeout: 60000,
      },
    )
    if (r.status !== 0) throw new Error(`git ${a.join(' ')} 失败:${String(r.stderr || '').trim()}`)
    return String(r.stdout || '').trim()
  }
  run('init', '-q', '--initial-branch=main')
  run('config', 'user.email', 't@t')
  run('config', 'user.name', 't')
  return {
    dir,
    run,
    put(rel, text) {
      const abs = join(dir, rel)
      mkdirSync(dirname(abs), { recursive: true })
      writeFileSync(abs, text, 'utf8')
    },
    commit(msg) {
      run('add', '-A')
      run('commit', '-qm', msg)
    },
    cleanup() {
      rmScratch(dir)
    },
  }
}

const isDirectRun = process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href

if (isDirectRun) {
  run(process.argv.slice(2))
    .then((code) => {
      if (code) process.exit(code)
    })
    .catch((e) => {
      const msg = e instanceof Undetermined ? 'git 派生取不到输入(无法判定)' : '脚本自身异常'
      console.error(`❌ ${msg}:${e?.message ?? e}\n${e?.stack ?? ''}`)
      process.exit(2)
    })
}

export const __test__ = {
  parseArgs,
  decide,
  collect,
  makeGitRepo,
  SOURCE_RE,
  DEFAULTS,
  DRIFT_JUDGE_CAP,
  checkRefFlapping,
}
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
