import { logger } from '@/utils/logger'
import { View, Text, Image, Input, ScrollView } from '@tarojs/components'
import Taro, { useDidShow, useReachBottom, usePullDownRefresh } from '@tarojs/taro'
import { useState, useCallback, useRef } from 'react'
import { getTopicList } from '@/api'
import { TOPIC_EVENT } from '@/constants/events'
import { NavBar } from '@/components'
import { useI18n } from '@/i18n'

interface TopicItem {
  id: string
  name: string
  count: number
  coverUrl?: string
  description?: string
  participantCount?: number
}

type TabKey = 'recommend' | 'hot' | 'all'

const PAGE_SIZE = 20

export default function TopicListPage() {
  const { t } = useI18n()
  const tt = (k: string, fb: string, params?: Record<string, string | number>) => {
    const v = params ? t(k, params) : t(k)
    if (v !== k) return v
    if (!params) return fb
    return fb.replace(/\{(\w+)\}/g, (_, key) => String(params[key] ?? ''))
  }
  const [list, setList] = useState<TopicItem[]>([])
  const [loading, setLoading] = useState(false)
  const [loadingMore, setLoadingMore] = useState(false)
  const [error, setError] = useState(false)
  const [from, setFrom] = useState('')
  const [hasMore, setHasMore] = useState(true)
  const [searchText, setSearchText] = useState('')
  const [activeTab, setActiveTab] = useState<TabKey>('recommend')

  const pageRef = useRef(1)
  const hasMoreRef = useRef(true)
  const loadingRef = useRef(false)

  const load = useCallback(
    async (reset = false) => {
      if (loadingRef.current) return
      if (reset) {
        pageRef.current = 1
        hasMoreRef.current = true
        setHasMore(true)
        setError(false)
      }
      if (!hasMoreRef.current && !reset) return
      loadingRef.current = true
      if (reset) {
        setLoading(true)
      } else {
        setLoadingMore(true)
      }
      try {
        const res = await getTopicList({ page: pageRef.current, pageSize: PAGE_SIZE })
        const newList = (res.list || []) as TopicItem[]
        setList((prev) => (reset ? newList : [...prev, ...newList]))
        const total = res.total ?? 0
        const currentCount = reset ? newList.length : list.length + newList.length
        const more = currentCount < total
        hasMoreRef.current = more
        setHasMore(more)
        pageRef.current++
      } catch (e) {
        logger.error('topic/list', '加载话题列表', e)
        if (reset) setError(true)
      } finally {
        loadingRef.current = false
        setLoading(false)
        setLoadingMore(false)
      }
    },
    [list.length],
  )

  const goDetail = useCallback(
    (id: string) => {
      if (from === 'create') {
        const item = list.find((t) => t.id === id)
        Taro.eventCenter.trigger(TOPIC_EVENT, item?.name || '')
        Taro.navigateBack()
      } else {
        Taro.navigateTo({ url: `/pages/topic/detail?id=${id}` })
      }
    },
    [from, list],
  )

  const switchTab = useCallback(
    (tab: TabKey) => {
      if (activeTab === tab) return
      setActiveTab(tab)
      load(true)
    },
    [activeTab, load],
  )

  const onSearch = useCallback(() => {
    load(true)
  }, [load])

  useDidShow(() => {
    const instance = Taro.getCurrentInstance()
    const q = instance?.router?.params
    setFrom(q?.from || '')
    load(true)
  })

  usePullDownRefresh(() => {
    load(true).then(() => Taro.stopPullDownRefresh())
  })

  useReachBottom(() => {
    load()
  })

  const tabs: Array<{ key: TabKey; label: string; fb: string }> = [
    { key: 'recommend', label: 'topic.list.recommend', fb: '推荐' },
    { key: 'hot', label: 'topic.list.hot', fb: '热门' },
    { key: 'all', label: 'topic.list.all', fb: '全部' },
  ]

  return (
    <View className="min-h-screen bg-background flex flex-col">
      <NavBar title={tt('topic.list.pageTitle', '话题')} showBack />
      <ScrollView scrollY className="flex-1 p-[24rpx] pb-[60rpx] box-border">
        {/* 搜索栏 */}
        <View className="flex items-center h-[72rpx] px-[20rpx] bg-card rounded-[12rpx] mb-[20rpx]">
          <Text className="mr-[12rpx] text-[28rpx] text-muted-foreground shrink-0">🔍</Text>
          <Input
            className="flex-1 text-[28rpx] text-foreground"
            value={searchText}
            placeholder={tt('topic.list.searchPlaceholder', '搜索话题')}
            onInput={(e) => setSearchText(e.detail.value)}
            onConfirm={onSearch}
            confirmType="search"
          />
        </View>

        {/* 分类 tab */}
        <View className="flex gap-[16rpx] mb-[20rpx]">
          {tabs.map((tab) => (
            <View
              key={tab.key}
              className={`flex-1 flex items-center justify-center h-[64rpx] text-[26rpx] rounded-[10rpx] ${activeTab === tab.key ? 'text-primary bg-[rgba(0,242,255,0.12)] font-semibold' : 'text-muted-foreground bg-card'}`}
              onClick={() => switchTab(tab.key)}
            >
              <Text>{tt(tab.label, tab.fb)}</Text>
            </View>
          ))}
        </View>

        {/* 话题列表 */}
        {list.length > 0 ? (
          <View className="flex flex-col gap-[16rpx]">
            {list.map((item) => (
              <View
                key={item.id}
                className="flex items-center bg-card rounded-[16rpx] p-[24rpx]"
                onClick={() => goDetail(item.id)}
              >
                {item.coverUrl ? (
                  <Image
                    className="w-[100rpx] h-[100rpx] rounded-[12rpx] bg-muted shrink-0"
                    src={item.coverUrl}
                    mode="aspectFill"
                  />
                ) : (
                  <View className="w-[100rpx] h-[100rpx] rounded-[12rpx] bg-muted shrink-0 flex items-center justify-center">
                    <Text className="text-[40rpx] font-bold text-primary">#</Text>
                  </View>
                )}
                <View className="flex-1 ml-[24rpx] min-w-0">
                  <Text className="block text-[30rpx] text-primary font-semibold">
                    #{item.name}
                  </Text>
                  {item.description ? (
                    <Text className="block text-[24rpx] text-muted-foreground mt-[8rpx] overflow-hidden text-ellipsis whitespace-nowrap">
                      {item.description}
                    </Text>
                  ) : null}
                  <View className="flex gap-[16rpx] mt-[8rpx]">
                    <Text className="text-[22rpx] text-muted-foreground">
                      {tt('topic.list.participants', '{n} 人参与', {
                        n: item.participantCount || 0,
                      })}
                    </Text>
                    <Text className="text-[22rpx] text-muted-foreground">
                      {tt('topic.list.posts', '{n} 篇内容', { n: item.count || 0 })}
                    </Text>
                  </View>
                </View>
                <Text className="text-[32rpx] text-muted-foreground ml-[16rpx] shrink-0">›</Text>
              </View>
            ))}
          </View>
        ) : null}

        {/* 状态提示 */}
        {list.length === 0 && !loading && !error ? (
          <View className="flex flex-col items-center py-[60rpx] text-muted-foreground text-[26rpx]">
            <Text>{tt('topic.list.empty', '暂无话题')}</Text>
          </View>
        ) : null}

        {error && !loading ? (
          <View
            className="flex flex-col items-center py-[60rpx] text-muted-foreground text-[26rpx]"
            onClick={() => load(true)}
          >
            <Text className="text-[26rpx] text-destructive">
              {tt('topic.list.loadFailed', '加载失败')}
            </Text>
            <Text className="text-[26rpx] text-primary mt-[12rpx]">
              {tt('topic.list.retry', '点击重试')}
            </Text>
          </View>
        ) : null}

        {loading ? (
          <View className="flex flex-col items-center py-[60rpx] text-muted-foreground text-[26rpx]">
            <Text>{tt('topic.list.loading', '加载中…')}</Text>
          </View>
        ) : null}

        {loadingMore ? (
          <View className="flex flex-col items-center py-[60rpx] text-muted-foreground text-[26rpx]">
            <Text>{tt('topic.list.loadingMore', '加载中…')}</Text>
          </View>
        ) : null}

        {!loading && !loadingMore && !hasMore && list.length > 0 ? (
          <View className="flex flex-col items-center py-[60rpx] text-muted-foreground text-[26rpx]">
            <Text>{tt('topic.list.noMore', '没有更多了')}</Text>
          </View>
        ) : null}
      </ScrollView>
    </View>
  )
}
