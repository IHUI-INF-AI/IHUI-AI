#!/usr/bin/env node
// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * 安装器 /UPDATE 零弹窗回归测试（Windows 真机）。
 *
 * 静态门禁只能证明代码里没有 MessageBox/Abort；这个脚本证明**进程真的会退出**：
 * 旧版曾把 MessageBox 放在 .onInit，/S 静默参数压不住，安装器永久挂住。
 * 任何弹窗回归都会让 spawnSync 超时，测试直接红。
 *
 * 用法：
 *   node scripts/check-desktop-installer-e2e.mjs --installer <智汇AI_x.y.z_x64-setup.exe>
 *
 * 判据：
 *   1. 静默安装 exit 0，state.json 可解析；
 *   2. /S /UPDATE exit 2 且 < 8s；
 *   3. 非静默 /UPDATE exit 2 且 < 8s（这条最容易把弹窗带回来）；
 *   4. 两次 /UPDATE 后 state.json 逐字节不变；
 *   5. 静默卸载 exit 0，目录删除。
 */
import { existsSync, mkdtempSync, readFileSync, rmSync, statSync, writeFileSync } from 'node:fs'
import { spawnSync } from 'node:child_process'
import { tmpdir } from 'node:os'
import { join, resolve } from 'node:path'

const TIMEOUT_UPDATE_MS = 8_000
const TIMEOUT_INSTALL_MS = 60_000
let cleanupRoot = ''

function argValue(name) {
  const idx = process.argv.indexOf(name)
  return idx >= 0 ? process.argv[idx + 1] : ''
}

const installer = resolve(
  argValue('--installer') ||
    'apps/desktop/src-tauri/target/release/bundle/nsis/智汇AI_0.1.93_x64-setup.exe',
)

function fail(message, root) {
  console.error(`[installer-e2e] FAIL: ${message}`)
  const dir = root || cleanupRoot
  if (dir) rmSync(dir, { recursive: true, force: true })
  process.exit(1)
}

function run(label, exe, args, timeout, expected) {
  const started = Date.now()
  const r = spawnSync(exe, args, {
    timeout,
    windowsHide: true,
    stdio: 'ignore',
  })
  const elapsed = Date.now() - started
  if (r.error?.code === 'ETIMEDOUT') {
    fail(`${label} 超时 ${elapsed}ms（疑似弹窗/模态框回归）`)
  }
  if (r.error) fail(`${label} 启动失败：${r.error.message}`)
  if (r.status !== expected) {
    fail(`${label} 退出码 ${r.status}，期望 ${expected}（耗时 ${elapsed}ms）`)
  }
  console.log(`[installer-e2e] PASS ${label}: exit=${r.status} ${elapsed}ms`)
}

if (process.platform !== 'win32') {
  console.error('[installer-e2e] 未判定：仅 Windows 可执行 NSIS 安装器测试')
  process.exit(2)
}
if (!existsSync(installer)) {
  console.error(`[installer-e2e] 找不到安装包：${installer}`)
  console.error('[installer-e2e] 用 --installer <path> 指定')
  process.exit(2)
}

const root = mkdtempSync(join(tmpdir(), 'ihui-installer-e2e-'))
cleanupRoot = root
const installDir = join(root, 'app')
const setup = installer
const uninstaller = join(installDir, 'uninstall.exe')
const stateFile = join(installDir, 'state.json')

try {
  run('静默安装', setup, ['/S', `/D=${installDir}`], TIMEOUT_INSTALL_MS, 0)
  if (!existsSync(stateFile)) fail('安装后没有 state.json', root)
  const installed = readFileSync(stateFile, 'utf8')
  const state = JSON.parse(installed)
  if (typeof state.current !== 'string' || !state.current) fail('state.json current 非法', root)

  // 同版本原地重装：previous 必须保留旧的上一代，不能被写成 current 自己。
  const previous = state.current === '0.1.91' ? '0.1.90' : '0.1.91'
  writeFileSync(
    stateFile,
    `${JSON.stringify({ ...state, previous, pending: null, fail_count: 0, bad: null }, null, 2)}\n`,
    'utf8',
  )
  run('同版本重装', setup, ['/S', `/D=${installDir}`], TIMEOUT_INSTALL_MS, 0)
  const afterReinstall = JSON.parse(readFileSync(stateFile, 'utf8'))
  if (afterReinstall.current !== state.current) fail('同版本重装后 current 变了', root)
  if (afterReinstall.previous !== previous)
    fail(`同版本重装丢了 previous：${afterReinstall.previous} != ${previous}`, root)
  if (!existsSync(`${stateFile}.bak`)) fail('同版本重装没有保留 state.json.bak', root)
  const bak = JSON.parse(readFileSync(`${stateFile}.bak`, 'utf8'))
  if (bak.current !== state.current || bak.previous !== previous)
    fail('state.json.bak 不是重装前的真实状态', root)
  if (existsSync(`${stateFile}.tmp`)) fail('同版本重装残留 state.json.tmp', root)

  const before = readFileSync(stateFile, 'utf8')
  run('静默 /UPDATE 零弹窗', setup, ['/S', '/UPDATE', `/D=${installDir}`], TIMEOUT_UPDATE_MS, 2)
  run('非静默 /UPDATE 零弹窗', setup, ['/UPDATE', `/D=${installDir}`], TIMEOUT_UPDATE_MS, 2)

  const after = readFileSync(stateFile, 'utf8')
  if (after !== before) fail('/UPDATE 后 state.json 被改写', root)
  if (existsSync(join(installDir, 'state.json.tmp'))) fail('/UPDATE 后残留 state.json.tmp', root)

  if (!existsSync(uninstaller)) fail('安装目录缺少 uninstall.exe', root)
  run('静默卸载', uninstaller, ['/S'], TIMEOUT_INSTALL_MS, 0)
  if (existsSync(installDir)) {
    // NSIS 卸载器可能把自删除进程留到下一拍；最多等 2 秒再判。
    const until = Date.now() + 2_000
    while (Date.now() < until && existsSync(installDir)) {
      Atomics.wait(new Int32Array(new SharedArrayBuffer(4)), 0, 0, 100)
    }
    if (existsSync(installDir)) fail('卸载后安装目录仍存在', root)
  }

  console.log(`[installer-e2e] OK: ${statSync(setup).size} bytes, state current=${state.current}`)
} finally {
  rmSync(root, { recursive: true, force: true })
}
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
