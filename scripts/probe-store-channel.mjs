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

/**
 * 端点表:形态全部取自厂商官方文档(2026-11-02 现读,出处见 docs/RELEASE.md 矩阵表),不是推断。
 *
 * 鉴权分三种形态,探测法必须分开 —— 把它们混成"换 token 再调"会一律得到假阴性:
 *   oauth         先 POST 换 token(华为/荣耀/OPPO)
 *   signature     无 token 端点,请求级签名(小米 RSA SIG、应用宝/vivo HmacSHA256)
 *   未核实         鸿蒙(且本仓无产物能力)⇒ 零调用判未判定
 *
 * **探测一律打"查询类"只读端点**(query/details/get-app-id/get-app-info),不打传包/提审端点:
 * 我们手上没有这些厂商的凭据,拿假签名去 POST 更新类接口既无意义也不该做。
 * 判读口径与华为那条一致:对方回结构化 JSON ⇒ 通道已证可达,缺的是凭据;
 * 回 HTML/非 JSON ⇒ 是我形态错,判未判定。
 */
/** 本应用的安卓包名(与 app.json 的 android.package 同值;各商店的查询端点都以它为键) */
const ANDROID_PACKAGE = 'zh.ai.sq'
const ANDROID_PACKAGE_LOOKUP = 'https://appmarket-openapi-drcn.cloud.honor.com/openapi/v1/publish/get-app-id'

