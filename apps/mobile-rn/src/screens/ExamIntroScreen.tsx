// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * RN 端「试卷介绍」薄壳 —— 渲染全部委托共享屏
 * `packages/app/src/features/exam-intro/ExamIntroScreen.tsx`(真消费点)。
 *
 * 本文件只做平台侧:取数(getExamById / getMyRecords,与小程序页同一数据面)、
 * 统计/规则/历史取词、进入答题页导航。共享屏本身零取数/零导航/零取词。
 * 不展示「参与人数/已通过」:api-client 无对应端点,不做无数据源的编造(web 端同样不传)。
 */

import { useEffect, useCallback, useState } from 'react'
import { useNavigation, useRoute } from '@react-navigation/native'
import type { NativeStackNavigationProp } from '@react-navigation/native-stack'
import type { RouteProp } from '@react-navigation/native'
import { getExamById, getMyRecords, type Exam, type ExamResult } from '@ihui/api-client'
import { apiFailureToText } from '@ihui/shared/utils'
import { ExamIntroScreen as SharedExamIntroScreen } from '@ihui/rn-app'
import type { ExamIntroHistoryRow } from '@ihui/rn-app/features/exam-intro/ExamIntroScreen'
import { useI18n } from '../i18n'
import { useTheme } from '../context/ThemeContext'
import { formatDateByTemplate } from '../utils/date-utils'
import type { RootStackParamList } from '../navigation/RootNavigator'

type NavigationProp = NativeStackNavigationProp<RootStackParamList>
type ExamIntroRoute = RouteProp<RootStackParamList, 'ExamIntro'>

const formatTime = (v: string): string => {
  if (!v) return '-'
  // 10 位字符串时间戳(秒级)→ 乘 1000 转毫秒;否则原样传给 formatDateByTemplate
  const input = v.length === 10 ? Number(v) * 1000 : v
  const formatted = formatDateByTemplate(input, 'YYYY-MM-DD')
  return formatted || v
}

export function ExamIntroScreen() {
  const { t } = useI18n()
  const { resolvedTheme } = useTheme()
  const navigation = useNavigation<NavigationProp>()
  const route = useRoute<ExamIntroRoute>()
  const id = route.params?.id ?? ''
  const [exam, setExam] = useState<Exam | null>(null)
  const [questionCount, setQuestionCount] = useState(0)
  const [history, setHistory] = useState<ExamResult[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  const load = useCallback(async () => {
    if (!id) {
      setError(t('exam.detail.loadFailed'))
      setLoading(false)
      return
    }
    setLoading(true)
    setError('')
    const [paperRes, recordsRes] = await Promise.all([
      getExamById(id),
      getMyRecords({ examId: id, page: 1, pageSize: 5 }),
    ])
    if (paperRes.success) {
      setExam(paperRes.data.exam)
      setQuestionCount(paperRes.data.questions?.length ?? 0)
    } else {
      setError(apiFailureToText(paperRes, t('exam.detail.loadFailed')))
    }
    if (recordsRes.success) {
      setHistory((recordsRes.data.list ?? []).filter((r) => r.examId === id))
    } else {
      setHistory([])
    }
    setLoading(false)
  }, [id, t])

  useEffect(() => {
    void load()
  }, [load])

  const stats = [
    {
      label: t('exam.detail.questionCount'),
      value: t('exam.detail.questionCountValue', { n: questionCount }),
    },
    {
      label: t('exam.detail.totalScore'),
      value: t('exam.detail.totalScoreValue', { n: Number(exam?.totalScore) || 0 }),
    },
    {
      label: t('exam.detail.duration'),
      value: t('exam.detail.durationValue', { n: exam?.duration ?? 0 }),
    },
    {
      label: t('exam.detail.passScore'),
      value: t('exam.detail.passScoreValue', { n: Number(exam?.passScore) || 0 }),
    },
  ]

  const rules = {
    title: t('exam.detail.rulesTitle'),
    items: [
      t('exam.detail.rule1'),
      t('exam.detail.rule2'),
      t('exam.detail.rule3'),
      t('exam.detail.notice1'),
      t('exam.detail.notice2'),
    ],
  }

  const historyItems: ExamIntroHistoryRow[] = history.map((h, i) => ({
    key: `${h.examId}-${h.submittedAt}-${i}`,
    statusText: h.isPassed ? t('exam.detail.historyPassed') : t('exam.detail.historyNotPassed'),
    timeText: t('exam.detail.historyTime', { time: formatTime(h.submittedAt) }),
    scoreText: t('exam.detail.historyScoreValue', { n: Number(h.score) || 0 }),
    passed: Boolean(h.isPassed),
  }))

  const ready = !loading && Boolean(exam?.title)

  return (
    <SharedExamIntroScreen
      headerTitle={t('exam.detail.pageTitle')}
      title={exam?.title || ''}
      description={exam?.description || undefined}
      stats={stats}
      rules={rules}
      history={{
        title: t('exam.detail.historyTitle'),
        emptyText: t('exam.detail.historyEmpty'),
        items: historyItems,
      }}
      state={loading ? 'loading' : ready ? 'ready' : 'error'}
      loadingText={t('exam.detail.loading')}
      errorText={ready || loading ? '' : error || t('exam.detail.loadFailed')}
      retryText={t('exam.detail.retry')}
      startText={t('exam.detail.start')}
      startingText={t('exam.detail.starting')}
      starting={false}
      onStart={() => {
        if (id) navigation.navigate('ExamQuestion', { examId: id })
      }}
      onRetry={() => {
        void load()
      }}
      onBack={() => navigation.goBack()}
      colorScheme={resolvedTheme}
    />
  )
}
