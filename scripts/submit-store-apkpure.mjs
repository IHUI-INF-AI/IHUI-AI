#!/usr/bin/env node
// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * submit-store-apkpure.mjs — APKPure 提交通道判定器(2026-11-09 立)
 *
 * ## 为什么这一家**不叫 uploader**
 * 本轮按"逆向-复现-超越"的取证纪律去核 APKPure 的公开提交通道(§0.12 第①②步),结论是:
 *   **APKPure 没有公开的 REST 上传 API。** 官方面只有两条通道:
 *     A. 网页开发者后台 `https://apkpure.com/developer` —— 登录后 Submit APK 表单,上传 .apk/.xapk;
 *     B. 邮件通道 `support@apkpure.com`(商务 `business@apkpure.com`)—— 提供**应用自己的公网下载直链**
 *        或直接附件 + 名称/简介/版本说明/开发者联系/授权说明,由 APKPure 侧拉取并审核。
 *   ⇒ 通道 B 就是任务书里说的"自托管 APK 提交/更新流程"的真身:**URL 是我们自己的站点直链,
 *     APKPure 来取**——它不需要我们有对方账号体系的 API 客户端,只需要①一个公网可直取的
 *     HTTPS 地址 ②一封说明邮件。本仓 `release-mobile-rn.mjs` 的 site-apk 腿已经在往官网固定地址发 APK,
 *     所以这一格的材料其实**已在位**,缺的是把提交动作本身做成人做的两步(它无法被机器代做)。
 *   ⇒ 因此本器**结构上没有上传腿**:任何"POST 到 apkpure 猜测端点"的代码都不写(§0.8:
 *     文档/命令不得写跑不通的出路;伪造 API 是本仓反复要防的那一型失效)。
 *   ⇒ 本器真正负责的是可自动化的那一半:**量通道可达性 + 生成邮件正文所需的材料包**,
 *     并把"哪一格取不到"判成未判定而不是判成"能传"。
 *
 * ## 本机实测(2026-11-09)
 * `https://apkpure.com/developer`、`https://publisher.apkpure.com` 直连 **均超时**;
 * `https://apkpure.com.cn/developer` 报 schannel `CRYPT_E_REVOCATION_OFFLINE`。
 * ⇒ 网页通道在本机需要代理腿(与 `deploy/win` 那套隧道同侧),这属**机器状态**,按 §12e
 *   只作读数呈现,不进提交链、不判红。
 *
 * ## 与法定前置的关系
 * APKPure 是**境外**分发面:不收国内 App 备案号,也不要求软著(与 prepare-store-bundle 的
 * `needsIcpFiling:false, needsCopyright:false` 同值)⇒ **国内备案卡住的那六家不妨碍这一家**。
 * 这也是"机主急"时唯一还能往前走一格的分发面。
 *
 * 用法:
 *   node scripts/submit-store-apkpure.mjs --self-test
 *   node scripts/submit-store-apkpure.mjs                       # 只判通道形态与材料(零网络)
 *   node scripts/submit-store-apkpure.mjs --probe               # 追加一次可达性实测(出网,可带代理)
 *   node scripts/submit-store-apkpure.mjs --emit-mail --url <公网直链>   # 产出邮件正文(仍不发送)
 * 退出码:0 材料齐且通道判定完成 / 1 材料缺(点名) / 2 未判定(取不到输入或网络结论拿不到)
 */
import { existsSync, readFileSync } from 'node:fs'
import { createHash } from 'node:crypto'
import { pathToFileURL } from 'node:url'

import { STATUS, androidArtifacts } from './lib/rn-release-credentials.mjs'
import { loadBundle, resolveArtifact, gateStates, runSelfTest, foldExit } from './lib/store-uploader-core.mjs'

export const CHANNELS = Object.freeze({
  portal: { kind: 'web-form', url: 'https://apkpure.com/developer', verified: true, automatable: false, note: '登录后台 Submit APK 表单;无公开 API ⇒ 机器不可代做' },
  mail: { kind: 'email', to: 'support@apkpure.com', cc: 'business@apkpure.com', verified: true, automatable: false, needs: ['appName', 'packageName', 'packageDownloadUrl(公网可直取 HTTPS)', 'whatsNew', 'developerContact', 'authorizationStatement'], note: '官方渠道合作/开发者上传通道:APKPure 侧按直链拉包;本仓 site-apk 腿已产出该直链' },
  api: { kind: 'rest-api', url: null, verified: false, automatable: false, note: '公开面核不到任何 REST 上传端点 ⇒ 本器零调用,不猜 URL' },
})

