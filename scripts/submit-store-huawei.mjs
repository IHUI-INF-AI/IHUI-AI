#!/usr/bin/env node
// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * submit-store-huawei.mjs — 华为 AppGallery Connect「Publishing API」客户端(2026-11-06 立,Y-3 ①)
 *
 * ## 立因(不是预防)
 * 台账 Y-3 第①格:华为那枚 `华为appid 密钥.txt` 过 HMS OAuth 换得到 token,但 Publishing API
 * 一致回 `ret.code=205524993 client token auth failed` ⇒ 缺的是 AGC「用户与权限 → Connect API」
 * 另建的 **API 客户端**凭据(client_id/client_secret),而仓内**连"凭据到位后打哪三个端点"都没有器物**。
 * `scripts/release-mobile-rn.mjs` 的 store-huawei 腿自己登记的出口名就是本文件。
 *
 * ## 承载侧现读(为什么在 scripts/ 而不在 apps/api)
 * 现读 `apps/api/src/services/*store*` = 零命中(唯一带 store 字样的 two-factor-step-up-store /
 * refresh-replay-policy 与商店无关);`apps/ai-service` 侧命中的 huawei 全是上游中转适配器与术语表。
 * 仓内既有**的另一家商店客户端**是 `scripts/probe-play-status.mjs`(androidpublisher v3),
 * 凭据层是 `scripts/lib/rn-release-credentials.mjs`(§5d 密钥目录单源)⇒ 本客户端与它们同侧同形:
 * 不新增公开端点(矩阵不需要服务面)、默认 dry-run、凭据三态、结论恒脱敏。
 *
 * ## 四段射程(行为,不是猜)
 *   status  取产物状态:token → `GET /api/publish/v2/app-info`(+ v3 版本列表)
 *   upload  上传产物:`GET /api/publish/v2/upload-url/for-obs` → `PUT <uploadUrl>`(OBS)
 *   submit  提审:`POST /api/publish/v2/app-submit?appId=&releaseType=`(client_id 头 + Bearer,
 *           ret.code=0 才算受理);AGC 论坛口径:Publishing API 的提审主要面向 HarmonyOS/元服务,
 *           Android 包能否经此提审**以实测 ret.code 为准** ⇒ 绿只代表"对方受理",不等于已上架。
 *   verify  校验:本地 MD5/字节数 ⇄ 申报值 ⇄ 回读 releaseState ⇄ 提审回执,四者对齐才算绿
 *
 * 端点纪律与 `probe-store-channel.mjs` 同一条:**只打已核实形态的只读/上传/提审端点**;
 * 非 JSON/HTML 一律 unjudged(把"我路径错"读成"对方拒绝"本票真踩过一次)。
 *
 * ## 离线可测(红线:测试里绝不发生真实出网)
 * 每个 phase 都收 `fetchImpl`(默认 globalThis.fetch);纯函数 parseCredentialText / buildPaths /
 * classifyRet / planUpload / mergeVerify 全部 export 到 `__test__`,镜像用例见
 * `scripts/tests/submit-store-huawei.test.mjs`。凭据原文既不打印也不落盘,只出 sha8(§5d)。
 *
 * 用法:
 *   node scripts/submit-store-huawei.mjs [--phase status|upload|verify|all] [--file <apk|aab>]
 *        [--app-id <AGC appId>] [--execute] [--json]
 *   凭据优先级:env HUAWEI_CONNECT_CLIENT_ID / _CLIENT_SECRET / _APP_ID > 密钥目录文件(§5d key-dir)
 *   默认 **dry-run**(零网络);`--execute` 才发请求(HUAWEI_PROXY_* 由调用方在 spawn 时注入)。
 * 退出码:0 三段全绿 / 1 缺凭据或对方拒绝(点名缺哪一枚) / 2 未判定(形态取不到、网络不可达、产物缺失)
 */
import { createHash, createSign, createVerify, generateKeyPairSync, constants as cryptoConstants } from 'node:crypto'
import { readFileSync, statSync } from 'node:fs'
import path from 'node:path'
import { spawnSync } from 'node:child_process'
import { fileURLToPath, pathToFileURL } from 'node:url'

import { STATUS, STORE_VENDORS, storeCredential, fp } from './lib/rn-release-credentials.mjs'
import { resolveSecretsRoot } from './lib/key-dir.mjs'
import { runSelfTest } from './lib/store-uploader-core.mjs'

const ROOT = path.join(path.dirname(fileURLToPath(import.meta.url)), '..')
const HUAWEI_VENDOR = STORE_VENDORS.find((v) => v.id === 'huawei')

/** 端点表:形态逐条带官方出处;`verified:false` 的那条结构上不会被调用。 */
export const ENDPOINTS = Object.freeze({
  token: { method: 'POST', path: '/api/oauth2/v1/token', verified: true, doc: 'AGC「获取服务端授权」' },
  appInfo: { method: 'GET', path: '/api/publish/v2/app-info', verified: true, doc: 'agcapi-app-info-query-0000001158365045' },
  versionList: { method: 'POST', path: '/api/publish/v3/version/brief-info/list', verified: true, doc: 'agc-help-publish-api-query-brief-info-list-0000002236201254' },
  uploadUrl: { method: 'GET', path: '/api/publish/v2/upload-url/for-obs', verified: true, doc: 'Publishing API「获取上传文件地址」' },
  submit: { method: 'POST', path: '/api/publish/v2/app-submit', verified: true, doc: 'Publishing API「提交发布」app-submit(appId + releaseType)' },
})

