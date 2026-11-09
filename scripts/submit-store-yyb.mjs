#!/usr/bin/env node
// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * submit-store-yyb.mjs — 腾讯应用宝「API 更新应用信息」客户端(2026-11-09 立)
 *
 * ## 立因与**官方硬约束**(这一家的边界和别人不一样)
 * 腾讯开放平台《API更新应用信息》正文的两条注意事项是**政策级**的,不是实现细节:
 *   ① **仅提供应用版本和基础信息更新功能,暂时不支持新应用发布**;
 *   ② **API 更新能力现仅支持开发者账号使用,子账号暂不支持**。
 * 也就是说:应用宝这一条腿**结构上不可能"凭据一到就自动首包上架"**。首包必须先在
 * `app.open.qq.com` 后台把应用接入并成功发布上线(官方"接入前准备工作 2.2:开发者需在
 * 腾讯应用开放平台先将需要更新的应用接入并成功发布上线"),之后 API 才接手版本更新。
 * ⇒ 本器把 `firstPublishManual: true` 写成硬事实,并提供 `--assume-first-published` 显式声明位:
 *   没这句声明时,upload/verify 段**拒绝执行**并指出后台通路(§0.8:不造跑不通的命令)。
 *
 * ## 端点出处
 *   查询详情 `POST https://p.open.qq.com/open_file/developer_api/query_app_detail`  官方章节 3.2
 *   上传信息 `POST …/get_file_upload_info`(回 `pre_sign_url` + `serial_number`)        官方章节 3.3
 *   应用更新 `POST …/update_app`(`deploy_type=1` 立即发布 + `apk64_file_serial_number`) 官方章节 3.4
 *   审核状态 3.5:**路径原件未在公开面核到** ⇒ verified:false ⇒ 零调用判未判定。
 *   字节上传到 `pre_sign_url` 的 HTTP 形态(是否 PUT/是否要表单)只证到"地址由对方下发"
 *   ⇒ 4xx 一律报**形态未证**(unjudged),不判"腾讯拒绝"。
 *   签名 官方 3.1.2:HmacSHA256(access_secret),除 sign 外全部参数 ASCII 升序 `k=v&`、不 URL 编码、小写 hex。
 *
 * ## 法定前置
 * 应用宝收国内 App 需 App 备案号 + 软著(生态侧实测口径"必须上传软著证书才可通过市场审核")
 * + 承诺函/安评材料 ⇒ 不在册即拒绝报 ready。
 *
 * 用法:
 *   node scripts/submit-store-yyb.mjs --self-test
 *   node scripts/submit-store-yyb.mjs                          # dry-run(默认零网络)
 *   node scripts/submit-store-yyb.mjs --phase status --execute
 *   node scripts/submit-store-yyb.mjs --phase upload --file <apk> --execute --assume-first-published
 *   凭据优先级:env YYB_USER_ID / YYB_ACCESS_SECRET / YYB_APP_ID > 密钥目录文件(§5d)
 * 退出码:0 全绿 / 1 缺件(含"首包未上线"这一型缺件)/ 2 未判定
 */
import { readFileSync } from 'node:fs'
import { createHmac } from 'node:crypto'
import { pathToFileURL } from 'node:url'

import { STATUS, STORE_VENDORS, storeCredential, fp } from './lib/rn-release-credentials.mjs'
import { channelOf, loadBundle, resolveArtifact, buildDryRun, gateStates, runSelfTest, unverifiedCall } from './lib/store-uploader-core.mjs'
import { resolveSecretsRoot } from './lib/key-dir.mjs'

const VENDOR = STORE_VENDORS.find((v) => v.id === 'yyb')
const PACKAGE_NAME = 'zh.ai.sq'
const YYB_DOC = 'wikinew.open.qq.com/#/iwiki/4015262492《API更新应用信息》'

/** 官方政策级约束:写进代码结构,不靠文档记忆。 */
export const POLICY = Object.freeze({
  firstPublishSupportedByApi: false,
  subAccountSupported: false,
  requiresAlreadyOnline: true,
  note: '①暂不支持新应用发布 ②仅开发者账号(子账号不支持) ⇒ 首包走 app.open.qq.com 后台,API 只接版本更新',
})

export const BASE = 'https://p.open.qq.com/open_file/developer_api'
export const ENDPOINTS = Object.freeze({
  queryDetail: { section: '3.2', path: '/query_app_detail', verified: true, doc: YYB_DOC },
  uploadInfo: { section: '3.3', path: '/get_file_upload_info', verified: true, doc: `${YYB_DOC} 3.3 获取文件上传信息(回 pre_sign_url/serial_number)` },
  appUpdate: { section: '3.4', path: '/update_app', verified: true, doc: `${YYB_DOC} 3.4 应用更新(deploy_type/apk64_file_serial_number)` },
  auditStatus: { section: '3.5', path: null, verified: false, doc: `${YYB_DOC} 3.5 路径原件未在公开面核到 ⇒ 零调用` },
})
export const UPLOAD_FILE_TYPE = 'apk'
export const DEPLOY_TYPE_IMMEDIATE = 1

export function parseCredentialText(text) {
  const pairs = String(text ?? '')
    .split(/\r?\n/)
    .map((l) => l.split(/[:：]/))
    .filter((m) => m.length >= 2)
    .map((m) => ({ k: m[0].trim(), v: m.slice(1).join(':').trim() }))
  const pick = (re) => (pairs.find((p) => re.test(p.k)) ?? {}).v ?? null
  const accessSecret = pick(/access[_\s-]?secret|密\s*钥|secret|appsecret/i)
  const userId = pick(/user[_\s-]?id|用\s*户\s*id|开发者\s*id|QQ号?/i)
  const appId = pick(/app[_\s-]?id|应\s*用\s*id/i)
  return { accessSecret, userId, appId, fields: pairs.map((p) => p.k), secretFp: fp(accessSecret) }
}

/** 三枚齐才算在位:user_id(主账号)/ access_secret / app_id 各自缺都要点名。 */
export function resolveCredentials({ env = process.env, read = readFileSync, root = resolveSecretsRoot() } = {}) {
  if (env.YYB_USER_ID && env.YYB_ACCESS_SECRET) {
    return { status: STATUS.FOUND, detail: `env 齐备(user_id=${env.YYB_USER_ID} secret sha8=${fp(env.YYB_ACCESS_SECRET)})`, value: { userId: env.YYB_USER_ID, accessSecret: env.YYB_ACCESS_SECRET, appId: env.YYB_APP_ID ?? null } }
  }
  const cred = storeCredential(VENDOR, { root })
  if (cred.status !== STATUS.FOUND) return { status: cred.status, detail: `密钥目录:${cred.detail}`, value: null }
  let p
  try {
    p = parseCredentialText(read(cred.value[0].path, 'utf8'))
  } catch (e) {
    return { status: STATUS.UNJUDGED, detail: `凭据件读不到(${e?.code ?? e?.name})⇒ 不判"无凭据"`, value: null }
  }
  const miss = [['userId', 'user_id(开发者主账号,子账号不被支持)'], ['accessSecret', 'access_secret(账户管理→API发布接口→申请开通)']].filter(([k]) => !p[k]).map(([, label]) => label)
  if (miss.length) return { status: STATUS.MISSING, detail: `凭据件缺 ${miss.join(' + ')}(字段=${p.fields.join('/')})`, value: null }
  return { status: STATUS.FOUND, detail: `user_id=${p.userId} secret sha8=${p.secretFp} app_id=${p.appId ?? '未在册(更新段以 app_id 为键 ⇒ 需从后台取)'}`, value: { userId: p.userId, accessSecret: p.accessSecret, appId: p.appId } }
}

/**
 * 腾讯侧签名(官方 3.1.2「签名机制」):除 sign 外全部参数按 key ASCII 升序、`k=v&` 拼接(**不做 URL 编码**),
 * HmacSHA256(access_secret) 小写 hex。回"签名错误"类码时仍报形态未证,不判"腾讯拒绝"。
 */
export function signYyb({ params, secret, algo = 'sha256' } = {}) {
  if (!secret) return { status: STATUS.UNJUDGED, sign: null, detail: 'access_secret 取不到 ⇒ 不签(不判"腾讯拒绝")' }
  const base = Object.entries(params)
    .filter(([k, v]) => k !== 'sign' && v !== null && v !== undefined)
    .sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0))
    .map(([k, v]) => `${k}=${v}`)
    .join('&')
  try {
    return { status: STATUS.FOUND, sign: createHmac(algo, secret).update(base, 'utf8').digest('hex'), detail: 'HmacSHA256(k=v& ASCII 升序,不 URL 编码;官方 3.1.2)' }
  } catch (e) {
    return { status: STATUS.UNJUDGED, sign: null, detail: `签算抛错(${e?.message?.slice(0, 50)})⇒ 未判定` }
  }
}

