#!/usr/bin/env node
// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * canary-window-rehearsal — 把「部署后比对 → 档位推进 → 撤灰度/回滚」这条链在**本机**跑成一次
 * 真执行(b24「金丝雀发布」票的观察窗取证器 · 2026-10-29 立)。
 *
 * 为什么需要它(现读事实):载体 IHUI-DEPLOYLOOP 服务在本机不存在(无服务、无 nssm、
 * deploy\win\deploy-loop.log 不在位),观察窗的正规入口 Invoke-CanaryGate 因此从不运行;
 * 于是「灰度分流」与「部署后比对」两格只有代码、没有一次真实输入跑出来的结论。
 *
 * 本文件不复制任何判据(§0.6):策略仍读 scripts/data/canary-policy.json,裁决仍 spawn
 * scripts/canary-verdict.mjs,档位仍 spawn deploy/win/ihui-canary-stage.mjs,分流仍用
 * deploy/win/ihui-canary-split.mjs 的 createSplitServer。它只做三件事:
 *   ① 造一个**真 HTTP 夹具**:stable / canary 两个本机槽位(127.0.0.1:0 临时端口),
 *      可切换 healthy / 500 / 429 三态 —— 采样器打的是真 socket,不是假数据;
 *   ② 把真策略里的**地址**换成本次夹具端口(窗口/阈值/档位/桶口径逐字节不动,并在
 *      summary 里逐项比对回执),派生灰期策略、写契约,全部走真 CLI 真文件;
 *   ③ 三态(pass/fail/unknown)各跑一遍采样 + 判定 + 档位动作 + 分流实测,把结论与
 *      退出码打出来;任一项不符预期 ⇒ exit 1(不给自己发绿)。
 *
 * 边界(不得误读):
 *  - 这里量的是**夹具**,不是生产包。它证明「判定链在真输入下能出结论」,不证明
 *    「某枚构建上线后是好的」—— 后者只有部署机上的观察窗能答(见 --help 末尾)。
 *  - 采样窗口**原样**用策略里的 ticks/gapMs(8 × 5s ⇒ 每轮约 35s,四轮合计约 2~3 分钟),
 *    不为了跑得快把窗口调小(minSamples=5 与 ticks 是判据的一部分)。
 *
 * 用法:
 *   node scripts/canary-window-rehearsal.mjs [--out <dir>] [--keys 400] [--sha <sha>] [--json]
 *   node scripts/canary-window-rehearsal.mjs --help
 */

