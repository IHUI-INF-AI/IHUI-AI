// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

import { useMemo } from 'react'
import { FlatList, Text, TouchableOpacity, View, StyleSheet } from 'react-native'
import { TextField } from '../../components/TextField'
import { getTokens, type AppThemeTokens } from '../../theme/tokens'
import type { AgentMarketScreenProps } from '../../types'

import { rnRadius, rnSpacing, rnType } from '@ihui/design-tokens'
import { BackChevron } from '../../components/BackChevron'
import {
  EmptyState,
  ErrorState,
  PressableCard,
  ScreenSkeleton,
} from '../../components/ScreenStates'

/** Agent 市场共享屏 — props 注入式跨端组件(纯 UI,不依赖平台 API) */
export type { AgentMarketScreenProps }

export function AgentMarketScreen({
  t,
  items,
  keyword,
  loading,
  error,
  onKeywordChange,
  onSearch,
  onPressItem,
  onBack,
  colorScheme = 'light',
}: AgentMarketScreenProps) {
  const tk = getTokens(colorScheme)
  const styles = useMemo(() => createStyles(tk), [tk])

  if (loading && items.length === 0) {
    return (
      <View style={styles.container}>
        <ScreenSkeleton variant="card" count={4} colorScheme={colorScheme} />
      </View>
    )
  }
  if (error && items.length === 0) {
    return (
      <ErrorState
        message={error}
        onRetry={onBack}
        retryLabel={t('common.back')}
        colorScheme={colorScheme}
      />
    )
  }

  return (
    <View style={styles.container}>
      <BackChevron onPress={onBack} label={t('common.back')} colorScheme={colorScheme} />
      <Text style={styles.title}>{t('agentMarket.title')}</Text>
      <View style={styles.searchRow}>
        <TextField
          colorScheme={colorScheme}
          style={styles.input}
          value={keyword}
          onChangeText={onKeywordChange}
          placeholder={t('agentMarket.searchPlaceholder')}
          placeholderTextColor={tk.text.tertiary}
          onSubmitEditing={onSearch}
          returnKeyType="search"
        />
        <TouchableOpacity style={styles.searchBtn} onPress={onSearch}>
          <Text style={styles.btnText}>{t('common.search')}</Text>
        </TouchableOpacity>
      </View>
      <FlatList
        data={items}
        keyExtractor={(item) => item.id}
        ListEmptyComponent={<EmptyState title={t('agentMarket.empty')} colorScheme={colorScheme} />}
        renderItem={({ item }) => (
          <PressableCard
            onPress={() => onPressItem(item.id)}
            style={styles.card}
            colorScheme={colorScheme}
          >
            <Text style={styles.cardTitle} numberOfLines={1}>
              {item.name}
            </Text>
            <Text style={styles.cardDesc} numberOfLines={2}>
              {item.description}
            </Text>
            <View style={styles.metaRow}>
              <Text style={styles.category}>{item.category}</Text>
              <Text style={styles.meta}>
                ★ {item.rating.toFixed(1)} · {item.uses}
                {t('agentMarket.uses')}
              </Text>
              <Text style={styles.price}>
                {item.isFree ? t('agentMarket.free') : t('agentMarket.paid')}
              </Text>
            </View>
          </PressableCard>
        )}
      />
    </View>
  )
}

function createStyles(tk: AppThemeTokens) {
  return StyleSheet.create({
    container: {
      flex: 1,
      backgroundColor: tk.surface.bg,
      paddingHorizontal: 10,
    },
    btnText: { color: tk.brand.ctaForeground, fontSize: rnType.title.size },
    title: {
      marginTop: rnSpacing.sm,
      marginBottom: rnSpacing.md,
      fontSize: rnType.display.size,
      fontWeight: '700',
      color: tk.text.primary,
    },
    searchRow: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: rnSpacing.sm,
      marginBottom: rnSpacing.md,
    },
    input: {
      flex: 1,
      height: 50,
      borderWidth: 1,
      borderColor: tk.border.light,
      borderRadius: rnRadius.sm,
      paddingHorizontal: rnSpacing.md,
      fontSize: rnType.title.size,
      color: tk.text.primary,
      backgroundColor: tk.surface.muted,
    },
    searchBtn: {
      paddingHorizontal: 14,
      height: 44,
      borderRadius: rnRadius.sm,
      backgroundColor: tk.brand.cta,
      alignItems: 'center',
      justifyContent: 'center',
    },
    card: {
      padding: 14,
      borderRadius: rnRadius.lg,
      borderWidth: 1,
      borderColor: tk.border.light,
      backgroundColor: tk.surface.light,
      marginBottom: rnSpacing.sm,
    },
    cardTitle: { fontSize: rnType.title.size, fontWeight: '600', color: tk.text.primary },
    cardDesc: { marginTop: rnSpacing.sm, fontSize: rnType.body.size, color: tk.text.primary },
    metaRow: { flexDirection: 'row', alignItems: 'center', marginTop: rnSpacing.sm },
    category: { marginRight: rnSpacing.sm, fontSize: rnType.caption.size, color: tk.brand.DEFAULT },
    meta: { fontSize: rnType.caption.size, color: tk.text.tertiary },
    price: {
      marginLeft: 'auto',
      fontSize: rnType.body.size,
      fontWeight: '600',
      color: tk.brand.DEFAULT,
    },
  })
}
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
