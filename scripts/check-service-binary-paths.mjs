#!/usr/bin/env node
// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * Windows 服务二进制路径烂掉量算器(票 G-302;只读:不创建/修改/启停任何服务)。
 *
 * 立因(真机实测,2026-09-27):`IHUI-RSSHUB` 的 nssm Application 指向
 *   C:\Users\Administrator\.workbuddy\binaries\node\versions\22.22.2-2\node.exe,
 * 该 IDE 自升级把目录换成了 22.22.2-3 ⇒ 路径不存在,服务停/win32 退出码 3,
 * 而提交链上全部门禁没有一道看这件事,Alertmanager 当时 0 条告警 —— 静默了 3 天。
 *
 * 判"某服务在不在跑"必须**分开问三件事**(本仓同族教训:一条门只管自己立项那一型,就是那一型的洞):
 *   D1 STATE      —— Get-Service 现在是什么态。只看这条会把"启动即崩"读成"停着而已"。
 *   D2 路径在不在 —— nssm get Application/AppDirectory 指向的东西是否真存在。
 *       ⚠ nssm 的 stdout 是 **UTF-16LE(无 BOM,实测 NUL 占比 0.5)**,
 *       直接按 utf8 读会得到夹杂 NUL 的乱码;"取不到值"(派生失败/非零退出)与
 *       "值为空"(退出码 0 + 空白载荷,实测 AppEnvironmentExtra 未设时就是 0d00 0a00)
 *       是**两个不同的结论**,必须走两条不同的态 —— 把工具失效读成事实是本机明令禁止的坑。
 *   D3 答不答     —— 从服务自身配置(nssm AppParameters / AppEnvironmentExtra)能读到端口就
 *       TCP 探一次;读不到端口 ⇒ 这一维如实记"未判定",绝不推测成"没问题"。
 *       只看 D3 会把"端口被别人占了"读成"服务健康",所以三条各自立账、合并只出级别。
 *
 * 每维三态硬要求:`量到了 N` / `量不到(点名原因)` / `确实是 0` 三者绝不并桶。
 * 非 win32、nssm 不在位、派生超时、枚举输出形态不认识 ⇒ 一律未判定,不记为通过。
 *
 * 定级(不得自作主张改):**warn / 手动问责档,绝不进 blocking 提交链** ——
 * 服务路径属机器状态,提交者结构上满足不了;挂 blocking 就是每台每次被逼跳门、
 * 连带让全部守门作废(§12e 同型)。同类先例:check-artifact-budget(warn)、
 * visible-window-probe(刻意不进提交链)。它**不是守门**,头注不自称"已接 pre-commit / CI"。
 *
 * 用法:
 *   node scripts/check-service-binary-paths.mjs                 # 人读全量
 *   node scripts/check-service-binary-paths.mjs --json          # 机器读(stdout 只有 JSON)
 *   node scripts/check-service-binary-paths.mjs --service IHUI-RSSHUB --service IHUI-API
 *   node scripts/check-service-binary-paths.mjs --filter 'ihui-*'
 *   node scripts/check-service-binary-paths.mjs --self-test     # 构造面自检(零派生、零副作用)
 * 退出码:
 *   0 = 扫描跑完且**没有量到的问题**(存在未判定维时末行明写"不出具合格证",不是"全健康");
 *   1 = 至少一个服务有**量到的**问题(路径不存在 / 非 RUNNING / 声明端口不应答 / Application 值为空);
 *   2 = 未判定到无法给出任何结论(非 win32 / 枚举派生失败或输出形态不认识 / --self-test 失败)。
 */
import { spawnSync } from 'node:child_process'
import net from 'node:net'
import { existsSync, statSync } from 'node:fs'
import { hostname } from 'node:os'
import { pathToFileURL } from 'node:url'

/** 唯一被允许派生的 PowerShell 绝对路径(本机实测该引擎已是 7.x;不外推到别的机器)。 */
export const PWSH_ABS = 'C:\\Windows\\System32\\WindowsPowerShell\\v1.0\\powershell.exe'
/** nssm 候选绝对路径 —— 机器事实按当次存在性取,全部不在位则整维未判定。 */
export const NSSM_CANDIDATES = ['C:\\Windows\\System32\\nssm.exe']
/** 只读枚举要同时见到首尾哨兵才算"枚举量到了";§5b 记过双引号转义让 PS 静默返空的坑,
 *  没有哨兵的"0 行"与"根本没跑到"必须能分开。 */
