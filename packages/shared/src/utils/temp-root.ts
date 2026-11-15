// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * 运行时合规临时根 —— 跨端唯一落点（AGENTS.md §15b 铁律）。
 *
 * 问题：各端业务源码里散落 `os.tmpdir()`，而 TEMP 环境变量可能钉在
 * `C:\Users\...\AppData\Local\Temp`，导致 agent 运行时把中间文件外泄到
 * 项目文件夹之外。scratch-dir.mjs（`mkScratch`/`rmScratch`）是**开发
 * 夹具专用**（`.DevEnv/Temp/ihui-scratch`），不适用于运行时业务路径。
 *
 * 本工厂把运行时临时根收敛到仓树内 `<仓根>/.DevEnv/tmp`：**在项目文件夹内**
 * （2026-11-15 收口，替代旧的 `~/.ihui/tmp` junction 方案——那个虽不写 C 盘
 * 却落在项目文件夹之外 `D:\DevEnv\cache\userhome\.ihui\tmp`）、已被 .gitignore
 * 覆盖、不写 C 盘、普通用户可写、不依赖 TEMP 环境变量。
 *
 * 单一真相源：apps/cli 与 apps/api 的运行时落盘点全部改道此处，
 * 端内不得再新建第二份 `os.tmpdir()` / `mkdtempSync(join(os.tmpdir()…))`。
 *
 * 安全闸性质（三档）：
 *   · `getRuntimeTempRoot()`     — 纯计算，不建目录，只返回绝对路径
 *   · `ensureRuntimeTempRoot()`  — 建目录（recursive），幂等，失败抛错
 *   · `runtimeTempPath(...segments)` — 追加段名，仍不建目录
 */

//
// 为什么本文件**不出现任何 `node:xxx` 静态导入**（2026-11-15 构建事故根因）：
// 本模块经 `packages/shared/src/utils/index.ts` → `packages/shared/src/index.ts` 进了
// `@ihui/shared` 的**通用桶**，而 web 端大量客户端组件 import 裸包名 ⇒ 它会被算进浏览器
// chunk 图。Turbopack 生成客户端 chunk（`/_not-found/page`）时对静态 `node:fs` 直接抛
//   the chunking context (unknown) does not support external modules (request: node:fs)
// ⇒ `next build` 整轮失败（deploy-loop 4 次重试全红，13:41 之后再无一次构建成功）。
// 铁律：**通用桶里不得出现 Node 内建的静态导入**。故这里把路径推导降为纯字符串运算
// （浏览器侧即便被打进 chunk 也无副作用——它永远不会被调用），只有 `ensureRuntimeTempRoot()`
// 真要建目录时才在**调用瞬间**用 `process.getBuiltinModule('node:fs')` 取内建模块
// （Node 22.3+ 官方 API，不产生模块图静态边）。新增本目录模块请照此办理。

/** 路径分隔符:由推导出的绝对路径形态自证(盘符开头=Windows),不额外取 node:os。 */
function separatorOf(p: string): string {
  return /^[A-Za-z]:/.test(p) ? '\\' : '/'
}

/**
 * 由 import.meta.url 推导仓根（纯字符串运算，不碰任何内建模块）。
 *
 * 本文件位于 `packages/shared/{src|dist}/utils/`：去掉文件名后再上溯 4 层即仓根
 * （utils→{src|dist}→shared→packages→仓根）。src 与 dist 同深度 ⇒ 同一套算法两处都对。
 */
function repoRootFromMetaUrl(metaUrl: string): string {
  const url = String(metaUrl ?? '')
  if (!/^file:\/\//i.test(url)) {
    throw new Error(`getRuntimeTempRoot 只支持 file:// URL 的运行时（收到：${url.slice(0, 40)}）`)
  }
  const decoded = decodeURIComponent(url.replace(/^file:\/\//i, ''))
  const segs = decoded.split(/[\\/]+/).filter(Boolean)
  if (segs.length <= 5) throw new Error(`仓根推导失败：import.meta.url 层级不足（${url}）`)
  const rootSegs = segs.slice(0, segs.length - 5)
  const drive = /^[A-Za-z]:$/.test(rootSegs[0] ?? '')
  const sep = separatorOf(rootSegs[0] ?? '')
  const head = drive ? `${rootSegs[0]}${sep}` : sep
  let out = `${head}${rootSegs.slice(drive ? 1 : 0).join(sep)}`
  while (out.length > head.length && out.endsWith(sep)) out = out.slice(0, -sep.length)
  return out
}

/** 取 node:fs 的最小面（只在 ensure 调用瞬间取，见文件头注）。 */
interface NodeFsLike {
  mkdirSync: (target: string, options?: { recursive?: boolean }) => unknown
}

function loadNodeFs(): NodeFsLike {
  const proc = (
    globalThis as unknown as { process?: { getBuiltinModule?: (id: string) => unknown } }
  ).process
  const mod = proc?.getBuiltinModule?.('node:fs') as NodeFsLike | undefined
  if (!mod || typeof mod.mkdirSync !== 'function') {
    throw new Error(
      'ensureRuntimeTempRoot 需要 Node 运行时（process.getBuiltinModule 取不到 node:fs）；' +
        '浏览器/edge 侧不得建目录，改用 getRuntimeTempRoot()',
    )
  }
  return mod
}

/**
 * 运行时合规临时根的绝对路径（纯计算，不建目录）。
 *
 * 落点：`<仓根>/.DevEnv/tmp`（仓树内、已被 .gitignore 覆盖、不写 C 盘、不依赖
 * TEMP 环境变量）。2026-11-15 收口：旧设计用 `~/.ihui/tmp`（junction 到
 * D:\DevEnv\cache\userhome\.ihui\tmp），虽不写 C 盘但落在项目文件夹之外；
 * 现按「所有文件都在项目文件夹内」要求改到仓内 `.DevEnv/tmp`。
 *
 * 仓根推导：用 import.meta.url 自身位置推导（禁 process.cwd()，共享工作区 cwd 不可靠，
 * AGENTS §15b 铁律）。
 */
export function getRuntimeTempRoot(): string {
  const repoRoot = repoRootFromMetaUrl(import.meta.url)
  return `${repoRoot}${separatorOf(repoRoot)}${['.DevEnv', 'tmp'].join(separatorOf(repoRoot))}`
}

/**
 * 确保运行时临时根存在（recursive mkdir，幂等），返回绝对路径。
 * 失败抛错而非静默回落 —— 调用方不得因建目录失败而退回 os.tmpdir()。
 */
export function ensureRuntimeTempRoot(): string {
  const root = getRuntimeTempRoot()
  loadNodeFs().mkdirSync(root, { recursive: true })
  return root
}

/**
 * 在运行时临时根下拼出目标路径（纯计算，不建目录）。
 * 例：runtimeTempPath('ihui-mermaid-123.png') → `<root>/ihui-mermaid-123.png`
 */
export function runtimeTempPath(...segments: string[]): string {
  const root = getRuntimeTempRoot()
  const sep = separatorOf(root)
  const parts = segments.map((s) => String(s ?? '')).filter((s) => s.length > 0)
  return parts.length ? `${root}${sep}${parts.join(sep)}` : root
}
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