/** AGC 论坛口径的诚实边界:app-submit 主要面向 HarmonyOS/元服务,Android 是否开放以实测为准。 */
export const SUBMIT_CAVEAT = 'AGC 论坛口径:app-submit 主要面向 HarmonyOS/元服务,Android 包能否经此提审以 ret.code 实测为准;ret.code=0 只代表对方受理,不等于已上架'

/** 华为 ret.code 的判读表:两类"凭据类型不对"与"通道可达"必须分开(§0.3)。 */
export const RET_CODES = Object.freeze({
  0: { verdict: 'ok', status: STATUS.FOUND },
  205524993: { verdict: 'endpoint-ok-wrong-credential-type', status: STATUS.MISSING, needs: HUAWEI_VENDOR?.fieldsNeeded ?? [] },
  203890688: { verdict: 'endpoint-ok-wrong-credential-type', status: STATUS.MISSING, needs: HUAWEI_VENDOR?.fieldsNeeded ?? [] },
})

/** 端点路径单源(§22c):调用方不得再拼一份字符串。 */
export function buildPaths({ baseUrl = 'https://connect-api.cloud.huawei.com', clientId = null } = {}) {
  const q = (o) => Object.entries(o).filter(([, v]) => v !== null && v !== undefined && v !== '').map(([k, v]) => `${k}=${encodeURIComponent(v)}`).join('&')
  return {
    base: baseUrl,
    token: `${baseUrl}${ENDPOINTS.token.path}`,
    appInfo: (appId, releaseType) => `${baseUrl}${ENDPOINTS.appInfo.path}?${q({ appId, releaseType })}`,
    versionList: (body = {}) => ({ url: `${baseUrl}${ENDPOINTS.versionList.path}`, headers: { client_id: clientId, 'content-type': 'application/json' }, body: JSON.stringify(body) }),
    uploadUrl: ({ appId, fileName, contentLength, releaseType = 1 }) => `${baseUrl}${ENDPOINTS.uploadUrl.path}?${q({ appId, fileName, contentLength, releaseType })}`,
    submit: ({ appId, releaseType = 1 }) => `${baseUrl}${ENDPOINTS.submit.path}?${q({ appId, releaseType })}`,
    authHeaders: (token) => ({ Authorization: `Bearer ${token}`, client_id: clientId ?? '' }),
  }
}

/**
 * 凭据件解析(纯函数,不碰磁盘)。
 * 三条实测形态必须分得开,否则"有凭据"会被读成"能上架":
 *   connect-api  同文件里既有 client_id 又有 client_secret ⇒ 自动化上架要的那一枚
 *   hms-legacy   只有 应用ID/密钥 ⇒ 能签 HMS token、**不被 Publishing API 认**(Y-3 现场)
 *   none         两枚皆无 ⇒ 未判定,不冒充"没有凭据"也别冒充"有"
 */
export function parseCredentialText(text) {
  const pairs = String(text ?? '')
    .split(/\r?\n/)
    .map((l) => l.split(/[:：]/))
    .filter((m) => m.length >= 2)
    .map((m) => ({ k: m[0].trim(), v: m.slice(1).join(':').trim() }))
  const pick = (re) => (pairs.find((p) => re.test(p.k)) ?? {}).v ?? null
  const clientId = pick(/^client[_\s-]?id$/i)
  const clientSecret = pick(/^client[_\s-]?secret$/i)
  const appId = pick(/应用\s*ID|app_?id/i)
  const legacySecret = pick(/密钥|secret|private/i)
  const kind = clientId && clientSecret ? 'connect-api' : appId && legacySecret ? 'hms-legacy' : 'none'
  return { kind, clientId, clientSecret, appId, secretFp: fp(clientSecret ?? legacySecret), fields: pairs.map((p) => p.k) }
}

/**
 * AGC「服务账号凭证」JSON 解析(纯函数)。
 * 官方《Connect API 使用入门》2026-10-29 版把 Service Account 标为推荐方式:
 * 文件字段 key_id / private_key / sub_account / token_uri;鉴权令牌是**本地签发的 PS256 JWT**,
 * 直接放 `Authorization: Bearer`,不走 client_credentials 换 token。
 * 三态:字段齐 ⇒ service-account;非 JSON 或缺字段 ⇒ none(交给文本解析器,不误判)。
 */
export function parseServiceAccountJson(text) {
  let j = null
  try {
    j = JSON.parse(String(text ?? ''))
  } catch {
    return { kind: 'none' }
  }
  if (!j || typeof j !== 'object') return { kind: 'none' }
  const keyId = j.key_id
  const privateKey = j.private_key
  const subAccount = j.sub_account
  if (!keyId || !privateKey || !subAccount) return { kind: 'none' }
  return {
    kind: 'service-account',
    keyId: String(keyId),
    privateKey: String(privateKey),
    subAccount: String(subAccount),
    tokenUri: String(j.token_uri ?? 'https://oauth-login.cloud.huawei.com/oauth2/v3/token'),
  }
}

/** 服务账号 JWT:header {kid,typ:JWT,alg:PS256};payload {aud:token_uri,iss:sub_account,iat,exp=iat+3600}。 */
export function buildServiceAccountJwt(creds, { now = Math.floor(Date.now() / 1000), ttlSec = 3600 } = {}) {
  const b64u = (obj) => Buffer.from(JSON.stringify(obj)).toString('base64url')
  const unsigned = `${b64u({ kid: creds.keyId, typ: 'JWT', alg: 'PS256' })}.${b64u({ aud: creds.tokenUri, iss: creds.subAccount, exp: now + ttlSec, iat: now })}`
  const signature = createSign('sha256')
    .update(unsigned)
    .sign({ key: creds.privateKey, padding: cryptoConstants.RSA_PKCS1_PSS_PADDING, saltLength: cryptoConstants.RSA_PSS_SALTLEN_DIGEST })
  return `${unsigned}.${Buffer.from(signature).toString('base64url')}`
}

