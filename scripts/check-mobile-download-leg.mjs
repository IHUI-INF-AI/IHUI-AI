#!/usr/bin/env node
// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * check-mobile-download-leg.mjs — Android 对外下载腿门(2026-11-03 立,P1 发布线收尾)
 *
 * 它只回答三个问题,且每一问都允许"未判定"而不是猜绿:
 *   1. 配置里的 URL 从公网可达吗(HEAD/GET 跟随 302 后必须是 200/206);
 *   2. Content-Length 在合理量级吗(默认 >= 50MiB,`--min-bytes` 可调);
 *   3. 手里的 APK(`--apk` 或 `--download`)证书 SHA-256 等于正式基准 `62:B0:FF:0E…` 吗。
 *
 * 三态退出码(口径写死,调用方不得把 2 当 0):
 *   0 = 全绿(URL/体积 ok,且证书在要求校验时等于基准)
 *   1 = 任一硬失败(404/5xx、体积过小、证书不符/读不出)
 *   2 = skipped/未判定(URL 指本机/内网、无网络、Content-Length 缺失、apksigner 不在位)
 *       —— **skip 不是绿**,CI 里出现 2 要人看,不得静默折算成功。
 *
 * 为什么链接要跟随重定向:站点固定地址 `…/ihui-ai-latest.apk` 不是实物文件,而是 cdn-server
 * 读旁边 `ihui-ai-latest.apk.redirect.json` 转出的 no-cache 302;真正长缓存的是带版本号副本。
 * 门必须验证"用户点下去最终拿到的那一枚",所以判最终 200/206,不判 302 本身。
 *
 * 为什么证书基准写死在单源 JSON 而不是读 keystore:门的职责是"对外分发的那枚包与官网证书
 * 同源",基准是公开指纹 `62:B0:FF:0E…`;读 keystore 需要密码,CI/审计机不该有。
 * 出处 = `scripts/data/mobile-download-leg.json`(唯一真源)。
 *
 * 用法:
 *   node scripts/check-mobile-download-leg.mjs                 # 只查 URL + 体积
 *   node scripts/check-mobile-download-leg.mjs --apk <path>    # 追加证书校验(发布机必跑)
 *   node scripts/check-mobile-download-leg.mjs --download      # 临时下载再验证书(需 apksigner)
 *   node scripts/check-mobile-download-leg.mjs --json          # 机器可读输出
 *   node scripts/check-mobile-download-leg.mjs --self-test     # 纯函数夹具(不触网)
 *
 * CI:`.github/workflows/mobile-download-leg.yml` 用 workflow_dispatch + 每日定时跑,
 * 不进 PR 每次构建 —— 外部站点抖动不应阻塞每次 PR;证书校验留给持钥发布机(CI 无正式 keystore)。
 */
import { createWriteStream, existsSync, mkdtempSync, rmSync, statSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { isAbsolute, join, resolve } from 'node:path'
import { Readable } from 'node:stream'
import { pipeline } from 'node:stream/promises'
import { pathToFileURL } from 'node:url'

import { apkCert } from './mobile-release-artifact-check.mjs'
import {
  DEFAULT_MOBILE_DOWNLOAD_URL,
  MIN_APK_BYTES,
  RELEASE_CERT_SHA256,
  RELEASE_CERT_SHA256_DISPLAY,
  isLocalDownloadHost,
  judgeCertDigest,
  judgeDownloadProbe,
  resolveMobileDownloadUrl,
  summarizeExit,
} from './lib/mobile-download-leg.mjs'

export const EXIT = Object.freeze({ ok: 0, fail: 1, skipped: 2 })
const DEFAULT_TIMEOUT_MS = 30_000
const DOWNLOAD_TIMEOUT_MS = 300_000

function parseContentLength(value) {
  if (value === null || value === undefined || value === '') return null
  const n = Number(value)
  return Number.isFinite(n) && n > 0 ? n : null
}

/** `bytes 0-0/87239461` → 87239461 */
function parseContentRange(value) {
  const m = /\/\s*(\d+)\s*$/.exec(String(value || ''))
  return m ? Number(m[1]) : null
}

export function parseArgs(argv) {
  const opts = {
    url: null,
    apk: null,
    minBytes: null,
    timeoutMs: null,
    json: false,
    selfTest: false,
    download: false,
    help: false,
  }
  for (let i = 0; i < argv.length; i += 1) {
    const flag = argv[i]
    switch (flag) {
      case '--url':
        opts.url = argv[++i] ?? null
        if (!opts.url) throw new Error('--url 缺值')
        break
      case '--apk':
        opts.apk = argv[++i] ?? null
        if (!opts.apk) throw new Error('--apk 缺值')
        break
      case '--min-bytes': {
        const raw = argv[++i]
        const n = Number(raw)
        if (!Number.isFinite(n) || n <= 0) throw new Error(`--min-bytes 非正数:${raw}`)
        opts.minBytes = n
        break
      }
      case '--timeout-ms': {
        const raw = argv[++i]
        const n = Number(raw)
        if (!Number.isFinite(n) || n <= 0) throw new Error(`--timeout-ms 非正数:${raw}`)
        opts.timeoutMs = n
        break
      }
      case '--json':
        opts.json = true
        break
      case '--self-test':
        opts.selfTest = true
        break
      case '--download':
        opts.download = true
        break
      case '--help':
      case '-h':
        opts.help = true
        break
      default:
        throw new Error(`未知参数:${flag}`)
    }
  }
  if (opts.apk && opts.download) throw new Error('--apk 与 --download 只能二选一')
  return opts
}

/** URL 分类:public / local(本机内网) / invalid。 */
export function classifyDownloadUrl(raw) {
  let parsed
  try {
    parsed = new URL(String(raw || '').trim())
  } catch {
    return { kind: 'invalid', reason: `URL 解析失败:${raw}` }
  }
  if (parsed.protocol === 'file:') {
    return { kind: 'local', reason: 'file: URL 不是公网下载腿' }
  }
  if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') {
    return { kind: 'invalid', reason: `不支持的协议 ${parsed.protocol}` }
  }
  if (isLocalDownloadHost(parsed.hostname)) {
    return { kind: 'local', reason: `host ${parsed.hostname} 指向本机/内网` }
  }
  return { kind: 'public', url: parsed }
}

