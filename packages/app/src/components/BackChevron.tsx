// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

import {
  Pressable,
  View,
  type GestureResponderEvent,
  type StyleProp,
  type ViewStyle,
} from 'react-native'
import { ChevronLeft } from 'lucide-react-native'
import {
  BackChevronCore,
  type BackChevronPlatform,
  type BackChevronGlyphProps,
  type BackChevronPressableProps,
} from '@ihui/shared/ui'
import { getTokens, type AppThemeMode } from '../theme/tokens'
import { useFontMultiplier } from './MoreLink'

/**
 * 页头返回键(RN 端唯一实现,packages/app 各屏与 apps/mobile-rn 共用)——
 * 自 O81 票③收口起它是 **RN adapter 壳**:尺寸/居中结构/按压透明度/无障碍语义住在
 * `@ihui/shared/ui` 的 `BackChevronCore`,本文件只注入 RN 原语 + 取 token 色。
 * 与小程序端 apps/miniapp-taro/src/components/BackChevron.tsx 走**同一个核心** ⇒
 * 「改一处、两端自动生效」;约 134 个 RN 调用点(props 形态不变)零改动。
 *
 * 对齐 web 端 apps/web/src/components/layout/GlobalTopBar.tsx 的 TopBarBackButton:
 * 返回 affordance 只用矢量箭头(ChevronLeft / chevron-left)+ 无障碍名称,
 * 不得把「返回」两个字或 ‹ 字符当图标渲染(AGENTS.md §4 图标统一)。
 *
 * 图标墨迹与按钮方块**不在本文件取数** —— 档位唯一真相源是
 * `packages/design-tokens/src/geometry.js`(含「为什么移动端不取 web 顶栏 14px」取值依据),
 * 经 `BackChevronCore` 的 `backChevronBoxStyle` / `backChevronGlyphPx` 取数,与小程序端同表同枚。
 *
 * 注入的平台原语四件(与小程序端 TaroPressable 同形契约,见共享核心头注):
 *  - 可按压容器 = react-native Pressable。pressed 只能经 children render prop
 *    落到子 View 的**数组**样式上 —— 函数形态 style 会被 cssInterop 静默吃掉(守门 131
 *    立项那一型,真机 A/B 定案),所以这里严格走数组形态,与改动前逐字同结构。
 *  - 按压态:`BACK_CHEVRON_PRESSED_OPACITY`(0.6),由共享核心恒定供出、映射到子 View opacity。
 *  - 图标字形:lucide-react-native `ChevronLeft`(守门 102 的 S0 机制清单按该字面量判矢量出口)。
 *  - 字号倍率:`useFontMultiplier`(系统字号缩放),墨迹边长 = glyphPx × 倍率。
 */
/// RN 单位是 dp,与逻辑 px 1:1,故换算取恒等;数字与居中结构在 BackChevronCore。
const RN_PLATFORM: BackChevronPlatform<number, StyleProp<ViewStyle>, GestureResponderEvent> = {
  toUnit: (px) => px,
  glyphUnit: (px) => px,
  useFontMultiplier,
  Pressable: function RnPressable({
    onActivate,
    accessibilityLabel,
    testID,
    boxStyle,
    pressedStyle,
    style,
    children,
  }: BackChevronPressableProps<number, StyleProp<ViewStyle>, GestureResponderEvent>) {
    return (
      // 动态样式**不得写成 `style={({pressed}) => …}`**:Pressable 注册过 cssInterop,interop 对
      // 非数组声明执行 `{ ...declaration }`,而 `{ ...函数 }` === `{}`,且 applyStyles 先把
      // `state.props` 清成 `{}` ⇒ 这份内联 style 整份静默消失(守门 131 立项那一型,真机 A/B 定案)。
      // 改法是把样式落到子 View 的**数组形态**上,pressed 由 children render prop 供。
      <Pressable
        onPress={onActivate}
        accessibilityRole="button"
        accessibilityLabel={accessibilityLabel}
        testID={testID}
        hitSlop={4}
      >
        {({ pressed }) => (
          <View style={[boxStyle, pressed ? pressedStyle : null, style]}>{children}</View>
        )}
      </Pressable>
    )
  },
  Glyph: function RnGlyph({ size, color }: BackChevronGlyphProps) {
    return <ChevronLeft size={size} color={color} />
  },
}

export interface BackChevronProps {
  onPress?: () => void
  /**
   * 「返回」的本地化文案。**只用于 accessibilityLabel,不参与渲染** ——
   * 可见侧是裸箭头,无障碍名称必须脱离上下文也成立(RN 的屏幕阅读器只会念这一个字符串)。
   */
  label: string
  /**
   * 必填而非 `= 'light'` 默认值:守门 91 的判据把"形参带 light 默认值"认作静默脱主题开关,
   * 而默认值一旦存在,漏传就静默锁死浅色档案且 typecheck 不红。必填让 `tsc` 直接接管这件事,
   * 比门更严格(门只审带默认值的那一类)。
   */
  colorScheme: AppThemeMode
  style?: StyleProp<ViewStyle>
  testID?: string
}

/**
 * 页头返回键 —— RN 端唯一实现(共享层,`packages/app` 各屏与 `apps/mobile-rn` 共用)。
 *
 * 为什么不用「返回」两个汉字当箭头:那是把**文案**当**图标**用。web 端早在 2026-09-08 就把
 * 这一 affordance 收进顶栏唯一实现并用 lucide `ChevronLeft`,小程序端 2026-09-25 收进
 * Taro adapter 壳的 `BackChevronCore`;RN 侧此前 223 处 / 168 文件各写各的 `<Text>{t('common.back')}</Text>`
 * 加各自的 `styles.back*`,于是"手机上返回键和网页长得不一样"。载体统一为零新素材
 * (`lucide-react-native` 已是本端图标库,`ChevronLeft` 亦在 7 个既有屏里这么用)。
 */
export function BackChevron({ onPress, label, colorScheme, style, testID }: BackChevronProps) {
  const tk = getTokens(colorScheme)

  return (
    <BackChevronCore
      platform={RN_PLATFORM}
      onPress={onPress}
      label={label}
      glyphColor={tk.text.medium}
      style={style}
      testID={testID}
    />
  )
}

export default BackChevron
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
