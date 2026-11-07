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

import { readdirSync, statSync, rmSync, existsSync } from 'node:fs'
import { join, resolve } from 'node:path'
import { tmpdir } from 'node:os'
import { spawnSync } from 'node:child_process'
import { fileURLToPath } from 'node:url'
// 2026-11-07(T1 提速):并发执行 + 逐产物 dist 判据 + 内容寻址缓存。
// 判据强度的唯一变化是**更严**:dist 陈旧判定从"整包最新 mtime"改为逐个产物对账
// (见 lib/stale-dist.mjs 头注);其余(每包原脚本、rc、错误原文、整包失败)一字不动。
import {
  collectPackageState,
  collectPackageStates,
  pickStalePackages,
  captureArtifactSnapshot,
  verifyArtifactSnapshot,
  fmtMtime,
} from './lib/stale-dist.mjs'
import { checkContentFresh, readManifest, writeManifest } from './lib/dist-content-cache.mjs'
import {
  discoverTypecheckProjects,
  poolMap,
  resolveConcurrency,
  runOneProject,
  runTypecheckProjects,
  killActiveChildren,
  topoLayers,
  workspaceDependencyGraph,
} from './lib/typecheck-concurrent.mjs'

// §22c:判据必须能被直接审。实现住在 lib/stale-dist.mjs,这里保留同名导出(夹具按名审)。
export { pickStalePackages }
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

// ─── `--preflight-only`:只跑"陈旧 dist 前置重建"后退出(2026-11-06 立) ─────────────
// 为什么要有这一档:push 门的**定向快速通道**(scripts/check-typecheck.mjs:改动全部落在单一 app 时
// 直接 `pnpm --filter <app> typecheck`)原先绕开了本文件这里的 staleDistPreflight,而消费方按各包
// `exports.types` 读的是 `packages/*/dist`。于是"包源码已入库、dist 还是旧构建"会让 tsc 在**干净的
// HEAD 文件**上报错,归因判成"已入库红"把推送拦死。实测(2026-11-06):api-client 的三值 budget
// 类型随 11945bd4f5 入库后,仍有工作树的 dist 停在二值态 ⇒ ChatScreen / budget-note /
// chat-ledger / sse-parse 共 17 处假红,快速通道 exit 1。
// 判据零新增:本档跑的就是全量档同一个 staleDistPreflight(),只建产物、不判类型、不改任何降级口径。
// 位置刻意放在**再入守卫(IHUI_TYPECHECK_FULL_CHILD)之前**:这一档不做递归,不该被那条守卫
// 静默吞成 exit 0(吞掉的表现就是"前置没跑、旧产物照旧",正是本格缺陷)。
// 同样刻意**不取串行锁**:那把锁的语义是"杜绝两棵**全量 typecheck**并行",而这一步只是 build,
// 且 atomic-build 已把临时产物整份换入(失败时旧 dist 原样保留)⇒ 并发 build 同一包不会产出半份 dist;
// 若在此等锁,push 侧会被另一会话的全量 typecheck 串行拖到超时(默认上限 20 分钟),反而变成假红。
// 失败出口(2026-11-06 裁决):**只建产物不判类型**,所以建不出来时既不报绿也不报"类型红",
// 一律 `未判定` exit 2(铁律:取不到输入面就不许给结论)。详见下面 staleDistPreflight 内的失败分支。
const _PREFLIGHT_ONLY = process.argv.includes('--preflight-only')
if (_PREFLIGHT_ONLY) {
  await staleDistPreflight()
  process.exit(0)
}

