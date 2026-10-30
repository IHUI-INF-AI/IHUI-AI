// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

import { useCallback, useEffect, useMemo, useState } from 'react'
import { useNavigation } from '@react-navigation/native'
import type { NativeStackNavigationProp } from '@react-navigation/native-stack'
import { getMyAgents, type MyAgentRow } from '@ihui/api-client'
import { apiFailureToText } from '@ihui/shared/utils'
import {
  MyAgentsScreen as SharedMyAgentsScreen,
  type MyAgentRowView,
} from '@ihui/rn-app'
import { useI18n } from '../i18n'
import { useAuth } from '../context/AuthContext'
import { useTheme } from '../context/ThemeContext'
import type { RootStackParamList } from '../navigation/RootNavigator'

type NavigationProp = NativeStackNavigationProp<RootStackParamList>

const NS = 'agentsMyPage'

/** 与 web 同参(apps/web/app/(main)/agents/my/page.tsx:72 page=1&pageSize=100) */
const PAGE_SIZE = 100

/** 与 web STATUS_FILTER_KEY 同表(page.tsx:46-52),值=本页 ns 下的 i18n 键 */
const STATUS_LABEL_KEYS: Record<string, string> = {
  pending: `${NS}.statusPending`,
  published: `${NS}.statusPublished`,
  rejected: `${NS}.statusRejected`,
  offline: `${NS}.statusOffline`,
}

/**
 * RN 端「我的智能体」薄壳 —— 承载 web /agents/my。渲染全部委托共享屏,本文件只管:
 * 取数 GET /api/agents/my(page/status,契约 apps/api/src/routes/agents.ts:404-425、
 * 行形状 apps/api/src/db/agents-queries.ts:37-77)、状态字典、价格与时间格式化
 * (web 同参 Intl year/month/day 2-digit,page.tsx:79-87)、登录门(web useAuthGate 同口径)、
 * 行点击 → AgentDetail、创建 → AgentCreate(均为既有路由,RootNavigator.tsx:591/594)。
 */
export function MyAgentsScreen() {
  const navigation = useNavigation<NavigationProp>()
  const { t, locale } = useI18n()
  const { resolvedTheme } = useTheme()
  const { user } = useAuth()

  const [filterValue, setFilterValue] = useState<string>('all')
  const [rows, setRows] = useState<MyAgentRowView[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const dateFmt = useMemo(
    () =>
      new Intl.DateTimeFormat(locale, {
        year: 'numeric',
        month: '2-digit',
        day: '2-digit',
      }),
    [locale],
  )

  const fmtDate = useCallback(
    (value: string): string => {
      const d = new Date(value)
      return Number.isNaN(d.getTime()) ? '-' : dateFmt.format(d)
    },
    [dateFmt],
  )

  const toRow = useCallback(
    (item: MyAgentRow): MyAgentRowView => {
      // web page.tsx:175-177:字典外状态原样显示,不编造译文
      const labelKey = STATUS_LABEL_KEYS[item.status]
      return {
        agentId: item.agentId,
        name: item.name,
        descText: item.description ?? t(`${NS}.noDescription`),
        status: item.status,
        statusText: labelKey ? t(labelKey) : item.status,
        priceText: item.isFree ? t(`${NS}.free`) : `¥${item.price}`,
        updatedText: fmtDate(item.updatedAt),
      }
    },
    [fmtDate, t],
  )

  const load = useCallback(async () => {
    if (!user) return
    setLoading(true)
    setError(null)
    const res = await getMyAgents({
      page: 1,
      pageSize: PAGE_SIZE,
      status: filterValue === 'all' ? undefined : filterValue,
    })
    if (res.success) {
      setRows((res.data.list ?? []).map(toRow))
    } else {
      setRows([])
      setError(apiFailureToText(res, t(`${NS}.loadFailed`)))
    }
    setLoading(false)
  }, [user, filterValue, toRow, t])

  useEffect(() => {
    void load()
  }, [load])

  return (
    <SharedMyAgentsScreen
      t={t}
      colorScheme={resolvedTheme}
      onBack={() => navigation.goBack()}
      onCreate={() => navigation.navigate('AgentCreate')}
      loginRequiredText={user ? '' : t(`${NS}.loginRequired`)}
      loading={loading}
      error={error}
      rows={rows}
      filterValue={filterValue}
      onFilterChange={setFilterValue}
      onPressRow={(agentId) => navigation.navigate('AgentDetail', { id: agentId })}
      onRetry={() => void load()}
      onRefresh={() => void load()}
    />
  )
}
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
