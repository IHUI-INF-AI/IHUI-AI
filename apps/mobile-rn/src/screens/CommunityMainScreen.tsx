// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * CommunityMainScreen — RN 主 Tab「智汇AI」宿主容器(2026-11-27)。
 *
 * 页面本体 = 跨端共享屏 CommunityHomeScreen(与 web `/community`、小程序
 * `pages/community/index` 同源);本文件只做宿主该做的事:
 *  - 拉取轮播/分类/最近使用/我的智能体/推荐五组数据(失败各自降级为空,不互相阻塞);
 *  - 翻译 labels(i18n `community.*` 命名空间,与 web 同键);
 *  - 套上 NavBar / Drawer / TabBar 三件既有壳,保持五入口导航与抽屉会话能力;
 *  - 搜索/点击/帖子入口转成 RN 路由跳转。
 *
 * 与 HomeScreen 的关系:HomeMain 原本是课程首页混合体;本次把 HomeMain 的组件换成
 * 本屏,课程内容仍由 CourseMain 承载,Drawer「课程」入口不受影响。
 */

import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { StyleSheet, View } from 'react-native'
import { useNavigation } from '@react-navigation/native'
import type { NativeStackNavigationProp } from '@react-navigation/native-stack'
import {
  deleteConversation,
  fetchApi,
  getAgentDetail,
  getAgentUseHistory,
  getAgents,
  listConversations,
  type Agent,
} from '@ihui/api-client'
import {
  CommunityHomeScreen,
  type CommunityHomeAgent,
  type CommunityHomeBanner,
  type CommunityHomeCategory,
  type CommunityHomeLabels,
} from '@ihui/rn-app'
import { PanelLeftRounded } from '../components/PanelLeftRounded'
import { showHostToast } from '../host/host-toast'
import { NavBar } from '../components/NavBar'
import { NavChrome } from '../components/NavChrome'
import { Drawer, type DrawerConversationItem, type DrawerTab } from '../components/Drawer'
import TabBar, { type TabBarKey } from '../components/TabBar'
import { useAuth } from '../context/AuthContext'
import { useTheme } from '../context/ThemeContext'
import { useI18n } from '../i18n'
import { resolveWebAssetUrl } from '../lib/web-asset-url'
import { navigateDrawerTab } from '../navigation/tab-utils'
import type { RootStackParamList } from '../navigation/RootNavigator'
import { tokens } from '../theme/active-tokens'

type RootNav = NativeStackNavigationProp<RootStackParamList>

/** 小程序/API 返回的 banner 行字段不统一(image / imageUrl / cover),按既有 web 归一化口径取第一个非空 */
interface BannerRow {
  id?: string | number
  title?: string
  description?: string
  image?: string
  imageUrl?: string
  cover?: string
  url?: string
}

interface MyAgentRow {
  agentId: string
  name: string
  description?: string
  avatar?: string | null
}

function normalizeList<T>(raw: unknown): T[] {
  if (Array.isArray(raw)) return raw as T[]
  if (raw && typeof raw === 'object') {
    const obj = raw as Record<string, unknown>
    if (Array.isArray(obj.list)) return obj.list as T[]
    if (Array.isArray(obj.rows)) return obj.rows as T[]
    if (obj.data) return normalizeList<T>(obj.data)
  }
  return []
}

function toAgent(a: Agent): CommunityHomeAgent {
  return {
    id: a.agentId,
    name: a.name,
    description: a.description ?? undefined,
    avatar: resolveWebAssetUrl(a.avatar),
    cover: resolveWebAssetUrl(a.cover),
    isFree: a.isFree,
    price: a.price,
    isVipExclusive: a.isVipExclusive,
  }
}

