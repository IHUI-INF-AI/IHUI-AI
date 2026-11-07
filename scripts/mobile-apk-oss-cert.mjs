// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * apk.aizhs.top 证书的体检与续签(OSS 自定义域名 HTTPS)。
 *
 * 背景:
 *   · 快腿 `https://apk.aizhs.top` 是 CNAME 直连 `ai-zhs-server.oss-cn-beijing.aliyuncs.com`,
 *     证书必须**上传到 OSS 的自定义域名绑定**上(OSS 不会自动签);
 *   · 证书是 Let's Encrypt 90 天 DV,靠 Cloudflare DNS-01 验证 —— 本机有 Cloudflare Global API Key。
 *
 * 用法:
 *   node scripts/mobile-apk-oss-cert.mjs --check   # 体检;剩余 <--min-days(默认 21)天 exit=3,足够 exit=0
 *   node scripts/mobile-apk-oss-cert.mjs --renew   # 续签 + 绑定到 OSS + 回读校验
 *   两者都可加 --json。
 *
 * 凭据: 与 publish-mobile-apk-oss.mjs 同一份 `%USERPROFILE%\.ihui\oss-credentials.json`
 *       (cloudflare.email / globalApiKey / zoneId / edgeIp)。acme-client 首次用时自动装到 ~/.ihui。
 */

import crypto from 'node:crypto'
import fs from 'node:fs'
import https from 'node:https'
import module from 'node:module'
import os from 'node:os'
import path from 'node:path'
import tls from 'node:tls'
import { pathToFileURL } from 'node:url'
import { execFileSync } from 'node:child_process'

const HOME = os.homedir()
const IHUI_HOME = path.join(HOME, '.ihui')
const CRED_FILE = process.env.IHUI_OSS_CRED_FILE || path.join(IHUI_HOME, 'oss-credentials.json')
const CERT_DIR = path.join(IHUI_HOME, 'certs')
const DOMAIN = process.env.IHUI_OSS_DOMAIN || 'apk.aizhs.top'

function parseArgs(argv) {
  const out = {}
  for (let i = 0; i < argv.length; i += 1) {
    const a = argv[i]
    if (!a.startsWith('--')) continue
    const name = a.slice(2)
    const next = argv[i + 1]
    if (next && !next.startsWith('--')) {
      out[name] = next
      i += 1
    } else out[name] = true
  }
  return out
}

function readCreds() {
  if (!fs.existsSync(CRED_FILE)) throw new Error(`缺凭据文件: ${CRED_FILE}`)
  const cfg = JSON.parse(fs.readFileSync(CRED_FILE, 'utf8'))
  const oss = cfg.oss || {}
  const cf = cfg.cloudflare || {}
  const merged = {
    bucket: process.env.IHUI_OSS_BUCKET || oss.bucket || 'ai-zhs-server',
    ossAk: process.env.IHUI_OSS_ACCESS_KEY_ID || oss.accessKeyId,
    ossSk: process.env.IHUI_OSS_ACCESS_KEY_SECRET || oss.accessKeySecret,
    cfEmail: process.env.IHUI_CF_EMAIL || cf.email,
    cfKey: process.env.IHUI_CF_GLOBAL_API_KEY || cf.globalApiKey,
    cfZone: process.env.IHUI_CF_ZONE_ID || cf.zoneId,
    cfEdge: cf.edgeIp || '104.26.0.1',
  }
  for (const [k, v] of Object.entries(merged)) if (!v) throw new Error(`凭据缺字段: ${k} (${CRED_FILE})`)
  return merged
}

// ---- TLS 体检 ---------------------------------------------------------------------
export function certInfo(host) {
  return new Promise((resolve, reject) => {
    const socket = tls.connect({ host, port: 443, servername: host, family: 4 }, () => {
      const c = socket.getPeerCertificate()
      socket.end()
      if (!c || !c.valid_to) return reject(new Error('未取到证书'))
      const notAfter = new Date(c.valid_to)
      resolve({
        subject: c.subject?.CN || '',
        issuer: String(c.issuer?.O || c.issuer?.CN || ''),
        notAfterUtc: notAfter.toISOString(),
        daysLeft: Math.floor((notAfter.getTime() - Date.now()) / 86400000),
        serialNumber: c.serialNumber,
        authorized: socket.authorized,
      })
    })
    socket.on('error', reject)
    socket.setTimeout(15000, () => socket.destroy(new Error('TLS 连接超时')))
  })
}

