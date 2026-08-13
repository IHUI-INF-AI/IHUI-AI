import { View, Text, Image } from '@tarojs/components'
import Taro, {
  useDidShow,
  usePullDownRefresh,
  useReachBottom,
  usePageScroll,
  useShareAppMessage,
  useShareTimeline,
} from '@tarojs/taro'
import { useState, useCallback, useRef } from 'react'
import NavBar from '@/components/NavBar'
import Carousel from '@/components/Carousel'
import DrawerComponent from '@/components/DrawerComponent'
import InputArea from '@/components/InputArea'
import TitleSwitchScrollTitle from '@/components/TitleSwitchScrollTitle'
import AgentListPanel from '@/components/AgentListPanel'
import { FloatBox, EmptyState, PayPopup } from '@/components'
import type { PayInfo } from '@/components'
import { chooseImages } from '@/utils/upload-image'
import RecentAgents from './components/RecentAgents'
import MyAgents from './components/MyAgents'
import * as api from '@/api'
import backSvg from '@/assets/remote/images/back.svg'
// 服务弹窗名片+二维码(对齐原项目 Ai-list_b.vue L213-227 mingpian.png + erweima.png)
import mingpianImg from '@/assets/remote/images/mingpian.png'
import erweimaImg from '@/assets/remote/images/erweima.png'
import { rpx } from '@/utils/rpx'
import type { CarouselItem } from '@ihui/types'
import type { TitleSwitchScrollTitleItem } from '@ihui/types'
import type { AgentInfo } from '@/components/AgentListPanel'
import type { DrawerModelGroup, DrawerUserInfo, DrawerChatItem } from '@/components/DrawerComponent'
import './index.css'

/* ============ 类型定义 ============ */

interface AgentItem {
  id: string
  agentName: string
  agentAvatar: string
  agentDescription: string
  agentMainCategory: Array<{ name: string }>
  userNickname: string
  userAvatar: string
  usageCount: number
  isHot: number
  isCollect: number
  isThumbs: number
  likeCount: number
  collectCount: number
  isNew: number
  type: number
}

interface CategoryItem {
  id: string
  name: string
  url: string
  butUrl: string
}

interface RecentAgentItem {
  id: string
  agentName: string
  agentAvatar: string
  desc: string
}

interface MyAgentItem {
  id: string
  agentName: string
  agentAvatar: string
  isNew: number
}

/** 从 unknown 类型的 API 响应中提取数组(兼容数组或 { list: [] } 两种返回结构) */
function extractList(res: unknown): unknown[] {
  if (Array.isArray(res)) return res
  if (typeof res === 'object' && res !== null) {
    const list = (res as { list?: unknown }).list
    if (Array.isArray(list)) return list
  }
  return []
}

/** 数字格式化(对齐原项目 Ai-list_b.vue numResult:>=1w 显示 x.xw,>=1k 显示 x.xk) */
function formatNumber(num: number): string {
  if (num >= 10000) return (num / 10000).toFixed(1) + 'w'
  if (num >= 1000) return (num / 1000).toFixed(1) + 'k'
  return String(num)
}

/* ============ 页面主组件 ============ */

