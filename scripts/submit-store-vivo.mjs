#!/usr/bin/env node
// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * submit-store-vivo.mjs — vivo 应用商店「API 传包服务」客户端(2026-11-09 立)
 *
 * ## 立因
 * vivo 是本轮**唯一官方明写"一次开通覆盖账号下全部应用"**的厂商,且官方给了**两种**传包形态
 * (《vivo API 传包服务》dev.vivo.com.cn/documentCenter/doc/326):
 *   ① 文件直传:把附件传到开放平台 ⇒ 拿**上传流水号** ⇒ 更新/创建时把流水号与其余字段一并提交;
 *   ② 文件下载方式:开发者把包放**公网可直取的下载地址**,提交时把 URL 交给 vivo,由平台侧下载。
 * 形态②对本仓特别值钱:`release-mobile-rn.mjs` 的 site-apk 腿已经在往官网固定地址发 APK,
 * 也就是说 vivo 这一家**不需要我们自己碰对象存储**,拿现成直链就能提交。
 *
 * ## 端点射程与诚实边界
 *   网关   `https://developer-api.vivo.com.cn/router/rest` —— 形态取自本仓单源
 *          `probe-store-channel.mjs` 的 CHANNELS.vivo.probe(method=app.query.details)。
 *   已核实 method:
 *     `app.query.details`(查询应用详情,回读用)
 *     `app.upload.apk.app.64`(64 位 APK 直传,官方正文 dev.vivo.com.cn/documentCenter/doc/514
 *       2026-11-08 公开可读:POST multipart,字段 packageName/file/fileMd5/stageType,
 *       成功判据 code=0 且 data.serialnumber 非空)
 *   `app.sync.update.app`(更新并提审,官方正文 dev.vivo.com.cn/documentCenter/doc/343 已证:
 *     onlineType=1 表示审核通过后立即发布;更新即提审,无独立 submit method)
 *   **仍未核实**:创建新应用 method(首包走后台) —— 正文不在公开面。
 *   ⇒ 本器只调已核实 method;未核实段零调用判未判定(§0.8),并把**要打的请求形状**先摆出来:
 *     凭据与 method 名一到位,只需把 method 字符串补进 `METHODS`,不改判据即可提交。
 *   签算:`sign_method=hmac` 按 TOP 惯例 = HMAC(secret, 排序拼接) 大写 hex;
 *        该维官方正文未公开核到 ⇒ 若对方回"签名错误"类码,本器报 **形态未证**,不报"vivo 拒绝"。
 *
 * ## 法定前置(vivo 官方材料面实测口径)
 * 官方要求必传**电子版权证书或版权证明其一** + **App 备案字段**;两者不在册 ⇒ 本器拒绝报 ready
 * (读 scripts/data/app-store-credentials.json 的 legalPrereqs,判序与 prepare-store-bundle 一致)。
 *
 * 用法:
 *   node scripts/submit-store-vivo.mjs --self-test
 *   node scripts/submit-store-vivo.mjs                       # dry-run(默认零网络)
 *   node scripts/submit-store-vivo.mjs --phase status --execute
 *   node scripts/submit-store-vivo.mjs --phase upload --mode direct --file <apk> --execute  # 真上传(64 位包)
 *   凭据优先级:env VIVO_ACCESS_KEY / VIVO_ACCESS_SECRET > 密钥目录文件(§5d)
 * 退出码:0 全绿 / 1 缺件 / 2 未判定
 */
import { readFileSync } from 'node:fs'
import { createHash, createHmac } from 'node:crypto'
import { basename, dirname, join } from 'node:path'
import { pathToFileURL } from 'node:url'

import { STATUS, STORE_VENDORS, storeCredential, fp } from './lib/rn-release-credentials.mjs'
import { resolveSecretsRoot } from './lib/key-dir.mjs'
import { channelOf, loadBundle, resolveArtifact, buildDryRun, gateStates, resolveStoreLegalPrereqs, runSelfTest, unverifiedCall } from './lib/store-uploader-core.mjs'

const VENDOR = STORE_VENDORS.find((v) => v.id === 'vivo')
export const GATEWAY = 'https://developer-api.vivo.com.cn/router/rest'
const PACKAGE_NAME = 'zh.ai.sq'

/** method 名与核实状态:**只有已在册的 method 才会被真正调用**。 */
export const METHODS = Object.freeze({
  queryDetails: { name: 'app.query.details', verified: true, use: 'status/回读' },
  uploadFile: { name: 'app.upload.apk.app.64', verified: true, use: '形态①文件直传取流水号(64 位包,doc/514 已证)' },
  updateVersion: { name: null, verified: false, use: '形态②提交公网直链由 vivo 侧下载(方法名未证)' },
  createApp: { name: null, verified: false, use: 'vivo 渠道支持 API 建新应用(官方 DCloud 侧口径,正文未证)' },
  syncUpdate: { name: 'app.sync.update.app', verified: true, use: '更新应用并提审(doc/343:更新即提审,onlineType=1 实时上架)' },
  submitAudit: { name: null, verified: false, use: '无独立提审 method:更新即提审' },
})

