#!/usr/bin/env node
// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * publish-mobile-apk.mjs — 把 mobile-rn release APK 发到固定的公网地址(2026-10-29 立)
 *
 * 固定地址(用户永远用这一条,不再跟着版本号换):
 *   https://dl.aizhs.top/ihui-ai-latest.apk
 *
 * 为什么要这一步:出包脚本只管产出 app-release.apk,而"把包交到手机上"此前每次都要人工
 * 找地方传、再贴一条带版本号的地址(用户手里那条旧地址随后就失效)。现在出包链末尾直接
 * 覆盖同名对象 ⇒ 链接恒定,版本信息走 `--version/--version-code` 同时留一份带版本号的副本。
 *
 * 链路形状(2026-10-29 实测):
 *   本机 → 腾讯云 COS 桶 ihui-download-1367022840(ap-beijing) → 自定义域名 dl.aizhs.top(Cloudflare 橙云,
 *   CF 用 zone 自带证书出 HTTPS)→ 用户。两家云默认域名都禁发 APK/IPA,所以必须走自定义域名。
 *
 * latest 对象必须 `Cache-Control: no-cache`:否则 CF/COS 任一层把旧包缓存住,用户拿到的还是上一版,
 * 而页面/文件名看不出差别(与"线上版本标记会骗"同型)。带版本号的副本反过来给长缓存。
 *
 * 凭据:环境变量 TENCENT_SECRET_ID/TENCENT_SECRET_KEY 优先;否则读密钥库
 * `密钥/腾讯云SecretKey.csv` 第 2 行(SecretId,SecretKey)。密钥库位置经
 * scripts/lib/key-dir.mjs 解析,不写死盘符;读不到就 exit 2「未判定」,绝不跳过上传还报成功。
 *
 * 用法:
 *   node scripts/publish-mobile-apk.mjs --apk <path> --version 0.0.9 --version-code 26102816
 *   node scripts/publish-mobile-apk.mjs --apk <path> --version 0.0.9 --version-code 26102816 --dry-run
 *   node scripts/publish-mobile-apk.mjs --apk <path> --version 0.0.9 --version-code 26102816 --no-latest
 *
 * 退出码:0 成功 / 1 失败(上传或校验不过) / 2 未判定(缺参数、凭据读不到、APK 不存在)
 */
import { createHash, createHmac } from 'node:crypto'
import { createReadStream, existsSync, readFileSync, statSync } from 'node:fs'
import { join } from 'node:path'
import { pathToFileURL } from 'node:url'
import { request } from 'node:https'

import { resolveSecretsRoot } from './lib/key-dir.mjs'

export const COS = {
  Bucket: 'ihui-download-1367022840',
  Region: 'ap-beijing',
  Host: 'ihui-download-1367022840.cos.ap-beijing.myqcloud.com',
  PublicBase: 'https://dl.aizhs.top',
}
export const LATEST_KEY = 'ihui-ai-latest.apk'
export const CRED_FILE = '腾讯云SecretKey.csv'

/** 版本副本的 key:ihui-ai-<version>-<code>.apk(与历史手工命名保持一致) */
export function versionKey(version, versionCode) {
  const v = String(version ?? '').trim()
  const c = String(versionCode ?? '').trim()
  if (!v || !c) throw new Error('versionKey: version 与 versionCode 都必须非空')
  return `ihui-ai-${v}-${c}.apk`
}

export function publicUrl(key) {
  return `${COS.PublicBase}/${key}`
}

