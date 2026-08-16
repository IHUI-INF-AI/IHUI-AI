import { useCallback, useEffect, useState } from 'react'
import { useNavigation } from '@react-navigation/native'
import type { NativeStackNavigationProp } from '@react-navigation/native-stack'
import {
  getOverview,
  getCommissionList,
  getDayMonthSummary,
  type CommissionOverview,
  type CommissionRecord,
  type DayMonthSummary,
} from '@ihui/api-client'
import {
  ModelIncomeScreen as SharedModelIncomeScreen,
  type ModelIncomeItem,
  type ModelIncomeSummary,
  type ModelIncomeTab,
} from '@ihui/rn-app'
import { formatDateByTemplate } from '../utils/date-utils'
import { useI18n } from '../i18n'
import type { RootStackParamList } from '../navigation/RootNavigator'

type NavigationProp = NativeStackNavigationProp<RootStackParamList>

export default function ModelIncomeScreen() {
  const { t } = useI18n()
  const navigation = useNavigation<NavigationProp>()
  const [tab, setTab] = useState<ModelIncomeTab>('all')
  const [showWithdraw, setShowWithdraw] = useState(false)
  const [overview, setOverview] = useState<CommissionOverview | null>(null)
  const [dayMonth, setDayMonth] = useState<DayMonthSummary | null>(null)
  const [records, setRecords] = useState<ModelIncomeItem[]>([])
  const [loading, setLoading] = useState(true)
  const [refreshing, setRefreshing] = useState(false)
  const [error, setError] = useState('')

  const load = useCallback(async () => {
    setError('')
    try {
      const [overviewRes, listRes, dayMonthRes] = await Promise.all([
        getOverview(),
        getCommissionList({ page: 1, pageSize: 50 }),
        getDayMonthSummary(),
      ])
      let errMsg = ''
      if (overviewRes.success) setOverview(overviewRes.data)
      else errMsg = overviewRes.error || t('modelIncome.loadOverviewFailed')
      if (listRes.success) {
        const items: ModelIncomeItem[] = (listRes.data.list as CommissionRecord[]).map((r) => ({
          id: r.id,
          orderId: r.orderId,
          status: r.status,
          createdAt: formatDateByTemplate(r.createdAt, 'YYYY-MM-DD HH:mm'),
          userNickname: r.userNickname,
          orderAmount: r.orderAmount,
          rate: r.rate,
          commissionAmount: r.commissionAmount,
        }))
        setRecords(items)
      } else {
        errMsg = errMsg || listRes.error || t('modelIncome.loadListFailed')
      }
      if (dayMonthRes.success) setDayMonth(dayMonthRes.data)
      if (errMsg) setError(errMsg)
    } catch {
      setError(t('modelIncome.networkError'))
    } finally {
      setLoading(false)
      setRefreshing(false)
    }
  }, [t])

  useEffect(() => {
    void load()
  }, [load])

  const summary: ModelIncomeSummary | null =
    overview || dayMonth
      ? {
          totalCommission: overview?.totalCommission ?? 0,
          availableCommission: overview?.availableCommission ?? 0,
          withdrawnCommission: overview?.withdrawnCommission ?? 0,
          pendingCommission: overview?.pendingCommission ?? 0,
          day: dayMonth?.day ?? 0,
        }
      : null

  return (
    <SharedModelIncomeScreen
      t={t}
      items={records}
      summary={summary}
      loading={loading}
      refreshing={refreshing}
      error={error}
      activeTab={tab}
      onSelectTab={setTab}
      onRefresh={() => {
        setRefreshing(true)
        void load()
      }}
      showWithdrawModal={showWithdraw}
      onOpenWithdraw={() => setShowWithdraw(true)}
      onCloseWithdraw={() => setShowWithdraw(false)}
      onConfirmWithdraw={() => setShowWithdraw(false)}
      onBack={() => navigation.goBack()}
    />
  )
}
