import { logger } from '@/utils/logger'
import { View, Text, Image, ScrollView } from '@tarojs/components'
import Taro, { useDidShow, useReachBottom } from '@tarojs/taro'
import { useState, useCallback, useMemo, useRef } from 'react'
import * as api from '@/api'
import { useI18n } from '@/i18n'
import './index.css'

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
      <View className="page-container">
        <View className="page-header">
          <Text className="page-title">{t('coursePlanet.title')}</Text>
        </View>
        <View className="page-content">
          <Text className="loading-text">{t('common.loading')}</Text>
        </View>
      </View>
    )
  }

  if (error && allList.length === 0) {
    return (
      <View className="page-container">
        <View className="page-header">
          <Text className="page-title">{t('coursePlanet.title')}</Text>
        </View>
        <View className="page-content">
          <Text className="empty-text">{tt('coursePlanet.loadFailed', '加载失败')}</Text>
          <Text className="btn" onClick={loadData}>
            {t('common.retry')}
          </Text>
        </View>
      </View>
    )
  }

  return (
    <View className="page-container">
      <View className="page-header">
        <Text className="page-title">{t('coursePlanet.title')}</Text>
      </View>
      <ScrollView scrollX className="category-bar">
        {CATEGORY_KEYS.map((cat) => (
          <Text
            key={cat.key}
            className={`category-item ${activeCategory === cat.key ? 'active' : ''}`}
            onClick={() => onCategoryChange(cat.key)}
          >
            {tt(cat.label, cat.key)}
          </Text>
        ))}
      </ScrollView>
      <View className="page-content">
        {displayList.length ? (
          displayList.map((item) => (
            <View key={item.id} className="course-card" onClick={() => onItemClick(item.id)}>
              {item.coverUrl ? (
                <Image className="course-cover" src={item.coverUrl} mode="aspectFill" />
              ) : (
                <View className="course-cover placeholder">
                  <Text className="placeholder-icon">📚</Text>
                </View>
              )}
              <View className="course-info">
                <Text className="course-title">{item.title}</Text>
                {item.teacher ? (
                  <Text className="course-teacher">
                    {tt('coursePlanet.teacher', '讲师')}: {item.teacher}
                  </Text>
                ) : null}
                <View className="course-meta">
                  {item.price != null ? (
                    <Text className="course-price">
                      {item.price === 0
                        ? tt('coursePlanet.free', '免费')
                        : `¥${item.price.toFixed(2)}`}
                    </Text>
                  ) : null}
                  {item.students != null ? (
                    <Text className="course-students">
                      {item.students} {tt('coursePlanet.studentsUnit', '人学习')}
                    </Text>
                  ) : null}
                </View>
              </View>
            </View>
          ))
        ) : (
          <View className="empty-wrapper">
            <Text className="empty-icon">🪐</Text>
            <Text className="empty-text">{t('coursePlanet.empty')}</Text>
          </View>
        )}
        {hasMore && displayList.length > 0 ? (
          <Text className="load-more-hint">{tt('coursePlanet.loadingMore', '加载中…')}</Text>
        ) : null}
        {!hasMore && displayList.length > 0 ? (
          <Text className="no-more-hint">{t('common.noMore')}</Text>
        ) : null}
      </View>
    </View>
  )
}
