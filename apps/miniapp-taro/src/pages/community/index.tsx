import { View, Text, Image, ScrollView } from '@tarojs/components'
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
import IntelligentAssistant from '@/components/IntelligentAssistant'
import InputArea from '@/components/InputArea'
import TitleSwitchScrollTitle from '@/components/TitleSwitchScrollTitle'
import AgentListPanel from '@/components/AgentListPanel'
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
  { id: 'all', name: '全部', url: '' },
  { id: 'hot', name: '热门', url: '' },
  { id: 'new', name: '最新', url: '' },
  { id: 'office', name: '办公', url: '' },
  { id: 'dev', name: '开发', url: '' },
  { id: 'design', name: '设计', url: '' },
  { id: 'data', name: '数据', url: '' },
  { id: 'marketing', name: '营销', url: '' },
  { id: 'video', name: '视频', url: '' },
  { id: 'edu', name: '教育', url: '' },
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
}

/* ============ 工具函数 ============ */

function getInitials(name: string): string {
  return name.charAt(0) || '?'
}

/* ============ 组件 ============ */

/** 横向滚动智能体列表（RecentAgents / MyAgents 共用） */
function AgentHorizontalScroll({
  title,
  agents,
  showTeamBtn = false,
  onTeamClick,
  onAgentClick,
}: {
  title: string
  agents: Array<{ id: string; agentName: string; agentAvatar: string }>
  showTeamBtn?: boolean
  onTeamClick?: () => void
  onAgentClick?: (agent: { id: string; agentName: string }) => void
}) {
  if (agents.length === 0) return null
  return (
    <View className="agent-h-scroll-container">
      <View className="agent-h-scroll-header">
        <Text className="agent-h-scroll-title">{title}</Text>
        {showTeamBtn ? (
          <View className="team-button" onClick={onTeamClick}>
            <Text className="team-button-text">我的AI员工</Text>
            <Text className="team-button-arrow">{'>'}</Text>
          </View>
        ) : null}
      </View>
      <ScrollView scrollX className="agent-h-scroll" showScrollbar={false}>
        <View className="agent-h-list">
          {agents.map((agent) => (
            <View
              key={agent.id}
              className="agent-h-item"
              onClick={() => onAgentClick?.(agent)}
            >
              <View className="agent-h-avatar-wrap">
                {agent.agentAvatar ? (
                  <Image
                    className="agent-h-avatar"
                    src={agent.agentAvatar}
                    mode="aspectFill"
                  />
                ) : (
                  <View className="agent-h-avatar-fallback">
                    <Text className="agent-h-avatar-text">{getInitials(agent.agentName)}</Text>
                  </View>
                )}
              </View>
              <Text className="agent-h-name">{agent.agentName}</Text>
            </View>
          ))}
        </View>
      </ScrollView>
    </View>
  )
}

