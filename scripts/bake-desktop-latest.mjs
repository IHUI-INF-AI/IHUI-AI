#!/usr/bin/env node
// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * bake-desktop-latest.mjs — 把 Release 的 latest.json 烘焙进桌面更新器第一数据源(G-922)。
 *
 * 背景:apps/web/src/config/desktop-latest.generated.ts 此前靠人手 1:1 抄 latest.json;
 * 版本、签名、Windows 直链三处任意漂移都会让 /desktop-feed.json 吐旧版或"Gitee 新包 + GitHub
 * 旧签名",自动更新静默失效。本器把发布清单第 5 步收成一条命令。
 *
 * 唯一允许的改写:platforms.<任一平台>.url → Gitee 国内主通道直链,且**仅当** Gitee 直链
 * HEAD Content-Length 与 GitHub 同名资产 size 字节相等。字节不等/量不到 ⇒ 保留 GitHub 并
 * 大声报原因(同名不同物:0.1.75 实测差 4,173 字节 ⇒ 下载成功但验签必失败)。
 * 判据本体复用 scripts/resolve-desktop-download.mjs 的 giteeBytesVerdict(唯一实现,不另抄)。
 *
 * 用法:
 *   node scripts/bake-desktop-latest.mjs --latest-json <path> [--tag desktop-vX.Y.Z]
 *     --all-platforms [--gitee-owner O] [--gitee-repo R] [--out path] [--check]
 *   node scripts/bake-desktop-latest.mjs --latest-json <path> [--tag desktop-vX.Y.Z]
 *     [--github-size N] [--gitee-size N] [--gitee-url URL] [--out path] [--check]
 *   node scripts/bake-desktop-latest.mjs --assets-from-feed [--out feed 路径]
 *     [--assets-out scripts/data/desktop-update-assets.json] [--tag desktop-vX.Y.Z] [--check]
 *
 *   桌面安装包 size/sha256 权威元数据(2026-11-05 立):`--all-platforms` 烘焙 feed 时同批产出
 *   scripts/data/desktop-update-assets.json;`--assets-from-feed` 可单独重算(只读 feed,不改它)。
 *   sha256 一律取 GitHub Release 资产的 digest(权威且无需下载整包),Gitee 直链再按字节数对账。
 *   --all-platforms  国内主通道模式:一次 Releases API 取全部 GitHub 资产 size,逐平台构造
 *                    Gitee 直链并 HEAD 对账;只有字节相等的平台改写,其余保留 GitHub + 告警。
 *   --check  只读:把 latest.json 的期望对象与现有烘焙文件逐字段比对;一致 exit 0,漂移 exit 1,
 *            取不到判定输入 exit 2(§0.3:不记绿也不冒红)。
 *
 * 网络:未给 --github-size 时问 GitHub API(可用 GITHUB_TOKEN / GITHUB_REPOSITORY);
 *       未给 --gitee-size 时对 Gitee URL 做 HEAD,缺 Content-Length 再 Range GET 取 total。
 *       Gitee URL 未给时,从现有烘焙文件的 Windows URL 派生(同 owner/repo,换 tag 与资产名)。
 */
import { existsSync, readFileSync, writeFileSync } from 'node:fs'
import { dirname, resolve } from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'
import { spawnSync } from 'node:child_process'
import { giteeBytesVerdict } from './resolve-desktop-download.mjs'
// G-322:带值旗标的**唯一取值出口**(值必须存在且不以 `-` 开头,否则判死,绝不折回默认)。
import { requireFlagValue } from './lib/flag-value.mjs'

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..')
const DEFAULT_OUT = resolve(ROOT, 'apps/web/src/config/desktop-latest.generated.ts')
/** 桌面安装包 size/sha256 权威元数据落点(随仓库提交,部署链生成清单时直接读,不联网)。 */
const DEFAULT_ASSETS_OUT = resolve(ROOT, 'scripts/data/desktop-update-assets.json')
const MARKER = 'export const DESKTOP_LATEST'
const PLATFORM = 'windows-x86_64'

/** 从生成的 TS 里取出 DESKTOP_LATEST 对象(纯 JSON;尾部水印行不影响)。 */
export function extractGeneratedObject(text) {
  const at = String(text ?? '').indexOf(MARKER)
  if (at < 0) return null
  const start = String(text).indexOf('{', at)
  if (start < 0) return null
  let depth = 0
  let inStr = false
  let esc = false
  for (let i = start; i < text.length; i += 1) {
    const ch = text[i]
    if (inStr) {
      if (esc) esc = false
      else if (ch === '\\') esc = true
      else if (ch === '"') inStr = false
      continue
    }
    if (ch === '"') inStr = true
    else if (ch === '{') depth += 1
    else if (ch === '}') {
      depth -= 1
      if (depth === 0) {
        try {
          return JSON.parse(text.slice(start, i + 1))
        } catch {
          return null
        }
      }
    }
  }
  return null
}

