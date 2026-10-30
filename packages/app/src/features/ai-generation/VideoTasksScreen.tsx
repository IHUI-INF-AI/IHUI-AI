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
} from 'react-native'
import { ChevronDown, ChevronRight, RefreshCw, Video } from 'lucide-react-native'
import { rnRadius, rnSpacing, rnType } from '@ihui/design-tokens'
import type { TFunction } from '../../types'
import { getTokens, type AppThemeMode, type AppThemeTokens } from '../../theme/tokens'
import { BackChevron } from '../../components/BackChevron'

const NS = 'videoTasksPage'

export interface VideoTaskRowView {
  id: number
  /** 协议字面值(accepted/running/success/failed),决定徽标配色,不做翻译 */
  status: string
  /** 薄壳按 aiGeneration.status* 取词,未知状态回退协议字面值 */
  statusLabel: string
  promptSummary: string
  createdAtText: string
  detail: VideoTaskDetailView
}

export interface VideoTaskDetailView {
  volcanoTaskId: string
  updatedAtText: string
  statusLabel: string
  messageText: string
  /** 后端状态同步失败提示(可空) */
  warning: string | null
  /** 已解析出的视频地址(result.video_urls[0]) */
  videoUrl: string | null
  /** status==='success' 且无地址 → 展示 noVideoUrlExtracted */
  showNoVideoUrl: boolean
}

export interface VideoTasksScreenProps {
  t: TFunction
  colorScheme: AppThemeMode
  onBack: () => void
  /** 非空即未登录门(与 web useAuthGate 同口径) */
  loginRequiredText: string
  loading: boolean
  error: string | null
  rows: VideoTaskRowView[]
  refreshing: boolean
  onRefresh: () => void
  expandedId: number | null
  onToggleExpand: (id: number) => void
  detailLoading: boolean
  detailError: string | null
  /** 点击视频地址(薄壳用 Linking 打开外部播放器,web 是内联 <video>) */
  onOpenVideo: (url: string) => void
}

/**
 * 即梦视频任务共享屏 —— 承载 web /ai-generation/video-tasks。
 *
 * 后端契约现读:GET /api/ai/jimeng4/video/tasks(apps/api/src/routes/ai-vendors/
 * proxy-tools.ts:720-738,prefix /api/ai 见 apps/api/src/routes/index.ts:764)→
 * success({list,total,page,pageSize});详情 GET .../:taskId(同文件 741-811)→
 * success({task,warning?})。
 *
 * 口径差(如实登记):web 是 Table + 行内展开 + 原生 <video 内联播放;
 * RN 落为卡片行 + 点行展开详情 + 视频地址以可点文本呈现(薄壳 Linking 唤起外部播放器,
 * 不内嵌播放器以免与 WatermelonWebView/RN Video 依赖纠缠)。web 生成中任务 5 秒轮询
 * (page.tsx:76-79)由薄壳定时器实现,本文件不含定时逻辑。
 */
