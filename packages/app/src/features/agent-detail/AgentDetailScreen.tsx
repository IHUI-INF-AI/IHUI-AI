// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

import { useMemo } from 'react'
import { ScrollView, Text, TouchableOpacity, View, StyleSheet } from 'react-native'
import { Star } from 'lucide-react-native'
import { getTokens, type AppThemeTokens } from '../../theme/tokens'
import type { AgentDetailScreenProps } from '../../types'

import { rnRadius, rnSpacing, rnType } from '@ihui/design-tokens'
import { BackChevron } from '../../components/BackChevron'
import { ErrorState, ScreenSkeleton } from '../../components/ScreenStates'

/** Agent 详情共享屏 — props 注入式跨端组件 */
export type { AgentDetailScreenProps }

export function AgentDetailScreen({
  t,
  item,
  loading,
  error,
  onBack,
  onStartChat,
  colorScheme = 'light',
}: AgentDetailScreenProps) {
  const tk = getTokens(colorScheme)
  const styles = useMemo(() => createStyles(tk), [tk])

  if (loading) {
    return <ScreenSkeleton variant="card" count={3} colorScheme={colorScheme} />
  }
  if (error || !item) {
    return (
      <ErrorState
        message={error || t('agentDetail.loadFailed')}
        onRetry={onBack}
        retryLabel={t('common.back')}
        colorScheme={colorScheme}
      />
    )
  }

  return (
    <ScrollView style={styles.container}>
      <BackChevron onPress={onBack} label={t('common.back')} colorScheme={colorScheme} />
      <View style={styles.head}>
        <Text style={styles.name}>{item.name}</Text>
        <Text style={styles.category}>{item.category}</Text>
      </View>
      <View style={styles.card}>
        <Text style={styles.label}>{t('agentDetail.description')}</Text>
        <Text style={styles.value}>{item.description || '—'}</Text>
        <Text style={styles.label}>{t('agentDetail.creator')}</Text>
        <Text style={styles.value}>{item.creator}</Text>
        <Text style={styles.label}>{t('agentDetail.uses')}</Text>
        <Text style={styles.value}>{item.uses}</Text>
        <Text style={styles.label}>{t('agentDetail.rating')}</Text>
        <View style={{ flexDirection: 'row', alignItems: 'center' }}>
          <Star size={14} color={tk.warning.DEFAULT} fill={tk.warning.DEFAULT} />
          <Text style={styles.value}>{item.rating.toFixed(1)}</Text>
        </View>
        <Text style={styles.label}>{t('agentDetail.price')}</Text>
        <Text style={styles.price}>
          {item.isFree ? t('agentDetail.free') : `¥${item.price.toFixed(2)}`}
        </Text>
      </View>
      {onStartChat ? (
        <TouchableOpacity style={styles.cta} onPress={() => onStartChat(item.id, item.name)}>
          <Text style={styles.ctaText}>{t('agentDetail.startChat')}</Text>
        </TouchableOpacity>
      ) : null}
    </ScrollView>
  )
}

function createStyles(tk: AppThemeTokens) {
  return StyleSheet.create({
    container: {
      flex: 1,
      backgroundColor: tk.surface.bg,
      paddingHorizontal: 10,
      paddingBottom: rnSpacing['3xl'],
    },
    head: { marginTop: rnSpacing.sm, marginBottom: rnSpacing.md },
    name: { fontSize: rnType.display.size, fontWeight: '700', color: tk.text.primary },
    category: { marginTop: rnSpacing.sm, fontSize: rnType.body.size, color: tk.brand.DEFAULT },
    card: {
      padding: 14,
      borderRadius: rnRadius.lg,
      borderWidth: 1,
      borderColor: tk.border.light,
      backgroundColor: tk.surface.light,
    },
    label: { marginTop: rnSpacing.sm, fontSize: rnType.caption.size, color: tk.text.secondary },
    value: { marginTop: rnSpacing.sm, fontSize: rnType.title.size, color: tk.text.primary },
    price: {
      marginTop: rnSpacing.sm,
      fontSize: rnType.heading.size,
      fontWeight: '600',
      color: tk.brand.DEFAULT,
    },
    cta: {
      marginTop: rnSpacing.lg,
      height: 50,
      borderRadius: rnRadius.xl,
      backgroundColor: tk.brand.cta,
      alignItems: 'center',
      justifyContent: 'center',
    },
    ctaText: { color: tk.surface.light, fontSize: rnType.title.size, fontWeight: '600' },
  })
}
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
