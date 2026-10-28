#!/usr/bin/env node
// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * sync-css-tokens.mjs — 把 TS 档位表里**可映射**的档生成到 tokens.css 的受管块。
 *
 * 立因(2026-10-28):颜色早就三端自动同步(RN 色表 / 小程序 app.css + style.ts 都有生成器与 --check),
 * 而间距、字号、圆角、阴影各自手写:改一个间距值,RN 与小程序的 import 跟着变,**web 一动不动**
 * (web 的 p-4/gap-4 走 Tailwind 默认档,与 SPACING_STEPS 毫无关系)。于是"同一个 md=12"在两端
 * 各说各话,页面不可能"一模一样"。本文件把差额补上:TS 是源,CSS 是派生物,判据与生成器共用一份实现。
 *
 * ── 一、档位可映射性判定(判据 = 本机 Tailwind 4.3.3 真编译产出,不是文档推断;实测命令见 §四)──
 *
 *   族 / 源(唯一真源)                        数      可映射   落成的 CSS 变量                      依据
 *   ─────────────────────────────────────────────────────────────────────────────────────────────────────
 *   间距  spacing.ts    SPACING_STEPS          11 档   11/11   --spacing-<step>                      p-md/gap-md/m-md/size-md 全产出
 *   字号  typography.ts TYPE_STEPS.size        9 档    9/9     --text-<step>                         text-body 产出 font-size
 *   行高  typography.ts TYPE_STEPS.lineHeight  9 档    9/9     --text-<step>--line-height            text-body 一并产出 line-height
 *   字重  typography.ts TYPE_STEPS.weight      9 档    9/9     --text-<step>--font-weight            v4 认这个后缀,text-body 一并产出 font-weight
 *   字重表 typography.ts FONT_WEIGHTS          4 档    4/4     --font-weight-<name>                  font-regular / font-strong 产出
 *   阴影  elevation.ts  ELEVATION_CSS          5 档    5/5     --shadow-elevation-<step>             shadow-elevation-md 产出
 *   圆角  radius.js     RADIUS_STEPS           7 档    7/7     已由 tokens.css 手写 --radius-* 承载  见下方②,本脚本**不生产**
 *   动效  —(无 TS 生产者)                     0      0        —                                     动效只在 CSS 单源,方向相反
 *   字体  —(无 TS 生产者)                     0      0        —                                     字体栈 TS 侧零手写,不存在第二份
 *
 *   合计 47 个变量进受管块(11 + 9×3 + 4 + 5)。三条"不能/不该映射"的判定,逐条写清:
 *
 *   ① **角色表不映射**:SPACING_ROLES / RADIUS_ROLES 是「角色 → 档位」的第 2 层引用,不是值本身。
 *      生成成 --spacing-role-gap 之类只会凭空长出一套 web 零消费的变量,而 Tailwind 类名 `gap-gap`
 *      语义不通。角色留在 TS 侧由端内按角色取档(rnSpacingFor / taroSpacingFor),不进 CSS。
 *
 *   ② **圆角只对账不生产**:tokens.css 的 --radius-* 已有生产者(手写 7 行)且有专用守门
 *      scripts/check-radius-single-source.mjs 的 A 判据逐档对账。再生成一份 = 同一个变量两名生产者,
 *      谁后写谁赢,漂移只是时间问题。所以圆角不进受管块;本脚本只把它的同族(间距/字号/阴影)补齐。
 *
 *   ③ **量纲不冲突,暗色不适用**:小程序侧 taroSpacing / taroType 是 SPACING_STEPS/TYPE_STEPS 的
 *      **派生态**(×2 折算 rpx),RN 侧 rnSpacing / rnType 是同一张表的直读(dp),都不是独立真源 ⇒
 *      CSS 只取逻辑 px 那一份,不存在 rpx↔px 的换算分歧。暗色:颜色的明暗分档靠 .dark 覆盖块,
 *      而间距/字号/阴影阶梯本身没有明暗两个值(ELEVATION_CSS 的深浅由 opacity 表达,暗色沿用同一档),
 *      所以受管块**不需要 .dark 覆盖** —— 这是判定结论,不是漏写。
 *
 *   阴影为什么不用 --shadow-sm/md/lg/xl:Tailwind v4 已把 --shadow-* 用作内置投影档
 *   (--shadow-md 有自带值),同名追加会**静默盖掉**默认档 —— web 现有全部 shadow-md/lg 观感当场变化。
 *   故取 --shadow-elevation-*(不动既有命名空间,零观感变化),类名 shadow-elevation-md。
 *   既有 --shadow-premium* 四档现值全同 0 2px 8px(web 专属"玻璃浮层单档",无阶梯语义,且全仓仅
 *   :root 声明、零消费方),与本表的 5 档阶梯语义不同 ⇒ 不合并、不代裁,留待设计侧定档后再收。
 *
 * ── 二、受管块为什么插在 @theme { … } 内末尾(而不是紧随其后)──
 *
 *   v4 的 theme 命名空间(--spacing-* / --text-* / --font-weight-* / --shadow-*)只在 @theme 里登记
 *   才进 design system。实测(Tailwind 4.3.3,同一份声明两处对比):
 *     · 写在 @theme { --spacing-md: 12px } ⇒ p-md / gap-md / m-md / size-md 四条工具类都产出;
 *     · 改写成 :root { --spacing-md: 12px } ⇒ 四条**一条都不产出**(变量在,但没有工具类)。
 *   所以落点只有 @theme 内部一个合法选择;"紧随其后"等于自废工具类,故取前者。
 *   插在**末尾**而非开头:受管块是纯追加档,插开头会把圆角段与 vcenter 段挤开(diff 噪声),也会让
 *   手写档与受管档交错,人一眼看不出哪几行不能手改。
 *
 * ── 三、幂等与退出码 ──
 *
 *   幂等:块内容只由 TS 值决定(不含时间戳/顺序随机);--write 先比对**整段字节**,等值不落盘。
 *   退出码:0 = 一致(或已写成一致);1 = --check 下有差异;2 = **未判定**(源文件缺失 / 表名定位
 *   不到 / 表里有解析不了的字面量 / 受管标记不成对 / 受管块不在 @theme 内)。未判定绝不记绿。
 *
 *   用法:
 *     node scripts/sync-css-tokens.mjs            # 写回(幂等,等值不落盘)
 *     node scripts/sync-css-tokens.mjs --write    # 同上(显式)
 *     node scripts/sync-css-tokens.mjs --check    # 只校验,有差异 exit 1
 *     node scripts/sync-css-tokens.mjs --help
 *
 * ── 四、Tailwind 侧实测取证方式(可复跑)──
 *   用 @tailwindcss/postcss 编译一个临时 CSS(@import 'tailwindcss' + 本受管块所在的 tokens.css
 *   + @source inline("p-md gap-md m-md size-md text-body font-strong shadow-elevation-md")),
 *   在产出里 grep 上述类名。同一手法把 --spacing-md 移到 :root 复跑即为上面的反证。
 *   (仓库内没有 @tailwindcss/cli,故用官方 postcss 插件跑同一条编译链,产出等价。)
 */
