#!/usr/bin/env node
// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * 全量 TypeScript 类型检查脚本
 *
 * 用途：清除所有 .tsbuildinfo 增量缓存后强制全量 typecheck，
 *       防止增量缓存掩盖预存在错误（项目曾因 .tsbuildinfo 陈旧导致错误被掩盖）。
 *
 * 触发场景：
 *   - CI 定期全量检查（建议每周或发版前运行）
 *   - 手动怀疑缓存陈旧时运行
 *   - 升级 TypeScript / 调整 tsconfig.json 后运行
 *
 * 用法：pnpm typecheck:full
 */

import { readdirSync, statSync, rmSync, existsSync, readFileSync } from 'node:fs'
import { join, resolve } from 'node:path'
import { spawnSync } from 'node:child_process'
import { fileURLToPath } from 'node:url'
// G-611 产出侧:本脚本正是 check-typecheck:454 那套"族码 ⇒ 临时失败"集合的**被派生方**。
// 装之前,POSIX 信号杀走默认动作(无码),消费侧集合判据对它结构上失明;装之后,
// 可捕获的信号(SIGINT/SIGTERM/SIGPIPE/SIGBREAK)一律产出 128+N,父侧按同一把尺子归因。
// 集合/分类的唯一实现住 scripts/lib/signal-exit.mjs —— 不得在本文件再写一份。
import { installSignalExit } from './lib/signal-exit.mjs'

const __dirname = fileURLToPath(new URL('.', import.meta.url))
const ROOT = resolve(__dirname, '..')

const EXCLUDE_DIRS = new Set([
  '.git',
  '.next',
  '.pnpm-cache',
  '.pnpm-store',
  '.ihui-agent',
  '.turbo',
  '.worktrees',
  'node_modules',
])

/**
 * 陈旧 dist 前置重建(2026-09-27 立)。
 *
 * 为什么需要它:本脚本刻意用 `pnpm -r run typecheck` 而**不走 turbo**,因为 turbo 的
 * 并行/串行会把 `.tsbuildinfo` 与内存搅出竞态 —— 但 `turbo.json` 里 `typecheck` 的
 * `dependsOn: ["^build"]` 也跟着一起被绕开了。后果是:**依赖包的 `dist/` 永远不会被重建**,
 * 而 `dist/` 被 `.gitignore` 忽略、包清单的 `exports.types` 又指向 `dist/index.d.ts`,
 * 于是"类型检查通过/失败"这个结论可能来自一份**本机陈旧的产物快照**,而不是 HEAD 的源码。
 * 实测代价(2026-09-27):一个会话按 `tokens.brand.ctaForeground` 取配对前景被报
 * `TS2339: Property 'ctaForeground' does not exist`,而源码侧 `rn-tokens.ts` 的 brand 键集
 * 早就含 `cta/ctaForeground` —— 那是旧提交留下的 dist。守门 4(`check-stale-dist.mjs`)比的是
 * 顶层 export **名字集合**,嵌套键的形状变化(加一档 brand)它结构上看不见。
 *
 * 判据(只看 packages/ 下自建包,不碰 apps/):`src/` 里任一文件的 mtime 晚于 `dist/` 里
 * 最新文件 ⇒ 该包 dist 陈旧;`dist/` 整个不存在 ⇒ 同样陈旧(消费者按 types 字段解析会失败)。
 * dist 是本机构建物、仓库里没有对应 blob,所以这一维只能按磁盘判 —— 与本仓"dist 口径明写本机"
 * 的既有道理一致(守门 4 头注同条),不假装审过被审面。
 *
 * 失效方向:宁可多跑一次 build(秒级到十几秒),不可让一次类型检查拿着旧产物下结论。
 */
export function pickStalePackages(entries) {
  return entries
    .filter((e) => e.hasBuildScript && (e.distMissing || e.srcNewestMtimeMs > e.distNewestMtimeMs))
    .map((e) => e.name)
    .sort()
}

