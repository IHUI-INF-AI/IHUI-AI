// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * NewsScreen AI资讯页(mobile-rn 端 wrapper)
 *
 * 保留 RN 特定逻辑: useState/useEffect/useNavigation/useAuth/fetchApi/Drawer/FloatBox/NavBar
 * 主 UI 委托给 @ihui/rn-app SquareScreen 共享组件
 */
import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { StyleSheet, View, type FlatList, type ViewStyle } from 'react-native'
import { BlurTargetView } from 'expo-blur'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import Clipboard from '@react-native-clipboard/clipboard'
import { useNavigation } from '@react-navigation/native'
import type { NativeStackNavigationProp } from '@react-navigation/native-stack'
import {
  deleteConversation,
  fetchApi,
  getNews,
  listConversations,
  type ConversationDetail,
} from '@ihui/api-client'
import { apiFailureToText, toUserFriendlyMessage } from '@ihui/shared/utils'
import { tokens } from '../theme/active-tokens'
import Drawer, {
  type DrawerConversationItem,
  type DrawerExtraMenu,
  type DrawerTab,
} from '../components/Drawer'
import { FloatBox, type FloatBoxType } from '../components/FloatBox'
import { NavBar, type NavBarAction } from '../components/NavBar'
import { ExternalLink } from 'lucide-react-native'
import { PanelLeftRounded } from '../components/PanelLeftRounded'
// 底部导航(对齐原 customTabBar 5 主 Tab,NewsScreen 对应「动态」Tab)
import TabBar, { type TabBarKey } from '../components/TabBar'
import { tabBarScrollReserve } from '../components/TabBar.styles'
import { useAuth } from '../context/AuthContext'
import { useI18n } from '../i18n'
import { FREE_RESOURCE_URL } from '../constants/links'
import { useTheme } from '../context/ThemeContext'
import type { RootStackParamList } from '../navigation/RootNavigator'
import { navigateDrawerTab } from '../navigation/tab-utils'
import {
  SquareScreen as SharedSquareScreen,
  type ArticleItem,
  type CategoryItem,
} from '@ihui/rn-app'
import { NavChrome } from '../components/NavChrome'

type NavigationProp = NativeStackNavigationProp<RootStackParamList>
type RootNav = NativeStackNavigationProp<RootStackParamList>

/**
 * 资讯条目分页不再在本文件声明形状:`getNews`(@ihui/api-client)的返回面就是
 * `ApiResult<PageData<News>>`,再写一份 `KnowledgePage` 只会造出第二套真相(§0.6)。
 */
interface FloatBoxState {
  visible: boolean
  type: FloatBoxType
  message: string
}

const FLOAT_BOX_DEFAULT: FloatBoxState = { visible: false, type: 'info', message: '' }

const PAGE_SIZE = 20

/**
 * 「全部」伪分类 —— 与 web 资讯首页同口径(`apps/web/app/(main)/news/PageClient.tsx:31-34`:
 * 分类 chips 来自 `GET /api/news/categories`,「全部」是端内合成、请求时不带 categoryId)。
 *
 * 此前这里是 7 枚**硬编码** chip(`code: 'AI'|'ML'|'CV'|'NLP'|'CHIP'|'REC'`),而后端
 * `paginationSchema`(apps/api/src/routes/user/_shared.ts:14-18)只认 page/pageSize/search
 * ⇒ `code` 被当场丢弃,7 枚 chip 纯装饰、点哪一枚都是同一份列表。分类名也来自 `news_categories`
 * 表而非端内写死,所以 chips 必须跟着源头走。
 */
const ALL_CATEGORY = { id: 'all', labelKey: 'home.matAll' } as const

/** `news_categories` 裸行的最小读面(id/name),字段实回见 packages/types/src/news-category.ts 头注 */
interface NewsCategoryRow {
  id?: string | number
  name?: string
}

const navigateRoot = (nav: RootNav | undefined, route: keyof RootStackParamList | string) => {
  if (!nav) return
  try {
    nav.navigate(route as never)
  } catch {
    // ignore
  }
}

