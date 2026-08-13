import { View, Text, Image } from '@tarojs/components'
import Taro, {
  useDidShow,
  usePullDownRefresh,
  useReachBottom,
  usePageScroll,
} from '@tarojs/taro'
import { useState, useCallback, useRef } from 'react'
import NavBar from '@/components/NavBar'
import Carousel from '@/components/Carousel'
import DrawerComponent from '@/components/DrawerComponent'
import InputArea from '@/components/InputArea'
import TitleSwitchScrollTitle from '@/components/TitleSwitchScrollTitle'
import AgentListPanel from '@/components/AgentListPanel'
import { FloatBox } from '@/components'
import RecentAgents from './components/RecentAgents'
import MyAgents from './components/MyAgents'
import backSvg from '@/assets/remote/images/back.svg'
import type { CarouselItem } from '@ihui/types'
import type { TitleSwitchScrollTitleItem } from '@ihui/types'
import type { AgentInfo } from '@/components/AgentListPanel'
import type { DrawerModelGroup, DrawerUserInfo } from '@/components/DrawerComponent'
import './index.css'

/* ============ Mock 数据 ============ */

const MOCK_BANNERS: CarouselItem[] = [
  { img: '', title: 'AI 智能应用商店', subtitle: '发现最强大的 AI 智能体，提升工作效率' },
  { img: '', title: '智能体市场', subtitle: '上千款 AI 应用等你来体验' },
  { img: '', title: '开发者入驻', subtitle: '上传你的 AI 应用，开启变现之旅' },
  { img: '', title: 'AI 智汇社', subtitle: '让 AI 成为你的超级员工' },
]

const MOCK_RECENT_AGENTS = [
  { id: '1', agentName: 'AI 写作助手', agentAvatar: '', desc: '智能写作与创作' },
  { id: '2', agentName: '数据分析师', agentAvatar: '', desc: '数据可视化分析' },
  { id: '3', agentName: '代码助手', agentAvatar: '', desc: '代码生成与优化' },
  { id: '4', agentName: '设计大师', agentAvatar: '', desc: 'UI/UX 设计辅助' },
  { id: '5', agentName: '翻译官', agentAvatar: '', desc: '多语言翻译' },
]

const MOCK_MY_AGENTS = [
  { id: '101', agentName: '市场分析师', agentAvatar: '', isNew: 1 },
  { id: '102', agentName: '内容创作师', agentAvatar: '', isNew: 0 },
  { id: '103', agentName: '客服机器人', agentAvatar: '', isNew: 0 },
  { id: '104', agentName: '数据报表', agentAvatar: '', isNew: 1 },
]

