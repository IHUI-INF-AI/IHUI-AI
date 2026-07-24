import { useEffect, useState } from 'react'
import { FlatList, Text, TouchableOpacity, View } from 'react-native'
import { useNavigation, useRoute, type RouteProp } from '@react-navigation/native'
import type { NativeStackNavigationProp } from '@react-navigation/native-stack'
import { fetchApi } from '@ihui/api-client'
import { useI18n } from '../i18n'
import type { RootStackParamList } from '../navigation/RootNavigator'
import { Card, Loading } from '@ihui/ui-native'

interface CatalogItem { id: string; title: string; type: string; duration: number; children?: CatalogItem[] }

type Route = RouteProp<RootStackParamList, 'CourseCatalog'>
type NavigationProp = NativeStackNavigationProp<RootStackParamList>

export function CourseCatalogScreen() {
  const { t } = useI18n()
  const route = useRoute<Route>()
  const navigation = useNavigation<NavigationProp>()
  const { courseId } = route.params
  const [catalog, setCatalog] = useState<CatalogItem[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  useEffect(() => {
    let cancelled = false
    void (async () => {
      setLoading(true)
      setError('')
      const res = await fetchApi<CatalogItem[]>(`/api/courses/${encodeURIComponent(courseId)}/catalog`)
      if (cancelled) return
      if (res.success) setCatalog(res.data ?? [])
      else setError(res.error || t('courseCatalog.loadFailed'))
      setLoading(false)
    })()
    return () => { cancelled = true }
  }, [courseId, t])

  if (loading) return (
    <View className="flex-1 items-center justify-center bg-card p-4">
      <Loading />
      <Text className="mt-2 text-[13px] text-muted-foreground">{t('common.loading')}</Text>
    </View>
  )
  if (error) return (
    <View className="flex-1 items-center justify-center bg-card p-4">
      <Text className="mb-2 text-center text-[13px] text-destructive">{error}</Text>
      <TouchableOpacity className="mt-3 rounded-md bg-primary px-4 py-2" onPress={() => navigation.goBack()}>
        <Text className="text-sm text-primary-foreground">{t('common.back')}</Text>
      </TouchableOpacity>
    </View>
  )
  return (
    <View className="flex-1 bg-card px-4 pt-12">
      <TouchableOpacity onPress={() => navigation.goBack()}>
        <Text className="text-sm text-muted-foreground">{t('common.back')}</Text>
      </TouchableOpacity>
      <Text className="mb-3 mt-2 text-[22px] font-semibold text-foreground">{t('courseCatalog.title')}</Text>
      <FlatList
        data={catalog}
        keyExtractor={(item) => item.id}
        ListEmptyComponent={
          <View className="items-center py-10">
            <Text className="text-[13px] text-muted-foreground">{t('common.empty')}</Text>
          </View>
        }
        renderItem={({ item, index }) => (
          <Card className="mb-2 p-3">
            <View className="flex-row items-center">
              <Text className="w-7 text-sm font-semibold text-primary">{index + 1}</Text>
              <Text className="flex-1 text-sm font-medium text-foreground" numberOfLines={1}>{item.title}</Text>
            </View>
            <Text className="mt-1 ml-7 text-[11px] text-muted-foreground">{item.type} · {item.duration}min</Text>
          </Card>
        )}
      />
    </View>
  )
}