// ---- Cloudflare DNS-01 ------------------------------------------------------------
function cfRequest(cfg, method, apiPath, body) {
  const payload = body ? JSON.stringify(body) : null
  return new Promise((resolve, reject) => {
    const req = https.request(
      {
        method,
        host: cfg.cfEdge,
        servername: 'api.cloudflare.com',
        path: `/client/v4${apiPath}`,
        timeout: 30000,
        headers: {
          Host: 'api.cloudflare.com',
          'X-Auth-Email': cfg.cfEmail,
          'X-Auth-Key': cfg.cfKey,
          'Content-Type': 'application/json',
          ...(payload ? { 'Content-Length': Buffer.byteLength(payload) } : {}),
        },
      },
      (res) => {
        let text = ''
        res.on('data', (c) => (text += c))
        res.on('end', () => {
          let json = null
          try { json = JSON.parse(text) } catch { /* 非 JSON 走 raw */ }
          resolve({ status: res.statusCode, json, raw: text })
        })
      }
    )
    req.on('error', reject)
    req.on('timeout', () => req.destroy(new Error('Cloudflare API 超时')))
    req.end(payload || undefined)
  })
}

// ---- OSS 自定义域名证书绑定 -------------------------------------------------------
function ossSign(ak, sk, method, resource, contentType) {
  const date = new Date().toUTCString()
  const sig = crypto.createHmac('sha1', sk).update(`${method}\n\n${contentType || ''}\n${date}\n${resource}`).digest('base64')
  return { date, auth: `OSS ${ak}:${sig}` }
}

function bindCert(cfg, crt, key) {
  const host = `${cfg.bucket}.oss-cn-beijing.aliyuncs.com`
  const xml =
    `<?xml version="1.0" encoding="UTF-8"?><BucketCnameConfiguration><Cname><Domain>${DOMAIN}</Domain>` +
    `<CertificateConfiguration><Certificate><![CDATA[${crt}]]></Certificate>` +
    `<PrivateKey><![CDATA[${key}]]></PrivateKey><Force>true</Force></CertificateConfiguration></Cname></BucketCnameConfiguration>`
  const { date, auth } = ossSign(cfg.ossAk, cfg.ossSk, 'POST', `/${cfg.bucket}/?cname&comp=add`, 'application/xml')
  return new Promise((resolve, reject) => {
    const req = https.request(
      {
        method: 'POST',
        host,
        path: '/?cname&comp=add',
        timeout: 60000,
        headers: { Date: date, Authorization: auth, 'Content-Type': 'application/xml', 'Content-Length': Buffer.byteLength(xml) },
      },
      (res) => {
        let text = ''
        res.on('data', (c) => (text += c))
        res.on('end', () => resolve({ status: res.statusCode, body: text }))
      }
    )
    req.on('error', reject)
    req.on('timeout', () => req.destroy(new Error('OSS 绑定证书超时')))
    req.end(xml)
  })
}

// ---- Let's Encrypt ----------------------------------------------------------------
function loadAcme() {
  const req = module.createRequire(path.join(IHUI_HOME, 'noop.js'))
  try {
    return req('acme-client')
  } catch {
    fs.mkdirSync(IHUI_HOME, { recursive: true })
    console.log('[cert] 首次续签: 安装 acme-client 到 ~/.ihui ...')
    execFileSync(process.platform === 'win32' ? 'npm.cmd' : 'npm', [
      'install', 'acme-client', '--prefix', IHUI_HOME, '--no-audit', '--no-fund', '--loglevel=error',
      '--registry=https://registry.npmmirror.com',
    ], { stdio: 'inherit', shell: process.platform === 'win32' })
    return module.createRequire(path.join(IHUI_HOME, 'noop.js'))('acme-client')
  }
}

