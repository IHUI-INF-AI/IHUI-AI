import { useEffect, useState } from 'react'
import { FlatList, RefreshControl, Text, TouchableOpacity, View } from 'react-native'
import { useNavigation } from '@react-navigation/native'
import type { NativeStackNavigationProp } from '@react-navigation/native-stack'
import { fetchApi } from '@ihui/api-client'
import { Badge, Card, Loading } from '@ihui/ui-native'
import { useI18n } from '../i18n'
import type { RootStackParamList } from '../navigation/RootNavigator'

interface Bookmark {
  id: string
  targetId: string
  targetType: 'course' | 'article' | 'post' | 'note'
  title: string
  savedAt: string
}

const BOOKMARK_TYPE_KEYS: Record<Bookmark['targetType'], string> = {
  course: 'bookmark.type.course',
  article: 'bookmark.type.article',
  post: 'bookmark.type.post',
  note: 'bookmark.type.note',
}

type NavigationProp = NativeStackNavigationProp<RootStackParamList>

export function BookmarkScreen() {
  const { t } = useI18n()
  const navigation = useNavigation<NavigationProp>()
  const [items, setItems] = useState<Bookmark[]>([])
  const [loading, setLoading] = useState(true)
  const [refreshing, setRefreshing] = useState(false)
  const [error, setError] = useState('')

  const load = async (refresh = false) => {
    if (refresh) setRefreshing(true)
    else setLoading(true)
    setError('')
    const res = await fetchApi<Bookmark[]>('/api/favorites')
    if (res.success) setItems(res.data ?? [])
    else setError(res.error || t('bookmark.loadFailed'))
    setLoading(false)
    setRefreshing(false)
  }

  useEffect(() => {
    void load()
  }, [])

  const onPress = (item: Bookmark) => {
    if (item.targetType === 'course') navigation.navigate('CourseDetail', { id: item.targetId })
    else if (item.targetType === 'article')
      navigation.navigate('ArticleDetail', { id: item.targetId })
    else if (item.targetType === 'post') navigation.navigate('PostDetail', { id: item.targetId })
    else if (item.targetType === 'note') navigation.navigate('NoteDetail', { id: item.targetId })
  }

  const onRemove = async (item: Bookmark) => {
    const res = await fetchApi<void>(`/api/bookmarks/${encodeURIComponent(item.id)}`, {
      method: 'DELETE',
    })
    if (res.success) setItems((prev) => prev.filter((b) => b.id !== item.id))
    else setError(res.error || t('common.failed'))
  }

  if (loading)
    return (
      <View className="flex-1 items-center justify-center bg-card p-4">
        <Loading />
        <Text className="mt-2 text-[13px] text-muted-foreground">{t('common.loading')}</Text>
      </View>
    )
  if (error && items.length === 0)
    return (
      <View className="flex-1 items-center justify-center bg-card p-4">
        <Text className="mb-2 text-center text-[13px] text-destructive">{error}</Text>
        <TouchableOpacity
          className="mt-3 rounded-md bg-primary px-4 py-2"
          onPress={() => navigation.goBack()}
        >
          <Text className="text-sm text-primary-foreground">{t('common.back')}</Text>
        </TouchableOpacity>
      </View>
    )
  return (
    <View className="flex-1 bg-card px-4 pt-12">
      <TouchableOpacity onPress={() => navigation.goBack()}>
        <Text className="text-sm text-muted-foreground">{t('common.back')}</Text>
      </TouchableOpacity>
      <Text className="mb-3 mt-2 text-[22px] font-semibold text-foreground">
        {t('bookmark.title')}
      </Text>
      <FlatList
        data={items}
        keyExtractor={(item) => item.id}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => load(true)} />}
        ListEmptyComponent={
          <View className="items-center py-10">
            <Text className="text-[13px] text-muted-foreground">{t('bookmark.empty')}</Text>
          </View>
        }
        renderItem={({ item }) => (
          <Card className="mb-2 flex-row items-center p-3">
            <TouchableOpacity className="flex-1" onPress={() => onPress(item)}>
              <View className="mb-1 flex-row justify-between">
                <Badge variant="secondary" label={t(BOOKMARK_TYPE_KEYS[item.targetType])} />
                <Text className="text-[11px] text-muted-foreground">{item.savedAt}</Text>
              </View>
              <Text className="text-sm font-medium text-foreground" numberOfLines={2}>
                {item.title}
              </Text>
            </TouchableOpacity>
            <TouchableOpacity
              className="ml-2 rounded-md bg-destructive/10 px-2.5 py-1.5"
              onPress={() => onRemove(item)}
            >
              <Text className="text-xs text-destructive">{t('bookmark.remove')}</Text>
            </TouchableOpacity>
          </Card>
        )}
      />
    </View>
  )
}
