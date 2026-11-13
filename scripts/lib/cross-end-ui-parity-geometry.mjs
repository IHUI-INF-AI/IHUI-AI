// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

// 几何 / 尺寸判据族（G 区）—— 2026-11-04 C1 拆分：从 scripts/check-cross-end-ui-parity.mjs 整簇机械搬出。
// 本件只搬代码、不改判据：GEO_KEY / NON_GEO_KEY 词表、单位换算、注释剥离、readGeometry 及其分类集、
// 同名常量折 px 比较与集合差分。主文件经 `import` + `export *` 原样再导出，对自检件与外部 import 的导出面不变。

import { facePx } from './length-units.mjs'

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
