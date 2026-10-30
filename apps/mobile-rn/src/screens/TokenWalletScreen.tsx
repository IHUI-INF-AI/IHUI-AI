// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

import { useCallback, useEffect, useMemo, useState } from 'react'
import { useNavigation } from '@react-navigation/native'
import type { NativeStackNavigationProp } from '@react-navigation/native-stack'
import { getMarginBalance, getMarginFlows, type TokenFlowItem } from '@ihui/api-client'
import {
  TokenWalletScreen as SharedTokenWalletScreen,
  type TokenFlowRowView,
} from '@ihui/rn-app'
import { useI18n } from '../i18n'
import { useAuth } from '../context/AuthContext'
import { useTheme } from '../context/ThemeContext'
import type { RootStackParamList } from '../navigation/RootNavigator'

type NavigationProp = NativeStackNavigationProp<RootStackParamList>

/** web 同值(apps/web/app/(main)/distribution/token/page.tsx:55 PAGE_SIZE = 20) */
const PAGE_SIZE = 20

const NS = 'tokenWalletPage'

/** opType → 本页 ns 下的 i18n 键(web OP_TYPE_KEY 同表 apps/web/app/(main)/distribution/token/page.tsx:56-60) */
const OP_TYPE_KEY: Record<number, string> = {
  0: 'flowRecharge',
  1: 'flowDeduct',
  2: 'flowExpire',
}

/**
 * RN 端「代币钱包」薄壳 —— 承载 web /distribution/token。渲染全部委托共享屏,本文件只管:
 * 取数 GET /api/finance/margin/balance + GET /api/finance/margin/flows
 * (契约 apps/api/src/routes/finance.ts:40-45 / 139-153)、opType 筛选(web 同取值集 all/0/1/2)、
 * 分页游标(触底续页)、时间 Intl 格式化(与 web 同参 locale + 年月日时分)、opType 文案注入、
 * 登录门(web useAuthGate 同口径,未登录不发注定 401 的查询)。
 * 口径差:web 上一页/下一页按钮在 RN 改为下拉刷新 + 触底续页(同端点同参数),如实登记不谎称同款。
 */
export function TokenWalletScreen() {
  const navigation = useNavigation<NavigationProp>()
  const { t, locale } = useI18n()
  const { resolvedTheme } = useTheme()
  const { user } = useAuth()

  const [balance, setBalance] = useState(0)
  const [rows, setRows] = useState<TokenFlowRowView[]>([])
  const [total, setTotal] = useState(0)
  const [page, setPage] = useState(1)
  const [opTypeValue, setOpTypeValue] = useState('all')
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
    (item: TokenFlowItem): TokenFlowRowView => ({
      id: item.id,
      typeText: t(`${NS}.${OP_TYPE_KEY[item.opType] ?? 'flowRecharge'}`),
      quantity: item.quantity,
      positive: item.opType === 0,
      balanceAfter: item.balanceAfter,
      timeText: fmtDate(item.createdAt),
      remarkText: item.remark ?? '-',
    }),
    [fmtDate, t],
  )

  const loadFlows = useCallback(
    async (nextPage: number, append: boolean) => {
      if (!user) return
      if (append) setLoadingMore(true)
      else setLoading(true)
      try {
        const res = await getMarginFlows({
          page: nextPage,
          limit: PAGE_SIZE,
          opType: opTypeValue === 'all' ? undefined : Number(opTypeValue),
        })
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
    [user, opTypeValue, toRow, t],
  )

  const loadBalance = useCallback(async () => {
    if (!user) return
    try {
      const res = await getMarginBalance()
      if (res.success && res.data) setBalance(res.data.balance ?? 0)
    } catch {
      /* 余额读取失败不阻塞流水展示,与 web 两查询独立同口径 */
    }
  }, [user])

  useEffect(() => {
    void loadFlows(1, false)
  }, [loadFlows])

  useEffect(() => {
    void loadBalance()
  }, [loadBalance])

  const hasMore = rows.length < total

  return (
    <SharedTokenWalletScreen
      t={t}
      colorScheme={resolvedTheme}
      onBack={() => navigation.goBack()}
      loginRequiredText={user ? '' : t(`${NS}.loginRequired`)}
      loading={loading}
      error={error}
      balance={balance}
      rows={rows}
      total={total}
      opTypeValue={opTypeValue}
      onOpTypeChange={setOpTypeValue}
      loadingMore={loadingMore}
      hasMore={hasMore}
      onEndReached={() => {
        if (!loading && !loadingMore && hasMore) void loadFlows(page + 1, true)
      }}
      onRefresh={() => {
        void loadFlows(1, false)
        void loadBalance()
      }}
    />
  )
}
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
