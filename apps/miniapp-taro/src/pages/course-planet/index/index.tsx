import { logger } from '@/utils/logger'
import { View, Text, Image, ScrollView } from '@tarojs/components'
import Taro, { useDidShow, useReachBottom } from '@tarojs/taro'
import { useState, useCallback, useMemo, useRef } from 'react'
import * as api from '@/api'
import { useI18n } from '@/i18n'

interface PlanetCourse {
  id: string
  title: string
  coverUrl?: string
  teacher?: string
  price?: number
  students?: number
  category?: string
}

const PAGE_SIZE = 10

const CATEGORY_KEYS = [
  { key: 'all', label: 'coursePlanet.catAll' },
  { key: 'recommend', label: 'coursePlanet.catRecommend' },
  { key: 'hot', label: 'coursePlanet.catHot' },
  { key: 'new', label: 'coursePlanet.catNew' },
  { key: 'free', label: 'coursePlanet.catFree' },
]

export default function CoursePlanet() {
  const { t } = useI18n()
  const tt = useCallback(
    (k: string, fb: string) => {
      const v = t(k)
      return v === k ? fb : v
    },
    [t],
  )
  const [allList, setAllList] = useState<PlanetCourse[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState(false)
  const [activeCategory, setActiveCategory] = useState('all')
  const [displayCount, setDisplayCount] = useState(PAGE_SIZE)
  const loadingRef = useRef(false)

  const loadData = useCallback(async () => {
    if (loadingRef.current) return
    loadingRef.current = true
    setLoading(true)
    setError(false)
    try {
      const res = (await api.getCoursePlanet()) as Record<string, unknown>
      const rawList = (res?.list as Record<string, unknown>[]) || []
      const mapped: PlanetCourse[] = rawList.map((item, idx) => ({
        id: String(item.id ?? idx),
        title:
          (item.title as string) ||
          (item.name as string) ||
          (item.courseTitle as string) ||
          t('coursePlanet.course'),
        coverUrl:
          (item.coverUrl as string) ||
          (item.image as string) ||
          (item.pic as string) ||
          (item.thumbnail as string) ||
          '',
        teacher:
          (item.teacher as string) ||
          (item.instructor as string) ||
          (item.author as string) ||
          '',
        price: item.price != null ? Number(item.price) : undefined,
        students:
          item.students != null
            ? Number(item.students)
            : item.studyCount != null
              ? Number(item.studyCount)
              : item.learnCount != null
                ? Number(item.learnCount)
                : undefined,
        category: (item.category as string) || (item.tag as string) || (item.type as string) || '',
      }))
      setAllList(mapped)
      setDisplayCount(PAGE_SIZE)
    } catch (e) {
      logger.error('coursePlanet', '加载课程星球', e)
      setError(true)
    } finally {
      setLoading(false)
      loadingRef.current = false
    }
  }, [t])

  useDidShow(() => {
    loadData()
  })

  const onCategoryChange = useCallback((key: string) => {
    setActiveCategory(key)
    setDisplayCount(PAGE_SIZE)
  }, [])

  const filteredList = useMemo(() => {
    if (activeCategory === 'all') return allList
    if (activeCategory === 'free') return allList.filter((c) => !c.price || c.price === 0)
    return allList.filter(
      (c) => c.category && c.category.toLowerCase().includes(activeCategory),
    )
  }, [allList, activeCategory])

  const displayList = filteredList.slice(0, displayCount)
  const hasMore = displayCount < filteredList.length

  useReachBottom(() => {
    if (hasMore) {
      setDisplayCount((prev) => prev + PAGE_SIZE)
    }
  })

  const onItemClick = useCallback((id: string) => {
    Taro.navigateTo({ url: `/pages/course/detail?id=${id}` })
  }, [])

  if (loading && allList.length === 0) {
    return (
      <View className="min-h-screen bg-background">
        <View className="p-[24rpx] bg-card">
          <Text className="text-[36rpx] font-semibold text-foreground">{t('coursePlanet.title')}</Text>
        </View>
        <View className="p-[24rpx]">
          <Text className="block text-center text-muted-foreground py-[80rpx]">{t('common.loading')}</Text>
        </View>
      </View>
    )
  }

  if (error && allList.length === 0) {
    return (
      <View className="min-h-screen bg-background">
        <View className="p-[24rpx] bg-card">
          <Text className="text-[36rpx] font-semibold text-foreground">{t('coursePlanet.title')}</Text>
        </View>
        <View className="p-[24rpx]">
          <Text className="block text-center text-muted-foreground py-[40rpx]">{tt('coursePlanet.loadFailed', '加载失败')}</Text>
          <Text className="inline-block mt-[24rpx] px-[48rpx] py-[16rpx] bg-primary text-foreground text-center rounded-[12rpx] text-[28rpx]" onClick={loadData}>
            {t('common.retry')}
          </Text>
        </View>
      </View>
    )
  }

  return (
    <View className="min-h-screen bg-background">
      <View className="p-[24rpx] bg-card">
        <Text className="text-[36rpx] font-semibold text-foreground">{t('coursePlanet.title')}</Text>
      </View>
      <ScrollView scrollX className="whitespace-nowrap py-[16rpx] px-[24rpx] bg-card">
        {CATEGORY_KEYS.map((cat) => (
          <Text
            key={cat.key}
            className={`inline-block py-[12rpx] px-[32rpx] mr-[16rpx] text-[26rpx] text-muted-foreground bg-background rounded-[8rpx] ${activeCategory === cat.key ? 'text-foreground bg-primary font-semibold' : ''}`}
            onClick={() => onCategoryChange(cat.key)}
          >
            {tt(cat.label, cat.key)}
          </Text>
        ))}
      </ScrollView>
      <View className="p-[24rpx]">
        {displayList.length ? (
          displayList.map((item) => (
            <View key={item.id} className="flex p-[24rpx] bg-card rounded-[12rpx] mb-[16rpx]" onClick={() => onItemClick(item.id)}>
              {item.coverUrl ? (
                <Image className="w-[200rpx] h-[130rpx] rounded-[8rpx] flex-shrink-0 bg-muted" src={item.coverUrl} mode="aspectFill" />
              ) : (
                <View className="w-[200rpx] h-[130rpx] rounded-[8rpx] flex-shrink-0 bg-muted flex items-center justify-center">
                  <Text className="text-[48rpx]">📚</Text>
                </View>
              )}
              <View className="flex-1 ml-[16rpx] flex flex-col justify-between min-h-[130rpx]">
                <Text className="text-[28rpx] text-foreground font-semibold leading-[1.4] line-clamp-2">{item.title}</Text>
                {item.teacher ? (
                  <Text className="text-[24rpx] text-muted-foreground mt-[8rpx]">
                    {tt('coursePlanet.teacher', '讲师')}: {item.teacher}
                  </Text>
                ) : null}
                <View className="flex items-center justify-between mt-[8rpx]">
                  {item.price != null ? (
                    <Text className="text-[32rpx] text-[#f44336] font-bold">
                      {item.price === 0
                        ? tt('coursePlanet.free', '免费')
                        : `¥${item.price.toFixed(2)}`}
                    </Text>
                  ) : null}
                  {item.students != null ? (
                    <Text className="text-[22rpx] text-muted-foreground">
                      {item.students} {tt('coursePlanet.studentsUnit', '人学习')}
                    </Text>
                  ) : null}
                </View>
              </View>
            </View>
          ))
        ) : (
          <View className="flex flex-col items-center py-[120rpx]">
            <Text className="text-[80rpx] mb-[16rpx]">🪐</Text>
            <Text className="block text-center text-muted-foreground py-[40rpx]">{t('coursePlanet.empty')}</Text>
          </View>
        )}
        {hasMore && displayList.length > 0 ? (
          <Text className="block text-center text-muted-foreground text-[24rpx] py-[24rpx]">{tt('coursePlanet.loadingMore', '加载中…')}</Text>
        ) : null}
        {!hasMore && displayList.length > 0 ? (
          <Text className="block text-center text-muted-foreground text-[24rpx] py-[24rpx]">{t('common.noMore')}</Text>
        ) : null}
      </View>
    </View>
  )
}