export const CHANNELS = Object.freeze({
  huawei: {
    label: '华为 AppGallery Connect Publishing API',
    authMode: 'oauth',
    tokenUrl: 'https://connect-api.cloud.huawei.com/api/oauth2/v1/token',
    tokenBody: (id, secret) => JSON.stringify({ client_id: id, client_secret: secret, grant_type: 'client_credentials' }),
    tokenHeaders: { 'content-type': 'application/json' },
    altTokenUrl: 'https://oauth-login.cloud.huawei.com/oauth2/v3/token',
    probe: (appId) => ({ url: `https://connect-api.cloud.huawei.com/api/publish/v2/app-info?appId=${appId}`, headers: { client_id: appId } }),
    interpret: (code) => ({ 205524993: { verdict: 'endpoint-ok-wrong-credential-type', status: STATUS.MISSING }, 203890688: { verdict: 'endpoint-ok-wrong-credential-type', status: STATUS.MISSING } })[code] ?? { verdict: `ret-code-${code}`, status: STATUS.UNJUDGED },
    credentialKinds: '缺 AGC Connect API 客户端凭据(client_id/client_secret);现有枚是 HMS 客户端凭据(能签 token 但不被 Publishing API 认)',
    remediation: 'AGC「用户与权限 → Connect API」创建 API 客户端 ⇒ 取 client_id / client_secret 存进密钥目录(§5d 不入仓);产物与签名件本轮实测都已在位',
    doc: 'developer.huawei.com/consumer/cn/doc/development/AppGallery-connect-References/agcapi-app-info-query-0000001158365045',
  },
  honor: {
    label: '荣耀应用市场 Publishing OpenAPI',
    authMode: 'oauth',
    tokenUrl: 'https://iam.developer.honor.com/auth/token',
    tokenBody: (id, secret) => new URLSearchParams({ grant_type: 'client_credentials', client_id: id, client_secret: secret }).toString(),
    tokenHeaders: { 'content-type': 'application/x-www-form-urlencoded' },
    probe: () => ({ url: `${ANDROID_PACKAGE_LOOKUP}?pkgName=${ANDROID_PACKAGE}`, headers: {} }),
    credentialKinds: '缺荣耀开发者管理中心的 Client ID / API 密钥',
    remediation: '荣耀管理中心「开放能力 → 凭证」申请 API 密钥 ⇒ 存进密钥目录;注意官方限流(查询类低于 3min/次)',
    doc: 'developer.honor.com/cn/doc/guides/101359',
  },
  oppo: {
    label: 'OPPO 开放平台(传包能力)',
    authMode: 'oauth',
    tokenUrl: null,
    tokenProbeUrl: 'https://oop-openapi-cn.heytapmobi.com/developer/v1/token',
    credentialKinds: '缺 client_id(18 位)/ client_secret(64 位),管理中心→我的API→创建客户端',
    remediation: 'token 端点形态有官方出处,但**传包端点正文需登录**、公开面核不到 ⇒ 本器判未判定;持账号侧导出正文后补 probe 形态',
    doc: 'open.oppomobile.com/new/developmentDoc/info?id=10998',
    endpointUnverified: '传包/更新端点未核实(文档正文返回 300005 登录失效)',
  },
  xiaomi: {
    label: '小米应用商店 自动发布接口',
    authMode: 'signature',
    probe: () => ({ url: 'https://api.developer.xiaomi.com/devupload/dev/query', form: { RequestData: { packageName: ANDROID_PACKAGE, userName: '' }, SIG: 'probe-invalid-sig' } }),
    credentialKinds: '缺小米"接口私钥"(RSA SIG 用)+ 开发者站登录邮箱;私钥重置后旧值立即失效',
    remediation: '小米开发者站「应用管理 → 自动发布接口」开通并取接口私钥 ⇒ 存进密钥目录;注意 result=-7 表示包名被他人占用需认领',
    doc: 'dev.mi.com/xiaomihyperos/documentation/detail?pId=1134',
  },
  yyb: {
    label: '腾讯应用宝 API 更新应用信息',
    authMode: 'signature',
    probe: () => ({ url: 'https://p.open.qq.com/open_file/developer_api/query_app_detail', form: { user_id: '', pkg_name: ANDROID_PACKAGE, app_id: '', timestamp: String(Math.floor(Date.now() / 1000)), sign: 'probe-invalid-hmac' } }),
    credentialKinds: '缺 access_secret(账户管理→API发布接口→申请开通)+ 主账号 user_id(子账号不允许)',
    remediation: '应用宝开放平台开通 API 发布接口取 access_secret;官方明写**不支持新应用发布**,只能更新已上线应用 ⇒ 首包必须先在后台手工上线',
    doc: 'wikinew.open.qq.com/#/iwiki/4015262492',
  },
  vivo: {
    label: 'vivo 应用商店 API 传包服务',
    authMode: 'signature',
    probe: () => ({ url: 'https://developer-api.vivo.com.cn/router/rest', form: { method: 'app.query.details', access_key: '', timestamp: String(Date.now()), v: '1.0', sign_method: 'hmac', sign: 'probe-invalid-hmac', target_app_key: 'developer', packageName: ANDROID_PACKAGE } }),
    credentialKinds: '缺 access_key / access_secret(管理中心→账号管理→api管理→立即开通,一次开通覆盖账号下全部应用)',
    remediation: 'vivo 开通 API 管理取 access_key/secret;注意必传电子版权证书或版权证明其一 + 备案字段',
    doc: 'dev.vivo.com.cn/documentCenter/doc/326',
  },
})

/** 请求级签名形态的厂商:不带真凭据,只用空/占位签名打**查询类**端点,看对方给不给结构化答复。 */
async function probeBySignature(ch, fetchImpl, timeoutMs) {
  const p = ch.probe()
  const r = await fetchImpl(p.url, {
    method: 'POST',
    headers: { 'content-type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams(
      p.form.RequestData !== undefined
        ? { RequestData: JSON.stringify(p.form.RequestData), SIG: p.form.SIG }
        : p.form,
    ).toString(),
    signal: AbortSignal.timeout(timeoutMs),
  })
  const body = await r.text()
  return classifySignatureProbe(r.status, body)
}

