'use client'

import * as React from 'react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { useTranslations } from 'next-intl'
import { useQuery } from '@tanstack/react-query'

import { fetchApi } from '@/lib/api'
import { useAuthStore } from '@/stores/auth'
import { TokenUsagePanel } from '@/components/ai/token-usage-panel'
import { RoutinesPanel } from '@/components/ai/routines-panel'
import { VoiceRecord } from '@/components/ai/voice-record'

import { ProfileAvatar } from './ProfileAvatar'
import { ProfileStatsCards } from './ProfileStatsCards'
import { ProfileAccountInfo } from './ProfileAccountInfo'
import { ProfileEditForm } from './ProfileEditForm'
import {
  profileSchema,
  type ProfileForm,
  type ProfileResponse,
  type ChatHistoryData,
} from './types'

export default function ProfilePage() {
  const t = useTranslations('user.profile')
  const user = useAuthStore((s) => s.user)
  const setUser = useAuthStore((s) => s.setUser)
  const [saved, setSaved] = React.useState(false)
  const [errorMsg, setErrorMsg] = React.useState('')
  const [avatarUploading, setAvatarUploading] = React.useState(false)
  const fileInputRef = React.useRef<HTMLInputElement>(null)

  const form = useForm<ProfileForm>({
    resolver: zodResolver(profileSchema as never),
    defaultValues: {
      nickname: user?.nickname ?? '',
      email: '',
      bio: '',
    },
  })
  const { reset } = form

  const { data, isError } = useQuery({
    queryKey: ['user', 'profile', user?.id],
    queryFn: async () => {
      const res = await fetchApi<ProfileResponse>(`/api/users/${user!.id}`)
      if (!res.success) throw new Error(res.error)
      return res.data
    },
    enabled: !!user?.id,
  })

  const { data: usageData } = useQuery({
    queryKey: ['user', 'ai-usage', user?.id],
    queryFn: async () => {
      const res = await fetchApi<ChatHistoryData>('/api/ai/history?pageSize=100')
      if (!res.success) throw new Error(res.error)
      return res.data
    },
    enabled: !!user?.id,
  })

  const aiStats = React.useMemo(() => {
    const list = usageData?.list ?? []
    return {
      promptTokens: list.reduce((s, i) => s + i.promptTokens, 0),
      completionTokens: list.reduce((s, i) => s + i.completionTokens, 0),
      totalTokens: list.reduce((s, i) => s + i.totalTokens, 0),
      latestModel: list[list.length - 1]?.model ?? '—',
    }
  }, [usageData])

  React.useEffect(() => {
    if (!data?.user) return
    reset({
      nickname: data.user.nickname ?? '',
      email: data.user.email ?? '',
      bio: data.user.bio ?? '',
    })
  }, [data, reset])

  const onSubmit = async (values: ProfileForm) => {
    setSaved(false)
    setErrorMsg('')
    const res = await fetchApi(`/api/users/${user?.id}`, {
      method: 'PATCH',
      body: JSON.stringify(values),
    })
    if (res.success) {
      setUser({ ...user!, ...values })
      setSaved(true)
    } else {
      setErrorMsg(res.error)
    }
  }

  const handleAvatarChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file || !user?.id) return
    setAvatarUploading(true)
    setErrorMsg('')
    const formData = new FormData()
    formData.append('file', file)
    const res = await fetchApi<{ user: { avatar: string } }>(`/api/users/${user.id}/avatar`, {
      method: 'POST',
      body: formData,
    })
    setAvatarUploading(false)
    if (res.success) {
      setUser({ ...user!, avatar: res.data.user.avatar })
    } else {
      setErrorMsg(res.error)
    }
    if (fileInputRef.current) fileInputRef.current.value = ''
  }

  return (
    <div className="mx-auto max-w-2xl space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">{t('title')}</h1>
        <p className="mt-1 text-sm text-muted-foreground">{t('subtitle')}</p>
      </div>

      <ProfileAvatar
        avatar={user?.avatar ?? undefined}
        nickname={user?.nickname ?? 'U'}
        uploading={avatarUploading}
        fileInputRef={fileInputRef}
        onFileChange={handleAvatarChange}
      />

      <ProfileStatsCards stats={data?.stats} isError={isError} />

      <ProfileAccountInfo user={user} data={data} />

      <div className="space-y-2">
        <h2 className="text-sm font-semibold">{t('aiUsage')}</h2>
        <TokenUsagePanel
          promptTokens={aiStats.promptTokens}
          completionTokens={aiStats.completionTokens}
          totalTokens={aiStats.totalTokens}
          model={aiStats.latestModel}
        />
      </div>

      <div className="space-y-2">
        <h2 className="text-sm font-semibold">{t('routines')}</h2>
        <RoutinesPanel routines={[]} />
      </div>

      <div className="space-y-2">
        <h2 className="text-sm font-semibold">{t('voiceRecord')}</h2>
        <VoiceRecord />
      </div>

      <ProfileEditForm
        form={form}
        onSubmit={onSubmit}
        isSubmitting={form.formState.isSubmitting}
        saved={saved}
        errorMsg={errorMsg}
        phone={user?.phone ?? ''}
      />
    </div>
  )
}