/** 官方文档里 vivo 独有的两条上传通道 —— 写死在这里,免得下一个人重新猜。 */
export const UPLOAD_MODES = Object.freeze({
  direct: { label: '文件直传', needs: ['method:上传附件', '流水号清单'], note: '上传成功后拿流水号,更新/创建时把**当次全部流水号**与非文件字段一并提交' },
  downloadUrl: { label: '文件下载方式', needs: ['HTTPS 无鉴权可直取的 APK 下载地址'], note: '本平台侧执行下载;本仓 site-apk 腿已有官网固定直链可复用' },
})

export function parseCredentialText(text) {
  const pairs = String(text ?? '')
    .split(/\r?\n/)
    .map((l) => l.split(/[:：]/))
    .filter((m) => m.length >= 2)
    .map((m) => ({ k: m[0].trim(), v: m.slice(1).join(':').trim() }))
  const pick = (re) => (pairs.find((p) => re.test(p.k)) ?? {}).v ?? null
  const accessKey = pick(/access[_\s-]?key|应用\s*id|appid/i)
  const accessSecret = pick(/access[_\s-]?secret|密\s*钥|secret|private/i)
  return { accessKey, accessSecret, fields: pairs.map((p) => p.k), secretFp: fp(accessSecret) }
}

export function resolveCredentials({ env = process.env, read = readFileSync, root = resolveSecretsRoot() } = {}) {
  if (env.VIVO_ACCESS_KEY && env.VIVO_ACCESS_SECRET) return { status: STATUS.FOUND, detail: `env 齐备(secret sha8=${fp(env.VIVO_ACCESS_SECRET)})`, value: { accessKey: env.VIVO_ACCESS_KEY, accessSecret: env.VIVO_ACCESS_SECRET } }
  const cred = storeCredential(VENDOR, { root })
  if (cred.status !== STATUS.FOUND) return { status: cred.status, detail: `密钥目录:${cred.detail}`, value: null }
  let p
  try {
    p = parseCredentialText(read(cred.value[0].path, 'utf8'))
  } catch (e) {
    return { status: STATUS.UNJUDGED, detail: `凭据件读不到(${e?.code ?? e?.name})⇒ 不判"无凭据"`, value: null }
  }
  const miss = ['accessKey', 'accessSecret'].filter((k) => !p[k])
  if (miss.length) return { status: STATUS.MISSING, detail: `凭据件缺 ${miss.join(',')}(字段=${p.fields.join('/')})⇒ vivo 需 管理中心→账号管理→API管理 开通后分配的 access_key/access_secret`, value: null }
  return { status: STATUS.FOUND, detail: `access_key=${String(p.accessKey).slice(0, 4)}*** secret sha8=${p.secretFp}`, value: { accessKey: p.accessKey, accessSecret: p.accessSecret } }
}

/**
 * 签算(doc/327 已证):除 sign 外按 key ASCII 升序拼 `k=v&`,HmacSHA256(accessSecret) 转 16 进制。
 * 不包裹 secret、不做 URL 编码 —— 旧版 TOP 的 `k+v`/md5 形态已废弃。
 */
export function signTop({ params, secret, algo = 'sha256' } = {}) {
  if (!secret) return { status: STATUS.UNJUDGED, detail: 'access_secret 取不到 ⇒ 不签(不判"vivo 拒绝")', sign: null }
  const concatenated = Object.entries(params)
    .filter(([k]) => k !== 'sign')
    .sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0))
    .map(([k, v]) => `${k}=${v}`)
    .join('&')
  try {
    // doc/327 的 Java 样例用 Integer.toHexString ⇒ 小写 hex;大写实测回 10001。
    return { status: STATUS.FOUND, sign: createHmac(algo, secret).update(concatenated, 'utf8').digest('hex'), detail: `sign_method=hmac/${algo} len=64 小写(doc/327 Java 样例)` }
  } catch (e) {
    return { status: STATUS.UNJUDGED, sign: null, detail: `签算抛错(${e?.message?.slice(0, 50)})⇒ 未判定` }
  }
}

