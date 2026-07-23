import { useState } from 'react'
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native'
import { AboutScreen, ProfileScreen, SettingsScreen, tokens } from '@ihui/app'
import type {
  SharedMenuSection,
  SharedLocaleOption,
  SharedThemeOption,
  SharedMenuItem,
} from '@ihui/app'
import { useI18n } from '../i18n'

type Tab = 'about' | 'profile' | 'settings'

const MOCK_USER = { id: '1', nickname: '李思涵', avatar: null, email: 'lisihan@ihui.ai', phone: '186****9808' }
const MOCK_STATS = { courseCount: 12, favoriteCount: 34, followingCount: 56, fansCount: 78, studyHours: 120, points: 9800 }

/**
 * SharedDemoScreen — RN 端共享组件集成验证页。
 * 引用 packages/app 的 3 个生产级共享组件,注入 t 函数 + 模拟数据 + 回调。
 */
export function SharedDemoScreen() {
  if (!__DEV__) return null
  const { t } = useI18n()
  const [tab, setTab] = useState<Tab>('about')
  const [locale, setLocale] = useState('zh-CN')
  const [theme, setTheme] = useState('system')
  const [notifications, setNotifications] = useState({ push: true, message: true, email: false })

  const menuSections: SharedMenuSection[] = [
    { title: t('profile.myCourses'), items: [{ key: 'courses', label: t('profile.myCourses'), icon: '📚' }] },
    { title: t('profile.myFavorites'), items: [{ key: 'favorites', label: t('profile.myFavorites'), icon: '⭐' }] },
  ]
  const localeOptions: SharedLocaleOption[] = [
    { value: 'zh-CN', label: t('settings.language') },
    { value: 'en', label: 'English' },
    { value: 'ja', label: '日本語' },
    { value: 'ko', label: '한국어' },
    { value: 'zh-TW', label: '繁體中文' },
  ]
  const themeOptions: SharedThemeOption[] = [
    { value: 'light', label: t('settings.theme') },
    { value: 'dark', label: t('settings.theme') },
    { value: 'system', label: t('settings.theme') },
  ]
  const menuItems: SharedMenuItem[] = [
    { key: 'about', label: t('settings.about') },
    { key: 'feedback', label: t('profile.feedback') },
  ]

  return (
    <View style={styles.container}>
      <View style={styles.tabs}>
        <TouchableOpacity style={[styles.tab, tab === 'about' && styles.tabActive]} onPress={() => setTab('about')}>
          <Text style={styles.tabText}>{t('settings.about')}</Text>
        </TouchableOpacity>
        <TouchableOpacity style={[styles.tab, tab === 'profile' && styles.tabActive]} onPress={() => setTab('profile')}>
          <Text style={styles.tabText}>{t('profile.title')}</Text>
        </TouchableOpacity>
        <TouchableOpacity style={[styles.tab, tab === 'settings' && styles.tabActive]} onPress={() => setTab('settings')}>
          <Text style={styles.tabText}>{t('settings.title')}</Text>
        </TouchableOpacity>
      </View>
      {tab === 'about' && <AboutScreen t={t} onBack={() => setTab('profile')} />}
      {tab === 'profile' && (
        <ProfileScreen
          t={t}
          user={MOCK_USER}
          stats={MOCK_STATS}
          orderCount={5}
          menuSections={menuSections}
          onNavigate={(key) => console.log('nav:', key)}
          onLogout={() => console.log('logout')}
          onBack={() => setTab('about')}
        />
      )}
      {tab === 'settings' && (
        <SettingsScreen
          t={t}
          user={MOCK_USER}
          locale={locale}
          localeOptions={localeOptions}
          onSelectLocale={(l) => setLocale(l)}
          theme={theme}
          themeOptions={themeOptions}
          onSelectTheme={(th) => setTheme(th)}
          notifications={notifications}
          onToggleNotification={(k, v) => setNotifications((prev) => ({ ...prev, [k]: v }))}
          onChangePassword={async (o, n) => {
            console.log('pwd:', o, n)
            return true
          }}
          onAlert={(title, msg) => console.log('alert:', title, msg)}
          onConfirm={(_title, _msg, onOk) => onOk()}
          onLogout={() => console.log('logout')}
          menuItems={menuItems}
          onMenuPress={(key) => console.log('menu:', key)}
          appVersion="1.0.0"
          onBack={() => setTab('about')}
        />
      )}
    </View>
  )
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  tabs: { flexDirection: 'row', padding: 8, gap: 8 },
  tab: { paddingVertical: 8, paddingHorizontal: 16, borderRadius: 8, backgroundColor: tokens.surface.card },
  tabActive: { backgroundColor: tokens.brand.DEFAULT },
  tabText: { fontSize: 14, fontWeight: '500', color: tokens.text.medium },
})
