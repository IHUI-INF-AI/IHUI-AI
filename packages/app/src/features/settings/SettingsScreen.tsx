import { useState } from 'react'
import { View, Text, Switch, TouchableOpacity, StyleSheet } from 'react-native'
import { TextLink } from 'solito/link'

interface SettingsScreenProps {
  /** 通知开关初始状态 */
  notificationsEnabled: boolean
  /** 深色模式开关初始状态 */
  darkModeEnabled: boolean
  /** 当前语言展示文本(如"简体中文"、"English") */
  language: string
  /**
   * 返回回调。
   * web 端可传入 Next.js router.push('/'),
   * RN 端可传入 navigation.goBack()。
   * 不传则不显示返回按钮。
   */
  onBack?: () => void
  /** 通知开关切换回调,传入新的开关状态 */
  onToggleNotifications?: (enabled: boolean) => void
  /** 深色模式开关切换回调,传入新的开关状态 */
  onToggleDarkMode?: (enabled: boolean) => void
  /** 语言选择点击回调(由平台注入语言选择器,如 ActionSheet / Modal / 路由跳转) */
  onPressLanguage?: () => void
}

/**
 * SettingsScreen — 设置共享页面。
 *
 * 展示通知开关、深色模式开关、语言选择项(列表式布局)。
 * 用 react-native primitives(View/Text/Switch/TouchableOpacity/StyleSheet),
 * web 端通过 react-native-web 渲染,RN 端原生渲染。
 * 导航与设置变更通过回调注入,实现平台解耦。
 */
export function SettingsScreen({
  notificationsEnabled,
  darkModeEnabled,
  language,
  onBack,
  onToggleNotifications,
  onToggleDarkMode,
  onPressLanguage,
}: SettingsScreenProps) {
  const [notifications, setNotifications] = useState(notificationsEnabled)
  const [darkMode, setDarkMode] = useState(darkModeEnabled)

  const handleToggleNotifications = (value: boolean) => {
    setNotifications(value)
    onToggleNotifications?.(value)
  }

  const handleToggleDarkMode = (value: boolean) => {
    setDarkMode(value)
    onToggleDarkMode?.(value)
  }

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        {onBack ? (
          <TouchableOpacity style={styles.backButton} onPress={onBack}>
            <Text style={styles.backButtonText}>← 返回</Text>
          </TouchableOpacity>
        ) : (
          <TextLink href="/" textProps={{ style: styles.backButtonText }}>
            ← 返回
          </TextLink>
        )}
        <Text style={styles.title}>设置</Text>
      </View>

      <View style={styles.section}>
        <Text style={styles.sectionTitle}>通用</Text>

        <View style={styles.row}>
          <View style={styles.rowText}>
            <Text style={styles.rowTitle}>通知</Text>
            <Text style={styles.rowDescription}>接收消息与活动通知</Text>
          </View>
          <Switch
            value={notifications}
            onValueChange={handleToggleNotifications}
            trackColor={{ false: '#D1D5DB', true: '#10B981' }}
            thumbColor="#FFFFFF"
          />
        </View>

        <View style={styles.row}>
          <View style={styles.rowText}>
            <Text style={styles.rowTitle}>深色模式</Text>
            <Text style={styles.rowDescription}>切换深色主题外观</Text>
          </View>
          <Switch
            value={darkMode}
            onValueChange={handleToggleDarkMode}
            trackColor={{ false: '#D1D5DB', true: '#10B981' }}
            thumbColor="#FFFFFF"
          />
        </View>

        <TouchableOpacity
          style={styles.row}
          onPress={onPressLanguage}
          disabled={!onPressLanguage}
        >
          <View style={styles.rowText}>
            <Text style={styles.rowTitle}>语言</Text>
            <Text style={styles.rowDescription}>选择界面显示语言</Text>
          </View>
          <View style={styles.languageValue}>
            <Text style={styles.languageText}>{language}</Text>
            <Text style={styles.chevron}>›</Text>
          </View>
        </TouchableOpacity>
      </View>
    </View>
  )
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    padding: 20,
    gap: 16,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  backButton: {
    paddingVertical: 6,
    paddingHorizontal: 10,
    borderRadius: 8,
    backgroundColor: '#F3F4F6',
  },
  backButtonText: {
    fontSize: 14,
    color: '#374151',
    fontWeight: '500',
  },
  title: {
    fontSize: 24,
    fontWeight: '700',
    color: '#111827',
  },
  section: {
    gap: 2,
  },
  sectionTitle: {
    fontSize: 13,
    fontWeight: '600',
    color: '#6B7280',
    textTransform: 'uppercase',
    marginBottom: 8,
    letterSpacing: 0.5,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 14,
    paddingHorizontal: 16,
    backgroundColor: '#F9FAFB',
    borderRadius: 8,
    marginBottom: 2,
  },
  rowText: {
    flex: 1,
    gap: 2,
    marginRight: 12,
  },
  rowTitle: {
    fontSize: 15,
    fontWeight: '500',
    color: '#111827',
  },
  rowDescription: {
    fontSize: 13,
    color: '#6B7280',
  },
  languageValue: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  languageText: {
    fontSize: 15,
    color: '#374151',
  },
  chevron: {
    fontSize: 20,
    color: '#9CA3AF',
    lineHeight: 22,
  },
})
