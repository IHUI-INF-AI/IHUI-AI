'use client'

import { X } from 'lucide-react'
import { Input, Button } from '@ihui/ui'

interface Props {
  tags: string[]
  value: string
  onChange: (v: string) => void
  onAdd: () => void
  onRemove: (tag: string) => void
}

export function TagInput({ tags, value, onChange, onAdd, onRemove }: Props) {
  return (
    <div className="space-y-2">
      <div className="flex gap-2">
        <Input
          id="kb-tags"
          value={value}
          onChange={(e) => onChange(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter') {
              e.preventDefault()
              onAdd()
            }
          }}
          placeholder="输入标签后回车"
        />
        <Button type="button" variant="outline" onClick={onAdd}>
          添加
        </Button>
      </div>
      {tags.length > 0 && (
        <div className="flex flex-wrap gap-1.5 pt-1">
          {tags.map((tag) => (
            <span
              key={tag}
              className="inline-flex items-center gap-1 rounded-md bg-primary/10 px-2 py-0.5 text-xs text-primary"
            >
              {tag}
              <button type="button" onClick={() => onRemove(tag)}>
                <X className="h-3 w-3" />
              </button>
            </span>
          ))}
        </div>
      )}
    </div>
  )
}
