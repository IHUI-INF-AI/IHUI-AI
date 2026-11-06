// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
// 镜像 packages/app/src/features/aigc-list/AigcListScreen.tsx
// 薄壳化:页面只保留「数据装载 + 平台能力注入」,渲染统一走共享屏 AigcListScreen。
// 平台事实 3 项(全部经注入端口,共享屏内零平台 API):
//   ① 图片预览 Taro.previewImage(共享屏只回 onPressItem)
//   ② 音频播放/停止 Taro.createInnerAudioContext(经 onToggleAudio 注入,播放态由宿主回传)
//   ③ 视频内联播放 Taro Video(经 video.Renderer 注入,布局由共享屏卡位约束)

import Taro from '@tarojs/taro'
import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { useI18n } from '@/i18n'
import { getAigcList } from '@/api'
import { formatDate } from '@/utils/time'
import ThemeRoot from '@/components/ThemeRoot'
import AigcVideoInline from '@/components/AigcVideoInline'
import { onToast } from '@/host/on-toast'
import { useTheme } from '@/rn-compat/theme'
import { AigcListScreen as SharedAigcListScreen } from '@ihui/rn-app/features/aigc-list/AigcListScreen'
import type { AigcCategory, AigcListItem } from '@ihui/types'
import type { AigcCategoryOption, AigcFileType } from '@ihui/types'

/** 文件类型枚举(对标原项目 fileType: 0=图片 1=视频 3=音频 4=文本) */
type Category = AigcCategory

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

