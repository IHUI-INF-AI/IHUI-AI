// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

// 薄壳:渲染全部委托共享屏 packages/app/src/features/exam-result/ExamResultScreen.tsx
// (RN 端消费点 apps/mobile-rn/src/screens/ExamResultScreen.tsx 同屏)。
// 端内保留:① 取数(GET /exam/records/:id + 成绩汇总 rank)并映射为共享屏 item;
// ② onNavigate 真映射(ExamQuestion → /pages/exam/answer?id=<examId>;Exam → /pages/exam/list);
// ③ 微信分享原生节点(openType="share")与 useShareAppMessage 落点。
// 删除自绘 hero/stats/review/footer:四格统计、全量解析、底部三操作均由共享屏输出。
import Taro, { useRouter, useShareAppMessage } from '@tarojs/taro'
import { View } from '@tarojs/components'
import { useCallback, useEffect, useState } from 'react'
import { useI18n } from '@/i18n'
import { get, getExamResult } from '@/api'
import { logger } from '@/utils/logger'
import { useAuthReadyGate } from '@/hooks/use-auth-ready-gate'
import { onToast } from '@/host/on-toast'
import ThemeRoot from '@/components/ThemeRoot'
import { NavBar } from '@/components'
import { useTheme } from '@/rn-compat/theme'
import { ExamResultScreen as SharedExamResultScreen } from '@ihui/rn-app/features/exam-result/ExamResultScreen'
import type { ExamResultItem, OnNavigate } from '@ihui/types'
import { renderWxShareButton } from './host-overlays'
import './result.css'

/** GET /exam/records/:id 的必要字段(apps/api/src/routes/exam.ts) */
interface ExamRecordDetail {
  examId: string
  score: number
  totalScore: number
  isPassed: boolean
  correctCount: number
  wrongCount: number
  unansweredCount: number
  duration: number
  submittedAt: string
  details: Array<{
    questionId: string
    title: string
    userAnswer: string | string[] | null
    correctAnswer: string | string[] | null
    isCorrect: boolean
    score: number
    analysis: string | null
  }>
}

/** 成绩汇总(GET /exam/:id/result):只取排名/总人数,分数以记录为准 */
interface ExamResultSummary {
  score: number
  pass: boolean
  rank?: number
  total?: number
}

function toResultItem(
  recordId: string,
  record: ExamRecordDetail,
  summary: ExamResultSummary | null,
): ExamResultItem {
  const totalCount = record.correctCount + record.wrongCount + record.unansweredCount
  return {
    id: recordId,
    examId: record.examId,
    score: record.score,
    totalScore: record.totalScore,
    passed: record.isPassed,
    correctCount: record.correctCount,
    wrongCount: record.wrongCount,
    unansweredCount: record.unansweredCount,
    totalCount,
    duration: record.duration,
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
  }
}

/** 旧深链兜底:交卷页以外的入口可能只带快捷参数(无 id ⇒ 不取数) */
function fromQueryParams(params: Record<string, string | undefined>): ExamResultItem {
  const correct = Number(params.correct) || 0
  const wrong = Number(params.wrong) || 0
  const unanswered = Number(params.unanswered) || 0
  return {
    id: '',
    examId: params.examId,
    score: Number(params.score) || 0,
    totalScore: Number(params.totalScore) || 0,
    passed: params.pass === 'true',
    correctCount: correct,
    wrongCount: wrong,
    unansweredCount: unanswered,
    totalCount: correct + wrong + unanswered,
    duration: Number(params.duration) || 0,
  }
}

export default function ExamResultPage() {
  const { t } = useI18n()
  const router = useRouter()
  const { resolvedTheme } = useTheme()
  const { waitUntilReady } = useAuthReadyGate()
  const [item, setItem] = useState<ExamResultItem | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [reloadKey, setReloadKey] = useState(0)
  const recordId = router.params.id

  // G-933 冷启动抢跑门控:记录与成绩汇总两支 GET 均需鉴权
  useEffect(() => {
    const params = router.params
    if (!recordId) {
      if (params.score) {
        setItem(fromQueryParams(params))
        setError('')
      } else {
        // 无 id 也无快捷分数:不再永久 skeleton,显式落错误态(无重试按钮)
        setItem(null)
        setError(t('examResult.loadFailed'))
      }
      setLoading(false)
      return
    }
    return waitUntilReady(() => {
      setLoading(true)
      setError('')
      Promise.all([
        get<ExamRecordDetail>(`/exam/records/${recordId}`),
        // 汇总只补排名;失败不拖垮整页,分数/题解以记录为准
        getExamResult(recordId).catch(() => null),
      ])
        .then(([record, summary]) => setItem(toResultItem(recordId, record, summary)))
        .catch((e) => {
          logger.error('exam/result', '考试结果加载', e)
          setError(t('examResult.loadFailed'))
        })
        .finally(() => setLoading(false))
    })
  }, [router.params, recordId, reloadKey, t, waitUntilReady])

  useShareAppMessage(() => ({
    title: item?.score ? t('examResult.shareTitle', { n: item.score }) : t('share.appTitle'),
    path: '/pages/exam/list',
  }))

  const onBack = useCallback(() => {
    Taro.navigateBack()
  }, [])

  const reload = useCallback(() => {
    setReloadKey((key) => key + 1)
  }, [])

  // 共享屏底部两操作的唯一平台跳转点:逻辑 target 在这里落成小程序路径
  const onNavigate = useCallback<OnNavigate>((target, navParams) => {
    if (target === 'ExamQuestion') {
      const examId = navParams?.examId
      if (examId !== undefined && examId !== null && examId !== '') {
        Taro.redirectTo({ url: `/pages/exam/answer?id=${String(examId)}` })
        return
      }
      Taro.navigateBack()
      return
    }
    if (target === 'Exam') {
      Taro.redirectTo({ url: '/pages/exam/list' })
      return
    }
    onToast(`导航未接入: ${target}`, { kind: 'error' })
  }, [])

  return (
    <ThemeRoot>
      <View className="exam-result-page">
        <NavBar title={t('exam.result.pageTitle')} showBack={false} />
        <SharedExamResultScreen
          t={t}
          item={item}
          loading={loading}
          error={error}
          onBack={onBack}
          onRetry={recordId ? reload : undefined}
          colorScheme={resolvedTheme}
          onNavigate={onNavigate}
          shareAction={renderWxShareButton(t('examResult.share'))}
        />
      </View>
    </ThemeRoot>
  )
}
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