/** 递归取目录内文件的最新 mtime(跳过依赖与缓存目录);目录不存在返回 -1。 */
function newestMtimeMs(dir) {
  let out = -1
  const stack = [dir] // stack 只 push/pop 不重赋值 —— prefer-const(eslint --fix 同形)
  while (stack.length) {
    const cur = stack.pop()
    let entries = []
    try {
      entries = readdirSync(cur, { withFileTypes: true })
    } catch {
      continue
    }
    for (const ent of entries) {
      const full = join(cur, ent.name)
      if (ent.isDirectory()) {
        if (!EXCLUDE_DIRS.has(ent.name)) stack.push(full)
        continue
      }
      try {
        const ms = statSync(full).mtimeMs
        if (ms > out) out = ms
      } catch {
        /* 竞态删除:跳过 */
      }
    }
  }
  return out
}

/** 扫 packages/ 构造判据输入(纯 IO,判定逻辑在 pickStalePackages 里,便于用构造面证明)。 */
function collectPackageStates(packagesDir) {
  const out = []
  let dirs = []
  try {
    dirs = readdirSync(packagesDir, { withFileTypes: true })
      .filter((d) => d.isDirectory())
      .map((d) => d.name)
  } catch {
    return out
  }
  for (const name of dirs) {
    const pkgDir = join(packagesDir, name)
    let manifest
    try {
      manifest = JSON.parse(readFileSync(join(pkgDir, 'package.json'), 'utf8'))
    } catch {
      continue
    }
    const srcDir = join(pkgDir, 'src')
    const distDir = join(pkgDir, 'dist')
    if (!existsSync(srcDir) || !existsSync(distDir)) {
      if (manifest.scripts?.build && existsSync(srcDir))
        out.push({
          name: manifest.name || name,
          hasBuildScript: true,
          distMissing: !existsSync(distDir),
          srcNewestMtimeMs: newestMtimeMs(srcDir),
          distNewestMtimeMs: -1,
        })
      continue
    }
    out.push({
      name: manifest.name || name,
      hasBuildScript: !!manifest.scripts?.build,
      distMissing: false,
      srcNewestMtimeMs: newestMtimeMs(srcDir),
      distNewestMtimeMs: newestMtimeMs(distDir),
    })
  }
  return out
}

/**
 * 递归查找并删除所有 .tsbuildinfo 文件（排除依赖与构建缓存目录）。
 * @param {string} dir 当前扫描目录
 * @param {string[]} removed 已删除文件路径收集
 * @returns {string[]} 已删除文件路径列表
 */
function cleanTsbuildinfo(dir, removed = []) {
  let entries = []
  try {
    entries = readdirSync(dir)
  } catch {
    return removed
  }
  for (const entry of entries) {
    const full = join(dir, entry)
    let st
    try {
      st = statSync(full)
    } catch {
      continue
    }
    if (st.isDirectory()) {
      if (EXCLUDE_DIRS.has(entry)) continue
      cleanTsbuildinfo(full, removed)
    } else if (entry.endsWith('.tsbuildinfo')) {
      try {
        rmSync(full, { force: true })
        removed.push(full)
      } catch {
        /* 忽略删除失败（可能是 .next/cache 内的只读文件） */
      }
    }
  }
  return removed
}

// ─── 全局串行锁(2026-09-18 晚根治):杜绝多会话并行全量 typecheck ──
// 事故实证(WMI 取证):20:58/20:59 两棵 pnpm -r typecheck 树并行,CPU 打满且
// 各拉 ~30 个 cmd.exe 子进程。mkdir 原子锁 + 持有者 pid 存活检测(死进程残留锁
// 立即接管,stale 20min 兜底),与 git 写锁同款模式。
import {
  mkdirSync as _mkLock,
  readFileSync as _rdLock,
  writeFileSync as _wrLock,
  rmSync as _rmLock,
} from 'node:fs'
const _lockDir = resolve(ROOT, '.workbuddy/typecheck.lock')
const _lockMeta = join(_lockDir, 'meta.json')
const _LOCK_STALE_MS = 20 * 60 * 1000

