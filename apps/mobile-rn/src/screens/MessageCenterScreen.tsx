import { useCallback, useEffect, useState } from 'react'
import { View } from 'react-native'
import { useNavigation } from '@react-navigation/native'
import type { NativeStackNavigationProp } from '@react-navigation/native-stack'
import { fetchApi } from '@ihui/api-client'
import { MessageCenterScreen as SharedMessageCenterScreen } from '@ihui/rn-app'
import type { MessageCenterItem, MessageTab } from '@ihui/rn-app'
import { NavBar } from '../components/NavBar'
import NotificationPanel from '../components/NotificationPanel'
import { useNotificationStore } from '../stores/notification'
import { useI18n } from '../i18n'
import { useTheme } from '../context/ThemeContext'
import type { RootStackParamList } from '../navigation/RootNavigator'

type NavigationProp = NativeStackNavigationProp<RootStackParamList>

interface MessagePage {
  list: MessageCenterItem[]
  total: number
}

export function MessageCenterScreen() {
  const { t } = useI18n()
  const { resolvedTheme } = useTheme()
  const navigation = useNavigation<NavigationProp>()
  const { setVisible: setNotificationVisible } = useNotificationStore()
  const [items, setItems] = useState<MessageCenterItem[]>([])
  const [activeTab, setActiveTab] = useState<MessageTab>('system')
  const [loading, setLoading] = useState(true)
  const [refreshing, setRefreshing] = useState(false)
  const [error, setError] = useState('')

  const load = useCallback(async () => {
    setError('')
    try {
      const res = await fetchApi<MessagePage>(`/api/messages?type=${activeTab}`)
      if (!res.success) throw new Error()
      setItems(res.data.list ?? [])
    } catch {
      setError(t('messageCenter.loadFailed'))
    } finally {
      setLoading(false)
      setRefreshing(false)
    }
  }, [activeTab, t])

  useEffect(() => {
    setLoading(true)
    void load()
  }, [load])

  const onSelectTab = (tab: MessageTab) => {
    if (tab !== activeTab) setActiveTab(tab)
  }

  // 点击消息卡片 → 消息详情(MessageDetail 路由在 RootStack,React Navigation 自动向上搜索)
  const onPressItem = (item: MessageCenterItem) => {
    navigation.navigate('MessageDetail', { id: item.id })
  }

  return (
    <View style={{ flex: 1 }}>
      <NavBar
        title={t('messageCenter.title')}
        onBack={() => navigation.goBack()}
        rightActions={[
          { icon: '🔔', label: '通知', onPress: () => setNotificationVisible(true) },
        ]}
      />
      <SharedMessageCenterScreen
        t={t}
        items={items}
        activeTab={activeTab}
        onSelectTab={onSelectTab}
        loading={loading}
        refreshing={refreshing}
        error={error}
        onRefresh={() => {
          setRefreshing(true)
          void load()
        }}
        onPressItem={onPressItem}
        onBack={() => navigation.goBack()}
        colorScheme={resolvedTheme}
      />
      {/* NotificationPanel 推送通知面板(对齐 Uniapp 顶层 PushNotification,组件自管 visible) */}
      <NotificationPanel />
    </View>
  )
}
