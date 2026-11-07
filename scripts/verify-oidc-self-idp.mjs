#!/usr/bin/env node
// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/* eslint-disable no-console -- CLI 验证工具需要直出诊断行 */
/**
 * verify-oidc-self-idp.mjs —— 「通用 OIDC 登录 = IHUI 自建 IdP」端到端验证器(2026-11-07 立)。
 *
 * 它验的不是"配置写没写",而是协议面每一环**真答没答**，并且每个存在性判定都带
 * 阳性对照 + 阴性对照(§0.3:取不到输入一律「未判定」，绝不用"探不到"冒充通过):
 *
 *   E1 api 存活            GET {base}/.well-known/openid-configuration
 *   E2 issuer 解析         读 discovery.issuer(口径 = oauth-as.ts resolveIssuer:
 *                          PUBLIC_BASE_URL > OAUTH_ISSUER > env.BASE_URL > Host 头推导)
 *   E3 discovery 字段      authorization/token/userinfo/jwks + scopes_supported∋openid + RS256
 *                          + issuer 逐字相等(discoverEndpoints 硬校验，不等即整链 500)
 *   E4 JWKS 正负对照       真 keys(kty=RSA/kid/n) ↔ 假路径必须 404
 *   E5 登录态              env IHUI_OIDC_ADMIN_TOKEN > 本机 CLI 会话(~/.ihui/settings.json)
 *                          拿不到 ⇒ E6/E11/E12 判「未判定」，不硬造凭据
 *   E6 注册 OIDC 客户端    POST /api/auth/oauth/apps/create(scopes 含 openid profile email)
 *                          该响应被 response-sanitizer 按 "secret" 子串打码 ⇒ 第二腿
 *                          POST /api/oauth-apps/:clientId/regenerate-secret(自带 skipResponseSanitization)
 *                          拿回一次性明文 —— 两腿都是公开在册端点，不绕鉴权、不碰库
 *   E7 authorize URL 一致  与 @ihui/auth buildOidcAuthorizationUrl 逐字节对账(同源，不复算判据)
 *   E8 token 端点三臂      未消费 code ⇒ invalid_grant ∧ 错 secret ⇒ invalid_client ∧ 假路径 ⇒ 404
 *   E9 userinfo 端点两臂   无 Bearer ⇒ 401+WWW-Authenticate ∧ 假 Bearer ⇒ 401 ∧ 假路径 ⇒ 404
 *   E10 authorize 三臂     合法 client+白名单 redirect+无 Bearer ⇒ 302 且 Location **不带 error**
 *                          (这一臂同时证明 scope 'email' 已在该应用可授予集内)/未知 client ⇒ 404/
 *                          未登记 redirect ⇒ 400
 *   E11 --e2e 授权码全回环 authorize(带 Bearer)⇒ code ⇒ token ⇒ access_token ⇒ userinfo.sub
 *                          与授权会话同一人(码一次性消费，重放必 invalid_grant)
 *   E12 id_token 面        响应里真带 id_token 才验 RS256 签名 + iss/aud/sub；没带就点名
 *                          "已实现未接线"的实测取证(全仓 issueIdToken 调用点数)，
 *                          绝不因"我们自己的 OIDC 客户端只吃 userinfo"就把这一格记绿
 *   E13 --consumer-loop    跑 api 自己的 GET /api/auth/oauth/oidc/redirect → callback，
 *                          期望 302 回 `${webOrigin}/sso/login?sso=oidc`(浏览器闭环契约)。
 *                          注意:这一腿会在库里落一枚 oidc 绑定/会话(真登录的必然副作用)。
 *   E14 --apply            把 OIDC_ISSUER/CLIENT_ID/CLIENT_SECRET/REDIRECT_URI 四键写进
 *                          apps/api/.env(只动这四键，其余逐字节保留；写前备份到 .ihui-agent/tmp/)
 *
 * 脱敏纪律:client_secret / client_id / 会话令牌一律不整值出 stdout；密钥只报 `len` + `fp`(sha256 前 12)。
 *
 * 用法:
 *   node scripts/verify-oidc-self-idp.mjs                      # 只读巡检(不写盘)
 *   node scripts/verify-oidc-self-idp.mjs --apply              # 注册/复用 + 写 OIDC_* 四键
 *   node scripts/verify-oidc-self-idp.mjs --apply --rotate     # 强制重注册一枚新客户端
 *   node scripts/verify-oidc-self-idp.mjs --e2e                # 加跑 E11 授权码全回环
 *   node scripts/verify-oidc-self-idp.mjs --consumer-loop      # 加跑 E12 api 自身回调闭环(有库侧副作用)
 *   node scripts/verify-oidc-self-idp.mjs --api-url http://127.0.0.1:8802 --issuer http://127.0.0.1:8802
 *   node scripts/verify-oidc-self-idp.mjs --self-test
 *
 * 退出码:0 全绿 / 1 任一 FAIL / 2 任一「未判定」(§0.3，含拿不到登录态·拿不到 discovery)
 */
import crypto from 'node:crypto'
import fs from 'node:fs'
import path from 'path'
import { pathToFileURL, fileURLToPath } from 'node:url'

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const API_ENV = path.join(ROOT, 'apps', 'api', '.env')
const TIMEOUT_MS = 12_000

const OIDC_KEYS = ['OIDC_ISSUER', 'OIDC_CLIENT_ID', 'OIDC_CLIENT_SECRET', 'OIDC_REDIRECT_URI']
const APP_NAME = 'IHUI 自建 IdP(OIDC 登录)'
const APP_SCOPES = ['openid', 'profile', 'email']
/** @ihui/auth buildOidcAuthorizationUrl 的固定 scope 串(E7 对账必须同源同值)。 */
const OIDC_SCOPE_STRING = 'openid profile email'

// ────────────────────────────── 纯判据区(可 --self-test，无 IO 无网络) ──────────────────────────────

