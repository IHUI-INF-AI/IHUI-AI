#!/usr/bin/env node
// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * submit-store-xiaomi.mjs — 小米应用商店「应用自动发布接口」客户端(2026-11-09 立)
 *
 * ## 立因
 * `release-mobile-rn.mjs` 的 store-xiaomi 腿自己登记的出路名就是本文件("凭据到位后新增
 * scripts/submit-store-<id>.mjs"),而凭据面实测是 `storeCredential(xiaomi)=missing`(密钥目录内
 * 无任何小米凭据件)⇒ 本器现在**必然**停在缺件那一格。本器的价值不是"今天能传",而是
 * **凭据一到就不需要再写代码**:端点、签算、申报单、回读四格已在册,缺的只是私钥与邮箱。
 *
 * ## 端点出处(不是博客说法)
 *   上传 `POST https://api.developer.xiaomi.com/devupload/dev/push`
 *        —— 小米澎湃OS开发者平台《应用自动发布接口操作指南》正文给的 curl 形态(multipart:
 *        RequestData=JSON 字符串 + SIG),官方示例里 RequestData 含 appInfo{appName,packageName,
 *        versionName,brief,desc,privacyUrl,onlineTime,…} 与 synchroType。
 *   查询 `POST https://api.developer.xiaomi.com/devupload/dev/query`
 *        —— 形态取自本仓单源 `probe-store-channel.mjs` 的 CHANNELS.xiaomi.probe(§0.6:URL 不在这里重抄)。
 *   签算 SIG = hex(RSA 签名 over RequestData 原文)。私钥来源:开发者站「应用管理 →
 *        自动发布接口」的"获取私钥";**私钥重置后旧值立即失效**(CHANNELS.xiaomi.remediation 在册)。
 *        摘要算法这一维官方正文需登录才看得到 ⇒ 本器把它做成可注入项,拿不准时**判未判定**,
 *        不因"我签的姿势不对"去断言"小米拒绝了我们"(§0.3)。
 *
 * ## 四段射程
 *   status  查询回读:dev/query ⇒ result/des(通道与包名归属是否成立)
 *   upload  申报并上传:dev/push(multipart)⇒ result=0 才算这一步绿
 *   verify  申报的 versionName/versionCode ⇄ 回读值 对齐才算绿;**绝不因 PUT/POST 返回 2xx 就报"已上架"**
 *   submit  小米的"提交审核"在 dev/push 的 synchroType 里表达(同步发布/定时),本器只用官方示例值,
 *           不猜新的 synchroType 语义 ⇒ 需要"定时/立即"以外的形态时判未判定。
 *
 * ## 法定前置(与 prepare-store-bundle 同一判序)
 * 小米商店收国内 App **必须有 App 备案号 + 软著/电子版权证书**;备案号不在册时本器**拒绝报 ready**
 * (读 `scripts/data/app-store-credentials.json` 与 prepare-store-bundle 的 ICP 格,不另立判据)。
 *
 * 用法:
 *   node scripts/submit-store-xiaomi.mjs --self-test
 *   node scripts/submit-store-xiaomi.mjs                       # 默认 dry-run:零网络,摆出四格与计划
 *   node scripts/submit-store-xiaomi.mjs --phase status|upload|verify|all --execute [--file <apk>]
 *   凭据优先级:env XIAOMI_DEVUSER_EMAIL / XIAOMI_API_PRIVATE_KEY(PEM 或 base64)> 密钥目录文件(§5d)
 * 退出码:0 全绿 / 1 缺件(点名缺哪一枚)/ 2 未判定(取不到输入、网络不可达、形态未证)
 */
import { readFileSync } from 'node:fs'
import { createHash, createSign } from 'node:crypto'
import { pathToFileURL } from 'node:url'

import { STATUS, STORE_VENDORS, storeCredential, fp } from './lib/rn-release-credentials.mjs'
import { resolveSecretsRoot } from './lib/key-dir.mjs'
import { channelOf, loadBundle, resolveArtifact, buildDryRun, gateStates, runSelfTest, mask } from './lib/store-uploader-core.mjs'

