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
 *   无需换命令即可拿到预热。
 *
 * 行为(顺序即安全边界,不可重排):
 *   0. 先拿 dev 锁(**本进程**做持有人,心跳盯自己的 pid,退出经 quit() 交还);
 *   0.5 锁内前置:① `unlock-dev-prefetch.mjs`(改 next dist 的 dev 预取守卫)
 *       ② 缓存治理 —— 默认 `clean-turbopack-cache.mjs`(超阈值才清);带 `--purge` 则整清
 *       `apps/web/.next` + `apps/web/.dev.lock`;
 *   0.7 后端保证(2026-10-12 根治「前端能开、后端没起」):起 next dev **之前**先经
 *       `dev-stack.mjs` 把 postgres/redis/api/ai-service 探活并补齐,必需三件套
 *       (postgres/redis/api)起不来 ⇒ 打印修复指引后 quit(1) 阻断前端启动 —— 否则
 *       拿到的是一个"页面能访问、接口全 500"的假活前端,比直接起不来更难查。
 *       详见 BACKEND 段落;逃生档 `--no-backend`(后端由你自己管)。
 *   1. 前台 spawn `next dev [--turbopack] -p 8801`(stdio / 退出码透传);
 *   1.5 运行期看守:每 30s 复探后端,掉线自动经 dev-stack 重拉(冷却 60s 防刷屏);
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
 *   node scripts/dev-with-warmup.mjs --no-backend             # 跳过后端保证(后端自管)
 * 未知参数 ⇒ exit 2 并打印用法(静默忽略会让"以为自己在整清"的人拿到一份没整清的启动)。
 */

import { spawn, spawnSync } from 'node:child_process'
import { mkdirSync, openSync, rmSync } from 'node:fs'
import net from 'node:net'
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
// 参数只有四档,未知参数直接判死(见文件头"用法")。
const ARGV = process.argv.slice(2)
const ALLOWED_ARGS = new Set(['--purge', '--no-turbopack', '--no-backend'])
const UNKNOWN_ARG = ARGV.find((a) => !ALLOWED_ARGS.has(a))
if (UNKNOWN_ARG) {
  console.error(
    `[dev-warmup] 未知参数:${UNKNOWN_ARG}\n` +
      '  只接受 --purge(整清 apps/web/.next 与 .dev.lock)、--no-turbopack(起普通 dev)\n' +
      '  与 --no-backend(跳过后端保证)。\n' +
      '  静默忽略未知参数 = 让"以为自己在整清"的人拿到一份没整清的启动。',
  )
  process.exit(2)
}
const PURGE = ARGV.includes('--purge')
const TURBOPACK = !ARGV.includes('--no-turbopack')
// 后端保证的逃生档:只在"后端由别的会话 / 我自己管、不想让本脚本碰它"时用。
// 它不是默认,也不是推荐 —— 用了它就回到改前那条老路(前端能开、后端没人管)。
const SKIP_BACKEND = ARGV.includes('--no-backend')
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

// ============ 0.7) 后端保证(2026-10-12 根治「前端能开、后端没起」) ============
// 为什么住在 web 的启动器里,而不是"起 web 时顺手提醒一句":
//   改前 `pnpm --filter @ihui/web dev`(以及 turbo 里 api 那条挂掉的档)起完 next dev
//   就算完事,后端死活无人负责 —— 结果就是 8801 能开、接口全 500,比"前端直接起不来"
//   更难查(你会先怀疑前端)。用户拍板:后端就绪是前端的**硬前置门**,起不来就阻断。
// 为什么探活与拉起全部委托 dev-stack.mjs,这里不自己拼一份:
//   探活(双栈 TCP + HTTP)、依赖顺序(postgres→redis→api)、.env 预检(canStart)、
//   僵尸清理(killStale)、日志落盘(.tmp-sync/dev-stack-*.log)、以及**基础设施端口真值**
//   (PG/Redis 端口从 apps/api/.env 的 DSN 解析)全都已在那里成文 —— 本机 PG 在 5432、
//   Redis(Memurai)在 6379,端口表里的 8810/8811 是约定形态,在此处再硬编码一遍端口
//   就是第二份会漂移的真值(本仓记过多次)。⇒ 这里只认**服务名**,端口一律问 dev-stack。
// 唯一自探的是 8802:它是应用端口(约定=实况),且要为"正在启动中"的宽限窗口做秒级轮询,
// 不值得为此 spawn 一次子进程。
const DEV_STACK_SCRIPT = path.join(REPO_ROOT, 'scripts', 'dev-stack.mjs')
const BACKEND_REQUIRED = ['postgres', 'redis', 'api'] // 起不来 ⇒ 阻断前端启动
const BACKEND_OPTIONAL = ['ai-service'] // 挂了只告警(与 dev-stack 的 required:false 同判据)
const BACKEND_ALL = [...BACKEND_REQUIRED, ...BACKEND_OPTIONAL]
const API_PORT = 8802 // 应用端口,非基础设施端口,硬编码与 dev-port-registry.json 一致
const API_HEALTH = `http://localhost:${API_PORT}/health`
const BACKEND_GRACE_MS = 60_000 // "端口已监听但 /health 未通"的在启动宽限窗口
const BACKEND_TIMEOUT_S = 240 // dev-stack 单服务就绪等待
//   240 而非其默认 120:本机 api 冷启动在负载高时(预热 + 编译同跑)实测两次 >120s ——
//   dev-stack 到点会给还在启动的 api 上 killStale 再开一轮,**每次重试都把冷启动时钟
//   归零**,于是"永远差一点点"地无限打转(2026-10-12 12:51~12:56 连续两轮 start-timeout
//   即此型)。把窗口放宽到 240s 给它跑完;随之 spawnSync 上限也放宽(四服务最坏串行)。
const WATCHDOG_INTERVAL_MS = 30_000 // 运行期复探间隔
const WATCHDOG_COOLDOWN_MS = 60_000 // 一次重拉失败后的重试冷却(防刷屏)

