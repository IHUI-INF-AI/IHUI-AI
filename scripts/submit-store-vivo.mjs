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
 *   已核实 method:`app.query.details`(查询应用详情,回读用)。
 *   **未核实**:上传/更新/创建各 method 的确切方法名与字段表 —— 官方正文在登录墙内,
 *          公开面只核到"存在这两种能力 + 需要流水号/下载URL"这一层。
 *   ⇒ 本器对未核实 method **一律零调用并判未判定**(§0.8),但把**要打的请求形状**先摆出来:
 *     凭据与 method 名一到位,只需把 method 字符串补进 `METHODS`,不改判据即可上传。
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
 *   node scripts/submit-store-vivo.mjs --phase upload --file <apk> --execute   # method 未在册 ⇒ 判未判定
 *   凭据优先级:env VIVO_ACCESS_KEY / VIVO_ACCESS_SECRET > 密钥目录文件(§5d)
 * 退出码:0 全绿 / 1 缺件 / 2 未判定
 */
import { readFileSync } from 'node:fs'
import { createHmac } from 'node:crypto'
import { pathToFileURL } from 'node:url'

import { STATUS, STORE_VENDORS, storeCredential, fp } from './lib/rn-release-credentials.mjs'
import { resolveSecretsRoot } from './lib/key-dir.mjs'
import { channelOf, loadBundle, resolveArtifact, buildDryRun, gateStates, runSelfTest, unverifiedCall } from './lib/store-uploader-core.mjs'

const VENDOR = STORE_VENDORS.find((v) => v.id === 'vivo')
export const GATEWAY = 'https://developer-api.vivo.com.cn/router/rest'
const PACKAGE_NAME = 'zh.ai.sq'

/** method 名与核实状态:**只有已在册的 method 才会被真正调用**。 */
export const METHODS = Object.freeze({
  queryDetails: { name: 'app.query.details', verified: true, use: 'status/回读' },
  uploadFile: { name: null, verified: false, use: '形态①文件直传取流水号(官方正文在登录墙内)' },
  updateVersion: { name: null, verified: false, use: '形态②提交公网直链由 vivo 侧下载(方法名未证)' },
  createApp: { name: null, verified: false, use: 'vivo 渠道支持 API 建新应用(官方 DCloud 侧口径,正文未证)' },
  submitAudit: { name: null, verified: false, use: '提交审核(正文未证 ⇒ 零调用)' },
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

/** TOP 惯例签算:除 sign 外按 key 升序拼 k+v,前后加 secret,HMAC 后大写 hex。 */
export function signTop({ params, secret, algo = 'md5' } = {}) {
  if (!secret) return { status: STATUS.UNJUDGED, detail: 'access_secret 取不到 ⇒ 不签(不判"vivo 拒绝")', sign: null }
  const concatenated = Object.entries(params)
    .filter(([k]) => k !== 'sign')
    .sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0))
    .map(([k, v]) => `${k}${v}`)
    .join('')
  const base = `${secret}${concatenated}${secret}`
  try {
    return { status: STATUS.FOUND, sign: createHmac(algo, secret).update(base, 'utf8').digest('hex').toUpperCase(), detail: `sign_method=hmac/${algo} len=32(算法维官方正文未证)` }
  } catch (e) {
    return { status: STATUS.UNJUDGED, sign: null, detail: `签算抛错(${e?.message?.slice(0, 50)})⇒ 未判定` }
  }
}

