import { View, Text, Image, Input } from '@tarojs/components'
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
import { Ranking, DrawerComponent, type RankingItem } from '@/components'
import TitleSwitchScrollTitle from '@/components/TitleSwitchScrollTitle'
import type { TitleSwitchScrollTitleItem } from '@ihui/types'
import { useI18n } from '@/i18n'
import { formatDateByTemplate } from '@ihui/shared'
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

interface NavigationBarsProps {
  showFenLei?: boolean
  showMenu?: boolean
  viscosity?: boolean
  onMenuClick?: () => void
  onFenLeiClick?: () => void
  title?: string
  navScrolled?: boolean
  navPaddingTop?: number
  navTotal?: number
}

const PAGE_SIZE = 10

/** 状态栏 + 胶囊按钮高度(对标 NavBar 组件,确保 fixed navbar 不遮挡状态栏) */
const menuButton = Taro.getMenuButtonBoundingClientRect?.() || { top: 26, height: 32 }
const NAV_PADDING_TOP = menuButton.top
const NAV_HEIGHT = menuButton.height + 8
const NAV_TOTAL = NAV_PADDING_TOP + NAV_HEIGHT

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

/** 导航栏组件(对应原项目 navigationBars,props: showFenLei/showMenu/viscosity) */
function NavigationBars({
  showFenLei = true,
  showMenu = true,
  viscosity = true,
  onMenuClick,
  onFenLeiClick,
  title = '',
  navScrolled = false,
  navPaddingTop = NAV_PADDING_TOP,
  navTotal = NAV_TOTAL,
}: NavigationBarsProps) {
  return (
    <View
      className={`share-navbar${viscosity && navScrolled ? ' share-navbar--scrolled' : ''}`}
      style={{
        paddingTop: `${navPaddingTop}px`,
        height: `${navTotal}px`,
      }}
    >
      {showMenu ? (
        <View className="share-navbar-btn" onClick={onMenuClick}>
          <Text className="share-navbar-btn-icon">{'☰'}</Text>
        </View>
      ) : (
        <View className="share-navbar-btn" />
      )}
      <Text className="share-navbar-title">{title}</Text>
      {showFenLei ? (
        <View className="share-navbar-btn" onClick={onFenLeiClick}>
          <Text className="share-navbar-btn-text">
            {'分类'}
          </Text>
        </View>
      ) : (
        <View className="share-navbar-btn" />
      )}
    </View>
  )
}

/** FloatBox 浮动组件 — 简单的浮动层(对应原项目 FloatBox) */
function FloatBox({
  visible,
  onClick,
  icon,
  className = '',
}: {
  visible: boolean
  onClick?: () => void
  icon?: string
  className?: string
}) {
  if (!visible) return null
  return (
    <View className={`share-float-box ${className}`} onClick={onClick}>
      <Text className="share-float-box-icon">{icon || '↑'}</Text>
    </View>
  )
}

