// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * NavBar 顶部导航栏的结构与几何单一源(小程序端与 RN 端共用),形状照 back-chevron-spec。
 *
 * 两端真实实现:apps/miniapp-taro/src/components/NavBar.tsx ↔ apps/mobile-rn/src/components/NavBar.tsx。
 * ⚠ 读数纠偏@2026-10-28(现读,不是沿抄旧句):`packages/app/src/components/NavBar.tsx` **仍在 HEAD**
 * (最后一次入库改动 = 3d8a7a3355,2026-10-25;由 a32453060a 重新加入),旧句"2026-10-25 按 §7 删除"
 * 与事实不符。它当前**零消费者** —— 全仓无任何 import、`packages/app/src/index.ts` 未导出它 ⇒
 * 既不在守门 128 的配对腿上,也不是本 spec 的消费方。本票只把它记成"死副本",不把死代码当活账;
 * 删/留归机主裁决(§7:有等价实现才可删,但它是被"共享层四票收口"后加的,不在本票射程内)。
 *
 * 消费方式只能是子路径 `@ihui/shared/ui/navbar-spec`(禁挂根桶,根桶会把整棵 src/chat 拉进被检程序)。
 * spec 内只存逻辑 px;小程序端换算 `(px) => rpx(px * TARO_RPX_PER_PX)`,RN 端 1:1。
 *
 * 取值裁决(两端分叉时的定档依据,AGENTS.md §4 / O81 交付标准):
 *  1. web 端同一元素有既有值 → 取 web;
 *  2. 否则取触控与可读更稳的一档(字号 ≥12、间距取两端较大者);
 *  3. 平台机制不同的数值对齐、通道各端保留 —— 见文件末「单腿档清单」。
 *
 * ── O02 票④(第 ④ 格)收口证据:本族"只剩一份源"────────────────────────────
 * 现读 2026-10-28(`node scripts/check-cross-end-ui-parity.mjs --json`):
 *   findings[NavBar] = diffCount 7 / radiusCount 1(RD 仅小程序 4,端上实取 4)/ elementRadiusCount 0;
 *   同名档取值冲突(named)= 0、RE 维同名元素圆角分叉 = 0 族;SL NavBar(5) 仅 RN 引用
 *   NAVBAR_ROW_HEIGHT_PX / NAVBAR_ROW_HEIGHT_SUBTITLE_PX / NAVBAR_SIDE_PLACEHOLDER_PX /
 *   NAVBAR_SUBTITLE_FONT_PX / NAVBAR_SUBTITLE_MARGIN_TOP_PX。
 * 两条腿的**共用**几何档全部经本文件取数,端内不再自持"跨端可共享"的数值 —— 两端 import 点:
 *   · apps/miniapp-taro/src/components/NavBar.tsx  →  '@ihui/shared/ui/navbar-spec'
 *   · apps/mobile-rn/src/components/NavBar.tsx     →  '@ihui/shared/ui/navbar-spec'
 *
 * 7 档逐条归属 —— **没有一条属于"本可同值却各写一份"**(那一型才是本票要拆的):
 *
 *  A 一端根本没有该元素 / 该结构(往另一端补引用 = 往屏幕上加一个不存在的节点):
 *    仅小程序 13  微信胶囊兜底 `{ top: 26, height: 32 }`;RN 状态栏由 App.tsx SafeAreaView 单点注入,
 *                 无对应元素。⚠ 13 是门把 26 按"小程序裸数字 = rpx"折半读出的**量纲误读**,真值 26px。
 *    仅 RN 2      SUBTITLE_MARGIN_TOP  小程序 NavBarProps 无 subtitle 字段(全仓传参 0 处)
 *    仅 RN 4      RN hitSlop left/right(命中扩张通道;小程序无该属性)
 *    仅 RN 12     SUBTITLE_FONT        同上,小程序腿没有副标题这个元素
 *    仅 RN 32     SIDE_PLACEHOLDER     小程序居中走 absolute 悬浮钮 + justify-center,结构上无占位元素
 *    仅 RN 44     ROW_HEIGHT           小程序行高 = 微信胶囊实测 height + 8(平台量,见 waivers)
 *    仅 RN 56     ROW_HEIGHT_SUBTITLE  同上
 *
 *  B 已裁决的变体契约:本族 **0 枚**(7 档全部落在 A 或下面的 C)。
 *
 *  C 同槽位但两端各由自身机制决定(数值必须对齐,通道不合并):
 *    z-index 1001  小程序 ai-home `z-[1001]` 类名 vs RN STICKY_STYLE `zIndex: 1001`。
 *                  类名是 Tailwind 任意值,**无法由 TS 常量生成**(动态拼接的类名会被 purge),与
 *                  input-area-spec 头注第 6 条 `h-48` 同型 ⇒ 档留在端内、不搬进本表;
 *                  但"两端同值"这件事由 __tests__/navbar-wiring.test.ts 第 ⑨ 条逐端现读比对
 *                  (改一端不带另一端走 ⇒ 红),不靠散文。
 *    6 / 8 / 16 / 20 这四枚两端都出现,但**不是同一个槽位**:小程序的 6 是侧钮之间 `gap-[12rpx]`、
 *                  8 是通知条 `py-[16rpx]`;RN 的 6 是 actionBtn 内水平留白、8 是 hitSlop。
 *                  同名数值不同槽,不得按"值相同"并成一个档(那是归因过宽,比漏读更贵)。
 *
 * ⇒ 结论:本族**无可继续收敛项** —— A 组补引用是造假,C 组的类名通道无法由常量驱动,
 *   B 组 0 枚。counts 维持 7(diff)/ 1(RD)。逐档归属由
 *   packages/shared/src/ui/__tests__/navbar-wiring.test.ts 机器钉住:谁往"另一端"补了引用、
 *   哪一端把取用退成裸数字、哪一端把 z-index 改成另一个数,对应那条用例就红。
 */