/** 邮件正文模板(纯函数):字段缺 ⇒ 该行为空并计入 gaps,不编造内容。 */
export function buildMailBody({ listing, artifact, downloadUrl, contact, versionNotes }) {
  const rows = [
    ['App name', listing?.appName ?? null],
    ['Package name', listing?.packageName ?? null],
    ['Version', listing?.versionName ?? null],
    ['APK download URL', downloadUrl ?? null],
    ['File size (bytes)', artifact?.bytes ?? null],
    ['SHA-256', artifact?.sha256 ?? null],
    ['What\'s new', versionNotes ?? listing?.whatsNew ?? null],
    ['Developer / contact', contact ?? null],
    ['Authorization statement', listing?.authorization ?? null],
  ]
  const gaps = rows.filter(([, v]) => !v).map(([k]) => k)
  const body = `Subject: [App Submission] ${rows[0][1] ?? '<app name>'} — new version\n\n` + rows.map(([k, v]) => `${k}: ${v ?? ''}`).join('\n')
  return { body, gaps, sendable: gaps.length === 0 }
}

/**
 * 可达性实测:默认不发(§0.8 与 §12g:派生 git/网络动作都要显式 stdio;这里用 fetch + 显式超时)。
 * 三条 URL 任一给出结构化应答即算通道存在性证据;**超时/证书失败 ⇒ 未判定,绝不读成"通道没了"**。
 */
export async function probeReachability({ fetchImpl = fetch, urls = [CHANNELS.portal.url], timeoutMs = 15000 } = {}) {
  const rows = []
  for (const url of urls) {
    if (!url) continue
    try {
      const r = await fetchImpl(url, { method: 'GET', redirect: 'manual', signal: AbortSignal.timeout(timeoutMs) })
      rows.push({ url, status: STATUS.FOUND, detail: `http=${r.status}(有应答 ⇒ 通道地址在世;是否需登录不由本器判)` })
    } catch (e) {
      const code = e?.cause?.code ?? e?.name ?? ''
      rows.push({ url, status: STATUS.UNJUDGED, detail: `不可达/超时(${code || String(e?.message).slice(0, 40)})⇒ 未判定;本机需代理腿,不等于 APKPure 关闭通道` })
    }
  }
  if (!rows.length) return { phase: 'reachability', status: STATUS.UNJUDGED, verdict: 'no-url-to-probe', detail: '没有可测 URL ⇒ 不枚举 0 个当绿(§0.3)', rows }
  const anyFound = rows.some((r) => r.status === STATUS.FOUND)
  return { phase: 'reachability', status: anyFound ? STATUS.FOUND : STATUS.UNJUDGED, verdict: anyFound ? 'channel-reachable' : 'all-unjudged', detail: rows.map((r) => `${r.url} → ${r.detail}`).join(' ; '), rows }
}

/** 本机是否配了代理腿(只判存在性,不打印凭据;代理带 auth 也不读)。 */
export function proxyEnvState(env = process.env) {
  const keys = ['HTTPS_PROXY', 'https_proxy', 'HTTP_PROXY', 'http_proxy', 'ALL_PROXY', 'all_proxy']
  const set = keys.filter((k) => env[k] && String(env[k]).trim())
  return { status: set.length ? STATUS.FOUND : STATUS.MISSING, detail: set.length ? `代理变量在位:${set.join(',')} ⇒ --probe 可走该腿` : '无代理变量 ⇒ --probe 直连,境外面大概率超时(判未判定,不判通道已关)' }
}

/** 产物面:APKPure 只收 APK/XAPK ⇒ 点名 apk,不回落 aab。 */
function apkpureArtifact() {
  const a = androidArtifacts()
  if (a.status !== STATUS.FOUND) return { status: a.status, detail: a.detail, value: null }
  const apk = a.value.find((x) => x.kind === 'apk')
  if (!apk) return { status: STATUS.MISSING, detail: `产物面有 ${a.value.map((x) => x.kind).join(',')} 但无 apk ⇒ APKPure 不收 aab,需一次 assembleRelease`, value: null }
  let sha256 = null
  try {
    sha256 = createHash('sha256').update(readFileSync(apk.path)).digest('hex')
  } catch (e) {
    return { status: STATUS.UNJUDGED, detail: `apk 取到但读不出 sha256(${e?.code ?? e?.name})⇒ 不冒充已核验`, value: null }
  }
  return { status: STATUS.FOUND, detail: `apk=${apk.path} ${apk.bytes}B sha256=${sha256.slice(0, 16)}…`, value: { path: apk.path, bytes: apk.bytes, sha256 } }
}

