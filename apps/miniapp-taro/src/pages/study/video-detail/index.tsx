// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

import { useI18n } from '@/i18n'
import { View } from '@tarojs/components'
import Taro, { useDidShow } from '@tarojs/taro'
import { useState, useCallback, useRef } from 'react'
import { getVideoDetail, get, post } from '@/api'
import ThemeRoot from '@/components/ThemeRoot'
import {
  VideoPlayer,
  VideoInfo,
  VideoTabs,
  LikeFavoriteShare,
  Catalog,
  Introduction,
  Comment,
  PayPopup,
  type VideoTabKey,
  type ChapterItem,
  type CommentItem,
  type PayInfo,
} from '@/components'

interface VideoData {
  id: string
  title: string
  coverUrl?: string
  playUrl?: string
  duration?: string
  description?: string
  teacher?: string
  tags?: string[]
  chapters?: ChapterItem[]
  payType?: number
  payCrowd?: number
  amount?: number
  isVip?: number
}

export default function VideoDetailPage() {
  const { t } = useI18n()
  const [info, setInfo] = useState<VideoData>({ id: '', title: '' })
  const [loading, setLoading] = useState(true)
  const [currentChapter, setCurrentChapter] = useState<string>('')
  const [activeTab, setActiveTab] = useState<VideoTabKey>('catalog')
  const [liked, setLiked] = useState(false)
  const [favorited, setFavorited] = useState(false)
  const [likeCount, setLikeCount] = useState(0)
  const [favoriteCount, setFavoriteCount] = useState(0)
  const [shareCount] = useState(0)
  const [comments, setComments] = useState<CommentItem[]>([])
  const [commentInput, setCommentInput] = useState('')
  const [showPay, setShowPay] = useState(false)
  const [payInfo, setPayInfo] = useState<PayInfo>({})
  // 进度上报节流:每 15s 上报一次观看增量(lesson_records.watch_duration 累计,G-978071)
  const lastTickRef = useRef(0)

  interface VideoCommentRow {
    id: string
    content: string
    nickname?: string | null
    avatar?: string | null
    createdAt?: string | null
  }

  const loadComments = useCallback(
    async (videoId: string) => {
      try {
        const res = await get<{ list?: VideoCommentRow[] }>('/learn/video/comments', {
          videoId,
          page: 1,
          pageSize: 20,
        })
        setComments(
          (res.list ?? []).map((c) => ({
            id: c.id,
            content: c.content,
            nickname: c.nickname || t('study.videoDetail.me'),
            avatar: c.avatar ?? undefined,
            createdAt: c.createdAt ? c.createdAt.slice(0, 10) : undefined,
          })),
        )
      } catch {
        // 评论加载失败不打断视频主流程
      }
    },
    [t],
  )

  const load = useCallback(async () => {
    const pages = Taro.getCurrentPages()
    const current = pages[pages.length - 1]
    const options = current?.options || {}
    const id = (options.id || '') as string
    const courseId = (options.courseId || '') as string
    const lessonIdx = Number(options.lessonIdx)
    // 优先用 id,若 id 不存在则用 courseId 从课程章节列表加载
    const videoId = id || courseId
    if (!videoId) {
      setLoading(false)
      return
    }
    setLoading(true)
    try {
      const res = (await getVideoDetail(videoId)) as VideoData
      setInfo(res)
      // 若有 lessonIdx,从课程章节列表中查找对应 lesson;否则默认首个章节
      const chapters = res.chapters || []
      const targetChapter =
        !Number.isNaN(lessonIdx) && lessonIdx >= 0 && lessonIdx < chapters.length
          ? chapters[lessonIdx]
          : chapters[0]
      if (targetChapter) setCurrentChapter(targetChapter.id)
      void loadComments(res.id)
      setPayInfo({
        payType: res.payType,
        payCrowd: res.payCrowd,
        amount: res.amount,
        isVip: res.isVip,
        title: res.title,
      })
    } catch {
      // ignore
    } finally {
      setLoading(false)
    }
  }, [loadComments])

  useDidShow(load)

  const handleChapterSelect = (chapter: ChapterItem) => {
    setCurrentChapter(chapter.id)
  }

  // 评论真实提交(comments 表 resourceType='lesson_video'),失败还原输入并提示(G-978071);
  // 成功先做乐观插入(时间显示"刚刚"),随后服务端刷新覆盖
  const handleSubmitComment = () => {
    const content = commentInput.trim()
    if (!content) return
    const videoId = info.id
    if (!videoId) return
    setCommentInput('')
    const optimistic: CommentItem = {
      id: `optimistic-${Date.now()}`,
      content,
      nickname: t('study.videoDetail.me'),
      createdAt: t('study.videoDetail.justNow'),
    }
    setComments((prev) => [optimistic, ...prev])
    post('/learn/video/comment', { videoId, content })
      .then(() => loadComments(videoId))
      .catch(() => {
        setComments((prev) => prev.filter((c) => c.id !== optimistic.id))
        setCommentInput(content)
        Taro.showToast({ title: t('common.failed'), icon: 'none' })
      })
  }

  // 观看进度上报:每 15s 一跳,lesson_records 聚合出今日时长/排行榜数据(G-978071)
  const handleTimeUpdate = useCallback(
    (currentTime: number, _duration: number) => {
      const lessonId = info.id
      if (!lessonId) return
      const now = Date.now()
      const last = lastTickRef.current
      if (!last) {
        lastTickRef.current = now
        return
      }
      if (now - last < 15000) return
      const delta = Math.min(60, Math.round((now - last) / 1000))
      lastTickRef.current = now
      void post('/study/progress', {
        lessonId,
        sectionId: currentChapter || undefined,
        position: Math.floor(currentTime),
        duration: delta,
      }).catch(() => {
        // 进度上报失败静默,不干扰播放
      })
    },
    [info.id, currentChapter],
  )

  const handleLike = () => {
    setLiked(!liked)
    setLikeCount(liked ? likeCount - 1 : likeCount + 1)
  }

  const handleFavorite = () => {
    setFavorited(!favorited)
    setFavoriteCount(favorited ? favoriteCount - 1 : favoriteCount + 1)
  }

  const handleShare = () => {
    Taro.showShareMenu({ withShareTicket: true })
  }

  // 播放器入参取局部值(避免 JSX 里长成员链被重排后与既有行形态碰撞)
  const playUrl = info.playUrl
  const coverUrl = info.coverUrl

  return (
    <ThemeRoot>
      {/* 对齐 RN VideoPlayerScreen(共享屏):容器 bg gray.black(明暗同值,黑底播放器沉浸式);播放器以下 body 对齐 RN body surface.light(亮色白底,暗色按语义 token 取 card 深色保证可读) */}
      <View className="min-h-screen flex flex-col bg-[var(--color-black)]">
        <VideoPlayer
          src={playUrl}
          poster={coverUrl}
          loading={loading}
          onTimeUpdate={handleTimeUpdate}
        />

        <View className="flex-1 bg-card pb-[64rpx]">
          <VideoInfo
            info={{
              title: info.title,
              description: info.description,
              teacher: info.teacher,
              duration: info.duration,
              chapterCount: info.chapters?.length,
              tags: info.tags,
            }}
          />

          <LikeFavoriteShare
            likeCount={likeCount}
            favoriteCount={favoriteCount}
            shareCount={shareCount}
            liked={liked}
            favorited={favorited}
            onLike={handleLike}
            onFavorite={handleFavorite}
            onShare={handleShare}
          />

          {/* tab 区卡片对齐 RN card 语言:radius 12dp→24rpx + border light(共享组件 VideoTabs/Catalog/Introduction/Comment 调用保持不变) */}
          <View className="mx-[24rpx] mt-[24rpx] bg-card border border-border rounded-lg overflow-hidden">
            <VideoTabs
              tabs={[
                {
                  key: 'catalog',
                  label: t('study.videoDetail.tabsCatalog'),
                  count: info.chapters?.length,
                },
                { key: 'intro', label: t('study.videoDetail.tabsIntro') },
                {
                  key: 'comment',
                  label: t('study.videoDetail.tabsComment'),
                  count: comments.length,
                },
              ]}
              active={activeTab}
              onChange={setActiveTab}
            />

            {activeTab === 'catalog' && (
              <Catalog
                chapters={info.chapters}
                currentId={currentChapter}
                loading={loading}
                onSelect={handleChapterSelect}
              />
            )}

            {activeTab === 'intro' && <Introduction content={info.description} />}

            {activeTab === 'comment' && (
              <Comment
                comments={comments}
                inputValue={commentInput}
                onInput={setCommentInput}
                onSubmit={handleSubmitComment}
              />
            )}
          </View>
        </View>

        <PayPopup
          visible={showPay}
          pay={payInfo}
          onClose={() => setShowPay(false)}
          onPay={() => {
            setShowPay(false)
            Taro.navigateTo({ url: '/pkg-shop/pay/index' })
          }}
        />
      </View>
    </ThemeRoot>
  )
}
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