import { GEOMETRY_PX } from '@ihui/design-tokens'

/** 每端注入的单位换算(一个逻辑 px 到该平台数值);泛型把单位类型带出来。 */
export type GeometryUnit<U extends string | number> = (px: number) => U

/**
 * 标题行高 44:RN 端现档(44 = iOS 标准导航栏高,亦是触控可读的稳档)。
 * 小程序端行高由微信胶囊实测推导(menuButton.height + 8),属平台机制,见 waives 第 1 条。
 */
export const NAVBAR_ROW_HEIGHT_PX = 44

/** 带副标题时的行高 56:RN 端现档;副标题是双行文本,单行档装不下。 */
export const NAVBAR_ROW_HEIGHT_SUBTITLE_PX = 56

/** 左右内边距 10:两端现值已同(小程序 ai-home `20rpx` = 10px,RN `paddingHorizontal: 10`),收进一处防分叉。 */
export const NAVBAR_SIDE_PADDING_PX = 10

/**
 * 侧占位宽 32:**RN 腿档**(空侧补一块把标题夹在中间)。取值出处 = 两端较大者(小程序右钮 h-8 = 32),
 * 但消费面只有 RN:小程序腿的居中走 absolute 悬浮钮 + justify-center,结构上没有占位元素。
 */
export const NAVBAR_SIDE_PLACEHOLDER_PX = 32

// 返回箭头墨迹(20 = GEOMETRY_PX.glyphMd)归 back-chevron-spec 单一源,NavBar 侧不再出这份副本
// ——2026-10-27 撤零消费出口 NAVBAR_BACK_GLYPH_PX。

/** 侧按钮最小宽 28:RN 端 2026-09-23 P1 修复的既定格(给标题留横向空间,勿回升);小程序端原 20px 盒收口到 28。 */
const NAVBAR_ACTION_MIN_WIDTH_PX = 28

/**
 * 侧按钮高 32:RN 端现档;小程序端 rightText `h-8` = 32px,两端同值收一处。
 * **两端都必须只经 `navbarActionBoxStyle` 消费它**(与下面的最小宽同一条盒子):
 * 端内点名这枚档 = 端自己重排盒子(小程序端此前写 `height: toUnit(NAVBAR_ACTION_HEIGHT_PX)`
 * 并用它做垂直居中算术),那既是第二份真相,又让守门 128 的 SL 把它报成"另一条腿没接线"。
 */
const NAVBAR_ACTION_HEIGHT_PX = 32

/** 侧按钮图标墨迹 20:引用 GEOMETRY_PX.glyphMd(小程序 ai-home 菜单钮已是 40rpx=20px,RN 18→20)。 */
export const NAVBAR_ACTION_GLYPH_PX = GEOMETRY_PX.glyphMd

/** 侧按钮文字 14:取两端较大者(小程序 rightText 14px vs RN actionLabel 12),规则 2 可读更稳。 */
export const NAVBAR_ACTION_LABEL_FONT_PX = 14

/**
 * 标题字号 16:web 顶栏标题档 + RN 端 2026-09-23 P1 修复定格(18→16,防"智汇AI"截断);
 * 小程序 ai-home 15px / 默认 16px 统一收口到 16。
 */
export const NAVBAR_TITLE_FONT_PX = 16

