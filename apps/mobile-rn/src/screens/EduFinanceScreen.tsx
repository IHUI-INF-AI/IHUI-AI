// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * 财务缴费记录页(mobile-rn 端)—— 薄壳,复用通用控制台列表屏 ConsoleTableScreen
 * (覆盖 web edu/edu-management/finance 的缴费记录实体,复合页首版)。
 * 端点(与 web finance/page.tsx 同源):
 *  - GET /api/edu-ai-management/payment-record[?classId&status] ⇒ { list: PaymentRecord[], legacy? }
 * 首版承载缴费流水列表;费用期次生成/学费标准/催缴/无归属流水排后续轮。
 */
import { useCallback, useEffect, useState } from 'react'
import { useNavigation, type NavigationProp } from '@react-navigation/native'
import { fetchApi } from '@ihui/api-client'
import { ConsoleTableScreen, type ConsoleColumn, type ConsoleRowView } from '@ihui/rn-app'
import { useI18n } from '../i18n'
import { useTheme } from '../context/ThemeContext'
import type { RootStackParamList } from '../navigation/RootNavigator'

interface PaymentRecord {
  id: string
  studentName: string
  className: string
  feeName: string
  amount: number
  paymentDate: string
  paymentMethod: string
  status: string
}

export function EduFinanceScreen() {
  const { t, locale } = useI18n()
  const { resolvedTheme } = useTheme()
  const navigation = useNavigation<NavigationProp<RootStackParamList>>()
  const [rows, setRows] = useState<ConsoleRowView[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const fmtDate = useCallback(
    (iso: string) => {
      if (!iso) return ''
      const d = new Date(iso)
      if (Number.isNaN(d.getTime())) return ''
      return new Intl.DateTimeFormat(locale, {
        year: 'numeric',
        month: '2-digit',
        day: '2-digit',
      }).format(d)
    },
    [locale],
  )

  const statusLabel = useCallback(
    (s: string) => {
      const v = t(`eduFinance.status.${s}`)
      return v === `eduFinance.status.${s}` ? s : v
    },
    [t],
  )

  const load = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const res = await fetchApi<{ list: PaymentRecord[] }>('/api/edu-ai-management/payment-record')
      if (!res.success) throw new Error(res.error || 'load failed')
      setRows(
        (res.data?.list ?? []).map((r) => ({
          id: r.id,
          cells: {
            student: r.studentName,
            className: r.className,
            fee: r.feeName,
            amount: (r.amount / 100).toFixed(2),
            date: fmtDate(r.paymentDate),
            method: r.paymentMethod,
            status: statusLabel(r.status),
          },
          badgeTone:
            r.status === 'paid' || r.status === 'success'
              ? 'ok'
              : r.status === 'refunded'
                ? 'muted'
                : 'warn',
        })),
      )
    } catch (e) {
      setError(e instanceof Error ? e.message : 'load failed')
    } finally {
      setLoading(false)
    }
  }, [fmtDate, statusLabel])

  useEffect(() => {
    void load()
  }, [load])

  const columns: ConsoleColumn[] = [
    { key: 'student', title: t('eduFinance.student'), flex: 2 },
    { key: 'className', title: t('eduFinance.className') },
    { key: 'fee', title: t('eduFinance.fee'), flex: 2 },
    { key: 'amount', title: t('eduFinance.amount'), render: 'badge' },
    { key: 'date', title: t('eduFinance.date') },
    { key: 'status', title: t('eduParent.statusTitle') },
  ]

  return (
    <ConsoleTableScreen
      t={t}
      colorScheme={resolvedTheme}
      onBack={() => navigation.goBack()}
      title={t('eduFinance.title')}
      columns={columns}
      rows={rows}
      loading={loading}
      error={error}
      onRetry={() => void load()}
      onRefresh={() => void load()}
    />
  )
}

export default EduFinanceScreen
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
