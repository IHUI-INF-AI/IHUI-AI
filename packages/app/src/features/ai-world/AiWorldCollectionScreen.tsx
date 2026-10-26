// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

import { useMemo } from 'react'
import { Clock, Star } from 'lucide-react-native'
import {
  FlatList,
  Image,
  RefreshControl,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
  type TextStyle,
  type ViewStyle,
} from 'react-native'
import { rnRadius, rnSpacing, rnType } from '@ihui/design-tokens'
import type { AppThemeTokens } from '../../theme/tokens'
import { getTokens } from '../../theme/tokens'
import type { TFunction } from '../../types'
import { BackChevron } from '../../components/BackChevron'
import { EmptyState, ErrorState, ScreenSkeleton } from '../../components/ScreenStates'

/** 收藏/历史列表行 — 由 wrapper 从 GET /api/ai-world/{favorites|history} 的 list 行映射 */
export interface AiWorldCollectionRow {
  id: string
  title: string
  coverImage: string | null
  viewCount: number
  /** ISO 时间串;收藏页传 createdAt,历史页传 updatedAt(与 web 两页取数口径一致) */
  date: string
}

export interface AiWorldCollectionScreenProps {
  t: TFunction
  colorScheme?: 'light' | 'dark'
  onBack: () => void
  /** 视觉变体:favorites=星标,history=时钟(文案由 wrapper 经 t() 传入,两页命名空间不同) */
  variant: 'favorites' | 'history'
  title: string
  subtitle: string
  emptyText: string
  /** 未登录门:非空时不取数,展示登录引导(web AuthGatePrompt 同口径) */
  loginRequiredText: string
  loginLabel: string
  onLogin: () => void
  loading: boolean
  refreshing: boolean
  error: string
  onRetry: () => void
  items: AiWorldCollectionRow[]
  onPressItem: (id: string) => void
  onRefresh: () => void
}

