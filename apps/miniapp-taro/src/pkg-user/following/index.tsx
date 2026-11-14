// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠


// 镜像 packages/app/src/features/follow/FollowScreen.tsx
//
// 薄壳(2026-11-14 收敛):列表视图委托共享屏 `FollowScreen`,本端只保留平台职责:
//   ① 取数 —— GET /follows/following | /follows/followers(分页);
//   ② 生命周期 —— useDidShow 门控 / useReachBottom / usePullDownRefresh / 原生标题;
//   ③ 交互 —— 取消关注确认弹窗、去发现更多。
// 顶部「统计 + 搜索」走共享屏 renderListHeader,空态主操作走 emptyAction,
// 收敛前这 272 行把手写卡片/tab/三态各写一份。
import { useI18n } from '@/i18n'
import { View, Text } from '@tarojs/components'
import Taro, { useDidShow, useReachBottom, usePullDownRefresh } from '@tarojs/taro'
import { useState, useMemo, useCallback, useEffect, useRef } from 'react'
import { getFollowing, getFollowers, unfollowUser } from '@/api/social'
import { useAuthReadyGate } from '@/hooks/use-auth-ready-gate'
import { useSocialList } from '@/hooks/use-social-list'
import { formatDateByTemplate } from '@ihui/shared'
import ThemeRoot from '@/components/ThemeRoot'
import SearchBar from '@/components/SearchBar'
import { FollowScreen } from '@ihui/rn-app/features/follow/FollowScreen'
import { useAppTheme } from '@/lib/theme'
import type { FollowTab, FollowUserItem } from '@ihui/types'
import { onToast } from '@/host/on-toast'

const PAGE_SIZE = 20

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

/** 本端行 → 共享 FollowUserItem。followedAt 缺失时按 createdAt 兜底,再缺就空串(不编时间)。 */
function toFollowItem(row: FollowRow): FollowUserItem {
  return {
    id: row.id,
    nickname: row.nickname ?? null,
    username: row.username ?? '',
    avatar: row.avatar ?? null,
    bio: row.bio ?? null,
    followedAt: formatDateByTemplate(row.followedAt ?? row.createdAt ?? '', 'YYYY-MM-DD') || '-',
  }
}

export default function FollowingPage() {
  const { t } = useI18n()
  const { resolved } = useAppTheme()
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
    (item: FollowUserItem) => {
      const row = items.find((x) => x.id === item.id)
      if (!row) return
      Taro.showModal({
        title: tt('common.hint', '提示'),
        content: tt('following.cancel', '确认取消关注?'),
        success: async (res) => {
          if (!res.confirm) return
          try {
            await unfollowUser(row.userId ?? row.id)
            removeItem(row.id)
            onToast(tt('common.success', '成功'), { kind: 'success' })
          } catch {
            onToast(tt('following.loadFailed', '操作失败'), { kind: 'error' })
          }
        },
      })
    },
    [items, tt, removeItem],
  )

  const goDiscover = useCallback(() => {
    Taro.switchTab({ url: '/pages/index/index' })
  }, [])

  // G-933 冷启动门控:GET /follows/following(checkAuth)需鉴权,落定前不发
  useDidShow(() => gate.waitUntilReady(() => load(true)))
  useReachBottom(() => {
    void load()
  })
  usePullDownRefresh(() => {
    void load(true).finally(() => Taro.stopPullDownRefresh())
  })

  return (
    <ThemeRoot>
      <FollowScreen
        t={t}
        items={displayList.map(toFollowItem)}
        activeTab={tab}
        onSelectTab={setTab}
        loading={loading}
        refreshing={false}
        loadingMore={loading && displayList.length > 0}
        error=""
        onRefresh={() => {
          void load(true)
        }}
        onLoadMore={() => {
          void load()
        }}
        onUnfollow={handleUnfollow}
        onBack={() => Taro.navigateBack()}
        onRetry={() => {
          void load(true)
        }}
        colorScheme={resolved}
        onNavigate={(url) => Taro.navigateTo({ url })}
        onToast={onToast}
        emptyLabel={
          searchText ? tt('following.searchEmpty', '未找到匹配用户') : tt('follow.empty', '暂无数据')
        }
        emptyAction={{ label: tt('following.goDiscover', '去发现更多'), onPress: goDiscover }}
        showNoMore={!hasMore && displayList.length > 0}
        // 顶部「当前 tab 统计 + 搜索」是页面级控件,共享屏无此槽位
        renderListHeader={() => (
          <View className="flex flex-col gap-[16rpx] mb-[16rpx]">
            <View className="flex items-baseline">
              <Text className="text-body text-muted-foreground">
                {tab === 'following' ? tt('follow.following', '关注') : tt('follow.fans', '粉丝')}
              </Text>
              <Text className="mx-[8rpx] text-heading font-bold text-primary">{totalCount}</Text>
              <Text className="text-label text-muted-foreground">{tt('following.people', '人')}</Text>
            </View>
            {/* 搜索栏(统一圆角输入井,共享 SearchBar) */}
            <SearchBar
              value={searchText}
              onInput={setSearchText}
              placeholder={tt('following.searchPlaceholder', '搜索关注的用户')}
              onClear={() => setSearchText('')}
            />
          </View>
        )}
      />
    </ThemeRoot>
  )
}
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
