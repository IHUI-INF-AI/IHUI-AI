// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

// 复用 Chrome 默认 profile 的登录会话:起授权页 → 自动回调拿 AuthCode → 换票 → 回写池
// 全程无人工。若 profile 里会话有效,打开立即回调。
import fs from 'node:fs'
import http from 'node:http'
import path from 'node:path'
import crypto from 'node:crypto'
import { createRequire } from 'node:module'
import { pathToFileURL } from 'node:url'

const API_DIR = 'G:/IHUI-AI/apps/api'
const ROOT = 'G:/IHUI-AI'
const requireApi = createRequire(API_DIR + '/package.json')
const { config: dotenvConfig } = await import(pathToFileURL(requireApi.resolve('dotenv')).href)
dotenvConfig({ path: API_DIR + '/.env' })

const { chromium } = createRequire('G:/IHUI-AI/node_modules/.pnpm/playwright@1.62.1/node_modules/playwright/package.json')('playwright-core')

const UID = '2257723987855312'
const PORT = 47836
const CLIENT_ID = 'ono9krqynydwx5'
const IDE_VERSION = '1.107.1'
const CHROME_PROFILE = 'C:/Users/Administrator/AppData/Local/Google/Chrome/User Data'
// 复制一份 profile 落地(不污染用户原 profile)
const PROFILE_COPY = 'G:/IHUI-AI/.ihui-agent/tmp/cpc2'

const verifier = crypto.randomBytes(48).toString('base64url')
const challenge = crypto.createHash('sha256').update(verifier).digest('base64url')
const traceId = crypto.randomUUID()

const ex = await import(pathToFileURL(path.join(ROOT, 'scripts/lib/trae-auth-extract.mjs')).href)
const sw = await import(pathToFileURL(path.join(ROOT, 'scripts/lib/trae-client-switch.mjs')).href)
const store = JSON.parse(fs.readFileSync(sw.findStorageFile(), 'utf8'))
const dev = ex.extractDeviceMaterial(store)
let deviceId = dev.deviceId
try {
  const tiny = JSON.parse(fs.readFileSync(path.join(process.env.APPDATA, 'Trae CN', 'aha', 'TinyStorage'), 'utf8'))
  deviceId = JSON.parse(ex.decryptEnvelope(tiny.tiny_storage_data['aha.device.device_id'])).device_id_str
} catch {}

let authCode = null
const server = http.createServer((req, res) => {
  const url = new URL(req.url, `http://127.0.0.1:${PORT}`)
  let code = ''
  try { code = JSON.parse(url.searchParams.get('authCodeInfo') || '')?.AuthCode ?? '' } catch {}
  if (!code) code = url.searchParams.get('code') ?? ''
  res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' })
  res.end('<h2>OK</h2>')
  if (code) { authCode = code; console.log('[callback] 拿到 AuthCode ✅') }
})
await new Promise((ok) => server.listen(PORT, '127.0.0.1', ok))
console.log('[callback] 监听 127.0.0.1:' + PORT)

const qs = new URLSearchParams({
  login_version: '1', auth_from: 'trae', login_channel: 'native_ide', plugin_version: 'local',
  auth_type: 'local', client_id: CLIENT_ID, redirect: '0', login_trace_id: traceId,
  auth_callback_url: `http://127.0.0.1:${PORT}/authorize`,
  machine_id: dev.machineId || '', device_id: deviceId,
  x_device_id: deviceId, x_machine_id: dev.machineId || '',
  x_device_type: 'Windows', x_app_version: IDE_VERSION, x_app_type: 'IDE',
  code_challenge: challenge, code_challenge_method: 'S256',
}).toString()
const AUTH_URL = `https://www.trae.cn/authorization?${qs}`

// 用 Chrome 默认 profile 启动(headless,无需人看)
const browser = await chromium.launchPersistentContext(PROFILE_COPY, {
  headless: true,
  channel: 'chrome',
  executablePath: 'C:/Users/Administrator/AppData/Local/Google/Chrome/Application/chrome.exe',
  args: ['--no-sandbox', '--disable-gpu', '--disable-dev-shm-usage'],
  viewport: { width: 1200, height: 860 },
})
console.log('[page] 用持久化 profile 启动(headless)')
const pages = browser.pages()
const page = pages.length > 0 ? pages[0] : await browser.newPage()
await page.goto(AUTH_URL, { waitUntil: 'domcontentloaded', timeout: 60000 }).catch((e) => console.log('[page] goto:', e.message.slice(0, 60)))

for (let i = 0; i < 40 && !authCode; i++) await page.waitForTimeout(1500)
if (!authCode) {
  const txt = await page.evaluate(() => document.body.innerText.replace(/\n+/g, ' | ').slice(0, 200)).catch(() => '')
  console.log('❌ profile 会话无效,页面:', txt)
  await browser.close(); server.close(); process.exit(1)
}

