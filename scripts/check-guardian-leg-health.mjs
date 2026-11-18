// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * check-guardian-leg-health — git-guardian **存活无独立哨兵**(票 Y-72 的出路件,2026-11-19 落地)。
 *
 * 为什么需要它(票面根因,现读):git-guardian --daemon 是盘根卫生 / TEMP 夹具 / worktree 回收
 * 三腿的唯一载体;2026-11-09 服务与看门狗双腿被拆后曾空转 30+ 小时无人知 —— 看门狗只负责
 * "把它拉起来",**它自己停了没有任何独立尺子在量**。本件就是那把"只读"的尺子:只读盘上
 * 运行态,不拉起、不修复、不写任何状态文件。
 *
 * 三态(与 check-autonomy-leg-health / check-tunnel-leg-health 同口径):
 *   · ok    = 锁文件里的 daemon pid 活着 ∧ 主巡检日志新鲜 ∧ 三腿戳都在窗口内;
 *   · stale = pid 活着但巡检戳/腿戳超窗(载体在跑而某腿没动 —— 安静失效的那一型);
 *   · down  = 锁文件缺失 / pid 不活。
 *
 * 单点共用只 warn 报放大因子:某腿超窗时**,若主日志也超窗**(说明整轮没转)只报一次 stale,
 * 不把三腿各报一遍(§"同一故障按稳定语义身份去重")。
 *
 * 档位:判**机器状态** ⇒ 刻意不进提交链(AGENTS §12e 恒红门禁令:提交者结构上满足不了
 * "这台机上守护进程必须活着")。调度 = 系统计划任务(S4U 每 15 分钟)+ 到人通道按身份去重(§5e-3)。
 *
 * 用法:node scripts/check-guardian-leg-health.mjs [--json] [--repo-root <path>]
 *      [--tick-window-hours <n>] [--log-window-minutes <n>]
 * 退出码:0=ok / 1=stale|down(逐条点名拿不到什么)/ 2=未判定(取不到输入,不记绿也不冒红)
 */
import { existsSync, readFileSync, statSync } from 'node:fs'
import { join, dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

const DEFAULT_REPO_ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..')

/** 三腿的戳文件(与 git-guardian 落盘名逐字对应;名字变了就是票面这一格要复核的信号) */
const LEGS = [
  { id: 'disk-root-hygiene', rel: '.ihui-agent/state/disk-root-hygiene-audit-tick.ts' },
  { id: 'temp-scrub', rel: '.ihui-agent/state/temp-scrub-tick.iso' },
  { id: 'worktree-reap', rel: '.ihui-agent/state/worktree-reap-tick.iso' },
]

const LOCK_REL = '.ihui-agent/state/git-guardian.lock'
const LOG_REL = '.ihui-agent/state/git-guardian.log'

function parseArgs(argv) {
  const out = { json: false, repoRoot: DEFAULT_REPO_ROOT, tickWindowHours: 24, logWindowMinutes: 15 }
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i]
    if (a === '--json') out.json = true
    else if (a === '--repo-root') out.repoRoot = resolve(argv[++i] ?? out.repoRoot)
    else if (a === '--tick-window-hours') out.tickWindowHours = Number(argv[++i]) || out.tickWindowHours
    else if (a === '--log-window-minutes') out.logWindowMinutes = Number(argv[++i]) || out.logWindowMinutes
    else if (a === '--help' || a === '-h') out.help = true
  }
  return out
}

/** 锁文件是 `k=v` 逐行形态(pid/token/at/host/role/staleMs/pidStartTime) */
function readLock(repoRoot) {
  const p = join(repoRoot, LOCK_REL)
  if (!existsSync(p)) return { state: 'missing', path: p }
  const text = readFileSync(p, 'utf8')
  const fields = {}
  for (const line of text.split(/\r?\n/)) {
    const m = line.match(/^([A-Za-z0-9_]+)=(.+)$/)
    if (m) fields[m[1]] = m[2].trim()
  }
  return { state: 'present', path: p, fields, mtimeMs: statSync(p).mtimeMs }
}

function isPidAlive(pid) {
  if (!Number.isFinite(pid) || pid <= 0) return false
  try {
    process.kill(pid, 0)
    return true
  } catch (err) {
    // EPERM = 进程存在但无权限发信号,按活着算(判"存续"不判"可控制")
    return err && err.code === 'EPERM'
  }
}

