// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

// 对齐目标(RN 共享屏): packages/app/src/features/aigc-list/AigcListScreen.tsx
import { useI18n } from '@/i18n'
import { View, Text, Image, ScrollView, Video } from '@tarojs/components'
import Taro, { usePullDownRefresh, useReachBottom } from '@tarojs/taro'
import { useState, useCallback, useEffect, useRef } from 'react'
import { getAigcList } from '@/api'
import { formatDate } from '@/utils/time'
import './list.css'
import ThemeRoot from '@/components/ThemeRoot'
import LineIcon from '@/components/LineIcon'

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

function asString(v: unknown): string {
  return typeof v === 'string' ? v : ''
}

function asNumber(v: unknown, fallback = 0): number {
  const n = Number(v)
  return Number.isFinite(n) ? n : fallback
}

/** 后端 aiGcContent.gcType → 本页 fileType 的映射(0=图片 1=视频 3=音频 4=文本) */
const GC_TYPE_TO_FILE_TYPE: Record<string, number> = { image: 0, video: 1, audio: 3, text: 4 }

/**
 * /content/aigc/list 直出 aiGcContent 原始列(content-extended.ts:385),顶层没有
 * fileType/title/coverUrl —— 作品元信息住在 content 列的 JSON 串里(落库形见
 * miniapp-compat-routes.ts /aigc/publish:{title,subtitle,coverUrl,fileUrl,problem})。
 * 旧实现按 raw['fileType']/raw['title'] 取值,那些键在响应里根本不存在 ⇒ 全部素材卡
 * 恒走「未命名作品」、文本/音频/视频分支永不渲染;这里按真实列面摊平。
 */
