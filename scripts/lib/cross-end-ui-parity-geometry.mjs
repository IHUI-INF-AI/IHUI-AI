// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

// 几何 / 尺寸判据族（G 区）—— 2026-11-04 C1 拆分：从 scripts/check-cross-end-ui-parity.mjs 整簇机械搬出。
// 本件只搬代码、不改判据：GEO_KEY / NON_GEO_KEY 词表、单位换算、注释剥离、readGeometry 及其分类集、
// 同名常量折 px 比较与集合差分。主文件经 `import` + `export *` 原样再导出，对自检件与外部 import 的导出面不变。

import { facePx, lengthToPx } from './length-units.mjs'
// 换算器包档（toRpx/toUnit 支）的形态识别与取源表**只此一份**，住在 lib/radius-tokens.mjs；
// 圆角维已从那一份取数，几何维若另写一条正则，两处就会漂成「圆角认得、盒形不认」（§0.6）。
import { geometryItemsInSrc, lengthConstsOf, cssVarItemsInSrc } from './radius-tokens.mjs'
// CSS 变量解值的取源：tokens.css 的块解析**只此一份实现**（lib/design-token-blocks.mjs 是它的全仓唯一出口，
// 生成器与守门 36/93 都从那里取）；本门不得再抄第二份 `--x: y` 正则（§0.6）。
import { collectVars } from './design-token-blocks.mjs'

/** 落在这些键/标识符上下文里的数字才算"看得见的尺寸"。 */
export const GEO_KEY =
  /(size|width|height|box|icon|padding|margin|font|line|gap|radius|top|bottom|left|right|thickness|spacing|edge)/i
/**
 * 必须先过这道否定筛:GEO_KEY 的 `font` 会命中 `fontWeight: 700`、`line` 命中 `lineCount`、
 * `size` 命中 `pageSize`。不排就是拿字重当尺寸判差异 —— 噪音尺与静默尺同样没用。
 * `letter` 是 2026-09-26 补的:`spacing` 一支会命中 `letterSpacing`(字距 0.2 被当尺寸读数),
 * RN 端 BottomActionBar 的头注当时已把这一处如实写成"读数噪音"—— 噪音登记进注释不配当判据,
 * 尺子自己把它喂进集合就是判据错(RN 侧 `LABEL_LETTER_SPACING = 0.2` 即实例)。
 * `line-height` / `lineHeight` 是 2026-09-27 补的同一格:GEO_KEY 的 `line` 与 `height` 双双命中它,
 * 而小程序 CSS 里的无单位倍数 `line-height: 1` 会被 `toPx` 当作 rpx 折半成 **0.5**
 * (实测 `IntelligentAssistant` 的"仅小程序档 0.5"就是这么来的 —— 两端源码里都没有 0.5 这个数)。
 * 行高是排版量、不是盒档,按属性名排除,不做值域猜测(猜"1 太小"会把真实的 1px 边框一起放过)。
 */
export const NON_GEO_KEY =
  /(weight|letter|line-height|lineheight|opacity|zindex|z-index|duration|delay|easing|alpha|percent|ratio|count|index|version|iteration|order|priority|limit|timeout|timestamp|revision|level|depth|page)/i
export const TW_SPACING_PX = (n) => n * 4
export const TW_FONT_PX = { xs: 12, sm: 14, base: 16, lg: 18, xl: 20, '2xl': 24, '3xl': 30 }
/** 超过此值的"尺寸"不是组件几何(屏宽 / 动画毫秒 / 密度),不判。 */
export const MAX_GEO_PX = 1200

/**
 * 剥注释但**保留字符串内容** —— 方向相反会各错一次:剥字符串会把 `className="w-[72rpx]"` 一起抹掉
 * (判据失明),留注释会把说明性数字喂进判据(假阳)。
 *
 * `pad = true` 时输出**与输入等长**(注释字符逐个换成空格、换行保留),供"深度走查在遮罩文本上做、
 * 取材按同一套下标 slice 原文"的调用方使用:默认的删除式会让下标整体左移 —— 真仓实测
 * Carousel 的 `return (` 与 `<View` 之间夹着注释块,取材切到别处,根上明明是 `rounded-2xl`
 * 却读回 `tiers:[]`。同一份解析、两种输出,不另起第二份注释解析(两份对"哪里是注释"的分歧
 * 会变成深度走查与取材对不上的安静错读)。
 */
export function stripComments(src, pad = false) {
  let out = ''
  let mode = 'code'
  let quote = ''
  for (let i = 0; i < src.length; i++) {
    const c = src[i]
    const n = src[i + 1]
    if (mode === 'code') {
      if (c === '/' && n === '/') {
        mode = 'line'
        i++
        out += pad ? '  ' : ''
        continue
      }
      if (c === '/' && n === '*') {
        mode = 'block'
        i++
        out += pad ? '  ' : ''
        continue
      }
      if (c === '"' || c === "'" || c === '`') {
        mode = 'str'
        quote = c
      }
      out += c
      continue
    }
    if (mode === 'line') {
      if (c === '\n') {
        mode = 'code'
        out += c
      } else if (pad) out += ' '
      continue
    }
    if (mode === 'block') {
      if (c === '*' && n === '/') {
        mode = 'code'
        i++
        out += pad ? '  ' : ''
      } else if (pad) out += c === '\n' ? '\n' : ' '
      continue
    }
    if (c === '\\') {
      out += c + (n ?? '')
      i++
      continue
    }
    out += c
    if (c === quote) {
      mode = 'code'
      quote = ''
    }
  }
  return out
}

