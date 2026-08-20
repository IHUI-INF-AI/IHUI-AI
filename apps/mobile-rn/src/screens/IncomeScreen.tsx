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
  pendingCommission: 0,
  withdrawnCommission: 0,
  list: [],
}

/** 本地日期 YYYY-MM-DD(与后端 daySummary.dateStr 对齐;时区差异下未命中则当日按 0) */
function todayKey(): string {
  const d = new Date()
  const m = String(d.getMonth() + 1).padStart(2, '0')
  const day = String(d.getDate()).padStart(2, '0')
  return `${d.getFullYear()}-${m}-${day}`
}

function mapRecord(r: CommissionRecord): IncomeCommissionItem {
  // 后端 /distribution/list 返回 commission_flows 原始行:status 数字 0=invalid 1=active,
  // amount 单位「分」。数据模型无「待结算/已结算」独立状态:
  // status=1(active)=佣金生效中,展示为「待结算」;status=0(invalid)=佣金无效,映射「取消结算」;
  // 「已结算」需关联提现记录,与佣金行无字段关联,无数据源 → settled 恒 false。
  const status = String(r.status ?? '')
  return {
    id: r.id,
    title: r.userNickname || r.orderId || '佣金收益',
    amount: (r.amount ?? r.commissionAmount ?? 0) / 100,
    time: r.createdAt,
    settled: false,
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
        todayCommission:
          dayMonthRes.data.daySummary.find((s) => s.dateStr === todayKey())?.amount ?? 0,
        balance: overviewRes.data.availableCommission,
        pendingCommission: overviewRes.data.pendingCommission,
        withdrawnCommission: overviewRes.data.withdrawnCommission,
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
