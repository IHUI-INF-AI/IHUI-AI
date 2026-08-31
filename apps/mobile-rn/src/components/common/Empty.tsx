// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * Empty 通用空状态 (mobile-rn 端)
 *
 * 对齐历史项目 common/Empty.vue:
 * - 居中图标(emoji 或图片 URL)+ 文字 + 可选操作按钮。
 * - 默认图标 📭 + 文案"暂无数据"。
 * - 传入 actionText + onAction 时渲染操作按钮(对齐历史 action-btn)。
 * - 浅色优雅风;颜色走 @ihui/design-tokens 的 rnLightTokens。
 * - 类型零 any,精确标注。
 */
import { rnLightTokens as tokens } from '@ihui/design-tokens'
import { Image, StyleSheet, Text, TouchableOpacity, View } from 'react-native'
import { PackageOpen, type LucideIcon } from 'lucide-react-native'

export interface EmptyProps {
  text?: string
  /** emoji 字符、图片 URL(http/https 开头)或 lucide 图标组件 */
  icon?: string | LucideIcon
  actionText?: string
  onAction?: () => void
}

const DEFAULT_ICON = PackageOpen
const DEFAULT_TEXT = '暂无数据'

function isUrl(value: string): boolean {
  return value.startsWith('http://') || value.startsWith('https://')
}

export default function Empty({
  text = DEFAULT_TEXT,
  icon = DEFAULT_ICON,
  actionText,
  onAction,
}: EmptyProps): React.JSX.Element {
  const showAction = Boolean(actionText && onAction)
  const IconNode = typeof icon === 'string' ? null : icon
  return (
    <View style={styles.root}>
      {typeof icon === 'string' ? (
        isUrl(icon) ? (
          <Image source={{ uri: icon }} style={styles.image} resizeMode="contain" />
        ) : (
          <Text style={styles.emoji}>{icon}</Text>
        )
      ) : IconNode ? (
        <IconNode size={48} color={'#6b7280'} />
      ) : null}
      <Text style={styles.text}>{text}</Text>
      {showAction ? (
        <TouchableOpacity
          style={styles.actionBtn}
          activeOpacity={0.7}
          onPress={onAction}
          accessibilityRole="button"
        >
          <Text style={styles.actionText}>{actionText}</Text>
        </TouchableOpacity>
      ) : null}
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
    fontSize: 48,
  },
  image: {
    width: 100,
    height: 100,
  },
  text: {
    fontSize: 14,
    color: tokens.text.secondary,
  },
  actionBtn: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 6,
    backgroundColor: tokens.brand.DEFAULT,
  },
  actionText: {
    fontSize: 14,
    fontWeight: '600',
    color: tokens.surface.light,
  },
})
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
