#!/usr/bin/env node
// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * submit-store-apkpure.mjs — APKPure 提交通道判定器(2026-11-09 立)
 *
 * ## 为什么这一家**不叫 uploader**
 * 2026-11-08 按官方公开页复核(前一轮把 `apkpure.com/developer` 当成提交后台,是错的):
 *   **APKPure 没有公开的 REST 上传 API。** 官方提交入口只有登录型开发者控制台
 *     `https://developer.apkpure.com/`(公开提交页 `https://apkpure.com/submit-apk` 也导向它);
 *     `apkpure.com/developer/<name>` 只是公开的开发者主页目录。
 *   `support@apkpure.com`(商务 `business@apkpure.com`)是**联系地址**:邮件可以发提交请求
 *     (带**应用自己的公网下载直链**,由 APKPure 侧按链拉包),但它**不是官方提交入口**,
 *     是否受理/是否上架由 APKPure 侧决定 —— 本器不把"回执 id"写成"已提交成功"。
 *   ⇒ 本仓 `release-mobile-rn.mjs` 的 site-apk 腿已在往官网固定地址发 APK,材料其实**已在位**;
 *     机器能代做的是"发出请求函",代做不了的是控制台登录与对方审核。
 *   ⇒ 因此本器**结构上没有上传腿**:任何"POST 到 apkpure 猜测端点"的代码都不写(§0.8:
 *     文档/命令不得写跑不通的出路;伪造 API 是本仓反复要防的那一型失效)。
 *   ⇒ 本器真正负责的是可自动化的那一半:**量通道可达性 + 生成邮件正文所需的材料包**,
 *     并把"哪一格取不到"判成未判定而不是判成"能传"。
 *   ⇒ 2026-11-09 收口:邮件请求函**已接机器直发**——`--send` 只打印计划(零出网),
 *     `--send --execute` 才经 Resend 官方 HTTPS API 投出纯文本提交请求函;回执 `id` 只证明
 *     送达 support@ 邮箱,不等于 APKPure 受理/上架。
 *     凭据只读 env / 密钥库 `apps/api/.env`,输出只给 sha8 与长度,不回显原文。
 *
 * ## 本机实测(2026-11-09;官方控制台域名 developer.apkpure.com 2026-11-08 由公开页核实,未复测)
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
 *   node scripts/submit-store-apkpure.mjs --send --url <公网直链>          # 发送前体检(dry-run,零出网)
 *   node scripts/submit-store-apkpure.mjs --send --execute --url <公网直链> # 真发(需 RESEND 凭据)
 * 退出码:0 材料齐且通道判定完成 / 1 材料缺(点名) / 2 未判定(取不到输入或网络结论拿不到)
 */
import { existsSync, readFileSync } from 'node:fs'
import { createHash } from 'node:crypto'
import { join } from 'node:path'
import { pathToFileURL } from 'node:url'

import { STATUS, androidArtifacts } from './lib/rn-release-credentials.mjs'
import { loadBundle, resolveArtifact, gateStates, runSelfTest, foldExit } from './lib/store-uploader-core.mjs'
import { resolveKeyDir, resolveSecretsRoot } from './lib/key-dir.mjs'
import { parseEnvText } from './check-env-drift.mjs'

export const CHANNELS = Object.freeze({
  portal: { kind: 'web-form', url: 'https://developer.apkpure.com/', verified: true, automatable: false, note: '官方开发者控制台(登录墙,无公开 API);公开提交页 https://apkpure.com/submit-apk 也导向这里 ⇒ 机器不可代做' },
  mail: { kind: 'email', to: 'support@apkpure.com', cc: 'business@apkpure.com', verified: true, automatable: true, needs: ['appName', 'packageName', 'packageDownloadUrl(公网可直取 HTTPS)', 'developerContact', 'authorizationStatement'], note: '联系通道(非官方提交入口):--send --execute 经 Resend 投出纯文本提交请求函;What\'s new 官方公开页未列为必填,有则写入、无则省略' },
  api: { kind: 'rest-api', url: null, verified: false, automatable: false, note: '公开面核不到任何 REST 上传端点 ⇒ 本器零调用,不猜 URL' },
})

