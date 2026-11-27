// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * CommunityScreen — RN「智汇AI」社区首页薄壳。
 *
 * 共享屏 `CommunityHomeScreen` 只做展示，本文件负责：
 *  - 取数：分类、轮播、最近使用、我的智能体、推荐智能体；
 *  - 跳转：智能体详情、广场发帖、智能体市场、WebView（轮播链接/语音图搜提示）；
 *  - 端壳：顶部返回条（共享屏本身不含返回，避免第三 tab 与栈页两种形态互相绑死）。
 *
 * 端点为 Web `/community` 同源：`/api/categories/list`、`/api/content/banner/list`、
 * `/api/agents/list`、`/api/agents/use-history`、`/api/agents/my`。失败不清空成「本来没有」，
 * 保留错误条与重试出口。
 */
import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { StyleSheet, Text, TouchableOpacity, View } from 'react-native'
import { useNavigation } from '@react-navigation/native'
import type { NativeStackNavigationProp } from '@react-navigation/native-stack'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { fetchApi, getAgents } from '@ihui/api-client'
import { showHostToast } from '@ihui/shared/utils/host-toast'
import {
  BackChevron,
  CommunityHomeScreen,
  getTokens,
  type CommunityHomeAgent,
  type CommunityHomeBanner,
  type CommunityHomeCategory,
  type CommunityHomeLabels,
} from '@ihui/rn-app'
import { apiFailureToText } from '@ihui/shared/utils'
import { rnSpacing, rnType } from '@ihui/design-tokens'
import { useI18n } from '../i18n'
import { useTheme } from '../context/ThemeContext'
import { WEB_BASE_URL } from '../lib/config'
import type { RootStackParamList } from '../navigation/RootNavigator'

type NavigationProp = NativeStackNavigationProp<RootStackParamList>

type AgentRow = {
  id?: string
  agentId?: string
  name?: string
  avatar?: string | null
  description?: string | null
  desc?: string | null
}

type CategoryRow = {
  categoryId?: string
  id?: string
  name?: string
  icon?: string
  url?: string
}

type BannerRow = {
  id?: string | number
  title?: string
  description?: string
  image?: string
  imageUrl?: string
  cover?: string
  link?: string
  linkUrl?: string
  url?: string
}

type RecentRow = {
  agentId?: string
  id?: string
  name?: string
  avatar?: string
}

type MyAgentRow = {
  agentId?: string
  id?: string
  name?: string
  avatar?: string
  description?: string
}

function listOf<T>(payload: unknown): T[] {
  if (Array.isArray(payload)) return payload as T[]
  if (payload && typeof payload === 'object') {
    const bag = payload as Record<string, unknown>
    if (Array.isArray(bag.list)) return bag.list as T[]
  }
  return []
}

function toAgent(row: AgentRow): CommunityHomeAgent | null {
  const id = row.agentId || row.id
  if (!id) return null
  return {
    id,
    name: row.name || '',
    avatar: row.avatar || undefined,
    description: row.description || row.desc || undefined,
  }
}

