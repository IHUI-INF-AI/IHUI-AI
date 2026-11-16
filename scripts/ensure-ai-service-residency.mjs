// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * scripts/ensure-ai-service-residency.mjs — 签到常驻腿的幂等执行体(2026-11-16 机主裁决配套)
 *
 * 语义(每 ~30 分钟由计划任务「IHUI AI Service Signin Residency」经隐藏 vbs 调起一次):
 *   1. GET http://127.0.0.1:8803/health ⇒ 在位 ⇒ 零动作退出(不重复拉、不打第二条链);
 *   2. 不在位 ∧ pid 账本进程仍在 ⇒ 判「加载中/无应答但进程活着」⇒ 本轮让位(防把未就绪
 *      的服务顶成双实例撞端口,§12i 并发让位同型失效方向);
 *   3. 不在位 ∧ 无活进程 ⇒ spawn detached uvicorn(venv python -m uvicorn 优先,回落 uv run;
 *      单 worker 硬守卫见 runtime lib)⇒ 写 pid 账本 + 日志一行;
 *   4. 任何取不到输入的情形(运行时选不出来/spawn 失败)⇒ exit 2 显式「未判定」点名原因,
 *      绝不记绿也绝不冒红(§0.3)。
 * env 装配 = 根 .env 打底 ∪ apps/api/.env 覆盖 + 「CHECKIN_CRON_ENABLED 未设置则 true」
 * (run-ai.ps1:59 同一注入语义)。
 *
 * 用法:
 *   node scripts/ensure-ai-service-residency.mjs            # = --ensure
 *   node scripts/ensure-ai-service-residency.mjs --ensure    --quiet
 *   node scripts/ensure-ai-service-residency.mjs --status    # 人读全量读数
 *   node scripts/ensure-ai-service-residency.mjs --stop      # 收自己拉起的那枚(账本+创建时刻双匹配)
 */
// CLI 输出出口(与 check-*/pool 系列同形态:stdout 走 write,告警走 console.error)
import fs from 'node:fs'
import path from 'node:path'
import { spawn, spawnSync } from 'node:child_process'
import { fileURLToPath, pathToFileURL } from 'node:url'
import {
  parseEnvFileText,
  mergeEnvLayers,
  withResidencyDefaults,
  selectRuntimeEntry,
  guardSingleWorker,
  healthProbeUrl,
  serializePidRecord,
  parsePidRecord,
  shouldRotateLog,
  PID_FILE_NAME,
  LOG_FILE_NAME,
} from './lib/ai-service-residency-runtime.mjs'

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')

/** stdout 单出口:仓库惯例不用 console.log(lint no-console 只放行 warn/error/info) */
function out(text) {
  process.stdout.write(String(text) + '\n')
}
const AI_DIR = path.join(ROOT, 'apps', 'ai-service')
const STATE_DIR = path.join(ROOT, '.ihui-agent', 'state')
const PID_FILE = path.join(STATE_DIR, PID_FILE_NAME)
const LOG_FILE = path.join(STATE_DIR, LOG_FILE_NAME)

function logLine(text) {
  try {
    fs.mkdirSync(STATE_DIR, { recursive: true })
    if (shouldRotateLog({ sizeBytes: fs.statSync(LOG_FILE).size })) {
      const tail = fs.readFileSync(LOG_FILE, 'utf8').slice(-512 * 1024)
      fs.writeFileSync(LOG_FILE, `[rotated ${new Date().toISOString()}]\n${tail}`, 'utf8')
    }
    fs.appendFileSync(LOG_FILE, `${new Date().toISOString()} ${text}\n`, 'utf8')
  } catch {
    /* 日志写不进不影响主判据(账本与端口才是真相) */
  }
}

async function probeHealth(timeoutMs = 3000) {
  const url = healthProbeUrl()
  try {
    const resp = await fetch(url, { signal: AbortSignal.timeout(timeoutMs) })
    return resp.ok
  } catch {
    return false
  }
}

