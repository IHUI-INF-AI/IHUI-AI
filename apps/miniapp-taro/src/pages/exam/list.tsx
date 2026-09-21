// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

import { useI18n } from '@/i18n'
import { View, Text } from '@tarojs/components'
import Taro, { useDidShow } from '@tarojs/taro'
import { useState, useCallback, useMemo } from 'react'
import { getExamList, getExamRecords, type Exam, type ExamRecord } from '@/api'
import { formatDateOnly } from '@ihui/shared'
import ThemeRoot from '@/components/ThemeRoot'

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

  // 对齐 RN ExamScreen header 返回键(navigateBack 失败降级回首页,同 check-in/task-center)
  const goBack = () => {
    Taro.navigateBack({ delta: 1 }).catch(() => {
      Taro.switchTab({ url: '/pages/index/index' })
    })
  }

  // 卡片对齐 RN ExamScreen card:p28rpx 圆角24rpx 2rpx描边(border);标题 36rpx/700 最多2行
  const renderPaper = (e: Exam) => (
    <ThemeRoot>
      <View
        key={e.id}
        className="bg-card rounded-[24rpx] p-[28rpx] mb-[20rpx] border border-solid border-border"
        hoverClass="opacity-60"
        onClick={() => goDetail(e.id)}
      >
        <View className="flex justify-between items-start gap-[16rpx]">
          <Text className="flex-1 text-[36rpx] font-bold text-foreground text-ellipsis-2">
            {e.title}
          </Text>
          {e.categoryName && (
            <View className="px-[16rpx] py-[8rpx] rounded-[16rpx] bg-[var(--color-muted)] shrink-0">
              <Text className="text-[22rpx] text-[var(--color-text-tertiary)]">
                {e.categoryName}
              </Text>
            </View>
          )}
        </View>
        <View className="flex flex-wrap gap-x-[24rpx] gap-y-[8rpx] mt-[16rpx]">
          <Text className="text-[28rpx] text-muted-foreground">
            {t('exam.questions', { n: e.questionCount })}
          </Text>
          <Text className="text-[28rpx] text-muted-foreground">
            {t('exam.minutes', { n: e.duration })}
          </Text>
          <Text className="text-[28rpx] text-muted-foreground">
            {t('exam.passScore', { n: e.passScore })}
          </Text>
          <Text className="text-[28rpx] text-muted-foreground">
            {t('exam.totalScore', { n: e.totalScore })}
          </Text>
        </View>
      </View>
    </ThemeRoot>
  )

  const renderRecord = (r: ExamRecord) => {
    const paper = paperMap.get(r.paperId)
    return (
      <ThemeRoot>
        <View
          key={r.id}
          className="bg-card rounded-[24rpx] p-[28rpx] mb-[20rpx] border border-solid border-border"
          hoverClass="opacity-60"
          onClick={() => goResult(r.id)}
        >
          <View className="flex justify-between items-start gap-[16rpx]">
            <Text className="flex-1 text-[36rpx] font-bold text-foreground text-ellipsis-2">
              {paper?.title ?? t('exam.removedPaper')}
            </Text>
            <View
              className={`px-[16rpx] py-[8rpx] rounded-[16rpx] shrink-0 ${
                r.isPassed ? 'bg-[var(--color-success-light)]' : 'bg-[var(--color-danger-light)]'
              }`}
            >
              <Text
                className={`text-[22rpx] ${
                  r.isPassed
                    ? 'text-[var(--color-success-deep-text)]'
                    : 'text-[var(--color-danger)]'
                }`}
              >
                {r.isPassed ? t('exam.passed') : t('exam.notPassed')}
              </Text>
            </View>
          </View>
          <View className="flex flex-wrap gap-x-[24rpx] gap-y-[8rpx] mt-[16rpx]">
            <Text className="text-[28rpx] text-muted-foreground">
              {t('exam.score', { n: r.score })}
            </Text>
            {paper && (
              <Text className="text-[28rpx] text-muted-foreground">
                {t('exam.totalScore', { n: paper.totalScore })}
              </Text>
            )}
            {r.submittedAt && (
              <Text className="text-[28rpx] text-muted-foreground">
                {formatDateOnly(r.submittedAt)}
              </Text>
            )}
          </View>
        </View>
      </ThemeRoot>
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
    <ThemeRoot>
      <View className="min-h-screen bg-background">
        {/* header 对齐 RN ExamScreen header(px20rpx / pt24rpx 平台适配原生导航栏 / pb16rpx) */}
        <View className="flex flex-col px-[20rpx] pt-[24rpx] pb-[16rpx]">
          <View className="self-start" hoverClass="opacity-60" onClick={goBack}>
            <Text className="text-[32rpx] text-muted-foreground">{t('common.back')}</Text>
          </View>
          <Text className="mt-[16rpx] text-[44rpx] font-semibold text-foreground">
            {t('exam.title')}
          </Text>
        </View>

        {/* tab 胶囊对齐 RN 共享屏 tab 样式(圆角24rpx / bg-card,激活 bg-primary 白字) */}
        <View className="flex flex-row px-[20rpx] py-[16rpx] gap-[12rpx]">
          {TAB_KEYS.map((item) => (
            <View
              key={item.key}
              className={`px-[24rpx] py-[12rpx] rounded-[24rpx] ${
                tab === item.key ? 'bg-primary' : 'bg-card'
              }`}
              hoverClass="opacity-60"
              onClick={() => setTab(item.key)}
            >
              <Text
                className={`text-[28rpx] ${
                  tab === item.key ? 'text-primary-foreground' : 'text-muted-foreground'
                }`}
              >
                {t(item.labelKey)}
              </Text>
            </View>
          ))}
        </View>

        <View className="p-[28rpx] pb-[64rpx]">
          {tab === 'completed'
            ? records.map((r) => renderRecord(r))
            : tab === 'pending'
              ? pendingList.map((e) => renderPaper(e))
              : papers.map((e) => renderPaper(e))}
        </View>

        {/* 空态/加载态对齐 RN emptyText(28rpx text-tertiary 居中) */}
        {!loading && curList.length === 0 && (
          <View className="flex justify-center py-[80rpx]">
            <Text className="text-[28rpx] text-[var(--color-text-tertiary)]">{t(emptyKey)}</Text>
          </View>
        )}
        {loading && curList.length === 0 && (
          <View className="flex justify-center py-[80rpx]">
            <Text className="text-[28rpx] text-[var(--color-text-tertiary)]">
              {t('common.loading')}
            </Text>
          </View>
        )}
      </View>
    </ThemeRoot>
  )
}
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
