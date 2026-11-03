#!/usr/bin/env node
// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * mobile-download-leg.mjs — Android 对外下载腿的唯一事实源(2026-11-03 立,P1 发布线收尾)
 *
 * 为什么需要它:固定下载地址曾分散在 publish/register/check/build.ps1/deploy.sh/.env.example
 * 六处各写一份,任何一处改漏都会让"页面写的地址"与"真实产物"分叉。本模块只做一件事:
 * 把地址、证书基准、最小体积收进 scripts/data/mobile-download-leg.json,其余消费者 import 或
 * 读取该文件,不准再写第二份字面量。
 *
 * 口径(用户 2026-11-03 拍板):
 *   - 正式包只能由持 ~/.android/ihui-release.keystore 的机器产出;证书 SHA-256 基准
 *     `62:B0:FF:0E…`(hex `62b0ff0e...`),与官网一致。
 *   - 私钥绝不进 GitHub Secrets/仓库文件 ⇒ CI 永久只产 `ihui-ai-dev-<run>.apk/.aab`,
 *     GitHub Release 不得作为对外下载腿。
 *   - EAS 自动 keystore(`62:0C:C9:58…`)与基准不同源;对齐前禁止其 AAB 对外分发。
 *
 * 取值优先级(--url 由调用方处理):IHUI_MOBILE_DOWNLOAD_URL > NEXT_PUBLIC_DOWNLOAD_APK_URL >
 * JSON 的 downloadUrl。覆盖只用于部署机/联调,不得写回 JSON。
 *
 * 用法(给 shell / PowerShell 取同源值,避免再抄一遍 URL):
 *   node scripts/lib/mobile-download-leg.mjs --url     # 打印当前生效 URL
 *   node scripts/lib/mobile-download-leg.mjs --json    # 打印整份配置(含生效 URL)
 */
import { readFileSync } from 'node:fs'
import { dirname, join, resolve } from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'

const HERE = dirname(fileURLToPath(import.meta.url))
export const MOBILE_DOWNLOAD_LEG_CONFIG_PATH = join(HERE, '..', 'data', 'mobile-download-leg.json')

const CONFIG = JSON.parse(readFileSync(MOBILE_DOWNLOAD_LEG_CONFIG_PATH, 'utf8'))

export const DOWNLOAD_URL_ENV_KEYS = ['IHUI_MOBILE_DOWNLOAD_URL', 'NEXT_PUBLIC_DOWNLOAD_APK_URL']
export const DEFAULT_MOBILE_DOWNLOAD_URL = String(CONFIG.downloadUrl || '').trim()
export const SITE_LEG_PUBLIC_BASE = String(CONFIG.siteLegPublicBase || '').trim()
export const SITE_LEG_URL_PREFIX = String(CONFIG.siteLegUrlPrefix || '').trim()
export const LATEST_KEY = String(CONFIG.latestKey || '').trim()
export const MIN_APK_BYTES = Number(CONFIG.minApkBytes) || 50 * 1024 * 1024
export const RELEASE_CERT_SHA256 = normalizeCertDigest(CONFIG.releaseCertSha256)
export const RELEASE_CERT_SHA256_DISPLAY = String(CONFIG.releaseCertSha256Display || '62:B0:FF:0E…').trim()

if (!DEFAULT_MOBILE_DOWNLOAD_URL) {
  throw new Error(`下载腿单源缺 downloadUrl:${MOBILE_DOWNLOAD_LEG_CONFIG_PATH}`)
}

/** 证书指纹归一:大小写/冒号/空格都不影响比较。 */
export function normalizeCertDigest(value) {
  return String(value ?? '')
    .replace(/[: ]/g, '')
    .toLowerCase()
}

/**
 * 解析生效的下载 URL。
 * @param {Record<string, string|undefined>} [env]
 * @returns {{url:string, source:string}}
 */
export function resolveMobileDownloadUrl(env = process.env) {
  for (const key of DOWNLOAD_URL_ENV_KEYS) {
    const value = String(env?.[key] ?? '').trim()
    if (value) return { url: value, source: key }
  }
  return { url: DEFAULT_MOBILE_DOWNLOAD_URL, source: MOBILE_DOWNLOAD_LEG_CONFIG_PATH }
}

/**
 * URL 是否落在本机/局域网/无外网可达面(file:、localhost、私网段、.local)。
 * 这类地址不产生"公网下载腿",门判 skipped(exit 2),不得当绿。
 */
