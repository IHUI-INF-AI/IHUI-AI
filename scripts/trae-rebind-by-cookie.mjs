// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * Trae 号池·用池内 cookie 自动完成授权码重绑(2026-11-26 立)。
 *
 * 解决的那一格:`trae-rebind-by-authorize.mjs` 走的是**系统浏览器当前登录的号**,
 * 机主不愿意(或没法)为某枚号再收一次短信时,那条路就走不通。而号池里很多号
 * 带着一份仍然有效的 web cookie(GetUserToken 能换出票 ⇒ cookie 活着)。
 * 于是这里把 cookie 注进一个干净的 playwright 上下文,自己打开授权页、点"登录并打开 TRAE",
 * 拿本地回调的 AuthCode,再走 ExchangeToken(auth_code) 把 rt 重新绑到**本机设备身份**。
 *
 * 为什么必须走 auth_code 而不是让客户端用现成票:
 *   客户端 authUtil 的判据(2026-11-26 从 main.js 逐字读出)是
 *   `剩余寿命 <= 24h 或 (总寿命/3 > 剩余寿命) ⇒ NEED_REFRESH`,只有 VALID_TOKEN 才直接用票。
 *   web 票只有 ~8h ⇒ 必被判 NEED_REFRESH ⇒ 拿废 rt 去撞 20403 ⇒ clearUserInfo。
 *   只有 auth_code/rt 换出来的 14 天票才能过 24h 这道坎。
 *
 * 用法:
 *   node scripts/trae-rebind-by-cookie.mjs --uid <uid> [--port 47833] [--keep-open]
 * 退出码:0 成功 / 1 业务失败 / 2 未判定
 */
import fs from 'node:fs'
import http from 'node:http'
import path from 'node:path'
import crypto from 'node:crypto'
import { createRequire } from 'node:module'
import { pathToFileURL, fileURLToPath } from 'node:url'

const HERE = path.dirname(fileURLToPath(import.meta.url))
const ROOT = path.resolve(HERE, '..')
const API_DIR = path.join(ROOT, 'apps', 'api')
const CLIENT_ID = 'ono9krqynydwx5'
const LOGIN_HOST = 'https://www.trae.cn'
const EXCHANGE_URL = 'https://api.trae.cn/trae/api/v3/oauth/ExchangeToken'
const IDE_VERSION = '1.107.1'
const DEFAULT_PORT = 47833

const arg = (argv, name, def = null) => {
  const i = argv.indexOf(name)
  return i >= 0 && argv[i + 1] && !argv[i + 1].startsWith('--') ? argv[i + 1] : def
}
const has = (argv, name) => argv.includes(name)

const pkce = () => {
  const verifier = crypto.randomBytes(48).toString('base64url')
  const challenge = crypto.createHash('sha256').update(verifier).digest('base64url')
  return { verifier, challenge }
}
const qs = (o) => new URLSearchParams(o).toString()

function buildAuthorizeUrl({ port, machineId, deviceId, challenge, traceId }) {
  const head = {
    x_device_id: deviceId,
    x_machine_id: machineId || '',
    x_device_type: 'Windows',
    x_app_version: IDE_VERSION,
    x_app_type: 'IDE',
    code_challenge: challenge,
    code_challenge_method: 'S256',
  }
  return (
    `${LOGIN_HOST}/authorization?` +
    qs({
      login_version: '1',
      auth_from: 'trae',
      login_channel: 'native_ide',
      plugin_version: 'local',
      auth_type: 'local',
      client_id: CLIENT_ID,
      redirect: '0',
      login_trace_id: traceId,
      auth_callback_url: `http://127.0.0.1:${port}/authorize`,
      machine_id: machineId || '',
      device_id: deviceId,
    }) +
    `&${qs(head)}`
  )
}

function waitForCallback(port, timeoutMs = 180000) {
  return new Promise((resolve) => {
    const server = http.createServer((req, res) => {
      const url = new URL(req.url, `http://127.0.0.1:${port}`)
      if (url.pathname !== '/authorize') {
        res.writeHead(404).end('not found')
        return
      }
      const raw = url.searchParams.get('authCodeInfo') || url.searchParams.get('auth_code_info') || ''
      let code = ''
      try {
        code = raw ? (JSON.parse(raw)?.AuthCode ?? '') : ''
      } catch {}
      if (!code) code = url.searchParams.get('code') ?? ''
      res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' })
      res.end('<h2>已收到授权,回到终端继续</h2>')
      server.close()
      resolve({ code, raw: url.search })
    })
    server.on('error', (e) => resolve({ error: e.message }))
    server.listen(port, '127.0.0.1')
    setTimeout(() => {
      try {
        server.close()
      } catch {}
      resolve({ error: `等待授权超时(${timeoutMs / 1000}s)` })
    }, timeoutMs).unref?.()
  })
}