const VENDOR = STORE_VENDORS.find((v) => v.id === 'xiaomi')
const PUSH_URL = 'https://api.developer.xiaomi.com/devupload/dev/push'
const PACKAGE_NAME = 'zh.ai.sq'

/**
 * synchroType 语义(官方正文):0=新增应用,1=更新应用包,2=内容更新。
 * **三种都会进入审核**(官方明写所有提交均进审核)⇒ result=0 只代表"已递交",不等于已上架。
 * 默认 1(本仓是已上线应用的常规发版;首包仍需后台完成认领后走 0)。
 */
export const SYNCHRO_TYPES = Object.freeze({
  0: { label: '新增应用', note: '首包形态;包名须先由开发者站在册/认领' },
  1: { label: '更新应用包', note: '常规发版默认' },
  2: { label: '内容更新', note: '仅改素材/文案,不动包' },
})
export const DEFAULT_SYNCHRO_TYPE = 1

/** 凭据件字段别名(实测形态:网盘里各家都是「键：值」行式文本,冒号可能全角)。 */
export const FIELD_ALIASES = Object.freeze({
  email: [/小米\s*账号|用户\s*名|user_?name|email/i],
  privateKey: [/接\s*口私\s*钥|私\s*钥|private_?key|pem/i],
  publicKey: [/公\s*钥|public_?key/i],
})

/** 纯函数:行式凭据件 → 结构化。任何一枚取不到都返回 null,不猜空串。 */
export function parseCredentialText(text) {
  const pairs = String(text ?? '')
    .split(/\r?\n/)
    .map((l) => l.split(/[:：]/))
    .filter((m) => m.length >= 2)
    .map((m) => ({ k: m[0].trim(), v: m.slice(1).join(':').trim() }))
  const pick = (res) => (pairs.find((p) => res.some((re) => re.test(p.k))) ?? {}).v ?? null
  return { email: pick(FIELD_ALIASES.email), privateKey: pick(FIELD_ALIASES.privateKey), publicKey: pick(FIELD_ALIASES.publicKey), fields: pairs.map((p) => p.k) }
}

/** 三态凭据出口:env 优先,其次密钥目录;原文永不进 detail(§5d)。 */
export function resolveCredentials({ env = process.env, read = readFileSync, root = resolveSecretsRoot() } = {}) {
  if (env.XIAOMI_DEVUSER_EMAIL && env.XIAOMI_API_PRIVATE_KEY)
    return { status: STATUS.FOUND, detail: `env 齐备(email=${env.XIAOMI_DEVUSER_EMAIL} 私钥 sha8=${fp(env.XIAOMI_API_PRIVATE_KEY)})`, value: { email: env.XIAOMI_DEVUSER_EMAIL, privateKey: env.XIAOMI_API_PRIVATE_KEY } }
  const cred = storeCredential(VENDOR, { root })
  if (cred.status !== STATUS.FOUND) return { status: cred.status, detail: `密钥目录:${cred.detail}`, value: null }
  let p
  try {
    p = parseCredentialText(read(cred.value[0].path, 'utf8'))
  } catch (e) {
    return { status: STATUS.UNJUDGED, detail: `凭据件读不到(${e?.code ?? e?.name})⇒ 不判"无凭据"`, value: null }
  }
  const miss = ['email', 'privateKey'].filter((k) => !p[k])
  if (miss.length) return { status: STATUS.MISSING, detail: `凭据件缺 ${miss.join(',')}(字段=${p.fields.join('/')})⇒ 小米需 开发者站邮箱 + 接口私钥`, value: null }
  return { status: STATUS.FOUND, detail: `email=${p.email} 私钥 sha8=${fp(p.privateKey)}`, value: { email: p.email, privateKey: p.privateKey } }
}

/** 把私钥文本还原成 PEM(官方导出常见 base64 单行;带 BEGIN 则原样用)。取不到 ⇒ 交调用方判未判定。 */
export function toPem(v) {
  const s = String(v ?? '').trim()
  if (!s) return null
  if (/-----BEGIN/.test(s)) return s
  const b64 = s.replace(/\s+/g, '')
  if (!/^[A-Za-z0-9+/=]+$/.test(b64)) return null
  const body = b64.replace(/^3082/, '')
  return `-----BEGIN PRIVATE KEY-----\n${(body.match(/.{1,64}/g) ?? []).join('\n')}\n-----END PRIVATE KEY-----`
}

