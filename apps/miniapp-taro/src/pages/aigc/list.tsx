import { View, Text, Image, ScrollView, Video } from '@tarojs/components'
import Taro, { usePullDownRefresh, useReachBottom } from '@tarojs/taro'
import { useState, useCallback, useEffect, useRef } from 'react'
import { getAigcList } from '@/api'
import { useI18n } from '@/i18n'
import './list.css'

/** 文件类型枚举(对标原项目 fileType: 0=图片 1=视频 3=音频 4=文本) */
type Category = 'all' | 'text' | 'image' | 'video' | 'audio'

interface AigcItem {
  id: string | number
  title: string
  author: string
  coverUrl: string
  fileUrl: string
  fileType: number
  content: string
  context: string
  prompt: string
  time: string
  likes: number
  duration: number
}

const PAGE_SIZE = 10

const FILE_TYPE_TO_CATEGORY: Record<number, Category> = {
  0: 'image',
  1: 'video',
  3: 'audio',
  4: 'text',
}

/**
 * Mock 数据 — API 失败或返回空时使用,保证视觉演示完整。
 * 真实数据由 getAigcList 返回,字段对齐原项目(coverUrl/fileUrl/fileType/likes/context/prompt/time)。
 */
const MOCK_LIST: AigcItem[] = [
  { id: 'm1', title: '赛博城市夜景', author: '智汇小方', coverUrl: 'https://picsum.photos/320/440?1', fileUrl: '', fileType: 0, content: '', context: '', prompt: '', time: '2026-07-15 10:24', likes: 128, duration: 0 },
  { id: 'm2', title: '极光幻境', author: 'AI创作家', coverUrl: 'https://picsum.photos/320/360?2', fileUrl: '', fileType: 0, content: '', context: '', prompt: '', time: '2026-07-14 18:30', likes: 256, duration: 0 },
  { id: 'm3', title: '机械姬 Concept', author: '未来派', coverUrl: 'https://picsum.photos/320/500?3', fileUrl: 'https://www.w3schools.com/html/mov_bbb.mp4', fileType: 1, content: '', context: '', prompt: '', time: '2026-07-13 22:10', likes: 89, duration: 0 },
  { id: 'm4', title: '量子诗篇', author: '智汇小方', coverUrl: '', fileUrl: '', fileType: 4, content: '在数据洪流中,我们以代码为笔,以算法为墨,描绘着数字时代的诗与远方。每一段文字都是思想的延伸,每一次生成都是创造的开始。', context: '以"数据洪流"为意象,生成一段关于数字时代创作的散文诗。', prompt: '数据洪流 数字时代 诗', time: '2026-07-12 09:15', likes: 67, duration: 0 },
  { id: 'm5', title: '霓虹脉搏', author: '声音艺术家', coverUrl: 'https://picsum.photos/240/240?audio1', fileUrl: 'https://www.w3schools.com/html/horse.mp3', fileType: 3, content: '', context: '', prompt: '', time: '2026-07-11 14:00', likes: 145, duration: 183 },
  { id: 'm6', title: '未来之城', author: '数字画师', coverUrl: 'https://picsum.photos/320/440?4', fileUrl: '', fileType: 0, content: '', context: '', prompt: '', time: '2026-07-10 11:45', likes: 312, duration: 0 },
  { id: 'm7', title: 'AI 觉醒录', author: '智汇小方', coverUrl: '', fileUrl: '', fileType: 4, content: '当机器开始思考,人类是否做好了准备?这是一个关于意识、自由与共存的故事。在硅基生命与碳基生命的交汇处,我们重新审视"存在"的意义。', context: '探讨 AI 觉醒后的人类处境,生成一段哲思短文。', prompt: 'AI 觉醒 意识 共存', time: '2026-07-09 20:30', likes: 198, duration: 0 },
  { id: 'm8', title: '深空回响', author: '声音艺术家', coverUrl: 'https://picsum.photos/240/240?audio2', fileUrl: 'https://www.w3schools.com/html/horse.mp3', fileType: 3, content: '', context: '', prompt: '', time: '2026-07-08 16:20', likes: 92, duration: 240 },
]

function asString(v: unknown): string {
  return typeof v === 'string' ? v : ''
}

function asNumber(v: unknown, fallback = 0): number {
  const n = Number(v)
  return Number.isFinite(n) ? n : fallback
}

