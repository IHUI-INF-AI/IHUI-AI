/**
 * RankingDetailScreen 排行榜详情(mobile-rn 端 wrapper)
 *
 * 保留 RN 特定逻辑(导航/路由/mock 数据/Drawer),UI 委托给 @ihui/rn-app 共享组件。
 */
import { useState } from 'react'
import { Alert, StyleSheet, View } from 'react-native'
import { useNavigation, useRoute, type RouteProp } from '@react-navigation/native'
import type { NativeStackNavigationProp } from '@react-navigation/native-stack'
import { mainScreenForTab } from '../navigation/RootNavigator'
import { rnLightTokens as tokens } from '@ihui/design-tokens'
import { RankingDetailScreen } from '@ihui/rn-app'
import { NavBar } from '../components/NavBar'
import Drawer, { type DrawerConversationItem, type DrawerExtraMenu, type DrawerTab } from '../components/Drawer'
import type { MainTabKey, RootStackParamList } from '../navigation/RootNavigator'

type RankingDetailParams = {
  RankingDetail: { id: string }
}
type Route = RouteProp<RankingDetailParams, 'RankingDetail'>
type NavigationProp = NativeStackNavigationProp<RootStackParamList>
type RootNav = NativeStackNavigationProp<RootStackParamList>

// mock 详情(getRankingDetail API 暂无,真实场景用 route.params.id 请求)
const MOCK_DETAIL = {
  avatar: '',
  title: '智汇AI助手',
  rank: 3,
  organization: '智汇社',
  attention: 1280,
  context: '专注于知识问答与办公提效的通用 AI 助手,支持多轮对话与文档解析。',
}

// mock 历史排行榜列表(映射为 Drawer 会话项)
const MOCK_HISTORY: DrawerConversationItem[] = [
  { id: 'h1', title: '本周榜单 · 通用助手', createdAt: Date.now() },
  { id: 'h2', title: '上周榜单 · 通用助手', createdAt: Date.now() - 86400000 },
  { id: 'h3', title: '本月榜单 · 通用助手', createdAt: Date.now() - 86400000 * 8 },
]

const TAB_MAP: Record<DrawerTab, MainTabKey> = {
  home: 'HomeMain',
  ai: 'AiMain',
  square: 'HomeMain',
  share: 'HomeMain',
  mine: 'ProfileMain',
}

export default function RankingDetailScreenWrapper() {
  const route = useRoute<Route>()
  const navigation = useNavigation<NavigationProp>()
  const rootNav = navigation.getParent<RootNav>()
  const { id } = route.params
  const [drawerVisible, setDrawerVisible] = useState(false)
  const [history, setHistory] = useState<DrawerConversationItem[]>(MOCK_HISTORY)

  const openDrawer = () => setDrawerVisible(true)
  const closeDrawer = () => setDrawerVisible(false)

  const onNavigate = (tab: DrawerTab) => {
    rootNav?.navigate('Main', { screen: mainScreenForTab(TAB_MAP[tab]) })
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
      case 'tools':
        navigation.navigate('Settings')
        break
    }
  }
  const onSelectConversation = (convId: string) => Alert.alert('历史榜单', `查看 ${convId}`)
  const onDeleteConversation = (convId: string) =>
    setHistory((prev) => prev.filter((c) => c.id !== convId))
  const onOpenSettings = () => navigation.navigate('Settings')
  const onOpenMessages = () => navigation.navigate('MessageCenter')
  const onGoHome = () => navigation.navigate('Main', { screen: 'HomeMain' })

  return (
    <View style={styles.container}>
      <NavBar
        title={MOCK_DETAIL.title}
        onBack={() => navigation.goBack()}
        rightActions={[{ icon: '☰', label: '历史榜单', onPress: openDrawer }]}
      />
      <RankingDetailScreen
        t={(key: string) => key}
        onBack={() => navigation.goBack()}
        detail={{
          avatar: MOCK_DETAIL.avatar,
          title: MOCK_DETAIL.title,
          rank: MOCK_DETAIL.rank,
          organization: MOCK_DETAIL.organization,
          attention: MOCK_DETAIL.attention,
          context: MOCK_DETAIL.context,
        }}
        history={history}
        drawerVisible={drawerVisible}
        onDrawerVisibleChange={setDrawerVisible}
        onNavigate={onNavigate}
        onNavigateCompany={onNavigateCompany}
        onClaimFree={onClaimFree}
        onCreateNewChat={onCreateNewChat}
        onNavigateExtra={onNavigateExtra}
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
