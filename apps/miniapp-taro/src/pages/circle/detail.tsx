import { logger } from '@/utils/logger'
import { View, Text, Image, Button, ScrollView, Input } from '@tarojs/components'
import Taro, { useDidShow } from '@tarojs/taro'
import { useState, useCallback, useRef } from 'react'
import { getCircleDetail, get, post, type Circle } from '@/api'
import { useI18n } from '@/i18n'
import './detail.css'

interface Comment {
  id: string
  userId: string
  avatar?: string
  nickname: string
  content: string
  createdAt: string
  likes: number
}

interface CommentData {
  list: Comment[]
  total: number
}

interface TopicInfo {
  id: string
  name: string
}

interface AigcWorkInfo {
  id: string
  title: string
  coverUrl?: string
}

interface DetailExt extends Circle {
  topic?: TopicInfo
  aigcWork?: AigcWorkInfo
  favorites?: number
  shares?: number
  liked?: boolean
  favorited?: boolean
  following?: boolean
  authorId?: string
}

const defaultAvatar = '/static/default-avatar.png'

export default function CircleDetailPage() {
  const { t } = useI18n()
  const tt = (k: string, fb: string) => (t(k) === k ? fb : t(k))

  const [data, setData] = useState<DetailExt>({} as DetailExt)
  const [comments, setComments] = useState<Comment[]>([])
  const [commentTotal, setCommentTotal] = useState(0)
  const [liked, setLiked] = useState(false)
  const [favorited, setFavorited] = useState(false)
  const [following, setFollowing] = useState(false)
  const [id, setId] = useState('')
  const [commentText, setCommentText] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const loadedRef = useRef('')

  const loadAll = useCallback(async (qid: string) => {
    try {
      const res = (await getCircleDetail(qid)) as DetailExt
      setData(res)
      setLiked(!!res.liked)
      setFavorited(!!res.favorited)
      setFollowing(!!res.following)
    } catch (e) {
      logger.error('circle/detail', '获取动态详情', e)
      Taro.showToast({ title: tt('common.failed', '加载失败'), icon: 'none' })
    }
    try {
      const c = await get<CommentData>(`/circles/${qid}/comments`, { page: 1, pageSize: 10 })
      setComments(c.list || [])
      setCommentTotal(c.total || 0)
    } catch (e) {
      logger.error('circle/detail', '加载评论', e)
    }
  }, [tt])

  useDidShow(() => {
    const instance = Taro.getCurrentInstance()
    const qid = instance?.router?.params?.id || ''
    if (qid && qid !== loadedRef.current) {
      loadedRef.current = qid
      setId(qid)
      loadAll(qid)
    }
  })

  const previewImg = useCallback(
    (i: number) => {
      Taro.previewImage({ urls: data.images || [], current: data.images?.[i] || '' })
    },
    [data.images],
  )

  const onFollow = useCallback(async () => {
    if (!data.authorId) {
      Taro.showToast({ title: tt('circle.detail.followed', '已关注'), icon: 'success' })
      return
    }
    const prev = following
    setFollowing(!prev)
    try {
      await post('/circles/follow', { userId: data.authorId })
      Taro.showToast({
        title: prev
          ? tt('circle.detail.unfollowed', '已取消关注')
          : tt('circle.detail.followed', '已关注'),
        icon: 'success',
      })
    } catch (e) {
      logger.error('circle/detail', '关注用户', e)
      setFollowing(prev)
    }
  }, [data.authorId, following, tt])

  const onLike = useCallback(async () => {
    if (!id) return
    const next = !liked
    setLiked(next)
    setData((d) => ({ ...d, likes: (d.likes || 0) + (next ? 1 : -1) }))
    try {
      await post(`/circles/${id}/like`, { liked: next })
    } catch (e) {
      logger.error('circle/detail', '点赞', e)
      setLiked(!next)
      setData((d) => ({ ...d, likes: (d.likes || 0) + (next ? -1 : 1) }))
    }
  }, [id, liked])

  const onFavorite = useCallback(async () => {
    if (!id) return
    const next = !favorited
    setFavorited(next)
    setData((d) => ({ ...d, favorites: (d.favorites || 0) + (next ? 1 : -1) }))
    try {
      await post(`/circles/${id}/favorite`, { favorited: next })
    } catch (e) {
      logger.error('circle/detail', '收藏', e)
      setFavorited(!next)
      setData((d) => ({ ...d, favorites: (d.favorites || 0) + (next ? -1 : 1) }))
    }
  }, [id, favorited])

  const onShare = useCallback(() => {
    Taro.setClipboardData({
      data: `${tt('circle.detail.shareHint', '看看这个动态')}: /pages/circle/detail?id=${id}`,
      success: () => {
        Taro.showToast({ title: tt('circle.detail.copied', '链接已复制'), icon: 'success' })
      },
    })
  }, [id, tt])

  const onSendComment = useCallback(async () => {
    const text = commentText.trim()
    if (!text || !id || submitting) return
    setSubmitting(true)
    try {
      await post(`/circles/${id}/comments`, { content: text })
      setCommentText('')
      Taro.showToast({ title: tt('circle.detail.commentSent', '评论成功'), icon: 'success' })
      const c = await get<CommentData>(`/circles/${id}/comments`, { page: 1, pageSize: 10 })
      setComments(c.list || [])
      setCommentTotal(c.total || 0)
      setData((d) => ({ ...d, comments: (d.comments || 0) + 1 }))
    } catch (e) {
      logger.error('circle/detail', '发送评论', e)
    } finally {
      setSubmitting(false)
    }
  }, [commentText, id, submitting, tt])

  const goCommentList = useCallback(() => {
    Taro.navigateTo({ url: `/pages/comment/list?circleId=${id}` })
  }, [id])

  const goAigcDetail = useCallback((workId: string) => {
    Taro.navigateTo({ url: `/pages/aigc/detail?id=${workId}` })
  }, [])

  const goTopic = useCallback((topicId: string) => {
    Taro.navigateTo({ url: `/pages/topic/detail?id=${topicId}` })
  }, [])

  const imgCount = data.images?.length || 0

  return (
    <View className="cd-page">
      <ScrollView scrollY className="cd-scroll">
        {data.author ? (
          <View className="cd-head">
            <Image className="cd-avatar" src={data.avatar || defaultAvatar} mode="aspectFill" />
            <View className="cd-user">
              <Text className="cd-name">{data.author}</Text>
              <Text className="cd-time">{data.createTime}</Text>
            </View>
            <Button
              className={`cd-follow${following ? ' followed' : ''}`}
              size="mini"
              onClick={onFollow}
            >
              {following
                ? tt('circle.detail.followed', '已关注')
                : tt('circle.detail.follow', '关注')}
            </Button>
          </View>
        ) : null}

        {data.content ? (
          <View className="cd-body">
            {data.title ? <Text className="cd-title">{data.title}</Text> : null}
            <Text className="cd-content">{data.content}</Text>

            {imgCount ? (
              <View className={`cd-images cd-images-${imgCount === 1 ? 'single' : 'multi'}`}>
                {data.images?.map((img, i) => (
                  <Image
                    key={i}
                    className="cd-img"
                    src={img}
                    mode="aspectFill"
                    onClick={() => previewImg(i)}
                  />
                ))}
              </View>
            ) : null}

            {data.aigcWork ? (
              <View className="cd-aigc-card" onClick={() => goAigcDetail(data.aigcWork!.id)}>
                {data.aigcWork.coverUrl ? (
                  <Image
                    className="cd-aigc-cover"
                    src={data.aigcWork.coverUrl}
                    mode="aspectFill"
                  />
                ) : null}
                <View className="cd-aigc-info">
                  <Text className="cd-aigc-tag">{tt('circle.detail.aigcTag', 'AI 作品')}</Text>
                  <Text className="cd-aigc-title">{data.aigcWork.title}</Text>
                </View>
                <Text className="cd-aigc-arrow">›</Text>
              </View>
            ) : null}

            {data.topic ? (
              <View className="cd-topic" onClick={() => goTopic(data.topic!.id)}>
                <Text className="cd-topic-text">#{data.topic.name}</Text>
              </View>
            ) : null}
          </View>
        ) : null}

        <View className="cd-actions">
          <View className={`cd-action${liked ? ' active' : ''}`} onClick={onLike}>
            <Text className="cd-action-icon">{liked ? '❤' : '♡'}</Text>
            <Text className="cd-action-num">{data.likes || 0}</Text>
          </View>
          <View className="cd-action">
            <Text className="cd-action-icon">💬</Text>
            <Text className="cd-action-num">{data.comments || 0}</Text>
          </View>
          <View className={`cd-action${favorited ? ' active' : ''}`} onClick={onFavorite}>
            <Text className="cd-action-icon">{favorited ? '★' : '☆'}</Text>
            <Text className="cd-action-num">{data.favorites || 0}</Text>
          </View>
          <View className="cd-action" onClick={onShare}>
            <Text className="cd-action-icon">↗</Text>
            <Text className="cd-action-num">{data.shares || 0}</Text>
          </View>
        </View>

        <View className="cd-comments-section">
          <View className="cd-comments-head">
            <Text className="cd-comments-title">
              {tt('circle.detail.commentsTitle', '评论')} {commentTotal}
            </Text>
            {commentTotal > comments.length ? (
              <Text className="cd-comments-more" onClick={goCommentList}>
                {tt('circle.detail.viewMore', '查看更多')} ›
              </Text>
            ) : null}
          </View>
          {comments.length ? (
            <View className="cd-comments">
              {comments.map((c) => (
                <View key={c.id} className="cd-comment">
                  <Image
                    className="cd-comment-avatar"
                    src={c.avatar || defaultAvatar}
                    mode="aspectFill"
                  />
                  <View className="cd-comment-body">
                    <Text className="cd-comment-name">{c.nickname}</Text>
                    <Text className="cd-comment-content">{c.content}</Text>
                    <View className="cd-comment-foot">
                      <Text className="cd-comment-time">{c.createdAt}</Text>
                      <Text className="cd-comment-like">♡ {c.likes || 0}</Text>
                    </View>
                  </View>
                </View>
              ))}
            </View>
          ) : (
            <View className="cd-comments-empty">
              <Text>{tt('circle.detail.noComments', '暂无评论,快来抢沙发')}</Text>
            </View>
          )}
        </View>
      </ScrollView>

      <View className="cd-input-bar">
        <Input
          className="cd-input"
          value={commentText}
          placeholder={tt('circle.detail.commentPlaceholder', '说点什么…')}
          onInput={(e) => setCommentText(e.detail.value)}
          confirmType="send"
          onConfirm={onSendComment}
        />
        <Button
          className="cd-send"
          size="mini"
          loading={submitting}
          disabled={!commentText.trim() || submitting}
          onClick={onSendComment}
        >
          {tt('circle.detail.send', '发送')}
        </Button>
      </View>
    </View>
  )
}
