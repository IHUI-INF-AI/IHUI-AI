// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

import { Image, StyleSheet, View } from 'react-native'
import { Sparkles } from 'lucide-react-native'
import { rnRadius } from '@ihui/design-tokens'
import { getTokens } from '../../theme/tokens'

export interface AgentAvatarProps {
  avatar?: string | null
  name: string
  size?: number
  colorScheme?: 'light' | 'dark'
}

/**
 * 条目头像共享段(web 分类详情页原有 next/image + Sparkles 占位的单源)。
 * 有 avatar 用 Image,否则 Sparkles 占位;两端同一份实现,尺寸/tokens 一致。
 */
export function AgentAvatar({ avatar, name, size = 40, colorScheme = 'light' }: AgentAvatarProps) {
  const tk = getTokens(colorScheme)
  const box = { width: size, height: size, borderRadius: rnRadius.md }

  if (avatar) {
    return (
      <Image
        source={{ uri: avatar }}
        style={[box, styles.image]}
        accessibilityLabel={name}
        accessibilityRole="image"
      />
    )
  }

  return (
    <View style={[box, styles.fallback, { backgroundColor: tk.surface.card }]}>
      <Sparkles size={Math.round(size / 2)} color={tk.text.tertiary} />
    </View>
  )
}

const styles = StyleSheet.create({
  image: { resizeMode: 'cover' },
  fallback: { alignItems: 'center', justifyContent: 'center' },
})
