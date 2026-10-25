// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

import { rnRadius, rnSpacing, rnType } from '@ihui/design-tokens'

import { useMemo } from 'react'
import { RefreshControl, ScrollView, StyleSheet, Text, View } from 'react-native'
import type { AppThemeTokens } from '../../theme/tokens'
import type { TFunction } from '../../types'
import {
  EmptyState,
  ErrorState,
  PressableCard,
  ScreenSkeleton,
} from '../../components/ScreenStates'

/** 工作流运行状态(对齐 @ihui/api-client AutomationStatus;徽章配色由共享层按状态计算) */
export type WorkflowStatus = 'active' | 'paused'

/** 工作流列表项(平台注入;展示文本[状态标签/调度/时间/结果摘要]均由平台算好传入) */
export interface WorkflowItem {
  /** 自动化 id(作为 key 与 onOpen 入参) */
  id: string
  name: string
  /** 仅用于决定徽章配色,文案见 statusText */
  status: WorkflowStatus
  /** 状态标签文本(平台经 t 翻译) */
  statusText: string
  /** 调度方式文本(平台经 t 翻译) */
  scheduleText: string
  /** 已格式化的下次运行时间文本(空值为 "—") */
  nextRunText: string
  /** 上次运行结果摘要;空串表示暂无结果 */
  lastResultText: string
}

/** WorkflowsScreen props(注入式:wrapper 保留 API 调用 + 导航 + 主题) */
export interface WorkflowsScreenProps {
  t: TFunction
  tk: AppThemeTokens
  items: WorkflowItem[]
  loading: boolean
  refreshing?: boolean
  error: string
  /** 点击列表项进入详情(平台侧导航) */
  onOpen: (id: string) => void
  /** 下拉刷新 / 重试回调(平台侧重载);缺省则不渲染重试按钮 */
  onRefresh?: () => void
}

/**
 * 只读「工作流」列表共享屏 — props 注入式跨端组件
 *
 * 平台无关:负责渲染加载/错误/空态 + 工作流入口卡列表(名称 + 状态徽章 + 调度方式 +
 * 下次运行时间 + 上次结果摘要)+ 下拉刷新。平台特定(API/导航/主题/文案格式化)由 wrapper 注入。
 */
export function WorkflowsScreen({
  t,
  tk,
  items,
  loading,
  refreshing = false,
  error,
  onOpen,
  onRefresh,
}: WorkflowsScreenProps) {
  const styles = useMemo(() => createStyles(tk), [tk])

  if (loading && items.length === 0) {
    return <ScreenSkeleton variant="list" count={4} />
  }

  if (error) {
    return <ErrorState message={error} onRetry={onRefresh} retryLabel={t('common.retry')} />
  }

  if (items.length === 0) {
    return (
      <EmptyState
        title={t('workflows.empty')}
        actionLabel={onRefresh ? t('common.retry') : undefined}
        onAction={onRefresh}
      />
    )
  }

  return (
    <ScrollView
      style={styles.container}
      contentContainerStyle={styles.listBody}
      refreshControl={
        onRefresh ? <RefreshControl refreshing={refreshing} onRefresh={onRefresh} /> : undefined
      }
    >
      {items.map((item) => (
        <PressableCard key={item.id} style={styles.card} onPress={() => onOpen(item.id)}>
          <View style={styles.cardHeaderRow}>
            <Text style={styles.cardTitle} numberOfLines={1}>
              {item.name}
            </Text>
            <View
              style={[
                styles.statusTag,
                item.status === 'active' ? styles.statusTagActive : styles.statusTagPaused,
              ]}
            >
              <Text style={styles.statusTagText}>{item.statusText}</Text>
            </View>
          </View>
          <Text style={styles.meta}>{item.scheduleText}</Text>
          <Text style={styles.meta}>
            {t('automations.nextRun')}: {item.nextRunText}
          </Text>
          <Text numberOfLines={2} style={item.lastResultText ? styles.lastResult : styles.muted}>
            {item.lastResultText
              ? `${t('automations.lastRun')}: ${item.lastResultText}`
              : t('automations.noResult')}
          </Text>
        </PressableCard>
      ))}
    </ScrollView>
  )
}

function createStyles(tk: AppThemeTokens) {
  return StyleSheet.create({
    container: { flex: 1, backgroundColor: tk.surface.bg },
    listBody: { padding: rnSpacing.lg, paddingBottom: rnSpacing['2xl'], gap: rnSpacing.md },
    muted: { fontSize: rnType.body.size, color: tk.text.secondary },
    card: {
      padding: rnSpacing.md,
      borderRadius: rnRadius.lg,
      borderWidth: 1,
      borderColor: tk.border.light,
      backgroundColor: tk.surface.light,
      gap: 6,
    },
    cardHeaderRow: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      gap: rnSpacing.sm,
    },
    cardTitle: { flex: 1, fontSize: rnType.title.size, fontWeight: '600', color: tk.text.primary },
    statusTag: { paddingHorizontal: rnSpacing.sm, paddingVertical: 2, borderRadius: rnRadius.md },
    statusTagActive: { backgroundColor: tk.success.light },
    statusTagPaused: { backgroundColor: tk.surface.muted },
    statusTagText: { fontSize: rnType.label.size, color: tk.text.primary },
    meta: { fontSize: rnType.label.size, color: tk.text.secondary },
    lastResult: { fontSize: rnType.label.size, color: tk.text.tertiary },
  })
}
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
