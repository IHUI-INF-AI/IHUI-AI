#!/usr/bin/env node
/**
 * 微信支付 V3 平台证书拉取脚本
 *
 * 用途:从 WeChat /v3/certificates 拉取当前生效的平台证书,写入 cert/platform_cert.pem。
 * 平台证书用于验签微信支付回调(verifyCallbackSignature),生产环境必须配置。
 *
 * 用法:
 *   pnpm tsx scripts/fetch-wechat-platform-cert.mjs
 *   pnpm tsx scripts/fetch-wechat-platform-cert.mjs --out ./cert/platform_cert.pem
 *
 * 前置条件(.env.production 或 process.env):
 *   WX_API_BASE          默认 https://api.mch.weixin.qq.com
 *   WX_SHOP_ID           商户号(已配置: 1714645682)
 *   WX_PAY_V3_KEY        APIv3 密钥(从商户平台 API 安全页设置,32 字节字符串)
 *   WX_PAY_CERT_SERIAL   商户证书序列号(已配置: 5CA275DC7B338C42F622F20A7287A51C6DBCB345)
 *   WX_PAY_PRIVATE_KEY_PATH  商户私钥路径(已配置: ./cert/apiclient_key.pem)
 *
 * 输出:
 *   - cert/platform_cert.pem(默认路径)
 *   - cert/platform_cert.serial(序列号,便于 .env 配置)
 *
 * 错误码:
 *   401: 签名错误 → 检查 WX_PAY_CERT_SERIAL 与商户私钥是否匹配
 *   403: 无权限 → 检查 WX_SHOP_ID 与证书是否匹配
 *   400 invalid signature → WX_PAY_V3_KEY 不正确
 *
 * 备注:
 *   - 平台证书有效期约 5 年,过期前需重新运行
 *   - WeChat 同一时刻会发布多个证书(灰度切换),本脚本取生效中的(序列号最新)
 *   - 建议配合 cron 每日检测,失效前 30 天告警
 */

const log = (...args) => console.info(...args)
const err = (...args) => console.error(...args)

import { createSign, randomBytes } from 'node:crypto'
import { readFileSync, writeFileSync, mkdirSync, existsSync } from 'node:fs'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

const __dirname = dirname(fileURLToPath(import.meta.url))
const PROJECT_ROOT = resolve(__dirname, '..')

// ── 加载 .env.production(简单解析,避免拉 dotenv 依赖)────────────────
function loadEnvFile(filePath) {
  if (!existsSync(filePath)) return
  const content = readFileSync(filePath, 'utf-8')
  for (const line of content.split(/\r?\n/)) {
    const trimmed = line.trim()
    if (!trimmed || trimmed.startsWith('#')) continue
    const m = trimmed.match(/^([A-Z_][A-Z0-9_]*)=(.*)$/)
    if (!m) continue
    const [, key, value] = m
    // 跳过占位符 <...>
    if (value.startsWith('<') && value.endsWith('>')) continue
    if (process.env[key] === undefined) {
      process.env[key] = value
    }
  }
}

loadEnvFile(resolve(PROJECT_ROOT, '.env.production'))
loadEnvFile(resolve(PROJECT_ROOT, '.env'))

// ── 解析参数 ───────────────────────────────────────────────────────
const args = process.argv.slice(2)
let outPath = resolve(PROJECT_ROOT, 'cert/platform_cert.pem')
let serialPath = resolve(PROJECT_ROOT, 'cert/platform_cert.serial')
for (let i = 0; i < args.length; i++) {
  if (args[i] === '--out' && args[i + 1]) {
    outPath = resolve(args[i + 1])
    i++
  } else if (args[i] === '--serial' && args[i + 1]) {
    serialPath = resolve(args[i + 1])
    i++
  } else if (args[i] === '--help' || args[i] === '-h') {
    log('用法: pnpm tsx scripts/fetch-wechat-platform-cert.mjs [--out <path>] [--serial <path>]')
    process.exit(0)
  }
}

// ── 校验前置条件 ───────────────────────────────────────────────────
const required = {
  WX_API_BASE: process.env.WX_API_BASE ?? 'https://api.mch.weixin.qq.com',
  WX_SHOP_ID: process.env.WX_SHOP_ID,
  WX_PAY_V3_KEY: process.env.WX_PAY_V3_KEY,
  WX_PAY_CERT_SERIAL: process.env.WX_PAY_CERT_SERIAL,
  WX_PAY_PRIVATE_KEY_PATH: process.env.WX_PAY_PRIVATE_KEY_PATH,
}
const missing = Object.entries(required)
  .filter(([, v]) => !v)
  .filter(([k]) => k !== 'WX_API_BASE') // WX_API_BASE 有默认值
  .map(([k]) => k)
if (missing.length > 0) {
  err(`❌ 缺少必填环境变量: ${missing.join(', ')}`)
  err('   请在 .env.production 中设置,或从微信商户平台获取。')
  err('   V3 密钥(APIv3 Key): 商户平台 → API 安全 → APIv3 密钥 → 设置')
  process.exit(1)
}

if (required.WX_PAY_V3_KEY.startsWith('<') && required.WX_PAY_V3_KEY.endsWith('>')) {
  err('❌ WX_PAY_V3_KEY 仍是占位符,需要填写真实值(从商户平台 API 安全 → APIv3 密钥 获取)')
  process.exit(1)
}

