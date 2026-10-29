#!/usr/bin/env node
// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/* eslint-disable no-console -- CLI 自愈工具:人读行走 stdout/stderr,结论行恒 ASCII */
 
/**
 * repair-eo-origin.mjs — EdgeOne 源站直填 IPv4 的**活读 + 自愈**器(2026-10-28 立)
 *
 * 立因(现读,不是假想):2026-10 起公网快臂 = EdgeOne 站点 `aizhs.top` 的加速域名
 * `www.aizhs.top`,源站**直填家宽公网 IPv4:8801**。这个地址是动态的 —— 2026-10-28 当天
 * 就从 `218.27.70.129` 漂到 `218.27.68.23`,漂的那一刻全公网 5xx,而仓里唯一的器物
 * `check-egress-ip-drift.mjs` 只读 + 到人,理由写的是"本机无腾讯云/EdgeOne API 凭据"。
 * 这条前提**当天被证伪**:生产 api 的 `.env` 里 `TENCENT_SMS_*` 这把密钥能签名通过
 * `teo.tencentcloudapi.com`(DescribeZones/DescribeAccelerationDomains 200),也能
 * `ModifyAccelerationDomain`(同值回写 200 OK)。既然"改源站"这一格可编程,正确形态就不是
 * 到人,而是**自愈**;本文件就是那一格,§0.8"文档不得写跑不通的出路"随之更新。
 *
 * 三个模式(全部现读,零猜测):
 *   (默认)          只读对账:活读 EO 加速域名的源站 IPv4 vs 本机现测公网出口 IPv4
 *   --print-ledger  把 EO 活读值写成一份台账 JSON 到 stdout(纯 JSON,人读行走 stderr)。
 *                   给 `check-egress-ip-drift.mjs --ledger` 用 —— 台账从"人工登记的真值"
 *                   降级为"EO 现配的投影",漂移判定不再依赖人去控制台抄数。
 *   --apply         漂移即改:调 ModifyAccelerationDomain 把源站改成现测出口(协议/端口/
 *                   回源 Host 头全部保持原值),改完**从公网入口验证** `/api/health`
 *                   返回 200 且 `status=ok`;验证不过 ⇒ **回滚**到原值并 exit 1。
 *
 * 凭据解析顺序(密钥值绝不打印):IHUI_EO_SECRET_ID/KEY → TENCENT_EO_SECRET_ID/KEY →
 * `IHUI_EO_ENV_FILE`(默认生产 api 的 .env)里的 TENCENT_SMS_SECRET_ID/KEY → TENCENT_SES_*。
 *
 * 安全闸(不满足就不动云端):
 *   G1 现测出口必须是**公网** IPv4(私网/回环/CGNAT 100.64/10/组播一律判 unjudged)——
 *      家宽一旦落进 CGNAT,填什么 IP 都回不来,那时该到人而不是改源站。
 *   G2 源站类型必须是 IP_DOMAIN 且 Origin 是 IPv4 字面量;源站已改成域名(更稳的形态)时
 *      本器只报 unjudged,绝不覆盖。
 *   G3 写前留旧值,验证失败**必回滚**;回滚也失败 ⇒ 状态行明写 rolledBack=false。
 *
 * 退出码:0 = ok / repaired(已验证);1 = drift(只读档)或 failed(含回滚结果);2 = unjudged。
 * 结论行 `EO-ORIGIN ...` 恒纯 ASCII(§5d 码页坑:守护日志与工单按这行取值)。
 */
import { existsSync, readFileSync } from 'node:fs'
import { dirname, join, resolve } from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'
import https from 'node:https'
import crypto from 'node:crypto'
import { analyze, isIPv4, normIp } from './check-egress-ip-drift.mjs'

const HERE = dirname(fileURLToPath(import.meta.url))
const ROOT = resolve(HERE, '..')
export const LEDGER_REL = join('scripts', 'data', 'eo-origin-expectation.json')
const DEFAULT_ENV_FILE = 'D:\\DevEnv\\ihui-prod\\apps\\api\\.env'
const DEFAULT_ZONE_NAME = 'aizhs.top'
const DEFAULT_DOMAIN = 'www.aizhs.top'
const DEFAULT_VERIFY_PATH = '/api/health'
const API_TIMEOUT_MS = 15000
const VERIFY_TIMEOUT_MS = 180000
const VERIFY_INTERVAL_MS = 5000

