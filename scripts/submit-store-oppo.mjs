#!/usr/bin/env node
// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * submit-store-oppo.mjs — OPPO 开放平台「API 传包能力」客户端(2026-11-09 立)
 *
 * ## 立因
 * 本仓此前把 oppo 记成 `apiMode: 'unverified'`(prepare-store-bundle.VENDOR_LIMITS),而
 * `probe-store-channel.mjs` 的 CHANNELS.oppo 明写"传包端点正文需登录、公开面核不到 ⇒ 判未判定"。
 * 本轮按官方文档《API传包能力接入》(open.oppomobile.com/new/developmentDoc/info?id=10998)重新取证,
 * **三段端点形态拿到了官方正文级出处**(接口域名 / token / get-upload-url / multipart 字段),
 * 所以 oppo 已从"整条未核实"推进到"token + 上传 + 提交发布 + 详情回读全部有官方正文级出处"。
 * 本器只按核实到的事实写:不提前把未核实段伪装成能跑(§0.8),也不把已核实段继续记成盲区(§12f:判据安静失效)。
 *
 * ## 端点出处(官方正文级,逐条)
 *   接口域名(正式) `https://oop-openapi-cn.heytapmobi.com`
 *   token      `GET /developer/v1/token?client_id=<18位>&client_secret=<64位>`
 *              ⇒ `{errno:0,data:{access_token(JWT),expire_in(Unix,48h 有效)}}`
 *   上传配置    `GET /resource/v1/upload/get-upload-url`(公共参数,Content-Type: x-www-form-urlencoded)
 *              ⇒ `{errno:0,data:{upload_url,sign}}`;官方明写 **sign 一次性,每个新文件都要重新取**
 *   文件上传    `POST <upload_url>` `multipart/form-data`,字段 `type`(apk|photo|resource)、`sign`、`file`
 *              ⇒ `{errno:0,data:{url,…}}`;官方明写 multipart 的表单值**不编码但 charset 须 utf-8**
 *   提交发布    `POST /resource/v1/app/upd`(2026-11-08 官方正文 open.oppomobile.com/documentation/page/info?id=10999
 *             公开可读:form 字段 pkg_name/version_code/apk_url[]/app_name/分类/简介/素材/联系人/online_type)
 *             ⇒ `errno=0` 且 `data.success=true` 才算提审成功;online_type=1 = 审核通过立即发布。
 *   应用详情    `GET /resource/v1/app/info`(id=11004,query pkg_name/version_code + 公共参数)。
 *   公共参数    access_token + timestamp(秒) + api_sign;签名=除 api_sign 外全部参数 ASCII 升序、
 *             `k=v&` 拼接、HmacSHA256(client_secret) 小写 hex(官方 demo.zip 逐行核实)。
 *   前置(官方"注意"第 1 条):**使用前需在开放平台先手动创建应用或游戏** ⇒ oppo 首包不能只靠 API。
 *   素材/资质(分类 id、图标、截图、版权证明、商务联系人)不在仓内 ⇒ 由 `OPPO_SUBMIT_JSON`
 *   或 `OPPO_SUBMIT_CONFIG_PATH` 提供;缺项在 submit 段具名 MISSING,绝不拿空值提交。
 *
 * ## 四段射程
 *   status   token → 查询应用详情 GET /resource/v1/app/info(已核实)
 *   upload   token → get-upload-url(签名 GET)→ POST multipart(已核实)
 *   verify   本地 md5/字节 ⇄ 申报 ⇄ 上传回执 url ⇄ 提审回执;齐且自洽才算绿
 *   submit   POST /resource/v1/app/upd(已核实;errno=0 且 data.success=true 才算受理)
 *
 * 用法:
 *   node scripts/submit-store-oppo.mjs --self-test
 *   node scripts/submit-store-oppo.mjs                        # dry-run(默认,零网络)
 *   node scripts/submit-store-oppo.mjs --phase upload --file <apk> --execute
 *   凭据优先级:env OPPO_CLIENT_ID / OPPO_CLIENT_SECRET > 密钥目录文件(§5d)
 * 退出码:0 全绿 / 1 缺件 / 2 未判定
 */
import { readFileSync } from 'node:fs'
import { createHash, createHmac, randomBytes } from 'node:crypto'
import { dirname, join } from 'node:path'
import { pathToFileURL } from 'node:url'

import { STATUS, STORE_VENDORS, storeCredential, fp } from './lib/rn-release-credentials.mjs'
import { resolveSecretsRoot } from './lib/key-dir.mjs'
import { channelOf, loadBundle, resolveArtifact, buildDryRun, gateStates, runSelfTest } from './lib/store-uploader-core.mjs'

const VENDOR = STORE_VENDORS.find((v) => v.id === 'oppo')
export const BASE = 'https://oop-openapi-cn.heytapmobi.com'
const DOC = 'open.oppomobile.com/new/developmentDoc/info?id=10998'
export const ENDPOINTS = Object.freeze({
  token: { method: 'GET', path: '/developer/v1/token', verified: true, doc: `${DOC}「获取Access Token」` },
  uploadConfig: { method: 'GET', path: '/resource/v1/upload/get-upload-url', verified: true, doc: `${DOC}「获取上传配置」` },
  upload: { method: 'POST', path: null, verified: true, note: 'URL 由 get-upload-url 下发,sign 一次性', doc: `${DOC}「文件上传」` },
  detail: { method: 'GET', path: '/resource/v1/app/info', verified: true, doc: 'open.oppomobile.com/documentation/page/info?id=11004' },
  submit: { method: 'POST', path: '/resource/v1/app/upd', verified: true, doc: 'open.oppomobile.com/documentation/page/info?id=10999' },
})