export default function Community() {
  const [banners, setBanners] = useState<CarouselItem[]>([])
  const [recentAgents, setRecentAgents] = useState<RecentAgentItem[]>([])
  const [myAgents, setMyAgents] = useState<MyAgentItem[]>([])
  const [agentList, setAgentList] = useState<AgentItem[]>([])
  const [fullAgentList, setFullAgentList] = useState<AgentItem[]>([])
  const [loading, setLoading] = useState(false)
  const [page, setPage] = useState(1)
  const [hasMore, setHasMore] = useState(true)
  const [searchKeyword, setSearchKeyword] = useState('')
  const [showSearch, setShowSearch] = useState(false)
  const [categories, setCategories] = useState<CategoryItem[]>([
    { id: 'all', name: '全部', url: '', butUrl: '' },
  ])
  const [showCategoryPopup, setShowCategoryPopup] = useState(false)
  const [showDrawer, setShowDrawer] = useState(false)
  // 服务弹窗(二维码名片,对齐原项目 isServicePopupVisible)
  const [showServicePopup, setShowServicePopup] = useState(false)
  // 支付弹窗(对齐原项目 Ai-list_b.vue L264-292 buyThisModel/toPay 流程)
  const [showPayPopup, setShowPayPopup] = useState(false)
  const [payInfo, setPayInfo] = useState<PayInfo | null>(null)
  const purchasingAgentRef = useRef<AgentInfo | null>(null)
  const [showBackTop, setShowBackTop] = useState(false)
  const [fenleiActive, setFenleiActive] = useState<number[]>([0])
  const [drawerGroupedData, setDrawerGroupedData] = useState<DrawerModelGroup[]>([])
  const [drawerUserinfo, setDrawerUserinfo] = useState<DrawerUserInfo>({
    avatar: '',
    nickname: '智汇AI用户',
  })
  const scrollTopRef = useRef(0)

  const PAGE_SIZE = 10

  /* ============ 数据加载 ============ */

  const loadData = useCallback(
    async (reset = false) => {
      if (loading) return
      let curPage = page
      if (reset) {
        curPage = 1
        setHasMore(true)
        setPage(1)
      }
      if (!hasMore && !reset) return
      setLoading(true)
      try {
        const res = await api.getAgentList()
        const rawList = Array.isArray(res?.list) ? res.list : []
        const mappedList: AgentItem[] = rawList.map((a, idx) => ({
          id: a.id || String(idx),
          agentName: a.name || '',
          agentAvatar: a.avatar || '',
          agentDescription: a.desc || '',
          agentMainCategory: [{ name: '全部' }],
          userNickname: '智汇AI',
          userAvatar: '',
          usageCount: a.uses || 0,
          isHot: 0,
          isCollect: 0,
          isThumbs: 0,
          likeCount: 0,
          collectCount: 0,
          isNew: 0,
          type: 1,
        }))
        if (reset) {
          setAgentList(mappedList)
          setFullAgentList(mappedList)
        } else {
          setAgentList((prev) => [...prev, ...mappedList])
          setFullAgentList((prev) => [...prev, ...mappedList])
        }
        setHasMore(curPage * PAGE_SIZE < (res?.total ?? mappedList.length))
        setPage(curPage + 1)
      } catch {
        // API 失败时降级到空列表(不再用 mock)
        if (reset) {
          setAgentList([])
          setFullAgentList([])
        }
      } finally {
        setLoading(false)
      }
    },
    [loading, page, hasMore],
  )

  /** 加载历史对话(对齐原项目 loadHistoryChat) */
  const loadHistoryChat = useCallback(async () => {
    try {
      const res = await api.getChatHistory({ page: 1, pageSize: 20 })
      const rawList = Array.isArray(res?.list) ? res.list : []
      const dateMap = new Map<string, Array<{ id: string | number; title: string; date: string }>>()
      for (const chat of rawList) {
        const dateKey = chat.time ? chat.time.slice(0, 10) : '最近'
        if (!dateMap.has(dateKey)) dateMap.set(dateKey, [])
        dateMap.get(dateKey)!.push({ id: chat.id, title: chat.title, date: chat.time })
      }
      setDrawerGroupedData([
        {
          modelName: '历史对话',
          dateGroups: Array.from(dateMap.entries()).map(([date, chats]) => ({ date, chats })),
        },
      ])
    } catch {
      setDrawerGroupedData([])
    }
  }, [])

  /** 加载首页 Banner */
  const loadBanners = useCallback(async () => {
    try {
      const homeRes = await api.getHomePage()
      if (Array.isArray(homeRes?.banner) && homeRes.banner.length > 0) {
        setBanners(
          homeRes.banner.map((b) => ({
            img: b.coverUrl || '',
            title: b.title,
            link: b.link,
          })),
        )
      } else {
        setBanners([])
      }
    } catch {
      setBanners([])
    }
  }, [])

  /** 加载最近使用智能体 */
  const loadRecentAgents = useCallback(async () => {
    try {
      const historyRes = await api.getAgentUseHistory()
      const rawList = extractList(historyRes) as Array<{
        id: string
        agentName?: string
        agentAvatar?: string
        desc?: string
      }>
      setRecentAgents(
        rawList.map((a) => ({
          id: a.id,
          agentName: a.agentName || '',
          agentAvatar: a.agentAvatar || '',
          desc: a.desc || '',
        })),
      )
    } catch {
      setRecentAgents([])
    }
  }, [])

  /** 加载我的收藏智能体 */
  const loadMyAgents = useCallback(async () => {
    try {
      const collectRes = await api.getAgentCollections()
      const rawList = extractList(collectRes) as Array<{
        id: string
        agentName?: string
        agentAvatar?: string
        isNew?: number
      }>
      setMyAgents(
        rawList.map((a) => ({
          id: a.id,
          agentName: a.agentName || '',
          agentAvatar: a.agentAvatar || '',
          isNew: a.isNew ?? 0,
        })),
      )
    } catch {
      setMyAgents([])
    }
  }, [])

  /** 加载分类列表 */
  const loadCategories = useCallback(async () => {
    try {
      const catRes = await api.getAgentCategories()
      const rawList = extractList(catRes) as Array<{ id?: string; name?: string }>
      const catList: CategoryItem[] = [
        { id: 'all', name: '全部', url: '', butUrl: '' },
        ...rawList.map((c, idx) => ({
          id: c.id || String(idx),
          name: c.name || '',
          url: '',
          butUrl: '',
        })),
      ]
      setCategories(catList)
    } catch {
      // 降级:只保留"全部"
      setCategories([{ id: 'all', name: '全部', url: '', butUrl: '' }])
    }
  }, [])

  useDidShow(() => {
    void loadData(true)
    void loadHistoryChat()
    void loadBanners()
    void loadRecentAgents()
    void loadMyAgents()
    void loadCategories()
    try {
      const userData = Taro.getStorageSync('data') as
        | { avatar?: string; userName?: string; nickname?: string }
        | undefined
      if (userData) {
        setDrawerUserinfo({
          avatar: userData.avatar || '',
          nickname: userData.userName || userData.nickname || '智汇AI用户',
        })
      }
    } catch {
      // 静默
    }
  })

  usePullDownRefresh(() => {
    loadData(true).finally(() => {
      Taro.stopPullDownRefresh()
    })
  })

  useReachBottom(() => {
    loadData()
  })

  usePageScroll((e) => {
    scrollTopRef.current = e.scrollTop
    setShowBackTop(e.scrollTop > 200)
  })

  // 对齐原项目 tools/index.vue onShareAppMessage / onShareTimeline
  useShareAppMessage(() => ({
    title: 'AI 应用商店 - 智汇AI社区',
    path: '/pages/community/index',
    imageUrl: '/static/images/share_zhz.png',
  }))

  useShareTimeline(() => ({
    title: 'AI 应用商店 - 智汇AI社区',
  }))

  /* ============ 事件处理 ============ */

  function onBannerClick(item: CarouselItem) {
    if (item.link) {
      Taro.navigateTo({ url: item.link })
    } else {
      Taro.showToast({ title: '即将上线，敬请期待', icon: 'none' })
    }
  }

  function onSearch(value: string) {
    const keyword = value.replace(/[,.!?;:。，！？；：'"（）【】《》]+/g, '')
    setSearchKeyword(keyword)
    if (!keyword) {
      setAgentList(fullAgentList)
    } else {
      setAgentList(
        fullAgentList.filter(
          (a) =>
            a.agentName.includes(keyword) || a.agentDescription.includes(keyword),
        ),
      )
    }
  }

  function onCategorySelect(catId: string) {
    setShowCategoryPopup(false)
    setPage(1)
    setHasMore(true)
    if (catId === 'all') {
      setAgentList(fullAgentList)
    } else {
      const catName = categories.find((c) => c.id === catId)?.name || ''
      setAgentList(
        fullAgentList.filter((a) => a.agentMainCategory.some((c) => c.name === catName)),
      )
    }
  }

  function backToTop() {
    Taro.pageScrollTo({ scrollTop: 0, duration: 300 })
  }

  function handleMenuClick() {
    setShowDrawer(true)
  }

  function handleFenLeiClick() {
    setShowCategoryPopup(!showCategoryPopup)
  }

  function handleSearchClick() {
    setShowSearch(!showSearch)
  }

  function handleSearchSend(text: string) {
    onSearch(text)
  }

  function handleSearchInput(text: string) {
    setSearchKeyword(text)
  }

  /** 购买月费智能体(对齐原项目 Ai-list_b.vue L264-292 buyThisModel) */
  const handlePurchase = useCallback(async (agent: AgentInfo) => {
    purchasingAgentRef.current = agent
    try {
      const res = (await api.getChargeInfoById(agent.id)) as {
        price?: number
        discountPrice?: number
        duration?: string
        agentName?: string
      } | undefined
      const info: PayInfo = {
        title: res?.agentName || agent.name,
        amount: res?.price ?? 0,
        originalPrice: res?.discountPrice,
        benefits: [`${res?.duration ?? '1个月'}时长`],
        payType: 3, // 月费
        payCrowd: 0,
      }
      setPayInfo(info)
      setShowPayPopup(true)
    } catch {
      Taro.showToast({ title: '获取价格信息失败', icon: 'none' })
    }
  }, [])

  function onAgentListSelect(agent: AgentInfo) {
    Taro.navigateTo({
      url: `/pages/tools/ai_assistant?agentId=${agent.id}&modelNamea=${encodeURIComponent(agent.name)}`,
    })
  }

  /** 收藏智能体 */
  const handleAgentCollect = useCallback(async (id: string) => {
    try {
      await api.collectAgent(id)
      setAgentList((prev) =>
        prev.map((a) =>
          a.id === id
            ? { ...a, isCollect: a.isCollect ? 0 : 1, collectCount: a.collectCount + (a.isCollect ? -1 : 1) }
            : a,
        ),
      )
      Taro.showToast({ title: '已收藏', icon: 'success' })
    } catch {
      Taro.showToast({ title: '操作失败', icon: 'none' })
    }
  }, [])

  /** 点赞智能体 */
  const handleAgentLike = useCallback(async (id: string) => {
    try {
      await api.likeAgent(id)
      setAgentList((prev) =>
        prev.map((a) =>
          a.id === id
            ? { ...a, isThumbs: a.isThumbs ? 0 : 1, likeCount: a.likeCount + (a.isThumbs ? -1 : 1) }
            : a,
        ),
      )
      Taro.showToast({ title: '已点赞', icon: 'success' })
    } catch {
      Taro.showToast({ title: '操作失败', icon: 'none' })
    }
  }, [])

  function onTitleSwitchChange(item: TitleSwitchScrollTitleItem) {
    const matched = categories.find((c) => c.name === item.name)
    if (matched) {
      onCategorySelect(matched.id)
    }
  }

  function handleDrawerGoPage(item: { key: string }) {
    setShowDrawer(false)
    const routeMap: Record<string, string> = {
      appStore: '/pages/index/index',        // 对齐原项目 gopage: 跳首页 AI 对话
      demand: '/pages/ranking/index',        // 对齐原项目 square: 跳需求广场
      inspiration: '/pages/aigc/list',       // 对齐原项目 aigc: 跳 AIGC 创作列表
      dynamic: '/pages/share/index',         // 对齐原项目 share: 跳 AI 资讯
      course: '/pages/course/list',          // 对齐原项目 studyindex: 跳课程
    }
    const url = routeMap[item.key]
    if (url) {
      // appStore 用 switchTab(因为是 tabbar 页),其他用 navigateTo
      if (item.key === 'appStore') {
        Taro.switchTab({ url, fail: () => Taro.navigateTo({ url }) })
      } else {
        Taro.navigateTo({ url, fail: () => Taro.showToast({ title: '页面未配置', icon: 'none' }) })
      }
    }
  }

  function handleDrawerLabelClick(item: { key: string }) {
    setShowDrawer(false)
    if (item.key === 'newChat') {
      // 对齐原项目 addNewChat:跳首页 AI 对话
      Taro.switchTab({ url: '/pages/index/index', fail: () => Taro.navigateTo({ url: '/pages/ai/chat' }) })
    } else if (item.key === 'company') {
      // 对齐原项目 gotocompany:跳分销页
      Taro.navigateTo({ url: '/pages/distribution/index', fail: () => Taro.navigateTo({ url: '/pages/company/index' }) })
    } else if (item.key === 'freebie') {
      // 对齐原项目 lingqu:复制飞书 wiki 链接到剪贴板
      const feishuUrl = 'https://ihui.feishu.cn/wiki/免费资料'
      Taro.setClipboardData({
        data: feishuUrl,
        success: () => Taro.showToast({ title: '链接已复制,请在浏览器打开', icon: 'none', duration: 2000 }),
        fail: () => Taro.showToast({ title: '复制失败,请重试', icon: 'none' }),
      })
    }
  }

  function handleDrawerChatClick(chat: { id: string | number; title: string }) {
    setShowDrawer(false)
    // 对齐原项目 handleShowFullList:携带 chatId + title 参数
    Taro.navigateTo({
      url: `/pages/ai/chat?chatId=${chat.id}&title=${encodeURIComponent(chat.title)}`,
      fail: () => Taro.showToast({ title: '对话页未配置', icon: 'none' }),
    })
  }

  /** 删除历史对话 */
  function handleRemoveChat(chat: DrawerChatItem) {
    Taro.showModal({
      title: '提示',
      content: '确定删除此对话?',
      success: async (res) => {
        if (res.confirm) {
          try {
            await api.removeModelChat(String(chat.id))
            Taro.showToast({ title: '已删除', icon: 'success' })
            void loadHistoryChat()
          } catch {
            Taro.showToast({ title: '删除失败', icon: 'none' })
          }
        }
      },
    })
  }

  function handleFenleiBtnClick(index: number, item: CategoryItem) {
    setFenleiActive([index])
    onCategorySelect(item.id)
  }

  /** 映射分类到 TitleSwitchScrollTitle 格式 */
  const titleSwitchMainList: TitleSwitchScrollTitleItem[] = [
    {
      name: '全部',
      children: categories.map((c) => ({ name: c.name })),
    },
  ]

  // handleAgentCollect / handleAgentLike 暂未被 AgentListPanel 触发(等扩展 onCollect/onLike 回调),
  // 此处 void 引用防止 TS6133 未使用警告,接入后移除
  void handleAgentCollect
  void handleAgentLike
  // formatNumber 暂未接入 AgentListPanel 显示(等扩展 useCount 格式化回调),此处 void 引用防止未使用警告
  void formatNumber

  /** 映射 AgentItem[] 到 AgentInfo[] */
  const agentInfoList: AgentInfo[] = agentList.map((a) => ({
    id: a.id,
    name: a.agentName,
    description: a.agentDescription,
    avatar: a.agentAvatar,
    category: a.agentMainCategory[0]?.name,
    useCount: a.usageCount,
    isVipExclusive: false,
    vipType: a.type === 3 ? 4 : undefined, // type=3 月费(简化映射,对齐原项目 Ai-list_b.vue)
  }))

  return (
    <View
      className="community-out-container"
      style={{
        height: showCategoryPopup ? '100vh' : 'auto',
        overflowY: showCategoryPopup ? 'hidden' : 'auto',
      }}
    >
      {/* DrawerComponent 抽屉 — 对齐原项目放在最外层 */}
      <DrawerComponent
        visible={showDrawer}
        onClose={() => setShowDrawer(false)}
        side="left"
        groupedData={drawerGroupedData}
        userinfo={drawerUserinfo}
        onMenuItemClick={handleDrawerGoPage}
        onLabelItemClick={handleDrawerLabelClick}
        onChatItemClick={handleDrawerChatClick}
        onRemoveChat={handleRemoveChat}
        onCreateChat={() => {
          setShowDrawer(false)
          Taro.navigateTo({ url: '/pages/ai/chat' })
        }}
      />

      <View className="community-main-container" style={{ color: 'white' }}>
        {/* FloatBox 浮动组件 — 对齐原项目放在 main-container 内第一层 */}
        <FloatBox />

        {/* 双层导航栏:第一个 fixed z-index:999(对齐原项目),第二个 opacity:0 占位 */}
        <View style={{ position: 'fixed', left: 0, top: 0, right: 0, zIndex: 999 }}>
          <NavBar
            variant="ai-home"
            title="A I 应用商店"
            showFenLei
            showSearch
            onFenLeiClick={handleFenLeiClick}
            onMenuClick={handleMenuClick}
            onSearchClick={handleSearchClick}
          />
        </View>
        <View style={{ opacity: 0 }}>
          <NavBar
            variant="ai-home"
            title="A I 应用商店"
            showFenLei
            showSearch
            onFenLeiClick={handleFenLeiClick}
            onMenuClick={handleMenuClick}
            onSearchClick={handleSearchClick}
          />
        </View>

        {/* mask — 分类弹层遮罩(对齐原项目) */}
        {showCategoryPopup ? (
          <View className="community-mask" onClick={() => setShowCategoryPopup(false)} />
        ) : null}

        {/* s_t_b — 分类弹层(对齐原项目 tagWrapShow 时的弹层) */}
        {showCategoryPopup ? (
          <View className="community-s-t-b">
            <TitleSwitchScrollTitle
              mainList={titleSwitchMainList}
              mainSwiperMargin="120rpx"
              subSwiperMargin="120rpx"
              onChange={onTitleSwitchChange}
            />
            {/* fenlei_btn_list_overlay — 赛道弹层内的分类主按钮列表(对齐原项目) */}
            <View className="community-fenlei-overlay">
              <View className="community-fenlei-inner">
                {categories.map((item, index) => (
                  <View
                    key={item.id}
                    className={`community-fenlei-btn ${fenleiActive.includes(index) ? 'active' : ''}`}
                    onClick={() => handleFenleiBtnClick(index, item)}
                  >
                    <Image
                      className="fenlei_icon"
                      src={fenleiActive.includes(index) ? item.butUrl : item.url}
                      mode="widthFix"
                    />
                    <Text className="community-fenlei-btn-text">{item.name}</Text>
                  </View>
                ))}
              </View>
            </View>
          </View>
        ) : null}

        {/* 页面内容(对齐原项目 padding: var(--app-top-bar-height) 20rpx 40rpx) */}
        <View
          className="community-content-area"
          style={{ padding: 'var(--app-top-bar-height) 20rpx 40rpx' }}
        >
          {/* 轮播图(对齐原项目 gradient-border + carousel-inner) */}
          <View className="community-carousel-wrapper" style={{ margin: '18rpx 0 0 0' }}>
            <View className="community-carousel-gradient">
              <View className="community-carousel-inner">
                <Carousel
                  items={banners}
                  height={160}
                  autoplay
                  interval={3000}
                  onItemClick={onBannerClick}
                />
              </View>
            </View>
          </View>

          {/* 客服按钮(对齐原项目服务弹窗入口)*/}
          <View
            style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: rpx(10) }}
            onClick={() => setShowServicePopup(true)}
          >
            <Text style={{ fontSize: rpx(24), color: 'var(--color-primary)' }}>联系客服</Text>
          </View>

          {/* InputArea 搜索框(对齐原项目 showSearchBox 条件渲染)+ 语音/图片按钮 */}
          {showSearch ? (
            <View
              className="community-search-area"
              style={{ display: 'flex', flexDirection: 'row', alignItems: 'center', gap: rpx(12) }}
            >
              <View style={{ flex: 1, minWidth: 0 }}>
                <InputArea
                  value={searchKeyword}
                  placeholder="请输入查找的智能体名称"
                  onInput={handleSearchInput}
                  onSend={handleSearchSend}
                  variant="default"
                />
              </View>
              {/* 语音输入按钮(对齐原项目 tools/index.vue L894-1277) */}
              <Text
                style={{ fontSize: rpx(40), padding: rpx(8), flexShrink: 0 }}
                onClick={() => {
                  Taro.showToast({ title: '语音搜索开发中', icon: 'none' })
                  // TODO: 接入 Taro.getRecorderManager + 语音识别 API
                }}
              >
                🎤
              </Text>
              {/* 图片搜索按钮(对齐原项目 handleIconClick L1113-1207) */}
              <Text
                style={{ fontSize: rpx(40), padding: rpx(8), flexShrink: 0 }}
                onClick={async () => {
                  try {
                    await chooseImages(1)
                    // TODO: 上传图片 + 识别内容 + 搜索
                    Taro.showToast({ title: '图片搜索开发中', icon: 'none' })
                  } catch {
                    // 用户取消或失败,静默
                  }
                }}
              >
                📷
              </Text>
            </View>
          ) : null}

          {/* RecentAgents 最近使用(对齐原项目, v-if recentAgents.length > 0) */}
          {recentAgents.length > 0 ? <RecentAgents recentAgents={recentAgents} /> : null}

          {/* MyAgents 我的AI APP(对齐原项目, v-if myAgents.length > 0) */}
          {myAgents.length > 0 ? <MyAgents myAgents={myAgents} /> : null}

          {/* ai-list 智能体列表(对齐原项目 ailist_content) */}
          <View className="community-ailist-content">
            <View className="community-agent-list-header">
              <Text className="community-agent-list-title">智能体推荐</Text>
              <Text
                className="community-agent-list-more"
                onClick={() =>
                  Taro.navigateTo({
                    url: '/pages/category-detail/index',
                    fail: () => Taro.showToast({ title: '分类详情页未配置', icon: 'none' }),
                  })
                }
              >
                查看更多 {'>'}
              </Text>
            </View>
            <AgentListPanel
              visible
              agents={agentInfoList}
              loading={loading}
              onSelect={onAgentListSelect}
              onPurchase={handlePurchase}
            />
            {!loading && agentList.length === 0 ? (
              <EmptyState text="暂无智能体" />
            ) : null}
            {!loading && !hasMore && agentList.length > 0 ? (
              <View className="community-no-more">
                <Text className="community-no-more-text">没有更多了</Text>
              </View>
            ) : null}
          </View>
        </View>

        {/* toodown 返回顶部按钮(对齐原项目, 用 back.svg) */}
        {showBackTop ? (
          <View className="community-toodown-wrapper">
            <View className="community-toodown" onClick={backToTop}>
              <Image src={backSvg} className="community-toodown-img" mode="aspectFit" />
            </View>
          </View>
        ) : null}
      </View>

      {/* 服务弹窗(二维码名片,对齐原项目 Ai-list_b.vue L213-227 isServicePopupVisible) */}
      {showServicePopup ? (
        <View
          className="fixed inset-0 z-[2000] flex items-center justify-center"
          style={{ background: 'rgba(0,0,0,0.6)' }}
          onClick={() => setShowServicePopup(false)}
        >
          <View
            className="relative"
            style={{
              padding: rpx(20),
              borderRadius: rpx(30),
              background: 'var(--color-card)',
              maxWidth: '85%',
            }}
            onClick={(e) => e.stopPropagation()}
          >
            {/* 名片图片(对齐原项目 mingpian.png) */}
            <Image
              src={mingpianImg}
              mode="widthFix"
              style={{ width: '100%', borderRadius: rpx(20), marginBottom: rpx(16) }}
            />
            {/* 二维码图片(对齐原项目 erweima.png) */}
            <Image
              src={erweimaImg}
              mode="widthFix"
              style={{ width: '60%', display: 'block', margin: '0 auto' }}
              showMenuByLongpress
            />
            {/* 关闭按钮 */}
            <View
              className="absolute"
              style={{
                top: rpx(10),
                right: rpx(10),
                width: rpx(60),
                height: rpx(60),
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
              }}
              onClick={() => setShowServicePopup(false)}
            >
              <Text style={{ fontSize: rpx(40), color: 'var(--color-foreground)' }}>×</Text>
            </View>
          </View>
        </View>
      ) : null}

      {/* PayPopup 支付弹窗(对齐原项目 Ai-list_b.vue L264-292) */}
      <PayPopup
        visible={showPayPopup}
        pay={payInfo ?? {}}
        payButtonType="subscription"
        onClose={() => setShowPayPopup(false)}
        onPay={async () => {
          const agent = purchasingAgentRef.current
          if (!agent) return
          try {
            await api.createPayHistory({
              agentId: agent.id,
              amount: payInfo?.amount ?? 0,
            })
            // TODO: 后端返回 payParams 后,改用 payParams + onPaySuccess 触发微信 JSAPI 支付
            Taro.showToast({ title: '支付功能开发中', icon: 'none' })
            setShowPayPopup(false)
          } catch {
            Taro.showToast({ title: '创建订单失败', icon: 'none' })
          }
        }}
      />
    </View>
  )
}