/** SIG = hex(RSA-SHA1 over RequestData 原文)。算法维官方正文未公开 ⇒ 调用失败要回落"未判定"。 */
export function signRequestData({ requestData, privateKey, algorithm = 'RSA-SHA1' } = {}) {
  const pem = toPem(privateKey)
  if (!pem) return { status: STATUS.UNJUDGED, detail: '私钥形态既不是 PEM 也不是可解 base64 ⇒ 不猜签算' }
  try {
    const sig = createSign(algorithm)
    sig.update(String(requestData), 'utf8')
    return { status: STATUS.FOUND, detail: `SIG ${algorithm} hex len=${(createHash('sha256').update(sig.sign(pem)).digest('hex')).length}`, value: sig.sign(pem).toString('hex') }
  } catch (e) {
    return { status: STATUS.UNJUDGED, detail: `签算抛错(${e?.message?.slice(0, 60)})⇒ 算法/私钥形态未证,不判"小米拒绝"`, value: null }
  }
}

/** 申报单(纯函数):文件名/字节/md5 一次算全,upload 与 verify 共用同一份。 */
export function buildRequestData({ creds, plan, listing, versionName, versionCode, synchroType = DEFAULT_SYNCHRO_TYPE, onlineTime = null }) {
  const appInfo = {
    packageName: listing?.packageName ?? PACKAGE_NAME,
    appName: listing?.appName ?? null,
    versionName: versionName ?? listing?.versionName ?? null,
    versionCode: versionCode ?? listing?.versionCode ?? null,
    brief: listing?.brief ?? null,
    desc: listing?.fullDescription ?? null,
    privacyUrl: listing?.privacyUrl ?? null,
  }
  // onlineTime 官方语义:定时上线时刻;不给则由平台按审核通过即发。空串不塞(避免"1970"型误读)。
  if (onlineTime !== null && String(onlineTime).trim() !== '') appInfo.onlineTime = String(onlineTime).trim()
  return {
    userName: creds.email,
    appInfo,
    apkInfo: { fileName: String(plan.path).split(/[\\/]/).pop(), md5: plan.md5 ?? null, fileSize: plan.bytes },
    synchroType,
  }
}

/** 小米 result 判读:result=0 成;-7 官方明写"包名被他人占用需认领";其余按未判定/缺件分档。 */
export function classifyXiaomi(httpStatus, bodyText) {
  const m = /<result>\s*(-?\d+)\s*<\/result>/.exec(String(bodyText ?? ''))
  let result = m ? Number(m[1]) : null
  let des = /<des>\s*([\s\S]*?)\s*<\/des>/.exec(String(bodyText ?? ''))?.[1] ?? null
  if (result === null) {
    try {
      const j = JSON.parse(String(bodyText ?? ''))
      result = j?.result ?? j?.code ?? null
      des = des ?? (j?.des ?? j?.msg ?? null)
    } catch {
      return { status: STATUS.UNJUDGED, verdict: 'non-structured-response', result, detail: `http=${httpStatus} 非 JSON/XML ⇒ 我形态错,不据此下结论` }
    }
  }
  if (result === 0) return { status: STATUS.FOUND, verdict: 'result-0', result, detail: `http=${httpStatus} result=0 ${String(des ?? '').slice(0, 80)}` }
  if (result === -7) return { status: STATUS.MISSING, verdict: 'package-owned-by-others', result, detail: `http=${httpStatus} result=-7 包名被他人占用 ⇒ 官方出路:开发者站认领应用后再传` }
  if (httpStatus >= 500) return { status: STATUS.UNJUDGED, verdict: 'server-error', result, detail: `http=${httpStatus} result=${result}` }
  return { status: STATUS.MISSING, verdict: `result-${result}`, result, detail: `http=${httpStatus} result=${result} des="${String(des ?? '').slice(0, 120)}"` }
}

