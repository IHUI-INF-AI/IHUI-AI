#!/usr/bin/env node
// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * gen-miniapp-code.mjs — 生成**微信小程序码**并自证它是不是真码(2026-11-03 立)
 *
 * 为什么要有这一条:下载栏里微信小程序一直是唯一"没有机器可读发布源"的端,而仓库里
 * `apps/web/public/images/common/miniapp-qr.png` 是一个 **11 字节的空占位文件**(被 git 跟踪,
 * `apps/web/app/image-sitemap.xml/route.ts` 自己注明"11 字节的空文件")⇒ 设置页的
 * `MiniappQrCard.tsx` 一直在给用户渲染一张坏图,而下载栏只能写"即将上线"。
 *
 * 这一步同时解决两件事:
 *  1. 调微信官方接口取真码(凭据走既有 env,绝不打印值);
 *  2. **接口自己就是那一端"上线没有"的机器可读判据** —— 未发布/无权限会回 errcode,
 *     那比我在页面上猜"即将上线"诚实得多;拿到 PNG 才算这一端真的接上。
 *
 * 失败方向:任何一步取不到真码 ⇒ 不写盘、非零退出、点名 errcode/原因(§0.3 不冒绿);
 * 尤其禁止把上一次的旧图当"取到了"(坏图 11 字节与真码 60KB 差两个数量级,按字节判)。
 *
 * 用法:
 *   node scripts/gen-miniapp-code.mjs --out <path> [--page pages/index/index] [--scene dl] [--dry-run]
 *   node scripts/gen-miniapp-code.mjs --check-only        # 只验端点通不通,不写盘
 *   node scripts/gen-miniapp-code.mjs --self-test
 * 退出码:0 取到并落地 / 1 写入失败 / 2 未判定(缺凭据、接口报错、返回不是够大的图片)
 */
import { existsSync, mkdirSync, readFileSync, statSync, writeFileSync } from 'node:fs'
import { createRequire } from 'node:module'
import { dirname, join } from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'

export const MIN_QR_BYTES = 2048
export const TOKEN_URL = 'https://api.weixin.qq.com/cgi-bin/token'
export const QRCODE_URL = 'https://api.weixin.qq.com/wxa/getwxacodeunlimit'
export const DEFAULT_PAGE = 'pages/index/index'
/** 凭据回退读取面(顺序固定:仓根 → api 端),只为"取不到就未判定"多一次机会,不猜值 */
export const DEFAULT_ENV_FILES = ['D:/IHUI-AI/.env', 'D:/IHUI-AI/apps/api/.env']
export const DEFAULT_SCENE = 'dl'

/** 只报形状与长度,永不回显值 */
function describeSecret(v) {
  const s = typeof v === 'string' ? v.trim() : ''
  return s === '' ? '缺失' : `已配置(len=${s.length})`
}

/** 微信这几类是"暂时打不通"(限流/系统忙/token 过期)⇒ 未判定;其余 errcode 是确定性拒绝 */
export const TRANSIENT_ERRCODES = new Set([-1, 40001, 42001, 45009, 45011, 45015])

/**
 * 纯判据:access_token 响应。
 * 微信把错误也回成 200 + JSON ⇒ 必须读 body 而不是只看状态码。
 * 分档(§0.3 三态不并桶):限流/系统忙 ⇒ undetermined(说不出这一端上线没有);
 * 凭证/权限/参数类 errcode ⇒ unavailable(有输入、判据不命中 = 这一端确实还没法出码)。
 */
