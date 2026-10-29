// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/* eslint-disable no-console -- CLI 器物:人读行走 stdout/stderr,结论行恒 ASCII */
/**
 * eo-origin-guard-rule.mjs — EdgeOne 回源鉴权头的**规则落器**(2026-10-29 立)
 *
 * 立因:`deploy/win/lib/edge-origin-guard.mjs` 那层守卫要生效,前提是 EdgeOne 真的往回源
 * 请求里加 `X-IHUI-Edge-Secret`。这一步此前只写在 `docs/SECURITY.md` §10.8 里让人去控制台点
 * —— 文档不是器物,换机/重建/换域名时必然漏,而漏的后果是 enforce 后整站 403。
 *
 * 两个模式:
 *   (默认/--check)  只读:报规则在不在、条件是否覆盖全部在线加速域名、密钥是否一致
 *   --apply         落地:不一致则删旧建新(enable);一致则跳过
 *
 * 为什么删旧建新而不是 ModifyL7AccRule:实测 2026-10-29 `ModifyL7AccRule` 只传
 * `{RuleId, RuleName, Status}` 会回 `InternalError`,而 Delete+Create 稳定成功。
 *
 * 密钥解析顺序(值绝不打印):
 *   `IHUI_EDGE_SECRET` env → `IHUI_EO_ENV_FILE`(默认生产 api .env) → 本机 nssm 服务
 *   `IHUI-WEB-ROUTER` 的 AppEnvironmentExtra(Windows 专用)。
 *   三处都取不到 ⇒ exit 2 未判定,绝不建一条空密钥的规则。
 *
 * 条件为什么按域名枚举而不是"全部":EdgeOne 的 `Condition` 不接受空串/`true`
 * (实测 `ErrNilCondition` / `Invalid Matching type: 'true'`),而 `uri.path in ['/']`
 * 只精确匹配根路径(同名缓存规则就只缓存首页)。站点内域名集合是有限集,枚举即全覆盖。
 *
 * 退出码:0 = ok(已就绪/已落地);1 = drift(只读档不一致);2 = unjudged。
 * 结论行 `EO-GUARD-RULE ...` 恒纯 ASCII。
 */
import { existsSync, readFileSync } from 'node:fs'
import { execFileSync } from 'node:child_process'
import { dirname, resolve } from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'
import { resolveCredentials, teoCall } from './repair-eo-origin.mjs'

const HERE = dirname(fileURLToPath(import.meta.url))
const ROOT = resolve(HERE, '..')
export const HEADER_NAME = 'X-IHUI-Edge-Secret'
export const RULE_NAME = 'origin-guard-edge-secret'
const DEFAULT_ZONE = 'aizhs.top'
const DEFAULT_ENV_FILE = 'D:\\DevEnv\\ihui-prod\\apps\\api\\.env'
const ROUTER_SERVICE = 'IHUI-WEB-ROUTER'

/** 从 nssm 服务的 AppEnvironmentExtra 里取一个键(Windows 专用;取不到返回空串)。 */
function readServiceEnv(name) {
  if (process.platform !== 'win32') return ''
  const ps = [
    `$v=(Get-ItemProperty 'HKLM:\\SYSTEM\\CurrentControlSet\\Services\\${ROUTER_SERVICE}\\Parameters' -ErrorAction SilentlyContinue).AppEnvironmentExtra;`,
    `if($v -is [array]){$v -join [char]10}else{$v}`,
  ].join('')
  try {
    const out = execFileSync('pwsh.exe', ['-NoProfile', '-Command', ps], { encoding: 'utf8', windowsHide: true })
    for (const line of out.split(/\r?\n/)) {
      const m = line.match(new RegExp(`^\\s*${name}\\s*=\\s*(.+?)\\s*$`))
      if (m) return m[1]
    }
  } catch { /* 服务不存在或 pwsh 不可用:交给调用方判未判定 */ }
  return ''
}

