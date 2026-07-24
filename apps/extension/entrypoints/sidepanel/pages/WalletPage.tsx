import { useEffect, useState } from 'react'
import { getBalance, type WalletBalance } from '@ihui/api-client'
import { Card, CardContent, CardHeader, CardTitle } from '@ihui/ui-react'
import { useI18n } from '../../../src/i18n'

function fmt(n: number | undefined): string {
  if (typeof n !== 'number') return '—'
  return n.toLocaleString('zh-CN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
}

export default function WalletPage() {
  const { t } = useI18n()
  const [balance, setBalance] = useState<WalletBalance | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  useEffect(() => {
    let cancelled = false
    void (async () => {
      setLoading(true)
      setError('')
      const res = await getBalance()
      if (cancelled) return
      if (res.success) {
        setBalance(res.data)
      } else {
        setError(res.error || t('wallet.loadFailed'))
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
  if (!balance) return null

  return (
    <div className="p-3 flex flex-col gap-2.5">
      <div className="flex items-center justify-between pb-2 border-b border-border">
        <h3 className="m-0 text-sm font-semibold">{t('wallet.title')}</h3>
      </div>
      <Card>
        <CardHeader>
          <CardTitle>{t('wallet.balance')}</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="text-[22px] font-semibold tabular-nums">¥ {fmt(balance.balance)}</div>
        </CardContent>
      </Card>
      <Card>
        <CardHeader>
          <CardTitle>{t('wallet.totalRecharge')}</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="text-[22px] font-semibold tabular-nums text-muted-foreground">
            ¥ {fmt(balance.totalRecharge)}
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