/** errno=0 是 OPPO 的成功位(不是 HTTP 200)⇒ 判读必须看 body,不看状态码。 */
export function classifyOppo(httpStatus, rawBody) {
  let j = null
  try {
    j = JSON.parse(String(rawBody ?? ''))
  } catch {
    return { status: STATUS.UNJUDGED, verdict: 'non-json-response', errno: null, detail: `http=${httpStatus} 非 JSON ⇒ 我形态错,不据此下结论`, data: null }
  }
  const errno = j?.errno ?? j?.code ?? null
  if (httpStatus >= 500) return { status: STATUS.UNJUDGED, verdict: 'server-error', errno, detail: `http=${httpStatus} errno=${errno}`, data: j }
  if (errno === 0) return { status: STATUS.FOUND, verdict: 'errno-0', errno, detail: `http=${httpStatus} errno=0`, data: j?.data ?? j }
  if (errno === null) return { status: STATUS.UNJUDGED, verdict: 'no-errno-field', errno, detail: `http=${httpStatus} 响应里没有 errno ⇒ 形态未证`, data: j }
  return { status: STATUS.MISSING, verdict: `errno-${errno}`, errno, detail: `http=${httpStatus} errno=${errno} msg="${String(j?.message ?? j?.msg ?? '').slice(0, 120)}"`, data: j }
}

/** 凭据件解析:OPPO 是 client_id(18位)/ client_secret(64位)一对。 */
export function parseCredentialText(text) {
  const pairs = String(text ?? '')
    .split(/\r?\n/)
    .map((l) => l.split(/[:：]/))
    .filter((m) => m.length >= 2)
    .map((m) => ({ k: m[0].trim(), v: m.slice(1).join(':').trim() }))
  const pick = (re) => (pairs.find((p) => re.test(p.k)) ?? {}).v ?? null
  const clientId = pick(/client[_\s-]?id/i)
  const clientSecret = pick(/client[_\s-]?secret|密\s*钥|apisecret|api_secret/i)
  return { clientId, clientSecret, fields: pairs.map((p) => p.k), secretFp: fp(clientSecret) }
}

export function resolveCredentials({ env = process.env, read = readFileSync, root = resolveSecretsRoot() } = {}) {
  if (env.OPPO_CLIENT_ID && env.OPPO_CLIENT_SECRET) return { status: STATUS.FOUND, detail: `env 齐备(secret sha8=${fp(env.OPPO_CLIENT_SECRET)})`, value: { clientId: env.OPPO_CLIENT_ID, clientSecret: env.OPPO_CLIENT_SECRET } }
  const cred = storeCredential(VENDOR, { root })
  if (cred.status !== STATUS.FOUND) return { status: cred.status, detail: `密钥目录:${cred.detail}`, value: null }
  let p
  try {
    p = parseCredentialText(read(cred.value[0].path, 'utf8'))
  } catch (e) {
    return { status: STATUS.UNJUDGED, detail: `凭据件读不到(${e?.code ?? e?.name})⇒ 不判"无凭据"`, value: null }
  }
  const miss = ['clientId', 'clientSecret'].filter((k) => !p[k])
  if (miss.length) return { status: STATUS.MISSING, detail: `凭据件缺 ${miss.join(',')}(字段=${p.fields.join('/')})⇒ OPPO 需 管理中心→我的API→创建客户端 分配的 client_id/client_secret`, value: null }
  return { status: STATUS.FOUND, detail: `client_id=${String(p.clientId).slice(0, 4)}*** secret sha8=${p.secretFp}`, value: { clientId: p.clientId, clientSecret: p.clientSecret } }
}

/** token 请求(plan 与 execute 共用同一份形态,§0.6 不复抄)。 */
export function tokenCall({ clientId, clientSecret }) {
  return { url: `${BASE}${ENDPOINTS.token.path}?client_id=${encodeURIComponent(clientId)}&client_secret=${encodeURIComponent(clientSecret)}`, method: 'GET' }
}

/** 官方签名 demo 逐行核实:除 api_sign 外全部参数 ASCII 升序、k=v&、HmacSHA256(secret)、小写 hex。 */
export function signOppo({ params, clientSecret } = {}) {
  if (!clientSecret) return { status: STATUS.UNJUDGED, detail: 'client_secret 取不到 ⇒ 不签', sign: null }
  const data = { ...params }
  delete data.api_sign
  const raw = Object.keys(data)
    .sort()
    .map((k) => `${k}=${data[k]}`)
    .join('&')
  return { status: STATUS.FOUND, detail: 'HmacSHA256 len=64', sign: createHmac('sha256', clientSecret).update(raw, 'utf8').digest('hex') }
}