export function CommunityScreen() {
  const { resolvedTheme } = useTheme()
  const { t } = useI18n()
  const navigation = useNavigation<NavigationProp>()
  const insets = useSafeAreaInsets()
  const tk = getTokens(resolvedTheme)

  const [keyword, setKeyword] = useState('')
  const [debounced, setDebounced] = useState('')
  const [categories, setCategories] = useState<CommunityHomeCategory[]>([])
  const [banners, setBanners] = useState<CommunityHomeBanner[]>([])
  const [recent, setRecent] = useState<CommunityHomeAgent[]>([])
  const [myAgents, setMyAgents] = useState<CommunityHomeAgent[]>([])
  const [recommended, setRecommended] = useState<CommunityHomeAgent[]>([])
  const [recommendedLoading, setRecommendedLoading] = useState(true)
  const [error, setError] = useState('')
  const bannerLinks = useRef<Record<string, string>>({})

  const labels: CommunityHomeLabels = useMemo(
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
    }),
    [t],
  )

  useEffect(() => {
    const timer = setTimeout(() => setDebounced(keyword.trim()), 300)
    return () => clearTimeout(timer)
  }, [keyword])

  const loadStatic = useCallback(async () => {
    const [categoryRes, bannerRes, recentRes, myRes] = await Promise.allSettled([
      fetchApi<unknown>('/api/categories/list?page=1&pageSize=100&status=1'),
      fetchApi<unknown>('/api/content/banner/list?position=home&status=1'),
      fetchApi<unknown>('/api/agents/use-history'),
      fetchApi<unknown>('/api/agents/my?pageSize=100'),
    ])

    if (categoryRes.status === 'fulfilled' && categoryRes.value.success) {
      setCategories(
        listOf<CategoryRow>(categoryRes.value.data)
          .map((row, index) => {
            const id = row.categoryId || row.id || String(index)
            return {
              id,
              name: row.name || '',
              icon: row.icon || row.url || undefined,
            }
          })
          .filter((row) => row.name)
          .slice(0, 12),
      )
    }

    if (bannerRes.status === 'fulfilled' && bannerRes.value.success) {
      const links: Record<string, string> = {}
      const next = listOf<BannerRow>(bannerRes.value.data)
        .map((row, index) => {
          const id = String(row.id ?? index)
          const link = row.linkUrl || row.link || row.url || ''
          if (link) links[id] = link
          return {
            id,
            title: row.title || undefined,
            description: row.description || undefined,
            image: row.image || row.imageUrl || row.cover || undefined,
          }
        })
        .filter((row) => row.image)
        .slice(0, 6)
      bannerLinks.current = links
      setBanners(next)
    }

    if (recentRes.status === 'fulfilled' && recentRes.value.success) {
      setRecent(
        listOf<RecentRow>(recentRes.value.data)
          .map((row): CommunityHomeAgent | null => {
            const id = row.agentId || row.id
            if (!id) return null
            return { id, name: row.name || '', avatar: row.avatar || undefined }
          })
          .filter((row): row is CommunityHomeAgent => row !== null)
          .slice(0, 8),
      )
    }

    if (myRes.status === 'fulfilled' && myRes.value.success) {
      setMyAgents(
        listOf<MyAgentRow>(myRes.value.data)
          .map((row): CommunityHomeAgent | null => {
            const id = row.agentId || row.id
            if (!id) return null
            return {
              id,
              name: row.name || '',
              avatar: row.avatar || undefined,
              description: row.description || undefined,
            }
          })
          .filter((row): row is CommunityHomeAgent => row !== null)
          .slice(0, 8),
      )
    }
  }, [])

  const loadAgents = useCallback(
    async (value: string) => {
      setRecommendedLoading(true)
      try {
        const res = await getAgents({
          page: 1,
          pageSize: 12,
          status: 'published',
          keyword: value || undefined,
        })
        if (!res.success) {
          setError(apiFailureToText(res, t('agentMarket.loadFailed')))
          setRecommended([])
          return
        }
        setError('')
        setRecommended(
          (res.data?.list ?? [])
            .map(toAgent)
            .filter((row): row is CommunityHomeAgent => Boolean(row))
            .slice(0, 12),
        )
      } catch {
        setError(t('agentMarket.loadFailed'))
        setRecommended([])
      } finally {
        setRecommendedLoading(false)
      }
    },
    [t],
  )

  useEffect(() => {
    void loadStatic()
  }, [loadStatic])

  useEffect(() => {
    void loadAgents(debounced)
  }, [debounced, loadAgents])

  const goBack = () => {
    if (navigation.canGoBack()) navigation.goBack()
    else navigation.navigate('Main', { screen: 'HomeMain' })
  }

  const openWeb = (path: string, title: string) => {
    const url = path.startsWith('http') ? path : `${WEB_BASE_URL}${path}`
    navigation.navigate('WebView', { url, title })
  }

  return (
    <View style={[styles.shell, { backgroundColor: tk.surface.bg, paddingTop: insets.top }]}>
      <View style={styles.navBar}>
        <BackChevron colorScheme={resolvedTheme} onPress={goBack} label={labels.title} />
      </View>
      {error ? (
        <View style={styles.errorBar}>
          <Text style={[styles.errorText, { color: tk.text.secondary }]}>{error}</Text>
          <TouchableOpacity onPress={() => void loadAgents(debounced)} accessibilityRole="button">
            <Text style={[styles.retry, { color: tk.text.primary }]}>{t('common.retry')}</Text>
          </TouchableOpacity>
        </View>
      ) : null}
      <CommunityHomeScreen
        labels={labels}
        colorScheme={resolvedTheme}
        keyword={keyword}
        onKeywordChange={setKeyword}
        onSearch={() => void loadAgents(keyword)}
        banners={banners}
        categories={categories}
        recent={recent}
        myAgents={myAgents}
        recommended={recommended}
        recommendedLoading={recommendedLoading}
        onPressBanner={(banner) => {
          const link = bannerLinks.current[banner.id]
          if (link) openWeb(link, banner.title || labels.banners)
        }}
        onPressCategory={(category) =>
          navigation.navigate('CategoryDetail', {
            categoryId: category.id,
            title: category.name,
          })
        }
        onPressRecent={(agent) => navigation.navigate('AgentDetail', { id: agent.id })}
        onPressMyAgent={(agent) => navigation.navigate('AgentDetail', { id: agent.id })}
        onPressRecommended={(agent) => navigation.navigate('AgentDetail', { id: agent.id })}
        onPressPosts={() => navigation.navigate('PlazaNew')}
        onPressMore={() => navigation.navigate('AgentMarket')}
        onVoiceHint={() => showHostToast(labels.voiceHint, { kind: 'info' })}
        onImageHint={() => showHostToast(labels.imageHint, { kind: 'info' })}
      />
    </View>
  )
}

const styles = StyleSheet.create({
  shell: { flex: 1 },
  navBar: {
    height: 40,
    paddingHorizontal: rnSpacing.md,
    justifyContent: 'center',
    alignItems: 'flex-start',
  },
  errorBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: rnSpacing.md,
    paddingBottom: rnSpacing.sm,
  },
  errorText: { flex: 1, fontSize: rnType.body.size, marginRight: rnSpacing.sm },
  retry: { fontSize: rnType.body.size, fontWeight: '600' },
})
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