export function judgeTokenBody(text) {
  let doc = null
  try {
    doc = JSON.parse(String(text))
  } catch {
    return { state: 'undetermined', reason: 'token-body-not-json' }
  }
  if (doc === null || typeof doc !== 'object') return { state: 'undetermined', reason: 'token-body-shape' }
  if (doc.errcode) {
    const code = Number(doc.errcode)
    return {
      state: TRANSIENT_ERRCODES.has(code) ? 'undetermined' : 'unavailable',
      reason: `token-errcode-${code}:${String(doc.errmsg ?? '').slice(0, 60)}`,
    }
  }
  const t = typeof doc.access_token === 'string' ? doc.access_token.trim() : ''
  if (t === '') return { state: 'unavailable', reason: 'token-empty-without-errcode' }
  return { state: 'ok', token: t, expiresIn: Number(doc.expires_in ?? 0) }
}

/**
 * 纯判据:小程序码响应。
 * 成功 = 二进制图片(content-type 非 JSON 且字节够大);失败 = 200 + JSON errcode。
 * 低于 MIN_QR_BYTES 一律不认 —— 仓里那张坏占位图正是 11 字节,按"存在"判会把它当成功。
 */
export function judgeQrResponse({ contentType, bytes }) {
  const size = Number(bytes)
  const ct = String(contentType ?? '')
  if (!Number.isFinite(size) || size < MIN_QR_BYTES) {
    return { state: 'unavailable', reason: `qr-too-small:${size}B(<${MIN_QR_BYTES}B,不是真码)` }
  }
  if (ct.includes('json') || ct.includes('text')) {
    return { state: 'unavailable', reason: `qr-body-is-json-error:${ct}` }
  }
  if (!ct.startsWith('image/')) {
    return { state: 'undetermined', reason: `qr-content-type-unexpected:${ct || '(空)'}` }
  }
  return { state: 'ok', size, contentType: ct }
}

/** 纯判据:盘上已有文件算不算一张可用的码 */
export function judgeExistingQr({ exists, size }) {
  if (!exists) return { state: 'unavailable', reason: 'qr-file-missing' }
  if (!(size >= MIN_QR_BYTES)) return { state: 'unavailable', reason: `qr-file-stub:${size}B(<${MIN_QR_BYTES}B)` }
  return { state: 'ok', size }
}

function parseArgs(argv) {
  const o = { out: null, page: DEFAULT_PAGE, scene: DEFAULT_SCENE, dryRun: false, checkOnly: false, help: false }
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i]
    if (a === '--out') o.out = argv[++i]
    else if (a === '--page') o.page = argv[++i]
    else if (a === '--scene') o.scene = argv[++i]
    else if (a === '--check-only') o.checkOnly = true
    else if (a === '--dry-run') o.dryRun = true
    else if (a === '--help' || a === '-h') o.help = true
    else throw new Error(`未知参数:${a}`)
  }
  return o
}

/**
 * 凭据来源:进程 env 优先,否则读仓根 / apps/api 的 .env(纯解析,不打印值)。
 * 与"调用方不得传 --env-file"那条不冲突:那是发信腿的规矩,这里读的是自己进程的
 * 既有配置面;取不到就未判定,绝不猜。
 */
