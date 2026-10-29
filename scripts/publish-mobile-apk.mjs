#!/usr/bin/env node
// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * publish-mobile-apk.mjs — 把 mobile-rn release APK 发到固定的公网地址(2026-10-29 立)
 *
 * 固定地址(用户永远用这一条,不再跟着版本号换):
 *   主用  https://www.aizhs.top/remote-images/download/ihui-ai-latest.apk   (站点 CDN 腿,国内实测 1–4 MB/s)
 *   备用  https://dl.aizhs.top/ihui-ai-latest.apk                            (COS/CF 橙云腿,跨境限速随 CF 策略变)
 *
 * 为什么要这一步:出包脚本只管产出 app-release.apk,而"把包交到手机上"此前每次都要人工
 * 找地方传、再贴一条带版本号的地址(用户手里那条旧地址随后就失效)。现在出包链末尾直接
 * 覆盖同名对象 ⇒ 链接恒定,版本信息走 `--version/--version-code` 同时留一份带版本号的副本。
 *
 * 链路形状(2026-10-29 实测):
 *   站点腿:本机 → `deploy/server-root/remote-images/download/`(线上 cdn-server 的 --root)
 *           → EdgeOne → 用户。`…/ihui-ai-latest.apk` 不是实物文件,而是 cdn-server 读旁边
 *           `ihui-ai-latest.apk.redirect.json` 转出的 no-cache 302;真正被边缘长缓存的是带
 *           版本号那份(字节恒定才谈得上缓存)。
 *   COS 腿:本机 → 腾讯云 COS 桶 ihui-download-1367022840(ap-beijing) → 自定义域名 dl.aizhs.top
 *           (Cloudflare 橙云,CF 用 zone 自带证书出 HTTPS)→ 用户。两家云默认域名都禁发 APK/IPA,
 *           所以必须走自定义域名。2026-10-29 实测这条腿国内只剩 3–6 KB/s,故降为备用。
 *
 * latest 对象/指针必须 `no-cache`:否则任一层把旧包缓存住,用户拿到的还是上一版,
 * 而页面/文件名看不出差别(与"线上版本标记会骗"同型)。带版本号的副本反过来给长缓存。
 *
 * 凭据:环境变量 TENCENT_SECRET_ID/TENCENT_SECRET_KEY 优先;否则读密钥库
 * `密钥/腾讯云SecretKey.csv` 第 2 行(SecretId,SecretKey)。密钥库位置经
 * scripts/lib/key-dir.mjs 解析,不写死盘符;读不到就 exit 2「未判定」,绝不跳过上传还报成功。
 * 站点腿落点同样不写死盘符:经 scripts/seal-c-root-stray.mjs 的 devEnvRoot() 解析生产签出,
 * 两侧都不存在 ⇒ exit 2 点名已试路径(静默跳过 = 对外地址停在旧包而账面是绿的)。
 *
 * 用法:
 *   node scripts/publish-mobile-apk.mjs --apk <path> --version 0.0.9 --version-code 26102816
 *   node scripts/publish-mobile-apk.mjs --apk <path> --version 0.0.9 --version-code 26102816 --dry-run
 *   node scripts/publish-mobile-apk.mjs --apk <path> --version 0.0.9 --version-code 26102816 --no-latest
 *   node scripts/publish-mobile-apk.mjs --apk <path> --version 0.0.9 --version-code 26102816 --no-site
 *
 * 退出码:0 成功 / 1 失败(上传、落盘或公网自证不过) / 2 未判定(缺参数、凭据读不到、APK 或站点落点取不到)
 */