/** 公共参数(access_token + timestamp 秒)+ 业务参数 ⇒ 已签名参数集合。 */
export function signedParams({ accessToken, clientSecret, timestamp = Math.floor(Date.now() / 1000), extra = {} } = {}) {
  const params = { access_token: String(accessToken), timestamp: String(timestamp), ...Object.fromEntries(Object.entries(extra).filter(([, v]) => v !== null && v !== undefined && v !== '')) }
  const s = signOppo({ params, clientSecret })
  if (s.status !== STATUS.FOUND) return { status: s.status, detail: s.detail, params: null }
  return { status: STATUS.FOUND, detail: s.detail, params: { ...params, api_sign: s.sign } }
}

/** GET 接口(详情/上传配置):公共参数进 query。 */
export function signedGetCall({ path, accessToken, clientSecret, extra = {} } = {}) {
  const sp = signedParams({ accessToken, clientSecret, extra })
  if (sp.status !== STATUS.FOUND) return { status: sp.status, detail: sp.detail, url: null, params: null }
  const q = new URLSearchParams(sp.params).toString()
  return { status: STATUS.FOUND, detail: sp.detail, url: `${BASE}${path}?${q}`, method: 'GET', params: sp.params }
}

/** POST form 接口(提交发布):公共参数进 body。 */
export function signedFormCall({ path, accessToken, clientSecret, extra = {} } = {}) {
  const sp = signedParams({ accessToken, clientSecret, extra })
  if (sp.status !== STATUS.FOUND) return { status: sp.status, detail: sp.detail, url: null, body: null, params: null }
  return { status: STATUS.FOUND, detail: sp.detail, url: `${BASE}${path}`, method: 'POST', headers: { 'content-type': 'application/x-www-form-urlencoded' }, body: new URLSearchParams(sp.params).toString(), params: sp.params }
}

export function uploadConfigCall({ accessToken, clientSecret }) {
  return signedGetCall({ path: ENDPOINTS.uploadConfig.path, accessToken, clientSecret })
}

/** multipart:字段顺序与官方一致(type/sign/file);file 段的 filename 用真实基名。 */
export function buildUploadMultipart({ uploadUrl, sign, type = 'apk', fileName, fileBuf, boundary = `ihui${randomBytes(8).toString('hex')}` } = {}) {
  const head = `--${boundary}\r\nContent-Disposition: form-data; name="type"; charset=utf-8\r\n\r\n${type}\r\n--${boundary}\r\nContent-Disposition: form-data; name="sign"; charset=utf-8\r\n\r\n${sign}\r\n--${boundary}\r\nContent-Disposition: form-data; name="file"; filename="${fileName}"\r\nContent-Type: application/vnd.android.package-archive\r\n\r\n`
  const body = Buffer.concat([Buffer.from(head, 'utf8'), Buffer.isBuffer(fileBuf) ? fileBuf : Buffer.from(String(fileBuf ?? '')), Buffer.from(`\r\n--${boundary}--\r\n`, 'utf8')])
  return { url: uploadUrl, method: 'POST', headers: { 'content-type': `multipart/form-data; boundary=${boundary}` }, body }
}

/** 申报单:文件名/字节/md5 一次算全 ⇒ upload 与 verify 同基准。 */
export function planUpload({ filePath, read = readFileSync } = {}) {
  let buf = null
  try {
    buf = read(filePath)
  } catch (e) {
    return { status: STATUS.UNJUDGED, detail: `产物读不到(${e?.code ?? e?.name})⇒ 不判"没有产物"`, plan: null }
  }
  if (!buf.length) return { status: STATUS.MISSING, detail: `产物 0 字节:${filePath}`, plan: null }
  return { status: STATUS.FOUND, detail: `${filePath.split('/').pop()} ${buf.length}B md5=${createHash('md5').update(buf).digest('hex')}`, plan: { fileName: filePath.split('/').pop(), contentLength: String(buf.length), fileMd5: createHash('md5').update(buf).digest('hex'), buf } }
}

export async function phaseUploadChain({ fetchImpl = fetch, creds, plan, timeoutMs = 300000 }) {
  const t = await fetchImpl(tokenCall(creds), { method: 'GET', signal: AbortSignal.timeout(timeoutMs) }).then(async (r) => ({ s: r.status, b: await r.text() })).catch(() => null)
  if (!t) return { phase: 'upload', status: STATUS.UNJUDGED, verdict: 'fetch-error', detail: `token 端点不可达 ⇒ 未判定(不等于 OPPO 拒绝)` }
  const tc = classifyOppo(t.s, t.b)
  const accessToken = tc.data?.access_token ?? tc.access_token ?? null
  if (!accessToken) return { phase: 'upload', ...tc, uploadedUrl: null, note: 'token 未取得,后续两段零调用' }
  const cfgCall = uploadConfigCall({ accessToken, clientSecret: creds.clientSecret })
  if (cfgCall.status !== STATUS.FOUND) return { phase: 'upload', status: cfgCall.status, verdict: 'sign-unavailable', detail: cfgCall.detail, uploadedUrl: null }
  const c = await fetchImpl(cfgCall.url, { method: 'GET', signal: AbortSignal.timeout(timeoutMs) }).then(async (r) => ({ s: r.status, b: await r.text() })).catch(() => null)
  if (!c) return { phase: 'upload', status: STATUS.UNJUDGED, verdict: 'fetch-error', detail: 'get-upload-url 不可达 ⇒ 未判定', uploadedUrl: null }
  const cc = classifyOppo(c.s, c.b)
  const uploadUrl = cc.data?.upload_url ?? null
  const sign = cc.data?.sign ?? null
  if (!uploadUrl || !sign) return { phase: 'upload', status: STATUS.MISSING, verdict: 'no-upload-url-or-sign', detail: `上传配置缺字段:${cc.detail}`, uploadedUrl: null }
  const mp = buildUploadMultipart({ uploadUrl, sign, fileName: plan.fileName, fileBuf: plan.buf })
  const u = await fetchImpl(mp.url, { method: 'POST', headers: mp.headers, body: mp.body, signal: AbortSignal.timeout(timeoutMs) }).then(async (r) => ({ s: r.status, b: await r.text() })).catch(() => null)
  if (!u) return { phase: 'upload', status: STATUS.UNJUDGED, verdict: 'fetch-error', detail: '文件 PUT/POST 不可达 ⇒ 未判定', uploadedUrl: null }
  const uc = classifyOppo(u.s, u.b)
  return { phase: 'upload', ...uc, uploadedUrl: uc.data?.url ?? null, fileMd5: plan.fileMd5, signUsedOneShot: true }
}

