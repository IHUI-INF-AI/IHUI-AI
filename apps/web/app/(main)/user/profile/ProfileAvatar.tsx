'use client'

import * as React from 'react'
import { Loader2, Camera } from 'lucide-react'
import { useTranslations } from 'next-intl'
import { Avatar } from '@/components/data/Avatar'

interface Props {
  avatar?: string
  nickname: string
  uploading: boolean
  fileInputRef: React.RefObject<HTMLInputElement | null>
  onFileChange: (e: React.ChangeEvent<HTMLInputElement>) => void
}

export function ProfileAvatar({ avatar, nickname, uploading, fileInputRef, onFileChange }: Props) {
  const t = useTranslations('user.profile')
  return (
    <div className="flex items-center gap-4">
      <div className="relative h-20 w-20 shrink-0">
        <Avatar src={avatar} name={nickname || 'U'} size="xl" className="h-20 w-20 text-2xl" />
        <input
          ref={fileInputRef}
          type="file"
          accept="image/jpeg,image/png,image/webp,image/gif"
          onChange={onFileChange}
          className="hidden"
        />
        <button
          type="button"
          title={t('avatar')}
          disabled={uploading}
          onClick={() => fileInputRef.current?.click()}
          className="absolute -bottom-0.5 -right-0.5 flex h-7 w-7 items-center justify-center rounded-full border bg-background shadow-sm transition-colors hover:bg-accent disabled:opacity-50"
        >
          {uploading ? (
            <Loader2 className="h-3.5 w-3.5 animate-spin" />
          ) : (
            <Camera className="h-3.5 w-3.5" />
          )}
        </button>
      </div>
      <p className="text-xs text-muted-foreground">{t('avatarHint')}</p>
    </div>
  )
}
