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
import { randomBytes } from 'node:crypto'
// dev 锁的归属判据只有一份,住在 deploy-lock.mjs:这里 import 它,不在启动器里再拼一遍
// "锁目录在不在 / meta 怎么读"(两处算同一件事必漂移,本仓记过多次)。
import { acquire, release, lockOwnedBy } from './deploy-lock.mjs'

const REPO_ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const WEB_DIR = path.join(REPO_ROOT, 'apps', 'web')
const PORT = 8801
const BASE = `http://localhost:${PORT}`
const WARM_LOG_DIR = path.join(REPO_ROOT, '.ihui-agent', 'tmp', 'dev-logs')
const WARM_LOG = path.join(WARM_LOG_DIR, 'web-warmup.log')
const DEPLOY_LOCK_SCRIPT = path.join(REPO_ROOT, 'scripts', 'deploy-lock.mjs')
// 本进程自己的凭据:acquire 时给定 ⇒ 心跳与释放都凭同一枚,不需要从 stdout 里把别人打印的
// token 抠回来(那是一条会被改文案打断的隐式契约)。
const LOCK_TOKEN = randomBytes(16).toString('hex')
// 2026-09-12 二次修正:不再传 `--top N`。warm-dev-routes.mjs 的默认行为已是
// PRIORITY_ROUTES 全量(36 条,显式有序清单,含 /news、/vip、/points、/orders、
// /member、/personas、/about、/plugins 等用户高频页)。
// 此前传 `--top 18` 的追加源是 nav-data.ts 的文件顺序(前 130 行是 admin 主题页 +
// MODELS_CHILDREN),实际追加的全是"主题配置页 + 模型子页",用户真正会点的页面一条没热
// —— 这才是"扩到 30 条还是卡"的真因。清单已改为显式维护,故这里只跑默认全量。

const log = (...m) => console.log(`[dev-warmup ${new Date().toISOString().slice(11, 19)}]`, ...m)

// 0) 拿到 dev 锁 **再** 起 next dev。
//    为什么由本进程持有,而不是继续留在 apps/web 的 predev:
//    predev 是一条**与 dev server 分离**的 npm 生命周期脚本 —— 它自己的 shell 在 predev
//    跑完就退了,而 deploy-lock 判活问的是"这段锁的 owner 还活着吗"。所以旧形态下锁从
//    `dev` 第一步(unlock-dev-prefetch / clean-turbopack-cache)起就已经是**悬挂锁**
//    ("持有者已退出的悬挂锁不限锁龄立即抢占" ⇒ 任何一次构建落地即抢),它谁也没挡住 ——
//    这正是 AGENTS §12 登记的"dev 侧靠 30min 硬上限兜底"那格空白的成因。
//    本进程 spawn `next dev` 并等它退出,是唯一"看得见 dev server 生死"的常驻方
//    ⇒ 锁归它、心跳盯它、退出时它自己交还。
//    仍未覆盖的一格,如实登记:`clean-turbopack-cache` 跑在本脚本之前,那一段在锁外
//    (与改动前同样是锁外 —— 旧锁此刻已是悬挂态;要收进锁里得把清缓存也搬进本脚本,另计)。
let ownsDevLock = false
try {
  await acquire({
    mode: 'dev',
    timeoutMs: 600_000,
    staleMs: 600_000,
    ownerPid: process.pid,
    token: LOCK_TOKEN,
  })
  // acquire 在"dev+dev 共存"那一档也返回 true 而**没有写 meta** ⇒ 返回 true 不等于"锁是我的"。
  // 只有真是本凭据写下的那把,才派心跳、才负责释放 —— 否则就是替别人的锁永久续期。
  ownsDevLock = lockOwnedBy(LOCK_TOKEN)
} catch (e) {
  // 拿不到锁就是"有生产构建正在写 .next",起 dev 会把两边都写坏(8-09 那次 8801 502 的同型)。
  // 这里不降级、不"先起了再说":等锁是既有语义,只是现在它有真凭据了。
  console.error(`[dev-warmup] 未能取得 dev 锁,已停止启动 next dev:${e?.message ?? e}`)
  process.exit(1)
}
if (ownsDevLock) {
  // 常驻心跳:独立进程,detached,盯**本进程**的 pid。
  // 它买到两件事 —— 续 ts(锁龄不再被误读成"pid 复用")与主人一退出就交还锁。
  // windowsHide + stdio ignore:§5b —— detached 起控制台程序不带 windowsHide 必弹黑窗。
  try {
    const hb = spawn(
      process.execPath,
      [
        DEPLOY_LOCK_SCRIPT,
        'heartbeat',
        '--mode',
        'dev',
        '--token',
        LOCK_TOKEN,
        '--watch-pid',
        String(process.pid),
      ],
      { cwd: REPO_ROOT, detached: true, windowsHide: true, stdio: 'ignore' },
    )
    hb.unref()
    log('dev 锁心跳已派出(盯本进程 pid,退出即交还锁)')
  } catch (e) {
    // 心跳起不来 ⇒ 锁退化成"按年龄判"的既有形态。必须喊出来,但不能因此不起 dev:
    // 硬上限/stale 那两条线仍然在兜底,而"因为加固失败就不干活"是把改进变成事故。
    log(`⚠️ 心跳派生失败,本轮回到既有"按年龄/stale"兜底判据(不是已续期):${e?.message ?? e}`)
  }
} else {
  log('已并入另一台在跑的 dev server 的锁(共存档)⇒ 本进程不持锁、不派心跳、也不负责释放')
}
const quit = (code) => {
  if (ownsDevLock) {
    try {
      release({ mode: 'dev', token: LOCK_TOKEN })
    } catch (e) {
      log(`⚠️ 释放 dev 锁失败(交给下一位按 stale/硬上限收口):${e?.message ?? e}`)
    }
  }
  process.exit(code)
}
process.on('SIGINT', () => quit(130))
process.on('SIGTERM', () => quit(143))

// 1) 前台 dev server。经 shell 执行,与原来的 `next dev --turbopack -p 8801` 完全等价
//    (由 npm/pnpm 注入的 PATH 解析 apps/web/node_modules/.bin/next,跨平台通吃)。
const dev = spawn(`next dev --turbopack -p ${PORT}`, {
  cwd: WEB_DIR,
  stdio: 'inherit',
  shell: true,  windowsHide: true, // 防 Windows 弹可见 cmd 窗口
})
dev.on('error', (e) => {
  console.error(`[dev-warmup] 启动 next dev 失败:${e.message}`)
  quit(1)
})
// 退出必须走 quit():直接 process.exit 会把锁留在原地"按年龄等着被抢",
// 而这正是心跳要消掉的那段无人保护窗口。
dev.on('exit', (code) => quit(code ?? 0))

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