export function VideoTasksScreen({
  t,
  colorScheme,
  onBack,
  loginRequiredText,
  loading,
  error,
  rows,
  refreshing,
  onRefresh,
  expandedId,
  onToggleExpand,
  detailLoading,
  detailError,
  onOpenVideo,
}: VideoTasksScreenProps) {
  const tk = getTokens(colorScheme)
  const styles = useMemo(() => createStyles(tk), [tk])

  const badgeStyle = (status: string) => {
    if (status === 'running') return { box: styles.badgeRunning, text: styles.badgeRunningText }
    if (status === 'success') return { box: styles.badgeSuccess, text: styles.badgeSuccessText }
    if (status === 'failed') return { box: styles.badgeFailed, text: styles.badgeFailedText }
    return { box: styles.badgeIdle, text: styles.badgeIdleText }
  }

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <BackChevron onPress={onBack} label={t('common.back')} colorScheme={colorScheme} />
        <View style={styles.titleBox}>
          <View style={styles.titleRow}>
            <Video size={20} color={tk.brand.DEFAULT} />
            <Text style={styles.title}>{t(`${NS}.title`)}</Text>
          </View>
          <Text style={styles.subtitle}>{t(`${NS}.description`)}</Text>
        </View>
        <Pressable
          style={[styles.refreshBtn, refreshing ? styles.refreshBtnBusy : null]}
          onPress={onRefresh}
          disabled={refreshing}
        >
          <RefreshCw size={14} color={tk.text.primary} />
          <Text style={styles.refreshText}>{t(`${NS}.refresh`)}</Text>
        </Pressable>
      </View>

      <View style={styles.card}>
        <Text style={styles.cardTitle}>{t(`${NS}.taskList`)}</Text>

        {loginRequiredText ? (
          <Text style={styles.muted}>{loginRequiredText}</Text>
        ) : loading ? (
          <View style={styles.centerBlock}>
            <ActivityIndicator size="small" color={tk.brand.DEFAULT} />
            <Text style={styles.muted}>{t(`${NS}.loading`)}</Text>
          </View>
        ) : error ? (
          <Text style={styles.error}>{error}</Text>
        ) : rows.length === 0 ? (
          <View style={styles.centerBlock}>
            <Video size={30} color={tk.text.tertiary} />
            <Text style={styles.muted}>{t(`${NS}.empty`)}</Text>
          </View>
        ) : (
          <FlatList
            data={rows}
            keyExtractor={(item) => String(item.id)}
            style={styles.list}
            contentContainerStyle={styles.listContent}
            refreshControl={
              <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={tk.text.secondary} />
            }
            renderItem={({ item }) => {
              const expanded = expandedId === item.id
              const badge = badgeStyle(item.status)
              return (
                <Pressable style={styles.row} onPress={() => onToggleExpand(item.id)}>
                  <View style={styles.rowHead}>
                    {expanded ? (
                      <ChevronDown size={14} color={tk.text.secondary} />
                    ) : (
                      <ChevronRight size={14} color={tk.text.secondary} />
                    )}
                    <Text style={styles.rowId}>#{item.id}</Text>
                    <Text style={styles.rowPrompt} numberOfLines={1}>
                      {item.promptSummary}
                    </Text>
                  </View>
                  <View style={styles.rowMeta}>
                    <View style={[styles.badge, badge.box]}>
                      <Text style={[styles.badgeText, badge.text]}>{item.statusLabel}</Text>
                    </View>
                    <Text style={styles.rowTime}>{item.createdAtText}</Text>
                  </View>

                  {expanded ? (
                    <View style={styles.detail}>
                      {detailLoading ? (
                        <View style={styles.detailLoadingRow}>
                          <ActivityIndicator size="small" color={tk.text.secondary} />
                          <Text style={styles.muted}>{t(`${NS}.syncingStatus`)}</Text>
                        </View>
                      ) : detailError ? (
                        <Text style={styles.error}>{detailError}</Text>
                      ) : (
                        <>
                          <DetailItem
                            styles={styles}
                            label={t(`${NS}.volcanoTaskId`)}
                            value={item.detail.volcanoTaskId}
                            mono
                          />
                          <DetailItem
                            styles={styles}
                            label={t(`${NS}.updatedAt`)}
                            value={item.detail.updatedAtText}
                          />
                          <DetailItem
                            styles={styles}
                            label={t(`${NS}.status`)}
                            value={item.detail.statusLabel}
                          />
                          <DetailItem
                            styles={styles}
                            label={t(`${NS}.message`)}
                            value={item.detail.messageText}
                          />
                          {item.detail.warning ? (
                            <Text style={styles.warning}>{item.detail.warning}</Text>
                          ) : null}
                          {item.detail.videoUrl ? (
                            <Pressable onPress={() => onOpenVideo(item.detail.videoUrl ?? '')}>
                              <Text style={styles.videoLink}>{item.detail.videoUrl}</Text>
                            </Pressable>
                          ) : item.detail.showNoVideoUrl ? (
                            <Text style={styles.error}>{t(`${NS}.noVideoUrlExtracted`)}</Text>
                          ) : null}
                        </>
                      )}
                    </View>
                  ) : null}
                </Pressable>
              )
            }}
          />
        )}
      </View>
    </View>
  )
}

function DetailItem({
  styles,
  label,
  value,
  mono,
}: {
  styles: ReturnType<typeof createStyles>
  label: string
  value: string
  mono?: boolean
}) {
  return (
    <View style={styles.detailItem}>
      <Text style={styles.detailLabel}>{label}</Text>
      <Text style={[styles.detailValue, mono ? styles.mono : null]} numberOfLines={2}>
        {value}
      </Text>
    </View>
  )
}