/** token 段单独可取:status/submit 与 upload 共用同一形态。 */
export async function getAccessToken({ fetchImpl = fetch, creds, timeoutMs = 30000 } = {}) {
  const call = tokenCall(creds)
  const t = await fetchImpl(call.url, { method: 'GET', signal: AbortSignal.timeout(timeoutMs) }).then(async (r) => ({ s: r.status, b: await r.text() })).catch(() => null)
  if (!t) return { status: STATUS.UNJUDGED, detail: 'token 端点不可达 ⇒ 未判定', accessToken: null }
  const tc = classifyOppo(t.s, t.b)
  const accessToken = tc.data?.access_token ?? tc.access_token ?? null
  if (!accessToken) return { status: tc.status, detail: `token 未取得:${tc.detail}`, accessToken: null }
  return { status: STATUS.FOUND, detail: `access_token len=${String(accessToken).length}`, accessToken }
}

/** 应用详情(id=11004):GET + 公共参数,errno=0 才是绿。 */
export async function phaseStatus({ fetchImpl = fetch, creds, accessToken = null, pkgName, versionCode = null, timeoutMs = 30000 } = {}) {
  const tok = accessToken ? { status: STATUS.FOUND, accessToken } : await getAccessToken({ fetchImpl, creds, timeoutMs })
  if (!tok.accessToken) return { phase: 'status', status: tok.status, verdict: 'no-token', detail: tok.detail }
  const call = signedGetCall({ path: ENDPOINTS.detail.path, accessToken: tok.accessToken, clientSecret: creds.clientSecret, extra: { pkg_name: pkgName, ...(versionCode ? { version_code: String(versionCode) } : {}) } })
  if (call.status !== STATUS.FOUND) return { phase: 'status', status: call.status, verdict: 'sign-unavailable', detail: call.detail }
  const r = await fetchImpl(call.url, { method: 'GET', signal: AbortSignal.timeout(timeoutMs) }).then(async (x) => ({ s: x.status, b: await x.text() })).catch(() => null)
  if (!r) return { phase: 'status', status: STATUS.UNJUDGED, verdict: 'fetch-error', detail: 'app/info 不可达 ⇒ 未判定' }
  const c = classifyOppo(r.s, r.b)
  return { phase: 'status', ...c }
}

/**
 * 提审素材:仓内 listing 只够 app_name/简介/隐私 URL/联系邮箱;分类 id、图标、截图、版权证明、
 * 商务联系人/电话、年龄分级是 OPPO 必传且不在仓内 ⇒ 由 OPPO_SUBMIT_JSON(或 _PATH)注入。
 * 缺项逐枚点名 MISSING —— 绝不拿空值拼表单让平台回一句难懂的错误。
 */
export function readVersionCode({ artifact = null, env = process.env, read = readFileSync } = {}) {
  const fromEnv = Number(env.STORE_VERSION_CODE ?? env.IHUI_VERSION_CODE ?? 0)
  if (Number.isFinite(fromEnv) && fromEnv > 0) return String(fromEnv)
  const p = artifact?.value?.path
  if (!p) return null
  try {
    const j = JSON.parse(read(join(dirname(p), 'output-metadata.json'), 'utf8'))
    const vc = Number(j?.elements?.[0]?.versionCode ?? 0)
    return vc > 0 ? String(vc) : null
  } catch {
    return null
  }
}