export function buildRequest({ method, creds, extra = {}, timestamp = Date.now() }) {
  // format 是 doc/327 公共必传参数,且必须进入签名串(官方示例第 3 步含 format=json);漏了必得 10001。
  const params = { method: method.name, access_key: creds.accessKey, timestamp: String(timestamp), format: 'json', v: '1.0', sign_method: 'hmac', target_app_key: 'developer', ...extra }
  const s = signTop({ params, secret: creds.accessSecret })
  const form = { ...params, sign: s.sign ?? '' }
  return { url: GATEWAY, method: 'POST', headers: { 'content-type': 'application/x-www-form-urlencoded' }, body: new URLSearchParams(form).toString(), form, signState: s }
}

/** vivo 回包三态:业务成功体 / error_response / 非结构化。 */
export function classifyVivo(httpStatus, rawBody) {
  let j = null
  try {
    j = JSON.parse(String(rawBody ?? ''))
  } catch {
    return { status: STATUS.UNJUDGED, verdict: 'non-json-response', detail: `http=${httpStatus} 非 JSON(多为登录页/网关拦截)⇒ 我形态错,不据此下结论`, data: null }
  }
  if (httpStatus >= 500) return { status: STATUS.UNJUDGED, verdict: 'server-error', detail: `http=${httpStatus}`, data: j }
  const err = j?.error_response ?? null
  if (err) {
    const code = err.code ?? null
    const sub = err.sub_code ?? null
    const sig = /sign|签名/i.test(`${err.sub_msg ?? ''}${err.msg ?? ''}`)
    return { status: sig ? STATUS.UNJUDGED : STATUS.MISSING, verdict: sig ? 'signature-shape-unverified' : `error-${code}`, detail: `http=${httpStatus} code=${code} sub=${sub ?? '-'} msg="${String(err.sub_msg ?? err.msg ?? '').slice(0, 120)}"${sig ? ' ⇒ 签算算法维未证,不判"vivo 拒绝"' : ''}`, data: j }
  }
  const biz = Object.keys(j).find((k) => k.endsWith('_response'))
  if (biz) return { status: STATUS.FOUND, verdict: `response-${biz}`, detail: `http=${httpStatus} 业务体 ${biz}`, data: j[biz] }
  return { status: STATUS.UNJUDGED, verdict: 'unrecognized-shape', detail: `http=${httpStatus} 既无 error_response 也无 *_response ⇒ 形态未证`, data: j }
}

/**
 * Node 26 + Windows 实测:AbortSignal.timeout 的定时器在进程退出时会触发
 * `Assertion failed: !(handle->flags & UV_HANDLE_CLOSING)` 并以 0xC0000409 退出,
 * 把"请求已成功"读成失败。改用 unref 的 AbortController,并显式 clearTimeout。
 */
export function fetchWithTimeout(fetchImpl, url, opts = {}, timeoutMs = 20000) {
  const ac = new AbortController()
  const timer = setTimeout(() => ac.abort(new Error(`timeout ${timeoutMs}ms`)), timeoutMs)
  timer.unref?.()
  return Promise.resolve(fetchImpl(url, { ...opts, signal: ac.signal })).finally(() => clearTimeout(timer))
}

export async function phaseStatus({ fetchImpl = fetch, creds, packageName = PACKAGE_NAME, timeoutMs = 20000 }) {
  const m = METHODS.queryDetails
  if (!m.verified) return unverifiedCall({ phase: 'status', reason: '查询 method 未在册', doc: null })
  const req = buildRequest({ method: m, creds, extra: { packageName } })
  if (req.signState.status !== STATUS.FOUND) return { phase: 'status', status: req.signState.status, verdict: 'sign-unverified', detail: req.signState.detail }
  try {
    const r = await fetchWithTimeout(fetchImpl, req.url, { method: 'POST', headers: req.headers, body: req.body }, timeoutMs)
    return { phase: 'status', ...classifyVivoCode(r.status, await r.text()) }
  } catch (e) {
    return { phase: 'status', status: STATUS.UNJUDGED, verdict: 'fetch-error', detail: `router/rest 不可达(${e?.cause?.code ?? e?.name})⇒ 未判定` }
  }
}

/**
 * 官方文档形态的判定(code/subCode)。与 classifyVivo 的 *_response 形态并存:
 * doc/514 的响应示例就是顶层 `{code,msg,subCode,data}`,不能拿网关包裹形态套。
 */