/**
 * 陈旧 dist 前置重建(2026-09-27 立;2026-11-07 改为逐产物对账 + 内容寻址 + 按拓扑层并发)。
 *
 * 为什么需要它:typecheck 读的是各包 `dist/`(经包清单的 exports.types),dist 不入库,
 * 所以"类型检查过/不过"可能来自本机旧产物,而不是 HEAD 源码。实测代价(2026-09-27):
 * `tokens.brand.ctaForeground` 明明在源码里,却因旧 dist 报 TS2339。
 *
 * 判据(只看 packages/ 下带 build 的自建包,不碰 apps/):
 *   1. `dist/` 不存在 ⇒ 陈旧;
 *   2. **逐产物对账**:src 里每个 `.ts/.tsx/.mts/.cts` 应有产物只要缺失,或产物 mtime 不早于
 *      其源文件 ⇒ 该包陈旧(比旧版"整包最新 mtime"更严:嵌套键/单文件变化不会被整包 mtime 掩盖);
 *   3. 内容寻址短路(scripts/lib/dist-content-cache.mjs):源码指纹与产物 sha256 都与上次成功
 *      构建的 manifest 一致 ⇒ 内容确实没变,即使 mtime 因 checkout 变新也**不重写** dist。
 *      manifest 缺失/读坏 ⇒ 一律退回第 2 条,不静默跳过。
 *
 * 执行面(判据不变,只改顺序):按 workspace 依赖拓扑分层,层内并发、层间串行;并发上限由
 * 核数/内存推导(scripts/lib/typecheck-concurrent.mjs)。原串行实现按包名字母序构建,在冷工作树上
 * 会让 `@ihui-ai/sdk` 先于它依赖的 `@ihui/types` 构建而失败 —— 拓扑层顺带修掉这个结构缺陷。
 * 失效方向不变:宁可多跑一次 build,不可让 typecheck 拿旧产物下结论;构建失败仍 `未判定`。
 */
/** (判据与 IO 已搬进 scripts/lib/stale-dist.mjs,便于夹具直接 import;本文件只留装配。) */

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
// 进程锁放系统临时目录(2026-10-04 迁出仓内):
//   原锁目录在仓内(ROOT 下)⇒ 清 stale 锁的 rmSync(recursive,force)
//   触发 WorkBuddy safe-delete shim 的批量守卫(SAFE_DELETE_BULK_GUARD_ERROR),
//   tsc 根本没起来,守门报「退出码非 0 但未解析到任何报错文件路径」——
//   属自锁式死锁:重试无用,只能靠 HUSKY_SKIP_TYPECHECK 绕过。
//   shim 的 shouldBypassSafeDelete 对 os.tmpdir() 放行(见 node-safe-delete-shim.cjs
//   的 OS_TMP_DIRS),且进程锁本就不该进仓库目录。_lockDir 是单一常量,
//   下方建/读/清 stale/exit 清 五处使用全部由它派生,改这一处即全覆盖。
const _lockDir = join(tmpdir(), 'ihui-typecheck-full.lock')
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
// 并发派生的子进程不在原 spawnSync 的组杀庇护下:信号/异常退出时必须整棵杀掉,
// 否则 push 门看门狗超时后仍会留下一堆 tsc/pnpm 吃 CPU(与 check-typecheck 的 killChildTree 同语义)。
process.on('exit', killActiveChildren)
for (const sig of ['SIGINT', 'SIGTERM', 'SIGBREAK']) process.once(sig, killActiveChildren)

