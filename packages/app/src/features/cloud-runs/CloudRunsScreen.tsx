import { useMemo } from 'react'
import {
  ActivityIndicator,
  FlatList,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
  type TextStyle,
} from 'react-native'
import { Clock, Cloud, FileText, Loader2, RefreshCw } from 'lucide-react-native'
import { rnRadius, rnSpacing, rnType } from '@ihui/design-tokens'
import type { TFunction } from '../../types'
import { getTokens, type AppThemeMode, type AppThemeTokens } from '../../theme/tokens'
import { BackChevron } from '../../components/BackChevron'

const NS = 'cloudRuns'

/** 与 web 同值(apps/web/src/components/cloud-runs/CloudRunsView.tsx:35 PAGE_SIZE = 20) */
export const CLOUD_RUNS_PAGE_SIZE = 20

export type CloudRunStatus = 'running' | 'done' | 'error'

const STATUS_TONE: Record<CloudRunStatus, 'running' | 'done' | 'error' | 'neutral'> = {
  running: 'running',
  done: 'done',
  error: 'error',
}

/** 列表行:动态文本(状态/时间/摘要)由薄壳按 web 同 ns 注入,共享屏只管渲染 */
export interface CloudRunRowView {
  runId: string
  /** task 为空时薄壳落 web 同款 noTask 文案 */
  taskText: string
  status: CloudRunStatus
  /** 薄壳按 cloudRuns.running/done/error 取的文案 */
  statusText: string
  /** 薄壳按 web 同值格式化(started_at 原样字符串,web 直出) */
  startedAtText: string
  outputSummary: string
}

/** 详情:web CloudRunsView 详情视图(:98-167)同字段同顺序 */
export interface CloudRunDetailView {
  runId: string
  status: CloudRunStatus
  statusText: string
  /** web :120 `selected.agent_type || 'loop_v2'` 同兜底 */
  agentType: string
  sessionAlias: string
  startTimeText: string
  endTimeText: string
  task: string
  output: string
  error: string
}

export interface CloudRunsScreenProps {
  t: TFunction
  colorScheme: AppThemeMode
  /** 列表视图返回上一级路由 */
  onBack: () => void
  loading: boolean
  error: string | null
  rows: CloudRunRowView[]
  total: number
  page: number
  onRefresh: () => void
  onPrevPage: () => void
  onNextPage: () => void
  onOpenDetail: (runId: string) => void
  /** 详情视图:非空/加载中/出错时进入详情,列表视图不渲染 */
  detail: CloudRunDetailView | null
  detailLoading: boolean
  detailError: string | null
  /** 详情视图返回列表(web useTopBarBack 的 onBack 同语义,CloudRunsView.tsx:82-86) */
  onCloseDetail: () => void
}

/**
 * 云托管 Agent 运行共享屏 —— 承载 web /cloud-agent 与 /cloud-run。
 *
 * 两路由在 web 复用同一实现(apps/web/app/(main)/cloud-agent/page.tsx:10、
 * apps/web/app/(main)/cloud-run/page.tsx:9 均渲染 CloudRunsView),故 RN 侧同样只留
 * 一份共享实现,由两枚薄壳(CloudAgentScreen / CloudRunScreen)分别挂进导航。
 *
 * 取数 / 详情下钻 / 登录与时间格式化全部由薄壳注入(端点见
 * packages/api-client/src/endpoints/cloud-runs.ts),本文件只管渲染与三态。
 * 与 web 的口径差(如实登记):web 详情返回键走顶栏统一收敛(useTopBarBack),
 * RN 在详情视图内渲染页头返回键指向 onCloseDetail;分页在 RN 仍是「上一页/下一页」
 * 按钮(与 web 同款),不改成无限滚动。
 */
