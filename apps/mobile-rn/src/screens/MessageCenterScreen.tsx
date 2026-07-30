import { useCallback, useEffect, useState } from 'react'
import { Text, TouchableOpacity, View } from 'react-native'
import { useNavigation } from '@react-navigation/native'
import type { NativeStackNavigationProp } from '@react-navigation/native-stack'
import { fetchApi } from '@ihui/api-client'
import { MessageCenterScreen as SharedMessageCenterScreen } from '@ihui/rn-app'
import type { MessageCenterItem, MessageTab } from '@ihui/rn-app'
import { getRnTokens } from '@ihui/design-tokens'
import { Drawer, type DrawerMenuItem } from '../components/Drawer'
import { NavBar } from '../components/NavBar'
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
  const tokens = getRnTokens(resolvedTheme)
  const [items, setItems] = useState<MessageCenterItem[]>([])
  const [activeTab, setActiveTab] = useState<MessageTab>('system')
  const [loading, setLoading] = useState(true)
  const [refreshing, setRefreshing] = useState(false)
  const [error, setError] = useState('')
  const [drawerVisible, setDrawerVisible] = useState(false)

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

  const drawerMenuItems: DrawerMenuItem[] = [
    { key: 'system', label: '系统消息', icon: '🔔' },
    { key: 'direct', label: '私信', icon: '✉' },
    { key: 'group', label: '群聊', icon: '👥' },
  ]

  const onDrawerItemPress = (key: string) => {
    if (key === 'system' || key === 'direct' || key === 'group') {
      onSelectTab(key as MessageTab)
    }
  }

  return (
    <View style={{ flex: 1 }}>
      <NavBar
        title={t('messageCenter.title')}
        onBack={() => navigation.goBack()}
        rightAction={
          <TouchableOpacity
            onPress={() => setDrawerVisible(true)}
            hitSlop={8}
            accessibilityLabel="消息菜单"
          >
            <Text style={{ fontSize: 22, lineHeight: 24, color: tokens.text.primary }}>{'☰'}</Text>
          </TouchableOpacity>
        }
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
        onBack={() => navigation.goBack()}
        colorScheme={resolvedTheme}
      />
      <Drawer
        visible={drawerVisible}
        onClose={() => setDrawerVisible(false)}
        menuItems={drawerMenuItems}
        onItemPress={onDrawerItemPress}
      />
    </View>
  )
}
