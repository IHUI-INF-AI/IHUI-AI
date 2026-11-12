// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
/**
 * Trae 号池·授权码重绑(2026-11-12 立)。
 *
 * 解决的那一格:号池里有的号是**裸票导入**(只有 token + refreshToken,secretsEnc 为空),
 * 它的 rt 由**另一台设备**的客户端签发 ⇒ 本机设备身份换不出票(20403 / 10101),
 * 写回客户端后必然当场登出。重新登录一次的常规做法要人扫码/收短信,机主 2026-11-12 明确否决
 * 「还要我扫码那开发这功能干嘛」——所以走客户端自己的授权码通道,把 rt 重新绑到**本机设备身份**。
 *
 * 协议来源(逐字对着客户端 `resources/app/out/main.js` 的 `buildLoginUrl` / `exchangeTokenByAuthCode`)。
 * ① `oauth.ts` 的 `uFe()`:codeVerifier = 48 字节 base64url;codeChallenge = sha256 的 base64url
 * ② 授权页:`${loginHost}/authorization?login_version=1&auth_from=trae&login_channel=native_ide
 *    &auth_type=local&client_id=${CLIENT_ID}&redirect=0&login_trace_id=${uuid}
 *    &auth_callback_url=http://127.0.0.1:${port}/authorize&machine_id=${machineId}
 *    &device_id=${deviceId}&${query({..S256 及 x_device_* 头})}`
 * ③ 回调拿到 AuthCode → `POST /trae/api/v3/oauth/ExchangeToken`
 *    体 = { ClientID, AuthCode, CodeVerifier, DeviceInfo, IDEVersion }(**不带 DeviceProof**,
 *    这正是"换一个新绑定"与"续旧票"的区别;DeviceInfo 用本机真实设备材料)
 * ④ 2xx ⇒ 该号已绑到本机设备,新 rt 立即可用。回写号池(CAS),并把设备材料落进 secretsEnc。
 *
 * 用法:
 *   node scripts/trae-rebind-by-authorize.mjs --list
 *   node scripts/trae-rebind-by-authorize.mjs --uid <uid> [--port 47832] [--no-open] [--dry-run]
 *   node scripts/trae-rebind-by-authorize.mjs --all-bare [--port 47832]
 * `--no-open` 只打印授权 URL,由调用方自己开(默认直接用系统默认浏览器打开)。
 * 退出码:0 成功 / 1 业务失败 / 2 未判定。
 */
import fs from 'node:fs'
import http from 'node:http'
import path from 'node:path'
import crypto from 'node:crypto'
import { spawn } from 'node:child_process'
import { createRequire } from 'node:module'
import { fileURLToPath, pathToFileURL } from 'node:url'

const HERE = path.dirname(fileURLToPath(import.meta.url))
const ROOT = path.resolve(HERE, '..')
const API_DIR = path.join(ROOT, 'apps', 'api')

const CLIENT_ID = 'ono9krqynydwx5'
const LOGIN_HOST = 'https://www.trae.cn'
const EXCHANGE_URL = 'https://api.trae.cn/trae/api/v3/oauth/ExchangeToken'
const IDE_VERSION = '1.107.1'
const DEFAULT_PORT = 47832

function arg(argv, name, def = null) {
  const i = argv.indexOf(name)
  return i >= 0 && argv[i + 1] && !argv[i + 1].startsWith('--') ? argv[i + 1] : def
}
const has = (argv, name) => argv.includes(name)

/** PKCE(与客户端 uFe() 同构) */
function pkce() {
  const verifier = crypto.randomBytes(48).toString('base64url')
  const challenge = crypto.createHash('sha256').update(verifier).digest('base64url')
  return { verifier, challenge }
}

const qs = (o) => new URLSearchParams(o).toString()

/**
 * 构造授权 URL(客户端 buildLoginUrl 的同款字段)。
 * `devicePublicKey` 是登录页要登记的公钥 —— 客户端走 auth_code 通道时 DeviceInfo 不带它,
 * 但授权页会拿 `x_device_id` 记一次设备尝试,绑定发生在后面的 ExchangeToken。
 */
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

/** 本地回调服务:解析 /authorize?authCodeInfo=...&codeVerifier=... (字段名取自客户端登录回调口) */
function waitForCallback(port, timeoutMs = 300000) {
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
      } catch {
        code = ''
      }
      if (!code) code = url.searchParams.get('code') ?? ''
      res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' })
      res.end('<h2>已收到授权,回到终端继续</h2><p>本页可以关闭。</p>')
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

function openBrowser(url) {
  // 只用默认浏览器打开(不指定 Edge;系统默认是什么就是什么)
  spawn('cmd', ['/c', 'start', '', url], { detached: true, stdio: 'ignore', windowsHide: true }).unref()
}