/**
 * 副标题字号 12:**RN 腿档**。原先注的"两端现值已同(RN 12 / 共享层 12)"是假话——那个"共享层"是
 * `packages/app/src/components/NavBar.tsx` 的 DOM 副本(div/span 形态,不在 RN 屏上渲染、也不消费本
 * spec),不是守门 128 的配对腿。小程序腿 `NavBarProps` 现读只有 title/onBack/rightText,无 subtitle 字
 * 段,全仓给小程序 NavBar 传 subtitle 的调用点 0 处;RN 腿有 PatrolScreen 等屏真在传。补引用 = 造一个
 * 渲染不到的数字。
 */
export const NAVBAR_SUBTITLE_FONT_PX = 12

/** 副标题与主标题间距 2:**RN 腿档**(小程序腿没有"主标题下方再一行"这层结构,无从给间距)。 */
export const NAVBAR_SUBTITLE_MARGIN_TOP_PX = 2

/**
 * 本族**不立的档**(须登记台账 waivers,不得搬进本表冒充"已同值"):
 *  - 返回命中块 36:它**不是 NavBar 的档**,而是 `GEOMETRY_PX.tapBox` —— 唯一消费点是
 *    `backChevronBoxStyle`,两条腿的返回键各自经过它拿到同一个 36(小程序端 `<BackChevron>`,
 *    RN 端 `styles.backBtn`)。NavBar 本体此前又点一次名(拿 36 做垂直居中算术)= 第二个名字,
 *    已于 2026-09-27 删除:居中改由"行盒高度的 flex 容器"完成,NavBar 不需要知道箭头方块多大。
 *  - 双标题 tab 间距(小程序 ai-home `gap-[40rpx]` = 20px):RN 端无该元素(标题区是 title + subtitle
 *    双行,不做 tab 切换)。单端独有档若搬进本表并只被一端正消费,对账门读数会归零而另一端什么都没
 *    渲染 —— 那正是"制造绿灯",所以档留在端内 + 记 waiver。
 *  - hitSlop(RN 12 / 8 / 4)与 RN 的"图标 + 文字并排 gap 4":RN 独有命中扩张通道 / RN 独有的
 *    icon+label 并排形态 —— 小程序腿没有这两个元素(现读 hitSlop 命中 0 处),档留在端内,不搬进本表。
 *  - 微信胶囊实测兜底档(小程序 `{ top: 26, height: 32 }`,**单位是逻辑 px**)与 notification
 *    区内边距(`px-[32rpx]`/`py-[16rpx]`/`ml-[16rpx]` = 16px / 8px):平台量 + 端内独有子元素。
 *    ⚠️ 读数纠偏@2026-10-27(现读,不是推断):`apps/miniapp-taro/src/utils/rpx.ts` 的 `px(n)` 就是
 *    `${n}px`(真 CSS px,与 rpx 无关),而这两个值由 `px(statusBarHeight)` / `px(navBarHeight)` 落地
 *    ⇒ 兜底档真值是 **26px / 32px**。守门 128 对这个对象字面量按"小程序端裸数字 = rpx"折半,于是报出
 *    `仅小程序档 13`(= 26/2)——那是**量纲误读**,不是两端分叉,更不是"门读不到"(旧文案如此写,已作废)。
 *    32 因 RN 侧另有 32(sidePlaceholder / 按钮盒)已同值,故只剩 13 一枚显形;它对面根本没有对应元素
 *    (RN 的状态栏由 App.tsx SafeAreaView 单点注入),属单侧结构档。
 *    见文件末「单腿档清单」第 1 条。兜底对象的键名必须保持 `top`/`height` —— 它是
 *    `getMenuButtonBoundingClientRect()` 返回形状的替身,改名就不是同一个 API 的兜底了。
 *  - (圆角通道,2026-10-27 登记)本族 `RD 仅小程序 4` 来自 ai-home 「加入社区群」胶囊的
 *    `borderRadius: rnRadius.sm`(4)。RN 端**没有这枚带边框 CTA**(侧钮是图标/图标+文字,
 *    见上文"刻意不覆盖"条)⇒ 单侧元素,不得为消 RD 给 RN 补圆角。
 */

/**
 * 2026-09-27 逐条核过的**单腿档清单**(守门 128 对本族报 SL 的正是这五枚,处置动作各不同,
 * 不得用"给另一条腿补一个数字"消账):
 *  - NAVBAR_ROW_HEIGHT_PX(44)/ NAVBAR_ROW_HEIGHT_SUBTITLE_PX(56):小程序端行高是胶囊实测值,
 *    平台量,两腿不可能同名同数 → 属机制差异,已登记
 *    `scripts/cross-end-ui-parity-baseline.json` 的 `waivers.NavBar`(带 reason 与 until;2026-10-27 现读复量)。
 *  - NAVBAR_SUBTITLE_FONT_PX(12)/ NAVBAR_SUBTITLE_MARGIN_TOP_PX(2):小程序端 NavBar **根本没有
 *    subtitle 这个元素**(props 里没有该字段),头注写的"两端现值已同"里的"共享层"是
 *    `packages/app` 那份 DOM 死副本,不在守门 128 的配对腿上。补齐要么给小程序端加 subtitle
 *    能力(§24 属新功能,须用户确认),要么把这两枚档改标"RN 腿独有"。
 *  - NAVBAR_SIDE_PLACEHOLDER_PX(32):RN 用"空侧占位"把标题夹在中间居中;小程序端默认模式是
 *    `absolute` 悬浮按钮 + 整条 `justify-center`,居中机制不同 → 该 32 在小程序端没有对应元素。
 *    小程序端侧按钮的 32 高改经 `navbarActionBoxStyle` 取得后,这一档不再是"巧合对齐"。
 */

