// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

import { useCallback, useEffect, useState } from 'react'
import { useNavigation } from '@react-navigation/native'
import type { NativeStackNavigationProp } from '@react-navigation/native-stack'
import { fetchApi } from '@ihui/api-client'
import {
  WrongQuestionsScreen as SharedWrongQuestionsScreen,
  type WrongQuestionExplanation,
  type WrongQuestionFilter,
  type WrongQuestionItem,
} from '@ihui/rn-app'
import { appAlert } from '../components/BottomPops'
import { useTheme } from '../context/ThemeContext'
import { useI18n } from '../i18n'
import type { RootStackParamList } from '../navigation/RootNavigator'

type NavigationProp = NativeStackNavigationProp<RootStackParamList>

const PAGE_SIZE = 10

/**
 * 错题本 —— 对齐 web `/exam/wrong-questions`。
 *
 * 〔门 39 六屏共享化第二批 2026-10-22〕UI 已下沉到共享层 `@ihui/rn-app` 的
 * WrongQuestionsScreen —— 本文件改成 wrapper,只留平台侧三件事:API 调用、导航、
 * i18n/时间格式化/主题注入。统计卡/筛选档/列表/AI 讲解弹层由共享层渲染,
 * 与 PointsScreen / UsageScreen / PaymentScreen 同一型。
 * **不准**靠"补一条 @ihui/rn-app import"或塞白名单消门 39 的红 —— 那两条都不改真实共享度。
 *
 * 端点按 apps/api/src/routes/exam.ts 现读:
 *  - GET  /api/exam/wrong-questions?page&pageSize&examId&isResolved  ⇒ { list, total, page, pageSize }
 *  - GET  /api/exam/wrong-questions/stats                            ⇒ { stats: { total, unresolved, resolved, byType } }
 *  - PUT  /api/exam/wrong-questions/:questionId/resolve              ⇒ 标记已掌握(是 PUT,不是 POST)
 *  - POST /api/exam/wrong-questions/:questionId/explain              ⇒ { explanation, cached }
 * 行字段取 findWrongQuestionsByUser 的投影:paperTitle / questionTitle / wrongCount / isMastered / createdAt。
 */
interface WrongQuestion {
  id: string
  questionId: string
  paperId: string
  paperTitle: string | null
  questionTitle: string | null
  wrongCount: number
  isMastered: boolean
  createdAt: string
}

interface Stats {
  total: number
  unresolved: number
  resolved: number
}

export default function WrongQuestionsScreen() {
  const { t, locale } = useI18n()
  const { resolvedTheme } = useTheme()
  const navigation = useNavigation<NavigationProp>()

  const [list, setList] = useState<WrongQuestion[]>([])
  const [total, setTotal] = useState(0)
  const [page, setPage] = useState(1)
  const [filter, setFilter] = useState<WrongQuestionFilter>('all')
  const [stats, setStats] = useState<Stats | null>(null)
  const [loading, setLoading] = useState(true)
  const [failed, setFailed] = useState(false)
  const [reloadKey, setReloadKey] = useState(0)
  const [resolving, setResolving] = useState<string | null>(null)
  const [explaining, setExplaining] = useState<string | null>(null)
  const [explanation, setExplanation] = useState<WrongQuestionExplanation | null>(null)

  const fmt = useCallback(
    (iso: string) => {
      const d = new Date(iso)
      if (Number.isNaN(d.getTime())) return iso
      return new Intl.DateTimeFormat(locale, {
        year: 'numeric',
        month: '2-digit',
        day: '2-digit',
        hour: '2-digit',
        minute: '2-digit',
      }).format(d)
    },
    [locale],
  )

  const loadList = useCallback(
    async (targetPage: number, append = false) => {
      setLoading(true)
      setFailed(false)
      try {
        const qs = new URLSearchParams({
          page: String(targetPage),
          pageSize: String(PAGE_SIZE),
        })
        if (filter === 'unresolved') qs.set('isResolved', 'false')
        if (filter === 'resolved') qs.set('isResolved', 'true')
        const [listRes, statsRes] = await Promise.all([
          fetchApi<{ list: WrongQuestion[]; total: number }>(
            `/api/exam/wrong-questions?${qs.toString()}`,
          ),
          fetchApi<{ stats: Stats }>('/api/exam/wrong-questions/stats'),
        ])
        if (!listRes.success) throw new Error(listRes.error)
        const rows = listRes.data?.list ?? []
        setList((prev) => (append ? [...prev, ...rows] : rows))
        setTotal(listRes.data?.total ?? 0)
        setStats(statsRes.success ? (statsRes.data?.stats ?? null) : null)
      } catch {
        if (!append) {
          setList([])
          setTotal(0)
        }
        setFailed(true)
      } finally {
        setLoading(false)
      }
    },
    [filter],
  )

  useEffect(() => {
    setPage(1)
    void loadList(1)
  }, [loadList, reloadKey])

  const loadMore = async () => {
    const next = page + 1
    await loadList(next, true)
    setPage(next)
  }

  const onResolve = async (wq: WrongQuestionItem) => {
    setResolving(wq.questionId)
    try {
      const res = await fetchApi(`/api/exam/wrong-questions/${wq.questionId}/resolve`, {
        method: 'PUT',
      })
      if (!res.success) throw new Error(res.error)
      appAlert(t('wrongQuestions.markSuccess'))
      setReloadKey((k) => k + 1)
    } catch {
      appAlert(t('common.error'), t('wrongQuestions.markFailed'))
    } finally {
      setResolving(null)
    }
  }

  const onExplain = async (wq: WrongQuestionItem) => {
    setExplaining(wq.questionId)
    try {
      const res = await fetchApi<{ explanation: string; cached: boolean }>(
        `/api/exam/wrong-questions/${wq.questionId}/explain`,
        { method: 'POST' },
      )
      if (!res.success) throw new Error(res.error)
      setExplanation({
        title: wq.questionTitle || wq.paperTitle || wq.questionId,
        text: res.data?.explanation ?? '',
      })
    } catch {
      appAlert(t('common.error'), t('wrongQuestions.explainFailed'))
    } finally {
      setExplaining(null)
    }
  }

  const items: WrongQuestionItem[] = list.map((wq) => ({
    id: wq.id,
    questionId: wq.questionId,
    questionTitle: wq.questionTitle,
    paperTitle: wq.paperTitle,
    wrongCount: wq.wrongCount,
    isMastered: wq.isMastered,
    createdAtText: fmt(wq.createdAt),
  }))

  return (
    <SharedWrongQuestionsScreen
      t={t}
      stats={stats}
      filter={filter}
      items={items}
      total={total}
      loading={loading}
      failed={failed}
      resolvingId={resolving}
      explainingId={explaining}
      explanation={explanation}
      onFilterChange={setFilter}
      onRetry={() => setReloadKey((k) => k + 1)}
      onLoadMore={() => void loadMore()}
      onResolve={(item) => void onResolve(item)}
      onExplain={(item) => void onExplain(item)}
      onCloseExplanation={() => setExplanation(null)}
      onBack={() => navigation.goBack()}
      colorScheme={resolvedTheme}
    />
  )
}
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
