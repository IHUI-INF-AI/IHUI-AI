#!/usr/bin/env node
/**
 * 静态导出构建入口(Tauri 桌面端 / GitHub Pages 使用)。
 *
 * 2026-08-04 生产切换:next.config.ts 的 output:'export' 改为显式环境变量控制,
 * 仅当 EXPORT_STATIC=true(或 GITHUB_PAGES=true)时启用静态导出。
 * 本脚本设置 EXPORT_STATIC=true 后调用 next build,供:
 *   - Tauri 桌面端(tauri.conf.json beforeBuildCommand)
 *   - GitHub Pages CI(已有 GITHUB_PAGES=true,也可直接走本脚本,幂等)
 * 生产服务端模式(next build + next start)不设 EXPORT_STATIC,走正常服务端构建。
 */
process.env.EXPORT_STATIC = 'true'
process.env.NEXT_TELEMETRY_DISABLED = '1'

import { spawnSync } from 'node:child_process'
import { fileURLToPath } from 'node:url'
import path from 'node:path'

const webRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const nextBin = path.join(webRoot, 'node_modules', 'next', 'dist', 'bin', 'next')

const r = spawnSync(process.execPath, ['--max-old-space-size=8192', nextBin, 'build', '--webpack'], {
  cwd: webRoot,
  stdio: 'inherit',
  shell: false,
  env: process.env,
})

if (r.error) {
  console.error('[build-static] 启动 next build 失败:', r.error.message)
  process.exit(1)
}
process.exit(r.status ?? 1)
