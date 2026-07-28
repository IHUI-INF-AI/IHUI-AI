import { useMemo } from 'react'
import { View, Text, TouchableOpacity, ScrollView, RefreshControl, StyleSheet } from 'react-native'
import type { FeedbackHistoryScreenProps, FeedbackStatus } from '../../types'
import { getTokens, type AppThemeTokens } from '../../theme/tokens'

/**
 * FeedbackHistoryScreen — 跨端共享「反馈历史」页。
 *
 * 平台无关:用 react-native primitives 编写,web 端 react-native-web 渲染,RN 端原生渲染。
 * i18n 通过 `t` 注入,数据通过 `items` 注入,导航通过 `onPressItem`/`onBack` 注入,
 * 下拉刷新通过 `refreshing`/`onRefresh` 注入。
 * 配色:由 colorScheme prop('light' | 'dark',默认 'light')经 getTokens 解析为明/暗 token 集。
 *
 * i18n 键来源:@ihui/i18n/messages/shared/{zh-CN,en,ja,ko,zh-TW}.json 的 feedbackHistory 命名空间。
 */
export function FeedbackHistoryScreen({
  t,
  items,
  loading,
  refreshing,
  error,
  onRefresh,
  onPressItem,
  onBack,
  colorScheme = 'light',
}: FeedbackHistoryScreenProps) {
  const tk = getTokens(colorScheme)
  const styles = useMemo(() => createStyles(tk), [tk])

  const statusColor = (status: FeedbackStatus | string) =>
    status === 'resolved'
      ? tk.success.DEFAULT
      : status === 'pending'
        ? tk.warning.amber
        : tk.text.tertiary

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity onPress={onBack} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
          <Text style={styles.backText}>{t('common.back')}</Text>
        </TouchableOpacity>
        <Text style={styles.title}>{t('feedbackHistory.title')}</Text>
      </View>

      {error ? <Text style={styles.errorText}>{error}</Text> : null}

      {loading && items.length === 0 ? (
        <View style={styles.center}>
          <Text style={styles.muted}>{t('common.loading')}</Text>
        </View>
      ) : (
        <ScrollView
          contentContainerStyle={styles.listBody}
          refreshControl={
            <RefreshControl refreshing={refreshing} onRefresh={onRefresh} />
          }
        >
          {items.length === 0 ? (
            <View style={styles.center}>
              <Text style={styles.muted}>{t('feedbackHistory.empty')}</Text>
            </View>
          ) : (
            items.map((item) => (
              <TouchableOpacity
                key={item.id}
                style={styles.card}
                onPress={() => onPressItem(item.id)}
              >
                <View style={styles.titleRow}>
                  <Text style={styles.cardType}>{item.type}</Text>
                  <Text style={[styles.cardStatus, { color: statusColor(item.status) }]}>
                    {item.status}
                  </Text>
                </View>
                <Text style={styles.cardContent} numberOfLines={2}>
                  {item.content}
                </Text>
                <Text style={styles.cardTime}>
                  {t('feedbackHistory.createdAt')}: {item.createdAt}
                </Text>
              </TouchableOpacity>
            ))
          )}
        </ScrollView>
      )}
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
      paddingVertical: 12,
      gap: 12,
    },
    backText: { fontSize: 14, color: tk.text.medium },
    title: { fontSize: 18, fontWeight: '600', color: tk.text.primary },
    errorText: {
      paddingHorizontal: 16,
      fontSize: 12,
      color: tk.danger.DEFAULT,
    },
    center: { alignItems: 'center', paddingVertical: 48 },
    muted: { fontSize: 12, color: tk.text.secondary, marginTop: 8 },
    listBody: { padding: 16 },
    card: {
      padding: 12,
      borderRadius: 8,
      borderWidth: 1,
      borderColor: tk.border.light,
      marginBottom: 8,
    },
    titleRow: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
    },
    cardType: { fontSize: 13, fontWeight: '600', color: tk.success.DEFAULT },
    cardStatus: { fontSize: 12, fontWeight: '600' },
    cardContent: { marginTop: 4, fontSize: 12, color: tk.text.secondary },
    cardTime: { marginTop: 4, fontSize: 11, color: tk.text.tertiary },
  })
}