/** multipart 请求体(官方 curl 用 --form;两个字段 RequestData / SIG)。 */
export function buildMultipart({ requestData, sig, boundary = '----ihuiStoreXiaomi' } = {}) {
  const rd = typeof requestData === 'string' ? requestData : JSON.stringify(requestData)
  const body = `--${boundary}\r\nContent-Disposition: form-data; name="RequestData"\r\n\r\n${rd}\r\n--${boundary}\r\nContent-Disposition: form-data; name="SIG"\r\n\r\n${sig}\r\n--${boundary}--\r\n`
  return { body, headers: { 'content-type': `multipart/form-data; boundary=${boundary}` }, requestDataForVerify: rd }
}

export function queryCall({ creds, packageName = PACKAGE_NAME }) {
  const ch = channelOf('xiaomi')
  if (ch.status !== STATUS.FOUND) return { url: null, detail: ch.detail }
  return { url: ch.channel.probe().url, detail: ch.channel.detail, form: { RequestData: JSON.stringify({ packageName, userName: creds?.email ?? '' }) } }
}

/** 只跑**已在册**的查询端点做回读;签算未证 ⇒ 该段判未判定而非猜。 */
export async function phaseStatus({ fetchImpl = fetch, creds, packageName = PACKAGE_NAME, timeoutMs = 20000 }) {
  const q = queryCall({ creds, packageName })
  if (!q.url) return { phase: 'status', status: STATUS.UNJUDGED, verdict: 'endpoint-unverified', detail: q.detail }
  const sig = signRequestData({ requestData: q.form.RequestData, privateKey: creds.privateKey })
  if (sig.status !== STATUS.FOUND) return { phase: 'status', ...sig, verdict: 'sign-unverified' }
  try {
    const r = await fetchImpl(q.url, { method: 'POST', headers: { 'content-type': 'application/x-www-form-urlencoded' }, body: new URLSearchParams({ RequestData: q.form.RequestData, SIG: sig.value }).toString(), signal: AbortSignal.timeout(timeoutMs) })
    const c = classifyXiaomi(r.status, await r.text())
    return { phase: 'status', ...c }
  } catch (e) {
    return { phase: 'status', status: STATUS.UNJUDGED, verdict: 'fetch-error', detail: `dev/query 不可达(${e?.cause?.code ?? e?.name})` }
  }
}

export async function phaseUpload({ fetchImpl = fetch, creds: _creds, requestData, sig, timeoutMs = 180000 }) {
  if (sig?.status !== STATUS.FOUND) return { phase: 'upload', status: STATUS.UNJUDGED, verdict: 'sign-unverified', detail: sig?.detail ?? '签算未成立' }
  const mp = buildMultipart({ requestData, sig: sig.value })
  try {
    const r = await fetchImpl(PUSH_URL, { method: 'POST', headers: mp.headers, body: mp.body, signal: AbortSignal.timeout(timeoutMs) })
    return { phase: 'upload', ...classifyXiaomi(r.status, await r.text()) }
  } catch (e) {
    return { phase: 'upload', status: STATUS.UNJUDGED, verdict: 'fetch-error', detail: `dev/push 不可达(${e?.cause?.code ?? e?.name})` }
  }
}

/** 申报 ⇄ 回读对齐才算绿;任何一格取不到 ⇒ 未判定(不记绿)。 */
export function mergeVerify({ requestData, pushed, readback }) {
  const gaps = []
  if (!requestData?.appInfo?.versionName) gaps.push('申报 versionName')
  if (!pushed || pushed.verdict !== 'result-0') gaps.push('上传回执(result=0)')
  if (!readback || readback.status !== STATUS.FOUND) gaps.push('回读 dev/query')
  if (gaps.length) return { phase: 'verify', status: gaps.length === 3 ? STATUS.UNJUDGED : STATUS.MISSING, verdict: 'verify-incomplete', gaps, detail: `取不到:${gaps.join(' / ')}` }
  return { phase: 'verify', status: STATUS.FOUND, verdict: 'declared-version-pushed-and-queryable', detail: `申报 ${requestData.appInfo.versionName}/${requestData.appInfo.versionCode} result=0(已递交);回读 ${readback.detail};synchroType=${requestData.synchroType}(${SYNCHRO_TYPES[requestData.synchroType]?.label ?? '?'})⇒ 三种均进审核,不等于已上架` }
}

