import { logger } from '@/utils/logger'
import { View, Text, ScrollView } from '@tarojs/components'
import Taro, { useDidShow } from '@tarojs/taro'
import { useState, useCallback, useMemo } from 'react'
import * as api from '@/api'
import type { StudyRecord } from '@/api'
import { useI18n } from '@/i18n'
import './index.css'

type TabKey = 'inProgress' | 'completed' | 'favorited'

const TABS: Array<{ key: TabKey; labelKey: string; fallback: string }> = [
  { key: 'inProgress', labelKey: 'study.myStudy.tabs.inProgress', fallback: '进行中' },
  { key: 'completed', labelKey: 'study.myStudy.tabs.completed', fallback: '已完成' },
  { key: 'favorited', labelKey: 'study.myStudy.tabs.favorited', fallback: '已收藏' },
]

function formatTime(time: string): string {
  if (!time) return ''
  try {
    const d = new Date(time)
    if (isNaN(d.getTime())) return time.slice(0, 10)
    const now = new Date()
    const diff = now.getTime() - d.getTime()
    if (diff < 60000) return '刚刚'
    if (diff < 3600000) return `${Math.floor(diff / 60000)} 分钟前`
    if (diff < 86400000) return `${Math.floor(diff / 3600000)} 小时前`
    if (diff < 604800000) return `${Math.floor(diff / 86400000)} 天前`
    const y = d.getFullYear()
    const m = String(d.getMonth() + 1).padStart(2, '0')
    const day = String(d.getDate()).padStart(2, '0')
    return `${y}-${m}-${day}`
  } catch {
    return time.slice(0, 10)
  }
}

export default function MyStudy() {
  const { t } = useI18n()
  const tt = useCallback(
    (k: string, fb: string) => {
      const v = t(k)
      return v === k ? fb : v
    },
    [t],
  )
  const [list, setList] = useState<StudyRecord[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState(false)
  const [activeTab, setActiveTab] = useState<TabKey>('inProgress')

  const loadData = useCallback(async () => {
    setLoading(true)
    setError(false)
    try {
      const res = await api.getStudyRecords({ page: 1, pageSize: 50 })
      setList(res?.list || [])
    } catch (e) {
      logger.error('myStudy', '加载我的课程', e)
      setError(true)
    } finally {
      setLoading(false)
    }
  }, [])

  useDidShow(() => {
    loadData()
  })

  const onTabChange = useCallback((key: TabKey) => {
    setActiveTab(key)
  }, [])

  const inProgressList = useMemo(
    () => list.filter((item) => item.progress < 100),
    [list],
  )
  const completedList = useMemo(
    () => list.filter((item) => item.progress >= 100),
    [list],
  )

  const displayList = activeTab === 'inProgress' ? inProgressList : activeTab === 'completed' ? completedList : []

  const onContinue = useCallback((item: StudyRecord) => {
    Taro.navigateTo({ url: `/pages/course/detail?id=${item.courseId || item.id}` })
  }, [])

  const getEmptyText = useCallback(
    (tab: TabKey) => {
      if (tab === 'inProgress')
        return tt('study.myStudy.inProgressEmpty', '暂无进行中课程')
      if (tab === 'completed')
        return tt('study.myStudy.completedEmpty', '暂无已完成课程')
      return tt('study.myStudy.favoritedEmpty', '暂无收藏课程')
    },
    [tt],
  )

  if (loading && list.length === 0) {
    return (
      <View className="page-container">
        <View className="page-header">
          <Text className="page-title">{t('study.myStudy.title')}</Text>
        </View>
        <View className="page-content">
          <Text className="loading-text">{t('common.loading')}</Text>
        </View>
      </View>
    )
  }

  if (error && list.length === 0) {
    return (
      <View className="page-container">
        <View className="page-header">
          <Text className="page-title">{t('study.myStudy.title')}</Text>
        </View>
        <View className="page-content">
          <Text className="empty-text">{tt('study.myStudy.loadFailed', '加载失败')}</Text>
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
        <Text className="page-title">{t('study.myStudy.title')}</Text>
      </View>
      <View className="tab-bar">
        {TABS.map((tab) => (
          <Text
            key={tab.key}
            className={`tab-item ${activeTab === tab.key ? 'active' : ''}`}
            onClick={() => onTabChange(tab.key)}
          >
            {tt(tab.labelKey, tab.fallback)}
          </Text>
        ))}
      </View>
      <ScrollView scrollY className="page-content">
        {displayList.length > 0 ? (
          displayList.map((item) => (
            <View key={item.id} className="study-card">
              <View className="study-cover placeholder">
                <Text className="placeholder-icon">📖</Text>
              </View>
              <View className="study-info">
                <Text className="study-title">
                  {item.courseTitle || t('study.myStudy.courseFallback')}
                </Text>
                <View className="progress-section">
                  <View className="progress-bar-wrapper">
                    <View
                      className="progress-bar-inner"
                      style={{ width: `${Math.min(100, Math.max(0, item.progress))}%` }}
                    />
                  </View>
                  <Text className="progress-text">
                    {tt('study.myStudy.progress', '进度')} {item.progress}%
                  </Text>
                </View>
                {item.time ? (
                  <Text className="study-time">
                    {tt('study.myStudy.lastTime', '上次学习')}: {formatTime(item.time)}
                  </Text>
                ) : null}
                <Text
                  className="continue-btn"
                  onClick={() => onContinue(item)}
                >
                  {t('study.continueLearning')}
                </Text>
              </View>
            </View>
          ))
        ) : (
          <View className="empty-wrapper">
            <Text className="empty-icon">📚</Text>
            <Text className="empty-text">{getEmptyText(activeTab)}</Text>
          </View>
        )}
      </ScrollView>
    </View>
  )
}
