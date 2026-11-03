// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

import { useEffect, useState } from 'react'
import { useTheme } from '../context/ThemeContext'
import { useNavigation } from '@react-navigation/native'
import type { NativeStackNavigationProp } from '@react-navigation/native-stack'
import { fetchApi } from '@ihui/api-client'
import { apiFailureToText } from '@ihui/shared/utils'
import { ExamHistoryScreen as SharedExamHistoryScreen, type ExamHistoryItem } from '@ihui/rn-app'
import { useI18n } from '../i18n'
import { useHostPorts } from '../host/use-host-ports'
import type { RootStackParamList } from '../navigation/RootNavigator'

type NavigationProp = NativeStackNavigationProp<RootStackParamList>

export function ExamHistoryScreen() {
  const { resolvedTheme } = useTheme()
  const { t } = useI18n()
  const navigation = useNavigation<NavigationProp>()
  const { onNavigate } = useHostPorts()
  const [history, setHistory] = useState<ExamHistoryItem[]>([])
  const [loading, setLoading] = useState(true)
  const [refreshing, setRefreshing] = useState(false)
  const [error, setError] = useState('')

  const load = async (refresh = false) => {
    if (refresh) setRefreshing(true)
    else setLoading(true)
    setError('')
    // 后端 GET /exam/records 回 success({list,total,page,pageSize})(exam.ts:649)，
    // 而这里曾把整个信封当数组用 —— 与 HistoryScreen 同一型：FlatList 拿到对象不报错，
    // 只是永远空列表。web 侧读的是 r.data?.list(user/exam/page.tsx)。
    // 后端 GET /exam/records 回 findMyExamRecords 的裸 exam_records 行:
    // {id,paperId,score(numeric→JSON 字符串),isPassed,submittedAt,createdAt,...},
    // 没有 examTitle/totalScore(查询不 join exam_papers,web user/exam 页同口径)。
    // 显式投影成共享屏 ExamHistoryItem:卷名/满分用 /exam/papers/by-ids 批量补一次;
    // 已下架(未发布)卷取不到 → 标题退回 paperId 前 8 位(与 web 管理员批改页同口径),
    // totalScore 留空由共享屏渲染 '—'。
    type RecordRow = {
      id: string
      paperId: string
      score: string | number
      isPassed: boolean
      submittedAt: string | null
      createdAt: string
    }
    type PaperRow = { id: string; title: string; totalScore: string | number }
    const res = await fetchApi<{ list: RecordRow[] }>('/api/exam/records')
    let items: ExamHistoryItem[] = []
    if (res.success) {
      const rows = res.data?.list ?? []
      const paperIds = Array.from(new Set(rows.map((r) => r.paperId).filter(Boolean)))
      const paperMap = new Map<string, PaperRow>()
      if (paperIds.length > 0) {
        const pres = await fetchApi<{ list: PaperRow[] }>(
          `/api/exam/papers/by-ids?ids=${encodeURIComponent(paperIds.join(','))}`,
        )
        if (pres.success) for (const p of pres.data?.list ?? []) paperMap.set(p.id, p)
      }
      items = rows.map((row) => {
        const paper = paperMap.get(row.paperId)
        return {
          id: row.id,
          examTitle: paper?.title ?? row.paperId.slice(0, 8),
          score: Number(row.score ?? 0),
          totalScore: paper !== undefined ? Number(paper.totalScore ?? 0) : undefined,
          passed: Boolean(row.isPassed),
          submittedAt: row.submittedAt ?? row.createdAt,
        }
      })
    } else {
      setError(apiFailureToText(res, t('examHistory.loadFailed')))
    }
    setHistory(items)
    setLoading(false)
    setRefreshing(false)
  }

  useEffect(() => {
    void load()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  return (
    <SharedExamHistoryScreen
      t={t}
      items={history}
      loading={loading}
      refreshing={refreshing}
      error={error}
      onRefresh={() => load(true)}
      onRetry={() => { void load(); }}
      onPressItem={(id) => onNavigate('ExamDetail', { id })}
      onBack={() => navigation.goBack()}
      colorScheme={resolvedTheme}
    />
  )
}
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