// ─── 再入守卫(2026-09-18 深夜根治递归进程树洪水) ─────────────────────
// 根包 package.json "typecheck" = 本脚本(供 `pnpm typecheck` 直跑全量门)。
// 一旦 pnpm -r 把根包纳入执行(实测 ZOIMas 任务:根包被跑 → 本脚本再起 pnpm -r
// → 根包又被跑 → 指数级 node/pnpm/cmd 进程树,26 分钟进程洪水,CPU 打满且
// 派生链拉爆控制台),必须立即终止再入层:父层已在跑同一全量门,子层 exit 0 即可。
if (process.env.IHUI_TYPECHECK_FULL_CHILD === '1') {
  console.log('[typecheck:full] 检测到再入(父层全量门已在跑),根包层跳过(exit 0)')
  process.exit(0)
}
process.env.IHUI_TYPECHECK_FULL_CHILD = '1' // 传给 pnpm -r 子进程链

// G-611 产出侧装配(装在再入守卫之后、锁与主流程之前 —— 等锁/清缓存/派生全程都在射程内)。
// 说明:下方主派生是 spawnSync(阻塞事件循环),阻塞期间信号由 libuv 排队、监听器在阻塞
// 返回后才跑;组杀(CTRL_C / 进程组信号)时 pnpm 子进程同死,阻塞随即返回,码产出不迟。
// 不可捕获的强杀(TerminateProcess/taskkill /F)任何进程都产不出码 —— 与装本模块前一致,
// 增益在于"可捕获的那一半现在必有码",而锁清理仍由既有 process.on('exit') 兜住。
installSignalExit({ label: 'typecheck:full' })
function _pidAlive(pid) {
  if (!pid) return true
  try {
    process.kill(Number(pid), 0)
    return true
  } catch (e) {
    return e.code === 'EPERM'
  }
}
for (;;) {
  try {
    _mkLock(_lockDir, { recursive: false })
    _wrLock(_lockMeta, JSON.stringify({ pid: process.pid, ts: Date.now() }))
    break
  } catch {
    let meta = null
    try {
      meta = JSON.parse(_rdLock(_lockMeta, 'utf8'))
    } catch {
      /* meta 缺失按未知处理 */
    }
    const stale = !meta || Date.now() - (meta.ts ?? 0) > _LOCK_STALE_MS || !_pidAlive(meta.pid)
    if (stale) {
      _rmLock(_lockDir, { recursive: true, force: true })
      continue
    }
    console.log(`[typecheck:full] 另一全量 typecheck 进行中(pid ${meta.pid}),串行等待...`)
    spawnSync(process.execPath, ['-e', 'setTimeout(()=>{},5000)'], {
      stdio: 'ignore',
      windowsHide: true,
    })
  }
}
process.on('exit', () => {
  try {
    _rmLock(_lockDir, { recursive: true, force: true })
  } catch {
    /* 忽略 */
  }
})

/**
 * `--self-test`:只证 `pickStalePackages` 这一维判定,**必须跑在清 .tsbuildinfo 之前**
 * (那是破坏性动作;把自检挂在它后面等于每跑一次自检就清一次全量缓存)。
 * 本文件顶层就是 CLI 且无 §22d `isDirectRun` 守卫,所以镜像测试只能把脚本 spawn 起来验,
 * 不能 import 判据函数(§22c 记过这一型)。
 */
