/**
 * DistributionPage — 分销中心(2026-07-25 立)。
 *
 * 数据源:getOverview() + getCommissionList()(distribution.ts)。
 * 顶部:佣金概览(总佣金/可提现/已提现)+ 邀请数据 + 提现按钮;下方:佣金记录列表。
 */
import { useEffect, useState } from 'react'
import {
  getOverview,
  getCommissionList,
  type CommissionOverview,
  type CommissionRecord,
} from '@ihui/api-client'
import { Card, CardContent, Badge } from '@ihui/ui-react'
import { useI18n } from '../../../src/i18n'
import { fmtDateOnly as fmtDate } from '../../../lib/date-utils'

const WEB_BASE = 'https://ihui.ai'

function fmtMoney(n: number | undefined): string {
  if (typeof n !== 'number') return '0.00'
  return n.toLocaleString('zh-CN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
}

export default function DistributionPage() {
  const { t } = useI18n()
  const [overview, setOverview] = useState<CommissionOverview | null>(null)
  const [records, setRecords] = useState<CommissionRecord[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  const load = async () => {
    setLoading(true)
    setError('')
    try {
      const [ovRes, recRes] = await Promise.all([
        getOverview(),
        getCommissionList({ page: 1, pageSize: 20 }),
      ])
      if (ovRes.success) setOverview(ovRes.data)
      if (recRes.success) setRecords(recRes.data.list)
      if (!ovRes.success && !recRes.success) {
        setError(ovRes.error || recRes.error || t('common.failed'))
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
      <div className="m-2 flex flex-col items-center gap-2">
        <div className="bg-destructive/10 text-destructive px-2.5 py-2 rounded-md border border-destructive text-xs text-center">
          {error}
        </div>
        <button
          type="button"
          onClick={() => void load()}
          className="px-3 py-1.5 text-xs rounded-md border border-border bg-card text-foreground cursor-pointer hover:bg-muted/50 transition-colors"
        >
          {t('common.retry')}
        </button>
      </div>
    )
  }

  return (
    <div className="p-3 md:p-4 flex flex-col gap-2.5">
      <div className="flex items-center justify-between pb-2 border-b border-border">
        <h3 className="m-0 text-sm font-semibold">{t('apps.distribution')}</h3>
      </div>
      {overview ? (
        <Card className="border-primary/40">
          <CardContent className="p-3">
            <div className="grid grid-cols-3 gap-2 text-center">
              <div>
                <div className="text-base font-semibold tabular-nums">
                  ¥{fmtMoney(overview.totalCommission)}
                </div>
                <div className="text-[11px] text-muted-foreground mt-0.5">总佣金</div>
              </div>
              <div>
                <div className="text-base font-semibold tabular-nums text-primary">
                  ¥{fmtMoney(overview.availableCommission)}
                </div>
                <div className="text-[11px] text-muted-foreground mt-0.5">可提现</div>
              </div>
              <div>
                <div className="text-base font-semibold tabular-nums">
                  ¥{fmtMoney(overview.withdrawnCommission)}
                </div>
                <div className="text-[11px] text-muted-foreground mt-0.5">已提现</div>
              </div>
            </div>
            <div className="mt-2 pt-2 border-t border-border flex items-center justify-between text-xs">
              <span className="text-muted-foreground">
                邀请 {overview.invitedCount} 人 · 活跃 {overview.activeCount} 人
              </span>
              <button
                type="button"
                onClick={() =>
                  void chrome.tabs.create({ url: `${WEB_BASE}/distribution/withdraw` })
                }
                className="px-2.5 py-1 text-xs rounded-md bg-primary text-primary-foreground cursor-pointer hover:bg-primary/90 transition-colors"
              >
                提现
              </button>
            </div>
          </CardContent>
        </Card>
      ) : null}
      <div className="text-xs text-muted-foreground px-1 pt-1">佣金记录</div>
      {records.length === 0 ? (
        <div className="text-center text-muted-foreground py-6 px-4 text-sm">
          {t('common.empty')}
        </div>
      ) : (
        records.map((r) => (
          <Card key={r.id} className="rounded-md border-border shadow-none">
            <CardContent className="p-3 flex items-center justify-between">
              <div className="min-w-0">
                <div className="text-sm truncate">{r.userNickname}</div>
                <div className="text-[11px] text-muted-foreground mt-0.5">
                  {fmtDate(r.createdAt)}
                </div>
              </div>
              <div className="text-right shrink-0">
                <div className="text-sm font-semibold tabular-nums text-primary">
                  +¥{fmtMoney(r.commissionAmount)}
                </div>
                <Badge variant="secondary">{r.status}</Badge>
              </div>
            </CardContent>
          </Card>
        ))
      )}
    </div>
  )
}
