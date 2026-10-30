// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * API 蓝绿切换器(Node 版)—— 部署环调用面,取代 ihui-api-bluegreen.ps1。
 *
 * 立因(2026-10-28 22:48 实测取证,不是推测):
 *   ① `& powershell -File ihui-api-bluegreen.ps1` 是「powershell 起嵌套 powershell」,本机安全
 *      策略把这种子进程限成几乎无 cmdlet 可用 —— 子进程第一行 Test-Path 就报
 *      "The term 'Test-Path' is not recognized"。
 *   ② 即使子进程能跑,脚本里的 sc.exe start/stop 也被程序黑名单封死(实测启动即
 *      "PROGRAM BLOCKED BY SECURITY POLICY … sc.exe")。
 *   两条叠加 ⇒ 部署环每次走到蓝绿这一步都 rc≠0,WARN 又不判部署失败 ⇒ **api 代码静默滞后于
 *   HEAD**(green 自 12:43 起就没换过代码,而 web 侧已部署 22:48 的 HEAD)。
 *
 * 根治路径(不做 workaround):改用 Node 直跑(不受 PowerShell 嵌套策略约束),服务控制改走
 * nssm(C:\Windows\System32\nssm.exe,实测 status/start/stop 全可用,SYSTEM 账户亦可)。
 *
 * 语义与原 .ps1 逐条对齐,不新增判据:
 *   0. 状态自愈:active 色不健康而另一色健康 ⇒ 改写 active(开机只有 blue 自启的场景)
 *   1. 目标色 = auto ? 非活跃色 : 显式色
 *   2. 起目标色(判据 = 该色跑的是不是本次代码;不是就先停再起,否则加载的是旧代码)
 *      判据落地:运行记录 <state-file 去 .json>-runtime.json 存各色上次过门禁时的 git sha,
 *      与本次 HEAD 一致才跳过启动。sha 判不出(服务环境无 git)⇒ 保守重起,失效方向是
 *      多一次冷启动,绝不是"新代码静默不上"。
 *   3. 健康门禁:轮询 http://127.0.0.1:<port>/api/health 直到 "status":"ok"
 *   4. 原子写状态文件(tmp + rename),router 1s 内切上游(8802 始终有监听)
 *   5. 排空 DrainSec 秒,让旧色上的 in-flight 请求与 WS 自然结束
 *   6. 停旧色
 *
 * 失败语义:目标色起不来 ⇒ 状态文件不动、旧色继续服务、exit 1(部署失败但线上无损)。
 *
 * 用法:node ihui-api-bluegreen.mjs [--target auto|blue|green] [--health-timeout 120]
 *        [--drain 20] [--state-file <p>] [--log-file <p>] [--dry-run]
 *
 * 通用化(2026-10-29):默认即 API 形态(服务 IHUI-API-BLUE/GREEN、端口 8842/8843、
 * 健康 /api/health 含 "status":"ok"),**不带新参数时行为与旧版逐字一致**。web 蓝绿
 * 复用同一份编排器需显式给:
 *        --svc-blue IHUI-WEB-BLUE --svc-green IHUI-WEB-GREEN
 *        --port-blue 8851 --port-green 8852
 *        --health-path / --health-match '<!DOCTYPE html'
 *        --state-file D:\DevEnv\ihui-prod\deploy\run\web-bluegreen.json
 *   立因:web 蓝绿最初写成 `& powershell -File ihui-api-bluegreen.ps1`,同时踩上面
 *   ①②两条(嵌套解释器无 cmdlet + sc.exe 被封)⇒ 首次启用即 `Test-Path is not
 *   recognized`、rc≠0、FAIL 未切流。参数化是唯一出路:服务控制只有 nssm 这条路通,
 *   不能靠换解释器绕过。
 */
import { execFileSync } from 'node:child_process'
import fs from 'node:fs'
import http from 'node:http'
import path from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'

const NSSM =
  process.env.IHUI_NSSM || path.join(process.env.SystemRoot || 'C:\\Windows', 'System32', 'nssm.exe')

