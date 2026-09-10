#!/usr/bin/env node
// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * 桌面端 SaaS 模式打包入口(2026-09-02 立)。
 *
 * 背景:本地三端联调桌面包(tauri build 的 beforeBuildCommand → build:static)不注入任何
 * env,Tauri 分支回退直连 http://127.0.0.1:8802。SaaS 化需要把线上后端地址烘焙进静态产物:
 *   - NEXT_PUBLIC_API_BASE_URL       → https://aizhs.top(登录/数据/刷新全走 /api/*)
 *   - NEXT_PUBLIC_STREAM_API_BASE_URL → 同线上(SSE 流式直连)
 *   - NEXT_PUBLIC_AI_SERVICE_URL      → 同线上(直连 8803 型功能经 nginx 代理)
 * 三个键烘焙后,apps/web/src/lib/api.ts / sso-desktop-bridge.ts / playground-api.ts 等
 * Tauri 分支的 env 优先逻辑全部落到线上地址;本地 dev(不注入)行为不变。
 *
 * 用法:
 *   pnpm build:desktop:saas                     # 默认 https://aizhs.top
 *   NEXT_PUBLIC_API_BASE_URL=https://<其他> pnpm build:desktop:saas   # 覆盖(测试环境)
 *
 * 产物:apps/desktop/src-tauri/target/release/bundle/(NSIS/msi 等),同目录 target 内。
 */
import { spawnSync } from 'node:child_process'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const apiBase = (process.env.NEXT_PUBLIC_API_BASE_URL || 'https://aizhs.top').replace(/\/+$/, '')

process.env.NEXT_PUBLIC_API_BASE_URL = apiBase
process.env.NEXT_PUBLIC_STREAM_API_BASE_URL = process.env.NEXT_PUBLIC_STREAM_API_BASE_URL || apiBase
// WS 默认走 api 子域:主域 aizhs.top 对 /cozeZhsApi/*、/v1/ai/capabilities/* 的 WebSocket
// 升级失败(000),api.aizhs.top 全路径 101(见 apps/web/src/lib/ws-url.ts 注释)。
process.env.NEXT_PUBLIC_WS_BASE_URL = process.env.NEXT_PUBLIC_WS_BASE_URL || 'https://api.aizhs.top'
process.env.NEXT_PUBLIC_AI_SERVICE_URL = process.env.NEXT_PUBLIC_AI_SERVICE_URL || apiBase

console.log('[desktop-build-saas] 烘焙线上后端地址:')
console.log(`  NEXT_PUBLIC_API_BASE_URL       = ${process.env.NEXT_PUBLIC_API_BASE_URL}`)
console.log(`  NEXT_PUBLIC_STREAM_API_BASE_URL = ${process.env.NEXT_PUBLIC_STREAM_API_BASE_URL}`)
console.log(`  NEXT_PUBLIC_WS_BASE_URL         = ${process.env.NEXT_PUBLIC_WS_BASE_URL}`)
console.log(`  NEXT_PUBLIC_AI_SERVICE_URL      = ${process.env.NEXT_PUBLIC_AI_SERVICE_URL}`)

// 走与 pnpm 脚本相同的执行器:pnpm 运行时 npm_execpath 指向 pnpm 本体(node 直跑),
// 避免 Windows 下对 pnpm.cmd 的 shell 解析依赖。
const npmExec = process.env.npm_execpath ? process.execPath : 'pnpm'
const args = process.env.npm_execpath
  ? [process.env.npm_execpath, '--filter', '@ihui/desktop', 'build']
  : ['--filter', '@ihui/desktop', 'build']

const r = spawnSync(npmExec, args, {
  cwd: repoRoot,
  stdio: 'inherit',
  env: process.env,
  shell: !process.env.npm_execpath,
})

process.exit(r.status ?? 1)
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
