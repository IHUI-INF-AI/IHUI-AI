import { logger } from '@/utils/logger'
import { View, Text, Image } from '@tarojs/components'
import Taro, { useDidShow } from '@tarojs/taro'
import { useState, useCallback } from 'react'
import * as api from '@/api'
import type { Course } from '@/api'
import { useI18n } from '@/i18n'
import './index.css'

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
    <View className="page-container">
      <View className="page-header">
        <Text className="page-title">{t('learnDevelop.title')}</Text>
      </View>
      <View className="page-content">
        {/* 学习路径 */}
        <View className="section-header">
          <Text className="section-title">{tt('learnDevelop.pathTitle', '学习路径')}</Text>
        </View>
        {LEARN_PATHS.map((path) => (
          <View key={path.id} className="path-card">
            <View className="path-icon-wrapper">
              <Text className="path-icon">{path.icon}</Text>
            </View>
            <View className="path-info">
              <Text className="path-name">{tt(path.nameKey, path.name)}</Text>
              <Text className="path-meta">
                {path.courses} {tt('learnDevelop.coursesUnit', '门课')} ·{' '}
                {tt('learnDevelop.progress', '进度')} {path.progress}%
              </Text>
              <View className="progress-bar-wrapper">
                <View
                  className="progress-bar-inner"
                  style={{ width: `${path.progress}%` }}
                />
              </View>
            </View>
          </View>
        ))}

        {/* 推荐课程 */}
        <View className="section-header">
          <Text className="section-title">{tt('learnDevelop.recommend', '推荐课程')}</Text>
        </View>
        {loading && courseList.length === 0 ? (
          <Text className="loading-text">{t('common.loading')}</Text>
        ) : error && courseList.length === 0 ? (
          <View className="error-wrapper">
            <Text className="empty-text">{tt('learnDevelop.loadFailed', '加载失败')}</Text>
            <Text className="btn" onClick={loadData}>
              {t('common.retry')}
            </Text>
          </View>
        ) : courseList.length > 0 ? (
          courseList.map((item) => (
            <View
              key={item.id}
              className="course-card"
              onClick={() => onItemClick(item.id)}
            >
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
                    {tt('learnDevelop.teacher', '讲师')}: {item.teacher}
                  </Text>
                ) : null}
                {item.price != null ? (
                  <Text className="course-price">
                    {item.price === 0
                      ? tt('learnDevelop.free', '免费')
                      : `¥${item.price.toFixed(2)}`}
                  </Text>
                ) : null}
              </View>
            </View>
          ))
        ) : (
          <Text className="empty-text">{t('learnDevelop.empty')}</Text>
        )}

        {/* 学习排行榜入口 */}
        <View className="rank-entry" onClick={onGoRank}>
          <View className="rank-entry-left">
            <Text className="rank-entry-icon">🏆</Text>
            <Text className="rank-entry-text">{tt('learnDevelop.rankEntry', '学习排行榜')}</Text>
          </View>
          <Text className="rank-entry-arrow">›</Text>
        </View>
      </View>
    </View>
  )
}
