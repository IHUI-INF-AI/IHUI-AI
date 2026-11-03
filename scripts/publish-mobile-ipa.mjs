#!/usr/bin/env node
// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * publish-mobile-ipa.mjs — 把 iOS 的 `.ipa` 发到**自有站点腿**(2026-11-03 立)
 *
 * 为什么要这一条:`.ipa` 此前只在 GitHub Release 的固定 tag `ios-nightly` 上,而 GitHub 的
 * 资产下载域名是国内最慢/最不稳的一条腿(2026-11-02 实测:同一时刻 `api.github.com` 0.9s 秒回,
 * 资产下载 12s 超时 2/3 次)。Android 早在 2026-10-29 就换到了站点腿(EdgeOne 加速、国内实测
 * 1–4 MB/s),iOS 是同一下载栏里**唯一还挂在那条慢腿上的实物包**(42.8 MB,用户点一下就要等)。
 *
 * 机制与 Android **共用同一份实现**(AGENTS §0.6:同类判据全仓只许一份):
 *   版本名副本(7 天长缓存,字节不变才谈得上缓存)+ `ihui-ai-latest.ipa.redirect.json` 指针
 *   (cdn-server 读它转成 no-cache 302)⇒ "用户记一条地址"与"永远拿到最新包"同时成立。
 *   指针闸在 `deploy/cdn-server.js` 里按扩展名放行(`.apk|.ipa`),MIME 不加 `.ipa` 一条 ——
 *   `mimeFor` 默认落 `application/octet-stream`,正是要的形态。
 *
 * 版本号从哪来(**绝不编**):
 *   ① 显式 `--version/--build-number`;
 *   ② 同一 release 里的 `ios-version.json` 资产(由 CI 的 resolve-mobile-version 那一步产出);
 *   ③ 两者都没有 ⇒ **exit 2 未判定**,一个字节都不写。
 *      iOS 的 workflow 直到 2026-11-03 都没有 APK 那条"版本号与发布 tag 同源"的步骤,
 *      所以历史上那枚 `ios-nightly` 包**没有任何可自证的版本号** —— 宁可说"取不到",
 *      也不能在下载页与 `app_versions` 里写一个猜出来的号(那正是"两号对不上"那一型)。
 *
 * 自证走**本地源站**而不是公网:线上 cdn-server 只听 127.0.0.1:80,公网那条腿要过 EdgeOne/
 * Cloudflared 跨境段(2026-11-02 实测公网入口整段 45s 超时)。取指针必须验的是"我们的服务
 * 有没有正确转 302",不是"跨境段今天通不通"。公网那条另由只读哨兵量。
 *
 * 用法:
 *   node scripts/publish-mobile-ipa.mjs --ipa <path> --version 0.0.9 --build-number 26110301
 *   node scripts/publish-mobile-ipa.mjs --from-release [--tag ios-nightly] [--dry-run]
 *   node scripts/publish-mobile-ipa.mjs --help
 * 退出码:0 成功 / 1 发布或登记失败 / 2 用法错或**未判定**(取不到版本号、落点不存在、资产不在)
 */
