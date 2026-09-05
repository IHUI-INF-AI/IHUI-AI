// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

import { useCallback, useEffect, useState } from 'react'
import { Alert, ScrollView, Text, TouchableOpacity, View } from 'react-native'
import { useNavigation } from '@react-navigation/native'
import type { NativeStackNavigationProp } from '@react-navigation/native-stack'
import { listSpecTemplates, type SpecTemplate } from '@ihui/api-client'
import { useI18n } from '../i18n'
import { useTheme } from '../context/ThemeContext'
import type { RootStackParamList } from '../navigation/RootNavigator'

type NavigationProp = NativeStackNavigationProp<RootStackParamList>

/**
 * 规范模板库(M3 补齐:web /spec 的移动端原生入口)。
 * 数据源:GET /api/spec/templates(ai-service 不可用时后端降级返回内置模板)。
 * 生成流程强依赖服务端 workspace 路径,属桌面/Web 场景——移动端做模板浏览,
 * 生成入口由 M4 WebView 门户承载。
 */
export function SpecScreen() {
  const { t } = useI18n()
  const { resolvedTheme } = useTheme()
  const navigation = useNavigation<NavigationProp>()
  const [templates, setTemplates] = useState<SpecTemplate[]>([])
  const [loading, setLoading] = useState(true)

  const dark = resolvedTheme === 'dark'

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const res = await listSpecTemplates()
      if (!res.success || !res.data) throw new Error(res.error)
      setTemplates(res.data.templates)
    } catch {
      Alert.alert(t('spec.loadFailed'))
    } finally {
      setLoading(false)
    }
  }, [t])

  useEffect(() => {
    void load()
  }, [load])

  return (
    <View className={`flex-1 ${dark ? 'bg-neutral-900' : 'bg-white'}`}>
      <View className="flex-row items-center justify-between px-4 pb-2 pt-3">
        <TouchableOpacity
          onPress={() => navigation.goBack()}
          hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
        >
          <Text className="text-sm text-gray-500">{t('common.back')}</Text>
        </TouchableOpacity>
        <Text className="text-base font-medium">{t('spec.title')}</Text>
        <TouchableOpacity
          onPress={() => void load()}
          hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
        >
          <Text className="text-sm text-blue-600 dark:text-blue-400">{t('common.retry')}</Text>
        </TouchableOpacity>
      </View>

      <View className="mx-4 rounded-md bg-amber-50 px-3 py-2 dark:bg-amber-900/20">
        <Text className="text-xs text-amber-700 dark:text-amber-300">{t('spec.desktopHint')}</Text>
      </View>

      <ScrollView contentContainerStyle={{ padding: 16 }}>
        {loading ? (
          <Text className="mt-8 text-center text-sm text-gray-400">{t('common.loading')}</Text>
        ) : templates.length === 0 ? (
          <Text className="mt-8 text-center text-sm text-gray-400">{t('spec.empty')}</Text>
        ) : (
          <View className="gap-3">
            {templates.map((tpl) => (
              <View
                key={tpl.id}
                className="rounded-lg border border-gray-200 p-3 dark:border-neutral-700"
              >
                <View className="flex-row items-center gap-2">
                  <Text className="text-sm font-medium dark:text-neutral-100">{tpl.name}</Text>
                  <View className="rounded bg-gray-100 px-1.5 py-0.5 dark:bg-neutral-800">
                    <Text className="text-[10px] text-gray-500 dark:text-neutral-400">
                      {tpl.id}
                    </Text>
                  </View>
                </View>
                <Text className="mt-1 text-xs text-gray-500 dark:text-neutral-400">
                  {tpl.description}
                </Text>
                {tpl.sections.length > 0 ? (
                  <View className="mt-2 flex-row flex-wrap gap-1.5">
                    {tpl.sections.map((sec) => (
                      <View
                        key={sec}
                        className="rounded bg-blue-50 px-1.5 py-0.5 dark:bg-blue-900/30"
                      >
                        <Text className="text-[10px] text-blue-600 dark:text-blue-300">{sec}</Text>
                      </View>
                    ))}
                  </View>
                ) : null}
              </View>
            ))}
          </View>
        )}
      </ScrollView>
    </View>
  )
}
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
