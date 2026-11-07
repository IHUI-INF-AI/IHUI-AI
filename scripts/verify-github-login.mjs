#!/usr/bin/env node
// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/* eslint-disable no-console -- CLI 验证工具需要直出诊断行 */
/**
 * verify-github-login.mjs —— GitHub OAuth 登录「生产可用性」探针(2026-11-07 立)。
 *
 * 它只做两件可证伪的事:
 *   G1 env 键面      apps/api/.env 里登录路由**真正读取**的键是否有值
 *                   (键名取自 apps/api/src/routes/auth-extended.ts 的 process.env.GITHUB_CLIENT_*,
 *                    不是文档/需求清单里的猜测名;GITHUB_OAUTH_* 是 device-flow 的另一用途,单列)
 *   G2 凭证探测      POST https://github.com/login/oauth/access_token 带一枚**必然无效**的 code
 *                   —— GitHub 会先校验 client_id/client_secret,再校验 code:
 *                     回 `incorrect_client_credentials` ⇒ 凭证无效(FAIL)
 *                     回 `bad_verification_code`        ⇒ 凭证已过闸(else 分支才轮到 code)
 *                     取不到响应                        ⇒ 网络不可达(未判定,不冒充通过)
 *
 * 其余输出全部是**现读代码**的回调地址清单(禁止推测):web/RN/desktop/小程序各自从
 * 真实文件里抽 redirect_uri;抽不到就写「未判定:无法从代码读取」,绝不填默认值糊过去。
 *
 * 脱敏纪律:client_secret 只出「有/无 + 前4***后2 + 长度」;client_id 只出前 8 + 长度;
 * 任何 access_token / PAT 一律不读不打印。
 *
 * 用法:
 *   node scripts/verify-github-login.mjs
 *   node scripts/verify-github-login.mjs --api-env <path>   # 换一份 .env 复验(默认 apps/api/.env)
 *
 * 退出码:0 凭证有效且回调清单可读 / 1 凭证无效 / 2 未判定(缺键、网络不可达、代码抽不到)
 */
import fs from 'node:fs'
import path from 'node:path'
import { pathToFileURL, fileURLToPath } from 'node:url'
import crypto from 'node:crypto'
import { envValueOf, maskId } from './verify-oidc-self-idp.mjs'

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const DEFAULT_API_ENV = path.join(ROOT, 'apps', 'api', '.env')
const TOKEN_ENDPOINT = 'https://github.com/login/oauth/access_token'
const TIMEOUT_MS = 12_000

/** 登录路由实际读取的两个键(auth-extended.ts:3105-3106),顺序即报错顺序。 */
const LOGIN_KEYS = ['GITHUB_CLIENT_ID', 'GITHUB_CLIENT_SECRET']
/** device-flow 用途的另一组键(workspace-ai.ts:880/919),不参与登录,只做提示。 */
const DEVICE_FLOW_KEYS = ['GITHUB_OAUTH_CLIENT_ID', 'GITHUB_OAUTH_CLIENT_SECRET']

const results = []
/** @param {'PASS'|'FAIL'|'SKIP'|'UNJUDGED'} verdict */
function check(id, verdict, detail) {
  results.push({ id, verdict, detail })
  const mark = { PASS: '✅', FAIL: '❌', SKIP: '⏭️ ', UNJUDGED: '❔' }[verdict]
  console.log(`${mark} ${id.padEnd(4)} ${verdict.padEnd(8)} ${detail}`)
}
const note = (line) => console.log(`   ${line}`)

/** secret 脱敏:有/无 + 前4***后2 + 长度(任务口径,禁止整值)。 */
export function maskSecretForm(value) {
  if (typeof value !== 'string' || value.length === 0) return '无(空)'
  if (value.length < 8) return `有 len=${value.length}(过短不示形)`
  return `有 ${value.slice(0, 4)}***${value.slice(-2)} len=${value.length}`
}

/** 读仓库相对文件;不存在返回 null(由调用方判「未判定」,不回落硬编码)。 */
function readRepo(rel) {
  try {
    return fs.readFileSync(path.join(ROOT, rel), 'utf8')
  } catch {
    return null
  }
}