/**
 * 凭据解析单出口:env 优先,其次密钥目录(§5d,原文不出仓、不进 stdout)。
 * 返回 {status, detail, value:{clientId,clientSecret,appId,kind}};value 只在 found 时给。
 */
export function resolveCredentials({ env = process.env, read = readFileSync, root = resolveSecretsRoot() } = {}) {
  const envPair = env.HUAWEI_CONNECT_CLIENT_ID && env.HUAWEI_CONNECT_CLIENT_SECRET
  if (envPair) {
    return {
      status: STATUS.FOUND,
      detail: `env 两枚齐备(secret sha8=${fp(env.HUAWEI_CONNECT_CLIENT_SECRET)})`,
      value: { clientId: env.HUAWEI_CONNECT_CLIENT_ID, clientSecret: env.HUAWEI_CONNECT_CLIENT_SECRET, appId: env.HUAWEI_CONNECT_APP_ID ?? null, kind: 'connect-api' },
    }
  }
  const cred = storeCredential(HUAWEI_VENDOR, { root })
  if (cred.status !== STATUS.FOUND) return { status: cred.status, detail: `密钥目录:${cred.detail}`, value: null }
  let parsed = null
  let sa = null
  let readErr = null
  for (const f of cred.value) {
    let text = null
    try {
      text = read(f.path, 'utf8')
    } catch (e) {
      readErr = e
      continue
    }
    const s = parseServiceAccountJson(text)
    if (s.kind === 'service-account') {
      sa = s
      break
    }
    if (!parsed) parsed = parseCredentialText(text)
  }
  if (sa) return { status: STATUS.FOUND, detail: `服务账号凭证在位(key_id=${sa.keyId.slice(0, 6)}***, sub_account=${sa.subAccount}, private_key sha8=${fp(sa.privateKey)};JWT PS256 本地签发)`, value: sa }
  if (!parsed) return { status: STATUS.UNJUDGED, detail: `凭据件读不到(${readErr?.code ?? readErr?.name})⇒ 不判"无凭据"`, value: null }
  if (parsed.kind === 'none') return { status: STATUS.UNJUDGED, detail: `凭据件字段形态认不出(字段=${parsed.fields.join('/')})`, value: null }
  if (parsed.kind === 'hms-legacy')
    return {
      status: STATUS.MISSING,
      detail: `密钥目录那枚是 HMS 客户端凭据(字段=${parsed.fields.join('/')}, secret sha8=${parsed.secretFp}),Publishing API 不认 ⇒ 需要 AGC 的「服务账号凭证(官方推荐)」或「API客户端凭证」`,
      value: null,
    }
  return { status: STATUS.FOUND, detail: `Connect API 客户端在位(client_id=${String(parsed.clientId).slice(0, 4)}***, secret sha8=${parsed.secretFp})`, value: parsed }
}

/** 响应判读:HTTP 状态 + ret.code 决定三态;非 JSON/HTML 一律未判定(那是我的形态问题)。 */
export function classifyRet(httpStatus, rawBody) {
  let j = null
  try {
    j = JSON.parse(String(rawBody ?? ''))
  } catch {
    return { status: STATUS.UNJUDGED, verdict: 'non-json-response', code: null, detail: `http=${httpStatus} 非 JSON ⇒ 路径形态未证,不据此下结论`, data: null }
  }
  const code = j?.ret?.code ?? j?.code ?? null
  const msg = String(j?.ret?.msg ?? j?.msg ?? j?.error_description ?? '').slice(0, 120)
  const known = RET_CODES[code]
  if (httpStatus >= 500) return { status: STATUS.UNJUDGED, verdict: 'server-error', code, detail: `http=${httpStatus} ${msg}`, data: j }
  if (known) return { status: known.status, verdict: known.verdict, code, detail: `http=${httpStatus} ret.code=${code} msg="${msg}"`, data: j }
  if (code === null || code === undefined) {
    return { status: httpStatus === 200 || httpStatus === 201 ? STATUS.FOUND : STATUS.MISSING, verdict: `http-${httpStatus}`, code, detail: `http=${httpStatus} ${msg}`, data: j }
  }
  return { status: STATUS.MISSING, verdict: `ret-code-${code}`, code, detail: `http=${httpStatus} ret.code=${code} msg="${msg}"`, data: j }
}

/** 换 token:失败即三分(拿到 token / 对方拒绝 / 网络不可达),绝不把拒绝读成可达。 */
export async function fetchToken({ fetchImpl, P, creds, timeoutMs = 20000 }) {
  if (creds?.kind === 'service-account') {
    try {
      const token = buildServiceAccountJwt(creds)
      return { status: STATUS.FOUND, verdict: 'service-account-jwt', code: 0, detail: `服务账号 JWT 本地签发(PS256,kid=${creds.keyId.slice(0, 6)}***,TTL=3600s)⇒ 作 Bearer 直用,零换 token 网络`, token }
    } catch (e) {
      return { status: STATUS.UNJUDGED, verdict: 'jwt-sign-error', code: null, detail: `JWT 签发失败(${e?.code ?? e?.name})⇒ 不判凭据无效`, token: null }
    }
  }
  try {
    const r = await fetchImpl(P.token, {
      method: ENDPOINTS.token.method,
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ client_id: creds.clientId, client_secret: creds.clientSecret, grant_type: 'client_credentials' }),
      signal: AbortSignal.timeout(timeoutMs),
    })
    const c = classifyRet(r.status, await r.text())
    if (c.status !== STATUS.FOUND || !c.data?.access_token) return { ...c, token: null }
    return { status: STATUS.FOUND, verdict: 'token-ok', code: 0, detail: `token len=${String(c.data.access_token).length} expires=${c.data.expires_in ?? c.data.expire_in ?? '?'}`, token: c.data.access_token }
  } catch (e) {
    return { status: STATUS.UNJUDGED, verdict: 'fetch-error', code: null, detail: `token 端点不可达(${e?.cause?.code ?? e?.name})`, token: null }
  }
}

