'use client'

import { useState, type KeyboardEvent } from 'react'
import { X } from 'lucide-react'
import { Input } from '@ihui/ui-react'
import { cn } from '@/lib/utils'

interface KeyTagsEditorProps {
  tags: string[]
  onChange: (tags: string[]) => void
  disabled?: boolean
}

const MAX_TAGS = 10
const MAX_TAG_LENGTH = 20
/** 允许字母、数字、中文、下划线、横线 */
const TAG_PATTERN = /^[a-zA-Z0-9\u4e00-\u9fa5_-]+$/

export function KeyTagsEditor({ tags, onChange, disabled = false }: KeyTagsEditorProps) {
  const [input, setInput] = useState('')

  const addTag = () => {
    const trimmed = input.trim()
    if (
      !trimmed ||
      trimmed.length > MAX_TAG_LENGTH ||
      !TAG_PATTERN.test(trimmed) ||
      tags.includes(trimmed) ||
      tags.length >= MAX_TAGS
    ) {
      return
    }
    onChange([...tags, trimmed])
    setInput('')
  }

  const removeTag = (tag: string) => {
    onChange(tags.filter((t) => t !== tag))
  }

  const handleKeyDown = (e: KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter') {
      e.preventDefault()
      addTag()
    }
  }

  const atLimit = tags.length >= MAX_TAGS

  return (
    <div className={cn('space-y-2', disabled && 'pointer-events-none opacity-50')}>
      {tags.length > 0 && (
        <div className="flex flex-wrap gap-1.5">
          {tags.map((tag) => (
            <span
              key={tag}
              className="inline-flex items-center gap-1 rounded-md bg-primary/10 px-2 py-0.5 text-xs text-primary"
            >
              {tag}
              <button
                type="button"
                onClick={() => removeTag(tag)}
                className="text-primary/60 transition-colors hover:text-destructive"
                aria-label={`移除标签 ${tag}`}
              >
                <X className="h-3 w-3" />
              </button>
            </span>
          ))}
        </div>
      )}
      <Input
        value={input}
        onChange={(e) => setInput(e.target.value)}
        onKeyDown={handleKeyDown}
        placeholder={atLimit ? '已达标签上限' : '输入标签后回车添加'}
        disabled={disabled || atLimit}
        className="text-xs"
      />
    </div>
  )
}
