// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

import { useMemo, type ReactNode } from 'react'
import { RefreshControl, ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native'
import { rnRadius } from '@ihui/design-tokens'
import { darkTokens, type AppThemeTokens } from '../../theme/tokens'
import type { TFunction } from '../../types'
import { EmptyState, ScreenSkeleton } from '../../components/ScreenStates'

/** 指标项:label/value 均为端内已求值文本(t()、数字/日期格式化在平台侧完成后传入,共享层不做本地化) */
export interface DashboardMetricItem {
  /** 稳定 id(onOpen 回调与 key 用) */
  id: string
  /** 分区标题(端内已 t() 求值的文本;按首次出现顺序分组) */
  group: string
  label: string
  value: string
  /** 可选副说明文本(端内已格式化) */
  hint?: string
}

/** DashboardScreen props(注入式:wrapper 保留 API 聚合/主题/空态与加载态组件) */
export interface DashboardScreenProps {
  t: TFunction
  tk: AppThemeTokens
  items: DashboardMetricItem[]
  loading: boolean
  refreshing: boolean
  error: string
  onRefresh: () => void
  /** 点击指标卡回调(平台注入;未提供时卡片不可点) */
  onOpen?: (id: string) => void
  /** 端内专属加载态组件(如 mobile-rn 的 Loading)注入点 */
  renderLoading?: () => ReactNode
  /** 端内专属空态组件(如 mobile-rn 的 Empty)注入点;仅当 items 为空且非 loading 时调用 */
  renderEmpty?: () => ReactNode
}

interface DashboardMetricGroup {
  title: string
  items: DashboardMetricItem[]
}

/** 按 group 标题首现顺序分组(保持端内传入的分区次序) */
function groupItems(items: DashboardMetricItem[]): DashboardMetricGroup[] {
  const order: string[] = []
  const map = new Map<string, DashboardMetricItem[]>()
  for (const item of items) {
    const bucket = map.get(item.group)
    if (bucket) {
      bucket.push(item)
    } else {
      map.set(item.group, [item])
      order.push(item.group)
    }
  }
  return order.map((title) => ({ title, items: map.get(title) ?? [] }))
}

/**
 * 数据看板共享屏 — props 注入式跨端组件
 *
 * 平台无关:负责渲染指标卡分区(错误横幅 + 加载/空态兜底 + 下拉刷新)。
 * 平台特定(API 聚合、i18n/数字/日期格式化、端内 Empty/Loading 组件、点击跳转)由 wrapper 注入。
 */
export function DashboardScreen({
  t,
  tk,
  items,
  loading,
  refreshing,
  error,
  onRefresh,
  onOpen,
  renderLoading,
  renderEmpty,
}: DashboardScreenProps) {
  const styles = useMemo(() => createStyles(tk), [tk])
  const groups = useMemo(() => groupItems(items), [items])
  /**
   * 状态四件套是主题驱动组件(`colorScheme` 形参默认 'light')。本屏不另建主题来源:
   * 调用方注入的 `tk` 就是它按 `resolvedTheme` 解析出的 token 集,而 `getTokens` 只可能返回
   * `lightTokens` / `darkTokens` 两个单例(identity 契约由 dark-mode.test.tsx 钉住),
   * 故由 `tk` 反推出来的档案与屏幕自身配色必然同档 —— 这正是门 91 要的不"同屏两套档案"。
   */
  const colorScheme: 'light' | 'dark' = tk === darkTokens ? 'dark' : 'light'

  if (loading && items.length === 0) {
    if (renderLoading) return <>{renderLoading()}</>
    return <ScreenSkeleton variant="grid" count={4} colorScheme={colorScheme} />
  }

  const isEmpty = items.length === 0

  return (
    <ScrollView
      style={styles.container}
      contentContainerStyle={styles.content}
      refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
    >
      {error ? (
        <View style={styles.errorWrap}>
          <Text style={styles.errorText}>{error}</Text>
          <TouchableOpacity style={styles.retryBtn} onPress={onRefresh}>
            <Text style={styles.retryBtnText}>{t('common.retry')}</Text>
          </TouchableOpacity>
        </View>
      ) : null}

      {isEmpty ? (
        renderEmpty ? (
          renderEmpty()
        ) : (
          <EmptyState title={t('common.empty')} colorScheme={colorScheme} />
        )
      ) : (
        groups.map((group) => (
          <View key={group.title} style={styles.section}>
            <Text style={styles.sectionTitle}>{group.title}</Text>
            <View style={styles.sectionGrid}>
              {group.items.map((metric) => {
                const card = (
                  <View style={styles.card}>
                    <Text style={styles.cardLabel}>{metric.label}</Text>
                    <Text style={styles.cardValue} numberOfLines={1}>
                      {metric.value}
                    </Text>
                    {metric.hint ? <Text style={styles.cardHint}>{metric.hint}</Text> : null}
                  </View>
                )
                return onOpen ? (
                  <TouchableOpacity
                    key={metric.id}
                    style={styles.cell}
                    activeOpacity={0.7}
                    onPress={() => onOpen(metric.id)}
                  >
                    {card}
                  </TouchableOpacity>
                ) : (
                  <View key={metric.id} style={styles.cell}>
                    {card}
                  </View>
                )
              })}
            </View>
          </View>
        ))
      )}
    </ScrollView>
  )
}

function createStyles(tk: AppThemeTokens) {
  return StyleSheet.create({
    container: { flex: 1, backgroundColor: tk.surface.bg },
    content: { padding: 16, paddingBottom: 24, gap: 16 },
    errorWrap: { gap: 8 },
    errorText: { fontSize: 14, color: tk.danger.DEFAULT },
    retryBtn: {
      alignSelf: 'flex-start',
      paddingVertical: 6,
      paddingHorizontal: 12,
      borderRadius: rnRadius.sm,
      borderWidth: 1,
      borderColor: tk.border.medium,
    },
    retryBtnText: { fontSize: 14, color: tk.text.primary },
    section: {},
    sectionTitle: { fontSize: 14, fontWeight: '600', color: tk.text.primary, marginBottom: 8 },
    sectionGrid: {
      flexDirection: 'row',
      flexWrap: 'wrap',
      justifyContent: 'space-between',
      gap: 10,
    },
    cell: { flexBasis: '48%' },
    card: {
      flexGrow: 1,
      padding: 12,
      borderRadius: rnRadius.lg,
      borderWidth: 1,
      borderColor: tk.border.light,
      backgroundColor: tk.surface.light,
    },
    cardLabel: { fontSize: 12, color: tk.text.secondary },
    cardValue: { marginTop: 4, fontSize: 22, fontWeight: '600', color: tk.text.primary },
    cardHint: { marginTop: 4, fontSize: 12, color: tk.text.secondary },
  })
}
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