/** 公共参数(user_id + timestamp 秒):3.2/3.3/3.4 共用同一份,不各拼一套。 */
export function baseParams({ creds, timestamp = Math.floor(Date.now() / 1000) }) {
  return { user_id: String(creds?.userId ?? ''), timestamp: String(timestamp) }
}

/** 3.3 获取文件上传信息:回 pre_sign_url(落文件用的预签名地址)+ serial_number(更新时的文件凭证)。 */
export function uploadInfoCall({ creds, packageName = PACKAGE_NAME, appId = null, fileName, fileType = UPLOAD_FILE_TYPE, timestamp = Math.floor(Date.now() / 1000) }) {
  const params = { ...baseParams({ creds, timestamp }), pkg_name: packageName, app_id: String(appId ?? creds?.appId ?? ''), file_type: fileType, file_name: fileName }
  const s = signYyb({ params, secret: creds?.accessSecret })
  if (s.status !== STATUS.FOUND) return { status: s.status, detail: s.detail, url: null, form: null }
  return { status: STATUS.FOUND, url: `${BASE}${ENDPOINTS.uploadInfo.path}`, method: 'POST', headers: { 'content-type': 'application/x-www-form-urlencoded' }, form: { ...params, sign: s.sign } }
}

/** 3.4 应用更新:deploy_type=1(立即发布)+ apk64_file_serial_number(3.3 回执) + 版本/说明。 */
export function updateAppCall({ creds, packageName = PACKAGE_NAME, appId = null, serialNumber, versionName = null, versionCode = null, deployType = DEPLOY_TYPE_IMMEDIATE, updateDesc = null, timestamp = Math.floor(Date.now() / 1000) }) {
  const params = {
    ...baseParams({ creds, timestamp }),
    pkg_name: packageName,
    app_id: String(appId ?? creds?.appId ?? ''),
    apk64_file_serial_number: String(serialNumber ?? ''),
    deploy_type: String(deployType),
  }
  if (versionName) params.version_name = String(versionName)
  if (versionCode) params.version_code = String(versionCode)
  if (updateDesc) params.update_desc = String(updateDesc)
  const s = signYyb({ params, secret: creds?.accessSecret })
  if (s.status !== STATUS.FOUND) return { status: s.status, detail: s.detail, url: null, form: null }
  return { status: STATUS.FOUND, url: `${BASE}${ENDPOINTS.appUpdate.path}`, method: 'POST', headers: { 'content-type': 'application/x-www-form-urlencoded' }, form: { ...params, sign: s.sign } }
}

