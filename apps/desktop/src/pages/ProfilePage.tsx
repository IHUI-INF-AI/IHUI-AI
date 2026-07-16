import { useEffect, useState } from 'react'
import { getProfile, type AuthUser } from '@ihui/api-client'
import { Card, CardContent, CardHeader, CardTitle } from '@ihui/ui'

export default function ProfilePage() {
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
        setError(res.error || '加载失败')
      }
      setLoading(false)
    })()
    return () => {
      cancelled = true
    }
  }, [])

  if (loading) {
    return (
      <div className="page page-profile">
        <div className="empty-state">加载中...</div>
      </div>
    )
  }

  if (error) {
    return (
      <div className="page page-profile">
        <div className="error-banner">{error}</div>
      </div>
    )
  }

  if (!profile) return null

  return (
    <div className="page page-profile">
      <header className="page-header">
        <h2>个人中心</h2>
      </header>
      <div className="profile-grid">
        <Card>
          <CardHeader>
            <CardTitle>基本信息</CardTitle>
          </CardHeader>
          <CardContent>
            <dl className="info-list">
              <div>
                <dt>用户 ID</dt>
                <dd>{profile.id}</dd>
              </div>
              <div>
                <dt>昵称</dt>
                <dd>{profile.nickname || '—'}</dd>
              </div>
              <div>
                <dt>邮箱</dt>
                <dd>{profile.email || '—'}</dd>
              </div>
              <div>
                <dt>手机号</dt>
                <dd>{profile.phone || '—'}</dd>
              </div>
              <div>
                <dt>角色</dt>
                <dd>{(profile.roleId ?? 0) >= 1 ? '管理员' : '普通用户'}</dd>
              </div>
            </dl>
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
