// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * LiveScreen 直播列表页(mobile-rn 端 wrapper)
 *
 * 对齐历史项目 pagesA/live-streaming/index.vue 直播列表:
 * - 直播列表由共享组件 SharedLiveScreen 承载
 * - 入口:首页 onNavigateLives → Main LiveMain
 * - 直播非原项目 5 主 Tab:底部 TabBar 常驻无高亮,可切换主 Tab(对齐原内容页底部导航)
 */
import { useEffect, useState } from 'react'
import { StyleSheet, View, type ViewStyle } from 'react-native'
import { useNavigation } from '@react-navigation/native'
import type { NativeStackNavigationProp } from '@react-navigation/native-stack'
import { getLiveList, type Live } from '@ihui/api-client'
import { LiveScreen as SharedLiveScreen, type LiveScreenItem } from '@ihui/rn-app'
import TabBar, { type TabBarKey } from '../components/TabBar'
import { useI18n } from '../i18n'
import type { RootStackParamList } from '../navigation/RootNavigator'
import type { MainStackParamList } from '../navigation/tab-utils'

type NavigationProp = NativeStackNavigationProp<MainStackParamList, 'LiveMain'>
type RootNav = NativeStackNavigationProp<RootStackParamList>

export function LiveScreen() {
  const { t } = useI18n()
  const navigation = useNavigation<NavigationProp>()
  const rootNav = navigation.getParent<RootNav>()
  const [lives, setLives] = useState<Live[]>([])
  const [loading, setLoading] = useState(true)
  const [refreshing, setRefreshing] = useState(false)
  const [error, setError] = useState('')

  const load = async (refresh = false) => {
    if (refresh) setRefreshing(true)
    else setLoading(true)
    setError('')
    try {
      const res = await getLiveList({ page: 1, pageSize: 20 })
      if (res.success) {
        setLives(res.data.list)
      } else {
        setError(res.error || t('live.loadFailed'))
      }
    } catch {
      // 接口抛错(网络异常等)不阻塞页面,走错误态提示
      setError(t('live.loadFailed'))
    } finally {
      setLoading(false)
      setRefreshing(false)
    }
  }

  useEffect(() => {
    void load()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const items: LiveScreenItem[] = lives.map((live) => ({
    id: live.id,
    title: live.title,
    lecturerName: live.lecturerName ?? undefined,
    isLive: live.isLive,
    startTime: live.startTime,
    viewCount: live.viewCount,
  }))

  /** 底部 Tab 切换(直播非主 Tab,TabBar 常驻供切换) */
  const handleTabChange = (key: TabBarKey): void => {
    switch (key) {
      case 'aiShop':
        navigation.navigate('AiMain')
        break
      case 'home':
        navigation.navigate('HomeMain')
        break
      case 'mine':
        navigation.navigate('ProfileMain')
        break
      case 'plaza':
        rootNav?.navigate('Plaza')
        break
      case 'news':
        rootNav?.navigate('News')
        break
    }
  }

  return (
    <View style={styles.shell}>
      <View style={styles.body}>
        <SharedLiveScreen
          t={t}
          items={items}
          loading={loading}
          refreshing={refreshing}
          error={error}
          onRefresh={() => load(true)}
          onPressItem={(id) => rootNav?.navigate('LiveDetail', { id })}
          onBack={() => navigation.goBack()}
        />
      </View>
      {/* 底部导航(直播非主 Tab,TabBar 常驻无高亮) */}
      <TabBar onChange={handleTabChange} />
    </View>
  )
}

const styles = StyleSheet.create({
  shell: {
    flex: 1,
  } as ViewStyle,
  body: {
    flex: 1,
  } as ViewStyle,
})
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
