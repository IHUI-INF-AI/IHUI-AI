#!/usr/bin/env node
// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/* eslint-disable no-console -- 单行 JSON 落 stdout,告警落 stderr */
/**
 * 账号锁定 / 失败登录突发哨兵(2026-11-26 立)。
 *
 * 判据全在 lib/account-lockout.mjs(纯函数),本层只做三件事:
 *   ① 用 Get-WinEvent 直读 Security 日志:4740(账号锁定)/ 4625(失败登录),
 *      窗口默认 30 分钟(可 --window-min 覆盖);4688(进程创建)按 ProcessId 兜底补进程名。
 *   ② 交给纯函数按「进程 / 目标用户 / 登录类型」三维聚合点名。
 *   ③ 判、记账、必要时告警。
 *
 * 刻意不写成提交链阻断门(与 check-scheduler-health / check-prod-parity 同一理由):
 *   登录失败是本机运行时事实,存量可能长期存在;设成阻断门只会逼人 --no-verify(§12e/§12f)。
 *   本维只作 autoban 派发链上的告警/哨兵腿,结论记 account-lockout.jsonl。
 *
 * 退出码: 0 正常(空窗或零星未达阈值) | 1 锁定/突发 | 2 未判定(取不到日志)
 * 用法:
 *   node scripts/security/check-account-lockout.mjs            # 人读
 *   node scripts/security/check-account-lockout.mjs --json     # 单行 JSON
 *   node scripts/security/check-account-lockout.mjs --alert   # breach 时发信
 *   node scripts/security/check-account-lockout.mjs --window-min 30
 */
