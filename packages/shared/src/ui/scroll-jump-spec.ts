// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * 滚动方向浮动按钮族(「返回顶部 / 跳到最新」那枚悬浮箭头)的单一源。
 *
 * 基准 = web 端活体实现 `apps/web/src/components/chat/message-list/scroll-jump-buttons.tsx`:
 * `<Button size="icon-sm" variant="outline">` + lucide `ChevronUp` / `ArrowDown`,
 * 折成数值就是 32×32 / 圆角 sm(4px) / 1px 中性描边 / 页面底 / 前景墨字 / 16px 图标。
 *
 * 立因(2026-10-20 用户指令「这种上滑下滑的箭头应该跟 web 端同样的样式,不可以有单独的设定,
 * 统一使用一段代码样式」):改判前全仓 9 份各自设定 ——
 *  RN 6 份(HomeScreen 浅蓝底居中 / AgentScreen 白卡右下 / ProfileScreen 白卡 TabBar 上方 /
 *  MoreCourseScreen·CoursePlanetScreen 顶部居中半透明白 / SquareScreen 灰蓝底居中),
 *  小程序 2 份(share 灰蓝方盒 + `↑` 字形 / community 圆形白卡),
 *  外加 web 自己还有第二族(agent-progress-pane 的 h-6 文字胶囊)。
 *  同一语义的控件在 8 个落点长成 8 张脸,并且 6 份拿 `↑` 字符当图标 ——
 *  字符没有共用度量,`↑` 还不在守门 102 GA1 字形集里(结构上失明),所以它一路活到今天。
 *
 * 分工(与 back-chevron-spec / float-box-spec 同形态):
 *  - 数字档在 `@ihui/design-tokens`(GEOMETRY_PX / RADIUS_*),本文件只组合,不新造档;
 *  - 跨端结构与单位换算在本文件;
 *  - 端内组件只做两件事:注入自己的单位、把自己的原语挂上。
 *  端内不得再写 `width: 34` / `fontSize: 18` / `backgroundColor:'rgba(...)'` 这类第二份真相。
 *
 * 消费方式只能是子路径 `@ihui/shared/ui/scroll-jump-spec`(禁挂根桶:根桶 main 指向
 * src/index.ts,消费端 tsc 会沿桶把整棵 src/chat 拉进被检程序)。
 */
import {
  GEOMETRY_PX,
  RADIUS_CSS_VAR,
  RADIUS_ROLES,
  TARO_RPX_PER_PX,
  rnRadius,
} from '@ihui/design-tokens'

/** 每端注入的单位换算(一个逻辑 px 到该平台数值);泛型把单位类型带出来。 */
export type ScrollJumpUnit<U extends string | number> = (px: number) => U

/** 方块边长:复用既有 `controlBox` 档(web 输入卡实底控件方块同值),不新造档。 */
export function scrollJumpBoxPx(): number {
  return GEOMETRY_PX.controlBox
}

/** 图标墨迹:复用既有 `glyphSm` 档(web Button 基座 `[&_svg]:size-4` = 16)。 */
export function scrollJumpGlyphPx(): number {
  return GEOMETRY_PX.glyphSm
}

/** 描边宽度:outline 档即 1px 边框,三端同值。 */
export const SCROLL_JUMP_BORDER_WIDTH_PX = 1

/** 圆角档位:`control` 角色(按钮/输入控件)→ sm = 4px,与 web `rounded-sm` 同档。 */
export const SCROLL_JUMP_RADIUS_STEP = RADIUS_ROLES.control
/** 圆角 px 数值(唯一出口:端内不得自己写 4)。显式具名档取用:守门 150 对
 *  `rnRadius[变量]` 索引判不出档位(unknown-step 未判定);`sm` 与上方
 *  SCROLL_JUMP_RADIUS_STEP(= RADIUS_ROLES.control)同值,control 角色若改档
 *  必须同步本行(CSS_VAR 消费走变量索引自动跟随,px 这一处不会)。 */
