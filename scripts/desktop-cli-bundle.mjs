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
 * 2026-11-26 二次补齐:CLI 是 JS,只有 dist 还得有 Node 才能跑 —— 而"用户机器上没装 Node"
 * 和"没装 CLI"一样常见,失败又会退化成一句看不懂的报错。所以把 node.exe 一起打进包
 * (resource_dir/node/node.exe),Rust 侧 find_node 先认内置、再回 PATH。
 *
 * 用法:node scripts/desktop-cli-bundle.mjs [--check]
 *   --check 只校验产物是否就位(不重建),供道具/守门复用。
 *   内置 Node 的源可用 IHUI_BUNDLE_NODE 指定;缺省取当前构建进程的 node(同宿主同架构)。
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
const nodeDstDir = path.join(root, 'apps', 'desktop', 'src-tauri', 'bundle-node')
const checkOnly = process.argv.includes('--check')

/**
 * 内置 Node 源:显式 env 优先 → 运行本脚本的 node → PATH 上的 node → 常见安装位。
 * **必须排除 agent 沙箱里的 node**(`sandbox_runtime` 下那份是宿主工具链,不是可分发运行时,
 * 换台机器就无从解释来源;放进去等于埋一颗版本漂移的雷)。
 * 找不到时不硬失败 —— PATH 里的 node 仍能兜住,但会把"这一维没内置"点名出来,
 * 免得发布后才发现"用户机器没 Node"又变成一句看不懂的报错。
 */
function pickNodeSource() {
  const exeName = process.platform === 'win32' ? 'node.exe' : 'node'
  const cands = []
  const fromEnv = process.env.IHUI_BUNDLE_NODE
  if (fromEnv) cands.push(fromEnv)
  if (process.execPath && /node(\.exe)?$/i.test(process.execPath)) cands.push(process.execPath)
  for (const dir of String(process.env.PATH || '').split(path.delimiter)) {
    if (dir && dir.trim()) cands.push(path.join(dir.trim(), exeName))
  }
  if (process.platform === 'win32') {
    for (const base of [process.env['ProgramFiles'], process.env['ProgramFiles(x86)'], process.env.LOCALAPPDATA]) {
      if (base) {
        cands.push(path.join(base, 'nodejs', exeName))
        cands.push(path.join(base, 'Programs', 'nodejs', exeName))
      }
    }
  }
  for (const c of cands) {
    if (/sandbox_runtime/i.test(c)) {
      console.warn(`[cli-bundle] 跳过 agent 沙箱内的 Node(不可分发):${c}`)
      continue
    }
    try {
      if (fs.statSync(c).isFile()) return c
    } catch {
      // 继续看下一个候选
    }
  }
  return null
}

function installNode(dir) {
  const src = pickNodeSource()
  const exeName = process.platform === 'win32' ? 'node.exe' : 'node'
  fs.rmSync(dir, { recursive: true, force: true })
  if (!src) {
    console.warn('[cli-bundle] ⚠️ 未找到可复制的 Node 二进制(可用 IHUI_BUNDLE_NODE 指定)⇒ 安装包将不含内置 Node')
    return false
  }
  fs.mkdirSync(dir, { recursive: true })
  const dst = path.join(dir, exeName)
  fs.copyFileSync(src, dst)
  const size = fs.statSync(dst).size
  console.log(
    `[cli-bundle] 内置 Node ${(size / 1024 / 1024).toFixed(1)} MiB ← ${src} → ${dst}`,
  )
  return true
}

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
  const nodeExe = path.join(nodeDstDir, process.platform === 'win32' ? 'node.exe' : 'node')
  if (!fs.existsSync(nodeExe)) {
    console.warn('[cli-bundle] ⚠️ bundle-node 未就位(安装包将依赖宿主 Node)')
  }
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

// 3) 内置 Node(CLI 是 JS,没运行时等于没装)
installNode(nodeDstDir)
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