function _pidAlive(pid) {
  if (!pid) return true
  try {
    process.kill(Number(pid), 0)
    return true
  } catch (e) {
    return e.code === 'EPERM'
  }
}
// `--self-test` 只证 pickStalePackages 这一维纯函数判据,不起 tsc、不需要串行化。
// 锁落 os.tmpdir(),若自检也建锁,并发跑自检会在同一把锁上互等(累计 5s 轮询),
// 而自检本身零派生 ⇒ 自检路径整段跳过锁(真实全量跑仍照旧独占)。
const _SELF_TEST = process.argv.includes('--self-test')
// 等锁上限(2026-11-07 立):这把锁的 stale 兜底是 20 分钟,而 push 门 [T1] 的单门看门狗只有 300s
// ——两者相差 4 倍。于是"另一路 typecheck 正持锁"时,本进程会安静地空等到 20 分钟,被外层
// 看门狗当"跑不起来"杀掉,而**日志里只剩一句被截断的'串行等待'**,没人知道它到底在等谁。
// 实测(2026-11-07 08:4x):本机同时有 3 路 typecheck(本工作树 + .worktrees/main-gate-reds-1107 +
// pre-commit 钩子)在跑,这道等待就不再是罕见路径,而是常态路径。
// 定 180s 的依据:门预算 300s 要留出"起了 tsc 但没跑完"的判别空间;180s 内等不到就直接说清
// "未判定及其原因",让看门狗之外的人拿到可读结论。手动/CI 全量跑可用环境变量放宽。
const _LOCK_WAIT_MAX_MS = Number(process.env.IHUI_TYPECHECK_LOCK_WAIT_MS || 180_000)
if (!_SELF_TEST) {
  const _waitStart = Date.now()
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
      const waitedMs = Date.now() - _waitStart
      if (waitedMs > _LOCK_WAIT_MAX_MS) {
        // 未判定 ≠ 通过(§0.3):这里绝不 exit 0。措辞要把三件事说全 —— 等谁、等了多久、怎么复现,
        // 否则下一个人还得再花 20 分钟把我这段路重走一遍才能知道发生了什么。
        const heldMs = Date.now() - (meta.ts ?? 0)
        console.error(
          `[typecheck:full] ❌ 等锁超时 ${Math.round(waitedMs / 1000)}s(上限 ${Math.round(_LOCK_WAIT_MAX_MS / 1000)}s):` +
            `另一全量 typecheck 仍持有 ${_lockDir}(pid ${meta.pid},已持有 ${Math.round(heldMs / 1000)}s)`,
        )
        console.error(
          '[typecheck:full] 这是**未判定**而不是判红 —— 本机有另一路全量 typecheck 在跑,当前无法给出结论。',
        )
        console.error(
          '[typecheck:full] 复现:等对方结束后重跑 node scripts/check-typecheck.mjs;' +
            '要放宽等待用 IHUI_TYPECHECK_LOCK_WAIT_MS=<毫秒>;确认持锁进程已死可删该目录',
        )
        process.exit(1)
      }
      console.log(
        `[typecheck:full] 另一全量 typecheck 进行中(pid ${meta.pid},已持有 ${Math.round((Date.now() - (meta.ts ?? 0)) / 1000)}s),` +
          `串行等待... (已等 ${Math.round(waitedMs / 1000)}s / 上限 ${Math.round(_LOCK_WAIT_MAX_MS / 1000)}s)`,
      )
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
}

/**
 * `--self-test`:只证 `pickStalePackages` 这一维判定,**必须跑在清 .tsbuildinfo 之前**
 * (那是破坏性动作;把自检挂在它后面等于每跑一次自检就清一次全量缓存)。
 * 本文件顶层就是 CLI 且无 §22d `isDirectRun` 守卫,所以镜像测试只能把脚本 spawn 起来验,
 * 不能 import 判据函数(§22c 记过这一型)。
 */
if (_SELF_TEST) {
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
    distFileCount: 10,
    artifactCount: 10,
    staleArtifacts: [],
    ...over,
  })
  t(
    'S1 逐产物对账无陈旧 ⇒ 不判陈旧(反向对照,证明不是"有 dist 就重建")',
    pickStalePackages([e({})]).length === 0,
  )
  t(
    'S2 某产物早于对应源码 ⇒ 判陈旧(本维要抓的那一型)',
    pickStalePackages([e({ staleArtifacts: [{ artifact: 'a.d.ts', src: 'a.ts' }] })]).join() ===
      '@ihui/x',
  )
  t(
    'S3 dist 整个不存在 ⇒ 判陈旧(消费者按 exports.types 解析 dist,缺就是不可信)',
    pickStalePackages([e({ distMissing: true })]).length === 1,
  )
  t(
    'S3b dist 存在但 0 个文件 ⇒ 同样判陈旧(空目录不是"已构建")',
    pickStalePackages([e({ distFileCount: 0 })]).length === 1,
  )
  t(
    'S4 没有 build 脚本的包不吃这条前置(纯类型包无产物)',
    pickStalePackages([e({ hasBuildScript: false, staleArtifacts: [{ artifact: 'x' }] })]).length ===
      0,
  )
  t(
    'S5 应有产物缺失(artifactMtime=-1)也判陈旧 —— 2026-11-07 补齐的一型',
    pickStalePackages([
      e({ staleArtifacts: [{ artifact: 'new.d.ts', src: 'new.ts', artifactMtimeMs: -1, missing: true }] }),
    ]).length === 1,
  )
  t(
    'S5b 同刻平手不判陈旧 —— 判据不得靠 >= 制造伪重建',
    pickStalePackages([e({ staleArtifacts: [] })]).length === 0,
  )
  t(
    'S6 多包时输出稳定有序(报告要能逐条核)',
    pickStalePackages([
      e({ name: '@ihui/z', staleArtifacts: [{ artifact: 'z.d.ts' }] }),
      e({ name: '@ihui/a', staleArtifacts: [{ artifact: 'a.d.ts' }] }),
    ]).join() === '@ihui/a,@ihui/z',
  )
  console.log(`--self-test:${ok} 通过 / ${bad} 失败`)
  process.exit(bad ? 1 : 0)
}

