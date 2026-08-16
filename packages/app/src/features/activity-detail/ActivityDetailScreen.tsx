import { useMemo } from 'react'
import { View, Text, TouchableOpacity, ScrollView, StyleSheet } from 'react-native'
import { getTokens, type AppThemeTokens } from '../../theme/tokens'
import type { ActivityDetailItem, ActivityDetailScreenProps } from '../../types'

/** 活动详情共享屏 — props 注入式跨端组件 */
export type { ActivityDetailItem, ActivityDetailScreenProps }

export function ActivityDetailScreen({
  t,
  item,
  loading,
  error,
  onBack,
  colorScheme = 'light',
}: ActivityDetailScreenProps) {
  const tk = getTokens(colorScheme)
  const styles = useMemo(() => createStyles(tk), [tk])

  if (loading) {
    return (
      <View style={styles.container}>
        <View style={styles.header}>
          <TouchableOpacity onPress={onBack} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
            <Text style={styles.back}>{t('common.back')}</Text>
          </TouchableOpacity>
          <Text style={styles.title}>{t('activityDetail.title')}</Text>
        </View>
        <View style={styles.center}>
          <Text style={styles.muted}>{t('common.loading')}</Text>
        </View>
      </View>
    )
  }

  if (error || !item) {
    return (
      <View style={styles.container}>
        <View style={styles.header}>
          <TouchableOpacity onPress={onBack} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
            <Text style={styles.back}>{t('common.back')}</Text>
          </TouchableOpacity>
          <Text style={styles.title}>{t('activityDetail.title')}</Text>
        </View>
        <View style={styles.center}>
          <Text style={styles.error}>{error || t('activityDetail.empty')}</Text>
          <TouchableOpacity onPress={onBack} style={styles.retryBtn}>
            <Text style={styles.back}>{t('common.back')}</Text>
          </TouchableOpacity>
        </View>
      </View>
    )
  }

  return (
    <ScrollView style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity onPress={onBack} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
          <Text style={styles.back}>{t('common.back')}</Text>
        </TouchableOpacity>
        <Text style={styles.title}>{t('activityDetail.title')}</Text>
      </View>
      <View style={styles.body}>
        <Text style={styles.itemTitle}>{item.title}</Text>
        <View style={styles.metaRow}>
          <Text style={styles.metaLabel}>{t('activityDetail.startAt')}</Text>
          <Text style={styles.metaValue}>{item.startAt}</Text>
        </View>
        <View style={styles.metaRow}>
          <Text style={styles.metaLabel}>{t('activityDetail.endAt')}</Text>
          <Text style={styles.metaValue}>{item.endAt}</Text>
        </View>
        <View style={styles.metaRow}>
          <Text style={styles.metaLabel}>{t('activityDetail.location')}</Text>
          <Text style={styles.metaValue}>{item.location}</Text>
        </View>
        <Text style={styles.content}>{item.content}</Text>
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
    back: { fontSize: 16, color: tk.text.medium },
    title: { fontSize: 20, fontWeight: '700', color: tk.text.primary },
    center: {
      alignItems: 'center',
      justifyContent: 'center',
      paddingVertical: 48,
      paddingHorizontal: 10,
    },
    muted: { fontSize: 14, color: tk.text.secondary },
    error: { fontSize: 14, color: tk.danger.DEFAULT, textAlign: 'center' },
    retryBtn: { marginTop: 12 },
    body: { padding: 14 },
    itemTitle: { fontSize: 20, fontWeight: '700', color: tk.text.primary },
    metaRow: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      paddingVertical: 8,
    },
    metaLabel: { fontSize: 14, color: tk.text.secondary },
    metaValue: { fontSize: 14, fontWeight: '500', color: tk.text.primary },
    content: { marginTop: 12, fontSize: 16, lineHeight: 22, color: tk.text.primary },
  })
}
