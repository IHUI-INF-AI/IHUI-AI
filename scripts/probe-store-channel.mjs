#!/usr/bin/env node
// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * probe-store-channel.mjs — 国内商店发布通道的只读鉴别器(2026-11-02 立)
 *
 * 它只回答一个问题:**这一家的 API 通道,我们现在能不能用?**
 * 三态是必须的,因为"有凭据"和"能上架"是两件事 —— 华为那枚实测就是活样本:
 *   密钥目录里的 `华为appid 密钥.txt`(字段=应用ID/密钥)过 HMS OAuth 端点 **换得到 token**(len=104),
 *   但拿这枚 token 去 Publishing API,三家端点一致回结构化 `ret.code=205524993 client token auth failed`;
 *   而 AGC 自己的 token 端点回 `203890688 client id or secret error`。
 *   ⇒ 它是 **HMS 客户端凭据**,而自动化上架要的是 **Connect API 客户端凭据**
 *     (AGC「用户与权限 → Connect API → 创建 API 客户端」另取 client_id/client_secret)。
 * 更早一次我因为路径写错(`/api-publish/v2/app-info/get-app-info`)拿到 404 HTML,差点把
 * "华为没开通 API"当成结论 —— 404 HTML 是**我路径错**,401 + ret.code 才是华为的答复。
 * 所以本器把两种形态分开计:非 JSON/HTML ⇒ unjudged(我的问题);JSON ret ⇒ 判读(对方的问题)。
 *
 * 只对**已从官方文档核过端点形态**的厂商发请求。其余厂商标 endpoint-unverified ⇒ 直接未判定,
 * 不拿猜的 URL 去试(§0.8:文档与器物都不许写跑不通的出路)。
 *
 * 用法:node scripts/probe-store-channel.mjs [--vendor huawei] [--json]
 * 退出码:0 通道可用 / 1 通道存在但当前凭据不可用(点名缺哪一枚)/ 2 未判定
 */
import { readFileSync } from 'node:fs'
import { pathToFileURL } from 'node:url'

import { STATUS, storeCredential, playServiceKey, fp, STORE_VENDORS } from './lib/rn-release-credentials.mjs'

/** 端点表:形态全部取自厂商官方参考文档(2026-11-02 现读),不是推断 */
export const CHANNELS = Object.freeze({
  huawei: {
    label: '华为 AppGallery Connect Publishing API',
    tokenUrl: 'https://connect-api.cloud.huawei.com/api/oauth2/v1/token',
    tokenBody: (id, secret) => JSON.stringify({ client_id: id, client_secret: secret, grant_type: 'client_credentials' }),
    tokenHeaders: { 'content-type': 'application/json' },
    altTokenUrl: 'https://oauth-login.cloud.huawei.com/oauth2/v3/token',
    probe: (appId) => ({ url: `https://connect-api.cloud.huawei.com/api/publish/v2/app-info?appId=${appId}`, headers: { client_id: appId, 'content-type': 'application/json' } }),
    // 205524993 = client token auth failed;203890688 = client id or secret error
    interpret: (code) => ({ 205524993: { verdict: 'endpoint-ok-wrong-credential-type', status: STATUS.MISSING }, 203890688: { verdict: 'endpoint-ok-wrong-credential-type', status: STATUS.MISSING } })[code] ?? { verdict: `ret-code-${code}`, status: STATUS.UNJUDGED },
    remediation: '在 AGC「用户与权限 → Connect API」创建 API 客户端,取 client_id / client_secret 存进密钥目录(§5d:不入仓、不进聊天记录);拿到即通,产物与签名件本轮实测都已在位',
  },
})

export function classifyTokenResponse(status, body) {
  let j = null
  try {
    j = JSON.parse(body)
  } catch {
    return { kind: 'non-json', status: STATUS.UNJUDGED, detail: `http=${status} 非 JSON 响应 ⇒ 无法判定(形态问题,不是对方拒绝)`, code: null }
  }
  if (j.access_token) return { kind: 'token', status: STATUS.FOUND, detail: `token len=${j.access_token.length} expires=${j.expires_in ?? j.expire_in ?? '?'}`, code: null, token: j.access_token }
  const code = j?.ret?.code ?? j?.code ?? null
  const msg = j?.ret?.msg ?? j?.msg ?? j?.error_description ?? ''
  return { kind: 'rejected', status: STATUS.MISSING, detail: `http=${status} ret.code=${code} msg="${String(msg).slice(0, 90)}"`, code }
}