import { existsSync, readFileSync, writeFileSync } from 'node:fs'
import { dirname, join, resolve } from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'

const HERE = dirname(fileURLToPath(import.meta.url))
/** 仓库根:脚本住在 <root>/scripts/ 下,向上两级。测试夹具把本文件拷进 <tmp>/scripts/ 即可整树替换。 */
export const REPO_ROOT = resolve(HERE, '..')

export const TOKENS_CSS_REL = 'packages/design-tokens/src/styles/tokens.css'
export const SPACING_REL = 'packages/design-tokens/src/spacing.ts'
export const TYPOGRAPHY_REL = 'packages/design-tokens/src/typography.ts'
export const ELEVATION_REL = 'packages/design-tokens/src/elevation.ts'

/** 受管块标记。全仓唯一一份字面量 —— 守门与本脚本都从这里取,不得各写一遍。 */
export const MANAGED_BEGIN = '/* css-tokens:managed:begin */'
export const MANAGED_END = '/* css-tokens:managed:end */'

/** 三个族的固定顺序与说明(说明进 CSS 注释,人打开 tokens.css 就知道这行从哪来)。 */
export const FAMILIES = [
  ['spacing', '间距档(源:spacing.ts 的 SPACING_STEPS)→ p-md / gap-md / m-md / size-md'],
  ['type', '字号三连档(源:typography.ts 的 TYPE_STEPS + FONT_WEIGHTS)→ text-body / font-medium'],
  ['shadow', '阴影档(源:elevation.ts 的 ELEVATION_CSS)→ shadow-elevation-md'],
]