export const round = (n) => Math.round(n * 100) / 100

/**
 * 原始数字 + 书写单位 → 逻辑 px。折算与单位归属都在 `lib/length-units.mjs` 的 `facePx` 里,只此一份。
 * `where` 说的是**这一格落在哪一面**:`'css'`(默认)= 经构建进样式表(小程序的 `Npx` 被 pxtransform
 * 1:1 写成 `Nrpx`,与 rpx 同折);`'runtime'` = 引号里的运行时串(端内 `px(n)` 助手那一型),不换。
 * 判哪一面的依据是取值的**书写形态** —— 只有引号里的值到不了 postcss,其余带单位的字面量都会落地成 rpx。
 */
export function toPx(raw, unit, side, where = 'css') {
  const n = Number(raw)
  if (!Number.isFinite(n) || n <= 0) return null
  const px = facePx(`${raw}${unit || ''}`, side, where)
  if (px === null) return null
  const r = round(px)
  return r > MAX_GEO_PX ? null : r
}

/**
 * 圆角**不进几何档集合**:它有自己的一维(`readRadius` / RD),混进几何集会让同一处被计两次、
 * 两份基线互相顶掉。
 *
 * ⚠️ 这里原本写的是"圆角不归本门判,守门 77 有单一源"—— **那句前提是错的**,而它正是
 * 2026-09-27 用户报"为什么还有那么多地方没按统一圆角"的根因:77 判的是「档位值同源 + 端内不得
 * 绕档写死数字」,两端各自规矩引用 token 时它一路报绿(实测 6373 文件 0 违规);而"同一个界面
 * 元素在小程序取 `rounded-lg`(8) 、在 App 取 `rnRadius.xl`(12)"这一型两边都不判 ——
 * 两台尺子互相指认,这一格此前无人看守。现由本门独占判(见 RD),77 仍管值的源头。
 */
export const RADIUS_FORM_RE = /rounded|radius|cornerradius|border-radius/i

/**
 * 长度档 CSS 变量的**单一真相源**与它的**小程序派生态副本**。
 * 源 = `packages/design-tokens/src/styles/tokens.css`(§4 规定的唯一色/档源头,受管块由
 * `sync-css-tokens.mjs` 从 TS 档表生成,派生态禁止手改);副本 = 小程序 `app.css` 的受管块,
 * 按该端量纲写成 rpx。两者不是两张真相:副本必须能被源解释(rpx÷2 = px),对不上就说明
 * 派生态漂了 —— 那种格本门**不替它发合格证**,把该档标成未判定逐枚点名(判红权归守门 36/93)。
 */
export const TOKENS_CSS_PATH = 'packages/design-tokens/src/styles/tokens.css'
export const MINIAPP_TOKEN_COPY_PATH = 'apps/miniapp-taro/src/app.css'
/** 解值表里"这一档是长度"与"这一档不是长度"必须分开登记:后者不入几何集、也不报未判定(见 lib 头注②)。 */
export const CSS_VAR_LENGTH_KIND = 'length'
export const CSS_VAR_OTHER_KIND = 'other'

/**
 * 被审面 → CSS 变量解值表(`Map<档名, {kind, px?, raw, why?}>`)。
 *
 * 三条纪律:
 *  ① 只从**被审面**取源(与清单同面同轮),绝不 import 磁盘常量 —— 否则档位一改,门对着旧表打分;
 *  ② 无单位的值(`--z-index: 10`、`--text-badge--font-weight: 600`)一律判"非长度档":
 *     单位缺失时 lengthToPx 会按裸数字当 px 读,那正是本门 NON_GEO_KEY 立起来防的那一型
 *     (把字重当尺寸 = 噪音尺);要求带 `px|rem|rpx` 单位才允许进几何集;
 *  ③ 与小程序派生态**互证**:同一档在副本里的 rpx 值折回 px 必须等于源值,不等 ⇒ 该档
 *     `{kind:'length', px:null, why}` ⇒ 消费侧逐枚报名未判定(失效方向是"多要一次定向说明",
 *     绝不是"挑一个信")。副本读不到 ⇒ 互证没做,由调用方在覆盖面面点名,不记成"已互证"。
 *
 * 源取不到时返回**空表**并由调用方按"判据失明"喊死(§0.3),本函数自己不抛,以便在纯函数面上单测。
 */
