import { useMemo } from 'react'
import { View, Text, TouchableOpacity, FlatList, RefreshControl, StyleSheet } from 'react-native'
import { getTokens, type AppThemeTokens } from '../../theme/tokens'
import type { HelpListItem, HelpScreenProps } from '../../types'

/** 帮助列表共享屏 — props 注入式跨端组件 */
export type { HelpListItem, HelpScreenProps }

export function HelpScreen({
  t,
  items,
  loading,
  refreshing,
  error,
  expandedId,
  onRefresh,
  onToggle,
  onBack,
  colorScheme = 'light',
}: HelpScreenProps) {
  const tk = getTokens(colorScheme)
  const styles = useMemo(() => createStyles(tk), [tk])

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity onPress={onBack} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
          <Text style={styles.backText}>{t('common.back')}</Text>
        </TouchableOpacity>
        <Text style={styles.title}>{t('help.title')}</Text>
      </View>

      {error ? (
        <View style={styles.errorBar}>
          <Text style={styles.errorText}>{error}</Text>
        </View>
      ) : null}

      <FlatList<HelpListItem>
        data={items}
        keyExtractor={(item) => item.id}
        contentContainerStyle={styles.listBody}
        ItemSeparatorComponent={() => <View style={styles.separator} />}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
        ListEmptyComponent={
          loading ? (
            <View style={styles.center}>
              <Text style={styles.muted}>{t('common.loading')}</Text>
            </View>
          ) : (
            <View style={styles.center}>
              <Text style={styles.muted}>{t('help.empty')}</Text>
            </View>
          )
        }
        renderItem={({ item }) => (
          <View style={styles.card}>
            <TouchableOpacity style={styles.question} onPress={() => onToggle(item.id)}>
              <Text style={styles.questionText} numberOfLines={2}>
                {item.question}
              </Text>
              <Text style={styles.toggle}>{expandedId === item.id ? '−' : '+'}</Text>
            </TouchableOpacity>
            {expandedId === item.id ? <Text style={styles.answerText}>{item.answer}</Text> : null}
          </View>
        )}
      />
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
    errorBar: { paddingHorizontal: 16, paddingVertical: 8 },
    errorText: { fontSize: 12, color: tk.danger.DEFAULT },
    listBody: { padding: 16 },
    separator: { height: 8 },
    card: { padding: 16, borderRadius: 8, borderWidth: 1, borderColor: tk.border.light },
    question: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
    questionText: { flex: 1, fontSize: 13, fontWeight: '600', color: tk.text.primary },
    toggle: { fontSize: 18, color: tk.success.DEFAULT, marginLeft: 8 },
    answerText: { marginTop: 8, fontSize: 12, color: tk.text.medium, lineHeight: 18 },
    center: { alignItems: 'center', paddingVertical: 48 },
    muted: { fontSize: 12, color: tk.text.secondary },
  })
}
