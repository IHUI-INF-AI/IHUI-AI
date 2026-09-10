// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

import { useTt } from '@/i18n'
import { logger } from '@/utils/logger'
import { View, Text, Image, Input, ScrollView } from '@tarojs/components'
import Taro, { useDidShow, useReachBottom, usePullDownRefresh } from '@tarojs/taro'
import { useState, useCallback, useRef } from 'react'
import { getTopicList } from '@/api'
import { TOPIC_EVENT } from '@/constants/events'
import { NavBar } from '@/components'
import ThemeRoot from '@/components/ThemeRoot'
import LineIcon from '@/components/LineIcon'

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
  const tt = useTt()
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
        Taro.navigateTo({ url: `/pkg-content/topic/detail?id=${id}` })
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
    <ThemeRoot>
      <View className="min-h-screen bg-background flex flex-col">
        <NavBar title={tt('topic.list.pageTitle', '话题')} showBack />
        <ScrollView scrollY className="flex-1 box-border">
          {/* 对齐 RN TopicListScreen:listContent paddingBottom rpx(40) */}
          <View className="p-[24rpx] pb-[40rpx]">
            {/* 搜索栏对齐 RN searchWrap:margin 24 / mb 20 / h 72 / px 20 / radius 24 / bg card */}
            <View className="flex items-center h-[72rpx] px-[20rpx] bg-card rounded-[24rpx] mb-[20rpx]">
              {/* RN Search size 16dp→32rpx / color text.tertiary */}
              <LineIcon
                name="search"
                size={32}
                className="mr-[16rpx] shrink-0"
                color="var(--color-text-tertiary)"
              />
              <Input
                className="flex-1 text-[28rpx] text-foreground"
                value={searchText}
                placeholder={tt('topic.list.searchPlaceholder', '搜索话题')}
                placeholderClass="text-[var(--color-text-tertiary)]"
                onInput={(e) => setSearchText(e.detail.value)}
                onConfirm={onSearch}
                confirmType="search"
              />
            </View>

            {/* 分类 tab 对齐 RN tab:radius 20dp(rpx)→20rpx / bg card;active bg muted + text.primary */}
            <View className="flex gap-[16rpx] mb-[20rpx]">
              {tabs.map((tab) => (
                <View
                  key={tab.key}
                  className={`flex-1 flex items-center justify-center h-[64rpx] text-[26rpx] rounded-[20rpx] ${activeTab === tab.key ? 'text-foreground bg-muted font-semibold' : 'text-[var(--color-text-tertiary)] bg-card'}`}
                  onClick={() => switchTab(tab.key)}
                  hoverClass="opacity-60"
                >
                  <Text>{tt(tab.label, tab.fb)}</Text>
                </View>
              ))}
            </View>

            {/* 话题列表对齐 RN card:mx 24(外层 padding)/mb 16 / p 24 / radius 16 / bg card;pressed 0.85 */}
            {list.length > 0 ? (
              <View className="flex flex-col gap-[16rpx]">
                {list.map((item) => (
                  <View
                    key={item.id}
                    className="flex items-center bg-card rounded-[16rpx] p-[24rpx]"
                    hoverClass="opacity-85"
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
                        {/* RN coverHash:fontSize 20dp→40rpx / 700 / text.primary→foreground */}
                        <Text className="text-[40rpx] font-bold text-foreground">#</Text>
                      </View>
                    )}
                    <View className="flex-1 ml-[24rpx] min-w-0">
                      <Text className="block text-[30rpx] text-foreground font-semibold overflow-hidden text-ellipsis whitespace-nowrap">
                        #{item.name}
                      </Text>
                      {item.description ? (
                        <Text className="block text-[24rpx] text-[var(--color-text-tertiary)] mt-[8rpx] overflow-hidden text-ellipsis whitespace-nowrap">
                          {item.description}
                        </Text>
                      ) : null}
                      <View className="flex gap-[16rpx] mt-[8rpx]">
                        <Text className="text-[22rpx] text-[var(--color-text-tertiary)]">
                          {tt('topic.list.participants', '{n} 人参与', {
                            n: item.participantCount || 0,
                          })}
                        </Text>
                        <Text className="text-[22rpx] text-[var(--color-text-tertiary)]">
                          {tt('topic.list.posts', '{n} 篇内容', { n: item.count || 0 })}
                        </Text>
                      </View>
                    </View>
                    {/* RN ChevronRight size 18dp→36rpx / color text.tertiary */}
                    <LineIcon
                      name="chevron-right"
                      size={36}
                      className="ml-[16rpx] shrink-0"
                      color="var(--color-text-tertiary)"
                    />
                  </View>
                ))}
              </View>
            ) : null}

            {/* 状态提示对齐 RN center:py 120rpx / gap 16;字 13dp→26rpx text.tertiary */}
            {list.length === 0 && !loading && !error ? (
              <View className="flex flex-col items-center py-[120rpx] text-[var(--color-text-tertiary)] text-[26rpx]">
                <Text>{tt('topic.list.empty', '暂无话题')}</Text>
              </View>
            ) : null}

            {error && !loading ? (
              <View
                className="flex flex-col items-center py-[120rpx] text-[var(--color-text-tertiary)] text-[26rpx]"
                onClick={() => load(true)}
                hoverClass="opacity-60"
              >
                <Text className="text-[26rpx] text-[var(--color-danger)]">
                  {tt('topic.list.loadFailed', '加载失败')}
                </Text>
                <Text className="text-[26rpx] text-foreground mt-[12rpx]">
                  {tt('topic.list.retry', '点击重试')}
                </Text>
              </View>
            ) : null}

            {loading ? (
              <View className="flex flex-col items-center py-[120rpx] text-[var(--color-text-tertiary)] text-[26rpx]">
                <Text>{tt('topic.list.loading', '加载中…')}</Text>
              </View>
            ) : null}

            {/* 加载更多对齐 RN footer:py 24rpx / 字 26rpx text.tertiary */}
            {loadingMore ? (
              <View className="flex flex-col items-center py-[24rpx] text-[var(--color-text-tertiary)] text-[26rpx]">
                <Text>{tt('topic.list.loadingMore', '加载中…')}</Text>
              </View>
            ) : null}

            {!loading && !loadingMore && !hasMore && list.length > 0 ? (
              <View className="flex flex-col items-center py-[24rpx] text-[var(--color-text-tertiary)] text-[26rpx]">
                <Text>{tt('topic.list.noMore', '没有更多了')}</Text>
              </View>
            ) : null}
          </View>
        </ScrollView>
      </View>
    </ThemeRoot>
  )
}
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
