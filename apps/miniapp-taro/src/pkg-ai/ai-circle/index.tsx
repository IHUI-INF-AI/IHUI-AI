// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

import { useTt, useI18n } from '@/i18n'
import { logger } from '@/utils/logger'
import { View, Text, Image } from '@tarojs/components'
import Taro, { useDidShow, useReachBottom, usePullDownRefresh } from '@tarojs/taro'
import { useState, useCallback, useEffect, useRef } from 'react'
import * as api from '@/api'
import ThemeRoot from '@/components/ThemeRoot'
import LineIcon from '@/components/LineIcon'

const PAGE_SIZE = 10

export default function AiCircle() {
  const { t } = useI18n()
  const tt = useTt()
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
    <View className="min-h-screen bg-background pb-[160rpx]">
      <View className="p-[24rpx] bg-card border-b border-[var(--color-border)]">
        <Text className="text-[36rpx] font-semibold text-foreground">{t('aiCircle.title')}</Text>
      </View>
      <View className="p-[24rpx]">
        {loading ? (
          <View className="flex flex-col items-center justify-center py-[120rpx] gap-[16rpx]">
            <Text className="text-center text-[26rpx] text-[var(--color-text-tertiary)]">
              {t('common.loading')}
            </Text>
          </View>
        ) : error ? (
          <View
            className="flex flex-col items-center justify-center py-[120rpx] gap-[16rpx]"
            onClick={() => loadData(true)}
            hoverClass="opacity-60"
          >
            <Text className="text-center text-[26rpx] text-[var(--color-danger)]">
              {tt('aiCircle.loadFailed', '加载失败')}
            </Text>
            <Text className="text-[26rpx] text-foreground">{t('common.retry')}</Text>
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
                <ThemeRoot key={id} className="p-[24rpx] bg-card rounded-[16rpx]">
                  <View
                    key={id}
                    onClick={() => onItemClick(id)}
                    className="flex flex-col gap-[12rpx]"
                    hoverClass="opacity-60"
                  >
                    <View className="flex items-center gap-[16rpx]">
                      <Image
                        className="w-[56rpx] h-[56rpx] rounded-[28rpx] bg-[var(--color-muted)] flex-shrink-0"
                        src={avatar}
                        mode="aspectFill"
                      />
                      <Text className="flex-1 min-w-0 text-[26rpx] font-medium text-foreground overflow-hidden text-ellipsis whitespace-nowrap">
                        {author}
                      </Text>
                      {createTime ? (
                        <Text className="text-[22rpx] text-[var(--color-text-tertiary)]">
                          {createTime}
                        </Text>
                      ) : null}
                    </View>
                    {title ? (
                      <Text className="block text-[30rpx] font-semibold text-foreground overflow-hidden text-ellipsis line-clamp-2">
                        {title}
                      </Text>
                    ) : null}
                    {content ? (
                      <Text className="block text-[26rpx] leading-[38rpx] text-muted-foreground line-clamp-3">
                        {content}
                      </Text>
                    ) : null}
                    {images.length > 0 ? (
                      <View className="flex gap-[12rpx]">
                        {images.slice(0, 3).map((img, i) => (
                          <Image
                            key={i}
                            className="w-[200rpx] h-[200rpx] rounded-[12rpx] bg-[var(--color-muted)]"
                            src={img}
                            mode="aspectFill"
                          />
                        ))}
                      </View>
                    ) : null}
                    <View className="flex items-center gap-[32rpx]">
                      <View className="flex items-center gap-[8rpx]">
                        <LineIcon name="heart" size={26} color="var(--color-text-tertiary)" />
                        <Text className="text-[24rpx] text-[var(--color-text-tertiary)]">
                          {likes}
                        </Text>
                      </View>
                      <View className="flex items-center gap-[8rpx]">
                        <LineIcon
                          name="message-circle"
                          size={26}
                          color="var(--color-text-tertiary)"
                        />
                        <Text className="text-[24rpx] text-[var(--color-text-tertiary)]">
                          {comments}
                        </Text>
                      </View>
                    </View>
                  </View>
                </ThemeRoot>
              )
            })}
            {loadingMore ? (
              <View className="py-[24rpx] text-center">
                <Text className="text-[26rpx] text-[var(--color-text-tertiary)]">
                  {t('common.loading')}
                </Text>
              </View>
            ) : !hasMore ? (
              <View className="py-[24rpx] text-center">
                <Text className="text-[26rpx] text-[var(--color-text-tertiary)]">
                  {tt('aiCircle.noMore', '没有更多了')}
                </Text>
              </View>
            ) : null}
          </View>
        ) : (
          <View className="flex flex-col items-center justify-center py-[120rpx] gap-[16rpx]">
            <Text className="text-center text-[26rpx] text-[var(--color-text-tertiary)]">
              {t('aiCircle.empty')}
            </Text>
            <View
              className="px-[40rpx] py-[16rpx] rounded-[32rpx] bg-primary"
              onClick={onPublish}
              hoverClass="opacity-60"
            >
              <Text className="text-[26rpx] font-semibold text-[var(--color-card)]">
                {t('aiCircle.post')}
              </Text>
            </View>
          </View>
        )}
      </View>
      <View
        className="fixed right-[48rpx] bottom-[64rpx] w-[104rpx] h-[104rpx] bg-primary rounded-[52rpx] flex items-center justify-center z-[100] shadow-[0_8rpx_24rpx_var(--color-black-20)]"
        onClick={onPublish}
        hoverClass="opacity-60"
      >
        <Text className="text-[26rpx] text-[var(--color-card)] leading-[26rpx]">
          {t('aiCircle.post')}
        </Text>
      </View>
    </View>
  )
}
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