function isOfflineError(error) {
  const code = String(error?.cause?.code || error?.code || '')
  const name = String(error?.name || '')
  return (
    name === 'TimeoutError' ||
    name === 'AbortError' ||
    ['ENOTFOUND', 'ECONNREFUSED', 'EHOSTUNREACH', 'ENETUNREACH', 'ETIMEDOUT', 'EAI_AGAIN'].includes(code) ||
    code.startsWith('UND_ERR_CONNECT_TIMEOUT')
  )
}

async function fetchFollow(url, init, timeoutMs) {
  return fetch(url, {
    ...init,
    redirect: 'follow',
    signal: AbortSignal.timeout(timeoutMs),
  })
}

/**
 * 探针:先 HEAD;HEAD 被拒/缺长度时改用 `Range: bytes=0-0` 的 GET 取总长。
 * @returns {Promise<{status:number, contentLength:number|null, finalUrl:string, method:string}>}
 */
export async function probeDownloadUrl(url, { timeoutMs = DEFAULT_TIMEOUT_MS } = {}) {
  const headers = { 'cache-control': 'no-cache' }
  let head
  try {
    head = await fetchFollow(url, { method: 'HEAD', headers }, timeoutMs)
  } catch (error) {
    if (isOfflineError(error)) throw error
    head = null
  }
  if (head) {
    const length = parseContentLength(head.headers.get('content-length'))
    if ((head.status === 200 || head.status === 206) && length) {
      return { status: head.status, contentLength: length, finalUrl: head.url, method: 'HEAD' }
    }
  }

  const get = await fetchFollow(
    url,
    { method: 'GET', headers: { ...headers, range: 'bytes=0-0' } },
    timeoutMs,
  )
  const total =
    parseContentRange(get.headers.get('content-range')) ??
    parseContentLength(get.headers.get('content-length'))
  const status = get.status
  try {
    await get.body?.cancel()
  } catch {
    /* 取到状态即可,body 不关心 */
  }
  return { status, contentLength: total, finalUrl: get.url, method: 'GET-Range' }
}

async function downloadApk(url, dir, timeoutMs) {
  const res = await fetchFollow(url, { headers: { 'cache-control': 'no-cache' } }, timeoutMs)
  if (res.status !== 200 && res.status !== 206) {
    throw new Error(`下载失败:HTTP ${res.status}`)
  }
  const declared = parseContentLength(res.headers.get('content-length'))
  const file = join(dir, 'download-leg.apk')
  await pipeline(Readable.fromWeb(res.body), createWriteStream(file))
  const bytes = statSync(file).size
  if (declared && Math.abs(declared - bytes) > 1024) {
    throw new Error(`下载字节数不符:声明 ${declared},实际 ${bytes}`)
  }
  return { file, bytes }
}