export const ENUM_HEAD = '#IHUI-SVC-LIST v1'
export const ENUM_TAIL = '#IHUI-SVC-END'
const PS_TIMEOUT_MS = 30_000
const NSSM_TIMEOUT_MS = 5_000
const TCP_TIMEOUT_MS = 1_500
/** 每服务最多探这么几个端口(再多说明配置里有噪声,只按前几个作答,其余如实报数)。 */
const MAX_PROBE_PORTS = 6

// ---------------------------------------------------------------------------
// 三态维度的唯一表示:`{kind:'measured', value}` 或 `{kind:'unmeasured', reason}`。
// "值是空串/空数组"属于 **measured**(量到了空),"拿不到"才属于 unmeasured。
// ---------------------------------------------------------------------------
const measured = (value) => ({ kind: 'measured', value })
const unmeasured = (reason) => ({ kind: 'unmeasured', reason: String(reason ?? '(无原因)') })

// ---------------------------------------------------------------------------
// 纯函数层(全部被测试直接 import,§22c:测试里不得再抄一份实现)
// ---------------------------------------------------------------------------

/**
 * nssm 输出解码。实测 stdout 是 **无 BOM 的 UTF-16LE**(NUL 占比 ~0.5);
 * 不假设一定有 BOM,按 NUL 密度识别,识别不了退回 utf8 并如实标 encoding。
 */
export function decodeNssm(buf) {
  const b = Buffer.isBuffer(buf) ? buf : Buffer.alloc(0)
  if (b.length === 0) return { encoding: 'empty', text: '' }
  let nul = 0
  for (const byte of b) if (byte === 0) nul++
  const ratio = nul / b.length
  if (b[0] === 0xff && b[1] === 0xfe) return { encoding: 'utf16le', text: b.toString('utf16le').replace(/^\uFEFF/, '') }
  if (ratio >= 0.25 && b.length % 2 === 0) return { encoding: 'utf16le', text: b.toString('utf16le') }
  return { encoding: 'utf8', text: b.toString('utf8') }
}

/**
 * 把一次 nssm get 的原始结果折叠成一个维度。
 * 关键分岔:**code===0** 才是"取到了"(哪怕载荷是空白 ⇒ 值为空),
 * **派生失败 / 非零退出码** 一律 unmeasured 并带上 stderr 片段 —— 二者绝不同态。
 */
export function interpretNssmGet(raw) {
  if (raw?.spawnError) {
    const why = raw.spawnError === 'ETIMEDOUT' ? '派生超时' : raw.spawnError === 'ENOENT' ? 'nssm 不在位' : raw.spawnError
    return unmeasured(`取不到值:派生失败(${why})`)
  }
  if (typeof raw?.code !== 'number') return unmeasured('取不到值:没有退出码可判')
  if (raw.code !== 0) {
    const err = decodeNssm(raw.stderrBuf).text.replace(/\r?\n/g, ' ').trim().slice(0, 120)
    return unmeasured(`取不到值:nssm 非零退出码 ${raw.code}${err ? ` (${err})` : ''}`)
  }
  const text = decodeNssm(raw.stdoutBuf).text.replace(/\r\n/g, '\n').trim()
  if (text === '') return measured(null) // ← "值为空":量到了,内容是空
  const first = text.split('\n')[0].trim()
  if (first === '') return measured(null)
  return measured(first)
}

/** 端口维度:从 AppParameters + AppEnvironmentExtra 两份**服务自身配置**里抠端口。
 *  只认这几形态;抠不到 ⇒ 空数组(合法结论"该服务配置里没声明端口"),不是猜测。 */
