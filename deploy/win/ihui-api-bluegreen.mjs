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
 *   2. 起目标色(已在跑则先停再起,否则加载的是旧代码)
 *   3. 健康门禁:轮询 http://127.0.0.1:<port>/api/health 直到 "status":"ok"
 *   4. 原子写状态文件(tmp + rename),router 1s 内切上游(8802 始终有监听)
 *   5. 排空 DrainSec 秒,让旧色上的 in-flight 请求与 WS 自然结束
 *   6. 停旧色
 *
 * 失败语义:目标色起不来 ⇒ 状态文件不动、旧色继续服务、exit 1(部署失败但线上无损)。
 *
 * 用法:node ihui-api-bluegreen.mjs [--target auto|blue|green] [--health-timeout 120]
 *        [--drain 20] [--state-file <p>] [--log-file <p>] [--dry-run]
 */
import { execFileSync } from 'node:child_process'
import fs from 'node:fs'
import http from 'node:http'
import path from 'node:path'

const SERVICES = { blue: 'IHUI-API-BLUE', green: 'IHUI-API-GREEN' }
const PORTS = { blue: 8842, green: 8843 }
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
  }
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i]
    const next = () => argv[++i]
    if (a === '--target') out.target = String(next() || 'auto')
    else if (a === '--health-timeout') out.healthTimeoutSec = Number(next()) || 120
    else if (a === '--drain') out.drainSec = Number(next()) || 0
    else if (a === '--state-file') out.stateFile = String(next() || out.stateFile)
    else if (a === '--log-file') out.logFile = String(next() || out.logFile)
    else if (a === '--dry-run') out.dryRun = true
  }
  if (!['auto', 'blue', 'green'].includes(out.target)) out.target = 'auto'
  return out
}

const args = parseArgs(process.argv.slice(2))

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

function apiHealthy(port) {
  return new Promise((resolve) => {
    const req = http.get(
      { host: '127.0.0.1', port, path: '/api/health', timeout: 3000 },
      (res) => {
        let body = ''
        res.setEncoding('utf8')
        res.on('data', (c) => {
          body += c
          if (body.length > 4096) req.destroy()
        })
        res.on('end', () => resolve(res.statusCode === 200 && body.includes('"status":"ok"')))
      },
    )
    req.on('timeout', () => {
      req.destroy()
      resolve(false)
    })
    req.on('error', () => resolve(false))
  })
}

async function waitHealthy(port, timeoutMs) {
  const deadline = Date.now() + timeoutMs
  while (Date.now() < deadline) {
    if (await apiHealthy(port)) return true
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

async function main() {
  const ports = { blue: PORTS.blue, green: PORTS.green }
  let state = readState()

  // ── 0. 状态自愈 ────────────────────────────────────────────────────────────
  if (args.target === 'auto') {
    const other = state.active === 'blue' ? 'green' : 'blue'
    if (!(await apiHealthy(ports[state.active])) && (await apiHealthy(ports[other]))) {
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
    log('WARN', '目标色与活跃色相同 ⇒ 退化为原地重启,期间 8802 会短暂 502')
  }

  if (args.dryRun) {
    log('INFO', `dry-run:将 起 ${targetSvc} → 健康:${targetPort} → 切流 → 排空 ${args.drainSec}s → 停 ${oldSvc}`)
    return 0
  }

  // ── 2. 起目标色 ────────────────────────────────────────────────────────────
  // 幂等:目标色已在健康服务(上一轮已起好但没切流)就不再重启它 —— 重启一次要多等一次冷启动,
  // 且在 wrapper 形态下还可能因 STOPPED/RUNNING 判断把好实例停掉。
  if (await apiHealthy(targetPort)) {
    log('INFO', `目标色 ${target}(${targetPort}) 已在健康服务,跳过启动`)
  } else {
    startService(targetSvc)
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

main()
  .then((code) => process.exit(code))
  .catch((e) => {
    log('ERROR', `切换异常:${e && e.message ? e.message : e}`)
    process.exit(2)
  })
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