/** 从现有 Gitee Windows URL 派生新版本 URL:owner/repo 不变,tag 与资产名换新。 */
export function deriveGiteeUrl({ existingUrl, tag, assetName }) {
  if (!existingUrl || !tag || !assetName) return null
  let u
  try {
    u = new URL(existingUrl)
  } catch {
    return null
  }
  if (u.hostname !== 'gitee.com') return null
  const parts = u.pathname.split('/').filter(Boolean)
  // <owner>/<repo>/releases/download/<oldTag>/<oldAsset>
  if (parts.length < 5 || parts[2] !== 'releases' || parts[3] !== 'download') return null
  return `${u.origin}/${parts[0]}/${parts[1]}/releases/download/${encodeURIComponent(tag)}/${encodeURIComponent(assetName)}`
}

/** 构造 Gitee 直链:owner/repo 由调用方显式给出,不依赖“旧文件里先有一条 Gitee 直链”。 */
export function buildGiteeUrl({ owner, repo, tag, assetName }) {
  if (!owner || !repo || !tag || !assetName) return null
  return `https://gitee.com/${owner}/${repo}/releases/download/${encodeURIComponent(tag)}/${encodeURIComponent(assetName)}`
}

/** 从任意下载直链里取资产名(URL 编码还原);解析不出返回空串。 */
export function assetNameOf(url) {
  try {
    return decodeURIComponent(new URL(String(url)).pathname.split('/').pop() || '')
  } catch {
    return ''
  }
}

const SHA256_DIGEST_RE = /^sha256:([0-9a-f]{64})$/

/**
 * 从更新源(feed)与 Release 资产表构造「桌面安装包权威条目」(2026-11-05 立)。
 * 只认 GitHub Release 资产自带的 digest(sha256)与 size —— 这是唯一可核对、无需下载整包的权威来源;
 * 若该平台 URL 已改成 Gitee 直链,还必须再用 Gitee HEAD 字节数与 GitHub size 对账一致。
 * 任一资产缺 digest / size、或 Gitee 字节不等 ⇒ issues 非空,调用方必须中止(绝不落半份元数据)。
 */
export function buildDesktopAssets({ feed, githubAssets, giteeSizes, version, tag }) {
  const readAsset = (name) => {
    const a = githubAssets instanceof Map ? githubAssets.get(name) : githubAssets?.[name]
    return { size: Number(a?.size || 0), digest: String(a?.digest || '') }
  }
  const readGitee = (name) => Number((giteeSizes instanceof Map ? giteeSizes.get(name) : giteeSizes?.[name]) || 0)
  const platforms = Object.entries(feed?.platforms ?? {})
  const assets = []
  const issues = []
  const seen = new Set()
  for (const [key, entry] of platforms) {
    const url = typeof entry?.url === 'string' ? entry.url : ''
    const name = assetNameOf(url)
    if (!name || seen.has(name)) continue
    seen.add(name)
    const gh = readAsset(name)
    const m = SHA256_DIGEST_RE.exec(gh.digest)
    if (!m) {
      issues.push({
        code: 'desktop_asset_digest_missing',
        path: name,
        message: `${key}:GitHub 资产 ${name} 缺 sha256 digest(实际 ${JSON.stringify(gh.digest)})⇒ 不得落元数据`,
      })
      continue
    }
    if (!Number.isInteger(gh.size) || gh.size <= 0) {
      issues.push({
        code: 'desktop_asset_size_missing',
        path: name,
        message: `${key}:GitHub 资产 ${name} 缺 size(实际 ${gh.size})⇒ 不得落元数据`,
      })
      continue
    }
    let giteeSizeVerified = null
    try {
      if (new URL(url).hostname === 'gitee.com') {
        const ge = readGitee(name)
        const verdict = giteeBytesVerdict(gh.size, ge)
        if (verdict !== 'same') {
          issues.push({
            code: 'desktop_asset_gitee_size_mismatch',
            path: name,
            message: `${key}:Gitee 直链 ${name} 字节与 GitHub 原件不对账(GitHub ${gh.size} B / Gitee ${ge || '量不到'})⇒ 客户端按此 sha256 校验必失败`,
          })
          continue
        }
        giteeSizeVerified = true
      }
    } catch {
      issues.push({
        code: 'desktop_asset_url_invalid',
        path: name,
        message: `${key}:更新源 url 非法 ${JSON.stringify(url)}(资产 ${name})`,
      })
      continue
    }
    assets.push({
      name,
      size: gh.size,
      sha256: m[1],
      url,
      source: 'github-release-digest',
      giteeSizeVerified,
    })
  }
  assets.sort((a, b) => a.name.localeCompare(b.name))
  return { assets, issues, version: String(version || ''), tag: String(tag || '') }
}

