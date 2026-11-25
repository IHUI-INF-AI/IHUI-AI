// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

// 封禁双腿对账哨兵:本机防火墙 vs EdgeOne 边缘名单。
//
// 判据全在 scripts/security/lib/ban-parity.mjs(纯函数),这里只做三件:
//   ① 把两面的"实际"读出来;② 调判据;③ 该报就报(唯一邮件出口)。
//
// 口径不自己算:调用 selectEdgeTargets —— 与 sync-edge-blocklist / autoban 同源,
// 否则这边说"应该封 41",那边实际推了 43,谁也不知道哪份是对的。
//
// 用法:
//   node scripts/security/check-ban-parity.mjs            # 人读
//   node scripts/security/check-ban-parity.mjs --json     # 机读
//   node scripts/security/check-ban-parity.mjs --alert    # 非 ok 时走邮件(独立身份,不占其它告警的去重窗口)
//   node scripts/security/check-ban-parity.mjs --no-edge  # 只对账防火墙这一腿(断网/凭据轮换时用)
import { appendFileSync, existsSync, mkdirSync, writeFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { spawnSync } from 'node:child_process'
import { resolveCredentials, teoCall } from '../repair-eo-origin.mjs'
import { defaultStatePath, infraIps, loadState } from './lib/blocklist.mjs'
import { EDGE_DEFAULT_PER_RULE, selectEdgeTargets } from './lib/edge-blocklist.mjs'
import { BAN_PARITY_STATE, describeParity, ipsOfEdgeRules, judgeBanParity, parseNetshAtkRules } from './lib/ban-parity.mjs'

const ROOT = 'D:/IHUI-AI'
const ZONE = 'zone-3wda9amx52v0'
const ENTITY = '@ZoneLevel@domain'
const STATE = defaultStatePath(ROOT)
const LEDGER = `${ROOT}/.ihui-agent/state/ban-parity.jsonl`
const MIN_AGE_MIN = Number(process.env.IHUI_EDGE_SYNC_MIN_AGE_MIN ?? 10)

const asJson = process.argv.includes('--json')
const wantAlert = process.argv.includes('--alert')
const skipEdge = process.argv.includes('--no-edge')

/** netsh 输出走控制台码页(本机 936):必须 chcp 65001,否则中文表头会被 Node 按 utf8 读成乱码。 */
function readFirewallText() {
  const r = spawnSync('cmd', ['/c', 'chcp 65001 >nul && netsh advfirewall firewall show rule name=all'], {
    encoding: 'utf8',
    timeout: 60000,
    windowsHide: true,
    maxBuffer: 32 * 1024 * 1024,
  })
  if (r.error || r.status !== 0) return { ok: false, error: r.error?.message ?? `netsh exit ${r.status}` }
  return { ok: true, text: r.stdout ?? '' }
}

/** 经唯一邮件出口(§5e,禁止自拼 SMTP)。身份只拼状态 —— 拼条数/时刻会让去重彻底失效(门 224)。 */
function sendParityMail(r) {
  const tsx = join(ROOT, 'apps', 'api', 'node_modules', 'tsx', 'dist', 'cli.mjs')
  const script = join(ROOT, 'apps', 'api', 'scripts', 'notify-deploy-failure.ts')
  if (!existsSync(tsx) || !existsSync(script)) return { ok: false, reason: 'tsx 或通知脚本不在位(未判定)' }

  const msgPath = join(ROOT, '.ihui-agent', 'tmp', 'ban-parity-mail.txt')
  mkdirSync(dirname(msgPath), { recursive: true })
  writeFileSync(msgPath, `${JSON.stringify(r, null, 2)}\n`, 'utf8')

  const res = spawnSync(
    process.execPath,
    [
      tsx,
      script,
      '--title',
      `封禁双腿对账 ${r.state} — ${r.reason}`,
      '--severity',
      r.state === BAN_PARITY_STATE.DRIFT ? 'critical' : 'warning',
      '--source',
      'ihui/ban-parity',
      '--environment',
      'production',
      '--message-file',
      msgPath,
      '--strict',
      '--alert-id',
      `ban-parity-${r.state}`,
      '--dedupe-hours',
      '4',
    ],
    { cwd: ROOT, encoding: 'utf8', timeout: 120_000, windowsHide: true, stdio: ['ignore', 'pipe', 'pipe'], maxBuffer: 1 << 24 },
  )
  return {
    ok: res.status === 0,
    reason: res.status === 0 ? '' : String(res.stderr ?? res.stdout ?? '').trim().split(/\r?\n/).slice(-2).join(' | '),
  }
}

const blocklist = loadState(STATE)
const { targets, skipped } = selectEdgeTargets(blocklist.entries, {
  minAgeMs: MIN_AGE_MIN * 60 * 1000,
  allowlist: blocklist.allowlist,
  infra: infraIps(),
})

const fwRead = readFirewallText()
const fwRules = fwRead.ok ? parseNetshAtkRules(fwRead.text) : []

let edgeIps = null
let edgeReadable = false
let edgeError = null
let edgeRuleCount = null
if (!skipEdge) {
  const cred = resolveCredentials()
  const resp = await teoCall(cred, 'DescribeSecurityPolicy', { ZoneId: ZONE, Entity: ENTITY }, 20000)
  const rules = resp?.data?.SecurityConfig?.IpTableConfig?.IpTableRules
  if (resp.ok && Array.isArray(rules)) {
    edgeIps = ipsOfEdgeRules(rules)
    edgeRuleCount = rules.length
    edgeReadable = true
  } else {
    edgeError = resp.ok ? 'IpTableRules 不是数组(可能为 null = 沿用历史配置)' : resp.error
  }
}

const verdict = judgeBanParity({ want: targets, cooling: skipped.tooFreshIps, fw: fwRules, edge: edgeIps, edgeReadable })
if (!fwRead.ok) verdict.state = BAN_PARITY_STATE.UNDETERMINED

const record = {
  at: new Date().toISOString(),
  state: verdict.state,
  reason: describeParity(verdict),
  want: targets.length,
  cooling: skipped.tooFreshIps.length,
  blockedInState: Object.keys(blocklist.entries ?? {}).length,
  fwRuleCount: fwRules.length,
  fwError: fwRead.ok ? null : fwRead.error,
  edgeRuleCount,
  edgeReadable,
  edgeError,
  skipped,
  minAgeMin: MIN_AGE_MIN,
  missingOnFw: verdict.missingOnFw,
  extraOnFw: verdict.extraOnFw,
  missingOnEdge: verdict.missingOnEdge,
  extraOnEdge: verdict.extraOnEdge,
}

mkdirSync(dirname(LEDGER), { recursive: true })
appendFileSync(LEDGER, `${JSON.stringify(record)}\n`, 'utf8')

// 机器读档一律单行:派发器(autoban)取 stdout 最后一行做 JSON.parse,
// 美化输出会让它拿到 "}" 而恒记 undetermined —— 明明判了 ok 却报未判定,是最坏的那种假。
if (asJson) console.log(JSON.stringify(record))
else {
  const icon = { ok: '✅', drift: '❌', partial: '⚠️', undetermined: '❔' }[record.state] ?? '•'
  console.log(`${icon} ${record.state} · ${record.reason}`)
  console.log(`   在册 ${record.blockedInState} · 该封 ${record.want} · 防火墙规则 ${record.fwRuleCount}${edgeReadable ? ` · 边缘规则 ${record.edgeRuleCount}` : ' · 边缘未判定'}`)
  if (record.extraOnFw.length) console.log(`   防火墙残留(名单已放过,仍封着): ${record.extraOnFw.slice(0, 8).join(', ')}${record.extraOnFw.length > 8 ? ` …共 ${record.extraOnFw.length}` : ''}`)
  if (record.missingOnFw.length) console.log(`   防火墙漏封: ${record.missingOnFw.slice(0, 8).join(', ')}${record.missingOnFw.length > 8 ? ` …共 ${record.missingOnFw.length}` : ''}`)
}

if (wantAlert && record.state !== BAN_PARITY_STATE.OK) {
  // 唯一邮件出口(§5e,禁止自拼 SMTP)。--alert-id 用稳定语义身份:只拼状态,不拼条数与时刻。
  const mail = sendParityMail(record)
  record.alerted = mail.ok
  record.mailReason = mail.ok ? null : mail.reason
  appendFileSync(LEDGER, `${JSON.stringify({ at: new Date().toISOString(), alert: record.state, ok: mail.ok, reason: mail.reason ?? null })}\n`, 'utf8')
  // 走 stderr:stdout 在 --json 档只许留一行 JSON —— 派发器取末行解析,
  // 混一行人读文案进去就会把它打成 undetermined(线上实测过一次)。
  console.error(`   --alert:${mail.ok ? '已投递' : `投递失败(${mail.reason})`}`)
}

process.exit(record.state === BAN_PARITY_STATE.DRIFT ? 1 : record.state === BAN_PARITY_STATE.UNDETERMINED ? 2 : 0)
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