export default function NewsScreenWrapper() {
  const { t } = useI18n()
  const { resolvedTheme } = useTheme()
  const { user } = useAuth()
  const navigation = useNavigation<NavigationProp>()
  const rootNav = navigation.getParent<RootNav>()
  // 悬浮 TabBar 让位(2026-10-16):内容滚到底部时仍完整露在胶囊之上,可继续滚到玻璃底下
  const insets = useSafeAreaInsets()
  const tabBarBlurTargetRef = useRef<View>(null)

  /** 底部 Tab 切换(对齐原 customTabBar 5 主 Tab;News 为 RootStack 独立路由) */
  const handleTabChange = (key: TabBarKey): void => {
    switch (key) {
      case 'aiShop':
        navigation.navigate('Main', { screen: 'AiMain' })
        break
      case 'home':
        navigation.navigate('Main', { screen: 'HomeMain' })
        break
      case 'plaza':
        navigation.navigate('Plaza')
        break
      case 'mine':
        navigation.navigate('Main', { screen: 'ProfileMain' })
        break
      case 'news':
        break // 当前 Tab
    }
  }

  const [items, setItems] = useState<ArticleItem[]>([])
  const [loading, setLoading] = useState(false)
  const [refreshing, setRefreshing] = useState(false)
  const [loadingMore, setLoadingMore] = useState(false)
  const [page, setPage] = useState(1)
  const [hasMore, setHasMore] = useState(true)
  const [error, setError] = useState('')
  /** 分类 chips:「全部」恒在,其余按 `news_categories` 表实回追加(取不到就只留「全部」,不冒充判过) */
  const [categories, setCategories] = useState<readonly { id: string; name: string }[]>([])
  const [selectedCategory, setSelectedCategory] = useState<string>(ALL_CATEGORY.id)

  const [floatBox, setFloatBox] = useState<FloatBoxState>(FLOAT_BOX_DEFAULT)
  const [drawerVisible, setDrawerVisible] = useState(false)
  const [drawerConversations, setDrawerConversations] = useState<DrawerConversationItem[]>([])
  const [drawerConversationsLoaded, setDrawerConversationsLoaded] = useState(false)
  /** 资讯列表 ref(共享 SquareScreen 通过 onListRef 暴露,用于返回顶部 scrollToOffset) */
  const listRef = useRef<FlatList<ArticleItem> | null>(null)

  const showFloat = useCallback((message: string, type: FloatBoxType = 'info') => {
    setFloatBox({ visible: true, type, message })
  }, [])

  const hideFloat = useCallback(() => {
    setFloatBox((prev) => ({ ...prev, visible: false }))
  }, [])

  const loadDrawerConversations = useCallback(async () => {
    if (!user) return
    try {
      const res = await listConversations({ page: 1, pageSize: 20 })
      if (res.success) {
        const list: DrawerConversationItem[] = res.data.conversations.map((c) =>
          mapConversationToDrawer(c, t),
        )
        setDrawerConversations(list)
      } else {
        setDrawerConversations([])
      }
    } catch {
      setDrawerConversations([])
    } finally {
      setDrawerConversationsLoaded(true)
    }
  }, [user, t])

  useEffect(() => {
    if (drawerVisible && !drawerConversationsLoaded && user) {
      void loadDrawerConversations()
    }
  }, [drawerVisible, drawerConversationsLoaded, user, loadDrawerConversations])

  const handleDrawerNavigate = useCallback(
    (tab: DrawerTab) => {
      setDrawerVisible(false)
      if (tab === 'square') {
        navigateRoot(rootNav, 'Plaza')
        return
      }
      if (tab === 'share') return // 已在 AI资讯页,仅收起抽屉
      navigateDrawerTab(rootNav, tab)
    },
    [rootNav],
  )

  const handleDrawerNavigateCompany = useCallback(() => {
    setDrawerVisible(false)
    navigateRoot(rootNav, 'Distribution')
  }, [rootNav])

  const handleDrawerClaimFree = useCallback(() => {
    setDrawerVisible(false)
    try {
      Clipboard.setString(FREE_RESOURCE_URL)
      showFloat(t('aiAssistant.copyOkToast'), 'success')
    } catch {
      showFloat(t('profile.copyFailRetry'), 'warning')
    }
  }, [showFloat, t])

  const handleDrawerCreateNewChat = useCallback(() => {
    setDrawerVisible(false)
    rootNav?.navigate('Main', { screen: 'AiMain' })
  }, [rootNav])

  const handleDrawerSelectConversation = useCallback(
    (id: string) => {
      setDrawerVisible(false)
      const conv = drawerConversations.find((c) => c.id === id)
      rootNav?.navigate('Chat', {
        conversationId: id,
        title: conv?.title,
        modelName: conv?.modelConfig?.name,
      } as never)
    },
    [rootNav, drawerConversations],
  )

  const handleDrawerDeleteConversation = useCallback(
    (id: string) => {
      const snapshot = drawerConversations
      setDrawerConversations((prev) => prev.filter((c) => c.id !== id))
      void (async () => {
        const res = await deleteConversation(id)
        if (!res.success) {
          setDrawerConversations(snapshot)
          showFloat(t('profile.delFailedRetry'), 'warning')
        } else {
          showFloat(t('plaza.index.delOk'), 'success')
        }
      })()
    },
    [drawerConversations, showFloat, t],
  )

  const handleDrawerOpenSettings = useCallback(() => {
    setDrawerVisible(false)
    navigateRoot(rootNav, 'Settings')
  }, [rootNav])

  const handleDrawerOpenMessages = useCallback(() => {
    setDrawerVisible(false)
    navigateRoot(rootNav, 'MessageCenter')
  }, [rootNav])

  const handleDrawerGoHome = useCallback(() => {
    setDrawerVisible(false)
    rootNav?.navigate('Main', { screen: 'HomeMain' })
  }, [rootNav])

  const handleNavigateExtra = useCallback(
    (menu: DrawerExtraMenu) => {
      setDrawerVisible(false)
      switch (menu) {
        case 'aigc':
          navigateRoot(rootNav, 'AigcList')
          break
        case 'learn':
          navigateRoot(rootNav, 'Learn')
          break
        case 'modelPlaza':
          navigateRoot(rootNav, 'ModelPlaza')
          break
        case 'company':
          navigateRoot(rootNav, 'Distribution')

          break

        case 'assistant':
          navigation?.navigate('Assistant')

          break

        case 'tools':
          navigateRoot(rootNav, 'Settings')

          break

        default:
          break
      }
    },
    [navigation, rootNav],
  )

  const drawerUser = useMemo(
    () => ({
      avatar: user?.avatar,
      nickname: user?.nickname ?? user?.username ?? t('profile.notLoggedIn'),
      level: ((user as { isVip?: boolean } | null)?.isVip ? 'vip' : 'normal') as 'vip' | 'normal',
    }),
    [user, t],
  )

  const leftActions = useMemo<ReadonlyArray<NavBarAction>>(
    () => [
      {
        icon: PanelLeftRounded,
        a11yLabel: t('common.menu'),
        onPress: () => setDrawerVisible(true),
      },
    ],
    [t],
  )

  // 分享入口(孤儿路由修复:Share 注册无入口,资讯/动态页补挂)
  const rightActions = useMemo<ReadonlyArray<NavBarAction>>(
    () => [
      {
        icon: ExternalLink,
        label: t('share.title'),
        onPress: () => {
          const nav = navigation.getParent<RootNav>() ?? navigation
          nav.navigate('Share')
        },
      },
    ],
    [navigation, t],
  )

  const load = useCallback(
    async (targetPage: number, append: boolean) => {
      // 追加分页时不触发全屏 loading(避免上拉时列表闪加载态)
      if (!append) {
        setLoading(true)
        setError('')
      }
      try {
        // 资讯域:`GET /api/news/articles`(news_articles 表)。
        // 此前这一屏取的是 `/api/knowledge`(knowledge_base 表),而列表项点进去的详情按
        // `/api/articles/:id`(同样是 news_articles)查 ⇒ 列表给 knowledge 的 id、详情按 news 的
        // id 查,两条腿跨了两个域,点击恒查不到。域统一到 news 后,详情才能真打开。
        const categoryId = selectedCategory === ALL_CATEGORY.id ? undefined : selectedCategory
        const res = await getNews(
          categoryId
            ? { page: targetPage, pageSize: PAGE_SIZE, categoryId }
            : { page: targetPage, pageSize: PAGE_SIZE },
        )
        if (res.success && res.data) {
          const list: ArticleItem[] = (res.data.list ?? []).map((n) => ({
            id: String(n.id),
            title: n.title,
            summary: n.summary,
            authorName: n.authorName || t('news.anonAuthor'),
            createdAt: n.publishedAt,
            viewCount: n.viewCount ?? 0,
            category: n.categoryName ?? undefined,
          }))
          setItems((prev) => (append ? [...prev, ...list] : list))
          setPage(targetPage)
          // 不足 pageSize 视为无更多(对齐原 scrolltolower 语义)
          setHasMore(list.length >= PAGE_SIZE)
        } else {
          if (!append) {
            setItems([])
            setError(apiFailureToText(res, t('chat.notes.loadFailShort')))
          }
        }
      } catch (e: unknown) {
        const detail = e instanceof Error ? e.message : typeof e === 'string' ? e : ''
        if (!append) {
          setItems([])
          setError(detail.trim() ? toUserFriendlyMessage(e) : t('news.netFail'))
        }
      } finally {
        if (!append) setLoading(false)
        setRefreshing(false)
        setLoadingMore(false)
      }
    },
    [selectedCategory, t],
  )

  useEffect(() => {
    void load(1, false)
  }, [load])

  /**
   * 分类 chips 取源头(`GET /api/news/categories` → news_categories 表,按 sort 升序)。
   * 失效方向:取不到 ⇒ 只留「全部」一枚,与 web 同口径(`d.list ?? []`);
   * 绝不拿端内硬编码那一组顶上 —— 那正是这次要根治的「chip 是装饰、点了不筛」成因。
   */
  useEffect(() => {
    let cancelled = false
    void (async () => {
      const res = await fetchApi<{ list?: NewsCategoryRow[] | null }>('/api/news/categories')
      if (cancelled || !res.success || !res.data) return
      setCategories(
        (res.data.list ?? [])
          .filter(
            (c) =>
              typeof c.name === 'string' && c.name !== '' && c.id !== undefined && c.id !== null,
          )
          .map((c) => ({ id: String(c.id), name: String(c.name) })),
      )
    })()
    return () => {
      cancelled = true
    }
  }, [])

  const handleRefresh = useCallback(async () => {
    setRefreshing(true)
    await load(1, false)
  }, [load])

  const handleEndReached = useCallback(() => {
    // 上拉分页(对齐原 scrolltolower):加载中防重入,无更多则停止
    if (loading || loadingMore || refreshing || !hasMore) return
    setLoadingMore(true)
    void load(page + 1, true)
  }, [loading, loadingMore, refreshing, hasMore, page, load])

  const handleSelectCategory = useCallback(
    (id: string) => {
      setSelectedCategory(id)
      setLoading(true)
    },
    [setSelectedCategory],
  )

  const handleItemClick = useCallback(
    (id: string) => {
      // 列表与详情同域(news_articles)后才能真打开:web 资讯列表项跳 `/news/${id}`
      // (apps/web/app/(main)/news/NewsSidebar.tsx:74),RN 等价已注册路由 = NewsArticle。
      // 旧写法接的是 ArticleDetail —— 那条路由按 `/api/articles/:id` 查 news_articles,
      // 而列表此前给的是 knowledge_base 的 id,所以是恒 404 的坏链路。
      rootNav?.navigate('NewsArticle', { id })
    },
    [rootNav],
  )

  const categoriesForShared = useMemo<CategoryItem[]>(
    () => [
      { id: ALL_CATEGORY.id, label: t(ALL_CATEGORY.labelKey) },
      ...categories.map((c) => ({ id: c.id, label: c.name })),
    ],
    [categories, t],
  )

  /** 返回顶部(对齐 Uniapp backToTop → pageScrollTo,RN 端用列表 ref scrollToOffset) */
  const handleBackToTop = useCallback(() => {
    listRef.current?.scrollToOffset({ offset: 0, animated: true })
  }, [])

  return (
    <View style={styles.container}>
      {/* Android 真模糊:背景内容包进 BlurTargetView 供 TabBar 胶囊取样 */}
      <BlurTargetView ref={tabBarBlurTargetRef} style={{ flex: 1 }}>
        <NavChrome>
          <NavBar
            title={t('news.title')}
            leftActions={leftActions}
            rightActions={rightActions}
            // 同 PlazaScreen:根 tab 传 onBack 会与抽屉菜单键并列成两条返回键
          />
        </NavChrome>
        <SharedSquareScreen
          t={t}
          colorScheme={resolvedTheme === 'dark' ? 'dark' : 'light'}
          items={items}
          loading={loading}
          refreshing={refreshing}
          error={error}
          categories={categoriesForShared}
          selectedCategory={selectedCategory}
          onSelectCategory={handleSelectCategory}
          onRefresh={handleRefresh}
          onEndReached={handleEndReached}
          onItemClick={handleItemClick}
          showBackTop={true}
          onBackToTop={handleBackToTop}
          onListRef={(ref) => {
            listRef.current = ref as FlatList<ArticleItem> | null
          }}
          hideHeader
          contentBottomPadding={tabBarScrollReserve(insets.bottom)}
        />
        <FloatBox
          visible={floatBox.visible}
          type={floatBox.type}
          message={floatBox.message}
          onHide={hideFloat}
        />
        <Drawer
          visible={drawerVisible}
          onClose={() => setDrawerVisible(false)}
          user={drawerUser}
          conversations={drawerConversations}
          onNavigate={handleDrawerNavigate}
          onNavigateCompany={handleDrawerNavigateCompany}
          onClaimFree={handleDrawerClaimFree}
          onCreateNewChat={handleDrawerCreateNewChat}
          onSelectConversation={handleDrawerSelectConversation}
          onDeleteConversation={handleDrawerDeleteConversation}
          onOpenSettings={handleDrawerOpenSettings}
          onOpenMessages={handleDrawerOpenMessages}
          onGoHome={handleDrawerGoHome}
          onNavigateExtra={handleNavigateExtra}
        />
      </BlurTargetView>
      {/* 底部导航(对齐原 customTabBar 5 主 Tab) */}
      <TabBar activeTab="news" onChange={handleTabChange} blurTarget={tabBarBlurTargetRef} />
    </View>
  )
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: tokens.surface.bg,
  } as ViewStyle,
})

/** ConversationDetail → DrawerConversationItem 映射(对齐 PlazaScreen/ProfileScreen 写法)
 *  tr 由调用方注入:模块顶层不调 t()(求值早于 I18nProvider 挂载,运行必炸) */
function mapConversationToDrawer(
  item: ConversationDetail,
  tr: (key: string) => string,
): DrawerConversationItem {
  const tsStr = item.lastMessageAt ?? item.updatedAt ?? item.createdAt
  const createdAt = tsStr ? new Date(tsStr).getTime() : Date.now()
  const model = item.model ?? ''
  return {
    id: item.id,
    title: item.title?.trim() || tr('plaza.index.untitledConv'),
    modelConfig: model ? { id: model, name: model, icon: undefined } : undefined,
    createdAt,
    favorited: item.favorite === true,
  }
}

/** RootNavigator 默认导入 NewsScreenWrapper(具名导出 NewsScreen 保持兼容,见上) */
export { NewsScreenWrapper as NewsScreen }
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
