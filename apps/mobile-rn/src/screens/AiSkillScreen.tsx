// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

import { useCallback, useEffect, useState } from 'react'
import { Alert, FlatList, Text, TouchableOpacity, View, RefreshControl } from 'react-native'
import { useNavigation } from '@react-navigation/native'
import type { NativeStackNavigationProp } from '@react-navigation/native-stack'
import { listAiSkills, type AiSkillMeta } from '@ihui/api-client'
import { useI18n } from '../i18n'
import { useTheme } from '../context/ThemeContext'
import type { RootStackParamList } from '../navigation/RootNavigator'

type NavigationProp = NativeStackNavigationProp<RootStackParamList>

/**
 * AI 技能市场(M3 补齐:web /ai-skills 在移动端的原生入口)
 * 数据源:listAiSkills('all')
 */
export function AiSkillScreen() {
  const { t } = useI18n()
  const { resolvedTheme } = useTheme()
  const navigation = useNavigation<NavigationProp>()
  const [items, setItems] = useState<AiSkillMeta[]>([])
  const [loading, setLoading] = useState(true)
  const [refreshing, setRefreshing] = useState(false)
  const [error, setError] = useState('')

  const load = useCallback(async () => {
    setError('')
    try {
      const res = await listAiSkills({ category: 'all' })
      if (!res.success) throw new Error()
      setItems(res.data ?? [])
    } catch {
      setError(t('aiSkill.loadFailed'))
    } finally {
      setLoading(false)
      setRefreshing(false)
    }
  }, [t])

  useEffect(() => {
    void load()
  }, [load])

  const onOpen = (skill: AiSkillMeta) => {
    Alert.alert(skill.name, skill.description, [
      { text: t('common.cancel'), style: 'cancel' },
      { text: t('aiSkill.detail'), onPress: () => navigation.navigate('AiSkillDetail', { id: skill.id, name: skill.name }) },
    ])
  }

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
        <Text className="text-base font-medium">{t('aiSkill.title')}</Text>
        <View className="w-10" />
      </View>

      {error ? (
        <View className="flex-1 items-center justify-center px-6">
          <Text className="mb-3 text-center text-sm text-gray-500">{error}</Text>
          <TouchableOpacity
            onPress={() => {
              setLoading(true)
              void load()
            }}
            className="rounded-md bg-gray-200 px-4 py-2"
          >
            <Text className="text-sm">{t('aiSkill.retry')}</Text>
          </TouchableOpacity>
        </View>
      ) : (
        <FlatList
          data={items}
          keyExtractor={(item) => item.id}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); void load() }} />}
          ListEmptyComponent={
            <View className="items-center py-16">
              <Text className="text-sm text-gray-500">{t('aiSkill.empty')}</Text>
            </View>
          }
          contentContainerStyle={{ padding: 16 }}
          renderItem={({ item }) => (
            <TouchableOpacity
              onPress={() => onOpen(item)}
              className={`mb-3 rounded-lg border p-4 ${dark ? 'border-neutral-700 bg-neutral-800' : 'border-gray-200 bg-white'}`}
            >
              <View className="flex-row items-center justify-between">
                <Text className="flex-1 text-base font-medium" numberOfLines={1}>{item.name}</Text>
                <Text className="ml-2 rounded-sm bg-gray-100 px-1.5 py-0.5 text-xs text-gray-500 dark:bg-neutral-700">
                  {item.category}
                </Text>
              </View>
              <Text className={`mt-1 text-sm leading-5 ${dark ? 'text-gray-400' : 'text-gray-600'}`} numberOfLines={2}>
                {item.description}
              </Text>
              {item.tags.length > 0 ? (
                <View className="mt-2 flex-row flex-wrap gap-1.5">
                  {item.tags.slice(0, 4).map((tag) => (
                    <Text key={tag} className="rounded-sm bg-blue-50 px-1.5 py-0.5 text-xs text-blue-600 dark:bg-neutral-700 dark:text-blue-300">
                      {tag}
                    </Text>
                  ))}
                </View>
              ) : null}
            </TouchableOpacity>
          )}
        />
      )}
    </View>
  )
}
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