import http from 'node:http'
import { spawn } from 'node:child_process'
import { mkdirSync, readFileSync, writeFileSync, existsSync } from 'node:fs'
import { dirname, join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

import { createSplitServer, createHealthCache } from '../deploy/win/ihui-canary-split.mjs'
import { loadTrafficPolicy, parseTrafficPercent, selectTrafficLane } from './canary-traffic.mjs'

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..')
const POLICY_FILE = join(ROOT, 'scripts', 'data', 'canary-policy.json')
const VERDICT_CLI = join(ROOT, 'scripts', 'canary-verdict.mjs')
const TRAFFIC_CLI = join(ROOT, 'scripts', 'canary-traffic.mjs')
const STAGE_CLI = join(ROOT, 'deploy', 'win', 'ihui-canary-stage.mjs')

const EXIT_OK = 0
const EXIT_BAD = 1

const BODY = {
  '/': '<!DOCTYPE html><html><body>ihui canary rehearsal fixture</body></html>',
  '/api/health': '{"status":"ok","source":"rehearsal-fixture"}',
  '/health': '{"status":"ok","source":"rehearsal-fixture"}',
}

/** 起一个本机夹具槽位。mode: ok | error(500) | throttle(429)。端口 0 ⇒ 由内核分配。 */
export function startFixture({ mode = 'ok' } = {}) {
  const state = { mode }
  const server = http.createServer((req, res) => {
    if (state.mode === 'error') {
      res.writeHead(500, { 'content-type': 'text/plain' })
      res.end('rehearsal fixture: 500')
      return
    }
    if (state.mode === 'throttle') {
      res.writeHead(429, { 'content-type': 'text/plain' })
      res.end('rehearsal fixture: 429')
      return
    }
    const path = new URL(req.url ?? '/', 'http://127.0.0.1').pathname
    const body = BODY[path]
    if (!body) {
      res.writeHead(404, { 'content-type': 'text/plain' })
      res.end('rehearsal fixture: 404')
      return
    }
    res.writeHead(200, { 'content-type': path === '/' ? 'text/html; charset=utf-8' : 'application/json' })
    res.end(body)
  })
  return new Promise((ok, bad) => {
    server.once('error', bad)
    server.listen(0, '127.0.0.1', () => {
      ok({
        port: server.address().port,
        setMode: (m) => {
          state.mode = m
        },
        close: () => new Promise((r) => server.close(() => r())),
      })
    })
  })
}

const deepEqual = (a, b) => JSON.stringify(a) === JSON.stringify(b)

/**
 * 真策略 ⇒ 演练策略:**只**把端点地址与槽位端口换成本次夹具端口。
 * 窗口/阈值/档位/桶口径必须逐字节相同 —— 换了就不是同一条判据了(这里当场自证,不当口头承诺)。
 */
export function buildRehearsalPolicy(rawText, { stablePort, canaryPort }) {
  const doc = JSON.parse(rawText)
  if (!doc || typeof doc !== 'object') throw new Error('策略不是 JSON 对象')
  const moved = []
  const endpoints = doc.endpoints.map((ep) => {
    const u = new URL(ep.url)
    const next = { ...ep }
    const before = u.toString()
    u.hostname = '127.0.0.1'
    u.port = String(stablePort)
    next.url = u.toString()
    moved.push({ id: ep.id, kind: ep.kind, from: before, to: next.url })
    return next
  })
  const out = {
    ...doc,
    endpoints,
    traffic: {
      ...doc.traffic,
      slots: { stable: { port: stablePort }, canary: { port: canaryPort } },
    },
  }
  const same = {
    window: deepEqual(doc.window, out.window),
    thresholds: deepEqual(doc.thresholds, out.thresholds),
    stages: deepEqual(doc.traffic.stages, out.traffic.stages),
    bucketGranularity: doc.traffic.bucketGranularity === out.traffic.bucketGranularity,
    bucketSalt: doc.traffic.bucketSalt === out.traffic.bucketSalt,
    grayEndpoints: deepEqual(doc.traffic.grayEndpoints, out.traffic.grayEndpoints),
  }
  if (Object.values(same).some((v) => v !== true)) {
    throw new Error(`演练策略改到了判据字段(不得):${JSON.stringify(same)}`)
  }
  return { text: `${JSON.stringify(out, null, 2)}\n`, doc: out, moved, same }
}

/**
 * 跑一条子进程并等它结束。**必须是异步 spawn,不能用 spawnSync**:
 * 夹具 HTTP 服务住在本进程里,spawnSync 会把事件循环整个堵死 ⇒ 子进程的 fetch 永远等不到
 * 响应(2026-10-29 首次跑就死在这:采样 35s 的窗口挂成 240s 超时)。
 * 另:显式 stdio 必需(本机 spawnSync/exec 对原生 exe 会 EBUSY),这里同理不留空管道。
 */
export function runNode(args, { timeoutMs = 240000 } = {}) {
  const env = { ...process.env }
  delete env.NODE_TEST_CONTEXT
  return new Promise((done) => {
    const child = spawn(process.execPath, args, {
      cwd: ROOT,
      windowsHide: true,
      stdio: ['ignore', 'pipe', 'pipe'],
      env,
    })
    let out = ''
    let err = ''
    let killed = false
    const timer = setTimeout(() => {
      killed = true
      try { child.kill() } catch { /* 已退 */ }
    }, timeoutMs)
    child.stdout.on('data', (d) => { out += d })
    child.stderr.on('data', (d) => { err += d })
    child.once('error', (e) => {
      clearTimeout(timer)
      done({ rc: -1, out, err: `${err}${e?.message ?? e}` })
    })
    child.once('close', (code) => {
      clearTimeout(timer)
      done({ rc: killed ? -1 : code, out, err: killed ? `${err}(超时 ${timeoutMs}ms 被终止)` : err })
    })
  })
}

const lastJsonLine = (text) => {
  const lines = String(text ?? '').split(/\r?\n/).filter((l) => l.trim().startsWith('{'))
  if (!lines.length) return null
  try {
    return JSON.parse(lines[lines.length - 1])
  } catch {
    return null
  }
}

/** 走真 CLI 采样(真 fetch 夹具),返回 {rc, out, outFile}。 */
export async function sampleWindow({ policyPath, stage, outFile }) {
  const r = await runNode([VERDICT_CLI, '--sample', '--policy', policyPath, '--stage', stage, '--out', outFile])
  return { ...r, outFile }
}

/** 走真 CLI 判定,同时把决策记进台账(台账行也是真实现写的,本文件不手拼)。 */
export async function decideWindow({ policyPath, candidate, baseline, ledger, sha }) {
  const args = [VERDICT_CLI, '--decide', '--policy', policyPath, '--candidate', candidate, '--json',
    '--record-decision', '--deploy-sha', sha, '--ledger', ledger]
  if (baseline && existsSync(baseline)) args.push('--baseline', baseline)
  const r = await runNode(args)
  return { ...r, payload: lastJsonLine(r.out) }
}

/** 走真 CLI 推进档位(会真写契约文件)。 */
export async function advanceStage({ policyPath, verdict, current, sha, contractPath }) {
  const r = await runNode([STAGE_CLI, '--decide', '--policy', policyPath, '--verdict', verdict, '--current', current,
    '--sha', sha, '--contract', contractPath])
  return { ...r, payload: lastJsonLine(r.out) }
}

/** 派发 N 枚带路由键的请求穿过分流器,按响应头里的车道计数(真进程、真转发)。
 *
 * `stablePortFallback` 是契约缺失/形状坏时的现网回调端口 —— 不传就只剩 503 那条路,
 * 传了才等于把「契约坏 ⇒ 全部回 stable」这条承诺一起量了。
 */
export async function measureSplit({ contractPath, keys = 400, concurrency = 20, healthTtlMs = 1, stablePortFallback = 0 }) {
  const split = createSplitServer({ contractPath, health: createHealthCache({ ttlMs: healthTtlMs }), stablePortFallback })
  await new Promise((ok, bad) => {
    split.once('error', bad)
    split.listen(0, '127.0.0.1', ok)
  })
  const port = split.address().port
  const tally = { total: 0, canary: 0, stable: 0, fallback: 0, other: 0, statuses: {} }
  const send = async (i) => {
    const res = await fetch(`http://127.0.0.1:${port}/`, {
      headers: { 'x-ihui-canary-key': `rehearsal-key-${i}` },
    })
    await res.text()
    const lane = res.headers.get('x-ihui-canary-lane') ?? ''
    tally.total += 1
    tally.statuses[res.status] = (tally.statuses[res.status] ?? 0) + 1
    if (lane === 'canary') tally.canary += 1
    else if (lane === 'stable') tally.stable += 1
    else tally.other += 1
    if (res.headers.get('x-ihui-canary-fallback') === '1') tally.fallback += 1
  }
  try {
    for (let i = 0; i < keys; i += concurrency) {
      const batch = []
      for (let j = i; j < Math.min(i + concurrency, keys); j += 1) batch.push(send(j))
      await Promise.all(batch)
    }
  } finally {
    await new Promise((r) => split.close(() => r()))
  }
  tally.canaryShare = tally.total ? tally.canary / tally.total : 0
  return tally
}

function parseArgs(argv) {
  const out = {}
  for (let i = 0; i < argv.length; i += 1) {
    const a = argv[i]
    if (!a.startsWith('--')) continue
    const key = a.slice(2)
    const eq = key.indexOf('=')
    if (eq >= 0) {
      out[key.slice(0, eq)] = key.slice(eq + 1)
      continue
    }
    const next = argv[i + 1]
    if (next === undefined || next.startsWith('--')) {
      out[key] = true
      continue
    }
    out[key] = next
    i += 1
  }
  return out
}

const USAGE = `用法: node scripts/canary-window-rehearsal.mjs [--out <dir>] [--keys 400] [--sha <sha>] [--json]

把「部署后比对 → 档位推进 → 撤灰度」在本机跑成一次真执行(真 HTTP 夹具 + 真 CLI + 真分流器)。
生产观察窗仍只能在部署机上跑:nssm 服务 IHUI-DEPLOYLOOP 起来后,等一轮部署完成,
看 deploy\\win\\deploy-loop.log 里出现 "CANARY 观察窗开始" 与 "CANARY-VERDICT ..."。`

async function main() {
  const args = parseArgs(process.argv.slice(2))
  if (args.help) {
    console.log(USAGE)
    return EXIT_OK
  }
  const sha = String(args.sha ?? 'rehearsal')
  const keys = Number(args.keys ?? 400)
  const outDir = resolve(String(args.out ?? join(ROOT, '.ihui-agent', 'tmp', `canary-window-${Date.now()}`)))
  mkdirSync(outDir, { recursive: true })

  const checks = []
  const check = (name, ok, detail) => {
    checks.push({ name, ok: Boolean(ok), detail: detail ?? '' })
    console.log(`${ok ? 'ok  ' : 'FAIL'}  ${name}${detail ? ` — ${detail}` : ''}`)
    return Boolean(ok)
  }

  const log = []
  const record = (line) => {
    log.push(line)
    console.log(line)
  }

  const stable = await startFixture({ mode: 'ok' })
  const canary = await startFixture({ mode: 'ok' })
  let summary = null
  try {
    const rawPolicy = readFileSync(POLICY_FILE, 'utf8')
    const built = buildRehearsalPolicy(rawPolicy, { stablePort: stable.port, canaryPort: canary.port })
    const policyPath = join(outDir, 'policy.json')
    writeFileSync(policyPath, built.text, 'utf8')
    record(`REHEARSAL 夹具 stable=127.0.0.1:${stable.port} canary=127.0.0.1:${canary.port} 策略=${policyPath}`)
    check('演练策略只换了地址(窗口/阈值/档位/桶口径逐项相同)', true, JSON.stringify(built.same))

    const ledger = join(outDir, 'deploy-decisions.jsonl')
    const baselineFile = join(outDir, 'baseline.jsonl')

    // ---- 基线:现状(稳定槽位)真采样 ----
    const baseRun = await sampleWindow({ policyPath, stage: 'baseline', outFile: baselineFile })
    check('基线采样 rc=0(真 fetch 夹具)', baseRun.rc === 0, `rc=${baseRun.rc}`)

    // ---- 灰期策略:档位 ⇒ 采样目标改指 canary 槽位(真 CLI 派生,不手改 JSON) ----
    const grayPath = join(outDir, 'gray-policy.json')
    const grayRun = await runNode([TRAFFIC_CLI, '--gray-policy', '--policy', policyPath, '--stage', 'ramp-1', '--out', grayPath])
    check('灰期策略派生 rc=0', grayRun.rc === 0 && existsSync(grayPath), `rc=${grayRun.rc}`)
    const grayDoc = JSON.parse(readFileSync(grayPath, 'utf8'))
    const webEp = grayDoc.endpoints.find((e) => e.id === 'web-origin')
    const apiEp = grayDoc.endpoints.find((e) => e.id === 'api-origin')
    check('灰期策略只把 web-origin 改指 canary 槽位(api 源站不动)',
      webEp.url === `http://127.0.0.1:${canary.port}/` && apiEp.url === `http://127.0.0.1:${stable.port}/api/health`,
      `${webEp.url} / ${apiEp.url}`)

    // ---- 三态各一例:同一枚夹具,只换 canary 槽位的响应形态 ----
    const cases = []
    const runCase = async (name, mode, expect) => {
      canary.setMode(mode)
      record(`CANARY 观察窗开始(源站直探量错误率/P95;采样面=canary;夹具模式=${mode})`)
      const candFile = join(outDir, `candidate-${name}.jsonl`)
      const contractPath = join(outDir, `ramp-${name}.json`)
      const s = await sampleWindow({ policyPath: grayPath, stage: 'candidate', outFile: candFile })
      const d = await decideWindow({ policyPath: grayPath, candidate: candFile, baseline: baselineFile, ledger, sha })
      // rc ⇒ verdict 这个词的映射就是 Invoke-CanaryGate 里那一行(0/3/其它),这里按同一口径喂给档位层。
      const word = d.rc === 0 ? 'pass' : d.rc === 3 ? 'fail' : 'unknown'
      const st = await advanceStage({ policyPath, verdict: word, current: expect.current, sha, contractPath })
      const contract = st.payload?.contract ?? null
      record(`CANARY-VERDICT ${d.payload?.verdict ?? '?'} rc=${d.rc}`)
      record(`GRAY 动作=${st.payload?.action ?? '?'} 新档位=${st.payload?.stage ?? '?'} 比例=${st.payload?.percent ?? '?'}%`)
      const split = await measureSplit({
        contractPath,
        keys,
        stablePortFallback: stable.port,
      })
      check(`用例 ${name}:判定 ${expect.verdict}(exit=${expect.exitCode})`,
        d.payload?.verdict === expect.verdict && d.rc === expect.exitCode,
        `sample rc=${s.rc} verdict=${d.payload?.verdict} exit=${d.rc}`)
      check(`用例 ${name}:档位动作 ${expect.action}`, st.payload?.action === expect.action,
        `action=${st.payload?.action} stage=${st.payload?.stage} percent=${st.payload?.percent}`)
      check(`用例 ${name}:分流实测落在 ${(expect.share[0] * 100).toFixed(0)}%~${(expect.share[1] * 100).toFixed(0)}%`,
        split.canaryShare >= expect.share[0] && split.canaryShare <= expect.share[1],
        `canary=${split.canary}/${split.total} share=${(split.canaryShare * 100).toFixed(1)}% 状态=${JSON.stringify(split.statuses)}`)
      cases.push({
        name,
        fixtureMode: mode,
        sampleRc: s.rc,
        verdict: d.payload?.verdict ?? null,
        exitCode: d.rc,
        reasons: d.payload?.reasons ?? [],
        stageAction: st.payload?.action ?? null,
        stage: st.payload?.stage ?? null,
        percent: st.payload?.percent ?? null,
        contractPercent: contract?.percent ?? readFileSync(contractPath, 'utf8').match(/"percent":\s*(\d+)/)?.[1] ?? null,
        split: { total: split.total, canary: split.canary, share: split.canaryShare, fallback: split.fallback, statuses: split.statuses },
      })
      return split
    }

    await runCase('pass', 'ok', { verdict: 'pass', exitCode: 0, action: 'advance', current: 'ramp-1', share: [0.02, 0.09] })
    const failSplit = await runCase('fail', 'error', { verdict: 'fail', exitCode: 3, action: 'rollback', current: 'ramp-2', share: [0, 0] })

    // unknown:契约必须**原地不动**(hold 不写契约 ⇒ 文件字节与跑之前逐字节相同),
    // 且分流比例仍停在原档 —— 没有证据既不放量也不回滚。
    const unknownContract = join(outDir, 'ramp-unknown.json')
    writeFileSync(unknownContract, readFileSync(join(outDir, 'ramp-pass.json')))
    const beforeUnknown = readFileSync(unknownContract, 'utf8')
    await runCase('unknown', 'throttle', { verdict: 'unknown', exitCode: 2, action: 'hold', current: 'ramp-2', share: [0.02, 0.09] })
    check('unknown ⇒ 契约逐字节不变(不放量、也不回滚)', readFileSync(unknownContract, 'utf8') === beforeUnknown, '同一份契约')
    check('fail ⇒ 契约比例归零,分流器 0 枚走 canary(灰度流量真被撤)',
      failSplit.canary === 0 && failSplit.total === keys, `canary=${failSplit.canary}/${failSplit.total}`)

    // ---- 台账:三态各写一行,action 由唯一构造器给出 ----
    const ledgerLines = existsSync(ledger)
      ? readFileSync(ledger, 'utf8').split(/\r?\n/).filter((l) => l.trim()).map((l) => JSON.parse(l))
      : []
    const actions = ledgerLines.map((l) => l.action)
    check('台账三态 action = canary-pass / canary-rollback / canary-unproven',
      ['canary-pass', 'canary-rollback', 'canary-unproven'].every((a) => actions.includes(a)), actions.join(','))

    // ---- 分流契约面 0 / 50 / 100 + 非法比例 fail-closed(真请求穿过分流器) ----
    const baseContract = JSON.parse(readFileSync(join(outDir, 'ramp-pass.json'), 'utf8'))
    const shareOf = async (percent, label, extra = {}) => {
      const p = join(outDir, `contract-${label}.json`)
      writeFileSync(p, `${JSON.stringify({ ...baseContract, stage: label, percent, ...extra }, null, 2)}\n`, 'utf8')
      const s = await measureSplit({ contractPath: p, keys, stablePortFallback: stable.port })
      return s
    }
    const s0 = await shareOf(0, 'p0')
    const s50 = await shareOf(50, 'p50')
    const s100 = await shareOf(100, 'p100')
    check('契约比例 0% ⇒ 0 枚走 canary', s0.canary === 0 && s0.total === keys, `canary=${s0.canary}/${s0.total}`)
    check('契约比例 100% ⇒ 全部走 canary', s100.canary === keys && s100.total === keys, `canary=${s100.canary}/${s100.total}`)
    check('契约比例 50% ⇒ 实际切流落在 42%~58%(n=' + keys + ')',
      s50.canaryShare >= 0.42 && s50.canaryShare <= 0.58, `share=${(s50.canaryShare * 100).toFixed(1)}%`)

    const badContract = await shareOf('abc', 'p-illegal')
    check('契约比例非法("abc")⇒ 契约判 null ⇒ 200 全部回 stable',
      badContract.canary === 0 && badContract.stable === keys && badContract.statuses['200'] === keys,
      `canary=${badContract.canary}/${badContract.total} 状态=${JSON.stringify(badContract.statuses)}`)
    const overContract = await shareOf(250, 'p-250')
    check('契约比例越界(250)⇒ readContract 拒 ⇒ 全部回 stable(分流器不 clamp)',
      overContract.canary === 0 && overContract.stable === keys,
      `canary=${overContract.canary}/${overContract.total} 状态=${JSON.stringify(overContract.statuses)}`)

    // 灰度实例不在位 ⇒ 命中灰度的流量回落 stable(不打到空端口)
    await canary.close()
    const down = await shareOf(100, 'p-canary-down')
    check('灰度槽位不在位(100% 契约)⇒ 全部回落 stable 且带 fallback 头',
      down.canary === 0 && down.fallback === keys, `canary=${down.canary} fallback=${down.fallback}/${down.total}`)

    // ---- CLI 比例面:0/50/100 与非法值(parseTrafficPercent 的 fail-closed 口径) ----
    const laneOf = async (key, percent) => {
      const r = await runNode([TRAFFIC_CLI, '--resolve', '--policy', policyPath, '--key', key, '--percent', String(percent)])
      const p = lastJsonLine(r.out)
      return { rc: r.rc, lane: p?.lane ?? null, percent: p?.percent ?? null }
    }
    const probeKeys = Array.from({ length: 8 }, (_, i) => `cli-key-${i}`)
    const lanesAt = async (percent) => {
      const out = []
      for (const k of probeKeys) out.push((await laneOf(k, percent)).lane)
      return out
    }
    const l0 = await lanesAt(0)
    const l100 = await lanesAt(100)
    const l50 = await lanesAt(50)
    check('CLI --resolve:0% ⇒ 全 stable', l0.every((x) => x === 'stable'), l0.join(','))
    check('CLI --resolve:100% ⇒ 全 canary', l100.every((x) => x === 'canary'), l100.join(','))
    check('CLI --resolve:50% ⇒ 两车道都有(按桶,不是按次数)', l50.includes('canary') && l50.includes('stable'), l50.join(','))
    const illegal = []
    for (const v of ['abc', '', '-5']) illegal.push({ v, ...(await laneOf('cli-key-0', v)) })
    check('CLI --resolve:非法比例(abc / 空 / 负)⇒ 归 0 ⇒ stable(fail-closed)',
      illegal.every((x) => x.percent === 0 || x.percent === null) && illegal.every((x) => x.lane === 'stable'),
      illegal.map((x) => `${x.v || '空'}→${x.percent}/${x.lane}`).join(' '))
    const over = await laneOf('cli-key-0', 250)
    check('CLI --resolve:越界 250 ⇒ 按文档 clamp 到 100(仅 --resolve 面;契约面走 readContract,拒 ⇒ 0)', over.percent === 100,
      `percent=${over.percent} lane=${over.lane}`)

    // 契约面单一真相源自证:已加载策略的档位/比例与真策略文件一致
    const loaded = loadTrafficPolicy(rawPolicy)
    check('真策略档位表 = ramp-1/ramp-2/ramp-3/ramp-full 且末档 100',
      loaded.stages.map((s) => `${s.id}:${s.percent}`).join(',') === 'ramp-1:1,ramp-2:5,ramp-3:25,ramp-full:100',
      loaded.stages.map((s) => `${s.id}:${s.percent}`).join(','))
    check('桶口径自证:同一 key 两次解析同车道',
      selectTrafficLane('rehearsal-key-1', { percent: 50, granularity: loaded.bucketGranularity, salt: loaded.bucketSalt }).lane ===
        selectTrafficLane('rehearsal-key-1', { percent: 50, granularity: loaded.bucketGranularity, salt: loaded.bucketSalt }).lane, '')
    check('比例解析 fail-closed 口径:非法 ⇒ 0', parseTrafficPercent('abc') === 0 && parseTrafficPercent('') === 0, '')

    const syntheticLog = [
      '# 合成日志:行格式取自 deploy/win/ihui-deploy-loop.ps1 的 Invoke-CanaryGate(本机无该服务,故无真日志)',
      ...log,
      `# 夹具端口 stable=${stable.port} canary=${canary.port}(本次进程内,结束即关)`,
    ].join('\n')
    writeFileSync(join(outDir, 'deploy-loop.synthetic.log'), `${syntheticLog}\n`, 'utf8')

    const failed = checks.filter((c) => !c.ok)
    summary = {
      ok: failed.length === 0,
      outDir,
      sha,
      keys,
      fixture: { stablePort: stable.port, canaryPort: canary.port },
      policySubstitution: built.moved,
      judgementFieldsUnchanged: built.same,
      cases,
      checks: checks.length,
      failed: failed.length,
      failedNames: failed.map((f) => f.name),
    }
    writeFileSync(join(outDir, 'summary.json'), `${JSON.stringify(summary, null, 2)}\n`, 'utf8')
    console.log(`\nREHEARSAL-CHECK ${checks.length - failed.length}/${checks.length} 通过`)
    console.log(`REHEARSAL-OUT ${outDir}`)
    if (args.json) console.log(JSON.stringify(summary))
    return failed.length === 0 ? EXIT_OK : EXIT_BAD
  } finally {
    try { await stable.close() } catch { /* 已关 */ }
    try { await canary.close() } catch { /* 已关 */ }
  }
}

if (process.argv[1] && resolve(process.argv[1]) === resolve(fileURLToPath(import.meta.url))) {
  main().then((code) => {
    process.exitCode = code
  }, (e) => {
    console.error(`REHEARSAL 失败:${e?.stack ?? e}`)
    process.exitCode = EXIT_BAD
  })
}
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
