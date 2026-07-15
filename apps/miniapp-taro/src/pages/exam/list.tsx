import { View, Text } from '@tarojs/components'
import Taro, { useDidShow } from '@tarojs/taro'
import { useState, useCallback, useMemo } from 'react'
import { getExamList, getExamRecords, type Exam, type ExamRecord } from '@/api'

type Tab = 'all' | 'pending' | 'completed'

const TABS: { key: Tab; label: string }[] = [
  { key: 'all', label: '全部' },
  { key: 'pending', label: '待考试' },
  { key: 'completed', label: '已完成' },
]

export default function ExamList() {
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
        <Text className="text-xs text-[#666]">{e.questionCount}题</Text>
        <Text className="text-xs text-[#666]">{e.duration}分钟</Text>
        <Text className="text-xs text-[#666]">及格{e.passScore}分</Text>
        <Text className="text-xs text-[#666]">满分{e.totalScore}分</Text>
      </View>
    </View>
  )

  const renderRecord = (r: ExamRecord) => {
    const paper = paperMap.get(r.paperId)
    return (
      <View key={r.id} className="bg-white rounded-2xl p-4 mb-3" onClick={() => goResult(r.id)}>
        <View className="flex justify-between items-center">
          <Text className="text-base text-[#333] font-semibold">
            {paper?.title ?? '已下架试卷'}
          </Text>
          <Text className={`text-xs ${r.isPassed ? 'text-green-600' : 'text-red-500'}`}>
            {r.isPassed ? '已通过' : '未通过'}
          </Text>
        </View>
        <View className="flex gap-3 mt-2">
          <Text className="text-xs text-[#666]">得分{r.score}</Text>
          {paper && <Text className="text-xs text-[#666]">满分{paper.totalScore}分</Text>}
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
  const emptyText =
    tab === 'completed' ? '暂无已完成考试' : tab === 'pending' ? '暂无待考试' : '暂无考试'

  return (
    <View className="min-h-screen bg-[#f7f8fa]">
      <View className="flex bg-white border-b border-[#eee]">
        {TABS.map((t) => (
          <View
            key={t.key}
            className={`flex-1 py-3 text-center text-sm ${tab === t.key ? 'text-[#07c160] font-semibold border-b-2 border-[#07c160]' : 'text-[#666]'}`}
            onClick={() => setTab(t.key)}
          >
            {t.label}
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
          <Text>{emptyText}</Text>
        </View>
      )}
    </View>
  )
}