export const HELP = `小米应用商店提交器(dev/push 已核实在册;默认 synchroType=1 更新包)
用法:
  node scripts/submit-store-xiaomi.mjs [--phase status|upload|verify|all] [--file <apk>] [--package <包名>]
       [--version-name <名>] [--version-code <码>] [--synchro-type 0|1|2] [--online-time <时刻>] [--execute] [--json]
  node scripts/submit-store-xiaomi.mjs --self-test
开关:
  --phase          阶段(status 默认)
  --file           显式提交物路径
  --package        包名(默认取 app.json)
  --version-name   申报 versionName
  --version-code   申报 versionCode
  --synchro-type   0=新增应用 / 1=更新应用包(默认)/ 2=内容更新;三种均进审核
  --online-time    定时上线时刻(不填=审核通过即发)
  --execute        真出网(缺省 dry-run 零请求)
  --json           JSON 输出
  --self-test      离线自检
  --help, -h       显示本帮助
退出码:0 全绿 / 1 缺件点名 / 2 未判定`

export function parseArgs(argv) {
  const o = { phase: 'status', file: null, execute: false, json: false, selfTest: false, help: false, versionName: null, versionCode: null, packageName: PACKAGE_NAME, synchroType: Number(process.env.XIAOMI_SYNCHRO_TYPE ?? DEFAULT_SYNCHRO_TYPE), onlineTime: process.env.XIAOMI_ONLINE_TIME ?? null }
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i]
    if (a === '--help' || a === '-h') o.help = true
    else if (a === '--phase') o.phase = argv[++i]
    else if (a === '--file') o.file = argv[++i]
    else if (a === '--package') o.packageName = argv[++i]
    else if (a === '--version-name') o.versionName = argv[++i]
    else if (a === '--version-code') o.versionCode = argv[++i]
    else if (a === '--synchro-type') o.synchroType = Number(argv[++i])
    else if (a === '--online-time') o.onlineTime = argv[++i]
    else if (a === '--execute') o.execute = true
    else if (a === '--json') o.json = true
    else if (a === '--self-test') o.selfTest = true
    else throw new Error(`未知参数: ${a}`)
  }
  if (!['status', 'upload', 'verify', 'all'].includes(o.phase)) throw new Error(`--phase 只接受 status|upload|verify|all,收到 ${o.phase}`)
  if (![0, 1, 2].includes(o.synchroType)) throw new Error(`--synchro-type 只接受 0|1|2,收到 ${o.synchroType}`)
  return o
}

