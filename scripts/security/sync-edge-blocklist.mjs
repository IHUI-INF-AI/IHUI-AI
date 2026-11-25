// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

// 边缘层:把本机在册封禁推到 EdgeOne 的 IP 黑白名单(基础访问管控)。
//
// 三条实测事实(踩过,写在这里省下一个人再踩一遍):
//   ① Entity 必须填 '@ZoneLevel@domain' —— www.aizhs.top 的 TemplateConfig.TemplateId
//      正是它,域名级没有独立策略;对域名调 ModifySecurityPolicy 一律 UnsupportedOperation。
//   ② 入参必须包一层 SecurityConfig —— 平铺会报 MissingParameter: SecurityConfig。
//   ③ 只传 IpTableConfig 即可,其它子配置未传项由 EO 沿用历史配置(实测 13 个键一个没丢,
//      WafConfig.Mode 仍 observe)。
//
// 为什么读不到现有规则就拒绝写:IpTableRules 为 null 的语义是"沿用历史配置",此时
// EO 那边真实有哪些规则我们并不知道。合并会把它们整份覆盖掉 —— 那个人的规则就没了。
//
// 用法:
//   node scripts/security/sync-edge-blocklist.mjs            # 默认 dry-run,只报差
//   node scripts/security/sync-edge-blocklist.mjs --apply    # 真写(写前存快照,写后复核)
import { appendFileSync, mkdirSync, writeFileSync } from 'node:fs'
import { dirname } from 'node:path'
import { resolveCredentials, teoCall } from '../repair-eo-origin.mjs'
import { defaultStatePath, infraIps, loadState } from './lib/blocklist.mjs'
import { EDGE_DEFAULT_PER_RULE, SYNC_STATE, buildBatchedRules, diffRules, judgeSync, mergeRules, selectEdgeTargets } from './lib/edge-blocklist.mjs'

const ROOT = 'D:/IHUI-AI'
const ZONE = 'zone-3wda9amx52v0'
const ENTITY = '@ZoneLevel@domain'
const STATE = defaultStatePath(ROOT)
const LEDGER = `${ROOT}/.ihui-agent/state/edge-blocklist-sync.jsonl`
const SNAPSHOT = `${ROOT}/.ihui-agent/state/edge-blocklist-before.json`
const MIN_AGE_MIN = Number(process.env.IHUI_EDGE_SYNC_MIN_AGE_MIN ?? 10)

const cred = resolveCredentials()
const describe = () => teoCall(cred, 'DescribeSecurityPolicy', { ZoneId: ZONE, Entity: ENTITY }, 20000)
const modify = (securityConfig) => teoCall(cred, 'ModifySecurityPolicy', { ZoneId: ZONE, Entity: ENTITY, SecurityConfig: securityConfig }, 20000)
const rulesOf = (resp) => resp?.data?.SecurityConfig?.IpTableConfig?.IpTableRules
const modeOf = (resp) => resp?.data?.SecurityConfig?.WafConfig?.Mode

const apply = process.argv.includes('--apply')

const before = await describe()
if (!before.ok) {
  console.log(JSON.stringify({ state: SYNC_STATE.UNDETERMINED, stage: 'describe', error: before.error }, null, 2))
  process.exit(2)
}
const existing = rulesOf(before)
if (!Array.isArray(existing)) {
  console.log(JSON.stringify({ state: SYNC_STATE.UNDETERMINED, stage: 'describe', reason: 'IpTableRules 不是数组(为 null 即「沿用历史配置」,此刻无法安全合并)', got: existing ?? null }, null, 2))
  process.exit(2)
}

const blocklist = loadState(STATE)
const { targets, skipped } = selectEdgeTargets(blocklist.entries, {
  minAgeMs: MIN_AGE_MIN * 60 * 1000,
  allowlist: blocklist.allowlist,
  infra: infraIps(),
})
const perRule = Number(process.env.IHUI_EDGE_PER_RULE ?? EDGE_DEFAULT_PER_RULE)
const desired = buildBatchedRules(targets, perRule)
const merged = mergeRules(existing, desired)
const diff = diffRules(existing, merged.rules)

const summary = {
  state: diff.added.length || diff.removed.length ? SYNC_STATE.DRIFT : SYNC_STATE.NOOP,
  targets: targets.length,
  blockedInState: Object.keys(blocklist.entries ?? {}).length,
  skipped,
  minAgeMin: MIN_AGE_MIN,
  perRule,
  plannedRules: merged.rules.length,
  foreignRulesKept: merged.foreign.length,
  ourRulesBefore: merged.oursOld.length,
  added: diff.added,
  removed: diff.removed,
  unchanged: diff.unchanged,
  wafMode: modeOf(before) ?? null,
  entity: ENTITY,
}

if (!apply) {
  console.log(JSON.stringify({ ...summary, applied: false, hint: '加 --apply 才真写' }, null, 2))
  process.exit(0)
}

if (!diff.added.length && !diff.removed.length) {
  console.log(JSON.stringify({ ...summary, applied: false, reason: 'no-change' }, null, 2))
  process.exit(0)
}

mkdirSync(dirname(SNAPSHOT), { recursive: true })
writeFileSync(SNAPSHOT, `${JSON.stringify({ at: new Date().toISOString(), entity: ENTITY, zone: ZONE, ipTableRules: existing, wafMode: modeOf(before) ?? null }, null, 2)}\n`, 'utf8')

const write = await modify({ IpTableConfig: { Switch: 'on', IpTableRules: merged.rules } })
if (!write.ok) {
  console.log(JSON.stringify({ state: SYNC_STATE.UNDETERMINED, stage: 'modify', error: write.error, snapshot: SNAPSHOT }, null, 2))
  process.exit(2)
}

const after = await describe()
const afterRules = rulesOf(after)
const readable = after.ok && Array.isArray(afterRules)
const verdict = judgeSync({
  targets,
  existingForeign: merged.foreign,
  actualRules: readable ? afterRules : [],
  wafModeBefore: modeOf(before),
  wafModeAfter: readable ? modeOf(after) : undefined,
})

const ledger = {
  at: new Date().toISOString(),
  entity: ENTITY,
  requestId: write.data?.RequestId ?? null,
  targets: targets.length,
  added: diff.added,
  removed: diff.removed,
  ruleCount: readable ? afterRules.length : null,
  foreignKept: merged.foreign.length,
  wafModeBefore: summary.wafMode,
  wafModeAfter: readable ? (modeOf(after) ?? null) : null,
  readback: readable ? verdict.state : 'unreadable',
  ok: readable && verdict.state === SYNC_STATE.OK,
}

if (!ledger.ok) {
  // 复核不过(或复核读不到)一律回滚到写前规则集 —— 不把一个说不清的状态留在生产安全策略上。
  const rb = await modify({ IpTableConfig: { Switch: 'on', IpTableRules: existing } })
  ledger.rolledBack = rb.ok
  appendFileSync(LEDGER, `${JSON.stringify(ledger)}\n`, 'utf8')
  console.log(JSON.stringify({ state: SYNC_STATE.DRIFT, stage: 'readback', verdict, rolledBack: rb.ok, snapshot: SNAPSHOT, ledger: LEDGER }, null, 2))
  process.exit(readable ? 1 : 2)
}

appendFileSync(LEDGER, `${JSON.stringify(ledger)}\n`, 'utf8')
console.log(JSON.stringify({ ...summary, state: SYNC_STATE.OK, applied: true, ruleCount: afterRules.length, verdict, ledger: LEDGER }, null, 2))
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
