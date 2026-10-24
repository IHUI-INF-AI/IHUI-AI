// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

import { useMemo } from 'react'
import {
  ActivityIndicator,
  Pressable,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native'
import { getTokens, type AppThemeTokens } from '../../theme/tokens'
import { rnRadius, rnSpacing, rnType } from '@ihui/design-tokens'
import { BackChevron } from '../../components/BackChevron'
import { EmptyState, ErrorState } from '../../components/ScreenStates'

/**
 * 通用控制台列表屏 —— 61 条控制台类页面(models/developer 网关族)的规模化杠杆:
 * 列配置驱动,一份实现承载所有「列表 + 状态 + 分页 + 下拉刷新」形态的控制台页,
 * 各页薄壳只配 columns 与取数(最大化减少开发)。
 *
 * 平台侧注入:取数、行操作副作用(onRowPress)、刷新;本屏纯 UI,token 档直书。
 */
export interface ConsoleColumn {
  key: string
  title: string
  /** mono = 等宽感(单号/密钥);badge = 强调徽章 */
  render?: 'text' | 'mono' | 'badge'
  flex?: number
}

export type ConsoleBadgeTone = 'ok' | 'warn' | 'danger' | 'muted'

export interface ConsoleRowView {
  id: string
  cells: Record<string, string | null>
  badgeTone?: ConsoleBadgeTone
}

export interface ConsoleTableScreenProps {
  t: (key: string, params?: Record<string, string | number>) => string
  colorScheme?: 'light' | 'dark'
  onBack: () => void
  title: string
  columns: ConsoleColumn[]
  rows: ConsoleRowView[]
  loading: boolean
  refreshing?: boolean
  error: string | null
  hasMore?: boolean
  onRetry: () => void
  onRefresh?: () => void
  onLoadMore?: () => void
  onRowPress?: (row: ConsoleRowView) => void
}

export function ConsoleTableScreen({
  t,
  colorScheme = 'light',
  onBack,
  title,
  columns,
  rows,
  loading,
  refreshing = false,
  error,
  hasMore = false,
  onRetry,
  onRefresh,
  onLoadMore,
  onRowPress,
}: ConsoleTableScreenProps) {
  const tk = getTokens(colorScheme)
  const styles = useMemo(() => createStyles(tk), [tk])
  const toneColor = (tone?: ConsoleBadgeTone) =>
    tone === 'ok'
      ? tk.success.DEFAULT
      : tone === 'danger'
        ? tk.danger.DEFAULT
        : tone === 'warn'
          ? tk.brand.cta
          : tk.text.secondary

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <BackChevron onPress={onBack} label={t('common.back')} colorScheme={colorScheme} />
        <Text style={styles.title}>{title}</Text>
      </View>
      <ScrollView
        contentContainerStyle={styles.body}
        refreshControl={
          onRefresh ? <RefreshControl refreshing={refreshing} onRefresh={onRefresh} /> : undefined
        }
      >
        {loading && rows.length === 0 ? (
          <View style={styles.center}>
            <ActivityIndicator color={tk.brand.cta} />
          </View>
        ) : error && rows.length === 0 ? (
          <ErrorState
            message={error}
            onRetry={onRetry}
            retryLabel={t('common.retry')}
            colorScheme={colorScheme}
          />
        ) : rows.length === 0 ? (
          <EmptyState glyph="◍" title={t('common.empty')} colorScheme={colorScheme} />
        ) : (
          <View style={styles.list}>
            {rows.map((row) => (
              <Pressable
                key={row.id}
                onPress={onRowPress ? () => onRowPress(row) : undefined}
                style={({ pressed }) => [styles.card, pressed && styles.btnPressed]}
                accessibilityRole={onRowPress ? 'button' : undefined}
              >
                {columns.map((col) => {
                  const v = row.cells[col.key]
                  if (v === null || v === undefined || v === '') return null
                  return (
                    <View key={col.key} style={[styles.cellRow, { flex: col.flex ?? 1 }]}>
                      <Text style={styles.cellLabel} numberOfLines={1}>
                        {col.title}
                      </Text>
                      <Text
                        style={[
                          col.render === 'badge' ? styles.cellBadge : styles.cellValue,
                          col.render === 'mono' && styles.cellMono,
                          col.render === 'badge' && { color: toneColor(row.badgeTone) },
                        ]}
                        numberOfLines={1}
                      >
                        {v}
                      </Text>
                    </View>
                  )
                })}
              </Pressable>
            ))}
            {hasMore && onLoadMore ? (
              <Pressable
                onPress={onLoadMore}
                style={({ pressed }) => [styles.moreBtn, pressed && styles.btnPressed]}
                accessibilityRole="button"
              >
                <Text style={styles.moreBtnText}>{t('common.loadMore')}</Text>
              </Pressable>
            ) : null}
          </View>
        )}
      </ScrollView>
    </View>
  )
}

function createStyles(tk: AppThemeTokens) {
  return StyleSheet.create({
    container: { flex: 1, backgroundColor: tk.surface.bg },
    header: {
      flexDirection: 'row',
      alignItems: 'center',
      paddingHorizontal: rnSpacing.lg,
      paddingVertical: rnSpacing.md,
      gap: rnSpacing.md,
    },
    title: { ...rnType.heading, color: tk.text.primary },
    body: { padding: rnSpacing.lg },
    center: { alignItems: 'center', justifyContent: 'center', paddingVertical: rnSpacing['3xl'] },
    list: { gap: rnSpacing.md },
    card: {
      borderRadius: rnRadius.lg,
      borderWidth: 1,
      borderColor: tk.border.light,
      backgroundColor: tk.surface.light,
      padding: rnSpacing.lg,
      gap: rnSpacing.sm,
    },
    cellRow: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      gap: rnSpacing.sm,
    },
    cellLabel: { flexShrink: 0, fontSize: rnType.label.size, color: tk.text.tertiary },
    cellValue: { flexShrink: 1, ...rnType.body, color: tk.text.primary, textAlign: 'right' },
    cellMono: { fontVariant: ['tabular-nums'] },
    cellBadge: { flexShrink: 1, fontSize: rnType.body.size, fontWeight: '600', textAlign: 'right' },
    moreBtn: {
      alignItems: 'center',
      justifyContent: 'center',
      height: 36,
      borderRadius: rnRadius.md,
      backgroundColor: tk.surface.muted,
      borderWidth: 1,
      borderColor: tk.border.light,
    },
    moreBtnText: { fontSize: rnType.body.size, color: tk.text.primary },
    btnPressed: { opacity: 0.8 },
  })
}
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