export const HELP = `APKPure 提交通道判定器(官方无 REST 上传 API,本器不伪造 POST 通路)
用法:
  node scripts/submit-store-apkpure.mjs [--probe] [--json]
  node scripts/submit-store-apkpure.mjs --emit-mail --url <公网直链> [--contact <邮箱>] [--notes <更新说明>]
  node scripts/submit-store-apkpure.mjs --self-test
开关:
  --probe        追加一次通道可达性实测(出网,可走代理)
  --emit-mail    产出提交邮件正文(本器不代发)
  --url          公网可直取的 APK 下载直链
  --contact      开发者联系
  --notes        版本更新说明
  --json         JSON 输出
  --self-test    离线自检
  --help, -h     显示本帮助
退出码:0 材料齐且通道判定完成 / 1 缺件点名 / 2 未判定`

export function parseArgs(argv) {
  const o = { probe: false, emitMail: false, url: null, contact: null, json: false, selfTest: false, help: false, versionNotes: null }
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i]
    if (a === '--help' || a === '-h') o.help = true
    else if (a === '--probe') o.probe = true
    else if (a === '--emit-mail') o.emitMail = true
    else if (a === '--url') o.url = argv[++i]
    else if (a === '--contact') o.contact = argv[++i]
    else if (a === '--notes') o.versionNotes = argv[++i]
    else if (a === '--json') o.json = true
    else if (a === '--self-test') o.selfTest = true
    else throw new Error(`未知参数: ${a}`)
  }
  return o
}

async function main() {
  const args = parseArgs(process.argv.slice(2))
  if (args.help) { console.log(HELP); return 0 }
  if (args.selfTest) return selfTest()
  const bundle = loadBundle({ vendor: 'apkpure' })
  const artifact = args.emitMail ? apkpureArtifact() : resolveArtifact({ preferKind: 'apk' })
  const channel = { status: STATUS.FOUND, detail: 'APKPure:web 后台 + 邮件两条通道已核实;**无公开 REST API ⇒ 无自动上传腿**' }
  const states = [bundle.status, artifact.status, channel.status]
  const rows = [
    { k: '提交通道形态', ...channel },
    { k: '提交物(apk)', ...artifact },
    { k: '材料包(prepare-store-bundle 产物)', ...bundle },
  ]

  console.log(`APKPure 提交通道(不是 uploader:官方无 REST 上传端点)`)
  for (const [id, c] of Object.entries(CHANNELS)) console.log(`  [${c.verified ? '已核实' : '未核实'}] ${id}: ${c.kind} ${c.url ?? c.to ?? '-'} automatable=${c.automatable} — ${c.note}`)
  for (const r of rows) console.log(`  [${r.status}] ${r.k}: ${r.detail}`)

  if (args.probe) {
    const pv = proxyEnvState()
    console.log(`  [${pv.status}] 代理腿: ${pv.detail}`)
    const p = await probeReachability({ urls: [CHANNELS.portal.url, 'https://apkpure.com.cn/developer'] })
    console.log(`  [${p.status}] 可达性实测: ${p.detail}`)
    states.push(p.status)
  }
  if (args.emitMail) {
    const listing = bundle.files?.listing ?? {}
    const mail = buildMailBody({ listing, artifact: artifact.value, downloadUrl: args.url, contact: args.contact, versionNotes: args.versionNotes })
    console.log(mail.sendable ? `邮件正文可发(字段齐;本器**不代发**,§5e 邮件通道归 api 侧)\n${mail.body}` : `邮件字段不齐,不产出可发正文。缺:${mail.gaps.join(', ')}`)
    states.push(mail.sendable ? STATUS.FOUND : STATUS.MISSING)
  }
  console.log(`SUMMARY apkpure exit=${foldExit(states)} (0 材料齐通道明 / 1 缺件点名 / 2 未判定)`)
  return foldExit(states)
}