/** 序列化权威元数据:键序/资产序固定 ⇒ 同输入两次输出逐字节一致(可 --check)。 */
export function serializeDesktopAssets({ version, tag, assets }) {
  const payload = {
    schemaVersion: 1,
    generatedBy: 'scripts/bake-desktop-latest.mjs --assets-from-feed',
    source: 'github-release-digest',
    version: String(version || ''),
    tag: String(tag || ''),
    assets: (assets ?? []).map((a) => ({
      name: a.name,
      size: a.size,
      sha256: a.sha256,
      url: a.url,
      source: a.source,
      giteeSizeVerified: a.giteeSizeVerified ?? null,
    })),
  }
  return `${JSON.stringify(payload, null, 2)}\n`
}

/** --check 的资产元数据判定:只比数据,不比空白;解析不出/缺文件都算漂移。 */
export function checkAssetsAgainstExisting({ existingText, expectedText }) {
  let existing
  try {
    existing = JSON.parse(String(existingText ?? ''))
  } catch {
    return { ok: false, reason: '现有权威元数据文件不存在或不是 JSON' }
  }
  let expected
  try {
    expected = JSON.parse(String(expectedText ?? ''))
  } catch {
    return { ok: false, reason: '期望元数据不是合法 JSON' }
  }
  const c = (x) => {
    if (Array.isArray(x)) return x.map(c)
    if (x && typeof x === 'object') return Object.fromEntries(Object.keys(x).sort().map((k) => [k, c(x[k])]))
    return x
  }
  if (JSON.stringify(c(existing)) === JSON.stringify(c(expected))) return { ok: true, reason: '一致' }
  const diffs = []
  if (existing.version !== expected.version) diffs.push(`version ${existing.version ?? '<缺>'} → ${expected.version ?? '<缺>'}`)
  const ev = new Map((existing.assets ?? []).map((a) => [a?.name, a]))
  const xv = new Map((expected.assets ?? []).map((a) => [a?.name, a]))
  for (const [n, a] of xv) {
    const e = ev.get(n)
    if (!e) diffs.push(`缺资产 ${n}`)
    else if (e.size !== a.size || e.sha256 !== a.sha256) diffs.push(`${n} size/sha256 不同`)
  }
  for (const n of ev.keys()) if (!xv.has(n)) diffs.push(`多出资产 ${n}`)
  return { ok: false, reason: diffs.join('; ') || '元数据有差异' }
}

/** 从已烘焙文件的首条 Gitee 直链里取 owner/repo;没有则 null(用于迁移期兼容)。 */
export function detectGiteeRepo(existing) {
  for (const p of Object.values(existing?.platforms ?? {})) {
    const u = p?.url
    if (typeof u !== 'string') continue
    try {
      const x = new URL(u)
      if (x.hostname !== 'gitee.com') continue
      const parts = x.pathname.split('/').filter(Boolean)
      if (parts.length >= 5 && parts[2] === 'releases' && parts[3] === 'download') {
        return { owner: parts[0], repo: parts[1] }
      }
    } catch {
      // 非 URL ⇒ 跳过
    }
  }
  return null
}