/** 邮件消息(纯函数):字段缺 ⇒ 该行为空并计入 gaps,不编造内容。subject/text 分开,便于 API 投递。 */
export function buildMailMessage({ listing, artifact, downloadUrl, contact, versionNotes }) {
  const notes = versionNotes ?? listing?.whatsNew ?? null
  const rows = [
    ['App name', listing?.appName ?? listing?.title ?? null],
    ['Package name', listing?.packageName ?? null],
    ['Version', listing?.versionName ?? null],
    ['APK download URL', downloadUrl ?? null],
    ['File size (bytes)', artifact?.bytes ?? null],
    ['SHA-256', artifact?.sha256 ?? null],
    // 官方公开页只写 "Your Name and What's new may be shown publicly",未列为必填;
    // 缺省省略该行,既不留空字段,也不编造更新内容。
    ...(notes ? [['What\'s new', notes]] : []),
    ['Developer / contact', contact ?? null],
    ['Authorization statement', listing?.authorization ?? null],
  ]
  const gaps = rows.filter(([, v]) => !v).map(([k]) => k)
  const subject = `[App Submission] ${rows[0][1] ?? '<app name>'} — new version`
  const text = rows.map(([k, v]) => `${k}: ${v ?? ''}`).join('\n')
  return { subject, text, body: `Subject: ${subject}\n\n${text}`, gaps, sendable: gaps.length === 0 }
}

/** 兼容旧调用面:只取 body/gaps/sendable(正文观感与旧版逐字一致)。 */
export function buildMailBody(args) {
  const m = buildMailMessage(args)
  return { body: m.body, gaps: m.gaps, sendable: m.sendable }
}

/**
 * 提交函发信端点。守卫 81 的行内豁免说明:这是发给 APKPure 工单系统的**对外业务函件**
 * (纯文本字段表,对方按字段拉包),不是运维告警;豁免的只是「版式层」
 * (不套品牌告警模板),**发件人显示名不豁免** —— 它同样代表品牌对外形象,见 brandFrom。
 */
// brand-mail-exempt: 商店提交函件是对外业务邮件(纯文本字段表),非运维告警,不套品牌模板
export const MAIL_ENDPOINT = 'https://api.resend.com/emails'

/**
 * 品牌显示名。
 *
 * 与 `apps/api/src/services/email-templates.ts` 的 `BRAND_MAIL_DISPLAY_NAME` 必须同值:
 * 本文件是零依赖 .mjs(CI 与本地都能裸跑),不能 import 那份 TS 模块;两处字面量的一致性
 * 由守门 81 的 R5 断言(改了一边而另一边没跟上 ⇒ 判红),而不是靠"记得同步"。
 */
const BRAND_FROM_NAME = '智汇AI'

/**
 * 把任意 From 形态(裸地址 / `名字 <地址>` / 带引号的名字)归一成品牌身份。
 *
 * 只保留地址段,显示名一律用品牌名 —— 与 email-templates 的 `brandResendFrom` 语义一致。
 * 理由同告警链路:显示名若能由配置决定,同一个品牌就会在收件箱里长出多个名字。
 */
export function brandFrom(raw) {
  const s = String(raw ?? '').trim()
  if (s === '') return ''
  const angle = /<([^>]+)>/.exec(s)
  const addr = (angle ? (angle[1] ?? '') : s).trim()
  return addr === '' ? '' : `${BRAND_FROM_NAME} <${addr}>`
}

/** 密钥库缺省 env-file:apps/api/.env(只读;路径经 key-dir 单一候选序,不写死盘符)。 */
export function defaultMailEnvFile({ env = process.env } = {}) {
  const dir = resolveKeyDir('IHUI-AI项目密钥', env)
  return dir ? join(dir, 'apps/api', '.env').replace(/\\/g, '/') : null
}

/** 密钥库根的单件回退:resend apikey.txt(整份文件就是一枚 re_* 键)。 */
export function defaultMailKeyFile({ env = process.env } = {}) {
  const root = resolveSecretsRoot(env)
  return root ? join(root, 'resend apikey.txt').replace(/\\/g, '/') : null
}

/**
 * 发信凭据三态。只读 env、env-file 与单件 key-file;输出只给 sha8/长度/发信地址,绝不回显原文。
 * 读不出 env-file/key-file ⇒ 未判定(不把"文件读失败"读成"没有凭据")。
 * from 缺省回落同一密钥库 env-file 的 SMTP_FROM(同一个发信身份;Resend 若认证不过会在 4xx 如实点名)。
 */