export function scrollJumpRadiusPx(): number {
  return rnRadius.sm
}
/** CSS 侧引用形式(小程序写 `border-radius: var(--radius-sm)`),值仍来自 radius.js。 */
export const SCROLL_JUMP_RADIUS_CSS_VAR = `var(${RADIUS_CSS_VAR[SCROLL_JUMP_RADIUS_STEP]})`

/**
 * 方向 → 图标语义。方向是**语义**,不是外观开关:
 *  - `top`    = 回到顶部(web 用 ChevronUp)
 *  - `latest` = 跳到最新 / 到底部(web 用 ArrowDown)
 * 小程序端 LineIcon 与 RN 端 lucide 必须吃同一个名字,否则两端各画一个箭头。
 */
export type ScrollJumpDirection = 'top' | 'latest'

/** 方向对应的 lucide 图标名(唯一出口;端内不得自选箭头字形或换图标)。 */
export function scrollJumpIconName(direction: ScrollJumpDirection): 'chevron-up' | 'arrow-down' {
  return direction === 'top' ? 'chevron-up' : 'arrow-down'
}

/** 浮动列距屏幕右缘 16(web `right-4`;几何表里 16 的既有档即 `glyphSm`,不另造间距档)。 */
export function scrollJumpInsetPx(): number {
  return GEOMETRY_PX.glyphSm
}

/**
 * 同一档的 rpx 投影(小程序端定位用)。换算系数只在这一处出现,
 * 页面里不得再写 `× 2` / `rpx(32)` 这类第二份换算。
 */
export function pxToTaroRpx(px: number): number {
  return px * TARO_RPX_PER_PX
}

/** 浮动列边距的 rpx 投影(小程序端 `right` / `bottom` 用)。 */
export function scrollJumpInsetRpx(): number {
  return pxToTaroRpx(scrollJumpInsetPx())
}

/** 同列两枚按钮的间距 8(web `gap-2`)。 */
export const SCROLL_JUMP_COLUMN_GAP_PX = 8

/** 按下态弱化值:web 无 hover 对应档,RN/小程序同取一个数(与 BackChevron 的 0.6 同族)。 */
export const SCROLL_JUMP_PRESSED_OPACITY = 0.6

/**
 * 色角色:三端各有自己的 token 命名空间(RN 是 JS 对象、小程序是 CSS 变量、web 是 Tailwind 类名),
 * 所以共享层只能收「角色」,收不了具体值。角色名单源在此,端内按角色取自己那一份。
 *  - surface = web `bg-background`(页面底,不是卡片底)
 *  - ink     = web `text-foreground`
 *  - hairline= web `border-input`(中性描边;按 §4 描边不得取墨档)
 */
export type ScrollJumpColorRole = 'surface' | 'ink' | 'hairline'

/**
 * 盒体外观 + 几何一次给全(居中三件套也只在这一处)。
 * 尺寸与颜色分开两个泛型:RN 侧尺寸是 dp 数值而颜色是字符串,小程序侧两者都是字符串,
 * 写成一个泛型会在 RN 编译不过。返回类型必须由泛型带出,不能收成 `string | number`。
 */
export function scrollJumpBoxStyle<D extends string | number, C extends string>(
  toUnit: ScrollJumpUnit<D>,
  colors: Record<ScrollJumpColorRole, C>,
): {
  width: D
  height: D
  display: 'flex'
  alignItems: 'center'
  justifyContent: 'center'
  borderRadius: D
  borderWidth: D
  borderStyle: 'solid'
  backgroundColor: C
  color: C
} {
  return {
    width: toUnit(scrollJumpBoxPx()),
    height: toUnit(scrollJumpBoxPx()),
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: toUnit(scrollJumpRadiusPx()),
    borderWidth: toUnit(SCROLL_JUMP_BORDER_WIDTH_PX),
    borderStyle: 'solid',
    backgroundColor: colors.surface,
    color: colors.ink,
  }
}
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
