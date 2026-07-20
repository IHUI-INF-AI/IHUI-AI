'use client'

import * as React from 'react'
import { useTranslations } from 'next-intl'
import { toast } from 'sonner'
import { Camera, Loader2, Upload, User } from 'lucide-react'
import Image from 'next/image'

import { Card, CardHeader, CardTitle, CardContent, Button } from '@ihui/ui'
import { Container } from '@/components/layout'
import { Tooltip } from '@/components/feedback'
import { useAuth } from '@/hooks/use-auth'
import { useAuthStore } from '@/stores/auth'

export default function AvatarPage() {
  const t = useTranslations('settings')
  const { user, token } = useAuth()
  const setUser = useAuthStore((s) => s.setUser)

  const fileInputRef = React.useRef<HTMLInputElement>(null)
  const [preview, setPreview] = React.useState<string | null>(null)
  const [selectedFile, setSelectedFile] = React.useState<File | null>(null)
  const [uploading, setUploading] = React.useState(false)

  const currentAvatar = user?.avatar ?? undefined
  const displayName = user?.nickname ?? 'U'

  const onFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return
    if (!file.type.startsWith('image/')) {
      toast.error(t('avatarUploadFail'))
      return
    }
    setSelectedFile(file)
    const reader = new FileReader()
    reader.onload = () => setPreview(reader.result as string)
    reader.readAsDataURL(file)
  }

  const onUpload = async () => {
    if (!selectedFile || !user?.id) return
    setUploading(true)
    const formData = new FormData()
    formData.append('file', selectedFile)
    try {
      const res = await fetch(`/api/users/${user.id}/avatar`, {
        method: 'POST',
        body: formData,
        headers: token ? { Authorization: `Bearer ${token}` } : {},
      })
      if (!res.ok) {
        const text = await res.text().catch(() => '')
        let msg = t('avatarUploadFail')
        try {
          const parsed = JSON.parse(text)
          if (parsed?.message) msg = parsed.message
        } catch {
          // ignore
        }
        toast.error(msg)
        return
      }
      const json = await res.json()
      const newAvatar = json?.data?.user?.avatar ?? json?.user?.avatar ?? json?.data?.avatar
      if (newAvatar) {
        setUser({ ...user, avatar: newAvatar })
      }
      toast.success(t('avatarUploadSuccess'))
      setPreview(null)
      setSelectedFile(null)
      if (fileInputRef.current) fileInputRef.current.value = ''
    } catch {
      toast.error(t('avatarUploadFail'))
    } finally {
      setUploading(false)
    }
  }

  const onReset = () => {
    setPreview(null)
    setSelectedFile(null)
    if (fileInputRef.current) fileInputRef.current.value = ''
  }

  const displaySrc = preview ?? currentAvatar

  return (
    <Container maxWidth="md" padding={false} className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">{t('avatarTitle')}</h1>
        <p className="mt-1 text-sm text-muted-foreground">{t('avatarDesc')}</p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            <User className="h-4 w-4" />
            {t('avatarCurrent')}
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-6">
          <div className="flex items-center gap-6">
            <div className="relative h-24 w-24 shrink-0">
              <span className="relative flex h-24 w-24 items-center justify-center overflow-hidden rounded-2xl bg-muted text-2xl font-medium text-muted-foreground">
                {displaySrc ? (
                  <Image
                    src={displaySrc}
                    alt={displayName}
                    fill
                    className="object-cover"
                    unoptimized
                  />
                ) : (
                  displayName.slice(0, 2)
                )}
              </span>
              <Tooltip content={t('avatarUpload')}>
                <button
                  type="button"
                  disabled={uploading}
                  onClick={() => fileInputRef.current?.click()}
                  className="absolute -bottom-0.5 -right-0.5 flex h-8 w-8 items-center justify-center rounded-lg border bg-background shadow-sm transition-colors hover:bg-accent disabled:opacity-50"
                >
                  {uploading ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    <Camera className="h-4 w-4" />
                  )}
                </button>
              </Tooltip>
              <input
                ref={fileInputRef}
                type="file"
                accept="image/*"
                onChange={onFileChange}
                className="hidden"
              />
            </div>
            <div className="space-y-1">
              <p className="text-sm font-medium">{displayName}</p>
              <p className="text-xs text-muted-foreground">{t('avatarUpload')}</p>
            </div>
          </div>

          {selectedFile && (
            <div className="flex items-center gap-3 border-t pt-4">
              <div className="flex-1 truncate text-sm text-muted-foreground">
                {selectedFile.name}
                <span className="ml-2 text-xs">{(selectedFile.size / 1024).toFixed(1)} KB</span>
              </div>
              <Button variant="ghost" size="sm" onClick={onReset} disabled={uploading}>
                {t('avatarCancel')}
              </Button>
              <Button size="sm" onClick={onUpload} disabled={uploading}>
                {uploading ? (
                  <>
                    <Loader2 className="h-4 w-4 animate-spin" />
                    {t('avatarUploading')}
                  </>
                ) : (
                  <>
                    <Upload className="h-4 w-4" />
                    {t('avatarUploadBtn')}
                  </>
                )}
              </Button>
            </div>
          )}
        </CardContent>
      </Card>
    </Container>
  )
}
