// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan)
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * RankingDetailScreen 排行榜详情(mobile-rn 端 wrapper)
 *
 * 保留 RN 特定逻辑(导航/路由/Drawer),UI 委托给 @ihui/rn-app 共享组件。
 * 2026-08-21:对齐原版"列表页透传"模式(Uniapp onLoad options.data),
 * 详情数据由列表页 RankingScreen 传入完整 RankingItem(route.params.item),
 * 历史榜单 Drawer 会话改用真实 listConversations API(替代原 MOCK_HISTORY)。
 */
import { useCallback, useEffect, useState } from 'react'
import { StyleSheet, View } from 'react-native'
import { appAlert } from '../components/BottomPops'
import { useNavigation, useRoute, type RouteProp } from '@react-navigation/native'
import type { NativeStackNavigationProp } from '@react-navigation/native-stack'
import { listConversations, fetchApi, type ConversationDetail } from '@ihui/api-client'
import { navigateDrawerTab } from '../navigation/tab-utils'
import { tokens } from '../theme/active-tokens'
import { useTheme } from '../context/ThemeContext'
import { RankingDetailScreen } from '@ihui/rn-app'
import { NavBar } from '../components/NavBar'
import Drawer, {
  type DrawerConversationItem,
  type DrawerExtraMenu,
  type DrawerTab,
} from '../components/Drawer'
import type { RootStackParamList } from '../navigation/RootNavigator'
import type { RankingItem } from '@ihui/types'
import { useI18n } from '../i18n'
import { FREE_RESOURCE_URL } from '../constants/links'
import Clipboard from '@react-native-clipboard/clipboard'
import { NavChrome } from '../components/NavChrome'
import { PanelLeftRounded } from '../components/PanelLeftRounded'
import { useRefreshOnFocus } from '../hooks'

type NavigationProp = NativeStackNavigationProp<RootStackParamList>
type RootNav = NativeStackNavigationProp<RootStackParamList>
type RankingDetailRouteProp = RouteProp<RootStackParamList, 'RankingDetail'>

/** GET /ranking 列表行的最小取用面(端上返回形状两种都认:数组或 {list}) */
interface RankingListRow {
  id?: string
  userId?: string
  nickname?: string
  avatar?: string | null
  points?: number
  studyHours?: number
  rank?: number
}