export function extractPortsFromConfig(texts) {
  const joined = (Array.isArray(texts) ? texts : [texts]).filter((t) => typeof t === 'string' && t !== '').join('\n')
  const out = new Set()
  const push = (raw) => {
    const n = Number(raw)
    if (Number.isInteger(n) && n > 0 && n <= 65535) out.add(n)
  }
  for (const m of joined.matchAll(/PORT=(\d{2,5})\b/g)) push(m[1])
  // 刻意不写 \bHOST=:实测 OLLAMA_HOST 这类带下划线前缀的键里,"词边界"会把整条正则打掉
  // (下划线是词字符)—— 那是"扫到 0"伪装成"没有声明"的一型。
  for (const m of joined.matchAll(/HOST=[^\s;]*?:(\d{2,5})\b/g)) push(m[1])
  for (const m of joined.matchAll(/--port(?:=|\s+)(\d{2,5})\b/g)) push(m[1])
  for (const m of joined.matchAll(/(?:^|[\s"])\/p(?:ort)?[:=](\d{2,5})\b/gm)) push(m[1])
  for (const m of joined.matchAll(/-p\s+(\d{2,5})\b/g)) push(m[1])
  for (const m of joined.matchAll(/listen-address[=:\s]+:?(?:[\d.]*:)?(\d{2,5})\b/g)) push(m[1])
  return [...out].sort((a, b) => a - b)
}

/** 枚举输出折叠:哨兵不齐 = 未判定;"两哨兵之间 0 行" = 确实是 0 —— 三态各归各位。 */
export function parseServiceList(text) {
  const lines = String(text ?? '').replace(/\r\n/g, '\n').split('\n')
  const head = lines.findIndex((l) => l.trim() === ENUM_HEAD)
  const tail = lines.findIndex((l) => l.trim() === ENUM_TAIL)
  if (head === -1 || tail === -1 || tail < head)
    return unmeasured(`取不到值:枚举输出缺首尾哨兵(head=${head !== -1}, tail=${tail !== -1}) ⇒ 无法区分"没有服务"与"没跑到"`)
  const rows = []
  let bad = 0
  for (const line of lines.slice(head + 1, tail)) {
    const t = line.trim()
    if (t === '') continue
    const parts = t.split('|')
    if (parts.length < 4 || parts[0] !== 'SVC') {
      bad++
      continue
    }
    const [, name, status, startType] = parts
    if (!name) {
      bad++
      continue
    }
    rows.push({ name, status: String(status ?? '').toUpperCase() || 'UNKNOWN', startType: String(startType ?? '').toUpperCase() })
  }
  return measured({ rows, malformed: bad })
}

/** 过滤器:'IHUI*' / 'ihui-*' 这类通配转成大小写不敏感正则;'*' 匹配一切。 */
export function compileFilter(pattern) {
  const p = String(pattern ?? 'IHUI*').trim()
  const re = new RegExp('^' + p.split('*').map((s) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')).join('.*') + '$', 'i')
  return (name) => re.test(String(name))
}

/**
 * 三判据合并成级别。规则只有两条,且都朝"不冤枉、不背书"收:
 *  任何一维**量到了坏值** ⇒ issue;没有坏值但有维**量不到** ⇒ unattested(不冒充健康);
 *  全部维都量到且都好 ⇒ ok。
 * 注意 ports 未声明 / probe 因此没做 都算 unattested —— 那正是 D3"这一维未判定"的落点。
 */
export function judgeService(rec) {
  const problems = []
  const blind = []
  const dimName = (key, label) => {
    const d = rec[key]
    if (d && d.kind === 'unmeasured') blind.push(`${label}:${d.reason}`)
    return d && d.kind === 'measured' ? d.value : undefined
  }
  const state = dimName('state', 'STATE')
  if (state !== undefined && state !== 'RUNNING') problems.push(`STATE=${state}`)
  const app = dimName('application', 'Application')
  if (app === null) problems.push('Application 值为空(nssm 取到了,内容是空)')
  const appExists = rec.application?.kind === 'measured' && app !== null ? rec.appExists : undefined
  if (appExists && appExists.kind === 'unmeasured') blind.push(`Application 存在性:${appExists.reason}`)
  if (appExists && appExists.kind === 'measured' && appExists.value !== 'file')
    problems.push(`Application 路径不是可用文件(${appExists.value}):${app}`)
  const appDir = dimName('appDirectory', 'AppDirectory')
  if (appDir !== null && appDir !== undefined) {
    const dExists = rec.appDirectoryExists
    if (dExists && dExists.kind === 'unmeasured') blind.push(`AppDirectory 存在性:${dExists.reason}`)
    if (dExists && dExists.kind === 'measured' && dExists.value !== 'dir')
      problems.push(`AppDirectory 不是存在的目录(${dExists.value}):${appDir}`)
  }
  const ports = dimName('ports', '端口声明')
  if (ports !== undefined && ports.length === 0) blind.push('端口应答:服务配置里读不到监听端口声明 ⇒ 这一维未判定,不推测为没问题')
  if (ports !== undefined && ports.length > 0) {
    const probe = rec.probe
    if (probe.kind === 'unmeasured') blind.push(`端口应答:${probe.reason}`)
    else if (probe.value.listening !== true) problems.push(`声明端口无应答(tcp):${probe.value.ports.join(',')}`)
  }
  const level = problems.length > 0 ? 'issue' : blind.length > 0 ? 'unattested' : 'ok'
  return { level, problems, blind }
}

/** 退出码聚合:量到的问题 ⇒ 1;什么都没量到 ⇒ 2;否则 0(未判定维另行大声报数)。 */
export function computeExitCode(services, enumeration) {
  if (enumeration.kind === 'unmeasured') return 2
  const anyMeasured = services.some((s) => s.level !== 'unattested')
  if (services.length > 0 && !anyMeasured) return 2
  return services.some((s) => s.level === 'issue') ? 1 : 0
}

// ---------------------------------------------------------------------------
// CLI 参数(纯函数,便于自检喂构造 argv)
// ---------------------------------------------------------------------------
export function parseArgs(argv) {
  const opts = { help: false, json: false, selfTest: false, filter: 'IHUI*', services: [] }
  const bad = []
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i]
    if (a === '--help' || a === '-h') opts.help = true
    else if (a === '--json') opts.json = true
    else if (a === '--self-test') opts.selfTest = true
    else if (a === '--filter') {
      const v = argv[++i]
      if (typeof v === 'string' && v !== '') opts.filter = v
      else bad.push('--filter 后面没有值')
    } else if (a === '--service') {
      const v = argv[++i]
      if (typeof v === 'string' && v !== '') opts.services.push(v)
      else bad.push('--service 后面没有值')
    } else bad.push(`不认识的参数:${a}`)
  }
  return { opts, bad }
}

// ---------------------------------------------------------------------------
// 真实执行体(只有 main() 的默认 deps 会走到这里;测试一律注入假 deps)
// ---------------------------------------------------------------------------
function defaultSpawn(cmd, args, timeoutMs) {
  try {
    const out = spawnSync(cmd, args, {
      windowsHide: true,
      timeout: timeoutMs,
      maxBuffer: 8 * 1024 * 1024,
      encoding: 'buffer',
    })
    if (out.error) return { spawnError: out.error.code || out.error.name || 'spawn-error', stdoutBuf: Buffer.alloc(0), stderrBuf: Buffer.alloc(0) }
    return { code: out.status ?? -1, stdoutBuf: out.stdout ?? Buffer.alloc(0), stderrBuf: out.stderr ?? Buffer.alloc(0) }
  } catch (e) {
    return { spawnError: e?.code || e?.name || 'spawn-throw', stdoutBuf: Buffer.alloc(0), stderrBuf: Buffer.alloc(0) }
  }
}

export function buildEnumerationScript() {
  // 全程 ASCII(服务名/状态/启动类型都是 ASCII),避开码页问题;首尾哨兵与 $ErrorActionPreference
  // 一起立,把"PS 静默返空"那一型(§5b 实测坑)挡在未判定侧。
  return [
    "$ErrorActionPreference = 'Stop'",
    'try { [Console]::OutputEncoding = [System.Text.UTF8Encoding]::new($false) } catch { }',
    `Write-Output '${ENUM_HEAD}'`,
    'try {',
    "  $svcs = @(Get-Service -ErrorAction Stop)",
    "  foreach ($s in $svcs) { Write-Output ('SVC|' + $s.Name + '|' + [string]$s.Status + '|' + [string]$s.StartType) }",
    '} catch { Write-Error $_; exit 9 }',
    `Write-Output '${ENUM_TAIL}'`,
    'exit 0',
  ].join('\n')
}

const defaultDeps = {
  platform: process.platform,
  host: () => hostname(),
  psEnumerate: () => defaultSpawn(PWSH_ABS, ['-NoProfile', '-NonInteractive', '-Command', buildEnumerationScript()], PS_TIMEOUT_MS),
  resolveNssm: () => NSSM_CANDIDATES.find((p) => existsSync(p)) ?? null,
  nssmGet: (nssmPath, svc, param) => defaultSpawn(nssmPath, ['get', svc, param], NSSM_TIMEOUT_MS),
  fileKind: (p) => {
    try {
      const st = statSync(p)
      if (st.isFile()) return 'file'
      if (st.isDirectory()) return 'dir'
      return 'other'
    } catch {
      return 'missing'
    }
  },
  tcpProbe: (port) =>
    new Promise((resolve) => {
      const sock = net.connect({ host: '127.0.0.1', port })
      let settled = false
      const fin = (v) => {
        if (settled) return
        settled = true
        sock.destroy()
        resolve(v)
      }
      sock.setTimeout(TCP_TIMEOUT_MS)
      sock.once('connect', () => fin({ status: 'open' }))
      sock.once('timeout', () => fin({ status: 'unmeasured', why: `127.0.0.1:${port} 连接超时(${TCP_TIMEOUT_MS}ms)` }))
      sock.once('error', (e) => {
        const code = e && typeof e.code === 'string' ? e.code : 'unknown'
        if (code === 'ECONNREFUSED') fin({ status: 'closed' })
        else fin({ status: 'unmeasured', why: `127.0.0.1:${port} 报错(${code})` })
      })
    }),
}

async function inspectService(name, stateValue, deps, nssmPath) {
  const get = (param) => (nssmPath ? interpretNssmGet(deps.nssmGet(nssmPath, name, param)) : unmeasured(`取不到值:nssm 不在位(候选 ${NSSM_CANDIDATES.join(', ')} 都不存在)`))
  const application = get('Application')
  const appDirectory = get('AppDirectory')
  const p1 = get('AppParameters')
  const p2 = get('AppEnvironmentExtra')
  const appExists = application.kind === 'measured' && application.value !== null ? measured(deps.fileKind(application.value)) : unmeasured('没有可判的存在性(Application 未量到)')
  const appDirectoryExists =
    appDirectory.kind === 'measured' && appDirectory.value !== null ? measured(deps.fileKind(appDirectory.value)) : unmeasured('没有可判的存在性(AppDirectory 未量到)')
  const ports =
    p1.kind === 'measured' && p2.kind === 'measured'
      ? measured(extractPortsFromConfig([p1.value ?? '', p2.value ?? '']))
      : unmeasured('端口声明取不到:AppParameters/AppEnvironmentExtra 至少一份未量到')
  let probe
  if (ports.kind === 'measured' && ports.value.length > 0) {
    const targets = ports.value.slice(0, MAX_PROBE_PORTS)
    const results = await Promise.all(targets.map(async (port) => ({ port, r: await deps.tcpProbe(port) })))
    const open = results.filter((x) => x.r.status === 'open').map((x) => x.port)
    const un = results.filter((x) => x.r.status === 'unmeasured')
    if (open.length > 0) probe = measured({ listening: true, ports: targets, openPorts: open })
    else if (un.length > 0) probe = unmeasured(`端口探测有 ${un.length}/${targets.length} 个判不出:${un.map((x) => x.r.why).join(';')}`)
    else probe = measured({ listening: false, ports: targets, openPorts: [] })
  } else if (ports.kind === 'unmeasured') {
    probe = unmeasured(ports.reason)
  } else {
    probe = unmeasured('服务配置里没有端口声明(量到了空)')
  }
  const rec = { name, state: measured(stateValue), application, appExists, appDirectory, appDirectoryExists, ports, probe }
  const verdict = judgeService(rec)
  return { name, rec, ...verdict }
}

export async function main({ argv = process.argv.slice(2), deps = defaultDeps } = {}) {
  const { opts, bad } = parseArgs(argv)
  if (bad.length) return { exitCode: 2, text: `参数不认识的形态:${bad.join(';')}\n(见 --help)`, json: null }
  if (opts.help)
    return {
      exitCode: 0,
      text: '见文件头注释。warn 级手动问责量算器:三判据(STATE / 路径在不在 / 答不答)分开问,三态分明。只读,不改任何服务。',
      json: null,
    }
  if (opts.selfTest) return selfTest(opts)
  if (deps.platform !== 'win32') {
    const meta = baseMeta(deps, '未判定')
    meta.fatal = `未判定:非 win32(${String(deps.platform)}),本工具不记为通过`
    return finish(meta, 2, opts)
  }
  const meta = baseMeta(deps, null)
  const nssmPath = deps.resolveNssm()
  meta.nssm = { path: nssmPath, why: nssmPath ? null : `候选 ${NSSM_CANDIDATES.join(', ')} 都不在位 ⇒ D2 整维未判定` }

  const enumRaw = deps.psEnumerate()
  if (enumRaw.spawnError) {
    meta.enumeration = unmeasured(`PowerShell 派生失败(${enumRaw.spawnError}) ⇒ 未判定,不记为通过`)
    return finish(meta, 2, opts)
  }
  const enumText = decodeNssm(Buffer.from(enumRaw.stdoutBuf ?? '')).text
  meta.enumeration = parseServiceList(enumText)
  if (meta.enumeration.kind === 'unmeasured') {
    const errTail = decodeNssm(Buffer.from(enumRaw.stderrBuf ?? '')).text.replace(/\r?\n/g, ' ').trim().slice(0, 160)
    meta.enumeration = unmeasured(`${meta.enumeration.reason}${errTail ? `;stderr:${errTail}` : ''}(退出码 ${enumRaw.code})`)
    return finish(meta, 2, opts)
  }
  const want = new Set(opts.services)
  const match = opts.services.length > 0 ? (n) => want.has(n) : compileFilter(opts.filter)
  meta.filter = opts.services.length > 0 ? `--service ${opts.services.join(',')}` : opts.filter
  const rows = meta.enumeration.value.rows.filter((r) => match(r.name))
  meta.enumeration = measured({ ...meta.enumeration.value, matched: rows.length })

  for (const r of rows) meta.services.push(await inspectService(r.name, r.status, deps, nssmPath))
  meta.skippedByFilter = meta.enumeration.value.rows.length - rows.length
  meta.malformedRows = meta.enumeration.value.malformed

  const exitCode = computeExitCode(meta.services, meta.enumeration)
  return finish(meta, exitCode, opts)
}

function baseMeta(deps, fatalStatus) {
  let host = null
  try {
    host = typeof deps.host === 'function' ? String(deps.host()) : null
  } catch {
    host = null // 主机名量不到不影响任何判据,如实留 null
  }
  return { tool: 'check-service-binary-paths', generatedAt: new Date().toISOString(), platform: String(deps.platform), host, fatal: fatalStatus, nssm: null, enumeration: null, filter: null, services: [], skippedByFilter: 0, malformedRows: 0, totals: null }
}

function finish(meta, exitCode, opts) {
  const svcs = meta.services
  const count = (level) => svcs.filter((s) => s.level === level).length
  const dimUnmeasured = (pick) => svcs.filter((s) => pick(s.rec).kind === 'unmeasured').length
  meta.totals = {
    services: svcs.length,
    ok: count('ok'),
    issue: count('issue'),
    unattested: count('unattested'),
    dimUnmeasured: {
      // pick 收到的就是那个 rec 对象本身 —— 箭头里不得再点一次 .rec(那是本门第一次自跑
      // 就撞上的"双重解引用":写完从没跑通过的 finish,靠真跑一次 e2e 才现形)。
      state: dimUnmeasured((rec) => rec.state),
      application: dimUnmeasured((rec) => rec.application),
      ports: dimUnmeasured((rec) => rec.ports),
      probe: dimUnmeasured((rec) => rec.probe),
    },
    exitCode,
  }
  const text = renderText(meta)
  return { exitCode, text, json: JSON.stringify(meta, null, 2), opts }
}

export function renderText(meta) {
  const L = []
  L.push(`服务二进制路径量算器(G-302,warn 级,只读) @ ${meta.host ?? ''} platform=${meta.platform}`)
  if (meta.fatal) L.push(meta.fatal)
  if (meta.nssm) L.push(`nssm:${meta.nssm.path ?? `(不在位 —— ${meta.nssm.why})`}`)
  if (meta.filter) L.push(`过滤器:${meta.filter}`)
  if (meta.enumeration) {
    if (meta.enumeration.kind === 'unmeasured') L.push(`枚举:未判定 —— ${meta.enumeration.reason}`)
    else {
      const v = meta.enumeration.value
      L.push(`枚举:量到服务 ${v.rows.length} 个(按过滤器命中 ${v.matched ?? v.rows.length}${meta.skippedByFilter ? `,被过滤跳过 ${meta.skippedByFilter}` : ''}${meta.malformedRows ? `,形态不符行 ${meta.malformedRows} 条未计入` : ''})`)
      if (v.rows.length === 0) L.push('  (确实是 0:枚举成功而本机没有匹配服务。这不是"没量到"。)')
    }
  }
  for (const s of meta.services) {
    const fmt = (d) => (d.kind === 'measured' ? (d.value === null ? '(空)' : Array.isArray(d.value) ? `[${d.value.join(',')}]` : typeof d.value === 'object' ? `${d.value.listening ? '应答' : '无应答'}(${(d.value.ports ?? []).join(',')})` : String(d.value)) : `未判定:${d.reason}`)
    L.push(`${s.level === 'issue' ? '❌' : s.level === 'ok' ? '✅' : '⚪'} ${s.name}`)
    L.push(`    STATE=${fmt(s.rec.state)}  Application=${fmt(s.rec.application)}  [存在性 ${fmt(s.rec.appExists)}]  AppDirectory=${fmt(s.rec.appDirectory)}  端口=${fmt(s.rec.ports)}  应答=${fmt(s.rec.probe)}`)
    for (const p of s.problems) L.push(`      问题:${p}`)
    for (const b of s.blind) L.push(`      未判定:${b}`)
  }
  const t = meta.totals
  if (t) {
    L.push(
      `结论:服务 ${t.services} 个 —— 量到问题 ${t.issue} / 未出具合格证(有维量不到)${t.unattested} / 全维健康 ${t.ok};各维未判定 STATE=${t.dimUnmeasured.state} Application=${t.dimUnmeasured.application} 端口声明=${t.dimUnmeasured.ports} 应答=${t.dimUnmeasured.probe}`,
    )
    if (t.issue > 0) L.push('判定:不通过(存在量到的问题,逐条见上;修复属机器状态动作,由持有人执行,本工具不动任何服务)。')
    else if (t.services > 0 && t.services === t.unattested) L.push('判定:未判定 —— 这台机上没有任何服务被完整量到三判据,**不记为通过**。')
    else if (t.unattested > 0) L.push('判定:无量到的问题,但有服务存在未判定维(上面逐条点名)—— 不得把这行读成"全健康"。')
    else L.push('判定:全部匹配服务的三判据都量到了且都健康。')
  }
  return L.join('\n')
}

// ---------------------------------------------------------------------------
// --self-test:全部跑在构造面上,零派生、零副作用。正反成对(只留一侧就可能恒绿/恒红)。
// ---------------------------------------------------------------------------
function selfTest(opts) {
  const out = []
  let fail = 0
  const ok = (name, cond) => {
    if (cond) out.push(`  ✔ ${name}`)
    else {
      fail++
      out.push(`  ✘ ${name}`)
    }
  }
  const dim = (kind, v) => (kind === 'm' ? measured(v) : unmeasured(v))
  const healthy = (over = {}) => ({
    state: dim('m', 'RUNNING'),
    application: dim('m', 'C:\\node\\node.exe'),
    appExists: dim('m', 'file'),
    appDirectory: dim('m', 'C:\\app'),
    appDirectoryExists: dim('m', 'dir'),
    ports: dim('m', [8802]),
    probe: dim('m', { listening: true, ports: [8802] }),
    ...over,
  })

  // S1/S2 编解码与"值为空 vs 取不到"的分岔(真机实测形态:UTF-16LE 无 BOM)
  const utf16 = Buffer.from('D:\\IHUI-AI\\apps\\web', 'utf16le')
  const dec = decodeNssm(utf16)
  ok('S1 UTF-16LE(无 BOM)按密度识别并解出原值', dec.encoding === 'utf16le' && dec.text === 'D:\\IHUI-AI\\apps\\web')
  const emptyCrlf = Buffer.from('\r\n', 'utf16le')
  const vEmpty = interpretNssmGet({ code: 0, stdoutBuf: emptyCrlf, stderrBuf: Buffer.alloc(0) })
  const vFail = interpretNssmGet({ code: 3, stdoutBuf: Buffer.alloc(0), stderrBuf: Buffer.from('GetServiceConfigName failed', 'utf16le') })
  ok('S2 同是"没有内容":退出码 0+空白 ⇒ measured(null)(值为空),非零退出 ⇒ unmeasured(取不到) —— 两态绝不并桶', vEmpty.kind === 'measured' && vEmpty.value === null && vFail.kind === 'unmeasured')
  ok('S2b 派生失败(超时/ENOENT)⇒ unmeasured 且点名原因', interpretNssmGet({ spawnError: 'ETIMEDOUT' }).kind === 'unmeasured' && /超时/.test(interpretNssmGet({ spawnError: 'ETIMEDOUT' }).reason) && /不在位/.test(interpretNssmGet({ spawnError: 'ENOENT' }).reason))

  // S3/S4 端口提取成对:有声明提得出,没有就提空(空 ≠ 没跑)
  ok('S3 从服务自身配置抠端口:PORT= 与 HOST=...: 两形态', extractPortsFromConfig(['PORT=12000', 'OLLAMA_HOST=127.0.0.1:11434']).join(',') === '11434,12000')
  ok('S4 无端口声明 ⇒ 空数组(合法的"确实是没写"),不猜默认端口', extractPortsFromConfig(['-NoProfile -File run-web.ps1']).length === 0)

  // S5 枚举三态
  const eRows = parseServiceList(`${ENUM_HEAD}\nSVC|IHUI-API|Running|Automatic\n${ENUM_TAIL}\n`)
  const eZero = parseServiceList(`${ENUM_HEAD}\n${ENUM_TAIL}\n`)
  const eSilent = parseServiceList('')
  ok('S5 哨兵齐 ⇒ 量到行;哨兵齐而零行 ⇒ 确实是 0;两者都 ≠ "静默空输出"(无哨兵 ⇒ 未判定)', eRows.kind === 'measured' && eRows.value.rows.length === 1 && eZero.kind === 'measured' && eZero.value.rows.length === 0 && eSilent.kind === 'unmeasured')

  // S6–S10 判据成对:每一条"拦得住"都配一条"不冤枉"
  ok('S6 路径不存在 ⇒ issue 且点名该路径', (() => {
    const r = judgeService({ name: 'X', ...healthy({ appExists: dim('m', 'missing') }) })
    return r.level === 'issue' && r.problems.some((p) => p.includes('C:\\node\\node.exe'))
  })())
  ok('S7 三判据全好 ⇒ ok(反向对照:不许把健康对象判红 —— 缺这条就是恒红门)', judgeService({ name: 'X', ...healthy() }).level === 'ok')
  ok('S8 nssm 整维取不到 ⇒ unattested,既不 ok 也不 issue', (() => {
    const r = judgeService({ name: 'X', ...healthy({ application: dim('u', 'nssm 不在位'), appExists: dim('u', '没东西可判') }) })
    return r.level === 'unattested' && r.blind.some((b) => /不在位/.test(b))
  })())
  ok('S9 只有"端口这维读不到声明" ⇒ unattested(不得因 state+path 好就发合格证)', judgeService({ name: 'X', ...healthy({ ports: dim('m', []), probe: dim('u', '没有声明') }) }).level === 'unattested')
  ok('S10 端口声明在而无应答 ⇒ issue;有应答(S7)⇒ ok —— 成对', judgeService({ name: 'X', ...healthy({ probe: dim('m', { listening: false, ports: [8802] }) }) }).level === 'issue')
  ok('S10b STATE 非 RUNNING 而其余全好 ⇒ issue(只看路径会把"停着"读成健康)', judgeService({ name: 'X', ...healthy({ state: dim('m', 'STOPPED') }) }).level === 'issue')

  // S11 退出码聚合三向
  const mkSvc = (level, rec = healthy()) => ({ level, rec })
  ok('S11 issue⇒1、全 unattested⇒2、有量到且无 issue⇒0;枚举未判定⇒2',
    computeExitCode([mkSvc('issue')], measured({ rows: [] })) === 1 &&
      computeExitCode([mkSvc('unattested')], measured({ rows: [] })) === 2 &&
      computeExitCode([mkSvc('ok'), mkSvc('unattested')], measured({ rows: [] })) === 0 &&
      computeExitCode([], unmeasured('没跑到')) === 2)

  return {
    exitCode: fail > 0 ? 1 : 0,
    text: `自检 ${out.length} 条,失败 ${fail} 条(构造面,零派生):\n${out.join('\n')}\n${fail === 0 ? '✅ 自检全绿' : '❌ 自检有红 —— 判据本身有问题,先修尺子'}`,
    json: opts.json ? JSON.stringify({ selfTest: { total: out.length, failed: fail } }, null, 2) : null,
  }
}

const isDirectRun = process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href
if (isDirectRun) {
  const wantsJson = process.argv.slice(2).includes('--json')
  main()
    .then(({ exitCode, text, json }) => {
      const body = wantsJson && json != null ? json : text
      if (body) process.stdout.write(String(body) + '\n')
      process.exitCode = exitCode
    })
    .catch((e) => {
      process.stderr.write(`本工具自身异常(未判定,不记为通过):${e?.stack ?? e?.message ?? String(e)}\n`)
      process.exitCode = 2
    })
}

export const __test__ = {
  measured,
  unmeasured,
  decodeNssm,
  interpretNssmGet,
  extractPortsFromConfig,
  parseServiceList,
  compileFilter,
  judgeService,
  computeExitCode,
  parseArgs,
  buildEnumerationScript,
  renderText,
  main,
  selfTest,
  ENUM_HEAD,
  ENUM_TAIL,
  PWSH_ABS,
  NSSM_CANDIDATES,
}
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
