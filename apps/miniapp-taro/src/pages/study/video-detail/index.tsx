import { View } from '@tarojs/components'
import Taro, { useDidShow } from '@tarojs/taro'
import { useState, useCallback } from 'react'
import { getVideoDetail } from '@/api'
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
    const id = (current?.options?.id || '') as string
    if (!id) {
      setLoading(false)
      return
    }
    setLoading(true)
    try {
      const res = (await getVideoDetail(id)) as VideoData
      setInfo(res)
      const firstChapter = res.chapters?.[0]
      if (firstChapter) setCurrentChapter(firstChapter.id)
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
      nickname: '我',
      createdAt: '刚刚',
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
    <View className="min-h-screen bg-[#f7f8fa]">
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

      <View className="mx-3 mt-3 bg-white rounded-xl overflow-hidden">
        <VideoTabs
          tabs={[
            { key: 'catalog', label: '目录', count: info.chapters?.length },
            { key: 'intro', label: '简介' },
            { key: 'comment', label: '评论', count: comments.length },
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
