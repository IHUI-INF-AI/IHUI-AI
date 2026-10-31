// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

// 镜像 packages/app/src/features/video-player/VideoPlayerScreen.tsx
import { useI18n } from '@/i18n'
import { View, Text } from '@tarojs/components'
import Taro, { useDidShow } from '@tarojs/taro'
import { useState, useCallback, useEffect, useRef } from 'react'
import { getVideoDetail, get, getStudyRecords, post } from '@/api'
import { useAuthReadyGate } from '@/hooks/use-auth-ready-gate'
import ThemeRoot from '@/components/ThemeRoot'
import LineIcon from '@/components/LineIcon'
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
  /** 所属课程 id(lessonId):学习记录按它查,标记学完也按它报 */
  courseId?: string
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
  /**
   * 学习进度块(RN 共享屏 body 里的 progress 区):进度取 GET /study/records 里本课那条记录的
   * progress/status(需鉴权 ⇒ 挡到冷启动门后);「标记学完」走 POST /study/progress,
   * 本节位置报满秒数后后端把 status 落成 2,再用回包的 completed 决定徽章。
   */
  const { waitUntilReady } = useAuthReadyGate()
  const [lessonProgress, setLessonProgress] = useState(0)
  const [lessonCompleted, setLessonCompleted] = useState(false)
  const [doneSections, setDoneSections] = useState<string[]>([])
  const [completing, setCompleting] = useState(false)
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

  // 本课学习记录:只读 progress/status 两列用于进度条与「已学完」判定;
  // 未登录 / 无记录 / 请求失败一律按"还没有记录(0%)"展示,不阻塞播放。
  useEffect(() => {
    const lessonId = info.courseId
    if (!lessonId) return
    return waitUntilReady(() => {
      getStudyRecords({ page: 1, pageSize: 50 })
        .then((res) => {
          const row = (res.list || []).find(
            (r) => (r as { lessonId?: string }).lessonId === lessonId,
          )
          if (!row) return
          setLessonProgress(Number(row.progress ?? 0))
          setLessonCompleted((row as { status?: string }).status === 'completed')
        })
        .catch(() => {
          /* 未登录 / 无记录:进度按 0 展示 */
        })
    })
  }, [info.courseId, waitUntilReady])

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

  const handleComplete = useCallback(async () => {
    const lessonId = info.courseId
    if (!lessonId || completing) return
    setCompleting(true)
    try {
      const res = await post<{ progress?: number; completed?: boolean }>('/study/progress', {
        lessonId,
        ...(info.id ? { sectionId: info.id } : {}),
        position: Math.max(0, Math.floor(Number(info.duration) || 0)),
        duration: 0,
      })
      setLessonProgress(Number(res?.progress ?? 0))
      if (res?.completed) {
        setLessonCompleted(true)
        setDoneSections((prev) => (info.id && !prev.includes(info.id) ? [...prev, info.id] : prev))
      }
    } catch {
      Taro.showToast({ title: t('common.failed'), icon: 'none' })
    } finally {
      setCompleting(false)
    }
  }, [info.courseId, info.id, info.duration, completing, t])

  // 播放器入参取局部值(避免 JSX 里长成员链被重排后与既有行形态碰撞)
  const playUrl = info.playUrl
  const coverUrl = info.coverUrl
  const totalSections = info.chapters?.length ?? 0
  // 已学节数只在"本次会话标记学完"或"记录已是 completed"时有确定值,不猜历史完成数
  const doneSectionsCount = lessonCompleted ? totalSections : doneSections.length
  const progressPercent = lessonCompleted ? 100 : Math.min(100, Math.max(0, lessonProgress))

  return (
    <ThemeRoot>
      {/* 对齐 RN VideoPlayerScreen(共享屏):容器 bg gray.black(明暗同值,黑底播放器沉浸式);播放器以下 body 对齐 RN body surface.light(亮色白底,暗色按语义 token 取 card 深色保证可读) */}
      <View className="min-h-screen flex flex-col bg-[var(--color-black)]">
        {/* 对齐 RN 共享屏的 noUrl 空态:付费未报名 / 无播址时不给黑屏,直接说清"暂无播放地址" */}
        {loading || playUrl ? (
          <VideoPlayer
            src={playUrl}
            poster={coverUrl}
            loading={loading}
            onTimeUpdate={handleTimeUpdate}
          />
        ) : (
          <View className="flex h-[420rpx] flex-col items-center justify-center px-[32rpx] bg-[var(--color-black)]">
            <Text className="text-body font-semibold text-[var(--color-surface-light)]">
              {t('player.noUrl')}
            </Text>
            <Text className="mt-[12rpx] text-label text-[var(--color-muted-foreground)]">
              {t('course.player')}
            </Text>
          </View>
        )}

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

          {/* 对齐 RN 共享屏 body 的「学习进度」块:进度条 + 已学节数 + 标记学完/已学完 */}
          {totalSections > 0 ? (
            <View className="mx-[24rpx] mt-[24rpx] bg-card border border-border rounded-lg p-[28rpx]">
              <Text className="block text-[length:30rpx] font-semibold text-foreground">
                {t('course.progress')}
              </Text>
              <View className="mt-[20rpx] h-[12rpx] w-full overflow-hidden rounded-md bg-muted">
                <View
                  className="h-full rounded-md bg-primary"
                  style={{ width: `${progressPercent}%` }}
                />
              </View>
              <View className="mt-[16rpx] flex flex-row items-center justify-between">
                <Text className="text-label text-muted-foreground">
                  {t('course.progressLessons', {
                    completed: doneSectionsCount,
                    total: totalSections,
                  })}
                </Text>
                {lessonCompleted ? (
                  <View className="flex flex-row items-center gap-[8rpx] rounded-md bg-[var(--color-success-light)] px-[16rpx] py-[6rpx]">
                    <LineIcon name="check" size={24} color="var(--color-success)" />
                    <Text className="text-label font-semibold text-[var(--color-success)]">
                      {t('course.completed')}
                    </Text>
                  </View>
                ) : (
                  <View
                    className={`rounded-md bg-cta px-[20rpx] py-[8rpx] ${completing ? 'opacity-60' : ''}`}
                    hoverClass="opacity-60"
                    onClick={handleComplete}
                  >
                    <Text className="text-label font-semibold text-cta-foreground">
                      {completing ? t('common.loading') : t('course.complete')}
                    </Text>
                  </View>
                )}
              </View>
            </View>
          ) : null}

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
