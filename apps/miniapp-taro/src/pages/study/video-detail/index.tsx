// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

// 对齐目标(RN 共享屏): packages/app/src/features/video-player/VideoPlayerScreen.tsx
// 2026-11-15 薄壳化:信息块/互动条/进度/tab 骨架/付费弹层由共享屏渲染;本页只留取数、
// 评论提交、观看心跳与标记学完、付费跳转、分享注册、tab 状态;播放器仍用小程序原生组件。
import { useI18n, useTt } from '@/i18n'
import { useTheme } from '@/rn-compat/theme'
// G-815966:百分比裁剪走具名唯一出口,不再内联手搓(棘轮门基线 0)
import { clampPercent } from '@ihui/shared/utils/clamp-percent'
import Taro, { useDidShow, useShareAppMessage, useShareTimeline } from '@tarojs/taro'
import type { OnNavigate } from '@ihui/types'
import { useCallback, useEffect, useRef, useState, type ReactNode } from 'react'
import { get, getStudyRecords, getVideoDetail, post } from '@/api'
import { useAuthReadyGate } from '@/hooks/use-auth-ready-gate'
import ThemeRoot from '@/components/ThemeRoot'
import {
  Catalog,
  Comment,
  Introduction,
  VideoPlayer,
  type ChapterItem,
  type CommentItem,
  type PayInfo,
  type VideoTabKey,
} from '@/components'
import { onToast } from '@/host/on-toast'
import { VideoPlayerScreen } from '@ihui/rn-app/features/video-player/VideoPlayerScreen'

/** 详情回包只列本页用到的列;付费四列(支付方式/人群/价格/VIP)就是 PayPopup 的 PayInfo */
type Video = {
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
} & Partial<PayInfo>

/** 学习记录行(只用到 progress/status 两列) */
type StudyRow = { lessonId?: string; progress?: number; status?: string }

/** 共享屏本轮只 assert onNavigate、尚未调用它;但**不能给空实现** —— host/ports 的空实现黑名单
 *  会让 dev 直接 throw,所以照 teacher/detail 的形制挂一个"被调用就报未接入"的真实现。 */
const onNavigate: OnNavigate = (target) => {
  onToast(`导航未接入: ${target}`, { kind: 'error' })
}

