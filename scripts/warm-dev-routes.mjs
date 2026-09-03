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
 * 方案:start-dev.ps1 在 web 健康检查通过后,后台有界并发 GET 高频路由,
 *   把按需编译提前到启动阶段完成。用户首次点击时命中已编译路由(~1s dev 固有开销)。
 *   预热在后台跑,不阻塞启动器返回;日志写 dev-logs/web-warmup.log。
 *
 * 2026-09-03 升级(串行 → 有界并发,根因见下方 CONCURRENCY 注释):
 *   原纯串行预热需 ~2.5 分钟(高频 12 条),覆盖速度追不上用户点击。改为有界并发=4,
 *   高频 12 条 1 分钟内就绪。
 *
 * 2026-09-03 关键回滚(全量 → 高频,直击"根本没做到极致"终极根因):
 *   曾将预热升级为 --all 全量(194 条)以期"彻底消除时机依赖",但实测反而更慢:
 *   全量 194 条编译产物 + 客户端 Sidebar 第七刀 ~100 条双份叠加,单次会话把
 *   Turbopack 缓存(RocksDB)从 3GB 撑到 40GB(阈值仅 3GB,clean 脚本只在下次
 *   启动前触发,会话内无法清——Windows 下 next dev 运行中文件被锁 fs.rm 必 EPERM)。
 *   40GB 缓存使会话内所有路由(含已编译)每次读写 40GB RocksDB → 单路由 15~19s
 *   (实测 /chat 15s、/dashboard 19s、/models 19s),这才是"根本没做到极致"的真因。
 *   故回滚为仅高频 12 条(单次会话缓存增长 <1GB,符合本脚本原始设计警告第 51 行),
 *   非高频页面由客户端视口预取 + 点击时按需编译兜底,不再追求"全量预热"的伪极致。
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
      // 单次探测 8s 超时:dev server 重负载期(Turbopack 缓存压缩/大页编译)可能
      // 接受连接但长时间不响应,无超时会挂死整个轮询循环(2026-09-02 实测踩坑)
      const res = await fetch(base, { redirect: 'manual', signal: AbortSignal.timeout(8000) })
      if (res.status < 600) return true
    } catch {
      /* 未就绪/超时,继续等 */
    }
    await new Promise((r) => setTimeout(r, 2000))
  }
  return false
}

if (!(await waitUntilUp())) {
  log(`FAIL: ${base} 在 ${waitSec}s 内未就绪,放弃预热`)
  process.exit(1)
}

// 有界并发预热(2026-09-03 升级,根因:串行预热高频 12 条 × 单条冷编译 3~8s ≈ 2.5 分钟,
// 覆盖速度追不上用户点击 → 用户首次点击仍撞 3~8s 冷编译)。
// 关键权衡(前几轮 Sidebar 第七刀已实测定版):
//   - 串行(并发1):不饿死点击,但 12 条高频需 ~2.5 分钟,会话前几分钟仍冷;
//   - 无界并发:覆盖快,但多路由同挤 Turbopack 编译队列,用户点击排到队尾(实测 53s);
//   - 有界并发(4):Turbopack 编译本身串行(实测并发 6 请求呈梯度 1.2s→5.4s 排队),
//     但并发让请求在网络层提前排队、消除串行循环的"等前一个发起"空档,
//     高频 12 条 1 分钟内就绪;任意时刻最多 4 编译在飞,用户点击最坏只排 4 个之后。
//   - 优先级序:高频 12 条(用户最可能点)最先,1 分钟内必就绪;其余路由由客户端视口预取兜底。
const CONCURRENCY = 4
const warmOne = async (route) => {
  const t0 = Date.now()
  let ms, status
  try {
    // 单路由 90s 超时:个别路由冷编译超长时跳过而非挂死整个预热队列
    const res = await fetch(base + route, {
      headers: { 'user-agent': 'ihui-warm-dev-routes' },
      signal: AbortSignal.timeout(90000),
    })
    await res.arrayBuffer() // 必须读完 body,RSC 渲染才真正完成
    ms = Date.now() - t0
    status = res.status
  } catch (e) {
    ms = Date.now() - t0
    status = e.name === 'TimeoutError' ? 'TIMEOUT' : `ERR:${e.message.slice(0, 40)}`
  }
  return { route, ms, status }
}

const results = []
// 优先级序:ROUTES 已按 HIGH_FREQUENCY 在前 + sidebarHrefs 在后拼接;
// 有界并发 worker 池从游标取任务,严格保持数组序(高频先发)。
let cursor = 0
const worker = async () => {
  for (;;) {
    const i = cursor++
    if (i >= ROUTES.length) return
    const r = await warmOne(ROUTES[i])
    results.push(r)
    log(`${String(r.ms).padStart(6)}ms  ${r.status}  ${r.route}`)
  }
}
await Promise.all(Array.from({ length: Math.min(CONCURRENCY, ROUTES.length) }, () => worker()))
results.sort((a, b) => ROUTES.indexOf(a.route) - ROUTES.indexOf(b.route))

const slow = results.filter((r) => r.ms > 2000)
log(`预热完成: ${results.length} 条(并发 ${CONCURRENCY}),慢编译(>2s)${slow.length} 条${slow.length ? ' → ' + slow.map((r) => r.route).join(', ') : ''}`)
process.exit(0)
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
