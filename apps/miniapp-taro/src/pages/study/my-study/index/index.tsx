// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

import { useI18n, type TtFn } from '@/i18n'
import { logger } from '@/utils/logger'
import { View, Text, ScrollView, Image } from '@tarojs/components'
import Taro, { useDidShow } from '@tarojs/taro'
import { useState, useCallback, useMemo } from 'react'
import * as api from '@/api'
import type { StudyRecord } from '@/api'
import { formatRelativeTime } from '@ihui/shared'
import ThemeRoot from '@/components/ThemeRoot'
import './index.css'

type TabKey = 'inProgress' | 'completed' | 'favorited'

const TABS = (tt: TtFn): Array<{ key: TabKey; labelKey: string; fallback: string }> => [
  {
    key: 'inProgress',
    labelKey: 'study.myStudy.tabs.inProgress',
    fallback: tt('plaza.index.tabOngoing', '进行中'),
  },
  {
    key: 'completed',
    labelKey: 'study.myStudy.tabs.completed',
    fallback: tt('plaza.index.tabDone', '已完成'),
  },
  {
    key: 'favorited',
    labelKey: 'study.myStudy.tabs.favorited',
    fallback: tt('ai.agentDetail.favorited', '已收藏'),
  },
]

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

  const inProgressList = useMemo(() => list.filter((item) => item.progress < 100), [list])
  const completedList = useMemo(() => list.filter((item) => item.progress >= 100), [list])

  const displayList =
    activeTab === 'inProgress' ? inProgressList : activeTab === 'completed' ? completedList : []

  const onContinue = useCallback((item: StudyRecord) => {
    Taro.navigateTo({ url: `/pages/course/detail?id=${item.courseId || item.id}` })
  }, [])

  const getEmptyText = useCallback(
    (tab: TabKey) => {
      if (tab === 'inProgress') return tt('study.myStudy.inProgressEmpty', '暂无进行中课程')
      if (tab === 'completed') return tt('study.myStudy.completedEmpty', '暂无已完成课程')
      return tt('study.myStudy.favoritedEmpty', '暂无收藏课程')
    },
    [tt],
  )

  if (loading && list.length === 0) {
    return (
      <ThemeRoot><View className="page-container">
        <View className="page-header">
          <Text className="page-title">{t('study.myStudy.title')}</Text>
        </View>
        <View className="page-content">
          <Text className="loading-text">{t('common.loading')}</Text>
        </View>
      </View>
    </ThemeRoot>)
  }

  if (error && list.length === 0) {
    return (
      <ThemeRoot><View className="page-container">
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
    </ThemeRoot>)
  }

  return (
    <ThemeRoot><View className="page-container">
      <View className="page-header">
        <Text className="page-title">{t('study.myStudy.title')}</Text>
      </View>
      <View className="tab-bar">
        {TABS(tt).map((tab) => (
          <ThemeRoot><Text
            key={tab.key}
            className={`tab-item ${activeTab === tab.key ? 'active' : ''}`}
            onClick={() => onTabChange(tab.key)}
          >
            {tt(tab.labelKey, tab.fallback)}
          </Text>
        </ThemeRoot>))}
      </View>
      <ScrollView scrollY className="page-content">
        {displayList.length > 0 ? (
          displayList.map((item) => (
            <ThemeRoot><View key={item.id} className="study-card">
              <View className="study-cover placeholder flex items-center justify-center">
                <Image
                  className="placeholder-icon"
                  style={{ width: '40rpx', height: '40rpx' }}
                  src="/static/images/icons/book-open.svg"
                  mode="aspectFit"
                />
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
                    {tt('study.myStudy.lastTime', '上次学习')}: {formatRelativeTime(item.time)}
                  </Text>
                ) : null}
                <Text className="continue-btn" onClick={() => onContinue(item)}>
                  {t('study.continueLearning')}
                </Text>
              </View>
            </View>
          </ThemeRoot>))
        ) : (
          <View className="empty-wrapper">
            <Image
              className="empty-icon"
              style={{ width: '80rpx', height: '80rpx' }}
              src="/static/images/icons/book-open.svg"
              mode="aspectFit"
            />
            <Text className="empty-text">{getEmptyText(activeTab)}</Text>
          </View></ThemeRoot>
        )}
      </ScrollView>
    </View>
  )
}
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