// TODO: 接入 api.getAgentList 替代 mock,待 API 路由确认后实施
const MOCK_AGENT_LIST = [
  {
    id: '201',
    agentName: '智能客服助手',
    agentAvatar: '',
    agentDescription: '7×24小时智能客服，支持多轮对话、工单自动分配、知识库问答',
    agentMainCategory: [{ name: '客服' }, { name: '效率' }],
    userNickname: '智汇AI',
    userAvatar: '',
    usageCount: 12800,
    isHot: 1,
    isCollect: 0,
    isThumbs: 0,
    likeCount: 342,
    collectCount: 156,
    isNew: 1,
    type: 1,
  },
  {
    id: '202',
    agentName: 'AI 文档处理',
    agentAvatar: '',
    agentDescription: '智能文档解析、摘要生成、格式转换、多语言翻译一体化',
    agentMainCategory: [{ name: '办公' }, { name: '文档' }],
    userNickname: '智汇AI',
    userAvatar: '',
    usageCount: 9600,
    isHot: 1,
    isCollect: 0,
    isThumbs: 0,
    likeCount: 289,
    collectCount: 98,
    isNew: 0,
    type: 1,
  },
  {
    id: '203',
    agentName: '数据分析仪表盘',
    agentAvatar: '',
    agentDescription: '连接数据源，自动生成可视化报表，支持多维度数据钻取',
    agentMainCategory: [{ name: '数据' }, { name: '分析' }],
    userNickname: '智汇AI',
    userAvatar: '',
    usageCount: 7200,
    isHot: 0,
    isCollect: 0,
    isThumbs: 0,
    likeCount: 198,
    collectCount: 67,
    isNew: 1,
    type: 1,
  },
  {
    id: '204',
    agentName: '代码审查助手',
    agentAvatar: '',
    agentDescription: '自动审查代码质量、安全漏洞、性能优化建议',
    agentMainCategory: [{ name: '开发' }, { name: '代码' }],
    userNickname: '智汇AI',
    userAvatar: '',
    usageCount: 5300,
    isHot: 0,
    isCollect: 0,
    isThumbs: 0,
    likeCount: 156,
    collectCount: 45,
    isNew: 0,
    type: 1,
  },
  {
    id: '205',
    agentName: '营销文案生成',
    agentAvatar: '',
    agentDescription: '一键生成营销文案、广告语、社媒帖子、邮件模板',
    agentMainCategory: [{ name: '营销' }, { name: '文案' }],
    userNickname: '智汇AI',
    userAvatar: '',
    usageCount: 15000,
    isHot: 1,
    isCollect: 0,
    isThumbs: 0,
    likeCount: 423,
    collectCount: 189,
    isNew: 0,
    type: 1,
  },
  {
    id: '206',
    agentName: '图片生成大师',
    agentAvatar: '',
    agentDescription: 'AI 文生图、图生图、风格迁移，支持多种艺术风格',
    agentMainCategory: [{ name: '设计' }, { name: '创意' }],
    userNickname: '智汇AI',
    userAvatar: '',
    usageCount: 21000,
    isHot: 1,
    isCollect: 0,
    isThumbs: 0,
    likeCount: 567,
    collectCount: 234,
    isNew: 1,
    type: 1,
  },
  {
    id: '207',
    agentName: '视频剪辑助手',
    agentAvatar: '',
    agentDescription: '智能视频剪辑、字幕生成、特效添加、一键成片',
    agentMainCategory: [{ name: '视频' }, { name: '创作' }],
    userNickname: '智汇AI',
    userAvatar: '',
    usageCount: 8900,
    isHot: 0,
    isCollect: 0,
    isThumbs: 0,
    likeCount: 312,
    collectCount: 123,
    isNew: 0,
    type: 1,
  },
  {
    id: '208',
    agentName: '知识库问答',
    agentAvatar: '',
    agentDescription: '基于企业知识库的智能问答系统，支持 RAG 检索增强生成',
    agentMainCategory: [{ name: '知识' }, { name: '效率' }],
    userNickname: '智汇AI',
    userAvatar: '',
    usageCount: 4300,
    isHot: 0,
    isCollect: 0,
    isThumbs: 0,
    likeCount: 167,
    collectCount: 78,
    isNew: 0,
    type: 1,
  },
]

const MOCK_CATEGORIES = [
  { id: 'all', name: '全部', url: '', butUrl: '' },
  { id: 'hot', name: '热门', url: '', butUrl: '' },
  { id: 'new', name: '最新', url: '', butUrl: '' },
  { id: 'office', name: '办公', url: '', butUrl: '' },
  { id: 'dev', name: '开发', url: '', butUrl: '' },
  { id: 'design', name: '设计', url: '', butUrl: '' },
  { id: 'data', name: '数据', url: '', butUrl: '' },
  { id: 'marketing', name: '营销', url: '', butUrl: '' },
  { id: 'video', name: '视频', url: '', butUrl: '' },
  { id: 'edu', name: '教育', url: '', butUrl: '' },
]

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

/* ============ 页面主组件 ============ */

