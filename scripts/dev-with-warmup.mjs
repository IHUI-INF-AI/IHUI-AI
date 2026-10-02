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
 * 行为(顺序即安全边界,不可重排):
 *   0. 先拿 dev 锁(**本进程**做持有人,心跳盯自己的 pid,退出经 quit() 交还);
 *   0.5 锁内前置:① `unlock-dev-prefetch.mjs`(改 next dist 的 dev 预取守卫)
 *       ② 缓存治理 —— 默认 `clean-turbopack-cache.mjs`(超阈值才清);带 `--purge` 则整清
 *       `apps/web/.next` + `apps/web/.dev.lock`;
 *   1. 前台 spawn `next dev [--turbopack] -p 8801`(stdio / 退出码透传);
 *   2. (仅默认档)等 http://localhost:8801 就绪后,以 detached 后台进程跑
 *      `warm-dev-routes.mjs`(默认 PRIORITY_ROUTES 全量 36 条),
 *      日志 .ihui-agent/tmp/dev-logs/web-warmup.log;
 *      带 `--purge` 或 `--no-turbopack` 时**不预热** —— 那两档改动前就是"裸起服务",
 *      它们是拿来对照观感/排查编译的逃生档,顺手加预热会改变被测对象本身;
 *   3. 预热失败 / 超时只打日志,绝不影响 dev server 本身。
 *
 * 为什么 0.5 必须在锁**之内**、且必须在 next dev 之前(两条各自成立、方向相反):
 *   - 之内:`clean-turbopack-cache` 与 `--purge` 删的是 `.next`,而并发构建正在往里写
 *     —— 8-09 那两个构建同时写 `.next` 导致 8801 短暂 502 就是这一型。此前这三步由
 *     apps/web 的 npm 脚本用 `&&` 串在本脚本**之前**,那段窗口结构上在锁外。
 *   - 之前:铁律"严禁 next dev 运行中清缓存"(见 clean-turbopack-cache.mjs 文件头)——
 *     运行时删 .sst 会让 .meta 引用已删文件 ⇒ RocksDB 损坏 ⇒ 对应路由永久挂起。
 *   两个前提同时满足的唯一位置就是"拿到锁之后、起服务之前"。
 *
 * 用法(正常无需直接调用,由 `pnpm dev` / `dev:clean` / `dev:stable` 拉起):
 *   node scripts/dev-with-warmup.mjs                          # 等价旧 `dev`
 *   node scripts/dev-with-warmup.mjs --purge                  # 等价旧 `dev:clean`
 *   node scripts/dev-with-warmup.mjs --purge --no-turbopack    # 等价旧 `dev:stable`
 * 未知参数 ⇒ exit 2 并打印用法(静默忽略会让"以为自己在整清"的人拿到一份没整清的启动)。
 */

import { spawn, spawnSync } from 'node:child_process'
import { mkdirSync, openSync, rmSync } from 'node:fs'
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
// 参数只有三档,未知参数直接判死(见文件头"用法")。
const ARGV = process.argv.slice(2)
const UNKNOWN_ARG = ARGV.find((a) => a !== '--purge' && a !== '--no-turbopack')
if (UNKNOWN_ARG) {
  console.error(
    `[dev-warmup] 未知参数:${UNKNOWN_ARG}\n` +
      '  只接受 --purge(整清 apps/web/.next 与 .dev.lock)与 --no-turbopack(起普通 dev)。\n' +
      '  静默忽略未知参数 = 让"以为自己在整清"的人拿到一份没整清的启动。',
  )
  process.exit(2)
}
const PURGE = ARGV.includes('--purge')
const TURBOPACK = !ARGV.includes('--no-turbopack')
// 锁内前置要派生的两个脚本(与本脚本同目录,按自身位置推导,不跟 cwd 走)。
const PREFETCH_SCRIPT = path.join(REPO_ROOT, 'scripts', 'unlock-dev-prefetch.mjs')
const CACHE_HYGIENE_SCRIPT = path.join(REPO_ROOT, 'scripts', 'clean-turbopack-cache.mjs')
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
//    原先没覆盖的一格(2026-10-02 已收):三步前置(改 next dist 的 dev 预取守卫 / 缓存治理 /
//    整清)此前由 apps/web 的 npm 脚本用 `&&` 串在本脚本**之前**,那段窗口结构上在锁外 ——
//    而 `dev:clean` 的 `rimraf .next` 删的正是并发构建在写的目录(8-09 那型)。现三步都搬进
//    本脚本、排在 acquire 之后 spawn 之前 ⇒ 既在锁内(不与构建重叠),又在 next dev 之前
//    (不违反"严禁运行中清缓存"那条铁律)。
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

