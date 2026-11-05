#!/usr/bin/env node
// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/* eslint-disable no-console -- 只读尺子为 CLI 工具,需 console 输出诊断读数 */
/**
 * 快照积压只读温度计(goal-b49 W3 立,2026-11-05)— **当前没有任何调度器,也刻意不进提交链**。
 *
 * 立因:会话快照的版本序列与三约束回收判据已落 `apps/cli/src/checkpoints/snapshot-gc.ts`
 * (枚 e423b7123f364a0d4545bc84936ee7f6dfa7a181),但"积压多少枚 / 最老的多久没清 / 盘上有多少枚
 * 注定判不出来"此前无人量过 —— 回收只在跑过它的那个进程内存里留下账面(§0.9「没判」不得写成「判过」)。
 *
 * 三个读数,绝不并桶:
 *  ① 快照积压 = 会话目录数 / 版本序列枚数 / 历史 cp_ 枚数 / 其他命名枚数 + 总字节
 *  ② 最老快照年龄 = 可解析 createdAt 里最老一枚距当次的天数;一条都解析不出 ⇒ null(不拿 0 冒充"没得算")
 *  ③ 判不出目录 = 盘侧会让 in-app 回收整轮落 undetermined 的枚数,逐因分档:
 *     manifest-missing / manifest-corrupt / manifest-unreadable(createdAt 解析不出)/ size-unmeasurable
 *     档名沿用 snapshot-gc.ts 的词汇便于对账;**本尺不复算回收判据**(该删几枚归那边的 plan,§0.6)。
 *     盲区(本尺不判,逐条点名):malformed-dir-name / duplicate-version / series-regression /
 *     no-candidates / invalid-policy —— 这五档要序列档与时钟才能算,只读温度计不越界去抄。
 *
 * 定档(§12e:量的是本机盘上状态,提交者结构上满足不了 ⇒ 进提交链就是恒红门;本尺不做任何接线声称):
 *  exit 2 = 未判定:快照根取不到 / 不可读 / 枚举到 0 个会话目录(§0.3,不用 0 冒充"没有")
 *  exit 1 = 判出且 ③ > 0:可整改 —— 补清单、修 JSON、让目录可枚举,是人能做的动作(§5e-1)
 *  exit 0 = 判出且 ③ == 0:积压与年龄**只报数**;红档要么抄 GC 策略要么拍数,本尺两者都不做。
 *           要设档由调用方按当次现读分布显式给 --max-dirs / --max-age-days,给了才判。
 *
 * 用法:
 *   node scripts/check-snapshot-backlog.mjs                        # 人读档
 *   node scripts/check-snapshot-backlog.mjs --json                 # 机读档
 *   node scripts/check-snapshot-backlog.mjs --root <dir>           # 指定快照根(默认 ~/.ihui/checkpoints)
 *   node scripts/check-snapshot-backlog.mjs --max-dirs 40 --max-age-days 30
 *   node scripts/check-snapshot-backlog.mjs --self-test            # 构造面自检(不碰真盘)
 * 测试通道:`--root` 注入夹具;判据函数只从 __test__ 出口取
 * (镜像 `scripts/tests/check-snapshot-backlog.test.mjs`,§22c 禁止测试里复制判据)。
 */
import { readdirSync, readFileSync, statSync, existsSync } from 'node:fs'
import { homedir } from 'node:os'
import { join, resolve } from 'node:path'
import { pathToFileURL } from 'node:url'

export const UNDETERMINED_REASONS = [
  'manifest-missing',
  'manifest-corrupt',
  'manifest-unreadable',
  'size-unmeasurable',
]
export const BLIND_SPOT_REASONS = [
  'malformed-dir-name',
  'duplicate-version',
  'series-regression',
  'no-candidates',
  'invalid-policy',
]
/** 量体积的枚举预算:超预算 ⇒ 量不出来(与 snapshot-gc 的候选输入档同形:量不出就不删) */
export const SIZE_SCAN_BUDGET = 2000

export function defaultSnapshotRoot() {
  return join(homedir(), '.ihui', 'checkpoints')
}

export function bucketOfDirName(name) {
  if (name.includes('@v')) return 'series'
  if (name.startsWith('cp_')) return 'legacy'
  return 'other'
}

export function measureDirBytes(dir, budget = SIZE_SCAN_BUDGET) {
  let bytes = 0
  let visited = 0
  const stack = [dir]
  while (stack.length > 0) {
    const current = stack.pop()
    let items
    try {
      items = readdirSync(current, { withFileTypes: true })
    } catch {
      return null
    }
    for (const item of items) {
      visited += 1
      if (visited > budget) return null
      const child = join(current, item.name)
      if (item.isDirectory()) {
        stack.push(child)
        continue
      }
      try {
        const st = statSync(child)
        if (st.isFile()) bytes += st.size
      } catch {
        return null
      }
    }
  }
  return bytes
}