/** ① 取产物状态:app-info(releaseState)+ v3 版本列表(各版本与包) */
export async function phaseStatus({ fetchImpl = fetch, creds, appId, timeoutMs = 20000 } = {}) {
  const P = buildPaths({ clientId: creds?.clientId })
  const t = await fetchToken({ fetchImpl, P, creds, timeoutMs })
  if (!t.token) return { phase: 'status', ...t, appInfo: null, versions: null }
  const H = { 'content-type': 'application/json', ...P.authHeaders(t.token) }
  const info = await fetchImpl(P.appInfo(appId), { headers: H, signal: AbortSignal.timeout(timeoutMs) })
    .then(async (r) => classifyRet(r.status, await r.text()))
    .catch((e) => ({ status: STATUS.UNJUDGED, verdict: 'fetch-error', detail: String(e?.cause?.code ?? e?.name), data: null }))
  const list = await fetchImpl(P.versionList({ packageName: null }).url, {
    method: ENDPOINTS.versionList.method,
    headers: { ...H, appId: String(appId ?? '') },
    body: JSON.stringify({ appId: String(appId ?? ''), state: '' }),
    signal: AbortSignal.timeout(timeoutMs),
  })
    .then(async (r) => classifyRet(r.status, await r.text()))
    .catch((e) => ({ status: STATUS.UNJUDGED, verdict: 'fetch-error', detail: String(e?.cause?.code ?? e?.name), data: null }))
  const releaseState = info.data?.appInfo?.releaseState ?? null
  return {
    phase: 'status',
    status: info.status === STATUS.FOUND ? STATUS.FOUND : info.status,
    verdict: releaseState === null ? 'no-release-state-field' : `releaseState-${releaseState}`,
    detail: `${info.detail}${releaseState === null ? '' : ` releaseState=${releaseState}`}`,
    releaseState,
    versionCount: Array.isArray(list.data?.versionList) ? list.data.versionList.length : null,
    versions: list.data?.versionList ?? null,
    token: t.detail,
  }
}

/** 上传申报单(纯函数):文件名/字节数/MD5/releaseType 一次算全,upload 与 verify 共用同一份。 */
export function planUpload({ filePath, read = readFileSync, stat = statSync, releaseType = 1 } = {}) {
  let st = null
  try {
    st = stat(filePath)
  } catch (e) {
    return { status: STATUS.UNJUDGED, detail: `产物取不到(${e?.code ?? e?.name})⇒ 不判"没有产物"`, plan: null }
  }
  if (!st.size) return { status: STATUS.MISSING, detail: `产物 0 字节:${filePath}`, plan: null }
  const md5 = createHash('md5').update(read(filePath)).digest('hex')
  return {
    status: STATUS.FOUND,
    detail: `${path.basename(filePath)} ${st.size}B md5=${md5}`,
    plan: { fileName: path.basename(filePath), contentLength: String(st.size), fileMd5: md5, releaseType, bytes: st.size },
  }
}

/** ② 上传:取 OBS 预签名地址 → PUT 文件流。拿到 objectId 才算这一步绿。 */
export async function phaseUpload({ fetchImpl = fetch, creds, appId, plan, filePath, timeoutMs = 120000 } = {}) {
  if (!plan) return { phase: 'upload', status: STATUS.UNJUDGED, verdict: 'no-plan', detail: '申报单未成立(产物缺失/0 字节)', objectId: null }
  const P = buildPaths({ clientId: creds?.clientId })
  const t = await fetchToken({ fetchImpl, P, creds, timeoutMs })
  if (!t.token) return { phase: 'upload', ...t, objectId: null }
  const H = { 'content-type': 'application/json', ...P.authHeaders(t.token) }
  const u = await fetchImpl(P.uploadUrl({ appId, fileName: plan.fileName, contentLength: plan.contentLength, releaseType: plan.releaseType }), { headers: H, signal: AbortSignal.timeout(timeoutMs) })
    .then(async (r) => classifyRet(r.status, await r.text()))
    .catch((e) => ({ status: STATUS.UNJUDGED, verdict: 'fetch-error', detail: String(e?.cause?.code ?? e?.name), data: null }))
  const d = u.data ?? {}
  const uploadUrl = d.uploadUrl ?? d.data?.uploadUrl ?? null
  if (!uploadUrl) return { phase: 'upload', status: u.status, verdict: 'no-upload-url', detail: u.detail, objectId: null }
  const put = await fetchImpl(uploadUrl, {
    method: 'PUT',
    headers: { 'content-type': 'application/octet-stream', ...(d.uploadHeaders ?? d.authHeaders ?? {}) },
    body: readFileSync(filePath),
    signal: AbortSignal.timeout(timeoutMs),
  })
    .then(async (r) => classifyRet(r.status, await r.text()))
    .catch((e) => ({ status: STATUS.UNJUDGED, verdict: 'fetch-error', detail: String(e?.cause?.code ?? e?.name), data: null }))
  return {
    phase: 'upload',
    status: put.status,
    verdict: put.status === STATUS.FOUND ? 'obs-put-accepted' : put.verdict,
    detail: `预签名地址 ok;PUT ${put.detail}`,
    objectId: put.data?.objectId ?? d.objectId ?? null,
    fileMd5: plan.fileMd5,
  }
}

