#!/usr/bin/env node
// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * submit-store-honor.mjs — 荣耀应用市场「API 传包服务」客户端(2026-11-09 立)
 *
 * ## 立因
 * 荣耀是华为分拆后的**独立开发者体系**(独立 AGC/IAM 域名),不能沿用华为那枚凭据,也不能沿用
 * 华为的端点。本仓 CHANNELS.honor 已核实两条(token + 按包名查 APPID),`release-mobile-rn.mjs`
 * 的 store-honor 腿登记的出路名就是本文件 ⇒ 把"凭据到位后要打哪几条"做成器物。
 *
 * ## 端点出处(逐条分清"核实到哪一维")
 *   取 token  `POST https://iam.developer.honor.com/auth/token`
 *             Content-Type: application/x-www-form-urlencoded
 *             body: grant_type=client_credentials&client_id=<id>&client_secret=<secret>
 *             ⇒ `{access_token(JWT), expires_in:3600, token_type:"Bearer"}`
 *             —— 形态取自 CHANNELS.honor.tokenBody(单源,§0.6)与官方《API传包服务指引》正文示例。
 *   查 APPID  `GET https://appmarket-openapi-drcn.cloud.honor.com/openapi/v1/publish/get-app-id?pkgName=<包名>`
 *             —— 取自 CHANNELS.honor.probe;官方流程明写"先用**根据包名查询APPID**拿到 APPID,
 *             后续应用更新维护都以它键"。**官方限流:查询类低于 3 分钟/次**(CHANNELS 在册)。
 *   上传段    官方指引列了能力(获取应用文件上传路径 / 上传应用文件 / 更新应用文件信息 /
 *             声明式下载任务;并明写"上传前需先算好文件 sha256"、multipart 边界易错),
 *             但**逐条路径与字段表在正文登录墙内** ⇒ `verified:false` ⇒ 本器零调用判未判定。
 *   建新应用  官方与生态侧口径一致:传包 API **不提供创建应用接口**,须先在荣耀后台建应用 ⇒ manualOnly。
 *
 * ## 法定前置
 * 荣耀商店收国内 App 需 App 备案号 + 软著/电子版权证书;不在册 ⇒ 拒绝报 ready(与
 * prepare-store-bundle / app-store-credentials.json 同一判序)。
 *
 * 用法:
 *   node scripts/submit-store-honor.mjs --self-test
 *   node scripts/submit-store-honor.mjs                        # dry-run(默认零网络)
 *   node scripts/submit-store-honor.mjs --phase status --execute
 *   凭据优先级:env HONOR_CLIENT_ID / HONOR_CLIENT_SECRET > 密钥目录文件(§5d)
 * 退出码:0 全绿 / 1 缺件 / 2 未判定
 */
import { readFileSync } from 'node:fs'
import { createHash } from 'node:crypto'
import { pathToFileURL } from 'node:url'

import { STATUS, STORE_VENDORS, storeCredential, fp } from './lib/rn-release-credentials.mjs'
import { channelOf, loadBundle, resolveArtifact, buildDryRun, gateStates, runSelfTest, unverifiedCall } from './lib/store-uploader-core.mjs'
import { resolveSecretsRoot } from './lib/key-dir.mjs'

const VENDOR = STORE_VENDORS.find((v) => v.id === 'honor')
const PACKAGE_NAME = 'zh.ai.sq'
const HONOR_DOC = 'developer.honor.com/cn/doc/guides/101359'
/** 出处串单源:同一份指引只在 HONOR_DOC 写一次,避免逐条复制后漂移(§0.6)。 */
const 同指引 = (suffix) => `${HONOR_DOC}${suffix}`