import { existsSync, mkdirSync, readFileSync, rmSync, statSync, writeFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'

import {
  SITE_LEG,
  publishRegisterStep,
  publishSiteLeg,
  sha256File,
  siteLegPlan,
  siteLegUrl,
  verifySiteLegLive,
} from './publish-mobile-apk.mjs'
import { resolveKeyDir } from './lib/key-dir.mjs'

export const LATEST_IPA_KEY = 'ihui-ai-latest.ipa'
export const IPA_EXT = '.ipa'
export const IPA_ASSET_NAME = 'ihui-ai-latest.ipa'
export const VERSION_ASSET_NAME = 'ios-version.json'
export const DEFAULT_TAG = 'ios-nightly'
export const DEFAULT_REPO = 'IHUI-INF-AI/IHUI-AI'
/** 本地源站探针(线上 cdn-server 只听 127.0.0.1:80;见头注"自证走本地源站") */
export const LOCAL_ORIGIN = 'http://127.0.0.1:80'
export const LOCAL_PROBE_HOST = 'www.aizhs.top'

/** 指针落点(与 APK 同一序列,只是 latestKey/ext 不同) */
export function ipaSiteLegPlan(opts = {}) {
  return siteLegPlan(opts)
}

/**
 * 纯判据:release 文档里取安装包资产 + 版本自证资产。
 * 三态分开:文档不可用 / 有文档但没包 / 有包但没版本自证 ⇒ 各自原因码,不并桶。
 */
export function pickIpaReleaseAssets(doc) {
  if (doc === null || typeof doc !== 'object') return { state: 'undetermined', reason: 'release-doc-unreachable' }
  if (typeof doc.tag_name !== 'string') return { state: 'undetermined', reason: 'release-doc-shape' }
  const assets = Array.isArray(doc.assets) ? doc.assets : []
  const ipa = assets.find((a) => a && a.name === IPA_ASSET_NAME)
  if (!ipa) return { state: 'undetermined', reason: `ipa-asset-missing:${IPA_ASSET_NAME}` }
  const url = typeof ipa.browser_download_url === 'string' ? ipa.browser_download_url.trim() : ''
  if (url === '') return { state: 'undetermined', reason: 'ipa-asset-has-no-download-url' }
  const size = Number(ipa.size)
  if (!Number.isFinite(size) || size <= 0) return { state: 'undetermined', reason: `ipa-asset-size-unreadable:${String(ipa.size)}` }
  const versionAsset = assets.find((a) => a && a.name === VERSION_ASSET_NAME)
  const vUrl = versionAsset && typeof versionAsset.browser_download_url === 'string' ? versionAsset.browser_download_url : null
  return { state: 'ok', tag: doc.tag_name, url, size, versionAssetUrl: vUrl, publishedAt: String(doc.published_at || '') }
}

/**
 * 纯判据:`ios-version.json` → 可登记的版本号与构建号(接受已解析对象或原文两种形态)。
 * 要求 version 形如 X.Y.Z、buildNumber 为纯数字 —— 拿不到就 undetermined(不猜、不四舍五入)。
 */
export function judgeIpaVersionDoc(input) {
  let doc = null
  if (input !== null && typeof input === 'object') {
    doc = input
  } else {
    try {
      doc = JSON.parse(String(input))
    } catch {
      return { state: 'undetermined', reason: 'version-asset-not-json' }
    }
  }
  if (doc === null || typeof doc !== 'object') return { state: 'undetermined', reason: 'version-asset-shape' }
  const version = String(doc.version ?? '').trim()
  const buildNumber = String(doc.buildNumber ?? doc.versionCode ?? '').trim()
  if (!/^\d+\.\d+\.\d+$/.test(version)) {
    return { state: 'undetermined', reason: `version-asset-no-semver:${version || '(空)'}` }
  }
  if (!/^\d+$/.test(buildNumber)) {
    return { state: 'undetermined', reason: `version-asset-no-build-number:${buildNumber || '(空)'}` }
  }
  return { state: 'ok', version, buildNumber }
}

/** GitHub API 头:env 有 token 用 env;否则问单源凭据目录(值绝不进日志/正文) */
export function githubToken(env = process.env, readText = (p) => readFileSync(p, 'utf-8'), keyDir = resolveKeyDir) {
  const fromEnv = String(env.GITHUB_TOKEN ?? '').trim()
  if (fromEnv) return fromEnv
  try {
    const dir = keyDir('git仓库')
    if (!dir) return ''
    const file = join(dir, 'github key.txt')
    if (!existsSync(file)) return ''
    return String(readText(file)).trim()
  } catch {
    return ''
  }
}

function ghHeaders(token) {
  const h = { Accept: 'application/vnd.github+json', 'X-GitHub-Api-Version': '2022-11-28' }
  if (token) h.Authorization = `Bearer ${token}`
  return h
}

async function fetchBuffer(url, headers, fetchImpl) {
  const res = await fetchImpl(url, { headers, signal: AbortSignal.timeout(120000), redirect: 'follow' })
  if (!res.ok) throw new Error(`HTTP ${res.status} (${url.slice(0, 80)})`)
  return Buffer.from(await res.arrayBuffer())
}

/** 下载即校验:落盘大小必须等于 release API 报的 size,否则删掉不发布(账实不符不许留在腿上) */
export async function downloadIpaTo({ url, size, destDir, token, fetchImpl = fetch }) {
  if (!existsSync(destDir)) mkdirSync(destDir, { recursive: true })
  const dest = join(destDir, IPA_ASSET_NAME)
  const headers = {}
  if (token) headers.Authorization = `Bearer ${token}`
  const buf = await fetchBuffer(url, headers, fetchImpl)
  writeFileSync(dest, buf)
  const back = statSync(dest).size
  if (back !== size) {
    rmSync(dest, { force: true })
    throw new Error(`下载大小与 release API 不符: API ${size} / 落盘 ${back} ⇒ 已删除,不发布`)
  }
  return { file: dest, size: back }
}

/** 本地源站探针用的 fetch(带 Host 头,与公网请求头一致;失败原样抛给调用方) */
export function makeLocalProbeFetch(baseFetch = fetch) {
  return async (url, init = {}) => {
    const headers = { ...(init.headers || {}), Host: LOCAL_PROBE_HOST }
    return baseFetch(url, { ...init, headers })
  }
}

export function parseArgs(argv) {
  const out = {
    mode: null,
    ipa: null,
    version: null,
    buildNumber: null,
    tag: DEFAULT_TAG,
    repo: process.env.GITHUB_REPOSITORY || DEFAULT_REPO,
    dryRun: false,
    help: false,
  }
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i]
    if (a === '--from-release') out.mode = 'release'
    else if (a === '--ipa') out.mode = 'file', (out.ipa = argv[++i])
    else if (a === '--version') out.version = argv[++i]
    else if (a === '--build-number') out.buildNumber = argv[++i]
    else if (a === '--tag') out.tag = argv[++i]
    else if (a === '--dry-run') out.dryRun = true
    else if (a === '--help' || a === '-h') out.help = true
    else throw new Error(`未知参数:${a}`)
  }
  return out
}

