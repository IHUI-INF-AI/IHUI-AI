#!/usr/bin/env node
// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * google-play.mjs — Google Play androidpublisher v3 直连客户端(2026-11-08 立)
 *
 * 立因(现读,不是预防):`publish-stores.mjs` 的 Play 腿此前交给 EAS Submit ——
 * 那要 EXPO_TOKEN + eas-cli + 把服务账号私钥**落进工作树槽位**再删。三处脆弱点:
 * ① EXPO_TOKEN 与 Play 服务账号是两套身份,任一过期都恒红;② eas.json 的 track/releaseStatus
 * 只在 profile 里,代码读不到;③ 私钥即使跑完就删,也已经在盘上存在过。
 * 本文件把整条腿收成 **SA JSON → JWT → OAuth token → edits → bundle → track → commit**,
 * 全程私钥只在内存里签一次名,不落盘(§5d 的更强形态)。
 *
 * 端点出处(Google 官方 androidpublisher v3):
 *   POST  {API}/applications/{pkg}/edits                                  创建编辑
 *   POST  {UPLOAD}/applications/{pkg}/edits/{edit}/bundles?uploadType=media  上传 AAB
 *         (2026-11-08 实测:此端点只认 POST;发 PUT 会被路由层打回 404 "Could not find handler for this request",
 *          与包大小无关 —— 2 KB 探针同样 404,改 POST 后同一探针回 403 "APK is not a valid ZIP archive")
 *   PATCH {API}/applications/{pkg}/edits/{edit}/tracks/{track}            设置轨道与发布状态
 *   POST  {API}/applications/{pkg}/edits/{edit}:commit                    提交编辑
 *   DELETE {API}/applications/{pkg}/edits/{edit}                          失败时丢弃编辑(不悬挂)
 *   POST  https://oauth2.googleapis.com/token                             JWT 换 access_token
 *
 * 结论口径(行为,不是承诺):
 *   commit 成功 = 包与轨道变更**已落到 Play**;`releaseStatus=draft` 时它只是草稿,
 *   **不等于过审、不等于上线**。要直接进 alpha 测试轨道传 `--release-status completed`。
 *   本器任何分支都不打印 "published"/"live" 这类词。
 *
 * 纪律:
 *   - 默认 dry-run(零出网、零写盘);`--execute` 才发请求。
 *   - 凭据三态:found / missing(文件在而内容不可用)/ unjudged(密钥根解析不出、网络不可达)。
 *   - 秘密只出 sha8 / 长度;JWT、access_token、private_key 一律不进 detail(§5d)。
 *   - fetchImpl 全注入 ⇒ 离线测试可逐跳断言,绝不真实出网。
 *
 * 用法:
 *   node scripts/lib/store-uploaders/google-play.mjs --self-test
 *   node scripts/lib/store-uploaders/google-play.mjs [--file <aab>] [--package <pkg>]
 *        [--track alpha] [--release-status draft|completed] [--execute] [--json]
 *   凭据:env GOOGLE_PLAY_SERVICE_ACCOUNT_JSON(全文)> GOOGLE_PLAY_SERVICE_ACCOUNT_JSON_PATH > 密钥目录
 * 退出码:0 commit 成功 / 1 凭据或对方拒绝 / 2 未判定(网络不可达、形态取不到)
 */
import { createSign, generateKeyPairSync } from 'node:crypto'
import { readFileSync, statSync } from 'node:fs'
import { join } from 'node:path'
import { pathToFileURL } from 'node:url'

import { STATUS, playServiceKey, fp } from '../rn-release-credentials.mjs'
import { runSelfTest } from '../store-uploader-core.mjs'

const ROOT = join(import.meta.dirname, '..', '..', '..')

export const TOKEN_URL = 'https://oauth2.googleapis.com/token'
export const API_BASE = 'https://androidpublisher.googleapis.com/androidpublisher/v3'
export const UPLOAD_BASE = 'https://androidpublisher.googleapis.com/upload/androidpublisher/v3'
export const SCOPE = 'https://www.googleapis.com/auth/androidpublisher'
export const JWT_GRANT = 'urn:ietf:params:oauth:grant-type:jwt-bearer'

const b64url = (input) => Buffer.from(input).toString('base64url')

