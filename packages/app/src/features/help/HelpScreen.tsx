// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

import { rnRadius, rnRadiusFor, rnSpacing, rnType } from '@ihui/design-tokens'

import { useMemo, useState } from 'react'
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  FlatList,
  RefreshControl,
  StyleSheet,
} from 'react-native'
import { getTokens, type AppThemeTokens } from '../../theme/tokens'
import type { HelpListItem, HelpScreenProps } from '../../types'
import { BackChevron } from '../../components/BackChevron'
import { EmptyState, ScreenSkeleton } from '../../components/ScreenStates'
import { filterHelpItems } from './filter-help-items'

/** 帮助列表共享屏 — props 注入式跨端组件 */
export type { HelpListItem, HelpScreenProps }
export { filterHelpItems } from './filter-help-items'

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
  searchValue,
  onSearchChange,
  searchPlaceholder,
}: HelpScreenProps) {
  const tk = getTokens(colorScheme)
  const styles = useMemo(() => createStyles(tk), [tk])
  const [searchFocused, setSearchFocused] = useState(false)

  // 过滤住在共享屏:两端(以及以后从手写页转过来的端)拿到同一套判定,不在壳里各写一份。
  const visibleItems = useMemo(() => filterHelpItems(items, searchValue), [items, searchValue])

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <BackChevron onPress={onBack} label={t('common.back')} colorScheme={colorScheme} />
        <Text style={styles.title}>{t('help.title')}</Text>
      </View>

      {error ? (
        <View style={styles.errorBar}>
          <Text style={styles.errorText}>{error}</Text>
        </View>
      ) : null}

      {onSearchChange ? (
        <View style={styles.searchWrap}>
          <TextInput
            style={[styles.searchInput, searchFocused && styles.searchInputFocused]}
            value={searchValue ?? ''}
            onChangeText={onSearchChange}
            placeholder={searchPlaceholder ?? t('help.searchPlaceholder')}
            placeholderTextColor={tk.text.tertiary}
            onFocus={() => setSearchFocused(true)}
            onBlur={() => setSearchFocused(false)}
            autoCapitalize="none"
            autoCorrect={false}
            returnKeyType="search"
            testID="help-search"
          />
        </View>
      ) : null}

      <FlatList<HelpListItem>
        data={visibleItems}
        keyExtractor={(item) => item.id}
        contentContainerStyle={styles.listBody}
        ItemSeparatorComponent={() => <View style={styles.separator} />}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
        ListEmptyComponent={
          loading ? (
            <ScreenSkeleton variant="list" count={4} colorScheme={colorScheme} />
          ) : (
            <EmptyState title={t('help.empty')} colorScheme={colorScheme} />
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
      paddingHorizontal: rnSpacing['sm-loose'],
      paddingVertical: rnSpacing.md,
      gap: rnSpacing.md,
    },
    title: { fontSize: rnType.heading.size, fontWeight: '700', color: tk.text.primary },
    errorBar: { paddingHorizontal: rnSpacing['sm-loose'], paddingVertical: rnSpacing.sm },
    errorText: { fontSize: rnType.body.size, color: tk.danger.DEFAULT },
    searchWrap: {
      paddingHorizontal: rnSpacing['sm-loose'],
      paddingTop: rnSpacing.sm,
    },
    searchInput: {
      height: 36,
      paddingHorizontal: rnSpacing.md,
      borderRadius: rnRadiusFor.control,
      borderWidth: 1,
      borderColor: tk.border.light,
      backgroundColor: tk.surface.light,
      fontSize: rnType.body.size,
      color: tk.text.primary,
    },
    // 聚焦态只换颜色(§4 唯一例外位),不改宽度 —— 固定高度下加粗会顶起文字
    searchInputFocused: { borderColor: tk.brand.DEFAULT },
    listBody: { padding: 14 },
    separator: { height: 12 },
    card: {
      padding: 14,
      borderRadius: rnRadius.lg,
      borderWidth: 1,
      borderColor: tk.border.light,
      backgroundColor: tk.surface.light,
    },
    question: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
    questionText: {
      flex: 1,
      fontSize: rnType.title.size,
      fontWeight: '700',
      color: tk.text.primary,
    },
    toggle: { fontSize: rnType.heading.size, color: tk.success.DEFAULT, marginLeft: rnSpacing.sm },
    answerText: {
      marginTop: rnSpacing.sm,
      fontSize: rnType.body.size,
      color: tk.text.medium,
      lineHeight: 18,
    },
  })
}
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