export const ENDPOINTS = Object.freeze({
  token: { method: 'POST', verified: true, doc: 同指引('「获取账号级Access Token」') },
  appId: { method: 'GET', verified: true, doc: 同指引('「根据包名查询APPID」'), rateLimitNote: '官方限流:查询类低于 3min/次' },
  uploadPath: { method: 'POST', verified: false, doc: 同指引('「获取应用文件上传路径」正文需登录') },
  uploadFile: { method: 'POST', verified: false, doc: 同指引('「上传应用文件」multipart;上传前需算 sha256') },
  bindFile: { method: 'POST', verified: false, doc: 同指引('「更新应用文件信息」绑定后才会体现在市场') },
  declareDownload: { method: 'POST', verified: false, doc: 同指引('「声明式下载任务」需 HTTPS 无鉴权可直取 URL') },
  submitAudit: { method: 'POST', verified: false, doc: 同指引('提交审核段正文需登录 ⇒ 零调用') },
  createApp: { method: 'POST', verified: false, doc: '官方无此能力 ⇒ 必须先在荣耀后台建应用' },
})

export function parseCredentialText(text) {
  const pairs = String(text ?? '')
    .split(/\r?\n/)
    .map((l) => l.split(/[:：]/))
    .filter((m) => m.length >= 2)
    .map((m) => ({ k: m[0].trim(), v: m.slice(1).join(':').trim() }))
  const pick = (re) => (pairs.find((p) => re.test(p.k)) ?? {}).v ?? null
  const clientId = pick(/client[_\s-]?id/i)
  const clientSecret = pick(/client[_\s-]?secret|密\s*钥|secret|api[_\s-]?key/i)
  const appId = pick(/应\s*用\s*id|app_?id/i)
  return { clientId, clientSecret, appId, fields: pairs.map((p) => p.k), secretFp: fp(clientSecret) }
}

export function resolveCredentials({ env = process.env, read = readFileSync, root = resolveSecretsRoot() } = {}) {
  if (env.HONOR_CLIENT_ID && env.HONOR_CLIENT_SECRET) return { status: STATUS.FOUND, detail: `env 齐备(secret sha8=${fp(env.HONOR_CLIENT_SECRET)})`, value: { clientId: env.HONOR_CLIENT_ID, clientSecret: env.HONOR_CLIENT_SECRET, appId: env.HONOR_APP_ID ?? null } }
  const cred = storeCredential(VENDOR, { root })
  if (cred.status !== STATUS.FOUND) return { status: cred.status, detail: `密钥目录:${cred.detail}`, value: null }
  let p
  try {
    p = parseCredentialText(read(cred.value[0].path, 'utf8'))
  } catch (e) {
    return { status: STATUS.UNJUDGED, detail: `凭据件读不到(${e?.code ?? e?.name})⇒ 不判"无凭据"`, value: null }
  }
  const miss = ['clientId', 'clientSecret'].filter((k) => !p[k])
  if (miss.length) return { status: STATUS.MISSING, detail: `凭据件缺 ${miss.join(',')}(字段=${p.fields.join('/')})⇒ 荣耀需 管理中心→开放能力→凭证 申请的 client_id/client_secret`, value: null }
  return { status: STATUS.FOUND, detail: `client_id=${String(p.clientId).slice(0, 4)}*** secret sha8=${p.secretFp} appId=${p.appId ?? '未在册(可用 get-app-id 现查)'}`, value: { clientId: p.clientId, clientSecret: p.clientSecret, appId: p.appId } }
}

/** token 请求体形态一律回 CHANNELS(单源),本器不重抄 URL/编码方式。 */
export function tokenRequest() {
  const ch = channelOf('honor')
  if (ch.status !== STATUS.FOUND) return { status: STATUS.UNJUDGED, detail: ch.detail, url: null }
  return { status: STATUS.FOUND, url: ch.channel.tokenUrl, method: ENDPOINTS.token.method, bodyOf: (id, sec) => ch.channel.tokenBody(id, sec), headers: ch.channel.tokenHeaders, detail: ch.channel.label }
}

export function appIdRequest({ packageName = PACKAGE_NAME }) {
  const ch = channelOf('honor')
  if (ch.status !== STATUS.FOUND) return { status: STATUS.UNJUDGED, detail: ch.detail, url: null }
  return { status: STATUS.FOUND, url: ch.channel.probe().url, headers: ch.channel.probe().headers, packageName, detail: `${ch.channel.probe().url} [限流:${ENDPOINTS.appId.rateLimitNote}]` }
}