/** JWT claims(纯函数):iss/scope/aud/iat/exp。exp 最大 1h(Google 硬约束)。 */
export function buildJwtPayload({ clientEmail, now = Date.now(), ttlSec = 3600, scope = SCOPE } = {}) {
  const iat = Math.floor(now / 1000)
  return { iss: clientEmail, scope, aud: TOKEN_URL, iat, exp: iat + Math.min(Math.max(ttlSec, 60), 3600) }
}

/** RS256 签 JWT(私钥只在内存):header 固定 alg/typ,payload 走 buildJwtPayload。 */
export function signJwt({ clientEmail, privateKey, now = Date.now(), ttlSec = 3600, scope = SCOPE } = {}) {
  const header = b64url(JSON.stringify({ alg: 'RS256', typ: 'JWT' }))
  const payload = b64url(JSON.stringify(buildJwtPayload({ clientEmail, now, ttlSec, scope })))
  const signingInput = `${header}.${payload}`
  const sig = createSign('RSA-SHA256').update(signingInput).sign(privateKey)
  return `${signingInput}.${sig.toString('base64url')}`
}

/**
 * SA 凭据读取:沿用 playServiceKey 三态出口,再把 JSON 全文读进内存。
 * value.source=env-json 时原文就在 env 里;env-path/key-dir 时按 path 读。
 */
export function loadCredentials({ env = process.env, root } = {}) {
  const key = playServiceKey({ env, ...(root === undefined ? {} : { root }) })
  if (key.status !== STATUS.FOUND) return { ...key, value: null }
  let text = null
  try {
    if (key.value.source === 'env-json') text = String(env.GOOGLE_PLAY_SERVICE_ACCOUNT_JSON ?? '')
    else text = readFileSync(key.value.path, 'utf8')
  } catch (e) {
    return { status: STATUS.UNJUDGED, detail: `SA 内容读不到(${e?.code ?? e?.name})⇒ 不判"无凭据"`, value: null }
  }
  let j = null
  try {
    j = JSON.parse(text)
  } catch {
    return { status: STATUS.UNJUDGED, detail: 'SA JSON 解析失败 ⇒ 未判定', value: null }
  }
  if (!j.private_key || !j.client_email) return { status: STATUS.UNJUDGED, detail: 'SA 缺 private_key/client_email ⇒ 未判定', value: null }
  return {
    status: STATUS.FOUND,
    detail: `clientEmail=${j.client_email} key sha8=${fp(j.private_key)}(source=${key.value.source})`,
    value: { clientEmail: j.client_email, privateKey: j.private_key.replace(/\\n/g, '\n'), projectId: j.project_id ?? null, source: key.value.source },
  }
}

/** 响应判读:2xx=found / 401·403=missing(身份或权限)/ 5xx·非 JSON=unjudged / 其余 4xx=missing。 */
export function classifyGoogle(httpStatus, rawBody) {
  let data = null
  try {
    data = JSON.parse(String(rawBody ?? ''))
  } catch {
    if (httpStatus >= 200 && httpStatus < 300) return { status: STATUS.UNJUDGED, detail: `http=${httpStatus} 非 JSON ⇒ 形态未证`, data: null }
    data = null
  }
  const msg = String(data?.error?.message ?? data?.error_description ?? data?.error ?? '').slice(0, 160)
  if (httpStatus >= 200 && httpStatus < 300) return { status: STATUS.FOUND, detail: `http=${httpStatus}${msg ? ` ${msg}` : ''}`, data }
  if (httpStatus >= 500) return { status: STATUS.UNJUDGED, detail: `http=${httpStatus} ${msg}`, data }
  if (httpStatus === 401 || httpStatus === 403) return { status: STATUS.MISSING, detail: `http=${httpStatus} ${msg}(服务账号未授权该应用或 scope 不足)`, data }
  return { status: STATUS.MISSING, detail: `http=${httpStatus} ${msg}`, data }
}

const enc = (s) => encodeURIComponent(String(s ?? ''))

/** 端点单源(§22c):调用方不得再拼一份 URL。 */
export function endpoints({ packageName, editId, track } = {}) {
  const pkg = enc(packageName)
  return {
    edits: `${API_BASE}/applications/${pkg}/edits`,
    edit: `${API_BASE}/applications/${pkg}/edits/${enc(editId)}`,
    uploadBundle: `${UPLOAD_BASE}/applications/${pkg}/edits/${enc(editId)}/bundles?uploadType=media`,
    track: `${API_BASE}/applications/${pkg}/edits/${enc(editId)}/tracks/${enc(track)}`,
    commit: `${API_BASE}/applications/${pkg}/edits/${enc(editId)}:commit`,
    deleteEdit: `${API_BASE}/applications/${pkg}/edits/${enc(editId)}`,
  }
}