/** 单个快照目录的盘侧观测(纯 IO,零判据):清单在否 / JSON 能不能解 / createdAt 能不能解析 / 体积量得出否 */
export function observeSnapshotDir(dir) {
  const manifestPath = join(dir, 'manifest.json')
  const obs = { manifest: 'ok', createdAtMs: null, bytes: null }
  if (!existsSync(manifestPath)) {
    obs.manifest = 'missing'
  } else {
    let parsed
    try {
      parsed = JSON.parse(readFileSync(manifestPath, 'utf-8'))
    } catch {
      obs.manifest = 'corrupt'
    }
    if (obs.manifest === 'ok') {
      const raw = parsed && typeof parsed === 'object' ? parsed.createdAt : undefined
      const t = Date.parse(typeof raw === 'string' ? raw : '')
      obs.createdAtMs = Number.isFinite(t) ? t : null
      if (obs.createdAtMs === null) obs.manifest = 'unreadable'
    }
  }
  obs.bytes = measureDirBytes(dir)
  return obs
}

/** 观测 → 本尺射程内的判不出因(一目录可命中多条,逐条计,不并桶;清单本身出问题的不再叠加"时刻读不出") */
export function undeterminedReasonsOf(obs) {
  const reasons = []
  if (obs.manifest === 'missing') reasons.push('manifest-missing')
  else if (obs.manifest === 'corrupt') reasons.push('manifest-corrupt')
  else if (obs.manifest === 'unreadable') reasons.push('manifest-unreadable')
  if (obs.bytes === null || !Number.isFinite(obs.bytes)) reasons.push('size-unmeasurable')
  return reasons
}

/** 扫快照根:返回 status='unavailable' + 原因,或逐会话的观测明细(枚举到 0 个会话目录 ⇒ 也算未判定) */
export function scanSnapshotRoot(root, observe = observeSnapshotDir) {
  let sessions
  try {
    if (!existsSync(root))
      return { status: 'unavailable', reason: 'root-missing', root, sessions: [] }
    sessions = readdirSync(root, { withFileTypes: true }).filter((d) => d.isDirectory())
  } catch (err) {
    return {
      status: 'unavailable',
      reason: 'root-unreadable',
      detail: err instanceof Error ? err.message : String(err),
      root,
      sessions: [],
    }
  }
  if (sessions.length === 0)
    return { status: 'unavailable', reason: 'no-sessions', root, sessions: [] }
  const perSession = sessions.map((s) => {
    const sessionDir = join(root, s.name)
    let names = []
    try {
      names = readdirSync(sessionDir, { withFileTypes: true })
        .filter((d) => d.isDirectory())
        .map((d) => d.name)
    } catch {
      return { session: s.name, unreadable: true, dirs: [] }
    }
    const dirs = names.map((name) => {
      const obs = observe(join(sessionDir, name))
      return {
        session: s.name,
        name,
        bucket: bucketOfDirName(name),
        bytes: obs.bytes,
        createdAtMs: obs.createdAtMs,
        reasons: undeterminedReasonsOf(obs),
      }
    })
    return { session: s.name, unreadable: false, dirs }
  })
  return { status: 'ok', root, sessions: perSession }
}

export function summarizeScan(scan, { root, nowMs, maxDirs = null, maxAgeDays = null }) {
  if (scan.status !== 'ok') {
    return {
      root,
      state: 'undetermined',
      reason: scan.reason,
      detail: scan.detail ?? null,
      backlog: null,
      oldestAgeDays: null,
      undetermined: { dirs: 0, byReason: {} },
      budgets: { maxDirs, maxAgeDays },
      blindSpots: [...BLIND_SPOT_REASONS],
    }
  }
  const dirs = scan.sessions.flatMap((s) => s.dirs)
  const byReason = {}
  for (const d of dirs) for (const r of d.reasons) byReason[r] = (byReason[r] ?? 0) + 1
  const ages = dirs
    .filter((d) => d.createdAtMs !== null)
    .map((d) => (nowMs - d.createdAtMs) / 86_400_000)
  const measurable = dirs.filter((d) => typeof d.bytes === 'number')
  const backlog = {
    sessions: scan.sessions.length,
    unreadableSessions: scan.sessions.filter((s) => s.unreadable).length,
    total: dirs.length,
    series: dirs.filter((d) => d.bucket === 'series').length,
    legacy: dirs.filter((d) => d.bucket === 'legacy').length,
    other: dirs.filter((d) => d.bucket === 'other').length,
    bytesMeasurableDirs: measurable.length,
    totalBytes: measurable.reduce((sum, d) => sum + d.bytes, 0),
  }
  const oldestAgeDays = ages.length > 0 ? Math.max(...ages) : null
  return {
    root,
    state: 'judged',
    reason: null,
    detail:
      ages.length === 0 && dirs.length > 0
        ? '一条 createdAt 都解析不出 ⇒ 年龄读数记 null(未判定),不拿 0 冒充"最新"'
        : dirs.length === 0
          ? '会话目录全空 ⇒ 积压读数为 0 枚(确有此状,非取不到输入)'
          : null,
    backlog,
    oldestAgeDays,
    undetermined: { dirs: dirs.filter((d) => d.reasons.length > 0).length, byReason },
    budgets: { maxDirs, maxAgeDays },
    blindSpots: [...BLIND_SPOT_REASONS],
    dirs,
  }
}

