'use client'

import * as React from 'react'
import { useTranslations } from 'next-intl'
import { User as UserIcon, Save } from 'lucide-react'
import { toast } from 'sonner'

import { Card, CardHeader, CardTitle, CardContent, Button } from '@ihui/ui'
import { Container } from '@/components/layout'
import { Input, Select } from '@/components/form'
import { fetchApi } from '@/lib/api'

interface UserProfile {
  id: string
  nickname: string
  email: string | null
  gender: string | null
}

export default function ProfilePage() {
  const t = useTranslations('settings')
  const [nickname, setNickname] = React.useState('')
  const [email, setEmail] = React.useState('')
  const [gender, setGender] = React.useState<string>('')
  const [loading, setLoading] = React.useState(true)
  const [saving, setSaving] = React.useState(false)

  const genderOptions = [
    { label: t('genderMale'), value: 'male' },
    { label: t('genderFemale'), value: 'female' },
    { label: t('genderOther'), value: 'other' },
  ]

  React.useEffect(() => {
    let cancelled = false
    fetchApi<UserProfile>('/api/auth/me')
      .then((res) => {
        if (cancelled) return
        if (res.success) {
          setNickname(res.data.nickname ?? '')
          setEmail(res.data.email ?? '')
          setGender(res.data.gender ?? '')
        } else {
          toast.error(res.error)
        }
      })
      .catch(() => {
        if (!cancelled) toast.error(t('profileLoadFailed'))
      })
      .finally(() => {
        if (!cancelled) setLoading(false)
      })
    return () => {
      cancelled = true
    }
  }, [t])

  const handleSave = async () => {
    if (saving) return
    setSaving(true)
    try {
      const res = await fetchApi<UserProfile>('/api/auth/profile', {
        method: 'PUT',
        body: JSON.stringify({ nickname, email, gender }),
      })
      if (res.success) {
        toast.success(t('profileSaveSuccess'))
      } else {
        toast.error(res.error || t('profileSaveFailed'))
      }
    } catch {
      toast.error(t('profileSaveFailed'))
    } finally {
      setSaving(false)
    }
  }

  return (
    <Container maxWidth="md" padding={false} className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">{t('profileTitle')}</h1>
        <p className="mt-1 text-sm text-muted-foreground">{t('profileDesc')}</p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            <UserIcon className="h-4 w-4" />
            {t('profileTitle')}
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          {loading ? (
            <p className="py-8 text-center text-sm text-muted-foreground">{t('profileLoading')}</p>
          ) : (
            <>
              <Input
                label={t('profileNickname')}
                placeholder={t('profileNicknamePlaceholder')}
                value={nickname}
                onChange={(e) => setNickname(e.target.value)}
              />
              <Input
                label={t('profileEmail')}
                type="email"
                placeholder={t('profileEmailPlaceholder')}
                value={email}
                onChange={(e) => setEmail(e.target.value)}
              />
              <Select
                label={t('profileGender')}
                options={genderOptions}
                value={gender}
                onChange={(v) => setGender(String(v))}
                placeholder={t('profileGenderPlaceholder')}
              />
              <Button className="w-full" disabled={saving} onClick={handleSave}>
                <Save className="h-4 w-4" />
                {saving ? t('profileSaving') : t('profileSave')}
              </Button>
            </>
          )}
        </CardContent>
      </Card>
    </Container>
  )
}
