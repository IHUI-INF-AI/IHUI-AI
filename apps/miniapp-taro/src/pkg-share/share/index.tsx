// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

// 对齐目标(RN 共享屏): packages/app/src/features/share/ShareScreen.tsx
import { useTt, t } from '@/i18n'
import { View, Text } from '@tarojs/components'
import Taro, {
  useDidShow,
  usePullDownRefresh,
  useReachBottom,
  useShareAppMessage,
  useShareTimeline,
  usePageScroll,
} from '@tarojs/taro'
import { useState, useCallback, useEffect, useRef, useMemo } from 'react'
import * as api from '@/api'
import { useAuthReadyGate } from '@/hooks/use-auth-ready-gate'
import { NavBar, Ranking, DrawerComponent, FloatBox, type RankingItem } from '@/components'
import type { DrawerModelGroup, DrawerUserInfo } from '@/components/DrawerComponent'
import { getUserInfo } from '@/utils/auth'
import {
  groupConversationByDate,
  resolveConversationTimestamp,
} from '@ihui/shared/chat/conversation-date-group'
import LineIcon from '@/components/LineIcon'
import TitleSwitchScrollTitle from '@/components/TitleSwitchScrollTitle'
import type { TitleSwitchScrollTitleItem } from '@ihui/types'

/**
 * 本页自有分类模型(不复用 @ihui/types 的 CategoryItem):后者是 `{ id, label }`(学习赛道口径),
 * 而本页后端 `getInformationCategory` 返回的是 `{ id, name, count }` —— 键名与 id 类型
 * (string | number)都不同,硬套会得到"name 不存在"的 4 处类型错。分类语义归本页,故本地立型。
 */
interface ShareCategory {
  id: string | number
  name: string
  count?: number
}
import InformationItem from './components/InformationItem'
import NewTitle, { type NewTitleItem } from './components/NewTitle'
import CenterItem, { type CenterItemData } from './components/CenterItem'
import InterestTrackModal from './components/InterestTrackModal'
import ShareCard from './components/ShareCard'
import './index.css'
import SearchBar from '@/components/SearchBar'
import { aizhsUrl } from '@/constants/icon-urls'
import { TAB_BAR_OCCUPIED_PX, TAB_BAR_PAGE_RESERVE_CSS } from '@/constants/tab-bar-metrics'
import ScrollJumpButton, { pxToTaroRpx, scrollJumpInsetRpx } from '@/components/ScrollJumpButton'
import ThemeRoot from '@/components/ThemeRoot'
import { EmptyState, ErrorState, ScreenSkeleton } from '@/components/ScreenStates.taro'
import CategoryBar from '@/components/CategoryBar'
import { getTopBarMetrics } from '@/utils/system-info'
import { rpx } from '@/utils/rpx'
import { onToast } from '@/host/on-toast'

type Tab = 'latest' | 'hot' | 'following'

interface InfoItem {
  id: string | number
  title: string
  coverUrl?: string
  summary?: string
  content?: string
  createTime: string
  views?: number
  categoryName?: string
}

interface ChatHistoryItem {
  id: string
  title: string
  time: string
  messages?: Array<{ content?: string }>
  /** 展示用模型名与置顶(2026-11-23 后端 /ai/history 追加的同名字段) */
  modelName?: string
  pinned?: boolean
}

interface ModelItem {
  id: string
  name?: string
}

/** 分类选择持久化状态(对齐原项目 title-switch 7天缓存) */
interface ShareCategoryState {
  categoryId: string | number
  categoryName: string
  timestamp: number
  expire: number
}

/** 导航栏组件(对应原项目 navigationBars,功能已迁移至共享 NavBar 组件) */
const PAGE_SIZE = 10

/** 状态栏 + 胶囊按钮高度(对齐 NavBar 组件,确保 fixed navbar 不遮挡状态栏) */
const NAV_PADDING_TOP = getTopBarMetrics().menuButton.top

function asString(v: unknown): string {
  return typeof v === 'string' ? v : ''
}

