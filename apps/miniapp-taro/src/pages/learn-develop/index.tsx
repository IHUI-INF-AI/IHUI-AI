import { logger } from '@/utils/logger'
import { View, Text, Image } from '@tarojs/components'
import Taro, { useDidShow } from '@tarojs/taro'
import { useState, useCallback } from 'react'
import * as api from '@/api'
import type { Course } from '@/api'
import { useI18n } from '@/i18n'

interface LearnPath {
  id: string
  icon: string
  nameKey: string
  name: string
  courses: number
  progress: number
}

const LEARN_PATHS: LearnPath[] = [
  {
    id: 'p1',
    icon: '🚀',
    nameKey: 'learnDevelop.pathFrontend',
    name: '前端工程师',
    courses: 12,
    progress: 35,
  },
  {
    id: 'p2',
    icon: '🤖',
    nameKey: 'learnDevelop.pathAI',
    name: 'AI 应用开发',
    courses: 8,
    progress: 0,
  },
  {
    id: 'p3',
    icon: '📊',
    nameKey: 'learnDevelop.pathData',
    name: '数据分析师',
    courses: 15,
    progress: 60,
  },
]

export default function LearnDevelop() {
  const { t } = useI18n()
  const tt = useCallback(
    (k: string, fb: string) => {
      const v = t(k)
      return v === k ? fb : v
    },
    [t],
  )
  const [courseList, setCourseList] = useState<Course[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState(false)

  const loadData = useCallback(async () => {
    setLoading(true)
    setError(false)
    try {
      const res = await api.getCourseList({ page: 1, pageSize: 5 })
      setCourseList(res?.list || [])
    } catch (e) {
      logger.error('learnDevelop', '加载课程', e)
      setError(true)
    } finally {
      setLoading(false)
    }
  }, [])

  useDidShow(() => {
    loadData()
  })

  const onItemClick = useCallback((id: string | number) => {
    Taro.navigateTo({ url: `/pages/course/detail?id=${id}` })
  }, [])

  const onGoRank = useCallback(() => {
    Taro.navigateTo({ url: '/pages/study/rank' })
  }, [])

  return (
    <View className="min-h-screen bg-background">
      <View className="p-[24rpx] bg-card">
        <Text className="text-[36rpx] font-semibold text-foreground">{t('learnDevelop.title')}</Text>
      </View>
      <View className="p-[24rpx]">
        {/* 学习路径 */}
        <View className="first:mt-0 mt-[24rpx] mb-[16rpx]">
          <Text className="text-[32rpx] font-semibold text-foreground">{tt('learnDevelop.pathTitle', '学习路径')}</Text>
        </View>
        {LEARN_PATHS.map((path) => (
          <View key={path.id} className="flex items-center p-[24rpx] bg-card rounded-[12rpx] mb-[16rpx]">
            <View className="w-[88rpx] h-[88rpx] flex items-center justify-center bg-background rounded-[12rpx] flex-shrink-0 mr-[16rpx]">
              <Text className="text-[48rpx]">{path.icon}</Text>
            </View>
            <View className="flex-1 flex flex-col">
              <Text className="text-[30rpx] font-semibold text-foreground">{tt(path.nameKey, path.name)}</Text>
              <Text className="text-[24rpx] text-muted-foreground mt-[8rpx]">
                {path.courses} {tt('learnDevelop.coursesUnit', '门课')} ·{' '}
                {tt('learnDevelop.progress', '进度')} {path.progress}%
              </Text>
              <View className="h-[8rpx] bg-muted rounded-[4rpx] mt-[12rpx] overflow-hidden">
                <View
                  className="h-full bg-primary rounded-[4rpx]"
                  style={{ width: `${path.progress}%` }}
                />
              </View>
            </View>
          </View>
        ))}

        {/* 推荐课程 */}
        <View className="first:mt-0 mt-[24rpx] mb-[16rpx]">
          <Text className="text-[32rpx] font-semibold text-foreground">{tt('learnDevelop.recommend', '推荐课程')}</Text>
        </View>
        {loading && courseList.length === 0 ? (
          <Text className="block text-center text-muted-foreground py-[80rpx]">{t('common.loading')}</Text>
        ) : error && courseList.length === 0 ? (
          <View className="flex flex-col items-center py-[40rpx]">
            <Text className="block text-center text-muted-foreground py-[40rpx]">{tt('learnDevelop.loadFailed', '加载失败')}</Text>
            <Text className="inline-block mt-[24rpx] py-[16rpx] px-[48rpx] bg-primary text-foreground text-center rounded-[12rpx] text-[28rpx]" onClick={loadData}>
              {t('common.retry')}
            </Text>
          </View>
        ) : courseList.length > 0 ? (
          courseList.map((item) => (
            <View
              key={item.id}
              className="flex p-[24rpx] bg-card rounded-[12rpx] mb-[16rpx]"
              onClick={() => onItemClick(item.id)}
            >
              {item.coverUrl ? (
                <Image className="w-[200rpx] h-[130rpx] rounded-[8rpx] flex-shrink-0 bg-muted" src={item.coverUrl} mode="aspectFill" />
              ) : (
                <View className="w-[200rpx] h-[130rpx] rounded-[8rpx] flex-shrink-0 bg-muted flex items-center justify-center">
                  <Text className="text-[48rpx]">📚</Text>
                </View>
              )}
              <View className="flex-1 ml-[16rpx] flex flex-col justify-between min-h-[130rpx]">
                <Text className="text-[28rpx] text-foreground font-semibold leading-[1.4] line-clamp-2 overflow-hidden">{item.title}</Text>
                {item.teacher ? (
                  <Text className="text-[24rpx] text-muted-foreground mt-[8rpx]">
                    {tt('learnDevelop.teacher', '讲师')}: {item.teacher}
                  </Text>
                ) : null}
                {item.price != null ? (
                  <Text className="text-[32rpx] text-[#f44336] font-bold">
                    {item.price === 0
                      ? tt('learnDevelop.free', '免费')
                      : `¥${item.price.toFixed(2)}`}
                  </Text>
                ) : null}
              </View>
            </View>
          ))
        ) : (
          <Text className="block text-center text-muted-foreground py-[40rpx]">{t('learnDevelop.empty')}</Text>
        )}

        {/* 学习排行榜入口 */}
        <View className="flex items-center justify-between p-[24rpx] bg-card rounded-[12rpx] mt-[24rpx]" onClick={onGoRank}>
          <View className="flex items-center">
            <Text className="text-[40rpx] mr-[16rpx]">🏆</Text>
            <Text className="text-[28rpx] text-foreground font-semibold">{tt('learnDevelop.rankEntry', '学习排行榜')}</Text>
          </View>
          <Text className="text-[36rpx] text-muted-foreground">›</Text>
        </View>
      </View>
    </View>
  )
}
