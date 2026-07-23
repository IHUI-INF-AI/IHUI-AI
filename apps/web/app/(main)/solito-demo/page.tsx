'use client'

import { useState } from 'react'
import { AboutScreen, ProfileScreen, SettingsScreen } from '@ihui/app'
import type {
  TFunction,
  SharedUser,
  SharedUserStatistics,
  SharedMenuSection,
  SharedLocaleOption,
  SharedThemeOption,
  SharedMenuItem,
  SharedNotificationToggles,
} from '@ihui/app'

/**
 * 共享层生产版 Web 验证页。
 * 引用 packages/app 的 3 个生产级共享组件(AboutScreen / ProfileScreen / SettingsScreen),
 * 用 tab 切换展示,注入 mock 数据 + t fallback 函数 + 回调。
 * 验证 react-native primitives + Solito TextLink 在 web 端(react-native-web)的渲染与交互。
 */

type Tab = 'about' | 'profile' | 'settings'

const TABS: { id: Tab; label: string }[] = [
  { id: 'about', label: '关于' },
  { id: 'profile', label: '个人资料' },
  { id: 'settings', label: '设置' },
]

// t fallback:返回 key 末段作为显示文本(生产 t 未注入时的兜底)
const t: TFunction = (key) => {
  const parts = key.split('.')
  return parts[parts.length - 1] ?? key
}

const MOCK_USER: SharedUser = {
  id: '1',
  nickname: '李思涵',
  avatar: null,
  email: 'lisihan@ihui.ai',
  phone: '186****9808',
}

const MOCK_STATS: SharedUserStatistics = {
  courseCount: 12,
  favoriteCount: 34,
  followingCount: 56,
  fansCount: 78,
  studyHours: 120,
  points: 9800,
}

const MENU_SECTIONS: SharedMenuSection[] = [
  {
    title: '我的学习',
    items: [
      { key: 'courses', label: '我的课程', icon: '📚' },
      { key: 'favorites', label: '我的收藏', icon: '⭐' },
    ],
  },
  {
    title: '我的交易',
    items: [
      { key: 'orders', label: '我的订单', icon: '🧾' },
      { key: 'wallet', label: '我的钱包', icon: '💰' },
    ],
  },
]

const LOCALE_OPTIONS: SharedLocaleOption[] = [
  { value: 'zh-CN', label: '简体中文' },
  { value: 'zh-TW', label: '繁體中文' },
  { value: 'en', label: 'English' },
  { value: 'ja', label: '日本語' },
  { value: 'ko', label: '한국어' },
]

const THEME_OPTIONS: SharedThemeOption[] = [
  { value: 'light', label: '浅色' },
  { value: 'dark', label: '深色' },
  { value: 'system', label: '跟随系统' },
]

const MENU_ITEMS: SharedMenuItem[] = [
  { key: 'about', label: '关于' },
  { key: 'feedback', label: '意见反馈' },
  { key: 'privacy', label: '隐私协议' },
]

const tabButtonStyle = (active: boolean): React.CSSProperties => ({
  padding: '8px 16px',
  borderRadius: '8px',
  border: 'none',
  backgroundColor: active ? '#10B981' : '#F3F4F6',
  color: active ? '#FFFFFF' : '#374151',
  fontSize: '14px',
  fontWeight: 500,
  cursor: 'pointer',
  transition: 'background-color 0.15s ease',
})

export default function SolitoDemoPage() {
  const [activeTab, setActiveTab] = useState<Tab>('about')
  const [locale, setLocale] = useState('zh-CN')
  const [theme, setTheme] = useState('system')
  const [notifications, setNotifications] = useState<SharedNotificationToggles>({
    push: true,
    message: true,
    email: false,
  })

  return (
    <div style={{ minHeight: '100%', backgroundColor: '#FFFFFF' }}>
      <div
        style={{
          display: 'flex',
          gap: '4px',
          padding: '8px 12px',
          backgroundColor: '#F9FAFB',
          position: 'sticky',
          top: 0,
          zIndex: 10,
        }}
      >
        {TABS.map((tab) => (
          <button
            key={tab.id}
            type="button"
            onClick={() => setActiveTab(tab.id)}
            style={tabButtonStyle(activeTab === tab.id)}
          >
            {tab.label}
          </button>
        ))}
      </div>

      <div style={{ maxWidth: '640px', margin: '0 auto' }}>
        {activeTab === 'about' ? (
          <AboutScreen t={t} onBack={() => setActiveTab('profile')} />
        ) : null}
        {activeTab === 'profile' ? (
          <ProfileScreen
            t={t}
            user={MOCK_USER}
            stats={MOCK_STATS}
            orderCount={5}
            menuSections={MENU_SECTIONS}
            onNavigate={(key) => {
              // eslint-disable-next-line no-console
              console.log('[nav]', key)
            }}
            onLogout={() => {
              // eslint-disable-next-line no-console
              console.log('[logout]')
            }}
            onBack={() => setActiveTab('about')}
          />
        ) : null}
        {activeTab === 'settings' ? (
          <SettingsScreen
            t={t}
            user={MOCK_USER}
            locale={locale}
            localeOptions={LOCALE_OPTIONS}
            onSelectLocale={setLocale}
            theme={theme}
            themeOptions={THEME_OPTIONS}
            onSelectTheme={setTheme}
            notifications={notifications}
            onToggleNotification={(k, v) =>
              setNotifications((prev) => ({ ...prev, [k]: v }))
            }
            onChangePassword={async (oldPwd, newPwd) => {
              // eslint-disable-next-line no-console
              console.log('[changePwd]', oldPwd, newPwd)
              return true
            }}
            onAlert={(title, msg) => {
              // eslint-disable-next-line no-console
              console.log('[alert]', title, msg)
            }}
            onConfirm={(_title, _msg, onOk) => onOk()}
            onLogout={() => {
              // eslint-disable-next-line no-console
              console.log('[logout]')
            }}
            menuItems={MENU_ITEMS}
            onMenuPress={(key) => {
              // eslint-disable-next-line no-console
              console.log('[menu]', key)
            }}
            appVersion="1.0.0"
            onBack={() => setActiveTab('about')}
          />
        ) : null}
      </div>
    </div>
  )
}
