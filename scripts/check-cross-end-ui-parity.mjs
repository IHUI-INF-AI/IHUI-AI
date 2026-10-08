// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

// 跨端 UI 差异账 —— 回答一个问题:"小程序端和 RN 端这同一枚组件,长得一样吗?"
//
//   V1 可见几何档不同:两端各自的数字/类名档全部归一到 px 再比集合 —— 这就是用户看到的那一处不一样。
//   S1 同名组件两端各有一份实现:这才是"改一端、另一端不自动同步"的结构性根因,所以它单独计数报出。
//
// 样式语言(className vs StyleSheet)与 props 命名只随读数打印 —— 它们是 S1 的证据,不是观感本身。
//
// 配对的前置条件(2026-09-26 换判据):一条腿必须**从该端入口可达**(见 SEED_FILES 注)。
// 旧的"被自己以外引用一次"太弱 —— 桶文件顺手再导出就算引用,于是门会对一份根本不在 RN 屏幕上
// 渲染的 DOM 副本判"一致性"。人工核对想退回"同名即配对"用 `--pair-all`(默认档必做可达性剔除)。
//
// 同侧多候选的选腿(2026-09-27 O81 票⑭,配对源纳入 packages/app/src/features/** 后立):
// 一个族名可能同时躺在 components/ 与 features/** —— 三份活实现里 `packages/app/src/index.ts`
// 的 re-export 指向的那一份才是包公开出口的那张脸(UserInfoCard 即此型:components 那份零深导入,
// 出口在 features/cards)。选腿序 = **平台后缀 > 出口指向(re-export 链按名解到的那份,判据不是
// 猜测)> 目录序**;任何一支多候选都在人读面与 --json 逐条点名 chosen/others/by —— "静默选一份"
// 等于绿灯可能建立在死副本上(与票⑩ 配对键、票⑪ 换腿桶同一条洞的第三处)。
// 落地补记:本票第一次落地曾被并发会话整块回写(工作树副本被 `heal-worktree-tracked` 对齐成
// 旧版、旁路提交不在 HEAD 链上),同一内容第二次落地 —— 写面一律取 HEAD blob ⊕ 本票改动,
// 不复用任何工作树副本。runner 128 的 `stagedTriggers` **原写"只含 components/ 不含 features/"**,
// 该前提已于 2026-09-29 由 O92 票① 作废(现值含 `packages/app/src/features/`)⇒ 只改 features 组件的提交
// 现在同样唤起本门。两句都只是历史:编号与 triggers 一律现读 `git show HEAD:scripts/guardian-runner.mjs`,
// 不得按本行任何字面推断"某类提交不会被审"。
//
// 判定面与守门 77/83/93/98/103 同形:全量判 HEAD blob、--staged 判索引 blob、两面旗同给判死、
// 清单与正文**同面同轮**取;任一面取不到 ⇒ exit 2「无法判定」,不回落另一个面(回落就是把"没判"
// 写成"判过了")。刻意不开 --worktree 档:共享工作树常年滞后 HEAD,按磁盘判会在恒红与假绿之间来回跳,
// 并把错数写回棘轮台账(守门 83 的 R3 登记一天内被整文件回退三次即此型)。
//
// 定级:棘轮 blocking(锚点 = 台账里钉住的 HEAD 读数,只拦"把两端差异加大")。
// 为什么不是"当场全红 blocking":立项实测同名配对 19 对、其中 17 对有可见几何差异。与本次改动无关的
// 恒红门,唯一结局是逼人 --no-verify,一次绕过等于当天全部守门作废(§12e 实测型)。
import { execFileSync } from 'node:child_process'
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import { dirname, join, resolve } from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'
import { catBatch, gitBinary, gitRaw, selectFace, Undetermined } from './lib/face-reader.mjs'
import { mkScratch, rmScratch } from './lib/scratch-dir.mjs'
import { radiusEntriesOf, radiusLookup, radiusPxInLine, radiusSetOf } from './lib/radius-tokens.mjs'
import { facePx } from './lib/length-units.mjs'

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..')

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
const SIDES = {
  miniapp: ['apps/miniapp-taro/src/components'],
  rn: ['packages/app/src/components', 'packages/app/src/features', 'apps/mobile-rn/src/components'],
}
/**
 * 每端"自己屏幕上那份"的目录前缀。可达性层(pruneUnreachableLegs)按端各跑一遍图,
 * 走到这个前缀下的候选就是该端**自己**渲染的那一份 —— 所以这一序只在"两份都可达"时生效,
 * 端内那份是死副本时它根本进不了候选(不会把绿灯换成红灯)。
 */
const OWN_END_PREFIX = { miniapp: 'apps/miniapp-taro/', rn: 'apps/mobile-rn/' }
/**
 * **web 腿**(2026-09-30 立,补 AGENTS §4「web 与 miniapp-taro 视觉必须完全一致」在这一维的零判据)。
 *
 * 为什么过去没有:本门的 `SIDES` 只有 miniapp 与 rn,所以"web 改了小程序没改"这一型**结构上
 * 不可能被任何现有判据读到**(登记在册的那条:"128 的 rc 0 不得当成覆盖了三端")。
 * 为什么刻意**不塞进 SIDES**:塞进去会让几何 / SL / IC 每一维都平白多两组对,而 web 侧的尺寸
 * 住在 Tailwind utility 与 CSS 变量里,与 RN 的 StyleSheet 键**不在同一量纲**上 —— 那产出的
 * 不是"更多覆盖",而是把不比较的东西摆成在比较。
 * 所以这一腿今天只回答一个问题,而且只回答到文件级:**同一个组件名在 web 与小程序取的圆角档
 * 一不一样**。几何维刻意不判,并在人读面与 `--json` 面**明写"未判"**(不是"已确认相同")。
 *
 * 已知覆盖边界(逐条报出,不当通过):
 *  - 未做端入口可达性剔除(rn 腿那套图是从 RN 入口走的,web 需要另一张图)⇒ 一份死副本
 *    可能进配对;这一条写在报告里,不在代码里偷偷抹。
 *  - 只比**档值集合**(RD 量纲),不比元素名(RE 量纲):web 侧没有 StyleSheet 键可归属。
 */
const WEB_DIRS = ['apps/web/src/components', 'packages/ui-react/src/components']
const WEB_LEDGER = {
  counts: 'webCounts',
  radius: 'webRadiusCounts',
  element: 'webElementRadiusCounts',
  waivers: 'webWaivers',
}
const BASELINE_REL = 'scripts/cross-end-ui-parity-baseline.json'
/** 落在这些键/标识符上下文里的数字才算"看得见的尺寸"。 */
const GEO_KEY =
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
const NON_GEO_KEY =
  /(weight|letter|line-height|lineheight|opacity|zindex|z-index|duration|delay|easing|alpha|percent|ratio|count|index|version|iteration|order|priority|limit|timeout|timestamp|revision|level|depth|page)/i
const TW_SPACING_PX = (n) => n * 4
const TW_FONT_PX = { xs: 12, sm: 14, base: 16, lg: 18, xl: 20, '2xl': 24, '3xl': 30 }
/** 超过此值的"尺寸"不是组件几何(屏宽 / 动画毫秒 / 密度),不判。 */
const MAX_GEO_PX = 1200

/**
 * 剥注释但**保留字符串内容** —— 方向相反会各错一次:剥字符串会把 `className="w-[72rpx]"` 一起抹掉
 * (判据失明),留注释会把说明性数字喂进判据(假阳)。
 */
