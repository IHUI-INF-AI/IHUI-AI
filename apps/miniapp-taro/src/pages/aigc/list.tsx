import { View, Text, Image, ScrollView } from '@tarojs/components'
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
 * 真实数据由 getAigcList 返回,字段对齐原项目(coverUrl/fileUrl/fileType/likes)。
 */
const MOCK_LIST: AigcItem[] = [
  { id: 'm1', title: '赛博城市夜景', author: '智汇小方', coverUrl: 'https://picsum.photos/320/440?1', fileUrl: '', fileType: 0, content: '', likes: 128, duration: 0 },
  { id: 'm2', title: '极光幻境', author: 'AI创作家', coverUrl: 'https://picsum.photos/320/360?2', fileUrl: '', fileType: 0, content: '', likes: 256, duration: 0 },
  { id: 'm3', title: '机械姬 Concept', author: '未来派', coverUrl: 'https://picsum.photos/320/500?3', fileUrl: 'https://www.w3schools.com/html/mov_bbb.mp4', fileType: 1, content: '', likes: 89, duration: 0 },
  { id: 'm4', title: '量子诗篇', author: '智汇小方', coverUrl: '', fileUrl: '', fileType: 4, content: '在数据洪流中,我们以代码为笔,以算法为墨,描绘着数字时代的诗与远方。每一段文字都是思想的延伸,每一次生成都是创造的开始。', likes: 67, duration: 0 },
  { id: 'm5', title: '霓虹脉搏', author: '声音艺术家', coverUrl: 'https://picsum.photos/240/240?audio1', fileUrl: 'https://www.w3schools.com/html/horse.mp3', fileType: 3, content: '', likes: 145, duration: 183 },
  { id: 'm6', title: '未来之城', author: '数字画师', coverUrl: 'https://picsum.photos/320/440?4', fileUrl: '', fileType: 0, content: '', likes: 312, duration: 0 },
  { id: 'm7', title: 'AI 觉醒录', author: '智汇小方', coverUrl: '', fileUrl: '', fileType: 4, content: '当机器开始思考,人类是否做好了准备?这是一个关于意识、自由与共存的故事。在硅基生命与碳基生命的交汇处,我们重新审视"存在"的意义。', likes: 198, duration: 0 },
  { id: 'm8', title: '深空回响', author: '声音艺术家', coverUrl: 'https://picsum.photos/240/240?audio2', fileUrl: 'https://www.w3schools.com/html/horse.mp3', fileType: 3, content: '', likes: 92, duration: 240 },
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
  const [category, setCategory] = useState<Category>('all')
  const [list, setList] = useState<AigcItem[]>([])
  const [loading, setLoading] = useState(false)
  const [page, setPage] = useState(1)
  const [hasMore, setHasMore] = useState(true)
  const [audioPlayingId, setAudioPlayingId] = useState<string | null>(null)
  const audioCtxRef = useRef<Taro.InnerAudioContext | null>(null)

  // 分类 tab(全部用现有 common.all,其他文案为修复严重缺失直接硬编码)
  const categories: { key: Category; label: string }[] = [
    { key: 'all', label: t('common.all') },
    { key: 'text', label: '文本' },
    { key: 'image', label: '图片' },
    { key: 'video', label: '视频' },
    { key: 'audio', label: '音频' },
  ]

  const load = useCallback(
    async (reset = false) => {
      if (loading) return
      let curPage = reset ? 1 : page
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
      Taro.showToast({ title: '图片地址无效', icon: 'none' })
      return
    }
    Taro.previewImage({ urls: allUrls.length > 0 ? allUrls : [url], current: url })
  }, [])

  const playVideo = useCallback((item: AigcItem) => {
    if (!item.fileUrl) {
      Taro.showToast({ title: '视频地址无效', icon: 'none' })
      return
    }
    Taro.navigateTo({
      url: `/pages/webview/index?url=${encodeURIComponent(item.fileUrl)}`,
      fail: () => {
        Taro.showToast({ title: '视频播放页待接入', icon: 'none' })
      },
    })
  }, [])

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
      // 切换音频前先停旧的
      const oldCtx = audioCtxRef.current
      if (oldCtx) {
        oldCtx.stop()
        oldCtx.destroy()
        audioCtxRef.current = null
      }
      if (!item.fileUrl) {
        Taro.showToast({ title: '音频地址无效', icon: 'none' })
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
        Taro.showToast({ title: '音频播放失败', icon: 'none' })
      })
      ctx.play()
      audioCtxRef.current = ctx
      setAudioPlayingId(idStr)
    },
    [audioPlayingId, stopAudio],
  )

  usePullDownRefresh(() => {
    load(true).finally(() => Taro.stopPullDownRefresh())
  })

  useReachBottom(() => {
    // 仅"全部"分类下使用上拉加载(其他分类为客户端筛选,不需要分页)
    if (category === 'all') load()
  })

  const loadRef = useRef(load)
  loadRef.current = load
  useEffect(() => {
    void loadRef.current(true)
  }, [])

  // 卸载时清理音频
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

  // 客户端分类筛选(因为 API 不支持 category 参数)
  const filteredList = category === 'all' ? list : list.filter((it) => FILE_TYPE_TO_CATEGORY[it.fileType] === category)

  const grouped = groupByType(filteredList)
  const leftColumn = grouped.imageVideo.filter((_, i) => i % 2 === 0)
  const rightColumn = grouped.imageVideo.filter((_, i) => i % 2 === 1)

  // 当前分类是否走"瀑布流"布局(图片/视频);否则走"列表"布局(文本/音频)
  const useWaterfall =
    category === 'all' || category === 'image' || category === 'video'

  const renderImageVideoCard = (item: AigcItem) => {
    const isVideo = item.fileType === 1
    return (
      <View
        key={String(item.id)}
        className="waterfall-card"
        onClick={() => (isVideo ? playVideo(item) : previewImage(item.coverUrl, grouped.imageVideo.map((i) => i.coverUrl).filter(Boolean)))}
      >
        {isVideo ? (
          <View className="video-cover-wrap">
            {item.coverUrl ? (
              <Image className="waterfall-cover" src={item.coverUrl} mode="aspectFill" lazyLoad />
            ) : (
              <View className="video-placeholder">
                <Text className="placeholder-icon">🎬</Text>
              </View>
            )}
            <View className="play-badge">
              <Text className="play-icon">▶</Text>
            </View>
          </View>
        ) : (
          <Image className="waterfall-cover" src={item.coverUrl} mode="widthFix" lazyLoad />
        )}
        <View className="card-info">
          <Text className="card-title">{item.title || t('aigc.list.unnamed')}</Text>
          <View className="card-meta">
            <Text className="card-author">{item.author || t('aigc.list.anonymous')}</Text>
            <Text className="card-likes">♡ {item.likes}</Text>
          </View>
        </View>
      </View>
    )
  }

  return (
    <View className="aigc-list-page">
      <View className="page-header">
        <Text className="page-title">{t('aigc.list.title')}</Text>
      </View>

      {/* 分类 tab 横向滚动 */}
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
            <Text className="state-text">{t('aigc.list.empty')}</Text>
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
            {grouped.text.map((item) => (
              <View key={String(item.id)} className="text-card">
                <Text className="text-title">{item.title || t('aigc.list.unnamed')}</Text>
                {item.content ? <Text className="text-content">{item.content}</Text> : null}
                <View className="text-meta">
                  <Text className="card-author">{item.author || t('aigc.list.anonymous')}</Text>
                  <Text className="card-likes">♡ {item.likes}</Text>
                </View>
              </View>
            ))}
            {grouped.audio.map((item) => {
              const idStr = String(item.id)
              const isPlaying = audioPlayingId === idStr
              return (
                <View key={idStr} className="audio-card">
                  <View
                    className={`audio-record${isPlaying ? ' rotating' : ''}`}
                    onClick={() => toggleAudio(item)}
                  >
                    {item.coverUrl ? (
                      <Image className="audio-cover" src={item.coverUrl} mode="aspectFill" />
                    ) : (
                      <View className="audio-cover-placeholder">
                        <Text className="audio-cover-icon">🎵</Text>
                      </View>
                    )}
                    <View className="audio-play-btn">
                      <Text className="audio-play-icon">{isPlaying ? '❚❚' : '▶'}</Text>
                    </View>
                  </View>
                  <View className="audio-info">
                    <Text className="audio-title">{item.title || t('aigc.list.unnamed')}</Text>
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
            <Text className="state-text">— 没有更多了 —</Text>
          </View>
        ) : null}
      </View>
    </View>
  )
}