export default function CommunityMainScreen(): React.JSX.Element {
  const navigation = useNavigation<NativeStackNavigationProp<RootStackParamList>>()
  const rootNav = navigation.getParent<RootNav>()
  const { user } = useAuth()
  const { resolvedTheme } = useTheme()
  const { t } = useI18n()
  const blurTargetRef = useRef<View | null>(null)

  const [drawerVisible, setDrawerVisible] = useState(false)
  const [drawerConversations, setDrawerConversations] = useState<DrawerConversationItem[]>([])
  const [drawerLoaded, setDrawerLoaded] = useState(false)

  const [keyword, setKeyword] = useState('')
  const [searchTick, setSearchTick] = useState(0)
  const [activeCategoryId, setActiveCategoryId] = useState<string | null>(null)
  const [banners, setBanners] = useState<CommunityHomeBanner[]>([])
  const [categories, setCategories] = useState<CommunityHomeCategory[]>([])
  const [recent, setRecent] = useState<CommunityHomeAgent[]>([])
  const [myAgents, setMyAgents] = useState<CommunityHomeAgent[]>([])
  const [recommended, setRecommended] = useState<CommunityHomeAgent[]>([])
  const [recommendedLoading, setRecommendedLoading] = useState(true)

  const labels = useMemo<CommunityHomeLabels>(
    () => ({
      title: t('community.title'),
      subtitle: t('community.subtitle'),
      posts: t('community.posts'),
      searchPlaceholder: t('community.searchPlaceholder'),
      banners: t('community.banners'),
      categories: t('community.categories'),
      recent: t('community.recent'),
      recentHint: t('community.recentHint'),
      recentEmpty: t('community.recentEmpty'),
      myAgents: t('community.myAgents'),
      recommended: t('community.recommended'),
      more: t('common.more'),
      unknownAgent: t('community.unknownAgent'),
      voiceHint: t('community.voiceHint'),
      imageHint: t('community.imageHint'),
      free: t('common.free'),
    }),
    [t],
  )

  // 五组数据并发拉取:任何一组失败只让该区块保持空态,不阻断首屏其它区。
  useEffect(() => {
    let cancelled = false

    void (async () => {
      try {
        const res = await fetchApi<unknown>('/api/content/banner/list?position=home&status=1')
        if (!cancelled && res.success) {
          const rows = normalizeList<BannerRow>(res.data).filter(
            (b) => b.image || b.imageUrl || b.cover,
          )
          setBanners(
            rows.slice(0, 6).map((b, i) => ({
              id: String(b.id ?? i),
              title: b.title,
              description: b.description,
              image: resolveWebAssetUrl(b.image ?? b.imageUrl ?? b.cover),
            })),
          )
        }
      } catch {
        // 轮播失败静默:区块按空数组整块隐藏
      }
    })()

    void (async () => {
      try {
        // 与 web community 同口径:分类走 /api/categories/list(fetchCategories)。
        const res = await fetchApi<{
          list?: { id?: string; categoryId?: string; name: string; icon?: string }[]
        }>('/api/categories/list?page=1&pageSize=100&status=1')
        if (!cancelled && res.success) {
          const seen = new Set<string>()
          const unique = (res.data?.list ?? []).filter((c) => {
            const key = c.categoryId || c.id || c.name
            if (!key || seen.has(key)) return false
            seen.add(key)
            return true
          })
          setCategories(
            unique.slice(0, 12).map((c, index) => ({
              // 后端分类行的主键字段是 categoryId;兼容历史 id,并保证 key 非空。
              id: c.categoryId || c.id || `category-${index}`,
              name: c.name,
            })),
          )
        }
      } catch {
        // 分类失败静默:胶囊行隐藏
      }
    })()

    void (async () => {
      // 我的智能体:与推荐列表独立成败;接口带 avatar 时直接用,缺则退回首字母占位。
      try {
        const mine = await fetchApi<{ list?: MyAgentRow[] }>('/api/agents/my', {
          params: { page: 1, pageSize: 6 },
        })
        if (!cancelled && mine.success) {
          setMyAgents(
            (mine.data?.list ?? []).slice(0, 6).map((a) => ({
              id: a.agentId,
              name: a.name,
              description: a.description,
              avatar: resolveWebAssetUrl(a.avatar),
            })),
          )
        }
      } catch {
        // 我的智能体失败静默:整块隐藏
      }
    })()

    void (async () => {
      try {
        const res = await getAgentUseHistory({ page: 1, pageSize: 6 })
        if (!cancelled && res.success) {
          const bots = (res.data.list ?? []).slice(0, 6)
          const details = await Promise.all(
            bots.map((b) =>
              getAgentDetail(b.botId).then(
                (d) => (d.success ? d.data : null),
                () => null,
              ),
            ),
          )
          if (!cancelled) {
            setRecent(
              details
                .filter((d): d is Agent => d !== null)
                .map((d) => ({
                  id: d.agentId,
                  name: d.name,
                  description: d.description ?? undefined,
                  avatar: resolveWebAssetUrl(d.avatar),
                })),
            )
          }
        }
      } catch {
        // 最近使用失败静默:显示空态文案
      }
    })()

    return () => {
      cancelled = true
    }
  }, [])

  // 推荐列表:关键词/分类变化时按 web community 同口径走服务端筛选(300ms 防抖),
  // 搜索按钮只触发一次立即重查(searchTick),不再跳走页面。
  useEffect(() => {
    let cancelled = false
    setRecommendedLoading(true)
    const timer = setTimeout(() => {
      void (async () => {
        try {
          const res = await getAgents({
            status: 'published',
            pageSize: 12,
            keyword: keyword.trim() || undefined,
            categoryId: activeCategoryId || undefined,
          })
          if (!cancelled && res.success) {
            setRecommended((res.data.list ?? []).slice(0, 12).map(toAgent))
          }
        } catch {
          // 推荐失败静默:保持上一批结果
        } finally {
          if (!cancelled) setRecommendedLoading(false)
        }
      })()
    }, 300)
    return () => {
      cancelled = true
      clearTimeout(timer)
    }
  }, [keyword, activeCategoryId, searchTick])

  // 抽屉历史会话按需加载(首次打开时拉一次,失败保持空列表不阻塞)
  useEffect(() => {
    if (!drawerVisible || drawerLoaded || !user) return
    setDrawerLoaded(true)
    void (async () => {
      try {
        const res = await listConversations({ page: 1, pageSize: 20 })
        if (res.success) {
          setDrawerConversations(
            (res.data.conversations ?? []).map((c) => ({
              id: c.id,
              title: c.title,
              createdAt: c.createdAt ? Date.parse(c.createdAt) : Date.now(),
              source: c.source ?? null,
            })),
          )
        }
      } catch {
        // 静默:抽屉仍可用新建入口
      }
    })()
  }, [drawerVisible, drawerLoaded, user])

  const handleTabChange = useCallback(
    (key: TabBarKey) => {
      switch (key) {
        case 'aiShop':
          rootNav?.navigate('Main', { screen: 'AiMain' })
          break
        case 'plaza':
          rootNav?.navigate('Main', { screen: 'PlazaMain' })
          break
        case 'news':
          rootNav?.navigate('Main', { screen: 'NewsMain' })
          break
        case 'mine':
          rootNav?.navigate('Main', { screen: 'ProfileMain' })
          break
        case 'home':
        default:
          break
      }
    },
    [rootNav],
  )

  const handleDrawerNavigate = useCallback(
    (tab: DrawerTab) => {
      setDrawerVisible(false)
      navigateDrawerTab(rootNav, tab)
    },
    [rootNav],
  )

  const openAgent = useCallback(
    (agent: CommunityHomeAgent) => {
      rootNav?.navigate('AgentDetail', { id: agent.id })
    },
    [rootNav],
  )

  const drawerUser = useMemo(
    () => ({
      avatar: user?.avatar,
      nickname: user?.nickname ?? user?.username ?? t('profile.notLoggedIn'),
      level: ((user as { isVip?: boolean } | null)?.isVip ? 'vip' : 'normal') as 'vip' | 'normal',
    }),
    [user, t],
  )

  return (
    <View style={styles.root}>
      <NavChrome>
        <NavBar
          title=""
          showBack={false}
          leftActions={[
            {
              icon: PanelLeftRounded,
              a11yLabel: t('home.navMenu'),
              onPress: () => setDrawerVisible(true),
            },
          ]}
        />
      </NavChrome>

      <View ref={blurTargetRef} style={styles.body}>
        <CommunityHomeScreen
          labels={labels}
          colorScheme={resolvedTheme}
          keyword={keyword}
          onKeywordChange={setKeyword}
          onSearch={() => setSearchTick((n) => n + 1)}
          activeCategoryId={activeCategoryId ?? undefined}
          banners={banners}
          categories={categories}
          recent={recent}
          myAgents={myAgents}
          recommended={recommended}
          recommendedLoading={recommendedLoading}
          onPressBanner={() => rootNav?.navigate('Main', { screen: 'AiMain' })}
          onPressCategory={(c) => setActiveCategoryId((prev) => (prev === c.id ? null : c.id))}
          onPressRecent={openAgent}
          onPressMyAgent={openAgent}
          onPressRecommended={openAgent}
          onPressPosts={() => rootNav?.navigate('Main', { screen: 'PlazaMain' })}
          onPressMore={() => rootNav?.navigate('Main', { screen: 'AiMain' })}
          onVoiceHint={() => showHostToast(labels.voiceHint, { kind: 'info' })}
          onImageHint={() => showHostToast(labels.imageHint, { kind: 'info' })}
          contentPaddingBottom={180}
        />
      </View>

      <Drawer
        visible={drawerVisible}
        onClose={() => setDrawerVisible(false)}
        user={drawerUser}
        conversations={drawerConversations}
        onNavigate={handleDrawerNavigate}
        onCreateNewChat={() => {
          setDrawerVisible(false)
          rootNav?.navigate('Main', { screen: 'AiMain' })
        }}
        onSelectConversation={(id) => {
          setDrawerVisible(false)
          rootNav?.navigate('Chat', { conversationId: id } as never)
        }}
        onDeleteConversation={(id) => {
          setDrawerConversations((prev) => prev.filter((c) => c.id !== id))
          void deleteConversation(id)
        }}
        onOpenSettings={() => {
          setDrawerVisible(false)
          rootNav?.navigate('Settings')
        }}
        onOpenMessages={() => {
          setDrawerVisible(false)
          rootNav?.navigate('MessageCenter')
        }}
        onGoHome={() => {
          setDrawerVisible(false)
          rootNav?.navigate('Main', { screen: 'HomeMain' })
        }}
      />

      <TabBar activeTab="home" onChange={handleTabChange} blurTarget={blurTargetRef} />
    </View>
  )
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: tokens.surface.bg },
  body: { flex: 1 },
})
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