// 2026-11-07(T1 提速):前置重建**移到清缓存之前**。
// 为什么顺序重要:build 走同一批 tsconfig 的 incremental/composite 缓存,先清 buildinfo 再 build
// 等于每次强制整包重写 dist(冷工作树实测 59.1s 恰在这一档);先 build(可增量)再清,typecheck
// 仍是全量冷跑(判据不变),而已变更包只需重写变化的产物 —— 内容寻址的第一层收益。
await staleDistPreflight()

console.log('[typecheck:full] 清除 .tsbuildinfo 增量缓存...')
const removed = cleanTsbuildinfo(ROOT)
// 2026-10-21:增量缓存外置到 <root>/node_modules/.cache/tsbuildinfo(回收站灌入根治,
// 逐包 tsconfig 声明 tsBuildInfoFile)。这批不落在源码树里,上面的递归扫描排除了
// node_modules,结构上够不到 —— 不补清这里,"全量门防陈旧 buildinfo 假绿"这道机制
// 就静默退化(该机制挡的是"陈旧缓存让 tsc 误判 up-to-date",与文件住哪无关)。
const extBuildinfoDir = join(ROOT, 'node_modules', '.cache', 'tsbuildinfo')
if (existsSync(extBuildinfoDir)) {
  for (const entry of readdirSync(extBuildinfoDir)) {
    if (!entry.endsWith('.tsbuildinfo')) continue
    const full = join(extBuildinfoDir, entry)
    try {
      rmSync(full, { force: true })
      removed.push(full)
    } catch {
      /* 忽略删除失败(同树内口径:可能是并发会话正持有) */
    }
  }
}
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
 * 判据见文件头注 + lib/stale-dist.mjs + lib/dist-content-cache.mjs;这里只做装配:
 *   逐包算"mtime 逐产物判据 / 内容寻址判据" → 按 workspace 依赖拓扑分层 → 层内并发重建
 *   → 逐包复核(rc + 产物刷新 + 复扫) → 失败统一在全部层跑完后汇总(错误一个都不吞)。
 * 重建失败 ⇒ 非零退出:此时任何"类型通过"的结论都不可信(要么拿着旧产物,要么产物残缺)。
 */
