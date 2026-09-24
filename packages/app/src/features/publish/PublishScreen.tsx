// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

import { useMemo } from 'react'
import {
  ActivityIndicator,
  FlatList,
  Pressable,
  RefreshControl,
  StyleSheet,
  Text,
  View,
  type TextStyle,
  type ViewStyle,
} from 'react-native'
import { ChevronLeft } from 'lucide-react-native'
import { getTokens, type AppThemeTokens } from '../../theme/tokens'
import type { TFunction } from '@ihui/types'

import { rnRadius } from '@ihui/design-tokens'

/**
 * PublishScreen 内容发布中心(共享层)
 *
 * 2026-09-15 承接 mobile-rn PublishScreen 1:1 迁移(M3 web /publish 移动端原生入口):
 * - 结构:顶部导航行 → 简易统计条(总计/成功/失败,由 tasks 派生)
 *   → 任务列表卡(标题/状态徽章/平台目标/时间/错误信息/取消·重试操作)→ 下拉刷新
 * - 平台无关:API(listPublishTasks/cancel/retry)、Alert 确认、导航由 wrapper 注入
 * - 样式:getTokens(colorScheme) 语义 token(零 hex),对齐原屏 tailwind 间距(dp)
 * - i18n:复用 publish 与 common 既有 key;状态标签/平台名新 key 由 wrapper 注入
 *   platformLabels 映射,状态标签走 publish.status 系列 key
 */

/** 发布任务展示项(结构对齐 @ihui/api-client PublishTask,wrapper 直接传入) */
export interface PublishTaskItem {
  id: number
  userId: string
  title: string
  platforms: string[]
  status: string
  scheduledAt?: string | null
  createdAt: string
  errorMessage?: string | null
}

export interface PublishScreenProps {
  t: TFunction
  tasks: PublishTaskItem[]
  loading: boolean
  refreshing: boolean
  /** 加载失败文案(wrapper 已本地化;空串表示无错误) */
  error: string
  /** 正在执行取消/重试操作的任务 id(String 形式),命中时该卡操作按钮禁用 */
  operatingId: string | null
  /** 平台 id → 本地化名称(wrapper 由 t() 构造;未命中回退平台 id) */
  platformLabels: Record<string, string>
  /** 下拉刷新(wrapper 内 setRefreshing + load) */
  onRefresh: () => void
  /** 错误态重试按钮(wrapper 内 setLoading + load) */
  onRetryLoad: () => void
  /** 取消任务(pending/running 卡;Alert 确认由 wrapper 处理) */
  onCancelTask: (task: PublishTaskItem) => void
  /** 重试任务(failed/partial 卡) */
  onRetryTask: (task: PublishTaskItem) => void
  onBack: () => void
  colorScheme?: 'light' | 'dark'
}

/** 单个平台目标(运行时归一化;后端可能返回 string 或对象) */
interface PlatformLike {
  platform?: string
  success?: boolean
}

function isPlatformObject(v: string | PlatformLike): v is PlatformLike {
  return typeof v === 'object' && v !== null && 'platform' in v
}

function platformLabel(p: string | PlatformLike, labels: Record<string, string>): string {
  const id = isPlatformObject(p) ? (p.platform ?? '') : p
  return labels[id] ?? id
}

/** 后端契约与 api-client 类型可能不一致(对象数组 vs string[]),运行时归一化 */
function formatPlatforms(platforms: string[] | undefined, labels: Record<string, string>): string {
  if (!platforms || platforms.length === 0) return ''
  const raw = platforms as unknown as ReadonlyArray<string | PlatformLike>
  return raw.map((p) => platformLabel(p, labels)).join(', ')
}

function fmtTime(iso: string | undefined): string {
  if (!iso) return '-'
  // 简化展示:取 ISO 前 16 位(T → 空格),避免 RN Intl 兼容性问题
  return iso.replace('T', ' ').slice(0, 16)
}

/** 状态 → 本地化标签(对齐 web TaskCard STATUS_LABEL;未知状态回退原始值) */
function statusText(t: TFunction, status: string): string {
  const map: Record<string, string> = {
    success: t('publish.statusSuccess'),
    failed: t('publish.statusFailed'),
    partial: t('publish.statusPartial'),
    running: t('publish.statusRunning'),
    pending: t('publish.statusPending'),
    skipped: t('publish.statusSkipped'),
  }
  return map[status] ?? status
}