/** 纯函数:决定 Windows URL 归属,绝不静默改写。 */
export function bakeDesktopLatest({ latest, githubSize, giteeSize, giteeUrl }) {
  const data = JSON.parse(JSON.stringify(latest))
  const win = data?.platforms?.[PLATFORM]
  if (!win || typeof win.url !== 'string') {
    return { data, verdict: 'undetermined', reason: `latest.json 缺 platforms.${PLATFORM}.url ⇒ 不烘焙`, blocked: true }
  }
  const gh = Number(githubSize || 0)
  const ge = Number(giteeSize || 0)
  const verdict = giteeBytesVerdict(gh, ge)
  if (verdict === 'same' && giteeUrl) {
    win.url = giteeUrl
    return { data, verdict, reason: `Gitee 字节对账一致(GitHub ${gh} B / Gitee ${ge} B)⇒ Windows 直链改写为 Gitee`, blocked: false }
  }
  if (verdict === 'same') {
    return { data, verdict, reason: 'Gitee 字节对账一致但未给出 Gitee URL ⇒ 保留 GitHub(未判定)', blocked: false }
  }
  if (verdict === 'different') {
    return { data, verdict, reason: `Gitee 字节对账不一致(GitHub ${gh} B / Gitee ${ge} B)⇒ 保留 GitHub,禁止改写`, blocked: false }
  }
  return {
    data,
    verdict,
    reason: `Gitee 字节对账未判定(GitHub ${gh || '量不到'} / Gitee ${ge || '量不到'})⇒ 保留 GitHub`,
    blocked: false,
  }
}

/**
 * 全平台判据(国内主通道):platforms 里每个 URL 都先按资产名对账,
 * 「Gitee 存在且字节与 GitHub 原件一致」才改写;否则保留 GitHub 并逐条记原因。
 * 一个平台都不改也返回 changed=0(不是失败);只有 latest.json 完全没有 platforms 才 blocked。
 */
export function bakeDesktopPlatforms({ latest, tag, githubSizes, giteeSizes, owner, repo }) {
  const data = JSON.parse(JSON.stringify(latest))
  const decisions = {}
  let changed = 0
  const readSize = (map, name) => Number((map instanceof Map ? map.get(name) : map?.[name]) || 0)
  for (const [key, entry] of Object.entries(data?.platforms ?? {})) {
    const ghUrl = typeof entry?.url === 'string' ? entry.url : ''
    const assetName = assetNameOf(ghUrl)
    if (!assetName) {
      decisions[key] = { assetName: '', verdict: 'undetermined', url: ghUrl, reason: '平台缺 url ⇒ 保留原值' }
      continue
    }
    const gh = readSize(githubSizes, assetName)
    const ge = readSize(giteeSizes, assetName)
    const verdict = giteeBytesVerdict(gh, ge)
    const giteeUrl = buildGiteeUrl({ owner, repo, tag, assetName })
    if (verdict === 'same' && giteeUrl) {
      entry.url = giteeUrl
      changed += 1
      decisions[key] = { assetName, verdict, url: giteeUrl, reason: `字节一致(GitHub ${gh} B / Gitee ${ge} B)⇒ 改写 Gitee` }
      continue
    }
    if (verdict === 'same') {
      decisions[key] = { assetName, verdict, url: ghUrl, reason: '字节一致但缺 Gitee owner/repo ⇒ 保留 GitHub(未判定)' }
      continue
    }
    if (verdict === 'different') {
      decisions[key] = { assetName, verdict, url: ghUrl, reason: `字节不一致(GitHub ${gh} B / Gitee ${ge} B)⇒ 保留 GitHub,禁止改写` }
      continue
    }
    decisions[key] = {
      assetName,
      verdict,
      url: ghUrl,
      reason: `字节未判定(GitHub ${gh || '量不到'} / Gitee ${ge || '量不到'})⇒ 保留 GitHub`,
    }
  }
  const platformCount = Object.keys(data?.platforms ?? {}).length
  return { data, decisions, changed, blocked: platformCount === 0 }
}

const canon = (x) => {
  if (Array.isArray(x)) return x.map(canon)
  if (x && typeof x === 'object') return Object.fromEntries(Object.keys(x).sort().map((k) => [k, canon(x[k])]))
  return x
}

/** --check 的判定:只比数据对象,不把头部注释/水印算成漂移。 */
export function checkAgainstExisting({ existing, expected }) {
  if (!existing) return { ok: false, reason: '现有烘焙文件解析不出 DESKTOP_LATEST 对象' }
  if (JSON.stringify(canon(existing)) === JSON.stringify(canon(expected))) return { ok: true, reason: '一致' }
  const diffs = []
  if (existing.version !== expected.version) diffs.push(`version ${existing.version ?? '<缺>'} → ${expected.version ?? '<缺>'}`)
  for (const p of Object.keys(expected.platforms ?? {})) {
    const eu = existing.platforms?.[p]?.url
    const xu = expected.platforms[p]?.url
    if (eu !== xu) diffs.push(`${p} url ${eu ?? '<缺>'} → ${xu ?? '<缺>'}`)
    if (existing.platforms?.[p]?.signature !== expected.platforms[p]?.signature) diffs.push(`${p} signature 不同`)
  }
  return { ok: false, reason: diffs.join('; ') || '对象有差异' }
}

