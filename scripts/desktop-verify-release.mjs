#!/usr/bin/env node
// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/* eslint-disable no-console -- 探测脚本为 CLI 工具,需 console 输出诊断信息 */

/**
 * desktop-verify-release.mjs — 核对「桌面端安装包是否真的可下载」。
 *
 * 只做三件事:解析凭据 → 读 GitHub Releases API → 按资产名/字节数给结论。
 * 不验证 Authenticode / notarize(那需要 Windows/macOS 本机工具链与
 * release-desktop.yml 的 signature-gate);本脚本只回答"发布面上有没有货、齐不齐"。
 *
 * 凭据来源(按优先级,值**从不打印**):
 *   1. 环境变量 GITHUB_TOKEN / GH_TOKEN
 *   2. 仓库约定的密钥文件 D:/BaiduSyncdisk/密钥/github key.txt
 * 两者都取不到时按匿名请求继续(公开仓库限流 60 次/小时);结论里会明示未认证。
 *
 * 用法:
 *   node scripts/desktop-verify-release.mjs
 *   node scripts/desktop-verify-release.mjs --repo IHUI-INF-AI/IHUI-AI --limit 5
 *   node scripts/desktop-verify-release.mjs --help
 *
 * 退出码:
 *   0 — 最近一个 desktop-v* Release 同时具备 Windows / macOS / Linux 资产与 latest.json
 *   1 — 发布面有缺口(缺平台资产 / 缺 latest.json / 缺 .sig 配对)
 *   2 — 取不到输入(API 不可达 / 非 200 / 参数错误),明确「未判定」
 */

import { readFileSync } from 'node:fs'
import process from 'node:process'

const DEFAULT_REPO = 'IHUI-INF-AI/IHUI-AI'
const DEFAULT_KEY_FILE = 'D:/BaiduSyncdisk/密钥/github key.txt'
const API_BASE = 'https://api.github.com'

const USAGE = `用法: node scripts/desktop-verify-release.mjs [--repo <owner/repo>] [--limit <n>]

  --repo    仓库坐标,默认 ${DEFAULT_REPO}
  --limit   读取最近多少个 Release,默认 5
  --help    本帮助

凭据: GITHUB_TOKEN / GH_TOKEN,或 ${DEFAULT_KEY_FILE}(只读入内存,不打印)`

/** @param {string[]} argv */
function parseArgv(argv) {
  const out = { repo: DEFAULT_REPO, limit: 5, help: false, unknown: [] }
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i]
    if (a === '--help' || a === '-h') out.help = true
    else if (a === '--repo') out.repo = argv[++i] ?? ''
    else if (a === '--limit') out.limit = Number(argv[++i])
    else out.unknown.push(a)
  }
  return out
}

/** 凭据从环境或约定密钥文件读入内存;取不到返回 null。绝不打印值。 */
function readToken() {
  const fromEnv = (process.env.GITHUB_TOKEN || process.env.GH_TOKEN || '').trim()
  if (fromEnv) return { token: fromEnv, source: 'env' }
  try {
    const raw = readFileSync(DEFAULT_KEY_FILE, 'utf8')
    const hit = raw.match(/(github_pat_[A-Za-z0-9_]{20,}|gh[pousr]_[A-Za-z0-9_]{20,}|[0-9a-f]{40})/)
    if (hit) return { token: hit[0], source: 'key-file' }
    const line = raw.split(/\r?\n/).map((s) => s.trim()).find(Boolean)
    if (line) return { token: line, source: 'key-file' }
  } catch {
    // 文件不存在/不可读:按匿名请求继续,结论里明示
  }
  return { token: null, source: 'anonymous' }
}

/** @param {Record<string, string>} extra */
function headers(extra = {}) {
  return { Accept: 'application/vnd.github+json', 'User-Agent': 'ihui-desktop-verify', ...extra }
}

/**
 * @param {string} url
 * @param {string | null} token
 * @returns {Promise<{ status: number, data: unknown }>}
 */
async function apiGet(url, token) {
  const res = await fetch(url, {
    headers: headers(token ? { Authorization: `Bearer ${token}` } : {}),
    signal: AbortSignal.timeout(20000),
  })
  const text = await res.text()
  let data = null
  try {
    data = text ? JSON.parse(text) : null
  } catch {
    data = { parseError: true }
  }
  return { status: res.status, data }
}

function formatBytes(bytes) {
  if (!Number.isFinite(bytes) || bytes <= 0) return '-'
  const units = ['B', 'KB', 'MB', 'GB']
  let v = bytes
  let i = 0
  while (v >= 1024 && i < units.length - 1) {
    v /= 1024
    i++
  }
  return `${v.toFixed(i === 0 ? 0 : 1)} ${units[i]}`
}

const CLASSES = {
  win: /\.(exe|msi)$/i,
  mac: /\.(dmg|app\.tar\.gz)$/i,
  linux: /\.(AppImage|deb|rpm)$/i,
  sig: /\.sig$/i,
}