import { createHash, createHmac } from 'node:crypto'
import { copyFileSync, createReadStream, existsSync, readFileSync, statSync, writeFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'
import { request } from 'node:https'

import { resolveSecretsRoot } from './lib/key-dir.mjs'
import { devEnvRoot } from './seal-c-root-stray.mjs'

const HERE = dirname(fileURLToPath(import.meta.url))
const REPO = join(HERE, '..')

export const COS = {
  Bucket: 'ihui-download-1367022840',
  Region: 'ap-beijing',
  Host: 'ihui-download-1367022840.cos.ap-beijing.myqcloud.com',
  PublicBase: 'https://dl.aizhs.top',
}
export const LATEST_KEY = 'ihui-ai-latest.apk'
export const CRED_FILE = '腾讯云SecretKey.csv'

/**
 * 站点 CDN 腿(2026-10-29 立,与 COS 腿并列的第二条出口)。
 *
 * 为什么需要第二条腿:dl.aizhs.top 走 Cloudflare 橙云,2026-10-29 实测国内单连接
 * 只剩 3–6 KB/s(IPv4 3.2KB/s、IPv6 6KB/s,同一时刻站内 EdgeOne 腿 1.08–4.26MB/s)——
 * 免费橙云的跨境腿限速不在我方可控范围内,把它当唯一出口等于把交付押在会变的第三方策略上。
 *
 * 固定地址的新鲜度靠指针,不靠"同名覆盖 + 短缓存":版本名文件在边缘给 7 天长缓存(字节
 * 不变才谈得上缓存),而 `<latest>.apk` 这条请求由 cdn-server 读旁边的 `.redirect.json`
 * 转成 no-cache 302。这样"用户记一条地址"和"永远拿到最新包"同时成立,且 302 只有几百字节,
 * 每次回源的成本与包大小无关。
 */
export const SITE_LEG = {
  PublicBase: 'https://www.aizhs.top',
  UrlPrefix: '/remote-images/download',
  RelDir: join('deploy', 'server-root', 'remote-images', 'download'),
}

/** 站点腿的公网地址(版本名或固定名同一个命名空间) */
export function siteLegUrl(key) {
  return `${SITE_LEG.PublicBase}${SITE_LEG.UrlPrefix}/${key}`
}

/**
 * 落点选择:生产签出优先(线上 cdn-server 的 --root 就是它),其次本仓。
 * 两处都不存在 ⇒ chosen=null,调用方必须**失败**而不是"跳过站点腿还报成功"——
 * 静默跳过会让对外地址停留在旧包,而账面是绿的。
 */
export function siteLegPlan({ repoRoot = REPO, env = process.env, exists = existsSync, resolveDevEnvRoot = devEnvRoot } = {}) {
  const candidates = []
  let prodDir = null
  try {
    prodDir = join(resolveDevEnvRoot(repoRoot), 'ihui-prod')
  } catch {
    prodDir = null
  }
  if (prodDir) candidates.push({ source: 'prod-checkout', dir: join(prodDir, SITE_LEG.RelDir) })
  candidates.push({ source: 'repo', dir: join(repoRoot, SITE_LEG.RelDir) })
  const hit = candidates.find((c) => exists(c.dir))
  return { candidates, chosen: hit ?? null, envOverride: (env.IHUI_SITE_CDN_DIR || '').trim() || null }
}

/** 流式 sha256(81MB 不整块进内存) */
export function sha256File(file) {
  return new Promise((resolve, reject) => {
    const h = createHash('sha256')
    createReadStream(file)
      .on('data', (c) => h.update(c))
      .on('end', () => resolve(h.digest('hex')))
      .on('error', reject)
  })
}

/**
 * 写站点腿:①先落版本名并回读大小 ②再翻指针。顺序不可颠倒——先翻指针等于把用户
 * 指向一个还没落地的文件(302 打到 404),而 404 在边缘会被当成"这个包不存在"缓存住。
 */
export function publishSiteLeg({ apk, dir, version, versionCode, sha256, size }) {
  const vKey = versionKey(version, versionCode)
  const target = join(dir, vKey)
  copyFileSync(apk, target)
  const back = statSync(target).size
  if (back !== size) throw new Error(`站点腿回读大小不符: 源 ${size} / 落点 ${back} (${target})`)
  const pointer = {
    url: siteLegUrl(vKey),
    version: String(version),
    versionCode: String(versionCode),
    size,
    sha256,
    publishedAt: new Date().toISOString(),
  }
  const pointerPath = join(dir, `${LATEST_KEY}.redirect.json`)
  writeFileSync(pointerPath, JSON.stringify(pointer, null, 2) + '\n')
  return { vKey, target, pointerPath, pointer }
}

/**
 * 公网自证:固定地址必须 302 到本次版本,且那条 Location 真的是 apk 字节。
 * 只读响应头不看正文(取完立刻 cancel,避免把 81MB 拖回来自己测自己)。
 * 判不出 ⇒ 抛错(整条发布按失败处理),不返回"大概没问题"。
 */
export async function verifySiteLegLive({ latestUrl = siteLegUrl(LATEST_KEY), expectSize, expectVersionCode, fetchImpl = fetch, timeoutMs = 30000 } = {}) {
  const signal = () => AbortSignal.timeout(timeoutMs)
  const r = await fetchImpl(latestUrl, { redirect: 'manual', signal: signal() })
  await r.body?.cancel().catch(() => {})
  if (r.status !== 302) throw new Error(`固定地址未按 302 应答: HTTP ${r.status} (${latestUrl})`)
  const loc = r.headers.get('location') || ''
  if (!loc.startsWith('https://')) throw new Error(`302 目标不是 https: ${loc || '(缺 Location)'}`)
  if (expectVersionCode && !loc.includes(`-${expectVersionCode}.apk`)) throw new Error(`固定地址仍指向旧包: ${loc}`)
  const f = await fetchImpl(loc, { headers: { range: 'bytes=0-0' }, signal: signal() })
  await f.body?.cancel().catch(() => {})
  const ct = f.headers.get('content-type') || ''
  if (f.status !== 200 && f.status !== 206) throw new Error(`版本副本公网取不到: HTTP ${f.status} (${loc})`)
  if (!ct.includes('vnd.android.package-archive')) throw new Error(`公网 Content-Type=${ct || '(空)'},不是 apk —— 多半落到占位图/缺文件`)
  const cr = f.headers.get('content-range') || ''
  const remote = Number(cr.includes('/') ? cr.split('/')[1] : f.headers.get('content-length') || 0)
  if (expectSize && remote !== Number(expectSize)) throw new Error(`公网回读大小不符: 本地 ${expectSize} / 公网 ${remote}`)
  return { location: loc, status: f.status, contentType: ct, size: remote }
}


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
  const out = { apk: '', version: '', versionCode: '', dryRun: false, latest: true, noSite: false }
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i]
    if (a === '--apk') out.apk = argv[++i] ?? ''
    else if (a === '--version') out.version = argv[++i] ?? ''
    else if (a === '--version-code') out.versionCode = argv[++i] ?? ''
    else if (a === '--dry-run') out.dryRun = true
    else if (a === '--no-latest') out.latest = false
    else if (a === '--no-site') out.noSite = true
    else if (a === '--help' || a === '-h') out.help = true
    else throw new Error(`未知参数: ${a}`)
  }
  return out
}