/**
 * ③ 提审:app-submit(appId + releaseType)。**必须已有上传回执**才发,否则 MISSING 不冒充提审。
 * ret.code=0 才算对方受理;返回里恒带 SUBMIT_CAVEAT(Android 是否开放以实测为准)。
 */
export async function phaseSubmit({ fetchImpl = fetch, creds, appId, releaseType = 1, upload = null, timeoutMs = 30000 } = {}) {
  if (!upload || upload.objectId === null || upload.objectId === undefined) {
    return { phase: 'submit', status: upload?.status === STATUS.UNJUDGED ? STATUS.UNJUDGED : STATUS.MISSING, verdict: 'no-upload-receipt', detail: '上传回执(objectId)未成立 ⇒ 缺前置,不冒充提审' }
  }
  const P = buildPaths({ clientId: creds?.clientId })
  const t = await fetchToken({ fetchImpl, P, creds, timeoutMs })
  if (!t.token) return { phase: 'submit', ...t }
  const r = await fetchImpl(P.submit({ appId, releaseType }), { method: ENDPOINTS.submit.method, headers: P.authHeaders(t.token), signal: AbortSignal.timeout(timeoutMs) })
    .then(async (x) => classifyRet(x.status, await x.text()))
    .catch((e) => ({ status: STATUS.UNJUDGED, verdict: 'fetch-error', detail: String(e?.cause?.code ?? e?.name), data: null }))
  if (r.status !== STATUS.FOUND) return { phase: 'submit', ...r }
  return { phase: 'submit', status: STATUS.FOUND, verdict: 'submitted-for-review', detail: `app-submit ret.code=0(releaseType=${releaseType})⇒ 已递交提审;${SUBMIT_CAVEAT}`, data: r.data }
}

/**
 * ④ 校验(纯函数,可离线跑):申报 MD5 ⇄ 本地实测 MD5 ⇄ 上传回执 ⇄ 回读 releaseState ⇄ 提审回执。
 * 任何一格取不到 ⇒ unjudged/MISSING;只有齐且自洽才 found。绝不因"PUT 返回 200"就报"已上架"。
 */
export function mergeVerify({ plan, upload, status, submit = null } = {}) {
  const gaps = []
  if (!plan) gaps.push('申报单')
  if (!upload || upload.objectId === null || upload.objectId === undefined) gaps.push('上传回执(objectId)')
  if (!status || status.status !== STATUS.FOUND) gaps.push('回读 releaseState')
  if (plan && upload?.fileMd5 && plan.fileMd5 !== upload.fileMd5) gaps.push('MD5 申报与回执不一致')
  if (gaps.length) return { phase: 'verify', status: gaps.length === 3 ? STATUS.UNJUDGED : STATUS.MISSING, verdict: 'verify-incomplete', gaps, detail: `取不到:${gaps.join(' / ')}` }
  if (!submit || submit.status !== STATUS.FOUND) {
    return { phase: 'verify', status: STATUS.MISSING, verdict: 'uploaded-partial', detail: `文件已落华为(objectId=${upload.objectId}),但提审回执未成立(${submit?.detail ?? '未执行'})⇒ uploaded-partial`, submit: 'not-submitted' }
  }
  return {
    phase: 'verify',
    status: STATUS.FOUND,
    verdict: `submitted-for-review-releaseState-${status.releaseState}`,
    detail: `objectId=${upload.objectId} md5=${plan.fileMd5} 申报=${plan.contentLength}B 一致;回读 releaseState=${status.releaseState};提审 receipt=ret.code 0 ⇒ 对方受理,不等于已上架`,
    releaseState: status.releaseState,
    submit: 'submitted-for-review',
  }
}

/** 登记腿 argv(纯函数):凭据到位后一条命令把 store='huawei' 那一格钉到线上 latest。 */
export function buildRegisterArgv({ version, buildNumber, downloadUrl, apply } = {}) {
  const argv = [path.join(ROOT, 'scripts', 'register-app-version-latest.mjs'), '--platform', 'android', '--store', 'huawei']
  if (version) argv.push('--version', String(version))
  if (buildNumber) argv.push('--build-number', String(buildNumber))
  if (downloadUrl) argv.push('--download-url', String(downloadUrl))
  if (apply) argv.push('--apply')
  return argv
}

export const HELP = `华为 AppGallery Connect「Publishing API」客户端
用法:
  node scripts/submit-store-huawei.mjs [--phase status|upload|submit|verify|all] [--file <apk|aab>]
       [--app-id <AGC appId>] [--release-type 1|3] [--execute] [--json]
       [--register --version <v> --build-number <n> --download-url <url>]
  node scripts/submit-store-huawei.mjs --self-test
开关:
  --phase        阶段(status 默认)
  --file         提交物路径(用于 upload/verify 段)
  --app-id       AGC appId(缺省读 env HUAWEI_CONNECT_APP_ID)
  --release-type 1=全网发布 / 3=分阶段发布(缺省 1)
  --execute      真出网(缺省 dry-run 零请求)
  --json         JSON 输出
  --register     校验通过后登记 store=huawei 的 latest(带 --apply 才真写)
  --version      登记版本号
  --build-number 登记 buildNumber
  --download-url 登记下载地址
  --self-test    离线自检
  --help, -h     显示本帮助
凭据优先级:env HUAWEI_CONNECT_CLIENT_ID / _CLIENT_SECRET / _APP_ID > 密钥目录文件
退出码:0 全绿 / 1 缺凭据或对方拒绝 / 2 未判定`

