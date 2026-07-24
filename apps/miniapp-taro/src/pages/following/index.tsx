import { View, Text, Image, Input } from '@tarojs/components'
import Taro, { useDidShow, useReachBottom, usePullDownRefresh } from '@tarojs/taro'
import { useState, useMemo, useCallback } from 'react'
import { getFollowing, unfollowUser, type FollowingItem } from '@/api/social'
import { useSocialList } from '@/hooks/use-social-list'
import { useI18n } from '@/i18n'

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
    <View className="min-h-screen bg-background p-[24rpx] pb-[60rpx] box-border">
      {/* 顶部:关注统计 + 搜索 */}
      <View className="flex flex-col gap-[16rpx]">
        <View className="flex items-baseline">
          <Text className="text-[28rpx] text-muted-foreground">{tt('following.total', '已关注')}</Text>
          <Text className="mx-[8rpx] text-[40rpx] font-bold text-primary">{totalCount}</Text>
          <Text className="text-[24rpx] text-muted-foreground">{tt('following.people', '人')}</Text>
        </View>
        <View className="flex items-center h-[72rpx] px-[20rpx] bg-card border-[2rpx] border-[rgba(0,242,255,0.15)] rounded-[12rpx]">
          <Text className="mr-[12rpx] text-[28rpx] text-muted-foreground shrink-0">🔍</Text>
          <Input
            className="flex-1 text-[28rpx] text-foreground"
            value={searchText}
            onInput={(e) => setSearchText(e.detail.value)}
            placeholder={tt('following.searchPlaceholder', '搜索关注的用户')}
          />
        </View>
      </View>

      {/* 排序 tab:关注时间 / 最近活跃 */}
      <View className="flex gap-[16rpx] mt-[20rpx]">
        <View
          className={`flex-1 flex items-center justify-center h-[64rpx] text-[26rpx] text-muted-foreground bg-card border-[2rpx] border-[rgba(0,242,255,0.1)] rounded-[10rpx] ${activeTab === 'followedAt' ? 'text-primary border-primary font-semibold' : ''}`}
          onClick={() => setActiveTab('followedAt')}
        >
          <Text>{tt('following.sortByFollowed', '关注时间')}</Text>
        </View>
        <View
          className={`flex-1 flex items-center justify-center h-[64rpx] text-[26rpx] text-muted-foreground bg-card border-[2rpx] border-[rgba(0,242,255,0.1)] rounded-[10rpx] ${activeTab === 'recent' ? 'text-primary border-primary font-semibold' : ''}`}
          onClick={() => setActiveTab('recent')}
        >
          <Text>{tt('following.sortByRecent', '最近活跃')}</Text>
        </View>
      </View>

      {/* 关注列表 */}
      {displayList.length > 0 ? (
        <View className="mt-[24rpx] flex flex-col gap-[16rpx]">
          {displayList.map((item) => {
            const name = item.nickname || item.username
            const initial = (name || '?').charAt(0)
            return (
              <View key={item.id} className="flex p-[24rpx] bg-card border-[2rpx] border-[rgba(0,242,255,0.1)] rounded-[12rpx]">
                {item.avatar ? (
                  <Image
                    className="w-[96rpx] h-[96rpx] rounded-[10rpx] bg-muted mr-[20rpx] shrink-0"
                    src={item.avatar || defaultAvatar}
                    mode="aspectFill"
                  />
                ) : (
                  <View className="w-[96rpx] h-[96rpx] rounded-[10rpx] bg-muted mr-[20rpx] shrink-0 flex items-center justify-center">
                    <Text className="text-[32rpx] font-semibold text-primary">{initial}</Text>
                  </View>
                )}
                <View className="flex-1 min-w-0 flex flex-col gap-[8rpx]">
                  <View className="flex items-center justify-between">
                    <Text className="text-[30rpx] font-semibold text-foreground truncate">{name}</Text>
                    <View className="py-[4rpx] px-[12rpx] bg-[rgba(0,242,255,0.08)] border-[2rpx] border-[rgba(0,242,255,0.2)] rounded-[6rpx]">
                      <Text className="text-[20rpx] text-primary">
                        {tt('following.following', '已关注')}
                      </Text>
                    </View>
                  </View>
                  {item.bio ? <Text className="text-[24rpx] text-muted-foreground truncate">{item.bio}</Text> : null}
                  <View className="flex items-center justify-between">
                    <Text className="text-[22rpx] text-muted-foreground">
                      {tt('following.followedAt', '关注于')} {formatDate(item.followedAt) || '-'}
                    </Text>
                    <Text
                      className="py-[8rpx] px-[20rpx] text-[24rpx] text-destructive bg-[rgba(220,38,38,0.08)] border-[2rpx] border-[rgba(220,38,38,0.2)] rounded-[8rpx]"
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
        <View className="mt-[120rpx] flex flex-col items-center">
          <Text className="text-[80rpx]">💬</Text>
          <Text className="mt-[20rpx] text-[28rpx] text-muted-foreground">
            {searchText
              ? tt('following.searchEmpty', '未找到匹配用户')
              : tt('following.empty', '暂无关注')}
          </Text>
          <View className="mt-[24rpx] py-[16rpx] px-[40rpx] bg-primary rounded-[10rpx]" onClick={goDiscover}>
            <Text className="text-foreground text-[26rpx]">
              {tt('following.goDiscover', '去发现更多')}
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
          <Text>{tt('following.loadMore', '加载更多')}</Text>
        </View>
      ) : null}
      {!loading && !hasMore && displayList.length > 0 ? (
        <View className="text-center py-[40rpx] text-[24rpx] text-muted-foreground">
          <Text>{tt('following.noMore', '没有更多了')}</Text>
        </View>
      ) : null}
    </View>
  )
}