export function buildRequest({ method, creds, extra = {}, timestamp = Date.now() }) {
  const params = { method: method.name, access_key: creds.accessKey, timestamp: String(timestamp), v: '1.0', sign_method: 'hmac', target_app_key: 'developer', ...extra }
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

export async function phaseStatus({ fetchImpl = fetch, creds, packageName = PACKAGE_NAME, timeoutMs = 20000 }) {
  const m = METHODS.queryDetails
  if (!m.verified) return unverifiedCall({ phase: 'status', reason: '查询 method 未在册', doc: null })
  const req = buildRequest({ method: m, creds, extra: { packageName } })
  if (req.signState.status !== STATUS.FOUND) return { phase: 'status', status: req.signState.status, verdict: 'sign-unverified', detail: req.signState.detail }
  try {
    const r = await fetchImpl(req.url, { method: 'POST', headers: req.headers, body: req.body, signal: AbortSignal.timeout(timeoutMs) })
    return { phase: 'status', ...classifyVivo(r.status, await r.text()) }
  } catch (e) {
    return { phase: 'status', status: STATUS.UNJUDGED, verdict: 'fetch-error', detail: `router/rest 不可达(${e?.cause?.code ?? e?.name})⇒ 未判定` }
  }
}

/** 未核实 method ⇒ 零调用;出路一律给真命令(§0.8)。 */
export function phaseUpload({ mode = 'downloadUrl', artifact: _artifact, bundle: _bundle }) {
  const m = mode === 'direct' ? METHODS.uploadFile : METHODS.updateVersion
  if (m.verified) throw new Error('本器射程内 upload 必为未核实 ⇒ 若命中此分支说明 method 表被改,需重新核官方正文')
  const needs = mode === 'direct' ? UPLOAD_MODES.direct.needs : UPLOAD_MODES.downloadUrl.needs
  return unverifiedCall({
    phase: 'upload',
    reason: `vivo「${UPLOAD_MODES[mode].label}」的 method 名与字段表在官方正文登录墙内(${needs.join(' + ')})`,
    doc: 'dev.vivo.com.cn/documentCenter/doc/326',
  })
}

export const HELP = `vivo 应用商店提交器(上传 method 未核实 ⇒ 恒零调用)
用法:
  node scripts/submit-store-vivo.mjs [--phase status|upload|verify|all] [--mode direct|downloadUrl] [--file <apk>] [--execute] [--json]
  node scripts/submit-store-vivo.mjs --self-test
开关:
  --phase        阶段(status 默认)
  --mode         上传模式(downloadUrl 默认 / direct)
  --file         显式提交物路径
  --execute      真出网(缺省 dry-run 零请求)
  --json         JSON 输出
  --self-test    离线自检
  --help, -h     显示本帮助
退出码:0 全绿 / 1 缺件 / 2 未判定`

export function parseArgs(argv) {
  const o = { phase: 'status', file: null, execute: false, json: false, selfTest: false, help: false, mode: 'downloadUrl' }
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
  if (!['status', 'upload', 'verify', 'all'].includes(o.phase)) throw new Error(`--phase 只接受 status|upload|verify|all,收到 ${o.phase}`)
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
  const gates = gateStates({ creds, artifact, bundle, channel: { status: ch.status, detail: ch.channel?.label ?? ch.detail } })

  if (!args.execute) {
    const d = buildDryRun({
      vendorId: 'vivo',
      creds,
      artifact,
      bundle,
      calls: [
        { verified: true, method: 'POST', url: `${GATEWAY} (method=${METHODS.queryDetails.name})` },
        { verified: false, intent: `形态①${UPLOAD_MODES.direct.label}:${UPLOAD_MODES.direct.note}` },
        { verified: false, intent: `形态②${UPLOAD_MODES.downloadUrl.label}:${UPLOAD_MODES.downloadUrl.note}` },
        { verified: false, intent: '提交审核:method 名未证 ⇒ 零调用' },
      ],
    })
    console.log(args.json ? JSON.stringify({ ...d, gates: gates.rows }, null, 2) : `DRY-RUN vivo(默认零网络)\n${d.calls.map((c) => `  - ${c}`).join('\n')}\n${gates.rows.map((r) => `  [${r.status}] ${r.k}: ${r.detail}`).join('\n')}`)
    return gates.exit
  }
  if (creds.status !== STATUS.FOUND) return console.log(`${creds.status === STATUS.MISSING ? '缺件' : '未判定'}:${creds.detail}`), creds.status === STATUS.MISSING ? 1 : 2
  const steps = []
  if (args.phase !== 'upload') steps.push(await phaseStatus({ creds: creds.value }))
  if (['upload', 'all', 'verify'].includes(args.phase)) steps.push(phaseUpload({ mode: args.mode, artifact, bundle }))
  if (args.phase === 'verify' || args.phase === 'all') steps.push({ phase: 'verify', status: STATUS.UNJUDGED, verdict: 'upload-shape-unverified', detail: '上传段未核实 ⇒ 无法回读对齐,判未判定(不记绿)' })
  console.log(args.json ? JSON.stringify({ steps }, null, 2) : steps.map((s) => `[${s.status}] ${s.phase}: ${s.verdict ?? '-'} — ${s.detail ?? ''}`).join('\n'))
  const st = steps.map((s) => s.status)
  return st.includes(STATUS.UNJUDGED) ? 2 : st.includes(STATUS.MISSING) ? 1 : 0
}

function selfTest() {
  return runSelfTest([
    { name: 'V1 已核实/未核实 method 分档:只有 queryDetails 可调用', fn: () => METHODS.queryDetails.verified === true && [METHODS.uploadFile, METHODS.updateVersion, METHODS.createApp, METHODS.submitAudit].every((m) => m.verified === false && m.name === null) },
    { name: 'V2 两种传包形态都在册(直传流水号 / 公网直链代下载)', fn: () => UPLOAD_MODES.direct.needs.includes('流水号清单') && UPLOAD_MODES.downloadUrl.needs.some((n) => /HTTPS/.test(n)) },
    { name: 'V3 signTop 排序拼接且大写 hex;缺 secret ⇒ 未判定不签', fn: () => { const a = signTop({ params: { b: 2, a: 1, sign: 'zzz' }, secret: 'S' }); const bad = signTop({ params: { a: 1 }, secret: '' }); return /^[0-9A-F]{32}$/.test(a.sign) && !a.sign.includes('zzz') && bad.status === STATUS.UNJUDGED } },
    { name: 'V4 同参数同 secret ⇒ 签算稳定(纯函数,无时间随机)', fn: () => signTop({ params: { a: '1', b: '2' }, secret: 'S' }).sign === signTop({ params: { b: '2', a: '1' }, secret: 'S' }).sign },
    { name: 'V5 buildRequest 必带 v/sign_method/target_app_key,且 body 不含 access_secret', fn: () => { const r = buildRequest({ method: METHODS.queryDetails, creds: { accessKey: 'AK', accessSecret: 'SECRET-DO-NOT-LEAK' }, extra: { packageName: PACKAGE_NAME } }); return r.form.v === '1.0' && r.form.sign_method === 'hmac' && r.form.target_app_key === 'developer' && !r.body.includes('SECRET-DO-NOT-LEAK') && r.body.includes('method=app.query.details') } },
    { name: 'V6 classifyVivo 业务 *_response ⇒ FOUND', fn: () => classifyVivo(200, '{"app_query_details_response":{"resultcode":0}}').status === STATUS.FOUND },
    { name: 'V7 签名类报错 ⇒ 未判定(算法维未证,不判"vivo 拒绝")', fn: () => classifyVivo(200, '{"error_response":{"code":25,"sub_msg":"invalid signature"}}').status === STATUS.UNJUDGED },
    { name: 'V8 非签名业务错 ⇒ MISSING 点名 code', fn: () => { const r = classifyVivo(200, '{"error_response":{"code":40001,"msg":"app not found"}}'); return r.status === STATUS.MISSING && r.detail.includes('40001') } },
    { name: 'V9 HTML/登录页 ⇒ 未判定', fn: () => classifyVivo(200, '<html>请先登录</html>').verdict === 'non-json-response' },
    { name: 'V10 5xx ⇒ 未判定(对方错)', fn: () => classifyVivo(502, '{"x":1}').status === STATUS.UNJUDGED },
    { name: 'V11 phaseUpload 恒零调用并给官方出处', fn: () => { const r = phaseUpload({ mode: 'direct', artifact: {}, bundle: {} }); return r.calls.length === 0 && r.verdict === 'endpoint-unverified-zero-call' && /326/.test(r.detail + (r.doc ?? '')) } },
    { name: 'V12 凭据缺件 ⇒ MISSING 且点名 API管理 开通路径', fn: () => resolveCredentials({ env: {}, root: 'X:/nope' }).status === STATUS.MISSING },
    { name: 'V13 env 优先且不泄露 secret 原文', fn: () => { const r = resolveCredentials({ env: { VIVO_ACCESS_KEY: 'AK', VIVO_ACCESS_SECRET: 'SECRET-DO-NOT-LEAK-0123456789' } }); return r.status === STATUS.FOUND && !r.detail.includes('DO-NOT-LEAK') } },
    { name: 'V14 非法 --mode / --phase 都抛(不接受 submit)', fn: () => { let a = 0, b = 0; try { parseArgs(['--mode', 'ftp']) } catch { a = 1 } try { parseArgs(['--phase', 'submit']) } catch { b = 1 } return a === 1 && b === 1 } },
    { name: 'V15 法定前置字段在射程说明里(软著/备案缺 ⇒ 不得报 ready)', fn: () => /电子版权证书|备案/.test('官方要求必传**电子版权证书或版权证明其一** + **App 备案字段**;两者不在册 ⇒ 本器拒绝报 ready') },
  ])
}

export const __test__ = { GATEWAY, PACKAGE_NAME, METHODS, UPLOAD_MODES, parseCredentialText, resolveCredentials, signTop, buildRequest, classifyVivo, phaseStatus, phaseUpload, parseArgs, STATUS }

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
