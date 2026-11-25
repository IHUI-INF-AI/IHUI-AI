#!/usr/bin/env node
// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/* eslint-disable no-console -- 单行 JSON 落 stdout,告警落 stderr */
/**
 * 账号与凭据面哨兵(2026-11-25 立)。
 *
 * 判据全在 lib/account-drift.mjs(纯函数)。本层做三件事:
 *   ① 采三个面:本地用户(WMI)、管理员组(net localgroup)、SSH 授权公钥(文件+指纹)
 *   ② 与基线对比
 *   ③ 新增即告警
 *
 * 为什么管理员组不走 WMI 的 Win32_GroupUser:
 *   本机实测 GroupComponent 的写法与 __PATH 不一致,按 Name="Administrators" 过滤得 0 条
 *   (总数却是 7)。net localgroup 的输出里成员名是 ASCII、表头与结尾提示是英文,
 *   在 chcp 65001 下可稳定解析,反而更可靠。
 *
 * 为什么 SSH 公钥只存指纹不存原文:
 *   公钥本身就是凭据。台账入仓后每天被谁读到不可控,存前 16 位 sha256 足够比对,
 *   不足以复原一把可用的 key。
 *
 * 基线的纪律:
 *   首次没有基线 ⇒ 判 undetermined,**绝不**自动把当前快照当基线 ——
 *   攻击者若在首次之前就把自己写进去了,自动基线会把它一起"洗白"。落基线要显式 --baseline。
 *
 * 退出码: 0 与基线一致 | 1 有新增 | 2 未判定(无基线或采集失败)
 */
import { execFileSync } from 'node:child_process'
import { createHash } from 'node:crypto'
import { appendFileSync, existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

import {
  judgeAccountDrift,
  remediationForAccount,
  ACCOUNT_STATE,
} from './lib/account-drift.mjs'

const HERE = dirname(fileURLToPath(import.meta.url))
const ROOT = 'D:/IHUI-AI'
const STATE_DIR = join(ROOT, '.ihui-agent', 'state')
const BASELINE = join(STATE_DIR, 'account-baseline.json')
const LEDGER = join(STATE_DIR, 'account-drift.jsonl')
const NOTIFY = join(ROOT, 'apps', 'api', 'scripts', 'notify-deploy-failure.ts')

/** 两处 SSH 授权文件。系统级那份对管理员组全员生效,用户级那份只对本人。 */
export const KEY_FILES = Object.freeze([
  'C:\\ProgramData\\ssh\\administrators_authorized_keys',
  'C:\\Users\\Administrator\\.ssh\\authorized_keys',
])

/**
 * 一次采完三个面。
 * 输出必须是「最后一行是 JSON」—— schtasks/net 之类的工具会往 stdout 掺杂行。
 */
export function collectPs() {
  const parts = [
    'chcp 65001 >$null',
    '$users = @(Get-CimInstance Win32_UserAccount -Filter "LocalAccount=True" | ForEach-Object { "$($_.SID)|$($_.Name)|$($_.Disabled)" } | Sort-Object)',
    '$raw = @(net localgroup administrators 2>&1)',
    '$members = New-Object System.Collections.ArrayList',
    '$in = $false',
    'foreach ($line in $raw) {',
    '  $s = [string]$line',
    '  if ($s -match \'^\\s*Members\\s*$\') { $in = $true; continue }',
    "  if ($s -match '^\\s*---') { continue }",
    /* net.exe 结尾会补一句 "The command completed successfully.",它在成员区之后出现,
       不加这条会被当成一个名叫这串文字的成员。 */
    "  if ($s -match '^(The command completed|Alias name|Comment)') { continue }",
    '  if ($in -and $s.Trim()) { [void]$members.Add($s.Trim()) }',
    '}',
    '$keys = New-Object System.Collections.ArrayList',
    `foreach ($p in @(${KEY_FILES.map((f) => `'${f.replace(/'/g, "''")}'`).join(',')})) {`,
    '  if (Test-Path $p) {',
    "    Get-Content $p | Where-Object { $_ -and $_ -notmatch '^\\s*#' } | ForEach-Object {",
    "      $norm = ($_ -replace '\\s+',' ').Trim()",
    '      $sha = [System.Security.Cryptography.SHA256]::Create().ComputeHash([System.Text.Encoding]::UTF8.GetBytes($norm))',
    "      $fp = (-join ($sha | ForEach-Object { $_.ToString('x2') })).Substring(0,16)",
    '      [void]$keys.Add("$p|$fp")',
    '    }',
    '  }',
    '}',
    "@{ 'local-user' = $users; 'admin-group' = $members.ToArray(); 'ssh-key' = $keys.ToArray() } | ConvertTo-Json -Compress -Depth 4",
  ]
  return parts.join('; ')
}

