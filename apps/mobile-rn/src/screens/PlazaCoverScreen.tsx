/**
 * PlazaCoverScreen 广场引导封面(mobile-rn 端)
 *
 * 对齐历史 Uniapp pagesA/plaza/cover.vue(广场入口引导封面):
 * - 全屏封面 + 标题「AI 需求广场」+ 描述
 * - 「进入广场」按钮 → 跳转 Plaza 路由(已注册)
 * - 「发布需求」次按钮 → 跳转 SetNeed 路由
 * - 浅色优雅风,rnLightTokens;圆角守门(无 rounded-full);无分割线
 */
import { Pressable, ScrollView, StyleSheet, Text, View, type TextStyle, type ViewStyle } from 'react-native'
import { useNavigation } from '@react-navigation/native'
import type { NativeStackNavigationProp } from '@react-navigation/native-stack'
import { rnLightTokens as tk } from '@ihui/design-tokens'
import { NavBar } from '../components/NavBar'
import type { RootStackParamList } from '../navigation/RootNavigator'

type NavigationProp = NativeStackNavigationProp<RootStackParamList>

interface Feature {
  icon: string
  label: string
  desc: string
}

const FEATURES: readonly Feature[] = [
  { icon: '🎯', label: '精准匹配', desc: '智能推荐开发者' },
  { icon: '💰', label: '透明预算', desc: '预算区间双向选择' },
  { icon: '⚡', label: '快速响应', desc: '24h 内对接' },
  { icon: '🛡️', label: '平台担保', desc: '资金安全保障' },
]

export function PlazaCoverScreen() {
  const navigation = useNavigation<NavigationProp>()

  const onEnter = () => {
    navigation.navigate('Plaza')
  }

  const onPublish = () => {
    navigation.navigate('SetNeed')
  }

  return (
    <View style={styles.container}>
      <NavBar title="AI 需求广场" onBack={() => navigation.goBack()} backgroundColor={tk.surface.bg} />
      <ScrollView contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
        <View style={styles.hero}>
          <Text style={styles.heroEmoji}>🌐</Text>
          <Text style={styles.heroTitle}>AI 需求广场</Text>
          <Text style={styles.heroSubtitle}>
            一站式 AI 需求发布与对接平台,连接企业与开发者,让创意快速落地
          </Text>
        </View>

        <View style={styles.featureGrid}>
          {FEATURES.map((feature) => (
            <View key={feature.label} style={styles.featureCard}>
              <Text style={styles.featureIcon}>{feature.icon}</Text>
              <Text style={styles.featureLabel}>{feature.label}</Text>
              <Text style={styles.featureDesc}>{feature.desc}</Text>
            </View>
          ))}
        </View>

        <View style={styles.actions}>
          <Pressable
            style={({ pressed }) => [styles.primaryBtn, pressed ? styles.primaryBtnPressed : null]}
            onPress={onEnter}
            accessibilityRole="button"
            accessibilityLabel="进入广场"
          >
            <Text style={styles.primaryBtnText}>进入广场</Text>
          </Pressable>
          <Pressable
            style={styles.secondaryBtn}
            onPress={onPublish}
            accessibilityRole="button"
            accessibilityLabel="发布需求"
          >
            <Text style={styles.secondaryBtnText}>发布需求 ＋</Text>
          </Pressable>
        </View>

        <Text style={styles.footerNote}>已入驻 1000+ 开发者,500+ 需求成功对接</Text>
      </ScrollView>
    </View>
  )
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: tk.surface.bg } as ViewStyle,
  scrollContent: { paddingHorizontal: 20, paddingBottom: 32, gap: 20 } as ViewStyle,
  hero: { alignItems: 'center', paddingVertical: 32, gap: 12 } as ViewStyle,
  heroEmoji: { fontSize: 64 } as TextStyle,
  heroTitle: { fontSize: 24, fontWeight: '700', color: tk.text.primary } as TextStyle,
  heroSubtitle: {
    fontSize: 13,
    color: tk.text.secondary,
    textAlign: 'center',
    lineHeight: 19,
  } as TextStyle,
  featureGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 12,
  } as ViewStyle,
  featureCard: {
    width: '47%',
    backgroundColor: tk.surface.card,
    borderRadius: 12,
    padding: 14,
    gap: 6,
    alignItems: 'center',
  } as ViewStyle,
  featureIcon: { fontSize: 32 } as TextStyle,
  featureLabel: { fontSize: 14, fontWeight: '600', color: tk.text.primary } as TextStyle,
  featureDesc: { fontSize: 12, color: tk.text.tertiary, textAlign: 'center' } as TextStyle,
  actions: { gap: 10 } as ViewStyle,
  primaryBtn: {
    backgroundColor: tk.brand.DEFAULT,
    borderRadius: 12,
    paddingVertical: 14,
    alignItems: 'center',
  } as ViewStyle,
  primaryBtnPressed: { opacity: 0.85 } as ViewStyle,
  primaryBtnText: { fontSize: 16, fontWeight: '600', color: tk.surface.light } as TextStyle,
  secondaryBtn: {
    borderRadius: 12,
    paddingVertical: 12,
    alignItems: 'center',
    backgroundColor: tk.surface.card,
  } as ViewStyle,
  secondaryBtnText: { fontSize: 14, color: tk.text.secondary, fontWeight: '500' } as TextStyle,
  footerNote: {
    fontSize: 12,
    color: tk.text.tertiary,
    textAlign: 'center',
  } as TextStyle,
})

export default PlazaCoverScreen
