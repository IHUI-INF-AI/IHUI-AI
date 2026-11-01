// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * web 腿「Tailwind 工具类 → 声明体 / px」的**唯一取源**(票 O67,2026-11-01)。
 *
 * 为什么要有它:门 128 的 web 腿此前对写成 Tailwind 工具类的档**零判据** —— `min-h-0` /
 * `min-w-0` / `resize-none` 这类类名在 web 自己的 `.css` 里当然查不到定义(它们由构建期
 * 按主题生成),于是 `classArmVerdicts` 只能把它们逐枚记成"未判定"。逐枚点名是对的,
 * 但"永远判不出"等于这一维对 web 腿空转。本文件把"这类名到底生成什么声明"变成可解析输入。
 *
 * 取源口径(为什么不是手敲一张类名字典):
 *  - 输入 = **被审面**的 `apps/web/app/globals.css` 及其 `@import` 闭包(样式源),加上安装的
 *    `tailwindcss` 包本身。类名 → 声明体的映射由 Tailwind 自己的编译器算,不是本文件抄的。
 *  - 主题值(`--spacing: 0.25rem` / `--spacing-md: 12px`)同样来自编译产物里的 `@layer theme`,
 *    所以"档值从哪来"与 web 构建期是同一份材料。
 *  - 编译在**子进程**里跑(约 250ms):`compile()` 是 async API,而门的 `collect` 是同步函数,
 *    16 处测试直接调它;为这一点把整条链改成 async 会把判据面拆成两套时序。
 *
 * 失效方向(§0.3):入口样式表不在被审面 / 编译器缺席 / 输出不是 JSON / 某个类没被生成 ——
 * 一律返回"不可用 / 没有这个类"的可读原因,由门逐枚记**未判定**;本文件永不返回一个猜的 px,
 * 也永不把"没解析到"写成"该侧无档"。
 *
 * 唯一实现纪律:类的声明体归一化只走 `lengthToPx`(折算表住在 `lib/length-units.mjs`,
 * 本文件不另建一份);这里不判断"哪些属性算几何档"—— 那是门体 `readGeometry` 的地盘,
 * 本文件只把长度值解成 px 后原样交出去,免得同一件事在两处各判一次。
 */
import { execFileSync } from 'node:child_process'
import { fileURLToPath } from 'node:url'
import { lengthToPx } from './length-units.mjs'

/** 编译入口(web 的全局样式入口;主题、插件、`@source` 都在这一份里声明)。 */
export const WEB_UTILITY_ENTRY_REL = 'apps/web/app/globals.css'

/**
 * 入口 `@import` 到、但**不在** `apps/web` 目录树里的样式源。
 * 缺一份 ⇒ 编译跑不起来 ⇒ 本维按未判定报名(不静默少读)。
 */
export const WEB_UTILITY_CLOSURE_EXTRA = [
  'packages/design-tokens/src/styles/tokens.css',
  'packages/design-tokens/src/styles/base.css',
]

export const WEB_UTILITY_WORKER_REL = 'scripts/lib/web-utility-compile-worker.mjs'

/** 解值递归上限(与 `length-units` 的常量表达式同一条纪律:解不到就 null,不猜)。 */
const VAR_DEPTH_MAX = 6

const stripCssComments = (t) => String(t ?? '').replace(/\/\*[\s\S]*?\*\//g, '')

/**
 * 编译产物 → `{ vars, rules }`:
 *  - `vars` = `@layer theme` 里 `:root/:host` 声明的主题变量(含 Tailwind 默认档与项目令牌);
 *  - `rules` = 恰好单类选择器 `.name` 的声明体(带变体/转义/前导的规则**不进**本表 ——
 *    它们不是"这个类自身的档",进了就是归因过宽)。
 */
export function parseCompiledUtilities(cssText) {
  const vars = new Map()
  const rules = new Map()
  const body = stripCssComments(cssText)
  for (const m of body.matchAll(/([^{}]+)\{([^{}]*)\}/g)) {
    const sel = m[1].trim()
    const decls = m[2].trim()
    if (/:root|:host/.test(sel)) {
      for (const d of decls.matchAll(/(--[a-z0-9-]+)\s*:\s*([^;]+);/gi)) vars.set(d[1], d[2].trim())
      continue
    }
    const one = /^\.([a-z][a-z0-9]*(?:-[a-z0-9]+)*)$/i.exec(sel)
    if (one) rules.set(one[1], decls)
  }
  return { vars, rules }
}

/** 乘法因子:纯数 / 长度 / `var(--x)`(再递归解)。解不到返回 null。 */
function factorPx(token, vars, depth) {
  const t = String(token ?? '').trim()
  if (!t) return null
  const varOnly = /^var\(\s*(--[a-z0-9-]+)\s*(?:,[^)]*)?\)$/i.exec(t)
  if (varOnly) {
    const val = vars?.get?.(varOnly[1])
    if (val === undefined) return null
    return resolveUtilityLength(val, vars, depth + 1)
  }
  if (/^[0-9.]+$/.test(t)) return Number(t)
  return lengthToPx(t)
}

