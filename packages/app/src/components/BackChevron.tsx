// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

import { Pressable, StyleSheet, type StyleProp, type ViewStyle } from 'react-native'
import { ChevronLeft } from 'lucide-react-native'
import { getTokens, type AppThemeMode } from '../theme/tokens'
import { useFontMultiplier } from './MoreLink'

/** 命中块边长 —— 与 web 端唯一渲染点 `GlobalTopBar` 的 `TopBarBackButton`(36×36)同档 */
const BOX = 36
/** 与 packages/app 既有矢量返回写法(SpecScreen / PublishScreen 等)`size={22}` 同档 */
const ICON = 22

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
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={label}
      testID={testID}
      hitSlop={4}
      style={({ pressed }) => [styles.box, pressed ? styles.pressed : null, style]}
    >
      <ChevronLeft size={Math.round(ICON * multiplier)} color={tk.text.medium} />
    </Pressable>
  )
}

const styles = StyleSheet.create({
  box: {
    width: BOX,
    height: BOX,
    alignItems: 'center',
    justifyContent: 'center',
  },
  pressed: {
    opacity: 0.6,
  },
})

export default BackChevron
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