/** 从源码里抽第一个命中正则的捕获组;抽不到返回 null。 */
function grab(text, re) {
  if (!text) return null
  const m = re.exec(text)
  return m ? (m[1] ?? m[0]) : null
}

/** 逐文件扫目录,统计含指定字面量的 .ts/.tsx 文件(用于证明「某端没有该登录」)。 */
function scanDir(relDir, needles) {
  const hits = []
  const walk = (dir) => {
    let entries = []
    try {
      entries = fs.readdirSync(dir, { withFileTypes: true })
    } catch {
      return
    }
    for (const e of entries) {
      if (e.name === 'node_modules' || e.name.startsWith('.')) continue
      const full = path.join(dir, e.name)
      if (e.isDirectory()) walk(full)
      else if (/\.(ts|tsx|js|jsx|mjs)$/.test(e.name)) {
        let text = ''
        try {
          text = fs.readFileSync(full, 'utf8')
        } catch {
          continue
        }
        for (const n of needles) {
          if (text.includes(n)) {
            hits.push(`${path.relative(ROOT, full).replace(/\\/g, '/')} :: ${n}`)
            break
          }
        }
      }
    }
  }
  walk(path.join(ROOT, relDir))
  return hits
}

/** 现读 apps/api/src 里某个 env 键的读取点数(0 就是 0,不靠文档说话)。 */
function envReadSites(key) {
  const dir = path.join(ROOT, 'apps', 'api', 'src')
  const hits = []
  const walk = (d) => {
    let entries = []
    try {
      entries = fs.readdirSync(d, { withFileTypes: true })
    } catch {
      return
    }
    for (const e of entries) {
      const full = path.join(d, e.name)
      if (e.isDirectory()) {
        if (e.name !== '__tests__') walk(full)
      } else if (e.name.endsWith('.ts') && !/\.test\.ts$/.test(e.name)) {
        let text = ''
        try {
          text = fs.readFileSync(full, 'utf8')
        } catch {
          continue
        }
        text.split(/\r?\n/).forEach((line, i) => {
          if (line.includes(`process.env.${key}`))
            hits.push(`${path.relative(ROOT, full).replace(/\\/g, '/')}:${i + 1}`)
        })
      }
    }
  }
  walk(dir)
  return hits
}

/** 读 apps/web 的公开 env(只列键,不打印值)。 */
function webPublicEnv() {
  const out = []
  for (const rel of ['apps/web/.env.local', 'apps/web/.env.production', 'apps/web/.env']) {
    const text = readRepo(rel)
    if (!text) continue
    for (const line of text.split(/\r?\n/)) {
      const m = /^([A-Za-z_][A-Za-z0-9_]*)=/.exec(line)
      if (m && line.includes('GITHUB')) out.push(`${rel} :: ${m[1]}`)
    }
  }
  return out
}