/** COS 要求的值编码形态:encodeURIComponent 再不转义 !'()* */
export function cosEncode(s) {
  return encodeURIComponent(s).replace(/[!'()*]/g, (c) => '%' + c.charCodeAt(0).toString(16).toUpperCase())
}

/**
 * COS 请求签名(v5 / sha1)。
 * 只签调用方显式给出的头(q-header-list 与真实发送的头必须一致,COS 会逐项核对)。
 */
export function buildAuthorization({ secretId, secretKey, method, pathname, headers, startTime, endTime }) {
  const keyTime = `${startTime};${endTime}`
  const signKey = createHmac('sha1', secretKey).update(keyTime).digest('hex')
  const headerPairs = Object.keys(headers)
    .map((k) => k.toLowerCase())
    .sort()
    .map((k) => `${k}=${cosEncode(headers[k])}`)
    .join('&')
  const httpString = `${method.toLowerCase()}\n${pathname}\n\n${headerPairs}\n`
  const stringToSign = `sha1\n${keyTime}\n${createHash('sha1').update(httpString).digest('hex')}\n`
  const signature = createHmac('sha1', signKey).update(stringToSign).digest('hex')
  return [
    'q-sign-algorithm=sha1',
    `q-ak=${secretId}`,
    `q-sign-time=${keyTime}`,
    `q-key-time=${keyTime}`,
    `q-header-list=${Object.keys(headers).map((k) => k.toLowerCase()).sort().join(';')}`,
    'q-url-param-list=',
    `q-signature=${signature}`,
  ].join('&')
}

/** 读密钥库里的腾讯云凭据;环境变量优先。返回 null 表示"读不到"(调用方判未判定) */
export function resolveCredential(env = process.env) {
  if (env.TENCENT_SECRET_ID && env.TENCENT_SECRET_KEY) {
    return { secretId: env.TENCENT_SECRET_ID, secretKey: env.TENCENT_SECRET_KEY, source: 'env' }
  }
  const root = resolveSecretsRoot(env)
  if (!root) return null
  const file = join(root, CRED_FILE)
  if (!existsSync(file)) return null
  const rows = readFileSync(file, 'utf8').split(/\r?\n/).filter(Boolean)
  const line = rows[1]
  if (!line) return null
  const [secretId, secretKey] = line.split(',').map((s) => s.trim())
  if (!secretId || !secretKey) return null
  return { secretId, secretKey, source: file }
}

function cosRequest({ secretId, secretKey, method, key, headers, body }) {
  const pathname = '/' + key
  const signed = { ...headers, host: COS.Host }
  const now = Math.floor(Date.now() / 1000)
  const authorization = buildAuthorization({
    secretId,
    secretKey,
    method,
    pathname,
    headers: signed,
    startTime: now - 60,
    endTime: now + 3600,
  })
  return new Promise((resolve, reject) => {
    const req = request(
      {
        host: COS.Host,
        method,
        path: pathname,
        headers: { ...signed, authorization, 'content-length': body ? body.length : 0 },
      },
      (res) => {
        const chunks = []
        res.on('data', (c) => chunks.push(c))
        res.on('end', () => resolve({ status: res.statusCode, headers: res.headers, body: Buffer.concat(chunks).toString('utf8') }))
      },
    )
    req.on('error', reject)
    req.setTimeout(180000, () => req.destroy(new Error('上传超时(180s)')))
    req.end(body)
  })
}

async function uploadFile({ secretId, secretKey, key, file, cacheControl }) {
  const size = statSync(file).size
  const headers = {
    'content-type': 'application/vnd.android.package-archive',
    'content-length': String(size),
    'x-cos-acl': 'public-read',
    'cache-control': cacheControl,
  }
  // 81MB 单次 PUT 是 COS 允许的(<5GB),避免再引分片上传的状态机
  const res = await new Promise((resolve, reject) => {
    const now = Math.floor(Date.now() / 1000)
    const signed = { ...headers, host: COS.Host }
    const authorization = buildAuthorization({
      secretId,
      secretKey,
      method: 'PUT',
      pathname: '/' + key,
      headers: signed,
      startTime: now - 60,
      endTime: now + 3600,
    })
    const req = request(
      {
        host: COS.Host,
        method: 'PUT',
        path: '/' + key,
        headers: { ...signed, authorization },
      },
      (r) => {
        const chunks = []
        r.on('data', (c) => chunks.push(c))
        r.on('end', () => resolve({ status: r.statusCode, body: Buffer.concat(chunks).toString('utf8') }))
      },
    )
    req.on('error', reject)
    req.setTimeout(600000, () => req.destroy(new Error('上传超时(600s)')))
    createReadStream(file).pipe(req)
  })
  if (res.status !== 200) throw new Error(`PUT ${key} 失败: HTTP ${res.status} ${res.body.slice(0, 300)}`)
  return size
}

async function headFile({ secretId, secretKey, key }) {
  const res = await cosRequest({ secretId, secretKey, method: 'HEAD', key, headers: {} })
  if (res.status !== 200) throw new Error(`HEAD ${key} 失败: HTTP ${res.status}`)
  return Number(res.headers['content-length'])
}

function parseArgs(argv) {
  const out = { apk: '', version: '', versionCode: '', dryRun: false, latest: true }
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i]
    if (a === '--apk') out.apk = argv[++i] ?? ''
    else if (a === '--version') out.version = argv[++i] ?? ''
    else if (a === '--version-code') out.versionCode = argv[++i] ?? ''
    else if (a === '--dry-run') out.dryRun = true
    else if (a === '--no-latest') out.latest = false
    else if (a === '--help' || a === '-h') out.help = true
    else throw new Error(`未知参数: ${a}`)
  }
  return out
}

