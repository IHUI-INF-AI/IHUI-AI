import { useMemo } from 'react'
import { View, Text, TouchableOpacity, ScrollView, StyleSheet, type TextStyle, type ViewStyle } from 'react-native'
import { getTokens, type AppThemeTokens } from '../../theme/tokens'
import type { PlazaCoverScreenProps } from '../../types'

/** Props 类型 re-export(单一来源 @ihui/types) */
export type { PlazaCoverScreenProps }

/**
 * 广场引导封面共享屏 — 纯 UI 渲染,平台无关
 *
 * 渲染封面 + 4 个特性卡片 + 进入广场/发布需求按钮
 * 导航/数据由 wrapper 通过 props 注入
 */
export function PlazaCoverScreen({
  t,
  onBack,
  onEnter,
  onPublish,
  colorScheme = 'light',
}: PlazaCoverScreenProps) {
  const tk = getTokens(colorScheme)
  const styles = useMemo(() => createStyles(tk), [tk])

  const FEATURES = [
    { icon: '🎯', label: '精准匹配', desc: '智能推荐开发者' },
    { icon: '💰', label: '透明预算', desc: '预算区间双向选择' },
    { icon: '⚡', label: '快速响应', desc: '24h 内对接' },
    { icon: '🛡️', label: '平台担保', desc: '资金安全保障' },
  ]

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity onPress={onBack} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
          <Text style={styles.backText}>{t('common.back')}</Text>
        </TouchableOpacity>
        <Text style={styles.headerTitle}>AI 需求广场</Text>
      </View>
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
          <TouchableOpacity
            style={styles.primaryBtn}
            activeOpacity={0.7}
            onPress={onEnter}
          >
            <Text style={styles.primaryBtnText}>进入广场</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={styles.secondaryBtn}
            activeOpacity={0.7}
            onPress={onPublish}
          >
            <Text style={styles.secondaryBtnText}>发布需求 ＋</Text>
          </TouchableOpacity>
        </View>

        <Text style={styles.footerNote}>已入驻 1000+ 开发者,500+ 需求成功对接</Text>
      </ScrollView>
    </View>
  )
}

function createStyles(tk: AppThemeTokens) {
  return StyleSheet.create({
    container: { flex: 1, backgroundColor: tk.surface.bg } as ViewStyle,
    header: {
      flexDirection: 'row',
      alignItems: 'center',
      paddingHorizontal: 16,
      paddingVertical: 12,
      gap: 12,
    } as ViewStyle,
    backText: { fontSize: 14, color: tk.text.medium } as TextStyle,
    headerTitle: { fontSize: 18, fontWeight: '600', color: tk.text.primary } as TextStyle,
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
}
