// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
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
import { Alert, StyleSheet, View } from 'react-native'
import { useNavigation, useRoute, type RouteProp } from '@react-navigation/native'
import type { NativeStackNavigationProp } from '@react-navigation/native-stack'
import { listConversations, type ConversationDetail } from '@ihui/api-client'
import { DRAWER_TAB_TO_RN_TAB, mainScreenForTab } from '../navigation/tab-utils'
import { rnLightTokens as tokens } from '@ihui/design-tokens'
import { RankingDetailScreen } from '@ihui/rn-app'
import { NavBar } from '../components/NavBar'
import Drawer, {
  type DrawerConversationItem,
  type DrawerExtraMenu,
  type DrawerTab,
} from '../components/Drawer'
import type { RootStackParamList } from '../navigation/RootNavigator'
import { useI18n } from '../i18n'
import { Menu } from 'lucide-react-native'

type NavigationProp = NativeStackNavigationProp<RootStackParamList>
type RootNav = NativeStackNavigationProp<RootStackParamList>
type RankingDetailRouteProp = RouteProp<RootStackParamList, 'RankingDetail'>

export default function RankingDetailScreenWrapper() {
  const navigation = useNavigation<NavigationProp>()
  const rootNav = navigation.getParent<RootNav>()
  const route = useRoute<RankingDetailRouteProp>()
  const { item } = route.params
  const { t } = useI18n()
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
        title: c.title || '未命名对话',
        createdAt: c.createdAt ? new Date(c.createdAt).getTime() : Date.now(),
      }))
      setHistory(list)
    } catch {
      setHistory([])
    }
  }, [])

  useEffect(() => {
    void loadHistory()
  }, [loadHistory])

  const openDrawer = () => setDrawerVisible(true)
  const closeDrawer = () => setDrawerVisible(false)

  const onNavigate = (tab: DrawerTab) => {
    rootNav?.navigate('Main', { screen: mainScreenForTab(DRAWER_TAB_TO_RN_TAB[tab]) })
  }
  const onNavigateCompany = () => {
    closeDrawer()
    navigation.navigate('Settings')
  }
  const onClaimFree = () => Alert.alert('领取免费资料', '功能即将上线,敬请期待')
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
    navigation.navigate('MessageChat', { peerId: convId, name: conv?.title ?? '历史会话' })
  }
  const onDeleteConversation = (convId: string) =>
    setHistory((prev) => prev.filter((c) => c.id !== convId))
  const onOpenSettings = () => navigation.navigate('Settings')
  const onOpenMessages = () => navigation.navigate('MessageCenter')
  const onGoHome = () => navigation.navigate('Main', { screen: 'HomeMain' })

  // 详情数据(列表页透传;无 item 时回退零值,不展示伪造内容)
  const detail = item
    ? {
        avatar: item.avatar ?? null,
        title: item.nickname,
        rank: item.rank,
        points: item.points,
        studyHours: item.studyHours,
        level: 0,
      }
    : {
        avatar: null,
        title: '排行榜',
        rank: 0,
        points: 0,
        studyHours: 0,
        level: 0,
      }

  return (
    <View style={styles.container}>
      <NavBar
        title={detail.title}
        onBack={() => navigation.goBack()}
        rightActions={[{ icon: Menu, label: '历史榜单', onPress: openDrawer }]}
      />
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
        colorScheme="light"
      />
      <Drawer
        visible={drawerVisible}
        onClose={closeDrawer}
        user={{ nickname: '排行榜访客' }}
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
