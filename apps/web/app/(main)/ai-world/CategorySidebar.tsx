'use client'

import * as React from 'react'
import {
  Bot,
  Image as ImageIcon,
  Video,
  Music,
  Code,
  Search,
  Cloud,
  Boxes,
  Layers,
  Newspaper,
  FileText,
  Github,
  Sparkles,
  LayoutGrid,
} from 'lucide-react'

import type { AiCategory } from './types'

const ICON_MAP: Record<string, React.ComponentType<{ className?: string }>> = {
  Bot,
  Image: ImageIcon,
  Video,
  Music,
  Code,
  Search,
  Cloud,
  Boxes,
  Layers,
  Newspaper,
  FileText,
  Github,
  Sparkles,
}

interface Props {
  categories: AiCategory[]
  activeCategory: string | null
  onChange: (slug: string | null) => void
}

export function CategorySidebar({ categories, activeCategory, onChange }: Props) {
  return (
    <div className="space-y-1">
      <button
        type="button"
        onClick={() => onChange(null)}
        className={`flex w-full items-center gap-2 rounded-md px-2.5 py-1.5 text-sm transition-colors ${
          activeCategory === null
            ? 'bg-accent text-accent-foreground'
            : 'text-muted-foreground hover:bg-accent/50 hover:text-foreground'
        }`}
      >
        <LayoutGrid className="h-4 w-4" />
        <span>全部</span>
      </button>
      {categories.map((cat) => {
        const Icon = ICON_MAP[cat.icon ?? ''] ?? Sparkles
        const active = activeCategory === cat.slug
        return (
          <button
            key={cat.id}
            type="button"
            onClick={() => onChange(active ? null : cat.slug)}
            className={`flex w-full items-center gap-2 rounded-md px-2.5 py-1.5 text-sm transition-colors ${
              active
                ? 'bg-accent text-accent-foreground'
                : 'text-muted-foreground hover:bg-accent/50 hover:text-foreground'
            }`}
          >
            <Icon className="h-4 w-4 shrink-0" />
            <span className="truncate">{cat.name}</span>
          </button>
        )
      })}
    </div>
  )
}