/** FloatBox 浮动组件 */
function FloatBox({
  visible,
  onClose,
}: {
  visible: boolean
  onClose?: () => void
}) {
  if (!visible) return null
  return (
    <View className="community-float-box" onClick={onClose}>
      <View className="community-float-box-content" onClick={(e) => e.stopPropagation()}>
        <Text className="community-float-box-title">AI 助手</Text>
        <Text className="community-float-box-desc">需要帮助？点击这里开启智能对话</Text>
        <View
          className="community-float-box-btn"
          onClick={() => {
            Taro.navigateTo({ url: '/pages/ai/chat' })
          }}
        >
          <Text className="community-float-box-btn-text">开始对话</Text>
        </View>
      </View>
    </View>
  )
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
  const [showFloatBox, setShowFloatBox] = useState(false)
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

  function onAgentClick(agent: { id: string; agentName: string }) {
    Taro.navigateTo({
      url: `/pages/tools/ai_assistant?agentId=${agent.id}&modelNamea=${encodeURIComponent(agent.agentName)}`,
    })
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

  function goToTeam() {
    Taro.navigateTo({ url: '/pages/tools/ai_group/index' })
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

  function handleNavRightClick() {
    setShowSearch(!showSearch)
  }

  function handleSearchSend(text: string) {
    onSearch(text)
  }

  function handleSearchInput(text: string) {
    setSearchKeyword(text)
  }

  function handleIntelligentRecharge() {
    Taro.navigateTo({ url: '/pages/recharge/index' })
  }

  function onAgentListSelect(agent: AgentInfo) {
    Taro.navigateTo({
      url: `/pages/tools/ai_assistant?agentId=${agent.id}&modelNamea=${encodeURIComponent(agent.name)}`,
    })
  }

  function onTitleSwitchChange(item: TitleSwitchScrollTitleItem) {
    const matched = categories.find((c) => c.name === item.name)
    if (matched) {
      onCategorySelect(matched.id)
    }
  }

  function handleDrawerGoPage(item: { key: string }) {
    setShowDrawer(false)
    if (item.key === 'appStore') {
      Taro.pageScrollTo({ scrollTop: 0, duration: 300 })
    } else if (item.key === 'demand') {
      Taro.navigateTo({ url: '/pages/ranking/index' })
    } else if (item.key === 'course') {
      Taro.navigateTo({ url: '/pages/course/list' })
    } else if (item.key === 'inspiration') {
      Taro.showToast({ title: '灵感模块即将上线', icon: 'none' })
    } else if (item.key === 'dynamic') {
      Taro.showToast({ title: '动态模块即将上线', icon: 'none' })
    }
  }

  function handleDrawerLabelClick(item: { key: string }) {
    setShowDrawer(false)
    if (item.key === 'newChat') {
      Taro.navigateTo({ url: '/pages/ai/chat' })
    } else if (item.key === 'company') {
      Taro.navigateTo({ url: '/pages/company/index' })
    } else if (item.key === 'freebie') {
      Taro.showToast({ title: '免费资料领取即将上线', icon: 'none' })
    }
  }

  function handleDrawerChatClick(chat: { id: string | number; title: string }) {
    setShowDrawer(false)
    Taro.navigateTo({ url: `/pages/ai/chat?chatId=${chat.id}` })
  }

  /** 获取当前分类按钮文字 */
  const currentCategoryName = categories.find((c) => c.id === activeCategory)?.name || '全部'

  /** 映射分类到 TitleSwitchScrollTitle 格式 */
  const titleSwitchMainList: TitleSwitchScrollTitleItem[] = [
    {
      name: '全部',
      children: categories.map((c) => ({ name: c.name })),
    },
  ]

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
    <View className="community-page">
      {/* 导航栏 */}
      <NavBar
        title="AI应用商店"
        showBack={false}
        variant="default"
        rightText={showSearch ? '取消' : '搜索'}
        onRightClick={handleNavRightClick}
      />

      {/* 搜索框 — 使用 InputArea 组件 */}
      {showSearch ? (
        <View className="community-search-bar">
          <InputArea
            value={searchKeyword}
            placeholder="请输入查找的智能体名称"
            onInput={handleSearchInput}
            onSend={handleSearchSend}
            variant="default"
          />
        </View>
      ) : null}

      <View className="community-content">
        {/* 智能助手组件 */}
        <IntelligentAssistant
          tokenBalance={1280}
          isLoggedIn={false}
          onRecharge={handleIntelligentRecharge}
        />

        {/* 分类筛选 + 菜单按钮 + FloatBox 触发 */}
        <View className="community-toolbar">
          <View className="community-toolbar-left">
            <View className="community-menu-btn" onClick={handleMenuClick}>
              <Text className="community-menu-icon">☰</Text>
            </View>
            <View className="community-category-btn" onClick={handleFenLeiClick}>
              <Text className="community-category-text">{currentCategoryName}</Text>
              <Text className={`community-category-arrow ${showCategoryPopup ? 'rotated' : ''}`}>▾</Text>
            </View>
          </View>
          <View
            className="community-float-trigger"
            onClick={() => setShowFloatBox(!showFloatBox)}
          >
            <Text className="community-float-trigger-icon">✦</Text>
          </View>
        </View>

        {/* 分类弹层 — 使用 TitleSwitchScrollTitle 组件 */}
        {showCategoryPopup ? (
          <View className="community-category-overlay">
            <View className="community-category-mask" onClick={() => setShowCategoryPopup(false)} />
            <View className="community-category-popup">
              <TitleSwitchScrollTitle
                mainList={titleSwitchMainList}
                mainSwiperMargin="120rpx"
                subSwiperMargin="120rpx"
                onChange={onTitleSwitchChange}
              />
            </View>
          </View>
        ) : null}

        {/* 轮播图 */}
        <View className="community-carousel-wrap">
          <View className="community-carousel-gradient-border">
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

        {/* 最近使用 */}
        <AgentHorizontalScroll
          title="最近使用"
          agents={recentAgents}
          onAgentClick={onAgentClick}
        />

        {/* 我的智能体 */}
        <AgentHorizontalScroll
          title="我的AI APP"
          agents={myAgents}
          showTeamBtn
          onTeamClick={goToTeam}
          onAgentClick={onAgentClick}
        />

        {/* 智能体列表 — 使用 AgentListPanel 组件 */}
        <View className="community-agent-list-section">
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

      {/* FloatBox 浮动组件 */}
      <FloatBox
        visible={showFloatBox}
        onClose={() => setShowFloatBox(false)}
      />

      {/* 返回顶部按钮 */}
      {showBackTop ? (
        <View className="community-back-top" onClick={backToTop}>
          <Text className="community-back-top-icon">↑</Text>
        </View>
      ) : null}

      {/* 抽屉组件 — 增强版，传入 groupedData/userinfo 等 props */}
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
    </View>
  )
}