export function verdictOf(report) {
  if (report.state !== 'judged') return 'undetermined'
  const flags = []
  if (report.undetermined.dirs > 0) flags.push(`判不出目录 ${report.undetermined.dirs} 枚`)
  if (report.backlog.unreadableSessions > 0)
    flags.push(`会话目录不可枚举 ${report.backlog.unreadableSessions} 个`)
  if (report.budgets.maxDirs !== null && report.backlog.total > report.budgets.maxDirs) {
    flags.push(`积压 ${report.backlog.total} 枚 > 显式预算 ${report.budgets.maxDirs}`)
  }
  if (
    report.budgets.maxAgeDays !== null &&
    report.oldestAgeDays !== null &&
    report.oldestAgeDays > report.budgets.maxAgeDays
  ) {
    flags.push(
      `最老快照 ${report.oldestAgeDays.toFixed(1)} 天 > 显式预算 ${report.budgets.maxAgeDays} 天`,
    )
  }
  if (
    report.budgets.maxAgeDays !== null &&
    report.oldestAgeDays === null &&
    report.backlog.total > 0
  ) {
    flags.push('设了年龄预算但年龄未判定 ⇒ 不判绿')
  }
  return flags.length > 0 ? { verdict: 'flagged', flags } : { verdict: 'clear', flags }
}

export function exitCodeOf(report, verdict) {
  if (report.state !== 'judged') return 2
  const shape = typeof verdict === 'string' ? verdict : verdict && verdict.verdict
  return shape === 'flagged' ? 1 : 0
}

export function formatReadout(report, verdict) {
  const lines = [`快照根: ${report.root}`]
  if (report.state !== 'judged') {
    lines.push(
      `状态: 未判定(未取到输入) 原因: ${report.reason}${report.detail ? ` —— ${report.detail}` : ''}`,
    )
    lines.push('⇒ 不出合格证:没量到就是没量到,不拿 0 冒充"没有积压"(AGENTS §0.3)')
    return lines
  }
  const b = report.backlog
  lines.push(
    `① 积压: 会话 ${b.sessions} 个 / 快照目录 ${b.total} 枚(版本序列 ${b.series}、历史 cp_ ${b.legacy}、其他 ${b.other})/ 量得出体积 ${b.bytesMeasurableDirs} 枚、合计 ${b.totalBytes} B`,
  )
  lines.push(
    `② 最老快照年龄: ${report.oldestAgeDays === null ? '未判定(无一条 createdAt 解析得出)' : `${report.oldestAgeDays.toFixed(1)} 天`}`,
  )
  const reasons = Object.entries(report.undetermined.byReason)
  lines.push(
    `③ 判不出目录: ${report.undetermined.dirs} 枚${reasons.length ? ` —— ${reasons.map(([k, v]) => `${k}=${v}`).join(', ')}` : ''}`,
  )
  lines.push(`   本尺盲区(不判,归回收判据侧): ${report.blindSpots.join(', ')}`)
  if (report.detail) lines.push(`   注: ${report.detail}`)
  lines.push(
    typeof verdict === 'string'
      ? `判定: ${verdict}`
      : `判定: ${verdict.verdict}${verdict.flags.length ? ` —— ${verdict.flags.join(' / ')}` : ''}`,
  )
  return lines
}

