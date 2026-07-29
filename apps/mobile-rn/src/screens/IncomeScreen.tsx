import { useCallback, useEffect, useState } from 'react'
import { useNavigation } from '@react-navigation/native'
import type { NativeStackNavigationProp } from '@react-navigation/native-stack'
import {
  getCommissionList,
  getDayMonthSummary,
  getOverview,
  type CommissionRecord,
} from '@ihui/api-client'
import { IncomeScreen as SharedIncomeScreen } from '@ihui/rn-app'
import type { IncomeCommissionItem, IncomeData } from '@ihui/types'
import { useI18n } from '../i18n'
import type { RootStackParamList } from '../navigation/RootNavigator'

type NavigationProp = NativeStackNavigationProp<RootStackParamList>

const INITIAL_DATA: IncomeData = {
  totalEarnings: 0,
  todayCommission: 0,
  balance: 0,
  list: [],
}

function mapRecord(r: CommissionRecord): IncomeCommissionItem {
  return {
    id: r.id,
    title: r.userNickname || r.orderId || '佣金收益',
    amount: r.commissionAmount,
    time: r.createdAt,
    settled: r.status === 'settled' || r.status === 'completed',
  }
}

export function IncomeScreen() {
  const { t } = useI18n()
  const navigation = useNavigation<NavigationProp>()
  const [data, setData] = useState<IncomeData>(INITIAL_DATA)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  const load = useCallback(async () => {
    setLoading(true)
    setError('')
    try {
      const [overviewRes, listRes, dayMonthRes] = await Promise.all([
        getOverview(),
        getCommissionList({ page: 1, pageSize: 50 }),
        getDayMonthSummary(),
      ])
      if (!overviewRes.success || !listRes.success || !dayMonthRes.success) {
        throw new Error('http')
      }
      setData({
        totalEarnings: overviewRes.data.totalCommission,
        todayCommission: dayMonthRes.data.day,
        balance: overviewRes.data.availableCommission,
        list: listRes.data.list.map(mapRecord),
      })
    } catch {
      setError(t('income.loadFailed'))
    } finally {
      setLoading(false)
    }
  }, [t])

  useEffect(() => {
    void load()
  }, [load])

  return (
    <SharedIncomeScreen
      t={t}
      data={data}
      loading={loading}
      error={error}
      onWithdraw={() => navigation.navigate('Withdraw' as never)}
      onBack={() => navigation.goBack()}
    />
  )
}

export default IncomeScreen
