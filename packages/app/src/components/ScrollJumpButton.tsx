// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

import { Pressable, StyleSheet, View, type StyleProp, type ViewStyle } from 'react-native'
import { ArrowDown, ChevronUp } from 'lucide-react-native'
import {
  scrollJumpBoxStyle,
  scrollJumpGlyphPx,
  scrollJumpIconName,
  SCROLL_JUMP_PRESSED_OPACITY,
  type ScrollJumpDirection,
} from '@ihui/shared/ui/scroll-jump-spec'
import { getTokens, type AppThemeMode } from '../theme/tokens'

/**
 * 滚动方向浮动按钮 —— RN 端唯一实现(几何与外观一律不在本文件取数)。
 *
 * 数字与居中结构在 `@ihui/shared/ui/scroll-jump-spec`,基准是 web 端
 * `apps/web/src/components/chat/message-list/scroll-jump-buttons.tsx` 的
 * `<Button size="icon-sm" variant="outline">` + lucide `ChevronUp` / `ArrowDown`。
 *
 * 为什么本文件必须薄:改判前 RN 侧有 6 份各自写的 `backToTopBtn`/`backToTopIcon`
 * (浅蓝底居中 / 白卡右下 / TabBar 上方 / 顶部居中半透明白 ×2 / 灰蓝底居中),
 * 字号 18 与 20 并存、6 份里 1 份根本没写字重,其中 2 份还拿 `↑` 字符当图标。
 * 端内再写一份 `width: 34` 就是守门 128 立项量出的那种差异档。
 *
 * 定位由调用方经 `style` 给(组件本身不带 position):同一枚按钮要落在滚动容器里,
 * 而各屏的底部停靠区高度是实测出来的 —— 那是载体差异,不是外观分叉。
 */

/// RN 单位是 dp,与逻辑 px 1:1,故换算取恒等;结构与数字在 @ihui/shared/ui。
/// 几何走模块级 StyleSheet.create(守门 128 只读这一形态),主题色逐次注入。
const GEOMETRY = StyleSheet.create({
  box: scrollJumpBoxStyle((px: number) => px, {
    surface: 'transparent',
    ink: 'transparent',
    hairline: 'transparent',
  }),
})
const GLYPH = scrollJumpGlyphPx()

export interface ScrollJumpButtonProps {
  /** `top` = 回到顶部(chevron-up);`latest` = 跳到最新(arrow-down)。只决定方向,不决定外观。 */
  direction: ScrollJumpDirection
  onPress: () => void
  /**
   * 「返回顶部 / 跳到最新」的本地化文案。**只用于 accessibilityLabel,不参与渲染** ——
   * 可见侧是裸箭头,无障碍名称必须脱离上下文也成立(RN 的屏幕阅读器只会念这一个字符串)。
   */
  label: string
  /**
   * 必填而非 `= 'light'` 默认值:与 BackChevron 同规矩 —— 默认值一旦存在,漏传就静默锁死
   * 浅色档案且 typecheck 不红。必填让 `tsc` 直接接管这件事。
   */
  colorScheme: AppThemeMode
  /** 仅用于定位(贴右下偏移、给 TabBar 让位),不得用来改盒档、圆角或颜色。 */
  style?: StyleProp<ViewStyle>
  testID?: string
}

export function ScrollJumpButton({
  direction,
  onPress,
  label,
  colorScheme,
  style,
  testID,
}: ScrollJumpButtonProps) {
  const tk = getTokens(colorScheme)
  const iconName = scrollJumpIconName(direction)
  // 色角色 → 本端 token:surface=页面底(web bg-background)、ink=前景墨(web text-foreground)、
  // hairline=中性描边(web border-input;§4 描边不得取墨档,故不碰 text/brand)。
  const themed = {
    backgroundColor: tk.surface.bg,
    borderColor: tk.border.medium,
  }

  return (
    // 动态样式**不得写成 `style={({pressed}) => …}`**:Pressable 注册过 cssInterop,
    // interop 对非数组声明执行 `{ ...declaration }`,而 `{ ...函数 }` === `{}`,
    // 内联 style 会整份静默消失(守门 131 立项那一型,真机 A/B 定案)。
    // pressed 走 children render prop + 子 View 数组形态。
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={label}
      testID={testID}
      hitSlop={4}
    >
      {({ pressed }) => (
        <View style={[GEOMETRY.box, themed, pressed ? styles.pressed : null, style]}>
          {iconName === 'chevron-up' ? (
            <ChevronUp size={GLYPH} color={tk.text.primary} />
          ) : (
            <ArrowDown size={GLYPH} color={tk.text.primary} />
          )}
        </View>
      )}
    </Pressable>
  )
}

const styles = StyleSheet.create({
  pressed: {
    opacity: SCROLL_JUMP_PRESSED_OPACITY,
  },
})
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
