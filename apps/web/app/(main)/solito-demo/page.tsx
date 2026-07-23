'use client'

import { useState } from 'react'
import { AboutScreen, ProfileScreen, SettingsScreen } from '@ihui/app'

/**
 * 共享层 PoC 页面。
 * 引用 packages/app 的三个共享组件(AboutScreen / ProfileScreen / SettingsScreen),
 * 均用 react-native primitives 编写,web 端通过 react-native-web 渲染。
 * 用 tab 分段切换展示,验证 RN primitives + Solito TextLink 跨端导航在复杂页面下的扩展性。
 */

type Tab = 'about' | 'profile' | 'settings'

const TABS: { id: Tab; label: string }[] = [
  { id: 'about', label: '关于' },
  { id: 'profile', label: '个人资料' },
  { id: 'settings', label: '设置' },
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

  const handleSave = (data: { name: string; email: string }) => {
    // eslint-disable-next-line no-console
    console.log('[ProfileScreen] save:', data)
  }
  const handleToggleNotifications = (enabled: boolean) => {
    // eslint-disable-next-line no-console
    console.log('[SettingsScreen] notifications:', enabled)
  }
  const handleToggleDarkMode = (enabled: boolean) => {
    // eslint-disable-next-line no-console
    console.log('[SettingsScreen] darkMode:', enabled)
  }
  const handlePressLanguage = () => {
    // eslint-disable-next-line no-console
    console.log('[SettingsScreen] language pressed')
  }

  return (
    <div style={{ minHeight: '100%', backgroundColor: '#FFFFFF' }}>
      <div
        style={{
          display: 'flex',
          gap: '4px',
          padding: '8px 12px',
          borderBottom: '1px solid #E5E7EB',
          position: 'sticky',
          top: 0,
          backgroundColor: '#FFFFFF',
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
        {activeTab === 'about' ? <AboutScreen /> : null}
        {activeTab === 'profile' ? (
          <ProfileScreen
            name="李思涵"
            email="lisihan@example.com"
            phone="+86 138 0000 0000"
            onSave={handleSave}
          />
        ) : null}
        {activeTab === 'settings' ? (
          <SettingsScreen
            notificationsEnabled={true}
            darkModeEnabled={false}
            language="简体中文"
            onToggleNotifications={handleToggleNotifications}
            onToggleDarkMode={handleToggleDarkMode}
            onPressLanguage={handlePressLanguage}
          />
        ) : null}
      </div>
    </div>
  )
}
