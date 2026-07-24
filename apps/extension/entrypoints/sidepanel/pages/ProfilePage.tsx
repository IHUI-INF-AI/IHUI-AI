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
  }, [])

  if (loading) return <div className="empty-state">{t('common.loading')}</div>
  if (error) return <div className="error-banner">{error}</div>
  if (!profile) return null

  return (
    <div className="sp-page">
      <div className="sp-page-header">
        <h3>{t('profile.title')}</h3>
      </div>
      <Card>
        <CardHeader>
          <CardTitle>{profile.nickname || t('profile.noNickname')}</CardTitle>
        </CardHeader>
        <CardContent>
          <dl className="sp-info-list">
            <div>
              <dt>{t('profile.idLabel')}</dt>
              <dd>{profile.id}</dd>
            </div>
            <div>
              <dt>{t('profile.emailLabel')}</dt>
              <dd>{profile.email || '—'}</dd>
            </div>
            <div>
              <dt>{t('profile.phoneLabel')}</dt>
              <dd>{profile.phone || '—'}</dd>
            </div>
          </dl>
        </CardContent>
      </Card>
    </div>
  )
}
