// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * 我的资源共享屏 — 对齐 web apps/web/app/(main)/student/my-resources/page.tsx。
 *
 * 纯展示:我上传的资源(标题/简介/浏览数/下载数/文件类型/大小/日期)+ 状态四档
 * (0 待审核 amber / 1 已发布 emerald / 2 已下架 muted / 3 已驳回 rose),
 * 分页 page/pageSize=20、删除入口(确认弹窗由薄壳负责)。
 */
import { useMemo } from 'react'
import { Download, Eye, FileText, Trash2 } from 'lucide-react-native'
import { ScrollView, Text, TouchableOpacity, View } from 'react-native'
import type { TFunction } from '../../types'
import { getTokens } from '../../theme/tokens'
import { BackChevron } from '../../components/BackChevron'
import { createStudentStyles, STUDENT_PALETTE, type StudentTone } from './student-styles'
import { ListPager } from './ListPager'

export interface MyResourceItem {
  id: string
  title: string
  description?: string | null
  fileType?: string | null
  fileSize?: number | null
  viewCount: number
  downloadCount: number
  status: number
  createdAt: string
}

export interface MyResourcesScreenProps {
  t: TFunction
  colorScheme?: 'light' | 'dark'
  onBack: () => void
  loading?: boolean
  error?: string | null
  items?: MyResourceItem[]
  page?: number
  totalPages?: number
  onPageChange?: (page: number) => void
  onDelete?: (resource: MyResourceItem) => void
  deleting?: boolean
  onRefresh?: () => void
}

function resourceTone(status: number): StudentTone {
  if (status === 1) return 'completed'
  if (status === 2) return 'muted'
  if (status === 3) return 'rejected'
  return 'pending'
}

function resourceToneLabelKey(status: number): string {
  if (status === 1) return 'myResourcesPage.statusPublished'
  if (status === 2) return 'myResourcesPage.statusOffline'
  if (status === 3) return 'myResourcesPage.statusRejected'
  return 'myResourcesPage.statusPending'
}

function formatSize(bytes?: number | null): string {
  if (!bytes) return '-'
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`
  if (bytes < 1024 * 1024 * 1024) return `${(bytes / 1024 / 1024).toFixed(1)} MB`
  return `${(bytes / 1024 / 1024 / 1024).toFixed(1)} GB`
}

function formatDate(iso: string): string {
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return iso
  const pad = (n: number) => String(n).padStart(2, '0')
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`
}

export function MyResourcesScreen({
  t,
  onBack,
  colorScheme = 'light',
  loading = false,
  error = null,
  items = [],
  page = 1,
  totalPages = 1,
  onPageChange,
  onDelete,
  deleting = false,
  onRefresh,
}: MyResourcesScreenProps) {
  const tk = getTokens(colorScheme)
  const styles = useMemo(() => createStudentStyles(tk), [tk])

  const header = (
    <View style={styles.header}>
      <BackChevron onPress={onBack} label={t('common.back')} colorScheme={colorScheme} />
      <Text style={styles.headerTitle}>{t('myResourcesPage.title')}</Text>
    </View>
  )

  if (error && !loading) {
    return (
      <View style={styles.container}>
        {header}
        <View style={[styles.card, styles.errorBox]}>
          <Text style={styles.errorText}>{error}</Text>
          {onRefresh ? (
            <TouchableOpacity
              style={styles.refreshBtn}
              activeOpacity={0.85}
              accessibilityRole="button"
              accessibilityLabel={t('studentPage.retry')}
              onPress={onRefresh}
            >
              <Text style={styles.refreshText}>{t('studentPage.retry')}</Text>
            </TouchableOpacity>
          ) : null}
        </View>
      </View>
    )
  }

  return (
    <View style={styles.container}>
      {header}
      <ScrollView contentContainerStyle={styles.scroll}>
        <View style={styles.hero}>
          <Text style={styles.heroTitle}>{t('myResourcesPage.title')}</Text>
          <Text style={styles.heroSubtitle}>{t('myResourcesPage.subtitle')}</Text>
        </View>

        {loading && items.length === 0 ? (
          <View style={styles.card}>
            <View style={styles.skeletonRow} />
            <View style={styles.skeletonRow} />
          </View>
        ) : items.length === 0 ? (
          <View style={styles.emptyBox}>
            <FileText size={28} color={tk.text.tertiary} strokeWidth={2} />
            <Text style={styles.emptyText}>{t('studentPage.empty')}</Text>
          </View>
        ) : (
          <View style={styles.card}>
            {items.map((resource, idx) => {
              const tone = STUDENT_PALETTE[resourceTone(resource.status)]
              return (
                <View
                  key={resource.id}
                  style={[styles.row, idx === items.length - 1 ? { borderBottomWidth: 0 } : null]}
                >
                  <View style={styles.rowMain}>
                    <View style={styles.cardHead}>
                      <Text style={styles.rowTitle} numberOfLines={1}>
                        {resource.title}
                      </Text>
                      <View style={[styles.badge, { backgroundColor: tone.bg }]}>
                        <Text style={[styles.badgeText, { color: tone.fg }]}>
                          {t(resourceToneLabelKey(resource.status))}
                        </Text>
                      </View>
                    </View>
                    {resource.description ? (
                      <Text style={styles.rowBody} numberOfLines={2}>
                        {resource.description}
                      </Text>
                    ) : null}
                    <View style={styles.rowMeta}>
                      <View style={styles.metaItem}>
                        <Eye size={12} color={tk.text.tertiary} strokeWidth={2} />
                        <Text style={styles.metaText}>{resource.viewCount}</Text>
                      </View>
                      <View style={styles.metaItem}>
                        <Download size={12} color={tk.text.tertiary} strokeWidth={2} />
                        <Text style={styles.metaText}>{resource.downloadCount}</Text>
                      </View>
                      {resource.fileType ? (
                        <Text style={styles.metaText}>{resource.fileType}</Text>
                      ) : null}
                      {resource.fileSize !== null && resource.fileSize !== undefined ? (
                        <Text style={styles.metaText}>{formatSize(resource.fileSize)}</Text>
                      ) : null}
                      <Text style={styles.metaText}>{formatDate(resource.createdAt)}</Text>
                    </View>
                  </View>
                  <TouchableOpacity
                    style={styles.iconBtn}
                    activeOpacity={0.85}
                    disabled={deleting}
                    accessibilityRole="button"
                    accessibilityLabel={t('studentPage.delete')}
                    onPress={() => onDelete?.(resource)}
                  >
                    <Trash2 size={16} color={STUDENT_PALETTE.rejected.fg} strokeWidth={2} />
                  </TouchableOpacity>
                </View>
              )
            })}
          </View>
        )}

        <ListPager
          t={t}
          page={page}
          totalPages={totalPages}
          onPageChange={(p) => onPageChange?.(p)}
          styles={styles}
        />
      </ScrollView>
    </View>
  )
}
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
