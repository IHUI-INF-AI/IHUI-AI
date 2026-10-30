// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

import { useMemo } from 'react'
import {
  ActivityIndicator,
  FlatList,
  RefreshControl,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native'
import { CalendarClock, CheckCircle2, Clock, PlayCircle, Search, XCircle } from 'lucide-react-native'
import { rnRadius, rnSpacing, rnType } from '@ihui/design-tokens'
import type { TFunction } from '../../types'
import { getTokens, type AppThemeMode, type AppThemeTokens } from '../../theme/tokens'
import { BackChevron } from '../../components/BackChevron'

const NS = 'scheduleTasksPage'

/** 任务卡视图模型:动态行文本(状态/优先级/时间)由薄壳按当前语言与 locale 注入 */
export interface ScheduleTaskCardView {
  id: string
  name: string
  description: string | null
  cronExpression: string
  /** targetService 与 targetMethod 的拼接结果(web page.tsx:156-161 同口径) */
  targetText: string | null
  /** lastRunStatus 原值,只用于选图标档位;null = 未执行 */
  status: string | null
  /** 状态文案(薄壳注入:lastRunStatus ?? t(neverRun)) */
  statusText: string
  /** 优先级文案(薄壳注入:`${t(priority)} ${priority}`,web 同页传参 page.tsx:167) */
  priorityText: string
  enabled: boolean
  /** 最近执行时间(薄壳 Intl 格式化),无则不渲染该行 */
  lastRunTimeText: string | null
}

export interface ScheduleTasksScreenProps {
  t: TFunction
  colorScheme: AppThemeMode
  onBack: () => void
  /** 非空即未登录门(与 web useAuthGate + AuthGatePrompt 同口径,page.tsx:116-117) */
  loginRequiredText: string
  loading: boolean
  error: string | null
  tasks: ScheduleTaskCardView[]
  total: number
  searchValue: string
  onSearchChange: (value: string) => void
  loadingMore: boolean
  hasMore: boolean
  onEndReached: () => void
  onRefresh: () => void
}

/**
 * 定时任务共享屏 —— 承载 web /schedule(apps/web/app/(main)/schedule/page.tsx)。
 *
 * 口径:web 为「标题 + 搜索框 + 卡片网格 + 上一页/下一页」,RN 落为「标题 + 搜索框 + 卡片列表 +
 * 下拉刷新 + 触底续页」,同端点同参数(page/pageSize/name);三态(loading/error/empty)齐。
 * 平台无关:取数、防抖、分页游标、登录态、时间格式化全部由薄壳注入。
 */
export function ScheduleTasksScreen({
  t,
  colorScheme,
  onBack,
  loginRequiredText,
  loading,
  error,
  tasks,
  total,
  searchValue,
  onSearchChange,
  loadingMore,
  hasMore,
  onEndReached,
  onRefresh,
}: ScheduleTasksScreenProps) {
  const tk = getTokens(colorScheme)
  const styles = useMemo(() => createStyles(tk), [tk])

  const statusIcon = (status: string | null) => {
    if (!status) return <Clock size={14} color={tk.text.tertiary} />
    if (status === 'success') return <CheckCircle2 size={14} color={tk.success.deepText} />
    if (status === 'failed' || status === 'timeout') {
      return <XCircle size={14} color={tk.danger.DEFAULT} />
    }
    return <PlayCircle size={14} color={tk.brand.DEFAULT} />
  }

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <BackChevron onPress={onBack} label={t('common.back')} colorScheme={colorScheme} />
        <View style={styles.titleBox}>
          <View style={styles.titleRow}>
            <CalendarClock size={20} color={tk.brand.DEFAULT} />
            <Text style={styles.title}>{t(`${NS}.title`)}</Text>
          </View>
          <Text style={styles.subtitle}>{t(`${NS}.subtitle`)}</Text>
        </View>
      </View>

      <View style={styles.toolbar}>
        <Text style={styles.sectionTitle}>{t(`${NS}.taskList`)}</Text>
        <View style={styles.searchBox}>
          <Search size={15} color={tk.text.tertiary} />
          <TextInput
            style={styles.searchInput}
            value={searchValue}
            onChangeText={onSearchChange}
            placeholder={t(`${NS}.searchTask`)}
            placeholderTextColor={tk.text.tertiary}
            accessibilityLabel={t(`${NS}.searchTask`)}
          />
        </View>
      </View>

      {loginRequiredText ? (
        <Text style={styles.gate}>{loginRequiredText}</Text>
      ) : loading ? (
        <View style={styles.centerBlock}>
          <ActivityIndicator size="small" color={tk.brand.DEFAULT} />
          <Text style={styles.muted}>{t(`${NS}.loading`)}</Text>
        </View>
      ) : error ? (
        <Text style={styles.error}>{error}</Text>
      ) : tasks.length === 0 ? (
        <View style={styles.centerBlock}>
          <CalendarClock size={30} color={tk.text.tertiary} />
          <Text style={styles.muted}>{t(`${NS}.empty`)}</Text>
        </View>
      ) : (
        <FlatList
          data={tasks}
          keyExtractor={(item) => item.id}
          renderItem={({ item }) => (
            <View style={styles.card}>
              <View style={styles.cardHead}>
                <Text style={styles.cardTitle} numberOfLines={1}>
                  {item.name}
                </Text>
                <Text style={[styles.badge, item.enabled ? styles.badgeOn : styles.badgeOff]}>
                  {item.enabled ? t(`${NS}.enabled`) : t(`${NS}.disabled`)}
                </Text>
              </View>
              {item.description ? (
                <Text style={styles.cardBody}>{item.description}</Text>
              ) : null}
              <View style={styles.cronRow}>
                <Clock size={14} color={tk.text.tertiary} />
                <Text style={styles.cronText}>{item.cronExpression}</Text>
              </View>
              {item.targetText ? <Text style={styles.cardMeta}>{item.targetText}</Text> : null}
              <View style={styles.cardFooter}>
                <View style={styles.statusRow}>
                  {statusIcon(item.status)}
                  <Text style={styles.cardMeta}>{item.statusText}</Text>
                </View>
                <Text style={styles.cardMeta}>{item.priorityText}</Text>
              </View>
              {item.lastRunTimeText ? (
                <Text style={styles.cardMeta}>{item.lastRunTimeText}</Text>
              ) : null}
            </View>
          )}
          style={styles.list}
          contentContainerStyle={styles.listContent}
          refreshControl={<RefreshControl refreshing={false} onRefresh={onRefresh} />}
          onEndReached={hasMore ? onEndReached : undefined}
          onEndReachedThreshold={0.4}
          ListFooterComponent={
            loadingMore ? (
              <Text style={styles.footerMuted}>{t(`${NS}.loading`)}</Text>
            ) : !hasMore && total > 0 ? (
              <Text style={styles.footerMuted}>{t(`${NS}.total`, { total })}</Text>
            ) : null
          }
        />
      )}
    </View>
  )
}

