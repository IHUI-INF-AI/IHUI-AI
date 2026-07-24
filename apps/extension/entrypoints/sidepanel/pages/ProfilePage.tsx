import { useEffect, useState } from 'react'
import { getProfile, type AuthUser } from '@ihui/api-client'
import { Card, CardContent, CardHeader, CardTitle } from '@ihui/ui-react'
import { useI18n } from '../../../src/i18n'

export default function ProfilePage() {
  const { t } = useI18n()
  const [profile, setProfile] = useState<AuthUser | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  useEffect(() => {
    let cancelled = false
    void (async () => {
      setLoading(true)
      setError('')
      const res = await getProfile()
      if (cancelled) return
      if (res.success) {
        setProfile(res.data)
      } else {
        setError(res.error || t('profile.loadFailed'))
      }
      setLoading(false)
    })()
    return () => {
      cancelled = true
    }
  }, [t])

  if (loading) {
    return (
      <div className="text-center text-muted-foreground py-8 px-4 text-sm">
        {t('common.loading')}
      </div>
    )
  }
  if (error) {
    return (
      <div className="bg-destructive/10 text-destructive px-2.5 py-2 rounded-md border border-destructive m-2 text-xs">
        {error}
      </div>
    )
  }
  if (!profile) return null

  return (
    <div className="p-3 flex flex-col gap-2.5">
      <div className="flex items-center justify-between pb-2 border-b border-border">
        <h3 className="m-0 text-sm font-semibold">{t('profile.title')}</h3>
      </div>
      <Card>
        <CardHeader>
          <CardTitle>{profile.nickname || t('profile.noNickname')}</CardTitle>
        </CardHeader>
        <CardContent>
          <dl className="flex flex-col gap-2 m-0">
            <div className="flex justify-between text-xs">
              <dt className="text-muted-foreground m-0">{t('profile.idLabel')}</dt>
              <dd className="m-0">{profile.id}</dd>
            </div>
            <div className="flex justify-between text-xs">
              <dt className="text-muted-foreground m-0">{t('profile.emailLabel')}</dt>
              <dd className="m-0">{profile.email || '—'}</dd>
            </div>
            <div className="flex justify-between text-xs">
              <dt className="text-muted-foreground m-0">{t('profile.phoneLabel')}</dt>
              <dd className="m-0">{profile.phone || '—'}</dd>
            </div>
          </dl>
        </CardContent>
      </Card>
    </div>
  )
}
