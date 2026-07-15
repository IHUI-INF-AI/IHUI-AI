import { View, Text } from '@tarojs/components'
import { useReachBottom } from '@tarojs/taro'
import { useState, useEffect, useCallback, useRef } from 'react'
import { getStudyRecords, type StudyRecord } from '@/api'
import { useI18n } from '@/i18n'

export default function StudyRecord() {
  const { t } = useI18n()
  const [list, setList] = useState<StudyRecord[]>([])
  const [loading, setLoading] = useState(false)
  const pageRef = useRef(1)
  const hasMoreRef = useRef(true)
  const loadingRef = useRef(false)
  const lenRef = useRef(0)

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
      const res = await getStudyRecords({ page: pageRef.current, pageSize: 20 })
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

  useReachBottom(() => load())

  useEffect(() => {
    load(true)
  }, [load])

  return (
    <View className="min-h-screen bg-[#f7f8fa]">
      {list.length > 0 && (
        <View className="p-3">
          {list.map((r) => (
            <View key={r.id} className="bg-white rounded-2xl p-3 mb-3">
              <Text className="text-sm text-[#333] font-semibold">{r.courseTitle}</Text>
              <View className="flex justify-between mt-1.5">
                <Text className="text-xs text-[#07c160]">
                  {t('study.recordPage.duration', { n: r.duration })}
                </Text>
                <Text className="text-xs text-[#999]">{r.time}</Text>
              </View>
              <View className="h-1 bg-[#f5f5f5] rounded mt-2">
                <View className="h-full bg-[#07c160] rounded" style={{ width: `${r.progress}%` }} />
              </View>
              <Text className="block text-xs text-[#999] mt-1">
                {t('study.recordPage.progress', { n: r.progress })}
              </Text>
            </View>
          ))}
        </View>
      )}
      {!loading && list.length === 0 && (
        <View className="text-center py-16 text-[#999] text-sm">
          <Text>{t('study.recordPage.empty')}</Text>
        </View>
      )}
      {loading && (
        <View className="text-center py-16 text-[#999] text-sm">
          <Text>{t('common.loading')}</Text>
        </View>
      )}
    </View>
  )
}