/** 密钥唯一出口。返回 {secret, source} 或 null;source 只写键名不写值。 */
export function resolveEdgeSecret(env = process.env, envFile = env.IHUI_EO_ENV_FILE || DEFAULT_ENV_FILE) {
  if (env.IHUI_EDGE_SECRET) return { secret: String(env.IHUI_EDGE_SECRET).trim(), source: 'env:IHUI_EDGE_SECRET' }
  if (envFile && existsSync(envFile)) {
    for (const raw of readFileSync(envFile, 'utf8').split(/\r?\n/)) {
      const m = raw.match(/^\s*IHUI_EDGE_SECRET\s*=\s*(.+?)\s*$/)
      if (m) return { secret: m[1].replace(/^["']|["']$/g, ''), source: `${envFile}#IHUI_EDGE_SECRET` }
    }
  }
  const fromService = readServiceEnv('IHUI_EDGE_SECRET')
  if (fromService) return { secret: fromService, source: `service:${ROUTER_SERVICE}` }
  return null
}

/** 条件表达式:站点内所有在线加速域名枚举(有限集,枚举即全覆盖)。 */
export function buildCondition(domains) {
  return `\${http.request.host} in [${domains.map((d) => `'${d}'`).join(', ')}]`
}

/** 现有规则是否已经是我们想要的那一条(条件/动作/密钥三者全等)。 */
export function ruleIsCurrent(rule, domains, secret) {
  const branch = rule?.Branches?.[0]
  if (!branch) return false
  if (branch.Condition !== buildCondition(domains)) return false
  const actions = branch.Actions || []
  if (actions.length !== 1) return false
  const action = actions[0]
  if (action.Name !== 'ModifyRequestHeader') return false
  const headers = action.ModifyRequestHeaderParameters?.HeaderActions || []
  if (headers.length !== 1) return false
  const h = headers[0]
  return h.Action === 'set' && h.Name === HEADER_NAME && h.Value === secret
}

export function machineLine(o) {
  return `EO-GUARD-RULE state=${o.state} rule=${o.ruleId || 'na'} domains=${(o.domains || []).length} apply=${o.apply} reason=${o.reason || 'none'}`
}

export function renderText(o) {
  const tag = { ok: '✅', drift: '❌', applied: '🛠', unjudged: '❓' }[o.state] || '❓'
  const lines = [
    `判定面:EdgeOne 站点 ${o.zoneName} (${o.zoneId || '?'}) 的回源鉴权规则 ${RULE_NAME}`,
    `在线加速域名:${(o.domains || []).join(', ') || '(未取到)'}`,
    `密钥来源:${o.source || '(未取到)'}`,
    `${tag} ${o.state}:${o.reason || 'none'}`,
    machineLine(o),
  ]
  return lines.join('\n')
}

export async function run({
  mode = 'check',
  env = process.env,
  zoneName = String(env.IHUI_EO_ZONE_NAME || '').trim() || DEFAULT_ZONE,
  cred = resolveCredentials(env),
  secretInfo = resolveEdgeSecret(env),
  teo = teoCall,
} = {}) {
  const base = { mode, zoneName, zoneId: null, domains: [], source: null, state: 'unjudged', reason: 'none', apply: mode === 'apply', ruleId: null }
  if (!cred) return { ...base, reason: 'no-tencent-credentials' }
  if (!secretInfo || !secretInfo.secret) return { ...base, reason: 'no-edge-secret' }
  base.source = secretInfo.source

  const zones = await teo(cred, 'DescribeZones', { Limit: 100, Offset: 0 })
  if (!zones.ok) return { ...base, reason: `describe-zones-failed:${zones.error}` }
  const zone = (zones.data.Zones || []).find((z) => String(z.ZoneName || '').toLowerCase() === zoneName.toLowerCase())
  if (!zone) return { ...base, reason: `zone-not-found:${zoneName}` }
  base.zoneId = zone.ZoneId

  const doms = await teo(cred, 'DescribeAccelerationDomains', { ZoneId: zone.ZoneId, Limit: 100, Offset: 0 })
  if (!doms.ok) return { ...base, reason: `describe-domains-failed:${doms.error}` }
  base.domains = (doms.data.AccelerationDomains || [])
    .filter((d) => String(d.DomainStatus || '') !== 'offline')
    .map((d) => String(d.DomainName))
  if (base.domains.length === 0) return { ...base, reason: 'no-acceleration-domain' }

  const list = await teo(cred, 'DescribeL7AccRules', { ZoneId: zone.ZoneId, Limit: 100, Offset: 0 })
  if (!list.ok) return { ...base, reason: `describe-rules-failed:${list.error}` }
  const existing = (list.data.Rules || []).find((r) => r.RuleName === RULE_NAME || String(r.RuleName || '').startsWith(`${RULE_NAME}-`))
  if (existing) base.ruleId = existing.RuleId

  if (existing && existing.Status === 'enable' && ruleIsCurrent(existing, base.domains, secretInfo.secret)) {
    return { ...base, state: 'ok', reason: 'in-sync' }
  }

  if (mode !== 'apply') {
    return { ...base, state: 'drift', reason: existing ? 'rule-stale-or-disabled' : 'rule-missing' }
  }

  if (existing) {
    const del = await teo(cred, 'DeleteL7AccRules', { ZoneId: zone.ZoneId, RuleIds: [existing.RuleId] })
    if (!del.ok) return { ...base, state: 'unjudged', reason: `delete-failed:${del.error}` }
  }

  const created = await teo(cred, 'CreateL7AccRules', {
    ZoneId: zone.ZoneId,
    Rules: [{
      RuleName: RULE_NAME,
      Status: 'enable',
      Branches: [{
        Condition: buildCondition(base.domains),
        Actions: [{
          Name: 'ModifyRequestHeader',
          ModifyRequestHeaderParameters: {
            HeaderActions: [{ Action: 'set', Name: HEADER_NAME, Value: secretInfo.secret }],
          },
        }],
      }],
    }],
  })
  if (!created.ok) return { ...base, state: 'unjudged', reason: `create-failed:${created.error}` }
  base.ruleId = (created.data.RuleIds || [])[0] || null

  const verify = await teo(cred, 'DescribeL7AccRules', { ZoneId: zone.ZoneId, Limit: 100, Offset: 0 })
  if (!verify.ok) return { ...base, state: 'unjudged', reason: `verify-failed:${verify.error}` }
  const now = (verify.data.Rules || []).find((r) => r.RuleId === base.ruleId)
  if (!now || now.Status !== 'enable' || !ruleIsCurrent(now, base.domains, secretInfo.secret)) {
    return { ...base, state: 'unjudged', reason: 'readback-mismatch' }
  }
  return { ...base, state: 'applied', reason: 'created-and-verified' }
}

async function main() {
  const argv = process.argv.slice(2)
  if (argv.includes('--help') || argv.includes('-h')) {
    console.log('用法: node scripts/eo-origin-guard-rule.mjs [--apply] [--json]')
    console.log('按站点在线加速域名落地 EdgeOne「修改 HTTP 回源请求头」规则(幂等)。')
    console.log('退出码: 0=ok/applied 1=drift 2=unjudged')
    return 0
  }
  const mode = argv.includes('--apply') ? 'apply' : 'check'
  const out = await run({ mode })
  if (argv.includes('--json')) console.log(JSON.stringify({ ...out, source: out.source, domains: out.domains }))
  else console.log(renderText(out))
  if (out.state === 'ok' || out.state === 'applied') return 0
  if (out.state === 'drift') return 1
  return 2
}

const isDirectRun = Boolean(process.argv[1]) && import.meta.url === pathToFileURL(process.argv[1]).href
if (isDirectRun) {
  // 用 exitCode 而非 process.exit:强退会在 Windows 上撞 libuv 的 handle-closing 断言
  // (execFileSync 拉 pwsh 后留下未收尾的 handle),那行噪音会被误读成脚本崩溃。
  main().then((code) => { process.exitCode = code }).catch((e) => {
    console.error(`❌ 脚本自身异常(exit 2,不冒充判据结论):${String((e && e.message) || e)}`)
    process.exitCode = 2
  })
}

export const __test__ = { resolveEdgeSecret, buildCondition, ruleIsCurrent, machineLine, renderText, run, readServiceEnv, ROOT }
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
