// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

// 镜像 packages/app/src/features/exam-result/ExamResultScreen.tsx(直载共享屏 + 注入本端事实)
//
// 本端保留(不可丢的业务):
//   ① 记录详情 GET /exam/records/:id(全量解析 details + examId)
//   ② 名次摘要 GET /exam/:id/result(rank/total) —— 与 RN `getExamResultSummary` 同一后端端点
//   ③ 名次回退:交卷后 redirectTo 只带 score/pass 等快捷参数(无 id),按旧行为用查询参数兜底
//   ④ 转发面板平台能力(useShareAppMessage + showShareMenu)
// 版面/统计/解析/rank/底部三操作由共享屏输出;onNavigate 按契约注入(本屏无受控跳转)。

import Taro, { useRouter, useShareAppMessage } from '@tarojs/taro'
import { useState, useEffect, useCallback, useMemo } from 'react'
import { View } from '@tarojs/components'
import { useI18n } from '@/i18n'
import { logger } from '@/utils/logger'
import { getExamResult, get } from '@/api'
import { useAuthReadyGate } from '@/hooks/use-auth-ready-gate'
import { onToast } from '@/host/on-toast'
import ThemeRoot from '@/components/ThemeRoot'
import { useTheme } from '@/rn-compat/theme'
import { ExamResultScreen as SharedExamResultScreen } from '@ihui/rn-app/features/exam-result/ExamResultScreen'
import type { ExamResultItem, OnNavigate } from '@ihui/types'
import './result.css'

/** 共享屏宿主导航端口:本屏无受控跳转点,按契约注入并在误用时可见地报错 */
const onNavigate: OnNavigate = (target) => {
  onToast(`导航未接入: ${target}`, { kind: 'error' })
}

interface ExamResultSummary {
  score: number
  pass: boolean
  rank?: number
  total?: number
  duration?: number
  correct?: number
  wrong?: number
  unanswered?: number
  passScore?: number
  totalScore?: number
}

interface ExamRecordDetail {
  examId?: string
  score: number
  totalScore: number
  isPassed: boolean
  correctCount: number
  wrongCount: number
  unansweredCount: number
  duration: number
  submittedAt?: string
  details?: Array<{
    questionId: string
    title: string
    userAnswer?: string | string[] | null
    correctAnswer?: string | string[] | null
    isCorrect: boolean
    score: number
    analysis?: string | null
  }>
}

export default function ExamResult() {
  const { t } = useI18n()
  const router = useRouter()
  const { resolvedTheme } = useTheme()
  const [item, setItem] = useState<ExamResultItem | null>(null)
  const [loading, setLoading] = useState(true)
  // 加载失败态:与共享屏一致(ErrorState 承接 examResult.loadFailed),不再只弹一次 toast 就当无事
  const [error, setError] = useState('')
  const [reloadKey, setReloadKey] = useState(0)
  const { waitUntilReady } = useAuthReadyGate()

  const reload = useCallback(() => setReloadKey((key) => key + 1), [])

  // 无 recordId 时的同步兜底:answer.tsx 交卷跳转只带 score/pass 等查询参数,这一支不发请求。
  // (放在渲染期计算而非 effect 里:数据是同步的,不该等一轮 effect 才可见)
  const fallbackItem = useMemo<ExamResultItem | null>(() => {
    const params = router.params
    if (params.id || !params.score) return null
    const correct = Number(params.correct) || 0
    const wrong = Number(params.wrong) || 0
    const unanswered = Number(params.unanswered) || 0
    return {
      id: '',
      score: Number(params.score) || 0,
      totalScore: Number(params.totalScore) || 0,
      passed: params.pass === 'true',
      correctCount: correct,
      wrongCount: wrong,
      unansweredCount: unanswered,
      totalCount: correct + wrong + unanswered,
      duration: Number(params.duration) || 0,
    }
  }, [router.params])
  const viewItem = item ?? fallbackItem

  // G-933 冷启动抢跑门控:成绩两支请求都需鉴权 ——
  // GET /api/exam/:id/result 与 GET /api/exam/records/:id 都是 handler 内
  // `if (!(await checkAuth(request, reply))) return`(注册前缀 /api 见 routes/index.ts)。
  // 走查询参数(score=…)的那一支不发任何请求,原样照走,不挡。
  useEffect(() => {
    const params = router.params
    // 查询参数兜底已在 fallbackItem 同步给出,这一支不再发请求。
    if (fallbackItem) return
    if (!params.id) {
      setLoading(false)
      return
    }
    const id = params.id
    return waitUntilReady(() => {
      setLoading(true)
      setError('')
      Promise.all([
        get<ExamRecordDetail>(`/exam/records/${id}`),
        getExamResult(id).catch(() => null),
      ])
        .then(([record, summaryRes]) => {
          // api 层只声明了 score/pass/rank/total,后端实际还回 duration/correct/wrong/unanswered/totalScore
          const summary = summaryRes ? (summaryRes as unknown as ExamResultSummary) : null
          setItem({
            id,
            examId: record.examId,
            score: summary?.score ?? record.score,
            totalScore: summary?.totalScore ?? record.totalScore,
            passed: summary?.pass ?? record.isPassed,
            correctCount: summary?.correct ?? record.correctCount,
            wrongCount: summary?.wrong ?? record.wrongCount,
            unansweredCount: summary?.unanswered ?? record.unansweredCount,
            totalCount:
              (summary?.correct ?? record.correctCount) +
              (summary?.wrong ?? record.wrongCount) +
              (summary?.unanswered ?? record.unansweredCount),
            duration: summary?.duration ?? record.duration,
            submittedAt: record.submittedAt,
            rank: summary?.rank,
            rankTotal: summary?.total,
            details: (record.details ?? []).map((detail) => ({
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
        })
        .catch((e) => {
          logger.error('exam/result', '考试结果加载', e)
          // 共享屏口径:失败由页面正文承接(examResult.loadFailed),不靠一次性 toast
          setError(t('examResult.loadFailed'))
          setLoading(false)
        })
    })
  }, [router.params, fallbackItem, t, waitUntilReady, reloadKey])

  useShareAppMessage(() => ({
    title: viewItem?.score
      ? t('examResult.shareTitle', { n: viewItem.score })
      : t('share.appTitle'),
    path: '/pages/exam/list',
  }))

  const goList = useCallback(() => {
    void Taro.redirectTo({ url: '/pages/exam/list' })
  }, [])

  const goRetryExam = useCallback(() => {
    // 用记录的 examId(试卷 id)回考试详情;旧实现拿 recordId 当试卷 id,详情页必然加载失败
    if (viewItem?.examId) {
      void Taro.redirectTo({ url: `/pages/exam/detail?id=${viewItem.examId}` })
    } else {
      void Taro.navigateBack()
    }
  }, [viewItem?.examId])

  const onShare = useCallback(() => {
    void Taro.showShareMenu({ withShareTicket: true })
  }, [])

  return (
    <ThemeRoot>
      <View className="exam-result-page">
        <SharedExamResultScreen
          t={t}
          item={viewItem}
          loading={fallbackItem ? false : loading}
          error={error}
          onBack={() => {
            void Taro.navigateBack()
          }}
          onRetry={reload}
          colorScheme={resolvedTheme}
          onNavigate={onNavigate}
          onRetryExam={goRetryExam}
          onViewList={goList}
          onShare={onShare}
        />
      </View>
    </ThemeRoot>
  )
}
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
