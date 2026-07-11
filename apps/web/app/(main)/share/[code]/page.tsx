'use client'

import * as React from 'react'
import { useParams } from 'next/navigation'
import { useQuery } from '@tanstack/react-query'
import ReactMarkdown from 'react-markdown'
import remarkGfm from 'remark-gfm'
import {
  AlertCircle,
  ChevronDown,
  Loader2,
  Pause,
  Play,
  Volume2,
  X,
  ExternalLink,
  Link as LinkIcon,
  Bot,
} from 'lucide-react'
import { toast } from 'sonner'

import { fetchShareContent, type ShareContent, type ShareListItem } from '@/lib/share-api'
import { useClipboard } from '@/hooks/use-clipboard'

// 小程序跳转链接（与历史项目保持一致）
const MINI_PROGRAM_LINK = 'https://aizhs.top/share'

export default function ShareCodePage() {
  const params = useParams<{ code: string }>()
  const code = params?.code ?? ''
  const { copied, copy } = useClipboard()

  const { data, isLoading, error, refetch } = useQuery({
    queryKey: ['share', 'content', code],
    queryFn: () => fetchShareContent(code),
    enabled: !!code,
    retry: 1,
  })

  // ===== 加载状态 =====
  if (isLoading) {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center bg-white">
        <Loader2 className="h-8 w-8 animate-spin text-[#9A99F3]" />
        <p className="mt-4 text-sm text-gray-500">加载中...</p>
      </div>
    )
  }

  // ===== 错误状态 =====
  if (error || !data) {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center bg-white px-10 text-center">
        <AlertCircle className="mb-6 h-16 w-16 text-gray-300" />
        <p className="mb-8 text-sm text-gray-500">{(error as Error)?.message || '分享链接无效'}</p>
        <button
          onClick={() => refetch()}
          className="rounded-md bg-[#9A99F3] px-7 py-2.5 text-sm text-white transition-colors hover:bg-[#8a89e3]"
        >
          重试
        </button>
      </div>
    )
  }

  return <ShareContent shareData={data} copy={copy} copied={copied} />
}

// =============================================================================
// 分享内容主体
// =============================================================================

interface ShareContentProps {
  shareData: ShareContent
  copy: (text: string) => Promise<boolean>
  copied: boolean
}

function ShareContent({ shareData, copy, copied }: ShareContentProps) {
  const { modelName, modelIcon, question, answer, tokenCost, createdAt } = shareData

  return (
    <div className="min-h-screen bg-white pb-20">
      {/* 头部：模型信息 */}
      <header className="flex items-center border-b border-gray-100 px-5 py-3.5">
        {modelIcon ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={modelIcon} alt="模型图标" className="mr-2.5 h-8 w-8 rounded object-cover" />
        ) : (
          <div className="mr-2.5 flex h-8 w-8 items-center justify-center rounded bg-gray-100">
            <Bot className="h-5 w-5 text-gray-500" />
          </div>
        )}
        <span className="text-base font-semibold text-gray-800">{modelName || 'AI智能对话'}</span>
      </header>

      {/* 对话内容 */}
      <div className="px-5 py-5">
        {/* 用户提问 */}
        <div className="flex justify-end">
          <div className="w-full rounded-2xl border border-[#9A99F3]/40 bg-[#9A99F3] p-5 text-white">
            <p className="whitespace-pre-wrap break-words text-[15px] leading-7">
              {question || ''}
            </p>
          </div>
        </div>

        {/* AI 回答 */}
        <div className="mt-5 w-full rounded-3xl border border-gray-200 bg-[#F6F6F6] p-5">
          <AnswerArea answer={answer} />

          {/* 底部信息 */}
          <div className="mt-4 flex items-center gap-4 border-t border-gray-200 pt-3 text-xs text-gray-400">
            <span>智汇AI生成</span>
            {typeof tokenCost === 'number' && tokenCost > 0 && (
              <span>消耗智汇值：{formatTokens(tokenCost)}</span>
            )}
            {createdAt && <span>{formatDate(createdAt)}</span>}
          </div>
        </div>
      </div>

      {/* 底部操作栏 */}
      <BottomBar copy={copy} copied={copied} />
    </div>
  )
}

