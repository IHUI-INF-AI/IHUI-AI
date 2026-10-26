// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * 我的课程共享屏 — 对齐 web apps/web/app/(main)/student/my-lessons/page.tsx。
 *
 * 纯展示:课时封面缩略图 + 标题 + 学习进度条(progress 钳 0-100)+ 状态三档
 * (1 进行中 amber / 2 已完成 emerald / 3 已退款 muted),分页 page/pageSize=20。
 */
import { useMemo } from 'react'
import { BookOpen } from 'lucide-react-native'
import { Image, ScrollView, Text, TouchableOpacity, View } from 'react-native'
import type { TFunction } from '../../types'
import { getTokens } from '../../theme/tokens'
import { BackChevron } from '../../components/BackChevron'
import { createStudentStyles, STUDENT_PALETTE, type StudentTone } from './student-styles'
import { ListPager } from './ListPager'

export interface MyLessonItem {
  id: string
  lessonId: string
  title: string
  coverImage: string | null
  progress: number
  status: number
}

export interface MyLessonsScreenProps {
  t: TFunction
  colorScheme?: 'light' | 'dark'
  onBack: () => void
  loading?: boolean
  error?: string | null
  items?: MyLessonItem[]
  page?: number
  totalPages?: number
  onPageChange?: (page: number) => void
  onRefresh?: () => void
}

function lessonTone(status: number): StudentTone {
  if (status === 2) return 'completed'
  if (status === 3) return 'muted'
  return 'pending'
}

function lessonToneLabelKey(status: number): string {
  if (status === 2) return 'myLessonsPage.statusCompleted'
  if (status === 3) return 'myLessonsPage.statusRefunded'
  return 'myLessonsPage.statusInProgress'
}

export function MyLessonsScreen({
  t,
  onBack,
  colorScheme = 'light',
  loading = false,
  error = null,
  items = [],
  page = 1,
  totalPages = 1,
  onPageChange,
  onRefresh,
}: MyLessonsScreenProps) {
  const tk = getTokens(colorScheme)
  const styles = useMemo(() => createStudentStyles(tk), [tk])

  const header = (
    <View style={styles.header}>
      <BackChevron onPress={onBack} label={t('common.back')} colorScheme={colorScheme} />
      <Text style={styles.headerTitle}>{t('myLessonsPage.title')}</Text>
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
          <Text style={styles.heroTitle}>{t('myLessonsPage.title')}</Text>
        </View>

        {loading && items.length === 0 ? (
          <View style={styles.card}>
            <View style={styles.skeletonRow} />
            <View style={styles.skeletonRow} />
          </View>
        ) : items.length === 0 ? (
          <View style={styles.emptyBox}>
            <BookOpen size={28} color={tk.text.tertiary} strokeWidth={2} />
            <Text style={styles.emptyText}>{t('studentPage.empty')}</Text>
          </View>
        ) : (
          <View style={styles.card}>
            {items.map((item, idx) => {
              const progress = Math.min(100, Math.max(0, Math.round(item.progress ?? 0)))
              const tone = STUDENT_PALETTE[lessonTone(item.status)]
              return (
                <View
                  key={item.id}
                  style={[styles.row, idx === items.length - 1 ? { borderBottomWidth: 0 } : null]}
                >
                  {item.coverImage ? (
                    <Image
                      source={{ uri: item.coverImage }}
                      style={styles.thumb}
                      resizeMode="cover"
                    />
                  ) : (
                    <View style={styles.thumbPlaceholder}>
                      <BookOpen size={18} color={tk.text.tertiary} strokeWidth={2} />
                    </View>
                  )}
                  <View style={styles.rowMain}>
                    <Text style={styles.rowTitle} numberOfLines={2}>
                      {item.title}
                    </Text>
                    <Text style={styles.rowSub}>
                      {t('myLessonsPage.progressLabel', { value: progress })}
                    </Text>
                    <View style={styles.progressTrack}>
                      <View style={[styles.progressFill, { width: `${progress}%` }]} />
                    </View>
                    <View style={[styles.badge, { backgroundColor: tone.bg }]}>
                      <Text style={[styles.badgeText, { color: tone.fg }]}>
                        {t(lessonToneLabelKey(item.status))}
                      </Text>
                    </View>
                  </View>
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