export function stripComments(src) {
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
        continue
      }
      if (c === '/' && n === '*') {
        mode = 'block'
        i++
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
      }
      continue
    }
    if (mode === 'block') {
      if (c === '*' && n === '/') {
        mode = 'code'
        i++
      }
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

const round = (n) => Math.round(n * 100) / 100

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
const RADIUS_FORM_RE = /rounded|radius|cornerradius|border-radius/i

/**
 * 一个文件 → 归一后的几何档集合 + 具名常量表。纯函数:自检钉的是它,不是打印。
 */
export function readGeometry(src, side, tiers = {}) {
  const code = stripComments(src)
  const named = {}
  const values = new Set()
  const push = (px) => {
    if (px !== null && px !== undefined) values.add(px)
  }
  const keyed = (name) =>
    GEO_KEY.test(name) && !NON_GEO_KEY.test(name) && !RADIUS_FORM_RE.test(name)

  for (const m of code.matchAll(
    /\b(?:const|let)\s+([A-Za-z_$][\w$]*)\s*=\s*(\d+(?:\.\d+)?)(?![\w.])/g,
  )) {
    if (!keyed(m[1])) continue
    const px = toPx(m[2], undefined, side)
    named[m[1]] = px
    push(px)
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
    if (!keyed(m[1].replace(/-([a-z])/g, (_, c) => c.toUpperCase()))) continue
    push(toPx(m[2], m[3], side))
  }
  for (const m of code.matchAll(/\brpx\(\s*(\d+(?:\.\d+)?)\s*\)/g)) push(toPx(m[1], 'rpx', side))
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
    if (!keyed(m[1].replace(/-([a-z])/g, (_, c) => c.toUpperCase()))) continue
    for (const raw of m[3].trim().split(/\s+/)) {
      const one = /^(\d+(?:\.\d+)?)(rpx|px)$/.exec(raw)
      if (one) push(toPx(one[1], one[2], side, 'runtime'))
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
      push(toPx(one[1], one[2], side))
    }
  }
  for (const m of code.matchAll(
    /(?:^|[\s"'`])(?:size|gap|p|m|px|py|mx|my|mt|mb|ml|mr|w|h|top|bottom|left|right|inset)-\[(\d+(?:\.\d+)?)(rpx|px)?\]/g,
  ))
    push(toPx(m[1], m[2], side))
  for (const m of code.matchAll(/(?:^|[\s"'`:](?:[a-z-]+:)?)size-(\d+(?:\.\d+)?)(?=$|[\s"'`])/g))
    push(round(TW_SPACING_PX(Number(m[1]))))
  // 内联盒/留白的**刻度档**(非任意值形态):`px-3`/`py-2`/`gap-4`/`mt-2` … 一律 ×4 折 px。
  // 不收这一档,同一族的两侧就不在同一口径上读数 —— RN 写 `paddingHorizontal: 12` 记进集合,
  // 小程序写 `px-3` 却不进集合,于是"仅 RN 档 12"是一条纯粹的比对噪声(实测 BottomActionBar 就这么错判过)。
  for (const m of code.matchAll(
    /(?:^|[\s"'`:](?:[a-z-]+:)?)(?:p|px|py|pt|pb|pl|pr|m|mx|my|mt|mb|ml|mr|gap|space-x|space-y)-(\d+(?:\.\d+)?)(?=$|[\s"'`])/g,
  ))
    push(round(TW_SPACING_PX(Number(m[1]))))
  // 尾视里**不含 `/`**:`w-1/3` 这类分数宽度不是 px 档(旧写法把 `w-1` 折成 4px 喂进集合,
  // 实测 ModelList 的骨架条 `w-1/3` 因此凭空多出一档"仅小程序 4")。
  for (const m of code.matchAll(/(?:^|[\s"'`:](?:[a-z-]+:)?)([hw])-(\d+(?:\.\d+)?)(?=$|[\s"'`])/g))
    push(round(TW_SPACING_PX(Number(m[2]))))
  for (const m of code.matchAll(/(?:^|[\s"'`])text-\[(\d+(?:\.\d+)?)(rpx|px)?\]/g))
    push(toPx(m[1], m[2], side))
  for (const m of code.matchAll(/(?:^|[\s"'`])text-(xs|sm|base|lg|xl|2xl|3xl)(?=$|[\s"'`/:])/g))
    push(TW_FONT_PX[m[1]] ?? null)
  for (const m of code.matchAll(/\bsize=\{(\d+(?:\.\d+)?)\}/g)) push(toPx(m[1], undefined, side))
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
      push(eff)
      if (named[name] === undefined) named[name] = eff
    }
    for (const [name, px] of Object.entries(alias)) {
      push(px)
      if (named[name] === undefined) named[name] = px
    }
  }
  return { values, named }
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

const fileName = (f) => f.split('/').pop()
/**
 * 单一源表(共享 spec + design-tokens 几何表)→ 具名档表。
 * 键:`SPEC_…_PX` 原样;`GEOMETRY_PX` 的档挂 `geometry.` 前缀(与消费侧 `rnGeometry.tapBox` 同形)。
 * 排除项按判据面而非按名字猜:带 `PER_` 的是单位换算系数(`TARO_RPX_PER_PX = 2` 不是尺寸档)、
 * 命中 NON_GEO_KEY / 圆角形态的不入表 —— 收了就是把换算系数当几何档喂进集合。
 */
export function specTiers(sources) {
  const tiers = {}
  // 两遍:几何表可能排在 spec 之后,先收表,再解析 `export const X = GEOMETRY_PX.y` 这类投影档。
  const geom = []
  for (const [rel, src] of Object.entries(sources)) {
    if (!/[\\/]geometry\.[jt]s$/.test(rel)) continue
    const table = stripComments(src).match(/GEOMETRY_PX\s*=\s*\{([\s\S]*?)\n\}/)
    if (!table) continue
    for (const m of table[1].matchAll(/([A-Za-z_$][\w$]*)\s*:\s*(\d+(?:\.\d+)?)/g))
      geom.push([m[1], Number(m[2])])
  }
  for (const [k, v] of geom) tiers[`geometry.${k}`] = v
  for (const [rel, src] of Object.entries(sources)) {
    if (/[\\/]geometry\.[jt]s$/.test(rel)) continue
    // `.d.ts` 是**声明**不是第二份档表:它的键集由 G 维单独与运行时表对账,
    // 混进这里会让"类型说了而表没有"的档被当成真档喂给判据。
    if (/\.d\.[jt]s$/.test(rel)) continue
    const code = stripComments(src)
    for (const m of code.matchAll(
      /export const ([A-Z][A-Z0-9_]*_PX)\s*=\s*(?:(\d+(?:\.\d+)?)(?![\w.])|(?:GEOMETRY_PX|rnGeometry|taroGeometry)\.([A-Za-z_$][\w$]*))/g,
    )) {
      const name = m[1]
      if (/PER_/.test(name) || NON_GEO_KEY.test(name) || RADIUS_FORM_RE.test(name)) continue
      const px = m[2] !== undefined ? Number(m[2]) : tiers[`geometry.${m[3]}`]
      if (typeof px === 'number' && px > 0) tiers[name] = px
      // 投影源取不到(表里没这一档 / 改了名)⇒ **不计入档表**:把"解析不出"当成 0 或跳过,
      // 等于让一次改名把整条具名档判据静默关掉 —— 与本门"判不出即点名"的口径同形,这里如实留空。
    }
  }
  return tiers
}

const normKey = (file) =>
  fileName(file)
    .replace(/\.(tsx|jsx|ts|js)$/i, '')
    .replace(/[^a-z0-9]/gi, '')
    .toLowerCase()
const nameOf = (file) => fileName(file).replace(/\.[^.]+$/, '')

/**
 * 配对键:先走 `normKey`,再剥掉**平台后缀**。
 * 机制要写准(2026-09-30 实测更正 —— 原文说"构建器按后缀解析同名实现,`SectionHeader.taro.tsx` 才是
 * weapp 上被打包的那一份"是错的):`@tarojs/helper/dist/utils.js` 的 `resolveMainFilePath()` 拼的是
 * `${p}.${process.env.TARO_ENV}${ext}`,所以真正的后缀竞争只在 `X.weapp.tsx` vs `X.tsx` 这一族;
 * `.taro.tsx` 是本仓自己的命名约定,它被打包是因为调用方**显式写了**说明符。表里因此既要留 weapp/h5/alipay
 * 这类 TARO_ENV 词,也要留 taro 这个约定词 —— 但理由不同,不得再混成一句"构建器认后缀"。
 * 后缀必须剥进同一个键:`normKey` 会把 `.taro` 一起吸进键里 ⇒ `SectionHeader` 与 `SectionHeader.taro`
 * 成不了对。
 * 本轮实测未配对名单里 `Selecter.taro / SectionHeader.taro / ColorfulLoader.taro` 全是这一型 ——
 * 是键判据太糙,不是"另一端没有这个元素"。只剥这一族明确的平台词,不做模糊匹配:
 * 宁可少配,也不把两个不同元素并成一对(那会造出假"同值",比漏配更坏)。
 */
const PLATFORM_SUFFIX = /(?:taro|weapp|h5|swan|tt|alipay|mp|rn|native)$/i
const pairKey = (f) => normKey(f).replace(PLATFORM_SUFFIX, '')
/** 族名 = 去扩展名后的文件名再剥平台后缀。后缀必须先随扩展名一起去掉。 */
const baseName = (f) => {
  const n = nameOf(f)
  return PLATFORM_SUFFIX.test(n) ? n.replace(/\.[^.]*$/, '') : n
}
/** 同键多候选时,带平台后缀那份优先(它是该端构建期真被解析进去的那份)。 */
const candRank = (f) => (PLATFORM_SUFFIX.test(normKey(f)) ? 0 : 1)

/**
 * 同侧多候选的唯一选腿比较器 —— scan() 与 pruneUnreachableLegs() 的换腿**共用它**
 * (两处各写一份选法必然漂移,与票⑪"换腿桶必须与配对键同键同序"是同一条禁令)。
 * 四序取小者胜(lex):
 *   1) candRank:平台后缀那份先 —— 理由是**本仓约定**:带后缀那份是被 import 显式点名的适配腿,
 *      同名 plain 那份在本仓历次实测里都是不可达副本(D172/O92 两批皆如此);Taro 并不按 `.taro` 解析
 *      (它认 `${TARO_ENV}`,见上方配对键注),所以这一支是"约定 + 实测"的优先级,不是构建器行为。
 *      真判据仍是可达性维(pruneUnreachableLegs)—— 若哪天 plain 那份才是被点名的腿,该由可达性翻案,
 *      而不是靠这条后缀优先级硬压;
 *   2) 同端自绘层:`ownEndPrefix` 之下那份(该端屏幕上真渲染的那一份)—— 本门比的是"同一元素
 *      在两端的脸",拿共享层卡去对端内卡就是拿两个不同的元素互相记账;
 *   3) 出口指向:`preferFile` 是该族 re-export 链解到的那份(判据,不是猜测);
 *   4) 先入桶序:即 SIDES 目录优先级不变(共享层在前)—— 没有以上证据时的兜底。
 * 返回 {chosen, others, by};by = 击败次名的那一序('suffix'|'own-end'|'exit'|'order'),供报告点名
 * "为什么选这份" —— 只报 chosen 不报依据,与静默选一份只差一层措辞。
 * `ownEndPrefix` 不传 ⇒ 第二序对所有候选同值 ⇒ 行为与票#9 之前**逐字一致**(既有调用与镜像用例不受影响)。
 */
export function pickCandidate(cands, preferFile = null, ownEndPrefix = null) {
  const score = (f, i) => [
    candRank(f),
    ownEndPrefix && f.startsWith(ownEndPrefix) ? 0 : 1,
    f === preferFile ? 0 : 1,
    i,
  ]
  const cmp = (a, b) => {
    for (let j = 0; j < 4; j++) if (a[j] !== b[j]) return a[j] - b[j]
    return 0
  }
  const order = cands.map((_, i) => i).sort((x, y) => cmp(score(cands[x], x), score(cands[y], y)))
  const w = order[0]
  let by = 'order'
  if (order.length > 1) {
    const a = score(cands[w], w)
    const b = score(cands[order[1]], order[1])
    for (let j = 0; j < 4; j++)
      if (a[j] !== b[j]) {
        by = ['suffix', 'own-end', 'exit', 'order'][j]
        break
      }
  }
  return { chosen: cands[w], others: cands.filter((_, i) => i !== w), by }
}

/** 两端清单 → 同名配对 + 计数。纯函数,构造面即可证明后缀、出口指向、目录优先级三条选腿判据。
 *  `preferMaps` = { miniapp?: Map<pairKey, 出口指向文件>, rn?: ... } —— 只作 pickCandidate 的第二序;
 *  不传时行为与票⑭ 之前逐字一致(后缀 > 目录序),既有两侧的直接调用与镜像用例不受影响。 */
export function scan(listMini, listRn, aliases = {}, preferMaps = {}) {
  const bucketize = (list) => {
    const m = new Map()
    for (const f of list) {
      if (!/\.(tsx|jsx)$/i.test(fileName(f))) continue
      const k = pairKey(f)
      if (!m.has(k)) m.set(k, [])
      if (!m.get(k).includes(f)) m.get(k).push(f)
    }
    return m
  }
  const resolveSide = (list, prefer, ownEnd) => {
    const winner = new Map()
    const multi = new Map()
    for (const [k, cands] of bucketize(list)) {
      const pick = pickCandidate(cands, prefer?.get(k) ?? null, ownEnd)
      winner.set(k, pick.chosen)
      if (cands.length > 1) multi.set(k, pick)
    }
    return { winner, multi }
  }
  const rnSide = resolveSide(listRn, preferMaps.rn, OWN_END_PREFIX.rn)
  const miniSide = resolveSide(listMini, preferMaps.miniapp, OWN_END_PREFIX.miniapp)
  const rnMap = rnSide.winner
  const miniMap = miniSide.winner
  const pairs = []
  for (const [k, f] of miniMap)
    if (rnMap.has(k))
      pairs.push({
        // 被审的**文件**是选腿判据挑出的那一份(平台后缀 > 出口指向 > 目录序),但**族名**必须剥掉后缀:
        // 名字若随当选候选变化,同一族在台账里就会有 `Foo` / `Foo.taro` 两个键,存量锚点互相顶掉
        // —— 与守门 134「锚点粒度不够细 ⇒ 换个写法就净零逃逸」是同一型。
        name: baseName(f),
        miniapp: f,
        rn: rnMap.get(k),
      })
  /**
   * 同侧多候选**逐条点名**(进 --json 与人读面)。这是"不得把两份实现读成两份真相"的最后一格:
   * 族在 components/ 与 features/** 同时存在时,静默选一份 = 改另一份任何读数都不动,而读者
   * 以为那一族在被审。只点名不判红 —— 多候选本身是结构事实,不是违规;违规的是**无声**。
   */
  const multiCandidates = []
  for (const p of pairs) {
    for (const [side, multi] of [
      ['miniapp', miniSide.multi],
      ['rn', rnSide.multi],
    ]) {
      const hit = multi.get(pairKey(p[side]))
      if (hit)
        multiCandidates.push({
          name: p.name,
          key: pairKey(p[side]),
          side,
          chosen: hit.chosen,
          others: hit.others,
          by: hit.by,
        })
    }
  }
  /**
   * **别名对**:两端把同一个界面元素起了不同名字(`CategoryBar` vs `CategoryInlineBar`、
   * `DrawerComponent` vs `Drawer`)时,任何按文件名的判据都看不见它们 —— 这一格过去只以
   * "射程外 N 个"的计数存在,而计数无法被清偿,因为没人知道名单里哪两个是同一个东西。
   * 台账逐条点名两侧文件,所以配对的**证据**是登记出来的、不是猜出来的。三条硬判据:
   * ① 声明本身要带 reason + 未到期 until(与拆对声明共用 `rejectProblem` —— 两处实现必漂移);
   * ② 两侧文件必须在**被审面**上真的找得到(路径写歪 / 文件搬家 ⇒ 判红,不得静默少配一族);
   * ③ 若这一对已按同名配上了,别名就是多余行 ⇒ 判红"应了结"(台账腐烂的另一半)。
   */
  const aliasProblems = []
  const consumed = new Set()
  for (const [name, a] of Object.entries(aliases)) {
    const prob = rejectProblem(a)
    if (prob) {
      aliasProblems.push({ name, problem: `别名声明坏了:${prob}` })
      continue
    }
    const m = listMini.find((f) => f === a.miniapp && /\.(tsx|jsx)$/i.test(fileName(f)))
    const r = listRn.find((f) => f === a.rn && /\.(tsx|jsx)$/i.test(fileName(f)))
    if (!m || !r) {
      aliasProblems.push({
        name,
        problem: `被审面的两端清单里找不到:${a.miniapp} / ${a.rn}(文件搬家或路径写歪)`,
      })
      continue
    }
    const mk = pairKey(m)
    const rk = pairKey(r)
    if (rnMap.has(mk) && miniMap.has(mk)) {
      aliasProblems.push({ name, problem: '该对已按同名配对 ⇒ 别名是多余行,应删(台账腐烂)' })
      continue
    }
    if (consumed.has(mk) || consumed.has(rk)) {
      aliasProblems.push({ name, problem: '同一侧文件被两条别名重复引用 ⇒ 至少一条是错的' })
      continue
    }
    consumed.add(mk)
    consumed.add(rk)
    pairs.push({ name, miniapp: m, rn: r, aliased: true })
  }
  const onlyMiniKeys = [...miniMap.keys()].filter((k) => !rnMap.has(k) && !consumed.has(k))
  const onlyRnKeys = [...rnMap.keys()].filter((k) => !miniMap.has(k) && !consumed.has(k))
  const out = {
    pairs: pairs.sort((a, b) => a.name.localeCompare(b.name)),
    aliasProblems,
    multiCandidates,
    onlyMiniapp: onlyMiniKeys.length,
    onlyRn: onlyRnKeys.length,
    // 名单本身必须报出来:只有计数的话,下一个人无从判断这 75 个名字里哪些是真不同名、
    // 哪些是配对判据还没覆盖到的同一元素 —— 而"报数不报名"正是本仓反复记过的失明确形态。
    onlyMiniappNames: onlyMiniKeys.map((k) => miniMap.get(k)).sort(),
    onlyRnNames: onlyRnKeys.map((k) => rnMap.get(k)).sort(),
    miniappCount: miniMap.size,
    rnCount: rnMap.size,
  }
  // 空扫就是本门要防的那一型故障(判据看不见 ⇒ 一路绿灯)。宁判死,不记通过。
  if (out.miniappCount === 0 || out.rnCount === 0)
    return {
      ...out,
      undetermined: true,
      reason: `组件面枚举为空(小程序 ${out.miniappCount} / RN ${out.rnCount})`,
    }
  return { ...out, undetermined: false, reason: null }
}

export function styleLanguage(src) {
  const code = stripComments(src)
  const sheet = /StyleSheet\.create\(/.test(code)
  const cls = /\bclassName\s*=/.test(code)
  if (sheet && cls) return 'mixed'
  if (sheet) return 'stylesheet'
  if (cls) return 'className'
  return 'none'
}

/** 图标载体:素材源不同则同一枚箭头的墨迹不可能逐位相同(端内 SVG 由 gen-taro-lucide-icons 从 lucide 提取)。 */
export function iconCarriers(src) {
  const out = new Set()
  for (const m of stripComments(src).matchAll(
    /from\s+['"]([^'"]*(?:lucide|LineIcon|icons\/|\.svg)[^'"]*)['"]/gi,
  ))
    out.add(m[1])
  return [...out].sort()
}

/**
 * 字形身份(不是载体模块):RN 取 lucide 导入名(PascalCase → kebab),小程序取 `<LineIcon name="…">`。
 * 两端同名 = 同一份 lucide 路径数据 ⇒ 墨迹才可能逐位相同;模块说明符相同而字形名不同,依旧不是一张脸。
 * 另收 `aizhsUrl('*.png')` 这类 CDN 位图槽 —— 位图不随主题反色、不跟字号缩放,当 UI 图标即分叉源。
 */
export function iconGlyphs(src) {
  const code = stripComments(src)
  const vector = new Set()
  for (const m of code.matchAll(/import\s*\{([^}]*)\}\s*from\s*['"][^'"]*lucide[^'"]*['"]/gi))
    for (const raw of m[1].split(',')) {
      const n = raw
        .trim()
        .split(/\s+as\s+/)[0]
        ?.trim()
      if (n && /^[A-Z]/.test(n)) vector.add(pascalToKebab(n))
    }
  for (const m of code.matchAll(/<LineIcon\b[^>]*?\bname\s*=\s*["']([a-z0-9-]+)["']/g))
    vector.add(m[1])
  /**
   * 字形名也常**当数据传**(配置数组 `{ key, label, icon: 'camera' }` + `<LineIcon name={item.icon}/>`)。
   * 只看 `<LineIcon name="…">` 字面量会把这些槽位判成"小程序未矢量化" —— 判据看不见自己产出的形态,
   * 就是给人发一张假的分叉账单。刻意要求本文件 import 了 LineIcon,免得把别的 `icon:` 业务字段算进来。
   */
  if (/from\s+['"][^'"]*LineIcon['"]/.test(code))
    for (const m of code.matchAll(/\bicon:\s*['"]([a-z0-9-]+)['"]/g)) vector.add(m[1])
  /**
   * 三元/条件传名(`name={mode === 'voice' ? 'keyboard' : 'mic'}`)里的字形名同样要认 ——
   * 判据只吃属性位字面量的话,语音切换这一格会被算成"小程序未矢量化",给用户的是一张假分叉账单。
   * 取 `name={…}` 花括号内的全部字符串字面量;模板拼接/变量传名取不到 ⇒ 不计(宁漏不误报,
   * 且 IC 的这部分只报数不判红)。
   */
  for (const tag of code.matchAll(/<LineIcon\b[\s\S]*?\/>/g)) {
    const expr = /\bname\s*=\s*\{([^}]*)\}/.exec(tag[0])
    if (!expr) continue
    // 只取第一个 `?` 之后的分支字面量 —— 条件操作数(`mode === 'voice'` 里的 'voice')不是字形名,
    // 全量收集会把比较值混进图标集合(自检 ㉛ 第一次跑就抓到这个)。
    const q = expr[1].indexOf('?')
    if (q < 0) continue
    for (const s of expr[1].slice(q).matchAll(/['"]([a-z0-9-]+)['"]/g)) vector.add(s[1])
  }
  const bitmap = []
  for (const m of code.matchAll(/aizhsUrl\(\s*['"]([^'"]*\.(?:png|jpe?g|gif))['"]/gi))
    bitmap.push(m[1])
  /**
   * RN 侧的位图载体此前**结构上看不见**:判据只认小程序的 `aizhsUrl('x.png')` 形态,
   * 于是"两端都用位图"(谁也没矢量化)与"RN 仍用位图"(账面把它读成小程序单侧问题)两型全隐。
   * 实测共享层输入区就是靠 `cdnHost` 拼栅格文件名取图(两端一致地错),账面却只喊小程序那一侧。
   * 口径:一行里同时出现栅格扩展名与图标/图片语境词(icon|image|uri|src|cdn|assets)才算一处载体;
   * 判据面已剥注释,说明文字里的文件名不会混进来。
   */
  const rnBitmap = []
  for (const line of code.split('\n')) {
    if (!/\.(png|jpe?g|gif|webp)\b/i.test(line)) continue
    if (!/(icon|image|uri|src|cdn|assets)/i.test(line)) continue
    const stem = /([a-z0-9][a-z0-9._-]*)\.(?:png|jpe?g|gif|webp)\b/i.exec(line)?.[1]
    rnBitmap.push(stem ?? line.trim().slice(0, 40))
  }
  return { vector: [...vector].sort(), bitmap, raster: rnBitmap }
}

const pascalToKebab = (s) => s.replace(/([a-z0-9])([A-Z])/g, '$1-$2').toLowerCase()

/**
 * 图标载体对账(IC)。判据与几何判据刻意分开:几何已同值的族,图标仍可能一端矢量一端位图 ——
 * 挂在"有几何差异才看"的分支上,就等于对最干净的那批组件失明。
 * 返回按组件名的 { bitmap, onlyRn, onlyMiniapp };`bitmap` 是待问责计数,`only*` 只报数不判红
 * (平台确有单侧控件,判红必成假阳)。
 */
export function iconAudit(pairs, text) {
  const out = []
  for (const p of pairs.pairs) {
    const a = text[p.miniapp]
    const b = text[p.rn]
    if (a === undefined || b === undefined) continue
    const ga = iconGlyphs(a)
    const gb = iconGlyphs(b)
    const av = new Set(ga.vector)
    const bv = new Set(gb.vector)
    const onlyRn = gb.vector.filter((n) => !av.has(n))
    const onlyMiniapp = ga.vector.filter((n) => !bv.has(n))
    // 豁免标记必须按**原始源码**数:它本身就住在注释里,拿 stripComments 后的面去找等于永远找不到
    // (自检 ㉙ 第一次跑就抓到这个 —— 判据写了豁免却恒不生效,账面还会一路报绿)。
    const exempted = (a.match(/icon-bitmap-exempt:/g) ?? []).length
    const bitmap = Math.max(0, ga.bitmap.length - exempted)
    // RN 侧同一条尺子:豁免标记同样按**原始源码**数(它住在注释里)。
    const rnExempted = (b.match(/icon-bitmap-exempt:/g) ?? []).length
    const rnBitmap = Math.max(0, gb.raster.length - rnExempted)
    // 两端拿**同一个字形名**都走位图 = 谁都没矢量化,这一型过去完全隐身。
    const bothBitmap = gb.raster.filter((n) => ga.bitmap.some((x) => x.includes(n)))
    if (!bitmap && !rnBitmap && !onlyRn.length && !onlyMiniapp.length) continue
    out.push({ name: p.name, bitmap, rnBitmap, bothBitmap, onlyRn, onlyMiniapp, exempted })
  }
  return out
}

/**
 * SL —— 一张 spec 档**只被一条腿消费**的清单。
 *
 * 为什么单列一维:具名档解析把"这条腿到底走没走单一源"变成了可读事实,于是出现一类
 * 既不是"同名不同值"、也不是"几何集合差档"的形态 —— `NAVBAR_BACK_BOX_PX` 只有小程序端引用,
 * RN 端仍写自己的数。把它折进 `values` 集合会造出一批"仅 RN 档 / 仅小程序档"的**假分叉读数**
 * (两端各有 3-26 枚单侧档,一次就是 9 族判红),而它真正的含义是"另一条腿还没接线"。
 * 所以这一维**只列名字、不折进几何集合**,并按 IC 同一形状做 HEAD 棘轮:存量只报数,
 * 新增单侧档(或新增一族)才判红 —— 当场判红就是一台与任何提交都无关的恒红门(§12e 同型)。
 * 域取 `tiers` 里 spec 导出的档名(**不含 `geometry.*`**)：通用档天然被很多端很多文件引用,
 * 按配对文件两两求差只会产出噪声。
 */
export function specLegAudit(pairs, text, tiers) {
  const specNames = Object.keys(tiers ?? {}).filter((n) => !n.startsWith('geometry.'))
  if (!specNames.length) return []
  const out = []
  for (const p of pairs.pairs) {
    const a = text[p.miniapp]
    const b = text[p.rn]
    if (a === undefined || b === undefined) continue
    const idsOf = (src) => new Set(src.match(/[A-Za-z_$][\w$]*/g) || [])
    const ia = idsOf(stripComments(a))
    const ib = idsOf(stripComments(b))
    const onlyMiniapp = specNames.filter((n) => ia.has(n) && !ib.has(n))
    const onlyRn = specNames.filter((n) => ib.has(n) && !ia.has(n))
    if (!onlyMiniapp.length && !onlyRn.length) continue
    out.push({ name: p.name, onlyMiniapp, onlyRn })
  }
  return out
}

/**
 * G —— 几何表与**它自己的类型声明**对账。
 *
 * 为什么归本门:上一维(SL/具名档)的全部判据都建立在"`GEOMETRY_PX` 里的数就是两端该取的数"
 * 之上,而这张表有**两份真相**:运行时的 `geometry.js` 与手写的 `geometry.d.ts`
 * (`export type GeometryStep = …`,三个出口都标成 `Record<GeometryStep, number>`)。
 * 两者一旦不同名,失效方式取决于有没有人引用新档:
 *  - 有引用 ⇒ `tsc` 报 TS2339(吵,当场就能看见);
 *  - **没引用 ⇒ 两边都不红**:类型说这张表只有 2 档,运行时 `Object.keys()` 给出 4 档,
 *    而本门正是按运行时键集读档表的 —— 于是判据信任了一个类型层根本不承认的档位。
 * 2026-09-27 实测到前者正在工作树上发生(`geometry.js` 加 `controlBox`/`controlGlyph`,
 * `.d.ts` 没跟,消费方 8 条 TS2339)。这条判据把它从"要靠有人去跑 typecheck"变成提交链上拦。
 *
 * 判据两侧都判(JS 有而 d.ts 无 / d.ts 有而 JS 无),因为反向漂移同样致命:类型承认一档、
 * 表里没有 ⇒ 消费方写 `rnGeometry.<那档>` 编译过而运行时取到 `undefined`。
 */
export function geometryDeclCheck(jsSrc, dtsSrc) {
  if (typeof jsSrc !== 'string' || typeof dtsSrc !== 'string')
    return { problem: '取不到几何表或其类型声明 ⇒ 未判定', undetermined: true }
  const body = jsSrc.match(/GEOMETRY_PX\s*=\s*\{([\s\S]*?)\n\}/)
  const union = dtsSrc.match(/export\s+type\s+GeometryStep\s*=\s*([^;]*?)(?:;|$)/m)
  if (!body || !union)
    return {
      problem: `解析不出几何表${body ? '' : '(GEOMETRY_PX 体)'}或 GeometryStep 联合${union ? '' : '(声明式)'} ⇒ 未判定`,
      undetermined: true,
    }
  const steps = [...body[1].matchAll(/^\s*([A-Za-z_$][\w$]*)\s*:\s*\d+(?:\.\d+)?\s*,?\s*$/gm)].map(
    (m) => m[1],
  )
  const declared = [...union[1].matchAll(/'([^']+)'/g)].map((m) => m[1])
  const missingInDts = steps.filter((s) => !declared.includes(s))
  const missingInJs = declared.filter((s) => !steps.includes(s))
  if (missingInDts.length + missingInJs.length === 0) return { steps, declared }
  const bits = []
  if (missingInDts.length)
    bits.push(
      `表里有档而类型不认:${missingInDts.join('/')}` +
        `(改 ` +
        'geometry.d.ts' +
        ' 的 GeometryStep;只加表不改类型 ⇒ 消费方 TS2339 或运行时 undefined)',
    )
  if (missingInJs.length)
    bits.push(`类型承认而表里没有:${missingInJs.join('/')} ⇒ 删该档名或把档位补回表`)
  return { steps, declared, missingInDts, missingInJs, problem: bits.join(' | ') }
}

/**
 * 拆对声明 —— "这两个同名文件根本是两个东西",与"两端确实不同形"是两种结论。
 *
 * 立论实例(2026-09-27 现读两端头注):`FloatBox` 小程序端是**右下角悬浮功能盒**(赚米/客服/反馈
 * 三按钮),RN 端是**顶部悬浮消息提示**(toast,4 种 type、3s 自动消失、由 Toast Portal 堆叠)。
 * 同名不同物 ⇒ 它的 4 处"几何差异"与 5 枚单侧档**不是一致性问题**,是配对本身错了。
 * 把这种族继续算进差异账,会让台账读起来比仓库更糟,也会诱导下一个人去"收敛"两个不同的小工具
 * —— 那正是"为消红改数字"的反面:该修的是尺子的输入,不是输出。
 *
 * 但拆对天然是一条**豁免通道**,所以判据收紧成三条,任一不成立即判红:
 *  ① `reason` 必须非空且够长(空串/占位不算,与 `waiverProblem` 同一取向);
 *  ② `until` 必须是合法日期且**未到期** —— 过期即红,"到期只判红不自动恢复配对",
 *     因为到期含义是"该重新判一次它到底是不是同一个东西",不是"免检期满";
 *  ③ 拆掉的族**不得再挂在 `counts` 或 `waivers` 上** —— 那是一笔双记账,账面会同时
 *     声称"这不是同一个元素"和"这个元素两端差 N 档"(清单腐烂的一种)。
 */
export function rejectProblem(r) {
  if (!r || typeof r !== 'object') return '拆对声明必须是对象(带 reason + until)'
  const reason = typeof r.reason === 'string' ? r.reason.trim() : ''
  if (reason.length < 12) return 'reason 缺失或过短(拆对是判据输入的改变,不是一句"不用管")'
  if (typeof r.until !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(r.until))
    return 'until 必须是 YYYY-MM-DD(拆对必须有复审日期,永不过期的拆对等于静默删族)'
  const until = Date.parse(`${r.until}T23:59:59Z`)
  if (Number.isNaN(until)) return `until 不是可解析的日期:${r.until}`
  if (until < Date.now()) return `拆对声明已到期(${r.until})⇒ 必须重新判这对到底是不是同一个元素`
  /**
   * `legs` 是**分腿维度**(2026-09-30 立,web 腿装上之后才出现的需要):
   * 一条拆对声明若不分腿,就会连带把**另一条腿的在册配对**一起摘线 —— 实测 LoginPopUp / UserInfoCard
   * 在主腿(miniapp↔RN)是有账的配对,而它们要拆的只是 web 腿那份同名件(不同物或零消费者)。
   * 旧写法只有一张全局名单,拆 web 就等于替主腿卸闸(= 别人那一维静默归零而账面什么都看不见)。
   * 缺省 = 两腿都拆,是为了让既有的 `FloatBox` 声明逐字不改行为。
   */
  if (r.legs !== undefined) {
    if (!Array.isArray(r.legs) || r.legs.length === 0) return 'legs 必须是非空数组(main / web)'
    const bad = r.legs.filter((l) => l !== 'main' && l !== 'web')
    if (bad.length) return `legs 含未知腿名:${bad.join(',')} ⇒ 一条不认识的腿名会让该腿静默不拆`
  }
  return null
}

/** 一条拆对声明作用在哪些腿上(缺省 = 两腿都拆;与 rejectProblem 的 `legs` 校验同处判定)。 */
export function rejectLegs(r) {
  const legs = Array.isArray(r?.legs) && r.legs.length ? r.legs : ['main', 'web']
  return { main: legs.includes('main'), web: legs.includes('web') }
}

/* ───────────────── 端入口可达性:什么才算"一条腿" ───────────────── */

/**
 * 种子 = 每端的入口。一条腿必须从这些点沿 import 走到,否则它只是"被执行过、没人用"。
 *
 * 立因(2026-09-26 实测):`packages/app/src/components/NavBar.tsx` 与 `UserInfoCard.tsx` 渲染的是
 * `div`/`span`(web DOM),在 RN 端根本不在屏幕上;旧判据"被自己以外引用一次就算一条腿"却因为
 * `packages/app/src/components/index.ts` 顺手再导出它们而放行。**桶文件在运行时确实会把未被人用的
 * 再导出一起求值,但求值 ≠ 有人在渲染** —— 本门要的是后者,所以再导出按**名字**路由:只有真被上游
 * import 点到的那个名字,才把它指向的源文件带进可达集。这不是完整 resolver,只回答"可达否"。
 */
const SEED_FILES = {
  miniapp: ['apps/miniapp-taro/src/app.tsx'],
  rn: ['apps/mobile-rn/App.tsx'],
  web: [],
}
const SEED_DIRS = { miniapp: [], rn: ['apps/mobile-rn/src/navigation'], web: ['apps/web/app'] }
/** 小程序的路由表在 `app.config.ts` 的**数据**里(不是 import),必须单独喂进种子。 */
const PAGE_MANIFEST = { miniapp: 'apps/miniapp-taro/src/app.config.ts', rn: null, web: null }
/**
 * 遍历面:两端源码 + `packages/` + web 腿源码(台账 G-978049③ 起 web 腿也做端入口剔除)。
 * apps/api·cli 不会被这三端 import,仍不取。
 */
const REACH_ROOTS = ['apps/miniapp-taro', 'apps/mobile-rn', 'packages', 'apps/web']
/**
 * web 腿的入口 = `apps/web/app` 的页面/布局层(Next app router:每个 page/layout 都是框架真渲染
 * 的入口,等价于另一端的路由表)。它是**次腿加判**:种子缺席(自检夹具仓/只含主腿的早期面)时
 * web 这一维整维挂起并留痕,绝不打死主腿判定 —— 主腿(miniapp↔rn)才是本门的存在理由。
 */
const REACH_SIDES_OPTIONAL = new Set(['web'])
const REACH_SRC_RE = /\.(?:tsx|jsx|ts|js|mjs|cjs)$/
const TEST_PATH_RE = /(^|\/)(?:tests?|__tests__|__mocks__|e2e)\//
const TEST_FILE_RE = /\.(?:test|spec)\.[cm]?[jt]sx?$/
/** `@/` 别名按宿主前缀映射(与各端 tsconfig paths 同源):miniapp/mobile-rn/web 三处。 */
const SLASH_ALIAS = {
  'apps/miniapp-taro/': 'apps/miniapp-taro/src/',
  'apps/mobile-rn/': 'apps/mobile-rn/src/',
  'apps/web/': 'apps/web/src/',
}
const EXT_CANDIDATES = [
  '',
  '.tsx',
  '.ts',
  '.jsx',
  '.js',
  '.mjs',
  '.cjs',
  '/index.tsx',
  '/index.ts',
  '/index.jsx',
  '/index.js',
]
/** 非模块导入(样式 / 资产):跟着走没有意义,单独一态,不混进"未判定"。 */
const NON_MODULE_RE =
  /\.(?:css|scss|sass|less|json|svg|png|jpe?g|gif|webp|avif|ttf|woff2?|ico|md|html)$/i

const EDGE_IMPORT = /(?:^|[\s;{}])import\s+(type\s+)?([^'"();]*?)\s*from\s*['"]([^'"]+)['"]/g
const EDGE_SIDE = /(?:^|[\s;{}])import\s*['"]([^'"]+)['"]/g
const EDGE_REEXPORT =
  /(?:^|[\s;{}])export\s+(type\s+)?(\*(?:\s+as\s+[A-Za-z_$][\w$]*)?|\{[^}]*\})\s*from\s*['"]([^'"]+)['"]/g
const EDGE_LOCAL_LIST = /(?:^|[\s;{}])export\s*\{([^}]*)\}(?!\s*from)/g
const EDGE_DYNAMIC = /(?:^|[^\w$.])import\s*\(([^)]*)\)/g
const EDGE_REQUIRE = /(?:^|[^\w$.])require\s*\(([^)]*)\)/g
const LOCAL_DEF =
  /(?:^|[\s;{}])export\s+(?:default\s+)?(?:async\s+)?(?:function|class|const|let|var)\s+([A-Za-z_$][\w$]*)/g
const HAS_DEFAULT = /(?:^|[\s;{}])export\s+default\b/

/** `{ A, B as C }` → `[{original:A,exported:A},{original:B,exported:C}]`;解不出的形态返回 null(交调用方按整模块处理)。 */
function specList(text) {
  const out = []
  for (const raw of String(text).split(',')) {
    const s = raw.trim()
    if (!s || /^type\b/.test(s)) continue
    const m = /^([A-Za-z_$][\w$]*)(?:\s+as\s+([A-Za-z_$][\w$]*))?$/.exec(s)
    if (!m) return null
    out.push({ original: m[1], exported: m[2] || m[1] })
  }
  return out
}

/** import 子句 → 需要的原始名集合;`null` = 整模块被用(默认导入 / `* as` / 副作用 / 混用)。 */
export function clauseDemand(clause) {
  const t = String(clause || '')
    .replace(/\s+/g, ' ')
    .trim()
  if (!t) return null
  if (/\*\s*as\b/.test(t)) return null
  const b = t.indexOf('{')
  if (b < 0) return null
  if (t.slice(0, b).replace(/,/g, ' ').trim()) return null
  const end = t.lastIndexOf('}')
  if (end < b) return null
  const list = specList(t.slice(b + 1, end))
  if (!list || !list.length) return null
  return list.map((s) => s.original)
}

/**
 * 一个模块 → 它依赖的边。四类:
 *   `use`   真实 import(整模块或按名)—— 无论本文件怎么被用,这些边都会被执行,**总是跟**
 *   `re`    `export { A as B } from 'x'` —— 只在被点名时按名字往下传
 *   `star`  `export * from 'x'` —— 通配,任何被点的名字都可能从这里过
 *   `ns`    `export * as n from 'x'` —— 等价于整模块被用
 * `type` / `export type` 一律不算(类型不进产物),与守门 126 同取向。
 */
export function parseModuleEdges(src) {
  const code = stripComments(src)
  const edges = []
  const undetermined = []
  const localExports = new Set()
  for (const m of code.matchAll(EDGE_IMPORT)) {
    if (m[1]) continue
    edges.push({ kind: 'use', spec: m[3], names: clauseDemand(m[2]) })
  }
  for (const m of code.matchAll(EDGE_SIDE)) edges.push({ kind: 'use', spec: m[1], names: null })
  for (const m of code.matchAll(EDGE_REEXPORT)) {
    if (m[1]) continue
    const body = m[2]
    if (body.startsWith('*')) {
      edges.push({ kind: /\bas\b/.test(body) ? 'ns' : 'star', spec: m[3], names: null })
      continue
    }
    const list = specList(body.slice(1, -1))
    if (!list) {
      edges.push({ kind: 'use', spec: m[3], names: null })
      continue
    }
    edges.push({
      kind: 're',
      spec: m[3],
      names: null,
      map: new Map(list.map((s) => [s.exported, s.original])),
    })
  }
  for (const m of code.matchAll(EDGE_DYNAMIC)) {
    const lit = /^\s*['"]([^'"]+)['"]\s*$/.exec(m[1] || '')
    if (lit) edges.push({ kind: 'use', spec: lit[1], names: null })
    else
      undetermined.push({ spec: (m[1] || '').trim().slice(0, 60), reason: '动态拼接的 import()' })
  }
  for (const m of code.matchAll(EDGE_REQUIRE)) {
    const lit = /^\s*['"]([^'"]+)['"]\s*$/.exec(m[1] || '')
    if (lit) edges.push({ kind: 'use', spec: lit[1], names: null })
    else
      undetermined.push({ spec: (m[1] || '').trim().slice(0, 60), reason: '动态拼接的 require()' })
  }
  for (const m of code.matchAll(LOCAL_DEF)) localExports.add(m[1])
  if (HAS_DEFAULT.test(code)) localExports.add('default')
  // `export { A, B }`(无 from)= 本文件把局部定义对外命名,同样算定义处。
  for (const m of code.matchAll(EDGE_LOCAL_LIST)) {
    const list = specList(m[1])
    if (list) for (const s of list) localExports.add(s.exported)
  }
  return { edges, localExports, undetermined }
}

/** 相对路径拼接:git 面恒为正斜杠,不用 node:path(它在 win32 上会写成反斜杠)。 */
function relJoin(baseDir, spec) {
  const out = []
  for (const s of `${baseDir}/${spec}`.split('/')) {
    if (!s || s === '.') continue
    if (s === '..') out.pop()
    else out.push(s)
  }
  return out.join('/')
}

/**
 * 解析到一个仓内文件。四态必分,尤其:**解析不到 ≠ 不存在**。
 * `{file}` 命中源码 / `{asset}` 样式或资产(不 traverse,也不计未判定)/
 * `{external}` 第三方包 / `{unresolved:原因}` 判不出 —— 交调用方计数并打印。
 */
function resolveSpecifier(spec, fromFile, ctx) {
  if (!spec) return { unresolved: '空说明符' }
  if (NON_MODULE_RE.test(spec)) return { asset: true }
  const tryCandidates = (base) => {
    for (const ext of EXT_CANDIDATES) if (ctx.files.has(base + ext)) return base + ext
    const stripped = base.replace(/\.[cm]?[jt]sx?$/, '')
    if (stripped !== base)
      for (const ext of EXT_CANDIDATES) if (ctx.files.has(stripped + ext)) return stripped + ext
    return null
  }
  let base = null
  if (spec.startsWith('./') || spec.startsWith('../') || spec === '.' || spec === '..') {
    base = relJoin(fromFile.split('/').slice(0, -1).join('/'), spec)
  } else if (spec.startsWith('@/')) {
    const owner = Object.keys(SLASH_ALIAS).find((root) => fromFile.startsWith(root))
    if (!owner) return { unresolved: '@/ 别名在该包未声明(不猜目标)' }
    base = SLASH_ALIAS[owner] + spec.slice(2)
  } else if (spec.startsWith('@ihui/')) {
    const m = /^@ihui\/([\w-]+)(?:\/(.*))?$/.exec(spec)
    const name = m ? `@ihui/${m[1]}` : null
    const dir = name && ctx.pkgDir.get(name)
    if (!dir) return { external: true }
    const sub = m[2] || ''
    /**
     * 三个候选基准,不做完整 resolver:清单给的入口(`main` / `exports['.']`,常指向**未构建的
     * dist**)→ 包根直拼 → 包根 `src/` 直拼(本仓多数包源码在 src/,而清单只记产物)。
     * 三个都拼不通才算"未判定",绝不当"这个模块不存在"。
     */
    const entry = sub ? null : ctx.pkgEntry.get(name)
    const bases = [entry, relJoin(dir, sub), relJoin(dir, `src/${sub}`)].filter(Boolean)
    for (const b of bases) {
      const hit = tryCandidates(b)
      if (hit) return { file: hit }
    }
    return { unresolved: `workspace 包入口解析不到:${spec}` }
  } else if (!spec.startsWith('/') && !/^[A-Za-z]:/.test(spec)) {
    return { external: true }
  } else {
    return { unresolved: `无法归类的说明符 ${spec}` }
  }
  const hit = tryCandidates(base)
  if (!hit) return { unresolved: `解析不到文件:${spec}` }
  if (!REACH_SRC_RE.test(hit)) return { asset: true }
  return { file: hit }
}

/** 各端"组件出口":rn 侧走包清单入口(@ihui/rn-app 的 main/exports),miniapp 侧只有这一份显式 barrel。 */
const EXIT_BARRELS = { miniapp: 'apps/miniapp-taro/src/components/index.ts', rn: '@ihui/rn-app' }

/**
 * 从一枚 package.json 文本取 @ihui 包的目录与入口。可达性层(pruneUnreachableLegs)
 * 与出口指向层(exitPreferMaps)**共用这一份读法** —— 两处各解析一遍 exports/main 必漂移,
 * 而漂移的产物是一条腿被判"可达"、另一处判"出口不指它"的自洽假账。
 * 坏 JSON 静默跳过:该包的 import 随后会落进"未判定",不在这一步猜。
 */
function readManifestInto(rel, raw, pkgDir, pkgEntry) {
  let j
  try {
    j = JSON.parse(raw)
  } catch {
    return
  }
  if (typeof j.name !== 'string' || !j.name.startsWith('@ihui/')) return
  const dir = rel.split('/').slice(0, -1).join('/')
  pkgDir.set(j.name, dir)
  const x = j.exports
  const dot = typeof x === 'string' ? x : x && typeof x === 'object' ? x['.'] : null
  let e = null
  if (typeof dot === 'string') e = dot
  else if (dot && typeof dot === 'object')
    e = dot.import || dot.default || Object.values(dot).find((v) => typeof v === 'string') || null
  if (!e && typeof j.main === 'string') e = j.main
  if (e) pkgEntry.set(j.name, relJoin(dir, e))
}

/**
 * 沿 **re-export 边**(带名)求 `name` 的定义文件集合:'re' 按 exported→original 往下传,
 * 'star' 原样传名,'use' 边**不跟** —— 有人 import 过不等于包对外出口指向它。
 * 本地定义(`export const` / 无 from 的 `export {}`)算定义处。断环靠 seen;
 * 取不到某跳文件 ⇒ notes 点名且该链不产出 —— "判不出"与"没有出口"是两件事,不得互写。
 */
function exitDefsOf(name, file, ctx, readText, notes, seen) {
  const out = new Set()
  const key = `${file}#${name}`
  if (seen.has(key)) return out
  seen.add(key)
  const src = readText(file)
  if (src === null) {
    notes.push(`出口链取不到 ${file} ⇒ 沿途名字不判优先(不当"没有出口")`)
    return out
  }
  const { edges, localExports } = parseModuleEdges(src)
  if (localExports.has(name)) out.add(file)
  for (const e of edges) {
    if (e.kind === 're' && e.map && e.map.has(name)) {
      const r = resolveSpecifier(e.spec, file, ctx)
      if (r.file)
        for (const f of exitDefsOf(e.map.get(name), r.file, ctx, readText, notes, seen)) out.add(f)
      else if (r.unresolved) notes.push(`出口链解析不到:${file} → ${e.spec}(不猜目标)`)
    } else if (e.kind === 'star') {
      const r = resolveSpecifier(e.spec, file, ctx)
      if (r.file) for (const f of exitDefsOf(name, r.file, ctx, readText, notes, seen)) out.add(f)
    }
  }
  return out
}

/**
 * 同侧多候选族的"出口指向"prefer 表:Map<pairKey, 文件>,只在链条**唯一**解到一份时收录;
 * 多解 / 零解 / 断链 ⇒ 不判优先并逐条 notes 点名(判不出不冒充成"没有出口",也不冒充成证据)。
 * 输入来自 scan() 的 multiCandidates —— 没有多候选就一次 git 派生都不做(真实仓今天只有
 * UserInfoCard 一族,读链 hop 个位数,不是全 corpus 扫描)。
 */
export function exitPreferMaps(repoRoot, face, multiCandidates) {
  const maps = { miniapp: new Map(), rn: new Map() }
  const notes = []
  if (!multiCandidates.length) return { maps, notes }
  const all = listAllFace(repoRoot, face)
  if (!all || !all.length) {
    notes.push('整面清单取不到 ⇒ 出口指向判据本轮不生效(选腿退回 后缀>目录序,候选仍逐条点名)')
    return { maps, notes }
  }
  const files = new Set(all)
  const pre = face === 'staged' ? ':' : 'HEAD:'
  const manifests = all.filter((p) => /^(?:apps|packages)\/[^/]+\/package\.json$/.test(p))
  const gotM = catBatch(
    repoRoot,
    manifests.map((r) => pre + r),
    { maxBuffer: 1 << 26 },
  )
  const pkgDir = new Map()
  const pkgEntry = new Map()
  for (const rel of manifests) {
    const raw = gotM.get(pre + rel)
    if (raw !== undefined && raw !== null) readManifestInto(rel, raw, pkgDir, pkgEntry)
  }
  const ctx = { face, files, pkgDir, pkgEntry }
  const entries = {
    rn: pkgEntry.get(EXIT_BARRELS.rn) ?? null,
    miniapp: files.has(EXIT_BARRELS.miniapp) ? EXIT_BARRELS.miniapp : null,
  }
  const textCache = new Map()
  const readText = (f) => {
    if (!textCache.has(f)) {
      const g = catBatch(repoRoot, [pre + f], { maxBuffer: 1 << 24 })
      const t = g.get(pre + f)
      textCache.set(f, t === undefined || t === null ? null : t)
    }
    return textCache.get(f)
  }
  const namesBySide = { miniapp: new Map(), rn: new Map() } // pairKey → 族名
  for (const c of multiCandidates) namesBySide[c.side].set(c.key, c.name)
  for (const side of ['miniapp', 'rn']) {
    if (!namesBySide[side].size) continue
    const entry = entries[side]
    if (!entry) {
      notes.push(`${side} 侧出口入口取不到 ⇒ 该侧无出口优先(不猜)`)
      continue
    }
    for (const [k, name] of namesBySide[side]) {
      const defs = [...exitDefsOf(name, entry, ctx, readText, notes, new Set())]
      if (defs.length === 1) maps[side].set(k, defs[0])
      else if (defs.length > 1)
        notes.push(`出口链对「${name}」解到 ${defs.length} 份定义 ⇒ 不判优先(${defs.join(' / ')})`)
      else notes.push(`出口链没解到「${name}」的定义文件 ⇒ 不判优先(不当"没有出口")`)
    }
  }
  return { maps, notes }
}

/**
 * Taro 路由表:`app.config.ts` 的 `pages` / `subPackages[].pages`(数据,不是 import)。
 * `root` 与紧随其后的 `pages` 配对;顶层 `pages` 出现在任何 root 之前,故初值为 ''。
 * 拼出来的 / 引号里带反引号的路径一律回 `unresolved`,交调用方计数 —— 不当"这个页不存在"。
 */
export function readTaroPages(src, pageDir) {
  const code = stripComments(src)
  const pages = []
  const unresolved = []
  let root = ''
  for (const m of code.matchAll(/(?:root|pages)\s*:\s*(\[[\s\S]*?\]|['"][^'"]*['"])/g)) {
    const chunk = m[1]
    if (!chunk.startsWith('[')) {
      const lit = /['"]([^'"]*)['"]/.exec(chunk)
      if (lit) root = lit[1]
      continue
    }
    for (const s of chunk.matchAll(/(['"])([^'"]*)\1|`([^`]*)`/g)) {
      // 反引号那一路(或引号里带 `${`)一律算拼出来的 —— 不得当"这个页不存在"
      const p = s[2] !== undefined ? s[2] : s[3]
      if (s[3] !== undefined || /\$\{/.test(p)) {
        unresolved.push(p)
        continue
      }
      pages.push(root ? `${pageDir}/${root}/${p}` : `${pageDir}/${p}`)
    }
  }
  return { pages, unresolved }
}

/**
 * 从端入口出发的可达集(名字路由见 SEED_FILES 上方注释)。
 * `ctx` = { face, files, pkgDir, pkgEntry, reached, read } —— 取材与解析都从 ctx 走,
 * 所以这一遍是纯图遍历:同一份 ctx 给两次,结论必相同(自检的构造面由此而来)。
 */
export function buildReach(seeds, ctx) {
  const state = new Map()
  const queue = []
  const undetermined = []
  const parsed = new Map()
  const st = (f) => {
    let s = state.get(f)
    if (!s) state.set(f, (s = { full: false, routed: new Set() }))
    return s
  }
  const askFull = (f) => {
    const s = st(f)
    if (s.full) return
    s.full = true
    queue.push({ f, names: null })
  }
  const askNames = (f, names) => {
    const s = st(f)
    if (s.full) return
    const fresh = names.filter((n) => !s.routed.has(n))
    if (!fresh.length) return
    for (const n of fresh) s.routed.add(n)
    queue.push({ f, names: fresh })
  }
  const edgesOf = (f, text) => {
    let p = parsed.get(f)
    if (!p) {
      p = parseModuleEdges(text)
      for (const u of p.undetermined) undetermined.push({ from: f, spec: u.spec, reason: u.reason })
      parsed.set(f, p)
    }
    return p
  }
  const route = (from, e, given) => {
    const r = resolveSpecifier(e.spec, from, ctx)
    if (r.external || r.asset) return
    if (r.unresolved) {
      undetermined.push({ from, spec: e.spec, reason: r.unresolved })
      return
    }
    if (given === null) askFull(r.file)
    else askNames(r.file, given)
  }
  for (const s of seeds) askFull(s)
  let steps = 0
  while (queue.length) {
    if (++steps > 200000) throw new Undetermined('可达性遍历步数超上限 ⇒ 判据失效,不得记为通过')
    const { f, names } = queue.shift()
    ctx.reached.add(f)
    const text = ctx.read(f)
    if (text === null || text === undefined) {
      undetermined.push({ from: null, spec: f, reason: `${FACE_TXT[ctx.face]}取不到内容` })
      continue
    }
    const { edges, localExports } = edgesOf(f, text)
    const served = new Set()
    for (const e of edges) {
      if (e.kind === 'use' || e.kind === 'ns') {
        route(f, e, e.kind === 'use' ? e.names : null)
        continue
      }
      if (names === null) {
        route(f, e, e.kind === 'star' ? null : [...e.map.values()])
        continue
      }
      if (e.kind === 'star') {
        // 通配再导出把需求整个传下去了 —— 名字若真没人接,由更深层自己报未判定,
        // 不在这一层重复喊(否则每个 `export *` 桶都会替它转发的每个名字编一条假"未判定")。
        for (const n of names) served.add(n)
        route(f, e, names)
        continue
      }
      const hit = names.filter((n) => e.map.has(n))
      if (!hit.length) continue
      for (const n of hit) served.add(n)
      route(
        f,
        e,
        hit.map((n) => e.map.get(n)),
      )
    }
    for (const n of names || []) {
      if (served.has(n)) continue
      if (localExports.has(n)) askFull(f)
      // 只有"这文件根本不是桶"(没有任何对外再导出)时,才把它当名字的 definitions 处整模块展开;
      // 是桶却没这个名 ⇒ 判不出,只计数。反过来(桶一律整展开)会把整个桶目录灌进可达集,
      // 那正是本判据要防的那一型 —— 两条分支各由一条自检钉住。
      else if (!edges.some((e) => e.kind === 're' || e.kind === 'star')) askFull(f)
      else undetermined.push({ from: f, spec: n, reason: '被点名的名字既无定义也无可路由的再导出' })
    }
  }
  return { used: ctx.reached, undetermined }
}

/** 整面清单(可达性要能走到任何路径,不随组件目录收窄)。取不到返回 null。 */
function listAllFace(repoRoot, face) {
  const args = face === 'staged' ? ['ls-files'] : ['ls-tree', '-r', '--name-only', 'HEAD']
  let out
  try {
    out = gitRaw(args, repoRoot, { timeout: 120000, maxBuffer: 1 << 26 })
  } catch {
    return null
  }
  if (out === null || out === undefined) return null
  return out
    .split('\n')
    .map((s) => s.trim())
    .filter(Boolean)
}

/**
 * 剔掉不构成一条腿的配对:腿文件必须从**该端入口**可达(旧判据"被引用一次"太弱,见 SEED_FILES 注)。
 * 三态都不静默:剔除逐条点名并带"从端入口不可达";解析不到的边计"未判定"并给总数;
 * 种子 / 路由表 / 清单取不到 ⇒ 整判据"无法判定";全部配对都被剔除 ⇒ 判据失明,同样不记通过。
 */
export function pruneUnreachableLegs(repoRoot, face, scanned, opts = {}) {
  const all = listAllFace(repoRoot, face)
  if (!all || !all.length)
    return {
      pairs: scanned,
      unreachable: [],
      undetermined: [],
      reason: `${FACE_TXT[face]}:取不到整面清单`,
    }
  const files = new Set(all)
  const inScope = (p) => REACH_ROOTS.some((r) => p === r || p.startsWith(`${r}/`))
  const corpus = all.filter(
    (p) => inScope(p) && REACH_SRC_RE.test(p) && !TEST_PATH_RE.test(p) && !TEST_FILE_RE.test(p),
  )
  const manifests = all.filter((p) => /^(?:apps|packages)\/[^/]+\/package\.json$/.test(p))
  const needed = [...new Set([...corpus, ...manifests])]
  const specs = needed.map((rel) => (face === 'staged' ? ':' : 'HEAD:') + rel)
  const got = catBatch(repoRoot, specs, { maxBuffer: 1 << 29, timeout: 180000 })
  const texts = new Map()
  const missing = new Set()
  for (let i = 0; i < needed.length; i++) {
    const t = got.get(specs[i])
    if (t === null || t === undefined) missing.add(needed[i])
    else texts.set(needed[i], t)
  }
  const pkgDir = new Map()
  const pkgEntry = new Map()
  // 包清单读法与出口指向层共用 readManifestInto —— 见该函数头注"两处各解析一遍必漂移"。
  for (const rel of manifests) {
    const raw = texts.get(rel)
    if (raw !== undefined) readManifestInto(rel, raw, pkgDir, pkgEntry)
  }
  const extraUndet = []
  /**
   * 可达集**按端各跑一遍**。混成一张图会串味:小程序页面只要 import 一次 `@ihui/rn-app`,
   * RN 侧那一份副本就被"另一端"走亮了 —— 而本门问的从来是"在**它自己那一端**的屏幕上有没有人用"。
   */
  const seedsBySide = {}
  const suspendedSides = []
  /** 单端种子收集:失败返回 `{suspend:原因}`,由调用方按"该端可选与否"决定判死还是挂起。 */
  const collectSeeds = (side) => {
    const seeds = []
    for (const f of SEED_FILES[side]) {
      if (!files.has(f)) return { suspend: `种子入口不在被审面上(${f})` }
      seeds.push(f)
    }
    for (const dir of SEED_DIRS[side]) {
      const hits = all.filter(
        (p) =>
          p.startsWith(`${dir}/`) &&
          REACH_SRC_RE.test(p) &&
          !TEST_PATH_RE.test(p) &&
          !TEST_FILE_RE.test(p),
      )
      if (!hits.length) return { suspend: `种子目录里没有源码(${dir})` }
      seeds.push(...hits)
    }
    const manifest = PAGE_MANIFEST[side]
    if (manifest) {
      if (!files.has(manifest)) return { suspend: `路由表不在被审面上(${manifest})` }
      const src = texts.get(manifest)
      if (src === undefined) return { suspend: `${FACE_TXT[face]}取不到路由表 ${manifest}` }
      const pageDir = manifest.split('/').slice(0, -1).join('/')
      const { pages, unresolved } = readTaroPages(src, pageDir)
      if (!pages.length) return { suspend: `${manifest} 里读不到任何页面 ⇒ 判据失明` }
      for (const p of unresolved)
        extraUndet.push({ from: manifest, spec: p, reason: '路由表里拼出来的页路径' })
      for (const p of pages) {
        const hit = EXT_CANDIDATES.map((x) => p + x).find((x) => files.has(x))
        if (hit) seeds.push(hit)
        else
          extraUndet.push({
            from: manifest,
            spec: p,
            reason: '路由表页路径解析不到文件(不当"不存在")',
          })
      }
      seeds.push(manifest)
    }
    return { seeds }
  }
  for (const side of Object.keys(SEED_FILES)) {
    const got = collectSeeds(side)
    if (got.suspend) {
      // 可选端(web 次腿)种子缺席 ⇒ 该端可达性整维挂起并留痕,不打死主腿;必选端维持原判死。
      if (!REACH_SIDES_OPTIONAL.has(side))
        return {
          pairs: scanned,
          unreachable: [],
          undetermined: [],
          reason: got.suspend,
        }
      suspendedSides.push(`${side}: ${got.suspend}`)
      seedsBySide[side] = null
      continue
    }
    seedsBySide[side] = got.seeds
  }
  const usedBySide = {}
  const undet = [...extraUndet]
  for (const side of Object.keys(seedsBySide)) {
    const seeds = seedsBySide[side]
    if (!seeds) continue // 挂起的可选端:usedBySide 不留该端 ⇒ 下面的剔除对该端不判(并留痕)
    const ctx = {
      face,
      files,
      pkgDir,
      pkgEntry,
      reached: new Set(),
      read: (f) => (texts.has(f) ? texts.get(f) : null),
    }
    const { undetermined } = buildReach(seeds, ctx)
    undet.push(...undetermined)
    // 一端一个文件都没走到 = 种子/清单本身错了(不是"这份没被用"),必须判死而非把整端剔光。
    if (!ctx.reached.size) {
      if (REACH_SIDES_OPTIONAL.has(side)) {
        suspendedSides.push(`${side}: 端入口一个文件都没走到`)
        continue
      }
      return {
        pairs: scanned,
        unreachable: [],
        undetermined: undet,
        reason: `${side} 端入口一个文件都没走到 ⇒ 判据失明`,
      }
    }
    usedBySide[side] = ctx.reached
  }
  const unreachable = []
  const kept = []
  const fallbacks = []
  /**
   * 换腿规则(2026-09-27 票⑭ 起统一):可达候选里用**同一个** pickCandidate 重选,与 scan() 同判据
   * (后缀 > 同端自绘层 > 出口指向 > 目录序)。两种触发各有实测出处:
   *   ① 首选层是死副本(2026-09-26:UserInfoCard / NavBar / Carousel 的 `packages/app` 那份零可达
   *      消费者,而 `apps/mobile-rn` 的同名件真在屏幕上)—— 旧行为"锁定首选层 → 不可达 → 剔对"
   *      会让这三对覆盖率为 0 而账面不喊;
   *   ② 首选层可达,但出口指向是另一份(票⑭:配对源纳入 features/** 后,components 与 features
   *      两份可能都活着,静默按目录序 = 绿灯建立在"未必是包出口那张脸"的份上)。
   * 换到的是哪条腿必须留痕(静默换腿等于把判据的输入挪走而没人知道)。
   */
  const altsBySide = {}
  for (const side of Object.keys(SIDES)) {
    const m = new Map()
    for (const dir of SIDES[side]) {
      for (const p of all) {
        if (!p.startsWith(`${dir}/`) || !/\.(tsx|jsx)$/i.test(fileName(p))) continue
        const k = pairKey(p)
        if (!m.has(k)) m.set(k, [])
        if (!m.get(k).includes(p)) m.get(k).push(p)
      }
    }
    altsBySide[side] = m
  }
  const preferMaps = opts.preferMaps ?? {}
  for (const p of scanned.pairs) {
    const cur = { miniapp: p.miniapp, rn: p.rn }
    const moved = []
    for (const side of ['miniapp', 'rn']) {
      const reach = usedBySide[side]
      // 取不到内容的当前腿不换(旧护栏:可能只是二进制/坏 blob,不当"不可达"也不动它)。
      if (missing.has(cur[side])) continue
      const bucket = altsBySide[side].get(pairKey(cur[side])) ?? []
      const usable = bucket.filter((f) => !missing.has(f) && reach.has(f))
      if (!usable.length) continue // 整桶都不可达 ⇒ 维持原位,交给下面的 bad 判定剔对(旧行为)
      // pairKey 剥掉平台后缀之后,同一个桶里会同时躺着 `Foo.taro.tsx` 与 `Foo.tsx` —— 选腿与 scan()
      // 共用 pickCandidate,四序同判据;并列时保留先入桶者,即 SIDES 目录优先级不变。
      const pick = pickCandidate(
        usable,
        preferMaps[side]?.get(pairKey(cur[side])) ?? null,
        OWN_END_PREFIX[side] ?? null,
      )
      if (pick.chosen !== cur[side]) {
        moved.push(`${cur[side]} → ${pick.chosen}`)
        cur[side] = pick.chosen
      }
    }
    // 取不到内容的文件不参与判定(可能是二进制)—— 宁可不剔,也不把"没判"当"不可达"。
    const bad = ['miniapp', 'rn'].filter((s) => !usedBySide[s].has(cur[s]) && !missing.has(cur[s]))
    if (!bad.length) {
      if (moved.length) fallbacks.push({ name: p.name, moved })
      kept.push({ ...p, miniapp: cur.miniapp, rn: cur.rn })
      continue
    }
    unreachable.push({
      name: p.name,
      side: bad[0],
      legs: bad.map((s) => cur[s]),
      reason: bad.map((s) => `${cur[s]} 从端入口不可达`).join(';'),
    })
  }
  /**
   * web 腿剔除(台账 G-978049③):与主腿同一句判据 —— 配对的两条腿都得**各自从自己那一端**
   * 的入口可达。web 侧文件必须从 web 入口(apps/web/app 页面/布局层)走到;miniapp 侧复用上面
   * 同一份可达集(主腿判过的事不对 web 腿再判一遍,但配对前提相同:小程序那份死了,配对同样不成立)。
   * web 可达性挂起(种子缺席)时只按 miniapp 侧判,web 侧不猜 —— 挂起本身留痕返回。
   * 剔除逐条点名,与主腿同一要求:静默删族 = 判据输入被改而没人知道。
   */
  const webScanned = opts.webPairs ?? []
  const webKept = []
  const webUnreachable = []
  const legFile = (p, side) => (side === 'web' ? p.rn : p.miniapp)
  const sideLabel = (side) => (side === 'web' ? 'web' : '小程序')
  for (const p of webScanned) {
    const bad = []
    for (const side of ['miniapp', 'web']) {
      const reach = usedBySide[side]
      const f = legFile(p, side)
      // 该端可达性在判(未挂起)且文件内容取得到,才作"不可达"判定;否则不猜。
      if (reach && !missing.has(f) && !reach.has(f)) bad.push(side)
    }
    if (!bad.length) {
      webKept.push(p)
      continue
    }
    webUnreachable.push({
      name: p.name,
      side: bad[0],
      legs: bad.map((s) => legFile(p, s)),
      reason: bad.map((s) => `${legFile(p, s)} 从${sideLabel(s)}端入口不可达`).join(';'),
    })
  }
  // 全被剔除不再是"判据失明"(小夹具本就可能只剩一份死副本),但必须喊出来 —— 覆盖面掉了要看得见。
  const note =
    scanned.pairs.length && !kept.length
      ? `全部 ${scanned.pairs.length} 对的两端都不可达:本门这一轮对空气判定,请核种子`
      : fallbacks.length
        ? `${kept.length} 对中有 ${fallbacks.length} 对换了腿(首选层从端入口不可达,或可达候选里出口指向另一份):${fallbacks
            .map((f) => f.name)
            .join(', ')} —— 覆盖面因此比账面大,不是"存量已同值"`
        : null
  return {
    pairs: { ...scanned, pairs: kept },
    unreachable,
    undetermined: undet,
    reason: null,
    note,
    fallbacks,
    webPairs: webKept,
    webUnreachable,
    webReachSuspended: suspendedSides.length ? suspendedSides.join('; ') : null,
  }
}

const FACE_TXT = { head: 'HEAD', staged: '索引' }

/**
 * 清单按面取:`ls-tree` 不认 `--cached`(传进去是 unknown option ⇒ 整面取不到)。索引面只能走
 * `ls-files`;内容仍由 `catBatch(':path')` 取,清单与内容同面同轮。
 */
function listFace(repoRoot, face, dir) {
  const args =
    face === 'staged'
      ? ['ls-files', '--', dir]
      : ['ls-tree', '-r', '--name-only', 'HEAD', '--', dir]
  const out = gitRaw(args, repoRoot, {})
  if (out === null || out === undefined) return null
  return out
    .split('\n')
    .map((s) => s.trim())
    .filter(Boolean)
}

/**
 * 面 → 两端清单 + 同名配对正文。一次 cat-file --batch 同面同轮读完;任一份取不到即 Undetermined。
 * `pairAll` 是人工核对的逃生舱:退回"只要同名就配对",不做可达性剔除(默认档必做)。
 */
export function collect(
  repoRoot,
  face,
  { pairAll = false, rejected = [], rejectMap = {}, aliases = {} } = {},
) {
  /**
   * 拆对名单**按腿求**(`rejectLegs` 是那一份判据的唯一出口,这里不再判断形状)。
   * 两腿共用一张全局名单会在"只想拆 web 那份同名件"时把主腿的在册配对一起摘掉 —— 表现不是报错,
   * 而是主腿那一维静默归零(实测 LoginPopUp / UserInfoCard 在主腿有账)。
   */
  const rejFor = (leg) =>
    new Set(
      rejected.filter(
        (n) => (n in rejectMap ? rejectLegs(rejectMap[n]) : { main: true, web: true })[leg],
      ),
    )
  const rejSet = rejFor('main')
  const rejWebSet = rejFor('web')
  const lists = {}
  for (const [side, dirs] of Object.entries(SIDES)) {
    const acc = []
    for (const dir of dirs) {
      const out = listFace(repoRoot, face, dir)
      if (out === null) throw new Undetermined(`${FACE_TXT[face]}取不到目录清单 ${dir}`)
      acc.push(...out)
    }
    lists[side] = acc
  }
  /**
   * web 腿的同名配对。**复用同一个 `scan`**(pairKey、平台后缀剥离、同侧多候选的选腿四序都在
   * 它里面)—— 另写一份配对键就会与主腿漂开,而漂开的表现是"两腿各自报 0 分叉而配的不是
   * 同一件事"。`scan` 的第二参数字段名叫 `rn`,这一腿里装的是 web 文件;不改字段名是为了
   * 不牵动主腿的十几处硬编码,代价是下面读数时必须逐条点名"这是 web 腿"。
   */
  let webPairs = []
  let webRejected = []
  let webBlocked = null
  {
    const webList = []
    for (const dir of WEB_DIRS) {
      const out = listFace(repoRoot, face, dir)
      if (out === null) {
        webBlocked = `${FACE_TXT[face]}取不到 web 腿目录清单 ${dir}`
        break
      }
      webList.push(...out)
    }
    if (!webBlocked) {
      const webScan = scan(lists.miniapp, webList, {}, {})
      // 空面 ⇒ scan 判"枚举为空"。这一腿**不**因此把整道门打死:主腿(miniapp↔rn)是这门的存在理由,
      // 一个次腿量不到就 exit 2,等于让夹具仓与任何只动主腿的提交被无关的一腿挡住(恒红那一型)。
      // 代价必须用另一条补:台账里挂着 web 键而本轮整腿没产出 ⇒ 下面按"整族消失"判红,
      // 所以"删掉 web 目录让这一维安静"走不通。
      if (webScan.undetermined) webBlocked = `web 腿配对判据失明:${webScan.reason}`
      else {
        const webAll = webScan.pairs ?? []
        webPairs = webAll.filter((p) => !rejWebSet.has(p.name))
        // 被 web 腿拆掉的族必须**留名**:静默删族与"这一腿本来就配不到"在账面上长得一样,
        // 而前者是判据输入被改动 —— 与主腿的 rejected 同一条要求。
        webRejected = webAll.filter((p) => rejWebSet.has(p.name))
      }
    }
  }
  /**
   * 两遍 scan:第一遍无出口信息,只为拿到"同侧多候选"名单 —— 出口链只需为这些族按名走
   * re-export(无多候选 ⇒ 零额外 git 派生);第二遍带 prefer 重配对,选腿判据 =
   * 平台后缀 > 出口指向 > 目录序。两遍都是纯函数,构造面可证(镜像 T16 钉两处必须共用)。
   */
  const probe = scan(lists.miniapp, lists.rn, aliases)
  const exit = exitPreferMaps(repoRoot, face, probe.multiCandidates ?? [])
  let pairs = scan(lists.miniapp, lists.rn, aliases, exit.maps)
  if (pairs.undetermined) throw new Undetermined(`${pairs.reason} ⇒ 判据失明,不得记为通过`)
  /**
   * 拆对声明在**可达性剔除之前**生效:同名不同物的两个组件不该再产生任何一维读数
   * (几何、SL、IC 三维修的是同一句话"这是同一个界面元素")。但它必须留在账面上被点名,
   * 不得变成静默删族 —— 所以被拆掉的族由 main 逐条打印,且判据要求台账里不再挂它的锚点。
   */
  const rejectedHits = pairs.pairs.filter((p) => rejSet.has(p.name))
  if (rejSet.size) pairs = { ...pairs, pairs: pairs.pairs.filter((p) => !rejSet.has(p.name)) }
  let unreachable = []
  let undeterminedEdges = []
  let coverageNote = null
  let fallbacks = []
  let webUnreachableLegs = []
  let webReachNote = null
  if (pairAll) pairs = { ...pairs, pairAll: true }
  else {
    const pruned = pruneUnreachableLegs(repoRoot, face, pairs, { preferMaps: exit.maps, webPairs })
    if (pruned.reason) throw new Undetermined(`端入口可达性判据无法成立:${pruned.reason}`)
    pairs = pruned.pairs
    unreachable = pruned.unreachable
    undeterminedEdges = pruned.undetermined
    coverageNote = pruned.note ?? null
    fallbacks = pruned.fallbacks ?? []
    // web 腿剔除与主腿同一轮完成(G-978049③):剔除后的配对才是进各维读数的那一份。
    webPairs = pruned.webPairs ?? webPairs
    webUnreachableLegs = pruned.webUnreachable ?? []
    webReachNote = pruned.webReachSuspended ?? null
  }
  const need = [
    ...new Set([
      ...pairs.pairs.flatMap((p) => [p.miniapp, p.rn]),
      ...webPairs.flatMap((p) => [p.miniapp, p.rn]),
    ]),
  ]
  const text = {}
  const specs = need.map((rel) => (face === 'staged' ? ':' : 'HEAD:') + rel)
  const got = catBatch(repoRoot, specs, { maxBuffer: 1 << 28 })
  for (let i = 0; i < need.length; i++) {
    const t = got.get(specs[i])
    if (t === null || t === undefined) throw new Undetermined(`${FACE_TXT[face]}取不到 ${need[i]}`)
    text[need[i]] = t
  }
  /**
   * 组件**自己 import 的本地样式表**并入同一轮读数。不并的后果是实测到的:
   * 6 个小程序配对组件把盒档写在同名 `.css` 里,配对源只有 `.tsx` ⇒ 读成
   * "RN 有 11 档、小程序 0 档"的**测量假象**(与 §4 记过的"CSS 声明形态整面隐身"同一条洞)。
   * 只跟相对路径 import 的 `.css/.scss/.less`,不做全局 CSS 扫描 —— 把别处的档算到这个组件
   * 头上比漏读更糟。取不到的 ⇒ 并进未判定点名,不得静默当"这一侧没有档"。
   */
  const styles = {}
  const cssRefs = new Map()
  for (const f of need) {
    const refs = [
      ...text[f].matchAll(/(?:^|\n)\s*import\s+['"](\.[^'"]+\.(?:css|scss|less))['"]/g),
    ].map((m) => resolveRel(f, m[1]))
    if (refs.length) cssRefs.set(f, [...new Set(refs)])
  }
  if (cssRefs.size) {
    const all = [...new Set([...cssRefs.values()].flat())]
    const pre = face === 'staged' ? ':' : 'HEAD:'
    const got2 = catBatch(
      repoRoot,
      all.map((rel) => pre + rel),
      { maxBuffer: 1 << 28 },
    )
    for (const [f, rels] of cssRefs) {
      const parts = []
      for (const rel of rels) {
        const t = got2.get(pre + rel)
        if (t === null || t === undefined) {
          undeterminedEdges.push({
            from: f,
            spec: rel,
            reason: `${FACE_TXT[face]}取不到伴生样式表`,
          })
          continue
        }
        parts.push(t)
      }
      if (parts.length) styles[f] = parts.join('\n')
    }
  }
  /**
   * **盲区点名**:配对腿用到了某个类名,而它的定义不在本组件自己的样式表里 ⇒ 该元素的盒档
   * 落在全局表(`app.css` / 某页 `*.css`),本门读不到。只点名不归因(理由见 unresolvedClassNames 头注)。
   */
  /**
   * 全局样式表里**真定义过**的类名 = 这条披露的交集域。不做交集的话,属性窗口里捞到的
   * 枚举值会被当成"盲区"报出来(实测第一版报 140 个,`completed` / `read` / `check` 根本不是类名)——
   * **会喊错的披露和没有披露一样没人信。**
   * 只扫小程序端:RN 侧盒档走 StyleSheet,不存在"落在全局表"这一型。
   */
  const globalDefined = new Set()
  const listM = listFace(repoRoot, face, 'apps/miniapp-taro/src')
  if (listM === null)
    undeterminedEdges.push({
      from: '(清单)',
      spec: 'apps/miniapp-taro/src',
      reason: `${FACE_TXT[face]}取不到目录清单 ⇒ 盲区交集域为空,本维判不出`,
    })
  else {
    const cssG = listM.filter((x) => /\.(css|scss|less)$/i.test(x))
    const preG = face === 'staged' ? ':' : 'HEAD:'
    const gotG = catBatch(
      repoRoot,
      cssG.map((rel) => preG + rel),
      { maxBuffer: 1 << 28 },
    )
    for (const rel of cssG) {
      const t = gotG.get(preG + rel)
      if (t === null || t === undefined) continue
      for (const m of t.matchAll(/\.([a-z][a-z0-9]*(?:-[a-z0-9]+)*)\s*[{,:]/gi))
        globalDefined.add(m[1])
    }
  }
  const blindClasses = []
  for (const p of pairs.pairs) {
    const f = p.miniapp
    if (text[f] === undefined) continue
    const miss = unresolvedClassNames(text[f], styles[f] ?? '', globalDefined)
    if (miss.length) blindClasses.push({ name: p.name, side: 'miniapp', file: f, classes: miss })
  }
  /**
   * 具名档表与组件正文**同面同轮**取:清单来自被审面,内容也来自被审面。
   * 取不到任何一份 ⇒ Undetermined。空表不等于"没有单源档",那是一台瞎了的尺子 ——
   * 正因如此,枚举到 0 个 spec 文件也判死(不得把"表空"读成"两端都没用单源,所以差异为 0")。
   */
  const specDir = 'packages/shared/src/ui'
  const specList = listFace(repoRoot, face, specDir)
  if (specList === null) throw new Undetermined(`${FACE_TXT[face]}取不到目录清单 ${specDir}`)
  const specFiles = specList.filter((p) => /-spec\.ts$/.test(p))
  if (!specFiles.length)
    throw new Undetermined(`${FACE_TXT[face]}在 ${specDir} 枚举到 0 个 *-spec.ts ⇒ 具名档判据失明`)
  /**
   * 几何表(`GEOMETRY_PX`)按**是否真被引用**决定缺件算不算失明:夹具可以没有它,
   * 但只要有一个配对文件写着 `rnGeometry.` / `taroGeometry.` 而表取不到,那就是判据看不见
   * 这一档 —— 与"目录清单为空却记绿"同型,必须喊死。
   */
  const geoPath = 'packages/design-tokens/src/geometry.js'
  const geoDtsPath = 'packages/design-tokens/src/geometry.d.ts'
  const geoList = listFace(repoRoot, face, 'packages/design-tokens/src')
  const hasGeo = geoList === null ? false : geoList.includes(geoPath)
  // 表在而它的类型声明不在 ⇒ 不是"没有第二份真相",而是这份真相取不到 —— 按未判定喊死,
  // 不得因为"表本身读到了"就当对账通过(那正是本维要防的那一型)。
  const hasGeoDts = geoList === null ? false : geoList.includes(geoDtsPath)
  if (hasGeo && !hasGeoDts)
    throw new Undetermined(`${FACE_TXT[face]}有 ${geoPath} 而无 ${geoDtsPath} ⇒ 几何表无从对账`)
  const radiusPath = 'packages/design-tokens/src/radius.js'
  const hasRadius = geoList === null ? false : geoList.includes(radiusPath)
  // 几何表与圆角表共用 tierPaths ⇒ 同面同轮一次读满,不另起一次 git 派生。
  const tierPaths = [
    ...specFiles,
    ...(hasGeo ? [geoPath, geoDtsPath] : []),
    ...(hasRadius ? [radiusPath] : []),
  ]
  const tierSpecs = tierPaths.map((rel) => (face === 'staged' ? ':' : 'HEAD:') + rel)
  const tierGot = catBatch(repoRoot, tierSpecs, { maxBuffer: 1 << 26 })
  const specSources = {}
  for (let i = 0; i < tierPaths.length; i++) {
    const t = tierGot.get(tierSpecs[i])
    if (t === null || t === undefined)
      throw new Undetermined(`${FACE_TXT[face]}取不到具名档来源 ${tierPaths[i]}`)
    specSources[tierPaths[i]] = t
  }
  if (!hasGeo && need.some((rel) => /\b(?:rnGeometry|taroGeometry|GEOMETRY_PX)\./.test(text[rel])))
    throw new Undetermined(`${FACE_TXT[face]}取不到 ${geoPath},而配对组件在引用几何表 ⇒ 判据失明`)
  /**
   * 圆角档表同一条失明判据:表取不到而配对组件在用圆角形态 ⇒ 那一维看不见,不得把"看不见"
   * 记成"两端一致"。空表(解析失败)与缺文件同罪。
   */
  const radiusTable = hasRadius ? radiusLookup(specSources[radiusPath]) : null
  const usesRadius = (rel) => /\brounded-|rnRadius|var\(--radius|borderRadius/i.test(text[rel])
  if (!radiusTable && need.some(usesRadius))
    throw new Undetermined(
      `${FACE_TXT[face]}取不到 ${radiusPath} 或档位表解析为空,而配对组件在用圆角 ⇒ 圆角维判据失明`,
    )
  const tiers = specTiers(specSources)
  const geoDecl = hasGeo
    ? geometryDeclCheck(specSources[geoPath], specSources[geoDtsPath])
    : { skipped: true }
  return {
    pairs,
    webPairs,
    webRejected,
    webBlocked,
    webUnreachableLegs,
    webReachNote,
    text,
    styles,
    blindClasses,
    tiers,
    radius: radiusTable,
    geoDecl,
    rejected: rejectedHits,
    unreachableLegs: unreachable,
    undeterminedEdges,
    coverageNote,
    fallbacks,
    exitNotes: exit.notes,
  }
}

/** 一处"看得见的差异" = 一个档值(具名常量不同值另计,同一处不双计)。 */
export function diffCount(f) {
  return f.named.length + f.geometry.onlyMiniapp.length + f.geometry.onlyRn.length
}

/**
 * 圆角单独立账,**不并入 `diffCount`**:锚点若把两维合成一个数,"修掉一处几何档 + 加回一处圆角档"
 * 会净零逃逸(守门 134 扩布尔档键时新造的那条通道,同一型)。分家后各维各自只减不增。
 */
export function radiusCount(f) {
  return (f.radius?.onlyMiniapp.length ?? 0) + (f.radius?.onlyRn.length ?? 0)
}

/**
 * ── RS 根槽位维(台账 G-629)────────────────────────────────────────
 *
 * **为什么 RD 恒 0 而门对真实投诉一条都不判**:RD(与 RE)比的都是"**文件里**出现过的档集合/ 同名元素
 * 各取了哪一档",而集合相等只说明**候选档位相同**,不说明**同一个渲染元素取了同一档**。真实形态是:
 * 小程序在**组件根**声明圆角、RN 在各屏**外层 wrapper** 声明、RN 组件自身不带圆角 —— 于是屏幕上
 * 分别是 8 / 16 / 无,而门里 `[4,6,8]` 对 `[4,6,8]` ⇒ **圆角跨端维读 0**。把"文件级集合相等"当成
 * "两端同值"是**推断错误**,不是精度不够。
 *
 * 修法不是把集合判据改得更细(那只是同一型错误的另一半),而是让**层**进入判据:
 * 同名元素必须在**渲染路径上的同一个槽位**比 —— 这里取"组件体顶层 `return` 直接吐出的那个元素"。
 *
 * 三态必须分开,**不得折成一个数**(与 RE 维同一条纪律):
 *  - `anchored:false` —— `export default` 锚不到 ⇒ 槽位这一维**没看**,不当"一致"记;
 *  - `indirect:true` / `tiers:null` —— 根由子组件代渲染 / 间接 `return` / HOC 包裹 ⇒ 读不出,
 *    报"未判定",**不得记成"两端根上都无档"**(那正是本次投诉的原始读数);
 *  - `tiers` —— 锚到且直出时,根元素上的圆角 px 集合。
 */

/**
 * 字符串安全的遮罩:**引号与模板串里的括号花括号一律替换成空格**,长度不变。
 *
 * 为什么必须遮:深度走查(`{`/`}` 计数)一旦被字符串里的括号带偏,后面整个组件体的边界就找错,
 * 于是判据**跟着字符串内容漂** —— `className="don't { break"` 这种写法在真仓里不罕见,
 * 而漂一次的读数是"看起来自洽"的假分叉(与 §4"CSS 声明形态整面隐身"同族:错得安静)。
 * 模板串**连 `${…}` 内的代码一起遮**:那一段是插值表达式,不是本判据要读的静态类名串,
 * 放它进来只会让深度计数多一处可能失衡的来源。
 *
 * ⚠️ 与 `stripComments` 的分工:那个剥注释但**保留字符串内容**(方向相反会各错一次,见其头注);
 * 这个遮字符串但**同样保留换行**。两处各需要一种,不得互相替换。
 */
function maskStringsForDepth(src) {
  const s = String(src ?? '')
  let out = ''
  let i = 0
  while (i < s.length) {
    const c = s[i]
    if (c === '"' || c === "'" || c === '`') {
      const quote = c
      out += c
      i++
      while (i < s.length) {
        if (s[i] === '\\') {
          out += '  '
          i += 2
          continue
        }
        if (s[i] === quote) {
          out += quote
          i++
          break
        }
        // 换行必须留着:后面按行取材料时行号会对不上
        out += s[i] === '\n' ? '\n' : ' '
        i++
      }
      continue
    }
    out += c
    i++
  }
  return out
}

/**
 * 从 `export default` 起,取组件体顶层 `return` 直接吐出的那个元素上的圆角档(px 数组)。
 *
 * @param {string} src 组件源文本
 * @param {Record<string, number>|null} table `radiusLookup` 的档位表
 * @returns {{anchored:boolean, indirect:boolean, tiers:number[]|null}}
 */
export function rootSlotRadiiOf(src, table) {
  const code = maskStringsForDepth(stripComments(String(src ?? '')))
  const defAt = code.search(/\bexport\s+default\b/)
  if (defAt < 0) return { anchored: false, indirect: false, tiers: null }
  /**
   * `export default` 后面是什么,决定这一维**有没有得看**:
   *  - 具名/匿名函数、类、箭头函数 ⇒ 组件体在本文内,根槽位可判;
   *  - 任何**不是**上述形态的东西(`withMemo(Foo)` / `connect(…)(Foo)` / 一个裸标识符)
   *    ⇒ 组件体在别处,本文里没有"顶层 return 直接吐出的那个元素"可读。
   * 这两种都必须**如实报**,不得当成"这个组件根上没有圆角"。
   */
  const after = code.slice(defAt).replace(/^\s*export\s+default\s+/, '')
  const isFnBody =
    /^(?:async\s+)?(?:function\b|class\b|\(\s*[^)]*\)\s*=>|[A-Za-z_$][\w$]*\s*=>)/.test(after)
  const bodyOpen = isFnBody ? code.indexOf('{', defAt) : -1
  if (bodyOpen < 0) return { anchored: true, indirect: true, tiers: null }
  // 组件体顶层 return:只在**函数体第一层**找,嵌套函数/回调里的 return 不是根槽位。
  const body = code.slice(bodyOpen)
  let depth = 0
  let retAt = -1
  for (let i = 0; i < body.length; i++) {
    const c = body[i]
    if (c === '{') depth++
    else if (c === '}') {
      depth--
      if (depth === 0) break
    } else if (
      depth === 1 &&
      c === 'r' &&
      body.startsWith('return', i) &&
      !/[\w$]/.test(body[i - 1] ?? '')
    )
      if (!/[\w$]/.test(body[i + 6] ?? '')) {
        retAt = i
        break
      }
  }
  if (retAt < 0) return { anchored: true, indirect: true, tiers: null }
  /**
   * `return` 的表达式:只认**直接吐一个元素**的形态 —— 可选的一层圆括号,紧跟 `<`。
   * 其余(`return null` / `return cond ? <A/> : <B/>` / `return renderList()` / `return <Foo />` 里
   * `Foo` 是**别的组件**)都是"根槽位读不出":根由子组件代渲染或间接产出。
   *
   * ⚠️ `return <Foo />` 这一格是本维最要紧的分辨点:小程序侧把圆角声明在**组件根**、RN 侧声明在
   * **外层 wrapper**,若把"根是自组件"读成"根上无档",本维就会把那次投诉原样再判一次绿。
   */
  /**
   * 表达式起点(相对 `code` 的绝对下标)。`body` 是 `code.slice(bodyOpen)`,所以
   * `body` 里的下标要加回 `bodyOpen` 才回到 `code` 坐标 —— 这一处换算只做一次,
   * 下面取材与定位共用同一个 `exprAt`(两处各算一遍必漂,而漂开的表现是"取材取到隔壁一行的档")。
   *
   * ⚠️ `maskStringsForDepth` **长度不变**,所以 `code` 的下标可以直接用来切原文 —— 这是
   * "深度定位在遮罩上做、取材在原文上做"能成立的前提;哪天遮罩改成变长输出,这一格立刻失效。
   */
  const retEnd = bodyOpen + retAt + 6
  let exprAt = retEnd
  while (exprAt < code.length && /\s/.test(code[exprAt])) exprAt++
  /** 可选的一层圆括号:`return (\n <View …> )` 与 `return <View …>` 两种写法都算"直接吐出根元素"。 */
  if (code[exprAt] === '(') {
    exprAt++
    while (exprAt < code.length && /\s/.test(code[exprAt])) exprAt++
  }
  if (code[exprAt] !== '<') return { anchored: true, indirect: true, tiers: null }
  /**
   * 根元素的**开标签**到 `>` / `/>` 为止 —— 子树上的档**不属于根槽位**(那正是 RD 的读数面;
   * 把子树也算进来,本维就会退化成 RD 加一个"根"字样,恰好复现它要修的那个推断错误)。
   */
  const tagEnd = findJsxOpenTagEnd(code, exprAt)
  if (tagEnd < 0) return { anchored: true, indirect: true, tiers: null }
  const tagName = /^<\s*([A-Za-z_$][\w$.]*)/.exec(code.slice(exprAt, tagEnd))?.[1] ?? ''
  if (!tagName) return { anchored: true, indirect: true, tiers: null }
  /**
   * 根元素是**本地定义的组件**(`function Foo(){…}` 且顶层 return 吐 `<Foo />`,或 `const Foo=…`)
   * ⇒ 真正渲染出来的那个盒在它的定义里,本文的根槽位对它零判据。
   * 宿主元素(`View` / `div` / `Text` / `Image` …)不在本地声明表里 ⇒ 就是根槽位本身。
   */
  if (isLocallyDeclaredComponent(code, tagName))
    return { anchored: true, indirect: true, tiers: null }
  if (!table) return { anchored: true, indirect: false, tiers: null }
  /**
   * 取材走**未遮字符串的原文**:圆角档就写在 `className="rounded-lg"` 的**引号内**,
   * 用遮罩后的文本读会把它抹成空格(判据失明)。深度定位在遮罩上做、取材在原文上做,
   * 两步的分工是这一格能同时满足"字符串安全"与"读得到真档"的原因。
   */
  const tagText = String(src ?? '').slice(exprAt, tagEnd + 1)
  const pxs = radiusPxInLine(tagText, table)
  return {
    anchored: true,
    indirect: false,
    tiers: [...new Set(pxs.filter((p) => Number.isFinite(p) && p > 0))].sort((a, b) => a - b),
  }
}

/**
 * 从 `from` 起的 JSX **开标签**末尾下标(`>` 或 `/>`),读不到返回 -1。
 * 花括号属性(`style={{ … }}`)内部的花括号必须配平,否则属性里的 `>` 会把标签提前截断。
 */
function findJsxOpenTagEnd(code, from) {
  let depth = 0
  for (let i = from; i < code.length; i++) {
    const c = code[i]
    if (c === '{') depth++
    else if (c === '}') depth--
    else if (c === '>' && depth <= 0) return i
  }
  return -1
}

/**
 * 这个标签名是不是**本文件里定义/声明**的组件(而不是宿主元素)。
 *
 * 只认三种声明形态(`function Foo` / `class Foo` / `const Foo =`),因为只有这三种能在**同一文件**
 * 里构成"根由子组件代渲染"。从别处 import 进来的组件名同样算 —— 它也不是本文的根槽位。
 */
function isLocallyDeclaredComponent(code, tagName) {
  const decl = new RegExp(
    `(?:^|[\\s;{(])(?:export\\s+default\\s+|export\\s+)?(?:async\\s+)?(?:function\\s+${tagName}\\b|class\\s+${tagName}\\b|(?:const|let|var)\\s+${tagName}\\s*=)|import\\s[^;]*\\b${tagName}\\b[^;]*from`,
    'm',
  )
  return decl.test(code)
}

/**
 * RS 逐对比对:两端**根槽位**上的圆角档是否逐字相同。
 *
 * 三态与 `rootSlotRadiiOf` 一一对应,**在配对层就要分开** ——
 * "没看"(锚不到)与"读不出"(间接 return)若在这里被折成 `tiers:[]`,退化的正是本维要修的那个推断:
 * `[] 对 []` 会被读成"两端根上都无档,一致",而真相是"这一维没看"。
 *
 * @returns {{findings:{name:string,miniapp:number[],rn:number[]}[], undetermined:{name:string,why:string}[]}}
 */
export function rootSlotAudit(pairs, text, table, styles = {}) {
  const findings = []
  const undetermined = []
  for (const p of pairs?.pairs ?? []) {
    const a = withLocalStyles(text, styles, p.miniapp)
    const b = withLocalStyles(text, styles, p.rn)
    if (a === undefined || b === undefined) continue
    const ra = rootSlotRadiiOf(a, table)
    const rb = rootSlotRadiiOf(b, table)
    if (!ra.anchored || !rb.anchored) {
      undetermined.push({
        name: p.name,
        why: `export default 锚不到(${!ra.anchored ? 'miniapp' : 'rn'}侧)⇒ 根槽位这一维没看,不当"一致"记`,
      })
      continue
    }
    if (ra.tiers === null || rb.tiers === null) {
      undetermined.push({
        name: p.name,
        why: '根槽位读不出(间接 return / HOC 包裹 / 根由子组件代渲染)⇒ 未判定,不得记成"两端根上都无档"',
      })
      continue
    }
    // 两侧都空 = 这一族根本没在根上声明过圆角 ⇒ 本维零判据,不报(报它等于把"没声明"叫成"分叉")。
    if (!ra.tiers.length && !rb.tiers.length) continue
    if (String(ra.tiers) === String(rb.tiers)) continue
    findings.push({ name: p.name, miniapp: ra.tiers, rn: rb.tiers })
  }
  return { findings, undetermined }
}

/**
 * 差值棘轮:本轮判红 = 出现在 `findings` 而**HEAD 面没有这一族**。
 *
 * 与 IC / SL 两维同一条纪律(§12e):存量当场判红就是一台恒红门,唯一结局是逼人跳门;
 * 而"新增"必须是相对 HEAD 判的 —— 相对台账判会把"这一族早就红着"永远记成新增。
 * 本维 `undetermined` **只报数不判红**:它是射程边界不是违规(与 `radiusUnpaired` 同处置)。
 */
export function rootSlotDelta(findings, headFindings) {
  const prior = new Set((headFindings ?? []).map((f) => f.name))
  return (findings ?? []).filter((f) => !prior.has(f.name))
}

/**
 * RE 维 —— **同一命名元素**在两端取了不同圆角档。
 *
 * 为什么要有第三条维而不是把 RD 修一修:RD 比的是"两端各自文件里出现过的圆角值**集合**之差",
 * 于是 `NavBar` 报「仅小程序 4」、`VideoPlayer` 报「仅 RN 8」—— 这两个"一侧空集"只说明那一侧
 * 的文件里没有圆角声明,**根本不证明同一个元素两端长得不一样**。按那种读数去给单端补数字,
 * 产出的不是收敛而是视觉回归(票⑫在几何维演示过同型事故:10 档"差异"被证明从来不存在)。
 * RE 因此**只在两侧同名时才判**;不同名不猜、不并档(kebab 的 `.mcd-upload-btn` 与 camel 的
 * `uploadBtn` 不并 —— 一旦开始并档,配对就从证据变成猜测)。
 *
 * 三态分开,不得折成一个数:
 *  - `mismatched` —— 两侧同名而档不同 ⇒ 真分叉,进锚点、可判红;
 *  - `onlyMiniapp` / `onlyRn` —— 只有一侧给这个元素起了名字 ⇒ **不是分叉**,是配对射程边界,
 *    只逐条报名("报数不报名"在本仓记过多次:只给计数,拿到数字的人无法判断该不该扩判据)。
 */
/**
 * 元素名的**归一身份**(只在 RE 维用):
 *  - 只切 **BEM 结构分隔符 `__`** —— `category-bar__item` 的元素名就是 `item`,这是命名法本身
 *    规定的,不是相似度猜测(票面当年拒绝并档的理由是"一旦并档,配对就从证据变成猜测";
 *    缩写前缀 `mcd-upload-btn` 与 camel `uploadBtn` 至今**不并**,那种才是猜测)。
 *  - 大小写与 `-`/`_` 折叠:同一份语义在两端常写成 `free-badge` / `freeBadge`,
 *    去分隔符后同为 `freebadge`,这一步也是机械的,不引入判断。
 *  - 修饰符 `--mod` 不参与身份(它是同一元素的变体档,若因此配不上对,读数会假报"单侧元素")。
 */
export function canonicalElementName(name) {
  const afterBlock = String(name).split('__').pop()
  const withoutModifier = afterBlock.split('--')[0]
  return withoutModifier.toLowerCase().replace(/[-_]/g, '')
}

/**
 * 两侧元素名 → 归一身份的映射。**一对多就放弃配对**:
 * 同一侧若有两个不同原始名折叠到同一身份(例:`card` 与 `card__` 与 `Card_` 同时存在),
 * 并档会把两个不同元素并成一个"同值"的假绿灯 —— 那比漏配更贵(§"配对键本身也是判据")。
 * @returns {{map:Map<string,string>, ambiguous:string[]}} map:身份 → 唯一原始名;ambiguous:被剔除的身份
 */
function identityIndex(entries) {
  const byId = new Map()
  const ambiguous = new Set()
  for (const raw of Object.keys(entries || {})) {
    const id = canonicalElementName(raw)
    if (!id) continue
    const prev = byId.get(id)
    if (prev !== undefined && prev !== raw) {
      ambiguous.add(id)
      byId.delete(id)
      continue
    }
    if (!byId.has(id)) byId.set(id, raw)
  }
  return { map: byId, ambiguous: [...ambiguous].sort() }
}

export function elementRadiusDiff(a, b) {
  const norm = (x) => [...new Set(x || [])].sort((p, q) => p - q)
  const A = a || {}
  const B = b || {}
  const ia = identityIndex(A)
  const ib = identityIndex(B)
  const mismatched = []
  const onlyMiniapp = []
  const onlyRn = []
  /** 折叠后撞在一起的名字:不判、不并,只点名(它意味着两端命名法在这一族不自洽)。 */
  const ambiguous = [...new Set([...ia.ambiguous, ...ib.ambiguous])].sort()
  const ids = [...new Set([...ia.map.keys(), ...ib.map.keys()])].sort()
  for (const id of ids) {
    const ra = ia.map.get(id)
    const rb = ib.map.get(id)
    if (ra !== undefined && rb !== undefined) {
      if (String(norm(A[ra])) !== String(norm(B[rb])))
        mismatched.push({
          name: ra === rb ? ra : `${ra}|${rb}`,
          miniapp: norm(A[ra]),
          rn: norm(B[rb]),
        })
    } else if (ra !== undefined) onlyMiniapp.push(ra)
    else onlyRn.push(rb)
  }
  return { mismatched, onlyMiniapp, onlyRn, ambiguous }
}

/** RE 锚点计数 = 该组件里"同名而不同档"的元素数(一个元素算一处,不按档值双计)。 */
export function elementRadiusCount(f) {
  return f.elementRadius?.mismatched?.length ?? 0
}

/** 豁免必须是带理由的声明,不是消红通道;到期由守门 108 单独问责。 */
export function waiverProblem(w) {
  if (!w) return null
  if (typeof w.reason !== 'string' || w.reason.trim().length < 6)
    return '豁免无理由或理由不足以复核'
  return null
}

/** 相对说明符 → 仓库相对路径(只处理 `./` 与 `../`,不碰别名 —— 样式文件不该走别名)。 */
export function resolveRel(fromFile, spec) {
  const segs = fromFile.split('/').slice(0, -1)
  for (const part of spec.split('/')) {
    if (part === '.' || part === '') continue
    if (part === '..') segs.pop()
    else segs.push(part)
  }
  return segs.join('/')
}

/**
 * 组件"声明会用到哪些类名"—— 只从**字符串字面量**里取(引号与模板串),因为小程序的盒档
 * 是通过类名落地的(`className="textarea-int"` / `cn('item', active && 'item--on')`)。
 * 刻意剥掉 Tailwind 形态的类名:那些由 `readGeometry` 的刻度档判据直接读,不需要样式表。
 */
export function usedClassNames(src) {
  // 前缀表**必须要求后接连字符或结尾**:少了这道边界,`textarea-int` 会被 `text` 前缀误杀,
  // 而它正是本门最需要看见的那一类自定义类名(实测 InputArea 的 `.textarea-int{height:80rpx}`)。
  const TW =
    /^(?:group|flex|grid|block|inline|hidden|absolute|relative|static|fixed|sticky|overflow|shrink|grow|wrap|nowrap|truncate|italic|font|leading|tracking|whitespace|align|justify|items|content|self|order|basis|col|row|w|h|p|px|py|pt|pb|pl|pr|m|mx|my|mt|mb|ml|mr|gap|space|top|right|bottom|left|inset|z|opacity|shadow|rounded|border|bg|from|via|to|ring|outline|cursor|select|pointer|transition|duration|delay|animate|scale|rotate|translate|skew|origin|transform|filter|backdrop|touch|text)(?:-|$)/
  // 只认 className 语境里的字面量,且**按花括号配平取属性值**(不是定长窗口):
  // 定长窗口会越过本属性边界、把隔壁属性的枚举值(`completed` / `read` / `check`)当成类名收进来。
  // 配平扫描同时保住跨行三元(`className={cn('a', x && 'textarea-int')}`);
  // 而早先"整属性到 }\n"的正则因 400 字上限 + 换行要求**全部落空**(实测这条披露一次都没触发,
  // 而"没触发"在报告里读起来和"没有盲区"一模一样)。
  const code2 = stripComments(src)
  const out = new Set()
  for (const at of code2.matchAll(/className\s*=\s*/g)) {
    const i = at.index + at[0].length
    const quote = code2[i]
    let end = code2.length
    if (quote === '"' || quote === "'" || quote === '`') {
      const close = code2.indexOf(quote, i + 1)
      end = close < 0 ? code2.length : close + 1
    } else if (quote === '{') {
      let depth = 0
      for (let j = i; j < code2.length; j++) {
        if (code2[j] === '{') depth++
        else if (code2[j] === '}') {
          depth--
          if (depth === 0) {
            end = j + 1
            break
          }
        }
      }
    }
    const attr = code2.slice(i, end)
    for (const q of attr.matchAll(/['"`]([^'"`\n]{2,200})['"`]/g)) {
      for (const t of q[1].split(/[\s,]+/)) {
        if (!/^[a-z][a-z0-9]*(?:-[a-z0-9]+)*$/.test(t)) continue
        if (t.length <= 3 || TW.test(t)) continue
        out.add(t)
      }
    }
  }
  return out
}

/**
 * "用了某个类名,但在本组件自己的样式表里找不到它的定义" —— 这些类的盒档落在**全局样式表**
 * (`app.css` / 某页的 `*.css`),本门**读不到**。
 *
 * 为什么是"点名"而不是"接着去读全局表":实测把 69 份表按类名锚定收进读数时,
 * 类名提取会捞进 `react` / `image` / `active` 这类**非类名字符串**,而它们在全端确实有同名规则
 * ⇒ 把别处的档算到这个组件头上。**归因过宽比漏读更贵** —— 它产出的是一条条自洽的假"同值"
 * (与本次"阴影半径被当盒档"同一型,那枚是靠既有锚点才拦住的)。
 * 所以这里只把"用了全局类名"这件事如实报出来;要真去接全局表,前置是先解决**归属**问题。
 *
 * 第三参 `_globalDefined` **传了但函数体从不消费** —— 这不是漏传,也不是待办:调用点(`collect`)
 * 确实把真集合递了进来,而"消费它"这一步就是上面记录的**归因过宽**。参数留着是为了让
 * "这一格已经想清楚了、且想清楚的结果是不接"在签名上可见(删掉它,下一个人会以为是忘了写);
 * 下划线前缀声明"故意不读",好让 eslint 的 `no-unused-vars` 不再为一个**已经做出的决定**报错。
 */
export function unresolvedClassNames(src, ownCssText, _globalDefined = null) {
  const used = usedClassNames(src)
  if (!used.size) return []
  const defined = new Set()
  for (const m of String(ownCssText ?? '').matchAll(/\.([a-z][a-z0-9]*(?:-[a-z0-9]+)*)\s*\{/gi))
    defined.add(m[1])
  return [...used].filter((c) => !defined.has(c)).sort()
}

/**
 * **组件正文 + 它自己 import 的本地样式表** —— RD / RE 两维的取材表达式,**只此一份**。
 *
 * 为什么必须抽出来:票⑫ 实测过"几何漏跟本地样式表"造出的**假分叉**("RN 11 档 / 小程序 0 档",
 * 而端上一行代码未改),修法是把样式表并进来;但并进来的那一行若在 `audit` 与别处各写一遍,
 * 两处必然漂移 —— 漂开的表现不是报错,而是**两维读到的不是同一份材料**(RD 读到并入后的、
 * RE 读到没并的),账面看起来仍自洽。本门后来又添了根槽位维(RS),取材面若再各拼一遍就是第三份。
 */
function withLocalStyles(text, styles, f) {
  return text[f] + (styles[f] ?? '')
}

export function audit(pairs, text, baseline = {}, tiers = {}, radiusTable = null, styles = {}) {
  const findings = []
  /**
   * 配对射程逐组件登记:`radiusEntriesOf` 在一侧读得出元素名、另一侧读不出时,那一族**本维零判据**。
   * 它不是差异,所以不进 findings、不进锚点;但它必须能被点名 —— 没有这份名单,"RE 报 0"
   * 与"RE 什么都没看见"在账面上就长得一模一样。
   */
  const radiusUnpaired = []
  for (const p of pairs.pairs) {
    const a = text[p.miniapp]
    const b = text[p.rn]
    if (a === undefined || b === undefined) continue
    /**
     * 几何与圆角读的是**组件自己 + 它 import 的本地样式表**;IC / SL 仍只读组件源文本。
     * 不并样式表的后果实测过:小程序端把盒档写在同名 `.css` 里(6 个组件如此),
     * 配对源只有 `.tsx` ⇒ 读成"RN 有 11 档、小程序 0 档"的**测量假象**,
     * 与 §4 记过的"CSS 声明形态整面隐身"是同一条洞。分开喂是因为 IC 判的是图标载体,
     * 把样式表里的 `url(...)` 混进来会改动那条维的既有口径(要扩也得单独一笔)。
     */
    const aAll = withLocalStyles(text, styles, p.miniapp)
    const bAll = withLocalStyles(text, styles, p.rn)
    const ga = readGeometry(aAll, 'miniapp', tiers)
    const gb = readGeometry(bAll, 'rn', tiers)
    const named = namedConflicts(ga.named, gb.named)
    const geometry = diffValues(ga.values, gb.values)
    /**
     * RD 维:同名元素在两端**取了不同的圆角档**。表取不到时 collect() 已经把整门判死,
     * 这里只会拿到非空表;仍留一层空表短路,是为了让 `audit` 作为纯函数可在构造面上单测
     * (只喂几何夹具的既有用例不该被新维连带打红)。
     *
     * 取 `aAll` / `bAll` 而不是 `a` / `b`:票⑫ 实测几何漏跟本地样式表会造出**假分叉**
     * ("RN 11 档 / 小程序 0 档",而端上一行代码未改)。RD 原先只读组件源文本,中同一型盲区
     * —— 实测 `CategoryBar` 有 2 处圆角写在同名 `.css` 里而本维一处都读不到。同一条样式表来源
     * 必须**共用**(两处各算一遍必漂移),所以这里不再另派生一份文本。
     */
    const radius = radiusTable
      ? diffValues(
          new Set(radiusSetOf(aAll, radiusTable, { side: 'miniapp' })),
          new Set(radiusSetOf(bAll, radiusTable, { side: 'rn' })),
        )
      : { onlyMiniapp: [], onlyRn: [] }
    const radiusSeen = radiusTable
      ? {
          miniapp: radiusSetOf(aAll, radiusTable, { side: 'miniapp' }),
          rn: radiusSetOf(bAll, radiusTable, { side: 'rn' }),
        }
      : null
    /**
     * RE 维:按**元素名**配对的圆角。与 RD 并列而非替换 —— RD 保留(它是"这一族的圆角值域"
     * 的粗读数,锚点已按该口径钉着),RE 负责唯一能称为"同一元素两端不同形"的那一判。
     * 共用同一份 `aAll` / `bAll`:样式表来源必须只有一处(票⑫ 的教训就是两端各自的取径
     * 不同形,读数就不在同一口径上)。
     */
    const erA = radiusTable ? radiusEntriesOf(aAll, radiusTable) : { entries: {}, unnamed: 0 }
    const erB = radiusTable ? radiusEntriesOf(bAll, radiusTable) : { entries: {}, unnamed: 0 }
    const elementRadius = radiusTable
      ? elementRadiusDiff(erA.entries, erB.entries)
      : { mismatched: [], onlyMiniapp: [], onlyRn: [] }
    if (radiusTable && (elementRadius.onlyMiniapp.length || elementRadius.onlyRn.length))
      radiusUnpaired.push({
        name: p.name,
        onlyMiniapp: elementRadius.onlyMiniapp,
        onlyRn: elementRadius.onlyRn,
        // 一侧一个名字都读不出 = 那一腿根本没给元素起名(全走 utility 串或内联 style),
        // 与"两侧各有名字但对不上"是两种处置,所以 unnamed 计数也要一并交回。
        unnamed: { miniapp: erA.unnamed, rn: erB.unnamed },
      })
    if (
      !named.length &&
      !geometry.onlyMiniapp.length &&
      !geometry.onlyRn.length &&
      !radius.onlyMiniapp.length &&
      !radius.onlyRn.length &&
      !elementRadius.mismatched.length
    )
      continue
    const w = (baseline.waivers ?? {})[p.name]
    findings.push({
      name: p.name,
      named,
      geometry,
      radius,
      radiusSeen,
      elementRadius,
      lang: { miniapp: styleLanguage(a), rn: styleLanguage(b) },
      icons: { miniapp: iconCarriers(a), rn: iconCarriers(b) },
      invalidWaiver: waiverProblem(w) ?? undefined,
      waived: !!w && !waiverProblem(w),
    })
  }
  return {
    findings,
    radiusUnpaired,
    ...verdictOf(findings, baseline),
    pairCount: pairs.pairs.length,
  }
}

/**
 * 棘轮:锚点 = 台账钉住的读数(立项按 HEAD 生成)。只拦"把差异加大";台账没有这个名字 ⇒ 锚点 0,
 * 新增配对直接问责(它没有存量可躲)。变好只提示"可下调",**不自动改账**。
 */
/**
 * **web 腿读数**(纯函数,构造面可证)。形状刻意与主腿的 finding 同构(`named` / `geometry` /
 * `radius` / `elementRadius` 四件齐),这样 `diffCount` / `radiusCount` / `elementRadiusCount`
 * 与 `verdictOf` 的判序**不必为 web 腿重写第二份**。
 *
 * 三条边界必须如实:
 *  - `geometry` / `named` 恒空 ⇒ web 腿**不判几何**(量纲不同,见 WEB_DIRS 头注)。空不等于"已确认相同",
 *    所以报告与 `--json` 都要打印"web 腿只量圆角档"。
 *  - 两侧都读不出任何档 ⇒ 记**未判定**而不是"同档"(没量到与量到零是两件事)。
 *  - 档位表解析不出来(`radiusTable` 为空)⇒ 整腿未判定,不得当成"web 腿零分叉"。
 */
export function webRadiusAudit(webPairs, text, radiusTable, styles = {}) {
  const findings = []
  const undetermined = []
  for (const p of webPairs ?? []) {
    const a = text[p.miniapp]
    const b = text[p.rn]
    if (a === undefined || b === undefined) {
      undetermined.push({ name: p.name, why: '正文取不到 ⇒ 这一对没判' })
      continue
    }
    if (!radiusTable) {
      undetermined.push({ name: p.name, why: '圆角档位表解析不出 ⇒ web 腿失明,不得记为同档' })
      continue
    }
    const aAll = withLocalStyles(text, styles, p.miniapp)
    const bAll = withLocalStyles(text, styles, p.rn)
    const mini = new Set(radiusSetOf(aAll, radiusTable, { side: 'miniapp' }))
    const web = new Set(radiusSetOf(bAll, radiusTable))
    if (!mini.size && !web.size) {
      undetermined.push({ name: p.name, why: '两侧都读不出圆角档 ⇒ 零判据(不是"两端同值")' })
      continue
    }
    findings.push({
      name: p.name,
      web: p.rn,
      miniapp: p.miniapp,
      named: [],
      geometry: { onlyMiniapp: [], onlyRn: [] },
      radius: {
        onlyMiniapp: [...mini].filter((v) => !web.has(v)),
        onlyRn: [...web].filter((v) => !mini.has(v)),
      },
      elementRadius: { mismatched: [], onlyMiniapp: [], onlyRn: [] },
      webSeen: { miniapp: [...mini], web: [...web] },
    })
  }
  return { findings, undetermined }
}

export function verdictOf(
  findings,
  baseline,
  keys = {
    counts: 'counts',
    radius: 'radiusCounts',
    element: 'elementRadiusCounts',
    waivers: 'waivers',
  },
) {
  // 台账子账按 `keys` 选,而不是给 web 腿再写一份比较逻辑:锚点只拦上升、下降要报名、
  // 台账腐烂要当场红 —— 这三条判序两腿必须逐字同形。两处各写一遍必然漂开,而漂开的表现
  // 是"主腿收紧了、web 腿还在放过"(或反过来把不该红的 web 腿按主腿额度判红)。
  const counts = baseline[keys.counts] ?? {}
  const radiusCounts = baseline[keys.radius] ?? {}
  const elementRadiusCounts = baseline[keys.element] ?? {}
  const waivers = baseline[keys.waivers] ?? {}
  const red = []
  const shrunk = []
  const waived = []
  for (const f of findings) {
    const n = diffCount(f)
    const rn = radiusCount(f)
    const en = elementRadiusCount(f)
    // 豁免判定只在这一处生效(规则本身在 waiverProblem,audit 里的字段只是同一规则的展示视图)。
    // 若两处各判一次,台账改一条就会一边认豁免、一边仍判红 —— 两处算同一件事必漂移,本仓记过多次。
    const w = waivers[f.name]
    if (w && !waiverProblem(w)) {
      waived.push({ name: f.name, diffCount: n, radiusCount: rn, elementRadiusCount: en })
      continue
    }
    const anchor = counts[f.name] ?? 0
    const rAnchor = radiusCounts[f.name] ?? 0
    const eAnchor = elementRadiusCounts[f.name] ?? 0
    const over = []
    if (n > anchor) over.push(`几何/具名 ${n} > 锚点 ${anchor}`)
    if (rn > rAnchor) over.push(`圆角 ${rn} > 锚点 ${rAnchor}`)
    // RE 单独一维一锚点:它与 RD 的差别不是松紧,而是**判的是不是同一件事** ——
    // 合进 radiusCounts 会让"文件级值域变窄"替"同名元素新增分叉"顶掉名额(净零逃逸)。
    if (en > eAnchor) over.push(`同名元素圆角 ${en} > 锚点 ${eAnchor}`)
    if (over.length)
      red.push({
        name: f.name,
        diffCount: n,
        anchor,
        radiusCount: rn,
        radiusAnchor: rAnchor,
        elementRadiusCount: en,
        elementRadiusAnchor: eAnchor,
        over,
        named: f.named,
        geometry: f.geometry,
        radius: f.radius,
        elementRadius: f.elementRadius,
      })
    else if (n < anchor || rn < rAnchor || en < eAnchor)
      shrunk.push({
        name: f.name,
        diffCount: n,
        anchor,
        radiusCount: rn,
        radiusAnchor: rAnchor,
        elementRadiusCount: en,
        elementRadiusAnchor: eAnchor,
      })
  }
  /**
   * **台账腐烂判据**:台账里有某个组件名,而本轮实测**根本没产出这一族的差异记录** ⇒ 这个键
   * 是一个永远不可能被问责的存量额度。它的危害不是"多几行 JSON":下一次这一族重新被配对
   * (可达性回落、拆对声明被撤、组件复活)时,它自带一份免费额度,于是新分叉被静默吞掉。
   * `emitBaseline` 只按 findings 建键 ⇒ 谁哪次重生成台账都会顺手把它删掉,但**没人会知道曾经有过**;
   * 本判据把"删掉了"变成"当场红"。豁免过的族仍算有记录(它被 waived 记账,不是没扫到)。
   */
  const seen = new Set([
    ...findings.map((f) => f.name),
    ...findings
      .filter((f) => waivers[f.name] && !waiverProblem(waivers[f.name]))
      .map((f) => f.name),
  ])
  const rot = [
    ...new Set([
      ...Object.keys(counts).filter((k) => !seen.has(k)),
      ...Object.keys(radiusCounts).filter((k) => !seen.has(k)),
      ...Object.keys(elementRadiusCounts).filter((k) => !seen.has(k)),
    ]),
  ].sort()
  return { red, shrunk, waived, rot }
}

/**
 * 重出台账前的**单调性核对**:既有锚点只允许下降或持平,一律不得上升、不得整键消失。
 *
 * 为什么这条必须由工具判而不是写进散文让人记得看:`--emit-baseline` 的输出就是直接盖掉台账
 * 的那份文件。一旦某一轮在"判据覆盖面刚被扩过"的时刻重生成(票⑫就撞上过:提取式一放宽,
 * 端上一行未改而读数凭空多 10 档),旧台账里那些**本来就比实态低**的锚点会被"合法地"抬上去 ——
 * 从此那笔债没人再问责,而账面读起来像"已按实测重锚"。上升与消失都指向同一件事:
 * 这轮产出的不是更紧的锚点,是一次无人察觉的放松。
 *
 * **带有效豁免的族不参与本核对(与 `verdictOf` 同一条豁免短路)**:
 * `verdictOf` 对豁免过的族 `continue` ⇒ 它的三维锚点在提交链上从不被比较,是一笔**惰性记账**。
 * 对惰性记账判"上升=放松存量"是一台空转的尺子:它拦不住任何真实债务(债务只在未豁免族上生效),
 * 却会把一次合法的重锚整体拒之门外 —— 连带让同族**下降**的几何锚(实测 DrawerComponent 19→17)
 * 也写不进去,T8 因此长期红。所以这里的豁免短路**缩小的是假阳,不是保护**:
 * 未豁免族的上升/消失**照旧逐条拒绝**(由自检㊗钉死),豁免坏(空理由)时短路不生效(㊜)。
 * 关键:是否豁免取的是**待覆盖台账(prior)自己**登记的豁免,与 `verdictOf` 用的是同一份判定
 * (`waiverProblem`),绝不另写一套豁免规则 —— 两处算同一件事必漂移,本仓记过最多次。
 *
 * @returns {string[]} 空数组 = 可以落盘;否则每条是一个必须人工解释的破口。
 */
export function anchorRegression(prior, next) {
  const out = []
  const waivedSet = (map) =>
    new Set(Object.keys(map ?? {}).filter((n) => map[n] && !waiverProblem(map[n])))
  // 只豁免"prior 里带了有效理由"的族 —— 与 verdictOf 的 `w && !waiverProblem(w)` 逐字同形。
  // **两腿各用自己的豁免表**:拿主腿的名单去免 web 键的消失,等于"给这条腿写了理由就能让
  // 那条腿的锚点凭空蒸发" —— 而锚点消失正是本函数要拦的那件事(下一次分叉自带免费额度)。
  const waivedMain = waivedSet(prior?.waivers)
  const waivedWeb = waivedSet(prior?.[WEB_LEDGER.waivers])
  // web 腿的子账**必须一起核**:漏掉就是"主腿只允许下降、web 腿随便涨",而涨的那一份
  // 没人会去查(台账里明明写着"锚点只拦新增"—— 那是一句只对一半的账)。
  for (const key of [
    'counts',
    'radiusCounts',
    'elementRadiusCounts',
    WEB_LEDGER.counts,
    WEB_LEDGER.radius,
    WEB_LEDGER.element,
  ]) {
    const waivedNames = key.startsWith('web') ? waivedWeb : waivedMain
    const before = prior?.[key] ?? {}
    const after = next?.[key] ?? {}
    for (const [name, v] of Object.entries(before)) {
      if (waivedNames.has(name)) continue
      if (!(name in after)) {
        out.push(`${key}.${name} 整键消失(锚点消失 = 该族下一次分叉自带免费额度)`)
        continue
      }
      if (after[name] > v) out.push(`${key}.${name} ${v}→${after[name]} 上升(收紧脚本只允许下降)`)
    }
  }
  return out
}

export function emitBaseline(findings, prior = {}, webFindings = []) {
  const counts = {}
  const radiusCounts = {}
  const elementRadiusCounts = {}
  for (const f of findings) {
    counts[f.name] = diffCount(f)
    /**
     * 圆角锚点**恒写入(含 0)**:缺键与 0 在 verdictOf 里同为锚点 0,但把 0 显式记下来
     * 才能让人看出"这一维扫过了、确实同档" —— 只记非零项会让新收口的组件读成"没配账"。
     */
    radiusCounts[f.name] = radiusCount(f)
    // RE 同一条理由恒写 0。而且它现在全仓都是 0(HEAD 实测两侧元素名无一相同),
    // 恒写键正好把"这一维扫过了、是配对面为空"与"这一维没跑"分开。
    elementRadiusCounts[f.name] = elementRadiusCount(f)
  }
  /**
   * `pairingRejects` 必须**原样带走**:它是判据输入(哪些同名族不是同一个元素),不是存量数字。
   * 旧写法整对象重写会把别人的拆对声明冲掉 —— 冲掉的后果不是"少一行 JSON",而是那一族
   * 立刻回到"被当配对算差异"的状态,台账凭空多出 N 处"差异"(守门 83 的 `--update-baseline`
   * 冲掉他人审计台账,是同一型事故)。
   */
  const out = { counts, radiusCounts, elementRadiusCounts }
  /**
   * web 腿子账:**恒写,且与主腿分键**。同一组件名在两腿各自有差异时,共用一个锚点会让
   * "修掉 web 那一侧"顶掉主腿名额(净零逃逸)。几何维这一腿不判 ⇒ `webCounts` 恒 0,
   * 但键必须留在台账里 —— 缺键与 0 在 verdictOf 里同为锚点 0,而"这一维扫过了、确实 0"
   * 与"这一维没跑"只有靠键在不在才分得开(与 radiusCounts / elementRadiusCounts 同一条理由)。
   */
  const webCounts = {}
  const webRadiusCounts = {}
  const webElementRadiusCounts = {}
  for (const f of webFindings) {
    webCounts[f.name] = diffCount(f)
    webRadiusCounts[f.name] = radiusCount(f)
    webElementRadiusCounts[f.name] = elementRadiusCount(f)
  }
  out[WEB_LEDGER.counts] = webCounts
  out[WEB_LEDGER.radius] = webRadiusCounts
  out[WEB_LEDGER.element] = webElementRadiusCounts
  /**
   * `waivers` 也必须**按族带过去**,不得整图清零:它是"这一族为什么允许不同形"的判断记录
   * (AGENTS O81:台账 `waivers` 恒空本身就是违规 —— 101 档一处理由都没写过就是上一轮的状态)。
   * 旧写法在这里写死 `waivers: {}`,一次重锚就把 13 条带现读命令的理由全冲掉,而账面只看得到
   * "counts 变小了"—— 与上面 pairingRejects 那段是同一型事故,只是这次是自家门自己犯。
   * 只保留**本轮仍有差异**的族;差异归零的族把理由撤下并**在 stderr 点名**(理由不再需要,
   * 但"哪一族的账清了"必须看得见,不得静默)。
   */
  const priorWaivers = prior && prior.waivers ? prior.waivers : {}
  const waivers = {}
  const retired = []
  for (const [name, w] of Object.entries(priorWaivers)) {
    if ((counts[name] ?? 0) > 0) waivers[name] = w
    else retired.push(name)
  }
  out.waivers = waivers
  /**
   * web 腿的豁免表同理必须**按族带过去**,而且它的"仍有差异"判据**不能沿用主腿那一把尺**:
   * web 腿这一腿几何维恒不判(`webCounts` 恒 0),按主腿的 `counts>0` 筛会让每条 web 豁免
   * 在第一次重锚时被静默撤下 —— 撤下的表现不是红,而是那一族回到"锚点还在、理由没了"的状态,
   * 下一个人无从知道它为什么允许不同形。所以本腿按**它自己真在量的那一维**(RD / RE)筛。
   */
  const priorWebWaivers = prior && prior[WEB_LEDGER.waivers] ? prior[WEB_LEDGER.waivers] : {}
  const webWaivers = {}
  const webRetired = []
  for (const [name, w] of Object.entries(priorWebWaivers)) {
    if (
      (webRadiusCounts[name] ?? 0) > 0 ||
      (webElementRadiusCounts[name] ?? 0) > 0 ||
      (webCounts[name] ?? 0) > 0
    )
      webWaivers[name] = w
    else webRetired.push(name)
  }
  out[WEB_LEDGER.waivers] = webWaivers
  if (webRetired.length)
    console.error(
      `  ⓘ web 腿本轮差异归零、理由随之撤下的族:${webRetired.join(', ')}(同样须回查是否只是覆盖面变窄)`,
    )
  if (retired.length)
    console.error(
      `  ⓘ 本轮差异归零、理由随之撤下的族:${retired.join(', ')}(若它们并非真被修好,而是判据覆盖面变窄,须回查)`,
    )
  // 台账里非判据、但必须留存的元数据(版本号一丢,读台账的人就不知道它是哪一版格式)
  if (prior && prior.ledgerVersion !== undefined) out.ledgerVersion = prior.ledgerVersion
  if (prior && prior.pairingRejects) out.pairingRejects = prior.pairingRejects
  // 别名表与拆对表同理:它是**配对判据的输入**,不是存量数字。重写台账把别人登记的别名冲掉,
  // 那一族立刻回到"射程外零判据"的状态 —— 而账面看什么都正常(这条族从没在 counts 里出现过)。
  if (prior && prior.aliases) out.aliases = prior.aliases
  return out
}

export function parseBaseline(text, where) {
  try {
    return JSON.parse(text)
  } catch {
    throw new Undetermined(`${BASELINE_REL}(${where})不是合法 JSON —— 台账坏了不得当豁免用`)
  }
}

/** 台账缺席 = 空锚点(全判红)。这是"新门先入库台账再接线"的强制顺序,不得靠缺文件蒙绿。 */
export function chooseBaseline(t) {
  return t === null || t === undefined ? {} : parseBaseline(t, 'ledger')
}

export function loadBaseline(repoRoot, face) {
  const spec = (face === 'staged' ? ':' : 'HEAD:') + BASELINE_REL
  const got = catBatch(repoRoot, [spec], { maxBuffer: 1 << 24 })
  return chooseBaseline(got.get(spec))
}

export function faceFromArgv(argv) {
  const { face, error } = selectFace({
    staged: argv.includes('--staged'),
    worktree: argv.includes('--worktree'),
    def: 'head',
  })
  // 把 error 当 face 往下传 = --staged 静默按 HEAD 判,账面却读成"审过本次提交的那一份"。
  if (error) throw new Undetermined(error)
  if (face === 'worktree')
    throw new Undetermined('本门不开工作树档:共享工作树滞后 HEAD,按磁盘判会把错数写回台账')
  return face
}

export function main(argv, repoRoot = ROOT) {
  const pairAll = argv.includes('--pair-all')
  let face, collected, baseline
  let rejProblems = []
  let rejNames = []
  let aliases = {}
  try {
    face = faceFromArgv(argv)
    baseline = loadBaseline(repoRoot, face)
    /** 拆对声明先校验再喂给 collect:一条坏声明(无理由 / 过期 / 不是对象)必须判红,
     *  绝不能因为"解析不出"就退回默认档继续把这条族当配对算。 */
    const rej = baseline.pairingRejects ?? {}
    rejNames = Object.keys(rej)
    rejProblems = rejNames
      .map((n) => ({ name: n, why: rejectProblem(rej[n]) }))
      .filter((x) => x.why)
    aliases = baseline.aliases ?? {}
    // `rej` 一起喂进去:拆对从"一条全局名单"变成"按腿的声明",而**形状判定只住在 rejectProblem /
    // rejectLegs 那一处**。调用方不得再判断形状(两处各写一遍必漂,而漂开的表现是"该拆的腿没拆、
    // 不该拆的那条腿被静默摘线")。
    collected = collect(repoRoot, face, { pairAll, rejected: rejNames, rejectMap: rej, aliases })
  } catch (e) {
    if (e instanceof Undetermined) {
      console.log(`⚠️ 无法判定:${e.message}`)
      return 2
    }
    throw e
  }
  const res = audit(
    collected.pairs,
    collected.text,
    baseline,
    collected.tiers,
    collected.radius,
    collected.styles ?? {},
  )
  /**
   * web 腿(与主腿**分开记账**):同一组件名在主腿与 web 腿各自有一份差异时,共用一个锚点会让
   * "修掉了 web 那一侧"顶掉主腿的名额(净零逃逸,守门 134 扩布尔档键同一课)。所以子账独立、
   * 判序复用 `verdictOf`(只换 keys),两腿的红各自进退出码。
   */
  const web = webRadiusAudit(
    collected.webPairs,
    collected.text,
    collected.radius,
    collected.styles ?? {},
  )
  const webVerdict = verdictOf(web.findings, baseline, WEB_LEDGER)
  /**
   * 台账里"被 web 腿钉过"的族名单。**在 JSON 分支之前算**:`--json` 那一支也在同一块作用域里,
   * 放到函数末尾会让它读到 TDZ 中的 const(症状是崩溃,不是"少一个字段")。
   */
  const webPriorKeys = Object.keys(baseline[WEB_LEDGER.radius] ?? {}).filter(
    (n) =>
      (baseline[WEB_LEDGER.radius]?.[n] ?? 0) > 0 || (baseline[WEB_LEDGER.counts]?.[n] ?? 0) > 0,
  )
  // 同样在 `--json` 分支之前算好(TDZ 纪律同 webPriorKeys):json 的 webUnreachable 字段要用。
  const wPrunedJson = (collected.webUnreachableLegs ?? []).map((u) => ({
    name: u.name,
    legs: u.legs,
  }))
  /**
   * ── RS 根槽位维(台账 G-629)读数 ─────────────────────────────────
   * 同样**必须在 `--json` 分支之前算好**:json 要暴露 `rootSlot`,退出码要折 `rsRed`。
   * 放在分支之后 = json 少一个字段而退出码少一条判红,两者都不报错 —— 那一维就成了
   * "有判据而没人调度"的状态,账面读起来仍全绿(自检 KU 就是钉这一点的)。
   */
  const rs = rootSlotAudit(
    collected.pairs,
    collected.text,
    collected.radius,
    collected.styles ?? {},
  )
  let rsRed = []
  if (rs.findings.length && face !== 'head') {
    const base = collect(repoRoot, 'head', { pairAll, aliases })
    const baseRs = rootSlotAudit(base.pairs, base.text, base.radius, base.styles ?? {})
    rsRed = rootSlotDelta(rs.findings, baseRs.findings)
  }
  if (argv.includes('--emit-baseline')) {
    const next = emitBaseline(res.findings, baseline, web.findings)
    /**
     * 重出台账前必须先过**单调性核对**:既有锚点上升或整键消失一律拒绝落盘。
     * 这条闸的存在理由不是"有人手滑",而是覆盖面被扩宽的那一枚提交必然抬高读数
     * (票⑫:提取式一放宽,端上一行未改而凭空多 10 档)—— 那一刻 `--emit-baseline` 的产物
     * 看上去就是"按实测重锚过了",而它实际做的是一次无人察觉的放松。
     * 说明走 console.error + 非零退出:T13 钉的就是这个分支的 stdout 只能是 JSON。
     */
    const regress = anchorRegression(baseline, next)
    if (regress.length) {
      console.error(
        `× 拒绝出台账:锚点只允许下降或持平,下列 ${regress.length} 条上升/消失 ⇒ ` +
          '要么判据刚被扩宽(那这些不是真分叉,须先甄别),要么是要放松存量(那不该由这一步做)',
      )
      for (const r of regress) console.error(`  - ${r}`)
      return 1
    }
    console.log(JSON.stringify(next, null, 2))
    /**
     * 说明行一律走 stderr:这条模板的既定用法就是 `--emit-baseline > <台账文件>`,
     * 把它打进 stdout 等于把一句散文追加进 JSON 文件 —— 实测砸出来的
     * `SyntaxError: Unexpected token 模` 会让 lint-staged 在提交当场崩掉(而 JSON 看起来"像"是门产的合法物)。
     */
    console.error(
      `模板按 ${FACE_TXT[face]} 面生成;逐条核过再放进 ${BASELINE_REL}(它是存量锚点,不是合格证)`,
    )
    return 0
  }
  if (argv.includes('--json')) {
    console.log(
      JSON.stringify({
        face,
        pairAll,
        pairCount: res.pairCount,
        findings: res.findings.map((f) => ({
          name: f.name,
          diffCount: diffCount(f),
          radiusCount: radiusCount(f),
          radius: f.radius,
          elementRadiusCount: elementRadiusCount(f),
          elementRadius: f.elementRadius,
          lang: f.lang,
        })),
        // RE 的射程边界也要能被机器读:下一票(给两腿立同一套元素名)的输入就是这两列名单。
        radiusUnpaired: res.radiusUnpaired ?? [],
        unreachable: (collected.unreachableLegs ?? []).map((u) => ({ name: u.name, legs: u.legs })),
        undeterminedEdges: (collected.undeterminedEdges ?? []).length,
        // 配对射程也要能被机器读:下一票(按语义槽配对)的输入就是这两份名单,
        // 只在人读面打印的话,它又得靠复制粘贴终端输出当数据源 —— 那是会腐烂的取证。
        onlyMiniappNames: collected.pairs?.onlyMiniappNames ?? [],
        onlyRnNames: collected.pairs?.onlyRnNames ?? [],
        aliasPairs: (collected.pairs?.pairs ?? [])
          .filter((p) => p.aliased)
          .map((p) => ({ name: p.name, miniapp: p.miniapp, rn: p.rn })),
        aliasProblems: collected.pairs?.aliasProblems ?? [],
        // 同侧多候选与出口链的判定材料也要能被机器读 —— 只印人读面,下一票就得抄终端输出当数据源。
        multiCandidates: collected.pairs?.multiCandidates ?? [],
        exitNotes: collected.exitNotes ?? [],
        red: res.red,
        waived: res.waived.length,
        /**
         * RS(根槽位维):**层**进入判据的读数。它与 RD 并列而非替换 ——
         * RD 的 `radiusSeen` 只说明两端文件里出现过的档集合,而集合相等**不证明同一元素同档**
         * (台账 G-629:小程序在组件根、RN 在外层 wrapper,`[4,6,8]` 对 `[4,6,8]` ⇒ 圆角维恒 0)。
         * `undetermined` 必须一起进 json:空 `findings` 有两个来源(真的一致 / 判据瞎了),
         * 只给 `findings` 这两者在机器面上分不开。
         */
        rootSlot: {
          findings: rs.findings,
          undetermined: rs.undetermined,
          red: rsRed.map((x) => x.name),
        },
        // web 腿也要能被机器读:只有人读面的话,下一票(把 web 的几何也纳进来)就得抄终端输出当数据源。
        web: {
          pairCount: web.findings.length,
          /** 只量圆角档是**这一腿的设计边界**,不是"几何已确认相同" —— 把它写进读数旁边,
           *  否则 `webRed: 0` 会被读成"web 与小程序已一致"。 */
          dimension: 'radius-only(文件级档值集合;几何/元素名/图标载体未判)',
          findings: web.findings.map((f) => ({
            name: f.name,
            miniapp: f.miniapp,
            web: f.web,
            radius: f.radius,
          })),
          red: webVerdict.red,
          shrunk: webVerdict.shrunk,
          undetermined: web.undetermined,
          blocked: collected.webBlocked ?? null,
          // 被拆掉的 web 腿配对也要能被机器读:只印人读面的话,"这一族为什么不在账上"就只能靠
          // 抄终端输出当取证(与 aliasPairs / multiCandidates 那两处同一条理由)。
          rejected: (collected.webRejected ?? []).map((x) => ({
            name: x.name,
            miniapp: x.miniapp,
            web: x.rn,
          })),
          // 被端入口可达性剔掉的 web 腿配对也要能被机器读(与主腿 unreachable 同一条要求)。
          webUnreachable: wPrunedJson,
          webReachSuspended: collected.webReachNote ?? null,
          ghostRed: webPriorKeys.length && !web.findings.length ? webPriorKeys : [],
        },
      }),
    )
  } else {
    const off = collected.unreachableLegs ?? []
    const undet = collected.undeterminedEdges ?? []
    console.log(
      `判定面 ${FACE_TXT[face]}:同名配对组件 ${res.pairCount} 对(重复实现 = 改一端另一端不跟随)` +
        (pairAll
          ? '【--pair-all 人工档:只要同名就配对,未做端入口可达性剔除】'
          : off.length
            ? `;已剔除 ${off.length} 对(腿文件从端入口不可达:${off.map((o) => o.name).join('/')})—— ` +
              '配一份没在屏幕上渲染的副本,绿灯不算数'
            : '') +
        (undet.length
          ? `;未判定边 ${undet.length} 处(路径解析不到 / 动态拼接,不当"不存在"也不当"不可达")`
          : ''),
    )
    const blind = collected.blindClasses ?? []
    if (blind.length) {
      const total = blind.reduce((n, b) => n + b.classes.length, 0)
      console.log(
        `  ⓘ 读数不完整:${blind.length} 条配对腿用到 ${total} 个类名,其定义不在本组件样式表里` +
          `(盒档落在 app.css / 某页 css)⇒ 这些元素的几何本门读不到。` +
          `没读到不得当成该侧无档,也不得拿去当已核对过的凭据`,
      )
      for (const b of blind.slice(0, 6))
        console.log(
          `     · ${b.name}[${b.side}] ${b.classes.slice(0, 8).join(' ')}` +
            (b.classes.length > 8 ? ` …另 ${b.classes.length - 8} 个` : ''),
        )
      if (blind.length > 6) console.log(`     · 其余 ${blind.length - 6} 条同上(不静默省略计数)`)
    }
    for (const o of off) console.log(`  ⊘ ${o.name} —— ${o.reason}`)
    if (collected.coverageNote) console.log(`  ⚠ ${collected.coverageNote}`)
    /**
     * 读数口径必须自己报出来:合并了伴生样式表的那一侧,与只读组件源文本的那一侧,
     * 拿到的档数不在同一口径上。不写这一行,"小程序 0 档 / RN 11 档"就会被读成"小程序没做",
     * 而它可能只是尺子没跟到 `.css`(2026-09-27 实测:6 个小程序组件把盒档写在同名 CSS 里)。
     */
    console.log(
      `  ⓘ 读数口径:几何与圆角(RD / RE)= 组件源文本 + 该文件自己 import 的本地样式表(本轮并入 ` +
        `${Object.keys(collected.styles ?? {}).length} 份);图标载体 / 单侧档仍只看组件源文本。` +
        `RE 与 RD 的分别不在取材面而在**配对单位**:RD 比文件内出现过的档值集合,` +
        `RE 比两侧**同名元素**各取了哪一档 —— 前者的一条"分叉"可以同时意味着"对面这个文件压根没写圆角"。` +
        `取不到的样式文件计未判定,不当"该侧无档"`,
    )
    /**
     * **同侧多候选逐条点名**(票⑭)。这是"不得把两份实现读成两份真相"的落点:一份族在
     * components/ 与 features/** 同时活着时,被审的究竟是哪一份、依据哪一序选出来,必须写出来 ——
     * 静默选一份时,改另一份任何读数都不动,而账面读起来像"这一族在被看守"。不判红:多候选是
     * 结构事实不是违规(可达性、出口、后缀三序都真在选),无声才是。
     */
    const mc = collected.pairs?.multiCandidates ?? []
    if (mc.length) {
      const why = {
        suffix: '平台后缀(该端构建期真解析的那份)',
        exit: '出口指向(@ihui/rn-app / 组件桶的 re-export 链)',
        order: '目录序(本族没有出口证据)',
      }
      console.log(
        `  ⓘ 同侧多候选 ${mc.length} 条腿 —— 选腿三序:平台后缀 > 出口指向 > 目录序;` +
          `候选逐条点名(不得静默选一份):`,
      )
      for (const c of mc)
        console.log(
          `     · ${c.name}[${c.side}] 选 ${c.chosen}(依据:${why[c.by] ?? c.by})` +
            ` | 未选 ${c.others.join(' / ')}`,
        )
    }
    for (const n of collected.exitNotes ?? [])
      console.log(`  ⓘ 出口链:${n} —— "判不出"不冒充"没有出口",也不冒充证据`)
    /**
     * **配对射程必须自己报数**。本门只比"同名成文件"的元素:一端把某个控件写成组件文件、
     * 另一端把它内联在别的组件里(RN 的发送钮就是 `BottomActionBar.tsx` 里的内联 `<Send/>`,
     * 而小程序侧同槽另有文件),两侧永不成对 —— 那部分界面**本门零判据**。
     * 不写出来,"N 对全绿"就会被读成"两端界面全一致",而这正是本仓反复记过的失效型:
     * 判据的射程边界不吭声,读者就替它把边界里面当成全部。只报数不判红(它是边界不是违规)。
     */
    {
      const om = collected.pairs?.onlyMiniapp ?? 0
      const or = collected.pairs?.onlyRn ?? 0
      if (om || or)
        console.log(
          `  ⓘ 配对射程:仅小程序成文件 ${om} 个 / 仅 RN 成文件 ${or} 个 —— ` +
            `两端不同名的元素不成对,本门对它们零判据(报数,不判红)`,
        )
      /**
       * 名单逐名打印。上一版只报"75 / 50"两个数,结果是这格**永远无法被清偿** ——
       * 拿到数字的人看不出这 125 个文件里哪些真是两端不同名的同一元素、哪些确实只存在一端,
       * 而这个判断恰是"要不要扩配对判据"的唯一依据。"报数不报名"在本仓反复被记成
       * 判据失明的表现形态(守门 70/76/81 同族),所以这里把名字全量列出,不做截断:
       * 截断会把"其余 N 个"变成新的暗面,而列出它们不花任何判据成本。
       */
      for (const [label, key] of [
        ['仅小程序', 'onlyMiniappNames'],
        ['仅 RN', 'onlyRnNames'],
      ]) {
        const names = (collected.pairs?.[key] ?? []).map((p) => nameOf(String(p)))
        if (names.length) console.log(`     ${label}(${names.length}):${names.join(' ')}`)
      }
    }
    for (const u of undet.slice(0, 12))
      console.log(`  ? 未判定:${u.from ?? '(清单)'} → ${u.spec}:${u.reason}`)
    if (undet.length > 12) console.log(`  ? 其余 ${undet.length - 12} 处未判定同上(不静默省略计数)`)
    for (const f of res.findings) {
      const bits = []
      if (f.named.length) bits.push(`同名常量不同值 ${f.named.join(', ')}`)
      if (f.geometry.onlyMiniapp.length) bits.push(`仅小程序档 ${f.geometry.onlyMiniapp.join('/')}`)
      if (f.geometry.onlyRn.length) bits.push(`仅 RN 档 ${f.geometry.onlyRn.join('/')}`)
      /**
       * 圆角**单独前缀成 `RD`**,不得与几何档混在一行读数里:混了之后"UserInfoCard 差 1 档"
       * 到底是圆角差还是盒档差,看报告的人分不出来,而这两型的处置动作不同(圆角按 RADIUS_ROLES
       * 的角色定档,几何按 spec 收口)。两维各自也有各自的台账锚点(见 radiusCount)。
       */
      if (f.radius?.onlyMiniapp.length)
        bits.push(
          `RD 仅小程序 ${f.radius.onlyMiniapp.join('/')}(端上实取 ${f.radiusSeen?.miniapp.join('/')})`,
        )
      if (f.radius?.onlyRn.length)
        bits.push(`RD 仅 RN ${f.radius.onlyRn.join('/')}(端上实取 ${f.radiusSeen?.rn.join('/')})`)
      /**
       * RE 与 RD 必须各说各话:`RD 仅小程序 4` 说的是"这个文件里出现过 4 而对面没出现过",
       * `RE card 小程序8/RN12` 说的是"同一个叫 card 的元素两端取了不同档"。只有后者能当
       * 改端的依据 —— 按前者补数字就是照着一个未证明的命题动 UI。
       */
      for (const m of f.elementRadius?.mismatched ?? [])
        bits.push(`RE 同名元素 ${m.name} 小程序 ${m.miniapp.join('/')} vs RN ${m.rn.join('/')}`)
      const mark = f.waived ? '○' : res.red.some((r) => r.name === f.name) ? '×' : '·'
      console.log(`  ${mark} ${f.name} [${f.lang.miniapp}|${f.lang.rn}] ${bits.join(' | ')}`)
    }
    /**
     * **WD = web ↔ 小程序**的圆角档对账。前缀与 RD/RE 分开,是因为三者的处置动作不同:
     * RD/RE 说"小程序与 App 两端",WD 说"web 与小程序"(AGENTS §4 的跨端铁律那一半)。
     * 这一腿**只量圆角档**必须自己说出来 —— 不说,`判红 0` 就会被读成"web 与小程序已一致"。
     */
    {
      const wlines = []
      for (const f of web.findings) {
        const bits = []
        if (f.radius.onlyMiniapp.length) bits.push(`仅小程序档 ${f.radius.onlyMiniapp.join('/')}`)
        if (f.radius.onlyRn.length) bits.push(`仅 web 档 ${f.radius.onlyRn.join('/')}`)
        const mark = webVerdict.red.some((r) => r.name === f.name) ? '×' : '·'
        wlines.push(`  ${mark} WD ${f.name} ${bits.join(' | ')}`)
      }
      const wPruned = collected.webUnreachableLegs ?? []
      console.log(
        `web 腿(RD 量纲,配对 ${web.findings.length} 对` +
          (wPruned.length ? `,另剔 ${wPruned.length} 对死腿` : '') +
          `;几何 / 元素名 / 图标载体**未判**,不是"已确认相同")` +
          `→ 判红 ${webVerdict.red.length} / 台账外新增 0 时才算收口 / 带理由豁免 ${webVerdict.waived.length} / 未判定 ${web.undetermined.length}`,
      )
      // 挂起不得静默:web 可达性没在判(种子缺席)时,这一维"没剔"与"都活着"在账面上长得一样。
      if (collected.webReachNote)
        console.log(
          `  ? WD 可达性挂起:${collected.webReachNote} —— web 侧本轮**未做端入口剔除**,不得读成"已确认活着"`,
        )
      // 剔除逐条点名,与主腿 ⊘ 同一要求:静默删族 = 判据输入被改而没人知道(G-978049③)。
      for (const o of wPruned) console.log(`  ⊘ WD ${o.name} —— ${o.reason}`)
      // 豁免不得静默:每条都要把理由与它的两个读数打在报告上(与主腿 PAIR/ALIAS 同一取向) ——
      // 只写"已豁免 N"会替下一个人做出"这一族已被想过"的判断,而理由能不能复核全靠这一行。
      for (const wv of webVerdict.waived) {
        const rej = (baseline[WEB_LEDGER.waivers] ?? {})[wv.name]
        console.log(`  ⊘ WD ${wv.name} 带理由豁免 —— ${rej?.reason ?? ''}`)
      }
      if (collected.webBlocked)
        console.log(
          `  ? WD 整腿未判定:${collected.webBlocked} —— 这一维今天**没在看**,不得读成"web 与小程序已一致"`,
        )
      for (const l of wlines.slice(0, 20)) console.log(l)
      if (wlines.length > 20)
        console.log(`     · 其余 ${wlines.length - 20} 对同上(不静默省略计数)`)
      for (const u of web.undetermined.slice(0, 8)) console.log(`  ? WD ${u.name}:${u.why}`)
      if (web.undetermined.length > 8)
        console.log(`  ? 其余 ${web.undetermined.length - 8} 处 WD 未判定同上`)
      for (const r of webVerdict.red)
        console.log(
          `  × WD ${r.name}:圆角 ${r.radiusCount} > 该族自己在台账的锚点 ${r.radiusAnchor} —— ` +
            `收口姿势与 RD 同:两端各自引用档位表不是目的,同一元素取同一档才是`,
        )
    }
    /**
     * RE 的**射程边界逐条报名**,不只报数。这一格是这一维存在的全部理由:RD 那些
     * "一侧空集"的读数,真实含义全在这里 —— 那一侧根本没给元素起名字(走 utility 串或内联
     * style),于是两端从未在同名元素上相遇,既谈不上同档也谈不上分叉。
     * 只印两个计数的话,拿到数字的人无法判断该不该扩配对判据,而那个判断正是下一票的唯一输入
     * (本仓"报数不报名"记过多次:守门 70/76/81 同族)。**不判红** —— 它是覆盖面边界,
     * 不是违规;把它判红就是一台谁也修不动的恒红门(§12e 同型)。
     */
    for (const u of res.radiusUnpaired ?? []) {
      const bits = []
      if (u.onlyMiniapp.length) bits.push(`仅小程序具名 ${u.onlyMiniapp.join('/')}`)
      if (u.onlyRn.length) bits.push(`仅 RN 具名 ${u.onlyRn.join('/')}`)
      bits.push(`无元素名可归的取用 mp=${u.unnamed.miniapp}/rn=${u.unnamed.rn}`)
      console.log(`  ⊘ RE ${u.name} —— 两侧无一同名元素 ⇒ 本维零判据:${bits.join(' | ')}`)
    }
    const rdFindings = res.findings.filter(
      (f) => (f.radius?.onlyMiniapp.length ?? 0) + (f.radius?.onlyRn.length ?? 0) > 0,
    )
    const reFindings = res.findings.filter((f) => elementRadiusCount(f) > 0)
    console.log(
      `可见几何差异 ${res.findings.length} 处 → 超锚点判红 ${res.red.length} / 带理由豁免 ${res.waived.length}` +
        (res.shrunk.length ? ` / 已变好可下调台账 ${res.shrunk.length}` : '') +
        `;其中圆角跨端不同档 ${rdFindings.length} 对(RD 维,锚点单立见 radiusCounts)` +
        `;同名元素圆角分叉 ${reFindings.length} 族(RE 维,锚点单立见 elementRadiusCounts)` +
        `;RE 对 ${res.radiusUnpaired?.length ?? 0} 族零判据(两侧未同名,报名见上)`,
    )
    if (res.shrunk.length)
      console.log(
        `  下调:${res.shrunk.map((s) => `${s.name} ${s.anchor}→${s.diffCount}`).join(', ')}`,
      )
    if (res.rot.length)
      console.log(
        `  × 台账腐烂:${res.rot.join('/')} —— 台账钉着这些名字而本轮实测**无该族记录**:` +
          '它们是一个永远不可能被问责的免费额度,下一次这一族重新被配对(回落/拆对被撤/组件复活)时自带存量,' +
          '新分叉会被静默吞掉。处置 = 删掉这些键,或让它重新有读数;不得"先放着"。',
      )
    if (res.red.length)
      console.log(
        '  收口姿势 = 一份与平台无关的组件源 + 两端各自注入 primitive adapter;**不得给单端补数字凑平**' +
          '(那只是把第二份真相挪了个位置)。确属平台导致的差异写进台账 waivers 并带 reason。',
      )
  }
  /*
   * ── IC 图标载体对账 ──────────────────────────────────────────────
   * 与几何判据分开跑:几何已同值的族,图标照样可能一端 lucide 矢量、一端 CDN 位图 ——
   * 挂在"有几何差异才看"的分支上,等于对最干净的那批组件失明(用户实拍反馈正是这一型)。
   * 红条件 = 该组件位图槽数 **超过它自己在 HEAD 的存量**(棘轮,只拦新增;存量当场判红就是
   * 与任何提交都无关的恒红门,唯一结局是逼人跳门,§12e 同型)。单侧矢量化只报数 ——
   * 平台确有单侧控件(RN 的 <Switch>、小程序走 chooseMessageFile 无录音界面),判红必成假阳。
   */
  let icRed = []
  const ic = iconAudit(collected.pairs, collected.text)
  if (ic.length) {
    if (face !== 'head') {
      const base = collect(repoRoot, 'head', { pairAll, aliases })
      const baseIc = new Map(
        iconAudit(base.pairs, base.text).map((x) => [x.name, { mp: x.bitmap, rn: x.rnBitmap }]),
      )
      // 棘轮**逐侧各算一次**:只看小程序会把"把位图从一端搬到两端"判成没变差,
      // 而那只说明"另一端还没矢量化"这一半信息根本没被读进尺子。
      icRed = ic.filter((x) => {
        const b = baseIc.get(x.name) ?? { mp: 0, rn: 0 }
        return x.bitmap > b.mp || x.rnBitmap > b.rn
      })
    }
    if (!argv.includes('--json')) {
      for (const x of ic) {
        const bits = []
        if (x.bitmap) bits.push(`小程序仍用 CDN 位图 ${x.bitmap} 处`)
        if (x.rnBitmap) bits.push(`RN 仍用位图 ${x.rnBitmap} 处`)
        if (x.bothBitmap.length) bits.push(`两端同字形都走位图 ${x.bothBitmap.length} 枚`)
        if (x.exempted) bits.push(`带理由豁免 ${x.exempted} 处`)
        if (x.onlyRn.length) bits.push(`仅 RN 矢量化 ${x.onlyRn.join('/')}`)
        if (x.onlyMiniapp.length) bits.push(`仅小程序矢量化 ${x.onlyMiniapp.join('/')}`)
        console.log(
          `  ${icRed.some((r) => r.name === x.name) ? '×' : '·'} IC ${x.name} ${bits.join(' | ')}`,
        )
      }
      console.log(
        `图标载体对账 ${ic.length} 族 → 新增位图当图标判红 ${icRed.length} / 只报数 ${ic.length - icRed.length}`,
      )
    }
  }
  if (icRed.length && !argv.includes('--json'))
    console.log(
      '  IC 收口姿势 = 该槽位换成与 RN 同一个 lucide 字形(小程序走 LineIcon,名字照抄 RN 侧),' +
        '确属多色插画才保留位图并写 icon-bitmap-exempt: <原因>',
    )
  /*
   * ── SL 单侧具名档对账 ───────────────────────────────────────────
   * 具名档解析接通后新可读的一维:一张 spec 档只被一条腿引用 = 另一条腿还没走单一源。
   * 与几何集合分开跑(折进 values 会把"没接线"报成"分叉",两者处置动作不同)。
   * 红条件与 IC 同形 = 该族单侧档数**超过它自己在 HEAD 的存量**;存量只报数 ——
   * 首次接通时 9 族全有单侧档,当场判红就是一台恒红门(§12e 同型)。
   */
  const sl = specLegAudit(collected.pairs, collected.text, collected.tiers)
  let slRed = []
  if (sl.length) {
    if (face !== 'head') {
      const base = collect(repoRoot, 'head', { pairAll, aliases })
      const baseSl = new Map(
        specLegAudit(base.pairs, base.text, base.tiers).map((x) => [
          x.name,
          x.onlyMiniapp.length + x.onlyRn.length,
        ]),
      )
      slRed = sl.filter((x) => x.onlyMiniapp.length + x.onlyRn.length > (baseSl.get(x.name) ?? 0))
    }
    if (!argv.includes('--json')) {
      for (const x of sl) {
        const n = x.onlyMiniapp.length + x.onlyRn.length
        const bits = []
        if (x.onlyMiniapp.length) bits.push(`仅小程序引用 ${x.onlyMiniapp.join('/')}`)
        if (x.onlyRn.length) bits.push(`仅 RN 引用 ${x.onlyRn.join('/')}`)
        console.log(
          `  ${slRed.some((r) => r.name === x.name) ? '×' : '·'} SL ${x.name}(${n}) ${bits.join(' | ')}`,
        )
      }
      console.log(
        `单侧具名档 ${sl.length} 族 → 新增判红 ${slRed.length} / 只报数 ${sl.length - slRed.length}` +
          '(一档只被一条腿引用 = 另一条腿还没走单一源;不得靠给单端补数字消账)',
      )
    }
  }
  /*
   * ── RS 根槽位对账(层进入判据)────────────────────────────────────
   * 红条件与 IC / SL 同形 = 该族的根槽位分叉是**新增**的(HEAD 面没有),存量只报数。
   * 处置姿势与 RD 相反:根槽位不同**不是**给某一端补一个数字,而是把声明挪到同一个槽位 ——
   * 两端各在不同的层上声明圆角,屏幕上就是两个不同的圆角,补数字只会让某一层多一档。
   */
  if (rs.findings.length && !argv.includes('--json')) {
    for (const x of rs.findings)
      console.log(
        `  ${rsRed.some((r) => r.name === x.name) ? '×' : '·'} RS ${x.name}` +
          `(根槽位 小程序[${x.miniapp.join(',')}] / RN[${x.rn.join(',')}])`,
      )
    console.log(
      `根槽位圆角 ${rs.findings.length} 族 → 新增判红 ${rsRed.length} / 只报数 ${rs.findings.length - rsRed.length}` +
        '(同一元素必须在渲染路径的同一个槽位上比;文件级档集合相等**不证明**同值 —— ' +
        '小程序在组件根、RN 在外层 wrapper 时,RD 读 0 而屏幕上圆角不同)',
    )
  }
  /**
   * 未判定必须自己报数(不判红):`anchored:false`(锚不到)与 `indirect`(根由子组件代渲染 /
   * HOC 包裹)都是"这一维没看"。不写出来,"根槽位 0 分叉"会被读成"两端根上圆角一致",
   * 而真相是"这一族根本没被判" —— 这正是本维要修的那个推断在读数面上的复发。
   */
  if (rs.undetermined.length && !argv.includes('--json')) {
    console.log(
      `  ⓘ 根槽位未判定 ${rs.undetermined.length} 族 —— 下列各族这一维**没看**,` +
        `其"无差异"不得读成"两端根上同档"`,
    )
    for (const u of rs.undetermined.slice(0, 6)) console.log(`     · ${u.name} —— ${u.why}`)
    if (rs.undetermined.length > 6)
      console.log(`     · 其余 ${rs.undetermined.length - 6} 条同上(不静默省略计数)`)
  }
  /*
   * ── PAIR 拆对声明对账 ───────────────────────────────────────────
   * 三条红:① 声明本身坏(无理由 / 过期 / 形态不对 / legs 里有不认识的腿名);
   * ② 拆掉的族仍挂**它所作用的那条腿**的锚点或豁免(同一族既被声明"不是同一个元素"又被记账
   *    "两端差 N 档"= 双记账,必有一份是假的);
   * ③ 台账声明拆了某族,而**每一条它声称作用的腿**上都找不到这一对 —— 要么文件改名/删了(声明该
   *    跟着了结),要么它已回到"只有一端有"的状态,两种都不该继续挂着。
   * ②与③都必须按腿分别核(2026-09-30 加 `legs` 那一维时同批改):用主腿的名单去查 web 腿的账,
   * 会同时产出两种错 —— 一条只拆 web 的声明被误判成"仍挂主腿锚点"(假红,逼人删合法声明),
   * 以及一条只拆主腿的声明在 web 腿整族找不到而被放过(真烂不掉)。
   * 刻意不因"未判定"放过:拆对是本门输入的改变,比调台账数字更需要证据。
   */
  const rejAll = baseline.pairingRejects ?? {}
  const rejStillAnchored = Object.keys(rejAll).filter((n) => {
    const legs = rejectLegs(rejAll[n])
    return (
      (legs.main &&
        ((baseline.counts ?? {})[n] !== undefined || (baseline.waivers ?? {})[n] !== undefined)) ||
      (legs.web &&
        ((baseline[WEB_LEDGER.counts] ?? {})[n] !== undefined ||
          (baseline[WEB_LEDGER.radius] ?? {})[n] !== undefined ||
          (baseline[WEB_LEDGER.element] ?? {})[n] !== undefined ||
          (baseline[WEB_LEDGER.waivers] ?? {})[n] !== undefined))
    )
  })
  const pairedNames = new Set([
    ...(collected.rejected ?? []).map((x) => x.name),
    ...(collected.webRejected ?? []).map((x) => x.name),
  ])
  const rejGhosted = Object.keys(rejAll).filter((n) => !pairedNames.has(n))
  const rejInvalid = rejProblems.map((x) => `${x.name}:${x.why}`)
  if (!argv.includes('--json')) {
    for (const x of collected.rejected ?? [])
      console.log(`  ⊘ PAIR ${x.name} —— 同名不同物,已按声明拆对:${rejAll[x.name].reason}`)
    for (const x of collected.webRejected ?? [])
      console.log(
        `  ⊘ WD-PAIR ${x.name} —— 只拆 web 腿:${rejAll[x.name].reason}` +
          '(主腿那一维照旧在册,不得被这条声明连带摘线)',
      )
    for (const m of rejInvalid) console.log(`  × PAIR 拆对声明无效:${m}`)
    for (const n of rejStillAnchored)
      console.log(
        `  × PAIR ${n} 已声明拆对,台账仍挂它**所作用那条腿**的锚点/豁免 ⇒ 双记账,删那条键`,
      )
    for (const n of rejGhosted)
      console.log(
        `  × PAIR ${n} 声明拆对,而它声称作用的每条腿上都找不到这一对 ⇒ 文件已搬走或只剩一端,该了结这条声明`,
      )
  }
  const rejRed = rejInvalid.length + rejStillAnchored.length + rejGhosted.length
  /*
   * ── ALIAS 别名配对对账 ──────────────────────────────────────────
   * 两端给同一个界面元素起了不同名字时,任何按文件名的配对都看不见它 —— 这一格过去只剩
   * "射程外 N 个"的计数,而**计数无法被清偿**,因为没人知道名单里哪两个是同一个东西。
   * 别名把这件事变成台账里一条带理由、带到期的声明,于是配对有据,且烂了会被发现。
   * 三条红全在 `scan()` 里判(声明坏 / 被审面找不到文件 / 该对已按同名配上),
   * 这里只负责打印与折进退出码 —— 判据只住一处,别在 main 再抄一份。
   */
  const aliasProblems = collected.pairs?.aliasProblems ?? []
  const aliasPairs = (collected.pairs?.pairs ?? []).filter((p) => p.aliased)
  if (!argv.includes('--json')) {
    for (const p of aliasPairs)
      console.log(
        `  ✓ ALIAS ${p.name} —— 跨名配对:${(aliases[p.name] ?? {}).miniapp} ↔ ${(aliases[p.name] ?? {}).rn}` +
          `(同名判据看不见这一对,现按登记的别名进审)`,
      )
    for (const x of aliasProblems) console.log(`  × ALIAS ${x.name}:${x.problem}`)
    if (Object.keys(aliases).length)
      console.log(
        `别名配对 ${aliasPairs.length} 族 / 声明 ${Object.keys(aliases).length} 条 → 判红 ${aliasProblems.length}` +
          '(别名是配对输入,不是豁免:文件搬走、路径写歪、或已能同名配对,都要当场点名)',
      )
  }
  const aliasRed = aliasProblems.length
  /*
   * ── G 几何表与其类型声明对账 ────────────────────────────────────
   * 两侧都判:表有档而类型不认 / 类型承认而表里没有。零容忍是安全的:
   * HEAD 现测两份同名(2 档),所以本维不存在"存量当场判红 = 恒红门"的问题(§12e 那一型),
   * 而它拦下的正是工作树上刚刚发生过的一次漂移(geometry.js +2 档、.d.ts 未跟 ⇒ 8 条 TS2339)。
   */
  let geoRed = false
  if (!argv.includes('--json')) {
    const g = collected.geoDecl ?? {}
    if (g.skipped) console.log('  ⊘ G 几何表不在本面(夹具/该面无该文件)⇒ 本维未参与判定')
    else if (g.undetermined) console.log(`  ? G 未判定:${g.problem}`)
    else if (g.problem) {
      geoRed = true
      console.log(`  × G 几何表与 geometry.d.ts 不同名:${g.problem}`)
    } else
      console.log(
        `  · G 几何表 ${g.steps.length} 档与 GeometryStep ${g.declared.length} 档同名(表↔类型一致)`,
      )
  }
  const rotRed = res.rot.length ? 1 : 0
  /**
   * **web 腿的死亡机制**:台账里挂着 web 锚点、而本轮这一族一条记录都没产出 ⇒ 红。
   * 没有这一条,"把 `apps/web/src/components` 改名或清空"就能让 WD 维安静下来 —— 而它安静下来的
   * 账面表现是"少了几行读数",不是"报错"。与主账的 `rot`(台账钉着某族而本轮无记录)是同一条判序,
   * 也同样是"报数不报名不算看守"的那条底线:被点名过的位置不能靠消失来销账。
   */
  const webGhostRed = webPriorKeys.length && !web.findings.length ? 1 : 0
  if (webGhostRed && !argv.includes('--json'))
    console.log(
      `  × WD 台账钉着 ${webPriorKeys.length} 族而本轮 web 腿零记录${collected.webBlocked ? `(整腿未判定:${collected.webBlocked})` : ''} ⇒ 消失不是销账`,
    )
  // 别名红单独先判(见上方 ALIAS 块)。刻意**不并入**下面那条求和行:它的文本被自检 ㊹/㊽/㊩
  // 三条装车锁钉着(那三条防的正是"红了却没折进退出码"),挪一次写法 = 三门同时翻红。
  // web 腿走**同一条先判支**:求和行的前后都被那三条锁按相邻子串钉死
  // (`return rotRed + res.red.length …` 与 `+ (geoRed ? 1 : 0) ? 1 : 0`),插进去必然同时打红三条,
  // 而"只打印不拦提交"正是这些锁存在的理由。WD3 显式要求这一支在,挪掉即红。
  if (webVerdict.red.length || webGhostRed) {
    if (!argv.includes('--json'))
      console.log(
        `  × WD 折进退出码:web 腿新增分叉 ${webVerdict.red.length} 族 / 台账钉过而本轮零记录 ${webGhostRed ? '是' : '否'}`,
      )
    return 1
  }
  if (aliasRed) return 1
  return rotRed +
    res.red.length +
    icRed.length +
    slRed.length +
    rejRed +
    (geoRed ? 1 : 0) +
    rsRed.length
    ? 1
    : 0
}

/**
 * 可达性判据的成对夹具:一座最小**真** git 仓(判据全程按 git 面取数,夹具不入库就测不到)。
 * 两端各一枚同名 `Foo`;RN 那枚**只被桶文件再导出** —— `packages/app/src/components/index.ts`
 * 带着它,而桶从 `@ihui/rn-app` 只被要求提供 `Bar`。这正是 NavBar / UserInfoCard 在真仓的形态。
 * `rn` 改的就是"导航器到底 import 哪些名字"这一处 ⇒ 传 `{Bar}` 必剔、传 `{Bar,Foo}` 必留,
 * 两条用例互为可逆对照(只有恒红或恒绿两种坏实现会同时错过它们)。
 */
function FIXTURE_BASE({ rn }) {
  return {
    'apps/miniapp-taro/src/app.tsx': 'export default function App() { return null }\n',
    'apps/miniapp-taro/src/app.config.ts':
      "export default defineAppConfig({ pages: ['pages/index/index'] })\n",
    'apps/miniapp-taro/src/pages/index/index.tsx':
      "import { Foo } from '@/components'\nexport default function P() { return <Foo /> }\n",
    'apps/miniapp-taro/src/components/index.ts': "export { Foo } from './Foo'\n",
    'apps/miniapp-taro/src/components/Foo.tsx':
      'export function Foo() { return <div className="w-[72rpx]" /> }\n',
    'apps/mobile-rn/App.tsx':
      "import { RootNavigator } from './src/navigation/RootNavigator'\nexport default function App() { return <RootNavigator /> }\n",
    'apps/mobile-rn/src/navigation/RootNavigator.tsx': `${rn}\n`,
    'packages/app/package.json': '{"name":"@ihui/rn-app","main":"./src/index.ts"}\n',
    'packages/app/src/index.ts': "export { Bar, Foo } from './components'\n",
    'packages/app/src/components/index.ts':
      "export { Bar } from './Bar'\nexport { Foo } from './Foo'\n",
    'packages/app/src/components/Bar.tsx': 'export function Bar() { return null }\n',
    'packages/app/src/components/Foo.tsx':
      'export function Foo() { return <div style={{ width: 36 }} /> }\n',
    // 具名档表与组件同面取,夹具必须自带一份 spec —— 否则 collect() 按"判据失明"判死,
    // 这一组用例红的原因就不是判据,而是夹具缺件。
    'packages/shared/src/ui/foo-spec.ts': 'export const FOO_BOX_PX = 24\n',
  }
}

/**
 * 档位表夹具(逐条目一行 —— objectEntries 按行取条目,单行对象会解析为 null,见 KW 注)。
 * web 腿用例(㉗b/㉗c)的组件用了 `rounded-md` ⇒ 圆角维要求表在面,缺件会让红的原因错位。
 */
function radiusFixtureTable() {
  return [
    'export const RADIUS_STEPS = {',
    '  xs: 2,',
    '  md: 6,',
    '  lg: 8,',
    '  xl: 12,',
    "  '2xl': 16,",
    '}',
    '',
  ].join('\n')
}

/** 造夹具仓:写文件 → init → add → commit(--no-verify + 自带身份,不碰任何全局钩子)。 */
function makeFixtureRepo(files) {
  const dir = mkScratch('ui-parity-')
  const run = (args) =>
    execFileSync(gitBinary(), ['-c', 'safe.directory=*', '-C', dir, ...args], {
      encoding: 'utf8',
      windowsHide: true,
      timeout: 60000,
      maxBuffer: 1 << 24,
      stdio: ['ignore', 'pipe', 'pipe'],
    })
  for (const [rel, text] of Object.entries(files)) {
    const abs = join(dir, rel)
    mkdirSync(dirname(abs), { recursive: true })
    writeFileSync(abs, text, 'utf8')
  }
  run(['init', '-q'])
  run(['add', '-A'])
  run([
    '-c',
    'user.email=self-test@local',
    '-c',
    'user.name=self-test',
    'commit',
    '-q',
    '--no-verify',
    '-m',
    'fixture',
  ])
  return dir
}

function runSelfTest() {
  let pass = 0
  let fail = 0
  const t = (name, cond, note) => {
    if (cond === true) pass++
    else fail++
    console.log(
      `  ${cond === true ? 'ok  ' : 'FAIL'} ${name}${cond === true ? '' : ` —— 实得:${String(cond)}${note ? ` (${note})` : ''}`}`,
    )
  }
  t(
    'S1 注释里的数字不得被当成几何档',
    readGeometry('// BOX = 99\nconst a = 1\n', 'rn').values.size === 0,
  )
  t(
    'S2 字符串里的块注释开闭序列不得吞掉后续判据',
    stripComments('const s="/*"\nconst BOX=8\n').includes('BOX'),
  )
  t(
    'S3 72rpx 与 36px 归一到同一档(单位不是差异)',
    readGeometry('w-[72rpx]', 'miniapp').values.has(36) &&
      readGeometry('w-[36px]', 'rn').values.has(36),
  )
  t(
    'S4 同名常量两侧不同值必须点名(阳性对照)',
    namedConflicts({ ICON: 20 }, { ICON: 22 }).length === 1,
  )
  t(
    'S5 同名常量两侧同值不得点名(反向对照)',
    namedConflicts({ ICON: 22 }, { ICON: 22 }).length === 0,
  )
  t(
    'S6 非几何键(字重/时长/index)不计入',
    readGeometry('fontWeight: 700\nduration: 300\nrowIndex = 3\n', 'rn').values.size === 0,
  )
  t(
    'S7 配对认 .jsx 与 .tsx 同判(门不得对自己产出的形态失明)',
    scan(['a/Back.jsx'], ['b/Back.tsx']).pairs.length === 1,
  )
  t('S8 两端清单为空 ⇒ 判死而非记绿(空扫不通过)', scan([], []).undetermined === true)
  t('S9 豁免缺理由仍算红', waiverProblem({ until: '2027-01-01' }) !== null)
  t(
    'S10 豁免带理由才算 waived',
    waiverProblem({ reason: '平台 chrome:原生导航栏不参与 CSS' }) === null,
  )
  t(
    'S11 棘轮:不超锚点绿 / 超过锚点红(成对)',
    (() => {
      const f = {
        name: 'X',
        named: [],
        geometry: { onlyMiniapp: [1, 2], onlyRn: [] },
        waived: false,
      }
      return (
        verdictOf([f], { counts: { X: 2 } }).red.length === 0 &&
        verdictOf([f], { counts: { X: 1 } }).red.length === 1
      )
    })(),
  )
  t(
    'S12 台账缺该组件 ⇒ 锚点 0,新配对的任何差异直接红',
    verdictOf(
      [{ name: 'New', named: [], geometry: { onlyMiniapp: [8], onlyRn: [] }, waived: false }],
      {},
    ).red.length === 1,
  )
  t(
    'S13 变好了只提示下调,不自动改账',
    verdictOf(
      [{ name: 'X', named: [], geometry: { onlyMiniapp: [1], onlyRn: [] }, waived: false }],
      {
        counts: { X: 5 },
      },
    ).shrunk.length === 1,
  )
  t(
    'S14 audit 端到端:同档绿 / 差一档红',
    (() => {
      const p = { pairs: [{ name: 'Foo', miniapp: 'a/Foo.tsx', rn: 'b/Foo.tsx' }] }
      const same = audit(p, { 'a/Foo.tsx': 'w-[72rpx]\n', 'b/Foo.tsx': 'w-[36px]\n' }, {})
      const diff = audit(p, { 'a/Foo.tsx': 'w-[72rpx]\n', 'b/Foo.tsx': 'w-[44px]\n' }, {})
      return same.red.length === 0 && diff.red.length === 1
    })(),
  )
  t(
    'S15 两面旗同给 ⇒ 判死',
    (() => {
      try {
        faceFromArgv(['--staged', '--worktree'])
        return false
      } catch (e) {
        return e instanceof Undetermined
      }
    })(),
  )
  t(
    'S16 工作树档被拒(本门拒绝按磁盘判,防错数写回台账)',
    (() => {
      try {
        faceFromArgv(['--worktree'])
        return false
      } catch (e) {
        return e instanceof Undetermined
      }
    })(),
  )
  t(
    'S17 圆角不进几何档集合(它有独立的 RD 维与独立锚点,混计会让同一处双计)',
    readGeometry('rounded-[99px]\nborderRadius: 99\n', 'rn').values.size === 0,
  )
  /**
   * S18–S20 是 RD 维的**成对正反例**。它们存在的理由:本门立项时圆角被整族排除,而注释把
   * 这一 exclusion 说成"守门 77 会管"—— 前提不成立(77 判值的源头,不判同一元素跨端取档),
   * 于是这一型缺陷一路报绿直到用户实拍。只加判据不加"判据有牙"的正反例,下次换个写法它照样瞎。
   */
  t(
    'S18 RD 维:同一档两种写法(类名 vs rnRadius 标识符)必须判同值,不得造出假分叉',
    (() => {
      const tbl = { xs: 2, sm: 4, md: 6, lg: 8, xl: 12, '2xl': 16 }
      const p = { pairs: [{ name: 'Foo', miniapp: 'a/Foo.tsx', rn: 'b/Foo.tsx' }] }
      const same = audit(p, { 'a/Foo.tsx': 'className="rounded-lg"\n' }, {}, {}, tbl)
      const same2 = audit(
        { pairs: p.pairs },
        {
          'a/Foo.tsx': 'className="rounded-lg"\n',
          'b/Foo.tsx': 'borderRadius: rnRadius.lg,\n',
        },
        {},
        {},
        tbl,
      )
      const off = audit(
        { pairs: p.pairs },
        {
          'a/Foo.tsx': 'className="rounded-lg"\n',
          'b/Foo.tsx': 'borderRadius: rnRadius.xl,\n',
        },
        {},
        {},
        tbl,
      )
      return (
        radiusCount(off.findings[0]) === 2 &&
        off.red.length === 1 &&
        off.red[0].over.join('').includes('圆角') &&
        same2.findings.length === 0 &&
        (same.findings.length === 0 || radiusCount(same.findings[0]) === 0)
      )
    })(),
  )
  /**
   * S19 的规格在 2026-09-29 被 O81 票㊵ 整个反过来:那一族标记的**放行**语义已废除(项目定档
   * 「不允许任何豁免」,判红住在守门 77、报名住在守门 150),本门因此必须**不认这个标记**。
   * 照抄旧断言"带标记不得造出分叉",等于把一条已废除的出口重新装回判据。
   * 有牙证明仍成对给:带标记与不带标记必须**同判**(标记不改变任何结论),而这一对必须真计上
   * 档差 —— 否则"不放行"与"判据失明"在账面上长得一模一样。
   */
  t(
    'S19 RD 维:radius-exempt 不构成放行(该族放行语义已由 O81 票㊵ 整体废除)⇒ 带标记与不带标记必须同判、且都判红',
    (() => {
      const tbl = { xs: 2, sm: 4, md: 6, lg: 8, xl: 12, '2xl': 16 }
      const p = { pairs: [{ name: 'Foo', miniapp: 'a/Foo.tsx', rn: 'b/Foo.tsx' }] }
      const withMark = audit(
        p,
        {
          'a/Foo.tsx': 'borderRadius: 8, // radius-exempt: 选中圆点\n',
          'b/Foo.tsx': 'borderRadius: 20, // radius-exempt: 头像正圆\n',
        },
        {},
        {},
        tbl,
      )
      // 反向对照:把标记去掉,同一对必须判红 —— 否则"豁免生效"与"判据失明"长得一模一样
      const noMark = audit(
        p,
        {
          'a/Foo.tsx': 'borderRadius: 8,\n',
          'b/Foo.tsx': 'borderRadius: 20,\n',
        },
        {},
        {},
        tbl,
      )
      const shape = (r) => JSON.stringify((r.findings ?? []).map((f) => [f.name, f.radius]))
      return (
        shape(withMark) === shape(noMark) &&
        withMark.findings.length === 1 &&
        withMark.red.length === 1 &&
        noMark.red.length === 1
      )
    })(),
  )
  t(
    'S20 RD 维:档位表解析不出来 ⇒ radiusLookup 返回 null(collect 据此判失明,不得当成"两端同档")',
    radiusLookup !== undefined && radiusLookup('export const NOTHING = {}') === null,
  )
  /**
   * S21 锚点分家的**全部价值**就在这条:合成一个数时,"改坏一处圆角 + 修好一处几何"净零 ⇒ 逃逸。
   * 分家后同一笔改动必须仍被圆角维钉红。正反两例成对给,否则这条断言只是在对实现复述。
   */
  t(
    'S21 RD 锚点独立:几何下调不得替圆角上升顶掉名额(净零逃逸必须仍判红)',
    (() => {
      const f = {
        name: 'Foo',
        named: [],
        geometry: { onlyMiniapp: [], onlyRn: [] },
        radius: { onlyMiniapp: [8], onlyRn: [12] },
      }
      // 台账钉:几何 5(现降到 0)、圆角 0(现升到 2)—— 总数 2 < 5,合成一维就绿了
      const v = verdictOf([f], { counts: { Foo: 5 }, radiusCounts: { Foo: 0 } })
      const okRed = v.red.length === 1 && v.red[0].over.join('').includes('圆角')
      // 反向对照:圆角存量本来就钉在 2 时不得判红(存量不是新账)
      const okStock =
        verdictOf([f], { counts: { Foo: 5 }, radiusCounts: { Foo: 2 } }).red.length === 0
      return okRed && okStock
    })(),
  )
  /**
   * RE 维的成对正反例。存在的理由是一条实测读数:真仓 HEAD 上 RD 报了 10 对"圆角跨端不同档",
   * 而按元素名配对去查,**一对都不成立** —— `NavBar` 的「仅小程序 4」对面那一侧根本没有圆角声明,
   * `VideoPlayer` 的「仅 RN 8」小程序侧同理。集合之差把"对面没写"说成"两端不一样",
   * 照着它补数字就制造视觉回归。下面 ①–④ 钉的是 RE 只能按**同名元素**产出结论。
   */
  t(
    '㊵ RE①:同名元素两端同档(两种书写语言)必须判绿,不得因写法不同造出分叉',
    (() => {
      const tbl = { xs: 2, sm: 4, md: 6, lg: 8, xl: 12, '2xl': 16 }
      const p = { pairs: [{ name: 'Foo', miniapp: 'a/Foo.tsx', rn: 'b/Foo.tsx' }] }
      // 小程序侧走 CSS 类、RN 侧走 StyleSheet 键 —— 同名 `card` 都是 lg(8)
      const r = audit(
        p,
        {
          'a/Foo.tsx': '.card {\n  border-radius: var(--radius-lg);\n}\n',
          'b/Foo.tsx': 'const s = {\n  card: {\n    borderRadius: rnRadius.lg,\n  },\n}\n',
        },
        {},
        {},
        tbl,
      )
      const f = r.findings[0]
      return (
        r.red.length === 0 &&
        (!f || f.elementRadius.mismatched.length === 0) &&
        elementRadiusCount(f ?? { elementRadius: { mismatched: [] } }) === 0
      )
    })(),
  )
  t(
    '㊶ RE②:同名元素两端差一档必须判红,且红要能单独归因到 RE 这一维(锚点缺省 0 ⇒ 新增直接问责)',
    (() => {
      const tbl = { xs: 2, sm: 4, md: 6, lg: 8, xl: 12, '2xl': 16 }
      const p = { pairs: [{ name: 'Foo', miniapp: 'a/Foo.tsx', rn: 'b/Foo.tsx' }] }
      const src = (mpPx, rnStep) => ({
        'a/Foo.tsx': `.card {\n  border-radius: ${mpPx};\n}\n`,
        'b/Foo.tsx': `const s = {\n  card: {\n    borderRadius: rnRadius.${rnStep},\n  },\n}\n`,
      })
      const r = audit(p, src('8px', 'xl'), {}, {}, tbl)
      const f = r.findings[0]
      return (
        r.red.length === 1 &&
        elementRadiusCount(f) === 1 &&
        f.elementRadius.mismatched[0].name === 'card' &&
        String(f.elementRadius.mismatched[0].miniapp) === '8' &&
        String(f.elementRadius.mismatched[0].rn) === '12' &&
        r.red[0].over.join('').includes('同名元素圆角 1 > 锚点 0') &&
        // 反向对照:三维各自钉在存量上时不得判红(存量不是新账)
        audit(
          p,
          src('8px', 'xl'),
          { counts: { Foo: 2 }, radiusCounts: { Foo: 2 }, elementRadiusCounts: { Foo: 1 } },
          {},
          tbl,
        ).red.length === 0
      )
    })(),
  )
  /**
   * ㊷ 是这一票的**核心对照**:同一份输入,RE 判"无从配对"并报名字,RD 判"跨端不同档"。
   * 两侧从未同名 ⇒ 不存在"同一个元素长得不一样"这件事;而集合之差照样产出读数。
   * 断言若写成"findings 为空"就是在骗自己 —— RD 仍然会推一条,那正是它一直在产的假信号。
   */
  t(
    '㊷ RE③:一侧有名字、另一侧没有 ⇒ RE 不计红但逐条报名(同输入下 RD 仍报分叉 = 假信号来源)',
    (() => {
      const tbl = { xs: 2, sm: 4, md: 6, lg: 8, xl: 12, '2xl': 16 }
      const p = { pairs: [{ name: 'Foo', miniapp: 'a/Foo.tsx', rn: 'b/Foo.tsx' }] }
      const r = audit(
        p,
        {
          // 小程序侧只写 utility 串:没有元素名可归 ⇒ 不得与 RN 的 `card` 配对
          'a/Foo.tsx': '<View className="rounded-lg" />\n',
          'b/Foo.tsx': 'const s = {\n  card: {\n    borderRadius: rnRadius.xl,\n  },\n}\n',
        },
        {},
        {},
        tbl,
      )
      const u = r.radiusUnpaired[0]
      const f = r.findings[0]
      return (
        // RE 这一维:零分叉
        elementRadiusCount(f) === 0 &&
        !r.red[0].over.join('').includes('同名元素圆角') &&
        // RD 这一维:照样报出"两端不同档" —— 这就是 NavBar / VideoPlayer 那两条读数的成因
        radiusCount(f) === 2 &&
        r.red[0].over.join('').includes('圆角 2 > 锚点 0') &&
        // 而报名字让这一格变得可处置:对面根本没起元素名,该修的是命名而不是数字
        u?.name === 'Foo' &&
        u.onlyRn.join() === 'card' &&
        u.onlyMiniapp.join() === '' &&
        u.unnamed.miniapp === 1
      )
    })(),
  )
  t(
    '㊸ RE④:注释里的档不得计入、同一形态写进代码必须计入(成对,否则不知哪边在说谎)',
    (() => {
      const tbl = { xs: 2, sm: 4, md: 6, lg: 8, xl: 12, '2xl': 16 }
      // 注释里写着 rounded-xl(12)而代码取 lg(8):计入就会与 RN 的 lg 造出一档假分叉
      const commentIgnored = radiusEntriesOf(
        '.card {\n  // 原写 rounded-xl,现按规范收口到 lg\n  border-radius: var(--radius-lg);\n}\n',
        tbl,
      )
      // 反向对照:同一形态从注释搬进代码(utility 串 + 本文件真定义过的类名)必须被读到
      const codeCounted = radiusEntriesOf(
        '.card {\n  padding: 2px;\n}\n<View className="card rounded-xl" />',
        tbl,
      )
      // 整块被注释掉的规则:类名与档都不能进射程(凭空多出一个"具名元素"就是凭空多一对可红)
      const commentedRule = radiusEntriesOf(
        '/* .ghost {\n  border-radius: var(--radius-2xl);\n} */\n',
        tbl,
      )
      return (
        String(commentIgnored.entries.card) === '8' &&
        String(codeCounted.entries.card) === '12' &&
        Object.keys(commentedRule.entries).length === 0 &&
        commentedRule.unnamed === 0
      )
    })(),
  )
  t(
    '㊹ RE 锚点第三家:RD 下调不得替 RE 上升顶掉名额(三维合一就是净零逃逸的入口)',
    (() => {
      const f = {
        name: 'Foo',
        named: [],
        geometry: { onlyMiniapp: [], onlyRn: [] },
        radius: { onlyMiniapp: [], onlyRn: [] },
        elementRadius: { mismatched: [{ name: 'card', miniapp: [8], rn: [12] }] },
      }
      const v = verdictOf([f], {
        counts: { Foo: 4 },
        radiusCounts: { Foo: 3 },
        elementRadiusCounts: { Foo: 0 },
      })
      return (
        v.red.length === 1 &&
        v.red[0].over.join('').includes('同名元素圆角 1 > 锚点 0') &&
        verdictOf([f], {
          counts: { Foo: 4 },
          radiusCounts: { Foo: 3 },
          elementRadiusCounts: { Foo: 1 },
        }).red.length === 0
      )
    })(),
  )
  t(
    '㊺ 重出台账必须拒绝"任一既有锚点上升或消失",只允许下降(覆盖面一放宽就是一次无声放松)',
    (() => {
      const prior = {
        counts: { A: 2 },
        radiusCounts: { A: 1 },
        elementRadiusCounts: { A: 0 },
      }
      const rose = anchorRegression(prior, {
        counts: { A: 3 },
        radiusCounts: { A: 1 },
        elementRadiusCounts: { A: 0 },
      })
      const gone = anchorRegression(prior, { counts: {}, radiusCounts: { A: 1 } })
      const fell = anchorRegression(prior, {
        counts: { A: 1 },
        radiusCounts: { A: 0 },
        elementRadiusCounts: { A: 0 },
      })
      // 新组件首次入账(锚点从缺省 0 起)不算上升 —— 否则任何新增配对都堵住重锚
      const fresh = anchorRegression(prior, {
        counts: { A: 2 },
        radiusCounts: { A: 1 },
        elementRadiusCounts: { A: 0, B: 0 },
      })
      // 两把锚点同时缺键(counts 与 elementRadiusCounts),radiusCounts 那维仍在 ⇒ 恰 2 条
      return (
        rose.length === 1 &&
        rose[0].includes('counts.A') &&
        gone.length === 2 &&
        gone.every((x) => x.includes('整键消失')) &&
        fell.length === 0 &&
        fresh.length === 0
      )
    })(),
  )
  /**
   * S22 是票"排除几何档"的**成对正反例**(Step 5 要求的"匹配对"):同一份夹具,只在第二腿多一处取用 ——
   *  - NEG:那一处是 `width: 20, height: 20, borderRadius: 10`(边长的一半 = 真圆,§4 规定的写法)
   *        ⇒ RD 维**不得**把它当成端上多出来的一档;否则门 77 认定为"规范真圆"的每一处都会在这一维
   *          凭空记一笔,而另一端根本没有对应元素 ⇒ 假分叉(实测 UserInfoCard 头像 24、ModelList check 10)。
   *  - POS:把它换成 `rnRadius.xl`(12, 同值档位但**是档位取用**)⇒ 必须**仍判红**,
   *        且红在 RD 这一维(over 含"圆角")。
   * 两条一红一绿才算"排除的是形状、没顺手把维度改瞎"。只留 NEG 就是替"判据失明"发合格证。
   */
  t(
    'S22 RD 成对:co-located size/2 真圆不得计入档集(NEG 圆角 0 档、无圆角红),换成同位 rnRadius.xl 档必须仍红(POS)',
    (() => {
      const tbl = { xs: 2, sm: 4, md: 6, lg: 8, xl: 12, '2xl': 16 }
      const p = { pairs: [{ name: 'Foo', miniapp: 'a/Foo.tsx', rn: 'b/Foo.tsx' }] }
      // 两腿都有 card=lg(8);差异只在第二腿那"一处"的写法(同 20×20 盒)。
      const aBase = 'card: { borderRadius: rnRadius.lg },\n'
      const neg = audit(
        p,
        {
          'a/Foo.tsx': aBase,
          'b/Foo.tsx': aBase + 'dot: { width: 20, height: 20, borderRadius: 10 },\n',
        },
        {},
        {},
        tbl,
      )
      const pos = audit(
        p,
        {
          'a/Foo.tsx': aBase,
          'b/Foo.tsx': aBase + 'chip: { width: 20, height: 20, borderRadius: rnRadius.xl },\n',
        },
        {},
        {},
        tbl,
      )
      const overMentions = (v, kw) => v.red.some((r) => (r.over || []).join('').includes(kw))
      return (
        // NEG:圆角被排除 ⇒ 圆角一维 0 档、无"圆角"红(几何那处 20×20 仍成 finding 是另一维,不冲突)
        radiusCount(neg.findings[0]) === 0 &&
        !overMentions(neg, '圆角') &&
        // POS:同位真档 ⇒ 圆角计 1 处差且红在圆角维
        radiusCount(pos.findings[0]) === 1 &&
        overMentions(pos, '圆角')
      )
    })(),
  )
  /**
   * S23 是 anchorRegression 豁免短路的**成套正反例**(缩小假阳,不动真保护):
   *  - 未豁免族上升 ⇒ 必拒(与改动前逐字同形;这条是本核对存在的全部理由,绝不能被豁免短路连带放宽)。
   *  - 带**有效**豁免(prior.waivers 里理由足 6 字)的族上升 ⇒ 放行(它在 verdictOf 里本就 continue,
   *    锚点是惰性记账)。
   *  - 理由不足(waiverProblem 非空)的"豁免" ⇒ 不短路 ⇒ 仍拒 —— 否则填个空理由就能给放松开门。
   *  - 同族的**下降**在未豁免时也照旧放行(单调性只拦上升/消失)。
   */
  t(
    'S23 anchorRegression 豁免短路只缩假阳:未豁免上升必拒、有效豁免上升放行、空理由豁免仍拒、下降恒放行',
    (() => {
      const priorW = {
        counts: { A: 1 },
        radiusCounts: { A: 1 },
        elementRadiusCounts: { A: 0 },
        waivers: { A: { reason: '两端不是同一套子元素', until: '2027-01-01' } },
      }
      // A 已带有效豁免 ⇒ counts/radiusCounts 两维上升都应放行(elementRadius 持平本就不拦)
      const rose2 = { counts: { A: 5 }, radiusCounts: { A: 4 }, elementRadiusCounts: { A: 0 } }
      const waivedRose = anchorRegression(priorW, rose2)
      // 把豁免理由改成不足 6 字 ⇒ 短路失效 ⇒ 两条上升全部回来(与未豁免同形)
      const badWaiver = {
        ...priorW,
        waivers: { A: { reason: '短', until: '2027-01-01' } },
      }
      const badRose = anchorRegression(badWaiver, rose2)
      // 完全没有 waivers 字段(未豁免)⇒ 与旧行为逐字一致,两条上升都拒
      const noWaiver = {
        counts: { A: 1 },
        radiusCounts: { A: 1 },
        elementRadiusCounts: { A: 0 },
      }
      const rose = anchorRegression(noWaiver, rose2)
      // 有效豁免族的**下降**也放行(单调性只拦上升/消失,这里本就是下降)
      const fell = anchorRegression(priorW, {
        counts: { A: 0 },
        radiusCounts: { A: 0 },
        elementRadiusCounts: { A: 0 },
      })
      // 未豁免族的**下降**恒放行(保护不变:下降不是放松)
      const fellUnwaived = anchorRegression(noWaiver, {
        counts: { A: 0 },
        radiusCounts: { A: 0 },
        elementRadiusCounts: { A: 0 },
      })
      return (
        waivedRose.length === 0 &&
        badRose.length === 2 &&
        badRose.every((x) => x.includes('上升')) &&
        rose.length === 2 &&
        fell.length === 0 &&
        fellUnwaived.length === 0
      )
    })(),
  )
  t(
    '㊼ 方向与角形态必须与整格形态同判 —— 漏读一侧不表现为"少几个数",表现为凭空造出跨端分叉',
    (() => {
      const tbl = { xs: 2, sm: 4, md: 6, lg: 8, xl: 12, '2xl': 16 }
      // 小程序底部弹层的写法(只圆上两角)
      const side = radiusSetOf('<View className="relative bg-card rounded-t-2xl" />', tbl)
      const corner = radiusSetOf('<View className="bg-cta rounded-tr-sm" />', tbl)
      // 整格形态不得被新的可选前缀打坏(反向对照:同一档、不同写法 ⇒ 集合必须仍等值)
      const whole = radiusSetOf('<View className="rounded-2xl" />', tbl)
      const rnSide = radiusSetOf('style={{ borderRadius: rnRadius["2xl"] }}', tbl)
      // rounded-full 属守门 11 的胶囊那一型,不得被这一维计成"取了某档"
      const full = radiusSetOf('<View className="rounded-full" />', tbl)
      return (
        side.join(',') === '16' &&
        corner.join(',') === '4' &&
        whole.join(',') === '16' &&
        rnSide.join(',') === '16' &&
        diffValues(new Set(side), new Set(rnSide)).onlyMiniapp.length === 0 &&
        diffValues(new Set(side), new Set(rnSide)).onlyRn.length === 0 &&
        full.length === 0
      )
    })(),
  )
  t(
    'RD 遮噪必须与 RE 同一条口径 —— 注释散文里的档位不得算进档集(真仓 LoginPopUp 的假分叉就是这么造出来的)',
    (() => {
      const tbl = { xs: 2, sm: 4, md: 6, lg: 8, xl: 12, '2xl': 16 }
      // ① 行尾注释:同一行代码取 sm(4),注释里提 rounded-md(6) 不得被记上
      const trailing = radiusSetOf(
        '  pill: { borderRadius: rnRadius.sm, // 旧写法 rounded-md,现取 control 档\n}',
        tbl,
      )
      // ② 跨行块注释的**续行**:旧实现只跳"以 /* 或 * 开头的整行",续行里的档会漏进来
      const block = radiusSetOf(
        '<View\n  {/* 弹窗主体 = panel 档\n      旧写法在这里挂 rounded-md 并按 bubble 档取 rounded-2xl */}\n  className="rounded-xl" />',
        tbl,
      )
      // ③ 阳性对照:同一个 6 写在真代码里必须被记上(遮罩关掉的是误报,不是判据)
      const real = radiusSetOf('<View className="rounded-md" />', tbl)
      return (
        trailing.join(',') === '4' &&
        block.join(',') === '12' &&
        real.join(',') === '6' &&
        // 反向锁:把注释里的 6 算进去就是这一型的病灶,读数必须与"真取 6"不同形
        trailing.join(',') !== real.join(',')
      )
    })(),
  )
  t(
    'RE 配对键:BEM 结构分隔符可折(证据),缩写前缀不可折(猜测);折叠撞车时必须**不配对**而不是并档',
    (() => {
      const tbl = { xs: 2, sm: 4, md: 6, lg: 8, xl: 12, '2xl': 16 }
      const mp = radiusEntriesOf(
        [
          '.cb__item { border-radius: 12rpx }',
          '.cb__free-badge { border-radius: 16rpx }',
          '.cb__panel--active { border-radius: 8rpx }',
          '.mcd-upload-btn { border-radius: 8rpx }',
        ].join('\n'),
        tbl,
      ).entries
      const rn = radiusEntriesOf(
        [
          'const s = {',
          '  item: { borderRadius: rnRadius.xl },',
          '  freeBadge: { borderRadius: rnRadius.lg },',
          '  panel: { borderRadius: rnRadius.md },',
          '  uploadBtn: { borderRadius: rnRadius.lg },',
          '}',
        ].join('\n'),
        tbl,
      ).entries
      const d = elementRadiusDiff(mp, rn)
      // 名可以是字符串(单侧名单)或 {name,…}(分叉记录)—— 判据取名字那一层,
      // 否则 `/x/.test({...})` 会把对象强转成 "[object Object]",四条子断言全部**永不命中**
      // 而账面看起来"跑过了"(§22c:恒绿断言与恒红断言同样没用)。
      const namesOf = (list) => (list || []).map((x) => (typeof x === 'string' ? x : x.name))
      const has = (list, re) => namesOf(list).some((n) => re.test(n))
      // ① BEM `__` 是命名法规定的元素分隔符:cb__item ↔ item 必须配上,且真分叉要被抓到
      const paired = has(d.mismatched, /^cb__item\|item$/) && d.mismatched.length >= 1
      // ② 大小写 + 连字符折叠:`free-badge` ↔ `freeBadge` 同值 ⇒ 既不进 mismatched 也不进单侧名单
      const folded =
        !has(d.mismatched, /freebadge|free-badge/i) &&
        !has(d.onlyMiniapp, /free-badge/) &&
        !has(d.onlyRn, /freeBadge/)
      // ③ 修饰符不参与身份:panel--active ↔ panel 必须配上(md=6 vs lg=8 ⇒ 应报分叉)
      const modifier = has(d.mismatched, /panel/)
      // ④ 缩写前缀**不折**(票面明令:那是猜测)⇒ 两边都只能算单侧元素
      const notGuessed = has(d.onlyMiniapp, /mcd-upload-btn/) && has(d.onlyRn, /uploadBtn/)
      // ⑤ 反向锁:同一侧两个原始名折叠到同一身份时**不得配对**(并档会造"同值"假绿灯)
      const collide = elementRadiusDiff({ a__card: [8], b__card: [12] }, { card: [8] })
      const guarded =
        collide.mismatched.length === 0 &&
        collide.onlyRn.includes('card') &&
        collide.ambiguous.includes('card')
      return paired && folded && modifier && notGuessed && guarded
    })(),
  )
  t(
    '(函数在、自检过,而 audit 没调 = 提交链上一路绿灯,本仓最高频失效型)',
    (() => {
      const body = readFileSync(fileURLToPath(import.meta.url), 'utf8')
      const a = body.slice(
        body.indexOf('export function audit('),
        body.indexOf('export function verdictOf('),
      )
      // 判据写在别处不等于没装车,但写在别处的这一维就再也回不到 audit —— 本锁要求它必须在。
      return (
        /radiusEntriesOf\(aAll/.test(a) &&
        /radiusEntriesOf\(bAll/.test(a) &&
        /elementRadiusDiff\(erA\.entries, erB\.entries\)/.test(a) &&
        /elementRadiusCount\(f\)/.test(
          body.slice(
            body.indexOf('export function verdictOf('),
            body.indexOf('export function emitBaseline('),
          ),
        ) &&
        /elementRadiusCounts\[f\.name\] = elementRadiusCount\(f\)/.test(
          body.slice(
            body.indexOf('export function emitBaseline('),
            body.indexOf('export function parseBaseline('),
          ),
        ) &&
        // RE 的红必须折进退出码:它挂在 res.red 上,所以 red 那条求和行必须在
        /if \(aliasRed\) return 1/.test(body) &&
        /return rotRed \+ res\.red\.length/.test(body)
      )
    })(),
  )
  t(
    'S18 RN 同名多命中 ⇒ 取排序靠前的层(共享层优先)',
    scan(['a/X.tsx'], ['p1/X.tsx', 'p2/X.tsx']).pairs[0].rn === 'p1/X.tsx',
  )
  t(
    'S19 台账坏 JSON ⇒ 判死,不得当"没有豁免"蒙过',
    (() => {
      try {
        parseBaseline('{坏 json', 'ledger')
        return false
      } catch (e) {
        return e instanceof Undetermined
      }
    })(),
  )
  t(
    '㉑ 路由表读页:顶层 pages 不带 root、subPackages 的页必须带自己的 root',
    (() => {
      const { pages, unresolved } = readTaroPages(
        "export default defineAppConfig({\n  pages: ['pages/index/index'],\n  subPackages: [{ root: 'pkg-ai', pages: ['ai/chat', `dyn/${x}`] }]\n})\n",
        'apps/miniapp-taro/src',
      )
      return (
        pages.join('|') ===
          'apps/miniapp-taro/src/pages/index/index|apps/miniapp-taro/src/pkg-ai/ai/chat' &&
        unresolved.length === 1
      )
    })(),
  )
  t(
    '㉒ import 子句:具名导入按名路由,默认/命名空间/混用一律整模块(不得少算可达)',
    (() => {
      const names = clauseDemand('{ A, B as C }')
      return (
        JSON.stringify(names) === '["A","B"]' &&
        clauseDemand('Foo, { A }') === null &&
        clauseDemand('* as ns') === null &&
        clauseDemand('') === null
      )
    })(),
  )
  t(
    '㉓ type-only 边不成腿(import type / export type 都不算)',
    (() => {
      const { edges } = parseModuleEdges(
        "import type { A } from './a'\nexport type { B } from './b'\nexport { C } from './c'\n",
      )
      return edges.length === 1 && edges[0].spec === './c'
    })(),
  )
  t(
    '㉔ 阳性对照:被桶文件再导出、但从端入口不可达的副本必须被剔除(真临时 git 仓端到端)',
    (() => {
      const dir = makeFixtureRepo(
        FIXTURE_BASE({
          rn: "import { Bar } from '@ihui/rn-app'\nexport function RootNavigator() { return null }\n",
        }),
      )
      try {
        const r = collect(dir, 'head')
        return (
          r.pairs.pairs.length === 0 &&
          r.unreachableLegs.length === 1 &&
          r.unreachableLegs[0].name === 'Foo' &&
          r.unreachableLegs[0].legs.join('|') === 'packages/app/src/components/Foo.tsx' &&
          /从端入口不可达/.test(r.unreachableLegs[0].reason)
        )
      } catch (e) {
        return `抛错:${e?.message ?? e}`
      } finally {
        rmScratch(dir)
      }
    })(),
    '真仓可达性判据在临时仓上没跑通',
  )
  t(
    '㉕ 反向对照:同一组件改成从端入口链上 import ⇒ 必须留在配对里(证明 ㉔ 的红不是恒红)',
    (() => {
      const dir = makeFixtureRepo(
        FIXTURE_BASE({
          rn: "import { Bar, Foo } from '@ihui/rn-app'\nexport function RootNavigator() { return null }\n",
        }),
      )
      try {
        const r = collect(dir, 'head')
        return (
          r.unreachableLegs.length === 0 &&
          r.pairs.pairs.length === 1 &&
          r.pairs.pairs[0].rn === 'packages/app/src/components/Foo.tsx'
        )
      } catch (e) {
        return `抛错:${e?.message ?? e}`
      } finally {
        rmScratch(dir)
      }
    })(),
  )
  t(
    '㉖ 解析不到的路径走"未判定",绝不当"不可达"把组件剔掉(成对:与 ㉕ 唯一差别是多一条坏 import)',
    (() => {
      const dir = makeFixtureRepo(
        FIXTURE_BASE({
          rn: "import { Bar, Foo } from '@ihui/rn-app'\nimport { Gone } from './gen/missing'\nexport function RootNavigator() { return null }\n",
        }),
      )
      try {
        const r = collect(dir, 'head')
        const hit = r.undeterminedEdges.some(
          (u) => /missing/.test(u.spec) && !/不存在/.test(u.reason),
        )
        return r.unreachableLegs.length === 0 && r.pairs.pairs.length === 1 && hit
      } catch (e) {
        return `抛错:${e?.message ?? e}`
      } finally {
        rmScratch(dir)
      }
    })(),
  )
  t(
    '㉗ 逃生口:--pair-all 档退回"同名即配对"(人工核对用,默认档才是可达性判据)',
    (() => {
      const dir = makeFixtureRepo(
        FIXTURE_BASE({
          rn: "import { Bar } from '@ihui/rn-app'\nexport function RootNavigator() { return null }\n",
        }),
      )
      try {
        return collect(dir, 'head', { pairAll: true }).pairs.pairs.length === 1
      } catch (e) {
        return `抛错:${e?.message ?? e}`
      } finally {
        rmScratch(dir)
      }
    })(),
  )
  t(
    '㉗b web 腿阳性对照:web 侧同名件没人用 ⇒ web 配对必须按"从web端入口不可达"剔除(真临时 git 仓)',
    (() => {
      const fx = {
        ...FIXTURE_BASE({
          rn: "import { Bar, Foo } from '@ihui/rn-app'\nexport function RootNavigator() { return null }\n",
        }),
        // web 入口(page)不 import 任何组件 ⇒ web 侧 Foo 是死副本;miniapp 侧活着。
        'apps/web/app/page.tsx':
          "export default function P() { return <div className='rounded-sm' /> }\n",
        'apps/web/src/components/Foo.tsx':
          'export function Foo() { return <div className="rounded-md" /> }\n',
      }
      // 档位表必须随夹具走:collect 对"表取不到而组件在用圆角"判失明(同 KW 注)。
      fx['packages/design-tokens/src/radius.js'] = radiusFixtureTable()
      const dir = makeFixtureRepo(fx)
      try {
        const r = collect(dir, 'head')
        return (
          r.webUnreachableLegs.length === 1 &&
          r.webUnreachableLegs[0].name === 'Foo' &&
          r.webUnreachableLegs[0].legs.join('|') === 'apps/web/src/components/Foo.tsx' &&
          /从web端入口不可达/.test(r.webUnreachableLegs[0].reason) &&
          r.webPairs.length === 0
        )
      } catch (e) {
        return `抛错:${e?.message ?? e}`
      } finally {
        rmScratch(dir)
      }
    })(),
    '真仓 web 腿可达性判据在临时仓上没跑通',
  )
  t(
    '㉗c 反向对照:同一 web 组件被入口链上 import ⇒ web 配对必须保留(证明 ㉗b 的红不是恒红)',
    (() => {
      const fx = {
        ...FIXTURE_BASE({
          rn: "import { Bar, Foo } from '@ihui/rn-app'\nexport function RootNavigator() { return null }\n",
        }),
        'apps/web/app/page.tsx':
          "import { Foo } from '@/components/Foo'\nexport default function P() { return <Foo /> }\n",
        'apps/web/src/components/Foo.tsx':
          'export function Foo() { return <div className="rounded-md" /> }\n',
      }
      fx['packages/design-tokens/src/radius.js'] = radiusFixtureTable()
      const dir = makeFixtureRepo(fx)
      try {
        const r = collect(dir, 'head')
        return (
          r.webUnreachableLegs.length === 0 &&
          r.webPairs.length === 1 &&
          r.webPairs[0].name === 'Foo' &&
          r.webPairs[0].rn === 'apps/web/src/components/Foo.tsx'
        )
      } catch (e) {
        return `抛错:${e?.message ?? e}`
      } finally {
        rmScratch(dir)
      }
    })(),
  )
  t(
    '㉗d web 可达性挂起不得静默:夹具没有 web 种子 ⇒ 挂起留痕,web 配对不被误剔也不装"已确认活着"',
    (() => {
      const dir = makeFixtureRepo(
        FIXTURE_BASE({
          rn: "import { Bar, Foo } from '@ihui/rn-app'\nexport function RootNavigator() { return null }\n",
        }),
      )
      try {
        const r = collect(dir, 'head')
        return (
          typeof r.webReachNote === 'string' &&
          /web/.test(r.webReachNote) &&
          r.webUnreachableLegs.length === 0
        )
      } catch (e) {
        return `抛错:${e?.message ?? e}`
      } finally {
        rmScratch(dir)
      }
    })(),
  )
  t(
    '㉘ IC:字形名解析 —— lucide 导入按 PascalCase→kebab,小程序按 LineIcon name,两者可逐名比',
    (() => {
      const rn = iconGlyphs("import { ChevronLeft, Mic as MicIcon } from 'lucide-react-native'\n")
      const mp = iconGlyphs(
        'import LineIcon from "@/components/LineIcon"\n<LineIcon name="chevron-left" size={24} />\n',
      )
      return rn.vector.join(',') === 'chevron-left,mic' && mp.vector.join(',') === 'chevron-left'
    })(),
  )
  t(
    '㉙ IC:CDN 位图当 UI 图标必须计数;带原因的逐行豁免把它抵消(成对对照,证明豁免不是恒放)',
    (() => {
      const pairs = { pairs: [{ name: 'X', miniapp: 'm', rn: 'r' }] }
      const rnSrc = "import { Send } from 'lucide-react-native'\n"
      const bare = iconAudit(pairs, {
        m: 'const a = aizhsUrl("remote-images/send.png")\n<LineIcon name="send" />\n',
        r: rnSrc,
      })
      const withEx = iconAudit(pairs, {
        m: 'const a = aizhsUrl("remote-images/send.png") // icon-bitmap-exempt: 多色品牌插画\n<LineIcon name="send" />\n',
        r: rnSrc,
      })
      return bare.length === 1 && bare[0].bitmap === 1 && withEx.length === 0
    })(),
  )
  t(
    '㉙b RN 侧位图载体必须同样计数(旧尺子只认小程序的 aizhsUrl 形态 ⇒ "RN 仍用位图"整型隐身)',
    (() => {
      const pairs = { pairs: [{ name: 'X', miniapp: 'm', rn: 'r' }] }
      const mpVec = 'import LineIcon from "@/components/LineIcon"\n<LineIcon name="send" />\n'
      const rnBmp = iconAudit(pairs, {
        m: mpVec,
        r: 'const ICON_SEND = `${cdnHost}/icons/send.png`\n<Image source={{ uri: ICON_SEND }} />\n',
      })
      const rnEx = iconAudit(pairs, {
        m: mpVec,
        r: 'const ICON_SEND = `${cdnHost}/icons/send.png` // icon-bitmap-exempt: 多色插画\n',
      })
      return rnBmp[0].rnBitmap === 1 && rnEx[0].rnBitmap === 0
    })(),
  )
  t(
    '㉙c 两端拿同一字形都走位图 ⇒ 必须点名(一致但都没矢量化,过去完全看不见)',
    (() => {
      const pairs = { pairs: [{ name: 'X', miniapp: 'm', rn: 'r' }] }
      const r = iconAudit(pairs, {
        m: 'const a = aizhsUrl("remote-images/camera.png")\n',
        r: 'const ICON_CAMERA = `${cdnHost}/icons/camera.png`\n',
      })
      return r.length === 1 && r[0].bothBitmap.length === 1 && r[0].bothBitmap[0] === 'camera'
    })(),
  )
  t(
    '㉙d 位图判据面必须已剥注释(说明文字里提一句 png 不得造出一处载体)',
    (() => {
      const pairs = { pairs: [{ name: 'X', miniapp: 'm', rn: 'r' }] }
      const r = iconAudit(pairs, {
        m: 'import LineIcon from "@/components/LineIcon"\n',
        r: "// 这里以前是 `${cdnHost}/icons/send.png`,现已换成 lucide Send\nimport { Send } from 'lucide-react-native'\n",
      })
      return r[0].rnBitmap === 0
    })(),
  )
  t(
    '㉚ IC 与几何判据分开跑:几何已同值而字形集合不同形的族,必须仍被 IC 看见',
    (() => {
      const r = iconAudit(
        { pairs: [{ name: 'Y', miniapp: 'm', rn: 'r' }] },
        {
          m: '<LineIcon name="plus" />',
          r: "import { Plus, Camera } from 'lucide-react-native'\n",
        },
      )
      return r.length === 1 && r[0].bitmap === 0 && r[0].onlyRn.join(',') === 'camera'
    })(),
  )
  t(
    '㉛ IC:字形名三种传法(属性字面量 / 配置数组 icon: / 三元 name={})都必须算进矢量化面;未 import LineIcon 不得乱认(成对)',
    (() => {
      const withChannel =
        'import LineIcon from "@/components/LineIcon"\n' +
        'const G = [{ icon: "camera" }]\n' +
        "<LineIcon name={mode === 'voice' ? 'keyboard' : 'mic'} size={20} />\n" +
        '<LineIcon name="send" size={20} />\n'
      const noChannel = 'const G = [{ icon: "camera" }]\n'
      return (
        iconGlyphs(withChannel).vector.join(',') === 'camera,keyboard,mic,send' &&
        iconGlyphs(noChannel).vector.join(',') === ''
      )
    })(),
  )
  /* 票⑥(2026-09-26)读数面四条不对称 + 具名档解析。
     这一组存在的理由:用户实拍"两端还是不一样",而本门一路报绿 —— 查下来不是台账数字错,
     是**读数面本身两侧不同形**:字距被当尺寸、`w-1/3` 被折成 4px、小程序的 `px-3` 不进集合而
     RN 的 `paddingHorizontal: 12` 进集合,以及最要命的一条 —— 数字一旦收编进 shared spec,
     组件里只剩标识符,前面所有数字形态的提取式全部落空,于是"收进单一源"= 从尺子上消失。
     每条都配正反对照(阴性结论必须有阳性对照,否则等于没测)。 */
  t(
    '㉙ letterSpacing 不是尺寸(反面对照:同键名换成 width 必须仍被读)',
    readGeometry('letterSpacing: 0.2\nfoo: 3\n', 'rn').values.size === 0 &&
      readGeometry('letterSpacing: 0.2\nwidth: 300\n', 'rn').values.has(300),
  )
  t(
    '㉚ 分数宽度 w-1/3 不得被折成 4px;同串里的真档 w-8 仍要读到',
    (() => {
      const g = readGeometry('className="w-1/3"\n', 'miniapp')
      const h = readGeometry('className="w-8"\n', 'miniapp')
      return !g.values.has(4) && !g.values.has(1) && h.values.has(32)
    })(),
  )
  t(
    '㉛ 刻度档 px-3 / gap-4 在小程序侧同样进集合(与 RN 的 paddingHorizontal: 12 对形)',
    (() => {
      const g = readGeometry('className="px-3 gap-4"\n', 'miniapp')
      const r = readGeometry('paddingHorizontal: 12\ngap: 16\n', 'rn')
      return (
        g.values.has(12) &&
        g.values.has(16) &&
        !diffValues(g.values, r.values).onlyRn.length &&
        !diffValues(g.values, r.values).onlyMiniapp.length
      )
    })(),
  )
  t(
    '㉜ 具名档:一端写字面量、另一端读同一 spec 档 ⇒ 必须判同值(旧尺子在这里报"仅小程序档 32")',
    (() => {
      const tiers = { BOTTOM_ACTION_BAR_CONTROL_BOX_PX: 32 }
      // 裸数字写在 RN 侧(该端量纲即逻辑 px);小程序侧的裸数字按 rpx 折半,不是本例要证的口径
      const a = readGeometry('width: 32\n', 'rn', tiers)
      const b = readGeometry(
        'import { BOTTOM_ACTION_BAR_CONTROL_BOX_PX } from "spec"\nwidth: toUnit(BOTTOM_ACTION_BAR_CONTROL_BOX_PX)\n',
        'rn',
        tiers,
      )
      const d = diffValues(a.values, b.values)
      return a.values.has(32) && b.values.has(32) && !d.onlyMiniapp.length && !d.onlyRn.length
    })(),
  )
  t(
    '㉝ 具名档有真分叉时必须现形(上一条的阳性对照:同一通道不能只会藏)',
    (() => {
      const tiers = { BOTTOM_ACTION_BAR_CONTROL_BOX_PX: 32, BOTTOM_ACTION_BAR_OTHER_PX: 44 }
      const a = readGeometry('width: BOTTOM_ACTION_BAR_CONTROL_BOX_PX\n', 'miniapp', tiers)
      const b = readGeometry('width: BOTTOM_ACTION_BAR_OTHER_PX\n', 'rn', tiers)
      const d = diffValues(a.values, b.values)
      return d.onlyMiniapp.join() === '32' && d.onlyRn.join() === '44'
    })(),
  )
  t(
    '㉞ geometry 表的档经 rnGeometry.tapBox 取用同样入集合;换算系数 TARO_RPX_PER_PX 不得当档',
    (() => {
      const src = {
        'packages/design-tokens/src/geometry.js':
          'export const GEOMETRY_PX = {\n  tapBox: 36,\n}\nexport const TARO_RPX_PER_PX = 2\n',
      }
      const tiers = specTiers(src)
      const g = readGeometry('const VOICE = rnGeometry.tapBox\nheight: VOICE\n', 'rn', tiers)
      return (
        tiers['geometry.tapBox'] === 36 &&
        tiers['TARO_RPX_PER_PX'] === undefined &&
        g.values.has(36)
      )
    })(),
  )
  t(
    '㉟ spec 档表按被审面取;面枚举不到任何 *-spec.ts ⇒ 判"无法判定",不得记绿',
    (() => {
      const files = { ...FIXTURE_BASE({}) }
      // 夹具默认带一份 spec(见 FIXTURE_BASE);本例要证的正是"没有具名档来源时门必须喊瞎"
      delete files['packages/shared/src/ui/foo-spec.ts']
      const dir = makeFixtureRepo(files)
      try {
        collect(dir, 'head')
        return '未抛 Undetermined'
      } catch (e) {
        return /spec|Undetermined|无法判定/.test(String(e?.message ?? e))
      } finally {
        rmScratch(dir)
      }
    })(),
  )
  t(
    '㊱ spec 档写成几何表的投影(`= GEOMETRY_PX.controlBox`)仍必须解出数值 —— 否则改成投影就等于回到隐身',
    (() => {
      const tiers = specTiers({
        'packages/design-tokens/src/geometry.js':
          'export const GEOMETRY_PX = {\n  controlBox: 32,\n  controlGlyph: 14,\n}\n',
        'packages/shared/src/ui/x-spec.ts':
          "import { GEOMETRY_PX } from '@ihui/design-tokens'\n" +
          'export const X_CONTROL_BOX_PX = GEOMETRY_PX.controlBox\n' +
          'export const X_CONTROL_GLYPH_PX = GEOMETRY_PX.controlGlyph\n',
      })
      const g = readGeometry('width: X_CONTROL_BOX_PX\nsize={X_CONTROL_GLYPH_PX}\n', 'rn', tiers)
      return (
        tiers.X_CONTROL_BOX_PX === 32 &&
        tiers.X_CONTROL_GLYPH_PX === 14 &&
        g.values.has(32) &&
        g.values.has(14)
      )
    })(),
  )
  t(
    '㊲ 投影源在表里取不到(改名 / 删档)⇒ 该具名档不入表,不得凭名字造一个数',
    (() => {
      const tiers = specTiers({
        'packages/design-tokens/src/geometry.js':
          'export const GEOMETRY_PX = {\n  tapBox: 36,\n}\n',
        'packages/shared/src/ui/y-spec.ts':
          'export const Y_GONE_PX = GEOMETRY_PX.renamedAway\nexport const Y_REAL_PX = 20\n',
      })
      return tiers.Y_GONE_PX === undefined && tiers.Y_REAL_PX === 20
    })(),
  )
  t(
    '㊳ SL:一张 spec 档只被一条腿引用必须点名(正反对照:两侧同引用 ⇒ 不列)',
    (() => {
      const tiers = { Z_BOX_PX: 36, Z_GLYPH_PX: 20, 'geometry.tapBox': 36 }
      const pairs = { pairs: [{ name: 'Z', miniapp: 'a/Z.tsx', rn: 'b/Z.tsx' }] }
      const oneLeg = specLegAudit(
        pairs,
        {
          'a/Z.tsx': 'width: toUnit(Z_BOX_PX)\n',
          'b/Z.tsx': 'width: Z_GLYPH_PX\n',
        },
        tiers,
      )
      const bothLegs = specLegAudit(
        pairs,
        {
          'a/Z.tsx': 'width: toUnit(Z_BOX_PX)\nsize: Z_GLYPH_PX\n',
          'b/Z.tsx': 'width: Z_BOX_PX\nsize: Z_GLYPH_PX\n',
        },
        tiers,
      )
      return (
        oneLeg.length === 1 &&
        oneLeg[0].onlyMiniapp.join(',') === 'Z_BOX_PX' &&
        oneLeg[0].onlyRn.join(',') === 'Z_GLYPH_PX' &&
        bothLegs.length === 0
      )
    })(),
  )
  t(
    '㊴ SL 域不含 `geometry.*` 通用档(两侧都无引用 ⇒ 整族不列;有引用也只列 spec 档)',
    (() => {
      const tiers = { 'geometry.tapBox': 36 }
      const pairs = { pairs: [{ name: 'Z', miniapp: 'a/Z.tsx', rn: 'b/Z.tsx' }] }
      const none = specLegAudit(
        pairs,
        { 'a/Z.tsx': 'const t = rnGeometry.tapBox\n', 'b/Z.tsx': 'padding: 8\n' },
        tiers,
      )
      const emptyTiers = specLegAudit(pairs, { 'a/Z.tsx': 'x\n', 'b/Z.tsx': 'y\n' }, {})
      return none.length === 0 && emptyTiers.length === 0
    })(),
  )
  t(
    '㊵ 装车锁:`main` 必须把 `collected.tiers` 与 `collected.radius` 都喂进 `audit` —— 算出档表又丢掉,等于判据没接线',
    (() => {
      const src = readFileSync(fileURLToPath(import.meta.url), 'utf8')
      /**
       * 按**实参集合**判,不按整条调用的字节形判:本文件被 prettier 折过行以后,
       * 锚定 `...collected.tiers\s*\)` 这种"闭合括号紧跟最后一个参数"的写法会在一次无关的
       * 重排里假红(实测把 audit 调用改成多行参数后本条即红,而接线本身完好)。
       * 现在两维都必须出现 —— 圆角维单独被摘线(只喂 tiers)同样判这条红,
       * 那正是 2026-09-27 之前 RD 维在提交链上生效 0 次的那一型。
       */
      const calls = [...src.matchAll(/\baudit\(([^)]*)\)/g)].map((m) => m[1])
      return calls.some(
        (a) =>
          /collected\.pairs/.test(a) && /collected\.tiers/.test(a) && /collected\.radius/.test(a),
      )
    })(),
  )
  t(
    '㊶ G:表里加一档而 `GeometryStep` 不跟 ⇒ 必须点名该档(正反对照:同名 ⇒ 无话)',
    (() => {
      const drift = geometryDeclCheck(
        'export const GEOMETRY_PX = {\n  tapBox: 36,\n  controlBox: 32,\n}\n',
        "export type GeometryStep = 'tapBox'\n",
      )
      const same = geometryDeclCheck(
        'export const GEOMETRY_PX = {\n  tapBox: 36,\n  glyphMd: 20,\n}\n',
        "export type GeometryStep = 'tapBox' | 'glyphMd'\n",
      )
      return (
        !!drift.problem &&
        drift.problem.includes('controlBox') &&
        !same.problem &&
        same.steps.length === 2 &&
        same.declared.length === 2
      )
    })(),
  )
  t(
    '㊷ G 反向漂移同样判红:类型承认一档而表里没有(消费方编译过、运行时取到 undefined)',
    (() => {
      const r = geometryDeclCheck(
        'export const GEOMETRY_PX = {\n  tapBox: 36,\n}\n',
        "export type GeometryStep = 'tapBox' | 'glyphSm'\n",
      )
      return !!r.problem && r.problem.includes('glyphSm') && r.missingInJs.join() === 'glyphSm'
    })(),
  )
  t(
    '㊸ G 取不到两份之一 ⇒ 判"未判定"而不是"一致"(把判据失明写成通过是本仓最高频失效型)',
    (() => {
      const noTable = geometryDeclCheck('export const OTHER = {}\n', "type X = 'a'\n")
      const noSrc = geometryDeclCheck(undefined, "type X = 'a'\n")
      return noTable.undetermined === true && noSrc.undetermined === true
    })(),
  )
  t(
    '㊹ G 装车锁:main 必须读 collected.geoDecl 并把它折进退出码(否则本维只是自检里的摆设)',
    (() => {
      const src = readFileSync(fileURLToPath(import.meta.url), 'utf8')
      return (
        /geometryDeclCheck\(specSources\[geoPath\],\s*specSources\[geoDtsPath\]\)/.test(src) &&
        /collected\.geoDecl/.test(src) &&
        /\+ \(geoRed \? 1 : 0\)\s*\?\s*1\s*:\s*0/.test(src)
      )
    })(),
  )
  t(
    '㊺ 拆对声明三条判据:无理由 / 日期形态错 / 已到期 各自判红,合法声明返回 null',
    (() => {
      const future = new Date(Date.now() + 86400000 * 30).toISOString().slice(0, 10)
      const ok = rejectProblem({
        reason: '两端头注逐字读自 HEAD:一个是右下角功能盒,一个是顶部 toast',
        until: future,
      })
      const noReason = rejectProblem({ reason: '', until: future })
      const shortReason = rejectProblem({ reason: '不一样', until: future })
      const expired = rejectProblem({
        reason: '两端头注逐字读自 HEAD:一个是右下角功能盒,一个是顶部 toast',
        until: '2020-01-01',
      })
      const badDate = rejectProblem({
        reason: '两端头注逐字读自 HEAD:一个是右下角功能盒,一个是顶部 toast',
        until: '2027-13-99x',
      })
      const notObj = rejectProblem('FloatBox')
      return (
        ok === null &&
        !!noReason &&
        !!shortReason &&
        !!expired &&
        !!badDate &&
        !!notObj &&
        /到期/.test(expired)
      )
    })(),
  )
  t(
    '㊻ 拆对必须发生在配对层:该族不再进 findings,但必须在 rejected 里点名(不得静默消失)',
    (() => {
      const dir = makeFixtureRepo(
        FIXTURE_BASE({
          rn: "import { Bar, Foo } from '@ihui/rn-app'\nexport function RootNavigator() { return null }\n",
        }),
      )
      try {
        const plain = collect(dir, 'head')
        const withRej = collect(dir, 'head', { rejected: ['Foo'] })
        return (
          plain.pairs.pairs.some((p) => p.name === 'Foo') &&
          plain.rejected.length === 0 &&
          !withRej.pairs.pairs.some((p) => p.name === 'Foo') &&
          withRej.rejected.length === 1 &&
          withRej.rejected[0].name === 'Foo' &&
          withRej.rejected[0].rn === 'packages/app/src/components/Foo.tsx'
        )
      } finally {
        rmScratch(dir)
      }
    })(),
  )
  t(
    '㊼ emitBaseline 必须原样带走 pairingRejects(重写台账把别人的拆对声明冲掉 = 该族凭空多出一堆"差异")',
    (() => {
      const prior = {
        counts: { A: 1 },
        waivers: {},
        pairingRejects: { F: { reason: 'x', until: '2027-01-01' } },
      }
      const out = emitBaseline(
        [{ name: 'A', named: [], geometry: { onlyMiniapp: [], onlyRn: [] } }],
        prior,
      )
      const dropped = emitBaseline(
        [{ name: 'A', named: [], geometry: { onlyMiniapp: [], onlyRn: [] } }],
        {},
      )
      return (
        !!out.pairingRejects &&
        out.pairingRejects.F.reason === 'x' &&
        !Object.keys(out.counts).includes('F') &&
        dropped.pairingRejects === undefined
      )
    })(),
  )
  t(
    '㊽ 装车锁:拆对的红必须折进退出码(只打印不拦提交 = 声明坏了没人知道)',
    (() => {
      const src = readFileSync(fileURLToPath(import.meta.url), 'utf8')
      return /\+\s*slRed\.length\s*\+\s*rejRed\s*\+\s*\(geoRed \? 1 : 0\)/.test(src)
    })(),
  )
  t(
    '㊣ 换算器必须参与读数:`toUnit(taroGeometry.X)` = 双重换算,读出来是表值的 2 倍(实测事故形态)',
    (() => {
      const tiers = { 'geometry.controlBox': 32 }
      const bad = readGeometry('width: toUnit(taroGeometry.controlBox)\n', 'miniapp', tiers)
      return bad.values.has(64) && !bad.values.has(32)
    })(),
  )
  t(
    '㊤ 正解写法不得被判成差一倍:`rpx(taroGeometry.X)` 读表值本身(上一条的成对对照)',
    (() => {
      const tiers = { 'geometry.controlBox': 32 }
      const good = readGeometry('width: rpx(taroGeometry.controlBox)\n', 'miniapp', tiers)
      return good.values.has(32) && !good.values.has(64)
    })(),
  )
  t(
    '㊥ 端到端:一端走对投影、另一端走错投影 ⇒ 必须报成真分叉(旧尺子在这里报"两端同档")',
    (() => {
      const tiers = { 'geometry.controlBox': 32 }
      const a = readGeometry('width: rpx(taroGeometry.controlBox)\n', 'miniapp', tiers)
      const b = readGeometry('width: BOTTOM_ACTION_BAR_CONTROL_BOX_PX\n', 'rn', {
        ...tiers,
        BOTTOM_ACTION_BAR_CONTROL_BOX_PX: 32,
      })
      const d = diffValues(a.values, b.values)
      const sameNoConverter = diffValues(
        readGeometry('width: toUnit(taroGeometry.controlBox)\n', 'miniapp', tiers).values,
        b.values,
      )
      return (
        !d.onlyMiniapp.length && !d.onlyRn.length && sameNoConverter.onlyMiniapp.join() === '64'
      )
    })(),
  )
  t(
    '㊦ 台账腐烂:台账钉着某族而本轮实测无该族记录 ⇒ 必须点名并进退出码',
    (() => {
      const v = verdictOf([], { counts: { Ghost: 3 }, radiusCounts: {} })
      return v.rot.join() === 'Ghost'
    })(),
  )
  t(
    '㊧ 反向对照:同一族本轮有读数(哪怕差异为 0 档以外)⇒ 不得判腐烂',
    (() => {
      const f = {
        name: 'X',
        named: [],
        geometry: { onlyMiniapp: [44], onlyRn: [32] },
        radius: { onlyMiniapp: [], onlyRn: [] },
      }
      const v = verdictOf([f], { counts: { X: 2 }, radiusCounts: { X: 0 } })
      return v.rot.length === 0
    })(),
  )
  t(
    '㊨ 带理由豁免的族仍算"扫过了",不得被读成腐烂(否则没人敢登记豁免)',
    (() => {
      const f = {
        name: 'Y',
        named: [],
        geometry: { onlyMiniapp: [], onlyRn: [] },
        radius: { onlyMiniapp: [], onlyRn: [] },
      }
      const v = verdictOf([f], {
        counts: { Y: 5 },
        radiusCounts: {},
        waivers: { Y: { reason: '原生 chrome 与键盘避让机制不同,两端不可同形' } },
      })
      return v.rot.length === 0 && v.waived.length === 1
    })(),
  )
  t(
    '㊩ 腐烂维装车锁:main 必须既打印 res.rot 又把它折进退出码(只打印 = 下一次没人看)',
    (() => {
      const src = readFileSync(fileURLToPath(import.meta.url), 'utf8')
      return (
        /× 台账腐烂:\$\{res\.rot\.join/.test(src) &&
        /const rotRed = res\.rot\.length \? 1 : 0/.test(src) &&
        /rotRed\s*\+\s*res\.red\.length\s*\+\s*icRed\.length/.test(src)
      )
    })(),
  )
  t(
    'WD1 web 腿读数:两侧都读到档而不同 ⇒ 出差异;一侧一个档都读不出 ⇒ 未判定,不得记"两端同值"',
    (() => {
      // 与 S18 同一形态:档位表就是一张普通对象(radiusLookup 解析的是 radius.js 的**具体写法**,
      // 自检测的是判据不是解析器,所以既有 RD 用例都直接喂表)
      const table = { xs: 2, sm: 4, md: 6, lg: 8, xl: 12, '2xl': 16 }
      const pairs = [
        { name: 'Card', miniapp: 'm/Card.tsx', rn: 'w/Card.tsx' },
        { name: 'Quiet', miniapp: 'm/Quiet.tsx', rn: 'w/Quiet.tsx' },
      ]
      const text = {
        'm/Card.tsx': 'export const Card = () => <div className="rounded-lg" />',
        'w/Card.tsx': 'export const Card = () => <div className="rounded-md" />',
        'm/Quiet.tsx': 'export const Quiet = () => <div />',
        'w/Quiet.tsx': 'export const Quiet = () => <div />',
      }
      const r = webRadiusAudit(pairs, text, table)
      const card = r.findings.find((f) => f.name === 'Card')
      return (
        !!card &&
        card.radius.onlyRn.length === 1 &&
        card.radius.onlyMiniapp.length === 1 &&
        r.findings.length === 1 &&
        r.undetermined.length === 1 &&
        r.undetermined[0].name === 'Quiet'
      )
    })(),
  )
  t(
    'WD2 web 腿锚点独立:同一族在主腿与 web 腿各有一份差异时,一边下降不得替另一边顶掉名额;' +
      '而台账没钉过的族出现差异 ⇒ 直接红',
    (() => {
      const f = {
        name: 'Card',
        named: [],
        geometry: { onlyMiniapp: [], onlyRn: [] },
        radius: { onlyMiniapp: [6], onlyRn: [8] },
        elementRadius: { mismatched: [], onlyMiniapp: [], onlyRn: [] },
      }
      // 主腿台账给 Card 一份额度,web 台账没给 ⇒ web 腿必须红,主腿必须绿
      const mainLedger = { counts: { Card: 0 }, radiusCounts: { Card: 2 } }
      const webLedger = { webCounts: {}, webRadiusCounts: {} }
      const main = verdictOf([f], mainLedger)
      const web = verdictOf([f], webLedger, WEB_LEDGER)
      const webAfter = verdictOf([f], { webCounts: {}, webRadiusCounts: { Card: 2 } }, WEB_LEDGER)
      return (
        main.red.length === 0 &&
        web.red.length === 1 &&
        webAfter.red.length === 0 &&
        web.red[0].radiusCount === 2
      )
    })(),
  )
  t(
    'WD3 装车锁:web 腿必须既被 main 打印、又折进退出码,且"台账钉过而本轮零记录"要红' +
      '(只打印 = 下一次没人看;没有死亡机制 = 删目录就能让这一维安静)',
    (() => {
      const src = readFileSync(fileURLToPath(import.meta.url), 'utf8')
      return (
        /**
         * 这几条锁刻意用 `\s*` 容忍**折行**:早先它们写成 `webRadiusAudit\(collected\.webPairs`
         * 这样的紧邻子串,而调用点被格式化工具折成多行后锁就红了 —— 判据与被判据的**排版**挂钩,
         * 于是"格式化"成了唯一能修它的手段,而本仓明令不得对本校验器跑格式化(自检里有多处
         * 源码正则自证,折行会凭空让它们失明)。带 `\s*` 后语义不变(仍是"这个调用在本体内"),
         * 但换行不再让它变成恒红(§12e:恒红门的唯一结局是逼人跳门)。
         */
        /webRadiusAudit\(\s*collected\.webPairs/.test(src) &&
        /if \(webVerdict\.red\.length \|\| webGhostRed\)/.test(src) &&
        /const webGhostRed = webPriorKeys\.length && !web\.findings\.length/.test(src) &&
        /web 腿整族消失|台账钉着 \$\{webPriorKeys\.length\} 族/.test(src)
      )
    })(),
  )
  t(
    'WD4 web 腿豁免自成一本账:重锚必须带过去(键按 webWaivers,不与主腿 waivers 互串),' +
      '差异归零的理由要撤下并报名,而生效中的豁免必须逐条把理由打进报告(豁免不得静默)',
    (() => {
      const src = readFileSync(fileURLToPath(import.meta.url), 'utf8')
      const f = {
        name: 'Card',
        named: [],
        geometry: { onlyMiniapp: [], onlyRn: [] },
        radius: { onlyMiniapp: [6], onlyRn: [8] },
        elementRadius: { mismatched: [], onlyMiniapp: [], onlyRn: [] },
      }
      const prior = {
        // 主腿对同名族也挂了一份豁免:两腿的豁免表必须互不顶账(web 腿的差异不等于主腿的差异)
        waivers: { Card: { reason: '主腿那一维的理由' } },
        webWaivers: {
          Card: { reason: 'web 侧多嵌一段联想面板,两端输入井同档' },
          Gone: { reason: '本轮已经找不到差异,该撤下' },
        },
      }
      const out = emitBaseline([], prior, [f])
      const carried = !!out[WEB_LEDGER.waivers]?.Card
      const ghostRetired = out[WEB_LEDGER.waivers]?.Gone === undefined
      const notCrossed = out.waivers.Card === undefined // 主腿本轮无该族差异 ⇒ 主腿理由必须撤下,而不是被 web 腿带着
      const waivedNotRed = (() => {
        const ledger = { webCounts: {}, webRadiusCounts: { Card: 2 }, webWaivers: prior.webWaivers }
        const v = verdictOf([f], ledger, WEB_LEDGER)
        return v.red.length === 0 && v.waived.length === 1 && v.waived[0].name === 'Card'
      })()
      const printed =
        /带理由豁免 \$\{webVerdict\.waived\.length\}/.test(src) &&
        /webVerdict\.waived[\s\S]{0,240}⊘ WD \$\{wv\.name\} 带理由豁免/.test(src)
      return carried && ghostRetired && notCrossed && waivedNotRed && printed
    })(),
  )
  t(
    'WD5 拆对必须能只作用于一条腿:legs=["web"] 时主腿在册配对不得被连带摘线,而 web 腿必须留名;' +
      '缺省(不写 legs)= 两腿都拆(既有 FloatBox 声明逐字不改行为)',
    (() => {
      const future = new Date(Date.now() + 86400 * 300).toISOString().slice(0, 10)
      const badLegName = rejectProblem({
        reason: '两端不是同一个东西,证据见头注',
        until: future,
        legs: ['nope'],
      })
      const emptyLegs = rejectProblem({
        reason: '两端不是同一个东西,证据见头注',
        until: future,
        legs: [],
      })
      const shape = badLegName === null ? false : /腿名/.test(badLegName)
      const both = rejectLegs({ reason: 'x', until: future })
      const onlyWeb = rejectLegs({ reason: 'x', until: future, legs: ['web'] })
      if (!(both.main && both.web && !onlyWeb.main && onlyWeb.web)) return false
      if (!shape || !emptyLegs) return false
      const files = {
        ...FIXTURE_BASE({
          rn: "import { Bar, Foo } from '@ihui/rn-app'\nexport function RootNavigator() { return null }\n",
        }),
        // web 腿目录里再放一份同名件:同一族现在同时存在于两条腿上。
        // 刻意**不写圆角类**:FIXTURE_BASE 里没有 radius.js 那份档表,写了会让 collect 按
        // "圆角维判据失明"判死 —— 那这条用例红的原因是夹具缺件,不是 legs 判据(与上面㊻同一条纪律)。
        'apps/web/src/components/Foo.tsx':
          'export function Foo() { return <div className="flex" /> }\n',
      }
      const dir = makeFixtureRepo(files)
      try {
        const decl = {
          reason: 'web 那份同名件是另一端口的死副本,与小程序/RN 不是同一个元素',
          until: future,
          legs: ['web'],
        }
        const w = collect(dir, 'head', { rejected: ['Foo'], rejectMap: { Foo: decl } })
        const m = collect(dir, 'head', {
          rejected: ['Foo'],
          rejectMap: { Foo: { ...decl, legs: ['main'] } },
        })
        const plain = collect(dir, 'head', {})
        const mainKept = w.pairs.pairs.some((p) => p.name === 'Foo')
        const webSplit = w.webRejected.length === 1 && w.webPairs.every((p) => p.name !== 'Foo')
        const mainSplit = !m.pairs.pairs.some((p) => p.name === 'Foo') && m.webRejected.length === 0
        // 不写 legs ⇒ 与旧行为逐字一致(两腿都拆),这条防的是"新维度顺手改了缺省语义"
        const legacy = collect(dir, 'head', {
          rejected: ['Foo'],
          rejectMap: { Foo: { reason: decl.reason, until: future } },
        })
        const legacyBoth =
          !legacy.pairs.pairs.some((p) => p.name === 'Foo') && legacy.webRejected.length === 1
        return plain.webRejected.length === 0 && mainKept && webSplit && mainSplit && legacyBoth
      } finally {
        rmScratch(dir)
      }
    })(),
  )
  t(
    '㊪ 平台后缀必须能配对:`SectionHeader` 与 `SectionHeader.taro` 是同一元素;' +
      '带后缀那份优先当选;而真不同名的两个文件不得被并成一对(宁可少配)',
    (() => {
      const r = scan(
        [
          'apps/miniapp-taro/src/components/SectionHeader.tsx',
          'apps/miniapp-taro/src/components/SectionHeader.taro.tsx',
          'apps/miniapp-taro/src/components/SearchBar.tsx',
        ],
        [
          'packages/app/src/features/common/SectionHeader.tsx',
          'packages/app/src/features/chat/SearchInput.tsx',
        ],
      )
      const names = r.pairs.map((p) => p.name)
      const sec = r.pairs.find((p) => p.name === 'SectionHeader')
      return (
        names.length === 1 &&
        names[0] === 'SectionHeader' &&
        sec.miniapp.endsWith('SectionHeader.taro.tsx') &&
        r.onlyMiniapp === 1 &&
        r.onlyRn === 1 &&
        r.onlyMiniappNames.join() === 'apps/miniapp-taro/src/components/SearchBar.tsx' &&
        r.onlyRnNames.join() === 'packages/app/src/features/chat/SearchInput.tsx'
      )
    })(),
  )
  t(
    '㊫ 名单必须是可指认的路径而不是又一个计数:' +
      '只报"75 / 50"时,下一个人无从判断哪些是同一元素、哪些真只存在一端,那一格永远清不掉',
    (() => {
      const r = scan(['apps/miniapp-taro/src/a/Only.tsx'], ['packages/app/src/b/Twin.tsx'])
      return (
        r.onlyMiniapp === 1 &&
        r.onlyMiniappNames.length === 1 &&
        r.onlyMiniappNames[0].includes('Only.tsx') &&
        r.onlyRnNames[0].includes('Twin.tsx')
      )
    })(),
  )
  t(
    '㊬ 装车锁:换腿桶必须与配对键同形 —— altsBySide 用 pairKey 建桶、按 pairKey 查桶' +
      '(仍用 normKey 的话,带平台后缀那份与不带那份不在同一桶里,不可达时找不到替代腿)',
    (() => {
      const src = readFileSync(fileURLToPath(import.meta.url), 'utf8')
      return (
        /altsBySide\[side\] = m/.test(src) &&
        (src.match(/const k = pairKey\(p\)/g) ?? []).length === 1 &&
        /altsBySide\[side\]\.get\(pairKey\(cur\[side\]\)\)/.test(src) &&
        !/altsBySide\[side\]\.get\(normKey\(cur\[side\]\)\)/.test(src)
      )
    })(),
  )
  t(
    '㊭ 装车锁:名单必须由 main 真的打出来(人读面 + --json 两面各一处)。' +
      "自检证明 scan 给得出名字,不等于有人问它要 —— 本仓最高频的失效型就是'函数在、没人调'",
    (() => {
      const src = readFileSync(fileURLToPath(import.meta.url), 'utf8')
      const from = src.indexOf('function main(')
      const to = src.indexOf('function runSelfTest(', from + 1)
      const mainBody = src.slice(from, to > from ? to : undefined)
      return (
        // --json 面(机器可读,下一票的输入源)
        /onlyMiniappNames: collected\.pairs\?\.onlyMiniappNames \?\? \[\]/.test(mainBody) &&
        /onlyRnNames: collected\.pairs\?\.onlyRnNames \?\? \[\]/.test(mainBody) &&
        // 人读面:名单打印的三处缺一不可(标签表、计数前缀、逐名 join)
        /\['仅小程序', 'onlyMiniappNames'\]/.test(mainBody) &&
        /\['仅 RN', 'onlyRnNames'\]/.test(mainBody) &&
        /\$\{label\}\(\$\{names\.length\}\):\$\{names\.join\(' '\)\}/.test(mainBody)
      )
    })(),
  )
  t(
    '㊮ 别名必须能把"两端不同名的同一元素"拉回射程:' + '配对成立、名单里不再重复点名、且无一条判红',
    (() => {
      const r = scan(
        [
          'apps/miniapp-taro/src/components/CategoryBar.tsx',
          'apps/miniapp-taro/src/components/X.tsx',
        ],
        ['packages/app/src/components/CategoryInlineBar.tsx'],
        {
          CategoryBar: {
            miniapp: 'apps/miniapp-taro/src/components/CategoryBar.tsx',
            rn: 'packages/app/src/components/CategoryInlineBar.tsx',
            reason: '两端头注互点名:同一"统一分类条"的两份同形实现',
            until: '2027-01-01',
          },
        },
      )
      const p = r.pairs.find((x) => x.name === 'CategoryBar')
      return (
        !!p?.aliased &&
        p.rn.endsWith('CategoryInlineBar.tsx') &&
        r.aliasProblems.length === 0 &&
        r.onlyMiniapp === 1 &&
        r.onlyMiniappNames.join() === 'apps/miniapp-taro/src/components/X.tsx' &&
        r.onlyRn === 0 &&
        r.onlyRnNames.length === 0
      )
    })(),
  )
  t(
    '㊯ 别名两侧文件必须在被审面上找得到:路径写歪 / 文件搬家 ⇒ 判红并点名,' +
      '不得静默退回"这一族没配对上"',
    (() => {
      const r = scan(['a/CategoryBar.tsx'], ['b/Gone.tsx'], {
        CategoryBar: {
          miniapp: 'a/CategoryBar.tsx',
          rn: 'b/CategoryInlineBar.tsx',
          reason: '同一分类条的两份实现,头注互点名',
          until: '2027-01-01',
        },
      })
      return (
        r.aliasProblems.length === 1 &&
        /找不到/.test(r.aliasProblems[0].problem) &&
        r.pairs.every((p) => !p.aliased)
      )
    })(),
  )
  t(
    '㊰ 该对已能按同名配对 ⇒ 别名是多余行,必须判红要求了结' +
      '(挂着一条不再生效的配对声明,比没有更难查)',
    (() => {
      const r = scan(['a/Foo.tsx'], ['b/Foo.tsx'], {
        Foo: {
          miniapp: 'a/Foo.tsx',
          rn: 'b/Foo.tsx',
          reason: '早年两端不同名,如今已能同名配对',
          until: '2027-01-01',
        },
      })
      return r.aliasProblems.length === 1 && /多余行/.test(r.aliasProblems[0].problem)
    })(),
  )
  t(
    '㊱ 别名声明的卫生与拆对同源:无理由 / 理由不足以复核 / 已到期 各判红,而判据只有 rejectProblem 一份',
    (() => {
      const mk = (a) =>
        scan(['a/A.tsx'], ['b/B.tsx'], { A: { miniapp: 'a/A.tsx', rn: 'b/B.tsx', ...a } })
      return (
        mk({ reason: '', until: '2027-01-01' }).aliasProblems.length === 1 &&
        mk({ reason: '短', until: '2027-01-01' }).aliasProblems.length === 1 &&
        mk({ reason: '同一元素的两种命名,依据两端头注互点名', until: '2020-01-01' }).aliasProblems
          .length === 1 &&
        mk({ reason: '同一元素的两种命名,依据两端头注互点名', until: '2027-01-01' }).aliasProblems
          .length === 0
      )
    })(),
  )
  t(
    '㊲ emitBaseline 必须原样带走 aliases(重写台账把已登记别名冲掉 = 那一族静默回到零判据,账面什么都看不见)',
    (() => {
      const prior = { aliases: { A: { miniapp: 'a', rn: 'b', reason: 'r', until: '2027-01-01' } } }
      const out = emitBaseline(
        [{ name: 'X', named: [], geometry: { onlyMiniapp: [], onlyRn: [] }, waived: false }],
        prior,
      )
      const dropped = emitBaseline([], prior)
      return out.aliases?.A?.reason === 'r' && dropped.aliases?.A?.reason === 'r'
    })(),
  )
  t(
    '㊳ 装车锁:别名表必须由 main 喂进 collect,且**每一处** HEAD 棘轮基线取样同样要喂' +
      '(漏喂 ⇒ 本轮多出的配对在基准侧不存在,别人欠的债会被算成新增红)',
    (() => {
      const src = readFileSync(fileURLToPath(import.meta.url), 'utf8')
      /**
       * 这里断言的是"**每一处** HEAD 基线取样都喂了 aliases",不是"恰好 N 处"。
       * 原来写死 `=== 2` 时它数的是当时已有的两处;RS 维的差值棘轮合法地添了第三处之后,
       * 那个数字就变成"新维必须不存在"的隐含约束 —— 判据一加维度就把守门弄红,这是**恒红门**(§12e),
       * 而恒红门的唯一结局是逼人跳门。逐处断言反而比计数强:新增任何一处取样都逃不掉。
       */
      const headSamples = [...src.matchAll(/collect\(repoRoot, 'head',[^\n]*/g)].map((m) => m[0])
      return (
        /collect\(repoRoot, face, \{ pairAll, rejected: rejNames, rejectMap: rej, aliases \}\)/.test(
          src,
        ) &&
        headSamples.length >= 2 &&
        headSamples.every((s) => s.includes('aliases')) &&
        /if \(aliasRed\) return 1/.test(src) &&
        /aliasPairs: \(collected\.pairs\?\.pairs \?\? \[\]\)/.test(src)
      )
    })(),
  )
  t(
    '㉅ 伴生样式表必须参与几何/圆角读数:同一对文件,喂 styles 与不喂结论必须不同' +
      '(不喂 ⇒ "小程序 0 档 / RN 11 档"这种测量假象,与 §4 的 CSS 整面隐身同型)',
    (() => {
      const p = { pairs: [{ name: 'Foo', miniapp: 'a/Foo.tsx', rn: 'b/Foo.tsx' }] }
      const texts = {
        'a/Foo.tsx': 'export default function Foo(){return null}\n',
        'b/Foo.tsx': 'width: 32\n',
      }
      const blind = audit(p, texts, {})
      // 128rpx 归一 = 64px,与 RN 侧 32 不同档(64rpx 会正好等于 32,那是同值不是漏读)
      const withCss = audit(p, texts, {}, {}, null, { 'a/Foo.tsx': '.foo{width: 128rpx}\n' })
      const gBlind = blind.findings[0].geometry
      const gCss = withCss.findings[0].geometry
      return (
        gBlind.onlyMiniapp.length === 0 &&
        gBlind.onlyRn.join() === '32' &&
        gCss.onlyMiniapp.join() === '64' &&
        gCss.onlyRn.join() === '32'
      )
    })(),
  )
  t(
    '㉆ resolveRel 只处理 ./ 与 ../,并按被审面拼仓库相对路径(带别名的说明符不跟 —— 样式文件不该走别名)',
    (() =>
      resolveRel('apps/miniapp-taro/src/components/CategoryBar.tsx', './CategoryBar.css') ===
        'apps/miniapp-taro/src/components/CategoryBar.css' &&
      resolveRel('packages/app/src/components/a/X.tsx', '../b/Y.scss') ===
        'packages/app/src/components/b/Y.scss')(),
  )
  t(
    '㉇ 装车锁:collect 必须真的读伴生样式表并 return styles,main 必须把它喂进 audit 且把口径打印出来' +
      '(样式在、判据没跟 = 整族隐身而账面全绿)',
    (() => {
      const src = readFileSync(fileURLToPath(import.meta.url), 'utf8')
      const mainBody = src.slice(
        src.indexOf('function main('),
        src.indexOf('function runSelfTest('),
      )
      return (
        /const styles = \{\}/.test(src) &&
        /styles\[f\] = parts\.join\('\\n'\)/.test(src) &&
        /^    styles,$/m.test(src) &&
        /collected\.styles \?\? \{\}/.test(mainBody) &&
        /读数口径/.test(mainBody) &&
        /取不到伴生样式表/.test(src)
      )
    })(),
  )
  t(
    '㉮ 简写多值声明必须逐值收档:`padding: 0 24rpx` 的 24rpx 要读成 12px' +
      '(实测 CategoryBar 的"仅 RN 档 12"就是漏收第二个值造出的假分叉)',
    (() => {
      const v = readGeometry('.x{\n  padding: 0 24rpx;\n}\n', 'miniapp').values
      const w = readGeometry('.x{\n  margin: 8rpx 0 16rpx auto;\n}\n', 'miniapp').values
      return v.has(12) && w.has(4) && w.has(8)
    })(),
  )
  t(
    '㉯ 反向对照 + 不该计的都不计:单值形态不得被双计,auto / 百分比 / calc 不当档,' +
      '非几何键(padding 之外如 color)不入场',
    (() => {
      const single = [...readGeometry('.x{\n  width: 40px;\n}\n', 'rn').values]
      const junk = readGeometry(
        '.x{\n  padding: 0 auto;\n  width: 100%;\n  height: calc(100% - 8px);\n  color: 3 4px;\n}\n',
        'rn',
      ).values
      return (
        single.filter((n) => n === 40).length === 1 &&
        !junk.has(100) &&
        !junk.has(8) &&
        !junk.has(3) &&
        !junk.has(4)
      )
    })(),
  )
  t(
    '㉰ 同一元素两端各用一种写法必须判同值(简写 vs 显式方向):' +
      '这是本条判据的全部目的,否则它只是多收了几个数而没修好任何一笔账',
    (() => {
      const mp = readGeometry('.x{\n  padding: 0 24rpx;\n}\n', 'miniapp').values
      const rn = readGeometry('paddingHorizontal: 12,\n', 'rn').values
      const d = diffValues(mp, rn)
      return !d.onlyMiniapp.filter((n) => n !== 0).length && !d.onlyRn.length
    })(),
  )
  t(
    '㉱ 装车锁:简写提取式必须真在 readGeometry 体内,且这条锁自己要有牙' +
      '(判据写在别处 = 提交链上永不生效;正则不转义 = 看着断言其实恒假)',
    (() => {
      const src = readFileSync(fileURLToPath(import.meta.url), 'utf8')
      const from = src.indexOf('export function readGeometry')
      const until = src.indexOf('return { values, named }', from)
      const body = src.slice(from, until > from ? until : from + 6000)
      const has = (s) =>
        /if \(vals\.length < 2\) continue/.test(s) &&
        /push\(toPx\(one\[1\], one\[2\], side\)\)/.test(s)
      // 牙:把简写循环整段摘掉后同一条判据必须翻红(否则它就是支恒真断言,比没有更糟)。
      // 用**索引切片**而不是正则 —— 目标文本里本身嵌着正则字面量,再套一层正则必然引号地狱,
      // 而"写复杂的变异表达式"正是本仓记过的"断言看着有、其实恒真"那一型。
      const mk = 'for (const m of code.matchAll(/(?:^|\\n)[\\t ]*([a-z][a-z-]*)'
      const s = body.indexOf(mk)
      const e = body.indexOf('\n  }\n', s)
      const noLoop = s < 0 || e < 0 ? body : body.slice(0, s) + body.slice(e + 5)
      return from > 0 && has(body) && noLoop !== body && !has(noLoop)
    })(),
  )
  t(
    '㉕ 类名提取必须吃真形态(跨行三元 + cn())且必须放过枚举值:' +
      '这条披露曾一次都不触发,而"没触发"在报告里读起来和"没有盲区"一模一样',
    (() => {
      const real =
        'export default function X() {\n' +
        '  return (\n' +
        '    <View\n' +
        "      className={cn('textarea-wrap', !isAmp && !isBig ? 'textarea-int' : '')}\n" +
        '      className2="text-sm bg-muted"\n' +
        '    />\n' +
        '  )\n' +
        '}\n'
      const used = usedClassNames(real)
      // 定长窗口的失败形态:隔壁属性的值被一起捞走(实测第一版因此把 `completed`/`read` 报成类名)
      const neighbor = usedClassNames("<View className={cn('box-shell')} state='completed' />")
      const neg = usedClassNames(
        "const kind = 'react'\nconst src2 = 'image'\nconst v = 'default'\n",
      )
      return (
        used.has('textarea-int') &&
        used.has('textarea-wrap') &&
        !used.has('text-sm') &&
        !used.has('bg-muted') &&
        neg.size === 0 &&
        neighbor.has('box-shell') &&
        !neighbor.has('completed')
      )
    })(),
  )
  t(
    '㉖ unresolvedClassNames 必须把"定义在自家样式表里的"放过、把"落在全局表的"点名',
    (() => {
      const src = 'const X = () => <View className="textarea-int other-box" />'
      const own = '.textarea-int { height: 80rpx; }'
      return (
        unresolvedClassNames(src, own).join() === 'other-box' &&
        unresolvedClassNames(src, own + '.other-box{padding:0}').length === 0
      )
    })(),
  )
  t(
    '㉗ 装车锁:披露必须由 collect 产出、由 main 打印,且不得在空数组时假装"没有盲区"',
    (() => {
      const src = readFileSync(fileURLToPath(import.meta.url), 'utf8')
      const mainBody = src.slice(
        src.indexOf('function main('),
        src.indexOf('function runSelfTest('),
      )
      return (
        /const blindClasses = \[\]/.test(src) &&
        /\n {4}styles,\n {4}blindClasses,\n/.test(src) &&
        /blindClasses\.push\(/.test(src) &&
        /collected\.blindClasses \?\? \[\]/.test(mainBody) &&
        /读数不完整/.test(mainBody)
      )
    })(),
  )
  t(
    '㉲ 选腿三序之二:出口指向必须压过目录序,而出口没指到任何一份时不得冒充依据(成对)',
    (() => {
      const a = 'packages/app/src/components/Foo.tsx'
      const b = 'packages/app/src/features/cards/Foo.tsx'
      const fwd = pickCandidate([a, b], b)
      const rev = pickCandidate([b, a], b)
      const none = pickCandidate([a, b], null)
      return (
        fwd.chosen === b &&
        fwd.by === 'exit' &&
        fwd.others.join() === a &&
        rev.chosen === b &&
        rev.by === 'exit' &&
        none.chosen === a &&
        none.by === 'order'
      )
    })(),
  )
  t(
    '㉳ 选腿三序之首:平台后缀必须压过出口指向(票⑩ 那一条"构建期真解析 .taro"不得被新加的这支掀翻)',
    (() => {
      const plain = 'apps/miniapp-taro/src/components/Foo.tsx'
      const suffixed = 'apps/miniapp-taro/src/components/Foo.taro.tsx'
      const a = pickCandidate([plain, suffixed], plain)
      const b = pickCandidate([suffixed, plain], plain)
      return (
        a.chosen === suffixed && a.by === 'suffix' && b.chosen === suffixed && b.by === 'suffix'
      )
    })(),
  )
  t(
    '㉴ 三份同名:扩面前后进审的候选逐条点名,且两份实现不得被并成一条假同值腿;' +
      '而"端内自绘层"必须压过出口指向(票#9 —— 本门比的是两端各自屏幕上的那张脸)',
    (() => {
      const mini = ['apps/miniapp-taro/src/components/UserInfoCard.tsx']
      const ownEnd = 'apps/mobile-rn/src/components/UserInfoCard.tsx'
      const sharedComponents = 'packages/app/src/components/UserInfoCard.tsx'
      const feat = 'packages/app/src/features/cards/UserInfoCard.tsx'
      // 扩面前:共享层 + 端内两份都在,没有出口证据 ⇒ 端内胜(它就是该端屏幕渲染的那份),两份都点名
      const b = scan(mini, [sharedComponents, ownEnd], {})
      const bb = b.multiCandidates.find((e) => e.name === 'UserInfoCard' && e.side === 'rn')
      // 扩面后:三份都在,出口指向 features ⇒ 端内那份仍胜(票#9:出口指向不得把不同层的副本顶上来)
      const a = scan(
        mini,
        [sharedComponents, ownEnd, feat],
        {},
        { rn: new Map([['userinfocard', feat]]) },
      )
      const aa = a.multiCandidates.find((e) => e.name === 'UserInfoCard' && e.side === 'rn')
      // 成对反向 1:该端**没有**自绘层副本时,出口指向照旧生效(新序不得把旧判据整支吞掉)
      const c = scan(mini, [sharedComponents, feat], {}, { rn: new Map([['userinfocard', feat]]) })
      const cc = c.multiCandidates.find((e) => e.name === 'UserInfoCard' && e.side === 'rn')
      // 成对反向 2:同层两份且无出口证据 ⇒ 仍按先入桶序(兜底那一支还活着;顺序即 SIDES 枚举序,共享层在前)
      const d = scan(mini, [sharedComponents, feat], {})
      const dd = d.multiCandidates.find((e) => e.name === 'UserInfoCard' && e.side === 'rn')
      return (
        b.pairs.length === 1 &&
        a.pairs.length === 1 &&
        !!bb &&
        bb.chosen === ownEnd &&
        bb.others.join() === sharedComponents &&
        bb.by === 'own-end' &&
        !!aa &&
        aa.chosen === ownEnd &&
        aa.by === 'own-end' &&
        aa.others.slice().sort().join() === [sharedComponents, feat].sort().join() &&
        a.pairs[0].rn === ownEnd &&
        a.pairs[0].name === 'UserInfoCard' &&
        !!cc &&
        cc.chosen === feat &&
        cc.by === 'exit' &&
        c.pairs[0].rn === feat &&
        !!dd &&
        dd.chosen === sharedComponents &&
        dd.by === 'order'
      )
    })(),
  )
  t(
    '㊾ 端到端(真临时 git 仓):包入口再导出指向 features 那一份 ⇒ 腿必须是那一份,' +
      '另两份点名在未选里,且不得被记成"换腿"(出口指向不是可达性)',
    (() => {
      const fx = FIXTURE_BASE({
        rn:
          "import { Bar, Foo } from '@ihui/rn-app'\n" +
          "import '../../../../packages/app/src/components/Foo'\n" +
          'export function RootNavigator() { return null }\n',
      })
      fx['packages/app/src/index.ts'] =
        "export { Bar } from './components'\nexport { Foo } from './features/cards'\n"
      fx['packages/app/src/features/cards/index.ts'] = "export { Foo } from './Foo'\n"
      fx['packages/app/src/features/cards/Foo.tsx'] =
        'export function Foo() { return <div style={{ width: 40 }} /> }\n'
      const dir = makeFixtureRepo(fx)
      try {
        const r = collect(dir, 'head')
        const p = r.pairs.pairs.find((x) => x.name === 'Foo')
        const mc = (r.pairs.multiCandidates ?? []).find((e) => e.name === 'Foo' && e.side === 'rn')
        return (
          !!p &&
          p.rn === 'packages/app/src/features/cards/Foo.tsx' &&
          !!mc &&
          mc.by === 'exit' &&
          mc.others.includes('packages/app/src/components/Foo.tsx') &&
          (r.fallbacks ?? []).every((f) => f.name !== 'Foo')
        )
      } catch (e) {
        return `抛错:${e?.message ?? e}`
      } finally {
        rmScratch(dir)
      }
    })(),
    '出口链在真 git 仓面上没跑通 ⇒ 单元层的 pickCandidate 过不等于装车过',
  )
  t(
    '㊿ 反向对照:同一份夹具把出口改指 components 那一份 ⇒ 腿跟着换回去(features 不得因"新加的目录"永远优先)',
    (() => {
      const fx = FIXTURE_BASE({
        rn:
          "import { Bar, Foo } from '@ihui/rn-app'\n" +
          "import '../../../../packages/app/src/features/cards/Foo'\n" +
          'export function RootNavigator() { return null }\n',
      })
      fx['packages/app/src/index.ts'] =
        "export { Bar } from './components'\nexport { Foo } from './components'\n"
      fx['packages/app/src/features/cards/Foo.tsx'] =
        'export function Foo() { return <div style={{ width: 40 }} /> }\n'
      const dir = makeFixtureRepo(fx)
      try {
        const r = collect(dir, 'head')
        const p = r.pairs.pairs.find((x) => x.name === 'Foo')
        const mc = (r.pairs.multiCandidates ?? []).find((e) => e.name === 'Foo' && e.side === 'rn')
        return (
          !!p &&
          p.rn === 'packages/app/src/components/Foo.tsx' &&
          !!mc &&
          mc.chosen === 'packages/app/src/components/Foo.tsx' &&
          mc.by === 'exit' &&
          mc.others.includes('packages/app/src/features/cards/Foo.tsx')
        )
      } catch (e) {
        return `抛错:${e?.message ?? e}`
      } finally {
        rmScratch(dir)
      }
    })(),
  )
  t(
    '㊀ 装车锁(归一化文本):配对源、出口喂入、双面上报缺任何一个都红 —— 面扩了判据没扩 = 白扩',
    (() => {
      const flat = readFileSync(fileURLToPath(import.meta.url), 'utf8').replace(/\s+/g, ' ')
      return (
        /'packages\/app\/src\/components', 'packages\/app\/src\/features', 'apps\/mobile-rn\/src\/components'/.test(
          flat,
        ) &&
        /exitPreferMaps\(repoRoot, face, probe\.multiCandidates \?\? \[\]\)/.test(flat) &&
        /scan\(lists\.miniapp, lists\.rn, aliases, exit\.maps\)/.test(flat) &&
        /\{ preferMaps: exit\.maps, webPairs \}/.test(flat) &&
        /pruned\.webPairs \?\? webPairs/.test(flat) &&
        /webUnreachable: wPrunedJson/.test(flat) &&
        /multiCandidates: collected\.pairs\?\.multiCandidates \?\? \[\]/.test(flat) &&
        /exitNotes: collected\.exitNotes \?\? \[\]/.test(flat) &&
        /同侧多候选/.test(flat) &&
        /出口链/.test(flat)
      )
    })(),
  )
  t(
    'KH line-height 无单位倍数不得进盒档(实测 0.5 幽灵档的成因),但 height/line-height 邻居仍要收',
    (() => {
      // 负例:小程序 CSS 的 `line-height: 1` 会被 toPx 当 rpx 折半成 0.5 —— 两端都没有这个数
      const css = '.ia-row { line-height: 1; height: 22rpx; letter-spacing: 0.2; }\n'
      const got = readGeometry(css, 'miniapp')
      return (
        !got.values.has(0.5) &&
        !got.values.has(1) &&
        got.values.has(11) && // height: 22rpx = 11px 必须仍然收(排除不能过宽)
        !got.values.has(0.2)
      )
    })(),
  )
  t(
    'KI 单位归属(负例):小程序**写进样式表**的 Npx 与 Nrpx 折出同一个物理量 ⇒ 不得报成跨端分叉',
    (() => {
      const vals = (s, side) => [...readGeometry(s, side).values].sort((a, b) => a - b)
      const mpPx = vals('.row { margin-top: 20px; }', 'miniapp')
      const mpRpx = vals('.row { margin-top: 20rpx; }', 'miniapp')
      const arbitrary = vals('<View className="w-[140px]" />', 'miniapp')
      return (
        JSON.stringify(mpPx) === JSON.stringify(mpRpx) &&
        JSON.stringify(mpPx) === JSON.stringify([10]) &&
        JSON.stringify(arbitrary) === JSON.stringify([70]) &&
        // 对面写 20 就是真 20:归一之后**同元素真差**仍要看得见
        JSON.stringify(vals('.row { margin-top: 20px; }', 'rn')) === JSON.stringify([20])
      )
    })(),
  )
  t(
    'KJ 单位归属(阳性对照):8rpx ↔ 10px 归一后必须是 4 ↔ 10,一格都不许被抹平',
    (() => {
      const mp = readGeometry('.t { font-size: 8rpx; }', 'miniapp').values
      const rn = readGeometry('.t { font-size: 10px; }', 'rn').values
      const d = diffValues(mp, rn)
      return d.onlyMiniapp.join() === '4' && d.onlyRn.join() === '10'
    })(),
  )
  t(
    'KK 单位归属:引号里的运行时 px 不过 postcss ⇒ 仍按真 px 读(实测 AgentRuntimePanel 的 minHeight)',
    (() => {
      const runtime = [...readGeometry("const s = { minHeight: '120px' }", 'miniapp').values]
      const sheet = [...readGeometry('.s { min-height: 120px; }', 'miniapp').values]
      return (
        JSON.stringify(runtime) === JSON.stringify([120]) &&
        JSON.stringify(sheet) === JSON.stringify([60])
      )
    })(),
  )
  t(
    'KL 圆角别名:同文件档位别名必须当档取用并归到元素名;解不到的名字计入读不到;不递别名表时默认口径一位不动',
    (() => {
      const tbl = { xs: 2, sm: 4, md: 6, lg: 8, xl: 12, '2xl': 16 }
      const aliased = radiusEntriesOf(
        [
          // 别名声明刻意放在**非首行**(真实文件里前面总有 import):取声明行的正则若漏 `m` 旗,
          // `$` 只在整个字符串末尾成立 ⇒ 除首行外每一条声明都解不到,而"解不到"表现为
          // 静默不折叠 ⇒ 门照报绿而别名整族隐身。本仓把 `/…$/` 少 `m` 旗记过两次,这条是它的行为版。
          "import { rnRadius } from '@ihui/design-tokens'",
          "import { View } from '@tarojs/components'",
          '',
          'const INPUT_RADIUS = rnRadius["2xl"]',
          '',
          'const styles = {',
          '  fieldShell: {',
          '    borderRadius: INPUT_RADIUS,',
          '  },',
          '}',
        ].join('\n'),
        tbl,
      )
      const unread = radiusEntriesOf(
        [
          'const styles = {',
          '  fieldShell: {',
          '    borderRadius: IMPORTED_RADIUS,',
          '  },',
          '}',
        ].join('\n'),
        tbl,
      )
      // 守门 11/77/150 共用的默认口径:别名形态整条读不出(RD 不因此长档)
      const untouched = radiusSetOf(
        'const styles = {\n  fieldShell: {\n    borderRadius: INPUT_RADIUS,\n',
        tbl,
      )
      return (
        JSON.stringify(aliased.entries) === JSON.stringify({ fieldShell: [16] }) &&
        aliased.unnamed === 0 &&
        aliased.unresolved === 0 &&
        unread.unresolved === 1 &&
        Object.keys(unread.entries).length === 0 &&
        JSON.stringify(untouched) === JSON.stringify([])
      )
    })(),
  )
  t(
    'KM @media 副本:同一条声明逐字再写一遍只算一份;@media 里改了值就是响应式真分叉,照计',
    (() => {
      const tbl = { xs: 2, sm: 4, md: 6, lg: 8, xl: 12, '2xl': 16 }
      const copy = radiusEntriesOf(
        [
          '.panel {',
          '  border-radius: 8px;',
          '}',
          '@media (min-width: 480px) {',
          '  .panel {',
          '    border-radius: 8px;',
          '  }',
          '}',
        ].join('\n'),
        tbl,
      )
      const diverging = radiusEntriesOf(
        [
          '.panel {',
          '  border-radius: 8px;',
          '}',
          '@media (min-width: 480px) {',
          '  .panel {',
          '    border-radius: 16px;',
          '  }',
          '}',
        ].join('\n'),
        tbl,
      )
      const anonCopy = radiusEntriesOf(
        [
          'const mk = () => ({',
          '  borderRadius: rnRadius.lg,',
          '})',
          '@media (min-width: 480px) {',
          '  const mk2 = () => ({',
          '    borderRadius: rnRadius.lg,',
          '  })',
          '}',
        ].join('\n'),
        tbl,
      )
      return (
        JSON.stringify(copy.entries) === JSON.stringify({ panel: [8] }) &&
        copy.unnamed === 0 &&
        JSON.stringify(diverging.entries) === JSON.stringify({ panel: [8, 16] }) &&
        diverging.unnamed === 0 &&
        anonCopy.unnamed === 1
      )
    })(),
  )
  t(
    'KN 装车锁(单位只有一份):门内不得再留第二份折算表,折算必须走 lib/length-units',
    (() => {
      const src = readFileSync(fileURLToPath(import.meta.url), 'utf8')
      return (
        !/\bTO_PX\b/.test(src) &&
        /from '\.\/lib\/length-units\.mjs'/.test(src) &&
        /facePx\(/.test(src) &&
        !/\/\s*RPX_PER_PX|RPX_PER_PX\s*\*/.test(src)
      )
    })(),
  )
  t(
    'KU 装车锁(根槽位维必须装车):读数在 --json 分支**之前**算好、红色折进退出码、' +
      'json 必须暴露 rootSlot —— 缺一条就是"有判据而没人调度",而账面读起来仍全绿',
    (() => {
      const src = readFileSync(fileURLToPath(import.meta.url), 'utf8')
      const at = src.search(/const rs = rootSlotAudit\(\s*collected\.pairs/)
      return (
        at >= 0 &&
        at < src.indexOf("if (argv.includes('--json'))") &&
        /rootSlot: \{\s*findings: rs\.findings/.test(src) &&
        /\+\s*\(geoRed \? 1 : 0\)\s*\+\s*rsRed\.length\s*\?\s*1\s*:\s*0/.test(src) &&
        /rootSlotDelta\(rs\.findings, baseRs\.findings\)/.test(src)
      )
    })(),
  )
  t(
    'KV 根槽位必须字符串安全:引号与模板串里的括号花括号不得破坏深度走查' +
      '(判据跟着字符串漂是同类洞 —— 漂一次的读数是看起来自洽的假分叉)',
    (() => {
      const tbl = { xs: 2, sm: 4, md: 6, lg: 8, xl: 12, '2xl': 16 }
      const src =
        'const s = "don\'t { break ( ["\n' +
        'const t = `x${y ? "(" : ")" }z`\n' +
        'export default function Foo() {\n' +
        '  return (\n' +
        '    <View className="rounded-lg">\n' +
        '      <View className="rounded-2xl" />\n' +
        '    </View>\n' +
        '  )\n' +
        '}\n'
      const r = rootSlotRadiiOf(src, tbl)
      return r.anchored === true && r.indirect === false && JSON.stringify(r.tiers) === '[8]'
    })(),
  )
  t(
    'KW 端到端(真 git 夹具):真 git 夹具上,内层档凑平集合时 RD 读 0 而 RS 点名 —— ' +
      'miniapp 把 2xl 放组件根、RN 放内层 ⇒ 两侧档位**集合**都是 {8,16},元素级凑平 ⇒ ' +
      'RD 读 0(findings 里没有 Foo),而 RS 在**根槽位**上读出 [16] vs [] 并点名',
    (() => {
      const fx = FIXTURE_BASE({
        rn: "import { Foo } from '@ihui/rn-app'\nexport function RootNavigator() { return <Foo /> }\n",
      })
      fx['apps/miniapp-taro/src/components/Foo.tsx'] =
        'export default function Foo() {\n  return (\n    <View className="rounded-2xl">\n      <View className="rounded-lg" />\n    </View>\n  )\n}\n'
      fx['packages/app/src/components/Foo.tsx'] =
        'export default function Foo() {\n  return (\n    <View>\n      <View className="rounded-2xl" />\n      <View className="rounded-lg" />\n    </View>\n  )\n}\n'
      // 档位表必须随夹具走:collect 对"表取不到而组件在用圆角"判失明。
      // 逐条目一行的真表同构(objectEntries 按行取条目,单行对象会解析为 null)。
      fx['packages/design-tokens/src/radius.js'] = [
        'export const RADIUS_STEPS = {',
        '  xs: 2,',
        '  md: 6,',
        '  lg: 8,',
        '  xl: 12,',
        "  '2xl': 16,",
        '}',
        'export const RADIUS_ROLES = {',
        "  chip: 'md',",
        "  card: 'lg',",
        '}',
        '',
      ].join('\n')
      const dir = makeFixtureRepo(fx)
      try {
        const got = collect(dir, 'head')
        const rd = audit(got.pairs, got.text, {}, got.tiers, got.radius, got.styles ?? {})
        const rs = rootSlotAudit(got.pairs, got.text, got.radius, got.styles ?? {})
        const f = rd.findings.find((x) => x.name === 'Foo')
        const r = rs.findings.find((x) => x.name === 'Foo')
        // 前提:RD 读 0(两侧集合相同 ⇒ 元素级也凑平,这一族不进 RD findings)
        // `rs.undetermined.length === 0` 这条不可省:空 findings 有两个来源(真的一致 / 判据瞎了),
        // 只看 findings 分不开 —— 而"分不开"正是本维要修的那个推断本身。
        return (
          !f &&
          rs.undetermined.length === 0 &&
          !!r &&
          JSON.stringify(r.miniapp) === '[16]' &&
          JSON.stringify(r.rn) === '[]'
        )
      } catch (e) {
        return `抛错:${e?.message ?? e}`
      } finally {
        rmScratch(dir)
      }
    })(),
  )
  console.log(`--self-test:${pass} 通过 / ${fail} 失败`)
  return fail ? 1 : 0
}

const isDirectRun = process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href

if (isDirectRun) {
  const argv = process.argv.slice(2)
  if (argv.includes('--self-test')) {
    const rc = runSelfTest()
    if (rc) console.error('❌ 自检失败')
    process.exit(rc)
  }
  try {
    process.exit(main(argv))
  } catch (e) {
    console.error(`❌ ${e?.message ?? e}`)
    process.exit(2)
  }
}

export const __test__ = {
  stripComments,
  toPx,
  readGeometry,
  radiusCount,
  namedConflicts,
  diffValues,
  diffCount,
  scan,
  pickCandidate,
  exitPreferMaps,
  styleLanguage,
  iconCarriers,
  clauseDemand,
  parseModuleEdges,
  readTaroPages,
  buildReach,
  pruneUnreachableLegs,
  collect,
  audit,
  verdictOf,
  emitBaseline,
  anchorRegression,
  elementRadiusDiff,
  elementRadiusCount,
  waiverProblem,
  faceFromArgv,
  chooseBaseline,
  parseBaseline,
}
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
