import { useMemo } from 'react'
import {
  ActivityIndicator,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native'
import { getTokens, type AppThemeTokens } from '../../theme/tokens'
import type { AgentStatScreenProps } from '../../types'

/** Agent 统计共享屏 — props 注入式跨端组件(纯 UI,不依赖平台 API) */
export type { AgentStatScreenProps }

export function AgentStatScreen({
  t,
  stat,
  loading,
  error,
  onBack,
  colorScheme = 'light',
}: AgentStatScreenProps) {
  const tk = getTokens(colorScheme)
  const styles = useMemo(() => createStyles(tk), [tk])

  if (loading) {
    return (
      <View style={styles.center}>
        <ActivityIndicator color={tk.brand.DEFAULT} />
        <Text style={styles.muted}>{t('common.loading')}</Text>
      </View>
    )
  }
  if (error || !stat) {
    return (
      <View style={styles.center}>
        <Text style={styles.error}>{error || t('common.empty')}</Text>
        <TouchableOpacity style={styles.backBtn} onPress={onBack}>
          <Text style={styles.back}>{t('common.back')}</Text>
        </TouchableOpacity>
      </View>
    )
  }

  const metrics: Array<[string, string | number]> = [
    [t('agentStat.conversations'), stat.conversations],
    [t('agentStat.messages'), stat.messages],
    [t('agentStat.tokens'), stat.tokens],
    [t('agentStat.avgRating'), stat.avgRating.toFixed(2)],
  ]

  return (
    <ScrollView style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity onPress={onBack}>
          <Text style={styles.back}>{t('common.back')}</Text>
        </TouchableOpacity>
        <Text style={styles.title}>{t('agentStat.title')}</Text>
      </View>
      <View style={styles.body}>
        {metrics.map(([label, value]) => (
          <View key={label} style={styles.row}>
            <Text style={styles.label}>{label}</Text>
            <Text style={styles.value}>{value}</Text>
          </View>
        ))}
      </View>
    </ScrollView>
  )
}

function createStyles(tk: AppThemeTokens) {
  return StyleSheet.create({
    container: { flex: 1, backgroundColor: tk.surface.bg },
    header: {
      flexDirection: 'row',
      alignItems: 'center',
      paddingHorizontal: 10,
      paddingVertical: 12,
      gap: 12,
    },
    body: { padding: 14 },
    back: { fontSize: 16, color: tk.text.medium },
    title: { fontSize: 20, fontWeight: '700', color: tk.text.primary },
    row: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
      paddingVertical: 12,
      borderBottomWidth: 1,
      borderBottomColor: tk.border.light,
    },
    label: { fontSize: 14, color: tk.text.secondary },
    value: { fontSize: 16, fontWeight: '600', color: tk.brand.DEFAULT },
    center: {
      flex: 1,
      alignItems: 'center',
      justifyContent: 'center',
      padding: 16,
      backgroundColor: tk.surface.bg,
    },
    muted: { fontSize: 14, color: tk.text.secondary, marginTop: 8 },
    error: { fontSize: 14, color: tk.error.text, textAlign: 'center' },
    backBtn: { marginTop: 12 },
  })
}
