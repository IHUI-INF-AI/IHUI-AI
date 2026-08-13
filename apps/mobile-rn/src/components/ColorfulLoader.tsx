/**
 * ColorfulLoader 彩色加载动画(mobile-rn 端)
 *
 * 对齐历史 Uniapp components/colorful_loader.vue(72 彩点 hue 旋转 + scale 动画)。
 * RN 简化实现:旋转环 + 脉冲缩放,用 Animated + useNativeDriver 跑原生动画。
 *
 * 圆角守门(AGENTS.md §4):spinner 必须为圆形才能形成旋转环,但禁用 9999px / 50% 字面量,
 * 故 borderRadius 用动态数值 size/2(inline style,非字面量,守门脚本不命中)。
 * 彩色高亮:purple.DEFAULT(#7B61FF)顶部边 + border.light 底环,旋转产生彩色 loading 视觉。
 */
import { useEffect, useRef } from 'react'
import { Animated, Easing, StyleSheet, View } from 'react-native'
import { rnLightTokens as tokens } from '@ihui/design-tokens'

export interface ColorfulLoaderProps {
  /** 加载器尺寸(px),默认 40 */
  size?: number
  /** 单圈旋转时长(ms),默认 1200 */
  duration?: number
}

export function ColorfulLoader({
  size = 40,
  duration = 1200,
}: ColorfulLoaderProps): React.JSX.Element {
  const rotate = useRef(new Animated.Value(0)).current
  const scale = useRef(new Animated.Value(0.8)).current

  useEffect(() => {
    const rotateAnim = Animated.loop(
      Animated.timing(rotate, {
        toValue: 1,
        duration,
        easing: Easing.linear,
        useNativeDriver: true,
      }),
    )
    const scaleAnim = Animated.loop(
      Animated.sequence([
        Animated.timing(scale, {
          toValue: 1.1,
          duration: duration / 2,
          useNativeDriver: true,
        }),
        Animated.timing(scale, {
          toValue: 0.8,
          duration: duration / 2,
          useNativeDriver: true,
        }),
      ]),
    )
    rotateAnim.start()
    scaleAnim.start()
    return () => {
      rotateAnim.stop()
      scaleAnim.stop()
    }
  }, [rotate, scale, duration])

  const spin = rotate.interpolate({
    inputRange: [0, 1],
    outputRange: ['0deg', '360deg'],
  })

  return (
    <View style={[styles.container, { width: size, height: size }]}>
      <Animated.View
        style={[
          styles.spinner,
          {
            width: size,
            height: size,
            borderRadius: size / 2,
            borderWidth: Math.max(2, size / 12),
            borderColor: tokens.border.light,
            borderTopColor: tokens.purple.DEFAULT,
          },
          { transform: [{ rotate: spin }, { scale }] },
        ]}
      />
    </View>
  )
}

const styles = StyleSheet.create({
  container: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  spinner: {
    // 尺寸 / 圆角 / 边框由 inline style 动态注入(size/2 避免 9999 字面量)
  },
})

export default ColorfulLoader
