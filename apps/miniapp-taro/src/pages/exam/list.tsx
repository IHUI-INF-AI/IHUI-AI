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
    } finally {
      setLoading(false)
    }
  }, [])

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
    <View key={e.id} className="bg-white rounded-2xl p-4 mb-3" onClick={() => goDetail(e.id)}>
      <View className="flex justify-between items-center">
        <Text className="text-base text-[#333] font-semibold">{e.title}</Text>
        {e.categoryName && <Text className="text-xs text-[#07c160]">{e.categoryName}</Text>}
      </View>
      <View className="flex gap-3 mt-2">
        <Text className="text-xs text-[#666]">{t('exam.questions', { n: e.questionCount })}</Text>
        <Text className="text-xs text-[#666]">{t('exam.minutes', { n: e.duration })}</Text>
        <Text className="text-xs text-[#666]">{t('exam.passScore', { n: e.passScore })}</Text>
        <Text className="text-xs text-[#666]">{t('exam.totalScore', { n: e.totalScore })}</Text>
      </View>
    </View>
  )

  const renderRecord = (r: ExamRecord) => {
    const paper = paperMap.get(r.paperId)
    return (
      <View key={r.id} className="bg-white rounded-2xl p-4 mb-3" onClick={() => goResult(r.id)}>
        <View className="flex justify-between items-center">
          <Text className="text-base text-[#333] font-semibold">
            {paper?.title ?? t('exam.removedPaper')}
          </Text>
          <Text className={`text-xs ${r.isPassed ? 'text-green-600' : 'text-red-500'}`}>
            {r.isPassed ? t('exam.passed') : t('exam.notPassed')}
          </Text>
        </View>
        <View className="flex gap-3 mt-2">
          <Text className="text-xs text-[#666]">{t('exam.score', { n: r.score })}</Text>
          {paper && (
            <Text className="text-xs text-[#666]">
              {t('exam.totalScore', { n: paper.totalScore })}
            </Text>
          )}
          {r.submittedAt && (
            <Text className="text-xs text-[#999]">
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
    <View className="min-h-screen bg-[#f7f8fa]">
      <View className="flex bg-white border-b border-[#eee]">
        {TAB_KEYS.map((item) => (
          <View
            key={item.key}
            className={`flex-1 py-3 text-center text-sm ${tab === item.key ? 'text-[#07c160] font-semibold border-b-2 border-[#07c160]' : 'text-[#666]'}`}
            onClick={() => setTab(item.key)}
          >
            {t(item.labelKey)}
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
        <View className="text-center py-16 text-[#999]">
          <Text>{t(emptyKey)}</Text>
        </View>
      )}
    </View>
  )
}
