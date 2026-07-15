'use client'

import * as React from 'react'
import ReactMarkdown from 'react-markdown'
import remarkGfm from 'remark-gfm'
import Image from 'next/image'
import { ChevronDown, Pause, Play, Volume2, X, Lightbulb } from 'lucide-react'
import { toast } from 'sonner'
import { type ShareContent, type ShareListItem } from '@/lib/share-api'
import { VideoPlayer } from '@/components/media'
import { formatAudioTime } from './helpers'

export function AnswerArea({ answer }: { answer: ShareContent['answer'] }) {
  const images = answer.images ?? []
  const lists = answer.lists ?? []

  return (
    <div className="space-y-3">
      {/* 思考过程 */}
      {answer.thinking && <ThinkingProcess text={answer.thinking} />}

      {/* 视频内容 */}
      {answer.video && <ShareVideo video={answer.video} />}

      {/* 图片列表 */}
      {images.length > 0 && <ImageGrid images={images} />}

      {/* 音频内容 */}
      {answer.audio && <AudioPlayer audio={answer.audio} />}

      {/* 文本内容（支持 markdown 渲染） */}
      {answer.text && (
        <div className="prose prose-sm dark:prose-invert max-w-none whitespace-pre-wrap break-words text-[15px] leading-7 text-foreground">
          <ReactMarkdown remarkPlugins={[remarkGfm]}>{answer.text}</ReactMarkdown>
        </div>
      )}

      {/* 混合内容（lists） */}
      {lists.length > 0 && <ListsContent lists={lists} />}
    </div>
  )
}

function ThinkingProcess({ text }: { text: string }) {
  const [expanded, setExpanded] = React.useState(false)
  const needToggle = text.length > 200

  return (
    <div className="rounded-2xl border border-primary/20 bg-gradient-to-br from-primary/5 to-primary/10 p-5">
      <div className="mb-3 flex items-center">
        <Lightbulb className="mr-2.5 h-5 w-5 text-primary" />
        <span className="text-base font-semibold text-primary">思考过程</span>
      </div>
      <div
        className={`relative overflow-hidden transition-all duration-300 ${
          expanded ? 'max-h-none' : 'max-h-[200px]'
        }`}
      >
        <p className="whitespace-pre-wrap break-words text-sm leading-relaxed text-muted-foreground">
          {text}
        </p>
      </div>
      {needToggle && (
        <button
          onClick={() => setExpanded((v) => !v)}
          className="mt-3 flex w-full items-center justify-center gap-2 py-2 text-sm text-primary"
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

function ShareVideo({ video }: { video: NonNullable<ShareContent['answer']['video']> }) {
  const isVertical = video.width && video.height ? video.height > video.width : false

  if (isVertical) {
    return (
      <div
        className="inline-block overflow-hidden rounded-lg"
        style={{ width: '118px', height: '210px' }}
      >
        <VideoPlayer src={video.url} poster={video.cover} className="h-full w-full" />
      </div>
    )
  }

  const aspectRatio =
    video.width && video.height && video.width > 0 ? `${video.width} / ${video.height}` : '16 / 9'

  return (
    <div className="overflow-hidden rounded-lg" style={{ aspectRatio }}>
      <VideoPlayer src={video.url} poster={video.cover} className="h-full w-full" />
    </div>
  )
}

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
            <Image
              src={url}
              alt={`图片${idx + 1}`}
              width={400}
              height={400}
              className="h-full w-full cursor-pointer object-cover transition-transform hover:scale-105"
              style={{ width: '100%', height: 'auto' }}
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
  const src = images[current]
  if (!src) return null

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

      <Image
        src={src}
        alt={`预览图片 ${current + 1}`}
        width={1920}
        height={1080}
        className="max-h-[90vh] max-w-[90vw] object-contain"
        style={{ width: 'auto', height: 'auto' }}
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
    <div className="flex items-center rounded-2xl bg-muted px-5 py-3.5">
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
        className="flex h-10 w-10 shrink-0 items-center justify-center text-xl text-primary"
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
        className="mx-5 h-1.5 flex-1 cursor-pointer accent-primary"
      />
      <Volume2 className="mr-1 h-4 w-4 shrink-0 text-muted-foreground/70" />
      <span className="shrink-0 text-xs text-muted-foreground">{formatAudioTime(currentTime)}</span>
    </div>
  )
}

function ListsContent({ lists }: { lists: ShareListItem[] }) {
  return (
    <div className="space-y-2.5">
      {lists.map((item, idx) => {
        if (item.type === 'text' && item.content) {
          return (
            <p
              key={`list-${idx}`}
              className="whitespace-pre-wrap break-words text-sm leading-relaxed text-foreground"
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
              <Image
                src={item.content}
                alt={`图片${idx + 1}`}
                width={800}
                height={600}
                className="w-full cursor-pointer object-cover"
                style={{ width: '100%', height: 'auto' }}
              />
            </button>
          )
        }
        return null
      })}
    </div>
  )
}