export function CloudRunsScreen({
  t,
  colorScheme,
  onBack,
  loading,
  error,
  rows,
  total,
  page,
  onRefresh,
  onPrevPage,
  onNextPage,
  onOpenDetail,
  detail,
  detailLoading,
  detailError,
  onCloseDetail,
}: CloudRunsScreenProps) {
  const tk = getTokens(colorScheme)
  const { styles, dotTone } = useMemo(() => createStyles(tk), [tk])

  if (detailLoading || detail || detailError) {
    return (
      <View style={styles.container}>
        <View style={styles.header}>
          <BackChevron onPress={onCloseDetail} label={t('common.back')} colorScheme={colorScheme} />
          <View style={styles.titleRow}>
            <Cloud size={20} color={tk.brand.DEFAULT} />
            <Text style={styles.title}>{t(`${NS}.detailTitle`)}</Text>
          </View>
        </View>

        {detailLoading ? (
          <View style={styles.centerBlock}>
            <ActivityIndicator size="small" color={tk.brand.DEFAULT} />
            <Text style={styles.muted}>{t(`${NS}.loading`)}</Text>
          </View>
        ) : detailError ? (
          <Text style={styles.error}>{detailError}</Text>
        ) : detail ? (
          <ScrollView style={styles.detailScroll} contentContainerStyle={styles.detailContent}>
            <View style={styles.card}>
              <View style={styles.detailHead}>
                <Text style={styles.cardLabel}>{t(`${NS}.runId`)}</Text>
                <View style={styles.statusInline}>
                  <View style={[styles.dot, dotTone[STATUS_TONE[detail.status]]]} />
                  <Text style={styles.statusText}>{detail.statusText}</Text>
                </View>
              </View>
              <Text style={styles.runIdCode}>{detail.runId}</Text>
              <View style={styles.fieldRow}>
                <Text style={styles.fieldLabel}>{t(`${NS}.agentType`)}</Text>
                <Text style={styles.fieldValue}>{detail.agentType || '-'}</Text>
              </View>
              <View style={styles.fieldRow}>
                <Text style={styles.fieldLabel}>{t(`${NS}.sessionAlias`)}</Text>
                <Text style={styles.fieldValue}>{detail.sessionAlias || '-'}</Text>
              </View>
              <View style={styles.fieldRow}>
                <Text style={styles.fieldLabel}>{t(`${NS}.startTime`)}</Text>
                <Text style={styles.fieldValue}>{detail.startTimeText || '-'}</Text>
              </View>
              <View style={styles.fieldRow}>
                <Text style={styles.fieldLabel}>{t(`${NS}.endTime`)}</Text>
                <Text style={styles.fieldValue}>{detail.endTimeText || '-'}</Text>
              </View>
            </View>

            <View style={styles.card}>
              <View style={styles.cardHead}>
                <FileText size={16} color={tk.text.secondary} />
                <Text style={styles.cardLabel}>{t(`${NS}.task`)}</Text>
              </View>
              <Text style={styles.blockText}>{detail.task || '-'}</Text>
            </View>

            <View style={styles.card}>
              <View style={styles.cardHead}>
                <FileText size={16} color={tk.text.secondary} />
                <Text style={styles.cardLabel}>{t(`${NS}.output`)}</Text>
              </View>
              {detail.output ? (
                <Text style={styles.blockText}>{detail.output}</Text>
              ) : (
                <Text style={styles.muted}>
                  {detail.status === 'running' ? t(`${NS}.runningHint`) : t(`${NS}.noOutput`)}
                </Text>
              )}
              {detail.error ? <Text style={styles.errorInline}>{detail.error}</Text> : null}
            </View>
          </ScrollView>
        ) : null}
      </View>
    )
  }

  const totalPages = total > 0 ? Math.max(1, Math.ceil(total / CLOUD_RUNS_PAGE_SIZE)) : 1

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <BackChevron onPress={onBack} label={t('common.back')} colorScheme={colorScheme} />
        <View style={styles.titleRow}>
          <Cloud size={20} color={tk.brand.DEFAULT} />
          <Text style={styles.title}>{t(`${NS}.title`)}</Text>
        </View>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={t(`${NS}.refresh`)}
          onPress={onRefresh}
          disabled={loading}
          style={[styles.refreshBtn, loading && styles.refreshBtnDisabled]}
        >
          {loading ? (
            <Loader2 size={16} color={tk.text.secondary} />
          ) : (
            <RefreshCw size={16} color={tk.text.secondary} />
          )}
          <Text style={styles.refreshText}>{t(`${NS}.refresh`)}</Text>
        </Pressable>
      </View>

      <Text style={styles.subtitle}>{t(`${NS}.subtitle`)}</Text>

      {error ? <Text style={styles.error}>{error}</Text> : null}

      {loading && rows.length === 0 ? (
        <View style={styles.centerBlock}>
          <ActivityIndicator size="small" color={tk.brand.DEFAULT} />
          <Text style={styles.muted}>{t(`${NS}.loading`)}</Text>
        </View>
      ) : rows.length === 0 ? (
        <View style={styles.centerBlock}>
          <Cloud size={30} color={tk.text.tertiary} />
          <Text style={styles.muted}>{t(`${NS}.empty`)}</Text>
        </View>
      ) : (
        <FlatList
          data={rows}
          keyExtractor={(item) => item.runId}
          style={styles.list}
          contentContainerStyle={styles.listContent}
          renderItem={({ item }) => (
            <Pressable
              accessibilityRole="button"
              onPress={() => onOpenDetail(item.runId)}
              style={styles.row}
            >
              <View style={styles.rowHead}>
                <Text style={styles.runIdChip} numberOfLines={1}>
                  {item.runId.slice(0, 18)}
                </Text>
                <View style={styles.statusInline}>
                  <View style={[styles.dot, dotTone[STATUS_TONE[item.status]]]} />
                  <Text style={styles.statusText}>{item.statusText}</Text>
                </View>
              </View>
              <Text style={styles.taskText} numberOfLines={2}>
                {item.taskText}
              </Text>
              <View style={styles.rowFoot}>
                <Clock size={12} color={tk.text.secondary} />
                <Text style={styles.rowMeta}>{item.startedAtText || '-'}</Text>
                {item.outputSummary ? (
                  <Text style={styles.rowMeta} numberOfLines={1}>
                    {item.outputSummary}
                  </Text>
                ) : null}
              </View>
            </Pressable>
          )}
          ListFooterComponent={
            totalPages > 1 ? (
              <View style={styles.pager}>
                <Pressable
                  accessibilityRole="button"
                  onPress={onPrevPage}
                  disabled={page <= 1}
                  style={[styles.pagerBtn, page <= 1 && styles.pagerBtnDisabled]}
                >
                  <Text style={styles.pagerText}>{t(`${NS}.prev`)}</Text>
                </Pressable>
                <Text style={styles.pagerInfo}>
                  {t(`${NS}.pagination`, { page, totalPages, total })}
                </Text>
                <Pressable
                  accessibilityRole="button"
                  onPress={onNextPage}
                  disabled={page >= totalPages}
                  style={[styles.pagerBtn, page >= totalPages && styles.pagerBtnDisabled]}
                >
                  <Text style={styles.pagerText}>{t(`${NS}.next`)}</Text>
                </Pressable>
              </View>
            ) : null
          }
        />
      )}
    </View>
  )
}

