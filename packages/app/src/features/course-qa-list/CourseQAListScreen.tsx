import { useMemo } from 'react'
import { View, Text, TouchableOpacity, FlatList, RefreshControl, StyleSheet } from 'react-native'
import { getTokens, type AppThemeTokens } from '../../theme/tokens'
import type { CourseQAListItem, CourseQAListScreenProps } from '../../types'

/** 课程问答列表/Props 类型 re-export(单一来源 @ihui/types) */
export type { CourseQAListItem, CourseQAListScreenProps }

/**
 * 课程问答列表共享屏 — props 注入式跨端组件
 *
 * 平台无关:负责渲染 header(返回 + 标题 + 可选提问按钮)+ 错误提示 + loading 态
 * + 问答卡片列表(question + asker + answerCount + createdAt)+ 下拉刷新 + 空态。
 * 平台特定(导航 / API 调用)由 wrapper 通过 props 注入。
 */
export function CourseQAListScreen({
  t,
  items,
  loading,
  refreshing,
  error,
  onRefresh,
  onPressItem,
  onAsk,
  onBack,
  colorScheme = 'light',
}: CourseQAListScreenProps) {
  const tk = getTokens(colorScheme)
  const styles = useMemo(() => createStyles(tk), [tk])

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity onPress={onBack} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
          <Text style={styles.backText}>{t('common.back')}</Text>
        </TouchableOpacity>
        <Text style={styles.title}>{t('courseQAList.title')}</Text>
        {onAsk ? (
          <TouchableOpacity onPress={onAsk} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
            <Text style={styles.askText}>{t('courseQAList.ask')}</Text>
          </TouchableOpacity>
        ) : null}
      </View>

      {error ? <Text style={styles.errorText}>{error}</Text> : null}

      {loading && items.length === 0 ? (
        <View style={styles.center}>
          <Text style={styles.muted}>{t('common.loading')}</Text>
        </View>
      ) : (
        <FlatList
          data={items}
          keyExtractor={(item) => item.id}
          contentContainerStyle={styles.listBody}
          ItemSeparatorComponent={() => <View style={styles.separator} />}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
          ListEmptyComponent={
            <View style={styles.center}>
              <Text style={styles.muted}>{t('courseQAList.empty')}</Text>
            </View>
          }
          renderItem={({ item }) => (
            <TouchableOpacity
              style={styles.card}
              onPress={() => onPressItem(item)}
              hitSlop={{ top: 4, bottom: 4, left: 4, right: 4 }}
            >
              <Text style={styles.cardTitle} numberOfLines={2}>
                {item.question}
              </Text>
              <Text style={styles.cardMeta}>
                {t('courseQAList.asker')}: {item.asker} · {t('courseQAList.answers')}:{' '}
                {item.answerCount}
              </Text>
              <Text style={styles.cardTime}>{item.createdAt}</Text>
            </TouchableOpacity>
          )}
        />
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
    title: { flex: 1, fontSize: 18, fontWeight: '600', color: tk.text.primary },
    askText: { fontSize: 13, color: tk.success.DEFAULT, fontWeight: '600' },
    errorText: { paddingHorizontal: 16, fontSize: 12, color: tk.danger.DEFAULT },
    center: { alignItems: 'center', paddingVertical: 48 },
    muted: { fontSize: 12, color: tk.text.secondary, marginTop: 8 },
    listBody: { padding: 16 },
    separator: { height: 8 },
    card: {
      padding: 12,
      borderRadius: 8,
      borderWidth: 1,
      borderColor: tk.border.light,
    },
    cardTitle: { fontSize: 14, fontWeight: '600', color: tk.text.primary },
    cardMeta: { marginTop: 6, fontSize: 11, color: tk.text.secondary },
    cardTime: { marginTop: 4, fontSize: 11, color: tk.text.tertiary },
  })
}