export function isLocalDownloadHost(hostname) {
  const h = String(hostname || '')
    .toLowerCase()
    .replace(/^\[|\]$/g, '')
  if (!h) return true
  if (['localhost', '0.0.0.0', '::', '::1'].includes(h)) return true
  if (h.endsWith('.local') || h.endsWith('.localhost')) return true
  if (/^127\./.test(h) || /^10\./.test(h) || /^192\.168\./.test(h)) return true
  if (/^172\.(1[6-9]|2\d|3[01])\./.test(h)) return true
  if (/^169\.254\./.test(h)) return true
  if (/^f[cd][0-9a-f]{2}:/i.test(h)) return true // IPv6 ULA
  if (/^fe[89ab][0-9a-f]:/i.test(h)) return true // IPv6 link-local
  return false
}

/**
 * 探针判据(纯函数,self-test 直接钉):
 *   - 200/206 才算可达(HEAD 跟随 302 后的最终状态)
 *   - Content-Length 必须给出且 >= minBytes;缺失落 undetermined(exit 2),不许猜
 * @param {{status?:number|null, contentLength?:number|null}} probe
 * @param {{minBytes?:number}} [opts]
 * @returns {{state:'ok'|'fail'|'undetermined', reason:string}}
 */
export function judgeDownloadProbe(probe, opts = {}) {
  const minBytes = Number(opts.minBytes ?? MIN_APK_BYTES)
  const status = Number(probe?.status)
  const size = probe?.contentLength === null || probe?.contentLength === undefined
    ? null
    : Number(probe.contentLength)
  if (!Number.isFinite(status) || status <= 0) {
    return { state: 'undetermined', reason: '没有拿到 HTTP 状态(网络不可达或探针未执行)' }
  }
  if (status !== 200 && status !== 206) {
    return { state: 'fail', reason: `HTTP ${status}(期望 200/206)` }
  }
  if (!Number.isFinite(size) || size <= 0) {
    return { state: 'undetermined', reason: '响应缺 Content-Length(无法判断体积,拒绝记绿)' }
  }
  if (size < minBytes) {
    return { state: 'fail', reason: `体积 ${size}B < 下限 ${minBytes}B` }
  }
  return { state: 'ok', reason: `HTTP ${status},${size}B >= ${minBytes}B` }
}

/**
 * 证书判据(纯函数):actual 必须等于基准;不等即 fail,并点名基准。
 * @param {{actual?:string|null, expected?:string, display?:string}} args
 * @returns {{state:'ok'|'fail', reason:string, actual:string, expected:string}}
 */
export function judgeCertDigest({ actual, expected = RELEASE_CERT_SHA256, display = RELEASE_CERT_SHA256_DISPLAY } = {}) {
  const wanted = normalizeCertDigest(expected)
  const got = normalizeCertDigest(actual)
  if (!got) {
    return {
      state: 'fail',
      reason: `读不出 APK 证书 SHA-256(基准 ${display})`,
      actual: '',
      expected: wanted,
    }
  }
  if (got !== wanted) {
    return {
      state: 'fail',
      reason: `证书 SHA-256 不符:实际 ${got},基准 ${display}(${wanted})`,
      actual: got,
      expected: wanted,
    }
  }
  return { state: 'ok', reason: `证书 SHA-256 = ${display}`, actual: got, expected: wanted }
}

/**
 * 三态收口:任一 fail ⇒ 1;否则任一 skipped/undetermined ⇒ 2;全 ok ⇒ 0。
 * skipped 绝不折算成绿。
 * @param {{state:string}[]} checks
 */
export function summarizeExit(checks) {
  const list = Array.isArray(checks) ? checks : []
  if (list.some((c) => c?.state === 'fail')) return 1
  if (list.some((c) => c?.state !== 'ok')) return 2
  return 0
}

function main(argv) {
  if (argv.includes('--json')) {
    const resolved = resolveMobileDownloadUrl()
    process.stdout.write(`${JSON.stringify({ ...CONFIG, effectiveUrl: resolved.url, effectiveUrlSource: resolved.source }, null, 2)}\n`)
    return 0
  }
  // 缺省与 --url 都打印生效地址,便于 shell/PowerShell 单行取值。
  process.stdout.write(`${resolveMobileDownloadUrl().url}\n`)
  return 0
}

const isDirectRun = Boolean(process.argv[1]) && pathToFileURL(resolve(process.argv[1])).href === import.meta.url

if (isDirectRun) {
  process.exitCode = main(process.argv.slice(2))
}
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