function createStyles(tk: AppThemeTokens) {
  return StyleSheet.create({
    container: { flex: 1, backgroundColor: tk.surface.bg, paddingHorizontal: rnSpacing.md },
    header: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: rnSpacing.sm,
      marginTop: rnSpacing.md,
    },
    titleBox: { flex: 1 },
    titleRow: { flexDirection: 'row', alignItems: 'center', gap: rnSpacing.sm },
    title: { fontSize: 20, fontWeight: '700', color: tk.text.primary },
    subtitle: { marginTop: 2, fontSize: rnType.label.size, color: tk.text.secondary },
    refreshBtn: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: rnSpacing.xs,
      paddingHorizontal: rnSpacing.sm,
      paddingVertical: rnSpacing.xs,
      borderRadius: rnRadius.md,
      borderWidth: 1,
      borderColor: tk.border.medium,
      backgroundColor: tk.surface.card,
    },
    refreshBtnBusy: { opacity: 0.6 },
    refreshText: { fontSize: rnType.label.size, color: tk.text.primary },
    card: {
      flex: 1,
      marginTop: rnSpacing.md,
      marginBottom: rnSpacing.md,
      padding: rnSpacing.md,
      borderRadius: rnRadius.lg,
      borderWidth: 1,
      borderColor: tk.border.light,
      backgroundColor: tk.surface.card,
    },
    cardTitle: {
      fontSize: rnType.title.size,
      fontWeight: '600',
      color: tk.text.primary,
      marginBottom: rnSpacing.sm,
    },
    centerBlock: {
      alignItems: 'center',
      justifyContent: 'center',
      gap: rnSpacing.sm,
      paddingVertical: rnSpacing['2xl'],
    },
    muted: { fontSize: rnType.label.size, color: tk.text.secondary },
    error: { fontSize: rnType.label.size, color: tk.danger.DEFAULT },
    warning: {
      fontSize: rnType.caption.size,
      color: tk.warning.amberText,
      backgroundColor: tk.warning.light,
      borderRadius: rnRadius.md,
      padding: rnSpacing.sm,
    },
    list: { flex: 1 },
    listContent: { paddingBottom: rnSpacing.lg },
    row: {
      gap: rnSpacing.xs,
      marginBottom: rnSpacing.sm,
      padding: rnSpacing.sm,
      borderRadius: rnRadius.md,
      borderWidth: 1,
      borderColor: tk.border.light,
      backgroundColor: tk.surface.bg,
    },
    rowHead: { flexDirection: 'row', alignItems: 'center', gap: rnSpacing.xs },
    rowId: { fontSize: rnType.caption.size, color: tk.text.secondary },
    rowPrompt: { flex: 1, fontSize: rnType.body.size, color: tk.text.primary },
    rowMeta: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      gap: rnSpacing.sm,
      paddingLeft: rnSpacing.lg,
    },
    rowTime: { fontSize: rnType.caption.size, color: tk.text.tertiary },
    badge: { borderRadius: rnRadius.md, paddingHorizontal: rnSpacing.sm, paddingVertical: 1 },
    badgeText: { fontSize: rnType.caption.size, fontWeight: '500' },
    badgeIdle: { backgroundColor: tk.surface.muted },
    badgeIdleText: { color: tk.text.secondary },
    badgeRunning: { backgroundColor: tk.brandAccent.light },
    badgeRunningText: { color: tk.brandAccent.deep },
    badgeSuccess: { backgroundColor: tk.success.light },
    badgeSuccessText: { color: tk.success.deepText },
    badgeFailed: { backgroundColor: tk.danger.light },
    badgeFailedText: { color: tk.danger.DEFAULT },
    detail: {
      gap: rnSpacing.xs,
      marginTop: rnSpacing.xs,
      padding: rnSpacing.sm,
      borderRadius: rnRadius.md,
      backgroundColor: tk.surface.muted,
    },
    detailLoadingRow: { flexDirection: 'row', alignItems: 'center', gap: rnSpacing.sm },
    detailItem: { flexDirection: 'row', justifyContent: 'space-between', gap: rnSpacing.sm },
    detailLabel: { fontSize: rnType.caption.size, color: tk.text.secondary, flexShrink: 0 },
    detailValue: { flex: 1, textAlign: 'right', fontSize: rnType.caption.size, color: tk.text.primary },
    mono: { fontFamily: 'monospace' },
    videoLink: {
      fontSize: rnType.caption.size,
      color: tk.brandAccent.deep,
      textDecorationLine: 'underline',
    },
  })
}
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