function formatDate(iso: string): string {
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return '-'
  const pad = (n: number) => String(n).padStart(2, '0')
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`
}

/**
 * AiWorldCollectionScreen AI 世界收藏/历史列表(共享层,单组件双变体)
 *
 * 2026-10-26 Wave2 补屏立,承载 web `/ai-world/favorites` 与 `/ai-world/history`
 * (apps/web/app/(main)/ai-world/{favorites,history}/page.tsx)。两页结构同构
 * (标题+副标题→登录门/加载/错误/空态→条目列表),仅端点、文案与图标不同,
 * 故收口为一个共享组件由 variant 分派,避免域内重复实现。
 * 取数、登录态、导航与文案(t())全部由 wrapper 注入。
 */
export function AiWorldCollectionScreen({
  t,
  colorScheme = 'light',
  onBack,
  variant,
  title,
  subtitle,
  emptyText,
  loginRequiredText,
  loginLabel,
  onLogin,
  loading,
  refreshing,
  error,
  onRetry,
  items,
  onPressItem,
  onRefresh,
}: AiWorldCollectionScreenProps) {
  const tk = getTokens(colorScheme)
  const styles = useMemo(() => createAiWorldCollectionStyles(tk), [tk])

  const header = (
    <View style={styles.header}>
      <BackChevron onPress={onBack} label={t('common.back')} colorScheme={colorScheme} />
      <Text style={styles.headerTitle}>{title}</Text>
    </View>
  )

  if (loginRequiredText) {
    return (
      <View style={styles.container}>
        {header}
        <EmptyState
          glyph={variant === 'favorites' ? '★' : '◷'}
          title={loginRequiredText}
          actionLabel={loginLabel}
          onAction={onLogin}
          colorScheme={colorScheme}
        />
      </View>
    )
  }

  if (loading) {
    return (
      <View style={styles.container}>
        {header}
        <ScreenSkeleton variant="card" count={4} colorScheme={colorScheme} />
      </View>
    )
  }

  if (error) {
    return (
      <View style={styles.container}>
        {header}
        <ErrorState
          message={error}
          onRetry={onRetry}
          retryLabel={t('common.retry')}
          colorScheme={colorScheme}
        />
      </View>
    )
  }

  const Icon = variant === 'favorites' ? Star : Clock

  return (
    <View style={styles.container}>
      {header}
      <FlatList
        data={items}
        keyExtractor={(item) => item.id}
        contentContainerStyle={styles.listContent}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={onRefresh}
            tintColor={colorScheme === 'dark' ? tk.text.tertiary : tk.text.secondary}
          />
        }
        ListHeaderComponent={
          <View style={styles.hero}>
            <View style={styles.heroTitleRow}>
              <Icon size={22} color={tk.brand.DEFAULT} strokeWidth={2} />
              <Text style={styles.heroTitle}>{title}</Text>
            </View>
            <Text style={styles.heroSubtitle}>{subtitle}</Text>
          </View>
        }
        ListEmptyComponent={
          <EmptyState
            glyph={variant === 'favorites' ? '★' : '◷'}
            title={emptyText}
            colorScheme={colorScheme}
          />
        }
        renderItem={({ item }) => (
          <TouchableOpacity
            style={styles.rowCard}
            activeOpacity={0.7}
            accessibilityRole="button"
            onPress={() => onPressItem(item.id)}
          >
            {item.coverImage ? (
              <Image source={{ uri: item.coverImage }} style={styles.rowCover} />
            ) : (
              <View style={styles.rowCoverFallback}>
                <Icon size={18} color={tk.text.tertiary} strokeWidth={2} />
              </View>
            )}
            <View style={styles.rowBody}>
              <Text style={styles.rowTitle} numberOfLines={2}>
                {item.title}
              </Text>
              <View style={styles.rowMeta}>
                <Text style={styles.rowMetaText}>
                  {item.viewCount} {t('aiWorld.viewCount')}
                </Text>
                <Text style={styles.rowMetaText}>{formatDate(item.date)}</Text>
              </View>
            </View>
          </TouchableOpacity>
        )}
      />
    </View>
  )
}

function createAiWorldCollectionStyles(tk: AppThemeTokens) {
  return StyleSheet.create({
    container: { flex: 1, backgroundColor: tk.surface.bg },
    header: {
      flexDirection: 'row',
      alignItems: 'center',
      paddingHorizontal: 10,
      paddingVertical: 12,
      gap: 12,
    },
    headerTitle: { fontSize: 18, fontWeight: '700', color: tk.text.primary, flexShrink: 1 },
    listContent: { padding: rnSpacing.lg, paddingBottom: 32, gap: rnSpacing.sm },
    hero: { gap: 4, paddingBottom: rnSpacing.md },
    heroTitleRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
    heroTitle: { fontSize: 22, fontWeight: '700', color: tk.text.primary },
    heroSubtitle: { fontSize: 12, color: tk.text.secondary },
    rowCard: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: rnSpacing.md,
      borderRadius: rnRadius.lg,
      borderWidth: 1,
      borderColor: tk.border.light,
      backgroundColor: tk.surface.card,
      padding: rnSpacing.md,
      marginBottom: rnSpacing.sm,
    },
    rowCover: {
      width: 48,
      height: 48,
      borderRadius: rnRadius.md,
      backgroundColor: tk.surface.muted,
    },
    rowCoverFallback: {
      width: 48,
      height: 48,
      borderRadius: rnRadius.md,
      alignItems: 'center',
      justifyContent: 'center',
      backgroundColor: tk.surface.muted,
    },
    rowBody: { flex: 1, gap: 4 },
    rowTitle: { fontSize: rnType.body.size, fontWeight: '500', color: tk.text.primary },
    rowMeta: { flexDirection: 'row', alignItems: 'center', gap: rnSpacing.md },
    rowMetaText: { fontSize: rnType.label.size, color: tk.text.tertiary },
  } satisfies Record<string, ViewStyle | TextStyle>)
}
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
