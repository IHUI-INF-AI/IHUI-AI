// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

// 薄壳(web-单端 parity:web + 小程序,不含 RN):原 275 行页面渲染型 JSX 全部收敛到
// features/exam-intro/ExamIntroScreen;RN 无「试卷介绍」屏(RootNavigator.tsx:1241 的 ExamDetail
// 复用 ExamResultScreen),因此本页不算 RN parity。取数/门控/导航/toast 仍留在端内。
import { useTt } from '@/i18n'
import { logger } from '@/utils/logger'
import Taro, { useRouter, useDidShow } from '@tarojs/taro'
import { useState, useCallback, useEffect } from 'react'
import { formatDateByTemplate } from '@ihui/shared'
import {
  getExamPaper,
  getExamQuestions,
  getExamRecords,
  startExamRecord,
  type ExamPaper,
  type ExamRecord,
} from '@/api'
import { useAuthReadyGate } from '@/hooks/use-auth-ready-gate'
import ThemeRoot from '@/components/ThemeRoot'
import { useTheme } from '@/rn-compat/theme'
import { ExamIntroScreen } from '@ihui/rn-app/features/exam-intro/ExamIntroScreen'
import { onToast } from '@/host/on-toast'

type ExamDetail = ExamPaper & {
  questionCount: number
  totalScoreNum: number
  passScoreNum: number
  participantCount: number
  passedCount: number
}

const formatTime = (v: string): string => {
  if (!v) return '-'
  // 10 位字符串时间戳(秒级)→ 乘 1000 转毫秒;否则原样传给 formatDateByTemplate
  const input = typeof v === 'string' && v.length === 10 ? Number(v) * 1000 : v
  const formatted = formatDateByTemplate(input, 'YYYY-MM-DD')
  // 无效日期时 formatDateByTemplate 返回 '',原实现返回 v,保留原行为
  return formatted || v
}

export default function ExamDetail() {
  const tt = useTt()
  const router = useRouter()
  const { resolvedTheme } = useTheme()
  const [exam, setExam] = useState<ExamDetail>({} as ExamDetail)
  const [history, setHistory] = useState<ExamRecord[]>([])
  const [loading, setLoading] = useState(true)
  const [starting, setStarting] = useState(false)
  const { waitUntilReady } = useAuthReadyGate()

  const loadExam = useCallback(async () => {
    const id = router.params.id
    if (!id) return
    setLoading(true)
    try {
      const [paperRes, questionsRes, recordsRes] = await Promise.all([
        getExamPaper(id),
        getExamQuestions(id),
        getExamRecords({ page: 1, pageSize: 5 }).catch(() => ({
          list: [] as ExamRecord[],
          total: 0,
        })),
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
      onToast(tt('exam.detail.loadFailed', '考试加载失败'), { kind: 'error' })
    } finally {
      setLoading(false)
    }
  }, [router.params.id, tt])

  // G-933 冷启动抢跑门控:loadExam 的三支请求全部需鉴权 ——
  // GET /api/exam/papers/:id(apps/api/src/routes/exam.ts:519)、
  // GET /api/exam/papers/:id/questions(exam.ts:547)、
  // GET /api/exam/records(exam.ts:642),三支都是 handler 内
  // `if (!(await checkAuth(request, reply))) return`(注册前缀 /api 见 routes/index.ts:598)
  // ⇒ 本枚无公开请求,整块挡到门后;落定(含"落定但未登录")后照发一次,
  // 失败态由共享屏 error 分支渲染,不新增文案。
  useEffect(() => {
    return waitUntilReady(() => {
      void loadExam()
    })
  }, [loadExam, waitUntilReady])

  useDidShow(() => {
    if (router.params.id) {
      waitUntilReady(() => {
        void loadExam()
      })
    }
  })

  const onStart = useCallback(async () => {
    if (!exam.id || starting) return
    setStarting(true)
    try {
      const { record } = await startExamRecord(exam.id)
      Taro.navigateTo({ url: `/pages/exam/answer?id=${exam.id}&recordId=${record.id}` })
    } catch (e) {
      logger.error('exam/detail', '开始考试', e)
      onToast(tt('exam.detail.startFailed', '开始考试失败'), { kind: 'error' })
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

  const ready = !loading && Boolean(exam.title)

  return (
    <ThemeRoot>
      <ExamIntroScreen
        headerTitle={tt('exam.detail.pageTitle', '考试详情')}
        title={exam.title || ''}
        description={exam.description}
        stats={stats}
        participants={{
          label: tt('exam.detail.participants', '参与人数'),
          value: String(exam.participantCount || 0),
          passedLabel: tt('exam.detail.passedCount', '已通过'),
          passedValue: String(exam.passedCount || 0),
        }}
        rules={{ title: tt('exam.detail.rulesTitle', '考试规则'), items: rules }}
        history={{
          title: tt('exam.detail.historyTitle', '历史成绩'),
          emptyText: tt('exam.detail.historyEmpty', '暂无历史成绩'),
          items: history.map((h, i) => ({
            key: h.id || String(i),
            statusText: h.isPassed
              ? tt('exam.detail.historyPassed', '通过')
              : tt('exam.detail.historyNotPassed', '未通过'),
            timeText: tt('exam.detail.historyTime', '考试时间 {time}', {
              time: formatTime(h.submittedAt || h.startedAt),
            }),
            scoreText: tt('exam.detail.historyScoreValue', '{n} 分', {
              n: Number(h.score) || 0,
            }),
            passed: Boolean(h.isPassed),
          })),
        }}
        state={loading ? 'loading' : ready ? 'ready' : 'error'}
        loadingText={tt('exam.detail.loading', '加载中…')}
        errorText={ready || loading ? '' : tt('exam.detail.loadFailed', '考试加载失败')}
        retryText={tt('exam.detail.retry', '点击重试')}
        startText={tt('exam.detail.start', '开始考试')}
        startingText={tt('exam.detail.starting', '正在进入考试…')}
        starting={starting}
        onStart={onStart}
        onRetry={loadExam}
        onBack={() => Taro.navigateBack()}
        colorScheme={resolvedTheme}
      />
    </ThemeRoot>
  )
}
