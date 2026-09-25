#!/usr/bin/env node
// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠


/**
 * 小程序预览脚本。
 * 启动 miniapp H5 开发服务器并输出预览 URL。
 */
import { spawn, execSync } from 'node:child_process'
import { pathToFileURL } from 'node:url'

/**
 * 可判定常量 —— 导出面见文件末 `__test__`(AGENTS.md §22c)。
 * 镜像测试 scripts/tests/miniapp-preview.test.mjs 逐个对账本仓真实事实源,
 * 写错任意一个都会红:包名对不上 workspace、脚本名对不上 package.json、
 * 端口对不上 apps/miniapp-taro/config/dev.ts 与 docs/port-management.md。
 */
// 2026-09-25 修:原写 `@ihui/miniapp`,该包在本仓**不存在**。实测
// `pnpm --filter @ihui/miniapp dev:h5` 打 "No projects matched the filters"
// 且**退出码 0** ⇒ 预览静默空跑、CI 全绿而无产物(不是报错)。
const PACKAGE_NAME = '@ihui/miniapp-taro'
const DEV_SCRIPT = 'dev:h5'
// 端口唯一真相源 = apps/miniapp-taro/config/dev.ts 的 h5.devServer.port
// (已登记于 docs/port-management.md:8804 小程序 Taro H5,strictPort)。
// 2026-09-25 修:此前写 5173(Vite 默认口),是本仓的第二个真相源。
const PREVIEW_PORT = 8804
const PREVIEW_URL_DELAY_MS = 5000

function buildPnpmArgs() {
  return ['--filter', PACKAGE_NAME, DEV_SCRIPT]
}

function main() {
  console.log('[miniapp-preview] 启动小程序 H5 预览服务器...')

  const child = spawn('pnpm', buildPnpmArgs(), {
    stdio: 'inherit',
    shell: true,  windowsHide: true, // 防 Windows 弹可见 cmd 窗口
  })

  child.on('error', (err) => {
    console.error('[miniapp-preview] ❌ 启动失败:', err.message)
    process.exit(1)
  })

  // P2 修复(2026-07-31):进程树清理,避免 Ctrl+C 后 pnpm spawn 的 vite/taro 子进程成为孤儿。
  // 与 scripts/dev-web.mjs 同模式,使用 taskkill /F /T 杀整棵进程树(Windows)。
  let killing = false
  function killTree(signal) {
    if (killing) return
    killing = true
    if (child.pid) {
      try {
        // timeout 必带:taskkill 挂住会把一次退出变成无界阻塞(守门 52/80 同族约束)
        execSync(`taskkill /F /T /PID ${child.pid}`, {
          stdio: 'ignore',
          windowsHide: true,
          timeout: 10_000,
        })
      } catch {
        /* ignore — 子进程可能已退出 */
      }
    }
    if (signal !== 'exit') process.exit(0)
  }
  process.on('SIGINT', () => killTree('SIGINT'))
  process.on('SIGTERM', () => killTree('SIGTERM'))
  process.on('SIGHUP', () => killTree('SIGHUP'))
  process.on('exit', () => killTree('exit'))

  // 5秒后输出预览 URL
  setTimeout(() => {
    console.log(`\n[miniapp-preview] 📱 预览 URL: http://localhost:${PREVIEW_PORT}`)
    console.log('[miniapp-preview] 按 Ctrl+C 停止\n')
  }, PREVIEW_URL_DELAY_MS)
}

const isDirectRun = process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href

if (isDirectRun) {
  Promise.resolve()
    .then(() => main())
    .catch((e) => {
      console.error(`❌ ${e?.message ?? e}\n${e?.stack ?? ''}`)
      process.exit(2)
    })
}

export const __test__ = {
  PACKAGE_NAME,
  DEV_SCRIPT,
  PREVIEW_PORT,
  PREVIEW_URL_DELAY_MS,
  buildPnpmArgs,
}
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