function tcpOpen(port, timeout = 1200) {
  return new Promise((resolve) => {
    const sock = net.connect({ port, host: '127.0.0.1' })
    const done = (ok) => {
      sock.destroy()
      resolve(ok)
    }
    sock.setTimeout(timeout)
    sock.once('connect', () => done(true))
    sock.once('timeout', () => done(false))
    sock.once('error', () => done(false))
  })
}

async function apiHealthy() {
  try {
    const res = await fetch(API_HEALTH, { signal: AbortSignal.timeout(3000) })
    return res.status < 500
  } catch {
    return false
  }
}

// 跑一轮 dev-stack(--json 拿结构化结果,便于区分"必需"与"可选"分别处置)。
// 不用 --json 就只能看退出码 ⇒ 必然把 ai-service 的可选失败也当成阻断,语义就错了。
// 一次覆盖 BACKEND_ALL:ensure 对已就绪服务只探活、不重复拉起,所以"全探"既是最简单
// 的调用形态,也天然免去"先自探再决定探哪些"这一步(那需要在本地再写一份端口真值)。
function runDevStack() {
  const r = spawnSync(
    process.execPath,
    [
      DEV_STACK_SCRIPT,
      `--only=${BACKEND_ALL.join(',')}`,
      '--json',
      `--timeout=${BACKEND_TIMEOUT_S}`,
    ],
    {
      cwd: REPO_ROOT,
      encoding: 'utf8',
      windowsHide: true,
      timeout: 1_000_000, // 四个服务串行等待的上限护栏(4×240s + 启动开销),防 spawnSync 永久挂起
      maxBuffer: 8 * 1024 * 1024,
    },
  )
  if (r.error) return { ok: false, error: `dev-stack 派生失败:${r.error.message}` }
  if (r.signal)
    return { ok: false, error: `dev-stack 被信号 ${r.signal} 终止(信号退出不得读成"后端已就绪")` }
  const out = `${r.stdout ?? ''}`
  const m = out.match(/\{[\s\S]*\}/)
  if (!m) {
    const tailOut = `${out}\n${r.stderr ?? ''}`.trim().slice(-2000)
    return { ok: false, error: `dev-stack 输出无法解析(退出码 ${r.status}):\n${tailOut || '(无输出)'}` }
  }
  let parsed
  try {
    parsed = JSON.parse(m[0])
  } catch (e) {
    return { ok: false, error: `dev-stack JSON 解析失败:${e?.message ?? e}` }
  }
  return { ok: r.status === 0, results: Array.isArray(parsed.results) ? parsed.results : [] }
}

function renderBackendResults(results) {
  for (const r of results) {
    const required = BACKEND_REQUIRED.includes(r.name)
    const icon = r.status === 'up' ? '✅' : required ? '❌' : '⚠️'
    const note =
      r.status === 'up'
        ? r.action === 'none'
          ? '已在跑(复用,未重复拉起)'
          : `已拉起(${r.action})`
        : `${r.status}${r.hint ? ` — ${r.hint}` : ''}`
    log(`  ${icon} ${String(r.name).padEnd(11)} :${r.port}  ${note}`)
  }
}

