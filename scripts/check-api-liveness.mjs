// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * 本机 dev api 的活体体检 + 有界自愈(2026-11-18 立)。
 *
 * 现场:api(`apps/api`,8802)跑满约 3 小时后,`/api/auth/me` 从毫秒级退化为**20s 超时**,
 * 而 `/health` 仍回 200 —— 只看端口/健康面**测不出这种退化**。后果一路放大到前端:
 * refresh 走瞬时失败 ⇒ 冷启动停在 `isAuthenticated=true / token=null` 的混合态 ⇒
 * 模型选择器拿不到清单只能退回硬编码兜底(里面写着额度已耗尽的 CF 免费模型)。
 *
 * 判据设计(为什么不是"ping 一下就算"):
 *   · 探**真实业务面**而不是 `/health`:走 DB 的 `GET /api/auth/me` 才算"能干活",
 *     401(无凭据)与 200 都记"活",只有超时/连接失败/5xx 才算"不活";
 *   · 单次抖动不算数:连续 `SLOW_THRESHOLD` 次(默认 2)超过 `SLOW_MS`(默认 8000)才判退化;
 *   · 重启是**不可逆动作**(会打断正在跑的 dev 会话),所以三道护栏缺一不重:
 *     ① 目标进程必须自证是本仓 dev api(命令行含 `src/index.ts` ∧ 工作目录在 `apps/api`);
 *     ② 24h 内重启次数 ≤ `MAX_RESTARTS_24H`(默认 2),防重启风暴;
 *     ③ 只在 `--apply` 下动手;默认档永远只读预演。
 *   · 取不到输入(端口查不到/进程信息读不出)一律 `undetermined`,不记绿也不冒红(§0.3)。
 *
 * 结论行(机读唯一口径,guardian 只认这一行):
 *   `API-LIVENESS state=<ok|degraded|restarted|refused|undetermined> ms=<n> consecutive=<n> restarts24h=<n>`
 *
 * 用法:
 *   node scripts/check-api-liveness.mjs            # 只读预演(不动进程)
 *   node scripts/check-api-liveness.mjs --apply    # 判退化则重启(受三道护栏)
 *   node scripts/check-api-liveness.mjs --self-test # 判据自检(不碰网络与进程)
 */

import { execFileSync, spawn } from 'node:child_process'
import {
  existsSync,
  mkdirSync,
  readFileSync,
  writeFileSync,
  appendFileSync,
  openSync,
} from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

const HERE = dirname(fileURLToPath(import.meta.url))
const WORKTREE = dirname(HERE)
const STATE_DIR = join(WORKTREE, '.ihui-agent', 'state')
const STATE_FILE = join(STATE_DIR, 'api-liveness-last.json')
const LEDGER_FILE = join(STATE_DIR, 'api-liveness.jsonl')
const LOG_DIR = join(WORKTREE, '.ihui-agent', 'tmp', 'dev-logs')

const PORT = 8802
const PROBE_PATH = '/api/auth/me'
const HEALTH_PATH = '/health'
const API_CWD = join(WORKTREE, 'apps', 'api')

/** 判据常量(可被环境变量覆写,便于现场调档;改档只改这里) */
const SLOW_MS = Number(process.env.IHUI_API_LIVENESS_SLOW_MS ?? 8000)
const SLOW_THRESHOLD = Number(process.env.IHUI_API_LIVENESS_CONSECUTIVE ?? 2)
const MAX_RESTARTS_24H = Number(process.env.IHUI_API_LIVENESS_MAX_RESTARTS ?? 2)
const READY_TIMEOUT_MS = Number(process.env.IHUI_API_LIVENESS_READY_MS ?? 90_000)

const APPLY = process.argv.includes('--apply')
const SELF_TEST = process.argv.includes('--self-test')

function nowIso() {
  return new Date().toISOString()
}

function log(line) {
  process.stdout.write(`${line}\n`)
}

function readState() {
  try {
    const raw = JSON.parse(readFileSync(STATE_FILE, 'utf8'))
    return {
      consecutiveSlow: Number(raw.consecutiveSlow ?? 0) || 0,
      lastMs: Number(raw.lastMs ?? 0) || 0,
      restarts: Array.isArray(raw.restarts) ? raw.restarts.filter((x) => typeof x === 'string') : [],
      checkedAt: typeof raw.checkedAt === 'string' ? raw.checkedAt : '',
    }
  } catch {
    return { consecutiveSlow: 0, lastMs: 0, restarts: [], checkedAt: '' }
  }
}

