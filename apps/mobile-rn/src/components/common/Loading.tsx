/**
 * Loading 通用加载态 (mobile-rn 端)
 *
 * 对齐历史项目 common/Loading.vue + loading/index.vue:
 * - 居中 ActivityIndicator + 文字提示。
 * - fullscreen=true:固定半透明白色遮罩居中,覆盖整屏(对齐历史 loading-full / loading-mask)。
 * - fullscreen=false:内联居中(适应父容器)。
 * - 浅色优雅风;颜色走 @ihui/design-tokens 的 rnLightTokens。
 * - 类型零 any,精确标注。
 */
import { rnLightTokens as tokens } from '@ihui/design-tokens'
import { ActivityIndicator, StyleSheet, Text, View } from 'react-native'

export interface LoadingProps {
  text?: string
  fullscreen?: boolean
}

export default function Loading({
  text = '加载中...',
  fullscreen = false,
}: LoadingProps): React.JSX.Element {
  return (
    <View style={[styles.root, fullscreen && styles.fullscreen]}>
      <ActivityIndicator size="large" color={tokens.brand.DEFAULT} />
      {text ? <Text style={styles.text}>{text}</Text> : null}
    </View>
  )
}

const styles = StyleSheet.create({
  root: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 24,
    paddingHorizontal: 16,
    gap: 12,
  },
  fullscreen: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: 'rgba(255, 255, 255, 0.8)',
    zIndex: 999,
  },
  text: {
    fontSize: 14,
    color: tokens.text.secondary,
  },
})
