#!/usr/bin/env node
// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

// @ihui-seat S-O69 2026-11-01

/* eslint-disable no-console -- CLI 工具,需 console 输出诊断信息 */
/**
 * check-dev-db-rotation-window.mjs — 本机 dev 库口令轮换的**窗口判定器**(票 O69,2026-11-01)。
 *
 * 立因(与 `scripts/lib/dev-db-rotation-policy.mjs` 那枚**派发决定器**的分工,先说清,免得长成第二把尺):
 *   那枚决定器回答的是「**有未结清欠账**(`dev-db-rotation-pending.json`)且窗口空闲 ⇒ 派生 `--apply`」;
 *   它没有「**距上次轮换超期**」这一维,且一旦判 act 就直接真换。
 *   本器补的正是那一维:**不看有没有欠账,只看"按口径该换了没"** —— 读器物自己的留痕
 *   `.ihui-agent/state/dev-db-credential-rotation.jsonl` 末条 `ts` 算天数;超期 ∧ 8801/8802/8803 全空
 *   ⇒ `due`。所以本器是**提醒/缺口读数**,不是第二个派发器:默认**只报 would-run,绝不 spawn**。
 *
 * 三条硬口径:
 *   ① **永不拦提交**:任何路径 exit 0(含未判定、含 spawn 失败)。挂进 guardian 巡检轮的前提就是
 *      它不能把一次 commit/push 拖成几十秒的停服务窗口(§12e 机器状态判据不进提交链的判据面,
 *      但"读数"可以进,前提是零动作、零等待)。
 *   ② **默认不真换口令**:`due` 只打印 `would run: node scripts/rotate-local-dev-db-password.mjs --apply`;
 *      真要动必须显式 `--trigger` 或 `IHUI_ROTATE_DEV_DB=1`。生产/开发库上"巡检顺手换一次库口令"
 *      是比"没轮换"更坏的失效方向。
 *   ③ **取不到输入 ⇒ 未判定,不给绿灯**(§0.3):留痕不在位/空/坏行、端口探测超时/异常 ⇒ `undetermined`,
 *      仍 exit 0(记录而不拦),但**绝不**把"没看见监听"读成"端口全空"。
 *
 * 端口探测不用 netstat 硬解析(输出格式随 OS/语言变,且要起一个 Windows 原生 exe):
 * 走 `node:net` 的 connect 探活,单口 300ms 上限,三条并行 ⇒ 巡检墙钟 ≈ 300ms 封顶。
 *
 * 用法:
 *   node scripts/check-dev-db-rotation-window.mjs                  # 只判定(默认,永不换口令)
 *   node scripts/check-dev-db-rotation-window.mjs --trigger        # due 时真派生 --apply(风险自担)
 *   node scripts/check-dev-db-rotation-window.mjs --self-test
 *   node scripts/check-dev-db-rotation-window.mjs --ledger <path> --ports 8801,8802 --overdue-days 30
 *
 * 退出码:**恒 0**(本器不是判据门,是巡检读数;`undetermined` 也不拦)。
 */
import { spawnSync } from 'node:child_process'
import { existsSync, readFileSync } from 'node:fs'
import { connect } from 'node:net'
import { dirname, join } from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'

const ROOT = dirname(dirname(fileURLToPath(import.meta.url)))
const SERVICE_PORTS = [8801, 8802, 8803]
const LEDGER_REL = '.ihui-agent/state/dev-db-credential-rotation.jsonl'
const LEDGER = join(ROOT, LEDGER_REL)
const APPLY_REL = 'scripts/rotate-local-dev-db-password.mjs'
const PROBE_TIMEOUT_MS = 300
const PROBE_HOST = '127.0.0.1'

/**
 * 超期天数口径(本仓此前**没有**这个常量:`grep -rn "OVERDUE_DAYS\|overdueDays"` 0 命中 ⇒ 本处是
 * 唯一定义处)。取 30 天:口令轮换的通行口径是季度内一次;留痕老化是 90 天(器物的账本),
 * 两者不冲突 —— 90 天是"记录可以删",30 天是"该换了还没换"。可用环境变量覆盖(机器差时不必改码)。
 */
