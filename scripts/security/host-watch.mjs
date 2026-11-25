// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * 主机侧实时检测(2026-11-25 立)。
 *
 * 缺的是什么:`host-triage` 三查(webshell 落地 / 异常外连 / 持久化新增)能力都在,
 * 但它要**人去跑**。webshell 从落地到被发现之间是空的 —— 这一段时间的攻防主动权
 * 完全在对手手上。本脚本把它变成节律动作,并把"重复看见同一件事"从告警里滤掉。
 *
 * 为什么必须滤:同一个 webshell 每 10 分钟被复检一次,每次都是它 —— 不滤就等于
 * 每 10 分钟发一封一模一样的告警,三次之后就没人再读了(告警疲劳 = 等于没有告警)。
 * 指纹**只取 type + detail**,不含时间戳/序号:含了就每轮都是新指纹,结构上永不命中。
 *
 * 两条纪律:
 *   · 未判定时不推进已见台账 —— 否则"这轮没查清"会把下一轮的真发现当成旧闻;
 *   · 告警节律由本脚本自己控(`IHUI_HOST_WATCH_WINDOW_MIN`,默认 60 分钟),
 *     窗口内新增只进 pending,到点一封把积压倒干净 —— 不丢发现,也不刷屏。
 *
 * 用法: node scripts/security/host-watch.mjs [--json] [--dry-run] [--force-alert]
 * 退出码: 0=无新增 / 1=有新增(或积压待发) / 2=未判定。
 */
import { spawnSync } from 'node:child_process'
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import { dirname, join, resolve } from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'

const HERE = dirname(fileURLToPath(import.meta.url))
const ROOT = resolve(HERE, '..', '..')
const TRIAGE = join(HERE, 'host-triage.mjs')
// 台账路径可被 env 覆盖:演练"发现 → 不重复报"时必须能指向副本,
// 否则演练留下的假指纹要么污染真台账,要么逼着拿生产当试验场。
const STATE_PATH = process.env.IHUI_HOST_WATCH_STATE
  ? resolve(process.env.IHUI_HOST_WATCH_STATE)
  : join(ROOT, '.ihui-agent', 'state', 'host-watch.json')
const WINDOW_MIN = Number(process.env.IHUI_HOST_WATCH_WINDOW_MIN || 60)
const MAX_SEEN = 2000

export const WATCH_STATE = Object.freeze({ OK: 'ok', NEW: 'new', UNDETERMINED: 'undetermined' })

/** 指纹只由 type + detail 决定。不含时刻/计数 —— 那是"每轮换身份"的典型写法。 */
export function fingerprintOf(finding) {
  return `${String(finding?.type ?? 'unknown')}|${String(finding?.detail ?? '').trim()}`
}

export function diffFindings(findings, seen) {
  const known = new Set(Array.isArray(seen) ? seen : [])
  const fresh = []
  for (const f of Array.isArray(findings) ? findings : []) {
    const fp = fingerprintOf(f)
    if (!known.has(fp)) fresh.push({ fp, finding: f })
  }
  return fresh
}

/** 节律判据:有积压 + 到点才发。取不到上次时刻按"从未告警"处理(失效方向是多发一封)。 */
export function shouldAlert({ pending, lastAlertAt, now = Date.now(), windowMin = WINDOW_MIN } = {}) {
  if (!Array.isArray(pending) || pending.length === 0) return { send: false, reason: '无待发' }
  if (!lastAlertAt) return { send: true, reason: '从未告警过' }
  const t = new Date(lastAlertAt).getTime()
  if (!Number.isFinite(t)) return { send: true, reason: '上次告警时刻无法解析,按未告警处理' }
  const minutes = Math.round((now - t) / 60_000)
  return minutes >= windowMin
    ? { send: true, reason: `距上次 ${minutes} 分钟 ≥ ${windowMin}` }
    : { send: false, reason: `距上次 ${minutes} 分钟,积压 ${pending.length} 条` }
}