function ageOf(p) {
  if (!existsSync(p)) return null
  return Date.now() - statSync(p).mtimeMs
}

export function judgeGuardianHealth({
  lock,
  logAgeMs,
  legs,
  tickWindowMs,
  logWindowMs,
  pidAlive,
}) {
  const findings = []
  if (lock.state === 'missing') {
    return { state: 'down', reason: `锁文件缺失(${LOCK_REL}) —— daemon 未在跑`, findings }
  }
  const pid = Number(lock.fields?.pid)
  if (!pidAlive) {
    return { state: 'down', reason: `daemon pid=${lock.fields?.pid ?? '(空)'} 不活`, findings }
  }

  const logFresh = logAgeMs !== null && logAgeMs <= logWindowMs
  const overLegs = legs.filter((l) => l.ageMs === null || l.ageMs > tickWindowMs)

  if (!logFresh && overLegs.length > 0) {
    findings.push(
      `主巡检日志与 ${overLegs.map((l) => l.id).join('/')} 同时超窗 ⇒ 整轮没在转(只报一次,不做逐腿放大)`,
    )
    return { state: 'stale', reason: '整轮停滞(主日志 + 三腿同一时间窗内都没动)', findings }
  }
  if (!logFresh) {
    findings.push(`主巡检日志超窗(${LOG_REL} 距今 ${fmtMs(logAgeMs)})`)
    return { state: 'stale', reason: '主巡检轮次停摆', findings }
  }
  for (const l of overLegs) {
    findings.push(`${l.id} 戳超窗(${l.rel} ${l.ageMs === null ? '缺文件' : '距今 ' + fmtMs(l.ageMs)})`)
  }
  return {
    state: overLegs.length ? 'stale' : 'ok',
    reason: overLegs.length ? `${overLegs.length} 条腿超窗` : `daemon pid=${pid} 存活且三腿戳在窗口内`,
    findings,
  }
}

function fmtMs(ms) {
  if (ms === null) return 'n/a'
  const h = ms / 3_600_000
  return h >= 1 ? `${h.toFixed(1)}h` : `${Math.round(ms / 60_000)}min`
}

function main() {
  const opts = parseArgs(process.argv.slice(2))
  if (opts.help) {
    console.log(
      '用法: node scripts/check-guardian-leg-health.mjs [--json] [--repo-root <path>] ' +
        '[--tick-window-hours <n>] [--log-window-minutes <n>]',
    )
    return 0
  }
  const lock = readLock(opts.repoRoot)
  const logAgeMs = ageOf(join(opts.repoRoot, LOG_REL))
  const legs = LEGS.map((l) => ({ ...l, ageMs: ageOf(join(opts.repoRoot, l.rel)) }))

  // 未判定:锁文件在,但 pid 解析不出数字 —— 不猜"活着",也不报"死了"
  if (lock.state === 'present' && !Number.isFinite(Number(lock.fields?.pid))) {
    console.error(`[guardian-leg-health] 未判定:${LOCK_REL} 里取不到 pid`)
    return 2
  }

  const verdict = judgeGuardianHealth({
    lock,
    logAgeMs,
    legs,
    tickWindowMs: opts.tickWindowHours * 3_600_000,
    logWindowMs: opts.logWindowMinutes * 60_000,
    pidAlive: isPidAlive(Number(lock.state === 'present' ? lock.fields?.pid : NaN)),
  })

  if (opts.json) {
    console.log(
      JSON.stringify(
        {
          state: verdict.state,
          reason: verdict.reason,
          findings: verdict.findings,
          daemonPid: lock.fields?.pid ?? null,
          logAgeMs,
          legs: legs.map((l) => ({ id: l.id, ageMs: l.ageMs })),
          windows: { tickHours: opts.tickWindowHours, logMinutes: opts.logWindowMinutes },
        },
        null,
        2,
      ),
    )
  } else {
    const icon = verdict.state === 'ok' ? '✅' : verdict.state === 'down' ? '❌' : '⚠️'
    console.log(`${icon} [guardian-leg-health] state=${verdict.state} — ${verdict.reason}`)
    for (const f of verdict.findings) console.log(`   · ${f}`)
  }
  return verdict.state === 'ok' ? 0 : 1
}

// 直接跑才执行(被 import 时只暴露纯判据,供测试与其它哨兵复用)
if (process.argv[1] && resolve(process.argv[1]) === resolve(fileURLToPath(import.meta.url))) {
  process.exitCode = main()
}
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
