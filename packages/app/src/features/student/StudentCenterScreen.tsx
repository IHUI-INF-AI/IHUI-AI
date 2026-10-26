// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * 学生中心(学习报告)共享屏 — 对齐 web apps/web/app/(main)/student/page.tsx。
 *
 * 纯展示:报告统计(GET /api/edu/my-report 的 lessons/exams/certificates 三组指标)、
 * 报告导出三键(pdf/excel/json,对应 web :71-88 DropdownMenu)、六个快捷入口(:81-88)。
 * 取数/导出/导航由 RN 薄壳注入。
 */
import { useMemo } from 'react'
import {
  Award,
  BarChart3,
  BookOpen,
  CalendarClock,
  FileJson,
  FileSpreadsheet,
  FileText,
  ScrollText,
  StickyNote,
  XCircle,
} from 'lucide-react-native'
import type { LucideIcon } from 'lucide-react-native'
import { ActivityIndicator, ScrollView, Text, TouchableOpacity, View } from 'react-native'
import type { TFunction } from '../../types'
import { getTokens } from '../../theme/tokens'
import { BackChevron } from '../../components/BackChevron'
import { createStudentStyles, STUDENT_PALETTE } from './student-styles'

export type StudentReportFormat = 'pdf' | 'excel' | 'json'

export type StudentQuickLinkKey =
  'myLessons' | 'myNotes' | 'myCertificates' | 'wrongBook' | 'offlineRecords' | 'myPapers'

export interface StudentReportData {
  lessons: { total: number; completed: number; inProgress: number; avgProgress: number }
  exams: { total: number; passed: number; avgScore: number }
  certificates: { total: number }
}

export interface StudentCenterScreenProps {
  t: TFunction
  colorScheme?: 'light' | 'dark'
  onBack: () => void
  loading?: boolean
  error?: string | null
  data?: StudentReportData
  onRefresh?: () => void
  onExport?: (format: StudentReportFormat) => void
  exporting?: boolean
  onQuickLink?: (key: StudentQuickLinkKey) => void
}

const QUICK_LINKS: Array<{ key: StudentQuickLinkKey; icon: LucideIcon }> = [
  { key: 'myLessons', icon: BookOpen },
  { key: 'myNotes', icon: StickyNote },
  { key: 'myCertificates', icon: Award },
  { key: 'wrongBook', icon: XCircle },
  { key: 'offlineRecords', icon: CalendarClock },
  { key: 'myPapers', icon: FileText },
]

const EXPORT_FORMATS: Array<{ format: StudentReportFormat; icon: LucideIcon; labelKey: string }> = [
  { format: 'pdf', icon: FileText, labelKey: 'studentPage.exportPdf' },
  { format: 'excel', icon: FileSpreadsheet, labelKey: 'studentPage.exportExcel' },
  { format: 'json', icon: FileJson, labelKey: 'studentPage.exportJson' },
]

function StatCard({
  label,
  value,
  icon: Icon,
  tone,
  styles,
}: {
  label: string
  value: string | number
  icon: LucideIcon
  tone?: 'completed' | 'brand'
  styles: ReturnType<typeof createStudentStyles>
}) {
  const valueStyle =
    tone === 'completed'
      ? styles.statValueCompleted
      : tone === 'brand'
        ? styles.statValueBrand
        : styles.statValue
  return (
    <View style={styles.statCard}>
      <View style={styles.statHead}>
        <Text style={styles.statLabel}>{label}</Text>
        <Icon size={14} color={STUDENT_PALETTE.muted.fg} strokeWidth={2} />
      </View>
      <Text style={valueStyle}>{value}</Text>
    </View>
  )
}