function createStyles(tk: AppThemeTokens) {
  return StyleSheet.create({
    container: {
      flex: 1,
      backgroundColor: tk.surface.bg,
      paddingHorizontal: rnSpacing.md,
    },
    header: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: rnSpacing.md,
      marginTop: rnSpacing.md,
    },
    titleBox: { flex: 1 },
    titleRow: { flexDirection: 'row', alignItems: 'center', gap: rnSpacing.sm },
    title: { fontSize: 22, fontWeight: '600', color: tk.text.primary },
    subtitle: { marginTop: 2, fontSize: rnType.label.size, color: tk.text.secondary },
    toolbar: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      gap: rnSpacing.sm,
      marginTop: rnSpacing.md,
    },
    sectionTitle: { fontSize: 16, fontWeight: '600', color: tk.text.primary },
    searchBox: {
      flex: 1,
      flexDirection: 'row',
      alignItems: 'center',
      gap: rnSpacing.xs,
      paddingHorizontal: rnSpacing.sm,
      borderRadius: rnRadius.md,
      borderWidth: 1,
      borderColor: tk.border.light,
      backgroundColor: tk.surface.card,
    },
    searchInput: {
      flex: 1,
      paddingVertical: rnSpacing.xs,
      fontSize: rnType.label.size,
      color: tk.text.primary,
    },
    centerBlock: {
      alignItems: 'center',
      justifyContent: 'center',
      gap: rnSpacing.sm,
      paddingVertical: rnSpacing['2xl'],
    },
    muted: { fontSize: rnType.label.size, color: tk.text.secondary },
    gate: { marginTop: rnSpacing.xl, fontSize: rnType.body.size, color: tk.text.secondary },
    error: { marginTop: rnSpacing.xl, fontSize: rnType.body.size, color: tk.danger.DEFAULT },
    list: { flex: 1, marginTop: rnSpacing.md },
    listContent: { paddingBottom: rnSpacing['2xl'] },
    card: {
      gap: rnSpacing.xs,
      marginBottom: rnSpacing.md,
      padding: rnSpacing.md,
      borderRadius: rnRadius.lg,
      borderWidth: 1,
      borderColor: tk.border.light,
      backgroundColor: tk.surface.card,
    },
    cardHead: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      gap: rnSpacing.sm,
    },
    cardTitle: { flex: 1, fontSize: rnType.body.size, fontWeight: '600', color: tk.text.primary },
    badge: {
      paddingHorizontal: rnSpacing.sm,
      paddingVertical: 2,
      borderRadius: rnRadius.md,
      fontSize: rnType.caption.size,
      fontWeight: '500',
    },
    badgeOn: { backgroundColor: tk.success.lightest, color: tk.success.deepText },
    badgeOff: { backgroundColor: tk.surface.muted, color: tk.text.secondary },
    cardBody: { fontSize: rnType.label.size, color: tk.text.secondary },
    cardMeta: { fontSize: rnType.caption.size, color: tk.text.secondary },
    cronRow: { flexDirection: 'row', alignItems: 'center', gap: rnSpacing.xs },
    cronText: { fontSize: rnType.caption.size, color: tk.text.primary },
    cardFooter: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      gap: rnSpacing.sm,
      marginTop: rnSpacing.xs,
      paddingTop: rnSpacing.xs,
      borderTopWidth: StyleSheet.hairlineWidth,
      borderTopColor: tk.border.light,
    },
    statusRow: { flexDirection: 'row', alignItems: 'center', gap: rnSpacing.xs },
    footerMuted: {
      textAlign: 'center',
      paddingVertical: rnSpacing.md,
      fontSize: rnType.caption.size,
      color: tk.text.secondary,
    },
  })
}
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