/**
 * @param {Array<{ name: string, size: number }>} assets
 * @returns {{ win: string[], mac: string[], linux: string[], sigs: string[], latest: string[] }}
 */
function classify(assets) {
  const names = assets.map((a) => a.name)
  return {
    win: names.filter((n) => CLASSES.win.test(n)),
    mac: names.filter((n) => CLASSES.mac.test(n)),
    linux: names.filter((n) => CLASSES.linux.test(n)),
    sigs: names.filter((n) => CLASSES.sig.test(n)),
    latest: names.filter((n) => n === 'latest.json'),
  }
}

/** 主资产是否都有同名 .sig(Windows exe / Linux / macOS .app.tar.gz;dmg 例外)。 */
function missingSigPairs(classes) {
  const need = [...classes.win, ...classes.linux, ...classes.mac.filter((n) => /\.app\.tar\.gz$/i.test(n))]
  return need.filter((n) => !classes.sigs.includes(`${n}.sig`))
}

async function main(argv = process.argv.slice(2)) {
  const opts = parseArgv(argv)
  if (opts.help) {
    console.log(USAGE)
    return 0
  }
  if (opts.unknown.length > 0 || !opts.repo.includes('/') || !Number.isInteger(opts.limit) || opts.limit <= 0) {
    console.error(`[desktop-verify] 参数错误:${opts.unknown.join(' ') || `repo/limit 无效`}\n${USAGE}`)
    return 2
  }

  const { token, source } = readToken()
  console.log(`[desktop-verify] 凭据来源: ${source}${token ? '' : '(未认证,受 60 req/h 限流)'}`)

  const url = `${API_BASE}/repos/${opts.repo}/releases?per_page=${opts.limit}`
  let res
  try {
    res = await apiGet(url, token)
  } catch (e) {
    console.error(`[desktop-verify] 未判定:Releases API 不可达(${e?.message ?? e})`)
    return 2
  }
  if (res.status !== 200) {
    console.error(`[desktop-verify] 未判定:Releases API 返回 HTTP ${res.status}`)
    return 2
  }
  const releases = Array.isArray(res.data) ? res.data : []
  if (releases.length === 0) {
    console.error('[desktop-verify] 未判定:Releases API 返回 0 条')
    return 2
  }

  for (const rel of releases) {
    const assets = Array.isArray(rel.assets) ? rel.assets : []
    const c = classify(assets)
    console.log(
      `\n${rel.tag_name} | ${rel.name} | ${rel.published_at} | draft=${rel.draft} | assets=${assets.length}`,
    )
    for (const a of assets) {
      const mark = CLASSES.win.test(a.name)
        ? 'win'
        : CLASSES.mac.test(a.name)
          ? 'mac'
          : CLASSES.linux.test(a.name)
            ? 'linux'
            : CLASSES.sig.test(a.name)
              ? 'sig'
              : a.name === 'latest.json'
                ? 'latest'
                : 'other'
      console.log(`  ${a.name} | ${a.size} B | ${formatBytes(a.size)} | ${mark}`)
    }
  }

  const desktop = releases.filter((r) => String(r.tag_name || '').startsWith('desktop-v'))
  if (desktop.length === 0) {
    console.error('[desktop-verify] 未判定:最近返回里没有 desktop-v* Release')
    return 2
  }
  const latest = desktop.slice().sort((a, b) => String(b.published_at).localeCompare(String(a.published_at)))[0]
  const c = classify(Array.isArray(latest.assets) ? latest.assets : [])
  const missingPlatforms = [
    c.win.length === 0 ? 'Windows(.exe/.msi)' : null,
    c.mac.length === 0 ? 'macOS(.dmg/.app.tar.gz)' : null,
    c.linux.length === 0 ? 'Linux(.AppImage/.deb/.rpm)' : null,
  ].filter(Boolean)
  const noSig = missingSigPairs(c)

  console.log(`\n=== 结论(最新 desktop Release:${latest.tag_name})===`)
  if (missingPlatforms.length === 0 && c.latest.length > 0 && noSig.length === 0) {
    console.log('✓ 发布面齐全:三平台资产 + latest.json + 主资产 .sig 配对都在。')
    console.log('  强度边界:签名/公证是否有效仍由 release-desktop.yml 的 signature-gate 判定,本脚本未验证。')
    return 0
  }
  if (missingPlatforms.length > 0) console.log(`✗ 缺平台资产:${missingPlatforms.join(', ')}`)
  if (c.latest.length === 0) console.log('✗ 缺 latest.json(自动更新清单未发布)')
  if (noSig.length > 0) console.log(`✗ 缺 .sig 配对:${noSig.join(', ')}`)
  return 1
}

main().then(
  (code) => process.exit(code),
  (e) => {
    console.error(`[desktop-verify] 未判定:${e?.message ?? e}`)
    process.exit(2)
  },
)
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
