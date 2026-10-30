#!/usr/bin/env node
// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * publish-mobile-apk.mjs — 把 mobile-rn release APK 发到固定的公网地址(2026-10-29 立)
 *
 * 固定地址(用户永远用这一条,不再跟着版本号换):
 *   https://www.aizhs.top/remote-images/download/ihui-ai-latest.apk   (站点 CDN 腿,EdgeOne,国内实测 1–4 MB/s)
 *
 * 为什么只剩一条腿:COS/CF 备用腿(dl.aizhs.top → 腾讯云 COS 桶 ihui-download-1367022840)已于
 * 2026-10-30 整桶下线。它按外网下行流量计费(0.5 元/GB),建桶当天被下载 3.48GB 就扣了 1.54 元
 * 并把账户打成欠费;而它本身只是冗余(实测国内 3–6 KB/s,比站点腿慢两个数量级)。站点腿同文件
 * 同字节且本月零扣费 —— 要再开第二条收费腿,先把这笔账算清。
 *
 * 为什么要这一步:出包脚本只管产出 app-release.apk,而"把包交到手机上"此前每次都要人工
 * 找地方传、再贴一条带版本号的地址(用户手里那条旧地址随后就失效)。现在出包链末尾直接
 * 落版本名副本 + 翻指针 ⇒ 链接恒定,版本信息走 `--version/--version-code`。
 *
 * 链路形状(2026-10-29 实测):
 *   站点腿:本机 → `deploy/server-root/remote-images/download/`(线上 cdn-server 的 --root)
 *           → EdgeOne → 用户。`…/ihui-ai-latest.apk` 不是实物文件,而是 cdn-server 读旁边
 *           `ihui-ai-latest.apk.redirect.json` 转出的 no-cache 302;真正被边缘长缓存的是带
 *           版本号那份(字节恒定才谈得上缓存)。
 *
 * latest 指针必须 `no-cache`:否则任一层把旧包缓存住,用户拿到的还是上一版,
 * 而页面/文件名看不出差别(与"线上版本标记会骗"同型)。带版本号的副本反过来给长缓存。
 *
 * 站点腿落点不写死盘符:经 scripts/seal-c-root-stray.mjs 的 devEnvRoot() 解析生产签出,
 * 两处都不存在 ⇒ exit 2 点名已试路径(静默跳过 = 对外地址停在旧包而账面是绿的)。
 *
 * 用法:
 *   node scripts/publish-mobile-apk.mjs --apk <path> --version 0.0.9 --version-code 26102816
 *   node scripts/publish-mobile-apk.mjs --apk <path> --version 0.0.9 --version-code 26102816 --dry-run
 *   node scripts/publish-mobile-apk.mjs --apk <path> --version 0.0.9 --version-code 26102816 --no-latest
 *
 * 退出码:0 成功 / 1 失败(落盘或公网自证不过) / 2 未判定(缺参数、APK 或站点落点取不到)
 */
import { createHash } from 'node:crypto'
import { copyFileSync, createReadStream, existsSync, statSync, writeFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'

import { devEnvRoot } from './seal-c-root-stray.mjs'

const HERE = dirname(fileURLToPath(import.meta.url))
const REPO = join(HERE, '..')

export const LATEST_KEY = 'ihui-ai-latest.apk'

/**
 * 站点 CDN 腿(2026-10-29 立,2026-10-30 起为唯一出口)。
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

function parseArgs(argv) {
  const out = { apk: '', version: '', versionCode: '', dryRun: false }
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i]
    if (a === '--apk') out.apk = argv[++i] ?? ''
    else if (a === '--version') out.version = argv[++i] ?? ''
    else if (a === '--version-code') out.versionCode = argv[++i] ?? ''
    else if (a === '--dry-run') out.dryRun = true
    else if (a === '--help' || a === '-h') out.help = true
    else throw new Error(`未知参数: ${a}`)
  }
  return out
}

async function main() {
  const args = parseArgs(process.argv.slice(2))
  if (args.help) {
    console.log('用法: node scripts/publish-mobile-apk.mjs --apk <path> --version <semver> --version-code <int> [--dry-run]')
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
  const size = statSync(args.apk).size
  const sha = await sha256File(args.apk)
  const plan = siteLegPlan()
  if (!plan.chosen) {
    console.error('未判定: 站点 CDN 落点不存在 ⇒ 固定地址不会更新,拒绝把发布报成成功')
    console.error('  已试: ' + plan.candidates.map((c) => `${c.source}=${c.dir}`).join(' | '))
    return 2
  }
  const vKey = versionKey(args.version, args.versionCode)

  const sizeMB = (size / 1048576).toFixed(1)
  console.log(`[publish] ${args.apk} (${sizeMB} MB, sha256=${sha.slice(0, 16)}…)`)
  console.log(`[publish]   站点腿 ${vKey}  →  ${siteLegUrl(vKey)}  (落点 ${plan.chosen.dir}, 取自 ${plan.chosen.source})`)
  console.log(`[publish]   站点腿固定地址指针 ${LATEST_KEY}.redirect.json → ${siteLegUrl(LATEST_KEY)}`)

  if (args.dryRun) {
    console.log('[publish] --dry-run: 只打印计划,未落盘')
    return 0
  }

  // 版本名先落盘,指针最后翻(顺序反了等于把用户 302 到一个还不存在的文件)
  const site = publishSiteLeg({ apk: args.apk, dir: plan.chosen.dir, version: args.version, versionCode: args.versionCode, sha256: sha, size })
  console.log(`[publish] ✓ 站点腿 ${site.vKey} (${(statSync(site.target).size / 1048576).toFixed(1)} MB, 回读一致)`)
  console.log(`[publish] ✓ 指针已翻 → ${site.pointer.url}`)
  const live = await verifySiteLegLive({ expectSize: size, expectVersionCode: args.versionCode })
  console.log(`[publish] ✓ 公网自证 HTTP ${live.status} content-range 大小 ${live.size} → ${live.location}`)

  console.log(`\n下载地址(固定): ${siteLegUrl(LATEST_KEY)}`)
  console.log(`本次版本副本: ${siteLegUrl(vKey)}`)
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
  siteLegUrl,
  siteLegPlan,
  publishSiteLeg,
  verifySiteLegLive,
  sha256File,
  SITE_LEG,
  LATEST_KEY,
}
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