export function parseArgs(argv) {
  const out = { phase: 'status', file: null, appId: process.env.HUAWEI_CONNECT_APP_ID ?? null, releaseType: 1, execute: false, json: false, register: false, selfTest: false, help: false, version: null, buildNumber: null, downloadUrl: null }
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i]
    if (a === '--help' || a === '-h') out.help = true
    else if (a === '--self-test') out.selfTest = true
    else if (a === '--phase') out.phase = argv[++i]
    else if (a === '--file') out.file = argv[++i]
    else if (a === '--app-id') out.appId = argv[++i]
    else if (a === '--release-type') out.releaseType = Number(argv[++i])
    else if (a === '--execute') out.execute = true
    else if (a === '--json') out.json = true
    else if (a === '--register') out.register = true
    else if (a === '--version') out.version = argv[++i]
    else if (a === '--build-number') out.buildNumber = argv[++i]
    else if (a === '--download-url') out.downloadUrl = argv[++i]
    else throw new Error(`未知参数: ${a}`)
  }
  if (!['status', 'upload', 'submit', 'verify', 'all'].includes(out.phase)) throw new Error(`--phase 只接受 status|upload|submit|verify|all,收到 ${out.phase}`)
  if (![1, 3].includes(out.releaseType)) throw new Error(`--release-type 只接受 1(全网)|3(分阶段),收到 ${out.releaseType}`)
  return out
}

/** 网络出口只在 --execute 时打开;默认 dry-run 把"要打哪几个端点、用什么凭据"先摆出来。 */
export function dryRunPlan({ args, creds, plan }) {
  const P = buildPaths({ clientId: creds?.value?.clientId ?? '<client_id>' })
  return {
    status: STATUS.FOUND,
    verdict: 'dry-run',
    detail: '未发任何请求(加 --execute 才出网)',
    calls: [
      creds?.status !== STATUS.FOUND
        ? `token 段跳过:凭据未成立(${creds?.detail ?? ''})`
        : creds?.value?.kind === 'service-account'
          ? '服务账号 JWT 本地签发(PS256,零出网)⇒ Authorization: Bearer 直用'
          : `${ENDPOINTS.token.method} ${P.token}`,
      args.phase !== 'upload' && args.phase !== 'submit' ? `${ENDPOINTS.appInfo.method} ${P.appInfo(args.appId ?? '<appId>')}` : `${ENDPOINTS.appInfo.method} ${P.appInfo(args.appId ?? '<appId>')} 跳过(phase=${args.phase})`,
      `${ENDPOINTS.uploadUrl.method} ${P.uploadUrl({ appId: args.appId ?? '<appId>', fileName: plan?.fileName ?? '<file>', contentLength: plan?.contentLength ?? '<bytes>', releaseType: args.releaseType ?? 1 })}`,
      'PUT <uploadUrl>(OBS 文件流)',
      `${ENDPOINTS.submit.method} ${P.submit({ appId: args.appId ?? '<appId>', releaseType: args.releaseType ?? 1 })}(${SUBMIT_CAVEAT})`,
    ],
    register: args.register ? buildRegisterArgv({ ...args, apply: false }).join(' ').replace(ROOT, '<repo>') : null,
  }
}

/**
 * 离线自检:只判纯函数与 dry-run 形态,零出网、零写盘。
 * 与 scripts/tests/submit-store-huawei.test.mjs 的用例同源(判据 import 自本文件,不复制)。
 */
