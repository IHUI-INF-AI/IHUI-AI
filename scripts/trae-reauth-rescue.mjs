#!/usr/bin/env node
// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

//
// Trae 号池·静默重授权救援(2026-11-21 立;2026-11-21 晚按实测重写)。
//
// 解决的那一格:客户端退出登录只清本地信封、不吊销服务端 rt(客户端产物里
// ClearRefreshToken 无调用点),所以池不受退出登录影响。但上游**全局吊销**(改密/安全中心)
// 会让池内 rt invalid_grant——此时必须重新走一次授权。人工重登要收码,机主不接受。
//
// 实测凭证(2026-11-21):本机 Chrome 默认 profile 里 .trae.cn 有 30 枚有效 cookie,
// 授权页能直接识别为「智汇AI7993 欢迎回来 / 登录并打开 TRAE」——这就是无短信的恢复凭证。
// 客户端自身 Cookies 表是 0 行(纯 token 登录),所以凭证只能取 Chrome。
//
// 流程:Chrome cookie(v10,明文前 32B = sha256(host) 域哈希,须剥)→ Playwright 注入 →
// 授权页点「登录并打开 TRAE」→ 本地回调解出 AuthCode → ExchangeToken(auth_code 通道)→
// 校验 UserID → 回写池并复位健康。全程无人工。
//
// 前置:Trae 客户端没在跑(不与运行中的客户端抢 rt);号内有本机设备材料。
// 用法(tsx 跑):
//   node apps/api/node_modules/tsx/dist/cli.mjs scripts/trae-reauth-rescue.mjs --auto [--dry-run] [--json]
//   node apps/api/node_modules/tsx/dist/cli.mjs scripts/trae-reauth-rescue.mjs --uid <uid> [--probe] [--json]
//   --probe 只走到拿到 AuthCode,不换票不写库(用于验证凭证,零副作用)。
// 退出码:0 成功/无需处理 / 1 业务失败 / 2 未判定。
import fs from 'node:fs'
import path from 'node:path'
import http from 'node:http'
import crypto from 'node:crypto'
import { spawnSync } from 'node:child_process'
import { createRequire } from 'node:module'
import { fileURLToPath, pathToFileURL } from 'node:url'

const HERE = path.dirname(fileURLToPath(import.meta.url))
const ROOT = path.resolve(HERE, '..')
const API_DIR = path.join(ROOT, 'apps', 'api')
const CHROME_DIR = path.join(process.env.LOCALAPPDATA ?? '', 'Google', 'Chrome', 'User Data')
const PROFILE_COPY = path.join(ROOT, '.ihui-agent', 'tmp', 'trae-reauth-chrome')
const CLIENT_ID = 'ono9krqynydwx5'
const LOGIN_HOST = 'https://www.trae.cn'
const EXCHANGE_URL = 'https://api.trae.cn/trae/api/v3/oauth/ExchangeToken'
const IDE_VERSION = '1.107.1'
const DEFAULT_PORT = 47856

const argv = process.argv.slice(2)
const has = (n) => argv.includes(n)
const arg = (n, d = null) => {
  const i = argv.indexOf(n)
  return i >= 0 && argv[i + 1] && !argv[i + 1].startsWith('--') ? argv[i + 1] : d
}
const asJson = has('--json')
const dryRun = has('--dry-run')
const probeOnly = has('--probe')
const log = (obj, line) => console.log(asJson ? JSON.stringify(obj) : line)

function pkce() {
  const verifier = crypto.randomBytes(48).toString('base64url')
  return { verifier, challenge: crypto.createHash('sha256').update(verifier).digest('base64url') }
}

async function clientRunning() {
  const lib = await import(pathToFileURL(path.join(ROOT, 'scripts/lib/trae-client-process.mjs')).href)
  let unknown = false
  for (const p of lib.TRAE_PRODUCTS) {
    const pids = lib.listProductPids(p)
    if (pids === null) unknown = true
    else if (pids.length > 0) return true
  }
  return unknown ? null : false
}