export function serializeGenerated(data) {
  return (
    '// AUTO-GENERATED — 由 scripts/bake-desktop-latest.mjs 从 Release 的 latest.json 烘焙。\n' +
    '// 用法与验收见 docs/RELEASE.md 发版流程第 5 步。\n' +
    "import type { DesktopFeedPayload } from './desktop-feed-payload'\n\n" +
    `export const DESKTOP_LATEST: DesktopFeedPayload = ${JSON.stringify(data, null, 2)}\n`
  )
}

async function fetchGithubAssetSize({ tag, assetName }) {
  const repo = process.env.GITHUB_REPOSITORY || 'IHUI-INF-AI/IHUI-AI'
  const token = process.env.GITHUB_TOKEN
  try {
    const res = await fetch(`https://api.github.com/repos/${repo}/releases/tags/${encodeURIComponent(tag)}`, {
      headers: { Accept: 'application/vnd.github+json', ...(token ? { Authorization: `Bearer ${token}` } : {}) },
    })
    if (!res.ok) return { size: null, reason: `GitHub API HTTP ${res.status}` }
    const rel = await res.json()
    const asset = (rel.assets || []).find((a) => a.name === assetName)
    return asset ? { size: Number(asset.size) || null, reason: '' } : { size: null, reason: 'Release 里找不到同名资产' }
  } catch (e) {
    return { size: null, reason: `GitHub API 不可达:${String(e?.message ?? e).slice(0, 120)}` }
  }
}

/** 一次 Releases API 取回整张资产表(name → {size, digest}),供 --all-platforms / 权威元数据烘焙对账。 */
async function fetchGithubAssetTable({ tag }) {
  const repo = process.env.GITHUB_REPOSITORY || 'IHUI-INF-AI/IHUI-AI'
  const token = process.env.GITHUB_TOKEN
  try {
    const res = await fetch(`https://api.github.com/repos/${repo}/releases/tags/${encodeURIComponent(tag)}`, {
      headers: { Accept: 'application/vnd.github+json', ...(token ? { Authorization: `Bearer ${token}` } : {}) },
    })
    if (!res.ok) return { assets: new Map(), reason: `GitHub API HTTP ${res.status}` }
    const rel = await res.json()
    const assets = new Map()
    for (const a of rel.assets || []) {
      const name = String(a?.name || '')
      const size = Number(a?.size || 0)
      const digest = String(a?.digest || '')
      if (name && size > 0) assets.set(name, { size, digest })
    }
    return { assets, reason: '' }
  } catch (e) {
    return { assets: new Map(), reason: `GitHub API 不可达:${String(e?.message ?? e).slice(0, 120)}` }
  }
}

/** 逐个 HEAD Gitee 直链取字节数(去重);取不到的资产不入表 ⇒ 对账自然落到 undetermined。 */
async function fetchGiteeSizes(urls) {
  const sizes = new Map()
  const notes = []
  for (const url of [...new Set(urls)]) {
    const assetName = assetNameOf(url)
    const r = await fetchGiteeSize(url)
    if (r.size) sizes.set(assetName, r.size)
    else if (r.reason) notes.push(`${assetName}:${r.reason}`)
  }
  return { sizes, notes }
}

async function fetchGiteeSize(url) {
  try {
    const head = await fetch(url, { method: 'HEAD', redirect: 'follow' })
    if (!head.ok) return { size: null, reason: `Gitee HEAD HTTP ${head.status}` }
    const len = Number(head.headers.get('content-length') || 0)
    if (len > 0) return { size: len, reason: '' }
    const range = await fetch(url, { headers: { Range: 'bytes=0-0' }, redirect: 'follow' })
    const total = String(range.headers.get('content-range') || '').match(/\/(\d+)\s*$/)
    return total ? { size: Number(total[1]), reason: '' } : { size: null, reason: 'Gitee 取不到 Content-Length' }
  } catch (e) {
    return { size: null, reason: `Gitee 不可达:${String(e?.message ?? e).slice(0, 120)}` }
  }
}

