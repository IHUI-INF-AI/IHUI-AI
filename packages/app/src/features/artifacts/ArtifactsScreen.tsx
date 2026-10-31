// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * 产物中心共享屏 — 对齐 web apps/web/app/(main)/artifacts/page.tsx(2026-10-31)。
 *
 * 纯展示:AI 交付物(HTML 报告/演示/表格/文档/视频引用)分页列表,
 * 每行 kind 徽标(与 web KIND_CLASS 同源档位:紫/蓝/绿/灰/琥珀)+ 版本 +
 * 相对时间 + 来源会话入口 + 下载/预览动作;取数与导出由平台薄壳负责
 * (web 同源 cookie、RN/小程序走 @ihui/api-client getArtifacts/getArtifactDownload)。
 * 导出格式矩阵唯一源 @ihui/api-client ARTIFACT_SUPPORTED_FMTS(video_ref 无导出形态)。
 */
import { useMemo } from 'react'
import { Download, Eye, MessageSquare, PackageOpen, RefreshCw } from 'lucide-react-native'
import { ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native'
import { rnHue, rnHueTintOnly, rnRadius, rnTokens, rnSpacing } from '@ihui/design-tokens'
import type { TFunction } from '../../types'
import { getTokens } from '../../theme/tokens'
import type { AppThemeTokens } from '../../theme/tokens'
import { BackChevron } from '../../components/BackChevron'
import { ListPager } from '../student/ListPager'
import type { ListPagerStyles } from '../student/ListPager'

/**
 * 产物条目投影(唯一源 @ihui/api-client 的 ArtifactListItem;本包不依赖 api-client,
 * 按 MyResourceItem 同款惯例落逐字段同构类型,薄壳直接传 api-client 返回值)。
 */
export interface ArtifactItem {
  id: string
  kind: 'html_report' | 'slides' | 'sheet' | 'doc' | 'video_ref'
  name: string
  version: number
  created_at: string
  session_id: string
  /** 签名预览链指针(ai-service token 端点的 file 参数) */
  payload_ref: string
}

/** kind 徽标语义色(固定语义色,不随主题换档;与 web page.tsx KIND_CLASS 同源档位)。 */
export const ARTIFACT_KIND_PALETTE: Record<ArtifactItem['kind'], { bg: string; fg: string }> = {
  html_report: { bg: rnHue.purple.tintStrong, fg: rnHue.purple.fg },
  slides: { bg: rnHue.blue.tintStrong, fg: rnHue.blue.fg },
  sheet: { bg: rnHue.emerald.tintStrong, fg: rnHue.emerald.fg },
  // doc 的前景已由 tokens.css 派生进 RN 令牌表(门 93 R8 现点名这一枚),
  // 所以取语义档而不是色相表;色相表的 neutral 族刻意只留底档。
  doc: { bg: rnHueTintOnly.neutral.tintStrong, fg: rnTokens.gray['500'] },
  video_ref: { bg: rnHue.amber.tintStrong, fg: rnHue.amber.fg },
}

function kindLabelKey(kind: ArtifactItem['kind']): string {
  return `artifacts.kind_${kind}`
}

/** created_at → 相对时间文案(阈值与 web formatCreated 一致)。 */
export function formatArtifactCreated(iso: string, t: TFunction): string {
  const ms = Date.parse(iso)
  if (Number.isNaN(ms)) return '—'
  const diff = Date.now() - ms
  if (diff < 10_000) return t('artifacts.justNow')
  if (diff < 60_000) return t('artifacts.secondsAgo', { n: Math.floor(diff / 1000) })
  if (diff < 3_600_000) return t('artifacts.minutesAgo', { n: Math.floor(diff / 60_000) })
  if (diff < 86_400_000) return t('artifacts.hoursAgo', { n: Math.floor(diff / 86_400_000) })
  return t('artifacts.daysAgo', { n: Math.floor(diff / 86_400_000) })
}

export interface ArtifactsScreenProps {
  t: TFunction
  colorScheme?: 'light' | 'dark'
  onBack: () => void
  loading?: boolean
  loadingMore?: boolean
  error?: string | null
  previewError?: string | null
  items?: ArtifactItem[]
  page?: number
  totalPages?: number
  /** 服务端 total(列表「已加载 x/y」文案用) */
  total?: number
  onPageChange?: (page: number) => void
  onRefresh?: () => void
  /** 导出下载(video_ref 不会触发:共享屏按导出格式矩阵禁用按钮) */
  onDownload?: (item: ArtifactItem) => void
  downloadingId?: string | null
  /** html_report 签名预览(薄壳换 token 后打开) */
  onPreview?: (item: ArtifactItem) => void
  /** 来源会话 → 会话详情 */
  onViewSession?: (item: ArtifactItem) => void
}

function createArtifactsStyles(tk: AppThemeTokens) {
  return StyleSheet.create({
    container: { flex: 1, backgroundColor: tk.surface.bg },
    header: {
      flexDirection: 'row',
      alignItems: 'center',
      paddingHorizontal: rnSpacing['sm-loose'],
      paddingVertical: rnSpacing.md,
      gap: rnSpacing.md,
    },
    headerTitle: { fontSize: 18, fontWeight: '700', color: tk.text.primary },
    headerTitleRow: { flexDirection: 'row', alignItems: 'center', gap: rnSpacing.sm },
    scroll: { padding: rnSpacing.md, paddingBottom: rnSpacing['3xl'], gap: rnSpacing.md },
    desc: { fontSize: 12, color: tk.text.secondary },
    card: {
      backgroundColor: tk.surface.light,
      borderRadius: rnRadius.lg,
      borderWidth: StyleSheet.hairlineWidth,
      borderColor: tk.border.light,
      padding: rnSpacing.md,
      gap: rnSpacing['sm-loose'],
    },
    cardTitleRow: { flexDirection: 'row', alignItems: 'center', gap: rnSpacing.sm },
    cardTitle: { fontSize: 15, fontWeight: '700', color: tk.text.primary },
    emptyBox: {
      alignItems: 'center',
      paddingVertical: rnSpacing['3xl'],
      gap: rnSpacing['xs-loose'],
    },
    emptyText: { fontSize: 13, color: tk.text.secondary, textAlign: 'center' },
    row: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: rnSpacing.sm,
      paddingVertical: rnSpacing['sm-loose'],
      borderTopWidth: StyleSheet.hairlineWidth,
      borderTopColor: tk.border.light,
    },
    rowMain: { flex: 1, minWidth: 0, gap: rnSpacing.xs },
    rowName: { fontSize: 13, fontWeight: '600', color: tk.text.primary },
    rowMeta: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: rnSpacing['xs-loose'],
      flexWrap: 'wrap',
    },
    metaText: { fontSize: 11, color: tk.text.secondary },
    badge: {
      borderRadius: rnRadius.md,
      paddingHorizontal: rnSpacing['xs-loose'],
      paddingVertical: rnSpacing['2xs'],
    },
    badgeText: { fontSize: 10, fontWeight: '600' },
    sessionBtn: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: rnSpacing.xs,
      marginTop: rnSpacing.xs,
    },
    sessionText: { fontSize: 11, color: tk.brand.DEFAULT },
    actionRow: { flexDirection: 'row', alignItems: 'center', gap: rnSpacing.sm, flexShrink: 0 },
    actionBtn: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: rnSpacing.xs,
      borderRadius: rnRadius.sm,
      borderWidth: StyleSheet.hairlineWidth,
      borderColor: tk.border.medium,
      paddingHorizontal: rnSpacing['sm-loose'],
      paddingVertical: rnSpacing['xs-loose'],
    },
    actionBtnDisabled: { opacity: 0.5 },
    actionText: { fontSize: 12, color: tk.text.primary },
    footerRow: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      flexWrap: 'wrap',
      gap: rnSpacing.sm,
    },
    countText: { fontSize: 11, color: tk.text.secondary, flexShrink: 1 },
    refreshBtn: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: rnSpacing.xs,
      borderRadius: rnRadius.sm,
      borderWidth: StyleSheet.hairlineWidth,
      borderColor: tk.border.medium,
      paddingHorizontal: rnSpacing['sm-loose'],
      paddingVertical: rnSpacing['xs-loose'],
    },
    refreshText: { fontSize: 12, color: tk.text.primary },
  })
}

