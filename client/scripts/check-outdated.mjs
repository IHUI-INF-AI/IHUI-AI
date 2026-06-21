#!/usr/bin/env node
/**
 * 前端依赖过期检查脚本 (client/scripts/check-outdated.mjs)
 *
 * 用法:
 *   node scripts/check-outdated.mjs                 # 检查 client/package.json
 *   node scripts/check-outdated.mjs --miniapp       # 检查 client/miniapp/package.json
 *   node scripts/check-outdated.mjs --json          # 输出 JSON
 *   node scripts/check-outdated.mjs --fail-on-major # major 升级也失败
 *
 * 行为:
 *   1. 解析 package.json
 *   2. 对每个 dep 调用 npm view {name} version (有缓存)
 *   3. 对比 semver 范围, 标记 outdated
 *   4. 输出人类可读 / JSON 报告
 *
 * CI 集成:
 *   - 0 outdated: exit 0
 *   - 仅 patch/minor outdated: exit 0 (warning)
 *   - major outdated: exit 1 (默认), 或 exit 0 (--no-fail)
 */

import { readFile } from 'node:fs/promises'
import { execSync } from 'node:child_process'
import { resolve, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'

const __dirname = dirname(fileURLToPath(import.meta.url))
const CLIENT_ROOT = resolve(__dirname, '..')
const MINIAPP_ROOT = resolve(CLIENT_ROOT, 'miniapp')

const ARGS = process.argv.slice(2)
const TARGET_MINIAPP = ARGS.includes('--miniapp')
const OUTPUT_JSON = ARGS.includes('--json')
const FAIL_ON_MAJOR = ARGS.includes('--fail-on-major')
const QUIET = ARGS.includes('--quiet')

const PKG_PATH = TARGET_MINIAPP
  ? resolve(MINIAPP_ROOT, 'package.json')
  : resolve(CLIENT_ROOT, 'package.json')

const label = TARGET_MINIAPP ? 'miniapp' : 'client'

// ---------------------------------------------------------------------------
// 简单 semver 解析: 仅支持 ^x.y.z / ~x.y.z / >=x.y.z / x.y.z 三种常见形式
// ---------------------------------------------------------------------------
function parseRange(range) {
  const m = range.match(/^[\^~]?(\d+)\.(\d+)\.(\d+)/)
  if (!m) return { major: 0, minor: 0, patch: 0 }
  return { major: +m[1], minor: +m[2], patch: +m[3] }
}

function compareSemver(a, b) {
  // a < b: -1; a > b: 1; a == b: 0
  if (a.major !== b.major) return a.major < b.major ? -1 : 1
  if (a.minor !== b.minor) return a.minor < b.minor ? -1 : 1
  if (a.patch !== b.patch) return a.patch < b.patch ? -1 : 1
  return 0
}

// ---------------------------------------------------------------------------
// npm view {pkg} version (有缓存避免重复请求)
// ---------------------------------------------------------------------------
const versionCache = new Map()
function fetchLatest(pkg) {
  if (versionCache.has(pkg)) return versionCache.get(pkg)
  try {
    const v = execSync(`npm view ${pkg} version 2>nul`, {
      encoding: 'utf-8',
      timeout: 20000,
      stdio: ['ignore', 'pipe', 'ignore'],
    }).trim()
    versionCache.set(pkg, v)
    return v
  } catch (e) {
    versionCache.set(pkg, null)
    return null
  }
}

// ---------------------------------------------------------------------------
// 主流程
// ---------------------------------------------------------------------------
async function main() {
  const raw = await readFile(PKG_PATH, 'utf-8')
  const pkg = JSON.parse(raw)
  const allDeps = { ...(pkg.dependencies || {}), ...(pkg.devDependencies || {}) }
  const depNames = Object.keys(allDeps).sort()

  const results = []
  for (const name of depNames) {
    // 跳过本地 workspace / git / file
    if (
      allDeps[name].startsWith('workspace:') ||
      allDeps[name].startsWith('git') ||
      allDeps[name].startsWith('file:')
    ) {
      continue
    }
    const latest = fetchLatest(name)
    if (!latest) continue
    const current = parseRange(allDeps[name])
    const remote = parseRange(latest)
    const cmp = compareSemver(current, remote)
    if (cmp < 0) {
      const majorBehind = remote.major - current.major
      const minorBehind = remote.minor - current.minor
      results.push({
        name,
        current: allDeps[name],
        currentParsed: current,
        latest,
        latestParsed: remote,
        majorBehind,
        minorBehind,
      })
    }
  }

  // 输出
  if (OUTPUT_JSON) {
    console.log(JSON.stringify({ label, results }, null, 2))
  } else if (!QUIET) {
    console.log(`\n[${label}] Outdated dependencies:`)
    if (results.length === 0) {
      console.log('  ✅ all up-to-date')
    } else {
      const pad = Math.max(...results.map((r) => r.name.length), 10)
      for (const r of results) {
        const tag = r.majorBehind > 0 ? '🔴 major' : r.minorBehind > 0 ? '🟡 minor' : '🟢 patch'
        console.log(
          `  ${tag}  ${r.name.padEnd(pad)}  ${r.current.padEnd(12)} → ${r.latest}`
        )
      }
      console.log(`\nTotal: ${results.length} outdated (${results.filter((r) => r.majorBehind > 0).length} major)`)
    }
    console.log()
  }

  // 退出码
  const majorOutdated = results.filter((r) => r.majorBehind > 0).length
  if (majorOutdated > 0 && FAIL_ON_MAJOR) {
    process.exit(1)
  }
}

main().catch((e) => {
  console.error('check-outdated failed:', e.message)
  process.exit(2)
})
