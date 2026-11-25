// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/* eslint-disable no-console -- CLI 诊断需要 stdout */
/**
 * 主机侧失陷三查(2026-11-24 立)。
 *
 * 入口 WAF 只能看到「请求」,看不到「东西已经落在我机器上」。国安级对抗必须有主机面:
 *   ① webshell / 可执行脚本落地 —— 入口被绕过后最常见的第一件事;
 *   ② 异常外连 —— 驻留后必然回连 C2,这是唯一能证明「里面有活物」的证据;
 *   ③ 持久化变更 —— 服务 / Run 键 / 计划任务新增,决定重启后还在不在。
 *
 * 三条纪律:
 *   · **只读**,不删任何东西 —— 删掉就等于销毁证据,处置交给人或单独的隔离流程;
 *   · **没有基线就不冒充「没新增」** —— 首次运行只建基线并显式说明,之后才 diff;
 *   · 判据(纯函数)与采集(IO)分离,便于 node:test 钉住。
 */
import { execFileSync } from 'node:child_process'
import { existsSync, mkdirSync, readFileSync, readdirSync, statSync, writeFileSync } from 'node:fs'
import { dirname, extname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

export const TRIAGE_POLICY = Object.freeze({
  version: 1,
  /** 只看最近 N 天内改动过的落地文件 */
  recentDays: 7,
  /** 单个扫描根最多看这么多文件,超出即截断并标未判定 */
  maxFilesPerRoot: 2000,
  maxDepth: 4,
  /** 可执行脚本扩展名:出现在 web 可达目录就是强信号 */
  dangerousExts: Object.freeze(['.php', '.php5', '.phtml', '.jsp', '.jspx', '.asp', '.aspx', '.ashx', '.asmx', '.cgi', '.pl']),
  /** 内容特征:命中越多越像 webshell */
  shellSignals: Object.freeze([
    [/eval\s*\(\s*(?:base64_decode|\$_(?:POST|GET|REQUEST|COOKIE))/i, 'eval+超全局变量'],
    [/base64_decode\s*\(/i, 'base64 解码'],
    [/assert\s*\(\s*\$_/i, 'assert 执行'],
    [/Runtime\.getRuntime\s*\(\s*\)\s*\.exec/i, 'Java Runtime.exec'],
    [/ProcessBuilder\s*\(/i, 'Java ProcessBuilder'],
    [/Request\[\s*['"]/i, 'ASP Request 取值'],
    [/<%@\s*Page\s+Language\s*=/i, 'ASP 指令'],
    [/fsockopen\s*\(|pfsockopen\s*\(/i, 'socket 回连'],
    [/system\s*\(\s*\$_|passthru\s*\(\s*\$_|shell_exec\s*\(\s*\$_/i, '命令执行包装'],
    [/FilesMan|WSO\s*Shell|b374k|c99shell|r57shell/i, '已知 webshell 家族'],
  ]),
  /** C2 / 后门常见端口 */
  c2Ports: Object.freeze([4444, 4445, 5555, 6666, 6667, 7777, 8888, 9001, 1337, 31337, 12345, 22222]),
  /** 被滥用来做下载/执行的系统程序 */
  lolerBins: Object.freeze(['cmd.exe', 'powershell.exe', 'pwsh.exe', 'wscript.exe', 'cscript.exe', 'mshta.exe', 'rundll32.exe', 'regsvr32.exe', 'certutil.exe', 'bitsadmin.exe']),
  /** 持久化项若指向这些目录(用户可写/临时),一律按高置信处理 */
  suspectPaths: Object.freeze(['\\temp\\', '\\tmp\\', '\\appdata\\local\\temp', '\\users\\public\\', '\\downloads\\']),
})

const norm = (s) => String(s ?? '').replace(/^::ffff:/, '')

/** 危险扩展名判断。 */
export function isDangerousExt(name) {
  return TRIAGE_POLICY.dangerousExts.includes(extname(String(name ?? '')).toLowerCase())
}

/** webshell 特征打分:命中 ≥2 条或含已知家族即 high。 */
export function webshellScore(text) {
  const s = String(text ?? '').slice(0, 8192)
  const hits = []
  for (const [re, label] of TRIAGE_POLICY.shellSignals) {
    if (re.test(s)) hits.push(label)
  }
  const family = hits.includes('已知 webshell 家族')
  const severity = family || hits.length >= 2 ? 'high' : hits.length === 1 ? 'medium' : 'clean'
  return { severity, hits }
}

/** 解析 netstat -ano 输出:只保留 ESTABLISHED,返回 {ip, port, pid}。
 *  列序是「协议 本地 远端 状态 PID」——写错过一次(把本地当远端),会导致整查静默为空,故逐列点名。 */
export function parseNetstat(text) {
  const out = []
  for (const line of String(text ?? '').split(/\r?\n/)) {
    const cols = line.trim().split(/\s+/)
    if (cols.length < 5) continue
    const proto = cols[0]
    const state = cols[cols.length - 2]
    const pid = cols[cols.length - 1]
    const remote = cols[2]
    if (!/^TCP/i.test(proto)) continue
    if (!/(ESTABLISHED|已建立)/i.test(state)) continue
    if (!/^[\d.]+:\d+$/.test(remote)) continue
    const idx = remote.lastIndexOf(':')
    const ip = norm(remote.slice(0, idx))
    const port = Number(remote.slice(idx + 1))
    if (!Number.isInteger(port)) continue
    out.push({ ip, port, pid: Number(pid) || 0 })
  }
  return out
}

/** 单条连接是否可疑。私网/环回不算,已知服务端口不算。 */
export function classifyConn({ ip, port, proc = '' }, { policy = TRIAGE_POLICY } = {}) {
  if (!ip || /^(?:10\.|192\.168\.|172\.(?:1[6-9]|2\d|3[01])\.|127\.|169\.254\.|0\.0\.0\.0)/.test(ip)) {
    return { suspicious: false, reason: 'private' }
  }
  const p = String(proc ?? '').toLowerCase()
  if (policy.c2Ports.includes(Number(port))) return { suspicious: true, severity: 'high', reason: `C2 常见端口 ${port}` }
  if (policy.lolerBins.includes(p) && Number(port) !== 443 && Number(port) !== 80) {
    return { suspicious: true, severity: 'high', reason: `系统程序直连公网 ${port}(${p})` }
  }
  return { suspicious: false, reason: 'ok' }
}

/** 基线 diff:新增/移除清单项。 */
export function diffPersistence(baseline, current) {
  const key = (x) => `${x?.name ?? ''}|${x?.path ?? ''}`.toLowerCase()
  const base = new Set((Array.isArray(baseline) ? baseline : []).map(key))
  const cur = new Set((Array.isArray(current) ? current : []).map(key))
  return {
    added: (Array.isArray(current) ? current : []).filter((x) => !base.has(key(x))),
    removed: (Array.isArray(baseline) ? baseline : []).filter((x) => !cur.has(key(x))),
  }
}

/** 持久化项是否指向高可疑路径。 */
export function suspectPersistence(item, { policy = TRIAGE_POLICY } = {}) {
  const text = `${item?.path ?? ''} ${item?.command ?? ''}`.toLowerCase()
  return policy.suspectPaths.some((p) => text.includes(p))
}

// ── IO 层 ──────────────────────────────────────────────────────────

function run(cmd, args, timeout = 30_000) {
  try {
    return { ok: true, text: execFileSync(cmd, args, { encoding: 'utf8', timeout, windowsHide: true, maxBuffer: 8 << 20 }) }
  } catch (err) {
    return { ok: false, text: String(err?.stdout ?? ''), error: String(err?.message ?? err) }
  }
}

function walk(root, { policy = TRIAGE_POLICY, now = Date.now() } = {}) {
  const since = now - policy.recentDays * 86400_000
  const files = []
  let scanned = 0
  let truncated = false
  const stack = [{ dir: root, depth: 0 }]
  while (stack.length) {
    const { dir, depth } = stack.pop()
    let entries
    try {
      entries = readdirSync(dir, { withFileTypes: true })
    } catch {
      continue
    }
    for (const e of entries) {
      if (e.name === 'node_modules' || e.name === '.git' || e.name === '.next' || e.name === 'cache') continue
      const full = join(dir, e.name)
      if (e.isDirectory()) {
        if (depth < policy.maxDepth) stack.push({ dir: full, depth: depth + 1 })
        continue
      }
      scanned += 1
      if (scanned > policy.maxFilesPerRoot) {
        truncated = true
        return { files, scanned, truncated }
      }
      try {
        const st = statSync(full)
        if (st.mtimeMs >= since) files.push({ path: full, mtime: new Date(st.mtimeMs).toISOString(), size: st.size })
      } catch {
        /* 读不到就跳过,不冒充干净 */
      }
    }
  }
  return { files, scanned, truncated }
}

/**
 * 计划任务清单:直接读 `C:\Windows\System32\Tasks` 目录。
 * 为什么不用 `schtasks /Query`:非交互会话(SYSTEM 计划任务)下实测挂起 30s 超时
 * (2026-11-24 复现),而 Tasks 目录里每个文件就是一个任务,遍历毫秒级。
 * 代价是拿不到"创建时间",但基线 diff 只需要名字,不需要时间。
 */
function readTaskNames() {
  const dir = 'C:\\Windows\\System32\\Tasks'
  if (!existsSync(dir)) return { names: [], error: 'tasks-dir-not-found' }
  try {
    const entries = readdirSync(dir, { recursive: true, withFileTypes: true })
    const names = entries
      .filter((e) => e.isFile())
      .map((e) => join(e.parentPath ?? e.path ?? '', e.name).slice(dir.length + 1).split('\\').join('/'))
      .filter((n) => !n.startsWith('Microsoft/')) // 系统自带任务不计入,与旧口径一致
    return { names, error: null }
  } catch (err) {
    return { names: [], error: `读取 Tasks 目录失败: ${err?.message ?? err}` }
  }
}

/**
 * PID → 进程名。tasklist 在非交互会话下同样可能挂起,给它 8s;超时退 PowerShell
 * (实测 ~11s)。两者都失败就返回空表并让调用方标未判定 —— 不能因此冒充"没有可疑进程"。
 */
function readProcessNames() {
  const tl = run('tasklist', ['/FO', 'CSV', '/NH'], 8_000)
  if (tl.ok) {
    const map = new Map()
    for (const line of tl.text.split(/\r?\n/)) {
      const cols = line.split(',')
      if (cols.length < 2) continue
      const pid = Number(cols[1]?.replace(/"/g, ''))
      if (Number.isInteger(pid)) map.set(pid, cols[0].replace(/"/g, ''))
    }
    return { map, source: 'tasklist', error: null }
  }
  const ps = run(
    'powershell',
    ['-NoProfile', '-NonInteractive', '-Command', 'Get-CimInstance Win32_Process | ForEach-Object { "$($_.ProcessId),$($_.Name)" }'],
    20_000,
  )
  if (ps.ok) {
    const map = new Map()
    for (const line of ps.text.split(/\r?\n/)) {
      const [pidRaw, ...nameParts] = line.trim().split(',')
      const pid = Number(pidRaw)
      if (Number.isInteger(pid) && pid > 0) map.set(pid, nameParts.join(',').trim())
    }
    return { map, source: 'powershell', error: null }
  }
  return { map: new Map(), source: 'none', error: `tasklist: ${tl.error}; powershell: ${ps.error}` }
}

function collectPersistence() {
  const items = []
  const errors = []
  for (const hive of ['HKLM', 'HKCU']) {
    for (const key of ['Software\\Microsoft\\Windows\\CurrentVersion\\Run', 'Software\\Microsoft\\Windows\\CurrentVersion\\RunOnce']) {
      const r = run('reg', ['query', `${hive}\\${key}`])
      if (!r.ok) continue
      for (const line of r.text.split(/\r?\n/)) {
        const m = /^\s+(\S.*?)\s+REG_[A-Z_]+\s+(.*)$/.exec(line)
        if (m) items.push({ kind: 'run-key', name: `${hive}:${key}:${m[1]}`, path: m[2].trim(), command: m[2].trim() })
      }
    }
  }
  const svc = run('sc', ['query', 'state=', 'all'])
  if (svc.ok) {
    for (const line of svc.text.split(/\r?\n/)) {
      const m = /SERVICE_NAME:\s*(\S+)/i.exec(line)
      if (m) items.push({ kind: 'service', name: m[1], path: '' })
    }
  }
  const task = readTaskNames()
  if (task.error) errors.push({ source: 'scheduled-tasks', reason: task.error })
  for (const name of task.names) items.push({ kind: 'task', name, path: '' })
  return { items, errors }
}

function main() {
  // 根按脚本位置算:计划任务(SYSTEM)的 cwd 是 System32,用 cwd 会把磁盘写进系统目录。
  const root = join(dirname(fileURLToPath(import.meta.url)), '..', '..')
  const stateDir = join(root, '.ihui-agent', 'state')
  const baselinePath = join(stateDir, 'host-baseline.json')
  const reportPath = join(stateDir, 'host-triage.json')
  const jsonOut = process.argv.includes('--json')
  const rebuild = process.argv.includes('--apply-baseline')

  const scanRoots = (process.env.IHUI_TRIAGE_ROOTS ?? [
    'D:\\DevEnv\\ihui-prod\\.runtime',
    'D:\\DevEnv\\ihui-prod\\deploy\\run',
    'D:\\DevEnv\\ihui-prod\\deploy\\win',
  ].join(';'))
    .split(';')
    .map((s) => s.trim())
    .filter(Boolean)

  const findings = []
  const unjudged = []

  // ① 落地文件
  const landed = []
  for (const r of scanRoots) {
    if (!existsSync(r)) {
      unjudged.push({ source: 'scan-root', path: r, reason: 'root-not-found' })
      continue
    }
    const w = walk(r)
    if (w.truncated) unjudged.push({ source: 'scan-root', path: r, reason: `超过 ${TRIAGE_POLICY.maxFilesPerRoot} 文件已截断` })
    for (const f of w.files) {
      if (!isDangerousExt(f.path)) continue
      let text = ''
      try {
        text = readFileSync(f.path, 'utf8')
      } catch {
        unjudged.push({ source: 'scan-root', path: f.path, reason: 'read-failed' })
        continue
      }
      const s = webshellScore(text)
      if (s.severity !== 'clean') landed.push({ ...f, severity: s.severity, hits: s.hits })
    }
  }
  for (const f of landed) findings.push({ type: 'host-webshell', severity: f.severity, detail: `${f.path} 命中:${f.hits.join('/')}`, path: f.path })

  // ② 异常外连
  const ns = run('netstat', ['-ano'])
  if (!ns.ok) {
    unjudged.push({ source: 'netstat', reason: ns.error })
  } else {
    const conns = parseNetstat(ns.text)
    const procs = readProcessNames()
    if (procs.error) unjudged.push({ source: 'process-names', reason: procs.error })
    const procByPid = procs.map
    for (const c of conns) {
      const v = classifyConn({ ...c, proc: procByPid.get(c.pid) ?? '' })
      if (v.suspicious) findings.push({ type: 'host-c2', severity: v.severity, detail: `${c.ip}:${c.port} ← ${procByPid.get(c.pid) ?? c.pid} (${v.reason})` })
    }
  }

  // ③ 持久化
  const { items: current, errors: persistErrors } = collectPersistence()
  for (const e of persistErrors) unjudged.push(e)
  let persistenceVerdict = { added: [], removed: [], baselineCreated: false }
  if (!existsSync(baselinePath) || rebuild) {
    mkdirSync(dirname(baselinePath), { recursive: true })
    writeFileSync(baselinePath, `${JSON.stringify({ version: 1, generatedAt: new Date().toISOString(), items: current }, null, 2)}\n`, 'utf8')
    persistenceVerdict.baselineCreated = true
  } else {
    try {
      const base = JSON.parse(readFileSync(baselinePath, 'utf8'))
      const d = diffPersistence(base.items, current)
      persistenceVerdict = { ...d, baselineCreated: false }
      for (const it of d.added) {
        const sev = suspectPersistence(it) ? 'high' : 'medium'
        findings.push({ type: 'host-persistence', severity: sev, detail: `新增 ${it.kind}: ${it.name}${it.path ? ` → ${it.path}` : ''}` })
      }
    } catch (err) {
      unjudged.push({ source: 'host-baseline', reason: `基线损坏: ${err?.message ?? err}` })
    }
  }

  const summary = {
    generatedAt: new Date().toISOString(),
    policy: { recentDays: TRIAGE_POLICY.recentDays, roots: scanRoots },
    counts: {
      webshell: findings.filter((f) => f.type === 'host-webshell').length,
      c2: findings.filter((f) => f.type === 'host-c2').length,
      persistence: findings.filter((f) => f.type === 'host-persistence').length,
      high: findings.filter((f) => f.severity === 'high').length,
    },
    persistence: persistenceVerdict,
    findings,
    unjudged,
    verdict: findings.some((f) => f.severity === 'high') ? 'breach-suspect' : unjudged.length ? 'partial' : 'clean',
  }

  mkdirSync(dirname(reportPath), { recursive: true })
  writeFileSync(reportPath, `${JSON.stringify(summary, null, 2)}\n`, 'utf8')

  if (jsonOut) {
    console.log(JSON.stringify(summary, null, 2))
  } else {
    console.log(`主机三查: ${summary.verdict}  high=${summary.counts.high} webshell=${summary.counts.webshell} c2=${summary.counts.c2} persistence=${summary.counts.persistence}`)
    for (const f of findings.slice(0, 20)) console.log(`  [${f.severity}] ${f.type}: ${f.detail}`)
    for (const u of unjudged) console.log(`  [未判定] ${u.source}: ${u.path ?? ''} ${u.reason ?? ''}`)
    if (persistenceVerdict.baselineCreated) console.log('  基线已建立(下次起可比对新增项)')
    console.log(`  报告: ${reportPath}`)
  }
  process.exit(summary.verdict === 'breach-suspect' ? 1 : summary.verdict === 'partial' ? 2 : 0)
}

if (import.meta.url === `file:///${process.argv[1]?.replace(/\\/g, '/')}`) main()

export const __test__ = { isDangerousExt, webshellScore, parseNetstat, classifyConn, diffPersistence, suspectPersistence }
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
