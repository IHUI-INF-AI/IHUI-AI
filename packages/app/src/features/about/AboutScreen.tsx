import { View, Text, StyleSheet, TouchableOpacity } from 'react-native'

interface AboutScreenProps {
  /**
   * 返回首页回调。
   * web 端可传入 Next.js router.push('/'),
   * RN 端可传入 navigation.goBack() / navigation.navigate('Home')。
   * 不传则不显示返回按钮。
   */
  onBack?: () => void
}

/**
 * AboutScreen — 首个跨端共享页面 PoC。
 *
 * 共享层(packages/app)中的组件用 react-native primitives(View/Text/StyleSheet),
 * web 端通过 react-native-web 渲染,RN 端原生渲染。
 * 导航通过 onBack 回调注入,实现平台解耦。
 */
export function AboutScreen({ onBack }: AboutScreenProps) {
  return (
    <View style={styles.container}>
      <Text style={styles.title}>关于 IHUI AI</Text>
      <Text style={styles.description}>
        IHUI AI 是全栈 AI 平台,支持 web / api / ai-service / mobile-rn / desktop / extension / miniapp-taro / cli 八端。
      </Text>
      <Text style={styles.description}>
        本页面由 packages/app 共享层渲染,验证 react-native-web + React 19 跨端架构。
      </Text>
      {onBack ? (
        <TouchableOpacity style={styles.button} onPress={onBack}>
          <Text style={styles.buttonText}>返回首页</Text>
        </TouchableOpacity>
      ) : null}
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
  button: {
    marginTop: 16,
    paddingVertical: 12,
    paddingHorizontal: 24,
    backgroundColor: '#10B981',
    borderRadius: 8,
    alignSelf: 'flex-start',
  },
  buttonText: {
    color: '#FFFFFF',
    fontSize: 15,
    fontWeight: '600',
  },
})
