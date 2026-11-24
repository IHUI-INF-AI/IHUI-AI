#!/usr/bin/env node
// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
/**
 * Y-72 guardian 存活独立哨兵（只读，不拉起）。
 *
 * 背景(票面):git-guardian --daemon 是「盘根卫生 / TEMP 夹具清扫 / worktree 回收」三腿唯一载体；
 * 看门狗只管拉起 daemon，缺独立存活哨兵 ⇒ daemon 与看门狗同批被停就一起瞎，30+ 小时空转无人知。
 *
 * 三态判据（warn 档 §12e，绝不自动拉起）:
 *   ok    — daemon 进程在 + 三腿 tick 戳全部新鲜
 *   stale — daemon 在但 ≥1 腿 tick 超龄（腿卡住）
 *   down  — daemon 进程不在，或全部三腿 tick 均超长超龄（daemon 已死）
 *
 * 第 88 项(2026-11-21)补两条:pid 文件在而进程已死 ⇒ down(旧实现只看腿 tick,兜底任务仍在写 tick 时
 * 把"常驻执行体没了"读成 ok);轮级锁读出执行体身份(daemon / 一次性任务),写进读数但不据此判红,
 * 避免每台没装服务的机器恒红。
 *
 * 阈值:
 *   daemon tick 正常节奏 ≈ 2 分钟/轮 ⇒ 单腿超龄阈 STALE_MS=30min；
 *   全腿超长超龄阈 DOWN_MS=24h（daemon 已死，tick 全停）。
 *
 * 用法: node scripts/check-guardian-leg-health.mjs [--json]
 *   exit 0 = ok / exit 1 = stale / exit 2 = down / exit 3 = 未判定（输入缺失）
 */
import { readFileSync, existsSync, statSync } from 'node:fs'
import { join, dirname, resolve } from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'
// 第 88 项:执行体身份与 pid 复用判据只认锁模块那一份(§0.6 单一真相源),不在此另解析一遍。
import { readLockSnapshot, isPidAlive, isPidStartTimeMismatched } from './lib/guardian-lock.mjs'

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..')
const STATE_DIR = join(ROOT, '.ihui-agent', 'state')
// hook-logs 目录仅作文档参考(daemon pid 文件实际在 state 根,见 PID_FILE 注释),故保留常量不引用。
const _LOG_DIR = join(STATE_DIR, 'hook-logs')

/** daemon PID 文件（git-guardian.mjs 写入: join(dirname(LOG),'git-guardian.pid') = state 根目录；内容 pid=<pid> at=<iso>） */
const PID_FILE = join(STATE_DIR, 'git-guardian.pid')
/** 轮级锁（第 88 项:执行体身份的唯一现场 —— 内容 role=`git-guardian:daemon` / `git-guardian:round`,
 *  mtime 即心跳;daemon 常驻持锁,一次性任务只在跑那一轮里持锁） */
const LOCK_FILE = join(STATE_DIR, 'git-guardian.lock')
/** 锁记录未带 staleMs 时的心跳兜底阈（与默认 5min 回收窗拉开距离:这里问的是"执行体还活着吗",不是"锁能不能抢"） */
const EXECUTOR_STALE_MS = 30 * 60 * 1000
/** 三腿 tick 戳（guardian 每轮刷新；mtime 即最后一次落地时间）
 *
 * 第 82 项(2026-11-21):三腿**节律不同**,不能用同一个 30 分钟阈值 ——
 * `disk-root-hygiene` 每轮(~2min)跑;`temp-scrub` 与 `worktree-reap` 是 **24h** 节流
 * (git-guardian 的 `TEMP_SCRUB_INTERVAL_MS` / `lib/git-guardian-worktree-reap.mjs` 的
 * `REAP_INTERVAL_MS` 默认 86400000)。旧实现一律按 30min 判 stale ⇒ 每日有 23.5 小时
 * 把"本来就该歇着"读成"腿卡住"(现读实测:temp 1032min / reap 983min,均未到 24h)。
 */
const LEG_TICKS = {
  'disk-root-hygiene': {
    path: join(STATE_DIR, 'disk-root-hygiene-audit-tick.ts'),
    staleMs: 30 * 60 * 1000,
    downMs: 24 * 60 * 60 * 1000,
  },
  'temp-scrub': {
    path: join(STATE_DIR, 'temp-scrub-tick.iso'),
    staleMs: 26 * 60 * 60 * 1000, // 24h 节律 + 2h 宽限
    downMs: 7 * 24 * 60 * 60 * 1000,
  },
  'worktree-reap': {
    path: join(STATE_DIR, 'worktree-reap-tick.iso'),
    staleMs: 26 * 60 * 60 * 1000,
    downMs: 7 * 24 * 60 * 60 * 1000,
  },
}

