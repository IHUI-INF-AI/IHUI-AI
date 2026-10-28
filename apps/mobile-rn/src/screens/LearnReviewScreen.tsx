// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

import { useCallback, useEffect, useMemo, useState } from 'react'
import {
  ActivityIndicator,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native'
import { useNavigation } from '@react-navigation/native'
import type { NativeStackNavigationProp } from '@react-navigation/native-stack'
import { Calendar, CheckCircle2 } from 'lucide-react-native'
import { fetchApi } from '@ihui/api-client'
import { rnRadius, rnSpacing, rnType } from '@ihui/design-tokens'
import { tokens } from '../theme/active-tokens'
import { NavBar } from '../components/NavBar'
import { NavChrome } from '../components/NavChrome'
import { useI18n } from '../i18n'
import type { RootStackParamList } from '../navigation/RootNavigator'

type NavigationProp = NativeStackNavigationProp<RootStackParamList>

/**
 * 每日复习 —— 对齐 web `/learn/review`。
 *
 * 契约按 apps/api/src/routes/srs-review.ts + services/srs-review-service.ts 现读:
 *  - `GET /api/srs-review/due` → `{ list, total, page, pageSize }`,行字段是
 *    `questionId / questionText / questionType / dueDate / easeFactor / interval / repetition`;
 *    **没有** question/answer/explanation/subject(web 页按这些字段渲染 ⇒ 三处恒 undefined)。
 *  - `GET /api/srs-review/stats` → `{ stats: { totalDue, totalReviewed, streak, avgEaseFactor } }`
 *    (web 页把外层当 stats 读 ⇒ 四个统计恒 0)。
 *  - `POST /api/srs-review/review` 的入参是 **questionId**(不是错题行 id)与 quality(0-5),
 *    响应 `{ success, nextReviewDate, interval, easeFactor, repetition }`。
 *  - 后端不返回答案/解析,故本屏只呈现题干与 SM-2 调度结果,不伪造"答案"块。
 */
interface ReviewQuestion {
  id: string
  questionId: string
  questionText: string
  questionType: string
  dueDate: string
  easeFactor: number
  interval: number
  repetition: number
}

interface ReviewStats {
  totalDue: number
  totalReviewed: number
  streak: number
  avgEaseFactor: number
}

interface ReviewResult {
  success: boolean
  nextReviewDate: string
  interval: number
  easeFactor: number
  repetition: number
}

interface QualityOption {
  value: number
  labelKey: string
  bg: string
  fg: string
}

const QUALITY_OPTIONS: QualityOption[] = [
  {
    value: 0,
    labelKey: 'learnReview.qualityForgotten',
    bg: tokens.danger.light,
    fg: tokens.danger.DEFAULT,
  },
  {
    value: 2,
    labelKey: 'learnReview.qualityFailed',
    bg: tokens.warning.orangeLight,
    fg: tokens.warning.amberText,
  },
  {
    value: 3,
    labelKey: 'learnReview.qualityUncertain',
    bg: tokens.warning.amberLight,
    fg: tokens.warning.amberText,
  },
  {
    value: 4,
    labelKey: 'learnReview.qualityGood',
    bg: tokens.success.light,
    fg: tokens.success.deepText,
  },
  {
    value: 5,
    labelKey: 'learnReview.qualityPerfect',
    bg: tokens.brandAccent.light,
    fg: tokens.brandAccent.deep,
  },
]

export default function LearnReviewScreen() {
  const { t, locale } = useI18n()
  const navigation = useNavigation<NavigationProp>()

  const [reviews, setReviews] = useState<ReviewQuestion[]>([])
  const [stats, setStats] = useState<ReviewStats | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [index, setIndex] = useState(0)
  const [submitting, setSubmitting] = useState(false)
  const [result, setResult] = useState<ReviewResult | null>(null)
  const [reviewedCount, setReviewedCount] = useState(0)
  const [submitError, setSubmitError] = useState('')

  const dateFmt = useMemo(
    () => new Intl.DateTimeFormat(locale, { month: '2-digit', day: '2-digit' }),
    [locale],
  )

  const load = useCallback(async () => {
    setLoading(true)
    setError('')
    try {
      const dueRes = await fetchApi<{ list: ReviewQuestion[]; total: number }>(
        '/api/srs-review/due?page=1&pageSize=20',
      )
      if (!dueRes.success) throw new Error(dueRes.error)
      setReviews(dueRes.data?.list ?? [])
      // 统计是辅助信息:它失败不该把整屏打成错误。
      const statsRes = await fetchApi<{ stats: ReviewStats }>('/api/srs-review/stats')
      if (statsRes.success) setStats(statsRes.data?.stats ?? null)
    } catch {
      setError(t('learnReview.loadFailed'))
    } finally {
      setLoading(false)
    }
  }, [t])

  useEffect(() => {
    void load()
  }, [load])

  const current = reviews[index]

  const submitQuality = async (quality: number) => {
    if (!current || submitting) return
    setSubmitting(true)
    setSubmitError('')
    try {
      const res = await fetchApi<ReviewResult>('/api/srs-review/review', {
        method: 'POST',
        body: JSON.stringify({ questionId: current.questionId, quality }),
      })
      if (!res.success) throw new Error(res.error)
      setResult(res.data)
      setReviewedCount((count) => count + 1)
    } catch {
      setSubmitError(t('learnReview.submitFailed'))
    } finally {
      setSubmitting(false)
    }
  }

  const nextQuestion = () => {
    setResult(null)
    setSubmitError('')
    setIndex((value) => value + 1)
  }

  const typeLabel = (type: string): string => {
    switch (type) {
      case 'single_choice':
        return t('learnReview.typeSingle')
      case 'multi_choice':
        return t('learnReview.typeMulti')
      case 'judgment':
        return t('learnReview.typeJudgment')
      case 'fill_blank':
        return t('learnReview.typeFill')
      case 'subjective':
        return t('learnReview.typeSubjective')
      default:
        return t('learnReview.typeUnknown')
    }
  }

  const progressDone = Math.min(index + (result ? 1 : 0), reviews.length)

  return (
    <View style={styles.container}>
      <NavChrome>
        <NavBar title={t('learnReview.title')} onBack={() => navigation.goBack()} />
      </NavChrome>

      <ScrollView contentContainerStyle={styles.body}>
        <Text style={styles.subtitle}>{t('learnReview.subtitle')}</Text>
        {loading ? (
          <View style={styles.stateBox}>
            <ActivityIndicator color={tokens.text.tertiary} />
            <Text style={styles.muted}>{t('learnReview.loading')}</Text>
          </View>
        ) : error ? (
          <View style={styles.errorBox}>
            <Text style={styles.errorText}>{error}</Text>
            <TouchableOpacity
              style={styles.retryBtn}
              onPress={() => void load()}
              activeOpacity={0.7}
            >
              <Text style={styles.retryText}>{t('learnReview.retry')}</Text>
            </TouchableOpacity>
          </View>
        ) : (
          <>
            <View style={styles.statsCard}>
              {[
                [t('learnReview.statDue'), String(stats?.totalDue ?? 0)],
                [t('learnReview.statReviewed'), String(reviewedCount)],
                [t('learnReview.statStreak'), String(stats?.streak ?? 0)],
                [t('learnReview.statEase'), stats ? stats.avgEaseFactor.toFixed(2) : '—'],
              ].map(([label, value]) => (
                <View key={label} style={styles.statCell}>
                  <Text style={styles.statValue}>{value}</Text>
                  <Text style={styles.statLabel}>{label}</Text>
                </View>
              ))}
            </View>
            {!current ? (
              <View style={styles.finishedCard}>
                <View style={styles.finishedIcon}>
                  <CheckCircle2 size={30} color={tokens.success.deep} />
                </View>
                <Text style={styles.finishedTitle}>
                  {reviews.length === 0
                    ? t('learnReview.emptyTitle')
                    : t('learnReview.finishedTitle')}
                </Text>
                <Text style={styles.muted}>
                  {reviews.length === 0
                    ? t('learnReview.emptyHint')
                    : t('learnReview.finishedHint', { count: reviewedCount })}
                </Text>
              </View>
            ) : (
              <View style={styles.card}>
                <View style={styles.questionHead}>
                  <Text style={styles.questionProgress}>
                    {t('learnReview.questionProgress', {
                      current: index + 1,
                      total: reviews.length,
                    })}
                  </Text>
                  <View style={styles.typeBadge}>
                    <Text style={styles.typeBadgeText}>{typeLabel(current.questionType)}</Text>
                  </View>
                </View>
                <View style={styles.questionBox}>
                  <Text style={styles.questionLabel}>{t('learnReview.questionLabel')}</Text>
                  <Text style={styles.questionText}>{current.questionText}</Text>
                </View>
                {result ? (
                  <View style={styles.resultArea}>
                    <View style={styles.resultGrid}>
                      {[
                        [
                          t('learnReview.nextReview'),
                          dateFmt.format(new Date(result.nextReviewDate)),
                        ],
                        [t('learnReview.intervalDays'), String(result.interval)],
                        [t('learnReview.easeFactor'), result.easeFactor.toFixed(2)],
                      ].map(([label, value]) => (
                        <View key={label} style={styles.resultCell}>
                          <Text style={styles.resultCellLabel}>{label}</Text>
                          <Text style={styles.resultCellValue}>{value}</Text>
                        </View>
                      ))}
                    </View>
                    <TouchableOpacity
                      style={styles.primaryBtn}
                      onPress={nextQuestion}
                      activeOpacity={0.7}
                    >
                      <Text style={styles.primaryBtnText}>{t('learnReview.nextQuestion')}</Text>
                    </TouchableOpacity>
                  </View>
                ) : (
                  <View style={styles.answerArea}>
                    <Text style={styles.answerLabel}>{t('learnReview.selfAssess')}</Text>
                    <View style={styles.qualityRow}>
                      {QUALITY_OPTIONS.map((option) => (
                        <TouchableOpacity
                          key={option.value}
                          style={[
                            styles.qualityBtn,
                            { backgroundColor: option.bg },
                            submitting && styles.disabled,
                          ]}
                          onPress={() => void submitQuality(option.value)}
                          disabled={submitting}
                          activeOpacity={0.7}
                        >
                          <Text style={[styles.qualityText, { color: option.fg }]}>
                            {t(option.labelKey)}
                          </Text>
                        </TouchableOpacity>
                      ))}
                    </View>
                    {submitting ? (
                      <View style={styles.inlineLoading}>
                        <ActivityIndicator size="small" color={tokens.text.tertiary} />
                        <Text style={styles.muted}>{t('learnReview.submitting')}</Text>
                      </View>
                    ) : null}
                    {submitError ? <Text style={styles.errorText}>{submitError}</Text> : null}
                  </View>
                )}
              </View>
            )}

            <View style={styles.progressLine}>
              <Calendar size={13} color={tokens.text.tertiary} />
              <Text style={styles.progressText}>
                {t('learnReview.progressLine', { done: progressDone, total: reviews.length })}
              </Text>
            </View>
          </>
        )}
      </ScrollView>
    </View>
  )
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: tokens.surface.bg },
  body: { padding: rnSpacing.md, paddingBottom: rnSpacing['3xl'], gap: 10 },
  subtitle: { fontSize: rnType.label.size, color: tokens.text.tertiary },
  stateBox: {
    alignItems: 'center',
    justifyContent: 'center',
    gap: rnSpacing.sm,
    paddingVertical: rnSpacing['5xl'],
  },
  muted: { fontSize: 13, color: tokens.text.secondary },
  errorBox: {
    padding: rnSpacing.md,
    gap: rnSpacing.sm,
    borderRadius: rnRadius.lg,
    borderWidth: 1,
    borderColor: tokens.danger.DEFAULT,
    backgroundColor: tokens.surface.card,
  },
  errorText: { fontSize: rnType.label.size, color: tokens.danger.DEFAULT },
  retryBtn: {
    alignSelf: 'flex-start',
    paddingHorizontal: 14,
    paddingVertical: 6,
    borderRadius: rnRadius.sm,
    borderWidth: 1,
    borderColor: tokens.border.medium,
  },
  retryText: { fontSize: 13, fontWeight: '600', color: tokens.text.primary },
  statsCard: {
    flexDirection: 'row',
    padding: rnSpacing.md,
    borderRadius: rnRadius.lg,
    borderWidth: 1,
    borderColor: tokens.border.light,
    backgroundColor: tokens.surface.card,
  },
  statCell: { flex: 1, alignItems: 'center', gap: 2 },
  statLabel: { fontSize: 10, color: tokens.text.tertiary, textAlign: 'center' },
  statValue: { fontSize: rnType.subtitle.size, fontWeight: '600', color: tokens.text.primary },
  finishedCard: {
    alignItems: 'center',
    gap: rnSpacing.sm,
    padding: rnSpacing['2xl'],
    borderRadius: rnRadius.lg,
    borderWidth: 1,
    borderColor: tokens.border.light,
    backgroundColor: tokens.surface.card,
  },
  finishedIcon: {
    width: 54,
    height: 54,
    borderRadius: rnRadius.lg,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: tokens.success.light,
  },
  finishedTitle: { fontSize: rnType.title.size, fontWeight: '600', color: tokens.text.primary },
  card: {
    gap: rnSpacing.md,
    padding: 14,
    borderRadius: rnRadius.lg,
    borderWidth: 1,
    borderColor: tokens.border.light,
    backgroundColor: tokens.surface.card,
  },
  questionHead: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  questionProgress: { fontSize: rnType.label.size, color: tokens.text.tertiary },
  typeBadge: {
    paddingHorizontal: rnSpacing.sm,
    paddingVertical: 2,
    borderRadius: rnRadius.md,
    backgroundColor: tokens.surface.muted,
  },
  typeBadgeText: { fontSize: rnType.caption.size, color: tokens.text.secondary },
  questionBox: {
    gap: 6,
    padding: rnSpacing.md,
    borderRadius: rnRadius.md,
    backgroundColor: tokens.surface.bg,
  },
  questionLabel: { fontSize: rnType.caption.size, color: tokens.text.tertiary },
  questionText: { fontSize: rnType.strong.size, lineHeight: 22, color: tokens.text.primary },
  answerArea: { gap: rnSpacing.sm },
  answerLabel: { fontSize: rnType.label.size, color: tokens.text.secondary },
  qualityRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 6 },
  qualityBtn: {
    paddingHorizontal: 10,
    paddingVertical: 7,
    borderRadius: rnRadius.sm,
  },
  qualityText: { fontSize: rnType.label.size, fontWeight: '600' },
  disabled: { opacity: 0.5 },
  inlineLoading: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  resultArea: { gap: 10 },
  resultGrid: { flexDirection: 'row', gap: 6 },
  resultCell: {
    flex: 1,
    alignItems: 'center',
    gap: 3,
    paddingVertical: rnSpacing.sm,
    borderRadius: rnRadius.sm,
    backgroundColor: tokens.surface.bg,
  },
  resultCellLabel: { fontSize: 10, color: tokens.text.tertiary, textAlign: 'center' },
  resultCellValue: { fontSize: 13, fontWeight: '600', color: tokens.text.primary },
  primaryBtn: {
    height: 42,
    borderRadius: rnRadius.sm,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: tokens.brand.cta,
  },
  primaryBtnText: {
    fontSize: rnType.body.size,
    fontWeight: '600',
    color: tokens.brand.ctaForeground,
  },
  progressLine: { flexDirection: 'row', alignItems: 'center', gap: 5, paddingTop: 2 },
  progressText: { fontSize: rnType.caption.size, color: tokens.text.tertiary },
})
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
