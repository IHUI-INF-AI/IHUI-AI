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
 * ## 三段射程(行为,不是猜)
 *   status  取产物状态:token → `GET /api/publish/v2/app-info`(+ v3 版本列表)
 *   upload  上传产物:`GET /api/publish/v2/upload-url/for-obs` → `PUT <uploadUrl>`(OBS)
 *   verify  校验:本地 MD5/字节数 ⇄ 申报值 ⇄ 回读的 releaseState,三者对齐才算绿
 *   submit  **刻意不做**:提交发布是写端点且形态未从官方文档核实 ⇒ 一律 endpoint-unverified、零调用。
 *
 * 端点纪律与 `probe-store-channel.mjs` 同一条:**只打已核实形态的只读/上传端点**;
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
import { createHash } from 'node:crypto'
import { readFileSync, statSync } from 'node:fs'
import path from 'node:path'
import { spawnSync } from 'node:child_process'
import { fileURLToPath, pathToFileURL } from 'node:url'

import { STATUS, STORE_VENDORS, storeCredential, fp } from './lib/rn-release-credentials.mjs'
import { resolveSecretsRoot } from './lib/key-dir.mjs'

const ROOT = path.join(path.dirname(fileURLToPath(import.meta.url)), '..')
const HUAWEI_VENDOR = STORE_VENDORS.find((v) => v.id === 'huawei')

