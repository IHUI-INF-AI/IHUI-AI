import { View, Text, Image, Input, ScrollView } from '@tarojs/components'
import Taro, { useDidShow, useReachBottom, usePullDownRefresh } from '@tarojs/taro'
import { useState, useMemo, useCallback } from 'react'
import { getFavorites, deleteFavorite, type FavoriteItem } from '@/api/social'
import { useSocialList } from '@/hooks/use-social-list'
import { useI18n } from '@/i18n'

const PAGE_SIZE = 20

type CategoryTab = 'all' | 'course' | 'live' | 'post' | 'aigc' | 'news'

interface CategoryDef {
  key: CategoryTab
  labelKey: string
  fallback: string
  targetType: string
}

// 分类 Tab:全部/课程/直播/帖子/AI作品/资讯
const CATEGORY_TABS: CategoryDef[] = [
  { key: 'all', labelKey: 'favorites.tabAll', fallback: '全部', targetType: '' },
  { key: 'course', labelKey: 'favorites.tabCourse', fallback: '课程', targetType: 'course' },
  { key: 'live', labelKey: 'favorites.tabLive', fallback: '直播', targetType: 'live' },
  { key: 'post', labelKey: 'favorites.tabPost', fallback: '帖子', targetType: 'post' },
  { key: 'aigc', labelKey: 'favorites.tabAigc', fallback: 'AI作品', targetType: 'aigc' },
  { key: 'news', labelKey: 'favorites.tabNews', fallback: '资讯', targetType: 'news' },
]

// 跳转路由映射
const ROUTE_MAP: Record<string, string> = {
  course: '/pages/course/detail/index?id=',
  live: '/pages/live/detail/index?id=',
  post: '/pages/circle/detail/index?id=',
  aigc: '/pages/aigc/detail/index?id=',
  news: '/pages/news/detail/index?id=',
}