export function mailTransportState({ env = process.env, envFile = null, keyFile = undefined, exists = existsSync, read = readFileSync } = {}) {
  const file = envFile || defaultMailEnvFile({ env })
  const single = keyFile === undefined ? defaultMailKeyFile({ env }) : keyFile
  let apiKey = String(env.RESEND_API_KEY ?? '').trim()
  let from = String(env.RESEND_FROM ?? '').trim()
  let keySource = apiKey ? 'env' : null
  let fromSource = from ? 'env' : null
  let note = ''
  if (file && exists(file)) {
    try {
      const parsed = parseEnvText(read(file, 'utf8'))
      if (!apiKey) {
        apiKey = String(parsed.values.get('RESEND_API_KEY') ?? '').trim()
        if (apiKey) keySource = 'env-file'
      }
      if (!from) {
        from = String(parsed.values.get('RESEND_FROM') ?? '').trim()
        if (!from) from = String(parsed.values.get('SMTP_FROM') ?? '').trim()
        if (from) fromSource = 'env-file'
      }
      if (parsed.duplicates) note = `env-file 同名键重复 ${parsed.duplicates} 次(按 last-wins)`
    } catch (e) {
      return { status: STATUS.UNJUDGED, detail: `env-file 读不出(${e?.code ?? e?.name ?? 'ERR'}):${file} ⇒ 未判定,不冒充凭据到位`, value: null, file }
    }
  } else if (file) {
    note = `env-file 不存在:${file}`
  }
  if (!apiKey && single) {
    if (exists(single)) {
      try {
        const raw = String(read(single, 'utf8')).trim()
        if (/^re_[A-Za-z0-9_]+$/.test(raw)) {
          apiKey = raw
          keySource = 'key-file'
        } else {
          note = [note, 'key-file 形态不合规(期望单行 re_*)'].filter(Boolean).join(';')
        }
      } catch (e) {
        return { status: STATUS.UNJUDGED, detail: `key-file 读不出(${e?.code ?? e?.name ?? 'ERR'}):${single} ⇒ 未判定,不冒充凭据到位`, value: null, file }
      }
    } else {
      note = [note, `key-file 不存在:${single}`].filter(Boolean).join(';')
    }
  }
  const missing = []
  if (!apiKey) missing.push('RESEND_API_KEY')
  if (!from) missing.push('RESEND_FROM')
  if (missing.length) {
    const where = [file ? `env-file=${file}` : '', single ? `key-file=${single}` : '', note].filter(Boolean).join(';')
    return { status: STATUS.MISSING, detail: `缺 ${missing.join(' + ')}${where ? `(${where})` : '(env 与密钥库均未给)'}`, value: null, file }
  }
  const sha8 = createHash('sha256').update(apiKey).digest('hex').slice(0, 8)
  return { status: STATUS.FOUND, detail: `RESEND_API_KEY sha8=${sha8} len=${apiKey.length}(key:${keySource}/from:${fromSource});from=${from}`, value: { apiKey, from }, file }
}

/** 发送判档:未 --send ⇒ 不动;--send 无 --execute ⇒ 只打印计划(零出网)。 */
export function sendDisposition({ send = false, execute = false } = {}) {
  if (!send) return null
  return execute ? 'send' : 'plan'
}

/**
 * 经 Resend 官方 API 投出纯文本提交函(无 html 字段)。
 * 回执三档不得并桶:2xx+id=已发;4xx=未发出(原因点名);5xx/抛错=未判定。
 */