function normalizeInfo(raw: Record<string, unknown>): InfoItem {
  return {
    id: (raw['id'] ?? '') as string | number,
    title: asString(raw['title']) || asString(raw['name']) || t('plaza.index.untitled'),
    coverUrl: asString(raw['coverUrl']) || asString(raw['cover'] || raw['imgUrl']),
    summary: asString(raw['summary']) || asString(raw['desc']),
    content: asString(raw['content']),
    createTime: asString(raw['createTime']) || asString(raw['createdAt']),
    views: typeof raw['views'] === 'number' ? raw['views'] : Number(raw['viewCount'] ?? 0),
    categoryName: asString(raw['categoryName']),
  }
}

export default function ShareIndexPage() {
  const tt = useTt()

  const [activeNavbar, setActiveNavbar] = useState(true) // 对齐原项目：默认 true，显示主内容
  const [activeTitleIndex, setActiveTitleIndex] = useState(0) // 对齐原项目：标题切换(0=每日资讯,1=排行榜)
  const [drawerVisible, setDrawerVisible] = useState(false)
  const [tagWrapShow, setTagWrapShow] = useState(false)
  const [pageScrollLocked, setPageScrollLocked] = useState(false)
  const [activeTab, setActiveTab] = useState<Tab>('latest')
  const [keyword, setKeyword] = useState('')
  const [activeCategory, setActiveCategory] = useState<string | number>(() => {
    // 对齐原项目 handleItemClicks:启动时恢复分类选择(7天缓存)
    try {
      const saved: unknown = Taro.getStorageSync('shareCategoryState')
      if (
        saved &&
        typeof saved === 'object' &&
        'categoryId' in saved &&
        'timestamp' in saved &&
        'expire' in saved
      ) {
        const s = saved as ShareCategoryState
        if (Date.now() - s.timestamp < s.expire) return s.categoryId
        Taro.removeStorageSync('shareCategoryState')
      }
    } catch {
      // 静默
    }
    return ''
  })
  const [infoList, setInfoList] = useState<InfoItem[]>([])
  const [page, setPage] = useState(1)
  const [noMore, setNoMore] = useState(false)
  const [loading, setLoading] = useState(false)
  /** 首屏/重置请求失败:与「真的没有资讯」分开,给出可点的重试出口 */
  const [loadError, setLoadError] = useState(false)

  const [categories, setCategories] = useState<ShareCategory[]>([])
  const [chatHistory, setChatHistory] = useState<ChatHistoryItem[]>([])
  // 模型列表:抽屉改为共享日期桶后不再按模型分组,只保留拉取(入口/统计后续可能复用)
  const [, setModelList] = useState<ModelItem[]>([])
  const [rankList, setRankList] = useState<RankingItem[]>([])
  const [showToodown, setShowToodown] = useState(false)
  const [hotList, setHotList] = useState<NewTitleItem[]>([])
  const [cardList, setCardList] = useState<CenterItemData[]>([])
  const [showTrackModal, setShowTrackModal] = useState(false) // 兴趣赛道弹窗(对齐原项目备用组件,首次进入显示)

  // 对齐原项目：状态栏高度
  const statusBarHeight = NAV_PADDING_TOP

  /** 锁定页面滚动 — 对齐原项目 lockPageScroll */
  const lockPageScroll = useCallback(() => {
    setPageScrollLocked(true)
  }, [])

  /** 解锁页面滚动 — 对齐原项目 unlockPageScroll */
  const unlockPageScroll = useCallback(() => {
    setPageScrollLocked(false)
  }, [])

  /** 分页刷新的并发/生命周期防线(2026-11-15) */
  const refreshTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const aliveRef = useRef(true)
  const loadingRef = useRef(false)
  const reqSeqRef = useRef(0)
  const listLengthRef = useRef(0)
  useEffect(() => {
    aliveRef.current = true
    return () => {
      aliveRef.current = false
      if (refreshTimerRef.current !== null) {
        clearTimeout(refreshTimerRef.current)
        refreshTimerRef.current = null
      }
    }
  }, [])
  // 三处刷新入口共用一枚定时器:先清后排,避免连点时多个宏任务回调在同一批次
  // 重复发请求;卸载时一并撤销,不再出现"页面已销毁还在 setState"。
  const scheduleRefresh = useCallback(() => {
    if (refreshTimerRef.current !== null) clearTimeout(refreshTimerRef.current)
    refreshTimerRef.current = setTimeout(() => {
      refreshTimerRef.current = null
      if (aliveRef.current) void loadRef.current(true)
    }, 0)
  }, [])

  const loadList = useCallback(
    async (reset = false) => {
      // 同步判据,不再依赖 re-render 后的 loading 快照:连点 Tab/分类时旧写法
      // 多个定时器回调在同一宏任务批次都读到 loading=false,并发请求相互覆盖。
      if (loadingRef.current) return
      let curPage = page
      if (reset) {
        curPage = 1
        setNoMore(false)
        setInfoList([])
        setPage(1)
        listLengthRef.current = 0
      }
      if (!reset && noMore) return
      loadingRef.current = true
      const seq = ++reqSeqRef.current
      if (reset) {
        setLoadError(false)
      }
      setLoading(true)
      try {
        const params: Record<string, unknown> = { page: curPage, pageSize: PAGE_SIZE }
        if (keyword) params['keyword'] = keyword
        if (activeCategory) params['categoryId'] = activeCategory
        if (activeTab === 'hot') params['sort'] = 'hot'
        if (activeTab === 'following') params['following'] = 1
        const res = (await api.getNewsList(params)) as { list?: unknown[]; total?: number }
        // 卸载后或已被更新的一次请求取代时丢弃回包,避免旧响应覆盖新列表。
        if (!aliveRef.current || seq !== reqSeqRef.current) return
        const rawList = Array.isArray(res?.list) ? res.list : []
        const newList = rawList.map((r) => normalizeInfo(r as Record<string, unknown>))
        const total = typeof res?.total === 'number' && res.total > 0 ? res.total : null
        const nextLength = (reset ? 0 : listLengthRef.current) + newList.length
        listLengthRef.current = nextLength
        setInfoList((prev) => (reset ? newList : [...prev, ...newList]))
        // 后端未给可信 total 时按「本页是否满页」推导;旧写法把缺失 total 当 0,
        // newList.length >= 0 恒真 ⇒ 第一页就置 noMore,触底永远加载不出第二页。
        setNoMore(total === null ? newList.length < PAGE_SIZE : nextLength >= total)
        setPage(curPage + 1)
      } catch {
        // 失败不再静默:reset 档清空后若没有列表,渲染错误态而不是「暂无资讯」
        if (reset) {
          setInfoList([])
          setLoadError(true)
        }
      } finally {
        if (aliveRef.current && seq === reqSeqRef.current) {
          loadingRef.current = false
          setLoading(false)
        }
      }
    },
    [page, noMore, keyword, activeCategory, activeTab],
  )

  const loadCategories = useCallback(async () => {
    try {
      const res = (await api.getInformationCategory()) as { list?: unknown[] }
      const rawList = Array.isArray(res?.list) ? res.list : []
      setCategories(
        rawList.map((r) => {
          const raw = r as Record<string, unknown>
          return {
            id: (raw['id'] ?? '') as string | number,
            name: asString(raw['name']),
            count: typeof raw['count'] === 'number' ? raw['count'] : undefined,
          }
        }),
      )
    } catch {
      // ignore
    }
  }, [])

  const loadChatHistory = useCallback(async () => {
    try {
      const res = (await api.getChatHistory({ page: 1, pageSize: 20 })) as {
        list?: unknown[]
        total?: number
      }
      const rawList = Array.isArray(res?.list) ? res.list : []
      setChatHistory(
        rawList.map((r) => {
          const raw = r as Record<string, unknown>
          return {
            id: asString(raw['id']),
            title: asString(raw['title']),
            time: asString(raw['time']),
            modelName: asString(raw['modelName']) || undefined,
            pinned: raw['pinned'] === true,
            messages: Array.isArray(raw['messages'])
              ? (raw['messages'] as ChatHistoryItem['messages'])
              : undefined,
          }
        }),
      )
    } catch {
      // ignore
    }
  }, [])

  const loadModelList = useCallback(async () => {
    try {
      const res = (await api.getCozeApiList()) as { list?: unknown[]; models?: unknown[] }
      const rawList = Array.isArray(res?.list)
        ? res.list
        : Array.isArray(res?.models)
          ? res.models
          : []
      setModelList(
        rawList.map((r) => {
          const raw = r as Record<string, unknown>
          return {
            id: asString(raw['id']) || asString(raw['model']),
            name: asString(raw['name']) || asString(raw['modelName']),
          }
        }),
      )
    } catch {
      // ignore
    }
  }, [])

  const loadRankList = useCallback(async () => {
    try {
      const res = (await api.getRankingList('creation')) as { list?: unknown[] }
      const rawList = Array.isArray(res?.list) ? res.list : []
      setRankList(
        rawList.map((r) => {
          const raw = r as Record<string, unknown>
          return {
            id: asString(raw['id']) || String(raw['id'] ?? Math.random()),
            nickname: asString(raw['nickname']) || asString(raw['name']),
            avatar: asString(raw['avatar']),
            score: typeof raw['score'] === 'number' ? raw['score'] : Number(raw['commission'] ?? 0),
          }
        }),
      )
    } catch {
      // ignore
    }
  }, [])

  /** 加载热门资讯 — 对齐原项目 hot_data */
  const loadHotList = useCallback(async () => {
    try {
      const params: Record<string, unknown> = { page: 1, pageSize: 5, sort: 'hot' }
      const res = (await api.getNewsList(params)) as { list?: unknown[]; total?: number }
      const rawList = Array.isArray(res?.list) ? res.list : []
      setHotList(
        rawList.map((r) => {
          const raw = r as Record<string, unknown>
          return {
            id: (raw['id'] ?? '') as string | number,
            title: asString(raw['title']) || asString(raw['name']) || '',
          }
        }),
      )
    } catch {
      setHotList([])
    }
  }, [])

  /** 加载推荐卡片 — 对齐原项目 all_data */
  const loadCardList = useCallback(async () => {
    try {
      const params: Record<string, unknown> = { page: 1, pageSize: 4 }
      const res = (await api.getNewsList(params)) as { list?: unknown[]; total?: number }
      const rawList = Array.isArray(res?.list) ? res.list : []
      setCardList(
        rawList.map((r) => {
          const raw = r as Record<string, unknown>
          return {
            id: (raw['id'] ?? '') as string | number,
            title: asString(raw['title']) || asString(raw['name']) || '',
            coverUrl: asString(raw['coverUrl']) || asString(raw['cover']),
            categoryName: asString(raw['categoryName']),
            views: typeof raw['views'] === 'number' ? raw['views'] : Number(raw['viewCount'] ?? 0),
          }
        }),
      )
    } catch {
      setCardList([])
    }
  }, [])

  const loadRef = useRef(loadList)
  loadRef.current = loadList

  useEffect(() => {
    void loadRankList()
    void loadCategories()
  }, [loadRankList, loadCategories])

  // G-933 冷启动门控：只挡 loadChatHistory → GET /api/ai/history
  // (ai-user-model-chat.ts:448 用 request.userId!，插件级 preHandler :246，前缀 /api/ai 见 index.ts:828)。
  // loadRef/loadModelList/loadHotList/loadCardList 属公开列表或取证不足，按票面口径原样照发。
  const { waitUntilReady } = useAuthReadyGate()
  useDidShow(() => {
    if (activeNavbar) {
      void loadRef.current(true)
      void loadModelList()
      void loadHotList()
      void loadCardList()
      waitUntilReady(() => {
        void loadChatHistory()
      })
    }
    // 首次进入显示兴趣赛道选择(对齐原项目备用组件)
    try {
      const hasSelectedTracks: unknown = Taro.getStorageSync('hasSelectedTracks')
      if (!hasSelectedTracks) {
        setShowTrackModal(true)
      }
    } catch {
      // 静默
    }
  })

  usePullDownRefresh(() => {
    if (activeNavbar) {
      void loadRef.current(true).finally(() => Taro.stopPullDownRefresh())
    } else {
      void loadRankList().finally(() => Taro.stopPullDownRefresh())
    }
  })

  useReachBottom(() => {
    if (activeNavbar) void loadRef.current()
  })

  usePageScroll((res) => {
    // 对齐原项目：处理 toodown 按钮显示逻辑
    if (res.scrollTop > 200) {
      setShowToodown(true)
    } else {
      setShowToodown(false)
    }
    // 对齐原项目：页面滚动时关闭分类弹层
    if (tagWrapShow && res.scrollTop > 5) {
      setTagWrapShow(false)
      unlockPageScroll()
      // 对齐原项目 uni.$emit('trigger-nav-click')：通知 navbar 关闭分类按钮 active 态
      Taro.eventCenter.trigger('trigger-nav-click')
    }
  })

  useShareAppMessage(() => ({
    title: tt('share.index.title', 'AI资讯'),
    path: '/pkg-share/share/index?source=share',
    imageUrl: aizhsUrl('remote-images/share_zhz.png'),
  }))

  useShareTimeline(() => ({
    title: tt('share.index.title', 'AI资讯'),
  }))

  /** 对齐原项目 activeNav：切换 rankings 与主内容视图 */
  const activeNav = useCallback((index: number) => {
    setActiveTitleIndex(index)
    if (index === 0) {
      setActiveNavbar(true)
    } else {
      setActiveNavbar(false)
    }
  }, [])

  const switchTab = useCallback(
    (tab: Tab) => {
      if (tab === activeTab) return
      setActiveTab(tab)
      setPage(1)
      setNoMore(false)
      setInfoList([])
      scheduleRefresh()
    },
    [activeTab, scheduleRefresh],
  )

  const selectCategory = useCallback(
    (cat: ShareCategory) => {
      setActiveCategory(cat.id)
      setTagWrapShow(false)
      unlockPageScroll()
      setPage(1)
      setNoMore(false)
      setInfoList([])
      // 对齐原项目 handleItemClicks:分类选择状态持久化(7天缓存)
      try {
        Taro.setStorageSync('shareCategoryState', {
          categoryId: cat.id,
          categoryName: cat.name,
          timestamp: Date.now(),
          expire: 7 * 24 * 60 * 60 * 1000,
        } as ShareCategoryState)
      } catch {
        // 静默
      }
      scheduleRefresh()
    },
    [unlockPageScroll, scheduleRefresh],
  )

  /** TitleSwitchScrollTitle 选择分类回调 */
  const handleTitleSwitchChange = useCallback(
    (item: TitleSwitchScrollTitleItem) => {
      const matched = categories.find((c) => c.name === item.name)
      if (matched) {
        selectCategory(matched)
      } else {
        selectCategory({ id: '', name: '' })
      }
    },
    [categories, selectCategory],
  )

  const onSearchConfirm = useCallback(() => {
    setPage(1)
    setNoMore(false)
    setInfoList([])
    scheduleRefresh()
  }, [scheduleRefresh])

  const goInfoDetail = useCallback((id: string | number) => {
    Taro.navigateTo({ url: `/pkg-content/news/detail?id=${id}` })
  }, [])

  const backToTop = useCallback(() => {
    Taro.pageScrollTo({ scrollTop: 0, duration: 300 })
    setShowToodown(false)
  }, [])

  const addNewChat = useCallback(() => {
    Taro.navigateTo({ url: '/pkg-ai/ai/chat' })
  }, [])

  const safePreventTouchMove = useCallback((e: { stopPropagation: () => void }) => {
    e.stopPropagation()
  }, [])

  /** 关闭弹出层 — 对齐原项目 closePopup */
  const closePopup = useCallback(() => {
    setTagWrapShow(false)
    unlockPageScroll()
  }, [unlockPageScroll])

  /** 关闭分类弹层 — 对齐原项目 closeTitleSwitch(通知 navbar 同步 active 态) */
  const closeTitleSwitch = useCallback(() => {
    setTagWrapShow(false)
    unlockPageScroll()
    // 对齐原项目 this.$refs.navbar.handleNavClick()：通知 navbar 关闭分类按钮 active 态
    Taro.eventCenter.trigger('trigger-nav-click')
  }, [unlockPageScroll])

  /** 分类按钮点击 — 对齐原项目 handleNavClick：只控制分类弹层，锁定/解锁页面滚动 */
  const handleNavClick = useCallback(() => {
    setTagWrapShow((prev) => {
      const next = !prev
      if (next) {
        lockPageScroll()
      } else {
        unlockPageScroll()
      }
      return next
    })
  }, [lockPageScroll, unlockPageScroll])

  /** 菜单按钮点击 — 对齐原项目 handleMenuClick：只控制侧边栏 */
  const handleMenuClick = useCallback(() => {
    setDrawerVisible((prev) => !prev)
  }, [])

  /** 关闭抽屉 — 对齐原项目 close_drawer */
  const handleCloseDrawer = useCallback(() => {
    setDrawerVisible(false)
  }, [])

  /**
   * 抽屉底部用户行(2026-11-23):此前 share 页未传 userinfo ⇒ 抽屉底部恒为未登录兜底,
   * 与 web SidebarUserRow(恒显示当前账号)不一致;这里与另三页同口径读登录态。
   */
  const [drawerUserinfo, setDrawerUserinfo] = useState<DrawerUserInfo | undefined>(undefined)
  useEffect(() => {
    const u = getUserInfo()
    if (u) {
      setDrawerUserinfo({
        // DrawerUserInfo 只有 avatar/nickname 两键(见 DrawerComponent:67-70),不带 id
        avatar: u.avatar || '',
        nickname: u.userName || u.nickname || tt('common.user', '智汇AI用户'),
      })
    }
    // 依赖 tt：useTt 返回稳定引用，补进依赖后行为等价于“只在挂载时读一次”，故不再需要抑制
  }, [tt])

  /**
   * 构建 DrawerComponent 所需的 groupedData。
   * DrawerComponent 的契约是 `DrawerModelGroup[]`(模型名 + 该模型下的日期桶),本页没有按模型
   * 拆分的历史对话(chatHistory 是全量流水),故只给一个"全部对话"组、把日期桶原样装进去;
   * 不传 modelLogo 时抽屉按 LineIcon bot 兜底渲染(见 DrawerComponent:407-422)。
   */
  const groupedData = useMemo<DrawerModelGroup[]>(
    () => [
      {
        modelName: tt('common.all', '全部'),
        dateGroups: groupConversationByDate(chatHistory, (c) =>
          resolveConversationTimestamp([c.time]),
        ).map((g) => ({
          // DrawerDateGroup 的契约是 { date, chats }:date 兼作抽屉里的分组标题(今天/本周/…)
          date: String(g.key),
          // DrawerChatItem 只允许 id/title/date 三键,多余字段会被 TS 的过量属性检查拒掉
          chats: g.items.map((c) => ({ id: c.id, title: c.title, date: c.time })),
        })),
      },
    ],
    [chatHistory, tt],
  )

  /** TitleSwitchScrollTitle 列表数据 */
  const titleSwitchMainList = useMemo<TitleSwitchScrollTitleItem[]>(() => {
    const allItem: TitleSwitchScrollTitleItem = {
      name: tt('common.all', '全部'),
      children: [],
    }
    return [
      allItem,
      ...categories.map((cat) => ({
        name: cat.name,
        children: [] as TitleSwitchScrollTitleItem[],
      })),
    ]
  }, [categories, tt])

  // ===== 排行榜入口视图(activeNavbar=false) =====
  if (!activeNavbar) {
    // 页面根即滚动容器(整页原生滚动)⇒ 留位取单一出处 `constants/tab-bar-metrics`。
    // 原端内手写的 `pb-[calc(140rpx+env(...))]`(= 70px,同一名目的第二份量)由该常量取代,
    // 不留两个互相覆盖的 padding。
    return (
      <View className="share-page" style={{ paddingBottom: TAB_BAR_PAGE_RESERVE_CSS }}>
        <View className="share-rank-wrap">
          <View className="share-rank-header">
            <View className="share-rank-header-left">
              <Text className="share-rank-title">{tt('share.index.title', 'AI资讯')}</Text>
              <Text className="share-rank-subtitle">
                {tt('share.index.subtitle', '汇聚前沿科技资讯')}
              </Text>
            </View>
            <View className="share-rank-enter" onClick={() => activeNav(0)} hoverClass="opacity-60">
              <Text className="share-rank-enter-text">{tt('share.index.enter', '进入资讯')}</Text>
              <LineIcon name="chevron-right" size={24} color="var(--color-cta-foreground)" />
            </View>
          </View>
          <View className="share-rank-card">
            <View className="share-rank-card-header">
              <Text className="share-rank-card-title">{tt('share.index.hotRank', '热门排行')}</Text>
              <Text className="share-rank-card-unit">{tt('ranking.unitCreation', '分')}</Text>
            </View>
            <Ranking
              list={rankList.slice(0, 10)}
              title=""
              unit={tt('ranking.unitCreation', '分')}
              loading={rankList.length === 0}
            />
            {rankList.length > 0 ? (
              <View
                className="share-rank-more"
                onClick={() => setActiveNavbar(true)}
                hoverClass="opacity-60"
              >
                <Text className="share-rank-more-text">{tt('common.more', '更多')}</Text>
                <LineIcon
                  name="chevron-right"
                  size={24}
                  color="var(--color-muted-foreground)"
                  style={{ marginLeft: 'var(--spacing-2xs)' }}
                />
              </View>
            ) : null}
          </View>
        </View>
      </View>
    )
  }

  // ===== 主容器(activeNavbar=true) — 对齐原项目 main-container =====
  return (
    <ThemeRoot className="share-page">
      {/* DrawerComponent 侧边栏抽屉 — 对齐原项目：放在 main-container 外部顶层 */}
      <DrawerComponent
        visible={drawerVisible}
        onClose={handleCloseDrawer}
        side="left"
        statusBarHeight={statusBarHeight}
        groupedData={groupedData}
        userinfo={drawerUserinfo}
        onCreateChat={() => {
          setDrawerVisible(false)
          addNewChat()
        }}
        onChatItemClick={(chat) => {
          setDrawerVisible(false)
          // 对齐原项目 handleShowFullList:携带 chatId + title 参数
          Taro.navigateTo({
            url: `/pkg-ai/ai/chat?chatId=${chat.id}&title=${encodeURIComponent(chat.title)}`,
            fail: () => onToast(tt('share.text5', '对话页未配置'), { kind: 'error' }),
          })
        }}
        onRemoveChat={(chat) => {
          Taro.showModal({
            title: tt('common.hint', '提示'),
            content: tt('share.confirm6', '确定删除此对话?'),
            success: async (res) => {
              if (res.confirm) {
                try {
                  await api.removeModelChat(String(chat.id))
                  onToast(tt('message.deleted', '已删除'), { kind: 'success' })
                  void loadChatHistory()
                } catch {
                  onToast(tt('developer.index.deleteFail', '删除失败'), { kind: 'error' })
                }
              }
            },
          })
        }}
      />

      {/* main-container — 对齐原项目结构，no-scroll 样式由 tagWrapShow 控制。
          整页原生滚动(页面根本没有 ScrollView)⇒ 底部留位加在本容器上,取单一出处
          `constants/tab-bar-metrics`;`.share-list` 自己的 96rpx 底部呼吸位不与此冲突,保持不动。 */}
      <View
        className={`share-main-container${tagWrapShow ? ' no-scroll' : ''}`}
        style={{
          minHeight: '110vh',
          color: 'var(--color-foreground)',
          paddingBottom: TAB_BAR_PAGE_RESERVE_CSS,
        }}
      >
        {/* FloatBox 浮动组件 — 对齐原项目：放在 main-container 内部 */}
        <FloatBox />

        {/* 共享 NavBar — 使用 variant="ai-home" 模式,传递标题切换回调 */}
        <NavBar
          variant="ai-home"
          title={tt('share.index.title', 'AI资讯')}
          bgColor="var(--color-background)"
          activeTitleIndex={activeTitleIndex}
          onActiveNav={activeNav}
          showFenLei
          onFenLeiClick={handleNavClick}
          onMenuClick={handleMenuClick}
        />

        {/* Tabs:统一分类条(与 web / RN 同形同档) */}
        <CategoryBar
          className="share-tabs"
          value={activeTab}
          onChange={(id) => switchTab(id as Tab)}
          items={[
            { id: 'latest', label: tt('share.index.tabLatest', '最新') },
            { id: 'hot', label: tt('share.index.tabHot', '热门') },
            { id: 'following', label: tt('share.index.tabFollowing', '关注') },
          ]}
        />

        {/* 搜索栏(统一圆角输入井,共享 SearchBar) */}
        <SearchBar
          value={keyword}
          placeholder={tt('news.search', '搜索资讯')}
          onInput={setKeyword}
          onSearch={onSearchConfirm}
          onClear={() => setKeyword('')}
        />

        {/* 分享卡(对齐共享屏 ShareScreen 的备注/生成分享/链接·分享码·有效期/立即分享) */}
        <ShareCard />

        {/* 热门资讯(NewTitle)— 对齐原项目 hot_data */}
        {hotList.length > 0 ? (
          <NewTitle items={hotList} onItemClick={(item) => goInfoDetail(item.id)} />
        ) : null}

        {/* 推荐卡片(CenterItem)— 对齐原项目 all_data */}
        {cardList.length > 0 ? (
          <CenterItem items={cardList} onItemClick={(item) => goInfoDetail(item.id)} />
        ) : null}

        {/* 资讯列表 */}
        <View className="share-list">
          {infoList.length ? (
            infoList.map((n, idx) => (
              <InformationItem
                key={n.id}
                item={{
                  id: n.id,
                  title: n.title,
                  content: n.summary,
                  // 仅在首项或与前一项日期不同时显示日期分组标题
                  date:
                    idx === 0 ||
                    infoList[idx - 1]?.createTime.slice(0, 10) !== n.createTime.slice(0, 10)
                      ? n.createTime.slice(0, 10)
                      : undefined,
                  source: n.categoryName,
                  views: n.views,
                  coverUrl: n.coverUrl,
                }}
                showTimeline={true}
                onClick={(item) => goInfoDetail(item.id)}
              />
            ))
          ) : !loading && loadError ? (
            <ErrorState
              message={tt('news.loadFailed', '资讯加载失败')}
              retryLabel={tt('common.retry', '重试')}
              onRetry={() => void loadRef.current(true)}
            />
          ) : !loading ? (
            <EmptyState title={tt('news.empty', '暂无资讯')} />
          ) : null}
          {loading && infoList.length === 0 ? <ScreenSkeleton variant="list" count={3} /> : null}
          {loading && infoList.length > 0 ? (
            <View className="share-loading">
              <View className="share-loading-dot" />
              <View className="share-loading-dot" />
              <View className="share-loading-dot" />
            </View>
          ) : null}
          {!loading && infoList.length && noMore ? (
            <View className="share-nomore">
              <Text className="share-nomore-text">{tt('common.noMore', '没有更多了')}</Text>
            </View>
          ) : null}
        </View>

        {/* 页面滚动锁定覆盖层 — 对齐原项目 scroll-lock-overlay */}
        {pageScrollLocked ? (
          <View
            className="share-scroll-lock-overlay"
            style={{
              position: 'fixed',
              inset: 0,
              zIndex: 900,
              background: 'transparent',
              touchAction: 'none',
              overflow: 'hidden',
            }}
            onTouchMove={safePreventTouchMove}
            onClick={closePopup}
          />
        ) : null}

        {/* BackToTop 回到顶部按钮:外观与几何不在此设定,由 ScrollJumpButton 单一源给出;
         *  这里只给定位(贴右下 + 给悬浮 TabBar 让位) */}
        {showToodown ? (
          <ScrollJumpButton
            direction="top"
            onTap={backToTop}
            style={{
              position: 'fixed',
              right: rpx(scrollJumpInsetRpx()),
              bottom: rpx(pxToTaroRpx(TAB_BAR_OCCUPIED_PX) + scrollJumpInsetRpx()),
            }}
          />
        ) : null}

        {/* 分类弹层 — 对齐原项目：TitleSwitchScrollTitle 作为分类选择器 */}
        {tagWrapShow ? (
          <View className="share-tag-panel">
            <View className="share-tag-panel-header">
              <Text className="share-tag-panel-title">
                {tt('share.index.selectCategory', '选择分类')}
              </Text>
            </View>
            <View className="share-tag-scroll-title-wrap">
              <TitleSwitchScrollTitle
                mainList={titleSwitchMainList}
                mainSwiperMargin="80rpx"
                subSwiperMargin="80rpx"
                onChange={handleTitleSwitchChange}
              />
            </View>
          </View>
        ) : null}

        {/* 遮罩层 — 对齐原项目 mask-overlay，tagWrapShow 时显示，z-index: 899（低于导航栏） */}
        {tagWrapShow ? (
          <View
            className="share-mask-overlay"
            onClick={closeTitleSwitch}
            onTouchMove={safePreventTouchMove}
          />
        ) : null}
      </View>

      {/* 兴趣赛道选择弹窗 — 对齐原项目备用组件,首次进入显示 */}
      <InterestTrackModal
        visible={showTrackModal}
        onConfirm={(selectedTracks) => {
          try {
            Taro.setStorageSync(
              'selectedTracks',
              selectedTracks.map((t) => t.id),
            )
            Taro.setStorageSync('hasSelectedTracks', true)
          } catch {
            // 静默
          }
          setShowTrackModal(false)
          onToast(`已选择 ${selectedTracks.length} 个赛道`, { kind: 'success' })
        }}
        onClose={() => {
          setShowTrackModal(false)
          try {
            Taro.setStorageSync('hasSelectedTracks', true)
          } catch {
            // 静默
          }
        }}
      />
    </ThemeRoot>
  )
}
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