function runSelfTest() {
  const nowMs = Date.UTC(2026, 10, 5)
  const DAY = 86_400_000
  const cases = []
  const push = (name, ok) => cases.push({ name, ok })
  const fakeScan = (dirs) => ({
    status: 'ok',
    root: '/fake',
    sessions: [
      {
        session: 's1',
        unreadable: false,
        dirs: dirs.map((d) => ({ ...d, bucket: bucketOfDirName(d.name) })),
      },
    ],
  })
  const mk = (name, { createdAtMs = nowMs - DAY, bytes = 10, reasons = [] }) => ({
    name,
    createdAtMs,
    bytes,
    reasons,
  })
  const clean = summarizeScan(fakeScan([mk('u@v1', {})]), { root: '/fake', nowMs })
  push(
    '清档 ⇒ clear',
    verdictOf(clean).verdict === 'clear' && exitCodeOf(clean, verdictOf(clean)) === 0,
  )
  const withFlag = summarizeScan(fakeScan([mk('u@v1', { reasons: ['manifest-missing'] })]), {
    root: '/fake',
    nowMs,
  })
  push('判不出目录 ⇒ flagged/1', exitCodeOf(withFlag, verdictOf(withFlag)) === 1)
  const missing = summarizeScan(
    { status: 'unavailable', reason: 'root-missing', sessions: [] },
    { root: '/fake', nowMs },
  )
  push(
    '取不到根 ⇒ 未判定/2',
    exitCodeOf(missing, verdictOf(missing)) === 2 && missing.backlog === null,
  )
  const noSessions = summarizeScan(
    { status: 'unavailable', reason: 'no-sessions', sessions: [] },
    { root: '/fake', nowMs },
  )
  push('枚举到 0 会话 ⇒ 未判定(不记绿)', noSessions.state === 'undetermined')
  const noAge = summarizeScan(
    fakeScan([mk('u@v1', { createdAtMs: null, reasons: ['manifest-unreadable'] })]),
    {
      root: '/fake',
      nowMs,
      maxAgeDays: 30,
    },
  )
  push('设了年龄预算但年龄未判定 ⇒ 不判绿', exitCodeOf(noAge, verdictOf(noAge)) === 1)
  const over = summarizeScan(fakeScan([mk('u@v1', {}), mk('u@v2', {})]), {
    root: '/fake',
    nowMs,
    maxDirs: 1,
  })
  push('显式积压预算越界 ⇒ flagged', exitCodeOf(over, verdictOf(over)) === 1)
  push('分桶只按字面:cp_ → legacy', bucketOfDirName('cp_1700000000000_abc') === 'legacy')
  push('分桶:含 @v → series(仅读数分桶)', bucketOfDirName('u@v7') === 'series')
  push(
    '盲区五档逐条点名不静默',
    BLIND_SPOT_REASONS.length === 5 && verdictOf(clean).flags.length === 0,
  )
  let bad = 0
  for (const c of cases) {
    console.log(`${c.ok ? 'PASS' : 'FAIL'} ${c.name}`)
    if (!c.ok) bad += 1
  }
  console.log(`SELF-TEST ${cases.length - bad}/${cases.length} 通过`)
  process.exitCode = bad > 0 ? 1 : 0
}

export function parseArgv(argv) {
  const out = { root: null, maxDirs: null, maxAgeDays: null, json: false, selfTest: false }
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i]
    if (a === '--root') out.root = argv[++i]
    else if (a === '--max-dirs') out.maxDirs = Number(argv[++i])
    else if (a === '--max-age-days') out.maxAgeDays = Number(argv[++i])
    else if (a === '--json') out.json = true
    else if (a === '--self-test') out.selfTest = true
  }
  return out
}

function main() {
  const argv = parseArgv(process.argv.slice(2))
  if (argv.selfTest) {
    runSelfTest()
    return
  }
  const root = argv.root ? resolve(argv.root) : defaultSnapshotRoot()
  const scan = scanSnapshotRoot(root)
  const report = summarizeScan(scan, {
    root,
    nowMs: Date.now(),
    maxDirs: argv.maxDirs,
    maxAgeDays: argv.maxAgeDays,
  })
  const verdict = verdictOf(report)
  if (argv.json) {
    const { dirs, ...rest } = report
    console.log(
      JSON.stringify({ ...rest, dirsObserved: dirs ? dirs.length : null, verdict }, null, 2),
    )
  } else {
    for (const line of formatReadout(report, verdict)) console.log(line)
  }
  process.exitCode = exitCodeOf(report, verdict)
}

/** §22c:镜像测试只从这里取判据函数,不在测试里另抄一份字面量。 */
export const __test__ = {
  UNDETERMINED_REASONS,
  BLIND_SPOT_REASONS,
  SIZE_SCAN_BUDGET,
  bucketOfDirName,
  measureDirBytes,
  observeSnapshotDir,
  undeterminedReasonsOf,
  scanSnapshotRoot,
  summarizeScan,
  verdictOf,
  exitCodeOf,
  formatReadout,
  parseArgv,
  defaultSnapshotRoot,
}

const isDirectRun =
  process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href
if (isDirectRun) {
  main()
}
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