async function main(argv) {
  if (argv.length === 0 || has(argv, '--help')) {
    process.stdout.write(
      '用法: node scripts/trae-rebind-by-authorize.mjs --list\n' +
        '      node scripts/trae-rebind-by-authorize.mjs --uid <uid> [--port 47832] [--no-open] [--dry-run]\n' +
        '      node scripts/trae-rebind-by-authorize.mjs --all-bare\n' +
        '  --list      列出所有裸票号(secretsEnc 为空 = 无本机设备材料)\n' +
        '  --uid       指定要重绑的号\n' +
        '  --all-bare  逐个重绑所有裸票号(每号都会开一次授权页)\n' +
        '  --no-open   只打印授权 URL,不自动打开浏览器\n' +
        '  --dry-run   只打印将要做的事\n',
    )
    return argv.length === 0 ? 2 : 0
  }

  const port = Number(arg(argv, '--port', DEFAULT_PORT))
  const dryRun = has(argv, '--dry-run')
  const noOpen = has(argv, '--no-open')

  process.env.NODE_TLS_REJECT_UNAUTHORIZED = process.env.NODE_TLS_REJECT_UNAUTHORIZED ?? '0'

  // .env 必须在 import @ihui/database / src/db 之前进环境(那两个模块在导入期读 env 并做 schema 校验)
  try {
    const requireEnv = createRequire(path.join(API_DIR, 'package.json'))
    const dotenv = await import(pathToFileURL(requireEnv.resolve('dotenv')).href)
    dotenv.config({ path: path.join(API_DIR, '.env') })
  } catch (e) {
    process.stderr.write(`⚠️ .env 加载失败:${e.message}\n`)
  }

  // 依赖从 apps/api 解析(本仓 pnpm 隔离布局:drizzle-orm / @ihui/database 只装在 apps/api 下)。
  // `@ihui/database` 是 TS 源码 ⇒ 本脚本必须以 tsx 运行(resolveTsx 找不到时给出明确出路)。
  const requireApi = createRequire(path.join(API_DIR, 'package.json'))
  const resolveApi = (spec) => {
    const hit = requireApi.resolve(spec)
    return pathToFileURL(hit).href
  }
  let drizzle, database
  try {
    drizzle = await import(resolveApi('drizzle-orm'))
    database = await import(resolveApi('@ihui/database'))
  } catch (e) {
    process.stderr.write(
      `❌ 依赖解析失败(未判定):${e.message}\n` +
        '   @ihui/database 是 TS 源码 ⇒ 用 tsx 跑:\n' +
        '   node apps/api/node_modules/tsx/dist/cli.mjs scripts/trae-rebind-by-authorize.mjs --list\n',
    )
    return 2
  }
  const { eq } = drizzle
  const { aiRelayAccountPool } = database
  const { decryptField, encryptField } = await import(
    pathToFileURL(path.join(API_DIR, 'src/utils/crypto.js')).href
  )
  const { db } = await import(pathToFileURL(path.join(API_DIR, 'src/db/index.js')).href)
  const ex = await import(pathToFileURL(path.join(HERE, 'lib/trae-auth-extract.mjs')).href)
  const sw = await import(pathToFileURL(path.join(HERE, 'lib/trae-client-switch.mjs')).href)

  // 本机真实设备材料:icube-dc 密钥对(storage.json) + aha device_id / machineId
  const store = JSON.parse(fs.readFileSync(sw.findStorageFile(), 'utf8'))
  const dev = ex.extractDeviceMaterial(store)
  if (!dev) {
    process.stderr.write('❌ 读不到本机设备密钥对(storage.json 的 icube-dc)⇒ 未判定\n')
    return 2
  }
  const machineId =
    dev.machineId ||
    (typeof store['telemetry.machineId'] === 'string' ? store['telemetry.machineId'] : '')
  let deviceId = dev.deviceId
  // aha 原生 device_id 与本机 icube-dc 的 deviceId 实测同值;取 aha 那份以防分叉
  try {
    const tiny = JSON.parse(
      fs.readFileSync(path.join(process.env.APPDATA, 'Trae CN', 'aha', 'TinyStorage'), 'utf8'),
    )
    const info = JSON.parse(ex.decryptEnvelope(tiny.tiny_storage_data['aha.device.device_id']))
    if (info?.device_id_str) deviceId = info.device_id_str
  } catch {}

  const rows = await db
    .select()
    .from(aiRelayAccountPool)
    .where(eq(aiRelayAccountPool.providerCode, 'trae'))

  const secretsOf = (r) => {
    try {
      return r.secretsEnc ? JSON.parse(decryptField(r.secretsEnc)) : null
    } catch {
      return null
    }
  }
  const isBare = (r) => {
    const s = secretsOf(r)
    return !(typeof s?.deviceKeyPem === 'string' && s.deviceKeyPem && typeof s?.devicePubPem === 'string')
  }

  if (has(argv, '--list')) {
    console.log(`本机设备:deviceId=${deviceId} machineId=${machineId.slice(0, 12)}…`)
    console.log('号池 trae 各号(裸票 = 无本机设备材料,必须重绑):')
    for (const r of rows) {
      console.log(
        `  uid=${String(r.uid).padEnd(17)} ${String(r.name).padEnd(13)} ${isBare(r) ? '裸票 ⚠' : '有设备材料 ✓'}`,
      )
    }
    await db.$client?.end?.()
    return 0
  }

  const targets = []
  if (has(argv, '--all-bare')) {
    for (const r of rows) if (isBare(r)) targets.push(r)
  } else {
    const uid = arg(argv, '--uid')
    if (!uid) {
      process.stderr.write('❌ 需要 --uid <uid> 或 --all-bare 或 --list\n')
      return 2
    }
    const r = rows.find((x) => String(x.uid) === String(uid))
    if (!r) {
      process.stderr.write(`❌ 号池里没有 uid=${uid}\n`)
      return 1
    }
    targets.push(r)
  }

  if (targets.length === 0) {
    console.log('没有需要重绑的号(全部已有本机设备材料)')
    await db.$client?.end?.()
    return 0
  }

  let okCount = 0
  for (const r of targets) {
    const uid = String(r.uid)
    console.log(`\n═══ 重绑 uid=${uid} ${r.name} ═══`)
    const { verifier, challenge } = pkce()
    const traceId = crypto.randomUUID()
    const url = buildAuthorizeUrl({ port, machineId, deviceId, challenge, traceId })
    console.log('授权 URL(浏览器里若该账号还有会话,会直接回调,无需扫码):')
    console.log('  ' + url)

    if (dryRun) {
      console.log('(dry-run,不发起)')
      continue
    }

    const waiter = waitForCallback(port)
    if (!noOpen) openBrowser(url)
    else console.log('请手动在浏览器打开上面的 URL…')

    const cb = await waiter
    if (cb.error) {
      console.error(`❌ 回调失败:${cb.error}`)
      continue
    }
    if (!cb.code) {
      console.error(`❌ 回调里没有 AuthCode(响应:${String(cb.raw).slice(0, 200)})`)
      continue
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
          MachineID: machineId,
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
      continue
    }
    let payload = null
    let receipt = null
    try {
      const j = JSON.parse(text)
      payload = null
      // 复用协议层的宽松提取
      const proto = await import(
        pathToFileURL(path.join(API_DIR, 'src/services/upstream-adapters/trae-protocol.ts')).href
      )
      payload = proto.extractTokenPayload(j)
      receipt = proto.extractDeviceBindReceipt(j)
    } catch {}
    if (!payload?.token) {
      console.error(`❌ 换票响应无 Token:${text.slice(0, 200)}`)
      continue
    }
    console.log(`✅ 换出新票,BOUND=${receipt?.boundDeviceId ?? '-'} status=${receipt?.bindStatus ?? '-'}`)

    if (dryRun) continue

    // 回写:新票 + 设备材料落进 secretsEnc(以后这枚号在本机就是"有设备材料"的正常号)
    const prev = secretsOf(r) ?? {}
    const nextSecrets = {
      ...prev,
      deviceKeyPem: dev.privateKeyPem,
      devicePubPem: dev.publicKeyPem,
    }
    const applied = await db
      .update(aiRelayAccountPool)
      .set({
        tokenEnc: encryptField(payload.token),
        ...(payload.refreshToken ? { refreshTokenEnc: encryptField(payload.refreshToken) } : {}),
        ...(payload.expiresAt ? { tokenExpiresAt: payload.expiresAt } : {}),
        secretsEnc: encryptField(JSON.stringify(nextSecrets)),
        deviceId,
        machineId,
        lastRefreshAt: new Date(),
        updatedAt: new Date(),
      })
      .where(eq(aiRelayAccountPool.id, r.id))
      .returning({ id: aiRelayAccountPool.id })
    if (applied.length === 0) {
      console.error('⚠️ 回写未命中(CAS),新票可能蒸发 —— 请立刻重跑本命令')
      continue
    }
    console.log('✅ 已回写号池:新票 + 本机设备材料(今后该号在本机可直接换票)')
    okCount += 1
  }

  await db.$client?.end?.()
  console.log(`\n完成:成功重绑 ${okCount}/${targets.length} 枚`)
  return okCount === targets.length ? 0 : 1
}

main(process.argv.slice(2))
  .then((c) => process.exit(c))
  .catch((e) => {
    process.stderr.write(`❌ ${e instanceof Error ? e.message : String(e)}\n`)
    process.exit(2)
  })