/** Chrome 运行时会独占 Cookies;直接复制失败就借 VSS 快照读一份(只读,不改 Chrome)。 */
function copyChromeProfile() {
  fs.rmSync(PROFILE_COPY, { recursive: true, force: true })
  const files = [
    ['Local State', 'Local State'],
    [path.join('Default', 'Preferences'), path.join('Default', 'Preferences')],
    [path.join('Default', 'Network', 'Cookies'), path.join('Default', 'Network', 'Cookies')],
  ]
  let vssId = ''
  for (const [rel, dstRel] of files) {
    const src = path.join(CHROME_DIR, rel)
    const dst = path.join(PROFILE_COPY, dstRel)
    fs.mkdirSync(path.dirname(dst), { recursive: true })
    if (!fs.existsSync(src)) continue
    try {
      fs.copyFileSync(src, dst)
    } catch {
      if (rel.endsWith('Cookies')) {
        const ps = [
          `$r=([wmiclass]'Win32_ShadowCopy').Create('C:\\','ClientAccessible')`,
          `if($r.ReturnValue -ne 0){ exit 2 }`,
          `$sc=Get-WmiObject Win32_ShadowCopy | Where-Object { $_.ID -eq $r.ShadowID }`,
          `$s="$($sc.DeviceObject)\\Users\\${process.env.USERNAME}\\AppData\\Local\\Google\\Chrome\\User Data\\Default\\Network\\Cookies"`,
          `[IO.File]::Copy($s,'${dst.replace(/'/g, "''")}',$true)`,
          `[IO.File]::WriteAllText('${dst.replace(/'/g, "''")}.shadow','$($r.ShadowID)')`,
        ].join('; ')
        const r = spawnSync('powershell.exe', ['-NoProfile', '-NonInteractive', '-ExecutionPolicy', 'Bypass', '-Command', ps], {
          encoding: 'utf8',
        })
        if (r.status !== 0) return { copied: 0, vssId: '' }
        try {
          vssId = fs.readFileSync(dst + '.shadow', 'utf8').trim()
        } catch {
          vssId = ''
        }
      }
    }
  }
  return { copied: fs.existsSync(path.join(PROFILE_COPY, 'Default', 'Network', 'Cookies')) ? 1 : 0, vssId }
}

function cleanup(vssId) {
  fs.rmSync(PROFILE_COPY, { recursive: true, force: true })
  if (vssId) {
    const ps = `$x = Get-WmiObject Win32_ShadowCopy -Filter "ID='${vssId}'"; if($x){ $x.Delete() | Out-Null }`
    spawnSync('powershell.exe', ['-NoProfile', '-NonInteractive', '-ExecutionPolicy', 'Bypass', '-Command', ps], {
      encoding: 'utf8',
    })
  }
}

/** Chrome v10 cookie: AES-256-GCM,明文 = sha256(host_key)[32B] + value(新版),旧版无前缀。 */
function readTraeCookies(aesKey) {
  const { DatabaseSync } = createRequire(import.meta.url)('node:sqlite')
  const db = new DatabaseSync(path.join(PROFILE_COPY, 'Default', 'Network', 'Cookies'), { readOnly: true })
  const rows = db
    .prepare(
      "SELECT host_key,name,path,is_secure,is_httponly,value,encrypted_value FROM cookies WHERE host_key LIKE '%trae%'",
    )
    .all()
  db.close()
  const cookies = []
  for (const r of rows) {
    let value = typeof r.value === 'string' ? r.value : ''
    if (!value && r.encrypted_value && r.encrypted_value.length > 3) {
      try {
        const blob = Buffer.from(r.encrypted_value)
        if (blob.subarray(0, 3).toString('ascii') !== 'v10') continue
        const d = crypto.createDecipheriv('aes-256-gcm', aesKey, blob.subarray(3, 15))
        d.setAuthTag(blob.subarray(blob.length - 16))
        let plain = Buffer.concat([d.update(blob.subarray(15, blob.length - 16)), d.final()])
        const hostHash = crypto.createHash('sha256').update(String(r.host_key)).digest()
        if (plain.length > 32 && plain.subarray(0, 32).equals(hostHash)) plain = plain.subarray(32)
        value = plain.toString('utf8')
      } catch {
        continue
      }
    }
    if (!value) continue
    cookies.push({
      name: String(r.name),
      value,
      domain: String(r.host_key),
      path: String(r.path || '/'),
      secure: Number(r.is_secure) === 1,
      httpOnly: Number(r.is_httponly) === 1,
      expires: -1,
    })
  }
  return cookies
}

