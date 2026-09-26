// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * Loading 通用加载态 (mobile-rn 端)
 *
 * 对齐历史项目 common/Loading.vue + loading/index.vue:
 * - 居中 ActivityIndicator + 文字提示。
 * - fullscreen=true:固定半透明白色遮罩居中,覆盖整屏(对齐历史 loading-full / loading-mask)。
 * - fullscreen=false:内联居中(适应父容器)。
 * - 浅色优雅风;颜色走 theme/active-tokens 的主题 token。
 * - 类型零 any,精确标注。
 */
import { tokens } from '../../theme/active-tokens'
import { ActivityIndicator, StyleSheet, Text, View } from 'react-native'
import {
  LOADING_INLINE_PADDING_X_PX,
  LOADING_INLINE_PADDING_Y_PX,
  LOADING_LABEL_FONT_PX,
  LOADING_LABEL_GAP_PX,
  loadingSpinnerBoxStyle,
} from '@ihui/shared/ui/loading-spec'

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
      {/* 原生指示器的字形尺寸由平台控件决定(数值档在 Android 不生效),这里只对齐它占的盒子 */}
      <View style={styles.spinnerBox}>
        <ActivityIndicator size="large" color={tokens.brand.DEFAULT} />
      </View>
      {text ? <Text style={styles.text}>{text}</Text> : null}
    </View>
  )
}

const styles = StyleSheet.create({
  root: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: LOADING_INLINE_PADDING_Y_PX,
    paddingHorizontal: LOADING_INLINE_PADDING_X_PX, // 两端同档,唯一源在 @ihui/shared/ui/loading-spec
    gap: LOADING_LABEL_GAP_PX,
  },
  spinnerBox: loadingSpinnerBoxStyle((px: number) => px),
  fullscreen: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: tokens.overlay.loading,
    zIndex: 999,
  },
  text: {
    fontSize: LOADING_LABEL_FONT_PX,
    color: tokens.text.secondary,
  },
})
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
