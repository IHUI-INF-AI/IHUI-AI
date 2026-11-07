// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

// 镜像 packages/app/src/features/exam-result/ExamResultScreen.tsx(直载共享屏 + 注入本端事实)
//
// 本端保留(不可丢的业务):
//   ① 记录详情 GET /exam/records/:id(全量解析 details + examId)
//   ② 名次摘要 GET /exam/:id/result(rank/total) —— 与小程序 `getExamResult` 同一后端端点
//   ③ 底部三操作的宿主能力:再考一次(ExamQuestion)、查看列表(Exam)、分享(react-native Share)
// 统计/解析/rank/底部操作的真实渲染在共享屏与其 sections,本端零重复 UI。

import { useEffect, useState } from 'react'
import { Share } from 'react-native'
import { useTheme } from '../context/ThemeContext'
import { useNavigation, useRoute, type RouteProp } from '@react-navigation/native'
import type { NativeStackNavigationProp } from '@react-navigation/native-stack'
import { getResult, getExamResultSummary } from '@ihui/api-client'
import { apiFailureToText } from '@ihui/shared/utils'
import { ExamResultScreen as SharedExamResultScreen, type ExamResultItem } from '@ihui/rn-app'
import { useI18n } from '../i18n'
import type { RootStackParamList } from '../navigation/RootNavigator'
import { useHostPorts } from '../host/use-host-ports'

type Route = RouteProp<RootStackParamList, 'ExamResult'>
type NavigationProp = NativeStackNavigationProp<RootStackParamList>

export function ExamResultScreen() {
  const { resolvedTheme } = useTheme()
  const { t } = useI18n()
  const route = useRoute<Route>()
  const navigation = useNavigation<NavigationProp>()
  const { id } = route.params
  const [result, setResult] = useState<ExamResultItem | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [reloadKey, setReloadKey] = useState(0)
  const reload = () => setReloadKey((key) => key + 1)

  useEffect(() => {
    let cancelled = false
    void (async () => {
      setLoading(true)
      setError('')
      // 名次只存在于摘要端点;它失败不阻塞主数据(详情仍可展示,只是没有 rank 段)
      const [recordRes, summaryRes] = await Promise.all([getResult(id), getExamResultSummary(id)])
      if (cancelled) return
      if (!recordRes.success) {
        setResult(null)
        setError(apiFailureToText(recordRes, t('examResult.loadFailed')))
        setLoading(false)
        return
      }
      const record = recordRes.data
      const summary = summaryRes.success ? summaryRes.data : null
      const wrongCount = summary?.wrong ?? record.wrongCount
      const unansweredCount = summary?.unanswered ?? record.unansweredCount
      setResult({
        id,
        examId: record.examId,
        score: record.score,
        totalScore: record.totalScore,
        passed: record.isPassed,
        correctCount: record.correctCount,
        wrongCount,
        unansweredCount,
        totalCount: record.correctCount + wrongCount + unansweredCount,
        duration: summary?.duration ?? record.duration,
        submittedAt: record.submittedAt,
        rank: summary?.rank,
        rankTotal: summary?.total,
        details: record.details.map((detail) => ({
          id: detail.questionId,
          title: detail.title,
          yourAnswer: detail.userAnswer,
          correctAnswer: detail.correctAnswer,
          isCorrect: detail.isCorrect,
          score: detail.score,
          analysis: detail.analysis,
        })),
      })
      setLoading(false)
    })()
    return () => {
      cancelled = true
    }
  }, [id, t, reloadKey])

  const { onNavigate } = useHostPorts()

  return (
    <SharedExamResultScreen
      t={t}
      item={result}
      loading={loading}
      error={error}
      onBack={() => navigation.goBack()}
      onRetry={reload}
      colorScheme={resolvedTheme}
      onNavigate={onNavigate}
      onRetryExam={() => {
        if (result?.examId) navigation.navigate('ExamQuestion', { examId: result.examId })
      }}
      onViewList={() => navigation.navigate('Exam')}
      onShare={() => {
        void Share.share({ message: t('examResult.shareTitle', { n: result?.score ?? 0 }) })
      }}
    />
  )
}
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