/** CIM 取指定 pid 的创建时刻(毫秒);§12 deploy-lock 教训:判活的 pidStart 必须量自被问的那个 pid。 */
function procStartMsOf(pid) {
  const r = spawnSync(
    'powershell.exe',
    [
      '-NoProfile',
      '-NonInteractive',
      '-ExecutionPolicy',
      'Bypass',
      '-Command',
      `$p=Get-CimInstance Win32_Process -Filter 'ProcessId=${pid}'; if ($p) { $p.CreationDate.ToUniversalTime().ToString('o') } else { 'GONE' }`,
    ],
    { windowsHide: true, timeout: 12_000, stdio: ['ignore', 'pipe', 'pipe'], encoding: 'utf8' },
  )
  // spawnSync 没有 .ok 属性(那是自包装 helper 的字段)——判活只看退出码。
  // 教训(2026-11-16 本机实测):r.ok 恒 undefined ⇒ alive 恒 false ⇒ 冷启动窗口会误拉第二实例。
  // culture 坑同批修:CreationDate 直接 ToUniversalTime().ToString('o'),不经 [DateTime]::Parse 的区域格式。
  const text = String(r.stdout ?? '').trim()
  if (r.status !== 0 || !text || text === 'GONE') return null
  const ms = Date.parse(text)
  return Number.isFinite(ms) ? ms : null
}

function readPidRecord() {
  try {
    return parsePidRecord(fs.readFileSync(PID_FILE, 'utf8'))
  } catch {
    return null
  }
}

function pidAlive(rec) {
  if (!rec) return false
  return procStartMsOf(rec.pid) !== null
}

/**
 * 账本自愈:procStart 缺位(早期判活 bug 期间落盘的 '- ' 形)时回测补写。
 * 依据链:pid 与账本一致 ∧ CIM 查到其在位 ⇒ 当前创建时刻即"那枚进程"的创建时刻,可信。
 * 补不上(读不到)⇒ 不动账,让调用侧维持保守判定(失效方向永不变成"放行杀")。
 */
function healPidLedger(rec) {
  if (!rec || rec.procStartMs !== null) return rec
  const now = procStartMsOf(rec.pid)
  if (now === null) return rec
  const fixed = serializePidRecord({ pid: rec.pid, procStartMs: now })
  if (fixed) fs.writeFileSync(PID_FILE, `${fixed}\n`, 'utf8')
  return { pid: rec.pid, procStartMs: now }
}

async function loadChildEnv() {
  const read = (p) => {
    try {
      return parseEnvFileText(fs.readFileSync(p, 'utf8'))
    } catch {
      return {}
    }
  }
  const merged = mergeEnvLayers(
    read(path.join(ROOT, '.env')),
    read(path.join(ROOT, 'apps', 'api', '.env')),
  )
  return withResidencyDefaults({ ...process.env, ...merged })
}

function pickRuntime() {
  const venvDir = path.join(AI_DIR, '.venv')
  const py = path.join(venvDir, 'Scripts', 'python.exe')
  const venvPython = fs.existsSync(py) ? py : null
  let uvicornImportable = false
  if (venvPython) {
    const check = spawnSync(venvPython, ['-c', 'import uvicorn'], {
      windowsHide: true,
      timeout: 30_000,
      stdio: ['ignore', 'pipe', 'pipe'],
      encoding: 'utf8',
    })
    uvicornImportable = check.status === 0
  }
  const uvCandidates = [
    process.env.IHUI_UV_PATH,
    'C:\\Program Files\\Loomy\\resources\\uv\\win32-x64\\uv.exe',
  ].filter((p) => p && fs.existsSync(p))
  return selectRuntimeEntry({ venvPython, uvExe: uvCandidates[0] ?? null, uvicornImportable })
}

