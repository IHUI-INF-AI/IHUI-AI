import { logger } from '@/utils/logger'
import { View, Text, Image, RichText } from '@tarojs/components'
import Taro, { useDidShow, useShareAppMessage, useShareTimeline } from '@tarojs/taro'
import { useState, useCallback, useEffect } from 'react'
import * as api from '@/api'
import { getNewsDetail, type News } from '@/api'
import { NavBar } from '@/components'
import { useI18n } from '@/i18n'

// 防御式扩展:likeNews / getRelatedNews 当前 @/api 未导出,运行时若存在则调用,否则静默 fallback
type NewsApiExt = {
  likeNews?: (id: string | number) => Promise<{ liked?: boolean } | void>
  getRelatedNews?: (
    id: string | number,
    params?: { page?: number; pageSize?: number },
  ) => Promise<{ list?: News[]; total?: number } | News[]>
}

export default function NewsDetailPage() {
  const { t } = useI18n()
  const tt = (k: string, fb: string, params?: Record<string, string | number>) => {
    const v = params ? t(k, params) : t(k)
    if (v !== k) return v
    if (!params) return fb
    return fb.replace(/\{(\w+)\}/g, (_, key) => String(params[key] ?? ''))
  }
  const [news, setNews] = useState<News>({} as News)
  const [loading, setLoading] = useState(true)
  const [id, setId] = useState('')
  const [liked, setLiked] = useState(false)
  const [likes, setLikes] = useState(0)
  const [comments, setComments] = useState(0)
  const [related, setRelated] = useState<News[]>([])

  const load = useCallback(async () => {
    if (!id) return
    setLoading(true)
    try {
      const data = await getNewsDetail(id)
      setNews(data)
      const ext = data as News & { likes?: number; comments?: number; isLiked?: boolean }
      setLikes(ext.likes || 0)
      setComments(ext.comments || 0)
      setLiked(Boolean(ext.isLiked))
      const relFn = (api as unknown as NewsApiExt).getRelatedNews
      if (typeof relFn === 'function') {
        try {
          const res = await relFn(id)
          if (Array.isArray(res)) setRelated(res)
          else if (res?.list) setRelated(res.list)
        } catch (e) {
          logger.error('news/detail', '获取相关推荐', e)
          setRelated([])
        }
      }
    } catch (e) {
      logger.error('news/detail', '获取资讯详情', e)
      Taro.showToast({ title: tt('common.failed', '操作失败'), icon: 'none' })
    } finally {
      setLoading(false)
    }
  }, [id, tt])

  useDidShow(() => {
    const instance = Taro.getCurrentInstance()
    const q = instance?.router?.params
    if (q?.id) setId(q.id)
  })

  useEffect(() => {
    if (id) load()
  }, [id, load])

  const onLike = useCallback(async () => {
    const next = !liked
    setLiked(next)
    setLikes((c) => Math.max(0, c + (next ? 1 : -1)))
    const fn = (api as unknown as NewsApiExt).likeNews
    if (typeof fn !== 'function') return
    try {
      await fn(id)
    } catch (e) {
      logger.error('news/detail', '点赞接口', e)
      setLiked(!next)
      setLikes((c) => Math.max(0, c + (next ? -1 : 1)))
    }
  }, [liked, id])

  const onComment = useCallback(() => {
    Taro.navigateTo({ url: `/pages/news/comment?id=${id}` }).catch(() => {
      Taro.showToast({
        title: tt('news.detail.commentSoon', '评论功能即将开放'),
        icon: 'none',
      })
    })
  }, [id, tt])

  const onShare = useCallback(() => {
    Taro.showShareMenu({ withShareTicket: true })
  }, [])

  const goRelated = useCallback((rid: string | number) => {
    Taro.navigateTo({ url: `/pages/news/detail?id=${rid}` })
  }, [])

  useShareAppMessage(() => ({
    title: news.title || tt('share.appTitle', '智汇 AI'),
    path: `/pages/news/detail?id=${id}`,
    imageUrl: news.coverUrl || '',
  }))
  useShareTimeline(() => ({
    title: news.title || tt('share.timelineTitle', '智汇 AI'),
    query: `id=${id}`,
  }))

  return (
    <View className="min-h-screen bg-background pb-[140rpx]">
      <NavBar showBack />
      {loading ? (
        <View className="text-center py-[120rpx] text-muted-foreground">
          <Text>{tt('common.loading', '加载中…')}</Text>
        </View>
      ) : null}

      {!loading && news.title ? (
        <View className="bg-card p-[32rpx] mb-[24rpx]">
          <Text className="block text-[40rpx] text-foreground font-bold leading-[1.4]">
            {news.title}
          </Text>
          <View className="flex gap-[24rpx] mt-[24rpx] text-[22rpx] text-muted-foreground">
            <Text>{news.createTime}</Text>
            <Text>{tt('news.readCount', '{n}阅读', { n: news.views || 0 })}</Text>
          </View>
        </View>
      ) : null}

      {!loading && news.content ? (
        <View className="bg-card p-[32rpx] text-[30rpx] text-foreground leading-[1.8] mb-[24rpx]">
          <RichText nodes={news.content} />
        </View>
      ) : null}

      {!loading && related.length ? (
        <View className="bg-card p-[32rpx]">
          <Text className="block text-[30rpx] text-foreground font-semibold mb-[24rpx]">
            {tt('news.detail.related', '相关推荐')}
          </Text>
          <View className="flex flex-col gap-[24rpx]">
            {related.map((r) => (
              <View
                key={r.id}
                className="flex gap-[24rpx] p-[16rpx] bg-background rounded-[12rpx]"
                onClick={() => goRelated(r.id)}
              >
                {r.coverUrl ? (
                  <Image
                    className="w-[200rpx] h-[140rpx] rounded-[8rpx] shrink-0 bg-secondary"
                    src={r.coverUrl}
                    mode="aspectFill"
                  />
                ) : null}
                <View className="flex-1 flex flex-col justify-between py-[4rpx] min-w-0">
                  <Text className="text-[26rpx] text-foreground font-medium leading-[1.4] line-clamp-2">
                    {r.title}
                  </Text>
                  <View className="flex gap-[16rpx] mt-[12rpx]">
                    <Text className="text-[22rpx] text-muted-foreground">{r.createTime}</Text>
                    <Text className="text-[22rpx] text-muted-foreground">
                      {tt('news.readCount', '{n}阅读', { n: r.views || 0 })}
                    </Text>
                  </View>
                </View>
              </View>
            ))}
          </View>
        </View>
      ) : null}

      {!loading && !news.title ? (
        <View className="text-center py-[120rpx] text-muted-foreground">
          <Text>{tt('common.empty', '暂无数据')}</Text>
        </View>
      ) : null}

      {!loading && news.title ? (
        <View className="fixed bottom-0 left-0 right-0 flex items-center bg-card px-[24rpx] pt-[16rpx] pb-[calc(16rpx+env(safe-area-inset-bottom,0))] shadow-[0_-2rpx_12rpx_rgba(0,0,0,0.25)]">
          <View
            className={`flex-1 flex items-center justify-center gap-[8rpx] text-[26rpx] bg-transparent ${liked ? 'text-destructive' : 'text-muted-foreground'}`}
            onClick={onLike}
          >
            <Text className="text-[32rpx] leading-none">{liked ? '♥' : '♡'}</Text>
            <Text className="text-[24rpx] leading-none">
              {likes > 0 ? likes : tt('news.detail.like', '点赞')}
            </Text>
          </View>
          <View
            className="flex-1 flex items-center justify-center gap-[8rpx] text-[26rpx] text-muted-foreground bg-transparent"
            onClick={onComment}
          >
            <Text className="text-[32rpx] leading-none">💬</Text>
            <Text className="text-[24rpx] leading-none">
              {comments > 0 ? comments : tt('news.detail.comment', '评论')}
            </Text>
          </View>
          <View
            className="flex-1 flex items-center justify-center gap-[8rpx] text-[26rpx] text-muted-foreground bg-transparent"
            onClick={onShare}
          >
            <Text className="text-[32rpx] leading-none">↗</Text>
            <Text className="text-[24rpx] leading-none">{tt('news.detail.share', '分享')}</Text>
          </View>
        </View>
      ) : null}
    </View>
  )
}