export function classifyVivoCode(httpStatus, rawBody) {
  let j = null
  try {
    j = JSON.parse(String(rawBody ?? ''))
  } catch {
    return { status: STATUS.UNJUDGED, verdict: 'non-json-response', detail: `http=${httpStatus} 非 JSON(多为登录页/网关拦截)⇒ 形态未证`, data: null }
  }
  if (httpStatus >= 500) return { status: STATUS.UNJUDGED, verdict: 'server-error', detail: `http=${httpStatus}`, data: j }
  if (j?.error_response) return classifyVivo(httpStatus, rawBody)
  const code = j?.code
  if (code === 0 || code === '0') {
    const sub = j?.subCode ?? j?.sub_code ?? '0'
    if (String(sub) === '0') return { status: STATUS.FOUND, verdict: `code-0-sub-${sub}`, detail: `http=${httpStatus} code=0 subCode=0 ${String(j?.msg ?? '').slice(0, 80)}`, data: j?.data ?? j }
    return { status: STATUS.MISSING, verdict: `sub-${sub}`, detail: `http=${httpStatus} code=0 但 subCode=${sub}(${String(j?.msg ?? '').slice(0, 100)})`, data: j }
  }
  if (code !== undefined) return { status: STATUS.MISSING, verdict: `error-${code}`, detail: `http=${httpStatus} code=${code} msg="${String(j?.msg ?? '').slice(0, 120)}"`, data: j }
  return { status: STATUS.UNJUDGED, verdict: 'unrecognized-shape', detail: `http=${httpStatus} 无 code/error_response ⇒ 形态未证`, data: j }
}

/** 版本号:env STORE_VERSION_CODE 优先,其次产物旁的 output-metadata.json。取不到 ⇒ null(由调用方判 MISSING)。 */
export function readVersionCode({ artifact = null, env = process.env, read = readFileSync } = {}) {
  const fromEnv = Number(env.STORE_VERSION_CODE ?? env.IHUI_VERSION_CODE ?? 0)
  if (Number.isFinite(fromEnv) && fromEnv > 0) return fromEnv
  const p = artifact?.value?.path
  if (!p) return null
  try {
    const j = JSON.parse(read(join(dirname(p), 'output-metadata.json'), 'utf8'))
    const vc = Number(j?.elements?.[0]?.versionCode ?? 0)
    return vc > 0 ? vc : null
  } catch {
    return null
  }
}

/**
 * 形态①文件直传(doc/514 已证):multipart 打网关,业务字段 packageName/fileMd5,
 * 成功判据 code=0 且 subCode=0 且 data.serialnumber 非空。
 */
export async function phaseUpload({ fetchImpl = fetch, mode = 'direct', artifact = null, bundle = null, creds = null, timeoutMs = 600000, read = readFileSync } = {}) {
  if (mode !== 'direct') {
    return unverifiedCall({
      phase: 'upload',
      reason: `vivo「${UPLOAD_MODES.downloadUrl.label}」的 method 名与字段表仍在登录墙内(${UPLOAD_MODES.downloadUrl.needs.join(' + ')})`,
      doc: 'dev.vivo.com.cn/documentCenter/doc/326',
    })
  }
  const m = METHODS.uploadFile
  if (!m.verified || !m.name) return unverifiedCall({ phase: 'upload', reason: '上传 method 未在册', doc: null })
  if (!creds?.accessKey || !creds?.accessSecret) return { phase: 'upload', status: STATUS.MISSING, verdict: 'no-credentials', detail: 'vivo access_key/access_secret 未成立 ⇒ 不发请求' }
  const p = artifact?.value?.path
  if (!p) return { phase: 'upload', status: STATUS.MISSING, verdict: 'no-artifact', detail: 'APK 产物未找到(--file 或默认 apk/release/app-release.apk)' }
  let buf = null
  try {
    buf = read(p)
  } catch (e) {
    return { phase: 'upload', status: STATUS.UNJUDGED, verdict: 'artifact-unreadable', detail: `APK 读不到(${e?.code ?? e?.name}):${p}` }
  }
  const fileMd5 = createHash('md5').update(buf).digest('hex')
  const packageName = bundle?.files?.listing?.packageName ?? PACKAGE_NAME
  const req = buildRequest({ method: m, creds, extra: { packageName, fileMd5 } })
  if (req.signState.status !== STATUS.FOUND) return { phase: 'upload', status: req.signState.status, verdict: 'sign-unavailable', detail: req.signState.detail }
  const fd = new FormData()
  for (const [k, v] of Object.entries(req.form)) fd.append(k, String(v))
  fd.append('file', new Blob([buf], { type: 'application/vnd.android.package-archive' }), basename(p))
  try {
    const r = await fetchWithTimeout(fetchImpl, GATEWAY, { method: 'POST', body: fd }, timeoutMs)
    const c = classifyVivoCode(r.status, await r.text())
    const serialnumber = c.data?.serialnumber ?? null
    if (c.status === STATUS.FOUND && !serialnumber) {
      return { phase: 'upload', status: STATUS.UNJUDGED, verdict: 'receipt-without-serialnumber', detail: `${c.detail};回包无 data.serialnumber ⇒ 无法据以提审`, fileMd5, bytes: buf.length }
    }
    return { phase: 'upload', ...c, serialnumber, fileMd5, bytes: buf.length }
  } catch (e) {
    return { phase: 'upload', status: STATUS.UNJUDGED, verdict: 'fetch-error', detail: `router/rest 不可达(${e?.cause?.code ?? e?.name})⇒ 未判定`, fileMd5, bytes: buf.length }
  }
}

