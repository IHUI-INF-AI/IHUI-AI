import { logger } from '@/utils/logger'
import { View, Text, Button, ScrollView } from '@tarojs/components'
import Taro, { useRouter, useDidShow } from '@tarojs/taro'
import { useState, useCallback, useEffect } from 'react'
import {
  getExamPaper,
  getExamQuestions,
  getExamRecords,
  startExamRecord,
  type ExamPaper,
  type ExamRecord,
} from '@/api'
import { NavBar } from '@/components'
import { useI18n } from '@/i18n'
import './detail.css'

type ExamDetail = ExamPaper & {
  questionCount: number
  totalScoreNum: number
  passScoreNum: number
  participantCount: number
  passedCount: number
}

const formatTime = (v: string): string => {
  if (!v) return '-'
  const d = new Date(typeof v === 'string' && v.length === 10 ? Number(v) * 1000 : v)
  if (isNaN(d.getTime())) return v
  const y = d.getFullYear()
  const m = String(d.getMonth() + 1).padStart(2, '0')
  const day = String(d.getDate()).padStart(2, '0')
  return `${y}-${m}-${day}`
}

export default function ExamDetail() {
  const { t } = useI18n()
  const tt = (k: string, fb: string, params?: Record<string, string | number>) => {
    const v = params ? t(k, params) : t(k)
    if (v !== k) return v
    if (!params) return fb
    return fb.replace(/\{(\w+)\}/g, (_, key) => String(params[key] ?? ''))
  }
  const router = useRouter()
  const [exam, setExam] = useState<ExamDetail>({} as ExamDetail)
  const [history, setHistory] = useState<ExamRecord[]>([])
  const [loading, setLoading] = useState(true)
  const [starting, setStarting] = useState(false)

  const loadExam = useCallback(async () => {
    const id = router.params.id
    if (!id) return
    setLoading(true)
    try {
      const [paperRes, questionsRes, recordsRes] = await Promise.all([
        getExamPaper(id),
        getExamQuestions(id),
        getExamRecords({ page: 1, pageSize: 5 }).catch(() => ({ list: [] as ExamRecord[], total: 0 })),
      ])
      const paper = paperRes.paper
      const related = (recordsRes.list || []).filter((r) => r.paperId === id)
      setExam({
        ...paper,
        questionCount: (questionsRes.list || []).length,
        totalScoreNum: Number(paper.totalScore) || 0,
        passScoreNum: Number(paper.passScore) || 0,
        participantCount: recordsRes.total || 0,
        passedCount: related.filter((r) => r.isPassed).length,
      })
      setHistory(related)
    } catch (e) {
      logger.error('exam/detail', '考试详情加载', e)
      Taro.showToast({ title: tt('exam.detail.loadFailed', '考试加载失败'), icon: 'none' })
    } finally {
      setLoading(false)
    }
  }, [router.params.id, tt])

  useEffect(() => {
    loadExam()
  }, [loadExam])

  useDidShow(() => {
    if (router.params.id) loadExam()
  })

  const onStart = useCallback(async () => {
    if (!exam.id || starting) return
    setStarting(true)
    try {
      const { record } = await startExamRecord(exam.id)
      Taro.navigateTo({ url: `/pages/exam/answer?id=${exam.id}&recordId=${record.id}` })
    } catch (e) {
      logger.error('exam/detail', '开始考试', e)
      Taro.showToast({ title: tt('exam.detail.startFailed', '开始考试失败'), icon: 'none' })
    } finally {
      setStarting(false)
    }
  }, [exam.id, starting, tt])

  const stats = [
    {
      label: tt('exam.detail.questionCount', '题目数量'),
      value: tt('exam.detail.questionCountValue', '{n} 题', { n: exam.questionCount || 0 }),
    },
    {
      label: tt('exam.detail.totalScore', '总分'),
      value: tt('exam.detail.totalScoreValue', '{n} 分', { n: exam.totalScoreNum || 0 }),
    },
    {
      label: tt('exam.detail.duration', '考试时长'),
      value: tt('exam.detail.durationValue', '{n} 分钟', { n: exam.duration || 0 }),
    },
    {
      label: tt('exam.detail.passScore', '及格分'),
      value: tt('exam.detail.passScoreValue', '{n} 分', { n: exam.passScoreNum || 0 }),
    },
  ]

  const rules = [
    tt('exam.detail.rule1', '考试限时,请合理分配答题时间'),
    tt('exam.detail.rule2', '退出考试超过 3 次将自动交卷'),
    tt('exam.detail.rule3', '禁止切屏,切屏超过 5 次将自动交卷'),
    tt('exam.detail.notice1', '请仔细阅读题目,在规定时间内完成作答'),
    tt('exam.detail.notice2', '每道题作答后可修改,提交后不可更改'),
  ]

  return (
    <View className="exam-detail-page">
      <NavBar title={tt('exam.detail.pageTitle', '考试详情')} showBack />
      <ScrollView scrollY className="exam-detail-body">
        {loading ? (
          <View className="exam-detail-loading">
            <Text>{tt('exam.detail.loading', '加载中…')}</Text>
          </View>
        ) : null}

        {!loading && exam.title ? (
          <View>
            {/* 考试标题 + 简介 */}
            <View className="exam-detail-header">
              <Text className="exam-detail-title">{exam.title}</Text>
              {exam.description ? (
                <Text className="exam-detail-desc">{exam.description}</Text>
              ) : null}
            </View>

            {/* 考试信息统计 */}
            <View className="exam-detail-stats">
              {stats.map((s, i) => (
                <View key={i} className="exam-detail-stat-item">
                  <Text className="exam-detail-stat-value">{s.value}</Text>
                  <Text className="exam-detail-stat-label">{s.label}</Text>
                </View>
              ))}
            </View>

            {/* 参与情况 */}
            <View className="exam-detail-card">
              <View className="exam-detail-participant-row">
                <View className="exam-detail-participant-item">
                  <Text className="exam-detail-participant-num">
                    {exam.participantCount}
                  </Text>
                  <Text className="exam-detail-participant-label">
                    {tt('exam.detail.participants', '参与人数')}
                  </Text>
                </View>
                <View className="exam-detail-participant-item">
                  <Text className="exam-detail-participant-num passed">
                    {exam.passedCount}
                  </Text>
                  <Text className="exam-detail-participant-label">
                    {tt('exam.detail.passedCount', '已通过')}
                  </Text>
                </View>
              </View>
            </View>

            {/* 考试规则 */}
            <View className="exam-detail-card">
              <Text className="exam-detail-card-title">
                {tt('exam.detail.rulesTitle', '考试规则')}
              </Text>
              {rules.map((rule, i) => (
                <View key={i} className="exam-detail-rule-item">
                  <Text className="exam-detail-rule-dot">•</Text>
                  <Text className="exam-detail-rule-text">{rule}</Text>
                </View>
              ))}
            </View>

            {/* 历史成绩 */}
            <View className="exam-detail-card">
              <Text className="exam-detail-card-title">
                {tt('exam.detail.historyTitle', '历史成绩')}
              </Text>
              {history.length > 0 ? (
                history.map((h, i) => (
                  <View key={h.id || i} className="exam-detail-history-item">
                    <View className="exam-detail-history-info">
                      <Text
                        className={`exam-detail-history-status${h.isPassed ? ' passed' : ' failed'}`}
                      >
                        {h.isPassed
                          ? tt('exam.detail.historyPassed', '通过')
                          : tt('exam.detail.historyNotPassed', '未通过')}
                      </Text>
                      <Text className="exam-detail-history-time">
                        {tt('exam.detail.historyTime', '考试时间 {time}', {
                          time: formatTime(h.submittedAt || h.startedAt),
                        })}
                      </Text>
                    </View>
                    <Text className="exam-detail-history-score">
                      {tt('exam.detail.historyScoreValue', '{n} 分', {
                        n: Number(h.score) || 0,
                      })}
                    </Text>
                  </View>
                ))
              ) : (
                <Text className="exam-detail-history-empty">
                  {tt('exam.detail.historyEmpty', '暂无历史成绩')}
                </Text>
              )}
            </View>
          </View>
        ) : null}

        {!loading && !exam.title ? (
          <View className="exam-detail-error" onClick={loadExam}>
            <Text className="exam-detail-error-text">
              {tt('exam.detail.loadFailed', '考试加载失败')}
            </Text>
            <Text className="exam-detail-error-retry">
              {tt('exam.detail.retry', '点击重试')}
            </Text>
          </View>
        ) : null}
      </ScrollView>

      {/* 开始考试按钮 */}
      {!loading && exam.title ? (
        <View className="exam-detail-footer">
          <Button
            className="exam-detail-start-btn"
            loading={starting}
            disabled={starting}
            onClick={onStart}
          >
            {starting
              ? tt('exam.detail.starting', '正在进入考试…')
              : tt('exam.detail.start', '开始考试')}
          </Button>
        </View>
      ) : null}
    </View>
  )
}
