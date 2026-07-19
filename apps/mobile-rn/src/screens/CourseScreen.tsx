import { useEffect, useState } from 'react'
import { FlatList, Pressable, Text, TextInput, TouchableOpacity, View } from 'react-native'
import { useNavigation } from '@react-navigation/native'
import type { NativeStackNavigationProp } from '@react-navigation/native-stack'
import { Card } from '@ihui/ui-native'
import { getCourses, type Course } from '@ihui/api-client'
import { useI18n } from '../i18n'
import type { CourseStackParamList } from '../navigation/RootNavigator'

const PAGE_SIZE = 12

type NavigationProp = NativeStackNavigationProp<CourseStackParamList>

export function CourseScreen() {
  const { t } = useI18n()
  const navigation = useNavigation<NavigationProp>()
  const [courses, setCourses] = useState<Course[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [keyword, setKeyword] = useState('')
  const [page, setPage] = useState(1)
  const [total, setTotal] = useState(0)

  useEffect(() => {
    let cancelled = false
    void (async () => {
      setLoading(true)
      setError('')
      const res = await getCourses({
        page,
        pageSize: PAGE_SIZE,
        keyword: keyword.trim() || undefined,
      })
      if (cancelled) return
      if (res.success) {
        setCourses(res.data.list)
        setTotal(res.data.total)
      } else {
        setError(res.error || t('course.loadFailed'))
      }
      setLoading(false)
    })()
    return () => {
      cancelled = true
    }
  }, [page, keyword, t])

  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE))

  return (
    <View className="flex-1 bg-white dark:bg-black">
      <View className="px-4 pt-12 pb-2">
        <Text className="text-2xl font-semibold text-neutral-900 dark:text-neutral-50">
          {t('course.title')}
        </Text>
      </View>
      <View className="border-b border-neutral-100 px-4 py-3 dark:border-neutral-800">
        <TextInput
          value={keyword}
          onChangeText={(v) => {
            setKeyword(v)
            setPage(1)
          }}
          placeholder={t('course.searchPlaceholder')}
          className="rounded-md border border-neutral-200 bg-neutral-50 px-3 py-2 text-sm text-neutral-900 dark:border-neutral-800 dark:bg-neutral-900 dark:text-neutral-50"
          placeholderTextColor="#9ca3af"
          returnKeyType="search"
        />
      </View>

      {error ? (
        <View className="px-4 py-2">
          <Text className="text-sm text-red-600">{error}</Text>
        </View>
      ) : null}

      <FlatList
        data={courses}
        keyExtractor={(c) => c.id}
        contentContainerStyle={{ padding: 16, paddingBottom: 32 }}
        ItemSeparatorComponent={() => <View className="h-3" />}
        ListEmptyComponent={
          loading ? (
            <View className="items-center py-12">
              <Text className="text-sm text-neutral-500">{t('common.loading')}</Text>
            </View>
          ) : (
            <View className="items-center py-12">
              <Text className="text-sm text-neutral-500">{t('course.empty')}</Text>
            </View>
          )
        }
        renderItem={({ item }) => (
          <TouchableOpacity
            onPress={() => navigation.navigate('CourseDetail', { id: item.id })}
            activeOpacity={0.7}
          >
            <Card>
              <Text
                className="text-base font-semibold text-neutral-900 dark:text-neutral-50"
                numberOfLines={1}
              >
                {item.title}
              </Text>
              <View className="mt-1 flex-row gap-3">
                <Text className="text-xs text-neutral-500">{item.instructor}</Text>
                <Text className="text-xs text-neutral-500">{item.level}</Text>
              </View>
              {item.description ? (
                <Text
                  className="mt-2 text-sm text-neutral-600 dark:text-neutral-400"
                  numberOfLines={2}
                >
                  {item.description}
                </Text>
              ) : null}
              <View className="mt-2 flex-row items-center justify-between">
                <Text className="text-sm font-semibold text-emerald-600">
                  {item.isFree ? t('course.free') : `¥${item.price.toFixed(2)}`}
                </Text>
                <Text className="text-xs text-neutral-500">
                  {t('course.studentCount', { count: item.studentCount })}
                </Text>
              </View>
            </Card>
          </TouchableOpacity>
        )}
        ListFooterComponent={
          totalPages > 1 ? (
            <View className="mt-4 flex-row items-center justify-between">
              <Pressable
                onPress={() => setPage((p) => Math.max(1, p - 1))}
                disabled={page <= 1}
                className={page <= 1 ? 'opacity-40' : ''}
                hitSlop={8}
              >
                <Text className="text-sm text-neutral-700 dark:text-neutral-300">
                  {t('common.back')}
                </Text>
              </Pressable>
              <Text className="text-xs text-neutral-500">
                {page} / {totalPages}
              </Text>
              <Pressable
                onPress={() => setPage((p) => Math.min(totalPages, p + 1))}
                disabled={page >= totalPages}
                className={page >= totalPages ? 'opacity-40' : ''}
                hitSlop={8}
              >
                <Text className="text-sm text-neutral-700 dark:text-neutral-300">
                  {t('home.livePreviewMore')}
                </Text>
              </Pressable>
            </View>
          ) : null
        }
      />
    </View>
  )
}
