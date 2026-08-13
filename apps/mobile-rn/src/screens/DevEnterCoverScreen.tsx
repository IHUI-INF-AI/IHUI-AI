/**
 * DevEnterCoverScreen 开发者入驻封面(mobile-rn 端)
 *
 * 对齐历史 Uniapp pagesA/dev_enter/cover.vue(全屏封面 + 套餐选择 + 一键开通):
 * - 顶部返回按钮(透明 NavBar)
 * - 全屏封面区(标题 + 描述 + 主视觉)
 * - 套餐选择(包月 / 包年,对齐 .vue advert_body-case)
 * - 「立即入驻」按钮 → 跳转 DevEnter 路由
 * - 「了解更多」按钮 → 跳转 ArticleDetail
 * - 浅色优雅风,rnLightTokens;圆角守门(无 rounded-full);无分割线
 */
import { useState } from 'react'
import { Alert, Pressable, ScrollView, StyleSheet, Text, View, type TextStyle, type ViewStyle } from 'react-native'
import { useNavigation } from '@react-navigation/native'
import type { NativeStackNavigationProp } from '@react-navigation/native-stack'
import { rnLightTokens as tk } from '@ihui/design-tokens'
import { NavBar } from '../components/NavBar'
import type { RootStackParamList } from '../navigation/RootNavigator'

type NavigationProp = NativeStackNavigationProp<RootStackParamList>

type DevPlanType = 'month' | 'year'

interface DevPlan {
  type: DevPlanType
  label: string
  price: string
  unit: string
  highlight: string
}

const PLANS: readonly DevPlan[] = [
  { type: 'month', label: '开发者包月', price: '100', unit: '/ 月', highlight: '灵活开通' },
  { type: 'year', label: '开发者包年', price: '1000', unit: '/ 年', highlight: '超值省 200' },
]

export function DevEnterCoverScreen() {
  const navigation = useNavigation<NavigationProp>()
  const [selected, setSelected] = useState<DevPlanType>('year')

  const onEnter = () => {
    navigation.navigate('DevEnter')
  }

  const onLearnMore = () => {
    Alert.alert('开发者入驻', '开发者可发布 AI 模型、Agent 应用,获取分成收益。详细文档可在「学习中心」查阅。', [
      { text: '知道了' },
      {
        text: '查看文章',
        onPress: () => navigation.navigate('ArticleList'),
      },
    ])
  }

  return (
    <View style={styles.container}>
      <NavBar title="开发者入驻" onBack={() => navigation.goBack()} backgroundColor={tk.surface.bg} />
      <ScrollView contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
        <View style={styles.hero}>
          <Text style={styles.heroEmoji}>🚀</Text>
          <Text style={styles.heroTitle}>开发者入驻</Text>
          <Text style={styles.heroSubtitle}>发布 AI 模型 / Agent 应用,共享平台流量与分成收益</Text>
        </View>

        <Text style={styles.sectionTitle}>请选择所需要的服务</Text>

        <View style={styles.plansRow}>
          {PLANS.map((plan) => {
            const active = plan.type === selected
            return (
              <Pressable
                key={plan.type}
                style={[styles.planCard, active ? styles.planCardActive : null]}
                onPress={() => setSelected(plan.type)}
                accessibilityRole="button"
                accessibilityLabel={plan.label}
              >
                <Text style={[styles.planLabel, active ? styles.planLabelActive : null]}>
                  {plan.label}
                </Text>
                <View style={styles.planFooter}>
                  <Text style={[styles.planPrice, active ? styles.planPriceActive : null]}>
                    ¥{plan.price}
                  </Text>
                  <Text style={[styles.planUnit, active ? styles.planUnitActive : null]}>
                    {plan.unit}
                  </Text>
                </View>
                <Text style={[styles.planHighlight, active ? styles.planHighlightActive : null]}>
                  {plan.highlight}
                </Text>
              </Pressable>
            )
          })}
        </View>

        <View style={styles.actions}>
          <Pressable
            style={({ pressed }) => [styles.primaryBtn, pressed ? styles.primaryBtnPressed : null]}
            onPress={onEnter}
            accessibilityRole="button"
            accessibilityLabel="立即入驻"
          >
            <Text style={styles.primaryBtnText}>立即入驻</Text>
          </Pressable>
          <Pressable
            style={styles.secondaryBtn}
            onPress={onLearnMore}
            accessibilityRole="button"
            accessibilityLabel="了解更多"
          >
            <Text style={styles.secondaryBtnText}>了解更多 ›</Text>
          </Pressable>
        </View>

        <Text style={styles.footerNote}>开发者须知 · 入驻即表示同意平台开发者协议</Text>
      </ScrollView>
    </View>
  )
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: tk.surface.bg } as ViewStyle,
  scrollContent: { paddingHorizontal: 20, paddingBottom: 32, gap: 16 } as ViewStyle,
  hero: { alignItems: 'center', paddingVertical: 24, gap: 10 } as ViewStyle,
  heroEmoji: { fontSize: 56 } as TextStyle,
  heroTitle: { fontSize: 22, fontWeight: '700', color: tk.text.primary } as TextStyle,
  heroSubtitle: {
    fontSize: 13,
    color: tk.text.secondary,
    textAlign: 'center',
    lineHeight: 19,
  } as TextStyle,
  sectionTitle: { fontSize: 15, fontWeight: '600', color: tk.text.primary } as TextStyle,
  plansRow: { flexDirection: 'row', gap: 12 } as ViewStyle,
  planCard: {
    flex: 1,
    backgroundColor: tk.surface.card,
    borderRadius: 12,
    padding: 14,
    gap: 8,
    borderWidth: 1.5,
    borderColor: 'transparent',
  } as ViewStyle,
  planCardActive: { borderColor: tk.purple.DEFAULT, backgroundColor: tk.purple.light } as ViewStyle,
  planLabel: { fontSize: 14, fontWeight: '600', color: tk.text.primary } as TextStyle,
  planLabelActive: { color: tk.purple.DEFAULT } as TextStyle,
  planFooter: { flexDirection: 'row', alignItems: 'baseline', gap: 4 } as ViewStyle,
  planPrice: { fontSize: 20, fontWeight: '700', color: tk.text.primary } as TextStyle,
  planPriceActive: { color: tk.purple.DEFAULT } as TextStyle,
  planUnit: { fontSize: 12, color: tk.text.tertiary } as TextStyle,
  planUnitActive: { color: tk.purple.DEFAULT } as TextStyle,
  planHighlight: { fontSize: 12, color: tk.text.tertiary } as TextStyle,
  planHighlightActive: { color: tk.warning.deep, fontWeight: '600' } as TextStyle,
  actions: { gap: 10, marginTop: 8 } as ViewStyle,
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
  secondaryBtnText: { fontSize: 14, color: tk.text.secondary } as TextStyle,
  footerNote: {
    fontSize: 12,
    color: tk.text.tertiary,
    textAlign: 'center',
    marginTop: 8,
  } as TextStyle,
})

export default DevEnterCoverScreen
