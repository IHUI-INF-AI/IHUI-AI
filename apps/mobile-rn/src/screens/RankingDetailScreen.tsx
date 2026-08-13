/**
 * RankingDetailScreen 排行榜详情 (mobile-rn 端)
 *
 * 1:1 复刻历史 Uniapp ranking-detail.vue(详情卡片 + 侧边历史抽屉):
 * - NavBar + 详情卡片(Logo + 标题 + 排名 + 机构 + 关注度 + 简介)
 * - 侧边 Drawer(复用现有 Drawer.tsx),显示历史排行榜列表(映射为会话项)
 * - getRankingDetail API 不存在,使用 mock 数据(详情 + 历史榜单)
 * 路由参数:{ id: string }
 * 类型零 any;颜色走 rnLightTokens;圆角仅 12/8/6;无分割线。
 */
import { useState } from 'react'
import { Alert, Image, ScrollView, StyleSheet, Text, View } from 'react-native'
import { useNavigation, useRoute, type RouteProp } from '@react-navigation/native'
import type { NativeStackNavigationProp } from '@react-navigation/native-stack'
import { rnLightTokens as tokens } from '@ihui/design-tokens'
import { NavBar } from '../components/NavBar'
import Drawer, { type DrawerConversationItem, type DrawerExtraMenu, type DrawerTab } from '../components/Drawer'
import type { RootStackParamList } from '../navigation/RootNavigator'

type RankingDetailParams = {
  RankingDetail: { id: string }
}
type Route = RouteProp<RankingDetailParams, 'RankingDetail'>
type NavigationProp = NativeStackNavigationProp<RootStackParamList>

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

const TAB_MAP: Record<DrawerTab, string> = {
  home: 'home',
  ai: 'ai',
  square: 'home',
  share: 'home',
  mine: 'mine',
}

export default function RankingDetailScreen() {
  const route = useRoute<Route>()
  const navigation = useNavigation<NavigationProp>()
  const { id } = route.params
  const [drawerVisible, setDrawerVisible] = useState(false)
  const [history, setHistory] = useState<DrawerConversationItem[]>(MOCK_HISTORY)

  const openDrawer = () => setDrawerVisible(true)
  const closeDrawer = () => setDrawerVisible(false)

  const onNavigate = (tab: DrawerTab) => {
    navigation.navigate('Tabs', { screen: TAB_MAP[tab] } as never)
  }
  const onNavigateCompany = () => {
    closeDrawer()
    navigation.navigate('Settings')
  }
  const onClaimFree = () => Alert.alert('领取免费资料', '功能即将上线,敬请期待')
  const onCreateNewChat = () => {
    closeDrawer()
    navigation.navigate('Tabs', { screen: 'ai' } as never)
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
  const onGoHome = () => navigation.navigate('Tabs', { screen: 'home' } as never)

  return (
    <View style={styles.container}>
      <NavBar
        title={MOCK_DETAIL.title}
        onBack={() => navigation.goBack()}
        rightActions={[{ icon: '☰', label: '历史榜单', onPress: openDrawer }]}
      />
      <ScrollView style={styles.scroll} contentContainerStyle={styles.scrollContent}>
        <View style={styles.card}>
          <View style={styles.row1}>
            {MOCK_DETAIL.avatar ? (
              <Image source={{ uri: MOCK_DETAIL.avatar }} style={styles.logo} />
            ) : (
              <View style={[styles.logo, styles.logoFallback]}>
                <Text style={styles.logoText}>{MOCK_DETAIL.title.slice(0, 1)}</Text>
              </View>
            )}
            <View style={styles.titleDesc}>
              <Text style={styles.title} numberOfLines={1}>{MOCK_DETAIL.title}</Text>
              <Text style={styles.desc}>
                {`排名:${MOCK_DETAIL.rank} · 机构:${MOCK_DETAIL.organization} · 关注度:${MOCK_DETAIL.attention} (#${id})`}
              </Text>
            </View>
          </View>
          <View style={styles.row2}>
            <Metric label="关注度" value={String(MOCK_DETAIL.attention)} />
            <Metric label="排名" value={`第${MOCK_DETAIL.rank}名`} />
            <Metric label="机构" value={MOCK_DETAIL.organization} />
          </View>
          {MOCK_DETAIL.context ? (
            <View style={styles.contextBox}>
              <Text style={styles.contextText}>{MOCK_DETAIL.context}</Text>
            </View>
          ) : null}
        </View>
      </ScrollView>
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

function Metric({ label, value }: { label: string; value: string }) {
  return (
    <View style={styles.metric}>
      <Text style={styles.metricLabel}>{label}</Text>
      <Text style={styles.metricValue} numberOfLines={1}>{value}</Text>
    </View>
  )
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: tokens.surface.bg },
  scroll: { flex: 1 },
  scrollContent: { padding: 16 },
  card: { backgroundColor: tokens.surface.light, borderRadius: 12, padding: 16, gap: 16 },
  row1: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  logo: { width: 64, height: 64, borderRadius: 12, backgroundColor: tokens.surface.muted },
  logoFallback: { alignItems: 'center', justifyContent: 'center' },
  logoText: { fontSize: 24, fontWeight: '700', color: tokens.text.primary },
  titleDesc: { flex: 1, gap: 6 },
  title: { fontSize: 16, fontWeight: '700', color: tokens.text.primary },
  desc: { fontSize: 12, color: tokens.text.secondary, lineHeight: 18 },
  row2: { flexDirection: 'row', gap: 8 },
  metric: {
    flex: 1,
    backgroundColor: tokens.surface.muted,
    borderRadius: 8,
    paddingVertical: 10,
    alignItems: 'center',
    gap: 4,
  },
  metricLabel: { fontSize: 11, color: tokens.text.tertiary },
  metricValue: { fontSize: 13, fontWeight: '600', color: tokens.text.primary },
  contextBox: { backgroundColor: tokens.surface.muted, borderRadius: 8, padding: 12 },
  contextText: { fontSize: 13, color: tokens.text.medium, lineHeight: 20 },
})
