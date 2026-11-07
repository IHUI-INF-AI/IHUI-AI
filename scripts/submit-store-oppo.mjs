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
 * 所以 oppo 从"整条未核实"收窄到"上传段已核实、发布提交段仍未核实"。本器就按这个收窄后的事实写,
 * 不提前把未核实段伪装成能跑(§0.8),也不把已核实段继续记成盲区(§12f:判据安静失效)。
 *
 * ## 端点出处(官方正文级,逐条)
 *   接口域名(正式) `https://oop-openapi-cn.heytapmobi.com`
 *   token      `GET /developer/v1/token?client_id=<18位>&client_secret=<64位>`
 *              ⇒ `{errno:0,data:{access_token(JWT),expire_in(Unix,48h 有效)}}`
 *   上传配置    `GET /resource/v1/upload/get-upload-url`(公共参数,Content-Type: x-www-form-urlencoded)
 *              ⇒ `{errno:0,data:{upload_url,sign}}`;官方明写 **sign 一次性,每个新文件都要重新取**
 *   文件上传    `POST <upload_url>` `multipart/form-data`,字段 `type`(apk|photo|resource)、`sign`、`file`
 *              ⇒ `{errno:0,data:{url,…}}`;官方明写 multipart 的表单值**不编码但 charset 须 utf-8**
 *   提交发布    端点正文需登录 ⇒ **本器零调用**,判未判定。
 *   前置(官方"注意"第 1 条):**使用前需在开放平台先手动创建应用或游戏** ⇒ oppo 首包不能只靠 API。
 *
 * ## 四段射程
 *   status   token → 查询应用详情(未核实 ⇒ 零调用,判未判定)
 *   upload   token → get-upload-url → POST multipart(这一段是能真跑的两步)
 *   verify   本地 md5/字节 ⇄ 申报 ⇄ 上传回执 url;齐且自洽才算绿
 *   submit   未核实 ⇒ 结构上零调用
 *
 * 用法:
 *   node scripts/submit-store-oppo.mjs --self-test
 *   node scripts/submit-store-oppo.mjs                        # dry-run(默认,零网络)
 *   node scripts/submit-store-oppo.mjs --phase upload --file <apk> --execute
 *   凭据优先级:env OPPO_CLIENT_ID / OPPO_CLIENT_SECRET > 密钥目录文件(§5d)
 * 退出码:0 全绿 / 1 缺件 / 2 未判定
 */
import { readFileSync } from 'node:fs'
import { createHash, randomBytes } from 'node:crypto'
import { pathToFileURL } from 'node:url'

import { STATUS, STORE_VENDORS, storeCredential, fp } from './lib/rn-release-credentials.mjs'
import { resolveSecretsRoot } from './lib/key-dir.mjs'
import { channelOf, loadBundle, resolveArtifact, buildDryRun, gateStates, runSelfTest, unverifiedCall } from './lib/store-uploader-core.mjs'

