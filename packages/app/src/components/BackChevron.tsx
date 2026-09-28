// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 本仓库以 Apache-2.0 授权分发，须保留本声明与 LICENSE / NOTICE。

import { Pressable, StyleSheet, View, type StyleProp, type ViewStyle } from 'react-native'
import { ChevronLeft } from 'lucide-react-native'
import {
  backChevronBoxStyle,
  backChevronGlyphPx,
  BACK_CHEVRON_PRESSED_OPACITY,
} from '@ihui/shared/ui'
import { getTokens, type AppThemeMode } from '../theme/tokens'
import { useFontMultiplier } from './MoreLink'

/**
 * 命中块与图标墨迹**不在本文件取数** —— 档位唯一真相源是
 * `packages/design-tokens/src/geometry.js`(取值依据写在那个头注里,含"为什么移动端不取
 * web 顶栏的 14px")。这里取它的 dp 投影,与小程序端 `taroGeometry` 同表同枚。
 *
 * 之前本文件写 `ICON = 22`、小程序端写 `40rpx`(=20px),两句注释都自称"与 web 同档"
 * 而屏幕上差 2px —— "端内既定档"就是第二份真相。守门 128 立项时把这处量成差异档。
 */
/// RN 单位是 dp,与逻辑 px 1:1,故换算取恒等;数字与居中结构在 @ihui/shared/ui
const BOX_STYLE = backChevronBoxStyle((px: number) => px)
const ICON = backChevronGlyphPx()

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
 * `components/BackChevron.tsx`;RN 侧此前 223 处 / 168 文件各写各的 `<Text>{t('common.back')}</Text>`
 * 加各自的 `styles.back*`,于是"手机上返回键和网页长得不一样"。载体统一为零新素材
 * (`lucide-react-native` 已是本端图标库,`ChevronLeft` 亦在 7 个既有屏里这么用)。
 */
export function BackChevron({ onPress, label, colorScheme, style, testID }: BackChevronProps) {
  const tk = getTokens(colorScheme)
  const multiplier = useFontMultiplier()

  return (
    // 动态样式**不得写成 `style={({pressed}) => …}`**:Pressable 注册过 cssInterop,interop 对
    // 非数组声明执行 `{ ...declaration }`,而 `{ ...函数 }` === `{}`,且 applyStyles 先把
    // `state.props` 清成 `{}` ⇒ 这份内联 style 整份静默消失(守门 131 立项那一型,真机 A/B 定案)。
    // 改法是把样式落到子 View 的**数组形态**上,pressed 由 children render prop 供。
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={label}
      testID={testID}
      hitSlop={4}
    >
      {({ pressed }) => (
        <View style={[styles.box, pressed ? styles.pressed : null, style]}>
          <ChevronLeft size={Math.round(ICON * multiplier)} color={tk.text.medium} />
        </View>
      )}
    </Pressable>
  )
}

const styles = StyleSheet.create({
  box: BOX_STYLE,
  pressed: {
    opacity: BACK_CHEVRON_PRESSED_OPACITY,
  },
})

export default BackChevron