export function StudentCenterScreen({
  t,
  onBack,
  colorScheme = 'light',
  loading = false,
  error = null,
  data,
  onRefresh,
  onExport,
  exporting = false,
  onQuickLink,
}: StudentCenterScreenProps) {
  const tk = getTokens(colorScheme)
  const styles = useMemo(() => createStudentStyles(tk), [tk])

  const header = (
    <View style={styles.header}>
      <BackChevron onPress={onBack} label={t('common.back')} colorScheme={colorScheme} />
      <Text style={styles.headerTitle}>{t('studentPage.title')}</Text>
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

  if (loading && !data) {
    return (
      <View style={styles.container}>
        {header}
        <ScrollView contentContainerStyle={styles.scroll}>
          <View style={styles.skeletonTitle} />
          <View style={styles.card}>
            <View style={styles.skeletonRow} />
            <View style={styles.skeletonRow} />
          </View>
        </ScrollView>
      </View>
    )
  }

  const lessons = data!.lessons
  const exams = data!.exams
  const certs = data!.certificates

  return (
    <View style={styles.container}>
      {header}
      <ScrollView contentContainerStyle={styles.scroll}>
        <View style={styles.hero}>
          <Text style={styles.heroTitle}>{t('studentPage.title')}</Text>
          <Text style={styles.heroSubtitle}>{t('studentPage.subtitle')}</Text>
        </View>

        <View style={styles.card}>
          <View style={styles.cardHead}>
            <Text style={styles.sectionTitle}>{t('studentPage.exportReport')}</Text>
            {exporting ? <ActivityIndicator size="small" color={tk.text.tertiary} /> : null}
          </View>
          <View style={styles.exportRow}>
            {EXPORT_FORMATS.map(({ format, icon: Icon, labelKey }) => (
              <TouchableOpacity
                key={format}
                style={styles.exportBtn}
                activeOpacity={0.85}
                disabled={exporting || !onExport}
                accessibilityRole="button"
                accessibilityLabel={t(labelKey)}
                onPress={() => onExport?.(format)}
              >
                <Icon size={14} color={tk.text.secondary} strokeWidth={2} />
                <Text style={styles.exportBtnText}>{t(labelKey)}</Text>
              </TouchableOpacity>
            ))}
          </View>
        </View>

        <View style={styles.card}>
          <View style={styles.cardHead}>
            <BookOpen size={18} color={tk.brand.DEFAULT} strokeWidth={2} />
            <Text style={styles.sectionTitle}>{t('studentPage.lessons')}</Text>
          </View>
          <View style={styles.statGrid}>
            <StatCard
              label={t('studentPage.totalLessons')}
              value={lessons.total}
              icon={BookOpen}
              styles={styles}
            />
            <StatCard
              label={t('studentPage.completedLessons')}
              value={lessons.completed}
              icon={Award}
              tone="completed"
              styles={styles}
            />
            <StatCard
              label={t('studentPage.inProgressLessons')}
              value={lessons.inProgress}
              icon={BarChart3}
              tone="brand"
              styles={styles}
            />
            <StatCard
              label={t('studentPage.avgProgress')}
              value={`${lessons.avgProgress}%`}
              icon={BarChart3}
              styles={styles}
            />
          </View>
        </View>

        <View style={styles.card}>
          <View style={styles.cardHead}>
            <BarChart3 size={18} color={tk.brand.DEFAULT} strokeWidth={2} />
            <Text style={styles.sectionTitle}>{t('studentPage.exams')}</Text>
          </View>
          <View style={styles.statGrid}>
            <StatCard
              label={t('studentPage.totalExams')}
              value={exams.total}
              icon={BarChart3}
              styles={styles}
            />
            <StatCard
              label={t('studentPage.passedExams')}
              value={exams.passed}
              icon={Award}
              tone="completed"
              styles={styles}
            />
            <StatCard
              label={t('studentPage.avgScore')}
              value={exams.avgScore}
              icon={BarChart3}
              styles={styles}
            />
          </View>
        </View>

        <View style={styles.card}>
          <View style={styles.cardHead}>
            <Award size={18} color={tk.brand.DEFAULT} strokeWidth={2} />
            <Text style={styles.sectionTitle}>{t('studentPage.certificates')}</Text>
          </View>
          <View style={styles.statGrid}>
            <StatCard
              label={t('studentPage.totalCerts')}
              value={certs.total}
              icon={Award}
              styles={styles}
            />
          </View>
        </View>

        <View style={styles.card}>
          <View style={styles.cardHead}>
            <ScrollText size={18} color={tk.brand.DEFAULT} strokeWidth={2} />
            <Text style={styles.sectionTitle}>{t('studentPage.quickLinks')}</Text>
          </View>
          <View style={styles.quickGrid}>
            {QUICK_LINKS.map(({ key, icon: Icon }) => (
              <TouchableOpacity
                key={key}
                style={styles.quickItem}
                activeOpacity={0.85}
                accessibilityRole="button"
                accessibilityLabel={t(`studentPage.${key}`)}
                onPress={() => onQuickLink?.(key)}
              >
                <View style={styles.quickIconBox}>
                  <Icon size={18} color={tk.brandAccent.deep} strokeWidth={2} />
                </View>
                <Text style={styles.quickText}>{t(`studentPage.${key}`)}</Text>
              </TouchableOpacity>
            ))}
          </View>
        </View>

        {loading ? (
          <View style={{ paddingVertical: 8 }}>
            <ActivityIndicator color={tk.text.secondary} />
          </View>
        ) : null}
      </ScrollView>
    </View>
  )
}
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