function normalizeItem(raw: Record<string, unknown>): AigcItem {
  const id = raw['id'] as string | number | undefined
  const gcType = asString(raw['gcType'])
  let meta: Record<string, unknown> | null = null
  try {
    const parsed = JSON.parse(asString(raw['content'])) as unknown
    if (parsed && typeof parsed === 'object') meta = parsed as Record<string, unknown>
  } catch {
    // content 非 JSON:老式 POST /content/aigc 自由文本入库形,文本档时正文即原文
  }
  return {
    id: id ?? Math.random().toString(36).slice(2),
    title: meta ? asString(meta['title']) || asString(meta['subtitle']) : '',
    author: asString(raw['author']) || asString(raw['nickname']),
    coverUrl: meta ? asString(meta['coverUrl']) || asString(meta['fileUrl']) : '',
    fileUrl: meta ? asString(meta['fileUrl']) : '',
    fileType: GC_TYPE_TO_FILE_TYPE[gcType] ?? 0,
    // 文本档正文 = meta.problem(发布页文本档把正文写进 problem 槽);非 JSON 的老行退回原文
    content: gcType === 'text' ? (meta ? asString(meta['problem']) : asString(raw['content'])) : '',
    // 对齐 RN AigcListScreen textCard 的 prompt 行:共享屏用 item.prompt 单独承载用户提示词。
    // 后端文本档正文落 problem 槽、无独立提示词列 ⇒ 当前 meta 无 prompt 键,该行恒不渲染;
    // 一旦后端补回提示词即可与 RN 同构自然呈现。
    prompt: meta ? asString(meta['prompt']) : '',
    time: asString(raw['createdAt']) || asString(raw['created_at']),
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
          // 空就是空:与原 mock 回填不同,对齐 RN AigcListScreen 语义(无数据即空态"暂无作品",不造演示数据)
          setList([])
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
          // 失败退空态(与素材库页同纪律:静默、不回填假数据;错误横幅差异见交接待账)
          setList([])
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

  const previewImage = useCallback(
    (url: string, allUrls: string[]) => {
      if (!url) {
        Taro.showToast({ title: tt('aigc.list.invalidImage', '图片地址无效'), icon: 'none' })
        return
      }
      // 原生 previewImage 自带全屏(对标原项目 showFullScreen)
      Taro.previewImage({ urls: allUrls.length > 0 ? allUrls : [url], current: url })
    },
    [tt],
  )

  const playVideoFullscreen = useCallback(
    (item: AigcItem) => {
      if (!item.fileUrl) {
        Taro.showToast({ title: tt('aigc.list.invalidVideo', '视频地址无效'), icon: 'none' })
        return
      }
      // 触发 Video 组件全屏(对标原项目 showFullScreen)
      setFullscreenVideoId(String(item.id))
    },
    [tt],
  )

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

  const filteredList =
    category === 'all' ? list : list.filter((it) => FILE_TYPE_TO_CATEGORY[it.fileType] === category)
  const grouped = groupByType(filteredList)

  const useWaterfall = category === 'all' || category === 'image' || category === 'video'

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
        className="media-card"
        onClick={() =>
          isVideo ? playVideoFullscreen(item) : previewImage(item.coverUrl, imageUrls)
        }
        hoverClass="opacity-60"
      >
        <View className="media-cover-wrap">
          {isFullscreenVideo && item.fileUrl ? (
            <Video
              className="fullscreen-video"
              src={item.fileUrl}
              controls
              autoplay
              showFullscreenBtn
              objectFit="contain"
              onError={() => setFullscreenVideoId(null)}
            />
          ) : item.coverUrl ? (
            <Image className="media-cover" src={item.coverUrl} mode="aspectFill" lazyLoad />
          ) : (
            <View className="media-placeholder">
              <LineIcon name="film" size={80} color="var(--color-muted-foreground)" />
            </View>
          )}
        </View>
        {isVideo ? (
          <View className="video-badge">
            <Text className="video-badge-text">{tt('aigcList.videoBadge', '▶ 视频')}</Text>
          </View>
        ) : null}
        <View className="media-footer">
          <Text className="card-title">{item.title || tt('aigc.list.unnamed', '未命名作品')}</Text>
        </View>
      </View>
    )
  }

  return (
    <ThemeRoot className="aigc-list-page">
      {/* 顶部导航(对齐 RN SharedAigcListScreen header):标题 + 副标题;返回键由微信原生导航栏承担 */}
      <View className="page-header">
        <Text className="page-title">{tt('aigcList.title', '灵感')}</Text>
        <Text className="page-subtitle">
          {tt('aigcList.subtitle', 'AI 生成的图文/视频/音频作品')}
        </Text>
      </View>

      <ScrollView scrollX scrollWithAnimation showScrollbar={false} className="category-bar">
        <View className="category-inner">
          {categories.map((c) => (
            <View
              key={c.key}
              className={`category-chip${category === c.key ? ' active' : ''}`}
              onClick={() => onCategoryChange(c.key)}
              hoverClass="opacity-60"
            >
              <Text className="category-text">{c.label}</Text>
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
            <Text className="state-text">{tt('aigcList.empty', '暂无作品')}</Text>
          </View>
        ) : useWaterfall ? (
          <View className="media-grid">{grouped.imageVideo.map(renderImageVideoCard)}</View>
        ) : (
          <View className="list-layout">
            {/* 文本卡片(对齐 RN textCard):card-header(标题+时间) + 提示词(promptLabel) + 正文;
                对齐 RN promptText 行:仅当 item.prompt 有值才渲染(后端文本档正文落 problem 槽、
                暂无独立提示词列 ⇒ 当前 prompt 恒空、该行不显;后端补回提示词即同构呈现) */}
            {grouped.text.map((item) => (
              <View key={String(item.id)} className="aigc-text-card">
                <View className="card-header">
                  <Text className="card-title">
                    {item.title || tt('aigc.list.untitled', '文本内容')}
                  </Text>
                  {/* 后端 createdAt 是 ISO 串,上屏前必须折成日期(禁裸 ISO) */}
                  {item.time ? (
                    <Text className="card-time">{formatDate(item.time, 'YYYY-MM-DD')}</Text>
                  ) : null}
                </View>
                {/* 对齐 RN textCard promptText:标签 + 提示词本体,仅在有提示词时呈现 */}
                {item.prompt ? (
                  <Text className="mt-[8rpx] text-body text-[color:var(--color-primary)]">
                    {t('aigcList.promptLabel')} {item.prompt}
                  </Text>
                ) : null}
                {item.content ? <Text className="content-text">{item.content}</Text> : null}
              </View>
            ))}
            {/* 音频卡片(对齐 RN audioCard):横向布局 封面 + 信息(标题/时长/播放按钮) */}
            {grouped.audio.map((item) => {
              const idStr = String(item.id)
              const isPlaying = audioPlayingId === idStr
              return (
                <View key={idStr} className="audio-card">
                  <View
                    className="audio-cover"
                    onClick={() => toggleAudio(item)}
                    hoverClass="opacity-60"
                  >
                    {item.coverUrl ? (
                      <Image className="audio-cover-img" src={item.coverUrl} mode="aspectFill" />
                    ) : (
                      <View className="audio-cover-placeholder">
                        <LineIcon
                          name="headphones"
                          size={48}
                          color="var(--color-muted-foreground)"
                        />
                      </View>
                    )}
                  </View>
                  <View className="audio-info">
                    <Text className="card-title">
                      {item.title || tt('aigc.list.unnamed', '未命名作品')}
                    </Text>
                    <Text className="audio-duration">{formatDuration(item.duration)}</Text>
                    <View
                      className="audio-play-btn"
                      onClick={() => toggleAudio(item)}
                      hoverClass="opacity-60"
                    >
                      <LineIcon
                        name={isPlaying ? 'pause' : 'play'}
                        size={24}
                        className="audio-play-icon"
                        color="var(--color-primary)"
                      />
                      {/* 对齐 RN audioPlayText:按钮内文案(共享屏有、本页原先只有图标) */}
                      <Text className="ml-[8rpx] text-body font-semibold text-[color:var(--color-primary)]">
                        {t('aigcList.playAudio')}
                      </Text>
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

      {/* FAB 占位:发布按钮悬浮在列表之上,末行不被遮挡 */}
      <View className="h-[140rpx]" />
      {/* 发布入口(对齐 RN AigcListScreen fab:底部居中 160x44,品牌实底 + ctaForeground) */}
      <View
        className="fixed bottom-[48rpx] left-0 right-0 z-10 mx-auto flex h-[88rpx] w-[320rpx] items-center justify-center rounded-sm bg-cta"
        onClick={() => Taro.navigateTo({ url: '/pkg-ai/aigc/publish' })}
        hoverClass="opacity-60"
      >
        <Text className="text-[length:32rpx] font-semibold text-cta-foreground">
          {t('aigcList.publish')}
        </Text>
      </View>
    </ThemeRoot>
  )
}
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