export function resolveSubmitProfile({ env = process.env, bundle = null, artifact = null, read = readFileSync } = {}) {
  const listing = bundle?.files?.listing ?? bundle?.listing ?? {}
  let cfg = {}
  let cfgDetail = '未提供 OPPO_SUBMIT_JSON(可选)'
  if (String(env.OPPO_SUBMIT_JSON ?? '').trim()) {
    try {
      cfg = JSON.parse(env.OPPO_SUBMIT_JSON)
      cfgDetail = 'env OPPO_SUBMIT_JSON'
    } catch {
      return { status: STATUS.UNJUDGED, detail: 'OPPO_SUBMIT_JSON 不是合法 JSON ⇒ 未判定', params: null, missing: [] }
    }
  } else if (String(env.OPPO_SUBMIT_CONFIG_PATH ?? '').trim()) {
    const p = String(env.OPPO_SUBMIT_CONFIG_PATH).replace(/\\/g, '/')
    try {
      cfg = JSON.parse(read(p, 'utf8'))
      cfgDetail = p
    } catch (e) {
      return { status: STATUS.UNJUDGED, detail: `OPPO_SUBMIT_CONFIG_PATH 读不到/不是 JSON(${e?.code ?? e?.name})⇒ 未判定`, params: null, missing: [] }
    }
  }
  const vc = Number(cfg.version_code ?? readVersionCode({ artifact, env, read }) ?? 0)
  const merged = {
    pkg_name: cfg.pkg_name ?? env.STORE_PACKAGE_NAME ?? listing.packageName ?? null,
    version_code: vc > 0 ? String(vc) : null,
    app_name: cfg.app_name ?? listing.title ?? null,
    second_category_id: cfg.second_category_id ?? null,
    third_category_id: cfg.third_category_id ?? null,
    summary: cfg.summary ?? sanitizeSummary(listing.brief),
    detail_desc: cfg.detail_desc ?? listing.full ?? null,
    update_desc: cfg.update_desc ?? listing.releaseNotes ?? '常规更新',
    privacy_source_url: cfg.privacy_source_url ?? listing.privacyPolicyUrl ?? null,
    icon_url: cfg.icon_url ?? null,
    pic_url: cfg.pic_url ?? null,
    landscape_pic_url: cfg.landscape_pic_url ?? null,
    test_desc: cfg.test_desc ?? '自动化发布:安装包与素材由 CI 生成并提交,请按常规流程审核。',
    copyright_url: cfg.copyright_url ?? null,
    business_username: cfg.business_username ?? null,
    business_email: cfg.business_email ?? listing.contact?.email ?? null,
    business_mobile: cfg.business_mobile ?? null,
    age_level: cfg.age_level ?? null,
    adaptive_equipment: cfg.adaptive_equipment ?? 4,
    online_type: cfg.online_type ?? 1,
  }
  const required = ['pkg_name', 'version_code', 'app_name', 'second_category_id', 'third_category_id', 'summary', 'detail_desc', 'update_desc', 'privacy_source_url', 'icon_url', 'pic_url', 'test_desc', 'copyright_url', 'business_username', 'business_email', 'business_mobile', 'age_level', 'adaptive_equipment']
  const missing = required.filter((k) => merged[k] === null || merged[k] === undefined || String(merged[k]).trim() === '')
  if (missing.length) return { status: STATUS.MISSING, detail: `提审素材缺 ${missing.length} 项:${missing.join(',')}(${cfgDetail} → 见官方 doc id=10999 必传表)`, params: merged, missing }
  return { status: STATUS.FOUND, detail: `提审素材齐备(${cfgDetail};online_type=${merged.online_type} ⇒ 审核通过立即发布)`, params: merged, missing: [] }
}

