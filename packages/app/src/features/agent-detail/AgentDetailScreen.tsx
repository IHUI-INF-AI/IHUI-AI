import { useMemo } from 'react'
import { ScrollView, Text, TouchableOpacity, View, StyleSheet } from 'react-native'
import { getTokens, type AppThemeTokens } from '../../theme/tokens'
import type { AgentDetailScreenProps } from '../../types'

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
    return (
      <View style={styles.center}>
        <Text style={styles.muted}>{t('common.loading')}</Text>
      </View>
    )
  }
  if (error || !item) {
    return (
      <View style={styles.center}>
        <Text style={styles.error}>{error || t('agentDetail.loadFailed')}</Text>
        <TouchableOpacity style={styles.btn} onPress={onBack}>
          <Text style={styles.btnText}>{t('common.back')}</Text>
        </TouchableOpacity>
      </View>
    )
  }

  return (
    <ScrollView style={styles.container}>
      <TouchableOpacity onPress={onBack}>
        <Text style={styles.back}>{t('common.back')}</Text>
      </TouchableOpacity>
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
        <Text style={styles.value}>★ {item.rating.toFixed(1)}</Text>
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
      paddingHorizontal: 16,
      paddingTop: 48,
      paddingBottom: 32,
    },
    center: {
      flex: 1,
      alignItems: 'center',
      justifyContent: 'center',
      backgroundColor: tk.surface.bg,
      padding: 16,
    },
    muted: { marginTop: 8, fontSize: 13, color: tk.text.secondary },
    error: { fontSize: 13, color: tk.danger.DEFAULT, marginBottom: 8, textAlign: 'center' },
    btn: {
      paddingHorizontal: 16,
      paddingVertical: 8,
      borderRadius: 8,
      backgroundColor: tk.brand.DEFAULT,
    },
    btnText: { color: tk.surface.light, fontSize: 14 },
    back: { fontSize: 14, color: tk.text.secondary },
    head: { marginTop: 8, marginBottom: 12 },
    name: { fontSize: 22, fontWeight: '600', color: tk.text.primary },
    category: { marginTop: 4, fontSize: 12, color: tk.brand.DEFAULT },
    card: { padding: 16, borderRadius: 8, borderWidth: 1, borderColor: tk.border.light },
    label: { marginTop: 8, fontSize: 11, color: tk.text.secondary },
    value: { marginTop: 2, fontSize: 14, color: tk.text.primary },
    price: { marginTop: 2, fontSize: 18, fontWeight: '600', color: tk.brand.DEFAULT },
    cta: {
      marginTop: 16,
      paddingVertical: 12,
      borderRadius: 8,
      backgroundColor: tk.brand.DEFAULT,
      alignItems: 'center',
    },
    ctaText: { color: tk.surface.light, fontSize: 15, fontWeight: '600' },
  })
}