async function probeGithubCredentials(clientId, clientSecret) {
  const body = new URLSearchParams({
    client_id: clientId,
    client_secret: clientSecret,
    // 必然不存在的 code:GitHub 先验客户端凭据,再验 code ⇒ 错误码即区分两件事
    code: `verify-github-login-${crypto.randomBytes(12).toString('hex')}`,
  })
  let res
  try {
    res = await fetch(TOKEN_ENDPOINT, {
      method: 'POST',
      headers: {
        Accept: 'application/json',
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: body.toString(),
      signal: AbortSignal.timeout(TIMEOUT_MS),
    })
  } catch (e) {
    return { kind: 'network', why: e?.message || String(e) }
  }
  const text = await res.text()
  let json = null
  try {
    json = JSON.parse(text)
  } catch {
    // GitHub 在 Accept 未生效时会回 form-encoded;仍只取 error 字段
    const q = new URLSearchParams(text)
    if (q.get('error')) json = { error: q.get('error'), error_description: q.get('error_description') }
  }
  return { kind: 'http', status: res.status, json, textLen: text.length }
}

/** GitHub OAuth App 后台的「Authorization callback URL」必须逐字匹配,故逐条列全。 */
function buildCallbackList({ webProd, webDev, rnSuffix, rnBase }) {
  const lines = []
  if (webProd) {
    lines.push(`${webProd}/callback?platform=github`)
    if (rnSuffix) lines.push(`${webProd}${rnSuffix}`)
  }
  if (webDev) {
    lines.push(`${webDev}/callback?platform=github`)
    if (rnSuffix) lines.push(`${webDev}${rnSuffix}`)
  }
  if (rnBase) {
    lines.push(`${rnBase}/callback?platform=github&redirect=mobile-rn`)
  }
  return [...new Set(lines)]
}

async function main() {
  const argv = process.argv.slice(2)
  const envIdx = argv.indexOf('--api-env')
  const envPath = envIdx >= 0 ? path.resolve(argv[envIdx + 1]) : DEFAULT_API_ENV

  let envText = ''
  try {
    envText = fs.readFileSync(envPath, 'utf8')
  } catch (e) {
    check('G0', 'UNJUDGED', `读不到 ${path.relative(ROOT, envPath)}:${e.code || e.message} ⇒ 后续全部未判定`)
    return finish(2)
  }
  note(`env 文件 = ${path.relative(ROOT, envPath)}(键名现读，值不打印)`)

  // ── G1 env 键面:登录路由实际读取的键 ──────────────────────────────
  const values = {}
  for (const k of LOGIN_KEYS) values[k] = envValueOf(envText, k) || ''
  const missing = LOGIN_KEYS.filter((k) => !values[k])
  if (missing.length > 0) {
    check('G1', 'UNJUDGED', `登录路由读取的键缺值:${missing.join(', ')}`)
    console.log('未判定:缺 GITHUB_CLIENT_ID/SECRET')
    return finish(2)
  }
  check(
    'G1',
    'PASS',
    `登录键齐:${LOGIN_KEYS.map((k) => `${k}=${maskSecretForm(values[k])}`).join(' ｜ ')}`,
  )
  note(`读取点:${envReadSites('GITHUB_CLIENT_ID').join(', ') || '(未找到)'} / ${envReadSites('GITHUB_CLIENT_SECRET').join(', ') || '(未找到)'}`)

  const devicePresent = DEVICE_FLOW_KEYS.filter((k) => (envValueOf(envText, k) || '').length > 0)
  note(
    `device-flow 用途键(不参与登录)= ${devicePresent.length > 0 ? devicePresent.join(', ') : '(无)'}` +
      `${envValueOf(envText, 'GITHUB_TOKEN') ? '；GITHUB_TOKEN 为 registry-sync PAT，不参与登录' : ''}`,
  )
  const redirectKeySites = envReadSites('GITHUB_REDIRECT_URI')
  note(
    redirectKeySites.length === 0
      ? 'GITHUB_REDIRECT_URI 在 apps/api/src 无读取点 ⇒ 回调地址不由 api env 决定(见下方清单)'
      : `GITHUB_REDIRECT_URI 读取点 = ${redirectKeySites.join(', ')}`,
  )

  // ── G2 凭证探测 ─────────────────────────────────────────────────
  const probe = await probeGithubCredentials(values.GITHUB_CLIENT_ID, values.GITHUB_CLIENT_SECRET)
  if (probe.kind === 'network') {
    check('G2', 'UNJUDGED', `网络不可达(未取到 GitHub 响应):${probe.why}`)
    note('未判定:无法区分「凭证无效」与「网络不可达」——本次未连上 github.com')
    return finish(2)
  }
  const err = typeof probe.json?.error === 'string' ? probe.json.error : null
  if (err === 'incorrect_client_credentials') {
    check('G2', 'FAIL', `GitHub 明确判 client_id/client_secret 不正确(HTTP ${probe.status}, error=${err})`)
  } else if (err === 'bad_verification_code') {
    check(
      'G2',
      'PASS',
      `凭证已过闸:HTTP ${probe.status} error=${err}(GitHub 已越过客户端校验、只拒了那枚假 code)`,
    )
  } else {
    check(
      'G2',
      'UNJUDGED',
      `GitHub 回了非预期体(HTTP ${probe.status}, error=${err ?? '无 error 字段'}, len=${probe.textLen})⇒ 无法判定`,
    )
  }

  // ── G3 代码侧路由与各端回调(全部现读，不推测) ─────────────────────
  const authExtended = readRepo('apps/api/src/routes/auth-extended.ts')
  const apiRoute = grab(authExtended, /server\.post\('(\/auth\/:platform\/callback)'/)
  note(
    apiRoute
      ? `API 回调路由 = POST /api${apiRoute}（apps/api/src/routes/auth-extended.ts:3040；GET 版本同文件:3365 内部转发）`
      : '未判定:无法从 auth-extended.ts 读到 /auth/:platform/callback 字面量',
  )

  const webConfig = readRepo('apps/web/src/lib/third-party-config.ts')
  const webAuthUrl = grab(webConfig, /https:\/\/github\.com\/login\/oauth\/authorize/)
  const webDefaultRedirect = grab(webConfig, /`\$\{getOrigin\(\)\}(\/callback\?platform=github)`/)
  const webOriginFn = grab(webConfig, /function getOrigin\(\)[^{]*\{[\s\S]*?window\.location\.origin/)
  note(
    webAuthUrl && webDefaultRedirect
      ? `Web 授权端点 = ${webAuthUrl}；redirect 默认 = {window.origin}${webDefaultRedirect}（third-party-config.ts:188-194${webOriginFn ? '，getOrigin=window.location.origin' : ''}）`
      : '未判定:无法从 third-party-config.ts 抽到 GitHub 授权端点/默认 redirect',
  )
  const webEnvHits = webPublicEnv()
  note(
    webEnvHits.length === 0
      ? 'web 侧 NEXT_PUBLIC_GITHUB_* 未在本机 .env/.env.local/.env.production 出现 ⇒ 当前走代码默认 redirect'
      : `web 侧 GitHub 公开键 = ${webEnvHits.join(', ')}(值不打印)`,
  )
  const callbackPageExists = fs.existsSync(path.join(ROOT, 'apps/web/app/(auth)/callback/page.tsx'))
  note(
    `Web 回调页 = apps/web/app/(auth)/callback/page.tsx${callbackPageExists ? '(存在)' : '(不存在)'}；处理器 OAuthCallbackHandler.tsx 把 ?platform=github 转成 POST /api/auth/github/callback`,
  )

  const tauriRaw = readRepo('apps/desktop/src-tauri/tauri.conf.json')
  let tauri = null
  try {
    tauri = tauriRaw ? JSON.parse(tauriRaw) : null
  } catch {
    tauri = null
  }
  const desktopDev = tauri?.build?.devUrl || null
  const desktopProd = tauri?.app?.windows?.[0]?.url || null
  note(
    desktopDev || desktopProd
      ? `Desktop(Tauri) devUrl=${desktopDev ?? '(未读)'} 生产窗口 url=${desktopProd ?? '(未读)'} ⇒ 复用 web 的 /callback?platform=github`
      : '未判定:无法从 tauri.conf.json 读到 devUrl/生产窗口 url',
  )

  const rnConfig = readRepo('apps/mobile-rn/src/lib/config.ts')
  const rnBaseDefault = grab(
    rnConfig,
    /EXPO_PUBLIC_WEB_URL\s*\|\|\s*'([^']+)'/,
  )
  const rnRedirect = grab(
    readRepo('apps/mobile-rn/src/lib/oauth-redirect.ts'),
    /`\$\{WEB_BASE_URL\}(\/callback\?platform=github&redirect=mobile-rn)`/,
  )
  note(
    rnRedirect
      ? `RN redirect = {WEB_BASE_URL}${rnRedirect}（oauth-redirect.ts:329；WEB_BASE_URL=EXPO_PUBLIC_WEB_URL || '${rnBaseDefault ?? '?'}'，config.ts:100）；App 返回 deep link=ihui://oauth/callback`
      : '未判定:无法从 mobile-rn/oauth-redirect.ts 抽到 GitHub redirect',
  )

  const miniappHits = scanDir('apps/miniapp-taro/src', ['github.com/login/oauth/authorize'])
  const mobileCapHits = scanDir('apps/mobile-cap/src', ['github.com/login/oauth/authorize'])
  note(
    `小程序 GitHub 授权跳转构造点 = ${miniappHits.length} 处；mobile-cap = ${mobileCapHits.length} 处` +
      `${miniappHits.length === 0 && mobileCapHits.length === 0 ? ' ⇒ 两端无 GitHub 登录入口，无回调需登记' : ` ⇒ ${[...miniappHits, ...mobileCapHits].join(', ')}`}`,
  )

  // web 生产 origin 取桌面窗口 url(现读)；dev origin 取 devUrl；RN base 取 RN 默认。
  const webProd = desktopProd ? new URL(desktopProd).origin : null
  const webDev = desktopDev ? new URL(desktopDev).origin : null
  const rnBase = rnBaseDefault
  const callbackList = buildCallbackList({ webProd, webDev, rnSuffix: rnRedirect, rnBase })

  const extractedOk = Boolean(apiRoute && webAuthUrl && webDefaultRedirect && rnRedirect && desktopProd && desktopDev)
  if (extractedOk) check('G3', 'PASS', `各端回调全部从代码现读成功(共 ${callbackList.length} 条 GitHub 回调)`)
  else check('G3', 'UNJUDGED', '至少一端回调未能从代码读取 ⇒ 清单不完整(见上方逐条「未判定」)')

  const oidcIssuer = envValueOf(envText, 'OIDC_ISSUER') || ''
  const oidcRedirect = envValueOf(envText, 'OIDC_REDIRECT_URI') || ''

  console.log('')
  console.log('── 回调地址清单(必须在后台逐字登记;查询串参与精确匹配) ──')
  console.log('GitHub OAuth App → Settings → Developer settings → OAuth Apps → Authorization callback URL:')
  if (callbackList.length === 0) console.log('  未判定:无法从代码读取任何回调地址')
  else callbackList.forEach((u) => console.log(`  - ${u}`))
  console.log('微信小程序 / mobile-cap:无 GitHub 登录入口 ⇒ 无回调需登记')
  console.log('')
  console.log('自建 IdP(本仓 AS)后台需登记的 Redirect URI:')
  if (oidcRedirect) console.log(`  - ${oidcRedirect}  (apps/api/.env OIDC_REDIRECT_URI 现读，本机)`)
  else console.log('  未判定:apps/api/.env 无 OIDC_REDIRECT_URI')
  console.log(
    oidcIssuer
      ? `  生产:必须把 OIDC_ISSUER 换成生产 issuer 后，按 ${oidcIssuer.replace(/\/+$/, '')}/api/auth/oauth/oidc/callback 同规则登记；当前 OIDC_ISSUER=${oidcIssuer} 仅指向本机`
      : '  生产:部署 env 的 OIDC_ISSUER 未读到 ⇒ 未判定:生产 Redirect URI 无从定值',
  )

  return finish()
}

function finish(forced) {
  const n = (v) => results.filter((r) => r.verdict === v).length
  const fails = results.filter((r) => r.verdict === 'FAIL')
  const unj = results.filter((r) => r.verdict === 'UNJUDGED')
  console.log('')
  console.log(
    `SUMMARY pass=${n('PASS')} fail=${fails.length} unjudged=${unj.length} — ${results
      .map((r) => `${r.id}:${r.verdict}`)
      .join(' ')}`,
  )
  if (forced === 2 || fails.length === 0 && unj.length > 0) {
    console.log('❔ 末行现读:未判定(§0.3 不记绿也不冒红)⇒ ' + unj.map((u) => `${u.id} ${u.detail}`).join(' ｜ ').slice(0, 700))
    process.exitCode = 2
    return
  }
  if (fails.length > 0) {
    console.log('❌ 末行现读:FAIL ⇒ ' + fails.map((f) => `${f.id} ${f.detail}`).join(' ｜ ').slice(0, 700))
    process.exitCode = 1
    return
  }
  console.log('✅ 末行现读:GitHub 登录凭证有效且各端回调地址全部在册')
  process.exitCode = 0
}

export const __test__ = {
  maskSecretForm,
  buildCallbackList,
}

const isDirectRun = process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href
if (isDirectRun) {
  main().catch((e) => {
    console.error(`❌ ${e?.message ?? e}\n${e?.stack ?? ''}`)
    process.exit(2)
  })
}
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
