import { useEffect, useState } from 'react'
import { FlatList, Pressable, Text, TextInput, View } from 'react-native'
import { Card } from '@ihui/ui-native'
import { getCourses, type Course } from '@ihui/api-client'

const PAGE_SIZE = 12

export function CourseScreen() {
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
        setError(res.error || '加载失败')
      }
      setLoading(false)
    })()
    return () => {
      cancelled = true
    }
  }, [page, keyword])

  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE))

  return (
    <View className="flex-1 bg-white dark:bg-black">
      <View className="border-b border-neutral-100 px-4 py-3 dark:border-neutral-800">
        <TextInput
          value={keyword}
          onChangeText={(v) => {
            setKeyword(v)
            setPage(1)
          }}
          placeholder="搜索课程..."
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
              <Text className="text-sm text-neutral-500">加载中...</Text>
            </View>
          ) : (
            <View className="items-center py-12">
              <Text className="text-sm text-neutral-500">暂无课程</Text>
            </View>
          )
        }
        renderItem={({ item }) => (
          <Card>
            <Text className="text-base font-semibold text-neutral-900 dark:text-neutral-50">
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
                {item.isFree ? '免费' : `¥${item.price.toFixed(2)}`}
              </Text>
              <Text className="text-xs text-neutral-500">{item.studentCount} 人学过</Text>
            </View>
          </Card>
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
                <Text className="text-sm text-neutral-700 dark:text-neutral-300">上一页</Text>
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
                <Text className="text-sm text-neutral-700 dark:text-neutral-300">下一页</Text>
              </Pressable>
            </View>
          ) : null
        }
      />
    </View>
  )
}
