import { logger } from '@/utils/logger'
import { View, Text, Image } from '@tarojs/components'
import Taro, { useDidShow, useReachBottom, usePullDownRefresh } from '@tarojs/taro'
import { useState, useCallback, useEffect, useRef } from 'react'
import * as api from '@/api'
import { useI18n } from '@/i18n'

const PAGE_SIZE = 10

export default function AiCircle() {
  const { t } = useI18n()
  const tt = (k: string, fb: string, params?: Record<string, string | number>) => {
    const v = params ? t(k, params) : t(k)
    if (v !== k) return v
    if (!params) return fb
    return fb.replace(/\{(\w+)\}/g, (_, key) => String(params[key] ?? ''))
  }
  const [list, setList] = useState<api.Circle[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState(false)
  const [page, setPage] = useState(1)
  const [hasMore, setHasMore] = useState(true)
  const [loadingMore, setLoadingMore] = useState(false)

  const loadData = useCallback(
    async (reset = false) => {
      if (reset) {
        setLoading(true)
        setError(false)
      } else {
        if (loadingMore || !hasMore) return
        setLoadingMore(true)
      }
      const curPage = reset ? 1 : page
      try {
        const res = await api.getCircleList({ page: curPage, pageSize: PAGE_SIZE })
        const newList = res?.list || []
        const total = res?.total ?? 0
        setList((prev) => (reset ? newList : [...prev, ...newList]))
        setHasMore((reset ? newList.length : list.length + newList.length) < total)
        setPage(curPage + 1)
      } catch (e) {
        logger.error('unknown', '加载AI圈', e)
        if (reset) setError(true)
      } finally {
        setLoading(false)
        setLoadingMore(false)
      }
    },
    [page, hasMore, loadingMore, list.length],
  )

  useDidShow(() => {
    loadData(true)
  })

  usePullDownRefresh(() => {
    loadData(true).then(() => {
      Taro.stopPullDownRefresh()
    })
  })

  useReachBottom(() => {
    loadData(false)
  })

  const onItemClick = useCallback((id: string) => {
    Taro.navigateTo({ url: `/pages/circle/detail?id=${id}` })
  }, [])

  const onPublish = useCallback(() => {
    Taro.navigateTo({ url: '/pages/circle/create' })
  }, [])

  const loadingRef = useRef(loadData)
  loadingRef.current = loadData
  useEffect(() => {
    loadingRef.current(true)
  }, [])

  return (
    <View className="min-h-screen bg-background pb-[120rpx]">
      <View className="p-[24rpx] bg-card">
        <Text className="text-[36rpx] font-semibold text-foreground">{t('aiCircle.title')}</Text>
      </View>
      <View className="p-[24rpx]">
        {loading ? (
          <View className="flex flex-col items-center py-[80rpx]">
            <Text className="text-center text-muted-foreground text-[26rpx]">{t('common.loading')}</Text>
          </View>
        ) : error ? (
          <View className="flex flex-col items-center py-[80rpx]">
            <Text className="text-center text-muted-foreground text-[26rpx]">{tt('aiCircle.loadFailed', '加载失败')}</Text>
            <View className="mt-[24rpx] px-[48rpx] py-[16rpx] bg-primary text-foreground text-center rounded-[12rpx] text-[26rpx]" onClick={() => loadData(true)}>
              <Text>{t('common.retry')}</Text>
            </View>
          </View>
        ) : list.length ? (
          <View className="flex flex-col gap-[16rpx]">
            {list.map((item) => {
              const id = String(item.id || '')
              const title = String(item.title || '')
              const content = String(item.content || '')
              const author = String(item.author || tt('aiCircle.anonymous', '匿名'))
              const avatar = (item.avatar as string) || '/static/default-avatar.png'
              const createTime = String(item.createTime || '')
              const likes = Number(item.likes || 0)
              const comments = Number(item.comments || 0)
              const images = (item.images as string[]) || []
              return (
                <View key={id} className="p-[24rpx] bg-card rounded-[12rpx]" onClick={() => onItemClick(id)}>
                  <View className="flex items-center">
                    <Image className="w-[72rpx] h-[72rpx] rounded-[12rpx] bg-background flex-shrink-0" src={avatar} mode="aspectFill" />
                    <View className="flex-1 min-w-0 ml-[16rpx] flex flex-col">
                      <Text className="text-[28rpx] font-semibold text-foreground">{author}</Text>
                      {createTime ? <Text className="text-[22rpx] text-muted-foreground mt-[4rpx]">{createTime}</Text> : null}
                    </View>
                  </View>
                  {title ? <Text className="block mt-[16rpx] text-[30rpx] font-semibold text-foreground">{title}</Text> : null}
                  {content ? <Text className="block mt-[12rpx] text-[26rpx] text-foreground line-clamp-4">{content}</Text> : null}
                  {images.length > 0 ? (
                    <View className="flex gap-[12rpx] mt-[16rpx]">
                      {images.slice(0, 3).map((img, i) => (
                        <Image key={i} className="w-[200rpx] h-[200rpx] rounded-[8rpx] bg-background" src={img} mode="aspectFill" />
                      ))}
                    </View>
                  ) : null}
                  <View className="flex items-center gap-[32rpx] mt-[16rpx]">
                    <Text className="text-[24rpx] text-muted-foreground">
                      ♡ {likes}
                    </Text>
                    <Text className="text-[24rpx] text-muted-foreground">
                      💬 {comments}
                    </Text>
                  </View>
                </View>
              )
            })}
            {loadingMore ? (
              <View className="py-[24rpx] text-center">
                <Text className="text-[24rpx] text-muted-foreground">{t('common.loading')}</Text>
              </View>
            ) : !hasMore ? (
              <View className="py-[24rpx] text-center">
                <Text className="text-[24rpx] text-muted-foreground">{tt('aiCircle.noMore', '没有更多了')}</Text>
              </View>
            ) : null}
          </View>
        ) : (
          <View className="flex flex-col items-center py-[80rpx]">
            <Text className="text-center text-muted-foreground text-[26rpx]">{t('aiCircle.empty')}</Text>
          </View>
        )}
      </View>
      <View className="fixed right-[32rpx] bottom-[64rpx] w-[96rpx] h-[96rpx] bg-primary rounded-[48rpx] flex items-center justify-center z-[100] shadow-[0_8rpx_24rpx_rgba(0,0,0,0.2)]" onClick={onPublish}>
        <Text className="text-[48rpx] text-foreground leading-[48rpx]">+</Text>
      </View>
    </View>
  )
}
