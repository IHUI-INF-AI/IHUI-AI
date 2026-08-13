import { View, Text, Input } from '@tarojs/components'
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
import { NavBar, Ranking, DrawerComponent, FloatBox, type RankingItem } from '@/components'
import TitleSwitchScrollTitle from '@/components/TitleSwitchScrollTitle'
import type { TitleSwitchScrollTitleItem } from '@ihui/types'
import { useI18n } from '@/i18n'
import InformationItem from './components/InformationItem'
import './index.css'

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

interface CategoryItem {
  id: string | number
  name: string
  count?: number
}

interface ChatHistoryItem {
  id: string
  title: string
  time: string
  messages?: Array<{ content?: string }>
}

interface ModelItem {
  id: string
  name?: string
}

/** 导航栏组件(对应原项目 navigationBars,功能已迁移至共享 NavBar 组件) */
const PAGE_SIZE = 10

/** 状态栏 + 胶囊按钮高度(对标 NavBar 组件,确保 fixed navbar 不遮挡状态栏) */
const menuButton = Taro.getMenuButtonBoundingClientRect?.() || { top: 26, height: 32 }
const NAV_PADDING_TOP = menuButton.top

function asString(v: unknown): string {
  return typeof v === 'string' ? v : ''
}

function normalizeInfo(raw: Record<string, unknown>): InfoItem {
  return {
    id: (raw['id'] ?? '') as string | number,
    title: asString(raw['title']) || asString(raw['name']) || '未命名',
    coverUrl: asString(raw['coverUrl']) || asString(raw['cover'] || raw['imgUrl']),
    summary: asString(raw['summary']) || asString(raw['desc']),
    content: asString(raw['content']),
    createTime: asString(raw['createTime']) || asString(raw['createdAt']),
    views: typeof raw['views'] === 'number' ? raw['views'] : Number(raw['viewCount'] ?? 0),
    categoryName: asString(raw['categoryName']),
  }
}