/**
 * 标题最大宽 150:同一元素(顶栏标题文字)的截断上限,两端同值。
 * 两端原值:小程序 ai-home `maxWidth: rpx(300)` = 150px(继承原项目 navigation-bars 定宽档)、
 * RN 端**无上限**(只靠 flex 可用空间,375 屏约 291px)⇒ 同一条标题两端截断点不同。
 * ⇒ 规则 1 不适用(web 顶栏是桌面 TagsView 标签条,与移动端 App 栏标题非同一元素,无 px 档可引);
 * ⇒ 规则 2 取两端较大者在 RN 侧不可量化(无上限),故取唯一确定存在的档 150,
 *   RN 端标题补同一上限 ⇒ 两端渲染到屏幕上的宽度相同(小程序侧数值一字未改)。
 */
export const NAVBAR_TITLE_MAX_WIDTH_PX = 150

/**
 * 标题区最小宽 80:RN 端 2026-09-23 P1 修复的既定格(容纳 4 个 16px 中文字,防"智汇AI"被压成"智汇…")。
 * 两端原值:RN `center.minWidth: 80` / 小程序端**没有这条约束**(标题容器只有 flex-1)
 * ⇒ 规则 1 不适用(web 顶栏标题用 `min-w-0 flex-1`,刻意不给下限,与本档方向相反),
 * 按规则 2 取"有约束的一端"= 80,小程序端补齐同一档 ⇒ 两端标题区同一下限(不是只改声明)。
 */
export const NAVBAR_CENTER_MIN_WIDTH_PX = 80

/**
 * 侧按钮文字宽度上限 60:RN 端现档(图标 + 调用方文案并排,须给标题留横向空间)。
 * 两端原值:RN `actionLabel.maxWidth: 60` / 小程序端 `rightText` **无上限**(长文案会挤掉标题)
 * ⇒ 规则 1 不适用(web 顶栏无同一元素),按规则 2 取已有约束的一端 = 60,小程序 rightText 补同一档。
 * 刻意**不覆盖 ai-home 的"加入社区群"胶囊按钮**:那是小程序独有的带边框 CTA(5 字 ≈ 70px),
 * 套 60 会直接截断既有文案 —— 那不是同一枚元素,拉平即制造缺陷。
 */
export const NAVBAR_ACTION_LABEL_MAX_WIDTH_PX = 60

/**
 * 侧按钮盒子:最小宽 + 定高 + 行内水平居中(图标与文字并排),居中原语只在这一处。
 * 返回类型由泛型带出单位,禁止退化成 string | number(RN ViewStyle 编译不过,实测 TS1360)。
 */
export function navbarActionBoxStyle<U extends string | number>(
  toUnit: GeometryUnit<U>,
): {
  minWidth: U
  height: U
  display: 'flex'
  flexDirection: 'row'
  alignItems: 'center'
  justifyContent: 'center'
} {
  return {
    minWidth: toUnit(NAVBAR_ACTION_MIN_WIDTH_PX),
    height: toUnit(NAVBAR_ACTION_HEIGHT_PX),
    display: 'flex',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
  }
}

/**
 * 本族的平台机制差异登记(数值对齐、通道各端保留;主会话写入台账 waivers 用):
 *  1. 导航栏总高:小程序端 = 微信胶囊实测(menuButton.top 状态栏占位 + menuButton.height + 8 行高),
 *     RN 端 = 状态栏由 App.tsx SafeAreaView 单点注入 + NAVBAR_ROW_HEIGHT_PX(44)。两端行高不要求同数
 *     (胶囊高度是设备/微信版本决定的平台量),但几何常量已同表。
 *  2. 返回键按下反馈:小程序 hoverClass,RN activeOpacity/pressed 样式 —— 同一弱化语义两种载体。
 *  3. RN 端 hitSlop(top/bottom/left/right 扩张命中)在小程序没有等价通道,小程序靠盒子本身尺寸,
 *     故盒子档(28/32/36)按双方都可点稳的档取。
 */
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
