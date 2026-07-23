import { View, Text, Image, Input, ScrollView } from '@tarojs/components'
import Taro, { useDidShow, useReachBottom, usePullDownRefresh } from '@tarojs/taro'
import { useState, useMemo, useCallback } from 'react'
import { getFavorites, deleteFavorite, type FavoriteItem } from '@/api/social'
import { useSocialList } from '@/hooks/use-social-list'
import { useI18n } from '@/i18n'
import './index.css'

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
    <View className="favorites-page">
      {/* 顶部:统计 + 搜索 + 管理按钮 */}
      <View className="favorites-top">
        <View className="favorites-stats">
          <Text className="favorites-stats-label">{tt('favorites.total', '已收藏')}</Text>
          <Text className="favorites-stats-num">{totalCount}</Text>
          <Text className="favorites-stats-suffix">{tt('favorites.itemsUnit', '项')}</Text>
          <Text
            className="favorites-manage-btn"
            onClick={() => {
              setManageMode((v) => !v)
              setSelectedIds(new Set())
            }}
          >
            {manageMode ? tt('favorites.done', '完成') : tt('favorites.manage', '管理')}
          </Text>
        </View>
        <View className="favorites-search">
          <Text className="favorites-search-icon">🔍</Text>
          <Input
            className="favorites-search-input"
            value={searchText}
            onInput={(e) => setSearchText(e.detail.value)}
            placeholder={tt('favorites.searchPlaceholder', '搜索收藏的内容')}
          />
        </View>
      </View>

      {/* 分类 Tab:横向滚动 */}
      <ScrollView scrollX className="favorites-tabs">
        {CATEGORY_TABS.map((tab) => (
          <View
            key={tab.key}
            className={`favorites-tab ${activeTab === tab.key ? 'favorites-tab-active' : ''}`}
            onClick={() => setActiveTab(tab.key)}
          >
            <Text>{tt(tab.labelKey, tab.fallback)}</Text>
          </View>
        ))}
      </ScrollView>

      {/* 批量操作栏 */}
      {manageMode && displayList.length > 0 ? (
        <View className="favorites-batch-bar">
          <View
            className="favorites-batch-check"
            onClick={() => {
              if (allChecked) {
                setSelectedIds(new Set())
              } else {
                setSelectedIds(new Set(displayList.map((it) => it.id)))
              }
            }}
          >
            <Text
              className={`favorites-check-box ${allChecked ? 'favorites-check-box-checked' : ''}`}
            >
              {allChecked ? '✓' : ''}
            </Text>
            <Text className="favorites-batch-text">{tt('favorites.selectAll', '全选')}</Text>
          </View>
          <Text
            className={`favorites-batch-btn ${selectedIds.size === 0 ? 'favorites-batch-btn-disabled' : ''}`}
            onClick={handleBatchCancel}
          >
            {tt('favorites.batchCancel', '批量取消')} ({selectedIds.size})
          </Text>
        </View>
      ) : null}

      {/* 收藏列表 */}
      {displayList.length > 0 ? (
        <View className="favorites-list">
          {displayList.map((item) => {
            const checked = selectedIds.has(item.id)
            return (
              <View
                key={item.id}
                className="favorites-card"
                onClick={() => (manageMode ? toggleSelect(item.id) : viewDetail(item))}
              >
                {manageMode ? (
                  <Text
                    className={`favorites-check-box ${checked ? 'favorites-check-box-checked' : ''}`}
                  >
                    {checked ? '✓' : ''}
                  </Text>
                ) : null}
                {item.cover ? (
                  <Image className="favorites-cover" src={item.cover} mode="aspectFill" />
                ) : (
                  <View className="favorites-cover favorites-cover-fallback">
                    <Text className="favorites-cover-text">{item.targetType}</Text>
                  </View>
                )}
                <View className="favorites-main">
                  <Text className="favorites-title">{item.title}</Text>
                  <Text className="favorites-source">{item.targetType}</Text>
                  <View className="favorites-meta">
                    <Text className="favorites-time">
                      {tt('favorites.collectedAt', '收藏于')} {formatDate(item.createdAt) || '-'}
                    </Text>
                    {!manageMode ? (
                      <Text
                        className="favorites-cancel-btn"
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
        <View className="favorites-empty">
          <Text className="favorites-empty-icon">⭐</Text>
          <Text className="favorites-empty-text">
            {searchText || activeTab !== 'all'
              ? tt('favorites.searchEmpty', '未找到匹配内容')
              : tt('favorites.empty', '暂无收藏')}
          </Text>
          <View className="favorites-empty-btn" onClick={goDiscover}>
            <Text className="favorites-empty-btn-text">
              {tt('favorites.goDiscover', '去发现')}
            </Text>
          </View>
        </View>
      ) : null}

      {/* 加载状态 */}
      {loading && displayList.length === 0 ? (
        <View className="favorites-loading">
          <Text className="favorites-loading-text">
            {tt('common.loading', '加载中…')}
          </Text>
        </View>
      ) : null}
      {loading && displayList.length > 0 ? (
        <View className="favorites-loading-more">
          <Text>{tt('favorites.loadMore', '加载更多')}</Text>
        </View>
      ) : null}
      {!loading && !hasMore && displayList.length > 0 ? (
        <View className="favorites-no-more">
          <Text>{tt('favorites.noMore', '没有更多了')}</Text>
        </View>
      ) : null}
    </View>
  )
}