/**
 * 更新+提审(doc/343 已证):`app.sync.update.app`。vivo 没有独立提审 method —— 更新即提审;
 * onlineType=1 表示审核通过实时上架。缺上传流水号/版本号 ⇒ MISSING,绝不拿空值冒充提交。
 */
export async function phaseSyncUpdate({ fetchImpl = fetch, creds = null, upload = null, bundle = null, artifact = null, onlineType = 1, updateDesc = null, timeoutMs = 60000, env = process.env } = {}) {
  const m = METHODS.syncUpdate
  if (!m.verified || !m.name) return unverifiedCall({ phase: 'submit', reason: '更新/提审 method 未在册', doc: null })
  if (!creds?.accessKey || !creds?.accessSecret) return { phase: 'submit', status: STATUS.MISSING, verdict: 'no-credentials', detail: 'vivo access_key/access_secret 未成立 ⇒ 不发请求' }
  if (upload?.status !== STATUS.FOUND || !upload?.serialnumber) {
    return {
      phase: 'submit',
      status: upload?.status === STATUS.UNJUDGED ? STATUS.UNJUDGED : STATUS.MISSING,
      verdict: 'no-upload-receipt',
      detail: `无上传流水号(上传段=${upload?.status ?? '未执行'})⇒ 缺前置,不冒充提审`,
    }
  }
  const versionCode = readVersionCode({ artifact, env })
  if (!versionCode) return { phase: 'submit', status: STATUS.MISSING, verdict: 'no-version-code', detail: '版本号取不到:设 STORE_VERSION_CODE 或保证产物旁有 output-metadata.json' }
  const packageName = bundle?.files?.listing?.packageName ?? PACKAGE_NAME
  const desc = String(updateDesc ?? bundle?.files?.listing?.releaseNotes ?? '常规更新').slice(0, 500)
  const req = buildRequest({
    method: m,
    creds,
    extra: {
      packageName,
      versionCode: String(versionCode),
      apk: upload.serialnumber,
      fileMd5: upload.fileMd5,
      onlineType: String(onlineType),
      updateDesc: desc,
    },
  })
  if (req.signState.status !== STATUS.FOUND) return { phase: 'submit', status: req.signState.status, verdict: 'sign-unavailable', detail: req.signState.detail }
  try {
    const r = await fetchWithTimeout(fetchImpl, req.url, { method: 'POST', headers: req.headers, body: req.body }, timeoutMs)
    const c = classifyVivoCode(r.status, await r.text())
    return { phase: 'submit', ...c, serialnumber: upload.serialnumber, versionCode }
  } catch (e) {
    return { phase: 'submit', status: STATUS.UNJUDGED, verdict: 'fetch-error', detail: `router/rest 不可达(${e?.cause?.code ?? e?.name})⇒ 未判定` }
  }
}

export const HELP = `vivo 应用商店提交器(直传+更新提审已证;downloadUrl 形态仍零调用)
用法:
  node scripts/submit-store-vivo.mjs [--phase status|upload|submit|verify|all] [--mode direct|downloadUrl] [--file <apk>] [--execute] [--json]
  node scripts/submit-store-vivo.mjs --self-test
开关:
  --phase        阶段(status 默认)
  --mode         上传模式(direct 默认 / downloadUrl)
  --file         显式提交物路径
  --execute      真出网(缺省 dry-run 零请求)
  --json         JSON 输出
  --self-test    离线自检
  --help, -h     显示本帮助
退出码:0 全绿 / 1 缺件 / 2 未判定`

export function parseArgs(argv) {
  const o = { phase: 'status', file: null, execute: false, json: false, selfTest: false, help: false, mode: 'direct' }
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i]
    if (a === '--help' || a === '-h') o.help = true
    else if (a === '--phase') o.phase = argv[++i]
    else if (a === '--mode') o.mode = argv[++i]
    else if (a === '--file') o.file = argv[++i]
    else if (a === '--execute') o.execute = true
    else if (a === '--json') o.json = true
    else if (a === '--self-test') o.selfTest = true
    else throw new Error(`未知参数: ${a}`)
  }
  if (!['status', 'upload', 'submit', 'verify', 'all'].includes(o.phase)) throw new Error(`--phase 只接受 status|upload|submit|verify|all,收到 ${o.phase}`)
  if (!['direct', 'downloadUrl'].includes(o.mode)) throw new Error(`--mode 只接受 direct|downloadUrl,收到 ${o.mode}`)
  return o
}

