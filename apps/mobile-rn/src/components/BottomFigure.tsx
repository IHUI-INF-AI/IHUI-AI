/**
 * BottomFigure 底部装饰图 (mobile-rn 端)
 *
 * 对齐历史项目 BottomFigure/index.vue(底部装饰图):
 * - 单张装饰图,通常用于页面底部展示品牌 / 营销 banner / 装饰插画
 * - imageSource 支持 require(...) 返回的 number 或 URL string
 * - 默认高度 150,父级可通过 height 覆盖
 * - 纯视觉组件,无点击交互;无图时显示占位 emoji 🖼️
 * - 浅色优雅风,圆角矩形(非圆形),无霓虹无渐变
 *
 * 任务规格:
 *   interface BottomFigureProps { imageSource?: number | string; height?: number }
 */
import {
  Image,
  StyleSheet,
  Text,
  View,
  type ImageStyle,
  type TextStyle,
  type ViewStyle,
} from 'react-native'
import { rnLightTokens as tk } from '@ihui/design-tokens'

export interface BottomFigureProps {
  imageSource?: number | string
  height?: number
}

const DEFAULT_HEIGHT = 150
const RADIUS = 12
const PLACEHOLDER_FONT_SIZE = 36

const PLACEHOLDER_EMOJI = '🖼️'

type ResolvedSource = number | { uri: string }

export function BottomFigure({ imageSource, height = DEFAULT_HEIGHT }: BottomFigureProps) {
  const source: ResolvedSource | null =
    typeof imageSource === 'number'
      ? imageSource
      : imageSource
        ? { uri: imageSource }
        : null

  return (
    <View style={[styles.container, { height }]}>
      {source ? (
        <Image source={source} style={styles.image} resizeMode="cover" />
      ) : (
        <View style={styles.placeholder}>
          <Text style={styles.placeholderText} allowFontScaling={false}>
            {PLACEHOLDER_EMOJI}
          </Text>
        </View>
      )}
    </View>
  )
}

const styles = StyleSheet.create({
  container: {
    width: '100%',
    borderRadius: RADIUS,
    overflow: 'hidden',
    backgroundColor: tk.surface.muted,
  } as ViewStyle,
  image: {
    width: '100%',
    height: '100%',
  } as ImageStyle,
  placeholder: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  } as ViewStyle,
  placeholderText: {
    fontSize: PLACEHOLDER_FONT_SIZE,
  } as TextStyle,
})

export default BottomFigure