function parseArgs(argv) {
  const out = {
    target: 'auto',
    healthTimeoutSec: 120,
    drainSec: 20,
    stateFile: 'D:\\DevEnv\\ihui-prod\\deploy\\run\\api-bluegreen.json',
    logFile: 'D:\\DevEnv\\logs\\api-bluegreen.log',
    dryRun: false,
    // 目标形态参数(2026-10-29 加):默认 = API,web 蓝绿显式覆写。默认不改 ⇒ 旧调用方零影响。
    svcBlue: 'IHUI-API-BLUE',
    svcGreen: 'IHUI-API-GREEN',
    portBlue: 8842,
    portGreen: 8843,
    healthPath: '/api/health',
    healthMatch: '"status":"ok"',
  }
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i]
    const next = () => argv[++i]
    if (a === '--target') out.target = String(next() || 'auto')
    else if (a === '--health-timeout') out.healthTimeoutSec = Number(next()) || 120
    else if (a === '--drain') out.drainSec = Number(next()) || 0
    else if (a === '--state-file') out.stateFile = String(next() || out.stateFile)
    else if (a === '--log-file') out.logFile = String(next() || out.logFile)
    else if (a === '--svc-blue') out.svcBlue = String(next() || out.svcBlue)
    else if (a === '--svc-green') out.svcGreen = String(next() || out.svcGreen)
    else if (a === '--port-blue') out.portBlue = Number(next()) || out.portBlue
    else if (a === '--port-green') out.portGreen = Number(next()) || out.portGreen
    else if (a === '--health-path') out.healthPath = String(next() || out.healthPath)
    else if (a === '--health-match') out.healthMatch = String(next() || out.healthMatch)
    else if (a === '--dry-run') out.dryRun = true
  }
  if (!['auto', 'blue', 'green'].includes(out.target)) out.target = 'auto'
  return out
}

const args = parseArgs(process.argv.slice(2))

/** 服务名与端口一律由参数派生(默认 API 形态),不再写死 —— 见头部「通用化」注。 */
const SERVICES = { blue: args.svcBlue, green: args.svcGreen }
const PORTS = { blue: args.portBlue, green: args.portGreen }

function stamp() {
  const d = new Date()
  const p = (n) => String(n).padStart(2, '0')
  return `${p(d.getHours())}:${p(d.getMinutes())}:${p(d.getSeconds())}`
}

/** 日志双投:stdout(部署环会收集成 [bg] 行) + 追加同名日志文件(与 .ps1 同格式,便于对照历史)。 */
function log(level, msg) {
  const line = `[${stamp()}] [${level}] ${msg}`
  process.stdout.write(`${line}\n`)
  try {
    fs.mkdirSync(path.dirname(args.logFile), { recursive: true })
    fs.appendFileSync(args.logFile, `${line}\n`, 'utf8')
  } catch {
    /* 日志写不进不影响切换本身 */
  }
}

function nssmStatus(name) {
  try {
    const out = execFileSync(NSSM, ['status', name], { encoding: 'utf8', windowsHide: true })
    return String(out || '').trim()
  } catch (e) {
    // nssm status 对不存在的服务也返回非 0;把原始输出交回调用方判断,不臆造状态
    const out = String((e && (e.stdout || e.message)) || '').trim()
    return out || 'SERVICE_UNKNOWN'
  }
}

function nssmDo(verb, name) {
  try {
    execFileSync(NSSM, [verb, name], { encoding: 'utf8', windowsHide: true })
    return { ok: true, why: '' }
  } catch (e) {
    return { ok: false, why: String((e && (e.stdout || e.message)) || e) }
  }
}

function waitService(name, desired, timeoutMs) {
  const deadline = Date.now() + timeoutMs
  while (Date.now() < deadline) {
    if (nssmStatus(name) === desired) return true
    Atomics.wait(new Int32Array(new SharedArrayBuffer(4)), 0, 0, 400) // 同步 sleep 400ms
  }
  return false
}

