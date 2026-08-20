import { useCallback, useEffect, useState } from 'react'
import { useNavigation } from '@react-navigation/native'
import type { NativeStackNavigationProp } from '@react-navigation/native-stack'
import Clipboard from '@react-native-clipboard/clipboard'
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
import { FloatBox } from '../components/FloatBox'

type NavigationProp = NativeStackNavigationProp<RootStackParamList>

const INITIAL_DATA: IncomeData = {
  totalEarnings: 0,
  todayCommission: 0,
  balance: 0,
  list: [],
}

function mapRecord(r: CommissionRecord): IncomeCommissionItem {
  // 后端 /distribution/list 返回 commission_flows.status(0=invalid 1=active,数字),
  // 兼容历史字符串状态('settled'/'completed'/'cancelled')。
  const status = r.status
  return {
    id: r.id,
    title: r.userNickname || r.orderId || '佣金收益',
    amount: r.commissionAmount,
    time: r.createdAt,
    settled: status === '1' || status === 'settled' || status === 'completed',
    // 关联订单号:复制按钮数据源(对齐 Uniapp copyOrderId 复制 order_id)
    orderId: r.orderId || '',
    cancelled: status === '0' || status === 'cancelled',
  }
}

export function IncomeScreen() {
  const { t } = useI18n()
  const navigation = useNavigation<NavigationProp>()
  const [data, setData] = useState<IncomeData>(INITIAL_DATA)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  // 复制成功提示(对齐 Uniapp uni.showToast「已复制订单号」,非阻塞 FloatBox)
  const [toastVisible, setToastVisible] = useState(false)
  const [toastMessage, setToastMessage] = useState('')

  const showToast = useCallback((message: string) => {
    setToastMessage(message)
    setToastVisible(true)
  }, [])

  const hideToast = useCallback(() => setToastVisible(false), [])

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

  // 复制订单号(对齐 Uniapp copyOrderId → uni.setClipboardData + showToast「已复制订单号」)
  const handleCopyOrder = useCallback(
    (orderId: string) => {
      Clipboard.setString(orderId)
      showToast(t('income.copySuccess'))
    },
    [showToast, t],
  )

  return (
    <>
      <SharedIncomeScreen
        t={t}
        data={data}
        loading={loading}
        error={error}
        onWithdraw={() => navigation.navigate('Withdraw' as never)}
        onBack={() => navigation.goBack()}
        onCopyOrder={handleCopyOrder}
      />
      <FloatBox visible={toastVisible} type="success" message={toastMessage} onHide={hideToast} />
    </>
  )
}

export default IncomeScreen
