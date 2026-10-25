// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

// 对齐目标(RN 共享屏): packages/app/src/features/circle-detail/CircleDetailScreen.tsx
import { useTt } from '@/i18n'
import { logger } from '@/utils/logger'
import { View, Text, Image, Button, ScrollView } from '@tarojs/components'
import { FocusInput } from '@/components/FocusField'
import Taro, { useDidShow } from '@tarojs/taro'
import { useState, useCallback, useRef } from 'react'
import { getCircleDetail, get, post, del, type Circle } from '@/api'
import { formatDate } from '@/utils/time'
import ThemeRoot from '@/components/ThemeRoot'
import LineIcon from '@/components/LineIcon'
import { EmptyState } from '@/components/ScreenStates.taro'
import './detail.css'

/**
 * 评论行 = 后端 GET /circles/posts/:id/comments 直出的 circle_post_comments 原始列
 * (circles.ts:801 只 select 该表、未 join users ⇒ 作者昵称/头像是服务端从不给出的列,
 * 这里保留为可选只是为兼容后端补投影的那天,界面按"没有作者信息"如实渲染)。
 */
interface PostComment {
  id: string
  postId: string
  userId: string
  content: string
  pid?: string | null
  replyUserId?: string | null
  likeCount: number
  createdAt: string
  nickname?: string
  avatar?: string
}