export default function ShareIndexPage() {
  const { t } = useI18n()
  const tt = useCallback((k: string, fb: string) => (t(k) === k ? fb : t(k)), [t])

  const [activeNavbar, setActiveNavbar] = useState(false)
  const [drawerVisible, setDrawerVisible] = useState(false)
  const [tagWrapShow, setTagWrapShow] = useState(false)
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
  const [navScrolled, setNavScrolled] = useState(false)

  const pageScrollLocked = drawerVisible || tagWrapShow

  /** 页面滚动锁定/解锁 */
  const lockPageScroll = useCallback(() => {
    Taro.pageScrollTo({ scrollTop: 0, duration: 0 })
  }, [])

  const unlockPageScroll = useCallback(() => {
    // 恢复滚动由关闭 drawer/tagWrap 时自然恢复
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
    setShowToodown(res.scrollTop > 200)
    setNavScrolled(res.scrollTop > 20)
  })

  useShareAppMessage(() => ({
    title: tt('share.index.title', 'AI资讯'),
    path: '/pages/share/index',
  }))

  useShareTimeline(() => ({
    title: tt('share.index.title', 'AI资讯'),
  }))

  const activeNav = useCallback(() => {
    setActiveNavbar(true)
    setTimeout(() => {
      void loadRef.current(true)
      void loadChatHistory()
      void loadModelList()
    }, 0)
  }, [loadChatHistory, loadModelList])

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
      setPage(1)
      setNoMore(false)
      setInfoList([])
      setTimeout(() => void loadRef.current(true), 0)
    },
    [],
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

  /** 打开抽屉时锁定页面滚动 */
  const openDrawer = useCallback(() => {
    setDrawerVisible(true)
    lockPageScroll()
  }, [lockPageScroll])

  /** 关闭抽屉时解锁页面滚动 */
  const handleCloseDrawer = useCallback(() => {
    setDrawerVisible(false)
    unlockPageScroll()
  }, [unlockPageScroll])

  /** 打开分类弹层时锁定页面滚动 */
  const handleOpenTagWrap = useCallback(() => {
    setTagWrapShow(true)
    lockPageScroll()
  }, [lockPageScroll])

  /** 关闭分类弹层时解锁页面滚动 */
  const handleCloseTagWrap = useCallback(() => {
    setTagWrapShow(false)
    unlockPageScroll()
  }, [unlockPageScroll])

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
            <View className="share-rank-enter" onClick={activeNav}>
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

  // ===== 主容器(activeNavbar=true) =====
  return (
    <View className="share-page">
      {/* 自定义导航栏(NavigationBars: showFenLei/showMenu/viscosity 属性) */}
      <NavigationBars
        showFenLei
        showMenu
        viscosity
        title={tt('share.index.title', 'AI资讯')}
        navScrolled={navScrolled}
        navPaddingTop={NAV_PADDING_TOP}
        navTotal={NAV_TOTAL}
        onMenuClick={openDrawer}
        onFenLeiClick={handleOpenTagWrap}
      />

      {/* 占位空间,防止 fixed navbar 遮挡内容 */}
      <View style={{ height: `${NAV_TOTAL}px` }} />

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
          infoList.map((n) => (
            <View key={n.id} className="share-item" onClick={() => goInfoDetail(n.id)}>
              {n.coverUrl ? (
                <Image className="share-item-cover" src={n.coverUrl} mode="aspectFill" />
              ) : null}
              <View className="share-item-body">
                <Text className="share-item-title">{n.title}</Text>
                {n.summary ? <Text className="share-item-summary">{n.summary}</Text> : null}
                <View className="share-item-meta">
                  <View className="share-item-meta-left">
                    {n.categoryName ? (
                      <Text className="share-item-category">{n.categoryName}</Text>
                    ) : null}
                    <Text className="share-item-time">{formatDateByTemplate(n.createTime, 'MM-DD HH:mm')}</Text>
                  </View>
                  <Text className="share-item-views">
                    {t('news.views', { n: n.views || 0 })}
                  </Text>
                </View>
              </View>
            </View>
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

      {/* FloatBox 返回顶部(对标原 toodown) */}
      <FloatBox visible={showToodown} onClick={backToTop} icon="↑" />

      {/* 分类弹层 - TitleSwitchScrollTitle(替换当前内联的分类弹层) */}
      {tagWrapShow ? (
        <View>
          <View className="share-tag-mask" onClick={handleCloseTagWrap} onTouchMove={safePreventTouchMove} />
          <View className="share-tag-panel" onTouchMove={safePreventTouchMove}>
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
        </View>
      ) : null}

      {/* DrawerComponent 侧边栏抽屉(对齐原项目 DrawerComponentall.vue) */}
      <DrawerComponent
        visible={drawerVisible}
        onClose={handleCloseDrawer}
        side="left"
        groupedData={groupedData}
        onMenuItemClick={(item) => {
          setDrawerVisible(false)
          if (item.key === 'appStore') {
            Taro.pageScrollTo({ scrollTop: 0, duration: 300 })
          } else if (item.key === 'demand') {
            Taro.navigateTo({ url: '/pages/ranking/index' })
          } else if (item.key === 'course') {
            Taro.navigateTo({ url: '/pages/course/list' })
          }
        }}
        onLabelItemClick={(item) => {
          setDrawerVisible(false)
          if (item.key === 'newChat') {
            addNewChat()
          }
        }}
        onCreateChat={() => {
          setDrawerVisible(false)
          addNewChat()
        }}
        onChatItemClick={(chat) => {
          setDrawerVisible(false)
          Taro.navigateTo({ url: `/pages/ai/chat?id=${chat.id}` })
        }}
      />

      {/* 页面滚动锁定覆盖层(对标原 pageScrollLocked) */}
      {pageScrollLocked ? <View className="share-scroll-lock" /> : null}
    </View>
  )
}