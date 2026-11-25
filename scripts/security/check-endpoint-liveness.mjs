#!/usr/bin/env node
// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/* eslint-disable no-console -- 单行 JSON 落 stdout,告警落 stderr */
/**
 * 入口存活探针(2026-11-25 立)。
 *
 * 判据全在 lib/endpoint-liveness.mjs(纯函数),本层只做四件事:
 *   ① 打三个本机端点(WEB 首页 / WEB 内部状态 / API 根)
 *   ② 从台账读上一轮的连续失败次数,交给判据累计
 *   ③ 落一行台账 + 判据结论
 *   ④ 非 ok 时告警;--heal 且连续失败达阈值时才动服务
 *
 * 为什么默认不动服务:
 *   重启生产入口会打断在途请求。第一次上线先只报警,把「连续几次才算真故障」的
 *   实际节律看清楚;要开自愈显式加 --heal,阈值在 lib 的 HEAL_THRESHOLD 里定(默认 2)。
 *
 * 为什么探 8802 的根:
 *   apps/api 有 CSRF 守卫,GET / 未匹配路由返回 404 —— 4xx 恰恰证明它还活着。
 *   若它 5xx 或连不上,才是真异常。
 *
 * 退出码: 0 全应答 | 1 有端点不应答 | 2 判不出
 */
import { existsSync, mkdirSync, appendFileSync, readFileSync } from 'node:fs'
import { request as httpRequest } from 'node:http'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { execFileSync } from 'node:child_process'

import {
  judgeLiveness,
  healActions,
  remediationForLiveness,
  LIVENESS_STATE,
} from './lib/endpoint-liveness.mjs'

const HERE = dirname(fileURLToPath(import.meta.url))
const ROOT = 'D:/IHUI-AI'
const STATE_DIR = join(ROOT, '.ihui-agent', 'state')
const LEDGER = join(STATE_DIR, 'endpoint-liveness.jsonl')
const NOTIFY = join(ROOT, 'apps', 'api', 'scripts', 'notify-deploy-failure.ts')

/** 三个端点。expectStatus 只在「必须精确匹配才算正常」时才写。 */
export const ENDPOINTS = Object.freeze([
  { name: 'web-home', url: 'http://127.0.0.1:8801/', timeoutMs: 8_000 },
  { name: 'web-status', url: 'http://127.0.0.1:8801/__bg/status', timeoutMs: 5_000, expectStatus: 200 },
  { name: 'api-root', url: 'http://127.0.0.1:8802/', timeoutMs: 5_000 },
])

/**
 * 发一次 GET。只取状态码与耗时;失败时把错误码原样带出。
 * 走 node 原生 http 而不是 fetch —— 要拿到 ECONNREFUSED 这类底层错误码,
 * fetch 包装后只剩一句笼统的 "Failed to fetch"。
 */
function probeOne(ep) {
  return new Promise((resolve) => {
    const started = Date.now()
    let settled = false
    const done = (v) => {
      if (settled) return
      settled = true
      resolve({ ...ep, latencyMs: Date.now() - started, ...v })
    }
    try {
      const req = httpRequest(ep.url, { method: 'GET', timeout: ep.timeoutMs }, (res) => {
        res.resume()
        done({ status: res.statusCode, error: null })
      })
      req.on('timeout', () => {
        req.destroy()
        done({ status: null, error: 'ETIMEDOUT' })
      })
      req.on('error', (e) => done({ status: null, error: String(e?.code || e?.message || e) }))
      req.end()
    } catch (e) {
      done({ status: null, error: String(e?.code || e?.message || e) })
    }
  })
}

/** 读台账最后一行的连续失败次数。台账不存在 ⇒ 0。 */
function prevConsecutiveFail() {
  if (!existsSync(LEDGER)) return 0
  try {
    const lines = readFileSync(LEDGER, 'utf8').split(/\r?\n/).filter(Boolean)
    const last = JSON.parse(lines[lines.length - 1])
    return Number.isFinite(Number(last?.consecutiveFail)) ? Number(last.consecutiveFail) : 0
  } catch {
    return 0
  }
}