function certCheckForApk(file) {
  const abs = isAbsolute(file) ? file : resolve(process.cwd(), file)
  if (!existsSync(abs)) return { state: 'fail', reason: `APK 不存在:${file}` }
  let size = 0
  try {
    size = statSync(abs).size
  } catch (error) {
    return { state: 'fail', reason: `APK 不可读:${file}(${error.message})` }
  }
  if (size <= 0) return { state: 'fail', reason: `APK 为空文件:${file}` }
  const cert = apkCert(abs)
  if (cert?.error) {
    // 工具不在位 = 未判定(exit 2,不是绿);工具在位但验不过 = 这枚包有问题(exit 1)。
    const toolMissing = /找不到 apksigner/.test(cert.error)
    return { state: toolMissing ? 'skipped' : 'fail', reason: cert.error }
  }
  return judgeCertDigest({ actual: cert.digest, expected: RELEASE_CERT_SHA256 })
}

function selfTest() {
  const cases = []
  const expect = (name, fn) => {
    try {
      const result = fn()
      cases.push({ name, pass: Boolean(result.ok), detail: result.detail })
    } catch (error) {
      cases.push({ name, pass: false, detail: error.message })
    }
  }

  expect('default-url-from-single-source', () => ({
    ok: DEFAULT_MOBILE_DOWNLOAD_URL === new URL(resolveMobileDownloadUrl({}).url).href,
    detail: DEFAULT_MOBILE_DOWNLOAD_URL,
  }))
  expect('env-priority-IHUI_MOBILE_DOWNLOAD_URL', () => ({
    ok: resolveMobileDownloadUrl({ IHUI_MOBILE_DOWNLOAD_URL: 'https://cdn.example.com/x.apk' }).source ===
      'IHUI_MOBILE_DOWNLOAD_URL',
    detail: resolveMobileDownloadUrl({ IHUI_MOBILE_DOWNLOAD_URL: 'https://cdn.example.com/x.apk' }).url,
  }))
  expect('env-priority-NEXT_PUBLIC_DOWNLOAD_APK_URL', () => ({
    ok: resolveMobileDownloadUrl({ NEXT_PUBLIC_DOWNLOAD_APK_URL: 'https://cdn.example.com/y.apk' }).source ===
      'NEXT_PUBLIC_DOWNLOAD_APK_URL',
    detail: resolveMobileDownloadUrl({ NEXT_PUBLIC_DOWNLOAD_APK_URL: 'https://cdn.example.com/y.apk' }).url,
  }))
  expect('local-host-skip', () => {
    const c = classifyDownloadUrl('http://127.0.0.1:8802/ihui-ai-latest.apk')
    return { ok: c.kind === 'local', detail: c.reason }
  })
  expect('probe-ok-87MB', () => {
    const j = judgeDownloadProbe({ status: 200, contentLength: 87_239_461 })
    return { ok: j.state === 'ok', detail: j.reason }
  })
  expect('probe-fail-404', () => {
    const j = judgeDownloadProbe({ status: 404, contentLength: 10 })
    return { ok: j.state === 'fail', detail: j.reason }
  })
  expect('probe-fail-too-small', () => {
    const j = judgeDownloadProbe({ status: 200, contentLength: 1_048_576 })
    return { ok: j.state === 'fail', detail: j.reason }
  })
  expect('probe-undetermined-no-length', () => {
    const j = judgeDownloadProbe({ status: 200, contentLength: null })
    return { ok: j.state === 'undetermined', detail: j.reason }
  })
  expect('cert-ok-baseline', () => {
    const j = judgeCertDigest({ actual: RELEASE_CERT_SHA256 })
    return { ok: j.state === 'ok', detail: j.reason }
  })
  // 伪造签名场景:与基准不等必须 fail,且点名基准 62:B0:FF:0E…
  expect('cert-fail-forged-signature', () => {
    const forged = 'e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855'
    const j = judgeCertDigest({ actual: forged })
    return { ok: j.state === 'fail' && j.reason.includes(RELEASE_CERT_SHA256_DISPLAY), detail: j.reason }
  })
  expect('exit-priority-fail-over-skip', () => ({
    ok: summarizeExit([{ state: 'skipped' }, { state: 'fail' }]) === EXIT.fail,
    detail: 'fail=1',
  }))
  expect('exit-skip-not-green', () => ({
    ok: summarizeExit([{ state: 'ok' }, { state: 'skipped' }]) === EXIT.skipped,
    detail: 'skip=2',
  }))

  const failed = cases.filter((c) => !c.pass)
  for (const c of cases) {
    console.log(`${c.pass ? 'PASS' : 'FAIL'} self-test:${c.name}${c.detail ? ` — ${c.detail}` : ''}`)
  }
  console.log(failed.length === 0 ? 'SELFTEST OK (12/12)' : `SELFTEST FAILED (${failed.length}/${cases.length})`)
  return failed.length === 0 ? EXIT.ok : EXIT.fail
}

/**
 * 执行完整门。返回三态退出码,并打印人读/JSON 两种输出。
 * @param {ReturnType<typeof parseArgs>} opts
 */