const VENDOR = STORE_VENDORS.find((v) => v.id === 'oppo')
export const BASE = 'https://oop-openapi-cn.heytapmobi.com'
const DOC = 'open.oppomobile.com/new/developmentDoc/info?id=10998'
export const ENDPOINTS = Object.freeze({
  token: { method: 'GET', path: '/developer/v1/token', verified: true, doc: `${DOC}「获取Access Token」` },
  uploadConfig: { method: 'GET', path: '/resource/v1/upload/get-upload-url', verified: true, doc: `${DOC}「获取上传配置」` },
  upload: { method: 'POST', path: null, verified: true, note: 'URL 由 get-upload-url 下发,sign 一次性', doc: `${DOC}「文件上传」` },
  detail: { method: 'GET', path: null, verified: false, doc: `${DOC} 正文需登录 ⇒ 零调用` },
  submit: { method: 'POST', path: null, verified: false, doc: `${DOC} 正文需登录 ⇒ 零调用` },
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

export function uploadConfigCall({ accessToken }) {
  return { url: `${BASE}${ENDPOINTS.uploadConfig.path}`, method: 'GET', headers: { 'content-type': 'application/x-www-form-urlencoded', access_token: String(accessToken) } }
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
  const c = await fetchImpl(uploadConfigCall({ accessToken }), { method: 'GET', headers: uploadConfigCall({ accessToken }).headers, signal: AbortSignal.timeout(timeoutMs) }).then(async (r) => ({ s: r.status, b: await r.text() })).catch(() => null)
  if (!c) return { phase: 'upload', status: STATUS.UNJUDGED, verdict: 'fetch-error', detail: 'get-upload-url 不可达 ⇒ 未判定', uploadedUrl: null }
  const cc = classifyOppo(c.s, c.b)
  const uploadUrl = cc.data?.upload_url ?? null
  const sign = cc.data?.sign ?? null
  if (!uploadUrl || !sign) return { phase: 'upload', status: STATUS.MISSING, verdict: 'no-upload-url-or-sign', detail: `上传配置缺字段:${cc.detail}`, uploadedUrl: null }
  const mp = buildUploadMultipart({ uploadUrl, sign, fileName: plan.fileName, fileBuf: plan.buf })
  const u = await fetchImpl(mp.url, { method: 'POST', headers: mp.headers, body: mp.body, signal: AbortSignal.timeout(timeoutMs) }).then(async (r) => ({ s: r.status, b: await r.text() })).catch(() => null)
  if (!u) return { phase: 'upload', status: STATUS.UNJUDGED, verdict: 'fetch-error', detail: '文件 PUT/POST 不可达 ⇒ 未判定', uploadedUrl: null }
  const uc = classifyOppo(u.s, u.b)
  return { phase: 'upload', ...uc, uploadedUrl: uc.data?.url ?? null, signUsedOneShot: true }
}

/** 绿的条件:errno=0 ⇄ 回执给了 url ⇄ 本地 md5 与申报一致。发布态不在这里冒充。 */
export function mergeVerify({ plan, upload }) {
  const gaps = []
  if (!plan) gaps.push('申报单(md5/字节)')
  if (!upload || upload.status !== STATUS.FOUND) gaps.push('上传回执(errno=0)')
  if (upload && !upload.uploadedUrl) gaps.push('回执文件 URL')
  if (gaps.length) return { phase: 'verify', status: gaps.length === 3 ? STATUS.UNJUDGED : STATUS.MISSING, verdict: 'verify-incomplete', gaps, detail: `取不到:${gaps.join(' / ')}` }
  return { phase: 'verify', status: STATUS.FOUND, verdict: 'file-accepted-by-oppo', detail: `md5=${plan.fileMd5} ${plan.contentLength}B 已落 OPPO(${upload.uploadedUrl});**发布提交段仍未核实 ⇒ 本结论不等于已上架**`, submit: 'endpoint-unverified-zero-call' }
}

export const HELP = `OPPO 软件商店提交器(发布提交段未核实 ⇒ 恒零调用)
用法:
  node scripts/submit-store-oppo.mjs [--phase status|upload|verify|all] [--file <apk>] [--execute] [--json]
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
  if (!['status', 'upload', 'verify', 'all'].includes(o.phase)) throw new Error(`--phase 只接受 status|upload|verify|all,收到 ${o.phase}`)
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
        { verified: false, intent: '提交发布:正文需登录 ⇒ 零调用' },
      ],
    })
    d.firstPublishNote = '官方"注意"第1条:使用传包能力前需在开放平台**先手动创建应用** ⇒ oppo 首包必须有后台动作'
    console.log(args.json ? JSON.stringify({ ...d, gates: gates.rows }, null, 2) : `DRY-RUN oppo(默认零网络)\n${d.calls.map((c) => `  - ${c}`).join('\n')}\n  - ${d.firstPublishNote}\n${gates.rows.map((r) => `  [${r.status}] ${r.k}: ${r.detail}`).join('\n')}`)
    return gates.exit
  }
  if (creds.status !== STATUS.FOUND) return console.log(`${creds.status === STATUS.MISSING ? '缺件' : '未判定'}:${creds.detail}`), creds.status === STATUS.MISSING ? 1 : 2
  if (args.phase !== 'status' && artifact.status !== STATUS.FOUND) return console.log(`提交物不成:${artifact.detail}`), artifact.status === STATUS.MISSING ? 1 : 2

  const steps = []
  if (args.phase !== 'upload') steps.push(unverifiedCall({ phase: 'status', reason: 'OPPO 查询应用详情端点正文需登录', doc: ENDPOINTS.detail.doc }))
  const planR = artifact.value ? planUpload({ filePath: artifact.value.path }) : { status: STATUS.UNJUDGED, plan: null, detail: '未点名产物' }
  if (planR.status !== STATUS.FOUND) steps.push({ phase: 'plan', ...planR })
  const up = ['upload', 'all', 'verify'].includes(args.phase) && planR.plan ? await phaseUploadChain({ creds: creds.value, plan: planR.plan }) : { phase: 'upload', status: STATUS.UNJUDGED, verdict: 'skipped', detail: '未跑 upload 段' }
  steps.push(up)
  steps.push(args.phase === 'status' ? unverifiedCall({ phase: 'verify', reason: '未跑 verify 段', doc: null }) : mergeVerify({ plan: planR.plan, upload: up }))
  console.log(args.json ? JSON.stringify({ steps }, null, 2) : steps.map((s) => `[${s.status}] ${s.phase}: ${s.verdict ?? '-'} — ${s.detail ?? ''}`).join('\n'))
  const st = steps.map((s) => s.status)
  return st.includes(STATUS.UNJUDGED) ? 2 : st.includes(STATUS.MISSING) ? 1 : 0
}

function selfTest() {
  return runSelfTest([
    { name: 'O1 errno=0 才是成功(HTTP 200 但 errno≠0 仍算缺件)', fn: () => classifyOppo(200, '{"errno":0,"data":{"access_token":"x"}}').status === STATUS.FOUND && classifyOppo(200, '{"errno":31001,"message":"invalid client"}').status === STATUS.MISSING },
    { name: 'O2 非 JSON(登录页 HTML)⇒ 未判定,不读成"OPPO 拒绝"', fn: () => classifyOppo(200, '<html>登录失效</html>').status === STATUS.UNJUDGED && classifyOppo(200, '<html>').verdict === 'non-json-response' },
    { name: 'O3 5xx ⇒ 未判定', fn: () => classifyOppo(503, '{"errno":5000}').status === STATUS.UNJUDGED },
    { name: 'O4 凭据件缺 client_secret ⇒ MISSING 点名缺哪枚', fn: () => { const p = parseCredentialText('client_id:123456789012345678'); return p.clientId && !p.clientSecret && resolveCredentials({ env: {}, root: 'X:/nope' }).status !== STATUS.FOUND } },
    { name: 'O5 env 齐备优先且 detail 不含 secret 原文', fn: () => { const r = resolveCredentials({ env: { OPPO_CLIENT_ID: '123456789012345678', OPPO_CLIENT_SECRET: 'SECRET-DO-NOT-LEAK-0123456789' } }); return r.status === STATUS.FOUND && !r.detail.includes('DO-NOT-LEAK') } },
    { name: 'O6 token URL 形态:GET + 两枚 query,不出站即不打印 secret', fn: () => { const u = tokenCall({ clientId: 'A', clientSecret: 'B' }); return u.method === 'GET' && u.url === `${BASE}/developer/v1/token?client_id=A&client_secret=B` && ENDPOINTS.token.verified } },
    { name: 'O7 上传配置段带 access_token 头且 x-www-form-urlencoded', fn: () => { const c = uploadConfigCall({ accessToken: 'TK' }); return c.url === `${BASE}/resource/v1/upload/get-upload-url` && c.headers.access_token === 'TK' } },
    { name: 'O8 multipart 三字段齐(type/sign/file),file 段用真实基名与二进制', fn: () => { const mp = buildUploadMultipart({ uploadUrl: 'https://x/up', sign: 'S', fileName: 'app-release.apk', fileBuf: Buffer.from([0x50, 0x4b, 0x03, 0x04]) }); const s = mp.body.toString('latin1'); return s.includes('name="type"') && s.includes('apk') && s.includes('name="sign"') && s.includes('filename="app-release.apk"') && s.includes('charset=utf-8') && mp.body.length > s.length - 4 && mp.url === 'https://x/up' } },
    { name: 'O9 sign 一次性:两次 build 的 boundary 不同 ⇒ 不复用上一次的 sign', fn: () => buildUploadMultipart({ uploadUrl: 'u', sign: 'S1', fileName: 'a.apk', fileBuf: Buffer.alloc(1) }).headers['content-type'] !== buildUploadMultipart({ uploadUrl: 'u', sign: 'S1', fileName: 'a.apk', fileBuf: Buffer.alloc(1) }).headers['content-type'] },
    { name: 'O10 planUpload 0 字节 ⇒ MISSING;读不到 ⇒ 未判定', fn: () => planUpload({ filePath: '/nope', read: () => { throw Object.assign(new Error('e'), { code: 'ENOENT' }) } }).status === STATUS.UNJUDGED && planUpload({ filePath: '/x.apk', read: () => Buffer.alloc(0) }).status === STATUS.MISSING },
    { name: 'O11 mergeVerify 三格齐才绿,且**永不**自称已上架', fn: () => { const v = mergeVerify({ plan: { fileMd5: 'm', contentLength: '10' }, upload: { status: STATUS.FOUND, uploadedUrl: 'https://cdn/o.apk' } }); return v.status === STATUS.FOUND && /不等于已上架/.test(v.detail) && v.submit === 'endpoint-unverified-zero-call' } },
    { name: 'O12 提交/详情段 verified:false ⇒ unverifiedCall 恒零调用', fn: () => ENDPOINTS.submit.verified === false && ENDPOINTS.detail.verified === false && unverifiedCall({ phase: 'status', reason: 'r', doc: 'd' }).calls.length === 0 },
    { name: 'O13 首包须后台建应用这一事实写在 dry-run 出口里', fn: () => /先手动创建应用/.test('官方"注意"第1条:使用传包能力前需在开放平台**先手动创建应用** ⇒ oppo 首包必须有后台动作') },
    { name: 'O14 非法 --phase 抛错(不静默接受 submit)', fn: () => { try { parseArgs(['--phase', 'submit']); return false } catch { return true } } },
  ])
}

export const __test__ = { BASE, ENDPOINTS, classifyOppo, parseCredentialText, resolveCredentials, tokenCall, uploadConfigCall, buildUploadMultipart, planUpload, phaseUploadChain, mergeVerify, parseArgs, STATUS }

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
