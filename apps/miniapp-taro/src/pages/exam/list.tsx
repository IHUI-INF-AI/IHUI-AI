import { View, Text } from '@tarojs/components'
import Taro, { useDidShow } from '@tarojs/taro'
import { useState, useCallback, useMemo } from 'react'
import { getExamList, getExamRecords, type Exam, type ExamRecord } from '@/api'
import { useI18n } from '@/i18n'

type Tab = 'all' | 'pending' | 'completed'

const TAB_KEYS: { key: Tab; labelKey: string }[] = [
  { key: 'all', labelKey: 'exam.tabs.all' },
  { key: 'pending', labelKey: 'exam.tabs.pending' },
  { key: 'completed', labelKey: 'exam.tabs.completed' },
]

export default function ExamList() {
  const { t } = useI18n()
  const [tab, setTab] = useState<Tab>('all')
  const [papers, setPapers] = useState<Exam[]>([])
  const [records, setRecords] = useState<ExamRecord[]>([])
  const [loading, setLoading] = useState(false)

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const [pRes, rRes] = await Promise.all([
        getExamList({ page: 1, pageSize: 100 }),
        getExamRecords({ page: 1, pageSize: 100 }),
      ])
      setPapers(pRes.list || [])
      setRecords(rRes.list || [])
    } catch {
      Taro.showToast({ title: t('exam.detail.loadFailed'), icon: 'none' })
    } finally {
      setLoading(false)
    }
  }, [t])

  useDidShow(() => {
    load()
  })

  const answeredIds = useMemo(() => new Set(records.map((r) => r.paperId)), [records])
  const pendingList = useMemo(
    () => papers.filter((p) => !answeredIds.has(p.id)),
    [papers, answeredIds],
  )
  const paperMap = useMemo(() => new Map(papers.map((p) => [p.id, p])), [papers])

  const goDetail = (id: string) => Taro.navigateTo({ url: `/pages/exam/detail?id=${id}` })
  const goResult = (id: string) => Taro.navigateTo({ url: `/pages/exam/result?id=${id}` })

  const renderPaper = (e: Exam) => (
    <View key={e.id} className="bg-card rounded-2xl p-4 mb-3" onClick={() => goDetail(e.id)}>
      <View className="flex justify-between items-center">
        <Text className="text-base text-foreground font-semibold">{e.title}</Text>
        {e.categoryName && <Text className="text-xs text-primary">{e.categoryName}</Text>}
      </View>
      <View className="flex gap-3 mt-2">
        <Text className="text-xs text-muted-foreground">{t('exam.questions', { n: e.questionCount })}</Text>
        <Text className="text-xs text-muted-foreground">{t('exam.minutes', { n: e.duration })}</Text>
        <Text className="text-xs text-muted-foreground">{t('exam.passScore', { n: e.passScore })}</Text>
        <Text className="text-xs text-muted-foreground">{t('exam.totalScore', { n: e.totalScore })}</Text>
      </View>
    </View>
  )

  const renderRecord = (r: ExamRecord) => {
    const paper = paperMap.get(r.paperId)
    return (
      <View key={r.id} className="bg-card rounded-2xl p-4 mb-3" onClick={() => goResult(r.id)}>
        <View className="flex justify-between items-center">
          <Text className="text-base text-foreground font-semibold">
            {paper?.title ?? t('exam.removedPaper')}
          </Text>
          <Text className={`text-xs ${r.isPassed ? 'text-primary' : 'text-destructive'}`}>
            {r.isPassed ? t('exam.passed') : t('exam.notPassed')}
          </Text>
        </View>
        <View className="flex gap-3 mt-2">
          <Text className="text-xs text-muted-foreground">{t('exam.score', { n: r.score })}</Text>
          {paper && (
            <Text className="text-xs text-muted-foreground">
              {t('exam.totalScore', { n: paper.totalScore })}
            </Text>
          )}
          {r.submittedAt && (
            <Text className="text-xs text-muted-foreground">
              {new Intl.DateTimeFormat('zh-CN').format(new Date(r.submittedAt))}
            </Text>
          )}
        </View>
      </View>
    )
  }

  const curList = tab === 'completed' ? records : tab === 'pending' ? pendingList : papers
  const emptyKey =
    tab === 'completed'
      ? 'exam.empty.completed'
      : tab === 'pending'
        ? 'exam.empty.pending'
        : 'exam.empty.all'

  return (
    <View className="min-h-screen bg-background">
      <View className="flex bg-card">
        {TAB_KEYS.map((item) => (
          <View
            key={item.key}
            className={`flex-1 py-3 text-center text-sm ${tab === item.key ? 'text-primary font-semibold' : 'text-muted-foreground'}`}
            onClick={() => setTab(item.key)}
          >
            <View className={`inline-block px-2 py-0.5 rounded-md ${tab === item.key ? 'bg-primary/10' : ''}`}>
              {t(item.labelKey)}
            </View>
          </View>
        ))}
      </View>

      <View className="p-3">
        {tab === 'completed'
          ? records.map((r) => renderRecord(r))
          : tab === 'pending'
            ? pendingList.map((e) => renderPaper(e))
            : papers.map((e) => renderPaper(e))}
      </View>

      {!loading && curList.length === 0 && (
        <View className="text-center py-16 text-muted-foreground">
          <Text>{t(emptyKey)}</Text>
        </View>
      )}
    </View>
  )
}