async function main() {
  const args = parseArgs(process.argv.slice(2))
  if (args.help) {
    console.log('用法: node scripts/publish-mobile-apk.mjs --apk <path> --version <semver> --version-code <int> [--dry-run] [--no-latest]')
    return 0
  }
  if (!args.apk || !args.version || !args.versionCode) {
    console.error('未判定: --apk / --version / --version-code 三者都必填')
    return 2
  }
  if (!existsSync(args.apk)) {
    console.error(`未判定: APK 不存在 ${args.apk}`)
    return 2
  }
  const cred = resolveCredential()
  if (!cred) {
    console.error('未判定: 读不到腾讯云凭据(env TENCENT_SECRET_ID/KEY 或 密钥/腾讯云SecretKey.csv)')
    return 2
  }
  const keys = []
  const vKey = versionKey(args.version, args.versionCode)
  keys.push({ key: vKey, cacheControl: 'public, max-age=31536000' })
  if (args.latest) keys.push({ key: LATEST_KEY, cacheControl: 'no-cache' })

  const sizeMB = (statSync(args.apk).size / 1048576).toFixed(1)
  console.log(`[publish] ${args.apk} (${sizeMB} MB) → ${COS.Bucket}@${COS.Region}`)
  console.log(`[publish] 凭据来源: ${cred.source}`)
  for (const { key } of keys) console.log(`[publish]   ${key}  →  ${publicUrl(key)}`)

  if (args.dryRun) {
    console.log('[publish] --dry-run: 只打印计划,未上传')
    return 0
  }

  for (const { key, cacheControl } of keys) {
    const size = await uploadFile({ secretId: cred.secretId, secretKey: cred.secretKey, key, file: args.apk, cacheControl })
    const remote = await headFile({ secretId: cred.secretId, secretKey: cred.secretKey, key })
    if (remote !== size) throw new Error(`${key} 回读大小不符: 本地 ${size} / 远端 ${remote}`)
    console.log(`[publish] ✓ ${key} (${(size / 1048576).toFixed(1)} MB, 回读一致)`)
  }
  console.log(`\n下载地址(固定): ${publicUrl(LATEST_KEY)}`)
  console.log(`本次版本副本: ${publicUrl(vKey)}`)
  return 0
}

const isDirectRun = process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href
if (isDirectRun) {
  main()
    .then((code) => process.exit(code))
    .catch((e) => {
      console.error(`❌ ${e?.message ?? e}`)
      process.exit(1)
    })
}

export const __test__ = { versionKey, publicUrl, cosEncode, buildAuthorization, resolveCredential }
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
