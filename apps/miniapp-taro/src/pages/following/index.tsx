import { View, Text, Image, Input } from '@tarojs/components'
import Taro, { useDidShow, useReachBottom, usePullDownRefresh } from '@tarojs/taro'
import { useState, useMemo, useCallback } from 'react'
import { getFollowing, unfollowUser, type FollowingItem } from '@/api/social'
import { useSocialList } from '@/hooks/use-social-list'
import { useI18n } from '@/i18n'
import './index.css'

const PAGE_SIZE = 20
const defaultAvatar = '/static/default-avatar.png'

type SortTab = 'followedAt' | 'recent'

export default function FollowingPage() {
  const { t } = useI18n()
  const tt = useCallback((k: string, fb: string) => (t(k) === k ? fb : t(k)), [t])

  const { items, loading, hasMore, load, removeItem } = useSocialList<FollowingItem>({
    pageSize: PAGE_SIZE,
    fetch: (params) => getFollowing(params),
  })

  const [searchText, setSearchText] = useState('')
  const [activeTab, setActiveTab] = useState<SortTab>('followedAt')

  const totalCount = items.length

  // 客户端搜索 + 排序(后端无 keyword/sort 参数,前端兜底,对齐 team.tsx 客户端策略)
  const displayList = useMemo(() => {
    let list = [...items]
    const kw = searchText.trim().toLowerCase()
    if (kw) {
      list = list.filter(
        (it) =>
          (it.nickname || it.username || '').toLowerCase().includes(kw) ||
          (it.bio || '').toLowerCase().includes(kw),
      )
    }
    if (activeTab === 'followedAt') {
      list.sort(
        (a, b) =>
          new Date(b.followedAt || '').getTime() - new Date(a.followedAt || '').getTime(),
      )
    } else {
      // recent:后端无活跃时间字段,按用户名做占位排序
      list.sort((a, b) => (a.username || '').localeCompare(b.username || ''))
    }
    return list
  }, [items, searchText, activeTab])

  const formatDate = (v: string) => {
    if (!v) return ''
    const d = new Date(v)
    if (isNaN(d.getTime())) return ''
    const y = d.getFullYear()
    const m = String(d.getMonth() + 1).padStart(2, '0')
    const day = String(d.getDate()).padStart(2, '0')
    return `${y}-${m}-${day}`
  }

  const handleUnfollow = useCallback(
    (item: FollowingItem) => {
      Taro.showModal({
        title: tt('common.hint', '提示'),
        content: tt('following.cancel', '确认取消关注?'),
        success: async (res) => {
          if (!res.confirm) return
          try {
            await unfollowUser(item.id)
            removeItem(item.id)
            Taro.showToast({ title: tt('common.success', '成功'), icon: 'success' })
          } catch {
            Taro.showToast({ title: tt('following.loadFailed', '操作失败'), icon: 'none' })
          }
        },
      })
    },
    [tt, removeItem],
  )

  const goDiscover = useCallback(() => {
    Taro.switchTab({ url: '/pages/index/index' })
  }, [])

  useDidShow(() => load(true))
  useReachBottom(() => load())
  usePullDownRefresh(() => load(true).finally(() => Taro.stopPullDownRefresh()))

  return (
    <View className="following-page">
      {/* 顶部:关注统计 + 搜索 */}
      <View className="following-top">
        <View className="following-stats">
          <Text className="following-stats-label">{tt('following.total', '已关注')}</Text>
          <Text className="following-stats-num">{totalCount}</Text>
          <Text className="following-stats-suffix">{tt('following.people', '人')}</Text>
        </View>
        <View className="following-search">
          <Text className="following-search-icon">🔍</Text>
          <Input
            className="following-search-input"
            value={searchText}
            onInput={(e) => setSearchText(e.detail.value)}
            placeholder={tt('following.searchPlaceholder', '搜索关注的用户')}
          />
        </View>
      </View>

      {/* 排序 tab:关注时间 / 最近活跃 */}
      <View className="following-sort">
        <View
          className={`following-sort-btn ${activeTab === 'followedAt' ? 'following-sort-btn-active' : ''}`}
          onClick={() => setActiveTab('followedAt')}
        >
          <Text>{tt('following.sortByFollowed', '关注时间')}</Text>
        </View>
        <View
          className={`following-sort-btn ${activeTab === 'recent' ? 'following-sort-btn-active' : ''}`}
          onClick={() => setActiveTab('recent')}
        >
          <Text>{tt('following.sortByRecent', '最近活跃')}</Text>
        </View>
      </View>

      {/* 关注列表 */}
      {displayList.length > 0 ? (
        <View className="following-list">
          {displayList.map((item) => {
            const name = item.nickname || item.username
            const initial = (name || '?').charAt(0)
            return (
              <View key={item.id} className="following-card">
                {item.avatar ? (
                  <Image
                    className="following-avatar"
                    src={item.avatar || defaultAvatar}
                    mode="aspectFill"
                  />
                ) : (
                  <View className="following-avatar following-avatar-fallback">
                    <Text className="following-avatar-text">{initial}</Text>
                  </View>
                )}
                <View className="following-main">
                  <View className="following-row">
                    <Text className="following-nickname">{name}</Text>
                    <View className="following-status">
                      <Text className="following-status-text">
                        {tt('following.following', '已关注')}
                      </Text>
                    </View>
                  </View>
                  {item.bio ? <Text className="following-bio">{item.bio}</Text> : null}
                  <View className="following-meta">
                    <Text className="following-time">
                      {tt('following.followedAt', '关注于')} {formatDate(item.followedAt) || '-'}
                    </Text>
                    <Text
                      className="following-unfollow-btn"
                      onClick={() => handleUnfollow(item)}
                    >
                      {tt('following.delete', '取消关注')}
                    </Text>
                  </View>
                </View>
              </View>
            )
          })}
        </View>
      ) : null}

      {/* 空状态:暂无关注 + 去发现更多 */}
      {displayList.length === 0 && !loading ? (
        <View className="following-empty">
          <Text className="following-empty-icon">💬</Text>
          <Text className="following-empty-text">
            {searchText
              ? tt('following.searchEmpty', '未找到匹配用户')
              : tt('following.empty', '暂无关注')}
          </Text>
          <View className="following-empty-btn" onClick={goDiscover}>
            <Text className="following-empty-btn-text">
              {tt('following.goDiscover', '去发现更多')}
            </Text>
          </View>
        </View>
      ) : null}

      {/* 加载状态 */}
      {loading && displayList.length === 0 ? (
        <View className="following-loading">
          <Text className="following-loading-text">
            {tt('common.loading', '加载中…')}
          </Text>
        </View>
      ) : null}
      {loading && displayList.length > 0 ? (
        <View className="following-loading-more">
          <Text>{tt('following.loadMore', '加载更多')}</Text>
        </View>
      ) : null}
      {!loading && !hasMore && displayList.length > 0 ? (
        <View className="following-no-more">
          <Text>{tt('following.noMore', '没有更多了')}</Text>
        </View>
      ) : null}
    </View>
  )
}