// =============================================================================
// AI 回答区域：渲染思考过程 / 文本 / 图片 / 视频 / 音频 / 混合内容
// =============================================================================

function AnswerArea({ answer }: { answer: ShareContent['answer'] }) {
  const images = answer.images ?? []
  const lists = answer.lists ?? []

  return (
    <div className="space-y-3">
      {/* 思考过程 */}
      {answer.thinking && <ThinkingProcess text={answer.thinking} />}

      {/* 视频内容 */}
      {answer.video && <VideoPlayer video={answer.video} />}

      {/* 图片列表 */}
      {images.length > 0 && <ImageGrid images={images} />}

      {/* 音频内容 */}
      {answer.audio && <AudioPlayer audio={answer.audio} />}

      {/* 文本内容（支持 markdown 渲染） */}
      {answer.text && (
        <div className="prose prose-sm max-w-none whitespace-pre-wrap break-words text-[15px] leading-7 text-gray-700">
          <ReactMarkdown remarkPlugins={[remarkGfm]}>{answer.text}</ReactMarkdown>
        </div>
      )}

      {/* 混合内容（lists） */}
      {lists.length > 0 && <ListsContent lists={lists} />}
    </div>
  )
}

// =============================================================================
// 思考过程：可展开/收起的折叠面板
// =============================================================================

function ThinkingProcess({ text }: { text: string }) {
  const [expanded, setExpanded] = React.useState(false)
  const needToggle = text.length > 200

  return (
    <div className="rounded-2xl border border-[#e8ecff] bg-gradient-to-br from-[#f8f9ff] to-[#f0f4ff] p-5">
      <div className="mb-3 flex items-center">
        <span className="mr-2.5 text-xl">💭</span>
        <span className="text-base font-semibold text-[#6366f1]">思考过程</span>
      </div>
      <div
        className={`relative overflow-hidden transition-all duration-300 ${
          expanded ? 'max-h-none' : 'max-h-[200px]'
        }`}
      >
        <p className="whitespace-pre-wrap break-words text-sm leading-relaxed text-slate-500">
          {text}
        </p>
      </div>
      {needToggle && (
        <button
          onClick={() => setExpanded((v) => !v)}
          className="mt-3 flex w-full items-center justify-center gap-2 py-2 text-sm text-[#6366f1]"
        >
          <span>{expanded ? '收起' : '展开'}</span>
          <ChevronDown
            className={`h-4 w-4 transition-transform duration-300 ${expanded ? 'rotate-180' : ''}`}
          />
        </button>
      )}
    </div>
  )
}

// =============================================================================
// 视频播放：自适应尺寸，支持 9:16 竖屏
// =============================================================================

function VideoPlayer({ video }: { video: NonNullable<ShareContent['answer']['video']> }) {
  // 9:16 竖屏使用固定尺寸（与历史项目一致），其余按 width/height 自适应
  const isVertical = video.width && video.height ? video.height > video.width : false

  if (isVertical) {
    return (
      <div className="inline-block overflow-hidden rounded-lg">
        <video
          src={video.url}
          poster={video.cover}
          controls
          className="block rounded-lg"
          style={{ width: '118px', height: '210px' }}
        >
          <track kind="captions" />
        </video>
      </div>
    )
  }

  const aspectRatio =
    video.width && video.height && video.width > 0 ? `${video.width} / ${video.height}` : '16 / 9'

  return (
    <div className="overflow-hidden rounded-lg">
      <video
        src={video.url}
        poster={video.cover}
        controls
        className="block w-full rounded-lg"
        style={{ aspectRatio }}
      >
        <track kind="captions" />
      </video>
    </div>
  )
}

// =============================================================================
// 图片网格：可点击预览
// =============================================================================

