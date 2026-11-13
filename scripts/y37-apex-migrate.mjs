#!/usr/bin/env node
// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/* eslint-disable no-console -- CLI 器物:人读行走 stdout,结论行恒 ASCII */

/**
 * y37-apex-migrate.mjs — Y-37 裸域 aizhs.top 从 CF Tunnel 切到 EdgeOne 灰云直连(2026-11-12)
 *
 * 背景(现读 API 证据,非推测):www.aizhs.top 2026-10 起已用 EdgeOne 源站直填取代 CF Tunnel
 * 跨境回源(回源 ttfb 10~45s → 0.28~0.34s)。其公网形态 = CF 上 CNAME 灰云直指 EO 接入点:
 *   www RECORD type=CNAME content=www.aizhs.top.eo.dnse0.com proxied=false
 * 裸域 aizhs.top 现仍是 CF Tunnel 橙云(e675929a-....cfargotunnel.com,proxied=true),而公网抖动
 * 告警的瓶颈正是「CF 边缘→跨境回源本机」。本器把裸域复刻 www 的迁移:
 *   前置闸 G0:EO 裸域证书必须已 deployed(否则切 DNS 后裸域 TLS 直接握手失败,比"慢"更糟)
 *   动作  :CF 裸域那条 CNAME  content → aizhs.top.eo.dnse0.com  且  proxied=false(灰云)
 *   回滚  :--rollback 写回 content=<Tunnel> proxied=true(切前已备份到 y37-cf-apex-dns-before.json)
 *
 * 凭据:deploy/cf-preferred-ip.env 的 CLOUDFLARE_API_TOKEN + CF_ZONE_ID(密钥值绝不打印)。
 * 安全闸:G0 证书 deployed;只动 name=aizhs.top 且 type=CNAME 的那一条,不碰 MX/TXT。
 * 退出码:0=ok/reverted;1=failed;2=unjudged(闸未过/取不到输入)。
 */

import { existsSync, readFileSync } from 'node:fs'
import { dirname, join, resolve } from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'

const HERE = dirname(fileURLToPath(import.meta.url))
const ROOT = resolve(HERE, '..')
const CF_ENV = join(ROOT, 'deploy', 'cf-preferred-ip.env')
const APEX_BACKUP = join(ROOT, '.ihui-agent', 'state', 'y37-cf-apex-dns-before.json')
const APEX_RECORD = 'aizhs.top'
const EO_TARGET = 'aizhs.top.eo.dnse0.com'

