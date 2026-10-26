// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * 我的评论共享屏 — 对齐 web apps/web/app/(main)/student/my-comments/page.tsx。
 *
 * 纯展示:评论正文 + 目标类型(article/news/resource/lesson/ask 图标与本地化标签)+ 日期,
 * 分页(page/pageSize=20)、删除入口(确认弹窗由薄壳负责)。
 */
import { useMemo } from 'react'
import { BookOpen, FileText, MessageSquare, Newspaper, Trash2 } from 'lucide-react-native'
import type { LucideIcon } from 'lucide-react-native'
import { ScrollView, Text, TouchableOpacity, View } from 'react-native'
import type { TFunction } from '../../types'
import { getTokens } from '../../theme/tokens'
import { BackChevron } from '../../components/BackChevron'
import { createStudentStyles, STUDENT_PALETTE } from './student-styles'
import { ListPager } from './ListPager'

export interface MyCommentItem {
  id: string
  content: string
  targetId: string
  targetType: string
  targetTitle?: string | null
  createdAt: string
}

export interface MyCommentsScreenProps {
  t: TFunction
  colorScheme?: 'light' | 'dark'
  onBack: () => void
  loading?: boolean
  error?: string | null
  items?: MyCommentItem[]
  page?: number
  totalPages?: number
  onPageChange?: (page: number) => void
  onDelete?: (comment: MyCommentItem) => void
  deleting?: boolean
  onRefresh?: () => void
}

const TARGET_ICONS: Record<string, LucideIcon> = {
  article: Newspaper,
  news: Newspaper,
  resource: BookOpen,
  lesson: BookOpen,
  ask: FileText,
}

const TARGET_TYPE_KEYS: Record<string, string> = {
  article: 'myCommentsPage.typeArticle',
  news: 'myCommentsPage.typeNews',
  resource: 'myCommentsPage.typeResource',
  lesson: 'myCommentsPage.typeLesson',
  ask: 'myCommentsPage.typeAsk',
}

function formatDate(iso: string): string {
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return iso
  const pad = (n: number) => String(n).padStart(2, '0')
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`
}

export function MyCommentsScreen({
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
}: MyCommentsScreenProps) {
  const tk = getTokens(colorScheme)
  const styles = useMemo(() => createStudentStyles(tk), [tk])

  const header = (
    <View style={styles.header}>
      <BackChevron onPress={onBack} label={t('common.back')} colorScheme={colorScheme} />
      <Text style={styles.headerTitle}>{t('myCommentsPage.title')}</Text>
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
          <Text style={styles.heroTitle}>{t('myCommentsPage.title')}</Text>
          <Text style={styles.heroSubtitle}>{t('myCommentsPage.subtitle')}</Text>
        </View>

        {loading && items.length === 0 ? (
          <View style={styles.card}>
            <View style={styles.skeletonRow} />
            <View style={styles.skeletonRow} />
          </View>
        ) : items.length === 0 ? (
          <View style={styles.emptyBox}>
            <MessageSquare size={28} color={tk.text.tertiary} strokeWidth={2} />
            <Text style={styles.emptyText}>{t('studentPage.empty')}</Text>
          </View>
        ) : (
          <View style={styles.card}>
            {items.map((comment, idx) => {
              const Icon = TARGET_ICONS[comment.targetType] ?? FileText
              const typeKey = TARGET_TYPE_KEYS[comment.targetType]
              const typeLabel = typeKey ? t(typeKey) : comment.targetType
              return (
                <View
                  key={comment.id}
                  style={[styles.row, idx === items.length - 1 ? { borderBottomWidth: 0 } : null]}
                >
                  <View style={styles.rowMain}>
                    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                      <Icon size={14} color={tk.text.tertiary} strokeWidth={2} />
                      <Text style={styles.rowTitle} numberOfLines={1}>
                        {comment.targetTitle ?? typeLabel}
                      </Text>
                    </View>
                    <Text style={styles.rowBody}>{comment.content}</Text>
                    <View style={styles.rowMeta}>
                      <Text style={styles.rowSub}>
                        {t('myCommentsPage.targetLabel')}: {typeLabel}
                      </Text>
                      <Text style={styles.rowSub}>{formatDate(comment.createdAt)}</Text>
                    </View>
                  </View>
                  <TouchableOpacity
                    style={styles.iconBtn}
                    activeOpacity={0.85}
                    disabled={deleting}
                    accessibilityRole="button"
                    accessibilityLabel={t('studentPage.delete')}
                    onPress={() => onDelete?.(comment)}
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
