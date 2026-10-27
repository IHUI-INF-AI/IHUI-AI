// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * TabBar 样式定义 (mobile-rn 端)
 * 液态玻璃停靠栏(2026-10-27 用户定稿「删掉底下单独的白底,菜单栏整体液态玻璃」):
 * 玻璃面板从图标行一直延伸到屏幕底边,把底部手势区收进面板 —— 图标行下面不再有
 * 独立的白色透明带;玻璃底(glass.bg 半透明 + web 预览 backdrop blur),下方内容若隐若现。
 * 5 Tab 等宽布局;选中态用强调档,未选中用中性灰。
 */
import { Platform, StyleSheet } from 'react-native'
import type { ViewStyle, TextStyle, ImageStyle } from 'react-native'
import { tokens as tk } from '../theme/active-tokens'
import { rnRadius, withAlpha } from '@ihui/design-tokens'
import {
  TAB_BAR_FONT_SIZE_ACTIVE_PX,
  TAB_BAR_FONT_SIZE_PX,
  TAB_BAR_GAP_BOTTOM_MIN_PX,
  TAB_BAR_GAP_TOP_PX,
  TAB_BAR_HEIGHT_PX,
  TAB_BAR_ICON_SIZE_PX,
  TAB_BAR_INDICATOR_H_PX,
  TAB_BAR_INDICATOR_INSET_PX,
  TAB_BAR_MARGIN_H_PX,
  TAB_BAR_GLOW_RADIUS_PX as TAB_BAR_GLOW_RADIUS_SRC_PX,
} from '@ihui/shared/ui/tab-bar-spec'

/*
 * 下面这批同名量一律**转发** @ihui/shared/ui/tab-bar-spec —— 两端底部胶囊是同一个界面元素,
 * 尺子只许有一份(此前 RN 与小程序各写一份,靠两份头注互指维持,门 128 因文件名不同看不见这一族)。
 * 要改档,改 spec 那一处,不要在这里就地改数字。
 */
/** 胶囊高 = AI 输入框外壳静态档(2026-10-20 用户定稿「菜单栏的高宽应该跟 AI 输入框一致」) */
export const TAB_BAR_HEIGHT = TAB_BAR_HEIGHT_PX
export const TAB_BAR_ICON_SIZE = TAB_BAR_ICON_SIZE_PX
export const TAB_BAR_FONT_SIZE = TAB_BAR_FONT_SIZE_PX
/** 选中态字号:比未选中大 1px(2026-10-20 用户定稿「选中时文字稍微放大加粗」) */
const TAB_BAR_FONT_SIZE_ACTIVE = TAB_BAR_FONT_SIZE_ACTIVE_PX
/** 胶囊左右留边(与两端输入栏同一条垂直边线) */
export const TAB_BAR_FLOAT_MARGIN_H = TAB_BAR_MARGIN_H_PX
/** 胶囊顶部与内容的间距 */
export const TAB_BAR_FLOAT_GAP_TOP = TAB_BAR_GAP_TOP_PX
/** 胶囊底部最小悬浮间距(无 safe-area 时兜底) */
export const TAB_BAR_FLOAT_GAP_BOTTOM_MIN = TAB_BAR_GAP_BOTTOM_MIN_PX
/** 胶囊圆角(小圆角悬浮卡,对齐钉钉风格;2026-09-22 用户定稿"小圆角";原 14,R1 吸附至 xl(12)) */
export const TAB_BAR_RADIUS = rnRadius.xl
/** 选中态光晕半径(px);颜色一律走 token,端内不得出现裸 hex(守门 218) */
const TAB_BAR_GLOW_RADIUS_PX = TAB_BAR_GLOW_RADIUS_SRC_PX

/**
 * 内容区底部预留(给悬浮胶囊让出滚动空间,内容可滚到胶囊底下若隐若现):
 * 胶囊高 + 顶隙 + 底隙 + 16dp 呼吸余量。safe-area 部分由各屏按 useSafeAreaInsets 追加
 * (App.tsx 的 SafeAreaView 只包 top 边,底部 inset 未全局占用)。
 */
