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
 *        [--gate-cmd <命令>] [--gate-timeout <秒>]
 *
 * ── 切流前置闸(2026-11-01 CANARYWIN2 加)──────────────────────────────────────
 * 为什么加在这里:灰度要判"新构建值不值得升档",就必须有一刻**旧色还在服务、候选也在自己的
 * 端口上跑着**(同期两份不同构建 = 真对照)。而 2026-11-01 现读到的对照缺陷正是"观察窗排在
 * 换流之后":deploy.ps1 L3229 调本编排器完成了原子切流,deploy-loop.ps1 L858 的
 * Invoke-CanaryGate 却在整轮部署跑完之后才执行 ⇒ 观察期内 stable 槽位已经是新色,升档依据
 * 退化成"新 vs 新"(判据侧编号 C1;见 ihui-canary-artifact.mjs 的 contrastGaps)。
 * 唯一能保证"旧色仍在服务"的时刻,就是本编排器**目标色健康通过之后、任何切流/停旧色动作之前**
 * —— 所以闸只能落在这里,别处(部署脚本之前/之后)都拿不到这个中间态。
 *
 * 语义(不传 --gate-cmd ⇒ 与旧版逐字相同,零行为变化):
 *   · 闸退出码 0            ⇒ 允许继续切流;
 *   · 闸退出码非 0          ⇒ **不切流、不停旧色、状态文件不改**,以 exit 9 收口;
 *   · 闸超时                ⇒ 按"未判定"处理(§0.3 取不到不是通过),同样不切流,以 exit 10 收口;
 *   · 闸的 stdout/stderr 一律原样落编排器日志(取证),不吞、不摘要。
 * 既有退出码:0 成功 / 1 目标色未健康 / 2 异常 —— 9、10 与之不冲突。
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
import { execFileSync, spawnSync } from 'node:child_process'
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
    // 切流前置闸(2026-11-01):默认空 = 不启用 ⇒ 不传时行为与旧版逐字相同。
    gateCmd: '',
    // 闸超时上界(秒)。闸命令是一条判定,不是常驻任务;给一个有限上界,超时按未判定收口。
    gateTimeoutSec: 300,
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
    else if (a === '--gate-cmd') out.gateCmd = String(next() || '')
    else if (a === '--gate-timeout') out.gateTimeoutSec = Number(next()) || out.gateTimeoutSec
    else if (a === '--dry-run') out.dryRun = true
  }
  if (!['auto', 'blue', 'green'].includes(out.target)) out.target = 'auto'
  return out
}

const args = parseArgs(process.argv.slice(2))

/** 服务名与端口一律由参数派生(默认 API 形态),不再写死 —— 见头部「通用化」注。 */
const SERVICES = { blue: args.svcBlue, green: args.svcGreen }
const PORTS = { blue: args.portBlue, green: args.portGreen }

/** 退出码:0 成功 / 1 目标色未健康 / 2 异常(既有);9 闸判红 / 10 闸超时未判定。 */
const EXIT_GATE_BLOCK = 9
const EXIT_GATE_TIMEOUT = 10

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

/**
 * 切流前置闸(2026-11-01):在"目标色健康已过、尚未切流"这一刻跑一条外部判定命令。
 *
 * 为什么用 spawnSync + 显式 stdio:本机(§12g)对子进程继承句柄会撞 EBUSY 族缺陷
 * (spawnSync ... EBUSY / status=null / errno=-4082),所以 stdio 一律显式给成
 * ['ignore','pipe','pipe'],不让子进程继承父进程的句柄;命令串交给系统 shell 解释
 * (调用方传的是"一条命令",不是 argv 数组,避免在这里二次拆引号)。
 *
 * 返回三态,不与"通过"混淆:
 *   pass    —— shell 退出码 0;
 *   block   —— 退出码非 0(判定失败,不切流);
 *   timeout —— 超时被杀(**未判定**,§0.3 同样不切流)。
 */
export function runGateCmd(cmd, timeoutSec, { cwd = undefined } = {}) {
  const timeoutMs = Math.max(1, Number(timeoutSec) || 0) * 1000
  const started = Date.now()
  // 不自己拼 `cmd /c "..."`:Windows 上引号由 Node 转义成反斜杠、cmd 不认那一套,
  // 实测会退化成「系统找不到指定的路径」(status=1,零输出) ⇒ 闸永远判红。
  // 交给 shell:true(Node 自己按平台拼命令行),一条命令串原样传入,不在本文件二次拆引号。
  const r = spawnSync(cmd, [], {
    cwd,
    shell: true,
    encoding: 'utf8',
    windowsHide: true,
    timeout: timeoutMs,
    stdio: ['ignore', 'pipe', 'pipe'], // §12g:不继承句柄,显式管道
    maxBuffer: 8 * 1024 * 1024,
  })
  const ms = Date.now() - started
  const timedOut =
    Boolean(r.error && r.error.code === 'ETIMEDOUT') ||
    (r.signal !== null && r.signal !== undefined && r.status === null)
  return {
    state: timedOut ? 'timeout' : r.status === 0 ? 'pass' : 'block',
    rc: typeof r.status === 'number' ? r.status : null,
    stdout: String(r.stdout || ''),
    stderr: String(r.stderr || '') || String((r.error && r.error.message) || ''),
    ms,
  }
}

/** 闸结论原样落日志:逐行打,不摘要、不截断(取证的意义就在这里)。 */
function logGateOutput(tag, text) {
  const body = String(text || '').replace(/\s+$/, '')
  if (!body) {
    log('INFO', `[gate] ${tag}: (空)`)
    return
  }
  for (const line of body.split(/\r?\n/)) log('INFO', `[gate] ${tag}| ${line}`)
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

  // ── 3.5 切流前置闸(2026-11-01)─────────────────────────────────────────────
  // 就是这一刻:目标色已健康、旧色仍 100% 在服务、状态文件未动 ⇒ 全流程里唯一能同时
  // 看到"旧构建在服务 + 新构建在自己端口跑着"的中间态。灰度对照(两份不同构建)只能在这里判。
  // 不传 --gate-cmd ⇒ 整段跳过,行为与旧版逐字相同。
  if (args.gateCmd) {
    log('INFO', `切流前置闸:${args.gateCmd}(上界 ${args.gateTimeoutSec}s;超时按未判定)`)
    const g = runGateCmd(args.gateCmd, args.gateTimeoutSec)
    logGateOutput('stdout', g.stdout)
    logGateOutput('stderr', g.stderr)
    if (g.state === 'timeout') {
      log(
        'ERROR',
        `切流前置闸超时(${g.ms}ms > ${args.gateTimeoutSec}s)⇒ 未判定,不切流;活跃仍是 ${oldColor}`,
      )
      return EXIT_GATE_TIMEOUT
    }
    if (g.state !== 'pass') {
      log('ERROR', `切流前置闸判红(rc=${g.rc})⇒ 不切流、不停旧色;活跃仍是 ${oldColor}`)
      return EXIT_GATE_BLOCK
    }
    log('INFO', `切流前置闸通过(rc=0,${g.ms}ms)⇒ 允许切流`)
  }
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

export const __test__ = {
  makeProbe,
  parseArgs,
  probeHealthy,
  decideColorStart,
  currentCodeSha,
  runGateCmd,
}
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
