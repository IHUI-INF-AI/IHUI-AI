import { useEffect, useState } from 'react'
import { getPoints, signIn, type PointsInfo } from '@ihui/api-client'
import { Card, CardContent } from '@ihui/ui-react'
import { useI18n } from '../../../src/i18n'

export default function PointsPage() {
  const { t } = useI18n()
  const [info, setInfo] = useState<PointsInfo | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [signing, setSigning] = useState(false)
  const [signMsg, setSignMsg] = useState('')

  const load = async () => {
    setLoading(true)
    setError('')
    try {
      const res = await getPoints()
      if (res.success) setInfo(res.data)
      else setError(res.error || t('common.failed'))
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

  const onSignIn = async () => {
    setSigning(true)
    setSignMsg('')
    try {
      const res = await signIn()
      if (res.success) {
        setSignMsg(`+${res.data.points}`)
        await load()
      } else {
        setSignMsg(res.error || t('common.failed'))
      }
    } catch {
      setSignMsg(t('common.failed'))
    } finally {
      setSigning(false)
    }
  }

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

  const stats = [
    { label: t('apps.points'), value: info?.balance ?? 0 },
    { label: '累计获得', value: info?.totalEarned ?? 0 },
    { label: '累计消耗', value: info?.totalSpent ?? 0 },
  ]

  return (
    <div className="p-3 md:p-4 flex flex-col gap-2.5">
      <div className="flex items-center justify-between pb-2 border-b border-border">
        <h3 className="m-0 text-sm font-semibold">{t('apps.points')}</h3>
      </div>
      <Card>
        <CardContent className="p-4 flex items-center justify-between">
          <div className="min-w-0">
            <div className="text-2xl font-semibold tabular-nums">{info?.balance ?? 0}</div>
            <div className="text-xs text-muted-foreground mt-0.5">
              {info?.todaySignedIn
                ? `已连续签到 ${info.continuousDays} 天`
                : '今日未签到'}
            </div>
          </div>
          <button
            type="button"
            disabled={!!info?.todaySignedIn || signing}
            onClick={onSignIn}
            className="shrink-0 h-8 rounded-md px-3 text-xs font-medium bg-primary text-primary-foreground hover:bg-primary/90 disabled:opacity-50 disabled:pointer-events-none cursor-pointer"
          >
            {info?.todaySignedIn ? '已签到' : t('apps.signIn')}
          </button>
        </CardContent>
        {signMsg ? <div className="px-4 pb-2 text-xs text-primary">{signMsg}</div> : null}
      </Card>
      <div className="grid grid-cols-3 gap-2">
        {stats.map((s) => (
          <Card key={s.label}>
            <CardContent className="p-3 text-center">
              <div className="text-base font-semibold tabular-nums">{s.value}</div>
              <div className="text-[11px] text-muted-foreground mt-0.5">{s.label}</div>
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  )
}
