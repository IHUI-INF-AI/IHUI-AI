// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * 孩子账单页(mobile-rn 端)—— 薄壳,复用通用控制台列表屏 ConsoleTableScreen
 * (children 子页批 #3 收口件,覆盖 web edu/parent/children/[childId]/bills)。
 * 端点(与 web edu/parent/page.tsx 同源):
 *  - GET /api/edu-ai-management/parent/children/:childId/bills ⇒ { bills: BillItem[] }
 * 首版承载顶层字段(班级/学期/总额/欠费徽章/已付/下次到期);分期 schedules 排后续轮。
 */
import { useCallback, useEffect, useState } from 'react'
import {
  useNavigation,
  useRoute,
  type NavigationProp,
  type RouteProp,
} from '@react-navigation/native'
import { fetchApi } from '@ihui/api-client'
import { ConsoleTableScreen, type ConsoleColumn, type ConsoleRowView } from '@ihui/rn-app'
import { useI18n } from '../i18n'
import { useTheme } from '../context/ThemeContext'
import type { RootStackParamList } from '../navigation/RootNavigator'

interface BillItem {
  enrollmentId: string
  className: string
  termName: string
  status: string
  totalFee: number
  ledger: {
    arrears: number
    paidAmount: number
    nextDueDate: string | null
    overdueCount: number
    dueSoonCount: number
  }
}

function EduChildBillsScreen() {
  const { t, locale } = useI18n()
  const { resolvedTheme } = useTheme()
  const navigation = useNavigation<NavigationProp<RootStackParamList>>()
  const route = useRoute<RouteProp<RootStackParamList, 'EduChildBills'>>()
  const childId = route.params?.childId ?? ''
  const [rows, setRows] = useState<ConsoleRowView[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const fmtDate = useCallback(
    (iso: string | null) => {
      if (!iso) return '—'
      const d = new Date(iso)
      if (Number.isNaN(d.getTime())) return '—'
      return new Intl.DateTimeFormat(locale, {
        year: 'numeric',
        month: '2-digit',
        day: '2-digit',
      }).format(d)
    },
    [locale],
  )

  const load = useCallback(async () => {
    if (!childId) return
    setLoading(true)
    setError(null)
    try {
      const res = await fetchApi<{ bills: BillItem[] }>(
        `/api/edu-ai-management/parent/children/${childId}/bills`,
      )
      if (!res.success) throw new Error(res.error || 'load failed')
      setRows(
        (res.data?.bills ?? []).map((b) => ({
          id: b.enrollmentId,
          cells: {
            className: b.className,
            term: b.termName,
            // 金额单位 = **整数元**(schema edu-ai-management 第 859 行:与
            // eduEnrollment.totalFee / eduPaymentRecord.amount 一致),不是分 ——
            // 这里再除 100 会把 ¥1000 显示成 ¥10.00(同族 100 倍事故,门 248)。
            total: `¥${b.totalFee}`,
            paid: `¥${b.ledger.paidAmount}`,
            arrears: `¥${b.ledger.arrears}`,
            nextDue: fmtDate(b.ledger.nextDueDate),
          },
          badgeTone: b.ledger.overdueCount > 0 ? 'danger' : b.ledger.arrears > 0 ? 'warn' : 'ok',
        })),
      )
    } catch (e) {
      setError(e instanceof Error ? e.message : 'load failed')
    } finally {
      setLoading(false)
    }
  }, [childId, fmtDate])

  useEffect(() => {
    void load()
  }, [load])

  const columns: ConsoleColumn[] = [
    { key: 'className', title: t('eduChildBills.className'), flex: 2 },
    { key: 'term', title: t('eduChildBills.term') },
    { key: 'total', title: t('eduChildBills.total'), render: 'badge' },
    { key: 'paid', title: t('eduChildBills.paid') },
    { key: 'arrears', title: t('eduChildBills.arrears') },
    { key: 'nextDue', title: t('eduChildBills.nextDue') },
  ]

  return (
    <ConsoleTableScreen
      t={t}
      colorScheme={resolvedTheme}
      onBack={() => navigation.goBack()}
      title={t('eduChildBills.title')}
      columns={columns}
      rows={rows}
      loading={loading}
      error={error}
      onRetry={() => void load()}
      onRefresh={() => void load()}
    />
  )
}

export default EduChildBillsScreen
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