/** 未判定(源取不到 / 结构不是预期形状)。CLI 映射为 exit 2,绝不记绿。 */
export class UndeterminedSource extends Error {}

// ─────────────────────────── TS 对象字面量读取(唯一实现) ───────────────────────────
/**
 * 为什么手写解析而不用 `import()`:
 *   本文件的解析结果要同时服务两处 —— 生成器读**磁盘**,守门 check-cross-end-tokens 读**判定面 blob**
 *   (`HEAD:` / `:` 的 git blob 文本)。blob 是字符串,import() 拿不到;而 Node 的类型擦除也要
 *   ≥22.18(仓里 engines 写的是 ≥22.13)。一套读取实现两处复用,才不会出现"生成器能读、守门读不了"
 *   或两份解析各偏一次。只认数字 / 字符串 / 嵌套对象三类叶子 —— 遇到表达式(拼接、变量引用)直接
 *   抛 UndeterminedSource,判"未判定"而不是猜一个值。
 */

/** 跳过空白与 /* *\/ 、// 注释。 */
function skipTrivia(src, i) {
  for (;;) {
    while (i < src.length && /\s/.test(src[i])) i += 1
    if (src[i] === '/' && src[i + 1] === '*') {
      const end = src.indexOf('*/', i + 2)
      if (end < 0) throw new UndeterminedSource('块注释未闭合')
      i = end + 2
      continue
    }
    if (src[i] === '/' && src[i + 1] === '/') {
      const nl = src.indexOf('\n', i + 2)
      i = nl < 0 ? src.length : nl + 1
      continue
    }
    return i
  }
}

function readStringLiteral(src, i) {
  const quote = src[i]
  let out = ''
  i += 1
  while (i < src.length) {
    const c = src[i]
    if (c === '\\') {
      out += src[i + 1] ?? ''
      i += 2
      continue
    }
    if (c === quote) return { value: out, index: i + 1 }
    out += c
    i += 1
  }
  throw new UndeterminedSource('字符串字面量未闭合')
}

function readValue(src, i) {
  i = skipTrivia(src, i)
  const c = src[i]
  if (c === '{') return parseObjectLiteral(src, i)
  if (c === "'" || c === '"') return readStringLiteral(src, i)
  const m = /^-?\d+(?:\.\d+)?/.exec(src.slice(i, i + 32))
  if (m) return { value: Number(m[0]), index: i + m[0].length }
  throw new UndeterminedSource(
    `档位表里有解析不了的字面量(位置 ${i}:'${src.slice(i, i + 24).replace(/\s+/g, ' ')}…')` +
      ` —— 只认数字 / 字符串 / 嵌套对象,表达式请先在源里写成字面量`,
  )
}

/** 从 i(指向 '{')解析一个对象字面量;返回 { value, index }。 */
export function parseObjectLiteral(src, i = 0) {
  i = skipTrivia(src, i)
  if (src[i] !== '{') throw new UndeterminedSource(`期望 '{',实得 '${src[i] ?? 'EOF'}'`)
  i += 1
  const out = {}
  for (;;) {
    i = skipTrivia(src, i)
    if (src[i] === '}') return { value: out, index: i + 1 }
    if (src[i] === ',') {
      i += 1
      continue
    }
    let key
    if (src[i] === "'" || src[i] === '"') {
      const r = readStringLiteral(src, i)
      key = r.value
      i = r.index
    } else {
      const m = /^[\w$-]+/.exec(src.slice(i, i + 64))
      if (!m) throw new UndeterminedSource(`键无法解析(位置 ${i}:'${src.slice(i, i + 16)}')`)
      key = m[0]
      i += key.length
    }
    i = skipTrivia(src, i)
    if (src[i] !== ':') throw new UndeterminedSource(`键 '${key}' 后缺 ':'`)
    const r = readValue(src, i + 1)
    out[key] = r.value
    i = r.index
  }
}

