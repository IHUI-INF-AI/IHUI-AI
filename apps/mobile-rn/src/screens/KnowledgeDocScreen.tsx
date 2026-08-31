// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

import { useCallback, useEffect, useState } from 'react'
import { ScrollView, Text, TouchableOpacity, View } from 'react-native'
import { useNavigation, useRoute, type RouteProp } from '@react-navigation/native'
import type { NativeStackNavigationProp } from '@react-navigation/native-stack'
import { useAuthStore } from '../stores/auth-store'
import { getKnowledgeDoc, getKnowledgeDocChunks } from '@ihui/api-client'
import type { KnowledgeDocDetail, KnowledgeChunkPreview } from '@ihui/api-client'
import { useI18n } from '../i18n'
import { useTheme } from '../context/ThemeContext'
import type { RootStackParamList } from '../navigation/RootNavigator'

type NavigationProp = NativeStackNavigationProp<RootStackParamList>
type RouteProps = RouteProp<RootStackParamList, 'KnowledgeDoc'>

/**
 * 知识库文档详情(M3 补齐:详情 + 切片预览)
 */
export function KnowledgeDocScreen() {
  const { t } = useI18n()
  const { resolvedTheme } = useTheme()
  const navigation = useNavigation<NavigationProp>()
  const route = useRoute<RouteProps>()
  const user = useAuthStore((s) => s.user)
  const [doc, setDoc] = useState<KnowledgeDocDetail | null>(null)
  const [chunks, setChunks] = useState<KnowledgeChunkPreview[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  const load = useCallback(async () => {
    setError('')
    try {
      const detail = await getKnowledgeDoc(route.params.id, user?.id ?? '')
      setDoc(detail)
      try {
        const chunkList = await getKnowledgeDocChunks(route.params.id, user?.id ?? '', 10)
        setChunks(chunkList)
      } catch {
        setChunks([])
      }
    } catch {
      setError(t('knowledgeDoc.loadFailed'))
    } finally {
      setLoading(false)
    }
  }, [route.params.id, user?.id, t])

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
        <Text className="max-w-[60%] truncate text-base font-medium">{route.params.title}</Text>
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
              <Text className="text-sm">{t('knowledgeDoc.retry')}</Text>
            </TouchableOpacity>
          </View>
        ) : doc ? (
          <>
            <Text className={`text-xs ${dark ? 'text-gray-500' : 'text-gray-400'}`}>
              {doc.chunkCount} {t('knowledgeDoc.chunksTotal')}
              {doc.createdAt ? ` · ${String(doc.createdAt).slice(0, 10)}` : ''}
            </Text>
            <Text className={`mt-1 text-xs ${dark ? 'text-gray-500' : 'text-gray-400'}`}>
              {t('knowledgeDoc.source')}: {doc.sourceType}
            </Text>

            <Text className={`mb-2 mt-5 text-sm font-medium ${dark ? 'text-gray-300' : 'text-gray-700'}`}>
              {t('knowledgeDoc.preview')}
            </Text>
            {chunks.length === 0 ? (
              <Text className={`text-sm ${dark ? 'text-gray-500' : 'text-gray-400'}`}>
                {t('knowledgeDoc.noChunks')}
              </Text>
            ) : (
              chunks.map((c) => (
                <View
                  key={c.id}
                  className={`mb-3 rounded-lg border p-3 ${dark ? 'border-neutral-700 bg-neutral-800' : 'border-gray-200 bg-white'}`}
                >
                  <Text className={`text-xs ${dark ? 'text-gray-500' : 'text-gray-400'}`}>
                    #{c.chunkIndex + 1}
                  </Text>
                  <Text className={`mt-1 text-sm leading-6 ${dark ? 'text-gray-200' : 'text-gray-700'}`}>
                    {c.content}
                  </Text>
                </View>
              ))
            )}
          </>
        ) : null}
      </ScrollView>
    </View>
  )
}
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