/** 池内 Chrome 导出格式 cookie → playwright addCookies 形状
 *
 * 设备指纹类 cookie(s_v_web_id/ttwid/_tea_* 等)是**采集那台设备**的标识,搬到别的浏览器里
 * 会让授权页 React 直接崩(2026-11-26 实测:注入全量 18 条 → 白屏 + React #421;
 * 剔除指纹类只留会话类 15 条 → 正常渲染"欢迎回来")。所以这里按名单剔掉。
 */
const COOKIE_SKIP = /^(s_v_web_id|ttwid|_tea_|gfkadpd|_clck|_clsk|_uetsid|_uetvid|n_mh|session_tlb_tag|odin_tt)$/

function toPlaywrightCookies(list) {
  const now = Date.now() / 1000
  const out = []
  for (const c of list) {
    if (!c?.name || typeof c.value !== 'string') continue
    if (COOKIE_SKIP.test(c.name)) continue
    const expChrome = Number(c.expires_utc || 0)
    const expires = expChrome ? expChrome / 1e6 - 11644473600 : -1
    if (expires > 0 && expires < now) continue
    out.push({
      name: c.name,
      value: c.value,
      domain: c.host_key,
      path: c.path || '/',
      expires: expires > 0 ? expires : -1,
      httpOnly: c.is_httponly === 1,
      secure: c.is_secure === 1,
      sameSite: 'Lax',
    })
  }
  return out
}