async function main() {
  const args = parseArgs(process.argv.slice(2))
  if (args.help) { console.log(HELP); return 0 }
  if (args.selfTest) return selfTest()
  const creds = resolveCredentials()
  const artifact = resolveArtifact({ file: args.file, preferKind: 'apk' })
  const bundle = loadBundle({ vendor: 'vivo' })
  const ch = channelOf('vivo')
  const legal = resolveStoreLegalPrereqs({ store: 'vivo' })
  const gates = gateStates({ creds, artifact, bundle, channel: { status: ch.status, detail: ch.channel?.label ?? ch.detail }, legal })

  if (!args.execute) {
    const d = buildDryRun({
      vendorId: 'vivo',
      creds,
      artifact,
      bundle,
      calls: [
        { verified: true, method: 'POST', url: `${GATEWAY} (method=${METHODS.queryDetails.name})` },
        { verified: true, method: 'POST', url: `${GATEWAY} (method=${METHODS.uploadFile.name}, multipart)` },
        { verified: true, method: 'POST', url: `${GATEWAY} (method=${METHODS.syncUpdate.name}, onlineType=1)` },
        { verified: false, intent: `形态②${UPLOAD_MODES.downloadUrl.label}:${UPLOAD_MODES.downloadUrl.note}(仍零调用)` },
      ],
    })
    console.log(args.json ? JSON.stringify({ ...d, gates: gates.rows }, null, 2) : `DRY-RUN vivo(默认零网络)\n${d.calls.map((c) => `  - ${c}`).join('\n')}\n${gates.rows.map((r) => `  [${r.status}] ${r.k}: ${r.detail}`).join('\n')}`)
    return gates.exit
  }
  if (creds.status !== STATUS.FOUND) return console.log(`${creds.status === STATUS.MISSING ? '缺件' : '未判定'}:${creds.detail}`), creds.status === STATUS.MISSING ? 1 : 2
  if (legal.status !== STATUS.FOUND) return console.log(`${legal.status === STATUS.MISSING ? '缺件' : '未判定'}:法定前置 ${legal.detail}`), legal.status === STATUS.MISSING ? 1 : 2
  const steps = []
  if (args.phase !== 'upload' && args.phase !== 'verify' && args.phase !== 'submit') steps.push(await phaseStatus({ creds: creds.value }))
  let uploadStep = null
  if (['upload', 'all', 'verify'].includes(args.phase)) {
    uploadStep = await phaseUpload({ mode: args.mode, artifact, bundle, creds: creds.value })
    steps.push(uploadStep)
  }
  let submitStep = null
  if (['submit', 'all'].includes(args.phase)) {
    submitStep = await phaseSyncUpdate({ creds: creds.value, upload: uploadStep, bundle, artifact, updateDesc: process.env.STORE_UPDATE_DESC ?? null })
    steps.push(submitStep)
  }
  if (args.phase === 'verify' || args.phase === 'all') {
    const ok = uploadStep?.status === STATUS.FOUND && (submitStep ? submitStep.status === STATUS.FOUND : false)
    steps.push({
      phase: 'verify',
      status: ok ? STATUS.FOUND : uploadStep?.status === STATUS.MISSING ? STATUS.MISSING : STATUS.UNJUDGED,
      verdict: ok ? 'upload-and-submit-receipt' : 'receipt-incomplete',
      detail: ok ? `上传流水号=${uploadStep.serialnumber} versionCode=${submitStep.versionCode};已提审,审核结果以 vivo 后台为准` : '上传/提审回执不齐 ⇒ 不记绿',
    })
  }
  console.log(args.json ? JSON.stringify({ steps }, null, 2) : steps.map((s) => `[${s.status}] ${s.phase}: ${s.verdict ?? '-'} — ${s.detail ?? ''}`).join('\n'))
  const st = steps.map((s) => s.status)
  return st.includes(STATUS.UNJUDGED) ? 2 : st.includes(STATUS.MISSING) ? 1 : 0
}

