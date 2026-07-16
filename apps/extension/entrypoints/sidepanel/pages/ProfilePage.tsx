import { useEffect, useState } from 'react'
import { getProfile, type UserProfile as ApiUserProfile } from '@ihui/api-client'
import { Card, CardContent, CardHeader, CardTitle } from '@ihui/ui'

export default function ProfilePage() {
  const [profile, setProfile] = useState<ApiUserProfile | null>(null)
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
        setError(res.error || '加载失败')
      }
      setLoading(false)
    })()
    return () => {
      cancelled = true
    }
  }, [])

  if (loading) return <div className="empty-state">加载中...</div>
  if (error) return <div className="error-banner">{error}</div>
  if (!profile) return null

  return (
    <div className="sp-page">
      <div className="sp-page-header">
        <h3>个人中心</h3>
      </div>
      <Card>
        <CardHeader>
          <CardTitle>{profile.nickname || profile.username}</CardTitle>
        </CardHeader>
        <CardContent>
          <dl className="sp-info-list">
            <div>
              <dt>ID</dt>
              <dd>{profile.id}</dd>
            </div>
            <div>
              <dt>邮箱</dt>
              <dd>{profile.email || '—'}</dd>
            </div>
            <div>
              <dt>手机号</dt>
              <dd>{profile.phone || '—'}</dd>
            </div>
          </dl>
        </CardContent>
      </Card>
    </div>
  )
}