/**
 * 一个 CSS 值 → px。认三种形态(其余一律 null,由调用方报名):
 *  ① 自身就是长度(`12px` / `0.25rem` / `0`)⇒ 交 `lengthToPx`;
 *  ② `var(--x)` ⇒ 查主题变量后递归;
 *  ③ `calc(项 * 系数 …)` —— Tailwind v4 的刻度档全是这一形(`calc(var(--spacing) * 4)`)。
 */
export function resolveUtilityLength(raw, vars, depth = 0) {
  if (depth > VAR_DEPTH_MAX) return null
  let v = String(raw ?? '').trim()
  if (!v) return null
  const direct = lengthToPx(v)
  if (direct !== null) return direct
  const calc = /^calc\(([\s\S]*)\)$/i.exec(v)
  if (calc) v = calc[1].trim()
  const factors = v.split('*').map((s) => s.trim())
  if (factors.length > 1) {
    let acc = 1
    for (const f of factors) {
      const n = factorPx(f, vars, depth)
      if (n === null) return null
      acc *= n
    }
    return Number.isFinite(acc) ? acc : null
  }
  return factorPx(v, vars, depth)
}

/** 浮点噪声归一(与门体 `round` 同值域;只用于落成 `Npx` 文本,不做判据)。 */
const round3 = (n) => Math.round(n * 1000) / 1000

/**
 * 一个类的声明体 → **归一化声明体文本**:长度值解成 `Npx`,其余原样保留。
 *
 * 为什么不在这里筛"盒属性":筛法在门体(`readGeometry` + `SHORTHAND_GEO_PROP`)只有一份,
 * 本文件再写一份就是第二把尺子 —— 而两把尺子对"什么算盒档"的分歧不会报错,只会让 web 腿
 * 与小程序腿读数不在同一口径上。这里只做**单位归一**,属性归类交给真跑它的那一刻。
 * 裸数字(如 `line-height: 1.5`)**不加单位**:它本来不是长度,加个 px 就造出一枚幽灵档。
 */
export function normalizeUtilityDecls(decls, vars) {
  const out = []
  for (const chunk of String(decls ?? '').split(';')) {
    const at = chunk.indexOf(':')
    if (at < 0) continue
    const prop = chunk.slice(0, at).trim().toLowerCase()
    const value = chunk.slice(at + 1).trim()
    if (!prop || !value) continue
    const bareNumber = /^[0-9.]+$/.test(value)
    const px = bareNumber ? null : resolveUtilityLength(value, vars)
    out.push(px === null ? `${prop}: ${value};` : `${prop}: ${round3(px)}px;`)
  }
  return out.join('\n')
}

/**
 * **同步**取工具类模型:`{ available, why, vars, decls, missing }`。
 *
 * `decls` 只装**编译器真产出了单类规则**的那些名字;候选里没产出的进 `missing`(由门逐枚
 * 记未判定并点名原因,而不是当成"该侧无档")。
 */
export function webUtilityDeclarations({ repoRoot, files, candidates, timeoutMs = 20000 }) {
  const wanted = [...new Set(candidates ?? [])].filter((x) => typeof x === 'string' && x)
  const empty = (why) => ({ available: false, why, vars: new Map(), decls: new Map(), missing: wanted })
  if (typeof files?.[WEB_UTILITY_ENTRY_REL] !== 'string')
    return empty(`入口样式表 ${WEB_UTILITY_ENTRY_REL} 不在被审面`)
  if (!wanted.length) return { available: true, why: null, vars: new Map(), decls: new Map(), missing: [] }
  let raw
  try {
    raw = execFileSync(
      process.execPath,
      [fileURLToPath(new URL('./web-utility-compile-worker.mjs', import.meta.url))],
      {
        input: JSON.stringify({ repoRoot, entry: WEB_UTILITY_ENTRY_REL, files, candidates: wanted }),
        encoding: 'utf8',
        maxBuffer: 1 << 28,
        timeout: timeoutMs,
        windowsHide: true,
        stdio: ['pipe', 'pipe', 'pipe'],
      },
    )
  } catch (e) {
    const first = String(e?.stderr || e?.message || e).split(/\r?\n/).find((l) => l.trim()) ?? ''
    return empty(`工具类编译没跑起来:${first.slice(0, 240)}`)
  }
  let parsed
  try {
    parsed = JSON.parse(raw)
  } catch {
    return empty('工具类编译输出不是合法 JSON')
  }
  if (parsed?.error) return empty(`工具类编译失败:${String(parsed.error).slice(0, 240)}`)
  if (typeof parsed?.css !== 'string') return empty('工具类编译输出缺 css 字段')
  const { vars, rules } = parseCompiledUtilities(parsed.css)
  const decls = new Map()
  const missing = []
  for (const name of wanted) {
    const body = rules.get(name)
    if (body === undefined) {
      missing.push(name)
      continue
    }
    decls.set(name, normalizeUtilityDecls(body, vars))
  }
  return { available: true, why: null, vars, decls, missing }
}

export const __test__ = {
  parseCompiledUtilities,
  resolveUtilityLength,
  normalizeUtilityDecls,
}
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
