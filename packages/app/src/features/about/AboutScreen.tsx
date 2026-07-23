import { View, Text, StyleSheet } from 'react-native'
import { TextLink } from 'solito/link'

interface AboutScreenProps {
  /**
   * 可选返回回调(覆盖默认的 solito TextLink 导航)。
   * 不传则用 solito TextLink 实现跨平台导航(web→Next.js router, RN→React Navigation)。
   */
  onBack?: () => void
}

/**
 * AboutScreen — 跨端共享页面。
 *
 * 用 react-native primitives(View/Text/StyleSheet)编写,
 * web 端通过 react-native-web 渲染,RN 端原生渲染。
 * 导航用 solito TextLink 实现跨平台:web 端走 Next.js router,RN 端走 React Navigation。
 */
export function AboutScreen({ onBack }: AboutScreenProps) {
  return (
    <View style={styles.container}>
      <Text style={styles.title}>关于 IHUI AI</Text>
      <Text style={styles.description}>
        IHUI AI 是全栈 AI 平台,支持 web / api / ai-service / mobile-rn / desktop / extension / miniapp-taro / cli 八端。
      </Text>
      <Text style={styles.description}>
        本页面由 packages/app 共享层渲染,验证 Solito + react-native-web + React 19 跨端架构。
      </Text>
      <View style={styles.linkRow}>
        {onBack ? (
          <Text style={styles.linkText} onPress={onBack}>
            返回首页
          </Text>
        ) : (
          <TextLink href="/" textProps={{ style: styles.linkText }}>
            返回首页
          </TextLink>
        )}
      </View>
    </View>
  )
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    padding: 24,
    gap: 12,
  },
  title: {
    fontSize: 28,
    fontWeight: '700',
  },
  description: {
    fontSize: 16,
    lineHeight: 24,
    opacity: 0.8,
  },
  linkRow: {
    marginTop: 16,
  },
  linkText: {
    fontSize: 16,
    color: '#10B981',
    fontWeight: '600',
  },
})