/** 申报单(纯函数):字节/sha256/包名一次算全,upload 与回执同基准。 */
export function planRelease({ aabPath, packageName, track = 'alpha', releaseStatus = 'draft', read = readFileSync, stat = statSync } = {}) {
  if (!aabPath) return { status: STATUS.MISSING, detail: '未给 AAB 产物(--file 或默认 bundle/release/app-release.aab)', plan: null }
  let st = null
  try {
    st = stat(aabPath)
  } catch (e) {
    return { status: STATUS.UNJUDGED, detail: `AAB 取不到(${e?.code ?? e?.name}):${aabPath}`, plan: null }
  }
  if (!st.size) return { status: STATUS.MISSING, detail: `AAB 0 字节:${aabPath}`, plan: null }
  if (!packageName) return { status: STATUS.MISSING, detail: 'packageName 取不到(app.json expo.android.package 或 --package)', plan: null }
  if (!['draft', 'completed', 'inProgress', 'halted'].includes(releaseStatus)) {
    return { status: STATUS.MISSING, detail: `releaseStatus 非法:${releaseStatus}(可选 draft|completed)`, plan: null }
  }
  const buf = read(aabPath)
  return {
    status: STATUS.FOUND,
    detail: `${String(aabPath).split(/[\\/]/).pop()} ${st.size}B pkg=${packageName} track=${track} status=${releaseStatus}`,
    plan: { aabPath: String(aabPath).replace(/\\/g, '/'), bytes: st.size, buf, packageName, track, releaseStatus },
  }
}

/** 轨道正文:versionCodes 必须是字符串数组;draft 时 userFraction 不传。 */
export function buildTrackBody({ versionCode, releaseStatus = 'draft', userFraction = null, releaseNotes = null, language = 'zh-CN' } = {}) {
  const release = { versionCodes: [String(versionCode)], status: releaseStatus }
  if (releaseStatus === 'inProgress' && userFraction !== null) release.userFraction = Number(userFraction)
  if (releaseNotes) release.releaseNotes = [{ language, text: String(releaseNotes).slice(0, 500) }]
  return { track: undefined, releases: [release] }
}

