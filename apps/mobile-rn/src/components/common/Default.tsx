/**
 * Default 通用默认状态 (mobile-rn 端)
 *
 * 对齐历史项目 common/Default.vue(无数据默认展示):
 * - 居中图标(emoji 或图片 URL)+ 文字提示。
 * - 默认图标 🤖 + 文案"暂无内容"(对齐历史 robot 占位主题)。
 * - 与 Empty 的区别:Default 用于"初始无数据默认展示",不带操作按钮。
 * - 浅色优雅风;颜色走 @ihui/design-tokens 的 rnLightTokens。
 * - 类型零 any,精确标注。
 */
import { rnLightTokens as tokens } from '@ihui/design-tokens'
import { Image, StyleSheet, Text, View } from 'react-native'

export interface DefaultProps {
  text?: string
  /** emoji 字符或图片 URL(http/https 开头) */
  icon?: string
}

const DEFAULT_ICON = '🤖'
const DEFAULT_TEXT = '暂无内容'

function isUrl(value: string): boolean {
  return value.startsWith('http://') || value.startsWith('https://')
}

export default function Default({
  text = DEFAULT_TEXT,
  icon = DEFAULT_ICON,
}: DefaultProps): React.JSX.Element {
  return (
    <View style={styles.root}>
      {icon && isUrl(icon) ? (
        <Image source={{ uri: icon }} style={styles.image} resizeMode="contain" />
      ) : (
        <Text style={styles.emoji}>{icon}</Text>
      )}
      <Text style={styles.text}>{text}</Text>
    </View>
  )
}

const styles = StyleSheet.create({
  root: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 48,
    paddingHorizontal: 24,
    gap: 12,
  },
  emoji: {
    fontSize: 56,
  },
  image: {
    width: 120,
    height: 120,
  },
  text: {
    fontSize: 14,
    color: tokens.text.secondary,
  },
})