export const OVERDUE_DAYS = Number(process.env.IHUI_DEV_DB_ROTATION_OVERDUE_DAYS || 30)

/**
 * 探一个口。`busy` = 连上了(有活服务);`free` = 明确被拒(ECONNREFUSED,本机最典型的"没人听");
 * `timeout`/`unknown` = 判不了(防火墙丢包/非 ECONNREFUSED 的错)⇒ 调用方落未判定,不猜成空闲。
 * @returns {Promise<'busy'|'free'|'timeout'|'unknown'>}
 */
export function probePort(port, { host = PROBE_HOST, timeoutMs = PROBE_TIMEOUT_MS } = {}) {
  return new Promise((resolve) => {
    let settled = false
    const sock = connect({ host, port: Number(port) })
    const done = (verdict) => {
      if (settled) return
      settled = true
      try {
        sock.destroy()
      } catch {
        /* socket 已销毁 */
      }
      resolve(verdict)
    }
    sock.setTimeout(timeoutMs)
    sock.once('connect', () => done('busy'))
    sock.once('timeout', () => done('timeout'))
    sock.once('error', (e) => {
      const code = String(e?.code ?? '')
      done(code === 'ECONNREFUSED' ? 'free' : 'unknown')
    })
  })
}

/**
 * 三口并发探活。返回 `{ live, unknown }`:`live` 有监听,`unknown` 判不了。
 * 两条都为空 ⇔ 窗口真空闲 —— 只有这一档才允许落 `due`。
 */
export async function probeWindow({ ports = SERVICE_PORTS, host = PROBE_HOST, timeoutMs = PROBE_TIMEOUT_MS } = {}) {
  const rows = await Promise.all(ports.map(async (p) => [p, await probePort(p, { host, timeoutMs })]))
  return {
    live: rows.filter(([, s]) => s === 'busy').map(([p]) => p),
    unknown: rows.filter(([, s]) => s === 'timeout' || s === 'unknown').map(([p]) => p),
  }
}

/**
 * 读器物留痕末条。字段名取自器物 `--apply` 成功时的 append 形(`ts`/`kind`/`db`/`oldFp`/`newFp`…),
 * 只认 `ts`。坏行**不跳过**:任一非空行解析失败即 `unreadable`(跳着读等于把"账本烂了"洗成"最近一次
 * 是某天" ⇒ 会凭空判出超期并触发轮换)。
 * @returns {{state:'ok'|'absent'|'unreadable', ts?:number, ageDays?:number, entries?:number, why?:string}}
 */
export function readLastRotation(file = LEDGER, nowMs = Date.now()) {
  if (!existsSync(file)) return { state: 'absent', why: `留痕不在位(${LEDGER_REL})⇒ 从未成功轮换,超期不可判` }
  let raw
  try {
    raw = String(readFileSync(file, 'utf8'))
  } catch (e) {
    return { state: 'unreadable', why: `留痕读不动(${String(e?.message ?? e).slice(0, 80)})` }
  }
  const lines = raw.split(/\r?\n/).map((l) => l.trim()).filter((l) => l !== '')
  if (lines.length === 0) return { state: 'unreadable', why: '留痕是空文件(在位但 0 条)' }
  let last = null
  for (let i = 0; i < lines.length; i += 1) {
    try {
      const row = JSON.parse(lines[i])
      if (!row || typeof row !== 'object' || Array.isArray(row)) throw new Error('不是对象行')
      last = row
    } catch (e) {
      return { state: 'unreadable', why: `留痕第 ${i + 1} 行解析不出(${String(e?.message ?? e).slice(0, 60)})` }
    }
  }
  const ts = Date.parse(String(last.ts ?? '').trim())
  if (!Number.isFinite(ts)) return { state: 'unreadable', why: '留痕末条缺合法 ts 字段' }
  return { state: 'ok', ts, ageDays: (nowMs - ts) / 86400000, entries: lines.length }
}

/**
 * 三态判定(纯函数,零 IO)。`skip` / `deferred` / `due`,加 `undetermined`。
 * 判序即安全序:先问"该换了没"(未超期就别管端口);再问"端口判得了吗"(判不了不猜);
 * 最后才问"窗口空不空"。任何一档不确定都往"不触发"走。
 */
