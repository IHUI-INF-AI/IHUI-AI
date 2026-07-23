import { View, Text, Image, ScrollView, Input } from '@tarojs/components'
import Taro, {
  useDidShow,
  usePullDownRefresh,
  useReachBottom,
  useShareAppMessage,
  usePageScroll,
} from '@tarojs/taro'
import { useState, useCallback, useEffect, useRef } from 'react'
import * as api from '@/api'
import { Ranking, type RankingItem } from '@/components'
import { useI18n } from '@/i18n'
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
}

interface CategoryItem {
  id: string | number
  name: string
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
  }
}

function formatDate(iso: string): string {
  if (!iso) return ''
  try {
    const ts = new Date(iso).getTime()
    if (!ts) return iso
    return new Intl.DateTimeFormat('zh-CN', {
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
    }).format(ts)
  } catch {
    return iso
  }
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

  const pageScrollLocked = drawerVisible || tagWrapShow

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
          return { id: (raw['id'] ?? '') as string | number, name: asString(raw['name']) }
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
    setShowToodown(res.scrollTop > 400)
  })

  useShareAppMessage(() => ({
    title: tt('share.index.title', 'AI资讯'),
    path: '/pages/share/index',
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

  const goHome = useCallback(() => {
    Taro.switchTab({ url: '/pages/index/index' })
  }, [])

  const removeChat = useCallback(
    (id: string) => {
      Taro.showModal({
        title: tt('common.hint', '提示'),
        content: tt('share.index.removeConfirm', '确认删除此对话?'),
        confirmText: tt('common.confirm', '确认'),
        cancelText: tt('common.cancel', '取消'),
        success: async (res) => {
          if (!res.confirm) return
          try {
            await api.removeModelChat(id)
            setChatHistory((prev) => prev.filter((c) => c.id !== id))
            Taro.showToast({ title: tt('common.success', '已删除'), icon: 'none' })
          } catch {
            // ignore
          }
        },
      })
    },
    [tt],
  )

  const safePreventTouchMove = useCallback((e: { stopPropagation: () => void }) => {
    e.stopPropagation()
  }, [])

  // ===== 排行榜入口视图(activeNavbar=false) =====
  if (!activeNavbar) {
    return (
      <View className="share-page">
        <View className="share-rank-wrap">
          <View className="share-rank-header">
            <Text className="share-rank-title">{tt('share.index.title', 'AI资讯')}</Text>
            <View className="share-rank-enter" onClick={activeNav}>
              <Text>{tt('share.index.enter', '进入资讯')}</Text>
            </View>
          </View>
          <Ranking
            list={rankList}
            title={tt('share.index.hotRank', '热门排行')}
            unit={tt('ranking.unitCreation', '分')}
            loading={rankList.length === 0}
          />
        </View>
      </View>
    )
  }

  // ===== 主容器(activeNavbar=true) =====
  return (
    <View className="share-page">
      {/* 自定义导航栏:菜单(左) + 标题(中) + 分类(右) */}
      <View
        className="share-navbar"
        style={{
          paddingTop: `${NAV_PADDING_TOP}px`,
          height: `${NAV_TOTAL}px`,
        }}
      >
        <View className="share-navbar-btn" onClick={() => setDrawerVisible(true)}>
          <Text>{'☰'}</Text>
        </View>
        <Text className="share-navbar-title">{tt('share.index.title', 'AI资讯')}</Text>
        <View
          className="share-navbar-btn"
          onClick={() => setTagWrapShow((v) => !v)}
        >
          <Text className="share-navbar-btn-text">
            {tt('share.index.category', '分类')}
          </Text>
        </View>
      </View>

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
                  <Text className="share-item-time">{formatDate(n.createTime)}</Text>
                  <Text className="share-item-views">
                    {tt('news.views', '{{n}} 次浏览').replace('{{n}}', String(n.views || 0))}
                  </Text>
                </View>
              </View>
            </View>
          ))
        ) : (
          !loading ? (
            <View className="share-empty">
              <Text>{tt('news.empty', '暂无资讯')}</Text>
            </View>
          ) : null
        )}
        {loading ? (
          <View className="share-loading">
            <Text>{tt('common.loading', '加载中…')}</Text>
          </View>
        ) : null}
        {!loading && infoList.length && noMore ? (
          <View className="share-nomore">
            <Text>{tt('common.noMore', '没有更多了')}</Text>
          </View>
        ) : null}
      </View>

      {/* 浮动入口(float-box 简化) */}
      <View className="share-float">
        <View className="share-float-btn" onClick={() => setTagWrapShow(true)}>
          <Text>{'≡'}</Text>
        </View>
      </View>

      {/* 返回顶部(对标原 toodown) */}
      {showToodown ? (
        <View className="share-to-top" onClick={backToTop}>
          <Text>{'↑'}</Text>
        </View>
      ) : null}

      {/* 分类弹层(对标原 tagWrapShow) */}
      {tagWrapShow ? (
        <View>
          <View className="share-tag-mask" onClick={() => setTagWrapShow(false)} onTouchMove={safePreventTouchMove} />
          <View className="share-tag-panel" onTouchMove={safePreventTouchMove}>
            <View
              className={`share-tag-item${activeCategory === '' ? ' active' : ''}`}
              onClick={() => selectCategory({ id: '', name: '' })}
            >
              <Text>{tt('common.all', '全部')}</Text>
            </View>
            {categories.map((cat) => (
              <View
                key={cat.id}
                className={`share-tag-item${activeCategory === cat.id ? ' active' : ''}`}
                onClick={() => selectCategory(cat)}
              >
                <Text>{cat.name}</Text>
              </View>
            ))}
          </View>
        </View>
      ) : null}

      {/* 侧边栏(对标原 DrawerComponent,简化抽屉) */}
      {drawerVisible ? (
        <View>
          <View className="share-drawer-mask" onClick={() => setDrawerVisible(false)} />
          <View className={`share-drawer${drawerVisible ? ' open' : ''}`}>
            <View className="share-drawer-header">
              <Text className="share-drawer-title">
                {tt('share.index.drawerTitle', '我的对话')}
              </Text>
              <Text className="share-drawer-close" onClick={() => setDrawerVisible(false)}>
                {'×'}
              </Text>
            </View>
            <View className="share-drawer-actions">
              <View className="share-drawer-btn" onClick={addNewChat}>
                <Text>{tt('share.index.newChat', '新建对话')}</Text>
              </View>
              <View className="share-drawer-btn secondary" onClick={goHome}>
                <Text>{tt('share.index.goHome', '返回首页')}</Text>
              </View>
            </View>
            <Text className="share-drawer-section-title">
              {tt('share.index.history', '历史对话')}
            </Text>
            <ScrollView scrollY className="share-drawer-list">
              {chatHistory.length ? (
                chatHistory.map((h) => (
                  <View key={h.id} className="share-drawer-item" onClick={() => removeChat(h.id)}>
                    <Text className="share-drawer-item-title">{h.title || h.id}</Text>
                    {h.time ? (
                      <Text className="share-drawer-item-time">{formatDate(h.time)}</Text>
                    ) : null}
                  </View>
                ))
              ) : (
                <View className="share-drawer-empty">
                  <Text>{tt('share.index.emptyHistory', '暂无历史对话')}</Text>
                </View>
              )}
            </ScrollView>
            {modelList.length ? (
              <View>
                <Text className="share-drawer-section-title">
                  {tt('share.index.models', '模型列表')}
                </Text>
                <View className="share-drawer-list">
                  {modelList.slice(0, 6).map((m) => (
                    <View key={m.id} className="share-drawer-item">
                      <Text className="share-drawer-item-title">{m.name || m.id}</Text>
                    </View>
                  ))}
                </View>
              </View>
            ) : null}
          </View>
        </View>
      ) : null}

      {/* 页面滚动锁定覆盖层(对标原 pageScrollLocked) */}
      {pageScrollLocked ? <View className="share-scroll-lock" /> : null}
    </View>
  )
}