function collect() {
  const out = execFileSync('powershell.exe', ['-NoProfile', '-NonInteractive', '-Command', collectPs()], {
    cwd: ROOT, encoding: 'utf8', timeout: 90_000, windowsHide: true,
    maxBuffer: 8 << 20, stdio: ['ignore', 'pipe', 'pipe'],
  })
  const last = String(out).trim().split(/\r?\n/).filter(Boolean).pop()
  const parsed = JSON.parse(last)
  /* ConvertTo-Json 对单元素会退化成字符串而不是数组 —— 统一成数组。 */
  for (const id of ['local-user', 'admin-group', 'ssh-key']) {
    if (!Array.isArray(parsed[id])) parsed[id] = parsed[id] == null ? [] : [parsed[id]]
  }
  return parsed
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
    note: '人工确认的账号/凭据面基线。新增即判 breach;要根据现状重设,只能显式 --baseline 并由人核对当次快照。',
    current,
    /* 契约:只保留三面内容,旧字段不随版本漂移 */
    'local-user': current['local-user'],
    'admin-group': current['admin-group'],
    'ssh-key': current['ssh-key'],
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
    `账号与凭据面: ${result.state}`,
    '',
    result.reason,
    '',
    '逐面:',
    ...result.perClass.map((c) => `  [${c.id}] 现有 ${c.total} 条 | 新增 ${c.added.length} | 消失 ${c.removed.length}`),
    '',
    '下一步:',
    ...remediation.map((s) => `  ${s}`),
  ].join('\n')
  try {
    const out = execFileSync(process.execPath,
      [tsx, NOTIFY,
        '--subject', `[IHUI 账号] ${result.state} — ${result.addedAll.length} 条新增`,
        '--message', body,
        '--alert-id', `account-drift-${result.state}-${createHash('sha256').update(result.addedAll.join('|')).digest('hex').slice(0, 8)}`,
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
    const out = {
      state: ACCOUNT_STATE.UNDETERMINED,
      reason: `采集失败: ${String(e?.message || e).split(/\r?\n/)[0]}`,
      totalCurrent: 0, addedAll: [], removedAll: [], perClass: [],
    }
    if (json) console.log(JSON.stringify(out))
    else console.log(`? 未判定 — ${out.reason}`)
    return 2
  }

  if (setBaseline) {
    if (!confirm) {
      console.error('   --baseline 需要同时给 --confirm:基线一旦落错,之后所有新增都会被当成"本来就有"')
      return 2
    }
    writeBaseline(current)
    console.log(`✔ 基线已重建: local-user ${current['local-user'].length} / admin-group ${current['admin-group'].length} / ssh-key ${current['ssh-key'].length}`)
    return 0
  }

  const baseline = readBaseline()
  const result = judgeAccountDrift({ baseline, current })
  const remediation = remediationForAccount(result)

  mkdirSync(STATE_DIR, { recursive: true })
  appendFileSync(LEDGER, `${JSON.stringify({
    at: new Date().toISOString(),
    state: result.state,
    totalCurrent: result.totalCurrent,
    addedAll: result.addedAll,
    removedAll: result.removedAll,
    perClass: result.perClass.map((c) => ({ id: c.id, total: c.total, added: c.added.length, removed: c.removed.length })),
    reason: result.reason,
  })}\n`, 'utf8')

  if (json) {
    console.log(JSON.stringify({
      state: result.state, reason: result.reason,
      totalCurrent: result.totalCurrent,
      addedAll: result.addedAll, removedAll: result.removedAll,
      perClass: result.perClass, remediation,
    }))
  } else {
    console.log(`${result.state === 'ok' ? '✓' : result.state === 'breach' ? '✗' : '?'} ${result.state} — ${result.reason}`)
    for (const c of result.perClass) {
      console.log(`   [${c.id}] 现有 ${String(c.total).padStart(2)} 条  新增 ${c.added.length}  消失 ${c.removed.length}`)
      for (const a of c.added) console.log(`      + ${a}`)
      for (const r of c.removed) console.log(`      - ${r}`)
    }
    for (const s of remediation) console.log(`   → ${s}`)
  }

  if (alert && result.state !== ACCOUNT_STATE.OK) sendAlert(result, remediation)

  if (alert) return 0
  if (result.state === ACCOUNT_STATE.OK) return 0
  if (result.state === ACCOUNT_STATE.BREACH) return 1
  return 2
}

const IS_MAIN = process.argv[1] && process.argv[1].replace(/\\/g, '/').endsWith('account-watch.mjs')
if (IS_MAIN) process.exit(main())
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