export function ArtifactsScreen({
  t,
  onBack,
  colorScheme = 'light',
  loading = false,
  loadingMore = false,
  error = null,
  previewError = null,
  items = [],
  page = 1,
  totalPages = 1,
  total = 0,
  onPageChange,
  onRefresh,
  onDownload,
  downloadingId = null,
  onPreview,
  onViewSession,
}: ArtifactsScreenProps) {
  const tk = getTokens(colorScheme)
  const styles = useMemo(() => createArtifactsStyles(tk), [tk])
  const pagerStyles: ListPagerStyles = useMemo(
    () => ({
      pagerRow: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 8,
        paddingTop: 4,
      },
      pagerBtn: {
        borderRadius: rnRadius.sm,
        borderWidth: StyleSheet.hairlineWidth,
        borderColor: tk.border.medium,
        paddingHorizontal: 10,
        paddingVertical: 6,
      },
      pagerBtnText: { fontSize: 12, color: tk.text.primary },
      pagerBtnTextDisabled: { fontSize: 12, color: tk.text.tertiary },
      pageInfo: { fontSize: 12, color: tk.text.secondary },
    }),
    [tk],
  )

  const header = (
    <View style={styles.header}>
      <BackChevron onPress={onBack} label={t('common.back')} colorScheme={colorScheme} />
      <View style={styles.headerTitleRow}>
        <PackageOpen size={18} color={tk.text.primary} />
        <Text style={styles.headerTitle}>{t('artifacts.title')}</Text>
      </View>
    </View>
  )

  const renderItem = (item: ArtifactItem) => {
    const tone = ARTIFACT_KIND_PALETTE[item.kind]
    const canDownload = (onDownload ?? null) !== null && item.kind !== 'video_ref'
    const downloading = downloadingId === item.id
    return (
      <View key={item.id} style={styles.row}>
        <View style={styles.rowMain}>
          <Text style={styles.rowName} numberOfLines={1}>
            {item.name}
          </Text>
          <View style={styles.rowMeta}>
            <View style={[styles.badge, { backgroundColor: tone.bg }]}>
              <Text style={[styles.badgeText, { color: tone.fg }]}>
                {t(kindLabelKey(item.kind))}
              </Text>
            </View>
            <Text style={styles.metaText}>v{item.version}</Text>
            <Text style={styles.metaText}>{formatArtifactCreated(item.created_at, t)}</Text>
          </View>
          {onViewSession ? (
            <TouchableOpacity
              style={styles.sessionBtn}
              activeOpacity={0.85}
              accessibilityRole="button"
              accessibilityLabel={t('artifacts.viewSession')}
              onPress={() => onViewSession(item)}
            >
              <MessageSquare size={12} color={tk.brand.DEFAULT} />
              <Text style={styles.sessionText}>{t('artifacts.viewSession')}</Text>
            </TouchableOpacity>
          ) : null}
        </View>
        <View style={styles.actionRow}>
          <TouchableOpacity
            style={[styles.actionBtn, (!canDownload || downloading) && styles.actionBtnDisabled]}
            activeOpacity={0.85}
            accessibilityRole="button"
            accessibilityLabel={t('artifacts.download')}
            disabled={!canDownload || downloading}
            onPress={() => canDownload && onDownload?.(item)}
          >
            <Download size={12} color={tk.text.primary} />
            <Text style={styles.actionText}>{t('artifacts.download')}</Text>
          </TouchableOpacity>
          {item.kind === 'html_report' && onPreview ? (
            <TouchableOpacity
              style={styles.actionBtn}
              activeOpacity={0.85}
              accessibilityRole="button"
              accessibilityLabel={t('artifacts.preview')}
              onPress={() => onPreview(item)}
            >
              <Eye size={12} color={tk.text.primary} />
              <Text style={styles.actionText}>{t('artifacts.preview')}</Text>
            </TouchableOpacity>
          ) : null}
        </View>
      </View>
    )
  }

  return (
    <View style={styles.container}>
      {header}
      <ScrollView style={{ flex: 1 }} contentContainerStyle={styles.scroll}>
        <Text style={styles.desc}>{t('artifacts.desc')}</Text>
        <View style={styles.card}>
          {error ? <Text style={[styles.emptyText, { color: rnHue.rose.fg }]}>{error}</Text> : null}
          {previewError ? (
            <Text style={[styles.emptyText, { color: rnHue.rose.fg }]}>{previewError}</Text>
          ) : null}
          {loading ? (
            <View style={styles.emptyBox}>
              <Text style={styles.emptyText}>{t('artifacts.loading')}</Text>
            </View>
          ) : items.length === 0 ? (
            <View style={styles.emptyBox}>
              <Text style={styles.emptyText}>{t('artifacts.empty')}</Text>
            </View>
          ) : (
            <>
              {items.map(renderItem)}
              <ListPager
                t={t}
                page={page}
                totalPages={totalPages}
                onPageChange={onPageChange ?? (() => {})}
                styles={pagerStyles}
              />
            </>
          )}
        </View>
        {onRefresh && !loading && items.length > 0 ? (
          <View style={styles.footerRow}>
            <Text style={styles.countText}>
              {t('artifacts.countSummary', { loaded: items.length, total })}
            </Text>
            <TouchableOpacity
              style={styles.refreshBtn}
              activeOpacity={0.85}
              accessibilityRole="button"
              accessibilityLabel={t('artifacts.refresh')}
              disabled={loadingMore}
              onPress={onRefresh}
            >
              <RefreshCw size={12} color={tk.text.primary} />
              <Text style={styles.refreshText}>{t('artifacts.refresh')}</Text>
            </TouchableOpacity>
          </View>
        ) : null}
      </ScrollView>
    </View>
  )
}
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
