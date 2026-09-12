#!/usr/bin/env node
// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * dev-with-warmup.mjs — `pnpm dev` 一步到位:起 next dev + 自动后台预热高频路由
 *
 * 背景(2026-09-12 路由提速改造):
 *   「路由切换慢」的真因是 dev 下 Turbopack 按需编译:首次点某路由才编译,
 *   实测冷编译 2.5~4s,而已编译路由仅 ~130ms。dev 下**所有预取都是空操作**
 *   (Next 在 app-router-utils.js 对 NODE_ENV=development 直接 return null,
 *   Link 视口预热 / 悬停预热 / router.prefetch 均不发请求),故 dev 下唯一杠杆
 *   就是"把编译提前到启动阶段" → 即预热。
 *
 *   但预热此前只挂在 scripts/start-dev.ps1,普通 `pnpm dev`(含 turbo、
 *   以及 start-dev.ps1 注册表里的 `pnpm --filter @ihui/web dev`)完全没有 →
 *   每个页面首次点击必冷编译。本脚本把预热并入 dev 入口本身:照旧用原命令启动,
 *   无需换命令、不会顺带拉起 api / ai-service。
 *
 * 行为:
 *   1. 前台 spawn `next dev --turbopack -p 8801`(stdio / 退出码透传);
 *   2. 等 http://localhost:8801 就绪后,以 detached 后台进程跑
 *      `warm-dev-routes.mjs`(默认 PRIORITY_ROUTES 全量 36 条),
 *      日志 .ihui-agent/tmp/dev-logs/web-warmup.log;
 *   3. 预热失败 / 超时只打日志,绝不影响 dev server 本身。
 *
 * 前置:apps/web/package.json 的 dev 脚本为
 *   `clean-turbopack-cache.mjs && node ../../scripts/dev-with-warmup.mjs`
 *   即清缓存仍在本脚本【之前】完成(铁律:严禁 next dev 运行中清缓存,
 *   见 clean-turbopack-cache.mjs 文件头)。
 *
 * 用法(正常无需直接调用,由 `pnpm dev` 拉起):
 *   node scripts/dev-with-warmup.mjs
 */

import { spawn } from 'node:child_process'
import { mkdirSync, openSync } from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const REPO_ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const WEB_DIR = path.join(REPO_ROOT, 'apps', 'web')
const PORT = 8801
const BASE = `http://localhost:${PORT}`
const WARM_LOG_DIR = path.join(REPO_ROOT, '.ihui-agent', 'tmp', 'dev-logs')
const WARM_LOG = path.join(WARM_LOG_DIR, 'web-warmup.log')
// 2026-09-12 二次修正:不再传 `--top N`。warm-dev-routes.mjs 的默认行为已是
// PRIORITY_ROUTES 全量(36 条,显式有序清单,含 /news、/vip、/points、/orders、
// /member、/personas、/about、/plugins 等用户高频页)。
// 此前传 `--top 18` 的追加源是 nav-data.ts 的文件顺序(前 130 行是 admin 主题页 +
// MODELS_CHILDREN),实际追加的全是"主题配置页 + 模型子页",用户真正会点的页面一条没热
// —— 这才是"扩到 30 条还是卡"的真因。清单已改为显式维护,故这里只跑默认全量。

const log = (...m) => console.log(`[dev-warmup ${new Date().toISOString().slice(11, 19)}]`, ...m)

// 1) 前台 dev server。经 shell 执行,与原来的 `next dev --turbopack -p 8801` 完全等价
//    (由 npm/pnpm 注入的 PATH 解析 apps/web/node_modules/.bin/next,跨平台通吃)。
const dev = spawn(`next dev --turbopack -p ${PORT}`, {
  cwd: WEB_DIR,
  stdio: 'inherit',
  shell: true,
})
dev.on('error', (e) => {
  console.error(`[dev-warmup] 启动 next dev 失败: ${e.message}`)
  process.exit(1)
})
dev.on('exit', (code) => process.exit(code ?? 0))

// 2) 等 dev server 就绪(180s 上限;dev 已在前台跑,这里只是等待,不阻塞它)
async function waitReady() {
  const deadline = Date.now() + 180_000
  while (Date.now() < deadline) {
    try {
      const res = await fetch(BASE, { redirect: 'manual', signal: AbortSignal.timeout(5000) })
      if (res.status < 600) return true
    } catch {
      /* 未就绪,继续等 */
    }
    await new Promise((r) => setTimeout(r, 1500))
  }
  return false
}

if (!(await waitReady())) {
  log(`跳过预热:${BASE} 在 180s 内未就绪`)
} else {
  try {
    mkdirSync(WARM_LOG_DIR, { recursive: true })
    const fd = openSync(WARM_LOG, 'a') // 追加:一次会话一段日志,便于前后对照
    const warm = spawn(
      process.execPath,
      [
        path.join(REPO_ROOT, 'scripts', 'warm-dev-routes.mjs'),
        '--base',
        BASE,
        '--wait',
        '30', // 已探活过,30s 仅作兜底
      ],
      { cwd: REPO_ROOT, detached: true, windowsHide: true, stdio: ['ignore', fd, fd] },
    )
    warm.unref() // 脱离父进程生命周期,dev 退出后不阻塞
    log(`高频路由预热已后台启动(PRIORITY_ROUTES 全量),日志: ${WARM_LOG}`)
  } catch (e) {
    log(`预热启动失败(不影响 dev):${e.message}`)
  }
}
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