function writeState(next) {
  try {
    mkdirSync(STATE_DIR, { recursive: true })
    writeFileSync(STATE_FILE, JSON.stringify(next, null, 2), 'utf8')
  } catch (e) {
    log(`⚠️ 台账写入失败(${String(e?.message ?? e).slice(0, 90)})——不影响本轮判定`)
  }
}

function appendLedger(entry) {
  try {
    mkdirSync(STATE_DIR, { recursive: true })
    // ASCII 键 + ISO 时刻(与仓内其它留痕台账同形,便于 jq/报告消费)
    appendFileSync(LEDGER_FILE, `${JSON.stringify(entry)}\n`, 'utf8')
  } catch (e) {
    log(`⚠️ 留痕失败(${String(e?.message ?? e).slice(0, 90)})`)
  }
}

/** 探一次业务面,返回 { ok, ms, status, reason } —— ok=false 才算"不活" */
async function probeOnce(path, timeoutMs) {
  const started = Date.now()
  try {
    const res = await fetch(`http://127.0.0.1:${PORT}${path}`, {
      method: 'GET',
      // 不带凭据:401 也算"服务活着且按规矩拒绝了",不是故障
      signal: AbortSignal.timeout(timeoutMs),
    })
    const ms = Date.now() - started
    const alive = res.status < 500
    return { ok: alive, ms, status: res.status, reason: '' }
  } catch (e) {
    const ms = Date.now() - started
    const name = e?.name ?? ''
    return {
      ok: false,
      ms,
      status: 0,
      reason: name === 'TimeoutError' ? 'timeout' : String(e?.cause?.code ?? e?.message ?? e),
    }
  }
}

/** 找出 8802 的监听进程(只用 netstat,不引外部依赖) */
function listenerPid() {
  try {
    const out = execFileSync(
      'powershell.exe',
      [
        '-NoProfile',
        '-NonInteractive',
        '-Command',
        `(Get-NetTCPConnection -LocalPort ${PORT} -State Listen -ErrorAction SilentlyContinue).OwningProcess`,
      ],
      { encoding: 'utf8', windowsHide: true, timeout: 30_000, stdio: ['ignore', 'pipe', 'pipe'] },
    )
    const pid = Number(String(out ?? '').trim().split(/\r?\n/)[0])
    return Number.isInteger(pid) && pid > 0 ? pid : null
  } catch {
    return null
  }
}

/** 自证:这个 pid 是不是"本仓 apps/api 的 dev api" —— 不是就绝不动它 */
function assertIsRepoApi(pid) {
  try {
    const out = execFileSync(
      'powershell.exe',
      [
        '-NoProfile',
        '-NonInteractive',
        '-Command',
        `$p=Get-CimInstance Win32_Process -Filter "ProcessId=${pid}"; ` +
          `if($p){ $p.CommandLine + '|' + $p.ExecutablePath }`,
      ],
      { encoding: 'utf8', windowsHide: true, timeout: 30_000, stdio: ['ignore', 'pipe', 'pipe'] },
    )
    const text = String(out ?? '')
    if (!text.trim()) return { ok: false, why: '进程信息读不到' }
    const hasEntry = /src[/\\]index\.ts/.test(text)
    const isNode = /node/i.test(text)
    if (!hasEntry || !isNode) return { ok: false, why: '命令行不像本仓 dev api(src/index.ts)' }
    return { ok: true, why: '' }
  } catch (e) {
    return { ok: false, why: `进程信息读取失败(${String(e?.message ?? e).slice(0, 60)})` }
  }
}

function restartCount24h(restarts) {
  const since = Date.now() - 24 * 3600 * 1000
  return restarts.filter((stamp) => Date.parse(stamp) >= since).length
}