function createStyles(tk: AppThemeTokens) {
  const styles = StyleSheet.create({
    container: {
      flex: 1,
      backgroundColor: tk.surface.bg,
      paddingHorizontal: rnSpacing.md,
    },
    header: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: rnSpacing.sm,
      marginTop: rnSpacing.md,
    },
    titleRow: { flex: 1, flexDirection: 'row', alignItems: 'center', gap: rnSpacing.sm },
    title: { fontSize: 22, fontWeight: '600', color: tk.text.primary },
    subtitle: {
      marginTop: rnSpacing.xs,
      fontSize: rnType.label.size,
      color: tk.text.secondary,
    },
    refreshBtn: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: rnSpacing.xs,
      paddingHorizontal: rnSpacing.md,
      paddingVertical: rnSpacing.xs,
      borderRadius: rnRadius.md,
      borderWidth: 1,
      borderColor: tk.border.light,
    },
    refreshBtnDisabled: { opacity: 0.4 },
    refreshText: { fontSize: rnType.label.size, color: tk.text.secondary },
    centerBlock: {
      alignItems: 'center',
      justifyContent: 'center',
      gap: rnSpacing.sm,
      paddingVertical: rnSpacing['2xl'],
    },
    muted: { fontSize: rnType.body.size, color: tk.text.secondary },
    error: { marginTop: rnSpacing.md, fontSize: rnType.body.size, color: tk.danger.DEFAULT },
    errorInline: {
      marginTop: rnSpacing.sm,
      padding: rnSpacing.sm,
      borderRadius: rnRadius.md,
      backgroundColor: tk.danger.light,
      fontSize: rnType.caption.size,
      color: tk.danger.DEFAULT,
    },
    list: { flex: 1, marginTop: rnSpacing.md },
    listContent: { paddingBottom: rnSpacing['2xl'] },
    row: {
      gap: rnSpacing.xs,
      marginBottom: rnSpacing.sm,
      padding: rnSpacing.md,
      borderRadius: rnRadius.lg,
      borderWidth: 1,
      borderColor: tk.border.light,
      backgroundColor: tk.surface.card,
    },
    rowHead: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      gap: rnSpacing.sm,
    },
    runIdChip: {
      flexShrink: 1,
      paddingHorizontal: rnSpacing.xs,
      borderRadius: rnRadius.sm,
      backgroundColor: tk.surface.muted,
      fontSize: rnType.caption.size,
      color: tk.text.secondary,
    },
    runIdCode: {
      marginTop: rnSpacing.xs,
      paddingHorizontal: rnSpacing.xs,
      borderRadius: rnRadius.sm,
      backgroundColor: tk.surface.muted,
      fontSize: rnType.label.size,
      color: tk.text.primary,
    },
    statusInline: { flexDirection: 'row', alignItems: 'center', gap: rnSpacing.xs },
    statusText: { fontSize: rnType.caption.size, fontWeight: '500', color: tk.text.primary },
    dot: { width: 8, height: 8, borderRadius: 4 },
    taskText: { fontSize: rnType.body.size, fontWeight: '500', color: tk.text.primary },
    rowFoot: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: rnSpacing.xs,
      flexWrap: 'wrap',
    },
    rowMeta: { fontSize: rnType.caption.size, color: tk.text.secondary },
    pager: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      gap: rnSpacing.md,
      paddingVertical: rnSpacing.md,
    },
    pagerBtn: {
      paddingHorizontal: rnSpacing.md,
      paddingVertical: rnSpacing.xs,
      borderRadius: rnRadius.md,
      borderWidth: 1,
      borderColor: tk.border.light,
    },
    pagerBtnDisabled: { opacity: 0.4 },
    pagerText: { fontSize: rnType.label.size, color: tk.text.primary },
    pagerInfo: { fontSize: rnType.caption.size, color: tk.text.secondary },
    detailScroll: { flex: 1, marginTop: rnSpacing.md },
    detailContent: { gap: rnSpacing.md, paddingBottom: rnSpacing['2xl'] },
    card: {
      gap: rnSpacing.xs,
      padding: rnSpacing.md,
      borderRadius: rnRadius.lg,
      borderWidth: 1,
      borderColor: tk.border.light,
      backgroundColor: tk.surface.card,
    },
    detailHead: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      gap: rnSpacing.sm,
    },
    cardHead: { flexDirection: 'row', alignItems: 'center', gap: rnSpacing.xs },
    cardLabel: { fontSize: rnType.label.size, fontWeight: '600', color: tk.text.primary },
    fieldRow: {
      flexDirection: 'row',
      alignItems: 'flex-start',
      gap: rnSpacing.sm,
      marginTop: rnSpacing.xs,
    },
    fieldLabel: {
      width: 96,
      fontSize: rnType.label.size,
      color: tk.text.secondary,
    },
    fieldValue: {
      flex: 1,
      fontSize: rnType.label.size,
      fontWeight: '500',
      color: tk.text.primary,
    },
    blockText: {
      padding: rnSpacing.sm,
      borderRadius: rnRadius.md,
      backgroundColor: tk.surface.muted,
      fontSize: rnType.label.size,
      color: tk.text.primary,
    },
  })

  /** web statusDot(CloudRunsView.tsx:90-95):error=destructive / running=primary / done=emerald */
  const dotTone: Record<'running' | 'done' | 'error' | 'neutral', TextStyle> = {
    running: { backgroundColor: tk.brand.DEFAULT },
    done: { backgroundColor: tk.success.DEFAULT },
    error: { backgroundColor: tk.danger.DEFAULT },
    neutral: { backgroundColor: tk.text.tertiary },
  }

  return { styles, dotTone }
}