/** 换 token:JWT 换 access_token。400/401=凭据不被认;网络=未判定。 */
export async function fetchAccessToken({ fetchImpl = fetch, creds, now = Date.now(), timeoutMs = 20000 } = {}) {
  if (!creds?.clientEmail || !creds?.privateKey) return { status: STATUS.MISSING, detail: 'SA 身份字段缺失', token: null }
  let jwt = null
  try {
    jwt = signJwt({ clientEmail: creds.clientEmail, privateKey: creds.privateKey, now })
  } catch (e) {
    return { status: STATUS.MISSING, detail: `RS256 签名失败(${e?.code ?? e?.name})⇒ 私钥形态不对`, token: null }
  }
  try {
    const r = await fetchImpl(TOKEN_URL, {
      method: 'POST',
      headers: { 'content-type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({ grant_type: JWT_GRANT, assertion: jwt }).toString(),
      signal: AbortSignal.timeout(timeoutMs),
    })
    const c = classifyGoogle(r.status, await r.text())
    if (c.status !== STATUS.FOUND || !c.data?.access_token) {
      return { status: c.status === STATUS.FOUND ? STATUS.MISSING : c.status, detail: `token 端点:${c.detail}`, token: null }
    }
    return { status: STATUS.FOUND, detail: `access_token len=${String(c.data.access_token).length} expires=${c.data.expires_in ?? '?'}`, token: c.data.access_token }
  } catch (e) {
    return { status: STATUS.UNJUDGED, detail: `token 端点不可达(${e?.cause?.code ?? e?.name})⇒ 未判定`, token: null }
  }
}

async function callJson(fetchImpl, url, { method = 'GET', token, body = null, timeoutMs = 60000 } = {}) {
  try {
    const r = await fetchImpl(url, {
      method,
      headers: { authorization: `Bearer ${token}`, ...(body === null ? {} : { 'content-type': 'application/json' }) },
      ...(body === null ? {} : { body: JSON.stringify(body) }),
      signal: AbortSignal.timeout(timeoutMs),
    })
    return classifyGoogle(r.status, await r.text())
  } catch (e) {
    return { status: STATUS.UNJUDGED, detail: `${method} 不可达(${e?.cause?.code ?? e?.name})⇒ 未判定`, data: null }
  }
}

/** 失败时丢弃编辑:best-effort,不改变主结论。 */
async function discardEdit({ fetchImpl, token, packageName, editId }) {
  try {
    await fetchImpl(endpoints({ packageName, editId }).deleteEdit, {
      method: 'DELETE',
      headers: { authorization: `Bearer ${token}` },
      signal: AbortSignal.timeout(15000),
    })
    return true
  } catch {
    return false
  }
}

/**
 * 全链:token → create edit → upload bundle → patch track → commit。
 * 每跳都进 steps;任何非 found 立即停(不拿失败继续 commit)。commit 前失败会丢编辑。
 */
export async function publishBundle({ fetchImpl = fetch, creds, plan, timeoutMs = 120000, releaseNotes = null, userFraction = null } = {}) {
  const steps = []
  const stop = (step, res, extra = {}) => ({
    status: res.status,
    phase: 'publish',
    verdict: `${step}-${res.status}`,
    detail: `${step}:${res.detail}`,
    steps,
    editId: extra.editId ?? null,
    committed: false,
    versionCode: null,
  })
  if (!plan) return { status: STATUS.UNJUDGED, phase: 'publish', verdict: 'no-plan', detail: '申报单未成立', steps, committed: false, versionCode: null }

  const t = await fetchAccessToken({ fetchImpl, creds, timeoutMs })
  steps.push({ step: 'token', status: t.status, detail: t.detail })
  if (!t.token) return stop('token', t)

  const P = endpoints({ packageName: plan.packageName })
  const created = await callJson(fetchImpl, P.edits, { method: 'POST', token: t.token, body: {}, timeoutMs })
  steps.push({ step: 'create-edit', status: created.status, detail: created.detail })
  if (created.status !== STATUS.FOUND || !created.data?.id) return stop('create-edit', created)
  const editId = created.data.id

  let uploaded = null
  try {
    const r = await fetchImpl(endpoints({ packageName: plan.packageName, editId }).uploadBundle, {
      // androidpublisher v3 的媒体上传走 POST;PUT 在本端点没有 handler(实测 404,见文件头注)。
      method: 'POST',
      headers: { authorization: `Bearer ${t.token}`, 'content-type': 'application/octet-stream' },
      body: plan.buf,
      signal: AbortSignal.timeout(Math.max(timeoutMs, 300000)),
    })
    uploaded = classifyGoogle(r.status, await r.text())
  } catch (e) {
    uploaded = { status: STATUS.UNJUDGED, detail: `bundle 上传不可达(${e?.cause?.code ?? e?.name})⇒ 未判定`, data: null }
  }
  steps.push({ step: 'upload-bundle', status: uploaded.status, detail: uploaded.detail })
  if (uploaded.status !== STATUS.FOUND || uploaded.data?.versionCode === undefined) {
    const discarded = await discardEdit({ fetchImpl, token: t.token, packageName: plan.packageName, editId })
    return { ...stop('upload-bundle', uploaded, { editId }), discarded }
  }
  const versionCode = String(uploaded.data.versionCode)

  const body = { ...buildTrackBody({ versionCode, releaseStatus: plan.releaseStatus, releaseNotes, userFraction }), track: plan.track }
  const trackRes = await callJson(fetchImpl, endpoints({ packageName: plan.packageName, editId, track: plan.track }).track, { method: 'PATCH', token: t.token, body, timeoutMs })
  steps.push({ step: 'patch-track', status: trackRes.status, detail: trackRes.detail })
  if (trackRes.status !== STATUS.FOUND) {
    const discarded = await discardEdit({ fetchImpl, token: t.token, packageName: plan.packageName, editId })
    return { ...stop('patch-track', trackRes, { editId }), discarded, versionCode }
  }

  const commit = await callJson(fetchImpl, endpoints({ packageName: plan.packageName, editId }).commit, { method: 'POST', token: t.token, body: null, timeoutMs })
  steps.push({ step: 'commit', status: commit.status, detail: commit.detail })
  if (commit.status !== STATUS.FOUND) {
    const discarded = await discardEdit({ fetchImpl, token: t.token, packageName: plan.packageName, editId })
    return { ...stop('commit', commit, { editId }), discarded, versionCode }
  }

  return {
    status: STATUS.FOUND,
    phase: 'publish',
    verdict: `committed-${plan.releaseStatus}`,
    detail: `versionCode=${versionCode} track=${plan.track} status=${plan.releaseStatus} 已 commit;${plan.releaseStatus === 'draft' ? '草稿≠过审/上线' : '已进测试轨道,仍需商店审核与人工发布策略'}`,
    steps,
    editId,
    committed: true,
    versionCode,
  }
}

/** 读 packageName:app.json expo.android.package 优先,不回落到任何硬编码包名。 */
export function readPackageName({ rnDir = join(ROOT, 'apps', 'mobile-rn'), read = readFileSync } = {}) {
  try {
    return JSON.parse(read(join(rnDir, 'app.json'), 'utf8'))?.expo?.android?.package ?? null
  } catch {
    return null
  }
}

export function parseArgs(argv = []) {
  const out = { file: null, packageName: null, track: 'alpha', releaseStatus: 'draft', execute: false, json: false, selfTest: false, help: false, releaseNotes: null, userFraction: null }
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i]
    const val = () => {
      const v = argv[++i]
      if (v === undefined || v.startsWith('--')) throw new Error(`${a} 缺参数`)
      return v
    }
    if (a === '--file') out.file = val()
    else if (a === '--package') out.packageName = val()
    else if (a === '--track') out.track = val()
    else if (a === '--release-status') out.releaseStatus = val()
    else if (a === '--release-notes') out.releaseNotes = val()
    else if (a === '--user-fraction') out.userFraction = Number(val())
    else if (a === '--execute') out.execute = true
    else if (a === '--json') out.json = true
    else if (a === '--self-test') out.selfTest = true
    else if (a === '--help' || a === '-h') out.help = true
    else throw new Error(`未知参数: ${a}`)
  }
  if (!['alpha', 'beta', 'internal', 'production'].includes(out.track)) throw new Error(`--track 只接受 alpha|beta|internal|production,收到 ${out.track}`)
  if (!['draft', 'completed', 'inProgress', 'halted'].includes(out.releaseStatus)) throw new Error(`--release-status 只接受 draft|completed,收到 ${out.releaseStatus}`)
  return out
}