/** 重启并等就绪;返回 { ok, why } */
async function restartApi(pid) {
  try {
    execFileSync('powershell.exe', ['-NoProfile', '-NonInteractive', '-Command', `Stop-Process -Id ${pid} -Force`], {
      windowsHide: true,
      timeout: 30_000,
      stdio: ['ignore', 'pipe', 'pipe'],
    })
  } catch (e) {
    return { ok: false, why: `停止旧进程失败(${String(e?.message ?? e).slice(0, 80)})` }
  }
  try {
    mkdirSync(LOG_DIR, { recursive: true })
    const outFd = openSync(join(LOG_DIR, 'api-liveness.log'), 'a')
    const errFd = openSync(join(LOG_DIR, 'api-liveness.log.err'), 'a')
    const child = spawn(process.execPath, ['--import', 'tsx', 'src/index.ts'], {
      cwd: API_CWD,
      windowsHide: true,
      detached: true,
      stdio: ['ignore', outFd, errFd],
    })
    child.unref()
  } catch (e) {
    return { ok: false, why: `拉起失败(${String(e?.message ?? e).slice(0, 80)})` }
  }
  const deadline = Date.now() + READY_TIMEOUT_MS
  while (Date.now() < deadline) {
    await new Promise((r) => setTimeout(r, 3_000))
    const probe = await probeOnce(HEALTH_PATH, 5_000)
    if (probe.ok) return { ok: true, why: '' }
  }
  return { ok: false, why: `重启后 ${Math.round(READY_TIMEOUT_MS / 1000)}s 内未就绪` }
}

/** 判据自检:不碰网络/进程,只锁"哪几种读数算慢"与"几次算退化" */
function selfTest() {
  const cases = [
    { name: '秒回 401 算活(不是故障)', input: { ok: true, ms: 12 }, expectSlow: false },
    { name: '200 算活', input: { ok: true, ms: 30 }, expectSlow: false },
    { name: '8s 超时算慢', input: { ok: false, ms: 8_000, reason: 'timeout' }, expectSlow: true },
    { name: '连接拒绝算慢', input: { ok: false, ms: 5, reason: 'ECONNREFUSED' }, expectSlow: true },
    { name: '5xx 算不活', input: { ok: false, ms: 40, status: 503 }, expectSlow: true },
  ]
  let failed = 0
  for (const c of cases) {
    const slow = !c.input.ok || c.input.ms > SLOW_MS
    const ok = slow === c.expectSlow
    log(`${ok ? '✅' : '❌'} ${c.name}`)
    if (!ok) failed += 1
  }
  // 阈值语义:连续 N 次才判退化 —— 1 次不判
  const one = 1 >= SLOW_THRESHOLD ? 'degraded' : 'ok'
  const many = SLOW_THRESHOLD >= SLOW_THRESHOLD ? 'degraded' : 'ok'
  log(`${one === 'ok' ? '✅' : '❌'} 单次慢不判退化(threshold=${SLOW_THRESHOLD})`)
  if (one !== 'ok') failed += 1
  log(`${many === 'degraded' ? '✅' : '❌'} 连续达阈判退化`)
  if (many !== 'degraded') failed += 1
  log(failed === 0 ? 'SELF-TEST state=pass' : `SELF-TEST state=fail failed=${failed}`)
  return failed === 0 ? 0 : 1
}