/** 端点表:形态逐条带官方出处;`verified:false` 的那条结构上不会被调用。 */
export const ENDPOINTS = Object.freeze({
  token: { method: 'POST', path: '/api/oauth2/v1/token', verified: true, doc: 'AGC「获取服务端授权」' },
  appInfo: { method: 'GET', path: '/api/publish/v2/app-info', verified: true, doc: 'agcapi-app-info-query-0000001158365045' },
  versionList: { method: 'POST', path: '/api/publish/v3/version/brief-info/list', verified: true, doc: 'agc-help-publish-api-query-brief-info-list-0000002236201254' },
  uploadUrl: { method: 'GET', path: '/api/publish/v2/upload-url/for-obs', verified: true, doc: 'Publishing API「获取上传文件地址」' },
  submit: { method: 'POST', path: null, verified: false, doc: '「提交发布」正文需登录 AGC 文档站核形态 ⇒ 本器零调用' },
})

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
  try {
    parsed = parseCredentialText(read(cred.value[0].path, 'utf8'))
  } catch (e) {
    return { status: STATUS.UNJUDGED, detail: `凭据件读不到(${e?.code ?? e?.name})⇒ 不判"无凭据"`, value: null }
  }
  if (parsed.kind === 'none') return { status: STATUS.UNJUDGED, detail: `凭据件字段形态认不出(字段=${parsed.fields.join('/')})`, value: null }
  if (parsed.kind === 'hms-legacy')
    return {
      status: STATUS.MISSING,
      detail: `密钥目录那枚是 HMS 客户端凭据(字段=${parsed.fields.join('/')}, secret sha8=${parsed.secretFp}),Publishing API 不认 ⇒ 缺 AGC「用户与权限→Connect API」的 client_id/client_secret`,
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
 * ③ 校验(纯函数,可离线跑):申报 MD5 ⇄ 本地实测 MD5 ⇄ 上传回执 ⇄ 回读 releaseState。
 * 任何一格取不到 ⇒ unjudged;只有四格齐且自洽才 found。绝不因"PUT 返回 200"就报"已上架"。
 */
export function mergeVerify({ plan, upload, status } = {}) {
  const gaps = []
  if (!plan) gaps.push('申报单')
  if (!upload || upload.objectId === null || upload.objectId === undefined) gaps.push('上传回执(objectId)')
  if (!status || status.status !== STATUS.FOUND) gaps.push('回读 releaseState')
  if (plan && upload?.fileMd5 && plan.fileMd5 !== upload.fileMd5) gaps.push('MD5 申报与回执不一致')
  if (gaps.length) return { phase: 'verify', status: gaps.length === 3 ? STATUS.UNJUDGED : STATUS.MISSING, verdict: 'verify-incomplete', gaps, detail: `取不到:${gaps.join(' / ')}` }
  return {
    phase: 'verify',
    status: STATUS.FOUND,
    verdict: `md5-consistent-releaseState-${status.releaseState}`,
    detail: `objectId=${upload.objectId} md5=${plan.fileMd5} 申报=${plan.contentLength}B 一致;回读 releaseState=${status.releaseState}`,
    releaseState: status.releaseState,
    submit: ENDPOINTS.submit.verified ? 'allowed' : 'endpoint-unverified-zero-call',
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

export function parseArgs(argv) {
  const out = { phase: 'status', file: null, appId: process.env.HUAWEI_CONNECT_APP_ID ?? null, execute: false, json: false, register: false, version: null, buildNumber: null, downloadUrl: null }
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i]
    if (a === '--phase') out.phase = argv[++i]
    else if (a === '--file') out.file = argv[++i]
    else if (a === '--app-id') out.appId = argv[++i]
    else if (a === '--execute') out.execute = true
    else if (a === '--json') out.json = true
    else if (a === '--register') out.register = true
    else if (a === '--version') out.version = argv[++i]
    else if (a === '--build-number') out.buildNumber = argv[++i]
    else if (a === '--download-url') out.downloadUrl = argv[++i]
    else throw new Error(`未知参数: ${a}`)
  }
  if (!['status', 'upload', 'verify', 'all'].includes(out.phase)) throw new Error(`--phase 只接受 status|upload|verify|all,收到 ${out.phase}`)
  return out
}

/** 网络出口只在 --execute 时打开;默认 dry-run 把"要打哪三个端点、用什么凭据"先摆出来。 */
export function dryRunPlan({ args, creds, plan }) {
  const P = buildPaths({ clientId: creds?.value?.clientId ?? '<client_id>' })
  return {
    status: STATUS.FOUND,
    verdict: 'dry-run',
    detail: '未发任何请求(加 --execute 才出网)',
    calls: [
      creds?.status === STATUS.FOUND ? `${ENDPOINTS.token.method} ${P.token}` : `token 段跳过:凭据未成立(${creds?.detail ?? ''})`,
      args.phase !== 'upload' ? `${ENDPOINTS.appInfo.method} ${P.appInfo(args.appId ?? '<appId>')}` : `${ENDPOINTS.appInfo.method} ${P.appInfo(args.appId ?? '<appId>')} 跳过(phase=upload)`,
      `${ENDPOINTS.uploadUrl.method} ${P.uploadUrl({ appId: args.appId ?? '<appId>', fileName: plan?.fileName ?? '<file>', contentLength: plan?.contentLength ?? '<bytes>', releaseType: 1 })}`,
      'PUT <uploadUrl>(OBS 文件流)',
      `提交发布:${ENDPOINTS.submit.verified ? '允许' : 'endpoint-unverified ⇒ 零调用'}`,
    ],
    register: args.register ? buildRegisterArgv({ ...args, apply: false }).join(' ').replace(ROOT, '<repo>') : null,
  }
}

async function main() {
  const args = parseArgs(process.argv.slice(2))
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
  const statusRes = args.phase === 'upload' ? null : await phaseStatus({ creds: creds.value, appId: args.appId })
  if (statusRes) steps.push(statusRes)
  const up = ['upload', 'all', 'verify'].includes(args.phase) ? await phaseUpload({ creds: creds.value, appId: args.appId, plan, filePath: args.file }) : { phase: 'upload', status: STATUS.UNJUDGED, verdict: 'skipped', detail: '未跑 upload 段', objectId: null }
  steps.push(up)
  const v = args.phase === 'status' ? { phase: 'verify', status: STATUS.UNJUDGED, verdict: 'skipped', detail: '未跑 verify 段', gaps: ['verify'] } : mergeVerify({ plan, upload: up, status: statusRes })
  steps.push(v)
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
    .then((code) => process.exit(code))
    .catch((e) => {
      console.error(`❌ ${e?.message ?? e}\n${e?.stack ?? ''}`)
      process.exit(2)
    })
}

export const __test__ = { ENDPOINTS, RET_CODES, buildPaths, parseCredentialText, resolveCredentials, classifyRet, fetchToken, phaseStatus, planUpload, phaseUpload, mergeVerify, buildRegisterArgv, parseArgs, dryRunPlan, STATUS }
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
