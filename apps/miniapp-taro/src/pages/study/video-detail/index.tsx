import { View } from '@tarojs/components'
import Taro, { useDidShow } from '@tarojs/taro'
import { useState, useCallback } from 'react'
import { getVideoDetail } from '@/api'
import { useI18n } from '@/i18n'
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
  }, [])

  useDidShow(load)

  const handleChapterSelect = (chapter: ChapterItem) => {
    setCurrentChapter(chapter.id)
  }

  const handleSubmitComment = () => {
    if (!commentInput.trim()) return
    const newComment: CommentItem = {
      id: Date.now().toString(),
      content: commentInput.trim(),
      nickname: t('study.videoDetail.me'),
      createdAt: t('study.videoDetail.justNow'),
    }
    setComments([newComment, ...comments])
    setCommentInput('')
  }

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

  return (
    <View className="min-h-screen bg-background">
      <VideoPlayer src={info.playUrl} poster={info.coverUrl} loading={loading} />

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

      <View className="mx-3 mt-3 bg-card rounded-xl overflow-hidden">
        <VideoTabs
          tabs={[
            {
              key: 'catalog',
              label: t('study.videoDetail.tabsCatalog'),
              count: info.chapters?.length,
            },
            { key: 'intro', label: t('study.videoDetail.tabsIntro') },
            { key: 'comment', label: t('study.videoDetail.tabsComment'), count: comments.length },
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

      <PayPopup
        visible={showPay}
        pay={payInfo}
        onClose={() => setShowPay(false)}
        onPay={() => {
          setShowPay(false)
          Taro.navigateTo({ url: '/pages/pay/index' })
        }}
      />
    </View>
  )
}