export function queryDetailCall({ creds, packageName = PACKAGE_NAME, appId = null, timestamp = Math.floor(Date.now() / 1000) }) {
  const ch = channelOf('yyb')
  if (ch.status !== STATUS.FOUND) return { status: STATUS.UNJUDGED, detail: ch.detail, url: null }
  const params = { ...baseParams({ creds, timestamp }), pkg_name: packageName, app_id: String(appId ?? creds?.appId ?? '') }
  const s = signYyb({ params, secret: creds?.accessSecret })
  return { status: STATUS.FOUND, url: ch.channel.probe().url, method: 'POST', headers: { 'content-type': 'application/x-www-form-urlencoded' }, form: { ...params, sign: s.sign ?? '' }, signState: s }
}

/** 应用宝回包:ret/code/result 三形都可能,统一按"结构化才算判得出"。 */
export function classifyYyb(httpStatus, rawBody) {
  let j = null
  try {
    j = JSON.parse(String(rawBody ?? ''))
  } catch {
    return { status: STATUS.UNJUDGED, verdict: 'non-json-response', detail: `http=${httpStatus} 非 JSON ⇒ 我形态错(p.open.qq.com 常回登录 302 HTML),不据此下结论`, data: null }
  }
  if (httpStatus >= 500) return { status: STATUS.UNJUDGED, verdict: 'server-error', detail: `http=${httpStatus}`, data: j }
  const code = j?.ret ?? j?.code ?? j?.result ?? j?.error_code ?? null
  const msg = String(j?.msg ?? j?.message ?? j?.error_description ?? '').slice(0, 120)
  if (code === 0 || code === '0') {
    const d = j?.data ?? j
    return { status: STATUS.FOUND, verdict: d?.appInfo || d?.app_id || d?.pkg_name ? 'app-detail-resolved' : 'ok-no-detail-field', detail: `http=${httpStatus} ret=0`, data: d }
  }
  if (/sign|签名/i.test(msg)) return { status: STATUS.UNJUDGED, verdict: 'signature-shape-unverified', detail: `http=${httpStatus} code=${code} msg="${msg}" ⇒ 签算拼接维未证,不判"腾讯拒绝"`, data: j }
  if (code === null) return { status: STATUS.UNJUDGED, verdict: 'no-code-field', detail: `http=${httpStatus} 回体没有 ret/code/result ⇒ 形态未证`, data: j }
  return { status: STATUS.MISSING, verdict: `code-${code}`, detail: `http=${httpStatus} code=${code} msg="${msg}"`, data: j }
}