export function dryRunPlan({ args, creds, planR }) {
  const pkg = args.packageName ?? '<package>'
  const P = endpoints({ packageName: pkg, editId: '<editId>', track: args.track })
  return {
    status: creds?.status ?? STATUS.UNJUDGED,
    verdict: 'dry-run',
    detail: '未发任何请求(加 --execute 才出网)',
    credential: creds?.detail ?? null,
    artifact: planR?.detail ?? null,
    calls: [
      creds?.status === STATUS.FOUND ? `POST ${TOKEN_URL}(JWT grant,私钥仅在内存签名)` : `token 段跳过:凭据未成立(${creds?.detail ?? ''})`,
      planR?.status === STATUS.FOUND ? `POST ${P.edits}` : '创建编辑:跳过(申报单未成立)',
      planR?.status === STATUS.FOUND ? `POST ${P.uploadBundle}(${planR.plan.bytes}B)` : '上传 AAB:跳过',
      planR?.status === STATUS.FOUND ? `PATCH ${P.track}(status=${args.releaseStatus})` : '设置轨道:跳过',
      planR?.status === STATUS.FOUND ? `POST ${P.commit}` : '提交编辑:跳过',
    ],
  }
}

const HELP = `Google Play androidpublisher v3 直连客户端
用法:
  node scripts/lib/store-uploaders/google-play.mjs [--file <aab>] [--package <pkg>]
       [--track alpha|beta|internal|production] [--release-status draft|completed] [--execute] [--json]
  node scripts/lib/store-uploaders/google-play.mjs --self-test
凭据:env GOOGLE_PLAY_SERVICE_ACCOUNT_JSON(全文)> _PATH > 密钥目录 service_account JSON
默认 dry-run;--execute 才出网。commit 成功≠过审上线(draft 只是草稿)。`