if (Buffer.byteLength(required.WX_PAY_V3_KEY, 'utf-8') !== 32) {
  err(`❌ WX_PAY_V3_KEY 长度应为 32 字节,当前 ${Buffer.byteLength(required.WX_PAY_V3_KEY, 'utf-8')} 字节`)
  process.exit(1)
}

if (!existsSync(required.WX_PAY_PRIVATE_KEY_PATH)) {
  err(`❌ 商户私钥文件不存在: ${required.WX_PAY_PRIVATE_KEY_PATH}`)
  process.exit(1)
}

const privateKey = readFileSync(required.WX_PAY_PRIVATE_KEY_PATH, 'utf-8')
const apiBase = required.WX_API_BASE

// ── 构造 V3 Authorization 头 ──────────────────────────────────────
function buildAuthorization(method, url, body) {
  const mchid = required.WX_SHOP_ID
  const serial = required.WX_PAY_CERT_SERIAL
  const timestamp = Math.floor(Date.now() / 1000).toString()
  const nonce = randomBytes(16).toString('hex')
  const signStr = `${method}\n${url}\n${timestamp}\n${nonce}\n${body}\n`
  const sign = createSign('RSA-SHA256')
  sign.update(signStr, 'utf-8')
  const signature = sign.sign(privateKey, 'base64')
  return `WECHATPAY2-SHA256-RSA2048 mchid="${mchid}",nonce_str="${nonce}",timestamp="${timestamp}",serial_no="${serial}",signature="${signature}"`
}

// ── 主流程:拉取平台证书列表 ────────────────────────────────────────
async function main() {
  const url = '/v3/certificates'
  const body = '' // GET 无 body
  const auth = buildAuthorization('GET', url, body)

  log(`▶ 拉取平台证书: ${apiBase}${url}`)
  const resp = await fetch(`${apiBase}${url}`, {
    method: 'GET',
    headers: {
      Authorization: auth,
      'User-Agent': 'IHUI-AI/1.0 fetch-wechat-platform-cert',
    },
  })

  if (!resp.ok) {
    const errText = await resp.text()
    err(`❌ HTTP ${resp.status} ${resp.statusText}`)
    err('   响应:', errText.slice(0, 500))
    if (resp.status === 401) {
      err('   → 签名错误,请检查 WX_PAY_CERT_SERIAL 与商户私钥是否匹配')
    } else if (resp.status === 403) {
      err('   → 无权限,请检查 WX_SHOP_ID 与证书是否属于同一商户')
    } else if (resp.status === 400 && errText.includes('invalid signature')) {
      err('   → WX_PAY_V3_KEY 不正确或已被重置')
    }
    process.exit(1)
  }

  const data = await resp.json()
  if (!data.data || !Array.isArray(data.data) || data.data.length === 0) {
    err('❌ 响应格式异常,data 字段为空')
    err(JSON.stringify(data).slice(0, 500))
    process.exit(1)
  }

  const certs = data.data
    .filter((c) => c.encrypt_certificate && c.encrypt_certificate.ciphertext)
    .map((c) => ({
      serial: c.serial_no,
      effectiveTime: c.effective_time,
      expireTime: c.expire_time,
      ciphertext: c.encrypt_certificate.ciphertext,
      nonce: c.encrypt_certificate.nonce,
      associatedData: c.encrypt_certificate.associated_data,
    }))
    .sort((a, b) => (b.effectiveTime ?? '').localeCompare(a.effectiveTime ?? ''))

  if (certs.length === 0) {
    err('❌ 响应中未找到有效证书(encrypt_certificate)')
    process.exit(1)
  }

  const target = certs[0]
  log(`▶ 找到 ${certs.length} 张证书,选用序列号 ${target.serial}`)
  log(`  生效时间: ${target.effectiveTime}`)
  log(`  失效时间: ${target.expireTime}`)

  // ── AES-256-GCM 解密(微信用 V3 KEY 加密证书密文)────────────────
  const v3Key = Buffer.from(required.WX_PAY_V3_KEY, 'utf-8')
  const ct = Buffer.from(target.ciphertext, 'base64')
  const authTag = ct.subarray(-16)
  const cipherText = ct.subarray(0, -16)
  const decipher = await import('node:crypto').then((m) => m.createDecipheriv('aes-256-gcm', v3Key, Buffer.from(target.nonce, 'utf-8')))
  decipher.setAAD(Buffer.from(target.associatedData, 'utf-8'))
  decipher.setAuthTag(authTag)
  const plain = Buffer.concat([decipher.update(cipherText), decipher.final()])
  const certPem = plain.toString('utf-8')

  // ── 写入文件 ──────────────────────────────────────────────────
  const outDir = dirname(outPath)
  if (!existsSync(outDir)) mkdirSync(outDir, { recursive: true })
  writeFileSync(outPath, certPem, 'utf-8')
  writeFileSync(serialPath, target.serial, 'utf-8')
  log(`✅ 已写入 ${outPath}`)
  log(`✅ 已写入 ${serialPath} (序列号)`)
  log('')
  log('▶ 后续步骤:')
  log('  1. 确认 .env.production 中 WX_PAY_PLATFORM_CERT_PATH 已指向该文件')
  log('  2. 重启 API: pnpm --filter @ihui/api start')
  log('  3. 验证: curl http://localhost:3001/api/health/ready | jq .checks.wechatPay')
  log('     期望输出: { "status": "ok" }')
}

main().catch((e) => {
  err('❌ 未捕获异常:', e)
  process.exit(1)
})