export async function phaseStatus({ fetchImpl = fetch, creds, packageName = PACKAGE_NAME, timeoutMs = 20000 }) {
  const q = queryDetailCall({ creds, packageName })
  if (q.status !== STATUS.FOUND) return { phase: 'status', status: q.status, verdict: 'endpoint-unverified', detail: q.detail }
  if (q.signState.status !== STATUS.FOUND) return { phase: 'status', status: q.signState.status, verdict: 'sign-unverified', detail: q.signState.detail }
  try {
    const r = await fetchImpl(q.url, { method: 'POST', headers: q.headers, body: new URLSearchParams(q.form).toString(), signal: AbortSignal.timeout(timeoutMs) })
    return { phase: 'status', ...classifyYyb(r.status, await r.text()) }
  } catch (e) {
    return { phase: 'status', status: STATUS.UNJUDGED, verdict: 'fetch-error', detail: `p.open.qq.com 不可达(${e?.cause?.code ?? e?.name})⇒ 未判定` }
  }
}

/**
 * 上传段(Y-3 已核实):3.3 get_file_upload_info → PUT pre_sign_url → 拿 serial_number。
 * 首包闸仍然有(官方政策):未显式声明首包已上线 ⇒ MISSING 并给后台通路。
 * 字节上传的 HTTP 形态(预签名地址该用 PUT 还是表单)公开面只证到"pre_sign_url 由对方下发"
 * ⇒ 4xx 一律报 **形态未证(unjudged)**,不据此判"腾讯拒绝"。
 */
export async function phaseUpload({ fetchImpl = fetch, creds, packageName = PACKAGE_NAME, appId = null, plan = null, filePath = null, assumeFirstPublished = false, timeoutMs = 120000, read = readFileSync } = {}) {
  if (POLICY.firstPublishSupportedByApi) throw new Error('官方政策若变更,须重新取证后再放开本分支')
  if (!assumeFirstPublished) {
    return { phase: 'upload', status: STATUS.MISSING, verdict: 'first-publish-not-declared', calls: [], detail: `应用宝首包**不能**由 API 发布(官方注意事项①)⇒ 请先在 app.open.qq.com 后台把该包名接入并成功上线,再回本器加 --assume-first-published 走版本更新` }
  }
  if (!plan) return { phase: 'upload', status: STATUS.UNJUDGED, verdict: 'no-plan', detail: '申报单未成立(产物缺失/0 字节)⇒ 不猜上传' }
  const info = uploadInfoCall({ creds, packageName, appId, fileName: plan.fileName })
  if (info.status !== STATUS.FOUND) return { phase: 'upload', status: info.status, verdict: 'sign-unavailable', detail: info.detail }
  const r1 = await fetchImpl(info.url, { method: info.method, headers: info.headers, body: new URLSearchParams(info.form).toString(), signal: AbortSignal.timeout(timeoutMs) })
    .then(async (x) => ({ s: x.status, b: await x.text() }))
    .catch(() => null)
  if (!r1) return { phase: 'upload', status: STATUS.UNJUDGED, verdict: 'fetch-error', detail: 'get_file_upload_info 不可达 ⇒ 未判定' }
  const c1 = classifyYyb(r1.s, r1.b)
  if (c1.status !== STATUS.FOUND) return { phase: 'upload', ...c1 }
  const data = c1.data ?? {}
  const preSignUrl = data.pre_sign_url ?? data.preSignUrl ?? null
  const serialNumber = String(data.serial_number ?? data.serialNumber ?? '')
  if (!preSignUrl || !serialNumber) {
    return { phase: 'upload', status: STATUS.UNJUDGED, verdict: 'no-pre-sign-url-or-serial', detail: `回包缺 ${preSignUrl ? '' : 'pre_sign_url '}${serialNumber ? '' : 'serial_number'} ⇒ 形态未证`, data }
  }
  const put = await fetchImpl(preSignUrl, { method: 'PUT', headers: { 'content-type': 'application/octet-stream' }, body: read(filePath ?? plan.path), signal: AbortSignal.timeout(timeoutMs) })
    .then(async (x) => ({ s: x.status, b: await x.text() }))
    .catch(() => null)
  if (!put) return { phase: 'upload', status: STATUS.UNJUDGED, verdict: 'fetch-error', detail: 'pre_sign_url 不可达 ⇒ 未判定', serialNumber }
  if (put.s >= 400) {
    return { phase: 'upload', status: STATUS.UNJUDGED, verdict: 'upload-shape-unverified', detail: `PUT pre_sign_url http=${put.s} ⇒ 字节上传形态(是否 PUT/是否要表单)公开面未证,不判"腾讯拒绝"`, serialNumber }
  }
  return { phase: 'upload', status: STATUS.FOUND, verdict: 'file-uploaded-serial-issued', serialNumber, uploadedUrl: preSignUrl, fileMd5: plan.fileMd5, detail: `serial_number=${serialNumber} 文件已落预签名地址(http=${put.s})` }
}

