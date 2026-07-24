'use client'

import * as React from 'react'
import Image from 'next/image'
import { FileText, Link as LinkIcon, Type, ImageIcon, Film, ChevronDown, X } from 'lucide-react'

import { Button } from '@ihui/ui-react'
import { cn } from '@/lib/utils'

type ReferenceType = 'file' | 'url' | 'text' | 'image' | 'video'

interface ReferenceItem {
  id: string
  type: ReferenceType
  label: string
  preview?: string
  /** 图片/视频缩略图 URL(objectURL) */
  thumbnail?: string
  /** 原始文件大小(字节) */
  size?: number
}

interface ContextReferencePanelProps {
  references: ReferenceItem[]
  onRemove?: (id: string) => void
}

const TYPE_META: Record<
  ReferenceType,
  { icon: React.ComponentType<{ className?: string }>; cls: string }
> = {
  file: { icon: FileText, cls: 'text-primary' },
  url: { icon: LinkIcon, cls: 'text-purple-500' },
  text: { icon: Type, cls: 'text-emerald-500' },
  image: { icon: ImageIcon, cls: 'text-amber-500' },
  video: { icon: Film, cls: 'text-rose-500' },
}

export function ContextReferencePanel({ references, onRemove }: ContextReferencePanelProps) {
  const [expanded, setExpanded] = React.useState<Set<string>>(new Set())

  const toggle = (id: string) => {
    setExpanded((prev) => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }

  return (
    <div className="rounded-xl border bg-card">
      <div className="border-b px-4 py-2.5">
        <h3 className="text-sm font-semibold">上下文引用</h3>
      </div>
      <ul className="divide-y">
        {references.length === 0 ? (
          <p className="py-8 text-center text-sm text-muted-foreground">暂无引用</p>
        ) : (
          references.map((ref) => {
            const meta = TYPE_META[ref.type]
            const Icon = meta.icon
            const isOpen = expanded.has(ref.id)
            const hasPreview = Boolean(ref.preview) || Boolean(ref.thumbnail)
            const hasThumbnail = Boolean(ref.thumbnail)
            return (
              <li key={ref.id} className="px-4 py-2.5">
                <div className="flex items-center gap-2">
                  {/* 图片/视频缩略图优先显示(覆盖默认图标) */}
                  {hasThumbnail && ref.type === 'image' ? (
                    <Image
                      src={ref.thumbnail as string}
                      alt={ref.label}
                      width={40}
                      height={40}
                      className="h-10 w-10 shrink-0 rounded-md border object-cover"
                    />
                  ) : hasThumbnail && ref.type === 'video' ? (
                    <video
                      src={ref.thumbnail}
                      className="h-10 w-10 shrink-0 rounded-md border bg-black object-cover"
                      muted
                      preload="metadata"
                    />
                  ) : (
                    <Icon className={cn('h-4 w-4 shrink-0', meta.cls)} />
                  )}
                  <button
                    type="button"
                    onClick={() => hasPreview && toggle(ref.id)}
                    className={cn(
                      'min-w-0 flex-1 text-left text-sm',
                      hasPreview && 'cursor-pointer hover:text-primary',
                    )}
                  >
                    <span className="break-words">{ref.label}</span>
                  </button>
                  {hasPreview && (
                    <ChevronDown
                      className={cn(
                        'h-3.5 w-3.5 shrink-0 text-muted-foreground transition-transform',
                        isOpen && 'rotate-180',
                      )}
                    />
                  )}
                  {onRemove && (
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-6 w-6 shrink-0 text-muted-foreground hover:text-destructive"
                      onClick={() => onRemove(ref.id)}
                    >
                      <X className="h-3 w-3" />
                    </Button>
                  )}
                </div>
                {hasThumbnail && isOpen && (
                  <div className="mt-2 overflow-hidden rounded-md bg-muted/40 p-2">
                    {ref.type === 'image' ? (
                      <div className="relative h-64 w-full">
                        <Image
                          src={ref.thumbnail as string}
                          alt={ref.label}
                          fill
                          className="rounded-md object-contain"
                        />
                      </div>
                    ) : (
                      <video
                        src={ref.thumbnail}
                        className="max-h-64 w-full rounded-md"
                        controls
                        preload="metadata"
                      >
                        <track kind="captions" />
                      </video>
                    )}
                  </div>
                )}
                {!hasThumbnail && ref.preview && isOpen && (
                  <p className="mt-1.5 whitespace-pre-wrap rounded-md bg-muted/40 px-2.5 py-1.5 text-xs text-muted-foreground">
                    {ref.preview}
                  </p>
                )}
              </li>
            )
          })
        )}
      </ul>
    </div>
  )
}

export default ContextReferencePanel
