#!/usr/bin/env node
// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/* eslint-disable no-console -- 单行 JSON 落 stdout,告警落 stderr */
/**
 * 服务与配置面基线哨兵(2026-11-25 立,第十九件)。
 *
 * 判据全在 lib/service-drift.mjs。本层只做采集、比对、告警三件事。
 *
 * 采集纪律(三条都是踩过或差点踩到的):
 *   ① nssm 的 AppEnvironmentExtra 里 **明文躺着 IHUI_EDGE_SECRET 和 IHUI_ADMIN_PASSWORD**。
 *      采集只允许在进程内存里发生,脱敏立刻完成,sanitize 之后的形态才允许进基线/台账/日志。
 *      值本身绝不出现于本文件任何输出路径。
 *   ② nssm 输出实测用 **空行** 分隔键值对(`\n\n`),不是同族旧文档写的 `\r`;parseEnvBlock 三种
 *      分隔都认,单测按实测形态钉住。
 *   ③ 端口面只记 0.0.0.0 且 <49152 —— RPC 动态段每次重启换号,记进基线等于每轮报假警。
 *
 * 基线纪律与账号面一致:首次无基线 ⇒ undetermined,**绝不**自动把当前快照当基线。
 * 但比账号面多一道:CRITICAL_ENV 是**强制期望**,与基线无关 —— 即使基线是被改松之后建的,
 * 只要 IHUI_EDGE_SECRET_MODE / IHUI_WAF_MODE 不是 enforce 就照样判 breach。
 *
 * 退出码: 0 一致 | 1 有新增/变更 | 2 未判定
 */
