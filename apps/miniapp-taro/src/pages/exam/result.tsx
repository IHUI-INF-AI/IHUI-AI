import { logger } from '@/utils/logger'
import { View, Text, Button, ScrollView } from '@tarojs/components'
import Taro, { useRouter, useShareAppMessage } from '@tarojs/taro'
import { useState, useEffect, useCallback } from 'react'
import { getExamResult, get } from '@/api'
import { NavBar } from '@/components'
import { useI18n } from '@/i18n'
import './result.css'

interface ExamResultInfo {
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

interface ReviewQuestion {
  id: string
  title: string
  type?: string
  myAnswer?: string
  correctAnswer?: string
  analysis?: string
  isCorrect: boolean
  score: number
}

export default function ExamResult() {
  const { t } = useI18n()
  const tt = (k: string, fb: string, params?: Record<string, string | number>) => {
    const v = params ? t(k, params) : t(k)
    if (v !== k) return v
    if (!params) return fb
    return fb.replace(/\{(\w+)\}/g, (_, key) => String(params[key] ?? ''))
  }
  const router = useRouter()
  const [info, setInfo] = useState<ExamResultInfo>({ score: 0, pass: false })
  const [reviews, setReviews] = useState<ReviewQuestion[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    const params = router.params
    if (params.score) {
      setInfo({
        score: Number(params.score),
        pass: params.pass === 'true',
        duration: Number(params.duration) || 0,
        correct: Number(params.correct) || 0,
        wrong: Number(params.wrong) || 0,
        unanswered: Number(params.unanswered) || 0,
      })
      setLoading(false)
      return
    }
    if (!params.id) return
    setLoading(true)
    getExamResult(params.id)
      .then((res) => {
        setInfo(res)
        // 加载题目回顾
        get<{ list: ReviewQuestion[] }>(`/exam/${params.id}/review`)
          .then((r) => setReviews(r.list || []))
          .catch(() => setReviews([]))
          .finally(() => setLoading(false))
      })
      .catch((e) => {
        logger.error('exam/result', '考试结果加载', e)
        Taro.showToast({ title: tt('exam.result.loadFailed', '成绩加载失败'), icon: 'none' })
        setLoading(false)
      })
  }, [router.params, tt])

  useShareAppMessage(() => ({
    title: tt('exam.result.shareTitle', '我的考试成绩: {n} 分', { n: info.score }),
    path: '/pages/exam/list',
  }))

  const goList = useCallback(() => {
    Taro.redirectTo({ url: '/pages/exam/list' })
  }, [])

  const goRetry = useCallback(() => {
    const id = router.params.id
    if (id) {
      Taro.redirectTo({ url: `/pages/exam/detail?id=${id}` })
    } else {
      Taro.navigateBack()
    }
  }, [router.params.id])

  const onShare = useCallback(() => {
    Taro.showShareMenu({ withShareTicket: true })
  }, [])

  const stats = [
    {
      label: tt('exam.result.correct', '答对'),
      value: tt('exam.result.correctValue', '{n} 题', { n: info.correct || 0 }),
      cls: 'correct',
    },
    {
      label: tt('exam.result.wrong', '答错'),
      value: tt('exam.result.wrongValue', '{n} 题', { n: info.wrong || 0 }),
      cls: 'wrong',
    },
    {
      label: tt('exam.result.unanswered', '未答'),
      value: tt('exam.result.unansweredValue', '{n} 题', { n: info.unanswered || 0 }),
      cls: 'unanswered',
    },
    {
      label: tt('exam.result.duration', '用时'),
      value: tt('exam.result.durationValue', '{n} 分钟', {
        n: info.duration || 0,
      }),
      cls: 'duration',
    },
  ]

