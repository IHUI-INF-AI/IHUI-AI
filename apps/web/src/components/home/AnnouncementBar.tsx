'use client'

import * as React from 'react'
import { useTranslations } from 'next-intl'
import { Megaphone, X } from 'lucide-react'

const STORAGE_KEY = 'home-announcement-dismissed'

export function AnnouncementBar() {
  const t = useTranslations('home.announcement')
  const [visible, setVisible] = React.useState(false)
  const [text, setText] = React.useState('')

  React.useEffect(() => {
    try {
      const dismissed = localStorage.getItem(STORAGE_KEY)
      if (dismissed === '1') return
    } catch {
      // localStorage 不可用
    }
    setText(t('welcomeMessage'))
    setVisible(true)
  }, [t])

  const handleClose = () => {
    setVisible(false)
    try {
      localStorage.setItem(STORAGE_KEY, '1')
    } catch {
      // localStorage 不可用
    }
  }

  if (!visible) return null

  return (
    <div className="flex items-center gap-2 rounded-lg border border-primary/30 bg-primary/5 px-4 py-2">
      <Megaphone className="h-4 w-4 shrink-0 text-primary" />
      <p className="flex-1 truncate text-sm text-foreground/80">{text}</p>
      <button
        onClick={handleClose}
        className="shrink-0 rounded p-0.5 text-muted-foreground transition-colors hover:bg-primary/10 hover:text-primary"
        aria-label={t('close')}
      >
        <X className="h-3.5 w-3.5" />
      </button>
    </div>
  )
}