import { execFileSync } from 'node:child_process'
import { appendFileSync, existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

import {
  judgeServiceDrift,
  remediationForService,
  sanitizeEnv,
  parseEnvBlock,
  partitionListeners,
  SERVICE_STATE,
} from './lib/service-drift.mjs'

const HERE = dirname(fileURLToPath(import.meta.url))
const ROOT = 'D:/IHUI-AI'
const STATE_DIR = join(ROOT, '.ihui-agent', 'state')
const BASELINE = join(STATE_DIR, 'service-baseline.json')
const LEDGER = join(STATE_DIR, 'service-drift.jsonl')
const NOTIFY = join(ROOT, 'apps', 'api', 'scripts', 'notify-deploy-failure.ts')
const NSSM = 'C:\\Windows\\System32\\nssm.exe'

/** 受管服务。新增服务不在此表时不进 env 面(由 host-triage 的 service 面单独盯)。 */
export const SERVICES = Object.freeze(['IHUI-WEB-ROUTER', 'IHUI-API-ROUTER', 'IHUI-GIT-GUARD'])

/** 每个服务上看哪几个策略键。 */
export const START_KEYS = Object.freeze(['Start', 'AppExit Default', 'AppRestartDelay', 'AppThrottle'])

function nssm(args, timeoutMs = 15000) {
  return execFileSync(NSSM, args, {
    cwd: ROOT, encoding: 'utf8', timeout: timeoutMs, windowsHide: true,
    maxBuffer: 4 << 20, stdio: ['ignore', 'pipe', 'pipe'],
  })
}

function collectEnv() {
  const out = {}
  for (const svc of SERVICES) {
    try {
      /* 明文只在这一次调用返回的字符串里,出函数前已 sanitize */
      const pairs = parseEnvBlock(nssm(['get', svc, 'AppEnvironmentExtra']))
      out[svc] = sanitizeEnv(pairs)
    } catch {
      /* 取不到就留空,由「三面都空 ⇒ undetermined」兜住,不猜 */
      out[svc] = {}
    }
  }
  return out
}

function collectStart() {
  const out = {}
  for (const svc of SERVICES) {
    for (const key of START_KEYS) {
      const label = `${svc}|${key}`
      try {
        out[label] = String(nssm(['get', svc, ...key.split(' ')])).trim()
      } catch {
        out[label] = '<unreadable>'
      }
    }
  }
  return out
}

function pidToProc() {
  const ps = 'chcp 65001 >$null; Get-Process | Select-Object Id,ProcessName | ConvertTo-Json -Compress -Depth 2'
  const map = new Map()
  try {
    const out = execFileSync('powershell.exe', ['-NoProfile', '-NonInteractive', '-Command', ps], {
      cwd: ROOT, encoding: 'utf8', timeout: 60_000, windowsHide: true,
      maxBuffer: 8 << 20, stdio: ['ignore', 'pipe', 'pipe'],
    })
    const last = String(out).trim().split(/\r?\n/).filter(Boolean).pop()
    const arr = JSON.parse(last)
    for (const p of (Array.isArray(arr) ? arr : [arr])) map.set(Number(p.Id), p.ProcessName)
  } catch {
    /* 取不到映射不致命:此时所有端口都按 tracked 处理,最多多报一次,不会漏报 */
  }
  return map
}

function collectPorts() {
  const raw = execFileSync('netstat.exe', ['-ano', '-p', 'TCP'], {
    cwd: ROOT, encoding: 'utf8', timeout: 60_000, windowsHide: true,
    maxBuffer: 16 << 20, stdio: ['ignore', 'pipe', 'pipe'],
  })
  const rows = []
  for (const line of String(raw).split(/\r?\n/)) {
    if (!/LISTENING/i.test(line)) continue
    const f = line.trim().split(/\s+/).filter(Boolean)
    if (f.length < 5) continue
    const local = f[1]
    const pid = f[4]
    if (!local) continue
    rows.push({ addr: local, pid: Number(pid) })
  }
  const procs = pidToProc()
  const enriched = rows.map((r) => ({ ...r, proc: procs.get(r.pid) ?? '' }))
  return partitionListeners(enriched)
}

function collect() {
  const ports = collectPorts()
  return {
    'service-env': collectEnv(),
    'service-start': collectStart(),
    'external-port': ports.tracked,
    /* observed 不进基线、不参与判定,只随结果一起给出,让人知道它们在对公网开着 */
    '__observed-ports': ports.observed,
  }
}

function readBaseline() {
  if (!existsSync(BASELINE)) return null
  try {
    return JSON.parse(readFileSync(BASELINE, 'utf8'))
  } catch {
    return null
  }
}

function writeBaseline(current) {
  mkdirSync(STATE_DIR, { recursive: true })
  const doc = {
    version: 1,
    establishedAt: new Date().toISOString(),
    note: '人工确认的服务/配置面基线。凭据类环境变量只存 sha256 前 16 位指纹,值本身不入仓。',
    'service-env': current['service-env'],
    'service-start': current['service-start'],
    'external-port': current['external-port'],
  }
  writeFileSync(BASELINE, `${JSON.stringify(doc, null, 2)}\n`, 'utf8')
}

function sendAlert(result, remediation) {
  const tsx = join(ROOT, 'apps', 'api', 'node_modules', 'tsx', 'dist', 'cli.mjs')
  if (!existsSync(tsx) || !existsSync(NOTIFY)) {
    console.error('   --alert:tsx 或通知脚本不在位(未判定)')
    return
  }
  const body = [
    `服务与配置面: ${result.state}`,
    '',
    result.reason,
    '',
    '逐面:',
    ...result.perClass.map((c) => `  [${c.id}] 现有 ${c.total} 项 | 新增 ${c.added.length} | 消失 ${c.removed.length}`),
    '',
    '下一步:',
    ...remediation.map((s) => `  ${s}`),
  ].join('\n')
  try {
    const out = execFileSync(process.execPath,
      [tsx, NOTIFY,
        '--subject', `[IHUI 配置面] ${result.state} — ${result.addedAll.length} 处新增/变更`,
        '--message', body,
        '--alert-id', `service-drift-${result.state}-${result.addedAll.length}`,
        '--dedupe-hours', '6'],
      { cwd: join(ROOT, 'apps', 'api'), encoding: 'utf8', timeout: 120_000,
        windowsHide: true, maxBuffer: 8 << 20, stdio: ['ignore', 'pipe', 'pipe'] })
    console.error(`   --alert:已投递 ${String(out).trim().split(/\r?\n/).slice(-1)[0] || ''}`)
  } catch (e) {
    console.error(`   --alert:投递失败 ${String(e?.message || e).split(/\r?\n/)[0]}`)
  }
}

function main() {
  const argv = process.argv.slice(2)
  const json = argv.includes('--json')
  const alert = argv.includes('--alert')
  const setBaseline = argv.includes('--baseline')
  const confirm = argv.includes('--confirm')

  let current
  try {
    current = collect()
  } catch (e) {
    const out = { state: SERVICE_STATE.UNDETERMINED, reason: `采集失败: ${String(e?.message || e).split(/\r?\n/)[0]}`, totalCurrent: 0, addedAll: [], removedAll: [], perClass: [] }
    if (json) console.log(JSON.stringify(out))
    else console.log(`? 未判定 — ${out.reason}`)
    return 2
  }

  if (setBaseline) {
    if (!confirm) {
      console.error('   --baseline 需要同时给 --confirm:基线落错,之后所有变更都会被当成"本来就有"')
      return 2
    }
    writeBaseline(current)
    const envCount = Object.values(current['service-env']).reduce((s, o) => s + Object.keys(o).length, 0)
    console.log(`✔ 基线已重建: 服务 ${SERVICES.length} 个 / 环境变量 ${envCount} 项 / 启停策略 ${Object.keys(current['service-start']).length} 项 / 对外端口 ${current['external-port'].length} 个`)
    return 0
  }

  const baseline = readBaseline()
  const result = judgeServiceDrift({ baseline, current })
  const remediation = remediationForService(result)
  const observedPorts = current['__observed-ports'] ?? []

  mkdirSync(STATE_DIR, { recursive: true })
  appendFileSync(LEDGER, `${JSON.stringify({
    at: new Date().toISOString(),
    state: result.state,
    totalCurrent: result.totalCurrent,
    addedAll: result.addedAll,
    removedAll: result.removedAll,
    perClass: result.perClass.map((c) => ({ id: c.id, total: c.total, added: c.added.length, removed: c.removed.length })),
    observedPorts,
    reason: result.reason,
  })}\n`, 'utf8')

  if (json) {
    console.log(JSON.stringify({
      state: result.state, reason: result.reason,
      totalCurrent: result.totalCurrent,
      addedAll: result.addedAll, removedAll: result.removedAll,
      perClass: result.perClass, ports: current['external-port'],
      observedPorts, remediation,
    }))
  } else {
    console.log(`${result.state === 'ok' ? '✓' : result.state === 'breach' ? '✗' : '?'} ${result.state} — ${result.reason}`)
    for (const c of result.perClass) {
      console.log(`   [${c.id}] 现有 ${String(c.total).padStart(2)} 项  新增 ${c.added.length}  消失 ${c.removed.length}`)
      for (const a of c.added) console.log(`      + ${a}`)
      for (const r of c.removed) console.log(`      - ${r}`)
    }
    console.log(`   受管对外端口: ${current['external-port'].join(', ') || '(无)'}`)
    if (observedPorts.length > 0) console.log(`   仅观察(第三方软件,不进基线): ${observedPorts.join(', ')}`)
    for (const s of remediation) console.log(`   → ${s}`)
  }

  if (alert && result.state !== SERVICE_STATE.OK) sendAlert(result, remediation)
  if (alert) return 0
  if (result.state === SERVICE_STATE.OK) return 0
  if (result.state === SERVICE_STATE.BREACH) return 1
  return 2
}

const IS_MAIN = process.argv[1] && process.argv[1].replace(/\\/g, '/').endsWith('check-service-baseline.mjs')
if (IS_MAIN) process.exit(main())
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