  return (
    <View className="exam-result-page">
      <NavBar title={tt('exam.result.pageTitle', '考试结果')} showBack />
      <ScrollView scrollY className="exam-result-body">
        {loading ? (
          <View className="exam-result-loading">
            <Text>{tt('exam.result.loading', '加载中…')}</Text>
          </View>
        ) : null}

        {!loading ? (
          <View>
            {/* 成绩展示 */}
            <View
              className={`exam-result-hero${info.pass ? ' passed' : ' failed'}`}
            >
              <View className="exam-result-badge">
                <Text>{info.pass ? '✓' : '×'}</Text>
              </View>
              <Text className="exam-result-status">
                {info.pass
                  ? tt('exam.result.pass', '恭喜通过')
                  : tt('exam.result.notPass', '未通过')}
              </Text>
              <Text className="exam-result-score">
                {tt('exam.result.scoreValue', '{n} 分', { n: info.score })}
              </Text>
              {info.totalScore ? (
                <Text className="exam-result-total">
                  {tt('exam.result.totalScoreValue', '满分 {n} 分', {
                    n: info.totalScore,
                  })}
                </Text>
              ) : null}
              {info.rank ? (
                <Text className="exam-result-rank">
                  {tt('exam.result.rankValue', '第 {n} 名 / 共 {total} 人', {
                    n: info.rank,
                    total: info.total ?? 0,
                  })}
                </Text>
              ) : null}
            </View>

            {/* 答题统计 */}
            <View className="exam-result-stats">
              {stats.map((s, i) => (
                <View key={i} className="exam-result-stat-item">
                  <Text className={`exam-result-stat-value ${s.cls}`}>{s.value}</Text>
                  <Text className="exam-result-stat-label">{s.label}</Text>
                </View>
              ))}
            </View>

            {/* 题目回顾 */}
            <View className="exam-result-card">
              <Text className="exam-result-card-title">
                {tt('exam.result.reviewTitle', '题目回顾')}
              </Text>
              {reviews.length > 0 ? (
                reviews.map((q, idx) => (
                  <View key={q.id || idx} className="exam-result-review-item">
                    <View className="exam-result-review-header">
                      <Text className="exam-result-review-idx">
                        {tt('exam.result.questionIdx', '第 {n} 题', { n: idx + 1 })}
                      </Text>
                      <Text
                        className={`exam-result-review-status${q.isCorrect ? ' correct' : ' wrong'}`}
                      >
                        {q.isCorrect
                          ? tt('exam.result.reviewCorrect', '正确')
                          : tt('exam.result.reviewWrong', '错误')}
                      </Text>
                      <Text className="exam-result-review-score">
                        {tt('exam.result.reviewScore', '{n} 分', { n: q.score })}
                      </Text>
                    </View>
                    <Text className="exam-result-review-title">{q.title}</Text>
                    {q.myAnswer ? (
                      <View className="exam-result-review-row">
                        <Text className="exam-result-review-label">
                          {tt('exam.result.myAnswer', '我的答案')}:
                        </Text>
                        <Text
                          className={`exam-result-review-answer${q.isCorrect ? ' correct' : ' wrong'}`}
                        >
                          {q.myAnswer}
                        </Text>
                      </View>
                    ) : null}
                    {q.correctAnswer ? (
                      <View className="exam-result-review-row">
                        <Text className="exam-result-review-label">
                          {tt('exam.result.correctAnswer', '正确答案')}:
                        </Text>
                        <Text className="exam-result-review-answer correct">
                          {q.correctAnswer}
                        </Text>
                      </View>
                    ) : null}
                    {q.analysis ? (
                      <View className="exam-result-review-analysis">
                        <Text className="exam-result-review-analysis-label">
                          {tt('exam.result.analysis', '解析')}
                        </Text>
                        <Text className="exam-result-review-analysis-text">
                          {q.analysis}
                        </Text>
                      </View>
                    ) : null}
                  </View>
                ))
              ) : (
                <Text className="exam-result-review-empty">
                  {tt('exam.result.noReview', '暂无题目回顾')}
                </Text>
              )}
            </View>
          </View>
        ) : null}
      </ScrollView>

      {/* 底部按钮 */}
      {!loading ? (
        <View className="exam-result-footer">
          <Button className="exam-result-btn exam-result-btn-primary" onClick={goRetry}>
            {tt('exam.result.retry', '再考一次')}
          </Button>
          <Button className="exam-result-btn exam-result-btn-secondary" onClick={goList}>
            {tt('exam.result.goList', '查看考试列表')}
          </Button>
          <Button className="exam-result-btn exam-result-btn-secondary" onClick={onShare} openType="share">
            {tt('exam.result.share', '分享成绩')}
          </Button>
        </View>
      ) : null}
    </View>
  )
}