async function main() {
  const args = parseArgs(process.argv.slice(2))
  if (args.help) {
    console.log('用法: node scripts/publish-mobile-apk.mjs --apk <path> --version <semver> --version-code <int> [--dry-run] [--no-latest] [--no-site]')
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
  const size = statSync(args.apk).size
  const sha = await sha256File(args.apk)
  const plan = args.noSite ? null : siteLegPlan()
  if (plan && !plan.chosen) {
    console.error(`未判定: 站点 CDN 落点不存在 ⇒ 固定地址不会更新,拒绝把发布报成成功(要跳过站点腿用 --no-site)`)
    console.error('  已试: ' + plan.candidates.map((c) => `${c.source}=${c.dir}`).join(' | '))
    return 2
  }
  const keys = []
  const vKey = versionKey(args.version, args.versionCode)
  keys.push({ key: vKey, cacheControl: 'public, max-age=31536000' })
  if (args.latest) keys.push({ key: LATEST_KEY, cacheControl: 'no-cache' })

  const sizeMB = (size / 1048576).toFixed(1)
  console.log(`[publish] ${args.apk} (${sizeMB} MB, sha256=${sha.slice(0, 16)}…)`)
  console.log(`[publish] 凭据来源: ${cred.source}`)
  for (const { key } of keys) console.log(`[publish]   COS   ${key}  →  ${publicUrl(key)}`)
  if (plan) {
    console.log(`[publish]   站点腿 ${vKey}  →  ${siteLegUrl(vKey)}  (落点 ${plan.chosen.dir}, 取自 ${plan.chosen.source})`)
    console.log(`[publish]   站点腿固定地址指针 ${LATEST_KEY}.redirect.json → ${siteLegUrl(LATEST_KEY)}`)
  }

  if (args.dryRun) {
    console.log('[publish] --dry-run: 只打印计划,未上传')
    return 0
  }

  for (const { key, cacheControl } of keys) {
    const up = await uploadFile({ secretId: cred.secretId, secretKey: cred.secretKey, key, file: args.apk, cacheControl })
    const remote = await headFile({ secretId: cred.secretId, secretKey: cred.secretKey, key })
    if (remote !== up) throw new Error(`${key} 回读大小不符: 本地 ${up} / 远端 ${remote}`)
    console.log(`[publish] ✓ COS ${key} (${(remote / 1048576).toFixed(1)} MB, 回读一致)`)
  }

  // 站点腿:版本名先落盘,指针最后翻(顺序反了等于把用户 302 到一个还不存在的文件)
  let site = null
  if (plan) {
    site = publishSiteLeg({ apk: args.apk, dir: plan.chosen.dir, version: args.version, versionCode: args.versionCode, sha256: sha, size })
    console.log(`[publish] ✓ 站点腿 ${site.vKey} (${(statSync(site.target).size / 1048576).toFixed(1)} MB, 回读一致)`)
    console.log(`[publish] ✓ 指针已翻 → ${site.pointer.url}`)
    const live = await verifySiteLegLive({ expectSize: size, expectVersionCode: args.versionCode })
    console.log(`[publish] ✓ 公网自证 HTTP ${live.status} content-range 大小 ${live.size} → ${live.location}`)
  }

  console.log(`\n下载地址(固定,站点 CDN 腿): ${site ? siteLegUrl(LATEST_KEY) : '(本次跳过站点腿)'}`)
  console.log(`备用地址(固定,COS/CF 腿): ${publicUrl(LATEST_KEY)}`)
  console.log(`本次版本副本(站点腿): ${siteLegUrl(vKey)}`)
  console.log(`本次版本副本(COS 腿) : ${publicUrl(vKey)}`)
  console.log(`SHA256: ${sha}`)
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

export const __test__ = {
  versionKey,
  publicUrl,
  cosEncode,
  buildAuthorization,
  resolveCredential,
  siteLegUrl,
  siteLegPlan,
  publishSiteLeg,
  verifySiteLegLive,
  sha256File,
  SITE_LEG,
  LATEST_KEY,
}
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