/**
 * 带值旗标的取值判定(G-322:一律走 scripts/lib/flag-value.mjs 单源,本器不再自己算 `args[i + 1]`)。
 * 旧写法 `i >= 0 ? args[i + 1] : undefined` 把"给了开关却没给值"与"压根没给开关"折成同一个
 * `undefined`,调用方的 `|| 默认` 顺势接住 ⇒ `--out --tag desktop-v1` 会把 `--tag` 当输出路径
 * (写进 `outputs/--tag/`)还照报已写出;`--latest-json` 打在结尾则报"缺 --latest-json",
 * 读起来像用户忘了打,其实是用户打了、值位上什么都没有。
 * 用法错一律 exit 2 并点名实得 token;**没给旗标**仍返回 `null` ⇒ 各旗标自己的默认档不变。
 */
const takeFlag = (args, name, noun) => {
  const f = requireFlagValue(args, name, { noun })
  if (f.error) {
    console.error(`❌ ${f.error} ⇒ 无法判定,不退回默认(exit 2)`)
    process.exit(2)
  }
  return f.value
}

/** 写盘 + 水印注入(两条主流程共用,避免各写一遍后漂移)。 */
function writeBaked(out, data) {
  const content = serializeGenerated(data)
  writeFileSync(out, content, 'utf8')
  const wm = spawnSync(process.execPath, [resolve(ROOT, 'scripts/watermark.mjs'), 'inject', out], {
    stdio: ['ignore', 'pipe', 'pipe'],
    encoding: 'utf8',
    windowsHide: true,
    timeout: 120000,
  })
  if (wm.status !== 0) {
    console.error(`❌ 水印注入失败(status=${wm.status}):${String(wm.stderr || '').slice(0, 300)}`)
    process.exit(1)
  }
  console.log(`✅ 已烘焙 ${out}`)
}

/** --all-platforms 主流程:逐平台对账后决定 Gitee 直链归属(国内主通道)。 */
async function bakeAllPlatforms({ args, latest, version, tag, out, existing }) {
  const owner =
    takeFlag(args, '--gitee-owner', 'owner') || process.env.GITEE_OWNER || detectGiteeRepo(existing)?.owner || ''
  const repo = takeFlag(args, '--gitee-repo', 'repo') || process.env.GITEE_REPO || 'IHUI-AI'
  const notes = []
  if (!owner) notes.push('Gitee owner:未给出(--gitee-owner / GITEE_OWNER)且旧文件派不出 ⇒ 全部平台保留 GitHub')
  const ghTable = await fetchGithubAssetTable({ tag })
  if (ghTable.reason) notes.push(`GitHub size 表:${ghTable.reason}`)
  const gh = { sizes: new Map([...ghTable.assets].map(([name, a]) => [name, a.size])) }
  const platformUrls = Object.values(latest?.platforms ?? {})
    .map((p) => p?.url)
    .filter((u) => typeof u === 'string' && u)
  const giteeUrls = owner
    ? platformUrls.map((u) => buildGiteeUrl({ owner, repo, tag, assetName: assetNameOf(u) })).filter(Boolean)
    : []
  const ge = giteeUrls.length ? await fetchGiteeSizes(giteeUrls) : { sizes: new Map(), notes: [] }
  for (const n of ge.notes) notes.push(`Gitee size:${n}`)
  const baked = bakeDesktopPlatforms({ latest, tag, githubSizes: gh.sizes, giteeSizes: ge.sizes, owner, repo })
  for (const n of notes) console.log(`⚠️ ${n}`)
  const total = Object.keys(baked.decisions).length
  console.log(`[bake] version=${version} tag=${tag} mode=all-platforms changed=${baked.changed}/${total}`)
  for (const [k, d] of Object.entries(baked.decisions)) {
    console.log(`[bake] ${k} asset=${d.assetName || '<缺>'} verdict=${d.verdict} ⇒ ${d.url || '<缺>'}`)
    console.log(`[bake]   ${d.reason}`)
  }
  // 权威元数据必须与 feed 同一次烘焙产出,否则会出现「新版 feed + 旧 desktop 条目」的断链。
  const assetsBuilt = buildDesktopAssets({
    feed: baked.data,
    githubAssets: ghTable.assets,
    giteeSizes: ge.sizes,
    version,
    tag,
  })
  if (assetsBuilt.issues.length > 0) {
    console.error(`❌ 桌面安装包权威元数据烘焙失败(${assetsBuilt.issues.length} 项):`)
    for (const i of assetsBuilt.issues) console.error(`  - [${i.code}] ${i.message}`)
    process.exit(1)
  }
  const assetsOut = resolve(takeFlag(args, '--assets-out', '文件路径') || DEFAULT_ASSETS_OUT)
  const assetsText = serializeDesktopAssets({ version, tag, assets: assetsBuilt.assets })
  console.log(`[bake] 桌面权威条目 ${assetsBuilt.assets.length} 项 ⇒ ${assetsOut}`)
  if (args.includes('--check')) {
    const verdict = checkAgainstExisting({ existing, expected: baked.data })
    const assetsVerdict = checkAssetsAgainstExisting({
      existingText: existsSync(assetsOut) ? readFileSync(assetsOut, 'utf8') : '',
      expectedText: assetsText,
    })
    if (verdict.ok && assetsVerdict.ok) {
      console.log(`✅ --check:现有烘焙文件与 latest.json 一致(${out})`)
      console.log(`✅ --check:桌面权威元数据一致(${assetsOut})`)
      process.exit(0)
    }
    console.error(`❌ --check:漂移 —— ${verdict.ok ? assetsVerdict.reason : verdict.reason}`)
    process.exit(1)
  }
  if (baked.blocked) {
    console.error('❌ latest.json 缺 platforms ⇒ 拒绝(不输出半份 feed)')
    process.exit(2)
  }
  writeBaked(out, baked.data)
  writeFileSync(assetsOut, assetsText, 'utf8')
  console.log(`✅ 已烘焙桌面权威元数据 ${assetsOut}`)
}