export default function Community() {
  const [banners] = useState<CarouselItem[]>(MOCK_BANNERS)
  const [recentAgents] = useState(MOCK_RECENT_AGENTS)
  const [myAgents] = useState(MOCK_MY_AGENTS)
  const [agentList, setAgentList] = useState<AgentItem[]>(MOCK_AGENT_LIST)
  const [loading, setLoading] = useState(false)
  const [page, setPage] = useState(1)
  const [hasMore, setHasMore] = useState(true)
  const [searchKeyword, setSearchKeyword] = useState('')
  const [showSearch, setShowSearch] = useState(false)
  const [categories] = useState<CategoryItem[]>(MOCK_CATEGORIES)
  const [activeCategory, setActiveCategory] = useState('all')
  const [showCategoryPopup, setShowCategoryPopup] = useState(false)
  const [showDrawer, setShowDrawer] = useState(false)
  const [showBackTop, setShowBackTop] = useState(false)
  const [fenleiActive, setFenleiActive] = useState<number[]>([0])
  const scrollTopRef = useRef(0)

  const PAGE_SIZE = 10

  /* ============ 抽屉 Mock 数据 ============ */

  const drawerGroupedData: DrawerModelGroup[] = [
    {
      modelName: 'GPT-4o',
      modelLogo: '',
      dateGroups: [
        {
          date: '今天',
          chats: [
            { id: 'c1', title: '帮我写一份市场分析报告', date: '今天' },
            { id: 'c2', title: 'Python 代码优化建议', date: '今天' },
          ],
        },
        {
          date: '昨天',
          chats: [
            { id: 'c3', title: '翻译这段英文文档', date: '昨天' },
          ],
        },
      ],
    },
    {
      modelName: 'Claude 3.5',
      modelLogo: '',
      dateGroups: [
        {
          date: '昨天',
          chats: [
            { id: 'c4', title: '设计一个用户登录流程', date: '昨天' },
            { id: 'c5', title: '数据分析报告生成', date: '昨天' },
          ],
        },
      ],
    },
  ]

  const drawerUserinfo: DrawerUserInfo = {
    avatar: '',
    nickname: '智汇AI用户',
  }

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
        await new Promise((r) => setTimeout(r, 400))
        const filtered = activeCategory === 'all'
          ? MOCK_AGENT_LIST
          : MOCK_AGENT_LIST.filter((a) =>
              a.agentMainCategory.some((c) => c.name === categories.find((cat) => cat.id === activeCategory)?.name),
            )
        if (reset) {
          setAgentList(filtered)
        } else {
          setAgentList((prev) => [...prev, ...filtered])
        }
        setHasMore(curPage * PAGE_SIZE < filtered.length * 2)
        setPage(curPage + 1)
      } catch {
        // 静默处理
      } finally {
        setLoading(false)
      }
    },
    [loading, page, hasMore, activeCategory, categories],
  )

  useDidShow(() => {
    loadData(true)
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
      setAgentList(MOCK_AGENT_LIST)
    } else {
      const filtered = MOCK_AGENT_LIST.filter(
        (a) =>
          a.agentName.includes(keyword) || a.agentDescription.includes(keyword),
      )
      setAgentList(filtered)
    }
  }

  function onCategorySelect(catId: string) {
    setActiveCategory(catId)
    setShowCategoryPopup(false)
    setPage(1)
    setHasMore(true)
    if (catId === 'all') {
      setAgentList(MOCK_AGENT_LIST)
    } else {
      const catName = categories.find((c) => c.id === catId)?.name || ''
      const filtered = MOCK_AGENT_LIST.filter((a) =>
        a.agentMainCategory.some((c) => c.name === catName),
      )
      setAgentList(filtered)
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

  function onAgentListSelect(agent: AgentInfo) {
    Taro.navigateTo({
      url: `/pages/tools/ai_assistant?agentId=${agent.id}&modelNamea=${encodeURIComponent(agent.name)}`,
    })
  }

  /** 收藏智能体 — 对齐原项目 getAgentCollect(待 AgentListPanel 扩展 onCollect 回调后接入) */
  const handleAgentCollect = useCallback(async (id: string) => {
    try {
      // TODO: 接入 api.collectAgent(id) 真实接口
      setAgentList(prev => prev.map(a => a.id === id ? { ...a, isCollect: a.isCollect ? 0 : 1, collectCount: a.collectCount + (a.isCollect ? -1 : 1) } : a))
      Taro.showToast({ title: '已收藏', icon: 'success' })
    } catch {
      Taro.showToast({ title: '操作失败', icon: 'none' })
    }
  }, [])

  /** 点赞智能体 — 对齐原项目 getAgentLike(待 AgentListPanel 扩展 onLike 回调后接入) */
  const handleAgentLike = useCallback(async (id: string) => {
    try {
      // TODO: 接入 api.likeAgent(id) 真实接口
      setAgentList(prev => prev.map(a => a.id === id ? { ...a, isThumbs: a.isThumbs ? 0 : 1, likeCount: a.likeCount + (a.isThumbs ? -1 : 1) } : a))
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

  /** 映射 AgentItem[] 到 AgentInfo[] */
  const agentInfoList: AgentInfo[] = agentList.map((a) => ({
    id: a.id,
    name: a.agentName,
    description: a.agentDescription,
    avatar: a.agentAvatar,
    category: a.agentMainCategory[0]?.name,
    useCount: a.usageCount,
    isVipExclusive: false,
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

          {/* InputArea 搜索框(对齐原项目 showSearchBox 条件渲染) */}
          {showSearch ? (
            <View className="community-search-area">
              <InputArea
                value={searchKeyword}
                placeholder="请输入查找的智能体名称"
                onInput={handleSearchInput}
                onSend={handleSearchSend}
                variant="default"
              />
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
            </View>
            <AgentListPanel
              visible
              agents={agentInfoList}
              loading={loading}
              onSelect={onAgentListSelect}
            />
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
    </View>
  )
}