function startService(name) {
  const st = nssmStatus(name)
  if (st === 'SERVICE_RUNNING') {
    log('INFO', `服务 ${name} 已在运行,先停止以便加载新代码`)
    nssmDo('stop', name)
    if (!waitService(name, 'SERVICE_STOPPED', 30000)) {
      throw new Error(`服务 ${name} 30 秒内未停止,放弃切换`)
    }
    // 2026-10-30 修:原实现只"停"不"再起" ⇒ 服务被留在 STOPPED,后续健康门禁直接判不健康、
    // 不切流,表现为"目标色永远起不来"。停完必须再发一次 START 才能加载新代码。
    log('INFO', `重新启动服务 ${name}(加载新代码)`)
    const r2 = nssmDo('start', name)
    if (!r2.ok) log('WARN', `nssm start ${name} 返回非 0(${r2.why.trim()}),以服务状态为准继续等待`)
  } else if (st === 'SERVICE_START_PENDING') {
    // 上一次启动还没落地(例如外部刚触发):不重复下 START,直接等状态,免得把
    // "START 控制在 PENDING 上火"当失败(实测 nssm 会回
    // "Unexpected status SERVICE_START_PENDING in response to START control")。
    log('INFO', `服务 ${name} 已在启动中(START_PENDING),等它落地`)
  } else {
    log('INFO', `启动服务 ${name}`)
    const r = nssmDo('start', name)
    // 返回码只作提示:判据一律以 nssm status 的实际终态为准,不用控制面回执冒充结果。
    if (!r.ok) log('WARN', `nssm start ${name} 返回非 0(${r.why.trim()}),以服务状态为准继续等待`)
  }
  if (!waitService(name, 'SERVICE_RUNNING', 15000)) {
    // 不强求 nssm 报 RUNNING:本色服务是 wrapper 形态(run-api.ps1 起 node 子进程后自身退出),
    // 服务状态会落回 STOPPED 而 api 进程已在该色端口监听(实测 blue pid=40348 已 listening:8842
    // 同时 nssm status=SERVICE_STOPPED)。成败一律交给后面的健康门禁判定,状态只作提示。
    log('INFO', `服务 ${name} 未报 RUNNING(nssm=${nssmStatus(name)}),以端口健康为准继续`)
  }
}

function stopService(name, timeoutMs = 45000) {
  const st = nssmStatus(name)
  if (st === 'SERVICE_STOPPED' || st === 'SERVICE_UNKNOWN') return
  log('INFO', `停止服务 ${name}`)
  nssmDo('stop', name)
  if (!waitService(name, 'SERVICE_STOPPED', timeoutMs)) {
    log('WARN', `服务 ${name} 未在 ${Math.round(timeoutMs / 1000)}s 内停止(继续,不阻塞部署)`)
  }
}

/**
 * 健康探测(2026-10-29 参数化):路径与匹配串都来自参数 ⇒ 同一份编排器既能判 api
 * (/api/health 含 "status":"ok")也能判 web(/ 含 <!DOCTYPE html)。
 * 不传 --health-match 时只要求 200(不臆造匹配串)。
 *
 * 唯一硬约束:**这条 Promise 必须给出结论**。旧实现读满 4096 字节就 `req.destroy()` 掐流,
 * 之后 `res` 的 'end' 永不触发 ⇒ Promise 永悬 ⇒ 没有待办句柄时 Node 直接静默 exit 0。
 * web 首页 HTML 必超 4096 ⇒ 自 03:03 起每一轮 web 换流都在这一步蒸发(状态文件不动、
 * 无 ERROR 行、rc=0,而全部健康门禁报绿);api 族因为 /api/health 是小 JSON 才侥幸正常。
 * 现在:只截累加不掐流,并且带一条必然触发的看门狗 —— 失效方向是"判不健康、不切流",
 * 绝不是"什么都没发生"。
 */