export default function AigcList() {
  const { t } = useI18n()
  const { resolvedTheme } = useTheme()
  /** i18n 兜底:key 未命中时返回 fallback */
  const tt = useCallback((k: string, fb: string) => (t(k) === k ? fb : t(k)), [t])

  const [category, setCategory] = useState<Category>('all')
  const [list, setList] = useState<AigcItem[]>([])
  const [loading, setLoading] = useState(true)
  const [refreshing, setRefreshing] = useState(false)
  const [error, setError] = useState('')
  const [audioPlayingId, setAudioPlayingId] = useState<string | null>(null)
  const [videoPlayingId, setVideoPlayingId] = useState<string | null>(null)

  const pageRef = useRef(1)
  const listRef = useRef<AigcItem[]>([])
  const hasMoreRef = useRef(true)
  const loadingRef = useRef(false)
  const audioCtxRef = useRef<Taro.InnerAudioContext | null>(null)

  const load = useCallback(
    async (reset: boolean, viaRefresh = false) => {
      if (loadingRef.current) return
      if (!reset && !hasMoreRef.current) return
      loadingRef.current = true
      if (viaRefresh) setRefreshing(true)
      else setLoading(true)
      if (reset) {
        setError('')
        hasMoreRef.current = true
        pageRef.current = 1
      }
      const curPage = reset ? 1 : pageRef.current
      try {
        const res = await getAigcList({ page: curPage, pageSize: PAGE_SIZE })
        const fetched = ((res?.list as Record<string, unknown>[]) || []).map(normalizeItem)
        const nextList = reset ? fetched : [...listRef.current, ...fetched]
        listRef.current = nextList
        setList(nextList)
        if (fetched.length === 0 && reset) {
          // 空就是空:不造演示数据(对齐 RN AigcListScreen 空态语义)
          hasMoreRef.current = false
        } else {
          const total = res?.total ?? nextList.length
          const more = nextList.length < total
          hasMoreRef.current = more
          pageRef.current = curPage + 1
        }
      } catch {
        if (reset) {
          listRef.current = []
          setList([])
          hasMoreRef.current = false
        }
        setError(tt('aigc.list.loadFail', '加载失败'))
      } finally {
        loadingRef.current = false
        setLoading(false)
        setRefreshing(false)
      }
    },
    [tt],
  )

  const loadRef = useRef(load)
  loadRef.current = load
  useEffect(() => {
    void loadRef.current(true)
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
    (item: AigcListItem) => {
      if (audioPlayingId === item.id) {
        stopAudio()
        return
      }
      const oldCtx = audioCtxRef.current
      if (oldCtx) {
        oldCtx.stop()
        oldCtx.destroy()
        audioCtxRef.current = null
      }
      const url = item.fileUrl || item.audioUrl
      if (!url) {
        setAudioPlayingId(null)
        onToast(tt('aigc.list.invalidAudio', '音频地址无效'), { kind: 'error' })
        return
      }
      const ctx = Taro.createInnerAudioContext()
      ctx.src = url
      ctx.onEnded(() => {
        setAudioPlayingId(null)
        audioCtxRef.current = null
      })
      ctx.onError(() => {
        setAudioPlayingId(null)
        audioCtxRef.current = null
        onToast(tt('aigc.list.audioFail', '音频播放失败'), { kind: 'error' })
      })
      ctx.play()
      audioCtxRef.current = ctx
      setAudioPlayingId(item.id)
    },
    [audioPlayingId, stopAudio, tt],
  )

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

  const toggleVideo = useCallback(
    (item: AigcListItem) => {
      if (!item.fileUrl) {
        onToast(tt('aigc.list.invalidVideo', '视频地址无效'), { kind: 'error' })
        return
      }
      setVideoPlayingId((prev) => (prev === item.id ? null : item.id))
    },
    [tt],
  )

  const previewImage = useCallback(
    (item: AigcListItem) => {
      const urls = listRef.current
        .filter((i) => i.fileType === 0 && i.coverUrl)
        .map((i) => i.coverUrl)
      if (!item.coverUrl) {
        onToast(tt('aigc.list.invalidImage', '图片地址无效'), { kind: 'error' })
        return
      }
      Taro.previewImage({ urls: urls.length ? urls : [item.coverUrl], current: item.coverUrl })
    },
    [tt],
  )

  const onPressItem = useCallback(
    (item: AigcListItem) => {
      if (item.fileType === 0) {
        previewImage(item)
        return
      }
      if (item.fileType === 3) {
        toggleAudio(item)
        return
      }
      // 文本卡:原页无点击行为,保持一致
    },
    [previewImage, toggleAudio],
  )

  const categories = useMemo<AigcCategoryOption[]>(
    () => [
      { key: 'all', label: t('common.all') },
      { key: 'text', label: tt('aigc.list.catText', '文本'), fileType: 4 },
      { key: 'image', label: tt('aigc.list.catImage', '图片'), fileType: 0 },
      { key: 'video', label: tt('aigc.list.catVideo', '视频'), fileType: 1 },
      { key: 'audio', label: tt('aigc.list.catAudio', '音频'), fileType: 3 },
    ],
    [t, tt],
  )

  const items = useMemo(
    () =>
      list.map((it) => {
        const isText = it.fileType === 4
        return {
          id: String(it.id),
          title:
            it.title ||
            tt(
              isText ? 'aigc.list.untitled' : 'aigc.list.unnamed',
              isText ? '文本内容' : '未命名作品',
            ),
          coverUrl: it.coverUrl || undefined,
          fileUrl: it.fileUrl || undefined,
          audioUrl: it.fileType === 3 ? it.fileUrl || undefined : undefined,
          duration: it.fileType === 3 ? formatDuration(it.duration) : undefined,
          fileType: it.fileType as AigcFileType,
          content: it.content || undefined,
          prompt: it.prompt || undefined,
          createdAt: it.time ? formatDate(it.time, 'YYYY-MM-DD') : '',
        }
      }),
    [list, tt],
  )

  const screenProps = {
    t,
    items,
    categories,
    category,
    loading,
    refreshing,
    error,
    onSelectCategory: (next: AigcCategory) => setCategory(next),
    onRefresh: () => void load(true, true),
    onPressItem,
    onPublish: () => void Taro.navigateTo({ url: '/pkg-ai/aigc/publish' }),
    onBack: () => void Taro.navigateBack(),
    onLoadMore: () => void load(false),
    colorScheme: resolvedTheme,
    onToast,
    playingAudioId: audioPlayingId,
    onToggleAudio: toggleAudio,
    video: { playingId: videoPlayingId, onToggle: toggleVideo, Renderer: AigcVideoInline },
  }

  return (
    <ThemeRoot>
      <SharedAigcListScreen {...screenProps} />
    </ThemeRoot>
  )
}