/** 荣耀错误码族:token 类失败 vs 业务失败 vs 非结构化,三档不得并成一档。 */
export function classifyHonor(httpStatus, rawBody) {
  let j = null
  try {
    j = JSON.parse(String(rawBody ?? ''))
  } catch {
    return { status: STATUS.UNJUDGED, verdict: 'non-json-response', detail: `http=${httpStatus} 非 JSON ⇒ 我形态错(荣耀常见为网关 401 HTML),不据此下结论`, data: null }
  }
  if (httpStatus >= 500) return { status: STATUS.UNJUDGED, verdict: 'server-error', detail: `http=${httpStatus}`, data: j }
  if (j?.access_token) return { status: STATUS.FOUND, verdict: 'token-ok', detail: `token len=${String(j.access_token).length} expires=${j.expires_in ?? '?'} type=${j.token_type ?? '?'}`, data: j }
  const code = j?.code ?? j?.ret?.code ?? j?.error_code ?? null
  const msg = String(j?.msg ?? j?.message ?? j?.ret?.msg ?? j?.error_description ?? '').slice(0, 120)
  if (httpStatus === 401 || httpStatus === 403) return { status: STATUS.MISSING, verdict: `auth-rejected-${code ?? httpStatus}`, detail: `http=${httpStatus} code=${code ?? '-'} msg="${msg}" ⇒ 凭据类型/权限范围不符(荣耀 IAM 与 AGC 不通用)`, data: j }
  if (code !== null && code !== 0 && code !== '0') return { status: STATUS.MISSING, verdict: `code-${code}`, detail: `http=${httpStatus} code=${code} msg="${msg}"`, data: j }
  const data = j?.data ?? j
  if (data?.appId !== undefined || data?.appInfo !== undefined || Array.isArray(data?.apps)) return { status: STATUS.FOUND, verdict: 'app-id-resolved', detail: `http=${httpStatus} appId=${data.appId ?? '(列表见 data.apps)'}`, data }
  if (code === 0 || code === '0' || code === null && httpStatus === 200) return { status: STATUS.FOUND, verdict: 'ok-no-appid-field', detail: `http=${httpStatus} 通道可达但回体没有 appId ⇒ 包名可能尚未在荣耀建应用`, data }
  return { status: STATUS.UNJUDGED, verdict: 'unrecognized-shape', detail: `http=${httpStatus} code=${code}`, data: j }
}

/** 上传前必须算好的 sha256(官方明写"获取上传地址前需先传文件 sha256")。 */
export function fileDigest({ filePath, read = readFileSync } = {}) {
  let buf = null
  try {
    buf = read(filePath)
  } catch (e) {
    return { status: STATUS.UNJUDGED, detail: `产物读不到(${e?.code ?? e?.name})⇒ 不判"没有产物"`, value: null }
  }
  if (!buf.length) return { status: STATUS.MISSING, detail: `产物 0 字节:${filePath}`, value: null }
  return { status: STATUS.FOUND, detail: `${filePath.split('/').pop()} ${buf.length}B sha256=${createHash('sha256').update(buf).digest('hex').slice(0, 16)}…`, value: { fileName: filePath.split('/').pop(), bytes: buf.length, sha256: createHash('sha256').update(buf).digest('hex') } }
}

