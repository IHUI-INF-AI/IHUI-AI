#!/usr/bin/env node
// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/* eslint-disable no-console -- CLI 器物:人读行走 stdout/stderr,结论行恒 ASCII */
/**
 * check-origin-guard-liveness.mjs — 源站回源鉴权守卫的**存续哨兵**(2026-10-30 立)
 *
 * 立因:守卫(§10.8)在 enforce 档下已实录拦下外部直连探测 —— 实测 12 小时内 **40 个**不同外部来源
 * 被拒。可这些事件只躺在 router 日志里:全仓没有任何一条判据读它(`grep -r svc-web-router scripts/`
 * 现读 0 命中)。"防住了"与"有人正在试、且守卫哪天被静默降档"是两件事,后者此前无人看 = 没有。
 *
 * 两条判据,刻意不对称:
 *  · **L1 档位存续(可喊人)**:取最近一次 `"msg":"router started"` 行自述的 `edgeGuard` 读数。
 *    不是 enforce ⇒ breach。为什么挑这条:降级是**二值**事实、可当场整改(改 env + 重启),
 *    而 2026-10-30 的实测里该字段历史上真出现过 off/observe ⇒ 这不是一条假想判据。
 *    读数取进程**自述**而非比对 env:进程没重启时 env 是新的是假绿(本仓踩过多次)。
 *  · **L2 探测强度(只报数)**:窗口内外部被拒来源数。40 个/12h 属互联网背景噪声,做成告警就是
 *    天天喊(§12e 同型),所以它只逐轮落台账供人工判趋势,绝不进退出码。
 *
 * 日志位置不写死:从服务 `AppStdout`(注册表)反查当前活动文件,轮转副本按同目录同前缀并入。
 * 只读器物:不写 router 日志、不改任何服务、判机器状态 ⇒ **刻意不进提交链**(§12e)。
 *
 * 退出码:0=ok / 1=breach / 2=unjudged(取不到即未判定,不记绿也不冒红)。
 * `--json` 档**同样保留退出码**(本仓踩过"json 档丢 rc"那一型,勿回退)。
 *
 * 用法:
 *   node scripts/check-origin-guard-liveness.mjs              # 人读
 *   node scripts/check-origin-guard-liveness.mjs --json       # 派发侧
 *   node scripts/check-origin-guard-liveness.mjs --self-test  # 构造面正反例,零 IO
 */
import { existsSync, openSync, readSync, closeSync, statSync, readdirSync, writeFileSync, mkdirSync } from 'node:fs'
import { execFileSync } from 'node:child_process'
import { dirname, join, resolve } from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'

const HERE = dirname(fileURLToPath(import.meta.url))
const ROOT = resolve(HERE, '..')

export const WEB_ROUTER_SERVICE = 'IHUI-WEB-ROUTER'
export const LEDGER_REL = '.ihui-agent/state/origin-probe-ledger.jsonl'
export const TAIL_BYTES = 4 * 1024 * 1024
export const DEFAULT_WINDOW_HOURS = 24

/** 排除的自有来源:回环 + 本机 LAN 段。不做排除的话,自己做一次验证就会被算成"攻击升温"。 */
export function isOwnSource(ip) {
  return /^(127\.|::1|localhost|192\.168\.|10\.|172\.(1[6-9]|2\d|3[01])\.)/i.test(String(ip || ''))
}

/** edgeGuard 读数归一:`enforce` / `observe` / `off`,含"observe(缺密钥…)"这类带后缀形态。 */
export function normalizeGuardReading(raw) {
  const v = String(raw ?? '').trim().toLowerCase()
  for (const m of ['enforce', 'observe', 'off']) if (v.startsWith(m)) return m
  return null
}

/**
 * L1 判据(纯函数):日志行 → 最近一次启动自述的档位。
 * 无 started 行 / 该字段缺失 / 认不出档位 ⇒ 一律 unjudged,绝不猜"应该还在 enforce"。
 */
export function judgeGuardLiveness(lines) {
  let started = null
  for (const l of lines) {
    if (l && l.includes('"msg":"router started"')) started = l
  }
  if (!started) return { state: 'unjudged', why: 'no-router-started-line' }
  const m = started.match(/"edgeGuard":"([^"]*)"/)
  if (!m) return { state: 'unjudged', why: 'started-row-has-no-edgeGuard-field' }
  const mode = normalizeGuardReading(m[1])
  if (!mode) return { state: 'unjudged', why: `unreadable-reading(${m[1]})` }
  if (mode === 'enforce') return { state: 'ok', mode, at: timeOf(started) }
  return { state: 'breach', mode, at: timeOf(started), detail: m[1] }
}