function selfTest() {
  return runSelfTest([
    { name: 'H1 凭据件三形态:connect-api / hms-legacy / none 分得开', fn: () => { const c = parseCredentialText('client_id：1234567890\nclient_secret:SECRET-X\n应用ID:98765'); const l = parseCredentialText('应用ID:100000\n密钥:SECRET-X'); const n = parseCredentialText('乱七八糟一行'); return c.kind === 'connect-api' && c.clientId === '1234567890' && c.appId === '98765' && l.kind === 'hms-legacy' && n.kind === 'none' } },
    { name: 'H2 buildPaths 端点形态逐字钉住,submit 段有 app-submit 路径', fn: () => { const P = buildPaths({ clientId: 'cid-1' }); return P.token === 'https://connect-api.cloud.huawei.com/api/oauth2/v1/token' && P.appInfo('100000') === 'https://connect-api.cloud.huawei.com/api/publish/v2/app-info?appId=100000' && /upload-url\/for-obs\?appId=1&fileName=a\.apk&contentLength=2048&releaseType=1$/.test(P.uploadUrl({ appId: '1', fileName: 'a.apk', contentLength: '2048' })) && P.submit({ appId: '1' }) === 'https://connect-api.cloud.huawei.com/api/publish/v2/app-submit?appId=1&releaseType=1' && P.authHeaders('tok').Authorization === 'Bearer tok' && ENDPOINTS.submit.verified === true && ENDPOINTS.submit.path === '/api/publish/v2/app-submit' } },
    { name: 'H3 classifyRet:0/凭据类型错/非 JSON/5xx 四态不并桶', fn: () => classifyRet(200, '{"ret":{"code":0,"msg":"success"}}').status === STATUS.FOUND && classifyRet(200, '{"ret":{"code":205524993,"msg":"client token auth failed"}}').status === STATUS.MISSING && classifyRet(200, '{"ret":{"code":205524993}}').verdict === 'endpoint-ok-wrong-credential-type' && classifyRet(404, '<html>404</html>').status === STATUS.UNJUDGED && classifyRet(500, '{"ret":{"code":1,"msg":"boom"}}').status === STATUS.UNJUDGED },
    { name: 'H4 mergeVerify 上传+回读+提审齐才绿;只有上传 ⇒ uploaded-partial', fn: () => { const plan = { fileName: 'a.apk', contentLength: '1024', fileMd5: 'm1' }; const up = { status: STATUS.FOUND, objectId: 'OBJ', fileMd5: 'm1' }; const st = { status: STATUS.FOUND, releaseState: 4 }; const sub = { status: STATUS.FOUND }; const ok = mergeVerify({ plan, upload: up, status: st, submit: sub }); const partial = mergeVerify({ plan, upload: up, status: st }); const bad = mergeVerify({ plan, upload: { status: STATUS.FOUND, objectId: 'O', fileMd5: 'other' }, status: st, submit: sub }); return ok.status === STATUS.FOUND && ok.submit === 'submitted-for-review' && partial.status === STATUS.MISSING && partial.verdict === 'uploaded-partial' && bad.status === STATUS.MISSING && mergeVerify({ plan, upload: { status: STATUS.UNJUDGED }, status: null }).gaps.length === 2 } },
    { name: 'H5 登记腿 argv:store=huawei 恒在,dry-run 不带 --apply', fn: () => { const a = buildRegisterArgv({ version: '0.0.9', buildNumber: 26102816, downloadUrl: 'https://x/a.apk', apply: false }); return /--platform android --store huawei/.test(a.join(' ')) && !a.includes('--apply') && /--apply$/.test(buildRegisterArgv({ version: '1', apply: true }).join(' ')) } },
    { name: 'H6 parseArgs:未知参数/非法 phase/非法 release-type 抛错,--help 与 --self-test 被识别', fn: () => { try { parseArgs(['--nope']); return false } catch {} try { parseArgs(['--phase', 'bogus']); return false } catch {} try { parseArgs(['--release-type', '2']); return false } catch {} return parseArgs(['--help']).help === true && parseArgs(['--self-test']).selfTest === true && parseArgs(['--phase', 'submit']).phase === 'submit' && parseArgs(['--release-type', '3']).releaseType === 3 } },
    { name: 'H7 dry-run 五条计划且默认零出网,提审段已核实在册', fn: () => { const touched = globalThis.fetch; let n = 0; globalThis.fetch = async () => { n++; throw new Error('不该出网') }; try { const d = dryRunPlan({ args: { phase: 'status', appId: '1' }, creds: { status: STATUS.MISSING, detail: 'x', value: null }, plan: null }); return d.calls.length === 5 && /app-info\?appId=1$/.test(d.calls[1]) && /app-submit\?appId=1&releaseType=1/.test(d.calls[4]) && n === 0 } finally { globalThis.fetch = touched } } },
    { name: 'H8 凭据 env 形态脱敏:结论不含 secret 原文', fn: () => { const r = resolveCredentials({ env: { HUAWEI_CONNECT_CLIENT_ID: 'cid', HUAWEI_CONNECT_CLIENT_SECRET: 'SECRET-X', HUAWEI_CONNECT_APP_ID: 'aid' } }); return r.status === STATUS.FOUND && /sha8=/.test(r.detail) && !r.detail.includes('SECRET-X') } },
    { name: 'H9 无上传回执 ⇒ 提审段 MISSING 且零出网', fn: async () => { let n = 0; const r = await phaseSubmit({ fetchImpl: async () => { n++; throw new Error('不应出网') }, creds: { clientId: 'I', clientSecret: 'S' }, appId: '1', upload: null }); return n === 0 && r.status === STATUS.MISSING && r.verdict === 'no-upload-receipt' } },
    { name: 'H10 app-submit 打对端点且 ret.code=0 才算受理(不等于已上架)', fn: async () => { const seen = []; const fetchImpl = async (url, init) => { seen.push({ url, init }); if (url.includes('/oauth2/v1/token')) return { status: 200, text: async () => '{"access_token":"T1","expires_in":3600}' }; return { status: 200, text: async () => '{"ret":{"code":0,"msg":"success"}}' } }; const r = await phaseSubmit({ fetchImpl, creds: { clientId: 'I', clientSecret: 'S' }, appId: '100000', releaseType: 1, upload: { status: STATUS.FOUND, objectId: 'OBJ' } }); return r.status === STATUS.FOUND && r.verdict === 'submitted-for-review' && /app-submit\?appId=100000&releaseType=1$/.test(seen[1].url) && seen[1].init.headers.Authorization === 'Bearer T1' && /不等于已上架/.test(r.detail) } },
    { name: 'H11 服务账号 JSON 三态:齐字段/缺字段/非 JSON', fn: () => { const sa = parseServiceAccountJson('{"key_id":"k1","private_key":"PEM","sub_account":"100000001","token_uri":"https://oauth-login.cloud.huawei.com/oauth2/v3/token"}'); const miss = parseServiceAccountJson('{"key_id":"k1"}'); const txt = parseServiceAccountJson('client_id:1'); return sa.kind === 'service-account' && sa.keyId === 'k1' && sa.subAccount === '100000001' && sa.tokenUri === 'https://oauth-login.cloud.huawei.com/oauth2/v3/token' && miss.kind === 'none' && txt.kind === 'none' } },
    { name: 'H12 服务账号 JWT:header/payload 逐字 + PS256 签名可验', fn: () => { const kp = generateKeyPairSync('rsa', { modulusLength: 2048 }); const pem = kp.privateKey.export({ type: 'pkcs8', format: 'pem' }); const c = { kind: 'service-account', keyId: 'kid1', subAccount: '100000001', tokenUri: 'https://oauth-login.cloud.huawei.com/oauth2/v3/token', privateKey: pem }; const jwt = buildServiceAccountJwt(c, { now: 1700000000 }); const [h, p, s] = jwt.split('.'); const H = JSON.parse(Buffer.from(h, 'base64url')); const PL = JSON.parse(Buffer.from(p, 'base64url')); const ok = createVerify('sha256').update(`${h}.${p}`).verify({ key: kp.publicKey, padding: cryptoConstants.RSA_PKCS1_PSS_PADDING, saltLength: cryptoConstants.RSA_PSS_SALTLEN_DIGEST }, Buffer.from(s, 'base64url')); return H.alg === 'PS256' && H.kid === 'kid1' && H.typ === 'JWT' && PL.iss === '100000001' && PL.aud === c.tokenUri && PL.iat === 1700000000 && PL.exp === 1700003600 && ok === true } },
  ])
}