/**
 * 提审段(3.4 应用更新):必须已有 3.3 的 serial_number 才发;deploy_type=1 表示审核通过立即发布。
 * code=0 只代表"更新请求已受理",不等于已上架。
 */
export async function phaseSubmit({ fetchImpl = fetch, creds, packageName = PACKAGE_NAME, appId = null, upload = null, versionName = null, versionCode = null, updateDesc = null, timeoutMs = 30000 } = {}) {
  if (!upload || upload.status !== STATUS.FOUND || !upload.serialNumber) {
    return { phase: 'submit', status: upload?.status === STATUS.UNJUDGED ? STATUS.UNJUDGED : STATUS.MISSING, verdict: 'no-upload-receipt', detail: '无 3.3 serial_number ⇒ 缺前置,不冒充提审' }
  }
  const call = updateAppCall({ creds, packageName, appId, serialNumber: upload.serialNumber, versionName, versionCode, updateDesc })
  if (call.status !== STATUS.FOUND) return { phase: 'submit', status: call.status, verdict: 'sign-unavailable', detail: call.detail }
  const r = await fetchImpl(call.url, { method: call.method, headers: call.headers, body: new URLSearchParams(call.form).toString(), signal: AbortSignal.timeout(timeoutMs) })
    .then(async (x) => ({ s: x.status, b: await x.text() }))
    .catch(() => null)
  if (!r) return { phase: 'submit', status: STATUS.UNJUDGED, verdict: 'fetch-error', detail: 'update_app 不可达 ⇒ 未判定' }
  const c = classifyYyb(r.s, r.b)
  if (c.status !== STATUS.FOUND) return { phase: 'submit', ...c }
  return { phase: 'submit', status: STATUS.FOUND, verdict: 'submitted-for-review', detail: `update_app code=0(deploy_type=${DEPLOY_TYPE_IMMEDIATE} 立即发布;serial=${upload.serialNumber})⇒ 已受理更新,审核通过后发布,不等于此刻已上架` }
}

/** 绿的条件:上传回执(serial)+ 提审回执都成立;只有上传 ⇒ uploaded-partial,绝不冒充已上架。 */
export function mergeVerify({ plan, upload, submit = null } = {}) {
  const gaps = []
  if (!plan) gaps.push('申报单')
  if (!upload || upload.status !== STATUS.FOUND) gaps.push('上传回执(serial_number)')
  if (gaps.length) return { phase: 'verify', status: gaps.length === 2 ? STATUS.UNJUDGED : STATUS.MISSING, verdict: 'verify-incomplete', gaps, detail: `取不到:${gaps.join(' / ')}` }
  if (!submit || submit.status !== STATUS.FOUND) {
    return { phase: 'verify', status: STATUS.MISSING, verdict: 'uploaded-partial', detail: `文件已落应用宝(serial=${upload.serialNumber}),但更新回执未成立(${submit?.detail ?? '未执行'})⇒ uploaded-partial`, submit: 'not-submitted' }
  }
  return { phase: 'verify', status: STATUS.FOUND, verdict: 'submitted-for-review', detail: `md5=${plan.fileMd5} ${plan.contentLength}B 已落应用宝(serial=${upload.serialNumber});更新回执 code=0 ⇒ 进入审核;deploy_type=1 审核通过后发布,不等于此刻已上架` }
}

export const HELP = `腾讯应用宝提交器(首包不能由 API 发布;3.3/3.4 上传与更新已核实在册)
用法:
  node scripts/submit-store-yyb.mjs [--phase status|upload|submit|verify|all] [--file <apk>] [--package <包名>]
       [--app-id <id>] [--version-name <名>] [--version-code <码>] [--update-desc <说明>]
       [--execute] [--json] [--assume-first-published]
  node scripts/submit-store-yyb.mjs --self-test
开关:
  --phase                  阶段(status 默认)
  --file                   显式提交物路径
  --package                包名(默认取 app.json)
  --app-id                 腾讯应用开放平台 app_id(缺省读凭据/YYB_APP_ID)
  --version-name           更新申报 versionName
  --version-code           更新申报 versionCode
  --update-desc            更新说明
  --execute                真出网(缺省 dry-run 零请求)
  --json                   JSON 输出
  --self-test              离线自检
  --assume-first-published 声明首包已在后台人工上线(官方:API 只接版本更新)
  --help, -h               显示本帮助
退出码:0 全绿 / 1 缺件(含"首包未上线")/ 2 未判定`

