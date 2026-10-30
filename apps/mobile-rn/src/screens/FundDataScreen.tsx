// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

import { useCallback, useEffect, useMemo, useState } from 'react'
import { useNavigation } from '@react-navigation/native'
import type { NativeStackNavigationProp } from '@react-navigation/native-stack'
import {
  getFundDataHistory,
  getFundDataList,
  type FundDataItem,
  type FundNetValueItem,
} from '@ihui/api-client'
import {
  FundDataScreen as SharedFundDataScreen,
  type FundDataRowView,
  type FundNetValueRowView,
} from '@ihui/rn-app'
import { useI18n } from '../i18n'
import { useAuth } from '../context/AuthContext'
import { useTheme } from '../context/ThemeContext'
import type { RootStackParamList } from '../navigation/RootNavigator'

type NavigationProp = NativeStackNavigationProp<RootStackParamList>

/** web 同值（apps/web/app/(main)/fund-data/page.tsx:83 pageSize=50） */
const LIST_PAGE_SIZE = 50
/** web 同值（apps/web/app/(main)/fund-data/page.tsx:92 history pageSize=100） */
const HISTORY_PAGE_SIZE = 100
/** web 同值（apps/web/app/(main)/fund-data/page.tsx:75-78 搜索防抖 300ms） */
const SEARCH_DEBOUNCE_MS = 300

const NS = 'fundDataPage'

/** 状态文案映射（后端只返回 status=1 的行，apps/api/src/db/fund-queries.ts:12） */
const STATUS_LABEL_KEYS: Record<number, string> = {
  1: 'fundDataPage.active',
}

/**
 * RN 端「基金数据」薄壳 —— 承载 web /fund-data。渲染全部委托共享屏，本文件只管:
 * 取数 GET /api/fund（契约 apps/api/src/routes/user/fund-routes.ts:146-153）
 * 与 GET /api/fund/:code/history（fund-routes.ts:163-174）、
 * 搜索防抖（web 同口径 300ms）、净值格式化（web 同口径 toFixed(4)）、
 * 状态文案注入、登录门（后端 /api/fund* 走 userAuthPreHandler 必须登录）。
 *
 * 口径差（如实登记，详见 manifest ledger）：
 *  - web 搜索提示「搜索基金代码或名称」，后端 search 只对基金名称做 ilike
 *    （apps/api/src/db/fund-queries.ts:13），代码不支持搜索，如实透传。
 *  - web 该页无登录门，后端 /api/fund* 需登录，RN 侧加登录门避免发注定 401 的查询。
 */
export function FundDataScreen() {
  const navigation = useNavigation<NavigationProp>()
  const { t } = useI18n()
  const { resolvedTheme } = useTheme()
  const { user } = useAuth()

  const [search, setSearch] = useState('')
  const [debounced, setDebounced] = useState('')
  const [rows, setRows] = useState<FundDataRowView[]>([])
  const [total, setTotal] = useState(0)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const [detailCode, setDetailCode] = useState<string | null>(null)
  const [detailRows, setDetailRows] = useState<FundNetValueRowView[]>([])
  const [detailLoading, setDetailLoading] = useState(false)
  const [detailError, setDetailError] = useState<string | null>(null)

  useEffect(() => {
    const tm = setTimeout(() => setDebounced(search), SEARCH_DEBOUNCE_MS)
    return () => clearTimeout(tm)
  }, [search])

  const toRow = useCallback(
    (item: FundDataItem): FundDataRowView => ({
      id: item.id,
      code: item.code,
      name: item.name,
      type: item.type,
      status: item.status,
      statusText: t(STATUS_LABEL_KEYS[item.status] ?? 'fundDataPage.inactive'),
    }),
    [t],
  )

  /** 净值格式化：web 同口径 toFixed(4)（apps/web/app/(main)/fund-data/page.tsx:61-65） */
  const formatValue = useCallback((value: string | null): string => {
    if (value === null) return '-'
    const n = Number(value)
    return Number.isFinite(n) ? n.toFixed(4) : value
  }, [])

  const toHistoryRow = useCallback(
    (item: FundNetValueItem): FundNetValueRowView => ({
      id: item.id,
      dateText: item.date,
      netValueText: formatValue(item.value),
    }),
    [formatValue],
  )

  const load = useCallback(async () => {
    if (!user) return
    setLoading(true)
    try {
      const res = await getFundDataList({
        page: 1,
        pageSize: LIST_PAGE_SIZE,
        ...(debounced ? { search: debounced } : {}),
      })
      if (!res.success || !res.data) {
        setError(t('common.loadFailed'))
        return
      }
      setError(null)
      setTotal(res.data.total ?? 0)
      setRows((res.data.list ?? []).map(toRow))
    } catch {
      setError(t('common.loadFailed'))
    } finally {
      setLoading(false)
    }
  }, [user, debounced, toRow, t])

  useEffect(() => {
    void load()
  }, [load])

  const openDetail = useCallback(
    async (code: string) => {
      setDetailCode(code)
      setDetailRows([])
      setDetailError(null)
      setDetailLoading(true)
      try {
        const res = await getFundDataHistory(code, { page: 1, pageSize: HISTORY_PAGE_SIZE })
        if (!res.success || !res.data) {
          setDetailError(t('common.loadFailed'))
          return
        }
        setDetailRows((res.data.list ?? []).map(toHistoryRow))
      } catch {
        setDetailError(t('common.loadFailed'))
      } finally {
        setDetailLoading(false)
      }
    },
    [toHistoryRow, t],
  )

  const closeDetail = useCallback(() => {
    setDetailCode(null)
    setDetailRows([])
    setDetailError(null)
    setDetailLoading(false)
  }, [])

  const detailTitle = useMemo(
    () => (detailCode ? t(`${NS}.viewDetail`) : ''),
    [detailCode, t],
  )

  return (
    <SharedFundDataScreen
      t={t}
      colorScheme={resolvedTheme}
      onBack={() => navigation.goBack()}
      loginRequiredText={user ? '' : t(`${NS}.loginRequired`)}
      searchValue={search}
      onSearchChange={setSearch}
      loading={loading}
      error={error}
      rows={rows}
      total={total}
      onRefresh={() => void load()}
      detailVisible={detailCode !== null}
      detailTitle={detailTitle}
      detailLoading={detailLoading}
      detailError={detailError}
      historyRows={detailRows}
      onSelectFund={(code: string) => void openDetail(code)}
      onCloseDetail={closeDetail}
    />
  )
}
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
