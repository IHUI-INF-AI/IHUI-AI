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
// 裸档形状单独一行导:把上面那条 import 折成多行会让"行级复活"判据把成员行读成搬回祖先形态(2026-10-11 实测)
import { bareRoundedOccurrences } from './lib/radius-tokens.mjs'
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
 *  - **端入口可达性剔除已装上**(2026-10-08 票 G-978049③):双侧各跑一遍图,种子面
 *    `SEED_DIRS.web = apps/web/app`(Next 的 page/layout 层就是框架真渲染的入口),`@/` 别名按
 *    web 的 tsconfig 解析;被剔的族逐条点名(`⊘ WD …… 从web端入口不可达`),web 种子取不到时
 *    整维**挂起留痕**而不是当成"都活着" —— 挂起那一句里的"本轮未做剔除"说的是这一轮,不是这一腿。
 *  - 只比**档值集合**(RD 量纲),不比元素名(RE 量纲):web 侧没有 StyleSheet 键可归属。
 *  - **裸档盲区(G-978049②,本腿与主腿同罪)**:档位提取式只认 `rounded-(xs|sm|md|lg|xl|2xl)`,
 *    裸写 `rounded` / `var(--radius)`(值 = 档位表 DEFAULT)读不出来 ⇒ "一端写裸档、另一端写具名档"
 *    会被读成"那一端没写档"。补认它必须与守门 77 / 150 的台账**同枚提交各自重锚**,不在本腿单独放宽;
 *    今天先由 `bareRoundedAudit` **逐条报名**(报数不进判据、不进退出码),给下一票当输入。
 */