/** 取 `export const NAME = {…}` 的 `{…}` 文本(类型注解与 `as const` 一并跳过);取不到返回 null。 */
export function extractTableText(src, name) {
  const m = new RegExp(`export\\s+const\\s+${name}\\b`).exec(src)
  if (!m) return null
  const eq = src.indexOf('=', m.index + m[0].length)
  if (eq < 0) return null
  return src.slice(eq + 1)
}

function readTable(src, name, rel) {
  const tail = extractTableText(src, name)
  if (tail === null) throw new UndeterminedSource(`${rel} 里定位不到 export const ${name}`)
  return parseObjectLiteral(tail).value
}

function assertNumberMap(table, name, rel) {
  const keys = Object.keys(table)
  if (keys.length === 0) throw new UndeterminedSource(`${rel} 的 ${name} 是空表(判据失明)`)
  for (const k of keys) {
    if (typeof table[k] !== 'number' || !Number.isFinite(table[k]))
      throw new UndeterminedSource(`${rel} 的 ${name}.${k} 不是有限数字(实为 ${typeof table[k]})`)
  }
  return table
}

/**
 * 四张表一次读齐。入参是**文本**(磁盘读或 blob 读由调用方决定),所以生成器与守门走同一条解析路径。
 * @param {{spacing:string, typography:string, elevation:string}} texts
 */
export function parseTokenTables({ spacing, typography, elevation }) {
  const SPACING_STEPS = assertNumberMap(
    readTable(spacing, 'SPACING_STEPS', SPACING_REL),
    'SPACING_STEPS',
    SPACING_REL,
  )
  const TYPE_STEPS = readTable(typography, 'TYPE_STEPS', TYPOGRAPHY_REL)
  if (Object.keys(TYPE_STEPS).length === 0)
    throw new UndeterminedSource(`${TYPOGRAPHY_REL} 的 TYPE_STEPS 是空表`)
  for (const [step, v] of Object.entries(TYPE_STEPS)) {
    if (!v || typeof v !== 'object')
      throw new UndeterminedSource(`TYPE_STEPS.${step} 不是对象(实为 ${typeof v})`)
    for (const field of ['size', 'lineHeight', 'weight']) {
      if (typeof v[field] !== 'number' || !Number.isFinite(v[field]))
        throw new UndeterminedSource(`TYPE_STEPS.${step}.${field} 不是有限数字`)
    }
  }
  const FONT_WEIGHTS = assertNumberMap(
    readTable(typography, 'FONT_WEIGHTS', TYPOGRAPHY_REL),
    'FONT_WEIGHTS',
    TYPOGRAPHY_REL,
  )
  const ELEVATION_CSS = readTable(elevation, 'ELEVATION_CSS', ELEVATION_REL)
  if (Object.keys(ELEVATION_CSS).length === 0)
    throw new UndeterminedSource(`${ELEVATION_REL} 的 ELEVATION_CSS 是空表`)
  for (const [step, v] of Object.entries(ELEVATION_CSS))
    if (typeof v !== 'string' || v.trim() === '')
      throw new UndeterminedSource(
        `ELEVATION_CSS.${step} 不是非空字符串(实得 ${JSON.stringify(v)})`,
      )
  return { SPACING_STEPS, TYPE_STEPS, FONT_WEIGHTS, ELEVATION_CSS }
}

/** 档位名 → CSS 变量中段(displayLg → display-lg;2xl 原样)。 */
export function cssStepName(step) {
  return step.replace(/([a-z0-9])([A-Z])/g, '$1-$2').toLowerCase()
}

/**
 * 值 → 与 prettier 对齐的规范形态(只有阴影档会变:`rgba(0,0,0,.05)` → `rgba(0, 0, 0, .05)`)。
 * 立因:prettier 会重排函数实参的逗号间距(实测 --check 在原生形态上判红),受管块一旦
 * prettier 不认,`prettier --check` 与 `sync-css-tokens --check` 就会互相判对方红。
 * 生成与对账都过这一个函数,于是"写进去的"与"期望的"永远是同一个形态。
 */
export function normalizeCssValue(value) {
  return value
    .replace(/\s+/g, ' ')
    .trim()
    .replace(/,(?=[^\s])/g, ', ')
}