export async function probeVendor(vendorId, { fetchImpl = fetch, timeoutMs = 20000 } = {}) {
  const ch = CHANNELS[vendorId]
  const vendor = STORE_VENDORS.find((v) => v.id === vendorId)
  if (!vendor) return { vendor: vendorId, status: STATUS.UNJUDGED, detail: '厂商不在矩阵内' }
  if (!ch) return { vendor: vendorId, label: vendor.label, status: STATUS.UNJUDGED, verdict: 'endpoint-unverified', detail: `本器未持有 ${vendor.label} 的**已核实**端点形态 ⇒ 不发猜的 URL,判未判定。出路:取该家开放 API 文档后把形态补进 CHANNELS 表(一处即可,判据不改)` }

  const cred = storeCredential(vendor)
  if (cred.status !== STATUS.FOUND) return { vendor: vendorId, label: ch.label, status: cred.status, detail: `凭据:${cred.detail}`, verdict: cred.status === STATUS.UNJUDGED ? 'key-root-unreachable' : 'no-credential' }

  const file = cred.value[0].path
  const pairs = readFileSync(file, 'utf8').split(/\r?\n/).map((l) => l.split(/[:：]/)).filter((m) => m.length >= 2).map((m) => ({ k: m[0].trim(), v: m.slice(1).join(':').trim() }))
  const id = (pairs.find((p) => /应用 ?ID|appid|client.?id/i.test(p.k)) ?? {}).v
  const secret = (pairs.find((p) => /密钥|secret/i.test(p.k)) ?? {}).v
  if (!id || !secret) return { vendor: vendorId, label: ch.label, status: STATUS.UNJUDGED, detail: `${file} 里解析不出 id/secret 两枚候选`, verdict: 'unparsable' }

  const out = { vendor: vendorId, label: ch.label, credentialFile: file.split('/').pop(), credentialFp: fp(secret), idLen: id.length, steps: [] }

  const t1 = await fetchImpl(ch.tokenUrl, { method: 'POST', headers: ch.tokenHeaders, body: ch.tokenBody(id, secret), signal: AbortSignal.timeout(timeoutMs) }).then(async (r) => classifyTokenResponse(r.status, await r.text())).catch((e) => ({ kind: 'fetch-error', status: STATUS.UNJUDGED, detail: e?.cause?.code ?? e?.name, code: null }))
  out.steps.push({ step: 'Connect-API-token', ...t1 })

  let token = t1.token
  if (!token && ch.altTokenUrl) {
    const t2 = await fetchImpl(ch.altTokenUrl, { method: 'POST', headers: { 'content-type': 'application/x-www-form-urlencoded' }, body: new URLSearchParams({ client_id: id, client_secret: secret, grant_type: 'client_credentials' }), signal: AbortSignal.timeout(timeoutMs) }).then(async (r) => classifyTokenResponse(r.status, await r.text())).catch((e) => ({ kind: 'fetch-error', status: STATUS.UNJUDGED, detail: e?.cause?.code ?? e?.name, code: null }))
    out.steps.push({ step: 'HMS-OAuth-token(旁证)', ...t2 })
    token = t2.token
    if (t2.token) out.note = '旁证端点能签发 token ⇒ 这枚凭据本身有效,只是**类型**不是 Publishing API 接受的 Connect API 客户端'
  }

  if (token) {
    const p = ch.probe(id)
    const pr = await fetchImpl(p.url, { headers: { ...p.headers, authorization: `Bearer ${token}` }, signal: AbortSignal.timeout(timeoutMs) }).then(async (r) => { const b = await r.text(); return { http: r.status, body: b } }).catch((e) => ({ http: 'fetch-error', body: String(e?.cause?.code ?? e?.name) }))
    let parsed = null
    try {
      parsed = JSON.parse(pr.body)
    } catch {
      out.steps.push({ step: 'publish-api-probe', status: STATUS.UNJUDGED, detail: `http=${pr.http} 非 JSON ⇒ 路径形态未证,不据此下结论` })
    }
    if (parsed) {
      const code = parsed?.ret?.code ?? null
      const interp = ch.interpret(code)
      out.steps.push({ step: 'publish-api-probe', status: interp.status, verdict: interp.verdict, detail: `http=${pr.http} ret.code=${code} msg="${String(parsed?.ret?.msg ?? '').slice(0, 80)}" ⇒ 通道端点**已证可达**(对方给的是结构化答复,不是我路径错)` })
      out.status = interp.status
      out.verdict = interp.verdict
      out.remediation = ch.remediation
    } else if (out.status === undefined) {
      out.status = STATUS.UNJUDGED
    }
  } else {
    out.status = STATUS.MISSING
    out.verdict = 'no-usable-token'
    out.remediation = ch.remediation
  }
  return out
}

async function main() {
  const argv = process.argv.slice(2)
  const json = argv.includes('--json')
  const vi = argv.indexOf('--vendor')
  const ids = vi >= 0 ? [argv[vi + 1]] : Object.keys(CHANNELS).concat(['xiaomi', 'oppo', 'vivo', 'yyb', 'honor', 'harmony'])
  const results = []
  for (const id of ids) results.push(await probeVendor(id))
  if (json) console.log(JSON.stringify(results, null, 2))
  else {
    for (const r of results) {
      console.log(`\n[${r.status}] ${r.vendor} ${r.label ?? ''}`)
      for (const s of r.steps ?? []) console.log(`   ${s.step}: ${s.status} ${s.detail}`)
      if (r.note) console.log(`   旁证:${r.note}`)
      if (r.remediation) console.log(`   出路:${r.remediation}`)
      if (!r.steps && r.detail) console.log(`   ${r.detail}`)
    }
    const g = playServiceKey()
    console.log(`\n[对照] Google Play SA:${g.status} ${g.detail}`)
  }
  const blocked = results.filter((r) => r.status === STATUS.MISSING).length
  const unjudged = results.filter((r) => r.status === STATUS.UNJUDGED).length
  console.log(`\nSUMMARY vendors=${results.length} usable=${results.filter((r) => r.status === STATUS.FOUND).length} credential-gap=${blocked} unjudged=${unjudged}`)
  return blocked && !unjudged ? 1 : unjudged ? 2 : 0
}

export const __test__ = { CHANNELS, classifyTokenResponse, probeVendor, STATUS }

const isDirectRun = process.argv[1] && pathToFileURL(process.argv[1]).href === import.meta.url
if (isDirectRun) {
  main()
    .then((c) => process.exit(c ?? 0))
    .catch((e) => {
      console.error(`❌ ${e?.message ?? e}\n${e?.stack ?? ''}`)
      process.exit(2)
    })
}
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