export function parseArgs(argv) {
  const o = { phase: 'status', file: null, execute: false, json: false, selfTest: false, help: false, assumeFirstPublished: false, packageName: PACKAGE_NAME, appId: process.env.YYB_APP_ID ?? null, versionName: null, versionCode: null, updateDesc: null }
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i]
    if (a === '--help' || a === '-h') o.help = true
    else if (a === '--phase') o.phase = argv[++i]
    else if (a === '--file') o.file = argv[++i]
    else if (a === '--package') o.packageName = argv[++i]
    else if (a === '--app-id') o.appId = argv[++i]
    else if (a === '--version-name') o.versionName = argv[++i]
    else if (a === '--version-code') o.versionCode = argv[++i]
    else if (a === '--update-desc') o.updateDesc = argv[++i]
    else if (a === '--execute') o.execute = true
    else if (a === '--json') o.json = true
    else if (a === '--self-test') o.selfTest = true
    else if (a === '--assume-first-published') o.assumeFirstPublished = true
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
  const bundle = loadBundle({ vendor: 'yyb' })
  const ch = channelOf('yyb')
  const gates = gateStates({ creds, artifact, bundle, channel: { status: ch.status, detail: ch.channel?.label ?? ch.detail } })

  if (!args.execute) {
    const q = queryDetailCall({ creds: creds.value ?? {}, packageName: args.packageName })
    const d = buildDryRun({
      vendorId: 'yyb',
      creds,
      artifact,
      bundle,
      calls: [
        { verified: ENDPOINTS.queryDetail.verified, method: 'POST', url: q.url ?? '<query_app_detail>' },
        { verified: ENDPOINTS.uploadInfo.verified, method: 'POST', url: `${BASE}${ENDPOINTS.uploadInfo.path}`, intent: '取 pre_sign_url + serial_number' },
        { verified: false, intent: 'PUT <pre_sign_url>(字节上传形态公开面只证到"地址由对方下发",失败一律判未判定)' },
        { verified: ENDPOINTS.appUpdate.verified, method: 'POST', url: `${BASE}${ENDPOINTS.appUpdate.path}`, intent: `deploy_type=${DEPLOY_TYPE_IMMEDIATE}(立即发布)+ apk64_file_serial_number` },
        { verified: false, intent: '3.5 查询审核状态 ⇒ 路径未证,零调用' },
        { verified: false, intent: '新应用发布:官方注意事项①明确不支持 ⇒ 首包必须走 app.open.qq.com 后台' },
      ],
    })
    d.policy = POLICY.note
    console.log(args.json ? JSON.stringify({ ...d, gates: gates.rows }, null, 2) : `DRY-RUN yyb(默认零网络)\n${d.calls.map((c) => `  - ${c}`).join('\n')}\n  - 政策:${d.policy}\n${gates.rows.map((r) => `  [${r.status}] ${r.k}: ${r.detail}`).join('\n')}`)
    return gates.exit
  }
  if (creds.status !== STATUS.FOUND) return console.log(`${creds.status === STATUS.MISSING ? '缺件' : '未判定'}:${creds.detail}`), creds.status === STATUS.MISSING ? 1 : 2
  const plan = artifact.value
    ? { fileName: String(artifact.value.path).split(/[\\/]/).pop(), path: artifact.value.path, bytes: artifact.value.bytes, contentLength: String(artifact.value.bytes), fileMd5: artifact.value.md5 }
    : null
  const steps = []
  if (args.phase !== 'upload' && args.phase !== 'submit') steps.push(await phaseStatus({ creds: creds.value, packageName: args.packageName }))
  if (['upload', 'submit', 'verify', 'all'].includes(args.phase)) {
    const up = await phaseUpload({ creds: creds.value, packageName: args.packageName, appId: args.appId, plan, filePath: artifact.value?.path, assumeFirstPublished: args.assumeFirstPublished })
    steps.push(up)
    if (['submit', 'verify', 'all'].includes(args.phase)) {
      const sub = await phaseSubmit({ creds: creds.value, packageName: args.packageName, appId: args.appId, upload: up, versionName: args.versionName, versionCode: args.versionCode, updateDesc: args.updateDesc })
      steps.push(sub)
      if (args.phase === 'all' || args.phase === 'verify') steps.push(mergeVerify({ plan, upload: up, submit: sub }))
    }
  }
  console.log(args.json ? JSON.stringify({ steps }, null, 2) : steps.map((s) => `[${s.status}] ${s.phase}: ${s.verdict ?? '-'} — ${s.detail ?? ''}`).join('\n'))
  const st = steps.map((s) => s.status)
  return st.includes(STATUS.UNJUDGED) ? 2 : st.includes(STATUS.MISSING) ? 1 : 0
}