if (process.argv.includes('--self-test')) {
  let ok = 0
  let bad = 0
  const t = (name, cond) => {
    if (cond === true) ok++
    else bad++
    console.log(
      `  ${cond === true ? 'ok  ' : 'FAIL'} ${name}${cond === true ? '' : ` —— 实得:${String(cond)}`}`,
    )
  }
  const e = (over) => ({
    name: '@ihui/x',
    hasBuildScript: true,
    distMissing: false,
    srcNewestMtimeMs: 100,
    distNewestMtimeMs: 200,
    ...over,
  })
  t(
    'S1 src 比 dist 旧 ⇒ 不判陈旧(反向对照,证明不是"有 dist 就重建")',
    pickStalePackages([e({})]).length === 0,
  )
  t(
    'S2 src 比 dist 新 ⇒ 判陈旧(本维要抓的那一型)',
    pickStalePackages([e({ srcNewestMtimeMs: 300 })]).join() === '@ihui/x',
  )
  t(
    'S3 dist 整个不存在 ⇒ 判陈旧(消费者按 exports.types 解析 dist,缺就是不可信)',
    pickStalePackages([e({ distMissing: true, srcNewestMtimeMs: 100 })]).length === 1,
  )
  t(
    'S4 没有 build 脚本的包不吃这条前置(纯类型包无产物)',
    pickStalePackages([e({ hasBuildScript: false, srcNewestMtimeMs: 999 })]).length === 0,
  )
  t(
    'S5 同刻平手(mtime 相等)不判陈旧 —— 判据不得靠 >= 制造伪重建',
    pickStalePackages([e({ srcNewestMtimeMs: 200 })]).length === 0,
  )
  t(
    'S6 多包时输出稳定有序(报告要能逐条核)',
    pickStalePackages([
      e({ name: '@ihui/z', srcNewestMtimeMs: 300 }),
      e({ name: '@ihui/a', srcNewestMtimeMs: 300 }),
    ]).join() === '@ihui/a,@ihui/z',
  )
  console.log(`--self-test:${ok} 通过 / ${bad} 失败`)
  process.exit(bad ? 1 : 0)
}

console.log('[typecheck:full] 清除 .tsbuildinfo 增量缓存...')
const removed = cleanTsbuildinfo(ROOT)
if (removed.length === 0) {
  console.log('[typecheck:full] 未发现 .tsbuildinfo 文件，直接全量检查。')
} else {
  console.log(`[typecheck:full] 已删除 ${removed.length} 个 .tsbuildinfo 文件：`)
  for (const f of removed) {
    console.log(`  - ${f.replace(ROOT, '.')}`)
  }
}

/**
 * 前置:把陈旧的 packages 各包 dist 重建掉,再开始类型检查。
 * 重建失败 ⇒ 直接非零退出:此时任何"类型通过"的结论都不可信(要么拿着旧产物,要么产物残缺),
 * 而"安静地跳过重建"正是本格缺陷的表现形态。
 */
function staleDistPreflight() {
  if (process.env.IHUI_SKIP_STALE_DIST_PREFLIGHT === '1') {
    console.log(
      '[typecheck:full] ⚠️ 已用 IHUI_SKIP_STALE_DIST_PREFLIGHT=1 跳过陈旧 dist 前置重建。',
    )
    console.log('[typecheck:full]    跳过后,下面这些类型结论可能来自本机旧产物(见文件头注)。')
    return
  }
  const stale = pickStalePackages(collectPackageStates(join(ROOT, 'packages')))
  if (stale.length === 0) {
    console.log('[typecheck:full] 陈旧 dist 前置:packages 全部与源码同新,无需重建。')
    return
  }
  console.log(
    `[typecheck:full] 检测到 ${stale.length} 个包的 dist 比 src 旧(或整个不存在),先重建再 typecheck:`,
  )
  for (const n of stale) console.log(`  - ${n}`)
  for (const n of stale) {
    const r = spawnSync(`pnpm --filter ${n} build`, {
      cwd: ROOT,
      stdio: 'inherit',
      shell: true,
      windowsHide: true,
    })
    if (r.status !== 0) {
      console.error(
        `\n[typecheck:full] 重建 ${n} 失败(exit ${r.status ?? '?'})—— 不带着旧产物继续跑类型检查。`,
      )
      process.exit(r.status ?? 1)
    }
  }
  console.log('[typecheck:full] 前置重建完成,继续全量 typecheck。')
}

staleDistPreflight()