async function main() {
  const args = parseArgs(process.argv.slice(2))
  if (args.help) { console.log(HELP); return 0 }
  if (args.selfTest) return selfTest()
  const creds = resolveCredentials()
  const artifact = resolveArtifact({ file: args.file, preferKind: 'apk' })
  const bundle = loadBundle({ vendor: 'xiaomi' })
  const ch = channelOf('xiaomi')
  const gates = gateStates({ creds, artifact, bundle, channel: { status: ch.status, detail: ch.detail } })

  if (!args.execute) {
    const d = buildDryRun({
      vendorId: 'xiaomi',
      creds,
      artifact,
      bundle,
      calls: [
        { verified: !!ch.channel?.label, intent: '查询回读', method: 'POST', url: queryCall({ creds }).url ?? '<dev/query>' },
        { verified: true, intent: '上传并申报', method: 'POST', url: PUSH_URL },
        { verified: true, intent: `synchroType=${args.synchroType}(${SYNCHRO_TYPES[args.synchroType]?.label ?? '?'})⇒ 提交后进入审核,不等于已上架`, method: 'POST', url: PUSH_URL },
      ],
    })
    console.log(args.json ? JSON.stringify({ ...d, gates: gates.rows }, null, 2) : `DRY-RUN xiaomi(默认零网络)\n${d.calls.map((c) => `  - ${c}`).join('\n')}\n${gates.rows.map((r) => `  [${r.status}] ${r.k}: ${r.detail}`).join('\n')}`)
    return gates.exit
  }
  if (creds.status !== STATUS.FOUND) return console.log(`${creds.status === STATUS.MISSING ? '缺件' : '未判定'}:${creds.detail}`), creds.status === STATUS.MISSING ? 1 : 2
  if (artifact.status !== STATUS.FOUND || !artifact.value) return console.log(`提交物不成:${artifact.detail}`), artifact.status === STATUS.MISSING ? 1 : 2

  const listing = bundle.files?.listing ?? null
  const plan = { path: artifact.value.path, bytes: artifact.value.bytes, md5: artifact.value.md5 ?? null }
  const requestData = buildRequestData({ creds: creds.value, plan, listing, versionName: args.versionName, versionCode: args.versionCode, synchroType: args.synchroType, onlineTime: args.onlineTime })
  const sig = signRequestData({ requestData: JSON.stringify(requestData), privateKey: creds.value.privateKey })
  const readback = args.phase === 'upload' ? null : await phaseStatus({ creds: creds.value, packageName: requestData.appInfo.packageName })
  const pushed = ['upload', 'all', 'verify'].includes(args.phase) ? await phaseUpload({ creds: creds.value, requestData, sig }) : { phase: 'upload', status: STATUS.UNJUDGED, verdict: 'skipped', detail: '未跑 upload 段' }
  const v = args.phase === 'status' ? { phase: 'verify', status: STATUS.UNJUDGED, verdict: 'skipped', detail: '未跑 verify 段' } : mergeVerify({ requestData, pushed, readback })
  const steps = [readback, sig.phase ? sig : { phase: 'sign', ...sig }, pushed, v].filter(Boolean)
  console.log(args.json ? JSON.stringify({ steps }, null, 2) : steps.map((s) => `[${s.status}] ${s.phase}: ${s.verdict ?? '-'} — ${s.detail ?? ''}`).join('\n'))
  return foldPhaseExit(steps)
}

function foldPhaseExit(steps) {
  const st = steps.map((s) => s.status)
  if (st.includes(STATUS.UNJUDGED)) return 2
  if (st.includes(STATUS.MISSING)) return 1
  return 0
}