const WEB_DIRS = ['apps/web/src/components', 'packages/ui-react/src/components']
export const WEB_LEDGER = {
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
  /**
   * 裸档报名(G-978049②):**两腿各算各的名单**,且不进判据、不进退出码 —— 它报的是
   * "这一维今天看不见多少",不是"发现了多少债"。档表取不到 DEFAULT 时 `defaultResolved:false`,
   * 由打印面如实写成"值未判定",绝不拿一个猜出来的 8 去冒充读数。
   */
  const bareRounded = {
    web: bareRoundedAudit(webPairs, text, radiusTable, 'web'),
    main: bareRoundedAudit(pairs?.pairs ?? [], text, radiusTable, 'main'),
  }
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
    bareRounded,
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
 * `export default` 去掉前缀后的文本里,**函数体**左花括号的偏移;读不到返回 -1。
 *
 * 为什么不能 `code.indexOf('{')`:参数是**解构形态**时(`export default function Carousel({
 * items = [] }: CarouselProps)` —— React 组件最常见的写法),第一个 `{` 是参数解构而不是函数体,
 * 深度走查在参数表收尾那一处 `}` 上立刻 `depth` 归 0 ⇒ 整族被判成"间接 return"。
 * 真仓实测代价:15 对配对**全部**落进"根槽位未判定",这一维对真仓零读数 —— 立票那一族
 * `Carousel` 正是如此(G-629:层要进判据,而判据读不到层 = "没看"与"已同层"在账面上分不开)。
 *
 * 括号配平必须在**遮罩后的文本**上做:字符串与模板串里的括号已由 `maskStringsForDepth` 抹成
 * 空格(长度不变),于是 `className="don't ( break"` 这类写法不会把配平带偏 —— 与本函数其余
 * 走查同一条前提。
 *
 * 参数表之后可能还有一段类型注解(`}: CarouselProps)` / `): JSX.Element =>`),所以取的是
 * 配平收尾之后的**第一个** `{`。类型注解里若真的内嵌对象类型(`): { a: 1 } {`),取到的是注解的
 * 花括号 —— 那一格退化成"读不到 return ⇒ 间接",方向是漏判不是误判(宁可"没看"不冒充"同层")。
 */
function bodyOffsetOf(after) {
  let from = 0
  if (/^(?:async\s+)?function\b/.test(after) || after.startsWith('(')) {
    const open = after.indexOf('(')
    if (open < 0) return -1
    const close = matchParenAt(after, open)
    if (close < 0) return -1
    from = close + 1
  } else if (/^[A-Za-z_$][\w$]*\s*=>/.test(after)) {
    const gt = after.indexOf('=>')
    if (gt < 0) return -1
    from = gt + 2
  } else if (!/^(?:async\s+)?class\b/.test(after)) return -1
  return after.indexOf('{', from)
}

/** 从 `open`(必须是 `(`)起配平到对应的 `)`;读不到返回 -1。 */
function matchParenAt(text, open) {
  let depth = 0
  for (let i = open; i < text.length; i++) {
    const c = text[i]
    if (c === '(') depth++
    else if (c === ')') {
      depth--
      if (depth === 0) return i
    }
  }
  return -1
}

/**
 * 从 `export default` 起,取组件体顶层 `return` 直接吐出的那个元素上的圆角档(px 数组)。
 *
 * @param {string} src 组件源文本
 * @param {Record<string, number>|null} table `radiusLookup` 的档位表
 * @returns {{anchored:boolean, indirect:boolean, tiers:number[]|null}}
 */
export function rootSlotRadiiOf(src, table) {
  // 注释遮罩必须**等长**(pad):下面的取材按同一套下标 slice 原文,删注释会让下标左移。
  const mat = stripComments(String(src ?? ''), true)
  const code = maskStringsForDepth(mat)
  const defAt = code.search(/\bexport\s+default\b/)
  if (defAt < 0) return { anchored: false, indirect: false, tiers: null }
  /**
   * `export default` 后面是什么,决定这一维**有没有得看**:
   *  - 具名/匿名函数、类、箭头函数 ⇒ 组件体在本文内,根槽位可判;
   *  - 任何**不是**上述形态的东西(`withMemo(Foo)` / `connect(…)(Foo)` / 一个裸标识符)
   *    ⇒ 组件体在别处,本文里没有"顶层 return 直接吐出的那个元素"可读。
   * 这两种都必须**如实报**,不得当成"这个组件根上没有圆角"。
   */
  const whole = code.slice(defAt)
  const after = whole.replace(/^\s*export\s+default\s+/, '')
  const isFnBody =
    /^(?:async\s+)?(?:function\b|class\b|\(\s*[^)]*\)\s*=>|[A-Za-z_$][\w$]*\s*=>)/.test(after)
  const bodyOpen = isFnBody ? defAt + (whole.length - after.length) + bodyOffsetOf(after) : -1
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
  if (isLocallyDeclaredComponent(code, tagName, src))
    return { anchored: true, indirect: true, tiers: null }
  if (!table) return { anchored: true, indirect: false, tiers: null }
  /**
   * 取材走**未遮字符串的原文**(`mat`:字符串完整、注释遮成空格且与 `code` 等长下标):圆角档就写在
   * `className="rounded-lg"` 的**引号内**,用遮罩后的文本读会把它抹成空格(判据失明);而用删除式
   * 剥注释的原文按下标取,又会被注释块挪位(取到隔壁材料)。深度定位在遮罩上做、取材在等长
   * 原文上做,两步的分工是这一格能同时满足"字符串安全"与"读到真档"的原因。
   */
  const tagText = mat.slice(exprAt, tagEnd + 1)
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
 * 这个标签名是不是**本文件里定义/声明**或"从业务文件 import 进来的代渲染组件"
 * (而不是宿主元素)。
 *
 * 只认两种声明形态(`function Foo` / `class Foo` / `const Foo =`)—— 只有它们能构成
 * "根由子组件代渲染"。
 *
 * ⚠️ **平台库 import 的是宿主元素,不是代渲染组件**(2026-10-11 修,G-629 阳性对照逼出来的):
 * `import { View } from '@tarojs/components'` / `import { View } from 'react-native'` 落在旧写法的
 * import 分支里,于是真仓每一支组件(它们全都 import 宿主元素)都被判成"根由子组件代渲染",
 * RS 整维对真仓**零读数**(15 对全部"未判定")。这与本维自己的说明相抵:"宿主元素不在本地声明
 * 表里 ⇒ 就是根槽位本身" —— 平台包名就是那条边界:react-native* / @tarojs/components 出来的
 * 名字是**屏幕上的那个盒子本身**,读它的根槽位才是读层;业务文件 import 进来的名字才由别处渲染。
 * 分界住在包名上而不是名字表上:名字表要跟着平台维护,而"哪个包是平台"一句话说得清。
 *
 * ⚠️ import 分支必须在**未遮字符串的原文**上做:`maskStringsForDepth` 保留引号、把内容抹成
 * 空格,于是 `'@tarojs/components'` 在遮罩里成了 `'   …   '` —— 捕获回来的是空白,包名永远
 * 匹配不上宿主表,上面那条边界等于白画(实测:平台 import 仍被判成代渲染)。声明形态判断
 * 用遮罩文本(要吃花括号配平),包名判断吃原文(包名就住在字符串里),两边各取所需。
 *
 * ⚠️ import 必须**逐条语句**匹配:`import\s[^;]*\bTag\b[^;]*from` 在本仓(no-semicolon 风格)
 * 会跨语句 —— 真仓实测它把首条 `import { useTt } from '@/i18n'` 与第 6 行的 `View` 缠在一起,
 * 再贪婪吃到最后一个 `from '@/utils/rpx'`,捕获到的包名张冠李戴 ⇒ 宿主判定恒 false。
 * 这里改用「从 `import` 起、条款里不许出现引号/分号、到最近一个 `from '…'` 为止」的逐条式:
 * 条款含引号即越界(有引号说明撞上了副作用 import `import './x.css'`),天然不跨语句。
 */
const HOST_PKG_RE = /^(?:react-native(?:$|-)|@tarojs\/components(?:$|\/))/
const IMPORT_STMT_RE = /\bimport\s+(?!type\b)([^'";]*?)\s+from\s*['"]([^'"]+)['"]/g
function isLocallyDeclaredComponent(code, tagName, raw) {
  const decl = new RegExp(
    `(?:^|[\\s;{(])(?:export\\s+default\\s+|export\\s+)?(?:async\\s+)?(?:function\\s+${tagName}\\b|class\\s+${tagName}\\b|(?:const|let|var)\\s+${tagName}\\s*=)`,
    'm',
  )
  if (decl.test(code)) return true
  // 条款里的名字必须是**整词**命中:`View` 不得被 `ViewGroup` 这类子串骗过。
  const bound = new RegExp(`(?:^|[\\s,{])${tagName}(?![\\w$])`)
  for (const m of stripComments(String(raw ?? code)).matchAll(IMPORT_STMT_RE))
    if (bound.test(m[1])) return !HOST_PKG_RE.test(m[2])
  return false
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
 *  - 几何(G)与元素圆角(RE)自 2026-10-15 起**这一腿真判** —— 此前 `geometry`/`named` 恒空,
 *    于是"web 与小程序同名组件的盒档不同"这一型只在盘点脚本里量得到、提交链上看不到,
 *    而 AGENTS §4 跨端铁律第一句写的正是"web 与 miniapp-taro 视觉必须完全一致"。
 *    web 侧走 `'rn'` 那一支读档(px/dp 直通,不做 rpx 折半),与主腿对 RN 腿的口径同源。
 *  - **图标载体(IC)这一维仍未判** ⇒ 不得把 `判红 0` 读成"web 与小程序已一致"。
 *  - 两侧都读不出任何档 ⇒ 记**未判定**而不是"同档"(没量到与量到零是两件事)。
 *  - 档位表解析不出来(`radiusTable` 为空)⇒ 整腿未判定,不得当成"web 腿零分叉"。
 */
export function webRadiusAudit(webPairs, text, radiusTable, styles = {}, tiers = {}) {
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
    /**
     * G / named 与主腿**同一批 helper**(readGeometry / namedConflicts / diffValues),
     * 不在这里另写一份提取式 —— 两处算同一件事必漂移(§22c)。第 3 参 `'rn'` 是单位口径选择器:
     * web 与 RN 同为 px/dp 直通,只有 miniapp 那一侧要折 rpx→px。
     */
    const ga = readGeometry(aAll, 'miniapp', tiers)
    const gb = readGeometry(bAll, 'rn', tiers)
    const mini = new Set(radiusSetOf(aAll, radiusTable, { side: 'miniapp' }))
    const web = new Set(radiusSetOf(bAll, radiusTable))
    const erA = radiusEntriesOf(aAll, radiusTable)
    const erB = radiusEntriesOf(bAll, radiusTable)
    const elementRadius = elementRadiusDiff(erA.entries, erB.entries)
    if (!ga.values.size && !gb.values.size && !mini.size && !web.size) {
      undetermined.push({ name: p.name, why: '两侧都读不出几何档与圆角档 ⇒ 零判据(不是"两端同值")' })
      continue
    }
    findings.push({
      name: p.name,
      web: p.rn,
      miniapp: p.miniapp,
      named: namedConflicts(ga.named, gb.named),
      geometry: diffValues(ga.values, gb.values),
      radius: {
        onlyMiniapp: [...mini].filter((v) => !web.has(v)),
        onlyRn: [...web].filter((v) => !mini.has(v)),
      },
      elementRadius,
      webSeen: { miniapp: [...mini], web: [...web] },
    })
  }
  return { findings, undetermined }
}

/**
 * **裸档取用的报名(G-978049②)—— 只报名,不进任何判据、不进退出码。**
 *
 * 为什么必须在尺子里而不是在注释里:提取式读不到裸 `rounded` 这件事,今天的全部表现是
 * "那一端没写档" —— 与"那一端真的没写档"在账面上**完全同形**。本门已经吃过一次这个形状
 * (Tooltip 一族被读窄,现读小程序那行改前裸 `rounded` 隐身、只显 web 的 6),而它不是判据错,
 * 是判据不知道自己没看见。所以这一格的正解是把"看不见多少"跟着读数一起印出来,而不是顺手
 * 放宽提取式 —— 后者会同时移动守门 77 的 HEAD 棘轮、守门 150 的角色档台账与本门三维锚点,
 * 票面明令三处必须在同一枚提交里各自重锚(§O81 票⑬:"重锚的正当性靠'中和本次读数改动后的
 * 旧口径'证明,不靠只降不升")。
 *
 * 什么算裸档由 `lib/radius-tokens.mjs` 的 `bareRoundedOccurrences` 那一份实现给 ——
 * 本门不得再抄一份正则(两处算同一件事必漂移,本仓记过最多次)。
 *
 * @param {Array<{name:string,miniapp:string,rn:string}>} pairs 该腿的配对(主腿或 web 腿)
 * @param {Record<string,string>} text 已按被审面取满的源码
 * @param {{DEFAULT?: number}|null} table 档位表(取不到 DEFAULT 时 px 落 null 并如实报名)
 * @param {string} legName 报告里点名是哪条腿(web / main);两腿的名单不得并成一个数,
 *   因为处置动作不同(web 侧裸档 = web 少一档,主腿裸档 = 某端少一档)
 */
export function bareRoundedAudit(pairs, text, table, legName) {
  const out = []
  let total = 0
  for (const p of pairs ?? []) {
    for (const side of ['miniapp', 'rn']) {
      const rel = p[side]
      if (!rel || typeof text[rel] !== 'string') continue
      const hit = bareRoundedOccurrences(text[rel], table)
      if (!hit.count) continue
      total += hit.count
      out.push({
        leg: legName,
        name: p.name,
        side: side === 'rn' && legName === 'web' ? 'web' : side,
        file: rel,
        count: hit.count,
        px: Number.isFinite(table && table.DEFAULT) ? table.DEFAULT : null,
        lines: hit.samples.map(
          (s) => `${s.line}:${s.raw}${s.px === null ? '(值未判定)' : `=${s.px}`}`,
        ),
      })
    }
  }
  return {
    total,
    defaultPx: Number.isFinite(table && table.DEFAULT) ? table.DEFAULT : null,
    sites: out,
    defaultResolved: Number.isFinite(table && table.DEFAULT),
  }
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
   * web 腿的豁免筛选必须**用本腿自己的三个计数键**(G/RD/RE)判"还有没有差异":只用主腿口径会让
   * 每条 web 豁免在第一次重锚时被静默撤下 —— 撤下的表现不是红,而是那一族回到"锚点还在、理由没了"的状态,
   * 下一个人无从知道它为什么允许不同形。所以本腿按**它自己真在量的那三维**(G / RD / RE)筛。
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
    collected.tiers,
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
        // 裸档盲区也要能被机器读(G-978049②):下一票要同批重锚 77/150/128 三本账时,
        // 它的输入就是这两份名单 —— 只印人读面就等于把取证退回复制粘贴终端输出。
        bareRounded: collected.bareRounded ?? null,
        // web 腿也要能被机器读:只有人读面的话,下一票(把 web 的几何也纳进来)就得抄终端输出当数据源。
        web: {
          pairCount: web.findings.length,
          /** 只量圆角档是**这一腿的设计边界**,不是"几何已确认相同" —— 把它写进读数旁边,
           *  否则 `webRed: 0` 会被读成"web 与小程序已一致"。 */
          dimension: 'G+RD+RE(文件级几何档 / 文件级档值集合 / 同名元素档);IC 与 RS 未判',
          findings: web.findings.map((f) => ({
            name: f.name,
            miniapp: f.miniapp,
            web: f.web,
            /**
             * 机器面必须与主腿**同键同形**(diffCount / radiusCount / elementRadiusCount + 原始集合)。
             * 此前只递 `radius`,于是 `web.findings[i].geometry` 在 json 里根本不存在,而同一份
             * json 的 `web.red[i].geometry` 有值 —— 两个字段在同一台输出机上互不吻合,读 json 的
             * 人或脚本会得出"这腿没判几何"的结论,而报告行明明点出了分叉。
             */
            diffCount: diffCount(f),
            radiusCount: radiusCount(f),
            elementRadiusCount: elementRadiusCount(f),
            geometry: f.geometry,
            named: f.named,
            radius: f.radius,
            elementRadius: f.elementRadius,
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
      /**
       * 几何段必须带**维度前缀**,与下面的 `RD` / `RE` / `WD` 一样各说各话(G-629 登记的读数矛盾):
       * 不带前缀时,`○ Carousel … 仅小程序档 2/4/8/14/16/20` 紧挨着 `RD 仅小程序 8` 排在一行,
       * 读者把 14(text-sm)/20(text-xl)折出的**字号**当成圆角档去对档位表(xs2/sm4/md6/lg8/xl12/2xl16),
       * 自然对不上 —— 现读实测 14/20 只出现在几何段,圆角集合两侧都是 [4,6,16]。前缀是让
       * "这是盒档/字档的差,不是圆角差"写在读数上;不改任何集合与命中(子串 `仅小程序档` 保留)。
       */
      if (f.geometry.onlyMiniapp.length)
        bits.push(`几何仅小程序档 ${f.geometry.onlyMiniapp.join('/')}`)
      if (f.geometry.onlyRn.length) bits.push(`几何仅 RN 档 ${f.geometry.onlyRn.join('/')}`)
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
     * 这一腿现在量 G+RD+RE,**IC 与 RS 两维仍未判**,必须自己说出来 —— 不说,`判红 0` 就会被
     * 读成"web 与小程序已一致"(读报告的人不知道哪一格是空的,正是本仓"把没判写成判过了"那一型)。
     */
    {
      const wlines = []
      for (const f of web.findings) {
        const bits = []
        if (f.geometry.onlyMiniapp.length) bits.push(`仅小程序几何 ${f.geometry.onlyMiniapp.join('/')}`)
        if (f.geometry.onlyRn.length) bits.push(`仅 web 几何 ${f.geometry.onlyRn.join('/')}`)
        if (f.radius.onlyMiniapp.length) bits.push(`仅小程序档 ${f.radius.onlyMiniapp.join('/')}`)
        if (f.radius.onlyRn.length) bits.push(`仅 web 档 ${f.radius.onlyRn.join('/')}`)
        for (const m of f.elementRadius?.mismatched ?? [])
          bits.push(`RE 同名元素 ${m.name} 小程序 ${m.miniapp.join('/')} vs web ${m.rn.join('/')}`)
        for (const nm of f.named ?? []) bits.push(`同名具名档 ${nm.name ?? JSON.stringify(nm)}`)
        const mark = webVerdict.red.some((r) => r.name === f.name) ? '×' : '·'
        wlines.push(`  ${mark} WD ${f.name} ${bits.join(' | ')}`)
      }
      const wPruned = collected.webUnreachableLegs ?? []
      console.log(
        `web 腿(G+RD+RE 量纲,配对 ${web.findings.length} 对` +
          (wPruned.length ? `,另剔 ${wPruned.length} 对死腿` : '') +
          `;图标载体 IC 与根槽位 RS 两维**未判**,不是"已确认相同")` +
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
      /**
       * **裸档盲区跟着读数一起印(G-978049②)**。不印的代价是这句会被读成"配对文件里没有裸档":
       * 提取式今天读不到 `rounded` / `var(--radius)`(值 = 档位表 DEFAULT),所以"读不出"与
       * "没有"在这条腿的产物里是同一个数。补认它要 77/150/128 三本账同枚重锚(见门内头注),
       * 不在本腿单独放宽判据 ⇒ 这里只报名,不判红、不改退出码。
       */
      {
        const br = collected.bareRounded ?? { web: { total: 0 }, main: { total: 0 } }
        const nWeb = br?.web?.total ?? 0
        const nMain = br?.main?.total ?? 0
        const valNote =
          br?.web?.defaultResolved === false
            ? '(档位表没读到 DEFAULT ⇒ 这些裸档的**值未判定**,不得拿猜的 8 冒充)'
            : `值 = DEFAULT ${br?.web?.defaultPx}`
        console.log(
          `  ⊘ 裸档盲区(不判红、不进退出码):配对文件里读到 ${nWeb} 处(web 腿)/ ${nMain} 处(主腿)` +
            `裸 rounded / var(--radius),${valNote} —— 它们**未计进档集合**,` +
            `"一端写裸档、另一端写具名档"会被读成"那一端没写档";逐条见 --json 的 bareRounded`,
        )
      }
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

const isDirectRun = process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href

if (isDirectRun) {
  const argv = process.argv.slice(2)
  if (argv.includes('--self-test')) {
    // 自检/fixture 段已拆到 scripts/lib/cross-end-ui-parity-selftest.mjs;按需动态加载,
    // 主文件不反向 await import —— 自检件静态 import 本文件,顶层 await 会与之成环死锁;
    // 不 await,让本模块同步完成求值后再兑现 .then,--self-test 行为与拆分前一致。
    import('./lib/cross-end-ui-parity-selftest.mjs').then(
      ({ runSelfTest }) => {
        const rc = runSelfTest()
        if (rc) console.error('❌ 自检失败')
        process.exit(rc)
      },
      (e) => {
        console.error(`❌ 自检件加载失败:${e?.message ?? e}`)
        process.exit(2)
      },
    )
  } else {
    try {
      process.exit(main(argv))
    } catch (e) {
      console.error(`❌ ${e?.message ?? e}`)
      process.exit(2)
    }
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
  webRadiusAudit,
  bareRoundedAudit,
  WEB_LEDGER,
  verdictOf,
  emitBaseline,
  anchorRegression,
  rootSlotRadiiOf,
  rootSlotAudit,
  rootSlotDelta,
  elementRadiusDiff,
  elementRadiusCount,
  waiverProblem,
  faceFromArgv,
  chooseBaseline,
  parseBaseline,
}
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
