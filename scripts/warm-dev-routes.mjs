#!/usr/bin/env node
// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * warm-dev-routes.mjs — dev 启动后后台预热高频路由(2026-09-02 页面切换提速)
 *
 * 根因(实测 2026-09-02,dev 8801):
 *   `next dev --turbopack` 按需编译每个路由,首次点击导航实测 9.8~11.1s/页
 *   (`○ Compiling /publish/history ...` → `GET /publish/history 200 in 11.8s`);
 *   已编译路由再次导航也有 ~1.0s(dev RSC 渲染固有开销)。
 *   用户点击哪个页面哪个页面才编译 → "页面切换慢"。
 *
 * 方案:start-dev.ps1 在 web 健康检查通过后,后台顺序 GET 一批高频路由,
 *   把按需编译提前到启动阶段完成。用户首次点击时命中已编译路由(~1s dev 固有开销)。
 *   预热在后台跑,不阻塞启动器返回;日志写 dev-logs/web-warmup.log。
 *
 * 用法:
 *   node scripts/warm-dev-routes.mjs                        # 默认:仅高频 12 条
 *   node scripts/warm-dev-routes.mjs --base http://localhost:8801
 *   node scripts/warm-dev-routes.mjs --wait 120             # 等服务就绪秒数(默认 90)
 *   node scripts/warm-dev-routes.mjs --top 30               # 高频 12 + 其余按序取 30
 *   node scripts/warm-dev-routes.mjs --all                  # 侧边栏全部路由(nav-data.ts 自动解析)
 */

import { promises as fs } from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const NAV_DATA = path.resolve(__dirname, '..', 'apps', 'web', 'src', 'components', 'sidebar', 'nav-data.ts')

const args = process.argv.slice(2)
let base = 'http://localhost:8801'
let waitSec = 90
let topN = 0 // 0 = 仅高频
let all = false
for (let i = 0; i < args.length; i++) {
  if (args[i] === '--base' && args[i + 1]) base = args[++i]
  else if (args[i] === '--wait' && args[i + 1]) waitSec = Number(args[++i]) || 90
  else if (args[i] === '--top' && args[i + 1]) topN = Number(args[++i]) || 0
  else if (args[i] === '--all') all = true
}

// 高频路由(与 sidebar 主导航对齐,控制在 12 条:冷缓存最坏 ~12×12s≈2.5min,
// 常态命中 Turbopack 持久化缓存 <1min;过多会加速缓存膨胀触发 3GB 自清,得不偿失)
const HIGH_FREQUENCY = [
  '/dashboard',
  '/chat',
  '/agents',
  '/agent-workbench',
  '/ai-skills',
  '/models',
  '/workspace',
  '/settings',
  '/home',
  '/ai-news',
  '/articles',
  '/wallet',
]

// 从 nav-data.ts 运行时解析全部 href(与侧边栏单一来源同步,避免脚本清单漂移)。
// 解析失败不阻塞:降级为仅预热高频清单。
async function loadSidebarHrefs() {
  try {
    const src = await fs.readFile(NAV_DATA, 'utf8')
    const hrefs = [...src.matchAll(/href:\s*'([^']+)'/g)].map((m) => m[1])
    return [...new Set(hrefs)].filter((h) => h.startsWith('/') && h !== '/')
  } catch (e) {
    console.warn(`[warm-routes] 解析 nav-data.ts 失败,降级仅高频: ${e.message}`)
    return []
  }
}

const sidebarHrefs = await loadSidebarHrefs()
const ROUTES = all
  ? [...new Set([...HIGH_FREQUENCY, ...sidebarHrefs])]
  : topN > 0
    ? [...new Set([...HIGH_FREQUENCY, ...sidebarHrefs.filter((h) => !HIGH_FREQUENCY.includes(h))])].slice(0, HIGH_FREQUENCY.length + topN)
    : HIGH_FREQUENCY

const log = (...m) => console.log(`[warm-routes ${new Date().toISOString().slice(11, 19)}]`, ...m)

async function waitUntilUp() {
  const deadline = Date.now() + waitSec * 1000
  while (Date.now() < deadline) {
    try {
      const res = await fetch(base, { redirect: 'manual' })
      if (res.status < 600) return true
    } catch {
      /* 未就绪,继续等 */
    }
    await new Promise((r) => setTimeout(r, 2000))
  }
  return false
}

if (!(await waitUntilUp())) {
  log(`FAIL: ${base} 在 ${waitSec}s 内未就绪,放弃预热`)
  process.exit(1)
}

log(`开始预热 ${ROUTES.length} 条高频路由(${base})`)
const results = []
for (const route of ROUTES) {
  const t0 = Date.now()
  let ms, status
  try {
    const res = await fetch(base + route, { headers: { 'user-agent': 'ihui-warm-dev-routes' } })
    await res.arrayBuffer() // 必须读完 body,RSC 渲染才真正完成
    ms = Date.now() - t0
    status = res.status
  } catch (e) {
    ms = Date.now() - t0
    status = `ERR:${e.message.slice(0, 40)}`
  }
  results.push({ route, ms, status })
  log(`${String(ms).padStart(6)}ms  ${status}  ${route}`)
}

const slow = results.filter((r) => r.ms > 2000)
log(`预热完成: ${results.length} 条,慢编译(>2s)${slow.length} 条${slow.length ? ' → ' + slow.map((r) => r.route).join(', ') : ''}`)
process.exit(0)
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
