'use client'

import * as React from 'react'
import Link from 'next/link'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { useTranslations } from 'next-intl'
import { useQuery } from '@tanstack/react-query'
import { Loader2, Camera, Check } from 'lucide-react'

import { fetchApi } from '@/lib/api'
import { useAuthStore } from '@/stores/auth'
import { Button, Input, Label } from '@ihui/ui'
import { cn } from '@/lib/utils'
import { Avatar } from '@/components/data/Avatar'
import { TokenUsagePanel } from '@/components/ai/token-usage-panel'

const profileSchema = z.object({
  nickname: z.string().min(2).max(20),
  email: z.string().email(),
  bio: z.string().max(200).optional().or(z.literal('')),
})

type ProfileForm = z.infer<typeof profileSchema>

interface UserStats {
  followingCount: number
  followersCount: number
  favoritesCount: number
}

interface ProfileResponse {
  user: {
    nickname: string
    phone: string
    email: string
    bio: string
  }
  stats: UserStats
}

interface ChatHistoryItem {
  promptTokens: number
  completionTokens: number
  totalTokens: number
  model: string
}

interface ChatHistoryData {
  list: ChatHistoryItem[]
  total: number
}

export default function ProfilePage() {
  const t = useTranslations('user.profile')
  const user = useAuthStore((s) => s.user)
  const setUser = useAuthStore((s) => s.setUser)
  const [saved, setSaved] = React.useState(false)
  const [errorMsg, setErrorMsg] = React.useState('')
  const [avatarUploading, setAvatarUploading] = React.useState(false)
  const fileInputRef = React.useRef<HTMLInputElement>(null)

  const {
    register,
    handleSubmit,
    reset,
    formState: { errors, isSubmitting },
  } = useForm<ProfileForm>({
    resolver: zodResolver(profileSchema as never),
    defaultValues: {
      nickname: user?.nickname ?? '',
      email: '',
      bio: '',
    },
  })

  // 拉取最新资料 + 统计计数
  const { data, isError } = useQuery({
    queryKey: ['user', 'profile', user?.id],
    queryFn: async () => {
      const res = await fetchApi<ProfileResponse>(`/api/users/${user!.id}`)
      if (!res.success) throw new Error(res.error)
      return res.data
    },
    enabled: !!user?.id,
  })

  // 拉取 AI 用量历史并聚合
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

  // 资料到达后填充表单
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
    // 重置 input 允许重复选同一文件
    if (fileInputRef.current) fileInputRef.current.value = ''
  }

  const stats = data?.stats
  const statsItems: { label: string; value: number | undefined; href: string }[] = [
    { label: t('following'), value: stats?.followingCount, href: '/following?tab=following' },
    { label: t('followers'), value: stats?.followersCount, href: '/following?tab=followers' },
    { label: t('favorites'), value: stats?.favoritesCount, href: '/favorites' },
  ]

  return (
    <div className="mx-auto max-w-2xl space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">{t('title')}</h1>
        <p className="mt-1 text-sm text-muted-foreground">{t('subtitle')}</p>
      </div>

      {/* 头像 */}
      <div className="flex items-center gap-4">
        <div className="relative h-20 w-20 shrink-0">
          <Avatar
            src={user?.avatar ?? undefined}
            name={user?.nickname ?? 'U'}
            size="xl"
            className="h-20 w-20 text-2xl"
          />
          <input
            ref={fileInputRef}
            type="file"
            accept="image/jpeg,image/png,image/webp,image/gif"
            onChange={handleAvatarChange}
            className="hidden"
          />
          <button
            type="button"
            title={t('avatar')}
            disabled={avatarUploading}
            onClick={() => fileInputRef.current?.click()}
            className="absolute -bottom-0.5 -right-0.5 flex h-7 w-7 items-center justify-center rounded-full border bg-background shadow-sm transition-colors hover:bg-accent disabled:opacity-50"
          >
            {avatarUploading ? (
              <Loader2 className="h-3.5 w-3.5 animate-spin" />
            ) : (
              <Camera className="h-3.5 w-3.5" />
            )}
          </button>
        </div>
        <p className="text-xs text-muted-foreground">{t('avatarHint')}</p>
      </div>

      {/* 统计卡片 */}
      <div className="grid grid-cols-3 gap-3">
        {statsItems.map((item) => (
          <Link
            key={item.label}
            href={item.href}
            className="flex flex-col items-center justify-center rounded-lg border bg-card px-3 py-3 transition-colors hover:bg-accent"
          >
            <span className="text-xl font-bold tabular-nums">
              {isError ? (
                <span className="text-sm text-destructive">--</span>
              ) : item.value === undefined ? (
                <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
              ) : (
                item.value
              )}
            </span>
            <span className="mt-0.5 text-xs text-muted-foreground">{item.label}</span>
          </Link>
        ))}
      </div>

      {/* AI 用量 */}
      <div className="space-y-2">
        <h2 className="text-sm font-semibold">AI 用量统计</h2>
        <TokenUsagePanel
          promptTokens={aiStats.promptTokens}
          completionTokens={aiStats.completionTokens}
          totalTokens={aiStats.totalTokens}
          model={aiStats.latestModel}
        />
      </div>

      {/* 表单 */}
      <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
        <div className="space-y-1.5">
          <Label htmlFor="nickname">{t('nickname')}</Label>
          <Input id="nickname" {...register('nickname')} placeholder={t('nicknamePlaceholder')} />
          {errors.nickname && <p className="text-xs text-destructive">{t('nicknameError')}</p>}
        </div>

        <div className="space-y-1.5">
          <Label htmlFor="phone">{t('phone')}</Label>
          <Input id="phone" value={user?.phone ?? ''} readOnly disabled className="bg-muted/50" />
        </div>

        <div className="space-y-1.5">
          <Label htmlFor="email">{t('email')}</Label>
          <Input
            id="email"
            type="email"
            {...register('email')}
            placeholder={t('emailPlaceholder')}
          />
          {errors.email && <p className="text-xs text-destructive">{t('emailError')}</p>}
        </div>

        <div className="space-y-1.5">
          <Label htmlFor="bio">{t('bio')}</Label>
          <textarea
            id="bio"
            {...register('bio')}
            rows={3}
            placeholder={t('bioPlaceholder')}
            className={cn(
              'w-full rounded-md border border-input bg-transparent px-3 py-2 text-sm shadow-sm transition-colors',
              'placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring',
              'disabled:cursor-not-allowed disabled:opacity-50',
            )}
          />
          {errors.bio && <p className="text-xs text-destructive">{t('bioError')}</p>}
        </div>

        <div className="flex items-center gap-3">
          <Button type="submit" disabled={isSubmitting}>
            {isSubmitting ? (
              <>
                <Loader2 className="mr-1.5 h-4 w-4 animate-spin" />
                {t('saving')}
              </>
            ) : (
              t('save')
            )}
          </Button>
          {saved && (
            <span className="inline-flex items-center gap-1 text-sm text-emerald-600 dark:text-emerald-500">
              <Check className="h-4 w-4" />
              {t('saved')}
            </span>
          )}
          {errorMsg && <p className="text-xs text-destructive">{errorMsg}</p>}
        </div>
      </form>
    </div>
  )
}