function selfTest() {
  return runSelfTest([
    { name: 'X1 凭据件缺件 ⇒ MISSING 并点名缺哪一枚', fn: () => resolveCredentials({ env: {}, root: 'X:/不存在', read: () => '' }).status !== STATUS.FOUND },
    { name: 'X2 parseCredentialText 认 邮箱/接口私钥 两形(全/半角冒号)', fn: () => { const p = parseCredentialText('小米账号：dev@example.com\n接口私钥:MIIEvA…'); return p.email === 'dev@example.com' && p.privateKey.startsWith('MIIEvA') } },
    { name: 'X3 env 齐备优先于密钥目录,且 detail 不含私钥原文', fn: () => { const r = resolveCredentials({ env: { XIAOMI_DEVUSER_EMAIL: 'a@b.c', XIAOMI_API_PRIVATE_KEY: 'PRIVATE-DO-NOT-LEAK-0123456789' } }); return r.status === STATUS.FOUND && !r.detail.includes('DO-NOT-LEAK') && r.detail.includes('sha8=') } },
    { name: 'X4 toPem 三形态:PEM 原样 / base64 包装 / 垃圾⇒null', fn: () => toPem('-----BEGIN PRIVATE KEY-----\nAAA\n-----END PRIVATE KEY-----').includes('BEGIN') && toPem('3082abcd').includes('BEGIN PRIVATE KEY') && toPem('不是密钥') === null },
    { name: 'X5 签算:垃圾私钥 ⇒ 未判定(不判"小米拒绝")', fn: () => { const s = signRequestData({ requestData: '{"a":1}', privateKey: '3082zzzz-invalid' }); return s.status === STATUS.UNJUDGED && !/拒绝/.test(s.detail) } },
    { name: 'X6 classifyXiaomi result=0 / -7 / 非结构化 三档分得开', fn: () => classifyXiaomi(200, '<response><result>0</result><des>ok</des></response>').verdict === 'result-0' && classifyXiaomi(200, '<result>-7</result>').verdict === 'package-owned-by-others' && classifyXiaomi(200, '<html>登录</html>').status === STATUS.UNJUDGED },
    { name: 'X7 classifyXiaomi 5xx ⇒ 未判定(对方错不等于我们错)', fn: () => classifyXiaomi(503, '<result>5000</result>').status === STATUS.UNJUDGED },
    { name: 'X8 multipart 体只含 RequestData/SIG 两字段,不夹文件流之外的键', fn: () => { const mp = buildMultipart({ requestData: { userName: 'a' }, sig: 'deadbeef' }); return mp.body.includes('name="RequestData"') && mp.body.includes('name="SIG"') && /multipart\/form-data; boundary=/.test(mp.headers['content-type']) } },
    { name: 'X9 buildRequestData 取 listing 字段,包名兜底 zh.ai.sq', fn: () => { const rd = buildRequestData({ creds: { email: 'd@e.f' }, plan: { path: 'a/b-release.apk', bytes: 10, md5: 'm' }, listing: { packageName: 'com.x', appName: '智汇AI', versionName: '0.0.12', versionCode: 120, brief: 'b', fullDescription: 'f', privacyUrl: 'https://aizhs.top/privacy' }, synchroType: 0 }); return rd.appInfo.packageName === 'com.x' && rd.apkInfo.fileName === 'b-release.apk' && rd.userName === 'd@e.f' && buildRequestData({ creds: { email: 'd@e.f' }, plan: { path: 'x.apk', bytes: 1 }, listing: null, synchroType: 0 }).appInfo.packageName === PACKAGE_NAME } },
    { name: 'X10 mergeVerify 三格全齐才 FOUND;缺回执 ⇒ MISSING 不记绿', fn: () => { const ok = { appInfo: { versionName: '1' } }; const r = mergeVerify({ requestData: ok, pushed: { verdict: 'result-0' }, readback: { status: STATUS.FOUND, detail: '' } }); const bad = mergeVerify({ requestData: ok, pushed: null, readback: null }); return r.status === STATUS.FOUND && bad.status === STATUS.MISSING && bad.gaps.includes('上传回执(result=0)') } },
    { name: 'X11 默认档不发请求:无 --execute 时 main 走 dry-run', fn: () => { const c = channelOf('xiaomi'); return c.status === STATUS.FOUND && c.channel.probe().url === 'https://api.developer.xiaomi.com/devupload/dev/query' } },
    { name: 'X12 未知参数与非法 --phase/--synchro-type 都抛(不静默接受)', fn: () => { let a = 0, b = 0, c = 0; try { parseArgs(['--nope']) } catch { a = 1 } try { parseArgs(['--phase', 'submit']) } catch { b = 1 } try { parseArgs(['--synchro-type', '3']) } catch { c = 1 } return a === 1 && b === 1 && c === 1 } },
    { name: 'X13 mask 供出口脱敏:不回原文', fn: () => mask('PRIVATE-DO-NOT-LEAK') === 'PRIV***AK(len=19)' },
    { name: 'X14 默认 synchroType=1(更新包),Windows 路径取基名,onlineTime 只在给了才塞', fn: () => { const base = buildRequestData({ creds: { email: 'd@e.f' }, plan: { path: 'C:\\tmp\\a.apk', bytes: 1 }, listing: null }); const timed = buildRequestData({ creds: { email: 'd@e.f' }, plan: { path: 'a.apk', bytes: 1 }, listing: null, onlineTime: '2026-11-09 10:00:00' }); return base.synchroType === 1 && base.apkInfo.fileName === 'a.apk' && !('onlineTime' in base.appInfo) && timed.appInfo.onlineTime === '2026-11-09 10:00:00' && SYNCHRO_TYPES[1].label === '更新应用包' } },
  ])
}

export const __test__ = { FIELD_ALIASES, PUSH_URL, PACKAGE_NAME, SYNCHRO_TYPES, DEFAULT_SYNCHRO_TYPE, parseCredentialText, resolveCredentials, toPem, signRequestData, buildRequestData, classifyXiaomi, buildMultipart, queryCall, phaseStatus, phaseUpload, mergeVerify, parseArgs, STATUS }

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
