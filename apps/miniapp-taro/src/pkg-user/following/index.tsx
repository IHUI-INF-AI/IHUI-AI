// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
// 镜像 packages/app/src/features/follow/FollowScreen.tsx

/**
 * 关注/粉丝列表页 —— shell-bearing 形态:渲染真相源 =
 * packages/app/src/features/follow/FollowScreen.tsx(与 RN 同一份共享屏,经
 * apps/miniapp-taro/src/rn-compat 兼容层落地)。本端只注入数据层(tabs 取数 /
 * 分页 / 鉴权门控)与平台出口(onBack / onNavigate / onToast / colorScheme),
 * 不写任何列表布局与样式;共享屏改一笔,两端同动。
 */
import { useI18n } from '@/i18n'
import Taro, { useDidShow, useReachBottom, usePullDownRefresh } from '@tarojs/taro'
import { useState, useCallback, useEffect, useRef } from 'react'
import { getFollowing, getFollowers, unfollowUser } from '@/api/social'
import { useAuthReadyGate } from '@/hooks/use-auth-ready-gate'
import { useSocialList } from '@/hooks/use-social-list'
import ThemeRoot from '@/components/ThemeRoot'
import { useTheme } from '@/rn-compat/theme'
import { onToast } from '@/host/on-toast'
import type { OnNavigate } from '@ihui/types'
import {
  FollowScreen as SharedFollowScreen,
  type FollowTab,
  type FollowUserItem,
} from '@ihui/rn-app/features/follow/FollowScreen'

const PAGE_SIZE = 20

/**
 * 共享 FollowScreen 取词适配:本端 locale 暂缺 follow.* / common.back 等键,故直接给
 * 中文(对齐 RN 端 UNIAPP_TEXT 兜底);common.retry / common.loading 本端已有,走 i18n。
 */
const FOLLOW_TEXT: Record<string, string> = {
  'follow.title': '关注与粉丝',
  'follow.following': '关注',
  'follow.fans': '粉丝',
  'follow.empty': '暂无数据',
  'follow.unfollow': '取消关注',
  'common.back': '返回',
  'common.retry': 'common.retry',
  'common.loading': 'common.loading',
}

/** 行形归一到共享 FollowUserItem(关注行带 bio/followedAt,粉丝行只到 createdAt)。 */
type FollowRow = {
  id: string
  userId?: string
  username?: string
  nickname?: string | null
  avatar?: string | null
  bio?: string | null
  followedAt?: string | null
  createdAt?: string | null
}

function toFollowUserItem(row: FollowRow): FollowUserItem {
  // RN 端 unfollowUser(item.id):FollowUserItem.id 即对方用户 id,故这里以 userId(退求 id)承载。
  return {
    id: row.userId ?? row.id,
    nickname: row.nickname ?? null,
    username: row.username ?? '',
    avatar: row.avatar ?? null,
    bio: row.bio ?? null,
    followedAt: row.followedAt ?? row.createdAt ?? '',
  }
}

/** 导航出口:共享屏空态/卡片当前无受控跳转时静默;已知 target 走小程序页。 */
const onNavigate: OnNavigate = (target) => {
  if (target === 'discover' || target === 'home') {
    void Taro.switchTab({ url: '/pages/index/index' })
  } else {
    onToast(`导航未接入: ${target}`, { kind: 'error' })
  }
}

export default function FollowingIndexPage() {
  const { t } = useI18n()
  const gate = useAuthReadyGate()
  const { resolvedTheme } = useTheme()
  const tt = useCallback((k: string, fb: string) => (t(k) === k ? fb : t(k)), [t])

  // 共享屏取词:共享键经 FOLLOW_TEXT 映射到本端显示文案
  const sharedT = useCallback((key: string) => FOLLOW_TEXT[key] ?? t(key), [t])

  const [tab, setTab] = useState<FollowTab>('following')

  // tab 各自取端点,行形归一到 FollowUserItem
  const fetchPage = useCallback(
    async (params: { page: number; pageSize: number }) => {
      const res =
        tab === 'fans' ? await getFollowers(params) : await getFollowing(params)
      const list = (res.list || []).map(toFollowUserItem)
      return { ...res, list }
    },
    [tab],
  )

  const { items, loading, load, removeItem } = useSocialList<FollowUserItem>({
    pageSize: PAGE_SIZE,
    fetch: fetchPage,
  })

  const [refreshing, setRefreshing] = useState(false)

  // 切 tab 即重取:load 闭包随 fetch 更新,首屏由 useDidShow 承担,这里跳过首轮
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

  // 下拉刷新(经小程序 usePullDownRefresh 桥接共享屏 RefreshControl)
  const onRefresh = useCallback(() => {
    setRefreshing(true)
    void load(true).finally(() => {
      setRefreshing(false)
      Taro.stopPullDownRefresh()
    })
  }, [load])

  // 上拉加载更多(经小程序 useReachBottom 桥接共享屏 onEndReached)
  const onLoadMore = useCallback(() => {
    void load()
  }, [load])

  // 取关确认弹窗(RN Alert → 小程序 showModal)
  const onUnfollow = useCallback(
    (item: FollowUserItem) => {
      Taro.showModal({
        title: tt('common.hint', '提示'),
        content: tt('following.cancel', '确认取消关注?'),
        success: async (res) => {
          if (!res.confirm) return
          try {
            await unfollowUser(item.id)
            removeItem(item.id)
            onToast(tt('common.success', '成功'), { kind: 'success' })
          } catch {
            onToast(tt('following.loadFailed', '操作失败'), { kind: 'error' })
          }
        },
      })
    },
    [tt, removeItem],
  )

  // G-933 冷启动门控:GET /follows/following(checkAuth)需鉴权,落定前不发
  useDidShow(() => gate.waitUntilReady(() => load(true)))
  useReachBottom(() => load())
  usePullDownRefresh(() => void onRefresh())

  return (
    <ThemeRoot>
      <SharedFollowScreen
        t={sharedT}
        items={items}
        activeTab={tab}
        onSelectTab={setTab}
        loading={loading}
        refreshing={refreshing}
        loadingMore={loading && items.length > 0}
        error=""
        onRefresh={onRefresh}
        onLoadMore={onLoadMore}
        onUnfollow={onUnfollow}
        onBack={() => {
          void Taro.navigateBack({ delta: 1 })
        }}
        onRetry={() => {
          void load(true)
        }}
        colorScheme={resolvedTheme}
        onNavigate={onNavigate}
        onToast={onToast}
      />
    </ThemeRoot>
  )
}

// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