// 0.5) 锁内前置:① 改 next dist 的 dev 预取守卫 ② 缓存治理(默认按阈值清,--purge 整清)。
//      失败即停 —— 与改动前 `a && b && c` 的短路语义一致:宁可不起服务,也不要起一个
//      "缓存没清 / 守卫没打"的半成品 dev(那会把"启动慢"当成新缺陷去查)。
//      派生一律 windowsHide:§5b —— 无控制台父进程下派生控制台程序不带它必弹黑窗。
function runStep(file) {
  const r = spawnSync(process.execPath, [file], {
    cwd: REPO_ROOT,
    stdio: 'inherit',
    windowsHide: true,
  })
  if (r.error) return { ok: false, why: `派生失败(${r.error.code ?? r.error.message})` }
  if (r.signal)
    return { ok: false, why: `被信号 ${r.signal} 终止(不是正常退出码,不得读成"这一步过了")` }
  if (r.status !== 0) return { ok: false, why: `退出码 ${r.status}` }
  return { ok: true }
}
{
  const steps = [
    { label: 'dev 预取守卫', file: PREFETCH_SCRIPT },
    PURGE ? { label: '整清 .next', purge: true } : { label: '缓存治理', file: CACHE_HYGIENE_SCRIPT },
  ]
  for (const s of steps) {
    // --purge 走进程内 rmSync:原先三条入口用 `rimraf .next .dev.lock`(cwd=apps/web),
    // 语义等价(recursive + force,不存在不算失败)。`.dev.lock` 是另一把老锁
    // (scripts/check-lock.mjs 的 dev-vs-build 标记),**不是** .deploy.lock —— 两把别混;
    // 删它不影响本锁的归属判据(本锁在项目根 .deploy.lock,由 acquire 与心跳自己管)。
    const r = s.purge
      ? (() => {
          try {
            for (const p of [path.join(WEB_DIR, '.next'), path.join(WEB_DIR, '.dev.lock')])
              rmSync(p, { recursive: true, force: true })
            return { ok: true }
          } catch (e) {
            return { ok: false, why: `rmSync 抛错:${e?.code ?? e?.message ?? e}` }
          }
        })()
      : runStep(s.file)
    if (!r.ok) {
      console.error(`[dev-warmup] ${s.label} 未成功(${r.why})⇒ 不起 next dev;锁按原路径交还`)
      quit(1)
    }
    log(`${s.label} 已完成(在锁内、next dev 之前)`)
  }
}

// 1) 前台 dev server。经 shell 执行,与原来的 `next dev --turbopack -p 8801` 完全等价
//    (由 npm/pnpm 注入的 PATH 解析 apps/web/node_modules/.bin/next,跨平台通吃)。
const dev = spawn(`next dev${TURBOPACK ? ' --turbopack' : ''} -p ${PORT}`, {
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

if (!TURBOPACK || PURGE) {
  // 预热只在默认 `dev` 档跑 —— `--purge` 那两档(dev:clean / dev:stable)改动前就是"裸起服务、
  // 不预热",它们是拿来对照观感 / 排查编译的逃生档,顺手加预热会改变被测对象本身。
  log(
    `跳过预热(${PURGE ? '--purge 档改动前就不预热' : '--no-turbopack 档'});要预热请用 pnpm dev`,
  )
} else if (!(await waitReady())) {
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