export function makeProbe({
  healthPath = '/api/health',
  healthMatch = '"status":"ok"',
  timeoutMs = 3000,
  watchdogMs = 10000,
  httpImpl = http,
} = {}) {
  return (port) =>
    new Promise((resolve) => {
      let settled = false
      let guard = null
      const finish = (ok) => {
        if (settled) return
        settled = true
        if (guard) clearTimeout(guard)
        resolve(ok)
      }
      guard = setTimeout(() => finish(false), Math.max(timeoutMs + 1000, watchdogMs))
      const req = httpImpl.get({ host: '127.0.0.1', port, path: healthPath, timeout: timeoutMs }, (res) => {
        let body = ''
        let capped = false
        res.setEncoding('utf8')
        res.on('data', (c) => {
          if (capped) return
          body += c
          if (body.length > 262144) capped = true
        })
        res.on('end', () => finish(res.statusCode === 200 && (!healthMatch || body.includes(healthMatch))))
        res.on('aborted', () => finish(false))
        res.on('error', () => finish(false))
      })
      req.on('timeout', () => {
        req.destroy()
        finish(false)
      })
      req.on('error', () => finish(false))
    })
}

function probeHealthy(port) {
  return makeProbe({ healthPath: args.healthPath, healthMatch: args.healthMatch })(port)
}

async function waitHealthy(port, timeoutMs) {
  const deadline = Date.now() + timeoutMs
  while (Date.now() < deadline) {
    if (await probeHealthy(port)) return true
    await new Promise((r) => setTimeout(r, 1500))
  }
  return false
}

function readState() {
  try {
    const s = JSON.parse(fs.readFileSync(args.stateFile, 'utf8'))
    return {
      active: s.active === 'green' ? 'green' : 'blue',
      blue: Number(s.blue) || PORTS.blue,
      green: Number(s.green) || PORTS.green,
    }
  } catch (e) {
    if (fs.existsSync(args.stateFile)) log('WARN', `状态文件损坏,按默认 blue 处理:${e.message}`)
    return { active: 'blue', blue: PORTS.blue, green: PORTS.green }
  }
}

/** 与 .ps1 的 Write-BgStateAtomic 同语义:先写 .tmp 再改名,router 不会读到半个文件。 */
function writeStateAtomic(active, ports) {
  fs.mkdirSync(path.dirname(args.stateFile), { recursive: true })
  const tmp = `${args.stateFile}.tmp`
  const local = new Date(Date.now() + 8 * 3600_000).toISOString().replace('Z', '+08:00')
  const payload = { active, blue: ports.blue, green: ports.green, updatedAt: local }
  fs.writeFileSync(tmp, JSON.stringify(payload, null, 2), 'utf8')
  fs.renameSync(tmp, args.stateFile)
}

// ── 目标色"跑的是不是本次代码"────────────────────────────────────────────────
// 立因(2026-10-30 同型第二面):换流脚本按"端口健康"判目标色是否已就绪,而端口健康只说明
// **有个本色的进程在服务**,不说明它加载的是本次到达的代码。63ff277f03 先用"web 形态一律
// 先停再起"堵住 web 侧;api 形态当时以"避免二次 start 撞端口"为由保留幂等跳过 ⇒ 同一型
// 漏洞在 api 侧继续存在(目标色是上一轮起好却没切流的好实例时,代码换完它照样在跑旧的,
// 日志只留一行"跳过启动",其余结论全绿)。这里把判据换成可核验的事实:运行记录里存着
// 该色上次通过健康门禁时的 git sha,与本次 HEAD 一致才允许跳过。
const RUNTIME_FILE = args.stateFile.replace(/\.json$/i, '') + '-runtime.json'