export function resolveMiniCredentials(
  env = process.env,
  candidates = DEFAULT_ENV_FILES,
  readText = (p) => readFileSync(p, 'utf-8'),
  exists = existsSync,
) {
  const pick = (name) => String(env[name] ?? '').trim()
  const merged = { appid: pick('WX_MINI_APPID'), secret: pick('WX_MINI_SECRET'), from: 'process.env' }
  if (merged.appid && merged.secret) return merged
  for (const f of candidates) {
    if (!f || !exists(f)) continue
    let text = ''
    try {
      text = readText(f)
    } catch {
      continue
    }
    const grab = (name) => {
      const m = text.match(new RegExp(`^\\s*${name}\\s*=\\s*(.*)$`, 'm'))
      return m ? String(m[1]).trim().replace(/^["']|["']$/g, '') : ''
    }
    const appid = merged.appid || grab('WX_MINI_APPID')
    const secret = merged.secret || grab('WX_MINI_SECRET')
    if (appid && secret) return { appid, secret, from: f }
  }
  return { appid: merged.appid, secret: merged.secret, from: 'none' }
}

function usage() {
  return [
    '用法: node scripts/gen-miniapp-code.mjs --out <path> [--page pages/index/index] [--scene dl]',
    '      node scripts/gen-miniapp-code.mjs --check-only   # 只问接口那一端上线没有,不写盘',
    '凭据: WX_MINI_APPID / WX_MINI_SECRET(env 必填;值永不打印,只报长度)',
  ].join('\n')
}

/** 取 access_token:微信的 token 接口要求 appid/secret 走 query —— 所以整条 URL 绝不打印 */
async function fetchToken(env, fetchImpl, deps = {}) {
  const cred = (deps.resolveMiniCredentials ?? resolveMiniCredentials)(env)
  if (cred.appid === '' || cred.secret === '') {
    return {
      state: 'unavailable',
      reason: `credentials-missing(appid=${describeSecret(cred.appid)} secret=${describeSecret(cred.secret)} 读过=${cred.from})`,
    }
  }
  try {
    const url = `${TOKEN_URL}?grant_type=client_credential&appid=${encodeURIComponent(cred.appid)}&secret=${encodeURIComponent(cred.secret)}`
    const res = await fetchImpl(url, { signal: AbortSignal.timeout(20000) })
    return judgeTokenBody(await res.text())
  } catch (e) {
    return { state: 'unavailable', reason: `token-fetch-failed:${String(e?.message ?? e).slice(0, 80)}` }
  }
}

async function fetchQr(token, args, fetchImpl) {
  try {
    const res = await fetchImpl(`${QRCODE_URL}?access_token=${encodeURIComponent(token)}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ page: args.page, scene: args.scene, check_path: false, env_version: 'release', width: 280 }),
      signal: AbortSignal.timeout(30000),
    })
    const ct = String(res.headers.get('content-type') ?? '')
    const buf = Buffer.from(await res.arrayBuffer())
    // 微信失败时回 JSON(带 errcode),成功回二进制 —— 两种都要能被 judge 分清
    const probe = judgeQrResponse({ contentType: ct, bytes: buf.length })
    const detail = probe.state === 'ok' ? '' : buf.toString('utf-8').slice(0, 160)
    return { ...probe, buffer: probe.state === 'ok' ? buf : null, detail }
  } catch (e) {
    return { state: 'unavailable', reason: `qr-fetch-failed:${String(e?.message ?? e).slice(0, 80)}`, buffer: null, detail: '' }
  }
}

/** 纯判据:目标文件名的扩展名与实际字节格式是否同形(不同形 ⇒ 需要转码,不是"随便叫什么都行") */
export function judgeFormatAlignment({ ext, contentType }) {
  const e = String(ext ?? '').toLowerCase().replace(/^\./, '')
  const ct = String(contentType ?? '').toLowerCase()
  const actual = ct.includes('png') ? 'png' : ct.includes('jpeg') || ct.includes('jpg') ? 'jpg' : ''
  if (!actual) return { need: 'unknown', actual }
  const want = e === 'jpeg' ? 'jpg' : e
  return { need: want === actual ? 'none' : 'transcode', actual, want }
}

/**
 * 把接口返回的字节整成与目标文件名同形的形态。
 * 微信 `getwxacodeunlimit` 回的是 **image/jpeg** —— 直接写进 `.png` 就是又造出一格
 * "标签与实物不符"(与本票修掉的那批同一型)。所以要转码就转,转不了 ⇒ 未判定,绝不硬写。
 */
export async function normalizeToTargetFormat({ buffer, contentType, outPath, loadSharp }) {
  const ext = outPath.slice(outPath.lastIndexOf('.')).toLowerCase()
  const align = judgeFormatAlignment({ ext, contentType })
  if (align.need === 'none') return { state: 'ok', buffer, note: `格式与文件名同形(${align.actual})` }
  if (align.need === 'unknown') return { state: 'undetermined', reason: `格式判不出(content-type=${contentType || '(空)'})` }
  if (align.want !== 'png') {
    return { state: 'unavailable', reason: `需要 ${align.want} 但只会转 png,不硬写(${align.actual})` }
  }
  try {
    const sharp = await loadSharp()
    const out = await sharp(buffer).png().toBuffer()
    if (!pngSignatureOk(out)) return { state: 'unavailable', reason: 'transcode-output-not-png' }
    return { state: 'ok', buffer: out, note: `已由 ${align.actual} 转成 ${align.want}` }
  } catch (e) {
    return { state: 'undetermined', reason: `transcode-unavailable:${String(e?.message ?? e).slice(0, 70)}` }
  }
}

function pngSignatureOk(buf) {
  return Buffer.compare(buf.subarray(0, 8), Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a])) === 0
}
function jpegSignatureOk(buf) {
  return buf.length > 2 && buf[0] === 0xff && buf[1] === 0xd8
}

export function runSelfTest() {
  const cases = [
    ['token 正常', judgeTokenBody('{"access_token":"abc","expires_in":7200}').state, 'ok'],
    ['token errcode 也算取不到', judgeTokenBody('{"errcode":40013,"errmsg":"invalid appid"}').state, 'unavailable'],
    ['token 非 JSON', judgeTokenBody('<html>').state, 'undetermined'],
    ['真码 60KB', judgeQrResponse({ contentType: 'image/png', bytes: 61000 }).state, 'ok'],
    ['11 字节占位图必须被拒', judgeQrResponse({ contentType: 'image/png', bytes: 11 }).state, 'unavailable'],
    ['200 + JSON 错误体', judgeQrResponse({ contentType: 'application/json', bytes: 90 }).state, 'unavailable'],
    ['内容类型意外', judgeQrResponse({ contentType: 'application/octet-stream', bytes: 9000 }).state, 'undetermined'],
    ['盘上占位文件', judgeExistingQr({ exists: true, size: 11 }).state, 'unavailable'],
    ['盘上真码', judgeExistingQr({ exists: true, size: 60000 }).state, 'ok'],
    ['凭据:进程 env 齐 ⇒ 不外读', resolveMiniCredentials({ WX_MINI_APPID: 'wx1', WX_MINI_SECRET: 's' }, [], () => '').from, 'process.env'],
    [
      '凭据:env 缺 ⇒ 回退读文件',
      resolveMiniCredentials({ WX_MINI_APPID: '', WX_MINI_SECRET: '' }, ['X'], () => 'WX_MINI_APPID= wxA \nWX_MINI_SECRET="sB"\n', () => true).appid,
      'wxA',
    ],
    ['凭据:文件不在 ⇒ 不猜', resolveMiniCredentials({}, ['X'], () => 'WX_MINI_APPID= wxA', () => false).from, 'none'],
    ['凭据:两头都缺 ⇒ from=none', resolveMiniCredentials({}, [], () => '').from, 'none'],
    ['jpeg 字节挂 .png ⇒ 要转码', judgeFormatAlignment({ ext: '.png', contentType: 'image/jpeg' }).need, 'transcode'],
    ['jpeg 字节挂 .jpg ⇒ 同形', judgeFormatAlignment({ ext: '.jpg', contentType: 'image/jpeg' }).need, 'none'],
    ['png 字节挂 .png ⇒ 同形', judgeFormatAlignment({ ext: '.png', contentType: 'image/png' }).need, 'none'],
    ['类型判不出 ⇒ 不猜', judgeFormatAlignment({ ext: '.png', contentType: '' }).need, 'unknown'],
  ]
  let bad = 0
  for (const [name, got, want] of cases) {
    const ok = got === want
    if (!ok) bad += 1
    console.log(`  ${ok ? '✓' : '✗'} ${name} [判出 ${got}]`)
  }
  console.log(bad === 0 ? `self-test 通过(${cases.length} 例)` : `self-test 失败 ${bad} 例`)
  return bad === 0 ? 0 : 1
}

export async function main(argv = process.argv.slice(2), deps = {}) {
  if (argv.includes('--self-test')) return runSelfTest()
  const args = parseArgs(argv)
  if (args.help) {
    console.log(usage())
    return 0
  }
  const env = deps.env ?? process.env
  const fetchImpl = deps.fetchImpl ?? fetch
  const out = deps.out ?? ((m) => console.log(m))
  const err = deps.err ?? ((m) => console.error(m))

  const tok = await fetchToken(env, fetchImpl)
  if (tok.state !== 'ok') {
    err(`[miniapp] ✗ 未判定:access_token 取不到 —— ${tok.reason}`)
    return 2
  }
  out(`[miniapp] ✓ access_token 到手(expires_in=${tok.expiresIn}s;值不外泄)`)
  if (args.checkOnly || args.dryRun) {
    const probe = await fetchQr(tok.token, args, fetchImpl)
    out(`[miniapp] ${probe.state === 'ok' ? '✓' : '✗'} 端点判定:${probe.state}${probe.reason ? ` ${probe.reason}` : ''}${probe.detail ? ` | ${probe.detail}` : ''} ⇒ ${args.checkOnly ? '--check-only 不写盘' : 'dry-run 不写盘'}`)
    return probe.state === 'ok' ? 0 : 2
  }
  if (!args.out) {
    err('[miniapp] ✗ 用法错:写盘模式必须给 --out <path>(不猜落点)')
    return 2
  }
  const qr = await fetchQr(tok.token, args, fetchImpl)
  if (qr.state !== 'ok') {
    err(`[miniapp] ✗ 未判定:小程序码取不到 —— ${qr.reason}${qr.detail ? ` | ${qr.detail}` : ''}`)
    err('  这一端确实还没上线/无权限时,下载栏保持"未接入"是正确的,不得拿旧图冒充。')
    return 2
  }
  const norm = await (deps.normalizeToTargetFormat ?? normalizeToTargetFormat)({
    buffer: qr.buffer,
    contentType: qr.contentType,
    outPath: args.out,
    loadSharp:
      deps.loadSharp ??
      (() => {
        const req = createRequire(join(dirname(fileURLToPath(import.meta.url)), '..', 'package.json'))
        return req('sharp')
      }),
  })
  if (norm.state !== 'ok') {
    err(`[miniapp] ✗ 未判定:${norm.reason} ⇒ 不写盘(标签与实物不符的图,不发比发好)`)
    return 2
  }
  out(`[miniapp] ✓ 拿到小程序码 ${norm.buffer.length} B,${norm.note}`)
  if (!existsSync(dirname(args.out))) mkdirSync(dirname(args.out), { recursive: true })
  writeFileSync(args.out, norm.buffer)
  const back = statSync(args.out).size
  if (back !== norm.buffer.length) {
    err(`[miniapp] ✗ 回读大小不符:接口 ${norm.buffer.length} / 落盘 ${back} ⇒ 按失败处理`)
    return 1
  }
  const written = readFileSync(args.out)
  const sigOk = /\.png$/i.test(args.out) ? pngSignatureOk(written) : /\.jpe?g$/i.test(args.out) ? jpegSignatureOk(written) : true
  if (!sigOk) {
    err(`[miniapp] ✗ 落盘字节的签名与扩展名不符(写坏了)⇒ 按失败处理`)
    return 1
  }
  out(`[miniapp] ✓ 真码已落地 ${args.out}(${back} B,签名与扩展名一致)`)
  return 0
}

const isDirectRun = process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href
if (isDirectRun) {
  main().then((rc) => {
    process.exitCode = rc
  })
}

export const __test__ = {
  judgeTokenBody,
  judgeQrResponse,
  judgeExistingQr,
  resolveMiniCredentials,
  judgeFormatAlignment,
  normalizeToTargetFormat,
  runSelfTest,
  parseArgs,
  MIN_QR_BYTES,
}
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