/**
 * 期望变量清单(顺序即写入顺序)。这是「该写什么」的**唯一**一张推导表,
 * 生成器渲染它、守门对账它 —— 两处不可能给出不同的期望值。
 * @returns {Array<{family:'spacing'|'type'|'shadow', name:string, value:string}>}
 */
export function buildEntries({ SPACING_STEPS, TYPE_STEPS, FONT_WEIGHTS, ELEVATION_CSS }) {
  const entries = []
  for (const [step, px] of Object.entries(SPACING_STEPS))
    entries.push({ family: 'spacing', name: `--spacing-${cssStepName(step)}`, value: `${px}px` })
  for (const [step, v] of Object.entries(TYPE_STEPS)) {
    const s = cssStepName(step)
    entries.push({ family: 'type', name: `--text-${s}`, value: `${v.size}px` })
    entries.push({ family: 'type', name: `--text-${s}--line-height`, value: `${v.lineHeight}px` })
    entries.push({ family: 'type', name: `--text-${s}--font-weight`, value: String(v.weight) })
  }
  for (const [name, weight] of Object.entries(FONT_WEIGHTS))
    entries.push({
      family: 'type',
      name: `--font-weight-${cssStepName(name)}`,
      value: String(weight),
    })
  for (const [step, shadow] of Object.entries(ELEVATION_CSS))
    entries.push({
      family: 'shadow',
      name: `--shadow-elevation-${cssStepName(step)}`,
      value: normalizeCssValue(shadow),
    })
  return entries
}

// ─────────────────────────── @theme / 受管块的定位与渲染 ───────────────────────────
/** 从 openIdx(指向 '{')找配对的 '}',跳过注释与字符串。 */
export function matchBrace(css, openIdx) {
  let depth = 0
  for (let i = openIdx; i < css.length; i += 1) {
    const c = css[i]
    if (c === '/' && css[i + 1] === '*') {
      const end = css.indexOf('*/', i + 2)
      if (end < 0) return -1
      i = end + 1
      continue
    }
    if (c === '"' || c === "'") {
      const q = c
      i += 1
      while (i < css.length && css[i] !== q) i += css[i] === '\\' ? 2 : 1
      continue
    }
    if (c === '{') depth += 1
    else if (c === '}') {
      depth -= 1
      if (depth === 0) return i
    }
  }
  return -1
}