const res = await fetch('https://api.trae.cn/trae/api/v3/oauth/ExchangeToken', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json', 'x-cloudide-token': '' },
  body: JSON.stringify({
    ClientID: CLIENT_ID, AuthCode: authCode, CodeVerifier: verifier,
    DeviceInfo: {
      DeviceID: deviceId, MachineID: dev.machineId || '', PlatformCode: 'IDE_PC', DeviceType: 'PC',
      DeviceName: 'PC', DeviceModel: '', ClientVersion: IDE_VERSION, DevicePublicKey: dev.publicKeyPem,
      DeviceBrand: '', DeviceCPU: '', OSInfo: 'Windows', OSVersion: '',
    },
    IDEVersion: IDE_VERSION,
  }),
})
const text = await res.text()
console.log('[exchange] HTTP', res.status)
if (!res.ok) { console.log(text.slice(0, 300)); await browser.close(); server.close(); process.exit(1) }

const proto = await import(pathToFileURL(path.join(API_DIR, 'src/services/upstream-adapters/trae-protocol.ts')).href)
const j = JSON.parse(text)
const payload = proto.extractTokenPayload(j)
const receipt = proto.extractDeviceBindReceipt(j)
if (!payload?.token) { console.log('❌ 无 Token'); await browser.close(); server.close(); process.exit(1) }
console.log('✅ 新票 BOUND=' + (receipt?.boundDeviceId ?? '-') + ' ' + (receipt?.bindStatus ?? ''))

const { eq } = await import(pathToFileURL(requireApi.resolve('drizzle-orm')).href)
const { aiRelayAccountPool } = await import(pathToFileURL(requireApi.resolve('@ihui/database')).href)
const { decryptField, encryptField } = await import(pathToFileURL(path.join(API_DIR, 'src/utils/crypto.js')).href)
const { db } = await import(pathToFileURL(path.join(API_DIR, 'src/db/index.js')).href)

const rows = await db.select().from(aiRelayAccountPool).where(eq(aiRelayAccountPool.providerCode, 'trae'))
const r = rows.find((x) => String(x.uid) === UID)
if (!r) { console.log('❌ 池里没这枚号'); await browser.close(); server.close(); process.exit(1) }

const infoRes = await fetch('https://api.trae.cn/cloudide/api/v3/trae/GetUserInfo', {
  method: 'POST', headers: { 'Content-Type': 'application/json', 'x-cloudide-token': payload.token },
  body: JSON.stringify({ IDEVersion: IDE_VERSION }),
})
const u = JSON.parse(await infoRes.text())?.Result ?? {}
console.log('[profile] ' + u.ScreenName + ' / ' + u.NonPlainTextMobile + ' / region=' + (u.Region ?? u.AIRegion))
if (String(u.UserID) !== UID) { console.log('❌ uid 不符:', u.UserID); await browser.close(); server.close(); process.exit(1) }

const account = {
  username: String(u.ScreenName ?? ''), iss: '', iat: 0, organization: '', work_country: '',
  email: String(u.NonPlainTextEmail ?? ''), avatar_url: String(u.AvatarUrl ?? ''), description: '',
  scope: 'marscode', loginScope: 'trae', nonPlainTextMobile: String(u.NonPlainTextMobile ?? ''),
  storeCountryCode: '', storeCountrySrc: '',
  storeRegion: String(u.Region ?? u.AIRegion ?? 'CN'), userTag: 'cn', migrateToSG: u.MigrateToSG === true,
}
const profile = { host: 'https://api.trae.cn', userRegion: { region: account.storeRegion, _aiRegion: account.storeRegion }, tokenReleaseAt: new Date().toISOString(), account }
let prev = {}
try { prev = r.secretsEnc ? JSON.parse(decryptField(r.secretsEnc)) : {} } catch {}
const nextSecrets = { ...prev, profile, sessionTemplate: { ...profile, userId: UID }, deviceKeyPem: dev.privateKeyPem, devicePubPem: dev.publicKeyPem }
const applied = await db.update(aiRelayAccountPool).set({
  tokenEnc: encryptField(payload.token),
  ...(payload.refreshToken ? { refreshTokenEnc: encryptField(payload.refreshToken) } : {}),
  ...(payload.expiresAt ? { tokenExpiresAt: payload.expiresAt } : {}),
  secretsEnc: encryptField(JSON.stringify(nextSecrets)),
  deviceId, machineId: dev.machineId || '',
  healthStatus: 'healthy', tempUnschedulable: false, refreshFailureCount: 0, consecutiveFailures: 0,
  lastErrorMessage: null, lastRefreshAt: new Date(), updatedAt: new Date(),
}).where(eq(aiRelayAccountPool.id, r.id)).returning({ id: aiRelayAccountPool.id })
console.log(applied.length ? '✅ 已回写:新票 + 档案 + 本机设备材料 + 健康 healthy + 摘除解除' : '⚠️ CAS 未命中')
await browser.close(); server.close()
await db.$client?.end?.()
process.exit(0)
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
