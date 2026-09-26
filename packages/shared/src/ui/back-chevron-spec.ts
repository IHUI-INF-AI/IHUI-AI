// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * 页头返回键的结构与几何单一源(小程序端与 RN 端共用)。
 *
 * 为什么不是"一份 JSX 两端跑":Taro 要 `@tarojs/components` 的 View + hoverClass,RN 要
 * Pressable + StyleSheet + hitSlop + 系统字号缩放通道 —— 原语与样式系统按平台分叉是平台事实
 * (实测本仓无 bundler 级文件换读机制:零 .rn.tsx 约定、metro 无 resolveFilter、Taro alias 无
 * 平台映射)。所以"改一端另一端自动生效"落在这一层:会显形的数字与盒子结构只在本文件出现一次,
 * 端内只负责"换算成本平台单位 + 挂自己的原语"。
 *
 * 端内不得再写 const BOX_SIZE = <数字> / const ICON = <数字>,也不得自己重排居中三件套 ——
 * 那是守门 128 立项量出的 174 处差异档的成因:两份自称"唯一实现"的返回键,小程序端 40/72、
 * RN 端 22/36,两句注释都写"与 web 同档",屏幕上差 2px。
 *
 * 消费方式只能是子路径 `@ihui/shared/ui` 或 `@ihui/shared/ui/<模块>`,**禁止挂根桶**
 * (根桶 main 指向 src/index.ts,消费端 tsc 会沿桶把整棵 src/chat 拉进被检程序;实测加一行根桶
 * 出口就让 @ihui/rn-app typecheck 从 0 错变 8 错,报错全在没碰的 chat 文件上)。
 * 新增本目录下的模块时,package.json 的 ./ui/* 与架构表的 public_entrypoints 已覆盖,无需再改出口表。
 */
import { GEOMETRY_PX } from '@ihui/design-tokens'

/** 每端注入的单位换算(一个逻辑 px 到该平台数值);泛型把单位类型带出来。 */
export type GeometryUnit<U extends string | number> = (px: number) => U

/**
 * 命中方块:方块即命中区,居中结构只在这一处(不用负 margin 造第二种几何)。
 * 返回类型必须由泛型带出:写成 string | number 时 RN 的 ViewStyle 编译不过(实测 TS1360)。
 */
export function backChevronBoxStyle<U extends string | number>(
  toUnit: GeometryUnit<U>,
): {
  width: U
  height: U
  display: 'flex'
  alignItems: 'center'
  justifyContent: 'center'
} {
  return {
    width: toUnit(GEOMETRY_PX.tapBox),
    height: toUnit(GEOMETRY_PX.tapBox),
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
  }
}

/** 图标墨迹边长(逻辑 px)。两端必须同一个数,差异只允许出现在单位换算。 */
export function backChevronGlyphPx(): number {
  return GEOMETRY_PX.glyphMd
}

/** 按下态弱化值:两端此前各自写 0.6,收进一处(RN pressed 样式与小程序 hoverClass 同值)。 */
export const BACK_CHEVRON_PRESSED_OPACITY = 0.6
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