/** summary 官方要求:≤13 字符、不含标点与空格 ⇒ 从 listing.brief 现派生,不新造文案。 */
export function sanitizeSummary(text) {
  const s = String(text ?? '').replace(/[\s，。！？、,.!?;；:："'“”‘’()（）【】\[\]-]/g, '')
  return s ? [...s].slice(0, 13).join('') : null
}

/** 提交发布:apk_url[] 用上传回执 URL + 本地 md5;errno=0 且 data.success=true 才算提审成功。 */
export async function phaseSubmit({ fetchImpl = fetch, creds, accessToken = null, upload = null, artifact = null, bundle = null, profile = null, env = process.env, timeoutMs = 60000 } = {}) {
  if (!upload || upload.status !== STATUS.FOUND || !upload.uploadedUrl) {
    return { phase: 'submit', status: upload?.status === STATUS.UNJUDGED ? STATUS.UNJUDGED : STATUS.MISSING, verdict: 'no-upload-receipt', detail: '无上传回执 URL ⇒ 缺前置,不冒充提审' }
  }
  const pr = profile ?? resolveSubmitProfile({ env, bundle, artifact })
  if (pr.status !== STATUS.FOUND) return { phase: 'submit', status: pr.status, verdict: 'profile-incomplete', detail: pr.detail, missing: pr.missing }
  const md5 = upload.fileMd5 ?? null
  if (!md5) return { phase: 'submit', status: STATUS.MISSING, verdict: 'no-local-md5', detail: '本地上传 md5 取不到 ⇒ apk_url[] 必填 md5 无法填' }
  const tok = accessToken ? { status: STATUS.FOUND, accessToken } : await getAccessToken({ fetchImpl, creds, timeoutMs })
  if (!tok.accessToken) return { phase: 'submit', status: tok.status, verdict: 'no-token', detail: tok.detail }
  const extra = {
    ...pr.params,
    apk_url: JSON.stringify([{ url: upload.uploadedUrl, md5, cpu_code: 64 }]),
  }
  const call = signedFormCall({ path: ENDPOINTS.submit.path, accessToken: tok.accessToken, clientSecret: creds.clientSecret, extra })
  if (call.status !== STATUS.FOUND) return { phase: 'submit', status: call.status, verdict: 'sign-unavailable', detail: call.detail }
  const r = await fetchImpl(call.url, { method: 'POST', headers: call.headers, body: call.body, signal: AbortSignal.timeout(timeoutMs) }).then(async (x) => ({ s: x.status, b: await x.text() })).catch(() => null)
  if (!r) return { phase: 'submit', status: STATUS.UNJUDGED, verdict: 'fetch-error', detail: 'app/upd 不可达 ⇒ 未判定' }
  const c = classifyOppo(r.s, r.b)
  if (c.status !== STATUS.FOUND) return { phase: 'submit', ...c }
  if (c.data?.success === true) {
    return { phase: 'submit', status: STATUS.FOUND, verdict: 'submitted-for-review', detail: `errno=0 success=true logid=${c.data?.logid ?? '?'};online_type=${pr.params.online_type} ⇒ 审核通过后自动发布;此刻不等于已上架`, versionCode: pr.params.version_code }
  }
  return { phase: 'submit', status: STATUS.UNJUDGED, verdict: 'errno-0-without-success-flag', detail: 'errno=0 但 data.success 不是 true ⇒ 回包形态未证', data: c.data }
}

/** 绿的条件:上传回执 + 提审回执都成立;只有上传绿 ⇒ uploaded-partial,绝不冒充已上架。 */
export function mergeVerify({ plan, upload, submit = null }) {
  const gaps = []
  if (!plan) gaps.push('申报单(md5/字节)')
  if (!upload || upload.status !== STATUS.FOUND) gaps.push('上传回执(errno=0)')
  if (upload && !upload.uploadedUrl) gaps.push('回执文件 URL')
  if (gaps.length) return { phase: 'verify', status: gaps.length === 3 ? STATUS.UNJUDGED : STATUS.MISSING, verdict: 'verify-incomplete', gaps, detail: `取不到:${gaps.join(' / ')}` }
  if (!submit || submit.status !== STATUS.FOUND) {
    return { phase: 'verify', status: STATUS.MISSING, verdict: 'uploaded-partial', detail: `文件已落 OPPO(${upload.uploadedUrl}),但提审回执未成立(${submit?.detail ?? '未执行'})⇒ uploaded-partial`, submit: 'not-submitted' }
  }
  return { phase: 'verify', status: STATUS.FOUND, verdict: 'submitted-for-review', detail: `md5=${plan.fileMd5} ${plan.contentLength}B 已落 OPPO;提审回执 success=true ⇒ 进入审核;审核通过后按 online_type=1 自动发布,不等于此刻已上架` }
}

export const HELP = `OPPO 软件商店提交器(直传+提审已证;素材由 OPPO_SUBMIT_JSON 提供)
用法:
  node scripts/submit-store-oppo.mjs [--phase status|upload|submit|verify|all] [--file <apk>] [--execute] [--json]
  node scripts/submit-store-oppo.mjs --self-test
开关:
  --phase        阶段(status 默认)
  --file         显式提交物路径
  --execute      真出网(缺省 dry-run 零请求)
  --json         JSON 输出
  --self-test    离线自检
  --help, -h     显示本帮助
退出码:0 全绿 / 1 缺件 / 2 未判定`

export function parseArgs(argv) {
  const o = { phase: 'status', file: null, execute: false, json: false, selfTest: false, help: false }
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i]
    if (a === '--help' || a === '-h') o.help = true
    else if (a === '--phase') o.phase = argv[++i]
    else if (a === '--file') o.file = argv[++i]
    else if (a === '--execute') o.execute = true
    else if (a === '--json') o.json = true
    else if (a === '--self-test') o.selfTest = true
    else throw new Error(`未知参数: ${a}`)
  }
  if (!['status', 'upload', 'submit', 'verify', 'all'].includes(o.phase)) throw new Error(`--phase 只接受 status|upload|submit|verify|all,收到 ${o.phase}`)
  return o
}

