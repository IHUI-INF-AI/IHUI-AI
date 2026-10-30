// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

import { useCallback, useEffect, useMemo, useState } from 'react'
import { useNavigation } from '@react-navigation/native'
import type { NativeStackNavigationProp } from '@react-navigation/native-stack'
import { getScheduleTasks, type ScheduleTaskItem } from '@ihui/api-client'
import {
  ScheduleTasksScreen as SharedScheduleTasksScreen,
  type ScheduleTaskCardView,
} from '@ihui/rn-app'
import { useI18n } from '../i18n'
import { useAuth } from '../context/AuthContext'
import { useTheme } from '../context/ThemeContext'
import type { RootStackParamList } from '../navigation/RootNavigator'

type NavigationProp = NativeStackNavigationProp<RootStackParamList>

const NS = 'scheduleTasksPage'

/** 与 web 同值(apps/web/app/(main)/schedule/page.tsx:49 PAGE_SIZE = 20) */
const PAGE_SIZE = 20

/** 与 web 同防抖(page.tsx:61-67:300ms 后置生效并回第一页) */
const SEARCH_DEBOUNCE_MS = 300

/**
 * RN 端「排课任务」薄壳 —— 承载 web /schedule。渲染全部委托共享屏,本文件只管:
 * 取数 GET /api/schedule/tasks(page/pageSize/name,契约 apps/api/src/routes/schedule.ts:83-113)、
 * 搜索防抖(300ms,web 同参)、分页游标(触底续页)、时间 Intl 格式化、登录门(web useAuthGate 同口径)。
 * 口径差如实登记:web 用「上一页/下一页」按钮,RN 改下拉刷新 + 触底续页,同端点同参数。
 * 优先级/状态/「未执行」等动态行文本按当前语言在此注入,共享屏不持有词条。
 */
export function ScheduleTasksScreen() {
  const navigation = useNavigation<NavigationProp>()
  const { t, locale } = useI18n()
  const { resolvedTheme } = useTheme()
  const { user } = useAuth()

  const [search, setSearch] = useState('')
  const [debounced, setDebounced] = useState('')
  const [rows, setRows] = useState<ScheduleTaskCardView[]>([])
  const [total, setTotal] = useState(0)
  const [page, setPage] = useState(1)
  const [loading, setLoading] = useState(false)
  const [loadingMore, setLoadingMore] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    const timer = setTimeout(() => {
      setDebounced(search)
      setPage(1)
    }, SEARCH_DEBOUNCE_MS)
    return () => clearTimeout(timer)
  }, [search])

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
    (value: string | null): string | null => {
      if (!value) return null
      const d = new Date(value)
      return Number.isNaN(d.getTime()) ? null : dateFmt.format(d)
    },
    [dateFmt],
  )

  const toView = useCallback(
    (item: ScheduleTaskItem): ScheduleTaskCardView => ({
      id: item.id,
      name: item.name,
      description: item.description ?? null,
      cronExpression: item.cronExpression,
      targetText: item.targetService
        ? `${item.targetService}${item.targetMethod ? `.${item.targetMethod}` : ''}`
        : null,
      status: item.lastRunStatus ?? null,
      statusText: item.lastRunStatus ?? t(`${NS}.neverRun`),
      priorityText: `${t(`${NS}.priority`)} ${item.priority}`,
      enabled: item.enabled,
      lastRunTimeText: fmtDate(item.lastRunTime),
    }),
    [fmtDate, t],
  )

  const load = useCallback(
    async (nextPage: number, append: boolean) => {
      if (!user) return
      if (append) setLoadingMore(true)
      else setLoading(true)
      try {
        const res = await getScheduleTasks({
          page: nextPage,
          pageSize: PAGE_SIZE,
          name: debounced || undefined,
        })
        if (!res.success || !res.data) {
          setError(res.error ?? t('common.loadFailed'))
          return
        }
        setError(null)
        const items = res.data.list ?? []
        setTotal(res.data.total ?? 0)
        setRows((prev) => (append ? [...prev, ...items.map(toView)] : items.map(toView)))
        setPage(nextPage)
      } catch {
        setError(t('common.loadFailed'))
      } finally {
        setLoading(false)
        setLoadingMore(false)
      }
    },
    [user, debounced, toView, t],
  )

  useEffect(() => {
    void load(1, false)
  }, [load])

  const hasMore = rows.length < total

  return (
    <SharedScheduleTasksScreen
      t={t}
      colorScheme={resolvedTheme}
      onBack={() => navigation.goBack()}
      loginRequiredText={user ? '' : t(`${NS}.loginRequired`)}
      loading={loading}
      error={error}
      tasks={rows}
      total={total}
      searchValue={search}
      onSearchChange={setSearch}
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