async function main() {
  const args = parseArgs(process.argv.slice(2))
  if (args.help) { console.log(HELP); return 0 }
  if (args.selfTest) return selfTest()
  const creds = resolveCredentials()
  const plan = args.file ? planUpload({ filePath: args.file }).plan : null
  if (!args.execute) {
    const d = dryRunPlan({ args, creds, plan })
    console.log(args.json ? JSON.stringify(d, null, 2) : `DRY-RUN huawei\n${d.calls.map((c) => `  - ${c}`).join('\n')}\n凭据:${creds.detail}`)
    return 0
  }
  if (creds.status !== STATUS.FOUND) {
    console.log(`${creds.status === STATUS.MISSING ? '缺件' : '未判定'}:${creds.detail}`)
    return creds.status === STATUS.MISSING ? 1 : 2
  }
  if (!args.appId) {
    console.log('未判定:AGC appId 取不到(env HUAWEI_CONNECT_APP_ID 或 --app-id)⇒ 查询端点以 appId 为键')
    return 2
  }
  const steps = []
  const releaseType = args.releaseType ?? 1
  let last = null
  if (args.phase === 'status') {
    last = await phaseStatus({ creds: creds.value, appId: args.appId })
    steps.push(last)
  } else if (args.phase === 'upload') {
    last = await phaseUpload({ creds: creds.value, appId: args.appId, plan, filePath: args.file })
    steps.push(last)
  } else {
    const statusRes = ['verify', 'all'].includes(args.phase) ? await phaseStatus({ creds: creds.value, appId: args.appId }) : null
    if (statusRes) steps.push(statusRes)
    const up = await phaseUpload({ creds: creds.value, appId: args.appId, plan, filePath: args.file })
    steps.push(up)
    const sub = await phaseSubmit({ creds: creds.value, appId: args.appId, releaseType, upload: up })
    steps.push(sub)
    if (args.phase === 'submit') last = sub
    else {
      last = mergeVerify({ plan, upload: up, status: statusRes ?? { status: STATUS.UNJUDGED }, submit: sub })
      steps.push(last)
    }
  }
  const v = last
  const verdicts = { found: 0, missing: 0, unjudged: 0 }
  for (const s of steps) verdicts[s.status === STATUS.FOUND ? 'found' : s.status === STATUS.MISSING ? 'missing' : 'unjudged']++
  console.log(args.json ? JSON.stringify({ steps, verdicts }, null, 2) : steps.map((s) => `[${s.status}] ${s.phase}: ${s.verdict} — ${s.detail ?? ''}`).join('\n'))
  if (v.status === STATUS.FOUND && args.register) {
    const r = spawnSync(process.execPath, buildRegisterArgv({ ...args, apply: true }), { cwd: ROOT, stdio: ['ignore', 'pipe', 'pipe'], windowsHide: true, encoding: 'utf8' })
    console.log(`登记腿 exit=${r.status ?? 'null'} ${String(r.stdout ?? '').trim().split(/\r?\n/).pop() ?? ''}`)
    return r.status === 0 ? 0 : 1
  }
  return v.status === STATUS.FOUND ? 0 : v.status === STATUS.MISSING ? 1 : 2
}

const isDirectRun = process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href
if (isDirectRun) {
  main()
    // Windows 上 undici keep-alive + AbortSignal.timeout 在 process.exit 瞬间会撞
    // libuv 的 UV_HANDLE_CLOSING 断言(输出已完整,纯退出期故障);留一拍让句柄收敛。
    .then(async (code) => {
      await new Promise((r) => setTimeout(r, 150))
      process.exit(code)
    })
    .catch((e) => {
      console.error(`❌ ${e?.message ?? e}\n${e?.stack ?? ''}`)
      process.exit(2)
    })
}

export const __test__ = { ENDPOINTS, RET_CODES, SUBMIT_CAVEAT, buildPaths, parseCredentialText, parseServiceAccountJson, buildServiceAccountJwt, resolveCredentials, classifyRet, fetchToken, phaseStatus, planUpload, phaseUpload, phaseSubmit, mergeVerify, buildRegisterArgv, parseArgs, dryRunPlan, STATUS }
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