function readState() {
  if (!existsSync(STATE_PATH)) return { version: 1, updatedAt: null, seen: [], pending: [], lastAlertAt: null }
  try {
    const j = JSON.parse(readFileSync(STATE_PATH, 'utf8'))
    return {
      version: 1,
      updatedAt: j.updatedAt ?? null,
      seen: Array.isArray(j.seen) ? j.seen : [],
      pending: Array.isArray(j.pending) ? j.pending : [],
      lastAlertAt: j.lastAlertAt ?? null,
    }
  } catch {
    // 台账损坏:读不出来就不许当作"没有已见项"——那会让所有发现重新变成新增。
    return { version: 1, updatedAt: null, seen: null, pending: [], lastAlertAt: null, corrupt: true }
  }
}

function writeState(state) {
  mkdirSync(dirname(STATE_PATH), { recursive: true })
  const seen = Array.isArray(state.seen) ? state.seen.slice(-MAX_SEEN) : []
  writeFileSync(
    STATE_PATH,
    `${JSON.stringify({ version: 1, updatedAt: new Date().toISOString(), seen, pending: state.pending, lastAlertAt: state.lastAlertAt }, null, 2)}\n`,
    'utf8',
  )
}

function runTriage() {
  const r = spawnSync(process.execPath, [TRIAGE, '--json'], {
    cwd: ROOT,
    encoding: 'utf8',
    timeout: 300_000,
    windowsHide: true,
    stdio: ['ignore', 'pipe', 'pipe'],
    maxBuffer: 1 << 24,
  })
  let report = null
  try {
    report = JSON.parse(String(r.stdout ?? '').trim())
  } catch {
    return { ok: false, reason: `三查输出无法解析(rc=${r.status ?? '?'})` }
  }
  if (!report || !Array.isArray(report.findings)) return { ok: false, reason: '三查输出缺 findings' }
  return { ok: true, report }
}

function buildMailBody({ fresh, pending, unjudged }) {
  const lines = []
  const all = pending?.length ? pending : fresh
  lines.push(`主机侧新增发现 ${all.length} 条`, '')
  for (const p of all) {
    const f = p.finding
    lines.push(`[${f?.severity ?? '?'}] ${f?.type ?? '?'}: ${f?.detail ?? ''}`)
  }
  if (unjudged?.length) {
    lines.push('', `本轮未判定项 ${unjudged.length} 条(不影响上面的发现):`)
    for (const u of unjudged.slice(0, 10)) lines.push(`  - ${u.source ?? '?'}: ${u.path ?? ''} ${u.reason ?? ''}`)
  }
  lines.push(
    '',
    '下一步(按发现类型挑一条做):',
    '  node scripts/security/host-triage.mjs                     # 复核完整报告(含未判定项)',
    '  node scripts/security/host-triage.mjs --apply-baseline     # 确认是正常变更后重建持久化基线',
    '',
    '台账: .ihui-agent/state/host-watch.json(已见指纹 + 待发积压)',
  )
  return lines.join('\n')
}

function sendMail(body) {
  const tsx = join(ROOT, 'apps', 'api', 'node_modules', 'tsx', 'dist', 'cli.mjs')
  const script = join(ROOT, 'apps', 'api', 'scripts', 'notify-deploy-failure.ts')
  if (!existsSync(tsx) || !existsSync(script)) return { ok: false, reason: 'tsx 或通知脚本不在位(未判定)' }

  const msgPath = join(ROOT, '.ihui-agent', 'tmp', 'host-watch-mail.txt')
  mkdirSync(dirname(msgPath), { recursive: true })
  writeFileSync(msgPath, `${body}\n`, 'utf8')

  const r = spawnSync(
    process.execPath,
    [tsx, script, '--title', '主机侧新增发现 — production', '--severity', 'critical', '--source', 'ihui/host-watch', '--environment', 'production', '--message-file', msgPath, '--alert-id', 'host-triage-new', '--dedupe-hours', '0', '--strict'],
    { cwd: ROOT, encoding: 'utf8', timeout: 120_000, windowsHide: true, stdio: ['ignore', 'pipe', 'pipe'], maxBuffer: 1 << 24 },
  )
  return {
    ok: r.status === 0,
    reason: r.status === 0 ? '' : String(r.stderr ?? r.stdout ?? '').trim().split(/\r?\n/).slice(-2).join(' | '),
  }
}