export default function ShareIndexPage() {
  const { t } = useI18n()
  const tt = useCallback((k: string, fb: string) => (t(k) === k ? fb : t(k)), [t])

  const [activeNavbar, setActiveNavbar] = useState(true) // 对齐原项目：默认 true，显示主内容
  const [activeTitleIndex, setActiveTitleIndex] = useState(0) // 对齐原项目：标题切换(0=每日资讯,1=排行榜)
  const [drawerVisible, setDrawerVisible] = useState(false)
  const [tagWrapShow, setTagWrapShow] = useState(false)
  const [pageScrollLocked, setPageScrollLocked] = useState(false)
  const [activeTab, setActiveTab] = useState<Tab>('latest')
  const [keyword, setKeyword] = useState('')
  const [activeCategory, setActiveCategory] = useState<string | number>('')
  const [infoList, setInfoList] = useState<InfoItem[]>([])
  const [page, setPage] = useState(1)
  const [noMore, setNoMore] = useState(false)
  const [loading, setLoading] = useState(false)

  const [categories, setCategories] = useState<CategoryItem[]>([])
  const [chatHistory, setChatHistory] = useState<ChatHistoryItem[]>([])
  const [modelList, setModelList] = useState<ModelItem[]>([])
  const [rankList, setRankList] = useState<RankingItem[]>([])
  const [showToodown, setShowToodown] = useState(false)

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

  const loadList = useCallback(
    async (reset = false) => {
      if (loading) return
      let curPage = page
      if (reset) {
        curPage = 1
        setNoMore(false)
        setInfoList([])
        setPage(1)
      }
      if (!reset && noMore) return
      setLoading(true)
      try {
        const params: Record<string, unknown> = { page: curPage, pageSize: PAGE_SIZE }
        if (keyword) params['keyword'] = keyword
        if (activeCategory) params['categoryId'] = activeCategory
        if (activeTab === 'hot') params['sort'] = 'hot'
        if (activeTab === 'following') params['following'] = 1
        const res = (await api.getNewsList(params)) as { list?: unknown[]; total?: number }
        const rawList = Array.isArray(res?.list) ? res.list : []
        const newList = rawList.map((r) => normalizeInfo(r as Record<string, unknown>))
        const total = typeof res?.total === 'number' ? res.total : 0
        setInfoList((prev) => (reset ? newList : [...prev, ...newList]))
        setNoMore((reset ? newList.length : infoList.length + newList.length) >= total)
        setPage(curPage + 1)
      } catch {
        // ignore
      } finally {
        setLoading(false)
      }
    },
    [loading, page, noMore, keyword, activeCategory, activeTab, infoList.length],
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
            messages: Array.isArray(raw['messages']) ? (raw['messages'] as ChatHistoryItem['messages']) : undefined,
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
      const rawList = Array.isArray(res?.list) ? res.list : Array.isArray(res?.models) ? res.models : []
      setModelList(
        rawList.map((r) => {
          const raw = r as Record<string, unknown>
          return { id: asString(raw['id']) || asString(raw['model']), name: asString(raw['name']) || asString(raw['modelName']) }
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

  const loadRef = useRef(loadList)
  loadRef.current = loadList

  useEffect(() => {
    void loadRankList()
    void loadCategories()
  }, [loadRankList, loadCategories])

  useDidShow(() => {
    if (activeNavbar) {
      void loadRef.current(true)
      void loadChatHistory()
      void loadModelList()
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
    }
  })

  useShareAppMessage(() => ({
    title: tt('share.index.title', 'AI资讯'),
    path: '/pages/share/index',
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
      setTimeout(() => void loadRef.current(true), 0)
    },
    [activeTab],
  )

  const selectCategory = useCallback(
    (cat: CategoryItem) => {
      setActiveCategory(cat.id)
      setTagWrapShow(false)
      unlockPageScroll()
      setPage(1)
      setNoMore(false)
      setInfoList([])
      setTimeout(() => void loadRef.current(true), 0)
    },
    [unlockPageScroll],
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
    setTimeout(() => void loadRef.current(true), 0)
  }, [])

  const goInfoDetail = useCallback((id: string | number) => {
    Taro.navigateTo({ url: `/pages/news/detail?id=${id}` })
  }, [])

  const backToTop = useCallback(() => {
    Taro.pageScrollTo({ scrollTop: 0, duration: 300 })
    setShowToodown(false)
  }, [])

  const addNewChat = useCallback(() => {
    Taro.navigateTo({ url: '/pages/ai/chat' })
  }, [])

  const safePreventTouchMove = useCallback((e: { stopPropagation: () => void }) => {
    e.stopPropagation()
  }, [])

  /** 关闭弹出层 — 对齐原项目 closePopup */
  const closePopup = useCallback(() => {
    setTagWrapShow(false)
    unlockPageScroll()
  }, [unlockPageScroll])

  /** 关闭分类弹层 — 对齐原项目 closeTitleSwitch */
  const closeTitleSwitch = useCallback(() => {
    setTagWrapShow(false)
    unlockPageScroll()
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

  /** 构建 DrawerComponent 所需的 groupedData */
  const groupedData = useMemo(() => {
    if (!chatHistory.length && !modelList.length) return []

    const groups: Array<{
      modelName: string
      modelLogo?: string
      dateGroups: Array<{
        date: string
        chats: Array<{ id: string | number; title: string; date: string }>
      }>
    }> = []

    // 按模型分组
    for (const model of modelList) {
      const modelChats = chatHistory.filter((c) => c.id.startsWith(String(model.id)) || modelList.length === 1)
      if (modelChats.length === 0) continue

      // 按日期分组
      const dateMap = new Map<string, Array<{ id: string | number; title: string; date: string }>>()
      for (const chat of modelChats) {
        const dateKey = chat.time ? chat.time.slice(0, 10) : '最近'
        if (!dateMap.has(dateKey)) dateMap.set(dateKey, [])
        dateMap.get(dateKey)!.push({ id: chat.id, title: chat.title, date: chat.time })
      }

      groups.push({
        modelName: model.name || model.id,
        dateGroups: Array.from(dateMap.entries()).map(([date, chats]) => ({ date, chats })),
      })
    }

    // 如果没有模型列表,把所有对话放在一个默认组
    if (groups.length === 0 && chatHistory.length > 0) {
      const dateMap = new Map<string, Array<{ id: string | number; title: string; date: string }>>()
      for (const chat of chatHistory) {
        const dateKey = chat.time ? chat.time.slice(0, 10) : '最近'
        if (!dateMap.has(dateKey)) dateMap.set(dateKey, [])
        dateMap.get(dateKey)!.push({ id: chat.id, title: chat.title, date: chat.time })
      }
      groups.push({
        modelName: tt('share.index.history', '历史对话'),
        dateGroups: Array.from(dateMap.entries()).map(([date, chats]) => ({ date, chats })),
      })
    }

    return groups
  }, [chatHistory, modelList, tt])

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
    return (
      <View className="share-page">
        <View className="share-rank-wrap">
          <View className="share-rank-header">
            <View className="share-rank-header-left">
              <Text className="share-rank-title">{tt('share.index.title', 'AI资讯')}</Text>
              <Text className="share-rank-subtitle">{tt('share.index.subtitle', '汇聚前沿科技资讯')}</Text>
            </View>
            <View className="share-rank-enter" onClick={() => activeNav(0)}>
              <Text className="share-rank-enter-text">{tt('share.index.enter', '进入资讯')}</Text>
              <Text className="share-rank-enter-arrow">→</Text>
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
              <View className="share-rank-more" onClick={() => setActiveNavbar(true)}>
                <Text className="share-rank-more-text">{tt('share.index.viewMore', '查看更多排行')}</Text>
              </View>
            ) : null}
          </View>
        </View>
      </View>
    )
  }

  // ===== 主容器(activeNavbar=true) — 对齐原项目 main-container =====
  return (
    <View className="share-page">
      {/* DrawerComponent 侧边栏抽屉 — 对齐原项目：放在 main-container 外部顶层 */}
      <DrawerComponent
        visible={drawerVisible}
        onClose={handleCloseDrawer}
        side="left"
        statusBarHeight={statusBarHeight}
        groupedData={groupedData}
        onMenuItemClick={(item) => {
          setDrawerVisible(false)
          // 对齐原项目 gopage L324-351:5 个菜单项路由映射
          const routeMap: Record<string, string> = {
            appStore: '/pages/index/index', // 对齐原项目 aiIndex
            demand: '/pages/ranking/index', // 对齐原项目 square
            inspiration: '/pages/aigc/list', // 对齐原项目 aigc
            dynamic: '/pages/share/index', // 对齐原项目 share(当前页)
            course: '/pages/course/list', // 对齐原项目 studyindex
          }
          const url = routeMap[item.key]
          if (!url) return
          if (item.key === 'appStore') {
            // tabBar 页用 switchTab,失败回退 navigateTo
            Taro.switchTab({ url, fail: () => Taro.navigateTo({ url }) })
          } else if (item.key === 'dynamic') {
            // 当前页,无需跳转
          } else {
            Taro.navigateTo({ url, fail: () => Taro.showToast({ title: '页面未配置', icon: 'none' }) })
          }
        }}
        onLabelItemClick={(item) => {
          setDrawerVisible(false)
          // 对齐原项目 gotocompany/lingqu L352-373
          if (item.key === 'newChat') {
            // 对齐原项目 addNewChat:跳首页 AI 对话(defensive,DrawerComponent 实际走 onCreateChat)
            Taro.switchTab({ url: '/pages/index/index', fail: () => addNewChat() })
          } else if (item.key === 'company') {
            // 对齐原项目 gotocompany:跳分销页
            Taro.navigateTo({
              url: '/pages/distribution/index',
              fail: () => Taro.showToast({ title: '分销页未配置', icon: 'none' }),
            })
          } else if (item.key === 'freebie') {
            // 对齐原项目 lingqu:复制飞书 wiki 链接到剪贴板
            const feishuUrl = 'https://ihui.feishu.cn/wiki/免费资料'
            Taro.setClipboardData({
              data: feishuUrl,
              success: () =>
                Taro.showToast({ title: '链接已复制,请在浏览器打开', icon: 'none', duration: 2000 }),
              fail: () => Taro.showToast({ title: '复制失败,请重试', icon: 'none' }),
            })
          }
        }}
        onCreateChat={() => {
          setDrawerVisible(false)
          addNewChat()
        }}
        onChatItemClick={(chat) => {
          setDrawerVisible(false)
          // 对齐原项目 handleShowFullList:携带 chatId + title 参数
          Taro.navigateTo({
            url: `/pages/ai/chat?chatId=${chat.id}&title=${encodeURIComponent(chat.title)}`,
            fail: () => Taro.showToast({ title: '对话页未配置', icon: 'none' }),
          })
        }}
      />

      {/* main-container — 对齐原项目结构，no-scroll 样式由 tagWrapShow 控制 */}
      <View
        className={`share-main-container${tagWrapShow ? ' no-scroll' : ''}`}
        style={{ minHeight: '110vh', color: '#333' }}
      >
        {/* FloatBox 浮动组件 — 对齐原项目：放在 main-container 内部 */}
        <FloatBox />

        {/* 共享 NavBar — 使用 variant="ai-home" 模式,传递标题切换回调 */}
        <NavBar
          variant="ai-home"
          title={tt('share.index.title', 'AI资讯')}
          bgColor="#121217"
          activeTitleIndex={activeTitleIndex}
          onActiveNav={activeNav}
          showFenLei
          onFenLeiClick={handleNavClick}
          onMenuClick={handleMenuClick}
        />

        {/* Tabs(对标原 TitleSwitch) */}
        <View className="share-tabs">
          <View
            className={`share-tab${activeTab === 'latest' ? ' active' : ''}`}
            onClick={() => switchTab('latest')}
          >
            <Text>{tt('share.index.tabLatest', '最新')}</Text>
          </View>
          <View
            className={`share-tab${activeTab === 'hot' ? ' active' : ''}`}
            onClick={() => switchTab('hot')}
          >
            <Text>{tt('share.index.tabHot', '热门')}</Text>
          </View>
          <View
            className={`share-tab${activeTab === 'following' ? ' active' : ''}`}
            onClick={() => switchTab('following')}
          >
            <Text>{tt('share.index.tabFollowing', '关注')}</Text>
          </View>
        </View>

        {/* 搜索栏 */}
        <View className="share-search">
          <Input
            className="share-search-input"
            placeholder={tt('news.search', '搜索资讯')}
            value={keyword}
            onInput={(e) => setKeyword(e.detail.value)}
            onConfirm={onSearchConfirm}
          />
        </View>

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
                    idx === 0 || infoList[idx - 1]?.createTime.slice(0, 10) !== n.createTime.slice(0, 10)
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
          ) : (
            !loading ? (
              <View className="share-empty">
                <Text className="share-empty-text">{tt('news.empty', '暂无资讯')}</Text>
              </View>
            ) : null
          )}
          {loading ? (
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

        {/* BackToTop 回到顶部按钮 — 对齐原项目 toodown-wrapper */}
        {showToodown ? (
          <View
            className="share-toodown-wrapper"
            onClick={backToTop}
          >
            <View className="share-toodown">
              <Text className="share-toodown-arrow">↑</Text>
            </View>
          </View>
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
    </View>
  )
}