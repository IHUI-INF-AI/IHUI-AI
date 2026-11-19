// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * 跨端 UI 对账的「几何取值」底座(门 103 C1 收口,2026-11-19 从 check-cross-end-ui-parity.mjs 下沉)。
 *
 * 两端的组件面清单、几何键分类、px 换算与 CSS 变量档位解析都住在这一份里;脚本只转出口,
 * 镜像测试的 import 路径与导出名逐名等值(§22c:判据不得有第二份实现)。
 */

import { facePx, lengthToPx } from './length-units.mjs'
import { collectVars } from './design-token-blocks.mjs'

/**
 * 两端的组件面。RN 侧**三层都扫**(2026-09-27 票⑭ 起):`packages/app/src/components`(共享组件层)
 * + `packages/app/src/features/**`(共享屏层 —— @ihui/rn-app 的桶从 2026-09 起从这里再导出
 * UserInfoCard 等三份同名实现的出口份,不在配对源里就等于给"改了它任何读数都不动"发绿灯)
 * + `apps/mobile-rn/src/components`(端内自绘层)。只扫一层会漏判 —— 小程序组件若只与端内层同名,
 * 只扫共享层就把它算成"仅小程序",而那正应当被收进"两端同源"的目标形态。
 * 同名多命中**不再静默取先者**:选腿走 pickCandidate(平台后缀 > **同端自绘层** > 出口指向 > 目录序),
 * 候选逐条点名(见 scan 的 multiCandidates)。
 * 「同端自绘层」这一序(G- 2026-09-29 票#9)是给本门的**问题本身**定的:它问的是"同一个界面元素
 * 在小程序与 App 上长成同一张脸吗",而两端各自屏幕上渲染的那一份才是被问的那个元素。
 * 实测形态:`UserInfoCard` 在 RN 侧有三份活实现(`apps/mobile-rn/src/components/` = ProfileScreen
 * 直接 import 的那份、`packages/app/src/features/cards/` = `@ihui/rn-app` 桶出口那份、
 * `packages/app/src/components/` = 第二份桶出口),按"出口指向"选会拿**共享层卡**去对**小程序端内卡**
 * —— 一层不同形的比较,读数再大也不回答用户看的那两张脸。
 */
export const SIDES = {
  miniapp: ['apps/miniapp-taro/src/components'],
  rn: ['packages/app/src/components', 'packages/app/src/features', 'apps/mobile-rn/src/components'],
}
/**
 * 每端"自己屏幕上那份"的目录前缀。可达性层(pruneUnreachableLegs)按端各跑一遍图,
 * 走到这个前缀下的候选就是该端**自己**渲染的那一份 —— 所以这一序只在"两份都可达"时生效,
 * 端内那份是死副本时它根本进不了候选(不会把绿灯换成红灯)。
 */
export const OWN_END_PREFIX = { miniapp: 'apps/miniapp-taro/', rn: 'apps/mobile-rn/' }
/**
 * **web 腿**(2026-09-30 立,补 AGENTS §4「web 与 miniapp-taro 视觉必须完全一致」在这一维的零判据)。
 *
 * 为什么过去没有:本门的 `SIDES` 只有 miniapp 与 rn,所以"web 改了小程序没改"这一型**结构上
 * 不可能被任何现有判据读到**(登记在册的那条:"128 的 rc 0 不得当成覆盖了三端")。
 * 为什么刻意**不塞进 SIDES**:塞进去会让几何 / SL / IC 每一维都平白多两组对,而 web 侧的尺寸
 * 住在 Tailwind utility 与 CSS 变量里,与 RN 的 StyleSheet 键**不在同一量纲**上 —— 那产出的
 * 不是"更多覆盖",而是把不比较的东西摆成在比较。
 * 所以这一腿(web↔小程序)只回答到文件级:**同一个组件名取的圆角档一不一样**;IC 与 RS 两维
 * 仍未判,并在人读面与 `--json` 面明写(不是"已确认相同")。
 * 几何维另有一条腿:**web↔RN 五维**(2026-11-02 立,配对锚点见 `WEB_RN_LEDGER_REL`),按屏比
 * 宽高/内边距/间距/圆角/字号;默认 advisory(不折退出码),读数与未登记数见 `--json` 的 `webRn`。
 *
 * 已知覆盖边界(逐条报出,不当通过):
 *  - **端入口可达性剔除已装上**(2026-10-08 票 G-978049③):双侧各跑一遍图,种子面
 *    `SEED_DIRS.web = apps/web/app`(Next 的 page/layout 层就是框架真渲染的入口),`@/` 别名按
 *    web 的 tsconfig 解析;被剔的族逐条点名(`⊘ WD …… 从web端入口不可达`),web 种子取不到时
 *    整维**挂起留痕**而不是当成"都活着" —— 挂起那一句里的"本轮未做剔除"说的是这一轮,不是这一腿。
 *  - 只比**档值集合**(RD 量纲),不比元素名(RE 量纲):web 侧没有 StyleSheet 键可归属。
 *  - **裸档(G-978049② 立案 / G-277② 落地,本腿与主腿同罪)**:档位提取式曾只认
 *    `rounded-(xs|sm|md|lg|xl|2xl)`,裸写 `rounded` / `var(--radius)`(值 = 档位表 DEFAULT)读不出来
 *    ⇒ "一端写裸档、另一端写具名档"会被读成"那一端没写档"。**本票已把它并进取用集合**
 *    (`scripts/lib/radius-tokens.mjs` 的 `radiusItemsInLine` 末尾一支,识别式仍只有
 *    `bareRoundedOccurrences` 那一份,门内不抄第二份正则)。立项时写的"补认必须与守门 77 / 150
 *    的台账同枚提交各自重锚"经 import 面复裁**不成立**:77 不 import radius-tokens,150 走
 *    `lib/radius-roles.mjs` 自带的提取式且其 1b) 支早已认裸档,两本账的读数不可能随本刀移动;
 *    会移动的只有本门(128)与守门 11 的 `radiusPxInLine` 消费面。真仓 HEAD 现读锚点零变化
 *    (唯一带裸档的配对文件 ModelList 小程序侧那 2 处折进档集合后 8 早已在集合内 ⇒ RD 不新增分叉),
 *    所以**没有锚点需要重锚**;`bareRoundedAudit` 继续逐条报名,但它报的不再是"看不见多少",
 *    而是"这一族有几处是靠裸档形态被认进来的"(见门内打印)。
 */