// 后端服务名 → 必需/可选分类,返回 dev-stack 的 result 对象(带 port / status / hint)
function classify(results) {
  const pick = (n) => results.find((r) => r.name === n)
  return {
    downRequired: BACKEND_REQUIRED.map(pick).filter((r) => r && r.status !== 'up'),
    downOptional: BACKEND_OPTIONAL.map(pick).filter((r) => r && r.status !== 'up'),
  }
}

async function ensureBackend() {
  if (SKIP_BACKEND) {
    log('已按 --no-backend 跳过后端保证 ⇒ 后端死活本脚本不再负责')
    return true
  }
  // 宽限窗口:8802 有人监听但 /health 不通 ⇒ 多半是另一路入口(turbo / start-dev.ps1 /
  // 本脚本的看守)正在启动它。等它起来,而不是立刻丢给 dev-stack —— dev-stack 会对 api
  // killStale 再拉一个实例(若它由 turbo 起、无 pid 文件 ⇒ 杀不掉,只剩端口冲突 +
  // 一个僵死的 tsx 父进程)。端口压根没开时这里不等,直接走 dev-stack(冷启动不白等)。
  if (await tcpOpen(API_PORT)) {
    log(`8802 已在监听但 /health 未就绪 ⇒ 判为"正在启动中",给 ${BACKEND_GRACE_MS / 1000}s 宽限`)
    const deadline = Date.now() + BACKEND_GRACE_MS
    let ready = false
    while (Date.now() < deadline) {
      if (await apiHealthy()) {
        ready = true
        break
      }
      await new Promise((r) => setTimeout(r, 1500))
    }
    if (ready) {
      log('api 已在宽限窗口内就绪 ✅(复用在跑实例)')
      return afterRun(await runDevStack())
    }
    log('宽限窗口内仍未就绪 ⇒ 交给 dev-stack 复置(清掉僵死实例后重拉)')
  }

  log(`后端就绪检查(委托 dev-stack,覆盖 ${BACKEND_ALL.join('/')})…`)
  return afterRun(await runDevStack())
}

// 启动门的判定出口:必需三件套必须全 up,否则阻断;可选失败只告警。
// 显式取 `results`(而非只看退出码)—— dev-stack 的退出码语义是"必需项全绿",
// 而我们要在这里按**自己的**必需/可选名单再判一次,免得两处口径漂移。
async function afterRun(run) {
  if (!run.results) {
    log(`❌ ${run.error}`)
    printBackendAbort(BACKEND_REQUIRED)
    return false
  }
  renderBackendResults(run.results)
  const { downRequired, downOptional } = classify(run.results)
  if (downOptional.length) {
    log(`⚠️ 可选后端未就绪(不阻断前端):${downOptional.map((r) => r.name).join(', ')}`)
  }
  if (downRequired.length) {
    printBackendAbort(downRequired.map((r) => r.name))
    return false
  }
  log('后端必需服务已就绪 ✅')
  return true
}

function printBackendAbort(downNames) {
  console.error(
    `[dev-warmup] 后端未就绪 ⇒ 已阻断 next dev 启动\n` +
      `  缺:${downNames.join(' ')}\n` +
      '  为什么不硬起前端:那样你会拿到"页面能开、接口全 500"的假活前端,查起来更费劲。\n' +
      '  手动体检/自愈:  node scripts/dev-stack.mjs\n' +
      '  看失败日志:    .tmp-sync/dev-stack-<服务>.log 与 .err.log\n' +
      '  常见根因:      apps/api/.env 缺失(DATABASE_URL/JWT_SECRET 未定义 ⇒ api 拒绝启动)、\n' +
      '                 Windows 服务 postgresql-x64-* / Memurai / redis 未运行、\n' +
      '                 8802 被上一轮残留进程占用(端口以 .env 的 DSN 为准,不是 8810/8811)\n' +
      '  逃生档(后端自管,不推荐): pnpm --filter @ihui/web dev -- --no-backend\n',
  )
}