async function selfTest() {
  const key = '-----BEGIN PRIVATE KEY-----TEST-----END PRIVATE KEY-----'
  return runSelfTest([
    { name: 'G1 JWT payload:iss/scope/aud/iat/exp 逐字,exp 不超 1h', fn: () => { const p = buildJwtPayload({ clientEmail: 'a@b.c', now: 1000000, ttlSec: 7200 }); return p.iss === 'a@b.c' && p.scope === SCOPE && p.aud === TOKEN_URL && p.iat === 1000 && p.exp === 4600 } },
    { name: 'G2 endpoints 编码包名与 editId,不拼第二份 URL', fn: () => { const e = endpoints({ packageName: 'zh.ai.sq', editId: 'E1', track: 'alpha' }); return e.edits === `${API_BASE}/applications/zh.ai.sq/edits` && e.uploadBundle === `${UPLOAD_BASE}/applications/zh.ai.sq/edits/E1/bundles?uploadType=media` && e.commit === `${API_BASE}/applications/zh.ai.sq/edits/E1:commit` && e.track === `${API_BASE}/applications/zh.ai.sq/edits/E1/tracks/alpha` } },
    { name: 'G3 classifyGoogle:2xx/401/403/5xx/非JSON 五态不并桶', fn: () => classifyGoogle(200, '{"id":"E"}').status === STATUS.FOUND && classifyGoogle(401, '{"error":{"message":"bad"}}').status === STATUS.MISSING && classifyGoogle(403, '{}').status === STATUS.MISSING && classifyGoogle(500, '{"error":{}}').status === STATUS.UNJUDGED && classifyGoogle(200, '<html>').status === STATUS.UNJUDGED },
    { name: 'G4 轨道正文 versionCodes 字符串;draft 不带 userFraction', fn: () => { const b = buildTrackBody({ versionCode: 26110713, releaseStatus: 'draft' }); const c = buildTrackBody({ versionCode: 1, releaseStatus: 'inProgress', userFraction: 0.1 }); return b.releases[0].versionCodes[0] === '26110713' && !('userFraction' in b.releases[0]) && c.releases[0].userFraction === 0.1 } },
    { name: 'G5 loadCredentials:坏 JSON/缺字段 ⇒ unjudged,不判无凭据;detail 不含私钥', fn: () => { const bad = loadCredentials({ env: { GOOGLE_PLAY_SERVICE_ACCOUNT_JSON: '{"type":"service_account"}' }, root: null }); return bad.status === STATUS.UNJUDGED && !String(bad.detail).includes(key) } },
    { name: 'G6 默认零出网:dryRunPlan 不调用 fetch', fn: () => { const touched = globalThis.fetch; let n = 0; globalThis.fetch = async () => { n++; throw new Error('不该出网') }; try { const d = dryRunPlan({ args: { track: 'alpha', releaseStatus: 'draft', packageName: null }, creds: { status: STATUS.MISSING, detail: 'x' }, planR: { status: STATUS.MISSING, detail: 'y' } }); return d.calls.length === 5 && n === 0 } finally { globalThis.fetch = touched } } },
    { name: 'G7 未给产物/0 字节/非法状态 都 MISSING 且点名', fn: () => planRelease({ aabPath: null }).status === STATUS.MISSING && planRelease({ aabPath: '/x.aab', stat: () => ({ size: 0 }) }).status === STATUS.MISSING && planRelease({ aabPath: '/x.aab', stat: () => ({ size: 1 }), packageName: 'p', releaseStatus: 'nope' }).status === STATUS.MISSING },
    { name: 'G8 失败不提交:upload 未 found 时 steps 无 commit 且编辑被丢弃', fn: async () => {
      const calls = []
      const fetchImpl = async (url, opts = {}) => {
        calls.push(`${(opts.method ?? 'GET')} ${url}`)
        if (url === TOKEN_URL) return { status: 200, text: async () => '{"access_token":"T","expires_in":3600}' }
        if (url.endsWith('/edits')) return { status: 200, text: async () => '{"id":"E1"}' }
        if (url.includes('/bundles')) return { status: 400, text: async () => '{"error":{"message":"bad bundle"}}' }
        if (url.endsWith('/E1') && opts.method === 'DELETE') return { status: 204, text: async () => '' }
        throw new Error(`unexpected ${url}`)
      }
      const creds = { clientEmail: 'a@b.c', privateKey: createTestKey() }
      const r = await publishBundle({ fetchImpl, creds, plan: { packageName: 'zh.ai.sq', track: 'alpha', releaseStatus: 'draft', bytes: 3, buf: Buffer.from('abc') } })
      return r.status === STATUS.MISSING && r.committed === false && !r.steps.some((s) => s.step === 'commit') && calls.some((c) => c.startsWith('DELETE ')) && r.detail.includes('bad bundle')
    } },
    { name: 'G9 全链成功:五跳有序且回执 versionCode 进结论', fn: async () => {
      const calls = []
      const fetchImpl = async (url, opts = {}) => {
        calls.push(`${opts.method} ${url}`)
        if (url === TOKEN_URL) return { status: 200, text: async () => '{"access_token":"T","expires_in":3600}' }
        if (url.endsWith('/edits')) return { status: 200, text: async () => '{"id":"E1"}' }
        if (url.includes('/bundles')) return { status: 200, text: async () => '{"versionCode":26110713}' }
        if (url.includes('/tracks/')) return { status: 200, text: async () => '{"track":"alpha"}' }
        if (url.includes(':commit')) return { status: 200, text: async () => '{"id":"E1"}' }
        throw new Error(`unexpected ${url}`)
      }
      const r = await publishBundle({ fetchImpl, creds: { clientEmail: 'a@b.c', privateKey: createTestKey() }, plan: { packageName: 'zh.ai.sq', track: 'alpha', releaseStatus: 'draft', bytes: 3, buf: Buffer.from('abc') } })
      return r.status === STATUS.FOUND && r.committed === true && r.versionCode === '26110713' && r.steps.map((s) => s.step).join(',') === 'token,create-edit,upload-bundle,patch-track,commit' && !/published|live/i.test(r.detail)
    } },
    { name: 'G10 parseArgs:非法 track/状态/未知开关都抛', fn: () => { let a = 0, b = 0, c = 0; try { parseArgs(['--track', 'prod']) } catch { a = 1 } try { parseArgs(['--release-status', 'live']) } catch { b = 1 } try { parseArgs(['--nope']) } catch { c = 1 } return a + b + c === 3 } },
  ])
}

