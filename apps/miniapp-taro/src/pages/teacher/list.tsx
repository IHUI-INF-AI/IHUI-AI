import { View, Text, Input, Image } from '@tarojs/components'
import Taro, { useReachBottom } from '@tarojs/taro'
import { useState, useEffect, useCallback, useRef } from 'react'
import { getTeacherList, type Teacher } from '@/api'
import { useI18n } from '@/i18n'

export default function TeacherList() {
  const { t } = useI18n()
  const [list, setList] = useState<Teacher[]>([])
  const [loading, setLoading] = useState(false)
  const [keyword, setKeyword] = useState('')
  const pageRef = useRef(1)
  const hasMoreRef = useRef(true)
  const loadingRef = useRef(false)
  const lenRef = useRef(0)
  const keywordRef = useRef('')

  const load = useCallback(async (reset = false) => {
    if (loadingRef.current) return
    if (reset) {
      pageRef.current = 1
      hasMoreRef.current = true
      lenRef.current = 0
      setList([])
    }
    if (!reset && !hasMoreRef.current) return
    loadingRef.current = true
    setLoading(true)
    try {
      const res = await getTeacherList({
        page: pageRef.current,
        pageSize: 10,
        keyword: keywordRef.current,
      })
      const more = res.list || []
      lenRef.current = reset ? more.length : lenRef.current + more.length
      setList((prev) => (reset ? more : [...prev, ...more]))
      hasMoreRef.current = lenRef.current < res.total
      pageRef.current++
    } catch {
      // 统一提示
    } finally {
      loadingRef.current = false
      setLoading(false)
    }
  }, [])

  const onSearch = useCallback(() => {
    keywordRef.current = keyword
    load(true)
  }, [keyword, load])

  const goDetail = useCallback((id: string | number) => {
    Taro.navigateTo({ url: `/pages/teacher/detail?id=${id}` })
  }, [])

  useReachBottom(() => load())

  useEffect(() => {
    load(true)
  }, [load])

  return (
    <View className="min-h-screen bg-background">
      <View className="p-3">
        <Input
          className="h-9 px-3 bg-card rounded-lg text-sm"
          placeholder={t('teacher.list.searchPlaceholder')}
          value={keyword}
          onInput={(e) => setKeyword(e.detail.value)}
          onConfirm={onSearch}
        />
      </View>
      {list.length > 0 && (
        <View className="px-3">
          {list.map((item) => (
            <View
              key={item.id}
              className="flex bg-card rounded-2xl p-3 mb-3"
              onClick={() => goDetail(item.id)}
            >
              <Image
                className="w-[60px] h-[60px] rounded-md bg-muted flex-shrink-0"
                src={item.avatar || '/static/default-avatar.png'}
                mode="aspectFill"
              />
              <View className="flex-1 ml-3">
                <View className="flex items-center gap-2">
                  <Text className="text-base text-foreground font-semibold">{item.name}</Text>
                  {item.title && (
                    <Text className="text-xs text-primary bg-[var(--color-muted)] px-1.5 py-0.5 rounded">
                      {item.title}
                    </Text>
                  )}
                </View>
                <Text className="block text-xs text-muted-foreground mt-1.5 leading-relaxed">
                  {item.intro}
                </Text>
                <View className="flex gap-3 mt-1.5">
                  <Text className="text-xs text-muted-foreground">
                    {t('teacher.list.courseCount', { n: item.courses || 0 })}
                  </Text>
                  <Text className="text-xs text-muted-foreground">
                    {t('teacher.list.studentCount', { n: item.students || 0 })}
                  </Text>
                </View>
              </View>
            </View>
          ))}
        </View>
      )}
      {!loading && list.length === 0 && (
        <View className="text-center py-16 text-muted-foreground text-sm">
          <Text>{t('teacher.list.empty')}</Text>
        </View>
      )}
      {loading && (
        <View className="text-center py-16 text-muted-foreground text-sm">
          <Text>{t('common.loading')}</Text>
        </View>
      )}
    </View>
  )
}
