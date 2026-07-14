'use client'

import { cn } from '@/lib/utils'

interface Props {
  replies: string[]
  onSelect: (reply: string) => void
}

export function QuickReplies({ replies, onSelect }: Props) {
  if (replies.length === 0) return null
  return (
    <div className="flex gap-2 overflow-x-auto pb-1">
      {replies.map((reply) => (
        <button
          key={reply}
          type="button"
          onClick={() => onSelect(reply)}
          className={cn(
            'shrink-0 rounded-full border bg-card px-3 py-1 text-xs transition-colors',
            'hover:bg-accent hover:text-accent-foreground',
          )}
        >
          {reply}
        </button>
      ))}
    </div>
  )
}

export default QuickReplies