export function cssVarTiers(sources) {
  const out = new Map()
  const src = sources?.[TOKENS_CSS_PATH]
  if (typeof src !== 'string') return out
  const vars = collectVars(src, ['@theme', ':root'])
  const copyRaw = sources?.[MINIAPP_TOKEN_COPY_PATH]
  const copy =
    typeof copyRaw === 'string' ? collectVars(copyRaw, [':root', '@theme', '@theme static']) : null
  for (const [name, d] of vars) {
    const value = String(d.value ?? '').trim()
    // ② 必须自带长度单位才认(rpx/px/rem);裸数字一律判"非长度档"
    const bare = value
      .replace(/^calc\(/, '')
      .replace(/\)$/, '')
      .trim()
    const hasUnit = /(?:rpx|px|rem)$/.test(bare)
    const px = hasUnit ? lengthToPx(value) : null
    if (px === null) {
      out.set(name, { kind: CSS_VAR_OTHER_KIND, raw: value })
      continue
    }
    let why = null
    const c = copy ? copy.get(name) : undefined
    if (c) {
      const cpx = facePx(c.value, 'miniapp', 'css')
      if (cpx === null) why = `小程序派生态该档(${c.value})不可折算`
      else if (round(cpx) !== round(px))
        why = `源 ${value}(=${px})与小程序派生态 ${c.value}(=${cpx})折算不等`
    }
    out.set(
      name,
      why
        ? { kind: CSS_VAR_LENGTH_KIND, px: null, raw: value, why }
        : { kind: CSS_VAR_LENGTH_KIND, px, raw: value },
    )
  }
  return out
}

/**
 * 一个文件 → 归一后的几何档集合 + 具名常量表。纯函数:自检钉的是它,不是打印。
 * `cssVars` = `cssVarTiers` 的解值表;传 null/空表 ⇒ CSS 变量形态一条不采(由调用方按失明判,
 * 不得读成"该侧没有变量取用")。
 */
/**
 * 键名 → 五类几何维之一;判不出返回 null(该值仍进 values,但不参与分类对账 ——
 * "没分类"不得冒充"这一类没有档")。
 * 顺序有意:font 先于 size(textSize 是字号不是盒宽)、padding 先于 spacing、
 * margin/gap 归「间距」、top/right/bottom/left/inset 也归「间距」(它们是偏移量,不是宽高)。
 */
export function dimOfKey(raw) {
  const s = String(raw ?? '')
    .replace(/-([a-z])/g, (_, c) => c.toUpperCase())
    .toLowerCase()
  if (!s) return null
  if (/font|textsize|^text$/i.test(s)) return 'fontSize'
  if (/padding|^pad|^p$|^(px|py|pt|pb|pl|pr)$/i.test(s)) return 'padding'
  if (
    /margin|gap|spacing|space|inset|^m$|^mt$|^mb$|^ml$|^mr$|^mx$|^my$|^top$|^bottom$|^left$|^right$|offset/i.test(
      s,
    )
  )
    return 'spacing'
  if (/width|height|size|box|icon|glyph|thickness|dimension|diameter|^w$|^h$|^wh$/i.test(s))
    return 'widthHeight'
  return null
}