export default function RankingDetailScreenWrapper() {
  const navigation = useNavigation<NavigationProp>()
  const rootNav = navigation.getParent<RootNav>()
  const route = useRoute<RankingDetailRouteProp>()
  const { item, id } = route.params
  const { t } = useI18n()
  const { resolvedTheme } = useTheme()
  const [drawerVisible, setDrawerVisible] = useState(false)
  const [history, setHistory] = useState<DrawerConversationItem[]>([])

  // 历史榜单会话:真实对话列表(对齐原版 loadHistoryChat → getModelChat)
  const loadHistory = useCallback(async () => {
    try {
      const res = await listConversations({ page: 1, pageSize: 20 })
      if (!res.success) {
        setHistory([])
        return
      }
      const list = (res.data?.conversations ?? []).map((c: ConversationDetail) => ({
        id: c.id,
        title: c.title || t('plaza.index.untitledConv'),
        createdAt: c.createdAt ? new Date(c.createdAt).getTime() : Date.now(),
        favorited: c.favorite === true,
      }))
      setHistory(list)
    } catch {
      setHistory([])
    }
  }, [t])

  useEffect(() => {
    void loadHistory()
  }, [loadHistory])

  // 回屏即重取(对齐小程序 useDidShow 的每次显示刷新;首次挂载由上面的 useEffect 负责)
  useRefreshOnFocus(loadHistory)

  const openDrawer = () => setDrawerVisible(true)
  const closeDrawer = () => setDrawerVisible(false)

  const onNavigate = (tab: DrawerTab) => {
    navigateDrawerTab(rootNav, tab)
  }
  const onNavigateCompany = () => {
    closeDrawer()
    navigation.navigate('Settings')
  }
  const onClaimFree = () => {
    closeDrawer()
    try {
      Clipboard.setString(FREE_RESOURCE_URL)
      appAlert(t('drawer.claimFree'), t('studyIndex.receiveFreeBody'))
    } catch {
      appAlert(t('drawer.claimFree'), t('profile.copyFailRetry'))
    }
  }
  const onCreateNewChat = () => {
    closeDrawer()
    rootNav?.navigate('Main', { screen: 'AiMain' })
  }
  const onNavigateExtra = (menu: DrawerExtraMenu) => {
    closeDrawer()
    switch (menu) {
      case 'aigc':
        navigation.navigate('AigcList')
        break
      case 'learn':
        navigation.navigate('Learn')
        break
      case 'modelPlaza':
        navigation.navigate('ModelPlaza')
        break
      case 'company':
      case 'assistant':
        navigation?.navigate('Assistant')

        break

      case 'tools':
        navigation.navigate('Settings')
        break
    }
  }
  // 历史榜单会话 → MessageChat(对齐 ChatScreen 会话跳转)
  const onSelectConversation = (convId: string) => {
    closeDrawer()
    const conv = history.find((c) => c.id === convId)
    navigation.navigate('MessageChat', {
      peerId: convId,
      name: conv?.title ?? t('ranking.histFallback'),
    })
  }
  const onDeleteConversation = (convId: string) =>
    setHistory((prev) => prev.filter((c) => c.id !== convId))
  const onOpenSettings = () => navigation.navigate('Settings')
  const onOpenMessages = () => navigation.navigate('MessageCenter')
  const onGoHome = () => navigation.navigate('Main', { screen: 'HomeMain' })

  /**
   * 壳自取数(2026-11-01):route.params 经 rn-compat 只承载标量(item 对象进不了 URL
   * query,此前被 String(v) 拼成 '[object Object]' 打坏整页参数),壳化端只有 id。
   * 后端没有 /api/ranking/:id 详情端点 ⇒ 复用列表页同一数据源 GET /ranking 按 id 找回
   * 本条(昵称/头像/rank 取列表位次);points/studyHours 该数据集不含,取不到维持
   * 零值回退,不伪造(§0.3:取不到不冒绿)。
   */
  const [fetched, setFetched] = useState<RankingItem | null>(null)
  useEffect(() => {
    if (item || !id) return
    let cancelled = false
    void (async () => {
      try {
        const res = await fetchApi<{ list?: RankingListRow[] } | RankingListRow[]>('/ranking')
        if (!res.success || cancelled) return
        const rows = Array.isArray(res.data) ? res.data : (res.data?.list ?? [])
        const idx = rows.findIndex((r) => String(r.id ?? r.userId ?? '') === String(id))
        if (idx < 0) return
        const row = rows[idx] ?? null
        if (!row) return
        setFetched({
          id: String(id),
          rank: row.rank ?? idx + 1,
          nickname: row.nickname ?? t('menu.ranking'),
          avatar: row.avatar ?? null,
          points: row.points ?? 0,
          studyHours: row.studyHours ?? 0,
          isMe: false,
        })
      } catch {
        // 取不到保持零值回退
      }
    })()
    return () => {
      cancelled = true
    }
  }, [id, item, t])

  // 详情数据(RN:列表页透传 item;壳化端:上面按 id 自取;都取不到回退零值,不展示伪造内容)
  const source = item ?? fetched
  const detail = source
    ? {
        avatar: source.avatar ?? null,
        title: source.nickname,
        rank: source.rank,
        points: source.points,
        studyHours: source.studyHours,
        level: 0,
      }
    : {
        avatar: null,
        title: t('menu.ranking'),
        rank: 0,
        points: 0,
        studyHours: 0,
        level: 0,
      }

  return (
    <View style={styles.container}>
      <NavChrome>
        {/* 抽屉触发钮(历史榜单入口,开同一 Drawer):图标与其余各屏同款 PanelLeftRounded;
            「历史榜单」是功能标签(非「菜单」泛称),文字保留,墨迹走 NavBarActionButton 的 text.medium */}
        <NavBar
          title={detail.title}
          onBack={() => navigation.goBack()}
          rightActions={[
            { icon: PanelLeftRounded, label: 'ranking.historyBoard', onPress: openDrawer },
          ]}
        />
      </NavChrome>
      <RankingDetailScreen
        t={t}
        onBack={() => navigation.goBack()}
        detail={detail}
        history={history}
        drawerVisible={drawerVisible}
        onDrawerVisibleChange={setDrawerVisible}
        onNavigate={onNavigate as (tab: string) => void}
        onNavigateCompany={onNavigateCompany}
        onClaimFree={onClaimFree}
        onCreateNewChat={onCreateNewChat}
        onNavigateExtra={onNavigateExtra as (menu: string) => void}
        onSelectConversation={onSelectConversation}
        onDeleteConversation={onDeleteConversation}
        onOpenSettings={onOpenSettings}
        onOpenMessages={onOpenMessages}
        onGoHome={onGoHome}
        colorScheme={resolvedTheme}
      />
      <Drawer
        visible={drawerVisible}
        onClose={closeDrawer}
        user={{ nickname: t('ranking.visitorName') }}
        conversations={history}
        onNavigate={onNavigate}
        onNavigateCompany={onNavigateCompany}
        onClaimFree={onClaimFree}
        onCreateNewChat={onCreateNewChat}
        onSelectConversation={onSelectConversation}
        onDeleteConversation={onDeleteConversation}
        onOpenSettings={onOpenSettings}
        onOpenMessages={onOpenMessages}
        onGoHome={onGoHome}
        onNavigateExtra={onNavigateExtra}
      />
    </View>
  )
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: tokens.surface.bg },
})
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