async function main() {
  const args = parseArgs(process.argv.slice(2))
  if (args.help) { console.log(HELP); return 0 }
  if (args.selfTest) return selfTest()
  const creds = resolveCredentials()
  const artifact = resolveArtifact({ file: args.file, preferKind: 'apk' })
  const bundle = loadBundle({ vendor: 'oppo' })
  const ch = channelOf('oppo')
  const gates = gateStates({ creds, artifact, bundle, channel: { status: ch.status, detail: ch.channel?.label ?? ch.detail } })

  if (!args.execute) {
    const plan = artifact.value ? planUpload({ filePath: artifact.value.path }).plan : null
    const d = buildDryRun({
      vendorId: 'oppo',
      creds,
      artifact,
      bundle,
      whyManual: null,
      calls: [
        { verified: ENDPOINTS.token.verified, method: 'GET', url: creds.value ? tokenCall(creds.value).url.replace(/client_secret=[^&]+/, 'client_secret=***') : `${BASE}${ENDPOINTS.token.path}?client_id=<id>&client_secret=***` },
        { verified: ENDPOINTS.uploadConfig.verified, method: 'GET', url: `${BASE}${ENDPOINTS.uploadConfig.path}` },
        { verified: ENDPOINTS.upload.verified, method: 'POST', url: `<upload_url 由上一步下发> type=apk sign=<一次性> file=${plan?.fileName ?? '<apk>'}` },
        { verified: ENDPOINTS.submit.verified, method: 'POST', url: `${BASE}${ENDPOINTS.submit.path} (form: pkg_name/version_code/apk_url[]/素材/online_type=1)` },
        { verified: ENDPOINTS.detail.verified, method: 'GET', url: `${BASE}${ENDPOINTS.detail.path}?pkg_name=<pkg>&access_token=***` },
      ],
    })
    d.firstPublishNote = '官方"注意"第1条:使用传包能力前需在开放平台**先手动创建应用** ⇒ oppo 首包必须有后台动作'
    console.log(args.json ? JSON.stringify({ ...d, gates: gates.rows }, null, 2) : `DRY-RUN oppo(默认零网络)\n${d.calls.map((c) => `  - ${c}`).join('\n')}\n  - ${d.firstPublishNote}\n${gates.rows.map((r) => `  [${r.status}] ${r.k}: ${r.detail}`).join('\n')}`)
    return gates.exit
  }
  if (creds.status !== STATUS.FOUND) return console.log(`${creds.status === STATUS.MISSING ? '缺件' : '未判定'}:${creds.detail}`), creds.status === STATUS.MISSING ? 1 : 2
  if (args.phase !== 'status' && artifact.status !== STATUS.FOUND) return console.log(`提交物不成:${artifact.detail}`), artifact.status === STATUS.MISSING ? 1 : 2

  const emit = (steps) => {
    console.log(args.json ? JSON.stringify({ steps }, null, 2) : steps.map((s) => `[${s.status}] ${s.phase}: ${s.verdict ?? '-'} — ${s.detail ?? ''}`).join('\n'))
    const st = steps.map((s) => s.status)
    return st.includes(STATUS.UNJUDGED) ? 2 : st.includes(STATUS.MISSING) ? 1 : 0
  }
  const pkgName = bundle?.files?.listing?.packageName ?? process.env.STORE_PACKAGE_NAME ?? null
  const versionCode = readVersionCode({ artifact })
  if (args.phase === 'status') return emit([await phaseStatus({ creds: creds.value, pkgName, versionCode })])
  const planR = artifact.value ? planUpload({ filePath: artifact.value.path }) : { status: STATUS.UNJUDGED, plan: null, detail: '未点名产物' }
  if (planR.status !== STATUS.FOUND) return emit([{ phase: 'plan', ...planR }])
  const up = await phaseUploadChain({ creds: creds.value, artifact })
  if (args.phase === 'upload') return emit([up])
  if (args.phase === 'submit') return emit([await phaseSubmit({ creds: creds.value, upload: up, artifact, bundle })])
  const submitStep = await phaseSubmit({ creds: creds.value, upload: up, artifact, bundle })
  return emit([up, submitStep, mergeVerify({ plan: planR.plan, upload: up, submit: submitStep })])
}

