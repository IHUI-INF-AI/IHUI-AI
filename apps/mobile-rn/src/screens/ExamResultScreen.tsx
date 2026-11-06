// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

import { useEffect, useState } from 'react'
import { Share } from 'react-native'
import { useTheme } from '../context/ThemeContext'
import { useNavigation, useRoute, type RouteProp } from '@react-navigation/native'
import type { NativeStackNavigationProp } from '@react-navigation/native-stack'
import { getResult, type ExamResult } from '@ihui/api-client'
import { apiFailureToText } from '@ihui/shared/utils'
import {
  ExamResultScreen as SharedExamResultScreen,
  renderExamResultAction,
  type ExamResultItem,
} from '@ihui/rn-app'
import { useI18n } from '../i18n'
import type { RootStackParamList } from '../navigation/RootNavigator'
import { useHostPorts } from '../host/use-host-ports'

type Route = RouteProp<RootStackParamList, 'ExamResult'>
type NavigationProp = NativeStackNavigationProp<RootStackParamList>

/** 记录接口 → 共享屏口径(显式映射,不再 as unknown 猜字段) */
function toResultItem(id: string, data: ExamResult): ExamResultItem {
  return {
    id,
    examId: data.examId,
    score: data.score,
    totalScore: data.totalScore,
    passed: data.isPassed,
    correctCount: data.correctCount,
    wrongCount: data.wrongCount,
    unansweredCount: data.unansweredCount,
    totalCount: data.correctCount + data.wrongCount + data.unansweredCount,
    duration: data.duration,
    submittedAt: data.submittedAt,
    details: data.details.map((detail) => ({
      id: detail.questionId,
      title: detail.title,
      yourAnswer: detail.userAnswer,
      correctAnswer: detail.correctAnswer,
      isCorrect: detail.isCorrect,
      score: detail.score,
      analysis: detail.analysis,
    })),
  }
}

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
      const res = await getResult(id)
      if (cancelled) return
      if (res.success) setResult(toResultItem(id, res.data))
      else setError(apiFailureToText(res, t('examResult.loadFailed')))
      setLoading(false)
    })()
    return () => {
      cancelled = true
    }
  }, [id, t, reloadKey])

  const { onNavigate } = useHostPorts()

  // 与小程序同一注入点:两端只差实现体(这里用 RN Share,小程序用原生 openType)
  const doShare = () => {
    const message = result ? t('examResult.shareTitle', { n: result.score }) : t('share.appTitle')
    void Share.share({ message }).catch(() => undefined)
  }

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
      shareAction={renderExamResultAction({
        label: t('examResult.share'),
        onPress: doShare,
        colorScheme: resolvedTheme,
        variant: 'secondary',
      })}
    />
  )
}
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