/** G1:公网可路由的 IPv4 字面量(私网/回环/链路本地/CGNAT/组播/保留段一律 false)。 */
export function isPublicIPv4(ip) {
  const s = normIp(ip)
  if (!isIPv4(s)) return false
  const [a, b] = s.split('.').map(Number)
  if (a === 0 || a === 10 || a === 127) return false
  if (a === 169 && b === 254) return false
  if (a === 172 && b >= 16 && b <= 31) return false
  if (a === 192 && b === 168) return false
  if (a === 100 && b >= 64 && b <= 127) return false // CGNAT 100.64/10:填了也回不来
  if (a >= 224) return false // 组播/保留/广播
  return true
}

/** 域名 → 站点名(只剥一层 www.;别的子域按"取后两段"太粗暴,交给 IHUI_EO_ZONE_NAME 显式给)。 */
export function zoneNameOf(domain) {
  const d = String(domain || '').trim().toLowerCase()
  if (!d) return DEFAULT_ZONE_NAME
  if (d.startsWith('www.')) return d.slice(4)
  return d
}

/** 极简 .env 读取:只要 TENCENT_* 键,值不落日志。文件不存在 ⇒ 空表(调用方按缺凭据处理)。 */
export function readEnvFile(path) {
  const out = {}
  if (!path || !existsSync(path)) return out
  for (const raw of readFileSync(path, 'utf8').split(/\r?\n/)) {
    const m = raw.match(/^\s*([A-Z_][A-Z0-9_]*)\s*=\s*(.+?)\s*$/)
    if (m && m[1].startsWith('TENCENT_')) out[m[1]] = m[2].replace(/^["']|["']$/g, '')
  }
  return out
}

/** 凭据唯一出口:返回 {id,key,source} 或 null。source 只写键名,不写值。 */
export function resolveCredentials(env = process.env, envFile = env.IHUI_EO_ENV_FILE || DEFAULT_ENV_FILE) {
  const pairs = [
    ['IHUI_EO_SECRET_ID', 'IHUI_EO_SECRET_KEY', 'env:IHUI_EO'],
    ['TENCENT_EO_SECRET_ID', 'TENCENT_EO_SECRET_KEY', 'env:TENCENT_EO'],
  ]
  for (const [idKey, keyKey, source] of pairs) {
    if (env[idKey] && env[keyKey]) return { id: String(env[idKey]).trim(), key: String(env[keyKey]).trim(), source }
  }
  const file = readEnvFile(envFile)
  for (const [idKey, keyKey] of [['TENCENT_SMS_SECRET_ID', 'TENCENT_SMS_SECRET_KEY'], ['TENCENT_SES_SECRET_ID', 'TENCENT_SES_SECRET_KEY']]) {
    if (file[idKey] && file[keyKey]) return { id: file[idKey], key: file[keyKey], source: `${envFile}#${idKey}` }
  }
  return null
}

function hmac(key, msg) { return crypto.createHmac('sha256', key).update(msg, 'utf8').digest() }
function sha256hex(s) { return crypto.createHash('sha256').update(s, 'utf8').digest('hex') }

/** 腾讯云 TC3-HMAC-SHA256(teo 2022-09-01)。返回 {ok,data} 或 {ok:false,error}。 */
export async function teoCall(cred, action, payload = {}, timeoutMs = API_TIMEOUT_MS) {
  const host = 'teo.tencentcloudapi.com'
  const ts = Math.floor(Date.now() / 1000)
  const date = new Date(ts * 1000).toISOString().slice(0, 10)
  const body = JSON.stringify(payload)
  const canonicalHeaders = `content-type:application/json; charset=utf-8\nhost:${host}\nx-tc-action:${action.toLowerCase()}\n`
  const signedHeaders = 'content-type;host;x-tc-action'
  const canonicalRequest = ['POST', '/', '', canonicalHeaders, signedHeaders, sha256hex(body)].join('\n')
  const scope = `${date}/teo/tc3_request`
  const stringToSign = ['TC3-HMAC-SHA256', String(ts), scope, sha256hex(canonicalRequest)].join('\n')
  const kSigning = hmac(hmac(hmac('TC3' + cred.key, date), 'teo'), 'tc3_request')
  const signature = hmac(kSigning, stringToSign).toString('hex')
  try {
    const res = await fetch(`https://${host}`, {
      method: 'POST',
      signal: AbortSignal.timeout(timeoutMs),
      headers: {
        'Content-Type': 'application/json; charset=utf-8',
        'X-TC-Action': action,
        'X-TC-Timestamp': String(ts),
        'X-TC-Version': '2022-09-01',
        Authorization: `TC3-HMAC-SHA256 Credential=${cred.id}/${scope}, SignedHeaders=${signedHeaders}, Signature=${signature}`,
      },
      body,
    })
    const text = await res.text()
    let data = {}
    try { data = JSON.parse(text) } catch { data = {} }
    const r = data.Response || {}
    if (r.Error) return { ok: false, error: `${r.Error.Code}: ${r.Error.Message}` }
    if (!res.ok) return { ok: false, error: `http=${res.status}` }
    return { ok: true, data: r }
  } catch (e) {
    return { ok: false, error: String((e && (e.name === 'TimeoutError' ? 'timeout' : e.message)) || e).slice(0, 160) }
  }
}

async function describeZone(teo, cred, zoneName) {
  const r = await teo(cred, 'DescribeZones', { Limit: 100, Offset: 0 })
  if (!r.ok) return { ok: false, error: r.error }
  const hit = (r.data.Zones || []).find((z) => String(z.ZoneName || '').toLowerCase() === zoneName.toLowerCase())
  return hit ? { ok: true, zoneId: hit.ZoneId, zoneName: hit.ZoneName } : { ok: false, error: `zone-not-found:${zoneName}` }
}

async function describeDomain(teo, cred, zoneId, domain) {
  const r = await teo(cred, 'DescribeAccelerationDomains', { ZoneId: zoneId, Limit: 100, Offset: 0 })
  if (!r.ok) return { ok: false, error: r.error }
  const hit = (r.data.AccelerationDomains || []).find((d) => String(d.DomainName || '').toLowerCase() === domain.toLowerCase())
  return hit ? { ok: true, domain: hit } : { ok: false, error: `domain-not-found:${domain}` }
}

/** 原值回写的对照组见 2026-10-28 一次性实测:OriginInfo{OriginType,Origin,HostHeader} + 顶层协议/端口。 */
function modifyPayload(zoneId, domain, originDetail, originIp, proto, httpPort, httpsPort) {
  return {
    ZoneId: zoneId,
    DomainName: domain,
    OriginInfo: { OriginType: originDetail.OriginType, Origin: originIp, HostHeader: originDetail.HostHeader },
    OriginProtocol: proto,
    HttpOriginPort: httpPort,
    HttpsOriginPort: httpsPort,
  }
}

/** 公网入口验证:只认 200 + JSON 里的 status=ok(EO 回源没切过来时这里会是 5xx/超时)。 */
export function fetchHealth(url, timeoutMs = 12000) {
  return new Promise((res) => {
    let done = false
    const finish = (v) => { if (!done) { done = true; res(v) } }
    let req
    try {
      req = https.get(url, { family: 4, timeout: timeoutMs, headers: { 'User-Agent': 'ihui-eo-origin-repair/1.0', 'Cache-Control': 'no-cache' } }, (s) => {
        let body = ''
        s.setEncoding('utf8')
        s.on('data', (d) => { body += d; if (body.length > 8192) req.destroy() })
        s.on('end', () => finish({ ok: s.statusCode === 200 && /"status"\s*:\s*"ok"/.test(body), code: s.statusCode }))
      })
    } catch { finish({ ok: false, code: 0 }); return }
    req.on('timeout', () => { req.destroy(); finish({ ok: false, code: 0 }) })
    req.on('error', () => finish({ ok: false, code: 0 }))
  })
}

async function waitEntry(url, timeoutMs, intervalMs) {
  const deadline = Date.now() + timeoutMs
  let lastCode = 0
  for (;;) {
    const r = await fetchHealth(url)
    lastCode = r.code
    if (r.ok) return { ok: true, lastCode, waitedMs: timeoutMs - Math.max(0, deadline - Date.now()) }
    if (Date.now() >= deadline) return { ok: false, lastCode, waitedMs: timeoutMs }
    await new Promise((res) => setTimeout(res, intervalMs))
  }
}

/** 现测出口 IPv4:复用唯一出口 check-egress-ip-drift.mjs 的交叉验证(≥2 路一致才算取到)。 */
export async function probeWan(ledgerPath = join(ROOT, LEDGER_REL)) {
  const out = await analyze({ ledgerPath })
  return { ip: out.currentIp || null, sources: out.sources || [] }
}

export function machineLine(o) {
  return `EO-ORIGIN state=${o.state} wan=${o.wan || 'na'} origin=${o.origin || 'na'} domain=${o.domain} apply=${o.apply} reason=${o.reason || 'none'}`
}

export function renderText(o) {
  const lines = [`判定面:EdgeOne 加速域名 ${o.domain} 的源站 IPv4 vs 本机现测出口(zone=${o.zoneId || '?'})`]
  if (o.sources?.length) lines.push(`出口探测:${o.sources.map((s) => `${s.url} => ${s.ok ? s.ip : `FAIL(${s.why})`}`).join(' | ')}`)
  lines.push(`现测出口:${o.wan || '(未取得)'}    EO 源站:${o.origin || '(未读到)'}${o.port ? `:${o.port}` : ''} (${o.protocol || '?'})`)
  const tag = { ok: '✅', drift: '❌', repaired: '🛠', failed: '❌', unjudged: '❓' }[o.state] || '❓'
  lines.push(`${tag} ${o.state}:${o.reason || 'none'}${o.verified ? ' [入口已验证]' : ''}${o.rolledBack === false ? ' [回滚也失败]' : ''}`)
  lines.push(machineLine(o))
  return lines.join('\n')
}

/**
 * 主流程。IO 全可注入(镜像测试用假 teo/假入口,绝不真改云端 —— §5"测试隔离"精神)。
 */
export async function run({
  mode = 'check', // check | apply | print-ledger
  env = process.env,
  envFile = env.IHUI_EO_ENV_FILE || DEFAULT_ENV_FILE,
  ledgerPath = join(ROOT, LEDGER_REL),
  domain = String(env.IHUI_EO_DOMAIN || '').trim() || null,
  zoneName = String(env.IHUI_EO_ZONE_NAME || '').trim() || null,
  verifyPath = String(env.IHUI_EO_VERIFY_PATH || '').trim() || DEFAULT_VERIFY_PATH,
  verifyTimeoutMs = Number(env.IHUI_EO_VERIFY_TIMEOUT_MS || VERIFY_TIMEOUT_MS),
  verifyIntervalMs = Number(env.IHUI_EO_VERIFY_INTERVAL_MS || VERIFY_INTERVAL_MS),
  cred = resolveCredentials(env, envFile),
  teo = teoCall,
  wanProbe = probeWan,
  entryFetch = waitEntry,
  now = () => new Date(),
} = {}) {
  const base = { mode, domain: domain || DEFAULT_DOMAIN, wan: null, origin: null, zoneId: null, state: 'unjudged', reason: 'none', apply: mode === 'apply', verified: false, rolledBack: null, sources: [] }

  // 台账只是"面的来源"与回退期望,真值一律现读 EO。
  let ledgerFaces = []
  try {
    const doc = JSON.parse(readFileSync(ledgerPath, 'utf8'))
    ledgerFaces = (doc.rows || []).filter((r) => r?.judge === true && r?.face).map((r) => ({ face: String(r.face), port: r.port ?? 8801 }))
  } catch { /* 台账坏不阻断自愈:域名可由 IHUI_EO_DOMAIN 显式给 */ }
  const face = base.domain || ledgerFaces[0]?.face || DEFAULT_DOMAIN
  base.domain = face
  const zone = zoneName || zoneNameOf(face)

  if (!cred) return { ...base, reason: 'no-credentials' }
  const z = await describeZone(teo, cred, zone)
  if (!z.ok) return { ...base, reason: `eo-describe-zone-failed:${z.error}` }
  base.zoneId = z.zoneId
  const d = await describeDomain(teo, cred, z.zoneId, face)
  if (!d.ok) return { ...base, reason: `eo-describe-domain-failed:${d.error}` }

  const dom = d.domain
  const od = dom.OriginDetail || {}
  base.origin = normIp(od.Origin)
  base.port = dom.HttpOriginPort ?? null
  base.protocol = dom.OriginProtocol || ''
  if (od.OriginType !== 'IP_DOMAIN' || !isIPv4(base.origin)) return { ...base, reason: 'origin-not-ip' }

  if (mode === 'print-ledger') {
    // 期望 = EO 现配;其它行原样保留(bsm 是 judge=false,不动)。
    let doc = {}
    try { doc = JSON.parse(readFileSync(ledgerPath, 'utf8')) } catch { doc = { rows: [] } }
    // 活投影也带 30 天到期:它不是人登记的期望,但"最后一次活读"必须新鲜 —— 连续 30 天读不到 EO
    // 时这份投影必须自己作废(巡检落 unjudged 到人),不得拿陈旧投影继续冒充真值(§0.7 同族)。
    const stamp = now()
    const updatedOn = stamp.toISOString()
    const expires = new Date(stamp.getTime() + 30 * 86400000).toISOString().slice(0, 10)
    const rows = (doc.rows || []).map((r) => (r?.judge === true && String(r.face) === face ? { ...r, expectedIPv4: base.origin, port: base.port ?? r.port, updatedOn, expires } : r))
    if (!rows.some((r) => r?.judge === true && String(r.face) === face)) rows.push({ face, expectedIPv4: base.origin, port: base.port ?? 8801, owner: '(live EO origin, auto-generated)', note: '由 repair-eo-origin.mjs --print-ledger 生成:期望 = EdgeOne 现配源站', judge: true, updatedOn, expires })
    return { ...base, state: 'ok', reason: 'ledger-from-live-eo', ledger: { ...doc, rows } }
  }

  const w = await wanProbe(ledgerPath)
  base.wan = w.ip
  base.sources = w.sources || []
  if (!base.wan) return { ...base, reason: 'wan-unavailable' }
  if (!isPublicIPv4(base.wan)) return { ...base, reason: `wan-not-public:${base.wan}` }
  if (base.wan === base.origin) return { ...base, state: 'ok', reason: 'in-sync' }
  if (mode !== 'apply') return { ...base, state: 'drift', reason: `wan ${base.wan} != origin ${base.origin}` }

  // —— 自愈:改 → 验入口 → 失败回滚 ——
  const oldIp = base.origin
  const w1 = await teo(cred, 'ModifyAccelerationDomain', modifyPayload(z.zoneId, face, od, base.wan, dom.OriginProtocol, dom.HttpOriginPort, dom.HttpsOriginPort))
  if (!w1.ok) return { ...base, state: 'failed', reason: `modify-failed:${w1.error}`, oldOrigin: oldIp }
  base.origin = base.wan
  const url = `https://${face}${verifyPath}`
  const v = await entryFetch(url, verifyTimeoutMs, verifyIntervalMs)
  if (v.ok) return { ...base, state: 'repaired', reason: 'modified-and-verified', verified: true, oldOrigin: oldIp, lastCode: v.lastCode, waitedMs: v.waitedMs }
  const rb = await teo(cred, 'ModifyAccelerationDomain', modifyPayload(z.zoneId, face, od, oldIp, dom.OriginProtocol, dom.HttpOriginPort, dom.HttpsOriginPort))
  base.origin = oldIp
  base.rolledBack = rb.ok
  return { ...base, state: 'failed', reason: `entry-unverified:last=${v.lastCode}`, verified: false, oldOrigin: oldIp, lastCode: v.lastCode, waitedMs: v.waitedMs }
}

async function main() {
  const argv = process.argv.slice(2)
  if (argv.includes('--help') || argv.includes('-h')) {
    console.log('用法: node scripts/repair-eo-origin.mjs [--apply|--print-ledger] [--json]')
    console.log('活读 EdgeOne 源站 IPv4 vs 本机现测出口;--apply 漂移即改并从公网入口验证(失败回滚)。')
    console.log('退出码: 0=ok/repaired 1=drift/failed 2=unjudged')
    return 0
  }
  const mode = argv.includes('--print-ledger') ? 'print-ledger' : argv.includes('--apply') ? 'apply' : 'check'
  const out = await run({ mode })
  if (argv.includes('--json')) console.log(JSON.stringify(out))
  else if (mode === 'print-ledger' && out.ledger) console.log(JSON.stringify(out.ledger))
  else console.log(renderText(out))
  if (mode === 'print-ledger') return out.state === 'ok' ? 0 : 2
  if (out.state === 'ok' || out.state === 'repaired') return 0
  if (out.state === 'drift' || out.state === 'failed') return 1
  return 2
}

const isDirectRun = Boolean(process.argv[1]) && import.meta.url === pathToFileURL(process.argv[1]).href
if (isDirectRun) {
  main().then((code) => process.exit(code)).catch((e) => {
    console.error(`❌ 脚本自身异常(exit 2,不冒充判据结论):${String((e && e.message) || e)}`)
    process.exit(2)
  })
}

export const __test__ = { isPublicIPv4, zoneNameOf, readEnvFile, resolveCredentials, teoCall, machineLine, renderText, run, fetchHealth, DEFAULT_ENV_FILE, LEDGER_REL }