export function decideWindow({ ledger, window: win, nowMs = Date.now(), overdueDays = OVERDUE_DAYS } = {}) {
  if (!ledger || ledger.state !== 'ok') {
    return { state: 'undetermined', why: `留痕不可判(${ledger?.why ?? '无留痕读数'})⇒ 不触发` }
  }
  const ageDays = Number.isFinite(ledger.ageDays) ? ledger.ageDays : (nowMs - ledger.ts) / 86400000
  const overdue = ageDays >= overdueDays
  if (!overdue) {
    return {
      state: 'skip',
      ageDays,
      why: `距上次轮换 ${ageDays.toFixed(1)} 天 < 超期线 ${overdueDays} 天 ⇒ 未到期,不探窗口`,
    }
  }
  const unknown = Array.isArray(win?.unknown) ? win.unknown : []
  if (unknown.length > 0) {
    return { state: 'undetermined', ageDays, why: `超期 ${ageDays.toFixed(1)} 天,但端口 ${unknown.join(',')} 探测未判定(不猜成空闲)` }
  }
  const live = Array.isArray(win?.live) ? win.live : []
  const busyPorts = live.length > 0
  if (busyPorts) {
    return {
      state: 'deferred',
      ageDays,
      busyPorts: live,
      why: `超期 ${ageDays.toFixed(1)} 天,但 ${live.join(',')} 有活服务在听 ⇒ 让路(器等自然空闲)`,
    }
  }
  return {
    state: 'due',
    ageDays,
    why: `超期 ${ageDays.toFixed(1)} 天(≥${overdueDays})且 ${SERVICE_PORTS.join('/')} 全空 ⇒ 窗口到`,
  }
}

/**
 * 巡检一轮。**默认零 spawn**:`due` 只打印 `would run: …`。
 * @param {object} o
 * @param {boolean} [o.trigger] 真派发开关(CLI `--trigger` / env `IHUI_ROTATE_DEV_DB=1`)
 */
export async function runWindowCheck({
  root = ROOT,
  ports = SERVICE_PORTS,
  ledgerFile = LEDGER,
  nowMs = Date.now(),
  overdueDays = OVERDUE_DAYS,
  trigger = false,
  probe = probeWindow,
  reader = readLastRotation,
  spawn = null,
  logger = (m) => console.log(m),
} = {}) {
  const win = await probe({ ports })
  const ledger = reader(ledgerFile, nowMs)
  const verdict = decideWindow({ ledger, window: win, nowMs, overdueDays })
  logger(`[dev-db-rotation-window] state=${verdict.state} —— ${verdict.why}`)
  if (verdict.state !== 'due') return { ...verdict, spawned: false, ran: false }

  const script = join(root, APPLY_REL)
  const cmd = `node ${APPLY_REL} --apply`
  if (!trigger) {
    logger(`would run: ${cmd}`)
    logger('（默认只判定不真换口令:要真跑请加 --trigger 或 IHUI_ROTATE_DEV_DB=1;本器永不以 due 为理由自行改库口令）')
    return { ...verdict, spawned: false, ran: false, wouldRun: cmd }
  }
  if (!existsSync(script)) {
    logger(`⚠️ 未判定:--trigger 已给,但器物不在位(${APPLY_REL})⇒ 不派生`)
    return { ...verdict, spawned: false, ran: false, state: 'undetermined' }
  }
  // node 跑 node(不用 shell、不碰原生 exe,避开 Windows spawn 族 EBUSY);stdio inherit 让人看见实时进度。
  const go =
    typeof spawn === 'function'
      ? spawn
      : () =>
          spawnSync(process.execPath, [script, '--apply'], {
            cwd: root,
            stdio: 'inherit',
            windowsHide: true,
            timeout: 5 * 60 * 1000,
          })
  let rc = null
  try {
    const r = go()
    rc = typeof r?.status === 'number' ? r.status : null
  } catch (e) {
    logger(`⚠️ 派生失败(${String(e?.message ?? e).slice(0, 120)})⇒ 不记绿,下一轮重判`)
    return { ...verdict, spawned: true, ran: true, rc: null, state: 'undetermined' }
  }
  logger(
    rc === 0
      ? `✅ 轮换器 --apply 已跑完 rc=0(结清与否以器物自己的留痕与两行验证为准,本器不代它宣布)`
      : `⚠️ 轮换器 --apply rc=${rc === null ? 'null(被杀/起不来)' : rc} ⇒ 未结清;本器仍 exit 0(巡检不拦提交)`,
  )
  return { ...verdict, spawned: true, ran: true, rc }
}