export const WEB_DIRS = ['apps/web/src/components', 'packages/ui-react/src/components']
export const WEB_LEDGER = {
  counts: 'webCounts',
  radius: 'webRadiusCounts',
  element: 'webElementRadiusCounts',
  waivers: 'webWaivers',
}
export const BASELINE_REL = 'scripts/cross-end-ui-parity-baseline.json'
/**
 * 允许差异登记表(2026-11-02 立,跨端对齐 Phase 1「允许差异」地基):component × key × platform ×
 * owner × 到期日。本门只对**未登记 / 已到期 / 超量 / 条目坏**的差异报红;已登记、在期内且读数不超
 * 额度的差异只记账。到期不是自动续期 —— 到期当日重新报红,逼 owner 复核,防止白名单腐化
 * (§12e:不得为消红削判据)。key=geometry|radius|elementRadius 时 count 是该族实测差异处数
 * (额度不是无限信用);key=platform:<capability> 时登记宿主能力差异(支付/分享/订阅消息/小程序原生/
 * 字体/模糊/手势/安全区/平台常量),不带 count。台账与豁免表**分开两本账**:豁免是临时欠债,
 * 允许差异是设计边界;两者都必须在期,且都不许把"没判"写成"判过"。
 */
export const ALLOWED_DIFFS_REL = 'scripts/data/cross-end-allowed-diffs.json'
/**
 * web↔RN 配对账本(2026-11-02 立,Phase 2「web 腿几何维」):逐行 `{web,rn,status,data:{evidence,webEvidence?}}`。
 * 本门只取 `status=aligned` 且 `data.evidence` 以 `<rn 路径>:` 开头的行 —— evidence 已经钉到 RN
 * 文件:行,是这条配对唯一可复核的锚点;锚不上的行进「配对待确认清单」,不猜。
 * `data.webEvidence`(`<web 路径>:<行>`,可选)是 web 侧五维读数的取证件:路由的 page.tsx 只是
 * 屏壳时,几何住在子组件里,没有这枚锚这一维就只能报 one-sided(读数的缺口,不是两端的差异)。
 */
export const WEB_RN_LEDGER_REL = 'scripts/data/web-rn-screen-map.jsonl'
/** 五个可判定几何维;`radius` 走圆角档表,其余四维走 readGeometry 的分类集。 */
export const WEB_RN_GEOMETRY_DIMS = ['widthHeight', 'padding', 'spacing', 'radius', 'fontSize']
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
 * `byte` 是 2026-11-06 D3 票补的第二型:字节数(`PREVIEW_MAX_BYTES` / `MAX_FILE_BYTES`)永远不是长度。
 * 这一族**只**收 `byte` 一个词,没有顺手收 `*_SIZE` / `MAX_*`,理由是现读的:
 * `maxWidth` / `maxHeight` 是合法长度档(本文件"连字符属性"那一格实测过 `max-width: 320rpx`,
 * 跳掉它凭空造出"仅 RN 档 160"),`iconSize` / `size={24}` 同样是合法盒档 —— 按这两个名字族一刀切
 * 会把真读数一起抹掉(§12e「修红不得顺手削判据」)。字节型的正解在算式那一侧,见 `isUnitScaleProduct`。
 */
