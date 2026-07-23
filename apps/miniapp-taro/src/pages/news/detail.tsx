import { logger } from '@/utils/logger'
import { View, Text, Image, RichText } from '@tarojs/components'
import Taro, { useDidShow, useShareAppMessage, useShareTimeline } from '@tarojs/taro'
import { useState, useCallback, useEffect } from 'react'
import * as api from '@/api'
import { getNewsDetail, type News } from '@/api'
import { NavBar } from '@/components'
import { useI18n } from '@/i18n'
import './detail.css'

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
    <View className="page">
      <NavBar showBack />
      {loading ? (
        <View className="loading">
          <Text>{tt('common.loading', '加载中…')}</Text>
        </View>
      ) : null}

      {!loading && news.title ? (
        <View className="head">
          <Text className="title">{news.title}</Text>
          <View className="meta">
            <Text className="time">{news.createTime}</Text>
            <Text className="views">
              {tt('news.readCount', '{n}阅读', { n: news.views || 0 })}
            </Text>
          </View>
        </View>
      ) : null}

      {!loading && news.content ? (
        <View className="content">
          <RichText nodes={news.content} />
        </View>
      ) : null}

      {!loading && related.length ? (
        <View className="related">
          <Text className="related-title">{tt('news.detail.related', '相关推荐')}</Text>
          <View className="related-list">
            {related.map((r) => (
              <View key={r.id} className="related-item" onClick={() => goRelated(r.id)}>
                {r.coverUrl ? (
                  <Image className="related-cover" src={r.coverUrl} mode="aspectFill" />
                ) : null}
                <View className="related-info">
                  <Text className="related-name">{r.title}</Text>
                  <View className="related-meta">
                    <Text className="r-time">{r.createTime}</Text>
                    <Text className="r-views">
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
        <View className="loading">
          <Text>{tt('common.empty', '暂无数据')}</Text>
        </View>
      ) : null}

      {!loading && news.title ? (
        <View className="bottom-bar">
          <View className={`action${liked ? ' liked' : ''}`} onClick={onLike}>
            <Text className="icon">{liked ? '♥' : '♡'}</Text>
            <Text className="count">
              {likes > 0 ? likes : tt('news.detail.like', '点赞')}
            </Text>
          </View>
          <View className="action" onClick={onComment}>
            <Text className="icon">💬</Text>
            <Text className="count">
              {comments > 0 ? comments : tt('news.detail.comment', '评论')}
            </Text>
          </View>
          <View className="action" onClick={onShare}>
            <Text className="icon">↗</Text>
            <Text className="count">{tt('news.detail.share', '分享')}</Text>
          </View>
        </View>
      ) : null}
    </View>
  )
}
