// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * 把 APK 发到阿里云 OSS 的"快腿"(`https://apk.aizhs.top`, CNAME 直连 oss-cn-beijing)。
 *
 * 为什么需要这条腿(2026-11-06 实测):
 *   · 站点腿(EdgeOne, www.aizhs.top) 单流 286 KB/s、12 路并发封顶 3.87 MB/s —— 跑不满用户线路(7.77 MB/s);
 *   · Gitee 单流 2.14 MB/s 且忽略 Range(不能多线程);
 *   · OSS 北京直连同一台机器实测 38–48 MB/s(冷)、55–87 MB/s(热),是唯一能跑满的腿。
 *
 * 两个硬约束(踩过,别再踩):
 *   1. 该 bucket 禁止公共读(对象级 public-read 与 bucket policy 都被拒绝),所以对外只能是**签名直链**;
 *   2. OSS 默认公网 endpoint 不分发 .apk(`ApkDownloadForbidden`),必须走已绑定的 CNAME 自定义域名。
 *
 * 凭据只从环境变量或 `%USERPROFILE%\.ihui\oss-credentials.json` 读,绝不入库。
 *
 * 用法:
 *   node scripts/publish-mobile-apk-oss.mjs --apk <path> --version 0.0.18 --version-code 26110608
 *   node scripts/publish-mobile-apk-oss.mjs ... --json      # 只输出一行 JSON,供发布脚本解析
 *
 * 退出码: 0=已发布(含"对象已存在且字节一致"的幂等命中); 1=失败(调用方应回退到站点腿,不许当成发布成功)。
 */

import crypto from 'node:crypto'
import dns from 'node:dns'
import fs from 'node:fs'
import https from 'node:https'
import os from 'node:os'
import path from 'node:path'
import { pathToFileURL } from 'node:url'

const HOME = os.homedir()
const CRED_FILE = process.env.IHUI_OSS_CRED_FILE || path.join(HOME, '.ihui', 'oss-credentials.json')

function readCreds() {
  let fileCfg = {}
  try {
    if (fs.existsSync(CRED_FILE)) fileCfg = JSON.parse(fs.readFileSync(CRED_FILE, 'utf8'))
  } catch (e) {
    throw new Error(`凭据文件解析失败: ${CRED_FILE} (${e.message})`)
  }
  const raw = fileCfg.oss || fileCfg
  const cfg = {
    accessKeyId: process.env.IHUI_OSS_ACCESS_KEY_ID || raw.accessKeyId,
    accessKeySecret: process.env.IHUI_OSS_ACCESS_KEY_SECRET || raw.accessKeySecret,
    bucket: process.env.IHUI_OSS_BUCKET || raw.bucket || 'ai-zhs-server',
    region: process.env.IHUI_OSS_REGION || raw.region || 'oss-cn-beijing',
    domain: process.env.IHUI_OSS_DOMAIN || raw.domain || 'apk.aizhs.top',
  }
  if (!cfg.accessKeyId || !cfg.accessKeySecret) {
    throw new Error(
      `缺 OSS 凭据: 设 IHUI_OSS_ACCESS_KEY_ID/IHUI_OSS_ACCESS_KEY_SECRET,或写 ${CRED_FILE}`
    )
  }
  return cfg
}

function ossRequest(cfg, method, key, { headers = {}, body = null, timeoutMs = 180000 } = {}) {
  const host = `${cfg.bucket}.${cfg.region}.aliyuncs.com`
  const date = new Date().toUTCString()
  const contentType = headers['content-type'] || ''
  const ossHeaders = Object.keys(headers)
    .filter((h) => h.toLowerCase().startsWith('x-oss-'))
    .map((h) => h.toLowerCase())
    .sort()
  const canonHeaders = ossHeaders.map((h) => `${h}:${headers[h] ?? headers[h.toUpperCase()] ?? ''}\n`).join('')
  const resource = `/${cfg.bucket}/${key}`
  const sig = crypto
    .createHmac('sha1', cfg.accessKeySecret)
    .update(`${method}\n\n${contentType}\n${date}\n${canonHeaders}${resource}`)
    .digest('base64')

  return new Promise((resolve, reject) => {
    const req = https.request(
      { method, host, path: `/${key}`, timeout: timeoutMs, headers: { Date: date, Authorization: `OSS ${cfg.accessKeyId}:${sig}`, ...headers } },
      (res) => {
        let text = ''
        res.setEncoding('utf8')
        res.on('data', (c) => (text += c))
        res.on('end', () => resolve({ status: res.statusCode, headers: res.headers, body: text }))
      }
    )
    req.on('error', reject)
    req.on('timeout', () => req.destroy(new Error(`OSS ${method} ${key} 超时`)))
    if (body && body.pipe) {
      body.on('error', reject)
      body.pipe(req)
    } else {
      req.end(body || undefined)
    }
  })
}