/** 注释置空(**等长替换**,下标不变):定位 @theme 时不会被注释里的 `@theme {` 骗到。 */
function maskCssComments(css) {
  return css.replace(/\/\*[\s\S]*?\*\//g, (s) => ' '.repeat(s.length))
}

/** 定位落点 @theme 块(取第一个**无条件**的 @theme,即 `@theme {`;`@theme inline` 等不作为落点)。 */
export function findThemeBlock(css) {
  const masked = maskCssComments(css)
  const re = /@theme\s*\{/g
  let m
  while ((m = re.exec(masked)) !== null) {
    const open = masked.indexOf('{', m.index)
    const close = matchBrace(masked, open)
    if (close < 0) throw new UndeterminedSource('@theme 块未闭合(括号不平衡)⇒ 无法定位落点')
    return { open, close }
  }
  throw new UndeterminedSource('tokens.css 里找不到 `@theme {` 块 ⇒ 受管块无处安放')
}

/** 渲染受管块(每行缩进两格 = @theme 内的声明缩进,块尾自带换行)。纯函数:同样入参永远同样字节。 */
export function renderManagedBlock(entries) {
  const body = [MANAGED_BEGIN]
  for (const [family, title] of FAMILIES) {
    const mine = entries.filter((e) => e.family === family)
    if (mine.length === 0) continue
    body.push(`/* ${title} */`)
    for (const e of mine) body.push(`${e.name}: ${e.value};`)
  }
  body.push(MANAGED_END)
  return `${body.map((l) => `  ${l}`).join('\n')}\n`
}

/** 读出受管块里的现有变量(剥离注释后取值)。`present=false` 表示标记缺失。 */
export function readManagedVars(css) {
  const beginIdx = css.indexOf(MANAGED_BEGIN)
  const endIdx = css.indexOf(MANAGED_END)
  if (beginIdx < 0 && endIdx < 0) return { present: false, vars: new Map(), error: null }
  if (beginIdx < 0 || endIdx < 0 || endIdx < beginIdx)
    return {
      present: false,
      vars: new Map(),
      error: '受管标记不成对(begin/end 只出现一个或顺序颠倒)',
    }
  const inner = css.slice(beginIdx + MANAGED_BEGIN.length, endIdx).replace(/\/\*[\s\S]*?\*\//g, ' ')
  const vars = new Map()
  const re = /(--[\w-]+)\s*:\s*([^;]+);/g
  let m
  while ((m = re.exec(inner)) !== null) vars.set(m[1], m[2].trim())
  return { present: true, vars, error: null }
}

/** 期望 vs 实际:缺档 / 值不同 / 多档(源里已删、CSS 还留着)。 */
export function diffManaged(vars, entries) {
  const missing = []
  const mismatched = []
  for (const e of entries) {
    if (!vars.has(e.name)) missing.push(e)
    else if (vars.get(e.name) !== e.value) mismatched.push({ ...e, actual: vars.get(e.name) })
  }
  const expectedNames = new Set(entries.map((e) => e.name))
  const extra = [...vars.keys()].filter((n) => !expectedNames.has(n))
  return {
    missing,
    mismatched,
    extra,
    ok: missing.length === 0 && mismatched.length === 0 && extra.length === 0,
  }
}

/**
 * 计划:算出"应该长什么样",不落盘。
 * @returns {{ok:true, text:string, changed:boolean, mode:'replace'|'insert', themeRange:{open:number,close:number}}
 *          |{ok:false, reason:string}}
 */
export function planSync(css, entries) {
  const block = renderManagedBlock(entries)
  const theme = findThemeBlock(css)
  const beginIdx = css.indexOf(MANAGED_BEGIN)
  const endIdx = css.indexOf(MANAGED_END)

  if (beginIdx >= 0 || endIdx >= 0) {
    if (beginIdx < 0 || endIdx < 0 || endIdx < beginIdx)
      return {
        ok: false,
        reason: '受管标记不成对(begin/end 只出现一个或顺序颠倒)⇒ 不猜、不修,请人工确认',
      }
    const lineStart = css.lastIndexOf('\n', beginIdx) + 1
    const nlAfterEnd = css.indexOf('\n', endIdx)
    const lineStop = nlAfterEnd < 0 ? css.length : nlAfterEnd + 1
    if (!(lineStart > theme.open && lineStart < theme.close))
      return {
        ok: false,
        reason:
          '受管块不在 @theme 块内 ⇒ 生成在这里等于自废工具类(见头注 §二),请人工把它移回 @theme 内',
      }
    const text = css.slice(0, lineStart) + block + css.slice(lineStop)
    return { ok: true, text, changed: text !== css, mode: 'replace', themeRange: theme }
  }

  // 缺失:插在 @theme 的收尾 '}' 之前(尾部追加,见头注 §二)
  const head = css.slice(0, theme.close)
  const sep = head.endsWith('\n') ? '\n' : '\n\n'
  const text = `${head}${sep}${block}${css.slice(theme.close)}`
  return { ok: true, text, changed: text !== css, mode: 'insert', themeRange: theme }
}

// ─────────────────────────── 取源与 CLI ───────────────────────────
export function readSources(root) {
  const read = (rel) => {
    const p = join(root, rel)
    if (!existsSync(p)) throw new UndeterminedSource(`${rel} 不存在(取不到源 ⇒ 未判定)`)
    return readFileSync(p, 'utf8')
  }
  return {
    spacing: read(SPACING_REL),
    typography: read(TYPOGRAPHY_REL),
    elevation: read(ELEVATION_REL),
  }
}

/** 供测试与守门复用:文本 → 期望变量清单(任何一步取不到都抛 UndeterminedSource)。 */
export function expectedEntries(texts) {
  return buildEntries(parseTokenTables(texts))
}

const args = process.argv.slice(2)
const isDirectRun = process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href
const isHelp = isDirectRun && args.includes('--help')
const isCheck = isDirectRun && args.includes('--check')
const isWrite = isDirectRun && args.includes('--write')

if (isHelp) {
  console.info(`sync-css-tokens.mjs — 把 TS 档位表生成到 tokens.css 的受管块

用法:
  node scripts/sync-css-tokens.mjs            写回(幂等,等值不落盘)
  node scripts/sync-css-tokens.mjs --write    同上(显式)
  node scripts/sync-css-tokens.mjs --check    只校验(有差异 ⇒ exit 1)
  node scripts/sync-css-tokens.mjs --help

源(唯一真源):
  ${SPACING_REL}      SPACING_STEPS
  ${TYPOGRAPHY_REL}   TYPE_STEPS / FONT_WEIGHTS
  ${ELEVATION_REL}    ELEVATION_CSS
落点:
  ${TOKENS_CSS_REL}   \`${MANAGED_BEGIN}\` … \`${MANAGED_END}\`(@theme 内末尾)

退出码:0 = 一致 / 1 = 有差异 / 2 = 未判定(取不到源或结构不符,不记绿)
`)
  process.exit(0)
}

if (isDirectRun) {
  if (isCheck && isWrite) {
    console.error('❌ --check 与 --write 只能二选一')
    process.exit(2)
  }
  const cssPath = join(REPO_ROOT, TOKENS_CSS_REL)
  let entries
  try {
    entries = expectedEntries(readSources(REPO_ROOT))
    if (!existsSync(cssPath)) throw new UndeterminedSource(`${TOKENS_CSS_REL} 不存在`)
  } catch (e) {
    if (e instanceof UndeterminedSource) {
      console.error(`[sync-css-tokens] ⚠️ 未判定(exit 2):${e.message}`)
      process.exit(2)
    }
    throw e
  }
  const css = readFileSync(cssPath, 'utf8')
  let plan
  try {
    plan = planSync(css, entries)
  } catch (e) {
    if (e instanceof UndeterminedSource) {
      console.error(`[sync-css-tokens] ⚠️ 未判定(exit 2):${e.message}`)
      process.exit(2)
    }
    throw e
  }
  if (!plan.ok) {
    console.error(`[sync-css-tokens] ⚠️ 未判定(exit 2):${plan.reason}`)
    process.exit(2)
  }

  const byFamily = (f) => entries.filter((e) => e.family === f).length
  const summary =
    `间距 ${byFamily('spacing')} + 字号/字重 ${byFamily('type')} + 阴影 ${byFamily('shadow')}` +
    ` = ${entries.length} 个变量`

  if (!plan.changed) {
    console.log(`[sync-css-tokens] ✅ tokens.css 受管块与 TS 源一致(${summary}),零字节写回`)
    process.exit(0)
  }

  const { vars } = readManagedVars(css)
  const diff = diffManaged(vars, entries)
  const detail = []
  if (!vars.size) detail.push('受管块缺失')
  if (diff.missing.length) detail.push(`缺 ${diff.missing.length} 档`)
  if (diff.mismatched.length) detail.push(`值不同 ${diff.mismatched.length} 档`)
  if (diff.extra.length) detail.push(`多余 ${diff.extra.length} 档`)

  if (isCheck) {
    console.error(`[sync-css-tokens] ❌ 受管块与 TS 源不一致(${detail.join(' / ')}):`)
    for (const e of diff.missing.slice(0, 8)) console.error(`  · 缺 ${e.name}(应为 ${e.value})`)
    for (const e of diff.mismatched.slice(0, 8))
      console.error(`  · ${e.name}:CSS ${e.actual} ≠ 源 ${e.value}`)
    for (const n of diff.extra.slice(0, 8)) console.error(`  · 多 ${n}(源里已无此档)`)
    console.error('  改法是改 TS 源后跑 node scripts/sync-css-tokens.mjs --write,不要手改受管块。')
    process.exit(1)
  }

  writeFileSync(cssPath, plan.text)
  console.log(
    `[sync-css-tokens] ✅ 已写回 tokens.css(${plan.mode === 'insert' ? '插入受管块' : '更新受管块'},` +
      `${summary})`,
  )
  process.exit(0)
}

export const __test__ = {
  skipTrivia,
  readManagedVars,
  diffManaged,
  planSync,
  renderManagedBlock,
}
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
