import { useMemo } from 'react'
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native'
import { getTokens, type AppThemeTokens } from '../../theme/tokens'
import type { TFunction } from '../../types'

export interface DevEnterCoverScreenProps {
  t: TFunction
  planType: 'month' | 'year'
  loading: boolean
  onSelectPlan: (plan: 'month' | 'year') => void
  onNavigate: () => void
  onBack: () => void
  colorScheme?: 'light' | 'dark'
}

export function DevEnterCoverScreen({
  planType,
  loading,
  onSelectPlan,
  onNavigate,
  onBack,
  colorScheme = 'light',
}: DevEnterCoverScreenProps) {
  const tk = getTokens(colorScheme)
  const styles = useMemo(() => createStyles(tk), [tk])

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity onPress={onBack} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
          <Text style={styles.backText}>返回</Text>
        </TouchableOpacity>
        <Text style={styles.title}>开发者入驻</Text>
      </View>
      <View style={styles.content}>
        <Text style={styles.desc}>成为平台开发者，发布智能体、课程和服务，获取佣金收益。</Text>
        <View style={styles.planSection}>
          <Text style={styles.planLabel}>选择入驻方案</Text>
          <View style={styles.planList}>
            <TouchableOpacity
              style={[styles.planCard, planType === 'month' && styles.planCardActive]}
              onPress={() => onSelectPlan('month')}
            >
              <Text style={[styles.planName, planType === 'month' && styles.planNameActive]}>
                月度方案
              </Text>
              <Text style={[styles.planPrice, planType === 'month' && styles.planPriceActive]}>
                ¥99/月
              </Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.planCard, planType === 'year' && styles.planCardActive]}
              onPress={() => onSelectPlan('year')}
            >
              <Text style={[styles.planName, planType === 'year' && styles.planNameActive]}>
                年度方案
              </Text>
              <Text style={[styles.planPrice, planType === 'year' && styles.planPriceActive]}>
                ¥999/年
              </Text>
            </TouchableOpacity>
          </View>
        </View>
        <TouchableOpacity
          style={[styles.submitBtn, loading && styles.btnDisabled]}
          onPress={onNavigate}
          disabled={loading}
        >
          <Text style={styles.submitBtnText}>{loading ? '加载中...' : '下一步'}</Text>
        </TouchableOpacity>
      </View>
    </View>
  )
}

function createStyles(tk: AppThemeTokens) {
  return StyleSheet.create({
    container: { flex: 1, backgroundColor: tk.surface.bg },
    header: {
      flexDirection: 'row',
      alignItems: 'center',
      paddingHorizontal: 16,
      paddingTop: 48,
      paddingBottom: 12,
      gap: 12,
    },
    backText: { fontSize: 14, color: tk.text.medium },
    title: { fontSize: 18, fontWeight: '600', color: tk.text.primary },
    content: {
      flex: 1,
      padding: 24,
    },
    desc: {
      fontSize: 14,
      color: tk.text.secondary,
      lineHeight: 20,
      marginBottom: 24,
    },
    planSection: {
      marginBottom: 24,
    },
    planLabel: {
      fontSize: 16,
      fontWeight: '600',
      color: tk.text.primary,
      marginBottom: 12,
    },
    planList: {
      flexDirection: 'row',
      gap: 12,
    },
    planCard: {
      flex: 1,
      padding: 16,
      borderRadius: 12,
      borderWidth: 1,
      borderColor: tk.border.light,
      backgroundColor: tk.surface.card,
      alignItems: 'center',
    },
    planCardActive: {
      borderColor: tk.brand.DEFAULT,
      backgroundColor: tk.surface.light,
    },
    planName: {
      fontSize: 14,
      fontWeight: '600',
      color: tk.text.primary,
      marginBottom: 4,
    },
    planNameActive: {
      color: tk.brand.DEFAULT,
    },
    planPrice: {
      fontSize: 12,
      color: tk.text.secondary,
    },
    planPriceActive: {
      color: tk.brand.DEFAULT,
    },
    submitBtn: {
      paddingVertical: 14,
      borderRadius: 12,
      backgroundColor: tk.brand.DEFAULT,
      alignItems: 'center',
    },
    btnDisabled: {
      opacity: 0.6,
    },
    submitBtnText: {
      fontSize: 16,
      fontWeight: '600',
      color: tk.surface.light,
    },
  })
}
