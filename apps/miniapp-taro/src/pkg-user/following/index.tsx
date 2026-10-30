// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

// 对齐目标(RN 共享屏): packages/app/src/features/follow/FollowScreen.tsx
import { useI18n } from '@/i18n'
import { View, Text, Image } from '@tarojs/components'
import Taro, { useDidShow, useReachBottom, usePullDownRefresh } from '@tarojs/taro'
import { useState, useMemo, useCallback, useEffect, useRef } from 'react'
import { getFollowing, getFollowers, unfollowUser } from '@/api/social'
import { useAuthReadyGate } from '@/hooks/use-auth-ready-gate'
import { useSocialList } from '@/hooks/use-social-list'
import { formatDateByTemplate } from '@ihui/shared'
import ThemeRoot from '@/components/ThemeRoot'
// 屏幕状态四件套的小程序镜像件(对齐 RN 端 packages/app/src/components/ScreenStates.tsx)
import { ScreenSkeleton } from '@/components/ScreenStates.taro'
import LineIcon from '@/components/LineIcon'
import SearchBar from '@/components/SearchBar'

const PAGE_SIZE = 20
const defaultAvatar = '/static/default-avatar.png'

/** 关注/粉丝双 tab(与 RN FollowScreen 的 FollowTab 同一词表) */
type FollowTab = 'following' | 'fans'
const TABS: FollowTab[] = ['following', 'fans']

/**
 * 两张列表的公共行形。粉丝行来自 GET /follows/followers(后端只投影
 * id/userId/nickname/avatar/createdAt,没有 bio/followedAt)⇒ 缺列即不渲染,不造数据。
 */
type FollowRow = {
  id: string
  /** 列表行上的「对方用户」id:DELETE /follows/:userId 认的是它,不是关系行 id */
  userId?: string
  username?: string
  nickname?: string | null
  avatar?: string | null
  bio?: string | null
  followedAt?: string | null
  createdAt?: string | null
}

