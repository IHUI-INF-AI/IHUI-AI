// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * 把 CLI 的 npm-dist 产物打进桌面端安装包（resource_dir/cli）。
 *
 * 为什么必须内置(2026-11-26):桌面端「一键启用」要先 `ihui device adopt` 落设备凭据,
 * 而用户机器上要么没有 ihui 命令、要么是 npm 上的旧版(连 adopt 子命令都没有)。
 * 内置一份与桌面端**同包发布**的 CLI 才能把版本钉死;PATH 里的全局 ihui 只作兜底。
 *
 * 内置形态依赖宿主 Node(不复制 node 二进制),所以桌面端只把 dist/index.js 当脚本交给 node 跑。
 *
 * 用法:node scripts/desktop-cli-bundle.mjs [--check]
 *   --check 只校验产物是否就位(不重建),供道具/守门复用。
 */

import { spawnSync } from 'node:child_process'
import fs from 'node:fs'
import path from 'node:path'
import process from 'node:process'
import { fileURLToPath } from 'node:url'

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const cliDir = path.join(root, 'apps', 'cli')
const srcDir = path.join(cliDir, 'npm-dist')
const dstDir = path.join(root, 'apps', 'desktop', 'src-tauri', 'bundle-cli')
const checkOnly = process.argv.includes('--check')

function fail(msg) {
  console.error(`[cli-bundle] ❌ ${msg}`)
  process.exit(1)
}

function assertBundle(dir, tag) {
  const entry = path.join(dir, 'dist', 'index.js')
  const pkg = path.join(dir, 'package.json')
  if (!fs.existsSync(entry)) fail(`${tag} 缺 dist/index.js:${entry}`)
  if (!fs.existsSync(pkg)) fail(`${tag} 缺 package.json:${pkg}`)
  const size = fs.statSync(entry).size
  console.log(`[cli-bundle] ${tag} entry=${(size / 1024).toFixed(0)} KiB dir=${dir}`)
}

if (checkOnly) {
  assertBundle(dstDir, 'bundle')
  process.exit(0)
}

// 1) 构建自包含 npm 产物(esbuild 单文件 + 语言包旁随)
const build = spawnSync(process.execPath, [path.join('scripts', 'build-npm.mjs')], {
  cwd: cliDir,
  stdio: 'inherit',
  windowsHide: true,
})
if (build.error) fail(`拉起 build-npm 失败: ${build.error.message}`)
if (build.status !== 0) fail(`build-npm 退出码 ${build.status}`)
assertBundle(srcDir, 'npm-dist')

// 2) 同步到 tauri 资源目录(全量替换:旧文件不许残留,否则版本对不上)
fs.rmSync(dstDir, { recursive: true, force: true })
fs.mkdirSync(dstDir, { recursive: true })
fs.cpSync(srcDir, dstDir, { recursive: true })
assertBundle(dstDir, 'bundle')

const total = spawnSync(
  process.platform === 'win32' ? 'cmd.exe' : 'sh',
  process.platform === 'win32'
    ? ['/d', '/s', '/c', `dir /s /b "${dstDir}" | find /c /v ""`]
    : ['-c', `find "${dstDir}" -type f | wc -l`],
  { encoding: 'utf8', windowsHide: true },
)
const files = (total.stdout ?? '').trim()
console.log(`[cli-bundle] ✅ 内置 CLI 就位:${files} 个文件 → ${dstDir}`)
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
