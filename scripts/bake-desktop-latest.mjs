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
 * 唯一允许的改写:platforms.windows-x86_64.url → Gitee 镜像直链,且**仅当** Gitee 直链
 * HEAD Content-Length 与 GitHub 同名资产 size 字节相等。字节不等/量不到 ⇒ 保留 GitHub 并
 * 大声报原因(同名不同物:0.1.75 实测差 4,173 字节 ⇒ 下载成功但验签必失败)。
 * 判据本体复用 scripts/resolve-desktop-download.mjs 的 giteeBytesVerdict(唯一实现,不另抄)。
 *
 * 用法:
 *   node scripts/bake-desktop-latest.mjs --latest-json <path> [--tag desktop-vX.Y.Z]
 *     [--github-size N] [--gitee-size N] [--gitee-url URL] [--out path] [--check]
 *
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
  const ew = existing.platforms?.[PLATFORM]?.url
  const xw = expected.platforms?.[PLATFORM]?.url
  if (ew !== xw) diffs.push(`windows url ${ew ?? '<缺>'} → ${xw ?? '<缺>'}`)
  for (const p of Object.keys(expected.platforms ?? {})) {
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

async function main() {
  const args = process.argv.slice(2)
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
  const content = serializeGenerated(baked.data)
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

const isDirectRun = process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href
if (isDirectRun) {
  main().catch((e) => {
    console.error(`❌ ${e?.message ?? e}\n${e?.stack ?? ''}`)
    process.exit(2)
  })
}

export const __test__ = { extractGeneratedObject, deriveGiteeUrl, bakeDesktopLatest, checkAgainstExisting, serializeGenerated }
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