/** 进程是否存活。第 88 项起只委托锁模块那一份判据(§0.6),不再本文件另写一遍 kill(pid,0)。 */
function pidAlive(pid) {
  if (!Number.isInteger(pid) || pid <= 0) return false
  return isPidAlive(pid)
}

function readDaemonPid() {
  if (!existsSync(PID_FILE)) return { pid: null, startedAt: null }
  const txt = readFileSync(PID_FILE, 'utf8')
  const pidM = /pid=(\d+)/.exec(txt)
  const atM = /at=(\S+)/.exec(txt)
  return {
    pid: pidM ? Number(pidM[1]) : null,
    startedAt: atM ? atM[1] : null,
  }
}

/**
 * 纯判据(导出供测试;CLI 与测试共用这一份,不在别处复制):
 *   全部从未跑过 ⇒ down;任一腿越过 downMs ⇒ down(**单腿死也要喊人**);
 *   任一腿 stale 或从未跑过 ⇒ stale;否则 ok。
 * 第 82 项把节律阈值下放到每腿(`staleMs`/`downMs`),本函数只做汇总,不持有阈值。
 * 第 87 项(2026-11-21)立因:旧规则是"全部 down 才算 down,否则一律 stale",而 runner 对 stale
 * 只登记不发信 ⇒ 实测 `disk-root-hygiene` 已经 25 小时没跑(越过 downMs=24h),哨兵仍报 state=stale、
 * 到人通道一格都没走 —— 一条腿真的死了却只落 warn,等于没有求救信号。单腿越 downMs 就必须是 down。
 * 反向牙:从未存在过的腿(新机/该腿本机不适用)不单独判 down,否则每次装新机都必然报急。
 */
export function judgeLegHealth(legs) {
  const arr = Object.values(legs || {})
  if (arr.length === 0) return 'down'
  if (arr.every((l) => l.exists === false)) return 'down'
  if (arr.some((l) => l.down)) return 'down'
  if (arr.some((l) => l.stale || l.exists === false)) return 'stale'
  return 'ok'
}

/* 第 88 项纯判据:执行体身份(谁在跑)。入参是锁快照,不读盘、不判死,便于测试直接喂快照。 */
export function describeExecutor(snap, opts = {}) {
  const now = Number(opts.now) || Date.now()
  if (!snap || !snap.ok) {
    return {
      present: false,
      kind: 'none',
      role: null,
      pid: null,
      alive: null,
      pidReused: null,
      heartbeatAgeMs: null,
      heartbeatAgeHuman: 'unknown',
      stale: null,
      reason: snap && snap.missing === false ? 'lock-unreadable' : 'lock-missing',
    }
  }
  const role = String(snap.role || '')
  // 只有 daemon 是常驻执行体;一次性任务(`git-guardian:round`)只在那一轮里持锁 ⇒ 本读数回答"谁在跑"。
  const kind = /:daemon$/.test(role) ? 'daemon' : role ? 'round' : 'unknown'
  const nPid = Number(snap.pid) || 0
  const rawAlive = nPid > 0 ? (opts.alive === undefined ? isPidAlive(nPid) : Boolean(opts.alive)) : null
  // 第 88 项:机器重启后 pid 会被无关进程复用 —— kill(pid,0) 说"活着"其实是别人,判据复用锁模块那一份。
  const pidReused = rawAlive === true ? (opts.reused === undefined ? isPidStartTimeMismatched(snap) : Boolean(opts.reused)) : false
  const alive = rawAlive === null ? null : rawAlive && !pidReused
  const hb = Number.isFinite(snap.mtimeMs) ? now - snap.mtimeMs : null
  const staleMs = Number(snap.staleMs) > 0 ? Number(snap.staleMs) : EXECUTOR_STALE_MS
  return {
    present: true,
    kind,
    role: role || null,
    pid: nPid > 0 ? nPid : null,
    alive,
    pidReused,
    heartbeatAgeMs: hb,
    heartbeatAgeHuman: hb === null ? 'unknown' : `${Math.round(hb / 60000)}min`,
    stale: hb === null ? null : hb > staleMs,
    staleMs,
    reason: null,
  }
}

const SEVERITY = { ok: 0, stale: 1, down: 2 }

/**
 * 第 88 项:总状态汇总。立因(现读实测)—— nssm 服务被停掉的那段时间,计划任务每分钟仍在跑一次性
 * `main()`,照样刷新三腿 tick ⇒ 旧实现 `state = judgeLegHealth(legs)` 报 ok,而 pidSource 明明写着
 * `pid-dead`;"只有兜底腿在跑"被读成"守护健康",这是把人读错,不是腿健康。
 * 失效方向:有 pid 文件却进程已死 ⇒ down(常驻执行体确实没了);daemon 持锁但心跳超阈 ⇒ stale;
 * pid 文件缺席(本机从没起过 daemon)时不据此判急,仍按 tick —— 否则每台新机都必然报红。
 */
