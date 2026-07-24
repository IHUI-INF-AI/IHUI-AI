import { useEffect, useState } from 'react'
import { getProfile, getUserStatistics, type AuthUser, type UserStatistics } from '@ihui/api-client'
import { Card, CardContent, CardHeader, CardTitle } from '@ihui/ui-react'
import { useI18n } from '../../../src/i18n'

export default function DashboardPage() {
  const { t } = useI18n()
  const [user, setUser] = useState<AuthUser | null>(null)
  const [stats, setStats] = useState<UserStatistics | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  const load = async () => {
    setLoading(true)
    setError('')
    try {
      const [profileRes, statsRes] = await Promise.all([getProfile(), getUserStatistics()])
      if (profileRes.success) setUser(profileRes.data)
      if (statsRes.success) setStats(statsRes.data)
      if (!profileRes.success && !statsRes.success) {
        setError(profileRes.error || statsRes.error || t('common.failed'))
      }
    } catch {
      setError(t('common.failed'))
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    void load()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  if (loading) {
    return (
      <div className="text-center text-muted-foreground py-8 px-4 text-sm">
        {t('common.loading')}
      </div>
    )
  }
  if (error) {
    return (
      <div className="m-2 bg-destructive/10 text-destructive px-2.5 py-2 rounded-md border border-destructive text-xs">
        <div className="mb-2">{error}</div>
        <button
          type="button"
          onClick={load}
          className="px-2 py-1 rounded-md border border-destructive bg-transparent text-destructive text-xs cursor-pointer hover:bg-destructive/10"
        >
          {t('common.retry')}
        </button>
      </div>
    )
  }

  const statsList = [
    { label: t('apps.favorites'), value: stats?.favoriteCount ?? 0 },
    { label: t('apps.following'), value: stats?.followingCount ?? 0 },
    { label: t('apps.fans'), value: stats?.fansCount ?? 0 },
    { label: t('apps.points'), value: stats?.points ?? 0 },
    { label: t('apps.learn'), value: stats?.courseCount ?? 0 },
    { label: t('apps.studyHours') || '学时', value: stats?.studyHours ?? 0 },
  ]

  return (
    <div className="p-3 md:p-4 flex flex-col gap-2.5">
      <div className="flex items-center justify-between pb-2 border-b border-border">
        <h3 className="m-0 text-sm font-semibold">{t('apps.dashboard')}</h3>
      </div>
      <Card>
        <CardHeader className="p-4">
          <CardTitle>{user?.nickname || t('profile.noNickname')}</CardTitle>
        </CardHeader>
        <CardContent className="p-4 pt-0">
          <div className="text-xs text-muted-foreground">
            {user?.bio || t('apps.dashboardDesc')}
          </div>
        </CardContent>
      </Card>
      <div className="grid grid-cols-2 gap-2">
        {statsList.map((s) => (
          <Card key={s.label}>
            <CardContent className="p-3">
              <div className="text-lg font-semibold tabular-nums">{s.value}</div>
              <div className="text-xs text-muted-foreground mt-0.5">{s.label}</div>
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  )
}