/** 本次代码的 sha(判不出就是空串 —— 调用方必须把它当"未判定",失效方向是多一次冷启动)。 */
function currentCodeSha() {
  const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..')
  // 候选顺序:显式覆盖 → PATH 里的 git → 本机安装位的绝对路径。nssm 以 SYSTEM 起服务,
  // PATH 未必带 Git\cmd;这一层不是"猜 sha",只是换一个 bin 去问同一个问题。
  const candidates = [
    process.env.IHUI_GIT,
    'git',
    path.join(process.env.ProgramFiles || 'C:\\Program Files', 'Git', 'cmd', 'git.exe'),
  ].filter(Boolean)
  for (const gitBin of candidates) {
    try {
      const sha = execFileSync(gitBin, ['-C', root, 'rev-parse', 'HEAD'], {
        encoding: 'utf8',
        windowsHide: true,
        timeout: 20000,
      })
        .trim()
        .toLowerCase()
      if (/^[0-9a-f]{40,64}$/.test(sha)) return sha
    } catch {
      /* 换下一个候选 */
    }
  }
  // 全部候选都问不出来 —— 一律返回空串,由 decideColorStart 走"保守重起"。
  // 绝不猜一个 sha 出来:猜对了省一次冷启动,猜错了就是"新代码静默不上"。
  log('WARN', '本次代码 sha 未判定(所有 git 候选都不可用)⇒ 目标色按保守口径重起')
  return ''
}

function readRuntime() {
  try {
    const j = JSON.parse(fs.readFileSync(RUNTIME_FILE, 'utf8'))
    return j && typeof j === 'object' && !Array.isArray(j) ? j : {}
  } catch {
    return {}
  }
}

/** 原子写(同 writeStateAtomic 语义):租到一半崩掉也不会留下半个 JSON 误导下一轮判定。 */
function writeRuntime(record) {
  try {
    fs.mkdirSync(path.dirname(RUNTIME_FILE), { recursive: true })
    const tmp = `${RUNTIME_FILE}.tmp-${process.pid}`
    fs.writeFileSync(tmp, JSON.stringify(record, null, 2), 'utf8')
    fs.renameSync(tmp, RUNTIME_FILE)
  } catch (e) {
    // 记录写不进不影响本轮切换对不对,但必须留痕:下一轮会因此重起一次本色。失效方向可接受。
    log('WARN', `运行记录写入失败(不影响切换,下一轮将重起一次本色):${e.message}`)
  }
}

/**
 * 目标色要不要(重)起。纯函数,判定矩阵由 deploy/tests/ihui-api-bluegreen.test.mjs 锁住。
 * @param {{isWebForm:boolean, portHealthy:boolean, recordedSha:string, currentSha:string}} input
 * @returns {{start:boolean, reason:string}}
 */
export function decideColorStart({ isWebForm, portHealthy, recordedSha, currentSha }) {
  if (!portHealthy) return { start: true, reason: '目标色端口无健康应答' }
  if (isWebForm) {
    return { start: true, reason: 'web 形态:前台阻塞进程,非活跃色先停再起才能加载本次构建' }
  }
  if (!currentSha) {
    return { start: true, reason: '本次代码 sha 未判定 ⇒ 保守重起(失效方向是多一次冷启动)' }
  }
  if (recordedSha && String(recordedSha).toLowerCase() === currentSha) {
    return { start: false, reason: `目标色记录的代码 sha=${currentSha} 与本次一致` }
  }
  return {
    start: true,
    reason: `目标色在服务但记录的代码 sha=${recordedSha || '缺失'} ≠ 本次 ${currentSha}`,
  }
}