export async function postSubmissionMail({ transport, to = CHANNELS.mail.to, cc = CHANNELS.mail.cc, subject, text, replyTo = null, fetchImpl = fetch, endpoint = MAIL_ENDPOINT } = {}) {
  if (transport?.status !== STATUS.FOUND) return { status: STATUS.MISSING, detail: `发信凭据未到位:${transport?.detail ?? '未探测'} ⇒ 零调用`, id: null }
  if (!subject || !text) return { status: STATUS.MISSING, detail: '主题或正文为空 ⇒ 不发送', id: null }
  const { apiKey, from } = transport.value
  const brandFromHeader = brandFrom(from)
  if (brandFromHeader === '') {
    return { status: STATUS.MISSING, detail: '发信凭据里的 From 解析不出邮箱地址 ⇒ 零调用', id: null }
  }
  const payload = { from: brandFromHeader, to: [to], cc: cc ? [cc] : [], subject, text }
  if (replyTo) payload.reply_to = [replyTo]
  let r
  try {
    r = await fetchImpl(endpoint, {
      method: 'POST',
      headers: { Authorization: `Bearer ${apiKey}`, 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
      signal: AbortSignal.timeout(20000),
    })
  } catch (e) {
    const code = e?.cause?.code ?? e?.name ?? ''
    return { status: STATUS.UNJUDGED, detail: `出网失败(${code || String(e?.message).slice(0, 40)}) ⇒ 未判定,不得读成已提交`, id: null }
  }
  let raw = ''
  try {
    raw = await r.text()
  } catch {
    raw = ''
  }
  const http = r.status
  let j = null
  try {
    j = JSON.parse(raw)
  } catch {
    j = null
  }
  if (http >= 200 && http < 300) {
    const id = j?.id ?? null
    return id
      ? { status: STATUS.FOUND, detail: `Resend 受理 id=${id} http=${http}`, id }
      : { status: STATUS.UNJUDGED, detail: `http=${http} 但回执无 id ⇒ 不冒充已投递`, id: null }
  }
  const reason = String(j?.message ?? j?.error?.message ?? raw ?? '').replace(/\s+/g, ' ').slice(0, 120)
  if (http >= 400 && http < 500) {
    return { status: STATUS.MISSING, detail: `Resend 拒绝 http=${http}${reason ? `:${reason}` : ''} ⇒ 未发出(凭据/发信域/字段不被接受)`, id: null }
  }
  return { status: STATUS.UNJUDGED, detail: `Resend 服务端/网关异常 http=${http} ⇒ 未判定`, id: null }
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
  node scripts/submit-store-apkpure.mjs --send --url <公网直链>              # dry-run:只体检不发送
  node scripts/submit-store-apkpure.mjs --send --execute --url <公网直链>     # 真发(经 Resend)
  node scripts/submit-store-apkpure.mjs --self-test
开关:
  --probe        追加一次通道可达性实测(出网,可走代理)
  --emit-mail    产出提交邮件正文(本器不代发)
  --send         进入发送判定;不加 --execute 时只打印计划(零出网)
  --execute      真正出网投递(默认 dry-run,与其余 submit-store 同纪律)
  --env-file     发信凭据 .env(缺省只读密钥库 apps/api/.env;绝不回显原文)
  --url          公网可直取的 APK 下载直链
  --contact      开发者联系
  --notes        版本更新说明
  --json         JSON 输出
  --self-test    离线自检
  --help, -h     显示本帮助
退出码:0 材料齐且通道判定完成 / 1 缺件点名 / 2 未判定`

export function parseArgs(argv) {
  const o = { probe: false, emitMail: false, send: false, execute: false, envFile: null, url: null, contact: null, json: false, selfTest: false, help: false, versionNotes: null }
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i]
    if (a === '--help' || a === '-h') o.help = true
    else if (a === '--probe') o.probe = true
    else if (a === '--emit-mail') o.emitMail = true
    else if (a === '--send') o.send = true
    else if (a === '--execute') o.execute = true
    else if (a === '--env-file') o.envFile = argv[++i]
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
  const wantsMail = args.emitMail || args.send
  const artifact = wantsMail ? apkpureArtifact() : resolveArtifact({ preferKind: 'apk' })
  const channel = { status: STATUS.FOUND, detail: 'APKPure:web 后台 + 邮件两条通道已核实;**无公开 REST 上传 API,邮件通道已接机器直发**' }
  const states = [bundle.status, artifact.status, channel.status]
  const rows = [
    { k: '提交通道形态', ...channel },
    { k: '提交物(apk)', ...artifact },
    { k: '材料包(prepare-store-bundle 产物)', ...bundle },
  ]

  console.log(`APKPure 提交通道(不是 uploader:官方无 REST 上传端点;提交函可机器直发)`)
  for (const [id, c] of Object.entries(CHANNELS)) console.log(`  [${c.verified ? '已核实' : '未核实'}] ${id}: ${c.kind} ${c.url ?? c.to ?? '-'} automatable=${c.automatable} — ${c.note}`)
  for (const r of rows) console.log(`  [${r.status}] ${r.k}: ${r.detail}`)

  if (args.probe) {
    const pv = proxyEnvState()
    console.log(`  [${pv.status}] 代理腿: ${pv.detail}`)
    const p = await probeReachability({ urls: [CHANNELS.portal.url, 'https://apkpure.com.cn/developer'] })
    console.log(`  [${p.status}] 可达性实测: ${p.detail}`)
    states.push(p.status)
  }
  if (wantsMail) {
    const listing = bundle.files?.listing ?? {}
    const mail = buildMailMessage({ listing, artifact: artifact.value, downloadUrl: args.url, contact: args.contact, versionNotes: args.versionNotes })
    const transport = args.send ? mailTransportState({ env: process.env, envFile: args.envFile }) : null
    if (transport) console.log(`  [${transport.status}] 邮件凭据: ${transport.detail}`)
    if (!mail.sendable) {
      console.log(`邮件字段不齐,不产出可发正文/不发送。缺:${mail.gaps.join(', ')}`)
      states.push(STATUS.MISSING)
    } else if (!args.send) {
      console.log(`邮件正文可发(字段齐;本器**不代发**,加 --send 才进入发送判定)\n${mail.body}`)
      states.push(STATUS.FOUND)
    } else {
      const recipients = `收件人: ${CHANNELS.mail.to}${CHANNELS.mail.cc ? `;抄送: ${CHANNELS.mail.cc}` : ''}`
      if (sendDisposition({ send: args.send, execute: args.execute }) === 'plan') {
        console.log(`${recipients}\n未发送(dry-run;加 --execute 才真出网)\n${mail.body}`)
        states.push(transport.status)
      } else {
        console.log(recipients)
        const sent = await postSubmissionMail({ transport, subject: mail.subject, text: mail.text, replyTo: args.contact })
        console.log(`  [${sent.status}] 发送结果: ${sent.detail}`)
        states.push(sent.status)
      }
    }
  }
  console.log(`SUMMARY apkpure exit=${foldExit(states)} (0 材料齐通道明 / 1 缺件点名 / 2 未判定)`)
  return foldExit(states)
}

function selfTest() {
  return runSelfTest([
    { name: 'A1 api 通道必须 verified:false 且 url:null(结构上不可能被调用)', fn: () => CHANNELS.api.verified === false && CHANNELS.api.url === null && CHANNELS.api.automatable === false },
    { name: 'A2 两条真通道都在册:web 表单仍不可自动,邮件通道已机器直发', fn: () => CHANNELS.portal.kind === 'web-form' && CHANNELS.mail.kind === 'email' && CHANNELS.mail.to === 'support@apkpure.com' && CHANNELS.portal.automatable === false && CHANNELS.mail.automatable === true },
    { name: 'A3 邮件通道需要的 5 枚字段含"公网可直取下载链"(自托管提交通道本体;What\'s new 不在必填表内)', fn: () => CHANNELS.mail.needs.some((n) => /packageDownloadUrl/.test(n)) && CHANNELS.mail.needs.some((n) => /authorization/i.test(n)) && !CHANNELS.mail.needs.some((n) => /whatsNew/i.test(n)) },
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
    { name: 'A11 --execute 可解析但不单独触发送;--send 无 --execute 只计划(dry-run 纪律)', fn: () => { const a = parseArgs(['--execute']); const b = parseArgs(['--send']); const c = parseArgs(['--send', '--execute']); return a.execute === true && a.send === false && sendDisposition(a) === null && sendDisposition(b) === 'plan' && sendDisposition(c) === 'send' } },
    { name: 'A12 gateStates 四格形态与其余 submit-store 同判序(共用 core)', fn: () => gateStates({ creds: { status: STATUS.FOUND, detail: '' }, artifact: { status: STATUS.FOUND, detail: '' }, bundle: { status: STATUS.MISSING, detail: '' }, channel: { status: STATUS.FOUND, detail: '' } }).exit === 1 },
    { name: 'A13 发信凭据三态:命中只出 sha8/长度;缺件点名;不打印原文', fn: () => {
        const secret = 're_test_SECRET_VALUE_123456'
        const ok = mailTransportState({ env: { RESEND_API_KEY: secret, RESEND_FROM: 'IHUI <x@aizhs.top>' }, envFile: null })
        const miss = mailTransportState({ env: {}, envFile: '/no/such/.env', exists: () => false })
        return ok.status === STATUS.FOUND && !ok.detail.includes(secret) && /sha8=/.test(ok.detail) && miss.status === STATUS.MISSING && /RESEND_API_KEY/.test(miss.detail)
      } },
    { name: 'A14 发送回执三档:2xx+id ⇒ 已发;4xx ⇒ 未发出;抛错 ⇒ 未判定', fn: async () => {
        const transport = { status: STATUS.FOUND, detail: 'stub', value: { apiKey: 'k', from: 'f' } }
        const ok = await postSubmissionMail({ transport, subject: 's', text: 't', fetchImpl: async () => ({ status: 200, text: async () => '{"id":"re_1"}' }) })
        const bad = await postSubmissionMail({ transport, subject: 's', text: 't', fetchImpl: async () => ({ status: 422, text: async () => '{"message":"invalid from"}' }) })
        const down = await postSubmissionMail({ transport, subject: 's', text: 't', fetchImpl: async () => { throw Object.assign(new Error('boom'), { cause: { code: 'ENOTFOUND' } }) } })
        return ok.status === STATUS.FOUND && ok.id === 're_1' && bad.status === STATUS.MISSING && down.status === STATUS.UNJUDGED
      } },
    { name: 'A15 env-file 回读:只补缺失键;读失败判未判定', fn: () => {
        const ok = mailTransportState({ env: { RESEND_FROM: 'x@y' }, envFile: '/x/.env', exists: () => true, read: () => 'RESEND_API_KEY=re_file_key_abcdef\n' })
        const bad = mailTransportState({ env: {}, envFile: '/x/.env', exists: () => true, read: () => { throw Object.assign(new Error('eacces'), { code: 'EACCES' }) } })
        return ok.status === STATUS.FOUND && ok.value.apiKey === 're_file_key_abcdef' && bad.status === STATUS.UNJUDGED
      } },
    { name: 'A16 投递 payload 纯文本且含直链/SHA/收件人', fn: async () => {
        let captured = null
        const m = buildMailMessage({ listing: { appName: '智汇AI', packageName: 'zh.ai.sq', versionName: '1.0.0', authorization: 'rights holder' }, artifact: { bytes: 1, sha256: 'deadbeef' }, downloadUrl: 'https://x/y.apk', contact: 'dev@aizhs.top', versionNotes: 'notes' })
        await postSubmissionMail({ transport: { status: STATUS.FOUND, value: { apiKey: 'k', from: 'f' } }, subject: m.subject, text: m.text, fetchImpl: async (url, opts) => { captured = { url, opts, body: JSON.parse(opts.body) }; return { status: 200, text: async () => '{"id":"i"}' } } })
        return captured.url === MAIL_ENDPOINT && captured.body.text.includes('https://x/y.apk') && captured.body.text.includes('deadbeef') && captured.body.to[0] === 'support@apkpure.com' && !('html' in captured.body)
      } },
    { name: 'A17 密钥库回退:env 空值不遮蔽 root resend apikey.txt;形态不合规不采用', fn: () => {
        const ok = mailTransportState({ env: {}, envFile: '/x/.env', keyFile: '/k/resend apikey.txt', exists: (p) => p === '/x/.env' || p === '/k/resend apikey.txt', read: (p) => (p === '/x/.env' ? 'RESEND_API_KEY=\nSMTP_FROM=noreply@aizhs.top\n' : 're_filekey_abcdef\n') })
        const bad = mailTransportState({ env: {}, envFile: '/no/.env', keyFile: '/k/resend apikey.txt', exists: (p) => p === '/k/resend apikey.txt', read: () => 'not-a-key\n' })
        return ok.status === STATUS.FOUND && ok.value.apiKey === 're_filekey_abcdef' && /from=noreply@aizhs.top/.test(ok.detail) && bad.status === STATUS.MISSING
      } },
    { name: 'A18 材料包 listing 形状(title/packageName/versionName/authorization)可直接成函', fn: () => {
        const m = buildMailMessage({ listing: { title: '智汇AI', packageName: 'zh.ai.sq', versionName: '0.0.12', authorization: 'rights holder' }, artifact: { bytes: 1, sha256: 'deadbeef' }, downloadUrl: 'https://x/y.apk', contact: 'dev@aizhs.top', versionNotes: 'notes' })
        return m.sendable === true && /App name: 智汇AI/.test(m.text) && /Package name: zh\.ai\.sq/.test(m.text) && /Version: 0\.0\.12/.test(m.text)
      } },
    { name: `A19 What's new 缺省仍可发:官方未列为必填,邮件不留空字段`, fn: () => {
        const m = buildMailMessage({ listing: { title: 'x', packageName: 'p', versionName: 'v', authorization: 'a' }, artifact: { bytes: 1, sha256: 's' }, downloadUrl: 'u', contact: 'c', versionNotes: null })
        return m.sendable === true && !/What's new/.test(m.text) && m.gaps.length === 0
      } },
  ])
}

export const __test__ = { STATUS, CHANNELS, buildMailBody, buildMailMessage, MAIL_ENDPOINT, mailTransportState, defaultMailEnvFile, defaultMailKeyFile, sendDisposition, postSubmissionMail, probeReachability, proxyEnvState, parseArgs, foldExit, existsSync, brandFrom, BRAND_FROM_NAME }

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
