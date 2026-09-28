// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 本仓库以 Apache-2.0 授权分发，须保留本声明与 LICENSE / NOTICE。

/**
 * MoreTitles 更多标题 (mobile-rn 端)
 *
 * 对齐历史项目 MoreTitles/index.vue(列表区段头):
 * - 左侧:标题文字(粗体),单行截断
 * - 右侧(仅当 onMore 提供时渲染):「更多」入口 —— 委托共享层 MoreLink,
 *   不得在此自拼 `›` 字符箭头(字符箭头与标签字号不同时必上下错位)
 * - 单行布局,space-between,无分割线
 * - 浅色优雅风,系统字体,无霓虹无渐变
 *
 * 任务规格:
 *   interface MoreTitlesProps { title: string; moreText?: string; onMore?: () => void }
 */
import { StyleSheet, Text, View, type TextStyle, type ViewStyle } from 'react-native'
import { MoreLink } from '@ihui/rn-app'
import { tokens as tk, currentRnTheme } from '../theme/active-tokens'

export interface MoreTitlesProps {
  title: string
  moreText?: string
  onMore?: () => void
}

const DEFAULT_MORE_TEXT = '更多'
const TITLE_FONT_SIZE = 14
const CONTAINER_PADDING_V = 10

export function MoreTitles({ title, moreText = DEFAULT_MORE_TEXT, onMore }: MoreTitlesProps) {
  return (
    <View style={styles.container}>
      <Text style={styles.title} numberOfLines={1}>
        {title}
      </Text>
      {onMore ? (
        <MoreLink label={moreText} onPress={onMore} colorScheme={currentRnTheme()} />
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
})

export default MoreTitles