function usage() {
  return [
    '用法: node scripts/publish-mobile-ipa.mjs --ipa <path> --version X.Y.Z --build-number <纯数字>',
    '      node scripts/publish-mobile-ipa.mjs --from-release [--tag ios-nightly] [--dry-run]',
    '',
    '说明:',
    `  站点腿固定地址: ${siteLegUrl(LATEST_IPA_KEY)}`,
    '  版本号必须来自显式参数或同 release 的 ios-version.json;两者都缺 ⇒ exit 2 未判定,一个字节都不写。',
    '  自证走本地源站 http://127.0.0.1:80(带 Host: www.aizhs.top),不依赖跨境公网段。',
  ].join('\n')
}

export async function main(argv = process.argv.slice(2), deps = {}) {
  const args = parseArgs(argv)
  if (args.help) {
    console.log(usage())
    return 0
  }
  const env = deps.env ?? process.env
  const fetchImpl = deps.fetchImpl ?? fetch
  const out = deps.out ?? ((m) => console.log(m))
  const err = deps.err ?? ((m) => console.error(m))

  let file = args.ipa
  let version = args.version
  let buildNumber = args.buildNumber
  let size = null

  if (args.mode === 'release') {
    const token = (deps.githubToken ?? githubToken)(env)
    const doc = await fetchJsonOrNull(
      `https://api.github.com/repos/${args.repo}/releases/tags/${args.tag}`,
      ghHeaders(token),
      fetchImpl,
    )
    const picked = pickIpaReleaseAssets(doc)
    if (picked.state !== 'ok') {
      err(`[ipa] ✗ 未判定:${picked.reason} —— 不发布(宁缺勿假,§0.3)`)
      return 2
    }
    if (!picked.versionAssetUrl) {
      if (!version || !buildNumber) {
        err(
          `[ipa] ✗ 未判定:release ${picked.tag} 里没有 ${VERSION_ASSET_NAME},而本进程也没拿到显式 --version/--build-number\n` +
            '          ⇒ 版本号无处自证。补法二选一:① 在 iOS 构建链加 resolve-mobile-version 并上传该资产;' +
            '② 显式传 --version X.Y.Z --build-number <纯数字>。',
        )
        return 2
      }
    } else {
      const vdoc = await fetchJsonOrNull(picked.versionAssetUrl, token ? { Authorization: `Bearer ${token}` } : {}, fetchImpl)
      const judged = judgeIpaVersionDoc(vdoc)
      if (judged.state !== 'ok') {
        err(`[ipa] ✗ 未判定:${judged.reason} —— 不发布`)
        return 2
      }
      version = version ?? judged.version
      buildNumber = buildNumber ?? judged.buildNumber
    }
    if (args.dryRun) {
      out(`[ipa] dry-run:将下载 ${IPA_ASSET_NAME}(${picked.size} B)并落站点腿,版本=${version ?? '(未判定)'} 构建=${buildNumber ?? '(未判定)'}`)
      return 0
    }
    const dlDir = deps.dlDir ?? join(REPO_DIR, '.ihui-agent', 'tmp', 'ios-ipa-relay')
    let got
    try {
      got = await (deps.downloadIpaTo ?? downloadIpaTo)({
        url: picked.url,
        size: picked.size,
        destDir: dlDir,
        token,
        fetchImpl,
      })
    } catch (e) {
      // 取包失败(跨境段超时/DNS/断网)= **取不到输入**,不是"腿坏了"也不是"没发布成"——
      // 归未判定,让调度器按持续时长决定要不要喊人(§0.3;瞬时网络失败每轮喊一次就是噪声)
      err(`[ipa] ✗ 未判定:release 资产取不到 —— ${String(e?.message ?? e).slice(0, 200)}`)
      return 2
    }
    file = got.file
    size = got.size
    out(`[ipa] 取到 ${file}(${size} B,与 release API 同字节)`)
  } else if (args.mode === 'file') {
    if (!file || !existsSync(file)) {
      err(`[ipa] ✗ --ipa 指向的文件不存在:${String(file)}`)
      return 2
    }
    if (!version || !buildNumber) {
      err('[ipa] ✗ 用法错:--ipa 模式必须同时给 --version 与 --build-number(不许把包发到一个没有版本号的指针上)')
      return 2
    }
    size = statSync(file).size
    if (args.dryRun) {
      out(`[ipa] dry-run:将把 ${file}(${size} B)发到站点腿,版本=${version} 构建=${buildNumber}`)
      return 0
    }
  } else {
    err(usage())
    return 2
  }

  const plan = (deps.ipaSiteLegPlan ?? ipaSiteLegPlan)({ env })
  const dir = plan.envOverride ?? plan.chosen?.dir
  if (!dir || !existsSync(dir)) {
    err(
      `[ipa] ✗ 站点腿落点不存在 ⇒ 未判定(绝不回落主仓影子目录)。已试:${plan.candidates.map((c) => `${c.source}:${c.dir}`).join(' / ')}`,
    )
    return 2
  }
  const sha256 = await (deps.sha256File ?? sha256File)(file)
  const pub = (deps.publishSiteLeg ?? publishSiteLeg)({
    apk: file,
    dir,
    version,
    versionCode: buildNumber,
    sha256,
    size,
    latestKey: LATEST_IPA_KEY,
    ext: 'ipa',
  })
  out(`[ipa] ✓ 版本副本已落地 ${pub.vKey}(${size} B)并翻指针 ${pub.pointerPath}`)

  const verdict = await (deps.verifySiteLegLive ?? verifySiteLegLive)({
    latestKey: LATEST_IPA_KEY,
    latestUrl: `${(deps.localOrigin ?? LOCAL_ORIGIN)}${SITE_LEG.UrlPrefix}/${LATEST_IPA_KEY}`,
    expectSize: size,
    expectVersionCode: buildNumber,
    ext: IPA_EXT,
    contentTypeNeedle: 'octet-stream',
    expectLabel: 'ipa',
    fetchImpl: (deps.makeLocalProbeFetch ?? makeLocalProbeFetch)(fetchImpl),
  })
  out(`[ipa] ✓ 本地源站自证:302 → ${verdict.location.slice(0, 70)}… 大小 ${verdict.size}`)

  const reg = await (deps.publishRegisterStep ?? publishRegisterStep)({
    version,
    versionCode: buildNumber,
    platform: 'ios',
    latestKey: LATEST_IPA_KEY,
    env,
    out,
    err,
  })
  if (!reg.ok) return 1
  out(`[ipa] ✓ 登记腿 ${reg.status}`)
  return 0
}

async function fetchJsonOrNull(url, headers, fetchImpl) {
  try {
    const res = await fetchImpl(url, { headers, signal: AbortSignal.timeout(30000) })
    if (!res.ok) return null
    return await res.json()
  } catch {
    return null
  }
}

const HERE = dirname(fileURLToPath(import.meta.url))
const REPO_DIR = join(HERE, '..')

const isDirectRun = process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href
if (isDirectRun) {
  main()
    .then((rc) => {
      process.exitCode = rc
    })
    .catch((e) => {
      console.error(`❌ ${e?.message ?? e}\n${e?.stack ?? ''}`)
      process.exitCode = 1
    })
}

export const __test__ = {
  pickIpaReleaseAssets,
  judgeIpaVersionDoc,
  githubToken,
  downloadIpaTo,
  makeLocalProbeFetch,
  parseArgs,
  LATEST_IPA_KEY,
  IPA_EXT,
  IPA_ASSET_NAME,
  VERSION_ASSET_NAME,
  LOCAL_ORIGIN,
  LOCAL_PROBE_HOST,
}
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