function main() {
  const argv = process.argv.slice(2)
  const asJson = argv.includes('--json')
  const dryRun = argv.includes('--dry-run')
  const forceAlert = argv.includes('--force-alert')
  // 演练/维护档:更新已见台账但不发信。pending 保留 → 下次真档会把积压补发,
  // 所以它不会把发现静默压掉,只是把"告知"推迟。
  const noAlert = argv.includes('--no-alert')

  const triage = runTriage()
  if (!triage.ok) {
    const payload = { state: WATCH_STATE.UNDETERMINED, reason: triage.reason, newCount: 0, pending: 0 }
    console.log(asJson ? JSON.stringify(payload) : `⚠️ [host-watch] 未判定: ${triage.reason}`)
    return 2
  }

  const state = readState()
  if (state.corrupt) {
    // 已见台账坏了:此时把全部发现当新增会刷屏,当旧闻会漏报。唯一正解是停下来说清楚。
    const payload = { state: WATCH_STATE.UNDETERMINED, reason: 'host-watch 台账损坏(不猜:既不重报全部,也不当旧闻)' }
    console.log(asJson ? JSON.stringify(payload) : `⚠️ [host-watch] ${payload.reason}`)
    return 2
  }

  const fresh = diffFindings(triage.report.findings, state.seen)
  const seen = Array.isArray(state.seen) ? state.seen.slice() : []
  for (const f of fresh) seen.push(f.fp)

  const pending = [...(state.pending ?? []), ...fresh.map((f) => ({ fp: f.fp, finding: f.finding, at: new Date().toISOString() }))]
  const gate = noAlert
    ? { send: false, reason: '--no-alert(只记台账,不发信)' }
    : forceAlert
      ? { send: pending.length > 0, reason: '--force-alert' }
      : shouldAlert({ pending, lastAlertAt: state.lastAlertAt })

  let sent = null
  let lastAlertAt = state.lastAlertAt
  let remaining = pending
  if (gate.send && !dryRun) {
    sent = sendMail(buildMailBody({ fresh, pending, unjudged: triage.report.unjudged }))
    if (sent.ok) {
      lastAlertAt = new Date().toISOString()
      remaining = []
    }
  }

  // dry-run 绝不写台账:把"只是演算过"的发现记成"已见过",等于让它从此不再被报 ——
  // 那是把一个还没告知人的发现静默压掉,比不跑还坏。
  if (!dryRun) writeState({ seen, pending: remaining, lastAlertAt })

  const verdict =
    triage.report.verdict === 'clean' && fresh.length === 0
      ? WATCH_STATE.OK
      : triage.report.verdict === 'partial' && fresh.length === 0 && remaining.length === 0
        ? WATCH_STATE.UNDETERMINED
        : WATCH_STATE.NEW

  if (asJson) {
    console.log(
      JSON.stringify({
        state: verdict,
        triageVerdict: triage.report.verdict,
        newCount: fresh.length,
        pending: remaining.length,
        alerted: sent ? sent.ok : null,
        alertReason: sent ? sent.reason : gate.reason,
        reason: triage.report.verdict === 'partial' ? '三查本轮有未判定项' : '',
      }),
    )
  } else {
    const icon = { [WATCH_STATE.OK]: '✅', [WATCH_STATE.NEW]: '🔴', [WATCH_STATE.UNDETERMINED]: '⚠️' }[verdict]
    console.log(`${icon} [host-watch] ${verdict} · 新增 ${fresh.length} · 待发 ${remaining.length} · 三查=${triage.report.verdict}`)
    for (const f of fresh.slice(0, 20)) console.log(`   + [${f.finding?.severity ?? '?'}] ${f.finding?.type ?? '?'}: ${f.finding?.detail ?? ''}`)
    if (sent) console.log(`   邮件告警: ${sent.ok ? '已投递' : `未投递(${sent.reason})`}`)
    else if (gate.send && dryRun) console.log('   dry-run:未发信')
    else if (pending.length) console.log(`   未发信: ${gate.reason}`)
  }

  return verdict === WATCH_STATE.OK ? 0 : verdict === WATCH_STATE.NEW ? 1 : 2
}

const isDirectRun = process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href
if (isDirectRun) process.exitCode = main()

export const __test__ = {
  fingerprintOf,
  diffFindings,
  shouldAlert,
  WATCH_STATE,
  STATE_PATH,
  WINDOW_MIN,
  MAX_SEEN,
}
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
