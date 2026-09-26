#!/usr/bin/env node
// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

import { execFileSync, spawnSync } from 'node:child_process'
import { existsSync, readFileSync } from 'node:fs'
import { dirname, join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

const PKG_DIR = resolve(dirname(fileURLToPath(import.meta.url)), '..')
const ROOT_ALLOWED = new Set(['package.json', 'LICENSE', 'NOTICE'])
const REQUIRED = ['package.json', 'LICENSE', 'NOTICE', 'dist/index.js', 'dist/index.d.ts']
const ENTRY_ALLOW = new Set(['./package.json'])

let failed = false
const fail = (m) => {
  failed = true
  console.error(`FAIL ${m}`)
}
const info = (m) => console.log(`INFO ${m}`)

const pkg = JSON.parse(readFileSync(join(PKG_DIR, 'package.json'), 'utf8'))

function collectEntryTargets() {
  const out = []
  for (const field of ['main', 'module', 'types']) {
    if (pkg[field]) out.push([field, pkg[field]])
  }
  for (const [sub, cond] of Object.entries(pkg.exports ?? {})) {
    if (typeof cond === 'string') {
      out.push([`exports["${sub}"]`, cond])
    } else {
      for (const [c, p] of Object.entries(cond ?? {})) {
        out.push([`exports["${sub}"].${c}`, p])
      }
    }
  }
  return out
}

for (const [field, value] of collectEntryTargets()) {
  if (typeof value !== 'string' || ENTRY_ALLOW.has(value)) continue
  if (!value.startsWith('./dist/')) {
    fail(`${field} -> "${value}" 不指向 ./dist/(发布后外部装了用不了)`)
  }
}

const files = pkg.files ?? []
for (const f of files) {
  if (f !== 'dist' && !ROOT_ALLOWED.has(f)) {
    fail(`files 白名单含未预期条目: "${f}"`)
  }
}

for (const required of ['dist', 'LICENSE', 'NOTICE']) {
  if (!files.includes(required)) fail(`files 白名单缺少 "${required}"`)
}

if (pkg.publishConfig?.access !== 'public') {
  fail('publishConfig.access 必须为 public')
}

for (const [field, value] of collectEntryTargets()) {
  if (typeof value !== 'string' || ENTRY_ALLOW.has(value) || value.includes('*')) continue
  if (!existsSync(join(PKG_DIR, value))) {
    fail(`${field} 目标 "${value}" 不存在(先跑 pnpm --filter @ihui/api-client build)`)
  }
}

for (const rel of REQUIRED) {
  if (!existsSync(join(PKG_DIR, rel))) fail(`必需文件缺失: ${rel}`)
}

for (const [dep, range] of Object.entries(pkg.dependencies ?? {})) {
  // 2026-09-26 由 INFO 升为 FAIL:O14c 落地时这里只打一行提示,写的是"必须用 pnpm publish 发布
  // (自动重写为 ^version)"。那是把**发布器行为**当成本包的正确性依据 —— 一旦有人用 npm publish
  // (或 CI 换了发布器)就静默发出去一个装不到的包,而当天 check-pkg-installable 判出的正是这一型。
  // 现在的口径与 packages/sdk/scripts/prepack.mjs 同形:workspace: 出现在 dependencies 即拒绝,
  // 内部依赖要么不进运行时(本包现状:@ihui/types 只在 devDependencies),要么先自身可发布。
  if (String(range).startsWith('workspace:')) {
    fail(`dependencies 含 workspace 协议包 ${dep}@${range}:外部无法安装(改走 devDependencies + 包内自实现,或先让该包可发布)`)
  }
}
for (const [dep, range] of Object.entries(pkg.devDependencies ?? {})) {
  if (String(range).startsWith('workspace:') && !(pkg.dependencies ?? {})[dep]) {
    info(`devDependencies ${dep}@${range} 不会进入发布包,无需处理`)
  }
}

function npmPackDryRun() {
  const args = ['pack', '--dry-run', '--json', '--ignore-scripts']
  const npmCli = join(dirname(process.execPath), 'node_modules', 'npm', 'bin', 'npm-cli.js')
  if (existsSync(npmCli)) {
    return execFileSync(process.execPath, [npmCli, ...args], {
      cwd: PKG_DIR,
      encoding: 'utf8',
      windowsHide: true,
      stdio: ['ignore', 'pipe', 'pipe'],
    })
  }
  const r = spawnSync(process.platform === 'win32' ? 'npm.cmd' : 'npm', args, {
    cwd: PKG_DIR,
    encoding: 'utf8',
    shell: true,
    windowsHide: true,
  })
  if (r.status !== 0) throw new Error(r.stderr || `npm pack exit ${r.status}`)
  return r.stdout
}

try {
  const raw = npmPackDryRun().trim()
  const start = raw.indexOf('[')
  if (start < 0) throw new Error(`npm pack --json 无 JSON 输出: ${raw.slice(0, 200)}`)
  const [entry] = JSON.parse(raw.slice(start))
  const packed = entry.files.map((f) => f.path)
  const unexpected = packed.filter((p) => !(p.startsWith('dist/') || ROOT_ALLOWED.has(p)))
  if (unexpected.length > 0) {
    fail(`pack 清单含白名单外文件(${unexpected.length}): ${unexpected.slice(0, 10).join(', ')}`)
  }
  for (const rel of REQUIRED) {
    if (!packed.includes(rel)) fail(`pack 清单缺少必需文件: ${rel}`)
  }
  const srcLeaks = packed.filter((p) => p.includes('/src/') || p.startsWith('src/'))
  if (srcLeaks.length > 0) fail(`pack 清单泄漏 src/: ${srcLeaks.slice(0, 10).join(', ')}`)
  const topLevel = {}
  for (const p of packed) {
    const k = p.includes('/') ? `${p.split('/')[0]}/` : p
    topLevel[k] = (topLevel[k] ?? 0) + 1
  }
  console.log(`OK npm pack --dry-run: ${packed.length} files, ${entry.filename}, size=${entry.size ?? '?'}B unpacked=${entry.unpackedSize ?? '?'}B`)
  console.log(`OK 清单分布: ${Object.entries(topLevel).sort().map(([k, n]) => `${k}×${n}`).join(', ')}`)
} catch (e) {
  fail(`npm pack --dry-run 执行失败: ${e?.message ?? e}`)
}

if (failed) {
  console.error('pack-check 未通过')
  process.exit(1)
}
console.log('pack-check 通过')
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
