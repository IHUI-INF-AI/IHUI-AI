'use client'

import * as React from 'react'
import { Loader2, Camera } from 'lucide-react'
import { useTranslations } from 'next-intl'
import { Avatar } from '@/components/data/Avatar'
import { AvatarCropper } from './AvatarCropper'

interface Props {
  avatar?: string
  nickname: string
  uploading: boolean
  fileInputRef: React.RefObject<HTMLInputElement | null>
  onCropped: (file: File) => void
}

export function ProfileAvatar({ avatar, nickname, uploading, fileInputRef, onCropped }: Props) {
  const t = useTranslations('user.profile')
  const [cropOpen, setCropOpen] = React.useState(false)
  const [cropSrc, setCropSrc] = React.useState('')

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return
    const reader = new FileReader()
    reader.onload = () => {
      const result = reader.result
      if (typeof result === 'string') {
        setCropSrc(result)
        setCropOpen(true)
      }
    }
    reader.readAsDataURL(file)
  }

  const handleConfirm = (blob: Blob) => {
    const file = new File([blob], 'avatar.png', { type: 'image/png' })
    setCropOpen(false)
    setCropSrc('')
    onCropped(file)
    if (fileInputRef.current) fileInputRef.current.value = ''
  }

  const handleCancel = () => {
    setCropOpen(false)
    setCropSrc('')
    if (fileInputRef.current) fileInputRef.current.value = ''
  }

  return (
    <div className="flex items-center gap-4">
      <div className="relative h-20 w-20 shrink-0">
        <Avatar src={avatar} name={nickname || 'U'} size="xl" className="h-20 w-20 text-2xl" />
        <input
          ref={fileInputRef}
          type="file"
          accept="image/jpeg,image/png,image/webp,image/gif"
          onChange={handleFileChange}
          className="hidden"
        />
        <button
          type="button"
          title={t('avatar')}
          disabled={uploading}
          onClick={() => fileInputRef.current?.click()}
          className="absolute -bottom-0.5 -right-0.5 flex h-7 w-7 items-center justify-center rounded-md border bg-background shadow-sm transition-colors hover:bg-accent disabled:opacity-50"
        >
          {uploading ? (
            <Loader2 className="h-3.5 w-3.5 animate-spin" />
          ) : (
            <Camera className="h-3.5 w-3.5" />
          )}
        </button>
      </div>
      <p className="text-xs text-muted-foreground">{t('avatarHint')}</p>
      <AvatarCropper
        open={cropOpen}
        src={cropSrc}
        onConfirm={handleConfirm}
        onCancel={handleCancel}
      />
    </div>
  )
}