export const TAB_BAR_FLOAT_RESERVE =
  TAB_BAR_HEIGHT + TAB_BAR_FLOAT_GAP_TOP + TAB_BAR_FLOAT_GAP_BOTTOM_MIN + 16

/**
 * 各屏滚动内容区的底部预留(px):内容滚到底时末项仍完整露在胶囊之上,
 * 继续滚动则内容钻到胶囊底下被玻璃半透出。insetsBottom 传 useSafeAreaInsets().bottom;
 * 底部无安全区的屏传 0。
 */
export function tabBarScrollReserve(insetsBottom: number): number {
  const floatGap = Math.max(TAB_BAR_FLOAT_GAP_BOTTOM_MIN, insetsBottom * 0.5 + 4)
  return TAB_BAR_HEIGHT + TAB_BAR_FLOAT_GAP_TOP + floatGap + 16
}

/**
 * 玻璃停靠区(HomeScreen 底部 InputArea + TabBar 整块玻璃)内给悬浮胶囊让位的 spacer 高度:
 * 胶囊自身高 + 与上方输入区的间隙 + 底部安全区悬浮量。停靠区高度 = 输入区高度 + 本值。
 */
export function tabBarDockSpacer(insetsBottom: number): number {
  const floatGap = Math.max(TAB_BAR_FLOAT_GAP_BOTTOM_MIN, insetsBottom * 0.5 + 4)
  return TAB_BAR_HEIGHT + TAB_BAR_FLOAT_GAP_TOP + floatGap
}

/**
 * 液态玻璃模糊半径(px)。web 预览(react-native-web)原生支持 View 的 backdropFilter,
 * 零依赖真模糊;原生端暂不引入 expo-blur,退化为 glass.bg 半透明底(仍"若隐若现",无模糊)。
 * 与 miniapp custom-tab-bar 的 backdrop-blur-xl(24px)同值,两端观感一致。
 */
// 名字刻意不带 RADIUS:它是模糊半径(px),不是圆角档位。门 77 的 B2 按常量名取"圆角绕过",
// 而该门头注(535 行)写明"确实叫 RADIUS 但不是圆角"属命名债,正解是改名而不是加豁免、
// 更不是把它吸附到 rnRadius 档位上(24 是 blur 的 px,与圆角档位表无关)。
const GLASS_BLUR_PX = 24

/** web 预览专属模糊层(RNW 类型外属性,经 ViewStyle 断言注入,避免 any);
 *  TabBar 胶囊与 HomeScreen 底部玻璃停靠区共用同一模糊半径。 */
const glassBlurLayer: ViewStyle =
  Platform.OS === 'web'
    ? ({ backdropFilter: `blur(${GLASS_BLUR_PX}px)` } as unknown as ViewStyle)
    : {}

