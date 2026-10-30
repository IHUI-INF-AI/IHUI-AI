// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

import { useCallback, useEffect, useMemo, useState } from 'react'
import { useNavigation } from '@react-navigation/native'
import type { NativeStackNavigationProp } from '@react-navigation/native-stack'
import { getWithdrawalRecords, type WithdrawalItem } from '@ihui/api-client'
import {
  WithdrawRecordsScreen as SharedWithdrawRecordsScreen,
  type WithdrawRecordRowView,
} from '@ihui/rn-app'
import { useI18n } from '../i18n'
import { useAuth } from '../context/AuthContext'
import { useTheme } from '../context/ThemeContext'
import type { RootStackParamList } from '../navigation/RootNavigator'

type NavigationProp = NativeStackNavigationProp<RootStackParamList>

/** web 同值(apps/web/app/(main)/distribution/withdraw/records/page.tsx:48 PAGE_SIZE = 20) */
const PAGE_SIZE = 20

const NS = 'withdrawRecordsPage'

/** 与 web STATUS_KEY 同表(page.tsx:53-58);web distribution.withdrawStatus* 键缺失,文案取 admin.shop.withdrawals 同义键 */
const STATUS_LABEL_KEYS: Record<number, string> = {
  0: 'withdrawRecordsPage.withdrawStatusPending',
  1: 'withdrawRecordsPage.withdrawStatusProcessing',
  2: 'withdrawRecordsPage.withdrawStatusCompleted',
  3: 'withdrawRecordsPage.withdrawStatusFailed',
}

/** 与 web METHOD_KEY 同表(page.tsx:68-72) */
const METHOD_LABEL_KEYS: Record<string, string> = {
  wechat: 'withdrawRecordsPage.methodWechat',
  alipay: 'withdrawRecordsPage.methodAlipay',
  bank: 'withdrawRecordsPage.methodBank',
}

/**
 * RN 端「提现记录」薄壳 —— 承载 web /distribution/withdraw/records。渲染全部委托共享屏,本文件只管:
 * 取数 GET /api/finance/withdrawal/list(契约 apps/api/src/routes/finance.ts:288-293)、
 * 分页游标(触底续页)、时间 Intl 格式化(与 web 同参 locale + 年月日时分,created/processed 两列)、
 * 状态/方式文案注入、登录门(web useAuthGate 同口径,未登录不发注定 401 的查询)。
 * 口径差:web 七列表格 + 上一页/下一页在 RN 改为卡片行 + 下拉刷新 + 触底续页(同端点同参数);
 * web 底部「提现」入口按钮在 RN 端无对应提现表单屏路由,本屏不渲染该按钮(避免死按钮),如实登记。
 */
export function WithdrawRecordsScreen() {
  const navigation = useNavigation<NavigationProp>()
  const { t, locale } = useI18n()
  const { resolvedTheme } = useTheme()
  const { user } = useAuth()

  const [rows, setRows] = useState<WithdrawRecordRowView[]>([])
  const [total, setTotal] = useState(0)
  const [page, setPage] = useState(1)
  const [loading, setLoading] = useState(false)
  const [loadingMore, setLoadingMore] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const dateFmt = useMemo(
    () =>
      new Intl.DateTimeFormat(locale, {
        year: 'numeric',
        month: '2-digit',
        day: '2-digit',
        hour: '2-digit',
        minute: '2-digit',
      }),
    [locale],
  )

  const fmtDate = useCallback(
    (value: string | null): string => {
      if (!value) return '-'
      const d = new Date(value)
      return Number.isNaN(d.getTime()) ? '-' : dateFmt.format(d)
    },
    [dateFmt],
  )

  const toRow = useCallback(
    (item: WithdrawalItem): WithdrawRecordRowView => ({
      id: item.id,
      originalCents: item.originalAmount,
      actualCents: item.amount,
      feeCents: item.fee,
      methodText: t(METHOD_LABEL_KEYS[item.method] ?? 'withdrawRecordsPage.methodWechat'),
      status: item.status,
      statusText: t(STATUS_LABEL_KEYS[item.status] ?? 'withdrawRecordsPage.withdrawStatusPending'),
      timeText: fmtDate(item.createdAt),
      processedText: fmtDate(item.processedAt),
    }),
    [fmtDate, t],
  )

  const load = useCallback(
    async (nextPage: number, append: boolean) => {
      if (!user) return
      if (append) setLoadingMore(true)
      else setLoading(true)
      try {
        const res = await getWithdrawalRecords({ page: nextPage, limit: PAGE_SIZE })
        if (!res.success || !res.data) {
          setError(res.error ?? t(`${NS}.error`))
          return
        }
        setError(null)
        const items = res.data.items ?? []
        setTotal(res.data.total ?? 0)
        setRows((prev) => (append ? [...prev, ...items.map(toRow)] : items.map(toRow)))
        setPage(nextPage)
      } catch {
        setError(t(`${NS}.error`))
      } finally {
        setLoading(false)
        setLoadingMore(false)
      }
    },
    [user, toRow, t],
  )

  useEffect(() => {
    void load(1, false)
  }, [load])

  const hasMore = rows.length < total

  return (
    <SharedWithdrawRecordsScreen
      t={t}
      colorScheme={resolvedTheme}
      onBack={() => navigation.goBack()}
      loginRequiredText={user ? '' : t(`${NS}.loginRequired`)}
      loading={loading}
      error={error}
      rows={rows}
      total={total}
      loadingMore={loadingMore}
      hasMore={hasMore}
      onEndReached={() => {
        if (!loading && !loadingMore && hasMore) void load(page + 1, true)
      }}
      onRefresh={() => void load(1, false)}
    />
  )
}
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