export default function FollowingPage() {
  const { t } = useI18n()
  const gate = useAuthReadyGate()
  const tt = useCallback((k: string, fb: string) => (t(k) === k ? fb : t(k)), [t])

  const [tab, setTab] = useState<FollowTab>('following')

  // tab 各自取端点,行形归一到 FollowRow(关注行带 bio/followedAt,粉丝行只到 createdAt)
  const fetchPage = useCallback(
    async (params: { page: number; pageSize: number }) => {
      const res = tab === 'fans' ? await getFollowers(params) : await getFollowing(params)
      return { ...res, list: (res.list || []) as FollowRow[] }
    },
    [tab],
  )

  const { items, loading, hasMore, load, removeItem } = useSocialList<FollowRow>({
    pageSize: PAGE_SIZE,
    fetch: fetchPage,
  })

  const [searchText, setSearchText] = useState('')

  const totalCount = items.length

  // 客户端搜索(后端两个端点都没有 keyword 参数,前端兜底,对齐 team.tsx 客户端策略)
  const displayList = useMemo(() => {
    const kw = searchText.trim().toLowerCase()
    if (!kw) return items
    return items.filter(
      (it) =>
        (it.nickname || it.username || '').toLowerCase().includes(kw) ||
        (it.bio || '').toLowerCase().includes(kw),
    )
  }, [items, searchText])

  // 切 tab 即重取:load 闭包用新 tab 的 fetch;首屏由 useDidShow 承担,这里跳过首轮
  const tabRef = useRef<FollowTab>('following')
  const loadRef = useRef(load)
  loadRef.current = load
  useEffect(() => {
    if (tabRef.current === tab) return
    tabRef.current = tab
    void loadRef.current(true)
  }, [tab])

  // 屏标题对齐 RN FollowScreen header:小程序由原生导航栏承载,随语言切换重设
  useEffect(() => {
    Taro.setNavigationBarTitle({ title: tt('follow.title', '关注与粉丝') })
  }, [tt])

  const handleUnfollow = useCallback(
    (item: FollowRow) => {
      Taro.showModal({
        title: tt('common.hint', '提示'),
        content: tt('following.cancel', '确认取消关注?'),
        success: async (res) => {
          if (!res.confirm) return
          try {
            await unfollowUser(item.userId ?? item.id)
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

  // G-933 冷启动门控:GET /follows/following(checkAuth)需鉴权,落定前不发
  useDidShow(() => gate.waitUntilReady(() => load(true)))
  useReachBottom(() => load())
  usePullDownRefresh(() => load(true).finally(() => Taro.stopPullDownRefresh()))

  return (
    <View className="min-h-screen bg-background p-[20rpx] pb-[64rpx] box-border">
      {/* 顶部:当前 tab 统计 + 搜索 */}
      <View className="flex flex-col gap-[16rpx]">
        <View className="flex items-baseline">
          <Text className="text-[length:28rpx] text-muted-foreground">
            {tab === 'following' ? tt('follow.following', '关注') : tt('follow.fans', '粉丝')}
          </Text>
          <Text className="mx-[8rpx] text-[length:40rpx] font-bold text-primary">{totalCount}</Text>
          <Text className="text-[length:24rpx] text-muted-foreground">
            {tt('following.people', '人')}
          </Text>
        </View>
        {/* 搜索栏(统一圆角输入井,共享 SearchBar) */}
        <SearchBar
          className=""
          value={searchText}
          onInput={setSearchText}
          placeholder={tt('following.searchPlaceholder', '搜索关注的用户')}
          onClear={() => setSearchText('')}
        />
      </View>

      {/* 关注/粉丝双 tab(对齐 RN FollowScreen tabs:paddingVertical 8dp/gap 8dp/胶囊 radius 12dp/激活 bg brand) */}
      <View className="flex gap-[16rpx] py-[16rpx]">
        {TABS.map((k) => (
          <View
            key={k}
            className={`flex-1 flex items-center justify-center py-[16rpx] rounded-xl ${tab === k ? 'bg-primary' : 'bg-card'}`}
            hoverClass="opacity-60"
            onClick={() => setTab(k)}
          >
            <Text
              className={`text-[length:28rpx] ${tab === k ? 'text-primary-foreground font-semibold' : 'text-muted-foreground'}`}
            >
              {k === 'following' ? tt('follow.following', '关注') : tt('follow.fans', '粉丝')}
            </Text>
          </View>
        ))}
      </View>

      {/* 列表(关注 / 粉丝) */}
      {displayList.length > 0 ? (
        <View className="flex flex-col gap-[24rpx]">
          {/* 对齐 RN FollowScreen listBody:ItemSeparator 12dp */}
          {displayList.map((item) => {
            const name = item.nickname || item.username || '?'
            const initial = name.charAt(0)
            return (
              <ThemeRoot key={item.id}>
                {/* 对齐 RN FollowScreen card:padding 12dp/radius 12dp/描边 border.light/底 surface.bg */}
                <View
                  key={item.id}
                  className="flex items-center p-[24rpx] bg-background border-[length:2rpx] border-border rounded-xl"
                >
                  {item.avatar ? (
                    <Image
                      className="w-[96rpx] h-[96rpx] rounded-2xl bg-muted mr-[24rpx] shrink-0"
                      src={item.avatar || defaultAvatar}
                      mode="aspectFill"
                    />
                  ) : (
                    <View className="w-[96rpx] h-[96rpx] rounded-2xl bg-muted mr-[24rpx] shrink-0 flex items-center justify-center">
                      {/* 对齐 RN avatarInitial 18dp/600/text.secondary */}
                      <Text className="text-[length:36rpx] font-semibold text-muted-foreground">
                        {initial}
                      </Text>
                    </View>
                  )}
                  {/* 对齐 RN cardInfo:marginLeft 12dp;bio/meta marginTop 8dp */}
                  <View className="flex-1 min-w-0 flex flex-col gap-[16rpx]">
                    <View className="flex items-center justify-between">
                      <Text className="text-[length:32rpx] font-semibold text-foreground truncate">
                        {name}
                      </Text>
                      {/* 已关注徽章只属于关注行;粉丝行是别人关注我,不挂这个状态 */}
                      {tab === 'following' ? (
                        <View className="py-[4rpx] px-[12rpx] bg-primary/10 border-[length:2rpx] border-primary/30 rounded-xs">
                          <Text className="text-[length:20rpx] text-primary">
                            {tt('following.following', '已关注')}
                          </Text>
                        </View>
                      ) : null}
                    </View>
                    {item.bio ? (
                      <Text className="text-[length:22rpx] text-muted-foreground truncate">
                        {item.bio}
                      </Text>
                    ) : null}
                    <View className="flex items-center justify-between">
                      <Text className="text-[length:22rpx] text-[var(--color-text-tertiary)]">
                        {tab === 'following' ? `${tt('following.followedAt', '关注于')} ` : ''}
                        {formatDateByTemplate(item.followedAt ?? item.createdAt, 'YYYY-MM-DD') ||
                          '-'}
                      </Text>
                      {/* 对齐 RN unfollowBtn(仅关注 tab 显示):paddingHorizontal 12dp/paddingVertical 6dp/radius 12dp/描边 border.light/字 text.primary */}
                      {tab === 'following' ? (
                        <Text
                          className="py-[12rpx] px-[24rpx] text-[length:28rpx] text-foreground bg-background border-[length:2rpx] border-border rounded-xl"
                          onClick={() => handleUnfollow(item)}
                        >
                          {tt('following.delete', '取消关注')}
                        </Text>
                      ) : null}
                    </View>
                  </View>
                </View>
              </ThemeRoot>
            )
          })}
        </View>
      ) : null}

      {/* 空状态:暂无关注 + 去发现更多 */}
      {displayList.length === 0 && !loading ? (
        <View className="py-[96rpx] flex flex-col items-center">
          <LineIcon name="message-circle" size={80} color="var(--color-muted-foreground)" />
          <Text className="mt-[16rpx] text-[length:28rpx] text-muted-foreground">
            {searchText
              ? tt('following.searchEmpty', '未找到匹配用户')
              : tt('follow.empty', '暂无数据')}
          </Text>
          <View
            className="mt-[24rpx] py-[16rpx] px-[40rpx] bg-primary rounded-xl"
            hoverClass="opacity-60"
            onClick={goDiscover}
          >
            <Text className="text-primary-foreground text-[length:26rpx]">
              {tt('following.goDiscover', '去发现更多')}
            </Text>
          </View>
        </View>
      ) : null}

      {/* 首屏加载:骨架屏,与 RN 端 ScreenSkeleton 同形同周期 */}
      {loading && displayList.length === 0 ? <ScreenSkeleton variant="list" count={4} /> : null}
      {loading && displayList.length > 0 ? (
        <View className="text-center py-[32rpx] text-[length:22rpx] text-muted-foreground">
          <Text>{tt('following.loadMore', '加载更多')}</Text>
        </View>
      ) : null}
      {!loading && !hasMore && displayList.length > 0 ? (
        <View className="text-center py-[32rpx] text-[length:22rpx] text-muted-foreground">
          <Text>{tt('following.noMore', '没有更多了')}</Text>
        </View>
      ) : null}
    </View>
  )
}
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
