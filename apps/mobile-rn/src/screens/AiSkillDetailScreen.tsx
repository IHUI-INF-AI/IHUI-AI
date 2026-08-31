// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

import { useCallback, useEffect, useState } from 'react'
import { ScrollView, Text, TouchableOpacity, View } from 'react-native'
import { useNavigation, useRoute, type RouteProp } from '@react-navigation/native'
import type { NativeStackNavigationProp } from '@react-navigation/native-stack'
import { getAiSkill, type AiSkillMeta } from '@ihui/api-client'
import { useI18n } from '../i18n'
import { useTheme } from '../context/ThemeContext'
import type { RootStackParamList } from '../navigation/RootNavigator'

type NavigationProp = NativeStackNavigationProp<RootStackParamList>
type RouteProps = RouteProp<RootStackParamList, 'AiSkillDetail'>

/**
 * AI 技能详情(M3 补齐:展示 prompt 模板与来源信息)
 */
export function AiSkillDetailScreen() {
  const { t } = useI18n()
  const { resolvedTheme } = useTheme()
  const navigation = useNavigation<NavigationProp>()
  const route = useRoute<RouteProps>()
  const [skill, setSkill] = useState<AiSkillMeta | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  const load = useCallback(async () => {
    setError('')
    try {
      const res = await getAiSkill(route.params.id)
      if (!res.success) throw new Error()
      setSkill(res.data)
    } catch {
      setError(t('aiSkillDetail.loadFailed'))
    } finally {
      setLoading(false)
    }
  }, [route.params.id, t])

  useEffect(() => {
    void load()
  }, [load])

  const dark = resolvedTheme === 'dark'

  if (loading) {
    return (
      <View className={`flex-1 items-center justify-center ${dark ? 'bg-neutral-900' : 'bg-white'}`}>
        <Text className="text-gray-500">{t('common.loading')}</Text>
      </View>
    )
  }

  return (
    <View className={`flex-1 ${dark ? 'bg-neutral-900' : 'bg-white'}`}>
      <View className="flex-row items-center justify-between px-4 pb-2 pt-3">
        <TouchableOpacity onPress={() => navigation.goBack()} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
          <Text className="text-sm text-gray-500">{t('common.back')}</Text>
        </TouchableOpacity>
        <Text className="max-w-[60%] truncate text-base font-medium">{route.params.name}</Text>
        <View className="w-10" />
      </View>

      <ScrollView className="flex-1 px-4 pt-2">
        {error ? (
          <View className="items-center py-16">
            <Text className="text-center text-sm text-gray-500">{error}</Text>
            <TouchableOpacity
              onPress={() => {
                setLoading(true)
                void load()
              }}
              className="mt-3 rounded-md bg-gray-200 px-4 py-2"
            >
              <Text className="text-sm">{t('aiSkillDetail.retry')}</Text>
            </TouchableOpacity>
          </View>
        ) : skill ? (
          <>
            <Text className={`text-sm leading-6 ${dark ? 'text-gray-300' : 'text-gray-600'}`}>
              {skill.description}
            </Text>
            <View className="mt-3 flex-row flex-wrap gap-1.5">
              <Text className="rounded-sm bg-gray-100 px-2 py-1 text-xs text-gray-500 dark:bg-neutral-700">
                {skill.category}
              </Text>
              {skill.tags.map((tag) => (
                <Text key={tag} className="rounded-sm bg-blue-50 px-2 py-1 text-xs text-blue-600 dark:bg-neutral-700 dark:text-blue-300">
                  {tag}
                </Text>
              ))}
            </View>

            <Text className={`mb-2 mt-5 text-sm font-medium ${dark ? 'text-gray-300' : 'text-gray-700'}`}>
              {t('aiSkillDetail.prompt')}
            </Text>
            <View className={`rounded-lg border p-3 ${dark ? 'border-neutral-700 bg-neutral-800' : 'border-gray-200 bg-gray-50'}`}>
              <Text className={`text-sm leading-6 ${dark ? 'text-gray-300' : 'text-gray-700'}`}>
                {skill.promptTemplate || t('aiSkillDetail.noPrompt')}
              </Text>
            </View>

            <Text className={`mb-2 mt-5 text-sm font-medium ${dark ? 'text-gray-300' : 'text-gray-700'}`}>
              {t('aiSkillDetail.source')}
            </Text>
            <Text className={`text-sm ${dark ? 'text-gray-400' : 'text-gray-600'}`}>
              {skill.source} {skill.sourceUrl ? `· ${skill.sourceUrl}` : ''}
            </Text>
          </>
        ) : null}
      </ScrollView>
    </View>
  )
}
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