export const NON_GEO_KEY =
  /(weight|letter|line-height|lineheight|opacity|zindex|z-index|duration|delay|easing|alpha|percent|ratio|count|index|version|iteration|order|priority|limit|timeout|timestamp|revision|level|depth|page|byte)/i
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
 * 列表**分隔线对象**的键名(2026-11-06 D3 票):`separator: { height: 12 }` 是
 * `ItemSeparatorComponent` 用来占位的那一条**条目间距**,不是任何元素的宽高。
 * 真仓现读同形 38 个文件(`git grep -l -F "separator: {" | wc -l`),其中
 * `packages/app/src/features/search/SearchScreen.tsx` 与 `.../activity/ActivityScreen.tsx` 的
 * `widthHeight` 读数**整族**就是这一型 —— 键名含 `height` 被 `dimOfKey` 收进盒档维,
 * web↔RN 五维腿于是把"两端列表间距的写法不同"读成"两端宽高不同档"。
 * 前缀(item/list/cell/row/grid/header/footer)与单复数一并认。
 *
 * 为什么按**上下文**改道而不是按键名排除:`height` 在同屏的 `card: { height: 80 }` 里就是真盒档,
 * 按键名一刀切会把真读数一起抹掉(§12e)。改道只换维、不丢读数 —— 该值照旧进 `values`,
 * 主腿的 V1 档集合口径与圆角维一字不动。
 */
export const SEP_OBJECT_KEY_RE = /^(?:item|list|cell|row|grid|header|footer)?separators?$/i
/**
 * 数字字面量之后**紧邻**是否为量纲换算乘积(`× 1024` 字节档 / `× 1000` 毫秒·千分度档)。
 * 命中即"这一格写的是字节数,不是长度":`const MAX_SIZE = 10 * 1024 * 1024`(10MB 上传上限)
 * 的 `10` 因键名含 `size` 被收进 `widthHeight`,实测 `apps/mobile-rn/src/screens/PdfToolsHubScreen.tsx`
 * 的 widthHeight 整族 = `[10]`;同形还在 `packages/ui-react/src/components/Upload.tsx`
 * (`DEFAULT_MAX_SIZE = 10 * 1024 * 1024`)、`apps/web/src/components/form/AttachmentsUpload.tsx`
 * (`50 * 1024`)等 —— 判据看的是**算式形状**,与键名无关,所以 `maxWidth: 320` 这类合法档不受影响。
 * `× 1024` 在样式语义里没有任何合法用法(长度不会用千分度写),因此这一条不是放宽,是纠错。
 */
export const UNIT_SCALE_PRODUCT_RE = /^\s*\*\s*10(?:24|00)\b/
/**
 * 取遮罩纪律:两个位置判据都只在**遮罩文本**(`stripComments` 的输出,剥注释、留字符串)上运行,
 * 绝不回原始 src 截行 —— 正则截到右花括号会读错后半段(本仓记过),而逐条 `slice` 一个 ≤16 字符
 * 窗口 / 一次 `lastIndexOf` 是 O(1),不整文件切列。
 *
 * 单位乘积判定: `at` = 数字字面量**之后**的下标。
 */
export function isUnitScaleProduct(code, at) {
  if (typeof code !== 'string' || !(at > 0)) return false
  return UNIT_SCALE_PRODUCT_RE.test(code.slice(at, at + 16))
}
/**
 * 取值位置**所处对象字面量**的键名:从该位置向前找最近的 `{`,再取紧邻其前的 `key:`。
 * 找不到(函数体、CSS 规则体、模块顶层)⇒ null ⇒ 调用方按"无上下文"判,不猜。
 * `at` = 键名(不是数字)的下标。引号键(`'separator': {`)一并认。
 */
export function enclosingObjectKeyOf(code, at) {
  if (typeof code !== 'string' || !(at > 0)) return null
  const brace = code.lastIndexOf('{', at - 1)
  if (brace <= 0) return null
  const m = /(['"`]?)([A-Za-z_$][\w$]*)\1\s*:\s*$/.exec(code.slice(Math.max(0, brace - 80), brace))
  return m ? m[2] : null
}

/**
 * 键名 → 五类几何维之一;判不出返回 null(该值仍进 values,但不参与分类对账 ——
 * "没分类"不得冒充"这一类没有档")。
 * 顺序有意:font 先于 size(textSize 是字号不是盒宽)、padding 先于 spacing、
 * margin/gap 归「间距」、top/right/bottom/left/inset 也归「间距」(它们是偏移量,不是宽高)。
 * `ctxKey`(可选)= 该取值所处**外层对象**的键名,只用于分隔线那一型改道(见 `SEP_OBJECT_KEY_RE`);
 * 不传或传 null 时判据与旧版逐字相同,四维其余取用形态一字未动。
 */
export function dimOfKey(raw, ctxKey = null) {
  const camel = (v) =>
    String(v ?? '')
      .replace(/-([a-z])/g, (_, c) => c.toUpperCase())
      .toLowerCase()
  const s = camel(raw)
  if (!s) return null
  const ctx = camel(ctxKey)
  if (ctx && SEP_OBJECT_KEY_RE.test(ctx) && /width|height/.test(s)) return 'spacing'
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
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