function timeOf(line) {
  const m = String(line).match(/"time":"([^"]+)"/)
  return m ? m[1] : null
}

/**
 * L2 计数(纯函数):日志行 → 窗口内**外部**被拒事件与去重来源。
 * truncated=true 时读数只作下界,调用方不得读成"来源就这么多了"(尤其不得读成 0)。
 */
export function summarizeProbeEvents(lines, { nowMs = Date.now(), windowHours = DEFAULT_WINDOW_HOURS } = {}) {
  const cutoff = nowMs - windowHours * 3600_000
  const sources = new Set()
  let events = 0
  let droppedUndated = 0
  let byMode = { enforce: 0, observe: 0, off: 0, unknown: 0 }
  for (const l of lines) {
    if (!l || !l.includes('"msg":"edge guard"')) continue
    events += 1
    const t = Date.parse(timeOf(l) || '')
    if (!Number.isFinite(t)) {
      droppedUndated += 1
      continue
    }
    if (t < cutoff) continue
    const ip = (l.match(/"ip":"([^"]+)"/) || [])[1] || ''
    if (isOwnSource(ip)) continue
    sources.add(ip)
    const mode = normalizeGuardReading((l.match(/"mode":"([^"]+)"/) || [])[1]) || 'unknown'
    byMode[mode] = (byMode[mode] || 0) + 1
  }
  return {
    events,
    externalDistinct: sources.size,
    byMode,
    droppedUndated,
    windowHours,
    windowStart: new Date(cutoff).toISOString(),
  }
}

/** 从注册表问该服务实际写的 stdout 文件(§5e:判"执行的是哪份"按实际路径,不按仓库推测)。 */
export function readRouterLogPath(service = WEB_ROUTER_SERVICE, runner = null) {
  const run =
    runner ||
    ((cmd) =>
      execFileSync('pwsh.exe', ['-NoProfile', '-Command', cmd], {
        encoding: 'utf8',
        windowsHide: true,
        stdio: ['ignore', 'pipe', 'pipe'],
        timeout: 20_000,
      }))
  try {
    const out = run(
      `(Get-ItemProperty 'HKLM:\\SYSTEM\\CurrentControlSet\\Services\\${service}\\Parameters' -ErrorAction SilentlyContinue).AppStdout`,
    )
    const p = String(out || '').trim()
    return p || null
  } catch {
    return null
  }
}

/**
 * 从活动日志文件名推出该服务自己的前缀。
 * **必须剥"轮转时间戳"而不是剥任意 `-xxx.log`** —— 写成后者会把 `svc-web-router.log` 削成 `svc-web`,
 * 于是把 `svc-web-nssm-*.log`(10 MB)、`svc-web-build.log`、blue/green 的 nssm 日志一并吞进来,
 * 读数被别的进程污染(2026-10-30 实测踩过:外部来源 40 个那个数就是这么来的)。
 */
export function routerLogPrefixOf(base) {
  return String(base || '')
    .replace(/-\d{8}T\d{6}\.\d{1,6}\.log$/, '')
    .replace(/\.log$/, '')
}

/** 同目录同前缀的全部副本(含当前活动文件),按 mtime 从旧到新。 */
export function listRouterLogFiles(activePath) {
  if (!activePath) return []
  const dir = dirname(activePath)
  const base = activePath.split(/[\\/]/).pop() || ''
  const prefix = routerLogPrefixOf(base)
  if (!prefix || !existsSync(dir)) return [activePath]
  let files = []
  try {
    files = readdirSync(dir)
      .filter((f) => f.startsWith(prefix) && f.endsWith('.log'))
      .map((f) => join(dir, f))
  } catch {
    files = [activePath]
  }
  const all = new Set(files)
  if (existsSync(activePath)) all.add(activePath)
  return [...all].sort((a, b) => {
    try {
      return statSync(a).mtimeMs - statSync(b).mtimeMs
    } catch {
      return 0
    }
  })
}

/** 倒序取尾部字节:尾部足以覆盖"最近一次 started"与告警窗口;大文件不做整档读。 */
export function readTail(file, bytes = TAIL_BYTES) {
  let fd
  try {
    const st = statSync(file)
    const len = Math.min(bytes, st.size)
    const buf = Buffer.alloc(len)
    fd = openSync(file, 'r')
    readSync(fd, buf, 0, len, st.size - len)
    return { text: buf.toString('utf8'), truncated: st.size > len }
  } catch {
    return { text: '', truncated: false, error: 'unreadable' }
  } finally {
    if (fd !== undefined) closeSync(fd)
  }
}

export function collect(opts = {}) {
  const { nowMs = Date.now(), windowHours = DEFAULT_WINDOW_HOURS, logPath = null } = opts
  const active = logPath || readRouterLogPath()
  if (!active) {
    return {
      liveness: { state: 'unjudged', why: 'service-stdout-path-unreadable' },
      probes: null,
      files: [],
      truncated: false,
    }
  }
  const files = listRouterLogFiles(active)
  const lines = []
  let truncated = false
  let anyReadable = false
  for (const f of files) {
    const r = readTail(f)
    if (r.error === 'unreadable') continue
    anyReadable = true
    if (r.truncated) truncated = true
    for (const l of r.text.split('\n')) {
      const t = l.trim()
      if (t.startsWith('{') && t.endsWith('}')) lines.push(t)
    }
  }
  if (!anyReadable) {
    return { liveness: { state: 'unjudged', why: `no-readable-log(${active})` }, probes: null, files, truncated }
  }
  return {
    liveness: judgeGuardLiveness(lines),
    probes: summarizeProbeEvents(lines, { nowMs, windowHours }),
    files,
    truncated,
    active,
  }
}

/**
 * 追加一行台账。flag 必须是 `'a'` —— 写成 `'append'` 会让 writeFileSync 抛
 * `Invalid string flag`,而失败若被静默吞掉,表面看仍是"读数正常",实际跨轮趋势无账可对
 * (2026-10-30 实测踩过:派发腿日志一切正常,台账文件从未存在过)。
 * 失败**不静默**:返回 null 由调用方点名。
 */
export function writeLedger(entry, root = ROOT) {
  const file = join(root, LEDGER_REL)
  try {
    mkdirSync(dirname(file), { recursive: true })
    writeFileSync(file, `${JSON.stringify(entry)}\n`, { flag: 'a' })
    return file
  } catch {
    return null
  }
}

function main() {
  const args = process.argv.slice(2)
  if (args.includes('--self-test')) return runSelfTest()
  const asJson = args.includes('--json')
  const r = collect()
  const code = r.liveness.state === 'ok' ? 0 : r.liveness.state === 'breach' ? 1 : 2

  let ledgerWritten = false
  if (r.probes) {
    ledgerWritten =
      writeLedger({
        at: new Date().toISOString(),
        state: r.liveness.state,
        mode: r.liveness.mode || null,
        externalDistinct: r.probes.externalDistinct,
        events: r.probes.events,
        windowHours: r.probes.windowHours,
        truncated: r.truncated || false,
      }) !== null
  }

  if (asJson) {
    console.log(JSON.stringify({ ...r, ledgerWritten, code }, null, 2))
  } else {
    if (r.probes && !ledgerWritten) {
      console.error('⚠️ 探测台账未落盘:读数照给,但跨轮趋势无法对账(§0.3 不得把"没写成"当"没发生")')
    }
    const p = r.probes
    console.log(`守卫自述档位=${r.liveness.mode || r.liveness.why} 判定=${r.liveness.state}`)
    if (r.liveness.state === 'breach') {
      console.log(
        `  ❌ 源站回源鉴权已降档为 ${r.liveness.mode}(读数「${r.liveness.detail}」,启动于 ${r.liveness.at || '?'})\n` +
          '     整改:确认 IHUI-WEB-ROUTER 服务 env 的 IHUI_EDGE_SECRET_MODE=enforce 与 IHUI_EDGE_SECRET 非空,' +
          '再 nssm restart IHUI-WEB-ROUTER;改完必须重跑本器,因为"env 改了但进程没重启"是假绿。',
      )
    }
    if (p) {
      console.log(
        `  ℹ️ ${p.windowHours}h 窗口:被拒事件 ${p.events} 条(全部来源含自有)/ 外部去重来源 ${p.externalDistinct} 个` +
          `${p.truncated || r.truncated ? ' [尾部截断,读数为下界]' : ''}` +
          ` —— 只报数不喊人(§12e:扫描噪声天天有,做进告警就是恒红)`,
      )
    }
    console.log(
      `ORIGIN-GUARD state=${r.liveness.state} code=${code} ledger=${ledgerWritten ? 'written' : r.probes ? 'FAILED' : 'none'}`,
    )
  }
  return code
}

/** 构造面正反例:判据是纯函数,不碰真实日志、不派生子进程。 */
function runSelfTest() {
  const cases = []
  const ok = (name, cond) => cases.push([name, !!cond])
  const started = (g) => `{"time":"2026-10-30T01:00:00.000Z","level":"info","msg":"router started","edgeGuard":"${g}"}`
  const probe = (t, ip, mode = 'enforce') =>
    `{"time":"${t}","level":"warn","msg":"edge guard","mode":"${mode}","reason":"missing","ip":"${ip}"}`

  ok('E1 enforce ⇒ ok', judgeGuardLiveness([started('enforce')]).state === 'ok')
  ok('E2 带后缀的 observe 也认得', judgeGuardLiveness([started('observe(缺 IHUI_EDGE_SECRET ⇒ 实际不拦)')]).state === 'breach')
  ok('E3 off ⇒ breach', judgeGuardLiveness([started('off')]).state === 'breach')
  ok('E4 取最近一次启动(旧行不作数)',
    judgeGuardLiveness([started('off'), started('enforce')]).state === 'ok' &&
      judgeGuardLiveness([started('enforce'), started('observe')]).state === 'breach')
  ok('E5 无 started ⇒ 未判定不记绿', judgeGuardLiveness([probe('2026-10-30T01:00:00Z', '1.2.3.4')]).state === 'unjudged')
  ok('E6 started 无该字段 ⇒ 未判定',
    judgeGuardLiveness(['{"msg":"router started"}']).state === 'unjudged')
  ok('E7 档位认不出 ⇒ 未判定', judgeGuardLiveness([started('weird')]).state === 'unjudged')

  const now = Date.parse('2026-10-30T12:00:00Z')
  const win = (h) => new Date(now - h * 3600_000).toISOString()
  const s = summarizeProbeEvents(
    [
      probe(win(2), '8.8.8.8'),
      probe(win(3), '8.8.8.8'),
      probe(win(1), '9.9.9.9'),
      probe(win(40), '7.7.7.7'), // 窗外
      probe(win(1), '127.0.0.1'), // 回环:自家健康检查
      probe(win(1), '192.168.1.37'), // LAN:自家验证
      '{"msg":"edge guard","ip":"6.6.6.6"}', // 无时刻
    ],
    { nowMs: now, windowHours: 24 },
  )
  ok('L1 外部去重=2(同 IP 多次只计一个)', s.externalDistinct === 2)
  ok('L2 窗外与自有来源都不计入', s.externalDistinct === 2 && !JSON.stringify(s).includes('7.7.7.7'))
  ok('L3 无时刻的单列,不冒充正常读数', s.droppedUndated === 1)
  ok('L4 事件总数含全部(不并桶)', s.events === 7)
  ok('L5 回环与 LAN 判为自有', isOwnSource('127.0.0.1') && isOwnSource('192.168.1.37') && !isOwnSource('8.8.8.8'))
  ok('P1 活动文件只推出自家前缀', routerLogPrefixOf('svc-web-router.log') === 'svc-web-router')
  ok('P2 轮转副本归同一前缀(不裂成两组)',
    routerLogPrefixOf('svc-web-router-20261029T013137.626.log') === 'svc-web-router')
  ok('P3 不把 svc-web-nssm / build 卷进来(10MB 污染那一型)',
    routerLogPrefixOf('svc-web-router.log') !== 'svc-web' &&
      routerLogPrefixOf('svc-web-nssm-20261009T082323.456.log') === 'svc-web-nssm')

  let pass = 0
  for (const [name, good] of cases) {
    console.log(`${good ? '✔' : '✖'} ${name}`)
    if (good) pass += 1
  }
  console.log(`SELF-TEST ${pass}/${cases.length}`)
  return pass === cases.length ? 0 : 1
}

const isDirectRun = Boolean(process.argv[1]) && import.meta.url === pathToFileURL(process.argv[1]).href
if (isDirectRun) {
  process.exit(main())
}
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