/** .env 文本 → 行数组 + 「键 → 首次出现行号」索引(值不解析进日志)。 */
export function parseEnvLines(text) {
  const lines = String(text ?? '').split(/\r?\n/)
  const index = new Map()
  lines.forEach((line, i) => {
    const m = /^([A-Za-z_][A-Za-z0-9_]*)=/.exec(line)
    if (m && !index.has(m[1])) index.set(m[1], i)
  })
  return { lines, index }
}

/** 取 .env 里某个键的值(仅本进程内使用，绝不进 stdout)。 */
export function envValueOf(text, key) {
  for (const line of String(text ?? '').split(/\r?\n/)) {
    const m = new RegExp(`^${key}=(.*)$`).exec(line)
    if (m) return m[1].trim().replace(/^["'](.*)["']$/, '$1')
  }
  return undefined
}

/**
 * 只改指定键，其余行逐字节保留；缺失的键追加到末尾(带一条分节注释)。
 * @returns {{text:string, changed:string[], backedUp:boolean}}
 */
export function upsertEnv(text, values) {
  const { lines, index } = parseEnvLines(text)
  const eol = /\r\n/.test(text) ? '\r\n' : '\n'
  const changed = []
  for (const [key, value] of Object.entries(values)) {
    if (value === undefined || value === '') continue
    if (index.has(key)) {
      const i = index.get(key)
      if (lines[i] !== `${key}=${value}`) {
        lines[i] = `${key}=${value}`
        changed.push(key)
      }
    } else {
      if (lines[lines.length - 1] === '') lines.splice(lines.length - 1, 0, `${key}=${value}`)
      else lines.push(`${key}=${value}`)
      changed.push(key)
      index.set(key, lines.length - 1)
    }
  }
  return { text: lines.join(eol), changed, backedUp: false }
}

/** 密钥脱敏:长度 + sha256 指纹前 12 位(可跨轮对账，不可反推)。 */
export function maskSecret(value) {
  if (typeof value !== 'string' || value.length === 0) return '(空)'
  const fp = crypto.createHash('sha256').update(value).digest('hex').slice(0, 12)
  return `len=${value.length} fp=${fp}`
}

/** 非秘密标识(clientId / 令牌)脱敏:前 8 + 长度。 */
export function maskId(value) {
  if (typeof value !== 'string' || value.length === 0) return '(空)'
  return `${value.slice(0, 8)}…(len=${value.length})`
}

/** 按 discovery 自造 authorize URL —— 必须与 packages/auth 的实现同参数同顺序。 */
export function buildExpectedAuthorizeUrl(discovery, clientId, redirectUri, state) {
  const params = new URLSearchParams({
    client_id: clientId,
    redirect_uri: redirectUri,
    response_type: 'code',
    scope: OIDC_SCOPE_STRING,
    state,
  })
  return `${discovery.authorization_endpoint}?${params.toString()}`
}

/** discovery 必需字段判据(与 discoverEndpoints 的硬校验同集，另加 jwks_uri)。 */
export function missingDiscoveryFields(doc) {
  const need = ['authorization_endpoint', 'token_endpoint', 'userinfo_endpoint', 'jwks_uri']
  return need.filter((k) => typeof doc?.[k] !== 'string' || doc[k].length === 0)
}

/** OAuth 错误体判定:只看协议 `error` 字段，不信 HTTP 码单独说话。 */
export function oauthErrorOf(res) {
  const body = res.json
  if (body && typeof body.error === 'string') return body.error
  // api 侧统一信封 {code,message,data} 的端点(如 callback)不算 OAuth 形状
  return null
}

/** RFC 6749 §5.2 / RFC 6750 的错误码集:只有落在这个集合里才算"协议面在答话"。 */
const OAUTH_ERROR_CODES = new Set([
  'invalid_request',
  'invalid_client',
  'invalid_grant',
  'unauthorized_client',
  'unsupported_grant_type',
  'invalid_scope',
  'access_denied',
  'unsupported_response_type',
  'server_error',
  'temporarily_unavailable',
  'invalid_token',
  'insufficient_scope',
])

/**
 * 干净阴性 = 框架级 404(route not found)，**不是** OAuth 协议错误。
 * 框架默认 404 体形如 `{message:"Route … not found", error:"Not Found", statusCode:404}`,
 * 它的 `error` 字段与 §5.2 错误码不同集合，正好可用来排除"catch-all 什么都答协议错误"。
 */
export function isCleanHttpNotFound(res) {
  if (res?.status !== 404) return false
  const code = oauthErrorOf(res)
  if (code && OAUTH_ERROR_CODES.has(code)) return false
  return !code || res.json?.statusCode === 404 || /not\s+found/i.test(String(res.json?.message || ''))
}

/** 三臂对账:阳性臂与阴性臂必须给出**不同**结局，否则存在性判定无效。 */
export function armsDistinguishable(positive, negative) {
  if (!positive || !negative) return false
  return positive.status !== negative.status || positive.error !== negative.error
}

// ────────────────────────────── IO / 网络区 ──────────────────────────────

const results = []
/** @param {'PASS'|'FAIL'|'SKIP'|'UNJUDGED'} verdict */
function check(id, verdict, detail) {
  results.push({ id, verdict, detail })
  const mark = { PASS: '✅', FAIL: '❌', SKIP: '⏭️ ', UNJUDGED: '❔' }[verdict]
  console.log(`${mark} ${id.padEnd(4)} ${verdict.padEnd(8)} ${detail}`)
}
const note = (line) => console.log(`   ${line}`)

async function req(method, url, opts = {}) {
  const headers = { Accept: 'application/json, text/html;q=0.9', ...(opts.headers || {}) }
  let body = opts.body
  if (opts.form) {
    headers['Content-Type'] = 'application/x-www-form-urlencoded'
    body = new URLSearchParams(opts.form).toString()
  }
  const res = await fetch(url, {
    method,
    headers,
    body,
    redirect: opts.redirect ?? 'manual',
    signal: AbortSignal.timeout(opts.timeoutMs ?? TIMEOUT_MS),
  })
  const text = await res.text()
  let json = null
  try {
    json = JSON.parse(text)
  } catch {
    json = null
  }
  return {
    status: res.status,
    headers: res.headers,
    location: res.headers.get('location'),
    setCookies: typeof res.headers.getSetCookie === 'function' ? res.headers.getSetCookie() : [],
    text,
    json,
  }
}

/** 登录态来源:显式 env 优先，其次本机 CLI 会话文件；都取不到 ⇒ 返回 null(不猜、不造)。 */
function resolveSessionToken() {
  const fromEnv = (process.env.IHUI_OIDC_ADMIN_TOKEN || '').trim()
  if (fromEnv) return { token: fromEnv, source: 'env IHUI_OIDC_ADMIN_TOKEN' }
  const settings = process.env.USERPROFILE
    ? path.join(process.env.USERPROFILE, '.ihui', 'settings.json')
    : path.join(process.env.HOME || '', '.ihui', 'settings.json')
  try {
    const j = JSON.parse(fs.readFileSync(settings, 'utf8'))
    const apiKey = typeof j.apiKey === 'string' ? j.apiKey.trim() : ''
    if (apiKey.split('.').length === 3) {
      const claims = JSON.parse(Buffer.from(apiKey.split('.')[1], 'base64url').toString('utf8'))
      if (typeof claims.exp === 'number' && claims.exp * 1000 <= Date.now())
        return { token: null, source: `${settings}(apiKey 已过期)` }
      return { token: apiKey, source: `${settings} 的 CLI 会话 apiKey` }
    }
  } catch {
    /* 文件不存在/坏 ⇒ 落到下面的 null，不冒充有登录态 */
  }
  return { token: null, source: `${settings}(无可用 apiKey)` }
}

/** 与 @ihui/auth 同源取 buildOidcAuthorizationUrl；dist 不在 ⇒ 判未判定(不回落自己复算)。 */
async function loadAuthIssuer() {
  const dist = path.join(ROOT, 'packages', 'auth', 'dist', 'providers', 'oidc.js')
  if (!fs.existsSync(dist)) return { mod: null, why: `缺 ${path.relative(ROOT, dist)}(先 pnpm --filter @ihui/auth build)` }
  try {
    const mod = await import(pathToFileURL(dist).href)
    if (typeof mod.buildOidcAuthorizationUrl !== 'function')
      return { mod: null, why: 'dist 里没有 buildOidcAuthorizationUrl 导出' }
    return { mod, why: null }
  } catch (e) {
    return { mod: null, why: `import 失败:${e.message}` }
  }
}

function verifyIdTokenWithJwks(idToken, jwks) {
  const parts = String(idToken || '').split('.')
  if (parts.length !== 3) return { ok: false, why: 'id_token 不是三段 JWS' }
  const [h, p, s] = parts
  const header = JSON.parse(Buffer.from(h, 'base64url').toString('utf8'))
  if (header.alg !== 'RS256') return { ok: false, why: `alg=${header.alg}(期望 RS256)` }
  const key = (jwks.keys || []).find((k) => k.kid === header.kid) || (jwks.keys || [])[0]
  if (!key) return { ok: false, why: 'JWKS 里找不到匹配的 kid' }
  let pub
  try {
    pub = crypto.createPublicKey({ key, format: 'jwk' })
  } catch (e) {
    return { ok: false, why: `JWK 导入失败:${e.message}` }
  }
  const sigOk = crypto.verify(
    'RSA-SHA256',
    Buffer.from(`${h}.${p}`, 'ascii'),
    pub,
    Buffer.from(s, 'base64url'),
  )
  if (!sigOk) return { ok: false, why: '签名校验失败(公钥与签发键不符)' }
  const claims = JSON.parse(Buffer.from(p, 'base64url').toString('utf8'))
  return { ok: true, claims }
}

/** 扫 apps/api/src 非测试 .ts:实测 issueIdToken 的调用点(定义≠接线，§0.9)。 */
function idTokenCallSites() {
  const roots = [path.join(ROOT, 'apps', 'api', 'src')]
  const files = []
  const walk = (dir) => {
    let entries = []
    try {
      entries = fs.readdirSync(dir, { withFileTypes: true })
    } catch {
      return
    }
    for (const e of entries) {
      const full = path.join(dir, e.name)
      if (e.isDirectory()) walk(full)
      else if (e.name.endsWith('.ts') && !full.includes('__tests__') && !/\.test\.ts$/.test(e.name)) files.push(full)
    }
  }
  roots.forEach(walk)
  const callSites = []
  let defFile = null
  let tokensFileMentions = false
  for (const f of files) {
    let text = ''
    try {
      text = fs.readFileSync(f, 'utf8')
    } catch {
      continue
    }
    if (/export\s+(async\s+)?function\s+issueIdToken/.test(text)) defFile = path.relative(ROOT, f).replace(/\\/g, '/')
    const hits = text.split(/\r?\n/).filter((l) => /issueIdToken\s*\(/.test(l) && !/function\s+issueIdToken/.test(l))
    if (hits.length > 0) callSites.push(`${path.relative(ROOT, f).replace(/\\/g, '/')}:${hits.length}`)
    if (f.endsWith('oauth-tokens.ts')) tokensFileMentions = /id_token/.test(text)
  }
  return { callSites, callCount: callSites.reduce((a, b) => a + Number(b.split(':').pop()), 0), defFile, tokensFileMentions }
}

// ────────────────────────────── 主流程 ──────────────────────────────

async function main() {
  const argv = process.argv.slice(2)
  const getFlag = (name) => argv.includes(`--${name}`)
  const getOpt = (name) => {
    const i = argv.indexOf(`--${name}`)
    return i >= 0 ? argv[i + 1] : undefined
  }
  if (getFlag('self-test')) return selfTest()

  const apply = getFlag('apply')
  const rotate = getFlag('rotate')
  const doE2e = getFlag('e2e')
  const doLoop = getFlag('consumer-loop')

  let envText = ''
  try {
    envText = fs.readFileSync(API_ENV, 'utf8')
  } catch (e) {
    check('E0', 'UNJUDGED', `读不到 apps/api/.env:${e.code || e.message} ⇒ 后续全部未判定`)
    return finish()
  }
  const envOf = (k) => envValueOf(envText, k)
  const base = (getOpt('api-url') || `http://127.0.0.1:${envOf('PORT') || '8802'}`).replace(/\/+$/, '')
  note(`api 基址 = ${base}(PORT 现读，未硬编码;--api-url 可覆盖)`)
  note(`apps/api/.env 现有 OIDC 键 = ${OIDC_KEYS.filter((k) => envOf(k)).join(', ') || '(全无)'}`)
  const issuerPrecedence = ['PUBLIC_BASE_URL', 'OAUTH_ISSUER', 'BASE_URL'].filter((k) => envOf(k))
  note(`issuer 显式配置面 = ${issuerPrecedence.join(' > ') || '(三项皆空 ⇒ resolveIssuer 回落 Host 头推导)'}`)

  // E1 api 存活 + discovery 可达
  let discRes
  try {
    discRes = await req('GET', `${base}/.well-known/openid-configuration`)
  } catch (e) {
    check('E1', 'UNJUDGED', `GET ${base}/.well-known/openid-configuration 取不到:${e.message}`)
    return finish()
  }
  if (discRes.status !== 200 || !discRes.json) {
    check('E1', 'FAIL', `discovery HTTP ${discRes.status}(api 未在跑或 AS 未挂载)`)
    return finish()
  }
  check('E1', 'PASS', `api 在跑:discovery HTTP 200(${base})`)

  // E2 issuer 解析值
  const issuer = (getOpt('issuer') || discRes.json.issuer || '').replace(/\/+$/, '')
  if (!issuer) check('E2', 'UNJUDGED', 'discovery 里没有 issuer 字段，无法定值')
  else check('E2', 'PASS', `issuer = ${issuer}${getOpt('issuer') ? '（--issuer 覆盖）' : '（discovery 现读）'}`)

  // E3 discovery 必需字段
  const doc = discRes.json
  const missing = missingDiscoveryFields(doc)
  const scopesOk = Array.isArray(doc.scopes_supported) && doc.scopes_supported.includes('openid')
  const algOk = (doc.id_token_signing_alg_values_supported || []).includes('RS256')
  if (missing.length > 0) check('E3', 'FAIL', `discovery 缺字段:${missing.join(', ')}`)
  else if (!scopesOk) check('E3', 'FAIL', 'scopes_supported 不含 openid ⇒ 该 AS 不是 OIDC 面')
  else if (!algOk) check('E3', 'FAIL', 'id_token_signing_alg_values_supported 不含 RS256')
  else if (doc.issuer.replace(/\/+$/, '') !== issuer)
    check('E3', 'FAIL', `issuer 不一致:配置 ${issuer} vs 文档 ${doc.issuer}(discoverEndpoints 会直接抛错)`)
  else
    check(
      'E3',
      'PASS',
      `authorization/token/userinfo/jwks 齐 + scopes∋openid + RS256 + issuer 逐字相等`,
    )

  // E4 JWKS 正负对照
  const jwksUrl = doc.jwks_uri
  let jwks = null
  if (jwksUrl) {
    try {
      const jr = await req('GET', jwksUrl)
      jwks = jr.json
      const keys = Array.isArray(jwks?.keys) ? jwks.keys : []
      const usable = keys.filter((k) => k.kty === 'RSA' && k.kid && k.n)
      const bogus = await req('GET', `${new URL(jwksUrl).origin}/oauth/jwks-decoy-not-exist`)
      const negClean = isCleanHttpNotFound(bogus)
      if (usable.length === 0) check('E4', 'FAIL', `JWKS HTTP ${jr.status} 但无可用 RSA key(kid/n)`)
      else if (!negClean)
        check('E4', 'UNJUDGED', `阴性对照不干净:假 jwks 路径回 ${bogus.status} 而非 404`)
      else check('E4', 'PASS', `JWKS 有 ${usable.length} 枚 RSA key(${usable.map((k) => k.kid).join(', ')})｜阴性对照假路径 404`)
    } catch (e) {
      check('E4', 'UNJUDGED', `JWKS 取不到:${e.message}`)
    }
  } else check('E4', 'UNJUDGED', 'discovery 无 jwks_uri')

  // E5 登录态
  const session = resolveSessionToken()
  const bearer = session.token
  const authHeaders = bearer ? { Authorization: `Bearer ${bearer}` } : {}
  if (!bearer)
    check('E5', 'UNJUDGED', `拿不到会话令牌(${session.source})⇒ 注册/全回环判不了;可给 IHUI_OIDC_ADMIN_TOKEN`)
  else {
    let me = null
    try {
      me = await req('GET', `${base}/api/auth/me`, { headers: authHeaders })
    } catch (e) {
      check('E5', 'UNJUDGED', `回读会话身份失败:${e.message}`)
    }
    if (me) {
      const uid = me.json?.data?.user?.id ?? null
      if (me.status !== 200 || !uid)
        check('E5', 'FAIL', `会话令牌对本机 api 无效:HTTP ${me.status}${me.json?.message ? `(${me.json.message})` : ''}`)
      else check('E5', 'PASS', `会话令牌可用:来源=${session.source}, userId=${maskId(uid)}`)
    }
  }

  const redirectUri = `${issuer}/api/auth/oauth/oidc/callback`
  note(`OIDC_REDIRECT_URI 目标 = ${redirectUri}`)

  // E6 客户端:复用 or 注册
  let clientId = envOf('OIDC_CLIENT_ID') || ''
  let clientSecret = envOf('OIDC_CLIENT_SECRET') || ''
  let clientVerdict = null
  if (clientId && clientSecret && !rotate) {
    check('E6', 'PASS', `复用 apps/api/.env 既有 OIDC 客户端 clientId=${maskId(clientId)}(未注册新的;--rotate 强制重注册)`)
  } else if (!bearer) {
    check('E6', 'UNJUDGED', '无登录态 ⇒ 无法经 apps/create 注册，也不许直写库造客户端')
  } else {
    try {
      const created = await req('POST', `${base}/api/auth/oauth/apps/create`, {
        headers: { ...authHeaders, 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: APP_NAME,
          description: 'verify-oidc-self-idp:通用 OIDC 登录的自建 IdP 客户端',
          redirectUris: [redirectUri],
          scopes: APP_SCOPES,
        }),
      })
      const app = created.json?.data
      clientId = app?.clientId || ''
      if (created.status !== 200 || !clientId) {
        check('E6', 'FAIL', `apps/create HTTP ${created.status}:${(created.text || '').slice(0, 140)}`)
        clientVerdict = 'fail'
      } else {
        // 第一腿的 clientSecret 必被 response-sanitizer 的 "secret" 子串打码 ⇒ 走在册的第二腿取一次性明文
        const looked = app?.clientSecret
        const maskedInResp = looked === '***' || typeof looked !== 'string' || looked.length === 0
        let secret = maskedInResp ? '' : looked
        if (maskedInResp) {
          const regen = await req('POST', `${base}/api/oauth-apps/${clientId}/regenerate-secret`, {
            headers: { ...authHeaders },
          })
          secret = regen.json?.data?.clientSecret || ''
          if (regen.status !== 200 || !secret)
            check(
              'E6',
              regen.status === 401 ? 'UNJUDGED' : 'FAIL',
              `第二腿 regenerate-secret HTTP ${regen.status}:${(regen.text || '').slice(0, 160)}(401 多半是该账号开了 2FA 需 step-up)`,
            )
        }
        if (secret) {
          clientSecret = secret
          check(
            'E6',
            'PASS',
            `注册成功 clientId=${maskId(clientId)} clientSecret=${maskSecret(secret)} redirectUris=[${redirectUri}] scopes=[${APP_SCOPES.join(' ')}]${maskedInResp ? '(凭 regenerate-secret 第二腿取一次性明文：apps/create 响应按 secret 子串打码)' : ''}`,
          )
        } else clientVerdict = clientVerdict || 'nosecret'
      }
    } catch (e) {
      check('E6', 'UNJUDGED', `apps/create 请求异常:${e.message}`)
    }
  }
  const clientReady = Boolean(clientId && clientSecret && !clientVerdict)

  // E7 authorize URL 与 buildOidcAuthorizationUrl 逐字节对账
  const auth = await loadAuthIssuer()
  if (!auth.mod) check('E7', 'UNJUDGED', `拿不到 @ihui/auth 的实现:${auth.why}`)
  else if (!clientReady) check('E7', 'UNJUDGED', '客户端未就绪 ⇒ 无法构造可比对的 authorize URL')
  else {
    const fixedState = 'verify-state-fixed-0000000000'
    const mine = buildExpectedAuthorizeUrl(doc, clientId, redirectUri, fixedState)
    const theirs = await auth.mod.buildOidcAuthorizationUrl(
      { issuer, clientId, clientSecret, redirectUri },
      fixedState,
    )
    const same = mine === theirs
    const q = new URLSearchParams(theirs.split('?')[1] || '')
    const paramsOk =
      q.get('client_id') === clientId &&
      q.get('redirect_uri') === redirectUri &&
      q.get('response_type') === 'code' &&
      q.get('scope') === OIDC_SCOPE_STRING &&
      q.get('state') === fixedState
    if (!same)
      check(
        'E7',
        'FAIL',
        `不一致:实现产出 ${theirs.slice(0, 200)}${theirs.length > 200 ? '…' : ''} vs 本工具产出 ${mine.slice(0, 200)}${mine.length > 200 ? '…' : ''}`,
      )
    else if (!paramsOk) check('E7', 'FAIL', '逐字节相同但参数集与契约不符(不可能，判据需复核)')
    else check('E7', 'PASS', `与 buildOidcAuthorizationUrl 逐字节一致(端点=${theirs.split('?')[0]}, 参数集 5/5)`)
  }

  // E8 token 端点三臂
  if (!clientReady) check('E8', 'UNJUDGED', '客户端未就绪 ⇒ token 臂跑不了')
  else {
    const form = {
      grant_type: 'authorization_code',
      code: `unused-${crypto.randomBytes(16).toString('hex')}`,
      redirect_uri: redirectUri,
      client_id: clientId,
      client_secret: clientSecret,
    }
    const pos = await req('POST', doc.token_endpoint, {
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams(form).toString(),
    })
    const posErr = oauthErrorOf(pos)
    const negCreds = await req('POST', doc.token_endpoint, {
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({ ...form, client_secret: 'wrong-secret-for-negative-arm' }).toString(),
    })
    const negCredsErr = oauthErrorOf(negCreds)
    const negPath = await req('POST', `${new URL(doc.token_endpoint).origin}/oauth/token-decoy-not-exist`, {
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams(form).toString(),
    })
    note(
      `  臂一(真客户端+未用 code)=${pos.status}/${posErr ?? '-'} 臂二(错 secret)=${negCreds.status}/${negCredsErr ?? '-'} 臂三(假路径)=${negPath.status}`,
    )
    if (posErr === 'invalid_client')
      check('E8', 'FAIL', '真客户端凭据被判 invalid_client ⇒ OIDC_CLIENT_SECRET 与库里不一致')
    else if (!['invalid_grant', 'invalid_request'].includes(String(posErr)))
      check('E8', pos.status === 400 ? 'FAIL' : 'UNJUDGED', `阳性对照未按 RFC 答 invalid_grant(实为 ${posErr ?? '无 error 字段'})`)
    else if (!armsDistinguishable({ status: pos.status, error: posErr }, { status: negCreds.status, error: negCredsErr }))
      check('E8', 'UNJUDGED', '臂一/臂二结局相同 ⇒ 端点没在真校验客户端凭据，存在性不成立')
    else if (isCleanHttpNotFound(negPath))
      check('E8', 'PASS', `token 端点活且真校验:invalid_grant ↔ invalid_client ↔ 假路径 404 三态可分`)
    else check('E8', 'UNJUDGED', `阴性假路径回 ${negPath.status}/${oauthErrorOf(negPath) ?? '-'}(非干净的框架 404)⇒ 无法排除 catch-all`)
  }

  // E9 userinfo 端点两臂 + 阴性
  {
    const pos = await req('GET', doc.userinfo_endpoint)
    const posErr = oauthErrorOf(pos)
    const bogus = await req('GET', doc.userinfo_endpoint, {
      headers: { Authorization: 'Bearer definitely-not-a-token' },
    })
    const negPath = await req('GET', `${new URL(doc.userinfo_endpoint).origin}/oauth/userinfo-decoy-not-exist`)
    const wwwAuth = pos.headers.get('www-authenticate')
    note(`  无 token=${pos.status}/${posErr ?? '-'}(WWW-Authenticate=${wwwAuth ? 'present' : 'absent'}) 假 token=${bogus.status}/${oauthErrorOf(bogus) ?? '-'} 假路径=${negPath.status}`)
    if (pos.status === 401 && posErr === 'invalid_token' && isCleanHttpNotFound(negPath))
      check('E9', 'PASS', `userinfo 端点活:401 invalid_token(带 WWW-Authenticate=${Boolean(wwwAuth)}) ↔ 假路径框架 404`)
    else if (pos.status === 401 && !isCleanHttpNotFound(negPath))
      check('E9', 'UNJUDGED', `阴性对照不干净(假路径也回 ${negPath.status}/${oauthErrorOf(negPath) ?? '-'})⇒ 存在性未判定`)
    else check('E9', 'FAIL', `userinfo 未按 RFC 拒绝匿名请求(HTTP ${pos.status})`)
  }

  // E10 authorize 三臂(最关键:证明 scope 'email' 已在该应用可授予集内)
  if (!clientReady) check('E10', 'UNJUDGED', '客户端未就绪 ⇒ authorize 臂跑不了')
  else {
    const st = `arm-${crypto.randomBytes(6).toString('hex')}`
    const okUrl = buildExpectedAuthorizeUrl(doc, clientId, redirectUri, st)
    const arm1 = await req('GET', okUrl)
    const loc1 = arm1.location || ''
    const backErr = new URL(loc1 || 'http://127.0.0.1').searchParams.get('error')
    const unknown = await req(
      'GET',
      okUrl.replace(`client_id=${encodeURIComponent(clientId)}`, 'client_id=ci-not-existing-000000'),
    )
    const badRedirect = await req(
      'GET',
      okUrl.replace(encodeURIComponent(redirectUri), encodeURIComponent(`${issuer}/not-registered`)),
    )
    note(`  合法=${arm1.status}→${loc1 ? `${loc1.split('?')[0]}${backErr ? `?error=${backErr}` : '(无 error)'}` : '(无 Location)'} 未知client=${unknown.status} 未登记redirect=${badRedirect.status}`)
    if (backErr)
      check(
        'E10',
        'FAIL',
        `authorize 直接带 error=${backErr} 回跳(大概率 invalid_scope:'email' 不在应用可授予集 ⇒ 需按 apps/create 登记 scopes)`,
      )
    else if (arm1.status === 302 && /\/oauth\/authorize/.test(loc1))
      check('E10', 'PASS', '合法请求 302 转 web 同意页且不带 error ⇒ client/redirect/scope 三闸皆过')
    else if (arm1.status === 302)
      check('E10', 'PASS', `合法请求 302(Location=${loc1.split('?')[0]})`)
    else check('E10', 'FAIL', `合法 authorize 未 302(HTTP ${arm1.status})`)
    if (unknown.status !== 404) note(`  ⚠️ 阴性臂:未知 client 回 ${unknown.status}(期望 404 invalid_client)`)
    if (badRedirect.status !== 400) note(`  ⚠️ 阴性臂:未登记 redirect 回 ${badRedirect.status}(期望 400)`)
  }

  // E11 授权码全回环 + E12 id_token 面(两条独立判据:前者管"链路通不通"，后者管"协议完不完整")
  if (doE2e) {
    if (!clientReady || !bearer) {
      check('E11', 'UNJUDGED', '缺客户端或登录态 ⇒ 全回环跑不了')
      check('E12', 'UNJUDGED', '同 E11:没跑到 token 响应，id_token 面无从判定')
    } else {
      const st = `e2e-${crypto.randomBytes(8).toString('hex')}`
      const az = await req('GET', buildExpectedAuthorizeUrl(doc, clientId, redirectUri, st), {
        headers: authHeaders,
      })
      const azLoc = az.location || ''
      const q = azLoc ? new URL(azLoc).searchParams : null
      const code = q?.get('code') || null
      const azErr = q?.get('error')
      if (!code) {
        check('E11', azErr ? 'FAIL' : 'UNJUDGED', `authorize 未发码(带 Bearer):${azErr || `Location=${azLoc.slice(0, 120)}`}`)
        check('E12', 'UNJUDGED', '没拿到 code ⇒ 无 token 响应可判')
      } else {
        const tok = await req('POST', doc.token_endpoint, {
          headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
          body: new URLSearchParams({
            grant_type: 'authorization_code',
            code,
            redirect_uri: redirectUri,
            client_id: clientId,
            client_secret: clientSecret,
          }).toString(),
        })
        const at = tok.json?.access_token
        const grantedScope = tok.json?.scope ?? ''
        if (!at) {
          check('E11', 'FAIL', `code 换 token 失败 HTTP ${tok.status}:${(tok.text || '').slice(0, 160)}`)
          check('E12', 'UNJUDGED', '换 token 失败 ⇒ id_token 面无从判定')
        } else {
          const ui = await req('GET', doc.userinfo_endpoint, {
            headers: { Authorization: `Bearer ${at}` },
          })
          const me = await req('GET', `${base}/api/auth/me`, { headers: authHeaders })
          const expectSub = me.json?.data?.user?.id
          const sub = ui.json?.sub
          if (ui.status !== 200 || !sub)
            check('E11', 'FAIL', `userinfo 用新签 access_token 仍取不到 sub(HTTP ${ui.status})`)
          else if (sub !== expectSub)
            check('E11', 'FAIL', `userinfo.sub=${maskId(String(sub))} ≠ 授权会话用户 ${maskId(String(expectSub))} ⇒ 身份串了`)
          else
            check(
              'E11',
              'PASS',
              `全回环绿:发码(一次性消费)→access_token(len=${String(at).length}, scope="${grantedScope}")→userinfo.sub 与授权会话同一人`,
            )
          // E12:id_token 面 —— 响应里没有就直接点名根因，绝不因为"我们自己的客户端只用 userinfo"而记绿
          const idt = tok.json?.id_token
          if (!idt) {
            const src = idTokenCallSites()
            check(
              'E12',
              'FAIL',
              `token 响应无 id_token(scope 已含 openid)⇒ 该 AS 只成 userinfo 型 OIDC，严格的第三方 RP 会失败。` +
                `取证:oauth-tokens.ts 体内出现 'id_token' = ${src.tokensFileMentions}；` +
                `issueIdToken( 调用点 = ${src.callCount} 处${src.callSites.length ? `(${src.callSites.join(', ')})` : '(全仓零调用者 ⇒ 已实现未接线)'}，定义文件 = ${src.defFile}`,
            )
          } else {
            const v = verifyIdTokenWithJwks(idt, jwks || { keys: [] })
            const claims = v.claims || {}
            if (!v.ok) check('E12', 'FAIL', `id_token 验签不过:${v.why}`)
            else if (claims.iss !== issuer || claims.aud !== clientId || claims.sub !== sub)
              check(
                'E12',
                'FAIL',
                `id_token claims 不符 iss=${claims.iss}/${issuer} aud=${maskId(String(claims.aud))}/${maskId(clientId)} sub=${maskId(String(claims.sub))}/${maskId(String(sub))}`,
              )
            else
              check(
                'E12',
                'PASS',
                `id_token RS256 经 JWKS 真验签通过，iss/aud/sub 三claim 全对(claims=${Object.keys(claims).join(',')})`,
              )
          }
        }
      }
    }
  }

  // E13 api 自身的 oidc/redirect → callback 浏览器闭环
  if (doLoop) {
    if (!clientReady) check('E13', 'UNJUDGED', '客户端未就绪 ⇒ 消费侧闭环跑不了')
    else if (!bearer) check('E13', 'UNJUDGED', '无登录态 ⇒ authorize 不会发码')
    else {
      const rd = await req('GET', `${base}/api/auth/oauth/oidc/redirect`)
      const azUrl = rd.location || ''
      const azQ = azUrl ? new URL(azUrl).searchParams : null
      if (!azQ?.get('state'))
        check('E13', 'FAIL', `oidc/redirect 未 302 出带 state 的 authorize URL(HTTP ${rd.status})`)
      else {
        const az = await req('GET', azUrl, { headers: authHeaders })
        const backQ = az.location ? new URL(az.location).searchParams : null
        const code = backQ?.get('code')
        if (!code)
          check('E13', 'FAIL', `authorize(带 Bearer)未回跳发码:${az.location?.slice(0, 140) || `HTTP ${az.status}`}`)
        else {
          const cb = await req('GET', az.location) // 就是 OIDC_REDIRECT_URI?code=..&state=..
          const loc = cb.location || ''
          const cookieNames = cb.setCookies.map((c) => String(c).split('=')[0])
          if (cb.status === 302 && /\?sso=oidc/.test(loc))
            check(
              'E13',
              'PASS',
              `浏览器闭环绿:callback 302 → ${loc}(Set-Cookie: ${cookieNames.join(', ') || '(无)'})`,
            )
          else if (cb.status === 401 && /state/.test(cb.text))
            check('E13', 'FAIL', `callback 拒绝 state(HTTP 401 ${(cb.text || '').slice(0, 140)})`)
          else
            check('E13', 'FAIL', `callback 未按契约回跳:HTTP ${cb.status} Location=${loc || '(无)'} body=${(cb.text || '').slice(0, 160)}`)
        }
      }
    }
  }

  // E14 写 OIDC_* 四键
  if (apply) {
    if (!clientReady || !issuer) check('E14', 'UNJUDGED', '客户端未就绪 ⇒ 不写盘(绝不把半成品写进 .env)')
    else {
      const values = {
        OIDC_ISSUER: issuer,
        OIDC_CLIENT_ID: clientId,
        OIDC_CLIENT_SECRET: clientSecret,
        OIDC_REDIRECT_URI: redirectUri,
      }
      const bakDir = path.join(ROOT, '.ihui-agent', 'tmp', 'verify-oidc-self-idp')
      fs.mkdirSync(bakDir, { recursive: true })
      const bak = path.join(bakDir, `api.env.${new Date().toISOString().replace(/[:.]/g, '-')}.bak`)
      fs.writeFileSync(bak, envText, 'utf8')
      const out = upsertEnv(envText, values)
      fs.writeFileSync(API_ENV, out.text, 'utf8')
      const readBack = fs.readFileSync(API_ENV, 'utf8')
      const stillThere = OIDC_KEYS.every((k) => (envValueOf(readBack, k) || '') === values[k])
      const keyCountDelta = parseEnvLines(readBack).index.size - parseEnvLines(envText).index.size
      if (!stillThere) check('E14', 'FAIL', '写后回读四键不一致(缓存/编码?)⇒ 视为未落地')
      else
        check(
          'E14',
          'PASS',
          `apps/api/.env 已写 ${out.changed.join(', ') || '(值未变)'}｜OIDC_ISSUER=${issuer}｜OIDC_CLIENT_ID=${maskId(clientId)}｜OIDC_CLIENT_SECRET=${maskSecret(clientSecret)}｜OIDC_REDIRECT_URI=${redirectUri}｜行数 ${parseEnvLines(envText).lines.length}→${parseEnvLines(readBack).lines.length}(净增键 ${keyCountDelta})`,
        )
      note(`备份 = ${path.relative(ROOT, bak)}(含全部秘密，不入库不打印)`)
    }
  }

  return finish()
}

function finish() {
  const n = (v) => results.filter((r) => r.verdict === v).length
  const fails = results.filter((r) => r.verdict === 'FAIL')
  const unj = results.filter((r) => r.verdict === 'UNJUDGED')
  console.log('')
  console.log(
    `SUMMARY pass=${n('PASS')} fail=${fails.length} unjudged=${unj.length} skip=${n('SKIP')} — ${results
      .map((r) => `${r.id}:${r.verdict}`)
      .join(' ')}`,
  )
  if (fails.length > 0) {
    console.log('❌ 末行现读:FAIL ⇒ ' + fails.map((f) => `${f.id} ${f.detail}`).join(' ｜ ').slice(0, 900))
    process.exitCode = 1
    return
  }
  if (unj.length > 0) {
    console.log('❔ 末行现读:未判定(§0.3 不记绿也不冒红)⇒ ' + unj.map((u) => `${u.id} ${u.detail}`).join(' ｜ ').slice(0, 700))
    process.exitCode = 2
    return
  }
  console.log('✅ 末行现读:OIDC 自建 IdP 全部在册判据绿')
  process.exitCode = 0
}

// ────────────────────────────── 自检(纯函数，无网络无写盘) ──────────────────────────────

function selfTest() {
  let pass = 0
  let fail = 0
  const t = (name, got, want) => {
    const ok = JSON.stringify(got) === JSON.stringify(want)
    if (ok) pass++
    else fail++
    console.log(`${ok ? '✅' : '❌'} ${name}${ok ? '' : ` got=${JSON.stringify(got)} want=${JSON.stringify(want)}`}`)
  }
  t('parseEnvLines 取键索引', [...parseEnvLines('A=1\nB=2\nA=3\n').index.keys()], ['A', 'B'])
  t('envValueOf 剥引号', envValueOf('X="http://a/b"\n', 'X'), 'http://a/b')
  t(
    'upsertEnv 只改指定键并追加缺失键',
    (() => {
      const r = upsertEnv('PORT=8802\nJWT_SECRET=abc\n', { PORT: '9000', OIDC_ISSUER: 'http://127.0.0.1:8802' })
      return [r.text, r.changed]
    })(),
    ['PORT=9000\nJWT_SECRET=abc\nOIDC_ISSUER=http://127.0.0.1:8802\n', ['PORT', 'OIDC_ISSUER']],
  )
  t(
    'upsertEnv 末行为空行时不追加到文件尾之后',
    upsertEnv('A=1\n', { B: '2' }).text,
    'A=1\nB=2\n',
  )
  t('maskSecret 不含原值', (() => {
    const m = maskSecret('sec_verysecretvalue123456')
    return [m.includes('verysecret'), /^len=\d+ fp=[0-9a-f]{12}$/.test(m)]
  })(), [false, true])
  t('maskId 只留前 8', maskId('abcdefghijklmnopqrstuvwxyz').startsWith('abcdefgh…(len=26)'), true)
  t(
    'authorize URL 参数顺序与契约一致',
    buildExpectedAuthorizeUrl(
      { authorization_endpoint: 'http://127.0.0.1:8802/oauth/authorize' },
      'ci_1',
      'http://127.0.0.1:8802/api/auth/oauth/oidc/callback',
      'st',
    ),
    'http://127.0.0.1:8802/oauth/authorize?client_id=ci_1&redirect_uri=http%3A%2F%2F127.0.0.1%3A8802%2Fapi%2Fauth%2Foauth%2Foidc%2Fcallback&response_type=code&scope=openid+profile+email&state=st',
  )
  t('missingDiscoveryFields 抓空 jwks', missingDiscoveryFields({ authorization_endpoint: 'a', token_endpoint: 'b', userinfo_endpoint: 'c' }), ['jwks_uri'])
  t('oauthErrorOf 只认协议 error', oauthErrorOf({ json: { code: 0, message: 'ok' } }), null)
  t(
    'isCleanHttpNotFound 认框架 404 体',
    isCleanHttpNotFound({
      status: 404,
      json: { message: 'Route POST:/oauth/token-decoy not found', error: 'Not Found', statusCode: 404 },
    }),
    true,
  )
  t(
    'isCleanHttpNotFound 拒协议 404(那才是端点真在答话)',
    isCleanHttpNotFound({ status: 404, json: { error: 'invalid_client', error_description: 'x' } }),
    false,
  )
  t('isCleanHttpNotFound 拒非 404', isCleanHttpNotFound({ status: 200, json: { error: 'invalid_grant' } }), false)
  t('armsDistinguishable 相同即假', armsDistinguishable({ status: 401, error: 'x' }, { status: 401, error: 'x' }), false)
  t('armsDistinguishable 不同才真', armsDistinguishable({ status: 400, error: 'invalid_grant' }, { status: 401, error: 'invalid_client' }), true)
  console.log(`SELF-TEST ${pass} 例通过 / ${fail} 失败`)
  process.exitCode = fail > 0 ? 1 : 0
}

export const __test__ = {
  parseEnvLines,
  envValueOf,
  upsertEnv,
  maskSecret,
  maskId,
  buildExpectedAuthorizeUrl,
  missingDiscoveryFields,
  oauthErrorOf,
  isCleanHttpNotFound,
  armsDistinguishable,
}

const isDirectRun = process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href
if (isDirectRun) {
  main().catch((e) => {
    console.error(`❌ ${e?.message ?? e}\n${e?.stack ?? ''}`)
    process.exit(2)
  })
}
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
