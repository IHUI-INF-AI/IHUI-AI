import { useState } from 'react'
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native'
import { AboutScreen, ProfileScreen, SettingsScreen } from '@ihui/app'

type Tab = 'about' | 'profile' | 'settings'

/**
 * SharedDemoScreen — RN 端共享组件集成验证页。
 *
 * 引用 packages/app 的 3 个共享组件,导航统一走 Solito TextLink(href="/"),
 * 与 web 端一致;本屏只负责 tab 切换 UI + 业务回调注入。
 */
export function SharedDemoScreen() {
  const [tab, setTab] = useState<Tab>('about')

  return (
    <View style={styles.container}>
      <View style={styles.tabs}>
        <TouchableOpacity
          style={[styles.tab, tab === 'about' && styles.tabActive]}
          onPress={() => setTab('about')}
        >
          <Text style={styles.tabText}>关于</Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.tab, tab === 'profile' && styles.tabActive]}
          onPress={() => setTab('profile')}
        >
          <Text style={styles.tabText}>资料</Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.tab, tab === 'settings' && styles.tabActive]}
          onPress={() => setTab('settings')}
        >
          <Text style={styles.tabText}>设置</Text>
        </TouchableOpacity>
      </View>
      {tab === 'about' && <AboutScreen />}
      {tab === 'profile' && (
        <ProfileScreen
          name="李思涵"
          email="lisihan@ihui.ai"
          phone="186****9808"
          onSave={(data) => console.log('ProfileScreen save:', data)}
        />
      )}
      {tab === 'settings' && (
        <SettingsScreen
          notificationsEnabled
          darkModeEnabled={false}
          language="简体中文"
          onToggleNotifications={(enabled) => console.log('notifications:', enabled)}
          onToggleDarkMode={(enabled) => console.log('darkMode:', enabled)}
          onPressLanguage={() => console.log('language pressed')}
        />
      )}
    </View>
  )
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  tabs: {
    flexDirection: 'row',
    padding: 8,
    gap: 8,
  },
  tab: {
    paddingVertical: 8,
    paddingHorizontal: 16,
    borderRadius: 8,
    backgroundColor: '#F3F4F6',
  },
  tabActive: {
    backgroundColor: '#10B981',
  },
  tabText: {
    fontSize: 14,
    fontWeight: '500',
    color: '#374151',
  },
})