function signedUrl(cfg, key, ttlSeconds) {
  const expires = Math.floor(Date.now() / 1000) + ttlSeconds
  const sig = crypto
    .createHmac('sha1', cfg.accessKeySecret)
    .update(`GET\n\n\n${expires}\n/${cfg.bucket}/${key}`)
    .digest('base64')
  return `https://${cfg.domain}/${key}?OSSAccessKeyId=${encodeURIComponent(cfg.accessKeyId)}&Expires=${expires}&Signature=${encodeURIComponent(sig)}`
}

async function headSize(cfg, key) {
  const r = await ossRequest(cfg, 'HEAD', key, { timeoutMs: 30000 })
  if (r.status !== 200) return null
  return Number(r.headers['content-length'] || 0)
}

async function upload(cfg, key, apkPath) {
  const size = fs.statSync(apkPath).size
  const r = await ossRequest(cfg, 'PUT', key, {
    headers: {
      'Content-Type': 'application/vnd.android.package-archive',
      'Content-Length': size,
      'x-oss-object-acl': 'private',
    },
    body: fs.createReadStream(apkPath),
  })
  if (r.status !== 200) throw new Error(`PUT ${key} -> ${r.status} ${r.body.slice(0, 300)}`)
  return size
}

/**
 * 公网自证:按 App 同款口径(Range 探测)读回 Content-Range 总长。
 * 这一步同时覆盖"证书有效 + CNAME 生效 + 签名可用 + 字节数一致",任一不绿都不许把快腿报成可用。
 */
function probeRange(url, timeoutMs = 30000) {
  return new Promise((resolve, reject) => {
    const req = https.request(
      url,
      {
        method: 'GET',
        timeout: timeoutMs,
        headers: { Range: 'bytes=0-65535' },
        // 只认 A 记录: 该域名曾走 Cloudflare 代理,本机/运营商 DNS 可能还缓存着 CF 的 AAAA(2606:4700:*),
        // Node 的 autoSelectFamily 会优先试它 -> 522/timeout。快腿现在是 DNS-only 直连 OSS,没有 AAAA。
        lookup: (hostname, options, cb) => dns.lookup(hostname, { ...options, family: 4 }, cb),
      },
      (res) => {
        res.resume()
        const cr = String(res.headers['content-range'] || '')
        const total = Number((/\/(\d+)/.exec(cr) || [])[1] || 0)
        resolve({ status: res.statusCode, total, contentRange: cr })
      }
    )
    req.on('error', reject)
    req.on('timeout', () => req.destroy(new Error('快腿自证超时')))
    req.end()
  })
}

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
    } else {
      out[name] = true
    }
  }
  return out
}

async function main() {
  const args = parseArgs(process.argv.slice(2))
  const apk = args.apk
  const version = args.version
  const versionCode = args['version-code']
  const ttl = Number(args.ttl || 31536000)
  if (!apk || !version || !versionCode) {
    throw new Error('用法: --apk <path> --version <ver> --version-code <code> [--ttl <秒>] [--json]')
  }
  if (!fs.existsSync(apk)) throw new Error(`APK 不存在: ${apk}`)
  if (!/^\d+(\.\d+){0,3}$/.test(String(version))) throw new Error(`版本号不合法: ${version}`)

  const cfg = readCreds()
  const key = `download/ihui-ai-${version}-${versionCode}.apk`
  const localSize = fs.statSync(apk).size
  const remoteSize = await headSize(cfg, key)

  let mode = 'uploaded'
  if (remoteSize === localSize) {
    mode = 'cached'
  } else {
    await upload(cfg, key, apk)
    const verified = await headSize(cfg, key)
    if (verified !== localSize) throw new Error(`上传后体积不符: 本地 ${localSize} / 远端 ${verified}`)
  }

  const url = signedUrl(cfg, key, ttl)
  const probe = await probeRange(url)
  if (probe.status !== 206 || probe.total !== localSize) {
    throw new Error(`快腿自证失败: HTTP ${probe.status} content-range="${probe.contentRange}" 期望 206/${localSize}`)
  }
  const result = {
    ok: true,
    leg: 'oss',
    domain: cfg.domain,
    bucket: cfg.bucket,
    key,
    bytes: localSize,
    mode,
    verified: probe.contentRange,
    ttlSeconds: ttl,
    expiresUtc: new Date((Math.floor(Date.now() / 1000) + ttl) * 1000).toISOString(),
    url,
  }
  if (args.json) console.log(JSON.stringify(result))
  else console.log(`[oss] ${mode} ${key} ${localSize}B\n[oss] ${url}`)
  return result
}

const isDirectRun = process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href
if (isDirectRun) {
  main()
    .then((code) => process.exit(typeof code === 'number' ? code : 0))
    .catch((e) => {
      if (process.argv.includes('--json')) console.log(JSON.stringify({ ok: false, leg: 'oss', error: e?.message ?? String(e) }))
      else console.error(`[oss] FAIL ${e?.message ?? e}`)
      process.exit(1)
    })
}
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