/** 状态 → 徽章配色(语义 token,明暗由 colorScheme 解析;对齐原屏 STATUS_META) */
function statusBadge(tk: AppThemeTokens, status: string): { bg: string; text: string } {
  switch (status) {
    case 'success':
      return { bg: tk.success.lightest, text: tk.success.deepText }
    case 'failed':
      return { bg: tk.danger.light, text: tk.danger.DEFAULT }
    case 'partial':
    case 'running':
      return { bg: tk.warning.amberLight, text: tk.warning.amberText }
    default:
      // pending / skipped / 未知状态:中性灰
      return { bg: tk.surface.muted, text: tk.text.secondary }
  }
}

/** PublishScreen 内容发布中心(props 注入式跨端组件) */
export function PublishScreen({
  t,
  tasks,
  loading,
  refreshing,
  error,
  operatingId,
  platformLabels,
  onRefresh,
  onRetryLoad,
  onCancelTask,
  onRetryTask,
  onBack,
  colorScheme = 'light',
}: PublishScreenProps) {
  const tk = getTokens(colorScheme)
  const styles = useMemo(() => createStyles(tk), [tk])

  // 简易统计条(从当前列表计算,不再单独请求 /publish/stats)
  const successCount = tasks.filter((i) => i.status === 'success').length
  const failedCount = tasks.filter((i) => i.status === 'failed' || i.status === 'partial').length

  if (loading) {
    return (
      <View style={styles.container}>
        <Header title={t('publish.title')} onBack={onBack} styles={styles} />
        <View style={styles.center}>
          <ActivityIndicator color={tk.text.secondary} />
        </View>
      </View>
    )
  }

  return (
    <View style={styles.container}>
      <Header title={t('publish.title')} onBack={onBack} styles={styles} />

      {/* 简易统计条 */}
      <View style={styles.statsRow}>
        <View style={[styles.statCard, { backgroundColor: tk.surface.muted }]}>
          <Text style={styles.statLabel}>{t('publish.statsTotal')}</Text>
          <Text style={styles.statValue}>{tasks.length}</Text>
        </View>
        <View style={[styles.statCard, { backgroundColor: tk.success.lightest }]}>
          <Text style={[styles.statLabel, styles.statLabelSuccess]}>
            {t('publish.statsSuccess')}
          </Text>
          <Text style={[styles.statValue, styles.statValueSuccess]}>{successCount}</Text>
        </View>
        <View style={[styles.statCard, { backgroundColor: tk.danger.light }]}>
          <Text style={[styles.statLabel, styles.statLabelFailed]}>{t('publish.statsFailed')}</Text>
          <Text style={[styles.statValue, styles.statValueFailed]}>{failedCount}</Text>
        </View>
      </View>

      {error ? (
        <View style={styles.errorWrap}>
          <Text style={styles.errorText}>{error}</Text>
          <Pressable
            onPress={onRetryLoad}
            style={({ pressed }) => [styles.retryBtn, pressed ? styles.pressed : null]}
            accessibilityRole="button"
            accessibilityLabel={t('publish.retry')}
          >
            <Text style={styles.retryBtnText}>{t('publish.retry')}</Text>
          </Pressable>
        </View>
      ) : (
        <FlatList
          data={tasks}
          keyExtractor={(item) => String(item.id)}
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={onRefresh}
              tintColor={tk.text.secondary}
              colors={[tk.brand.DEFAULT]}
            />
          }
          ListEmptyComponent={
            <View style={styles.emptyWrap}>
              <Text style={styles.emptyText}>{t('publish.empty')}</Text>
              <Text style={styles.emptyHint}>{t('publish.emptyHint')}</Text>
            </View>
          }
          contentContainerStyle={styles.listContent}
          renderItem={({ item }) => {
            const badge = statusBadge(tk, item.status)
            const platforms = formatPlatforms(item.platforms, platformLabels)
            // 任务操作规则与 web /publish/history 对齐:pending/running 可取消,failed/partial 可重试
            const canCancel = item.status === 'pending' || item.status === 'running'
            const canRetry = item.status === 'failed' || item.status === 'partial'
            const busy = operatingId === String(item.id)
            return (
              <View style={styles.card}>
                <View style={styles.cardTopRow}>
                  <Text style={styles.cardTitle} numberOfLines={1}>
                    {item.title}
                  </Text>
                  <View style={[styles.badge, { backgroundColor: badge.bg }]}>
                    <Text style={[styles.badgeText, { color: badge.text }]}>
                      {statusText(t, item.status)}
                    </Text>
                  </View>
                </View>
                {platforms ? (
                  <Text style={styles.cardPlatforms} numberOfLines={1}>
                    {platforms}
                  </Text>
                ) : null}
                <Text style={styles.cardTime}>
                  {fmtTime(item.createdAt)}
                  {item.scheduledAt
                    ? ` · ${t('publish.scheduled')} ${fmtTime(item.scheduledAt)}`
                    : ''}
                </Text>
                {item.errorMessage ? (
                  <Text style={styles.cardError} numberOfLines={2}>
                    {item.errorMessage}
                  </Text>
                ) : null}
                {canCancel || canRetry ? (
                  <View style={styles.cardActions}>
                    {canCancel ? (
                      <Pressable
                        onPress={() => onCancelTask(item)}
                        disabled={busy}
                        style={({ pressed }) => [
                          styles.actionBtn,
                          styles.actionBtnGhost,
                          pressed && !busy ? styles.pressed : null,
                        ]}
                        accessibilityRole="button"
                        accessibilityLabel={t('publish.cancelTask')}
                      >
                        <Text style={styles.actionBtnGhostText}>{t('publish.cancelTask')}</Text>
                      </Pressable>
                    ) : null}
                    {canRetry ? (
                      <Pressable
                        onPress={() => onRetryTask(item)}
                        disabled={busy}
                        style={({ pressed }) => [
                          styles.actionBtn,
                          styles.actionBtnPrimary,
                          pressed && !busy ? styles.pressed : null,
                        ]}
                        accessibilityRole="button"
                        accessibilityLabel={t('publish.retryTask')}
                      >
                        <Text style={styles.actionBtnPrimaryText}>{t('publish.retryTask')}</Text>
                      </Pressable>
                    ) : null}
                  </View>
                ) : null}
              </View>
            )
          }}
        />
      )}
    </View>
  )
}

