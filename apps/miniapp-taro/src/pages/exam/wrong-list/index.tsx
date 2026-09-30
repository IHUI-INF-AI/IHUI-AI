// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

// 平台特有:依赖 @tarojs/components 与 Taro 分页导航,不适合共享层。
import { useI18n } from '@/i18n'
import { View, Text } from '@tarojs/components'
import Taro, { useDidShow } from '@tarojs/taro'
import { useState, useCallback } from 'react'
import { get, post, deleteExamWrongQuestion } from '@/api'
import ThemeRoot from '@/components/ThemeRoot'
import BackChevron from '@/components/BackChevron'

/** 错题行(对齐 web 端 wrong-questions 页的 WrongQuestion 形状子集,最小可用只取渲染所需字段) */
interface WrongQuestionItem {
  id: string
  questionId: string
  paperId: string
  paperTitle: string | null
  questionTitle: string | null
  wrongCount: number
  isMastered: boolean
  createdAt: string
}

interface WrongListData {
  list: WrongQuestionItem[]
  total: number
  page: number
  pageSize: number
}

interface ExplainData {
  explanation: string
  cached: boolean
}

const PAGE_SIZE = 20

export default function WrongList() {
  const { t } = useI18n()
  const [items, setItems] = useState<WrongQuestionItem[]>([])
  const [total, setTotal] = useState(0)
  const [page, setPage] = useState(1)
  const [loading, setLoading] = useState(false)
  const [explainingId, setExplainingId] = useState<string | null>(null)
  const [explanations, setExplanations] = useState<Record<string, string>>({})

  const load = useCallback(
    async (nextPage: number, append: boolean) => {
      setLoading(true)
      try {
        const res = await get<WrongListData>('/exam/wrong-questions', {
          page: nextPage,
          pageSize: PAGE_SIZE,
        })
        setItems((prev) => (append ? [...prev, ...(res.list || [])] : res.list || []))
        setTotal(res.total || 0)
        setPage(nextPage)
      } catch {
        Taro.showToast({ title: t('exam.detail.loadFailed'), icon: 'none' })
      } finally {
        setLoading(false)
      }
    },
    [t],
  )

  useDidShow(() => {
    load(1, false)
  })

  const handleExplain = useCallback(
    async (item: WrongQuestionItem) => {
      if (explainingId !== null) return
      setExplainingId(item.id)
      try {
        const res = await post<ExplainData>(`/exam/wrong-questions/${item.questionId}/explain`, {})
        setExplanations((prev) => ({ ...prev, [item.id]: res.explanation }))
      } catch {
        Taro.showToast({ title: t('exam.detail.loadFailed'), icon: 'none' })
      } finally {
        setExplainingId(null)
      }
    },
    [explainingId, t],
  )

  const handleDelete = useCallback(
    (item: WrongQuestionItem) => {
      Taro.showModal({
        title: t('common.confirm'),
        content: item.questionTitle || item.paperTitle || item.questionId,
        confirmText: t('common.delete'),
        cancelText: t('common.cancel'),
        success: (res) => {
          if (!res.confirm) return
          deleteExamWrongQuestion(item.id)
            .then(() => {
              setItems((prev) => prev.filter((it) => it.id !== item.id))
              setTotal((prev) => Math.max(0, prev - 1))
              Taro.showToast({ title: t('common.success'), icon: 'none' })
            })
            .catch(() => {
              Taro.showToast({ title: t('exam.detail.loadFailed'), icon: 'none' })
            })
        },
      })
    },
    [t],
  )

  const goBack = () => Taro.navigateBack()

  return (
    <ThemeRoot>
      <View className="min-h-screen bg-background">
        <View className="flex flex-row items-center px-[20rpx] pt-[24rpx] pb-[16rpx] gap-[16rpx]">
          <BackChevron onTap={goBack} />
          <Text className="text-[length:44rpx] font-semibold text-foreground">错题本</Text>
        </View>

        <View className="p-[28rpx] pb-[64rpx]">
          {items.map((item) => (
            <View
              key={item.id}
              className="bg-card rounded-lg p-[28rpx] mb-[20rpx] border border-solid border-border"
            >
              <Text className="text-[length:32rpx] font-bold text-foreground text-ellipsis-2">
                {item.questionTitle || item.paperTitle || item.questionId}
              </Text>
              <View className="flex flex-row flex-wrap gap-x-[24rpx] gap-y-[8rpx] mt-[16rpx]">
                <Text className="text-[length:28rpx] text-muted-foreground">
                  {t('exam.questions', { n: item.wrongCount })}
                </Text>
                {item.paperTitle && item.questionTitle && (
                  <Text className="text-[length:28rpx] text-[var(--color-text-tertiary)]">
                    {item.paperTitle}
                  </Text>
                )}
              </View>
              {explanations[item.id] && (
                <View className="mt-[16rpx] rounded-md bg-[var(--color-muted)] p-[20rpx]">
                  <Text className="text-[length:28rpx] text-foreground">
                    {explanations[item.id]}
                  </Text>
                </View>
              )}
              <View className="flex flex-row gap-[16rpx] mt-[16rpx]">
                <View
                  className="px-[24rpx] py-[12rpx] rounded-lg bg-primary"
                  hoverClass="opacity-60"
                  onClick={() => handleExplain(item)}
                >
                  <Text className="text-[length:28rpx] text-primary-foreground">
                    {explainingId === item.id ? t('common.loading') : 'AI 讲解'}
                  </Text>
                </View>
                <View
                  className="px-[24rpx] py-[12rpx] rounded-lg bg-card border border-solid border-border"
                  hoverClass="opacity-60"
                  onClick={() => handleDelete(item)}
                >
                  <Text className="text-[length:28rpx] text-[var(--color-danger)]">
                    {t('common.delete')}
                  </Text>
                </View>
              </View>
            </View>
          ))}
        </View>

        {!loading && items.length === 0 && (
          <View className="flex justify-center py-[80rpx]">
            <Text className="text-[length:28rpx] text-[var(--color-text-tertiary)]">
              {t('common.empty')}
            </Text>
          </View>
        )}
        {loading && items.length === 0 && (
          <View className="flex justify-center py-[80rpx]">
            <Text className="text-[length:28rpx] text-[var(--color-text-tertiary)]">
              {t('common.loading')}
            </Text>
          </View>
        )}
        {items.length < total && (
          <View className="flex justify-center pb-[64rpx]">
            <View
              className="px-[32rpx] py-[12rpx] rounded-lg bg-card border border-solid border-border"
              hoverClass="opacity-60"
              onClick={() => load(page + 1, true)}
            >
              <Text className="text-[length:28rpx] text-muted-foreground">
                {loading ? t('common.loading') : t('common.more')}
              </Text>
            </View>
          </View>
        )}
      </View>
    </ThemeRoot>
  )
}
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