console.log('\n[typecheck:full] 运行 pnpm -r run typecheck（串行，避免 turbo 多进程竞态）...')
// 使用 pnpm -r 递归串行运行，避免 turbo 并行/串行时的 .tsbuildinfo 与内存竞态
const result = spawnSync('pnpm -r run typecheck', {
  cwd: ROOT,
  stdio: 'inherit',
  shell: true,
  windowsHide: true, // 根治:pnpm -r 给每个子包拉 cmd.exe,无此参数时控制台链断裂即弹可见窗口(实测一次 typecheck ~30 次闪窗)
})

if (result.status !== 0) {
  console.error(`\n[typecheck:full] 失败，退出码 ${result.status}`)
  process.exit(result.status ?? 1)
}

// ─── Phase 1.5:e2e typecheck 阻断门(2026-07-26 立) ──
// 背景:apps/web/e2e/ 有独立 tsconfig.json(extends tsconfig.base.json),
//       主 typecheck (apps/web/tsconfig.json) exclude e2e/,
//       历史 27 处 e2e TS 错误长期无 CI 捕获,2026-07-26 已清零并接入 CI。
// 升级:把 e2e typecheck 加入 typecheck:full,pre-push 钩子相应阻止 push,
//       防止 e2e 类型错误再次回流(本地 push 时也会跑,跳过用 HUSKY_SKIP_E2E_TYPECHECK=1)。
//
// 跳过:HUSKY_SKIP_E2E_TYPECHECK=1(紧急 push 时使用,但建议修复后正常 push)。
const webE2eTsconfig = resolve(ROOT, 'apps/web/e2e/tsconfig.json')
if (existsSync(webE2eTsconfig)) {
  if (process.env.HUSKY_SKIP_E2E_TYPECHECK === '1') {
    console.log(
      '\n[typecheck:full] ⚠️  HUSKY_SKIP_E2E_TYPECHECK=1 — 已跳过 e2e typecheck(不推荐, e2e 类型错误不会阻塞 push)',
    )
  } else {
    console.log('\n[typecheck:full] 运行 apps/web/e2e typecheck (blocking)...')
    const e2eResult = spawnSync('pnpm', ['--filter', '@ihui/web', 'typecheck:e2e'], {
      cwd: ROOT,
      stdio: 'inherit',
      shell: true,
      windowsHide: true,
    })

    if (e2eResult.status !== 0) {
      console.error(
        `\n[typecheck:full] ❌ e2e typecheck 失败(exit ${e2eResult.status ?? 'unknown'}),apps/web/e2e/ 类型错误需修复`,
      )
      console.error('[typecheck:full]    修复后验证:pnpm --filter @ihui/web typecheck:e2e')
      console.error(
        '[typecheck:full]    跳过(不推荐):HUSKY_SKIP_E2E_TYPECHECK=1 pnpm typecheck:full',
      )
      process.exit(e2eResult.status ?? 1)
    }
    console.log('[typecheck:full] ✅ e2e typecheck 通过(apps/web/e2e/ 无类型错误)')
  }
} else {
  console.log('\n[typecheck:full] 未发现 apps/web/e2e/tsconfig.json,跳过 e2e typecheck 阶段')
}

