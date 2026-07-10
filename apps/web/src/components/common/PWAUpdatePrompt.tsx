'use client'

import * as React from 'react'
import { RefreshCw, X } from 'lucide-react'
import { cn } from '@/lib/utils'

interface PWAUpdatePromptProps {
  onUpdate?: () => void
  className?: string
}

export function PWAUpdatePrompt({ onUpdate, className }: PWAUpdatePromptProps) {
  const [visible, setVisible] = React.useState(false)

  React.useEffect(() => {
    const handler = () => setVisible(true)
    window.addEventListener('pwa-update-available', handler)
    return () => window.removeEventListener('pwa-update-available', handler)
  }, [])

  const handleUpdate = () => {
    onUpdate?.()
    setVisible(false)
  }

  if (!visible) return null

  return (
    <div className={cn('flex items-center gap-3 rounded-lg border bg-card p-3 shadow', className)}>
      <RefreshCw className="h-5 w-5 shrink-0 text-primary" />
      <div className="flex-1 text-sm">
        <p className="font-medium">有新版本可用</p>
        <p className="text-xs text-muted-foreground">刷新页面以获取最新版本</p>
      </div>
      <button
        onClick={handleUpdate}
        className="rounded-md bg-primary px-3 py-1.5 text-xs font-medium text-primary-foreground hover:bg-primary/90"
      >
        更新
      </button>
      <button onClick={() => setVisible(false)} className="text-muted-foreground hover:text-foreground">
        <X className="h-4 w-4" />
      </button>
    </div>
  )
}