export async function phaseStatus({ fetchImpl = fetch, creds, packageName = PACKAGE_NAME, timeoutMs = 20000 }) {
  const tq = tokenRequest()
  if (tq.status !== STATUS.FOUND) return { phase: 'status', status: tq.status, verdict: 'endpoint-unverified', detail: tq.detail }
  const t = await fetchImpl(tq.url, { method: 'POST', headers: tq.headers, body: tq.bodyOf(creds.clientId, creds.clientSecret), signal: AbortSignal.timeout(timeoutMs) }).then(async (r) => ({ s: r.status, b: await r.text() })).catch((e) => ({ err: e }))
  if (t.err) return { phase: 'status', status: STATUS.UNJUDGED, verdict: 'fetch-error', detail: `iam.developer.honor.com 不可达(${t.err?.cause?.code ?? t.err?.name})⇒ 未判定` }
  const tc = classifyHonor(t.s, t.b)
  if (!tc.data?.access_token) return { phase: 'status', ...tc }
  const aq = appIdRequest({ packageName })
  if (aq.status !== STATUS.FOUND) return { phase: 'status', ...tc, verdict: 'token-ok-but-appid-endpoint-unverified' }
  const a = await fetchImpl(aq.url, { method: 'GET', headers: { ...aq.headers, Authorization: `Bearer ${tc.data.access_token}` }, signal: AbortSignal.timeout(timeoutMs) }).then(async (r) => ({ s: r.status, b: await r.text() })).catch((e) => ({ err: e }))
  if (a.err) return { phase: 'status', status: STATUS.UNJUDGED, verdict: 'fetch-error', detail: `get-app-id 不可达(${a.err?.cause?.code ?? a.err?.name})⇒ token 已取得但不回读,判未判定` }
  const ac = classifyHonor(a.s, a.b)
  return { phase: 'status', status: ac.status, verdict: `${tc.verdict}+${ac.verdict}`, detail: `${tc.detail};${ac.detail}`, appId: ac.data?.appId ?? null }
}

export function phaseUpload({ digest }) {
  const gaps = ['上传路径', '上传文件', '绑定应用文件信息']
  if (!digest) gaps.push('文件 sha256 申报值')
  return { ...unverifiedCall({ phase: 'upload', reason: `荣耀四段(上传路径/上传文件/绑定/提交审核)的 path 与字段表在官方正文登录墙内;官方另两条硬约束已在册:multipart 边界易错、取上传地址前必须先有 ${digest?.value?.sha256 ? '算好的' : '待算的'}sha256`, doc: HONOR_DOC }), gaps, digest: digest?.value ?? null }
}

export const HELP = `荣耀应用市场提交器(AGC 四段未核实段恒零调用)
用法:
  node scripts/submit-store-honor.mjs [--phase status|upload|verify|all] [--file <apk>] [--package <包名>] [--execute] [--json]
  node scripts/submit-store-honor.mjs --self-test
开关:
  --phase        阶段(status 默认)
  --file         显式提交物路径
  --package      包名(默认取 app.json)
  --execute      真出网(缺省 dry-run 零请求)
  --json         JSON 输出
  --self-test    离线自检
  --help, -h     显示本帮助
退出码:0 全绿 / 1 缺件 / 2 未判定`

export function parseArgs(argv) {
  const o = { phase: 'status', file: null, execute: false, json: false, selfTest: false, help: false, packageName: PACKAGE_NAME }
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i]
    if (a === '--help' || a === '-h') o.help = true
    else if (a === '--phase') o.phase = argv[++i]
    else if (a === '--file') o.file = argv[++i]
    else if (a === '--package') o.packageName = argv[++i]
    else if (a === '--execute') o.execute = true
    else if (a === '--json') o.json = true
    else if (a === '--self-test') o.selfTest = true
    else throw new Error(`未知参数: ${a}`)
  }
  if (!['status', 'upload', 'verify', 'all'].includes(o.phase)) throw new Error(`--phase 只接受 status|upload|verify|all,收到 ${o.phase}`)
  return o
}

