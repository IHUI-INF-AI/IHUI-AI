// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

import { useI18n, type TtFn } from '@/i18n'
import { logger } from '@/utils/logger'
import { View, Text, ScrollView } from '@tarojs/components'
import LineIcon from '@/components/LineIcon'
import Taro, { useDidShow } from '@tarojs/taro'
import { useState, useCallback, useMemo } from 'react'
import * as api from '@/api'
import type { StudyRecord } from '@/api'
import { formatRelativeTime } from '@ihui/shared'
import ThemeRoot from '@/components/ThemeRoot'
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
      <ThemeRoot>
        {/* 对齐 RN StudyRecordScreen(共享屏):容器 bg surface.bg;header px10dp→20rpx/pt48dp→96rpx/pb12dp→24rpx,标题 20dp→40rpx/600 */}
        <View className="flex flex-col h-screen bg-background">
          <View className="px-[20rpx] pt-[96rpx] pb-[24rpx] flex-shrink-0">
            <Text className="text-[40rpx] font-semibold text-foreground">
              {t('study.myStudy.title')}
            </Text>
          </View>
          <View className="flex-1 min-h-[0] flex flex-col items-center pt-[96rpx]">
            <Text className="text-[28rpx] text-muted-foreground">{t('common.loading')}</Text>
          </View>
        </View>
      </ThemeRoot>
    )
  }

  if (error && list.length === 0) {
    return (
      <ThemeRoot>
        <View className="flex flex-col h-screen bg-background">
          <View className="px-[20rpx] pt-[96rpx] pb-[24rpx] flex-shrink-0">
            <Text className="text-[40rpx] font-semibold text-foreground">
              {t('study.myStudy.title')}
            </Text>
          </View>
          <View className="flex-1 min-h-[0] flex flex-col items-center pt-[96rpx] px-[20rpx]">
            <Text className="text-[28rpx] text-[var(--color-danger)]">
              {tt('study.myStudy.loadFailed', '加载失败')}
            </Text>
            <View
              className="mt-[24rpx] px-[32rpx] py-[16rpx] bg-primary rounded-[24rpx]"
              hoverClass="opacity-60"
              onClick={loadData}
            >
              <Text className="text-[28rpx] font-semibold text-primary-foreground">
                {t('common.retry')}
              </Text>
            </View>
          </View>
        </View>
      </ThemeRoot>
    )
  }

  return (
    <ThemeRoot>
      <View className="flex flex-col h-screen bg-background">
        <View className="px-[20rpx] pt-[96rpx] pb-[24rpx] flex-shrink-0">
          <Text className="text-[40rpx] font-semibold text-foreground">
            {t('study.myStudy.title')}
          </Text>
        </View>
        {/* 状态筛选 tab 为业务保留,视觉对齐 RN tab 语言(RankingScreen tabs:radius 12dp→24rpx / 激活 bg brand */}
        <View className="flex gap-[12rpx] px-[20rpx] pb-[16rpx] flex-shrink-0">
          {TABS(tt).map((tab) => (
            <View
              key={tab.key}
              className={`flex-1 flex items-center justify-center py-[12rpx] rounded-[24rpx] text-[28rpx] ${
                activeTab === tab.key
                  ? 'bg-primary text-primary-foreground font-semibold'
                  : 'bg-card text-muted-foreground'
              }`}
              hoverClass="opacity-60"
              onClick={() => onTabChange(tab.key)}
            >
              <Text>{tt(tab.labelKey, tab.fallback)}</Text>
            </View>
          ))}
        </View>
        <ScrollView scrollY className="flex-1 min-h-[0]">
          {/* 列表对齐 RN listBody p14dp→28rpx + separator 8dp→16rpx(gap);卡片对齐 RN card:p28rpx / radius 12dp→24rpx / border light / 标题 16dp→32rpx/700 / 时间 11dp→22rpx text.tertiary */}
          <View className="p-[28rpx] pb-[64rpx] flex flex-col gap-[16rpx]">
            {displayList.length > 0 ? (
              displayList.map((item) => (
                <View
                  key={item.id}
                  className="flex p-[28rpx] rounded-[24rpx] border border-border bg-card"
                >
                  <View className="w-[160rpx] h-[100rpx] rounded-[16rpx] flex-shrink-0 bg-muted flex items-center justify-center">
                    <LineIcon name="book-open" size={40} color="var(--color-muted-foreground)" />
                  </View>
                  <View className="flex-1 ml-[16rpx] flex flex-col">
                    <Text className="text-[32rpx] text-foreground font-bold leading-[1.4] overflow-hidden">
                      {item.courseTitle || t('study.myStudy.courseFallback')}
                    </Text>
                    <View className="flex items-center mt-[16rpx]">
                      <View className="flex-1 h-[8rpx] bg-muted rounded-[4rpx] overflow-hidden mr-[12rpx]">
                        <View
                          className="h-full bg-success rounded-[4rpx]"
                          style={{ width: `${Math.min(100, Math.max(0, item.progress))}%` }}
                        />
                      </View>
                      <Text className="text-[22rpx] text-muted-foreground flex-shrink-0">
                        {tt('study.myStudy.progress', '进度')} {item.progress}%
                      </Text>
                    </View>
                    {item.time ? (
                      <Text className="text-[22rpx] text-[var(--color-text-tertiary)] mt-[8rpx]">
                        {tt('study.myStudy.lastTime', '上次学习')}: {formatRelativeTime(item.time)}
                      </Text>
                    ) : null}
                    <View
                      className="self-start mt-[16rpx] px-[32rpx] py-[16rpx] bg-primary rounded-[24rpx]"
                      hoverClass="opacity-60"
                      onClick={() => onContinue(item)}
                    >
                      <Text className="text-[28rpx] font-semibold text-primary-foreground">
                        {t('study.continueLearning')}
                      </Text>
                    </View>
                  </View>
                </View>
              ))
            ) : (
              <View className="flex flex-col items-center py-[96rpx]">
                <LineIcon
                  name="book-open"
                  size={80}
                  color="var(--color-text-tertiary)"
                  style={{ marginBottom: '16rpx' }}
                />
                <Text className="block text-center text-[28rpx] text-muted-foreground">
                  {getEmptyText(activeTab)}
                </Text>
              </View>
            )}
          </View>
        </ScrollView>
      </View>
    </ThemeRoot>
  )
}
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