export function readCfEnv(path = CF_ENV) {
  const out = {}
  if (!path || !existsSync(path)) return out
  for (const raw of readFileSync(path, 'utf8').split(/\r?\n/)) {
    const m = raw.match(/^\s*([A-Z_][A-Z0-9_]*)\s*=\s*(.+?)\s*$/)
    if (m) out[m[1]] = m[2].replace(/^["']|["']$/g, '')
  }
  return out
}

async function cf(env, path, init = {}) {
  const res = await fetch(`https://api.cloudflare.com/client/v4${path}`, {
    ...init,
    headers: { Authorization: `Bearer ${env.CLOUDFLARE_API_TOKEN}`, 'Content-Type': 'application/json', ...(init.headers || {}) },
  })
  const j = await res.json().catch(() => ({}))
  return { ok: Boolean(j.success), data: j, status: res.status }
}

/** G0:EO 裸域证书是否 deployed。复用 repair-eo-origin 的 teoCall,不另写签名。 */
async function apexCertDeployed(cred, teoCall) {
  const z = await teoCall(cred, 'DescribeZones', { Limit: 100, Offset: 0 })
  if (!z.ok) return { deployed: false, why: `zone:${z.error}` }
  const zone = (z.data.Zones || []).find((x) => String(x.ZoneName || '').toLowerCase() === APEX_RECORD)
  if (!zone) return { deployed: false, why: 'zone-not-found' }
  const d = await teoCall(cred, 'DescribeAccelerationDomains', { ZoneId: zone.ZoneId, Limit: 100, Offset: 0 })
  if (!d.ok) return { deployed: false, why: `domains:${d.error}` }
  const apex = (d.data.AccelerationDomains || []).find((x) => x.DomainName === APEX_RECORD)
  if (!apex) return { deployed: false, why: 'apex-not-in-eo' }
  const cert = ((apex.Certificate || {}).List || [])[0] || {}
  return { deployed: cert.Status === 'deployed', status: cert.Status || 'none', certId: cert.CertId || '-', zoneId: zone.ZoneId }
}

async function main() {
  const argv = process.argv.slice(2)
  const rollback = argv.includes('--rollback')
  const force = argv.includes('--force') // 绕过 G0(仅排查用,默认不许)
  const env = readCfEnv()
  if (!env.CLOUDFLARE_API_TOKEN || !env.CF_ZONE_ID) {
    console.log('Y37-APEX state=unjudged reason=no-cf-credentials')
    return 2
  }

  // G0 证书闸(回滚不需要)
  let cert = null
  if (!rollback && !force) {
    const { resolveCredentials, teoCall } = await import('./repair-eo-origin.mjs')
    const cred = resolveCredentials()
    if (!cred) { console.log('Y37-APEX state=unjudged reason=no-eo-credentials'); return 2 }
    cert = await apexCertDeployed(cred, teoCall)
    console.log(`G0 EO 裸域证书: status=${cert.status} id=${cert.certId} deployed=${cert.deployed}`)
    if (!cert.deployed) {
      console.log(`Y37-APEX state=unjudged reason=cert-not-deployed (${cert.why || cert.status}) — 证书未就位,切 DNS 会令裸域 TLS 失败,拒绝执行。可等签发或排查用 --force。`)
      return 2
    }
  }

  // 取裸域 CNAME 记录
  const list = await cf(env, `/zones/${env.CF_ZONE_ID}/dns_records?type=CNAME&name=${APEX_RECORD}`)
  if (!list.ok) { console.log(`Y37-APEX state=unjudged reason=list-failed:${JSON.stringify(list.data.errors || []).slice(0, 120)}`); return 2 }
  const rec = (list.data.result || [])[0]
  if (!rec) { console.log('Y37-APEX state=unjudged reason=apex-cname-not-found'); return 2 }
  console.log(`当前裸域 CNAME: content=${rec.content} proxied=${rec.proxied} id=${rec.id}`)

  if (rollback) {
    const bak = existsSync(APEX_BACKUP) ? JSON.parse(readFileSync(APEX_BACKUP, 'utf8')) : null
    const oldCname = (bak || []).find((r) => r.type === 'CNAME')
    if (!oldCname) { console.log('Y37-APEX state=failed reason=no-backup-cname'); return 1 }
    const r = await cf(env, `/zones/${env.CF_ZONE_ID}/dns_records/${rec.id}`, {
      method: 'PUT',
      body: JSON.stringify({ type: 'CNAME', name: APEX_RECORD, content: oldCname.content, proxied: true, ttl: 1 }),
    })
    console.log(`回滚 → content=${oldCname.content} proxied=true: ${r.ok ? 'OK' : 'ERR ' + JSON.stringify(r.data.errors || []).slice(0, 120)}`)
    return r.ok ? 0 : 1
  }

  if (rec.content === EO_TARGET && rec.proxied === false) {
    console.log('Y37-APEX state=ok reason=already-on-eo (已是 EO 灰云,幂等)')
    return 0
  }

  const upd = await cf(env, `/zones/${env.CF_ZONE_ID}/dns_records/${rec.id}`, {
    method: 'PUT',
    body: JSON.stringify({ type: 'CNAME', name: APEX_RECORD, content: EO_TARGET, proxied: false, ttl: 1 }),
  })
  if (!upd.ok) { console.log(`Y37-APEX state=failed reason=update-failed:${JSON.stringify(upd.data.errors || []).slice(0, 160)}`); return 1 }
  console.log(`已切 → content=${EO_TARGET} proxied=false (灰云直连 EdgeOne,复刻 www 模式)`)
  console.log('Y37-APEX state=reverted-ok reason=migrated — 生效后用 y37-edgeone-origin-ip.sh step3 验证裸域 <1s')
  return 0
}

const isDirectRun = Boolean(process.argv[1]) && import.meta.url === pathToFileURL(process.argv[1]).href
if (isDirectRun) main().then((c) => process.exit(c)).catch((e) => { console.error(`❌ ${String(e.message || e)}`); process.exit(2) })

export const __test__ = { readCfEnv, EO_TARGET, APEX_RECORD }
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