function normalizeItem(raw: Record<string, unknown>): AigcItem {
  const id = raw['id'] as string | number | undefined
  return {
    id: id ?? Math.random().toString(36).slice(2),
    title: asString(raw['title']) || asString(raw['subtitle']),
    author: asString(raw['author']) || asString(raw['nickname']),
    coverUrl: asString(raw['coverUrl']) || asString(raw['fileUrl']),
    fileUrl: asString(raw['fileUrl']),
    fileType: asNumber(raw['fileType'] ?? raw['file_type'], 0),
    content: asString(raw['content']) || asString(raw['field1']),
    context: asString(raw['context']) || asString(raw['field2']),
    prompt: asString(raw['prompt']) || asString(raw['field3']),
    time: asString(raw['time']) || asString(raw['createTime']) || asString(raw['createdAt']),
    likes: asNumber(raw['likes'], 0),
    duration: asNumber(raw['duration'], 0),
  }
}

function formatDuration(sec: number): string {
  if (!sec || sec <= 0) return '--:--'
  const m = Math.floor(sec / 60)
  const s = Math.floor(sec % 60)
  return `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`
}

/** 文件类型分组工具 */
function groupByType(items: AigcItem[]) {
  const imageVideo: AigcItem[] = []
  const text: AigcItem[] = []
  const audio: AigcItem[] = []
  items.forEach((it) => {
    const cat = FILE_TYPE_TO_CATEGORY[it.fileType] ?? 'image'
    if (cat === 'image' || cat === 'video') imageVideo.push(it)
    else if (cat === 'text') text.push(it)
    else if (cat === 'audio') audio.push(it)
  })
  return { imageVideo, text, audio }
}