// 运行期看守:启动门只保证"起的那一瞬间",后端在前端跑着的时候崩掉同样会造成
// 「前端能开、后端不好使」。每 30s 跑一轮 dev-stack —— 它本身就是"探活 + 按需重拉",
// 全绿时只探活、不重复起服务,故这一轮同时兼任"探"与"治"。
// 60s 冷却:起不来的服务(如 ai-service 的 .venv 缺失)每轮都会重试,但只在冷却期外
// 打一行,免得 30s 刷一屏把真正的报错淹掉。
function startBackendWatchdog() {
  if (SKIP_BACKEND) return
  let busy = false // spawnSync 同步阻塞 ⇒ 用标志而非 timer 重入
  let lastAttempt = null
  const tick = () => {
    if (busy) return
    busy = true
    try {
      const run = runDevStack()
      if (!run.results) {
        const key = `!${(run.error ?? '').slice(0, 80)}`
        if (!lastAttempt || lastAttempt.key !== key || Date.now() - lastAttempt.ts >= WATCHDOG_COOLDOWN_MS) {
          lastAttempt = { key, ts: Date.now() }
          log(`❌ 看守:dev-stack 执行失败:${run.error}`)
        }
        return
      }
      const { downRequired, downOptional } = classify(run.results)
      // 本轮发生了实际重拉(探活发现 down ⇒ dev-stack 就地拉起并等到 up):
      // 不打这行,一次成功的救援就是无声的 —— 排查者只能靠进程列表反推
      // "它刚才到底掉没掉"。这行就是拍板要的「自动重拉 + 日志提示」里的提示。
      const revived = run.results.filter((r) => r.status === 'up' && r.action && r.action !== 'none')
      if (revived.length) {
        log(
          `🔁 看守:发现 ${revived.map((r) => `${r.name}(:${r.port})`).join(' ')} 掉线,` +
            '本轮已自动重拉 ✅',
        )
      }
      const down = [...downRequired, ...downOptional]
      if (!down.length) {
        if (lastAttempt) log('后端已恢复 ✅(看守继续)')
        lastAttempt = null
        return
      }
      const key = down.map((r) => r.name).join(',')
      if (
        lastAttempt &&
        lastAttempt.key === key &&
        Date.now() - lastAttempt.ts < WATCHDOG_COOLDOWN_MS
      ) {
        return // 冷却期内这一组已报过,dev-stack 也已在每轮尝试重拉,无需再刷
      }
      lastAttempt = { key, ts: Date.now() }
      log(
        `⚠️ 后端未就绪:${down.map((r) => `${r.name}(:${r.port})`).join(' ')} ` +
          `— dev-stack 本轮已尝试重拉,${WATCHDOG_COOLDOWN_MS / 1000}s 后再试`,
      )
      renderBackendResults(run.results)
      if (downRequired.length) {
        log(`  ❌ 必需项仍 down:${downRequired.map((r) => r.name).join(', ')}(日志 .tmp-sync/dev-stack-*.log)`)
      }
    } catch (e) {
      log(`❌ 看守异常:${e?.message ?? e}`)
    } finally {
      busy = false
    }
  }
  setInterval(tick, WATCHDOG_INTERVAL_MS)
  log(
    `后端看守已启动(每 ${WATCHDOG_INTERVAL_MS / 1000}s 跑一轮 dev-stack 探活+按需重拉,` +
      `告警冷却 ${WATCHDOG_COOLDOWN_MS / 1000}s)`,
  )
}

// 0.7 的调用点:必须在 spawn `next dev` **之前**。次序反了就等于没做 ——
// "前端先起来、后端慢慢补"中间那段窗口正是用户点名要消灭的假活状态。
if (!(await ensureBackend())) quit(1)

// 1) 前台 dev server。用 next 的**绝对入口**直启(与 dev-stack.mjs 的 NEXT_ENTRY 同口径),
//    不走 shell + 裸 `next`:后者依赖 pnpm 注入的 node_modules/.bin 到 PATH,而文件头「用法」
//    允许直接 `node scripts/dev-with-warmup.mjs` —— 那一档没有 .bin 在 PATH 里,裸 `next`
//    会 "is not recognized"(2026-10-12 实测),与调用方式无关的启动才是真入口。
const NEXT_ENTRY = path.join(WEB_DIR, 'node_modules', 'next', 'dist', 'bin', 'next')
const dev = spawn(
  process.execPath,
  [NEXT_ENTRY, 'dev', ...(TURBOPACK ? ['--turbopack'] : []), '-p', String(PORT)],
  {
    cwd: WEB_DIR,
    stdio: 'inherit',
    windowsHide: true, // 防 Windows 弹可见 cmd 窗口
  },
)
dev.on('error', (e) => {
  console.error(`[dev-warmup] 启动 next dev 失败:${e.message}`)
  quit(1)
})
// 退出必须走 quit():直接 process.exit 会把锁留在原地"按年龄等着被抢",
// 而这正是心跳要消掉的那段无人保护窗口。
dev.on('exit', (code) => quit(code ?? 0))

// 1.5) 运行期后端看守(next dev 已在跑 ⇒ 现在掉线不再阻断,改为自动重拉)
startBackendWatchdog()

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
