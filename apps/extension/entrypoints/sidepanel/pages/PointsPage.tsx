/**
 * PointsPage — 积分中心(/me/points,2026-08-21 立)。
 * 展示当前积分与签到状态,数据来自 GET /points;支持签到 POST /api/sign-in。
 */
import { useEffect, useState } from 'react'
import { getPoints, signIn, type PointsInfo } from '@ihui/api-client'
import { Card, CardContent } from '@ihui/ui-react'
import { useI18n } from '../../../src/i18n'

function fmt(n: number | undefined): string {
  if (typeof n !== 'number') return '—'
  return n.toLocaleString('zh-CN')
}

export default function PointsPage() {
  const { t } = useI18n()
  const [data, setData] = useState<PointsInfo | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  const load = async () => {
    setLoading(true)
    setError('')
    try {
      const res = await getPoints()
      if (res.success) setData(res.data)
      else setError(res.error || t('common.failed'))
    } catch {
      setError(t('common.failed'))
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    void load()
    // eslint-disable-next-line react-hooks/exhaustive-deps -- 挂载时加载一次
  }, [])

  const onSignIn = async () => {
    setError('')
    try {
      const res = await signIn()
      if (res.success) {
        await load()
      } else {
        setError(res.error || t('common.failed'))
      }
    } catch {
      setError(t('common.failed'))
    }
  }

  if (loading) {
    return (
      <div className="text-center text-muted-foreground py-8 px-4 text-sm">
        {t('common.loading')}
      </div>
    )
  }
  if (error && !data) {
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

  return (
    <div className="p-3 md:p-4 flex flex-col gap-2.5">
      <div className="flex items-center justify-between pb-2 border-b border-border">
        <h3 className="m-0 text-sm font-semibold">{t('apps.points')}</h3>
      </div>
      {data ? (
        <>
          <Card>
            <CardContent className="p-4 flex flex-col items-center gap-1 text-center">
              <div className="text-xs text-muted-foreground">{t('page.points.balance')}</div>
              <div className="text-[26px] font-semibold tabular-nums">⭐ {fmt(data.balance)}</div>
              {data.todaySignedIn ? (
                <button
                  type="button"
                  disabled
                  className="mt-1 px-3 py-1 text-xs rounded-md border border-border bg-muted/50 text-muted-foreground cursor-not-allowed"
                >
                  ✓ {t('page.points.todaySigned')}
                </button>
              ) : (
                <button
                  type="button"
                  onClick={onSignIn}
                  className="mt-1 px-3 py-1 text-xs rounded-md border border-border bg-card text-foreground cursor-pointer hover:bg-muted/50 transition-colors"
                >
                  {t('page.points.signIn')}
                </button>
              )}
            </CardContent>
          </Card>
          <div className="grid grid-cols-3 gap-2">
            <Card>
              <CardContent className="p-3 text-center">
                <div className="text-xs text-muted-foreground">{t('page.points.totalEarned')}</div>
                <div className="text-sm font-semibold tabular-nums mt-1">
                  {fmt(data.totalEarned)}
                </div>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="p-3 text-center">
                <div className="text-xs text-muted-foreground">{t('page.points.totalSpent')}</div>
                <div className="text-sm font-semibold tabular-nums mt-1">
                  {fmt(data.totalSpent)}
                </div>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="p-3 text-center">
                <div className="text-xs text-muted-foreground">{t('page.points.streak')}</div>
                <div className="text-sm font-semibold tabular-nums mt-1">
                  {fmt(data.continuousDays)}
                </div>
              </CardContent>
            </Card>
          </div>
        </>
      ) : null}
      <Card>
        <div className="px-4 pt-3 pb-2 text-xs text-muted-foreground font-semibold">
          {t('page.points.earnTitle')}
        </div>
        <CardContent className="p-4 pt-1 flex flex-col gap-1.5 text-sm">
          <div className="flex items-center gap-2">
            <span aria-hidden>🎁</span> {t('page.points.earn1')}
          </div>
          <div className="flex items-center gap-2">
            <span aria-hidden>📚</span> {t('page.points.earn2')}
          </div>
          <div className="flex items-center gap-2">
            <span aria-hidden>💬</span> {t('page.points.earn3')}
          </div>
          <div className="flex items-center gap-2">
            <span aria-hidden>🎉</span> {t('page.points.earn4')}
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
