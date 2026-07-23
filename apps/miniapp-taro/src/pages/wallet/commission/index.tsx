import { View, Text, Button } from '@tarojs/components'
import Taro, { useReachBottom } from '@tarojs/taro'
import { useState, useRef, useEffect } from 'react'
import { getDistributionInfo, getCommissionRecords } from '@/api'
import { useI18n } from '@/i18n'
import './index.css'

interface CommissionRecord {
  id: string
  amount: number
  type: string
  time: string
  nickname?: string
}

const PAGE_SIZE = 20

function sumToday(items: CommissionRecord[]): number {
  const today = new Date().toDateString()
  let sum = 0
  for (const r of items) {
    const d = new Date(r.time)
    if (!isNaN(d.getTime()) && d.toDateString() === today && r.amount > 0) {
      sum += r.amount
    }
  }
  return sum
}

export default function CommissionPage() {
  const { t } = useI18n()
  const [list, setList] = useState<CommissionRecord[]>([])
  const [loading, setLoading] = useState(false)
  const [totalCommission, setTotalCommission] = useState(0)
  const [available, setAvailable] = useState(0)
  const [todayCommission, setTodayCommission] = useState(0)
  const pageRef = useRef(1)
  const hasMoreRef = useRef(true)
  const loadingRef = useRef(false)

  const loadSummary = async () => {
    try {
      const info = await getDistributionInfo()
      setTotalCommission(info.totalCommission)
      setAvailable(info.available)
    } catch {
      // ignore
    }
  }

  const load = async (reset = false) => {
    if (loadingRef.current) return
    if (reset) {
      pageRef.current = 1
      hasMoreRef.current = true
      setList([])
    }
    if (!hasMoreRef.current) return
    loadingRef.current = true
    setLoading(true)
    try {
      const res = await getCommissionRecords({ page: pageRef.current, pageSize: PAGE_SIZE })
      const items = (res.list || []) as CommissionRecord[]
      setList((prev) => (reset ? items : [...prev, ...items]))
      setTodayCommission((prev) => (reset ? sumToday(items) : prev + sumToday(items)))
      hasMoreRef.current = pageRef.current * PAGE_SIZE < res.total
      pageRef.current++
    } catch {
      // ignore
    } finally {
      loadingRef.current = false
      setLoading(false)
    }
  }

  useEffect(() => {
    loadSummary()
    load(true)
  }, [])

  useReachBottom(() => {
    load()
  })

  const goWithdraw = () => {
    Taro.navigateTo({ url: '/pages/wallet/withdrawal/index' })
  }

  return (
    <View className="wc-page">
      <View className="wc-stats">
        <View className="wc-stat-item">
          <Text className="wc-stat-label">{t('wallet.commission.today')}</Text>
          <Text className="wc-stat-value">¥{todayCommission}</Text>
        </View>
        <View className="wc-stat-item">
          <Text className="wc-stat-label">{t('distribution.commission.total')}</Text>
          <Text className="wc-stat-value">¥{totalCommission}</Text>
        </View>
        <View className="wc-stat-item">
          <Text className="wc-stat-label">{t('wallet.commission.available')}</Text>
          <Text className="wc-stat-value">¥{available}</Text>
        </View>
      </View>

      <View className="wc-list-section">
        <Text className="wc-list-title">{t('wallet.commission.records')}</Text>
        {list.length > 0 && (
          <View className="wc-list">
            {list.map((r) => (
              <View key={r.id} className="wc-item">
                <View className="wc-item-info">
                  <Text className="wc-item-type">{r.type}</Text>
                  <Text className="wc-item-time">
                    {r.time}
                    {r.nickname ? ` · ${r.nickname}` : ''}
                  </Text>
                </View>
                <Text className={`wc-item-amount ${r.amount > 0 ? 'positive' : 'negative'}`}>
                  {r.amount > 0 ? '+' : ''}¥{r.amount}
                </Text>
              </View>
            ))}
          </View>
        )}
        {list.length === 0 && !loading && (
          <Text className="wc-empty">{t('distribution.commission.empty')}</Text>
        )}
        {loading && (
          <Text className="wc-loading">{t('distribution.commission.loading')}</Text>
        )}
      </View>

      <Button className="wc-withdraw-btn" onClick={goWithdraw}>
        {t('developer.income.withdraw')}
      </Button>
    </View>
  )
}