function ImageGrid({ images }: { images: string[] }) {
  const [previewIndex, setPreviewIndex] = React.useState<number | null>(null)

  return (
    <>
      <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
        {images.map((url, idx) => (
          <button
            key={url}
            onClick={() => setPreviewIndex(idx)}
            className="overflow-hidden rounded-2xl"
          >
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={url}
              alt={`图片${idx + 1}`}
              className="h-full w-full cursor-pointer object-cover transition-transform hover:scale-105"
            />
          </button>
        ))}
      </div>

      {previewIndex !== null && (
        <ImagePreview images={images} index={previewIndex} onClose={() => setPreviewIndex(null)} />
      )}
    </>
  )
}

function ImagePreview({
  images,
  index,
  onClose,
}: {
  images: string[]
  index: number
  onClose: () => void
}) {
  const [current, setCurrent] = React.useState(index)

  return (
    <div
      role="button"
      tabIndex={0}
      className="fixed inset-0 z-[200] flex items-center justify-center bg-black/90"
      onClick={onClose}
      onKeyDown={(e) => {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault()
          onClose()
        }
      }}
    >
      <button
        onClick={onClose}
        className="absolute right-4 top-4 flex h-10 w-10 items-center justify-center rounded-full bg-white/10 text-white transition-colors hover:bg-white/20"
        aria-label="关闭"
      >
        <X className="h-5 w-5" />
      </button>

      {/* eslint-disable-next-line @next/next/no-img-element, jsx-a11y/click-events-have-key-events, jsx-a11y/no-noninteractive-element-interactions */}
      <img
        src={images[current]}
        alt={`预览图片 ${current + 1}`}
        className="max-h-[90vh] max-w-[90vw] object-contain"
        onClick={(e) => e.stopPropagation()}
      />
      {images.length > 1 && (
        <>
          <button
            onClick={(e) => {
              e.stopPropagation()
              setCurrent((c) => (c - 1 + images.length) % images.length)
            }}
            className="absolute left-4 flex h-10 w-10 items-center justify-center rounded-full bg-white/10 text-white transition-colors hover:bg-white/20"
            aria-label="上一张"
          >
            ‹
          </button>
          <button
            onClick={(e) => {
              e.stopPropagation()
              setCurrent((c) => (c + 1) % images.length)
            }}
            className="absolute right-4 top-1/2 flex h-10 w-10 items-center justify-center rounded-full bg-white/10 text-white transition-colors hover:bg-white/20"
            aria-label="下一张"
          >
            ›
          </button>
        </>
      )}
    </div>
  )
}

// =============================================================================
// 音频播放器：播放/暂停按钮 + 进度条
// =============================================================================

function AudioPlayer({ audio }: { audio: NonNullable<ShareContent['answer']['audio']> }) {
  const audioRef = React.useRef<HTMLAudioElement | null>(null)
  const [playing, setPlaying] = React.useState(false)
  const [progress, setProgress] = React.useState(0)
  const [currentTime, setCurrentTime] = React.useState(0)

  const toggle = () => {
    const el = audioRef.current
    if (!el) return
    if (playing) {
      el.pause()
      setPlaying(false)
    } else {
      el.play().catch(() => {
        toast.error('音频播放失败')
      })
      setPlaying(true)
    }
  }

  const onTimeUpdate = () => {
    const el = audioRef.current
    if (!el) return
    const dur = el.duration || 0
    const cur = el.currentTime || 0
    setProgress(dur > 0 ? (cur / dur) * 100 : 0)
    setCurrentTime(cur)
  }

  const onSeek = (e: React.ChangeEvent<HTMLInputElement>) => {
    const el = audioRef.current
    if (!el || !el.duration) return
    const value = Number(e.target.value)
    const seekTime = (value / 100) * el.duration
    el.currentTime = seekTime
    setProgress(value)
    setCurrentTime(seekTime)
  }

  return (
    <div className="flex items-center rounded-2xl bg-gray-100 px-5 py-3.5">
      <audio
        ref={audioRef}
        src={audio.url}
        onTimeUpdate={onTimeUpdate}
        onEnded={() => {
          setPlaying(false)
          setProgress(100)
        }}
        onError={() => {
          setPlaying(false)
          toast.error('音频播放失败')
        }}
      >
        <track kind="captions" />
      </audio>
      <button
        onClick={toggle}
        className="flex h-10 w-10 shrink-0 items-center justify-center text-xl text-[#9A99F3]"
        aria-label={playing ? '暂停' : '播放'}
      >
        {playing ? <Pause className="h-5 w-5" /> : <Play className="h-5 w-5" />}
      </button>
      <input
        type="range"
        min={0}
        max={100}
        value={progress}
        onChange={onSeek}
        className="mx-5 h-1.5 flex-1 cursor-pointer accent-[#9A99F3]"
      />
      <Volume2 className="mr-1 h-4 w-4 shrink-0 text-gray-400" />
      <span className="shrink-0 text-xs text-gray-500">{formatAudioTime(currentTime)}</span>
    </div>
  )
}