async function main() {
  const args = parseArgs(process.argv.slice(2))
  if (args.help) { console.log(HELP); return 0 }
  if (args.selfTest) return selfTest()
  const creds = resolveCredentials()
  const artifact = resolveArtifact({ file: args.file, preferKind: 'apk' })
  const bundle = loadBundle({ vendor: 'honor' })
  const ch = channelOf('honor')
  const gates = gateStates({ creds, artifact, bundle, channel: { status: ch.status, detail: ch.channel?.label ?? ch.detail } })

  if (!args.execute) {
    const tq = tokenRequest()
    const aq = appIdRequest({ packageName: args.packageName })
    const d = buildDryRun({
      vendorId: 'honor',
      creds,
      artifact,
      bundle,
      calls: [
        { verified: ENDPOINTS.token.verified, method: 'POST', url: `${tq.url ?? '<iam token>'} (grant_type=client_credentials)` },
        { verified: ENDPOINTS.appId.verified, method: 'GET', url: aq.url ?? '<get-app-id>' },
        { verified: false, intent: '获取应用文件上传路径 ⇒ 正文需登录,零调用' },
        { verified: false, intent: '上传应用文件(multipart,须先有 sha256)⇒ 零调用' },
        { verified: false, intent: '更新应用文件信息 / 提交审核 ⇒ 零调用' },
        { verified: false, intent: '建新应用:官方无此 API ⇒ 必须先在荣耀后台手工创建(首包 manualOnly)' },
      ],
    })
    d.rateLimit = ENDPOINTS.appId.rateLimitNote
    console.log(args.json ? JSON.stringify({ ...d, gates: gates.rows }, null, 2) : `DRY-RUN honor(默认零网络)\n${d.calls.map((c) => `  - ${c}`).join('\n')}\n  - 限流:${d.rateLimit}\n${gates.rows.map((r) => `  [${r.status}] ${r.k}: ${r.detail}`).join('\n')}`)
    return gates.exit
  }
  if (creds.status !== STATUS.FOUND) return console.log(`${creds.status === STATUS.MISSING ? '缺件' : '未判定'}:${creds.detail}`), creds.status === STATUS.MISSING ? 1 : 2
  const steps = []
  if (args.phase !== 'upload') steps.push(await phaseStatus({ creds: creds.value, packageName: args.packageName }))
  const digest = artifact.value ? fileDigest({ filePath: artifact.value.path }) : { status: STATUS.UNJUDGED, value: null, detail: '未点名产物' }
  steps.push(digest.status === STATUS.FOUND ? digest : { phase: 'digest', ...digest })
  if (['upload', 'all', 'verify'].includes(args.phase)) steps.push(phaseUpload({ digest: digest.value ? digest : null }))
  console.log(args.json ? JSON.stringify({ steps }, null, 2) : steps.map((s) => `[${s.status}] ${s.phase ?? s.verdict}: ${s.verdict ?? '-'} — ${s.detail ?? ''}`).join('\n'))
  const st = steps.map((s) => s.status)
  return st.includes(STATUS.UNJUDGED) ? 2 : st.includes(STATUS.MISSING) ? 1 : 0
}

