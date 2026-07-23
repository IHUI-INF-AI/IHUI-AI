import { logger } from '@/utils/logger'
import { View, Text, Image } from '@tarojs/components'
import Taro, { useDidShow, useReachBottom, usePullDownRefresh } from '@tarojs/taro'
import { useState, useCallback, useEffect, useRef } from 'react'
import * as api from '@/api'
import { useI18n } from '@/i18n'
import './index.css'

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
    <View className="page-container">
      <View className="page-header">
        <Text className="page-title">{t('aiCircle.title')}</Text>
      </View>
      <View className="page-content">
        {loading ? (
          <View className="state-box">
            <Text className="state-text">{t('common.loading')}</Text>
          </View>
        ) : error ? (
          <View className="state-box">
            <Text className="state-text">{tt('aiCircle.loadFailed', '加载失败')}</Text>
            <View className="retry-btn" onClick={() => loadData(true)}>
              <Text>{t('common.retry')}</Text>
            </View>
          </View>
        ) : list.length ? (
          <View className="feed-list">
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
                <View key={id} className="feed-card" onClick={() => onItemClick(id)}>
                  <View className="feed-user">
                    <Image className="avatar" src={avatar} mode="aspectFill" />
                    <View className="user-info">
                      <Text className="nickname">{author}</Text>
                      {createTime ? <Text className="time">{createTime}</Text> : null}
                    </View>
                  </View>
                  {title ? <Text className="feed-title">{title}</Text> : null}
                  {content ? <Text className="feed-content">{content}</Text> : null}
                  {images.length > 0 ? (
                    <View className="feed-images">
                      {images.slice(0, 3).map((img, i) => (
                        <Image key={i} className="feed-img" src={img} mode="aspectFill" />
                      ))}
                    </View>
                  ) : null}
                  <View className="feed-actions">
                    <Text className="action">
                      ♡ {likes}
                    </Text>
                    <Text className="action">
                      💬 {comments}
                    </Text>
                  </View>
                </View>
              )
            })}
            {loadingMore ? (
              <View className="load-more-box">
                <Text className="load-more-text">{t('common.loading')}</Text>
              </View>
            ) : !hasMore ? (
              <View className="load-more-box">
                <Text className="load-more-text">{tt('aiCircle.noMore', '没有更多了')}</Text>
              </View>
            ) : null}
          </View>
        ) : (
          <View className="state-box">
            <Text className="state-text">{t('aiCircle.empty')}</Text>
          </View>
        )}
      </View>
      <View className="fab" onClick={onPublish}>
        <Text className="fab-icon">+</Text>
      </View>
    </View>
  )
}