// ─── Phase 2:mypy 阻断门(2026-07-26 立, AGENTS_history 见 mypy-blocking 段) ──
// 背景:apps/ai-service 是核心 AI 服务(FastAPI + LangGraph + LiteLLM),
//       Python 类型错误长期无 CI 捕获,mypy 仅作 informational 提示。
// 升级:把 mypy 错误从 informational 升级为 blocking,mypy 退出码 != 0
//       立即终止 typecheck:full,pre-push 钩子相应阻止 push。
//
// 渐进式策略(避免一次性 strict=true 把整个 CI 阻塞在 1000+ 既有错误上):
//   - 阶段一(本任务):strict=false + check_untyped_defs=true
//     捕获基础类型错误(name-defined / no-any-return / unused-ignore 等),
//     允许现有无类型注解的代码继续编译。
//   - 阶段二(follow-up):按模块逐个 enable strict_optional / disallow_untyped_defs /
//     warn_return_any 等严格项,每启用一项就要求该模块所有错误清零。
//   - 阶段三(目标态):全部 strict=true,所有 [no-untyped-def] / [no-any-return] 错误清零。
//
// 当前基线(2026-07-26):~1400 既有错误(分布在 ~85 文件,主要为 no-untyped-call /
//   no-untyped-def / type-arg 等),由 follow-up 任务逐文件修复。
//
// 跳过:HUSKY_SKIP_MYPY=1(紧急 push 时使用,但建议修复后正常 push)。
const aiServiceDir = resolve(ROOT, 'apps/ai-service')
if (existsSync(aiServiceDir)) {
  if (process.env.HUSKY_SKIP_MYPY === '1') {
    console.log(
      '\n[typecheck:full] ⚠️  HUSKY_SKIP_MYPY=1 — 已跳过 mypy 阻断门(不推荐, Python 类型错误不会阻塞 push)',
    )
  } else {
    // 2026-08-06:优先使用项目自带 .venv 的 mypy,避免依赖全局 PATH 的
    // uv trampoline(Windows 上 uv 无法 spawn Python 子进程 → 误报失败阻塞 push)。
    // 2026-09-10:CI 的 typecheck job 不安装 Python,裸 `mypy` 触发 exit 127,整条 typecheck 误红。
    //   mypy 的权威阻塞门在 ci-monorepo.yml 的 test-python job(装 uv + deps 后 blocking 跑
    //   `mypy app/`);本脚本只在「能解析到 mypy」时做一次同口径二次校验,解析不到则明确跳过、不阻塞。
    const mypyCandidates = [
      join(aiServiceDir, '.venv/Scripts/mypy.exe'), // Windows
      join(aiServiceDir, '.venv/bin/mypy'), // Unix/macOS
    ]
    let mypyExecutable = mypyCandidates.find((p) => existsSync(p))
    if (!mypyExecutable) {
      // 回退:探测 PATH。仅当 `mypy --version` 真正成功(status 0)才认可,
      // 避免 shell:true 下 `command not found` 也返回非 0 被误当可用。
      const probe = spawnSync('mypy', ['--version'], {
        shell: true,
        stdio: 'ignore',
        windowsHide: true,
      })
      if (probe.status === 0) mypyExecutable = 'mypy'
    }

    if (!mypyExecutable) {
      console.log(
        '[typecheck:full] ⚠️  未找到 mypy(无 apps/ai-service/.venv,且 PATH 中也不存在)。\n' +
          '[typecheck:full]     已跳过本地 mypy 二次校验 —— 权威阻塞门是 CI 的 test-python job\n' +
          '[typecheck:full]     (uv pip install --system -e ".[dev]" 后 blocking 跑 mypy app/)。\n' +
          '[typecheck:full]     本地启用:cd apps/ai-service && uv sync(生成 .venv 后重跑)。',
      )
    } else {
      console.log(`\n[typecheck:full] 运行 apps/ai-service mypy (blocking) [${mypyExecutable}]...`)
      const mypyResult = spawnSync(mypyExecutable, ['app/'], {
        cwd: aiServiceDir,
        stdio: 'inherit',
        shell: true,
        windowsHide: true,
      })

      if (mypyResult.status !== 0) {
        console.error(
          `\n[typecheck:full] ❌ mypy 失败(exit ${mypyResult.status ?? 'unknown'}),Python 类型错误需修复`,
        )
        console.error(
          '[typecheck:full]    详细配置:见 apps/ai-service/pyproject.toml [tool.mypy] 段注释',
        )
        console.error(
          '[typecheck:full]    既有错误清单(基线):见 commit message "mypy 升级 blocking 基线" 段',
        )
        console.error('[typecheck:full]    跳过(不推荐):HUSKY_SKIP_MYPY=1 pnpm typecheck:full')
        process.exit(mypyResult.status ?? 1)
      }
      console.log('[typecheck:full] ✅ mypy 通过(无 Python 类型错误)')
    }
  }
} else {
  console.log('\n[typecheck:full] 未发现 apps/ai-service 目录,跳过 mypy 阶段')
}

console.log('\n[typecheck:full] 全量类型检查通过(TS + mypy)。')
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
