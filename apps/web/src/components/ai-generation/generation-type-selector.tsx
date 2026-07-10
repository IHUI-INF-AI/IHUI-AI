'use client'

import * as React from 'react'
import { Sparkles, Image as ImageIcon, Video, Box, Eye, Music, Music4 } from 'lucide-react'

import { cn } from '@/lib/utils'
import type { GenerationType } from '../ai/types'

interface GenerationTypeSelectorProps {
  value: GenerationType
  onChange: (type: GenerationType) => void
}

const OPTIONS: Array<{
  value: GenerationType
  label: string
  icon: React.ElementType
  color: string
}> = [
  { value: 'auto', label: '自动', icon: Sparkles, color: 'text-primary' },
  { value: 'image', label: '图像', icon: ImageIcon, color: 'text-violet-500' },
  { value: 'video', label: '视频', icon: Video, color: 'text-pink-500' },
  { value: '3d', label: '3D', icon: Box, color: 'text-orange-500' },
  { value: 'vision', label: '视觉', icon: Eye, color: 'text-cyan-500' },
  { value: 'audio', label: '语音', icon: Music, color: 'text-amber-500' },
  { value: 'music', label: '音乐', icon: Music4, color: 'text-fuchsia-500' },
]

/** GenerationTypeSelector - 生成类型选择器 */
export function GenerationTypeSelector({ value, onChange }: GenerationTypeSelectorProps) {
  return (
    <div className="flex flex-wrap gap-1.5">
      {OPTIONS.map((opt) => {
        const active = opt.value === value
        const Icon = opt.icon
        return (
          <button
            key={opt.value}
            type="button"
            onClick={() => onChange(opt.value)}
            className={cn(
              'inline-flex items-center gap-1.5 rounded-md border px-2.5 py-1.5 text-xs font-medium transition-colors',
              active
                ? 'border-primary bg-primary/10 text-primary'
                : 'border-border bg-card text-muted-foreground hover:bg-accent',
            )}
          >
            <Icon className={cn('h-3.5 w-3.5', !active && opt.color)} />
            {opt.label}
          </button>
        )
      })}
    </div>
  )
}

export default GenerationTypeSelector