export default function AigcList() {
  const { t } = useI18n()
  const tt = useCallback((k: string, fb: string) => (t(k) === k ? fb : t(k)), [t])
  const [category, setCategory] = useState<Category>('all')
  const [list, setList] = useState<AigcItem[]>([])
  const [loading, setLoading] = useState(false)
  const [page, setPage] = useState(1)
  const [hasMore, setHasMore] = useState(true)
  const [audioPlayingId, setAudioPlayingId] = useState<string | null>(null)
  /** 当前进入全屏的视频 id(对标原项目 showFullScreen) */
  const [fullscreenVideoId, setFullscreenVideoId] = useState<string | null>(null)
  const audioCtxRef = useRef<Taro.InnerAudioContext | null>(null)

  const categories: { key: Category; label: string }[] = [
    { key: 'all', label: t('common.all') },
    { key: 'text', label: tt('aigc.list.catText', '文本') },
    { key: 'image', label: tt('aigc.list.catImage', '图片') },
    { key: 'video', label: tt('aigc.list.catVideo', '视频') },
    { key: 'audio', label: tt('aigc.list.catAudio', '音频') },
  ]

  const load = useCallback(
    async (reset = false) => {
      if (loading) return
      const curPage = reset ? 1 : page
      if (reset) {
        setHasMore(true)
        setList([])
        setPage(1)
      }
      if (!hasMore && !reset) return
      setLoading(true)
      try {
        const res = await getAigcList({ page: curPage, pageSize: PAGE_SIZE })
        const newList = ((res?.list as Record<string, unknown>[]) || []).map(normalizeItem)
        if (newList.length === 0 && reset) {
          setList(MOCK_LIST)
          setHasMore(false)
        } else {
          setList((prev) => (reset ? newList : [...prev, ...newList]))
          const total = res?.total ?? newList.length
          const prevLen = reset ? 0 : list.length
          setHasMore(prevLen + newList.length < total)
          setPage(curPage + 1)
        }
      } catch {
        if (reset) {
          setList(MOCK_LIST)
          setHasMore(false)
        }
      } finally {
        setLoading(false)
      }
    },
    [loading, page, hasMore, list.length],
  )

  const onCategoryChange = useCallback((c: Category) => {
    setCategory(c)
  }, [])

  const previewImage = useCallback((url: string, allUrls: string[]) => {
    if (!url) {
      Taro.showToast({ title: tt('aigc.list.invalidImage', '图片地址无效'), icon: 'none' })
      return
    }
    // 原生 previewImage 自带全屏(对标原项目 showFullScreen)
    Taro.previewImage({ urls: allUrls.length > 0 ? allUrls : [url], current: url })
  }, [tt])

  const playVideoFullscreen = useCallback((item: AigcItem) => {
    if (!item.fileUrl) {
      Taro.showToast({ title: tt('aigc.list.invalidVideo', '视频地址无效'), icon: 'none' })
      return
    }
    // 触发 Video 组件全屏(对标原项目 showFullScreen)
    setFullscreenVideoId(String(item.id))
  }, [tt])

  const stopAudio = useCallback(() => {
    const ctx = audioCtxRef.current
    if (ctx) {
      ctx.stop()
      ctx.destroy()
      audioCtxRef.current = null
    }
    setAudioPlayingId(null)
  }, [])

  const toggleAudio = useCallback(
    (item: AigcItem) => {
      const idStr = String(item.id)
      if (audioPlayingId === idStr) {
        stopAudio()
        return
      }
      const oldCtx = audioCtxRef.current
      if (oldCtx) {
        oldCtx.stop()
        oldCtx.destroy()
        audioCtxRef.current = null
      }
      if (!item.fileUrl) {
        Taro.showToast({ title: tt('aigc.list.invalidAudio', '音频地址无效'), icon: 'none' })
        return
      }
      const ctx = Taro.createInnerAudioContext()
      ctx.src = item.fileUrl
      ctx.onEnded(() => {
        setAudioPlayingId(null)
        audioCtxRef.current = null
      })
      ctx.onError(() => {
        setAudioPlayingId(null)
        audioCtxRef.current = null
        Taro.showToast({ title: tt('aigc.list.audioFail', '音频播放失败'), icon: 'none' })
      })
      ctx.play()
      audioCtxRef.current = ctx
      setAudioPlayingId(idStr)
    },
    [audioPlayingId, stopAudio, tt],
  )

  usePullDownRefresh(() => {
    load(true).finally(() => Taro.stopPullDownRefresh())
  })

  useReachBottom(() => {
    if (category === 'all') load()
  })

  const loadRef = useRef(load)
  loadRef.current = load
  useEffect(() => {
    void loadRef.current(true)
  }, [])

  useEffect(() => {
    return () => {
      const ctx = audioCtxRef.current
      if (ctx) {
        ctx.stop()
        ctx.destroy()
        audioCtxRef.current = null
      }
    }
  }, [])

  const filteredList = category === 'all' ? list : list.filter((it) => FILE_TYPE_TO_CATEGORY[it.fileType] === category)
  const grouped = groupByType(filteredList)
  const leftColumn = grouped.imageVideo.filter((_, i) => i % 2 === 0)
  const rightColumn = grouped.imageVideo.filter((_, i) => i % 2 === 1)

  const useWaterfall = category === 'all' || category === 'image' || category === 'video'

  const onBack = useCallback(() => {
    Taro.navigateBack({ delta: 1 }).catch(() => {
      Taro.switchTab({ url: '/pages/index/index' })
    })
  }, [])

  const renderImageVideoCard = (item: AigcItem) => {
    const idStr = String(item.id)
    const isVideo = item.fileType === 1
    const isFullscreenVideo = fullscreenVideoId === idStr
    const imageUrls = grouped.imageVideo
      .filter((i) => i.fileType === 0)
      .map((i) => i.coverUrl)
      .filter(Boolean)
    return (
      <View
        key={idStr}
        className="waterfall-card"
        onClick={() => (isVideo ? playVideoFullscreen(item) : previewImage(item.coverUrl, imageUrls))}
      >
        {isVideo ? (
          <View className="video-cover-wrap">
            {isFullscreenVideo && item.fileUrl ? (
              <Video
                className="waterfall-video"
                src={item.fileUrl}
                controls
                autoplay
                showFullscreenBtn
                showCenterPlayBtn
                showPlayBtn
                objectFit="contain"
                onError={() => setFullscreenVideoId(null)}
                onLoadedMetaData={() => {
                  /* 等待自动全屏触发 */
                }}
              />
            ) : item.coverUrl ? (
              <Image className="waterfall-cover" src={item.coverUrl} mode="aspectFill" lazyLoad />
            ) : (
              <View className="video-placeholder">
                <Text className="placeholder-icon">🎬</Text>
              </View>
            )}
            {!isFullscreenVideo && (
              <View className="play-badge">
                <Text className="play-icon">▶</Text>
              </View>
            )}
          </View>
        ) : (
          <Image className="waterfall-cover" src={item.coverUrl} mode="widthFix" lazyLoad />
        )}
        <View className="card-info">
          <Text className="card-title">{item.title || tt('aigc.list.unnamed', '未命名作品')}</Text>
          <View className="card-meta">
            <Text className="card-author">{item.author || tt('aigc.list.anonymous', '匿名作者')}</Text>
            <Text className="card-likes">♡ {item.likes}</Text>
          </View>
        </View>
      </View>
    )
  }

  return (
    <View className="aigc-list-page">
      {/* 顶部导航:标题="灵感"+ 返回按钮(对标原项目 v-show="!showFullScreen") */}
      <View className="page-header">
        <View className="back-btn" onClick={onBack}>
          <Text className="back-icon">‹</Text>
        </View>
        <Text className="page-title">{tt('aigc.list.title', '灵感')}</Text>
      </View>

      <ScrollView scrollX scrollWithAnimation showScrollbar={false} className="category-bar">
        <View className="category-inner">
          {categories.map((c) => (
            <View
              key={c.key}
              className={`category-tab${category === c.key ? ' active' : ''}`}
              onClick={() => onCategoryChange(c.key)}
            >
              <Text>{c.label}</Text>
            </View>
          ))}
        </View>
      </ScrollView>

      <View className="content-area">
        {loading && filteredList.length === 0 ? (
          <View className="state-wrap">
            <Text className="state-text">{t('common.loading')}</Text>
          </View>
        ) : filteredList.length === 0 ? (
          <View className="state-wrap">
            <Text className="state-text">{tt('aigc.list.empty', '暂无内容')}</Text>
          </View>
        ) : useWaterfall ? (
          <View className="waterfall">
            <View className="waterfall-col">
              {leftColumn.map(renderImageVideoCard)}
            </View>
            <View className="waterfall-col">
              {rightColumn.map(renderImageVideoCard)}
            </View>
          </View>
        ) : (
          <View className="list-layout">
            {/* 文本卡片:content-header(标题+时间) + content-prompt(提示词标签+上下文) + content-body(正文) */}
            {grouped.text.map((item) => (
              <View key={String(item.id)} className="text-card">
                <View className="content-header">
                  <Text className="text-title">{item.title || tt('aigc.list.untitled', '文本内容')}</Text>
                  {item.time ? <Text className="text-time">{item.time}</Text> : null}
                </View>
                {item.context ? (
                  <View className="content-prompt">
                    <Text className="prompt-label">{tt('aigc.list.promptLabel', '提示词')}</Text>
                    <Text className="prompt-context">{item.context}</Text>
                  </View>
                ) : null}
                {item.content ? <Text className="text-content">{item.content}</Text> : null}
                <View className="text-meta">
                  <Text className="card-author">{item.author || tt('aigc.list.anonymous', '匿名作者')}</Text>
                  <Text className="card-likes">♡ {item.likes}</Text>
                </View>
              </View>
            ))}
            {/* 音频卡片:唱片(rotate 动画) + 中心点(不旋转) + 播放按钮(不旋转) */}
            {grouped.audio.map((item) => {
              const idStr = String(item.id)
              const isPlaying = audioPlayingId === idStr
              return (
                <View key={idStr} className="audio-card">
                  <View className="audio-record-wrap" onClick={() => toggleAudio(item)}>
                    {/* 旋转层:封面/占位 */}
                    <View className={`audio-record${isPlaying ? ' rotating' : ''}`}>
                      {item.coverUrl ? (
                        <Image className="audio-cover" src={item.coverUrl} mode="aspectFill" />
                      ) : (
                        <View className="audio-cover-placeholder">
                          <Text className="audio-cover-icon">🎵</Text>
                        </View>
                      )}
                    </View>
                    {/* 不旋转层:中心点 + 播放按钮(对标原项目 center-dot-image / audio-play-button) */}
                    <View className="audio-center-dot" />
                    <View className="audio-play-btn">
                      <Text className="audio-play-icon">{isPlaying ? '❚❚' : '▶'}</Text>
                    </View>
                  </View>
                  <View className="audio-info">
                    <Text className="audio-title">{item.title || tt('aigc.list.unnamed', '未命名作品')}</Text>
                    {item.time ? <Text className="audio-time">{item.time}</Text> : null}
                    <View className="audio-progress-row">
                      <View className="audio-progress-bar">
                        <View
                          className="audio-progress-fill"
                          style={isPlaying ? { width: '40%' } : { width: '0%' }}
                        />
                      </View>
                      <Text className="audio-duration">{formatDuration(item.duration)}</Text>
                    </View>
                  </View>
                </View>
              )
            })}
          </View>
        )}

        {loading && filteredList.length > 0 ? (
          <View className="state-wrap small">
            <Text className="state-text">{t('common.loading')}</Text>
          </View>
        ) : null}

        {!loading && !hasMore && filteredList.length > 0 && category === 'all' ? (
          <View className="state-wrap small">
            <Text className="state-text">— {t('common.noMore')} —</Text>
          </View>
        ) : null}
      </View>
    </View>
  )
}