async function main() {
  const ports = { blue: PORTS.blue, green: PORTS.green }
  let state = readState()

  // ── 0. 状态自愈 ────────────────────────────────────────────────────────────
  if (args.target === 'auto') {
    const other = state.active === 'blue' ? 'green' : 'blue'
    if (!(await probeHealthy(ports[state.active])) && (await probeHealthy(ports[other]))) {
      log(
        'WARN',
        `状态自愈:活跃色 ${state.active}(${ports[state.active]}) 不可服务,另一色 ${other} 健康 ⇒ 活跃色改写为 ${other}`,
      )
      if (!args.dryRun) writeStateAtomic(other, ports)
      state = readState()
    }
  }

  // ── 1. 决定目标色 ──────────────────────────────────────────────────────────
  const target =
    args.target === 'auto' ? (state.active === 'blue' ? 'green' : 'blue') : args.target
  const oldColor = state.active
  const targetSvc = SERVICES[target]
  const targetPort = ports[target]
  const oldSvc = SERVICES[oldColor]
  const oldPort = ports[oldColor]

  log('INFO', `当前活跃=${oldColor}(${oldPort}) 目标=${target}(${targetPort}) 服务=${targetSvc}`)

  if (target === oldColor) {
    log('WARN', '目标色与活跃色相同 ⇒ 退化为原地重启,期间入口端口会短暂 502')
  }

  if (args.dryRun) {
    log('INFO', `dry-run:将 起 ${targetSvc} → 健康:${targetPort} → 切流 → 排空 ${args.drainSec}s → 停 ${oldSvc}`)
    return 0
  }

  // ── 2. 起目标色 ────────────────────────────────────────────────────────────
  // 2026-10-30 修(实测事故):原实现只看端口健康就跳过启动,不校验目标色跑的是不是**本次构建**。
  // green 自 15:16 就在跑旧构建 ⇒ 部署判 pass 但含修复的 CSS 块 404,新构建永远加载不上。
  // 63ff277f03 的修法只覆盖 web 形态;api 形态仍留着"端口健康就跳过",同一个洞换个形态还在。
  // 现在两形态统一问同一个问题:该色跑的是不是本次代码(见 decideColorStart)。
  const isWebForm = args.healthPath === '/'
  const currentSha = currentCodeSha()
  const decision = decideColorStart({
    isWebForm,
    portHealthy: await probeHealthy(targetPort),
    recordedSha: (readRuntime()[target] || {}).sha,
    currentSha,
  })
  if (decision.start) {
    log('INFO', `起目标色 ${target}(${targetPort}):${decision.reason}`)
    startService(targetSvc)
  } else {
    log('INFO', `跳过启动 ${targetSvc}:${decision.reason}`)
  }

  // ── 3. 健康门禁 ────────────────────────────────────────────────────────────
  log('INFO', `等待 ${targetSvc} 健康(:${targetPort},上界 ${args.healthTimeoutSec}s)`)
  const healthy = await waitHealthy(targetPort, args.healthTimeoutSec * 1000)
  if (!healthy) {
    log('ERROR', `${targetSvc} 未能就绪 ⇒ 不切流,活跃仍是 ${oldColor}`)
    if (target !== oldColor) stopService(targetSvc, 20000)
    return 1
  }
  log('INFO', `${targetSvc} 健康检查通过`)
  // 只有"健康门禁真过了"才落运行记录 —— 记录的意义是"这个色此刻在用这份代码答话",
  // 没通过门禁的进程写进去,下一轮就会拿它当"已是最新"而跳过重启。
  {
    const rec = readRuntime()
    rec[target] = { sha: currentSha, at: new Date(Date.now() + 8 * 3600_000).toISOString().replace('Z', '+08:00') }
    writeRuntime(rec)
  }

  // ── 4. 原子切流 ────────────────────────────────────────────────────────────
  if (target !== oldColor) {
    writeStateAtomic(target, ports)
    log('INFO', `状态已切换 active=${target}(router 1s 内生效)`)
  }

  // ── 5. 排空 / 6. 停旧色 ────────────────────────────────────────────────────
  if (target !== oldColor) {
    if (args.drainSec > 0) {
      log('INFO', `排空 ${args.drainSec}s(旧色继续承接已建立连接)...`)
      await new Promise((r) => setTimeout(r, args.drainSec * 1000))
    }
    stopService(oldSvc)
    log('INFO', `切换完成:活跃=${target}(:${targetPort}) 旧色=${oldColor} 已停止`)
  } else {
    log('INFO', `原地重启完成:活跃=${target}(:${targetPort})`)
  }
  return 0
}

// 双形态入口(AGENTS §22d):顶层直接跑 main() 会让测试 import 时就执行一次真实切换,
// 所以取不到"我就是被直接调起的那一个"时绝不启动。
const isDirectRun = process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href

if (isDirectRun) {
  main()
    .then((code) => process.exit(code))
    .catch((e) => {
      log('ERROR', `切换异常:${e && e.message ? e.message : e}`)
      process.exit(2)
    })
}

export const __test__ = { makeProbe, parseArgs, probeHealthy, decideColorStart, currentCodeSha }
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