function selfTest() {
  return runSelfTest([
    { name: 'O1 errno=0 才是成功(HTTP 200 但 errno≠0 仍算缺件)', fn: () => classifyOppo(200, '{"errno":0,"data":{"access_token":"x"}}').status === STATUS.FOUND && classifyOppo(200, '{"errno":31001,"message":"invalid client"}').status === STATUS.MISSING },
    { name: 'O2 非 JSON(登录页 HTML)⇒ 未判定,不读成"OPPO 拒绝"', fn: () => classifyOppo(200, '<html>登录失效</html>').status === STATUS.UNJUDGED && classifyOppo(200, '<html>').verdict === 'non-json-response' },
    { name: 'O3 5xx ⇒ 未判定', fn: () => classifyOppo(503, '{"errno":5000}').status === STATUS.UNJUDGED },
    { name: 'O4 凭据件缺 client_secret ⇒ MISSING 点名缺哪枚', fn: () => { const p = parseCredentialText('client_id:123456789012345678'); return p.clientId && !p.clientSecret && resolveCredentials({ env: {}, root: 'X:/nope' }).status !== STATUS.FOUND } },
    { name: 'O5 env 齐备优先且 detail 不含 secret 原文', fn: () => { const r = resolveCredentials({ env: { OPPO_CLIENT_ID: '123456789012345678', OPPO_CLIENT_SECRET: 'SECRET-DO-NOT-LEAK-0123456789' } }); return r.status === STATUS.FOUND && !r.detail.includes('DO-NOT-LEAK') } },
    { name: 'O6 token URL 形态:GET + 两枚 query,不出站即不打印 secret', fn: () => { const u = tokenCall({ clientId: 'A', clientSecret: 'B' }); return u.method === 'GET' && u.url === `${BASE}/developer/v1/token?client_id=A&client_secret=B` && ENDPOINTS.token.verified } },
    { name: 'O7 上传配置段走签名 GET(公共参数进 query,api_sign 在位)', fn: () => { const c = uploadConfigCall({ accessToken: 'TK', clientSecret: 'SEC' }); const u = new URL(c.url); return c.method === 'GET' && u.pathname === ENDPOINTS.uploadConfig.path && u.searchParams.get('access_token') === 'TK' && u.searchParams.get('timestamp') && /^[0-9a-f]{64}$/.test(u.searchParams.get('api_sign') ?? '') } },
    { name: 'O8 multipart 三字段齐(type/sign/file),file 段用真实基名与二进制', fn: () => { const mp = buildUploadMultipart({ uploadUrl: 'https://x/up', sign: 'S', fileName: 'app-release.apk', fileBuf: Buffer.from([0x50, 0x4b, 0x03, 0x04]) }); const s = mp.body.toString('latin1'); return s.includes('name="type"') && s.includes('apk') && s.includes('name="sign"') && s.includes('filename="app-release.apk"') && s.includes('charset=utf-8') && mp.body.length > s.length - 4 && mp.url === 'https://x/up' } },
    { name: 'O9 sign 一次性:两次 build 的 boundary 不同 ⇒ 不复用上一次的 sign', fn: () => buildUploadMultipart({ uploadUrl: 'u', sign: 'S1', fileName: 'a.apk', fileBuf: Buffer.alloc(1) }).headers['content-type'] !== buildUploadMultipart({ uploadUrl: 'u', sign: 'S1', fileName: 'a.apk', fileBuf: Buffer.alloc(1) }).headers['content-type'] },
    { name: 'O10 planUpload 0 字节 ⇒ MISSING;读不到 ⇒ 未判定', fn: () => planUpload({ filePath: '/nope', read: () => { throw Object.assign(new Error('e'), { code: 'ENOENT' }) } }).status === STATUS.UNJUDGED && planUpload({ filePath: '/x.apk', read: () => Buffer.alloc(0) }).status === STATUS.MISSING },
    { name: 'O11 mergeVerify:只有上传 ⇒ uploaded-partial(MISSING,不冒充提审)', fn: () => { const v = mergeVerify({ plan: { fileMd5: 'm', contentLength: '10' }, upload: { status: STATUS.FOUND, uploadedUrl: 'https://cdn/o.apk' } }); return v.status === STATUS.MISSING && v.verdict === 'uploaded-partial' && v.submit === 'not-submitted' } },
    { name: 'O12 上传+提审都绿 ⇒ submitted-for-review,且明写"不等于此刻已上架"', fn: () => { const v = mergeVerify({ plan: { fileMd5: 'm', contentLength: '10' }, upload: { status: STATUS.FOUND, uploadedUrl: 'https://cdn/o.apk' }, submit: { status: STATUS.FOUND } }); return v.status === STATUS.FOUND && v.verdict === 'submitted-for-review' && /不等于此刻已上架/.test(v.detail) } },
    { name: 'O13 提审素材缺 ⇒ MISSING 逐枚点名(不拿空值拼表单)', fn: () => { const r = resolveSubmitProfile({ env: {}, bundle: { files: { listing: { packageName: 'zh.ai.sq', title: '智汇AI', brief: '智汇AI让创作更简单', full: '长描述', privacyPolicyUrl: 'https://aizhs.top/privacy', contact: { email: 'a@b.c' } } } }, artifact: { value: null } }); return r.status === STATUS.MISSING && r.missing.includes('icon_url') && r.missing.includes('second_category_id') } },
    { name: 'O14 非法 --phase 抛错(不静默接受未知阶段)', fn: () => { try { parseArgs(['--phase', 'bogus']); return false } catch { return true } } },
    { name: 'O15 无上传回执 ⇒ 提审段 MISSING,且不出网', fn: async () => { let called = false; const r = await phaseSubmit({ fetchImpl: async () => { called = true; throw new Error('不应出网') }, creds: { clientId: 'I', clientSecret: 'S' }, upload: null }); return !called && r.status === STATUS.MISSING && r.verdict === 'no-upload-receipt' } },
    { name: 'O16 errno=0 但 data.success≠true ⇒ 未判定(不冒充提审成功)', fn: async () => { const r = await phaseSubmit({ fetchImpl: async () => ({ status: 200, text: async () => '{"errno":0,"data":{}}' }), creds: { clientId: 'I', clientSecret: 'S' }, accessToken: 'TK', upload: { status: STATUS.FOUND, uploadedUrl: 'https://cdn/o.apk', fileMd5: 'abc' }, profile: { status: STATUS.FOUND, params: { online_type: 1 }, missing: [] } }); return r.status === STATUS.UNJUDGED && r.verdict === 'errno-0-without-success-flag' } },
    { name: 'O17 提审 payload 含 apk_url(64)/version_code/online_type=1,成功才算 submitted-for-review', fn: async () => { let seen = null; const fetchImpl = async (url, init) => { seen = { url, init }; return { status: 200, text: async () => '{"errno":0,"data":{"success":true,"logid":"L1"}}' } }; const r = await phaseSubmit({ fetchImpl, creds: { clientId: 'I', clientSecret: 'S' }, accessToken: 'TK', upload: { status: STATUS.FOUND, uploadedUrl: 'https://cdn/o.apk', fileMd5: 'abc' }, profile: { status: STATUS.FOUND, params: { pkg_name: 'zh.ai.sq', version_code: '42', online_type: 1 }, missing: [] } }); const body = new URLSearchParams(seen.init.body); return r.status === STATUS.FOUND && r.verdict === 'submitted-for-review' && body.get('online_type') === '1' && body.get('version_code') === '42' && /cpu_code/.test(body.get('apk_url')) && body.get('api_sign') && /不等于已上架/.test(r.detail) } },
  ])
}

export const __test__ = { BASE, ENDPOINTS, classifyOppo, parseCredentialText, resolveCredentials, tokenCall, uploadConfigCall, buildUploadMultipart, planUpload, phaseUploadChain, getAccessToken, phaseStatus, resolveSubmitProfile, sanitizeSummary, readVersionCode, phaseSubmit, mergeVerify, signOppo, signedParams, signedGetCall, signedFormCall, parseArgs, STATUS }

const isDirectRun = process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href
if (isDirectRun) {
  main()
    .then((code) => process.exit(code))
    .catch((e) => {
      console.error(`❌ ${e?.message ?? e}\n${e?.stack ?? ''}`)
      process.exit(2)
    })
}
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