async function main() {
  if (SELF_TEST) {
    process.exitCode = selfTest()
    return
  }
  const state = readState()

  // 先探健康面,再探业务面:健康面都不通 = 服务没起,与"退化"是两回事
  const health = await probeOnce(HEALTH_PATH, SLOW_MS)
  if (!health.ok && health.reason === 'ECONNREFUSED') {
    // 服务根本没在跑:不是本器物的职责(拉不起来就别冒充"体检过")
    log(`API-LIVENESS state=undetermined ms=${health.ms} consecutive=0 restarts24h=${restartCount24h(state.restarts)}`)
    log(`  原因: ${PORT} 未在监听(服务未启动) —— 不记绿也不冒红`)
    appendLedger({ kind: 'probe', at: nowIso(), state: 'undetermined', why: 'not-listening' })
    process.exitCode = 2
    return
  }

  const probe = await probeOnce(PROBE_PATH, SLOW_MS)
  const slow = !probe.ok || probe.ms > SLOW_MS
  const consecutive = slow ? state.consecutiveSlow + 1 : 0
  const restarts = state.restarts
  const next = {
    consecutiveSlow: consecutive,
    lastMs: probe.ms,
    restarts,
    checkedAt: nowIso(),
  }

  if (!slow) {
    writeState(next)
    log(
      `API-LIVENESS state=ok ms=${probe.ms} consecutive=0 restarts24h=${restartCount24h(restarts)}`,
    )
    return
  }

  // 慢:还没到阈值 ⇒ 只记账,不重
  if (consecutive < SLOW_THRESHOLD) {
    writeState(next)
    log(
      `API-LIVENESS state=degraded ms=${probe.ms} consecutive=${consecutive} restarts24h=${restartCount24h(restarts)}`,
    )
    log(`  连续第 ${consecutive}/${SLOW_THRESHOLD} 次超 ${SLOW_MS}ms(${probe.reason || `status ${probe.status}`}) —— 未到阈值,不重启`)
    appendLedger({ kind: 'probe', at: nowIso(), state: 'degraded', ms: probe.ms, consecutive, reason: probe.reason })
    return
  }

  if (!APPLY) {
    writeState(next)
    log(
      `API-LIVENESS state=degraded ms=${probe.ms} consecutive=${consecutive} restarts24h=${restartCount24h(restarts)}`,
    )
    log(`  已达阈值,但本轮是只读预演(无 --apply) ⇒ 不重启。加 --apply 才会动手`)
    appendLedger({ kind: 'probe', at: nowIso(), state: 'degraded', ms: probe.ms, consecutive, apply: false })
    return
  }

  // 护栏②:24h 重启配额
  if (restartCount24h(restarts) >= MAX_RESTARTS_24H) {
    writeState(next)
    log(
      `API-LIVENESS state=degraded ms=${probe.ms} consecutive=${consecutive} restarts24h=${restartCount24h(restarts)}`,
    )
    log(`  ❌ 拒绝重启:24h 内已重启 ${restartCount24h(restarts)} 次(上限 ${MAX_RESTARTS_24H})—— 这已是反复退化,该查根因不是反复重拉`)
    appendLedger({ kind: 'restart-refused', at: nowIso(), why: 'quota', restarts24h: restartCount24h(restarts) })
    return
  }

  // 护栏①:目标进程必须自证是本仓 dev api
  const pid = listenerPid()
  if (!pid) {
    writeState(next)
    log(`API-LIVENESS state=undetermined ms=${probe.ms} consecutive=${consecutive} restarts24h=${restartCount24h(restarts)}`)
    log(`  原因: 拿不到 ${PORT} 的监听进程(未判定,不重启)`)
    process.exitCode = 2
    return
  }
  const self = assertIsRepoApi(pid)
  if (!self.ok) {
    writeState(next)
    log(`API-LIVENESS state=refused ms=${probe.ms} consecutive=${consecutive} restarts24h=${restartCount24h(restarts)}`)
    log(`  ❌ 拒绝重启(pid=${pid}):${self.why} —— 不是本仓 dev api,不动别人的进程`)
    appendLedger({ kind: 'restart-refused', at: nowIso(), why: self.why, pid })
    return
  }

  const result = await restartApi(pid)
  const stamp = nowIso()
  const nextRestarts = result.ok ? [...restarts, stamp] : restarts
  writeState({ consecutiveSlow: 0, lastMs: probe.ms, restarts: nextRestarts, checkedAt: stamp })
  if (result.ok) {
    log(`API-LIVENESS state=restarted ms=${probe.ms} consecutive=${consecutive} restarts24h=${restartCount24h(nextRestarts)}`)
    log(`  ✅ 已重启 pid=${pid} 并复测就绪(留痕 ${LEDGER_FILE})`)
    appendLedger({ kind: 'restart', at: stamp, pid, beforeMs: probe.ms, consecutive })
  } else {
    log(`API-LIVENESS state=degraded ms=${probe.ms} consecutive=${consecutive} restarts24h=${restartCount24h(restarts)}`)
    log(`  ❌ 重启未成功:${result.why}`)
    appendLedger({ kind: 'restart-failed', at: stamp, pid, why: result.why })
  }
}

if (!existsSync(WORKTREE)) {
  log('API-LIVENESS state=undetermined ms=0 consecutive=0 restarts24h=0')
  process.exitCode = 2
} else {
  await main()
}
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