/** 该 handler 回 `{ list, page, pageSize }` —— 没有 total,屏上计数只能如实记已加载条数 */
interface CommentPage {
  list: PostComment[]
  page: number
  pageSize: number
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
/** 后端评论列表不回 total ⇒ 满页是本页能如实给出的唯一"可能还有更多"信号 */
const COMMENT_PAGE_SIZE = 10

export default function CircleDetailPage() {
  const tt = useTt()

  const [data, setData] = useState<DetailExt>({} as DetailExt)
  const [comments, setComments] = useState<PostComment[]>([])
  const [liked, setLiked] = useState(false)
  const [favorited, setFavorited] = useState(false)
  const [following, setFollowing] = useState(false)
  const [id, setId] = useState('')
  const [commentText, setCommentText] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const loadedRef = useRef('')

  const loadAll = useCallback(
    async (qid: string) => {
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
        // 立因:原路径 /circles/:id/comments 后端从未注册(必 404,被下面的 catch 吞成"暂无评论");
        // 真形 = GET /circles/posts/:id/comments —— 本页承载的是帖子,不是圈子。
        const c = await get<CommentPage>(`/circles/posts/${qid}/comments`, {
          page: 1,
          pageSize: COMMENT_PAGE_SIZE,
        })
        setComments(c.list || [])
      } catch (e) {
        logger.error('circle/detail', '加载评论', e)
      }
    },
    [tt],
  )

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
    const prev = liked
    setLiked(!prev)
    setData((d) => ({ ...d, likes: (d.likes || 0) + (prev ? -1 : 1) }))
    try {
      // 真形 = POST /circles/posts/:id/like(circles.ts:749):请求体不带档位,后端自己 toggle 并回
      // {liked,likeCount} ⇒ 落库后一律以返回值覆盖乐观值,不让客户端算的数与后端互相打脸。
      const r = await post<{ liked?: boolean; likeCount?: number }>(`/circles/posts/${id}/like`)
      setLiked(r.liked ?? !prev)
      if (typeof r.likeCount === 'number') {
        const count = r.likeCount
        setData((d) => ({ ...d, likes: count }))
      }
    } catch (e) {
      logger.error('circle/detail', '点赞', e)
      setLiked(prev)
      setData((d) => ({ ...d, likes: (d.likes || 0) + (prev ? 1 : -1) }))
    }
  }, [id, liked])

  const onFavorite = useCallback(async () => {
    if (!id) return
    const prev = favorited
    const next = !prev
    setFavorited(next)
    setData((d) => ({ ...d, favorites: (d.favorites || 0) + (next ? 1 : -1) }))
    try {
      // 立因:收藏帖子没有专用端点,通用族是 POST /favorites(幂等"加收藏",回 {favorited:true})与
      // DELETE /favorites/:resourceType/:resourceId(回 {favorited:false}) —— 两个动词都不是 toggle,
      // 所以动词由当前档位决定,回来再以响应的 favorited 覆盖乐观值;resourceType 取 social.ts
      // FAVORITE_RESOURCE_TYPES 现值 'post'(与收藏列表页「帖子」tab 的跳转同源:那条 tab 就跳本页)。
      const r = next
        ? await post<{ favorited?: boolean }>('/favorites', {
            resourceType: 'post',
            resourceId: id,
          })
        : await del<{ favorited?: boolean }>(`/favorites/post/${id}`)
      const settled = r.favorited ?? next
      setFavorited(settled)
      if (settled !== next) {
        // 后端给的档位与乐观值相反 ⇒ 把刚才那次 ±1 原样退回
        setData((d) => ({ ...d, favorites: (d.favorites || 0) + (next ? -1 : 1) }))
      }
    } catch (e) {
      logger.error('circle/detail', '收藏', e)
      setFavorited(prev)
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
      // 真形 = POST /circles/posts/:id/comment(单数,circles.ts:824,body 只认 content/pid/replyUserId)
      await post(`/circles/posts/${id}/comment`, { content: text })
      setCommentText('')
      Taro.showToast({ title: tt('circle.detail.commentSent', '评论成功'), icon: 'success' })
      const c = await get<CommentPage>(`/circles/posts/${id}/comments`, {
        page: 1,
        pageSize: COMMENT_PAGE_SIZE,
      })
      setComments(c.list || [])
      setData((d) => ({ ...d, comments: (d.comments || 0) + 1 }))
    } catch (e) {
      logger.error('circle/detail', '发送评论', e)
    } finally {
      setSubmitting(false)
    }
  }, [commentText, id, submitting, tt])

  const goCommentList = useCallback(() => {
    // 项目暂无独立评论列表页(/pages/comment/* 未注册),降级为提示引导在本页评论区浏览
    Taro.showToast({ title: tt('circle.detail.commentListSoon', '评论列表即将开放'), icon: 'none' })
  }, [tt])

  const goAigcDetail = useCallback(() => {
    // /pkg-ai/aigc/detail 未注册,跳转到已注册的 AIGC 作品列表页
    Taro.navigateTo({ url: '/pkg-ai/aigc/list' })
  }, [])

  const goTopic = useCallback((topicId: string) => {
    Taro.navigateTo({ url: `/pkg-content/topic/detail?id=${topicId}` })
  }, [])

  const imgCount = data.images?.length || 0

  return (
    <ThemeRoot>
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
                <View className="cd-aigc-card" onClick={goAigcDetail} hoverClass="opacity-60">
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
                  <LineIcon name="chevron-right" size={24} color="var(--color-muted-foreground)" />
                </View>
              ) : null}

              {data.topic ? (
                <View
                  className="cd-topic"
                  onClick={() => goTopic(data.topic!.id)}
                  hoverClass="opacity-60"
                >
                  <Text className="cd-topic-text">#{data.topic.name}</Text>
                </View>
              ) : null}
            </View>
          ) : null}

          <View className="cd-actions">
            <View
              className={`cd-action${liked ? ' active' : ''}`}
              onClick={onLike}
              hoverClass="opacity-60"
            >
              <LineIcon
                name="heart"
                size={36}
                className="cd-action-icon"
                color={liked ? 'var(--color-brand)' : 'var(--color-muted-foreground)'}
              />
              <Text className="cd-action-num">{data.likes || 0}</Text>
            </View>
            <View className="cd-action">
              <LineIcon
                name="message-circle"
                size={36}
                className="cd-action-icon"
                color="var(--color-muted-foreground)"
              />
              <Text className="cd-action-num">{data.comments || 0}</Text>
            </View>
            <View
              className={`cd-action${favorited ? ' active' : ''}`}
              onClick={onFavorite}
              hoverClass="opacity-60"
            >
              <LineIcon
                name="star"
                size={36}
                className="cd-action-icon"
                color={favorited ? 'var(--color-brand)' : 'var(--color-text-medium)'}
              />
              <Text className="cd-action-num">{data.favorites || 0}</Text>
            </View>
            <View className="cd-action" onClick={onShare} hoverClass="opacity-60">
              <LineIcon
                name="share-2"
                size={36}
                className="cd-action-icon"
                color="var(--color-muted-foreground)"
              />
              <Text className="cd-action-num">{data.shares || 0}</Text>
            </View>
          </View>

          <View className="cd-comments-section">
            <View className="cd-comments-head">
              <Text className="cd-comments-title">
                {tt('circle.detail.commentsTitle', '评论')} {comments.length}
              </Text>
              {comments.length >= COMMENT_PAGE_SIZE ? (
                <View className="cd-comments-more" onClick={goCommentList} hoverClass="opacity-60">
                  <Text>{tt('common.more', '更多')}</Text>
                  <LineIcon name="chevron-right" size={24} color="var(--color-muted-foreground)" />
                </View>
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
                      <Text className="cd-comment-name">{c.nickname || tt('common.user', '用户')}</Text>
                      <Text className="cd-comment-content">{c.content}</Text>
                      <View className="cd-comment-foot">
                        <Text className="cd-comment-time">
                          {formatDate(c.createdAt, 'YYYY-MM-DD HH:mm')}
                        </Text>
                        <View className="cd-comment-like flex items-center gap-[8rpx]">
                          <LineIcon name="heart" size={24} color="var(--color-muted-foreground)" />
                          <Text>{c.likeCount || 0}</Text>
                        </View>
                      </View>
                    </View>
                  </View>
                ))}
              </View>
            ) : (
              <EmptyState title={tt('circle.detail.noComments', '暂无评论,快来抢沙发')} />
            )}
          </View>
        </ScrollView>

        <View className="cd-input-bar">
          <FocusInput
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
    </ThemeRoot>
  )
}
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
