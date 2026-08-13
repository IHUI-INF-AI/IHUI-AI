/**
 * MoreTitles 更多标题 (mobile-rn 端)
 *
 * 对齐历史项目 MoreTitles/index.vue(列表区段头):
 * - 左侧:标题文字(粗体),单行截断
 * - 右侧(仅当 onMore 提供时渲染):"更多"按钮 + 右箭头 ›
 * - 单行布局,space-between,无分割线
 * - 浅色优雅风,系统字体,无霓虹无渐变
 *
 * 任务规格:
 *   interface MoreTitlesProps { title: string; moreText?: string; onMore?: () => void }
 */
import { Pressable, StyleSheet, Text, View, type TextStyle, type ViewStyle } from 'react-native'
import { rnLightTokens as tk } from '@ihui/design-tokens'

export interface MoreTitlesProps {
  title: string
  moreText?: string
  onMore?: () => void
}

const DEFAULT_MORE_TEXT = '查看更多'
const TITLE_FONT_SIZE = 14
const MORE_FONT_SIZE = 12
const ARROW_FONT_SIZE = 14
const MORE_BUTTON_PADDING_V = 4
const MORE_BUTTON_PADDING_H = 2
const CONTAINER_PADDING_V = 10

export function MoreTitles({ title, moreText = DEFAULT_MORE_TEXT, onMore }: MoreTitlesProps) {
  return (
    <View style={styles.container}>
      <Text style={styles.title} numberOfLines={1}>
        {title}
      </Text>
      {onMore ? (
        <Pressable
          onPress={onMore}
          accessibilityRole="button"
          accessibilityLabel={moreText}
          style={({ pressed }) => [styles.moreButton, pressed ? styles.moreButtonPressed : null]}
        >
          <Text style={styles.moreText} numberOfLines={1}>
            {moreText}
          </Text>
          <Text style={styles.arrow} allowFontScaling={false}>
            ›
          </Text>
        </Pressable>
      ) : null}
    </View>
  )
}

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: CONTAINER_PADDING_V,
  } as ViewStyle,
  title: {
    flex: 1,
    fontSize: TITLE_FONT_SIZE,
    fontWeight: '600',
    color: tk.text.primary,
  } as TextStyle,
  moreButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 2,
    paddingVertical: MORE_BUTTON_PADDING_V,
    paddingHorizontal: MORE_BUTTON_PADDING_H,
  } as ViewStyle,
  moreButtonPressed: {
    opacity: 0.6,
  } as ViewStyle,
  moreText: {
    fontSize: MORE_FONT_SIZE,
    color: tk.text.secondary,
  } as TextStyle,
  arrow: {
    fontSize: ARROW_FONT_SIZE,
    lineHeight: ARROW_FONT_SIZE,
    color: tk.text.secondary,
  } as TextStyle,
})

export default MoreTitles