async function main(argv) {
  if (argv.length === 0 || has(argv, '--help')) {
    process.stdout.write(
      '用法: node scripts/trae-rebind-by-cookie.mjs --uid <uid> [--port 47833] [--keep-open]\n',
    )
    return argv.length === 0 ? 2 : 0
  }
  const uid = arg(argv, '--uid')
  if (!uid) {
    process.stderr.write('❌ 需要 --uid <uid>\n')
    return 2
  }
  const port = Number(arg(argv, '--port', DEFAULT_PORT))
  process.env.NODE_TLS_REJECT_UNAUTHORIZED = process.env.NODE_TLS_REJECT_UNAUTHORIZED ?? '0'

  const requireApi = createRequire(path.join(API_DIR, 'package.json'))
  const dotenv = await import(pathToFileURL(requireApi.resolve('dotenv')).href)
  dotenv.config({ path: path.join(API_DIR, '.env') })

  const { eq } = await import(pathToFileURL(requireApi.resolve('drizzle-orm')).href)
  const { aiRelayAccountPool } = await import(pathToFileURL(requireApi.resolve('@ihui/database')).href)
  const { decryptField, encryptField } = await import(
    pathToFileURL(path.join(API_DIR, 'src/utils/crypto.js')).href
  )
  const { db } = await import(pathToFileURL(path.join(API_DIR, 'src/db/index.js')).href)
  const ex = await import(pathToFileURL(path.join(HERE, 'lib/trae-auth-extract.mjs')).href)
  const sw = await import(pathToFileURL(path.join(HERE, 'lib/trae-client-switch.mjs')).href)

  const { chromium } = createRequire(
    path.join(ROOT, 'node_modules', '.pnpm', 'playwright@1.62.1', 'node_modules', 'playwright', 'package.json'),
  )('playwright-core')

  // 本机设备材料(必须与客户端同源,否则绑出来的票客户端不认)
  const store = JSON.parse(fs.readFileSync(sw.findStorageFile(), 'utf8'))
  const dev = ex.extractDeviceMaterial(store)
  if (!dev) {
    process.stderr.write('❌ 读不到本机设备密钥对 ⇒ 未判定\n')
    return 2
  }
  let deviceId = dev.deviceId
  try {
    const tiny = JSON.parse(fs.readFileSync(path.join(process.env.APPDATA, 'Trae CN', 'aha', 'TinyStorage'), 'utf8'))
    const info = JSON.parse(ex.decryptEnvelope(tiny.tiny_storage_data['aha.device.device_id']))
    if (info?.device_id_str) deviceId = info.device_id_str
  } catch {}

  const rows = await db.select().from(aiRelayAccountPool).where(eq(aiRelayAccountPool.providerCode, 'trae'))
  const row = rows.find((x) => String(x.uid) === String(uid))
  if (!row) {
    process.stderr.write(`❌ 号池里没有 uid=${uid}\n`)
    return 1
  }
  if (!row.cookiesEnc) {
    process.stderr.write(`❌ uid=${uid} 没有 cookie,只能走 --authorize 人工通道\n`)
    return 1
  }
  const cookies = toPlaywrightCookies(JSON.parse(decryptField(row.cookiesEnc)))
  console.log(`═══ cookie 重绑 uid=${uid} ${row.name} cookies=${cookies.length} deviceId=${deviceId} ═══`)
  if (cookies.length === 0) {
    process.stderr.write('❌ 池内 cookie 全部过期\n')
    return 1
  }

  const { verifier, challenge } = pkce()
  const traceId = crypto.randomUUID()
  const url = buildAuthorizeUrl({ port, machineId: dev.machineId || '', deviceId, challenge, traceId })
  const waiter = waitForCallback(port)

  const browser = await chromium.launch({
    headless: !has(argv, '--keep-open'),
    channel: 'chrome',
    executablePath: 'C:/Users/Administrator/AppData/Local/Google/Chrome/Application/chrome.exe',
    args: ['--no-sandbox', '--disable-gpu'],
  })
  const ctx = await browser.newContext({ locale: 'zh-CN', viewport: { width: 1200, height: 860 } })
  await ctx.addCookies(cookies)
  const page = await ctx.newPage()
  await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 60000 }).catch((e) => {
    console.log('[page] goto:', e.message.slice(0, 80))
  })

  // 授权页对"已登录"的号会停在确认页,需要一个点击才会回调;没登录则是登录表单
  for (let i = 0; i < 20; i++) {
    const txt = await page.evaluate(() => document.body.innerText).catch(() => '')
    if (/认证中|Authenticating/i.test(txt)) {
      console.log('[page] 认证中,等回调…')
      break
    }
    if (/登录并打开|Sign in and open/i.test(txt)) {
      console.log('[page] 命中确认页,点击「登录并打开 TRAE」')
      await page
        .getByText(/登录并打开|Sign in and open/i)
        .first()
        .click({ timeout: 5000 })
        .catch((e) => console.log('[page] click:', e.message.slice(0, 60)))
      break
    }
    if (i === 19) {
      const shot = path.join(ROOT, '.tmp', `rebind-cookie-${uid}.png`)
      await page.screenshot({ path: shot }).catch(() => {})
      const html = await page.content().catch(() => '')
      console.error('❌ 授权页不是确认页(cookie 可能不足以代表该号登录):', txt.replace(/\n+/g, ' | ').slice(0, 200))
      console.error('   url=', page.url(), ' htmlLen=', html.length, ' head=', html.slice(0, 240).replace(/\n/g, ' '))
      console.error('   截图:', shot)
      await browser.close()
      return 1
    }
    await page.waitForTimeout(800)
  }

  const cb = await waiter
  await browser.close().catch(() => {})
  if (cb.error) {
    console.error(`❌ 回调失败:${cb.error}`)
    return 1
  }
  if (!cb.code) {
    console.error(`❌ 回调里没有 AuthCode(响应:${String(cb.raw).slice(0, 200)})`)
    return 1
  }
  console.log('✅ 拿到 AuthCode,开始换票…')

  const res = await fetch(EXCHANGE_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'x-cloudide-token': '' },
    body: JSON.stringify({
      ClientID: CLIENT_ID,
      AuthCode: cb.code,
      CodeVerifier: verifier,
      DeviceInfo: {
        DeviceID: deviceId,
        MachineID: dev.machineId || '',
        PlatformCode: 'IDE_PC',
        DeviceType: 'PC',
        DeviceName: 'PC',
        DeviceModel: '',
        ClientVersion: IDE_VERSION,
        DevicePublicKey: dev.publicKeyPem,
        DeviceBrand: '',
        DeviceCPU: '',
        OSInfo: 'Windows',
        OSVersion: '',
      },
      IDEVersion: IDE_VERSION,
    }),
  })
  const text = await res.text()
  if (!res.ok) {
    console.error(`❌ 换票失败 HTTP ${res.status}:${text.slice(0, 300)}`)
    return 1
  }
  let payload = null
  let receipt = null
  try {
    const proto = await import(
      pathToFileURL(path.join(API_DIR, 'src/services/upstream-adapters/trae-protocol.ts')).href
    )
    const j = JSON.parse(text)
    payload = proto.extractTokenPayload(j)
    receipt = proto.extractDeviceBindReceipt(j)
  } catch {}
  if (!payload?.token) {
    console.error(`❌ 换票响应无 Token:${text.slice(0, 200)}`)
    return 1
  }
  console.log(`✅ 新票 BOUND=${receipt?.boundDeviceId ?? '-'} status=${receipt?.bindStatus ?? '-'} exp=${payload.expiresAt ?? '-'}`)

  // 验明正身
  const infoRes = await fetch('https://api.trae.cn/cloudide/api/v3/trae/GetUserInfo', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'x-cloudide-token': payload.token },
    body: JSON.stringify({ IDEVersion: IDE_VERSION }),
  })
  let info = {}
  try {
    info = JSON.parse(await infoRes.text())?.Result ?? {}
  } catch {}
  if (String(info.UserID) !== String(uid)) {
    console.error(`❌ 票主 ${info.UserID} 与目标 ${uid} 不符 ⇒ 拒绝回写`)
    return 1
  }
  console.log(`✅ 号主核对:${info.ScreenName ?? ''} / ${info.NonPlainTextMobile ?? ''}`)

  const prev = row.secretsEnc ? JSON.parse(decryptField(row.secretsEnc)) : {}
  const region = String(info.Region ?? info.AIRegion ?? prev?.profile?.account?.storeRegion ?? 'CN')
  const account = {
    username: String(info.ScreenName ?? ''),
    iss: '',
    iat: 0,
    organization: '',
    work_country: '',
    email: String(info.NonPlainTextEmail ?? ''),
    avatar_url: String(info.AvatarUrl ?? ''),
    description: '',
    scope: 'marscode',
    loginScope: 'trae',
    nonPlainTextMobile: String(info.NonPlainTextMobile ?? ''),
    storeCountryCode: '',
    storeCountrySrc: '',
    storeRegion: region,
    userTag: 'cn',
    migrateToSG: info.MigrateToSG === true,
  }
  const nowIso = new Date().toISOString()
  const profile = {
    host: 'https://api.trae.cn',
    userRegion: { region, _aiRegion: region },
    tokenReleaseAt: nowIso,
    account,
  }
  const nextSecrets = {
    ...prev,
    deviceKeyPem: dev.privateKeyPem,
    devicePubPem: dev.publicKeyPem,
    profile,
    sessionTemplate: { ...profile, userId: uid },
  }
  const applied = await db
    .update(aiRelayAccountPool)
    .set({
      tokenEnc: encryptField(payload.token),
      ...(payload.refreshToken ? { refreshTokenEnc: encryptField(payload.refreshToken) } : {}),
      ...(payload.expiresAt ? { tokenExpiresAt: payload.expiresAt } : {}),
      secretsEnc: encryptField(JSON.stringify(nextSecrets)),
      deviceId,
      machineId: dev.machineId || '',
      healthStatus: 'healthy',
      tempUnschedulable: false,
      refreshFailureCount: 0,
      consecutiveFailures: 0,
      lastErrorMessage: null,
      lastRefreshAt: new Date(),
      updatedAt: new Date(),
    })
    .where(eq(aiRelayAccountPool.id, row.id))
    .returning({ id: aiRelayAccountPool.id })
  if (applied.length === 0) {
    console.error('⚠️ 回写未命中(CAS),新票可能蒸发 —— 立刻重跑')
    return 2
  }
  console.log('✅ 已回写池:长票 + 本机设备材料 + 新 rt(以后这枚号在本机可直接换票)')
  await db.$client?.end?.()
  return 0
}

/**
 * §22d 入口守卫:只有被直接执行时才跑 main。
 * 裸 `main()` 会让 `import` 本文件的任何程序都自动开跑(且守卫脚本会拦提交)。
 */
const isDirectRun = process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href
if (isDirectRun) {
  main(process.argv.slice(2))
    .then((c) => process.exit(c))
    .catch((e) => {
      process.stderr.write(`❌ ${e instanceof Error ? e.message : String(e)}\n`)
      process.exit(2)
    })
}
export const __test__ = { main }
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