export function judgeOverallState({ legState, pidSource, executor }) {
  let state = legState
  const bump = (s) => {
    if ((SEVERITY[s] ?? 0) > (SEVERITY[state] ?? 0)) state = s
  }
  if (pidSource === 'pid-dead') bump('down')
  if (executor && executor.present && executor.kind === 'daemon') {
    if (executor.alive === false) bump('down')
    else if (executor.stale === true) bump('stale')
  }
  return state
}

function legAgeMs(p) {
  try {
    return Date.now() - statSync(p).mtimeMs
  } catch {
    return null
  }
}

function main() {
  const { pid, startedAt } = readDaemonPid()
  const daemonAlive = pid !== null && pidAlive(pid)

  const legs = {}
  for (const [name, spec] of Object.entries(LEG_TICKS)) {
    const age = legAgeMs(spec.path)
    legs[name] = {
      path: spec.path,
      staleMs: spec.staleMs,
      downMs: spec.downMs,
      exists: age !== null,
      // 第 87 项:从未跑过(缺失)与"跑过但过期"是两件事 —— 前者在新机上是常态,后者才是死腿。
      missing: age === null,
      ageMs: age,
      ageHuman: age === null ? 'never' : `${Math.round(age / 60000)}min`,
      stale: age !== null && age > spec.staleMs,
      down: age === null ? false : age > spec.downMs,
    }
  }

  // 第 82 项(2026-11-21):判活以 tick 为主、pid 为旁证。
  // 立因(现读实测):daemon 常驻进程在跑(pid 42092)、三腿 tick 18min 新鲜,而 pid 文件缺失
  // (此前只有一次性 main() 会写)⇒ 旧逻辑 `daemonAlive = pid !== null && pidAlive(pid)`
  // 直接判 `state=down / daemon pid=∅ alive=false` —— 把活着的判死。失效方向纠正为:
  //   ① daemon 启动已补写 pid 文件(第 82 项,git-guardian 的 startDaemon);
  //   ② 即便 pid 文件仍缺,凡有新鲜 tick 就按 tick 判活,并在读数里明写 pid 来源。
  const pidSource = pid === null ? 'absent' : daemonAlive ? 'pid-alive' : 'pid-dead'
  const legState = judgeLegHealth(legs)
  // 第 88 项:执行体身份 —— 三腿 tick 只说"有人跑过",锁才说"谁在跑"(daemon 常驻 / 一次性任务)。
  const executor = describeExecutor(readLockSnapshot(LOCK_FILE))
  const state = judgeOverallState({ legState, pidSource, executor })

  const summary = { state, legState, daemonAlive, pid, pidSource, startedAt, executor, legs }
  if (process.argv.includes('--json')) {
    console.log(JSON.stringify(summary, null, 2))
  } else {
    console.log(`guardian 存活哨兵: state=${state}${legState !== state ? `（三腿=${legState}）` : ''}`)
    const pidNote =
      pidSource === 'absent'
        ? '∅ alive=unknown(pid 文件缺席 ⇒ 按三腿 tick 判活,见第 82 项)'
        : `pid=${pid} alive=${daemonAlive}`
    console.log(`  daemon ${pidNote}${startedAt ? ` started=${startedAt}` : ''}`)
    const exeNote = executor.present
      ? `${executor.kind} role=${executor.role} pid=${executor.pid ?? '-'} alive=${executor.alive} hb=${executor.heartbeatAgeHuman} stale=${executor.stale}`
      : `none(${executor.reason})`
    console.log(`  executor ${exeNote}`)
    if (executor.present && executor.kind !== 'daemon') {
      console.log('  ⚠️ 常驻 daemon 未持锁:当前只有一次性任务在跑(腿会被兜底跑,长轮可能跑不完)')
    }
    if (executor.present && executor.pidReused) {
      console.log('  ⚠️ 锁里的 pid 已被无关进程复用(pidStartTime 对不上)⇒ 原执行体已不在')
    }
    for (const [name, l] of Object.entries(legs)) {
      console.log(`  leg ${name.padEnd(18)} exists=${l.exists} age=${l.ageHuman} stale=${l.stale} down=${l.down}`)
    }
  }

  // 未判定:输入完全缺失（无 pid 文件且无任何 tick）
  if (pid === null && Object.values(legs).every((l) => !l.exists)) {
    console.error('未判定:pid 文件与三腿 tick 全缺 ⇒ guardian 可能从未在本机跑过')
    process.exit(3)
  }
  process.exit(state === 'ok' ? 0 : state === 'stale' ? 1 : 2)
}

// §22d 入口守卫:CLI 直跑 + 被 import 双形态;测试/工具 import 本模块时不触发 CLI 主流程。
const isDirectRun =
  typeof process !== 'undefined' &&
  process.argv[1] &&
  import.meta.url === pathToFileURL(process.argv[1]).href
if (isDirectRun) {
  main()
}