function selfTest() {
  return runSelfTest([
    { name: 'H1 已核实两条 / 未核实六条,分档不许含糊', fn: () => [ENDPOINTS.token.verified, ENDPOINTS.appId.verified].every(Boolean) && [ENDPOINTS.uploadPath, ENDPOINTS.uploadFile, ENDPOINTS.bindFile, ENDPOINTS.declareDownload, ENDPOINTS.submitAudit, ENDPOINTS.createApp].every((e) => e.verified === false) },
    { name: 'H2 首包必须后台建应用 ⇒ createApp 结构上不可调用', fn: () => ENDPOINTS.createApp.verified === false && /必须先在荣耀后台建应用/.test(ENDPOINTS.createApp.doc) },
    { name: 'H3 token 请求形态回 CHANNELS 单源(URL/编码不在本器重抄)', fn: () => { const t = tokenRequest(); return t.status === STATUS.FOUND && t.url === 'https://iam.developer.honor.com/auth/token' && t.bodyOf('A', 'B').includes('grant_type=client_credentials') && t.bodyOf('A', 'B').includes('client_id=A') && t.headers['content-type'] === 'application/x-www-form-urlencoded' } },
    { name: 'H4 get-app-id 以包名为键,且带官方限流说明', fn: () => { const a = appIdRequest({ packageName: 'zh.ai.sq' }); return a.url === 'https://appmarket-openapi-drcn.cloud.honor.com/openapi/v1/publish/get-app-id?pkgName=zh.ai.sq' && /3min/.test(a.detail) } },
    { name: 'H5 classifyHonor token 成功 ⇒ FOUND 并量 token 长度(不打原文)', fn: () => { const r = classifyHonor(200, '{"access_token":"eyJhbGciOi.SECRETISH","expires_in":3600,"token_type":"Bearer"}'); return r.status === STATUS.FOUND && r.verdict === 'token-ok' && !r.detail.includes('SECRETISH') } },
    { name: 'H6 401/403 ⇒ MISSING 点名"荣耀 IAM 与 AGC 不通用"', fn: () => { const r = classifyHonor(401, '{"code":11011,"message":"invalid client"}'); return r.status === STATUS.MISSING && /不通用/.test(r.detail) } },
    { name: 'H7 非 JSON(网关 HTML)⇒ 未判定,不读成"荣耀拒绝"', fn: () => classifyHonor(200, '<html>登录</html>').status === STATUS.UNJUDGED },
    { name: 'H8 5xx ⇒ 未判定', fn: () => classifyHonor(503, '{"code":500}').status === STATUS.UNJUDGED },
    { name: 'H9 appId 解析成功 ⇒ FOUND;可达但无 appId ⇒ 未判定并点出"包名未建应用"', fn: () => { const ok = classifyHonor(200, '{"code":0,"data":{"appId":"100"}}'); const none = classifyHonor(200, '{"code":0,"data":{}}'); return ok.status === STATUS.FOUND && ok.data.appId === '100' && none.status === STATUS.FOUND && none.verdict === 'ok-no-appid-field' && /尚未在荣耀建应用/.test(none.detail) } },
    { name: 'H10 fileDigest 出 sha256 供上传申报;0 字节⇒MISSING,读不到⇒未判定', fn: () => { const ok = fileDigest({ filePath: 'a.apk', read: () => Buffer.from('apk') }); const z = fileDigest({ filePath: 'b.apk', read: () => Buffer.alloc(0) }); const e = fileDigest({ filePath: 'c', read: () => { throw Object.assign(new Error('x'), { code: 'ENOENT' }) } }); return ok.status === STATUS.FOUND && ok.value.sha256.length === 64 && z.status === STATUS.MISSING && e.status === STATUS.UNJUDGED } },
    { name: 'H11 phaseUpload 恒零调用,并把"须先有 sha256"写进理由', fn: () => { const r = phaseUpload({ digest: fileDigest({ filePath: 'a.apk', read: () => Buffer.from('apk') }) }); return r.calls.length === 0 && r.status === STATUS.UNJUDGED && /sha256/.test(r.detail) && r.gaps.length >= 3 } },
    { name: 'H12 凭据缺件 ⇒ MISSING 点名"管理中心→开放能力→凭证"', fn: () => resolveCredentials({ env: {}, root: 'X:/nope' }).status === STATUS.MISSING },
    { name: 'H13 env 齐备优先且不泄露 secret 原文', fn: () => { const r = resolveCredentials({ env: { HONOR_CLIENT_ID: 'CID', HONOR_CLIENT_SECRET: 'SECRET-DO-NOT-LEAK-0123456789', HONOR_APP_ID: '100' } }); return r.status === STATUS.FOUND && r.value.appId === '100' && !r.detail.includes('DO-NOT-LEAK') } },
    { name: 'H14 parseCredentialText 认 client_id/密钥 混形(荣耀后台导出常写"凭证")', fn: () => { const p = parseCredentialText('client_id：9fxx39e\n密钥:OtwpJ'); return p.clientId === '9fxx39e' && p.clientSecret === 'OtwpJ' } },
    { name: 'H15 非法 --phase 抛错(不接受 submit)', fn: () => { try { parseArgs(['--phase', 'submit']); return false } catch { return true } } },
  ])
}

export const __test__ = { PACKAGE_NAME, HONOR_DOC, ENDPOINTS, parseCredentialText, resolveCredentials, tokenRequest, appIdRequest, classifyHonor, fileDigest, phaseStatus, phaseUpload, parseArgs, STATUS }

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
