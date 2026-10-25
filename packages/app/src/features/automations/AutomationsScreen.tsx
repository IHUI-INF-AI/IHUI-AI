// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

import { useMemo } from 'react'
import type { ReactNode } from 'react'
import {
  ActivityIndicator,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native'
import { rnRadius, type RnThemeTokens, rnSpacing, rnType } from '@ihui/design-tokens'
import type { TFunction } from '@ihui/types'

/** 自动化调度类型(字段对齐 @ihui/api-client AutomationScheduleType) */
export type AutomationScheduleType = 'once' | 'recurring'

/** 自动化项(平台预映射:日期/状态文案均由 wrapper 算好传入,共享层不做 toLocaleString) */
export interface AutomationItem {
  id: string
  name: string
  /** 是否启用中(决定徽章颜色档);状态/调度方式文案均由平台注入已翻译 */
  active: boolean
  statusText: string
  scheduleType: AutomationScheduleType
  scheduleText: string
  rrule: string | null
  /** 一次性调度时间文本(平台已格式化;null = 不展示该行) */
  scheduledAtText: string | null
  timezoneText: string
  /** 最近/下次运行时间文本(平台已格式化) */
  lastRunText: string
  nextRunText: string
  prompt: string
  lastResultSummary: string | null
}

/** AutomationsScreen props(注入式:wrapper 保留 API/导航/主题与 RN 专属空态组件) */
export interface AutomationsScreenProps {
  t: TFunction
  tk: RnThemeTokens
  /** 列表形态数据(detail 为空时渲染);详情形态数据(带 id 进入时非空) */
  items: AutomationItem[]
  detail: AutomationItem | null
  loading: boolean
  refreshing: boolean
  error: string
  onRefresh: () => void
  /** 列表卡片点击下钻(平台注入导航) */
  onOpen: (id: string) => void
  /** 平台加载态/空态/错误态组件注入(如 mobile-rn Loading、Empty);缺省用共享层内联形态 */
  renderLoading?: (text: string) => ReactNode
  renderEmpty?: (options: { text: string; actionText: string; onAction: () => void }) => ReactNode
  /** 列表卡片尾部追加内容(平台专属块) */
  cardExtra?: (item: AutomationItem) => ReactNode
}

/**
 * 只读「自动化」共享屏(原 mobile-rn AutomationsScreen 的纯 UI 层,props 注入式跨端组件)。
 * detail 非空 → 单条详情卡,否则 → 列表卡片(可下钻);加载/刷新/错误/空态与展示块平台无关,平台特定(API/导航/主题/RN 组件)由 wrapper 注入。
 */
export function AutomationsScreen({
  t,
  tk,
  items,
  detail,
  loading,
  refreshing,
  error,
  onRefresh,
  onOpen,
  renderLoading,
  renderEmpty,
  cardExtra,
}: AutomationsScreenProps) {
  const styles = useMemo(() => createStyles(tk), [tk])

  const titleRow = (item: AutomationItem) => (
    <View style={styles.cardHeaderRow}>
      <Text style={styles.cardTitle} numberOfLines={1}>
        {item.name}
      </Text>
      <View style={[styles.badge, item.active ? styles.badgeActive : styles.badgePaused]}>
        <Text style={styles.badgeText}>{item.statusText}</Text>
      </View>
    </View>
  )

  const rowOf = (label: string, value: string) => (
    <View style={styles.row}>
      <Text style={styles.rowLabel}>{label}</Text>
      <Text style={styles.rowValue}>{value}</Text>
    </View>
  )

  const miniRow = (label: string, value: string) => (
    <View style={styles.miniRow}>
      <Text style={styles.miniLabel}>{label}</Text>
      <Text style={styles.miniValue}>{value}</Text>
    </View>
  )
  const notice = (text: string) =>
    renderEmpty ? (
      renderEmpty({ text, actionText: t('common.retry'), onAction: onRefresh })
    ) : (
      <View style={styles.stateWrap}>
        <Text style={styles.errorText}>{text}</Text>
        <TouchableOpacity style={styles.outlineBtn} onPress={onRefresh}>
          <Text style={styles.outlineBtnText}>{t('common.retry')}</Text>
        </TouchableOpacity>
      </View>
    )

  if (loading) {
    return (
      renderLoading?.(t('common.loading')) ?? (
        <View style={styles.stateWrap}>
          <ActivityIndicator color={tk.brand.DEFAULT} />
          <Text style={styles.stateText}>{t('common.loading')}</Text>
        </View>
      )
    )
  }
  if (error) return notice(error)

  const refreshControl = <RefreshControl refreshing={refreshing} onRefresh={onRefresh} />

  if (detail) {
    return (
      <ScrollView
        style={styles.screen}
        contentContainerStyle={styles.body}
        refreshControl={refreshControl}
      >
        <View style={styles.card}>
          {titleRow(detail)}
          {rowOf(t('automations.schedule'), detail.scheduleText)}
          {detail.scheduleType === 'recurring' && detail.rrule
            ? rowOf(t('automations.rrule'), detail.rrule)
            : null}
          {detail.scheduleType === 'once' && detail.scheduledAtText
            ? rowOf(t('automations.nextRun'), detail.scheduledAtText)
            : null}
          {rowOf(t('automations.timezone'), detail.timezoneText)}
          {rowOf(t('automations.lastRun'), detail.lastRunText)}
          {rowOf(t('automations.nextRun'), detail.nextRunText)}
          <View style={styles.block}>
            <Text style={styles.blockLabel}>{t('automations.prompt')}</Text>
            <Text style={styles.blockValue}>{detail.prompt}</Text>
          </View>
          {detail.lastResultSummary ? (
            <View style={styles.block}>
              <Text style={styles.blockLabel}>{t('automations.lastRun')}</Text>
              <Text style={styles.blockValue}>{detail.lastResultSummary}</Text>
            </View>
          ) : null}
        </View>
      </ScrollView>
    )
  }

  if (items.length === 0) return notice(t('automations.empty'))

  return (
    <ScrollView
      style={styles.screen}
      contentContainerStyle={styles.body}
      refreshControl={refreshControl}
    >
      {items.map((item) => (
        <TouchableOpacity
          key={item.id}
          style={styles.card}
          onPress={() => onOpen(item.id)}
          accessibilityRole="button"
          accessibilityLabel={item.name}
        >
          {titleRow(item)}
          {miniRow(`${t('automations.schedule')}:`, item.scheduleText)}
          {miniRow(`${t('automations.nextRun')}:`, item.nextRunText)}
          <Text style={styles.summary} numberOfLines={2}>
            {item.lastResultSummary
              ? `${t('automations.lastRun')}: ${item.lastResultSummary}`
              : t('automations.noResult')}
          </Text>
          {cardExtra?.(item)}
        </TouchableOpacity>
      ))}
    </ScrollView>
  )
}

function createStyles(tk: RnThemeTokens) {
  return StyleSheet.create({
    screen: {
      flex: 1,
      backgroundColor: tk.surface.bg,
      paddingHorizontal: rnSpacing.lg,
      paddingTop: rnSpacing.lg,
    },
    body: { gap: rnSpacing.md, paddingBottom: rnSpacing['2xl'] },
    card: {
      padding: rnSpacing.md,
      borderRadius: rnRadius.lg,
      borderWidth: 1,
      borderColor: tk.border.light,
      backgroundColor: tk.surface.light,
    },
    cardHeaderRow: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      marginBottom: rnSpacing.sm,
    },
    cardTitle: { flex: 1, fontSize: rnType.title.size, fontWeight: '600', color: tk.text.primary },
    badge: {
      paddingHorizontal: rnSpacing.sm,
      paddingVertical: 2,
      borderRadius: rnRadius.md,
      marginLeft: rnSpacing.sm,
    },
    badgeActive: { backgroundColor: tk.success.light },
    badgePaused: { backgroundColor: tk.surface.muted },
    badgeText: { fontSize: rnType.label.size, color: tk.text.primary },
    row: {
      flexDirection: 'row',
      alignItems: 'flex-start',
      gap: rnSpacing.sm,
      marginBottom: rnSpacing.sm,
    },
    rowLabel: { width: 80, fontSize: rnType.label.size, color: tk.text.secondary },
    rowValue: { flex: 1, fontSize: rnType.label.size, color: tk.text.primary },
    miniRow: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: rnSpacing.sm,
      marginBottom: rnSpacing.xs,
    },
    miniLabel: { fontSize: rnType.label.size, color: tk.text.secondary },
    miniValue: { fontSize: rnType.label.size, color: tk.text.primary },
    block: { marginTop: rnSpacing.sm },
    blockLabel: {
      marginBottom: rnSpacing.xs,
      fontSize: rnType.label.size,
      color: tk.text.secondary,
    },
    blockValue: { fontSize: rnType.body.size, color: tk.text.primary },
    summary: { fontSize: rnType.label.size, color: tk.text.secondary },
    stateWrap: {
      alignItems: 'center',
      justifyContent: 'center',
      paddingVertical: rnSpacing['5xl'],
      paddingHorizontal: rnSpacing['2xl'],
      gap: rnSpacing.md,
    },
    stateText: { fontSize: rnType.body.size, color: tk.text.secondary },
    errorText: { fontSize: rnType.body.size, color: tk.danger.DEFAULT },
    outlineBtn: {
      paddingHorizontal: rnSpacing.lg,
      paddingVertical: rnSpacing.sm,
      borderRadius: rnRadius.sm,
      borderWidth: 1,
      borderColor: tk.border.medium,
      alignItems: 'center',
    },
    outlineBtnText: { fontSize: rnType.body.size, color: tk.text.primary },
  })
}
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
