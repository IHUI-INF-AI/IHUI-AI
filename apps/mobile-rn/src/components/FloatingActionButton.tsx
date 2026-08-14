/**
 * FloatingActionButton 悬浮发布按钮(mobile-rn 端)
 *
 * 共享组件:抽取自 LearnDevelopScreen / PlazaScreen / StudyIndexScreen 三处逐字复制的 FAB。
 * - 48×48 品牌色圆角方块(圆角 12,对齐原有内联样式,遵循 AGENTS.md §4 圆角守门)
 * - Pressable + pressed 态(opacity 0.8)
 * - 默认 ＋ 图标,可通过 label 自定义文字,accessibilityLabel 缺省回退到 label
 */
import { Pressable, StyleSheet, Text, type TextStyle, type ViewStyle } from 'react-native'
import { rnLightTokens as tokens } from '@ihui/design-tokens'

export interface FloatingActionButtonProps {
  onPress: () => void
  label?: string
  accessibilityLabel?: string
}

export default function FloatingActionButton({
  onPress,
  label = '＋',
  accessibilityLabel,
}: FloatingActionButtonProps) {
  return (
    <Pressable
      style={({ pressed }) => [styles.fab, pressed && styles.fabPressed]}
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel ?? label}
    >
      <Text style={styles.fabIcon}>{label}</Text>
    </Pressable>
  )
}

const styles = StyleSheet.create({
  fab: {
    position: 'absolute',
    right: 16,
    bottom: 24,
    width: 48,
    height: 48,
    borderRadius: 12,
    backgroundColor: tokens.brand.DEFAULT,
    alignItems: 'center',
    justifyContent: 'center',
    elevation: 3,
    shadowColor: tokens.gray[900],
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.15,
    shadowRadius: 4,
  } as ViewStyle,
  fabPressed: {
    opacity: 0.8,
  } as ViewStyle,
  fabIcon: {
    fontSize: 24,
    color: tokens.surface.light,
    fontWeight: '600',
  } as TextStyle,
})