function sendAlert(result, remediation) {
  const tsx = join(ROOT, 'apps', 'api', 'node_modules', 'tsx', 'dist', 'cli.mjs')
  if (!existsSync(tsx) || !existsSync(NOTIFY)) {
    console.error('   --alert:tsx 或通知脚本不在位(未判定)')
    return
  }
  const body = [
    `入口存活: ${result.state}`,
    '',
    result.reason,
    '',
    '逐条:',
    ...result.rows.map((r) => `  [${r.verdict}] ${r.name} — ${r.reason}`),
    '',
    '下一步:',
    ...remediation.map((s) => `  ${s}`),
  ].join('\n')
  try {
    const out = execFileSync(
      process.execPath,
      [tsx, NOTIFY, '--subject', `[IHUI 入口] ${result.state} — ${result.dead.length} 个端点不应答`,
        '--message', body,
        '--alert-id', `endpoint-liveness-${result.dead.length > 0 ? result.dead.sort().join('+') : result.state}`,
        '--dedupe-hours', '2'],
      { cwd: join(ROOT, 'apps', 'api'), encoding: 'utf8', timeout: 120_000,
        windowsHide: true, maxBuffer: 8 << 20, stdio: ['ignore', 'pipe', 'pipe'] },
    )
    console.error(`   --alert:已投递 ${String(out).trim().split(/\r?\n/).slice(-1)[0] || ''}`)
  } catch (e) {
    console.error(`   --alert:投递失败 ${String(e?.message || e).split(/\r?\n/)[0]}`)
  }
}

/** 只对「连续失败达阈值」的端点动服务;--heal 没给就什么也不做。 */
function healByName(names) {
  const map = { 'web-home': 'IHUI-WEB-ROUTER', 'web-status': 'IHUI-WEB-ROUTER', 'api-root': 'IHUI-API-ROUTER' }
  const svcs = [...new Set(names.map((n) => map[n]).filter(Boolean))]
  const done = []
  for (const svc of svcs) {
    try {
      execFileSync('powershell.exe',
        ['-NoProfile', '-NonInteractive', '-Command', `Stop-Service -Name '${svc}' -Force; Start-Sleep -Seconds 3; Start-Service -Name '${svc}'`],
        { encoding: 'utf8', timeout: 120_000, windowsHide: true, stdio: ['ignore', 'pipe', 'pipe'] })
      done.push(`${svc}: 已重启`)
    } catch (e) {
      done.push(`${svc}: 重启失败 ${String(e?.message || e).split(/\r?\n/)[0]}`)
    }
  }
  return done
}

async function main() {
  const argv = process.argv.slice(2)
  const json = argv.includes('--json')
  const alert = argv.includes('--alert')
  const heal = argv.includes('--heal')

  /* 演练用:I HUI_LIVENESS_EXTRA 可临时追加一个端点,用来证明「连不上真的判死」
     而不是只靠夹具。生产默认不加。 */
  const extra = String(process.env.IHUI_LIVENESS_EXTRA || '').trim()
  const targets = extra
    ? [...ENDPOINTS, { name: 'extra', url: extra, timeoutMs: 5_000, counted: false }]
    : ENDPOINTS

  const probes = await Promise.all(targets.map(probeOne))
  const result = judgeLiveness(probes, { prevConsecutiveFail: prevConsecutiveFail() })
  const remediation = remediationForLiveness(result)

  mkdirSync(STATE_DIR, { recursive: true })
  appendFileSync(LEDGER, `${JSON.stringify({
    at: new Date().toISOString(),
    state: result.state,
    total: result.total,
    dead: result.dead,
    undetermined: result.undetermined,
    consecutiveFail: result.consecutiveFail,
    rows: result.rows.map((r) => ({ name: r.name, verdict: r.verdict, status: r.status, latencyMs: r.latencyMs, reason: r.reason })),
    reason: result.reason,
  })}\n`, 'utf8')

  let healed = []
  if (heal && result.state === LIVENESS_STATE.BREACH) {
    const acts = healActions(result)
    if (acts.length > 0) healed = healByName(acts.map((a) => a.name))
  }

  if (json) {
    console.log(JSON.stringify({
      state: result.state, reason: result.reason, total: result.total,
      dead: result.dead, undetermined: result.undetermined,
      consecutiveFail: result.consecutiveFail,
      rows: result.rows, remediation, healed,
    }))
  } else {
    console.log(`${result.state === 'ok' ? '✓' : result.state === 'breach' ? '✗' : '?'} ${result.state} — ${result.reason}`)
    for (const r of result.rows) console.log(`   [${r.verdict}] ${r.name.padEnd(12)} ${String(r.status ?? '-').padStart(3)} ${String(r.latencyMs ?? '-').padStart(5)}ms  ${r.reason}`)
    for (const s of remediation) console.log(`   → ${s}`)
    for (const h of healed) console.log(`   ⟳ ${h}`)
  }

  if (alert && result.state !== LIVENESS_STATE.OK) sendAlert(result, remediation)

  /* 与调度哨兵同一口径:--alert 档退出码恒 0,不让监控器替被监控者背失败。 */
  if (alert) return 0
  if (result.state === LIVENESS_STATE.OK) return 0
  if (result.state === LIVENESS_STATE.BREACH) return 1
  return 2
}

const IS_MAIN = process.argv[1] && process.argv[1].replace(/\\/g, '/').endsWith('check-endpoint-liveness.mjs')
if (IS_MAIN) main().then((c) => process.exit(c))
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