// ── 私有:顶部导航行(返回箭头 + 标题,对齐共享层 Header 范式) ──

function Header({
  title,
  onBack,
  styles,
}: {
  title: string
  onBack: () => void
  styles: ReturnType<typeof createStyles>
}) {
  return (
    <View style={styles.headerBar}>
      <Pressable
        style={styles.headerBackBtn}
        onPress={onBack}
        accessibilityRole="button"
        accessibilityLabel="back"
      >
        <ChevronLeft size={22} color={styles.headerIcon.color} />
      </Pressable>
      <Text style={styles.headerTitle} numberOfLines={1}>
        {title}
      </Text>
      <View style={styles.headerSidePlaceholder} />
    </View>
  )
}

/**
 * 样式:对齐原屏 tailwind 间距(数值即 dp)。
 * 全部颜色走 AppThemeTokens 语义 token,零 hex。
 */
function createStyles(tk: AppThemeTokens) {
  return StyleSheet.create({
    container: {
      flex: 1,
      backgroundColor: tk.surface.bg,
    },
    center: {
      flex: 1,
      alignItems: 'center',
      justifyContent: 'center',
    },
    pressed: {
      opacity: 0.7,
    },
    /* 顶部导航行 */
    headerBar: {
      flexDirection: 'row',
      alignItems: 'center',
      height: 44,
      paddingHorizontal: 10,
    },
    headerBackBtn: {
      width: 32,
      height: 32,
      alignItems: 'center',
      justifyContent: 'center',
    },
    headerIcon: {
      color: tk.brand.DEFAULT,
    },
    headerTitle: {
      flex: 1,
      fontSize: 18,
      fontWeight: '700',
      color: tk.brand.DEFAULT,
      textAlign: 'center',
    },
    headerSidePlaceholder: {
      width: 32,
    },
    /* 统计条 */
    statsRow: {
      flexDirection: 'row',
      gap: 8, // gap-2
      marginHorizontal: 16, // mx-4
      marginTop: 4,
      marginBottom: 4, // mb-1
    },
    statCard: {
      flex: 1,
      borderRadius: rnRadius.lg, // rounded-lg
      padding: 8, // p-2
    },
    statLabel: {
      fontSize: 12, // text-xs
      color: tk.text.secondary, // text-gray-500
    },
    statValue: {
      fontSize: 16, // text-base
      fontWeight: '600',
      marginTop: 2, // mt-0.5
      color: tk.text.primary,
    },
    statLabelSuccess: {
      color: tk.success.deepText, // text-emerald-600 dark:text-emerald-300
    },
    statValueSuccess: {
      color: tk.success.deepText, // text-emerald-700 dark:text-emerald-300
    },
    statLabelFailed: {
      color: tk.danger.DEFAULT, // text-red-600 dark:text-red-300
    },
    statValueFailed: {
      color: tk.danger.DEFAULT, // text-red-700 dark:text-red-300
    },
    /* 错误态 */
    errorWrap: {
      flex: 1,
      alignItems: 'center',
      justifyContent: 'center',
      paddingHorizontal: 24, // px-6
    },
    errorText: {
      marginBottom: 12, // mb-3
      textAlign: 'center',
      fontSize: 14, // text-sm
      color: tk.text.secondary, // text-gray-500
    },
    retryBtn: {
      borderRadius: rnRadius.md, // rounded-md
      paddingHorizontal: 16, // px-4
      paddingVertical: 8, // py-2
      backgroundColor: tk.gray[200], // bg-gray-200
    },
    retryBtnText: {
      fontSize: 14, // text-sm
      color: tk.text.primary,
    },
    /* 列表 */
    listContent: {
      padding: 16,
    },
    emptyWrap: {
      alignItems: 'center',
      paddingVertical: 64, // py-16
    },
    emptyText: {
      fontSize: 14, // text-sm
      color: tk.text.secondary, // text-gray-500
    },
    emptyHint: {
      fontSize: 12, // text-xs
      marginTop: 4, // mt-1
      color: tk.text.tertiary, // text-gray-400
    },
    /* 任务卡 */
    card: {
      marginBottom: 12, // mb-3
      borderRadius: rnRadius.lg, // rounded-lg
      borderWidth: 1,
      borderColor: tk.border.light, // border-gray-200
      padding: 16, // p-4
      backgroundColor: tk.surface.card, // bg-white dark:bg-neutral-800
    },
    cardTopRow: {
      flexDirection: 'row',
      alignItems: 'flex-start',
      justifyContent: 'space-between',
      gap: 8, // gap-2
    },
    cardTitle: {
      flex: 1,
      fontSize: 16, // text-base
      fontWeight: '500', // font-medium
      color: tk.text.primary,
    },
    badge: {
      borderRadius: rnRadius.md, // rounded-md
      paddingHorizontal: 8, // px-2
      paddingVertical: 2, // py-0.5
    },
    badgeText: {
      fontSize: 12, // text-xs
      fontWeight: '500', // font-medium
    },
    cardPlatforms: {
      fontSize: 12, // text-xs
      marginTop: 6, // mt-1.5
      color: tk.text.secondary, // text-gray-500
    },
    cardTime: {
      fontSize: 12, // text-xs
      marginTop: 6, // mt-1.5
      color: tk.text.tertiary, // text-gray-400
    },
    cardError: {
      fontSize: 12, // text-xs
      marginTop: 6, // mt-1.5
      color: tk.danger.DEFAULT, // text-red-500
    },
    cardActions: {
      flexDirection: 'row',
      marginTop: 8, // mt-2
      gap: 8, // gap-2
    },
    actionBtn: {
      borderRadius: rnRadius.md, // rounded-md
      paddingHorizontal: 10, // px-2.5
      paddingVertical: 4, // py-1
    },
    actionBtnGhost: {
      borderWidth: 1,
      borderColor: tk.border.light, // border-gray-200
    },
    actionBtnGhostText: {
      fontSize: 12, // text-xs
      color: tk.text.secondary, // text-gray-500
    },
    actionBtnPrimary: {
      backgroundColor: tk.brand.cta, // bg-orange-600 → 共享层品牌主色
    },
    actionBtnPrimaryText: {
      fontSize: 12, // text-xs
      color: tk.brand.ctaForeground, // text-white
    },
  } satisfies Record<string, ViewStyle | TextStyle>)
}
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
