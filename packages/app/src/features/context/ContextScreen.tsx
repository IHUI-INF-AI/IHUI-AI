// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
import { rnRadius } from '@ihui/design-tokens'

import { useMemo } from 'react'
import {
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
  type TextStyle,
  type ViewStyle,
} from 'react-native'
import type { TFunction } from '@ihui/types'
import { getTokens, type AppThemeTokens } from '../../theme/tokens'
import { BackChevron } from '../../components/BackChevron'

/**
 * 压缩事件(结构对齐 @ihui/api-client ContextCompressionEvent)。
 */
export interface ContextCompressionEventData {
  timestamp: number
  conversation_id: string
  tokens_before: number
  tokens_after: number
  compression_ratio: number
  quality_score: number
  removed_count: number
}

/**
 * 压缩统计(结构对齐 @ihui/api-client ContextCompressionStats)。
 */
export interface ContextCompressionStatsData {
  totalEvents: number
  avgCompressionRatio: number
  avgQualityScore: number
  recentEvents: ContextCompressionEventData[]
}

/**
 * 提及条目(结构对齐 @ihui/api-client ContextMention)。
 */
export interface ContextMentionItem {
  id: string
  type: string
  label: string
  detail?: string
  insertText: string
}

/**
 * ContextScreen 上下文引擎概览(共享层)props 契约。
 * 平台无关:getContextCompressionStats / searchContextMentions 数据流、防抖、Alert、导航由 wrapper 注入。
 */
export interface ContextScreenProps {
  t: TFunction
  /** 压缩统计(加载失败为 null,非 loading 时不渲染统计区) */
  stats: ContextCompressionStatsData | null
  /** 统计加载中 */
  loading: boolean
  /** 提及检索中 */
  searching: boolean
  /** 检索关键词(受控值,400ms 防抖由 wrapper 处理) */
  query: string
  /** 关键词变更 */
  onQueryChange: (value: string) => void
  /** 提及检索结果 */
  mentions: ContextMentionItem[]
  /** 统计刷新(顶部重试按钮) */
  onRetry: () => void
  /** 顶部返回 */
  onBack: () => void
  colorScheme?: 'light' | 'dark'
}

/** 比例值转百分比整数文案(0.86 → 86%) */
function pct(value: number): string {
  return `${Math.round(value * 100)}%`
}

/**
 * ContextScreen 上下文引擎概览(共享层)
 *
 * 2026-09-15 承接 mobile-rn ContextScreen 1:1 迁移(web /context 只读能力的移动端原生入口):
 * - 结构:顶部导航行(返回/标题/重试)→ 统计三卡(总事件/平均压缩比/平均质量)
 *   → 最近压缩事件列表(会话 id/时间/tokens 区间)→ 提及检索(输入框 + 结果卡)
 * - 平台无关:API、防抖检索、Alert、导航由 wrapper 注入
 * - 样式:getTokens(colorScheme) 语义 token(零 hex),对齐原屏 tailwind 间距(dp)
 * - i18n:沿用 context. 与 common.(mobile-rn i18n 既有 key)
 */
export function ContextScreen({
  t,
  stats,
  loading,
  searching,
  query,
  onQueryChange,
  mentions,
  onRetry,
  onBack,
  colorScheme = 'light',
}: ContextScreenProps) {
  const tk = getTokens(colorScheme)
  const styles = useMemo(() => createStyles(tk), [tk])

  const statCards = stats
    ? [
        { label: t('context.totalEvents'), value: String(stats.totalEvents) },
        { label: t('context.avgRatio'), value: pct(stats.avgCompressionRatio) },
        { label: t('context.avgQuality'), value: pct(stats.avgQualityScore) },
      ]
    : []

  return (
    <View style={styles.container}>
      {/* 顶部导航行:返回 / 标题 / 重试(重新拉取统计) */}
      <View style={styles.headerBar}>
        <BackChevron onPress={onBack} label={t('common.back')} colorScheme={colorScheme} />
        <Text style={styles.titleText}>{t('context.title')}</Text>
        <TouchableOpacity onPress={onRetry} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
          <Text style={styles.retryText}>{t('common.retry')}</Text>
        </TouchableOpacity>
      </View>

      <ScrollView contentContainerStyle={styles.scroll} keyboardShouldPersistTaps="handled">
        {loading ? (
          <Text style={styles.loadingText}>{t('common.loading')}</Text>
        ) : stats ? (
          <>
            {/* 统计卡片 */}
            <View style={styles.statRow}>
              {statCards.map((item) => (
                <View key={item.label} style={styles.statCard}>
                  <Text style={styles.statValue}>{item.value}</Text>
                  <Text style={styles.statLabel}>{item.label}</Text>
                </View>
              ))}
            </View>

            {/* 最近压缩事件 */}
            {stats.recentEvents.length > 0 ? (
              <View style={styles.section}>
                <Text style={styles.sectionLabel}>{t('context.recentEvents')}</Text>
                <View style={styles.eventList}>
                  {stats.recentEvents.slice(0, 10).map((ev, idx) => (
                    <View key={`${ev.conversation_id}-${idx}`} style={styles.eventCard}>
                      <View style={styles.eventHead}>
                        <Text style={styles.eventId} numberOfLines={1}>
                          {ev.conversation_id}
                        </Text>
                        <Text style={styles.eventTime}>
                          {new Date(ev.timestamp).toLocaleString()}
                        </Text>
                      </View>
                      <Text style={styles.eventMeta}>
                        {t('context.tokensRange', {
                          before: ev.tokens_before.toLocaleString(),
                          after: ev.tokens_after.toLocaleString(),
                          ratio: pct(ev.compression_ratio),
                          quality: pct(ev.quality_score),
                        })}
                      </Text>
                    </View>
                  ))}
                </View>
              </View>
            ) : null}
          </>
        ) : null}

        {/* 提及检索 */}
        <View style={styles.section}>
          <Text style={styles.sectionLabel}>{t('context.mentionsSearch')}</Text>
          <TextInput
            value={query}
            onChangeText={onQueryChange}
            placeholder={t('context.mentionsPlaceholder')}
            placeholderTextColor={tk.text.tertiary}
            style={styles.searchInput}
          />
          {searching ? (
            <Text style={styles.hintText}>{t('common.loading')}</Text>
          ) : mentions.length === 0 ? (
            <Text style={styles.hintText}>{t('context.empty')}</Text>
          ) : (
            <View style={styles.mentionList}>
              {mentions.map((m) => (
                <View key={m.id} style={styles.mentionCard}>
                  <View style={styles.mentionHead}>
                    <View style={styles.typeBadge}>
                      <Text style={styles.typeBadgeText}>{m.type}</Text>
                    </View>
                    <Text style={styles.mentionLabel} numberOfLines={1}>
                      {m.label}
                    </Text>
                  </View>
                  {m.detail ? (
                    <Text style={styles.mentionDetail} numberOfLines={1}>
                      {m.detail}
                    </Text>
                  ) : null}
                </View>
              ))}
            </View>
          )}
        </View>
      </ScrollView>
    </View>
  )
}

