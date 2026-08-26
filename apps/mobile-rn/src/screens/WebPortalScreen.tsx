/**
 * Web 功能门户(M4 方案,2026-08-26)
 *
 * 背景:移动端无法原生实现的复杂功能域(edu-ai/教务家长/开发者平台/自媒体/知识图谱/模型管理)
 * 通过本门户按细分 URL 打开 WebViewScreen(替代此前"网页版"整站入口)。
 * 数据源:lib/webview-portal-config.ts 的 WEB_PORTAL_SECTIONS(7 组 47 条)。
 * 平台特有:依赖 RN ScrollView/Pressable,不适合共享。
 */
import { useState } from 'react'
import { Pressable, ScrollView, Text, View } from 'react-native'
import { useNavigation } from '@react-navigation/native'
import type { NativeStackNavigationProp } from '@react-navigation/native-stack'
import { useI18n } from '../i18n'
import { useTheme } from '../context/ThemeContext'
import { NavBar } from '../components/NavBar'
import { WEB_PORTAL_SECTIONS, buildWebUrl, type WebPortalEntry } from '../lib/webview-portal-config'
import type { RootStackParamList } from '../navigation/RootNavigator'

type NavigationProp = NativeStackNavigationProp<RootStackParamList>

/** 展开的分组 titleKey 集合(默认全部展开,便于发现) */
const DEFAULT_EXPANDED: readonly string[] = WEB_PORTAL_SECTIONS.map((s) => s.titleKey)

export function WebPortalScreen() {
  const { t } = useI18n()
  const { resolvedTheme } = useTheme()
  const navigation = useNavigation<NavigationProp>()
  const [expanded, setExpanded] = useState<ReadonlySet<string>>(
    () => new Set(DEFAULT_EXPANDED),
  )

  const toggleSection = (titleKey: string) => {
    setExpanded((prev) => {
      const next = new Set(prev)
      if (next.has(titleKey)) next.delete(titleKey)
      else next.add(titleKey)
      return next
    })
  }

  const openEntry = (entry: WebPortalEntry) => {
    navigation.navigate('WebView', {
      url: buildWebUrl(entry),
      title: t(entry.titleKey),
    })
  }

  const dark = resolvedTheme === 'dark'

  return (
    <View className={`flex-1 ${dark ? 'bg-neutral-900' : 'bg-white'}`}>
      <NavBar title={t('webViewPortal.title')} onBack={() => navigation.goBack()} />
      <ScrollView className="flex-1" contentContainerStyle={{ padding: 12, paddingBottom: 32 }}>
        <Text className={`mb-3 text-[13px] ${dark ? 'text-neutral-400' : 'text-gray-500'}`}>
          {t('webViewPortal.hint')}
        </Text>
        {WEB_PORTAL_SECTIONS.map((section) => {
          const isOpen = expanded.has(section.titleKey)
          return (
            <View key={section.titleKey} className="mb-3">
              <Pressable
                onPress={() => toggleSection(section.titleKey)}
                accessibilityRole="button"
                className={`flex-row items-center justify-between rounded-lg px-4 py-3 ${
                  dark ? 'bg-neutral-800' : 'bg-gray-50'
                }`}
              >
                <Text className={`text-[15px] font-semibold ${dark ? 'text-neutral-100' : 'text-gray-900'}`}>
                  {t(section.titleKey)}
                </Text>
                <Text className={`text-[12px] ${dark ? 'text-neutral-500' : 'text-gray-400'}`}>
                  {isOpen ? '收起 ▴' : '展开 ▾'}（{section.entries.length}）
                </Text>
              </Pressable>
              {isOpen ? (
                <View className="mt-1 gap-1">
                  {section.entries.map((entry) => (
                    <Pressable
                      key={entry.key}
                      onPress={() => openEntry(entry)}
                      accessibilityRole="button"
                      className={`flex-row items-center justify-between rounded-lg px-4 py-2.5 ${
                        dark ? 'bg-neutral-800/60' : 'bg-white'
                      } border ${dark ? 'border-neutral-700' : 'border-gray-200'}`}
                    >
                      <Text className={`flex-1 text-[14px] ${dark ? 'text-neutral-200' : 'text-gray-800'}`}>
                        {t(entry.titleKey)}
                      </Text>
                      <Text className={`ml-2 text-[12px] ${dark ? 'text-neutral-500' : 'text-gray-400'}`}>
                        {entry.path}
                      </Text>
                    </Pressable>
                  ))}
                </View>
              ) : null}
            </View>
          )
        })}
      </ScrollView>
    </View>
  )
}

export default WebPortalScreen