function selfTest() {
  let pass = 0
  let fail = 0
  const ok = (n, c) => {
    if (c) {
      pass += 1
      console.log(`  ✅ ${n}`)
    } else {
      fail += 1
      console.error(`  ❌ ${n}`)
    }
  }
  const now = Date.parse('2026-11-01T00:00:00.000Z')
  const day = 86400000
  const L = (days) => ({ state: 'ok', ts: now - days * day, ageDays: days })
  ok('未超期 ⇒ skip', decideWindow({ ledger: L(3), window: { live: [8801], unknown: [] }, nowMs: now }).state === 'skip')
  ok('超期 + 端口全空 ⇒ due', decideWindow({ ledger: L(40), window: { live: [], unknown: [] }, nowMs: now }).state === 'due')
  ok('超期 + 有活服务 ⇒ deferred 且点名端口', (() => {
    const v = decideWindow({ ledger: L(40), window: { live: [8802], unknown: [] }, nowMs: now })
    return v.state === 'deferred' && v.why.includes('8802')
  })())
  ok('留痕不可判 ⇒ undetermined(不给绿灯)', decideWindow({ ledger: { state: 'unreadable', why: 'x' }, window: { live: [], unknown: [] }, nowMs: now }).state === 'undetermined')
  ok('端口探测未判定 ⇒ undetermined', decideWindow({ ledger: L(40), window: { live: [], unknown: [8803] }, nowMs: now }).state === 'undetermined')
  console.log(`\n自检:pass ${pass} / fail ${fail}`)
  return fail === 0 ? 0 : 1
}

function parseCli(argv) {
  const o = { trigger: false, ledgerFile: LEDGER, ports: SERVICE_PORTS, overdueDays: OVERDUE_DAYS }
  for (let i = 0; i < argv.length; i += 1) {
    const a = argv[i]
    const next = () => String(argv[++i] ?? '')
    if (a === '--trigger') o.trigger = true
    else if (a === '--ledger') o.ledgerFile = next()
    else if (a === '--ports') o.ports = next().split(',').map((s) => Number(s.trim())).filter((n) => Number.isFinite(n))
    else if (a === '--overdue-days') o.overdueDays = Number(next())
    else if (a === '--self-test' || a === '--help' || a === '-h') continue
    else console.log(`⚠️ 忽略未知参数: ${a}`)
  }
  return o
}

const isDirectRun = process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href
if (isDirectRun) {
  const argv = process.argv.slice(2)
  if (argv.includes('--help') || argv.includes('-h')) {
    console.log('node scripts/check-dev-db-rotation-window.mjs [--trigger] [--ledger <path>] [--ports 8801,8802] [--overdue-days 30] | --self-test')
    process.exit(0)
  }
  if (argv.includes('--self-test')) process.exit(selfTest())
  const o = parseCli(argv)
  const trigger = o.trigger || String(process.env.IHUI_ROTATE_DEV_DB ?? '') === '1'
  // 恒 exit 0:连"判器自己崩了"也只留一行 undetermined —— 巡检读数不许把提交链拖红(§12e)。
  runWindowCheck({ ...o, trigger })
    .catch((e) => {
      console.log(`[dev-db-rotation-window] state=undetermined —— 判器自身异常(${String(e?.message ?? e).slice(0, 120)})⇒ 不触发`)
    })
    .finally(() => {
      process.exitCode = 0
    })
}

export const __test__ = {
  probePort,
  probeWindow,
  readLastRotation,
  decideWindow,
  runWindowCheck,
  OVERDUE_DAYS,
}
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