export function readGeometry(src, side, tiers = {}, cssVars = null) {
  const code = stripComments(src)
  const named = {}
  const values = new Set()
  // 分类集与 values 同批生长:同一次提取,不在第二处再扫一遍(两处算同一件事必漂)。
  const dims = {
    widthHeight: new Set(),
    padding: new Set(),
    spacing: new Set(),
    fontSize: new Set(),
  }
  const push = (px, dim) => {
    if (px === null || px === undefined) return
    values.add(px)
    if (dim && dims[dim]) dims[dim].add(px)
  }
  const keyed = (name) =>
    GEO_KEY.test(name) && !NON_GEO_KEY.test(name) && !RADIUS_FORM_RE.test(name)
  /**
   * 取值**紧邻在前的那个键名**(两条采集支共用一份实现:换算器支与 CSS 变量支都必须按同一语境筛,
   * 各写一遍必漂成"换算器认得圆角语境、变量认不得")。
   */
  const keyBefore = (at) => {
    const head = code.slice(code.lastIndexOf('\n', at - 1) + 1, at)
    const m = /([A-Za-z][A-Za-z0-9_-]*)\s*[:=]\s*[^:;{}]*$/.exec(head)
    return m ? m[1] : null
  }

  for (const m of code.matchAll(
    /\b(?:const|let)\s+([A-Za-z_$][\w$]*)\s*=\s*(\d+(?:\.\d+)?)(?![\w.])/g,
  )) {
    if (!keyed(m[1])) continue
    const px = toPx(m[2], undefined, side)
    named[m[1]] = px
    push(px, dimOfKey(m[1]))
  }
  /**
   * 属性名必须**整体**取,不能靠 `\b` 从连字符串里捞后半截:CSS 的 `line-height: 1` 曾被读成键
   * `height`、`letter-spacing: 0.2` 被读成 `spacing`,前者把无单位行高折半成 **0.5 幽灵档**
   * (实测 IntelligentAssistant 即此例)。第一版修法是把"前面是连字符"的一律跳过 —— 那是**过头**:
   * `max-width: 320rpx` 也是连字符属性,而且是合法长度档,跳掉它就凭空造出"仅 RN 档 160"
   * (实测 CategoryBar 从 1 档涨到 4 档,复量新旧两口径才定位到这一支)。
   * 现口径:键名允许带连字符,整体取出后驼峰归一(`max-width`→`maxWidth`),非长度属性由 NON_GEO_KEY 拦。
   */
  for (const m of code.matchAll(
    /([a-z][\w]*(?:-[a-z0-9]+)*)\s*[:=]\s*(\d+(?:\.\d+)?)(rpx|px)?(?![\w.%])/gi,
  )) {
    const key = m[1].replace(/-([a-z])/g, (_, c) => c.toUpperCase())
    if (!keyed(key)) continue
    push(toPx(m[2], m[3], side), dimOfKey(key))
  }
  for (const m of code.matchAll(/\brpx\(\s*(\d+(?:\.\d+)?)\s*\)/g))
    push(toPx(m[1], 'rpx', side), dimOfKey(keyBefore(m.index)))
  /**
   * **内联引号串里的长度**(2026-09-27 三路并行取证各自独立指到同一格):
   * 小程序端把档写成 `style={{ padding: '0 20rpx 10rpx' }}` 或 `'20rpx'`,而下面的简写循环
   * 按"分号/花括号收尾"取声明体、再按空白切 token —— 引号会粘在**首尾两个 token** 上
   * (`'0` 与 `10rpx'`),于是它们既不匹配纯数字也不匹配 `…rpx`,整条静默漏读;
   * 单值引号串(`'20rpx'`)更是连简写循环都进不去(它只认 ≥2 个 token)。
   * 后果不是"少读一个数"而是**造出假分叉**:对面写了同一个值,这边读不到 ⇒ 报成"仅 RN 档"。
   * 口径:引号内按空白切 token,逐 token 去掉引号后只认纯 `<数字><rpx|px>`;
   * `calc(50% - 26rpx)` 这类混算式**不计**(它不是档,是机制)。
   * 引号里的那个数**不过 postcss**(运行时才落到 style 上),所以这一支交 `toPx` 时显式说明
   * 落地面是 `runtime` —— 否则小程序 `minHeight:'120px'` 会被当成样式表的 120px 折成 60,
   * 而对面写的 120 是真 120,一次折半就把同档读成分叉(实测 AgentRuntimePanel)。
   */
  for (const m of code.matchAll(/([a-z][\w]*(?:-[a-z0-9]+)*)\s*[:=]\s*(['"`])([^'"`\n]*)\2/gi)) {
    const key = m[1].replace(/-([a-z])/g, (_, c) => c.toUpperCase())
    if (!keyed(key)) continue
    for (const raw of m[3].trim().split(/\s+/)) {
      const one = /^(\d+(?:\.\d+)?)(rpx|px)$/.exec(raw)
      if (one) push(toPx(one[1], one[2], side, 'runtime'), dimOfKey(key))
    }
  }
  /**
   * **简写多值声明**:`padding: 0 24rpx` / `margin: 8rpx 0 16rpx` 这类一行里挂多个长度。
   * 上一条提取式按"数字紧跟键名"匹配,只会取到第一个值(0),于是横向内边距 24rpx=12px
   * **整族隐身** —— 实测 `CategoryBar` 的"仅 RN 档 12"就是这么造出来的假分叉:
   * RN 写 `paddingHorizontal: 12`,小程序在 CSS 里写 `padding: 0 24rpx`,两侧其实是同一档。
   * 与刚修的"只看 .tsx 不看 .css"是同一型失效(判据覆盖面比判据逻辑更早决定结论)。
   * 口径:同一条声明内、以空白分隔的长度字面量逐取;`auto` / `calc(...)` / 百分比不计;
   * 单值形态仍由上一条判据负责(避免双计)。
   */
  /**
   * 简写多值声明**只认布局长度属性**,不能沿用 `keyed()` 的子串筛:
   * `box-shadow: 0 2rpx 8rpx …` 的键名含 `box`,按子串会命中 GEO_KEY,于是把阴影模糊半径
   * 当成盒档收了进来(实测 `ModelConfigDialog.css:28` 凭空多出"仅小程序档 1"并把该族顶过锚点)。
   * 描边宽度(`border: 2px dashed`)、圆角简写(`border-radius: 8px 8px 0 0` = RD 维的地盘)、
   * `transform` / `filter` / `background` 一律不在几何档语义里。
   */
  const SHORTHAND_GEO_PROP =
    /^(?:padding|margin|gap|grid-gap|row-gap|column-gap|inset|width|height|max-width|min-width|max-height|min-height)(?:-(?:top|right|bottom|left|inline|block|start|end))?$/
  for (const m of code.matchAll(/(?:^|\n)[\t ]*([a-z][a-z-]*)\s*:\s*([^;{}]+)[;}]/g)) {
    if (!SHORTHAND_GEO_PROP.test(m[1])) continue
    const vals = m[2].trim().split(/\s+/)
    if (vals.length < 2) continue
    for (const v of vals) {
      const one = /^(\d+(?:\.\d+)?)(rpx|px)$/.exec(v)
      if (!one) continue // `auto` / `0` / `100%` / `calc(…)` 一律不计
      push(toPx(one[1], one[2], side), dimOfKey(m[1]))
    }
  }
  for (const m of code.matchAll(
    /(?:^|[\s"'`])(size|gap|p|m|px|py|mx|my|mt|mb|ml|mr|w|h|top|bottom|left|right|inset)-\[(\d+(?:\.\d+)?)(rpx|px)?\]/g,
  ))
    push(toPx(m[2], m[3], side), dimOfKey(m[1]))
  for (const m of code.matchAll(/(?:^|[\s"'`:](?:[a-z-]+:)?)size-(\d+(?:\.\d+)?)(?=$|[\s"'`])/g))
    push(round(TW_SPACING_PX(Number(m[1]))), 'widthHeight')
  // 内联盒/留白的**刻度档**(非任意值形态):`px-3`/`py-2`/`gap-4`/`mt-2` … 一律 ×4 折 px。
  // 不收这一档,同一族的两侧就不在同一口径上读数 —— RN 写 `paddingHorizontal: 12` 记进集合,
  // 小程序写 `px-3` 却不进集合,于是"仅 RN 档 12"是一条纯粹的比对噪声(实测 BottomActionBar 就这么错判过)。
  for (const m of code.matchAll(
    /(?:^|[\s"'`:](?:[a-z-]+:)?)(p|px|py|pt|pb|pl|pr|m|mx|my|mt|mb|ml|mr|gap|space-x|space-y)-(\d+(?:\.\d+)?)(?=$|[\s"'`])/g,
  ))
    push(round(TW_SPACING_PX(Number(m[2]))), dimOfKey(m[1]))
  // 尾视里**不含 `/`**:`w-1/3` 这类分数宽度不是 px 档(旧写法把 `w-1` 折成 4px 喂进集合,
  // 实测 ModelList 的骨架条 `w-1/3` 因此凭空多出一档"仅小程序 4")。
  for (const m of code.matchAll(/(?:^|[\s"'`:](?:[a-z-]+:)?)([hw])-(\d+(?:\.\d+)?)(?=$|[\s"'`])/g))
    push(round(TW_SPACING_PX(Number(m[2]))), 'widthHeight')
  for (const m of code.matchAll(/(?:^|[\s"'`])text-\[(\d+(?:\.\d+)?)(rpx|px)?\]/g))
    push(toPx(m[1], m[2], side), 'fontSize')
  for (const m of code.matchAll(/(?:^|[\s"'`])text-(xs|sm|base|lg|xl|2xl|3xl)(?=$|[\s"'`/:])/g))
    push(TW_FONT_PX[m[1]] ?? null, 'fontSize')
  for (const m of code.matchAll(/\bsize=\{(\d+(?:\.\d+)?)\}/g))
    push(toPx(m[1], undefined, side), 'widthHeight')
  /**
   * **换算器包档**(2026-10-24,toRpx / toUnit 支):`width: toRpx(44)` / `gap: toRpx(SP.md)`。
   * 小程序镜像件的主流写法是 `const toRpx = (px) => `${px * 2}rpx``,而上面所有提取式只认
   * 「键名紧跟数字字面量」与 `rpx(数字)` 两型 —— 换算器包住的那一族在几何维**整族隐身**,
   * 账面表现不是"少一个数",而是**凭空造出跨端分叉**(实测 ScreenStates 虚报仅 RN 档 8/12/16/44/92)。
   * 形态识别、折算与未判定报名**一律复用** `lib/radius-tokens.geometryItemsInSrc`(与 RD 维同一份,
   * §0.6);本门只做一件事:按调用式**紧邻的键名**过 `keyed()` 语境筛 ——
   * `borderRadius: toRpx(RD.sm)` 属圆角维,漏进几何集就是同一处双计。
   * 解不到的逐枚进 `unreadable`(不记 0、不记同值、不静默)。
   */
  const unreadable = []
  {
    const consts = lengthConstsOf(src, tiers)
    for (const it of geometryItemsInSrc(code, consts, tiers)) {
      const key = keyBefore(it.at)
      if (!key || !keyed(key.replace(/-([a-z])/g, (_, c) => c.toUpperCase()))) continue
      if (it.px === null) unreadable.push({ raw: it.raw, text: it.text, px: null, why: it.why })
      else if (it.px <= MAX_GEO_PX) push(it.px, dimOfKey(key))
    }
  }
  /**
   * **CSS 变量解值支**(2026-11-01 票 O67,治本门最危险的那一型静默):§4 令牌纪律要求端内把同值
   * 写成 `var(--spacing-*)` / `var(--text-*)`,而几何维的词汇表此前只认「数字字面量 / rpx() /
   * 换算器包档 / 具名档 / 间距档成员」——变量形态整族读不到,账面表现不是"少一个数",
   * 而是**把"没读到"写成"该侧无档"**,于是凭空造出"仅 RN 档 8/10"那种假分叉(web 腿两条 waiver
   * 与主腿 CategoryBar 是同一条洞)。
   * 口径三条:
   *  ① 语境筛与换算器支**共用 `keyed()` + `keyBefore()`**(两处各写一遍必漂成"换算器认得圆角语境、
   *     变量认不得");圆角维的地盘(`border-radius: var(--radius-lg)`)由 RADIUS_FORM_RE 挡在外面,
   *     不重复计。
   *  ② Tailwind 任意值形态 `gap-[var(--spacing-sm)]` 的键名住在方括号前缀里,`keyBefore()` 只能
   *     认到 `className`(它不是长度键)⇒ 单独一条前缀白名单,与本文件数字任意值支**同一串前缀**,
   *     不另起一套语义;颜色/底色那一型(`bg-[var(--color-x)]`、`text-[var(--color-x)]`)刻意不在
   *     前缀表里 —— 它是色档不是盒档,报出来是把噪音当债务。
   *  ③ 档名**不在解值表**(名写错 / 已改名 / 源不可读)⇒ 逐枚 `unreadable` 点名(§0.3),
   *     **绝不折成"该侧无档"**;档在表里但不是长度 ⇒ 计入 `cssVar.notLength` 覆盖面读数,
   *     静默与"没这一档"在账面上同形,所以必须留数给人看。
   * `0`(`--spacing-none: 0px`)按本门 C4 纪律不入集:0 值引用会造出"两侧都读成同值"的假账。
   */
  const cssVar = { resolved: 0, notLength: 0, unresolvable: 0 }
  if (cssVars instanceof Map && cssVars.size) {
    const TW_ANY_VAR_PREFIX =
      /(?:^|[\s"'`])(?:size|gap|p|px|py|pt|pb|pl|pr|m|mx|my|mt|mb|ml|mr|w|h|top|bottom|left|right|inset)-\[var\(\s*--[\w-]+/g
    const arbitraryAt = new Set()
    const arbitraryDim = new Map()
    for (const m of code.matchAll(TW_ANY_VAR_PREFIX)) {
      const at = m.index + m[0].lastIndexOf('var(')
      arbitraryAt.add(at)
      const pre =
        /(?:^|[\s"'`])(size|gap|p|m|px|py|pt|pb|pl|pr|mx|my|mt|mb|ml|mr|w|h|top|bottom|left|right|inset)-\[var/.exec(
          m[0],
        )
      arbitraryDim.set(at, pre ? dimOfKey(pre[1]) : null)
    }
    for (const it of cssVarItemsInSrc(code, cssVars)) {
      const isArbitrary = arbitraryAt.has(it.at)
      let dim = arbitraryDim.get(it.at) ?? null
      if (!isArbitrary) {
        const key = keyBefore(it.at)
        if (!key || !keyed(key.replace(/-([a-z])/g, (_, c) => c.toUpperCase()))) continue
        dim = dimOfKey(key)
      }
      if (it.notLength) {
        cssVar.notLength++
        continue
      }
      if (it.px === null) {
        cssVar.unresolvable++
        unreadable.push({ raw: it.raw, text: it.text, px: null, why: it.why })
        continue
      }
      if (it.px === 0) continue // C4:0 值不入集
      if (it.px <= MAX_GEO_PX) {
        push(it.px, dim)
        cssVar.resolved++
      }
    }
  }

  /**
   * **具名档必须也进集合**,否则尺子奖励隐藏:把数字收编进 `packages/shared/src/ui/*-spec.ts`
   * 或 `design-tokens/geometry.js` 之后,组件里只剩标识符,前面所有"数字形态"的提取式全部落空
   * —— 于是"两端各取 spec 里不同的一档"读起来比"两端各抄一个裸数字"更加隐身。
   * 这一格是 2026-09-26 用户实拍"两端还是不一样"时定位出来的判据缺陷:几何同值的族能看见,
   * 已经收进单一源的族反而看不见。
   * 口径:`_PX` 结尾的导出档名按逻辑 px 直接计入(**不做 rpx 换算** —— spec 存的就是逻辑 px),
   * `geometry.<键>` 同;本文件的局部别名(`const X = SPEC_Y` / `const X = rnGeometry.tapBox`)
   * 追一跳,别名本身也按名字记进 named 表。
   */
  if (tiers && Object.keys(tiers).length) {
    /**
     * **换算器包裹区间**(间距腿与字号腿共用一份):包裹区间用**括号配对**扫(开括号起 400 字符
     * 封顶,配不拢弃区间);落在区间内的成员入账交 `geometryItemsInSrc` 采集支按"成员解不到"报名,
     * 这里不重复计。
     * 前一版想用一条 `(?:X|\s)*` 嵌套量词的置换正则直接匹配"被换算器包住的成员",实测
     * 对抗样本(`rpx(` 后接近而失败的长串)触发灾难性回溯,单样本冻结 >2 分钟、
     * 全量门空转 28 分钟零输出(2026-10-27 取证)—— 位置判定对任意输入 O(n),回溯从根上禁用。
     */
    const wrapRanges = []
    const CALL_RE = /\b(?:toUnit|toRpx|px2rpx|rp|rpx)\s*\(/g
    for (let mm; (mm = CALL_RE.exec(code));) {
      const open = mm.index + mm[0].length - 1
      let depth = 0
      const cap = Math.min(code.length, open + 400)
      for (let i = open; i < cap; i++) {
        const ch = code[i]
        if (ch === '(') depth++
        else if (ch === ')') {
          depth--
          if (depth === 0) {
            wrapRanges.push([mm.index, i + 1])
            CALL_RE.lastIndex = i + 1
            break
          }
        }
      }
    }
    const insideWrap = (at) => wrapRanges.some(([a, b]) => at > a && at < b)
    /**
     * **间距档消费腿**(2026-10-27,治 C3/C8 那批"仅小程序"假分叉):
     * 裸 `rnSpacing.md` / `rnSpacing['3xl']` / `rnSpacingFor.gap` 按档表 dp 计入 values,
     * 并按命名空间名进 named(与具名档同一张冲突对账表)。
     * 档表读不到的成员(改名/新增没进源)⇒ 报名未判定,不静默跳过(§0.3)。
     * 归维按**紧邻键名**走(2026-11-02 修):旧版无条件 `push(px,'spacing')`,而间距档最常坐的键
     * 恰是 `padding` / `paddingHorizontal` / `paddingVertical` —— 内边距整族被读成 0,
     * web↔RN 的 padding 维看到的是"RN 侧没读数"(假 one-sided),不是"两端不一样"。
     * 无几何键语境(取不到键 / 键不是几何键)时保持旧口径 `spacing`:不把"没语境"猜成某一维;
     * 档值本身照旧进 values,所以集合口径(主腿 / 圆角维)不随这一刀移动。
     */
    for (const m of code.matchAll(
      /\b(rnSpacing(?:For)?)\s*(?:\.\s*([A-Za-z_$][\w$]*)|\[\s*'([^']+)'\s*\])/g,
    )) {
      if (insideWrap(m.index)) continue
      const key = m[2] || m[3]
      const memberName = `${m[1]}.${key}`
      const px = tiers[memberName]
      if (px === undefined) {
        unreadable.push({
          raw: memberName,
          text: key,
          px: null,
          why: '间距档位表读不到该成员(源表没有此档或已改名)',
        })
        continue
      }
      const rawKey = keyBefore(m.index)
      const k = rawKey ? rawKey.replace(/-([a-z])/g, (_, c) => c.toUpperCase()) : null
      // 有几何键语境 ⇒ 按该键归维;没有(或该键分不进五维)⇒ 保持旧口径 spacing(不静默丢读数)
      push(px, (k && keyed(k) ? dimOfKey(k) : null) ?? 'spacing')
      if (named[memberName] === undefined) named[memberName] = px
    }
    /**
     * **字号档消费腿**(2026-11-02 Phase 3,治"落档后覆盖数反而下降"):
     * 落档后 RN 屏只剩 `fontSize: rnType.bodySm.size` 与 `...rnType.bodySm` 两种写法,
     * 旧词汇表只认字面量 ⇒ 该侧 fontSize 读成空集,已对齐的屏被报成 one-sided。
     * 口径三条,与字面量支逐字同形:
     *  ① `.size` 按档值计入 fontSize(有几何键语境时按键归档,与 `fontSize: 13` 的
     *     `dimOfKey('fontSize')` 同一判据);
     *  ② **整对象展开** `...rnType.bodySm` 等价于 `fontSize: <size>`:几何维只取字号这一格,
     *     行高/字重不是几何档(NON_GEO_KEY 同一条排除);
     *  ③ `.lineHeight` 是排版量,只在几何键语境下按键归档(键名会被 NON_GEO_KEY 挡住),
     *     裸引用与展开一律不入集 —— 与字面量 `lineHeight: 20` 的口径一致。
     * 档表读不到的成员 ⇒ 逐枚未判定(§0.3),绝不折成"该侧无字号档"。
     */
    for (const m of code.matchAll(
      /\b(rnType|taroType)\s*(?:\.\s*([A-Za-z_$][\w$]*)|\[\s*'([^']+)'\s*\])(?:\s*\.\s*(size|lineHeight|fontSize))?(?![\w.])/g,
    )) {
      if (insideWrap(m.index)) continue
      const ns = m[1]
      const step = m[2] || m[3]
      const sizeField = ns === 'taroType' ? 'fontSize' : 'size'
      const field = m[4] ?? sizeField // 展开形态 `...rnType.body` 按整个对象里的字号计
      const memberName = `${ns}.${step}.${field}`
      const px = tiers[memberName]
      if (px === undefined) {
        unreadable.push({
          raw: memberName,
          text: step,
          px: null,
          why: '字号档位表读不到该成员(源表没有此档/此字段或已改名)',
        })
        continue
      }
      if (!(px > 0) || px > MAX_GEO_PX) continue
      const rawKey = keyBefore(m.index)
      const key = rawKey ? rawKey.replace(/-([a-z])/g, (_, c) => c.toUpperCase()) : null
      const dim =
        key && keyed(key)
          ? dimOfKey(key)
          : m[4] === undefined || field === sizeField
            ? 'fontSize'
            : null
      if (dim) push(px, dim)
      if (named[memberName] === undefined) named[memberName] = px
    }
    /**
     * **圆角档在几何键语境下的取用**:`size: rnRadius.xl` 这类写法与其字面量同值计入几何维。
     * `borderRadius:` 由 RADIUS_FORM_RE 挡在 `keyed()` 之外(圆角档是圆角维的地盘,不双计);
     * 档值来自 `collect` 搬进 tiers 的 `radiusLookup` 那一份(§0.6 不另抄档表)。
     */
    for (const m of code.matchAll(
      /\b(rnRadius(?:For)?)\s*(?:\.\s*([A-Za-z_$][\w$]*)|\[\s*'([^']+)'\s*\])/g,
    )) {
      if (insideWrap(m.index)) continue
      const rawKey = keyBefore(m.index)
      if (!rawKey) continue
      const key = rawKey.replace(/-([a-z])/g, (_, c) => c.toUpperCase())
      if (!keyed(key)) continue
      const memberName = `${m[1]}.${m[2] || m[3]}`
      const px = tiers[memberName]
      if (px === undefined) {
        unreadable.push({
          raw: memberName,
          text: m[2] || m[3],
          px: null,
          why: '圆角档位表读不到该成员(源表没有此档或已改名)',
        })
        continue
      }
      if (px > 0 && px <= MAX_GEO_PX) push(px, dimOfKey(key))
    }
    const alias = {}
    for (const m of code.matchAll(
      /\b(?:const|let)\s+([A-Za-z_$][\w$]*)\s*=\s*(?:(?:rnGeometry|taroGeometry|GEOMETRY_PX)\.([A-Za-z_$][\w$]*)|([A-Z][A-Z0-9_]*))(?![\w.])/g,
    )) {
      const target = m[2] ? `geometry.${m[2]}` : m[3]
      if (tiers[target] !== undefined) alias[m[1]] = tiers[target]
    }
    /**
     * 取标识符全集用**一遍**扫描再与档表求交,而不是"每个档名建一条正则扫全文":
     * 档表现有 600+ 条,×24 个配对文件 = 一万多次全文回溯,一次判据跑成分钟级;
     * 求交是 O(文件长度)。两种写法判的是同一件事,成本差三个数量级。
     */
    const ids = new Set(code.match(/[A-Za-z_$][\w$]*/g) || [])
    const geoMember = new Set(
      [...code.matchAll(/\b(?:rnGeometry|taroGeometry|GEOMETRY_PX)\.([A-Za-z_$][\w$]*)/g)].map(
        (m) => m[1],
      ),
    )
    /** 被"再乘一次 2"的换算器包住的那些几何档名(见下方 eff 的注释)。 */
    const doubleWrapped = new Set(
      [
        ...code.matchAll(
          /\b(?:toUnit|toRpx|px2rpx|rp)\(\s*(?:taroGeometry|GEOMETRY_PX)\.([A-Za-z_$][\w$]*)/g,
        ),
      ].map((m) => m[1]),
    )
    for (const [name, px] of Object.entries(tiers)) {
      const key = name.startsWith('geometry.') ? name.slice(9) : null
      const hit = key ? geoMember.has(key) : ids.has(name)
      if (!hit || !(px > 0)) continue
      /**
       * **投影入口选错 = 尺寸差一倍,而只认档名会把它读成同值。**
       * `taroGeometry.X` 已经是折好 2 倍的 rpx 数值(geometry.js 注释:"直接喂 rpx()"),
       * 再喂进 `toUnit()`(= rpx(px*2))就是双重换算 ⇒ 落在屏上差一倍。
       * 这一型是渲染层量出来的(微信工具实测容器 128rpx,应为 64rpx),而本门当时报"两端同档"绿灯:
       * 具名档解析认了档名、没认外层换算器 —— 等于给最坏的一种单位错发合格证。
       */
      const eff = key && doubleWrapped.has(key) ? px * 2 : px
      if (eff > MAX_GEO_PX) continue
      push(eff, dimOfKey(key ?? name))
      if (named[name] === undefined) named[name] = eff
    }
    for (const [name, px] of Object.entries(alias)) {
      push(px, dimOfKey(name))
      if (named[name] === undefined) named[name] = px
    }
  }
  return { values, named, unreadable, cssVar, dims }
}

/**
 * 同名常量两侧折成 px 后仍不等 ⇒ 手抄档漂移的确证。
 * 立论实例:两份自称"唯一实现"的 BackChevron,图标墨迹小程序 40rpx=20px、RN 写 22 —— 差 2px,
 * 而两端注释里都写着"与 web 同档"。散文承诺挡不住手抄。
 */
export function namedConflicts(a, b) {
  const out = []
  for (const [k, v] of Object.entries(a)) {
    const w = b[k]
    if (w !== undefined && v !== undefined && round(v) !== round(w))
      out.push(`${k}: miniapp=${v} rn=${w}`)
  }
  return out.sort()
}

export function diffValues(mini, rn) {
  const only = (x, y) => [...x].filter((v) => !y.has(v)).sort((p, q) => p - q)
  return { onlyMiniapp: only(mini, rn), onlyRn: only(rn, mini) }
}

export const fileName = (f) => f.split('/').pop()