// =============================================================================
// 混合内容列表（lists）
// =============================================================================

function ListsContent({ lists }: { lists: ShareListItem[] }) {
  return (
    <div className="space-y-2.5">
      {lists.map((item, idx) => {
        if (item.type === 'text' && item.content) {
          return (
            <p
              key={`list-${idx}`}
              className="whitespace-pre-wrap break-words text-sm leading-relaxed text-gray-700"
            >
              {item.content}
            </p>
          )
        }
        if (item.type === 'image' && item.content) {
          return (
            <button
              key={`list-${idx}`}
              onClick={() => window.open(item.content, '_blank')}
              className="block overflow-hidden rounded-2xl"
            >
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={item.content}
                alt={`图片${idx + 1}`}
                className="w-full cursor-pointer object-cover"
              />
            </button>
          )
        }
        return null
      })}
    </div>
  )
}

// =============================================================================
// 底部操作栏
// =============================================================================

function BottomBar({
  copy,
  copied,
}: {
  copy: (text: string) => Promise<boolean>
  copied: boolean
}) {
  const openMiniProgram = async () => {
    const ok = await copy(MINI_PROGRAM_LINK)
    toast[ok ? 'success' : 'error'](ok ? '小程序链接已复制，请在微信中打开' : '复制失败')
  }

  const copyLink = async () => {
    const url =
      typeof window !== 'undefined' && window.location ? window.location.href : MINI_PROGRAM_LINK
    const ok = await copy(url)
    toast[ok ? 'success' : 'error'](ok ? '链接已复制' : '复制失败')
  }

  return (
    <div className="fixed inset-x-0 bottom-0 z-[100] flex gap-2.5 border-t border-gray-100 bg-white px-2.5 py-2.5">
      <button
        onClick={openMiniProgram}
        className="flex flex-1 items-center justify-center gap-1.5 rounded-md bg-gray-100 py-3 text-sm text-gray-700 transition-colors hover:bg-gray-200"
      >
        <ExternalLink className="h-4 w-4" />
        打开小程序
      </button>
      <button
        onClick={copyLink}
        className="flex flex-1 items-center justify-center gap-1.5 rounded-md bg-[#9A99F3] py-3 text-sm text-white transition-colors hover:bg-[#8a89e3]"
      >
        <LinkIcon className="h-4 w-4" />
        {copied ? '已复制' : '复制链接'}
      </button>
    </div>
  )
}

// =============================================================================
// 工具函数
// =============================================================================

function formatAudioTime(seconds: number): string {
  const minutes = Math.floor(seconds / 60)
  const remaining = Math.floor(seconds % 60)
  return `${minutes}:${remaining < 10 ? '0' + remaining : remaining}`
}

function formatTokens(value: number): string {
  if (!value) return '0'
  return value >= 1000 ? (value / 1000).toFixed(1) + 'K' : String(value)
}

function formatDate(v: string): string {
  const d = new Date(v)
  if (Number.isNaN(d.getTime())) return ''
  return d.toLocaleString('zh-CN', {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
  })
}
