// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

import { aizhsUrl } from '@/constants/icon-urls'
import { TAB_BAR_OCCUPIED_PX, TAB_BAR_PAGE_RESERVE_CSS } from '@/constants/tab-bar-metrics'
import ScrollJumpButton, { pxToTaroRpx, scrollJumpInsetRpx } from '@/components/ScrollJumpButton'
import { useTt, t } from '@/i18n'
import { View, Text, Image, Input } from '@tarojs/components'
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
import TitleSwitchScrollTitle from '@/components/TitleSwitchScrollTitle'
import ThemeRoot from '@/components/ThemeRoot'
import { getUserInfo } from '@/utils/auth'
import { FloatBox, EmptyState, PayPopup } from '@/components'
import type { PayInfo } from '@/components'
import { requestPayment } from '@/platform/pay'
import { getTopBarMetrics } from '@/utils/system-info'
import { WEB_BASE_URL } from '@/constants/web-portal'
import LineIcon from '@/components/LineIcon'
import RecentAgents from './components/RecentAgents'
import MyAgents from './components/MyAgents'
import * as api from '@/api'
import { useAuthReadyGate } from '@/hooks/use-auth-ready-gate'
// 服务弹窗名片+二维码(对齐原项目 Ai-list_b.vue L213-227 mingpian.png + erweima.png)
const mingpianImg = aizhsUrl('remote-images/mingpian.png')
const erweimaImg = aizhsUrl('remote-images/erweima.png')
import { rpx, px } from '@/utils/rpx'
import type { CarouselItem } from '@ihui/types'
import type { TitleSwitchScrollTitleItem } from '@ihui/types'
import { rnRadius, taroType } from '@ihui/design-tokens'
import type { AgentInfo } from '@/components/AgentListPanel'
import type { DrawerModelGroup, DrawerUserInfo, DrawerChatItem } from '@/components/DrawerComponent'
import './index.css'
import { onToast } from '@/host/on-toast'
import { openDrawerLabel, openDrawerMenu } from '@/utils/drawer-actions'

/**
 * 分类接口的 icon 是语义图标名(code/edit/image/book/megaphone),不是图片 URL。
 * web/RN 旧实现曾把它当图源,渲染出 16px 空白占位;三端现统一只渲染文字胶囊。
 */

/**
 * 后端静态素材字段(agents.avatar / banner.coverUrl)返回站内相对路径,
 * 小程序 <Image> 不会按页面 origin 解析,必须拼到 Web 站点底座;绝对 URL 原样透传。
 * 与 RN 端 resolveWebAssetUrl 同一口径(静态资源由站点根直出,不是 /api)。
 */
function resolveCommunityAssetUrl(raw?: string | null): string {
  const path = raw?.trim()
  if (!path) return ''
  if (/^(https?:|data:|wxfile:)/i.test(path)) return path
  return `${WEB_BASE_URL.replace(/\/+$/, '')}/${path.replace(/^\/+/, '')}`
}

/* ============ 类型定义 ============ */

interface AgentItem {
  id: string
  agentName: string
  agentAvatar: string
  agentDescription: string
  agentCover?: string
  /** 后端分类主键;分类胶囊按它本地筛选(此前按分类名筛,但列表映射把分类名全写成了“全部” ⇒ 一点分类就空) */
  categoryId?: string
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
  const tt = useTt()
  const [banners, setBanners] = useState<CarouselItem[]>([])
  const [recentAgents, setRecentAgents] = useState<RecentAgentItem[]>([])
  const [myAgents, setMyAgents] = useState<MyAgentItem[]>([])
  const [agentList, setAgentList] = useState<AgentItem[]>([])
  const [fullAgentList, setFullAgentList] = useState<AgentItem[]>([])
  // 首帧就当"加载中":初值 false 会让第一帧先画一次「暂无智能体」,接口回来才换成列表(闪空态)
  const [loading, setLoading] = useState(true)
  // 接口失败要能区分于"真的没有智能体",否则本页会永久停在空态且没有重试出口
  const [loadError, setLoadError] = useState(false)
  // 并发去重改用 ref:state 做闸门时,loading 初值 true 会把首屏那次 loadData 直接吞掉
  const loadingRef = useRef(false)
  const [page, setPage] = useState(1)
  const [hasMore, setHasMore] = useState(true)
  const [searchKeyword, setSearchKeyword] = useState('')
  const [showSearch, setShowSearch] = useState(true)
  const [categories, setCategories] = useState<CategoryItem[]>([])
  const [showCategoryPopup, setShowCategoryPopup] = useState(false)
  const [showDrawer, setShowDrawer] = useState(false)
  // 服务弹窗(二维码名片,对齐原项目 isServicePopupVisible)
  const [showServicePopup, setShowServicePopup] = useState(false)
  // 支付弹窗(对齐原项目 Ai-list_b.vue L264-292 buyThisModel/toPay 流程)
  const [showPayPopup, setShowPayPopup] = useState(false)
  const [payInfo, setPayInfo] = useState<PayInfo | null>(null)
  const purchasingAgentRef = useRef<AgentInfo | null>(null)
  const [showBackTop, setShowBackTop] = useState(false)
  const [fenleiActive, setFenleiActive] = useState<number[]>([])
  const [drawerGroupedData, setDrawerGroupedData] = useState<DrawerModelGroup[]>([])
  const [drawerUserinfo, setDrawerUserinfo] = useState<DrawerUserInfo>({
    avatar: '',
    nickname: tt('community.text1', '智汇AI用户'),
  })
  const scrollTopRef = useRef(0)