async function issue(cfg) {
  const acme = loadAcme()
  fs.mkdirSync(CERT_DIR, { recursive: true })
  const accountKeyPath = path.join(CERT_DIR, 'account.key')
  const accountKey = fs.existsSync(accountKeyPath)
    ? fs.readFileSync(accountKeyPath)
    : await acme.crypto.createPrivateKey()
  fs.writeFileSync(accountKeyPath, accountKey)
  const client = new acme.Client({ directoryUrl: acme.directory.letsencrypt.production, accountKey })
  const [key, csr] = await acme.crypto.createCsr({ commonName: DOMAIN })
  const created = []

  const cert = await client.auto({
    csr,
    email: cfg.cfEmail,
    termsOfServiceAgreed: true,
    challengePriority: ['dns-01'],
    skipChallengeVerification: true,
    challengeCreateFn: async (authz, challenge, keyAuthorization) => {
      const name = `_acme-challenge.${authz.identifier.value}`
      const r = await cfRequest(cfg, 'POST', `/zones/${cfg.cfZone}/dns_records`, {
        type: 'TXT', name, content: keyAuthorization, ttl: 60, comment: 'acme dns-01 (mobile-apk-oss-cert)',
      })
      if (!r.json?.success) throw new Error(`Cloudflare TXT 写入失败: ${r.raw.slice(0, 300)}`)
      created.push(r.json.result.id)
      await new Promise((s) => setTimeout(s, 20000))
    },
    challengeRemoveFn: async () => {
      for (const id of created.splice(0)) await cfRequest(cfg, 'DELETE', `/zones/${cfg.cfZone}/dns_records/${id}`)
    },
  })
  fs.writeFileSync(path.join(CERT_DIR, `${DOMAIN}.key`), key)
  fs.writeFileSync(path.join(CERT_DIR, `${DOMAIN}.crt`), cert)
  return { crt: String(cert).trim(), key: String(key).trim() }
}

// ---- CLI -------------------------------------------------------------------------
async function main() {
  const args = parseArgs(process.argv.slice(2))
  const json = !!args.json
  const cfg = readCreds()

  if (args.renew) {
    console.log(`[cert] 续签 ${DOMAIN} ...`)
    const { crt, key } = await issue(cfg)
    const bind = await bindCert(cfg, crt, key)
    if (bind.status !== 200) throw new Error(`OSS 绑定证书失败: ${bind.status} ${bind.body.slice(0, 300)}`)
    await new Promise((s) => setTimeout(s, 5000))
    const info = await certInfo(DOMAIN)
    if (info.daysLeft < 30) throw new Error(`续签后证书仍只有 ${info.daysLeft} 天 —— 绑定未生效`)
    if (json) console.log(JSON.stringify({ ok: true, action: 'renew', ...info }))
    else console.log(`[cert] 续签成功: 到期 ${info.notAfterUtc} (${info.daysLeft} 天)`)
    return
  }

  const minDays = Number(args['min-days'] || 21)
  const info = await certInfo(DOMAIN)
  const needRenew = info.daysLeft < minDays
  if (json) console.log(JSON.stringify({ ok: !needRenew, action: 'check', needRenew, minDays, ...info }))
  else console.log(`[cert] ${DOMAIN} 到期 ${info.notAfterUtc} 剩 ${info.daysLeft} 天 (阈值 ${minDays}) -> ${needRenew ? '需续签' : '健康'}`)
  if (needRenew) process.exit(3)
}

const isDirectRun = process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href
if (isDirectRun) {
  main()
    .then((code) => process.exit(typeof code === 'number' ? code : 0))
    .catch((e) => {
      if (process.argv.includes('--json')) console.log(JSON.stringify({ ok: false, error: e?.message ?? String(e) }))
      else console.error(`[cert] FAIL ${e?.message ?? e}`)
      process.exit(1)
    })
}
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