/**
 * 样式:对齐原 RN nativewind 布局(p-4/gap-2/mt-4/text-[10px] 等),
 * 全部颜色走 AppThemeTokens 语义 token,零 hex(提及类型徽章走 warning 语义变体)。
 */
function createStyles(tk: AppThemeTokens) {
  return StyleSheet.create({
    container: {
      flex: 1,
      backgroundColor: tk.surface.bg,
    },
    /* 顶部导航行 */
    headerBar: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      paddingHorizontal: 16,
      paddingTop: 12,
      paddingBottom: 8,
    },
    titleText: {
      fontSize: 16,
      fontWeight: '500',
      color: tk.text.primary,
    },
    retryText: {
      fontSize: 14,
      fontWeight: '500',
      color: tk.brandAccent.deep,
    },
    /* 内容区 */
    scroll: {
      paddingBottom: 16,
      paddingHorizontal: 16,
      paddingTop: 16,
    },
    loadingText: {
      marginTop: 32,
      fontSize: 14,
      textAlign: 'center',
      color: tk.text.tertiary,
    },
    /* 统计卡片 */
    statRow: {
      flexDirection: 'row',
      gap: 8,
    },
    statCard: {
      flex: 1,
      borderRadius: rnRadius.lg,
      borderWidth: 1,
      borderColor: tk.border.light,
      padding: 12,
    },
    statValue: {
      fontSize: 18,
      fontWeight: '600',
      color: tk.text.primary,
    },
    statLabel: {
      marginTop: 2,
      fontSize: 10,
      color: tk.text.secondary,
    },
    /* 区块通用 */
    section: {
      marginTop: 16,
    },
    sectionLabel: {
      fontSize: 12,
      fontWeight: '500',
      color: tk.text.secondary,
    },
    hintText: {
      marginTop: 12,
      fontSize: 12,
      textAlign: 'center',
      color: tk.text.tertiary,
    },
    /* 最近压缩事件 */
    eventList: {
      marginTop: 8,
      gap: 8,
    },
    eventCard: {
      borderRadius: rnRadius.md,
      borderWidth: 1,
      borderColor: tk.border.light,
      paddingHorizontal: 12,
      paddingVertical: 8,
    },
    eventHead: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
    },
    eventId: {
      flex: 1,
      fontSize: 12,
      color: tk.text.primary,
    },
    eventTime: {
      marginLeft: 8,
      fontSize: 10,
      color: tk.text.tertiary,
    },
    eventMeta: {
      marginTop: 4,
      fontSize: 10,
      color: tk.text.secondary,
    },
    /* 提及检索 */
    searchInput: {
      marginTop: 8,
      borderRadius: rnRadius.md,
      borderWidth: 1,
      borderColor: tk.border.light,
      paddingHorizontal: 12,
      paddingVertical: 8,
      fontSize: 14,
      color: tk.text.primary,
    },
    mentionList: {
      marginTop: 8,
      gap: 8,
    },
    mentionCard: {
      borderRadius: rnRadius.md,
      borderWidth: 1,
      borderColor: tk.border.light,
      paddingHorizontal: 12,
      paddingVertical: 8,
    },
    mentionHead: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 8,
    },
    typeBadge: {
      borderRadius: rnRadius.sm,
      paddingHorizontal: 6,
      paddingVertical: 2,
      backgroundColor: tk.warning.light,
    },
    typeBadgeText: {
      fontSize: 10,
      color: tk.warning.amberText,
    },
    mentionLabel: {
      flex: 1,
      fontSize: 12,
      fontWeight: '500',
      color: tk.text.primary,
    },
    mentionDetail: {
      marginTop: 4,
      fontSize: 10,
      color: tk.text.tertiary,
    },
  } satisfies Record<string, ViewStyle | TextStyle>)
}
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