function selfTest() {
  return runSelfTest([
    { name: 'V1 method 分档:queryDetails/uploadFile/syncUpdate 已核实,其余零调用', fn: () => [METHODS.queryDetails, METHODS.uploadFile, METHODS.syncUpdate].every((m) => m.verified === true && m.name) && [METHODS.updateVersion, METHODS.createApp, METHODS.submitAudit].every((m) => m.verified === false && m.name === null) },
    { name: 'V2 两种传包形态都在册(直传流水号 / 公网直链代下载)', fn: () => UPLOAD_MODES.direct.needs.includes('流水号清单') && UPLOAD_MODES.downloadUrl.needs.some((n) => /HTTPS/.test(n)) },
    { name: 'V3 signTop:ASCII 升序 k=v& + HmacSHA256 小写 hex;缺 secret 不签', fn: () => { const a = signTop({ params: { b: 2, a: 1, sign: 'zzz' }, secret: 'S' }); const bad = signTop({ params: { a: 1 }, secret: '' }); return /^[0-9a-f]{64}$/.test(a.sign) && !a.sign.includes('zzz') && bad.status === STATUS.UNJUDGED } },
    { name: 'V4 同参数同 secret ⇒ 签算稳定(纯函数,无时间随机)', fn: () => signTop({ params: { a: '1', b: '2' }, secret: 'S' }).sign === signTop({ params: { b: '2', a: '1' }, secret: 'S' }).sign },
    { name: 'V5 buildRequest 必带 format/v/sign_method/target_app_key,且 body 不含 access_secret', fn: () => { const r = buildRequest({ method: METHODS.queryDetails, creds: { accessKey: 'AK', accessSecret: 'SECRET-DO-NOT-LEAK' }, extra: { packageName: PACKAGE_NAME } }); return r.form.format === 'json' && r.form.v === '1.0' && r.form.sign_method === 'hmac' && r.form.target_app_key === 'developer' && !r.body.includes('SECRET-DO-NOT-LEAK') && r.body.includes('method=app.query.details') } },
    { name: 'V6 classifyVivo 业务 *_response ⇒ FOUND', fn: () => classifyVivo(200, '{"app_query_details_response":{"resultcode":0}}').status === STATUS.FOUND },
    { name: 'V7 签名类报错 ⇒ 未判定(算法维未证,不判"vivo 拒绝")', fn: () => classifyVivo(200, '{"error_response":{"code":25,"sub_msg":"invalid signature"}}').status === STATUS.UNJUDGED },
    { name: 'V8 非签名业务错 ⇒ MISSING 点名 code', fn: () => { const r = classifyVivo(200, '{"error_response":{"code":40001,"msg":"app not found"}}'); return r.status === STATUS.MISSING && r.detail.includes('40001') } },
    { name: 'V9 HTML/登录页 ⇒ 未判定', fn: () => classifyVivo(200, '<html>请先登录</html>').verdict === 'non-json-response' },
    { name: 'V10 5xx ⇒ 未判定(对方错)', fn: () => classifyVivo(502, '{"x":1}').status === STATUS.UNJUDGED },
    { name: 'V11 downloadUrl 形态仍零调用并给官方出处;direct 未给凭据 ⇒ 零请求', fn: async () => { const a = await phaseUpload({ mode: 'downloadUrl' }); const b = await phaseUpload({ mode: 'direct' }); return a.calls.length === 0 && a.verdict === 'endpoint-unverified-zero-call' && /326/.test(a.detail + (a.doc ?? '')) && b.status === STATUS.MISSING && b.verdict === 'no-credentials' } },
    { name: 'V12 凭据缺件 ⇒ MISSING 且点名 API管理 开通路径', fn: () => resolveCredentials({ env: {}, root: 'X:/nope' }).status === STATUS.MISSING },
    { name: 'V13 env 优先且不泄露 secret 原文', fn: () => { const r = resolveCredentials({ env: { VIVO_ACCESS_KEY: 'AK', VIVO_ACCESS_SECRET: 'SECRET-DO-NOT-LEAK-0123456789' } }); return r.status === STATUS.FOUND && !r.detail.includes('DO-NOT-LEAK') } },
    { name: 'V14 非法 --mode / --phase 都抛;submit 是合法相位', fn: () => { let a = 0, b = 0; try { parseArgs(['--mode', 'ftp']) } catch { a = 1 } try { parseArgs(['--phase', 'nope']) } catch { b = 1 } return a === 1 && b === 1 && parseArgs(['--phase', 'submit']).phase === 'submit' } },
    { name: 'V15 法定前置闸:备案/软著/安评三格齐 found 才绿;安评缺 ⇒ 缺件;台账读不到 ⇒ 未判定', fn: () => {
      const mk = (over = {}) => JSON.stringify({ legalPrereqs: {
        appIcpFiling: { statusNow: 'found', appFilingNumber: '吉ICP备2025027274号-7A', requiredByStores: ['vivo'] },
        softwareCopyright: { statusNow: 'found', certificateNumber: '2025SR1904590', requiredByStores: ['vivo'] },
        securityAssessment: { statusNow: 'found', files: ['a.png'], requiredByStores: ['vivo'] },
        ...over,
      } })
      const ok = resolveStoreLegalPrereqs({ store: 'vivo', read: () => mk() })
      const noAssess = resolveStoreLegalPrereqs({ store: 'vivo', read: () => mk({ securityAssessment: { statusNow: 'missing-evidence', requiredByStores: ['vivo'] } }) })
      const unread = resolveStoreLegalPrereqs({ store: 'vivo', read: () => { throw Object.assign(new Error('x'), { name: 'ENOENT' }) } })
      return ok.status === STATUS.FOUND && noAssess.status === STATUS.MISSING && /securityAssessment/.test(noAssess.detail) && unread.status === STATUS.UNJUDGED
    } },
    { name: 'V19 found 但缺编号/证据件 ⇒ 未判定;台账无适用该店的格 ⇒ 全绿且明说无适用前置', fn: () => {
      const mk = (over = {}) => JSON.stringify({ legalPrereqs: {
        appIcpFiling: { statusNow: 'found', appFilingNumber: '吉ICP备2025027274号-7A', requiredByStores: ['vivo'] },
        softwareCopyright: { statusNow: 'found', certificateNumber: '2025SR1904590', requiredByStores: ['vivo'] },
        securityAssessment: { statusNow: 'found', files: ['a.png'], requiredByStores: ['vivo'] },
        ...over,
      } })
      const noNumber = resolveStoreLegalPrereqs({ store: 'vivo', read: () => mk({ softwareCopyright: { statusNow: 'found', requiredByStores: ['vivo'] } }) })
      const other = resolveStoreLegalPrereqs({ store: 'google', read: () => mk() })
      return noNumber.status === STATUS.UNJUDGED && /certificateNumber/.test(noNumber.detail) && other.status === STATUS.FOUND && /无适用法定前置/.test(other.detail)
    } },
    { name: 'V16 direct 上传:multipart 带 method/packageName/fileMd5/file,回包 serialnumber 才算绿', fn: async () => {
      let seen = null
      const fetchImpl = async (_url, opts) => { seen = opts.body; return { status: 200, text: async () => '{"code":0,"msg":"成功","subCode":"0","data":{"packageName":"zh.ai.sq","serialnumber":"SN1","versionCode":7,"versionName":"1.0","fileMd5":"m"}}' } }
      const r = await phaseUpload({ fetchImpl, read: () => Buffer.from('abc'), creds: { accessKey: 'AK', accessSecret: 'SECRET' }, artifact: { value: { path: '/tmp/x.apk', bytes: 3 } }, bundle: null })
      return r.status === STATUS.FOUND && r.serialnumber === 'SN1' && seen.get('method') === 'app.upload.apk.app.64' && seen.get('fileMd5') && seen.get('file') !== null && !String(seen.get('sign')).includes('SECRET')
    } },
    { name: 'V17 提审无流水号 ⇒ MISSING(不拿空值冒充);有流水号时 onlineType=1 且带 versionCode', fn: async () => {
      const noReceipt = await phaseSyncUpdate({ creds: { accessKey: 'AK', accessSecret: 'SECRET' }, upload: null, artifact: null })
      let body = null
      const fetchImpl = async (_url, opts) => { body = opts.body; return { status: 200, text: async () => '{"code":0,"subCode":"0","msg":"成功","data":{}}' } }
      const ok = await phaseSyncUpdate({ fetchImpl, creds: { accessKey: 'AK', accessSecret: 'SECRET' }, upload: { status: STATUS.FOUND, serialnumber: 'SN1', fileMd5: 'm' }, artifact: { value: { path: '/tmp/x.apk' } }, env: { STORE_VERSION_CODE: '26110713' } })
      return noReceipt.status === STATUS.MISSING && ok.status === STATUS.FOUND && body.includes('onlineType=1') && body.includes('versionCode=26110713') && body.includes('apk=SN1')
    } },
    { name: 'V18 回包 code=0 但 subCode≠0 ⇒ MISSING;无 code ⇒ 未判定', fn: () => classifyVivoCode(200, '{"code":0,"subCode":"15003","msg":"版本低"}').status === STATUS.MISSING && classifyVivoCode(200, '{"foo":1}').status === STATUS.UNJUDGED },
  ])
}

export const __test__ = { GATEWAY, PACKAGE_NAME, METHODS, UPLOAD_MODES, parseCredentialText, resolveCredentials, signTop, buildRequest, classifyVivo, classifyVivoCode, readVersionCode, phaseStatus, phaseUpload, phaseSyncUpdate, parseArgs, STATUS }

const isDirectRun = process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href
if (isDirectRun) {
  // Node 26 + Windows:请求后立刻 process.exit 会在 libuv 关闭句柄时触发 async.c 断言
  // (0xC0000409),把成功读成失败 ⇒ 只设 exitCode,让事件循环自然收尾。
  main()
    .then((code) => {
      process.exitCode = code
    })
    .catch((e) => {
      console.error(`❌ ${e?.message ?? e}\n${e?.stack ?? ''}`)
      process.exitCode = 2
    })
}
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
