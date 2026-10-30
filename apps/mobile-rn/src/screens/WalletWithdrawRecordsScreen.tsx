// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

import { useCallback, useEffect, useMemo, useState } from 'react'
import { useNavigation } from '@react-navigation/native'
import type { NativeStackNavigationProp } from '@react-navigation/native-stack'
import {
  getWalletWithdrawalAvailable,
  getWalletWithdrawalRecords,
  getWalletWithdrawalSummary,
  type WalletWithdrawalItem,
} from '@ihui/api-client'
import {
  WalletWithdrawRecordsScreen as SharedWalletWithdrawRecordsScreen,
  type WalletWithdrawRecordRowView,
} from '@ihui/rn-app'
import { useI18n } from '../i18n'
import { useAuth } from '../context/AuthContext'
import { useTheme } from '../context/ThemeContext'
import type { RootStackParamList } from '../navigation/RootNavigator'

type NavigationProp = NativeStackNavigationProp<RootStackParamList>

/** web 同值（apps/web/app/(main)/wallet/withdraw/records/page.tsx:53 PAGE_SIZE = 20） */
const PAGE_SIZE = 20

const NS = 'walletWithdrawRecordsPage'

/**
 * 状态文案映射（后端 status 0=待审核 1=处理中 2=已完成 3=失败，
 * apps/api/src/db/commission-queries.ts:529-544 + packages/database/src/schema/commission.ts:63）。
 * web 页引用 wallet.statusPending/statusProcessing/statusCompleted/statusFailed 四键，
 * 该命名空间在 packages/i18n/messages/web/*.json 全五语缺失（web 侧渲染裸键），
 * 故值取 admin.shop.withdrawals.status.{pending,completed,failed} 与
 * admin.shop.withdrawals.flowStatus.processing 的逐字值，登记在 manifest i18n 块。
 */
const STATUS_LABEL_KEYS: Record<number, string> = {
  0: 'walletWithdrawRecordsPage.statusPending',
  1: 'walletWithdrawRecordsPage.statusProcessing',
  2: 'walletWithdrawRecordsPage.statusCompleted',
  3: 'walletWithdrawRecordsPage.statusFailed',
}

/**
 * 提现方式文案映射（后端 method = wechat | alipay | bank）。
 * web 页引用 wallet.methodWechat/methodAlipay/methodBank，该命名空间 ja 值残缺
 * （"微信"/"い"/"カード"，仓库既有串码），故值取 admin.shop.withdrawals.channel.* 的逐字值。
 */
const METHOD_LABEL_KEYS: Record<string, string> = {
  wechat: 'walletWithdrawRecordsPage.methodWechat',
  alipay: 'walletWithdrawRecordsPage.methodAlipay',
  bank: 'walletWithdrawRecordsPage.methodBank',
}

/**
 * RN 端「钱包提现记录」薄壳 —— 承载 web /wallet/withdraw/records。渲染全部委托共享屏，本文件只管:
 * 取数 GET /api/finance/withdrawal/list（契约 apps/api/src/routes/finance.ts:288-294）
 * + GET /api/finance/withdrawal/summary（finance.ts:296-301）
 * + GET /api/finance/withdrawal/available（finance.ts:303-308）、
 * 分页游标（触底续页）、时间 Intl 格式化（与 web 同参 locale + 年月日时分）、
 * 状态/方式文案注入、登录门（web useAuthGate 同口径，未登录不发注定 401 的查询）。
 *
 * 口径差（如实登记，详见 manifest ledger）：
 *  - web 统计卡读 summary 的 {total, processing, completed}，后端真实信封是
 *    {totalWithdrawn, pendingAmount}（apps/api/src/db/commission-queries.ts:643-656），
 *    「可提现金额」在后端另有独立端点 /api/finance/withdrawal/available，
 *    故三卡分别接 available / pendingAmount / totalWithdrawn。
 *  - web 表格在 RN 落为卡片行 + 下拉刷新 + 触底续页（同端点同参数 page/limit=20）。
 *  - web 行首列取 it.amount、第二列取 it.actualAmount（后端无此字段，实为 undefined），
 *    RN 改为「提现金额=originalAmount、实际到账=amount、手续费=fee」，
 *    三值均来自 withdrawal_flows 真实列（packages/database/src/schema/commission.ts:53-79）。
 *  - web 底部「返回钱包」按钮（/wallet）本屏以 navigate('Wallet') 接线（RootNavigator 已注册 Wallet 路由）。
 */