async function doEnsure({ quiet }) {
  if (await probeHealth()) {
    healPidLedger(readPidRecord()) // 常态(在位)也要补账,否则 stop 侧永远缺时刻可证
    if (!quiet) out('RESIDENT ok — ai-service 在位,零动作')
    return 0
  }
  const rec = healPidLedger(readPidRecord())
  if (pidAlive(rec)) {
    if (!quiet) out('AWAIT — pid 账本进程仍在(疑加载中),本轮让位,不拉第二实例')
    logLine(`AWAIT pid=${rec.pid}`)
    return 0
  }
  const runtime = pickRuntime()
  if (!runtime || runtime.error) {
    console.error(
      `❌ 未判定:选不出可用运行时(${runtime ? runtime.error : 'venv python(-m uvicorn) 与 uv 均不可用'})——请人工跑一次 pnpm --filter @ihui/ai-service dev`,
    )
    logLine('UNDETERMINED runtime-unavailable')
    return 2
  }
  const g = guardSingleWorker(runtime.args)
  if (!g.ok) {
    console.error(`❌ 单 worker 契约违规:${g.why}`)
    logLine(`REFUSED single-worker:${g.why}`)
    return 2
  }
  fs.mkdirSync(STATE_DIR, { recursive: true })
  const fd = fs.openSync(LOG_FILE, 'a')
  let child
  try {
    child = spawn(runtime.command, runtime.args, {
      cwd: AI_DIR,
      env: await loadChildEnv(),
      detached: true,
      windowsHide: true,
      stdio: ['ignore', fd, fd],
    })
  } finally {
    fs.closeSync(fd)
  }
  if (!child?.pid) {
    console.error('❌ 未判定:spawn 未交回 pid,不记账、下次自检重试')
    logLine('UNDETERMINED spawn-no-pid')
    return 2
  }
  child.unref()
  await new Promise((r) => setTimeout(r, 1200))
  const startMs = procStartMsOf(child.pid)
  const line = serializePidRecord({ pid: child.pid, procStartMs: startMs })
  if (!line) {
    console.error('❌ 未判定:pid 记录形状坏,不落账(宁缺勿错账)')
    logLine(`UNDETERMINED bad-pid-record pid=${child.pid}`)
    return 2
  }
  fs.writeFileSync(PID_FILE, `${line}\n`, 'utf8')
  logLine(
    `RESUMED pid=${child.pid} procStartMatched=${startMs !== null} cmd=${path.basename(runtime.command)}`,
  )
  const up = await probeHealth(4000)
  out(`SPAWNED pid=${child.pid}${up ? ' health=已在位' : ' health=尚在加载(下轮自检判位)'}`)
  return 0
}

async function doStatus() {
  const up = await probeHealth(4000)
  const rec = readPidRecord()
  const alive = pidAlive(rec)
  const runtime = pickRuntime()
  out(`health(${healthProbeUrl()}) = ${up ? 'UP' : 'DOWN'}`)
  out(
    `pid 账本 = ${rec ? `pid=${rec.pid} alive=${alive} procStart记账=${rec.procStartMs !== null}` : '无(从未由本器拉起)'}`,
  )
  out(
    `运行时选择 = ${runtime ? `${runtime.command} [${runtime.args.join(' ')}]` : '无可用运行时 ⇒ 未判定'}`,
  )
  out(
    `log = ${LOG_FILE}${fs.existsSync(LOG_FILE) ? ` (${fs.statSync(LOG_FILE).size}B)` : ' 尚未生成'}`,
  )
  return up || alive ? 0 : runtime ? 1 : 2
}

async function doStop() {
  // 入口先自愈补账(缺 procStart 的旧账在这里补,补不上才回退到拒杀保守档)
  const rec = healPidLedger(readPidRecord())
  if (!rec) {
    out('STOP noop — 无 pid 账本(本器从未拉起,不猜杀)')
    return 0
  }
  const curStart = procStartMsOf(rec.pid)
  if (curStart === null) {
    fs.rmSync(PID_FILE, { force: true })
    out('STOP done — 账本进程已不在')
    return 0
  }
  if (rec.procStartMs === null) {
    console.error(
      `❌ 停止未判定:账本无创建时刻,无法证明 pid ${rec.pid} 还是当年那一枚(§12 pidStart 教训)——请人工核对后处理`,
    )
    return 2
  }
  if (curStart !== rec.procStartMs) {
    console.error(
      `❌ 未判定:pid ${rec.pid} 的创建时刻(${curStart})≠账本(${rec.procStartMs})⇒ pid 已复用,绝不代杀陌生进程`,
    )
    return 2
  }
  try {
    process.kill(rec.pid)
  } catch (e) {
    console.error(`❌ kill 失败:${e instanceof Error ? e.message : String(e)}`)
    return 2
  }
  await new Promise((r) => setTimeout(r, 1500))
  const still = procStartMsOf(rec.pid)
  if (still !== null) {
    console.error(`❌ 未完成:kill 已发且进程仍活(可能 uv 包装层挡住)——账本保留,人工复核`)
    return 2
  }
  fs.rmSync(PID_FILE, { force: true })
  logLine(`STOPPED pid=${rec.pid}`)
  out('STOP done')
  return 0
}

async function main() {
  const argv = process.argv.slice(2)
  const quiet = argv.includes('--quiet')
  if (argv.includes('--status')) return doStatus()
  if (argv.includes('--stop')) return doStop()
  return doEnsure({ quiet })
}

const isDirectRun =
  process.argv[1] && import.meta.url === pathToFileURL(path.resolve(process.argv[1])).href
if (isDirectRun) {
  main().then(
    (code) => process.exit(code),
    (e) => {
      console.error(`❌ ${e?.message ?? e}\n${e?.stack ?? ''}`)
      process.exit(2)
    },
  )
}
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
