// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

// 对齐目标(RN 共享屏): packages/app/src/features/exam-result/ExamResultScreen.tsx
import { useTt } from '@/i18n'
import { logger } from '@/utils/logger'
import { View, Text, Button, ScrollView } from '@tarojs/components'
import LineIcon from '@/components/LineIcon'
import Taro, { useRouter, useShareAppMessage } from '@tarojs/taro'
import { useState, useEffect, useCallback } from 'react'
import { getExamResult, get } from '@/api'
import { useAuthReadyGate } from '@/hooks/use-auth-ready-gate'
import { NavBar } from '@/components'
import ThemeRoot from '@/components/ThemeRoot'
import { ScreenSkeleton } from '@/components/ScreenStates.taro'
import { ReviewList, type ReviewQuestion } from './review-list'
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

export default function ExamResult() {
  const tt = useTt()
  const router = useRouter()
  const [info, setInfo] = useState<ExamResultInfo>({ score: 0, pass: false })
  const [reviews, setReviews] = useState<ReviewQuestion[]>([])
  const [loading, setLoading] = useState(true)
  // 加载失败态:与共享屏一致(ErrorState 承接 examResult.loadFailed),不再只弹一次 toast 就当无事
  const [error, setError] = useState('')
  const { waitUntilReady } = useAuthReadyGate()

  // G-933 冷启动抢跑门控:成绩两支请求都需鉴权 ——
  // GET /api/exam/:id/result(apps/api/src/routes/exam.ts:756)与
  // GET /api/exam/:id/review(exam.ts:806),两支都是 handler 内
  // `if (!(await checkAuth(request, reply))) return`(注册前缀 /api 见 routes/index.ts:598)。
  // 走查询参数(score=…)的那一支不发任何请求,原样照走,不挡。
  useEffect(() => {
    const params = router.params
    // 交卷后 answer.tsx 只带 score / pass 两个快捷参数(**不带** correct / wrong / 未答 / 用时),
    // 而这一支原先照单构造 info 且一个请求都不发 ⇒ 成绩页"答题数/对/错/未答/用时"五项全 0、
    // 题目回顾永久空白。有 recordId(id) 时以服务端结果为准,查询参数只作缺 id 时的兜底。
    if (!params.id && params.score) {
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
    const id = params.id
    return waitUntilReady(() => {
      setLoading(true)
      getExamResult(id)
        .then((res) => {
          setInfo(res)
          // 加载题目回顾
          get<{ list: ReviewQuestion[] }>(`/exam/${id}/review`)
            .then((r) => setReviews(r.list || []))
            .catch(() => setReviews([]))
            .finally(() => setLoading(false))
        })
        .catch((e) => {
          logger.error('exam/result', '考试结果加载', e)
          // 共享屏口径:失败由页面正文承接(examResult.loadFailed),不靠一次性 toast
          setError(tt('examResult.loadFailed', '加载失败'))
          setLoading(false)
        })
    })
  }, [router.params, tt, waitUntilReady])

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
    <ThemeRoot>
      <View className="exam-result-page">
        <NavBar title={tt('exam.result.pageTitle', '考试结果')} showBack />
        <ScrollView scrollY className="exam-result-body">
          {loading ? <ScreenSkeleton variant="list" count={4} /> : null}

          {!loading && !error ? (
            <View>
              {/* 成绩展示 */}
              <View className={`exam-result-hero${info.pass ? ' passed' : ' failed'}`}>
                <View className="exam-result-badge">
                  {info.pass ? (
                    <LineIcon
                      name="check"
                      size={48}
                      color="var(--color-primary)"
                      style={{ display: 'block' }}
                    />
                  ) : (
                    <LineIcon
                      name="x"
                      size={48}
                      color="var(--color-danger)"
                      style={{ display: 'block' }}
                    />
                  )}
                </View>
                <Text className="exam-result-status">
                  {info.pass
                    ? tt('examResult.passed', '已通过')
                    : tt('examResult.failed', '未通过')}
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

              {/* 题目回顾(含错题段;同目录子模块,键与共享屏同源) */}
              <ReviewList reviews={reviews} />
            </View>
          ) : null}

          {/* 加载失败:共享屏口径是页面正文承接 ErrorState,而不是弹一次 toast 就当加载完了 */}
          {!loading && error ? (
            <View className="exam-result-card">
              <Text className="exam-result-loading">{error}</Text>
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
            <Button
              className="exam-result-btn exam-result-btn-secondary"
              onClick={onShare}
              openType="share"
            >
              {tt('exam.result.share', '分享成绩')}
            </Button>
          </View>
        ) : null}
      </View>
    </ThemeRoot>
  )
}
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