/**
 * 从已提交的 generated.ts 取 update 源事实(版本 + 各平台 url)。
 * 该文件会被 lint-staged/prettier 重排成 `version: 'x'` / 单引号 / 无引号键,无法 JSON.parse,
 * 故这里用键值正则只取「更新校验真正需要的两个事实」,不依赖整体格式。
 */
export function parseFeedFacts(text) {
  const src = String(text ?? '')
  const version = (src.match(/["']?version["']?\s*:\s*['"]([^'"]+)['"]/) || [])[1] || ''
  const urls = [...src.matchAll(/["']?url["']?\s*:\s*['"]([^'"]+)['"]/g)].map((m) => m[1]).filter(Boolean)
  return { version, urls }
}

/** --assets-from-feed:只刷新桌面安装包权威元数据(读已烘焙 feed,不改 feed 本身)。 */
async function bakeAssetsFromFeed({ args }) {
  const out = resolve(takeFlag(args, '--out', '文件路径') || DEFAULT_OUT)
  if (!existsSync(out)) {
    console.error(`❌ 找不到已烘焙 feed:${out}(先跑 --all-platforms 或指 --out)`)
    process.exit(2)
  }
  const facts = parseFeedFacts(readFileSync(out, 'utf8'))
  if (!facts.version) {
    console.error(`❌ 从 ${out} 取出版本失败 ⇒ 拒绝`)
    process.exit(2)
  }
  if (facts.urls.length === 0) {
    console.error(`❌ 从 ${out} 取不出任何平台下载直链 ⇒ 拒绝`)
    process.exit(2)
  }
  const version = facts.version
  const feed = {
    version,
    platforms: Object.fromEntries(facts.urls.map((url, i) => [`platform-${i}`, { url }])),
  }
  const tag = takeFlag(args, '--tag', '版本号') || `desktop-v${version}`
  const assetsOut = resolve(takeFlag(args, '--assets-out', '文件路径') || DEFAULT_ASSETS_OUT)
  const table = await fetchGithubAssetTable({ tag })
  if (table.reason) console.log(`⚠️ ${table.reason}`)
  const giteeUrls = Object.values(feed.platforms)
    .map((p) => p?.url)
    .filter((u) => {
      if (typeof u !== 'string' || !u) return false
      try {
        return new URL(u).hostname === 'gitee.com'
      } catch {
        return false
      }
    })
  const ge = giteeUrls.length ? await fetchGiteeSizes(giteeUrls) : { sizes: new Map(), notes: [] }
  for (const n of ge.notes) console.log(`⚠️ Gitee size:${n}`)
  const built = buildDesktopAssets({
    feed,
    githubAssets: table.assets,
    giteeSizes: ge.sizes,
    version,
    tag,
  })
  if (built.issues.length > 0) {
    console.error(`❌ 桌面安装包权威元数据烘焙失败(${built.issues.length} 项):`)
    for (const i of built.issues) console.error(`  - [${i.code}] ${i.message}`)
    process.exit(1)
  }
  const text = serializeDesktopAssets({ version, tag, assets: built.assets })
  if (args.includes('--check')) {
    const verdict = checkAssetsAgainstExisting({
      existingText: existsSync(assetsOut) ? readFileSync(assetsOut, 'utf8') : '',
      expectedText: text,
    })
    if (verdict.ok) {
      console.log(`✅ --check:桌面权威元数据与 ${out} 一致(${assetsOut})`)
      process.exit(0)
    }
    console.error(`❌ --check:漂移 —— ${verdict.reason}`)
    process.exit(1)
  }
  writeFileSync(assetsOut, text, 'utf8')
  console.log(`✅ 已烘焙桌面权威元数据 ${assetsOut}(${built.assets.length} 项,来源 GitHub Release digest)`)
}

async function main() {
  const args = process.argv.slice(2)
  if (args.includes('--assets-from-feed')) {
    await bakeAssetsFromFeed({ args })
    return
  }
  const latestPath = takeFlag(args, '--latest-json', '文件路径')
  if (!latestPath) {
    console.error('❌ 缺 --latest-json <path> ⇒ 拒绝(不猜输入)')
    process.exit(2)
  }
  if (!existsSync(latestPath)) {
    console.error(`❌ latest.json 不存在:${latestPath}`)
    process.exit(2)
  }
  let latest
  try {
    latest = JSON.parse(readFileSync(latestPath, 'utf8'))
  } catch (e) {
    console.error(`❌ latest.json 解析失败:${String(e?.message ?? e)}`)
    process.exit(2)
  }
  const version = String(latest.version || '').trim()
  if (!version) {
    console.error('❌ latest.json 缺 version ⇒ 拒绝')
    process.exit(2)
  }
  const tag = takeFlag(args, '--tag', '版本号') || `desktop-v${version}`
  const out = resolve(takeFlag(args, '--out', '文件路径') || DEFAULT_OUT)
  const existingText = existsSync(out) ? readFileSync(out, 'utf8') : ''
  const existing = extractGeneratedObject(existingText)
  if (args.includes('--all-platforms')) {
    await bakeAllPlatforms({ args, latest, version, tag, out, existing })
    return
  }
  const winUrl = latest?.platforms?.[PLATFORM]?.url
  if (!winUrl) {
    console.error(`❌ latest.json 缺 platforms.${PLATFORM}.url ⇒ 拒绝`)
    process.exit(2)
  }
  const assetName = decodeURIComponent(new URL(winUrl).pathname.split('/').pop() || '')
  const giteeUrl =
    takeFlag(args, '--gitee-url', 'URL') || deriveGiteeUrl({ existingUrl: existing?.platforms?.[PLATFORM]?.url, tag, assetName })
  let githubSize = Number(takeFlag(args, '--github-size', '字节数') || 0) || null
  let giteeSize = Number(takeFlag(args, '--gitee-size', '字节数') || 0) || null
  const notes = []
  if (!githubSize) {
    const r = await fetchGithubAssetSize({ tag, assetName })
    githubSize = r.size
    if (r.reason) notes.push(`GitHub size:${r.reason}`)
  }
  if (!giteeSize) {
    if (giteeUrl) {
      const r = await fetchGiteeSize(giteeUrl)
      giteeSize = r.size
      if (r.reason) notes.push(`Gitee size:${r.reason}`)
    } else {
      notes.push('Gitee URL:未给出且现有文件派生不出(旧文件不是 Gitee 直链)')
    }
  }
  const baked = bakeDesktopLatest({ latest, githubSize, giteeSize, giteeUrl })
  for (const n of notes) console.log(`⚠️ ${n}`)
  console.log(`[bake] version=${version} tag=${tag} verdict=${baked.verdict}`)
  console.log(`[bake] ${baked.reason}`)
  if (args.includes('--check')) {
    const verdict = checkAgainstExisting({ existing, expected: baked.data })
    if (verdict.ok) {
      console.log(`✅ --check:现有烘焙文件与 latest.json 一致(${out})`)
      process.exit(0)
    }
    console.error(`❌ --check:漂移 —— ${verdict.reason}`)
    process.exit(1)
  }
  if (baked.blocked) process.exit(2)
  writeBaked(out, baked.data)
}

const isDirectRun = process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href
if (isDirectRun) {
  main().catch((e) => {
    console.error(`❌ ${e?.message ?? e}\n${e?.stack ?? ''}`)
    process.exit(2)
  })
}

export const __test__ = {
  extractGeneratedObject,
  deriveGiteeUrl,
  buildGiteeUrl,
  assetNameOf,
  detectGiteeRepo,
  bakeDesktopLatest,
  bakeDesktopPlatforms,
  checkAgainstExisting,
  serializeGenerated,
  buildDesktopAssets,
  serializeDesktopAssets,
  checkAssetsAgainstExisting,
  parseFeedFacts,
}
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