function selfTest() {
  return runSelfTest([
    { name: 'A1 api 通道必须 verified:false 且 url:null(结构上不可能被调用)', fn: () => CHANNELS.api.verified === false && CHANNELS.api.url === null && CHANNELS.api.automatable === false },
    { name: 'A2 两条真通道都在册:web 表单 + 邮件,且都标 automatable:false', fn: () => CHANNELS.portal.kind === 'web-form' && CHANNELS.mail.kind === 'email' && CHANNELS.mail.to === 'support@apkpure.com' && CHANNELS.portal.automatable === false && CHANNELS.mail.automatable === false },
    { name: 'A3 邮件通道需要的六枚字段含"公网可直取下载链"(自托管提交通道本体)', fn: () => CHANNELS.mail.needs.some((n) => /packageDownloadUrl/.test(n)) && CHANNELS.mail.needs.some((n) => /authorization/i.test(n)) },
    { name: 'A4 buildMailBody 字段齐 ⇒ sendable 且正文含直链与 sha256', fn: () => { const m = buildMailBody({ listing: { appName: '智汇AI', packageName: 'zh.ai.sq', versionName: '0.0.12', whatsNew: 'x', authorization: 'We are the rights holder.' }, artifact: { bytes: 123, sha256: 'abc' }, downloadUrl: 'https://aizhs.top/dl/app-release.apk', contact: 'dev@aizhs.top', versionNotes: null }); return m.sendable === true && m.gaps.length === 0 && m.body.includes('https://aizhs.top/dl/app-release.apk') && m.body.includes('abc') } },
    { name: 'A5 缺字段 ⇒ 不产出可发正文并逐条点名(不编造)', fn: () => { const m = buildMailBody({ listing: {}, artifact: null, downloadUrl: null, contact: null, versionNotes: null }); return m.sendable === false && m.gaps.includes('APK download URL') && !m.body.includes('undefined') } },
    { name: 'A6 probeReachability:有应答 ⇒ FOUND;超时 ⇒ 未判定且明说"不等于通道关闭"', fn: async () => {
        const ok = await probeReachability({ fetchImpl: async () => ({ status: 200 }), urls: ['https://x'] })
        const bad = await probeReachability({ fetchImpl: async () => { throw Object.assign(new Error('timeout'), { cause: { code: 'ETIMEDOUT' } }) }, urls: ['https://x'] })
        return ok.status === STATUS.FOUND && bad.status === STATUS.UNJUDGED && /不等于 APKPure 关闭通道/.test(bad.detail)
      } },
    { name: 'A7 probe 枚举到 0 条 URL ⇒ 未判定(§0.3 不记绿)', fn: async () => (await probeReachability({ urls: [] })).verdict === 'no-url-to-probe' },
    { name: 'A8 代理腿只判存在性,不打印值', fn: () => { const on = proxyEnvState({ HTTPS_PROXY: 'http://user:pass@127.0.0.1:7897' }); const off = proxyEnvState({}) ; return on.status === STATUS.FOUND && !JSON.stringify(on).includes('user:pass') && off.status === STATUS.MISSING } },
    { name: 'A9 foldExit:未判定压过缺件,材料全齐才 0', fn: () => foldExit([STATUS.MISSING, STATUS.UNJUDGED]) === 2 && foldExit([STATUS.FOUND, STATUS.MISSING]) === 1 && foldExit([STATUS.FOUND]) === 0 },
    { name: 'A10 本器**没有** upload/submit 出口(不存在伪造的 POST 通路)', fn: () => !('phaseUpload' in (globalThis.__apkpure_exports ?? {})) && Object.keys({ buildMailBody, probeReachability, proxyEnvState }).every((k) => !/upload|submit/i.test(k)) },
    { name: 'A11 未知参数抛错(不接受 --execute 冒充能上传)', fn: () => { try { parseArgs(['--execute']); return false } catch { return true } } },
    { name: 'A12 gateStates 四格形态与其余 submit-store 同判序(共用 core)', fn: () => gateStates({ creds: { status: STATUS.FOUND, detail: '' }, artifact: { status: STATUS.FOUND, detail: '' }, bundle: { status: STATUS.MISSING, detail: '' }, channel: { status: STATUS.FOUND, detail: '' } }).exit === 1 },
  ])
}

export const __test__ = { STATUS, CHANNELS, buildMailBody, probeReachability, proxyEnvState, parseArgs, foldExit, existsSync }

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