export function WalletWithdrawRecordsScreen() {
  const navigation = useNavigation<NavigationProp>()
  const { t, locale } = useI18n()
  const { resolvedTheme } = useTheme()
  const { user } = useAuth()

  const [rows, setRows] = useState<WalletWithdrawRecordRowView[]>([])
  const [total, setTotal] = useState(0)
  const [page, setPage] = useState(1)
  const [loading, setLoading] = useState(false)
  const [loadingMore, setLoadingMore] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [availableCents, setAvailableCents] = useState(0)
  const [processingCents, setProcessingCents] = useState(0)
  const [completedCents, setCompletedCents] = useState(0)
  const [statsLoading, setStatsLoading] = useState(false)

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
    (item: WalletWithdrawalItem): WalletWithdrawRecordRowView => ({
      id: item.id,
      originalCents: item.originalAmount,
      actualCents: item.amount,
      feeCents: item.fee,
      methodText: t(METHOD_LABEL_KEYS[item.method] ?? 'admin.shop.withdrawals.channel.wechat'),
      status: item.status,
      statusText: t(STATUS_LABEL_KEYS[item.status] ?? 'admin.shop.withdrawals.status.pending'),
      timeText: fmtDate(item.createdAt),
    }),
    [fmtDate, t],
  )

  const loadStats = useCallback(async () => {
    if (!user) return
    setStatsLoading(true)
    try {
      const [summaryRes, availableRes] = await Promise.all([
        getWalletWithdrawalSummary(),
        getWalletWithdrawalAvailable(),
      ])
      if (summaryRes.success && summaryRes.data) {
        setCompletedCents(summaryRes.data.totalWithdrawn ?? 0)
        setProcessingCents(summaryRes.data.pendingAmount ?? 0)
      }
      if (availableRes.success && availableRes.data) {
        setAvailableCents(availableRes.data.available ?? 0)
      }
    } catch {
      // 统计卡失败不阻断列表：保持 0 值渲染，不抛错态
    } finally {
      setStatsLoading(false)
    }
  }, [user])

  const load = useCallback(
    async (nextPage: number, append: boolean) => {
      if (!user) return
      if (append) setLoadingMore(true)
      else setLoading(true)
      try {
        const res = await getWalletWithdrawalRecords({ page: nextPage, limit: PAGE_SIZE })
        if (!res.success || !res.data) {
          setError(t('common.loadFailed'))
          return
        }
        setError(null)
        const items = res.data.items ?? []
        setTotal(res.data.total ?? 0)
        setRows((prev) => (append ? [...prev, ...items.map(toRow)] : items.map(toRow)))
        setPage(nextPage)
      } catch {
        setError(t('common.loadFailed'))
      } finally {
        setLoading(false)
        setLoadingMore(false)
      }
    },
    [user, toRow, t],
  )

  useEffect(() => {
    void load(1, false)
    void loadStats()
  }, [load, loadStats])

  const hasMore = rows.length < total

  return (
    <SharedWalletWithdrawRecordsScreen
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
      availableCents={availableCents}
      processingCents={processingCents}
      completedCents={completedCents}
      statsLoading={statsLoading}
      backToWalletText={t(`${NS}.backToWallet`)}
      onBackToWallet={() => navigation.navigate('Wallet')}
    />
  )
}
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