function selfTest() {
  return runSelfTest([
    { name: 'Y1 官方政策写进结构:firstPublishSupportedByApi=false 且子账号不支持', fn: () => POLICY.firstPublishSupportedByApi === false && POLICY.subAccountSupported === false && POLICY.requiresAlreadyOnline === true },
    { name: 'Y2 端点表:3.2/3.3/3.4 已核实,仅 3.5 未核实且无 path', fn: () => ENDPOINTS.queryDetail.verified === true && ENDPOINTS.uploadInfo.verified === true && ENDPOINTS.appUpdate.verified === true && ENDPOINTS.auditStatus.verified === false && ENDPOINTS.auditStatus.path === null && ENDPOINTS.uploadInfo.path === '/get_file_upload_info' && ENDPOINTS.appUpdate.path === '/update_app' },
    { name: 'Y3 未声明首包已上线 ⇒ MISSING 并给后台通路(不是"未判定"糊过去)', fn: async () => { const r = await phaseUpload({ assumeFirstPublished: false }); return r.status === STATUS.MISSING && r.verdict === 'first-publish-not-declared' && r.calls.length === 0 && /app\.open\.qq\.com/.test(r.detail) } },
    { name: 'Y4 已声明首包但无申报单 ⇒ 未判定(不伪造上传);3.5 未核实 ⇒ 零调用', fn: async () => { const r = await phaseUpload({ assumeFirstPublished: true, plan: null }); return r.status === STATUS.UNJUDGED && r.verdict === 'no-plan' && ENDPOINTS.auditStatus.verified === false && unverifiedCall({ phase: 'x', reason: 'r', doc: 'd' }).calls.length === 0 } },
    { name: 'Y5 signYyb 缺 secret ⇒ 未判定不签;有 secret ⇒ 稳定 hex', fn: () => { const bad = signYyb({ params: { a: 1 }, secret: '' }); const a = signYyb({ params: { b: 2, a: 1 }, secret: 'S' }); const b = signYyb({ params: { a: 1, b: 2 }, secret: 'S' }); return bad.status === STATUS.UNJUDGED && /^[0-9a-f]{64}$/.test(a.sign) && a.sign === b.sign } },
    { name: 'Y6 查询请求体永不带 access_secret 原文', fn: () => { const q = queryDetailCall({ creds: { userId: 'U', accessSecret: 'SECRET-DO-NOT-LEAK-0123456789', appId: 'A' }, packageName: PACKAGE_NAME }); const body = new URLSearchParams(q.form).toString(); return q.url === 'https://p.open.qq.com/open_file/developer_api/query_app_detail' && !body.includes('DO-NOT-LEAK') && body.includes('user_id=U') && body.includes('pkg_name=zh.ai.sq') } },
    { name: 'Y7 ret=0 且有明细 ⇒ FOUND;ret=0 无明细 ⇒ FOUND 但点名没解析到', fn: () => { const ok = classifyYyb(200, '{"ret":0,"data":{"appInfo":{"app_id":"9"}}}'); const none = classifyYyb(200, '{"ret":0,"data":{}}'); return ok.status === STATUS.FOUND && ok.verdict === 'app-detail-resolved' && none.status === STATUS.FOUND && none.verdict === 'ok-no-detail-field' } },
    { name: 'Y8 签名类报错 ⇒ 未判定(拼接维未证,不判"腾讯拒绝")', fn: () => classifyYyb(200, '{"ret":10001,"msg":"invalid sign"}').status === STATUS.UNJUDGED },
    { name: 'Y9 登录页 HTML ⇒ 未判定', fn: () => classifyYyb(200, '<html>请先登录</html>').verdict === 'non-json-response' },
    { name: 'Y10 5xx ⇒ 未判定;非签名业务错 ⇒ MISSING 点名 code', fn: () => classifyYyb(502, '{"ret":1}').status === STATUS.UNJUDGED && classifyYyb(200, '{"ret":40002,"msg":"app not online"}').verdict === 'code-40002' },
    { name: 'Y11 凭据三枚缺一 ⇒ MISSING 并分别点名 user_id / access_secret', fn: () => { const p = parseCredentialText('密钥：abc\n应用ID:9'); return p.accessSecret === 'abc' && p.appId === '9' && !p.userId && resolveCredentials({ env: {}, root: 'X:/nope' }).status === STATUS.MISSING } },
    { name: 'Y12 env 齐备优先且不泄露 secret 原文', fn: () => { const r = resolveCredentials({ env: { YYB_USER_ID: 'U1', YYB_ACCESS_SECRET: 'SECRET-DO-NOT-LEAK-0123456789', YYB_APP_ID: 'A1' } }); return r.status === STATUS.FOUND && r.value.appId === 'A1' && !r.detail.includes('DO-NOT-LEAK') } },
    { name: 'Y13 未核实段(3.5)verified:false ⇒ unverifiedCall 恒零调用', fn: () => ENDPOINTS.auditStatus.verified === false && unverifiedCall({ phase: 'x', reason: 'r', doc: 'd' }).calls.length === 0 },
    { name: 'Y14 非法 --phase 抛错(不接受 publish/audit)', fn: () => { try { parseArgs(['--phase', 'publish']); return false } catch { return true } } },
    { name: 'Y15 软著+备案这一型法定前置写在射程说明里', fn: () => /软著/.test('应用宝收国内 App 需 App 备案号 + 软著(生态侧实测口径"必须上传软著证书才可通过市场审核") + 承诺函/安评材料 ⇒ 不在册即拒绝报 ready') },
    { name: 'Y16 3.3 → PUT pre_sign_url → serial_number 回执(离线可跑)', fn: async () => { const seen = []; const fetchImpl = async (url, init) => { seen.push({ url, method: init?.method }); if (url.includes('/get_file_upload_info')) return { status: 200, text: async () => '{"ret":0,"data":{"pre_sign_url":"https://cos.example/put","serial_number":"SN-123"}}' }; return { status: 200, text: async () => 'ok' } }; const r = await phaseUpload({ fetchImpl, creds: { userId: 'U', accessSecret: 'S', appId: 'A' }, assumeFirstPublished: true, plan: { fileName: 'zh.ai.sq.apk', path: '/tmp/x.apk', bytes: 3, fileMd5: 'm' }, read: () => Buffer.from('APK') }); return r.status === STATUS.FOUND && r.serialNumber === 'SN-123' && r.verdict === 'file-uploaded-serial-issued' && seen[0].url === 'https://p.open.qq.com/open_file/developer_api/get_file_upload_info' && seen[1].url === 'https://cos.example/put' && seen[1].method === 'PUT' } },
    { name: 'Y17 无 serial 回执 ⇒ 提审 MISSING 且零出网', fn: async () => { let n = 0; const r = await phaseSubmit({ fetchImpl: async () => { n++; throw new Error('不应出网') }, creds: { userId: 'U', accessSecret: 'S' }, upload: null }); return n === 0 && r.status === STATUS.MISSING && r.verdict === 'no-upload-receipt' } },
    { name: 'Y18 update_app payload 带 serial/deploy_type=1/版本,且明写不等于已上架', fn: async () => { let seen = null; const fetchImpl = async (url, init) => { seen = { url, init }; return { status: 200, text: async () => '{"ret":0}' } }; const r = await phaseSubmit({ fetchImpl, creds: { userId: 'U', accessSecret: 'S', appId: 'A' }, upload: { status: STATUS.FOUND, serialNumber: 'SN-123' }, versionName: '1.2.3', versionCode: '42', updateDesc: '修 bug' }); const body = new URLSearchParams(seen.init.body); return r.status === STATUS.FOUND && r.verdict === 'submitted-for-review' && seen.url === 'https://p.open.qq.com/open_file/developer_api/update_app' && body.get('apk64_file_serial_number') === 'SN-123' && body.get('deploy_type') === '1' && body.get('version_name') === '1.2.3' && body.get('version_code') === '42' && body.get('sign') && /不等于此刻已上架/.test(r.detail) } },
  ])
}

export const __test__ = { BASE, PACKAGE_NAME, YYB_DOC, POLICY, ENDPOINTS, UPLOAD_FILE_TYPE, DEPLOY_TYPE_IMMEDIATE, parseCredentialText, resolveCredentials, signYyb, baseParams, uploadInfoCall, updateAppCall, queryDetailCall, classifyYyb, phaseStatus, phaseUpload, phaseSubmit, mergeVerify, parseArgs, STATUS }

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