export const tabBarStyles = {
  /**
   * 外层定位容器:绝对定位浮在内容之上,左右留边,底部贴齐后再由运行时注入
   * marginBottom 悬浮(marginBottom = 有效 safe-area 一半 + 4,见 TabBar.tsx 四稿)。
   */
  wrapper: {
    position: 'absolute',
    left: TAB_BAR_FLOAT_MARGIN_H,
    right: TAB_BAR_FLOAT_MARGIN_H,
    bottom: 0,
  } satisfies ViewStyle,

  /**
   * 液态玻璃胶囊:图标行(高 TAB_BAR_HEIGHT)包进同一块玻璃 —— 圆角 + 细描边 + 投影。
   * 2026-10-27 五稿:Android 也上真模糊(blurMethod='dimezisBlurView',expo-blur 默认 none
   * 是 0.0.8「模糊不生效」误判的真因),Android 端底色运行时注入 0.5 半透;此处默认色仅 web 生效。
   */
  container: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-around',
    height: TAB_BAR_HEIGHT,
    overflow: 'hidden',
    backgroundColor: tk.glass.bg,
    borderRadius: TAB_BAR_RADIUS,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: tk.border.light,
    shadowColor: tk.gray.black,
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.16,
    shadowRadius: 20,
    elevation: 12,
    ...glassBlurLayer,
  } satisfies ViewStyle,

  /** 真背景模糊层(expo-blur BlurView 的 absolute fill,仅 iOS 端渲染,置于图标行之下) */
  blurFill: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
  } satisfies ViewStyle,

  /** 顶部高光线(iOS 白底玻璃的 rim light,仅浅色主题渲染;压住面板与内容的分界) */
  rimLight: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    height: 1.5,
    backgroundColor: withAlpha(tk.surface.light, 0.95),
  } satisfies ViewStyle,

  item: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    height: TAB_BAR_HEIGHT,
    paddingVertical: 4,
  } satisfies ViewStyle,

  icon: {
    width: TAB_BAR_ICON_SIZE,
    height: TAB_BAR_ICON_SIZE,
    resizeMode: 'contain',
  } satisfies ImageStyle,

  /**
   * 选中态发光(2026-10-20 用户定稿):drop-shadow 挂在图标的包裹层上 —— RN 把 filter 收在
   * ViewStyle,ImageStyle 没有这一维。web 预览经 react-native-web 透传成 CSS filter(与本文件
   * 玻璃层 backdropFilter 同一条通道)。
   * 光晕取 brandAccent.deep(亮 #4a7a96 / 暗 #a3c4d6)而不是 DEFAULT:同日玻璃底回调至 0.6 后,
   * 浅蓝 #8fb8cc 的光晕压在近乎实底的胶囊上看不见 —— 发光要可见,必须比底重一档。
   */
  iconGlow: {
    filter: `drop-shadow(0 0 ${TAB_BAR_GLOW_RADIUS_PX}px ${withAlpha(tk.brandAccent.deep, 0.85)})`,
  } satisfies ViewStyle,

  /** 选中态顶部指示条:高与左右缩进取 spec 档,颜色与选中文字同档,小圆角 */
  activeIndicator: {
    position: 'absolute',
    top: 0,
    left: TAB_BAR_INDICATOR_INSET_PX,
    right: TAB_BAR_INDICATOR_INSET_PX,
    height: TAB_BAR_INDICATOR_H_PX,
    borderRadius: rnRadius.xs,
    backgroundColor: tk.brandAccent.deep,
  } satisfies ViewStyle,

  label: {
    fontSize: TAB_BAR_FONT_SIZE,
    marginTop: 2,
    lineHeight: TAB_BAR_FONT_SIZE + 2,
  } satisfies TextStyle,

  /**
   * 选中态文字:浅蓝强调档(brandAccent.deep,亮 #4a7a96 / 暗 #a3c4d6)+ 粗体。
   * 2026-10-20 用户定稿:选中图标改用素材自带的浅紫 + 浅蓝发光,文字与指示条随强调档,
   * 「色 + 重」双重区分(此前整栏走深色中性,把彩色素材压成了近黑)。
   */
  labelActive: {
    color: tk.brandAccent.deep,
    fontWeight: '600',
    fontSize: TAB_BAR_FONT_SIZE_ACTIVE,
    lineHeight: TAB_BAR_FONT_SIZE_ACTIVE + 2,
  } satisfies TextStyle,

  /** 未选中态文字:中性灰(text.secondary,亮 #666666 / 暗 #A3A3A3)—— 比原 tertiary 深一档 */
  labelInactive: {
    color: tk.text.secondary,
  } satisfies TextStyle,
} as const

/**
 * StyleSheet.create 包装 — 运行时仍走 RN StyleSheet 注册,保留 transform 优化。
 * 类型提示保留对象字面量结构,避免 StyleSheet.create 把所有键 union 化。
 */
export const tabBarStyleSheet = StyleSheet.create(tabBarStyles)

export type TabBarStyles = typeof tabBarStyles
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