export default function FavoritesPage() {
  const { t } = useI18n()
  const tt = useCallback((k: string, fb: string) => (t(k) === k ? fb : t(k)), [t])

  const { items, loading, hasMore, load, removeItem } = useSocialList<FavoriteItem>({
    pageSize: PAGE_SIZE,
    fetch: (params) => getFavorites(params),
  })

  const [activeTab, setActiveTab] = useState<CategoryTab>('all')
  const [searchText, setSearchText] = useState('')
  const [manageMode, setManageMode] = useState(false)
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set())

  const totalCount = items.length

  // 客户端:分类过滤 + 关键词搜索(后端仅支持 resourceType,前端兜底 keyword)
  const displayList = useMemo(() => {
    let list = [...items]
    if (activeTab !== 'all') {
      const tab = CATEGORY_TABS.find((c) => c.key === activeTab)
      if (tab && tab.targetType) {
        list = list.filter((it) => it.targetType === tab.targetType)
      }
    }
    const kw = searchText.trim().toLowerCase()
    if (kw) {
      list = list.filter(
        (it) =>
          (it.title || '').toLowerCase().includes(kw) ||
          (it.targetType || '').toLowerCase().includes(kw),
      )
    }
    return list
  }, [items, activeTab, searchText])

  const formatDate = (v: string) => {
    if (!v) return ''
    const d = new Date(v)
    if (isNaN(d.getTime())) return ''
    const y = d.getFullYear()
    const m = String(d.getMonth() + 1).padStart(2, '0')
    const day = String(d.getDate()).padStart(2, '0')
    return `${y}-${m}-${day}`
  }

  const handleCancel = useCallback(
    (item: FavoriteItem) => {
      Taro.showModal({
        title: tt('common.hint', '提示'),
        content: tt('favorites.cancel', '确认取消收藏?'),
        success: async (res) => {
          if (!res.confirm) return
          try {
            await deleteFavorite(item.targetType, item.targetId)
            removeItem(item.id)
            Taro.showToast({ title: tt('common.success', '成功'), icon: 'success' })
          } catch {
            Taro.showToast({ title: tt('favorites.loadFailed', '操作失败'), icon: 'none' })
          }
        },
      })
    },
    [tt, removeItem],
  )

  const toggleSelect = useCallback((id: string) => {
    setSelectedIds((prev) => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }, [])

  const handleBatchCancel = useCallback(() => {
    if (selectedIds.size === 0) {
      Taro.showToast({ title: tt('favorites.selectFirst', '请先选择'), icon: 'none' })
      return
    }
    Taro.showModal({
      title: tt('common.hint', '提示'),
      content: `${tt('favorites.batchCancel', '批量取消收藏')} ${selectedIds.size} ${tt('favorites.items', '项')}?`,
      success: async (res) => {
        if (!res.confirm) return
        const targets = items.filter((it) => selectedIds.has(it.id))
        try {
          await Promise.all(
            targets.map((it) =>
              deleteFavorite(it.targetType, it.targetId).catch(() => null),
            ),
          )
          targets.forEach((it) => removeItem(it.id))
          setSelectedIds(new Set())
          setManageMode(false)
          Taro.showToast({ title: tt('common.success', '成功'), icon: 'success' })
        } catch {
          Taro.showToast({ title: tt('favorites.loadFailed', '操作失败'), icon: 'none' })
        }
      },
    })
  }, [selectedIds, items, tt, removeItem])

  const goDiscover = useCallback(() => {
    Taro.switchTab({ url: '/pages/index/index' })
  }, [])

  const viewDetail = useCallback(
    (item: FavoriteItem) => {
      if (manageMode) return
      const prefix = ROUTE_MAP[item.targetType]
      if (!prefix) {
        Taro.showToast({ title: tt('favorites.unsupported', '暂未支持跳转'), icon: 'none' })
        return
      }
      Taro.navigateTo({
        url: `${prefix}${item.targetId}`,
        fail: () =>
          Taro.showToast({ title: tt('favorites.unsupported', '暂未支持跳转'), icon: 'none' }),
      })
    },
    [manageMode, tt],
  )

  useDidShow(() => load(true))
  useReachBottom(() => load())
  usePullDownRefresh(() => load(true).finally(() => Taro.stopPullDownRefresh()))

  const allChecked =
    displayList.length > 0 && displayList.every((it) => selectedIds.has(it.id))

  return (
    <View className="min-h-screen bg-background p-[24rpx] pb-[60rpx] box-border">
      {/* 顶部:统计 + 搜索 + 管理按钮 */}
      <View className="flex flex-col gap-[16rpx]">
        <View className="flex items-baseline">
          <Text className="text-[28rpx] text-muted-foreground">{tt('favorites.total', '已收藏')}</Text>
          <Text className="mx-[8rpx] text-[40rpx] font-bold text-primary">{totalCount}</Text>
          <Text className="text-[24rpx] text-muted-foreground">{tt('favorites.itemsUnit', '项')}</Text>
          <Text
            className="ml-auto py-[8rpx] px-[20rpx] text-[24rpx] text-primary bg-[rgba(0,242,255,0.08)] border-[2rpx] border-[rgba(0,242,255,0.2)] rounded-[8rpx]"
            onClick={() => {
              setManageMode((v) => !v)
              setSelectedIds(new Set())
            }}
          >
            {manageMode ? tt('favorites.done', '完成') : tt('favorites.manage', '管理')}
          </Text>
        </View>
        <View className="flex items-center h-[72rpx] px-[20rpx] bg-card border-[2rpx] border-[rgba(0,242,255,0.15)] rounded-[12rpx]">
          <Text className="mr-[12rpx] text-[28rpx] text-muted-foreground shrink-0">🔍</Text>
          <Input
            className="flex-1 text-[28rpx] text-foreground"
            value={searchText}
            onInput={(e) => setSearchText(e.detail.value)}
            placeholder={tt('favorites.searchPlaceholder', '搜索收藏的内容')}
          />
        </View>
      </View>

      {/* 分类 Tab:横向滚动 */}
      <ScrollView scrollX className="mt-[20rpx] whitespace-nowrap w-full">
        {CATEGORY_TABS.map((tab) => (
          <View
            key={tab.key}
            className={`inline-flex items-center justify-center h-[60rpx] px-[24rpx] mr-[12rpx] text-[26rpx] text-muted-foreground bg-card border-[2rpx] border-[rgba(0,242,255,0.1)] rounded-[10rpx] ${activeTab === tab.key ? 'text-primary border-primary font-semibold' : ''}`}
            onClick={() => setActiveTab(tab.key)}
          >
            <Text>{tt(tab.labelKey, tab.fallback)}</Text>
          </View>
        ))}
      </ScrollView>

      {/* 批量操作栏 */}
      {manageMode && displayList.length > 0 ? (
        <View className="mt-[16rpx] flex items-center justify-between py-[16rpx] px-[20rpx] bg-card border-[2rpx] border-[rgba(0,242,255,0.1)] rounded-[10rpx]">
          <View
            className="flex items-center"
            onClick={() => {
              if (allChecked) {
                setSelectedIds(new Set())
              } else {
                setSelectedIds(new Set(displayList.map((it) => it.id)))
              }
            }}
          >
            <Text
              className={`inline-flex items-center justify-center w-[40rpx] h-[40rpx] text-[24rpx] text-transparent bg-background border-[2rpx] border-[rgba(0,242,255,0.3)] rounded-[6rpx] shrink-0 ${allChecked ? 'text-foreground bg-primary border-primary' : ''}`}
            >
              {allChecked ? '✓' : ''}
            </Text>
            <Text className="ml-[12rpx] text-[26rpx] text-foreground">{tt('favorites.selectAll', '全选')}</Text>
          </View>
          <Text
            className={`py-[8rpx] px-[20rpx] text-[24rpx] text-foreground bg-destructive rounded-[8rpx] ${selectedIds.size === 0 ? 'text-muted-foreground bg-muted' : ''}`}
            onClick={handleBatchCancel}
          >
            {tt('favorites.batchCancel', '批量取消')} ({selectedIds.size})
          </Text>
        </View>
      ) : null}

      {/* 收藏列表 */}
      {displayList.length > 0 ? (
        <View className="mt-[24rpx] flex flex-col gap-[16rpx]">
          {displayList.map((item) => {
            const checked = selectedIds.has(item.id)
            return (
              <View
                key={item.id}
                className="flex items-center p-[24rpx] bg-card border-[2rpx] border-[rgba(0,242,255,0.1)] rounded-[12rpx]"
                onClick={() => (manageMode ? toggleSelect(item.id) : viewDetail(item))}
              >
                {manageMode ? (
                  <Text
                    className={`inline-flex items-center justify-center w-[40rpx] h-[40rpx] text-[24rpx] text-transparent bg-background border-[2rpx] border-[rgba(0,242,255,0.3)] rounded-[6rpx] shrink-0 ${checked ? 'text-foreground bg-primary border-primary' : ''}`}
                  >
                    {checked ? '✓' : ''}
                  </Text>
                ) : null}
                {item.cover ? (
                  <Image className="w-[120rpx] h-[120rpx] rounded-[10rpx] bg-muted mr-[20rpx] shrink-0" src={item.cover} mode="aspectFill" />
                ) : (
                  <View className="w-[120rpx] h-[120rpx] rounded-[10rpx] bg-muted mr-[20rpx] shrink-0 flex items-center justify-center">
                    <Text className="text-[20rpx] text-muted-foreground">{item.targetType}</Text>
                  </View>
                )}
                <View className="flex-1 min-w-0 flex flex-col gap-[8rpx]">
                  <Text className="text-[30rpx] font-semibold text-foreground truncate">{item.title}</Text>
                  <Text className="text-[22rpx] text-muted-foreground">{item.targetType}</Text>
                  <View className="flex items-center justify-between">
                    <Text className="text-[22rpx] text-muted-foreground">
                      {tt('favorites.collectedAt', '收藏于')} {formatDate(item.createdAt) || '-'}
                    </Text>
                    {!manageMode ? (
                      <Text
                        className="py-[8rpx] px-[20rpx] text-[24rpx] text-destructive bg-[rgba(220,38,38,0.08)] border-[2rpx] border-[rgba(220,38,38,0.2)] rounded-[8rpx]"
                        onClick={(e) => {
                          e.stopPropagation()
                          handleCancel(item)
                        }}
                      >
                        {tt('favorites.cancel', '取消收藏')}
                      </Text>
                    ) : null}
                  </View>
                </View>
              </View>
            )
          })}
        </View>
      ) : null}

      {/* 空状态:暂无收藏 + 去发现 */}
      {displayList.length === 0 && !loading ? (
        <View className="mt-[120rpx] flex flex-col items-center">
          <Text className="text-[80rpx]">⭐</Text>
          <Text className="mt-[20rpx] text-[28rpx] text-muted-foreground">
            {searchText || activeTab !== 'all'
              ? tt('favorites.searchEmpty', '未找到匹配内容')
              : tt('favorites.empty', '暂无收藏')}
          </Text>
          <View className="mt-[24rpx] py-[16rpx] px-[40rpx] bg-primary rounded-[10rpx]" onClick={goDiscover}>
            <Text className="text-foreground text-[26rpx]">
              {tt('favorites.goDiscover', '去发现')}
            </Text>
          </View>
        </View>
      ) : null}

      {/* 加载状态 */}
      {loading && displayList.length === 0 ? (
        <View className="text-center py-[40rpx] text-[24rpx] text-muted-foreground">
          <Text>
            {tt('common.loading', '加载中…')}
          </Text>
        </View>
      ) : null}
      {loading && displayList.length > 0 ? (
        <View className="text-center py-[40rpx] text-[24rpx] text-muted-foreground">
          <Text>{tt('favorites.loadMore', '加载更多')}</Text>
        </View>
      ) : null}
      {!loading && !hasMore && displayList.length > 0 ? (
        <View className="text-center py-[40rpx] text-[24rpx] text-muted-foreground">
          <Text>{tt('favorites.noMore', '没有更多了')}</Text>
        </View>
      ) : null}
    </View>
  )
}