  const PAGE_SIZE = 10

  // 顶部固定导航占位高度(= 状态栏 + 导航栏,与 NavBar ai-home 算法一致),注入给
  // --app-top-bar-height 供内容 padding 与 s_t_b 弹层 top 定位使用(原 web 静态变量迁移)
  const { menuButton } = getTopBarMetrics()
  const appTopBarHeight = px(menuButton.top + menuButton.height + 8)

  /* ============ 数据加载 ============ */

  const loadData = useCallback(
    async (reset = false) => {
      if (loadingRef.current) return
      let curPage = page
      if (reset) {
        curPage = 1
        setHasMore(true)
        setPage(1)
      }
      if (!hasMore && !reset) return
      loadingRef.current = true
      setLoading(true)
      try {
        const res = await api.getAgentList()
        const rawList = Array.isArray(res?.list) ? res.list : []
        const mappedList: AgentItem[] = rawList.map((a, idx) => ({
          id: a.id || String(idx),
          agentName: a.name || '',
          agentAvatar: a.avatar || '',
          agentCover: a.cover || '',
          categoryId: a.categoryId || '',
          agentDescription: a.desc || '',
          agentMainCategory: [{ name: tt('common.all', '全部') }],
          userNickname: tt('community.text2', '智汇AI'),
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
        // 取到了就清错误:重试成功后不能继续挂着上一次的错误面
        setLoadError(false)
        if (reset) {
          const firstPage = mappedList.slice(0, PAGE_SIZE)
          setAgentList(firstPage)
          setFullAgentList(mappedList)
          setHasMore(firstPage.length < mappedList.length)
          setPage(2)
        } else {
          // 源接口 `getAgentList` 一次返回全量(它的 pageSize=200),分页在本端按窗口切:
          // 此前这里把同一批全量反复 append ⇒ 滚到底会把同一批智能体成倍重复挂上去。
          const nextCount = Math.min(curPage * PAGE_SIZE, mappedList.length)
          setAgentList(mappedList.slice(0, nextCount))
          setFullAgentList(mappedList)
          setHasMore(nextCount < mappedList.length)
          setPage(curPage + 1)
        }
      } catch {
        // API 失败时不再用 mock,但也不能只清空列表:空列表看起来就是"本来没有智能体"
        setLoadError(true)
        if (reset) {
          setAgentList([])
          setFullAgentList([])
        }
      } finally {
        loadingRef.current = false
        setLoading(false)
      }
    },
    [page, hasMore, tt],
  )

  /** 加载历史对话(对齐原项目 loadHistoryChat) */
  const loadHistoryChat = useCallback(async () => {
    try {
      const res = await api.getChatHistory({ page: 1, pageSize: 20 })
      const rawList = Array.isArray(res?.list) ? res.list : []
      const dateMap = new Map<string, Array<{ id: string | number; title: string; date: string }>>()
      for (const chat of rawList) {
        const dateKey = chat.time ? chat.time.slice(0, 10) : tt('ai.agentList.tabRecent', '最近')
        if (!dateMap.has(dateKey)) dateMap.set(dateKey, [])
        dateMap.get(dateKey)!.push({ id: chat.id, title: chat.title, date: chat.time })
      }
      setDrawerGroupedData([
        {
          modelName: tt('share.index.history', '历史对话'),
          dateGroups: Array.from(dateMap.entries()).map(([date, chats]) => ({ date, chats })),
        },
      ])
    } catch {
      setDrawerGroupedData([])
    }
  }, [tt])

  /** 加载首页 Banner */
  const loadBanners = useCallback(async () => {
    try {
      const homeRes = await api.getHomePage()
      if (Array.isArray(homeRes?.banner) && homeRes.banner.length > 0) {
        setBanners(
          homeRes.banner.map((b) => ({
            // /content/home 的 banner 字段是 imageUrl(web 同源读取),coverUrl 只在
            // 另一条列表接口出现。此前只读 coverUrl ⇒ 小程序 banner 永远无图,
            // 只剩一块灰底 + 文案;这里按 web 的优先级补齐三种字段。
            img: resolveCommunityAssetUrl(
              (b as typeof b & { imageUrl?: string; image?: string; cover?: string }).coverUrl ||
                (b as typeof b & { imageUrl?: string }).imageUrl ||
                (b as typeof b & { image?: string }).image ||
                (b as typeof b & { cover?: string }).cover,
            ),
            title: b.title,
            // Banner API 的副标题字段在类型里缺席、运行时存在(web 端同源读取 description);
            // 不补这一行,小程序 banner 就永远比 web 少一行文案层级。
            subtitle: (b as typeof b & { description?: string }).description || '',
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

  /** 加载我拥有的智能体(GET /agents/my,按当前账号过滤;区别于「我的收藏」) */
  const loadMyAgents = useCallback(async () => {
    try {
      const mineRes = await api.get<{
        list?: Array<{ agentId: string; name?: string; avatar?: string }>
      }>('/agents/my', { page: 1, pageSize: 6 })
      const rawList = extractList(mineRes) as Array<{
        agentId: string
        name?: string
        avatar?: string
      }>
      setMyAgents(
        rawList.map((a) => ({
          id: a.agentId,
          agentName: a.name || '',
          agentAvatar: a.avatar || '',
          isNew: 0,
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
      // 分类行的真实主键是 `categoryId`(`id` 在本接口返回 null);智能体行也带
      // `categoryId`,两侧必须同源,否则分类胶囊选中后按 UUID 比不到任何智能体(空列表)。
      const rawList = extractList(catRes) as Array<{
        id?: string | null
        categoryId?: string | null
        name?: string
      }>
      const catList: CategoryItem[] = rawList.map((c, idx) => ({
        id: c.categoryId || c.id || String(idx),
        name: c.name || '',
        url: '',
        butUrl: '',
      }))
      setCategories(catList)
    } catch {
      // 降级:分类为空,页面隐藏分类区块(不再合成一个与 web 不一致的「全部」胶囊)
      setCategories([])
    }
  }, [])

  // G-933 冷启动门控：下面三支是个性化数据 —— loadHistoryChat → GET /api/ai/history
  // (ai-user-model-chat.ts:448 处理器用 request.userId!，插件级 preHandler :246，前缀 /api/ai
  // 见 routes/index.ts:828)、loadRecentAgents → GET /agents/use-history 与 loadMyAgents →
  // GET /agents/my(均为鉴权端点,处理器内 checkAuth 未过即 return)，
  // 均需鉴权。而 loadData/loadBanners/loadCategories 是公开内容流，**必须照发** —— 本页是 tab 首屏，
  // 整块挡会让游客白屏，所以只把这三支延后到判定落定。
  const { waitUntilReady } = useAuthReadyGate()
  useDidShow(() => {
    void loadData(true)
    void loadBanners()
    void loadCategories()
    waitUntilReady(() => {
      void loadHistoryChat()
      void loadRecentAgents()
      void loadMyAgents()
    })
    try {
      const userData = getUserInfo()
      if (userData) {
        setDrawerUserinfo({
          avatar: userData.avatar || '',
          nickname: userData.userName || userData.nickname || tt('community.text1', '智汇AI用户'),
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
    title: tt('community.text3', 'AI 应用商店 - 智汇AI社区'),
    path: '/pages/community/index',
    imageUrl: aizhsUrl('remote-images/share_zhz.png'),
  }))

  useShareTimeline(() => ({
    title: tt('community.text3', 'AI 应用商店 - 智汇AI社区'),
  }))

  /* ============ 事件处理 ============ */

  function onBannerClick(item: CarouselItem) {
    if (item.link) {
      Taro.navigateTo({ url: item.link })
    } else {
      onToast(tt('community.text5', '即将上线，敬请期待'), { kind: 'info' })
    }
  }

  /**
   * 关键词 + 分类组合筛选的唯一入口。
   *
   * 旧实现两处各筛各的：提交搜索只认关键词、点分类只认分类，先搜后点分类会把
   * 搜索词丢掉，反之亦然；web/RN 都是一次查询同时带 keyword + categoryId。
   * 全量列表已在内存（getAgentList 一次 pageSize=200），这里按同一条件组合过滤。
   * 有任一筛选时一次展示全部命中项并关闭分页，避免 loadMore 把未筛选项追加回来。
   */
  function applyListFilters(keyword: string, categoryId: string | null) {
    const kw = keyword.trim()
    const filtered = fullAgentList.filter(
      (a) =>
        (!categoryId || a.categoryId === categoryId) &&
        (!kw || a.agentName.includes(kw) || a.agentDescription.includes(kw)),
    )
    const hasFilter = !!categoryId || !!kw
    setPage(1)
    setAgentList(hasFilter ? filtered : filtered.slice(0, PAGE_SIZE))
    setHasMore(!hasFilter && filtered.length > PAGE_SIZE)
  }

  function onSearch(value: string) {
    const keyword = value.replace(/[,.!?;:。，！？；：'"（）【】《》]+/g, '')
    setSearchKeyword(keyword)
    const activeIndex = fenleiActive[0]
    const activeCategoryId =
      activeIndex === undefined ? null : (categories[activeIndex]?.id ?? null)
    applyListFilters(keyword, activeCategoryId)
  }

  function onCategorySelect(catId: string) {
    setShowCategoryPopup(false)
    const categoryId = catId === 'all' ? null : catId
    const index = categoryId ? categories.findIndex((c) => c.id === categoryId) : -1
    // 分类胶囊/弹层/搜索组合态共用这一份选中真相，避免两个入口各自维护 active。
    setFenleiActive(index >= 0 ? [index] : [])
    applyListFilters(searchKeyword, categoryId)
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
  const handlePurchase = useCallback(
    async (agent: AgentInfo) => {
      purchasingAgentRef.current = agent
      try {
        const res = (await api.getChargeInfoById(agent.id)) as
          | {
              price?: number
              discountPrice?: number
              duration?: string
              agentName?: string
            }
          | undefined
        const info: PayInfo = {
          title: res?.agentName || agent.name,
          amount: res?.price ?? 0,
          originalPrice: res?.discountPrice,
          benefits: [t('community.y1', { p1: res?.duration ?? '1个月' })],
          payType: 3, // 月费
          payCrowd: 0,
        }
        setPayInfo(info)
        setShowPayPopup(true)
      } catch {
        onToast(tt('community.failed6', '获取价格信息失败'), { kind: 'error' })
      }
    },
    [tt],
  )

  function onAgentListSelect(agent: AgentInfo) {
    // XUI-018:/pages/tools/ai_assistant 已删除,现行在册路径为 pkg-ai 分包。
    Taro.navigateTo({
      url: `/pkg-ai/ai-assistant/index?agentId=${agent.id}&modelNamea=${encodeURIComponent(agent.name)}`,
    })
  }

  /** 收藏智能体 */
  const handleAgentCollect = useCallback(
    async (id: string) => {
      try {
        await api.collectAgent(id)
        setAgentList((prev) =>
          prev.map((a) =>
            a.id === id
              ? {
                  ...a,
                  isCollect: a.isCollect ? 0 : 1,
                  collectCount: a.collectCount + (a.isCollect ? -1 : 1),
                }
              : a,
          ),
        )
        onToast(tt('ai.agentDetail.favorited', '已收藏'), { kind: 'success' })
      } catch {
        onToast(tt('setting.operationFailed', '操作失败'), { kind: 'error' })
      }
    },
    [tt],
  )

  /** 点赞智能体 */
  const handleAgentLike = useCallback(
    async (id: string) => {
      try {
        await api.likeAgent(id)
        setAgentList((prev) =>
          prev.map((a) =>
            a.id === id
              ? {
                  ...a,
                  isThumbs: a.isThumbs ? 0 : 1,
                  likeCount: a.likeCount + (a.isThumbs ? -1 : 1),
                }
              : a,
          ),
        )
        onToast(tt('community.like7', '已点赞'), { kind: 'success' })
      } catch {
        onToast(tt('setting.operationFailed', '操作失败'), { kind: 'error' })
      }
    },
    [tt],
  )

  function onTitleSwitchChange(item: TitleSwitchScrollTitleItem) {
    const matched = categories.find((c) => c.name === item.name)
    if (matched) {
      onCategorySelect(matched.id)
    }
  }

  function handleDrawerGoPage(item: { key: string }) {
    setShowDrawer(false)
    // key→路由的单一源在 utils/drawer-nav:此前本页与「我的」页各抄一份,漂移出 5 个死路由
    openDrawerMenu(item.key, tt)
  }

  function handleDrawerLabelClick(item: { key: string }) {
    setShowDrawer(false)
    if (item.key === 'newChat') {
      // 对齐原项目 addNewChat:跳首页 AI 对话。/pages/index/index 不是 tabBar 页,
      // 原来先 switchTab 必然失败(再走 fallback 等于多打一发必败调用),直接 navigateTo
      Taro.navigateTo({
        url: '/pages/index/index',
        fail: () =>
          Taro.navigateTo({
            url: '/pkg-ai/ai/chat',
            fail: () => onToast(tt('community.text8', '页面未配置'), { kind: 'error' }),
          }),
      })
    } else if (item.key === 'company' || item.key === 'freebie') {
      // 公司入口与领取资料同走 utils/drawer-actions(带 fail 反馈,不再各处抄一份跳转)
      openDrawerLabel(item.key, tt)
    }
  }

  function handleDrawerChatClick(chat: { id: string | number; title: string }) {
    setShowDrawer(false)
    // 对齐原项目 handleShowFullList:携带 chatId + title 参数
    Taro.navigateTo({
      url: `/pkg-ai/ai/chat?chatId=${chat.id}&title=${encodeURIComponent(chat.title)}`,
      fail: () => onToast(tt('community.text11', '对话页未配置'), { kind: 'error' }),
    })
  }

  /** 删除历史对话 */
  function handleRemoveChat(chat: DrawerChatItem) {
    Taro.showModal({
      title: tt('common.hint', '提示'),
      content: tt('community.confirm12', '确定删除此对话?'),
      success: async (res) => {
        if (res.confirm) {
          try {
            await api.removeModelChat(String(chat.id))
            onToast(tt('message.deleted', '已删除'), { kind: 'success' })
            void loadHistoryChat()
          } catch {
            onToast(tt('developer.index.deleteFail', '删除失败'), { kind: 'error' })
          }
        }
      },
    })
  }

  function handleFenleiBtnClick(index: number, item: CategoryItem) {
    // 与 web 一致:没有合成「全部」胶囊。再次点击已选中的分类 = 取消筛选,回到全量列表。
    if (fenleiActive.includes(index)) {
      onCategorySelect('all')
      return
    }
    onCategorySelect(item.id)
  }

  /** 映射分类到 TitleSwitchScrollTitle 格式 */
  const titleSwitchMainList: TitleSwitchScrollTitleItem[] = [
    {
      name: tt('common.all', '全部'),
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
    avatar: resolveCommunityAssetUrl(a.agentAvatar),
    cover: resolveCommunityAssetUrl(a.agentCover || ''),
    category: a.agentMainCategory[0]?.name,
    useCount: a.usageCount,
    isVipExclusive: false,
    vipType: a.type === 3 ? 4 : undefined, // type=3 月费(简化映射,对齐原项目 Ai-list_b.vue)
  }))

  return (
    // 底部留位取单一出处 `constants/tab-bar-metrics`(自定义 tabBar 是浮层,不压缩页面
    // 视口 ⇒ 页面滚动内容必须自己让位)。原先端内手写的 `pb-[calc(140rpx+env(...))]`
    // 是同一名目的的第二份量,已剥掉并由下面滚动容器的 paddingBottom 承接(外层显式
    // 归零 pb-0,避免两份留位叠加/互相覆盖)。
    <ThemeRoot className="community-out-container pb-0">
      <View
        style={
          {
            ['--app-top-bar-height']: appTopBarHeight,
            height: showCategoryPopup ? '100vh' : 'auto',
            overflowY: showCategoryPopup ? 'hidden' : 'auto',
            paddingBottom: TAB_BAR_PAGE_RESERVE_CSS,
          } as React.CSSProperties
        }
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
            Taro.navigateTo({ url: '/pkg-ai/ai/chat' })
          }}
        />

        <View className="community-main-container" style={{ color: 'var(--color-foreground)' }}>
          {/* FloatBox 浮动组件 — 对齐原项目放在 main-container 内第一层；
              社区页首屏卡片密集，默认收起，避免三个悬浮按钮压住智能体卡片 */}
          <FloatBox defaultOpen={false} onService={() => setShowServicePopup(true)} />

          {/* 固定导航栏(fixed z-index:999,对齐原项目)。占位只做一次:
              下面 content-area 的 padding-top 已经等于 --app-top-bar-height,
              再插一个同高 spacer 会把标题推到屏高 1/5 处(实测 top=186,内容区 top=91)。
              这里删除 spacer,由 content-area 的 padding 单独承接。 */}
          <View style={{ position: 'fixed', left: 0, top: 0, right: 0, zIndex: 999 }}>
            <NavBar
              variant="ai-home"
              title=""
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
                      hoverClass="opacity-60"
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
            style={{ padding: 'var(--app-top-bar-height) 32rpx 40rpx' }}
          >
            {/* 标题 + 副标题 + 帖子入口(对齐 web / 共享屏首屏:标题右侧是帖子按钮) */}
            <View
              style={{
                display: 'flex',
                flexDirection: 'row',
                alignItems: 'flex-start',
                justifyContent: 'space-between',
                gap: rpx(24),
                padding: `${rpx(32)} 0 0`,
              }}
            >
              <View style={{ flex: 1, minWidth: 0 }}>
                <Text
                  style={{
                    display: 'block',
                    fontSize: taroType.display.fontSize,
                    lineHeight: taroType.display.lineHeight,
                    fontWeight: 700,
                    color: 'var(--color-foreground)',
                  }}
                >
                  {tt('community.title', '智汇AI')}
                </Text>
                <Text
                  style={{
                    display: 'block',
                    marginTop: rpx(8),
                    fontSize: taroType.body.fontSize,
                    lineHeight: taroType.body.lineHeight,
                    color: 'var(--color-muted-foreground)',
                  }}
                >
                  {tt('community.subtitle', '智能体社区：发现并用好每一个 AI')}
                </Text>
              </View>
              <View
                ariaRole="button"
                ariaLabel={tt('community.posts', '帖子')}
                hoverClass="opacity-60"
                onClick={() => Taro.navigateTo({ url: '/pkg-content/community/create/index' })}
                style={{
                  flexShrink: 0,
                  height: rpx(68),
                  marginTop: rpx(8),
                  padding: `0 ${rpx(24)}`,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: rpx(12),
                  borderRadius: rpx(12),
                  border: '2rpx solid var(--color-border)',
                  background: 'var(--color-card)',
                  boxSizing: 'border-box',
                }}
              >
                <LineIcon name="plus" size={32} color="var(--color-foreground)" />
                <Text
                  style={{ fontSize: taroType.body.fontSize, color: 'var(--color-foreground)' }}
                >
                  {tt('community.posts', '帖子')}
                </Text>
              </View>
            </View>

            {/* 搜索行:与 web / RN 共享屏同构(输入框 + 圆形搜索按钮),顺序也对齐
                (标题 → 搜索 → 轮播 → 分类 → 最近使用 → 推荐),去掉 InputArea 的
                附件/发送按钮,避免小程序端搜索框比另两端多出一排控件 */}
            {showSearch ? (
              <View
                className="community-search-area"
                style={{
                  display: 'flex',
                  flexDirection: 'row',
                  alignItems: 'center',
                  gap: '8px',
                  marginTop: '8px',
                }}
              >
                <View
                  style={{
                    flex: 1,
                    minWidth: 0,
                    height: '40px',
                    position: 'relative',
                    display: 'flex',
                    alignItems: 'center',
                    paddingLeft: '36px',
                    paddingRight: '76px',
                    borderRadius: '6px',
                    border: '1px solid var(--color-border)',
                    background: 'var(--color-card)',
                    boxSizing: 'border-box',
                  }}
                >
                  <LineIcon
                    name="search"
                    size={32}
                    color="var(--color-muted-foreground)"
                    style={{ position: 'absolute', left: '12px', top: '12px' }}
                  />
                  <Input
                    value={searchKeyword}
                    placeholder={tt('community.m3', '搜索智能体')}
                    placeholderStyle="color: var(--color-muted-foreground)"
                    confirmType="search"
                    onInput={(e) => handleSearchInput(e.detail.value)}
                    onConfirm={() => handleSearchSend(searchKeyword)}
                    style={{
                      flex: 1,
                      fontSize: taroType.body.fontSize,
                      color: 'var(--color-foreground)',
                    }}
                  />
                  <View
                    style={{
                      position: 'absolute',
                      right: rpx(8),
                      top: 0,
                      bottom: 0,
                      display: 'flex',
                      flexDirection: 'row',
                      alignItems: 'center',
                      gap: rpx(4),
                    }}
                  >
                    <View
                      ariaRole="button"
                      ariaLabel={tt('community.search13', '语音搜索请在完整版使用')}
                      hoverClass="opacity-60"
                      onClick={() =>
                        onToast(tt('community.search13', '语音搜索请在完整版使用'), {
                          kind: 'info',
                        })
                      }
                      style={{
                        width: '32px',
                        height: '40px',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                      }}
                    >
                      <LineIcon name="mic" size={32} color="var(--color-muted-foreground)" />
                    </View>
                    <View
                      ariaRole="button"
                      ariaLabel={tt('community.search14', '图片搜索请在完整版使用')}
                      hoverClass="opacity-60"
                      onClick={() =>
                        onToast(tt('community.search14', '图片搜索请在完整版使用'), {
                          kind: 'info',
                        })
                      }
                      style={{
                        width: '32px',
                        height: '40px',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                      }}
                    >
                      <LineIcon name="image" size={32} color="var(--color-muted-foreground)" />
                    </View>
                  </View>
                </View>
                <View
                  ariaRole="button"
                  ariaLabel={tt('common.search', '搜索')}
                  hoverClass="opacity-60"
                  onClick={() => handleSearchSend(searchKeyword)}
                  style={{
                    width: '40px',
                    height: '40px',
                    flexShrink: 0,
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    borderRadius: '20px',
                    background: 'var(--color-foreground)',
                  }}
                >
                  <LineIcon name="search" size={32} color="var(--color-background)" />
                </View>
              </View>
            ) : null}

            {/* 轮播图(对齐原项目 gradient-border + carousel-inner) */}
            {banners.length > 0 ? (
              <View
                className="community-carousel-wrapper"
                style={{ margin: '24px 0 0 0', height: '128px' }}
              >
                <View className="community-carousel-gradient">
                  <View className="community-carousel-inner">
                    <Carousel
                      items={banners}
                      autoplay
                      interval={3000}
                      height={128}
                      variant="banner"
                      onItemClick={onBannerClick}
                    />
                  </View>
                </View>
              </View>
            ) : null}

            {/* 分类:标题 + 常驻胶囊(对齐 web / 共享屏;原实现只在弹层里,这里补常驻入口) */}
            {categories.length > 0 ? (
              <View style={{ marginTop: '24px' }}>
                <Text
                  style={{
                    display: 'block',
                    fontSize: '20px',
                    lineHeight: '28px',
                    fontWeight: 600,
                    color: 'var(--color-foreground)',
                  }}
                >
                  {tt('community.categories', '分类')}
                </Text>
                <View
                  className="community-category-row"
                  style={{
                    display: 'flex',
                    flexDirection: 'row',
                    flexWrap: 'wrap',
                    gap: '8px',
                    width: '100%',
                    marginTop: '12px',
                  }}
                >
                  {categories.map((c, index) => {
                    const active = fenleiActive.includes(index)
                    return (
                      <View
                        key={c.id}
                        className="community-category-chip"
                        hoverClass="opacity-60"
                        onClick={() => handleFenleiBtnClick(index, c)}
                        style={{
                          flexShrink: 0,
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          height: '30px',
                          padding: '0 12px',
                          borderRadius: rpx(999),
                          border: `1px solid ${active ? 'var(--color-primary)' : 'var(--color-border)'}`,
                          background: active ? 'var(--color-primary)' : 'var(--color-card)',
                          boxSizing: 'border-box',
                        }}
                      >
                        <Text
                          style={{
                            fontSize: taroType.body.fontSize,
                            lineHeight: taroType.body.lineHeight,
                            color: active
                              ? 'var(--color-primary-foreground)'
                              : 'var(--color-foreground)',
                            whiteSpace: 'nowrap',
                          }}
                        >
                          {c.name}
                        </Text>
                      </View>
                    )
                  })}
                </View>
              </View>
            ) : null}

            {/* 客服入口只保留 FloatBox 展开后的服务按钮:原先夹在分类与最近使用之间的
                「联系客服」文字链在 web/RN 都没有,且把纵向节奏断开,已删除。 */}

            {/* RecentAgents 最近使用(对齐原项目, v-if recentAgents.length > 0);
                无记录时对齐 web / 共享屏:保留标题并显示空态文案,而不是整块消失 */}
            {recentAgents.length > 0 ? (
              <View style={{ marginTop: '24px' }}>
                <RecentAgents recentAgents={recentAgents} />
              </View>
            ) : (
              <View style={{ marginTop: '24px' }}>
                <View
                  style={{
                    display: 'flex',
                    flexDirection: 'row',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                  }}
                >
                  <Text
                    style={{
                      display: 'block',
                      fontSize: '20px',
                      lineHeight: '28px',
                      fontWeight: 600,
                      color: 'var(--color-foreground)',
                    }}
                  >
                    {tt('communityRecentAgents.text1', '最近使用')}
                  </Text>
                  <View
                    hoverClass="opacity-60"
                    onClick={() =>
                      Taro.navigateTo({
                        url: '/pkg-content/category-detail/index',
                        fail: () =>
                          onToast(tt('community.detail16', '分类详情页未配置'), { kind: 'error' }),
                      })
                    }
                    style={{
                      display: 'flex',
                      flexDirection: 'row',
                      alignItems: 'center',
                      gap: rpx(4),
                    }}
                  >
                    <Text
                      style={{
                        fontSize: taroType.body.fontSize,
                        color: 'var(--color-muted-foreground)',
                      }}
                    >
                      {tt('common.more', '更多')}
                    </Text>
                    <LineIcon
                      name="chevron-right"
                      size={32}
                      color="var(--color-muted-foreground)"
                    />
                  </View>
                </View>
                <Text
                  style={{
                    display: 'block',
                    marginTop: '12px',
                    fontSize: taroType.body.fontSize,
                    lineHeight: taroType.body.lineHeight,
                    color: 'var(--color-muted-foreground)',
                  }}
                >
                  {tt('community.recentEmpty', '还没有使用记录，去挑一个智能体吧')}
                </Text>
              </View>
            )}

            {/* MyAgents 我的智能体(对齐原项目, v-if myAgents.length > 0) */}
            {myAgents.length > 0 ? <MyAgents myAgents={myAgents} /> : null}

            {/* ai-list 智能体列表(对齐原项目 ailist_content) */}
            <View className="community-ailist-content">
              <View className="community-agent-list-header">
                <Text className="community-agent-list-title">
                  {tt('community.text15', '智能体推荐')}
                </Text>
                <View
                  className="community-agent-list-more"
                  onClick={() =>
                    Taro.navigateTo({
                      url: '/pkg-content/category-detail/index',
                      fail: () =>
                        onToast(tt('community.detail16', '分类详情页未配置'), { kind: 'error' }),
                    })
                  }
                  hoverClass="opacity-60"
                >
                  <Text>{tt('common.more', '更多')}</Text>
                  <LineIcon name="chevron-right" size={32} color="var(--color-muted-foreground)" />
                </View>
              </View>

              {/* 推荐卡:双列封面卡(对齐 web / 共享屏的封面 + 名称 + 描述 + 免费徽标);
                  小屏两列,保留头像做大图占位,避免再退回单列横条列表 */}
              {loading && agentInfoList.length === 0 ? (
                <View style={{ padding: `${rpx(24)} 0` }}>
                  <Text
                    style={{
                      fontSize: taroType.body.fontSize,
                      color: 'var(--color-muted-foreground)',
                    }}
                  >
                    {tt('common.loading', '加载中…')}
                  </Text>
                </View>
              ) : null}
              {agentInfoList.length > 0 ? (
                <View
                  className="community-agent-grid"
                  style={{
                    display: 'flex',
                    flexDirection: 'row',
                    flexWrap: 'wrap',
                    justifyContent: 'space-between',
                    rowGap: px(16),
                    marginTop: rpx(24),
                  }}
                >
                  {agentInfoList.map((a) => (
                    <View
                      key={a.id}
                      className="community-agent-card"
                      hoverClass="opacity-60"
                      onClick={() =>
                        a.vipType === 4 ? void handlePurchase(a) : onAgentListSelect(a)
                      }
                      style={{
                        width: `calc(50% - ${px(7)})`,
                        minHeight: px(266),
                        display: 'flex',
                        flexDirection: 'column',
                        borderRadius: rnRadius.lg,
                        border: `1px solid var(--color-border)`,
                        background: 'var(--color-card)',
                        overflow: 'hidden',
                        boxSizing: 'border-box',
                      }}
                    >
                      <View
                        className="community-card-cover"
                        style={{
                          height: px(128),
                          flexShrink: 0,
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          background: 'var(--color-muted)',
                          overflow: 'hidden',
                        }}
                      >
                        {a.cover ? (
                          <Image
                            src={a.cover}
                            mode="aspectFill"
                            style={{ width: '100%', height: '100%' }}
                          />
                        ) : a.avatar ? (
                          <View
                            style={{
                              width: px(64),
                              height: px(64),
                              borderRadius: px(14),
                              overflow: 'hidden',
                              background: 'var(--color-card)',
                            }}
                          >
                            <Image
                              src={a.avatar}
                              mode="aspectFill"
                              style={{ width: '100%', height: '100%' }}
                            />
                          </View>
                        ) : (
                          <View
                            style={{
                              width: px(64),
                              height: px(64),
                              borderRadius: px(32),
                              display: 'flex',
                              alignItems: 'center',
                              justifyContent: 'center',
                              background: 'var(--color-card)',
                            }}
                          >
                            <Text
                              style={{
                                fontSize: px(24),
                                fontWeight: 700,
                                color: 'var(--color-foreground)',
                              }}
                            >
                              {(a.name || '?').trim().charAt(0).toUpperCase()}
                            </Text>
                          </View>
                        )}
                      </View>
                      <View
                        className="community-card-body"
                        style={{
                          flex: 1,
                          display: 'flex',
                          flexDirection: 'column',
                          padding: px(12),
                        }}
                      >
                        <Text
                          className="community-line-clamp-2 community-card-title"
                          style={{
                            minHeight: px(44),
                            fontSize: px(16),
                            lineHeight: px(22),
                            fontWeight: 600,
                            color: 'var(--color-foreground)',
                          }}
                        >
                          {a.name}
                        </Text>
                        <Text
                          className="community-line-clamp-2 community-card-desc"
                          style={{
                            marginTop: px(6),
                            minHeight: px(36),
                            fontSize: px(13),
                            lineHeight: px(18),
                            color: 'var(--color-muted-foreground)',
                          }}
                        >
                          {a.description || ''}
                        </Text>
                        <Text
                          className="community-card-price"
                          style={{
                            alignSelf: 'flex-start',
                            marginTop: 'auto',
                            padding: `${px(2)} ${px(6)}`,
                            borderRadius: px(4),
                            background: a.price
                              ? 'var(--color-muted)'
                              : 'var(--color-success-light)',
                            fontSize: px(12),
                            lineHeight: px(16),
                            fontWeight: 600,
                            color: a.price
                              ? 'var(--color-primary)'
                              : 'var(--color-success-deep-text)',
                          }}
                        >
                          {a.price ? `¥${(a.price / 100).toFixed(0)}` : tt('common.free', '免费')}
                        </Text>
                      </View>
                    </View>
                  ))}
                </View>
              ) : null}
              {/* 错误优先于空态:失败时给出可点的重试出口,否则本页看不到任何反馈。
                  样式复用本页既有的 community-empty/community-empty-text,不新造样式 */}
              {!loading && loadError ? (
                <View
                  className="community-empty"
                  onClick={() => void loadData(true)}
                  hoverClass="opacity-60"
                >
                  <Text className="community-empty-text">
                    {tt('community.loadFailedTapRetry', '加载失败，点击重试')}
                  </Text>
                </View>
              ) : null}
              {!loading && !loadError && agentList.length === 0 ? (
                <EmptyState text={tt('agent.empty', '暂无智能体')} />
              ) : null}
              {!loading && !hasMore && agentList.length > 0 ? (
                <View className="community-no-more">
                  <Text className="community-no-more-text">
                    {tt('common.noMore', '没有更多了')}
                  </Text>
                </View>
              ) : null}
            </View>
          </View>

          {/* 返回顶部按钮:外观与几何不在此设定,由 ScrollJumpButton 单一源给出;
           *  这里只给定位(贴右下 + 给悬浮 TabBar 让位) */}
          {showBackTop ? (
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
        </View>

        {/* 服务弹窗(二维码名片,对齐原项目 Ai-list_b.vue L213-227 isServicePopupVisible) */}
        {showServicePopup ? (
          <View
            className="fixed inset-0 z-[2000] flex items-center justify-center"
            style={{ background: 'var(--color-scrim)' }}
            onClick={() => setShowServicePopup(false)}
          >
            <View
              className="relative"
              style={{
                padding: rpx(20),
                borderRadius: rnRadius['2xl'],
                background: 'var(--color-card)',
                maxWidth: '85%',
              }}
              onClick={(e) => e.stopPropagation()}
              hoverClass="opacity-60"
            >
              {/* 名片图片(对齐原项目 mingpian.png) */}
              <Image
                src={mingpianImg}
                mode="widthFix"
                style={{ width: '100%', borderRadius: rnRadius.lg, marginBottom: rpx(16) }}
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
                hoverClass="opacity-60"
              >
                <Text
                  style={{ fontSize: taroType.heading.fontSize, color: 'var(--color-foreground)' }}
                >
                  ×
                </Text>
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
            if (!agent || !payInfo) return
            try {
              // 1. 创建支付记录
              await api.createPayHistory({
                agentId: agent.id,
                amount: payInfo.amount ?? 0,
              })
              // 2. 调微信支付 JSAPI 获取支付参数
              const payRes = (await api.wechatPay({
                amount: payInfo.amount ?? 0,
                orderType: 'agent',
                productId: agent.id,
                description: t('community.y2', { p1: agent.name }),
              })) as {
                mock?: boolean
                timeStamp?: string
                nonceStr?: string
                package?: string
                signType?: 'RSA' | 'MD5' | 'HMAC-SHA256'
                paySign?: string
              }
              // 3. mock 模式(后端未配置微信支付)
              if (payRes?.mock) {
                onToast(tt('community.success17', '支付成功(mock)'), { kind: 'success' })
                setShowPayPopup(false)
                void loadData(true)
                return
              }
              // 4. 调起微信支付
              if (
                !payRes?.paySign ||
                !payRes.timeStamp ||
                !payRes.nonceStr ||
                !payRes.package ||
                !payRes.signType
              ) {
                onToast(tt('community.pay18', '支付参数异常'), { kind: 'error' })
                return
              }
              await requestPayment({
                timeStamp: payRes.timeStamp,
                nonceStr: payRes.nonceStr,
                package: payRes.package,
                signType: payRes.signType,
                paySign: payRes.paySign,
              })
              onToast(tt('pay.result.paid', '支付成功'), { kind: 'success' })
              setShowPayPopup(false)
              void loadData(true)
            } catch (err) {
              // requestPayment 已处理 cancel/fail 的 toast;unwrapApi 已处理 API 失败 toast
              if (err !== 'cancel') {
                onToast(tt('pay.failed', '支付失败,请重试'), { kind: 'error' })
              }
            }
          }}
        />
      </View>
    </ThemeRoot>
  )
}
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