export default function VideoDetailPage() {
  const { t } = useI18n()
  const tt = useTt()
  const { resolvedTheme } = useTheme()
  const { waitUntilReady } = useAuthReadyGate()
  const [info, setInfo] = useState<Video>({ id: '', title: '' })
  const [loading, setLoading] = useState(true)
  const [cur, setCur] = useState('')
  const [tab, setTab] = useState<VideoTabKey>('catalog')
  // 赞/藏只有本地乐观值(原页不打后端);分享开右上角菜单
  const [liked, setLiked] = useState(false)
  const [favorited, setFavorited] = useState(false)
  const [likeCount, setLikeCount] = useState(0)
  const [favCount, setFavCount] = useState(0)
  const [comments, setComments] = useState<CommentItem[]>([])
  const [input, setInput] = useState('')
  const [showPay, setShowPay] = useState(false)
  const [payInfo, setPayInfo] = useState<PayInfo>({})
  // 学习进度取自 GET /study/records 里本课那条(需鉴权 ⇒ 挡到冷启动门后);
  // 「标记学完」走 POST /study/progress,位置报满秒数后后端把 status 落成 2
  const [percent, setPercent] = useState(0)
  const [done, setDone] = useState(false)
  const [completing, setCompleting] = useState(false)
  // 进度上报节流:每 15s 一跳,lesson_records.watch_duration 靠它累计(G-978071)
  const lastTick = useRef(0)
  // 分享与共享屏同源(share.appTitle / share.timelineTitle),落点按本页 router 兜底
  useShareAppMessage(() => ({
    title: t('share.appTitle'),
    path: `/pages/study/video-detail/index?id=${info.id}`,
  }))
  useShareTimeline(() => ({ title: t('share.timelineTitle') }))

  const loadComments = useCallback(
    async (videoId: string) => {
      try {
        const res = await get<{ list?: CommentItem[] }>('/learn/video/comments', {
          videoId,
          page: 1,
          pageSize: 20,
        })
        // 只取这五列(不透传接口多带的 replies),昵称兜底"我"、时间截到日:沿用原页口径
        setComments(
          (res.list ?? []).map(({ id, content, nickname, avatar, createdAt }) => ({
            id,
            content,
            nickname: nickname || t('study.videoDetail.me'),
            avatar: avatar ?? undefined,
            createdAt: createdAt?.slice(0, 10),
          })),
        )
      } catch {
        // 评论加载失败不打断视频主流程
      }
    },
    [t],
  )

  const load = useCallback(async () => {
    const opts = Taro.getCurrentPages().pop()?.options || {}
    // 优先 id,courseId 兜底(从课程章节点进来时只有 courseId)
    const videoId = (opts.id || opts.courseId || '') as string
    if (!videoId) return setLoading(false)
    setLoading(true)
    try {
      const res = (await getVideoDetail(videoId)) as Video
      setInfo(res)
      // lessonIdx 指第几节;越界/缺省都落首节
      const chapters = res.chapters ?? []
      setCur(chapters[Number(opts.lessonIdx)]?.id ?? chapters[0]?.id ?? '')
      void loadComments(res.id)
      const { payType, payCrowd, amount, isVip, title } = res
      setPayInfo({ payType, payCrowd, amount, isVip, title })
    } catch {
      // 详情失败留空壳:没有 playUrl 时共享屏自己显示「无播放地址」
    } finally {
      setLoading(false)
    }
  }, [loadComments])

  useDidShow(load)

  // 本课学习记录:只读 progress/status 两列;未登录 / 无记录 / 失败一律按 0% 展示,不阻塞播放。
  useEffect(() => {
    const lessonId = info.courseId
    if (!lessonId) return
    return waitUntilReady(() =>
      getStudyRecords({ page: 1, pageSize: 50 })
        .then((res) => {
          const row = ((res.list || []) as StudyRow[]).find((r) => r.lessonId === lessonId)
          if (!row) return
          setPercent(Number(row.progress ?? 0))
          setDone(row.status === 'completed')
        })
        .catch(() => undefined),
    )
  }, [info.courseId, waitUntilReady])

  const pick = (chapter: ChapterItem) => setCur(chapter.id)

  // 评论真实提交(comments 表 resourceType='lesson_video'):先乐观插入让「刚发出」立刻可见,
  // 再由服务端回包覆盖;失败必须把输入还给用户,否则一次网络抖动就吃掉评论(G-978071)
  const submitComment = () => {
    const content = input.trim()
    if (!content || !info.id) return
    const optimistic: CommentItem = {
      id: `optimistic-${Date.now()}`,
      content,
      nickname: t('study.videoDetail.me'),
      createdAt: t('study.videoDetail.justNow'),
    }
    setInput('')
    setComments((prev) => [optimistic, ...prev])
    post('/learn/video/comment', { videoId: info.id, content })
      .then(() => loadComments(info.id))
      .catch(() => {
        setComments((prev) => prev.filter((c) => c.id !== optimistic.id))
        setInput(content)
        onToast(t('common.failed'), { kind: 'error' })
      })
  }

  // 观看进度上报:每 15s 一跳,后台靠它累计今日时长与排行榜(G-978071);
  // 首帧只记起点不上报,否则「刚进就退」会被算成一次观看
  const onTimeUpdate = useCallback(
    (currentTime: number) => {
      const prev = lastTick.current
      const now = Date.now()
      if (!info.id) return
      if (!prev) return void (lastTick.current = now)
      if (now - prev < 15000) return
      lastTick.current = now
      void post('/study/progress', {
        lessonId: info.id,
        sectionId: cur || undefined,
        position: Math.floor(currentTime),
        duration: Math.min(60, Math.round((now - prev) / 1000)),
      }).catch(() => undefined)
    },
    [info.id, cur],
  )

  const toggleLike = () => {
    setLiked(!liked)
    setLikeCount((n) => (liked ? n - 1 : n + 1))
  }
  const toggleFavorite = () => {
    setFavorited(!favorited)
    setFavCount((n) => (favorited ? n - 1 : n + 1))
  }
  const openShare = () => void Taro.showShareMenu({ withShareTicket: true })

  // 标记学完:位置报满本片秒数由后端落 status=2,回包 completed 决定徽章(G-978071)
  const markCompleted = async () => {
    const lessonId = info.courseId
    if (!lessonId || completing) return
    setCompleting(true)
    try {
      const res = await post<{ progress?: number; completed?: boolean }>('/study/progress', {
        lessonId,
        sectionId: info.id || undefined,
        position: Math.max(0, Math.floor(Number(info.duration) || 0)),
        duration: 0,
      })
      setPercent(Number(res?.progress ?? 0))
      if (res?.completed) setDone(true)
    } catch {
      onToast(t('common.failed'), { kind: 'error' })
    } finally {
      setCompleting(false)
    }
  }

  const ch = info.chapters ?? []
  const total = ch.length
  // 已学节数只在「本次会话标记学完」或「记录已是 completed」时有确定值,不猜历史完成数
  const lessonPercent = done ? 100 : clampPercent(percent)
  // 单节口径进共享屏:没有章节就不画进度块(与原页一致)
  const sharedProgress = total
    ? {
        courseId: info.courseId ?? '',
        totalLessons: total,
        completedLessons: done ? total : 0,
        progress: percent,
        lastLearnedAt: null,
      }
    : null
  // 信息块元信息文案:讲师/时长前缀与章节数都按原页(VideoInfo)口径在端侧本地化后整串注入,
  // 共享屏只做拼接,不写中文(video.* 词条已在小程序语包内)
  const teacherLabel = tt('video.teacher', '讲师')
  const durationLabel = tt('video.duration', '时长')
  const chapterCountLabel = total ? tt('video.chapterCount', '共 {n} 节', { n: total }) : undefined
  // 付费弹层文案:逐字沿用 PayPopup 价格区/按键区词条,不另立措辞
  const amountText = `¥${((payInfo.amount ?? 0) / 100).toFixed(2)}`
  const priceLabel =
    (payInfo.payType ?? 0) === 0
      ? tt('common.free', '免费')
      : payInfo.payType === 1 && (payInfo.payCrowd ?? 0) === 0
        ? tt('pay.limitedFree', '限时免费')
        : payInfo.payCrowd === 1 && (payInfo.isVip ?? 0) > 0
          ? tt('pay.memberFree', '会员免费')
          : amountText
  const payAction =
    priceLabel === amountText ? `${tt('pay.buyNow', '立即支付')} ${amountText}` : priceLabel
  // 目录/简介/评论正文整块由端侧渲染:共享屏只给容器,不假设内部结构
  const bodies: Record<string, ReactNode> = {
    catalog: <Catalog chapters={ch} currentId={cur} loading={loading} onSelect={pick} />,
    intro: <Introduction content={info.description} />,
    comment: (
      <Comment comments={comments} inputValue={input} onInput={setInput} onSubmit={submitComment} />
    ),
  }

  return (
    <ThemeRoot>
      <VideoPlayerScreen
        t={t}
        title={info.title}
        videoUrl={info.playUrl}
        progress={sharedProgress}
        completed={done}
        completing={completing}
        loading={loading}
        error=""
        onComplete={() => void markCompleted()}
        onBack={() => void Taro.navigateBack()}
        colorScheme={resolvedTheme}
        onNavigate={onNavigate}
        playerContent={
          <VideoPlayer
            src={info.playUrl}
            poster={info.coverUrl}
            loading={loading}
            onTimeUpdate={onTimeUpdate}
          />
        }
        ports={{
          // 原生导航栏已承担标题与返回 ⇒ 不画共享屏黑条,否则同屏两条标题栏
          showHeader: false,
          // 原页播放器常驻、正文区才占位:首屏加载期间别用整屏骨架吞掉播放器
          keepPlayerWhileLoading: true,
          info: {
            ...info,
            chapterCount: total,
            teacherLabel,
            durationLabel,
            chapterCountLabel,
            onPressShare: openShare,
          },
          actions: {
            liked,
            favorited,
            likeCount,
            favoriteCount: favCount,
            shareCount: 0,
            onLike: toggleLike,
            onFavorite: toggleFavorite,
            onShare: openShare,
            // 原页计数为 0 时图标下有文字,不是裸图标
            labels: {
              like: tt('action.like', '点赞'),
              favorite: tt('action.favorite', '收藏'),
              share: tt('action.share', '分享'),
            },
          },
          progressPercent: total
            ? { percent: lessonPercent, completed: done, onMarkCompleted: markCompleted }
            : undefined,
          tabs: {
            options: [
              { key: 'catalog', label: t('study.videoDetail.tabsCatalog'), count: total },
              { key: 'intro', label: t('study.videoDetail.tabsIntro') },
              { key: 'comment', label: t('study.videoDetail.tabsComment'), count: comments.length },
            ],
            value: tab,
            onChange: (key) => setTab(key as VideoTabKey),
            renderBody: (key) => bodies[key] ?? null,
          },
          paySheet: {
            visible: showPay,
            title: payInfo.title || tt('pay.purchaseContent', '购买内容'),
            description: priceLabel,
            actionLabel: payAction,
            onClose: () => setShowPay(false),
            onPay: () => {
              setShowPay(false)
              void Taro.navigateTo({ url: '/pkg-shop/pay/index' })
            },
          },
        }}
      />
    </ThemeRoot>
  )
}
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