import { execFileSync } from 'node:child_process'
import { appendFileSync, existsSync, mkdirSync, readFileSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

import {
  judgeAccountLockout,
  remediationForLockout,
  enrichProcessByPid,
  parseLockoutThreshold,
  LOCKOUT_STATE,
  LOCKOUT_POLICY,
  DEFAULT_WINDOW_MIN,
} from './lib/account-lockout.mjs'

const HERE = dirname(fileURLToPath(import.meta.url))
const ROOT = join(HERE, '..', '..')
const STATE_DIR = join(ROOT, '.ihui-agent', 'state')
const LEDGER = join(STATE_DIR, 'account-lockout.jsonl')
const NOTIFY = join(ROOT, 'apps', 'api', 'scripts', 'notify-deploy-failure.ts')

/** 显式 stdio:门 193 要求派生进程写清三根管道,不靠继承。 */
function run(file, args, timeoutMs) {
  const r = execFileSync(file, args, {
    cwd: ROOT,
    encoding: 'utf8',
    timeout: timeoutMs,
    windowsHide: true,
    maxBuffer: 64 << 20,
    stdio: ['ignore', 'pipe', 'pipe'],
  })
  return String(r || '')
}

/**
 * 直读 Security 日志。返回 { events, pidMap, fetchError }。
 * fetchError 非空 = 日志取不到(权限/日志关闭/命令失败),交判据落 undetermined;
 * events 为空数组且无 fetchError = 空窗,判 ok,不误报。
 */
function collect(windowMin) {
  /* 4688 兜底只解释当前窗内的进程,独立缩到 30 分钟:主窗拉大做反证/复盘时,
     不让海量进程创建事件把采集拖超时(2026-11-26 实测 10h 窗 4688 致 ETIMEDOUT)。 */
  const enrichMin = Math.min(windowMin, 30)
  const script = [
    'chcp 65001 >$null',
    `$since=(Get-Date).AddMinutes(-${windowMin})`,
    `$sinceEnrich=(Get-Date).AddMinutes(-${enrichMin})`,
    '$events=New-Object System.Collections.ArrayList',
    '$out=@{ pidMap=@{}; error=$null }',
    'try {',
    /* 4688 进程创建:按 ProcessId(hex)兜底映像名。本机若未审核 4688 即为空 map,不影响主判据。 */
    '  $4688=Get-WinEvent -FilterHashtable @{LogName=\'Security\'; Id=4688; StartTime=$sinceEnrich} -ErrorAction SilentlyContinue',
    '  foreach($e in $4688){ try{ $x=[xml]$e.ToXml() } catch { continue }; $d=@{}; foreach($p in $x.Event.EventData.Data){ $d[$p.Name]=$p.\'#text\' }; if($d.ProcessId){ $out.pidMap[$d.ProcessId.ToLower()]=$d.NewProcessName } }',
    '  $ev=Get-WinEvent -FilterHashtable @{LogName=\'Security\'; Id=@(4740,4625); StartTime=$since} -ErrorAction Stop',
    '  foreach($e in $ev){',
    '    try{ $x=[xml]$e.ToXml() } catch { continue }',
    '    $d=@{}; foreach($p in $x.Event.EventData.Data){ $d[$p.Name]=$p.\'#text\' }',
    '    [void]$events.Add([pscustomobject]@{',
    '      kind=[string]$e.Id; ts=$e.TimeCreated.ToString(\'o\');',
    '      targetUser=$d.TargetUserName; processName=$d.ProcessName; processId=$d.ProcessId;',
    '      logonType=$d.LogonType; status=$d.Status; ipAddress=$d.IpAddress; logonProcessName=$d.LogonProcessName',
    '    })',
    '  }',
    '} catch { $out.error=$_.Exception.Message }',
    '$out.events=$events.ToArray()',
    '$out | ConvertTo-Json -Compress -Depth 5',
  ].join('\n')

  let raw
  try {
    raw = run('powershell.exe', ['-NoProfile', '-NonInteractive', '-Command', script], 120_000)
  } catch (e) {
    return { events: null, pidMap: {}, fetchError: String(e?.message || e).split(/\r?\n/)[0] }
  }
  const txt = String(raw || '').trim().split(/\r?\n/).filter(Boolean).pop()
  if (!txt) return { events: null, pidMap: {}, fetchError: 'Get-WinEvent 无输出(日志不可读或被策略关闭)' }
  let parsed
  try {
    parsed = JSON.parse(txt)
  } catch (e) {
    return { events: null, pidMap: {}, fetchError: `输出无法解析为 JSON: ${String(e?.message || e).split(/\r?\n/)[0]}` }
  }
  if (parsed.error) return { events: null, pidMap: {}, fetchError: String(parsed.error) }
  const events = Array.isArray(parsed.events) ? parsed.events : []
  const pidMap = parsed.pidMap && typeof parsed.pidMap === 'object' ? parsed.pidMap : {}
  return { events, pidMap, fetchError: null }
}

function appendLedger(row) {
  mkdirSync(STATE_DIR, { recursive: true })
  appendFileSync(LEDGER, `${JSON.stringify(row)}\n`, 'utf8')
}

/** 复用单一发信出口(与 scheduler-health / account-watch 同一条腿)。 */
function sendAlert(result, remediation) {
  const tsx = join(ROOT, 'apps', 'api', 'node_modules', 'tsx', 'dist', 'cli.mjs')
  if (!existsSync(tsx) || !existsSync(NOTIFY)) {
    console.error('   --alert:tsx 或通知脚本不在位(未判定)')
    return
  }
  const lines = [
    `账号锁定/失败登录哨兵: ${result.state}`,
    '',
    result.reason,
    '',
    '逐组:',
    ...result.groups.map((g) => `  [${g.count}次] ${g.processName} 用户=${g.targetUser} 类型=${g.logonType} ${g.statusLabel}`),
    '',
    '下一步:',
    ...remediation.map((s) => `  ${s}`),
  ]
  const body = lines.join('\n')
  try {
    const out = execFileSync(
      process.execPath,
      [tsx, NOTIFY, '--subject', `[IHUI 账号锁定] ${result.state} — ${result.breaches.length} 组命中`,
        '--message', body,
        '--alert-id', `account-lockout-${result.state}`,
        '--dedupe-hours', '1'],
      { cwd: join(ROOT, 'apps', 'api'), encoding: 'utf8', timeout: 120_000,
        windowsHide: true, maxBuffer: 8 << 20, stdio: ['ignore', 'pipe', 'pipe'] },
    )
    console.error(`   --alert:已投递 ${String(out).trim().split(/\r?\n/).slice(-1)[0] || ''}`)
  } catch (e) {
    console.error(`   --alert:投递失败 ${String(e?.message || e).split(/\r?\n/)[0]}`)
  }
}

/**
 * 导出本机安全策略并读锁定阈值。
 * 走 `secedit`(ASCII inf,无 OEM 码页问题);`net accounts` 只作兜底。
 * 两侧都取不到 ⇒ undetermined(策略未知时 judge 按 ENABLED 保守判,不冒绿)。
 */
function readLockoutPolicy() {
  if (process.platform !== 'win32') {
    return { state: LOCKOUT_POLICY.UNDETERMINED, threshold: null, raw: '' }
  }
  const inf = join(tmpdir(), `ihui-secpol-${process.pid}-${Date.now()}.inf`)
  try {
    run('secedit', ['/export', '/cfg', inf, '/areas', 'SECURITYPOLICY'], 30_000)
    const buf = readFileSync(inf)
    const isUtf16 = buf.length > 1 && buf[0] === 0xff && buf[1] === 0xfe
    const parsed = parseLockoutThreshold(isUtf16 ? buf.toString('utf16le') : buf.toString('latin1'))
    if (parsed.state !== LOCKOUT_POLICY.UNDETERMINED) return parsed
  } catch {
    /* 落到 net accounts 兜底 */
  } finally {
    try {
      rmSync(inf, { force: true })
    } catch {
      /* 临时件清不掉不影响判定 */
    }
  }
  try {
    return parseLockoutThreshold(run('net', ['accounts'], 20_000))
  } catch {
    return { state: LOCKOUT_POLICY.UNDETERMINED, threshold: null, raw: '' }
  }
}

function main(argv = process.argv.slice(2)) {
  const json = argv.includes('--json')
  const alert = argv.includes('--alert')
  const wi = argv.indexOf('--window-min')
  const windowMin = Number(argv[wi + 1]) > 0 ? Number(argv[wi + 1]) : DEFAULT_WINDOW_MIN

  const collected = collect(windowMin)
  const lockoutPolicy = readLockoutPolicy()

  let result
  if (collected.fetchError) {
    result = judgeAccountLockout(
      { events: null, fetchError: collected.fetchError },
      { now: Date.now(), windowMin, lockoutPolicy },
    )
  } else {
    const events = enrichProcessByPid(collected.events, collected.pidMap)
    result = judgeAccountLockout({ events }, { now: Date.now(), windowMin, lockoutPolicy })
  }

  const remediation = remediationForLockout(result)

  appendLedger({
    at: new Date().toISOString(),
    state: result.state,
    windowMin: result.windowMin,
    total4740: result.total4740,
    total4625: result.total4625,
    breaches: result.breaches,
    observations: result.observations,
    policy: result.policy,
    storm: result.storm,
    reason: result.reason,
  })

  if (json) {
    console.log(JSON.stringify({
      state: result.state,
      reason: result.reason,
      windowMin: result.windowMin,
      total4740: result.total4740,
      total4625: result.total4625,
      lockedOut: result.lockedOut,
      groups: result.groups,
      byProcess: result.byProcess,
      byUser: result.byUser,
      byLogonType: result.byLogonType,
      storm: result.storm,
      observations: result.observations,
      policy: result.policy,
      remediation,
    }))
  } else {
    const mark = result.state === 'ok' ? '✓' : result.state === 'breach' ? '✗' : '?'
    console.log(`${mark} ${result.state} — ${result.reason}`)
    const t = result.policy.threshold
    console.log(`   锁定策略: ${result.policy.state}` + (t === null || t === undefined ? '' : `(阈值 ${t})`))
    for (const g of result.groups) {
      console.log(`   [${g.count}次] ${g.processName} 用户=${g.targetUser} 类型=${g.logonType} ${g.statusLabel}`)
    }
    for (const o of result.observations) console.log(`   · ${o}`)
    for (const s of remediation) console.log(`   → ${s}`)
  }

  if (alert && result.state !== LOCKOUT_STATE.OK) sendAlert(result, remediation)

  /* --alert 档退出码恒 0:监控器不替被监控对象承担失败(与 scheduler-health 同一口径)。 */
  if (alert) return 0
  if (result.state === LOCKOUT_STATE.OK) return 0
  if (result.state === LOCKOUT_STATE.BREACH) return 1
  return 2
}

const IS_MAIN = process.argv[1] && process.argv[1].replace(/\\/g, '/').endsWith('check-account-lockout.mjs')
if (IS_MAIN) process.exit(main())
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
