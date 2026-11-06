// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

import { useMemo } from 'react'
import { ScrollView, Text, View, StyleSheet } from 'react-native'
import { getTokens, type AppThemeTokens } from '../../theme/tokens'
import type { ExamResultItem, ExamResultScreenProps } from '../../types'

import { rnRadius, rnSpacing, rnType } from '@ihui/design-tokens'
import { usePublishShareIntent } from '@ihui/shared/share'
import { BackChevron } from '../../components/BackChevron'
import { ErrorState, ScreenSkeleton } from '../../components/ScreenStates'
import { assertRequiredPort, isPortErrorState } from '../../host/ports'
import { ExamResultActions, ExamResultReviewList, ExamResultStats } from './exam-result-sections'

/** ExamResult 共享屏 — props 注入式跨端组件(纯 UI,不依赖平台 API) */
export type { ExamResultItem, ExamResultScreenProps }

export function ExamResultScreen({
  t,
  item,
  loading,
  error,
  onBack,
  onRetry,
  colorScheme = 'light',
  onNavigate,
  shareAction,
}: ExamResultScreenProps & { onRetry?: () => void }) {
  const navigate = assertRequiredPort('onNavigate', onNavigate)

  const tk = getTokens(colorScheme)
  const styles = useMemo(() => createStyles(tk), [tk])
  // 分享正文交给宿主。path 是**列表页**而非本页 ⇒ 必须显式发布,交宿主兜底会把落点改成成绩页自己。
  usePublishShareIntent({
    title: item ? t('examResult.shareTitle', { n: item.score }) : t('share.appTitle'),
    path: '/pages/exam/list',
  })

  // 底部三操作里的两个导航动作:逻辑 target 由宿主映射,屏内不调平台 API。
  const goRetry = () => {
    if (!item?.examId) return onBack()
    if (isPortErrorState(navigate)) return
    navigate('ExamQuestion', { examId: item.examId })
  }
  const goList = () => {
    if (isPortErrorState(navigate)) return
    navigate('Exam')
  }

  if (loading) {
    return <ScreenSkeleton variant="card" count={3} colorScheme={colorScheme} />
  }
  if (error || !item) {
    return (
      <View style={styles.container}>
        <BackChevron onPress={onBack} label={t('common.back')} colorScheme={colorScheme} />
        <ErrorState
          message={error || t('examResult.loadFailed')}
          onRetry={onRetry}
          retryLabel={t('common.retry')}
          colorScheme={colorScheme}
        />
      </View>
    )
  }

  return (
    <View style={styles.container}>
      <ScrollView contentContainerStyle={styles.content}>
        <BackChevron onPress={onBack} label={t('common.back')} colorScheme={colorScheme} />
        {item.examTitle ? <Text style={styles.title}>{item.examTitle}</Text> : null}
        <View
          style={[styles.scoreCard, item.passed ? styles.scoreCardPassed : styles.scoreCardFailed]}
        >
          <Text style={styles.scoreText}>
            {item.totalScore > 0 ? `${item.score}/${item.totalScore}` : String(item.score)}
          </Text>
          <Text style={item.passed ? styles.passedText : styles.failedText}>
            {item.passed ? t('examResult.passed') : t('examResult.failed')}
          </Text>
        </View>
        <ExamResultStats item={item} t={t} colorScheme={colorScheme} />
        {item.rank ? (
          <Text style={styles.rank}>
            {t('examResult.rank', { rank: item.rank, total: item.rankTotal ?? 0 })}
          </Text>
        ) : null}
        {item.submittedAt ? <Text style={styles.submittedAt}>{item.submittedAt}</Text> : null}
        <ExamResultReviewList reviews={item.details ?? []} t={t} colorScheme={colorScheme} />
      </ScrollView>
      <View style={styles.footer}>
        <ExamResultActions
          t={t}
          colorScheme={colorScheme}
          onRetryExam={goRetry}
          onViewList={goList}
          shareAction={shareAction}
        />
      </View>
    </View>
  )
}

function createStyles(tk: AppThemeTokens) {
  return StyleSheet.create({
    container: { flex: 1, backgroundColor: tk.surface.bg },
    content: { paddingHorizontal: rnSpacing['sm-loose'], paddingBottom: rnSpacing['3xl'] },
    title: {
      marginTop: rnSpacing.sm,
      marginBottom: rnSpacing.md,
      fontSize: rnType.heading.size,
      fontWeight: '600',
      color: tk.text.primary,
    },
    scoreCard: {
      padding: rnSpacing['md-loose'],
      borderRadius: rnRadius.lg,
      borderWidth: 1,
      alignItems: 'center',
      marginBottom: rnSpacing.md,
    },
    scoreCardPassed: { borderColor: tk.brandAccent.deep, backgroundColor: tk.success.light },
    scoreCardFailed: { borderColor: tk.border.light },
    scoreText: { fontSize: rnType.displayLg.size, fontWeight: '700', color: tk.text.primary },
    passedText: {
      marginTop: rnSpacing.sm,
      fontSize: rnType.title.size,
      fontWeight: '600',
      color: tk.brand.DEFAULT,
    },
    failedText: {
      marginTop: rnSpacing.sm,
      fontSize: rnType.title.size,
      fontWeight: '600',
      color: tk.danger.DEFAULT,
    },
    rank: {
      fontSize: rnType.caption.size,
      color: tk.text.tertiary,
      marginBottom: rnSpacing.sm,
    },
    submittedAt: {
      fontSize: rnType.caption.size,
      color: tk.text.tertiary,
      marginBottom: rnSpacing.lg,
    },
    footer: {
      borderTopWidth: 1,
      borderTopColor: tk.border.light,
      backgroundColor: tk.surface.light,
      paddingHorizontal: rnSpacing['sm-loose'],
      paddingBottom: rnSpacing.md,
      paddingTop: rnSpacing.xs,
    },
  })
}
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
