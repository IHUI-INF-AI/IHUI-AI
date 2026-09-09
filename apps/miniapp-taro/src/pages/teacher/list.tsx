// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

import { useI18n } from '@/i18n'
import { View, Text, Input, Image } from '@tarojs/components'
import Taro, { useReachBottom } from '@tarojs/taro'
import { useState, useEffect, useCallback, useRef } from 'react'
import { getTeacherList, type Teacher } from '@/api'
import ThemeRoot from '@/components/ThemeRoot'
import LineIcon from '@/components/LineIcon'

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
    <ThemeRoot>
      {/* 对齐 RN TeacherListScreen container:bg surface.bg */}
      <View className="min-h-screen bg-background">
        {/* 搜索栏(RN searchWrap:row+center gap16 margin24 h72 胶囊36 px24 bg card) */}
        <View className="m-3 flex items-center gap-2 h-[72rpx] px-3 rounded-full bg-card">
          <LineIcon name="search" size={32} color="var(--color-text-tertiary)" />
          <Input
            className="flex-1 text-sm text-foreground"
            placeholder={t('teacher.list.searchPlaceholder')}
            placeholderStyle="color: var(--color-text-tertiary)"
            value={keyword}
            onInput={(e) => setKeyword(e.detail.value)}
            onConfirm={onSearch}
          />
        </View>
        {list.length > 0 && (
          <View className="px-3 pb-[40rpx]">
            {list.map((item) => (
              <View
                key={item.id}
                className="flex items-center gap-3 bg-card rounded-lg p-3 mb-3"
                hoverClass="opacity-85"
                hoverStayTime={120}
                onClick={() => goDetail(item.id)}
              >
                {item.avatar ? (
                  <Image
                    className="w-[120rpx] h-[120rpx] rounded-full bg-muted flex-shrink-0"
                    src={item.avatar}
                    mode="aspectFill"
                  />
                ) : (
                  <View className="w-[120rpx] h-[120rpx] rounded-full bg-muted flex-shrink-0 flex items-center justify-center">
                    <Text className="text-[44rpx] font-semibold text-muted-foreground">
                      {item.name.slice(0, 1)}
                    </Text>
                  </View>
                )}
                <View className="flex-1 min-w-0">
                  <View className="flex items-center gap-1.5">
                    <Text className="text-base text-foreground font-semibold line-clamp-1 min-w-0 flex-shrink">
                      {item.name}
                    </Text>
                    {item.title && (
                      <View className="flex-shrink min-w-0 bg-[var(--color-muted)] px-1.5 py-0.5 rounded">
                        <Text className="text-[22rpx] text-muted-foreground line-clamp-1">
                          {item.title}
                        </Text>
                      </View>
                    )}
                  </View>
                  {item.intro ? (
                    <Text className="block text-[26rpx] leading-[36rpx] text-muted-foreground mt-1 line-clamp-2">
                      {item.intro}
                    </Text>
                  ) : null}
                  <Text className="block text-xs text-[var(--color-text-tertiary)] mt-1">
                    {t('teacher.list.courseCount', { n: item.courses || 0 })} ·{' '}
                    {t('teacher.list.studentCount', { n: item.students || 0 })}
                  </Text>
                </View>
                <LineIcon
                  name="chevron-right"
                  size={36}
                  color="var(--color-text-tertiary)"
                  className="flex-shrink-0"
                />
              </View>
            ))}
          </View>
        )}
        {!loading && list.length === 0 && (
          <View className="flex items-center justify-center py-[120rpx]">
            <Text className="text-sm text-[var(--color-text-tertiary)]">
              {t('teacher.list.empty')}
            </Text>
          </View>
        )}
        {loading && (
          <View className="flex items-center justify-center py-[120rpx]">
            <Text className="text-sm text-[var(--color-text-tertiary)]">
              {t('common.loading')}
            </Text>
          </View>
        )}
      </View>
    </ThemeRoot>
  )
}
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