export async function runCheck(opts) {
  const minBytes = opts.minBytes ?? MIN_APK_BYTES
  const timeoutMs = opts.timeoutMs ?? DEFAULT_TIMEOUT_MS
  const resolved = opts.url
    ? { url: String(opts.url).trim(), source: '--url' }
    : resolveMobileDownloadUrl()

  const report = {
    gate: 'mobile-download-leg',
    url: resolved.url,
    urlSource: resolved.source,
    minBytes,
    probe: null,
    cert: { state: 'not-requested', reason: '未提供 --apk/--download,本机无正式 APK 可验' },
    result: 'ok',
    exitCode: EXIT.ok,
  }
  const checks = []

  const classified = classifyDownloadUrl(resolved.url)
  if (classified.kind === 'invalid') {
    report.probe = { state: 'fail', reason: classified.reason }
    checks.push(report.probe)
    finish(report, checks, opts)
    return report.exitCode
  }
  if (classified.kind === 'local') {
    report.probe = { state: 'skipped', reason: classified.reason }
    checks.push(report.probe)
    finish(report, checks, opts)
    return report.exitCode
  }

  try {
    const probe = await probeDownloadUrl(resolved.url, { timeoutMs })
    const judged = judgeDownloadProbe(probe, { minBytes })
    report.probe = { ...judged, ...probe }
    checks.push(report.probe)
  } catch (error) {
    const skipped = isOfflineError(error)
    report.probe = {
      state: skipped ? 'skipped' : 'undetermined',
      reason: `探针失败(${error?.cause?.code || error?.name || 'unknown'}):${error.message}`,
    }
    checks.push(report.probe)
  }

  const wantsCert = Boolean(opts.apk || opts.download)
  if (wantsCert) {
    let apkPath = opts.apk
    let tempDir = null
    try {
      if (opts.download) {
        tempDir = mkdtempSync(join(tmpdir(), 'ihui-download-leg-'))
        const downloaded = await downloadApk(resolved.url, tempDir, Math.max(timeoutMs, DOWNLOAD_TIMEOUT_MS))
        apkPath = downloaded.file
        report.downloadedBytes = downloaded.bytes
      }
      report.cert = certCheckForApk(apkPath)
    } catch (error) {
      report.cert = { state: 'fail', reason: `取包失败:${error.message}` }
    } finally {
      if (tempDir) rmSync(tempDir, { recursive: true, force: true })
    }
    checks.push(report.cert)
  }

  finish(report, checks, opts)
  return report.exitCode
}

function finish(report, checks, opts) {
  report.exitCode = summarizeExit(checks)
  report.result = report.exitCode === EXIT.ok ? 'ok' : report.exitCode === EXIT.fail ? 'fail' : 'skipped'
  if (opts.json) {
    console.log(JSON.stringify(report, null, 2))
    return
  }
  const line = (label, value, extra = '') => console.log(`[download-leg] ${label}=${value}${extra ? ` — ${extra}` : ''}`)
  line('url', report.url, `source=${report.urlSource}`)
  line('probe', report.probe?.state ?? 'unknown', report.probe?.reason ?? '')
  line('cert', report.cert?.state ?? 'not-requested', report.cert?.reason ?? '')
  line('RESULT', report.result, `exit=${report.exitCode}${report.exitCode === EXIT.skipped ? '(skipped 不是绿)' : ''}`)
}

function usage() {
  console.log(`用法: node scripts/check-mobile-download-leg.mjs [选项]

  --url <URL>          覆盖单源地址(默认 scripts/data/mobile-download-leg.json)
  --apk <path>         校验本地 APK 证书 SHA-256 必须等于基准 ${RELEASE_CERT_SHA256_DISPLAY}
  --download           临时下载公网包再验证书(需要 ANDROID_HOME 下有 apksigner)
  --min-bytes <n>      体积下限,默认 ${MIN_APK_BYTES}(50MiB)
  --timeout-ms <n>     探针超时,默认 ${DEFAULT_TIMEOUT_MS}ms
  --json               机器可读输出
  --self-test          纯函数夹具(不触网):伪造签名场景必须判 fail
  --help               本帮助

退出码:0=ok / 1=fail / 2=skipped 或未判定(skip 不是绿)`)
}

async function main(argv) {
  let opts
  try {
    opts = parseArgs(argv)
  } catch (error) {
    console.error(`[download-leg] 参数错误:${error.message}`)
    return EXIT.fail
  }
  if (opts.help) {
    usage()
    return EXIT.ok
  }
  if (opts.selfTest) return selfTest()
  return runCheck(opts)
}

const isDirectRun = Boolean(process.argv[1]) && pathToFileURL(process.argv[1]).href === import.meta.url
if (isDirectRun) {
  process.exitCode = await main(process.argv.slice(2))
}

export { main }
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