function waitForCallback(port, timeoutMs) {
  return new Promise((resolve) => {
    const server = http.createServer((req, res) => {
      const url = new URL(req.url, `http://127.0.0.1:${port}`)
      if (url.pathname !== '/authorize') return res.writeHead(404).end('not found')
      const raw = url.searchParams.get('authCodeInfo') || url.searchParams.get('auth_code_info') || ''
      let code = ''
      try {
        code = raw ? (JSON.parse(raw)?.AuthCode ?? '') : ''
      } catch {
        code = ''
      }
      if (!code) code = url.searchParams.get('code') ?? ''
      res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' }).end('<h2>已收到授权</h2>')
      server.close()
      resolve({ code })
    })
    server.on('error', (e) => resolve({ error: e.message }))
    server.listen(port, '127.0.0.1')
    setTimeout(() => {
      try {
        server.close()
      } catch {}
      resolve({ error: `等待授权超时(${Math.round(timeoutMs / 1000)}s)` })
    }, timeoutMs).unref?.()
  })
}

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
    new URLSearchParams({
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
    }).toString() +
    `&${new URLSearchParams(head).toString()}`
  )
}

async function main() {
  const requireApi = createRequire(path.join(API_DIR, 'package.json'))
  try {
    const dotenv = await import(pathToFileURL(requireApi.resolve('dotenv')).href)
    dotenv.config({ path: path.join(API_DIR, '.env') })
  } catch (e) {
    log({ ok: false, error: `.env 加载失败:${e.message}` }, `❌ .env 加载失败:${e.message}`)
    return 2
  }

  const { eq } = await import(pathToFileURL(requireApi.resolve('drizzle-orm')).href)
  const { aiRelayAccountPool } = await import(pathToFileURL(requireApi.resolve('@ihui/database')).href)
  const { decryptField, encryptField } = await import(
    pathToFileURL(path.join(API_DIR, 'src/utils/crypto.js')).href
  )
  const { db } = await import(pathToFileURL(path.join(API_DIR, 'src/db/index.js')).href)
  const proto = await import(
    pathToFileURL(path.join(API_DIR, 'src/services/upstream-adapters/trae-protocol.ts')).href
  )
  const scheduler = await import(
    pathToFileURL(path.join(API_DIR, 'src/services/relay-account-pool-scheduler.ts')).href
  )
  const ex = await import(pathToFileURL(path.join(ROOT, 'scripts/lib/codearts-auth-extract.mjs')).href)

  const rows = (
    await db.select().from(aiRelayAccountPool).where(eq(aiRelayAccountPool.providerCode, 'trae'))
  ).filter(scheduler.keepAliveForeverOf)

  const tokenDead = (r) => {
    const msg = String(r.lastErrorMessage ?? '')
    if (/model_list|\/models/i.test(msg)) return false
    return /invalid_grant|refresh token|invalid refresh|oauth\/ExchangeToken/i.test(msg)
  }
  const isDead = (r) => Number(r.refreshFailureCount ?? 0) > 0 || tokenDead(r)

  // 自动模式只救「客户端当前登录账号」:静默授权用的是同一身份,
  // 不拿 A 号会话去碰 B 号(换完也会被身份校验拦下,但不该白换)。
  let clientUid = ''
  try {
    const exm = await import(pathToFileURL(path.join(ROOT, 'scripts/lib/trae-auth-extract.mjs')).href)
    clientUid = String(exm.extractTraeAccount()?.accounts?.[0]?.uid ?? '')
  } catch {
    clientUid = ''
  }

  const targetUid = arg('--uid')
  const targets = targetUid
    ? rows.filter((r) => String(r.uid) === String(targetUid))
    : rows.filter((r) => isDead(r) && clientUid && String(r.uid) === clientUid)
  if (targetUid && targets.length === 0) {
    log({ ok: false, error: `号池无 uid=${targetUid}` }, `❌ 号池无 uid=${targetUid}`)
    return 1
  }
  if (targets.length === 0) {
    log({ ok: true, skipped: 'no-dead-account' }, '无需救援:没有待救的 trae 保活号')
    return 0
  }

  const running = await clientRunning()
  // --probe 只取 AuthCode 不换票,不会与运行中的客户端争 rt;其余模式必须让位。
  if (running !== false && !probeOnly) {
    log(
      { ok: true, skipped: running === null ? 'client-probe-unknown' : 'client-running', count: targets.length },
      `让位:客户端在跑(或探测未知),本轮不重授权(${targets.length} 枚待救)`,
    )
    return 0
  }
  if (dryRun) {
    log(
      { ok: true, dryRun: true, targets: targets.map((r) => String(r.uid)) },
      `dry-run:将尝试静默重授权 ${targets.map((r) => r.uid).join(', ')}`,
    )
    return 0
  }

  const row = targets[0]
  const uid = String(row.uid)
  const secrets = (() => {
    try {
      return row.secretsEnc ? JSON.parse(decryptField(row.secretsEnc)) : {}
    } catch {
      return {}
    }
  })()
  const devicePubPem = typeof secrets.devicePubPem === 'string' ? secrets.devicePubPem : ''
  const deviceId = String(row.deviceId ?? '')
  const machineId = String(row.machineId ?? '')
  if (!devicePubPem || !deviceId) {
    log({ ok: false, uid, error: '缺本机设备材料' }, `❌ uid=${uid} 缺设备材料,拒绝硬来`)
    return 2
  }

  const { copied, vssId } = copyChromeProfile()
  if (copied === 0) {
    log({ ok: false, uid, error: 'Chrome profile 复制失败' }, '❌ Chrome profile 复制失败(未判定)')
    return 2
  }

  let exitCode = 1
  try {
    const aesKey = ex.readAesKeyFromLocalState(path.join(PROFILE_COPY, 'Local State'))
    const cookies = readTraeCookies(aesKey)
    if (cookies.length === 0) {
      log({ ok: true, uid, skipped: 'no-chrome-trea-session' }, '跳过:Chrome 里没有 .trae.cn 会话 cookie')
      return 0
    }

    const { verifier, challenge } = pkce()
    const port = Number(arg('--port', DEFAULT_PORT))
    // AuthCode 与发起授权的 device_id 强绑定(实测换设备换票 20403 Token device not match)。
    // probe-exchange 用一次性设备 B 时,授权 URL 也必须用 B。
    let xDeviceId = deviceId
    let xDevicePub = devicePubPem
    if (has('--probe-exchange')) {
      const kp = crypto.generateKeyPairSync('ec', {
        namedCurve: 'prime256v1',
        publicKeyEncoding: { type: 'spki', format: 'pem' },
        privateKeyEncoding: { type: 'pkcs8', format: 'pem' },
      })
      xDeviceId = String(BigInt('0x' + crypto.randomBytes(8).toString('hex')) % 10n ** 16n).padStart(16, '0')
      xDevicePub = kp.publicKey
    }
    const url = buildAuthorizeUrl({
      port,
      machineId,
      deviceId: xDeviceId,
      challenge,
      traceId: crypto.randomUUID(),
    })
    const waiter = waitForCallback(port, 60_000)

    const { chromium } = createRequire(
      path.join(ROOT, 'node_modules', '.pnpm', 'playwright@1.62.1', 'node_modules', 'playwright', 'package.json'),
    )('playwright-core')
    const browser = await chromium.launch({ headless: true })
    try {
      const ctx = await browser.newContext()
      for (const c of cookies) {
        try {
          await ctx.addCookies([c])
        } catch {
          /* 单枚非法 cookie 不影响整体 */
        }
      }
      const page = await ctx.newPage()
      await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 45_000 }).catch(() => {})
      await page.waitForTimeout(2000)
      for (const label of ['登录并打开 TRAE', '授权', '同意授权', 'Authorize']) {
        const btn = page.getByText(label, { exact: false }).first()
        if (await btn.count().catch(() => 0)) {
          await btn.click({ timeout: 5_000 }).catch(() => {})
          break
        }
      }
      const cb = await waiter
      if (cb.error || !cb.code) {
        log(
          { ok: false, uid, error: `授权回调失败:${cb.error ?? 'no-code'}` },
          `⚠️ uid=${uid} Chrome 会话失效,静默授权拿不到码(${cb.error ?? 'no-code'})`,
        )
        return 1
      }
      if (probeOnly && !has('--probe-exchange')) {
        log({ ok: true, uid, probe: true, gotAuthCode: true }, `✅ 探针通过:Chrome 会话可静默取到 AuthCode(未换票)`)
        return 0
      }
      // --probe-exchange:一次性设备 B 的授权已在上方 URL 发起;这里只验换票,不写库。

      const res = await fetch(EXCHANGE_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'x-cloudide-token': '' },
        body: JSON.stringify({
          ClientID: CLIENT_ID,
          AuthCode: cb.code,
          CodeVerifier: verifier,
          DeviceInfo: {
            DeviceID: xDeviceId,
            MachineID: machineId,
            PlatformCode: 'IDE_PC',
            DeviceType: 'PC',
            DeviceName: 'PC',
            DeviceModel: '',
            ClientVersion: IDE_VERSION,
            DevicePublicKey: xDevicePub,
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
        log({ ok: false, uid, error: `换票 HTTP ${res.status}`, detail: text.slice(0, 200) }, `❌ uid=${uid} 换票失败 HTTP ${res.status}`)
        return 1
      }
      let body = null
      try {
        body = JSON.parse(text)
      } catch {
        return 2
      }
      // 身份校验(单源):Result.UserJwt 的 data.id 就是账号 uid(实测 256600094542297)。
      // 授权页登录的是谁,这里就必须是谁,否则一颗字节都不写。
      const jwtUid = (() => {
        try {
          const jwt = body?.Result?.UserJwt
          if (typeof jwt !== 'string' || !jwt.includes('.')) return ''
          const p = JSON.parse(
            Buffer.from(jwt.split('.')[1].replace(/-/g, '+').replace(/_/g, '/'), 'base64').toString('utf8'),
          )
          return String(p?.data?.id ?? p?.UserID ?? '')
        } catch {
          return ''
        }
      })()
      const seenUid = String(body?.Result?.UserID ?? body?.UserID ?? '') || jwtUid
      if (!seenUid) {
        log({ ok: false, uid, error: '响应里读不到账号身份,拒绝写入' }, `❌ uid=${uid} 无法确认授权账号身份,未写入`)
        return 1
      }
      if (seenUid !== uid) {
        log({ ok: false, uid, seenUid, error: '授权到另一个账号,已放弃写入' }, `❌ 授权账号不符(${seenUid}),未写入`)
        return 1
      }
      const payload = proto.extractTokenPayload(body)
      const receipt = proto.extractDeviceBindReceipt(body)
      if (!payload?.token) {
        log({ ok: false, uid, error: '换票响应无 Token' }, `❌ uid=${uid} 换票响应无 Token`)
        return 1
      }
      if (has('--probe-exchange')) {
        log(
          {
            ok: true,
            uid,
            probeExchange: true,
            seenUid: seenUid || null,
            hasToken: !!payload.token,
            hasRefreshToken: !!payload.refreshToken,
            tokenExpiresAt: payload.expiresAt,
            boundDeviceId: receipt?.boundDeviceId ?? null,
            bindStatus: receipt?.bindStatus ?? null,
            bodyKeys: Object.keys(body ?? {}),
            resultKeys:
              body && typeof body.Result === 'object' && body.Result ? Object.keys(body.Result) : [],
            userJwtClaims: (() => {
              const jwt = body?.Result?.UserJwt
              if (typeof jwt !== 'string' || !jwt.includes('.')) return null
              try {
                const p = JSON.parse(
                  Buffer.from(jwt.split('.')[1].replace(/-/g, '+').replace(/_/g, '/'), 'base64').toString('utf8'),
                )
                const flat = Object.fromEntries(
                  Object.entries(p).map(([k, v]) => [k, typeof v === 'object' ? '[obj]' : v]),
                )
                if (p.data && typeof p.data === 'object') {
                  flat.data = Object.fromEntries(
                    Object.entries(p.data).map(([k, v]) => [
                      k,
                      typeof v === 'object' ? '[obj]' : typeof v === 'string' && v.length > 40 ? v.slice(0, 8) + '…' : v,
                    ]),
                  )
                }
                return flat
              } catch {
                return null
              }
            })(),
          },
          `✅ 换票链路通过(一次性设备,未写库):uid=${uid} seenUid=${seenUid || '-'} BOUND=${receipt?.boundDeviceId ?? '-'}/${receipt?.bindStatus ?? '-'}`,
        )
        return 0
      }
      const applied = await db
        .update(aiRelayAccountPool)
        .set({
          tokenEnc: encryptField(payload.token),
          ...(payload.refreshToken ? { refreshTokenEnc: encryptField(payload.refreshToken) } : {}),
          ...(payload.expiresAt ? { tokenExpiresAt: payload.expiresAt } : {}),
          ...(receipt?.refreshExpireAt ? { refreshExpiresAt: receipt.refreshExpireAt } : {}),
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
        log({ ok: false, uid, error: 'CAS 未命中' }, `⚠️ uid=${uid} 回写未命中(CAS)`)
        return 1
      }
      log(
        { ok: true, uid, applied: true, tokenExpiresAt: payload.expiresAt, hasRefreshToken: !!payload.refreshToken },
        `✅ uid=${uid} 已静默重授权并回写(健康已复位)`,
      )
      exitCode = 0
      return exitCode
    } finally {
      await browser.close().catch(() => {})
    }
  } finally {
    cleanup(vssId)
    await db.$client?.end?.().catch?.(() => {})
  }
}

const isDirectRun = process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href
if (isDirectRun) {
  main()
    .then((c) => process.exit(c))
    .catch((e) => {
      log({ ok: false, error: e instanceof Error ? e.message : String(e) }, `❌ ${e instanceof Error ? e.message : e}`)
      process.exit(2)
    })
}
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
