'use client'

import * as React from 'react'
import { Download, X } from 'lucide-react'
import { cn } from '@/lib/utils'

interface PWAInstallPromptProps {
  className?: string
  promptEvent?: React.MutableRefObject<BeforeInstallPromptEvent | null>
}

interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>
}

export function PWAInstallPrompt({ className, promptEvent }: PWAInstallPromptProps) {
  const [deferredPrompt, setDeferredPrompt] = React.useState<BeforeInstallPromptEvent | null>(null)
  const [visible, setVisible] = React.useState(false)

  React.useEffect(() => {
    const handler = (e: Event) => {
      e.preventDefault()
      const evt = e as BeforeInstallPromptEvent
      setDeferredPrompt(evt)
      if (promptEvent) promptEvent.current = evt
      setVisible(true)
    }
    window.addEventListener('beforeinstallprompt', handler)
    return () => window.removeEventListener('beforeinstallprompt', handler)
  }, [promptEvent])

  const handleInstall = async () => {
    if (!deferredPrompt) return
    await deferredPrompt.prompt()
    await deferredPrompt.userChoice
    setDeferredPrompt(null)
    setVisible(false)
  }

  if (!visible) return null

  return (
    <div className={cn('flex items-center gap-3 rounded-lg border bg-card p-3 shadow', className)}>
      <Download className="h-5 w-5 shrink-0 text-primary" />
      <div className="flex-1 text-sm">
        <p className="font-medium">安装应用</p>
        <p className="text-xs text-muted-foreground">添加到主屏幕,获得更好体验</p>
      </div>
      <button
        onClick={handleInstall}
        className="rounded-md bg-primary px-3 py-1.5 text-xs font-medium text-primary-foreground hover:bg-primary/90"
      >
        安装
      </button>
      <button onClick={() => setVisible(false)} className="text-muted-foreground hover:text-foreground">
        <X className="h-4 w-4" />
      </button>
    </div>
  )
}