export function classifySignatureProbe(status, body) {
  let j = null
  try {
    j = JSON.parse(body)
  } catch {
    return { status: STATUS.UNJUDGED, verdict: 'non-json', detail: `http=${status} 非 JSON ⇒ 端点形态未证(我方问题,不是对方答复)`, code: null }
  }
  const code = j?.code ?? j?.ret?.code ?? j?.result ?? j?.error_code ?? null
  const msg = String(j?.msg ?? j?.message ?? j?.ret?.msg ?? j?.error ?? '').slice(0, 90)
  // "端点活着"与"我这次调用形态对"是两件事:对方回「此功能不存在 / method 未知」这类话,
  // 说明它答了但没认我的 method ⇒ 只证域名与入口,不背书调用形态,必须落未判定。
  if (/不存在|未知|unknown|invalid (method|api)/i.test(msg)) {
    return { status: STATUS.UNJUDGED, verdict: 'endpoint-alive-but-call-shape-unverified', detail: `http=${status} code=${code} msg="${msg}" ⇒ 对方应答但**未认本次 method/参数形态**,不背书`, code }
  }
  return { status: STATUS.MISSING, verdict: 'endpoint-reachable-credential-gap', detail: `http=${status} code=${code} msg="${msg}" ⇒ 端点**已证可达**且对方在校验我们的参数,缺的是该家接口凭据`, code }
}

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
  if (!ch) {
    return { vendor: vendorId, label: vendor.label, status: STATUS.UNJUDGED, verdict: 'endpoint-unverified', detail: `本器未持有 ${vendor.label} 的**已核实**端点形态 ⇒ 不发猜的 URL,判未判定。出路:取该家开放 API 文档后把形态补进 CHANNELS 表(一处即可,判据不改)` }
  }
  if (ch.endpointUnverified) {
    return { vendor: vendorId, label: ch.label, status: STATUS.UNJUDGED, verdict: 'publish-endpoint-unverified', detail: `${ch.endpointUnverified}(token 端点形态已在册)`, doc: ch.doc, needs: ch.credentialKinds }
  }

  const cred = storeCredential(vendor)
  const out = {
    vendor: vendorId,
    label: ch.label,
    doc: ch.doc,
    authMode: ch.authMode,
    needs: ch.credentialKinds,
    remediation: ch.remediation,
    credential: { status: cred.status, detail: cred.status === STATUS.FOUND ? cred.value.map((v) => `${v.path.split('/').pop()}(${v.bytes}B,字段=${v.fields.join('/')})`).join(' | ') : cred.detail },
    steps: [],
  }
  let id = null
  let secret = null
  if (cred.status === STATUS.FOUND) {
    const pairs = readFileSync(cred.value[0].path, 'utf8')
      .split(/\r?\n/)
      .map((l) => l.split(/[:：]/))
      .filter((m) => m.length >= 2)
      .map((m) => ({ k: m[0].trim(), v: m.slice(1).join(':').trim() }))
    id = (pairs.find((p) => /应用 ?ID|appid|client.?id|access.?key|user.?id/i.test(p.k)) ?? {}).v ?? null
    secret = (pairs.find((p) => /密钥|secret|private/i.test(p.k)) ?? {}).v ?? null
    out.credentialFp = secret ? fp(secret) : null
  }

  // 通道可达性与"有没有凭据"必须分开量:没有凭据时用**占位值**打只读查询端点,
  // 对方给结构化答复 ⇒ 通道可达(缺凭据);给 HTML ⇒ 是我的形态问题(未判定)。
  if (ch.authMode === 'signature') {
    const s = await probeBySignature(ch, fetchImpl, timeoutMs).catch((e) => ({ status: STATUS.UNJUDGED, verdict: 'fetch-error', detail: String(e?.cause?.code ?? e?.name), code: null }))
    out.steps.push({ step: 'query-endpoint(占位签名,只读)', ...s })
    out.channel = s.status
    out.verdict = s.verdict
    out.status = s.status === STATUS.UNJUDGED ? STATUS.UNJUDGED : (cred.status === STATUS.FOUND ? STATUS.FOUND : STATUS.MISSING)
    return out
  }

  const turl = ch.tokenUrl ?? ch.tokenProbeUrl
  const headers = { ...(ch.tokenHeaders ?? { 'content-type': 'application/x-www-form-urlencoded' }) }
  const body = id && secret ? (ch.tokenBody ? ch.tokenBody(id, secret) : new URLSearchParams({ client_id: id, client_secret: secret, grant_type: 'client_credentials' }).toString()) : ch.tokenBody ? ch.tokenBody('probe-client-id', 'probe-client-secret') : new URLSearchParams({ client_id: 'probe', client_secret: 'probe', grant_type: 'client_credentials' }).toString()
  const t1 = await fetchImpl(turl, { method: ch.tokenUrl === null ? 'GET' : 'POST', headers, body, signal: AbortSignal.timeout(timeoutMs) })
    .then(async (r) => classifyTokenResponse(r.status, await r.text()))
    .catch((e) => ({ kind: 'fetch-error', status: STATUS.UNJUDGED, detail: String(e?.cause?.code ?? e?.name), code: null }))
  out.steps.push({ step: 'token-endpoint', ...t1 })

  if (t1.token && ch.probe) {
    const p = ch.probe(id)
    const pr = await fetchImpl(p.url, { headers: { 'content-type': 'application/json', authorization: `Bearer ${t1.token}`, ...p.headers }, signal: AbortSignal.timeout(timeoutMs) })
      .then(async (r) => ({ http: r.status, body: await r.text() }))
      .catch((e) => ({ http: 'fetch-error', body: String(e?.cause?.code ?? e?.name) }))
    let parsed = null
    try {
      parsed = JSON.parse(pr.body)
    } catch {
      out.steps.push({ step: 'publish-query', status: STATUS.UNJUDGED, detail: `http=${pr.http} 非 JSON ⇒ 路径形态未证,不据此下结论` })
    }
    if (parsed) {
      const code = parsed?.ret?.code ?? parsed?.code ?? null
      const interp = ch.interpret ? ch.interpret(code) : { verdict: code === null || code === undefined ? 'endpoint-reachable' : `code-${code}`, status: STATUS.MISSING }
      out.steps.push({ step: 'publish-query', status: interp.status, verdict: interp.verdict, detail: `http=${pr.http} code=${code} msg="${String(parsed?.ret?.msg ?? parsed?.msg ?? '').slice(0, 80)}" ⇒ 通道端点已证可达` })
      out.status = cred.status === STATUS.FOUND && interp.verdict === 'endpoint-reachable' ? STATUS.FOUND : interp.status
      out.verdict = interp.verdict
      return out
    }
    out.status = STATUS.UNJUDGED
    return out
  }

  out.verdict = t1.kind === 'token' ? 'token-ok' : t1.kind === 'rejected' ? 'endpoint-reachable-wrong-credential' : 'endpoint-form-unverified'
  out.channel = t1.status
  // 结构化被拒(ret.code / 401 Invalid client)= 通道可达而凭据不符 ⇒ 这是 credential-gap(missing),
  // 不是"没法判"。只有非 JSON / 取不到应答才落 unjudged(那是我方形态问题,不能替对方下结论)。
  out.status = t1.kind === 'token' ? STATUS.FOUND : t1.kind === 'rejected' ? STATUS.MISSING : STATUS.UNJUDGED
  return out
}

async function main() {
  const argv = process.argv.slice(2)
  const json = argv.includes('--json')
  const vi = argv.indexOf('--vendor')
  const ids = vi >= 0 ? [argv[vi + 1]] : STORE_VENDORS.map((v) => v.id)
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

export const __test__ = { CHANNELS, classifyTokenResponse, classifySignatureProbe, probeVendor, STATUS }

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
