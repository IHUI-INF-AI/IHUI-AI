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
  }, [])

  if (loading) return <div className="empty-state">{t('common.loading')}</div>
  if (error) return <div className="error-banner">{error}</div>
  if (!balance) return null

  return (
    <div className="sp-page">
      <div className="sp-page-header">
        <h3>{t('wallet.title')}</h3>
      </div>
      <Card>
        <CardHeader>
          <CardTitle>{t('wallet.balance')}</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="sp-balance">¥ {fmt(balance.balance)}</div>
        </CardContent>
      </Card>
      <Card>
        <CardHeader>
          <CardTitle>{t('wallet.totalRecharge')}</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="sp-balance muted">¥ {fmt(balance.totalRecharge)}</div>
        </CardContent>
      </Card>
    </div>
  )
}
