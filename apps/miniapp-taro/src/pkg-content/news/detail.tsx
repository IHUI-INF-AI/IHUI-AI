// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

import { useTt } from '@/i18n'
import { logger } from '@/utils/logger'
import { View, Text, Image, RichText } from '@tarojs/components'
import Taro, { useDidShow, useShareAppMessage, useShareTimeline } from '@tarojs/taro'
import { useState, useCallback, useEffect } from 'react'
import * as api from '@/api'
import { getNewsDetail, type News } from '@/api'
import { NavBar } from '@/components'
import ThemeRoot from '@/components/ThemeRoot'
import LineIcon from '@/components/LineIcon'

// 防御式扩展:likeNews / getRelatedNews 当前 @/api 未导出,运行时若存在则调用,否则静默 fallback
type NewsApiExt = {
  likeNews?: (id: string | number) => Promise<{ liked?: boolean } | void>
  getRelatedNews?: (
    id: string | number,
    params?: { page?: number; pageSize?: number },
  ) => Promise<{ list?: News[]; total?: number } | News[]>
}

export default function NewsDetailPage() {
  const tt = useTt()
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
    // /pkg-content/news/comment 未注册,仅保留"即将开放"提示
    Taro.showToast({
      title: tt('news.detail.commentSoon', '评论功能即将开放'),
      icon: 'none',
    })
  }, [tt])

  const onShare = useCallback(() => {
    Taro.showShareMenu({ withShareTicket: true })
  }, [])

  const goRelated = useCallback((rid: string | number) => {
    Taro.navigateTo({ url: `/pkg-content/news/detail?id=${rid}` })
  }, [])

  useShareAppMessage(() => ({
    title: news.title || tt('share.appTitle', '智汇 AI'),
    path: `/pkg-content/news/detail?id=${id}`,
    imageUrl: news.coverUrl || '',
  }))
  useShareTimeline(() => ({
    title: news.title || tt('share.timelineTitle', '智汇 AI'),
    query: `id=${id}`,
  }))

  return (
    <ThemeRoot>
      {/* 页面底色对齐 RN shell/共享屏 surface.bg;内容布局对齐 SharedArticleDetailScreen */}
      <View className="min-h-screen bg-background pb-[140rpx]">
        <NavBar showBack />
        {loading ? (
          <View className="flex items-center justify-center py-[240rpx]">
            <Text className="text-[28rpx] text-muted-foreground">
              {tt('common.loading', '加载中…')}
            </Text>
          </View>
        ) : null}

        {!loading && news.title ? (
          <View className="px-[20rpx] pt-[24rpx]">
            <Text className="block text-[44rpx] text-foreground font-semibold leading-[1.4]">
              {news.title}
            </Text>
            {/* metaRow:发布时间(左)/阅读数(右),对齐 RN author + publishedAt */}
            <View className="flex flex-row items-center justify-between mt-[12rpx] mb-[12rpx]">
              <Text className="text-[28rpx] font-medium text-muted-foreground">
                {news.createTime}
              </Text>
              <Text className="text-[22rpx] text-[color:var(--color-text-tertiary)]">
                {tt('news.readCount', '{n}阅读', { n: news.views || 0 })}
              </Text>
            </View>
            {/* statRow:阅读/点赞 chip(白底圆角),对齐 RN statRow */}
            <View className="flex flex-row items-center gap-[16rpx] mb-[24rpx]">
              <View className="flex flex-row items-center bg-card px-[16rpx] py-[4rpx] rounded-[16rpx]">
                <Text className="text-[22rpx] text-muted-foreground">
                  {tt('news.readCount', '{n}阅读', { n: news.views || 0 })}
                </Text>
              </View>
              <View className="flex flex-row items-center gap-[8rpx] bg-card px-[16rpx] py-[4rpx] rounded-[16rpx]">
                <LineIcon name="heart" size={11} color="var(--color-muted-foreground)" />
                <Text className="text-[22rpx] text-muted-foreground">{likes}</Text>
              </View>
            </View>
            {/* 正文:直接铺在页面底色上(RN content 无卡片) */}
            <View className="text-[32rpx] text-[color:var(--color-text-medium)] leading-[44rpx]">
              <RichText nodes={news.content} />
            </View>
          </View>
        ) : null}

        {!loading && related.length ? (
          <View className="px-[20rpx] mt-[24rpx]">
            <Text className="block text-[30rpx] text-foreground font-semibold mb-[16rpx]">
              {tt('news.detail.related', '相关推荐')}
            </Text>
            <View className="flex flex-col gap-[16rpx]">
              {related.map((r) => (
                <View
                  key={r.id}
                  className="flex gap-[20rpx] p-[20rpx] bg-card rounded-[16rpx]"
                  onClick={() => goRelated(r.id)}
                  hoverClass="opacity-60"
                >
                  {r.coverUrl ? (
                    <Image
                      className="w-[192rpx] h-[120rpx] rounded-[12rpx] shrink-0 bg-secondary"
                      src={r.coverUrl}
                      mode="aspectFill"
                    />
                  ) : null}
                  <View className="flex-1 flex flex-col justify-between py-[2rpx] min-w-0">
                    <Text className="text-[28rpx] text-foreground font-semibold leading-[1.4] line-clamp-2">
                      {r.title}
                    </Text>
                    <View className="flex gap-[16rpx] mt-[12rpx]">
                      <Text className="text-[22rpx] text-[color:var(--color-text-tertiary)]">
                        {r.createTime}
                      </Text>
                      <Text className="text-[22rpx] text-[color:var(--color-text-tertiary)]">
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
          <View className="flex items-center justify-center py-[240rpx]">
            <Text className="text-[28rpx] text-muted-foreground">
              {tt('common.empty', '暂无数据')}
            </Text>
          </View>
        ) : null}

        {/* 底部操作栏:对齐 RN wrapper bottomBar(space-around + hairline 上边框 + 白底) */}
        {!loading && news.title ? (
          <View className="fixed bottom-0 left-0 right-0 flex flex-row items-center justify-around bg-card border-t border-border pt-[16rpx] pb-[calc(20rpx+env(safe-area-inset-bottom,0))]">
            <View
              className="flex flex-row items-center gap-[8rpx] bg-transparent"
              onClick={onLike}
              hoverClass="opacity-60"
            >
              <LineIcon
                name="heart"
                size={18}
                color={liked ? 'var(--color-danger-bright)' : 'var(--color-muted-foreground)'}
              />
              <Text className="text-[26rpx] text-muted-foreground leading-none">
                {likes > 0 ? likes : tt('news.detail.like', '点赞')}
              </Text>
            </View>
            <View
              className="flex flex-row items-center gap-[8rpx] bg-transparent"
              onClick={onComment}
              hoverClass="opacity-60"
            >
              <LineIcon name="message-circle" size={18} color="var(--color-muted-foreground)" />
              <Text className="text-[26rpx] text-muted-foreground leading-none">
                {comments > 0 ? comments : tt('news.detail.comment', '评论')}
              </Text>
            </View>
            <View
              className="flex flex-row items-center gap-[8rpx] bg-transparent"
              onClick={onShare}
              hoverClass="opacity-60"
            >
              <LineIcon name="share-2" size={18} color="var(--color-muted-foreground)" />
              <Text className="text-[26rpx] text-muted-foreground leading-none">
                {tt('news.detail.share', '分享')}
              </Text>
            </View>
          </View>
        ) : null}
      </View>
    </ThemeRoot>
  )
}
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
