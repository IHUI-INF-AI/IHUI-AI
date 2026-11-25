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
  onRetry,
  colorScheme = 'light',
  /** 2026-11-25:tab 宿主(小程序底部第 1 位)不该画返回键 —— 根 tab 无处可返。
   *  默认 true 保持 RN stack 屏原行为,零回归。 */
  showBack = true,
}: AgentMarketScreenProps & { onRetry?: () => void; showBack?: boolean }) {
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
        onRetry={onRetry}
        retryLabel={t('common.retry')}
        colorScheme={colorScheme}
      />
    )
  }

  return (
    <View style={styles.container}>
      {showBack ? (
          <BackChevron onPress={onBack} label={t('common.back')} colorScheme={colorScheme} />
        ) : null}
      <Text style={styles.title}>{t('agentMarket.title')}</Text>
      <View style={styles.searchRow}>
        <TextField
          colorScheme={colorScheme}
          style={styles.input}
          value={keyword}
          onChangeText={onKeywordChange}
          placeholder={t('agentMarket.searchPlaceholder')}
          placeholderTextColor={tk.text.secondary}
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
        contentContainerStyle={styles.listBody}
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
              {/* category 可选:公开面只有 categoryId(uuid),无名称时不渲染 */}
              {item.category ? <Text style={styles.category}>{item.category}</Text> : null}
              <Text style={styles.meta}>
                ★ {item.rating !== null && item.rating !== undefined ? item.rating.toFixed(1) : '—'}{' '}
                · {item.uses}
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
      paddingHorizontal: rnSpacing['sm-loose'],
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
      borderRadius: rnRadius.md,
      paddingHorizontal: rnSpacing.md,
      fontSize: rnType.title.size,
      color: tk.text.primary,
      backgroundColor: tk.surface.muted,
    },
    searchBtn: {
      paddingHorizontal: rnSpacing['md-loose'],
      height: 44,
      borderRadius: rnRadius.md,
      backgroundColor: tk.brand.cta,
      alignItems: 'center',
      justifyContent: 'center',
    },
    card: {
      padding: rnSpacing['md-loose'],
      borderRadius: rnRadius.lg,
      borderWidth: 1,
      borderColor: 'transparent',
      // 卡片面取 surface.card:暗档比页面底深约 10 级,轮廓立得起来;light 档与 bg 同为纯白零变化
      backgroundColor: tk.surface.card,
      marginBottom: rnSpacing.sm,
    },
    cardTitle: { fontSize: rnType.title.size, fontWeight: '600', color: tk.text.primary },
    cardDesc: { marginTop: rnSpacing.sm, fontSize: rnType.body.size, color: tk.text.secondary },
    metaRow: { flexDirection: 'row', alignItems: 'center', marginTop: rnSpacing.sm },
    category: { marginRight: rnSpacing.sm, fontSize: rnType.caption.size, color: tk.brand.DEFAULT },
    meta: { fontSize: rnType.caption.size, color: tk.text.medium },
    price: {
      marginLeft: 'auto',
      fontSize: rnType.body.size,
      fontWeight: '600',
      color: tk.brand.DEFAULT,
    },
    listBody: {
      paddingBottom: rnSpacing['3xl'],
    },
  })
}
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