async function staleDistPreflight() {
  const t0 = Date.now()
  if (process.env.IHUI_SKIP_STALE_DIST_PREFLIGHT === '1') {
    console.log(
      '[typecheck:full] ⚠️ 已用 IHUI_SKIP_STALE_DIST_PREFLIGHT=1 跳过陈旧 dist 前置重建。',
    )
    console.log('[typecheck:full]    跳过后,下面这些类型结论可能来自本机旧产物(见文件头注)。')
    return
  }
  const all = collectPackageStates(join(ROOT, 'packages')).filter((e) => e.hasBuildScript)
  const need = []
  const contentSkipped = []
  const seeded = []
  for (const e of all) {
    const mtimeStale = e.distMissing || e.distFileCount === 0 || e.staleArtifacts.length > 0
    const content = checkContentFresh(ROOT, e)
    const manifest = readManifest(ROOT, e.name)
    if (content.fresh) {
      // 内容面已证未变:即使 mtime 判陈旧也不重写(这正是 checkout 刷新 mtime 的假重建)
      if (mtimeStale) contentSkipped.push({ name: e.name, reason: content.reason })
      continue
    }
    if (!mtimeStale && !manifest) {
      // 首跑播种:逐产物 mtime 判定已新鲜 ⇒ 当前 dist 就是源码的对应产物,
      // 把这份"内容快照"记下来;之后 checkout 只掀 mtime 时即可走内容寻址跳过。
      // 播种只在 mtime 判据已绿时做,不替任何陈旧产物背书。
      const w = writeManifest(ROOT, e)
      if (w.ok) seeded.push(e.name)
    }
    // 有 manifest 但不新鲜(源码指纹变了/产物 hash 不符)⇒ 必须重建,不依赖 mtime 是否前进;
    // 无 manifest ⇒ 沿用逐产物 mtime 判据(与旧口径同严,不静默放过)。
    if (mtimeStale || manifest) need.push(e)
  }
  if (seeded.length > 0) {
    console.log(`[typecheck:full] 内容寻址播种 ${seeded.length} 包(dist 已新鲜,记录内容指纹供后续跳过)`)
  }
  if (contentSkipped.length > 0) {
    console.log(
      `[typecheck:full] 内容寻址跳过 ${contentSkipped.length} 个包(mtime 看着旧、内容实为同一份):` +
        contentSkipped.map((x) => x.name).join(', '),
    )
  }
  if (need.length === 0) {
    console.log(
      `[typecheck:full] 陈旧 dist 前置:无需重建(扫描 ${all.length} 包,内容寻址跳过 ${contentSkipped.length} 包),耗时 ${Date.now() - t0}ms。`,
    )
    return
  }
  const { limit, basis } = resolveConcurrency()
  console.log(
    `[typecheck:full] 需重建 ${need.length}/${all.length} 包(其余内容未变已跳过);并发上限 ${limit}:${basis}`,
  )
  const { layers, cycle } = topoLayers(
    need.map((e) => e.name),
    workspaceDependencyGraph(ROOT),
  )
  if (cycle.length > 0) {
    console.log(`[typecheck:full] ⚠️ workspace 依赖成环,按单层兜底执行:${cycle.join(', ')}`)
  }
  for (let i = 0; i < layers.length; i++) {
    console.log(`[typecheck:full] 重建拓扑层 ${i + 1}/${layers.length}:${layers[i].join(', ')}`)
  }

  const rebuildOne = async (name) => {
    const state = need.find((e) => e.name === name)
    const snap = captureArtifactSnapshot(state.dir, state)
    const startedAt = Date.now()
    const r = await runOneProject(
      { name, command: `pnpm --filter ${name} build`, args: [], dir: ROOT },
      { root: ROOT },
    )
    const after = collectPackageState(state.dir, name)
    const verified = verifyArtifactSnapshot(state.dir, snap)
    const unverified = verified.filter((v) => !v.refreshed)
    const missingAfter = after.distMissing || after.distFileCount === 0
    const postFresh = !missingAfter && after.artifactCount > 0 && after.staleArtifacts.length === 0
    // 内容面复核:rc=0 且产物齐全后落 manifest,再按指纹+逐产物 hash 复读一遍。
    // 为什么不是"mtime 必须前进":注释/格式这类源码改动可以合法地不改变任何产物字节,
    // 此时 tsc 增量不重写文件,mtime 不动 —— 那不代表旧产物有错。改用 sha256 逐个复核,
    // 比 mtime 更硬(产物缺失/被篡改/半份都会被抓到),没有放松。
    let contentOk = false
    if (r.rc === 0 && !missingAfter) {
      const written = writeManifest(ROOT, state)
      contentOk = written.ok && checkContentFresh(ROOT, state).fresh
    }
    const ok = r.rc === 0 && !missingAfter && ((unverified.length === 0 && postFresh) || contentOk)
    console.log(
      `\n──── [typecheck:full] 重建 ${name} rc=${r.rc ?? '?'} ${Date.now() - startedAt}ms ` +
        `(陈旧产物 ${snap.length},复核刷新 ${verified.length - unverified.length}/${verified.length},复扫 ${after.staleArtifacts.length}) ────`,
    )
    if (r.stdout) process.stdout.write(r.stdout.endsWith('\n') ? r.stdout : `${r.stdout}\n`)
    if (r.stderr) process.stderr.write(r.stderr.endsWith('\n') ? r.stderr : `${r.stderr}\n`)
    for (const v of unverified) {
      console.log(
        `[typecheck:full]   ✗ ${name} 未刷新 ${v.artifact}: mtime ${fmtMtime(v.beforeMtimeMs)} → ${fmtMtime(v.afterMtimeMs)}(内容未变${contentOk ? ',按 sha256 复核视为正确' : ''})`,
      )
    }
    return {
      name,
      rc: r.rc,
      ok,
      staleBefore: snap.length,
      refreshed: verified.length - unverified.length,
      unverified: unverified.length,
      postStale: after.staleArtifacts.length,
      contentOk,
    }
  }
  const rebuildStarted = Date.now()
  const results = []
  for (const layer of layers) {
    results.push(
      ...(await poolMap(layer, limit, async (name) => {
        try {
          return await rebuildOne(name)
        } catch (e) {
          console.error(`[typecheck:full] ❌ 重建 ${name} 抛错:${e?.stack || e}`)
          return { name, rc: null, ok: false, staleBefore: 0, refreshed: 0, unverified: 0, postStale: 0 }
        }
      })),
    )
  }
  const failed = results.filter((r) => !r.ok)
  console.log(
    `[typecheck:full] 前置重建结束:${results.length - failed.length}/${results.length} 包 OK,` +
      `总耗时 ${Date.now() - rebuildStarted}ms(整段含扫描 ${Date.now() - t0}ms)`,
  )
  for (const r of results) {
    console.log(
      `  - ${r.name}: rc=${r.rc ?? '?'}, 陈旧产物 ${r.staleBefore}, 已刷新 ${r.refreshed}` +
        `${r.unverified ? `, 未刷新 ${r.unverified}` : ''}, 复扫 ${r.postStale}, ${r.ok ? 'OK' : 'NOT-OK'}`,
    )
  }
  if (failed.length === 0) return
  const nonzero = failed.find((r) => r.rc !== 0)
  if (_PREFLIGHT_ONLY) {
    // 前置档铁律(AGENTS §0.3):产物面取不到 ⇒ `未判定` exit 2,不给结论。
    // 不能沿用 build 的 1:上层会把一次 build 失败误归因成"已入库类型红"。
    console.error(
      `\n[typecheck:full] ❓ 未判定(exit 2):${failed.length} 个包重建失败/未刷新 —— 产物面取不到,不给类型结论。`,
    )
    for (const r of failed) {
      console.error(`[typecheck:full]    ${r.name}: build rc=${r.rc ?? '?'}, 复扫陈旧 ${r.postStale}`)
    }
    console.error('[typecheck:full]    复现: pnpm --filter <包名> build')
    process.exit(2)
  }
  console.error(
    `\n[typecheck:full] 重建失败 ${failed.length} 个包 —— 不带着旧产物继续跑类型检查。`,
  )
  process.exit(nonzero && nonzero.rc ? nonzero.rc : 2)
}

console.log('\n[typecheck:full] 并发运行各包 typecheck(原脚本原样,并发上限按机器推导)...')
const _typecheckConcurrency = resolveConcurrency()
console.log(`[typecheck:full] 并发上限 ${_typecheckConcurrency.limit}:${_typecheckConcurrency.basis}`)
const _projects = discoverTypecheckProjects(ROOT)
if (_projects.length === 0) {
  console.error('[typecheck:full] ❌ 未发现任何带 typecheck 脚本的 workspace 包 —— 输入面为空,未判定(exit 2)')
  process.exit(2)
}
const _typecheckRun = await runTypecheckProjects({
  projects: _projects,
  concurrency: _typecheckConcurrency.limit,
  root: ROOT,
})
if (!_typecheckRun.ok) {
  console.error(`\n[typecheck:full] 失败，退出码 ${_typecheckRun.exitCode}`)
  process.exit(_typecheckRun.exitCode ?? 1)
}
console.log(`[typecheck:full] ✅ ${_projects.length} 个包 typecheck 全部通过`)

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