function createTestKey() {
  // 离线测试用一次性 2048 位密钥(只存在于进程内存,不落盘)
  return generateKeyPairSync('rsa', { modulusLength: 2048, privateKeyEncoding: { type: 'pkcs8', format: 'pem' }, publicKeyEncoding: { type: 'spki', format: 'pem' } }).privateKey
}

async function main(argv = process.argv.slice(2)) {
  const args = parseArgs(argv)
  if (args.help) { console.log(HELP); return 0 }
  if (args.selfTest) return selfTest()
  const creds = loadCredentials()
  const packageName = args.packageName ?? readPackageName()
  const planR = planRelease({ aabPath: args.file, packageName, track: args.track, releaseStatus: args.releaseStatus })
  if (!args.execute) {
    const d = dryRunPlan({ args: { ...args, packageName }, creds, planR })
    console.log(args.json ? JSON.stringify(d, null, 2) : `DRY-RUN google-play\n${d.calls.map((c) => `  - ${c}`).join('\n')}\n凭据:${creds.detail}\n产物:${planR.detail}`)
    return planR.status === STATUS.MISSING || creds.status === STATUS.MISSING ? 1 : 2
  }
  if (creds.status !== STATUS.FOUND) { console.log(`${creds.status}:${creds.detail}`); return creds.status === STATUS.MISSING ? 1 : 2 }
  if (planR.status !== STATUS.FOUND) { console.log(`${planR.status}:${planR.detail}`); return planR.status === STATUS.MISSING ? 1 : 2 }
  const r = await publishBundle({ creds: creds.value, plan: planR.plan, releaseNotes: args.releaseNotes, userFraction: args.userFraction })
  console.log(args.json ? JSON.stringify(r, null, 2) : r.steps.map((s) => `[${s.status}] ${s.step}: ${s.detail}`).join('\n') + `\n${r.detail}`)
  return r.status === STATUS.FOUND ? 0 : r.status === STATUS.MISSING ? 1 : 2
}

const isDirectRun = process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href
if (isDirectRun) {
  main()
    .then((code) => process.exit(code))
    .catch((e) => { console.error(`❌ ${e?.stack ?? e}`); process.exit(2) })
}

export const __test__ = { TOKEN_URL, API_BASE, UPLOAD_BASE, SCOPE, buildJwtPayload, signJwt, loadCredentials, classifyGoogle, endpoints, planRelease, buildTrackBody, fetchAccessToken, publishBundle, readPackageName, parseArgs, dryRunPlan, STATUS }
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
